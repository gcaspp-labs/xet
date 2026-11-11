package directory_test

import (
	"fmt"
	"net/http"
	"net/url"
	"testing"

	"github.com/gcaspp-labs/xet/backend/internal/db"
)

// A lista de órgãos vem em páginas de 20, feitas no servidor (spec #125): a
// resposta traz só os itens da página, o total filtrado e a página devolvida.
func TestOrganizationListPages(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	e.User("admin@exemplo.com", db.UserRoleAdmin, nil)
	admin := e.Login("admin@exemplo.com", testPassword)
	itu, salto := e.Municipality("Itu"), e.Municipality("Salto")
	// 45 órgãos: os 40 primeiros em Itu, os 5 últimos em Salto.
	if _, err := e.Pool.Exec(t.Context(), `
		insert into organizations (name, municipality_id)
		select 'Órgão ' || lpad(n::text, 2, '0'), case when n <= 40 then $1::bigint else $2::bigint end
		from generate_series(1, 45) n`, itu, salto); err != nil {
		t.Fatal(err)
	}

	// numbered lists "Órgão <from>" to "Órgão <to>", up or down.
	numbered := func(from, to int) []string {
		step := 1
		if to < from {
			step = -1
		}
		var out []string
		for n := from; n != to+step; n += step {
			out = append(out, fmt.Sprintf("Órgão %02d", n))
		}
		return out
	}
	for _, tc := range []struct {
		query       string
		want        []string
		total, page float64
	}{
		{"", numbered(1, 20), 45, 1},
		{"?page=2", numbered(21, 40), 45, 2},
		{"?page=3", numbered(41, 45), 45, 3},
		// Página além da última devolve a última; página inválida, a primeira.
		{"?page=9", numbered(41, 45), 45, 3},
		{"?page=abc", numbered(1, 20), 45, 1},
		{"?page=0", numbered(1, 20), 45, 1},
		{"?direction=desc", numbered(45, 26), 45, 1},
		{"?sort=name&direction=desc&page=3", numbered(5, 1), 45, 3},
		{"?sort=municipality&direction=desc", append(numbered(45, 41), numbered(40, 26)...), 45, 1},
		// Coluna desconhecida cai na ordem padrão, com a direção padrão.
		{"?sort=phone&direction=desc", numbered(1, 20), 45, 1},
		{"?sort=name&direction=sideways", numbered(1, 20), 45, 1},
		// Busca e filtro valem para a lista inteira antes de contar e paginar,
		// sem o antigo corte de 50.
		{fmt.Sprintf("?municipalityId=%d", salto), numbered(41, 45), 5, 1},
		{"?q=salto", numbered(41, 45), 5, 1},
		{"?q=" + url.QueryEscape("orgao 3"), numbered(30, 39), 10, 1},
		{fmt.Sprintf("?q=ORGAO&municipalityId=%d&direction=desc&page=2", itu), numbered(20, 1), 40, 2},
		{fmt.Sprintf("?q=itu&municipalityId=%d&page=5", salto), nil, 0, 1},
		{"?q=inexistente&page=3", nil, 0, 1},
	} {
		items, resp := e.DoPage("/api/organizations"+tc.query, admin)
		if got := names(items); fmt.Sprint(got) != fmt.Sprint(tc.want) {
			t.Errorf("organizations%s: got %v, want %v", tc.query, got, tc.want)
		}
		if resp.Body["total"] != tc.total || resp.Body["page"] != tc.page || resp.Body["pageSize"] != float64(20) {
			t.Errorf("organizations%s: total %v, page %v, page size %v; want %v, %v, 20",
				tc.query, resp.Body["total"], resp.Body["page"], resp.Body["pageSize"], tc.total, tc.page)
		}
	}
}

// Nome, Município e CNPJ ordenam nas duas direções sem diferenciar maiúsculas
// nem acentos; órgãos sem CNPJ ficam no fim da ordem por CNPJ.
func TestOrganizationListSorts(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	e.User("admin@exemplo.com", db.UserRoleAdmin, nil)
	admin := e.Login("admin@exemplo.com", testPassword)
	post := func(name, municipality, cnpj string) {
		t.Helper()
		resp := e.Do(http.MethodPost, "/api/organizations", admin,
			map[string]any{"name": name, "cnpj": cnpj, "municipalityId": e.Municipality(municipality)})
		if resp.Status != http.StatusCreated {
			t.Fatalf("create %s: status %d, body %v", name, resp.Status, resp.Body)
		}
	}
	post("Prefeitura de Itu", "Itu", numericCNPJ)
	post("câmara de Salto", "Salto", alphanumericCNPJ)
	post("Órgão Central", "Águas de Lindóia", "")
	post("Banco do Povo", "Bauru", "05000000000105")
	post("Escola", "Itu", "")

	for _, tc := range []struct {
		query string
		want  []string
	}{
		{"", []string{"Banco do Povo", "câmara de Salto", "Escola", "Órgão Central", "Prefeitura de Itu"}},
		{"?sort=name&direction=asc", []string{"Banco do Povo", "câmara de Salto", "Escola", "Órgão Central", "Prefeitura de Itu"}},
		{"?sort=name&direction=desc", []string{"Prefeitura de Itu", "Órgão Central", "Escola", "câmara de Salto", "Banco do Povo"}},
		// Mesmo município: o nome desempata, na mesma direção.
		{"?sort=municipality", []string{"Órgão Central", "Banco do Povo", "Escola", "Prefeitura de Itu", "câmara de Salto"}},
		{"?sort=municipality&direction=desc", []string{"câmara de Salto", "Prefeitura de Itu", "Escola", "Banco do Povo", "Órgão Central"}},
		{"?sort=cnpj", []string{"Banco do Povo", "Prefeitura de Itu", "câmara de Salto", "Escola", "Órgão Central"}},
		{"?sort=cnpj&direction=desc", []string{"câmara de Salto", "Prefeitura de Itu", "Banco do Povo", "Órgão Central", "Escola"}},
		{"?sort=organization&direction=desc", []string{"Banco do Povo", "câmara de Salto", "Escola", "Órgão Central", "Prefeitura de Itu"}},
	} {
		if got := names(e.DoPageItems("/api/organizations"+tc.query, admin)); fmt.Sprint(got) != fmt.Sprint(tc.want) {
			t.Errorf("organizations%s: got %v, want %v", tc.query, got, tc.want)
		}
	}
}

// Em todas as colunas e direções, cada órgão aparece numa página só, mesmo
// quando a coluna empata (todos sem CNPJ, todos no mesmo município).
func TestOrganizationListTieBreakIsStable(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	e.User("admin@exemplo.com", db.UserRoleAdmin, nil)
	admin := e.Login("admin@exemplo.com", testPassword)
	if _, err := e.Pool.Exec(t.Context(), `
		insert into organizations (name, municipality_id)
		select case when n % 2 = 0 then 'CÂMARA ' else 'camara ' end || n, (select id from municipalities where name = 'Itu')
		from generate_series(1, 30) n`); err != nil {
		t.Fatal(err)
	}
	for _, sort := range []string{"name", "municipality", "cnpj"} {
		for _, direction := range []string{"asc", "desc"} {
			seen := map[float64]bool{}
			for page := 1; page <= 2; page++ {
				for _, item := range e.DoPageItems(fmt.Sprintf("/api/organizations?sort=%s&direction=%s&page=%d", sort, direction, page), admin) {
					seen[item["id"].(float64)] = true
				}
			}
			if len(seen) != 30 {
				t.Errorf("%s %s: got %d distinct organizations in two pages, want 30", sort, direction, len(seen))
			}
		}
	}
}

// Sem órgãos, a lista é uma página vazia válida.
func TestOrganizationListEmpty(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	e.User("admin@exemplo.com", db.UserRoleAdmin, nil)
	items, resp := e.DoPage("/api/organizations?page=4", e.Login("admin@exemplo.com", testPassword))
	if len(items) != 0 || resp.Body["total"] != float64(0) || resp.Body["page"] != float64(1) {
		t.Errorf("empty list: %v", resp.Body)
	}
}
