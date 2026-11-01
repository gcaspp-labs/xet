package httpapi

import (
	"fmt"
	"net/http"
	"testing"
	"time"
)

// setClosedAt moves the real closing moment of a ticket, which the API never
// changes, to test the limits of the day.
func (e *testEnv) setClosedAt(ticketID int64, at time.Time) {
	e.t.Helper()
	if _, err := e.pool.Exec(e.t.Context(), "update tickets set closed_at = $2 where id = $1", ticketID, at); err != nil {
		e.t.Fatal(err)
	}
}

func TestClosedTodayListsWhatTheSectorClosed(t *testing.T) {
	t.Parallel()
	c := newSectorTransfer(t)
	e := c.e
	path := fmt.Sprintf("/api/sectors/%d/closed-today", c.sector.ID)
	if list := e.doList(http.MethodGet, path, c.anaToken); len(list) != 0 {
		t.Fatalf("before closing = %v", list)
	}

	// O atendimento entra pela hora real do encerramento, mesmo com o fim informado em outro dia.
	past := time.Now().Add(-72 * time.Hour).Truncate(time.Minute)
	form := with(with(c.form(c.org), "startedAt", past), "endedAt", past.Add(time.Hour))
	if resp := e.closeForm(c.ticket.ID, c.anaToken, form); resp.status != http.StatusOK {
		t.Fatalf("close: status %d, body %v", resp.status, resp.body)
	}

	// O transferido para outro setor fica na origem, identificado, encerrado pela Ana.
	moved := e.queuedTicket(c.sector.ID, "MSG-2", "5511977776666")
	if resp := e.assign(moved.ID, c.anaToken); resp.status != http.StatusOK {
		t.Fatalf("assign: status %d", resp.status)
	}
	if resp := e.do(http.MethodPut, fmt.Sprintf("/api/contacts/%d", moved.ContactID), c.anaToken,
		map[string]any{"name": "Rui", "phone": "5511977776666", "organizationId": c.org}); resp.status != http.StatusOK {
		t.Fatalf("register contact: status %d, body %v", resp.status, resp.body)
	}
	if resp := e.transferSector(moved.ID, c.anaToken, c.transferForm(c.rh)); resp.status != http.StatusOK {
		t.Fatalf("transfer: status %d, body %v", resp.status, resp.body)
	}

	// Chamado aberto não aparece.
	e.queuedTicket(c.sector.ID, "MSG-3", "5511966665555")

	// Todos os atendimentos do setor, do mais recente ao mais antigo, para qualquer papel do setor.
	for _, token := range []string{c.anaToken, c.biaToken, c.supToken, c.adminToken} {
		list := e.doList(http.MethodGet, path, token)
		if len(list) != 2 {
			t.Fatalf("closed today = %v, want 2", list)
		}
		if list[0]["id"] != float64(moved.ID) || list[0]["closureType"] != "transferred" {
			t.Fatalf("first = %v", list[0])
		}
		first := list[1]
		if first["id"] != float64(c.ticket.ID) || first["protocol"] != c.ticket.Protocol || first["closureType"] != "resolved" || first["closedAt"] == nil {
			t.Fatalf("second = %v", first)
		}
		if by, _ := first["closedBy"].(map[string]any); by["id"] != float64(c.ana.ID) || by["name"] != c.ana.Name {
			t.Fatalf("closed by = %v", first["closedBy"])
		}
		if contact, _ := first["contact"].(map[string]any); contact["phone"] != "5511988887777" {
			t.Fatalf("contact = %v", first["contact"])
		}
		if first["organizationName"] != "Prefeitura de Campinas" {
			t.Fatalf("organization = %v", first["organizationName"])
		}
	}

	// Outro setor não vê; o destino da transferência recebeu um chamado aberto, não um realizado.
	if resp := e.do(http.MethodGet, path, c.rhToken, nil); resp.status != http.StatusForbidden {
		t.Fatalf("other sector: status %d", resp.status)
	}
	if list := e.doList(http.MethodGet, fmt.Sprintf("/api/sectors/%d/closed-today", c.rh), c.rhToken); len(list) != 0 {
		t.Fatalf("destination = %v", list)
	}
}

func TestClosedTodayFollowsTheDayInBrasilia(t *testing.T) {
	t.Parallel()
	c := newSectorTransfer(t)
	e := c.e
	path := fmt.Sprintf("/api/sectors/%d/closed-today", c.sector.ID)

	loc, err := time.LoadLocation("America/Sao_Paulo")
	if err != nil {
		t.Fatal(err)
	}
	now := time.Now().In(loc)
	start := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, loc)

	// Último instante de ontem no horário de Brasília: em UTC, já é o dia de hoje.
	e.closeTicket(c.ticket.ID, c.ana.ID, c.org)
	e.setClosedAt(c.ticket.ID, start.Add(-time.Second))
	if list := e.doList(http.MethodGet, path, c.anaToken); len(list) != 0 {
		t.Fatalf("closed yesterday = %v", list)
	}

	// Primeiro instante de hoje.
	today := e.queuedTicket(c.sector.ID, "MSG-2", "5511977776666")
	e.closeTicket(today.ID, c.ana.ID, c.org)
	e.setClosedAt(today.ID, start)
	list := e.doList(http.MethodGet, path, c.anaToken)
	if len(list) != 1 || list[0]["id"] != float64(today.ID) {
		t.Fatalf("closed today = %v", list)
	}

	// O primeiro instante de amanhã ainda não conta.
	e.setClosedAt(today.ID, start.AddDate(0, 0, 1))
	if list := e.doList(http.MethodGet, path, c.anaToken); len(list) != 0 {
		t.Fatalf("closed tomorrow = %v", list)
	}
}
