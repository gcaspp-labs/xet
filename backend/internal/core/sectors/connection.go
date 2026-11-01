package sectors

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/gcaspp-labs/xet/backend/internal/core/audit"
	"github.com/gcaspp-labs/xet/backend/internal/core/realtime"
	"github.com/gcaspp-labs/xet/backend/internal/db"
	"github.com/gcaspp-labs/xet/backend/internal/helpdesk/messaging"
)

// phoneTakenReason is shown on the connection screen. It does not name the
// other sector, which supervisors of this one cannot see.
const phoneTakenReason = "Este número já está ligado a outro setor. Conecte outro número pelo QR code."

// How long the provider has to unlink a device.
const disconnectTimeout = 30 * time.Second

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

// connectionState is what a connection change writes on the sector.
type connectionState struct {
	status    db.ConnectionStatus
	accountID *string
	phone     *string
	err       *string
}

// updateConnection writes the state and returns what the audit log records.
// It runs in a savepoint, so a number taken by another sector leaves the
// transaction usable to record the refusal.
func (s *Service) updateConnection(ctx context.Context, tx pgx.Tx, before db.Sector, after connectionState) (audit.Changes, error) {
	changes := audit.Changes{}
	changes.Set("connection_status", string(before.ConnectionStatus), string(after.status))
	changes.Set("external_account_id", before.ExternalAccountID, after.accountID)
	changes.Set("phone", before.Phone, after.phone)
	changes.Set("connection_error", before.ConnectionError, after.err)
	if changes.Empty() {
		return changes, nil
	}
	err := pgx.BeginFunc(ctx, tx, func(savepoint pgx.Tx) error {
		_, err := s.q.WithTx(savepoint).UpdateSectorConnection(ctx, db.UpdateSectorConnectionParams{
			ID:                before.ID,
			ConnectionStatus:  after.status,
			ExternalAccountID: after.accountID,
			Phone:             after.phone,
			ConnectionError:   after.err,
		})
		return err
	})
	if err != nil {
		return nil, sectorError("update sector connection", err)
	}
	return changes, nil
}

// HandleConnection records a connection change reported by the provider,
// locking the sector row. Entering connected and leaving it are audited as
// actions of the system; an unlinked account is forgotten with its phone, so
// the next connection asks for a new QR code, and a temporary drop keeps both.
// A number linked to another sector is refused: the reason stays on the sector
// and the device is unlinked after the commit, out of this event. The panels
// are notified after the commit, even when nothing changed, since a new
// pairing has a new QR code.
func (s *Service) HandleConnection(ctx context.Context, ev messaging.ConnectionChanged) error {
	status := db.ConnectionStatus(ev.Status)
	refused := false
	err := pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		q := s.q.WithTx(tx)
		before, err := q.GetSectorForUpdate(ctx, ev.SectorID)
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		if err != nil {
			return fmt.Errorf("get sector: %w", err)
		}

		after := connectionState{status: status, accountID: before.ExternalAccountID, phone: before.Phone, err: before.ConnectionError}
		switch status {
		case db.ConnectionStatusConnected:
			if ev.AccountID != "" {
				after.accountID = &ev.AccountID
			}
			if ev.Phone != "" {
				after.phone = &ev.Phone
			}
			after.err = nil
		case db.ConnectionStatusConnecting:
			after.err = nil
		case db.ConnectionStatusLoggedOut:
			after.accountID, after.phone = nil, nil
		}

		changes, err := s.updateConnection(ctx, tx, before, after)
		if errors.Is(err, ErrPhoneTaken) {
			refused = true
			reason := phoneTakenReason
			after = connectionState{status: db.ConnectionStatusLoggedOut, err: &reason}
			changes, err = s.updateConnection(ctx, tx, before, after)
		}
		if err != nil {
			return err
		}
		if changes.Empty() {
			return nil
		}

		switch {
		case after.status == db.ConnectionStatusConnected:
			return record(ctx, q, "sector", ev.SectorID, "sector_connected", nil, changes)
		case before.ConnectionStatus == db.ConnectionStatusConnected:
			return record(ctx, q, "sector", ev.SectorID, "sector_disconnected", nil, changes)
		}
		return nil
	})
	if err != nil {
		return err
	}
	s.hub.Publish(realtime.ConnectionChanged(ev.SectorID))
	if refused {
		s.unlinkRefused(ev.SectorID)
	}
	return nil
}

// unlinkRefused removes the device of a refused number in the background: the
// provider reports the change through an event while this one is in progress.
func (s *Service) unlinkRefused(sectorID int64) {
	s.background.Go(func() {
		ctx, cancel := context.WithTimeout(context.Background(), disconnectTimeout)
		defer cancel()
		if err := s.provider.Disconnect(ctx, sectorID); err != nil {
			slog.Error("unlink refused number", "sector_id", sectorID, "error", err)
		}
	})
}

// Disconnect unlinks the sector number at the request of a user. The state and
// the audit log with the author are committed first; the provider is called
// after the commit, and the event it emits finds nothing to change. Repeating
// changes nothing. ErrDeviceNotNotified means the state was saved but the
// device could not be told, so it must also be removed by the phone.
func (s *Service) Disconnect(ctx context.Context, p messaging.Provider, actorID, sectorID int64) error {
	linked, pairing := false, false
	err := pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		q := s.q.WithTx(tx)
		before, err := q.GetSectorForUpdate(ctx, sectorID)
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		if err != nil {
			return fmt.Errorf("get sector: %w", err)
		}
		linked = before.ExternalAccountID != nil || before.ConnectionStatus == db.ConnectionStatusConnected
		pairing = before.ConnectionStatus == db.ConnectionStatusConnecting
		if !linked && !pairing {
			return nil
		}
		changes, err := s.updateConnection(ctx, tx, before, connectionState{status: db.ConnectionStatusLoggedOut})
		if err != nil {
			return err
		}
		if !linked {
			return nil
		}
		return record(ctx, q, "sector", sectorID, "sector_disconnected", &actorID, changes)
	})
	if err != nil {
		return err
	}
	if !linked && !pairing {
		return nil
	}
	s.hub.Publish(realtime.ConnectionChanged(sectorID))

	// The state is already saved: the device is told even if the request ends.
	ctx, cancel := context.WithTimeout(context.WithoutCancel(ctx), disconnectTimeout)
	defer cancel()
	if err := p.Disconnect(ctx, sectorID); err != nil && linked {
		return fmt.Errorf("%w: %w", ErrDeviceNotNotified, err)
	}
	return nil
}
