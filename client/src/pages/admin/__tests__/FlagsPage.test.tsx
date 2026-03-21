// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockAutoLogout = vi.fn();
vi.mock("../AdminContext", () => ({
  useAdminContext: () => ({ handleAutoLogout: mockAutoLogout }),
}));

vi.mock("wouter", () => ({
  useLocation: () => ["/flags", vi.fn()],
}));

import FlagsPage from "../FlagsPage";

const mockFlags = {
  featureFlags: [
    { id: 1, featureKey: "rsvp", featureName: "RSVP Form", description: "RSVP form toggle", enabled: true, updatedAt: "2026-03-20" },
    { id: 2, featureKey: "gallery", featureName: "Photo Gallery", description: "Gallery toggle", enabled: false, updatedAt: "2026-03-20" },
  ],
};

const mockWelcome = {
  welcomeScreen: { headingText: "", deliveryLabel: "", fallbackName: "", enabled: true },
};

function renderFlagsPage(flags = mockFlags, welcome = mockWelcome) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  qc.setQueryData(["/api/feature-flags"], flags);
  qc.setQueryData(["/api/welcome-screen"], welcome);
  return render(
    <QueryClientProvider client={qc}><FlagsPage /></QueryClientProvider>
  );
}

describe("FlagsPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders feature flag toggles", () => {
    renderFlagsPage();
    expect(screen.getByText("RSVP Form")).toBeInTheDocument();
    expect(screen.getByText("Photo Gallery")).toBeInTheDocument();
  });

  it("shows enabled/disabled badges", () => {
    renderFlagsPage();
    // Welcome screen (enabled) + RSVP (enabled) = 2 "Enabled" badges
    const enabledBadges = screen.getAllByText("Enabled");
    expect(enabledBadges.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Disabled")).toBeInTheDocument();
  });

  it("renders welcome screen toggle", () => {
    renderFlagsPage();
    expect(screen.getByText("Enable Welcome Screen")).toBeInTheDocument();
  });

  it("shows feature key codes", () => {
    renderFlagsPage();
    expect(screen.getByText("rsvp")).toBeInTheDocument();
    expect(screen.getByText("gallery")).toBeInTheDocument();
  });

  it("shows info box about feature flags", () => {
    renderFlagsPage();
    expect(screen.getByText("How Feature Flags Work")).toBeInTheDocument();
  });

  it("shows empty state when no flags", () => {
    renderFlagsPage({ featureFlags: [] });
    expect(screen.getByText("No additional feature flags configured")).toBeInTheDocument();
  });
});
