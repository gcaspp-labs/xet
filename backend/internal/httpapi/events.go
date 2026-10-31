package httpapi

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"

	"github.com/gcaspp-labs/xet/backend/internal/auth"
)

// Default interval between session checks and pings of an open connection.
const eventsCheckInterval = time.Minute

const eventsWriteTimeout = 10 * time.Second

// events streams the realtime events of the sectors the user can access
// (arquitetura.md, Tempo real). The client sends nothing; the session is
// checked periodically without renewing it, and the connection closes when
// the session ends.
func (s *server) events(w http.ResponseWriter, r *http.Request) {
	user := currentUser(r.Context())
	token := sessionToken(r)
	conn, err := websocket.Accept(w, r, nil)
	if err != nil {
		// Accept already wrote the response.
		return
	}
	defer func() { _ = conn.CloseNow() }()

	sub := s.hub.Subscribe(user.CanAccessSector)
	defer s.hub.Unsubscribe(sub)

	// CloseRead ends the context when the client closes the connection.
	ctx := conn.CloseRead(r.Context())
	interval := s.opts.SessionCheckInterval
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
			_, err := s.auth.CheckSession(ctx, token)
			if errors.Is(err, auth.ErrInvalidSession) {
				_ = conn.Close(websocket.StatusPolicyViolation, "sessão encerrada")
				return
			}
			if err != nil {
				s.logger.Error("check websocket session", "error", err)
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
