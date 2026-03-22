// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { useFeatureFlags } from "../useFeatureFlags";

function createWrapper(queryClient: QueryClient) {
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("useFeatureFlags", () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("returns correct flag values from API response", async () => {
    const mockFlags = {
      featureFlags: [
        { id: 1, featureKey: "rsvp_enabled", featureName: "RSVP", description: "", enabled: true, updatedAt: "2026-01-01T00:00:00Z" },
        { id: 2, featureKey: "gallery_enabled", featureName: "Gallery", description: "", enabled: false, updatedAt: "2026-01-01T00:00:00Z" },
      ],
    };

    global.fetch = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify(mockFlags), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    ) as any;

    // Use a queryFn that mirrors the real app's default
    const qc = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          queryFn: async ({ queryKey }) => {
            const res = await fetch(queryKey[0] as string, { credentials: "include" });
            if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
            return res.json();
          },
        },
      },
    });

    const { result } = renderHook(() => useFeatureFlags(), {
      wrapper: createWrapper(qc),
    });

    await waitFor(() => {
      expect(result.current.featureFlags).toHaveLength(2);
    });

    expect(result.current.isFeatureEnabled("rsvp_enabled")).toBe(true);
    expect(result.current.isFeatureEnabled("gallery_enabled")).toBe(false);
    expect(result.current.getFeatureFlag("rsvp_enabled")?.featureName).toBe("RSVP");
  });

  it("returns defaults on API error", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ error: { message: "Server error" } }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        })
      )
    ) as any;

    const qc = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          queryFn: async ({ queryKey }) => {
            const res = await fetch(queryKey[0] as string, { credentials: "include" });
            if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
            return res.json();
          },
        },
      },
    });

    const { result } = renderHook(() => useFeatureFlags(), {
      wrapper: createWrapper(qc),
    });

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });

    // When data is not available, isFeatureEnabled defaults to true
    expect(result.current.isFeatureEnabled("rsvp_enabled")).toBe(true);
    expect(result.current.isFeatureEnabled("nonexistent_feature")).toBe(true);
    expect(result.current.featureFlags).toEqual([]);
  });
});
