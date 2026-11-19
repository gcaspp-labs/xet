package helpdesk

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/gcaspp-labs/xet/backend/internal/core/directory"
	"github.com/gcaspp-labs/xet/backend/internal/core/realtime"
	"github.com/gcaspp-labs/xet/backend/internal/db"
	"github.com/gcaspp-labs/xet/backend/internal/helpdesk/messaging"
)

// externalChange is an edit or a deletion for everyone received from the
// provider, made by the contact or from the phone of the sector.
type externalChange struct {
	sectorID   int64
	target     string
	eventID    string
	contactID  string
	phone      string
	fromSector bool
	group      bool
	kind       db.MessageChangeKind
	body       *string
	at         time.Time
}

// HandleMessageEdited records the new text or caption of a message the sector
// already has. See recordChange.
func (s *Service) HandleMessageEdited(ctx context.Context, ev messaging.MessageEdited) error {
	body := ev.Body
	return s.recordChange(ctx, externalChange{
		sectorID: ev.SectorID, target: ev.TargetExternalMessageID, eventID: ev.ExternalEventID,
		contactID: ev.ExternalContactID, phone: ev.Phone, fromSector: ev.FromSector, group: ev.Group,
		kind: db.MessageChangeKindEdit, body: &body, at: ev.At,
	})
}

// HandleMessageRevoked records a message deleted for everyone, keeping its
// content. See recordChange.
func (s *Service) HandleMessageRevoked(ctx context.Context, ev messaging.MessageRevoked) error {
	return s.recordChange(ctx, externalChange{
		sectorID: ev.SectorID, target: ev.TargetExternalMessageID, eventID: ev.ExternalEventID,
		contactID: ev.ExternalContactID, phone: ev.Phone, fromSector: ev.FromSector, group: ev.Group,
		kind: db.MessageChangeKindDeletion, at: ev.At,
	})
}

// recordChange records an edit or a deletion for everyone of the message of
// the sector with the provider ID, also in a closed ticket. A change is not a
// message: it never opens a ticket nor adds a message. Nothing is erased: an
// edit keeps the original and every version, and a deletion keeps the
// content and the file.
//
// The same provider event delivered again, or echoed back, changes nothing;
// without an event ID, the same kind, time and content neither, and an edit
// to the content the message already shows is an echo. A late edit is kept
// as a version but does not undo a newer one. A change that arrives before
// its message waits, unlinked, and is applied when the message is recorded
// (applyPendingChanges). A change whose author cannot have made it (the
// contact on a message of the sector, the phone on one of the contact, or
// another contact) is discarded. The panels of the sector are notified after
// the commit, only when something was recorded on a known message.
func (s *Service) recordChange(ctx context.Context, c externalChange) error {
	if c.group {
		return nil
	}
	if c.target == "" {
		return errors.New("message change without target message id")
	}
	if c.at.IsZero() {
		c.at = time.Now()
	}

	var ticketID int64
	changed := false
	err := pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		q := s.q.WithTx(tx)
		if err := q.LockMessageExternalID(ctx, db.LockMessageExternalIDParams{SectorID: c.sectorID, ExternalMessageID: c.target}); err != nil {
			return fmt.Errorf("lock message: %w", err)
		}
		if c.eventID != "" {
			seen, err := q.MessageChangeEventExists(ctx, db.MessageChangeEventExistsParams{SectorID: c.sectorID, ExternalEventID: &c.eventID})
			if err != nil {
				return fmt.Errorf("check message change: %w", err)
			}
			if seen {
				return nil
			}
		}

		msg, err := q.GetMessageForChange(ctx, db.GetMessageForChangeParams{SectorID: c.sectorID, ExternalMessageID: &c.target})
		if errors.Is(err, pgx.ErrNoRows) {
			return savePendingChange(ctx, q, c)
		}
		if err != nil {
			return fmt.Errorf("get changed message: %w", err)
		}
		// Every change of a ticket takes its lock, as the other actions do.
		if _, err := q.GetTicketForUpdate(ctx, msg.TicketID); err != nil {
			return fmt.Errorf("get ticket: %w", err)
		}
		if !changeAllowed(msg.Origin, c.origin(), msg.ContactExternalID, msg.ContactPhone, c.contactID, c.phone) {
			return nil
		}
		ticketID = msg.TicketID
		changed, err = applyChange(ctx, q, msg, c)
		return err
	})
	if err != nil {
		return err
	}
	if changed {
		s.hub.Publish(realtime.TicketChanged(c.sectorID, ticketID))
	}
	return nil
}

func (c externalChange) origin() db.MessageOrigin {
	if c.fromSector {
		return db.MessageOriginPhone
	}
	return db.MessageOriginCustomer
}

// changeAllowed tells whether the author of a change could have made it: the
// contact changes only its own messages, the phone of the sector only those
// of the sector, and the chat of the change is the one of the message.
func changeAllowed(msgOrigin, changeOrigin db.MessageOrigin, contactID, contactPhone *string, eventContactID, eventPhone string) bool {
	if (changeOrigin == db.MessageOriginCustomer) != (msgOrigin == db.MessageOriginCustomer) {
		return false
	}
	if eventContactID != "" && contactID != nil && *contactID == eventContactID {
		return true
	}
	return eventPhone != "" && contactPhone != nil && slices.Contains(directory.PhoneVariants(eventPhone), *contactPhone)
}

// savePendingChange keeps a change whose message the sector does not have
// yet, unless the same one is already waiting.
func savePendingChange(ctx context.Context, q *db.Queries, c externalChange) error {
	dup, err := changeRecorded(ctx, q, c, nil)
	if err != nil || dup {
		return err
	}
	_, err = createChange(ctx, q, c, nil)
	return err
}

// applyChange records the change of a known message, with its ticket locked,
// and reports whether anything was recorded.
func applyChange(ctx context.Context, q *db.Queries, msg db.GetMessageForChangeRow, c externalChange) (bool, error) {
	switch c.kind {
	case db.MessageChangeKindEdit:
		// The content the message already shows is an echo, or the same edit
		// again: no new version.
		if msg.Body != nil && *msg.Body == *c.body {
			return false, nil
		}
	case db.MessageChangeKindDeletion:
		if msg.DeletedAt != nil {
			return false, nil
		}
	}
	dup, err := changeRecorded(ctx, q, c, &msg.ID)
	if err != nil || dup {
		return false, err
	}
	created, err := createChange(ctx, q, c, &msg.ID)
	if err != nil || !created {
		return false, err
	}
	return true, effect(ctx, q, msg.ID, c.kind, c.origin(), c.body, c.at)
}

// effect applies a recorded change to the message: an edit newer than the
// current version becomes the content, after the original is kept; a
// deletion marks the message, keeping its content.
func effect(ctx context.Context, q *db.Queries, messageID int64, kind db.MessageChangeKind, origin db.MessageOrigin, body *string, at time.Time) error {
	switch kind {
	case db.MessageChangeKindEdit:
		if err := q.CreateOriginalVersion(ctx, messageID); err != nil {
			return fmt.Errorf("keep original version: %w", err)
		}
		if _, err := q.SetMessageCurrentVersion(ctx, db.SetMessageCurrentVersionParams{ID: messageID, Body: body, EditedAt: &at}); err != nil {
			return fmt.Errorf("set message version: %w", err)
		}
	case db.MessageChangeKindDeletion:
		_, err := q.MarkMessageDeleted(ctx, db.MarkMessageDeletedParams{
			ID: messageID, DeletedAt: &at,
			DeletionScope:  db.NullMessageDeletionScope{MessageDeletionScope: db.MessageDeletionScopeEveryone, Valid: true},
			DeletionOrigin: db.NullMessageOrigin{MessageOrigin: origin, Valid: true},
		})
		if err != nil {
			return fmt.Errorf("mark message deleted: %w", err)
		}
	}
	return nil
}

func changeRecorded(ctx context.Context, q *db.Queries, c externalChange, messageID *int64) (bool, error) {
	dup, err := q.MessageChangeRecorded(ctx, db.MessageChangeRecordedParams{
		SectorID: c.sectorID, Kind: c.kind, OccurredAt: c.at, Body: c.body, Origin: c.origin(),
		MessageID: messageID, TargetExternalMessageID: &c.target,
	})
	if err != nil {
		return false, fmt.Errorf("check message change: %w", err)
	}
	return dup, nil
}

// createChange records the change and reports false when its provider event
// was already recorded.
func createChange(ctx context.Context, q *db.Queries, c externalChange, messageID *int64) (bool, error) {
	params := db.CreateMessageChangeParams{
		SectorID: c.sectorID, MessageID: messageID, TargetExternalMessageID: &c.target,
		Kind: c.kind, Origin: c.origin(), ExternalContactID: optional(c.contactID), Phone: optional(c.phone),
		Body: c.body, ExternalEventID: optional(c.eventID), OccurredAt: c.at,
	}
	if c.kind == db.MessageChangeKindDeletion {
		params.DeletionScope = db.NullMessageDeletionScope{MessageDeletionScope: db.MessageDeletionScopeEveryone, Valid: true}
	}
	_, err := q.CreateMessageChange(ctx, params)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("create message change: %w", err)
	}
	return true, nil
}

// applyPendingChanges links to a message just recorded the changes that
// arrived before it, in the order they happened, and applies them. The
// caller holds the lock of the provider ID (LockMessageExternalID) and of the
// ticket. A pending change whose author could not have made it stays
// unlinked, as if discarded.
func applyPendingChanges(ctx context.Context, q *db.Queries, sectorID int64, msg db.GetMessageForChangeRow, externalID string) error {
	pending, err := q.ListPendingMessageChanges(ctx, db.ListPendingMessageChangesParams{SectorID: sectorID, TargetExternalMessageID: &externalID})
	if err != nil {
		return fmt.Errorf("list pending message changes: %w", err)
	}
	current := msg.Body
	for _, p := range pending {
		if !changeAllowed(msg.Origin, p.Origin, msg.ContactExternalID, msg.ContactPhone, deref(p.ExternalContactID), deref(p.Phone)) {
			continue
		}
		// An edit to the content the message already shows is an echo.
		if p.Kind == db.MessageChangeKindEdit && current != nil && p.Body != nil && *current == *p.Body {
			continue
		}
		if p.Kind == db.MessageChangeKindEdit {
			current = p.Body
		}
		if err := q.LinkMessageChange(ctx, db.LinkMessageChangeParams{ID: p.ID, MessageID: &msg.ID}); err != nil {
			return fmt.Errorf("link message change: %w", err)
		}
		if err := effect(ctx, q, msg.ID, p.Kind, p.Origin, p.Body, p.OccurredAt); err != nil {
			return err
		}
	}
	return nil
}

func deref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

// applySentPendingChanges applies to a message sent through the system, once
// it has its provider ID, the changes made from the phone of the sector that
// arrived before the send was recorded.
func (s *Service) applySentPendingChanges(ctx context.Context, sectorID int64, externalID string) error {
	return pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		q := s.q.WithTx(tx)
		if err := q.LockMessageExternalID(ctx, db.LockMessageExternalIDParams{SectorID: sectorID, ExternalMessageID: externalID}); err != nil {
			return fmt.Errorf("lock message: %w", err)
		}
		// Almost always nothing waits: the ticket is not locked for nothing.
		pending, err := q.ListPendingMessageChanges(ctx, db.ListPendingMessageChangesParams{SectorID: sectorID, TargetExternalMessageID: &externalID})
		if err != nil || len(pending) == 0 {
			return err
		}
		msg, err := q.GetMessageForChange(ctx, db.GetMessageForChangeParams{SectorID: sectorID, ExternalMessageID: &externalID})
		if err != nil {
			return fmt.Errorf("get sent message: %w", err)
		}
		if _, err := q.GetTicketForUpdate(ctx, msg.TicketID); err != nil {
			return fmt.Errorf("get ticket: %w", err)
		}
		return applyPendingChanges(ctx, q, sectorID, msg, externalID)
	})
}
