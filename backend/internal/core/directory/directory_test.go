package directory_test

import (
	"fmt"
	"net/http"
	"net/url"
	"sync"
	"testing"

	"github.com/gcaspp-labs/xet/backend/internal/db"
	"github.com/gcaspp-labs/xet/backend/internal/testapi"
)

// Valid CNPJs: numeric and the alphanumeric example published by the Receita Federal.
const (
	numericCNPJ      = "11222333000181"
	alphanumericCNPJ = "12ABC34501DE35"
)

func TestOrganizationsRequireSupervisorOrAdmin(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	contab := e.Sector("Contabilidade")
	e.User("sup@exemplo.com", db.UserRoleSupervisor, &contab.ID)
	e.User("agente@exemplo.com", db.UserRoleAgent, &contab.ID)
	e.User("admin@exemplo.com", db.UserRoleAdmin, nil)
	sup := e.Login("sup@exemplo.com", testPassword)
	agent := e.Login("agente@exemplo.com", testPassword)
	admin := e.Login("admin@exemplo.com", testPassword)

	orgID := e.Organization(sup, "Prefeitura de Itu", "")
	e.Organization(admin, "Câmara de Itu", "")

	body := map[string]any{"name": "Outro órgão", "municipalityId": e.Municipality("Itu")}
	if resp := e.Do(http.MethodPost, "/api/organizations", agent, body); resp.Status != http.StatusForbidden {
		t.Errorf("agent create: status %d, want 403", resp.Status)
	}
	if resp := e.Do(http.MethodPut, fmt.Sprintf("/api/organizations/%d", orgID), agent, body); resp.Status != http.StatusForbidden {
		t.Errorf("agent update: status %d, want 403", resp.Status)
	}
	// Atendentes consultam os órgãos para vincular contatos.
	if list := e.DoList(http.MethodGet, "/api/organizations", agent); len(list) != 2 {
		t.Errorf("agent list: %v", list)
	}
	for _, req := range []struct{ method, path string }{
		{http.MethodGet, "/api/organizations"},
		{http.MethodPost, "/api/organizations"},
		{http.MethodPut, fmt.Sprintf("/api/organizations/%d", orgID)},
		{http.MethodGet, "/api/contacts"},
		{http.MethodPost, "/api/contacts"},
		{http.MethodPut, "/api/contacts/1"},
	} {
		if resp := e.Do(req.method, req.path, "", body); resp.Status != http.StatusUnauthorized {
			t.Errorf("no session %s %s: status %d, want 401", req.method, req.path, resp.Status)
		}
	}

	var orgs int
	if err := e.Pool.QueryRow(t.Context(), "select count(*) from organizations").Scan(&orgs); err != nil {
		t.Fatal(err)
	}
	if orgs != 2 {
		t.Fatalf("organizations = %d, want 2: refused requests must not write", orgs)
	}
}

func TestOrganizationCNPJValidation(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	admin := e.User("admin@exemplo.com", db.UserRoleAdmin, nil)
	token := e.Login("admin@exemplo.com", testPassword)
	itu := e.Municipality("Itu")

	valid := []struct{ input, stored string }{
		{"11.222.333/0001-81", numericCNPJ},
		{"12.ABC.345/01DE-35", alphanumericCNPJ},
		{"abcdefgh000195", "ABCDEFGH000195"},
	}
	for i, tc := range valid {
		resp := e.Do(http.MethodPost, "/api/organizations", token, map[string]any{"municipalityId": itu, "name": fmt.Sprintf("Órgão %d", i), "cnpj": tc.input})
		if resp.Status != http.StatusCreated || resp.Body["cnpj"] != tc.stored {
			t.Errorf("valid %q: status %d, body %v", tc.input, resp.Status, resp.Body)
		}
	}

	invalid := []string{
		"11.222.333/0001-82", // segundo dígito verificador errado
		"11.222.333/0001-91", // primeiro dígito verificador errado
		"12.ABC.345/01DE-3A", // dígito verificador com letra
		"00000000000000",
		"11111111111111",
		"1122233300018",   // 13 caracteres
		"112223330001810", // 15 caracteres
		"11.222.333/0001-8!",
	}
	for _, cnpj := range invalid {
		resp := e.Do(http.MethodPost, "/api/organizations", token, map[string]any{"municipalityId": itu, "name": "Inválido", "cnpj": cnpj})
		if resp.Status != http.StatusUnprocessableEntity || resp.Body["error"] == "" {
			t.Errorf("invalid %q: status %d, want 422 (body %v)", cnpj, resp.Status, resp.Body)
		}
	}

	// CNPJ é opcional e único quando informado, mesmo com outra formatação.
	noCNPJ := e.Do(http.MethodPost, "/api/organizations", token, map[string]any{"municipalityId": itu, "name": "Sem CNPJ", "cnpj": "  "})
	if noCNPJ.Status != http.StatusCreated || noCNPJ.Body["cnpj"] != nil {
		t.Fatalf("without cnpj: status %d, body %v", noCNPJ.Status, noCNPJ.Body)
	}
	e.Organization(token, "Outro sem CNPJ", "")
	if resp := e.Do(http.MethodPost, "/api/organizations", token, map[string]any{"municipalityId": itu, "name": "Duplicado", "cnpj": numericCNPJ}); resp.Status != http.StatusConflict {
		t.Errorf("duplicate cnpj: status %d, want 409", resp.Status)
	}
	if resp := e.Do(http.MethodPost, "/api/organizations", token, map[string]any{"municipalityId": itu, "name": "Duplicado", "cnpj": "12abc34501de35"}); resp.Status != http.StatusConflict {
		t.Errorf("duplicate alphanumeric cnpj in lowercase: status %d, want 409", resp.Status)
	}
	if resp := e.Do(http.MethodPost, "/api/organizations", token, map[string]any{"municipalityId": itu, "name": "  "}); resp.Status != http.StatusUnprocessableEntity {
		t.Errorf("blank name: status %d, want 422", resp.Status)
	}

	orgID := id(noCNPJ.Body)
	path := fmt.Sprintf("/api/organizations/%d", orgID)
	if resp := e.Do(http.MethodPut, path, token, map[string]any{"municipalityId": itu, "name": "Sem CNPJ", "cnpj": numericCNPJ}); resp.Status != http.StatusConflict {
		t.Errorf("update to existing cnpj: status %d, want 409", resp.Status)
	}
	if resp := e.Do(http.MethodPut, path, token, map[string]any{"municipalityId": itu, "name": "Sem CNPJ", "cnpj": "12345678000100"}); resp.Status != http.StatusUnprocessableEntity {
		t.Errorf("update to invalid cnpj: status %d, want 422", resp.Status)
	}
	resp := e.Do(http.MethodPut, path, token, map[string]any{"municipalityId": itu, "name": "Prefeitura de Salto", "cnpj": "45.997.418/0001-53"})
	if resp.Status != http.StatusOK || resp.Body["name"] != "Prefeitura de Salto" || resp.Body["cnpj"] != "45997418000153" {
		t.Fatalf("update: status %d, body %v", resp.Status, resp.Body)
	}
	resp = e.Do(http.MethodPut, path, token, map[string]any{"municipalityId": itu, "name": "Prefeitura de Salto", "cnpj": ""})
	if resp.Status != http.StatusOK || resp.Body["cnpj"] != nil {
		t.Fatalf("clear cnpj: status %d, body %v", resp.Status, resp.Body)
	}
	if resp := e.Do(http.MethodPut, path, token, map[string]any{"municipalityId": itu, "name": "Prefeitura de Salto"}); resp.Status != http.StatusOK {
		t.Fatalf("update without changes: status %d", resp.Status)
	}
	if resp := e.Do(http.MethodPut, "/api/organizations/999999", token, map[string]any{"municipalityId": itu, "name": "X"}); resp.Status != http.StatusNotFound {
		t.Fatalf("update unknown: status %d, want 404", resp.Status)
	}

	actions, changes := e.AuditChanges("organization", orgID)
	if len(actions) != 3 || actions[0] != "organization_created" || actions[1] != "organization_updated" || actions[2] != "organization_updated" {
		t.Fatalf("audit actions: %v", actions)
	}
	if changes[1]["name"]["to"] != "Prefeitura de Salto" || changes[1]["cnpj"]["from"] != nil || changes[1]["cnpj"]["to"] != "45997418000153" {
		t.Fatalf("audit update changes: %v", changes[1])
	}
	if changes[2]["cnpj"]["to"] != nil || len(changes[2]) != 1 {
		t.Fatalf("audit clear changes: %v", changes[2])
	}
	logs, err := e.Q.ListAuditLogsByEntity(t.Context(), db.ListAuditLogsByEntityParams{EntityType: "organization", EntityID: orgID})
	if err != nil {
		t.Fatal(err)
	}
	if *logs[0].ActorID != admin.ID {
		t.Fatalf("audit actor = %d, want %d", *logs[0].ActorID, admin.ID)
	}
}

func TestContactRegistration(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	contab := e.Sector("Contabilidade")
	e.User("sup@exemplo.com", db.UserRoleSupervisor, &contab.ID)
	e.User("agente@exemplo.com", db.UserRoleAgent, &contab.ID)
	sup := e.Login("sup@exemplo.com", testPassword)
	agent := e.Login("agente@exemplo.com", testPassword)
	orgID := e.Organization(sup, "Prefeitura de Itu", numericCNPJ)
	otherOrgID := e.Organization(sup, "Câmara de Itu", "")

	// Atendentes cadastram contatos e os vinculam a um órgão pré-cadastrado.
	resp := e.Do(http.MethodPost, "/api/contacts", agent, map[string]any{"name": " Maria Souza ", "phone": "+55 (11) 98888-0001", "organizationId": orgID, "sectorIds": []int64{contab.ID}})
	if resp.Status != http.StatusCreated {
		t.Fatalf("create: status %d, body %v", resp.Status, resp.Body)
	}
	org, _ := resp.Body["organization"].(map[string]any)
	if resp.Body["name"] != "Maria Souza" || resp.Body["phone"] != "5511988880001" || resp.Body["registered"] != true ||
		org["name"] != "Prefeitura de Itu" || org["cnpj"] != numericCNPJ {
		t.Fatalf("create body: %v", resp.Body)
	}
	contactID := id(resp.Body)
	otherID := e.Contact(agent, "João Lima", "5511988880002", otherOrgID, contab.ID)

	cases := []struct {
		name string
		body map[string]any
		want int
	}{
		{"duplicate phone", map[string]any{"name": "Outra", "phone": "5511988880001", "organizationId": orgID}, http.StatusConflict},
		{"duplicate phone formatted", map[string]any{"name": "Outra", "phone": "55 11 98888-0001", "organizationId": orgID}, http.StatusConflict},
		{"missing organization", map[string]any{"name": "Outra", "phone": "5511988880003"}, http.StatusUnprocessableEntity},
		{"unknown organization", map[string]any{"name": "Outra", "phone": "5511988880003", "organizationId": 999999}, http.StatusNotFound},
		{"short phone", map[string]any{"name": "Outra", "phone": "119888", "organizationId": orgID}, http.StatusUnprocessableEntity},
		{"phone with letters", map[string]any{"name": "Outra", "phone": "55119888A0003", "organizationId": orgID}, http.StatusUnprocessableEntity},
		{"blank name", map[string]any{"name": "  ", "phone": "5511988880003", "organizationId": orgID}, http.StatusUnprocessableEntity},
	}
	for _, tc := range cases {
		resp := e.Do(http.MethodPost, "/api/contacts", agent, tc.body)
		if resp.Status != tc.want || resp.Body["error"] == "" {
			t.Errorf("%s: status %d, want %d (body %v)", tc.name, resp.Status, tc.want, resp.Body)
		}
	}

	path := fmt.Sprintf("/api/contacts/%d", contactID)
	resp = e.Do(http.MethodPut, path, agent, map[string]any{"name": "Maria Souza Lima", "phone": "5511988880009", "organizationId": otherOrgID, "sectorIds": []int64{contab.ID}})
	org, _ = resp.Body["organization"].(map[string]any)
	if resp.Status != http.StatusOK || resp.Body["name"] != "Maria Souza Lima" || resp.Body["phone"] != "5511988880009" || org["name"] != "Câmara de Itu" {
		t.Fatalf("update: status %d, body %v", resp.Status, resp.Body)
	}
	if resp := e.Do(http.MethodPut, path, agent, map[string]any{"name": "Maria", "phone": "5511988880002", "organizationId": orgID}); resp.Status != http.StatusConflict {
		t.Errorf("update to phone of %d: status %d, want 409", otherID, resp.Status)
	}
	if resp := e.Do(http.MethodPut, "/api/contacts/999999", agent, map[string]any{"name": "X", "phone": "5511988880010", "organizationId": orgID}); resp.Status != http.StatusNotFound {
		t.Errorf("update unknown: status %d, want 404", resp.Status)
	}

	var contacts int
	if err := e.Pool.QueryRow(t.Context(), "select count(*) from contacts").Scan(&contacts); err != nil {
		t.Fatal(err)
	}
	if contacts != 2 {
		t.Fatalf("contacts = %d, want 2", contacts)
	}
}

// Requisições simultâneas com o mesmo telefone: o índice único decide e a
// perdedora recebe 409, nunca 500.
func TestContactPhoneUniqueUnderConcurrency(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	e.User("admin@exemplo.com", db.UserRoleAdmin, nil)
	token := e.Login("admin@exemplo.com", testPassword)
	orgID := e.Organization(token, "Prefeitura de Itu", "")
	contab := e.Sector("Contabilidade")

	const attempts = 8
	statuses := make([]int, attempts)
	var wg sync.WaitGroup
	for i := range attempts {
		wg.Go(func() {
			resp := e.Do(http.MethodPost, "/api/contacts", token, map[string]any{"name": fmt.Sprintf("Pessoa %d", i), "phone": "5511977770000", "organizationId": orgID, "sectorIds": []int64{contab.ID}})
			statuses[i] = resp.Status
		})
	}
	wg.Wait()

	created, conflicts := 0, 0
	for _, s := range statuses {
		switch s {
		case http.StatusCreated:
			created++
		case http.StatusConflict:
			conflicts++
		}
	}
	if created != 1 || conflicts != attempts-1 {
		t.Fatalf("statuses %v: want one 201 and the rest 409", statuses)
	}
}

func TestDirectorySearch(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	e.User("admin@exemplo.com", db.UserRoleAdmin, nil)
	token := e.Login("admin@exemplo.com", testPassword)
	itu := e.Organization(token, "Prefeitura de Itu", numericCNPJ)
	salto := e.Organization(token, "Câmara Municipal de Salto", alphanumericCNPJ)
	e.Organization(token, "Fundo 100% Educação", "")
	contab := e.Sector("Contabilidade")
	e.Contact(token, "Maria Souza", "5511988880001", itu, contab.ID)
	e.Contact(token, "José Pereira", "5511977770002", itu, contab.ID)
	e.Contact(token, "Ana Salto", "5519966660003", salto, contab.ID)

	search := func(path, q string) []string {
		t.Helper()
		return names(e.DoList(http.MethodGet, path+"?q="+url.QueryEscape(q), token))
	}
	contactCases := []struct {
		q    string
		want []string
	}{
		{"", []string{"Ana Salto", "José Pereira", "Maria Souza"}},
		{"souza", []string{"Maria Souza"}},                      // nome do contato, parcial e sem diferenciar maiúsculas
		{"prefeitura", []string{"José Pereira", "Maria Souza"}}, // nome do órgão
		{"salto", []string{"Ana Salto"}},                        // contato e órgão com o mesmo termo, sem repetir
		{"(11) 98888", []string{"Maria Souza"}},                 // telefone formatado e parcial
		{"7777", []string{"José Pereira"}},                      // trecho do telefone
		{"5511", []string{"José Pereira", "Maria Souza"}},
		{"11.222.333/0001-81", []string{"José Pereira", "Maria Souza"}}, // CNPJ formatado
		{"12.abc.345", []string{"Ana Salto"}},                           // CNPJ alfanumérico parcial, em minúsculas
		{"jose pereira", []string{"José Pereira"}},                      // sem acentos
		{"CÂMARA", []string{"Ana Salto"}},                               // nome do órgão, maiúsculas acentuadas
		{"camara municipal", []string{"Ana Salto"}},
		{"%", nil}, // curingas do LIKE são texto comum
		{"_", nil},
		{"inexistente", nil},
	}
	for _, tc := range contactCases {
		got := search("/api/contacts", tc.q)
		if fmt.Sprint(got) != fmt.Sprint(tc.want) {
			t.Errorf("contacts q=%q: got %v, want %v", tc.q, got, tc.want)
		}
	}

	orgCases := []struct {
		q    string
		want []string
	}{
		{"", []string{"Câmara Municipal de Salto", "Fundo 100% Educação", "Prefeitura de Itu"}},
		{"municipal", []string{"Câmara Municipal de Salto"}},
		{"camara", []string{"Câmara Municipal de Salto"}},
		{"EDUCAÇÃO", []string{"Fundo 100% Educação"}},
		{"educacao", []string{"Fundo 100% Educação"}},
		{"112223330001", []string{"Prefeitura de Itu"}},
		{"12ABC34501DE35", []string{"Câmara Municipal de Salto"}},
		{"100%", []string{"Fundo 100% Educação"}},
		{"souza", nil}, // nome de contato não encontra órgão
	}
	for _, tc := range orgCases {
		got := search("/api/organizations", tc.q)
		if fmt.Sprint(got) != fmt.Sprint(tc.want) {
			t.Errorf("organizations q=%q: got %v, want %v", tc.q, got, tc.want)
		}
	}
}

// Os municípios vêm da migração: os 645 de São Paulo, com o código AUDESP de 4
// dígitos, e só supervisor e administrador os leem, para o formulário de órgão.
func TestMunicipalitiesAreLoaded(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	contab := e.Sector("Contabilidade")
	e.User("sup@exemplo.com", db.UserRoleSupervisor, &contab.ID)
	e.User("agente@exemplo.com", db.UserRoleAgent, &contab.ID)
	e.User("admin@exemplo.com", db.UserRoleAdmin, nil)

	list := e.DoList(http.MethodGet, "/api/municipalities", e.Login("admin@exemplo.com", testPassword))
	if len(list) != 645 {
		t.Fatalf("municipalities = %d, want 645", len(list))
	}
	if first := list[0]["name"]; first != "Adamantina" {
		t.Errorf("first municipality = %v, want the list by name", first)
	}
	byCode := map[string]string{}
	for _, m := range list {
		code, _ := m["audespCode"].(string)
		if len(code) != 4 {
			t.Errorf("code %q of %v must have 4 digits", code, m["name"])
		}
		name, _ := m["name"].(string)
		byCode[code] = name
	}
	if len(byCode) != 645 {
		t.Errorf("distinct codes = %d, want 645", len(byCode))
	}
	// Zero à esquerda preservado, grafia atual e códigos que não são municípios.
	for code, want := range map[string]string{
		"0790": "Arco-Íris", "0828": "Vitória Brasil", "6101": "Adamantina",
		"6401": "Embu das Artes", "6423": "Florínea", "7101": "São Luiz do Paraitinga", "7087": "São João do Pau d'Alho",
		"9996": "", "9999": "",
	} {
		if byCode[code] != want {
			t.Errorf("code %s = %q, want %q", code, byCode[code], want)
		}
	}

	if got := len(e.DoList(http.MethodGet, "/api/municipalities", e.Login("sup@exemplo.com", testPassword))); got != 645 {
		t.Errorf("supervisor: %d municipalities", got)
	}
	if resp := e.Do(http.MethodGet, "/api/municipalities", e.Login("agente@exemplo.com", testPassword), nil); resp.Status != http.StatusForbidden {
		t.Errorf("agent: status %d, want 403", resp.Status)
	}
	if resp := e.Do(http.MethodGet, "/api/municipalities", "", nil); resp.Status != http.StatusUnauthorized {
		t.Errorf("no session: status %d, want 401", resp.Status)
	}
	// Sem cadastro: só leitura.
	if resp := e.Do(http.MethodPost, "/api/municipalities", e.Login("admin@exemplo.com", testPassword), map[string]string{"name": "Nova"}); resp.Status != http.StatusMethodNotAllowed {
		t.Errorf("create municipality: status %d, want 405", resp.Status)
	}
}

func TestOrganizationRequiresExistingMunicipality(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	e.User("admin@exemplo.com", db.UserRoleAdmin, nil)
	token := e.Login("admin@exemplo.com", testPassword)
	itu, salto := e.Municipality("Itu"), e.Municipality("Salto")

	missing := e.Do(http.MethodPost, "/api/organizations", token, map[string]any{"name": "Sem município"})
	if missing.Status != http.StatusUnprocessableEntity || missing.Body["error"] != "Selecione o município do órgão." {
		t.Errorf("without municipality: status %d, body %v", missing.Status, missing.Body)
	}
	unknown := e.Do(http.MethodPost, "/api/organizations", token, map[string]any{"name": "Em lugar nenhum", "municipalityId": 999999})
	if unknown.Status != http.StatusUnprocessableEntity || unknown.Body["error"] != "Município não encontrado. Selecione um da lista." {
		t.Errorf("unknown municipality: status %d, body %v", unknown.Status, unknown.Body)
	}
	if n := e.Count("organizations"); n != 0 {
		t.Fatalf("organizations = %d, refused requests must not write", n)
	}

	created := e.Do(http.MethodPost, "/api/organizations", token, map[string]any{"name": "Prefeitura", "municipalityId": itu})
	municipality, _ := created.Body["municipality"].(map[string]any)
	if created.Status != http.StatusCreated || municipality["name"] != "Itu" || int64(municipality["id"].(float64)) != itu {
		t.Fatalf("create: status %d, body %v", created.Status, created.Body)
	}
	orgID := id(created.Body)
	path := fmt.Sprintf("/api/organizations/%d", orgID)

	if resp := e.Do(http.MethodPut, path, token, map[string]any{"name": "Prefeitura"}); resp.Status != http.StatusUnprocessableEntity {
		t.Errorf("update without municipality: status %d, want 422", resp.Status)
	}
	if resp := e.Do(http.MethodPut, path, token, map[string]any{"name": "Prefeitura", "municipalityId": 999999}); resp.Status != http.StatusUnprocessableEntity {
		t.Errorf("update to unknown municipality: status %d, want 422", resp.Status)
	}
	moved := e.Do(http.MethodPut, path, token, map[string]any{"name": "Prefeitura", "municipalityId": salto})
	municipality, _ = moved.Body["municipality"].(map[string]any)
	if moved.Status != http.StatusOK || municipality["name"] != "Salto" {
		t.Fatalf("change municipality: status %d, body %v", moved.Status, moved.Body)
	}

	// A auditoria guarda o município, no cadastro e na troca; salvar igual não grava.
	same := e.Do(http.MethodPut, path, token, map[string]any{"name": "Prefeitura", "municipalityId": salto})
	municipality, _ = same.Body["municipality"].(map[string]any)
	if same.Status != http.StatusOK || municipality["name"] != "Salto" {
		t.Fatalf("update without changes: status %d, body %v", same.Status, same.Body)
	}
	actions, changes := e.AuditChanges("organization", orgID)
	if len(actions) != 2 || actions[0] != "organization_created" || actions[1] != "organization_updated" {
		t.Fatalf("audit actions: %v", actions)
	}
	if changes[0]["municipality_id"]["from"] != nil || changes[0]["municipality_id"]["to"] != float64(itu) {
		t.Errorf("audit created: %v", changes[0])
	}
	if changes[1]["municipality_id"]["from"] != float64(itu) || changes[1]["municipality_id"]["to"] != float64(salto) || len(changes[1]) != 1 {
		t.Errorf("audit updated: %v", changes[1])
	}
}

// O nome não se repete no município, sem diferenciar maiúsculas e acentos, e o
// mesmo nome vale em outra cidade.
func TestOrganizationNameIsUniqueInMunicipality(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	e.User("admin@exemplo.com", db.UserRoleAdmin, nil)
	token := e.Login("admin@exemplo.com", testPassword)
	itu, salto := e.Municipality("Itu"), e.Municipality("Salto")
	create := func(name string, municipalityID int64) testapi.Response {
		t.Helper()
		return e.Do(http.MethodPost, "/api/organizations", token, map[string]any{"name": name, "municipalityId": municipalityID})
	}

	first := create("Câmara Municipal", itu)
	if first.Status != http.StatusCreated {
		t.Fatalf("first: status %d, body %v", first.Status, first.Body)
	}
	for _, name := range []string{"Câmara Municipal", "CÂMARA MUNICIPAL", "camara municipal", "  Camara Municipal  "} {
		resp := create(name, itu)
		if resp.Status != http.StatusConflict || resp.Body["error"] != "Já existe um órgão com este nome neste município." {
			t.Errorf("repeated %q: status %d, body %v", name, resp.Status, resp.Body)
		}
	}
	other := create("Câmara Municipal", salto)
	if other.Status != http.StatusCreated {
		t.Fatalf("other city: status %d, body %v", other.Status, other.Body)
	}

	// Na edição, tanto pelo nome quanto pela troca de município.
	path := fmt.Sprintf("/api/organizations/%d", id(other.Body))
	if resp := e.Do(http.MethodPut, path, token, map[string]any{"name": "Câmara Municipal", "municipalityId": itu}); resp.Status != http.StatusConflict {
		t.Errorf("move to a city with the name: status %d, want 409", resp.Status)
	}
	if resp := e.Do(http.MethodPut, path, token, map[string]any{"name": "CÂMARA municipal", "municipalityId": salto}); resp.Status != http.StatusOK {
		t.Errorf("own name with other case: status %d, want 200", resp.Status)
	}
	third := create("Fundo", salto)
	path = fmt.Sprintf("/api/organizations/%d", id(third.Body))
	if resp := e.Do(http.MethodPut, path, token, map[string]any{"name": "camara municipal", "municipalityId": salto}); resp.Status != http.StatusConflict {
		t.Errorf("rename to a repeated name: status %d, want 409", resp.Status)
	}

	// Pedidos simultâneos: o banco decide, e os demais recebem a resposta clara.
	const attempts = 8
	statuses := make([]int, attempts)
	var wg sync.WaitGroup
	for i := range attempts {
		wg.Go(func() {
			statuses[i] = create("Fundo de Previdência", itu).Status
		})
	}
	wg.Wait()
	created := 0
	for _, status := range statuses {
		switch status {
		case http.StatusCreated:
			created++
		case http.StatusConflict:
		default:
			t.Errorf("concurrent create: status %d", status)
		}
	}
	if created != 1 {
		t.Errorf("concurrent create: %d created, want 1", created)
	}
}

// O município aparece ao lado do órgão na lista, na busca e no contato, e a busca
// de órgãos o encontra pelo nome, sem diferenciar maiúsculas e acentos.
func TestOrganizationShowsMunicipality(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	contab := e.Sector("Contabilidade")
	e.User("admin@exemplo.com", db.UserRoleAdmin, nil)
	e.User("ana@exemplo.com", db.UserRoleAgent, &contab.ID)
	admin := e.Login("admin@exemplo.com", testPassword)
	agent := e.Login("ana@exemplo.com", testPassword)

	post := func(name, municipality string) int64 {
		t.Helper()
		resp := e.Do(http.MethodPost, "/api/organizations", admin, map[string]any{"name": name, "municipalityId": e.Municipality(municipality)})
		if resp.Status != http.StatusCreated {
			t.Fatalf("create %s: status %d, body %v", name, resp.Status, resp.Body)
		}
		return id(resp.Body)
	}
	jaboticabal := post("Câmara Municipal", "Jaboticabal")
	post("Câmara Municipal", "São José do Rio Preto")
	post("Prefeitura", "Peruíbe")

	municipalityOf := func(item map[string]any) any {
		m, _ := item["municipality"].(map[string]any)
		return m["name"]
	}
	// Mesmo nome: a cidade desempata a ordem e aparece para o atendente, que não lê a lista de municípios.
	list := e.DoList(http.MethodGet, "/api/organizations?q="+url.QueryEscape("câmara"), agent)
	if len(list) != 2 || municipalityOf(list[0]) != "Jaboticabal" || municipalityOf(list[1]) != "São José do Rio Preto" {
		t.Fatalf("list: %v", list)
	}
	for q, want := range map[string]any{"sao jose do rio": "São José do Rio Preto", "PERUIBE": "Peruíbe", "Peruíbe": "Peruíbe"} {
		found := e.DoList(http.MethodGet, "/api/organizations?q="+url.QueryEscape(q), agent)
		if len(found) != 1 || municipalityOf(found[0]) != want {
			t.Errorf("search %q: %v", q, found)
		}
	}

	contactID := e.Contact(agent, "Maria", "5511999990000", jaboticabal, contab.ID)
	contact := e.Do(http.MethodGet, fmt.Sprintf("/api/contacts/%d", contactID), agent, nil)
	organization, _ := contact.Body["organization"].(map[string]any)
	if organization == nil || municipalityOf(organization) != "Jaboticabal" {
		t.Errorf("contact: %v", contact.Body)
	}
	contacts := e.DoList(http.MethodGet, "/api/contacts", agent)
	organization, _ = contacts[0]["organization"].(map[string]any)
	if organization == nil || municipalityOf(organization) != "Jaboticabal" {
		t.Errorf("contact list: %v", contacts)
	}
}

func TestDirectorySearchIsLimited(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	e.User("admin@exemplo.com", db.UserRoleAdmin, nil)
	token := e.Login("admin@exemplo.com", testPassword)
	if _, err := e.Pool.Exec(t.Context(),
		`insert into organizations (name, municipality_id)
		 select 'Órgão ' || lpad(n::text, 3, '0'), (select id from municipalities where name = 'Itu') from generate_series(1, 60) n`); err != nil {
		t.Fatal(err)
	}
	list := e.DoList(http.MethodGet, "/api/organizations?q=ORGAO", token)
	if len(list) != 50 || list[0]["name"] != "Órgão 001" {
		t.Fatalf("got %d results starting at %v, want the first 50 by name", len(list), list[0]["name"])
	}
}

// Setores e módulos do contato (spec.md): o filtro da busca e os vínculos do cadastro.
func TestContactSectorsAndModules(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	contab, rh := e.Sector("Contabilidade"), e.Sector("RH")
	ged := e.Sector("GED")
	e.User("ana@exemplo.com", db.UserRoleAgent, &contab.ID)
	e.User("sup@exemplo.com", db.UserRoleSupervisor, &contab.ID)
	e.User("suprh@exemplo.com", db.UserRoleSupervisor, &rh.ID)
	e.User("admin@exemplo.com", db.UserRoleAdmin, nil)
	ana := e.Login("ana@exemplo.com", testPassword)
	sup := e.Login("sup@exemplo.com", testPassword)
	supRH := e.Login("suprh@exemplo.com", testPassword)
	admin := e.Login("admin@exemplo.com", testPassword)
	org := e.Organization(admin, "Prefeitura", "")

	module := func(token string, sectorID int64, name string) int64 {
		t.Helper()
		resp := e.Do(http.MethodPost, fmt.Sprintf("/api/sectors/%d/modules", sectorID), token, map[string]string{"name": name})
		if resp.Status != http.StatusCreated {
			t.Fatalf("create module: status %d, body %v", resp.Status, resp.Body)
		}
		return id(resp.Body)
	}
	folha := module(sup, contab.ID, "Folha")
	patrimonio := module(sup, contab.ID, "Patrimônio")
	inativo := module(sup, contab.ID, "Inativo")
	if resp := e.Do(http.MethodPut, fmt.Sprintf("/api/sectors/%d/modules/%d", contab.ID, inativo), sup, map[string]any{"name": "Inativo", "active": false}); resp.Status != http.StatusOK {
		t.Fatalf("deactivate module: status %d", resp.Status)
	}
	ponto := module(supRH, rh.ID, "Ponto")

	// Módulos ativos: todos os papéis do setor; a rota de gestão continua restrita.
	if list := e.DoList(http.MethodGet, fmt.Sprintf("/api/sectors/%d/active-modules", contab.ID), ana); fmt.Sprint(names(list)) != "[Folha Patrimônio]" {
		t.Errorf("active modules: %v", list)
	}
	if resp := e.Do(http.MethodGet, fmt.Sprintf("/api/sectors/%d/active-modules", rh.ID), ana, nil); resp.Status != http.StatusForbidden {
		t.Errorf("active modules of another sector: status %d, want 403", resp.Status)
	}
	if resp := e.Do(http.MethodGet, fmt.Sprintf("/api/sectors/%d/modules", contab.ID), ana, nil); resp.Status != http.StatusForbidden {
		t.Errorf("modules management by agent: status %d, want 403", resp.Status)
	}

	form := func(sectors, modules []int64) map[string]any {
		return map[string]any{"name": "Maria", "phone": "5511988880001", "organizationId": org, "sectorIds": sectors, "moduleIds": modules}
	}
	post := func(token string, sectors, modules []int64) int {
		t.Helper()
		return e.Do(http.MethodPost, "/api/contacts", token, form(sectors, modules)).Status
	}
	// Recusas não deixam contato nem vínculo gravado.
	for _, tc := range []struct {
		name             string
		token            string
		sectors, modules []int64
		want             int
	}{
		{"without sector", ana, nil, nil, http.StatusUnprocessableEntity},
		{"agent in another sector", ana, []int64{rh.ID}, nil, http.StatusForbidden},
		{"agent in own and another sector", ana, []int64{contab.ID, rh.ID}, nil, http.StatusForbidden},
		{"admin in unknown sector", admin, []int64{999999}, nil, http.StatusUnprocessableEntity},
		{"module outside the sectors", ana, []int64{contab.ID}, []int64{ponto}, http.StatusUnprocessableEntity},
		{"inactive module", ana, []int64{contab.ID}, []int64{inativo}, http.StatusUnprocessableEntity},
		{"unknown module", ana, []int64{contab.ID}, []int64{999999}, http.StatusUnprocessableEntity},
		{"two modules in one sector", ana, []int64{contab.ID}, []int64{folha, patrimonio}, http.StatusUnprocessableEntity},
	} {
		if got := post(tc.token, tc.sectors, tc.modules); got != tc.want {
			t.Errorf("%s: status %d, want %d", tc.name, got, tc.want)
		}
	}
	if got := e.Count("contacts"); got != 0 {
		t.Fatalf("contacts = %d, want 0: refused requests must not write", got)
	}

	// O administrador escolhe vários setores e módulos de qualquer um deles.
	resp := e.Do(http.MethodPost, "/api/contacts", admin, form([]int64{contab.ID, rh.ID}, []int64{folha, ponto}))
	if resp.Status != http.StatusCreated {
		t.Fatalf("create: status %d, body %v", resp.Status, resp.Body)
	}
	maria := id(resp.Body)
	links := func() string {
		t.Helper()
		got := e.Do(http.MethodGet, fmt.Sprintf("/api/contacts/%d", maria), ana, nil)
		if got.Status != http.StatusOK {
			t.Fatalf("get contact: status %d", got.Status)
		}
		var sectors, modules []string
		for _, s := range got.Body["sectors"].([]any) {
			sectors = append(sectors, s.(map[string]any)["name"].(string))
		}
		for _, m := range got.Body["modules"].([]any) {
			modules = append(modules, m.(map[string]any)["name"].(string))
		}
		return fmt.Sprint(sectors, modules)
	}
	if got := links(); got != "[Contabilidade RH] [Folha Ponto]" {
		t.Fatalf("after create: %s", got)
	}
	if resp := e.Do(http.MethodGet, "/api/contacts/999999", ana, nil); resp.Status != http.StatusNotFound {
		t.Errorf("get unknown contact: status %d, want 404", resp.Status)
	}

	put := func(token string, sectors, modules []int64) int {
		t.Helper()
		return e.Do(http.MethodPut, fmt.Sprintf("/api/contacts/%d", maria), token, form(sectors, modules)).Status
	}
	// A atendente troca os módulos do próprio setor; os do RH são preservados,
	// mesmo que o formulário não os traga.
	if got := put(ana, []int64{contab.ID}, []int64{patrimonio}); got != http.StatusOK {
		t.Fatalf("agent update: status %d", got)
	}
	if got := links(); got != "[Contabilidade RH] [Patrimônio Ponto]" {
		t.Fatalf("after agent update: %s", got)
	}
	// Não entra em outro setor nem marca módulo de setor alheio.
	if got := put(ana, []int64{contab.ID, ged.ID}, nil); got != http.StatusForbidden {
		t.Errorf("agent adds another sector: status %d, want 403", got)
	}
	// Tirar o RH é do RH: a atendente tira só o próprio setor, com os módulos dele.
	if got := put(ana, []int64{rh.ID}, []int64{patrimonio}); got != http.StatusUnprocessableEntity {
		t.Errorf("module of the sector removed: status %d, want 422", got)
	}
	if got := put(ana, []int64{rh.ID}, []int64{ponto}); got != http.StatusOK {
		t.Fatalf("agent leaves own sector: status %d", got)
	}
	if got := links(); got != "[RH] [Ponto]" {
		t.Fatalf("after agent leaves: %s", got)
	}
	// Sem setor algum, é recusado.
	if got := put(supRH, nil, nil); got != http.StatusUnprocessableEntity {
		t.Errorf("no sector left: status %d, want 422", got)
	}
	if got := links(); got != "[RH] [Ponto]" {
		t.Fatalf("refused update wrote: %s", got)
	}
	// A atendente volta o contato ao próprio setor e não pode marcar módulo do RH que ele não tem.
	second := module(supRH, rh.ID, "Férias")
	if got := put(ana, []int64{contab.ID}, []int64{folha, second}); got != http.StatusForbidden {
		t.Errorf("agent marks module of another sector: status %d, want 403", got)
	}
	// O administrador tira um setor, e os módulos dele saem junto.
	if got := put(admin, []int64{contab.ID}, []int64{folha}); got != http.StatusOK {
		t.Fatalf("admin update: status %d", got)
	}
	if got := links(); got != "[Contabilidade] [Folha]" {
		t.Fatalf("after admin update: %s", got)
	}
	// Trocar o módulo substitui o do setor; dois no mesmo setor são recusados.
	if got := put(ana, []int64{contab.ID}, []int64{folha, patrimonio}); got != http.StatusUnprocessableEntity {
		t.Errorf("two modules in one sector: status %d, want 422", got)
	}
	if got := links(); got != "[Contabilidade] [Folha]" {
		t.Fatalf("after refused update: %s", got)
	}
	// O banco é a última barreira: um módulo por setor e só de setor do contato.
	for _, tc := range []struct {
		name string
		sql  string
		args []any
	}{
		{"second module in the sector", `insert into contact_modules (contact_id, module_id, sector_id) values ($1, $2, $3)`, []any{maria, patrimonio, contab.ID}},
		{"module of a sector outside the contact", `insert into contact_modules (contact_id, module_id, sector_id) values ($1, $2, $3)`, []any{maria, ponto, rh.ID}},
		{"module with the wrong sector", `insert into contact_modules (contact_id, module_id, sector_id) values ($1, $2, $3)`, []any{maria, ponto, contab.ID}},
	} {
		if _, err := e.Pool.Exec(t.Context(), tc.sql, tc.args...); err == nil {
			t.Errorf("%s: accepted by the database", tc.name)
		}
	}
	// Módulo já vinculado continua depois de desativado; a atendente pode mantê-lo ao salvar.
	if resp := e.Do(http.MethodPut, fmt.Sprintf("/api/sectors/%d/modules/%d", contab.ID, folha), sup, map[string]any{"name": "Folha", "active": false}); resp.Status != http.StatusOK {
		t.Fatalf("deactivate module: status %d", resp.Status)
	}
	if got := put(ana, []int64{contab.ID}, []int64{folha}); got != http.StatusOK {
		t.Errorf("keep deactivated module: status %d", got)
	}
	if got := links(); got != "[Contabilidade] [Folha]" {
		t.Fatalf("after keeping deactivated module: %s", got)
	}
}

func TestContactSearchFilters(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	contab, rh := e.Sector("Contabilidade"), e.Sector("RH")
	e.User("sup@exemplo.com", db.UserRoleSupervisor, &contab.ID)
	sup := e.Login("sup@exemplo.com", testPassword)
	e.User("admin@exemplo.com", db.UserRoleAdmin, nil)
	admin := e.Login("admin@exemplo.com", testPassword)
	org := e.Organization(admin, "Prefeitura", "")
	resp := e.Do(http.MethodPost, fmt.Sprintf("/api/sectors/%d/modules", contab.ID), sup, map[string]string{"name": "Folha"})
	folha := id(resp.Body)

	e.Contact(sup, "Ana", "5511988880001", org, contab.ID)
	e.Contact(admin, "Bia", "5511988880002", org, rh.ID)
	resp = e.Do(http.MethodPost, "/api/contacts", admin, map[string]any{"name": "Cris", "phone": "5511988880003", "organizationId": org,
		"sectorIds": []int64{contab.ID, rh.ID}, "moduleIds": []int64{folha}})
	if resp.Status != http.StatusCreated {
		t.Fatalf("create: status %d, body %v", resp.Status, resp.Body)
	}

	for _, tc := range []struct {
		query string
		want  []string
	}{
		{"", []string{"Ana", "Bia", "Cris"}},
		{fmt.Sprintf("?sectorId=%d", contab.ID), []string{"Ana", "Cris"}},
		{fmt.Sprintf("?sectorId=%d", rh.ID), []string{"Bia", "Cris"}},
		{fmt.Sprintf("?moduleId=%d", folha), []string{"Cris"}},
		{fmt.Sprintf("?sectorId=%d&moduleId=%d", rh.ID, folha), []string{"Cris"}},
		{fmt.Sprintf("?q=ana&sectorId=%d", contab.ID), []string{"Ana"}},
		{fmt.Sprintf("?q=ana&sectorId=%d", rh.ID), nil},
		// O filtro vale junto com todas as chaves da busca, não só com a última.
		{fmt.Sprintf("?q=prefeitura&sectorId=%d", rh.ID), []string{"Bia", "Cris"}},
	} {
		if got := names(e.DoList(http.MethodGet, "/api/contacts"+tc.query, sup)); fmt.Sprint(got) != fmt.Sprint(tc.want) {
			t.Errorf("contacts%s: got %v, want %v", tc.query, got, tc.want)
		}
	}
	for _, query := range []string{"?sectorId=abc", "?moduleId=0"} {
		if resp := e.Do(http.MethodGet, "/api/contacts"+query, sup, nil); resp.Status != http.StatusUnprocessableEntity {
			t.Errorf("contacts%s: status %d, want 422", query, resp.Status)
		}
	}
}

// Município e órgão filtram os contatos junto com setor, módulo e texto, e o
// filtro de município lista só os que têm órgão, para todos os papéis.
func TestContactSearchByMunicipalityAndOrganization(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	contab, rh := e.Sector("Contabilidade"), e.Sector("RH")
	e.User("agent@exemplo.com", db.UserRoleAgent, &contab.ID)
	agent := e.Login("agent@exemplo.com", testPassword)
	e.User("admin@exemplo.com", db.UserRoleAdmin, nil)
	admin := e.Login("admin@exemplo.com", testPassword)
	itu, peruibe := e.Municipality("Itu"), e.Municipality("Peruíbe")
	organization := func(name string, municipality int64) int64 {
		t.Helper()
		resp := e.Do(http.MethodPost, "/api/organizations", admin, map[string]any{"name": name, "municipalityId": municipality})
		if resp.Status != http.StatusCreated {
			t.Fatalf("organization %s: status %d, body %v", name, resp.Status, resp.Body)
		}
		return id(resp.Body)
	}
	camaraItu := organization("Câmara Municipal", itu)
	prefeituraItu := organization("Prefeitura", itu)
	camaraPeruibe := organization("Câmara Municipal", peruibe)
	salto := e.Municipality("Salto")
	organization("Fundo Municipal", salto)
	resp := e.Do(http.MethodPost, fmt.Sprintf("/api/sectors/%d/modules", contab.ID), admin, map[string]string{"name": "Folha"})
	folha := id(resp.Body)

	e.Contact(admin, "Ana", "5511988880001", camaraItu, contab.ID)
	e.Contact(admin, "Bia", "5511988880002", prefeituraItu, rh.ID)
	e.Contact(admin, "Dora", "5511988880004", camaraPeruibe, contab.ID)
	resp = e.Do(http.MethodPost, "/api/contacts", admin, map[string]any{"name": "Cris", "phone": "5511988880003", "organizationId": prefeituraItu,
		"sectorIds": []int64{contab.ID}, "moduleIds": []int64{folha}})
	if resp.Status != http.StatusCreated {
		t.Fatalf("create: status %d, body %v", resp.Status, resp.Body)
	}
	// Contato sem órgão não entra nos filtros nem na busca pelo município.
	if _, err := e.Pool.Exec(t.Context(), "insert into contacts (name, phone) values ('Elis', '5511988880005')"); err != nil {
		t.Fatal(err)
	}

	for _, tc := range []struct {
		query string
		want  []string
	}{
		{fmt.Sprintf("?municipalityId=%d", itu), []string{"Ana", "Bia", "Cris"}},
		{fmt.Sprintf("?municipalityId=%d", peruibe), []string{"Dora"}},
		{fmt.Sprintf("?municipalityId=%d", salto), nil},
		{fmt.Sprintf("?organizationId=%d", prefeituraItu), []string{"Bia", "Cris"}},
		{fmt.Sprintf("?municipalityId=%d&organizationId=%d", itu, camaraItu), []string{"Ana"}},
		{fmt.Sprintf("?municipalityId=%d&organizationId=%d", peruibe, camaraItu), nil},
		{fmt.Sprintf("?municipalityId=%d&sectorId=%d", itu, contab.ID), []string{"Ana", "Cris"}},
		{fmt.Sprintf("?organizationId=%d&moduleId=%d", prefeituraItu, folha), []string{"Cris"}},
		{fmt.Sprintf("?q=ana&municipalityId=%d", itu), []string{"Ana"}},
		{fmt.Sprintf("?q=ana&municipalityId=%d", peruibe), nil},
		// O filtro vale junto com todas as chaves da busca, não só com a última.
		{fmt.Sprintf("?q=camara&municipalityId=%d", peruibe), []string{"Dora"}},
		{fmt.Sprintf("?q=988880002&organizationId=%d", camaraItu), nil},
		// O nome do município encontra os contatos dos órgãos dele, com ou sem acento.
		{"?q=peruibe", []string{"Dora"}},
		{"?q=" + url.QueryEscape("PERUÍBE"), []string{"Dora"}},
		{"?q=itu", []string{"Ana", "Bia", "Cris"}},
		{fmt.Sprintf("?q=itu&sectorId=%d", rh.ID), []string{"Bia"}},
	} {
		if got := names(e.DoList(http.MethodGet, "/api/contacts"+tc.query, agent)); fmt.Sprint(got) != fmt.Sprint(tc.want) {
			t.Errorf("contacts%s: got %v, want %v", tc.query, got, tc.want)
		}
	}

	// O filtro de município mostra só os que têm órgão, e o de órgão acompanha o município.
	if got := names(e.DoList(http.MethodGet, "/api/organizations/municipalities", agent)); fmt.Sprint(got) != fmt.Sprint([]string{"Itu", "Peruíbe", "Salto"}) {
		t.Errorf("municipalities with organizations: got %v", got)
	}
	for _, tc := range []struct {
		query string
		want  []string
	}{
		{fmt.Sprintf("?municipalityId=%d", itu), []string{"Câmara Municipal", "Prefeitura"}},
		{fmt.Sprintf("?municipalityId=%d", peruibe), []string{"Câmara Municipal"}},
		{fmt.Sprintf("?q=prefeitura&municipalityId=%d", peruibe), nil},
		{fmt.Sprintf("?q=peruibe&municipalityId=%d", itu), nil},
		{fmt.Sprintf("?q=prefeitura&municipalityId=%d", itu), []string{"Prefeitura"}},
	} {
		if got := names(e.DoList(http.MethodGet, "/api/organizations"+tc.query, agent)); fmt.Sprint(got) != fmt.Sprint(tc.want) {
			t.Errorf("organizations%s: got %v, want %v", tc.query, got, tc.want)
		}
	}

	for _, path := range []string{"/api/contacts?municipalityId=abc", "/api/contacts?organizationId=0", "/api/contacts?organizationId=-1", "/api/organizations?municipalityId=abc"} {
		if resp := e.Do(http.MethodGet, path, agent, nil); resp.Status != http.StatusUnprocessableEntity {
			t.Errorf("%s: status %d, want 422", path, resp.Status)
		}
	}
}

// Alterações de setores e módulos ficam na auditoria, só com o que mudou, e
// uma recusa não deixa registro.
func TestContactLinksAreAudited(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	contab, rh := e.Sector("Contabilidade"), e.Sector("RH")
	ana := e.User("ana@exemplo.com", db.UserRoleAgent, &contab.ID)
	admin := e.User("admin@exemplo.com", db.UserRoleAdmin, nil)
	anaToken := e.Login("ana@exemplo.com", testPassword)
	adminToken := e.Login("admin@exemplo.com", testPassword)
	org := e.Organization(adminToken, "Prefeitura", "")
	folha, err := e.Q.CreateModule(t.Context(), db.CreateModuleParams{SectorID: contab.ID, Name: "Folha"})
	if err != nil {
		t.Fatal(err)
	}
	form := func(sectors, modules []int64) map[string]any {
		return map[string]any{"name": "Maria", "phone": "5511988880001", "organizationId": org, "sectorIds": sectors, "moduleIds": modules}
	}

	resp := e.Do(http.MethodPost, "/api/contacts", anaToken, form([]int64{contab.ID}, []int64{folha.ID}))
	if resp.Status != http.StatusCreated {
		t.Fatalf("create: status %d, body %v", resp.Status, resp.Body)
	}
	maria := id(resp.Body)
	path := fmt.Sprintf("/api/contacts/%d", maria)
	// Sem mudança nos vínculos e com recusa, nada é registrado.
	if resp := e.Do(http.MethodPut, path, anaToken, form([]int64{contab.ID}, []int64{folha.ID})); resp.Status != http.StatusOK {
		t.Fatalf("update without changes: status %d", resp.Status)
	}
	if resp := e.Do(http.MethodPut, path, anaToken, form([]int64{contab.ID, rh.ID}, nil)); resp.Status != http.StatusForbidden {
		t.Fatalf("refused update: status %d", resp.Status)
	}
	if resp := e.Do(http.MethodPut, path, adminToken, form([]int64{rh.ID}, nil)); resp.Status != http.StatusOK {
		t.Fatalf("admin update: status %d, body %v", resp.Status, resp.Body)
	}

	actions, changes := e.AuditChanges("contact", maria)
	if fmt.Sprint(actions) != "[contact_links_updated contact_links_updated]" {
		t.Fatalf("audit actions: %v", actions)
	}
	if fmt.Sprint(changes[0]["sector_ids"]["to"]) != fmt.Sprint([]any{float64(contab.ID)}) ||
		fmt.Sprint(changes[0]["module_ids"]["to"]) != fmt.Sprint([]any{float64(folha.ID)}) {
		t.Fatalf("audit create: %v", changes[0])
	}
	if fmt.Sprint(changes[1]["sector_ids"]["from"]) != fmt.Sprint([]any{float64(contab.ID)}) ||
		fmt.Sprint(changes[1]["sector_ids"]["to"]) != fmt.Sprint([]any{float64(rh.ID)}) ||
		fmt.Sprint(changes[1]["module_ids"]["to"]) != "[]" {
		t.Fatalf("audit update: %v", changes[1])
	}
	logs, err := e.Q.ListAuditLogsByEntity(t.Context(), db.ListAuditLogsByEntityParams{EntityType: "contact", EntityID: maria})
	if err != nil {
		t.Fatal(err)
	}
	if *logs[0].ActorID != ana.ID || *logs[1].ActorID != admin.ID {
		t.Fatalf("audit actors: %d, %d", *logs[0].ActorID, *logs[1].ActorID)
	}
}
