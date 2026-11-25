package helpdesk_test

import (
	"errors"
	"fmt"
	"net/http"
	"sync"
	"testing"
	"time"

	"github.com/coder/websocket"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/gcaspp-labs/xet/backend/internal/core/realtime"
	"github.com/gcaspp-labs/xet/backend/internal/helpdesk/messaging"
)

// holdContact locks the contact, which the merge locks last: the merge then
// waits with both tickets locked, and an action of the customer that arrives
// meanwhile reads the message still in the new ticket. The returned function
// releases the contact.
func (e *testEnv) holdContact(contactID int64) func() {
	e.T.Helper()
	ctx := e.T.Context()
	conn, err := e.Pool.Acquire(ctx)
	if err != nil {
		e.T.Fatalf("acquire: %v", err)
	}
	tx, err := conn.Begin(ctx)
	if err != nil {
		e.T.Fatalf("begin: %v", err)
	}
	if _, err := tx.Exec(ctx, "select id from contacts where id = $1 for update", contactID); err != nil {
		e.T.Fatalf("lock contact: %v", err)
	}
	return func() {
		if err := tx.Rollback(ctx); err != nil {
			e.T.Fatalf("release contact: %v", err)
		}
		conn.Release()
	}
}

// waitTicketLock waits until someone holds the lock of the ticket.
func (e *testEnv) waitTicketLock(ticketID int64) {
	e.T.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for {
		_, err := e.Pool.Exec(e.T.Context(), "select id from tickets where id = $1 for update nowait", ticketID)
		if err != nil {
			var pgErr *pgconn.PgError
			if errors.As(err, &pgErr) && pgErr.Code == "55P03" {
				return
			}
			e.T.Fatalf("probe ticket lock: %v", err)
		}
		if time.Now().After(deadline) {
			e.T.Fatal("the merge did not lock the ticket")
		}
		time.Sleep(2 * time.Millisecond)
	}
}

// eventCounts reads n events of the sector, counting each one.
func (e *testEnv) eventCounts(conn *websocket.Conn, n int) map[realtime.Event]int {
	e.T.Helper()
	counts := map[realtime.Event]int{}
	for range n {
		counts[e.nextEvent(conn)]++
	}
	return counts
}

// A reação do cliente que chega enquanto a mesclagem move as mensagens é
// gravada na mensagem, agora em A, e o aviso é o de A.
func TestConcurrentCustomerReactionAndResumePending(t *testing.T) {
	t.Parallel()
	for i := range 6 {
		t.Run(fmt.Sprint(i), func(t *testing.T) {
			t.Parallel()
			c := newConversation(t)
			e := c.e
			b := c.pendingThenNewTicket()
			a := c.ticket

			release := e.holdContact(a.ContactID)
			events := e.subscribe(c.biaToken)

			var wg sync.WaitGroup
			var merged response
			errs := make(chan error, 1)
			wg.Go(func() { merged = e.resumePending(b.ID, c.anaToken, a.ID) })
			// A e B já estão travados pela mesclagem; a reação lê a mensagem
			// ainda em B e espera o chamado.
			e.waitTicketLock(b.ID)
			wg.Go(func() {
				errs <- e.WhatsApp.React(e.T.Context(), c.sector.ID, messaging.ReactionReceived{
					TargetExternalMessageID: "MSG-2", ExternalContactID: changeContact, Phone: changePhone,
					Emoji: "👍", At: time.Now(),
				})
			})
			time.Sleep(200 * time.Millisecond)
			release()
			wg.Wait()
			close(errs)
			for err := range errs {
				if err != nil {
					t.Fatal(err)
				}
			}
			if merged.Status != http.StatusOK {
				t.Fatalf("merge: status %d, body %v", merged.Status, merged.Body)
			}

			reactions := e.reactionsOf(a.ID, c.anaToken, "MSG-2")
			customer, _ := reactions["customer"].(map[string]any)
			if customer == nil || customer["emoji"] != "👍" {
				t.Fatalf("reactions of the moved message = %v, want the customer one", reactions)
			}
			if got := e.messages(b.ID); len(got) != 0 {
				t.Fatalf("messages left in the merged ticket = %+v", got)
			}

			// A mesclagem avisa A e B; a reação avisa A, onde a mensagem está.
			counts := e.eventCounts(events, 3)
			toA, toB := realtime.TicketChanged(c.sector.ID, a.ID), realtime.TicketChanged(c.sector.ID, b.ID)
			if counts[toA] != 2 || counts[toB] != 1 {
				t.Fatalf("events = %v, want two of A and one of B", counts)
			}
		})
	}
}

// A edição do cliente que chega enquanto a mesclagem move as mensagens é
// gravada na mensagem, agora em A, e o aviso é o de A.
func TestConcurrentCustomerEditAndResumePending(t *testing.T) {
	t.Parallel()
	for i := range 6 {
		t.Run(fmt.Sprint(i), func(t *testing.T) {
			t.Parallel()
			c := newConversation(t)
			e := c.e
			b := c.pendingThenNewTicket()
			a := c.ticket

			release := e.holdContact(a.ContactID)
			events := e.subscribe(c.biaToken)

			var wg sync.WaitGroup
			var merged response
			errs := make(chan error, 1)
			wg.Go(func() { merged = e.resumePending(b.ID, c.anaToken, a.ID) })
			e.waitTicketLock(b.ID)
			wg.Go(func() {
				errs <- e.WhatsApp.Edit(e.T.Context(), c.sector.ID, messaging.MessageEdited{
					ExternalEventID: "EV-EDIT-MERGE", TargetExternalMessageID: "MSG-2",
					ExternalContactID: changeContact, Phone: changePhone,
					Body: "Voltei, o problema continua (editado)", At: time.Now().Add(time.Minute),
				})
			})
			time.Sleep(200 * time.Millisecond)
			release()
			wg.Wait()
			close(errs)
			for err := range errs {
				if err != nil {
					t.Fatal(err)
				}
			}
			if merged.Status != http.StatusOK {
				t.Fatalf("merge: status %d, body %v", merged.Status, merged.Body)
			}

			msg := e.apiMessage(a.ID, c.anaToken, "MSG-2")
			if msg["body"] != "Voltei, o problema continua (editado)" {
				t.Fatalf("body of the moved message = %v, want the customer edit", msg["body"])
			}
			if got := e.messages(b.ID); len(got) != 0 {
				t.Fatalf("messages left in the merged ticket = %+v", got)
			}

			// A mesclagem avisa A e B; a edição avisa A, onde a mensagem está.
			counts := e.eventCounts(events, 3)
			toA, toB := realtime.TicketChanged(c.sector.ID, a.ID), realtime.TicketChanged(c.sector.ID, b.ID)
			if counts[toA] != 2 || counts[toB] != 1 {
				t.Fatalf("events = %v, want two of A and one of B", counts)
			}
		})
	}
}
