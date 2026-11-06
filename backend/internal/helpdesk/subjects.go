package helpdesk

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"

	"github.com/gcaspp-labs/xet/backend/internal/core/audit"
	"github.com/gcaspp-labs/xet/backend/internal/db"
)

// maxSubjectLength is the longest subject the list of a sector takes.
const maxSubjectLength = 500

// Subjects returns the subject list of the sector.
func (s *Service) Subjects(ctx context.Context, sectorID int64) ([]db.Subject, error) {
	subjects, err := s.q.ListSubjects(ctx, sectorID)
	if err != nil {
		return nil, fmt.Errorf("list subjects: %w", err)
	}
	return subjects, nil
}

// CreateSubject adds a subject to the list of the sector.
func (s *Service) CreateSubject(ctx context.Context, actorID, sectorID int64, name string) (db.Subject, error) {
	name, err := normalizeSubject(name)
	if err != nil {
		return db.Subject{}, err
	}

	var subject db.Subject
	err = pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		q := s.q.WithTx(tx)
		var err error
		subject, err = q.CreateSubject(ctx, db.CreateSubjectParams{SectorID: sectorID, Name: name})
		if err != nil {
			return subjectError("create subject", err)
		}
		return recordSubjectCreated(ctx, q, actorID, subject)
	})
	if err != nil {
		return db.Subject{}, err
	}
	return subject, nil
}

// UpdateSubject renames a subject of the sector. Tickets keep their own text,
// so they do not change.
func (s *Service) UpdateSubject(ctx context.Context, actorID, sectorID, id int64, name string) (db.Subject, error) {
	name, err := normalizeSubject(name)
	if err != nil {
		return db.Subject{}, err
	}

	var subject db.Subject
	err = pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		q := s.q.WithTx(tx)
		before, err := lockSubject(ctx, q, sectorID, id)
		if err != nil {
			return err
		}
		if before.Name == name {
			subject = before
			return nil
		}
		subject, err = q.UpdateSubject(ctx, db.UpdateSubjectParams{ID: id, Name: name})
		if err != nil {
			return subjectError("update subject", err)
		}
		return recordSubject(ctx, q, id, "subject_updated", actorID, audit.Changes{
			"sector_id": {From: sectorID, To: sectorID},
			"name":      {From: before.Name, To: subject.Name},
		})
	})
	if err != nil {
		return db.Subject{}, err
	}
	return subject, nil
}

// DeleteSubject removes a subject of the sector for good. Tickets keep their
// own text, so they do not change.
func (s *Service) DeleteSubject(ctx context.Context, actorID, sectorID, id int64) error {
	return pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		q := s.q.WithTx(tx)
		before, err := lockSubject(ctx, q, sectorID, id)
		if err != nil {
			return err
		}
		if err := q.DeleteSubject(ctx, id); err != nil {
			return fmt.Errorf("delete subject: %w", err)
		}
		return recordSubject(ctx, q, id, "subject_deleted", actorID, audit.Changes{
			"sector_id": {From: sectorID, To: nil},
			"name":      {From: before.Name, To: nil},
		})
	})
}

// addFormSubject adds the subject of a saved closing form to the list of the
// sector, inside the transaction that holds the ticket. A subject already on
// the list stays as it is, and a text over the limit does not enter, without
// stopping the form from being saved (spec.md, Assuntos e soluções).
func addFormSubject(ctx context.Context, q *db.Queries, actorID, sectorID int64, name string) error {
	name = strings.TrimSpace(name)
	if name == "" || utf8.RuneCountInString(name) > maxSubjectLength {
		return nil
	}
	added, err := q.AddSubjectIfMissing(ctx, db.AddSubjectIfMissingParams{SectorID: sectorID, Name: name})
	if err != nil {
		return fmt.Errorf("add subject: %w", err)
	}
	for _, subject := range added {
		if err := recordSubjectCreated(ctx, q, actorID, subject); err != nil {
			return err
		}
	}
	return nil
}

func normalizeSubject(name string) (string, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return "", ErrInvalidSubject
	}
	if utf8.RuneCountInString(name) > maxSubjectLength {
		return "", ErrSubjectTooLong
	}
	return name, nil
}

func lockSubject(ctx context.Context, q *db.Queries, sectorID, id int64) (db.Subject, error) {
	subject, err := q.GetSubjectForUpdate(ctx, db.GetSubjectForUpdateParams{ID: id, SectorID: sectorID})
	if errors.Is(err, pgx.ErrNoRows) {
		return db.Subject{}, ErrSubjectNotFound
	}
	if err != nil {
		return db.Subject{}, fmt.Errorf("get subject: %w", err)
	}
	return subject, nil
}

func recordSubjectCreated(ctx context.Context, q *db.Queries, actorID int64, subject db.Subject) error {
	return recordSubject(ctx, q, subject.ID, "subject_created", actorID, audit.Changes{
		"sector_id": {From: nil, To: subject.SectorID},
		"name":      {From: nil, To: subject.Name},
	})
}

func recordSubject(ctx context.Context, q *db.Queries, subjectID int64, action string, actorID int64, changes audit.Changes) error {
	raw, err := changes.JSON()
	if err != nil {
		return err
	}
	if err := q.CreateAuditLog(ctx, db.CreateAuditLogParams{
		EntityType: "subject",
		EntityID:   subjectID,
		Action:     action,
		ActorID:    &actorID,
		Changes:    raw,
	}); err != nil {
		return fmt.Errorf("audit: %w", err)
	}
	return nil
}

// subjectError converts constraint violations into domain errors.
func subjectError(op string, err error) error {
	switch {
	case isConstraint(err, "subjects_sector_id_name_key"):
		return ErrSubjectNameTaken
	case isConstraint(err, "subjects_sector_id_fkey"):
		return ErrSectorNotFound
	}
	return fmt.Errorf("%s: %w", op, err)
}
