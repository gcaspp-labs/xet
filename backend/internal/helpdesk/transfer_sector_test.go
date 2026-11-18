package helpdesk_test

import (
	"fmt"
	"net/http"
	"slices"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/gcaspp-labs/xet/backend/internal/core/realtime"
	"github.com/gcaspp-labs/xet/backend/internal/helpdesk/messaging"
)

// sectorTransfer is a ticket in progress with Ana, with the contact
// registered, and the RH sector as the destination.
type sectorTransfer struct {
	closing
	rh int64
}

func newSectorTransfer(t *testing.T) sectorTransfer {
	t.Helper()
	c := sectorTransfer{closing: newClosing(t)}
	c.register()
	c.rh = *c.e.userSector("rh@exemplo.com")
	return c
}

func (e *testEnv) userSector(email string) *int64 {
	e.T.Helper()
	u, err := e.Q.GetUserByEmail(e.T.Context(), email)
	if err != nil {
		e.T.Fatal(err)
	}
	return u.SectorID
}

func TestSectorTransferDestinationReadsOriginAndAnswersByItsOwnNumber(t *testing.T) {
	t.Parallel()
	c := newSectorTransfer(t)
	e := c.e
	e.connectSector(c.rh)

	// O destino oferecido é outro setor ativo.
	sectors := e.DoList(http.MethodGet, fmt.Sprintf("/api/tickets/%d/transfer-sectors", c.ticket.ID), c.anaToken)
	if len(sectors) != 1 || sectors[0]["id"] != float64(c.rh) || sectors[0]["name"] != "RH" {
		t.Fatalf("transfer sectors = %v", sectors)
	}

	resp := e.sectorTransfer(c.ticket.ID, c.anaToken, map[string]any{"sectorId": c.rh})
	if resp.Status != http.StatusOK {
		t.Fatalf("transfer: status %d, body %v", resp.Status, resp.Body)
	}
	nextID := int64(resp.Body["id"].(float64))

	// A origem mostra para onde foi e quem transferiu, sem acesso ao chamado do destino.
	detail := e.Do(http.MethodGet, fmt.Sprintf("/api/tickets/%d", c.ticket.ID), c.biaToken, nil).Body
	next, _ := detail["next"].(map[string]any)
	if detail["closureType"] != "transferred" || next == nil || next["sectorName"] != "RH" || next["protocol"] != resp.Body["protocol"] {
		t.Fatalf("origin detail = %v", detail)
	}
	logs := e.DoList(http.MethodGet, fmt.Sprintf("/api/tickets/%d/assignments", c.ticket.ID), c.biaToken)
	if l := logs[len(logs)-1]; l["action"] != "ticket_transferred_sector" || l["toSectorName"] != "RH" ||
		l["actor"].(map[string]any)["name"] != "ana@exemplo.com" {
		t.Fatalf("origin timeline = %v", logs)
	}
	if status, _, _ := e.get(fmt.Sprintf("/api/tickets/%d", nextID), c.anaToken); status != http.StatusForbidden {
		t.Fatalf("origin reading the destination: status %d", status)
	}

	// O destino vê a origem e lê a conversa anterior completa, sem agir nela.
	detail = e.Do(http.MethodGet, fmt.Sprintf("/api/tickets/%d", nextID), c.rhToken, nil).Body
	prev, _ := detail["previous"].(map[string]any)
	if prev == nil || prev["id"] != float64(c.ticket.ID) || prev["sectorName"] != "Contabilidade" || prev["closedByName"] != "ana@exemplo.com" {
		t.Fatalf("destination detail = %v", detail)
	}
	for _, path := range []string{"", "/messages", "/assignments", "/modules", "/corrections"} {
		if status, _, _ := e.get(fmt.Sprintf("/api/tickets/%d%s", c.ticket.ID, path), c.rhToken); status != http.StatusOK {
			t.Fatalf("destination reading origin%s: status %d", path, status)
		}
	}
	if got := e.DoList(http.MethodGet, fmt.Sprintf("/api/tickets/%d/messages", c.ticket.ID), c.rhToken); len(got) != 1 {
		t.Fatalf("origin messages = %v", got)
	}
	body := map[string]any{
		"subject": "Outro", "resolution": "Outra.", "moduleIds": c.modules, "organizationId": c.org,
		"startedAt": c.ticket.ArrivedAt.Add(-time.Hour), "endedAt": time.Now().Add(-time.Minute), "reason": "Ajuste",
	}
	if r := e.correct(c.ticket.ID, c.rhToken, body); r.Status == http.StatusOK {
		t.Fatalf("correction from destination: status %d", r.Status)
	}

	// Ao assumir, o destino escreve a primeira mensagem, enviada pelo próprio número.
	if r := e.assign(nextID, c.rhToken); r.Status != http.StatusOK {
		t.Fatalf("assign destination: status %d", r.Status)
	}
	if r := e.sendText(nextID, c.rhToken, requestA, "Olá, aqui é o RH."); r.Status != http.StatusOK {
		t.Fatalf("first message: status %d, body %v", r.Status, r.Body)
	}
	sent := e.WhatsApp.SentMessages()
	if msg, ok := sent[len(sent)-1].(messaging.TextMessage); !ok || msg.SectorID != c.rh || msg.Body != "*rh@exemplo.com:*\nOlá, aqui é o RH." {
		t.Fatalf("WhatsApp message = %+v", sent[len(sent)-1])
	}
}

// Transferência para outro setor sem o formulário de encerramento (#243).

func (e *testEnv) sectorTransfer(ticketID int64, token string, body map[string]any) response {
	e.T.Helper()
	return e.Do(http.MethodPost, fmt.Sprintf("/api/tickets/%d/sector-transfer", ticketID), token, body)
}

// originStep is what the origin of a transfer keeps of the closing.
type originStep struct {
	status, closureType         string
	subject, resolution, reason *string
	organizationID              *int64
	endedAt, closedAt           *time.Time
	closedBy                    int64
}

func (e *testEnv) originStep(ticketID int64) originStep {
	e.T.Helper()
	var o originStep
	if err := e.Pool.QueryRow(e.T.Context(), `
		select status::text, coalesce(closure_type::text, ''), subject, resolution, transfer_reason, organization_id,
		       ended_at, closed_at, coalesce(closed_by_id, 0)
		from tickets where id = $1`, ticketID).
		Scan(&o.status, &o.closureType, &o.subject, &o.resolution, &o.reason, &o.organizationID,
			&o.endedAt, &o.closedAt, &o.closedBy); err != nil {
		e.T.Fatal(err)
	}
	return o
}

func TestSectorTransferWithoutFormClosesOriginAndQueuesLinkedTicket(t *testing.T) {
	t.Parallel()
	for name, tc := range map[string]struct {
		reason any
		want   *string
	}{
		"without reason": {reason: nil},
		"blank reason":   {reason: "   "},
		"with reason":    {reason: "  Assunto de férias, é com o RH.  ", want: new("Assunto de férias, é com o RH.")},
	} {
		t.Run(name, func(t *testing.T) {
			t.Parallel()
			c := newSectorTransfer(t)
			e := c.e
			e.connectSector(c.rh)
			origin := e.subscribe(c.supToken)
			destination := e.subscribe(c.rhToken)

			body := map[string]any{"sectorId": c.rh}
			if tc.reason != nil {
				body["reason"] = tc.reason
			}
			before := time.Now()
			resp := e.sectorTransfer(c.ticket.ID, c.anaToken, body)
			after := time.Now()
			if resp.Status != http.StatusOK {
				t.Fatalf("transfer: status %d, body %v", resp.Status, resp.Body)
			}
			nextID := int64(resp.Body["id"].(float64))
			if ev := e.nextEvent(origin); ev != realtime.TicketChanged(c.sector.ID, c.ticket.ID) {
				t.Fatalf("origin event = %+v", ev)
			}
			if ev := e.nextEvent(destination); ev != realtime.TicketChanged(c.rh, nextID) {
				t.Fatalf("destination event = %+v", ev)
			}

			// A origem encerra como transferida, sem assunto, resolução e módulos,
			// e termina na hora da transferência.
			o := e.originStep(c.ticket.ID)
			if o.status != "closed" || o.closureType != "transferred" || o.closedBy != c.ana.ID ||
				o.subject != nil || o.resolution != nil {
				t.Fatalf("origin = %+v", o)
			}
			if o.endedAt == nil || o.closedAt == nil || !o.endedAt.Equal(*o.closedAt) || o.endedAt.Before(before.Add(-time.Second)) || o.endedAt.After(after.Add(time.Second)) {
				t.Fatalf("origin ended at %v, closed at %v, transfer between %v and %v", o.endedAt, o.closedAt, before, after)
			}
			if n := e.Count("ticket_modules"); n != 0 {
				t.Fatalf("ticket_modules rows = %d", n)
			}
			if (o.reason == nil) != (tc.want == nil) || (o.reason != nil && *o.reason != *tc.want) {
				t.Fatalf("reason = %v, want %v", o.reason, tc.want)
			}

			// O destino entra na fila, ligado à origem, com o contato e o órgão dele.
			tickets := e.tickets(c.rh)
			if len(tickets) != 1 || tickets[0].ID != nextID || tickets[0].Protocol != resp.Body["protocol"] ||
				tickets[0].Status != "queued" || tickets[0].ContactID != c.ticket.ContactID ||
				tickets[0].OrganizationID == nil || *tickets[0].OrganizationID != c.org ||
				tickets[0].ArrivedAt.Before(before.Add(-time.Second)) {
				t.Fatalf("destination tickets = %+v", tickets)
			}
			var previous int64
			if err := e.Pool.QueryRow(t.Context(), "select previous_ticket_id from tickets where id = $1", nextID).Scan(&previous); err != nil {
				t.Fatal(err)
			}
			if previous != c.ticket.ID {
				t.Fatalf("previous ticket = %d", previous)
			}

			// A auditoria da origem registra a transferência e, quando houver, o motivo.
			actions, changes := c.ticketActions()
			last := changes[len(changes)-1]
			if actions[len(actions)-1] != "ticket_transferred_sector" || last["status"]["to"] != "closed" ||
				last["closure_type"]["to"] != "transferred" || last["ended_at"]["to"] == nil ||
				last["sector_id"]["from"] != float64(c.sector.ID) || last["sector_id"]["to"] != float64(c.rh) ||
				last["next_ticket_id"]["to"] != float64(nextID) || last["subject"] != nil || last["module_ids"] != nil {
				t.Fatalf("audit = %v, %v", actions, last)
			}
			reason, recorded := last["transfer_reason"]
			if tc.want == nil && recorded || tc.want != nil && reason["to"] != *tc.want {
				t.Fatalf("audit reason = %v", last)
			}

			// O contato passa a ser também do setor de destino.
			want := []int64{c.sector.ID, c.rh}
			slices.Sort(want)
			if got := e.contactSectors(c.ticket.ContactID); fmt.Sprint(got) != fmt.Sprint(want) {
				t.Fatalf("sectors = %v, want %v", got, want)
			}
		})
	}
}

func TestSectorTransferTakesTheMainOrganizationOfTheContact(t *testing.T) {
	t.Parallel()
	c := newSectorTransfer(t)
	e := c.e
	// Depois de cadastrado, o contato passa a outro órgão; a origem fica com o primeiro.
	other := e.Organization(c.supToken, "Câmara de Campinas", "")
	if resp := e.Do(http.MethodPut, fmt.Sprintf("/api/contacts/%d", c.ticket.ContactID), c.anaToken,
		map[string]any{"name": "Maria", "phone": "5511988887777", "organizationId": other, "sectorIds": []int64{c.sector.ID}}); resp.Status != http.StatusOK {
		t.Fatalf("edit contact: status %d, body %v", resp.Status, resp.Body)
	}
	if resp := e.sectorTransfer(c.ticket.ID, c.anaToken, map[string]any{"sectorId": c.rh}); resp.Status != http.StatusOK {
		t.Fatalf("transfer: status %d, body %v", resp.Status, resp.Body)
	}
	if o := e.originStep(c.ticket.ID); o.organizationID == nil || *o.organizationID != c.org {
		t.Fatalf("origin organization = %v", o.organizationID)
	}
	if got := e.tickets(c.rh); len(got) != 1 || got[0].OrganizationID == nil || *got[0].OrganizationID != other {
		t.Fatalf("destination tickets = %+v", got)
	}
}

func TestUnregisteredContactIsTransferredToAnotherSectorWithoutOrganization(t *testing.T) {
	t.Parallel()
	c := sectorTransfer{closing: newClosing(t)}
	c.rh = *c.e.userSector("rh@exemplo.com")
	e := c.e
	resp := e.sectorTransfer(c.ticket.ID, c.anaToken, map[string]any{"sectorId": c.rh})
	if resp.Status != http.StatusOK {
		t.Fatalf("status %d, body %v", resp.Status, resp.Body)
	}
	if o := e.originStep(c.ticket.ID); o.status != "closed" || o.closureType != "transferred" || o.organizationID != nil {
		t.Fatalf("origin = %+v", o)
	}
	if got := e.tickets(c.rh); len(got) != 1 || got[0].Status != "queued" || got[0].OrganizationID != nil {
		t.Fatalf("destination tickets = %+v", got)
	}
	var registered bool
	if err := e.Pool.QueryRow(t.Context(), "select registered from contacts where id = $1", c.ticket.ContactID).Scan(&registered); err != nil {
		t.Fatal(err)
	}
	if registered {
		t.Fatal("contact registered by the transfer")
	}
}

func TestOnlyTheAssigneeTransfersToAnotherSectorWithoutForm(t *testing.T) {
	t.Parallel()
	c := newSectorTransfer(t)
	e := c.e
	body := map[string]any{"sectorId": c.rh, "reason": "RH"}

	for name, token := range map[string]string{
		"agent of the sector": c.biaToken, "supervisor": c.supToken, "admin": c.adminToken, "other sector": c.rhToken,
	} {
		if resp := e.sectorTransfer(c.ticket.ID, token, body); resp.Status != http.StatusForbidden {
			t.Fatalf("%s: status %d", name, resp.Status)
		}
	}
	for name, b := range map[string]map[string]any{
		"same sector":    with(body, "sectorId", c.sector.ID),
		"unknown sector": with(body, "sectorId", 999999),
		"no sector":      with(body, "sectorId", nil),
	} {
		if resp := e.sectorTransfer(c.ticket.ID, c.anaToken, b); resp.Status != http.StatusUnprocessableEntity {
			t.Fatalf("%s: status %d, body %v", name, resp.Status, resp.Body)
		}
	}
	inactive := e.Sector("Inativo")
	if _, err := e.Pool.Exec(t.Context(), "update sectors set active = false where id = $1", inactive.ID); err != nil {
		t.Fatal(err)
	}
	if resp := e.sectorTransfer(c.ticket.ID, c.anaToken, with(body, "sectorId", inactive.ID)); resp.Status != http.StatusUnprocessableEntity {
		t.Fatalf("inactive sector: status %d, body %v", resp.Status, resp.Body)
	}
	if got := e.assignment(c.ticket.ID); got.Status != "in_progress" {
		t.Fatalf("origin = %+v", got)
	}
	if got := e.tickets(c.rh); len(got) != 0 {
		t.Fatalf("destination tickets = %+v", got)
	}
	if actions, _ := c.ticketActions(); actions[len(actions)-1] == "ticket_transferred_sector" {
		t.Fatalf("audit = %v", actions)
	}

	// Chamado na fila não é transferido: é assumido.
	queued := e.queuedTicket(c.sector.ID, "MSG-2", "5511977776666")
	if resp := e.sectorTransfer(queued.ID, c.anaToken, body); resp.Status != http.StatusConflict {
		t.Fatalf("queued ticket: status %d", resp.Status)
	}
}

func TestSectorTransferToSectorWithOpenTicketIsRefused(t *testing.T) {
	t.Parallel()
	c := newSectorTransfer(t)
	e := c.e
	e.connectSector(c.rh)
	// O contato já escreveu para o número do RH.
	e.receive(c.rh, text("RH-1", "5511988887777@s.whatsapp.net", "5511988887777", "Férias"))

	resp := e.sectorTransfer(c.ticket.ID, c.anaToken, map[string]any{"sectorId": c.rh, "reason": "Férias"})
	if resp.Status != http.StatusConflict || resp.Body["error"] != "O contato já tem chamado aberto no setor de destino. Nada foi transferido." {
		t.Fatalf("status %d, body %v", resp.Status, resp.Body)
	}
	// Nada foi encerrado nem criado.
	if o := e.originStep(c.ticket.ID); o.status != "in_progress" || o.reason != nil {
		t.Fatalf("origin = %+v", o)
	}
	if got := e.tickets(c.rh); len(got) != 1 {
		t.Fatalf("destination tickets = %+v", got)
	}
	if actions, _ := c.ticketActions(); actions[len(actions)-1] == "ticket_transferred_sector" {
		t.Fatalf("audit = %v", actions)
	}
}

func TestConcurrentSectorTransfersWithoutFormTransferOnce(t *testing.T) {
	t.Parallel()
	c := newSectorTransfer(t)
	e := c.e

	const attempts = 5
	statuses := make([]int, attempts)
	var wg sync.WaitGroup
	for i := range attempts {
		wg.Go(func() {
			statuses[i] = e.sectorTransfer(c.ticket.ID, c.anaToken, map[string]any{"sectorId": c.rh}).Status
		})
	}
	wg.Wait()
	ok := 0
	for _, s := range statuses {
		switch s {
		case http.StatusOK:
			ok++
		case http.StatusConflict:
		default:
			t.Fatalf("statuses = %v", statuses)
		}
	}
	if ok != 1 {
		t.Fatalf("statuses = %v, want one success", statuses)
	}
	if got := e.tickets(c.rh); len(got) != 1 {
		t.Fatalf("destination tickets = %+v", got)
	}
	if actions, _ := c.ticketActions(); slices.Index(actions, "ticket_transferred_sector") != len(actions)-1 {
		t.Fatalf("audit = %v", actions)
	}
}

// Um encerramento comum continua exigindo o formulário na trava do banco, e o
// motivo da transferência não pode ser só espaços.
func TestClosedFieldsStillRequiredOutsideTransfersAndCancellations(t *testing.T) {
	t.Parallel()
	c := newSectorTransfer(t)
	e := c.e
	if resp := e.sectorTransfer(c.ticket.ID, c.anaToken, map[string]any{"sectorId": c.rh}); resp.Status != http.StatusOK {
		t.Fatalf("transfer: status %d, body %v", resp.Status, resp.Body)
	}
	if o := e.originStep(c.ticket.ID); o.closureType != "transferred" || o.subject != nil {
		t.Fatalf("origin = %+v", o)
	}
	_, err := e.Pool.Exec(t.Context(), "update tickets set closure_type = 'resolved', subject = null where id = $1", c.ticket.ID)
	if err == nil || !strings.Contains(err.Error(), "tickets_closed_fields") {
		t.Fatalf("resolved without subject: %v", err)
	}
	_, err = e.Pool.Exec(t.Context(), "update tickets set transfer_reason = '  ' where id = $1", c.ticket.ID)
	if err == nil || !strings.Contains(err.Error(), "tickets_transfer_reason_not_blank") {
		t.Fatalf("blank reason: %v", err)
	}
}

// legacyTransfer leaves the origin of a sector transfer as the old form did,
// before #243: with subject, resolution, organization and modules, and no
// reason. The route that made them is gone, but the history keeps them.
func (e *testEnv) legacyTransfer(ticketID int64, token string, sectorID, organizationID int64, subject, resolution string, moduleIDs ...int64) response {
	e.T.Helper()
	resp := e.sectorTransfer(ticketID, token, map[string]any{"sectorId": sectorID})
	if resp.Status != http.StatusOK {
		return resp
	}
	if _, err := e.Pool.Exec(e.T.Context(), `
		update tickets set subject = $2, resolution = $3, organization_id = $4 where id = $1`,
		ticketID, subject, resolution, organizationID); err != nil {
		e.T.Fatal(err)
	}
	if _, err := e.Pool.Exec(e.T.Context(), `
		insert into ticket_modules (ticket_id, module_id) select $1, unnest($2::bigint[])`,
		ticketID, moduleIDs); err != nil {
		e.T.Fatal(err)
	}
	return resp
}

// O motivo da transferência (#245) aparece nos dois lados: no chamado de
// origem, no quadro de origem do destino e no aviso da conversa de cada um.
func TestSectorTransferReasonShowsOnBothSides(t *testing.T) {
	t.Parallel()
	for name, tc := range map[string]struct {
		reason any
		want   any
	}{
		"with reason":    {reason: "  Assunto de férias, é com o RH.  ", want: "Assunto de férias, é com o RH."},
		"without reason": {reason: nil, want: nil},
		"blank reason":   {reason: "   ", want: nil},
	} {
		t.Run(name, func(t *testing.T) {
			t.Parallel()
			c := newSectorTransfer(t)
			e := c.e
			e.connectSector(c.rh)
			body := map[string]any{"sectorId": c.rh}
			if tc.reason != nil {
				body["reason"] = tc.reason
			}
			resp := e.sectorTransfer(c.ticket.ID, c.anaToken, body)
			if resp.Status != http.StatusOK {
				t.Fatalf("transfer: status %d, body %v", resp.Status, resp.Body)
			}
			nextID := int64(resp.Body["id"].(float64))
			protocol := resp.Body["protocol"]

			// A origem devolve o motivo com o setor e o protocolo do destino.
			detail := e.Do(http.MethodGet, fmt.Sprintf("/api/tickets/%d", c.ticket.ID), c.anaToken, nil).Body
			next, _ := detail["next"].(map[string]any)
			if next == nil || next["sectorName"] != "RH" || next["protocol"] != protocol || next["reason"] != tc.want {
				t.Fatalf("origin detail next = %v", detail["next"])
			}

			// O destino devolve a origem com o motivo e sem assunto nem resolução.
			detail = e.Do(http.MethodGet, fmt.Sprintf("/api/tickets/%d", nextID), c.rhToken, nil).Body
			prev, _ := detail["previous"].(map[string]any)
			if prev == nil || prev["id"] != float64(c.ticket.ID) || prev["sectorName"] != "Contabilidade" ||
				prev["closedByName"] != "ana@exemplo.com" || prev["reason"] != tc.want ||
				prev["subject"] != nil || prev["resolution"] != nil {
				t.Fatalf("destination detail previous = %v", detail["previous"])
			}

			// O aviso da conversa da origem e o do destino mostram o motivo, quem transferiu e o setor.
			if r := e.assign(nextID, c.rhToken); r.Status != http.StatusOK {
				t.Fatalf("assign at the destination: status %d, body %v", r.Status, r.Body)
			}
			for name, tt := range map[string]struct {
				ticket int64
				token  string
				from   any
			}{
				"origin":      {c.ticket.ID, c.anaToken, nil},
				"destination": {nextID, c.rhToken, "Contabilidade"},
			} {
				logs := e.DoList(http.MethodGet, fmt.Sprintf("/api/tickets/%d/assignments", tt.ticket), tt.token)
				var notices []map[string]any
				for _, l := range logs {
					if l["action"] == "ticket_transferred_sector" {
						notices = append(notices, l)
					}
				}
				if len(notices) != 1 {
					t.Fatalf("%s: transfer notices = %v", name, logs)
				}
				n := notices[0]
				if n["reason"] != tc.want || n["toSectorName"] != "RH" || n["fromSectorName"] != tt.from ||
					n["actor"].(map[string]any)["name"] != "ana@exemplo.com" {
					t.Fatalf("%s: notice = %v", name, n)
				}
			}
		})
	}
}

// Uma transferência antiga, com o formulário, continua mostrando assunto e
// resolução no quadro de origem e sem motivo; o aviso do destino mostra a origem.
func TestOldSectorTransferStillShowsSubjectAndResolution(t *testing.T) {
	t.Parallel()
	c := newSectorTransfer(t)
	e := c.e
	resp := e.legacyTransfer(c.ticket.ID, c.anaToken, c.rh, c.org, "Contracheque", "Enviada a segunda via.", c.modules...)
	if resp.Status != http.StatusOK {
		t.Fatalf("transfer: status %d, body %v", resp.Status, resp.Body)
	}
	nextID := int64(resp.Body["id"].(float64))

	detail := e.Do(http.MethodGet, fmt.Sprintf("/api/tickets/%d", nextID), c.rhToken, nil).Body
	prev, _ := detail["previous"].(map[string]any)
	if prev == nil || prev["subject"] != "Contracheque" || prev["resolution"] != "Enviada a segunda via." || prev["reason"] != nil {
		t.Fatalf("destination detail previous = %v", detail["previous"])
	}
	detail = e.Do(http.MethodGet, fmt.Sprintf("/api/tickets/%d", c.ticket.ID), c.anaToken, nil).Body
	if next, _ := detail["next"].(map[string]any); next == nil || next["reason"] != nil {
		t.Fatalf("origin detail next = %v", detail["next"])
	}
	logs := e.DoList(http.MethodGet, fmt.Sprintf("/api/tickets/%d/assignments", nextID), c.rhToken)
	if len(logs) != 1 || logs[0]["action"] != "ticket_transferred_sector" || logs[0]["reason"] != nil ||
		logs[0]["fromSectorName"] != "Contabilidade" || logs[0]["toSectorName"] != "RH" {
		t.Fatalf("destination timeline = %v", logs)
	}
}
