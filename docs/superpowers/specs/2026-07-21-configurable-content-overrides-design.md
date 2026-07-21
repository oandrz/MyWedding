# Configurable Content Overrides — Design

**Date:** 2026-07-21
**Status:** Approved (design)

## Goal

Make all build-time invitation text admin-configurable. Today the invitation's
prose and core facts are compiled in (`locales/en.ts`, `locales/id.ts`,
`lib/constants.ts`, plus literal JSX). Wedding hosts must edit code + rebuild to
change any wording, name, date, or venue detail. This adds a runtime override
layer so every string is editable from the admin page, bilingual (EN/ID),
including structural values (wedding date, venue times, map URLs).

## Non-Goals

- Not replacing the compiled `locales` files. They remain the default fallback.
- Not touching already-DB-backed content (welcome overlay, dress code colors,
  schedule, e-gift accounts, images). Those keep their existing endpoints.
- Not adding new languages. EN/ID only.
- No rich-text/WYSIWYG. Plain text and typed structural fields only.

## Architecture Overview

An override table stores `(key, locale, value)` rows. The frontend fetches all
overrides on load and merges them over the compiled defaults: a DB value wins,
otherwise the compiled `locales`/`constants` value is used. An empty table
therefore reproduces today's site exactly. A shared field registry declares
every editable key, its type, whether it's bilingual, and its default — driving
both the admin form and the fallback documentation.

## Components

### 1. Storage — `content_overrides` table

```sql
CREATE TABLE content_overrides (
  key    TEXT NOT NULL,
  locale TEXT NOT NULL,           -- 'en' | 'id' | '*'
  value  TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (key, locale)
);
```

- Bilingual fields store two rows (`en`, `id`).
- Structural / non-translated fields (date, map URL, venue times) store one row
  with `locale = '*'`.
- All values stored as `TEXT`. Typing and validation live in the registry layer,
  not the schema.
- Empty table ⇒ every read falls back to compiled defaults ⇒ current behavior.

Migration file: `go-server/migrations/011_content_overrides.sql`. No seed rows
(defaults are compiled in). Migrations are manual (`make migrate`); note that
docker-dev does not auto-apply, so the endpoint returns empty until run.

### 2. Field registry — `shared/contentRegistry.ts`

Single source of truth for what is editable:

```ts
type FieldType = "text" | "textarea" | "date" | "time" | "url";

interface ContentField {
  section: string;        // "Hero" | "Couple" | ...
  key: string;            // "hero.title", "couple.groomName", "wedding.date"
  label: string;          // human-friendly admin label
  type: FieldType;
  bilingual: boolean;     // true => en+id rows; false => '*' row
  defaultEn?: string;     // for bilingual: reference locales/en.ts value
  defaultId?: string;     // for bilingual: reference locales/id.ts value
  default?: string;       // for non-bilingual: reference constants.ts value
}

export const CONTENT_REGISTRY: ContentField[] = [ /* ... */ ];
```

Sections covered: Hero, Couple (incl. parent names, story paragraphs, quote),
Details/Venue, DressCode labels, Gallery, RSVP, Messages, EGift labels, Footer,
Nav. Structural keys: `wedding.date`, per-venue `time`/`mapUrl`/`address`.

The registry keys for prose MUST match existing `locales` keys so `t()` resolves
them. Defaults are the existing compiled values (referenced, not duplicated
where practical).

### 3. Runtime read path (frontend)

**Prose via `t()`** — `client/src/contexts/LanguageContext.tsx`:
- On mount, `useQuery(["/api/content-overrides"])` → build a map
  `overrides[locale][key]`.
- `t(key)` resolution order: `overrides[currentLocale][key]` → compiled
  `locales[currentLocale][key]` → key itself (existing behavior).
- Compiled defaults render immediately; override map swaps in when the fetch
  resolves. No empty-string flash (defaults always present).

**Structural via `useWeddingConfig()`** — new hook `client/src/hooks/useWeddingConfig.ts`:
- Reads `*`-locale overrides for `wedding.date`, venue `time`/`mapUrl`/`address`.
- Parses with validation; on parse failure or missing row, falls back to
  `lib/constants.ts`.
- Returns typed values (`Date`, venue objects) so downstream math is unchanged.
- Consumers switched from importing constants to the hook:
  `CountdownSection`, calendar-link builders, `DetailsSection` (map iframe +
  address + calendar), `HeroSection`, `Footer`.

### 4. Literal migration (one-time)

Route currently-non-`t()` literals through registry keys so they become
overridable:
- `CoupleSection.tsx` — parent names (`( † ) Mr. Buyung Oentoro`, etc.),
  `GROOM_NAME`/`BRIDE_NAME` headings.
- `NavBar.tsx` — nav labels (`Home`, `Our Story`, `Wedding Details`, `Wishes`),
  monogram (`A&C`), incl. mobile duplicates.
- `Footer.tsx` — monogram.
- `DetailsSection.tsx` / `constants.ts` — venue titles, location, address, times,
  map URLs.

Constants become registry defaults, not direct renders.

### 5. Backend — mirror the `app_settings` bulk pattern

- **Model** `go-server/internal/models/content_override.go`: `ContentOverride`
  (`key`, `locale`, `value`, `updatedAt`; camelCase JSON) and
  `InsertContentOverride`.
- **Handler** `go-server/internal/handler/content_override.go`:
  - `List` → `GET /api/content-overrides` (public) — returns all rows.
  - `BulkUpdate` → `PATCH /api/admin/content-overrides/bulk` (auth + CSRF group)
    — accepts `{ overrides: InsertContentOverride[] }`, upserts.
- **Repository** (`repository.go` interface + `postgres.go` + `memory.go`):
  - `GetAllContentOverrides() ([]ContentOverride, error)`
  - `UpsertContentOverrides([]InsertContentOverride) error` — bulk
    `INSERT ... ON CONFLICT (key, locale) DO UPDATE SET value = EXCLUDED.value,
    updated_at = now()`.
- **Routes** `router.go`: public `GET` near other public reads; admin `PATCH`
  inside the existing auth+CSRF group.
- **Validation** (`BulkUpdate`):
  - Reject keys not in a server-side allowlist (a Go slice mirroring the registry
    keys — kept in sync manually; a test asserts parity).
  - `locale ∈ {en, id, *}`.
  - For structural keys: `wedding.date` must parse (RFC3339 or the accepted
    display format); `*.mapUrl` must be a valid `http(s)` URL.
  - Generic length cap + trim/sanitize on all values (reuse existing sanitizer).
  - Full typed validation also runs client-side.

### 6. Admin editor — `ContentPage.tsx`

- New page `client/src/pages/admin/ContentPage.tsx`, registered in
  `AdminLayout.tsx` nav.
- `useQuery(["/api/content-overrides"])` loads current values; merged with
  registry defaults so empty overrides show the live default text.
- Rendered as an accordion, one panel per registry `section`. Each field:
  - bilingual → EN input + ID input side by side.
  - non-bilingual → single input.
  - typed input per `type` (textarea, native date picker, time, url).
- Bulk save: build `InsertContentOverride[]` (only changed / non-empty fields),
  `apiRequest("PATCH", "/api/admin/content-overrides/bulk", { overrides })`,
  `onSuccess` invalidate `["/api/content-overrides"]`, `onError`
  `handleAutoLogout` (from `AdminContext`). Wire via `apiRequest`/`queryClient`
  from `lib/queryClient.ts`.
- "Reset to default" per field = delete override / send empty so fallback wins
  (delete semantics: an empty value row is treated as absent, or bulk endpoint
  accepts a delete flag — pick delete flag for clarity).

## Data Flow

```
Admin edits ContentPage
  → PATCH /api/admin/content-overrides/bulk  (auth+CSRF)
  → handler validates against allowlist/type
  → repo UpsertContentOverrides
  → content_overrides table

Invitation page load
  → GET /api/content-overrides
  → LanguageContext builds override map  (prose)
  → useWeddingConfig parses structural overrides
  → t(key) / hook return override else compiled default
```

## Error Handling

- Fetch failure on `GET /api/content-overrides` → components render compiled
  defaults (fetch is enhancement, not required). Log, no user-facing error.
- Structural parse failure (bad date/url override) → fall back to constant, warn
  in console; admin-side validation should prevent reaching this state.
- Bulk save failure → toast + `handleAutoLogout` on 401, matching existing admin
  pages.
- Unknown key in bulk payload → 400, whole request rejected (no partial write).

## Testing

- **Backend contract test** (`handler/contract_test.go` style): `GET
  /api/content-overrides` returns array with camelCase `key`/`locale`/`value`;
  `PATCH .../bulk` requires CSRF, upserts, rejects unknown key (400) and bad
  date/url (400).
- **Repository test**: upsert then get round-trips; conflict updates value.
- **Registry parity test** (Go): server allowlist == registry keys (guards
  drift). Frontend test: every registry prose key exists in `locales/en.ts`.
- **Frontend**: `LanguageContext` returns override over default; falls back when
  absent; `useWeddingConfig` parses valid date and falls back on invalid.
- **Admin**: `ContentPage` renders a field per registry entry, saves changed
  fields, invalidates query (mirror `ConfigPage.test.tsx`).

## Open Risks / Notes

- **Registry ↔ Go allowlist drift.** Two sources (TS registry, Go slice). The
  parity test is the guard; keep both updated together.
- **Key count is large.** The registry is verbose but mechanical. Grouping by
  section keeps the admin UI navigable.
- **Date format.** Decide the accepted input format up front (recommend an ISO
  date-time picker producing RFC3339) so parsing is deterministic across
  countdown, calendar, and display.
- **Manual migration.** `011` must be run via `make migrate` before the endpoint
  works in any environment (per project convention).
