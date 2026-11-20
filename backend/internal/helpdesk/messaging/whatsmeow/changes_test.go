package whatsmeow

import (
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
			// The echo of an edit sent by the system, as the domain recognizes it.
			name: "document caption edited by the system, echoed",
			evt:  incoming("EV-6", true, at, edit(&waE2E.Message{DocumentMessage: &waE2E.DocumentMessage{Caption: proto.String("*Ana:*\nnova legenda")}})),
			want: messaging.MessageEdited{
				SectorID: 7, ExternalEventID: "EV-6", TargetExternalMessageID: "ORIG-1",
				ExternalContactID: contactChat.String(), Phone: "5511988887777", FromSector: true, Body: "*Ana:*\nnova legenda", At: edited,
			},
		},
		{
			name: "deleted for everyone by the system, echoed",
			evt:  incoming("EV-7", true, at, cli.BuildRevoke(contactChat, types.EmptyJID, "ORIG-2")),
			want: messaging.MessageRevoked{
				SectorID: 7, ExternalEventID: "EV-7", TargetExternalMessageID: "ORIG-2",
				ExternalContactID: contactChat.String(), Phone: "5511988887777", FromSector: true, At: at,
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
