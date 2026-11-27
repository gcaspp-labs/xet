package whatsmeow

import (
	"log/slog"
	"reflect"
	"strings"
	"testing"
	"time"

	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/proto/waCommon"
	"go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
	"go.mau.fi/whatsmeow/util/gcmutil"
	"go.mau.fi/whatsmeow/util/hkdfutil"
	"google.golang.org/protobuf/proto"

	"github.com/gcaspp-labs/xet/backend/internal/helpdesk/messaging"
)

// The edit of a message also arrives encrypted with the secret of the original
// message (SecretEncryptedMessage, type MESSAGE_EDIT), the format WhatsApp uses
// today instead of the protocol message. These tests build that event the way
// the app sends it and check the neutral event; without the secret of the
// original, the edit is ignored instead of becoming a new message.

// messageSecret is the 32-byte secret of an original message, stored when the
// message was received.
var messageSecret = []byte("0123456789abcdef0123456789abcdef")

func secretEdit(t *testing.T, cli *whatsmeow.Client, info types.MessageInfo, target string, content *waE2E.Message) *events.Message {
	t.Helper()
	origSender := info.Chat
	if info.IsFromMe || info.IsGroup {
		origSender = info.Sender
	}
	base, _, err := cli.Store.MsgSecrets.GetMessageSecret(t.Context(), info.Chat, origSender, target)
	if err != nil || len(base) == 0 {
		t.Fatalf("secret of %s: %v", target, err)
	}
	// The key derivation of Whatsmeow (generateMsgSecretKey, EncSecretMessageEdit).
	useCase := target + origSender.ToNonAD().String() + info.Sender.ToNonAD().String() + string(whatsmeow.EncSecretMessageEdit)
	key := hkdfutil.SHA256(base, nil, []byte(useCase), 32)
	plaintext, err := proto.Marshal(content)
	if err != nil {
		t.Fatal(err)
	}
	iv := make([]byte, 12)
	payload, err := gcmutil.Encrypt(key, iv, plaintext, nil)
	if err != nil {
		t.Fatal(err)
	}
	raw := &waE2E.Message{SecretEncryptedMessage: &waE2E.SecretEncryptedMessage{
		TargetMessageKey: secretEditKey(info, target),
		EncPayload:       payload,
		EncIV:            iv,
		SecretEncType:    waE2E.SecretEncryptedMessage_MESSAGE_EDIT.Enum(),
	}}
	return (&events.Message{Info: info, RawMessage: raw}).UnwrapRaw()
}

// secretEditKey is the key of the original message, as the app includes it in
// the encrypted edit: in a group it names the participant who sent it.
func secretEditKey(info types.MessageInfo, target string) *waCommon.MessageKey {
	key := &waCommon.MessageKey{
		RemoteJID: proto.String(info.Chat.String()),
		FromMe:    proto.Bool(info.IsFromMe),
		ID:        proto.String(target),
	}
	if info.IsGroup {
		key.Participant = proto.String(info.Sender.String())
	}
	return key
}

func TestSecretEncryptedEditsBecomeNeutralEvents(t *testing.T) {
	// Debug on: the log of a skipped kind is what tells why it stayed out.
	a, rec, logs := newTestAdapterAt(t, slog.LevelDebug)
	sector := storeDevice(t, a, "5511900001111", 3)
	device, err := a.container.GetDevice(t.Context(), sector)
	if err != nil || device == nil {
		t.Fatalf("device: %v", err)
	}
	cli := whatsmeow.NewClient(device, nil)
	s := &session{sectorID: 7, adapter: a, client: cli}
	at := time.Date(2026, 11, 26, 18, 34, 0, 0, time.UTC)

	// The secret of the original message, kept when it was received.
	for _, target := range []string{"ORIG-TEXT", "ORIG-IMAGE", "ORIG-SECTOR"} {
		sender := contactChat
		if target == "ORIG-SECTOR" {
			sender = sector.ToNonAD()
		}
		if err := device.MsgSecrets.PutMessageSecret(t.Context(), contactChat, sender, target, messageSecret); err != nil {
			t.Fatal(err)
		}
	}
	contactInfo := func(id string) types.MessageInfo {
		return types.MessageInfo{
			MessageSource: types.MessageSource{Chat: contactChat, Sender: contactChat},
			ID:            id,
			Timestamp:     at,
		}
	}
	sectorInfo := func(id string) types.MessageInfo {
		return types.MessageInfo{
			MessageSource: types.MessageSource{Chat: contactChat, Sender: sector.ToNonAD(), IsFromMe: true},
			ID:            id,
			Timestamp:     at,
		}
	}

	cases := []struct {
		name string
		evt  *events.Message
		want messaging.MessageEdited
	}{
		{
			name: "text edited by the contact",
			evt:  secretEdit(t, cli, contactInfo("SEC-1"), "ORIG-TEXT", &waE2E.Message{Conversation: proto.String("texto novo")}),
			want: messaging.MessageEdited{
				SectorID: 7, ExternalEventID: "SEC-1", TargetExternalMessageID: "ORIG-TEXT",
				ExternalContactID: contactChat.String(), Phone: "5511988887777", Body: "texto novo", At: at,
			},
		},
		{
			name: "caption of an image edited by the contact",
			evt:  secretEdit(t, cli, contactInfo("SEC-2"), "ORIG-IMAGE", &waE2E.Message{ImageMessage: &waE2E.ImageMessage{Caption: proto.String("legenda nova")}}),
			want: messaging.MessageEdited{
				SectorID: 7, ExternalEventID: "SEC-2", TargetExternalMessageID: "ORIG-IMAGE",
				ExternalContactID: contactChat.String(), Phone: "5511988887777", Body: "legenda nova", At: at,
			},
		},
		{
			name: "text edited from the phone of the sector",
			evt:  secretEdit(t, cli, sectorInfo("SEC-3"), "ORIG-SECTOR", &waE2E.Message{Conversation: proto.String("texto novo")}),
			want: messaging.MessageEdited{
				SectorID: 7, ExternalEventID: "SEC-3", TargetExternalMessageID: "ORIG-SECTOR",
				ExternalContactID: contactChat.String(), Phone: "5511988887777", FromSector: true, Body: "texto novo", At: at,
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
			if len(rec.events) != 1 {
				t.Fatalf("events = %#v\nwant one MessageEdited", rec.events)
			}
			if got, ok := rec.events[0].(messaging.MessageEdited); !ok || !reflect.DeepEqual(got, c.want) {
				t.Fatalf("events = %#v\nwant [%#v]", rec.events, c.want)
			}
		})
	}

	// Without the secret of the original message (an edit of a message from
	// before the connection) the edit is ignored with a log, not a new message.
	rec.reset()
	orphan := secretEditRaw(t, contactInfo("SEC-4"), "ORIG-UNKNOWN", &waE2E.Message{Conversation: proto.String("perdida")})
	if !s.message(orphan) {
		t.Fatal("undecryptable edit not acknowledged")
	}
	rec.mu.Lock()
	n := len(rec.events)
	rec.mu.Unlock()
	if n != 0 {
		t.Fatalf("%d events for an undecryptable edit, want none", n)
	}
	if !strings.Contains(logs.String(), "secret encrypted edit not decrypted") {
		t.Fatalf("undecryptable edit not logged; logs:\n%s", logs)
	}

	// Other kinds carried the same way (event and poll edits, an option added
	// to a poll) stay out, with no event of any kind.
	skipped := []struct {
		name string
		kind waE2E.SecretEncryptedMessage_SecretEncType
	}{
		{"event edit", waE2E.SecretEncryptedMessage_EVENT_EDIT},
		{"poll edit", waE2E.SecretEncryptedMessage_POLL_EDIT},
		{"poll add option", waE2E.SecretEncryptedMessage_POLL_ADD_OPTION},
	}
	for _, c := range skipped {
		rec.reset()
		content := &waE2E.Message{Conversation: proto.String("ignorada")}
		if c.kind == waE2E.SecretEncryptedMessage_POLL_ADD_OPTION {
			content = pollWithAddedOption()
		}
		evt := secretEditRaw(t, contactInfo("SEC-"+strings.ReplaceAll(c.name, " ", "-")), "ORIG-TEXT", content)
		evt.Message.GetSecretEncryptedMessage().SecretEncType = c.kind.Enum()
		if !s.message(evt) {
			t.Fatalf("%s: not acknowledged", c.name)
		}
		rec.mu.Lock()
		n := len(rec.events)
		rec.mu.Unlock()
		if n != 0 {
			t.Fatalf("%s: %d events, want none", c.name, n)
		}
	}
	// Each skipped kind is logged by name, so the pilot shows why it stayed out.
	for _, kind := range []waE2E.SecretEncryptedMessage_SecretEncType{
		waE2E.SecretEncryptedMessage_EVENT_EDIT,
		waE2E.SecretEncryptedMessage_POLL_EDIT,
		waE2E.SecretEncryptedMessage_POLL_ADD_OPTION,
	} {
		if !strings.Contains(logs.String(), "type="+kind.String()) {
			t.Fatalf("%s not logged as ignored; logs:\n%s", kind, logs)
		}
	}
}

// pollWithAddedOption is the content of the edit that adds an option to a poll:
// the poll again, with the new option.
func pollWithAddedOption() *waE2E.Message {
	return &waE2E.Message{PollCreationMessage: &waE2E.PollCreationMessage{
		Name: proto.String("qual horário?"),
		Options: []*waE2E.PollCreationMessage_Option{
			{OptionName: proto.String("manhã")},
			{OptionName: proto.String("tarde")},
			{OptionName: proto.String("noite")},
		},
	}}
}

// An edit in a group goes with Group set and no contact: there is no single
// contact in a group, and the chat itself is the destination.
func TestSecretEncryptedEditInGroup(t *testing.T) {
	a, rec, _ := newTestAdapter(t)
	sector := storeDevice(t, a, "5511900001111", 3)
	device, err := a.container.GetDevice(t.Context(), sector)
	if err != nil || device == nil {
		t.Fatalf("device: %v", err)
	}
	cli := whatsmeow.NewClient(device, nil)
	s := &session{sectorID: 7, adapter: a, client: cli}
	at := time.Date(2026, 11, 26, 18, 34, 0, 0, time.UTC)
	group := types.NewJID("120363000000000001", types.GroupServer)
	info := types.MessageInfo{
		MessageSource: types.MessageSource{Chat: group, Sender: contactChat, IsGroup: true},
		ID:            "SEC-G1",
		Timestamp:     at,
	}
	if err := device.MsgSecrets.PutMessageSecret(t.Context(), group, contactChat, "ORIG-G", messageSecret); err != nil {
		t.Fatal(err)
	}

	if !s.message(secretEdit(t, cli, info, "ORIG-G", &waE2E.Message{Conversation: proto.String("texto novo")})) {
		t.Fatal("event not acknowledged")
	}
	rec.mu.Lock()
	defer rec.mu.Unlock()
	want := messaging.MessageEdited{
		SectorID: 7, ExternalEventID: "SEC-G1", TargetExternalMessageID: "ORIG-G",
		Group: true, Body: "texto novo", At: at,
	}
	if len(rec.events) != 1 || !reflect.DeepEqual(rec.events[0], want) {
		t.Fatalf("events = %#v\nwant [%#v]", rec.events, want)
	}
}

// secretEditRaw is secretEdit for a target without a stored secret: the event
// carries a sealed payload that cannot be opened.
func secretEditRaw(t *testing.T, info types.MessageInfo, target string, content *waE2E.Message) *events.Message {
	t.Helper()
	plaintext, err := proto.Marshal(content)
	if err != nil {
		t.Fatal(err)
	}
	key := hkdfutil.SHA256(messageSecret, nil, []byte("sem segredo guardado"), 32)
	iv := make([]byte, 12)
	payload, err := gcmutil.Encrypt(key, iv, plaintext, nil)
	if err != nil {
		t.Fatal(err)
	}
	raw := &waE2E.Message{SecretEncryptedMessage: &waE2E.SecretEncryptedMessage{
		TargetMessageKey: secretEditKey(info, target),
		EncPayload:       payload,
		EncIV:            iv,
		SecretEncType:    waE2E.SecretEncryptedMessage_MESSAGE_EDIT.Enum(),
	}}
	return (&events.Message{Info: info, RawMessage: raw}).UnwrapRaw()
}

// An unsupported kind becomes a message as before, and the log names the
// fields set in it, without the content: a format that still shows up as
// "mensagem não suportada" can be identified from the pilot. The sticker left
// this list in #494.
func TestUnsupportedKindIsLoggedByField(t *testing.T) {
	a, rec, logs := newTestAdapter(t)
	s := &session{sectorID: 7, adapter: a}
	at := time.Date(2026, 11, 26, 18, 34, 0, 0, time.UTC)

	if !s.message(incoming("UN-1", false, at, &waE2E.Message{LocationMessage: &waE2E.LocationMessage{}})) {
		t.Fatal("event not acknowledged")
	}
	rec.mu.Lock()
	defer rec.mu.Unlock()
	if len(rec.events) != 1 {
		t.Fatalf("events = %#v\nwant one MessageReceived", rec.events)
	}
	got, ok := rec.events[0].(messaging.MessageReceived)
	if !ok || got.Message.Type != messaging.TypeUnsupported {
		t.Fatalf("events = %#v\nwant an unsupported MessageReceived", rec.events)
	}
	if !strings.Contains(logs.String(), "whatsapp message unsupported") || !strings.Contains(logs.String(), "fields=locationMessage") {
		t.Fatalf("unsupported kind not logged by field; logs:\n%s", logs)
	}
}
