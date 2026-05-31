# Remove Google Drive Integration from the CMS Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the admin "Google Drive Integration" card and the four standalone Google Drive setup/memories pages (and their routes) from the frontend.

**Architecture:** Frontend-only deletion. The admin card is two buttons linking to a closed island of four pages that only cross-link to each other. Removing the card, the routes, and the four page files leaves no dangling references. Removed routes fall through to the existing `NotFound` catch-all (404). The guest Gallery, UploadSheet, and the entire Go backend are untouched and continue to use Google Drive.

**Tech Stack:** React 18 + TypeScript, Wouter (routing), Vitest + Testing Library, Vite.

**Spec:** `docs/superpowers/specs/2026-05-31-remove-gdrive-cms-design.md`

---

## File Structure

- **Modify** `client/src/pages/admin/__tests__/ConfigPage.test.tsx` — remove the test asserting the Drive card.
- **Modify** `client/src/pages/admin/ConfigPage.tsx` — delete the Drive `<Card>` block.
- **Modify** `client/src/App.tsx` — remove 4 imports + 4 routes.
- **Delete** `client/src/pages/MemoriesGoogleDrive.tsx`
- **Delete** `client/src/pages/MemoriesGoogleDriveUpload.tsx`
- **Delete** `client/src/pages/GoogleDriveSetup.tsx`
- **Delete** `client/src/pages/GoogleDriveInstructions.tsx`

No backend files, no `constants.ts`, no `Gallery.tsx`, no `UploadSheet.tsx`.

---

### Task 1: Remove the Drive-card test from ConfigPage tests

We follow TDD-in-reverse for a deletion: first remove the test that pins the
behavior we're deleting, confirm the suite is green, then delete the UI. This
keeps the suite green at every commit.

**Files:**
- Modify: `client/src/pages/admin/__tests__/ConfigPage.test.tsx:39-43`

- [ ] **Step 1: Delete the "renders Google Drive section" test**

Remove this block (lines 39–43) entirely:

```tsx
  it("renders Google Drive section", () => {
    renderConfigPage();
    expect(screen.getByText("Google Drive Integration")).toBeInTheDocument();
    expect(screen.getByText("Configure Google Drive OAuth")).toBeInTheDocument();
  });

```

The first test in the `describe` block becomes `"renders ImageManager component"`.

- [ ] **Step 2: Run the ConfigPage test file to verify it passes**

Run: `npm test -- ConfigPage`
Expected: PASS. The Google-Drive test is gone; the remaining 4 tests
(`renders ImageManager component`, `renders MusicManager component`,
`renders E-Gift form`, `loads e-gift settings into form`) all pass.

Note: the card still renders in the component at this point — that's fine, no
test asserts it anymore.

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/admin/__tests__/ConfigPage.test.tsx
git commit -m "test: remove Google Drive card assertion from ConfigPage tests"
```

---

### Task 2: Delete the Drive card from ConfigPage

**Files:**
- Modify: `client/src/pages/admin/ConfigPage.tsx:165-209`

- [ ] **Step 1: Delete the Google Drive `<Card>` block**

In `ConfigPage.tsx`, the `return` opens at line 164 with:

```tsx
  return (
    <div className="space-y-6">
      {/* Google Drive Configuration */}
      <Card>
```

Remove the entire Drive card — from the `{/* Google Drive Configuration */}`
comment (line 166) through its closing `</Card>` (line 209) — so the JSX becomes:

```tsx
  return (
    <div className="space-y-6">
      {/* Image Configuration */}
      <Card>
```

Delete exactly this span (lines 166–209):

```tsx
      {/* Google Drive Configuration */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <Settings className="h-6 w-6 text-blue-600" />
            <div>
              <CardTitle className="text-xl">
                Google Drive Integration
              </CardTitle>
              <CardDescription>
                Configure Google Drive for guest photo uploads
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Enable guests to upload photos directly to your Google Drive
              folder. Requires one-time OAuth setup.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button asChild className="flex-1">
                <a
                  href="/google-drive-setup"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Configure Google Drive OAuth
                </a>
              </Button>
              <Button asChild variant="outline" className="flex-1">
                <a
                  href="/google-drive-instructions"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Setup Instructions
                </a>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

```

Do **not** touch the import block. Every imported symbol is still used by
surviving cards: `Settings` (Image Configuration card), `Card`/`CardHeader`/
`CardTitle`/`CardDescription`/`CardContent` (Image, Music, E-Gift cards), and
`Button` (E-Gift form). Removing any of them would break the build.

- [ ] **Step 2: Type-check to confirm no unused imports or dangling refs**

Run: `npm run check`
Expected: PASS, no errors. (If it reports an unused import, that symbol was only
used by the deleted card — remove just that symbol. Based on current usage, none
should be unused.)

- [ ] **Step 3: Run the ConfigPage tests**

Run: `npm test -- ConfigPage`
Expected: PASS (4 tests).

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/admin/ConfigPage.tsx
git commit -m "feat: remove Google Drive Integration card from admin Config page"
```

---

### Task 3: Remove Drive routes and imports from App.tsx, delete page files

**Files:**
- Modify: `client/src/App.tsx:7-10,26-29`
- Delete: `client/src/pages/MemoriesGoogleDrive.tsx`
- Delete: `client/src/pages/MemoriesGoogleDriveUpload.tsx`
- Delete: `client/src/pages/GoogleDriveSetup.tsx`
- Delete: `client/src/pages/GoogleDriveInstructions.tsx`

- [ ] **Step 1: Remove the four page imports from App.tsx**

Delete these four lines (7–10):

```tsx
import MemoriesGoogleDrive from "@/pages/MemoriesGoogleDrive";
import MemoriesGoogleDriveUpload from "@/pages/MemoriesGoogleDriveUpload";
import GoogleDriveSetup from "@/pages/GoogleDriveSetup";
import GoogleDriveInstructions from "@/pages/GoogleDriveInstructions";
```

Keep all other imports, including `Redirect` from `wouter` (used by the
`/admin-dashboard` redirect) and `Gallery`.

- [ ] **Step 2: Remove the four Drive routes from the `<Switch>`**

Delete these four lines (26–29):

```tsx
      <Route path="/memories-drive" component={MemoriesGoogleDrive} />
      <Route path="/memories-upload" component={MemoriesGoogleDriveUpload} />
      <Route path="/google-drive-setup" component={GoogleDriveSetup} />
      <Route path="/google-drive-instructions" component={GoogleDriveInstructions} />
```

The surviving routes around them stay intact:

```tsx
      <Route path="/gallery" component={Gallery} />
      <Route path="/memories" component={Gallery} />
      <Route path="/admin" nest>
```

(`/memories-drive` and `/memories-upload` now fall through to the catch-all
`<Route component={NotFound} />` → 404, as intended.)

- [ ] **Step 3: Delete the four page files**

Run:

```bash
git rm client/src/pages/MemoriesGoogleDrive.tsx \
       client/src/pages/MemoriesGoogleDriveUpload.tsx \
       client/src/pages/GoogleDriveSetup.tsx \
       client/src/pages/GoogleDriveInstructions.tsx
```

- [ ] **Step 4: Type-check to confirm no dangling references**

Run: `npm run check`
Expected: PASS. No file imports the deleted pages (verified: only `App.tsx`
referenced them, and the four pages only cross-linked to each other via string
`href`/`Link` paths, not imports).

- [ ] **Step 5: Commit**

```bash
git add client/src/App.tsx
git commit -m "feat: remove Google Drive setup/memories pages and routes"
```

---

### Task 4: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Type-check the whole project**

Run: `npm run check`
Expected: PASS, zero errors.

- [ ] **Step 2: Run the full frontend test suite**

Run: `npm test -- --run`
Expected: PASS. In particular `ConfigPage` (4 tests) and `Gallery` tests pass.
Gallery is unchanged and still references `/api/drive-folder-contents` — that is
expected and correct.

- [ ] **Step 3: Build the frontend**

Run: `npm run build`
Expected: build succeeds, output to `dist/public`, no errors about missing
modules.

- [ ] **Step 4: Confirm no stray references to the removed routes/pages remain**

Run:

```bash
grep -rnE "MemoriesGoogleDrive|GoogleDriveSetup|GoogleDriveInstructions|/google-drive-setup|/google-drive-instructions|/memories-drive|/memories-upload" client/src/
```

Expected: no output (empty). Any hit means a dangling reference to fix.

Note: `grep -rni "drive" client/src/` will still return hits in `Gallery.tsx`,
`UploadSheet.tsx`, and `constants.ts` — those are intentionally kept (out of
scope) and should remain.
