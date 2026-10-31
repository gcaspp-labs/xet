-- name: NextProtocolNumber :one
-- Locks the counter row of the year until the transaction ends.
insert into protocol_counters (year, last_value)
values (@year, 1)
on conflict (year) do update set last_value = protocol_counters.last_value + 1
returning last_value;

-- name: GetOpenTicketForUpdate :one
select * from tickets
where sector_id = @sector_id and contact_id = @contact_id and status <> 'closed'
for update;

-- name: CreateQueuedTicket :one
-- A concurrent message may open the ticket first; then no row is returned
-- and the caller locks the existing one.
insert into tickets (protocol, sector_id, contact_id, organization_id, status, arrived_at, started_at)
values (@protocol, @sector_id, @contact_id, @organization_id, 'queued', @arrived_at, @arrived_at)
on conflict (sector_id, contact_id) where status <> 'closed' do nothing
returning *;
