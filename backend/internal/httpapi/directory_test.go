package httpapi

import (
	"fmt"
	"net/http"
	"net/url"
	"sync"
	"testing"

	"github.com/gcaspp-labs/xet/backend/internal/db"
)

// Valid CNPJs: numeric and the alphanumeric example published by the Receita Federal.
const (
	numericCNPJ      = "11222333000181"
	alphanumericCNPJ = "12ABC34501DE35"
)

func (e *testEnv) organization(token, name, cnpj string) int64 {
	e.t.Helper()
	resp := e.do(http.MethodPost, "/api/organizations", token, map[string]string{"name": name, "cnpj": cnpj})
	if resp.status != http.StatusCreated {
		e.t.Fatalf("create organization %s: status %d, body %v", name, resp.status, resp.body)
	}
	return id(resp.body)
}

func (e *testEnv) contact(token, name, phone string, orgID, sectorID int64) int64 {
	e.t.Helper()
	resp := e.do(http.MethodPost, "/api/contacts", token, map[string]any{"name": name, "phone": phone, "organizationId": orgID, "sectorIds": []int64{sectorID}})
	if resp.status != http.StatusCreated {
		e.t.Fatalf("create contact %s: status %d, body %v", name, resp.status, resp.body)
	}
	return id(resp.body)
}

func names(list []map[string]any) []string {
	out := make([]string, len(list))
	for i, item := range list {
		out[i], _ = item["name"].(string)
	}
	return out
}

func TestOrganizationsRequireSupervisorOrAdmin(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	contab := e.sector("Contabilidade")
	e.user("sup@exemplo.com", db.UserRoleSupervisor, &contab.ID)
	e.user("agente@exemplo.com", db.UserRoleAgent, &contab.ID)
	e.user("admin@exemplo.com", db.UserRoleAdmin, nil)
	sup := e.login("sup@exemplo.com", testPassword)
	agent := e.login("agente@exemplo.com", testPassword)
	admin := e.login("admin@exemplo.com", testPassword)

	orgID := e.organization(sup, "Prefeitura de Itu", "")
	e.organization(admin, "Câmara de Itu", "")

	body := map[string]string{"name": "Outro órgão"}
	if resp := e.do(http.MethodPost, "/api/organizations", agent, body); resp.status != http.StatusForbidden {
		t.Errorf("agent create: status %d, want 403", resp.status)
	}
	if resp := e.do(http.MethodPut, fmt.Sprintf("/api/organizations/%d", orgID), agent, body); resp.status != http.StatusForbidden {
		t.Errorf("agent update: status %d, want 403", resp.status)
	}
	// Atendentes consultam os órgãos para vincular contatos.
	if list := e.doList(http.MethodGet, "/api/organizations", agent); len(list) != 2 {
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
		if resp := e.do(req.method, req.path, "", body); resp.status != http.StatusUnauthorized {
			t.Errorf("no session %s %s: status %d, want 401", req.method, req.path, resp.status)
		}
	}

	var orgs int
	if err := e.pool.QueryRow(t.Context(), "select count(*) from organizations").Scan(&orgs); err != nil {
		t.Fatal(err)
	}
	if orgs != 2 {
		t.Fatalf("organizations = %d, want 2: refused requests must not write", orgs)
	}
}

func TestOrganizationCNPJValidation(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	admin := e.user("admin@exemplo.com", db.UserRoleAdmin, nil)
	token := e.login("admin@exemplo.com", testPassword)

	valid := []struct{ input, stored string }{
		{"11.222.333/0001-81", numericCNPJ},
		{"12.ABC.345/01DE-35", alphanumericCNPJ},
		{"abcdefgh000195", "ABCDEFGH000195"},
	}
	for i, tc := range valid {
		resp := e.do(http.MethodPost, "/api/organizations", token, map[string]string{"name": fmt.Sprintf("Órgão %d", i), "cnpj": tc.input})
		if resp.status != http.StatusCreated || resp.body["cnpj"] != tc.stored {
			t.Errorf("valid %q: status %d, body %v", tc.input, resp.status, resp.body)
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
		resp := e.do(http.MethodPost, "/api/organizations", token, map[string]string{"name": "Inválido", "cnpj": cnpj})
		if resp.status != http.StatusUnprocessableEntity || resp.body["error"] == "" {
			t.Errorf("invalid %q: status %d, want 422 (body %v)", cnpj, resp.status, resp.body)
		}
	}

	// CNPJ é opcional e único quando informado, mesmo com outra formatação.
	noCNPJ := e.do(http.MethodPost, "/api/organizations", token, map[string]string{"name": "Sem CNPJ", "cnpj": "  "})
	if noCNPJ.status != http.StatusCreated || noCNPJ.body["cnpj"] != nil {
		t.Fatalf("without cnpj: status %d, body %v", noCNPJ.status, noCNPJ.body)
	}
	e.organization(token, "Outro sem CNPJ", "")
	if resp := e.do(http.MethodPost, "/api/organizations", token, map[string]string{"name": "Duplicado", "cnpj": numericCNPJ}); resp.status != http.StatusConflict {
		t.Errorf("duplicate cnpj: status %d, want 409", resp.status)
	}
	if resp := e.do(http.MethodPost, "/api/organizations", token, map[string]string{"name": "Duplicado", "cnpj": "12abc34501de35"}); resp.status != http.StatusConflict {
		t.Errorf("duplicate alphanumeric cnpj in lowercase: status %d, want 409", resp.status)
	}
	if resp := e.do(http.MethodPost, "/api/organizations", token, map[string]string{"name": "  "}); resp.status != http.StatusUnprocessableEntity {
		t.Errorf("blank name: status %d, want 422", resp.status)
	}

	orgID := id(noCNPJ.body)
	path := fmt.Sprintf("/api/organizations/%d", orgID)
	if resp := e.do(http.MethodPut, path, token, map[string]string{"name": "Sem CNPJ", "cnpj": numericCNPJ}); resp.status != http.StatusConflict {
		t.Errorf("update to existing cnpj: status %d, want 409", resp.status)
	}
	if resp := e.do(http.MethodPut, path, token, map[string]string{"name": "Sem CNPJ", "cnpj": "12345678000100"}); resp.status != http.StatusUnprocessableEntity {
		t.Errorf("update to invalid cnpj: status %d, want 422", resp.status)
	}
	resp := e.do(http.MethodPut, path, token, map[string]string{"name": "Prefeitura de Salto", "cnpj": "45.997.418/0001-53"})
	if resp.status != http.StatusOK || resp.body["name"] != "Prefeitura de Salto" || resp.body["cnpj"] != "45997418000153" {
		t.Fatalf("update: status %d, body %v", resp.status, resp.body)
	}
	resp = e.do(http.MethodPut, path, token, map[string]string{"name": "Prefeitura de Salto", "cnpj": ""})
	if resp.status != http.StatusOK || resp.body["cnpj"] != nil {
		t.Fatalf("clear cnpj: status %d, body %v", resp.status, resp.body)
	}
	if resp := e.do(http.MethodPut, path, token, map[string]string{"name": "Prefeitura de Salto"}); resp.status != http.StatusOK {
		t.Fatalf("update without changes: status %d", resp.status)
	}
	if resp := e.do(http.MethodPut, "/api/organizations/999999", token, map[string]string{"name": "X"}); resp.status != http.StatusNotFound {
		t.Fatalf("update unknown: status %d, want 404", resp.status)
	}

	actions, changes := e.auditChanges("organization", orgID)
	if len(actions) != 3 || actions[0] != "organization_created" || actions[1] != "organization_updated" || actions[2] != "organization_updated" {
		t.Fatalf("audit actions: %v", actions)
	}
	if changes[1]["name"]["to"] != "Prefeitura de Salto" || changes[1]["cnpj"]["from"] != nil || changes[1]["cnpj"]["to"] != "45997418000153" {
		t.Fatalf("audit update changes: %v", changes[1])
	}
	if changes[2]["cnpj"]["to"] != nil || len(changes[2]) != 1 {
		t.Fatalf("audit clear changes: %v", changes[2])
	}
	logs, err := e.q.ListAuditLogsByEntity(t.Context(), db.ListAuditLogsByEntityParams{EntityType: "organization", EntityID: orgID})
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
	contab := e.sector("Contabilidade")
	e.user("sup@exemplo.com", db.UserRoleSupervisor, &contab.ID)
	e.user("agente@exemplo.com", db.UserRoleAgent, &contab.ID)
	sup := e.login("sup@exemplo.com", testPassword)
	agent := e.login("agente@exemplo.com", testPassword)
	orgID := e.organization(sup, "Prefeitura de Itu", numericCNPJ)
	otherOrgID := e.organization(sup, "Câmara de Itu", "")

	// Atendentes cadastram contatos e os vinculam a um órgão pré-cadastrado.
	resp := e.do(http.MethodPost, "/api/contacts", agent, map[string]any{"name": " Maria Souza ", "phone": "+55 (11) 98888-0001", "organizationId": orgID, "sectorIds": []int64{contab.ID}})
	if resp.status != http.StatusCreated {
		t.Fatalf("create: status %d, body %v", resp.status, resp.body)
	}
	org, _ := resp.body["organization"].(map[string]any)
	if resp.body["name"] != "Maria Souza" || resp.body["phone"] != "5511988880001" || resp.body["registered"] != true ||
		org["name"] != "Prefeitura de Itu" || org["cnpj"] != numericCNPJ {
		t.Fatalf("create body: %v", resp.body)
	}
	contactID := id(resp.body)
	otherID := e.contact(agent, "João Lima", "5511988880002", otherOrgID, contab.ID)

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
		resp := e.do(http.MethodPost, "/api/contacts", agent, tc.body)
		if resp.status != tc.want || resp.body["error"] == "" {
			t.Errorf("%s: status %d, want %d (body %v)", tc.name, resp.status, tc.want, resp.body)
		}
	}

	path := fmt.Sprintf("/api/contacts/%d", contactID)
	resp = e.do(http.MethodPut, path, agent, map[string]any{"name": "Maria Souza Lima", "phone": "5511988880009", "organizationId": otherOrgID, "sectorIds": []int64{contab.ID}})
	org, _ = resp.body["organization"].(map[string]any)
	if resp.status != http.StatusOK || resp.body["name"] != "Maria Souza Lima" || resp.body["phone"] != "5511988880009" || org["name"] != "Câmara de Itu" {
		t.Fatalf("update: status %d, body %v", resp.status, resp.body)
	}
	if resp := e.do(http.MethodPut, path, agent, map[string]any{"name": "Maria", "phone": "5511988880002", "organizationId": orgID}); resp.status != http.StatusConflict {
		t.Errorf("update to phone of %d: status %d, want 409", otherID, resp.status)
	}
	if resp := e.do(http.MethodPut, "/api/contacts/999999", agent, map[string]any{"name": "X", "phone": "5511988880010", "organizationId": orgID}); resp.status != http.StatusNotFound {
		t.Errorf("update unknown: status %d, want 404", resp.status)
	}

	var contacts int
	if err := e.pool.QueryRow(t.Context(), "select count(*) from contacts").Scan(&contacts); err != nil {
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
	e.user("admin@exemplo.com", db.UserRoleAdmin, nil)
	token := e.login("admin@exemplo.com", testPassword)
	orgID := e.organization(token, "Prefeitura de Itu", "")
	contab := e.sector("Contabilidade")

	const attempts = 8
	statuses := make([]int, attempts)
	var wg sync.WaitGroup
	for i := range attempts {
		wg.Go(func() {
			resp := e.do(http.MethodPost, "/api/contacts", token, map[string]any{"name": fmt.Sprintf("Pessoa %d", i), "phone": "5511977770000", "organizationId": orgID, "sectorIds": []int64{contab.ID}})
			statuses[i] = resp.status
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
	e.user("admin@exemplo.com", db.UserRoleAdmin, nil)
	token := e.login("admin@exemplo.com", testPassword)
	itu := e.organization(token, "Prefeitura de Itu", numericCNPJ)
	salto := e.organization(token, "Câmara Municipal de Salto", alphanumericCNPJ)
	e.organization(token, "Fundo 100% Educação", "")
	contab := e.sector("Contabilidade")
	e.contact(token, "Maria Souza", "5511988880001", itu, contab.ID)
	e.contact(token, "José Pereira", "5511977770002", itu, contab.ID)
	e.contact(token, "Ana Salto", "5519966660003", salto, contab.ID)

	search := func(path, q string) []string {
		t.Helper()
		return names(e.doList(http.MethodGet, path+"?q="+url.QueryEscape(q), token))
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

func TestDirectorySearchIsLimited(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	e.user("admin@exemplo.com", db.UserRoleAdmin, nil)
	token := e.login("admin@exemplo.com", testPassword)
	if _, err := e.pool.Exec(t.Context(),
		`insert into organizations (name) select 'Órgão ' || lpad(n::text, 3, '0') from generate_series(1, 60) n`); err != nil {
		t.Fatal(err)
	}
	list := e.doList(http.MethodGet, "/api/organizations?q=ORGAO", token)
	if len(list) != 50 || list[0]["name"] != "Órgão 001" {
		t.Fatalf("got %d results starting at %v, want the first 50 by name", len(list), list[0]["name"])
	}
}

// Setores e módulos do contato (spec.md): o filtro da busca e os vínculos do cadastro.
func TestContactSectorsAndModules(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	contab, rh := e.sector("Contabilidade"), e.sector("RH")
	ged := e.sector("GED")
	e.user("ana@exemplo.com", db.UserRoleAgent, &contab.ID)
	e.user("sup@exemplo.com", db.UserRoleSupervisor, &contab.ID)
	e.user("suprh@exemplo.com", db.UserRoleSupervisor, &rh.ID)
	e.user("admin@exemplo.com", db.UserRoleAdmin, nil)
	ana := e.login("ana@exemplo.com", testPassword)
	sup := e.login("sup@exemplo.com", testPassword)
	supRH := e.login("suprh@exemplo.com", testPassword)
	admin := e.login("admin@exemplo.com", testPassword)
	org := e.organization(admin, "Prefeitura", "")

	module := func(token string, sectorID int64, name string) int64 {
		t.Helper()
		resp := e.do(http.MethodPost, fmt.Sprintf("/api/sectors/%d/modules", sectorID), token, map[string]string{"name": name})
		if resp.status != http.StatusCreated {
			t.Fatalf("create module: status %d, body %v", resp.status, resp.body)
		}
		return id(resp.body)
	}
	folha := module(sup, contab.ID, "Folha")
	patrimonio := module(sup, contab.ID, "Patrimônio")
	inativo := module(sup, contab.ID, "Inativo")
	if resp := e.do(http.MethodPut, fmt.Sprintf("/api/sectors/%d/modules/%d", contab.ID, inativo), sup, map[string]any{"name": "Inativo", "active": false}); resp.status != http.StatusOK {
		t.Fatalf("deactivate module: status %d", resp.status)
	}
	ponto := module(supRH, rh.ID, "Ponto")

	// Módulos ativos: todos os papéis do setor; a rota de gestão continua restrita.
	if list := e.doList(http.MethodGet, fmt.Sprintf("/api/sectors/%d/active-modules", contab.ID), ana); fmt.Sprint(names(list)) != "[Folha Patrimônio]" {
		t.Errorf("active modules: %v", list)
	}
	if resp := e.do(http.MethodGet, fmt.Sprintf("/api/sectors/%d/active-modules", rh.ID), ana, nil); resp.status != http.StatusForbidden {
		t.Errorf("active modules of another sector: status %d, want 403", resp.status)
	}
	if resp := e.do(http.MethodGet, fmt.Sprintf("/api/sectors/%d/modules", contab.ID), ana, nil); resp.status != http.StatusForbidden {
		t.Errorf("modules management by agent: status %d, want 403", resp.status)
	}

	form := func(sectors, modules []int64) map[string]any {
		return map[string]any{"name": "Maria", "phone": "5511988880001", "organizationId": org, "sectorIds": sectors, "moduleIds": modules}
	}
	post := func(token string, sectors, modules []int64) int {
		t.Helper()
		return e.do(http.MethodPost, "/api/contacts", token, form(sectors, modules)).status
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
	} {
		if got := post(tc.token, tc.sectors, tc.modules); got != tc.want {
			t.Errorf("%s: status %d, want %d", tc.name, got, tc.want)
		}
	}
	if got := e.count("contacts"); got != 0 {
		t.Fatalf("contacts = %d, want 0: refused requests must not write", got)
	}

	// O administrador escolhe vários setores e módulos de qualquer um deles.
	resp := e.do(http.MethodPost, "/api/contacts", admin, form([]int64{contab.ID, rh.ID}, []int64{folha, ponto}))
	if resp.status != http.StatusCreated {
		t.Fatalf("create: status %d, body %v", resp.status, resp.body)
	}
	maria := id(resp.body)
	links := func() string {
		t.Helper()
		got := e.do(http.MethodGet, fmt.Sprintf("/api/contacts/%d", maria), ana, nil)
		if got.status != http.StatusOK {
			t.Fatalf("get contact: status %d", got.status)
		}
		var sectors, modules []string
		for _, s := range got.body["sectors"].([]any) {
			sectors = append(sectors, s.(map[string]any)["name"].(string))
		}
		for _, m := range got.body["modules"].([]any) {
			modules = append(modules, m.(map[string]any)["name"].(string))
		}
		return fmt.Sprint(sectors, modules)
	}
	if got := links(); got != "[Contabilidade RH] [Folha Ponto]" {
		t.Fatalf("after create: %s", got)
	}
	if resp := e.do(http.MethodGet, "/api/contacts/999999", ana, nil); resp.status != http.StatusNotFound {
		t.Errorf("get unknown contact: status %d, want 404", resp.status)
	}

	put := func(token string, sectors, modules []int64) int {
		t.Helper()
		return e.do(http.MethodPut, fmt.Sprintf("/api/contacts/%d", maria), token, form(sectors, modules)).status
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
	// Módulo já vinculado continua depois de desativado; a atendente pode mantê-lo ao salvar.
	if resp := e.do(http.MethodPut, fmt.Sprintf("/api/sectors/%d/modules/%d", contab.ID, folha), sup, map[string]any{"name": "Folha", "active": false}); resp.status != http.StatusOK {
		t.Fatalf("deactivate module: status %d", resp.status)
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
	contab, rh := e.sector("Contabilidade"), e.sector("RH")
	e.user("sup@exemplo.com", db.UserRoleSupervisor, &contab.ID)
	sup := e.login("sup@exemplo.com", testPassword)
	e.user("admin@exemplo.com", db.UserRoleAdmin, nil)
	admin := e.login("admin@exemplo.com", testPassword)
	org := e.organization(admin, "Prefeitura", "")
	resp := e.do(http.MethodPost, fmt.Sprintf("/api/sectors/%d/modules", contab.ID), sup, map[string]string{"name": "Folha"})
	folha := id(resp.body)

	e.contact(sup, "Ana", "5511988880001", org, contab.ID)
	e.contact(admin, "Bia", "5511988880002", org, rh.ID)
	resp = e.do(http.MethodPost, "/api/contacts", admin, map[string]any{"name": "Cris", "phone": "5511988880003", "organizationId": org,
		"sectorIds": []int64{contab.ID, rh.ID}, "moduleIds": []int64{folha}})
	if resp.status != http.StatusCreated {
		t.Fatalf("create: status %d, body %v", resp.status, resp.body)
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
		if got := names(e.doList(http.MethodGet, "/api/contacts"+tc.query, sup)); fmt.Sprint(got) != fmt.Sprint(tc.want) {
			t.Errorf("contacts%s: got %v, want %v", tc.query, got, tc.want)
		}
	}
	for _, query := range []string{"?sectorId=abc", "?moduleId=0"} {
		if resp := e.do(http.MethodGet, "/api/contacts"+query, sup, nil); resp.status != http.StatusUnprocessableEntity {
			t.Errorf("contacts%s: status %d, want 422", query, resp.status)
		}
	}
}
