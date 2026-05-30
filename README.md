# MyWedding — Wedding E-Invitation Platform

A full-stack, self-hostable wedding e-invitation platform: a customizable public invitation site plus an admin panel for managing RSVPs, guests, media, and messaging.

> **Setup & deployment:** see [DEPLOYMENT.md](DEPLOYMENT.md).
> **License terms:** see [LICENSE](LICENSE).

## Features

- RSVP management with groom/bride side filtering
- Invite codes and guest list management
- WhatsApp automated invite delivery (via `whatsmeow` — see the ToS note in DEPLOYMENT.md)
- Admin panel: feature flags, app settings, and activity logging
- Photo gallery (optional Google Drive integration) and guest "memories" upload
- Guest message board and scheduled messaging
- E-gift (bank transfer) details, QR codes, and bilingual UI (English / Indonesian)

## Tech Stack

- **Backend:** Go (Chi router + pgx) + PostgreSQL — single binary, also serves the built frontend
- **Frontend:** React 18 + TypeScript + Vite + TanStack Query + Tailwind CSS + Shadcn/Radix UI
- **Optional:** Redis (sessions), Supabase (object storage) — both have built-in fallbacks

## Quick Start

```bash
# Frontend
npm install
npm run build

# Backend (serves the built frontend from STATIC_DIR)
cd go-server
make build
STATIC_DIR=../dist/public ./bin/wedding-server
```

For local full-stack development, environment variables, database migrations, admin
authentication, Google Drive, and WhatsApp setup, see **[DEPLOYMENT.md](DEPLOYMENT.md)**.

## Repository Layout

- `client/` — React frontend (`@` → `client/src`, `@shared` → `shared/`)
- `go-server/` — Go backend (handlers, repository, services, migrations)
- `shared/` — shared schema / validation
- `tests/` — frontend test suite (`npm test`)
