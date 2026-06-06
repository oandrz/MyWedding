# Split "Total Expected Guests" by Event (RSVP page) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single "Total Expected Guests" card on the admin RSVP page with two per-event guest-headcount cards ("Matrimony Guests" and "Reception Guests").

**Architecture:** The RSVP `GetAll` handler already computes per-event response counts. We add two derived guest-count sums (`holyMatrimonyGuestCount`, `receptionGuestCount`) in the same loop, reusing a single `nil → 1` guest-count fallback per RSVP. The frontend RSVP page consumes the two new fields and renders two cards in place of the combined total. A `both` party counts toward both totals (intentional overlap for venue planning); declined parties are excluded automatically because `decline` never matches the event conditions.

**Tech Stack:** Go (Chi + pgx, in-memory repo for tests), React 18 + TypeScript, TanStack Query, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-06-04-rsvp-guests-split-by-event-design.md`

**Branch:** `feat/rsvp-guests-split-by-event` (already created; spec already committed there).

---

## File Structure

- `go-server/internal/handler/rsvp.go` — add two derived stats in the `GetAll` loop (modify ~lines 200–238).
- `go-server/internal/handler/rsvp_test.go` — add one new backend test asserting the two new fields and the `nil` fallback.
- `client/src/pages/admin/RsvpPage.tsx` — extend the `stats` type (lines 16–26), replace the total card and reorder cards (lines 105–141).
- `client/src/pages/admin/__tests__/RsvpPage.test.tsx` — update mock data + card assertions.

---

## Task 1: Backend — derive per-event guest counts

**Files:**
- Modify: `go-server/internal/handler/rsvp.go:200-238`
- Test: `go-server/internal/handler/rsvp_test.go` (add new test function at end of file)

- [ ] **Step 1: Write the failing test**

Add this function at the end of `go-server/internal/handler/rsvp_test.go`:

```go
func TestRsvp_ListStats_IncludesEventGuestCounts(t *testing.T) {
	env := newTestEnv()

	// name, phone, attendanceType, guestCount (nil pointer = omit field)
	four, two, three := 4, 2, 3
	for _, tc := range []struct {
		name, phone, attendanceType string
		guestCount                  *int
	}{
		{"Alice", "+6281234567890", "both", &four},            // HM +4, Rec +4
		{"Bob", "+6281234567891", "holy_matrimony", &two},     // HM +2
		{"Charlie", "+6281234567892", "reception", &three},    // Rec +3
		{"Dave", "+6281234567893", "holy_matrimony", nil},     // HM +1 (fallback)
		{"Diana", "+6281234567894", "decline", nil},           // excluded
	} {
		payload := map[string]interface{}{
			"name": tc.name, "phone": tc.phone, "attendanceType": tc.attendanceType,
		}
		if tc.guestCount != nil {
			payload["guestCount"] = *tc.guestCount
		}
		req := httptest.NewRequest(http.MethodPost, "/api/rsvp", jsonBody(payload))
		req.Header.Set("Content-Type", "application/json")
		contractResponse(t, env, req, http.StatusCreated)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/rsvp", nil)
	result := contractResponse(t, env, req, http.StatusOK)
	stats := result["stats"].(map[string]interface{})

	// holyMatrimonyGuestCount: both(4) + holy_matrimony(2) + holy_matrimony nil(1) = 7
	if stats["holyMatrimonyGuestCount"] != float64(7) {
		t.Fatalf("expected holyMatrimonyGuestCount=7, got %v", stats["holyMatrimonyGuestCount"])
	}
	// receptionGuestCount: both(4) + reception(3) = 7
	if stats["receptionGuestCount"] != float64(7) {
		t.Fatalf("expected receptionGuestCount=7, got %v", stats["receptionGuestCount"])
	}
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd go-server && go test ./internal/handler -run TestRsvp_ListStats_IncludesEventGuestCounts -v`
Expected: FAIL — `stats["holyMatrimonyGuestCount"]` is `<nil>`, not `7` (field does not exist yet).

- [ ] **Step 3: Implement the two derived sums**

In `go-server/internal/handler/rsvp.go`, the stats block currently reads (lines ~200–226):

```go
	// Calculate stats
	total := len(rsvps)
	attending := 0
	notAttending := 0
	guestCount := 0
	holyMatrimonyCount := 0
	receptionCount := 0

	for _, rsvp := range rsvps {
		if rsvp.IsAttending() {
			attending++
			if rsvp.GuestCount != nil {
				guestCount += *rsvp.GuestCount
			} else {
				guestCount += 1
			}
		} else {
			notAttending++
		}

		if rsvp.AttendanceType == "both" || rsvp.AttendanceType == "holy_matrimony" {
			holyMatrimonyCount++
		}
		if rsvp.AttendanceType == "both" || rsvp.AttendanceType == "reception" {
			receptionCount++
		}
	}
```

Replace that entire block with (single `g` fallback shared by all three sums):

```go
	// Calculate stats
	total := len(rsvps)
	attending := 0
	notAttending := 0
	guestCount := 0
	holyMatrimonyCount := 0
	receptionCount := 0
	holyMatrimonyGuestCount := 0
	receptionGuestCount := 0

	for _, rsvp := range rsvps {
		g := 1
		if rsvp.GuestCount != nil {
			g = *rsvp.GuestCount
		}

		if rsvp.IsAttending() {
			attending++
			guestCount += g
		} else {
			notAttending++
		}

		if rsvp.AttendanceType == "both" || rsvp.AttendanceType == "holy_matrimony" {
			holyMatrimonyCount++
			holyMatrimonyGuestCount += g
		}
		if rsvp.AttendanceType == "both" || rsvp.AttendanceType == "reception" {
			receptionCount++
			receptionGuestCount += g
		}
	}
```

Then add the two fields to the `stats` map in the JSON response (currently lines ~230–237):

```go
		"stats": map[string]int{
			"total":                   total,
			"attending":               attending,
			"notAttending":            notAttending,
			"guestCount":              guestCount,
			"holyMatrimonyCount":      holyMatrimonyCount,
			"receptionCount":          receptionCount,
			"holyMatrimonyGuestCount": holyMatrimonyGuestCount,
			"receptionGuestCount":     receptionGuestCount,
		},
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd go-server && go test ./internal/handler -run TestRsvp_ListStats_IncludesEventGuestCounts -v`
Expected: PASS.

- [ ] **Step 5: Run the full handler suite to confirm no regressions**

Run: `cd go-server && go test ./internal/handler -count=1`
Expected: `ok` — all tests pass (the existing `TestRsvp_ListStats_IncludesEventCounts` still passes; `guestCount` math is unchanged).

- [ ] **Step 6: Commit**

```bash
git add go-server/internal/handler/rsvp.go go-server/internal/handler/rsvp_test.go
git commit -m "feat(rsvp): derive per-event expected guest counts in stats"
```

---

## Task 2: Frontend — replace total card with two per-event guest cards

**Files:**
- Modify: `client/src/pages/admin/RsvpPage.tsx:16-26` (type), `:105-141` (cards)
- Test: `client/src/pages/admin/__tests__/RsvpPage.test.tsx`

- [ ] **Step 1: Update the test mock data and assertions (failing test)**

In `client/src/pages/admin/__tests__/RsvpPage.test.tsx`:

(a) Extend the `mockRsvpData.stats` object (currently lines 27–30) so it includes the two new fields. With Alice (`both`, 2), Bob (`holy_matrimony`, 1), Charlie (`reception`, 3), Diana (`decline`, null): matrimony guests = 2+1 = 3, reception guests = 2+3 = 5:

```js
  stats: {
    total: 4, attending: 3, notAttending: 1, guestCount: 6,
    holyMatrimonyCount: 2, receptionCount: 2,
    holyMatrimonyGuestCount: 3, receptionGuestCount: 5,
  },
```

(b) Replace the `it("renders 4 stat cards", ...)` test (lines 51–59) with:

```js
  it("renders 5 stat cards", () => {
    renderRsvpPage();
    expect(screen.getByText("Holy Matrimony RSVPs")).toBeInTheDocument();
    expect(screen.getByText("Reception RSVPs")).toBeInTheDocument();
    expect(screen.getByText("Matrimony Guests")).toBeInTheDocument();
    expect(screen.getByText("Reception Guests")).toBeInTheDocument();
    // "Declined" appears in stat card, filter tab, and badge — use getAllByText
    expect(screen.getAllByText("Declined").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId("stat-declined")).toBeInTheDocument();
    // Combined total card is gone
    expect(screen.queryByText("Total Expected Guests")).not.toBeInTheDocument();
  });
```

(c) Replace the `it("renders correct stat values", ...)` test (lines 61–67) with:

```js
  it("renders correct stat values", () => {
    renderRsvpPage();
    expect(screen.getByTestId("stat-holy-matrimony")).toHaveTextContent("2");
    expect(screen.getByTestId("stat-reception")).toHaveTextContent("2");
    expect(screen.getByTestId("stat-declined")).toHaveTextContent("1");
    expect(screen.getByTestId("stat-holy-matrimony-guests")).toHaveTextContent("3");
    expect(screen.getByTestId("stat-reception-guests")).toHaveTextContent("5");
  });
```

(d) Update the empty-state stats object (currently line 125) to include the two new fields:

```js
      stats: { total: 0, attending: 0, notAttending: 0, guestCount: 0, holyMatrimonyCount: 0, receptionCount: 0, holyMatrimonyGuestCount: 0, receptionGuestCount: 0 },
```

- [ ] **Step 2: Run the frontend test to verify it fails**

Run: `npm test -- RsvpPage`
Expected: FAIL — "Matrimony Guests" not found / `stat-holy-matrimony-guests` element missing (cards not added yet).

- [ ] **Step 3: Extend the `stats` type in RsvpPage.tsx**

In `client/src/pages/admin/RsvpPage.tsx`, change the `stats` interface (lines 18–25) to:

```ts
  stats: {
    total: number;
    attending: number;
    notAttending: number;
    guestCount: number;
    holyMatrimonyCount: number;
    receptionCount: number;
    holyMatrimonyGuestCount: number;
    receptionGuestCount: number;
  };
```

- [ ] **Step 4: Replace the cards block and reorder into event pairs**

In `client/src/pages/admin/RsvpPage.tsx`, replace the entire stats-cards `<div>` (lines 105–141, from `<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">` through its closing `</div>`) with:

```tsx
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
        <Card className="bg-gradient-to-r from-rose-400 to-pink-500 text-white shadow-lg" data-testid="stat-holy-matrimony">
          <CardHeader className="pb-2">
            <CardTitle className="text-2xl font-bold text-white">
              {data?.stats.holyMatrimonyCount ?? 0}
            </CardTitle>
            <CardDescription className="text-rose-100">Holy Matrimony RSVPs</CardDescription>
          </CardHeader>
        </Card>

        <Card className="bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-lg" data-testid="stat-holy-matrimony-guests">
          <CardHeader className="pb-2">
            <CardTitle className="text-2xl font-bold text-white">
              {data?.stats.holyMatrimonyGuestCount ?? 0}
            </CardTitle>
            <CardDescription className="text-rose-100">Matrimony Guests</CardDescription>
          </CardHeader>
        </Card>

        <Card className="bg-gradient-to-r from-purple-400 to-indigo-500 text-white shadow-lg" data-testid="stat-reception">
          <CardHeader className="pb-2">
            <CardTitle className="text-2xl font-bold text-white">
              {data?.stats.receptionCount ?? 0}
            </CardTitle>
            <CardDescription className="text-purple-100">Reception RSVPs</CardDescription>
          </CardHeader>
        </Card>

        <Card className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-lg" data-testid="stat-reception-guests">
          <CardHeader className="pb-2">
            <CardTitle className="text-2xl font-bold text-white">
              {data?.stats.receptionGuestCount ?? 0}
            </CardTitle>
            <CardDescription className="text-purple-100">Reception Guests</CardDescription>
          </CardHeader>
        </Card>

        <Card className="bg-gradient-to-r from-gray-400 to-gray-500 text-white shadow-lg" data-testid="stat-declined">
          <CardHeader className="pb-2">
            <CardTitle className="text-2xl font-bold text-white">
              {data?.stats.notAttending ?? 0}
            </CardTitle>
            <CardDescription className="text-gray-200">Declined</CardDescription>
          </CardHeader>
        </Card>
      </div>
```

- [ ] **Step 5: Run the frontend test to verify it passes**

Run: `npm test -- RsvpPage`
Expected: PASS — all RsvpPage tests green.

- [ ] **Step 6: Type-check**

Run: `npm run check`
Expected: no TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add client/src/pages/admin/RsvpPage.tsx client/src/pages/admin/__tests__/RsvpPage.test.tsx
git commit -m "feat(rsvp): show Matrimony/Reception guest cards in place of total"
```

---

## Final Verification

- [ ] **Backend:** `cd go-server && make test` → all pass.
- [ ] **Frontend:** `npm test` → all pass; `npm run check` → clean.
- [ ] **Manual smoke (optional):** `npm run build && cd go-server && STATIC_DIR=../dist/public go run ./cmd/server`, log in to admin, open the RSVP tab, confirm five cards render in order: Holy Matrimony RSVPs, Matrimony Guests, Reception RSVPs, Reception Guests, Declined — and that a `both` party's guests appear in both Matrimony and Reception totals.
