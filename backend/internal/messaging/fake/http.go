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
				body.AccountID = fmt.Sprintf("fake-account-%d", sectorID)
			}
			return a.Pair(r.Context(), sectorID, body.AccountID)
		})
	})
	r.Post("/messaging/sectors/{sectorID}/drop", func(w http.ResponseWriter, r *http.Request) {
		a.control(w, r, func(sectorID int64) error { return a.Drop(r.Context(), sectorID) })
	})
	// Text message from a contact; the contact is identified by the phone.
	r.Post("/messaging/sectors/{sectorID}/receive", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			ExternalMessageID string `json:"externalMessageId"`
			Phone             string `json:"phone"`
			ContactName       string `json:"contactName"`
			Body              string `json:"body"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.ExternalMessageID == "" || body.Phone == "" {
			http.Error(w, "externalMessageId and phone are required", http.StatusBadRequest)
			return
		}
		a.control(w, r, func(sectorID int64) error {
			return a.Receive(r.Context(), sectorID, messaging.Message{
				ExternalMessageID: body.ExternalMessageID,
				ExternalContactID: body.Phone + "@s.whatsapp.net",
				Phone:             body.Phone,
				ContactName:       body.ContactName,
				Type:              messaging.TypeText,
				Body:              body.Body,
				SentAt:            time.Now(),
			})
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
