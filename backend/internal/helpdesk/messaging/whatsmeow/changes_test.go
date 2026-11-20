package whatsmeow

import (
	"context"
	"errors"
	"reflect"
	"testing"
	"time"

	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/proto/waCommon"
	"go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
	"google.golang.org/protobuf/proto"

	"github.com/gcaspp-labs/xet/backend/internal/helpdesk/messaging"
)

// The edits and deletions of the pinned Whatsmeow arrive as protocol messages
// pointing at the target by its key. These tests feed them to the session as
// Whatsmeow delivers them (the edit wrapped and unwrapped by UnwrapRaw) and
// check the neutral events. Not parallel: New sets package globals.

var contactChat = types.NewJID("5511988887777", types.DefaultUserServer)

func incoming(id string, fromMe bool, at time.Time, raw *waE2E.Message) *events.Message {
	evt := &events.Message{
		Info: types.MessageInfo{
			MessageSource: types.MessageSource{Chat: contactChat, Sender: contactChat, IsFromMe: fromMe},
			ID:            id,
			Timestamp:     at,
		},
		RawMessage: raw,
	}
	return evt.UnwrapRaw()
}

func TestEditsAndDeletionsBecomeNeutralEvents(t *testing.T) {
	a, rec, _ := newTestAdapter(t)
	s := &session{sectorID: 7, adapter: a}
	at := time.Date(2026, 11, 19, 10, 0, 0, 0, time.UTC)
	edited := at.Add(time.Second).Local() // time.UnixMilli gives local time.
	var cli *whatsmeow.Client             // BuildEdit uses no state of the client.

	edit := func(content *waE2E.Message) *waE2E.Message {
		m := cli.BuildEdit(contactChat, "ORIG-1", content)
		m.GetEditedMessage().GetMessage().GetProtocolMessage().TimestampMS = proto.Int64(edited.UnixMilli())
		return m
	}
	revoke := &waE2E.Message{ProtocolMessage: &waE2E.ProtocolMessage{
		Type: waE2E.ProtocolMessage_REVOKE.Enum(),
		Key:  &waCommon.MessageKey{ID: proto.String("ORIG-2"), RemoteJID: proto.String(contactChat.String())},
	}}

	cases := []struct {
		name string
		evt  *events.Message
		want messaging.Event
	}{
		{
			name: "text edited by the contact",
			evt:  incoming("EV-1", false, at, edit(&waE2E.Message{Conversation: proto.String("novo texto")})),
			want: messaging.MessageEdited{
				SectorID: 7, ExternalEventID: "EV-1", TargetExternalMessageID: "ORIG-1",
				ExternalContactID: contactChat.String(), Phone: "5511988887777", Body: "novo texto", At: edited,
			},
		},
		{
			name: "caption edited from the phone",
			evt:  incoming("EV-2", true, at, edit(&waE2E.Message{ImageMessage: &waE2E.ImageMessage{Caption: proto.String("nova legenda")}})),
			want: messaging.MessageEdited{
				SectorID: 7, ExternalEventID: "EV-2", TargetExternalMessageID: "ORIG-1",
				ExternalContactID: contactChat.String(), Phone: "5511988887777", FromSector: true, Body: "nova legenda", At: edited,
			},
		},
		{
			name: "deleted for everyone by the contact",
			evt:  incoming("EV-3", false, at, revoke),
			want: messaging.MessageRevoked{
				SectorID: 7, ExternalEventID: "EV-3", TargetExternalMessageID: "ORIG-2",
				ExternalContactID: contactChat.String(), Phone: "5511988887777", At: at,
			},
		},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			rec.reset()
			if !s.message(c.evt) {
				t.Fatal("event not acknowledged")
			}
			rec.mu.Lock()
			defer rec.mu.Unlock()
			if len(rec.events) != 1 || !reflect.DeepEqual(rec.events[0], c.want) {
				t.Fatalf("events = %#v\nwant [%#v]", rec.events, c.want)
			}
		})
	}

	// Edits without text or caption (a poll, a reaction edit) and other
	// protocol messages emit nothing, and are not taken for a new message.
	for name, evt := range map[string]*events.Message{
		"edit without text": incoming("EV-4", false, at, edit(&waE2E.Message{PollUpdateMessage: &waE2E.PollUpdateMessage{}})),
		"other protocol message": incoming("EV-5", false, at, &waE2E.Message{ProtocolMessage: &waE2E.ProtocolMessage{
			Type: waE2E.ProtocolMessage_EPHEMERAL_SETTING.Enum(),
		}}),
	} {
		rec.reset()
		if !s.message(evt) {
			t.Fatalf("%s: not acknowledged", name)
		}
		rec.mu.Lock()
		n := len(rec.events)
		rec.mu.Unlock()
		if n != 0 {
			t.Fatalf("%s: %d events, want none", name, n)
		}
	}
}

func TestCapabilitiesFollowWhatsApp(t *testing.T) {
	a, _, _ := newTestAdapter(t)
	want := messaging.Capabilities{EditWindow: 15 * time.Minute, RevokeWindow: 48 * time.Hour, ReceivesChanges: true}
	if got := a.Capabilities(); got != want {
		t.Fatalf("capabilities = %+v, want %+v", got, want)
	}
}

// What the system sends as an edit or a deletion for everyone comes back, as
// its echo from the sector number, as the same text or caption and target:
// the domain recognizes it by the event ID. Audio has no edit.
func TestEditsAndDeletionsSentEchoBack(t *testing.T) {
	a, rec, _ := newTestAdapter(t)
	s := &session{sectorID: 7, adapter: a}
	at := time.Date(2026, 11, 19, 10, 0, 0, 0, time.UTC)
	var cli *whatsmeow.Client // BuildEdit and BuildRevoke of an own message use no state of the client.

	for _, typ := range []messaging.MessageType{messaging.TypeText, messaging.TypeImage, messaging.TypeVideo, messaging.TypeDocument} {
		content, err := editContent(typ, "*Ana:*\nnova legenda")
		if err != nil {
			t.Fatalf("%s: %v", typ, err)
		}
		rec.reset()
		if !s.message(incoming("EV-"+string(typ), true, at, cli.BuildEdit(contactChat, "ORIG-1", content))) {
			t.Fatalf("%s: echo not acknowledged", typ)
		}
		rec.mu.Lock()
		ev, ok := rec.events[0].(messaging.MessageEdited)
		rec.mu.Unlock()
		if !ok || ev.Body != "*Ana:*\nnova legenda" || ev.TargetExternalMessageID != "ORIG-1" || !ev.FromSector || ev.ExternalEventID != "EV-"+string(typ) {
			t.Fatalf("%s: echo = %#v", typ, rec.events)
		}
	}
	if _, err := editContent(messaging.TypeAudio, ""); !errors.Is(err, messaging.ErrUnsupported) {
		t.Fatalf("audio edit: %v", err)
	}

	rec.reset()
	if !s.message(incoming("EV-R", true, at, cli.BuildRevoke(contactChat, types.EmptyJID, "ORIG-2"))) {
		t.Fatal("revoke echo not acknowledged")
	}
	rec.mu.Lock()
	defer rec.mu.Unlock()
	if ev, ok := rec.events[0].(messaging.MessageRevoked); !ok || ev.TargetExternalMessageID != "ORIG-2" || !ev.FromSector || ev.ExternalEventID != "EV-R" {
		t.Fatalf("revoke echo = %#v", rec.events)
	}
}

// A timeout is an unknown result, never a refusal; anything else the server
// answers is a refusal.
func TestChangeErrorsTellRefusalFromUnknownResult(t *testing.T) {
	for _, err := range []error{context.DeadlineExceeded, context.Canceled, whatsmeow.ErrMessageTimedOut, whatsmeow.ErrIQTimedOut} {
		if got := changeError(err); errors.Is(got, messaging.ErrNotAccepted) {
			t.Fatalf("%v taken as a refusal", err)
		}
	}
	if got := changeError(errors.New("server returned error 479")); !errors.Is(got, messaging.ErrNotAccepted) {
		t.Fatalf("server error = %v, want a refusal", got)
	}
}
