package whatsmeow

import (
	"bytes"
	"context"
	"log/slog"
	"reflect"
	"strings"
	"sync"
	"testing"
	"time"

	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/proto/waAdv"
	"go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
	"google.golang.org/protobuf/proto"

	"github.com/gcaspp-labs/xet/backend/internal/helpdesk/messaging"
	"github.com/gcaspp-labs/xet/backend/internal/testdb"
)

// The store keys each device by its full JID, with the device part, while the
// sector keeps the account without it. These tests insert devices the way a
// real pairing saves them, which the fake adapter does not show. They do not
// run in parallel: New sets package globals of Whatsmeow.

type recorder struct {
	mu     sync.Mutex
	events []messaging.Event
}

func (r *recorder) reset() {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.events = nil
}

func (r *recorder) handle(_ context.Context, ev messaging.Event) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.events = append(r.events, ev)
	return nil
}

type syncBuffer struct {
	mu  sync.Mutex
	buf bytes.Buffer
}

func (b *syncBuffer) Write(p []byte) (int, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.buf.Write(p)
}

func (b *syncBuffer) String() string {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.buf.String()
}

func newTestAdapter(t *testing.T) (*Adapter, *recorder, *syncBuffer) {
	t.Helper()
	logs := &syncBuffer{}
	rec := &recorder{}
	a, err := New(t.Context(), testdb.New(t), rec.handle, slog.New(slog.NewTextHandler(logs, nil)))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = a.Close() })
	return a, rec, logs
}

// storeDevice saves a paired device under its full JID, as Whatsmeow does.
func storeDevice(t *testing.T, a *Adapter, user string, device uint16) types.JID {
	t.Helper()
	jid := types.JID{User: user, Device: device, Server: types.DefaultUserServer}
	d := a.container.NewDevice()
	d.ID = &jid
	// Placeholder pairing data, with the sizes the store checks.
	d.Account = &waAdv.ADVSignedDeviceIdentity{
		Details:             []byte{1},
		AccountSignature:    make([]byte, 64),
		AccountSignatureKey: make([]byte, 32),
		DeviceSignature:     make([]byte, 64),
	}
	if err := a.container.PutDevice(t.Context(), d); err != nil {
		t.Fatal(err)
	}
	return jid
}

func TestDeviceLookup(t *testing.T) {
	a, _, _ := newTestAdapter(t)
	full := storeDevice(t, a, "5511999999999", 23)
	storeDevice(t, a, "5511888888888", 7)

	for name, accountID := range map[string]string{
		"account without device part": full.ToNonAD().String(),
		"full device JID":             full.String(),
	} {
		t.Run(name, func(t *testing.T) {
			got, err := a.device(t.Context(), accountID)
			if err != nil {
				t.Fatal(err)
			}
			if got == nil || got.ID == nil || *got.ID != full {
				t.Fatalf("device(%q) = %v, want %s", accountID, got, full)
			}
		})
	}
}

func TestDeviceLookupMissingAccount(t *testing.T) {
	a, rec, _ := newTestAdapter(t)
	storeDevice(t, a, "5511888888888", 7)

	for _, accountID := range []string{"5511999999999@s.whatsapp.net", "5511999999999:23@s.whatsapp.net"} {
		got, err := a.device(t.Context(), accountID)
		if err != nil {
			t.Fatal(err)
		}
		if got != nil {
			t.Fatalf("device(%q) = %s, want nil", accountID, got.ID)
		}
	}

	if err := a.Connect(t.Context(), messaging.Account{SectorID: 1, AccountID: "5511999999999@s.whatsapp.net"}); err != nil {
		t.Fatal(err)
	}
	assertLoggedOut(t, rec, 1)
}

func TestDeviceLookupAmbiguousAccount(t *testing.T) {
	a, rec, logs := newTestAdapter(t)
	full := storeDevice(t, a, "5511999999999", 23)
	storeDevice(t, a, "5511999999999", 24)

	for name, accountID := range map[string]string{
		"account without device part": full.ToNonAD().String(),
		"full device JID":             full.String(),
	} {
		t.Run(name, func(t *testing.T) {
			before := strings.Count(logs.String(), "more than one stored device")
			got, err := a.device(t.Context(), accountID)
			if err != nil {
				t.Fatal(err)
			}
			if got != nil {
				t.Fatalf("device(%q) picked %s among two stored devices of the same number, want nil", accountID, got.ID)
			}
			if strings.Count(logs.String(), "more than one stored device") != before+1 {
				t.Fatalf("ambiguous account %q not logged; logs:\n%s", accountID, logs)
			}
		})
	}

	for i, accountID := range []string{full.ToNonAD().String(), full.String()} {
		sectorID := int64(i + 2)
		rec.reset()
		if err := a.Connect(t.Context(), messaging.Account{SectorID: sectorID, AccountID: accountID}); err != nil {
			t.Fatal(err)
		}
		assertLoggedOut(t, rec, sectorID)
	}
}

func assertLoggedOut(t *testing.T, rec *recorder, sectorID int64) {
	t.Helper()
	rec.mu.Lock()
	defer rec.mu.Unlock()
	want := messaging.ConnectionChanged{SectorID: sectorID, Status: messaging.StatusLoggedOut}
	if len(rec.events) != 1 || rec.events[0] != want {
		t.Fatalf("events = %#v, want [%#v]", rec.events, want)
	}
}

// Shared contacts arrive as vCards, one in ContactMessage or several in
// ContactsArrayMessage; the session turns them into neutral cards, and a vCard
// it cannot read into an unsupported message, never an error.
func TestContactsBecomeNeutralCards(t *testing.T) {
	a, rec, _ := newTestAdapter(t)
	s := &session{sectorID: 7, adapter: a}
	at := time.Date(2026, 11, 21, 9, 0, 0, 0, time.UTC)

	vcard := func(lines ...string) *string {
		return proto.String("BEGIN:VCARD\r\nVERSION:3.0\r\n" + strings.Join(lines, "\r\n") + "\r\nEND:VCARD")
	}
	joao := &waE2E.ContactMessage{
		DisplayName: proto.String("João"),
		Vcard: vcard(
			"N:Silva;João;;;",
			"FN:João Silva",
			"ORG:Prefeitura de Itu;Secretaria de Saúde",
			"item1.TEL;type=CELL;waid=5511977776666:+55 11 97777-6666",
			"item1.X-ABLabel:Celular",
			"TEL;type=WORK:(11) 4022-1000",
		),
	}
	base := messaging.Message{
		ExternalContactID: contactChat.String(), Phone: "5511988887777", SentAt: at,
	}
	with := func(id string, typ messaging.MessageType, cards ...messaging.ContactCard) messaging.Message {
		m := base
		m.ExternalMessageID, m.Type, m.ContactCards = id, typ, cards
		return m
	}
	joaoCard := messaging.ContactCard{
		Name:         "João Silva",
		Organization: "Prefeitura de Itu, Secretaria de Saúde",
		Phones: []messaging.ContactPhone{
			{Phone: "5511977776666", WhatsAppID: "5511977776666"},
			{Phone: "1140221000"},
		},
	}

	cases := []struct {
		name string
		evt  *events.Message
		want messaging.Event
	}{
		{
			name: "one contact from the customer",
			evt:  incoming("CT-1", false, at, &waE2E.Message{ContactMessage: joao}),
			want: messaging.MessageReceived{SectorID: 7, Message: with("CT-1", messaging.TypeContact, joaoCard)},
		},
		{
			name: "three contacts at once, in order",
			evt: incoming("CT-2", false, at, &waE2E.Message{ContactsArrayMessage: &waE2E.ContactsArrayMessage{
				DisplayName: proto.String("3 contatos"),
				Contacts: []*waE2E.ContactMessage{
					joao,
					{DisplayName: proto.String("Maria"), Vcard: vcard(`FN:Maria\, da Contabilidade`, "TEL;waid=5521966665555:+55 21 96666-5555")},
					{DisplayName: proto.String("Pedro"), Vcard: vcard("N:Souza;Pedro;;;", "TEL:5531955554444")},
				},
			}}),
			want: messaging.MessageReceived{SectorID: 7, Message: with("CT-2", messaging.TypeContact,
				joaoCard,
				messaging.ContactCard{Name: "Maria, da Contabilidade", Phones: []messaging.ContactPhone{{Phone: "5521966665555", WhatsAppID: "5521966665555"}}},
				messaging.ContactCard{Name: "Pedro Souza", Phones: []messaging.ContactPhone{{Phone: "5531955554444"}}},
			)},
		},
		{
			name: "contact sent from the phone of the sector",
			evt:  incoming("CT-3", true, at, &waE2E.Message{ContactMessage: joao}),
			want: messaging.MessageSentOutside{SectorID: 7, Message: with("CT-3", messaging.TypeContact, joaoCard)},
		},
		{
			name: "malformed vCard",
			evt:  incoming("CT-4", false, at, &waE2E.Message{ContactMessage: &waE2E.ContactMessage{Vcard: proto.String("isto não é um vCard")}}),
			want: messaging.MessageReceived{SectorID: 7, Message: with("CT-4", messaging.TypeUnsupported)},
		},
		{
			name: "vCard cut short, without END:VCARD",
			evt: incoming("CT-6", false, at, &waE2E.Message{ContactMessage: &waE2E.ContactMessage{
				DisplayName: proto.String("João"),
				Vcard:       proto.String("BEGIN:VCARD\r\nVERSION:3.0\r\nFN:João\r\nTEL:5511977776666"),
			}}),
			want: messaging.MessageReceived{SectorID: 7, Message: with("CT-6", messaging.TypeUnsupported)},
		},
		{
			name: "vCard closed by another END",
			evt: incoming("CT-7", false, at, &waE2E.Message{ContactMessage: &waE2E.ContactMessage{
				DisplayName: proto.String("João"),
				Vcard:       proto.String("BEGIN:VCARD\r\nVERSION:3.0\r\nFN:João\r\nTEL:5511977776666\r\nEND:OUTRO"),
			}}),
			want: messaging.MessageReceived{SectorID: 7, Message: with("CT-7", messaging.TypeUnsupported)},
		},
		{
			name: "vCard without name nor phone",
			evt:  incoming("CT-5", false, at, &waE2E.Message{ContactMessage: &waE2E.ContactMessage{Vcard: vcard("ORG:Prefeitura")}}),
			want: messaging.MessageReceived{SectorID: 7, Message: with("CT-5", messaging.TypeUnsupported)},
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
}

// The neutral card goes as the ContactMessage WhatsApp Web sends: the display
// name and a vCard with the name, the phone with its waid and the
// organization with the municipality, which reads back as the same card. As
// a reply it carries the context of the quote, and a quoted card has the
// snippet contact with its name, received and sent.
func TestContactCardBecomesContactMessage(t *testing.T) {
	a, rec, _ := newTestAdapter(t)
	sector := storeDevice(t, a, "5511900001111", 3)
	device, err := a.container.GetDevice(t.Context(), sector)
	if err != nil || device == nil {
		t.Fatalf("device: %v", err)
	}
	cli := whatsmeow.NewClient(device, nil)

	card := messaging.ContactCard{
		Name:         "Carla Souza; Financeiro",
		Phones:       []messaging.ContactPhone{{Phone: "5511977776666", WhatsAppID: "551177776666"}},
		Organization: "Prefeitura de Itu — Itu",
	}
	m := contactContent(card, nil).GetContactMessage()
	if m == nil || m.GetDisplayName() != card.Name || m.GetContextInfo() != nil {
		t.Fatalf("contact message = %v", m)
	}
	wantVCard := "BEGIN:VCARD\nVERSION:3.0\nN:;Carla Souza\\; Financeiro;;;\nFN:Carla Souza\\; Financeiro\n" +
		"ORG:Prefeitura de Itu — Itu\nTEL;type=CELL;waid=551177776666:+5511977776666\nEND:VCARD"
	if m.GetVcard() != wantVCard {
		t.Fatalf("vCard = %q\nwant %q", m.GetVcard(), wantVCard)
	}
	if back, ok := contactCard(m); !ok || !reflect.DeepEqual(back, card) {
		t.Fatalf("vCard read back = %+v, want %+v", back, card)
	}
	// A phone without WhatsApp goes without waid.
	if v := vcardOf(messaging.ContactCard{Name: "Sem WhatsApp", Phones: []messaging.ContactPhone{{Phone: "551140221000"}}}); !strings.Contains(v, "\nTEL;type=CELL:+551140221000\n") || strings.Contains(v, "ORG:") {
		t.Fatalf("vCard without waid nor organization = %q", v)
	}

	// As a reply, quoting a card the sector sent.
	to := contactChat
	quote := &messaging.Quote{ExternalMessageID: "OUT-CT", FromSector: true, Snippet: &messaging.QuoteSnippet{Type: messaging.TypeContact, Text: "João Silva"}}
	reply := contactContent(card, replyContext(cli, to, quote)).GetContactMessage().GetContextInfo()
	if reply.GetStanzaID() != "OUT-CT" || reply.GetParticipant() != "5511900001111@s.whatsapp.net" ||
		reply.GetQuotedMessage().GetContactMessage().GetDisplayName() != "João Silva" {
		t.Fatalf("reply context = %v", reply)
	}
	// The quoted card reads back as the snippet it came from.
	if sn := snippet(reply.GetQuotedMessage()); !reflect.DeepEqual(sn, quote.Snippet) {
		t.Fatalf("snippet of the quoted card = %+v", sn)
	}

	// The customer quotes a card, one or several: the snippet is the name of the first.
	at := time.Date(2026, 11, 21, 9, 0, 0, 0, time.UTC)
	s := &session{sectorID: 7, adapter: a}
	quoting := func(id string, quoted *waE2E.Message) *events.Message {
		return incoming(id, false, at, &waE2E.Message{ExtendedTextMessage: &waE2E.ExtendedTextMessage{
			Text:        proto.String("Esse?"),
			ContextInfo: &waE2E.ContextInfo{StanzaID: proto.String("CT-1"), QuotedMessage: quoted},
		}})
	}
	for name, c := range map[string]struct {
		quoted *waE2E.Message
		want   string
	}{
		"one card":           {quoted: contactContent(card, nil), want: card.Name},
		"several cards":      {quoted: &waE2E.Message{ContactsArrayMessage: &waE2E.ContactsArrayMessage{Contacts: []*waE2E.ContactMessage{contactContent(messaging.ContactCard{Name: "Maria", Phones: []messaging.ContactPhone{{Phone: "5521966665555"}}}, nil).GetContactMessage(), m}}}, want: "Maria"},
		"vCard cut in quote": {quoted: &waE2E.Message{ContactMessage: &waE2E.ContactMessage{DisplayName: proto.String("Pedro")}}, want: "Pedro"},
	} {
		rec.reset()
		if !s.message(quoting("Q-"+name, c.quoted)) {
			t.Fatalf("%s: event not acknowledged", name)
		}
		rec.mu.Lock()
		got := rec.events[0].(messaging.MessageReceived).Message.Quote
		rec.mu.Unlock()
		want := &messaging.Quote{ExternalMessageID: "CT-1", Snippet: &messaging.QuoteSnippet{Type: messaging.TypeContact, Text: c.want}}
		if !reflect.DeepEqual(got, want) {
			t.Fatalf("%s: quote = %+v (snippet %+v), want snippet %+v", name, got, got.Snippet, want.Snippet)
		}
	}
}
