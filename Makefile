GOLANGCI_LINT_IMAGE := golangci/golangci-lint:v2.5.0

.PHONY: dev dev-backend dev-frontend test test-backend test-e2e lint lint-backend lint-frontend up down logs

## Desenvolvimento: backend em :8080 e frontend em :5173 (com proxy para o backend).
dev:
	$(MAKE) -j2 dev-backend dev-frontend

dev-backend:
	cd backend && go run ./cmd/server

dev-frontend:
	cd frontend && npm run dev

## Testes: integração do backend e ponta a ponta com Playwright.
test: test-backend test-e2e

test-backend:
	cd backend && go test -race ./...

test-e2e:
	cd frontend && npm run test:e2e

## Lint: golangci-lint (via Docker) no backend; oxlint e Prettier no frontend.
lint: lint-backend lint-frontend

lint-backend:
	docker run --rm -v "$(CURDIR)/backend":/app -w /app $(GOLANGCI_LINT_IMAGE) golangci-lint run ./...

lint-frontend:
	cd frontend && npm run lint

## Implantação local com Docker Compose (requer deploy/.env).
up:
	docker compose -f deploy/compose.yml --env-file deploy/.env up -d --build

down:
	docker compose -f deploy/compose.yml --env-file deploy/.env down

logs:
	docker compose -f deploy/compose.yml --env-file deploy/.env logs -f
