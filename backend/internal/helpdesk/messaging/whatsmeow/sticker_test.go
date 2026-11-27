package whatsmeow

import (
	"context"
	"reflect"
	"testing"
	"time"

	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/proto/waE2E"
	"google.golang.org/protobuf/proto"

	"github.com/gcaspp-labs/xet/backend/internal/helpdesk/messaging"
)

// downloads answers a media download without the WhatsApp connection.
type downloads struct {
	data []byte
	err  error
}

func (d downloads) Download(context.Context, whatsmeow.DownloadableMessage) ([]byte, error) {
	return d.data, d.err
}

// A received sticker becomes an image message with the downloaded webp file;
// a Lottie sticker, which is not an image, stays the notice of an unsupported
// message. Not parallel: New sets package globals.
func TestStickerBecomesImageMessage(t *testing.T) {
	a, rec, _ := newTestAdapter(t)
	at := time.Date(2026, 11, 27, 9, 0, 0, 0, time.UTC)
	webp := []byte("RIFF\x00\x00\x00\x00WEBPVP8 ")
	sticker := &waE2E.StickerMessage{Mimetype: proto.String("image/webp"), FileLength: proto.Uint64(uint64(len(webp)))}
	s := &session{sectorID: 7, adapter: a, downloads: downloads{data: webp}}

	rec.reset()
	if !s.message(incoming("STK-1", false, at, &waE2E.Message{StickerMessage: sticker})) {
		t.Fatal("event not acknowledged")
	}
	rec.mu.Lock()
	got, ok := rec.events[0].(messaging.MessageReceived)
	rec.mu.Unlock()
	if !ok {
		t.Fatalf("event = %#v, want MessageReceived", rec.events[0])
	}
	want := messaging.Message{
		ExternalMessageID: "STK-1",
		ExternalContactID: contactChat.String(),
		Phone:             "5511988887777",
		Type:              messaging.TypeSticker,
		Media:             &messaging.Media{Data: webp, MimeType: "image/webp"},
		SentAt:            at,
	}
	if !reflect.DeepEqual(got.Message, want) {
		t.Fatalf("message = %#v\nwant %#v", got.Message, want)
	}

	// A Lottie sticker is not an image: it stays unsupported, without download.
	rec.reset()
	lottie := &waE2E.StickerMessage{IsLottie: proto.Bool(true), Mimetype: proto.String("application/was")}
	if !s.message(incoming("STK-2", false, at, &waE2E.Message{StickerMessage: lottie})) {
		t.Fatal("lottie event not acknowledged")
	}
	rec.mu.Lock()
	defer rec.mu.Unlock()
	gotLottie, ok := rec.events[0].(messaging.MessageReceived)
	if !ok || gotLottie.Message.Type != messaging.TypeUnsupported || gotLottie.Message.Media != nil {
		t.Fatalf("lottie event = %#v", rec.events[0])
	}
}

// A sticker received above the download limit becomes media_unavailable, like
// the other media.
func TestStickerAboveTheLimitBecomesMediaUnavailable(t *testing.T) {
	a, rec, _ := newTestAdapter(t)
	at := time.Date(2026, 11, 27, 9, 0, 0, 0, time.UTC)
	big := &waE2E.StickerMessage{
		Mimetype:   proto.String("image/webp"),
		FileLength: proto.Uint64(messaging.MaxReceivedFileSize + 1),
	}
	s := &session{sectorID: 7, adapter: a, downloads: downloads{data: []byte("x")}}

	rec.reset()
	if !s.message(incoming("STK-3", false, at, &waE2E.Message{StickerMessage: big})) {
		t.Fatal("event not acknowledged")
	}
	rec.mu.Lock()
	defer rec.mu.Unlock()
	got, ok := rec.events[0].(messaging.MessageReceived)
	if !ok || got.Message.Type != messaging.TypeMediaUnavailable || got.Message.Media != nil {
		t.Fatalf("event = %#v", rec.events[0])
	}
}

// The citation of a sticker carries the type and no text, received and sent,
// and the reply to it goes with the StickerMessage in the context, without
// media.
func TestStickerIsQuotedWithoutText(t *testing.T) {
	// A customer citing a sticker.
	quoting := incoming("Q-STK", false, time.Date(2026, 11, 27, 9, 0, 0, 0, time.UTC),
		&waE2E.Message{ExtendedTextMessage: &waE2E.ExtendedTextMessage{
			Text: proto.String("Essa mesmo?"),
			ContextInfo: &waE2E.ContextInfo{
				StanzaID:      proto.String("STK-1"),
				QuotedMessage: &waE2E.Message{StickerMessage: &waE2E.StickerMessage{Mimetype: proto.String("image/webp")}},
			},
		}})
	q := quote(quoting.Message)
	want := &messaging.Quote{ExternalMessageID: "STK-1", Snippet: &messaging.QuoteSnippet{Type: messaging.TypeSticker}}
	if !reflect.DeepEqual(q, want) {
		t.Fatalf("quote = %#v, want %#v", q, want)
	}

	// The reply of the sector citing a sticker: the context carries a
	// StickerMessage, without media.
	ctx := replyContext(nil, contactChat, &messaging.Quote{
		ExternalMessageID: "STK-1",
		Snippet:           &messaging.QuoteSnippet{Type: messaging.TypeSticker},
	})
	if ctx.GetStanzaID() != "STK-1" || ctx.GetQuotedMessage().GetStickerMessage() == nil {
		t.Fatalf("reply context = %v", ctx)
	}
	// The sticker read back from the timeout is the snippet it came from.
	if sn := snippet(ctx.GetQuotedMessage()); !reflect.DeepEqual(sn, &messaging.QuoteSnippet{Type: messaging.TypeSticker}) {
		t.Fatalf("snippet of the quoted sticker = %+v", sn)
	}
}
