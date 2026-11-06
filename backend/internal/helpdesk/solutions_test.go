package helpdesk_test

import (
	"fmt"
	"net/http"
	"slices"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/gcaspp-labs/xet/backend/internal/db"
)

const solutionTaken = "Esta solução já está na lista deste assunto."

func solutionsPath(sectorID, subjectID int64) string {
	return fmt.Sprintf("/api/sectors/%d/subjects/%d/solutions", sectorID, subjectID)
}

func solutionPath(sectorID, subjectID, solutionID int64) string {
	return fmt.Sprintf("/api/sectors/%d/subjects/%d/solutions/%d", sectorID, subjectID, solutionID)
}

func (e *testEnv) createSolution(sectorID, subjectID int64, token, body string) int64 {
	e.T.Helper()
	resp := e.Do(http.MethodPost, solutionsPath(sectorID, subjectID), token, map[string]string{"body": body})
	if resp.Status != http.StatusCreated {
		e.T.Fatalf("create solution %q: status %d, body %v", body, resp.Status, resp.Body)
	}
	return id(resp.Body)
}

// solutionBodies lists the solutions of the subject straight from the database.
func (e *testEnv) solutionBodies(subjectID int64) []string {
	e.T.Helper()
	rows, err := e.Q.ListSubjectSolutions(e.T.Context(), subjectID)
	if err != nil {
		e.T.Fatal(err)
	}
	out := make([]string, len(rows))
	for i, r := range rows {
		out[i] = r.Body
	}
	return out
}

// subjectID returns the id of the subject of the sector with the name.
func (e *testEnv) subjectID(sectorID int64, name string) int64 {
	e.T.Helper()
	rows, err := e.Q.ListSubjects(e.T.Context(), sectorID)
	if err != nil {
		e.T.Fatal(err)
	}
	for _, r := range rows {
		if r.Name == name {
			return r.ID
		}
	}
	e.T.Fatalf("subject %q not found in %+v", name, rows)
	return 0
}

// solutionCreatedBy checks the only log of the only solution of the subject.
func (e *testEnv) wantSolutionCreatedBy(subjectID, actorID int64, body string) {
	e.T.Helper()
	rows, err := e.Q.ListSubjectSolutions(e.T.Context(), subjectID)
	if err != nil {
		e.T.Fatal(err)
	}
	if len(rows) != 1 {
		e.T.Fatalf("solutions = %+v, want one", rows)
	}
	logs, err := e.Q.ListAuditLogsByEntity(e.T.Context(), db.ListAuditLogsByEntityParams{EntityType: "subject_solution", EntityID: rows[0].ID})
	if err != nil {
		e.T.Fatal(err)
	}
	if len(logs) != 1 || logs[0].Action != "solution_created" || logs[0].ActorID == nil || *logs[0].ActorID != actorID {
		e.T.Fatalf("audit = %+v, want solution_created by %d", logs, actorID)
	}
	_, changes := e.AuditChanges("subject_solution", rows[0].ID)
	if changes[0]["body"]["to"] != body || changes[0]["subject_id"]["to"] != float64(subjectID) {
		e.T.Fatalf("changes = %v", changes[0])
	}
}

func wantSolutions(t *testing.T, got []string, want ...string) {
	t.Helper()
	if len(got) == 0 && len(want) == 0 {
		return
	}
	if !slices.Equal(got, want) {
		t.Fatalf("solutions = %q, want %q", got, want)
	}
}

// solutionsOf returns the bodies of the solutions of the subject in a list
// returned by the API.
func solutionsOf(t *testing.T, subjects []any, name string) []string {
	t.Helper()
	for _, s := range subjects {
		subject := s.(map[string]any)
		if subject["name"] != name {
			continue
		}
		list, ok := subject["solutions"].([]any)
		if !ok {
			t.Fatalf("solutions of %s = %v", name, subject["solutions"])
		}
		out := make([]string, len(list))
		for i, sol := range list {
			out[i] = sol.(map[string]any)["body"].(string)
		}
		return out
	}
	t.Fatalf("subject %s not in %v", name, subjects)
	return nil
}

func TestSupervisorManagesTheSolutionsOfASubject(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e := c.e
	sector := c.sector.ID
	subject := e.createSubject(sector, c.supToken, "Contracheque")

	resp := e.Do(http.MethodPost, solutionsPath(sector, subject), c.supToken, map[string]string{"body": "  Enviada a segunda via. "})
	if resp.Status != http.StatusCreated || resp.Body["body"] != "Enviada a segunda via." || resp.Body["subjectId"] != float64(subject) {
		t.Fatalf("create: status %d, body %v", resp.Status, resp.Body)
	}
	solution := id(resp.Body)
	e.createSolution(sector, subject, c.supToken, "Orientado a acessar o portal.")

	list := e.DoList(http.MethodGet, subjectsPath(sector), c.supToken)
	asAny := make([]any, len(list))
	for i, s := range list {
		asAny[i] = s
	}
	if got := solutionsOf(t, asAny, "Contracheque"); !slices.Equal(got, []string{"Enviada a segunda via.", "Orientado a acessar o portal."}) {
		t.Fatalf("list = %v", got)
	}

	// Salvar sem mudar nada não grava auditoria.
	if resp := e.Do(http.MethodPut, solutionPath(sector, subject, solution), c.supToken, map[string]string{"body": "Enviada a segunda via."}); resp.Status != http.StatusOK {
		t.Fatalf("update without changes: status %d", resp.Status)
	}
	resp = e.Do(http.MethodPut, solutionPath(sector, subject, solution), c.supToken, map[string]string{"body": "Segunda via enviada por e-mail."})
	if resp.Status != http.StatusOK || resp.Body["body"] != "Segunda via enviada por e-mail." {
		t.Fatalf("update: status %d, body %v", resp.Status, resp.Body)
	}
	// Mudar só as maiúsculas do próprio texto não é repetição.
	if resp := e.Do(http.MethodPut, solutionPath(sector, subject, solution), c.supToken, map[string]string{"body": "SEGUNDA VIA ENVIADA POR E-MAIL."}); resp.Status != http.StatusOK {
		t.Fatalf("update case: status %d, body %v", resp.Status, resp.Body)
	}
	// Renomear o assunto devolve as soluções dele.
	resp = e.Do(http.MethodPut, subjectPath(sector, subject), c.supToken, map[string]string{"name": "Holerite"})
	if got, ok := resp.Body["solutions"].([]any); resp.Status != http.StatusOK || !ok || len(got) != 2 {
		t.Fatalf("rename subject: status %d, body %v", resp.Status, resp.Body)
	}

	if resp := e.Do(http.MethodDelete, solutionPath(sector, subject, solution), c.supToken, nil); resp.Status != http.StatusNoContent {
		t.Fatalf("delete: status %d, body %v", resp.Status, resp.Body)
	}
	wantSolutions(t, e.solutionBodies(subject), "Orientado a acessar o portal.")
	if resp := e.Do(http.MethodDelete, solutionPath(sector, subject, solution), c.supToken, nil); resp.Status != http.StatusNotFound {
		t.Fatalf("delete again: status %d", resp.Status)
	}

	actions, changes := e.AuditChanges("subject_solution", solution)
	if want := []string{"solution_created", "solution_updated", "solution_updated", "solution_deleted"}; !slices.Equal(actions, want) {
		t.Fatalf("actions = %v, want %v", actions, want)
	}
	subjectID := float64(subject)
	created, edited, deleted := changes[0], changes[1], changes[3]
	if created["body"]["to"] != "Enviada a segunda via." || created["subject_id"]["to"] != subjectID {
		t.Fatalf("created = %v", created)
	}
	if edited["body"]["from"] != "Enviada a segunda via." || edited["body"]["to"] != "Segunda via enviada por e-mail." || edited["subject_id"]["to"] != subjectID {
		t.Fatalf("edited = %v", edited)
	}
	if deleted["body"]["from"] != "SEGUNDA VIA ENVIADA POR E-MAIL." || deleted["body"]["to"] != nil || deleted["subject_id"]["from"] != subjectID {
		t.Fatalf("deleted = %v", deleted)
	}
	sup, err := e.Q.GetUserByEmail(t.Context(), "sup@exemplo.com")
	if err != nil {
		t.Fatal(err)
	}
	logs, err := e.Q.ListAuditLogsByEntity(t.Context(), db.ListAuditLogsByEntityParams{EntityType: "subject_solution", EntityID: solution})
	if err != nil {
		t.Fatal(err)
	}
	for _, l := range logs {
		if l.ActorID == nil || *l.ActorID != sup.ID {
			t.Fatalf("%s by %v, want %d", l.Action, l.ActorID, sup.ID)
		}
	}
}

func TestSolutionPermissionsBySector(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e := c.e
	sector := c.sector.ID
	compras := e.Sector("Compras")
	e.User("sup.compras@exemplo.com", db.UserRoleSupervisor, &compras.ID)
	otherSup := e.Login("sup.compras@exemplo.com", testPassword)
	subject := e.createSubject(sector, c.supToken, "Contracheque")
	solution := e.createSolution(sector, subject, c.supToken, "Enviada a segunda via.")

	for name, token := range map[string]string{
		"agent of the sector":     c.anaToken,
		"agent of another sector": c.rhToken,
		"supervisor of another":   otherSup,
	} {
		for _, req := range []struct {
			method, path string
			body         any
		}{
			{http.MethodPost, solutionsPath(sector, subject), map[string]string{"body": "Nova"}},
			{http.MethodPut, solutionPath(sector, subject, solution), map[string]string{"body": "Nova"}},
			{http.MethodDelete, solutionPath(sector, subject, solution), nil},
		} {
			if resp := e.Do(req.method, req.path, token, req.body); resp.Status != http.StatusForbidden {
				t.Errorf("%s %s %s: status %d", name, req.method, req.path, resp.Status)
			}
		}
	}
	if resp := e.Do(http.MethodPost, solutionsPath(sector, subject), "", map[string]string{"body": "Nova"}); resp.Status != http.StatusUnauthorized {
		t.Fatalf("no session: status %d", resp.Status)
	}
	wantSolutions(t, e.solutionBodies(subject), "Enviada a segunda via.")

	// O administrador gerencia todos os setores.
	inCompras := e.createSubject(compras.ID, c.adminToken, "Licitação")
	other := e.createSolution(compras.ID, inCompras, c.adminToken, "Publicado o edital.")
	if resp := e.Do(http.MethodPut, solutionPath(compras.ID, inCompras, other), c.adminToken, map[string]string{"body": "Edital publicado."}); resp.Status != http.StatusOK {
		t.Fatalf("admin update: status %d", resp.Status)
	}
	if resp := e.Do(http.MethodDelete, solutionPath(sector, subject, solution), c.adminToken, nil); resp.Status != http.StatusNoContent {
		t.Fatalf("admin delete: status %d", resp.Status)
	}

	// O assunto precisa ser do setor da rota, e a solução, do assunto da rota.
	for _, req := range []struct {
		method, path string
		body         any
	}{
		{http.MethodPost, solutionsPath(sector, inCompras), map[string]string{"body": "X"}},
		{http.MethodPut, solutionPath(sector, inCompras, other), map[string]string{"body": "X"}},
		{http.MethodDelete, solutionPath(sector, inCompras, other), nil},
		{http.MethodPut, solutionPath(sector, subject, other), map[string]string{"body": "X"}},
		{http.MethodDelete, solutionPath(sector, subject, other), nil},
	} {
		if resp := e.Do(req.method, req.path, c.adminToken, req.body); resp.Status != http.StatusNotFound {
			t.Errorf("%s %s: status %d, body %v", req.method, req.path, resp.Status, resp.Body)
		}
	}
	// O supervisor do outro setor também não alcança o assunto pelo próprio setor.
	if resp := e.Do(http.MethodPost, solutionsPath(compras.ID, subject), otherSup, map[string]string{"body": "X"}); resp.Status != http.StatusNotFound {
		t.Fatalf("subject of another sector by its supervisor: status %d", resp.Status)
	}
	wantSolutions(t, e.solutionBodies(inCompras), "Edital publicado.")
}

func TestSolutionsAreValidatedAndDoNotRepeatInTheSubject(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e := c.e
	sector := c.sector.ID
	subject := e.createSubject(sector, c.supToken, "Contracheque")
	e.createSolution(sector, subject, c.supToken, "Enviada a segunda via.")
	other := e.createSolution(sector, subject, c.supToken, "Orientado a acessar o portal.")

	resp := e.Do(http.MethodPost, solutionsPath(sector, subject), c.supToken, map[string]string{"body": " ENVIADA A SEGUNDA VIA. "})
	if resp.Status != http.StatusConflict || resp.Body["error"] != solutionTaken {
		t.Fatalf("create repeated: status %d, body %v", resp.Status, resp.Body)
	}
	resp = e.Do(http.MethodPut, solutionPath(sector, subject, other), c.supToken, map[string]string{"body": "enviada a segunda via."})
	if resp.Status != http.StatusConflict || resp.Body["error"] != solutionTaken {
		t.Fatalf("update repeated: status %d, body %v", resp.Status, resp.Body)
	}

	// O mesmo texto vale em outro assunto.
	ferias := e.createSubject(sector, c.supToken, "Férias")
	e.createSolution(sector, ferias, c.supToken, "Enviada a segunda via.")

	// Em branco e acima do limite, contando caracteres e não bytes.
	if resp := e.Do(http.MethodPost, solutionsPath(sector, subject), c.supToken, map[string]string{"body": "   "}); resp.Status != http.StatusUnprocessableEntity {
		t.Fatalf("blank: status %d", resp.Status)
	}
	if resp := e.Do(http.MethodPost, solutionsPath(sector, subject), c.supToken, map[string]string{"body": strings.Repeat("é", 10001)}); resp.Status != http.StatusUnprocessableEntity {
		t.Fatalf("over the limit: status %d", resp.Status)
	}
	if resp := e.Do(http.MethodPut, solutionPath(sector, subject, other), c.supToken, map[string]string{"body": strings.Repeat("é", 10001)}); resp.Status != http.StatusUnprocessableEntity {
		t.Fatalf("update over the limit: status %d", resp.Status)
	}

	// Textos longos passam pelo índice único, que guarda só o resumo do texto.
	long := strings.Repeat("Texto longo de solução, sem repetição. ", 100)[:3900] + "fim"
	e.createSolution(sector, subject, c.supToken, long)
	resp = e.Do(http.MethodPost, solutionsPath(sector, subject), c.supToken, map[string]string{"body": strings.ToUpper(long)})
	if resp.Status != http.StatusConflict {
		t.Fatalf("long repeated: status %d, body %v", resp.Status, resp.Body)
	}
	e.createSolution(sector, subject, c.supToken, strings.Repeat("é", 10000))
}

func TestConcurrentSolutionCreationsLetOneThrough(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e := c.e
	subject := e.createSubject(c.sector.ID, c.supToken, "Contracheque")

	const attempts = 6
	statuses := make([]int, attempts)
	var wg sync.WaitGroup
	for i := range attempts {
		wg.Go(func() {
			body := "Enviada a segunda via."
			if i%2 == 0 {
				body = "ENVIADA A SEGUNDA VIA."
			}
			statuses[i] = e.Do(http.MethodPost, solutionsPath(c.sector.ID, subject), c.supToken, map[string]string{"body": body}).Status
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
	if created != 1 || e.Count("subject_solutions") != 1 {
		t.Fatalf("statuses = %v, solutions = %d", statuses, e.Count("subject_solutions"))
	}
}

func TestDeletingASubjectDeletesItsSolutionsAndKeepsTheirText(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e := c.e
	sector := c.sector.ID
	subject := e.createSubject(sector, c.supToken, "Contracheque")
	e.createSolution(sector, subject, c.supToken, "Orientado a acessar o portal.")
	e.createSolution(sector, subject, c.supToken, "Enviada a segunda via.")
	kept := e.createSubject(sector, c.supToken, "Férias")
	e.createSolution(sector, kept, c.supToken, "Agendadas.")

	if resp := e.Do(http.MethodDelete, subjectPath(sector, subject), c.supToken, nil); resp.Status != http.StatusNoContent {
		t.Fatalf("delete: status %d, body %v", resp.Status, resp.Body)
	}
	if n := e.Count("subject_solutions"); n != 1 {
		t.Fatalf("solutions = %d, want only the one of the other subject", n)
	}
	actions, changes := e.AuditChanges("subject", subject)
	if actions[len(actions)-1] != "subject_deleted" {
		t.Fatalf("actions = %v", actions)
	}
	deleted := changes[len(changes)-1]
	got, ok := deleted["solutions"]["from"].([]any)
	if !ok || len(got) != 2 || got[0] != "Enviada a segunda via." || got[1] != "Orientado a acessar o portal." || deleted["solutions"]["to"] != nil {
		t.Fatalf("deleted = %v", deleted)
	}
	// Excluir o assunto não grava um registro por solução.
	var perSolution int
	if err := e.Pool.QueryRow(t.Context(), "select count(*) from audit_logs where action = 'solution_deleted'").Scan(&perSolution); err != nil {
		t.Fatal(err)
	}
	if perSolution != 0 {
		t.Fatalf("solution_deleted logs = %d", perSolution)
	}

	// Sem soluções, a lista vazia fica registrada.
	empty := e.createSubject(sector, c.supToken, "Admissão")
	if resp := e.Do(http.MethodDelete, subjectPath(sector, empty), c.supToken, nil); resp.Status != http.StatusNoContent {
		t.Fatalf("delete empty: status %d", resp.Status)
	}
	_, changes = e.AuditChanges("subject", empty)
	if got, ok := changes[len(changes)-1]["solutions"]["from"].([]any); !ok || len(got) != 0 {
		t.Fatalf("deleted empty = %v", changes[len(changes)-1])
	}
}

func TestClosingFormReturnsTheSolutionsOfEachSubject(t *testing.T) {
	t.Parallel()
	c := newClosing(t)
	e := c.e
	subject := e.createSubject(c.sector.ID, c.supToken, "Contracheque")
	e.createSolution(c.sector.ID, subject, c.supToken, "Orientado a acessar o portal.")
	e.createSolution(c.sector.ID, subject, c.supToken, "Enviada a segunda via.")
	e.createSubject(c.sector.ID, c.supToken, "Férias")

	resp := e.Do(http.MethodGet, fmt.Sprintf("/api/tickets/%d/closing-form", c.ticket.ID), c.anaToken, nil)
	if resp.Status != http.StatusOK {
		t.Fatalf("closing form: status %d, body %v", resp.Status, resp.Body)
	}
	subjects, _ := resp.Body["subjects"].([]any)
	if got := solutionsOf(t, subjects, "Contracheque"); !slices.Equal(got, []string{"Enviada a segunda via.", "Orientado a acessar o portal."}) {
		t.Fatalf("solutions = %v", got)
	}
	if got := solutionsOf(t, subjects, "Férias"); len(got) != 0 {
		t.Fatalf("solutions of Férias = %v", got)
	}
}

func TestClosingWithAddSolutionAddsItToTheListOfTheSubject(t *testing.T) {
	t.Parallel()
	c := newClosing(t)
	e := c.e
	c.register()
	subject := e.createSubject(c.sector.ID, c.supToken, "Contracheque")

	form := with(with(c.form(c.org), "resolution", "  Enviada por e-mail.  "), "addSolution", true)
	if resp := e.closeForm(c.ticket.ID, c.anaToken, form); resp.Status != http.StatusOK {
		t.Fatalf("close: status %d, body %v", resp.Status, resp.Body)
	}
	wantSolutions(t, e.solutionBodies(subject), "Enviada por e-mail.")
	e.wantSolutionCreatedBy(subject, c.ana.ID, "Enviada por e-mail.")
}

func TestClosingWithoutAddSolutionLeavesTheListAlone(t *testing.T) {
	t.Parallel()
	c := newClosing(t)
	e := c.e
	c.register()
	e.createSubject(c.sector.ID, c.supToken, "Contracheque")

	if resp := e.closeForm(c.ticket.ID, c.anaToken, with(c.form(c.org), "addSubject", true)); resp.Status != http.StatusOK {
		t.Fatalf("close: status %d, body %v", resp.Status, resp.Body)
	}
	if n := e.Count("subject_solutions"); n != 0 {
		t.Fatalf("solutions = %d", n)
	}
}

func TestAddSolutionWithAddSubjectAddsBoth(t *testing.T) {
	t.Parallel()
	c := newClosing(t)
	e := c.e
	c.register()

	form := with(with(with(c.form(c.org), "subject", "Segunda via"), "addSubject", true), "addSolution", true)
	if resp := e.closeForm(c.ticket.ID, c.anaToken, form); resp.Status != http.StatusOK {
		t.Fatalf("close: status %d, body %v", resp.Status, resp.Body)
	}
	wantSubjects(t, e.subjectNames(c.sector.ID), "Segunda via")
	subject := e.subjectID(c.sector.ID, "Segunda via")
	wantSolutions(t, e.solutionBodies(subject), "Enviada a segunda via.")
	e.wantSolutionCreatedBy(subject, c.ana.ID, "Enviada a segunda via.")
}

func TestAddSolutionAlreadyOnTheListKeepsItAndSaves(t *testing.T) {
	t.Parallel()
	c := newClosing(t)
	e := c.e
	c.register()
	subject := e.createSubject(c.sector.ID, c.supToken, "Contracheque")
	solution := e.createSolution(c.sector.ID, subject, c.supToken, "Enviada a segunda via.")

	form := with(with(c.form(c.org), "resolution", "ENVIADA A SEGUNDA VIA."), "addSolution", true)
	if resp := e.closeForm(c.ticket.ID, c.anaToken, form); resp.Status != http.StatusOK {
		t.Fatalf("close: status %d, body %v", resp.Status, resp.Body)
	}
	wantSolutions(t, e.solutionBodies(subject), "Enviada a segunda via.")
	if actions, _ := e.AuditChanges("subject_solution", solution); !slices.Equal(actions, []string{"solution_created"}) {
		t.Fatalf("actions = %v", actions)
	}
}

func TestAddSolutionWithASubjectOffTheListSavesWithoutAdding(t *testing.T) {
	t.Parallel()
	c := newClosing(t)
	e := c.e
	c.register()
	// O assunto do formulário não está na lista, e o pedido não o adiciona.
	e.createSubject(c.sector.ID, c.supToken, "Férias")

	if resp := e.closeForm(c.ticket.ID, c.anaToken, with(c.form(c.org), "addSolution", true)); resp.Status != http.StatusOK {
		t.Fatalf("close: status %d, body %v", resp.Status, resp.Body)
	}
	if n := e.Count("subject_solutions"); n != 0 {
		t.Fatalf("solutions = %d", n)
	}
	if got := e.assignment(c.ticket.ID); got.Status != "closed" {
		t.Fatalf("ticket = %+v", got)
	}
}

func TestAddSolutionWhileTheSubjectIsDeletedSavesWithoutAdding(t *testing.T) {
	t.Parallel()
	c := newClosing(t)
	e := c.e
	c.register()
	subject := e.createSubject(c.sector.ID, c.supToken, "Contracheque")

	// Outra transação exclui o assunto: ela o trava antes, e o encerramento
	// espera por ela ao segurar o assunto para gravar a solução.
	tx, err := e.Pool.Begin(t.Context())
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = tx.Rollback(t.Context()) }()
	if _, err := tx.Exec(t.Context(), "select id from subjects where id = $1 for update", subject); err != nil {
		t.Fatal(err)
	}

	done := make(chan response, 1)
	go func() {
		done <- e.closeForm(c.ticket.ID, c.anaToken, with(c.form(c.org), "addSolution", true))
	}()
	deadline := time.Now().Add(10 * time.Second)
	for {
		var waiting int
		if err := e.Pool.QueryRow(t.Context(), `
			select count(*) from pg_stat_activity
			where wait_event_type = 'Lock' and query like '%for share%' and datname = current_database()`).Scan(&waiting); err != nil {
			t.Fatal(err)
		}
		if waiting > 0 {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("the closing did not wait for the subject")
		}
		time.Sleep(20 * time.Millisecond)
	}
	if _, err := tx.Exec(t.Context(), "delete from subjects where id = $1", subject); err != nil {
		t.Fatal(err)
	}
	if err := tx.Commit(t.Context()); err != nil {
		t.Fatal(err)
	}

	resp := <-done
	if resp.Status != http.StatusOK {
		t.Fatalf("close: status %d, body %v", resp.Status, resp.Body)
	}
	if n := e.Count("subject_solutions"); n != 0 {
		t.Fatalf("solutions = %d", n)
	}
	ticket, err := e.Q.GetTicket(t.Context(), c.ticket.ID)
	if err != nil {
		t.Fatal(err)
	}
	if ticket.Status != db.TicketStatusClosed || ticket.Resolution == nil || *ticket.Resolution != "Enviada a segunda via." {
		t.Fatalf("ticket = %s, resolution %v", ticket.Status, ticket.Resolution)
	}
}

func TestConcurrentClosingsWithTheSameNewSolutionAreBothSaved(t *testing.T) {
	t.Parallel()
	c := newClosing(t)
	e := c.e
	c.register()
	subject := e.createSubject(c.sector.ID, c.supToken, "Contracheque")
	second := e.queuedTicket(c.sector.ID, "MSG-2", "5511977776666")
	resp := e.Do(http.MethodPut, fmt.Sprintf("/api/contacts/%d", second.ContactID), c.biaToken,
		map[string]any{"name": "João", "phone": "5511977776666", "organizationId": c.org, "sectorIds": []int64{c.sector.ID}})
	if resp.Status != http.StatusOK {
		t.Fatalf("register contact: status %d, body %v", resp.Status, resp.Body)
	}
	if resp := e.assign(second.ID, c.biaToken); resp.Status != http.StatusOK {
		t.Fatalf("assign: status %d", resp.Status)
	}

	form := with(c.form(c.org), "addSolution", true)
	var first, other response
	var wg sync.WaitGroup
	wg.Go(func() {
		first = e.closeForm(c.ticket.ID, c.anaToken, form)
	})
	wg.Go(func() {
		other = e.closeForm(second.ID, c.biaToken, with(form, "resolution", "enviada a segunda via."))
	})
	wg.Wait()
	if first.Status != http.StatusOK || other.Status != http.StatusOK {
		t.Fatalf("statuses = %d (%v), %d (%v)", first.Status, first.Body, other.Status, other.Body)
	}
	if n := len(e.solutionBodies(subject)); n != 1 {
		t.Fatalf("solutions = %d, want one", n)
	}
	var logs int
	if err := e.Pool.QueryRow(t.Context(), "select count(*) from audit_logs where action = 'solution_created'").Scan(&logs); err != nil {
		t.Fatal(err)
	}
	if logs != 1 {
		t.Fatalf("solution_created logs = %d", logs)
	}
	for _, ticket := range []int64{c.ticket.ID, second.ID} {
		if got := e.assignment(ticket); got.Status != "closed" {
			t.Fatalf("ticket %d = %+v", ticket, got)
		}
	}
}

func TestRefusedClosingAddsNoSolution(t *testing.T) {
	t.Parallel()
	c := newClosing(t)
	e := c.e
	e.createSubject(c.sector.ID, c.supToken, "Contracheque")
	form := with(with(c.form(c.org), "addSubject", true), "addSolution", true)

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
	if n := e.Count("subject_solutions"); n != 0 {
		t.Fatalf("solutions = %d", n)
	}
}

func TestTransferWithAddSolutionAddsItToTheListOfTheOrigin(t *testing.T) {
	t.Parallel()
	c := newSectorTransfer(t)
	e := c.e
	subject := e.createSubject(c.sector.ID, c.supToken, "Contracheque")

	// Sem addSolution, nada entra; a transferência recusada também não deixa item.
	e.connectSector(c.rh)
	e.receive(c.rh, text("RH-1", "5511988887777@s.whatsapp.net", "5511988887777", "Férias"))
	if resp := e.transferSector(c.ticket.ID, c.anaToken, with(c.transferForm(c.rh), "addSolution", true)); resp.Status != http.StatusConflict {
		t.Fatalf("refused transfer: status %d, body %v", resp.Status, resp.Body)
	}
	if n := e.Count("subject_solutions"); n != 0 {
		t.Fatalf("solutions after refusal = %d", n)
	}

	other := e.Sector("Compras")
	if resp := e.transferSector(c.ticket.ID, c.anaToken, with(c.transferForm(other.ID), "addSolution", true)); resp.Status != http.StatusOK {
		t.Fatalf("transfer: status %d, body %v", resp.Status, resp.Body)
	}
	wantSolutions(t, e.solutionBodies(subject), "Enviada a segunda via.")
	e.wantSolutionCreatedBy(subject, c.ana.ID, "Enviada a segunda via.")
}

func TestTransferWithoutAddSolutionLeavesTheListAlone(t *testing.T) {
	t.Parallel()
	c := newSectorTransfer(t)
	c.e.createSubject(c.sector.ID, c.supToken, "Contracheque")
	if resp := c.e.transferSector(c.ticket.ID, c.anaToken, c.transferForm(c.rh)); resp.Status != http.StatusOK {
		t.Fatalf("transfer: status %d, body %v", resp.Status, resp.Body)
	}
	if n := c.e.Count("subject_solutions"); n != 0 {
		t.Fatalf("solutions = %d", n)
	}
}

func TestCorrectionWithAddSolutionAddsItToTheList(t *testing.T) {
	t.Parallel()
	c := newCorrection(t)
	e := c.e
	subject := e.createSubject(c.sector.ID, c.supToken, "Contracheque")
	sup, err := e.Q.GetUserByEmail(t.Context(), "sup@exemplo.com")
	if err != nil {
		t.Fatal(err)
	}

	// Sem addSolution, nada entra.
	body := with(c.data("Resolução incompleta."), "resolution", "Enviada por e-mail.")
	if resp := e.correct(c.ticket.ID, c.supToken, body); resp.Status != http.StatusOK {
		t.Fatalf("correct: status %d, body %v", resp.Status, resp.Body)
	}
	if n := e.Count("subject_solutions"); n != 0 {
		t.Fatalf("solutions = %d", n)
	}

	// A correção recusada, aqui por não alterar nada, não deixa item.
	if resp := e.correct(c.ticket.ID, c.supToken, with(body, "addSolution", true)); resp.Status != http.StatusUnprocessableEntity {
		t.Fatalf("no changes: status %d, body %v", resp.Status, resp.Body)
	}
	if n := e.Count("subject_solutions"); n != 0 {
		t.Fatalf("solutions = %d", n)
	}

	body = with(with(body, "resolution", "Enviada pelo portal."), "addSolution", true)
	if resp := e.correct(c.ticket.ID, c.supToken, body); resp.Status != http.StatusOK {
		t.Fatalf("correct: status %d, body %v", resp.Status, resp.Body)
	}
	wantSolutions(t, e.solutionBodies(subject), "Enviada pelo portal.")
	e.wantSolutionCreatedBy(subject, sup.ID, "Enviada pelo portal.")

	// Com o assunto novo também adicionado, entram os dois.
	body = with(with(with(body, "subject", "Holerite"), "addSubject", true), "resolution", "Reenviada.")
	if resp := e.correct(c.ticket.ID, c.supToken, body); resp.Status != http.StatusOK {
		t.Fatalf("correct with subject: status %d, body %v", resp.Status, resp.Body)
	}
	wantSolutions(t, e.solutionBodies(e.subjectID(c.sector.ID, "Holerite")), "Reenviada.")
}

func TestEditingOrDeletingASolutionDoesNotChangeTickets(t *testing.T) {
	t.Parallel()
	c := newCorrection(t)
	e := c.e
	subject := e.createSubject(c.sector.ID, c.supToken, "Contracheque")
	solution := e.createSolution(c.sector.ID, subject, c.supToken, "Enviada a segunda via.")

	wantResolutionOnTicket := func(step string) {
		t.Helper()
		ticket, err := e.Q.GetTicket(t.Context(), c.ticket.ID)
		if err != nil {
			t.Fatal(err)
		}
		if ticket.Resolution == nil || *ticket.Resolution != "Enviada a segunda via." {
			t.Fatalf("%s: ticket resolution = %v", step, ticket.Resolution)
		}
	}
	if resp := e.Do(http.MethodPut, solutionPath(c.sector.ID, subject, solution), c.supToken, map[string]string{"body": "Outra."}); resp.Status != http.StatusOK {
		t.Fatalf("update: status %d", resp.Status)
	}
	wantResolutionOnTicket("after editing")
	if resp := e.Do(http.MethodDelete, solutionPath(c.sector.ID, subject, solution), c.supToken, nil); resp.Status != http.StatusNoContent {
		t.Fatalf("delete: status %d", resp.Status)
	}
	wantResolutionOnTicket("after deleting")
}

func TestResolutionOverTheLimitDoesNotEnterAndTheFormIsSaved(t *testing.T) {
	t.Parallel()
	long := strings.Repeat("é", 10001)
	exact := strings.Repeat("é", 10000)
	wantResolution := func(t *testing.T, e *testEnv, ticketID int64, want string) {
		t.Helper()
		ticket, err := e.Q.GetTicket(t.Context(), ticketID)
		if err != nil {
			t.Fatal(err)
		}
		if ticket.Status != db.TicketStatusClosed || ticket.Resolution == nil || *ticket.Resolution != want {
			t.Fatalf("ticket = %s, resolution of %d runes", ticket.Status, len([]rune(deref(ticket.Resolution))))
		}
	}

	t.Run("closing", func(t *testing.T) {
		t.Parallel()
		c := newClosing(t)
		c.register()
		c.e.createSubject(c.sector.ID, c.supToken, "Contracheque")
		form := with(with(c.form(c.org), "resolution", long), "addSolution", true)
		if resp := c.e.closeForm(c.ticket.ID, c.anaToken, form); resp.Status != http.StatusOK {
			t.Fatalf("close: status %d, body %v", resp.Status, resp.Body)
		}
		if n := c.e.Count("subject_solutions"); n != 0 {
			t.Fatalf("solutions = %d", n)
		}
		wantResolution(t, c.e, c.ticket.ID, long)
	})
	t.Run("transfer", func(t *testing.T) {
		t.Parallel()
		c := newSectorTransfer(t)
		c.e.createSubject(c.sector.ID, c.supToken, "Contracheque")
		form := with(with(c.transferForm(c.rh), "resolution", long), "addSolution", true)
		if resp := c.e.transferSector(c.ticket.ID, c.anaToken, form); resp.Status != http.StatusOK {
			t.Fatalf("transfer: status %d, body %v", resp.Status, resp.Body)
		}
		if n := c.e.Count("subject_solutions"); n != 0 {
			t.Fatalf("solutions = %d", n)
		}
		wantResolution(t, c.e, c.ticket.ID, long)
	})
	t.Run("correction", func(t *testing.T) {
		t.Parallel()
		c := newCorrection(t)
		c.e.createSubject(c.sector.ID, c.supToken, "Contracheque")
		body := with(with(c.data("Resolução incompleta."), "resolution", long), "addSolution", true)
		if resp := c.e.correct(c.ticket.ID, c.anaToken, body); resp.Status != http.StatusOK {
			t.Fatalf("correct: status %d, body %v", resp.Status, resp.Body)
		}
		if n := c.e.Count("subject_solutions"); n != 0 {
			t.Fatalf("solutions = %d", n)
		}
		wantResolution(t, c.e, c.ticket.ID, long)
	})
	t.Run("exactly at the limit enters", func(t *testing.T) {
		t.Parallel()
		c := newClosing(t)
		c.register()
		subject := c.e.createSubject(c.sector.ID, c.supToken, "Contracheque")
		form := with(with(c.form(c.org), "resolution", exact), "addSolution", true)
		if resp := c.e.closeForm(c.ticket.ID, c.anaToken, form); resp.Status != http.StatusOK {
			t.Fatalf("close: status %d, body %v", resp.Status, resp.Body)
		}
		wantSolutions(t, c.e.solutionBodies(subject), exact)
		wantResolution(t, c.e, c.ticket.ID, exact)
	})
}

func deref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
