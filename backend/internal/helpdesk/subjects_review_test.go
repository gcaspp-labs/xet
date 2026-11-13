package helpdesk_test

import (
	"fmt"
	"net/http"
	"slices"
	"testing"

	"github.com/gcaspp-labs/xet/backend/internal/db"
)

func TestSubjectEditingWithInactiveModules(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e := c.e
	current, err := e.Q.CreateModule(t.Context(), db.CreateModuleParams{SectorID: c.sector.ID, Name: "Atual"})
	if err != nil {
		t.Fatal(err)
	}
	other, err := e.Q.CreateModule(t.Context(), db.CreateModuleParams{SectorID: c.sector.ID, Name: "Outro"})
	if err != nil {
		t.Fatal(err)
	}
	created := e.Do(http.MethodPost, subjectsPath(c.sector.ID), c.supToken, map[string]any{"name": "Senha", "moduleId": current.ID})
	if created.Status != http.StatusCreated {
		t.Fatalf("create: %d %v", created.Status, created.Body)
	}
	subjectID := id(created.Body)
	if _, err := e.Q.UpdateModule(t.Context(), db.UpdateModuleParams{ID: other.ID, Name: other.Name, Active: false}); err != nil {
		t.Fatal(err)
	}
	resp := e.Do(http.MethodPut, subjectPath(c.sector.ID, subjectID), c.supToken, map[string]any{"name": "Alterado", "moduleId": other.ID})
	if resp.Status != http.StatusUnprocessableEntity {
		t.Fatalf("move to inactive: %d %v", resp.Status, resp.Body)
	}
	list := e.DoList(http.MethodGet, subjectsPath(c.sector.ID), c.supToken)
	if len(list) != 1 || list[0]["name"] != "Senha" || list[0]["moduleId"] != float64(current.ID) {
		t.Fatalf("rejected edit changed subject: %v", list)
	}
	if _, err := e.Q.UpdateModule(t.Context(), db.UpdateModuleParams{ID: current.ID, Name: current.Name, Active: false}); err != nil {
		t.Fatal(err)
	}
	resp = e.Do(http.MethodPut, subjectPath(c.sector.ID, subjectID), c.supToken, map[string]any{"name": "Alterado", "moduleId": current.ID})
	if resp.Status != http.StatusOK || resp.Body["name"] != "Alterado" || resp.Body["moduleId"] != float64(current.ID) {
		t.Fatalf("keep inactive: %d %v", resp.Status, resp.Body)
	}
}

func TestSubjectAuditRecordsModuleOnCreationAndChange(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e := c.e
	a, err := e.Q.CreateModule(t.Context(), db.CreateModuleParams{SectorID: c.sector.ID, Name: "A"})
	if err != nil {
		t.Fatal(err)
	}
	b, err := e.Q.CreateModule(t.Context(), db.CreateModuleParams{SectorID: c.sector.ID, Name: "B"})
	if err != nil {
		t.Fatal(err)
	}
	resp := e.Do(http.MethodPost, subjectsPath(c.sector.ID), c.supToken, map[string]any{"name": "Senha", "moduleId": a.ID})
	if resp.Status != http.StatusCreated {
		t.Fatalf("create: %d %v", resp.Status, resp.Body)
	}
	subjectID := id(resp.Body)
	resp = e.Do(http.MethodPut, subjectPath(c.sector.ID, subjectID), c.supToken, map[string]any{"name": "Senha", "moduleId": b.ID})
	if resp.Status != http.StatusOK {
		t.Fatalf("update: %d %v", resp.Status, resp.Body)
	}
	actions, changes := e.AuditChanges("subject", subjectID)
	if !slices.Equal(actions, []string{"subject_created", "subject_updated"}) {
		t.Fatalf("actions: %v", actions)
	}
	if changes[0]["module_id"]["from"] != nil || changes[0]["module_id"]["to"] != float64(a.ID) ||
		changes[1]["module_id"]["from"] != float64(a.ID) || changes[1]["module_id"]["to"] != float64(b.ID) {
		t.Fatalf("module audit: %v", changes)
	}
}

func TestAddingSubjectRejectsChosenModuleDeactivatedBeforeSave(t *testing.T) {
	for _, flow := range []string{"close", "transfer", "correction"} {
		t.Run(flow, func(t *testing.T) {
			t.Parallel()
			var c closing
			var body map[string]any
			var save func() response
			if flow == "correction" {
				corrected := newCorrection(t)
				c = corrected.closing
				body = with(corrected.data("Corrigir assunto"), "subject", "Novo assunto")
				save = func() response { return c.e.correct(c.ticket.ID, c.anaToken, body) }
			} else {
				transfer := newSectorTransfer(t)
				c = transfer.closing
				body = transfer.transferForm(transfer.rh)
				if flow == "transfer" {
					save = func() response { return c.e.transferSector(c.ticket.ID, c.anaToken, body) }
				} else {
					save = func() response { return c.e.closeForm(c.ticket.ID, c.anaToken, body) }
				}
			}
			body["addSubject"] = true
			body["subjectModuleId"] = c.modules[0]
			path := fmt.Sprintf("/api/tickets/%d", c.ticket.ID)
			before := c.e.Do(http.MethodGet, path, c.anaToken, nil).Body
			actionsBefore, _ := c.e.AuditChanges("ticket", c.ticket.ID)
			modulesBefore := c.e.DoList(http.MethodGet, path+"/modules", c.anaToken)
			if _, err := c.e.Q.UpdateModule(t.Context(), db.UpdateModuleParams{ID: c.modules[0], Name: "Folha", Active: false}); err != nil {
				t.Fatal(err)
			}
			resp := save()
			if resp.Status != http.StatusUnprocessableEntity {
				t.Fatalf("deactivated selection: %d %v", resp.Status, resp.Body)
			}
			after := c.e.Do(http.MethodGet, path, c.anaToken, nil).Body
			actionsAfter, _ := c.e.AuditChanges("ticket", c.ticket.ID)
			modulesAfter := c.e.DoList(http.MethodGet, path+"/modules", c.anaToken)
			if after["status"] != before["status"] || after["subject"] != before["subject"] || after["resolution"] != before["resolution"] ||
				!slices.Equal(actionsBefore, actionsAfter) || len(modulesAfter) != len(modulesBefore) || c.e.Count("subjects") != 0 {
				t.Fatalf("rejected save changed data: before %v after %v audit %v/%v modules %v/%v", before, after, actionsBefore, actionsAfter, modulesBefore, modulesAfter)
			}
			body["subjectModuleId"] = c.modules[1]
			if flow != "correction" {
				body["moduleIds"] = []int64{c.modules[1]}
			}
			resp = save()
			if resp.Status != http.StatusOK {
				t.Fatalf("retry with active module: %d %v", resp.Status, resp.Body)
			}
			subjects := c.e.DoList(http.MethodGet, subjectsPath(c.sector.ID), c.supToken)
			if len(subjects) != 1 || subjects[0]["moduleId"] != float64(c.modules[1]) {
				t.Fatalf("subject after retry: %v", subjects)
			}
		})
	}
}
