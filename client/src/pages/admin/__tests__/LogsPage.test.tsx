// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import LogsPage from "../LogsPage";

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <LogsPage />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      logs: [
        {
          id: 1,
          createdAt: "2026-05-28T10:00:00Z",
          level: "ERROR",
          source: "http",
          message: "boom",
          requestId: "abc",
          method: "POST",
          path: "/api/rsvp",
          status: 500,
          durationMs: 12,
          attrs: { error: "db down" },
        },
      ],
      nextCursor: null,
      droppedCount: 0,
    }),
  }) as unknown as typeof fetch;
});

describe("LogsPage", () => {
  it("renders log rows", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("boom")).toBeInTheDocument());
    expect(screen.getByText("/api/rsvp")).toBeInTheDocument();
  });

  it("shows empty state when no logs", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ logs: [], nextCursor: null, droppedCount: 0 }),
    });
    renderPage();
    await waitFor(() =>
      expect(screen.getByText(/no logs captured/i)).toBeInTheDocument()
    );
  });

  it("shows dropped banner when droppedCount > 0", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ logs: [], nextCursor: null, droppedCount: 5 }),
    });
    renderPage();
    await waitFor(() =>
      expect(screen.getByText(/5 .*dropped/i)).toBeInTheDocument()
    );
  });

  it("clicking a row loads the request trace", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByText("boom")).toBeInTheDocument());
    await user.click(screen.getByText("boom"));
    const traceBtn = await screen.findByText(/view trace/i);
    await user.click(traceBtn);
    await waitFor(() =>
      expect(
        (global.fetch as any).mock.calls.some((c: any[]) =>
          String(c[0]).includes("/api/admin/logs/abc")
        )
      ).toBe(true)
    );
    expect(screen.getByText(/back to all logs/i)).toBeInTheDocument();
  });

  it("shows the full message in the expanded panel", async () => {
    const longMessage =
      "failed to connect to upstream payment gateway: dial tcp 10.0.3.2:443: i/o timeout after 3 retries while processing order 8842";
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        logs: [
          {
            id: 1,
            createdAt: "2026-05-28T10:00:00Z",
            level: "ERROR",
            source: "http",
            message: longMessage,
            requestId: "abc",
            method: "POST",
            path: "/api/pay",
            status: 500,
            durationMs: 12,
            attrs: { error: "db down" },
          },
        ],
        nextCursor: null,
        droppedCount: 0,
      }),
    });

    const user = userEvent.setup();
    renderPage();

    const row = await screen.findByText(longMessage);
    await user.click(row);

    const fullMessage = await screen.findByTestId("log-full-message");
    expect(fullMessage).toHaveTextContent(longMessage);
  });
});
