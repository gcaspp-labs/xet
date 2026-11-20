package helpdesk_test

import (
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/gcaspp-labs/xet/backend/internal/core/auth"
	"github.com/gcaspp-labs/xet/backend/internal/helpdesk/messaging"
	"github.com/gcaspp-labs/xet/backend/internal/testapi"
)

const testPassword = testapi.Password

type response = testapi.Response

var (
	id    = testapi.ID
	names = testapi.Names
)

type testEnv struct{ *testapi.Env }

func newTestEnv(t *testing.T, extra func(a *auth.Handler, r chi.Router)) *testEnv {
	t.Helper()
	return &testEnv{testapi.New(t, extra)}
}

func startServer(t *testing.T, pool *pgxpool.Pool, extra func(a *auth.Handler, r chi.Router)) *testEnv {
	t.Helper()
	return &testEnv{testapi.Start(t, pool, extra)}
}

// editMessage asks for the edit of a message, as the panel does.
func (e *testEnv) editMessage(messageID int64, token, requestID, body string) response {
	e.T.Helper()
	return e.Do(http.MethodPost, fmt.Sprintf("/api/messages/%d/edit", messageID), token,
		map[string]string{"clientRequestId": requestID, "body": body})
}

// deleteMessage asks for the deletion of a message for everyone or only in the system.
func (e *testEnv) deleteMessage(messageID int64, token, requestID, scope string) response {
	e.T.Helper()
	return e.Do(http.MethodPost, fmt.Sprintf("/api/messages/%d/delete", messageID), token,
		map[string]string{"clientRequestId": requestID, "scope": scope})
}

// sentChanges returns the edits and deletions for everyone handed to the provider.
func (e *testEnv) sentChanges() []any {
	e.T.Helper()
	var out []any
	for _, m := range e.WhatsApp.SentMessages() {
		switch m.(type) {
		case messaging.MessageEdit, messaging.MessageRevoke:
			out = append(out, m)
		}
	}
	return out
}

type actionRow struct {
	Kind, Status string
	Reason       *string
	EventID      *string
}

func (e *testEnv) actions(messageID int64) []actionRow {
	e.T.Helper()
	rows, err := e.Pool.Query(e.T.Context(),
		"select kind::text, status::text, failure_reason, external_event_id from message_actions where message_id = $1 order by id", messageID)
	if err != nil {
		e.T.Fatal(err)
	}
	defer rows.Close()
	var out []actionRow
	for rows.Next() {
		var a actionRow
		if err := rows.Scan(&a.Kind, &a.Status, &a.Reason, &a.EventID); err != nil {
			e.T.Fatal(err)
		}
		out = append(out, a)
	}
	return out
}

// messageAudit lists the audit actions recorded on the message, in order.
func (e *testEnv) messageAudit(messageID int64) []string {
	e.T.Helper()
	rows, err := e.Pool.Query(e.T.Context(),
		"select action from audit_logs where entity_type = 'message' and entity_id = $1 order by id", messageID)
	if err != nil {
		e.T.Fatal(err)
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var a string
		if err := rows.Scan(&a); err != nil {
			e.T.Fatal(err)
		}
		out = append(out, a)
	}
	return out
}

// backdate moves the send of the message to the past, as if it had gone ago.
func (e *testEnv) backdate(messageID int64, ago time.Duration) {
	e.T.Helper()
	if _, err := e.Pool.Exec(e.T.Context(), "update messages set sent_at = now() - $2::interval where id = $1",
		messageID, fmt.Sprintf("%d microseconds", ago.Microseconds())); err != nil {
		e.T.Fatal(err)
	}
}

// waitAction waits until the message has an action with the status.
func (e *testEnv) waitAction(messageID int64, status string) {
	e.T.Helper()
	deadline := time.Now().Add(10 * time.Second)
	for time.Now().Before(deadline) {
		for _, a := range e.actions(messageID) {
			if a.Status == status {
				return
			}
		}
		time.Sleep(10 * time.Millisecond)
	}
	e.T.Fatalf("no %s action on message %d: %+v", status, messageID, e.actions(messageID))
}

// waitTicketLockWaiters waits until n transactions wait for the lock of a ticket.
func (e *testEnv) waitTicketLockWaiters(n int) {
	e.T.Helper()
	deadline := time.Now().Add(10 * time.Second)
	for time.Now().Before(deadline) {
		var waiting int
		if err := e.Pool.QueryRow(e.T.Context(), `
			select count(*) from pg_stat_activity
			where wait_event_type = 'Lock' and query like '%from tickets%for update%' and datname = current_database()`).Scan(&waiting); err != nil {
			e.T.Fatal(err)
		}
		if waiting >= n {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	e.T.Fatalf("fewer than %d transactions wait for a ticket", n)
}

// sentConversation is an assigned conversation with a text sent by Ana from
// the panel, known to WhatsApp.
type sentConversation struct {
	conversation
	sent int64
}

func newSentConversation(t *testing.T) sentConversation {
	t.Helper()
	c := newConversation(t)
	c.assign()
	resp := c.e.sendText(c.ticket.ID, c.anaToken, requestA, "Segue o boleto de setembro")
	if resp.Status != http.StatusOK || resp.Body["status"] != "sent" {
		t.Fatalf("send: status %d, body %v", resp.Status, resp.Body)
	}
	return sentConversation{conversation: c, sent: int64(resp.Body["id"].(float64))}
}

// subjectItems reads the items of a page of the subject list of the sector, at
// the full path so the caller can also send the search and the filter.
func (e *testEnv) subjectItems(path, token string) []map[string]any {
	e.T.Helper()
	items, _ := e.DoPage(path, token)
	return items
}
