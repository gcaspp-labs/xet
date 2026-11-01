package httpapi

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"os/exec"
	"strings"
	"sync"
	"testing"

	"github.com/gcaspp-labs/xet/backend/internal/core/auth"
	"github.com/gcaspp-labs/xet/backend/internal/core/realtime"
	"github.com/gcaspp-labs/xet/backend/internal/db"
	"github.com/gcaspp-labs/xet/backend/internal/helpdesk/messaging"
)

const (
	requestA = "6f1b6d3e-1d0a-4f5b-9c1e-0a1b2c3d4e5f"
	requestB = "7a2c7e4f-2e1b-4a6c-8d2f-1b2c3d4e5f60"
)

// connectSector links and connects the sector number, as after reading the QR code.
func (e *testEnv) connectSector(sectorID int64) {
	e.t.Helper()
	if err := e.whatsapp.Connect(e.t.Context(), messaging.Account{SectorID: sectorID, AccountID: fmt.Sprintf("account-%d", sectorID)}); err != nil {
		e.t.Fatal(err)
	}
}

func (e *testEnv) sendText(ticketID int64, token, requestID, body string) response {
	e.t.Helper()
	return e.do(http.MethodPost, fmt.Sprintf("/api/tickets/%d/messages", ticketID), token,
		map[string]string{"clientRequestId": requestID, "body": body})
}

// sendFile posts a file to the ticket as the panel does, in a multipart form.
func (e *testEnv) sendFile(ticketID int64, token, requestID, name, mimeType string, data []byte, caption string) response {
	e.t.Helper()
	return e.sendForm(ticketID, token, requestID, "file", name, mimeType, data, caption)
}

// sendVoice posts audio recorded in the browser, to go as a voice message.
func (e *testEnv) sendVoice(ticketID int64, token, requestID string, data []byte, caption string) response {
	e.t.Helper()
	return e.sendForm(ticketID, token, requestID, "voice", "gravacao.webm", "audio/webm;codecs=opus", data, caption)
}

func (e *testEnv) sendForm(ticketID int64, token, requestID, field, name, mimeType string, data []byte, caption string) response {
	e.t.Helper()
	var buf bytes.Buffer
	form := multipart.NewWriter(&buf)
	_ = form.WriteField("clientRequestId", requestID)
	_ = form.WriteField("caption", caption)
	header := textproto.MIMEHeader{}
	header.Set("Content-Disposition", fmt.Sprintf(`form-data; name=%q; filename=%q`, field, name))
	header.Set("Content-Type", mimeType)
	part, err := form.CreatePart(header)
	if err != nil {
		e.t.Fatal(err)
	}
	_, _ = part.Write(data)
	_ = form.Close()

	req, err := http.NewRequestWithContext(e.t.Context(), http.MethodPost, fmt.Sprintf("%s/api/tickets/%d/messages", e.url, ticketID), &buf)
	if err != nil {
		e.t.Fatal(err)
	}
	req.Header.Set("Content-Type", form.FormDataContentType())
	req.AddCookie(&http.Cookie{Name: auth.SessionCookie, Value: token})
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		e.t.Fatal(err)
	}
	defer resp.Body.Close()
	out := response{status: resp.StatusCode}
	raw, _ := io.ReadAll(resp.Body)
	_ = json.Unmarshal(raw, &out.body)
	return out
}

// get returns the raw response of a GET, for routes that answer with a list or a file.
func (e *testEnv) get(path, token string) (int, http.Header, []byte) {
	e.t.Helper()
	req, err := http.NewRequestWithContext(e.t.Context(), http.MethodGet, e.url+path, nil)
	if err != nil {
		e.t.Fatal(err)
	}
	req.AddCookie(&http.Cookie{Name: auth.SessionCookie, Value: token})
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		e.t.Fatal(err)
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	return resp.StatusCode, resp.Header, raw
}

// outbound returns the messages of the ticket sent by the sector.
func (e *testEnv) outbound(ticketID int64) []messageRow {
	e.t.Helper()
	var out []messageRow
	for _, m := range e.messages(ticketID) {
		if m.Direction == "outbound" {
			out = append(out, m)
		}
	}
	return out
}

func (e *testEnv) failureReason(messageID int64) *string {
	e.t.Helper()
	var reason *string
	if err := e.pool.QueryRow(e.t.Context(), "select failure_reason from messages where id = $1", messageID).Scan(&reason); err != nil {
		e.t.Fatal(err)
	}
	return reason
}

func str(p *string) string {
	if p == nil {
		return "<nil>"
	}
	return *p
}

// conversation is a sector with a connected number, an assigned ticket and
// users of every role.
type conversation struct {
	e          *testEnv
	sector     db.Sector
	ticket     ticketRow
	ana        db.User // assignee
	anaToken   string
	biaToken   string // agent of the same sector
	supToken   string
	adminToken string
	rhToken    string // agent of another sector
}

func newConversation(t *testing.T) conversation {
	t.Helper()
	e := newTestEnv(t, nil)
	c := conversation{e: e, sector: e.sector("Contabilidade")}
	rh := e.sector("RH")
	c.ana = e.user("ana@exemplo.com", db.UserRoleAgent, &c.sector.ID)
	e.user("bia@exemplo.com", db.UserRoleAgent, &c.sector.ID)
	e.user("sup@exemplo.com", db.UserRoleSupervisor, &c.sector.ID)
	e.user("admin@exemplo.com", db.UserRoleAdmin, nil)
	e.user("rh@exemplo.com", db.UserRoleAgent, &rh.ID)
	c.anaToken = e.login("ana@exemplo.com", testPassword)
	c.biaToken = e.login("bia@exemplo.com", testPassword)
	c.supToken = e.login("sup@exemplo.com", testPassword)
	c.adminToken = e.login("admin@exemplo.com", testPassword)
	c.rhToken = e.login("rh@exemplo.com", testPassword)

	e.connectSector(c.sector.ID)
	c.ticket = e.queuedTicket(c.sector.ID, "MSG-1", "5511988887777")
	return c
}

func (c conversation) assign() {
	c.e.t.Helper()
	if resp := c.e.assign(c.ticket.ID, c.anaToken); resp.status != http.StatusOK {
		c.e.t.Fatalf("assign: status %d", resp.status)
	}
}

func TestOnlyTheAssigneeReplies(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e := c.e

	// Na fila, sem responsável, ninguém responde.
	if resp := e.sendText(c.ticket.ID, c.anaToken, requestA, "Bom dia"); resp.status != http.StatusForbidden {
		t.Fatalf("queued ticket: status %d", resp.status)
	}
	c.assign()

	// Outros usuários são bloqueados no backend, mesmo chamando a API diretamente.
	for name, token := range map[string]string{
		"agent of the sector": c.biaToken, "supervisor": c.supToken, "admin": c.adminToken, "other sector": c.rhToken,
	} {
		resp := e.sendText(c.ticket.ID, token, requestA, "Posso ajudar?")
		if resp.status != http.StatusForbidden {
			t.Fatalf("%s: status %d", name, resp.status)
		}
		file := e.sendFile(c.ticket.ID, token, requestB, "nota.pdf", "application/pdf", []byte("%PDF"), "")
		if file.status != http.StatusForbidden {
			t.Fatalf("%s sending a file: status %d", name, file.status)
		}
	}
	if resp := e.sendText(c.ticket.ID, "", requestA, "Oi"); resp.status != http.StatusUnauthorized {
		t.Fatalf("without session: status %d", resp.status)
	}
	if got := e.outbound(c.ticket.ID); len(got) != 0 {
		t.Fatalf("blocked senders recorded messages: %+v", got)
	}
	if sent := e.whatsapp.SentMessages(); len(sent) != 0 {
		t.Fatalf("blocked senders reached WhatsApp: %+v", sent)
	}

	resp := e.sendText(c.ticket.ID, c.anaToken, requestA, "Bom dia, em que posso ajudar?")
	if resp.status != http.StatusOK || resp.body["status"] != "sent" {
		t.Fatalf("assignee: status %d, body %v", resp.status, resp.body)
	}
	got := e.outbound(c.ticket.ID)
	if len(got) != 1 {
		t.Fatalf("outbound messages = %+v", got)
	}
	m := got[0]
	if m.Origin != "agent" || m.AuthorID == nil || *m.AuthorID != c.ana.ID || m.Type != "text" ||
		str(m.Body) != "Bom dia, em que posso ajudar?" || str(m.Status) != "sent" || m.ExternalMessageID == nil {
		t.Fatalf("sent message = %+v", m)
	}
	sent := e.whatsapp.SentMessages()
	if len(sent) != 1 {
		t.Fatalf("sent to WhatsApp = %+v", sent)
	}
	if msg, ok := sent[0].(messaging.TextMessage); !ok || msg.To != "5511988887777@s.whatsapp.net" ||
		msg.SectorID != c.sector.ID || msg.Body != "Bom dia, em que posso ajudar?" || msg.IdempotencyKey != requestA {
		t.Fatalf("WhatsApp message = %+v", sent[0])
	}

	// A conversa mostra recebidas e enviadas, com quem enviou.
	status, _, raw := e.get(fmt.Sprintf("/api/tickets/%d/messages", c.ticket.ID), c.biaToken)
	var conv []map[string]any
	_ = json.Unmarshal(raw, &conv)
	if status != http.StatusOK || len(conv) != 2 || conv[0]["origin"] != "customer" || conv[1]["origin"] != "agent" ||
		conv[1]["author"].(map[string]any)["name"] != "ana@exemplo.com" || conv[1]["status"] != "sent" {
		t.Fatalf("conversation: status %d, %v", status, conv)
	}
	if status, _, _ := e.get(fmt.Sprintf("/api/tickets/%d/messages", c.ticket.ID), c.rhToken); status != http.StatusForbidden {
		t.Fatalf("conversation from another sector: status %d", status)
	}
	if status, _, _ := e.get(fmt.Sprintf("/api/tickets/%d", c.ticket.ID), c.rhToken); status != http.StatusForbidden {
		t.Fatalf("ticket from another sector: status %d", status)
	}

	// Encerrado, nem o responsável responde.
	e.closeTicket(c.ticket.ID, c.ana.ID, e.organization(c.supToken, "Prefeitura", ""))
	if resp := e.sendText(c.ticket.ID, c.anaToken, requestB, "Mais alguma coisa?"); resp.status != http.StatusConflict {
		t.Fatalf("closed ticket: status %d", resp.status)
	}
}

func TestSendingIsIdempotent(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e := c.e
	c.assign()

	// Cliques repetidos e simultâneos com o mesmo identificador geram uma única mensagem.
	const attempts = 8
	statuses := make([]int, attempts)
	ids := make([]any, attempts)
	var wg sync.WaitGroup
	start := make(chan struct{})
	for i := range attempts {
		wg.Go(func() {
			<-start
			resp := e.sendText(c.ticket.ID, c.anaToken, requestA, "Segue o boleto")
			statuses[i], ids[i] = resp.status, resp.body["id"]
		})
	}
	close(start)
	wg.Wait()
	for i := range attempts {
		if statuses[i] != http.StatusOK || ids[i] != ids[0] {
			t.Fatalf("attempt %d: status %d, id %v (first %v)", i, statuses[i], ids[i], ids[0])
		}
	}
	if got := e.outbound(c.ticket.ID); len(got) != 1 {
		t.Fatalf("messages recorded = %d, want 1", len(got))
	}
	if sent := e.whatsapp.SentMessages(); len(sent) != 1 {
		t.Fatalf("messages sent = %d, want 1", len(sent))
	}

	// Repetir depois devolve a mesma mensagem, sem reenviar.
	resp := e.sendText(c.ticket.ID, c.anaToken, requestA, "Segue o boleto")
	if resp.status != http.StatusOK || resp.body["id"] != ids[0] || resp.body["status"] != "sent" {
		t.Fatalf("repeated request: status %d, body %v", resp.status, resp.body)
	}
	if sent := e.whatsapp.SentMessages(); len(sent) != 1 {
		t.Fatalf("repeated request resent: %d messages", len(sent))
	}

	// O identificador de um envio não serve para outro chamado.
	other := e.queuedTicket(c.sector.ID, "MSG-2", "5511977776666")
	if r := e.assign(other.ID, c.anaToken); r.status != http.StatusOK {
		t.Fatalf("assign other: status %d", r.status)
	}
	if r := e.sendText(other.ID, c.anaToken, requestA, "Outro"); r.status != http.StatusConflict {
		t.Fatalf("request id of another ticket: status %d", r.status)
	}
	// Mensagem vazia ou identificador inválido não é aceito.
	if r := e.sendText(c.ticket.ID, c.anaToken, requestB, "   "); r.status != http.StatusUnprocessableEntity {
		t.Fatalf("blank message: status %d", r.status)
	}
	if r := e.sendText(c.ticket.ID, c.anaToken, "abc", "Oi"); r.status != http.StatusUnprocessableEntity {
		t.Fatalf("invalid request id: status %d", r.status)
	}
}

func TestSendingFiles(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e := c.e
	c.assign()

	png := append([]byte("\x89PNG\r\n\x1a\n"), make([]byte, 32)...)
	resp := e.sendFile(c.ticket.ID, c.anaToken, requestA, "foto.png", "image/png", png, "Comprovante")
	if resp.status != http.StatusOK || resp.body["status"] != "sent" {
		t.Fatalf("image: status %d, body %v", resp.status, resp.body)
	}
	pdf := []byte("%PDF-1.7 balancete")
	resp = e.sendFile(c.ticket.ID, c.anaToken, requestB, "balancete.pdf", "application/pdf", pdf, "")
	if resp.status != http.StatusOK || resp.body["status"] != "sent" {
		t.Fatalf("document: status %d, body %v", resp.status, resp.body)
	}

	got := e.outbound(c.ticket.ID)
	if len(got) != 2 || got[0].Type != "image" || str(got[0].Body) != "Comprovante" || got[1].Type != "document" || got[1].Body != nil {
		t.Fatalf("file messages = %+v", got)
	}
	if f := e.media(*got[1].MediaID); f.MimeType != "application/pdf" || str(f.FileName) != "balancete.pdf" || f.SizeBytes != int64(len(pdf)) {
		t.Fatalf("document file = %+v", f)
	}
	sent := e.whatsapp.SentMessages()
	img, ok := sent[0].(messaging.MediaMessage)
	if !ok || img.Type != messaging.TypeImage || img.Caption != "Comprovante" || !bytes.Equal(img.Media.Data, png) {
		t.Fatalf("image sent = %+v", sent[0])
	}
	doc, ok := sent[1].(messaging.MediaMessage)
	if !ok || doc.Type != messaging.TypeDocument || doc.Media.FileName != "balancete.pdf" || !bytes.Equal(doc.Media.Data, pdf) {
		t.Fatalf("document sent = %+v", sent[1])
	}

	// O arquivo é baixado por quem vê o chamado, e só por ele.
	path := fmt.Sprintf("/api/media/%d", *got[1].MediaID)
	status, header, body := e.get(path, c.biaToken)
	if status != http.StatusOK || !bytes.Equal(body, pdf) || header.Get("Content-Type") != "application/pdf" ||
		!strings.Contains(header.Get("Content-Disposition"), "balancete.pdf") {
		t.Fatalf("download: status %d, headers %v", status, header)
	}
	if status, _, _ := e.get(path, c.rhToken); status != http.StatusForbidden {
		t.Fatalf("download from another sector: status %d", status)
	}
	if status, _, _ := e.get("/api/media/999999", c.biaToken); status != http.StatusNotFound {
		t.Fatalf("unknown file: status %d", status)
	}

	// Acima de 16 MB, o arquivo é recusado antes de qualquer registro.
	big := make([]byte, 16<<20+1)
	if r := e.sendFile(c.ticket.ID, c.anaToken, "8b3d8f50-3f2c-4b7d-9e30-2c3d4e5f6071", "grande.zip", "application/zip", big, ""); r.status != http.StatusRequestEntityTooLarge {
		t.Fatalf("large file: status %d", r.status)
	}
	if got := e.outbound(c.ticket.ID); len(got) != 2 {
		t.Fatalf("large file recorded: %d messages", len(got))
	}
}

// recordWebM makes a WebM/Opus recording like the browser's, with a tone
// of the given seconds.
func recordWebM(t *testing.T, seconds int) []byte {
	t.Helper()
	out, err := exec.CommandContext(t.Context(), "ffmpeg", "-hide_banner", "-loglevel", "error", "-nostdin",
		"-f", "lavfi", "-i", fmt.Sprintf("sine=frequency=440:duration=%d", seconds),
		"-c:a", "libopus", "-f", "webm", "pipe:1").Output()
	if err != nil {
		t.Fatalf("ffmpeg: %v", err)
	}
	return out
}

func TestRecordedAudioGoesAsVoiceMessage(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e := c.e
	c.assign()
	webm := recordWebM(t, 2)

	// Só o responsável envia áudio; a gravação recusada não deixa registro.
	if r := e.sendVoice(c.ticket.ID, c.biaToken, requestB, webm, ""); r.status != http.StatusForbidden {
		t.Fatalf("voice by another agent: status %d", r.status)
	}
	// Conteúdo que não é áudio é recusado com uma mensagem clara.
	if r := e.sendVoice(c.ticket.ID, c.anaToken, requestB, []byte("não é áudio"), ""); r.status != http.StatusUnprocessableEntity {
		t.Fatalf("invalid audio: status %d, body %v", r.status, r.body)
	}
	if got := e.outbound(c.ticket.ID); len(got) != 0 {
		t.Fatalf("refused audio recorded: %+v", got)
	}

	// A legenda é ignorada: mensagem de voz não tem texto.
	resp := e.sendVoice(c.ticket.ID, c.anaToken, requestA, webm, "legenda indevida")
	if resp.status != http.StatusOK || resp.body["status"] != "sent" {
		t.Fatalf("voice: status %d, body %v", resp.status, resp.body)
	}
	got := e.outbound(c.ticket.ID)
	if len(got) != 1 || got[0].Type != "audio" || got[0].Body != nil || got[0].MediaID == nil {
		t.Fatalf("voice message = %+v", got)
	}
	file := e.media(*got[0].MediaID)
	if file.MimeType != "audio/ogg; codecs=opus" || file.FileName != nil {
		t.Fatalf("voice file = %+v", file)
	}

	// Convertido para OGG/Opus e enviado como áudio, com a duração da gravação.
	sent := e.whatsapp.SentMessages()
	if len(sent) != 1 {
		t.Fatalf("sent %d messages, want 1", len(sent))
	}
	voice, ok := sent[0].(messaging.MediaMessage)
	if !ok || voice.Type != messaging.TypeAudio || voice.Media.MimeType != "audio/ogg; codecs=opus" ||
		voice.Media.DurationSeconds != 2 || voice.Caption != "" || !bytes.HasPrefix(voice.Media.Data, []byte("OggS")) {
		t.Fatalf("voice sent = type %s, mime %q, seconds %d, caption %q", voice.Type, voice.Media.MimeType, voice.Media.DurationSeconds, voice.Caption)
	}

	// A conversa informa a duração do áudio, para o painel mostrar ao lado do player.
	status, _, raw := e.get(fmt.Sprintf("/api/tickets/%d/messages", c.ticket.ID), c.biaToken)
	var listed []struct {
		Media *struct {
			DurationSeconds *int32 `json:"durationSeconds"`
		} `json:"media"`
	}
	if err := json.Unmarshal(raw, &listed); status != http.StatusOK || err != nil {
		t.Fatalf("list messages: status %d, error %v", status, err)
	}
	last := listed[len(listed)-1]
	if last.Media == nil || last.Media.DurationSeconds == nil || *last.Media.DurationSeconds != 2 {
		t.Fatalf("listed voice media = %+v", last.Media)
	}

	// Repetir o envio devolve a mesma mensagem, sem converter nem enviar de novo.
	if r := e.sendVoice(c.ticket.ID, c.anaToken, requestA, webm, ""); r.status != http.StatusOK || id(r.body) != got[0].ID {
		t.Fatalf("repeated voice: status %d, body %v", r.status, r.body)
	}
	if sent := e.whatsapp.SentMessages(); len(sent) != 1 {
		t.Fatalf("repeated voice sent again: %d messages", len(sent))
	}
	if n := e.count("media_files"); n != 1 {
		t.Fatalf("media files = %d, want 1", n)
	}

	// O player do painel busca trechos do arquivo para avançar e voltar.
	req, err := http.NewRequestWithContext(t.Context(), http.MethodGet, fmt.Sprintf("%s/api/media/%d", e.url, *got[0].MediaID), nil)
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Range", "bytes=0-3")
	req.AddCookie(&http.Cookie{Name: auth.SessionCookie, Value: c.biaToken})
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	part, _ := io.ReadAll(res.Body)
	if res.StatusCode != http.StatusPartialContent || string(part) != "OggS" || res.Header.Get("Content-Type") != "audio/ogg; codecs=opus" ||
		!strings.HasPrefix(res.Header.Get("Content-Disposition"), "inline") {
		t.Fatalf("range: status %d, body %q, headers %v", res.StatusCode, part, res.Header)
	}
}

func TestDeliveryStatusOnlyMovesForward(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e := c.e
	c.assign()
	events := e.subscribe(c.biaToken)

	if r := e.sendText(c.ticket.ID, c.anaToken, requestA, "Bom dia"); r.status != http.StatusOK {
		t.Fatalf("send: status %d", r.status)
	}
	// Gravada como pendente e atualizada após o envio: os dois avisos saem depois do commit.
	for range 2 {
		if ev := e.nextEvent(events); ev != realtime.TicketChanged(c.sector.ID, c.ticket.ID) {
			t.Fatalf("event = %+v", ev)
		}
	}
	msg := e.outbound(c.ticket.ID)[0]
	external := *msg.ExternalMessageID

	steps := []struct {
		status messaging.DeliveryStatus
		want   string
	}{
		{messaging.DeliveryDelivered, "delivered"},
		{messaging.DeliveryRead, "read"},
		// Confirmação de entrega atrasada não desfaz a leitura.
		{messaging.DeliveryDelivered, "read"},
		{messaging.DeliveryFailed, "read"},
	}
	for _, step := range steps {
		if err := e.whatsapp.UpdateStatus(t.Context(), c.sector.ID, step.status, external); err != nil {
			t.Fatal(err)
		}
		if got := str(e.outbound(c.ticket.ID)[0].Status); got != step.want {
			t.Fatalf("after %s: status %s, want %s", step.status, got, step.want)
		}
	}
	// Só as mudanças efetivas avisam o painel.
	for range 2 {
		if ev := e.nextEvent(events); ev != realtime.TicketChanged(c.sector.ID, c.ticket.ID) {
			t.Fatalf("status event = %+v", ev)
		}
	}

	// Status de outro setor com o mesmo identificador não afeta a mensagem.
	other := e.sector("Tributos")
	if err := e.whatsapp.UpdateStatus(t.Context(), other.ID, messaging.DeliveryFailed, external); err != nil {
		t.Fatal(err)
	}
	if got := str(e.outbound(c.ticket.ID)[0].Status); got != "read" {
		t.Fatalf("status from another sector changed the message: %s", got)
	}
}

func TestFailedMessageIsRetriedByTheAssignee(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e := c.e
	c.assign()

	// Número desconectado: a mensagem fica registrada como falha, sem reenvio automático.
	if err := e.whatsapp.Drop(t.Context(), c.sector.ID); err != nil {
		t.Fatal(err)
	}
	resp := e.sendText(c.ticket.ID, c.anaToken, requestA, "Segue o boleto")
	if resp.status != http.StatusOK || resp.body["status"] != "failed" || resp.body["failureReason"] != "Número do setor desconectado." {
		t.Fatalf("send while disconnected: status %d, body %v", resp.status, resp.body)
	}
	msgID := int64(resp.body["id"].(float64))
	retryPath := fmt.Sprintf("/api/messages/%d/retry", msgID)

	if r := e.do(http.MethodPost, retryPath, c.anaToken, nil); r.status != http.StatusOK || r.body["status"] != "failed" {
		t.Fatalf("retry while disconnected: status %d, body %v", r.status, r.body)
	}
	e.connectSector(c.sector.ID)
	for name, token := range map[string]string{"agent of the sector": c.biaToken, "supervisor": c.supToken, "other sector": c.rhToken} {
		if r := e.do(http.MethodPost, retryPath, token, nil); r.status != http.StatusForbidden {
			t.Fatalf("retry by %s: status %d", name, r.status)
		}
	}
	if r := e.do(http.MethodPost, retryPath, c.anaToken, nil); r.status != http.StatusOK || r.body["status"] != "sent" {
		t.Fatalf("retry: status %d, body %v", r.status, r.body)
	}
	if reason := e.failureReason(msgID); reason != nil {
		t.Fatalf("failure reason kept after sending: %s", *reason)
	}
	// Mensagem já enviada não é reenviada.
	if r := e.do(http.MethodPost, retryPath, c.anaToken, nil); r.status != http.StatusConflict {
		t.Fatalf("retry of a sent message: status %d", r.status)
	}
	if got := e.outbound(c.ticket.ID); len(got) != 1 {
		t.Fatalf("retries created messages: %+v", got)
	}
	if sent := e.whatsapp.SentMessages(); len(sent) != 1 || sent[0].(messaging.TextMessage).IdempotencyKey != requestA {
		t.Fatalf("sent to WhatsApp = %+v", sent)
	}
	// Mensagem recebida não tem reenvio.
	inbound := e.messages(c.ticket.ID)[0]
	if r := e.do(http.MethodPost, fmt.Sprintf("/api/messages/%d/retry", inbound.ID), c.anaToken, nil); r.status != http.StatusConflict {
		t.Fatalf("retry of a received message: status %d", r.status)
	}
}

func TestPendingMessagesFailOnRestart(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e := c.e
	c.assign()

	if r := e.sendText(c.ticket.ID, c.anaToken, requestA, "Bom dia"); r.status != http.StatusOK {
		t.Fatalf("send: status %d", r.status)
	}
	msgID := e.outbound(c.ticket.ID)[0].ID
	// O serviço parou entre gravar a mensagem e receber a resposta do WhatsApp.
	if _, err := e.pool.Exec(t.Context(), "update messages set status = 'pending', external_message_id = null where id = $1", msgID); err != nil {
		t.Fatal(err)
	}

	restarted := startServer(t, e.pool, nil)
	n, err := restarted.ticketService.FailPending(t.Context())
	if err != nil || n != 1 {
		t.Fatalf("fail pending: %d, %v", n, err)
	}
	if got := restarted.outbound(c.ticket.ID)[0]; str(got.Status) != "failed" || str(restarted.failureReason(msgID)) != "O serviço foi reiniciado durante o envio." {
		t.Fatalf("after restart: %+v", got)
	}

	// O responsável reenvia com a mesma chave, sem duplicar no WhatsApp.
	restarted.connectSector(c.sector.ID)
	token := restarted.login("ana@exemplo.com", testPassword)
	r := restarted.do(http.MethodPost, fmt.Sprintf("/api/messages/%d/retry", msgID), token, nil)
	if r.status != http.StatusOK || r.body["status"] != "sent" {
		t.Fatalf("retry after restart: status %d, body %v", r.status, r.body)
	}
	if got := restarted.outbound(c.ticket.ID)[0]; str(got.ExternalMessageID) != "fake-msg-"+requestA {
		t.Fatalf("external id after retry = %s", str(got.ExternalMessageID))
	}
}

func TestInternalNotesAndSpokeWith(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e := c.e
	c.assign()
	notesPath := fmt.Sprintf("/api/tickets/%d/notes", c.ticket.ID)
	spokePath := fmt.Sprintf("/api/tickets/%d/spoke-with", c.ticket.ID)

	// Qualquer pessoa do setor escreve notas, mesmo sem ser a responsável.
	for _, token := range []string{c.biaToken, c.supToken, c.anaToken} {
		if r := e.do(http.MethodPost, notesPath, token, map[string]string{"body": "Cliente pediu retorno à tarde"}); r.status != http.StatusCreated {
			t.Fatalf("create note: status %d, body %v", r.status, r.body)
		}
	}
	if r := e.do(http.MethodPost, notesPath, c.rhToken, map[string]string{"body": "Nota"}); r.status != http.StatusForbidden {
		t.Fatalf("note from another sector: status %d", r.status)
	}
	if r := e.do(http.MethodPost, notesPath, c.biaToken, map[string]string{"body": "  "}); r.status != http.StatusUnprocessableEntity {
		t.Fatalf("blank note: status %d", r.status)
	}
	notes := e.doList(http.MethodGet, notesPath, c.adminToken)
	if len(notes) != 3 || notes[0]["author"].(map[string]any)["name"] != "bia@exemplo.com" || notes[0]["body"] != "Cliente pediu retorno à tarde" {
		t.Fatalf("notes = %v", notes)
	}
	if status, _, _ := e.get(notesPath, c.rhToken); status != http.StatusForbidden {
		t.Fatalf("notes from another sector: status %d", status)
	}
	// Notas não vão para o cliente.
	if sent := e.whatsapp.SentMessages(); len(sent) != 0 {
		t.Fatalf("notes reached WhatsApp: %+v", sent)
	}

	// "Falou com" é preenchido só pelo responsável.
	for name, token := range map[string]string{"agent of the sector": c.biaToken, "supervisor": c.supToken, "other sector": c.rhToken} {
		if r := e.do(http.MethodPut, spokePath, token, map[string]string{"spokeWith": "Maria"}); r.status != http.StatusForbidden {
			t.Fatalf("spoke with by %s: status %d", name, r.status)
		}
	}
	if r := e.do(http.MethodPut, spokePath, c.anaToken, map[string]string{"spokeWith": " Maria, esposa do titular "}); r.status != http.StatusOK {
		t.Fatalf("spoke with: status %d", r.status)
	}
	detail := e.do(http.MethodGet, fmt.Sprintf("/api/tickets/%d", c.ticket.ID), c.biaToken, nil)
	if detail.status != http.StatusOK || detail.body["spokeWith"] != "Maria, esposa do titular" ||
		detail.body["assignee"].(map[string]any)["name"] != "ana@exemplo.com" || detail.body["protocol"] != c.ticket.Protocol {
		t.Fatalf("ticket detail: status %d, body %v", detail.status, detail.body)
	}

	// Encerrado: "falou com" só muda pela correção; notas continuam.
	e.closeTicket(c.ticket.ID, c.ana.ID, e.organization(c.supToken, "Prefeitura", ""))
	if r := e.do(http.MethodPut, spokePath, c.anaToken, map[string]string{"spokeWith": "João"}); r.status != http.StatusConflict {
		t.Fatalf("spoke with on closed ticket: status %d", r.status)
	}
	if r := e.do(http.MethodPost, notesPath, c.biaToken, map[string]string{"body": "Retornou depois"}); r.status != http.StatusCreated {
		t.Fatalf("note on closed ticket: status %d", r.status)
	}
}

func TestHistoryByContactAndOrganization(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	contab := e.sector("Contabilidade")
	rh := e.sector("RH")
	ana := e.user("ana@exemplo.com", db.UserRoleAgent, &contab.ID)
	e.user("sup@exemplo.com", db.UserRoleSupervisor, &contab.ID)
	e.user("rh@exemplo.com", db.UserRoleAgent, &rh.ID)
	e.user("admin@exemplo.com", db.UserRoleAdmin, nil)
	anaToken := e.login("ana@exemplo.com", testPassword)
	supToken := e.login("sup@exemplo.com", testPassword)
	rhToken := e.login("rh@exemplo.com", testPassword)
	adminToken := e.login("admin@exemplo.com", testPassword)

	org := e.organization(supToken, "Câmara Municipal", "")
	maria := e.contact(anaToken, "Maria", "5511988887777", org, contab.ID)
	joao := e.contact(anaToken, "João", "5511977776666", org, contab.ID)

	// Maria: um chamado encerrado e outro aberto na Contabilidade, e um no RH. João: um na Contabilidade.
	first := e.queuedTicket(contab.ID, "M-1", "5511988887777")
	e.closeTicket(first.ID, ana.ID, org)
	second := e.queuedTicket(contab.ID, "M-2", "5511988887777")
	rhTicket := e.queuedTicket(rh.ID, "M-3", "5511988887777")
	joaoTicket := e.queuedTicket(contab.ID, "J-1", "5511977776666")

	ids := func(list []map[string]any) []int64 {
		out := make([]int64, len(list))
		for i, item := range list {
			out[i] = id(item)
		}
		return out
	}
	check := func(name string, got []int64, want ...int64) {
		t.Helper()
		if fmt.Sprint(got) != fmt.Sprint(want) {
			t.Fatalf("%s = %v, want %v", name, got, want)
		}
	}

	contactPath := fmt.Sprintf("/api/contacts/%d/tickets", maria)
	orgPath := fmt.Sprintf("/api/organizations/%d/tickets", org)
	// Do mais recente ao mais antigo, só dos setores do usuário.
	check("contact history of the sector", ids(e.doList(http.MethodGet, contactPath, anaToken)), second.ID, first.ID)
	check("contact history of another sector", ids(e.doList(http.MethodGet, contactPath, rhToken)), rhTicket.ID)
	check("contact history for the admin", ids(e.doList(http.MethodGet, contactPath, adminToken)), rhTicket.ID, second.ID, first.ID)
	check("organization history of the sector", ids(e.doList(http.MethodGet, orgPath, anaToken)), joaoTicket.ID, second.ID, first.ID)
	check("organization history of another sector", ids(e.doList(http.MethodGet, orgPath, rhToken)), rhTicket.ID)
	check("history of João", ids(e.doList(http.MethodGet, fmt.Sprintf("/api/contacts/%d/tickets", joao), anaToken)), joaoTicket.ID)

	list := e.doList(http.MethodGet, contactPath, anaToken)
	if list[1]["status"] != "closed" || list[1]["subject"] != "Dúvida" || list[1]["sectorName"] != "Contabilidade" ||
		list[1]["organizationName"] != "Câmara Municipal" || list[1]["closedAt"] == nil {
		t.Fatalf("closed ticket in history = %v", list[1])
	}
	// A conversa de um chamado encerrado continua acessível a quem vê o setor.
	if status, _, _ := e.get(fmt.Sprintf("/api/tickets/%d/messages", first.ID), anaToken); status != http.StatusOK {
		t.Fatalf("messages of a closed ticket: status %d", status)
	}
	if status, _, _ := e.get(fmt.Sprintf("/api/tickets/%d/messages", first.ID), rhToken); status != http.StatusForbidden {
		t.Fatalf("messages of a closed ticket from another sector: status %d", status)
	}
}
