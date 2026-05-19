# Localization EN/ID Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add bilingual English/Bahasa Indonesia support to the entire wedding invitation with URL-param persistence and auto-generated translations.

**Architecture:** Custom `LanguageContext` wraps `AppContent` in `App.tsx` and exposes `lang`, `setLang`, `t()`, and `dateLocale`. Flat TypeScript dictionaries (`locales/en.ts`, `locales/id.ts`) hold all static strings. `?lang=id` in the URL controls the active language — `setLang` updates state and rewrites the URL with `history.replaceState` (no page reload). The backend adds dual-language VARCHAR columns to `welcome_screen` and `schedule_events` so admin-configured text (heading, delivery label, event titles/descriptions) can be edited in both languages.

**Tech Stack:** React 18 + TypeScript, custom React Context, Go/pgx, PostgreSQL migration

---

## File Map

**New files:**
- `go-server/migrations/010_add_localization_fields.sql`
- `client/src/locales/en.ts`
- `client/src/locales/id.ts`
- `client/src/contexts/LanguageContext.tsx`
- `client/src/contexts/__tests__/LanguageContext.test.tsx`

**Modified files:**
- `go-server/internal/models/welcome_screen.go` — add `HeadingTextId`, `DeliveryLabelId`
- `go-server/internal/models/schedule_event.go` — add `TitleId`, `DescriptionId`
- `go-server/internal/repository/memory.go` — update WelcomeScreen + ScheduleEvent methods
- `go-server/internal/repository/postgres.go` — update SELECT/INSERT/UPDATE SQL
- `go-server/internal/handler/welcome_screen.go` — sanitize new fields
- `go-server/internal/handler/handler_test.go` — add `TestWelcomeScreenHasLocalizationFields`
- `go-server/internal/handler/schedule_test.go` — add `TestScheduleEventHasLocalizationFields`
- `shared/schema.ts` — add `headingTextId`, `deliveryLabelId` to `welcomeScreen` table
- `client/src/App.tsx` — wrap `AppContent` with `LanguageProvider`
- `client/src/components/WelcomeOverlay.tsx` — language picker UI + `t()` + heading/delivery fallback
- `client/src/components/__tests__/WelcomeOverlay.test.tsx` — mock `useLanguage`
- `client/src/components/NavBar.tsx` — language toggle
- `client/src/components/__tests__/NavBar.test.tsx` — mock `useLanguage`
- `client/src/components/HeroSection.tsx` — `t()` + `dateLocale`
- `client/src/components/DetailsSection.tsx` — `t()` + `dateLocale` + `titleId`/`descriptionId`
- `client/src/components/BibleVerseSection.tsx` — `t("bibleVerse")`, `t("bibleVerseRef")`
- `client/src/components/CoupleSection.tsx` — `t()` for all labels + story paragraphs
- `client/src/components/DressCodeSection.tsx` — `t()` for heading/subtitle
- `client/src/components/GallerySection.tsx` — `t("ourGallery")`, `t("gallerySubtitle")`
- `client/src/components/RsvpSection.tsx` — `t()` + `interpolate()` for confirmation messages
- `client/src/components/MessagesSection.tsx` — `t()` + `interpolate(t("seeAllWishes"), {count})`
- `client/src/components/EGiftSection.tsx` — `t()` for all labels
- `client/src/components/Footer.tsx` — `t("madeWithLove")` + `dateLocale`
- `client/src/pages/admin/WelcomePage.tsx` — add `headingTextId`, `deliveryLabelId` inputs
- `client/src/pages/admin/__tests__/WelcomePage.test.tsx` — update mock data
- `client/src/pages/admin/SchedulePage.tsx` — add `titleId`, `descriptionId` to local interface + form

---

### Task 1: Go Backend — Bilingual Fields

**Files:**
- Create: `go-server/migrations/010_add_localization_fields.sql`
- Modify: `go-server/internal/models/welcome_screen.go`
- Modify: `go-server/internal/models/schedule_event.go`
- Modify: `go-server/internal/repository/memory.go`
- Modify: `go-server/internal/repository/postgres.go:628-670,1060-1116`
- Modify: `go-server/internal/handler/welcome_screen.go`
- Modify: `go-server/internal/handler/handler_test.go`
- Modify: `go-server/internal/handler/schedule_test.go`

- [ ] **Step 1: Write failing backend tests**

Add to `go-server/internal/handler/handler_test.go` after the existing test functions:

```go
func TestWelcomeScreenHasLocalizationFields(t *testing.T) {
	env := newTestEnv()
	req := httptest.NewRequest(http.MethodGet, "/api/welcome-screen", nil)
	rec := httptest.NewRecorder()
	env.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	result := parseResponse(t, rec)
	ws, ok := result["welcomeScreen"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected welcomeScreen object, got keys: %v", mapKeys(result))
	}
	assertKeyExists(t, ws, "headingTextId")
	assertKeyExists(t, ws, "deliveryLabelId")
}
```

Add to `go-server/internal/handler/schedule_test.go` after `TestScheduleDelete_NotFound`:

```go
func TestScheduleEventHasLocalizationFields(t *testing.T) {
	env := newTestEnv()
	cookie, csrfToken := adminLogin(t, env)

	body := jsonBody(map[string]interface{}{
		"title":       "Holy Matrimony",
		"time":        "2:00 PM - 3:00 PM",
		"description": "Exchange of vows",
		"sortOrder":   0,
		"titleId":     "Pemberkatan Nikah",
		"descriptionId": "Pertukaran janji dan cincin",
	})
	req := adminRequest(http.MethodPost, "/api/admin/schedule", body, cookie, csrfToken)
	rec := httptest.NewRecorder()
	env.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", rec.Code, rec.Body.String())
	}
	result := parseResponse(t, rec)
	event, ok := result["scheduleEvent"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected scheduleEvent, got keys: %v", mapKeys(result))
	}
	assertKeyExists(t, event, "titleId")
	assertKeyExists(t, event, "descriptionId")
	if event["titleId"] != "Pemberkatan Nikah" {
		t.Fatalf("expected titleId 'Pemberkatan Nikah', got %v", event["titleId"])
	}
}
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd go-server && go test ./internal/handler -run "TestWelcomeScreenHasLocalizationFields|TestScheduleEventHasLocalizationFields" -v
```

Expected: FAIL — fields do not exist yet.

- [ ] **Step 3: Write migration SQL**

Create `go-server/migrations/010_add_localization_fields.sql`:

```sql
ALTER TABLE welcome_screen
  ADD COLUMN IF NOT EXISTS heading_text_id  VARCHAR(500) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS delivery_label_id VARCHAR(200) NOT NULL DEFAULT '';

ALTER TABLE schedule_events
  ADD COLUMN IF NOT EXISTS title_id       VARCHAR(200) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS description_id TEXT         NOT NULL DEFAULT '';
```

- [ ] **Step 4: Update Go models**

Replace `go-server/internal/models/welcome_screen.go`:

```go
package models

type WelcomeScreen struct {
	ID              int    `json:"id"`
	HeadingText     string `json:"headingText"`
	HeadingTextId   string `json:"headingTextId"`
	DeliveryLabel   string `json:"deliveryLabel"`
	DeliveryLabelId string `json:"deliveryLabelId"`
	FallbackName    string `json:"fallbackName"`
	Enabled         bool   `json:"enabled"`
	UpdatedAt       string `json:"updatedAt"`
}

type InsertWelcomeScreen struct {
	HeadingText     *string `json:"headingText"`
	HeadingTextId   *string `json:"headingTextId"`
	DeliveryLabel   *string `json:"deliveryLabel"`
	DeliveryLabelId *string `json:"deliveryLabelId"`
	FallbackName    *string `json:"fallbackName"`
	Enabled         *bool   `json:"enabled"`
}
```

Replace `go-server/internal/models/schedule_event.go`:

```go
// go-server/internal/models/schedule_event.go
package models

type ScheduleEvent struct {
	ID            int    `json:"id"`
	Title         string `json:"title"`
	TitleId       string `json:"titleId"`
	Time          string `json:"time"`
	Description   string `json:"description"`
	DescriptionId string `json:"descriptionId"`
	SortOrder     int    `json:"sortOrder"`
	CreatedAt     string `json:"createdAt"`
}

type InsertScheduleEvent struct {
	Title         string `json:"title"`
	TitleId       string `json:"titleId"`
	Time          string `json:"time"`
	Description   string `json:"description"`
	DescriptionId string `json:"descriptionId"`
	SortOrder     int    `json:"sortOrder"`
}

type UpdateScheduleEvent struct {
	Title         string `json:"title"`
	TitleId       string `json:"titleId"`
	Time          string `json:"time"`
	Description   string `json:"description"`
	DescriptionId string `json:"descriptionId"`
}

type ScheduleOrderItem struct {
	ID        int `json:"id"`
	SortOrder int `json:"sortOrder"`
}
```

- [ ] **Step 5: Update memory repository**

In `go-server/internal/repository/memory.go`, replace the `UpdateWelcomeScreen` function (currently lines 578-609):

```go
func (m *MemoryRepository) UpdateWelcomeScreen(_ context.Context, data models.InsertWelcomeScreen) (*models.WelcomeScreen, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.welcomeScreen == nil {
		m.welcomeScreen = &models.WelcomeScreen{
			ID:              1,
			HeadingText:     "Welcome",
			HeadingTextId:   "",
			DeliveryLabel:   "Delivery",
			DeliveryLabelId: "",
			FallbackName:    "Guest",
			Enabled:         true,
			UpdatedAt:       now(),
		}
	}

	if data.HeadingText != nil {
		m.welcomeScreen.HeadingText = *data.HeadingText
	}
	if data.HeadingTextId != nil {
		m.welcomeScreen.HeadingTextId = *data.HeadingTextId
	}
	if data.DeliveryLabel != nil {
		m.welcomeScreen.DeliveryLabel = *data.DeliveryLabel
	}
	if data.DeliveryLabelId != nil {
		m.welcomeScreen.DeliveryLabelId = *data.DeliveryLabelId
	}
	if data.FallbackName != nil {
		m.welcomeScreen.FallbackName = *data.FallbackName
	}
	if data.Enabled != nil {
		m.welcomeScreen.Enabled = *data.Enabled
	}
	m.welcomeScreen.UpdatedAt = now()

	ws := *m.welcomeScreen
	return &ws, nil
}
```

In `memory.go`, replace `CreateScheduleEvent` (currently lines 881-895):

```go
func (m *MemoryRepository) CreateScheduleEvent(_ context.Context, data models.InsertScheduleEvent) (*models.ScheduleEvent, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.scheduleIDSeq++
	e := models.ScheduleEvent{
		ID:            m.scheduleIDSeq,
		Title:         data.Title,
		TitleId:       data.TitleId,
		Time:          data.Time,
		Description:   data.Description,
		DescriptionId: data.DescriptionId,
		SortOrder:     data.SortOrder,
		CreatedAt:     now(),
	}
	m.scheduleEvents[e.ID] = e
	return &e, nil
}
```

In `memory.go`, replace `UpdateScheduleEvent` (currently lines 897-909):

```go
func (m *MemoryRepository) UpdateScheduleEvent(_ context.Context, id int, data models.UpdateScheduleEvent) (*models.ScheduleEvent, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	e, ok := m.scheduleEvents[id]
	if !ok {
		return nil, nil
	}
	e.Title = data.Title
	e.TitleId = data.TitleId
	e.Time = data.Time
	e.Description = data.Description
	e.DescriptionId = data.DescriptionId
	m.scheduleEvents[id] = e
	return &e, nil
}
```

- [ ] **Step 6: Update postgres repository — WelcomeScreen**

In `go-server/internal/repository/postgres.go`, replace `GetWelcomeScreen` (lines 628-643):

```go
func (r *PostgresRepository) GetWelcomeScreen(ctx context.Context) (*models.WelcomeScreen, error) {
	var ws models.WelcomeScreen
	var updatedAt time.Time
	err := r.pool.QueryRow(ctx,
		`SELECT id, heading_text, heading_text_id, delivery_label, delivery_label_id,
		        fallback_name, enabled, updated_at
		 FROM welcome_screen WHERE id = 1`,
	).Scan(&ws.ID, &ws.HeadingText, &ws.HeadingTextId, &ws.DeliveryLabel, &ws.DeliveryLabelId,
		&ws.FallbackName, &ws.Enabled, &updatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	ws.UpdatedAt = updatedAt.Format(time.RFC3339)
	return &ws, nil
}
```

In `postgres.go`, replace `UpdateWelcomeScreen` (lines 645-670):

```go
func (r *PostgresRepository) UpdateWelcomeScreen(ctx context.Context, data models.InsertWelcomeScreen) (*models.WelcomeScreen, error) {
	var ws models.WelcomeScreen
	var updatedAt time.Time

	err := r.pool.QueryRow(ctx,
		`INSERT INTO welcome_screen (id, heading_text, heading_text_id, delivery_label, delivery_label_id, fallback_name, enabled)
		 VALUES (1,
		     COALESCE($1, 'Welcome'),
		     COALESCE($2, ''),
		     COALESCE($3, 'Delivery'),
		     COALESCE($4, ''),
		     COALESCE($5, 'Guest'),
		     COALESCE($6, true))
		 ON CONFLICT (id) DO UPDATE SET
		     heading_text     = COALESCE($1, welcome_screen.heading_text),
		     heading_text_id  = COALESCE($2, welcome_screen.heading_text_id),
		     delivery_label   = COALESCE($3, welcome_screen.delivery_label),
		     delivery_label_id= COALESCE($4, welcome_screen.delivery_label_id),
		     fallback_name    = COALESCE($5, welcome_screen.fallback_name),
		     enabled          = COALESCE($6, welcome_screen.enabled),
		     updated_at       = NOW()
		 RETURNING id, heading_text, heading_text_id, delivery_label, delivery_label_id,
		           fallback_name, enabled, updated_at`,
		data.HeadingText, data.HeadingTextId, data.DeliveryLabel, data.DeliveryLabelId,
		data.FallbackName, data.Enabled,
	).Scan(&ws.ID, &ws.HeadingText, &ws.HeadingTextId, &ws.DeliveryLabel, &ws.DeliveryLabelId,
		&ws.FallbackName, &ws.Enabled, &updatedAt)
	if err != nil {
		return nil, fmt.Errorf("upsert welcome_screen: %w", err)
	}
	ws.UpdatedAt = updatedAt.Format(time.RFC3339)
	return &ws, nil
}
```

- [ ] **Step 7: Update postgres repository — ScheduleEvents**

In `postgres.go`, replace `GetScheduleEvents` (lines 1060-1080):

```go
func (r *PostgresRepository) GetScheduleEvents(ctx context.Context) ([]models.ScheduleEvent, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT id, title, title_id, time, description, description_id, sort_order, created_at
		 FROM schedule_events ORDER BY sort_order ASC, id ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]models.ScheduleEvent, 0)
	for rows.Next() {
		var e models.ScheduleEvent
		var createdAt time.Time
		if err := rows.Scan(&e.ID, &e.Title, &e.TitleId, &e.Time, &e.Description, &e.DescriptionId,
			&e.SortOrder, &createdAt); err != nil {
			return nil, err
		}
		e.CreatedAt = createdAt.Format(time.RFC3339)
		result = append(result, e)
	}
	return result, rows.Err()
}
```

In `postgres.go`, replace `CreateScheduleEvent` (lines 1082-1096):

```go
func (r *PostgresRepository) CreateScheduleEvent(ctx context.Context, data models.InsertScheduleEvent) (*models.ScheduleEvent, error) {
	var e models.ScheduleEvent
	var createdAt time.Time
	err := r.pool.QueryRow(ctx,
		`INSERT INTO schedule_events (title, title_id, time, description, description_id, sort_order)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 RETURNING id, title, title_id, time, description, description_id, sort_order, created_at`,
		data.Title, data.TitleId, data.Time, data.Description, data.DescriptionId, data.SortOrder,
	).Scan(&e.ID, &e.Title, &e.TitleId, &e.Time, &e.Description, &e.DescriptionId, &e.SortOrder, &createdAt)
	if err != nil {
		return nil, err
	}
	e.CreatedAt = createdAt.Format(time.RFC3339)
	return &e, nil
}
```

In `postgres.go`, replace `UpdateScheduleEvent` (lines 1098-1116):

```go
func (r *PostgresRepository) UpdateScheduleEvent(ctx context.Context, id int, data models.UpdateScheduleEvent) (*models.ScheduleEvent, error) {
	var e models.ScheduleEvent
	var createdAt time.Time
	err := r.pool.QueryRow(ctx,
		`UPDATE schedule_events
		 SET title = $1, title_id = $2, time = $3, description = $4, description_id = $5
		 WHERE id = $6
		 RETURNING id, title, title_id, time, description, description_id, sort_order, created_at`,
		data.Title, data.TitleId, data.Time, data.Description, data.DescriptionId, id,
	).Scan(&e.ID, &e.Title, &e.TitleId, &e.Time, &e.Description, &e.DescriptionId, &e.SortOrder, &createdAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	e.CreatedAt = createdAt.Format(time.RFC3339)
	return &e, nil
}
```

- [ ] **Step 8: Update welcome_screen handler sanitizer**

In `go-server/internal/handler/welcome_screen.go`, replace the sanitizer block in `Update` (the `if h.Sanitizer != nil` block):

```go
	if h.Sanitizer != nil {
		if body.HeadingText != nil {
			sanitized := h.Sanitizer.Sanitize(*body.HeadingText)
			body.HeadingText = &sanitized
		}
		if body.HeadingTextId != nil {
			sanitized := h.Sanitizer.Sanitize(*body.HeadingTextId)
			body.HeadingTextId = &sanitized
		}
		if body.DeliveryLabel != nil {
			sanitized := h.Sanitizer.Sanitize(*body.DeliveryLabel)
			body.DeliveryLabel = &sanitized
		}
		if body.DeliveryLabelId != nil {
			sanitized := h.Sanitizer.Sanitize(*body.DeliveryLabelId)
			body.DeliveryLabelId = &sanitized
		}
		if body.FallbackName != nil {
			sanitized := h.Sanitizer.Sanitize(*body.FallbackName)
			body.FallbackName = &sanitized
		}
	}
```

Also update the default `ws` value returned when `ws == nil` in the `Get` handler to include the new fields:

```go
	if ws == nil {
		ws = &models.WelcomeScreen{
			ID:              0,
			HeadingText:     "Welcome",
			HeadingTextId:   "",
			DeliveryLabel:   "Delivery",
			DeliveryLabelId: "",
			FallbackName:    "Guest",
			Enabled:         true,
		}
	}
```

- [ ] **Step 9: Run tests and verify they pass**

```bash
cd go-server && go test ./internal/handler -run "TestWelcomeScreenHasLocalizationFields|TestScheduleEventHasLocalizationFields" -v
```

Expected: PASS

- [ ] **Step 10: Run full backend test suite**

```bash
cd go-server && make test
```

Expected: all tests pass with race detector.

- [ ] **Step 11: Commit**

```bash
git add go-server/migrations/010_add_localization_fields.sql \
        go-server/internal/models/welcome_screen.go \
        go-server/internal/models/schedule_event.go \
        go-server/internal/repository/memory.go \
        go-server/internal/repository/postgres.go \
        go-server/internal/handler/welcome_screen.go \
        go-server/internal/handler/handler_test.go \
        go-server/internal/handler/schedule_test.go
git commit -m "feat: add bilingual fields to welcome_screen and schedule_events"
```

---

### Task 2: Translation Dictionaries

**Files:**
- Create: `client/src/locales/en.ts`
- Create: `client/src/locales/id.ts`

- [ ] **Step 1: Create English dictionary**

Create `client/src/locales/en.ts`:

```ts
export const en = {
  // WelcomeOverlay
  openInvitation: "Open Invitation",
  selectLanguage: "Select your language",

  // HeroSection
  gettingMarried: "We're Getting Married",
  saveTheDate: "Save the Date",
  rsvpNow: "RSVP Now",
  days: "Days",
  hours: "Hours",
  minutes: "Minutes",
  seconds: "Seconds",

  // DetailsSection
  theDetails: "The Details",
  detailsSubtitle: "Join us as we celebrate our special day",
  date: "Date",
  schedule: "Schedule",
  location: "Location",
  viewOnMaps: "View on Google Maps",
  gettingThere: "Getting There",
  rideHailingTitle: "Ride-Hailing Recommended",
  rideHailingBody: "Due to limited parking space at the venue, we kindly recommend using online ride-hailing services such as Grab or Gojek for a more convenient arrival experience.",
  valetTitle: "Free Valet Parking Service Available",
  valetBody: "For guests who prefer to bring their own car, please be advised that due to the limited parking space, your vehicle will be managed by Casakhasa's valet parking service (Free).",
  weddingDaySchedule: "Wedding Day Schedule",

  // BibleVerseSection
  bibleVerse: "“We love, because He first loved us.”",
  bibleVerseRef: "1 John 4:19",

  // CoupleSection
  ourLoveStory: "Our Love Story",
  theGroom: "The Groom",
  theBride: "The Bride",
  secondSonOf: "the second son of",
  secondDaughterOf: "the second daughter of",
  howWeMet: "How We Met",
  ourStoryParagraph1: "In 2019, Andreas applied for a job. Christine, the recruiter at the time, was hiring a Software Engineer. She reviewed his CV, scheduled the interviews, and successfully closed the role. But apparently, Andreas had a different target. Shortly after joining the company, he began what we call “Personal Outreach.” Under the very professional excuse of conducting user research for his side project, he invited her to be an interviewee.",
  ourStoryParagraph2: "One research session somehow turned into an escape room invite. Very subtle. Very strategic. But Christine not impressed. She declined the invite and something felt suspicious.",
  ourStoryParagraph3: "Instead of giving up, Andreas asked for one last call after deciding to resign and move overseas. This time, it wasn’t about work. He used the opportunity to confess something. Surprisingly, that honesty changed everything. What started as a recruitment process turned into long Google Meet calls, lots of laughter, and a story neither of them planned for. The recruiter and the candidate eventually agreed to a lifetime contract. So here we are, making it official and inviting you to be part of our important days! 😊",
  ourStoryQuote: "“True love stories never have endings.” — Richard Bach",

  // DressCodeSection
  dressCode: "Dress Code",
  colorToAvoid: "Color To Avoid",
  dressCodeSubtitle: "We kindly ask that guest avoid wearing the following colors (Bold and Strong Color) to our celebration. For Example:",

  // GallerySection
  ourGallery: "Our Gallery",
  gallerySubtitle: "Capturing our beautiful moments together",

  // RsvpSection
  rsvp: "RSVP",
  rsvpSubtitle: "We can’t wait to celebrate with you. Please let us know if you’ll be joining us.",
  willYouAttend: "Will You Attend?",
  attendBoth: "Both Ceremonies",
  attendHolyMatrimony: "Holy Matrimony Only",
  attendReception: "Reception Only",
  attendDecline: "Regretfully Decline",
  numberOfGuests: "Number of Guests",
  submitRsvp: "Submit RSVP",
  updateRsvp: "Update RSVP",
  rsvpThankYou: "Thank you, {name}!",
  rsvpConfirmAttending: "We’re looking forward to celebrating with you.",
  rsvpConfirmDecline: "We understand and will miss you.",

  // MessagesSection
  wishesTitle: "Wishes & Messages",
  wishesSubtitle: "Share your heartfelt wishes with us",
  yourName: "Your Name",
  yourMessage: "Your Message",
  sendWish: "Send Your Wish",
  seeAllWishes: "See All {count} Wishes",
  thankYouMessage: "Thank you for your message!",
  noMessages: "Be the first to leave a wish!",

  // EGiftSection
  eGiftTitle: "E-Gift",
  eGiftSubtitle: "Your presence is our greatest gift. However, if you wish to send a token of your love, you may do so through the following:",
  groom: "Groom",
  bride: "Bride",
  copyAccountNumber: "Copy Account Number",
  copied: "Copied!",

  // Footer
  madeWithLove: "Made with love for our special day",
} as const;

export type TranslationKey = keyof typeof en;

export function interpolate(str: string, vars: Record<string, string | number>): string {
  return str.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? `{${key}}`));
}
```

- [ ] **Step 2: Create Bahasa Indonesia dictionary**

Create `client/src/locales/id.ts`:

```ts
import type { TranslationKey } from "./en";

export const id: Record<TranslationKey, string> = {
  // WelcomeOverlay
  openInvitation: "Buka Undangan",
  selectLanguage: "Pilih bahasa Anda",

  // HeroSection
  gettingMarried: "Kami Akan Menikah",
  saveTheDate: "Tandai Tanggalnya",
  rsvpNow: "RSVP Sekarang",
  days: "Hari",
  hours: "Jam",
  minutes: "Menit",
  seconds: "Detik",

  // DetailsSection
  theDetails: "Detail Pernikahan",
  detailsSubtitle: "Bergabunglah bersama kami merayakan hari istimewa kami",
  date: "Tanggal",
  schedule: "Jadwal",
  location: "Lokasi",
  viewOnMaps: "Lihat di Google Maps",
  gettingThere: "Cara Menuju Lokasi",
  rideHailingTitle: "Direkomendasikan Menggunakan Ojek Online",
  rideHailingBody: "Karena keterbatasan tempat parkir di venue, kami dengan hormat menyarankan untuk menggunakan layanan ojek online seperti Grab atau Gojek untuk pengalaman kedatangan yang lebih nyaman.",
  valetTitle: "Layanan Valet Parkir Gratis Tersedia",
  valetBody: "Bagi tamu yang lebih memilih membawa kendaraan sendiri, harap diperhatikan bahwa karena keterbatasan tempat parkir, kendaraan Anda akan dikelola oleh layanan valet parkir Casakhasa (Gratis).",
  weddingDaySchedule: "Jadwal Hari Pernikahan",

  // BibleVerseSection
  bibleVerse: "“Kita mengasihi, karena Allah lebih dahulu mengasihi kita.”",
  bibleVerseRef: "1 Yohanes 4:19",

  // CoupleSection
  ourLoveStory: "Kisah Cinta Kami",
  theGroom: "Mempelai Pria",
  theBride: "Mempelai Wanita",
  secondSonOf: "putra kedua dari",
  secondDaughterOf: "putri kedua dari",
  howWeMet: "Bagaimana Kami Bertemu",
  ourStoryParagraph1: "Pada tahun 2019, Andreas melamar pekerjaan. Christine, yang saat itu menjadi rekruter, sedang mencari Software Engineer. Ia meninjau CV-nya, menjadwalkan wawancara, dan berhasil menutup posisi tersebut. Namun ternyata, Andreas punya target yang berbeda. Tidak lama setelah bergabung dengan perusahaan, ia memulai apa yang kami sebut “Personal Outreach.” Dengan alasan yang sangat profesional — melakukan riset pengguna untuk proyek sampingannya — ia mengundang Christine menjadi narasumber.",
  ourStoryParagraph2: "Satu sesi riset entah bagaimana berubah menjadi undangan escape room. Sangat halus. Sangat strategis. Tapi Christine tidak terkesan. Ia menolak undangan itu, dan ada sesuatu yang terasa mencurigakan.",
  ourStoryParagraph3: "Alih-alih menyerah, Andreas meminta satu percakapan terakhir setelah memutuskan untuk mengundurkan diri dan pindah ke luar negeri. Kali ini, bukan soal pekerjaan. Ia memanfaatkan kesempatan itu untuk mengungkapkan sesuatu. Kejujuran itu ternyata mengubah segalanya. Apa yang bermula dari proses rekrutmen berubah menjadi panggilan Google Meet panjang, banyak tawa, dan sebuah kisah yang tidak direncanakan oleh keduanya. Rekruter dan kandidat itu akhirnya sepakat untuk menandatangani kontrak seumur hidup. Maka inilah kami, meresmikannya dan mengundang Anda untuk menjadi bagian dari hari-hari penting kami! 😊",
  ourStoryQuote: "“Kisah cinta sejati tidak pernah berakhir.” — Richard Bach",

  // DressCodeSection
  dressCode: "Kode Busana",
  colorToAvoid: "Warna yang Perlu Dihindari",
  dressCodeSubtitle: "Kami dengan hormat memohon kepada tamu untuk menghindari warna-warna berikut (Warna Tebal dan Kuat) dalam perayaan kami. Contohnya:",

  // GallerySection
  ourGallery: "Galeri Kami",
  gallerySubtitle: "Mengabadikan momen indah kami bersama",

  // RsvpSection
  rsvp: "RSVP",
  rsvpSubtitle: "Kami tidak sabar merayakan bersama Anda. Mohon beritahu kami apakah Anda bisa hadir.",
  willYouAttend: "Apakah Anda Akan Hadir?",
  attendBoth: "Kedua Acara",
  attendHolyMatrimony: "Pemberkatan Nikah Saja",
  attendReception: "Resepsi Saja",
  attendDecline: "Dengan Menyesal Tidak Dapat Hadir",
  numberOfGuests: "Jumlah Tamu",
  submitRsvp: "Kirim RSVP",
  updateRsvp: "Perbarui RSVP",
  rsvpThankYou: "Terima kasih, {name}!",
  rsvpConfirmAttending: "Kami tidak sabar merayakan bersama Anda.",
  rsvpConfirmDecline: "Kami memahami dan akan sangat merindukan kehadiran Anda.",

  // MessagesSection
  wishesTitle: "Doa & Pesan",
  wishesSubtitle: "Bagikan doa dan ucapan tulus Anda kepada kami",
  yourName: "Nama Anda",
  yourMessage: "Pesan Anda",
  sendWish: "Kirim Doa Anda",
  seeAllWishes: "Lihat Semua {count} Doa",
  thankYouMessage: "Terima kasih atas pesan Anda!",
  noMessages: "Jadilah yang pertama meninggalkan doa!",

  // EGiftSection
  eGiftTitle: "E-Gift",
  eGiftSubtitle: "Kehadiran Anda adalah hadiah terbesar kami. Namun, jika Anda ingin mengirimkan tanda kasih, Anda dapat melakukannya melalui:",
  groom: "Mempelai Pria",
  bride: "Mempelai Wanita",
  copyAccountNumber: "Salin Nomor Rekening",
  copied: "Tersalin!",

  // Footer
  madeWithLove: "Dibuat dengan penuh cinta untuk hari istimewa kami",
};
```

- [ ] **Step 3: Run TypeScript check**

```bash
npm run check
```

Expected: no errors. `id.ts` will fail if any key from `en.ts` is missing — TypeScript enforces completeness via `Record<TranslationKey, string>`.

- [ ] **Step 4: Commit**

```bash
git add client/src/locales/en.ts client/src/locales/id.ts
git commit -m "feat: add EN/ID translation dictionaries"
```

---

### Task 3: LanguageContext

**Files:**
- Create: `client/src/contexts/LanguageContext.tsx`
- Create: `client/src/contexts/__tests__/LanguageContext.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `client/src/contexts/__tests__/LanguageContext.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LanguageProvider, useLanguage } from "../LanguageContext";

function LangDisplay() {
  const { lang, t, dateLocale } = useLanguage();
  return (
    <div>
      <span data-testid="lang">{lang}</span>
      <span data-testid="t-open">{t("openInvitation")}</span>
      <span data-testid="date-locale">{dateLocale}</span>
    </div>
  );
}

function LangToggle() {
  const { lang, setLang } = useLanguage();
  return (
    <button onClick={() => setLang(lang === "en" ? "id" : "en")}>toggle</button>
  );
}

beforeEach(() => {
  window.history.replaceState({}, "", "/");
});

describe("LanguageContext", () => {
  it("defaults to en when no ?lang param", () => {
    render(
      <LanguageProvider>
        <LangDisplay />
      </LanguageProvider>
    );
    expect(screen.getByTestId("lang").textContent).toBe("en");
    expect(screen.getByTestId("t-open").textContent).toBe("Open Invitation");
    expect(screen.getByTestId("date-locale").textContent).toBe("en-US");
  });

  it("initialises to id when ?lang=id is in URL", () => {
    window.history.replaceState({}, "", "/?lang=id");
    render(
      <LanguageProvider>
        <LangDisplay />
      </LanguageProvider>
    );
    expect(screen.getByTestId("lang").textContent).toBe("id");
    expect(screen.getByTestId("t-open").textContent).toBe("Buka Undangan");
    expect(screen.getByTestId("date-locale").textContent).toBe("id-ID");
  });

  it("setLang switches language and updates URL param", () => {
    render(
      <LanguageProvider>
        <LangDisplay />
        <LangToggle />
      </LanguageProvider>
    );
    fireEvent.click(screen.getByText("toggle"));
    expect(screen.getByTestId("lang").textContent).toBe("id");
    expect(window.location.search).toContain("lang=id");
  });

  it("setLang preserves existing URL params", () => {
    window.history.replaceState({}, "", "/?code=abc");
    render(
      <LanguageProvider>
        <LangToggle />
      </LanguageProvider>
    );
    fireEvent.click(screen.getByText("toggle"));
    expect(window.location.search).toContain("code=abc");
    expect(window.location.search).toContain("lang=id");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --run client/src/contexts/__tests__/LanguageContext.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create LanguageContext**

Create `client/src/contexts/LanguageContext.tsx`:

```tsx
import { createContext, useContext, useState, useMemo } from "react";
import { en, type TranslationKey, interpolate } from "@/locales/en";
import { id } from "@/locales/id";

type Lang = "en" | "id";

const translations: Record<Lang, Record<TranslationKey, string>> = { en, id };

interface LanguageContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: TranslationKey) => string;
  dateLocale: string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function readLangFromURL(): Lang {
  if (typeof window === "undefined") return "en";
  const param = new URLSearchParams(window.location.search).get("lang");
  return param === "id" ? "id" : "en";
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readLangFromURL);

  const setLang = (next: Lang) => {
    setLangState(next);
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      params.set("lang", next);
      window.history.replaceState({}, "", `${window.location.pathname}?${params.toString()}`);
    }
  };

  const t = useMemo(
    () =>
      (key: TranslationKey): string =>
        translations[lang][key] ?? translations.en[key],
    [lang]
  );

  const dateLocale = lang === "id" ? "id-ID" : "en-US";

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, dateLocale }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used inside LanguageProvider");
  return ctx;
}

export { interpolate };
```

- [ ] **Step 4: Run tests and verify they pass**

```bash
npm test -- --run client/src/contexts/__tests__/LanguageContext.test.tsx
```

Expected: all 4 tests PASS.

- [ ] **Step 5: Run full frontend test suite**

```bash
npm test -- --run
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add client/src/contexts/LanguageContext.tsx client/src/contexts/__tests__/LanguageContext.test.tsx
git commit -m "feat: add LanguageContext with EN/ID switching and URL param persistence"
```

---

### Task 4: App.tsx + shared/schema.ts Wiring

**Files:**
- Modify: `client/src/App.tsx`
- Modify: `shared/schema.ts`

- [ ] **Step 1: Wrap AppContent with LanguageProvider in App.tsx**

In `client/src/App.tsx`, add the import:

```ts
import { LanguageProvider } from "@/contexts/LanguageContext";
```

Replace the `App` function:

```tsx
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <AppContent />
      </LanguageProvider>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 2: Add localization fields to shared/schema.ts**

In `shared/schema.ts`, replace the `welcomeScreen` table definition (around line 108):

```ts
export const welcomeScreen = pgTable("welcome_screen", {
  id: serial("id").primaryKey(),
  headingText: text("heading_text").notNull().default("The Wedding of Andreas & Christine"),
  headingTextId: text("heading_text_id").notNull().default(""),
  deliveryLabel: text("delivery_label").notNull().default("Kindly Delivered to"),
  deliveryLabelId: text("delivery_label_id").notNull().default(""),
  fallbackName: text("fallback_name").notNull().default("Our Dearest Guest"),
  enabled: boolean("enabled").default(true),
  updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull()
});
```

Replace the `insertWelcomeScreenSchema` (around line 140):

```ts
export const insertWelcomeScreenSchema = createInsertSchema(welcomeScreen).pick({
  headingText: true,
  headingTextId: true,
  deliveryLabel: true,
  deliveryLabelId: true,
  fallbackName: true,
  enabled: true
});
```

- [ ] **Step 3: Run TypeScript check**

```bash
npm run check
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add client/src/App.tsx shared/schema.ts
git commit -m "feat: wire LanguageProvider into App and add bilingual fields to schema"
```

---

### Task 5: WelcomeOverlay Language Picker

**Files:**
- Modify: `client/src/components/WelcomeOverlay.tsx`
- Modify: `client/src/components/__tests__/WelcomeOverlay.test.tsx`

- [ ] **Step 1: Write failing tests**

Add to `client/src/components/__tests__/WelcomeOverlay.test.tsx`:

```tsx
vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    lang: "en",
    setLang: vi.fn(),
    t: (key: string) => key,
    dateLocale: "en-US",
  }),
  interpolate: (str: string, vars: Record<string, string | number>) =>
    str.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`)),
}));
```

Then add new test cases to the existing `describe("WelcomeOverlay")` block:

```tsx
it("shows EN and ID language pills", async () => {
  render(<WelcomeOverlay />, { wrapper });
  await screen.findByTestId("welcome-overlay");
  expect(screen.getByTestId("lang-pill-en")).toBeInTheDocument();
  expect(screen.getByTestId("lang-pill-id")).toBeInTheDocument();
});

it("calls setLang when ID pill is clicked", async () => {
  const setLang = vi.fn();
  vi.mocked(require("@/contexts/LanguageContext").useLanguage).mockReturnValue({
    lang: "en",
    setLang,
    t: (key: string) => key,
    dateLocale: "en-US",
  });
  render(<WelcomeOverlay />, { wrapper });
  await screen.findByTestId("lang-pill-id");
  fireEvent.click(screen.getByTestId("lang-pill-id"));
  expect(setLang).toHaveBeenCalledWith("id");
});
```

Note: these tests follow the same pattern as the existing mock. Make sure the `vi.mock` is at the top of the file (module scope).

- [ ] **Step 2: Update WelcomeOverlay**

In `client/src/components/WelcomeOverlay.tsx`, add import at the top:

```ts
import { useLanguage } from "@/contexts/LanguageContext";
```

Inside the `WelcomeOverlay` component, add after the existing state declarations:

```ts
const { lang, setLang, t } = useLanguage();
```

Replace the heading in the JSX (currently `{welcomeScreen.headingText}`):

```tsx
{lang === "id" && welcomeScreen.headingTextId
  ? welcomeScreen.headingTextId
  : welcomeScreen.headingText}
```

Replace the delivery label (currently `{welcomeScreen.deliveryLabel}`):

```tsx
{lang === "id" && welcomeScreen.deliveryLabelId
  ? welcomeScreen.deliveryLabelId
  : welcomeScreen.deliveryLabel}
```

Replace the button text (currently `"Open Invitation"`):

```tsx
<span className="relative z-10">{t("openInvitation")}</span>
```

Add the language picker **above** the button (between the `h2` and the `button` motion elements):

```tsx
{/* Language Picker */}
<motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  transition={{ delay: 1.1, duration: 0.4 }}
  className="flex items-center justify-center gap-3 mb-6"
>
  {(["en", "id"] as const).map((l) => (
    <button
      key={l}
      data-testid={`lang-pill-${l}`}
      onClick={() => setLang(l)}
      className={`px-5 py-1.5 rounded-full font-montserrat text-xs uppercase tracking-wider border transition-all duration-200 ${
        lang === l
          ? "bg-primary text-white border-primary"
          : "bg-transparent text-primary border-primary/50 hover:border-primary"
      }`}
    >
      {l.toUpperCase()}
    </button>
  ))}
</motion.div>
```

- [ ] **Step 3: Run TypeScript check**

```bash
npm run check
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/WelcomeOverlay.tsx client/src/components/__tests__/WelcomeOverlay.test.tsx
git commit -m "feat: add EN/ID language picker to WelcomeOverlay"
```

---

### Task 6: NavBar Language Toggle

**Files:**
- Modify: `client/src/components/NavBar.tsx`
- Modify: `client/src/components/__tests__/NavBar.test.tsx`

- [ ] **Step 1: Write failing tests**

Add to `client/src/components/__tests__/NavBar.test.tsx`, before the existing `describe` blocks:

```tsx
vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    lang: "en",
    setLang: vi.fn(),
    t: (key: string) => key,
    dateLocale: "en-US",
  }),
}));
```

Add a new `describe` block:

```tsx
describe("NavBar language toggle", () => {
  it("shows EN and ID toggle buttons", () => {
    render(<NavBar />);
    expect(screen.getByTestId("lang-toggle-en")).toBeInTheDocument();
    expect(screen.getByTestId("lang-toggle-id")).toBeInTheDocument();
  });

  it("shows toggle in minimal mode", () => {
    render(<NavBar minimal />);
    expect(screen.getByTestId("lang-toggle-en")).toBeInTheDocument();
    expect(screen.getByTestId("lang-toggle-id")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Update NavBar**

In `client/src/components/NavBar.tsx`, add import:

```ts
import { useLanguage } from "@/contexts/LanguageContext";
```

Inside the `NavBar` component, add after the `homeHref` declaration:

```ts
const { lang, setLang } = useLanguage();
```

Add the language toggle to the **main flex container** (the `div.container.mx-auto.px-4.py-3.flex` div), after the mobile menu button and desktop menu. It must be outside all `{!minimal && ...}` guards so it appears always:

```tsx
{/* Language toggle — always visible */}
<div className="flex items-center gap-1 font-montserrat text-xs ml-2">
  {(["en", "id"] as const).map((l, i) => (
    <span key={l} className="flex items-center">
      {i > 0 && <span className="text-muted-foreground/40 mx-1">|</span>}
      <button
        data-testid={`lang-toggle-${l}`}
        onClick={() => setLang(l)}
        className={`uppercase tracking-wider transition-opacity duration-200 ${
          lang === l
            ? "font-bold opacity-100 text-primary"
            : "opacity-40 hover:opacity-70 text-foreground"
        }`}
      >
        {l.toUpperCase()}
      </button>
    </span>
  ))}
</div>
```

Place this element at the end of `<div className="container mx-auto px-4 py-3 flex justify-between items-center">`, before the closing `</div>`. The resulting structure will be:

```
[Logo A&C]          [mobile burger | desktop nav links]          [EN | ID]
```

- [ ] **Step 3: Run NavBar tests**

```bash
npm test -- --run client/src/components/__tests__/NavBar.test.tsx
```

Expected: all tests pass.

- [ ] **Step 4: Run TypeScript check**

```bash
npm run check
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/NavBar.tsx client/src/components/__tests__/NavBar.test.tsx
git commit -m "feat: add EN|ID language toggle to NavBar"
```

---

### Task 7: HeroSection + DetailsSection

**Files:**
- Modify: `client/src/components/HeroSection.tsx`
- Modify: `client/src/components/DetailsSection.tsx`

- [ ] **Step 1: Update HeroSection**

In `client/src/components/HeroSection.tsx`, add import:

```ts
import { useLanguage } from "@/contexts/LanguageContext";
```

Inside `HeroSection`, add after existing state declarations:

```ts
const { t, dateLocale } = useLanguage();
```

Replace the `formattedDate` definition (currently around line 73):

```ts
const formattedDate = new Intl.DateTimeFormat(dateLocale, {
  month: 'long',
  day: 'numeric',
  year: 'numeric'
}).format(WEDDING_DATE);
```

Find the string `"We're Getting Married"` in the JSX and replace with `{t("gettingMarried")}`.

Find `"Save the Date"` and replace with `{t("saveTheDate")}`.

Find `"RSVP Now"` and replace with `{t("rsvpNow")}`.

Find the countdown label `"Days"` and replace with `{t("days")}`, `"Hours"` → `{t("hours")}`, `"Minutes"` → `{t("minutes")}`, `"Seconds"` → `{t("seconds")}`.

- [ ] **Step 2: Update DetailsSection**

In `client/src/components/DetailsSection.tsx`, add import:

```ts
import { useLanguage } from "@/contexts/LanguageContext";
import { interpolate } from "@/locales/en";
```

Update the `ScheduleEvent` interface to include localization fields:

```ts
interface ScheduleEvent {
  id: number;
  title: string;
  titleId: string;
  time: string;
  description: string;
  descriptionId: string;
  sortOrder: number;
  createdAt: string;
}
```

Inside `DetailsSection`, add after the `scheduleEvents` line:

```ts
const { t, dateLocale, lang } = useLanguage();
```

Replace the `formattedDate` definition (currently around line 38):

```ts
const formattedDate = new Intl.DateTimeFormat(dateLocale, {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric'
}).format(WEDDING_DATE);
```

Replace the string literals in JSX:
- `"The Details"` → `{t("theDetails")}`
- `"Join us as we celebrate our special day"` → `{t("detailsSubtitle")}`
- `"Date"` (the label) → `{t("date")}`
- `"Schedule"` (the label) → `{t("schedule")}`
- `"Location"` (the label) → `{t("location")}`
- `"View on Google Maps"` → `{t("viewOnMaps")}`
- `"Getting There"` → `{t("gettingThere")}`
- `"Ride-Hailing Recommended"` → `{t("rideHailingTitle")}`
- The ride-hailing body paragraph → `{t("rideHailingBody")}`
- `"Free Valet Parking Service Available"` → `{t("valetTitle")}`
- The valet body paragraph → `{t("valetBody")}`
- `"Wedding Day Schedule"` → `{t("weddingDaySchedule")}`

For schedule event title and description in the timeline loop, replace `{item.title}` and `{item.description}` with:

```tsx
{lang === "id" && item.titleId ? item.titleId : item.title}
```

```tsx
{lang === "id" && item.descriptionId ? item.descriptionId : item.description}
```

Also apply the same fallback logic to the compact schedule display at the top (the `scheduleEvents[0].title` and `scheduleEvents[scheduleEvents.length - 1].title` references).

- [ ] **Step 3: Run TypeScript check**

```bash
npm run check
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/HeroSection.tsx client/src/components/DetailsSection.tsx
git commit -m "feat: add localization to HeroSection and DetailsSection"
```

---

### Task 8: BibleVerseSection + CoupleSection

**Files:**
- Modify: `client/src/components/BibleVerseSection.tsx`
- Modify: `client/src/components/CoupleSection.tsx`

- [ ] **Step 1: Update BibleVerseSection**

In `client/src/components/BibleVerseSection.tsx`, add import:

```ts
import { useLanguage } from "@/contexts/LanguageContext";
```

Inside `BibleVerseSection`, add:

```ts
const { t } = useLanguage();
```

Replace the hardcoded verse text `"We love, because He first loved us."` (including the surrounding curly quotes) with `{t("bibleVerse")}`.

Replace `"1 John 4:19"` with `{t("bibleVerseRef")}`.

- [ ] **Step 2: Update CoupleSection**

In `client/src/components/CoupleSection.tsx`, add import:

```ts
import { useLanguage } from "@/contexts/LanguageContext";
```

Inside `CoupleSection`, add:

```ts
const { t } = useLanguage();
```

Replace string literals in JSX:
- `"Our Love Story"` → `{t("ourLoveStory")}`
- `"The Groom"` (the `<p>` tag) → `{t("theGroom")}`
- `"The Bride"` (the `<p>` tag) → `{t("theBride")}`
- `"the second son of"` → `{t("secondSonOf")}`
- `"the second daughter of"` → `{t("secondDaughterOf")}`
- `"How We Met"` → `{t("howWeMet")}`

Replace the three story `<p>` tags with:

```tsx
<p>{t("ourStoryParagraph1")}</p>
<p>{t("ourStoryParagraph2")}</p>
<p>{t("ourStoryParagraph3")}</p>
```

Replace the closing quote element:

```tsx
{t("ourStoryQuote")}
```

- [ ] **Step 3: Run TypeScript check**

```bash
npm run check
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/BibleVerseSection.tsx client/src/components/CoupleSection.tsx
git commit -m "feat: add localization to BibleVerseSection and CoupleSection"
```

---

### Task 9: DressCodeSection + GallerySection

**Files:**
- Modify: `client/src/components/DressCodeSection.tsx`
- Modify: `client/src/components/GallerySection.tsx`

- [ ] **Step 1: Update DressCodeSection**

In `client/src/components/DressCodeSection.tsx`, add import:

```ts
import { useLanguage } from "@/contexts/LanguageContext";
```

Inside `DressCodeSection`, add:

```ts
const { t } = useLanguage();
```

Replace string literals:
- `"Dress Code"` (the `<motion.p>` label) → `{t("dressCode")}`
- `"Color To Avoid"` (the `<motion.h2>`) → `{t("colorToAvoid")}`

For the subtitle `<motion.p>`, the current JSX has inline `<strong>` tags which can't be a translation key. Replace the entire `<motion.p>` content with a plain text key:

```tsx
<motion.p
  className="text-muted-foreground font-montserrat max-w-2xl mx-auto"
  variants={fadeIn}
>
  {t("dressCodeSubtitle")}
</motion.p>
```

- [ ] **Step 2: Update GallerySection**

In `client/src/components/GallerySection.tsx`, add import:

```ts
import { useLanguage } from "@/contexts/LanguageContext";
```

Inside `GallerySection` (the main export), add:

```ts
const { t } = useLanguage();
```

Find the section heading `"Our Gallery"` and replace with `{t("ourGallery")}`.

Find the subtitle text (something like `"Capturing our beautiful moments together"`) and replace with `{t("gallerySubtitle")}`. If no subtitle currently exists in the heading area, add it as a `<p>` below the heading, consistent with other sections:

```tsx
<p className="text-muted-foreground font-montserrat text-lg max-w-2xl mx-auto">
  {t("gallerySubtitle")}
</p>
```

- [ ] **Step 3: Run TypeScript check**

```bash
npm run check
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/DressCodeSection.tsx client/src/components/GallerySection.tsx
git commit -m "feat: add localization to DressCodeSection and GallerySection"
```

---

### Task 10: RsvpSection

**Files:**
- Modify: `client/src/components/RsvpSection.tsx`

- [ ] **Step 1: Update RsvpSection**

In `client/src/components/RsvpSection.tsx`, add imports:

```ts
import { useLanguage, interpolate } from "@/contexts/LanguageContext";
```

Inside `RsvpSection`, add:

```ts
const { t } = useLanguage();
```

Replace string literals in JSX:
- Section heading `"RSVP"` → `{t("rsvp")}`
- Section subtitle → `{t("rsvpSubtitle")}`
- `"Will You Attend?"` → `{t("willYouAttend")}`
- `"Both Ceremonies"` → `{t("attendBoth")}`
- `"Holy Matrimony Only"` → `{t("attendHolyMatrimony")}`
- `"Reception Only"` → `{t("attendReception")}`
- `"Regretfully Decline"` → `{t("attendDecline")}`
- `"Number of Guests"` → `{t("numberOfGuests")}`
- Submit button text `"Submit RSVP"` → `{t("submitRsvp")}`
- Update button text `"Update RSVP"` → `{t("updateRsvp")}`

For the thank-you confirmation state, find the heading that shows the guest name (typically something like `"Thank you, {guestName}!"`) and replace with:

```tsx
{interpolate(t("rsvpThankYou"), { name: guestName })}
```

For the attending/declining confirmation messages:

```tsx
{isAttending ? t("rsvpConfirmAttending") : t("rsvpConfirmDecline")}
```

Note: `isAttending` should be derived from `attendanceType !== "decline"`. If RsvpSection tracks this state differently, adapt accordingly — the pattern is: show `t("rsvpConfirmAttending")` for any attendance option that is not `"decline"`, otherwise show `t("rsvpConfirmDecline")`.

- [ ] **Step 2: Run TypeScript check**

```bash
npm run check
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/RsvpSection.tsx
git commit -m "feat: add localization to RsvpSection"
```

---

### Task 11: MessagesSection + EGiftSection + Footer

**Files:**
- Modify: `client/src/components/MessagesSection.tsx`
- Modify: `client/src/components/EGiftSection.tsx`
- Modify: `client/src/components/Footer.tsx`

- [ ] **Step 1: Update MessagesSection**

In `client/src/components/MessagesSection.tsx`, add imports:

```ts
import { useLanguage, interpolate } from "@/contexts/LanguageContext";
```

Inside `MessagesSection`, add:

```ts
const { t } = useLanguage();
```

Replace string literals:
- Section heading `"Wishes & Messages"` → `{t("wishesTitle")}`
- Section subtitle → `{t("wishesSubtitle")}`
- `"Your Name"` placeholder/label → `{t("yourName")}`
- `"Your Message"` placeholder/label → `{t("yourMessage")}`
- Submit button `"Send Your Wish"` → `{t("sendWish")}`
- Thank-you message after submit → `{t("thankYouMessage")}`

For the "See All N Wishes" button (currently something like `` `See All ${data.count} Wishes` ``):

```tsx
{interpolate(t("seeAllWishes"), { count: data.count })}
```

For the empty state message (if shown when no messages):

```tsx
{t("noMessages")}
```

- [ ] **Step 2: Update EGiftSection**

In `client/src/components/EGiftSection.tsx`, add import:

```ts
import { useLanguage } from "@/contexts/LanguageContext";
```

Inside `EGiftSection`, add:

```ts
const { t } = useLanguage();
```

Replace string literals:
- Section heading → `{t("eGiftTitle")}`
- Section subtitle → `{t("eGiftSubtitle")}`
- `"Groom"` label → `{t("groom")}`
- `"Bride"` label → `{t("bride")}`

In `BankAccountCard`, the label prop is passed from the parent — replace the hardcoded strings `"Groom"` and `"Bride"` at the call site with `t("groom")` and `t("bride")`.

For the copy button: find `"Copy Account Number"` → `{t("copyAccountNumber")}` and `"Copied!"` → `{t("copied")}`.

- [ ] **Step 3: Update Footer**

In `client/src/components/Footer.tsx`, add import:

```ts
import { useLanguage } from "@/contexts/LanguageContext";
```

Inside `Footer`, replace the `formattedDate` definition:

```ts
const { t, dateLocale } = useLanguage();
const formattedDate = new Intl.DateTimeFormat(dateLocale, {
  month: 'long',
  day: 'numeric',
  year: 'numeric'
}).format(WEDDING_DATE);
```

Replace `"Made with love for our special day"` → `{t("madeWithLove")}`.

- [ ] **Step 4: Run TypeScript check**

```bash
npm run check
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/MessagesSection.tsx client/src/components/EGiftSection.tsx client/src/components/Footer.tsx
git commit -m "feat: add localization to MessagesSection, EGiftSection, and Footer"
```

---

### Task 12: Admin WelcomePage

**Files:**
- Modify: `client/src/pages/admin/WelcomePage.tsx`
- Modify: `client/src/pages/admin/__tests__/WelcomePage.test.tsx` (if exists)

- [ ] **Step 1: Update WelcomePage form state**

In `client/src/pages/admin/WelcomePage.tsx`, extend the `welcomeForm` state to include the new fields:

```ts
const [welcomeForm, setWelcomeForm] = useState({
  headingText: "",
  headingTextId: "",
  deliveryLabel: "",
  deliveryLabelId: "",
  fallbackName: "",
});
```

Update the `useEffect` that hydrates the form from `welcomeScreenData`:

```ts
useEffect(() => {
  if (welcomeScreenData?.welcomeScreen) {
    const ws = welcomeScreenData.welcomeScreen;
    setWelcomeForm({
      headingText: ws.headingText,
      headingTextId: ws.headingTextId ?? "",
      deliveryLabel: ws.deliveryLabel,
      deliveryLabelId: ws.deliveryLabelId ?? "",
      fallbackName: ws.fallbackName,
    });
  }
}, [welcomeScreenData]);
```

- [ ] **Step 2: Add bilingual input fields to the form JSX**

After the existing "Main Heading" input block, add:

```tsx
{/* Heading Text (Bahasa) */}
<div className="space-y-2">
  <Label htmlFor="headingTextId">Main Heading (Bahasa Indonesia)</Label>
  <Input
    id="headingTextId"
    type="text"
    value={welcomeForm.headingTextId}
    onChange={(e) => setWelcomeForm({ ...welcomeForm, headingTextId: e.target.value })}
    placeholder="e.g., Pernikahan Andreas & Christine"
    className="w-full"
    data-testid="input-heading-text-id"
  />
  <p className="text-xs text-muted-foreground">
    Heading shown when guests select Bahasa Indonesia
  </p>
</div>
```

After the existing "Delivery Label" input block, add:

```tsx
{/* Delivery Label (Bahasa) */}
<div className="space-y-2">
  <Label htmlFor="deliveryLabelId">Delivery Label (Bahasa Indonesia)</Label>
  <Input
    id="deliveryLabelId"
    type="text"
    value={welcomeForm.deliveryLabelId}
    onChange={(e) => setWelcomeForm({ ...welcomeForm, deliveryLabelId: e.target.value })}
    placeholder="e.g., Kepada Yth."
    className="w-full"
    data-testid="input-delivery-label-id"
  />
  <p className="text-xs text-muted-foreground">
    Label shown above guest name when guests select Bahasa Indonesia
  </p>
</div>
```

- [ ] **Step 3: Update admin tests (if the file exists)**

If `client/src/pages/admin/__tests__/WelcomePage.test.tsx` exists, update the mock `welcomeScreen` data to include the new fields:

```ts
welcomeScreen: {
  id: 1,
  headingText: "You Are Invited",
  headingTextId: "",
  deliveryLabel: "Dear",
  deliveryLabelId: "",
  fallbackName: "Guest",
  enabled: true,
  updatedAt: "2024-01-01T00:00:00Z",
}
```

- [ ] **Step 4: Run TypeScript check**

```bash
npm run check
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/admin/WelcomePage.tsx
git commit -m "feat: add bilingual input fields to admin WelcomePage"
```

---

### Task 13: Admin SchedulePage

**Files:**
- Modify: `client/src/pages/admin/SchedulePage.tsx`

- [ ] **Step 1: Update ScheduleEvent interface**

In `client/src/pages/admin/SchedulePage.tsx`, update the `ScheduleEvent` interface:

```ts
interface ScheduleEvent {
  id: number;
  title: string;
  titleId: string;
  time: string;
  description: string;
  descriptionId: string;
  sortOrder: number;
  createdAt: string;
}
```

Update `emptyForm` to include the new fields:

```ts
const emptyForm = { title: "", titleId: "", time: "", description: "", descriptionId: "" };
```

- [ ] **Step 2: Update SortableRow to show titleId preview**

In `SortableRow`, the row currently shows `{event.title}`. Optionally show a hint when `titleId` is set. This is a display-only change:

```tsx
<p className="font-medium text-sm">{event.title}</p>
{event.titleId && (
  <p className="text-xs text-muted-foreground/60 italic">{event.titleId}</p>
)}
```

- [ ] **Step 3: Add titleId and descriptionId fields to the Add form**

In the add form JSX (after the `description` input), add:

```tsx
<div className="space-y-1">
  <Label htmlFor="add-titleId" className="text-xs">Title (Bahasa Indonesia)</Label>
  <Input
    id="add-titleId"
    value={addForm.titleId}
    onChange={(e) => setAddForm({ ...addForm, titleId: e.target.value })}
    placeholder="e.g., Pemberkatan Nikah"
    data-testid="input-add-title-id"
  />
</div>
<div className="space-y-1">
  <Label htmlFor="add-descriptionId" className="text-xs">Description (Bahasa Indonesia)</Label>
  <Textarea
    id="add-descriptionId"
    value={addForm.descriptionId}
    onChange={(e) => setAddForm({ ...addForm, descriptionId: e.target.value })}
    placeholder="e.g., Pertukaran janji dan cincin"
    rows={2}
    data-testid="input-add-description-id"
  />
</div>
```

- [ ] **Step 4: Add titleId and descriptionId fields to the edit form**

In the inline edit form (where `editForm` state is used), after the existing `description` textarea, add:

```tsx
<div className="space-y-1">
  <Label className="text-xs">Title (Bahasa Indonesia)</Label>
  <Input
    value={editForm.titleId}
    onChange={(e) => setEditForm({ ...editForm, titleId: e.target.value })}
    placeholder="Bahasa title"
    data-testid="input-edit-title-id"
  />
</div>
<div className="space-y-1">
  <Label className="text-xs">Description (Bahasa Indonesia)</Label>
  <Textarea
    value={editForm.descriptionId}
    onChange={(e) => setEditForm({ ...editForm, descriptionId: e.target.value })}
    placeholder="Bahasa description"
    rows={2}
    data-testid="input-edit-description-id"
  />
</div>
```

Update `handleEditStart` to populate the new fields:

```ts
const handleEditStart = (event: ScheduleEvent) => {
  setEditingEvent(event);
  setEditForm({
    title: event.title,
    titleId: event.titleId,
    time: event.time,
    description: event.description,
    descriptionId: event.descriptionId,
  });
  setShowAddForm(false);
};
```

- [ ] **Step 5: Run TypeScript check**

```bash
npm run check
```

Expected: no errors.

- [ ] **Step 6: Run full test suite**

```bash
npm test -- --run && cd go-server && make test
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add client/src/pages/admin/SchedulePage.tsx
git commit -m "feat: add bilingual input fields to admin SchedulePage"
```

---

## Testing Checklist

After all tasks are complete, verify end-to-end:

1. `npm run check` — zero TypeScript errors
2. `npm test -- --run` — all frontend tests pass
3. `cd go-server && make test` — all backend tests pass (race detector on)
4. Start dev server (`npm run dev` + `cd go-server && make run-dev`)
5. Visit `/?to=John` — overlay shows, EN pill selected, invitation is in English
6. Pick ID pill on overlay, click "Open Invitation" — URL becomes `?to=John&lang=id`, all sections in Bahasa
7. Toggle EN in NavBar — URL flips to `lang=en`, all sections switch back to English
8. Visit `/?lang=id` directly — overlay opens with ID pill pre-selected
9. Admin `/admin/welcome` — update "Main Heading (Bahasa)" field, verify it displays on overlay when lang=id
10. Admin `/admin/schedule` — add event with Bahasa fields, verify title/description switch on lang toggle
