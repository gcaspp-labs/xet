package helpdesk

import "errors"

var (
	ErrNotFound        = errors.New("ticket not found")
	ErrForbidden       = errors.New("ticket of a sector the user cannot access")
	ErrAlreadyAssigned = errors.New("ticket already assigned to another user")
	ErrClosed          = errors.New("ticket closed")
	// ErrPending refuses acting on a pending ticket: it is resumed first.
	ErrPending = errors.New("ticket pending")
	// ErrNotPending refuses resuming a ticket that is not pending.
	ErrNotPending = errors.New("ticket not pending")
	// ErrPendingMismatch refuses resuming a pending ticket of another contact
	// or sector from a new ticket.
	ErrPendingMismatch = errors.New("pending ticket of another contact or sector")
	// ErrResumeRaced refuses a resume when the ticket that won the dispute of
	// the contact is no longer open at the new reading: it is rare, and trying
	// again resumes the pending ticket.
	ErrResumeRaced = errors.New("ticket that won the resume is no longer open")
)

// OpenTicketError refuses resuming a pending ticket while the contact has a
// ticket in the queue or in progress in the sector (#334). It carries the
// protocol and, when someone holds it, the assignee, for the notice.
type OpenTicketError struct {
	Protocol     string
	AssigneeName *string
}

func (e *OpenTicketError) Error() string {
	if e.AssigneeName != nil {
		return "contact has the open ticket " + e.Protocol + " with " + *e.AssigneeName
	}
	return "contact has the open ticket " + e.Protocol + " in the queue"
}

// Message is the notice shown on the screen.
func (e *OpenTicketError) Message() string {
	if e.AssigneeName != nil {
		return "Este contato tem o chamado " + e.Protocol + " aberto com " + *e.AssigneeName +
			". Encerre esse chamado ou use Retomar chamado a partir dele."
	}
	return "Este contato tem o chamado " + e.Protocol + " na fila. Encerre esse chamado ou use Retomar chamado a partir dele."
}

var (
	ErrNotAssignee     = errors.New("user is not the assignee of the ticket")
	ErrRequestReused   = errors.New("client request id used by another message")
	ErrMessageNotFound = errors.New("message not found")
	ErrNotFailed       = errors.New("message has not failed")
	ErrMediaNotFound   = errors.New("media file not found")
	ErrInvalidAudio    = errors.New("recorded audio could not be converted")
	// ErrNotQuotable is a quote of a message the agent may not cite: of
	// another ticket, unknown, still sending, failed or unsupported.
	ErrNotQuotable = errors.New("message cannot be quoted")
)

var (
	ErrSectorNotFound      = errors.New("sector not found")
	ErrUnknownContact      = errors.New("contact not found")
	ErrContactWithoutPhone = errors.New("contact without phone")
	// ErrContactNotSendable is a contact that cannot go as a card: not
	// registered in the directory, or without phone.
	ErrContactNotSendable = errors.New("contact cannot be sent as a card")
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
	ErrTransferred    = errors.New("ticket transferred to another sector")
	// ErrPhoneNotMergeable refuses merging a ticket registered by phone into a
	// pending one: it is born closed as resolved, and the merge would leave it
	// merged (#440).
	ErrPhoneNotMergeable = errors.New("phone ticket is not merged into a pending one")
	// ErrPendingAfterClosed refuses merging a closed ticket into a pending one
	// that only started after it ended: the closed ticket continues in the
	// pending, not the other way around (#440).
	ErrPendingAfterClosed = errors.New("pending ticket started after the closed one ended")
	// ErrMerged refuses correcting a ticket that was merged into another: it
	// keeps no subject nor resolution, and the link is not undone.
	ErrMerged = errors.New("ticket merged into another")
)

var (
	ErrInvalidSubject   = errors.New("subject name missing")
	ErrSubjectTooLong   = errors.New("subject name over the limit")
	ErrSubjectNameTaken = errors.New("subject name already in use in the sector")
	ErrSubjectNotFound  = errors.New("subject not found")

	ErrInvalidSolution  = errors.New("solution text missing")
	ErrSolutionTooLong  = errors.New("solution text over the limit")
	ErrSolutionTaken    = errors.New("solution already on the list of the subject")
	ErrSolutionNotFound = errors.New("solution not found")
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
