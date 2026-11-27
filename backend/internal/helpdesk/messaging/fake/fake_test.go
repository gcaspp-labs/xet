package fake

import (
	"bytes"
	"context"
	"errors"
	"image/png"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"github.com/gcaspp-labs/xet/backend/internal/helpdesk/messaging"
)

const (
	testSector  = int64(1)
	testContact = "5511977776666@s.whatsapp.net"
)

// connected returns an adapter with the sector connected.
func connected(t *testing.T) *Adapter {
	t.Helper()
	a := New(func(context.Context, messaging.Event) error { return nil })
	if err := a.Connect(t.Context(), messaging.Account{SectorID: testSector, AccountID: "5511900001111@s.whatsapp.net"}); err != nil {
		t.Fatal(err)
	}
	return a
}

// The fake answers the same three results of the real provider: found with
// the generated image URLs, none without a picture and unchanged when the
// existing ID is the current one. A configured failure comes as the error.
func TestProfilePicture(t *testing.T) {
	a := connected(t)
	a.SetProfilePictureBaseURL("http://fake.test/messaging")

	id := a.SetProfilePicture(testContact)
	got, err := a.ProfilePicture(t.Context(), testSector, testContact, "")
	if err != nil {
		t.Fatal(err)
	}
	escaped := url.PathEscape(testContact)
	want := messaging.ProfilePicture{
		Kind:         messaging.ProfilePictureFound,
		ID:           id,
		ThumbnailURL: "http://fake.test/messaging/profile-pictures/" + escaped + "/thumbnail",
		FullURL:      "http://fake.test/messaging/profile-pictures/" + escaped + "/full",
	}
	if got != want {
		t.Fatalf("found = %+v, want %+v", got, want)
	}

	if got, err := a.ProfilePicture(t.Context(), testSector, testContact, id); err != nil || got.Kind != messaging.ProfilePictureUnchanged {
		t.Fatalf("unchanged = %+v, %v", got, err)
	}

	// A new picture changes the identifier; the old one is no longer unchanged.
	other := a.SetProfilePicture(testContact)
	if other == id {
		t.Fatalf("new picture kept the ID %q", id)
	}
	if got, err := a.ProfilePicture(t.Context(), testSector, testContact, id); err != nil || got.Kind != messaging.ProfilePictureFound || got.ID != other {
		t.Fatalf("changed = %+v, %v", got, err)
	}

	a.ClearProfilePicture(testContact)
	if got, err := a.ProfilePicture(t.Context(), testSector, testContact, ""); err != nil || got.Kind != messaging.ProfilePictureNone {
		t.Fatalf("none = %+v, %v", got, err)
	}

	// A failure configured for the sector comes as the error, once.
	a.FailNextProfilePicture(testSector, ErrProfilePictureUnreachable)
	if _, err := a.ProfilePicture(t.Context(), testSector, testContact, ""); !errors.Is(err, ErrProfilePictureUnreachable) {
		t.Fatalf("failure = %v, want %v", err, ErrProfilePictureUnreachable)
	}
	if got, err := a.ProfilePicture(t.Context(), testSector, testContact, ""); err != nil || got.Kind != messaging.ProfilePictureNone {
		t.Fatalf("after failure = %+v, %v", got, err)
	}

	// Without a session the lookup is refused.
	if _, err := a.ProfilePicture(t.Context(), 99, testContact, ""); !errors.Is(err, messaging.ErrNotConnected) {
		t.Fatalf("without session = %v, want ErrNotConnected", err)
	}
}

// The HTTP route sets and removes the picture, and serves the generated image
// the URLs point at. The absolute URLs come from the Host of the request, so
// the backend can download them.
func TestProfilePictureThroughHTTP(t *testing.T) {
	a := connected(t)
	handler := a.Handler()

	set := httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/messaging/sectors/1/profile-picture", strings.NewReader(`{"contactId":"`+testContact+`"}`))
	set.Host = "10.0.0.5:28090"
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, set)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("set = %d %s", rec.Code, rec.Body)
	}

	got, err := a.ProfilePicture(t.Context(), testSector, testContact, "")
	if err != nil || got.Kind != messaging.ProfilePictureFound {
		t.Fatalf("lookup = %+v, %v", got, err)
	}
	if !strings.HasPrefix(got.ThumbnailURL, "http://10.0.0.5:28090/messaging/profile-pictures/") ||
		!strings.HasPrefix(got.FullURL, "http://10.0.0.5:28090/messaging/profile-pictures/") {
		t.Fatalf("URLs = %q, %q", got.ThumbnailURL, got.FullURL)
	}

	full, err := url.Parse(got.FullURL)
	if err != nil {
		t.Fatal(err)
	}
	image := httptest.NewRequestWithContext(t.Context(), http.MethodGet, full.Path, nil)
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, image)
	if rec.Code != http.StatusOK || rec.Header().Get("Content-Type") != "image/png" {
		t.Fatalf("image = %d %q", rec.Code, rec.Header().Get("Content-Type"))
	}
	if _, err := png.Decode(bytes.NewReader(rec.Body.Bytes())); err != nil {
		t.Fatalf("image is not a PNG: %v", err)
	}

	// An unknown contact or size has no image.
	for _, path := range []string{"/messaging/profile-pictures/" + url.PathEscape("outro@s.whatsapp.net") + "/full", "/messaging/profile-pictures/" + url.PathEscape(testContact) + "/small"} {
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, httptest.NewRequestWithContext(t.Context(), http.MethodGet, path, nil))
		if rec.Code != http.StatusNotFound {
			t.Fatalf("GET %s = %d, want 404", path, rec.Code)
		}
	}

	clear := httptest.NewRequestWithContext(t.Context(), http.MethodDelete, "/messaging/sectors/1/profile-picture?contactId="+url.QueryEscape(testContact), nil)
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, clear)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("clear = %d %s", rec.Code, rec.Body)
	}
	if got, err := a.ProfilePicture(t.Context(), testSector, testContact, ""); err != nil || got.Kind != messaging.ProfilePictureNone {
		t.Fatalf("after clear = %+v, %v", got, err)
	}
}
