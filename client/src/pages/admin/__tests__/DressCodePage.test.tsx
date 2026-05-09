// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockAutoLogout = vi.fn();
vi.mock("../AdminContext", () => ({
  useAdminContext: () => ({ handleAutoLogout: mockAutoLogout }),
}));

const mockToast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

import DressCodePage from "../DressCodePage";

function renderDressCodePage(colors: { hex: string; label: string }[] = []) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  qc.setQueryData(["/api/app-settings"], {
    settings: [{ settingKey: "dress_code_colors", settingValue: JSON.stringify(colors) }],
  });
  return render(
    <QueryClientProvider client={qc}><DressCodePage /></QueryClientProvider>
  );
}

describe("DressCodePage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders heading, add form, and save button", () => {
    renderDressCodePage();
    expect(screen.getByText("Dress Code Colors")).toBeInTheDocument();
    expect(screen.getByTestId("input-new-label")).toBeInTheDocument();
    expect(screen.getByTestId("button-add-color")).toBeInTheDocument();
    expect(screen.getByTestId("button-save")).toBeInTheDocument();
  });

  it("shows empty state when no colors configured", () => {
    renderDressCodePage([]);
    expect(screen.getByText(/no colors yet/i)).toBeInTheDocument();
  });

  it("renders existing colors loaded from settings", () => {
    renderDressCodePage([
      { hex: "#FFFFFF", label: "White" },
      { hex: "#000000", label: "Black" },
    ]);
    expect(screen.getByText("White")).toBeInTheDocument();
    expect(screen.getByText("Black")).toBeInTheDocument();
    expect(screen.getByTestId("color-row-0")).toBeInTheDocument();
    expect(screen.getByTestId("color-row-1")).toBeInTheDocument();
  });

  it("Add button is disabled when label input is empty", () => {
    renderDressCodePage();
    expect(screen.getByTestId("button-add-color")).toBeDisabled();
  });

  it("enables Add button when label is typed", () => {
    renderDressCodePage();
    fireEvent.change(screen.getByTestId("input-new-label"), { target: { value: "White" } });
    expect(screen.getByTestId("button-add-color")).not.toBeDisabled();
  });

  it("adds a color to the list and clears the input", () => {
    renderDressCodePage();
    fireEvent.change(screen.getByTestId("input-new-label"), { target: { value: "White" } });
    fireEvent.click(screen.getByTestId("button-add-color"));
    expect(screen.getByText("White")).toBeInTheDocument();
    expect(screen.queryByText(/no colors yet/i)).not.toBeInTheDocument();
    expect(screen.getByTestId("input-new-label")).toHaveValue("");
  });

  it("removes a color when Remove is clicked", () => {
    renderDressCodePage([{ hex: "#FFFFFF", label: "White" }]);
    fireEvent.click(screen.getByTestId("button-remove-0"));
    expect(screen.queryByText("White")).not.toBeInTheDocument();
    expect(screen.getByText(/no colors yet/i)).toBeInTheDocument();
  });
});
