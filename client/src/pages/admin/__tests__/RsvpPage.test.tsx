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
    { id: 1, name: "Alice", email: "alice@test.com", attending: true, guestCount: 2 },
    { id: 2, name: "Bob", email: "bob@test.com", attending: false, guestCount: 0 },
  ],
  stats: { attending: 1, guestCount: 2, notAttending: 1 },
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

  it("renders stats cards with correct counts", () => {
    renderRsvpPage();
    expect(screen.getByText("Confirmed Attending")).toBeInTheDocument();
    expect(screen.getByText("Total Expected Guests")).toBeInTheDocument();
    // attending count = 1, total guests = 2 (Alice has guestCount 2)
    expect(screen.getByText("1")).toBeInTheDocument();
    // Use getAllByText since "2" appears in both the stats card and the guest count detail
    const twos = screen.getAllByText("2");
    expect(twos.length).toBeGreaterThanOrEqual(1);
  });

  it("renders RSVP entries with names and emails", () => {
    renderRsvpPage();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("alice@test.com")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("shows attending badge for attending guests", () => {
    renderRsvpPage();
    expect(screen.getByText("Attending")).toBeInTheDocument();
    expect(screen.getByText("Not Attending")).toBeInTheDocument();
  });

  it("shows empty state when no RSVPs", () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    qc.setQueryData(["/api/rsvp"], { rsvps: [], stats: { attending: 0, guestCount: 0, notAttending: 0 } });
    renderRsvpPage(qc);
    expect(screen.getByText("No RSVP responses yet")).toBeInTheDocument();
  });

  it("shows delete confirmation when trash button clicked", async () => {
    renderRsvpPage();
    const trashButtons = screen.getAllByRole("button", { name: "" }); // trash icon buttons
    await userEvent.click(trashButtons[0]);
    expect(screen.getByText("Delete?")).toBeInTheDocument();
    expect(screen.getByText("Yes")).toBeInTheDocument();
    expect(screen.getByText("No")).toBeInTheDocument();
  });
});
