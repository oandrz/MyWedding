// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { apiRequest, getQueryFn } from "../queryClient";

describe("apiRequest", () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("throws with structured error message on 4xx", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            error: { message: "Validation failed", code: "VALIDATION_ERROR" },
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        )
      )
    ) as any;

    await expect(apiRequest("POST", "/api/rsvp", { name: "" })).rejects.toThrow(
      "Validation failed"
    );
  });

  it("throws generic message when error body has no message", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve(
        new Response("Not Found", {
          status: 404,
          headers: { "Content-Type": "text/plain" },
        })
      )
    ) as any;

    await expect(apiRequest("GET", "/api/nonexistent")).rejects.toThrow(
      "Request failed with status 404"
    );
  });
});

describe("getQueryFn", () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns parsed data on success", async () => {
    const mockData = { featureFlags: [{ id: 1, featureKey: "rsvp", enabled: true }] };

    global.fetch = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify(mockData), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    ) as any;

    const queryFn = getQueryFn({ on401: "throw" });
    const result = await queryFn({
      queryKey: ["/api/feature-flags"],
      signal: new AbortController().signal,
      meta: undefined,
    } as any);

    expect(result).toEqual(mockData);
  });

  it("returns null on 401 when on401 is 'returnNull'", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ error: { message: "Unauthorized" } }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        })
      )
    ) as any;

    const queryFn = getQueryFn({ on401: "returnNull" });
    const result = await queryFn({
      queryKey: ["/api/auth/user"],
      signal: new AbortController().signal,
      meta: undefined,
    } as any);

    expect(result).toBeNull();
  });

  it("throws on 401 when on401 is 'throw'", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ error: { message: "Unauthorized" } }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        })
      )
    ) as any;

    const queryFn = getQueryFn({ on401: "throw" });

    await expect(
      queryFn({
        queryKey: ["/api/auth/user"],
        signal: new AbortController().signal,
        meta: undefined,
      } as any)
    ).rejects.toThrow("Unauthorized");
  });
});
