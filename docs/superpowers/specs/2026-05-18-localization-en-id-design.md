# Localization — English / Bahasa Indonesia

## Overview

Add bilingual support (English and Bahasa Indonesia) to the entire wedding invitation. Guests select their language on the WelcomeOverlay before opening the invitation; the full invitation renders in the chosen language. A NavBar toggle lets guests switch language at any time. Language preference is stored as a `?lang` URL param so shared links open in the correct language.

## Approach

Lightweight frontend-only i18n using a custom React context — no new runtime dependencies. Two TypeScript translation dictionaries (`locales/en.ts`, `locales/id.ts`) cover all static UI strings. Bahasa translations are auto-generated from English strings via the Claude API during implementation. Admin-configured text (welcome screen heading/label, schedule event titles/descriptions) gets dual-language fields in the backend so the admin can manage both versions.

## Architecture

### New Files

```
client/src/locales/en.ts                  — English translation dictionary
client/src/locales/id.ts                  — Bahasa translation dictionary (AI-generated)
client/src/contexts/LanguageContext.tsx   — context + useLanguage() hook
```

### LanguageContext

- Wraps `AppContent` in `App.tsx`
- On mount: reads `?lang` from `window.location.search`; `"id"` activates Bahasa, anything else defaults to `"en"`
- Exposes: `lang` (`"en" | "id"`), `setLang(lang)`, `t(key: TranslationKey)`, `dateLocale` (`"en-US" | "id-ID"`)
- `setLang` updates React state and rewrites the URL param via `history.replaceState` — no page reload, preserves existing params (`?code`, `?to`)
- `t(key)` does `translations[lang][key] ?? translations.en[key]` — English is the fallback

### URL Param Behaviour

| Starting URL | Guest action | Resulting URL |
|---|---|---|
| `/?code=abc` | Picks ID on overlay | `/?code=abc&lang=id` |
| `/?code=abc` | Picks EN on overlay | `/?code=abc&lang=en` |
| `/?code=abc&lang=id` | Toggles to EN in NavBar | `/?code=abc&lang=en` |
| `/?lang=id` | (returning visitor) | ID pre-selected on arrival |

### Translation Dictionary Shape

Flat TypeScript object keyed by short semantic names:

```ts
// locales/en.ts
export const en = {
  // WelcomeOverlay
  openInvitation: "Open Invitation",
  selectLanguage: "Select your language",

  // HeroSection
  gettingMarried: "We're Getting Married",
  saveTheDate: "Save the Date",
  rsvpNow: "RSVP Now",
  days: "Days", hours: "Hours", minutes: "Minutes", seconds: "Seconds",

  // DetailsSection
  theDetails: "The Details",
  detailsSubtitle: "Join us as we celebrate our special day",
  date: "Date", schedule: "Schedule", location: "Location",
  viewOnMaps: "View on Google Maps",
  gettingThere: "Getting There",
  rideHailingTitle: "Ride-Hailing Recommended",
  rideHailingBody: "Due to limited parking space at the venue...",
  valetTitle: "Free Valet Parking Service Available",
  valetBody: "For guests who prefer to bring their own car...",
  weddingDaySchedule: "Wedding Day Schedule",

  // ... all remaining sections
} as const;

export type TranslationKey = keyof typeof en;
```

`id.ts` has the identical shape with Bahasa values. String interpolation (e.g. RSVP confirmation with guest name) uses `{name}` placeholders resolved by a thin `interpolate(str, vars)` helper.

`dateLocale` drives all `Intl.DateTimeFormat` calls — components currently hardcoded to `"en-US"` switch to using this value.

## Backend Changes

### Model: `WelcomeScreen`

Add two new optional fields:

| New field | Type | Purpose |
|---|---|---|
| `headingTextId` | `string` | Bahasa heading (e.g. "Bersama keluarga mereka") |
| `deliveryLabelId` | `string` | Bahasa delivery label (e.g. "Undangan ini ditujukan kepada") |

### Model: `ScheduleEvent`

Add two new optional fields:

| New field | Type | Purpose |
|---|---|---|
| `titleId` | `string` | Bahasa event title |
| `descriptionId` | `string` | Bahasa event description |

Times are language-neutral and do not need translation.

### Migration

One migration adds four `VARCHAR` columns with empty string defaults to `welcome_screen` and `schedule_events` tables. All existing API responses include the new fields (empty initially). The frontend falls back to the English value when the ID field is empty.

### Frontend fallback logic

```ts
// Example: welcome screen heading
const heading = lang === "id" && welcomeScreen.headingTextId
  ? welcomeScreen.headingTextId
  : welcomeScreen.headingText;
```

## UI Changes

### WelcomeOverlay — Language Picker

A two-pill language selector sits above the "Open Invitation" button:

```
    [ EN ]  [ ID ]
  Open Invitation
```

- Both pills use the existing rose/cream palette
- Selected pill: filled rose background, white text
- Unselected pill: transparent with rose border, rose text
- If `?lang=id` is already in the URL on arrival, the ID pill is pre-selected
- On "Open Invitation" click: `setLang` is called with the selected language before dismissing the overlay

### NavBar — Language Toggle

A compact `EN | ID` switcher is added to the right side of the NavBar — present in both the full NavBar and the `minimal` variant (used on the gallery page):

```
Andreas & Christine  ·  [couple] [details] [rsvp]  ···  EN | ID
```

- Active language: bold, full opacity
- Inactive language: muted opacity, clickable
- Clicking calls `setLang` and rewrites the URL param in-place

## Component Wiring

Every component with hardcoded English strings calls `useLanguage()` and replaces string literals with `t("key")`:

| Component | Key changes |
|---|---|
| `WelcomeOverlay` | `t("openInvitation")`, lang picker, `headingTextId`/`deliveryLabelId` fallback logic |
| `HeroSection` | All labels; `dateLocale` replaces hardcoded `"en-US"` |
| `DetailsSection` | All section/label strings; `dateLocale` for date formatting; `titleId`/`descriptionId` from schedule events API |
| `BibleVerseSection` | Section heading; verse text evaluated during implementation (may stay in source language) |
| `CoupleSection` | Section heading, body text |
| `DressCodeSection` | Section heading, labels |
| `GallerySection` | Section heading, empty state text |
| `RsvpSection` | Form labels, attendance options, confirmation message (with `{name}` interpolation) |
| `MessagesSection` | Section heading, placeholder, submit button; guest-submitted messages displayed as-is |
| `EGiftSection` | Section heading, instructions |
| `Footer` | All text labels |
| `NavBar` | Nav link labels + language toggle |

Admin pages (`WelcomePage`, `SchedulePage`) get the new bilingual input fields. The admin UI itself stays in English.

## Translation Generation

During implementation, a one-shot script calls the Claude API with every English value from `locales/en.ts` and writes the translated output to `locales/id.ts`. The file is committed to the repo. If English strings change later, the script is re-run to regenerate the Bahasa file.

## Testing

1. `npm run check` — no TypeScript errors
2. Visit `/?to=John` — overlay shows EN pre-selected, full invitation in English
3. Pick ID on overlay, click "Open Invitation" — URL becomes `?to=John&lang=id`, all sections render in Bahasa
4. Toggle EN in NavBar — URL flips to `lang=en`, all sections switch back
5. Visit `/?lang=id` directly — overlay opens with ID pre-selected
6. Admin: update welcome screen heading text ID field, verify it displays in Bahasa
7. Admin: add a schedule event with both language fields, verify it switches
8. Run `make test` in `go-server/` — all backend tests pass
9. Run `npm test` — all frontend tests pass
