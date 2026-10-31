GOLANGCI_LINT_IMAGE := golangci/golangci-lint:v2.14.0
SQLC_IMAGE := sqlc/sqlc:1.29.0
POSTGRES_IMAGE := postgres:17-alpine

DEV_DATABASE_URL ?= postgres://xet:xet@localhost:5433/xet?sslmode=disable
E2E_DB_CONTAINER := xet-e2e-db
E2E_DATABASE_URL := postgres://xet:xet@localhost:15432/xet?sslmode=disable

.PHONY: dev dev-db dev-db-stop dev-backend dev-frontend sqlc test test-backend test-e2e lint lint-backend lint-frontend up down logs create-admin dev-create-admin

## Desenvolvimento: banco em :5433, backend em :8080 e frontend em :5173 (com proxy para o backend).
dev: dev-db
	$(MAKE) -j2 dev-backend dev-frontend

dev-db:
	@docker start xet-dev-db >/dev/null 2>&1 || docker run -d --name xet-dev-db \
		-e POSTGRES_USER=xet -e POSTGRES_PASSWORD=xet -e POSTGRES_DB=xet \
		-p 5433:5432 -v xet-dev-db:/var/lib/postgresql/data $(POSTGRES_IMAGE) >/dev/null
	@until docker exec xet-dev-db pg_isready -h 127.0.0.1 -U xet -d xet >/dev/null 2>&1; do sleep 1; done

dev-db-stop:
	docker stop xet-dev-db

dev-backend:
	cd backend && DATABASE_URL="$(DEV_DATABASE_URL)" COOKIE_SECURE=false go run ./cmd/server

## Cria um administrador no banco de desenvolvimento; a senha é pedida no terminal.
## Uso: make dev-create-admin NAME="Maria Silva" EMAIL=maria@exemplo.com
dev-create-admin: dev-db
	cd backend && DATABASE_URL="$(DEV_DATABASE_URL)" go run ./cmd/server create-admin -name "$(NAME)" -email "$(EMAIL)"

## Gera o código Go das queries (backend/db/queries) com sqlc.
sqlc:
	docker run --rm -u "$$(id -u):$$(id -g)" -v "$(CURDIR)/backend":/src -w /src $(SQLC_IMAGE) generate

dev-frontend:
	cd frontend && npm run dev

## Testes: integração do backend e ponta a ponta com Playwright.
test: test-backend test-e2e

test-backend:
	cd backend && go test -race ./...

# Os testes ponta a ponta usam um banco próprio, criado do zero e removido ao final.
# O backend é compilado antes para que o Playwright não espere a compilação ao subir o servidor.
test-e2e:
	@cd backend && go build -o /dev/null ./cmd/server
	@docker rm -f $(E2E_DB_CONTAINER) >/dev/null 2>&1 || true
	@docker run -d --rm --name $(E2E_DB_CONTAINER) \
		-e POSTGRES_USER=xet -e POSTGRES_PASSWORD=xet -e POSTGRES_DB=xet \
		-p 15432:5432 $(POSTGRES_IMAGE) >/dev/null
	@until docker exec $(E2E_DB_CONTAINER) pg_isready -h 127.0.0.1 -U xet -d xet >/dev/null 2>&1; do sleep 1; done
	@cd frontend && DATABASE_URL="$(E2E_DATABASE_URL)" npm run test:e2e; \
		status=$$?; docker stop $(E2E_DB_CONTAINER) >/dev/null; exit $$status

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

## Cria um administrador no sistema em execução (make up); a senha é pedida no terminal.
## Uso: make create-admin NAME="Maria Silva" EMAIL=maria@exemplo.com
create-admin:
	docker compose -f deploy/compose.yml --env-file deploy/.env exec backend server create-admin -name "$(NAME)" -email "$(EMAIL)"
