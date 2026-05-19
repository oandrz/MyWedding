# Guest Inline Edit (Name + Phone)

**Date:** 2026-05-20  
**Status:** Approved

## Summary

Add a pencil (✏️) icon button to each guest card in the Invites admin page. Clicking it puts the card into inline edit mode where the guest's name and phone number can both be edited simultaneously. This replaces the existing click-on-phone shortcut for phone-only editing.

## UX Design

### View Mode

Each guest card shows:
- Guest name (bold heading)
- Invite code + copy button
- Phone number (static, no longer clickable to edit)
- WhatsApp send button (when phone is set)
- WA Sent / RSVP status badges
- **New: pencil icon button** alongside the existing delete button

### Edit Mode (after clicking ✏️)

- Card border changes to purple (`border-indigo-500`) to signal edit mode
- Name heading becomes a focused text input (seeded with current name)
- Phone display becomes a text input (seeded with current phone, or empty)
- Status badges remain visible but faded (opacity reduced)
- Save (✓) and Cancel (✕) icon buttons appear below the phone input
- Keyboard: **Enter** saves, **Esc** cancels

### Behaviour

- Only one card can be in edit mode at a time (same pattern as current phone edit)
- Save is disabled while the mutation is pending (shows spinner on ✓ button)
- On error: card stays in edit mode with the user's values intact so they can correct and retry
- On success: card returns to view mode with updated values

## Frontend Changes (`client/src/pages/admin/InvitesPage.tsx`)

### State

Replace the existing phone-only edit state:
```ts
// Remove:
const [editingPhoneId, setEditingPhoneId] = useState<number | null>(null);
const [editPhoneValue, setEditPhoneValue] = useState("");

// Add:
const [editingId, setEditingId] = useState<number | null>(null);
const [editNameValue, setEditNameValue] = useState("");
const [editPhoneValue, setEditPhoneValue] = useState("");
```

### Mutation

Extend `updateInviteMutation` to send both `name` and `phone`:
```ts
mutationFn: async ({ id, name, phone }: { id: number; name: string; phone: string | null }) => {
  const response = await apiRequest("PATCH", `/api/admin/invites/${id}`, { name, phone });
  return response.json();
},
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ["/api/admin/invites"] });
  setEditingId(null);
},
```

### Save handler

Replace `handlePhoneEditSave` with a unified `handleEditSave(inviteId)`:
- Trim name; if empty, show toast and return (don't save)
- Trim phone; if non-empty, normalize and validate E.164; if invalid, show toast and return
- Call `updateInviteMutation.mutate({ id: inviteId, name, phone: normalizedPhone ?? null })`

### Card render changes

- Remove the `<button onClick={() => setEditingPhoneId(...)} >` phone click-to-edit
- Add pencil icon button: `<Button variant="ghost" size="sm" onClick={() => { setEditingId(invite.id); setEditNameValue(invite.name); setEditPhoneValue(invite.phone ?? ""); }}>`
- In edit mode, replace name `<h3>` with `<Input>` and phone display with `<Input>`, plus Save/Cancel buttons
- Import `Pencil` from `lucide-react`

## Backend Changes (`go-server/`)

### Repository interface (`internal/repository/repository.go`)

Add alongside `UpdateInvitePhone`:
```go
UpdateInvite(ctx context.Context, id int, name string, phone *string) (*models.Invite, error)
```

### Memory repository (`internal/repository/memory.go`)

Implement `UpdateInvite`: find invite by id, set `Name` and `Phone`, return updated invite or "not found" error.

### Postgres repository (`internal/repository/postgres.go`)

Implement `UpdateInvite` with:
```sql
UPDATE invites SET name=$2, phone=$3 WHERE id=$1
RETURNING id, name, code, rsvp_id, phone, wa_sent_at, created_at
```

### Handler (`internal/handler/invite.go`)

Extend `Update` to read `name` from the `json.RawMessage` map:
- If `name` is present: `phone` must also be present (return 400 otherwise); validate name non-empty after trim; call `repo.UpdateInvite(id, name, phone)`
- If `name` is absent and `phone` is present: fall back to existing `repo.UpdateInvitePhone(id, phone)` (backward compat for direct API callers)
- If neither is present: return 400 "No updatable fields provided" (existing behaviour)
- Name validation: 400 if empty string after trim

## Validation

| Field | Frontend | Backend |
|-------|----------|---------|
| Name  | Disable Save if blank after trim; show toast | 400 if empty string after trim |
| Phone | Show invalid-phone toast if not E.164 | 400 with existing NormalizePhone error message |

## Testing

### Backend (`go-server/internal/handler/`)

Add table-driven tests for the extended `Update` handler:
- Name + phone update → 200, both fields updated
- Name + null phone update → 200, name updated and phone cleared
- Name present but phone absent → 400
- Phone only (no name field in body) → 200, phone updated via backward compat path
- Empty name → 400
- Invalid phone → 400
- Unknown invite ID → 404

### Frontend

Remove any tests that specifically target the phone click-to-edit interaction. No new frontend tests required for this change beyond what already exists.
