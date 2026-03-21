// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("../AdminContext", () => ({
  useAdminContext: () => ({ handleAutoLogout: vi.fn() }),
}));

vi.mock("wouter", () => ({
  useLocation: () => ["/stats", vi.fn()],
}));

import StatsPage from "../StatsPage";

const mockRsvpData = {
  rsvps: [
    { id: 1, name: "Alice", attending: true, guestCount: 3 },
    { id: 2, name: "Bob", attending: true, guestCount: 2 },
    { id: 3, name: "Carol", attending: false, guestCount: 0 },
  ],
};

function renderStatsPage(data = mockRsvpData) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  qc.setQueryData(["/api/rsvp"], data);
  return render(
    <QueryClientProvider client={qc}><StatsPage /></QueryClientProvider>
  );
}

describe("StatsPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders attending count", () => {
    renderStatsPage();
    expect(screen.getByText("2")).toBeInTheDocument(); // 2 attending
    expect(screen.getByText("Confirmed Attending")).toBeInTheDocument();
  });

  it("renders not attending count", () => {
    renderStatsPage();
    expect(screen.getByText("1")).toBeInTheDocument(); // 1 not attending
    expect(screen.getByText("Not Attending")).toBeInTheDocument();
  });

  it("renders total guest count", () => {
    renderStatsPage();
    expect(screen.getByText("5")).toBeInTheDocument(); // 3 + 2
    expect(screen.getByText("Total Expected Guests")).toBeInTheDocument();
  });

  it("renders attendance rate percentage", () => {
    renderStatsPage();
    expect(screen.getByText("67%")).toBeInTheDocument(); // 2/3 = 67%
  });

  it("renders total responses", () => {
    renderStatsPage();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("Total Responses")).toBeInTheDocument();
  });
});
