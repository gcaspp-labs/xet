package whatsmeow

import (
	"strings"

	"go.mau.fi/whatsmeow/proto/waE2E"

	"github.com/gcaspp-labs/xet/backend/internal/helpdesk/messaging"
)

// WhatsApp Web carries a shared contact as a vCard (3.0 in practice) in
// ContactMessage, and several at once in ContactsArrayMessage. Only the name
// (FN, or N, or the display name of the message), each phone (TEL, with its
// waid) and the organization (ORG) are read; the vCard never leaves this
// package (ADR-0001).

// contactCards reads the cards of the contacts of a message, in order. A
// vCard that cannot be read, or has neither name nor phone, is left out;
// without any card left the message is not a contact message.
func contactCards(contacts []*waE2E.ContactMessage) ([]messaging.ContactCard, bool) {
	var cards []messaging.ContactCard
	for _, c := range contacts {
		if card, ok := contactCard(c); ok {
			cards = append(cards, card)
		}
	}
	return cards, len(cards) > 0
}

// contactCard reads the vCard of a contact. The name falls back to N and
// then to the display name of the message; a card with phones but no name at
// all is named by its first phone, since the neutral card always has a name.
func contactCard(c *waE2E.ContactMessage) (messaging.ContactCard, bool) {
	props, ok := parseVCard(c.GetVcard())
	if !ok {
		return messaging.ContactCard{}, false
	}
	var card messaging.ContactCard
	var family, given string
	for _, p := range props {
		switch p.name {
		case "FN":
			if card.Name == "" {
				card.Name = strings.TrimSpace(unescape(p.value))
			}
		case "N":
			parts := splitEscaped(p.value, ';')
			if len(parts) > 0 {
				family = parts[0]
			}
			if len(parts) > 1 {
				given = parts[1]
			}
		case "TEL":
			phone := messaging.ContactPhone{Phone: digits(p.value), WhatsAppID: digits(p.params["WAID"])}
			if phone.Phone == "" {
				phone.Phone = phone.WhatsAppID
			}
			if phone.Phone != "" {
				card.Phones = append(card.Phones, phone)
			}
		case "ORG":
			if card.Organization == "" {
				card.Organization = joinNonEmpty(splitEscaped(p.value, ';'), ", ")
			}
		}
	}
	if card.Name == "" {
		card.Name = joinNonEmpty([]string{given, family}, " ")
	}
	if card.Name == "" {
		card.Name = strings.TrimSpace(c.GetDisplayName())
	}
	if card.Name == "" && len(card.Phones) > 0 {
		card.Name = card.Phones[0].Phone
	}
	return card, card.Name != ""
}

type vcardProperty struct {
	name   string
	params map[string]string
	value  string
}

// parseVCard splits a vCard into its properties, with the names and the
// parameter keys in upper case and the group (item1.TEL) dropped. Folded
// lines are joined. Without BEGIN:VCARD, or not closed by END:VCARD (cut
// short, or closed by another END), it is not a vCard.
func parseVCard(text string) ([]vcardProperty, bool) {
	text = strings.ReplaceAll(text, "\r\n", "\n")
	text = strings.ReplaceAll(text, "\n ", "")
	text = strings.ReplaceAll(text, "\n\t", "")
	var props []vcardProperty
	begun, ended := false, false
	for _, line := range strings.Split(text, "\n") {
		line = strings.TrimRight(line, "\r")
		head, value, found := strings.Cut(line, ":")
		if !found {
			continue
		}
		parts := strings.Split(head, ";")
		name := strings.ToUpper(strings.TrimSpace(parts[0]))
		if _, after, grouped := strings.Cut(name, "."); grouped {
			name = after
		}
		if name == "BEGIN" && strings.EqualFold(strings.TrimSpace(value), "VCARD") {
			begun = true
			continue
		}
		if !begun {
			continue
		}
		if name == "END" {
			ended = strings.EqualFold(strings.TrimSpace(value), "VCARD")
			break
		}
		p := vcardProperty{name: name, value: value, params: map[string]string{}}
		for _, param := range parts[1:] {
			k, v, _ := strings.Cut(param, "=")
			p.params[strings.ToUpper(strings.TrimSpace(k))] = strings.Trim(strings.TrimSpace(v), `"`)
		}
		props = append(props, p)
	}
	return props, begun && ended
}

// splitEscaped splits a structured value (N, ORG) at the separators not
// escaped with a backslash, unescaping each part.
func splitEscaped(value string, sep byte) []string {
	var parts []string
	start := 0
	for i := 0; i < len(value); i++ {
		switch value[i] {
		case '\\':
			i++
		case sep:
			parts = append(parts, strings.TrimSpace(unescape(value[start:i])))
			start = i + 1
		}
	}
	return append(parts, strings.TrimSpace(unescape(value[start:])))
}

// unescape undoes the escapes of a vCard text value.
func unescape(value string) string {
	var b strings.Builder
	for i := 0; i < len(value); i++ {
		if value[i] != '\\' || i == len(value)-1 {
			b.WriteByte(value[i])
			continue
		}
		i++
		switch value[i] {
		case 'n', 'N':
			b.WriteByte('\n')
		default:
			b.WriteByte(value[i])
		}
	}
	return b.String()
}

func digits(s string) string {
	var b strings.Builder
	for _, r := range s {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	return b.String()
}

func joinNonEmpty(parts []string, sep string) string {
	var kept []string
	for _, p := range parts {
		if p = strings.TrimSpace(p); p != "" {
			kept = append(kept, p)
		}
	}
	return strings.Join(kept, sep)
}
