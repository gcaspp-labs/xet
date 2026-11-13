package helpdesk

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"strings"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"

	"github.com/gcaspp-labs/xet/backend/internal/core/audit"
	"github.com/gcaspp-labs/xet/backend/internal/db"
)

// maxSubjectLength is the longest subject the list of a sector takes, and
// maxSolutionLength the longest solution the list of a subject takes.
const (
	maxSubjectLength  = 500
	maxSolutionLength = 10000
)

// Subject is a subject of the list of the sector with its solutions.
type Subject struct {
	db.Subject
	ModuleName string
	Solutions  []db.SubjectSolution
}

// Subjects returns the subject list of the sector, each with its solutions.
func (s *Service) Subjects(ctx context.Context, sectorID int64) ([]Subject, error) {
	subjects, err := s.q.ListSubjects(ctx, sectorID)
	if err != nil {
		return nil, fmt.Errorf("list subjects: %w", err)
	}
	solutions, err := s.q.ListSectorSolutions(ctx, sectorID)
	if err != nil {
		return nil, fmt.Errorf("list solutions: %w", err)
	}
	modules, err := s.q.ListModules(ctx, sectorID)
	if err != nil {
		return nil, fmt.Errorf("list modules: %w", err)
	}
	moduleNames := make(map[int64]string, len(modules))
	for _, module := range modules {
		moduleNames[module.ID] = module.Name
	}
	bySubject := map[int64][]db.SubjectSolution{}
	for _, sol := range solutions {
		bySubject[sol.SubjectID] = append(bySubject[sol.SubjectID], sol)
	}
	out := make([]Subject, len(subjects))
	for i, sub := range subjects {
		out[i] = Subject{Subject: sub, Solutions: bySubject[sub.ID]}
		if sub.ModuleID != nil {
			out[i].ModuleName = moduleNames[*sub.ModuleID]
		}
	}
	return out, nil
}

// Solutions returns the solution list of a subject.
func (s *Service) Solutions(ctx context.Context, subjectID int64) ([]db.SubjectSolution, error) {
	solutions, err := s.q.ListSubjectSolutions(ctx, subjectID)
	if err != nil {
		return nil, fmt.Errorf("list solutions: %w", err)
	}
	return solutions, nil
}

// CreateSubject adds a subject to the list of the sector.
func (s *Service) CreateSubject(ctx context.Context, actorID, sectorID, moduleID int64, name string) (db.Subject, error) {
	name, err := normalizeSubject(name)
	if err != nil {
		return db.Subject{}, err
	}

	var subject db.Subject
	err = pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		q := s.q.WithTx(tx)
		modules, err := q.GetModulesForShare(ctx, []int64{moduleID})
		if err != nil {
			return fmt.Errorf("get module: %w", err)
		}
		if len(modules) != 1 || modules[0].SectorID != sectorID || !modules[0].Active {
			if _, err := q.GetSector(ctx, sectorID); errors.Is(err, pgx.ErrNoRows) {
				return ErrSectorNotFound
			} else if err != nil {
				return fmt.Errorf("get sector: %w", err)
			}
			return ErrInvalidModules
		}
		subject, err = q.CreateSubject(ctx, db.CreateSubjectParams{SectorID: sectorID, ModuleID: &moduleID, Name: name})
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
func (s *Service) UpdateSubject(ctx context.Context, actorID, sectorID, id, moduleID int64, name string) (db.Subject, error) {
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
		if before.ModuleID == nil || *before.ModuleID != moduleID {
			modules, err := q.GetModulesForShare(ctx, []int64{moduleID})
			if err != nil {
				return fmt.Errorf("get module: %w", err)
			}
			if len(modules) != 1 || modules[0].SectorID != sectorID || !modules[0].Active {
				return ErrInvalidModules
			}
		}
		if before.Name == name && before.ModuleID != nil && *before.ModuleID == moduleID {
			subject = before
			return nil
		}
		subject, err = q.UpdateSubject(ctx, db.UpdateSubjectParams{ID: id, ModuleID: &moduleID, Name: name})
		if err != nil {
			return subjectError("update subject", err)
		}
		return recordSubject(ctx, q, id, "subject_updated", actorID, audit.Changes{
			"sector_id": {From: sectorID, To: sectorID},
			"name":      {From: before.Name, To: subject.Name},
			"module_id": {From: before.ModuleID, To: subject.ModuleID},
		})
	})
	if err != nil {
		return db.Subject{}, err
	}
	return subject, nil
}

// DeleteSubject removes a subject of the sector for good, with its solutions.
// The audit keeps the text of the solutions, which get no log of their own.
// Tickets keep their own text, so they do not change.
func (s *Service) DeleteSubject(ctx context.Context, actorID, sectorID, id int64) error {
	return pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		q := s.q.WithTx(tx)
		before, err := lockSubject(ctx, q, sectorID, id)
		if err != nil {
			return err
		}
		// The subject is locked for update, so no solution enters meanwhile.
		solutions, err := q.ListSolutionBodies(ctx, id)
		if err != nil {
			return fmt.Errorf("list solutions: %w", err)
		}
		if err := q.DeleteSubject(ctx, id); err != nil {
			return fmt.Errorf("delete subject: %w", err)
		}
		return recordSubject(ctx, q, id, "subject_deleted", actorID, audit.Changes{
			"sector_id": {From: sectorID, To: nil},
			"name":      {From: before.Name, To: nil},
			"solutions": {From: append([]string{}, solutions...), To: nil},
		})
	})
}

// CreateSolution adds a solution to the list of a subject of the sector.
func (s *Service) CreateSolution(ctx context.Context, actorID, sectorID, subjectID int64, body string) (db.SubjectSolution, error) {
	body, err := normalizeSolution(body)
	if err != nil {
		return db.SubjectSolution{}, err
	}

	var solution db.SubjectSolution
	err = pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		q := s.q.WithTx(tx)
		if _, err := shareSubject(ctx, q, sectorID, subjectID); err != nil {
			return err
		}
		var err error
		solution, err = q.CreateSolution(ctx, db.CreateSolutionParams{SubjectID: subjectID, Body: body})
		if err != nil {
			return solutionError("create solution", err)
		}
		return recordSolutionCreated(ctx, q, actorID, solution)
	})
	if err != nil {
		return db.SubjectSolution{}, err
	}
	return solution, nil
}

// UpdateSolution changes the text of a solution of a subject of the sector.
// Tickets keep their own text, so they do not change.
func (s *Service) UpdateSolution(ctx context.Context, actorID, sectorID, subjectID, id int64, body string) (db.SubjectSolution, error) {
	body, err := normalizeSolution(body)
	if err != nil {
		return db.SubjectSolution{}, err
	}

	var solution db.SubjectSolution
	err = pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		q := s.q.WithTx(tx)
		before, err := lockSolution(ctx, q, sectorID, subjectID, id)
		if err != nil {
			return err
		}
		if before.Body == body {
			solution = before
			return nil
		}
		solution, err = q.UpdateSolution(ctx, db.UpdateSolutionParams{ID: id, Body: body})
		if err != nil {
			return solutionError("update solution", err)
		}
		return recordSolution(ctx, q, id, "solution_updated", actorID, audit.Changes{
			"subject_id": {From: subjectID, To: subjectID},
			"body":       {From: before.Body, To: solution.Body},
		})
	})
	if err != nil {
		return db.SubjectSolution{}, err
	}
	return solution, nil
}

// DeleteSolution removes a solution of a subject of the sector for good.
// Tickets keep their own text, so they do not change.
func (s *Service) DeleteSolution(ctx context.Context, actorID, sectorID, subjectID, id int64) error {
	return pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		q := s.q.WithTx(tx)
		before, err := lockSolution(ctx, q, sectorID, subjectID, id)
		if err != nil {
			return err
		}
		if err := q.DeleteSolution(ctx, id); err != nil {
			return fmt.Errorf("delete solution: %w", err)
		}
		return recordSolution(ctx, q, id, "solution_deleted", actorID, audit.Changes{
			"subject_id": {From: subjectID, To: nil},
			"body":       {From: before.Body, To: nil},
		})
	})
}

// addFormSubject adds the subject of a saved closing form to the list of the
// sector, inside the transaction that holds the ticket. A subject already on
// the list stays as it is, and a text over the limit does not enter, without
// stopping the form from being saved (spec.md, Assuntos e soluções).
func addFormSubject(ctx context.Context, q *db.Queries, actorID, sectorID, moduleID int64, name string) error {
	name = strings.TrimSpace(name)
	if name == "" || utf8.RuneCountInString(name) > maxSubjectLength {
		return nil
	}
	added, err := q.AddSubjectIfMissing(ctx, db.AddSubjectIfMissingParams{SectorID: sectorID, ModuleID: &moduleID, Name: name})
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

// addFormSolution adds the resolution of a saved closing form to the list of
// its subject, inside the transaction that holds the ticket and after the
// subject was added. The subject is held for share; when it is not on the list,
// even because it was deleted meanwhile, the solution does not enter. A
// solution already on the list stays as it is, and a text over the limit does
// not enter, without stopping the form from being saved (spec.md, Assuntos e
// soluções).
func addFormSolution(ctx context.Context, q *db.Queries, actorID, sectorID, moduleID int64, subject, body string) error {
	subject, body = strings.TrimSpace(subject), strings.TrimSpace(body)
	if subject == "" || body == "" || utf8.RuneCountInString(body) > maxSolutionLength {
		return nil
	}
	held, err := q.GetSubjectByNameForShare(ctx, db.GetSubjectByNameForShareParams{SectorID: sectorID, ModuleID: &moduleID, Name: subject})
	if errors.Is(err, pgx.ErrNoRows) {
		return nil
	}
	if err != nil {
		return fmt.Errorf("get subject: %w", err)
	}
	added, err := q.AddSolutionIfMissing(ctx, db.AddSolutionIfMissingParams{SubjectID: held.ID, Body: body})
	if err != nil {
		return fmt.Errorf("add solution: %w", err)
	}
	for _, solution := range added {
		if err := recordSolutionCreated(ctx, q, actorID, solution); err != nil {
			return err
		}
	}
	return nil
}

// addFormItems adds what the closing form asked to add: the subject first and
// then the solution, which needs the subject on the list.
func addFormItems(ctx context.Context, q *db.Queries, actorID, sectorID int64, subject, resolution string, moduleIDs []int64, subjectModuleID, solutionModuleID *int64, addSubject, addSolution bool) error {
	if addSubject {
		if subjectModuleID == nil || !slices.Contains(moduleIDs, *subjectModuleID) {
			return ErrInvalidModules
		}
		modules, err := q.GetModulesForShare(ctx, []int64{*subjectModuleID})
		if err != nil {
			return fmt.Errorf("get module: %w", err)
		}
		if len(modules) != 1 || modules[0].SectorID != sectorID || !modules[0].Active {
			return ErrInvalidModules
		}
		if err := addFormSubject(ctx, q, actorID, sectorID, *subjectModuleID, subject); err != nil {
			return err
		}
	}
	if addSolution {
		if solutionModuleID == nil || !slices.Contains(moduleIDs, *solutionModuleID) {
			return ErrInvalidModules
		}
		return addFormSolution(ctx, q, actorID, sectorID, *solutionModuleID, subject, resolution)
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

func normalizeSolution(body string) (string, error) {
	body = strings.TrimSpace(body)
	if body == "" {
		return "", ErrInvalidSolution
	}
	if utf8.RuneCountInString(body) > maxSolutionLength {
		return "", ErrSolutionTooLong
	}
	return body, nil
}

// shareSubject holds a subject of the sector while one of its solutions is
// written.
func shareSubject(ctx context.Context, q *db.Queries, sectorID, id int64) (db.Subject, error) {
	subject, err := q.GetSubjectForShare(ctx, db.GetSubjectForShareParams{ID: id, SectorID: sectorID})
	if errors.Is(err, pgx.ErrNoRows) {
		return db.Subject{}, ErrSubjectNotFound
	}
	if err != nil {
		return db.Subject{}, fmt.Errorf("get subject: %w", err)
	}
	return subject, nil
}

// lockSolution holds the subject of the sector and locks its solution.
func lockSolution(ctx context.Context, q *db.Queries, sectorID, subjectID, id int64) (db.SubjectSolution, error) {
	if _, err := shareSubject(ctx, q, sectorID, subjectID); err != nil {
		return db.SubjectSolution{}, err
	}
	solution, err := q.GetSolutionForUpdate(ctx, db.GetSolutionForUpdateParams{ID: id, SubjectID: subjectID})
	if errors.Is(err, pgx.ErrNoRows) {
		return db.SubjectSolution{}, ErrSolutionNotFound
	}
	if err != nil {
		return db.SubjectSolution{}, fmt.Errorf("get solution: %w", err)
	}
	return solution, nil
}

func recordSolutionCreated(ctx context.Context, q *db.Queries, actorID int64, solution db.SubjectSolution) error {
	return recordSolution(ctx, q, solution.ID, "solution_created", actorID, audit.Changes{
		"subject_id": {From: nil, To: solution.SubjectID},
		"body":       {From: nil, To: solution.Body},
	})
}

func recordSolution(ctx context.Context, q *db.Queries, solutionID int64, action string, actorID int64, changes audit.Changes) error {
	raw, err := changes.JSON()
	if err != nil {
		return err
	}
	if err := q.CreateAuditLog(ctx, db.CreateAuditLogParams{
		EntityType: "subject_solution",
		EntityID:   solutionID,
		Action:     action,
		ActorID:    &actorID,
		Changes:    raw,
	}); err != nil {
		return fmt.Errorf("audit: %w", err)
	}
	return nil
}

// solutionError converts constraint violations into domain errors.
func solutionError(op string, err error) error {
	switch {
	case isConstraint(err, "subject_solutions_subject_id_body_key"):
		return ErrSolutionTaken
	case isConstraint(err, "subject_solutions_subject_id_fkey"):
		return ErrSubjectNotFound
	}
	return fmt.Errorf("%s: %w", op, err)
}

func recordSubjectCreated(ctx context.Context, q *db.Queries, actorID int64, subject db.Subject) error {
	return recordSubject(ctx, q, subject.ID, "subject_created", actorID, audit.Changes{
		"sector_id": {From: nil, To: subject.SectorID},
		"name":      {From: nil, To: subject.Name},
		"module_id": {From: nil, To: subject.ModuleID},
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
	case isConstraint(err, "subjects_module_name_key"), isConstraint(err, "subjects_unclassified_name_key"):
		return ErrSubjectNameTaken
	case isConstraint(err, "subjects_sector_id_fkey"):
		return ErrSectorNotFound
	}
	return fmt.Errorf("%s: %w", op, err)
}
