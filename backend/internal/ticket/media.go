package ticket

import (
	"context"
	"errors"
	"fmt"
	"io"

	"github.com/jackc/pgx/v5"

	"github.com/gcaspp-labs/xet/backend/internal/auth"
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
