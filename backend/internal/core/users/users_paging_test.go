package users_test

import (
	"fmt"
	"net/http"
	"net/url"
	"slices"
	"testing"

	"github.com/gcaspp-labs/xet/backend/internal/db"
)

// A lista de usuários vem em páginas de 20, feitas no servidor (#130): a
// resposta traz só os itens da página, o total e a página devolvida.
func TestUserListPages(t *testing.T) {
	t.Parallel()
	e, _, token := pagingEnv(t)
	sector := e.Sector("Contabilidade")
	e.seedNumberedUsers("Pessoa", sector.ID, 44)

	all := append(numbered("Pessoa", 1, 44), "Zuleica Admin")
	reversed := slices.Clone(all)
	slices.Reverse(reversed)
	for _, tc := range []struct {
		query       string
		want        []string
		total, page float64
	}{
		{"", all[:20], 45, 1},
		{"?page=2", all[20:40], 45, 2},
		{"?page=3", all[40:], 45, 3},
		// Página além da última devolve a última; página inválida, a primeira.
		{"?page=9", all[40:], 45, 3},
		{"?page=abc", all[:20], 45, 1},
		{"?page=0", all[:20], 45, 1},
		{"?direction=desc", reversed[:20], 45, 1},
		{"?sort=name&direction=desc&page=3", reversed[40:], 45, 3},
		// Coluna desconhecida cai na ordem padrão, com a direção padrão.
		{"?sort=email&direction=desc", all[:20], 45, 1},
		{"?sort=name&direction=sideways", all[:20], 45, 1},
	} {
		items, resp := userPage(e, token, tc.query)
		if got := field(items, "name"); !slices.Equal(got, tc.want) {
			t.Errorf("users%s: got %v, want %v", tc.query, got, tc.want)
		}
		if resp.Body["total"] != tc.total || resp.Body["page"] != tc.page || resp.Body["pageSize"] != float64(20) {
			t.Errorf("users%s: total %v page %v pageSize %v, want %v %v 20",
				tc.query, resp.Body["total"], resp.Body["page"], resp.Body["pageSize"], tc.total, tc.page)
		}
	}
}

// Cada coluna de dados ordena nas duas direções, ignorando maiúsculas e
// acentos: Papel pelo rótulo, Setor pelo nome com quem não tem setor por
// último, Situação com os ativos primeiro na crescente. Ativos e inativos
// vêm na mesma lista; Situação desempata direto pelo id, e as outras colunas
// pelo nome e depois pelo id.
func TestUserListSortColumns(t *testing.T) {
	t.Parallel()
	e, admin, token := pagingEnv(t)
	e.rename(admin.ID, "Diego Admin")
	aguas := e.Sector("Águas")
	contab := e.Sector("Contabilidade")
	e.seedUser("Ana", "", "", db.UserRoleAgent, &aguas.ID, true)
	e.seedUser("bia", "", "", db.UserRoleAgent, &aguas.ID, true)
	e.seedUser("Bruno", "", "", db.UserRoleSupervisor, &contab.ID, true)
	e.seedUser("Carla", "", "", db.UserRoleAgent, &contab.ID, false)
	e.seedUser("Élio", "", "", db.UserRoleAgent, &aguas.ID, false)

	for _, tc := range []struct {
		query string
		want  []string
	}{
		{"", []string{"Ana", "bia", "Bruno", "Carla", "Diego Admin", "Élio"}},
		{"?sort=name&direction=desc", []string{"Élio", "Diego Admin", "Carla", "Bruno", "bia", "Ana"}},
		// Administrador, Atendente, Supervisor.
		{"?sort=role", []string{"Diego Admin", "Ana", "bia", "Carla", "Élio", "Bruno"}},
		{"?sort=role&direction=desc", []string{"Bruno", "Élio", "Carla", "bia", "Ana", "Diego Admin"}},
		// Sem setor por último.
		{"?sort=sector", []string{"Ana", "bia", "Élio", "Bruno", "Carla", "Diego Admin"}},
		{"?sort=sector&direction=desc", []string{"Carla", "Bruno", "Élio", "bia", "Ana", "Diego Admin"}},
		// Ativos primeiro na crescente; inativos primeiro na decrescente; os
		// empates saem na ordem do id (Diego Admin, Ana, bia e Bruno foram
		// criados nesta ordem).
		{"?sort=status", []string{"Diego Admin", "Ana", "bia", "Bruno", "Carla", "Élio"}},
		{"?sort=status&direction=desc", []string{"Élio", "Carla", "Bruno", "bia", "Ana", "Diego Admin"}},
	} {
		if got := userNames(e, token, tc.query); !slices.Equal(got, tc.want) {
			t.Errorf("users%s: got %v, want %v", tc.query, got, tc.want)
		}
	}
}

// Nomes iguais desempatam pelo id, na mesma direção: nenhum usuário aparece
// em duas páginas nem some entre elas.
func TestUserListTieBreaksByID(t *testing.T) {
	t.Parallel()
	e, _, token := pagingEnv(t)
	sector := e.Sector("Contabilidade")
	var ids []string
	for i := 1; i <= 25; i++ {
		email := fmt.Sprintf("igual%02d@exemplo.com", i)
		e.seedUser("Igual", fmt.Sprintf("Igual %02d", i), email, db.UserRoleAgent, &sector.ID, true)
		ids = append(ids, email)
	}
	// Só os usuários de nome igual: o administrador fica de fora da comparação.
	emails := func(query string) []string {
		var out []string
		for _, page := range []string{"", "&page=2"} {
			items, _ := userPage(e, token, query+page)
			for _, email := range field(items, "email") {
				if email != "admin@exemplo.com" {
					out = append(out, email)
				}
			}
		}
		return out
	}
	reversed := slices.Clone(ids)
	slices.Reverse(reversed)
	for _, sort := range []string{"name", "role", "sector", "status"} {
		if got := emails("?sort=" + sort); !slices.Equal(got, ids) {
			t.Errorf("%s asc: got %v, want %v", sort, got, ids)
		}
		if got := emails("?sort=" + sort + "&direction=desc"); !slices.Equal(got, reversed) {
			t.Errorf("%s desc: got %v, want %v", sort, got, reversed)
		}
	}
}

// A busca procura no nome, no apelido e no e-mail, sem diferenciar maiúsculas
// nem acentos, no servidor, antes de contar e paginar.
func TestUserListSearch(t *testing.T) {
	t.Parallel()
	e, _, token := pagingEnv(t)
	sector := e.Sector("Contabilidade")
	e.seedUser("João Prado", "João Prado", "joao@exemplo.com", db.UserRoleAgent, &sector.ID, true)
	e.seedUser("Lia Souza", "Liazinha", "lia.prado@exemplo.com", db.UserRoleAgent, &sector.ID, false)
	e.seedUser("Rui Costa", "Rui do Prádo", "rui@exemplo.com", db.UserRoleSupervisor, &sector.ID, true)
	e.seedUser("Teo 100%", "Teo", "teo@exemplo.com", db.UserRoleAgent, &sector.ID, true)

	for _, tc := range []struct {
		q    string
		want []string
	}{
		// Nome, e-mail e apelido (com acento), sem diferenciar maiúsculas.
		{"PRADO", []string{"João Prado", "Lia Souza", "Rui Costa"}},
		{"joao", []string{"João Prado"}},
		{"liazinha", []string{"Lia Souza"}},
		{"RUI@exemplo", []string{"Rui Costa"}},
		{"  prádo  ", []string{"João Prado", "Lia Souza", "Rui Costa"}},
		// Curinga do LIKE é texto comum.
		{"%", []string{"Teo 100%"}},
		{"_", nil},
		{"ninguém", nil},
	} {
		items, resp := userPage(e, token, "?q="+url.QueryEscape(tc.q))
		if got := field(items, "name"); !slices.Equal(got, tc.want) {
			t.Errorf("q=%q: got %v, want %v", tc.q, got, tc.want)
		}
		if resp.Body["total"] != float64(len(tc.want)) {
			t.Errorf("q=%q: total %v, want %d", tc.q, resp.Body["total"], len(tc.want))
		}
	}

	// A busca combina com a ordem.
	if got := userNames(e, token, "?q=prado&sort=status&direction=desc"); !slices.Equal(got, []string{"Lia Souza", "Rui Costa", "João Prado"}) {
		t.Errorf("search + status desc: %v", got)
	}
}

// Busca, ordem e página juntas: o total é o da busca, e as páginas recortam o
// resultado já ordenado.
func TestUserListSearchSortAndPage(t *testing.T) {
	t.Parallel()
	e, _, token := pagingEnv(t)
	sector := e.Sector("Contabilidade")
	e.seedNumberedUsers("Busca", sector.ID, 30)
	e.seedNumberedUsers("Outro", sector.ID, 10)

	for _, tc := range []struct {
		query       string
		want        []string
		total, page float64
	}{
		{"?q=busca", numbered("Busca", 1, 20), 30, 1},
		{"?q=BUSCA&page=2", numbered("Busca", 21, 30), 30, 2},
		{"?q=busca&direction=desc&page=2", numbered("Busca", 10, 1), 30, 2},
		{"?q=busca&sort=sector&direction=desc&page=5", numbered("Busca", 10, 1), 30, 2},
		{"?q=outro&page=2", numbered("Outro", 1, 10), 10, 1},
		{"?q=nada&page=3", nil, 0, 1},
	} {
		items, resp := userPage(e, token, tc.query)
		if got := field(items, "name"); !slices.Equal(got, tc.want) {
			t.Errorf("users%s: got %v, want %v", tc.query, got, tc.want)
		}
		if resp.Body["total"] != tc.total || resp.Body["page"] != tc.page {
			t.Errorf("users%s: total %v page %v, want %v %v", tc.query, resp.Body["total"], resp.Body["page"], tc.total, tc.page)
		}
		if raw, ok := resp.Body["items"].([]any); !ok || raw == nil {
			t.Errorf("users%s: items must be a list, got %v", tc.query, resp.Body["items"])
		}
	}
}

// A lista é só do administrador: atendente e supervisor recebem 403, sem
// itens nem total; a resposta nunca traz o hash da senha.
func TestUserListIsAdminOnly(t *testing.T) {
	t.Parallel()
	e, _, token := pagingEnv(t)
	sector := e.Sector("Contabilidade")
	e.User("agente@exemplo.com", db.UserRoleAgent, &sector.ID)
	e.User("super@exemplo.com", db.UserRoleSupervisor, &sector.ID)
	for _, who := range []string{"agente@exemplo.com", "super@exemplo.com"} {
		resp := e.Do(http.MethodGet, "/api/users?q=a&sort=role", e.Login(who, testPassword), nil)
		if resp.Status != http.StatusForbidden {
			t.Errorf("%s: status %d, want 403", who, resp.Status)
		}
		if _, ok := resp.Body["items"]; ok {
			t.Errorf("%s: got items %v", who, resp.Body)
		}
		if _, ok := resp.Body["total"]; ok {
			t.Errorf("%s: got total %v", who, resp.Body)
		}
	}
	items, _ := userPage(e, token, "")
	if len(items) != 3 {
		t.Fatalf("items: %v", items)
	}
	for _, item := range items {
		for key := range item {
			if slices.Contains([]string{"passwordHash", "password_hash", "password", "PasswordHash"}, key) {
				t.Fatalf("list must not contain the password hash: %v", item)
			}
		}
	}
}

// A Situação desempata pelo id, não pelo nome: os nomes entram na ordem
// inversa ao id, e a ordem aprovada atravessa as páginas nas duas direções.
func TestUserListStatusOrdersByID(t *testing.T) {
	t.Parallel()
	e, _, token := pagingEnv(t)
	sector := e.Sector("Contabilidade")
	email := func(prefix string, n int) string { return fmt.Sprintf("%s%02d@exemplo.com", prefix, n) }
	// 25 ativos e 25 inativos, cada grupo inserido com o nome em ordem inversa
	// ao id: o menor id fica com o maior nome.
	for i := 25; i >= 1; i-- {
		e.seedUser(fmt.Sprintf("Ativo %02d", i), "", email("ativo", i), db.UserRoleAgent, &sector.ID, true)
	}
	for i := 25; i >= 1; i-- {
		e.seedUser(fmt.Sprintf("Inativo %02d", i), "", email("inativo", i), db.UserRoleAgent, &sector.ID, false)
	}
	var active, inactive []string
	for i := 25; i >= 1; i-- {
		active = append(active, email("ativo", i))
		inactive = append(inactive, email("inativo", i))
	}
	// 51 usuários com o administrador: três páginas.
	seeded := func(query string) []string {
		var out []string
		for page := 1; page <= 3; page++ {
			items, resp := userPage(e, token, fmt.Sprintf("%s&page=%d", query, page))
			if resp.Body["page"] != float64(page) {
				t.Fatalf("users%s&page=%d: page %v, want %d", query, page, resp.Body["page"], page)
			}
			for _, got := range field(items, "email") {
				if got != "admin@exemplo.com" {
					out = append(out, got)
				}
			}
		}
		return out
	}
	want := func(groups ...[]string) []string {
		var out []string
		for _, group := range groups {
			out = append(out, group...)
		}
		return out
	}
	reverse := func(in []string) []string {
		out := slices.Clone(in)
		slices.Reverse(out)
		return out
	}
	// Ativos primeiro na crescente, pelo id; na decrescente, inativos primeiro
	// e o id também desce.
	if got := seeded("?sort=status"); !slices.Equal(got, want(active, inactive)) {
		t.Errorf("status asc: got %v, want %v", got, want(active, inactive))
	}
	if got := seeded("?sort=status&direction=desc"); !slices.Equal(got, want(reverse(inactive), reverse(active))) {
		t.Errorf("status desc: got %v, want %v", got, want(reverse(inactive), reverse(active)))
	}
}
