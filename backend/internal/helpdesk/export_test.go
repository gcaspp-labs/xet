package helpdesk

import (
	"context"
	"time"
)

// SetChangeTimeout shortens the time an edit or deletion waits for the
// provider, so a test sees it run out.
func SetChangeTimeout(s *Service, d time.Duration) { s.changeTimeout = d }

// LookupContactPhoto runs the picture lookup of a contact outside a ticket,
// so a test reaches a contact the API does not create: without phone and
// without provider id.
func LookupContactPhoto(s *Service, ctx context.Context, sectorID, contactID int64) error {
	return s.lookupContactPhoto(ctx, sectorID, contactID)
}

// OpenTicketOfContact exposes the notice of a resume refused by the open
// ticket of the contact, so a test settles the race and reads the notice after
// the winning ticket is gone.
func OpenTicketOfContact(s *Service, ctx context.Context, ticketID int64) error {
	return s.openTicketOfContact(ctx, ticketID)
}
