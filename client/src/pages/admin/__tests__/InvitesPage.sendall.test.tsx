// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockAutoLogout = vi.fn();
vi.mock("../AdminContext", () => ({
  useAdminContext: () => ({ handleAutoLogout: mockAutoLogout }),
}));

// Mock apiRequest so mutations resolve successfully without hitting the network.
const mockApiRequest = vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({}),
});
vi.mock("@/lib/queryClient", async () => {
  const actual = await vi.importActual("@/lib/queryClient");
  return { ...actual, apiRequest: (...args: unknown[]) => mockApiRequest(...args) };
});

const mockWindowOpen = vi.fn();
Object.defineProperty(window, "open", { value: mockWindowOpen, writable: true });

import InvitesPage from "../InvitesPage";

const mockInvites = {
  invites: [
    { id: 1, name: "Alice", code: "ABC1", phone: "+6281111111111", waSentAt: null, rsvp: null, createdAt: "2026-04-01T00:00:00Z" },
    { id: 2, name: "Bob", code: "ABC2", phone: "+6282222222222", waSentAt: null, rsvp: null, createdAt: "2026-04-01T00:00:00Z" },
    { id: 3, name: "Charlie", code: "ABC3", phone: "+6283333333333", waSentAt: null, rsvp: null, createdAt: "2026-04-01T00:00:00Z" },
    { id: 4, name: "NoPhone", code: "ABC4", phone: null, waSentAt: null, rsvp: null, createdAt: "2026-04-01T00:00:00Z" },
  ],
};

function renderInvitesPage(invites = mockInvites) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  qc.setQueryData(["/api/admin/invites"], invites);
  qc.setQueryData(["/api/settings/wa_message_template"], undefined);
  return { qc, ...render(<QueryClientProvider client={qc}><InvitesPage /></QueryClientProvider>) };
}

async function openSendAllDialog(user: ReturnType<typeof userEvent.setup>) {
  const btn = screen.getByRole("button", { name: /send all unsent/i });
  await user.click(btn);
}

// ─── 1. Send All Dialog — Send & Next ────────────────────────────────────────

describe("Send All Dialog — Send & Next", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiRequest.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
  });

  it("shows 'Send & Next' button (not separate 'Open WhatsApp' or 'Mark Sent & Next')", async () => {
    const user = userEvent.setup();
    renderInvitesPage();
    await openSendAllDialog(user);

    expect(screen.getByRole("button", { name: /send & next/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /open whatsapp/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /mark sent & next/i })).not.toBeInTheDocument();
  });

  it("opens wa.me link when 'Send & Next' is clicked", async () => {
    const user = userEvent.setup();
    renderInvitesPage();
    await openSendAllDialog(user);

    const sendBtn = screen.getByRole("button", { name: /send & next/i });
    await user.click(sendBtn);

    expect(mockWindowOpen).toHaveBeenCalledTimes(1);
    const calledUrl: string = mockWindowOpen.mock.calls[0][0];
    expect(calledUrl).toMatch(/wa\.me\//);
  });

  it("shows keyboard hints text", async () => {
    const user = userEvent.setup();
    renderInvitesPage();
    await openSendAllDialog(user);

    expect(screen.getByText(/enter to send/i)).toBeInTheDocument();
    expect(screen.getByText(/s to skip/i)).toBeInTheDocument();
    expect(screen.getByText(/esc to pause/i)).toBeInTheDocument();
  });
});

// ─── 2. Send All Dialog — Keyboard Shortcuts ─────────────────────────────────

describe("Send All Dialog — Keyboard Shortcuts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiRequest.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
  });

  it("Enter key triggers send-and-next (opens wa.me link)", async () => {
    const user = userEvent.setup();
    renderInvitesPage();
    await openSendAllDialog(user);

    // Ensure dialog is open with first invite visible
    expect(screen.getByText("Alice")).toBeInTheDocument();

    await user.keyboard("{Enter}");

    expect(mockWindowOpen).toHaveBeenCalledTimes(1);
    const calledUrl: string = mockWindowOpen.mock.calls[0][0];
    expect(calledUrl).toMatch(/wa\.me\//);
  });

  it("S key triggers skip (advances without opening link)", async () => {
    const user = userEvent.setup();
    renderInvitesPage();
    await openSendAllDialog(user);

    // First invite is Alice; press S to skip
    expect(screen.getByText("Alice")).toBeInTheDocument();

    await user.keyboard("s");

    // window.open should NOT have been called
    expect(mockWindowOpen).not.toHaveBeenCalled();

    // Should advance to next invite (Bob)
    await waitFor(() => {
      expect(screen.getByText("Bob")).toBeInTheDocument();
    });
  });

  it("Enter is no-op when mutation is pending", async () => {
    // Make the mutation hang indefinitely
    mockApiRequest.mockReturnValueOnce(new Promise(() => {}));

    const user = userEvent.setup();
    renderInvitesPage();
    await openSendAllDialog(user);

    // First Enter triggers send and starts the pending mutation
    await user.keyboard("{Enter}");
    expect(mockWindowOpen).toHaveBeenCalledTimes(1);

    // Second Enter while pending should be a no-op
    await user.keyboard("{Enter}");
    expect(mockWindowOpen).toHaveBeenCalledTimes(1);
  });

  it("S key is no-op when an input element is focused", async () => {
    const user = userEvent.setup();
    renderInvitesPage();
    await openSendAllDialog(user);

    expect(screen.getByText("Alice")).toBeInTheDocument();

    // Create a temporary input inside the dialog to simulate focus on an editable element.
    // Radix Dialog traps focus, so we can't click the background search input.
    // Instead, dispatch a keydown event with an INPUT element as the target.
    const tempInput = document.createElement("input");
    document.body.appendChild(tempInput);
    tempInput.focus();
    fireEvent.keyDown(tempInput, { key: "s" });
    document.body.removeChild(tempInput);

    // Alice should still be visible (not advanced to Bob)
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(mockWindowOpen).not.toHaveBeenCalled();
  });
});

// ─── 3. Send All Dialog — Undo ────────────────────────────────────────────────

describe("Send All Dialog — Undo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiRequest.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
  });

  it("does not show Undo button before any send", async () => {
    const user = userEvent.setup();
    renderInvitesPage();
    await openSendAllDialog(user);

    expect(screen.queryByRole("button", { name: /undo/i })).not.toBeInTheDocument();
  });

  it("shows Undo button after first send", async () => {
    const user = userEvent.setup();
    renderInvitesPage();
    await openSendAllDialog(user);

    const sendBtn = screen.getByRole("button", { name: /send & next/i });
    await user.click(sendBtn);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /undo/i })).toBeInTheDocument();
    });
  });

  it("clicking Undo calls unmark mutation and decrements sent count", async () => {
    const user = userEvent.setup();
    renderInvitesPage();
    await openSendAllDialog(user);

    // Send the first invite
    const sendBtn = screen.getByRole("button", { name: /send & next/i });
    await user.click(sendBtn);

    // Wait for sent count to increment
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /undo/i })).toBeInTheDocument();
    });

    // Verify sent count is 1 before undo
    expect(screen.getByText(/sent: 1/i)).toBeInTheDocument();

    // Click Undo
    const undoBtn = screen.getByRole("button", { name: /undo/i });
    await user.click(undoBtn);

    // Verify unmark mutation was called (DELETE for wa-sent)
    await waitFor(() => {
      const deleteCalls = mockApiRequest.mock.calls.filter(
        (call) => call[0] === "DELETE" && String(call[1]).includes("/wa-sent")
      );
      expect(deleteCalls.length).toBeGreaterThan(0);
    });

    // Sent count should go back to 0
    await waitFor(() => {
      expect(screen.getByText(/sent: 0/i)).toBeInTheDocument();
    });
  });

  it("shows completion summary with correct sent/skipped counts", async () => {
    // Use only 2 invites for a quick completion
    const twoInvites = {
      invites: [
        { id: 1, name: "Alice", code: "ABC1", phone: "+6281111111111", waSentAt: null, rsvp: null, createdAt: "2026-04-01T00:00:00Z" },
        { id: 2, name: "Bob", code: "ABC2", phone: "+6282222222222", waSentAt: null, rsvp: null, createdAt: "2026-04-01T00:00:00Z" },
      ],
    };

    const user = userEvent.setup();
    renderInvitesPage(twoInvites);
    await openSendAllDialog(user);

    // Send Alice (advances to Bob)
    const sendBtn = screen.getByRole("button", { name: /send & next/i });
    await user.click(sendBtn);

    // Wait for Bob to appear
    await waitFor(() => {
      expect(screen.getByText("Bob")).toBeInTheDocument();
    });

    // Skip Bob (last invite → completion summary)
    const skipBtn = screen.getByRole("button", { name: /skip/i });
    await user.click(skipBtn);

    // Should show "All done!" completion summary
    await waitFor(() => {
      expect(screen.getByText(/all done/i)).toBeInTheDocument();
    });

    // Should show correct counts: 1 sent, 1 skipped
    expect(screen.getByText(/sent: 1/i)).toBeInTheDocument();
    expect(screen.getByText(/skipped: 1/i)).toBeInTheDocument();
  });
});
