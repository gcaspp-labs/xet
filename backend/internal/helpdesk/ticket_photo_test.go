package helpdesk_test

import (
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/gcaspp-labs/xet/backend/internal/db"
)

// photoFile stores a test image and returns its id.
func photoFile(t *testing.T, e *testEnv, key string) int64 {
	t.Helper()
	var id int64
	if err := e.Pool.QueryRow(t.Context(), `
		insert into media_files (storage_key, mime_type, size_bytes, sha256)
		values ($1, 'image/jpeg', 10, repeat('a', 64)) returning id`, key).Scan(&id); err != nil {
		t.Fatalf("media file %s: %v", key, err)
	}
	return id
}

// insertTicket inserts a ticket of the sector for the contact with the given
// status, enough for the lists and the detail of the photo version test.
func insertTicket(t *testing.T, e *testEnv, protocol string, sectorID, contactID, assigneeID, orgID int64, status string) int64 {
	t.Helper()
	now := time.Now()
	var id int64
	var err error
	switch status {
	case "queued":
		err = e.Pool.QueryRow(t.Context(), `
			insert into tickets (protocol, sector_id, contact_id, organization_id, status, arrived_at, started_at)
			values ($1, $2, $3, $4, 'queued', $5, $5) returning id`,
			protocol, sectorID, contactID, orgID, now).Scan(&id)
	case "pending":
		err = e.Pool.QueryRow(t.Context(), `
			insert into tickets (protocol, sector_id, contact_id, organization_id, status,
			    arrived_at, started_at, pending_reason, pending_by_id, pending_at)
			values ($1, $2, $3, $4, 'pending', $5, $5, 'Aguardando retorno', $6, $5) returning id`,
			protocol, sectorID, contactID, orgID, now, assigneeID).Scan(&id)
	case "closed":
		err = e.Pool.QueryRow(t.Context(), `
			insert into tickets (protocol, sector_id, contact_id, organization_id, assignee_id, status,
			    arrived_at, started_at, ended_at, closed_at, closed_by_id, closure_type, subject, resolution)
			values ($1, $2, $3, $4, $5, 'closed', $6, $6, $7, $7, $5, 'resolved', 'Consulta', 'Resolvido') returning id`,
			protocol, sectorID, contactID, orgID, assigneeID, now, now.Add(time.Minute)).Scan(&id)
	default:
		t.Fatalf("status %q", status)
	}
	if err != nil {
		t.Fatalf("insert ticket %s: %v", protocol, err)
	}
	return id
}

// O chamado traz a versão da foto do contato: nula sem foto e igual ao
// identificador no WhatsApp quando há foto, na fila, no pendente, no detalhe,
// nos atendimentos encerrados e nas listas do Dashboard (spec #482).
func TestTicketContactPhotoVersion(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	e.User("admin@exemplo.com", db.UserRoleAdmin, nil)
	token := e.Login("admin@exemplo.com", testPassword)
	sector := e.Sector("Contabilidade")
	org := e.Organization(token, "Prefeitura de Itu", "")
	supervisor := e.User("sup@exemplo.com", db.UserRoleSupervisor, &sector.ID)
	supToken := e.Login("sup@exemplo.com", testPassword)

	contactIDs := map[string]int64{
		"queuedPhoto":   e.Contact(token, "Maria Souza", "5511988880001", org, sector.ID),
		"queuedNoPhoto": e.Contact(token, "João Lima", "5511988880002", org, sector.ID),
		"pendingPhoto":  e.Contact(token, "Ana Paula", "5511988880003", org, sector.ID),
		"pendingNo":     e.Contact(token, "Carlos Dias", "5511988880004", org, sector.ID),
	}
	full := photoFile(t, e, "contatos/foto.jpg")
	thumbnail := photoFile(t, e, "contatos/foto-miniatura.jpg")
	for _, key := range []string{"queuedPhoto", "pendingPhoto"} {
		if _, err := e.Pool.Exec(t.Context(), `
			update contacts set photo_media_id = $1, photo_thumbnail_media_id = $2,
				photo_external_id = 'PHOTO-1', photo_checked_at = now()
			where id = $3`, full, thumbnail, contactIDs[key]); err != nil {
			t.Fatalf("set photo of %s: %v", key, err)
		}
	}

	insertTicket(t, e, "2026-000001", sector.ID, contactIDs["queuedPhoto"], supervisor.ID, org, "queued")
	insertTicket(t, e, "2026-000002", sector.ID, contactIDs["queuedNoPhoto"], supervisor.ID, org, "queued")
	insertTicket(t, e, "2026-000003", sector.ID, contactIDs["pendingPhoto"], supervisor.ID, org, "pending")
	insertTicket(t, e, "2026-000004", sector.ID, contactIDs["pendingNo"], supervisor.ID, org, "pending")
	closedPhoto := insertTicket(t, e, "2026-000005", sector.ID, contactIDs["queuedPhoto"], supervisor.ID, org, "closed")
	closedNoPhoto := insertTicket(t, e, "2026-000006", sector.ID, contactIDs["queuedNoPhoto"], supervisor.ID, org, "closed")

	want := func(key string) any {
		if key == "queuedPhoto" || key == "pendingPhoto" {
			return "PHOTO-1"
		}
		return nil
	}
	version := func(t *testing.T, ticket map[string]any) any {
		t.Helper()
		contact, ok := ticket["contact"].(map[string]any)
		if !ok {
			t.Fatalf("ticket without contact: %v", ticket)
		}
		v, ok := contact["photoVersion"]
		if !ok {
			t.Fatalf("contact without photoVersion: %v", contact)
		}
		return v
	}
	checkList := func(t *testing.T, items []map[string]any) {
		t.Helper()
		seen := 0
		for _, item := range items {
			contact := item["contact"].(map[string]any)
			for key, id := range contactIDs {
				if contact["id"] != float64(id) {
					continue
				}
				if got := version(t, item); got != want(key) {
					t.Errorf("photoVersion of %s = %v, want %v", key, got, want(key))
				}
				seen++
			}
		}
		if seen == 0 {
			t.Fatalf("no test contacts in the list: %v", items)
		}
	}

	t.Run("fila", func(t *testing.T) {
		checkList(t, e.DoList(http.MethodGet, fmt.Sprintf("/api/sectors/%d/tickets", sector.ID), supToken))
	})

	t.Run("pendentes", func(t *testing.T) {
		checkList(t, e.DoList(http.MethodGet, fmt.Sprintf("/api/sectors/%d/pending-tickets", sector.ID), supToken))
	})

	t.Run("detalhe", func(t *testing.T) {
		for _, tc := range []struct {
			key  string
			id   int64
			want any
		}{
			{"queuedPhoto", closedPhoto, "PHOTO-1"},
			{"queuedNoPhoto", closedNoPhoto, nil},
		} {
			resp := e.Do(http.MethodGet, fmt.Sprintf("/api/tickets/%d", tc.id), supToken, nil)
			if resp.Status != http.StatusOK {
				t.Fatalf("status %d: %v", resp.Status, resp.Body)
			}
			if got := version(t, resp.Body); got != tc.want {
				t.Errorf("photoVersion of %s = %v, want %v", tc.key, got, tc.want)
			}
		}
	})

	t.Run("atendimentos encerrados", func(t *testing.T) {
		items := e.DoPageItems("/api/closed-tickets", token)
		checkList(t, items)
	})

	t.Run("dashboard", func(t *testing.T) {
		resp := e.Do(http.MethodGet, "/api/dashboard/tickets", supToken, nil)
		if resp.Status != http.StatusOK {
			t.Fatalf("status %d: %v", resp.Status, resp.Body)
		}
		checkList(t, listOf(t, resp.Body["queued"]))
	})
}

// listOf reads a JSON array of objects from a response body.
func listOf(t *testing.T, value any) []map[string]any {
	t.Helper()
	items, ok := value.([]any)
	if !ok {
		t.Fatalf("not a list: %v", value)
	}
	out := make([]map[string]any, len(items))
	for i, item := range items {
		out[i], ok = item.(map[string]any)
		if !ok {
			t.Fatalf("item %d is not an object: %v", i, item)
		}
	}
	return out
}
