package helpdesk_test

import (
	"fmt"
	"net/http"
	"net/url"
	"slices"
	"testing"

	"github.com/gcaspp-labs/xet/backend/internal/db"
)

// subjectPage reads a page of the subject list of the sector: the items, the
// total the filter finds and the page returned.
func (e *testEnv) subjectPage(sectorID int64, token, query string) ([]map[string]any, response) {
	e.T.Helper()
	return e.DoPage(subjectsPath(sectorID)+query, token)
}

// subjectPageNames lists the subjects of a page of the sector.
func (e *testEnv) subjectPageNames(sectorID int64, token, query string) []string {
	e.T.Helper()
	items, _ := e.subjectPage(sectorID, token, query)
	return names(items)
}

// subjectSolutions lists the solution bodies of each subject of a page, by name.
func (e *testEnv) subjectSolutions(sectorID int64, token, query string) map[string][]string {
	e.T.Helper()
	items, _ := e.subjectPage(sectorID, token, query)
	out := map[string][]string{}
	for _, item := range items {
		name, _ := item["name"].(string)
		out[name] = solutionBodiesOf(item)
	}
	return out
}

// subjectCount returns how many solutions each subject of a page says it has.
func (e *testEnv) subjectCount(sectorID int64, token, query string) map[string]float64 {
	e.T.Helper()
	items, _ := e.subjectPage(sectorID, token, query)
	out := map[string]float64{}
	for _, item := range items {
		name, _ := item["name"].(string)
		out[name], _ = item["solutionCount"].(float64)
	}
	return out
}

func solutionBodiesOf(item map[string]any) []string {
	raw, _ := item["solutions"].([]any)
	out := make([]string, len(raw))
	for i, solution := range raw {
		s, _ := solution.(map[string]any)
		out[i], _ = s["body"].(string)
	}
	return out
}

// seedSubjectsPage inserts n subjects named "Assunto <nn>" in the sector.
func (e *testEnv) seedSubjectsPage(sectorID int64, moduleID *int64, n int) {
	e.T.Helper()
	if _, err := e.Pool.Exec(e.T.Context(), `
		insert into subjects (sector_id, module_id, name)
		select $1, $2, 'Assunto ' || lpad(n::text, 2, '0')
		from generate_series(1, $3) n`, sectorID, moduleID, n); err != nil {
		e.T.Fatal(err)
	}
}

// numberedSubjects lists "Assunto <from>" to "Assunto <to>", up or down.
func numberedSubjects(from, to int) []string {
	return numberedNames("Assunto", from, to)
}

// numberedNames lists "<prefix> <from>" to "<prefix> <to>", up or down.
func numberedNames(prefix string, from, to int) []string {
	step := 1
	if to < from {
		step = -1
	}
	var out []string
	for n := from; n != to+step; n += step {
		out = append(out, fmt.Sprintf("%s %02d", prefix, n))
	}
	return out
}

// A lista de assuntos vem em páginas de 20, feitas no servidor (spec #125): a
// resposta traz só os itens da página, o total filtrado e a página devolvida.
func TestSubjectListPages(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e, sector := c.e, c.sector.ID
	module := e.subjectModule(sector)
	e.seedSubjectsPage(sector, &module, 45)

	for _, tc := range []struct {
		query       string
		want        []string
		total, page float64
	}{
		{"", numberedSubjects(1, 20), 45, 1},
		{"?page=2", numberedSubjects(21, 40), 45, 2},
		{"?page=3", numberedSubjects(41, 45), 45, 3},
		// Página além da última devolve a última; página inválida, a primeira.
		{"?page=9", numberedSubjects(41, 45), 45, 3},
		{"?page=abc", numberedSubjects(1, 20), 45, 1},
		{"?page=0", numberedSubjects(1, 20), 45, 1},
		{"?direction=desc", numberedSubjects(45, 26), 45, 1},
		{"?sort=name&direction=desc&page=3", numberedSubjects(5, 1), 45, 3},
		// Coluna desconhecida cai na ordem padrão, com a direção padrão.
		{"?sort=created&direction=desc", numberedSubjects(1, 20), 45, 1},
		{"?sort=name&direction=sideways", numberedSubjects(1, 20), 45, 1},
	} {
		items, resp := c.e.subjectPage(sector, c.supToken, tc.query)
		if got := names(items); !slices.Equal(got, tc.want) {
			t.Errorf("subjects%s: got %v, want %v", tc.query, got, tc.want)
		}
		if resp.Body["total"] != tc.total || resp.Body["page"] != tc.page || resp.Body["pageSize"] != float64(20) {
			t.Errorf("subjects%s: total %v, page %v, page size %v; want %v, %v, 20",
				tc.query, resp.Body["total"], resp.Body["page"], resp.Body["pageSize"], tc.total, tc.page)
		}
	}
}

// Cada página conta assuntos, não soluções: sem busca, cada assunto vem com
// todas as suas soluções.
func TestSubjectListPagesCountSubjects(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e, sector := c.e, c.sector.ID
	module := e.subjectModule(sector)
	e.seedSubjectsPage(sector, &module, 25)
	if _, err := e.Pool.Exec(t.Context(), `
		insert into subject_solutions (subject_id, body)
		select s.id, 'Solução ' || n
		from subjects s, generate_series(1, 3) n
		where s.sector_id = $1`, sector); err != nil {
		t.Fatal(err)
	}

	items, resp := e.subjectPage(sector, c.supToken, "")
	if len(items) != 20 || resp.Body["total"] != float64(25) {
		t.Fatalf("page 1: %d items, total %v", len(items), resp.Body["total"])
	}
	items, resp = e.subjectPage(sector, c.supToken, "?page=2")
	if len(items) != 5 || resp.Body["total"] != float64(25) || resp.Body["page"] != float64(2) {
		t.Fatalf("page 2: %d items, body %v", len(items), resp.Body)
	}
	for name, bodies := range e.subjectSolutions(sector, c.supToken, "") {
		want := []string{"Solução 1", "Solução 2", "Solução 3"}
		if !slices.Equal(bodies, want) {
			t.Errorf("%s: solutions %v, want %v", name, bodies, want)
		}
	}
}

// As colunas Assunto e Módulo ordenam nas duas direções, sem diferenciar
// maiúsculas nem acentos e com o id desempatando na mesma direção; "Sem módulo"
// fica por último por módulo.
func TestSubjectListSorts(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e, sector := c.e, c.sector.ID
	insert := func(name string, moduleID *int64) {
		t.Helper()
		if _, err := e.Pool.Exec(t.Context(),
			`insert into subjects (sector_id, module_id, name) values ($1, $2, $3)`, sector, moduleID, name); err != nil {
			t.Fatal(err)
		}
	}
	iptu, iss := e.subjectModuleNamed(sector, "IPTU"), e.subjectModuleNamed(sector, "ISS")
	insert("Zebra", &iptu)
	insert("água", &iss)
	insert("Câmara", &iss)
	insert("Banana", &iptu)
	insert("Sem módulo", nil)

	for _, tc := range []struct {
		query string
		want  []string
	}{
		{"", []string{"água", "Banana", "Câmara", "Sem módulo", "Zebra"}},
		{"?sort=name&direction=asc", []string{"água", "Banana", "Câmara", "Sem módulo", "Zebra"}},
		{"?sort=name&direction=desc", []string{"Zebra", "Sem módulo", "Câmara", "Banana", "água"}},
		// Módulo crescente: IPTU, ISS e, por último, os assuntos sem módulo; dentro
		// do mesmo módulo, o id desempata na mesma direção.
		{"?sort=module", []string{"Zebra", "Banana", "água", "Câmara", "Sem módulo"}},
		{"?sort=module&direction=desc", []string{"Câmara", "água", "Banana", "Zebra", "Sem módulo"}},
	} {
		if got := e.subjectPageNames(sector, c.supToken, tc.query); !slices.Equal(got, tc.want) {
			t.Errorf("subjects%s: got %v, want %v", tc.query, got, tc.want)
		}
	}
}

// O id desempata na mesma direção, inclusive quando o empate atravessa páginas:
// "Câmara" e "camara" têm a mesma chave na coluna Assunto, e no mesmo módulo
// empatam também na coluna Módulo. São 24 assuntos, em duas páginas.
func TestSubjectListTieBreakIsStable(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e, sector := c.e, c.sector.ID
	insert := func(moduleID int64, name string) int64 {
		t.Helper()
		var id int64
		if err := e.Pool.QueryRow(t.Context(),
			`insert into subjects (sector_id, module_id, name) values ($1, $2, $3) returning id`,
			sector, moduleID, name).Scan(&id); err != nil {
			t.Fatal(err)
		}
		return id
	}
	// Os ids crescem na ordem de inserção, um módulo por vez.
	byModule := make([][]int64, 0, 12)
	for n := 1; n <= 12; n++ {
		module := e.subjectModuleNamed(sector, fmt.Sprintf("Módulo %02d", n))
		byModule = append(byModule, []int64{insert(module, "Câmara"), insert(module, "camara")})
	}
	all := make([]int64, 0, 24)
	for _, ids := range byModule {
		all = append(all, ids...)
	}
	slices.Sort(all)
	byNameDesc := slices.Clone(all)
	slices.Reverse(byNameDesc)
	// Ordem por módulo: os módulos na ordem do nome e, dentro de cada um, o id.
	byModuleAsc, byModuleDesc := make([]int64, 0, 24), make([]int64, 0, 24)
	for i, ids := range byModule {
		byModuleAsc = append(byModuleAsc, ids...)
		byModuleDesc = append(byModuleDesc, byModule[len(byModule)-1-i][1], byModule[len(byModule)-1-i][0])
	}

	for _, tc := range []struct {
		query string
		want  []int64
	}{
		{"?sort=name", all},
		{"?sort=name&direction=desc", byNameDesc},
		{"?sort=module", byModuleAsc},
		{"?sort=module&direction=desc", byModuleDesc},
	} {
		var got []int64
		for page := 1; page <= 2; page++ {
			items := e.DoPageItems(fmt.Sprintf("%s%s&page=%d", subjectsPath(sector), tc.query, page), c.supToken)
			for _, item := range items {
				got = append(got, int64(item["id"].(float64)))
			}
		}
		if !slices.Equal(got, tc.want) {
			t.Errorf("subjects%s: got ids %v, want %v", tc.query, got, tc.want)
		}
	}
}

// Sem assuntos, a lista é uma página vazia válida.
func TestSubjectListEmpty(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	items, resp := c.e.subjectPage(c.sector.ID, c.supToken, "?page=4")
	if len(items) != 0 || resp.Body["total"] != float64(0) || resp.Body["page"] != float64(1) {
		t.Errorf("empty list: %v", resp.Body)
	}
}

// A busca vale para o setor inteiro antes de contar e paginar, e se combina com
// o filtro de módulo; pelo nome o assunto vem com todas as soluções, e por uma
// solução, só as que batem.
func TestSubjectListSearchAndModuleFilter(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e, sector := c.e, c.sector.ID
	iptu, iss := e.subjectModuleNamed(sector, "IPTU"), e.subjectModuleNamed(sector, "ISS")
	create := func(name string, moduleID *int64, solutions ...string) {
		t.Helper()
		resp := e.Do(http.MethodPost, subjectsPath(sector), c.supToken, map[string]any{"name": name, "moduleId": moduleID})
		if resp.Status != http.StatusCreated {
			t.Fatalf("create %s: status %d, body %v", name, resp.Status, resp.Body)
		}
		for _, body := range solutions {
			if resp := e.Do(http.MethodPost, fmt.Sprintf("%s%d/solutions", subjectsPath(sector), id(resp.Body)), c.supToken, map[string]any{"body": body}); resp.Status != http.StatusCreated {
				t.Fatalf("solution of %s: status %d, body %v", name, resp.Status, resp.Body)
			}
		}
	}
	create("Contracheque", &iptu, "Enviada a segunda via.", "Orientado a consultar o portal.")
	create("Férias", &iss, "Agendadas pelo portal.", "Período confirmado.")
	create("Admissão", &iss, "Documentos conferidos.")
	// Sem módulo: só os assuntos antigos ficam assim, então entra direto no banco.
	if _, err := e.Pool.Exec(t.Context(),
		`insert into subjects (sector_id, name) values ($1, 'Licença')`, sector); err != nil {
		t.Fatal(err)
	}

	// Pelo nome, sem acento e em maiúsculas: o assunto vem com todas as soluções.
	query := "?q=" + url.QueryEscape("FERIAS")
	if got := e.subjectPageNames(sector, c.supToken, query); !slices.Equal(got, []string{"Férias"}) {
		t.Fatalf("search by name: %v", got)
	}
	if got := e.subjectSolutions(sector, c.supToken, query)["Férias"]; !slices.Equal(got, []string{"Agendadas pelo portal.", "Período confirmado."}) {
		t.Fatalf("solutions found by name: %v", got)
	}

	// Pela solução: só os assuntos que a têm, cada um com as soluções que batem,
	// e a contagem do assunto continua a da lista inteira.
	query = "?q=" + url.QueryEscape("PORTAL")
	if got := e.subjectPageNames(sector, c.supToken, query); !slices.Equal(got, []string{"Contracheque", "Férias"}) {
		t.Fatalf("search by solution: %v", got)
	}
	if got := e.subjectSolutions(sector, c.supToken, query); !slices.Equal(got["Contracheque"], []string{"Orientado a consultar o portal."}) || !slices.Equal(got["Férias"], []string{"Agendadas pelo portal."}) {
		t.Fatalf("solutions found by solution: %v", got)
	}
	if got := e.subjectCount(sector, c.supToken, query); got["Contracheque"] != 2 || got["Férias"] != 2 {
		t.Fatalf("solution counts: %v", got)
	}

	// Acento na busca encontra o texto sem acento, e o contrário.
	if got := e.subjectPageNames(sector, c.supToken, "?q="+url.QueryEscape("periodo")); !slices.Equal(got, []string{"Férias"}) {
		t.Fatalf("search without accent: %v", got)
	}
	if got := e.subjectPageNames(sector, c.supToken, "?q="+url.QueryEscape("admissao")); !slices.Equal(got, []string{"Admissão"}) {
		t.Fatalf("search without accent on name: %v", got)
	}

	// Filtro de módulo, incluindo "Sem módulo", combinado com a busca e com a
	// paginação: a busca filtra antes de contar e paginar.
	if got := e.subjectPageNames(sector, c.supToken, fmt.Sprintf("?moduleId=%d", iptu)); !slices.Equal(got, []string{"Contracheque"}) {
		t.Fatalf("module filter: %v", got)
	}
	if got := e.subjectPageNames(sector, c.supToken, "?moduleId=none"); !slices.Equal(got, []string{"Licença"}) {
		t.Fatalf("unclassified filter: %v", got)
	}
	if got := e.subjectPageNames(sector, c.supToken, fmt.Sprintf("?moduleId=%d&q=%s", iss, url.QueryEscape("POR"))); !slices.Equal(got, []string{"Férias"}) {
		t.Fatalf("module and search: %v", got)
	}
	if _, resp := e.subjectPage(sector, c.supToken, "?q="+url.QueryEscape("inexistente")+"&page=3"); resp.Body["total"] != float64(0) || resp.Body["page"] != float64(1) {
		t.Fatalf("no results: %v", resp.Body)
	}

	if resp := e.Do(http.MethodGet, subjectsPath(sector)+"?moduleId=abc", c.supToken, nil); resp.Status != http.StatusUnprocessableEntity {
		t.Fatalf("invalid module filter: status %d", resp.Status)
	}
}

// A busca combinada com o filtro de módulo atravessa páginas: o total é o do
// filtro, e cada página traz só os itens dele, na ordem da coluna.
func TestSubjectListSearchAndModuleFilterPages(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e, sector := c.e, c.sector.ID
	iptu, iss := e.subjectModuleNamed(sector, "IPTU"), e.subjectModuleNamed(sector, "ISS")
	insert := func(moduleID *int64, name string) {
		t.Helper()
		if _, err := e.Pool.Exec(t.Context(),
			`insert into subjects (sector_id, module_id, name) values ($1, $2, $3)`, sector, moduleID, name); err != nil {
			t.Fatal(err)
		}
	}
	// 25 no módulo filtrado batem com a busca, 25 batem com a busca em outro
	// módulo e 10 estão no módulo filtrado sem bater: só os primeiros contam.
	for n := 1; n <= 25; n++ {
		insert(&iptu, fmt.Sprintf("Férias %02d", n))
		insert(&iss, fmt.Sprintf("Férias %02d", n))
	}
	for n := 1; n <= 10; n++ {
		insert(&iptu, fmt.Sprintf("Outro assunto %02d", n))
	}

	query := fmt.Sprintf("%s?moduleId=%d&q=%s", subjectsPath(sector), iptu, url.QueryEscape("FERIAS"))
	for _, tc := range []struct {
		page int
		want []string
	}{
		{1, numberedNames("Férias", 1, 20)},
		{2, numberedNames("Férias", 21, 25)},
	} {
		items, resp := e.DoPage(fmt.Sprintf("%s&page=%d", query, tc.page), c.supToken)
		if got := names(items); !slices.Equal(got, tc.want) {
			t.Errorf("page %d: got %v, want %v", tc.page, got, tc.want)
		}
		if resp.Body["total"] != float64(25) || resp.Body["page"] != float64(tc.page) || resp.Body["pageSize"] != float64(20) {
			t.Errorf("page %d: total %v, page %v, page size %v; want 25, %d, 20",
				tc.page, resp.Body["total"], resp.Body["page"], resp.Body["pageSize"], tc.page)
		}
	}

	// A busca por uma solução também atravessa páginas com o filtro: as soluções
	// dos assuntos de fora não entram na conta.
	if _, err := e.Pool.Exec(t.Context(), `
		insert into subject_solutions (subject_id, body)
		select s.id, 'Férias pelo portal.'
		from subjects s
		where s.sector_id = $1 and s.module_id = $2 and s.name like 'Férias%'`, sector, iptu); err != nil {
		t.Fatal(err)
	}
	query = fmt.Sprintf("%s?moduleId=%d&q=%s", subjectsPath(sector), iptu, url.QueryEscape("PORTAL"))
	items, resp := e.DoPage(query+"&page=2", c.supToken)
	if got := names(items); !slices.Equal(got, numberedNames("Férias", 21, 25)) {
		t.Errorf("search by solution on page 2: got %v", got)
	}
	if resp.Body["total"] != float64(25) || resp.Body["page"] != float64(2) {
		t.Errorf("search by solution: total %v, page %v; want 25, 2", resp.Body["total"], resp.Body["page"])
	}
}

// Excluir um assunto da última página faz a lista recuar para a última página
// válida, sem página vazia; excluir uma solução não muda a contagem de assuntos.
func TestSubjectListRecoversAfterDeletion(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e, sector := c.e, c.sector.ID
	module := e.subjectModule(sector)
	e.seedSubjectsPage(sector, &module, 21)
	if resp := e.Do(http.MethodPost, fmt.Sprintf("%s%d/solutions", subjectsPath(sector), e.subjectID(sector, "Assunto 21")), c.supToken, map[string]any{"body": "Solução."}); resp.Status != http.StatusCreated {
		t.Fatalf("create solution: status %d, body %v", resp.Status, resp.Body)
	}
	if _, resp := e.subjectPage(sector, c.supToken, "?page=2"); resp.Body["total"] != float64(21) {
		t.Fatalf("total before delete: %v", resp.Body["total"])
	}

	if resp := e.Do(http.MethodDelete, subjectPath(sector, e.subjectID(sector, "Assunto 21")), c.supToken, nil); resp.Status != http.StatusNoContent {
		t.Fatalf("delete subject: status %d", resp.Status)
	}
	items, resp := e.subjectPage(sector, c.supToken, "?page=2")
	if resp.Body["total"] != float64(20) || resp.Body["page"] != float64(1) || len(items) != 20 {
		t.Fatalf("after deleting the last subject: %d items, body %v", len(items), resp.Body)
	}

	// Excluir uma solução do assunto da página não muda a contagem de assuntos.
	subject := e.subjectID(sector, "Assunto 20")
	if resp := e.Do(http.MethodPost, fmt.Sprintf("%s%d/solutions", subjectsPath(sector), subject), c.supToken, map[string]any{"body": "Outra solução."}); resp.Status != http.StatusCreated {
		t.Fatalf("create solution: status %d", resp.Status)
	}
	solutions := e.solutionIDs(sector, subject)
	if resp := e.Do(http.MethodDelete, fmt.Sprintf("%s%d/solutions/%d", subjectsPath(sector), subject, solutions[0]), c.supToken, nil); resp.Status != http.StatusNoContent {
		t.Fatalf("delete solution: status %d", resp.Status)
	}
	if _, resp := e.subjectPage(sector, c.supToken, ""); resp.Body["total"] != float64(20) {
		t.Fatalf("total after deleting a solution: %v", resp.Body["total"])
	}
}

// O supervisor vê só o setor dele, e cada setor tem a própria lista, a própria
// busca e o próprio total.
func TestSubjectListPerSector(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e := c.e
	first, second := c.sector.ID, e.Sector("Compras").ID
	firstModule, secondModule := e.subjectModule(first), e.subjectModule(second)
	insert := func(sectorID, moduleID int64, name string) {
		t.Helper()
		if _, err := e.Pool.Exec(t.Context(), `insert into subjects (sector_id, module_id, name) values ($1, $2, $3)`,
			sectorID, moduleID, name); err != nil {
			t.Fatal(err)
		}
	}
	insert(first, firstModule, "Férias")
	insert(first, firstModule, "Contracheque")
	insert(second, secondModule, "Licitação")

	if got := e.subjectPageNames(first, c.supToken, ""); !slices.Equal(got, []string{"Contracheque", "Férias"}) {
		t.Fatalf("first sector: %v", got)
	}
	if got := e.subjectPageNames(second, c.adminToken, ""); !slices.Equal(got, []string{"Licitação"}) {
		t.Fatalf("second sector: %v", got)
	}
	if got := e.subjectPageNames(first, c.supToken, "?q="+url.QueryEscape("licita")); len(got) != 0 {
		t.Fatalf("search of the first sector found the subject of the second: %v", got)
	}
	if _, resp := e.subjectPage(second, c.adminToken, ""); resp.Body["total"] != float64(1) {
		t.Fatalf("second sector total: %v", resp.Body["total"])
	}
}

func (e *testEnv) subjectModuleNamed(sectorID int64, name string) int64 {
	e.T.Helper()
	module, err := e.Q.CreateModule(e.T.Context(), db.CreateModuleParams{SectorID: sectorID, Name: name})
	if err != nil {
		e.T.Fatal(err)
	}
	return module.ID
}

func (e *testEnv) solutionIDs(sectorID, subjectID int64) []int64 {
	e.T.Helper()
	solutions, err := e.Q.ListSubjectSolutions(e.T.Context(), subjectID)
	if err != nil {
		e.T.Fatal(err)
	}
	out := make([]int64, len(solutions))
	for i, s := range solutions {
		out[i] = s.ID
	}
	return out
}
