// Package helpdesk is the service desk: the life cycle of the tickets (the
// queue of each sector, the assignee, transfers, closing and corrections), the
// conversation, the connection of the sector numbers and the address book import.
package helpdesk

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/gcaspp-labs/xet/backend/internal/core/audit"
	"github.com/gcaspp-labs/xet/backend/internal/core/realtime"
	"github.com/gcaspp-labs/xet/backend/internal/core/storage"
	"github.com/gcaspp-labs/xet/backend/internal/db"
	"github.com/gcaspp-labs/xet/backend/internal/helpdesk/messaging"
)

type Service struct {
	pool    *pgxpool.Pool
	q       *db.Queries
	storage storage.Storage
	hub     *realtime.Hub

	// provider unlinks the device of a refused number, out of the event that
	// reported it; background tracks that work.
	provider   messaging.Provider
	background sync.WaitGroup

	// changeTimeout bounds an edit or deletion handed to the provider.
	changeTimeout time.Duration
}

func NewService(pool *pgxpool.Pool, files storage.Storage, hub *realtime.Hub) *Service {
	return &Service{pool: pool, q: db.New(pool), storage: files, hub: hub, changeTimeout: sendTimeout}
}

func recordTicket(ctx context.Context, q *db.Queries, ticketID int64, action string, actorID int64, changes audit.Changes) error {
	return recordTicketReason(ctx, q, ticketID, action, actorID, nil, changes)
}

// recordTicketReason records the audit of the ticket with the free text the
// action keeps in audit_logs.reason, as the correction, the cancellation and the
// pending do — and now the merge of a cancelled ticket, which carries the reason
// of B to A.
func recordTicketReason(ctx context.Context, q *db.Queries, ticketID int64, action string, actorID int64, reason *string, changes audit.Changes) error {
	raw, err := changes.JSON()
	if err != nil {
		return err
	}
	if err := q.CreateAuditLog(ctx, db.CreateAuditLogParams{
		TicketID:   &ticketID,
		EntityType: "ticket",
		EntityID:   ticketID,
		Action:     action,
		ActorID:    &actorID,
		Reason:     reason,
		Changes:    raw,
	}); err != nil {
		return fmt.Errorf("audit: %w", err)
	}
	return nil
}

func isConstraint(err error, name string) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.ConstraintName == name
}

func optional(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
