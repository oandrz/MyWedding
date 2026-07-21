// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock wouter
const mockNavigate = vi.fn();
const mockLocation = "/rsvps";
vi.mock("wouter", () => ({
  useLocation: () => [mockLocation, mockNavigate],
  Switch: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Route: ({ path, children, component: Component }: any) => {
    if (path !== undefined && path !== mockLocation) return null;
    if (Component) return <Component />;
    return <>{children}</>;
  },
  Redirect: ({ to }: { to: string }) => <div data-testid={`redirect-${to}`} />,
  Link: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
}));

// Mock fetch for session validation
const mockFetch = vi.fn();
global.fetch = mockFetch;

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

describe("AdminLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    sessionStorage.clear();
  });

  it("shows loading state while validating session", async () => {
    mockFetch.mockImplementation(() => new Promise(() => {})); // never resolves
    const { AdminLayout } = await import("../AdminLayout");
    renderWithProviders(<AdminLayout />);
    expect(screen.getByTestId("admin-loading")).toBeInTheDocument();
  });

  it("redirects to login on 401", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 401 });
    const { AdminLayout } = await import("../AdminLayout");
    renderWithProviders(<AdminLayout />);
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("~/admin-login", expect.anything());
    });
  });

  it("renders sidebar nav links when authenticated", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ csrfToken: "test-token" }),
    });
    const { AdminLayout } = await import("../AdminLayout");
    renderWithProviders(<AdminLayout />);
    await waitFor(() => {
      expect(screen.getByText("RSVP")).toBeInTheDocument();
    });
    expect(screen.getByText("Messages")).toBeInTheDocument();
    expect(screen.getByText("Configuration")).toBeInTheDocument();
    expect(screen.getByText("Welcome")).toBeInTheDocument();
    expect(screen.getByText("Flags")).toBeInTheDocument();
    expect(screen.getByText("Statistics")).toBeInTheDocument();
  });

  it("stores CSRF token from validation response", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ csrfToken: "new-csrf-token" }),
    });
    const { AdminLayout } = await import("../AdminLayout");
    renderWithProviders(<AdminLayout />);
    await waitFor(() => {
      expect(sessionStorage.getItem("csrfToken")).toBe("new-csrf-token");
    });
  });

  it("logout clears session and redirects", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ csrfToken: "tok" }) }) // validate
      .mockResolvedValueOnce({ ok: true }); // logout
    const { AdminLayout } = await import("../AdminLayout");
    renderWithProviders(<AdminLayout />);
    await waitFor(() => {
      expect(screen.getByText("Logout")).toBeInTheDocument();
    });
    await userEvent.click(screen.getByText("Logout"));
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("~/admin-login", expect.anything());
    });
  });
});
