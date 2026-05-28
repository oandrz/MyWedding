// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";

const mockAutoLogout = vi.fn();
vi.mock("../AdminContext", () => ({
  useAdminContext: () => ({ handleAutoLogout: mockAutoLogout }),
}));

const mockApiRequest = vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({}),
});
vi.mock("@/lib/queryClient", async () => {
  const actual = await vi.importActual("@/lib/queryClient");
  return { ...actual, apiRequest: (...args: unknown[]) => mockApiRequest(...args) };
});

import InvitesPage from "../InvitesPage";

const invitesFixture = {
  invites: [
    { id: 1, name: "Alice (groom)",   code: "A1", phone: "+621", side: "groom",  waSentAt: null, rsvp: null, createdAt: "2026-04-01T00:00:00Z" },
    { id: 2, name: "Bob (groom)",     code: "A2", phone: "+622", side: "groom",  waSentAt: null, rsvp: null, createdAt: "2026-04-01T00:00:00Z" },
    { id: 3, name: "Carol (bride)",   code: "A3", phone: "+623", side: "bride",  waSentAt: null, rsvp: null, createdAt: "2026-04-01T00:00:00Z" },
    { id: 4, name: "Dan (bride)",     code: "A4", phone: "+624", side: "bride",  waSentAt: null, rsvp: null, createdAt: "2026-04-01T00:00:00Z" },
    { id: 5, name: "Eve (bride)",     code: "A5", phone: "+625", side: "bride",  waSentAt: null, rsvp: null, createdAt: "2026-04-01T00:00:00Z" },
    { id: 6, name: "Frank (no side)", code: "A6", phone: "+626", side: null,     waSentAt: null, rsvp: null, createdAt: "2026-04-01T00:00:00Z" },
  ],
};

function renderPage(initialPath = "/admin/invites") {
  // Reset URL before each render so URL-param hydration tests are deterministic.
  window.history.replaceState(null, "", initialPath);
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  qc.setQueryData(["/api/admin/invites"], invitesFixture);
  return render(
    <QueryClientProvider client={qc}>
      <Router>
        <InvitesPage />
      </Router>
    </QueryClientProvider>
  );
}

describe("InvitesPage — side filter chips", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders four chips with correct counts when unassigned invites exist", () => {
    renderPage();
    expect(screen.getByTestId("side-filter-all")).toHaveTextContent("All · 6");
    expect(screen.getByTestId("side-filter-groom")).toHaveTextContent("Groom · 2");
    expect(screen.getByTestId("side-filter-bride")).toHaveTextContent("Bride · 3");
    expect(screen.getByTestId("side-filter-unassigned")).toHaveTextContent("Unassigned · 1");
  });

  it("hides the unassigned chip when every invite has a side", () => {
    const allSided = {
      invites: invitesFixture.invites.filter((i) => i.side !== null),
    };
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    qc.setQueryData(["/api/admin/invites"], allSided);
    window.history.replaceState(null, "", "/admin/invites");
    render(
      <QueryClientProvider client={qc}>
        <Router><InvitesPage /></Router>
      </QueryClientProvider>
    );
    expect(screen.queryByTestId("side-filter-unassigned")).not.toBeInTheDocument();
  });

  it("narrows the list to groom invites when the groom chip is clicked", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByTestId("side-filter-groom"));

    expect(screen.getByText("Alice (groom)")).toBeInTheDocument();
    expect(screen.getByText("Bob (groom)")).toBeInTheDocument();
    expect(screen.queryByText("Carol (bride)")).not.toBeInTheDocument();
    expect(screen.queryByText("Frank (no side)")).not.toBeInTheDocument();
  });

  it("writes the filter to the URL when a chip is clicked, and removes it for All", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByTestId("side-filter-bride"));
    expect(window.location.search).toBe("?side=bride");

    await user.click(screen.getByTestId("side-filter-all"));
    expect(window.location.search).toBe("");
  });

  it("hydrates the filter from ?side= on mount", () => {
    renderPage("/admin/invites?side=bride");
    expect(screen.getByText("Carol (bride)")).toBeInTheDocument();
    expect(screen.queryByText("Alice (groom)")).not.toBeInTheDocument();
  });

  it("falls back to 'all' when ?side= is invalid", () => {
    renderPage("/admin/invites?side=banana");
    expect(screen.getByText("Alice (groom)")).toBeInTheDocument();
    expect(screen.getByText("Carol (bride)")).toBeInTheDocument();
    expect(screen.getByText("Frank (no side)")).toBeInTheDocument();
  });

  it("composes search with side filter", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByTestId("side-filter-groom"));
    await user.type(screen.getByTestId("invite-search-input"), "alice");

    expect(await screen.findByText("Alice (groom)")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText("Bob (groom)")).not.toBeInTheDocument();
    });
    expect(screen.queryByText("Carol (bride)")).not.toBeInTheDocument();
  });

  it("updates the Send All button label based on the active filter", async () => {
    const user = userEvent.setup();
    renderPage();

    expect(screen.getByRole("button", { name: /send all unsent \(6\)/i })).toBeInTheDocument();

    await user.click(screen.getByTestId("side-filter-groom"));
    expect(screen.getByRole("button", { name: /send groom unsent \(2\)/i })).toBeInTheDocument();

    await user.click(screen.getByTestId("side-filter-bride"));
    expect(screen.getByRole("button", { name: /send bride unsent \(3\)/i })).toBeInTheDocument();
  });

  it("shows side-aware empty state when filter has no matches", () => {
    const groomOnly = { invites: invitesFixture.invites.filter((i) => i.side === "groom") };
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    qc.setQueryData(["/api/admin/invites"], groomOnly);
    window.history.replaceState(null, "", "/admin/invites?side=bride");
    render(
      <QueryClientProvider client={qc}>
        <Router><InvitesPage /></Router>
      </QueryClientProvider>
    );

    expect(screen.getByText(/no guests on the bride side/i)).toBeInTheDocument();
  });

  it("hides Groom and Bride stats cards when a side filter is active", async () => {
    const user = userEvent.setup();
    renderPage();
    expect(screen.getByText("Groom Guests")).toBeInTheDocument();
    expect(screen.getByText("Bride Guests")).toBeInTheDocument();

    await user.click(screen.getByTestId("side-filter-groom"));
    expect(screen.queryByText("Groom Guests")).not.toBeInTheDocument();
    expect(screen.queryByText("Bride Guests")).not.toBeInTheDocument();
  });

  it("disables Delete All Filtered when the filtered scope is empty (data-loss guard)", () => {
    const groomOnly = { invites: invitesFixture.invites.filter((i) => i.side === "groom") };
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    qc.setQueryData(["/api/admin/invites"], groomOnly);
    window.history.replaceState(null, "", "/admin/invites?side=bride");
    render(
      <QueryClientProvider client={qc}>
        <Router><InvitesPage /></Router>
      </QueryClientProvider>
    );

    const deleteAllBtn = screen.getByRole("button", { name: /delete all filtered \(0\)/i });
    expect(deleteAllBtn).toBeDisabled();
  });
});
