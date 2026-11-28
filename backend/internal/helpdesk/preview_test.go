package helpdesk_test

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"testing"

	"github.com/gcaspp-labs/xet/backend/internal/helpdesk/messaging"
)

// linkThumbnail is a JPEG as the provider delivers it: the bytes are kept as
// they came (spec #511).
var linkThumbnail = []byte{0xFF, 0xD8, 0xFF, 0xE0, 'j', 'p', 'e', 'g', 0xFF, 0xD9}

// linkMessage is a text received from a contact with the card of a link.
func linkMessage(id, phone, body string, preview *messaging.Preview) messaging.Message {
	return messaging.Message{
		ExternalMessageID: id,
		ExternalContactID: phone + "@s.whatsapp.net",
		Phone:             phone,
		Type:              messaging.TypeText,
		Body:              body,
		Preview:           preview,
	}
}

// previewTicket is the ticket of the message with the provider ID.
func previewTicket(t *testing.T, e *testEnv, externalID string) int64 {
	t.Helper()
	var id int64
	if err := e.Pool.QueryRow(e.T.Context(), "select ticket_id from messages where external_message_id = $1", externalID).Scan(&id); err != nil {
		e.T.Fatalf("ticket of %s: %v", externalID, err)
	}
	return id
}

// previewColumns reads the four preview columns of the message.
type previewColumns struct {
	URL, Title string
	Desc       *string
	MediaID    *int64
}

func storedPreview(t *testing.T, e *testEnv, externalID string) previewColumns {
	t.Helper()
	var p previewColumns
	var url, title *string
	err := e.Pool.QueryRow(e.T.Context(),
		"select preview_url, preview_title, preview_description, preview_media_id from messages where external_message_id = $1",
		externalID).Scan(&url, &title, &p.Desc, &p.MediaID)
	if err != nil {
		e.T.Fatalf("preview of %s: %v", externalID, err)
	}
	if url != nil {
		p.URL = *url
	}
	if title != nil {
		p.Title = *title
	}
	return p
}

// messageWith finds the message with the body in the API of the ticket.
func messageWith(t *testing.T, e *testEnv, ticketID int64, body string, token string) map[string]any {
	t.Helper()
	for _, m := range e.DoList(http.MethodGet, fmt.Sprintf("/api/tickets/%d/messages", ticketID), token) {
		if m["body"] == body {
			return m
		}
	}
	t.Fatalf("message %q not in the API", body)
	return nil
}

// The card of a received link is recorded with the message and the thumbnail
// as a media file, and the conversation API returns it after a reload. The
// thumbnail opens for whoever may see the ticket and is denied to another
// sector. A redelivery changes nothing.
func TestLinkPreviewIsRecordedAndServed(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	preview := &messaging.Preview{
		URL: "https://exemplo.com/noticia", Title: "Notícia do dia",
		Description: "Resumo da notícia", Thumbnail: linkThumbnail,
	}
	msg := linkMessage("PV-1", "5511977776666", "Olha: https://exemplo.com/noticia", preview)
	c.e.receive(c.sector.ID, msg)
	c.e.receive(c.sector.ID, msg)

	ticket := previewTicket(t, c.e, "PV-1")
	stored := storedPreview(t, c.e, "PV-1")
	if stored.URL != preview.URL || stored.Title != preview.Title || stored.Desc == nil || *stored.Desc != preview.Description || stored.MediaID == nil {
		t.Fatalf("stored preview = %+v", stored)
	}
	if n := c.e.Count("media_files"); n != 1 {
		t.Fatalf("media files = %d, want 1 (redelivery must not duplicate)", n)
	}
	// The file is a JPEG of its own, with the bytes the provider sent.
	var mime string
	if err := c.e.Pool.QueryRow(c.e.T.Context(), "select mime_type from media_files where id = $1", *stored.MediaID).Scan(&mime); err != nil {
		t.Fatal(err)
	}
	if mime != "image/jpeg" {
		t.Fatalf("thumbnail mime = %s", mime)
	}

	want := map[string]any{
		"url": preview.URL, "title": preview.Title, "description": preview.Description,
		"thumbnailMediaId": float64(*stored.MediaID),
	}
	for range 2 { // reabrir a conversa devolve a mesma prévia
		m := messageWith(t, c.e, ticket, msg.Body, c.anaToken)
		if m["type"] != "text" || !reflect.DeepEqual(m["preview"], want) {
			t.Fatalf("preview in the API = %v", m["preview"])
		}
	}

	// The ticket list keeps only the text of the last message: no card there.
	for _, row := range c.e.DoList(http.MethodGet, fmt.Sprintf("/api/sectors/%d/tickets", c.sector.ID), c.anaToken) {
		if row["id"] != float64(ticket) {
			continue
		}
		last := row["lastMessage"].(map[string]any)
		if last["preview"] != nil || last["body"] != msg.Body {
			t.Fatalf("last message = %v", last)
		}
	}

	status, header, body := c.e.get(fmt.Sprintf("/api/media/%d", *stored.MediaID), c.anaToken)
	if status != http.StatusOK || !bytes.Equal(body, linkThumbnail) || header.Get("Content-Type") != "image/jpeg" {
		t.Fatalf("thumbnail = %d %s %x", status, header.Get("Content-Type"), body)
	}
	if status, _, _ := c.e.get(fmt.Sprintf("/api/media/%d", *stored.MediaID), c.rhToken); status != http.StatusForbidden {
		t.Fatalf("thumbnail for another sector = %d, want 403", status)
	}
}

// The card is cut to its limits, never splitting a character; a thumbnail
// above the limit leaves the card without image; a card without title, with
// an address that is not http(s), or in a sent message does not exist.
func TestLinkPreviewLimitsAndWhenThereIsNoCard(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	longTitle := strings.Repeat("á", 300)
	longDescription := strings.Repeat("b", 700)

	c.e.receive(c.sector.ID, linkMessage("PV-BIG", "5511977776666", "Link grande", &messaging.Preview{
		URL: "http://exemplo.com/ficticio", Title: longTitle, Description: longDescription,
		Thumbnail: bytes.Repeat([]byte{1}, 64<<10+1),
	}))
	stored := storedPreview(t, c.e, "PV-BIG")
	if stored.Title != string([]rune(longTitle)[:200]) || stored.Desc == nil || *stored.Desc != strings.Repeat("b", 500) {
		t.Fatalf("title = %d chars, description = %v", len([]rune(stored.Title)), stored.Desc)
	}
	if stored.MediaID != nil {
		t.Fatalf("thumbnail above the limit was kept: %d", *stored.MediaID)
	}
	m := messageWith(t, c.e, previewTicket(t, c.e, "PV-BIG"), "Link grande", c.anaToken)
	if p := m["preview"].(map[string]any); p["title"] != stored.Title || p["thumbnailMediaId"] != nil {
		t.Fatalf("preview in the API = %v", p)
	}

	// Without description and without thumbnail the card keeps only what came.
	c.e.receive(c.sector.ID, linkMessage("PV-TEXT", "5511977776666", "Só o cartão", &messaging.Preview{
		URL: "https://exemplo.com", Title: "Título",
	}))
	stored = storedPreview(t, c.e, "PV-TEXT")
	if stored.Desc != nil || stored.MediaID != nil {
		t.Fatalf("card without image = %+v", stored)
	}
	m = messageWith(t, c.e, previewTicket(t, c.e, "PV-TEXT"), "Só o cartão", c.anaToken)
	if p := m["preview"].(map[string]any); p["description"] != nil || p["thumbnailMediaId"] != nil {
		t.Fatalf("preview in the API = %v", p)
	}

	// Without title, with an address that is not http(s), there is no card.
	for id, preview := range map[string]*messaging.Preview{
		"PV-NOTITLE": {URL: "https://exemplo.com", Title: "  "},
		"PV-NOHTTP":  {URL: "ftp://exemplo.com/arquivo", Title: "Título"},
	} {
		c.e.receive(c.sector.ID, linkMessage(id, "5511977776666", "Sem cartão "+id, preview))
		if stored := storedPreview(t, c.e, id); stored.URL != "" || stored.Title != "" || stored.Desc != nil || stored.MediaID != nil {
			t.Fatalf("%s: stored preview = %+v", id, stored)
		}
		m := messageWith(t, c.e, previewTicket(t, c.e, id), "Sem cartão "+id, c.anaToken)
		if m["preview"] != nil {
			t.Fatalf("%s: preview in the API = %v", id, m["preview"])
		}
	}

	// A message sent from the phone of the sector, even carrying a card, has none.
	c.e.sendOutside(c.sector.ID, linkMessage("PV-PHONE", "5511977776666", "Do celular", &messaging.Preview{
		URL: "https://exemplo.com", Title: "Título", Thumbnail: linkThumbnail,
	}))
	if stored := storedPreview(t, c.e, "PV-PHONE"); stored.URL != "" || stored.MediaID != nil {
		t.Fatalf("card from the phone = %+v", stored)
	}

	// Nor has a message sent by the agent through the system.
	c.assign()
	if resp := c.e.sendText(c.ticket.ID, c.anaToken, requestA, "Oi"); resp.Status != http.StatusOK {
		t.Fatalf("send: %d %v", resp.Status, resp.Body)
	}
	sent := c.e.outbound(c.ticket.ID)
	if len(sent) == 0 {
		t.Fatal("no message sent by the agent")
	}
	m = messageWith(t, c.e, c.ticket.ID, str(sent[0].Body), c.anaToken)
	if m["preview"] != nil {
		t.Fatalf("preview of the agent message = %v", m["preview"])
	}
}

// The fake takes the card through its HTTP API, in base64, which is the seam
// for the end-to-end test of the screen.
func TestFakeReceivesLinkPreviewOverHTTP(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	body := fmt.Sprintf(`{"externalMessageId": "PV-HTTP", "phone": "5511955554444",
		"body": "Olha: https://exemplo.com/noticia",
		"preview": {"url": "https://exemplo.com/noticia", "title": "Notícia do dia", "description": "Resumo",
			"thumbnail": %q}}`, base64.StdEncoding.EncodeToString(linkThumbnail))
	req := httptest.NewRequestWithContext(t.Context(), http.MethodPost,
		fmt.Sprintf("/messaging/sectors/%d/receive", c.sector.ID), strings.NewReader(body))
	rec := httptest.NewRecorder()
	c.e.WhatsApp.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("receive = %d %s", rec.Code, rec.Body)
	}

	stored := storedPreview(t, c.e, "PV-HTTP")
	if stored.URL != "https://exemplo.com/noticia" || stored.Title != "Notícia do dia" || stored.MediaID == nil {
		t.Fatalf("stored preview = %+v", stored)
	}
	m := messageWith(t, c.e, previewTicket(t, c.e, "PV-HTTP"), "Olha: https://exemplo.com/noticia", c.anaToken)
	if p := m["preview"].(map[string]any); p["thumbnailMediaId"] != float64(*stored.MediaID) {
		t.Fatalf("preview in the API = %v", p)
	}
	status, _, raw := c.e.get(fmt.Sprintf("/api/media/%d", *stored.MediaID), c.anaToken)
	if status != http.StatusOK || !bytes.Equal(raw, linkThumbnail) {
		t.Fatalf("thumbnail = %d %x", status, raw)
	}
}
