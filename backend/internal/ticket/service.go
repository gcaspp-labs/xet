// Package ticket manages the life cycle of the tickets: the queue of each
// sector, the assignee, transfers, closing and corrections.
package ticket

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/gcaspp-labs/xet/backend/internal/core/audit"
	"github.com/gcaspp-labs/xet/backend/internal/core/realtime"
	"github.com/gcaspp-labs/xet/backend/internal/core/storage"
	"github.com/gcaspp-labs/xet/backend/internal/db"
)

type Service struct {
	pool    *pgxpool.Pool
	q       *db.Queries
	storage storage.Storage
	hub     *realtime.Hub
}

func NewService(pool *pgxpool.Pool, files storage.Storage, hub *realtime.Hub) *Service {
	return &Service{pool: pool, q: db.New(pool), storage: files, hub: hub}
}

func recordTicket(ctx context.Context, q *db.Queries, ticketID int64, action string, actorID int64, changes audit.Changes) error {
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
