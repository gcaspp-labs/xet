// Package auth handles login, sessions, roles and permissions.
package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"time"
	"unicode"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"

	"github.com/gcaspp-labs/xet/backend/internal/db"
)

// SessionTTL is the sliding session lifetime: each authenticated request
// pushes the expiration this far ahead.
const SessionTTL = 12 * time.Hour

var (
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrInvalidSession     = errors.New("invalid session")
	ErrWeakPassword       = errors.New("weak password")
	ErrPasswordTooLong    = errors.New("password too long")
	ErrEmailTaken         = errors.New("email already in use")
	ErrUserNotFound       = errors.New("user not found")
	ErrForbidden          = errors.New("forbidden")
)

// User is the authenticated user attached to a request.
type User struct {
	ID       int64
	Name     string
	Email    string
	Role     db.UserRole
	SectorID *int64
}

// CanAccessSector reports whether the user may work in the sector:
// agents and supervisors only in their own sector, admins in all.
func (u User) CanAccessSector(sectorID int64) bool {
	if u.Role == db.UserRoleAdmin {
		return true
	}
	return u.SectorID != nil && *u.SectorID == sectorID
}

// HasRole reports whether the user has one of the roles.
func (u User) HasRole(roles ...db.UserRole) bool {
	for _, r := range roles {
		if u.Role == r {
			return true
		}
	}
	return false
}

// canResetPassword: admins reset anyone; supervisors reset users of their own sector.
func (u User) canResetPassword(target db.User) bool {
	switch u.Role {
	case db.UserRoleAdmin:
		return true
	case db.UserRoleSupervisor:
		return target.SectorID != nil && u.CanAccessSector(*target.SectorID)
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

// dummyHash keeps login timing similar when the e-mail does not exist.
var dummyHash, _ = bcrypt.GenerateFromPassword([]byte("dummy-password"), bcrypt.DefaultCost)

// Login checks the credentials and opens a new session, returning its token.
func (s *Service) Login(ctx context.Context, email, password string) (string, User, time.Time, error) {
	u, err := s.q.GetUserByEmail(ctx, strings.TrimSpace(email))
	if errors.Is(err, pgx.ErrNoRows) {
		_ = bcrypt.CompareHashAndPassword(dummyHash, []byte(password))
		return "", User{}, time.Time{}, ErrInvalidCredentials
	}
	if err != nil {
		return "", User{}, time.Time{}, fmt.Errorf("get user: %w", err)
	}
	if bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(password)) != nil || !u.Active {
		return "", User{}, time.Time{}, ErrInvalidCredentials
	}

	token, err := newToken()
	if err != nil {
		return "", User{}, time.Time{}, err
	}
	expiresAt := time.Now().Add(SessionTTL)

	err = pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		q := s.q.WithTx(tx)
		if err := q.DeleteExpiredUserSessions(ctx, u.ID); err != nil {
			return fmt.Errorf("delete expired sessions: %w", err)
		}
		if err := q.CreateSession(ctx, db.CreateSessionParams{
			TokenHash: hashToken(token),
			UserID:    u.ID,
			ExpiresAt: expiresAt,
		}); err != nil {
			return fmt.Errorf("create session: %w", err)
		}
		return nil
	})
	if err != nil {
		return "", User{}, time.Time{}, err
	}

	return token, User{ID: u.ID, Name: u.Name, Email: u.Email, Role: u.Role, SectorID: u.SectorID}, expiresAt, nil
}

// Authenticate validates the session token, renews its expiration and returns its user.
func (s *Service) Authenticate(ctx context.Context, token string) (User, time.Time, error) {
	if token == "" {
		return User{}, time.Time{}, ErrInvalidSession
	}
	row, err := s.q.TouchSession(ctx, db.TouchSessionParams{
		TokenHash: hashToken(token),
		ExpiresAt: time.Now().Add(SessionTTL),
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return User{}, time.Time{}, ErrInvalidSession
	}
	if err != nil {
		return User{}, time.Time{}, fmt.Errorf("touch session: %w", err)
	}
	return User{ID: row.ID, Name: row.Name, Email: row.Email, Role: row.Role, SectorID: row.SectorID}, row.ExpiresAt, nil
}

// Logout ends the session of the token, if it exists.
func (s *Service) Logout(ctx context.Context, token string) error {
	if token == "" {
		return nil
	}
	if err := s.q.DeleteSession(ctx, hashToken(token)); err != nil {
		return fmt.Errorf("delete session: %w", err)
	}
	return nil
}

// ResetPassword sets a new password for the target user, ends the target's
// sessions and records the audit log, all in one transaction.
func (s *Service) ResetPassword(ctx context.Context, actor User, targetID int64, password string) error {
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
		if !actor.canResetPassword(target) {
			return ErrForbidden
		}
		if err := q.UpdateUserPassword(ctx, db.UpdateUserPasswordParams{ID: target.ID, PasswordHash: hash}); err != nil {
			return fmt.Errorf("update password: %w", err)
		}
		if err := q.DeleteUserSessions(ctx, target.ID); err != nil {
			return fmt.Errorf("delete sessions: %w", err)
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
func (s *Service) CreateAdmin(ctx context.Context, name, email, password string) (User, error) {
	hash, err := HashPassword(password)
	if err != nil {
		return User{}, err
	}

	var u db.User
	err = pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		q := s.q.WithTx(tx)
		u, err = q.CreateUser(ctx, db.CreateUserParams{
			Name:         strings.TrimSpace(name),
			Email:        strings.TrimSpace(email),
			PasswordHash: hash,
			Role:         db.UserRoleAdmin,
		})
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.ConstraintName == "users_email_key" {
			return ErrEmailTaken
		}
		if err != nil {
			return fmt.Errorf("create user: %w", err)
		}
		if err := q.CreateAuditLog(ctx, db.CreateAuditLogParams{
			EntityType: "user",
			EntityID:   u.ID,
			Action:     "user_created",
		}); err != nil {
			return fmt.Errorf("audit: %w", err)
		}
		return nil
	})
	if err != nil {
		return User{}, err
	}
	return User{ID: u.ID, Name: u.Name, Email: u.Email, Role: u.Role, SectorID: u.SectorID}, nil
}

// ValidatePassword enforces the password policy in spec.md: at least 8
// characters with uppercase, lowercase, digit and special character.
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

func newToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("generate token: %w", err)
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func hashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}
