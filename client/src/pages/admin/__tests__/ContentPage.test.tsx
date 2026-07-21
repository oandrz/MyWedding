// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ContentPage from "../ContentPage";
import { AdminContext } from "../AdminContext";
import { CONTENT_REGISTRY } from "@/content/registry";

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  // Empty overrides response.
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ overrides: [] }),
  }) as unknown as typeof fetch;
  return render(
    <QueryClientProvider client={qc}>
      <AdminContext.Provider value={{ handleAutoLogout: vi.fn() }}>
        <ContentPage />
      </AdminContext.Provider>
    </QueryClientProvider>
  );
}

describe("ContentPage", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("renders an input for a known field with its default value", async () => {
    renderPage();
    // Field: hero.saveTheDate (en) — default "Save the Date"
    const input = await screen.findByTestId("content-hero.saveTheDate-en");
    expect((input as HTMLInputElement).value).toBe("Save the Date");
  });

  it("renders every registry field", async () => {
    renderPage();
    // At least one input per bilingual field's en locale.
    const firstBilingual = CONTENT_REGISTRY.find((f) => f.bilingual)!;
    expect(await screen.findByTestId(`content-${firstBilingual.key}-en`)).toBeTruthy();
  });
});
