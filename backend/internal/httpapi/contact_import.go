package httpapi

import (
	"net/http"

	"github.com/gcaspp-labs/xet/backend/internal/directory"
)

type savedContactResponse struct {
	Name  string `json:"name"`
	Phone string `json:"phone"`
}

// listSavedContacts shows the address book of the sector number, to choose whom to import.
func (s *server) listSavedContacts(w http.ResponseWriter, r *http.Request) {
	sectorID, ok := urlID(w, r, "sectorID", "Setor não encontrado.")
	if !ok {
		return
	}
	saved, err := directory.SavedContacts(r.Context(), s.opts.Messaging, sectorID)
	if err != nil {
		s.directoryError(w, r, err)
		return
	}
	out := make([]savedContactResponse, len(saved))
	for i, c := range saved {
		out[i] = savedContactResponse{Name: c.Name, Phone: c.Phone}
	}
	writeJSON(w, http.StatusOK, out)
}

type importContactsRequest struct {
	// Phones are the chosen entries; the names are read again by the service.
	Phones         []string `json:"phones" validate:"max=10000"`
	OrganizationID int64    `json:"organizationId"`
}

type importContactsResponse struct {
	Created     int `json:"created"`
	Existing    int `json:"existing"`
	Unavailable int `json:"unavailable"`
}

func (s *server) importContacts(w http.ResponseWriter, r *http.Request) {
	sectorID, ok := urlID(w, r, "sectorID", "Setor não encontrado.")
	if !ok {
		return
	}
	var req importContactsRequest
	if !s.decodeJSON(w, r, &req) {
		return
	}
	result, err := s.directory.ImportContacts(r.Context(), s.opts.Messaging, currentUser(r.Context()), sectorID,
		directory.ImportInput{Phones: req.Phones, OrganizationID: req.OrganizationID})
	if err != nil {
		s.directoryError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, importContactsResponse{Created: result.Created, Existing: result.Existing, Unavailable: result.Unavailable})
}
