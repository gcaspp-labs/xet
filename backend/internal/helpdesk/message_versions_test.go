package helpdesk_test

import (
	"fmt"
	"net/http"
	"testing"
	"time"
)

// changesAPI reads the versions and the deletion of a message as the history
// shows them.
func (e *testEnv) changesAPI(messageID int64, token string) []map[string]any {
	e.T.Helper()
	return e.DoList(http.MethodGet, fmt.Sprintf("/api/messages/%d/changes", messageID), token)
}

func (e *testEnv) changesStatus(messageID int64, token string) int {
	e.T.Helper()
	return e.Do(http.MethodGet, fmt.Sprintf("/api/messages/%d/changes", messageID), token, nil).Status
}

// A mensagem editada pelo XET, depois pelo celular, e por fim excluída: o histórico devolve a
// original, cada versão e a exclusão, na ordem em que aconteceram, com origem, autor e alcance.
func TestMessageChangesListEveryVersionAndTheDeletionInOrder(t *testing.T) {
	t.Parallel()
	c := newSentConversation(t)
	e := c.e
	external := "fake-msg-" + requestA

	if r := e.editMessage(c.sent, c.anaToken, requestE1, "Segue o boleto de outubro"); r.Status != http.StatusOK {
		t.Fatalf("edit: status %d, body %v", r.Status, r.Body)
	}
	phoneAt := time.Now().Truncate(time.Microsecond)
	e.editFromPhone(c.sector.ID, "EV-PHONE", external, anaPrefix+"\nSegue o boleto de novembro", phoneAt)
	if r := e.deleteMessage(c.sent, c.anaToken, requestE2, "everyone"); r.Status != http.StatusOK {
		t.Fatalf("delete: status %d, body %v", r.Status, r.Body)
	}

	// Quem é do setor, responsável ou não, vê o mesmo histórico.
	for name, token := range map[string]string{"assignee": c.anaToken, "colleague": c.biaToken, "supervisor": c.supToken, "admin": c.adminToken} {
		got := e.changesAPI(c.sent, token)
		if len(got) != 4 {
			t.Fatalf("%s: changes = %v", name, got)
		}
		for i, want := range []struct {
			kind, origin, body string
			author             bool
		}{
			{"original", "agent", anaPrefix + "\nSegue o boleto de setembro", true},
			{"edit", "agent", anaPrefix + "\nSegue o boleto de outubro", true},
			{"edit", "phone", anaPrefix + "\nSegue o boleto de novembro", false},
			{"deletion", "agent", "", true},
		} {
			c := got[i]
			if c["kind"] != want.kind || c["origin"] != want.origin || (c["author"] != nil) != want.author {
				t.Fatalf("%s: change %d = %v, want %+v", name, i, c, want)
			}
			if want.body != "" && c["body"] != want.body {
				t.Fatalf("%s: change %d body = %v, want %q", name, i, c["body"], want.body)
			}
			if want.kind == "deletion" && (c["scope"] != "everyone" || c["body"] != nil) {
				t.Fatalf("%s: deletion = %v", name, c)
			}
			if want.kind != "deletion" && c["scope"] != nil {
				t.Fatalf("%s: version with a scope = %v", name, c)
			}
		}
		if got[0]["author"].(map[string]any)["name"] != "ana@exemplo.com" {
			t.Fatalf("%s: author of the original = %v", name, got[0]["author"])
		}
	}
}

// Sem alteração, nada é inventado: a lista é vazia. A exclusão de uma mensagem nunca editada traz só
// a exclusão, sem versão original.
func TestMessageChangesDoNotInventVersions(t *testing.T) {
	t.Parallel()
	c := newSentConversation(t)
	e := c.e

	if got := e.changesAPI(c.sent, c.anaToken); len(got) != 0 {
		t.Fatalf("changes of an untouched message = %v", got)
	}
	if r := e.deleteMessage(c.sent, c.anaToken, requestE1, "local"); r.Status != http.StatusOK {
		t.Fatalf("delete: status %d", r.Status)
	}
	got := e.changesAPI(c.sent, c.biaToken)
	if len(got) != 1 || got[0]["kind"] != "deletion" || got[0]["scope"] != "local" || got[0]["origin"] != "agent" {
		t.Fatalf("changes of a message only deleted = %v", got)
	}
}

// O histórico segue o acesso ao chamado: outro setor, quem não entrou e mensagem inexistente não
// leem nada; com o chamado encerrado, o setor continua lendo.
func TestMessageChangesFollowTheAccessToTheTicket(t *testing.T) {
	t.Parallel()
	c := newSentConversation(t)
	e := c.e
	if r := e.editMessage(c.sent, c.anaToken, requestE1, "Segue o boleto de outubro"); r.Status != http.StatusOK {
		t.Fatalf("edit: status %d", r.Status)
	}

	if s := e.changesStatus(c.sent, c.rhToken); s != http.StatusForbidden {
		t.Fatalf("other sector: status %d", s)
	}
	if s := e.changesStatus(c.sent, ""); s != http.StatusUnauthorized {
		t.Fatalf("without login: status %d", s)
	}
	if s := e.changesStatus(c.sent+1000, c.anaToken); s != http.StatusNotFound {
		t.Fatalf("unknown message: status %d", s)
	}
	if s := e.Do(http.MethodGet, "/api/messages/abc/changes", c.anaToken, nil).Status; s != http.StatusNotFound {
		t.Fatalf("invalid id: status %d", s)
	}

	if r := e.cancel(c.ticket.ID, c.anaToken, "Teste"); r.Status != http.StatusOK {
		t.Fatalf("cancel: status %d, body %v", r.Status, r.Body)
	}
	if got := e.changesAPI(c.sent, c.biaToken); len(got) != 2 {
		t.Fatalf("changes after closing = %v", got)
	}
	if s := e.changesStatus(c.sent, c.rhToken); s != http.StatusForbidden {
		t.Fatalf("other sector after closing: status %d", s)
	}
	// Só leitura: a rota não aceita alterar.
	if s := e.Do(http.MethodPost, fmt.Sprintf("/api/messages/%d/changes", c.sent), c.anaToken, nil).Status; s != http.StatusMethodNotAllowed {
		t.Fatalf("POST on the history: status %d", s)
	}
}
