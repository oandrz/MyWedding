// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, createRef } from "react";
import AudioPlayer, { AudioPlayerHandle } from "../AudioPlayer";

// Mock framer-motion
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => {
      const { whileHover, whileTap, initial, animate, transition, ...htmlProps } = props;
      return <div {...htmlProps}>{children}</div>;
    },
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Mock wouter
vi.mock("wouter", () => ({
  useLocation: () => ["/", vi.fn()],
}));

// Mock useFeatureFlags
vi.mock("@/hooks/useFeatureFlags", () => ({
  useMusicEnabled: () => true,
}));

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        queryFn: async () => ({ musicUrl: "/music/test.mp3" }),
      },
    },
  });
}

function wrapper({ children }: { children: React.ReactNode }) {
  return createElement(QueryClientProvider, { client: createTestQueryClient() }, children);
}

describe("AudioPlayer", () => {
  beforeEach(() => {
    // Mock HTMLMediaElement methods (jsdom does not implement audio playback)
    Object.defineProperty(HTMLMediaElement.prototype, "load", {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });
  });

  it("startAutoplay calls audio.play and sets playing state on success", async () => {
    const playMock = vi.fn(() => Promise.resolve());
    Object.defineProperty(HTMLMediaElement.prototype, "play", {
      configurable: true,
      writable: true,
      value: playMock,
    });

    const ref = createRef<AudioPlayerHandle>();
    render(<AudioPlayer ref={ref} />, { wrapper });

    await act(async () => {
      ref.current?.startAutoplay();
    });

    expect(playMock).toHaveBeenCalledTimes(1);
  });

  it("startAutoplay silently catches audio.play rejection", async () => {
    const playMock = vi.fn(() => Promise.reject(new Error("NotAllowedError")));
    Object.defineProperty(HTMLMediaElement.prototype, "play", {
      configurable: true,
      writable: true,
      value: playMock,
    });

    const ref = createRef<AudioPlayerHandle>();
    render(<AudioPlayer ref={ref} />, { wrapper });

    // Should not throw
    await act(async () => {
      ref.current?.startAutoplay();
    });

    expect(playMock).toHaveBeenCalledTimes(1);
  });
});
