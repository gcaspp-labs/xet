package helpdesk_test

import (
	"bytes"
	"crypto/sha256"
	"fmt"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/gcaspp-labs/xet/backend/internal/core/storage"
	"github.com/gcaspp-labs/xet/backend/internal/db"
)

// newPhotoEnv returns the environment and the session of an agent, for the
// tests of the contact picture.
func newPhotoEnv(t *testing.T) (*testEnv, string) {
	t.Helper()
	e := newTestEnv(t, nil)
	sector := e.Sector("Atendimento")
	user := e.User("ana@exemplo.com", db.UserRoleAgent, &sector.ID)
	return e, e.Login(user.Email, testPassword)
}

// storePhotoFile writes a generated picture file and records its media row, as
// the profile picture lookup does.
func (e *testEnv) storePhotoFile(data []byte, mimeType string) int64 {
	e.T.Helper()
	key := storage.NewKey(time.Now())
	if err := e.Files.Put(e.T.Context(), key, data); err != nil {
		e.T.Fatalf("store photo file: %v", err)
	}
	var id int64
	if err := e.Pool.QueryRow(e.T.Context(), `
		insert into media_files (storage_key, mime_type, size_bytes, sha256)
		values ($1, $2, $3, $4) returning id`,
		key, mimeType, len(data), fmt.Sprintf("%x", sha256.Sum256(data))).Scan(&id); err != nil {
		e.T.Fatalf("media file %s: %v", key, err)
	}
	return id
}

// newContact creates a contact without phone or organization, as the message
// of an unknown number does.
func (e *testEnv) newContact(name string) int64 {
	e.T.Helper()
	var id int64
	if err := e.Pool.QueryRow(e.T.Context(),
		"insert into contacts (name) values ($1) returning id", name).Scan(&id); err != nil {
		e.T.Fatalf("contact %s: %v", name, err)
	}
	return id
}

// contactWithPicture stores the thumbnail and the full picture of a new
// contact and records the references and the provider id.
func (e *testEnv) contactWithPicture(thumbnail, picture []byte) int64 {
	e.T.Helper()
	contactID := e.newContact("Ana Foto")
	thumbnailID := e.storePhotoFile(thumbnail, "image/png")
	pictureID := e.storePhotoFile(picture, "image/png")
	if _, err := e.Pool.Exec(e.T.Context(), `
		update contacts set photo_media_id = $1, photo_thumbnail_media_id = $2, photo_external_id = $3
		where id = $4`, pictureID, thumbnailID, "foto-1", contactID); err != nil {
		e.T.Fatalf("contact picture: %v", err)
	}
	return contactID
}

// photoRoutes returns the two routes of the picture of the contact.
func photoRoutes(contactID int64) (thumbnail, picture string) {
	return fmt.Sprintf("/api/contacts/%d/photo/thumbnail", contactID),
		fmt.Sprintf("/api/contacts/%d/photo", contactID)
}

// TestContactPhotoRoutes proves the API delivers the two files of the picture
// to any logged user, with the type of the file, inline and private caching
// (spec #482).
func TestContactPhotoRoutes(t *testing.T) {
	e, token := newPhotoEnv(t)

	thumbnail := append([]byte("\x89PNG\r\n\x1a\n"), []byte("miniatura")...)
	picture := append([]byte("\x89PNG\r\n\x1a\n"), []byte("foto completa")...)
	contactID := e.contactWithPicture(thumbnail, picture)
	thumbnailPath, picturePath := photoRoutes(contactID)

	cases := []struct {
		name string
		path string
		want []byte
	}{
		{"thumbnail", thumbnailPath, thumbnail},
		{"picture", picturePath, picture},
	}
	for _, c := range cases {
		status, header, body := e.get(c.path+"?v=foto-1", token)
		if status != http.StatusOK || !bytes.Equal(body, c.want) {
			t.Fatalf("%s: status %d, body %d bytes, want %d", c.name, status, len(body), len(c.want))
		}
		if got := header.Get("Content-Type"); got != "image/png" {
			t.Fatalf("%s: content type %q", c.name, got)
		}
		if got := header.Get("Content-Disposition"); got != "inline" {
			t.Fatalf("%s: disposition %q", c.name, got)
		}
		if got := header.Get("X-Content-Type-Options"); got != "nosniff" {
			t.Fatalf("%s: nosniff %q", c.name, got)
		}
		if got := header.Get("Content-Security-Policy"); got != "sandbox" {
			t.Fatalf("%s: content security policy %q", c.name, got)
		}
		if got := header.Get("Cache-Control"); got != "private, max-age=31536000, immutable" {
			t.Fatalf("%s: cache control %q", c.name, got)
		}
	}

	// The version only keys the cache: another value serves the same file.
	if status, _, body := e.get(picturePath+"?v=outra", token); status != http.StatusOK || !bytes.Equal(body, picture) {
		t.Fatalf("other version: status %d, body %d bytes", status, len(body))
	}

	// Any logged user sees the picture: the contact register is shared by
	// every sector.
	other := e.Sector("Outro setor")
	otherUser := e.User("bia@exemplo.com", db.UserRoleAgent, &other.ID)
	otherToken := e.Login(otherUser.Email, testPassword)
	if status, _, body := e.get(thumbnailPath, otherToken); status != http.StatusOK || !bytes.Equal(body, thumbnail) {
		t.Fatalf("other sector: status %d, body %d bytes", status, len(body))
	}

	// Without a session, both routes answer 401.
	for _, path := range []string{thumbnailPath, picturePath} {
		if status, _, _ := e.get(path, ""); status != http.StatusUnauthorized {
			t.Fatalf("%s without session: status %d", path, status)
		}
	}
}

// TestContactPhotoWithoutPicture proves a contact without a picture answers
// 404 on both routes, as the expected case and not a failure of the server.
func TestContactPhotoWithoutPicture(t *testing.T) {
	e, token := newPhotoEnv(t)

	thumbnailPath, picturePath := photoRoutes(e.newContact("Sem Foto"))
	for _, path := range []string{thumbnailPath, picturePath} {
		status, _, body := e.get(path, token)
		if status != http.StatusNotFound || !strings.Contains(string(body), "Foto não encontrada.") {
			t.Fatalf("%s: status %d, body %s", path, status, body)
		}
	}

	// An unknown contact answers the same 404.
	unknownThumbnail, unknownPicture := photoRoutes(999999)
	for _, path := range []string{unknownThumbnail, unknownPicture} {
		if status, _, _ := e.get(path, token); status != http.StatusNotFound {
			t.Fatalf("%s of an unknown contact: status %d", path, status)
		}
	}
}

// TestContactPhotoFileMissing proves a contact whose stored file is gone
// answers 404 for that file, while the other one still comes.
func TestContactPhotoFileMissing(t *testing.T) {
	e, token := newPhotoEnv(t)

	thumbnail := append([]byte("\x89PNG\r\n\x1a\n"), []byte("miniatura")...)
	picture := append([]byte("\x89PNG\r\n\x1a\n"), []byte("foto completa")...)
	contactID := e.contactWithPicture(thumbnail, picture)
	thumbnailPath, picturePath := photoRoutes(contactID)

	var thumbnailKey, pictureKey string
	if err := e.Pool.QueryRow(e.T.Context(), `
		select t.storage_key, m.storage_key
		from contacts c
		join media_files t on t.id = c.photo_thumbnail_media_id
		join media_files m on m.id = c.photo_media_id
		where c.id = $1`, contactID).Scan(&thumbnailKey, &pictureKey); err != nil {
		e.T.Fatal(err)
	}
	if err := e.Files.Delete(e.T.Context(), pictureKey); err != nil {
		e.T.Fatal(err)
	}
	if status, _, body := e.get(picturePath, token); status != http.StatusNotFound {
		t.Fatalf("missing picture: status %d, body %s", status, body)
	}
	if status, _, body := e.get(thumbnailPath, token); status != http.StatusOK || !bytes.Equal(body, thumbnail) {
		t.Fatalf("thumbnail with the picture missing: status %d, body %d bytes", status, len(body))
	}
	// Only the full picture is gone: the thumbnail is still stored.
	if _, err := e.Files.Open(e.T.Context(), thumbnailKey); err != nil {
		t.Fatalf("thumbnail %s: %v", thumbnailKey, err)
	}
}
