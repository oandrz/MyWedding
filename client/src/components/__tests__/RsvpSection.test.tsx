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
  // Pre-fill query data so the component doesn't show loading/existing RSVP states
  qc.setQueryData(["/api/rsvp/check", ""], { exists: false, rsvp: null });
  return render(
    <QueryClientProvider client={qc}>
      <RsvpSection />
    </QueryClientProvider>
  );
}

describe("RsvpSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Ensure no "to" URL param is set so guestName stays empty and rsvpCheck is skipped
    Object.defineProperty(window, "location", {
      value: { search: "", href: "http://localhost" },
      writable: true,
    });
  });

  it("renders form fields (name, email, guest count)", () => {
    renderRsvpSection();
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/number of guests/i)).toBeInTheDocument();
  });

  it("shows validation error when required fields are empty", async () => {
    renderRsvpSection();

    // Clear default values and submit
    const nameInput = screen.getByLabelText(/^name$/i);
    fireEvent.change(nameInput, { target: { value: "" } });

    const submitButton = screen.getByTestId("button-submit-rsvp");
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/name is required/i)).toBeInTheDocument();
    });
  });

  it("submits successfully and shows confirmation", async () => {
    // Mock fetch for the RSVP POST endpoint
    const originalFetch = global.fetch;
    global.fetch = vi.fn((url, options) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      if (urlStr.includes("/api/rsvp") && options?.method === "POST") {
        return Promise.resolve(
          new Response(
            JSON.stringify({ message: "Thank you!", rsvp: { id: 1 } }),
            { status: 201, headers: { "Content-Type": "application/json" } }
          )
        );
      }
      // For rsvp check and other queries
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

    // Fill out the form
    fireEvent.change(screen.getByLabelText(/^name$/i), {
      target: { value: "John Doe" },
    });
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "john@example.com" },
    });

    const submitButton = screen.getByTestId("button-submit-rsvp");
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/thank you/i)).toBeInTheDocument();
    });

    global.fetch = originalFetch;
  });
});
