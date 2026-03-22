// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockAutoLogout = vi.fn();
vi.mock("../AdminContext", () => ({
  useAdminContext: () => ({ handleAutoLogout: mockAutoLogout }),
}));

vi.mock("wouter", () => ({
  useLocation: () => ["/config", vi.fn()],
}));

// Mock ImageManager and MusicManager to isolate ConfigPage tests
vi.mock("@/components/ImageManager", () => ({
  default: () => <div data-testid="image-manager">ImageManager</div>,
}));

vi.mock("@/components/MusicManager", () => ({
  default: () => <div data-testid="music-manager">MusicManager</div>,
}));

import ConfigPage from "../ConfigPage";

function renderConfigPage(settings: any[] = []) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  qc.setQueryData(["/api/app-settings"], { settings });
  return render(
    <QueryClientProvider client={qc}><ConfigPage /></QueryClientProvider>
  );
}

describe("ConfigPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders Google Drive section", () => {
    renderConfigPage();
    expect(screen.getByText("Google Drive Integration")).toBeInTheDocument();
    expect(screen.getByText("Configure Google Drive OAuth")).toBeInTheDocument();
  });

  it("renders ImageManager component", () => {
    renderConfigPage();
    expect(screen.getByTestId("image-manager")).toBeInTheDocument();
  });

  it("renders MusicManager component", () => {
    renderConfigPage();
    expect(screen.getByTestId("music-manager")).toBeInTheDocument();
  });

  it("renders E-Gift form", () => {
    renderConfigPage();
    expect(screen.getByText("E-Gift Bank Accounts")).toBeInTheDocument();
    expect(screen.getAllByLabelText("Account Holder Name").length).toBeGreaterThan(0);
  });

  it("loads e-gift settings into form", () => {
    const settings = [
      { settingKey: "egift_groom_name", settingValue: "Andreas" },
      { settingKey: "egift_groom_bank", settingValue: "BCA" },
    ];
    renderConfigPage(settings);
    expect(screen.getByDisplayValue("Andreas")).toBeInTheDocument();
    expect(screen.getByDisplayValue("BCA")).toBeInTheDocument();
  });
});
