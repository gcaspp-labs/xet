package helpdesk

import (
	"context"
	"errors"
	"fmt"
	"math"
	"slices"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/gcaspp-labs/xet/backend/internal/core/auth"
	"github.com/gcaspp-labs/xet/backend/internal/db"
)

// DashboardPeriod names a period that follows the current day.
type DashboardPeriod string

const (
	DashboardToday  DashboardPeriod = "today"
	Dashboard7Days  DashboardPeriod = "7d"
	Dashboard30Days DashboardPeriod = "30d"
)

// Days returns how many days the period covers, today included, or false for
// an unknown name.
func (p DashboardPeriod) Days() (int, bool) {
	switch p {
	case DashboardToday:
		return 1, true
	case Dashboard7Days:
		return 7, true
	case Dashboard30Days:
		return 30, true
	}
	return 0, false
}

// DashboardFilter holds the filters of the dashboard. From and To are the
// first and last days of the period, both at midnight of the office clock.
type DashboardFilter struct {
	From, To       time.Time
	SectorID       *int64
	AssigneeID     *int64
	ModuleID       *int64
	OrganizationID *int64
}

// DashboardDays returns the first and last days of a named period.
func DashboardDays(period DashboardPeriod) (from, to time.Time, ok bool) {
	days, ok := period.Days()
	if !ok {
		return time.Time{}, time.Time{}, false
	}
	now := time.Now().In(protocolZone)
	to = time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, protocolZone)
	return to.AddDate(0, 0, 1-days), to, true
}

// ParseDashboardDay reads a day of the office clock in the format YYYY-MM-DD.
func ParseDashboardDay(raw string) (time.Time, error) {
	day, err := time.ParseInLocation(time.DateOnly, raw, protocolZone)
	if err != nil {
		return time.Time{}, fmt.Errorf("parse day: %w", err)
	}
	return day, nil
}

// DashboardNumber is a number of the dashboard. Without Applicable the active
// filter does not apply to it; with Applicable and without Value, an average
// has no ticket to compute from.
type DashboardNumber struct {
	Applicable bool
	Value      *int64
}

func dashboardCount(applicable bool, value int64) DashboardNumber {
	if !applicable {
		return DashboardNumber{}
	}
	return DashboardNumber{Applicable: true, Value: &value}
}

func dashboardAverage(applicable bool, count int64, seconds float64) DashboardNumber {
	if !applicable {
		return DashboardNumber{}
	}
	if count == 0 {
		return DashboardNumber{Applicable: true}
	}
	average := int64(math.Round(seconds / float64(count)))
	return DashboardNumber{Applicable: true, Value: &average}
}

// DashboardNumbers holds the nine numbers of the dashboard.
type DashboardNumbers struct {
	Queued, InProgress, Received, Started, Resolved, Transferred, Cancelled DashboardNumber
	AverageWait, AverageHandling                                            DashboardNumber
}

// DashboardAssigneeRow is a person in a sector, in the table of the dashboard.
type DashboardAssigneeRow struct {
	SectorID                                              int64
	SectorName                                            string
	UserID                                                int64
	UserName                                              string
	InProgress, Started, Resolved, Transferred, Cancelled DashboardNumber
	AverageHandling                                       DashboardNumber
}

// DashboardResult is what the dashboard shows for a filter.
type DashboardResult struct {
	Filter    DashboardFilter
	Numbers   DashboardNumbers
	Assignees []DashboardAssigneeRow
}

// Dashboard computes the numbers for the user, within the sectors they may
// see: a supervisor always stays in their own sector, whatever the filter.
func (s *Service) Dashboard(ctx context.Context, actor auth.User, filter DashboardFilter) (DashboardResult, error) {
	filter, err := s.checkDashboardFilter(ctx, actor, filter)
	if err != nil {
		return DashboardResult{}, err
	}
	start, end := filter.From, filter.To.AddDate(0, 0, 1)

	current, err := s.q.DashboardCurrent(ctx, db.DashboardCurrentParams{
		SectorID: filter.SectorID, AssigneeID: filter.AssigneeID, OrganizationID: filter.OrganizationID,
	})
	if err != nil {
		return DashboardResult{}, fmt.Errorf("dashboard current: %w", err)
	}
	arrivals, err := s.q.DashboardArrivals(ctx, db.DashboardArrivalsParams{
		PeriodStart: start, PeriodEnd: end,
		SectorID: filter.SectorID, AssigneeID: filter.AssigneeID, OrganizationID: filter.OrganizationID,
	})
	if err != nil {
		return DashboardResult{}, fmt.Errorf("dashboard arrivals: %w", err)
	}
	wait, err := s.q.DashboardWait(ctx, db.DashboardWaitParams{
		PeriodStart: start, PeriodEnd: end, SectorID: filter.SectorID, OrganizationID: filter.OrganizationID,
	})
	if err != nil {
		return DashboardResult{}, fmt.Errorf("dashboard wait: %w", err)
	}
	closures, err := s.q.DashboardClosures(ctx, db.DashboardClosuresParams{
		PeriodStart: start, PeriodEnd: end, SectorID: filter.SectorID, AssigneeID: filter.AssigneeID,
		OrganizationID: filter.OrganizationID, ModuleID: filter.ModuleID,
	})
	if err != nil {
		return DashboardResult{}, fmt.Errorf("dashboard closures: %w", err)
	}
	rows, err := s.q.DashboardByAssignee(ctx, db.DashboardByAssigneeParams{
		PeriodStart: start, PeriodEnd: end, SectorID: filter.SectorID, AssigneeID: filter.AssigneeID,
		OrganizationID: filter.OrganizationID, ModuleID: filter.ModuleID,
	})
	if err != nil {
		return DashboardResult{}, fmt.Errorf("dashboard by assignee: %w", err)
	}

	// Which number each filter applies to: spec.md, Dashboard do atendimento.
	noAssignee, noModule := filter.AssigneeID == nil, filter.ModuleID == nil
	result := DashboardResult{
		Filter: filter,
		Numbers: DashboardNumbers{
			Queued:          dashboardCount(noAssignee && noModule, current.Queued),
			InProgress:      dashboardCount(noModule, current.InProgress),
			Received:        dashboardCount(noAssignee && noModule, arrivals.Received),
			Started:         dashboardCount(noModule, arrivals.Started),
			Resolved:        dashboardCount(true, closures.Resolved),
			Transferred:     dashboardCount(true, closures.Transferred),
			Cancelled:       dashboardCount(noModule, closures.Cancelled),
			AverageWait:     dashboardAverage(noAssignee && noModule, wait.Waited, wait.WaitSeconds),
			AverageHandling: dashboardAverage(true, closures.Handled, closures.HandlingSeconds),
		},
		Assignees: make([]DashboardAssigneeRow, len(rows)),
	}
	for i, r := range rows {
		result.Assignees[i] = DashboardAssigneeRow{
			SectorID: r.SectorID, SectorName: r.SectorName, UserID: r.UserID, UserName: r.UserName,
			InProgress:      dashboardCount(noModule, r.InProgress),
			Started:         dashboardCount(noModule, r.Started),
			Resolved:        dashboardCount(true, r.Resolved),
			Transferred:     dashboardCount(true, r.Transferred),
			Cancelled:       dashboardCount(noModule, r.Cancelled),
			AverageHandling: dashboardAverage(true, r.Handled, r.HandlingSeconds),
		}
	}
	return result, nil
}

// checkDashboardFilter settles the sector of the filter and confirms that the
// other filters belong to it.
func (s *Service) checkDashboardFilter(ctx context.Context, actor auth.User, filter DashboardFilter) (DashboardFilter, error) {
	if !actor.HasRole(db.UserRoleAdmin) {
		if filter.SectorID != nil && !actor.CanAccessSector(*filter.SectorID) {
			return filter, ErrForbidden
		}
		if actor.SectorID == nil {
			return filter, ErrForbidden
		}
		filter.SectorID = actor.SectorID
	}
	if filter.SectorID == nil {
		if filter.AssigneeID != nil || filter.ModuleID != nil {
			return filter, ErrInvalidDashboardFilter
		}
	} else if _, err := s.q.GetSector(ctx, *filter.SectorID); errors.Is(err, pgx.ErrNoRows) {
		return filter, ErrInvalidDashboardFilter
	} else if err != nil {
		return filter, fmt.Errorf("get sector: %w", err)
	}
	if filter.AssigneeID != nil {
		assignees, err := s.q.ListDashboardAssignees(ctx, *filter.SectorID)
		if err != nil {
			return filter, fmt.Errorf("list dashboard assignees: %w", err)
		}
		if !slices.ContainsFunc(assignees, func(a db.ListDashboardAssigneesRow) bool { return a.ID == *filter.AssigneeID }) {
			return filter, ErrInvalidDashboardFilter
		}
	}
	if filter.ModuleID != nil {
		found, err := s.q.DashboardModuleInSector(ctx, db.DashboardModuleInSectorParams{ID: *filter.ModuleID, SectorID: *filter.SectorID})
		if err != nil {
			return filter, fmt.Errorf("check module: %w", err)
		}
		if !found {
			return filter, ErrInvalidDashboardFilter
		}
	}
	if filter.OrganizationID != nil {
		if _, err := s.q.GetOrganization(ctx, *filter.OrganizationID); errors.Is(err, pgx.ErrNoRows) {
			return filter, ErrInvalidDashboardFilter
		} else if err != nil {
			return filter, fmt.Errorf("get organization: %w", err)
		}
	}
	return filter, nil
}

// DashboardAssignees returns the options of the assignee filter of the sector.
// The caller checks the access to the sector.
func (s *Service) DashboardAssignees(ctx context.Context, sectorID int64) ([]db.ListDashboardAssigneesRow, error) {
	if _, err := s.q.GetSector(ctx, sectorID); errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrSectorNotFound
	} else if err != nil {
		return nil, fmt.Errorf("get sector: %w", err)
	}
	rows, err := s.q.ListDashboardAssignees(ctx, sectorID)
	if err != nil {
		return nil, fmt.Errorf("list dashboard assignees: %w", err)
	}
	return rows, nil
}
