package helpdesk

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gcaspp-labs/xet/backend/internal/core/auth"
	"github.com/gcaspp-labs/xet/backend/internal/core/httpx"
	"github.com/gcaspp-labs/xet/backend/internal/core/paging"
	"github.com/gcaspp-labs/xet/backend/internal/db"
)

type subjectResponse struct {
	ID       int64  `json:"id"`
	SectorID int64  `json:"sectorId"`
	Name     string `json:"name"`
	ModuleID *int64 `json:"moduleId"`
	// Solutions shown, which in a search by a solution are only the ones that
	// match, and SolutionCount, the whole list of the subject.
	Solutions     []solutionResponse `json:"solutions"`
	SolutionCount int                `json:"solutionCount"`
}

type solutionResponse struct {
	ID        int64  `json:"id"`
	SubjectID int64  `json:"subjectId"`
	Body      string `json:"body"`
}

func toSubjectResponse(s db.Subject, solutions []db.SubjectSolution) subjectResponse {
	return subjectResponse{ID: s.ID, SectorID: s.SectorID, Name: s.Name, ModuleID: s.ModuleID, Solutions: toSolutionResponses(solutions), SolutionCount: len(solutions)}
}

func toSolutionResponse(s db.SubjectSolution) solutionResponse {
	return solutionResponse{ID: s.ID, SubjectID: s.SubjectID, Body: s.Body}
}

func toSolutionResponses(solutions []db.SubjectSolution) []solutionResponse {
	out := make([]solutionResponse, len(solutions))
	for i, s := range solutions {
		out[i] = toSolutionResponse(s)
	}
	return out
}

type subjectRequest struct {
	Name     string `json:"name" validate:"required"`
	ModuleID int64  `json:"moduleId"`
}

type solutionRequest struct {
	Body string `json:"body" validate:"required"`
}

// subjectModuleFilter reads the module filter of the list: empty or "all" for
// every module, "none" for the subjects without one and the id of a module of
// the sector for the ones in it.
func subjectModuleFilter(w http.ResponseWriter, r *http.Request) (filter SubjectFilter, ok bool) {
	module := r.URL.Query().Get("moduleId")
	switch module {
	case "", "all":
		return filter, true
	case "none":
		filter.Unclassified = true
		return filter, true
	}
	moduleID, err := strconv.ParseInt(module, 10, 64)
	if err != nil || moduleID <= 0 {
		httpx.WriteError(w, http.StatusUnprocessableEntity, "Escolha um módulo válido.")
		return filter, false
	}
	filter.ModuleID = moduleID
	return filter, true
}

// listSubjects returns a page of the subject list of the sector, with the search
// in ?q=, the module filter in ?moduleId= and the page and order of every list.
func (h *Handler) listSubjects(w http.ResponseWriter, r *http.Request) {
	sectorID, ok := httpx.URLID(w, r, "sectorID", "Setor não encontrado.")
	if !ok {
		return
	}
	filter, ok := subjectModuleFilter(w, r)
	if !ok {
		return
	}
	filter.Query = r.URL.Query().Get("q")
	subjects, total, page, err := h.service.SearchSubjects(r.Context(), sectorID, filter,
		paging.Parse(r, SubjectSortColumns, SortSubjectName, false))
	if err != nil {
		httpx.InternalError(h.logger, w, r, err)
		return
	}
	out := make([]subjectResponse, len(subjects))
	for i, s := range subjects {
		out[i] = subjectResponse{ID: s.ID, SectorID: s.SectorID, Name: s.Name, ModuleID: s.ModuleID,
			Solutions: toSolutionResponses(s.Solutions), SolutionCount: s.SolutionCount}
	}
	httpx.WriteJSON(w, http.StatusOK, paging.NewPage(out, total, page))
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
	s, err := h.service.CreateSubject(r.Context(), auth.CurrentUser(r.Context()).ID, sectorID, req.ModuleID, req.Name)
	if err != nil {
		h.subjectError(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, toSubjectResponse(s, nil))
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
	s, err := h.service.UpdateSubject(r.Context(), auth.CurrentUser(r.Context()).ID, sectorID, subjectID, req.ModuleID, req.Name)
	if err != nil {
		h.subjectError(w, r, err)
		return
	}
	solutions, err := h.service.Solutions(r.Context(), s.ID)
	if err != nil {
		httpx.InternalError(h.logger, w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, toSubjectResponse(s, solutions))
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

// solutionIDs reads the sector, the subject and, with withSolution, the
// solution of the route.
func solutionIDs(w http.ResponseWriter, r *http.Request, withSolution bool) (sectorID, subjectID, solutionID int64, ok bool) {
	if sectorID, ok = httpx.URLID(w, r, "sectorID", "Setor não encontrado."); !ok {
		return
	}
	if subjectID, ok = httpx.URLID(w, r, "subjectID", "Assunto não encontrado."); !ok {
		return
	}
	if withSolution {
		solutionID, ok = httpx.URLID(w, r, "solutionID", "Solução não encontrada.")
	}
	return
}

func (h *Handler) createSolution(w http.ResponseWriter, r *http.Request) {
	sectorID, subjectID, _, ok := solutionIDs(w, r, false)
	if !ok {
		return
	}
	var req solutionRequest
	if !httpx.DecodeJSON(w, r, &req) {
		return
	}
	s, err := h.service.CreateSolution(r.Context(), auth.CurrentUser(r.Context()).ID, sectorID, subjectID, req.Body)
	if err != nil {
		h.subjectError(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, toSolutionResponse(s))
}

func (h *Handler) updateSolution(w http.ResponseWriter, r *http.Request) {
	sectorID, subjectID, solutionID, ok := solutionIDs(w, r, true)
	if !ok {
		return
	}
	var req solutionRequest
	if !httpx.DecodeJSON(w, r, &req) {
		return
	}
	s, err := h.service.UpdateSolution(r.Context(), auth.CurrentUser(r.Context()).ID, sectorID, subjectID, solutionID, req.Body)
	if err != nil {
		h.subjectError(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, toSolutionResponse(s))
}

func (h *Handler) deleteSolution(w http.ResponseWriter, r *http.Request) {
	sectorID, subjectID, solutionID, ok := solutionIDs(w, r, true)
	if !ok {
		return
	}
	if err := h.service.DeleteSolution(r.Context(), auth.CurrentUser(r.Context()).ID, sectorID, subjectID, solutionID); err != nil {
		h.subjectError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) subjectError(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, ErrInvalidModules):
		httpx.WriteError(w, http.StatusUnprocessableEntity, "Escolha um módulo ativo do setor.")
	case errors.Is(err, ErrInvalidSubject):
		httpx.WriteError(w, http.StatusUnprocessableEntity, "Informe o nome do assunto.")
	case errors.Is(err, ErrSubjectTooLong):
		httpx.WriteError(w, http.StatusUnprocessableEntity, "O assunto pode ter até 500 caracteres.")
	case errors.Is(err, ErrSubjectNameTaken):
		httpx.WriteError(w, http.StatusConflict, "Já existe um assunto com este nome neste setor.")
	case errors.Is(err, ErrSubjectNotFound):
		httpx.WriteError(w, http.StatusNotFound, "Assunto não encontrado.")
	case errors.Is(err, ErrInvalidSolution):
		httpx.WriteError(w, http.StatusUnprocessableEntity, "Informe o texto da solução.")
	case errors.Is(err, ErrSolutionTooLong):
		httpx.WriteError(w, http.StatusUnprocessableEntity, "A solução pode ter até 10.000 caracteres.")
	case errors.Is(err, ErrSolutionTaken):
		httpx.WriteError(w, http.StatusConflict, "Esta solução já está na lista deste assunto.")
	case errors.Is(err, ErrSolutionNotFound):
		httpx.WriteError(w, http.StatusNotFound, "Solução não encontrada.")
	case errors.Is(err, ErrSectorNotFound):
		httpx.WriteError(w, http.StatusNotFound, "Setor não encontrado.")
	default:
		httpx.InternalError(h.logger, w, r, err)
	}
}
