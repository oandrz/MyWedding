// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock framer-motion to avoid animation issues in tests
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    h2: ({ children, ...props }: any) => <h2 {...props}>{children}</h2>,
    p: ({ children, ...props }: any) => <p {...props}>{children}</p>,
    form: ({ children, onSubmit, ...props }: any) => (
      <form onSubmit={onSubmit} {...props}>{children}</form>
    ),
    button: ({ children, ...props }: any) => {
      const { whileHover, whileTap, ...htmlProps } = props;
      return <button {...htmlProps}>{children}</button>;
    },
    section: ({ children, ...props }: any) => <section {...props}>{children}</section>,
  },
  useInView: () => true,
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Mock canvas-confetti
vi.mock("canvas-confetti", () => ({
  default: vi.fn(),
}));

// Mock useToast
const mockToast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

import RsvpSection from "../RsvpSection";

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function renderRsvpSection() {
  const qc = createTestQueryClient();
  qc.setQueryData(["/api/rsvp/check", ""], { exists: false, rsvp: null });
  qc.setQueryData(["/api/feature-flags"], {
    featureFlags: [{ id: 1, featureKey: "rsvp", featureName: "RSVP", description: "", enabled: true, updatedAt: "" }],
  });
  return render(
    <QueryClientProvider client={qc}>
      <RsvpSection />
    </QueryClientProvider>
  );
}

function renderWithDeadline(pastDeadline: boolean) {
  const qc = createTestQueryClient();
  const offsetMs = pastDeadline ? -86400000 : 86400000; // -1 day or +1 day
  const deadline = new Date(Date.now() + offsetMs).toISOString().split('T')[0];

  qc.setQueryData(["/api/rsvp/check", ""], { exists: false, rsvp: null });
  qc.setQueryData(["/api/feature-flags"], {
    featureFlags: [{ id: 1, featureKey: "rsvp", featureName: "RSVP", description: "", enabled: true, updatedAt: "" }],
  });
  qc.setQueryData(["/api/app-settings"], {
    settings: [{ id: 1, settingKey: "rsvp_deadline", settingValue: deadline, settingType: "date", description: null, updatedAt: "" }],
  });

  return render(
    <QueryClientProvider client={qc}>
      <RsvpSection />
    </QueryClientProvider>
  );
}

describe("RsvpSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, "location", {
      value: { search: "", href: "http://localhost" },
      writable: true,
    });
  });

  it("renders form fields (name, phone, guest count)", () => {
    renderRsvpSection();
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/phone/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/number of guests/i)).toBeInTheDocument();
  });

  it("renders attendance type pill buttons", () => {
    renderRsvpSection();
    expect(screen.getByRole("button", { name: /both/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /holy matrimony/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reception/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /decline/i })).toBeInTheDocument();
  });

  it("hides guest count when Decline is selected", async () => {
    renderRsvpSection();
    const declineBtn = screen.getByRole("button", { name: /decline/i });
    fireEvent.click(declineBtn);
    await waitFor(() => {
      expect(screen.queryByLabelText(/number of guests/i)).not.toBeInTheDocument();
    });
  });

  it("shows guest count for non-decline attendance types", () => {
    renderRsvpSection();
    // "Both" is default, guest count should be visible
    expect(screen.getByLabelText(/number of guests/i)).toBeInTheDocument();
  });

  it("shows validation error when required fields are empty", async () => {
    renderRsvpSection();
    const nameInput = screen.getByLabelText(/^name$/i);
    fireEvent.change(nameInput, { target: { value: "" } });
    const submitButton = screen.getByTestId("button-submit-rsvp");
    fireEvent.click(submitButton);
    await waitFor(() => {
      expect(screen.getByText(/name is required/i)).toBeInTheDocument();
    });
  });

  it("submits with attendanceType in payload", async () => {
    let capturedBody: any;
    const originalFetch = global.fetch;
    global.fetch = vi.fn((url, options) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      if (urlStr.includes("/api/rsvp") && options?.method === "POST") {
        capturedBody = JSON.parse(options.body as string);
        return Promise.resolve(
          new Response(
            JSON.stringify({ message: "Thank you!", rsvp: { id: 1, attendanceType: "both" } }),
            { status: 201, headers: { "Content-Type": "application/json" } }
          )
        );
      }
      if (urlStr.includes("/api/rsvp/check")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({ exists: false, rsvp: null }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        );
      }
      return Promise.resolve(
        new Response(JSON.stringify({}), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );
    }) as any;

    renderRsvpSection();

    fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: "John Doe" } });
    fireEvent.change(screen.getByLabelText(/phone/i), { target: { value: "+6281234567890" } });

    const submitButton = screen.getByTestId("button-submit-rsvp");
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(capturedBody).toBeDefined();
      expect(capturedBody.attendanceType).toBe("both");
      expect(capturedBody.phone).toBe("+6281234567890");
      expect(capturedBody).not.toHaveProperty("email");
      expect(capturedBody).not.toHaveProperty("attending");
    });

    global.fetch = originalFetch;
  });

  it("shows closed message when rsvp_deadline is in the past", async () => {
    renderWithDeadline(true);
    await waitFor(() => {
      expect(screen.getByText(/rsvp is now closed/i)).toBeInTheDocument();
    });
    expect(screen.queryByTestId("button-submit-rsvp")).not.toBeInTheDocument();
  });

  it("shows form when rsvp_deadline is in the future", async () => {
    renderWithDeadline(false);
    await waitFor(() => {
      expect(screen.getByTestId("button-submit-rsvp")).toBeInTheDocument();
    });
    expect(screen.queryByText(/rsvp is now closed/i)).not.toBeInTheDocument();
  });

  it("shows closed toast when submit returns 403", async () => {
    const qc = createTestQueryClient();
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    qc.setQueryData(["/api/rsvp/check", ""], { exists: false, rsvp: null });
    qc.setQueryData(["/api/feature-flags"], {
      featureFlags: [{ id: 1, featureKey: "rsvp", featureName: "RSVP", description: "", enabled: true, updatedAt: "" }],
    });
    qc.setQueryData(["/api/app-settings"], {
      settings: [{ id: 1, settingKey: "rsvp_deadline", settingValue: tomorrow, settingType: "date", description: null, updatedAt: "" }],
    });

    const originalFetch = global.fetch;
    global.fetch = vi.fn((url, options) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      if (urlStr.includes("/api/rsvp") && options?.method === "POST") {
        return Promise.resolve(
          new Response(
            JSON.stringify({ error: { message: "RSVP submissions are closed", code: "FORBIDDEN" } }),
            { status: 403, headers: { "Content-Type": "application/json" } }
          )
        );
      }
      return Promise.resolve(
        new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } })
      );
    }) as any;

    render(
      <QueryClientProvider client={qc}>
        <RsvpSection />
      </QueryClientProvider>
    );

    fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: "John" } });
    fireEvent.change(screen.getByLabelText(/phone/i), { target: { value: "+6281234567890" } });
    fireEvent.click(screen.getByTestId("button-submit-rsvp"));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "RSVP Closed" })
      );
    });

    global.fetch = originalFetch;
  });
});
