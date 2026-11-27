package directory_test

import (
	"errors"
	"fmt"
	"net/http"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"

	"github.com/gcaspp-labs/xet/backend/internal/db"
)

// mediaFile stores a test image and returns its id.
func mediaFile(t *testing.T, e *testEnv, key string) int64 {
	t.Helper()
	var id int64
	if err := e.Pool.QueryRow(t.Context(), `
		insert into media_files (storage_key, mime_type, size_bytes, sha256)
		values ($1, 'image/jpeg', 10, repeat('a', 64)) returning id`, key).Scan(&id); err != nil {
		t.Fatalf("media file %s: %v", key, err)
	}
	return id
}

func wantSQLState(t *testing.T, err error, code string) {
	t.Helper()
	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) || pgErr.Code != code {
		t.Fatalf("err = %v, want SQLSTATE %s", err, code)
	}
}

// A foto do contato é toda ou nada: os dois arquivos e o identificador nascem e
// somem juntos, e o identificador não aceita texto em branco (spec #482).
func TestContactPhotoColumns(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	full := mediaFile(t, e, "contatos/foto.jpg")
	thumbnail := mediaFile(t, e, "contatos/foto-miniatura.jpg")
	externalID := func(s string) *string { return &s }

	const checkViolation = "23514"
	cases := []struct {
		name       string
		media      *int64
		thumbnail  *int64
		externalID *string
		checked    bool
		wantErr    bool
	}{
		{"sem foto", nil, nil, nil, false, false},
		{"busca sem foto", nil, nil, nil, true, false},
		{"com foto", &full, &thumbnail, externalID("PHOTO-1"), true, false},
		{"miniatura sem foto completa", nil, &thumbnail, externalID("PHOTO-1"), false, true},
		{"foto completa sem miniatura", &full, nil, externalID("PHOTO-1"), false, true},
		{"identificador sem arquivos", nil, nil, externalID("PHOTO-1"), false, true},
		{"arquivos sem identificador", &full, &thumbnail, nil, false, true},
		{"identificador em branco", &full, &thumbnail, externalID("  "), false, true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := e.Pool.Exec(t.Context(), `
				insert into contacts (name, photo_media_id, photo_thumbnail_media_id, photo_external_id, photo_checked_at)
				values ($1, $2, $3, $4, case when $5 then now() end)`,
				tc.name, tc.media, tc.thumbnail, tc.externalID, tc.checked)
			if tc.wantErr {
				wantSQLState(t, err, checkViolation)
				return
			}
			if err != nil {
				t.Fatalf("insert %s: %v", tc.name, err)
			}
		})
	}
}

// O contato devolvido pela API traz a versão da foto: vazia sem foto e igual ao
// identificador no WhatsApp quando há foto, na ficha e na lista (spec #482).
func TestContactPhotoVersion(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	e.User("admin@exemplo.com", db.UserRoleAdmin, nil)
	token := e.Login("admin@exemplo.com", testPassword)
	orgID := e.Organization(token, "Prefeitura de Itu", "")
	contab := e.Sector("Contabilidade")
	contactID := e.Contact(token, "Maria Souza", "5511988880001", orgID, contab.ID)

	get := func() map[string]any {
		resp := e.Do(http.MethodGet, fmt.Sprintf("/api/contacts/%d", contactID), token, nil)
		if resp.Status != http.StatusOK {
			t.Fatalf("get contact: status %d, body %v", resp.Status, resp.Body)
		}
		return resp.Body
	}
	photoVersion := func(c map[string]any) any {
		t.Helper()
		v, ok := c["photoVersion"]
		if !ok {
			t.Fatalf("contact response without photoVersion: %v", c)
		}
		return v
	}
	listVersion := func() any {
		t.Helper()
		items := e.DoPageItems("/api/contacts", token)
		if len(items) != 1 {
			t.Fatalf("contacts = %v, want one", items)
		}
		return photoVersion(items[0])
	}

	if v := photoVersion(get()); v != nil {
		t.Fatalf("photoVersion without photo = %v, want null", v)
	}
	if v := listVersion(); v != nil {
		t.Fatalf("photoVersion in the list without photo = %v, want null", v)
	}

	full := mediaFile(t, e, "contatos/foto.jpg")
	thumbnail := mediaFile(t, e, "contatos/foto-miniatura.jpg")
	if _, err := e.Pool.Exec(t.Context(), `
		update contacts set photo_media_id = $1, photo_thumbnail_media_id = $2,
			photo_external_id = 'PHOTO-1', photo_checked_at = now()
		where id = $3`, full, thumbnail, contactID); err != nil {
		t.Fatalf("set photo: %v", err)
	}

	if v := photoVersion(get()); v != "PHOTO-1" {
		t.Fatalf("photoVersion with photo = %v, want the external id", v)
	}
	if v := listVersion(); v != "PHOTO-1" {
		t.Fatalf("photoVersion in the list with photo = %v, want the external id", v)
	}
}
