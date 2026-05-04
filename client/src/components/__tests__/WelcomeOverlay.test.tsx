// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import WelcomeOverlay from "../WelcomeOverlay";

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

describe("WelcomeOverlay", () => {
  it("calls onDismiss when Open Invitation button is clicked", async () => {
    const onDismiss = vi.fn();

    // Mock the welcome screen API to return enabled screen
    const qc = new QueryClient({
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

    const wrapperWithQc = ({ children }: { children: React.ReactNode }) =>
      createElement(QueryClientProvider, { client: qc }, children);

    render(<WelcomeOverlay onDismiss={onDismiss} />, { wrapper: wrapperWithQc });

    // Wait for overlay to appear and click the button
    const button = await screen.findByText("Open Invitation");
    fireEvent.click(button);

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
