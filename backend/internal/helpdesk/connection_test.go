package helpdesk_test

import (
	"bytes"
	"fmt"
	"image/png"
	"io"
	"net/http"
	"sync"
	"testing"

	"github.com/gcaspp-labs/xet/backend/internal/core/auth"
	"github.com/gcaspp-labs/xet/backend/internal/db"
)

// getQR fetches the QR code image of the sector.
func (e *testEnv) getQR(sectorID int64, token string) (int, []byte, string) {
	e.T.Helper()
	req, err := http.NewRequestWithContext(e.T.Context(), http.MethodGet, fmt.Sprintf("%s/api/sectors/%d/connection/qr.png", e.URL, sectorID), nil)
	if err != nil {
		e.T.Fatal(err)
	}
	req.AddCookie(&http.Cookie{Name: auth.SessionCookie, Value: token})
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		e.T.Fatal(err)
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		e.T.Fatal(err)
	}
	return resp.StatusCode, body, resp.Header.Get("Content-Type")
}

func (e *testEnv) connection(sectorID int64, token string) map[string]any {
	e.T.Helper()
	resp := e.Do(http.MethodGet, fmt.Sprintf("/api/sectors/%d/connection", sectorID), token, nil)
	if resp.Status != http.StatusOK {
		e.T.Fatalf("get connection: status %d, body %v", resp.Status, resp.Body)
	}
	return resp.Body
}

func (e *testEnv) accountID(sectorID int64) *string {
	e.T.Helper()
	s, err := e.Q.GetSector(e.T.Context(), sectorID)
	if err != nil {
		e.T.Fatal(err)
	}
	return s.ExternalAccountID
}

// connectionLogs returns the connection actions recorded for the sector.
func (e *testEnv) connectionLogs(sectorID int64) []db.AuditLog {
	e.T.Helper()
	logs, err := e.Q.ListAuditLogsByEntity(e.T.Context(), db.ListAuditLogsByEntityParams{EntityType: "sector", EntityID: sectorID})
	if err != nil {
		e.T.Fatal(err)
	}
	var out []db.AuditLog
	for _, l := range logs {
		if l.Action == "sector_connected" || l.Action == "sector_disconnected" {
			out = append(out, l)
		}
	}
	return out
}

// connectionAudit returns the connection actions recorded for the sector,
// checking they are actions of the system (no actor).
func (e *testEnv) connectionAudit(sectorID int64) []string {
	e.T.Helper()
	var actions []string
	for _, l := range e.connectionLogs(sectorID) {
		if l.ActorID != nil {
			e.T.Errorf("%s: actor %d, want none (system action)", l.Action, *l.ActorID)
		}
		actions = append(actions, l.Action)
	}
	return actions
}

// pair connects the sector by QR code with the given account.
func (e *testEnv) pair(sectorID int64, token, accountID string) {
	e.T.Helper()
	resp := e.Do(http.MethodPost, fmt.Sprintf("/api/sectors/%d/connection", sectorID), token, nil)
	if resp.Status != http.StatusOK {
		e.T.Fatalf("connect: status %d, body %v", resp.Status, resp.Body)
	}
	if err := e.WhatsApp.Pair(e.T.Context(), sectorID, accountID); err != nil {
		e.T.Fatal(err)
	}
}

func TestConnectByQRCode(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	contab := e.Sector("Contabilidade")
	e.User("sup@exemplo.com", db.UserRoleSupervisor, &contab.ID)
	token := e.Login("sup@exemplo.com", testPassword)

	if c := e.connection(contab.ID, token); c["status"] != "disconnected" || c["pairing"] != false {
		t.Fatalf("before connecting: %v", c)
	}
	if status, _, _ := e.getQR(contab.ID, token); status != http.StatusNotFound {
		t.Fatalf("qr before connecting: status %d, want 404", status)
	}

	path := fmt.Sprintf("/api/sectors/%d/connection", contab.ID)
	resp := e.Do(http.MethodPost, path, token, nil)
	if resp.Status != http.StatusOK || resp.Body["status"] != "connecting" || resp.Body["pairing"] != true {
		t.Fatalf("connect: status %d, body %v", resp.Status, resp.Body)
	}
	status, image, contentType := e.getQR(contab.ID, token)
	if status != http.StatusOK || contentType != "image/png" {
		t.Fatalf("qr: status %d, content type %q", status, contentType)
	}
	if _, err := png.Decode(bytes.NewReader(image)); err != nil {
		t.Fatalf("qr is not a png: %v", err)
	}

	// O celular lê o QR code.
	if err := e.WhatsApp.Pair(t.Context(), contab.ID, "5511999990000@s.whatsapp.net"); err != nil {
		t.Fatal(err)
	}
	c := e.connection(contab.ID, token)
	if c["status"] != "connected" || c["pairing"] != false || c["lastConnectedAt"] == nil || c["phone"] != "5511999990000" || c["linked"] != true {
		t.Fatalf("after pairing: %v", c)
	}
	if acc := e.accountID(contab.ID); acc == nil || *acc != "5511999990000@s.whatsapp.net" {
		t.Fatalf("external account id = %v", acc)
	}
	if status, _, _ := e.getQR(contab.ID, token); status != http.StatusNotFound {
		t.Fatalf("qr after pairing: status %d, want 404", status)
	}

	// Conectar de novo um número conectado não gera novo QR code.
	resp = e.Do(http.MethodPost, path, token, nil)
	if resp.Status != http.StatusOK || resp.Body["status"] != "connected" || resp.Body["pairing"] != false {
		t.Fatalf("connect again: status %d, body %v", resp.Status, resp.Body)
	}

	if got := e.connectionAudit(contab.ID); len(got) != 1 || got[0] != "sector_connected" {
		t.Fatalf("audit = %v, want [sector_connected]", got)
	}
	_, changes := e.AuditChanges("sector", contab.ID)
	last := changes[len(changes)-1]
	if last["connection_status"]["to"] != "connected" || last["external_account_id"]["to"] != "5511999990000@s.whatsapp.net" || last["phone"]["to"] != "5511999990000" {
		t.Fatalf("sector_connected changes = %v", last)
	}
}

func TestConnectionSurvivesRestart(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	contab := e.Sector("Contabilidade")
	rh := e.Sector("RH")
	e.User("admin@exemplo.com", db.UserRoleAdmin, nil)
	token := e.Login("admin@exemplo.com", testPassword)

	e.Do(http.MethodPost, fmt.Sprintf("/api/sectors/%d/connection", contab.ID), token, nil)
	if err := e.WhatsApp.Pair(t.Context(), contab.ID, "contab-account"); err != nil {
		t.Fatal(err)
	}

	// Reinício: novo serviço no mesmo banco, sem nada em memória.
	restarted := startServer(t, e.Pool, nil)
	if err := restarted.TicketService.Reconnect(t.Context(), restarted.WhatsApp); err != nil {
		t.Fatal(err)
	}
	token = restarted.Login("admin@exemplo.com", testPassword)
	c := restarted.connection(contab.ID, token)
	if c["status"] != "connected" || c["pairing"] != false {
		t.Fatalf("after restart: %v", c)
	}
	if acc := restarted.accountID(contab.ID); acc == nil || *acc != "contab-account" {
		t.Fatalf("external account id after restart = %v", acc)
	}
	// Setor sem conta vinculada não é conectado nem pede QR code sozinho.
	if c := restarted.connection(rh.ID, token); c["status"] != "disconnected" || c["pairing"] != false {
		t.Fatalf("sector never linked after restart: %v", c)
	}
}

func TestDisconnectionReachesSupervisors(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	contab := e.Sector("Contabilidade")
	e.User("sup@exemplo.com", db.UserRoleSupervisor, &contab.ID)
	token := e.Login("sup@exemplo.com", testPassword)
	path := fmt.Sprintf("/api/sectors/%d/connection", contab.ID)

	e.Do(http.MethodPost, path, token, nil)
	if err := e.WhatsApp.Pair(t.Context(), contab.ID, "contab-account"); err != nil {
		t.Fatal(err)
	}

	sectorStatus := func() any {
		list := e.DoList(http.MethodGet, "/api/sectors", token)
		if len(list) != 1 {
			t.Fatalf("list sectors: %v", list)
		}
		return list[0]["connectionStatus"]
	}

	// Queda da conexão: a conta continua vinculada.
	if err := e.WhatsApp.Drop(t.Context(), contab.ID); err != nil {
		t.Fatal(err)
	}
	if got := sectorStatus(); got != "disconnected" {
		t.Fatalf("after drop: connectionStatus %v", got)
	}
	if acc := e.accountID(contab.ID); acc == nil || *acc != "contab-account" {
		t.Fatalf("drop must keep the account, got %v", acc)
	}

	// Reconectar com a conta vinculada não pede QR code.
	resp := e.Do(http.MethodPost, path, token, nil)
	if resp.Body["status"] != "connected" || resp.Body["pairing"] != false {
		t.Fatalf("reconnect: %v", resp.Body)
	}

	// Desvinculado pelo celular: a conta é esquecida e a reconexão pede QR code.
	if err := e.WhatsApp.LogOut(t.Context(), contab.ID); err != nil {
		t.Fatal(err)
	}
	if got := sectorStatus(); got != "logged_out" {
		t.Fatalf("after logout: connectionStatus %v", got)
	}
	if acc := e.accountID(contab.ID); acc != nil {
		t.Fatalf("logout must clear the account, got %q", *acc)
	}
	resp = e.Do(http.MethodPost, path, token, nil)
	if resp.Body["status"] != "connecting" || resp.Body["pairing"] != true {
		t.Fatalf("connect after logout: %v", resp.Body)
	}

	want := []string{"sector_connected", "sector_disconnected", "sector_connected", "sector_disconnected"}
	if got := e.connectionAudit(contab.ID); fmt.Sprint(got) != fmt.Sprint(want) {
		t.Fatalf("audit = %v, want %v", got, want)
	}
}

func TestConnectionPermissions(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	contab := e.Sector("Contabilidade")
	rh := e.Sector("RH")
	e.User("agente@exemplo.com", db.UserRoleAgent, &contab.ID)
	e.User("sup.rh@exemplo.com", db.UserRoleSupervisor, &rh.ID)
	e.User("admin@exemplo.com", db.UserRoleAdmin, nil)

	path := fmt.Sprintf("/api/sectors/%d/connection", contab.ID)
	for who, email := range map[string]string{"agent": "agente@exemplo.com", "other sector supervisor": "sup.rh@exemplo.com"} {
		token := e.Login(email, testPassword)
		for _, method := range []string{http.MethodGet, http.MethodPost, http.MethodDelete} {
			if resp := e.Do(method, path, token, nil); resp.Status != http.StatusForbidden {
				t.Errorf("%s %s: status %d, want 403", who, method, resp.Status)
			}
		}
		if status, _, _ := e.getQR(contab.ID, token); status != http.StatusForbidden {
			t.Errorf("%s qr: status %d, want 403", who, status)
		}
	}
	if resp := e.Do(http.MethodPost, path, "", nil); resp.Status != http.StatusUnauthorized {
		t.Errorf("no session: status %d, want 401", resp.Status)
	}
	if got := e.WhatsApp.Status(contab.ID); got != "disconnected" {
		t.Fatalf("refused requests must not connect, status %s", got)
	}

	// O administrador conecta qualquer setor.
	admin := e.Login("admin@exemplo.com", testPassword)
	if resp := e.Do(http.MethodPost, path, admin, nil); resp.Status != http.StatusOK || resp.Body["pairing"] != true {
		t.Fatalf("admin connect: status %d, body %v", resp.Status, resp.Body)
	}
	if status, _, _ := e.getQR(contab.ID, admin); status != http.StatusOK {
		t.Fatalf("admin qr: status %d", status)
	}
}

func TestPhoneFollowsTheConnection(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	contab := e.Sector("Contabilidade")
	e.User("sup@exemplo.com", db.UserRoleSupervisor, &contab.ID)
	token := e.Login("sup@exemplo.com", testPassword)

	if c := e.connection(contab.ID, token); c["phone"] != nil || c["linked"] != false {
		t.Fatalf("before connecting: %v", c)
	}
	e.pair(contab.ID, token, "5511999990000@s.whatsapp.net")
	list := e.DoList(http.MethodGet, "/api/sectors", token)
	if len(list) != 1 || list[0]["phone"] != "5511999990000" {
		t.Fatalf("list after pairing: %v", list)
	}

	// Queda temporária: o telefone continua.
	if err := e.WhatsApp.Drop(t.Context(), contab.ID); err != nil {
		t.Fatal(err)
	}
	if c := e.connection(contab.ID, token); c["status"] != "disconnected" || c["phone"] != "5511999990000" || c["linked"] != true {
		t.Fatalf("after drop: %v", c)
	}

	// Desvinculado pelo celular: o telefone é apagado.
	if err := e.WhatsApp.LogOut(t.Context(), contab.ID); err != nil {
		t.Fatal(err)
	}
	if c := e.connection(contab.ID, token); c["status"] != "logged_out" || c["phone"] != nil || c["linked"] != false {
		t.Fatalf("after logout: %v", c)
	}
}

func TestNumberOfAnotherSectorIsRefused(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	contab := e.Sector("Contabilidade")
	rh := e.Sector("RH")
	e.User("admin@exemplo.com", db.UserRoleAdmin, nil)
	token := e.Login("admin@exemplo.com", testPassword)
	const account = "5511999990000@s.whatsapp.net"

	e.pair(contab.ID, token, account)
	e.pair(rh.ID, token, account)
	e.TicketService.Wait()

	// O aparelho é desvinculado e a tela mostra o motivo, sem erro 500.
	c := e.connection(rh.ID, token)
	if c["status"] != "logged_out" || c["phone"] != nil || c["linked"] != false || c["connectionError"] == nil {
		t.Fatalf("refused sector: %v", c)
	}
	if got := e.WhatsApp.Status(rh.ID); got != "logged_out" {
		t.Fatalf("refused device must be unlinked, status %s", got)
	}
	if got := e.connectionAudit(rh.ID); len(got) != 0 {
		t.Fatalf("a refused number never connected, audit = %v", got)
	}
	// O setor dono do número não muda.
	if c := e.connection(contab.ID, token); c["status"] != "connected" || c["phone"] != "5511999990000" || c["connectionError"] != nil {
		t.Fatalf("owner sector: %v", c)
	}

	// A nova tentativa limpa o motivo e outro número conecta.
	resp := e.Do(http.MethodPost, fmt.Sprintf("/api/sectors/%d/connection", rh.ID), token, nil)
	if resp.Status != http.StatusOK || resp.Body["connectionError"] != nil || resp.Body["pairing"] != true {
		t.Fatalf("connect after refusal: status %d, body %v", resp.Status, resp.Body)
	}
	if err := e.WhatsApp.Pair(t.Context(), rh.ID, "5511999990001@s.whatsapp.net"); err != nil {
		t.Fatal(err)
	}
	if c := e.connection(rh.ID, token); c["status"] != "connected" || c["phone"] != "5511999990001" {
		t.Fatalf("after another number: %v", c)
	}

	// Liberado pelo primeiro setor, o número pode ser ligado a outro.
	if err := e.WhatsApp.LogOut(t.Context(), contab.ID); err != nil {
		t.Fatal(err)
	}
	if err := e.WhatsApp.LogOut(t.Context(), rh.ID); err != nil {
		t.Fatal(err)
	}
	e.pair(rh.ID, token, account)
	if c := e.connection(rh.ID, token); c["status"] != "connected" || c["phone"] != "5511999990000" {
		t.Fatalf("after the number is free: %v", c)
	}
}

func TestSameNumberOnTwoSectorsAtOnce(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	sectors := []db.Sector{e.Sector("Contabilidade"), e.Sector("RH"), e.Sector("Tributos"), e.Sector("Compras")}
	e.User("admin@exemplo.com", db.UserRoleAdmin, nil)
	token := e.Login("admin@exemplo.com", testPassword)
	for _, sec := range sectors {
		if resp := e.Do(http.MethodPost, fmt.Sprintf("/api/sectors/%d/connection", sec.ID), token, nil); resp.Status != http.StatusOK {
			t.Fatalf("connect: status %d", resp.Status)
		}
	}

	var wg sync.WaitGroup
	errs := make([]error, len(sectors))
	for i, sec := range sectors {
		wg.Go(func() { errs[i] = e.WhatsApp.Pair(t.Context(), sec.ID, "5511999990000@s.whatsapp.net") })
	}
	wg.Wait()
	e.TicketService.Wait()
	for _, err := range errs {
		if err != nil {
			t.Fatalf("pair: %v", err)
		}
	}

	connected, refused := 0, 0
	for _, sec := range sectors {
		c := e.connection(sec.ID, token)
		switch {
		case c["status"] == "connected" && c["phone"] == "5511999990000":
			connected++
		case c["status"] == "logged_out" && c["connectionError"] != nil:
			refused++
		default:
			t.Errorf("sector %d: %v", sec.ID, c)
		}
	}
	if connected != 1 || refused != len(sectors)-1 {
		t.Fatalf("connected %d, refused %d", connected, refused)
	}
}

func TestDisconnectFromTheScreen(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	contab := e.Sector("Contabilidade")
	sup := e.User("sup@exemplo.com", db.UserRoleSupervisor, &contab.ID)
	token := e.Login("sup@exemplo.com", testPassword)
	path := fmt.Sprintf("/api/sectors/%d/connection", contab.ID)

	e.pair(contab.ID, token, "5511999990000@s.whatsapp.net")
	resp := e.Do(http.MethodDelete, path, token, nil)
	if resp.Status != http.StatusOK || resp.Body["status"] != "logged_out" || resp.Body["phone"] != nil || resp.Body["linked"] != false {
		t.Fatalf("disconnect: status %d, body %v", resp.Status, resp.Body)
	}
	if _, warned := resp.Body["warning"]; warned {
		t.Fatalf("device was told, body %v", resp.Body)
	}
	if got := e.WhatsApp.Status(contab.ID); got != "logged_out" {
		t.Fatalf("provider status %s, want logged_out", got)
	}
	if acc := e.accountID(contab.ID); acc != nil {
		t.Fatalf("account must be cleared, got %q", *acc)
	}

	// Auditoria com quem desvinculou; o evento do adaptador e a repetição não geram outro registro.
	check := func() {
		t.Helper()
		logs := e.connectionLogs(contab.ID)
		if len(logs) != 2 || logs[1].Action != "sector_disconnected" || logs[1].ActorID == nil || *logs[1].ActorID != sup.ID {
			t.Fatalf("audit = %+v, want sector_disconnected by %d", logs, sup.ID)
		}
	}
	check()
	if resp := e.Do(http.MethodDelete, path, token, nil); resp.Status != http.StatusOK || resp.Body["status"] != "logged_out" {
		t.Fatalf("repeat: status %d, body %v", resp.Status, resp.Body)
	}
	check()

	// O setor volta a conectar pelo QR code.
	resp = e.Do(http.MethodPost, path, token, nil)
	if resp.Status != http.StatusOK || resp.Body["pairing"] != true {
		t.Fatalf("connect after disconnect: status %d, body %v", resp.Status, resp.Body)
	}
	if err := e.WhatsApp.Pair(t.Context(), contab.ID, "5511999990000@s.whatsapp.net"); err != nil {
		t.Fatal(err)
	}
	if c := e.connection(contab.ID, token); c["status"] != "connected" || c["phone"] != "5511999990000" {
		t.Fatalf("after pairing again: %v", c)
	}
}

func TestDisconnectDuringDropIsAudited(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	contab := e.Sector("Contabilidade")
	admin := e.User("admin@exemplo.com", db.UserRoleAdmin, nil)
	token := e.Login("admin@exemplo.com", testPassword)

	e.pair(contab.ID, token, "5511999990000@s.whatsapp.net")
	if err := e.WhatsApp.Drop(t.Context(), contab.ID); err != nil {
		t.Fatal(err)
	}
	resp := e.Do(http.MethodDelete, fmt.Sprintf("/api/sectors/%d/connection", contab.ID), token, nil)
	if resp.Status != http.StatusOK || resp.Body["status"] != "logged_out" || resp.Body["phone"] != nil {
		t.Fatalf("disconnect: status %d, body %v", resp.Status, resp.Body)
	}
	logs := e.connectionLogs(contab.ID)
	last := logs[len(logs)-1]
	if last.Action != "sector_disconnected" || last.ActorID == nil || *last.ActorID != admin.ID {
		t.Fatalf("audit = %+v", logs)
	}
}

func TestDisconnectWithUnreachableDevice(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	contab := e.Sector("Contabilidade")
	e.User("admin@exemplo.com", db.UserRoleAdmin, nil)
	token := e.Login("admin@exemplo.com", testPassword)

	e.pair(contab.ID, token, "5511999990000@s.whatsapp.net")
	e.WhatsApp.FailNextDisconnect(contab.ID)
	resp := e.Do(http.MethodDelete, fmt.Sprintf("/api/sectors/%d/connection", contab.ID), token, nil)
	if resp.Status != http.StatusOK || resp.Body["status"] != "logged_out" || resp.Body["warning"] == nil {
		t.Fatalf("disconnect: status %d, body %v", resp.Status, resp.Body)
	}
	if acc := e.accountID(contab.ID); acc != nil {
		t.Fatalf("account must be cleared, got %q", *acc)
	}
}

func TestDisconnectWithoutNumberChangesNothing(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	contab := e.Sector("Contabilidade")
	e.User("admin@exemplo.com", db.UserRoleAdmin, nil)
	token := e.Login("admin@exemplo.com", testPassword)

	resp := e.Do(http.MethodDelete, fmt.Sprintf("/api/sectors/%d/connection", contab.ID), token, nil)
	if resp.Status != http.StatusOK || resp.Body["status"] != "disconnected" {
		t.Fatalf("disconnect: status %d, body %v", resp.Status, resp.Body)
	}
	if logs := e.connectionLogs(contab.ID); len(logs) != 0 {
		t.Fatalf("audit = %+v", logs)
	}
	if resp := e.Do(http.MethodDelete, "/api/sectors/999999/connection", token, nil); resp.Status != http.StatusNotFound {
		t.Fatalf("unknown sector: status %d", resp.Status)
	}
}

func TestDisconnectPermissions(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	contab := e.Sector("Contabilidade")
	rh := e.Sector("RH")
	e.User("agente@exemplo.com", db.UserRoleAgent, &contab.ID)
	e.User("sup.rh@exemplo.com", db.UserRoleSupervisor, &rh.ID)
	e.User("admin@exemplo.com", db.UserRoleAdmin, nil)
	admin := e.Login("admin@exemplo.com", testPassword)
	e.pair(contab.ID, admin, "5511999990000@s.whatsapp.net")

	path := fmt.Sprintf("/api/sectors/%d/connection", contab.ID)
	for _, email := range []string{"agente@exemplo.com", "sup.rh@exemplo.com"} {
		if resp := e.Do(http.MethodDelete, path, e.Login(email, testPassword), nil); resp.Status != http.StatusForbidden {
			t.Errorf("%s: status %d, want 403", email, resp.Status)
		}
	}
	if got := e.WhatsApp.Status(contab.ID); got != "connected" {
		t.Fatalf("refused requests must not unlink, status %s", got)
	}
	if resp := e.Do(http.MethodDelete, path, admin, nil); resp.Status != http.StatusOK || resp.Body["status"] != "logged_out" {
		t.Fatalf("admin: status %d, body %v", resp.Status, resp.Body)
	}
}
