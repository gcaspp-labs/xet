GOLANGCI_LINT_IMAGE := golangci/golangci-lint:v2.14.0
SQLC_IMAGE := sqlc/sqlc:1.29.0
POSTGRES_IMAGE := postgres:17-alpine
# Binário estático do ffmpeg (com libopus) usado no CI; o digest fixa o conteúdo da imagem.
FFMPEG_IMAGE := mwader/static-ffmpeg:9.0.2@sha256:7d9bdaaf887f7e6ce6151f67325c344074b5ff1fb75316011c3376503e449a7b
# Caches do Go e do golangci-lint reaproveitados entre execuções do lint.
LINT_CACHE_DIR ?= $(HOME)/.cache/xet-lint

DEV_DATABASE_URL ?= postgres://xet:xet@localhost:5440/xet?sslmode=disable
E2E_DB_CONTAINER := xet-e2e-db
E2E_DATABASE_URL := postgres://xet:xet@localhost:15432/xet?sslmode=disable

.PHONY: dev dev-db dev-db-stop dev-restart dev-backend dev-frontend sqlc check-generated test test-backend test-e2e lint lint-backend lint-frontend ci-ffmpeg up down logs create-admin dev-create-admin

## Desenvolvimento: banco em :5440, backend em :8090 e frontend em :5173 (com proxy para o backend).
## Portas fora das padrão (5432/5433/8080/8081) para conviver com outros projetos rodando na mesma máquina.
dev: dev-db
	$(MAKE) -j2 dev-backend dev-frontend

dev-db:
	@docker start xet-dev-db >/dev/null 2>&1 || docker run -d --name xet-dev-db \
		-e POSTGRES_USER=xet -e POSTGRES_PASSWORD=xet -e POSTGRES_DB=xet \
		-p 5440:5432 -v xet-dev-db:/var/lib/postgresql/data $(POSTGRES_IMAGE) >/dev/null
	@until docker exec xet-dev-db pg_isready -h 127.0.0.1 -U xet -d xet >/dev/null 2>&1; do sleep 1; done

dev-db-stop:
	docker stop xet-dev-db

## Reinicia o backend e o frontend de desenvolvimento em segundo plano, liberando
## o terminal (log em /tmp/xet-dev.log). Necessário a cada mudança no backend,
## que roda com go run e não recarrega sozinho.
dev-restart: dev-db
	-@fuser -k -TERM 8090/tcp 5173/tcp >/dev/null 2>&1
	@for i in $$(seq 30); do fuser 8090/tcp 5173/tcp >/dev/null 2>&1 || break; sleep 1; done
	@setsid nohup $(MAKE) -j2 dev-backend dev-frontend > /tmp/xet-dev.log 2>&1 < /dev/null &
	@for i in $$(seq 120); do \
		curl -sf -o /dev/null http://localhost:8090/health && curl -sf -o /dev/null http://localhost:5173 && \
		echo "Ambiente de desenvolvimento no ar: http://localhost:5173 (log em /tmp/xet-dev.log)." && exit 0; \
		sleep 1; \
	done; echo "O ambiente não subiu em 2 minutos; veja /tmp/xet-dev.log." && exit 1

dev-backend:
	cd backend && DATABASE_URL="$(DEV_DATABASE_URL)" HTTP_ADDR=:8090 COOKIE_SECURE=false go run ./cmd/server

## Cria um administrador no banco de desenvolvimento; a senha é pedida no terminal.
## Uso: make dev-create-admin NAME="Maria Silva" EMAIL=maria@exemplo.com
dev-create-admin: dev-db
	cd backend && DATABASE_URL="$(DEV_DATABASE_URL)" go run ./cmd/server create-admin -name "$(NAME)" -email "$(EMAIL)"

## Gera o código Go das queries (backend/db/queries) com sqlc.
sqlc:
	docker run --rm -u "$$(id -u):$$(id -g)" -v "$(CURDIR)/backend":/src -w /src $(SQLC_IMAGE) generate

# Escuta em todas as interfaces para permitir testar pelo celular via Tailscale.
dev-frontend:
	cd frontend && npm run dev -- --host

## Confere se o código gerado (sqlc) e o go.mod estão em dia com o que foi commitado.
check-generated: sqlc
	cd backend && go mod tidy
	@git diff --exit-code -- backend/internal/db backend/go.mod backend/go.sum || \
		(echo "Código gerado desatualizado: rode make sqlc e go mod tidy e commite o resultado." && exit 1)
	@test -z "$$(git status --porcelain -- backend/internal/db)" || \
		(echo "Arquivos gerados pelo sqlc não commitados em backend/internal/db." && exit 1)

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
	@mkdir -p "$(LINT_CACHE_DIR)"
	docker run --rm -u "$$(id -u):$$(id -g)" -v "$(CURDIR)/backend":/app -v "$(LINT_CACHE_DIR)":/cache -w /app \
		-e HOME=/tmp -e GOCACHE=/cache/go-build -e GOMODCACHE=/cache/mod -e GOLANGCI_LINT_CACHE=/cache/golangci-lint \
		$(GOLANGCI_LINT_IMAGE) golangci-lint run ./...

lint-frontend:
	cd frontend && npm run lint

## Instala o ffmpeg do CI em /usr/local/bin, copiado da imagem estática (mais rápido e estável que o apt).
ci-ffmpeg:
	@id=$$(docker create $(FFMPEG_IMAGE)) && sudo docker cp $$id:/ffmpeg /usr/local/bin/ffmpeg; \
		status=$$?; docker rm $$id >/dev/null; exit $$status
	ffmpeg -hide_banner -encoders | grep -q libopus

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
