package db

import "time"

// ticketColumns are the ticket columns the app reads. The queries in
// db/queries/tickets.sql list them one by one (no "select *" or "returning *"),
// so the tickets.spoke_with column is not touched by any query and can be
// dropped later without breaking the binary. sqlc then generates one row type
// per query; they all have these fields, and AsTicket turns any of them into
// the Ticket the rest of the code uses (SpokeWith stays empty).
type ticketColumns struct {
	ID               int64
	Protocol         string
	SectorID         int64
	ContactID        int64
	OrganizationID   *int64
	AssigneeID       *int64
	Status           TicketStatus
	PreviousTicketID *int64
	CreatedByID      *int64
	ArrivedAt        time.Time
	AssignedAt       *time.Time
	StartedAt        time.Time
	EndedAt          *time.Time
	ClosedAt         *time.Time
	ClosedByID       *int64
	ClosureType      NullClosureType
	Subject          *string
	Resolution       *string
	CreatedAt        time.Time
	UpdatedAt        time.Time
}

// TicketRow is any row type generated for a query that returns a ticket.
type TicketRow interface {
	GetOpenTicketForUpdateRow | CreateQueuedTicketRow | GetTicketRow | AssignTicketRow |
		GetTicketForUpdateRow | CreateStartedTicketRow | TransferTicketRow | ReturnTicketToQueueRow |
		CloseTicketRow | CancelTicketRow | GetOpenTicketsOfContactForUpdateRow |
		SetTicketOrganizationRow | CorrectTicketRow | CreateTransferredTicketRow
}

// AsTicket converts the row of a ticket query to a Ticket, passing the error
// through, so it wraps a call: AsTicket(q.GetTicket(ctx, id)).
func AsTicket[R TicketRow](row R, err error) (Ticket, error) {
	return ticketOf(row), err
}

// AsTickets is AsTicket for a query that returns many tickets.
func AsTickets[R TicketRow](rows []R, err error) ([]Ticket, error) {
	if rows == nil {
		return nil, err
	}
	tickets := make([]Ticket, len(rows))
	for i, row := range rows {
		tickets[i] = ticketOf(row)
	}
	return tickets, err
}

func ticketOf[R TicketRow](row R) Ticket {
	c := ticketColumns(row)
	return Ticket{
		ID: c.ID, Protocol: c.Protocol, SectorID: c.SectorID, ContactID: c.ContactID,
		OrganizationID: c.OrganizationID, AssigneeID: c.AssigneeID, Status: c.Status,
		PreviousTicketID: c.PreviousTicketID, CreatedByID: c.CreatedByID,
		ArrivedAt: c.ArrivedAt, AssignedAt: c.AssignedAt, StartedAt: c.StartedAt,
		EndedAt: c.EndedAt, ClosedAt: c.ClosedAt, ClosedByID: c.ClosedByID,
		ClosureType: c.ClosureType, Subject: c.Subject, Resolution: c.Resolution,
		CreatedAt: c.CreatedAt, UpdatedAt: c.UpdatedAt,
	}
}
