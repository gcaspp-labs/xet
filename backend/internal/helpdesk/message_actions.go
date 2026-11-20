package helpdesk

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/gcaspp-labs/xet/backend/internal/core/audit"
	"github.com/gcaspp-labs/xet/backend/internal/core/auth"
	"github.com/gcaspp-labs/xet/backend/internal/core/realtime"
	"github.com/gcaspp-labs/xet/backend/internal/db"
	"github.com/gcaspp-labs/xet/backend/internal/helpdesk/messaging"
)

var (
	// ErrChangeInProgress is an edit or deletion of a message that already
	// has one waiting for the provider.
	ErrChangeInProgress = errors.New("another change of the message is in flight")
	// ErrEmptyEdit is an edit of a text that leaves it blank.
	ErrEmptyEdit = errors.New("edited text is blank")
)

// NotChangeableError is an edit or deletion the message does not admit now:
// not sent through the system, still sending, failed, deleted, audio, out of
// the window of the provider or unsupported by it. Nothing was recorded.
type NotChangeableError struct {
	Reason string
}

func (e NotChangeableError) Error() string { return "message cannot be changed: " + e.Reason }

// ChangeNotAppliedError is an edit or deletion for everyone the provider
// refused, or whose result is unknown (Uncertain). Either way the message
// keeps the content and state it had: nothing is shown as done without the
// answer of the provider.
type ChangeNotAppliedError struct {
	Reason    string
	Uncertain bool
}

func (e ChangeNotAppliedError) Error() string { return "message change not applied: " + e.Reason }

// Why a message does not admit the change, shown to the agent.
const (
	changeNotFromSystem   = "Só é possível alterar mensagens enviadas pelo XET."
	changeSending         = "A mensagem ainda está sendo enviada."
	changeFailedLocalOnly = "Mensagem com falha só pode ser excluída para mim."
	changeDeleted         = "Esta mensagem já foi excluída."
	changeNotEditable     = "Só é possível editar texto ou legenda. Áudio não tem edição."
	changeEditExpired     = "O prazo para editar esta mensagem terminou."
	changeRevokeExpired   = "O prazo para excluir para todos terminou. Ainda é possível excluir para mim."
	changeEditUnavailable = "O WhatsApp deste setor não permite editar mensagens."
	changeRevokeUnavail   = "O WhatsApp deste setor não permite excluir para todos. Ainda é possível excluir para mim."
	retryDeleted          = "Esta mensagem foi excluída e não pode ser reenviada."
)

// Why the provider did not apply the change, shown to the agent.
const (
	changeNotConnected    = "Número do setor desconectado. A mensagem não foi alterada."
	changeContactNotFound = "Este telefone não tem WhatsApp. A mensagem não foi alterada."
	changeUnsupported     = "O WhatsApp deste setor não permite esta alteração."
	changeRefused         = "O WhatsApp não aceitou a alteração. Tente novamente."
	changeUncertain       = "Não foi possível confirmar a alteração com o WhatsApp. Confira a conversa antes de tentar de novo."
	changeRestarted       = "O serviço foi reiniciado durante a alteração. Confira a conversa antes de tentar de novo."
)

// MessageChange is an edit or a deletion the assignee confirms in the panel.
// ClientRequestID makes a repeated request return the first one's result
// without acting again. Body, in an edit, is the new text or caption without
// the nickname, which is kept as recorded in the send.
type MessageChange struct {
	ClientRequestID pgtype.UUID
	Kind            db.MessageActionKind
	Body            string
}

// ChangeMessage edits, or deletes for everyone or only in the system
// ("para mim"), a message sent through the system, as the assignee of its
// open ticket confirmed it; supervisors and admins also need to be the
// assignee, and the message need not be theirs.
//
// The decision is taken with the ticket locked, on the message as it is now
// and with the server clock: the window of the provider counts from the
// original send and does not restart with each edit. The action is recorded
// before it goes to the provider, outside any transaction; only the answer of
// the provider (or the echo of the change) applies it, with the original kept
// and the new version or the deletion recorded with the agent as author. A
// refusal or an unknown result changes nothing in the message. A local
// deletion never goes to the provider and is applied at once.
func (s *Service) ChangeMessage(ctx context.Context, provider messaging.Provider, actor auth.User, messageID int64, req MessageChange) (db.Message, error) {
	if a, err := s.q.GetMessageActionByClientRequestID(ctx, req.ClientRequestID); err == nil {
		return s.repeatedChange(ctx, a, actor, messageID, req.Kind)
	} else if !errors.Is(err, pgx.ErrNoRows) {
		return db.Message{}, fmt.Errorf("get message action by request: %w", err)
	}
	ref, err := s.q.GetMessage(ctx, messageID)
	if errors.Is(err, pgx.ErrNoRows) {
		return db.Message{}, ErrMessageNotFound
	}
	if err != nil {
		return db.Message{}, fmt.Errorf("get message: %w", err)
	}
	if _, err := s.accessible(ctx, actor, ref.TicketID); err != nil {
		return db.Message{}, err
	}
	capabilities := provider.Capabilities()

	var action db.MessageAction
	var target db.Message
	local := req.Kind == db.MessageActionKindDeleteLocal
	err = pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		q := s.q.WithTx(tx)
		t, err := db.AsTicket(q.GetTicketForUpdate(ctx, ref.TicketID))
		if err != nil {
			return fmt.Errorf("lock ticket: %w", err)
		}
		if err := conducts(t, actor); err != nil {
			return err
		}
		if target, err = q.GetMessage(ctx, ref.ID); err != nil {
			return fmt.Errorf("get message: %w", err)
		}
		if err := changeable(target, req.Kind, capabilities, time.Now()); err != nil {
			return err
		}
		var body *string
		if req.Kind == db.MessageActionKindEdit {
			edited, err := editedBody(ctx, q, target, req.Body)
			if err != nil {
				return err
			}
			body = &edited
		}
		status := db.MessageActionStatusPending
		if local {
			status = db.MessageActionStatusAccepted
		}
		action, err = q.CreateMessageAction(ctx, db.CreateMessageActionParams{
			ClientRequestID: req.ClientRequestID, MessageID: target.ID, TicketID: target.TicketID, SectorID: target.SectorID,
			AuthorID: actor.ID, Kind: req.Kind, Body: body, Status: status,
		})
		switch {
		case errors.Is(err, pgx.ErrNoRows):
			return errDuplicate
		case isConstraint(err, "message_actions_in_flight_key"):
			return ErrChangeInProgress
		case err != nil:
			return fmt.Errorf("create message action: %w", err)
		}
		if local {
			return applyAction(ctx, q, action, nil, time.Now())
		}
		return nil
	})
	if errors.Is(err, errDuplicate) {
		// A concurrent request with the same client_request_id won.
		a, err := s.q.GetMessageActionByClientRequestID(ctx, req.ClientRequestID)
		if err != nil {
			return db.Message{}, fmt.Errorf("get message action by request: %w", err)
		}
		return s.repeatedChange(ctx, a, actor, messageID, req.Kind)
	}
	if err != nil {
		return db.Message{}, err
	}
	if local {
		s.hub.Publish(realtime.TicketChanged(target.SectorID, target.TicketID))
		return s.actionResult(ctx, action)
	}

	// The request may be gone by now: what the provider answers is recorded anyway.
	ctx, cancel := context.WithTimeout(context.WithoutCancel(ctx), sendTimeout)
	defer cancel()
	eventID, sendErr := s.sendChange(ctx, provider, target, action)
	status, reason := db.MessageActionStatusAccepted, (*string)(nil)
	if sendErr != nil {
		slog.Warn("send message change", "message_id", target.ID, "action_id", action.ID, "error", sendErr)
		var r string
		status, r = changeFailure(sendErr)
		reason = &r
	}

	applied := false
	err = pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		q := s.q.WithTx(tx)
		// The same order of locks as a change received from the provider, so
		// its echo waits for this one, or this one for it.
		if err := q.LockMessageExternalID(ctx, db.LockMessageExternalIDParams{SectorID: target.SectorID, ExternalMessageID: *target.ExternalMessageID}); err != nil {
			return fmt.Errorf("lock message: %w", err)
		}
		if _, err := q.GetTicketForUpdate(ctx, target.TicketID); err != nil {
			return fmt.Errorf("lock ticket: %w", err)
		}
		finished, err := q.FinishMessageAction(ctx, db.FinishMessageActionParams{
			ID: action.ID, Status: status, FailureReason: reason, ExternalEventID: optional(eventID),
		})
		if errors.Is(err, pgx.ErrNoRows) {
			// The echo of the provider already settled it.
			return nil
		}
		if err != nil {
			return fmt.Errorf("finish message action: %w", err)
		}
		if status != db.MessageActionStatusAccepted {
			return nil
		}
		// What the provider just took is applied even if the ticket was closed
		// or transferred meanwhile: it is what the contact has now.
		applied = true
		return applyAction(ctx, q, finished, finished.ExternalEventID, time.Now())
	})
	if err != nil {
		// The provider answered but the result could not be recorded: the
		// action stays pending, to be marked uncertain on restart, and its
		// echo may still settle it.
		return db.Message{}, err
	}
	if applied {
		s.hub.Publish(realtime.TicketChanged(target.SectorID, target.TicketID))
	}
	current, err := s.q.GetMessageActionByClientRequestID(ctx, req.ClientRequestID)
	if err != nil {
		return db.Message{}, fmt.Errorf("get message action: %w", err)
	}
	return s.actionResult(ctx, current)
}

// repeatedChange answers a repeated request with the result of the first one,
// refusing a request ID that belongs to another message, author or action.
func (s *Service) repeatedChange(ctx context.Context, a db.MessageAction, actor auth.User, messageID int64, kind db.MessageActionKind) (db.Message, error) {
	if a.MessageID != messageID || a.AuthorID != actor.ID || a.Kind != kind {
		return db.Message{}, ErrRequestReused
	}
	return s.actionResult(ctx, a)
}

// actionResult is what a request of the action answers: the message as it is
// now when the action was applied, or the reason it was not.
func (s *Service) actionResult(ctx context.Context, a db.MessageAction) (db.Message, error) {
	switch a.Status {
	case db.MessageActionStatusAccepted:
		m, err := s.q.GetMessage(ctx, a.MessageID)
		if err != nil {
			return db.Message{}, fmt.Errorf("get message: %w", err)
		}
		return m, nil
	case db.MessageActionStatusPending:
		return db.Message{}, ErrChangeInProgress
	default:
		reason := changeRefused
		if a.FailureReason != nil {
			reason = *a.FailureReason
		}
		return db.Message{}, ChangeNotAppliedError{Reason: reason, Uncertain: a.Status == db.MessageActionStatusUncertain}
	}
}

// changeable checks that the message admits the change now. Only a message
// sent through the system is changed. One still sending admits nothing; one
// that failed never reached the contact, so it is only hidden in the system;
// a deleted one admits nothing more. Edits change the text or the caption,
// never audio, within the edit window of the provider; deletion for everyone
// within its deletion window. A zero window is an action the provider does
// not have.
func changeable(m db.Message, kind db.MessageActionKind, c messaging.Capabilities, now time.Time) error {
	if m.Origin != db.MessageOriginAgent {
		return NotChangeableError{Reason: changeNotFromSystem}
	}
	if m.DeletedAt != nil {
		return NotChangeableError{Reason: changeDeleted}
	}
	if !m.Status.Valid || m.Status.MessageStatus == db.MessageStatusPending {
		return NotChangeableError{Reason: changeSending}
	}
	if kind == db.MessageActionKindDeleteLocal {
		return nil
	}
	if m.Status.MessageStatus == db.MessageStatusFailed || m.ExternalMessageID == nil {
		return NotChangeableError{Reason: changeFailedLocalOnly}
	}
	age := now.Sub(m.SentAt)
	switch kind {
	case db.MessageActionKindEdit:
		switch m.Type {
		case db.MessageTypeText, db.MessageTypeImage, db.MessageTypeVideo, db.MessageTypeDocument:
		default:
			return NotChangeableError{Reason: changeNotEditable}
		}
		if c.EditWindow <= 0 {
			return NotChangeableError{Reason: changeEditUnavailable}
		}
		if age >= c.EditWindow {
			return NotChangeableError{Reason: changeEditExpired}
		}
	case db.MessageActionKindDeleteEveryone:
		if c.RevokeWindow <= 0 {
			return NotChangeableError{Reason: changeRevokeUnavail}
		}
		if age >= c.RevokeWindow {
			return NotChangeableError{Reason: changeRevokeExpired}
		}
	default:
		return fmt.Errorf("unknown message action %q", kind)
	}
	return nil
}

// editedBody is the new content as the contact sees it: the nickname recorded
// in the original send, then the new text or caption. A text is never left
// blank; a caption may be, like an attachment sent without one.
func editedBody(ctx context.Context, q *db.Queries, m db.Message, text string) (string, error) {
	if m.Type == db.MessageTypeText && strings.TrimSpace(text) == "" {
		return "", ErrEmptyEdit
	}
	original, err := q.GetOriginalMessageBody(ctx, m.ID)
	if err != nil {
		return "", fmt.Errorf("get original body: %w", err)
	}
	prefix := nicknamePrefix(original)
	switch {
	case prefix == "":
		return text, nil
	case strings.TrimSpace(text) == "":
		return prefix, nil
	default:
		return prefix + "\n" + text, nil
	}
}

// nicknamePrefix is the "*Ana Souza:*" line formatNickname put before the
// text in the send; empty when the body has none.
func nicknamePrefix(body string) string {
	line, _, _ := strings.Cut(body, "\n")
	if len(line) > 3 && strings.HasPrefix(line, "*") && strings.HasSuffix(line, ":*") {
		return line
	}
	return ""
}

// applyAction applies an action of the panel the provider took (or a local
// deletion), with the ticket locked: an edit keeps the original and becomes
// the current version, always the newest one, as a reaction of the panel
// does; a deletion marks the message, keeping its content and file. Both are
// recorded as changes made by the agent, and audited.
func applyAction(ctx context.Context, q *db.Queries, a db.MessageAction, eventID *string, at time.Time) error {
	m, err := q.GetMessage(ctx, a.MessageID)
	if err != nil {
		return fmt.Errorf("get message: %w", err)
	}
	at = at.Truncate(time.Microsecond)
	change := db.CreateMessageChangeParams{
		SectorID: m.SectorID, MessageID: &m.ID, TargetExternalMessageID: m.ExternalMessageID,
		Origin: db.MessageOriginAgent, AuthorID: &a.AuthorID, ExternalEventID: eventID,
	}
	changes := audit.Changes{}
	var auditAction string
	switch a.Kind {
	case db.MessageActionKindEdit:
		if err := q.CreateOriginalVersion(ctx, m.ID); err != nil {
			return fmt.Errorf("keep original version: %w", err)
		}
		if m.EditedAt != nil && !m.EditedAt.Before(at) {
			at = m.EditedAt.Add(time.Microsecond)
		}
		change.Kind, change.Body, change.OccurredAt = db.MessageChangeKindEdit, a.Body, at
		auditAction = "message_edited"
		changes.Set("body", m.Body, a.Body)
	default:
		scope := db.MessageDeletionScopeEveryone
		if a.Kind == db.MessageActionKindDeleteLocal {
			scope = db.MessageDeletionScopeLocal
		}
		change.Kind, change.OccurredAt = db.MessageChangeKindDeletion, at
		change.DeletionScope = db.NullMessageDeletionScope{MessageDeletionScope: scope, Valid: true}
		auditAction = "message_deleted"
		changes.Set("deletion_scope", nil, string(scope))
	}
	if _, err := q.CreateMessageChange(ctx, change); err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return fmt.Errorf("create message change: %w", err)
	}
	switch a.Kind {
	case db.MessageActionKindEdit:
		if err := q.RefreshMessageCurrentVersion(ctx, m.ID); err != nil {
			return fmt.Errorf("set message version: %w", err)
		}
	default:
		if _, err := q.MarkMessageDeleted(ctx, db.MarkMessageDeletedParams{
			ID: m.ID, DeletedAt: &at, DeletionScope: change.DeletionScope,
			DeletionOrigin: db.NullMessageOrigin{MessageOrigin: db.MessageOriginAgent, Valid: true},
		}); err != nil {
			return fmt.Errorf("mark message deleted: %w", err)
		}
	}
	raw, err := changes.JSON()
	if err != nil {
		return err
	}
	if err := q.CreateAuditLog(ctx, db.CreateAuditLogParams{
		TicketID: &m.TicketID, EntityType: "message", EntityID: m.ID, Action: auditAction, ActorID: &a.AuthorID, Changes: raw,
	}); err != nil {
		return fmt.Errorf("audit: %w", err)
	}
	return nil
}

// acceptEchoedAction settles an action of the panel still waiting for the
// provider, or with an unknown result, when the provider delivers the change
// it made (its echo, from the sector number, with the same content): the echo
// is the evidence the change was applied. It reports whether it was one; the
// caller holds the lock of the provider ID and of the ticket.
func acceptEchoedAction(ctx context.Context, q *db.Queries, messageID int64, c externalChange) (bool, error) {
	kind := db.MessageActionKindEdit
	if c.kind == db.MessageChangeKindDeletion {
		kind = db.MessageActionKindDeleteEveryone
	}
	a, err := q.FindEchoedMessageAction(ctx, db.FindEchoedMessageActionParams{MessageID: messageID, Kind: kind, Body: c.body})
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("find echoed message action: %w", err)
	}
	accepted, err := q.AcceptUncertainMessageAction(ctx, db.AcceptUncertainMessageActionParams{ID: a.ID, ExternalEventID: optional(c.eventID)})
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("accept echoed message action: %w", err)
	}
	return true, applyAction(ctx, q, accepted, accepted.ExternalEventID, time.Now())
}

// sendChange hands the edit or the deletion for everyone to the provider and
// returns the provider ID of the change. The action ID is the idempotency key.
func (s *Service) sendChange(ctx context.Context, provider messaging.Provider, m db.Message, a db.MessageAction) (string, error) {
	to, err := s.recipient(ctx, provider, m.SectorID, m.ContactID)
	if err != nil {
		return "", err
	}
	key := a.ClientRequestID.String()
	if a.Kind == db.MessageActionKindEdit {
		return provider.EditMessage(ctx, messaging.MessageEdit{
			SectorID: m.SectorID, To: to, TargetExternalMessageID: *m.ExternalMessageID,
			Type: messaging.MessageType(m.Type), Body: *a.Body, IdempotencyKey: key,
		})
	}
	return provider.RevokeMessage(ctx, messaging.MessageRevoke{
		SectorID: m.SectorID, To: to, TargetExternalMessageID: *m.ExternalMessageID, IdempotencyKey: key,
	})
}

// changeFailure tells a refusal of the provider, which recorded nothing on
// its side, from an unknown result, which may have changed the message.
func changeFailure(err error) (db.MessageActionStatus, string) {
	switch {
	case errors.Is(err, messaging.ErrNotConnected):
		return db.MessageActionStatusRefused, changeNotConnected
	case errors.Is(err, messaging.ErrContactNotFound):
		return db.MessageActionStatusRefused, changeContactNotFound
	case errors.Is(err, messaging.ErrUnsupported):
		return db.MessageActionStatusRefused, changeUnsupported
	case errors.Is(err, messaging.ErrNotAccepted):
		return db.MessageActionStatusRefused, changeRefused
	default:
		return db.MessageActionStatusUncertain, changeUncertain
	}
}

// UncertainPending marks the actions left waiting for the provider by a
// previous run as uncertain: the provider may have applied them, so they are
// neither shown as done nor as refused, and their echo may still settle
// them. It runs when the service starts, before the API accepts requests.
func (s *Service) UncertainPending(ctx context.Context) (int64, error) {
	reason := changeRestarted
	n, err := s.q.UncertainPendingMessageActions(ctx, &reason)
	if err != nil {
		return 0, fmt.Errorf("mark pending message actions uncertain: %w", err)
	}
	return n, nil
}
