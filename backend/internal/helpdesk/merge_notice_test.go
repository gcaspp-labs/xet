package helpdesk_test

import (
	"fmt"
	"net/http"
	"testing"
)

// O aviso da mesclagem na conversa do atendimento que herdou o encerramento (spec #332, #343):
// o registro ticket_closed_by_merge de A, com o protocolo de B. No encerrado (não cancelado) não
// há motivo, e o aviso vem sem a linha. A lista de B e a de um atendimento comum não o trazem.
func TestAssignmentLogsShowTheMergeOfTheClosedTicket(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e := c.e
	a, b, _, _ := c.pendingAndClosed()
	if resp := e.mergeIntoPending(b.ID, c.anaToken, a.ID); resp.Status != http.StatusOK {
		t.Fatalf("merge: status %d, body %v", resp.Status, resp.Body)
	}

	notices := 0
	for _, entry := range e.DoList(http.MethodGet, fmt.Sprintf("/api/tickets/%d/assignments", a.ID), c.biaToken) {
		if entry["action"] != "ticket_closed_by_merge" {
			continue
		}
		notices++
		if entry["mergedProtocol"] != b.Protocol || entry["reason"] != nil {
			t.Fatalf("merge notice = %v", entry)
		}
		if entry["actor"].(map[string]any)["name"] != "ana@exemplo.com" {
			t.Fatalf("merge notice actor = %v", entry["actor"])
		}
	}
	if notices != 1 {
		t.Fatalf("merge notices in A = %d", notices)
	}

	// A lista de B, que virou Mesclado, não repete o registro de A; um atendimento comum também não.
	plain := e.queuedTicket(c.sector.ID, "MSG-30", "5511955554444")
	for _, id := range []int64{b.ID, plain.ID} {
		for _, entry := range e.DoList(http.MethodGet, fmt.Sprintf("/api/tickets/%d/assignments", id), c.biaToken) {
			if entry["action"] == "ticket_closed_by_merge" {
				t.Fatalf("ticket %d brought the merge notice of A: %v", id, entry)
			}
		}
	}
}

// O cancelamento de B vai para o aviso da mesclagem de A como motivo, no mesmo registro.
func TestAssignmentLogsShowTheCancellationReasonOfTheMerge(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e := c.e
	b := c.pendingThenNewTicket()
	a := c.ticket
	const reason = "Cliente desistiu do pedido"
	if resp := e.cancel(b.ID, c.anaToken, reason); resp.Status != http.StatusOK {
		t.Fatalf("cancel: status %d, body %v", resp.Status, resp.Body)
	}
	if resp := e.mergeIntoPending(b.ID, c.anaToken, a.ID); resp.Status != http.StatusOK {
		t.Fatalf("merge: status %d, body %v", resp.Status, resp.Body)
	}
	found := false
	for _, entry := range e.DoList(http.MethodGet, fmt.Sprintf("/api/tickets/%d/assignments", a.ID), c.biaToken) {
		if entry["action"] != "ticket_closed_by_merge" {
			continue
		}
		found = true
		if entry["reason"] != reason || entry["mergedProtocol"] != b.Protocol {
			t.Fatalf("merge notice of the cancelled ticket = %v", entry)
		}
	}
	if !found {
		t.Fatalf("no merge notice with the cancellation reason")
	}
}
