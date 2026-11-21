package helpdesk

import (
	"context"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/gcaspp-labs/xet/backend/internal/core/auth"
	"github.com/gcaspp-labs/xet/backend/internal/core/paging"
	"github.com/gcaspp-labs/xet/backend/internal/db"
)

// ClosedTicketSortColumns are the columns of the history of Atendimentos that
// sort the list. Modules do not sort.
var ClosedTicketSortColumns = []string{"protocol", "date", "contact", "organization", "sector", "assignee", "subject", "situation"}

// ClosedTicketsFilter holds the search and the filters of the history of
// Atendimentos. ClosedFrom is the start of the first day and ClosedUntil the
// start of the day after the last one, on the office clock; either may be
// missing. There is no filter by situation: the history only has closed tickets.
type ClosedTicketsFilter struct {
	Search                  string
	ClosedFrom, ClosedUntil *time.Time
	SectorID                *int64
	AssigneeID              *int64
	Channel                 *db.TicketChannel
	Module                  string
	Subject                 string
}

// phoneSearch is a search made only of digits and the signs of a phone number.
var phoneSearch = regexp.MustCompile(`^[\d\s()+.-]+$`)

func nonEmpty(text string) *string {
	if text = strings.TrimSpace(text); text != "" {
		return &text
	}
	return nil
}

// searchDigits returns the digits of a search that looks like a phone number.
func searchDigits(search string) *string {
	if !phoneSearch.MatchString(search) {
		return nil
	}
	var digits strings.Builder
	for _, r := range search {
		if r >= '0' && r <= '9' {
			digits.WriteRune(r)
		}
	}
	return nonEmpty(digits.String())
}

// ClosedTickets lists the closed tickets the user may see (their own sector,
// or every sector for an admin) with the search, the filters and the order of
// the page. The sector, the assignee and the module are checked as in the
// dashboard: an assignee needs a sector and belongs to it. The module is a text
// the name of any module of the ticket may contain; as the module list is the
// one of a sector, it needs a sector too.
func (s *Service) ClosedTickets(ctx context.Context, actor auth.User, filter ClosedTicketsFilter, page paging.Request) ([]db.ListClosedTicketsPageRow, int64, paging.Request, error) {
	scope, err := s.checkDashboardFilter(ctx, actor, DashboardFilter{SectorID: filter.SectorID, AssigneeID: filter.AssigneeID})
	if err != nil {
		return nil, 0, page, err
	}
	module := nonEmpty(filter.Module)
	if module != nil && scope.SectorID == nil {
		return nil, 0, page, ErrInvalidDashboardFilter
	}
	search := nonEmpty(filter.Search)
	var digits *string
	if search != nil {
		digits = searchDigits(*search)
	}
	total, err := s.q.CountClosedTicketsPage(ctx, db.CountClosedTicketsPageParams{
		SectorID: scope.SectorID, AssigneeID: scope.AssigneeID, Channel: dashboardChannel(filter.Channel), Module: module,
		ClosedFrom: filter.ClosedFrom, ClosedUntil: filter.ClosedUntil,
		Subject: nonEmpty(filter.Subject), Search: search, SearchDigits: digits,
	})
	if err != nil {
		return nil, 0, page, fmt.Errorf("count closed tickets: %w", err)
	}
	page = page.Clamp(total)
	rows, err := s.q.ListClosedTicketsPage(ctx, db.ListClosedTicketsPageParams{
		SectorID: scope.SectorID, AssigneeID: scope.AssigneeID, Channel: dashboardChannel(filter.Channel), Module: module,
		ClosedFrom: filter.ClosedFrom, ClosedUntil: filter.ClosedUntil,
		Subject: nonEmpty(filter.Subject), Search: search, SearchDigits: digits,
		Sort: page.Sort, Direction: historyDirection(page), PageOffset: page.Offset(),
	})
	if err != nil {
		return nil, 0, page, fmt.Errorf("list closed tickets: %w", err)
	}
	return rows, total, page, nil
}

// ClosedTicketOptions are the options of the filters of a sector.
type ClosedTicketOptions struct {
	Assignees []db.ListDashboardAssigneesRow
	Modules   []db.Module
}

// ClosedTicketFilterOptions returns the assignees and modules of the sector the
// user may filter by. Without a sector (an admin who has not chosen one) the
// lists are empty: assignee and module wait for the sector.
func (s *Service) ClosedTicketFilterOptions(ctx context.Context, actor auth.User, sectorID *int64) (ClosedTicketOptions, error) {
	scope, err := s.checkDashboardFilter(ctx, actor, DashboardFilter{SectorID: sectorID})
	if err != nil || scope.SectorID == nil {
		return ClosedTicketOptions{}, err
	}
	assignees, err := s.q.ListDashboardAssignees(ctx, *scope.SectorID)
	if err != nil {
		return ClosedTicketOptions{}, fmt.Errorf("list assignees: %w", err)
	}
	modules, err := s.q.ListModules(ctx, *scope.SectorID)
	if err != nil {
		return ClosedTicketOptions{}, fmt.Errorf("list modules: %w", err)
	}
	return ClosedTicketOptions{Assignees: assignees, Modules: modules}, nil
}

// ClosedTicketSubjects suggests subjects of closed tickets that contain the
// text, within the sector the user may see.
func (s *Service) ClosedTicketSubjects(ctx context.Context, actor auth.User, sectorID *int64, search string) ([]string, error) {
	scope, err := s.checkDashboardFilter(ctx, actor, DashboardFilter{SectorID: sectorID})
	if err != nil {
		return nil, err
	}
	subjects, err := s.q.ListClosedTicketSubjects(ctx, db.ListClosedTicketSubjectsParams{SectorID: scope.SectorID, Search: nonEmpty(search)})
	if err != nil {
		return nil, fmt.Errorf("list closed ticket subjects: %w", err)
	}
	return subjects, nil
}
