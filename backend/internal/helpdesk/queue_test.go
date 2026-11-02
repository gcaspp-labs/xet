package helpdesk_test

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"

	"github.com/gcaspp-labs/xet/backend/internal/core/auth"
	"github.com/gcaspp-labs/xet/backend/internal/core/realtime"
	"github.com/gcaspp-labs/xet/backend/internal/db"
)

// queuedTicket receives a message from a new contact and returns its ticket.
func (e *testEnv) queuedTicket(sectorID int64, msgID, phone string) ticketRow {
	e.T.Helper()
	e.receive(sectorID, text(msgID, phone+"@s.whatsapp.net", phone, "Olá"))
	for _, t := range e.tickets(sectorID) {
		var contact int64
		if err := e.Pool.QueryRow(e.T.Context(), "select id from contacts where phone = $1", phone).Scan(&contact); err != nil {
			e.T.Fatal(err)
		}
		if t.ContactID == contact && t.Status != "closed" {
			return t
		}
	}
	e.T.Fatalf("no open ticket for %s", phone)
	return ticketRow{}
}

func (e *testEnv) assign(ticketID int64, token string) response {
	e.T.Helper()
	return e.Do(http.MethodPost, fmt.Sprintf("/api/tickets/%d/assign", ticketID), token, nil)
}

type assignment struct {
	Status     string
	AssigneeID *int64
	AssignedAt *time.Time
}

func (e *testEnv) assignment(ticketID int64) assignment {
	e.T.Helper()
	var a assignment
	err := e.Pool.QueryRow(e.T.Context(), "select status::text, assignee_id, assigned_at from tickets where id = $1", ticketID).
		Scan(&a.Status, &a.AssigneeID, &a.AssignedAt)
	if err != nil {
		e.T.Fatal(err)
	}
	return a
}

// subscribe opens the event stream of the user's session.
func (e *testEnv) subscribe(token string) *websocket.Conn {
	e.T.Helper()
	conn, status, err := e.dial(token)
	if err != nil {
		e.T.Fatalf("dial events: %v (status %d)", err, status)
	}
	e.T.Cleanup(func() { _ = conn.CloseNow() })
	return conn
}

// dial opens the event stream, returning the status of the handshake.
func (e *testEnv) dial(token string) (*websocket.Conn, int, error) {
	ctx, cancel := context.WithTimeout(e.T.Context(), 5*time.Second)
	defer cancel()
	opts := &websocket.DialOptions{HTTPHeader: http.Header{}}
	if token != "" {
		opts.HTTPHeader.Set("Cookie", auth.SessionCookie+"="+token)
	}
	conn, resp, err := websocket.Dial(ctx, "ws"+strings.TrimPrefix(e.URL, "http")+"/api/ws", opts)
	if resp == nil {
		return conn, 0, err
	}
	if resp.Body != nil {
		_ = resp.Body.Close()
	}
	return conn, resp.StatusCode, err
}

// nextEvent waits for the next event of the connection. Receiving events in
// order proves that nothing else was delivered in between.
func (e *testEnv) nextEvent(conn *websocket.Conn) realtime.Event {
	e.T.Helper()
	ctx, cancel := context.WithTimeout(e.T.Context(), 5*time.Second)
	defer cancel()
	var ev realtime.Event
	if err := wsjson.Read(ctx, conn, &ev); err != nil {
		e.T.Fatalf("read event: %v", err)
	}
	return ev
}

func TestOnlyOneAgentAssignsConcurrently(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	contab := e.Sector("Contabilidade")
	tk := e.queuedTicket(contab.ID, "MSG-1", "5511988887777")

	const agents = 10
	tokens := make([]string, agents)
	ids := make(map[string]int64, agents)
	for i := range tokens {
		email := fmt.Sprintf("agente%d@exemplo.com", i)
		u := e.User(email, db.UserRoleAgent, &contab.ID)
		tokens[i] = e.Login(email, testPassword)
		ids[tokens[i]] = u.ID
	}

	statuses := make([]int, agents)
	var wg sync.WaitGroup
	start := make(chan struct{})
	for i, token := range tokens {
		wg.Go(func() {
			<-start
			statuses[i] = e.assign(tk.ID, token).Status
		})
	}
	close(start)
	wg.Wait()

	var winner int64
	for i, status := range statuses {
		switch status {
		case http.StatusOK:
			if winner != 0 {
				t.Fatalf("two agents assigned the ticket: statuses %v", statuses)
			}
			winner = ids[tokens[i]]
		case http.StatusConflict:
		default:
			t.Fatalf("agent %d: status %d", i, status)
		}
	}
	if winner == 0 {
		t.Fatalf("no agent assigned the ticket: statuses %v", statuses)
	}

	a := e.assignment(tk.ID)
	if a.Status != "in_progress" || a.AssigneeID == nil || *a.AssigneeID != winner || a.AssignedAt == nil {
		t.Fatalf("ticket after assign = %+v, want in_progress by %d", a, winner)
	}
	actions, changes := e.AuditChanges("ticket", tk.ID)
	if len(actions) != 1 || actions[0] != "ticket_assigned" {
		t.Fatalf("audit = %v, want one ticket_assigned", actions)
	}
	if changes[0]["status"]["from"] != "queued" || changes[0]["status"]["to"] != "in_progress" ||
		changes[0]["assignee_id"]["from"] != nil || changes[0]["assignee_id"]["to"] != float64(winner) {
		t.Fatalf("audit changes = %v", changes[0])
	}
	logs, err := e.Q.ListAuditLogsByEntity(t.Context(), db.ListAuditLogsByEntityParams{EntityType: "ticket", EntityID: tk.ID})
	if err != nil {
		t.Fatal(err)
	}
	if logs[0].ActorID == nil || *logs[0].ActorID != winner || logs[0].TicketID == nil || *logs[0].TicketID != tk.ID {
		t.Fatalf("audit actor %v, ticket %v", logs[0].ActorID, logs[0].TicketID)
	}
}

func TestAssignTicketRules(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	contab := e.Sector("Contabilidade")
	rh := e.Sector("RH")
	ana := e.User("ana@exemplo.com", db.UserRoleAgent, &contab.ID)
	e.User("bia@exemplo.com", db.UserRoleAgent, &contab.ID)
	sup := e.User("sup@exemplo.com", db.UserRoleSupervisor, &contab.ID)
	e.User("rh@exemplo.com", db.UserRoleAgent, &rh.ID)
	admin := e.User("admin@exemplo.com", db.UserRoleAdmin, nil)
	anaToken := e.Login("ana@exemplo.com", testPassword)
	biaToken := e.Login("bia@exemplo.com", testPassword)
	supToken := e.Login("sup@exemplo.com", testPassword)
	rhToken := e.Login("rh@exemplo.com", testPassword)
	adminToken := e.Login("admin@exemplo.com", testPassword)

	first := e.queuedTicket(contab.ID, "MSG-1", "5511988887777")

	if resp := e.assign(first.ID, ""); resp.Status != http.StatusUnauthorized {
		t.Fatalf("without session: status %d", resp.Status)
	}
	// Atendente de outro setor não assume, mesmo chamando a API diretamente.
	if resp := e.assign(first.ID, rhToken); resp.Status != http.StatusForbidden {
		t.Fatalf("other sector: status %d", resp.Status)
	}
	if a := e.assignment(first.ID); a.Status != "queued" {
		t.Fatalf("ticket after forbidden assign = %+v", a)
	}
	if resp := e.assign(999999, anaToken); resp.Status != http.StatusNotFound {
		t.Fatalf("unknown ticket: status %d", resp.Status)
	}

	resp := e.assign(first.ID, anaToken)
	if resp.Status != http.StatusOK || resp.Body["status"] != "in_progress" || resp.Body["assigneeId"] != float64(ana.ID) {
		t.Fatalf("assign: status %d, body %v", resp.Status, resp.Body)
	}
	assignedAt := e.assignment(first.ID).AssignedAt

	// Clique repetido de quem já assumiu não muda nada.
	if resp := e.assign(first.ID, anaToken); resp.Status != http.StatusOK || resp.Body["assigneeId"] != float64(ana.ID) {
		t.Fatalf("assign again: status %d, body %v", resp.Status, resp.Body)
	}
	// Outro atendente só recebe o chamado por transferência.
	resp = e.assign(first.ID, biaToken)
	if resp.Status != http.StatusConflict || resp.Body["error"] != "Este chamado já foi assumido por outro atendente." {
		t.Fatalf("assign taken ticket: status %d, body %v", resp.Status, resp.Body)
	}
	if a := e.assignment(first.ID); *a.AssigneeID != ana.ID || !a.AssignedAt.Equal(*assignedAt) {
		t.Fatalf("ticket after conflicts = %+v", a)
	}
	if actions, _ := e.AuditChanges("ticket", first.ID); len(actions) != 1 {
		t.Fatalf("audit = %v, want one ticket_assigned", actions)
	}

	// Supervisor do setor e administrador também assumem.
	second := e.queuedTicket(contab.ID, "MSG-2", "5511977776666")
	if resp := e.assign(second.ID, supToken); resp.Status != http.StatusOK || resp.Body["assigneeId"] != float64(sup.ID) {
		t.Fatalf("supervisor assign: status %d, body %v", resp.Status, resp.Body)
	}
	third := e.queuedTicket(rh.ID, "MSG-3", "5511966665555")
	if resp := e.assign(third.ID, adminToken); resp.Status != http.StatusOK || resp.Body["assigneeId"] != float64(admin.ID) {
		t.Fatalf("admin assign: status %d, body %v", resp.Status, resp.Body)
	}

	// Chamado encerrado não é assumido.
	org := e.Organization(adminToken, "Prefeitura", "")
	e.closeTicket(first.ID, ana.ID, org)
	resp = e.assign(first.ID, biaToken)
	if resp.Status != http.StatusConflict || resp.Body["error"] != "Este chamado já foi encerrado." {
		t.Fatalf("assign closed ticket: status %d, body %v", resp.Status, resp.Body)
	}
}

func TestSameAgentHoldsManyTicketsWithoutLimit(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	contab := e.Sector("Contabilidade")
	ana := e.User("ana@exemplo.com", db.UserRoleAgent, &contab.ID)
	token := e.Login("ana@exemplo.com", testPassword)

	const tickets = 25
	for i := range tickets {
		tk := e.queuedTicket(contab.ID, fmt.Sprintf("MSG-%d", i), fmt.Sprintf("55119888%05d", i))
		if resp := e.assign(tk.ID, token); resp.Status != http.StatusOK {
			t.Fatalf("assign ticket %d: status %d: %s", i, resp.Status, resp.Body)
		}
	}

	var held int
	err := e.Pool.QueryRow(t.Context(), "select count(*) from tickets where assignee_id = $1 and status = 'in_progress'", ana.ID).Scan(&held)
	if err != nil {
		t.Fatal(err)
	}
	if held != tickets {
		t.Fatalf("tickets held by the agent = %d, want %d", held, tickets)
	}
}

func TestPanelListsQueueAssigneesAndWorkload(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	contab := e.Sector("Contabilidade")
	rh := e.Sector("RH")
	ana := e.User("ana@exemplo.com", db.UserRoleAgent, &contab.ID)
	bia := e.User("bia@exemplo.com", db.UserRoleAgent, &contab.ID)
	sup := e.User("sup@exemplo.com", db.UserRoleSupervisor, &contab.ID)
	e.User("rh@exemplo.com", db.UserRoleAgent, &rh.ID)
	admin := e.User("admin@exemplo.com", db.UserRoleAdmin, nil)
	anaToken := e.Login("ana@exemplo.com", testPassword)
	rhToken := e.Login("rh@exemplo.com", testPassword)
	adminToken := e.Login("admin@exemplo.com", testPassword)

	first := e.queuedTicket(contab.ID, "MSG-1", "5511988887777")
	second := e.queuedTicket(contab.ID, "MSG-2", "5511977776666")
	third := e.queuedTicket(contab.ID, "MSG-3", "5511966665555")
	later := text("MSG-4", "5511977776666@s.whatsapp.net", "5511977776666", "Ainda aguardo")
	later.SentAt = time.Now().Add(time.Second).Truncate(time.Microsecond)
	e.receive(contab.ID, later)
	e.queuedTicket(rh.ID, "MSG-5", "5511955554444")

	e.assign(first.ID, anaToken)
	e.assign(third.ID, anaToken)
	e.assign(second.ID, adminToken)

	path := fmt.Sprintf("/api/sectors/%d/tickets", contab.ID)
	list := e.DoList(http.MethodGet, path, anaToken)
	if len(list) != 3 {
		t.Fatalf("tickets = %d, want 3 (only the open tickets of the sector)", len(list))
	}
	if list[0]["id"] != float64(first.ID) || list[0]["protocol"] != first.Protocol || list[0]["status"] != "in_progress" {
		t.Fatalf("first ticket = %v", list[0])
	}
	if a, _ := list[0]["assignee"].(map[string]any); a["id"] != float64(ana.ID) || a["name"] != ana.Name {
		t.Fatalf("assignee = %v", list[0]["assignee"])
	}
	contact, _ := list[1]["contact"].(map[string]any)
	if contact["phone"] != "5511977776666" || contact["registered"] != false {
		t.Fatalf("contact = %v", contact)
	}
	if m, _ := list[1]["lastMessage"].(map[string]any); m["body"] != "Ainda aguardo" || m["type"] != "text" || m["origin"] != "customer" {
		t.Fatalf("last message = %v", list[1]["lastMessage"])
	}

	// Um novo chamado entra na fila, sem responsável.
	fourth := e.queuedTicket(contab.ID, "MSG-6", "5511944443333")
	list = e.DoList(http.MethodGet, path, anaToken)
	if len(list) != 4 || list[3]["id"] != float64(fourth.ID) || list[3]["status"] != "queued" || list[3]["assignee"] != nil {
		t.Fatalf("queued ticket = %v", list[len(list)-1])
	}

	// Contagem sem limite: inclui o administrador que assumiu um chamado do setor.
	workload := e.DoList(http.MethodGet, fmt.Sprintf("/api/sectors/%d/workload", contab.ID), anaToken)
	got := map[float64]float64{}
	for _, u := range workload {
		got[u["id"].(float64)] = u["activeTickets"].(float64)
	}
	want := map[float64]float64{float64(ana.ID): 2, float64(bia.ID): 0, float64(sup.ID): 0, float64(admin.ID): 1}
	if fmt.Sprint(got) != fmt.Sprint(want) {
		t.Fatalf("workload = %v, want %v", got, want)
	}

	// Outro setor não vê a fila nem a carga.
	if resp := e.Do(http.MethodGet, path, rhToken, nil); resp.Status != http.StatusForbidden {
		t.Fatalf("other sector tickets: status %d", resp.Status)
	}
	if resp := e.Do(http.MethodGet, fmt.Sprintf("/api/sectors/%d/workload", contab.ID), rhToken, nil); resp.Status != http.StatusForbidden {
		t.Fatalf("other sector workload: status %d", resp.Status)
	}
	if list := e.DoList(http.MethodGet, path, adminToken); len(list) != 4 {
		t.Fatalf("admin tickets = %d, want 4", len(list))
	}
}

func TestEventsReachOnlyTheSectorUsers(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	contab := e.Sector("Contabilidade")
	rh := e.Sector("RH")
	e.User("ana@exemplo.com", db.UserRoleAgent, &contab.ID)
	e.User("rh@exemplo.com", db.UserRoleAgent, &rh.ID)
	e.User("admin@exemplo.com", db.UserRoleAdmin, nil)
	anaToken := e.Login("ana@exemplo.com", testPassword)
	anaEvents := e.subscribe(anaToken)
	rhEvents := e.subscribe(e.Login("rh@exemplo.com", testPassword))
	adminEvents := e.subscribe(e.Login("admin@exemplo.com", testPassword))

	// Nova mensagem na Contabilidade.
	tk := e.queuedTicket(contab.ID, "MSG-1", "5511988887777")
	want := realtime.Event{Type: "ticket", SectorID: contab.ID, TicketID: tk.ID}
	if ev := e.nextEvent(anaEvents); ev != want {
		t.Fatalf("contab agent event = %+v, want %+v", ev, want)
	}
	if ev := e.nextEvent(adminEvents); ev != want {
		t.Fatalf("admin event = %+v, want %+v", ev, want)
	}

	// Mensagem repetida não gera evento: o próximo é o do chamado assumido.
	e.receive(contab.ID, text("MSG-1", "5511988887777@s.whatsapp.net", "5511988887777", "Olá"))
	e.assign(tk.ID, anaToken)
	if ev := e.nextEvent(anaEvents); ev != want {
		t.Fatalf("assign event = %+v, want %+v", ev, want)
	}

	// Mudança de conexão da Contabilidade.
	e.Do(http.MethodPost, fmt.Sprintf("/api/sectors/%d/connection", contab.ID), e.Login("admin@exemplo.com", testPassword), nil)
	if ev := e.nextEvent(anaEvents); ev.Type != "connection" || ev.SectorID != contab.ID {
		t.Fatalf("connection event = %+v", ev)
	}

	// O atendente do RH recebe primeiro o evento do próprio setor: nada da
	// Contabilidade chegou antes.
	rhTicket := e.queuedTicket(rh.ID, "MSG-2", "5511977776666")
	if ev := e.nextEvent(rhEvents); ev != (realtime.Event{Type: "ticket", SectorID: rh.ID, TicketID: rhTicket.ID}) {
		t.Fatalf("rh agent event = %+v, want only events of RH", ev)
	}
}

func TestEventsRequireAValidSession(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	contab := e.Sector("Contabilidade")
	e.User("ana@exemplo.com", db.UserRoleAgent, &contab.ID)

	if _, status, err := e.dial(""); err == nil || status != http.StatusUnauthorized {
		t.Fatalf("dial without session: err %v, status %d", err, status)
	}

	token := e.Login("ana@exemplo.com", testPassword)
	conn := e.subscribe(token)
	var expiresAt time.Time
	if err := e.Pool.QueryRow(t.Context(), "select expires_at from sessions").Scan(&expiresAt); err != nil {
		t.Fatal(err)
	}

	// A conexão aberta confere a sessão sem renová-la e fecha quando ela termina.
	time.Sleep(500 * time.Millisecond)
	var after time.Time
	if err := e.Pool.QueryRow(t.Context(), "select expires_at from sessions").Scan(&after); err != nil {
		t.Fatal(err)
	}
	if !after.Equal(expiresAt) {
		t.Fatalf("open connection renewed the session: %v -> %v", expiresAt, after)
	}

	e.Do(http.MethodPost, "/api/auth/logout", token, nil)
	ctx, cancel := context.WithTimeout(t.Context(), 5*time.Second)
	defer cancel()
	_, _, err := conn.Read(ctx)
	var closeErr websocket.CloseError
	if !errors.As(err, &closeErr) || closeErr.Code != websocket.StatusPolicyViolation {
		t.Fatalf("after logout: read error %v, want close with policy violation", err)
	}
}

func TestNewQRCodeReachesTheConnectionScreen(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	contab := e.Sector("Contabilidade")
	e.User("sup@exemplo.com", db.UserRoleSupervisor, &contab.ID)
	token := e.Login("sup@exemplo.com", testPassword)
	events := e.subscribe(token)

	e.Do(http.MethodPost, fmt.Sprintf("/api/sectors/%d/connection", contab.ID), token, nil)
	want := realtime.Event{Type: "connection", SectorID: contab.ID}
	if ev := e.nextEvent(events); ev != want {
		t.Fatalf("connect event = %+v, want %+v", ev, want)
	}
	_, first, _ := e.getQR(contab.ID, token)

	// O WhatsApp troca o código: a tela é avisada mesmo sem mudança de estado.
	if err := e.WhatsApp.NextQR(t.Context(), contab.ID); err != nil {
		t.Fatal(err)
	}
	if ev := e.nextEvent(events); ev != want {
		t.Fatalf("new qr event = %+v, want %+v", ev, want)
	}
	if c := e.connection(contab.ID, token); c["status"] != "connecting" || c["pairing"] != true {
		t.Fatalf("connection after new qr = %v", c)
	}
	if _, second, _ := e.getQR(contab.ID, token); bytes.Equal(first, second) {
		t.Fatal("qr code image did not change")
	}
	if actions := e.connectionAudit(contab.ID); len(actions) != 0 {
		t.Fatalf("new qr code audited: %v", actions)
	}
}
