package helpdesk_test

import (
	"fmt"
	"net/http"
	"strings"
	"sync"
	"testing"
)

func TestUserWithTicketsInProgressKeepsSectorAndStaysActive(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e := c.e
	rh := e.Sector("Recursos")
	path := fmt.Sprintf("/api/users/%d", c.ana.ID)
	body := func(name, email, role string, sectorID *int64, active bool) map[string]any {
		return map[string]any{"name": name, "email": email, "role": role, "sectorId": sectorID, "active": active}
	}
	email := "ana@exemplo.com"

	c.assign()
	second := e.queuedTicket(c.sector.ID, "MSG-2", "5511988887778")
	if resp := e.assign(second.ID, c.anaToken); resp.Status != http.StatusOK {
		t.Fatalf("assign second: status %d", resp.Status)
	}

	refused := []struct {
		name string
		body map[string]any
		want string
	}{
		{"deactivate", body("Ana", email, "agent", &c.sector.ID, false), "2 chamados em atendimento"},
		{"change sector", body("Ana", email, "agent", &rh.ID, true), "2 chamados em atendimento"},
		{"become admin", body("Ana", email, "admin", nil, true), "2 chamados em atendimento"},
	}
	for _, tc := range refused {
		resp := e.Do(http.MethodPut, path, c.adminToken, tc.body)
		message, _ := resp.Body["error"].(string)
		if resp.Status != http.StatusConflict || !strings.Contains(message, tc.want) {
			t.Errorf("%s: status %d, body %v", tc.name, resp.Status, resp.Body)
		}
	}
	actions, _ := e.AuditChanges("user", c.ana.ID)
	if len(actions) != 0 {
		t.Fatalf("refused changes recorded in the audit log: %v", actions)
	}
	if resp := e.Do(http.MethodGet, "/api/auth/me", c.anaToken, nil); resp.Status != http.StatusOK {
		t.Fatalf("session after refused deactivation: status %d", resp.Status)
	}

	// O que não tira a pessoa do setor continua livre.
	free := []struct {
		name string
		body map[string]any
	}{
		{"rename and change e-mail", body("Ana Souza", "ana.souza@exemplo.com", "agent", &c.sector.ID, true)},
		{"change role in the sector", body("Ana Souza", "ana.souza@exemplo.com", "supervisor", &c.sector.ID, true)},
	}
	for _, tc := range free {
		if resp := e.Do(http.MethodPut, path, c.adminToken, tc.body); resp.Status != http.StatusOK {
			t.Errorf("%s: status %d, body %v", tc.name, resp.Status, resp.Body)
		}
	}
	email = "ana.souza@exemplo.com"

	// Com um chamado só, a mensagem fica no singular.
	bia := e.userID("bia@exemplo.com")
	if resp := e.transfer(c.ticket.ID, bia, c.adminToken); resp.Status != http.StatusOK {
		t.Fatalf("transfer first: status %d", resp.Status)
	}
	resp := e.Do(http.MethodPut, path, c.adminToken, body("Ana Souza", email, "supervisor", &c.sector.ID, false))
	if message, _ := resp.Body["error"].(string); resp.Status != http.StatusConflict || !strings.Contains(message, "1 chamado em atendimento") {
		t.Fatalf("one ticket left: status %d, body %v", resp.Status, resp.Body)
	}

	// Depois de transferir, as duas mudanças passam.
	if resp := e.transfer(second.ID, bia, c.adminToken); resp.Status != http.StatusOK {
		t.Fatalf("transfer second: status %d", resp.Status)
	}
	if resp := e.Do(http.MethodPut, path, c.adminToken, body("Ana Souza", email, "supervisor", &rh.ID, true)); resp.Status != http.StatusOK || resp.Body["sectorId"] != float64(rh.ID) {
		t.Fatalf("change sector after transfer: status %d, body %v", resp.Status, resp.Body)
	}
	if resp := e.Do(http.MethodPut, path, c.adminToken, body("Ana Souza", email, "supervisor", &rh.ID, false)); resp.Status != http.StatusOK || resp.Body["active"] != false {
		t.Fatalf("deactivate after transfer: status %d, body %v", resp.Status, resp.Body)
	}
}

// Só os chamados em atendimento impedem: o encerrado continua com a pessoa
// como responsável, e o devolvido à fila deixa de ter responsável.
func TestClosedAndReturnedTicketsDoNotHoldTheUser(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e := c.e
	c.assign()
	path := fmt.Sprintf("/api/users/%d", c.ana.ID)
	deactivate := map[string]any{"name": "Ana", "email": "ana@exemplo.com", "role": "agent", "sectorId": c.sector.ID, "active": false}

	if resp := e.Do(http.MethodPut, path, c.adminToken, deactivate); resp.Status != http.StatusConflict {
		t.Fatalf("with ticket in progress: status %d, body %v", resp.Status, resp.Body)
	}
	if resp := e.returnToQueue(c.ticket.ID, c.anaToken); resp.Status != http.StatusOK {
		t.Fatalf("return to queue: status %d, body %v", resp.Status, resp.Body)
	}
	if resp := e.assign(c.ticket.ID, c.anaToken); resp.Status != http.StatusOK {
		t.Fatalf("assign again: status %d", resp.Status)
	}
	if resp := e.cancel(c.ticket.ID, c.anaToken, "Sem necessidade"); resp.Status != http.StatusOK {
		t.Fatalf("cancel: status %d, body %v", resp.Status, resp.Body)
	}
	if resp := e.Do(http.MethodPut, path, c.adminToken, deactivate); resp.Status != http.StatusOK {
		t.Fatalf("with closed ticket only: status %d, body %v", resp.Status, resp.Body)
	}
}

// A transferência para a pessoa trava o usuário de destino: ou a desativação
// vê o chamado e é recusada, ou a transferência vê a pessoa inativa e é recusada.
func TestDeactivationAndConcurrentTransferDoNotLeaveInactiveAssignee(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e := c.e
	c.assign()
	bia := e.userID("bia@exemplo.com")
	deactivate := map[string]any{"name": "Bia", "email": "bia@exemplo.com", "role": "agent", "sectorId": c.sector.ID, "active": false}

	var transfer, update response
	var wg sync.WaitGroup
	start := make(chan struct{})
	wg.Go(func() {
		<-start
		transfer = e.transfer(c.ticket.ID, bia, c.anaToken)
	})
	wg.Go(func() {
		<-start
		update = e.Do(http.MethodPut, fmt.Sprintf("/api/users/%d", bia), c.adminToken, deactivate)
	})
	close(start)
	wg.Wait()

	switch {
	case transfer.Status == http.StatusOK && update.Status == http.StatusConflict:
	case transfer.Status == http.StatusUnprocessableEntity && update.Status == http.StatusOK:
	default:
		t.Fatalf("transfer: status %d, body %v; deactivate: status %d, body %v", transfer.Status, transfer.Body, update.Status, update.Body)
	}
}
