package helpdesk

import (
	"context"
	"errors"
	"fmt"
	"io"

	"github.com/jackc/pgx/v5"

	"github.com/gcaspp-labs/xet/backend/internal/core/auth"
	"github.com/gcaspp-labs/xet/backend/internal/core/storage"
	"github.com/gcaspp-labs/xet/backend/internal/db"
)

// Media opens an attachment of a message of a ticket the user may see.
func (s *Service) Media(ctx context.Context, actor auth.User, mediaID int64) (db.MediaFile, io.ReadCloser, error) {
	ticketID, err := s.q.GetMediaFileTicket(ctx, &mediaID)
	if errors.Is(err, pgx.ErrNoRows) {
		return db.MediaFile{}, nil, ErrMediaNotFound
	}
	if err != nil {
		return db.MediaFile{}, nil, fmt.Errorf("get media ticket: %w", err)
	}
	if _, err := s.viewable(ctx, actor, ticketID); err != nil {
		return db.MediaFile{}, nil, err
	}
	file, err := s.q.GetMediaFile(ctx, mediaID)
	if err != nil {
		return db.MediaFile{}, nil, fmt.Errorf("get media file: %w", err)
	}
	r, err := s.storage.Open(ctx, file.StorageKey)
	if err != nil {
		return db.MediaFile{}, nil, fmt.Errorf("open media: %w", err)
	}
	return file, r, nil
}

// ContactPhoto opens one file of the profile picture of a contact: the
// thumbnail for the lists or the full picture for the window. The contact
// register is shared by every sector, so any logged user sees the picture
// (spec #482).
func (s *Service) ContactPhoto(ctx context.Context, contactID int64, thumbnail bool) (db.MediaFile, io.ReadCloser, error) {
	file, err := s.q.GetContactPhotoFile(ctx, db.GetContactPhotoFileParams{ID: contactID, Thumbnail: thumbnail})
	if errors.Is(err, pgx.ErrNoRows) {
		return db.MediaFile{}, nil, ErrPhotoNotFound
	}
	if err != nil {
		return db.MediaFile{}, nil, fmt.Errorf("get contact photo: %w", err)
	}
	r, err := s.storage.Open(ctx, file.StorageKey)
	if errors.Is(err, storage.ErrNotFound) {
		// The contact points to a file that is no longer there: for the
		// screens it is the same as a contact without a picture.
		return db.MediaFile{}, nil, ErrPhotoNotFound
	}
	if err != nil {
		return db.MediaFile{}, nil, fmt.Errorf("open contact photo: %w", err)
	}
	return file, r, nil
}
