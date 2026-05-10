# Wedding Day Schedule — Admin-Configurable Design

**Date:** 2026-05-10
**Status:** Approved

## Overview

Make the Wedding Day Schedule section fully configurable from the admin page. Admins can create, edit, delete, and reorder schedule events. The guest-facing `DetailsSection` fetches events from the API instead of using hardcoded data.

## Data Model

### Fields per event
| Field | Type | Notes |
|-------|------|-------|
| `id` | integer | auto-generated primary key |
| `title` | string | e.g. "Holy Matrimony" |
| `time` | string | e.g. "2:00 PM – 3:00 PM" |
| `description` | string | event description |
| `sort_order` | integer | controls display order; updated via drag-and-drop |
| `created_at` | timestamp | set on insert |

## Database

New migration `009_add_schedule_events.sql`:

```sql
CREATE TABLE schedule_events (
  id          SERIAL PRIMARY KEY,
  title       TEXT NOT NULL,
  time        TEXT NOT NULL,
  description TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## Backend (Go)

### Model (`internal/models/`)

```go
type ScheduleEvent struct {
    ID          int       `json:"id"`
    Title       string    `json:"title"`
    Time        string    `json:"time"`
    Description string    `json:"description"`
    SortOrder   int       `json:"sortOrder"`
    CreatedAt   time.Time `json:"createdAt"`
}
```

### Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/schedule` | public | Returns all events ordered by `sort_order` |
| POST | `/api/admin/schedule` | admin | Create a new event |
| PUT | `/api/admin/schedule/{id}` | admin | Update title, time, description |
| DELETE | `/api/admin/schedule/{id}` | admin | Delete an event |
| PATCH | `/api/admin/schedule/reorder` | admin | Bulk-update `sort_order` for all events |

### Handler

New file `internal/handler/schedule.go`. Follows the same pattern as `welcome_screen.go` — handler struct receives the repository, each method decodes JSON, delegates to the repo, and writes JSON responses.

### Repository

New methods added to the repository interface (`internal/repository/repository.go`) and both implementations (`memory.go` and `postgres.go`):

- `GetScheduleEvents() ([]models.ScheduleEvent, error)`
- `CreateScheduleEvent(title, time, description string, sortOrder int) (models.ScheduleEvent, error)`
- `UpdateScheduleEvent(id int, title, time, description string) (models.ScheduleEvent, error)`
- `DeleteScheduleEvent(id int) error`
- `ReorderScheduleEvents(items []models.OrderItem) error`

`OrderItem` is a small struct `{ID int, SortOrder int}` used only for the reorder endpoint.

## Frontend — Admin Page

### New page: `client/src/pages/admin/SchedulePage.tsx`

- Fetches events via `GET /api/schedule` using React Query
- Renders a draggable list using `@dnd-kit/core` + `@dnd-kit/sortable`
- Each row shows: drag handle, title, time, description, Edit button, Delete button
- "Add Event" form at the bottom: title, time, description fields with Save/Cancel
- Edit opens the same form pre-populated inline (replaces the row)
- On drop: optimistically reorders the list, fires `PATCH /api/admin/schedule/reorder`. On API error, React Query's `onError` callback invalidates the query to restore the server-side order.
- Delete shows a confirm dialog before calling `DELETE /api/admin/schedule/{id}`

### Navigation

Add a **Schedule** item to `AdminLayout.tsx` navigation pointing to `/admin/schedule`.

### New dependency

```
@dnd-kit/core
@dnd-kit/sortable
```

## Frontend — Guest-Facing

### Changes to `DetailsSection.tsx`

- Remove import of `WEDDING_SCHEDULE` from `constants.ts`
- Add `useScheduleEvents()` hook (React Query, fetches `GET /api/schedule`)
- Render the timeline by mapping over the fetched events instead of the constant
- If the API returns an empty list, the entire "Wedding Day Schedule" section (heading + timeline) is hidden from the guest view

### Changes to `constants.ts`

- Remove the `WEDDING_SCHEDULE` array entirely

## Deployment Note

On first deploy to an environment with an empty `schedule_events` table, the schedule section will be blank. The admin must add the three initial events (Holy Matrimony, Teapai, Dinner Reception) via the admin page after deploying.

## Testing

- Table-driven handler tests in `internal/handler/schedule_test.go`
- Tests cover: list (empty and populated), create, update, delete, reorder
- Use in-memory repository — no database required (consistent with existing test pattern)
- Contract tests verify JSON field names are camelCase and status codes are correct
