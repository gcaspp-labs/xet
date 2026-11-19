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
// The same provider event delivered again, or echoed back, changes nothing:
// it is the same event ID or, without one, the same kind, origin, time and
// content. Two different edits are two versions even when one goes back to
// an earlier text. The current version is always the newest edit, so a late
// one is kept but does not undo a newer one. A change that arrives before its
// message waits, unlinked, and is applied when the message is recorded; any
// change for a known message that still waits (left by a failure) is linked
// first, so the redelivery of that very change repairs it. A change whose
// author cannot have made it (the contact on a message of the sector, the
// phone on one of the contact, or another contact) is discarded. The panels
// of the sector are notified after the commit, only when something was
// recorded on a known message.
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
		seen := false
		if c.eventID != "" {
			var err error
			seen, err = q.MessageChangeEventExists(ctx, db.MessageChangeEventExistsParams{SectorID: c.sectorID, ExternalEventID: &c.eventID})
			if err != nil {
				return fmt.Errorf("check message change: %w", err)
			}
		}

		msg, err := q.GetMessageForChange(ctx, db.GetMessageForChangeParams{SectorID: c.sectorID, ExternalMessageID: &c.target})
		if errors.Is(err, pgx.ErrNoRows) {
			if seen {
				return nil
			}
			return savePendingChange(ctx, q, c)
		}
		if err != nil {
			return fmt.Errorf("get changed message: %w", err)
		}
		// Every change of a ticket takes its lock, as the other actions do.
		if _, err := q.GetTicketForUpdate(ctx, msg.TicketID); err != nil {
			return fmt.Errorf("get ticket: %w", err)
		}
		ticketID = msg.TicketID
		if changed, err = linkPendingChanges(ctx, q, c.sectorID, &msg, c.target); err != nil {
			return err
		}
		if seen || !changeAllowed(msg.Origin, c.origin(), msg.ContactExternalID, msg.ContactPhone, c.contactID, c.phone) {
			return nil
		}
		recorded, err := recordKnownChange(ctx, q, &msg, c)
		changed = changed || recorded
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

// recordKnownChange records the change of a known message, with its ticket
// locked, and reports whether anything was recorded.
func recordKnownChange(ctx context.Context, q *db.Queries, msg *db.GetMessageForChangeRow, c externalChange) (bool, error) {
	if !changeApplies(msg, c.kind) {
		return false, nil
	}
	dup, err := changeRecorded(ctx, q, c, &msg.ID)
	if err != nil || dup {
		return false, err
	}
	created, err := createChange(ctx, q, c, &msg.ID)
	if err != nil || !created {
		return false, err
	}
	return true, applyMessageChange(ctx, q, msg, c.kind, c.origin(), c.at)
}

// changeApplies tells whether a new change, received now or waiting for the
// message, still applies to it. Every edit is a version, even one with a text
// the message had before; a message is deleted only once.
func changeApplies(msg *db.GetMessageForChangeRow, kind db.MessageChangeKind) bool {
	return kind != db.MessageChangeKindDeletion || msg.DeletedAt == nil
}

// applyMessageChange applies a change just recorded to the message: after
// an edit, the original is kept and the newest edit becomes the content; a
// deletion marks the message, keeping its content.
func applyMessageChange(ctx context.Context, q *db.Queries, msg *db.GetMessageForChangeRow, kind db.MessageChangeKind, origin db.MessageOrigin, at time.Time) error {
	switch kind {
	case db.MessageChangeKindEdit:
		if err := q.CreateOriginalVersion(ctx, msg.ID); err != nil {
			return fmt.Errorf("keep original version: %w", err)
		}
		if err := q.RefreshMessageCurrentVersion(ctx, msg.ID); err != nil {
			return fmt.Errorf("set message version: %w", err)
		}
	case db.MessageChangeKindDeletion:
		_, err := q.MarkMessageDeleted(ctx, db.MarkMessageDeletedParams{
			ID: msg.ID, DeletedAt: &at,
			DeletionScope:  db.NullMessageDeletionScope{MessageDeletionScope: db.MessageDeletionScopeEveryone, Valid: true},
			DeletionOrigin: db.NullMessageOrigin{MessageOrigin: origin, Valid: true},
		})
		if err != nil {
			return fmt.Errorf("mark message deleted: %w", err)
		}
		msg.DeletedAt = &at
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

// linkPendingChanges links to a message the changes that arrived before it
// was recorded, in the order they happened, applies them and reports whether
// any was linked. The caller holds the lock of the provider ID
// (LockMessageExternalID) and of the ticket. A pending change whose author
// could not have made it, or that no longer applies, stays unlinked, as if
// discarded.
func linkPendingChanges(ctx context.Context, q *db.Queries, sectorID int64, msg *db.GetMessageForChangeRow, externalID string) (bool, error) {
	pending, err := q.ListPendingMessageChanges(ctx, db.ListPendingMessageChangesParams{SectorID: sectorID, TargetExternalMessageID: &externalID})
	if err != nil {
		return false, fmt.Errorf("list pending message changes: %w", err)
	}
	linked := false
	for _, p := range pending {
		if !changeAllowed(msg.Origin, p.Origin, msg.ContactExternalID, msg.ContactPhone, deref(p.ExternalContactID), deref(p.Phone)) {
			continue
		}
		if !changeApplies(msg, p.Kind) {
			continue
		}
		if err := q.LinkMessageChange(ctx, db.LinkMessageChangeParams{ID: p.ID, MessageID: &msg.ID}); err != nil {
			return false, fmt.Errorf("link message change: %w", err)
		}
		if err := applyMessageChange(ctx, q, msg, p.Kind, p.Origin, p.OccurredAt); err != nil {
			return false, err
		}
		linked = true
	}
	return linked, nil
}

func deref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

// markSent records a message sent through the system as sent, with its
// provider ID, and links to it, in the same transaction, the changes made from
// the phone of the sector that arrived before: a failure records neither, and
// the message stays pending, to fail on restart and be sent again with the
// same key. It returns the message as recorded.
func (s *Service) markSent(ctx context.Context, msg db.Message, externalID string) (db.Message, error) {
	var updated db.Message
	err := pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		q := s.q.WithTx(tx)
		if err := q.LockMessageExternalID(ctx, db.LockMessageExternalIDParams{SectorID: msg.SectorID, ExternalMessageID: externalID}); err != nil {
			return fmt.Errorf("lock message: %w", err)
		}
		// Almost always nothing waits: the ticket is not locked for nothing.
		pending, err := q.ListPendingMessageChanges(ctx, db.ListPendingMessageChangesParams{SectorID: msg.SectorID, TargetExternalMessageID: &externalID})
		if err != nil {
			return fmt.Errorf("list pending message changes: %w", err)
		}
		if len(pending) > 0 {
			if _, err := q.GetTicketForUpdate(ctx, msg.TicketID); err != nil {
				return fmt.Errorf("get ticket: %w", err)
			}
		}
		updated, err = q.MarkMessageSent(ctx, db.MarkMessageSentParams{ID: msg.ID, ExternalMessageID: &externalID})
		if err != nil || len(pending) == 0 {
			return err
		}
		target, err := q.GetMessageForChange(ctx, db.GetMessageForChangeParams{SectorID: msg.SectorID, ExternalMessageID: &externalID})
		if err != nil {
			return fmt.Errorf("get sent message: %w", err)
		}
		linked, err := linkPendingChanges(ctx, q, msg.SectorID, &target, externalID)
		if err != nil || !linked {
			return err
		}
		updated, err = q.GetMessage(ctx, msg.ID)
		return err
	})
	return updated, err
}
