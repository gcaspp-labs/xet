package helpdesk

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"mime"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/gcaspp-labs/xet/backend/internal/db"
	"github.com/gcaspp-labs/xet/backend/internal/helpdesk/messaging"
)

const (
	// profilePictureTimeout bounds one lookup of the profile picture of a
	// contact, including the two downloads.
	profilePictureTimeout = time.Minute
	// profilePictureDownloadTimeout bounds each download of the picture.
	profilePictureDownloadTimeout = 20 * time.Second
	// maxProfilePictureSize is the limit of each profile picture file, the
	// thumbnail and the full image.
	maxProfilePictureSize = 5 << 20
)

// refreshContactPhoto looks up the profile picture of the contact in the
// provider and stores it, in the background: the ticket that brought the
// contact is already committed and never waits for this work (spec #482).
// A failure keeps the previous picture and only records the attempt and the
// reason in the log; nothing reaches the agent.
func (s *Service) refreshContactPhoto(sectorID, contactID int64) {
	if s.provider == nil {
		return
	}
	s.background.Go(func() {
		ctx, cancel := context.WithTimeout(context.Background(), profilePictureTimeout)
		defer cancel()
		if err := s.lookupContactPhoto(ctx, sectorID, contactID); err != nil {
			slog.Warn("contact profile picture", "sector_id", sectorID, "contact_id", contactID, "error", err)
		}
	})
}

// lookupContactPhoto claims the attempt of the contact, at most once every 24
// hours, and looks up its picture by the provider of the service. It returns an
// error when the result is unknown, so the previous picture stays.
func (s *Service) lookupContactPhoto(ctx context.Context, sectorID, contactID int64) error {
	// No row means the last attempt is less than 24 hours old.
	check, err := s.q.ClaimContactPhotoCheck(ctx, contactID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil
	}
	if err != nil {
		return fmt.Errorf("claim picture check: %w", err)
	}

	existingID := ""
	if check.PhotoExternalID != nil {
		existingID = *check.PhotoExternalID
	}
	providerID := ""
	if check.ExternalContactID != nil {
		providerID = *check.ExternalContactID
	}
	if providerID == "" && check.Phone != nil {
		providerID, err = s.provider.ResolveContact(ctx, sectorID, *check.Phone)
		switch {
		case errors.Is(err, messaging.ErrContactNotFound):
			// The phone has no WhatsApp account: there is no picture to show.
			return s.clearContactPhoto(ctx, contactID, check)
		case err != nil:
			return fmt.Errorf("resolve contact: %w", err)
		}
	}
	if providerID == "" {
		// No identifier in the provider and no phone: nothing to look up.
		return nil
	}

	picture, err := s.provider.ProfilePicture(ctx, sectorID, providerID, existingID)
	if err != nil {
		return fmt.Errorf("profile picture: %w", err)
	}
	switch picture.Kind {
	case messaging.ProfilePictureNone:
		return s.clearContactPhoto(ctx, contactID, check)
	case messaging.ProfilePictureUnchanged:
		// The stored picture is still current: the attempt is enough.
		return nil
	case messaging.ProfilePictureFound:
		return s.saveContactPhoto(ctx, contactID, check, picture)
	default:
		return fmt.Errorf("profile picture: unknown result %q", picture.Kind)
	}
}

// saveContactPhoto downloads the two files of the picture, stores them as the
// media files of the contact and records the references and the provider
// identifier, replacing the previous picture.
func (s *Service) saveContactPhoto(ctx context.Context, contactID int64, check db.ClaimContactPhotoCheckRow, picture messaging.ProfilePicture) error {
	thumbnail, err := downloadProfilePicture(ctx, picture.ThumbnailURL)
	if err != nil {
		return fmt.Errorf("download thumbnail: %w", err)
	}
	full, err := downloadProfilePicture(ctx, picture.FullURL)
	if err != nil {
		return fmt.Errorf("download picture: %w", err)
	}

	now := time.Now()
	thumbnailFile, err := s.storeMedia(ctx, thumbnail, now)
	if err != nil {
		return fmt.Errorf("store thumbnail: %w", err)
	}
	fullFile, err := s.storeMedia(ctx, full, now)
	if err != nil {
		return fmt.Errorf("store picture: %w", err)
	}

	var previous []string
	err = pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		q := s.q.WithTx(tx)
		thumb, err := q.CreateMediaFile(ctx, *thumbnailFile)
		if err != nil {
			return fmt.Errorf("create thumbnail file: %w", err)
		}
		photo, err := q.CreateMediaFile(ctx, *fullFile)
		if err != nil {
			return fmt.Errorf("create picture file: %w", err)
		}
		if err := q.SetContactPhoto(ctx, db.SetContactPhotoParams{
			ID:                    contactID,
			PhotoMediaID:          &photo.ID,
			PhotoThumbnailMediaID: &thumb.ID,
			PhotoExternalID:       &picture.ID,
		}); err != nil {
			return fmt.Errorf("set contact picture: %w", err)
		}
		previous, err = deleteContactPhotoFiles(ctx, q, check.PhotoMediaID, check.PhotoThumbnailMediaID)
		if err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		return err
	}
	s.removePhotoFiles(ctx, previous)
	return nil
}

// clearContactPhoto removes the picture of the contact, which the provider
// says it no longer has or hides, and deletes its files.
func (s *Service) clearContactPhoto(ctx context.Context, contactID int64, check db.ClaimContactPhotoCheckRow) error {
	if check.PhotoMediaID == nil && check.PhotoThumbnailMediaID == nil && check.PhotoExternalID == nil {
		// Already without a picture: the attempt alone is enough.
		return nil
	}
	var previous []string
	err := pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		q := s.q.WithTx(tx)
		if err := q.ClearContactPhoto(ctx, contactID); err != nil {
			return fmt.Errorf("clear contact picture: %w", err)
		}
		var err error
		previous, err = deleteContactPhotoFiles(ctx, q, check.PhotoMediaID, check.PhotoThumbnailMediaID)
		return err
	})
	if err != nil {
		return err
	}
	s.removePhotoFiles(ctx, previous)
	return nil
}

// deleteContactPhotoFiles removes the media files of a replaced or cleared
// picture and returns their storage keys, to be removed after the commit.
func deleteContactPhotoFiles(ctx context.Context, q *db.Queries, ids ...*int64) ([]string, error) {
	var keys []string
	seen := map[int64]bool{}
	for _, id := range ids {
		if id == nil || seen[*id] {
			continue
		}
		seen[*id] = true
		key, err := q.DeleteMediaFile(ctx, *id)
		if errors.Is(err, pgx.ErrNoRows) {
			continue
		}
		if err != nil {
			return nil, fmt.Errorf("delete picture file %d: %w", *id, err)
		}
		keys = append(keys, key)
	}
	return keys, nil
}

// removePhotoFiles deletes the stored files of a replaced picture. It runs
// after the commit and never fails the lookup: a file left behind is only
// garbage, and the next cleanup would not find it again.
func (s *Service) removePhotoFiles(ctx context.Context, keys []string) {
	for _, key := range keys {
		if err := s.storage.Delete(ctx, key); err != nil {
			slog.Warn("delete profile picture file", "key", key, "error", err)
		}
	}
}

// downloadProfilePicture fetches one file of the picture. The file must be an
// image of at most maxProfilePictureSize; the URLs expire, so the caller
// stores the content right away.
func downloadProfilePicture(ctx context.Context, url string) (messaging.Media, error) {
	if url == "" {
		return messaging.Media{}, errors.New("empty url")
	}
	ctx, cancel := context.WithTimeout(ctx, profilePictureDownloadTimeout)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return messaging.Media{}, err
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return messaging.Media{}, err
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return messaging.Media{}, fmt.Errorf("status %d", resp.StatusCode)
	}
	data, err := io.ReadAll(io.LimitReader(resp.Body, maxProfilePictureSize+1))
	if err != nil {
		return messaging.Media{}, err
	}
	if len(data) > maxProfilePictureSize {
		return messaging.Media{}, fmt.Errorf("file larger than %d bytes", maxProfilePictureSize)
	}
	// The content decides: a link that answers with a page or a file that is
	// not an image is a failure, whatever the header says.
	sniffed := http.DetectContentType(data)
	if !strings.HasPrefix(sniffed, "image/") {
		return messaging.Media{}, fmt.Errorf("content type %q is not an image", sniffed)
	}
	mimeType := sniffed
	if header, _, err := mime.ParseMediaType(resp.Header.Get("Content-Type")); err == nil && strings.HasPrefix(header, "image/") {
		mimeType = header
	}
	return messaging.Media{Data: data, MimeType: mimeType}, nil
}
