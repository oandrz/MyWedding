// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockAutoLogout = vi.fn();
vi.mock("../AdminContext", () => ({
  useAdminContext: () => ({ handleAutoLogout: mockAutoLogout }),
}));

const mockToast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

import RsvpSettingsPage from "../RsvpSettingsPage";

function renderPage(settings: any[] = []) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  qc.setQueryData(["/api/app-settings"], { settings });
  return render(
    <QueryClientProvider client={qc}>
      <RsvpSettingsPage />
    </QueryClientProvider>
  );
}

describe("RsvpSettingsPage – max guests", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders max guests heading, input, and save button", () => {
    renderPage();
    expect(screen.getByText("Max Guests per RSVP")).toBeInTheDocument();
    expect(screen.getByTestId("input-rsvp-max-guests")).toBeInTheDocument();
    expect(screen.getByTestId("button-save-rsvp-max-guests")).toBeInTheDocument();
  });

  it("defaults to 4 when rsvp_max_guests setting is absent", () => {
    renderPage([]);
    expect(screen.getByTestId("input-rsvp-max-guests")).toHaveValue(4);
  });

  it("shows current value from settings", () => {
    renderPage([
      { settingKey: "rsvp_max_guests", settingValue: "6", settingType: "number", description: null, updatedAt: "" },
    ]);
    expect(screen.getByTestId("input-rsvp-max-guests")).toHaveValue(6);
  });

  it("save button is disabled when input is empty", () => {
    renderPage();
    fireEvent.change(screen.getByTestId("input-rsvp-max-guests"), { target: { value: "" } });
    expect(screen.getByTestId("button-save-rsvp-max-guests")).toBeDisabled();
  });

  it("save button is disabled when value is out of range (0 or above 20)", () => {
    renderPage();
    fireEvent.change(screen.getByTestId("input-rsvp-max-guests"), { target: { value: "0" } });
    expect(screen.getByTestId("button-save-rsvp-max-guests")).toBeDisabled();

    fireEvent.change(screen.getByTestId("input-rsvp-max-guests"), { target: { value: "21" } });
    expect(screen.getByTestId("button-save-rsvp-max-guests")).toBeDisabled();
  });

  it("calls bulk update API with rsvp_max_guests when Save is clicked", async () => {
    let capturedBody: any;
    const originalFetch = global.fetch;
    global.fetch = vi.fn((url, options) => {
      if (url.toString().includes("/api/admin/app-settings/bulk")) {
        capturedBody = JSON.parse(options!.body as string);
        return Promise.resolve(new Response(
          JSON.stringify({ updated: [] }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        ));
      }
      return Promise.resolve(new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } }));
    }) as any;

    renderPage([
      { settingKey: "rsvp_max_guests", settingValue: "4", settingType: "number", description: null, updatedAt: "" },
    ]);

    fireEvent.change(screen.getByTestId("input-rsvp-max-guests"), { target: { value: "5" } });
    fireEvent.click(screen.getByTestId("button-save-rsvp-max-guests"));

    await waitFor(() => {
      expect(capturedBody).toBeDefined();
      expect(capturedBody.settings[0].settingKey).toBe("rsvp_max_guests");
      expect(capturedBody.settings[0].settingValue).toBe("5");
    });

    global.fetch = originalFetch;
  });
});
