package db

// AsTicket passes the result of a query that returns a ticket through,
// so it still wraps a call: AsTicket(q.GetTicket(ctx, id)).
//
// Until the #175 migration the ticket queries listed their columns one by one,
// to leave tickets.spoke_with out, and sqlc generated one row type per query;
// this function turned each of them into a Ticket. The column is gone, the
// queries return Ticket directly, and what is left is only this wrapper.
func AsTicket(row Ticket, err error) (Ticket, error) {
	return row, err
}

// AsTickets is AsTicket for a query that returns many tickets.
func AsTickets(rows []Ticket, err error) ([]Ticket, error) {
	return rows, err
}
