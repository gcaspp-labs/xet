package fake

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/gcaspp-labs/xet/backend/internal/messaging"
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
	// Message from a contact, identified by the phone: a text or, with type
	// and media (content in base64), an image, video, audio or document.
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
		a.control(w, r, func(sectorID int64) error { return a.Receive(r.Context(), sectorID, msg) })
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
