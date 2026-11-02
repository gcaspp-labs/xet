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
	"log/slog"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"

	"github.com/gcaspp-labs/xet/backend/internal/db"
)

// SessionTTL is the sliding session lifetime: each authenticated request
// pushes the expiration this far ahead.
const SessionTTL = 12 * time.Hour

// Failed login attempts allowed before the temporary lock (spec.md). The IP
// limit is higher because an office usually shares a single address.
const (
	MaxEmailFailures = 5
	MaxIPFailures    = 30
)

// CleanupInterval is how often the expired login data is removed.
const CleanupInterval = time.Hour

const (
	scopeEmail = "email"
	scopeIP    = "ip"
)

var (
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrInvalidSession     = errors.New("invalid session")
	ErrLoginLocked        = errors.New("login temporarily locked")
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
// The attempt is counted before checking the password, so simultaneous attempts
// cannot go over the limit; a right password takes it back.
func (s *Service) Login(ctx context.Context, email, password, ip string) (string, User, time.Time, error) {
	if err := s.registerAttempt(ctx, email, ip); err != nil {
		return "", User{}, time.Time{}, err
	}

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
		if err := ClearLoginAttempts(ctx, q, email); err != nil {
			return err
		}
		if err := q.RefundLoginAttempt(ctx, db.RefundLoginAttemptParams{
			Scope: scopeIP, Subject: ip, MaxFailures: MaxIPFailures,
		}); err != nil {
			return fmt.Errorf("refund login attempt: %w", err)
		}
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

// registerAttempt counts the attempt for the e-mail and the IP, in this order,
// or returns ErrLoginLocked without counting it.
func (s *Service) registerAttempt(ctx context.Context, email, ip string) error {
	return pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		q := s.q.WithTx(tx)
		for _, attempt := range []db.RegisterLoginAttemptParams{
			{Scope: scopeEmail, Subject: normalizeEmail(email), MaxFailures: MaxEmailFailures},
			{Scope: scopeIP, Subject: ip, MaxFailures: MaxIPFailures},
		} {
			_, err := q.RegisterLoginAttempt(ctx, attempt)
			if errors.Is(err, pgx.ErrNoRows) {
				return ErrLoginLocked
			}
			if err != nil {
				return fmt.Errorf("register login attempt: %w", err)
			}
		}
		return nil
	})
}

// ClearLoginAttempts forgets the failed attempts of the e-mail, ending its lock.
func ClearLoginAttempts(ctx context.Context, q *db.Queries, email string) error {
	if err := q.DeleteLoginAttempts(ctx, db.DeleteLoginAttemptsParams{Scope: scopeEmail, Subject: normalizeEmail(email)}); err != nil {
		return fmt.Errorf("delete login attempts: %w", err)
	}
	return nil
}

func normalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

// RunCleanup removes the expired sessions and the stale login attempts now and
// at each interval, until the context ends. Without it, the sessions of users
// who never log in again would stay forever.
func (s *Service) RunCleanup(ctx context.Context, interval time.Duration, logger *slog.Logger) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		if err := s.cleanup(ctx); err != nil && ctx.Err() == nil {
			logger.Error("clean up login data", "error", err)
		}
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}

func (s *Service) cleanup(ctx context.Context) error {
	return pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		q := s.q.WithTx(tx)
		if err := q.DeleteExpiredSessions(ctx); err != nil {
			return fmt.Errorf("delete expired sessions: %w", err)
		}
		if err := q.DeleteStaleLoginAttempts(ctx); err != nil {
			return fmt.Errorf("delete stale login attempts: %w", err)
		}
		return nil
	})
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

// CheckSession validates the session token without renewing it, for long
// connections that should not keep the session alive on their own.
func (s *Service) CheckSession(ctx context.Context, token string) (User, error) {
	if token == "" {
		return User{}, ErrInvalidSession
	}
	row, err := s.q.GetSessionUser(ctx, hashToken(token))
	if errors.Is(err, pgx.ErrNoRows) {
		return User{}, ErrInvalidSession
	}
	if err != nil {
		return User{}, fmt.Errorf("get session: %w", err)
	}
	return User{ID: row.ID, Name: row.Name, Email: row.Email, Role: row.Role, SectorID: row.SectorID}, nil
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
