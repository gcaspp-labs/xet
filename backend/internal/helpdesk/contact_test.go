package helpdesk_test

import (
	"fmt"
	"net/http"
	"sync"
	"testing"

	"github.com/gcaspp-labs/xet/backend/internal/core/realtime"
)

func (e *testEnv) saveContactName(contactID int64, token, name string) response {
	e.T.Helper()
	return e.Do(http.MethodPut, fmt.Sprintf("/api/contacts/%d/name", contactID), token, map[string]any{"name": name})
}

// O chamado está na fila: qualquer papel que o abre salva o nome, sem assumir,
// e ele aparece na conversa, no painel e na lista de contatos.
func TestContactNameIsSavedWithoutRegistering(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e := c.e
	events := e.subscribe(c.supToken)
	auditBefore := e.Count("audit_logs")

	for token, name := range map[string]string{c.anaToken: "Maria (atendente)", c.supToken: "Maria (supervisor)", c.adminToken: "Maria (administrador)"} {
		if resp := e.saveContactName(c.ticket.ContactID, token, "  "+name+"  "); resp.Status != http.StatusOK ||
			resp.Body["name"] != name || resp.Body["registered"] != false || resp.Body["organization"] != nil {
			t.Fatalf("save name: status %d, body %v", resp.Status, resp.Body)
		}
		// Aviso publicado depois do commit: as telas abertas recarregam o nome.
		if ev := e.nextEvent(events); ev != realtime.TicketChanged(c.sector.ID, c.ticket.ID) {
			t.Fatalf("event = %+v", ev)
		}
	}
	if resp := e.saveContactName(c.ticket.ContactID, c.anaToken, "Maria Souza"); resp.Status != http.StatusOK {
		t.Fatalf("save name: status %d, body %v", resp.Status, resp.Body)
	}

	detail := e.Do(http.MethodGet, fmt.Sprintf("/api/tickets/%d", c.ticket.ID), c.biaToken, nil).Body
	contact := detail["contact"].(map[string]any)
	if contact["name"] != "Maria Souza" || contact["registered"] != false || contact["phone"] != "5511988887777" {
		t.Fatalf("detail contact = %v", contact)
	}
	if detail["organization"] != nil || detail["status"] != "queued" || detail["assignee"] != nil {
		t.Fatalf("detail = %v", detail)
	}
	panel := e.DoList(http.MethodGet, fmt.Sprintf("/api/sectors/%d/tickets", c.sector.ID), c.biaToken)
	if len(panel) != 1 || panel[0]["contact"].(map[string]any)["name"] != "Maria Souza" {
		t.Fatalf("panel = %v", panel)
	}
	list := e.DoList(http.MethodGet, "/api/contacts?q=Maria%20Souza", c.biaToken)
	if len(list) != 1 || list[0]["registered"] != false {
		t.Fatalf("contacts = %v", list)
	}

	// Como a edição de contato, salvar o nome não grava auditoria.
	if n := e.Count("audit_logs"); n != auditBefore {
		t.Fatalf("audit logs = %d, want %d", n, auditBefore)
	}

	// Nova mensagem entra no mesmo chamado e não troca o nome salvo.
	e.receive(c.sector.ID, text("MSG-2", "5511988887777@s.whatsapp.net", "5511988887777", "Oi de novo"))
	if got := e.tickets(c.sector.ID); len(got) != 1 {
		t.Fatalf("tickets = %+v", got)
	}
	if got := e.contacts(); len(got) != 1 || got[0].Name != "Maria Souza" || got[0].Registered {
		t.Fatalf("contacts = %+v", got)
	}
}

func TestContactNameRefusals(t *testing.T) {
	t.Parallel()
	c := newClosing(t)
	e := c.e

	for _, name := range []string{"", "   "} {
		if resp := e.saveContactName(c.ticket.ContactID, c.anaToken, name); resp.Status != http.StatusUnprocessableEntity {
			t.Fatalf("name %q: status %d, body %v", name, resp.Status, resp.Body)
		}
	}
	if resp := e.saveContactName(999999, c.anaToken, "Maria"); resp.Status != http.StatusNotFound || resp.Body["error"] != "Contato não encontrado." {
		t.Fatalf("unknown contact: status %d, body %v", resp.Status, resp.Body)
	}
	if resp := e.saveContactName(c.ticket.ContactID, "", "Maria"); resp.Status != http.StatusUnauthorized {
		t.Fatalf("without session: status %d", resp.Status)
	}

	// Contato já cadastrado é editado pelo cadastro: a rota recusa e nada muda.
	c.register()
	resp := e.saveContactName(c.ticket.ContactID, c.anaToken, "Outro nome")
	if resp.Status != http.StatusConflict || resp.Body["error"] != "Contato já cadastrado. Altere o nome pelo cadastro do contato." {
		t.Fatalf("registered contact: status %d, body %v", resp.Status, resp.Body)
	}
	if got := e.contacts(); len(got) != 1 || got[0].Name != "Maria" || !got[0].Registered {
		t.Fatalf("contacts = %+v", got)
	}
}

// Só com o nome, encerrar e transferir continuam exigindo o cadastro completo,
// que depois completa o chamado aberto, com auditoria.
func TestContactNameDoesNotReplaceTheRegistration(t *testing.T) {
	t.Parallel()
	c := sectorTransfer{closing: newClosing(t)}
	c.rh = *c.e.userSector("rh@exemplo.com")
	e := c.e
	if resp := e.saveContactName(c.ticket.ContactID, c.anaToken, "Maria Souza"); resp.Status != http.StatusOK {
		t.Fatalf("save name: status %d, body %v", resp.Status, resp.Body)
	}

	form := e.Do(http.MethodGet, fmt.Sprintf("/api/tickets/%d/closing-form", c.ticket.ID), c.anaToken, nil).Body
	if form["organization"] != nil {
		t.Fatalf("organization suggested: %v", form["organization"])
	}
	resp := e.closeForm(c.ticket.ID, c.anaToken, c.form(c.org))
	if resp.Status != http.StatusUnprocessableEntity || resp.Body["error"] != "Cadastre o contato e vincule-o a um órgão antes de encerrar." {
		t.Fatalf("close: status %d, body %v", resp.Status, resp.Body)
	}
	resp = e.transferSector(c.ticket.ID, c.anaToken, c.transferForm(c.rh))
	if resp.Status != http.StatusUnprocessableEntity || resp.Body["error"] != "Cadastre o contato e vincule-o a um órgão antes de transferir." {
		t.Fatalf("transfer: status %d, body %v", resp.Status, resp.Body)
	}

	// O cadastro completo tira o aviso e dá o órgão ao chamado, que agora encerra.
	events := e.subscribe(c.supToken)
	c.register()
	if ev := e.nextEvent(events); ev != realtime.TicketChanged(c.sector.ID, c.ticket.ID) {
		t.Fatalf("event = %+v", ev)
	}
	detail := e.Do(http.MethodGet, fmt.Sprintf("/api/tickets/%d", c.ticket.ID), c.anaToken, nil).Body
	if detail["contact"].(map[string]any)["registered"] != true || detail["organization"].(map[string]any)["id"] != float64(c.org) {
		t.Fatalf("detail = %v", detail)
	}
	actions, _ := c.ticketActions()
	if actions[len(actions)-1] != "ticket_organization_linked" {
		t.Fatalf("audit = %v", actions)
	}
	if resp := e.closeForm(c.ticket.ID, c.anaToken, c.form(c.org)); resp.Status != http.StatusOK {
		t.Fatalf("close: status %d, body %v", resp.Status, resp.Body)
	}
}

// O nome aparece nos chamados abertos de todos os setores do contato.
func TestContactChangesAnnounceEveryOpenTicket(t *testing.T) {
	t.Parallel()
	c := newClosing(t)
	e := c.e
	rh := *e.userSector("rh@exemplo.com")
	e.connectSector(rh)
	e.receive(rh, text("RH-1", "5511988887777@s.whatsapp.net", "5511988887777", "Férias"))
	rhTicket := e.tickets(rh)[0]
	sectorEvents, rhEvents := e.subscribe(c.supToken), e.subscribe(c.rhToken)

	check := func() {
		t.Helper()
		if ev := e.nextEvent(sectorEvents); ev != realtime.TicketChanged(c.sector.ID, c.ticket.ID) {
			t.Fatalf("sector event = %+v", ev)
		}
		if ev := e.nextEvent(rhEvents); ev != realtime.TicketChanged(rh, rhTicket.ID) {
			t.Fatalf("rh event = %+v", ev)
		}
	}
	if resp := e.saveContactName(c.ticket.ContactID, c.rhToken, "Maria"); resp.Status != http.StatusOK {
		t.Fatalf("save name: status %d, body %v", resp.Status, resp.Body)
	}
	check()

	// O cadastro completo também avisa, e o órgão entra nos dois chamados.
	c.register()
	check()

	// Trocar o nome depois do cadastro avisa mesmo sem chamado para completar.
	resp := e.Do(http.MethodPut, fmt.Sprintf("/api/contacts/%d", c.ticket.ContactID), c.anaToken,
		map[string]any{"name": "Maria Souza", "phone": "5511988887777", "organizationId": c.org, "sectorIds": []int64{c.sector.ID}})
	if resp.Status != http.StatusOK {
		t.Fatalf("update contact: status %d, body %v", resp.Status, resp.Body)
	}
	check()
}

// As travas seguem a ordem do encerramento e das mensagens: chamado, depois
// contato. Depois do cadastro completo, o nome é recusado e o do cadastro fica.
func TestContactNameUnderConcurrency(t *testing.T) {
	t.Parallel()
	c := newClosing(t)
	e := c.e

	var wg sync.WaitGroup
	for i := range 8 {
		wg.Go(func() {
			e.receive(c.sector.ID, text(fmt.Sprintf("MSG-C%d", i), "5511988887777@s.whatsapp.net", "5511988887777", "Oi"))
		})
		wg.Go(func() {
			resp := e.saveContactName(c.ticket.ContactID, c.anaToken, "Nome salvo")
			if resp.Status != http.StatusOK && resp.Status != http.StatusConflict {
				t.Errorf("save name: status %d, body %v", resp.Status, resp.Body)
			}
		})
	}
	wg.Go(func() {
		resp := e.Do(http.MethodPut, fmt.Sprintf("/api/contacts/%d", c.ticket.ContactID), c.anaToken,
			map[string]any{"name": "Maria", "phone": "5511988887777", "organizationId": c.org, "sectorIds": []int64{c.sector.ID}})
		if resp.Status != http.StatusOK {
			t.Errorf("register: status %d, body %v", resp.Status, resp.Body)
		}
	})
	wg.Wait()

	if got := e.contacts(); len(got) != 1 || !got[0].Registered || got[0].Name != "Maria" {
		t.Fatalf("contacts = %+v", got)
	}
}
