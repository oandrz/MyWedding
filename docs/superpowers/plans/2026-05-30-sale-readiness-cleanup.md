# Sale-Readiness Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the MyWedding repo into a clean, generic, build-passing product that can be sold as a white-label template, and provide a repeatable per-buyer snapshot-delivery script.

**Architecture:** Mutate the working tree in place across six cleanup tasks (personal data → generic demo couple "James & Olivia"; remove Replit residue; consolidate docs; rename Go module). A final verification gate must pass before a `make-release.sh` script exports a clean, history-free snapshot into a fresh private repo per buyer. The seller's own repo (full history, dev tooling) is never shipped.

**Tech Stack:** React 18 + TypeScript + Vite (frontend), Go 1.25 + Chi (backend), PostgreSQL, Bash + git + gh CLI (release tooling).

**Spec:** `docs/superpowers/specs/2026-05-30-sale-readiness-cleanup-design.md`

**Conventions for this plan:** This is a cleanup effort, so most "tests" are grep/build/lint gates rather than new unit tests. Each task makes its change, runs a verification command with expected output, then commits. Work on a branch off the current `task/refactor_update` (or a fresh `chore/sale-cleanup` branch). All `sed -i` commands use the macOS/BSD form `sed -i ''`.

---

## Task 0: Fix pre-existing tsc failure (DONE — discovered during execution)

A pre-existing `TS2802` (Set iteration) error in `client/src/pages/admin/InvitesPage.tsx:1487` made `npm run check` fail. Root cause: `tsconfig.json` had no `target`, so `tsc` defaulted to ES3. Fix: added `"target": "ES2020"` (Vite handles real transpilation via esbuild; this only affects type-checking). Committed in `1da801e`. Recorded here so the verification gates in Tasks 1/9 can expect a clean `npm run check`.

---

## Task 1: Replace personal love story (locales)

**Files:**
- Modify: `client/src/locales/en.ts:40-42`
- Modify: `client/src/locales/id.ts:42-44`

- [ ] **Step 1: Replace the English story paragraphs**

In `client/src/locales/en.ts`, replace lines 40-42 (the three `ourStoryParagraph` values) with:

```ts
  ourStoryParagraph1: "James and Olivia first crossed paths at a friend's birthday dinner. What began as a passing conversation about favorite places to travel quickly turned into hours of talking, long after everyone else had gone home.",
  ourStoryParagraph2: "A casual coffee became a standing weekly date. Neither of them planned for it, but somewhere between shared playlists and late-night calls, a simple friendship grew into something far more meaningful.",
  ourStoryParagraph3: "After several wonderful years together, James asked the question that would change everything — and Olivia said yes. So here we are, making it official and inviting you to be part of our most important day! 😊",
```

- [ ] **Step 2: Replace the Indonesian story paragraphs**

In `client/src/locales/id.ts`, replace lines 42-44 with:

```ts
  ourStoryParagraph1: "James dan Olivia pertama kali bertemu di acara ulang tahun seorang teman. Obrolan singkat tentang tempat-tempat favorit untuk berlibur dengan cepat berubah menjadi percakapan panjang, jauh setelah para tamu lain pulang.",
  ourStoryParagraph2: "Secangkir kopi santai berubah menjadi kencan mingguan. Tidak ada yang merencanakannya, tetapi di antara daftar putar bersama dan panggilan telepon larut malam, persahabatan sederhana tumbuh menjadi sesuatu yang jauh lebih berarti.",
  ourStoryParagraph3: "Setelah beberapa tahun indah bersama, James mengajukan pertanyaan yang akan mengubah segalanya — dan Olivia menjawab ya. Maka inilah kami, meresmikannya dan mengundang Anda untuk menjadi bagian dari hari terpenting kami! 😊",
```

- [ ] **Step 3: Verify no personal names remain in locales**

Run: `grep -rni "andreas\|christine" client/src/locales/`
Expected: no output (exit code 1).

- [ ] **Step 4: Type-check passes**

Run: `npm run check`
Expected: completes with no errors.

- [ ] **Step 5: Commit**

```bash
git add client/src/locales/en.ts client/src/locales/id.ts
git commit -m "chore: replace personal love story with generic demo content"
```

---

## Task 2: Replace personal names in schema, components, and admin UI

**Files:**
- Modify: `shared/schema.ts:111`
- Modify: `client/src/components/EGiftSection.tsx:87-97`
- Modify: `client/src/pages/admin/AdminLayout.tsx:113`
- Modify: `client/src/pages/admin/WelcomePage.tsx:115,132,244,248`
- Modify: `client/src/pages/admin/ConfigPage.tsx:327,381`
- Modify: `client/index.html:6` (page `<title>` — contains the couple's full legal name)

- [ ] **Step 1: Update the schema default heading**

In `shared/schema.ts:111`, replace:
```ts
  headingText: text("heading_text").notNull().default("The Wedding of Andreas & Christine"),
```
with:
```ts
  headingText: text("heading_text").notNull().default("The Wedding of James & Olivia"),
```

- [ ] **Step 2: Update EGiftSection defaults**

In `client/src/components/EGiftSection.tsx`, replace lines 87-97:
```ts
  const groomAccount: BankAccount = {
    accountHolder: getSettingValue("egift_groom_name", "James"),
    bankName: getSettingValue("egift_groom_bank", "Example Bank"),
    accountNumber: getSettingValue("egift_groom_account", "0000000000"),
  };

  const brideAccount: BankAccount = {
    accountHolder: getSettingValue("egift_bride_name", "Olivia"),
    bankName: getSettingValue("egift_bride_bank", "Example Bank"),
    accountNumber: getSettingValue("egift_bride_account", "0000000000"),
  };
```

- [ ] **Step 3: Update the admin dashboard label**

In `client/src/pages/admin/AdminLayout.tsx:113`, replace:
```tsx
                <p className="text-sm text-gray-600">Andreas &amp; Christine's Wedding Dashboard</p>
```
with:
```tsx
                <p className="text-sm text-gray-600">James &amp; Olivia's Wedding Dashboard</p>
```

- [ ] **Step 4: Update WelcomePage placeholders**

In `client/src/pages/admin/WelcomePage.tsx`:
- Line 115: `placeholder="e.g., The Wedding of Andreas & Christine"` → `placeholder="e.g., The Wedding of James & Olivia"`
- Line 132: `placeholder="e.g., Pernikahan Andreas & Christine"` → `placeholder="e.g., Pernikahan James & Olivia"`
- Line 244: `https://your-site.com/?to=Christine` → `https://your-site.com/?to=Olivia`
- Line 248: the example text referencing `"Christine"` → `"Olivia"`

- [ ] **Step 5: Update ConfigPage placeholders**

In `client/src/pages/admin/ConfigPage.tsx`:
- Line 327: `placeholder="Andreas"` → `placeholder="James"`
- Line 381: `placeholder="Christine"` → `placeholder="Olivia"`

- [ ] **Step 6: Replace the page title**

In `client/index.html:6`, replace:
```html
    <title>Andreas & Christine Natasya Serena Wedding Invitation</title>
```
with:
```html
    <title>James & Olivia Wedding Invitation</title>
```

- [ ] **Step 7: Verify no personal names remain in client/shared (non-test)**

Run: `grep -rni "andreas\|christine" client shared --include="*.ts" --include="*.tsx" --include="*.html" | grep -v "__tests__"`
Expected: no output (exit code 1).

- [ ] **Step 8: Type-check passes**

Run: `npm run check`
Expected: completes with no errors.

- [ ] **Step 9: Commit**

```bash
git add shared/schema.ts client/src/components/EGiftSection.tsx client/src/pages/admin/AdminLayout.tsx client/src/pages/admin/WelcomePage.tsx client/src/pages/admin/ConfigPage.tsx client/index.html
git commit -m "chore: replace personal names with generic demo couple in UI, schema, and page title"
```

**Discovered during execution (additional leaks beyond the originally-listed files — all fixed in commits `aec7b12` and `b830fd6`):**
- `client/src/lib/constants.ts` — `BRIDE_NAME` held the bride's full legal name ("Christine Natasya Serena"); `GROOM_NAME`, gallery alt text, and the real venue (`Casakhasa Kemang` + full Jakarta address) genericized to James/Olivia + "Grand Ballroom" placeholder.
- `client/src/components/DetailsSection.tsx` — real Google Maps place URL + embed (hardcoded coordinates `-6.2594469,106.8204341`) replaced with generic `VENUES`-driven map links; iframe title degenericized.
- `client/src/locales/en.ts` / `id.ts` — `valetBody` referenced "Casakhasa" by name; genericized to "the venue" / "tempat acara".
- `.gitignore` — stale Python block contained a bare `lib/` pattern that was **ignoring application code under `client/src/lib`**; removed the dead Python section.

---

## Task 3: Update the failing front-end test for new defaults

**Files:**
- Modify: `client/src/pages/admin/__tests__/ConfigPage.test.tsx:63,67`

- [ ] **Step 1: Run the test to confirm it now fails**

Run: `npx vitest run client/src/pages/admin/__tests__/ConfigPage.test.tsx`
Expected: FAIL — the test still asserts the old value `Andreas`. (If it happens to pass because the mock supplies the value, proceed anyway; the goal is consistency with the new demo couple.)

- [ ] **Step 2: Update the mock and assertion**

In `client/src/pages/admin/__tests__/ConfigPage.test.tsx`:
- Line 63: `{ settingKey: "egift_groom_name", settingValue: "Andreas" },` → `{ settingKey: "egift_groom_name", settingValue: "James" },`
- Line 67: `expect(screen.getByDisplayValue("Andreas")).toBeInTheDocument();` → `expect(screen.getByDisplayValue("James")).toBeInTheDocument();`

- [ ] **Step 3: Run the test to confirm it passes**

Run: `npx vitest run client/src/pages/admin/__tests__/ConfigPage.test.tsx`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/admin/__tests__/ConfigPage.test.tsx
git commit -m "test: update ConfigPage test for generic demo couple"
```

---

## Task 4: Replace personal seed data in the migration

**Files:**
- Modify: `go-server/migrations/001_init.sql:62,91-96,101`

- [ ] **Step 1: Update the welcome_screen default heading (line 62)**

Replace:
```sql
    heading_text TEXT NOT NULL DEFAULT 'The Wedding of Andreas & Christine',
```
with:
```sql
    heading_text TEXT NOT NULL DEFAULT 'The Wedding of James & Olivia',
```

- [ ] **Step 2: Update the seeded app_settings (lines 91-96)**

Replace:
```sql
    ('egift_groom_name', 'Andreas', 'text', 'Groom name for e-gift'),
    ('egift_groom_bank', 'Bank BCA', 'text', 'Groom bank for e-gift'),
    ('egift_groom_account', '1234567890', 'text', 'Groom account number'),
    ('egift_bride_name', 'Christine', 'text', 'Bride name for e-gift'),
    ('egift_bride_bank', 'Bank BCA', 'text', 'Bride bank for e-gift'),
    ('egift_bride_account', '0987654321', 'text', 'Bride account number')
```
with:
```sql
    ('egift_groom_name', 'James', 'text', 'Groom name for e-gift'),
    ('egift_groom_bank', 'Example Bank', 'text', 'Groom bank for e-gift'),
    ('egift_groom_account', '0000000000', 'text', 'Groom account number'),
    ('egift_bride_name', 'Olivia', 'text', 'Bride name for e-gift'),
    ('egift_bride_bank', 'Example Bank', 'text', 'Bride bank for e-gift'),
    ('egift_bride_account', '0000000000', 'text', 'Bride account number')
```

- [ ] **Step 3: Update the seeded welcome_screen row (line 101)**

Replace:
```sql
    (1, 'The Wedding of Andreas & Christine', 'Kindly Delivered to', 'Our Dearest Guest', TRUE)
```
with:
```sql
    (1, 'The Wedding of James & Olivia', 'Kindly Delivered to', 'Our Dearest Guest', TRUE)
```

- [ ] **Step 4: Verify no personal data remains in the migration**

Run: `grep -ni "andreas\|christine\|bca\|1234567890\|0987654321" go-server/migrations/001_init.sql`
Expected: no output (exit code 1).

- [ ] **Step 5: Commit**

```bash
git add go-server/migrations/001_init.sql
git commit -m "chore: replace personal seed data with generic demo values"
```

---

## Task 5: Remove Replit residue and verify the build

**Files:**
- Modify: `vite.config.ts:1-13`
- Modify: `package.json` (remove 2 deps)
- Delete: `theme.json`, `.replit`, `replit.nix`, `generated-icon.png`, `vite.config.local.ts`

- [ ] **Step 1: Edit vite.config.ts to drop the Replit plugins**

Replace the top of `vite.config.ts` (lines 1-13) so the imports and plugins array no longer reference Replit:
```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
  ],
```
(Leave the rest of the file — `resolve`, `root`, `build`, `server` — unchanged.)

- [ ] **Step 2: Remove the Replit dev dependencies**

Run:
```bash
npm uninstall @replit/vite-plugin-shadcn-theme-json @replit/vite-plugin-runtime-error-modal
```
This updates both `package.json` and `package-lock.json`.

- [ ] **Step 3: Delete orphaned Replit files**

The rose primary color already lives in `client/src/index.css:21` (`--primary: 0 41% 76%`), so deleting `theme.json` does not change runtime appearance.
```bash
git rm theme.json .replit replit.nix generated-icon.png vite.config.local.ts
```

- [ ] **Step 4: Verify no Replit references remain in shipped files**

Run: `grep -rni "replit" --include="*.ts" --include="*.tsx" --include="*.json" --include="*.nix" . | grep -v node_modules | grep -v package-lock.json`
Expected: no output (exit code 1).

- [ ] **Step 5: Verify the build still succeeds**

Run: `npm run build`
Expected: build completes, output written to `dist/public`, no errors about missing `@replit/*` modules or `theme.json`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: remove Replit plugins, config, and generated assets"
```

---

## Task 6: Consolidate documentation and write buyer-facing docs

**Files:**
- Delete: `DOCKER_SETUP.md`, `LOCAL_DEVELOPMENT_SETUP.md`, `OAUTH_SETUP_GUIDE.md`, `COLIMA_SETUP.md`, `SHARED_DRIVE_SETUP.md`, `setup-local.sh`, `test-wedding-platform.sh`
- Modify: `.env.example`
- Create: `DEPLOYMENT.md`
- Create: `LICENSE`

- [ ] **Step 1: Delete stale-stack setup docs and scripts**

`setup-local.sh` and `test-wedding-platform.sh` predate the Go rewrite and are entirely about the dead Python/Flask/Express stack (they install `flask`/`pydantic` and curl an "Express Server"). They are wrong for the current product — delete them.

```bash
git rm DOCKER_SETUP.md LOCAL_DEVELOPMENT_SETUP.md OAUTH_SETUP_GUIDE.md COLIMA_SETUP.md SHARED_DRIVE_SETUP.md setup-local.sh test-wedding-platform.sh
```

- [ ] **Step 2: Fix the root `.env.example`**

Replace the entire contents of `.env.example` with (removes Express/Flask/Replit references; aligns to the Go server):
```bash
# MyWedding Platform — Environment Configuration
# Copy to .env and fill in real values. See DEPLOYMENT.md for full details.

# --- Required ---
# PostgreSQL connection string
DATABASE_URL="postgresql://wedding_user:CHANGE_ME@localhost:5432/wedding_invitation_db"

# Admin login (set ONE of these; ADMIN_PASSWORD_HASH preferred for production)
ADMIN_PASSWORD="change_me"
# ADMIN_PASSWORD_HASH=""

# Google OAuth (admin sign-in). From Google Cloud Console > Credentials.
GOOGLE_CLIENT_ID="your_google_client_id"
GOOGLE_CLIENT_SECRET="your_google_client_secret"

# --- Optional (have built-in fallbacks) ---
# REDIS_URL="redis://localhost:6379"
# SUPABASE_URL=""
# SUPABASE_SERVICE_KEY=""
# SUPABASE_BUCKET_ID=""
# CORS_ORIGINS="https://yourdomain.com"
```

- [ ] **Step 3: Write `DEPLOYMENT.md`**

Create `DEPLOYMENT.md` with these sections (use the real env-var names from `go-server/internal/config/config.go` as the source of truth; verify each name before writing):
1. **Prerequisites** — Go 1.25, Node 20, PostgreSQL 16.
2. **Quick start** — `npm install && npm run build`, then `cd go-server && make build`, run with `STATIC_DIR=../dist/public ./bin/wedding-server`.
3. **Database** — create DB/user, run `migrations/001_init.sql` (or `make migrate` with `DATABASE_URL` set).
4. **Environment variables** — a table of every var, whether required, and what it does (cross-check `config.go`).
5. **Google OAuth setup** — create OAuth credentials, authorized redirect URI, set `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`.
6. **WhatsApp number linking** — how the `whatsmeow` session is paired (QR/login flow in `internal/service/whatsapp.go`).
7. **Optional: Supabase storage** — set the three `SUPABASE_*` vars; otherwise local storage fallback is used.
8. **WhatsApp ToS / ban-risk disclosure** — verbatim intent: *"The WhatsApp integration uses the reverse-engineered `go.mau.fi/whatsmeow` library. This violates WhatsApp's Terms of Service. Numbers used for bulk messaging risk being banned. You assume full responsibility for the status of any WhatsApp account used with this software."*

- [ ] **Step 4: Write `LICENSE`**

Create `LICENSE` (non-exclusive source license) stating:
- **Grant:** buyer may deploy, modify, and use the software commercially for their own and their clients' wedding events.
- **Restriction:** buyer may **not** resell, sublicense, or redistribute the source code (in whole or in substantial part) to third parties as a competing product or template.
- **No warranty:** software provided "as is", no warranty of title or fitness; seller not liable for damages (including WhatsApp account actions).
- **Customization:** paid consulting available separately at the rates agreed at point of sale.

- [ ] **Step 5: Verify docs no longer reference the dead stack**

Run: `grep -rni "express\|flask\|python\|replit" *.md .env.example`
Expected: no output (exit code 1). (If `CLAUDE.md` legitimately mentions these in a historical note, scope the grep to the shipped docs only.)

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "docs: consolidate setup docs into DEPLOYMENT.md, add LICENSE, fix .env.example"
```

---

## Task 7: Rename the Go module

**Files:**
- Modify: `go-server/go.mod` and all 35 `.go` files importing the old path

- [ ] **Step 1: Rewrite the module path in go.mod**

```bash
cd go-server
go mod edit -module github.com/mywedding/platform
```

- [ ] **Step 2: Rewrite all import paths**

```bash
cd go-server
grep -rl "github.com/andreasronaldo/wedding-server" --include="*.go" . | xargs sed -i '' 's|github.com/andreasronaldo/wedding-server|github.com/mywedding/platform|g'
```

- [ ] **Step 3: Verify no old path remains**

Run: `grep -rn "andreasronaldo" go-server/`
Expected: no output (exit code 1).

- [ ] **Step 4: Build and test the backend**

Run:
```bash
cd go-server && make build && make test
```
Expected: build succeeds; all tests pass (race detector enabled).

- [ ] **Step 5: Commit**

```bash
git add go-server
git commit -m "chore: rename Go module to github.com/mywedding/platform"
```

---

## Task 8: Clean project docs of personal namespaces and dangling references

These two docs ship to the buyer and still carry personal GitHub namespaces (`andreasronaldo`, `oandrz`) and — after Task 7 — an out-of-date module path. CLAUDE.md also points at `docs/agents/…`, which is excluded from the buyer snapshot, leaving dangling references. Run this task **after** Task 7 so the new module path is correct.

**Files:**
- Modify: `CLAUDE.md:45` and the "Agent skills" section (approx. lines 100-115, incl. line 111)
- Modify: `go-server/ONBOARDING.md:608`

- [ ] **Step 1: Fix the module path in CLAUDE.md**

In `CLAUDE.md:45`, replace `github.com/andreasronaldo/wedding-server` with `github.com/mywedding/platform`.

- [ ] **Step 2: Remove the seller-internal "Agent skills" section from CLAUDE.md**

Delete the entire `## Agent skills` section (the Issue tracker / Triage labels / Domain docs subsections, approx. lines 100-115). It references `github.com/oandrz/MyWedding` and `docs/agents/*` files that are excluded from the buyer snapshot, so it would be dangling and personal. If any of that guidance is useful to *you*, it already lives in `docs/agents/` in your own repo.

- [ ] **Step 3: Fix the clone URL in go-server/ONBOARDING.md**

In `go-server/ONBOARDING.md:608`, replace:
```bash
git clone git@github.com:oandrz/MyWedding.git ~/weddingAws
```
with:
```bash
git clone <your-repo-url> mywedding
```

- [ ] **Step 4: Verify no personal namespace remains in shipped docs**

Run: `grep -rni "andreasronaldo\|oandrz" CLAUDE.md go-server/ONBOARDING.md`
Expected: no output (exit code 1).

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md go-server/ONBOARDING.md
git commit -m "docs: remove personal GitHub namespaces and dangling agent-skill references"
```

---

## Task 9: Final verification gate

**Files:** none (verification only)

- [ ] **Step 1: Full personal-data / vendor sweep**

Run:
```bash
grep -rniE "andreas|christine|bank bca|1234567890|0987654321|blaze796|replit|andreasronaldo|oandrz" \
  --include="*.ts" --include="*.tsx" --include="*.go" --include="*.sql" --include="*.json" --include="*.md" \
  --include="*.sh" --include="*.yml" --include="*.yaml" --include="*.html" \
  . | grep -v node_modules | grep -v package-lock.json | grep -v "docs/superpowers" | grep -v "docs/agents" | grep -v ".remember"
```
Expected: no output. (The `docs/superpowers`/`docs/agents`/`.remember` exclusions are dev-internal files removed at snapshot time in Task 10. If any line *does* appear, it is a real leak — fix it in Step 4 before proceeding.)

- [ ] **Step 2: Frontend gates**

Run: `npm run check && npm run build`
Expected: both succeed.

- [ ] **Step 3: Backend gates**

Run: `cd go-server && make build && make test && make lint`
Expected: all succeed.

- [ ] **Step 4: Commit any incidental fixes**

If steps 1-3 surfaced a leftover reference, fix it, then:
```bash
git add -A && git commit -m "chore: final sale-readiness verification fixes"
```
If nothing needed fixing, skip this commit.

---

## Task 10: Create the per-buyer snapshot script

**Files:**
- Create: `scripts/make-release.sh` (this script lives in the SELLER's repo and is itself on the exclude-list — buyers never receive it)

- [ ] **Step 1: Write `scripts/make-release.sh`**

Create `scripts/make-release.sh`:
```bash
#!/usr/bin/env bash
set -euo pipefail

# Usage: scripts/make-release.sh <buyer-slug> [github-org]
# Produces a clean, history-free snapshot of the current working tree and pushes
# it to a fresh private GitHub repo named mywedding-<buyer-slug>.
# The seller's full history and dev tooling are NEVER included.

BUYER="${1:?Usage: make-release.sh <buyer-slug> [github-org]}"
ORG="${2:-}"
SRC="$(git rev-parse --show-toplevel)"
TMP="$(mktemp -d)"
REPO_NAME="mywedding-${BUYER}"

# Files/dirs that must never reach a buyer.
EXCLUDES=(
  ".git" "sellProposal.md" "docs/superpowers" "docs/agents"
  ".agent" ".agents" ".remember" ".idea" ".claude"
  "issues.md" "requirement" "scripts/make-release.sh"
  "hero_after_load.png" "hero_after_scroll.png" "hero_section.png"
)

echo "==> Refusing to run with a dirty tree..."
git -C "$SRC" diff --quiet && git -C "$SRC" diff --cached --quiet || {
  echo "ERROR: commit or stash changes first."; exit 1; }

echo "==> Copying working tree to $TMP (minus exclude-list and env files)..."
RSYNC_EXCLUDES=()
for e in "${EXCLUDES[@]}"; do RSYNC_EXCLUDES+=(--exclude "$e"); done
rsync -a "${RSYNC_EXCLUDES[@]}" \
  --exclude 'node_modules' --exclude 'dist' --exclude 'bin' \
  --include '.env.example' --exclude '.env' --exclude '.env.*' \
  "$SRC"/ "$TMP"/
# NOTE: rsync is first-match-wins, so '--include .env.example' MUST come
# before the '.env.*' exclude, or the example file would be dropped.

echo "==> Safety scan: fail if any real .env (besides .env.example) slipped through..."
if find "$TMP" -name '.env' -o -name '.env.*' ! -name '.env.example' | grep -q .; then
  echo "ERROR: a real .env file is present in the snapshot. Aborting."; exit 1
fi

echo "==> Initializing clean snapshot repo..."
cd "$TMP"
git init -q
git add -A
git commit -q -m "Initial release"

if command -v gh >/dev/null 2>&1; then
  echo "==> Creating private GitHub repo ${ORG:+$ORG/}$REPO_NAME and pushing..."
  gh repo create "${ORG:+$ORG/}$REPO_NAME" --private --source=. --push
  echo "==> Done. Grant the buyer collaborator access on ${ORG:+$ORG/}$REPO_NAME."
else
  echo "==> gh CLI not found. Snapshot ready at: $TMP"
  echo "    Create a private repo manually and push from there."
fi
```

- [ ] **Step 2: Make it executable and dry-check the exclude logic**

Run:
```bash
chmod +x scripts/make-release.sh
git add scripts/make-release.sh
```

- [ ] **Step 3: Add seller-internal artifacts to .gitignore (so they stay out of accidental commits)**

Append to `.gitignore`:
```
# Seller-internal — never ship to buyers
sellProposal.md
.agent/
.agents/
.remember/
```

- [ ] **Step 4: Commit**

```bash
git add scripts/make-release.sh .gitignore
git commit -m "chore: add per-buyer snapshot release script"
```

- [ ] **Step 5: First real release (manual, when a sale happens)**

When a buyer pays, run:
```bash
scripts/make-release.sh <buyer-slug> <your-github-org>
```
Then verify the new repo on GitHub: confirm it has exactly one commit, no `sellProposal.md`, no `docs/superpowers`, no `.env` (only `.env.example`), and that `npm install && npm run build` and `cd go-server && make build` succeed from a fresh clone.

---

## Self-Review Notes

- **Spec coverage:** WP1 (personal data)→Tasks 1-4 + index.html in Task 2 + docs in Task 8; WP2 (Replit)→Task 5; WP3 (docs/license)→Task 6; WP4 (module rename)→Task 7; WP5 (dev-internal exclude-list)→Task 10 (exclude-list lives in `make-release.sh`); WP6 (snapshot)→Task 10; WP7 (verification gate)→Task 9. All work packages mapped.
- **Sequencing:** Working-tree mutations (Tasks 1-8) precede the verification gate (Task 9), which precedes snapshot generation (Task 10) — matching the spec's ordering requirement. Task 8 (doc namespace cleanup) runs after Task 7 so it can reference the renamed module path.
- **Note on `egift_*_account` migration values:** groom and bride now share `0000000000` by design (generic placeholder); this is intentional, not a copy error.
- **`docs/agents` / `docs/superpowers`:** intentionally NOT deleted from the seller repo — they are excluded at snapshot time so the seller keeps them. This is why Task 8's grep excludes those paths.
