// Package sectors manages sectors and the modules each sector serves.
package sectors

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/go-playground/validator/v10"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/gcaspp-labs/xet/backend/internal/core/audit"
	"github.com/gcaspp-labs/xet/backend/internal/db"
)

// Provider of new sectors; the official API comes later (arquitetura.md).
const DefaultProvider = "whatsmeow"

var (
	ErrNotFound        = errors.New("sector not found")
	ErrInvalidName     = errors.New("invalid name")
	ErrNameTaken       = errors.New("sector name already in use")
	ErrInvalidEmail    = errors.New("invalid email")
	ErrEmailTaken      = errors.New("sector email already in use")
	ErrModuleNotFound  = errors.New("module not found")
	ErrModuleNameTaken = errors.New("module name already in use in the sector")
)

// The email is optional and trimmed before validation, so it is checked here
// and not by the request tags.
var validate = validator.New()

type Service struct {
	pool *pgxpool.Pool
	q    *db.Queries
}

func NewService(pool *pgxpool.Pool) *Service {
	return &Service{pool: pool, q: db.New(pool)}
}

// SectorInput holds the editable fields of a sector.
type SectorInput struct {
	Name  string
	Email string
}

func (in SectorInput) normalize() (SectorInput, error) {
	in.Name = strings.TrimSpace(in.Name)
	if in.Name == "" {
		return in, ErrInvalidName
	}
	in.Email = strings.TrimSpace(in.Email)
	if in.Email != "" && validate.Var(in.Email, "email") != nil {
		return in, ErrInvalidEmail
	}
	return in, nil
}

// email returns the value to store: an empty email is stored as null.
func (in SectorInput) email() *string {
	if in.Email == "" {
		return nil
	}
	return &in.Email
}

// List returns the sectors ordered by name.
func (s *Service) List(ctx context.Context) ([]db.Sector, error) {
	sectors, err := s.q.ListSectors(ctx)
	if err != nil {
		return nil, fmt.Errorf("list sectors: %w", err)
	}
	return sectors, nil
}

// Get returns one sector.
func (s *Service) Get(ctx context.Context, id int64) (db.Sector, error) {
	sector, err := s.q.GetSector(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return db.Sector{}, ErrNotFound
	}
	if err != nil {
		return db.Sector{}, fmt.Errorf("get sector: %w", err)
	}
	return sector, nil
}

// Create registers a sector and its audit log in one transaction.
func (s *Service) Create(ctx context.Context, actorID int64, in SectorInput) (db.Sector, error) {
	in, err := in.normalize()
	if err != nil {
		return db.Sector{}, err
	}

	var sector db.Sector
	err = pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		q := s.q.WithTx(tx)
		sector, err = q.CreateSector(ctx, db.CreateSectorParams{Name: in.Name, Email: in.email(), Provider: DefaultProvider})
		if err != nil {
			return sectorError("create sector", err)
		}
		changes := audit.Changes{}
		changes.Set("name", nil, sector.Name)
		changes.Set("email", nil, sector.Email)
		changes.Set("provider", nil, sector.Provider)
		return record(ctx, q, "sector", sector.ID, "sector_created", &actorID, changes)
	})
	if err != nil {
		return db.Sector{}, err
	}
	return sector, nil
}

// Update changes the name and the email of a sector, locking its row and
// recording what changed in the same transaction.
func (s *Service) Update(ctx context.Context, actorID, id int64, in SectorInput) (db.Sector, error) {
	in, err := in.normalize()
	if err != nil {
		return db.Sector{}, err
	}

	var sector db.Sector
	err = pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		q := s.q.WithTx(tx)
		before, err := q.GetSectorForUpdate(ctx, id)
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		if err != nil {
			return fmt.Errorf("get sector: %w", err)
		}
		changes := audit.Changes{}
		changes.Set("name", before.Name, in.Name)
		changes.Set("email", before.Email, in.email())
		if changes.Empty() {
			sector = before
			return nil
		}
		sector, err = q.UpdateSector(ctx, db.UpdateSectorParams{ID: id, Name: in.Name, Email: in.email()})
		if err != nil {
			return sectorError("update sector", err)
		}
		return record(ctx, q, "sector", id, "sector_updated", &actorID, changes)
	})
	if err != nil {
		return db.Sector{}, err
	}
	return sector, nil
}

// ModuleInput holds the editable fields of a module.
type ModuleInput struct {
	Name   string
	Active bool
}

// ListModules returns the modules of the sector, active ones first.
func (s *Service) ListModules(ctx context.Context, sectorID int64) ([]db.Module, error) {
	modules, err := s.q.ListModules(ctx, sectorID)
	if err != nil {
		return nil, fmt.Errorf("list modules: %w", err)
	}
	return modules, nil
}

// ListActiveModules returns the modules of the sector that can still be chosen.
func (s *Service) ListActiveModules(ctx context.Context, sectorID int64) ([]db.Module, error) {
	modules, err := s.q.ListActiveModules(ctx, sectorID)
	if err != nil {
		return nil, fmt.Errorf("list active modules: %w", err)
	}
	return modules, nil
}

// CreateModule adds an active module to the sector.
func (s *Service) CreateModule(ctx context.Context, actorID, sectorID int64, name string) (db.Module, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return db.Module{}, ErrInvalidName
	}

	var module db.Module
	err := pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		q := s.q.WithTx(tx)
		var err error
		module, err = q.CreateModule(ctx, db.CreateModuleParams{SectorID: sectorID, Name: name})
		if err != nil {
			return moduleError("create module", err)
		}
		changes := audit.Changes{}
		changes.Set("sector_id", nil, module.SectorID)
		changes.Set("name", nil, module.Name)
		return record(ctx, q, "module", module.ID, "module_created", &actorID, changes)
	})
	if err != nil {
		return db.Module{}, err
	}
	return module, nil
}

// UpdateModule renames, deactivates or reactivates a module of the sector.
// Modules are never deleted because closed tickets keep referencing them.
func (s *Service) UpdateModule(ctx context.Context, actorID, sectorID, id int64, in ModuleInput) (db.Module, error) {
	in.Name = strings.TrimSpace(in.Name)
	if in.Name == "" {
		return db.Module{}, ErrInvalidName
	}

	var module db.Module
	err := pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		q := s.q.WithTx(tx)
		before, err := q.GetModuleForUpdate(ctx, db.GetModuleForUpdateParams{ID: id, SectorID: sectorID})
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrModuleNotFound
		}
		if err != nil {
			return fmt.Errorf("get module: %w", err)
		}
		changes := audit.Changes{}
		changes.Set("name", before.Name, in.Name)
		changes.Set("active", before.Active, in.Active)
		if changes.Empty() {
			module = before
			return nil
		}
		module, err = q.UpdateModule(ctx, db.UpdateModuleParams{ID: id, Name: in.Name, Active: in.Active})
		if err != nil {
			return moduleError("update module", err)
		}
		return record(ctx, q, "module", id, "module_updated", &actorID, changes)
	})
	if err != nil {
		return db.Module{}, err
	}
	return module, nil
}

// record writes an audit log; a nil actor marks an action of the system.
func record(ctx context.Context, q *db.Queries, entityType string, entityID int64, action string, actorID *int64, changes audit.Changes) error {
	raw, err := changes.JSON()
	if err != nil {
		return err
	}
	if err := q.CreateAuditLog(ctx, db.CreateAuditLogParams{
		EntityType: entityType,
		EntityID:   entityID,
		Action:     action,
		ActorID:    actorID,
		Changes:    raw,
	}); err != nil {
		return fmt.Errorf("audit: %w", err)
	}
	return nil
}

// sectorError converts constraint violations into domain errors.
func sectorError(op string, err error) error {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		switch pgErr.ConstraintName {
		case "sectors_name_key":
			return ErrNameTaken
		case "sectors_email_key":
			return ErrEmailTaken
		}
	}
	return fmt.Errorf("%s: %w", op, err)
}

// moduleError converts constraint violations into domain errors.
func moduleError(op string, err error) error {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		switch pgErr.ConstraintName {
		case "modules_sector_id_name_key":
			return ErrModuleNameTaken
		case "modules_sector_id_fkey":
			return ErrNotFound
		}
	}
	return fmt.Errorf("%s: %w", op, err)
}
