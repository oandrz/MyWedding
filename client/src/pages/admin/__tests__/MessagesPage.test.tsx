// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockAutoLogout = vi.fn();
vi.mock("../AdminContext", () => ({
  useAdminContext: () => ({ handleAutoLogout: mockAutoLogout }),
}));

vi.mock("wouter", () => ({
  useLocation: () => ["/messages", vi.fn()],
}));

import MessagesPage from "../MessagesPage";

const mockMessages = {
  messages: [
    { id: 1, name: "Alice", email: "alice@test.com", content: "Congrats!", createdAt: "2026-03-20T10:00:00Z" },
    { id: 2, name: "Bob", email: "bob@test.com", content: "So happy for you!", createdAt: "2026-03-20T11:00:00Z" },
  ],
};

function renderMessagesPage(data: any = mockMessages) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  qc.setQueryData(["/api/messages"], data);
  return render(
    <QueryClientProvider client={qc}><MessagesPage /></QueryClientProvider>
  );
}

describe("MessagesPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders message list with names and content", () => {
    renderMessagesPage();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Congrats!")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("So happy for you!")).toBeInTheDocument();
  });

  it("shows total message count", () => {
    renderMessagesPage();
    expect(screen.getByText("Total messages: 2")).toBeInTheDocument();
  });

  it("shows empty state when no messages", () => {
    renderMessagesPage({ messages: [] });
    expect(screen.getByText("No messages yet")).toBeInTheDocument();
  });

  it("shows delete confirmation on trash click", async () => {
    renderMessagesPage();
    const trashButtons = screen.getAllByRole("button");
    const deleteBtn = trashButtons.find(btn => btn.querySelector(".lucide-trash2"));
    if (deleteBtn) await userEvent.click(deleteBtn);
    expect(screen.getByText("Confirm")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });
});
