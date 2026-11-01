// Package realtime delivers notices of changes to the open panels. Events
// only say what changed; the panel reloads the data through the API, which
// keeps the permission checks in one place.
package realtime

import "sync"

// Queue size of each subscriber; a subscriber that falls this far behind is
// dropped and reloads everything when it reconnects.
const queueSize = 64

const (
	TypeTicket     = "ticket"
	TypeConnection = "connection"
)

// Event is a change in a sector, published after the transaction commits.
type Event struct {
	Type     string `json:"type"`
	SectorID int64  `json:"sectorId"`
	TicketID int64  `json:"ticketId,omitempty"`
}

// TicketChanged reports a ticket created, with a new message, assigned or
// transferred.
func TicketChanged(sectorID, ticketID int64) Event {
	return Event{Type: TypeTicket, SectorID: sectorID, TicketID: ticketID}
}

// ConnectionChanged reports a new connection status of the sector number.
func ConnectionChanged(sectorID int64) Event {
	return Event{Type: TypeConnection, SectorID: sectorID}
}

// Subscriber receives the events of the sectors it can access.
type Subscriber struct {
	canAccess func(sectorID int64) bool
	events    chan Event
	dropped   chan struct{}
}

// Events delivers the events in the order they were published.
func (s *Subscriber) Events() <-chan Event { return s.events }

// Dropped is closed when the subscriber fell behind and lost events.
func (s *Subscriber) Dropped() <-chan struct{} { return s.dropped }

// Hub holds the subscribers of the open connections.
type Hub struct {
	mu          sync.Mutex
	subscribers map[*Subscriber]struct{}
}

func NewHub() *Hub {
	return &Hub{subscribers: map[*Subscriber]struct{}{}}
}

// Subscribe registers a subscriber filtered by canAccess, which reports the
// sectors the user may see.
func (h *Hub) Subscribe(canAccess func(sectorID int64) bool) *Subscriber {
	s := &Subscriber{canAccess: canAccess, events: make(chan Event, queueSize), dropped: make(chan struct{})}
	h.mu.Lock()
	h.subscribers[s] = struct{}{}
	h.mu.Unlock()
	return s
}

func (h *Hub) Unsubscribe(s *Subscriber) {
	h.mu.Lock()
	delete(h.subscribers, s)
	h.mu.Unlock()
}

// Publish sends the event to the subscribers that can access its sector,
// without blocking: a subscriber with a full queue is dropped.
func (h *Hub) Publish(ev Event) {
	h.mu.Lock()
	defer h.mu.Unlock()
	for s := range h.subscribers {
		if !s.canAccess(ev.SectorID) {
			continue
		}
		select {
		case s.events <- ev:
		default:
			delete(h.subscribers, s)
			close(s.dropped)
		}
	}
}
