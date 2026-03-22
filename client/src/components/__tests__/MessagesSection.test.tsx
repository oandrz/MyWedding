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
  },
  useInView: () => true,
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Mock useToast
const mockToast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

import MessagesSection from "../MessagesSection";

function renderMessagesSection(messages: any[] = []) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  qc.setQueryData(["/api/messages"], { messages, count: messages.length });
  return render(
    <QueryClientProvider client={qc}>
      <MessagesSection />
    </QueryClientProvider>
  );
}

describe("MessagesSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders form fields (name, content)", () => {
    renderMessagesSection();
    // Labels don't have htmlFor, so find by placeholder text
    expect(screen.getByPlaceholderText(/enter your name/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/write your wishes/i)).toBeInTheDocument();
  });

  it("renders submit button", () => {
    renderMessagesSection();
    expect(screen.getByRole("button", { name: /send wishes/i })).toBeInTheDocument();
  });

  it("shows validation error for empty name", async () => {
    renderMessagesSection();

    // Submit with empty fields
    const submitButton = screen.getByRole("button", { name: /send wishes/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/name must be at least 2 characters/i)).toBeInTheDocument();
    });
  });

  it("shows validation error for empty content", async () => {
    renderMessagesSection();

    // Fill name but leave content empty
    const nameInput = screen.getByPlaceholderText(/enter your name/i);
    fireEvent.change(nameInput, { target: { value: "John Doe" } });

    const submitButton = screen.getByRole("button", { name: /send wishes/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/message must be at least 3 characters/i)).toBeInTheDocument();
    });
  });
});
