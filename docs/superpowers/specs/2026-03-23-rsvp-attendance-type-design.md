# RSVP Attendance Type — Design Spec

**Date:** 2026-03-23
**Status:** Approved

## Goal

Update the RSVP form so guests can indicate whether they're attending the Holy Matrimony, Reception, or Both. Track per-event attendance counts on the admin page.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Attendance model | No separate accept/decline — event selection IS the attendance answer | Fewer steps, cleaner UX |
| Guest count scope | Single count applies to all selected events | Simpler for guests, typical wedding convention |
| Data model | Replace `attending` boolean with `attendance_type` string | Single column, no redundancy, clean semantics |
| Form UI | Pill toggle buttons (wrapping row) | Compact, fits alongside existing fields without bloating the form |
| Admin stats | 4 stat cards (Holy Matrimony, Reception, Declined, Total Expected Guests) | Full picture at a glance |
| Admin filters | 5 tabs (All, Holy Matrimony, Reception, Both, Declined) | Quick access to per-event guest lists |
| Admin badges | Event-specific colored badges per RSVP card | Visual clarity for attendance type |
| Default value | Keep `DEFAULT 'both'` on column after migration | Safety net for unexpected inserts |
| Testing | TDD — write tests first, then implement | Per project conventions |

## Data Model

### Migration: `002_attendance_type.sql`

```sql
ALTER TABLE rsvp ADD COLUMN attendance_type TEXT NOT NULL DEFAULT 'both';

UPDATE rsvp SET attendance_type = CASE
  WHEN attending = true THEN 'both'
  ELSE 'decline'
END;

ALTER TABLE rsvp DROP COLUMN attending;
```

Valid values: `"both"`, `"holy_matrimony"`, `"reception"`, `"decline"`

Default `'both'` is retained as a safety net after migration.

### Go Model

```go
type Rsvp struct {
    ID             int    `json:"id"`
    Name           string `json:"name"`
    Email          string `json:"email"`
    AttendanceType string `json:"attendanceType"`
    GuestCount     *int   `json:"guestCount"`
}

type InsertRsvp struct {
    Name           string `json:"name"`
    Email          string `json:"email"`
    AttendanceType string `json:"attendanceType"`
    GuestCount     *int   `json:"guestCount"`
}

// Helper method
func (r Rsvp) IsAttending() bool {
    return r.AttendanceType != "decline"
}
```

### Shared Schema (`shared/schema.ts`)

```typescript
export const rsvp = pgTable("rsvp", {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    attendanceType: text("attendance_type").notNull().default("both"),
    guestCount: integer("guest_count"),
});
```

### Validation

```go
var validAttendanceTypes = map[string]bool{
    "both": true, "holy_matrimony": true,
    "reception": true, "decline": true,
}
```

## Backend API Changes

### POST /api/rsvp

- Accept `attendanceType` instead of `attending`
- Validate `attendanceType` is one of the 4 valid values — return 400 otherwise
- If `attendanceType == "decline"`, force `guestCount` to `nil`
- Upsert-by-email logic unchanged

### GET /api/rsvp

Stats object expands:

```json
{
  "total": 100,
  "attending": 85,
  "notAttending": 15,
  "guestCount": 120,
  "holyMatrimonyCount": 70,
  "receptionCount": 80
}
```

- `attending` = count where `attendanceType != "decline"`
- `notAttending` = count where `attendanceType == "decline"`
- `holyMatrimonyCount` = count where `attendanceType IN ("both", "holy_matrimony")`
- `receptionCount` = count where `attendanceType IN ("both", "reception")`

### GET /api/rsvp/check

No logic change — `attendanceType` included automatically from model.

### DELETE /api/rsvp/{id}

No change.

## Frontend: RSVP Form (`RsvpSection.tsx`)

### Schema

Replace `attending: z.boolean()` with `attendanceType: z.enum(["both", "holy_matrimony", "reception", "decline"])`, default `"both"`.

### UI

Replace the two radio buttons with 4 pill buttons in a wrapping flex row:

- **Both** | **Holy Matrimony** | **Reception** | **Decline**
- Active pill: `bg-primary text-white`
- Inactive pills: bordered, muted
- "Decline" pill visually subdued

### Conditional Logic

- Guest count dropdown visible when `attendanceType != "decline"`
- Switching to "Decline" clears `guestCount`

### Submission

Sends `{ name, email, attendanceType, guestCount }`.

### Already-RSVP'd State

Update thank-you message to reflect which events: e.g., "We've received your RSVP for the Holy Matrimony and Reception".

### Confetti

Triggers only when `attendanceType != "decline"`.

## Frontend: Admin Page (`RsvpPage.tsx`)

### Stat Cards (4 total)

1. **Holy Matrimony** — `holyMatrimonyCount`
2. **Reception** — `receptionCount`
3. **Declined** — `notAttending`
4. **Total Expected Guests** — `guestCount` (sum of guest counts for all attending)

### Filter Tabs (5 total)

- All | Holy Matrimony | Reception | Both | Declined
- "Holy Matrimony" tab: `attendanceType IN ("both", "holy_matrimony")`
- "Reception" tab: `attendanceType IN ("both", "reception")`
- "Both" tab: `attendanceType == "both"` only
- "Declined" tab: `attendanceType == "decline"`

### RSVP Card Badges

- `"both"` → rose "Holy Matrimony" badge + purple "Reception" badge
- `"holy_matrimony"` → rose "Holy Matrimony" badge
- `"reception"` → purple "Reception" badge
- `"decline"` → red "Declined" badge

### No Changes

Search, delete flow, empty states, loading states unchanged.

## Testing — TDD Approach

All tests written and confirmed failing before implementation.

### Backend TDD Sequence

1. **Model tests** — `AttendanceType` field exists, `IsAttending()` returns correct bool for all 4 values
2. **Validation tests** — invalid `attendanceType` returns 400, valid values return 200/201
3. **Handler tests:**
   - `TestRsvp_Create_WithAttendanceType` — each of 4 types stored correctly
   - `TestRsvp_Decline_ClearsGuestCount` — decline with guestCount → nil in response
   - `TestRsvp_InvalidAttendanceType_Returns400` — reject unknown values
   - `TestRsvp_DuplicateEmail_UpdatesAttendanceType` — update from "both" to "reception"
   - `TestRsvp_ListStats_IncludesEventCounts` — mixed types, verify `holyMatrimonyCount` and `receptionCount`
4. **Contract tests** — expect `attendanceType` string instead of `attending` boolean
5. **Repository tests** — in-memory repo stores and retrieves `AttendanceType`

### Frontend TDD Sequence

1. **RsvpSection tests:**
   - Pill buttons render with correct labels
   - Clicking pill updates form state
   - Guest count hides when "Decline" selected
   - Guest count shows for other 3 options
   - Submission payload contains `attendanceType`
2. **RsvpPage tests:**
   - 4 stat cards with correct labels/values
   - 5 filter tabs render
   - Each filter shows correct RSVP subset
   - Event-specific badges per attendance type
   - "Holy Matrimony" filter includes "both" guests
   - "Reception" filter includes "both" guests

## Files Modified

| File | Change |
|------|--------|
| `go-server/migrations/002_attendance_type.sql` | New migration |
| `go-server/internal/models/rsvp.go` | Replace `Attending` with `AttendanceType`, add `IsAttending()` |
| `go-server/internal/handler/rsvp.go` | Validation, stats computation, decline→nil guestCount |
| `go-server/internal/repository/repository.go` | Interface unchanged (field change is in models) |
| `go-server/internal/repository/postgres.go` | Update SQL queries for `attendance_type` column |
| `go-server/internal/repository/memory.go` | Update in-memory store for new field |
| `go-server/internal/handler/rsvp_test.go` | New and updated tests |
| `go-server/internal/handler/contract_test.go` | Update RSVP contract |
| `shared/schema.ts` | Replace `attending` with `attendanceType` |
| `client/src/components/RsvpSection.tsx` | Pill buttons, schema, conditional logic |
| `client/src/components/__tests__/RsvpSection.test.tsx` | Updated tests |
| `client/src/pages/admin/RsvpPage.tsx` | 4 stats, 5 filters, event badges |
| `client/src/pages/admin/__tests__/RsvpPage.test.tsx` | Updated tests |
