package config

import (
	"fmt"
	"log/slog"
	"os"
)

type Config struct {
	HTTPAddr string
	LogLevel slog.Level
}

func Load() (Config, error) {
	cfg := Config{
		HTTPAddr: getEnv("HTTP_ADDR", ":8080"),
	}

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
