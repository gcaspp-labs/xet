package helpdesk

import "errors"

var (
	ErrNotFound        = errors.New("ticket not found")
	ErrForbidden       = errors.New("ticket of a sector the user cannot access")
	ErrAlreadyAssigned = errors.New("ticket already assigned to another user")
	ErrClosed          = errors.New("ticket closed")
)

var (
	ErrNotAssignee     = errors.New("user is not the assignee of the ticket")
	ErrRequestReused   = errors.New("client request id used by another message")
	ErrMessageNotFound = errors.New("message not found")
	ErrNotFailed       = errors.New("message has not failed")
	ErrMediaNotFound   = errors.New("media file not found")
	ErrInvalidAudio    = errors.New("recorded audio could not be converted")
)

var (
	ErrSectorNotFound      = errors.New("sector not found")
	ErrUnknownContact      = errors.New("contact not found")
	ErrContactWithoutPhone = errors.New("contact without phone")
)

var (
	ErrCannotTransfer = errors.New("user may not transfer the ticket")
	ErrNotInProgress  = errors.New("ticket not in progress")
	ErrInvalidTarget  = errors.New("transfer target is not an active user of the sector")
)

var (
	ErrInvalidSector = errors.New("transfer target is not another active sector")
	ErrOpenInSector  = errors.New("contact already has an open ticket in the target sector")
)

var (
	ErrContactNotRegistered = errors.New("contact of the ticket is not registered")
	ErrInvalidOrganization  = errors.New("organization not found")
	ErrInvalidModules       = errors.New("modules are not active modules of the sector")
	ErrInvalidPeriod        = errors.New("end before start or in the future")
	ErrIncompleteClosing    = errors.New("subject, resolution or modules missing")
)

var (
	ErrNotClosed      = errors.New("ticket not closed")
	ErrCannotCorrect  = errors.New("user may not correct the ticket")
	ErrReasonRequired = errors.New("reason missing")
	ErrNoChanges      = errors.New("correction changes nothing")
	ErrCancelled      = errors.New("ticket cancelled")
)

var (
	ErrInvalidSubject   = errors.New("subject name missing")
	ErrSubjectTooLong   = errors.New("subject name over the limit")
	ErrSubjectNameTaken = errors.New("subject name already in use in the sector")
	ErrSubjectNotFound  = errors.New("subject not found")
)

// ErrCannotCancel refuses an agent who is not the assignee of a ticket in progress.
var ErrCannotCancel = errors.New("user may not cancel the ticket")

// ErrCannotReturn refuses an agent who is not the assignee of the ticket.
var ErrCannotReturn = errors.New("user may not return the ticket to the queue")

// errNotQueued rolls back an assignment that found the ticket taken.
var errNotQueued = errors.New("ticket not queued")

// errDuplicate rolls back a message that a concurrent delivery recorded first.
var errDuplicate = errors.New("message already recorded")

// errOpenTicket rolls back a conversation start that found an open ticket.
var errOpenTicket = errors.New("contact has an open ticket in the sector")

// ErrInvalidDashboardFilter refuses an assignee or module of another sector or
// sent without a sector, and a sector or organization that does not exist.
var ErrInvalidDashboardFilter = errors.New("dashboard filter outside the sector or without one")
