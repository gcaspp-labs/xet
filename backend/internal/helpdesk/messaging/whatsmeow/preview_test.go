package whatsmeow

import (
	"reflect"
	"testing"
	"time"

	"go.mau.fi/whatsmeow/proto/waE2E"
	"google.golang.org/protobuf/proto"

	"github.com/gcaspp-labs/xet/backend/internal/helpdesk/messaging"
)

// The card of a link of a received text comes from the message itself: the
// title, the description, the address and the JPEG thumbnail the provider
// delivered (spec #511). The server never opens the site.
func TestLinkPreviewComesFromTheReceivedText(t *testing.T) {
	a, rec, _ := newTestAdapter(t)
	s := &session{sectorID: 7, adapter: a}
	at := time.Date(2026, 11, 28, 9, 0, 0, 0, time.UTC)
	thumb := []byte{0xFF, 0xD8, 0xFF, 0xE0, 'j', 'p', 'e', 'g', 0xFF, 0xD9}

	ext := func(title, matched string) *waE2E.Message {
		return &waE2E.Message{ExtendedTextMessage: &waE2E.ExtendedTextMessage{
			Text:          proto.String("Olha: " + matched),
			Title:         proto.String(title),
			Description:   proto.String("Resumo da notícia"),
			MatchedText:   proto.String(matched),
			JPEGThumbnail: thumb,
		}}
	}
	receive := func(id string, fromMe bool, raw *waE2E.Message) *messaging.Preview {
		t.Helper()
		rec.reset()
		if !s.message(incoming(id, fromMe, at, raw)) {
			t.Fatalf("%s: event not acknowledged", id)
		}
		rec.mu.Lock()
		defer rec.mu.Unlock()
		switch ev := rec.events[0].(type) {
		case messaging.MessageReceived:
			return ev.Message.Preview
		case messaging.MessageSentOutside:
			return ev.Message.Preview
		}
		t.Fatalf("%s: event %T", id, rec.events[0])
		return nil
	}

	got := receive("PV-1", false, ext("Notícia do dia", "https://exemplo.com/noticia"))
	want := &messaging.Preview{
		URL:         "https://exemplo.com/noticia",
		Title:       "Notícia do dia",
		Description: "Resumo da notícia",
		Thumbnail:   thumb,
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("preview = %+v, want %+v", got, want)
	}

	for name, c := range map[string]*waE2E.Message{
		"without title":       ext("  ", "https://exemplo.com/noticia"),
		"address not http":    ext("Notícia do dia", "ftp://exemplo.com/arquivo"),
		"plain text, no link": {ExtendedTextMessage: &waE2E.ExtendedTextMessage{Text: proto.String("Bom dia")}},
	} {
		if got := receive("PV-"+name, false, c); got != nil {
			t.Fatalf("%s: preview = %+v, want none", name, got)
		}
	}

	// A text sent from the phone of the sector never carries the card.
	if got := receive("PV-OWN", true, ext("Notícia do dia", "https://exemplo.com/noticia")); got != nil {
		t.Fatalf("sent from the phone: preview = %+v, want none", got)
	}
}
