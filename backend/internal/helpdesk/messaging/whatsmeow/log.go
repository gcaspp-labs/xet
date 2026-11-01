package whatsmeow

import (
	"context"
	"fmt"
	"log/slog"

	waLog "go.mau.fi/whatsmeow/util/log"
)

// logger sends the Whatsmeow logs to the structured log of the service.
type logger struct {
	l      *slog.Logger
	module string
}

func newLogger(l *slog.Logger, module string) waLog.Logger {
	return logger{l: l, module: module}
}

func (w logger) log(level slog.Level, msg string, args []any) {
	// The Whatsmeow logger interface carries no context.
	w.l.Log(context.Background(), level, fmt.Sprintf(msg, args...), "component", "whatsmeow", "module", w.module)
}

func (w logger) Errorf(msg string, args ...any) { w.log(slog.LevelError, msg, args) }
func (w logger) Warnf(msg string, args ...any)  { w.log(slog.LevelWarn, msg, args) }
func (w logger) Infof(msg string, args ...any)  { w.log(slog.LevelInfo, msg, args) }
func (w logger) Debugf(msg string, args ...any) { w.log(slog.LevelDebug, msg, args) }

func (w logger) Sub(module string) waLog.Logger {
	return logger{l: w.l, module: w.module + "/" + module}
}
