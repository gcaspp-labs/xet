package helpdesk

import (
	"context"
	"time"
)

// SetChangeTimeout shortens the time an edit or deletion waits for the
// provider, so a test sees it run out.
func SetChangeTimeout(s *Service, d time.Duration) { s.changeTimeout = d }

// OpenTicketOfContact exposes the notice of a resume refused by the open
// ticket of the contact, so a test settles the race and reads the notice after
// the winning ticket is gone.
func OpenTicketOfContact(s *Service, ctx context.Context, ticketID int64) error {
	return s.openTicketOfContact(ctx, ticketID)
}
