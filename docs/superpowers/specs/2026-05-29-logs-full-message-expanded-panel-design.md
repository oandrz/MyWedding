# Logs viewer: show full message in expanded panel

**Date:** 2026-05-29
**Status:** Approved

## Problem

In the admin Logs viewer (`client/src/pages/admin/LogsPage.tsx`), the message
column truncates long text with `truncate max-w-[320px]` (around line 201). When
a row is clicked to expand, the detail panel shows method, path, duration,
requestId, and the `attrs` JSON — but it never renders the message itself.

As a result, when a message is wider than the column it is truncated in the row
**and** unavailable in the expanded panel, leaving the user with no way to read
the full text.

## Goal

Make the complete log message readable on demand, without cluttering the table.

## Approach

Reuse the existing row-expansion interaction. Keep the table row truncated as-is,
and add a full-width **Message** block to the expanded detail panel that renders
the complete, untruncated message.

This was chosen over wrapping text directly in the row (denser, busier table,
variable row heights) and over a hover tooltip (awkward for very long messages,
not touch-friendly).

## Changes

Frontend only — `client/src/pages/admin/LogsPage.tsx`:

- Inside the expanded `<tr>` / `<td colSpan={5}>`, add a full-width **Message**
  block **above** the existing `<dl>` metadata grid, so the panel reads
  top-to-bottom: full message → metadata → attrs JSON.
- Render the message with `whitespace-pre-wrap break-words` so long lines wrap
  within the panel width and any newlines in the message are preserved.
- Leave the table row's message cell unchanged (still `truncate max-w-[320px]`).

No backend change: the full `message` field is already present in the
`GET /api/admin/logs` response and in the table's log data. This is purely a
render gap in the expanded panel.

## Testing

Extend `client/src/pages/admin/__tests__/LogsPage.test.tsx`:

- Render a log whose `message` is longer than the truncation width.
- Click the row to expand it.
- Assert the full, untruncated message text appears in the expanded panel.

## Out of scope

- Backend/API changes.
- Changes to the truncated row rendering (tooltip, wrapping in-row).
- Copy-to-clipboard or other message-level actions.
