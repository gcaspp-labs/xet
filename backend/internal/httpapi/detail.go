package httpapi

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
	SpokeWith    *string                 `json:"spokeWith"`
	ArrivedAt    time.Time               `json:"arrivedAt"`
	AssignedAt   *time.Time              `json:"assignedAt"`
	StartedAt    time.Time               `json:"startedAt"`
	EndedAt      *time.Time              `json:"endedAt"`
	ClosedAt     *time.Time              `json:"closedAt"`
	Subject      *string                 `json:"subject"`
	Resolution   *string                 `json:"resolution"`
	Contact      ticketContactResponse   `json:"contact"`
	Organization *httpx.Ref              `json:"organization"`
	Assignee     *httpx.Ref              `json:"assignee"`
	ClosedBy     *httpx.Ref              `json:"closedBy"`
	ClosureType  *db.ClosureType         `json:"closureType"`
	Previous     *previousTicketResponse `json:"previous"`
	Next         *nextTicketResponse     `json:"next"`
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
}

// nextTicketResponse is the ticket the origin was transferred to; the origin
// sees its sector and protocol only.
type nextTicketResponse struct {
	Protocol   string `json:"protocol"`
	SectorName string `json:"sectorName"`
}

func (s *server) getTicket(w http.ResponseWriter, r *http.Request) {
	ticketID, ok := urlTicketID(w, r)
	if !ok {
		return
	}
	t, err := s.tickets.Detail(r.Context(), auth.CurrentUser(r.Context()), ticketID)
	if err != nil {
		s.ticketError(w, r, err)
		return
	}
	out := ticketDetailResponse{
		ID: t.ID, Protocol: t.Protocol, Status: t.Status,
		Sector:    httpx.Ref{ID: t.SectorID, Name: t.SectorName},
		SpokeWith: t.SpokeWith, ArrivedAt: t.ArrivedAt, AssignedAt: t.AssignedAt,
		StartedAt: t.StartedAt, EndedAt: t.EndedAt, ClosedAt: t.ClosedAt,
		Subject: t.Subject, Resolution: t.Resolution,
		Contact: ticketContactResponse{ID: t.ContactID, Name: t.ContactName, Phone: t.ContactPhone, Registered: t.ContactRegistered},
	}
	if t.OrganizationID != nil && t.OrganizationName != nil {
		out.Organization = &httpx.Ref{ID: *t.OrganizationID, Name: *t.OrganizationName}
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
		}
	}
	if t.NextProtocol != nil && t.NextSectorName != nil {
		out.Next = &nextTicketResponse{Protocol: *t.NextProtocol, SectorName: *t.NextSectorName}
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}
