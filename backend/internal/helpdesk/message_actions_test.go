package helpdesk_test

import (
	"context"
	"fmt"
	"net/http"
	"reflect"
	"sync"
	"testing"
	"time"

	"github.com/gcaspp-labs/xet/backend/internal/helpdesk"
	"github.com/gcaspp-labs/xet/backend/internal/helpdesk/messaging"
)

const (
	requestE1 = "0b5e7f10-3c1d-4a2e-9f30-1a2b3c4d5e01"
	requestE2 = "0b5e7f10-3c1d-4a2e-9f30-1a2b3c4d5e02"
	requestE3 = "0b5e7f10-3c1d-4a2e-9f30-1a2b3c4d5e03"
	requestE4 = "0b5e7f10-3c1d-4a2e-9f30-1a2b3c4d5e04"
	requestE5 = "0b5e7f10-3c1d-4a2e-9f30-1a2b3c4d5e05"

	anaPrefix = "*ana@exemplo.com:*"
)

// O responsável edita o texto: a mensagem é a mesma, de quem enviou, com o horário
// e apelido do envio; o WhatsApp recebe a edição da mensagem original, e o
// histórico guarda a original e a nova versão, com auditoria.
func TestAssigneeEditsTextKeepingIdentityNicknameAndTime(t *testing.T) {
	t.Parallel()
	c := newSentConversation(t)
	e := c.e
	before := e.outbound(c.ticket.ID)[0]

	resp := e.editMessage(c.sent, c.anaToken, requestE1, "Segue o boleto de outubro")
	want := anaPrefix + "\nSegue o boleto de outubro"
	if resp.Status != http.StatusOK || resp.Body["body"] != want || resp.Body["editedAt"] == nil || resp.Body["id"] != float64(c.sent) {
		t.Fatalf("edit: status %d, body %v", resp.Status, resp.Body)
	}
	after := e.outbound(c.ticket.ID)
	if len(after) != 1 || after[0].ID != before.ID || str(after[0].Body) != want || !after[0].SentAt.Equal(before.SentAt) ||
		*after[0].AuthorID != *before.AuthorID || str(after[0].ExternalMessageID) != str(before.ExternalMessageID) || str(after[0].Status) != "sent" {
		t.Fatalf("message after edit = %+v, before %+v", after, before)
	}
	wantSent := []any{messaging.MessageEdit{
		SectorID: c.sector.ID, To: "5511988887777@s.whatsapp.net", TargetExternalMessageID: "fake-msg-" + requestA,
		Type: messaging.TypeText, Body: want, IdempotencyKey: requestE1,
	}}
	if got := e.sentChanges(); !reflect.DeepEqual(got, wantSent) {
		t.Fatalf("sent to WhatsApp:\ngot  %+v\nwant %+v", got, wantSent)
	}
	versions := e.changesOf(c.sent)
	if len(versions) != 2 || versions[0].Kind != "original" || versions[0].Body != anaPrefix+"\nSegue o boleto de setembro" ||
		versions[1].Kind != "edit" || versions[1].Origin != "agent" || versions[1].Body != want {
		t.Fatalf("versions = %+v", versions)
	}
	if got := e.actions(c.sent); len(got) != 1 || got[0].Status != "accepted" || str(got[0].EventID) != "fake-edit-"+requestE1 {
		t.Fatalf("actions = %+v", got)
	}
	if got := e.messageAudit(c.sent); !reflect.DeepEqual(got, []string{"message_edited"}) {
		t.Fatalf("audit = %v", got)
	}
	// Quem vê a conversa vê a versão atual.
	if m := e.apiMessage(c.ticket.ID, c.biaToken, "fake-msg-"+requestA); bodyOf(t, m) != want || m["editedAt"] == nil {
		t.Fatalf("message seen by another agent = %v", m)
	}

	// Nova edição: o apelido continua o do envio, mesmo depois de trocado.
	if _, err := e.Pool.Exec(t.Context(), "update users set nickname = 'Ana Nova' where id = $1", c.ana.ID); err != nil {
		t.Fatal(err)
	}
	if r := e.editMessage(c.sent, c.anaToken, requestE2, "Segue o boleto de novembro"); r.Status != http.StatusOK || r.Body["body"] != anaPrefix+"\nSegue o boleto de novembro" {
		t.Fatalf("second edit: status %d, body %v", r.Status, r.Body)
	}
	if versions := e.changesOf(c.sent); len(versions) != 3 || versions[2].Body != anaPrefix+"\nSegue o boleto de novembro" {
		t.Fatalf("versions after second edit = %+v", versions)
	}
	// Texto em branco não é edição.
	if r := e.editMessage(c.sent, c.anaToken, requestE3, "   "); r.Status != http.StatusUnprocessableEntity {
		t.Fatalf("blank edit: status %d", r.Status)
	}
}

// O prazo de 15 minutos conta do envio original e não recomeça a cada edição.
func TestEditWindowCountsFromTheOriginalSend(t *testing.T) {
	t.Parallel()
	c := newSentConversation(t)
	e := c.e

	e.backdate(c.sent, 14*time.Minute)
	if r := e.editMessage(c.sent, c.anaToken, requestE1, "Corrigido"); r.Status != http.StatusOK {
		t.Fatalf("edit within the window: status %d, body %v", r.Status, r.Body)
	}
	// A edição recente não abre um novo prazo: passou de 15 minutos do envio.
	e.backdate(c.sent, 15*time.Minute+time.Second)
	r := e.editMessage(c.sent, c.anaToken, requestE2, "Corrigido de novo")
	if r.Status != http.StatusConflict || r.Body["error"] != "O prazo para editar esta mensagem terminou." {
		t.Fatalf("edit after the window: status %d, body %v", r.Status, r.Body)
	}
	if got := e.sentChanges(); len(got) != 1 {
		t.Fatalf("an expired edit went to WhatsApp: %+v", got)
	}
	if got := e.actions(c.sent); len(got) != 1 {
		t.Fatalf("an expired edit was recorded: %+v", got)
	}
	if str(e.outbound(c.ticket.ID)[0].Body) != anaPrefix+"\nCorrigido" {
		t.Fatalf("message changed by an expired edit: %+v", e.outbound(c.ticket.ID)[0])
	}
}

// A legenda muda e o arquivo continua o mesmo; legenda vazia fica só com o apelido.
func TestCaptionEditKeepsTheFile(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e := c.e
	c.assign()
	png := append([]byte("\x89PNG\r\n\x1a\n"), make([]byte, 32)...)
	resp := e.sendFile(c.ticket.ID, c.anaToken, requestA, "foto.png", "image/png", png, "Comprovante")
	if resp.Status != http.StatusOK || resp.Body["status"] != "sent" {
		t.Fatalf("send image: status %d, body %v", resp.Status, resp.Body)
	}
	msgID := int64(resp.Body["id"].(float64))
	media := *e.outbound(c.ticket.ID)[0].MediaID

	if r := e.editMessage(msgID, c.anaToken, requestE1, "Comprovante de outubro"); r.Status != http.StatusOK || r.Body["body"] != anaPrefix+"\nComprovante de outubro" {
		t.Fatalf("caption edit: status %d, body %v", r.Status, r.Body)
	}
	if r := e.editMessage(msgID, c.anaToken, requestE2, ""); r.Status != http.StatusOK || r.Body["body"] != anaPrefix {
		t.Fatalf("empty caption: status %d, body %v", r.Status, r.Body)
	}
	got := e.outbound(c.ticket.ID)[0]
	if got.MediaID == nil || *got.MediaID != media || got.Type != "image" {
		t.Fatalf("file changed by the edit: %+v", got)
	}
	sent := e.sentChanges()
	if len(sent) != 2 || sent[0].(messaging.MessageEdit).Type != messaging.TypeImage || sent[1].(messaging.MessageEdit).Body != anaPrefix {
		t.Fatalf("caption edits sent = %+v", sent)
	}
}

// Só mensagem enviada pelo XET é alterada: não a do cliente, nem a do celular
// do setor; e áudio não tem edição, só exclusão.
func TestOnlyMessagesSentThroughTheSystemChange(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e := c.e
	c.assign()
	e.sendOutside(c.sector.ID, text("OUT-1", "5511988887777@s.whatsapp.net", "5511988887777", "Pelo celular"))
	voice := e.sendVoice(c.ticket.ID, c.anaToken, requestA, recordWebM(t, 1), "")
	if voice.Status != http.StatusOK || voice.Body["status"] != "sent" {
		t.Fatalf("send voice: status %d, body %v", voice.Status, voice.Body)
	}
	audio := int64(voice.Body["id"].(float64))

	for name, msg := range map[string]int64{
		"customer": e.messageID(c.ticket.ID, "MSG-1"),
		"phone":    e.messageID(c.ticket.ID, "OUT-1"),
	} {
		if r := e.editMessage(msg, c.anaToken, requestE1, "x"); r.Status != http.StatusConflict || r.Body["error"] != "Só é possível alterar mensagens enviadas pelo XET." {
			t.Fatalf("edit of the %s message: status %d, body %v", name, r.Status, r.Body)
		}
		for _, scope := range []string{"everyone", "local"} {
			if r := e.deleteMessage(msg, c.anaToken, requestE2, scope); r.Status != http.StatusConflict {
				t.Fatalf("delete %s of the %s message: status %d", scope, name, r.Status)
			}
		}
	}
	if r := e.editMessage(audio, c.anaToken, requestE3, "transcrição"); r.Status != http.StatusConflict ||
		r.Body["error"] != "Só é possível editar texto ou legenda. Áudio não tem edição." {
		t.Fatalf("edit of audio: status %d, body %v", r.Status, r.Body)
	}
	if r := e.deleteMessage(audio, c.anaToken, requestE4, "everyone"); r.Status != http.StatusOK || r.Body["deletion"] == nil {
		t.Fatalf("delete audio: status %d, body %v", r.Status, r.Body)
	}
	if got := e.sentChanges(); len(got) != 1 {
		t.Fatalf("changes sent = %+v", got)
	}
	// Corpo inválido é recusado antes de qualquer decisão.
	if r := e.deleteMessage(audio, c.anaToken, requestE5, "todos"); r.Status != http.StatusUnprocessableEntity {
		t.Fatalf("invalid scope: status %d", r.Status)
	}
	if r := e.Do(http.MethodPost, fmt.Sprintf("/api/messages/%d/edit", audio), c.anaToken, map[string]string{"clientRequestId": "x", "body": "y"}); r.Status != http.StatusUnprocessableEntity {
		t.Fatalf("invalid request id: status %d", r.Status)
	}
	if r := e.editMessage(999999, c.anaToken, requestE5, "x"); r.Status != http.StatusNotFound {
		t.Fatalf("unknown message: status %d", r.Status)
	}
}

// Só o responsável atual altera, inclusive mensagens de um responsável
// anterior; supervisor e administrador também precisam ser o responsável, e
// o chamado precisa estar aberto.
func TestOnlyTheCurrentAssigneeChangesMessages(t *testing.T) {
	t.Parallel()
	c := newSentConversation(t)
	e := c.e

	for name, tc := range map[string]struct {
		token  string
		status int
	}{
		"agent of the sector": {c.biaToken, http.StatusForbidden},
		"supervisor":          {c.supToken, http.StatusForbidden},
		"admin":               {c.adminToken, http.StatusForbidden},
		"other sector":        {c.rhToken, http.StatusForbidden},
	} {
		if r := e.editMessage(c.sent, tc.token, requestE1, "x"); r.Status != tc.status {
			t.Fatalf("edit by %s: status %d, body %v", name, r.Status, r.Body)
		}
		for _, scope := range []string{"everyone", "local"} {
			if r := e.deleteMessage(c.sent, tc.token, requestE1, scope); r.Status != tc.status {
				t.Fatalf("delete %s by %s: status %d", scope, name, r.Status)
			}
		}
	}

	// O supervisor recebe o chamado e edita a mensagem enviada pela Ana; ela não pode mais.
	if r := e.transfer(c.ticket.ID, e.userID("sup@exemplo.com"), c.anaToken); r.Status != http.StatusOK {
		t.Fatalf("transfer: status %d, body %v", r.Status, r.Body)
	}
	if r := e.editMessage(c.sent, c.anaToken, requestE1, "x"); r.Status != http.StatusForbidden {
		t.Fatalf("edit by the previous assignee: status %d", r.Status)
	}
	if r := e.editMessage(c.sent, c.supToken, requestE2, "Pelo supervisor"); r.Status != http.StatusOK || r.Body["body"] != anaPrefix+"\nPelo supervisor" {
		t.Fatalf("edit by the supervisor assignee: status %d, body %v", r.Status, r.Body)
	}
	// O administrador assume o chamado devolvido à fila e exclui.
	if r := e.Do(http.MethodPost, fmt.Sprintf("/api/tickets/%d/return", c.ticket.ID), c.supToken, nil); r.Status != http.StatusOK {
		t.Fatalf("return: status %d", r.Status)
	}
	if r := e.deleteMessage(c.sent, c.adminToken, requestE3, "local"); r.Status != http.StatusForbidden {
		t.Fatalf("delete of a queued ticket: status %d", r.Status)
	}
	if r := e.assign(c.ticket.ID, c.adminToken); r.Status != http.StatusOK {
		t.Fatalf("admin assign: status %d", r.Status)
	}
	if r := e.deleteMessage(c.sent, c.adminToken, requestE4, "everyone"); r.Status != http.StatusOK {
		t.Fatalf("delete by the admin assignee: status %d, body %v", r.Status, r.Body)
	}

	// Chamado encerrado não tem ação.
	c2 := newSentConversation(t)
	if r := c2.e.cancel(c2.ticket.ID, c2.anaToken, "Teste"); r.Status != http.StatusOK {
		t.Fatalf("cancel: status %d, body %v", r.Status, r.Body)
	}
	if r := c2.e.editMessage(c2.sent, c2.anaToken, requestE1, "x"); r.Status != http.StatusConflict || r.Body["error"] != "Este chamado já foi encerrado." {
		t.Fatalf("edit in a closed ticket: status %d, body %v", r.Status, r.Body)
	}
	if r := c2.e.deleteMessage(c2.sent, c2.anaToken, requestE2, "local"); r.Status != http.StatusConflict {
		t.Fatalf("delete in a closed ticket: status %d", r.Status)
	}
	if got := c2.e.actions(c2.sent); len(got) != 0 {
		t.Fatalf("actions in a closed ticket = %+v", got)
	}
}

// Mensagem enviando não aceita ação; com falha, só "para mim"; entregue e
// lida aceitam tudo; excluída não é editável nem reenviável, e a exclusão não
// muda a situação de entrega.
func TestDeliveryStateDecidesTheActions(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e := c.e
	c.assign()

	// Enviando: o envio espera o WhatsApp.
	e.WhatsApp.Hold(c.sector.ID)
	done := make(chan response, 1)
	go func() { done <- e.sendText(c.ticket.ID, c.anaToken, requestA, "Enviando") }()
	var pending int64
	for deadline := time.Now().Add(10 * time.Second); pending == 0 && time.Now().Before(deadline); {
		if out := e.outbound(c.ticket.ID); len(out) == 1 {
			pending = out[0].ID
		} else {
			time.Sleep(10 * time.Millisecond)
		}
	}
	for _, r := range []response{
		e.editMessage(pending, c.anaToken, requestE1, "x"),
		e.deleteMessage(pending, c.anaToken, requestE1, "everyone"),
		e.deleteMessage(pending, c.anaToken, requestE1, "local"),
	} {
		if r.Status != http.StatusConflict || r.Body["error"] != "A mensagem ainda está sendo enviada." {
			t.Fatalf("action on a pending message: status %d, body %v", r.Status, r.Body)
		}
	}
	e.WhatsApp.Release(c.sector.ID)
	<-done

	// Com falha: número desconectado.
	if err := e.WhatsApp.Drop(t.Context(), c.sector.ID); err != nil {
		t.Fatal(err)
	}
	failed := e.sendText(c.ticket.ID, c.anaToken, requestB, "Vai falhar")
	if failed.Body["status"] != "failed" {
		t.Fatalf("send while disconnected: %v", failed.Body)
	}
	failedID := int64(failed.Body["id"].(float64))
	e.connectSector(c.sector.ID)
	for _, r := range []response{
		e.editMessage(failedID, c.anaToken, requestE2, "x"),
		e.deleteMessage(failedID, c.anaToken, requestE2, "everyone"),
	} {
		if r.Status != http.StatusConflict || r.Body["error"] != "Mensagem com falha só pode ser excluída para mim." {
			t.Fatalf("action on a failed message: status %d, body %v", r.Status, r.Body)
		}
	}
	if r := e.deleteMessage(failedID, c.anaToken, requestE3, "local"); r.Status != http.StatusOK || r.Body["deletion"].(map[string]any)["scope"] != "local" {
		t.Fatalf("local deletion of a failed message: status %d, body %v", r.Status, r.Body)
	}
	if r := e.Do(http.MethodPost, fmt.Sprintf("/api/messages/%d/retry", failedID), c.anaToken, nil); r.Status != http.StatusConflict ||
		r.Body["error"] != "Esta mensagem foi excluída e não pode ser reenviada." {
		t.Fatalf("retry of a deleted message: status %d, body %v", r.Status, r.Body)
	}
	for _, r := range []response{
		e.editMessage(failedID, c.anaToken, requestE4, "x"),
		e.deleteMessage(failedID, c.anaToken, requestE4, "local"),
	} {
		if r.Status != http.StatusConflict || r.Body["error"] != "Esta mensagem já foi excluída." {
			t.Fatalf("action on a deleted message: status %d, body %v", r.Status, r.Body)
		}
	}

	// Entregue e lida: edição e exclusão para todos, sem mexer na entrega.
	sent := e.messageID(c.ticket.ID, "fake-msg-"+requestA)
	if err := e.WhatsApp.UpdateStatus(t.Context(), c.sector.ID, messaging.DeliveryDelivered, "fake-msg-"+requestA); err != nil {
		t.Fatal(err)
	}
	if r := e.editMessage(sent, c.anaToken, requestE5, "Entregue e editada"); r.Status != http.StatusOK {
		t.Fatalf("edit of a delivered message: status %d, body %v", r.Status, r.Body)
	}
	if err := e.WhatsApp.UpdateStatus(t.Context(), c.sector.ID, messaging.DeliveryRead, "fake-msg-"+requestA); err != nil {
		t.Fatal(err)
	}
	if r := e.deleteMessage(sent, c.anaToken, "0b5e7f10-3c1d-4a2e-9f30-1a2b3c4d5e06", "everyone"); r.Status != http.StatusOK {
		t.Fatalf("delete of a read message: status %d, body %v", r.Status, r.Body)
	}
	for _, m := range e.outbound(c.ticket.ID) {
		if m.ID == sent && str(m.Status) != "read" {
			t.Fatalf("delivery status after deletion = %s", str(m.Status))
		}
		if m.ID == failedID && str(m.Status) != "failed" {
			t.Fatalf("failed status after local deletion = %s", str(m.Status))
		}
	}
}

// Excluir para todos vai ao WhatsApp dentro do prazo dele e guarda conteúdo e
// arquivo; passado o prazo, ou sem a ação no provedor, resta só "para mim".
func TestDeleteForEveryoneFollowsTheProvider(t *testing.T) {
	t.Parallel()
	c := newSentConversation(t)
	e := c.e

	e.backdate(c.sent, 47*time.Hour)
	r := e.deleteMessage(c.sent, c.anaToken, requestE1, "everyone")
	if r.Status != http.StatusOK {
		t.Fatalf("delete for everyone: status %d, body %v", r.Status, r.Body)
	}
	if d := r.Body["deletion"].(map[string]any); d["scope"] != "everyone" || d["origin"] != "agent" || r.Body["body"] != anaPrefix+"\nSegue o boleto de setembro" {
		t.Fatalf("deletion = %v", r.Body)
	}
	want := []any{messaging.MessageRevoke{
		SectorID: c.sector.ID, To: "5511988887777@s.whatsapp.net", TargetExternalMessageID: "fake-msg-" + requestA, IdempotencyKey: requestE1,
	}}
	if got := e.sentChanges(); !reflect.DeepEqual(got, want) {
		t.Fatalf("sent:\ngot  %+v\nwant %+v", got, want)
	}
	if v := e.changesOf(c.sent); len(v) != 1 || v[0].Kind != "deletion" || v[0].Origin != "agent" {
		t.Fatalf("changes = %+v", v)
	}
	if got := e.messageAudit(c.sent); !reflect.DeepEqual(got, []string{"message_deleted"}) {
		t.Fatalf("audit = %v", got)
	}

	// Depois do prazo do provedor, só "para mim".
	c2 := newSentConversation(t)
	c2.e.backdate(c2.sent, 48*time.Hour+time.Second)
	if r := c2.e.deleteMessage(c2.sent, c2.anaToken, requestE1, "everyone"); r.Status != http.StatusConflict ||
		r.Body["error"] != "O prazo para excluir para todos terminou. Ainda é possível excluir para mim." {
		t.Fatalf("delete after the window: status %d, body %v", r.Status, r.Body)
	}
	if r := c2.e.deleteMessage(c2.sent, c2.anaToken, requestE2, "local"); r.Status != http.StatusOK {
		t.Fatalf("local delete after the window: status %d, body %v", r.Status, r.Body)
	}

	// Provedor sem a ação: indisponível, sem chamar o provedor nem simular sucesso.
	c3 := newSentConversation(t)
	c3.e.WhatsApp.SetCapabilities(messaging.Capabilities{ReceivesChanges: true})
	if r := c3.e.deleteMessage(c3.sent, c3.anaToken, requestE1, "everyone"); r.Status != http.StatusConflict ||
		r.Body["error"] != "O WhatsApp deste setor não permite excluir para todos. Ainda é possível excluir para mim." {
		t.Fatalf("delete without the capability: status %d, body %v", r.Status, r.Body)
	}
	if r := c3.e.editMessage(c3.sent, c3.anaToken, requestE2, "x"); r.Status != http.StatusConflict ||
		r.Body["error"] != "O WhatsApp deste setor não permite editar mensagens." {
		t.Fatalf("edit without the capability: status %d, body %v", r.Status, r.Body)
	}
	if got := c3.e.sentChanges(); len(got) != 0 {
		t.Fatalf("unsupported changes went to the provider: %+v", got)
	}
	if got := c3.e.actions(c3.sent); len(got) != 0 {
		t.Fatalf("unsupported changes recorded: %+v", got)
	}
}

// "Para mim" não chama o WhatsApp, vale para todo o setor e esconde o conteúdo
// da prévia da lista; o conteúdo continua guardado.
func TestLocalDeletionHidesForTheSectorWithoutTheProvider(t *testing.T) {
	t.Parallel()
	c := newSentConversation(t)
	e := c.e

	r := e.deleteMessage(c.sent, c.anaToken, requestE1, "local")
	if r.Status != http.StatusOK || r.Body["deletion"].(map[string]any)["scope"] != "local" {
		t.Fatalf("local delete: status %d, body %v", r.Status, r.Body)
	}
	if got := e.sentChanges(); len(got) != 0 {
		t.Fatalf("local deletion went to WhatsApp: %+v", got)
	}
	if got := e.actions(c.sent); len(got) != 1 || got[0].Kind != "delete_local" || got[0].Status != "accepted" {
		t.Fatalf("actions = %+v", got)
	}
	if got := e.messageAudit(c.sent); !reflect.DeepEqual(got, []string{"message_deleted"}) {
		t.Fatalf("audit = %v", got)
	}
	// Outro atendente do setor vê a exclusão; o conteúdo segue gravado para o histórico.
	m := e.apiMessage(c.ticket.ID, c.biaToken, "fake-msg-"+requestA)
	if deletionOf(t, m)["scope"] != "local" || bodyOf(t, m) != anaPrefix+"\nSegue o boleto de setembro" {
		t.Fatalf("message seen by the sector = %v", m)
	}
	// A prévia da lista de chamados não mostra o conteúdo escondido.
	list := e.DoList(http.MethodGet, fmt.Sprintf("/api/sectors/%d/tickets", c.sector.ID), c.biaToken)
	if len(list) != 1 {
		t.Fatalf("tickets = %v", list)
	}
	last := list[0]["lastMessage"].(map[string]any)
	if last["hidden"] != true || last["body"] != nil {
		t.Fatalf("last message of the list = %v", last)
	}
	// Repetir a mesma exclusão devolve o mesmo resultado, sem nova ação.
	if r := e.deleteMessage(c.sent, c.anaToken, requestE1, "local"); r.Status != http.StatusOK {
		t.Fatalf("repeated local delete: status %d", r.Status)
	}
	if got := e.actions(c.sent); len(got) != 1 {
		t.Fatalf("actions after repeat = %+v", got)
	}
}

// Recusa e resultado incerto do provedor nunca viram sucesso: a mensagem fica
// como estava e a resposta explica. O eco do provedor é a prova de um
// resultado incerto.
func TestRefusalAndUnknownResultAreNotSuccesses(t *testing.T) {
	t.Parallel()
	c := newSentConversation(t)
	e := c.e
	original := anaPrefix + "\nSegue o boleto de setembro"

	e.WhatsApp.FailNextChange(c.sector.ID, messaging.ErrNotAccepted)
	r := e.editMessage(c.sent, c.anaToken, requestE1, "Recusada")
	if r.Status != http.StatusBadGateway || r.Body["error"] != "O WhatsApp não aceitou a alteração. Tente novamente." {
		t.Fatalf("refused edit: status %d, body %v", r.Status, r.Body)
	}
	e.WhatsApp.FailNextChange(c.sector.ID, messaging.ErrNotAccepted)
	if r := e.deleteMessage(c.sent, c.anaToken, requestE2, "everyone"); r.Status != http.StatusBadGateway {
		t.Fatalf("refused deletion: status %d, body %v", r.Status, r.Body)
	}
	if err := e.WhatsApp.Drop(t.Context(), c.sector.ID); err != nil {
		t.Fatal(err)
	}
	if r := e.editMessage(c.sent, c.anaToken, requestE3, "Desconectado"); r.Status != http.StatusBadGateway ||
		r.Body["error"] != "Número do setor desconectado. A mensagem não foi alterada." {
		t.Fatalf("edit while disconnected: status %d, body %v", r.Status, r.Body)
	}
	e.connectSector(c.sector.ID)
	m := e.apiMessage(c.ticket.ID, c.anaToken, "fake-msg-"+requestA)
	if bodyOf(t, m) != original || m["editedAt"] != nil || m["deletion"] != nil || len(e.changesOf(c.sent)) != 0 {
		t.Fatalf("message after refusals = %v, changes %+v", m, e.changesOf(c.sent))
	}
	// A repetição da recusa devolve a mesma recusa, sem tentar de novo.
	if r := e.editMessage(c.sent, c.anaToken, requestE1, "Recusada"); r.Status != http.StatusBadGateway {
		t.Fatalf("repeated refused edit: status %d", r.Status)
	}

	// Resultado incerto (tempo esgotado): nada aplicado.
	e.WhatsApp.FailNextChange(c.sector.ID, context.DeadlineExceeded)
	r = e.editMessage(c.sent, c.anaToken, requestE4, "Incerta")
	if r.Status != http.StatusBadGateway || r.Body["error"] != "Não foi possível confirmar a alteração com o WhatsApp. Confira a conversa antes de tentar de novo." {
		t.Fatalf("uncertain edit: status %d, body %v", r.Status, r.Body)
	}
	if bodyOf(t, e.apiMessage(c.ticket.ID, c.anaToken, "fake-msg-"+requestA)) != original {
		t.Fatal("uncertain edit applied")
	}
	statuses := []string{}
	for _, a := range e.actions(c.sent) {
		statuses = append(statuses, a.Kind+":"+a.Status)
	}
	if !reflect.DeepEqual(statuses, []string{"edit:refused", "delete_everyone:refused", "edit:refused", "edit:uncertain"}) {
		t.Fatalf("actions = %v", statuses)
	}
	// O eco da edição incerta chega: é a prova, e a versão é a do atendente.
	e.editFromPhone(c.sector.ID, "ECHO-1", "fake-msg-"+requestA, anaPrefix+"\nIncerta", time.Now())
	if bodyOf(t, e.apiMessage(c.ticket.ID, c.anaToken, "fake-msg-"+requestA)) != anaPrefix+"\nIncerta" {
		t.Fatal("echo did not settle the uncertain edit")
	}
	v := e.changesOf(c.sent)
	if len(v) != 2 || v[1].Kind != "edit" || v[1].Origin != "agent" {
		t.Fatalf("versions after echo = %+v", v)
	}
	if r := e.editMessage(c.sent, c.anaToken, requestE4, "Incerta"); r.Status != http.StatusOK {
		t.Fatalf("repeated uncertain edit after echo: status %d, body %v", r.Status, r.Body)
	}
}

// Clique duplo, requisições repetidas ao mesmo tempo e o eco do WhatsApp não
// repetem a alteração; outra alteração da mesma mensagem espera a que está em
// andamento.
func TestRepeatedAndConcurrentChangesDoNotDuplicate(t *testing.T) {
	t.Parallel()
	c := newSentConversation(t)
	e := c.e

	var wg sync.WaitGroup
	results := make([]response, 5)
	for i := range results {
		wg.Go(func() { results[i] = e.editMessage(c.sent, c.anaToken, requestE1, "Uma vez só") })
	}
	wg.Wait()
	for _, r := range results {
		// Quem chega enquanto a primeira espera o WhatsApp é avisado; as demais veem o resultado.
		if r.Status != http.StatusOK && r.Status != http.StatusConflict {
			t.Fatalf("concurrent repeated edit: status %d, body %v", r.Status, r.Body)
		}
	}
	if got := e.sentChanges(); len(got) != 1 {
		t.Fatalf("edits sent = %+v", got)
	}
	if v := e.changesOf(c.sent); len(v) != 2 {
		t.Fatalf("versions = %+v", v)
	}
	// O eco da edição feita pelo XET não vira outra versão.
	e.editFromPhone(c.sector.ID, "fake-edit-"+requestE1, "fake-msg-"+requestA, anaPrefix+"\nUma vez só", time.Now())
	if v := e.changesOf(c.sent); len(v) != 2 {
		t.Fatalf("versions after echo = %+v", v)
	}
	// A mesma chave em outra ação ou outra mensagem é recusada.
	if r := e.deleteMessage(c.sent, c.anaToken, requestE1, "local"); r.Status != http.StatusConflict {
		t.Fatalf("request id reused for another action: status %d", r.Status)
	}

	// Com a primeira esperando o WhatsApp, a segunda confirmação é recusada.
	e.WhatsApp.Hold(c.sector.ID)
	first := make(chan response, 1)
	go func() { first <- e.editMessage(c.sent, c.anaToken, requestE2, "Primeira") }()
	e.waitAction(c.sent, "pending")
	for _, r := range []response{
		e.editMessage(c.sent, c.anaToken, requestE3, "Segunda"),
		e.deleteMessage(c.sent, c.anaToken, requestE3, "everyone"),
		e.editMessage(c.sent, c.anaToken, requestE2, "Primeira"),
	} {
		if r.Status != http.StatusConflict || r.Body["error"] != "Esta mensagem já tem uma alteração em andamento. Aguarde a resposta do WhatsApp." {
			t.Fatalf("change while one is in flight: status %d, body %v", r.Status, r.Body)
		}
	}
	e.WhatsApp.Release(c.sector.ID)
	if r := <-first; r.Status != http.StatusOK || r.Body["body"] != anaPrefix+"\nPrimeira" {
		t.Fatalf("first edit: status %d, body %v", r.Status, r.Body)
	}
	if got := e.sentChanges(); len(got) != 2 {
		t.Fatalf("edits sent = %+v", got)
	}
}

// O eco do WhatsApp chega antes da resposta: a alteração fica do atendente,
// uma vez só, e a resposta que chega depois não a repete.
func TestEchoBeforeTheAnswerSettlesTheChangeOnce(t *testing.T) {
	t.Parallel()
	c := newSentConversation(t)
	e := c.e

	e.WhatsApp.Hold(c.sector.ID)
	done := make(chan response, 1)
	go func() { done <- e.deleteMessage(c.sent, c.anaToken, requestE1, "everyone") }()
	e.waitAction(c.sent, "pending")
	e.revoke(c.sector.ID, "fake-revoke-"+requestE1, "fake-msg-"+requestA, true, time.Now())
	if got := e.actions(c.sent); len(got) != 1 || got[0].Status != "accepted" {
		t.Fatalf("actions after echo = %+v", got)
	}
	e.WhatsApp.Release(c.sector.ID)
	r := <-done
	if r.Status != http.StatusOK || r.Body["deletion"].(map[string]any)["origin"] != "agent" {
		t.Fatalf("delete: status %d, body %v", r.Status, r.Body)
	}
	if v := e.changesOf(c.sent); len(v) != 1 || v[0].Origin != "agent" {
		t.Fatalf("changes = %+v", v)
	}
	if got := e.messageAudit(c.sent); len(got) != 1 {
		t.Fatalf("audit = %v", got)
	}
}

// O serviço reinicia com uma alteração esperando o WhatsApp: ela fica incerta,
// sem sucesso nem falha, e a resposta perdida não a aplica.
func TestRestartLeavesChangesInFlightUncertain(t *testing.T) {
	t.Parallel()
	c := newSentConversation(t)
	e := c.e

	e.WhatsApp.Hold(c.sector.ID)
	done := make(chan response, 1)
	go func() { done <- e.editMessage(c.sent, c.anaToken, requestE1, "Antes do reinício") }()
	e.waitAction(c.sent, "pending")

	restarted := startServer(t, e.Pool, nil)
	if n, err := restarted.TicketService.UncertainPending(t.Context()); err != nil || n != 1 {
		t.Fatalf("uncertain pending: %d, %v", n, err)
	}
	e.WhatsApp.Release(c.sector.ID)
	<-done
	got := e.actions(c.sent)
	if len(got) != 1 || got[0].Status != "uncertain" || str(got[0].Reason) != "O serviço foi reiniciado durante a alteração. Confira a conversa antes de tentar de novo." {
		t.Fatalf("actions after restart = %+v", got)
	}
	if str(e.outbound(c.ticket.ID)[0].Body) != anaPrefix+"\nSegue o boleto de setembro" || len(e.changesOf(c.sent)) != 0 {
		t.Fatal("change applied without the answer of the provider")
	}
	token := restarted.Login("ana@exemplo.com", testPassword)
	if r := restarted.editMessage(c.sent, token, requestE1, "Antes do reinício"); r.Status != http.StatusBadGateway {
		t.Fatalf("repeated request after restart: status %d, body %v", r.Status, r.Body)
	}
}

// Encerrar ou transferir o chamado ao mesmo tempo que a alteração: ou a
// alteração entra antes, com o chamado ainda do responsável, ou é recusada sem
// ir ao WhatsApp.
func TestChangeRacesWithClosingAndTransfer(t *testing.T) {
	t.Parallel()
	for _, race := range []string{"cancel", "transfer"} {
		for i := range 4 {
			t.Run(fmt.Sprintf("%s-%d", race, i), func(t *testing.T) {
				t.Parallel()
				c := newSentConversation(t)
				e := c.e
				var wg sync.WaitGroup
				var change, other response
				wg.Go(func() { change = e.editMessage(c.sent, c.anaToken, requestE1, "Na corrida") })
				wg.Go(func() {
					if race == "cancel" {
						other = e.cancel(c.ticket.ID, c.anaToken, "Corrida")
					} else {
						other = e.transfer(c.ticket.ID, e.userID("bia@exemplo.com"), c.anaToken)
					}
				})
				wg.Wait()
				if other.Status != http.StatusOK {
					t.Fatalf("%s: status %d, body %v", race, other.Status, other.Body)
				}
				switch change.Status {
				case http.StatusOK:
					if len(e.sentChanges()) != 1 || len(e.changesOf(c.sent)) != 2 {
						t.Fatalf("applied edit not recorded: sent %+v", e.sentChanges())
					}
				case http.StatusConflict, http.StatusForbidden:
					if len(e.sentChanges()) != 0 || len(e.actions(c.sent)) != 0 {
						t.Fatalf("refused edit went on: sent %+v, actions %+v", e.sentChanges(), e.actions(c.sent))
					}
				default:
					t.Fatalf("edit: status %d, body %v", change.Status, change.Body)
				}
			})
		}
	}
}

// Uma edição fica incerta, a seguinte é aceita, e só então chega o eco da
// primeira: ela entra no histórico na ordem em que foi pedida, sem desfazer a
// versão mais nova.
func TestLateEchoDoesNotUndoANewerEdit(t *testing.T) {
	t.Parallel()
	c := newSentConversation(t)
	e := c.e

	e.WhatsApp.FailNextChange(c.sector.ID, context.DeadlineExceeded)
	if r := e.editMessage(c.sent, c.anaToken, requestE1, "Versão A"); r.Status != http.StatusBadGateway {
		t.Fatalf("uncertain edit: status %d, body %v", r.Status, r.Body)
	}
	if r := e.editMessage(c.sent, c.anaToken, requestE2, "Versão B"); r.Status != http.StatusOK {
		t.Fatalf("second edit: status %d, body %v", r.Status, r.Body)
	}
	e.editFromPhone(c.sector.ID, "ECHO-A", "fake-msg-"+requestA, anaPrefix+"\nVersão A", time.Now().Add(time.Second))

	if got := bodyOf(t, e.apiMessage(c.ticket.ID, c.anaToken, "fake-msg-"+requestA)); got != anaPrefix+"\nVersão B" {
		t.Fatalf("current version after the late echo = %q", got)
	}
	got := []string{}
	for _, a := range e.actions(c.sent) {
		got = append(got, a.Status)
	}
	if !reflect.DeepEqual(got, []string{"accepted", "accepted"}) {
		t.Fatalf("actions = %v", got)
	}
	v := e.changesOf(c.sent)
	if len(v) != 3 || v[1].Kind != "edit" || v[2].Kind != "edit" || !v[1].At.Before(v[2].At) {
		t.Fatalf("versions = %+v", v)
	}
}

// Uma edição nova pedida enquanto a anterior ainda grava a resposta do WhatsApp
// espera a trava do chamado: ela vem depois da anterior, e o eco dela, quando
// o resultado é incerto, a deixa como versão atual.
func TestEditWaitingForThePreviousOneComesAfterIt(t *testing.T) {
	t.Parallel()
	c := newSentConversation(t)
	e := c.e

	e.WhatsApp.Hold(c.sector.ID)
	first := make(chan response, 1)
	go func() { first <- e.editMessage(c.sent, c.anaToken, requestE1, "Versão B") }()
	e.waitAction(c.sent, "pending")

	// O teste segura o chamado: a resposta da edição B espera por ele, e a
	// edição C, que começa depois, espera atrás dela.
	tx, err := e.Pool.Begin(t.Context())
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = tx.Rollback(t.Context()) }()
	if _, err := tx.Exec(t.Context(), "select id from tickets where id = $1 for update", c.ticket.ID); err != nil {
		t.Fatal(err)
	}
	e.WhatsApp.Release(c.sector.ID)
	e.waitTicketLockWaiters(1)
	e.WhatsApp.FailNextChange(c.sector.ID, context.DeadlineExceeded)
	second := make(chan response, 1)
	go func() { second <- e.editMessage(c.sent, c.anaToken, requestE2, "Versão C") }()
	e.waitTicketLockWaiters(2)
	time.Sleep(50 * time.Millisecond)
	if err := tx.Commit(t.Context()); err != nil {
		t.Fatal(err)
	}

	if r := <-first; r.Status != http.StatusOK {
		t.Fatalf("edit B: status %d, body %v", r.Status, r.Body)
	}
	if r := <-second; r.Status != http.StatusBadGateway {
		t.Fatalf("edit C: status %d, body %v", r.Status, r.Body)
	}
	e.editFromPhone(c.sector.ID, "ECHO-C", "fake-msg-"+requestA, anaPrefix+"\nVersão C", time.Now().Add(time.Second))

	if got := bodyOf(t, e.apiMessage(c.ticket.ID, c.anaToken, "fake-msg-"+requestA)); got != anaPrefix+"\nVersão C" {
		t.Fatalf("current version after the echo of C = %q", got)
	}
	got := []string{}
	for _, a := range e.actions(c.sent) {
		got = append(got, a.Status)
	}
	if !reflect.DeepEqual(got, []string{"accepted", "accepted"}) {
		t.Fatalf("actions = %v", got)
	}
}

// Uma exclusão para todos incerta, depois "excluir para mim": quando o eco do
// WhatsApp confirma a exclusão para todos, o alcance passa a "para todos",
// porque o contato também não vê mais a mensagem.
func TestLateRevokeEchoWidensALocalDeletion(t *testing.T) {
	t.Parallel()
	c := newSentConversation(t)
	e := c.e

	e.WhatsApp.FailNextChange(c.sector.ID, context.DeadlineExceeded)
	if r := e.deleteMessage(c.sent, c.anaToken, requestE1, "everyone"); r.Status != http.StatusBadGateway {
		t.Fatalf("uncertain revoke: status %d, body %v", r.Status, r.Body)
	}
	if r := e.deleteMessage(c.sent, c.anaToken, requestE2, "local"); r.Status != http.StatusOK {
		t.Fatalf("local deletion: status %d, body %v", r.Status, r.Body)
	}
	e.revoke(c.sector.ID, "ECHO-REVOKE", "fake-msg-"+requestA, true, time.Now().Add(time.Second))

	if d := deletionOf(t, e.apiMessage(c.ticket.ID, c.anaToken, "fake-msg-"+requestA)); d["scope"] != "everyone" {
		t.Fatalf("deletion after the late echo = %v", d)
	}
	got := []string{}
	for _, a := range e.actions(c.sent) {
		got = append(got, a.Kind+":"+a.Status)
	}
	if !reflect.DeepEqual(got, []string{"delete_everyone:accepted", "delete_local:accepted"}) {
		t.Fatalf("actions = %v", got)
	}
	// O eco só confirma o que já foi pedido: uma segunda entrega não muda nada.
	e.revoke(c.sector.ID, "ECHO-REVOKE", "fake-msg-"+requestA, true, time.Now().Add(2*time.Second))
	if v := e.changesOf(c.sent); len(v) != 2 {
		t.Fatalf("changes = %+v", v)
	}
}

// Com uma edição ou exclusão para todos esperando o WhatsApp, a exclusão "para
// mim" também espera: a mensagem nunca fica excluída e editada ao mesmo tempo.
func TestLocalDeletionWaitsForTheChangeInFlight(t *testing.T) {
	t.Parallel()
	c := newSentConversation(t)
	e := c.e

	e.WhatsApp.Hold(c.sector.ID)
	edit := make(chan response, 1)
	go func() { edit <- e.editMessage(c.sent, c.anaToken, requestE1, "Editada") }()
	e.waitAction(c.sent, "pending")
	if r := e.deleteMessage(c.sent, c.anaToken, requestE2, "local"); r.Status != http.StatusConflict ||
		r.Body["error"] != "Esta mensagem já tem uma alteração em andamento. Aguarde a resposta do WhatsApp." {
		t.Fatalf("local deletion during an edit: status %d, body %v", r.Status, r.Body)
	}
	e.WhatsApp.Release(c.sector.ID)
	if r := <-edit; r.Status != http.StatusOK || r.Body["deletion"] != nil {
		t.Fatalf("edit: status %d, body %v", r.Status, r.Body)
	}

	e.WhatsApp.Hold(c.sector.ID)
	revoke := make(chan response, 1)
	go func() { revoke <- e.deleteMessage(c.sent, c.anaToken, requestE3, "everyone") }()
	e.waitAction(c.sent, "pending")
	if r := e.deleteMessage(c.sent, c.anaToken, requestE4, "local"); r.Status != http.StatusConflict {
		t.Fatalf("local deletion during a revoke: status %d, body %v", r.Status, r.Body)
	}
	e.WhatsApp.Release(c.sector.ID)
	r := <-revoke
	if r.Status != http.StatusOK || r.Body["deletion"].(map[string]any)["scope"] != "everyone" {
		t.Fatalf("revoke: status %d, body %v", r.Status, r.Body)
	}
	got := []string{}
	for _, a := range e.actions(c.sent) {
		got = append(got, a.Kind+":"+a.Status)
	}
	if !reflect.DeepEqual(got, []string{"edit:accepted", "delete_everyone:accepted"}) {
		t.Fatalf("actions = %v", got)
	}
}

// O WhatsApp não responde a tempo: a alteração fica incerta, gravada, e não
// prende a mensagem.
func TestTimeoutLeavesTheChangeUncertain(t *testing.T) {
	t.Parallel()
	c := newSentConversation(t)
	e := c.e
	helpdesk.SetChangeTimeout(e.TicketService, 200*time.Millisecond)

	e.WhatsApp.Hold(c.sector.ID)
	r := e.editMessage(c.sent, c.anaToken, requestE1, "Sem resposta")
	e.WhatsApp.Release(c.sector.ID)
	if r.Status != http.StatusBadGateway || r.Body["error"] != "Não foi possível confirmar a alteração com o WhatsApp. Confira a conversa antes de tentar de novo." {
		t.Fatalf("timed out edit: status %d, body %v", r.Status, r.Body)
	}
	if got := e.actions(c.sent); len(got) != 1 || got[0].Status != "uncertain" {
		t.Fatalf("actions = %+v", got)
	}
	if bodyOf(t, e.apiMessage(c.ticket.ID, c.anaToken, "fake-msg-"+requestA)) != anaPrefix+"\nSegue o boleto de setembro" {
		t.Fatal("timed out edit applied")
	}
	if r := e.editMessage(c.sent, c.anaToken, requestE2, "Depois"); r.Status != http.StatusOK {
		t.Fatalf("edit after the timeout: status %d, body %v", r.Status, r.Body)
	}
}

// Quem saiu do setor não lê a mensagem repetindo um pedido antigo.
func TestRepeatedRequestChecksTheSectorAgain(t *testing.T) {
	t.Parallel()
	c := newSentConversation(t)
	e := c.e

	if r := e.editMessage(c.sent, c.anaToken, requestE1, "Antes da mudança"); r.Status != http.StatusOK {
		t.Fatalf("edit: status %d, body %v", r.Status, r.Body)
	}
	if r := e.transfer(c.ticket.ID, e.userID("bia@exemplo.com"), c.anaToken); r.Status != http.StatusOK {
		t.Fatalf("transfer: status %d, body %v", r.Status, r.Body)
	}
	other := e.Sector("Fiscal")
	if r := e.Do(http.MethodPut, fmt.Sprintf("/api/users/%d", c.ana.ID), c.adminToken, map[string]any{
		"name": "ana@exemplo.com", "nickname": "ana@exemplo.com", "email": "ana@exemplo.com",
		"role": "agent", "sectorId": other.ID, "active": true,
	}); r.Status != http.StatusOK {
		t.Fatalf("move to another sector: status %d, body %v", r.Status, r.Body)
	}
	token := e.Login("ana@exemplo.com", testPassword)
	if r := e.editMessage(c.sent, token, requestE1, "Antes da mudança"); r.Status != http.StatusForbidden || r.Body["body"] != nil {
		t.Fatalf("repeated request from another sector: status %d, body %v", r.Status, r.Body)
	}
}
