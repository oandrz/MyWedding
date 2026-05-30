# MyWedding Sale-Readiness Cleanup — Design Spec

**Date:** 2026-05-30
**Status:** Approved design, pending implementation plan
**Purpose:** Prepare the MyWedding codebase for non-exclusive source-code sale (see `sellProposal.md`) by removing personal data, vendor residue, and stale documentation, and by defining a repeatable buyer-delivery process.

---

## Goal

Make the repository safe and presentable to sell as a white-label wedding e-invitation template. A buyer must receive a clean, generic, build-passing snapshot with no personal identity, no committed secrets, no dead-stack documentation, and no internal development artifacts — while the seller's own working repository (full history, dev tooling) stays private and intact.

## Locked Decisions

| Decision | Choice |
|---|---|
| Delivery mechanism | Fresh-init snapshot generated from the cleaned working tree (no history rewrite of the dev repo) |
| Buyer repo model | **Fresh private repo per buyer** (individual access, individually revocable) |
| White-label depth | **Generic demo couple** — placeholder names `James & Olivia`, neutral story, `Example Bank` / account `0000000000` |
| Theme color | **Preserve** the rose primary `hsl(0, 41%, 76%)` (already present in `client/src/index.css`) |
| Go module rename | **In scope** — `github.com/andreasronaldo/wedding-server` → `github.com/mywedding/platform` |
| README screenshots + demo video | **Deferred** (separate marketing work, needs a running app) |

## Why the proposal's checklist is insufficient (rationale)

The proposal's `Pre-Sale Cleanup Checklist` only scrubs the working tree. But the distribution plan ("GitHub repo, buyers get preview access") means **git history and dev-internal files would ship too**. Three categories are structurally missed:

1. **Git history** — every old commit contains the couple's real names; `go-server/.env.production` was committed (commits `054da85`, `3d2b095`); `docs/superpowers/plans/` documents the AI-generation process. → Resolved by the fresh-init snapshot (clean by construction).
2. **`sellProposal.md` itself** — states price/margin, admits copyright ambiguity and a WhatsApp-ToS violation. Must never reach a buyer.
3. **Personal data is far wider** than the single migration file the proposal lists — it spans locales, schema defaults, components, and admin placeholders.

---

## Work Packages

Sequenced so the working tree is fully cleaned and verified (WP1–WP5, WP7) **before** the snapshot is taken (WP6).

### WP1 — Personal data → generic demo couple

Replace all real personal content with the `James & Olivia` demo couple.

- `client/src/locales/en.ts` and `client/src/locales/id.ts` — rewrite `ourStoryParagraph1`, `ourStoryParagraph2`, `ourStoryParagraph3` (the real recruiter/candidate story) with a neutral generic narrative in both languages.
- `shared/schema.ts` (~line 111) — default `headingText`.
- `go-server/migrations/001_init.sql` (lines ~62, 91–101) — `heading_text` default, `egift_groom_name` (`Andreas`→`James`), `egift_bride_name` (`Christine`→`Olivia`), `egift_groom_bank`/`egift_bride_bank` (`Bank BCA`→`Example Bank`), `egift_groom_account`/`egift_bride_account` (`1234567890`→`0000000000`), and the seeded `welcome_screen` heading row.
- `client/src/components/EGiftSection.tsx` — `getSettingValue` defaults (`Andreas`/`Christine`).
- `client/src/pages/admin/ConfigPage.tsx`, `WelcomePage.tsx`, `AdminLayout.tsx` — placeholder strings and the "Andreas & Christine's Wedding Dashboard" label.
- `client/index.html` — the page `<title>` contains the couple's **full legal name** ("Andreas & Christine Natasya Serena Wedding Invitation"); highest-visibility leak.
- `CLAUDE.md` (module path + personal `oandrz` namespace in the Agent-skills section) and `go-server/ONBOARDING.md` (personal clone URL) — clean after the module rename.
- Update affected tests that assert on `Andreas`/`Christine` (`ConfigPage.test.tsx`) to the new defaults.

**Exit check:** `grep -rni "andreas\|christine"` (excluding the Go module path) returns zero matches in shipped files.

### WP2 — Replit removal (single coupled task)

- Remove `@replit/vite-plugin-shadcn-theme-json` and `@replit/vite-plugin-runtime-error-modal` from `package.json` (and `package-lock.json` via `npm install`).
- Edit `vite.config.ts` — remove both `import` lines and their entries in the `plugins` array (`runtimeErrorOverlay()`, `themePlugin()`).
- Delete `theme.json`. The rose primary already lives in `client/src/index.css:21` (`--primary: 0 41% 76%`), so runtime appearance is preserved without further work — confirm visually.
- Delete `.replit` (contains hardcoded `replit-objstore-30de2592-...` bucket ID), `replit.nix`, and `generated-icon.png` (Replit-generated 1.4 MB icon).

**Exit check:** `npm run build` succeeds; `grep -ri replit` over shipped files is clean.

### WP3 — Documentation: consolidate and write buyer-facing docs

- **Delete** the stale-stack setup docs and scripts (all reference Replit secrets / Python / Flask / Express, which no longer exist): `DOCKER_SETUP.md`, `LOCAL_DEVELOPMENT_SETUP.md`, `OAUTH_SETUP_GUIDE.md`, `COLIMA_SETUP.md`, `SHARED_DRIVE_SETUP.md`, `setup-local.sh` (installs flask/pydantic), `test-wedding-platform.sh` (curls an "Express Server").
- Fix root `.env.example` — remove `EXPRESS_PORT` / `FLASK_PORT` and any Replit references; align variables to the Go server's real config.
- **Write `DEPLOYMENT.md`** covering: PostgreSQL setup, full environment-variable reference, Google OAuth credential setup, WhatsApp number linking, Supabase storage (optional, has fallback), and an explicit **WhatsApp ToS / ban-risk disclosure**.
- **Write `LICENSE`** (non-exclusive source license): buyer may deploy, modify, and use commercially; may **not** resell or redistribute the source; states the paid-customization/consulting terms.

**Exit check:** no doc references Replit/Python/Flask/Express; `DEPLOYMENT.md` and `LICENSE` exist and are complete (no TBD).

### WP4 — Go module rename

- Rename `github.com/andreasronaldo/wedding-server` → `github.com/mywedding/platform` in `go-server/go.mod` and all import paths (confirmed: 35 files).
- Mechanical find/replace; no logic changes.

**Exit check:** `cd go-server && make build && make test` pass.

### WP5 — Dev-internal artifacts (snapshot exclude-list)

These remain in the seller's working repo but are **excluded from every buyer snapshot**. This is the safety net if a manual step is missed:

```
sellProposal.md
docs/superpowers/
docs/agents/        # seller-internal agent/issue-tracker docs — exclude
.agent  .agents  .remember  .idea  .claude
issues.md
requirement/
hero_after_load.png  hero_after_scroll.png  hero_section.png
.git                # never copy the source repo's history
```

### WP6 — Snapshot generation (`make-release.sh`)

A documented, repeatable script that produces one buyer's repo. Takes a buyer slug as argument.

Steps the script performs:
1. Verify the working tree is clean and on the intended release branch/tag.
2. Copy the working tree into a throwaway temp dir, **minus** the WP5 exclude-list.
3. Confirm `.gitignore` covers all `.env*` files; ensure no `.env*` (other than `.env.example`) is present in the copy.
4. `git init` in the temp dir → single commit `Initial release`.
5. Create a fresh private GitHub repo named per the buyer slug; push the single commit; grant that buyer access.
6. Delete the temp dir.

Because each sale runs this fresh, buyers are isolated and access is individually revocable; the seller's history never leaves the private repo.

### WP7 — Final verification gate

Run before generating any snapshot:

- Full-tree grep sweep: `andreas`, `christine` (excl. module path is now gone), `replit`, `1234567890`, `Bank BCA`, `blaze796`, `andreasronaldo` → all zero in shipped files.
- `npm run build` and `npm run check` (frontend).
- `cd go-server && make build && make test && make lint`.

---

## Out of Scope

- README with screenshots, 30-second WhatsApp-blast demo video (deferred marketing assets).
- Operational credential rotation on the seller's live AWS deployment (security hygiene, not a sale blocker — but recommended if any value in the historical `.env.production` was ever real).
- Any feature changes; this is cleanup only.

## Risks / Notes

- **WP1 completeness** is the main risk — personal phrasing can hide in prose. The WP7 grep sweep is the backstop; run it before every snapshot, not just once.
- **WP2 coupling** is low-risk because the theme color is already in CSS; the only required verification is a successful `npm run build`.
- **WP4** touches 35 files but is purely mechanical; the test suite is the guardrail.
