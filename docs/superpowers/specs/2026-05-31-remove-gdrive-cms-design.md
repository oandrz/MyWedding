# Remove Google Drive Integration from the CMS Page — Design

**Date:** 2026-05-31
**Status:** Approved (pending spec review)

## Goal

Remove the Google Drive admin-facing setup UI from the platform:

1. The "Google Drive Integration" card on the admin CMS Config page.
2. The four standalone Google Drive setup / memories pages and their routes.

This removes the admin onboarding surface for Google Drive **only**. It does not
change how guest photos are stored or served.

## Scope

Frontend-only change. No backend code, routes, config, or dependencies are touched.

### In scope (removed)

- The `Google Drive Integration` `<Card>` block in `client/src/pages/admin/ConfigPage.tsx`.
- The four page components and their routes:
  - `/memories-drive` → `MemoriesGoogleDrive.tsx`
  - `/memories-upload` → `MemoriesGoogleDriveUpload.tsx`
  - `/google-drive-setup` → `GoogleDriveSetup.tsx`
  - `/google-drive-instructions` → `GoogleDriveInstructions.tsx`
- The `ConfigPage.test.tsx` test that asserts the Drive card renders.

### Explicitly out of scope (kept as-is)

- `client/src/pages/Gallery.tsx` — still fetches `/api/drive-folder-contents` and
  renders `/api/drive-thumbnail`, still imports `GOOGLE_DRIVE_FOLDER_URL`.
- `client/src/components/UploadSheet.tsx` — still POSTs to `/api/upload-to-drive`.
- `GOOGLE_DRIVE_*` constants in `client/src/lib/constants.ts` (used by Gallery).
- All Go backend code: `internal/handler/googledrive.go`,
  `internal/service/googledrive.go`, router wiring (`WithGoogleDrive`),
  `cmd/server/main.go` wiring, config fields, and the
  `golang.org/x/oauth2` / `google.golang.org/api` dependencies.

## Rationale

The admin card and the four setup pages form a closed island: the card's two
buttons link only to `/google-drive-setup` and `/google-drive-instructions`, and
the four pages only cross-link to each other. Nothing outside this island
references those routes.

The Gallery's dependency on Google Drive is **independent** of the admin card.
The Gallery talks directly to the Go backend (`/api/drive-folder-contents`,
`/api/drive-thumbnail`) and does not reference the card or the setup pages.
Therefore the card and setup pages can be removed with no effect on the guest
gallery, which continues to be backed by Google Drive.

## Changes

### 1. `client/src/pages/admin/ConfigPage.tsx`

Delete the `Google Drive Integration` `<Card>` block (the `{/* Google Drive
Configuration */}` comment through its closing `</Card>`). The first rendered
card becomes `Image Configuration`.

Keep the `Settings` icon import — it is reused by the Image Configuration card.

### 2. `client/src/pages/admin/__tests__/ConfigPage.test.tsx`

Remove the `"renders Google Drive section"` test, which asserts the now-deleted
card text (`Google Drive Integration`, `Configure Google Drive OAuth`). Leaving
it would fail the suite.

### 3. `client/src/App.tsx`

- Remove the four page imports (`MemoriesGoogleDrive`,
  `MemoriesGoogleDriveUpload`, `GoogleDriveSetup`, `GoogleDriveInstructions`).
- Remove the four `<Route>` entries (`/memories-drive`, `/memories-upload`,
  `/google-drive-setup`, `/google-drive-instructions`).
- Keep `/gallery` and `/memories` (both → `Gallery`), and the `Redirect` import
  (used by the `/admin-dashboard` redirect).

### 4. Delete page files

- `client/src/pages/MemoriesGoogleDrive.tsx`
- `client/src/pages/MemoriesGoogleDriveUpload.tsx`
- `client/src/pages/GoogleDriveSetup.tsx`
- `client/src/pages/GoogleDriveInstructions.tsx`

There are no dedicated test files for these four pages.

## Dead-route behavior

The removed routes (`/memories-drive`, `/memories-upload`,
`/google-drive-setup`, `/google-drive-instructions`) will fall through to the
existing catch-all `<Route component={NotFound} />` in `App.tsx` and render the
404 page. No redirects are added (per decision: "Just 404").

## Consequence to keep in mind

Because the Gallery and UploadSheet remain, the Google Drive backend stays live
and the guest gallery still pulls photos from Google Drive. This change removes
only the admin-facing configuration UI and the standalone setup/memories pages —
not Google Drive functionality itself. This is intentional and consistent with
the chosen scope.

## Verification

- `npm run check` — TypeScript type check passes (no dangling imports/refs).
- `npm run build` — frontend builds clean.
- Frontend test suite (vitest) — `ConfigPage` and `Gallery` tests pass; the
  removed Drive-section test is gone.
- Manual sanity: `/admin/config` no longer shows the Drive card; visiting a
  removed route renders NotFound.
