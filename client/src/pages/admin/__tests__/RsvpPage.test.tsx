// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockAutoLogout = vi.fn();
vi.mock("../AdminContext", () => ({
  useAdminContext: () => ({ handleAutoLogout: mockAutoLogout }),
  AdminContext: { Provider: ({ children }: any) => children },
}));

vi.mock("wouter", () => ({
  useLocation: () => ["/rsvps", vi.fn()],
  Link: ({ children, href }: any) => <a href={href}>{children}</a>,
}));

import RsvpPage from "../RsvpPage";

const mockRsvpData = {
  rsvps: [
    { id: 1, name: "Alice", email: "alice@test.com", attendanceType: "both", guestCount: 2 },
    { id: 2, name: "Bob", email: "bob@test.com", attendanceType: "holy_matrimony", guestCount: 1 },
    { id: 3, name: "Charlie", email: "charlie@test.com", attendanceType: "reception", guestCount: 3 },
    { id: 4, name: "Diana", email: "diana@test.com", attendanceType: "decline", guestCount: null },
  ],
  stats: {
    total: 4, attending: 3, notAttending: 1, guestCount: 6,
    holyMatrimonyCount: 2, receptionCount: 2,
    holyMatrimonyGuestCount: 3, receptionGuestCount: 5,
  },
};

function createTestQueryClient(data: any = mockRsvpData) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  client.setQueryData(["/api/rsvp"], data);
  return client;
}

function renderRsvpPage(queryClient?: QueryClient) {
  const qc = queryClient ?? createTestQueryClient();
  return render(
    <QueryClientProvider client={qc}><RsvpPage /></QueryClientProvider>
  );
}

describe("RsvpPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders 5 stat cards", () => {
    renderRsvpPage();
    expect(screen.getByText("Holy Matrimony RSVPs")).toBeInTheDocument();
    expect(screen.getByText("Reception RSVPs")).toBeInTheDocument();
    expect(screen.getByText("Matrimony Guests")).toBeInTheDocument();
    expect(screen.getByText("Reception Guests")).toBeInTheDocument();
    // "Declined" appears in stat card, filter tab, and badge — use getAllByText
    expect(screen.getAllByText("Declined").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId("stat-declined")).toBeInTheDocument();
    // Combined total card is gone
    expect(screen.queryByText("Total Expected Guests")).not.toBeInTheDocument();
  });

  it("renders correct stat values", () => {
    renderRsvpPage();
    expect(screen.getByTestId("stat-holy-matrimony")).toHaveTextContent("2");
    expect(screen.getByTestId("stat-reception")).toHaveTextContent("2");
    expect(screen.getByTestId("stat-declined")).toHaveTextContent("1");
    expect(screen.getByTestId("stat-holy-matrimony-guests")).toHaveTextContent("3");
    expect(screen.getByTestId("stat-reception-guests")).toHaveTextContent("5");
  });

  it("renders 5 filter tabs", () => {
    renderRsvpPage();
    expect(screen.getByRole("tab", { name: "All" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Holy Matrimony" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Reception" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Both" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Declined" })).toBeInTheDocument();
  });

  it("renders RSVP entries with names and emails", () => {
    renderRsvpPage();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("alice@test.com")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("Diana")).toBeInTheDocument();
  });

  it("shows event-specific badges", () => {
    renderRsvpPage();
    const holyMatrimonyBadges = screen.getAllByText("Holy Matrimony");
    expect(holyMatrimonyBadges.length).toBeGreaterThanOrEqual(1);
    const receptionBadges = screen.getAllByText("Reception");
    expect(receptionBadges.length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Declined").length).toBeGreaterThanOrEqual(1);
  });

  it("filters by Holy Matrimony tab (includes both)", async () => {
    renderRsvpPage();
    const tab = screen.getByRole("tab", { name: "Holy Matrimony" });
    await userEvent.click(tab);
    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeInTheDocument();
      expect(screen.getByText("Bob")).toBeInTheDocument();
      expect(screen.queryByText("Charlie")).not.toBeInTheDocument();
      expect(screen.queryByText("Diana")).not.toBeInTheDocument();
    });
  });

  it("filters by Reception tab (includes both)", async () => {
    renderRsvpPage();
    const tab = screen.getByRole("tab", { name: "Reception" });
    await userEvent.click(tab);
    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeInTheDocument();
      expect(screen.getByText("Charlie")).toBeInTheDocument();
      expect(screen.queryByText("Bob")).not.toBeInTheDocument();
      expect(screen.queryByText("Diana")).not.toBeInTheDocument();
    });
  });

  it("shows empty state when no RSVPs", () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    qc.setQueryData(["/api/rsvp"], {
      rsvps: [],
      stats: { total: 0, attending: 0, notAttending: 0, guestCount: 0, holyMatrimonyCount: 0, receptionCount: 0, holyMatrimonyGuestCount: 0, receptionGuestCount: 0 },
    });
    renderRsvpPage(qc);
    expect(screen.getByText("No RSVP responses yet")).toBeInTheDocument();
  });

  it("renders search input", () => {
    renderRsvpPage();
    expect(screen.getByTestId("rsvp-search-input")).toBeInTheDocument();
  });

  it("filters by search text", async () => {
    renderRsvpPage();
    const input = screen.getByTestId("rsvp-search-input");
    await userEvent.type(input, "Alice");
    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeInTheDocument();
      expect(screen.queryByText("Bob")).not.toBeInTheDocument();
    });
  });
});
