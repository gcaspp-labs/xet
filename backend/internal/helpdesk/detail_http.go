package helpdesk

import (
	"net/http"
	"time"

	"github.com/gcaspp-labs/xet/backend/internal/core/auth"
	"github.com/gcaspp-labs/xet/backend/internal/core/httpx"
	"github.com/gcaspp-labs/xet/backend/internal/db"
)

type ticketDetailResponse struct {
	ID           int64                   `json:"id"`
	Protocol     string                  `json:"protocol"`
	Status       db.TicketStatus         `json:"status"`
	Sector       httpx.Ref               `json:"sector"`
	ArrivedAt    time.Time               `json:"arrivedAt"`
	AssignedAt   *time.Time              `json:"assignedAt"`
	StartedAt    time.Time               `json:"startedAt"`
	EndedAt      *time.Time              `json:"endedAt"`
	ClosedAt     *time.Time              `json:"closedAt"`
	Subject      *string                 `json:"subject"`
	Resolution   *string                 `json:"resolution"`
	Contact      ticketContactResponse   `json:"contact"`
	Organization *httpx.OrganizationRef  `json:"organization"`
	Assignee     *httpx.Ref              `json:"assignee"`
	ClosedBy     *httpx.Ref              `json:"closedBy"`
	ClosureType  *db.ClosureType         `json:"closureType"`
	Channel      db.TicketChannel        `json:"channel"`
	Previous     *previousTicketResponse `json:"previous"`
	Next         *nextTicketResponse     `json:"next"`
	Pending      *pendingDetailResponse  `json:"pending"`
	// PendingTickets are the pendings of the same contact and sector: for a
	// ticket in progress, the notice and the window of resuming one from it
	// (#335, spec #332); for a closed one that may be merged, the choices of
	// the merge (#341, spec #332).
	PendingTickets []pendingChoiceResponse `json:"pendingTickets,omitempty"`
	// CanMergeIntoPending tells whether the user may merge this closed ticket
	// into a pending one of the same contact and sector; only then the choices
	// come (#341, spec #332).
	CanMergeIntoPending bool `json:"canMergeIntoPending,omitempty"`
	// MergedInto is the ticket this one was merged into; only on a merged one.
	MergedInto *mergedTicketResponse `json:"mergedInto,omitempty"`
}

// pendingChoiceResponse is a pending ticket the user may resume from a new
// ticket: enough to choose it without opening it.
type pendingChoiceResponse struct {
	ID       int64     `json:"id"`
	Protocol string    `json:"protocol"`
	Reason   string    `json:"reason"`
	By       httpx.Ref `json:"by"`
	At       time.Time `json:"at"`
}

// mergedTicketResponse is the ticket a merged one went to.
type mergedTicketResponse struct {
	ID       int64           `json:"id"`
	Protocol string          `json:"protocol"`
	Status   db.TicketStatus `json:"status"`
}

// pendingDetailResponse is why the ticket is pending, who marked it and
// when; only while the ticket is pending.
type pendingDetailResponse struct {
	Reason string    `json:"reason"`
	By     httpx.Ref `json:"by"`
	At     time.Time `json:"at"`
}

// previousTicketResponse is the ticket of the origin sector, read by the
// destination of a transfer between sectors.
type previousTicketResponse struct {
	ID         int64   `json:"id"`
	Protocol   string  `json:"protocol"`
	SectorName string  `json:"sectorName"`
	Subject    *string `json:"subject"`
	Resolution *string `json:"resolution"`
	ClosedBy   *string `json:"closedByName"`
	// Reason is the one written in the transfer, if any.
	Reason *string `json:"reason"`
}

// nextTicketResponse is the ticket the origin was transferred to; the origin
// sees its sector and protocol, and the reason it wrote, only.
type nextTicketResponse struct {
	Protocol   string  `json:"protocol"`
	SectorName string  `json:"sectorName"`
	Reason     *string `json:"reason"`
}

func (h *Handler) getTicket(w http.ResponseWriter, r *http.Request) {
	ticketID, ok := urlTicketID(w, r)
	if !ok {
		return
	}
	t, err := h.service.Detail(r.Context(), auth.CurrentUser(r.Context()), ticketID)
	if err != nil {
		h.ticketError(w, r, err)
		return
	}
	out := ticketDetailResponse{
		ID: t.ID, Protocol: t.Protocol, Status: t.Status, Channel: t.Channel,
		Sector:    httpx.Ref{ID: t.SectorID, Name: t.SectorName},
		ArrivedAt: t.ArrivedAt, AssignedAt: t.AssignedAt,
		StartedAt: t.StartedAt, EndedAt: t.EndedAt, ClosedAt: t.ClosedAt,
		Subject: t.Subject, Resolution: t.Resolution,
		Contact: ticketContactResponse{ID: t.ContactID, Name: t.ContactName, Phone: t.ContactPhone, Registered: t.ContactRegistered},
	}
	if t.OrganizationID != nil && t.OrganizationName != nil && t.MunicipalityID != nil && t.MunicipalityName != nil {
		out.Organization = &httpx.OrganizationRef{
			ID: *t.OrganizationID, Name: *t.OrganizationName,
			Municipality: httpx.Ref{ID: *t.MunicipalityID, Name: *t.MunicipalityName},
		}
	}
	if t.AssigneeID != nil && t.AssigneeName != nil {
		out.Assignee = &httpx.Ref{ID: *t.AssigneeID, Name: *t.AssigneeName}
	}
	if t.ClosedByID != nil && t.ClosedByName != nil {
		out.ClosedBy = &httpx.Ref{ID: *t.ClosedByID, Name: *t.ClosedByName}
	}
	if t.ClosureType.Valid {
		out.ClosureType = &t.ClosureType.ClosureType
	}
	if t.PreviousID != nil && t.PreviousProtocol != nil && t.PreviousSectorName != nil {
		out.Previous = &previousTicketResponse{
			ID: *t.PreviousID, Protocol: *t.PreviousProtocol, SectorName: *t.PreviousSectorName,
			Subject: t.PreviousSubject, Resolution: t.PreviousResolution, ClosedBy: t.PreviousClosedByName,
			Reason: t.PreviousTransferReason,
		}
	}
	if t.NextProtocol != nil && t.NextSectorName != nil {
		out.Next = &nextTicketResponse{Protocol: *t.NextProtocol, SectorName: *t.NextSectorName, Reason: t.NextTransferReason}
	}
	if t.Status == db.TicketStatusPending && t.PendingReason != nil && t.PendingByID != nil && t.PendingByName != nil && t.PendingAt != nil {
		out.Pending = &pendingDetailResponse{
			Reason: *t.PendingReason, By: httpx.Ref{ID: *t.PendingByID, Name: *t.PendingByName}, At: *t.PendingAt,
		}
	}
	if t.MergedIntoID != nil && t.MergedIntoProtocol != nil && t.MergedIntoStatus.Valid {
		out.MergedInto = &mergedTicketResponse{
			ID: *t.MergedIntoID, Protocol: *t.MergedIntoProtocol, Status: t.MergedIntoStatus.TicketStatus,
		}
	}
	// O chamado em atendimento ou na fila traz os pendentes do mesmo contato e
	// setor, para a tela avisar e oferecer Retomar chamado (#335 e #338, spec
	// #332: na fila só o aviso, sem a ação); o encerrado ou cancelado que o
	// usuário pode mesclar traz os mesmos pendentes, como as escolhas da janela
	// Mesclar em pendente (#341, spec #332).
	mergeable := mayMergeIntoPending(t, auth.CurrentUser(r.Context()))
	if t.Status == db.TicketStatusInProgress || t.Status == db.TicketStatusQueued || mergeable {
		out.CanMergeIntoPending = mergeable
		rows, err := h.service.PendingOfContact(r.Context(), t.ContactID, t.SectorID)
		if err != nil {
			h.ticketError(w, r, err)
			return
		}
		out.PendingTickets = pendingChoices(rows)
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}

// pendingChoices turns the pendings of the contact into the choices of the
// screen: the notice of a ticket in progress and the window of the merge of a
// closed one (#335 and #341, spec #332).
func pendingChoices(rows []db.ListPendingTicketsOfContactInSectorRow) []pendingChoiceResponse {
	out := make([]pendingChoiceResponse, len(rows))
	for i, row := range rows {
		item := pendingChoiceResponse{ID: row.ID, Protocol: row.Protocol}
		if row.PendingReason != nil {
			item.Reason = *row.PendingReason
		}
		if row.PendingByID != nil {
			item.By = httpx.Ref{ID: *row.PendingByID, Name: row.PendingByName}
		}
		if row.PendingAt != nil {
			item.At = *row.PendingAt
		}
		out[i] = item
	}
	return out
}
