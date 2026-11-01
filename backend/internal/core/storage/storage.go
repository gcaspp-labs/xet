// Package storage keeps the attachments of the messages. The pilot writes to
// the local disk; a move to a VPS may swap it for object storage (S3 or
// similar) with another implementation of Storage (arquitetura.md).
package storage

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"time"
)

var ErrNotFound = errors.New("file not found")

// Storage saves and reads files by key.
type Storage interface {
	Put(ctx context.Context, key string, data []byte) error
	Open(ctx context.Context, key string) (io.ReadCloser, error)
}

// NewKey returns a random key grouped by year and month, such as 2026/10/<hex>.
func NewKey(now time.Time) string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return fmt.Sprintf("%04d/%02d/%s", now.Year(), now.Month(), hex.EncodeToString(b))
}

// Disk stores the files under a directory of the local disk.
type Disk struct {
	dir string
}

var _ Storage = (*Disk)(nil)

func NewDisk(dir string) *Disk {
	return &Disk{dir: dir}
}

func (d *Disk) path(key string) (string, error) {
	if !filepath.IsLocal(key) {
		return "", fmt.Errorf("invalid storage key %q", key)
	}
	return filepath.Join(d.dir, filepath.FromSlash(key)), nil
}

// Put writes to a temporary file and renames it, so a file is never seen
// half written.
func (d *Disk) Put(_ context.Context, key string, data []byte) error {
	path, err := d.path(key)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o750); err != nil {
		return fmt.Errorf("create storage dir: %w", err)
	}
	tmp, err := os.CreateTemp(filepath.Dir(path), ".tmp-*")
	if err != nil {
		return fmt.Errorf("create temp file: %w", err)
	}
	defer func() { _ = os.Remove(tmp.Name()) }()
	if _, err := tmp.Write(data); err != nil {
		_ = tmp.Close()
		return fmt.Errorf("write file: %w", err)
	}
	if err := tmp.Close(); err != nil {
		return fmt.Errorf("close file: %w", err)
	}
	if err := os.Rename(tmp.Name(), path); err != nil {
		return fmt.Errorf("rename file: %w", err)
	}
	return nil
}

func (d *Disk) Open(_ context.Context, key string) (io.ReadCloser, error) {
	path, err := d.path(key)
	if err != nil {
		return nil, err
	}
	f, err := os.Open(path)
	if errors.Is(err, os.ErrNotExist) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("open file: %w", err)
	}
	return f, nil
}
