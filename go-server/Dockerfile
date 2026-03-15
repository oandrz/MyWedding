# Stage 1: Build
FROM golang:1.23-alpine AS builder

RUN apk add --no-cache git

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /wedding-server ./cmd/server

# Stage 2: Run
FROM alpine:3.19

RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app

COPY --from=builder /wedding-server .
COPY --from=builder /app/.env.production .env.production
COPY --from=builder /app/migrations ./migrations

EXPOSE 5000

ENV GO_ENV=production

CMD ["./wedding-server"]
