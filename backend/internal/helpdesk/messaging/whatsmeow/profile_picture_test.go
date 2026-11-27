package whatsmeow

import (
	"context"
	"errors"
	"testing"

	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/types"

	"github.com/gcaspp-labs/xet/backend/internal/helpdesk/messaging"
)

// WhatsApp answers the profile picture query with the preview for the
// thumbnail and with the full image for the rest. Both carry the existing
// ID, so an unchanged picture comes back as an empty answer; "not set" and
// "hidden" are no picture, and any other failure is an error.
func TestProfilePicture(t *testing.T) {
	jid := types.NewJID("5511999999999", types.DefaultUserServer)
	type call struct {
		preview    bool
		existingID string
	}
	var calls []call
	lookup := func(preview, full *types.ProfilePictureInfo, previewErr, fullErr error) profilePictureInfo {
		return func(_ context.Context, got types.JID, params *whatsmeow.GetProfilePictureParams) (*types.ProfilePictureInfo, error) {
			if got != jid {
				t.Fatalf("lookup(%s), want %s", got, jid)
			}
			calls = append(calls, call{preview: params.Preview, existingID: params.ExistingID})
			if params.Preview {
				return preview, previewErr
			}
			return full, fullErr
		}
	}
	preview := &types.ProfilePictureInfo{ID: "photo-2", URL: "https://cdn.example/preview", Type: "preview"}
	full := &types.ProfilePictureInfo{ID: "photo-2", URL: "https://cdn.example/full", Type: "image"}
	lookupErr := errors.New("websocket not connected")
	fullErr := errors.New("timed out")

	cases := []struct {
		name string
		// existingID is the picture ID already stored.
		existingID string
		// preview and full are the answers of each query.
		preview, full       *types.ProfilePictureInfo
		previewErr, fullErr error
		want                messaging.ProfilePicture
		wantErr             error
		wantCalls           []call
	}{
		{
			name:       "found with thumbnail and full image",
			existingID: "photo-1",
			preview:    preview,
			full:       full,
			want: messaging.ProfilePicture{
				Kind: messaging.ProfilePictureFound, ID: "photo-2",
				ThumbnailURL: "https://cdn.example/preview", FullURL: "https://cdn.example/full",
			},
			wantCalls: []call{{true, "photo-1"}, {false, "photo-1"}},
		},
		{
			name:       "no picture",
			previewErr: whatsmeow.ErrProfilePictureNotSet,
			want:       messaging.ProfilePicture{Kind: messaging.ProfilePictureNone},
			wantCalls:  []call{{true, ""}},
		},
		{
			name:       "picture hidden",
			previewErr: whatsmeow.ErrProfilePictureUnauthorized,
			want:       messaging.ProfilePicture{Kind: messaging.ProfilePictureNone},
			wantCalls:  []call{{true, ""}},
		},
		{
			name:       "unchanged picture",
			existingID: "photo-1",
			want:       messaging.ProfilePicture{Kind: messaging.ProfilePictureUnchanged},
			wantCalls:  []call{{true, "photo-1"}},
		},
		{
			name:       "lookup error",
			previewErr: lookupErr,
			wantErr:    lookupErr,
			wantCalls:  []call{{true, ""}},
		},
		{
			name:      "full image error",
			preview:   preview,
			fullErr:   fullErr,
			wantErr:   fullErr,
			wantCalls: []call{{true, ""}, {false, ""}},
		},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			calls = nil
			got, err := profilePicture(t.Context(), lookup(c.preview, c.full, c.previewErr, c.fullErr), jid, c.existingID)
			if c.wantErr != nil {
				if !errors.Is(err, c.wantErr) {
					t.Fatalf("err = %v, want %v", err, c.wantErr)
				}
			} else if err != nil {
				t.Fatalf("err = %v", err)
			}
			if got != c.want {
				t.Fatalf("result = %+v, want %+v", got, c.want)
			}
			if len(calls) != len(c.wantCalls) {
				t.Fatalf("calls = %+v, want %+v", calls, c.wantCalls)
			}
			for i, want := range c.wantCalls {
				if calls[i] != want {
					t.Fatalf("calls = %+v, want %+v", calls, c.wantCalls)
				}
			}
		})
	}
}

// Without a session the lookup is refused before reaching WhatsApp.
func TestProfilePictureWithoutSession(t *testing.T) {
	a, _, _ := newTestAdapter(t)
	_, err := a.ProfilePicture(t.Context(), 99, "5511999999999@s.whatsapp.net", "")
	if !errors.Is(err, messaging.ErrNotConnected) {
		t.Fatalf("err = %v, want ErrNotConnected", err)
	}
}
