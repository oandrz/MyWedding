# Keyboard-Driven Single-Action Send Flow — Design Spec

**Date:** 2026-04-09
**Status:** Approved
**Scope:** Frontend-only changes to Send All dialog

## Overview

Optimize the existing "Send All" WhatsApp dialog to reduce per-invite actions from 5 to 2. Merge "Open WhatsApp" and "Mark Sent & Next" into a single action, add keyboard shortcuts, and provide single-level undo.

## Goals

- Reduce manual actions per invite from 5 (open link → switch tab → send → switch back → mark sent) to 2 (press Enter → send in WhatsApp)
- Add keyboard shortcuts for the entire send flow
- Add undo capability for accidental mark-as-sent

## Non-Goals

- Auto-paced timer mode (can be added later)
- Server-side changes or new API endpoints
- WhatsApp Business API or whatsmeow integration
- Changes to the message template editor or invite table

---

## 1. File Changed

**Single file:** `client/src/pages/admin/InvitesPage.tsx`

No backend changes. No new package dependencies. Add `Undo2` to the existing `lucide-react` import.

## 2. Dialog Button Changes

### Primary Button: "Send & Next"

Replaces the current "Open WhatsApp" button. On activation:

1. Opens `wa.me` deep link via `window.open(url, "_blank")`
2. Calls `PUT /api/admin/invites/{id}/wa-sent` (existing `markWaSentMutation`)
3. Stores the invite ID as `lastSentInviteId` (for undo)
4. Advances to next invite (`sendAllIndex + 1`)
5. If this was the last invite, advance `sendAllIndex` past the list length so the in-dialog completion summary renders (do NOT close the dialog — keep it open so undo remains available)

Visual: Green button with Send icon, label "Send & Next". Auto-focused when the dialog opens and when `currentSendInvite` changes (so `Enter` naturally activates it).

### Removed: "Mark Sent & Next" Button

This is now merged into the primary "Send & Next" button. The separate "Mark Sent & Next" outline button is removed.

### Added: "Undo" Button

- Ghost button, appears only when `lastSentInviteId` is set (i.e., after at least one send)
- Label: "Undo" with `Undo2` icon from lucide-react
- On click: calls `DELETE /api/admin/invites/{lastSentInviteId}/wa-sent` (existing `unmarkWaSentMutation`)
- Disabled while `unmarkWaSentMutation.isPending` to prevent double-clicks
- Decrements `sendAllSentCount` by 1 (floored at 0: `Math.max(0, c - 1)`)
- Clears `lastSentInviteId` (single-level undo — can't undo twice in a row)
- Does NOT rewind `sendAllIndex` — the dialog stays on the current invite

### Kept: "Skip" and "Pause" Buttons

Unchanged behavior. "Skip" advances without marking sent (if last invite, advances past list length to show in-dialog completion summary — same as "Send & Next"). "Pause" closes the dialog.

## 3. Keyboard Shortcuts

Implemented via a `useEffect` with a `keydown` event listener, active only when `sendAllOpen === true`.

| Key | Action | Guard |
|-----|--------|-------|
| `Enter` | Trigger "Send & Next" | Disabled while `markWaSentMutation.isPending` |
| `S` | Trigger "Skip" | Disabled while mutation pending |
| `Escape` | Close dialog (pause) | Handled by Radix Dialog already |

### Implementation Details

- Listener added on mount of dialog open state, removed on close
- All key handlers check `markWaSentMutation.isPending` to prevent double-triggers
- `Enter` handler calls `e.preventDefault()` to avoid triggering focused button clicks. As a complementary measure, the "Send & Next" button receives `autoFocus` so `Enter` via native button activation does the right thing.
- `S` key only fires when no editable element is focused. Guard via tagName and contentEditable check:
  ```typescript
  const tag = (e.target as HTMLElement).tagName;
  const isEditable = (e.target as HTMLElement).isContentEditable;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || isEditable) return;
  ```

### Keyboard Hints

Small muted text displayed below the action buttons:

```
Enter to send · S to skip · Esc to pause
```

Styled as `text-xs text-muted-foreground text-center`.

## 4. State Changes

### New State

```typescript
const [lastSentInviteId, setLastSentInviteId] = useState<number | null>(null);
```

Reset to `null` when `sendAllOpen` changes to `true`.

### Modified: `handleSendAllMarkSent` → `handleSendAndNext`

Renamed to reflect the merged behavior. New logic:

```
1. Open wa.me link (window.open)
2. Set lastSentInviteId = currentSendInvite.id
3. Call markWaSentMutation.mutate(currentSendInvite.id)
4. On success: increment sentCount, advance index (if last invite, advance past list length to show in-dialog completion summary)
```

### New: `handleUndo`

```
1. If lastSentInviteId is null, no-op
2. Call unmarkWaSentMutation.mutate(lastSentInviteId)
3. On success: decrement sendAllSentCount (floored at 0), clear lastSentInviteId
```

## 5. Updated Dialog Layout

```
┌─────────────────────────────────────┐
│ 💬 Send WhatsApp Messages           │
│ Step through unsent invites          │
│                                      │
│ [====-----] 3 of 12                  │
│            Sent: 2  Skipped: 1       │
│                                      │
│ ┌──────────────────────────────┐     │
│ │ Guest Name           CODE123 │     │
│ │ +6281234567890               │     │
│ └──────────────────────────────┘     │
│                                      │
│ ┌─ Message preview ──────────┐       │
│ │ Hi Guest, you're invited...│       │
│ └────────────────────────────┘       │
│                                      │
│ [████ Send & Next ████]              │
│                                      │
│ [Undo]    [Skip]    [Pause]          │
│                                      │
│   Enter to send · S to skip ·        │
│          Esc to pause                │
└─────────────────────────────────────┘
```

## 6. Edge Cases

| Case | Behavior |
|------|----------|
| Popup blocked by browser | `window.open` returns `null` — show toast warning "Popup blocked, please allow popups" but still mark sent and advance (user can undo if needed) |
| Mutation fails | Toast error, do NOT advance — user can retry with Enter |
| Undo after last invite | Works — unmarks the sent status even after completion summary shown |
| Rapid Enter presses | Guarded by `isPending` check — second press is no-op |
| Dialog reopened mid-session | `lastSentInviteId` reset to null, unsent list recalculated from current data |

## 7. Testing

Frontend only — no new backend tests needed.

- Keyboard shortcut `Enter` triggers send-and-next when dialog is open
- Keyboard shortcut `S` triggers skip
- `Enter` is no-op when mutation is pending
- `S` is no-op when an input element is focused
- Undo button appears after first send, disappears after undo
- Undo calls unmark mutation and decrements sent count
- "Send & Next" opens wa.me link and advances to next invite
- Completion summary shows correct sent/skipped counts
