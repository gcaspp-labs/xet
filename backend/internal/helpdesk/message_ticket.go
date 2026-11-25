package helpdesk

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"

	"github.com/gcaspp-labs/xet/backend/internal/db"
)

// messageTicketAttempts is how many times an action on a message starts over
// when a merge moves the message to another ticket while the action waits for
// the lock of its ticket. A merge moves the messages once, and only a new
// merge of the resumed ticket moves them again.
const messageTicketAttempts = 3

// errMessageMoved tells that the message changed ticket after it was read: the
// action starts over, with the ticket it is in now.
var errMessageMoved = errors.New("message moved to another ticket")

// withMovedTicketRetry runs fn in a transaction, starting it over when a merge
// moves the message to another ticket while fn waits for the lock of its
// ticket. Every action on a message that may be in a different ticket after
// the merge goes through here: fn locks the message first, in the order of the
// changes received from the provider, and the ticket after, and must not act
// on the ticket it read before the merge.
func (s *Service) withMovedTicketRetry(ctx context.Context, fn func(q *db.Queries) error) error {
	var err error
	for attempt := 0; attempt < messageTicketAttempts; attempt++ {
		err = pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
			return fn(s.q.WithTx(tx))
		})
		if !errors.Is(err, errMessageMoved) {
			return err
		}
	}
	return err
}

// withMessageTicket runs fn with the ticket the message is in locked. The
// merge runs with both tickets locked, so the action must not act on the
// ticket it read before the merge.
func (s *Service) withMessageTicket(ctx context.Context, messageID int64, fn func(q *db.Queries, ticket db.Ticket) error) error {
	return s.withMovedTicketRetry(ctx, func(q *db.Queries) error {
		ticket, err := lockTicketOfMessage(ctx, q, messageID)
		if err != nil {
			return err
		}
		return fn(q, ticket)
	})
}

// lockTicketOfMessage locks the ticket the message is in and confirms the
// message is still there. The merge locks the two tickets and then moves the
// messages, so it may move this one while the lock waits; the caller then
// starts over with the current ticket. The message is never locked before the
// ticket: the merge would wait for it and cross the locks.
func lockTicketOfMessage(ctx context.Context, q *db.Queries, messageID int64) (db.Ticket, error) {
	ticketID, err := q.GetMessageTicketID(ctx, messageID)
	if errors.Is(err, pgx.ErrNoRows) {
		return db.Ticket{}, ErrMessageNotFound
	}
	if err != nil {
		return db.Ticket{}, fmt.Errorf("get message ticket: %w", err)
	}
	ticket, err := db.AsTicket(q.GetTicketForUpdate(ctx, ticketID))
	if errors.Is(err, pgx.ErrNoRows) {
		return db.Ticket{}, ErrNotFound
	}
	if err != nil {
		return db.Ticket{}, fmt.Errorf("lock ticket: %w", err)
	}
	current, err := q.GetMessageTicketID(ctx, messageID)
	if err != nil {
		return db.Ticket{}, fmt.Errorf("get message ticket: %w", err)
	}
	if current != ticketID {
		return db.Ticket{}, errMessageMoved
	}
	return ticket, nil
}
