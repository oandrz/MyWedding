// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock framer-motion to avoid animation issues in tests
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    h2: ({ children, ...props }: any) => <h2 {...props}>{children}</h2>,
    h3: ({ children, ...props }: any) => <h3 {...props}>{children}</h3>,
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

// Mock useToast
const mockToast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

import MessageWallSection from "../MessageWallSection";

let originalFetch: typeof global.fetch;

function createMockFetch(messages: any[], total: number) {
  return vi.fn((url: string | URL | Request) => {
    const urlStr = typeof url === "string" ? url : url.toString();
    if (urlStr.includes("/api/messages")) {
      const parsedUrl = new URL(urlStr, "http://localhost");
      const limit = Number(parsedUrl.searchParams.get("limit") || "20");
      const offset = Number(parsedUrl.searchParams.get("offset") || "0");
      const pageMessages = messages.slice(offset, offset + limit);
      return Promise.resolve(
        new Response(
          JSON.stringify({
            messages: pageMessages,
            total,
            limit,
            offset,
          }),
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
}

function renderMessageWallSection() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MessageWallSection />
    </QueryClientProvider>
  );
}

describe("MessageWallSection", () => {
  beforeEach(() => {
    originalFetch = global.fetch;
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("renders messages from API", async () => {
    const messages = [
      { id: 1, name: "Alice", email: "alice@example.com", content: "Congratulations!", created_at: new Date().toISOString() },
      { id: 2, name: "Bob", email: "bob@example.com", content: "Best wishes!", created_at: new Date().toISOString() },
    ];
    global.fetch = createMockFetch(messages, 2);

    renderMessageWallSection();

    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeInTheDocument();
      expect(screen.getByText("Bob")).toBeInTheDocument();
      expect(screen.getByText("Congratulations!")).toBeInTheDocument();
      expect(screen.getByText("Best wishes!")).toBeInTheDocument();
    });
  });

  it("shows 'Load more' when more pages are available", async () => {
    // Create 21 messages but the API returns only 20 per page, total is 21
    const messages = Array.from({ length: 21 }, (_, i) => ({
      id: i + 1,
      name: `Guest ${i + 1}`,
      email: `guest${i + 1}@example.com`,
      content: `Message ${i + 1}`,
      created_at: new Date().toISOString(),
    }));
    global.fetch = createMockFetch(messages, 21);

    renderMessageWallSection();

    await waitFor(() => {
      expect(screen.getByText("Load more")).toBeInTheDocument();
    });
  });

  it("shows empty state when no messages", async () => {
    global.fetch = createMockFetch([], 0);

    renderMessageWallSection();

    await waitFor(() => {
      expect(screen.getByText(/no messages yet/i)).toBeInTheDocument();
      expect(screen.getByText(/be the first to leave a message/i)).toBeInTheDocument();
    });
  });
});
