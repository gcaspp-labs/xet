package helpdesk

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"

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

// encodeContactCards returns the cards of a contact message to record, in
// order. Names are trimmed and phones keep only their digits; a card without
// name and a phone without digits are left out. Without any card left, ok is
// false: the message is recorded as unsupported, as before cards were read,
// so a provider that delivers a bad card never stops the reception.
func encodeContactCards(in []messaging.ContactCard) (cards []byte, ok bool, err error) {
	var stored []storedContactCard
	for _, c := range in {
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

// cardOf returns the card of a contact of the directory to record in a
// message: the name, the phone and the organization with its municipality
// ("Órgão — Município"), never the nickname of anyone. It is taken from the
// registration at the send and recorded with the message, so changing the
// registration later does not change it. Only a registered contact with a
// phone has a card.
func (s *Service) cardOf(ctx context.Context, contactID int64) ([]byte, error) {
	c, err := s.q.GetContactWithOrganization(ctx, contactID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrUnknownContact
	}
	if err != nil {
		return nil, fmt.Errorf("get contact: %w", err)
	}
	if !c.Contact.Registered || c.Contact.Phone == nil || *c.Contact.Phone == "" {
		return nil, ErrContactNotSendable
	}
	card := messaging.ContactCard{Name: c.Contact.Name, Phones: []messaging.ContactPhone{{Phone: *c.Contact.Phone}}}
	if c.OrganizationName != nil {
		card.Organization = *c.OrganizationName
		if c.MunicipalityName != nil && *c.MunicipalityName != "" {
			card.Organization += " — " + *c.MunicipalityName
		}
	}
	cards, ok, err := encodeContactCards([]messaging.ContactCard{card})
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, ErrContactNotSendable
	}
	return cards, nil
}

// decodeContactCards reads the recorded cards as neutral cards.
func decodeContactCards(raw []byte) ([]messaging.ContactCard, error) {
	var stored []storedContactCard
	if err := json.Unmarshal(raw, &stored); err != nil {
		return nil, fmt.Errorf("decode contact cards: %w", err)
	}
	out := make([]messaging.ContactCard, len(stored))
	for i, c := range stored {
		out[i] = messaging.ContactCard{Name: c.Name}
		if c.Organization != nil {
			out[i].Organization = *c.Organization
		}
		for _, p := range c.Phones {
			phone := messaging.ContactPhone{Phone: p.Phone}
			if p.WhatsAppID != nil {
				phone.WhatsAppID = *p.WhatsAppID
			}
			out[i].Phones = append(out[i].Phones, phone)
		}
	}
	return out, nil
}

// sentCard is the recorded card of a contact message to send, read from the
// message so a retry sends the same card.
func sentCard(raw []byte) (messaging.ContactCard, error) {
	cards, err := decodeContactCards(raw)
	if err != nil {
		return messaging.ContactCard{}, err
	}
	if len(cards) == 0 {
		return messaging.ContactCard{}, errors.New("contact message without cards")
	}
	return cards[0], nil
}

// firstCardName is the name of the first card, the snippet of a quoted
// contact message.
func firstCardName(raw []byte) (string, error) {
	card, err := sentCard(raw)
	if err != nil {
		return "", fmt.Errorf("quoted contact: %w", err)
	}
	return card.Name, nil
}
