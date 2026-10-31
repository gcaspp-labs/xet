package sector

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"

	"github.com/gcaspp-labs/xet/backend/internal/audit"
	"github.com/gcaspp-labs/xet/backend/internal/db"
	"github.com/gcaspp-labs/xet/backend/internal/messaging"
)

// Connect starts the session of the sector number. A sector without a linked
// account, or unlinked by the phone, starts a new pairing by QR code.
func (s *Service) Connect(ctx context.Context, p messaging.Provider, sectorID int64) error {
	sector, err := s.Get(ctx, sectorID)
	if err != nil {
		return err
	}
	if err := p.Connect(ctx, account(sector)); err != nil {
		return fmt.Errorf("connect sector %d: %w", sectorID, err)
	}
	return nil
}

// Reconnect starts the session of every active sector with a linked account,
// when the service starts. A failing sector does not stop the others.
func (s *Service) Reconnect(ctx context.Context, p messaging.Provider) error {
	sectors, err := s.q.ListSectorsToReconnect(ctx, defaultProvider)
	if err != nil {
		return fmt.Errorf("list sectors to reconnect: %w", err)
	}
	var errs []error
	for _, sector := range sectors {
		if err := p.Connect(ctx, account(sector)); err != nil {
			errs = append(errs, fmt.Errorf("reconnect sector %d: %w", sector.ID, err))
		}
	}
	return errors.Join(errs...)
}

func account(sector db.Sector) messaging.Account {
	a := messaging.Account{SectorID: sector.ID}
	if sector.ExternalAccountID != nil {
		a.AccountID = *sector.ExternalAccountID
	}
	return a
}

// HandleConnection records a connection change reported by the provider,
// locking the sector row. Entering connected and leaving it are audited as
// actions of the system; an unlinked account is forgotten, so the next
// connection asks for a new QR code.
func (s *Service) HandleConnection(ctx context.Context, ev messaging.ConnectionChanged) error {
	status := db.ConnectionStatus(ev.Status)
	return pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		q := s.q.WithTx(tx)
		before, err := q.GetSectorForUpdate(ctx, ev.SectorID)
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		if err != nil {
			return fmt.Errorf("get sector: %w", err)
		}

		accountID := before.ExternalAccountID
		switch status {
		case db.ConnectionStatusConnected:
			if ev.AccountID != "" {
				accountID = &ev.AccountID
			}
		case db.ConnectionStatusLoggedOut:
			accountID = nil
		}

		changes := audit.Changes{}
		changes.Set("connection_status", string(before.ConnectionStatus), string(status))
		changes.Set("external_account_id", before.ExternalAccountID, accountID)
		if changes.Empty() {
			return nil
		}
		if _, err := q.UpdateSectorConnection(ctx, db.UpdateSectorConnectionParams{
			ID:                ev.SectorID,
			ConnectionStatus:  status,
			ExternalAccountID: accountID,
		}); err != nil {
			return fmt.Errorf("update sector connection: %w", err)
		}

		switch {
		case status == db.ConnectionStatusConnected:
			return record(ctx, q, "sector", ev.SectorID, "sector_connected", nil, changes)
		case before.ConnectionStatus == db.ConnectionStatusConnected:
			return record(ctx, q, "sector", ev.SectorID, "sector_disconnected", nil, changes)
		}
		return nil
	})
}
