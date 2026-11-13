package helpdesk_test

import (
	"fmt"
	"net/http"
	"testing"

	"github.com/gcaspp-labs/xet/backend/internal/db"
)

func TestCorrectionKeepsInactiveModulesWhenSubjectIsUnchanged(t *testing.T) {
	t.Parallel()
	c := newCorrection(t)
	for i, name := range []string{"Folha", "Patrimônio"} {
		if _, err := c.e.Q.UpdateModule(t.Context(), db.UpdateModuleParams{ID: c.modules[i], Name: name, Active: false}); err != nil {
			t.Fatal(err)
		}
	}
	body := with(c.data("Corrigir resolução"), "resolution", "Resolução corrigida")
	resp := c.e.correct(c.ticket.ID, c.anaToken, body)
	if resp.Status != http.StatusOK {
		t.Fatalf("correction with historical modules: %d %v", resp.Status, resp.Body)
	}
}

func TestCorrectionRequiresAnActiveSelectedModule(t *testing.T) {
	t.Parallel()
	c := newCorrection(t)
	for i, name := range []string{"Folha", "Patrimônio"} {
		if _, err := c.e.Q.UpdateModule(t.Context(), db.UpdateModuleParams{ID: c.modules[i], Name: name, Active: false}); err != nil {
			t.Fatal(err)
		}
	}
	body := with(c.data("Corrigir assunto"), "subject", "Outro assunto")
	body["addSubject"] = true
	resp := c.e.correct(c.ticket.ID, c.anaToken, body)
	if resp.Status != http.StatusUnprocessableEntity {
		t.Fatalf("correction without active module: %d %v", resp.Status, resp.Body)
	}
	detail := c.e.Do(http.MethodGet, fmt.Sprintf("/api/tickets/%d", c.ticket.ID), c.anaToken, nil)
	if detail.Body["subject"] != "Contracheque" {
		t.Fatalf("rejected correction changed ticket: %v", detail.Body)
	}
	module, err := c.e.Q.CreateModule(t.Context(), db.CreateModuleParams{SectorID: c.sector.ID, Name: "Ativo"})
	if err != nil {
		t.Fatal(err)
	}
	body["moduleIds"] = append(c.modules, module.ID)
	body["subjectModuleId"] = module.ID
	resp = c.e.correct(c.ticket.ID, c.anaToken, body)
	if resp.Status != http.StatusOK {
		t.Fatalf("correction with active module: %d %v", resp.Status, resp.Body)
	}
	modules := c.e.DoList(http.MethodGet, fmt.Sprintf("/api/tickets/%d/modules", c.ticket.ID), c.anaToken)
	if len(modules) != 3 {
		t.Fatalf("corrected ticket modules: %v", modules)
	}
	subjects := c.e.DoList(http.MethodGet, subjectsPath(c.sector.ID), c.supToken)
	if len(subjects) != 1 || subjects[0]["name"] != "Outro assunto" || subjects[0]["moduleId"] != float64(module.ID) {
		t.Fatalf("subject added to replacement module: %v", subjects)
	}
}

func TestClosingAndTransferRequireReplacementForDeactivatedModules(t *testing.T) {
	for _, transfer := range []bool{false, true} {
		t.Run(fmt.Sprintf("transfer=%t", transfer), func(t *testing.T) {
			t.Parallel()
			c := newSectorTransfer(t)
			for i, name := range []string{"Folha", "Patrimônio"} {
				if _, err := c.e.Q.UpdateModule(t.Context(), db.UpdateModuleParams{ID: c.modules[i], Name: name, Active: false}); err != nil {
					t.Fatal(err)
				}
			}
			body := with(c.transferForm(c.rh), "addSubject", true)
			save := func() response {
				if transfer {
					return c.e.transferSector(c.ticket.ID, c.anaToken, body)
				}
				return c.e.closeForm(c.ticket.ID, c.anaToken, body)
			}
			resp := save()
			if resp.Status != http.StatusUnprocessableEntity {
				t.Fatalf("save without active module: %d %v", resp.Status, resp.Body)
			}
			detail := c.e.Do(http.MethodGet, fmt.Sprintf("/api/tickets/%d", c.ticket.ID), c.anaToken, nil)
			if detail.Body["status"] != "in_progress" || c.e.Count("subjects") != 0 {
				t.Fatalf("rejected request changed ticket or subjects: %v", detail.Body)
			}
			module, err := c.e.Q.CreateModule(t.Context(), db.CreateModuleParams{SectorID: c.sector.ID, Name: "Ativo"})
			if err != nil {
				t.Fatal(err)
			}
			body["moduleIds"] = []int64{module.ID}
			body["subjectModuleId"] = module.ID
			resp = save()
			if resp.Status != http.StatusOK {
				t.Fatalf("save with replacement: %d %v", resp.Status, resp.Body)
			}
			modules := c.e.DoList(http.MethodGet, fmt.Sprintf("/api/tickets/%d/modules", c.ticket.ID), c.anaToken)
			subjects := c.e.DoList(http.MethodGet, subjectsPath(c.sector.ID), c.supToken)
			if len(modules) != 1 || modules[0]["id"] != float64(module.ID) || len(subjects) != 1 || subjects[0]["moduleId"] != float64(module.ID) {
				t.Fatalf("replacement module and subject: %v %v", modules, subjects)
			}
		})
	}
}

func TestClosingRejectsSubjectModuleOutsideSelection(t *testing.T) {
	t.Parallel()
	c := newClosing(t)
	c.register()
	form := with(with(c.form(c.org), "addSubject", true), "subjectModuleId", c.rhModule)
	resp := c.e.closeForm(c.ticket.ID, c.anaToken, form)
	if resp.Status != http.StatusUnprocessableEntity {
		t.Fatalf("close: %d %v", resp.Status, resp.Body)
	}
	if got := c.e.Count("subjects"); got != 0 {
		t.Fatalf("subjects after rejected close: %d", got)
	}
}

func TestClosingAddsSubjectToChosenModule(t *testing.T) {
	t.Parallel()
	c := newClosing(t)
	c.register()
	form := with(with(c.form(c.org), "addSubject", true), "subjectModuleId", c.modules[0])
	resp := c.e.closeForm(c.ticket.ID, c.anaToken, form)
	if resp.Status != http.StatusOK {
		t.Fatalf("close: %d %v", resp.Status, resp.Body)
	}
	list := c.e.DoList(http.MethodGet, subjectsPath(c.sector.ID), c.supToken)
	if len(list) != 1 || list[0]["moduleId"] != float64(c.modules[0]) {
		t.Fatalf("subjects: %v", list)
	}
}

func TestClosingFormOmitsUnclassifiedSubjects(t *testing.T) {
	t.Parallel()
	c := newClosing(t)
	e := c.e
	_, err := e.Q.AddSubjectIfMissing(t.Context(), db.AddSubjectIfMissingParams{SectorID: c.sector.ID, Name: "Antigo"})
	if err != nil {
		t.Fatal(err)
	}
	created := e.Do(http.MethodPost, subjectsPath(c.sector.ID), c.supToken, map[string]any{"name": "Novo", "moduleId": c.modules[0]})
	if created.Status != http.StatusCreated {
		t.Fatalf("create: %d %v", created.Status, created.Body)
	}
	filtered := e.DoList(http.MethodGet, subjectsPath(c.sector.ID)+"?moduleId=none", c.supToken)
	if len(filtered) != 1 || filtered[0]["name"] != "Antigo" {
		t.Fatalf("unclassified filter: %v", filtered)
	}
	resp := e.Do(http.MethodGet, fmt.Sprintf("/api/tickets/%d/closing-form", c.ticket.ID), c.anaToken, nil)
	list, ok := resp.Body["subjects"].([]any)
	if resp.Status != http.StatusOK || !ok || len(list) != 1 {
		t.Fatalf("closing form: %d %v", resp.Status, resp.Body)
	}
	if subject := list[0].(map[string]any); subject["name"] != "Novo" || subject["moduleId"] != float64(c.modules[0]) || subject["moduleName"] != "Folha" {
		t.Fatalf("form subject: %v", subject)
	}
}

func TestSubjectRequiresModuleOfItsSector(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e := c.e
	module, err := e.Q.CreateModule(t.Context(), db.CreateModuleParams{SectorID: c.sector.ID, Name: "Folha"})
	if err != nil {
		t.Fatal(err)
	}
	if resp := e.Do(http.MethodPost, subjectsPath(c.sector.ID), c.supToken, map[string]any{"name": "Senha"}); resp.Status != http.StatusUnprocessableEntity {
		t.Fatalf("missing module: status %d, body %v", resp.Status, resp.Body)
	}
	resp := e.Do(http.MethodPost, subjectsPath(c.sector.ID), c.supToken, map[string]any{"name": "Senha", "moduleId": module.ID})
	if resp.Status != http.StatusCreated || resp.Body["moduleId"] != float64(module.ID) {
		t.Fatalf("subject with module: status %d, body %v", resp.Status, resp.Body)
	}
	other, err := e.Q.CreateModule(t.Context(), db.CreateModuleParams{SectorID: c.sector.ID, Name: "Sistema B"})
	if err != nil {
		t.Fatal(err)
	}
	updated := e.Do(http.MethodPut, subjectPath(c.sector.ID, id(resp.Body)), c.supToken, map[string]any{"name": "Senha", "moduleId": other.ID})
	if updated.Status != http.StatusOK || updated.Body["moduleId"] != float64(other.ID) {
		t.Fatalf("move subject: status %d, body %v", updated.Status, updated.Body)
	}
	foreignSector := e.Sector("Outro setor")
	foreign, err := e.Q.CreateModule(t.Context(), db.CreateModuleParams{SectorID: foreignSector.ID, Name: "Outro"})
	if err != nil {
		t.Fatal(err)
	}
	if resp := e.Do(http.MethodPost, subjectsPath(c.sector.ID), c.supToken, map[string]any{"name": "Outro", "moduleId": foreign.ID}); resp.Status != http.StatusUnprocessableEntity {
		t.Fatalf("foreign module: status %d, body %v", resp.Status, resp.Body)
	}
	if resp := e.Do(http.MethodPost, subjectsPath(c.sector.ID), c.supToken, map[string]any{"name": " senha ", "moduleId": other.ID}); resp.Status != http.StatusConflict {
		t.Fatalf("duplicate in module: status %d, body %v", resp.Status, resp.Body)
	}
	if resp := e.Do(http.MethodPost, subjectsPath(c.sector.ID), c.supToken, map[string]any{"name": " senha ", "moduleId": module.ID}); resp.Status != http.StatusCreated {
		t.Fatalf("same name in different module: status %d, body %v", resp.Status, resp.Body)
	}
}
