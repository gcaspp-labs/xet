package helpdesk

import (
	"errors"
	"net/http"

	"github.com/gcaspp-labs/xet/backend/internal/core/auth"
	"github.com/gcaspp-labs/xet/backend/internal/core/httpx"
	"github.com/gcaspp-labs/xet/backend/internal/db"
)

type subjectResponse struct {
	ID       int64  `json:"id"`
	SectorID int64  `json:"sectorId"`
	Name     string `json:"name"`
}

func toSubjectResponse(s db.Subject) subjectResponse {
	return subjectResponse{ID: s.ID, SectorID: s.SectorID, Name: s.Name}
}

type subjectRequest struct {
	Name string `json:"name" validate:"required"`
}

func (h *Handler) listSubjects(w http.ResponseWriter, r *http.Request) {
	sectorID, ok := httpx.URLID(w, r, "sectorID", "Setor não encontrado.")
	if !ok {
		return
	}
	subjects, err := h.service.Subjects(r.Context(), sectorID)
	if err != nil {
		httpx.InternalError(h.logger, w, r, err)
		return
	}
	out := make([]subjectResponse, len(subjects))
	for i, s := range subjects {
		out[i] = toSubjectResponse(s)
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}

func (h *Handler) createSubject(w http.ResponseWriter, r *http.Request) {
	sectorID, ok := httpx.URLID(w, r, "sectorID", "Setor não encontrado.")
	if !ok {
		return
	}
	var req subjectRequest
	if !httpx.DecodeJSON(w, r, &req) {
		return
	}
	s, err := h.service.CreateSubject(r.Context(), auth.CurrentUser(r.Context()).ID, sectorID, req.Name)
	if err != nil {
		h.subjectError(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, toSubjectResponse(s))
}

func (h *Handler) updateSubject(w http.ResponseWriter, r *http.Request) {
	sectorID, ok := httpx.URLID(w, r, "sectorID", "Setor não encontrado.")
	if !ok {
		return
	}
	subjectID, ok := httpx.URLID(w, r, "subjectID", "Assunto não encontrado.")
	if !ok {
		return
	}
	var req subjectRequest
	if !httpx.DecodeJSON(w, r, &req) {
		return
	}
	s, err := h.service.UpdateSubject(r.Context(), auth.CurrentUser(r.Context()).ID, sectorID, subjectID, req.Name)
	if err != nil {
		h.subjectError(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, toSubjectResponse(s))
}

func (h *Handler) deleteSubject(w http.ResponseWriter, r *http.Request) {
	sectorID, ok := httpx.URLID(w, r, "sectorID", "Setor não encontrado.")
	if !ok {
		return
	}
	subjectID, ok := httpx.URLID(w, r, "subjectID", "Assunto não encontrado.")
	if !ok {
		return
	}
	if err := h.service.DeleteSubject(r.Context(), auth.CurrentUser(r.Context()).ID, sectorID, subjectID); err != nil {
		h.subjectError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) subjectError(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, ErrInvalidSubject):
		httpx.WriteError(w, http.StatusUnprocessableEntity, "Informe o nome do assunto.")
	case errors.Is(err, ErrSubjectTooLong):
		httpx.WriteError(w, http.StatusUnprocessableEntity, "O assunto pode ter até 500 caracteres.")
	case errors.Is(err, ErrSubjectNameTaken):
		httpx.WriteError(w, http.StatusConflict, "Já existe um assunto com este nome neste setor.")
	case errors.Is(err, ErrSubjectNotFound):
		httpx.WriteError(w, http.StatusNotFound, "Assunto não encontrado.")
	case errors.Is(err, ErrSectorNotFound):
		httpx.WriteError(w, http.StatusNotFound, "Setor não encontrado.")
	default:
		httpx.InternalError(h.logger, w, r, err)
	}
}
