package realtime

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"
	"github.com/go-chi/chi/v5"

	"github.com/gcaspp-labs/xet/backend/internal/core/auth"
)

// Handler serves the realtime connection.
type Handler struct {
	logger *slog.Logger
	auth   *auth.Service
	hub    *Hub
	// sessionCheckInterval is how often an open connection checks its session;
	// one minute when zero.
	sessionCheckInterval time.Duration
}

func NewHandler(logger *slog.Logger, authService *auth.Service, hub *Hub, sessionCheckInterval time.Duration) *Handler {
	return &Handler{logger: logger, auth: authService, hub: hub, sessionCheckInterval: sessionCheckInterval}
}

// Routes registers the realtime route, behind the session middleware.
func (h *Handler) Routes(r chi.Router) {
	r.Get("/ws", h.events)
}

// Default interval between session checks and pings of an open connection.
const eventsCheckInterval = time.Minute

const eventsWriteTimeout = 10 * time.Second

// events streams the realtime events of the sectors the user can access
// (arquitetura.md, Tempo real). The client sends nothing; the session is
// checked periodically without renewing it, and the connection closes when
// the session ends.

func (h *Handler) events(w http.ResponseWriter, r *http.Request) {
	user := auth.CurrentUser(r.Context())
	token := auth.SessionToken(r)
	conn, err := websocket.Accept(w, r, nil)
	if err != nil {
		// Accept already wrote the response.
		return
	}
	defer func() { _ = conn.CloseNow() }()

	sub := h.hub.Subscribe(user.CanAccessSector)
	defer h.hub.Unsubscribe(sub)

	// CloseRead ends the context when the client closes the connection.
	ctx := conn.CloseRead(r.Context())
	interval := h.sessionCheckInterval
	if interval <= 0 {
		interval = eventsCheckInterval
	}
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-sub.Dropped():
			_ = conn.Close(websocket.StatusTryAgainLater, "eventos atrasados")
			return
		case ev := <-sub.Events():
			wctx, cancel := context.WithTimeout(ctx, eventsWriteTimeout)
			err := wsjson.Write(wctx, conn, ev)
			cancel()
			if err != nil {
				return
			}
		case <-ticker.C:
			_, err := h.auth.CheckSession(ctx, token)
			if errors.Is(err, auth.ErrInvalidSession) {
				_ = conn.Close(websocket.StatusPolicyViolation, "sessão encerrada")
				return
			}
			if err != nil {
				h.logger.Error("check websocket session", "error", err)
				continue
			}
			pctx, cancel := context.WithTimeout(ctx, eventsWriteTimeout)
			err = conn.Ping(pctx)
			cancel()
			if err != nil {
				return
			}
		}
	}
}
