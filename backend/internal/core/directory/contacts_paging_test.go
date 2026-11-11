package directory_test

import (
	"fmt"
	"net/url"
	"testing"

	"github.com/gcaspp-labs/xet/backend/internal/db"
)

// A lista de contatos vem em páginas de 20, feitas no servidor (spec #125): a
// resposta traz só os itens da página, o total filtrado e a página devolvida.
func TestContactListPages(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	contab, rh := e.Sector("Contabilidade"), e.Sector("RH")
	e.User("admin@exemplo.com", db.UserRoleAdmin, nil)
	admin := e.Login("admin@exemplo.com", testPassword)
	org := e.Organization(admin, "Prefeitura de Itu", "")
	// 45 contatos em Contabilidade; os 5 primeiros também em RH, para o total
	// não contar duas vezes quem está em vários setores.
	if _, err := e.Pool.Exec(t.Context(), `
		with c as (
			insert into contacts (name, phone, organization_id, registered)
			select 'Contato ' || lpad(n::text, 2, '0'), '55119000000' || lpad(n::text, 2, '0'), $1::bigint, true
			from generate_series(1, 45) n
			returning id, name)
		insert into contact_sectors (contact_id, sector_id)
		select id, $2::bigint from c
		union all
		select id, $3::bigint from c where name <= 'Contato 05'`, org, contab.ID, rh.ID); err != nil {
		t.Fatal(err)
	}

	// contato lists "Contato <from>" to "Contato <to>", up or down.
	contato := func(from, to int) []string {
		step := 1
		if to < from {
			step = -1
		}
		var out []string
		for n := from; n != to+step; n += step {
			out = append(out, fmt.Sprintf("Contato %02d", n))
		}
		return out
	}
	for _, tc := range []struct {
		query       string
		want        []string
		total, page float64
	}{
		{"", contato(1, 20), 45, 1},
		{"?page=2", contato(21, 40), 45, 2},
		{"?page=3", contato(41, 45), 45, 3},
		// Página além da última devolve a última; página inválida, a primeira.
		{"?page=9", contato(41, 45), 45, 3},
		{"?page=abc", contato(1, 20), 45, 1},
		{"?page=0", contato(1, 20), 45, 1},
		{"?page=-2", contato(1, 20), 45, 1},
		{"?direction=desc", contato(45, 26), 45, 1},
		{"?sort=name&direction=desc&page=3", contato(5, 1), 45, 3},
		// Coluna desconhecida cai na ordem padrão, com a direção padrão.
		{"?sort=phone&direction=desc", contato(1, 20), 45, 1},
		{"?sort=name&direction=sideways", contato(1, 20), 45, 1},
		// Busca e filtros valem para a lista inteira antes de contar e paginar.
		{fmt.Sprintf("?sectorId=%d", rh.ID), contato(1, 5), 5, 1},
		{fmt.Sprintf("?sectorId=%d", contab.ID), contato(1, 20), 45, 1},
		{"?q=" + url.QueryEscape("contato 3"), contato(30, 39), 10, 1},
		{fmt.Sprintf("?q=prefeitura&sectorId=%d&sort=name&direction=desc&page=2", contab.ID), contato(25, 6), 45, 2},
		{fmt.Sprintf("?q=prefeitura&sectorId=%d&page=5", rh.ID), contato(1, 5), 5, 1},
		{"?q=inexistente&page=3", nil, 0, 1},
	} {
		items, resp := e.DoPage("/api/contacts"+tc.query, admin)
		if got := names(items); fmt.Sprint(got) != fmt.Sprint(tc.want) {
			t.Errorf("contacts%s: got %v, want %v", tc.query, got, tc.want)
		}
		if resp.Body["total"] != tc.total || resp.Body["page"] != tc.page || resp.Body["pageSize"] != float64(20) {
			t.Errorf("contacts%s: total %v, page %v, page size %v; want %v, %v, 20",
				tc.query, resp.Body["total"], resp.Body["page"], resp.Body["pageSize"], tc.total, tc.page)
		}
	}
}

// As colunas Contato e Órgão ordenam nas duas direções sem diferenciar
// maiúsculas nem acentos, e o id desempata nomes iguais.
func TestContactListSorts(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	contab := e.Sector("Contabilidade")
	e.User("admin@exemplo.com", db.UserRoleAdmin, nil)
	admin := e.Login("admin@exemplo.com", testPassword)
	prefeitura := e.Organization(admin, "Prefeitura de Itu", "")
	camara := e.Organization(admin, "câmara de Salto", "")
	orgao := e.Organization(admin, "Órgão Central", "")
	e.Contact(admin, "Érica", "5511988880001", prefeitura, contab.ID)
	e.Contact(admin, "bruno", "5511988880002", camara, contab.ID)
	e.Contact(admin, "ana", "5511988880003", camara, contab.ID)
	e.Contact(admin, "Bruno", "5511988880004", orgao, contab.ID)
	e.Contact(admin, "Álvaro", "5511988880005", prefeitura, contab.ID)
	// Contato que escreveu e ainda não foi cadastrado: sem órgão, vai para o fim.
	if _, err := e.Pool.Exec(t.Context(),
		`insert into contacts (name, phone, registered) values ('Zeca', '5511988880006', false)`); err != nil {
		t.Fatal(err)
	}

	for _, tc := range []struct {
		query string
		want  []string
	}{
		{"", []string{"Álvaro", "ana", "bruno", "Bruno", "Érica", "Zeca"}},
		{"?sort=name", []string{"Álvaro", "ana", "bruno", "Bruno", "Érica", "Zeca"}},
		{"?sort=name&direction=asc", []string{"Álvaro", "ana", "bruno", "Bruno", "Érica", "Zeca"}},
		{"?sort=name&direction=desc", []string{"Zeca", "Érica", "Bruno", "bruno", "ana", "Álvaro"}},
		{"?sort=organization", []string{"ana", "bruno", "Bruno", "Álvaro", "Érica", "Zeca"}},
		{"?sort=organization&direction=desc", []string{"Érica", "Álvaro", "Bruno", "bruno", "ana", "Zeca"}},
		{"?sort=municipality&direction=desc", []string{"Álvaro", "ana", "bruno", "Bruno", "Érica", "Zeca"}},
	} {
		if got := names(e.DoPageItems("/api/contacts"+tc.query, admin)); fmt.Sprint(got) != fmt.Sprint(tc.want) {
			t.Errorf("contacts%s: got %v, want %v", tc.query, got, tc.want)
		}
	}
}

// Mesmo com nomes iguais, cada contato aparece numa página só: o id desempata.
func TestContactListTieBreakIsStable(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	e.User("admin@exemplo.com", db.UserRoleAdmin, nil)
	admin := e.Login("admin@exemplo.com", testPassword)
	if _, err := e.Pool.Exec(t.Context(), `
		insert into contacts (name, phone, registered)
		select case when n % 2 = 0 then 'MARIA' else 'mária' end, '55119000000' || lpad(n::text, 2, '0'), false
		from generate_series(1, 30) n`); err != nil {
		t.Fatal(err)
	}
	for _, direction := range []string{"asc", "desc"} {
		var ids []float64
		for page := 1; page <= 2; page++ {
			for _, item := range e.DoPageItems(fmt.Sprintf("/api/contacts?direction=%s&page=%d", direction, page), admin) {
				ids = append(ids, item["id"].(float64))
			}
		}
		if len(ids) != 30 {
			t.Fatalf("%s: got %d contacts, want 30", direction, len(ids))
		}
		for i := 1; i < len(ids); i++ {
			if direction == "asc" && ids[i] <= ids[i-1] || direction == "desc" && ids[i] >= ids[i-1] {
				t.Fatalf("%s: ids out of order: %v", direction, ids)
			}
		}
	}
}

// Sem órgãos nem contatos, a lista é uma página vazia válida.
func TestContactListEmpty(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	e.User("admin@exemplo.com", db.UserRoleAdmin, nil)
	items, resp := e.DoPage("/api/contacts?page=4", e.Login("admin@exemplo.com", testPassword))
	if len(items) != 0 || resp.Body["total"] != float64(0) || resp.Body["page"] != float64(1) {
		t.Errorf("empty list: %v", resp.Body)
	}
}
