// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import WelcomeOverlay, { _resetOverlayLoadState } from "../WelcomeOverlay";

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => {
      const { initial, animate, exit, transition, whileHover, whileTap, ...htmlProps } = props;
      return <div {...htmlProps}>{children}</div>;
    },
    h1: ({ children, ...props }: any) => {
      const { initial, animate, transition, ...htmlProps } = props;
      return <h1 {...htmlProps}>{children}</h1>;
    },
    h2: ({ children, ...props }: any) => {
      const { initial, animate, transition, ...htmlProps } = props;
      return <h2 {...htmlProps}>{children}</h2>;
    },
    p: ({ children, ...props }: any) => {
      const { initial, animate, transition, ...htmlProps } = props;
      return <p {...htmlProps}>{children}</p>;
    },
    button: ({ children, ...props }: any) => {
      const { whileHover, whileTap, initial, animate, transition, ...htmlProps } = props;
      return <button {...htmlProps}>{children}</button>;
    },
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

vi.mock("wouter", () => ({
  useLocation: () => ["/", vi.fn()],
}));

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        queryFn: async ({ queryKey }) => {
          const key = queryKey[0] as string;
          if (key.includes("welcome-screen")) {
            return {
              welcomeScreen: {
                enabled: true,
                headingText: "You Are Invited",
                deliveryLabel: "Dear",
                fallbackName: "Guest",
              },
            };
          }
          return null;
        },
      },
    },
  });
}

function wrapper({ children }: { children: React.ReactNode }) {
  return createElement(QueryClientProvider, { client: makeQueryClient() }, children);
}

beforeEach(() => {
  _resetOverlayLoadState();
});

describe("WelcomeOverlay", () => {
  it("calls onDismiss when Open Invitation button is clicked", async () => {
    const onDismiss = vi.fn();
    render(<WelcomeOverlay onDismiss={onDismiss} />, { wrapper });

    const button = await screen.findByText("Open Invitation");
    fireEvent.click(button);

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("does not show overlay again after dismiss within the same session", async () => {
    // First render: overlay should show
    const { unmount } = render(<WelcomeOverlay />, { wrapper });
    await screen.findByText("Open Invitation");

    // Dismiss — sets hasShownThisLoad = true
    fireEvent.click(screen.getByText("Open Invitation"));
    unmount();

    // Second render without resetting module state (simulates SPA navigation back to home)
    render(<WelcomeOverlay />, { wrapper });

    await waitFor(() => {
      expect(screen.queryByTestId("welcome-overlay")).not.toBeInTheDocument();
    });
  });
});
