# Guest Inline Edit (Name + Phone) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a pencil-icon Edit button to each guest card that puts the card into inline edit mode for both name and phone, replacing the existing click-on-phone shortcut.

**Architecture:** Backend extends the existing `PATCH /api/admin/invites/{id}` handler to accept a `name` field alongside `phone`, and adds a new `UpdateInvite` repository method. Frontend replaces the `editingPhoneId` inline-phone state with a unified `editingId` state that shows both name and phone inputs simultaneously.

**Tech Stack:** Go (Chi, pgx), React 18, TypeScript, TanStack Query, Shadcn/Radix UI, Lucide React

---

## File Map

| File | Change |
|------|--------|
| `go-server/internal/repository/repository.go` | Add `UpdateInvite` to interface |
| `go-server/internal/repository/memory.go` | Implement `UpdateInvite` |
| `go-server/internal/repository/postgres.go` | Implement `UpdateInvite` |
| `go-server/internal/handler/invite_test.go` | Add tests for name+phone update cases |
| `go-server/internal/handler/invite.go` | Extend `Update` handler to handle `name` |
| `client/src/pages/admin/InvitesPage.tsx` | Replace phone edit state with unified edit state + pencil button |

---

## Task 1: Add `UpdateInvite` to repository interface and memory implementation

**Files:**
- Modify: `go-server/internal/repository/repository.go:72-74`
- Modify: `go-server/internal/repository/memory.go` (after line 842)

- [ ] **Step 1: Add `UpdateInvite` to the repository interface**

Open `go-server/internal/repository/repository.go`. Find the block containing `UpdateInvitePhone` (around line 74). Add the new method directly after it:

```go
UpdateInvitePhone(ctx context.Context, id int, phone *string) (*models.Invite, error)
UpdateInvite(ctx context.Context, id int, name string, phone *string) (*models.Invite, error)
```

- [ ] **Step 2: Implement `UpdateInvite` in the memory repository**

Open `go-server/internal/repository/memory.go`. After the `UpdateInvitePhone` method (after line 842), add:

```go
func (m *MemoryRepository) UpdateInvite(_ context.Context, id int, name string, phone *string) (*models.Invite, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	inv, ok := m.invites[id]
	if !ok {
		return nil, fmt.Errorf("invite not found")
	}
	inv.Name = name
	inv.Phone = phone
	m.invites[id] = inv
	return &inv, nil
}
```

- [ ] **Step 3: Verify it compiles**

```bash
cd go-server && go build ./...
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add go-server/internal/repository/repository.go go-server/internal/repository/memory.go
git commit -m "feat: add UpdateInvite to repository interface and memory impl"
```

---

## Task 2: Write failing handler tests for name+phone update

**Files:**
- Modify: `go-server/internal/handler/invite_test.go` (append after existing Update tests, around line 445)

- [ ] **Step 1: Add tests for name+phone update cases**

Open `go-server/internal/handler/invite_test.go`. Append these tests after the existing `TestInvite_Update_*` tests:

```go
func TestInvite_Update_NameAndPhone(t *testing.T) {
	env := newTestEnv()
	cookie, csrf := adminLogin(t, env)

	body := jsonBody(map[string]interface{}{"name": "Alice"})
	req := adminRequest(http.MethodPost, "/api/admin/invites", body, cookie, csrf)
	createResult := contractResponse(t, env, req, http.StatusCreated)
	inviteID := int(createResult["invite"].(map[string]interface{})["id"].(float64))

	updateBody := jsonBody(map[string]interface{}{"name": "Alice Updated", "phone": "+6281234567890"})
	req2 := adminRequest(http.MethodPatch, fmt.Sprintf("/api/admin/invites/%d", inviteID), updateBody, cookie, csrf)
	result := contractResponse(t, env, req2, http.StatusOK)

	invite := result["invite"].(map[string]interface{})
	if invite["name"] != "Alice Updated" {
		t.Fatalf("expected name=Alice Updated, got %v", invite["name"])
	}
	if invite["phone"] != "+6281234567890" {
		t.Fatalf("expected phone=+6281234567890, got %v", invite["phone"])
	}
}

func TestInvite_Update_NameAndClearPhone(t *testing.T) {
	env := newTestEnv()
	cookie, csrf := adminLogin(t, env)

	body := jsonBody(map[string]interface{}{"name": "Alice", "phone": "+6281234567890"})
	req := adminRequest(http.MethodPost, "/api/admin/invites", body, cookie, csrf)
	createResult := contractResponse(t, env, req, http.StatusCreated)
	inviteID := int(createResult["invite"].(map[string]interface{})["id"].(float64))

	updateBody := jsonBody(map[string]interface{}{"name": "Alice Renamed", "phone": nil})
	req2 := adminRequest(http.MethodPatch, fmt.Sprintf("/api/admin/invites/%d", inviteID), updateBody, cookie, csrf)
	result := contractResponse(t, env, req2, http.StatusOK)

	invite := result["invite"].(map[string]interface{})
	if invite["name"] != "Alice Renamed" {
		t.Fatalf("expected name=Alice Renamed, got %v", invite["name"])
	}
	if _, hasPhone := invite["phone"]; hasPhone {
		t.Fatalf("expected phone to be omitted (nil), got %v", invite["phone"])
	}
}

func TestInvite_Update_NameWithoutPhone_Returns400(t *testing.T) {
	env := newTestEnv()
	cookie, csrf := adminLogin(t, env)

	body := jsonBody(map[string]interface{}{"name": "Alice"})
	req := adminRequest(http.MethodPost, "/api/admin/invites", body, cookie, csrf)
	createResult := contractResponse(t, env, req, http.StatusCreated)
	inviteID := int(createResult["invite"].(map[string]interface{})["id"].(float64))

	// name present, phone absent — must return 400
	updateBody := jsonBody(map[string]interface{}{"name": "Alice Updated"})
	req2 := adminRequest(http.MethodPatch, fmt.Sprintf("/api/admin/invites/%d", inviteID), updateBody, cookie, csrf)
	contractResponse(t, env, req2, http.StatusBadRequest)
}

func TestInvite_Update_EmptyName_Returns400(t *testing.T) {
	env := newTestEnv()
	cookie, csrf := adminLogin(t, env)

	body := jsonBody(map[string]interface{}{"name": "Alice"})
	req := adminRequest(http.MethodPost, "/api/admin/invites", body, cookie, csrf)
	createResult := contractResponse(t, env, req, http.StatusCreated)
	inviteID := int(createResult["invite"].(map[string]interface{})["id"].(float64))

	updateBody := jsonBody(map[string]interface{}{"name": "", "phone": nil})
	req2 := adminRequest(http.MethodPatch, fmt.Sprintf("/api/admin/invites/%d", inviteID), updateBody, cookie, csrf)
	contractResponse(t, env, req2, http.StatusBadRequest)
}

func TestInvite_Update_WhitespaceName_Returns400(t *testing.T) {
	env := newTestEnv()
	cookie, csrf := adminLogin(t, env)

	body := jsonBody(map[string]interface{}{"name": "Alice"})
	req := adminRequest(http.MethodPost, "/api/admin/invites", body, cookie, csrf)
	createResult := contractResponse(t, env, req, http.StatusCreated)
	inviteID := int(createResult["invite"].(map[string]interface{})["id"].(float64))

	updateBody := jsonBody(map[string]interface{}{"name": "   ", "phone": nil})
	req2 := adminRequest(http.MethodPatch, fmt.Sprintf("/api/admin/invites/%d", inviteID), updateBody, cookie, csrf)
	contractResponse(t, env, req2, http.StatusBadRequest)
}
```

- [ ] **Step 2: Run new tests and verify they fail**

```bash
cd go-server && go test ./internal/handler -run "TestInvite_Update_Name" -v -race -count=1
```

Expected: tests fail (the handler doesn't support `name` yet).

- [ ] **Step 3: Commit the failing tests**

```bash
git add go-server/internal/handler/invite_test.go
git commit -m "test: add failing tests for name+phone update handler"
```

---

## Task 3: Extend the `Update` handler to support `name`

**Files:**
- Modify: `go-server/internal/handler/invite.go:211-265`

- [ ] **Step 1: Replace the `Update` handler body**

Open `go-server/internal/handler/invite.go`. Replace the entire `Update` function body (lines 211–265) with the following. Keep the function signature unchanged:

```go
// Update handles PATCH /api/admin/invites/{id}.
// Partial update — uses json.RawMessage to distinguish between "phone": null (clear) and absent phone.
// When "name" is present, "phone" must also be present; both are updated via UpdateInvite.
// When only "phone" is present, UpdateInvitePhone is used (backward compat).
func (h *InviteHandler) Update(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		writeError(w, r, http.StatusBadRequest, "Invalid invite ID")
		return
	}

	var raw map[string]json.RawMessage
	if err := parseJSON(r, &raw); err != nil {
		writeError(w, r, http.StatusBadRequest, "Invalid request body")
		return
	}

	nameRaw, namePresent := raw["name"]
	phoneRaw, phonePresent := raw["phone"]

	if !namePresent && !phonePresent {
		writeError(w, r, http.StatusBadRequest, "No updatable fields provided")
		return
	}

	// Parse phone (shared by both paths).
	var phone *string
	if phonePresent {
		if string(phoneRaw) == "null" {
			phone = nil
		} else {
			var phoneVal string
			if err := json.Unmarshal(phoneRaw, &phoneVal); err != nil {
				writeError(w, r, http.StatusBadRequest, "Invalid phone value")
				return
			}
			if phoneVal != "" {
				normalized, err := models.NormalizePhone(phoneVal)
				if err != nil {
					writeError(w, r, http.StatusBadRequest, fmt.Sprintf("Invalid phone: %s", err.Error()))
					return
				}
				phone = &normalized
			}
		}
	}

	if namePresent {
		if !phonePresent {
			writeError(w, r, http.StatusBadRequest, "phone is required when name is provided")
			return
		}
		var nameVal string
		if err := json.Unmarshal(nameRaw, &nameVal); err != nil {
			writeError(w, r, http.StatusBadRequest, "Invalid name value")
			return
		}
		nameVal = strings.TrimSpace(nameVal)
		if nameVal == "" {
			writeError(w, r, http.StatusBadRequest, "name cannot be empty")
			return
		}
		invite, err := h.Repo.UpdateInvite(r.Context(), id, nameVal, phone)
		if err != nil {
			if strings.Contains(err.Error(), "not found") {
				writeError(w, r, http.StatusNotFound, "Invite not found")
				return
			}
			writeError(w, r, http.StatusInternalServerError, "Failed to update invite")
			return
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"invite": invite})
		return
	}

	// Backward compat: phone-only update.
	invite, err := h.Repo.UpdateInvitePhone(r.Context(), id, phone)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			writeError(w, r, http.StatusNotFound, "Invite not found")
			return
		}
		writeError(w, r, http.StatusInternalServerError, "Failed to update invite")
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"invite": invite})
}
```

- [ ] **Step 2: Run all Update handler tests**

```bash
cd go-server && go test ./internal/handler -run "TestInvite_Update" -v -race -count=1
```

Expected: all pass (new tests + existing phone-only tests).

- [ ] **Step 3: Run the full test suite**

```bash
cd go-server && make test
```

Expected: all tests pass, no race conditions.

- [ ] **Step 4: Commit**

```bash
git add go-server/internal/handler/invite.go
git commit -m "feat: extend Update handler to support name+phone update"
```

---

## Task 4: Implement `UpdateInvite` in the postgres repository

**Files:**
- Modify: `go-server/internal/repository/postgres.go` (after `UpdateInvitePhone`, around line 1023)

- [ ] **Step 1: Add the postgres implementation**

Open `go-server/internal/repository/postgres.go`. After the closing brace of `UpdateInvitePhone` (around line 1023), add:

```go
func (r *PostgresRepository) UpdateInvite(ctx context.Context, id int, name string, phone *string) (*models.Invite, error) {
	var inv models.Invite
	var createdAt time.Time
	var waSentAt *time.Time
	err := r.pool.QueryRow(ctx,
		`UPDATE invites SET name = $2, phone = $3 WHERE id = $1
		 RETURNING id, name, code, rsvp_id, created_at, phone, wa_sent_at`,
		id, name, phone,
	).Scan(&inv.ID, &inv.Name, &inv.Code, &inv.RsvpID, &createdAt, &inv.Phone, &waSentAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, fmt.Errorf("invite not found")
	}
	if err != nil {
		return nil, err
	}
	inv.CreatedAt = createdAt.Format(time.RFC3339)
	inv.WaSentAt = scanWaSentAt(waSentAt)
	return &inv, nil
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd go-server && go build ./...
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add go-server/internal/repository/postgres.go
git commit -m "feat: implement UpdateInvite in postgres repository"
```

---

## Task 5: Frontend — replace phone inline edit with unified edit state

**Files:**
- Modify: `client/src/pages/admin/InvitesPage.tsx`

- [ ] **Step 1: Update the lucide-react import**

Find the existing lucide-react import (line ~18):
```tsx
import {
  Loader2, Trash2, Search, X, TicketCheck, Plus, Copy, Check, Upload, FileSpreadsheet,
  AlertTriangle, Users, Phone, MessageCircle, Send, ChevronDown, ChevronUp, SkipForward, Pause, Undo2,
} from "lucide-react";
```

Replace with (add `Pencil`):
```tsx
import {
  Loader2, Trash2, Search, X, TicketCheck, Plus, Copy, Check, Upload, FileSpreadsheet,
  AlertTriangle, Users, Phone, MessageCircle, Send, ChevronDown, ChevronUp, SkipForward, Pause, Undo2, Pencil,
} from "lucide-react";
```

- [ ] **Step 2: Replace the phone-edit state with unified edit state**

Find (lines ~123-126):
```tsx
  // Inline phone editing state
  const [editingPhoneId, setEditingPhoneId] = useState<number | null>(null);
  const [editPhoneValue, setEditPhoneValue] = useState("");
```

Replace with:
```tsx
  // Inline edit state (name + phone)
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editNameValue, setEditNameValue] = useState("");
  const [editPhoneValue, setEditPhoneValue] = useState("");
```

- [ ] **Step 3: Extend `updateInviteMutation` to send both name and phone**

Find the existing `updateInviteMutation` (lines ~200-213):
```tsx
  const updateInviteMutation = useMutation({
    mutationFn: async ({ id, phone }: { id: number; phone: string | null }) => {
      const response = await apiRequest("PATCH", `/api/admin/invites/${id}`, { phone });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/invites"] });
      setEditingPhoneId(null);
    },
    onError: (error: Error) => {
      handleAutoLogout(error);
      toast({ title: "Error", description: `Failed to update phone: ${error.message}`, variant: "destructive" });
    },
  });
```

Replace with:
```tsx
  const updateInviteMutation = useMutation({
    mutationFn: async ({ id, name, phone }: { id: number; name: string; phone: string | null }) => {
      const response = await apiRequest("PATCH", `/api/admin/invites/${id}`, { name, phone });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/invites"] });
      setEditingId(null);
    },
    onError: (error: Error) => {
      handleAutoLogout(error);
      toast({ title: "Error", description: `Failed to update invite: ${error.message}`, variant: "destructive" });
    },
  });
```

- [ ] **Step 4: Replace `handlePhoneEditSave` with `handleEditSave`**

Find the existing `handlePhoneEditSave` function (lines ~495-507):
```tsx
  const handlePhoneEditSave = (inviteId: number) => {
    const trimmed = editPhoneValue.trim();
    if (!trimmed) {
      updateInviteMutation.mutate({ id: inviteId, phone: null });
    } else {
      const normalized = normalizePhone(trimmed);
      if (!isValidE164(normalized)) {
        toast({ title: "Invalid phone", description: "Phone must be in international format (e.g. +6281234567890)", variant: "destructive" });
        return;
      }
      updateInviteMutation.mutate({ id: inviteId, phone: normalized });
    }
  };
```

Replace with:
```tsx
  const handleEditSave = (inviteId: number) => {
    const trimmedName = editNameValue.trim();
    if (!trimmedName) {
      toast({ title: "Invalid name", description: "Name cannot be empty", variant: "destructive" });
      return;
    }
    const trimmedPhone = editPhoneValue.trim();
    let phone: string | null = null;
    if (trimmedPhone) {
      const normalized = normalizePhone(trimmedPhone);
      if (!isValidE164(normalized)) {
        toast({ title: "Invalid phone", description: "Phone must be in international format (e.g. +6281234567890)", variant: "destructive" });
        return;
      }
      phone = normalized;
    }
    updateInviteMutation.mutate({ id: inviteId, name: trimmedName, phone });
  };
```

- [ ] **Step 5: Replace the card render section**

Find the invite card JSX starting at approximately line 1177:
```tsx
{!sendAllOpen && filteredInvites.map((invite) => (
  <Card key={invite.id} className="shadow-sm border-l-4 border-l-amber-500">
    <CardContent className="p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex-1">
          <h3 className="font-semibold text-lg text-gray-900">{invite.name}</h3>
          <div className="flex items-center gap-3 mt-1">
            <code className="text-sm bg-gray-100 px-2 py-0.5 rounded font-mono text-gray-700">
              {invite.code}
            </code>
            <button
              onClick={() => copyInviteLink(invite)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              title="Copy invite link"
            >
              {copiedId === invite.id ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
          </div>

          {/* Phone inline edit */}
          <div className="flex items-center gap-2 mt-2">
            {editingPhoneId === invite.id ? (
              <div className="flex items-center gap-2">
                <Input
                  value={editPhoneValue}
                  onChange={(e) => setEditPhoneValue(e.target.value)}
                  placeholder="+62..."
                  className="w-40 h-7 text-xs"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handlePhoneEditSave(invite.id);
                    if (e.key === "Escape") setEditingPhoneId(null);
                  }}
                  autoFocus
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0"
                  onClick={() => handlePhoneEditSave(invite.id)}
                  disabled={updateInviteMutation.isPending}
                >
                  {updateInviteMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0"
                  onClick={() => setEditingPhoneId(null)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setEditingPhoneId(invite.id);
                  setEditPhoneValue(invite.phone ?? "");
                }}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-gray-700 transition-colors"
                title="Edit phone number"
              >
                <Phone className="h-3 w-3" />
                {invite.phone ? (
                  <span className="font-mono">{invite.phone}</span>
                ) : (
                  <span className="italic">Add phone</span>
                )}
              </button>
            )}

            {/* WhatsApp send button */}
            {invite.phone && editingPhoneId !== invite.id && (
              <button
                onClick={() => {
                  const msg = renderTemplate(templateText, invite);
                  window.open(buildWaLink(invite.phone!, msg), "_blank");
                }}
                className="text-green-600 hover:text-green-700 transition-colors"
                title="Send via WhatsApp"
              >
                <MessageCircle className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* WA sent status */}
          {invite.waSentAt ? (
```

Replace from the opening `<Card key={invite.id}` to the end of the `</div>` containing the left column (just before `<div className="flex items-center gap-3 flex-wrap">`). The replacement restructures the left column to support both view and edit mode:

```tsx
{!sendAllOpen && filteredInvites.map((invite) => (
  <Card key={invite.id} className={`shadow-sm border-l-4 border-l-amber-500 ${editingId === invite.id ? "border-indigo-300" : ""}`}>
    <CardContent className="p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {editingId === invite.id ? (
          /* ── Edit mode ── */
          <div className="flex-1 space-y-2">
            <Input
              value={editNameValue}
              onChange={(e) => setEditNameValue(e.target.value)}
              className="h-8 text-sm font-semibold"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleEditSave(invite.id);
                if (e.key === "Escape") setEditingId(null);
              }}
              autoFocus
            />
            <div className="flex items-center gap-3">
              <code className="text-sm bg-gray-100 px-2 py-0.5 rounded font-mono text-gray-700">
                {invite.code}
              </code>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="h-3 w-3 text-muted-foreground" />
              <Input
                value={editPhoneValue}
                onChange={(e) => setEditPhoneValue(e.target.value)}
                placeholder="+62..."
                className="w-44 h-7 text-xs font-mono"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleEditSave(invite.id);
                  if (e.key === "Escape") setEditingId(null);
                }}
              />
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0"
                onClick={() => handleEditSave(invite.id)}
                disabled={updateInviteMutation.isPending}
              >
                {updateInviteMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0"
                onClick={() => setEditingId(null)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ) : (
          /* ── View mode ── */
          <div className="flex-1">
            <h3 className="font-semibold text-lg text-gray-900">{invite.name}</h3>
            <div className="flex items-center gap-3 mt-1">
              <code className="text-sm bg-gray-100 px-2 py-0.5 rounded font-mono text-gray-700">
                {invite.code}
              </code>
              <button
                onClick={() => copyInviteLink(invite)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                title="Copy invite link"
              >
                {copiedId === invite.id ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Phone className="h-3 w-3 text-muted-foreground" />
              {invite.phone ? (
                <span className="text-xs font-mono text-muted-foreground">{invite.phone}</span>
              ) : (
                <span className="text-xs italic text-muted-foreground">No phone</span>
              )}
              {invite.phone && (
                <button
                  onClick={() => {
                    const msg = renderTemplate(templateText, invite);
                    window.open(buildWaLink(invite.phone!, msg), "_blank");
                  }}
                  className="text-green-600 hover:text-green-700 transition-colors"
                  title="Send via WhatsApp"
                >
                  <MessageCircle className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        )}
```

- [ ] **Step 6: Update the actions area — add pencil button and fade badges in edit mode**

In the right-side actions `<div className="flex items-center gap-3 flex-wrap">`, wrap the WA-sent and RSVP badge elements in a fading div, and add the pencil button before the delete section. Replace the entire right-side div block:

```tsx
                    <div className="flex items-center gap-3 flex-wrap">
                      {/* WA sent status */}
                      {invite.waSentAt ? (
                        <button
                          onClick={() => unmarkWaSentMutation.mutate(invite.id)}
                          className="text-xs px-2.5 py-1 rounded-full bg-green-100 text-green-700 font-medium hover:bg-green-200 transition-colors"
                          title="Click to mark as unsent"
                        >
                          WA Sent
                        </button>
                      ) : invite.phone ? (
                        <button
                          onClick={() => markWaSentMutation.mutate(invite.id)}
                          className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-500 font-medium hover:bg-gray-200 transition-colors"
                          title="Click to mark as sent"
                        >
                          WA Unsent
                        </button>
                      ) : null}

                      {/* RSVP status */}
                      {invite.rsvp ? (
                        <span className="text-sm px-3 py-1 rounded-full bg-green-100 text-green-800 font-medium">
                          RSVP: {invite.rsvp.attendanceType === "decline" ? "Declined" :
                            invite.rsvp.attendanceType === "both" ? "Both Events" :
                            invite.rsvp.attendanceType === "holy_matrimony" ? "Holy Matrimony" : "Reception"}
                        </span>
                      ) : (
                        <span className="text-sm px-3 py-1 rounded-full bg-gray-100 text-gray-500 font-medium">
                          Pending
                        </span>
                      )}

                      {itemToDelete === invite.id ? (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-500">Delete?</span>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={confirmDelete}
                            disabled={deleteInviteMutation.isPending}
                          >
                            {deleteInviteMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              "Yes"
                            )}
                          </Button>
                          <Button variant="outline" size="sm" onClick={cancelDelete}>
                            No
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => requestDelete(invite.id)}
                          className="text-gray-400 hover:text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
```

With:

```tsx
                    <div className="flex items-center gap-3 flex-wrap">
                      {/* Status badges — faded during edit mode */}
                      <div className={`flex items-center gap-3 flex-wrap transition-opacity ${editingId === invite.id ? "opacity-40 pointer-events-none" : ""}`}>
                        {invite.waSentAt ? (
                          <button
                            onClick={() => unmarkWaSentMutation.mutate(invite.id)}
                            className="text-xs px-2.5 py-1 rounded-full bg-green-100 text-green-700 font-medium hover:bg-green-200 transition-colors"
                            title="Click to mark as unsent"
                          >
                            WA Sent
                          </button>
                        ) : invite.phone ? (
                          <button
                            onClick={() => markWaSentMutation.mutate(invite.id)}
                            className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-500 font-medium hover:bg-gray-200 transition-colors"
                            title="Click to mark as sent"
                          >
                            WA Unsent
                          </button>
                        ) : null}

                        {invite.rsvp ? (
                          <span className="text-sm px-3 py-1 rounded-full bg-green-100 text-green-800 font-medium">
                            RSVP: {invite.rsvp.attendanceType === "decline" ? "Declined" :
                              invite.rsvp.attendanceType === "both" ? "Both Events" :
                              invite.rsvp.attendanceType === "holy_matrimony" ? "Holy Matrimony" : "Reception"}
                          </span>
                        ) : (
                          <span className="text-sm px-3 py-1 rounded-full bg-gray-100 text-gray-500 font-medium">
                            Pending
                          </span>
                        )}
                      </div>

                      {editingId !== invite.id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingId(invite.id);
                            setEditNameValue(invite.name);
                            setEditPhoneValue(invite.phone ?? "");
                          }}
                          className="text-gray-400 hover:text-blue-500"
                          title="Edit guest"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {itemToDelete === invite.id ? (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-500">Delete?</span>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={confirmDelete}
                            disabled={deleteInviteMutation.isPending}
                          >
                            {deleteInviteMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              "Yes"
                            )}
                          </Button>
                          <Button variant="outline" size="sm" onClick={cancelDelete}>
                            No
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => requestDelete(invite.id)}
                          className="text-gray-400 hover:text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
```

- [ ] **Step 7: TypeScript check**

```bash
npm run check
```

Expected: no type errors.

- [ ] **Step 8: Commit**

```bash
git add client/src/pages/admin/InvitesPage.tsx
git commit -m "feat: add inline edit button for guest name and phone"
```

---

## Task 6: Manual smoke test

- [ ] **Step 1: Start the dev servers**

In two terminals:
```bash
# Terminal 1
cd go-server && make run-dev

# Terminal 2
npm run dev
```

- [ ] **Step 2: Smoke test the edit flow**

Open `http://localhost:5173` in a browser, log in as admin, navigate to Invites.

1. Verify the phone numbers are now static (no longer clickable to edit).
2. Verify a pencil icon appears on each card.
3. Click the pencil icon on a card — verify:
   - Name field appears (focused), pre-seeded with current name.
   - Phone field appears, pre-seeded with current phone.
   - Card border is purple/indigo.
4. Edit both name and phone, press Enter or click ✓ — verify the card updates.
5. Click pencil, change the name, press Escape — verify the card reverts.
6. Click pencil, clear the name, click ✓ — verify a toast appears ("Name cannot be empty").
7. Click pencil, enter an invalid phone (e.g. `1234`), click ✓ — verify the invalid phone toast appears.

- [ ] **Step 3: Run the full backend test suite one final time**

```bash
cd go-server && make test
```

Expected: all tests pass.
