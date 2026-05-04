# Music Autoplay Feature Flag Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `music_autoplay` feature flag that autoplays background music when a guest clicks "Open Invitation" on the WelcomeOverlay, with iOS Safari compatibility via synchronous gesture-chained `audio.play()`.

**Architecture:** `AudioPlayer` is converted to a `forwardRef` component exposing a `startAutoplay()` imperative handle. `App.tsx` holds a ref to that handle and calls it synchronously inside the `WelcomeOverlay` dismiss callback, keeping the browser user-gesture context intact end-to-end. A new `music_autoplay` feature flag (defaulting to `true`) gates whether the dismiss fires autoplay.

**Tech Stack:** React 18 (forwardRef, useImperativeHandle, useCallback, useRef), TypeScript, Go (Chi router, pgx), Vitest + @testing-library/react (frontend), Go testing + net/http/httptest (backend).

**Spec:** `docs/superpowers/specs/2026-05-04-music-autoplay-feature-flag.md`

---

## Chunk 1: Backend — Migration, Memory Seed, and Test Updates

### Task 1: Create SQL Migration

**Files:**
- Create: `go-server/migrations/002_add_music_autoplay_flag.sql`

- [ ] **Step 1: Create the migration file**

```sql
INSERT INTO feature_flags (feature_key, feature_name, description, enabled)
VALUES ('music_autoplay', 'Music Autoplay', 'Autoplay background music when invitation opens', TRUE)
ON CONFLICT (feature_key) DO NOTHING;
```

- [ ] **Step 2: Commit**

```bash
git add go-server/migrations/002_add_music_autoplay_flag.sql
git commit -m "feat: add music_autoplay feature flag migration"
```

---

### Task 2: Add Contract Test, Seed MemoryRepository, Fix Broken Tests

When `NewMemoryRepository()` seeds `music_autoplay`, three existing tests that assert 0 flags will fail. Fix them in this same commit.

**Files:**
- Modify: `go-server/internal/handler/contract_test.go`
- Modify: `go-server/internal/handler/handler_test.go:835`
- Modify: `go-server/internal/repository/memory.go:38-49`

- [ ] **Step 1: Write the failing contract test**

Open `go-server/internal/handler/contract_test.go`. Add this test after the existing `TestContract_FeatureFlagList` function (around line 1034):

```go
// TestContract_FeatureFlagListDefaultSeed verifies music_autoplay is seeded by default.
func TestContract_FeatureFlagListDefaultSeed(t *testing.T) {
	env := newTestEnv()

	req := httptest.NewRequest(http.MethodGet, "/api/feature-flags", nil)
	result := contractResponse(t, env, req, http.StatusOK)

	flags := assertArray(t, result, "featureFlags")
	if len(flags) != 1 {
		t.Fatalf("expected 1 seeded feature flag, got %d", len(flags))
	}

	obj, ok := flags[0].(map[string]interface{})
	if !ok {
		t.Fatal("featureFlags[0] is not an object")
	}
	assertFeatureFlagObject(t, obj)
	assertStringValue(t, obj, "featureKey", "music_autoplay")
	assertBoolValue(t, obj, "enabled", true)
}
```

- [ ] **Step 2: Run the test — expect FAIL**

```bash
cd go-server && go test ./internal/handler -run TestContract_FeatureFlagListDefaultSeed -v
```

Expected output: `FAIL` — `expected 1 seeded feature flag, got 0`

- [ ] **Step 3: Seed music_autoplay in MemoryRepository**

Open `go-server/internal/repository/memory.go`. Replace `NewMemoryRepository()` (lines 38–49):

```go
// NewMemoryRepository creates a new in-memory repository with seeded defaults.
func NewMemoryRepository() *MemoryRepository {
	return &MemoryRepository{
		users:        make(map[int]models.User),
		rsvps:        make(map[int]models.Rsvp),
		media:        make(map[int]models.Media),
		configImages: make(map[int]models.ConfigImage),
		flagIDSeq:    1,
		featureFlags: map[int]models.FeatureFlag{
			1: {
				ID:          1,
				FeatureKey:  "music_autoplay",
				FeatureName: "Music Autoplay",
				Description: "Autoplay background music when invitation opens",
				Enabled:     true,
				UpdatedAt:   now(),
			},
		},
		appSettings:  make(map[int]models.AppSetting),
		messages:     make(map[int]models.Message),
		invites:      make(map[int]models.Invite),
	}
}
```

`flagIDSeq: 1` is required because `CreateFeatureFlag` does `m.flagIDSeq++` before assigning the ID. Without it, calling `CreateFeatureFlag` would produce `ID: 1` and overwrite the seed.

- [ ] **Step 4: Fix TestFeatureFlagList (handler_test.go)**

Open `go-server/internal/handler/handler_test.go`. Find `TestFeatureFlagList` (~line 819). Change:

```go
// OLD
if len(flags) != 0 {
    t.Fatalf("expected 0 flags, got %d", len(flags))
}
```

to:

```go
// NEW — music_autoplay is seeded by NewMemoryRepository
if len(flags) != 1 {
    t.Fatalf("expected 1 seeded flag, got %d", len(flags))
}
```

- [ ] **Step 5: Fix TestContract_FeatureFlagList (contract_test.go)**

Open `go-server/internal/handler/contract_test.go`. Find `TestContract_FeatureFlagList` (~line 1024). Replace the whole function:

```go
func TestContract_FeatureFlagList(t *testing.T) {
	env := newTestEnv()

	req := httptest.NewRequest(http.MethodGet, "/api/feature-flags", nil)
	result := contractResponse(t, env, req, http.StatusOK)

	// music_autoplay is seeded by NewMemoryRepository
	flags := assertArray(t, result, "featureFlags")
	if len(flags) != 1 {
		t.Fatalf("expected 1 seeded feature flag, got %d", len(flags))
	}
}
```

- [ ] **Step 6: Fix TestContract_FeatureFlagListWithData (contract_test.go)**

Find `TestContract_FeatureFlagListWithData` (~line 1036). Change the count assertion from `2` to `3` (seed + 2 created):

```go
// OLD
if len(flags) != 2 {
    t.Fatalf("expected 2 feature flags, got %d", len(flags))
}
```

```go
// NEW — seed adds 1 to the count
if len(flags) != 3 {
    t.Fatalf("expected 3 feature flags (1 seed + 2 created), got %d", len(flags))
}
```

- [ ] **Step 7: Run all Go tests — expect PASS**

```bash
cd go-server && make test
```

Expected: all tests pass with no race conditions.

- [ ] **Step 8: Commit**

```bash
git add go-server/internal/repository/memory.go \
        go-server/internal/handler/contract_test.go \
        go-server/internal/handler/handler_test.go
git commit -m "feat: seed music_autoplay flag in MemoryRepository and fix test counts"
```

---

## Chunk 2: Frontend — Hook, AudioPlayer, WelcomeOverlay, App Wiring

### Task 3: Add useMusicAutoplayEnabled Hook

**Files:**
- Modify: `client/src/hooks/useFeatureFlags.ts`
- Modify: `client/src/hooks/__tests__/useFeatureFlags.test.ts`

- [ ] **Step 1: Write the failing test**

Open `client/src/hooks/__tests__/useFeatureFlags.test.ts`. Add this test inside the existing `describe("useFeatureFlags", ...)` block, after the existing tests:

```ts
it("useMusicAutoplayEnabled returns true when music_autoplay flag is enabled", async () => {
  const mockFlags = {
    featureFlags: [
      { id: 1, featureKey: "music_autoplay", featureName: "Music Autoplay", description: "", enabled: true, updatedAt: "2026-01-01T00:00:00Z" },
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

  const { result } = renderHook(() => useMusicAutoplayEnabled(), {
    wrapper: createWrapper(qc),
  });

  await waitFor(() => {
    expect(result.current).toBe(true);
  });
});

it("useMusicAutoplayEnabled returns false when music_autoplay flag is disabled", async () => {
  const mockFlags = {
    featureFlags: [
      { id: 1, featureKey: "music_autoplay", featureName: "Music Autoplay", description: "", enabled: false, updatedAt: "2026-01-01T00:00:00Z" },
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

  const { result } = renderHook(() => useMusicAutoplayEnabled(), {
    wrapper: createWrapper(qc),
  });

  await waitFor(() => {
    expect(result.current).toBe(false);
  });
});
```

Also add `useMusicAutoplayEnabled` to the import at the top of the test file:

```ts
import { useFeatureFlags, useMusicAutoplayEnabled } from "../useFeatureFlags";
```

- [ ] **Step 2: Run the test — expect FAIL**

```bash
cd /Volumes/Oink_Machine/Intelij/MyWedding && npm run test -- --reporter=verbose client/src/hooks/__tests__/useFeatureFlags.test.ts
```

Expected: FAIL — `useMusicAutoplayEnabled is not a function` (or similar import error).

- [ ] **Step 3: Add the hook**

Open `client/src/hooks/useFeatureFlags.ts`. Add at the end of the file (after `useEGiftEnabled`):

```ts
export function useMusicAutoplayEnabled() {
  const { isFeatureEnabled } = useFeatureFlags();
  return isFeatureEnabled('music_autoplay');
}
```

- [ ] **Step 4: Run the test — expect PASS**

```bash
npm run test -- --reporter=verbose client/src/hooks/__tests__/useFeatureFlags.test.ts
```

Expected: all tests in this file pass.

- [ ] **Step 5: Commit**

```bash
git add client/src/hooks/useFeatureFlags.ts \
        client/src/hooks/__tests__/useFeatureFlags.test.ts
git commit -m "feat: add useMusicAutoplayEnabled hook"
```

---

### Task 4: Refactor AudioPlayer with forwardRef and startAutoplay

**Files:**
- Create: `client/src/components/__tests__/AudioPlayer.test.tsx`
- Modify: `client/src/components/AudioPlayer.tsx`

- [ ] **Step 1: Write the failing tests**

Create `client/src/components/__tests__/AudioPlayer.test.tsx`:

```tsx
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
```

- [ ] **Step 2: Run the tests — expect FAIL**

```bash
npm run test -- --reporter=verbose client/src/components/__tests__/AudioPlayer.test.tsx
```

Expected: FAIL — `AudioPlayerHandle` is not exported, or component does not accept a ref.

- [ ] **Step 3: Refactor AudioPlayer.tsx**

Open `client/src/components/AudioPlayer.tsx`. Replace the entire file content:

```tsx
import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { motion } from 'framer-motion';
import { Volume2, VolumeX } from 'lucide-react';
import { useLocation } from 'wouter';
import { useMusicEnabled } from '@/hooks/useFeatureFlags';
import { useQuery } from '@tanstack/react-query';

export interface AudioPlayerHandle {
  startAutoplay: () => void;
}

const AudioPlayer = forwardRef<AudioPlayerHandle, Record<string, never>>((_, ref) => {
  const isMusicEnabled = useMusicEnabled();
  const [isPlaying, setIsPlaying] = useState(false);
  const audioEl = useRef<HTMLAudioElement>(null);
  const [location] = useLocation();

  const isAdminPage = location.includes('/admin');

  const { data: musicData } = useQuery<{ musicUrl: string }>({
    queryKey: ['/api/settings/music'],
    enabled: !isAdminPage && isMusicEnabled,
  });

  const musicUrl = musicData?.musicUrl || '/music/wedding-piano.mp3';

  useEffect(() => {
    if (audioEl.current && musicUrl) {
      audioEl.current.volume = 0.3;
      audioEl.current.load();
    }
  }, [musicUrl]);

  useImperativeHandle(ref, () => ({
    startAutoplay: () => {
      if (!audioEl.current) return;
      audioEl.current.play()
        .then(() => setIsPlaying(true))
        .catch(() => {});
    },
  }), []);

  const togglePlayPause = () => {
    if (!audioEl.current) return;

    try {
      if (isPlaying) {
        audioEl.current.pause();
        setIsPlaying(false);
      } else {
        const playPromise = audioEl.current.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              setIsPlaying(true);
            })
            .catch(err => {
              console.error("Failed to play audio:", err);
            });
        }
      }
    } catch (error) {
      console.error("Error toggling audio:", error);
    }
  };

  if (isAdminPage || !isMusicEnabled) {
    return null;
  }

  return (
    <>
      <audio
        ref={audioEl}
        src={musicUrl}
        loop
        preload="auto"
      />

      <motion.div
        className="fixed bottom-8 right-8 z-50 flex items-center justify-center bg-primary/80 backdrop-blur-sm border border-white/30 rounded-full p-4 shadow-lg cursor-pointer"
        whileHover={{ scale: 1.1, boxShadow: "0 0 15px rgba(255,255,255,0.5)" }}
        whileTap={{ scale: 0.9 }}
        onClick={togglePlayPause}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
      >
        {isPlaying ? (
          <Volume2 size={24} className="text-white" />
        ) : (
          <VolumeX size={24} className="text-white/70" />
        )}
        <span className="ml-2 text-sm text-white font-montserrat hidden md:inline">
          {isPlaying ? "Stop Music" : "Play Music"}
        </span>
      </motion.div>
    </>
  );
});

AudioPlayer.displayName = 'AudioPlayer';

export default AudioPlayer;
```

- [ ] **Step 4: Run the tests — expect PASS**

```bash
npm run test -- --reporter=verbose client/src/components/__tests__/AudioPlayer.test.tsx
```

Expected: all 2 tests pass.

- [ ] **Step 5: Run TypeScript check**

```bash
npm run check
```

Expected: no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add client/src/components/AudioPlayer.tsx \
        client/src/components/__tests__/AudioPlayer.test.tsx
git commit -m "feat: refactor AudioPlayer with forwardRef and startAutoplay handle"
```

---

### Task 5: Add onDismiss to WelcomeOverlay

**Files:**
- Create: `client/src/components/__tests__/WelcomeOverlay.test.tsx`
- Modify: `client/src/components/WelcomeOverlay.tsx`

- [ ] **Step 1: Write the failing test**

Create `client/src/components/__tests__/WelcomeOverlay.test.tsx`:

```tsx
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

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function wrapper({ children }: { children: React.ReactNode }) {
  return createElement(QueryClientProvider, { client: createTestQueryClient() }, children);
}

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
```

- [ ] **Step 2: Run the test — expect FAIL**

```bash
npm run test -- --reporter=verbose client/src/components/__tests__/WelcomeOverlay.test.tsx
```

Expected: FAIL — `WelcomeOverlay` does not accept an `onDismiss` prop.

- [ ] **Step 3: Add onDismiss prop to WelcomeOverlay.tsx**

Open `client/src/components/WelcomeOverlay.tsx`.

Find the component declaration (line ~17). Add a props interface and update the component signature. The component currently has no props; add:

```tsx
interface WelcomeOverlayProps {
  onDismiss?: () => void;
}

const WelcomeOverlay = ({ onDismiss }: WelcomeOverlayProps) => {
```

Find `handleOpen` (line ~99). Add `onDismiss?.()` as the last line before closing the function:

```tsx
const handleOpen = () => {
  setIsOpen(false);

  if (typeof document !== 'undefined') {
    document.body.style.overflow = "";
  }

  if (typeof window !== 'undefined') {
    sessionStorage.setItem("welcome_overlay_opened", "true");
  }

  onDismiss?.();
};
```

- [ ] **Step 4: Run the test — expect PASS**

```bash
npm run test -- --reporter=verbose client/src/components/__tests__/WelcomeOverlay.test.tsx
```

Expected: test passes.

- [ ] **Step 5: TypeScript check**

```bash
npm run check
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add client/src/components/WelcomeOverlay.tsx \
        client/src/components/__tests__/WelcomeOverlay.test.tsx
git commit -m "feat: add onDismiss prop to WelcomeOverlay"
```

---

### Task 6: Wire App.tsx

**Files:**
- Modify: `client/src/App.tsx`

No new tests for App.tsx itself — the wiring is covered by the tests in Tasks 4 and 5. This task wires everything together.

- [ ] **Step 1: Update App.tsx**

Open `client/src/App.tsx`. Replace the entire file:

```tsx
import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import Home from "@/pages/Home";
import Gallery from "@/pages/Gallery";
import MemoriesGoogleDrive from "@/pages/MemoriesGoogleDrive";
import MemoriesGoogleDriveUpload from "@/pages/MemoriesGoogleDriveUpload";
import GoogleDriveSetup from "@/pages/GoogleDriveSetup";
import GoogleDriveInstructions from "@/pages/GoogleDriveInstructions";
import { AdminLayout } from "@/pages/admin/AdminLayout";
import AdminLogin from "@/pages/AdminLogin";
import NotFound from "@/pages/not-found";
import AudioPlayer, { AudioPlayerHandle } from "@/components/AudioPlayer";
import WelcomeOverlay from "@/components/WelcomeOverlay";
import { useRef, useCallback } from "react";
import { useMusicAutoplayEnabled } from "@/hooks/useFeatureFlags";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/gallery" component={Gallery} />
      <Route path="/memories" component={Gallery} />
      <Route path="/memories-drive" component={MemoriesGoogleDrive} />
      <Route path="/memories-upload" component={MemoriesGoogleDriveUpload} />
      <Route path="/google-drive-setup" component={GoogleDriveSetup} />
      <Route path="/google-drive-instructions" component={GoogleDriveInstructions} />
      <Route path="/admin" nest>
        <AdminLayout />
      </Route>
      <Route path="/admin-dashboard">
        <Redirect to="/admin/rsvps" replace />
      </Route>
      <Route path="/admin-login" component={AdminLogin} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const audioPlayerRef = useRef<AudioPlayerHandle>(null);
  const isMusicAutoplayEnabled = useMusicAutoplayEnabled();

  const handleOverlayDismiss = useCallback(() => {
    if (isMusicAutoplayEnabled) {
      audioPlayerRef.current?.startAutoplay();
    }
  }, [isMusicAutoplayEnabled]);

  return (
    <>
      <WelcomeOverlay onDismiss={handleOverlayDismiss} />
      <Router />
      <AudioPlayer ref={audioPlayerRef} />
      <Toaster />
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}

export default App;
```

`AppContent` is extracted so that `useRef`, `useCallback`, and `useMusicAutoplayEnabled` run inside the `QueryClientProvider` context (required for the hook to work).

- [ ] **Step 2: Run TypeScript check**

```bash
npm run check
```

Expected: no errors.

- [ ] **Step 3: Run all frontend tests**

```bash
npm run test
```

Expected: all tests pass.

- [ ] **Step 4: Run all Go tests**

```bash
cd go-server && make test
```

Expected: all tests pass with race detector.

- [ ] **Step 5: Commit**

```bash
git add client/src/App.tsx
git commit -m "feat: wire music autoplay via WelcomeOverlay dismiss gesture"
```

---

## Manual Verification Checklist

After all tasks are complete, verify the following manually in the browser:

- [ ] `music` flag OFF in admin → no play button visible anywhere
- [ ] `music` ON + `music_autoplay` ON → click "Open Invitation" → music plays immediately, button shows Volume2 icon
- [ ] `music` ON + `music_autoplay` OFF (toggle in admin FlagsPage) → overlay dismiss has no effect on audio; play button still works manually
- [ ] Page refresh after dismissal → play button appears, no autoplay attempt
- [ ] Toggle `music_autoplay` in admin → frontend reflects change within up to 60 seconds
- [ ] Test on iOS Safari: click "Open Invitation" → music plays (validates gesture-chain)

Dev server commands (two terminals):
```bash
# Terminal 1
cd go-server && make run-dev

# Terminal 2
npm run dev
```

Visit: `http://localhost:5173/?to=TestGuest`
