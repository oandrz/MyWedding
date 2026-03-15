.PHONY: build test run run-dev lint clean

# Binary output
BINARY=wedding-server
BUILD_DIR=bin

build:
	go build -o $(BUILD_DIR)/$(BINARY) ./cmd/server

test:
	go test ./... -v -race -count=1

run: build
	GO_ENV=development $(BUILD_DIR)/$(BINARY)

run-dev:
	GO_ENV=development go run ./cmd/server

lint:
	golangci-lint run ./...

clean:
	rm -rf $(BUILD_DIR)

# Docker shortcuts
docker-dev:
	docker compose -f docker-compose.dev.yml up --build

docker-prod:
	docker compose -f docker-compose.prod.yml up --build

docker-down:
	docker compose -f docker-compose.dev.yml down
	docker compose -f docker-compose.prod.yml down

# Database migration (run inside container or with DATABASE_URL set)
migrate:
	psql "$(DATABASE_URL)" -f migrations/001_init.sql
