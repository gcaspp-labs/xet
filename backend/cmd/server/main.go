package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/pgx/v5/stdlib"

	"github.com/gcaspp-labs/xet/backend/db/migrations"
	"github.com/gcaspp-labs/xet/backend/internal/config"
	"github.com/gcaspp-labs/xet/backend/internal/core/auth"
	"github.com/gcaspp-labs/xet/backend/internal/core/directory"
	"github.com/gcaspp-labs/xet/backend/internal/core/realtime"
	"github.com/gcaspp-labs/xet/backend/internal/core/sectors"
	"github.com/gcaspp-labs/xet/backend/internal/core/storage"
	"github.com/gcaspp-labs/xet/backend/internal/core/users"
	"github.com/gcaspp-labs/xet/backend/internal/helpdesk"
	"github.com/gcaspp-labs/xet/backend/internal/helpdesk/messaging/fake"
	"github.com/gcaspp-labs/xet/backend/internal/helpdesk/messaging/whatsmeow"
	"github.com/gcaspp-labs/xet/backend/internal/server"
)

func main() {
	if len(os.Args) > 1 && os.Args[1] == "create-admin" {
		if err := runCreateAdmin(os.Args[2:]); err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(1)
		}
		return
	}
	if err := run(); err != nil {
		slog.Error("server stopped", "error", err)
		os.Exit(1)
	}
}

// openDatabase connects to the database and applies pending migrations.
func openDatabase(ctx context.Context, databaseURL string) (*pgxpool.Pool, error) {
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		return nil, fmt.Errorf("connect database: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping database: %w", err)
	}

	sqlDB := stdlib.OpenDBFromPool(pool)
	err = migrations.Up(ctx, sqlDB)
	_ = sqlDB.Close()
	if err != nil {
		pool.Close()
		return nil, err
	}
	return pool, nil
}

func run() error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}

	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: cfg.LogLevel}))
	slog.SetDefault(logger)

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	pool, err := openDatabase(ctx, cfg.DatabaseURL)
	if err != nil {
		return err
	}
	defer pool.Close()
	logger.Info("database migrated")

	hub := realtime.NewHub()
	tickets := helpdesk.NewService(pool, storage.NewDisk(cfg.StorageDir), hub)
	defer tickets.Wait()
	// Messages left pending by the previous run are not resent automatically.
	failed, err := tickets.FailPending(ctx)
	if err != nil {
		return err
	}
	if failed > 0 {
		logger.Warn("pending messages marked as failed", "count", failed)
	}
	opts := server.Options{SecureCookie: cfg.CookieSecure}
	switch cfg.MessagingProvider {
	case "fake":
		provider := fake.New(tickets.HandleEvent)
		opts.Messaging, opts.TestRoutes = provider, provider.Handler()
		logger.Warn("using the fake messaging provider: for end-to-end tests only")
	default:
		provider, err := whatsmeow.New(ctx, pool, tickets.HandleEvent, logger)
		if err != nil {
			return err
		}
		defer func() { _ = provider.Close() }()
		opts.Messaging = provider
	}
	tickets.SetProvider(opts.Messaging)

	// Reconnects the sector numbers in the background, so a slow WhatsApp
	// does not hold the API.
	go func() {
		if err := tickets.Reconnect(ctx, opts.Messaging); err != nil {
			logger.Error("reconnect sectors", "error", err)
		}
	}()

	srv := &http.Server{
		Addr: cfg.HTTPAddr,
		Handler: server.NewRouter(logger, server.Services{
			Auth:      auth.NewService(pool),
			Users:     users.NewService(pool),
			Sectors:   sectors.NewService(pool),
			Directory: directory.NewService(pool),
			Helpdesk:  tickets,
			Hub:       hub,
		}, opts),
		ReadHeaderTimeout: 10 * time.Second,
	}

	errCh := make(chan error, 1)
	go func() {
		logger.Info("server listening", "addr", cfg.HTTPAddr)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			errCh <- err
		}
		close(errCh)
	}()

	select {
	case err := <-errCh:
		return err
	case <-ctx.Done():
	}

	logger.Info("shutting down")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	return srv.Shutdown(shutdownCtx)
}
