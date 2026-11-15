package helpdesk

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/gcaspp-labs/xet/backend/internal/core/realtime"
	"github.com/gcaspp-labs/xet/backend/internal/db"
	"github.com/gcaspp-labs/xet/backend/internal/helpdesk/messaging"
)

// HandleReaction records the reaction of the contact, or the one made from the
// phone of the sector, as the current reaction of its side of the message. A
// reaction is not a message: one to a message of a closed ticket, or that the
// system does not have, is discarded without opening a ticket or recording
// anything. A removal keeps the time of the event, so an older event than the
// last change of the side, reaction or removal, changes nothing even when it
// is delivered again, and the same event delivered again neither. The panels of the sector are notified
// after the commit, only when something changed; the last message of the
// ticket is not touched.
func (s *Service) HandleReaction(ctx context.Context, ev messaging.ReactionReceived) error {
	if ev.Group {
		return nil
	}
	if ev.TargetExternalMessageID == "" {
		return errors.New("reaction without target message id")
	}
	target, err := s.q.GetMessageRefByExternalID(ctx, db.GetMessageRefByExternalIDParams{
		SectorID: ev.SectorID, ExternalMessageID: &ev.TargetExternalMessageID,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return nil
	}
	if err != nil {
		return fmt.Errorf("get reaction target: %w", err)
	}

	at := ev.At
	if at.IsZero() {
		at = time.Now()
	}
	// A reaction made from the phone of the sector takes the place of the
	// sector's, whoever set it before.
	side, viaPhone := db.ReactionSideCustomer, false
	if ev.FromSectorPhone {
		side, viaPhone = db.ReactionSideSector, true
	}
	emoji := strings.TrimSpace(ev.Emoji)

	changed := false
	err = pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		q := s.q.WithTx(tx)
		ticket, err := q.GetTicketForUpdate(ctx, target.TicketID)
		if err != nil {
			return fmt.Errorf("get ticket: %w", err)
		}
		if ticket.Status == db.TicketStatusClosed {
			return nil
		}
		// Only what the side shows counts as a change: a removal with nothing
		// to remove is recorded for the order of events, but notifies no one.
		shown := false
		if cur, err := q.GetMessageReactionEmoji(ctx, db.GetMessageReactionEmojiParams{MessageID: target.ID, Side: side}); err == nil {
			shown = cur != nil
		} else if !errors.Is(err, pgx.ErrNoRows) {
			return fmt.Errorf("get reaction: %w", err)
		}
		var n int64
		if emoji == "" {
			n, err = q.RemoveMessageReaction(ctx, db.RemoveMessageReactionParams{MessageID: target.ID, Side: side, ReactedAt: at})
			changed = n > 0 && shown
		} else {
			n, err = q.UpsertMessageReaction(ctx, db.UpsertMessageReactionParams{
				MessageID: target.ID, Side: side, Emoji: &emoji, ViaPhone: viaPhone, ReactedAt: at,
			})
			changed = n > 0
		}
		if err != nil {
			return fmt.Errorf("save reaction: %w", err)
		}
		return nil
	})
	if err != nil {
		return err
	}
	if changed {
		s.hub.Publish(realtime.TicketChanged(ev.SectorID, target.TicketID))
	}
	return nil
}
