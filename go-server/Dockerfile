# Stage 1: Build frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY package.json pnpm-lock.yaml* package-lock.json* ./
RUN npm ci || npm install
COPY client/ ./client/
COPY shared/ ./shared/
COPY vite.config.ts postcss.config.js tailwind.config.ts theme.json tsconfig.json ./
RUN npm run build

# Stage 2: Build Go binary
FROM golang:1.25-alpine AS go-builder
RUN apk add --no-cache git
WORKDIR /app
COPY go-server/go.mod go-server/go.sum ./
RUN go mod download
COPY go-server/ .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /wedding-server ./cmd/server

# Stage 3: Runtime
FROM alpine:3.19
RUN apk add --no-cache ca-certificates tzdata
WORKDIR /app
COPY --from=go-builder /wedding-server .
COPY --from=go-builder /app/migrations ./migrations
COPY --from=frontend-builder /app/dist/public ./dist/public
EXPOSE 5000
ENV GO_ENV=production
ENV STATIC_DIR=./dist/public
CMD ["./wedding-server"]
