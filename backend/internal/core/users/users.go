// Package users manages the registration of users and their passwords.
package users

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"unicode"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"

	"github.com/gcaspp-labs/xet/backend/internal/core/audit"
	"github.com/gcaspp-labs/xet/backend/internal/core/auth"
	"github.com/gcaspp-labs/xet/backend/internal/db"
)

var (
	ErrWeakPassword    = errors.New("weak password")
	ErrCommonPassword  = errors.New("common password")
	ErrPasswordTooLong = errors.New("password too long")
	ErrEmailTaken      = errors.New("email already in use")
	ErrNicknameTaken   = errors.New("nickname already in use")
	ErrUserNotFound    = errors.New("user not found")
	ErrForbidden       = errors.New("forbidden")
	ErrInvalidUser     = errors.New("invalid user data")
	ErrSectorRequired  = errors.New("sector required for agents and supervisors")
	ErrSectorNotFound  = errors.New("sector not found")
	ErrSelfLockout     = errors.New("admin cannot deactivate or change the role of their own account")
)

// UserHasTicketsError refuses deactivating or moving a user who still has
// tickets in progress, which need to be transferred first.
type UserHasTicketsError struct {
	Count int32
}

func (e *UserHasTicketsError) Error() string {
	return fmt.Sprintf("user has %d tickets in progress", e.Count)
}

// canResetPassword: admins reset anyone; supervisors reset users of their own sector.
func canResetPassword(actor auth.User, target db.User) bool {
	switch actor.Role {
	case db.UserRoleAdmin:
		return true
	case db.UserRoleSupervisor:
		return target.SectorID != nil && actor.CanAccessSector(*target.SectorID)
	default:
		return false
	}
}

type Service struct {
	pool *pgxpool.Pool
	q    *db.Queries
}

func NewService(pool *pgxpool.Pool) *Service {
	return &Service{pool: pool, q: db.New(pool)}
}

// ResetPassword sets a new password for the target user, ends the target's
// sessions and records the audit log, all in one transaction.
func (s *Service) ResetPassword(ctx context.Context, actor auth.User, targetID int64, password string) error {
	if !actor.HasRole(db.UserRoleAdmin, db.UserRoleSupervisor) {
		return ErrForbidden
	}
	hash, err := HashPassword(password)
	if err != nil {
		return err
	}

	return pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		q := s.q.WithTx(tx)
		target, err := q.GetUserForUpdate(ctx, targetID)
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrUserNotFound
		}
		if err != nil {
			return fmt.Errorf("get user: %w", err)
		}
		if !canResetPassword(actor, target) {
			return ErrForbidden
		}
		if err := q.UpdateUserPassword(ctx, db.UpdateUserPasswordParams{ID: target.ID, PasswordHash: hash}); err != nil {
			return fmt.Errorf("update password: %w", err)
		}
		if err := q.DeleteUserSessions(ctx, target.ID); err != nil {
			return fmt.Errorf("delete sessions: %w", err)
		}
		if err := auth.ClearLoginAttempts(ctx, q, target.Email); err != nil {
			return err
		}
		if err := q.CreateAuditLog(ctx, db.CreateAuditLogParams{
			EntityType: "user",
			EntityID:   target.ID,
			Action:     "user_password_reset",
			ActorID:    &actor.ID,
		}); err != nil {
			return fmt.Errorf("audit: %w", err)
		}
		return nil
	})
}

// CreateAdmin creates an administrator. Used by the command that bootstraps
// the first administrator; the audit log has no actor because it is a system action.
func (s *Service) CreateAdmin(ctx context.Context, name, email, password string) (auth.User, error) {
	hash, err := HashPassword(password)
	if err != nil {
		return auth.User{}, err
	}

	var u db.User
	err = pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		q := s.q.WithTx(tx)
		u, err = q.CreateUser(ctx, db.CreateUserParams{
			Name:         strings.TrimSpace(name),
			Nickname:     defaultNickname(name),
			Email:        strings.TrimSpace(email),
			PasswordHash: hash,
			Role:         db.UserRoleAdmin,
		})
		if err != nil {
			return userError("create user", err)
		}
		changes := audit.Changes{}
		changes.Set("nickname", nil, u.Nickname)
		raw, err := changes.JSON()
		if err != nil {
			return err
		}
		if err := q.CreateAuditLog(ctx, db.CreateAuditLogParams{
			EntityType: "user",
			EntityID:   u.ID,
			Action:     "user_created",
			Changes:    raw,
		}); err != nil {
			return fmt.Errorf("audit: %w", err)
		}
		return nil
	})
	if err != nil {
		return auth.User{}, err
	}
	return auth.User{ID: u.ID, Name: u.Name, Email: u.Email, Role: u.Role, SectorID: u.SectorID}, nil
}

// UserInput holds the fields an administrator sets on a user. Admins have no
// sector; agents and supervisors need one.
type UserInput struct {
	Name     string
	Nickname string
	Email    string
	Role     db.UserRole
	SectorID *int64
	Active   bool
}

// defaultNickname is the first and last words of the name, or the only word.
func defaultNickname(name string) string {
	words := strings.Fields(name)
	switch len(words) {
	case 0:
		return ""
	case 1:
		return words[0]
	default:
		return words[0] + " " + words[len(words)-1]
	}
}

func (in UserInput) normalize() (UserInput, error) {
	in.Name = strings.TrimSpace(in.Name)
	in.Nickname = strings.TrimSpace(in.Nickname)
	if in.Nickname == "" {
		in.Nickname = defaultNickname(in.Name)
	}
	in.Email = strings.TrimSpace(in.Email)
	if in.Name == "" || in.Email == "" || !in.Role.Valid() {
		return in, ErrInvalidUser
	}
	if in.Role == db.UserRoleAdmin {
		in.SectorID = nil
	} else if in.SectorID == nil {
		return in, ErrSectorRequired
	}
	return in, nil
}

// ListUsers returns every user, ordered by name.
func (s *Service) ListUsers(ctx context.Context) ([]db.User, error) {
	users, err := s.q.ListUsers(ctx)
	if err != nil {
		return nil, fmt.Errorf("list users: %w", err)
	}
	return users, nil
}

// CreateUser registers an active user with the initial password typed by the
// administrator, recording the audit log in the same transaction.
func (s *Service) CreateUser(ctx context.Context, actor auth.User, in UserInput, password string) (db.User, error) {
	if !actor.HasRole(db.UserRoleAdmin) {
		return db.User{}, ErrForbidden
	}
	in, err := in.normalize()
	if err != nil {
		return db.User{}, err
	}
	hash, err := HashPassword(password)
	if err != nil {
		return db.User{}, err
	}

	var u db.User
	err = pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		q := s.q.WithTx(tx)
		u, err = q.CreateUser(ctx, db.CreateUserParams{
			Name:         in.Name,
			Nickname:     in.Nickname,
			Email:        in.Email,
			PasswordHash: hash,
			Role:         in.Role,
			SectorID:     in.SectorID,
		})
		if err != nil {
			return userError("create user", err)
		}
		changes := audit.Changes{}
		changes.Set("name", nil, u.Name)
		changes.Set("nickname", nil, u.Nickname)
		changes.Set("email", nil, u.Email)
		changes.Set("role", nil, u.Role)
		changes.Set("sector_id", nil, u.SectorID)
		return recordUser(ctx, q, u.ID, "user_created", actor.ID, changes)
	})
	if err != nil {
		return db.User{}, err
	}
	return u, nil
}

// UpdateUser changes a user's data, locking the row. Deactivating a user ends
// their sessions in the same transaction. An administrator cannot deactivate
// or change the role of their own account, and a user with tickets in progress
// cannot be deactivated or change sectors (spec.md).
func (s *Service) UpdateUser(ctx context.Context, actor auth.User, targetID int64, in UserInput) (db.User, error) {
	if !actor.HasRole(db.UserRoleAdmin) {
		return db.User{}, ErrForbidden
	}
	in, err := in.normalize()
	if err != nil {
		return db.User{}, err
	}

	var u db.User
	err = pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		q := s.q.WithTx(tx)
		before, err := q.GetUserForUpdate(ctx, targetID)
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrUserNotFound
		}
		if err != nil {
			return fmt.Errorf("get user: %w", err)
		}
		if before.ID == actor.ID && (!in.Active || in.Role != before.Role) {
			return ErrSelfLockout
		}
		changes := audit.Changes{}
		changes.Set("name", before.Name, in.Name)
		changes.Set("nickname", before.Nickname, in.Nickname)
		changes.Set("email", before.Email, in.Email)
		changes.Set("role", before.Role, in.Role)
		changes.Set("sector_id", before.SectorID, in.SectorID)
		changes.Set("active", before.Active, in.Active)
		if changes.Empty() {
			u = before
			return nil
		}
		// Becoming an admin also changes the sector, since admins have none.
		if _, moved := changes["sector_id"]; moved || (before.Active && !in.Active) {
			count, err := q.CountInProgressTicketsOfAssignee(ctx, &targetID)
			if err != nil {
				return fmt.Errorf("count tickets: %w", err)
			}
			if count > 0 {
				return &UserHasTicketsError{Count: count}
			}
		}
		u, err = q.UpdateUser(ctx, db.UpdateUserParams{
			ID:       targetID,
			Name:     in.Name,
			Nickname: in.Nickname,
			Email:    in.Email,
			Role:     in.Role,
			SectorID: in.SectorID,
			Active:   in.Active,
		})
		if err != nil {
			return userError("update user", err)
		}
		if !u.Active {
			if err := q.DeleteUserSessions(ctx, u.ID); err != nil {
				return fmt.Errorf("delete sessions: %w", err)
			}
		}
		return recordUser(ctx, q, u.ID, "user_updated", actor.ID, changes)
	})
	if err != nil {
		return db.User{}, err
	}
	return u, nil
}

func recordUser(ctx context.Context, q *db.Queries, userID int64, action string, actorID int64, changes audit.Changes) error {
	raw, err := changes.JSON()
	if err != nil {
		return err
	}
	if err := q.CreateAuditLog(ctx, db.CreateAuditLogParams{
		EntityType: "user",
		EntityID:   userID,
		Action:     action,
		ActorID:    &actorID,
		Changes:    raw,
	}); err != nil {
		return fmt.Errorf("audit: %w", err)
	}
	return nil
}

// userError converts constraint violations into domain errors.
func userError(op string, err error) error {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		switch pgErr.ConstraintName {
		case "users_email_key":
			return ErrEmailTaken
		case "users_nickname_key":
			return ErrNicknameTaken
		case "users_sector_id_fkey":
			return ErrSectorNotFound
		case "users_admin_without_sector":
			return ErrSectorRequired
		case "users_email_check", "users_name_check", "users_nickname_check":
			return ErrInvalidUser
		}
	}
	return fmt.Errorf("%s: %w", op, err)
}

// ValidatePassword enforces the password policy in spec.md: at least 8
// characters with uppercase, lowercase, digit and special character, and not
// a common password.
// bcrypt only uses the first 72 bytes, so longer passwords are refused.
func ValidatePassword(password string) error {
	if len(password) > 72 {
		return ErrPasswordTooLong
	}
	var length int
	var upper, lower, digit, special bool
	for _, r := range password {
		length++
		switch {
		case unicode.IsUpper(r):
			upper = true
		case unicode.IsLower(r):
			lower = true
		case unicode.IsDigit(r):
			digit = true
		case !unicode.IsLetter(r):
			special = true
		}
	}
	if length < 8 || !upper || !lower || !digit || !special {
		return ErrWeakPassword
	}
	if isCommonPassword(password) {
		return ErrCommonPassword
	}
	return nil
}

// HashPassword validates the password and returns its bcrypt hash.
func HashPassword(password string) (string, error) {
	if err := ValidatePassword(password); err != nil {
		return "", err
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", fmt.Errorf("hash password: %w", err)
	}
	return string(hash), nil
}
