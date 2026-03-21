// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockAutoLogout = vi.fn();
vi.mock("../AdminContext", () => ({
  useAdminContext: () => ({ handleAutoLogout: mockAutoLogout }),
}));

vi.mock("wouter", () => ({
  useLocation: () => ["/welcome", vi.fn()],
}));

import WelcomePage from "../WelcomePage";

const mockWelcomeData = {
  welcomeScreen: {
    headingText: "The Wedding of A & C",
    deliveryLabel: "Kindly Delivered to",
    fallbackName: "Our Dearest Guest",
    enabled: true,
  },
};

function renderWelcomePage(data: any = mockWelcomeData) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  qc.setQueryData(["/api/welcome-screen"], data);
  return render(
    <QueryClientProvider client={qc}><WelcomePage /></QueryClientProvider>
  );
}

describe("WelcomePage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders form with loaded welcome screen data", () => {
    renderWelcomePage();
    expect(screen.getByDisplayValue("The Wedding of A & C")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Kindly Delivered to")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Our Dearest Guest")).toBeInTheDocument();
  });

  it("renders preview section", () => {
    renderWelcomePage();
    expect(screen.getByText("Preview")).toBeInTheDocument();
  });

  it("renders usage instructions", () => {
    renderWelcomePage();
    expect(screen.getByText("How to Use")).toBeInTheDocument();
  });

  it("has a save button", () => {
    renderWelcomePage();
    expect(screen.getByText("Save Configuration")).toBeInTheDocument();
  });
});
