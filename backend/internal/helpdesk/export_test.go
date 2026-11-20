package helpdesk

import "time"

// SetChangeTimeout shortens the time an edit or deletion waits for the
// provider, so a test sees it run out.
func SetChangeTimeout(s *Service, d time.Duration) { s.changeTimeout = d }
