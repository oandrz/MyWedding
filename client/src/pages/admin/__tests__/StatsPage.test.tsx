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
    { id: 1, name: "Alice", attendanceType: "both", guestCount: 3 },
    { id: 2, name: "Bob", attendanceType: "holy_matrimony", guestCount: 2 },
    { id: 3, name: "Carol", attendanceType: "decline", guestCount: null },
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
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("Confirmed Attending")).toBeInTheDocument();
  });

  it("renders not attending count", () => {
    renderStatsPage();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("Not Attending")).toBeInTheDocument();
  });

  it("renders total guest count", () => {
    renderStatsPage();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("Total Expected Guests")).toBeInTheDocument();
  });

  it("renders attendance rate percentage", () => {
    renderStatsPage();
    expect(screen.getByText("67%")).toBeInTheDocument();
  });

  it("renders total responses", () => {
    renderStatsPage();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("Total Responses")).toBeInTheDocument();
  });
});
