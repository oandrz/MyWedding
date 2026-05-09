# Dress Code Section Design

**Date:** 2026-05-09
**Status:** Approved

## Overview

Add a Dress Code section to the wedding invitation site that shows guests which attire colors to avoid. Colors are managed dynamically by the admin. The section is guarded by a feature flag.

## Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Data per color | Hex + label (swatch + name) | Clean, sufficient; no notes needed |
| Backend storage | JSON string in `app_settings` | At most 4–5 colors; dedicated table is over-engineering |
| Section placement | After `DetailsSection` | Groups event logistics together |
| Feature flag | Yes, `dress_code`, disabled by default | Consistent with all other sections |
| Admin UI | New dedicated page in sidebar nav | Keeps ConfigPage focused |
| Guest section style | No glass card, swatches float on warm background | Matches the simpler first mockup |

## Backend Changes

### Migration: `008_add_dress_code.sql`

```sql
INSERT INTO feature_flags (feature_key, feature_name, description, enabled)
VALUES ('dress_code', 'Dress Code', 'Show dress code section with forbidden attire colors', FALSE)
ON CONFLICT (feature_key) DO NOTHING;
```

No new tables. No new Go files. Colors are stored in the existing `app_settings` table:

- **Key:** `dress_code_colors`
- **Value:** JSON string, e.g. `[{"hex":"#FFFFFF","label":"White"},{"hex":"#FFD700","label":"Gold"}]`
- **Default:** Key absent → treat as empty array `[]`

All reads use the existing public `GET /api/app-settings` endpoint.
All writes use the existing admin `PATCH /api/admin/app-settings/bulk` endpoint.

## Frontend: Guest Section

**File:** `client/src/components/DressCodeSection.tsx`

**Styling** (matches existing section patterns):
- `section` container: `py-20 bg-gradient-to-b from-white via-rose-50/30 to-white paper-texture`
- Uppercase label above heading: `text-sm uppercase font-montserrat tracking-widest text-muted-foreground`
- Heading: `text-5xl md:text-6xl font-cormorant font-bold text-foreground`
- Divider bar: `w-24 h-1 bg-primary mx-auto rounded-full mb-6`
- Subtitle: `text-muted-foreground font-montserrat max-w-2xl mx-auto`
- Swatches: floating directly on the background — **no glass card wrapper**
- Each swatch: circular div + name label underneath, `border-2 border-primary`
- Animations: `framer-motion` with `whileInView`, `fadeIn` / `staggerContainer` from `@/lib/animations`

**Data fetching:**
```ts
const { data } = useQuery<{ settings: any[] }>({ queryKey: ["/api/app-settings"] });
const raw = data?.settings.find(s => s.settingKey === "dress_code_colors")?.settingValue ?? "[]";
let colors: { hex: string; label: string }[] = [];
try { colors = JSON.parse(raw); } catch { colors = []; }
```

Renders nothing (returns `null`) when `colors` is empty.

**Loading state:** Show nothing (section is hidden while loading rather than showing a spinner, since absence is cleaner for a decorative section).

## Frontend: Feature Flag Hook

**File:** `client/src/hooks/useFeatureFlags.ts` — add one export:

```ts
export function useDressCodeEnabled() {
  const { isFeatureEnabled } = useFeatureFlags();
  return isFeatureEnabled('dress_code');
}
```

## Frontend: Home.tsx

Add hook call alongside existing flag hooks:
```ts
const isDressCodeEnabled = useDressCodeEnabled();
```

Insert after `<DetailsSection />`, following the floral divider pattern:

```tsx
{isDressCodeEnabled && <div className="floral-divider w-full"></div>}
{isDressCodeEnabled && <DressCodeSection />}
```

## Frontend: Admin Page

**File:** `client/src/pages/admin/DressCodePage.tsx`

**Structure:** Single `Card` (matches existing admin page pattern).

**State:**
- `colors: { hex: string; label: string }[]` — current list
- `newHex: string` — color picker value, default `"#FFFFFF"`
- `newLabel: string` — text input value

**Add flow:** Validate hex is non-empty + label is non-empty → append to `colors` array → local state only (not saved yet).

**Remove flow:** Filter out by index → local state only.

**Save:** `PATCH /api/admin/app-settings/bulk` with the full serialized array. Invalidate `["/api/app-settings"]` query on success.

**Empty state:** When `colors` is empty, show a dashed placeholder: *"No colors yet — use the form above to add some."*

**UX note:** The color picker uses the native HTML `<input type="color">` — no third-party dependency needed.

## Frontend: AdminLayout.tsx

Add to `NAV_ITEMS`:
```ts
{ path: "/dress-code", label: "Dress Code", icon: Palette }
```

Add to `Switch`:
```tsx
<Route path="/dress-code" component={DressCodePage} />
```

Import `Palette` from `lucide-react`.

## Files Changed

| File | Change |
|---|---|
| `go-server/migrations/008_add_dress_code.sql` | New — feature flag seed |
| `client/src/components/DressCodeSection.tsx` | New — guest-facing section |
| `client/src/hooks/useFeatureFlags.ts` | Add `useDressCodeEnabled` export |
| `client/src/pages/Home.tsx` | Add `DressCodeSection` after `DetailsSection` |
| `client/src/pages/admin/DressCodePage.tsx` | New — admin color manager |
| `client/src/pages/admin/AdminLayout.tsx` | Add nav item + route |

## Out of Scope

- Color ordering / drag-to-reorder (YAGNI — 4–5 colors max)
- Per-color notes/reasons
- Color validation beyond non-empty hex
- Dedicated backend table (JSON in `app_settings` is sufficient at this scale)
