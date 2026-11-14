package helpdesk_test

import (
	"fmt"
	"net/http"
	"slices"
	"strings"
	"sync"
	"testing"

	"github.com/gcaspp-labs/xet/backend/internal/db"
)

func subjectsPath(sectorID int64) string {
	return fmt.Sprintf("/api/sectors/%d/subjects/", sectorID)
}

func subjectPath(sectorID, subjectID int64) string {
	return fmt.Sprintf("/api/sectors/%d/subjects/%d", sectorID, subjectID)
}

func (e *testEnv) subjectModule(sectorID int64) int64 {
	e.T.Helper()
	modules, err := e.Q.ListActiveModules(e.T.Context(), sectorID)
	if err != nil {
		e.T.Fatal(err)
	}
	if len(modules) > 0 {
		return modules[0].ID
	}
	module, err := e.Q.CreateModule(e.T.Context(), db.CreateModuleParams{SectorID: sectorID, Name: "Módulo de teste"})
	if err != nil {
		e.T.Fatal(err)
	}
	return module.ID
}

func (e *testEnv) createSubject(sectorID int64, token, name string) int64 {
	e.T.Helper()
	resp := e.Do(http.MethodPost, subjectsPath(sectorID), token, map[string]any{"name": name, "moduleId": e.subjectModule(sectorID)})
	if resp.Status != http.StatusCreated {
		e.T.Fatalf("create subject %q: status %d, body %v", name, resp.Status, resp.Body)
	}
	return id(resp.Body)
}

// subjectNames lists the subjects of the sector straight from the database.
func (e *testEnv) subjectNames(sectorID int64) []string {
	e.T.Helper()
	rows, err := e.Q.ListSubjects(e.T.Context(), sectorID)
	if err != nil {
		e.T.Fatal(err)
	}
	out := make([]string, len(rows))
	for i, r := range rows {
		out[i] = r.Name
	}
	return out
}

// subjectAudit returns the log of the only subject of the sector.
func (e *testEnv) subjectAudit(sectorID int64) db.AuditLog {
	e.T.Helper()
	rows, err := e.Q.ListSubjects(e.T.Context(), sectorID)
	if err != nil {
		e.T.Fatal(err)
	}
	if len(rows) != 1 {
		e.T.Fatalf("subjects = %+v, want one", rows)
	}
	logs, err := e.Q.ListAuditLogsByEntity(e.T.Context(), db.ListAuditLogsByEntityParams{EntityType: "subject", EntityID: rows[0].ID})
	if err != nil {
		e.T.Fatal(err)
	}
	if len(logs) != 1 {
		e.T.Fatalf("audit logs = %+v, want one", logs)
	}
	return logs[0]
}

func wantSubjects(t *testing.T, got []string, want ...string) {
	t.Helper()
	if len(got) == 0 && len(want) == 0 {
		return
	}
	if !slices.Equal(got, want) {
		t.Fatalf("subjects = %q, want %q", got, want)
	}
}

func wantSubjectCreatedBy(t *testing.T, log db.AuditLog, actorID int64) {
	t.Helper()
	if log.Action != "subject_created" || log.ActorID == nil || *log.ActorID != actorID {
		t.Fatalf("audit = %s by %v, want subject_created by %d", log.Action, log.ActorID, actorID)
	}
}

func TestSupervisorManagesTheSubjectList(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e := c.e
	sector := c.sector.ID

	if got := e.DoList(http.MethodGet, subjectsPath(sector), c.supToken); len(got) != 0 {
		t.Fatalf("the list starts empty: %v", got)
	}

	resp := e.Do(http.MethodPost, subjectsPath(sector), c.supToken, map[string]any{"name": "  Folha de pagamento ", "moduleId": e.subjectModule(sector)})
	if resp.Status != http.StatusCreated || resp.Body["name"] != "Folha de pagamento" {
		t.Fatalf("create: status %d, body %v", resp.Status, resp.Body)
	}
	folha := id(resp.Body)
	e.createSubject(sector, c.supToken, "Contracheque")
	if got := names(e.DoList(http.MethodGet, subjectsPath(sector), c.supToken)); !slices.Equal(got, []string{"Contracheque", "Folha de pagamento"}) {
		t.Fatalf("list = %v", got)
	}

	// Salvar sem mudar nada não grava auditoria.
	if resp := e.Do(http.MethodPut, subjectPath(sector, folha), c.supToken, map[string]any{"name": "Folha de pagamento", "moduleId": e.subjectModule(sector)}); resp.Status != http.StatusOK {
		t.Fatalf("update without changes: status %d", resp.Status)
	}
	resp = e.Do(http.MethodPut, subjectPath(sector, folha), c.supToken, map[string]any{"name": "Folha", "moduleId": e.subjectModule(sector)})
	if resp.Status != http.StatusOK || resp.Body["name"] != "Folha" {
		t.Fatalf("update: status %d, body %v", resp.Status, resp.Body)
	}
	// Mudar só as maiúsculas do próprio nome não é repetição.
	if resp := e.Do(http.MethodPut, subjectPath(sector, folha), c.supToken, map[string]any{"name": "FOLHA", "moduleId": e.subjectModule(sector)}); resp.Status != http.StatusOK {
		t.Fatalf("update case: status %d, body %v", resp.Status, resp.Body)
	}

	if resp := e.Do(http.MethodDelete, subjectPath(sector, folha), c.supToken, nil); resp.Status != http.StatusNoContent {
		t.Fatalf("delete: status %d, body %v", resp.Status, resp.Body)
	}
	if got := names(e.DoList(http.MethodGet, subjectsPath(sector), c.supToken)); !slices.Equal(got, []string{"Contracheque"}) {
		t.Fatalf("list after delete = %v", got)
	}
	if resp := e.Do(http.MethodDelete, subjectPath(sector, folha), c.supToken, nil); resp.Status != http.StatusNotFound {
		t.Fatalf("delete again: status %d", resp.Status)
	}

	actions, changes := e.AuditChanges("subject", folha)
	if want := []string{"subject_created", "subject_updated", "subject_updated", "subject_deleted"}; !slices.Equal(actions, want) {
		t.Fatalf("actions = %v, want %v", actions, want)
	}
	sectorID := float64(sector)
	created, renamed, deleted := changes[0], changes[1], changes[3]
	if created["name"]["to"] != "Folha de pagamento" || created["sector_id"]["to"] != sectorID {
		t.Fatalf("created = %v", created)
	}
	if renamed["name"]["from"] != "Folha de pagamento" || renamed["name"]["to"] != "Folha" || renamed["sector_id"]["to"] != sectorID {
		t.Fatalf("renamed = %v", renamed)
	}
	if deleted["name"]["from"] != "FOLHA" || deleted["name"]["to"] != nil || deleted["sector_id"]["from"] != sectorID {
		t.Fatalf("deleted = %v", deleted)
	}
	sup, err := e.Q.GetUserByEmail(t.Context(), "sup@exemplo.com")
	if err != nil {
		t.Fatal(err)
	}
	logs, err := e.Q.ListAuditLogsByEntity(t.Context(), db.ListAuditLogsByEntityParams{EntityType: "subject", EntityID: folha})
	if err != nil {
		t.Fatal(err)
	}
	for _, l := range logs {
		if l.ActorID == nil || *l.ActorID != sup.ID {
			t.Fatalf("%s by %v, want %d", l.Action, l.ActorID, sup.ID)
		}
	}
}

func TestSubjectListPermissionsBySector(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e := c.e
	sector := c.sector.ID
	rh := e.Sector("Compras")
	e.User("sup.compras@exemplo.com", db.UserRoleSupervisor, &rh.ID)
	otherSup := e.Login("sup.compras@exemplo.com", testPassword)
	subject := e.createSubject(sector, c.supToken, "Contracheque")

	for name, token := range map[string]string{
		"agent of the sector":     c.anaToken,
		"agent of another sector": c.rhToken,
		"supervisor of another":   otherSup,
	} {
		for _, req := range []struct {
			method, path string
			body         any
		}{
			{http.MethodGet, subjectsPath(sector), nil},
			{http.MethodPost, subjectsPath(sector), map[string]string{"name": "Novo"}},
			{http.MethodPut, subjectPath(sector, subject), map[string]string{"name": "Novo"}},
			{http.MethodDelete, subjectPath(sector, subject), nil},
		} {
			if resp := e.Do(req.method, req.path, token, req.body); resp.Status != http.StatusForbidden {
				t.Errorf("%s %s %s: status %d", name, req.method, req.path, resp.Status)
			}
		}
	}
	if resp := e.Do(http.MethodGet, subjectsPath(sector), "", nil); resp.Status != http.StatusUnauthorized {
		t.Fatalf("no session: status %d", resp.Status)
	}
	wantSubjects(t, e.subjectNames(sector), "Contracheque")

	// O administrador gerencia todos os setores.
	if got := names(e.DoList(http.MethodGet, subjectsPath(sector), c.adminToken)); !slices.Equal(got, []string{"Contracheque"}) {
		t.Fatalf("admin list = %v", got)
	}
	inRH := e.createSubject(rh.ID, c.adminToken, "Licitação")
	if resp := e.Do(http.MethodPut, subjectPath(rh.ID, inRH), c.adminToken, map[string]any{"name": "Compra direta", "moduleId": e.subjectModule(rh.ID)}); resp.Status != http.StatusOK {
		t.Fatalf("admin update: status %d", resp.Status)
	}
	if resp := e.Do(http.MethodDelete, subjectPath(sector, subject), c.adminToken, nil); resp.Status != http.StatusNoContent {
		t.Fatalf("admin delete: status %d", resp.Status)
	}

	// O assunto precisa ser do setor da rota, e o setor precisa existir.
	if resp := e.Do(http.MethodPut, subjectPath(sector, inRH), c.adminToken, map[string]string{"name": "X"}); resp.Status != http.StatusNotFound {
		t.Fatalf("subject of another sector, update: status %d", resp.Status)
	}
	if resp := e.Do(http.MethodDelete, subjectPath(sector, inRH), c.adminToken, nil); resp.Status != http.StatusNotFound {
		t.Fatalf("subject of another sector, delete: status %d", resp.Status)
	}
	if resp := e.Do(http.MethodPost, subjectsPath(999999), c.adminToken, map[string]string{"name": "X"}); resp.Status != http.StatusNotFound {
		t.Fatalf("unknown sector: status %d, body %v", resp.Status, resp.Body)
	}
	wantSubjects(t, e.subjectNames(rh.ID), "Compra direta")
}

func TestSubjectNamesAreValidatedAndDoNotRepeatInTheSector(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e := c.e
	sector := c.sector.ID
	const taken = "Já existe um assunto com este nome neste setor."
	e.createSubject(sector, c.supToken, "Contracheque")
	other := e.createSubject(sector, c.supToken, "Férias")

	resp := e.Do(http.MethodPost, subjectsPath(sector), c.supToken, map[string]any{"name": " CONTRACHEQUE ", "moduleId": e.subjectModule(sector)})
	if resp.Status != http.StatusConflict || resp.Body["error"] != taken {
		t.Fatalf("create repeated: status %d, body %v", resp.Status, resp.Body)
	}
	resp = e.Do(http.MethodPut, subjectPath(sector, other), c.supToken, map[string]any{"name": "contracheque", "moduleId": e.subjectModule(sector)})
	if resp.Status != http.StatusConflict || resp.Body["error"] != taken {
		t.Fatalf("update repeated: status %d, body %v", resp.Status, resp.Body)
	}

	// O mesmo nome vale em outro setor.
	rh := e.userSector("rh@exemplo.com")
	e.createSubject(*rh, c.adminToken, "Contracheque")

	// Em branco e acima do limite, contando caracteres e não bytes.
	if resp := e.Do(http.MethodPost, subjectsPath(sector), c.supToken, map[string]string{"name": "   "}); resp.Status != http.StatusUnprocessableEntity {
		t.Fatalf("blank: status %d", resp.Status)
	}
	if resp := e.Do(http.MethodPost, subjectsPath(sector), c.supToken, map[string]string{"name": strings.Repeat("é", 501)}); resp.Status != http.StatusUnprocessableEntity {
		t.Fatalf("over the limit: status %d", resp.Status)
	}
	if resp := e.Do(http.MethodPut, subjectPath(sector, other), c.supToken, map[string]string{"name": strings.Repeat("é", 501)}); resp.Status != http.StatusUnprocessableEntity {
		t.Fatalf("update over the limit: status %d", resp.Status)
	}
	e.createSubject(sector, c.supToken, strings.Repeat("é", 500))
}

func TestConcurrentSubjectCreationsLetOneThrough(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e := c.e

	moduleID := e.subjectModule(c.sector.ID)
	const attempts = 6
	statuses := make([]int, attempts)
	var wg sync.WaitGroup
	for i := range attempts {
		wg.Go(func() {
			name := "Contracheque"
			if i%2 == 0 {
				name = "CONTRACHEQUE"
			}
			statuses[i] = e.Do(http.MethodPost, subjectsPath(c.sector.ID), c.supToken, map[string]any{"name": name, "moduleId": moduleID}).Status
		})
	}
	wg.Wait()
	created := 0
	for _, s := range statuses {
		switch s {
		case http.StatusCreated:
			created++
		case http.StatusConflict:
		default:
			t.Fatalf("statuses = %v", statuses)
		}
	}
	if created != 1 || e.Count("subjects") != 1 {
		t.Fatalf("statuses = %v, subjects = %d", statuses, e.Count("subjects"))
	}
}

func TestClosingFormReturnsTheSubjectsOfTheSectorOfTheTicket(t *testing.T) {
	t.Parallel()
	c := newClosing(t)
	e := c.e
	e.createSubject(c.sector.ID, c.supToken, "Férias")
	e.createSubject(c.sector.ID, c.supToken, "Contracheque")
	e.createSubject(*e.userSector("rh@exemplo.com"), c.adminToken, "Admissão")

	// O atendente não abre as rotas da lista: lê pelo formulário.
	resp := e.Do(http.MethodGet, fmt.Sprintf("/api/tickets/%d/closing-form", c.ticket.ID), c.anaToken, nil)
	if resp.Status != http.StatusOK {
		t.Fatalf("closing form: status %d, body %v", resp.Status, resp.Body)
	}
	list, ok := resp.Body["subjects"].([]any)
	if !ok || len(list) != 2 {
		t.Fatalf("subjects = %v", resp.Body["subjects"])
	}
	for i, want := range []string{"Contracheque", "Férias"} {
		if got := list[i].(map[string]any)["name"]; got != want {
			t.Fatalf("subject %d = %v, want %s", i, got, want)
		}
	}
	if resp := e.Do(http.MethodGet, fmt.Sprintf("/api/tickets/%d/closing-form", c.ticket.ID), c.rhToken, nil); resp.Status != http.StatusForbidden {
		t.Fatalf("other sector: status %d", resp.Status)
	}
}

func TestClosingWithAddSubjectAddsItToTheList(t *testing.T) {
	t.Parallel()
	c := newClosing(t)
	e := c.e
	c.register()

	form := with(with(c.form(c.org), "subject", "  Segunda via  "), "addSubject", true)
	if resp := e.closeForm(c.ticket.ID, c.anaToken, form); resp.Status != http.StatusOK {
		t.Fatalf("close: status %d, body %v", resp.Status, resp.Body)
	}
	wantSubjects(t, e.subjectNames(c.sector.ID), "Segunda via")
	log := e.subjectAudit(c.sector.ID)
	wantSubjectCreatedBy(t, log, c.ana.ID)
}

func TestClosingWithoutAddSubjectLeavesTheListAlone(t *testing.T) {
	t.Parallel()
	c := newClosing(t)
	e := c.e
	c.register()

	if resp := e.closeForm(c.ticket.ID, c.anaToken, c.form(c.org)); resp.Status != http.StatusOK {
		t.Fatalf("close: status %d, body %v", resp.Status, resp.Body)
	}
	if n := e.Count("subjects"); n != 0 {
		t.Fatalf("subjects = %d", n)
	}
}

func TestAddSubjectAlreadyOnTheListKeepsItAndSaves(t *testing.T) {
	t.Parallel()
	c := newClosing(t)
	e := c.e
	c.register()
	subject := e.createSubject(c.sector.ID, c.supToken, "Contracheque")

	form := with(with(c.form(c.org), "subject", "CONTRACHEQUE"), "addSubject", true)
	if resp := e.closeForm(c.ticket.ID, c.anaToken, form); resp.Status != http.StatusOK {
		t.Fatalf("close: status %d, body %v", resp.Status, resp.Body)
	}
	wantSubjects(t, e.subjectNames(c.sector.ID), "Contracheque")
	if actions, _ := e.AuditChanges("subject", subject); !slices.Equal(actions, []string{"subject_created"}) {
		t.Fatalf("actions = %v", actions)
	}
}

func TestConcurrentClosingsWithTheSameNewSubjectAreBothSaved(t *testing.T) {
	t.Parallel()
	c := newClosing(t)
	e := c.e
	c.register()
	second := e.queuedTicket(c.sector.ID, "MSG-2", "5511977776666")
	resp := e.Do(http.MethodPut, fmt.Sprintf("/api/contacts/%d", second.ContactID), c.biaToken,
		map[string]any{"name": "João", "phone": "5511977776666", "organizationId": c.org, "sectorIds": []int64{c.sector.ID}})
	if resp.Status != http.StatusOK {
		t.Fatalf("register contact: status %d, body %v", resp.Status, resp.Body)
	}
	if resp := e.assign(second.ID, c.biaToken); resp.Status != http.StatusOK {
		t.Fatalf("assign: status %d", resp.Status)
	}

	form := with(c.form(c.org), "addSubject", true)
	var first, other response
	var wg sync.WaitGroup
	wg.Go(func() {
		first = e.closeForm(c.ticket.ID, c.anaToken, form)
	})
	wg.Go(func() {
		other = e.closeForm(second.ID, c.biaToken, with(form, "subject", "contracheque"))
	})
	wg.Wait()
	if first.Status != http.StatusOK || other.Status != http.StatusOK {
		t.Fatalf("statuses = %d (%v), %d (%v)", first.Status, first.Body, other.Status, other.Body)
	}
	if n := e.Count("subjects"); n != 1 {
		t.Fatalf("subjects = %d, want one", n)
	}
	if log := e.subjectAudit(c.sector.ID); log.Action != "subject_created" {
		t.Fatalf("audit = %s", log.Action)
	}
	for _, ticket := range []int64{c.ticket.ID, second.ID} {
		if got := e.assignment(ticket); got.Status != "closed" {
			t.Fatalf("ticket %d = %+v", ticket, got)
		}
	}
}

func TestRefusedClosingAddsNothing(t *testing.T) {
	t.Parallel()
	c := newClosing(t)
	e := c.e
	form := with(c.form(c.org), "addSubject", true)

	// Recusado pelo contato sem cadastro, e depois por quem não é o responsável.
	if resp := e.closeForm(c.ticket.ID, c.anaToken, form); resp.Status != http.StatusUnprocessableEntity {
		t.Fatalf("unregistered: status %d, body %v", resp.Status, resp.Body)
	}
	c.register()
	if resp := e.closeForm(c.ticket.ID, c.biaToken, form); resp.Status != http.StatusForbidden {
		t.Fatalf("not the assignee: status %d, body %v", resp.Status, resp.Body)
	}
	// Recusado depois de o chamado já estar gravado na transação: módulo de outro setor.
	if resp := e.closeForm(c.ticket.ID, c.anaToken, with(form, "moduleIds", []int64{c.rhModule})); resp.Status != http.StatusUnprocessableEntity {
		t.Fatalf("invalid module: status %d, body %v", resp.Status, resp.Body)
	}
	if n := e.Count("subjects"); n != 0 {
		t.Fatalf("subjects = %d", n)
	}
}

func TestSubjectOverTheLimitDoesNotEnterAndTheFormIsSaved(t *testing.T) {
	t.Parallel()
	long := strings.Repeat("é", 501)
	exact := strings.Repeat("é", 500)

	t.Run("closing", func(t *testing.T) {
		t.Parallel()
		c := newClosing(t)
		c.register()
		form := with(with(c.form(c.org), "subject", long), "addSubject", true)
		if resp := c.e.closeForm(c.ticket.ID, c.anaToken, form); resp.Status != http.StatusOK {
			t.Fatalf("close: status %d, body %v", resp.Status, resp.Body)
		}
		if n := c.e.Count("subjects"); n != 0 {
			t.Fatalf("subjects = %d", n)
		}
		ticket, err := db.AsTicket(c.e.Q.GetTicket(t.Context(), c.ticket.ID))
		if err != nil {
			t.Fatal(err)
		}
		if ticket.Status != db.TicketStatusClosed || ticket.Subject == nil || *ticket.Subject != long {
			t.Fatalf("ticket = %s, subject %v", ticket.Status, ticket.Subject)
		}
	})
	t.Run("transfer", func(t *testing.T) {
		t.Parallel()
		c := newSectorTransfer(t)
		form := with(with(c.transferForm(c.rh), "subject", long), "addSubject", true)
		if resp := c.e.transferSector(c.ticket.ID, c.anaToken, form); resp.Status != http.StatusOK {
			t.Fatalf("transfer: status %d, body %v", resp.Status, resp.Body)
		}
		if n := c.e.Count("subjects"); n != 0 {
			t.Fatalf("subjects = %d", n)
		}
	})
	t.Run("correction", func(t *testing.T) {
		t.Parallel()
		c := newCorrection(t)
		body := with(with(c.data("Assunto errado."), "subject", long), "addSubject", true)
		if resp := c.e.correct(c.ticket.ID, c.anaToken, body); resp.Status != http.StatusOK {
			t.Fatalf("correct: status %d, body %v", resp.Status, resp.Body)
		}
		if n := c.e.Count("subjects"); n != 0 {
			t.Fatalf("subjects = %d", n)
		}
	})
	t.Run("exactly at the limit enters", func(t *testing.T) {
		t.Parallel()
		c := newClosing(t)
		c.register()
		form := with(with(c.form(c.org), "subject", exact), "addSubject", true)
		if resp := c.e.closeForm(c.ticket.ID, c.anaToken, form); resp.Status != http.StatusOK {
			t.Fatalf("close: status %d, body %v", resp.Status, resp.Body)
		}
		wantSubjects(t, c.e.subjectNames(c.sector.ID), exact)
	})
}

func TestTransferWithAddSubjectAddsItToTheListOfTheOrigin(t *testing.T) {
	t.Parallel()
	c := newSectorTransfer(t)
	e := c.e

	form := with(c.transferForm(c.rh), "addSubject", true)
	if resp := e.transferSector(c.ticket.ID, c.anaToken, form); resp.Status != http.StatusOK {
		t.Fatalf("transfer: status %d, body %v", resp.Status, resp.Body)
	}
	wantSubjects(t, e.subjectNames(c.sector.ID), "Contracheque")
	wantSubjects(t, e.subjectNames(c.rh))
	wantSubjectCreatedBy(t, e.subjectAudit(c.sector.ID), c.ana.ID)
}

func TestTransferWithoutAddSubjectLeavesTheListAlone(t *testing.T) {
	t.Parallel()
	c := newSectorTransfer(t)
	if resp := c.e.transferSector(c.ticket.ID, c.anaToken, c.transferForm(c.rh)); resp.Status != http.StatusOK {
		t.Fatalf("transfer: status %d, body %v", resp.Status, resp.Body)
	}
	if n := c.e.Count("subjects"); n != 0 {
		t.Fatalf("subjects = %d", n)
	}
}

func TestRefusedTransferAddsNothing(t *testing.T) {
	t.Parallel()
	c := newSectorTransfer(t)
	e := c.e
	e.connectSector(c.rh)
	// O contato já tem chamado aberto no destino: a recusa vem depois do encerramento na transação.
	e.receive(c.rh, text("RH-1", "5511988887777@s.whatsapp.net", "5511988887777", "Férias"))

	form := with(c.transferForm(c.rh), "addSubject", true)
	if resp := e.transferSector(c.ticket.ID, c.anaToken, form); resp.Status != http.StatusConflict {
		t.Fatalf("transfer: status %d, body %v", resp.Status, resp.Body)
	}
	if n := e.Count("subjects"); n != 0 {
		t.Fatalf("subjects = %d", n)
	}
}

func TestCorrectionWithAddSubjectAddsItToTheList(t *testing.T) {
	t.Parallel()
	c := newCorrection(t)
	e := c.e
	sup, err := e.Q.GetUserByEmail(t.Context(), "sup@exemplo.com")
	if err != nil {
		t.Fatal(err)
	}

	// Sem addSubject, nada entra.
	body := with(c.data("Assunto errado."), "subject", "Segunda via")
	if resp := e.correct(c.ticket.ID, c.supToken, body); resp.Status != http.StatusOK {
		t.Fatalf("correct: status %d, body %v", resp.Status, resp.Body)
	}
	if n := e.Count("subjects"); n != 0 {
		t.Fatalf("subjects = %d", n)
	}

	// A correção recusada, aqui por não alterar nada, não deixa item.
	if resp := e.correct(c.ticket.ID, c.supToken, with(body, "addSubject", true)); resp.Status != http.StatusUnprocessableEntity {
		t.Fatalf("no changes: status %d, body %v", resp.Status, resp.Body)
	}
	if n := e.Count("subjects"); n != 0 {
		t.Fatalf("subjects = %d", n)
	}

	body = with(with(body, "subject", "Férias"), "addSubject", true)
	if resp := e.correct(c.ticket.ID, c.supToken, body); resp.Status != http.StatusOK {
		t.Fatalf("correct: status %d, body %v", resp.Status, resp.Body)
	}
	wantSubjects(t, e.subjectNames(c.sector.ID), "Férias")
	wantSubjectCreatedBy(t, e.subjectAudit(c.sector.ID), sup.ID)
}

func TestEditingOrDeletingASubjectDoesNotChangeTickets(t *testing.T) {
	t.Parallel()
	c := newCorrection(t)
	e := c.e
	subject := e.createSubject(c.sector.ID, c.supToken, "Contracheque")

	wantSubjectOnTicket := func(step string) {
		t.Helper()
		ticket, err := db.AsTicket(e.Q.GetTicket(t.Context(), c.ticket.ID))
		if err != nil {
			t.Fatal(err)
		}
		if ticket.Subject == nil || *ticket.Subject != "Contracheque" {
			t.Fatalf("%s: ticket subject = %v", step, ticket.Subject)
		}
	}
	if resp := e.Do(http.MethodPut, subjectPath(c.sector.ID, subject), c.supToken, map[string]any{"name": "Holerite", "moduleId": e.subjectModule(c.sector.ID)}); resp.Status != http.StatusOK {
		t.Fatalf("update: status %d", resp.Status)
	}
	wantSubjectOnTicket("after editing")
	if resp := e.Do(http.MethodDelete, subjectPath(c.sector.ID, subject), c.supToken, nil); resp.Status != http.StatusNoContent {
		t.Fatalf("delete: status %d", resp.Status)
	}
	wantSubjectOnTicket("after deleting")
}
