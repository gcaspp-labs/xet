package helpdesk

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/gcaspp-labs/xet/backend/internal/helpdesk/messaging"
)

// storedContactCard is a card of a contact message as messages.contact_cards
// keeps it (docs/data-model.md): what came in the message, with no link to the
// contacts of the system.
type storedContactCard struct {
	Name         string               `json:"name"`
	Organization *string              `json:"organization"`
	Phones       []storedContactPhone `json:"phones"`
}

type storedContactPhone struct {
	Phone      string  `json:"phone"`
	WhatsAppID *string `json:"wa_id"`
}

// contactCardsOf returns the cards of a contact message to record, in order.
// Names are trimmed and phones keep only their digits; a card without name and
// a phone without digits are left out. Without any card left, ok is false:
// the message is recorded as unsupported, as before cards were read, so a
// provider that delivers a bad card never stops the reception.
func contactCardsOf(msg messaging.Message) (cards []byte, ok bool, err error) {
	var stored []storedContactCard
	for _, c := range msg.ContactCards {
		card := storedContactCard{
			Name:         strings.TrimSpace(c.Name),
			Organization: optional(strings.TrimSpace(c.Organization)),
			Phones:       []storedContactPhone{},
		}
		for _, p := range c.Phones {
			phone := onlyDigits(p.Phone)
			if phone == "" {
				continue
			}
			card.Phones = append(card.Phones, storedContactPhone{Phone: phone, WhatsAppID: optional(onlyDigits(p.WhatsAppID))})
		}
		if card.Name != "" {
			stored = append(stored, card)
		}
	}
	if len(stored) == 0 {
		return nil, false, nil
	}
	cards, err = json.Marshal(stored)
	if err != nil {
		return nil, false, fmt.Errorf("encode contact cards: %w", err)
	}
	return cards, true, nil
}

// contactCardResponse is a card of a contact message in the API.
type contactCardResponse struct {
	Name         string                 `json:"name"`
	Organization *string                `json:"organization"`
	Phones       []contactPhoneResponse `json:"phones"`
}

type contactPhoneResponse struct {
	Phone      string  `json:"phone"`
	WhatsAppID *string `json:"whatsAppId"`
}

// contactCardsResponse reads the recorded cards; nil without cards.
func contactCardsResponse(raw []byte) ([]contactCardResponse, error) {
	if raw == nil {
		return nil, nil
	}
	var stored []storedContactCard
	if err := json.Unmarshal(raw, &stored); err != nil {
		return nil, fmt.Errorf("decode contact cards: %w", err)
	}
	out := make([]contactCardResponse, len(stored))
	for i, c := range stored {
		out[i] = contactCardResponse{Name: c.Name, Organization: c.Organization, Phones: make([]contactPhoneResponse, len(c.Phones))}
		for j, p := range c.Phones {
			out[i].Phones[j] = contactPhoneResponse(p)
		}
	}
	return out, nil
}

func onlyDigits(s string) string {
	var b strings.Builder
	for _, r := range s {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	return b.String()
}
