// Package audio converts the audio recorded in the browser (WebM/Opus, or
// MP4/AAC in Safari) to what WhatsApp plays as a voice message: OGG/Opus,
// mono. The conversion runs the ffmpeg binary (docs/architecture.md).
package audio

import (
	"bytes"
	"context"
	"encoding/binary"
	"errors"
	"fmt"
	"math"
	"os"
	"os/exec"
	"strings"
	"time"
)

// VoiceMimeType is the type of a converted voice message.
const VoiceMimeType = "audio/ogg; codecs=opus"

// convertTimeout bounds a conversion; a 16 MB recording takes a few seconds.
const convertTimeout = time.Minute

// ErrInvalid means ffmpeg could not read an audio stream from the recording.
var ErrInvalid = errors.New("invalid audio")

// ToVoice converts a recording to OGG/Opus and returns it with its duration
// in seconds. The input goes through a temporary file because MP4 needs
// seeking, which a pipe does not allow.
func ToVoice(ctx context.Context, recording []byte) ([]byte, int, error) {
	in, err := os.CreateTemp("", "xet-voice-*")
	if err != nil {
		return nil, 0, fmt.Errorf("create temp file: %w", err)
	}
	defer func() { _ = os.Remove(in.Name()) }()
	if _, err := in.Write(recording); err != nil {
		_ = in.Close()
		return nil, 0, fmt.Errorf("write temp file: %w", err)
	}
	if err := in.Close(); err != nil {
		return nil, 0, fmt.Errorf("close temp file: %w", err)
	}

	ctx, cancel := context.WithTimeout(ctx, convertTimeout)
	defer cancel()
	cmd := exec.CommandContext(ctx, "ffmpeg", "-hide_banner", "-loglevel", "error", "-nostdin",
		"-i", in.Name(), "-map", "0:a:0", "-vn",
		"-c:a", "libopus", "-b:a", "32k", "-ac", "1", "-ar", "48000", "-application", "voip",
		"-f", "ogg", "pipe:1")
	var out, stderr bytes.Buffer
	cmd.Stdout, cmd.Stderr = &out, &stderr
	if err := cmd.Run(); err != nil {
		var exitErr *exec.ExitError
		if errors.As(err, &exitErr) && ctx.Err() == nil {
			return nil, 0, fmt.Errorf("%w: %s", ErrInvalid, strings.TrimSpace(stderr.String()))
		}
		return nil, 0, fmt.Errorf("run ffmpeg: %w", err)
	}
	seconds := duration(out.Bytes())
	if seconds == 0 {
		return nil, 0, fmt.Errorf("%w: empty audio", ErrInvalid)
	}
	return out.Bytes(), seconds, nil
}

// duration reads the length of an OGG/Opus file from the granule position
// of its last page, counted in 48 kHz samples after the pre-skip of the
// Opus header. Any audio at all counts as at least one second.
func duration(ogg []byte) int {
	last := bytes.LastIndex(ogg, []byte("OggS"))
	if last < 0 || len(ogg) < last+14 {
		return 0
	}
	samples := int64(binary.LittleEndian.Uint64(ogg[last+6 : last+14]))
	if head := bytes.Index(ogg, []byte("OpusHead")); head >= 0 && len(ogg) >= head+12 {
		samples -= int64(binary.LittleEndian.Uint16(ogg[head+10 : head+12]))
	}
	if samples <= 0 {
		return 0
	}
	return max(1, int(math.Round(float64(samples)/48000)))
}
