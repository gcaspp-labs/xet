package helpdesk

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/gcaspp-labs/xet/backend/internal/core/auth"
	"github.com/gcaspp-labs/xet/backend/internal/core/realtime"
	"github.com/gcaspp-labs/xet/backend/internal/db"
	"github.com/gcaspp-labs/xet/backend/internal/helpdesk/messaging"
)

var (
	// ErrInvalidEmoji is a reaction that is not a single emoji.
	ErrInvalidEmoji = errors.New("reaction is not a single emoji")
	// ErrNotReactable is a message without a WhatsApp ID to react to: one
	// still sending or that failed.
	ErrNotReactable = errors.New("message cannot get a reaction")
)

// ReactionNotSentError is a reaction the provider did not take. Nothing was
// recorded: the sector keeps the reaction it had.
type ReactionNotSentError struct {
	Reason string
}

func (e ReactionNotSentError) Error() string { return "reaction not sent: " + e.Reason }

// Why a reaction did not go, shown to the agent as a notice.
const (
	reactionNotConnected    = "Número do setor desconectado. A reação não foi enviada."
	reactionContactNotFound = "Este telefone não tem WhatsApp. A reação não foi enviada."
	reactionProvider        = "O WhatsApp não aceitou a reação. Tente novamente."
)

// React sets the reaction of the sector to a message of the ticket, as the
// assignee chose it in the panel. The sector has one reaction per message:
// another emoji replaces the current one, whoever set it, and the emoji the
// sector already shows removes it. The decision is taken with the ticket
// locked, the reaction goes to the provider outside any transaction, and only
// what the provider took is recorded, with the agent as its author. A refused
// reaction records nothing and is not tried again. It returns the emoji the
// sector shows now, nil after a removal.
func (s *Service) React(ctx context.Context, provider messaging.Provider, actor auth.User, messageID int64, emoji string) (*string, error) {
	if !isSingleEmoji(emoji) {
		return nil, ErrInvalidEmoji
	}
	ref, err := s.q.GetMessage(ctx, messageID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrMessageNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("get message: %w", err)
	}
	if _, err := s.accessible(ctx, actor, ref.TicketID); err != nil {
		return nil, err
	}

	// Decided with the ticket locked, on the message as it is now: its status
	// may have changed since it was read above.
	var target db.Message
	removing := false
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
		if !reactable(target) {
			return ErrNotReactable
		}
		current, err := sectorReaction(ctx, q, target.ID)
		if err != nil {
			return err
		}
		// The emoji the sector already shows removes it. Two equal requests
		// in a row therefore set and remove the reaction, as in WhatsApp.
		removing = current.Emoji != nil && *current.Emoji == emoji
		return nil
	})
	if err != nil {
		return nil, err
	}

	// An empty emoji is how the contract removes a reaction.
	send := emoji
	if removing {
		send = ""
	}
	// The request may be gone by now: what the provider took is recorded anyway.
	ctx, cancel := context.WithTimeout(context.WithoutCancel(ctx), sendTimeout)
	defer cancel()
	if err := s.sendReaction(ctx, provider, target, send); err != nil {
		slog.Warn("send reaction", "message_id", target.ID, "error", err)
		return nil, ReactionNotSentError{Reason: reactionFailure(err)}
	}

	changed := false
	err = pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		q := s.q.WithTx(tx)
		if _, err := q.GetTicketForUpdate(ctx, target.TicketID); err != nil {
			return fmt.Errorf("lock ticket: %w", err)
		}
		current, err := sectorReaction(ctx, q, target.ID)
		if err != nil {
			return err
		}
		// What the provider just took is the newest change of the side, even
		// if an event of the phone came stamped later by its clock.
		at := time.Now().Truncate(time.Microsecond)
		if !current.ReactedAt.Before(at) {
			at = current.ReactedAt.Add(time.Microsecond)
		}
		var n int64
		if removing {
			n, err = q.RemoveMessageReaction(ctx, db.RemoveMessageReactionParams{MessageID: target.ID, Side: db.ReactionSideSector, ReactedAt: at})
			// The row of a removal stays to keep its time: the panel changes
			// only when there was a reaction to remove.
			changed = n > 0 && current.Emoji != nil
		} else {
			n, err = q.UpsertMessageReaction(ctx, db.UpsertMessageReactionParams{
				MessageID: target.ID, Side: db.ReactionSideSector, Emoji: &send, AuthorID: &actor.ID, ReactedAt: at,
			})
			changed = n > 0
		}
		if err != nil {
			return fmt.Errorf("save reaction: %w", err)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	if changed {
		s.hub.Publish(realtime.TicketChanged(target.SectorID, target.TicketID))
	}
	if removing {
		return nil, nil
	}
	return &send, nil
}

// sectorReaction returns the current reaction of the sector to the message;
// the zero value when the sector never reacted.
func sectorReaction(ctx context.Context, q *db.Queries, messageID int64) (db.GetMessageReactionRow, error) {
	r, err := q.GetMessageReaction(ctx, db.GetMessageReactionParams{MessageID: messageID, Side: db.ReactionSideSector})
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return r, fmt.Errorf("get reaction: %w", err)
	}
	return r, nil
}

// reactable reports a message WhatsApp knows: received, or sent with its ID
// (sent, delivered or read). Internal notes and system notices are not
// messages, so they never get here.
func reactable(m db.Message) bool {
	if m.ExternalMessageID == nil || *m.ExternalMessageID == "" {
		return false
	}
	if m.Direction == db.MessageDirectionInbound {
		return true
	}
	if !m.Status.Valid {
		return false
	}
	switch m.Status.MessageStatus {
	case db.MessageStatusSent, db.MessageStatusDelivered, db.MessageStatusRead:
		return true
	default:
		return false
	}
}

func (s *Service) sendReaction(ctx context.Context, provider messaging.Provider, target db.Message, emoji string) error {
	to, err := s.recipient(ctx, provider, target.SectorID, target.ContactID)
	if err != nil {
		return err
	}
	return provider.SendReaction(ctx, messaging.Reaction{
		SectorID:                target.SectorID,
		To:                      to,
		TargetExternalMessageID: *target.ExternalMessageID,
		TargetFromSector:        target.Direction == db.MessageDirectionOutbound,
		Emoji:                   emoji,
	})
}

func reactionFailure(err error) string {
	switch {
	case errors.Is(err, messaging.ErrNotConnected):
		return reactionNotConnected
	case errors.Is(err, messaging.ErrContactNotFound):
		return reactionContactNotFound
	default:
		return reactionProvider
	}
}
