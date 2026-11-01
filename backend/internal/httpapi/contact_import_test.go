package httpapi

import (
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"

	"github.com/gcaspp-labs/xet/backend/internal/core/auth"
	"github.com/gcaspp-labs/xet/backend/internal/core/realtime"
	"github.com/gcaspp-labs/xet/backend/internal/core/users"
	"github.com/gcaspp-labs/xet/backend/internal/db"
	"github.com/gcaspp-labs/xet/backend/internal/directory"
	"github.com/gcaspp-labs/xet/backend/internal/messaging"
)

// connectBook connects the sector number with this address book.
func (e *testEnv) connectBook(sectorID int64, contacts ...messaging.SavedContact) {
	e.t.Helper()
	if err := e.whatsapp.Connect(e.t.Context(), messaging.Account{SectorID: sectorID}); err != nil {
		e.t.Fatal(err)
	}
	if err := e.whatsapp.Pair(e.t.Context(), sectorID, fmt.Sprintf("%d@s.whatsapp.net", 5511900000000+sectorID)); err != nil {
		e.t.Fatal(err)
	}
	e.whatsapp.SetSavedContacts(sectorID, contacts...)
}

func (e *testEnv) importContacts(token string, sectorID, orgID int64, phones ...string) map[string]any {
	e.t.Helper()
	resp := e.do(http.MethodPost, fmt.Sprintf("/api/sectors/%d/saved-contacts/import", sectorID), token,
		map[string]any{"phones": phones, "organizationId": orgID})
	if resp.status != http.StatusOK {
		e.t.Fatalf("import: status %d, body %v", resp.status, resp.body)
	}
	return resp.body
}

func (e *testEnv) contactByPhone(phone string) db.Contact {
	e.t.Helper()
	c, err := e.q.GetContactByPhone(e.t.Context(), []string{phone})
	if err != nil {
		e.t.Fatalf("contact %s: %v", phone, err)
	}
	return c
}

func (e *testEnv) contactCount() int {
	e.t.Helper()
	var n int
	if err := e.pool.QueryRow(e.t.Context(), "select count(*) from contacts").Scan(&n); err != nil {
		e.t.Fatal(err)
	}
	return n
}

func (e *testEnv) contactSectorIDs(contactID int64) string {
	e.t.Helper()
	rows, err := e.q.ListSectorsOfContacts(e.t.Context(), []int64{contactID})
	if err != nil {
		e.t.Fatal(err)
	}
	ids := make([]int64, len(rows))
	for i, r := range rows {
		ids[i] = r.ID
	}
	return fmt.Sprint(ids)
}

func wantCounts(t *testing.T, body map[string]any, created, existing, unavailable int) {
	t.Helper()
	if body["created"] != float64(created) || body["existing"] != float64(existing) || body["unavailable"] != float64(unavailable) {
		t.Fatalf("result %v, want created %d, existing %d, unavailable %d", body, created, existing, unavailable)
	}
}

func TestSavedContactsShowOnlyNameAndPhone(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	contab := e.sector("Contabilidade")
	e.user("ana@exemplo.com", db.UserRoleAgent, &contab.ID)
	token := e.login("ana@exemplo.com", testPassword)
	e.connectBook(contab.ID,
		messaging.SavedContact{Name: "Zélia", Phone: "5511988880002"},
		messaging.SavedContact{Name: "  ", Phone: "5511988880003"},
		messaging.SavedContact{Name: "Sem telefone", Phone: ""},
		messaging.SavedContact{Name: "Número curto", Phone: "123"},
		messaging.SavedContact{Name: "ana", Phone: "5511988880001"},
		messaging.SavedContact{Name: "ana", Phone: "5511988880001"},
	)

	list := e.doList(http.MethodGet, fmt.Sprintf("/api/sectors/%d/saved-contacts", contab.ID), token)
	if fmt.Sprint(names(list)) != "[ana Zélia]" || list[0]["phone"] != "5511988880001" {
		t.Fatalf("list: %v", list)
	}
	// Listar não cadastra ninguém: a importação é sempre uma ação manual.
	if n := e.contactCount(); n != 0 {
		t.Fatalf("contacts after listing: %d", n)
	}
	if list[0]["exists"] != false || list[1]["exists"] != false {
		t.Fatalf("exists before importing: %v", list)
	}

	// Quem já existe é indicado, também pela variante do nono dígito.
	e.user("admin@exemplo.com", db.UserRoleAdmin, nil)
	org := e.organization(e.login("admin@exemplo.com", testPassword), "Prefeitura", "")
	e.contact(token, "Cadastrada", "551188880001", org, contab.ID)
	list = e.doList(http.MethodGet, fmt.Sprintf("/api/sectors/%d/saved-contacts", contab.ID), token)
	if list[0]["exists"] != true || list[1]["exists"] != false {
		t.Fatalf("exists after registering the variant: %v", list)
	}
}

func TestImportContacts(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	contab := e.sector("Contabilidade")
	ana := e.user("ana@exemplo.com", db.UserRoleAgent, &contab.ID)
	e.user("admin@exemplo.com", db.UserRoleAdmin, nil)
	token := e.login("ana@exemplo.com", testPassword)
	org := e.organization(e.login("admin@exemplo.com", testPassword), "Prefeitura", "")
	e.connectBook(contab.ID,
		messaging.SavedContact{Name: "Maria", Phone: "5511988880001"},
		messaging.SavedContact{Name: "João", Phone: "5511988880002"},
		messaging.SavedContact{Name: "Não escolhido", Phone: "5511988880003"},
		messaging.SavedContact{Name: "Sem órgão", Phone: "5511988880004"},
	)

	// Selecionados, com órgão: ficam cadastrados e no setor do número. O telefone
	// fora da agenda é ignorado; o cliente não tem como informar o nome.
	body := e.importContacts(token, contab.ID, org, "5511988880001", "5511988880002", "5511988880002", "5511977770000")
	wantCounts(t, body, 2, 0, 1)
	maria := e.contactByPhone("5511988880001")
	if maria.Name != "Maria" || !maria.Registered || maria.OrganizationID == nil || *maria.OrganizationID != org {
		t.Fatalf("maria: %+v", maria)
	}
	if got := e.contactSectorIDs(maria.ID); got != fmt.Sprint([]int64{contab.ID}) {
		t.Fatalf("maria sectors: %s", got)
	}
	if n := e.contactCount(); n != 2 {
		t.Fatalf("contacts: %d", n)
	}

	// Sem órgão: fica não cadastrado, para completar antes do encerramento.
	wantCounts(t, e.importContacts(token, contab.ID, 0, "5511988880004"), 1, 0, 0)
	semOrgao := e.contactByPhone("5511988880004")
	if semOrgao.Registered || semOrgao.OrganizationID != nil {
		t.Fatalf("without organization: %+v", semOrgao)
	}

	// Todos, de novo: não duplica e cria só quem faltava.
	wantCounts(t, e.importContacts(token, contab.ID, 0, "5511988880001", "5511988880002", "5511988880003", "5511988880004"), 1, 3, 0)
	if n := e.contactCount(); n != 4 {
		t.Fatalf("contacts after repeating: %d", n)
	}

	// Um registro por importação, na entidade do setor, com quem importou.
	actions, changes := e.auditChanges("sector", contab.ID)
	if fmt.Sprint(actions) != "[sector_connected contacts_imported contacts_imported contacts_imported]" {
		t.Fatalf("audit actions: %v", actions)
	}
	if changes[1]["created"]["to"] != float64(2) || changes[1]["existing"]["to"] != float64(0) ||
		changes[3]["created"]["to"] != float64(1) || changes[3]["existing"]["to"] != float64(3) {
		t.Fatalf("audit changes: %v", changes)
	}
	logs, err := e.q.ListAuditLogsByEntity(t.Context(), db.ListAuditLogsByEntityParams{EntityType: "sector", EntityID: contab.ID})
	if err != nil {
		t.Fatal(err)
	}
	if *logs[1].ActorID != ana.ID {
		t.Fatalf("audit actor: %d", *logs[1].ActorID)
	}
	// O vínculo só é auditado quando é novo.
	if actions, _ := e.auditChanges("contact", maria.ID); fmt.Sprint(actions) != "[contact_sector_linked]" {
		t.Fatalf("contact audit: %v", actions)
	}
}

func TestImportKeepsExistingContact(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	contab, rh := e.sector("Contabilidade"), e.sector("RH")
	e.user("ana@exemplo.com", db.UserRoleAgent, &contab.ID)
	sup := e.user("sup@exemplo.com", db.UserRoleSupervisor, &rh.ID)
	e.user("admin@exemplo.com", db.UserRoleAdmin, nil)
	admin := e.login("admin@exemplo.com", testPassword)
	ana := e.login("ana@exemplo.com", testPassword)
	token := e.login("sup@exemplo.com", testPassword)
	orgA := e.organization(admin, "Prefeitura", "")
	orgB := e.organization(admin, "Câmara", "")
	withNinth := e.contact(ana, "Maria Cadastrada", "5511987650001", orgA, contab.ID)
	withoutNinth := e.contact(ana, "João Cadastrado", "551187650002", orgA, contab.ID)
	exact := e.contact(ana, "Pedro Cadastrado", "5511987650003", orgA, contab.ID)
	e.connectBook(rh.ID,
		messaging.SavedContact{Name: "Maria da agenda", Phone: "551187650001"},
		messaging.SavedContact{Name: "João da agenda", Phone: "5511987650002"},
		messaging.SavedContact{Name: "Pedro da agenda", Phone: "5511987650003"},
	)

	body := e.importContacts(token, rh.ID, orgB, "551187650001", "5511987650002", "5511987650003")
	wantCounts(t, body, 0, 3, 0)
	if n := e.contactCount(); n != 3 {
		t.Fatalf("contacts: %d", n)
	}
	for contactID, wantName := range map[int64]string{withNinth: "Maria Cadastrada", withoutNinth: "João Cadastrado", exact: "Pedro Cadastrado"} {
		c, err := e.q.GetContactWithOrganization(t.Context(), contactID)
		if err != nil {
			t.Fatal(err)
		}
		if c.Contact.Name != wantName || *c.Contact.OrganizationID != orgA {
			t.Errorf("contact %d overwritten: %+v", contactID, c.Contact)
		}
		if got := e.contactSectorIDs(contactID); got != fmt.Sprint([]int64{contab.ID, rh.ID}) {
			t.Errorf("contact %d sectors: %s", contactID, got)
		}
	}
	if c := e.contactByPhone("5511987650001"); c.ID != withNinth {
		t.Fatalf("phone changed: %+v", c)
	}
	actions, changes := e.auditChanges("contact", withNinth)
	if fmt.Sprint(actions) != "[contact_links_updated contact_sector_linked]" || changes[1]["sector_id"]["to"] != float64(rh.ID) {
		t.Fatalf("audit: %v %v", actions, changes)
	}
	logs, err := e.q.ListAuditLogsByEntity(t.Context(), db.ListAuditLogsByEntityParams{EntityType: "contact", EntityID: withNinth})
	if err != nil {
		t.Fatal(err)
	}
	if *logs[1].ActorID != sup.ID {
		t.Fatalf("audit actor: %d", *logs[1].ActorID)
	}

	// Importar de novo não muda nada: nem novo vínculo, nem nova auditoria.
	wantCounts(t, e.importContacts(token, rh.ID, orgB, "551187650001"), 0, 1, 0)
	if actions, _ := e.auditChanges("contact", withNinth); len(actions) != 2 {
		t.Fatalf("audit after repeating: %v", actions)
	}

	// O mesmo número com e sem o nono dígito na agenda vira um único contato.
	e.whatsapp.SetSavedContacts(rh.ID,
		messaging.SavedContact{Name: "Nova com nono", Phone: "5511987650009"},
		messaging.SavedContact{Name: "Nova sem nono", Phone: "551187650009"},
	)
	wantCounts(t, e.importContacts(token, rh.ID, 0, "5511987650009", "551187650009"), 1, 1, 0)
	if n := e.contactCount(); n != 4 {
		t.Fatalf("contacts after variants: %d", n)
	}
}

func TestImportContactsPermissions(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	contab, rh := e.sector("Contabilidade"), e.sector("RH")
	e.user("ana@exemplo.com", db.UserRoleAgent, &contab.ID)
	e.user("sup@exemplo.com", db.UserRoleSupervisor, &contab.ID)
	e.user("admin@exemplo.com", db.UserRoleAdmin, nil)
	book := messaging.SavedContact{Name: "Maria", Phone: "5511988880001"}
	e.connectBook(rh.ID, book)
	listPath := fmt.Sprintf("/api/sectors/%d/saved-contacts", rh.ID)
	importPath := listPath + "/import"
	importBody := map[string]any{"phones": []string{book.Phone}}

	for _, email := range []string{"ana@exemplo.com", "sup@exemplo.com"} {
		token := e.login(email, testPassword)
		if resp := e.do(http.MethodGet, listPath, token, nil); resp.status != http.StatusForbidden {
			t.Errorf("%s list other sector: status %d", email, resp.status)
		}
		if resp := e.do(http.MethodPost, importPath, token, importBody); resp.status != http.StatusForbidden {
			t.Errorf("%s import other sector: status %d", email, resp.status)
		}
	}
	if n := e.contactCount(); n != 0 {
		t.Fatalf("contacts after refusals: %d", n)
	}
	if resp := e.do(http.MethodPost, importPath, "", importBody); resp.status != http.StatusUnauthorized {
		t.Errorf("anonymous import: status %d", resp.status)
	}

	// O administrador escolhe o setor; atendente e supervisor usam o próprio.
	wantCounts(t, e.importContacts(e.login("admin@exemplo.com", testPassword), rh.ID, 0, book.Phone), 1, 0, 0)
	e.connectBook(contab.ID, messaging.SavedContact{Name: "João", Phone: "5511988880002"}, messaging.SavedContact{Name: "Pedro", Phone: "5511988880003"})
	wantCounts(t, e.importContacts(e.login("ana@exemplo.com", testPassword), contab.ID, 0, "5511988880002"), 1, 0, 0)
	wantCounts(t, e.importContacts(e.login("sup@exemplo.com", testPassword), contab.ID, 0, "5511988880003"), 1, 0, 0)
}

func TestImportContactsRefusals(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	contab := e.sector("Contabilidade")
	e.user("ana@exemplo.com", db.UserRoleAgent, &contab.ID)
	token := e.login("ana@exemplo.com", testPassword)
	listPath := fmt.Sprintf("/api/sectors/%d/saved-contacts", contab.ID)
	importPath := listPath + "/import"
	phone := "5511988880001"

	// Número desconectado: nem lista, nem importa.
	disconnected := "Número desconectado. Reconecte pelo QR code."
	if resp := e.do(http.MethodGet, listPath, token, nil); resp.status != http.StatusConflict || resp.body["error"] != disconnected {
		t.Errorf("disconnected list: %d %v", resp.status, resp.body)
	}
	if resp := e.do(http.MethodPost, importPath, token, map[string]any{"phones": []string{phone}}); resp.status != http.StatusConflict || resp.body["error"] != disconnected {
		t.Errorf("disconnected import: %d %v", resp.status, resp.body)
	}

	e.connectBook(contab.ID, messaging.SavedContact{Name: "Maria", Phone: phone})
	if resp := e.do(http.MethodPost, importPath, token, map[string]any{"phones": []string{}}); resp.status != http.StatusUnprocessableEntity {
		t.Errorf("nothing chosen: %d %v", resp.status, resp.body)
	}
	// Órgão inexistente é recusado mesmo quando o telefone já existe.
	if resp := e.do(http.MethodPost, importPath, token, map[string]any{"phones": []string{phone}, "organizationId": 999999}); resp.status != http.StatusNotFound {
		t.Errorf("unknown organization: %d %v", resp.status, resp.body)
	}
	if n := e.contactCount(); n != 0 {
		t.Fatalf("contacts after refusals: %d", n)
	}
	if actions, _ := e.auditChanges("sector", contab.ID); fmt.Sprint(actions) != "[sector_connected]" {
		t.Fatalf("audit after refusals: %v", actions)
	}
}

// Provider without an address book, like the official API may be: only the common contract.
type providerWithoutBook struct{ messaging.Provider }

func TestImportContactsWithoutContactBook(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	contab := e.sector("Contabilidade")
	e.user("ana@exemplo.com", db.UserRoleAgent, &contab.ID)
	e.connectBook(contab.ID, messaging.SavedContact{Name: "Maria", Phone: "5511988880001"})
	handler := NewRouter(slog.New(slog.NewTextHandler(io.Discard, nil)), auth.NewService(e.pool), users.NewService(e.pool), e.sectors, directory.NewService(e.pool), e.ticketService, realtime.NewHub(), Options{
		SecureCookie: true, Messaging: providerWithoutBook{e.whatsapp},
	})
	srv := httptest.NewServer(handler)
	t.Cleanup(srv.Close)
	official := *e
	official.url = srv.URL
	token := official.login("ana@exemplo.com", testPassword)

	want := "Este número não oferece a agenda de contatos. Cadastre os contatos manualmente."
	path := fmt.Sprintf("/api/sectors/%d/saved-contacts", contab.ID)
	if resp := official.do(http.MethodGet, path, token, nil); resp.status != http.StatusConflict || resp.body["error"] != want {
		t.Errorf("list: %d %v", resp.status, resp.body)
	}
	if resp := official.do(http.MethodPost, path+"/import", token, map[string]any{"phones": []string{"5511988880001"}}); resp.status != http.StatusConflict || resp.body["error"] != want {
		t.Errorf("import: %d %v", resp.status, resp.body)
	}
}

// Uma falha no meio desfaz a importação inteira, inclusive a auditoria.
func TestImportContactsIsAtomic(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	contab := e.sector("Contabilidade")
	e.user("ana@exemplo.com", db.UserRoleAgent, &contab.ID)
	token := e.login("ana@exemplo.com", testPassword)
	e.connectBook(contab.ID,
		messaging.SavedContact{Name: "Maria", Phone: "5511988880001"},
		// O byte nulo não é aceito pelo PostgreSQL, e o telefone vem depois do de Maria.
		messaging.SavedContact{Name: "João\x00", Phone: "5511988880002"},
	)
	resp := e.do(http.MethodPost, fmt.Sprintf("/api/sectors/%d/saved-contacts/import", contab.ID), token,
		map[string]any{"phones": []string{"5511988880001", "5511988880002"}})
	if resp.status == http.StatusOK {
		t.Fatalf("import with a bad name: %v", resp.body)
	}
	if n := e.contactCount(); n != 0 {
		t.Fatalf("contacts after failure: %d", n)
	}
	if actions, _ := e.auditChanges("sector", contab.ID); fmt.Sprint(actions) != "[sector_connected]" {
		t.Fatalf("audit after failure: %v", actions)
	}
}

func TestImportContactsConcurrently(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	contab := e.sector("Contabilidade")
	e.user("ana@exemplo.com", db.UserRoleAgent, &contab.ID)
	token := e.login("ana@exemplo.com", testPassword)
	var book []messaging.SavedContact
	var phones []string
	for i := range 20 {
		phone := fmt.Sprintf("55119888800%02d", i)
		book = append(book, messaging.SavedContact{Name: "Contato " + phone, Phone: phone})
		phones = append(phones, phone)
	}
	e.connectBook(contab.ID, book...)

	var wg sync.WaitGroup
	results := make([]response, 5)
	for i := range results {
		wg.Go(func() {
			results[i] = e.do(http.MethodPost, fmt.Sprintf("/api/sectors/%d/saved-contacts/import", contab.ID), token, map[string]any{"phones": phones})
		})
	}
	wg.Wait()

	created := 0.0
	for _, resp := range results {
		if resp.status != http.StatusOK {
			t.Fatalf("concurrent import: status %d, body %v", resp.status, resp.body)
		}
		created += resp.body["created"].(float64)
	}
	if created != 20 {
		t.Fatalf("created %v, want 20", created)
	}
	if n := e.contactCount(); n != 20 {
		t.Fatalf("contacts: %d", n)
	}
}

// O mesmo número, com e sem o nono dígito, importado em setores diferentes enquanto
// uma mensagem chega, vira um único contato.
func TestPhoneVariantsDoNotRace(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	contab, rh := e.sector("Contabilidade"), e.sector("RH")
	e.user("ana@exemplo.com", db.UserRoleAgent, &contab.ID)
	e.user("bia@exemplo.com", db.UserRoleAgent, &rh.ID)
	ana, bia := e.login("ana@exemplo.com", testPassword), e.login("bia@exemplo.com", testPassword)
	const total = 30
	var withNinth, withoutNinth []string
	var contabBook, rhBook []messaging.SavedContact
	for i := range total {
		withNinth = append(withNinth, fmt.Sprintf("551198880%04d", i))
		withoutNinth = append(withoutNinth, fmt.Sprintf("55118880%04d", i))
		contabBook = append(contabBook, messaging.SavedContact{Name: "Com nono", Phone: withNinth[i]})
		rhBook = append(rhBook, messaging.SavedContact{Name: "Sem nono", Phone: withoutNinth[i]})
	}
	e.connectBook(contab.ID, contabBook...)
	e.connectBook(rh.ID, rhBook...)

	var wg sync.WaitGroup
	var fromContab, fromRH response
	wg.Go(func() {
		fromContab = e.do(http.MethodPost, fmt.Sprintf("/api/sectors/%d/saved-contacts/import", contab.ID), ana, map[string]any{"phones": withNinth})
	})
	wg.Go(func() {
		fromRH = e.do(http.MethodPost, fmt.Sprintf("/api/sectors/%d/saved-contacts/import", rh.ID), bia, map[string]any{"phones": withoutNinth})
	})
	received := make([]error, total)
	for i := range total {
		wg.Go(func() {
			received[i] = e.whatsapp.Receive(t.Context(), rh.ID, messaging.Message{
				ExternalMessageID: fmt.Sprintf("race-%d", i),
				ExternalContactID: withNinth[i] + "@s.whatsapp.net",
				Phone:             withNinth[i],
				Type:              messaging.TypeText,
				Body:              "Olá",
			})
		})
	}
	wg.Wait()

	if fromContab.status != http.StatusOK || fromRH.status != http.StatusOK {
		t.Fatalf("imports: %d %v, %d %v", fromContab.status, fromContab.body, fromRH.status, fromRH.body)
	}
	for i, err := range received {
		if err != nil {
			t.Fatalf("message %d: %v", i, err)
		}
	}
	if n := e.contactCount(); n != total {
		t.Fatalf("contacts: %d, want %d", n, total)
	}
}
