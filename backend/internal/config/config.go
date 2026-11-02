package config

import (
	"errors"
	"fmt"
	"log/slog"
	"os"
	"strconv"
)

type Config struct {
	HTTPAddr     string
	DatabaseURL  string
	LogLevel     slog.Level
	CookieSecure bool
	// TrustProxy takes the client IP from X-Forwarded-For, for a backend
	// reachable just through the reverse proxy.
	TrustProxy bool
	// MessagingProvider is "whatsmeow" or, for the end-to-end tests, "fake".
	MessagingProvider string
	// StorageDir is the directory of the message attachments.
	StorageDir string
}

func Load() (Config, error) {
	cfg := Config{
		HTTPAddr:          getEnv("HTTP_ADDR", ":8080"),
		DatabaseURL:       os.Getenv("DATABASE_URL"),
		MessagingProvider: getEnv("MESSAGING_PROVIDER", "whatsmeow"),
		StorageDir:        getEnv("STORAGE_DIR", "data/media"),
	}

	if cfg.DatabaseURL == "" {
		return Config{}, errors.New("DATABASE_URL is required")
	}

	if cfg.MessagingProvider != "whatsmeow" && cfg.MessagingProvider != "fake" {
		return Config{}, fmt.Errorf("MESSAGING_PROVIDER: unknown provider %q", cfg.MessagingProvider)
	}

	cookieSecure, err := strconv.ParseBool(getEnv("COOKIE_SECURE", "true"))
	if err != nil {
		return Config{}, fmt.Errorf("COOKIE_SECURE: %w", err)
	}
	cfg.CookieSecure = cookieSecure

	trustProxy, err := strconv.ParseBool(getEnv("TRUST_PROXY", "false"))
	if err != nil {
		return Config{}, fmt.Errorf("TRUST_PROXY: %w", err)
	}
	cfg.TrustProxy = trustProxy

	if err := cfg.LogLevel.UnmarshalText([]byte(getEnv("LOG_LEVEL", "info"))); err != nil {
		return Config{}, fmt.Errorf("LOG_LEVEL: %w", err)
	}

	return cfg, nil
}

func getEnv(key, fallback string) string {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		return v
	}
	return fallback
}
