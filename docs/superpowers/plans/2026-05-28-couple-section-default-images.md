# CoupleSection Default Profile Images Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the two hardcoded Unsplash URL fallbacks in `CoupleSection.tsx` with locally bundled Vite imports of the user-supplied `groom_default.jpg` and `bride_default.jpg` so the home-section profile placeholders are on-brand and never depend on an external CDN.

**Architecture:** Single-file frontend edit. Add two `import` statements to `client/src/components/CoupleSection.tsx` that pull the local JPGs through the existing `@` Vite alias (`@` → `client/src/`), then replace the two Unsplash URL string literals on lines 35 and 38 with the imported variables. No API, no contract, no other component touched.

**Tech Stack:** React 18 + TypeScript + Vite. Vite handles the JPG imports (content-hashing, bundling). TanStack React Query already drives the fetch — its behavior is unchanged.

**Reference:** `docs/adr/0001-couple-section-default-images.md`

---

## Pre-flight

- [ ] **Step 0a: Verify the user-supplied assets exist**

Run:
```bash
ls -la client/src/assets/groom_default.jpg client/src/assets/bride_default.jpg
```
Expected: both files listed, non-zero size. If either is missing, STOP and ask the user to provide it before continuing.

- [ ] **Step 0b: Confirm the `@` alias maps to `client/src`**

Run:
```bash
grep -A2 'resolve' vite.config.ts | head -20
```
Expected output contains an alias entry mapping `@` to a path that ends in `client/src` (e.g. `path.resolve(__dirname, "client", "src")` or similar). If the alias is named differently in this repo, adjust the import paths in Step 1b accordingly before editing — but do NOT change `vite.config.ts`.

---

## Task 1: Swap Unsplash URLs for local imports in CoupleSection.tsx

**Files:**
- Modify: `client/src/components/CoupleSection.tsx` (add 2 imports near top; replace fallback strings at lines 35 and 38)

- [ ] **Step 1a: Read the current file to confirm line numbers**

Run:
```bash
sed -n '1,10p;30,40p' client/src/components/CoupleSection.tsx
```
Expected: lines 1–7 are the existing imports (`framer-motion`, `react`, `@tanstack/react-query`, constants, animations, schema, language context). Lines 34–38 contain the `brideImage`/`groomImage` definitions with two `https://images.unsplash.com/...` URLs as the `||` fallback values.

If the line numbers have drifted from what this plan assumes (line 35 = bride fallback, line 38 = groom fallback), use the literal URL strings in the edits below as the anchor rather than the line numbers.

- [ ] **Step 1b: Add the two image imports at the top of the file**

Use the Edit tool on `client/src/components/CoupleSection.tsx`.

`old_string`:
```ts
import { useLanguage } from "@/contexts/LanguageContext";
```

`new_string`:
```ts
import { useLanguage } from "@/contexts/LanguageContext";
import groomDefaultImg from "@/assets/groom_default.jpg";
import brideDefaultImg from "@/assets/bride_default.jpg";
```

Rationale: the `useLanguage` import is the last existing import line (line 7) and is unique in the file, so it's a safe anchor for inserting the new imports immediately after.

- [ ] **Step 1c: Replace the bride Unsplash fallback**

Use the Edit tool on `client/src/components/CoupleSection.tsx`.

`old_string`:
```ts
  const brideImage = brideImagesData?.images?.find(img => img.isActive)?.imageUrl || 
    "https://images.unsplash.com/photo-1580489944761-15a19d654956?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=500&q=80";
```

`new_string`:
```ts
  const brideImage = brideImagesData?.images?.find(img => img.isActive)?.imageUrl || brideDefaultImg;
```

- [ ] **Step 1d: Replace the groom Unsplash fallback**

Use the Edit tool on `client/src/components/CoupleSection.tsx`.

`old_string`:
```ts
  const groomImage = groomImagesData?.images?.find(img => img.isActive)?.imageUrl || 
    "https://images.unsplash.com/photo-1564564321837-a57b7070ac4f?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=500&q=80";
```

`new_string`:
```ts
  const groomImage = groomImagesData?.images?.find(img => img.isActive)?.imageUrl || groomDefaultImg;
```

- [ ] **Step 1e: TypeScript type check**

Run from project root:
```bash
npm run check
```
Expected: exits 0 with no errors. If TS complains "Cannot find module '@/assets/groom_default.jpg' or its corresponding type declarations", that means the project has no ambient declaration for `.jpg` imports. Fix by checking `client/src/vite-env.d.ts` for `/// <reference types="vite/client" />` — Vite's client types declare modules for image imports. If that reference is missing, add it. Do not add a custom `.d.ts` file unless `vite-env.d.ts` is absent entirely.

- [ ] **Step 1f: Confirm no other file referenced the old Unsplash URLs**

Run:
```bash
grep -rn "photo-1580489944761\|photo-1564564321837" client/src --include="*.tsx" --include="*.ts"
```
Expected: no matches. If anything matches, STOP — those references would also need to be updated (or the plan re-scoped). The pre-task investigation indicated these strings live only in `CoupleSection.tsx`, so this should be clean.

- [ ] **Step 1g: Manual browser verification**

Open two terminals (or use existing dev processes):

Terminal A (backend):
```bash
cd go-server && make run-dev
```

Terminal B (frontend):
```bash
npm run dev
```

Then in a browser:
1. Open `http://localhost:5173` and scroll to the Couple section. Confirm the configured profile photos render normally (the swap should be invisible when the API returns real data).
2. Open DevTools → Network tab → right-click each of `/api/config-images/bride-profile` and `/api/config-images/groom-profile` → Block request URL.
3. Hard-reload (Cmd+Shift+R). Confirm the bride and groom circles now show the new local images (not the previous stock Unsplash photos) cropped cleanly inside the circular `h-64 w-64` frames via `object-cover`.
4. Unblock the URLs and reload to confirm the configured photos return.

If either local image looks awkwardly cropped (e.g. a face is clipped), the JPG itself needs reframing — flag this back to the user. Do not change the markup.

- [ ] **Step 1h: Commit**

```bash
git add client/src/components/CoupleSection.tsx client/src/assets/groom_default.jpg client/src/assets/bride_default.jpg docs/adr/0001-couple-section-default-images.md docs/superpowers/plans/2026-05-28-couple-section-default-images.md
git commit -m "fix(couple-section): use local default profile images instead of Unsplash

Replaces the two hardcoded Unsplash URL fallbacks in CoupleSection.tsx
with locally bundled Vite imports of groom_default.jpg and bride_default.jpg.
Eliminates the off-brand stock-photo flash visible under high load when the
/api/config-images/*-profile React Query call returns empty.

See docs/adr/0001-couple-section-default-images.md for context."
```

Expected: commit succeeds. If a pre-commit hook fails, fix the underlying issue and create a NEW commit (do not amend).

---

## Out of Scope (per ADR)

- Investigating *why* the React Query fetch returns empty under high load. A follow-up plan can address candidates like retry policy, longer cache TTL, persisting last-known-good image, or a skeleton loader that suppresses the fallback while in flight.
- Touching any other component, even ones that may also use Unsplash URLs.
- Adding automated tests — there is no logic to assert; the change is purely a visual fallback swap.
