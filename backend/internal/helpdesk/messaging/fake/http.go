package fake

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/gcaspp-labs/xet/backend/internal/helpdesk/messaging"
)

// Handler exposes the test controls over HTTP, for the end-to-end tests that
// run against the server process. Mounted only with MESSAGING_PROVIDER=fake.
func (a *Adapter) Handler() http.Handler {
	r := chi.NewRouter()
	r.Post("/messaging/sectors/{sectorID}/pair", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			AccountID string `json:"accountId"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body)
		a.control(w, r, func(sectorID int64) error {
			if body.AccountID == "" {
				// Único por setor, para os testes que não tratam da recusa de número.
				body.AccountID = fmt.Sprintf("%d@s.whatsapp.net", 5511900000000+sectorID)
			}
			return a.Pair(r.Context(), sectorID, body.AccountID)
		})
	})
	r.Post("/messaging/sectors/{sectorID}/qr", func(w http.ResponseWriter, r *http.Request) {
		a.control(w, r, func(sectorID int64) error { return a.NextQR(r.Context(), sectorID) })
	})
	r.Post("/messaging/sectors/{sectorID}/drop", func(w http.ResponseWriter, r *http.Request) {
		a.control(w, r, func(sectorID int64) error { return a.Drop(r.Context(), sectorID) })
	})
	// The sends of the sector wait until release, keeping the message pending.
	r.Post("/messaging/sectors/{sectorID}/hold", func(w http.ResponseWriter, r *http.Request) {
		a.control(w, r, func(sectorID int64) error { a.Hold(sectorID); return nil })
	})
	r.Post("/messaging/sectors/{sectorID}/release", func(w http.ResponseWriter, r *http.Request) {
		a.control(w, r, func(sectorID int64) error { a.Release(sectorID); return nil })
	})
	// Message from a contact, identified by the phone: a text or, with type
	// and media (content in base64), an image, video, audio or document. An
	// optional quote cites another message by its provider ID, with or
	// without the snippet (type, text by default).
	r.Post("/messaging/sectors/{sectorID}/receive", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			ExternalMessageID string                `json:"externalMessageId"`
			Phone             string                `json:"phone"`
			ContactName       string                `json:"contactName"`
			Type              messaging.MessageType `json:"type"`
			Body              string                `json:"body"`
			Media             *struct {
				Data            []byte `json:"data"`
				MimeType        string `json:"mimeType"`
				FileName        string `json:"fileName"`
				DurationSeconds int    `json:"durationSeconds"`
			} `json:"media"`
			Quote *struct {
				ExternalMessageID string `json:"externalMessageId"`
				Snippet           *struct {
					Type messaging.MessageType `json:"type"`
					Text string                `json:"text"`
				} `json:"snippet"`
			} `json:"quote"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.ExternalMessageID == "" || body.Phone == "" {
			http.Error(w, "externalMessageId and phone are required", http.StatusBadRequest)
			return
		}
		msg := messaging.Message{
			ExternalMessageID: body.ExternalMessageID,
			ExternalContactID: body.Phone + "@s.whatsapp.net",
			Phone:             body.Phone,
			ContactName:       body.ContactName,
			Type:              messaging.TypeText,
			Body:              body.Body,
			SentAt:            time.Now(),
		}
		if body.Type != "" {
			msg.Type = body.Type
		}
		if body.Media != nil {
			msg.Media = &messaging.Media{
				Data: body.Media.Data, MimeType: body.Media.MimeType,
				FileName: body.Media.FileName, DurationSeconds: body.Media.DurationSeconds,
			}
		}
		if body.Quote != nil {
			msg.Quote = &messaging.Quote{ExternalMessageID: body.Quote.ExternalMessageID}
			if sn := body.Quote.Snippet; sn != nil {
				msg.Quote.Snippet = &messaging.QuoteSnippet{Type: messaging.TypeText, Text: sn.Text}
				if sn.Type != "" {
					msg.Quote.Snippet.Type = sn.Type
				}
			}
		}
		a.control(w, r, func(sectorID int64) error { return a.Receive(r.Context(), sectorID, msg) })
	})
	// Reaction of a contact to a message, or from the phone of the sector;
	// an empty emoji removes it.
	r.Post("/messaging/sectors/{sectorID}/react", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			TargetExternalMessageID string `json:"targetExternalMessageId"`
			Phone                   string `json:"phone"`
			Emoji                   string `json:"emoji"`
			FromSectorPhone         bool   `json:"fromSectorPhone"`
			Group                   bool   `json:"group"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.TargetExternalMessageID == "" || body.Phone == "" {
			http.Error(w, "targetExternalMessageId and phone are required", http.StatusBadRequest)
			return
		}
		ev := messaging.ReactionReceived{
			TargetExternalMessageID: body.TargetExternalMessageID,
			ExternalContactID:       body.Phone + "@s.whatsapp.net",
			Phone:                   body.Phone,
			Emoji:                   body.Emoji,
			FromSectorPhone:         body.FromSectorPhone,
			Group:                   body.Group,
		}
		a.control(w, r, func(sectorID int64) error { return a.React(r.Context(), sectorID, ev) })
	})
	// Edit of a message by the contact or, with fromSector, from the phone of
	// the sector. An optional externalEventId makes a redelivery or an echo
	// change nothing; an optional at (RFC 3339) simulates a late event.
	r.Post("/messaging/sectors/{sectorID}/edit", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			changeBody
			Body string `json:"body"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.TargetExternalMessageID == "" || body.Phone == "" {
			http.Error(w, "targetExternalMessageId and phone are required", http.StatusBadRequest)
			return
		}
		ev := messaging.MessageEdited{
			ExternalEventID: body.ExternalEventID, TargetExternalMessageID: body.TargetExternalMessageID,
			ExternalContactID: body.Phone + "@s.whatsapp.net", Phone: body.Phone,
			FromSector: body.FromSector, Body: body.Body, At: body.At,
		}
		a.control(w, r, func(sectorID int64) error { return a.Edit(r.Context(), sectorID, ev) })
	})
	// Deletion for everyone, with the same options as the edit.
	r.Post("/messaging/sectors/{sectorID}/revoke", func(w http.ResponseWriter, r *http.Request) {
		var body changeBody
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.TargetExternalMessageID == "" || body.Phone == "" {
			http.Error(w, "targetExternalMessageId and phone are required", http.StatusBadRequest)
			return
		}
		ev := messaging.MessageRevoked{
			ExternalEventID: body.ExternalEventID, TargetExternalMessageID: body.TargetExternalMessageID,
			ExternalContactID: body.Phone + "@s.whatsapp.net", Phone: body.Phone,
			FromSector: body.FromSector, At: body.At,
		}
		a.control(w, r, func(sectorID int64) error { return a.Revoke(r.Context(), sectorID, ev) })
	})
	// What the provider supports on a message already sent (windows in
	// seconds; zero = unavailable). Without a body, back to WhatsApp's.
	r.Post("/messaging/capabilities", func(w http.ResponseWriter, r *http.Request) {
		var body *struct {
			EditWindowSeconds   int  `json:"editWindowSeconds"`
			RevokeWindowSeconds int  `json:"revokeWindowSeconds"`
			ReceivesChanges     bool `json:"receivesChanges"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil && !errors.Is(err, io.EOF) {
			http.Error(w, "invalid body", http.StatusBadRequest)
			return
		}
		c := DefaultCapabilities
		if body != nil {
			c = messaging.Capabilities{
				EditWindow:      time.Duration(body.EditWindowSeconds) * time.Second,
				RevokeWindow:    time.Duration(body.RevokeWindowSeconds) * time.Second,
				ReceivesChanges: body.ReceivesChanges,
			}
		}
		a.SetCapabilities(c)
		w.WriteHeader(http.StatusNoContent)
	})
	// Delivery progress of sent messages, as the contact's phone reports it.
	r.Post("/messaging/sectors/{sectorID}/status", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Status             messaging.DeliveryStatus `json:"status"`
			ExternalMessageIDs []string                 `json:"externalMessageIds"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Status == "" {
			http.Error(w, "status is required", http.StatusBadRequest)
			return
		}
		a.control(w, r, func(sectorID int64) error {
			return a.UpdateStatus(r.Context(), sectorID, body.Status, body.ExternalMessageIDs...)
		})
	})
	// Address book of the sector number.
	r.Post("/messaging/sectors/{sectorID}/saved-contacts", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Contacts []struct {
				Name  string `json:"name"`
				Phone string `json:"phone"`
			} `json:"contacts"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, "invalid body", http.StatusBadRequest)
			return
		}
		contacts := make([]messaging.SavedContact, len(body.Contacts))
		for i, c := range body.Contacts {
			contacts[i] = messaging.SavedContact{Name: c.Name, Phone: c.Phone}
		}
		a.control(w, r, func(sectorID int64) error {
			a.SetSavedContacts(sectorID, contacts...)
			return nil
		})
	})
	// The provider refuses the next reaction of the sector.
	r.Post("/messaging/sectors/{sectorID}/fail-next-reaction", func(w http.ResponseWriter, r *http.Request) {
		a.control(w, r, func(sectorID int64) error {
			a.FailNextReaction(sectorID)
			return nil
		})
	})
	// The next edit or deletion for everyone of the sector fails: refused by
	// the provider ("refused", the default) or without a known result
	// ("uncertain", as after a timeout).
	r.Post("/messaging/sectors/{sectorID}/fail-next-change", func(w http.ResponseWriter, r *http.Request) {
		var body *struct {
			Result string `json:"result"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil && !errors.Is(err, io.EOF) {
			http.Error(w, "invalid body", http.StatusBadRequest)
			return
		}
		fail := messaging.ErrNotAccepted
		if body != nil && body.Result == "uncertain" {
			fail = context.DeadlineExceeded
		}
		a.control(w, r, func(sectorID int64) error {
			a.FailNextChange(sectorID, fail)
			return nil
		})
	})
	// The next unlink of the sector cannot reach the device.
	r.Post("/messaging/sectors/{sectorID}/unreachable", func(w http.ResponseWriter, r *http.Request) {
		a.control(w, r, func(sectorID int64) error {
			a.FailNextDisconnect(sectorID)
			return nil
		})
	})
	r.Post("/messaging/sectors/{sectorID}/logout", func(w http.ResponseWriter, r *http.Request) {
		a.control(w, r, func(sectorID int64) error { return a.LogOut(r.Context(), sectorID) })
	})
	return r
}

// changeBody is what an edit and a deletion share.
type changeBody struct {
	ExternalEventID         string    `json:"externalEventId"`
	TargetExternalMessageID string    `json:"targetExternalMessageId"`
	Phone                   string    `json:"phone"`
	FromSector              bool      `json:"fromSector"`
	At                      time.Time `json:"at"`
}

func (a *Adapter) control(w http.ResponseWriter, r *http.Request, action func(sectorID int64) error) {
	sectorID, err := strconv.ParseInt(chi.URLParam(r, "sectorID"), 10, 64)
	if err != nil {
		http.Error(w, "invalid sector", http.StatusNotFound)
		return
	}
	err = action(sectorID)
	switch {
	case errors.Is(err, ErrNotPairing):
		http.Error(w, err.Error(), http.StatusConflict)
	case err != nil:
		http.Error(w, err.Error(), http.StatusInternalServerError)
	default:
		w.WriteHeader(http.StatusNoContent)
	}
}
