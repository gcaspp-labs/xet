# Testes de integração do dashboard

Commit: `143e165648781335e66799e8cabbe825b85ddb61`.

Comando: `PATH=/snap/docker/current/bin:$PATH DOCKER_HOST=unix:///var/run/docker.sock go test -race -count=1 -parallel=2 -run '^TestDashboard' -v ./internal/helpdesk` (em backend/).

14 testes passaram; PostgreSQL real e isolado via testcontainers; sem cache.

```text
--- PASS: TestDashboardCountsTransferInOriginAndDestination (18.00s)
--- PASS: TestDashboardAppliesEachFilterToTheNumbersItFits (18.41s)
--- PASS: TestDashboardReflectsCorrections (12.85s)
--- PASS: TestDashboardAssigneeOptions (15.37s)
--- PASS: TestDashboardRefusesInvalidFilters (12.37s)
--- PASS: TestDashboardNamedPeriodsCountToday (12.39s)
--- PASS: TestDashboardTellsReceivedFromStarted (12.90s)
--- PASS: TestDashboardPutsEachNumberInThePeriodByItsDate (13.71s)
--- PASS: TestDashboardWaitCountsOnlyTheFirstTimeInTheQueue (13.12s)
--- PASS: TestDashboardPermissions (12.83s)
--- PASS: TestDashboardHandlingTimeUsesTheAssignmentAndTheEnd (13.35s)
--- PASS: TestDashboardTableHasOneRowPerPersonAndSector (12.89s)
--- PASS: TestDashboardTableCreditsTheFinalAssignee (12.97s)
--- PASS: TestDashboardTableFollowsTheSameRules (12.94s)
PASS
ok  	github.com/gcaspp-labs/xet/backend/internal/helpdesk	100.759s
```
