# Gallery Disable Music Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the `/gallery` route, prevent background music from playing and hide the floating music button.

**Architecture:** The global `AudioPlayer` component already unmounts itself on admin routes via an early `return null` guard. Extend that same guard to also fire on `/gallery`. Unmounting the `<audio>` element stops any playing music, hides the button, and makes `startAutoplay()` a safe no-op — all with one condition.

**Tech Stack:** React 18 + TypeScript, Wouter (`useLocation`), Vite.

## Global Constraints

- Scope is the literal `/gallery` path only. `/memories` (which also renders the `Gallery` component) must be unaffected.
- Do not change music behavior on any other route (home, etc.).

---

### Task 1: Guard the global AudioPlayer on the /gallery route

**Files:**
- Modify: `client/src/components/AudioPlayer.tsx`

**Interfaces:**
- Consumes: `location` from the existing `useLocation()` hook (`AudioPlayer.tsx:16`), and the existing `isAdminPage` early-return guard (`AudioPlayer.tsx:18,67`).
- Produces: nothing consumed by other tasks (leaf change).

- [ ] **Step 1: Add the `isGalleryPage` derivation**

In `client/src/components/AudioPlayer.tsx`, directly below the existing line 18
(`const isAdminPage = location.includes('/admin');`), add:

```ts
const isGalleryPage = location === '/gallery';
```

- [ ] **Step 2: Include it in the early-return guard**

Change the existing guard (currently at `AudioPlayer.tsx:67`):

```ts
if (isAdminPage || !isMusicEnabled) {
  return null;
}
```

to:

```ts
if (isAdminPage || isGalleryPage || !isMusicEnabled) {
  return null;
}
```

- [ ] **Step 3: Type-check**

Run: `npm run check`
Expected: PASS (no TypeScript errors).

- [ ] **Step 4: Manual verification**

Start dev (`npm run dev` + Go server per CLAUDE.md), ensure the music feature
flag is enabled, then:

1. On `/` (home): start music with the floating button — music plays.
2. Navigate to `/gallery`: music stops, no floating button is visible.
3. Navigate back to `/`: the button reappears in the paused ("Play Music")
   state; music does not auto-resume.
4. Direct-load `/gallery` and dismiss the welcome overlay if shown: no music
   starts, no button appears.
5. Confirm `/memories` is unchanged: the music button is still present there.

Expected: all five observations hold.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/AudioPlayer.tsx
git commit -m "feat(gallery): disable autoplay and hide music button on /gallery

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```
