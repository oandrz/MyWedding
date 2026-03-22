# Gallery Carousel Redesign — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the masonry grid gallery with a sliding portrait-card carousel that auto-scrolls at an admin-configurable interval.

**Architecture:** Rewrite `GallerySection.tsx` to use the existing shadcn Carousel (Embla) with the `embla-carousel-autoplay` plugin. Add a `gallery_carousel_interval` key to `app_settings` via a new migration. Add an interval input to the admin ConfigPage. Retain the existing fullscreen image viewer.

**Tech Stack:** React 18, Embla Carousel + Autoplay, Framer Motion, TanStack Query, Go/Chi, shadcn/ui, Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-03-22-gallery-carousel-redesign.md`

---

## Chunk 1: Backend — Migration & Contract Tests

### Task 1: Add migration for gallery_carousel_interval setting

**Files:**
- Create: `go-server/migrations/002_gallery_carousel_interval.sql`

- [ ] **Step 1: Create the migration file**

```sql
INSERT INTO app_settings (setting_key, setting_value, setting_type, description)
VALUES ('gallery_carousel_interval', '4000', 'number', 'Gallery carousel auto-scroll interval in milliseconds')
ON CONFLICT (setting_key) DO NOTHING;
```

- [ ] **Step 2: Verify migration syntax**

Run: `cd go-server && grep -c 'gallery_carousel_interval' migrations/002_gallery_carousel_interval.sql`
Expected: `1`

- [ ] **Step 3: Commit**

```bash
git add go-server/migrations/002_gallery_carousel_interval.sql
git commit -m "feat: add migration for gallery carousel interval setting"
```

---

### Task 2: Write contract test for gallery_carousel_interval

**Files:**
- Modify: `go-server/internal/handler/contract_test.go`

This test seeds a `gallery_carousel_interval` setting via the repo, then verifies it appears in the `GET /api/app-settings` response with correct structure. It also tests that the bulk update endpoint can modify the setting.

- [ ] **Step 1: Write the contract test — read via GET**

Add at the end of the app settings test section (after `TestContract_AppSettingBulkUpdate_Upsert`):

```go
func TestContract_AppSettingCarouselInterval(t *testing.T) {
	env := newTestEnv()

	// Seed the gallery carousel interval setting
	env.repo.CreateAppSetting(nil, struct {
		SettingKey   string  `json:"settingKey"`
		SettingValue string  `json:"settingValue"`
		SettingType  string  `json:"settingType"`
		Description  *string `json:"description"`
	}{
		SettingKey:   "gallery_carousel_interval",
		SettingValue: "4000",
		SettingType:  "number",
	})

	req := httptest.NewRequest(http.MethodGet, "/api/app-settings", nil)
	result := contractResponse(t, env, req, http.StatusOK)

	settings := assertArray(t, result, "settings")
	if len(settings) != 1 {
		t.Fatalf("expected 1 setting, got %d", len(settings))
	}

	obj := settings[0].(map[string]interface{})
	assertAppSettingObject(t, obj)
	assertStringValue(t, obj, "settingKey", "gallery_carousel_interval")
	assertStringValue(t, obj, "settingValue", "4000")
	assertStringValue(t, obj, "settingType", "number")
}
```

- [ ] **Step 2: Run test to verify it passes**

Run: `cd go-server && go test ./internal/handler -run TestContract_AppSettingCarouselInterval -v`
Expected: PASS (this uses existing infrastructure; the repo and endpoints already support arbitrary settings)

- [ ] **Step 3: Write the contract test — update via bulk PATCH**

```go
func TestContract_AppSettingCarouselIntervalUpdate(t *testing.T) {
	env := newTestEnv()
	cookie, csrf := adminLogin(t, env)

	// Create initial setting
	body := jsonBody(map[string]interface{}{
		"settings": []map[string]interface{}{
			{"settingKey": "gallery_carousel_interval", "settingValue": "4000", "settingType": "number"},
		},
	})
	req := adminRequest(http.MethodPatch, "/api/admin/app-settings/bulk", body, cookie, csrf)
	contractResponse(t, env, req, http.StatusOK)

	// Update to new value
	body2 := jsonBody(map[string]interface{}{
		"settings": []map[string]interface{}{
			{"settingKey": "gallery_carousel_interval", "settingValue": "6000", "settingType": "number"},
		},
	})
	req2 := adminRequest(http.MethodPatch, "/api/admin/app-settings/bulk", body2, cookie, csrf)
	contractResponse(t, env, req2, http.StatusOK)

	// Verify updated value via GET
	getReq := httptest.NewRequest(http.MethodGet, "/api/app-settings", nil)
	getResult := contractResponse(t, env, getReq, http.StatusOK)
	settings := assertArray(t, getResult, "settings")

	found := false
	for _, s := range settings {
		obj := s.(map[string]interface{})
		if obj["settingKey"] == "gallery_carousel_interval" {
			assertStringValue(t, obj, "settingValue", "6000")
			found = true
		}
	}
	if !found {
		t.Fatal("Expected to find gallery_carousel_interval setting after update")
	}
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd go-server && go test ./internal/handler -run TestContract_AppSettingCarouselInterval -v`
Expected: PASS (both tests — the existing bulk update infrastructure supports this)

- [ ] **Step 5: Run full test suite to ensure no regressions**

Run: `cd go-server && make test`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add go-server/internal/handler/contract_test.go
git commit -m "test: add contract tests for gallery carousel interval setting"
```

---

## Chunk 2: Frontend — Install Dependency & Rewrite GallerySection

### Task 3: Install embla-carousel-autoplay

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the autoplay plugin**

Run: `npm install embla-carousel-autoplay`

- [ ] **Step 2: Verify installation**

Run: `grep embla-carousel-autoplay package.json`
Expected: Shows the package with version number

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add embla-carousel-autoplay dependency"
```

Note: If the project uses pnpm, use `pnpm add embla-carousel-autoplay` instead and commit `pnpm-lock.yaml`.

---

### Task 4: Write frontend tests for GallerySection carousel (TDD)

**Files:**
- Create: `client/src/components/__tests__/GallerySection.test.tsx`

These tests are written **before** the carousel implementation. They will initially fail against the current masonry grid code (which doesn't render a carousel). After the carousel implementation (Task 5), they must pass.

- [ ] **Step 1: Create the test file**

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock framer-motion to avoid animation issues in tests
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    h2: ({ children, ...props }: any) => <h2 {...props}>{children}</h2>,
    p: ({ children, ...props }: any) => <p {...props}>{children}</p>,
  },
  useInView: () => true,
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Mock embla-carousel-autoplay
const mockAutoplay = vi.fn(() => ({
  name: "autoplay",
  init: vi.fn(),
  destroy: vi.fn(),
}));
vi.mock("embla-carousel-autoplay", () => ({
  default: (...args: any[]) => mockAutoplay(...args),
}));

import GallerySection from "../GallerySection";

const MOCK_GALLERY_IMAGES = [
  { id: 1, imageUrl: "https://example.com/img1.jpg", title: "Photo 1", description: "", category: "gallery", displayOrder: 1 },
  { id: 2, imageUrl: "https://example.com/img2.jpg", title: "Photo 2", description: "", category: "gallery", displayOrder: 2 },
  { id: 3, imageUrl: "https://example.com/img3.jpg", title: "Photo 3", description: "", category: "gallery", displayOrder: 3 },
];

function renderGallerySection(
  images: any[] = MOCK_GALLERY_IMAGES,
  settings: any[] = []
) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  qc.setQueryData(["/api/config-images/gallery"], { images });
  qc.setQueryData(["/api/app-settings"], { settings });
  return render(
    <QueryClientProvider client={qc}>
      <GallerySection />
    </QueryClientProvider>
  );
}

describe("GallerySection — Carousel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders carousel with correct number of slides", () => {
    renderGallerySection();
    expect(screen.getByTestId("gallery-carousel")).toBeInTheDocument();
    expect(screen.getByTestId("gallery-image-0")).toBeInTheDocument();
    expect(screen.getByTestId("gallery-image-1")).toBeInTheDocument();
    expect(screen.getByTestId("gallery-image-2")).toBeInTheDocument();
  });

  it("passes autoplay plugin with interval from app settings", () => {
    const settings = [
      { settingKey: "gallery_carousel_interval", settingValue: "6000", settingType: "number" },
    ];
    renderGallerySection(MOCK_GALLERY_IMAGES, settings);
    expect(mockAutoplay).toHaveBeenCalledWith(
      expect.objectContaining({ delay: 6000 })
    );
  });

  it("uses default interval (4000ms) when setting is missing", () => {
    renderGallerySection(MOCK_GALLERY_IMAGES, []);
    expect(mockAutoplay).toHaveBeenCalledWith(
      expect.objectContaining({ delay: 4000 })
    );
  });

  it("falls back to default when interval is invalid", () => {
    const settings = [
      { settingKey: "gallery_carousel_interval", settingValue: "not-a-number", settingType: "number" },
    ];
    renderGallerySection(MOCK_GALLERY_IMAGES, settings);
    expect(mockAutoplay).toHaveBeenCalledWith(
      expect.objectContaining({ delay: 4000 })
    );
  });

  it("opens fullscreen viewer when clicking a carousel card", () => {
    renderGallerySection();
    fireEvent.click(screen.getByTestId("gallery-image-0"));
    expect(screen.getByTestId("fullsize-image")).toBeInTheDocument();
    expect(screen.getByTestId("close-image-viewer")).toBeInTheDocument();
  });

  it("renders with GALLERY_PHOTOS fallback when API returns empty", () => {
    renderGallerySection([]);
    // Should still render carousel with fallback photos
    expect(screen.getByTestId("gallery-carousel")).toBeInTheDocument();
  });

  it("renders dot indicators matching image count", () => {
    renderGallerySection();
    expect(screen.getByTestId("carousel-dot-0")).toBeInTheDocument();
    expect(screen.getByTestId("carousel-dot-1")).toBeInTheDocument();
    expect(screen.getByTestId("carousel-dot-2")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run client/src/components/__tests__/GallerySection.test.tsx`
Expected: FAIL — the current GallerySection uses a masonry grid, not a carousel, so `data-testid="gallery-carousel"` won't be found

- [ ] **Step 3: Commit the failing tests**

```bash
git add client/src/components/__tests__/GallerySection.test.tsx
git commit -m "test: add failing carousel tests for GallerySection (TDD)"
```

---

### Task 5: Rewrite GallerySection — carousel with autoplay

**Files:**
- Modify: `client/src/components/GallerySection.tsx`

This is the main task. Replace the masonry grid with the shadcn Carousel, add autoplay, keep fullscreen viewer. The component fetches `gallery_carousel_interval` from `/api/app-settings`.

- [ ] **Step 1: Rewrite GallerySection.tsx**

Replace the entire content of `client/src/components/GallerySection.tsx` with:

```tsx
import { motion, useInView } from "framer-motion";
import { useRef, useState, useEffect, useCallback, Component, type ReactNode } from "react";
import { GALLERY_PHOTOS } from "@/lib/constants";
import { fadeIn, staggerContainer, revealText } from "@/lib/animations";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ConfigImage } from "@shared/schema";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { ChevronLeft, ChevronRight, X, Camera } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
  type CarouselApi,
} from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";

const DEFAULT_CAROUSEL_INTERVAL = 4000;

// Helper: Generate responsive Unsplash URLs with optimized sizing
const getResponsiveImageUrl = (baseUrl: string, width: number, quality: number = 75): string => {
  if (!baseUrl.includes('unsplash.com')) return baseUrl;
  const url = new URL(baseUrl);
  url.searchParams.set('w', width.toString());
  url.searchParams.set('q', quality.toString());
  url.searchParams.set('auto', 'format');
  url.searchParams.set('fit', 'crop');
  return url.toString();
};

// Optimized Image Component
const OptimizedImage = ({ thumbnail, alt, index }: { thumbnail: string; alt: string; index: number }) => {
  const safeThumb = thumbnail || '';
  const optimizedSrc = safeThumb.includes('unsplash.com')
    ? getResponsiveImageUrl(safeThumb, 600, 70)
    : safeThumb;

  return (
    <div className="relative w-full bg-gray-100 overflow-hidden rounded-xl aspect-[2/3]">
      <img
        src={optimizedSrc}
        alt={alt}
        className="w-full h-full object-cover"
        loading={index < 4 ? "eager" : "lazy"}
        decoding="async"
      />
    </div>
  );
};

// Error fallback UI
const GalleryErrorFallback = ({ onRetry }: { onRetry: () => void }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <Camera className="h-12 w-12 text-gray-300 mb-4" />
    <p className="text-gray-500 text-lg mb-2">Gallery photos couldn't be loaded</p>
    <p className="text-gray-400 text-sm mb-4">Please try again later</p>
    <button
      onClick={onRetry}
      className="px-6 py-2 rounded-full text-white font-montserrat text-sm shadow-md hover:shadow-lg transition-all hover:brightness-110"
      style={{ backgroundColor: '#dba9a9' }}
    >
      Try Again
    </button>
  </div>
);

class GalleryErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

// Dot indicator component
const CarouselDots = ({ count, activeIndex }: { count: number; activeIndex: number }) => (
  <div className="flex justify-center gap-2 mt-6">
    {Array.from({ length: count }).map((_, i) => (
      <div
        key={i}
        className="w-2 h-2 rounded-full transition-colors duration-300"
        style={{ backgroundColor: i === activeIndex ? '#dba9a9' : '#e8cece' }}
        data-testid={`carousel-dot-${i}`}
      />
    ))}
  </div>
);

const GallerySection = () => {
  const queryClient = useQueryClient();
  const sectionRef = useRef(null);
  const titleRef = useRef(null);
  const galleryRef = useRef(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [currentSlide, setCurrentSlide] = useState(0);

  const isSectionInView = useInView(sectionRef, { once: true, amount: 0.1 });
  const isTitleInView = useInView(titleRef, { once: true, amount: 0.3 });
  const isGalleryInView = useInView(galleryRef, { once: true, amount: 0.1 });

  // Fetch gallery images from API
  const { data: galleryData, isLoading, error } = useQuery<{ images: ConfigImage[] }>({
    queryKey: ["/api/config-images/gallery"],
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
    retryDelay: 1000,
    placeholderData: { images: [] },
  });

  // Fetch app settings for carousel interval
  const { data: settingsData } = useQuery<{ settings: any[] }>({
    queryKey: ["/api/app-settings"],
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const carouselInterval = (() => {
    const setting = settingsData?.settings?.find(
      (s: any) => s.settingKey === "gallery_carousel_interval"
    );
    const parsed = parseInt(setting?.settingValue, 10);
    return isNaN(parsed) || parsed < 2000 || parsed > 10000
      ? DEFAULT_CAROUSEL_INTERVAL
      : parsed;
  })();

  // Use configurable images if available, otherwise fallback to constants
  const galleryImages = galleryData?.images && galleryData.images.length > 0
    ? galleryData.images.map(img => ({
      src: img.imageUrl,
      thumbnail: (img as any).thumbnailUrl || img.imageUrl,
      alt: img.title || img.description || "Gallery image"
    }))
    : GALLERY_PHOTOS.map(p => ({ ...p, thumbnail: p.src }));

  const shouldShowGallery = galleryImages.length > 0;

  // Track current slide for dot indicator
  const onSelect = useCallback(() => {
    if (!carouselApi) return;
    setCurrentSlide(carouselApi.selectedScrollSnap() % galleryImages.length);
  }, [carouselApi, galleryImages.length]);

  useEffect(() => {
    if (!carouselApi) return;
    onSelect();
    carouselApi.on("select", onSelect);
    return () => { carouselApi.off("select", onSelect); };
  }, [carouselApi, onSelect]);

  // Fullscreen viewer keyboard navigation
  useEffect(() => {
    if (selectedImageIndex === null) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') handlePrevious();
      else if (e.key === 'ArrowRight') handleNext();
      else if (e.key === 'Escape') setSelectedImageIndex(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedImageIndex, galleryImages.length]);

  const handlePrevious = () => {
    if (selectedImageIndex === null) return;
    setSelectedImageIndex((selectedImageIndex - 1 + galleryImages.length) % galleryImages.length);
  };

  const handleNext = () => {
    if (selectedImageIndex === null) return;
    setSelectedImageIndex((selectedImageIndex + 1) % galleryImages.length);
  };

  if (!shouldShowGallery) return null;

  if (error) {
    return (
      <section id="gallery" className="py-20 bg-gradient-to-b from-white via-rose-50/30 to-white paper-texture" ref={sectionRef}>
        <div className="container mx-auto px-4">
          <GalleryErrorFallback onRetry={() => queryClient.invalidateQueries({ queryKey: ["/api/config-images/gallery"] })} />
        </div>
      </section>
    );
  }

  return (
    <GalleryErrorBoundary
      fallback={
        <section id="gallery" className="py-20 bg-gradient-to-b from-white via-rose-50/30 to-white paper-texture">
          <div className="container mx-auto px-4">
            <GalleryErrorFallback onRetry={() => window.location.reload()} />
          </div>
        </section>
      }
    >
      <section id="gallery" className="py-20 bg-gradient-to-b from-white via-rose-50/30 to-white paper-texture" ref={sectionRef}>
        <div className="container mx-auto px-4">
          {/* Title */}
          <motion.div
            className="text-center mb-16"
            ref={titleRef}
            variants={staggerContainer}
            initial="hidden"
            animate={isTitleInView ? "visible" : "hidden"}
          >
            <motion.h2
              className="text-5xl md:text-6xl font-cormorant font-bold text-foreground mb-4"
              variants={revealText}
            >
              Our Gallery
            </motion.h2>
            <motion.div
              className="w-24 h-1 metallic-rose mx-auto rounded-full mb-6"
              variants={fadeIn}
            />
            <motion.p
              className="text-muted-foreground font-montserrat text-lg max-w-2xl mx-auto"
              variants={fadeIn}
            >
              A glimpse into our journey together and the moments that led us here
            </motion.p>
          </motion.div>

          {/* Carousel */}
          <motion.div
            ref={galleryRef}
            initial="hidden"
            animate={isGalleryInView ? "visible" : "hidden"}
            variants={fadeIn}
          >
            {isLoading ? (
              <div className="flex gap-4 justify-center">
                <div className="aspect-[2/3] bg-gray-200 animate-pulse rounded-xl w-[85%] sm:w-[48%] lg:w-[31%]" />
                <div className="aspect-[2/3] bg-gray-200 animate-pulse rounded-xl hidden sm:block sm:w-[48%] lg:w-[31%]" />
                <div className="aspect-[2/3] bg-gray-200 animate-pulse rounded-xl hidden lg:block lg:w-[31%]" />
              </div>
            ) : (
              <>
                <Carousel
                  opts={{ loop: true, align: "start" }}
                  plugins={[
                    Autoplay({
                      delay: carouselInterval,
                      stopOnInteraction: false,
                      stopOnMouseEnter: true,
                    }),
                  ]}
                  setApi={setCarouselApi}
                  className="w-full"
                  data-testid="gallery-carousel"
                >
                  <CarouselContent>
                    {galleryImages.map((photo, index) => (
                      <CarouselItem
                        key={index}
                        className="basis-[85%] sm:basis-[48%] lg:basis-[31%]"
                        data-testid={`gallery-image-${index}`}
                      >
                        <div
                          className="overflow-hidden rounded-xl shadow-lg cursor-pointer ring-2 ring-transparent hover:ring-primary/30 transition-all"
                          onClick={() => setSelectedImageIndex(index)}
                        >
                          <OptimizedImage
                            thumbnail={photo.thumbnail}
                            alt={photo.alt}
                            index={index}
                          />
                        </div>
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  <CarouselPrevious className="hidden sm:flex -left-4 lg:-left-12 bg-white/80 hover:bg-white border-none shadow-md" />
                  <CarouselNext className="hidden sm:flex -right-4 lg:-right-12 bg-white/80 hover:bg-white border-none shadow-md" />
                </Carousel>
                <CarouselDots count={galleryImages.length} activeIndex={currentSlide} />
              </>
            )}
          </motion.div>
        </div>

        {/* Fullscreen Image Viewer — unchanged from original */}
        <Dialog open={selectedImageIndex !== null} onOpenChange={(open) => !open && setSelectedImageIndex(null)}>
          <DialogContent className="max-w-[100vw] max-h-[100vh] w-full h-full p-0 bg-black/95 border-none overflow-hidden">
            <VisuallyHidden>
              <DialogTitle>Image Viewer</DialogTitle>
              <DialogDescription>
                Viewing image {selectedImageIndex !== null ? selectedImageIndex + 1 : 0} of {galleryImages.length}. Use arrow keys or navigation buttons to browse.
              </DialogDescription>
            </VisuallyHidden>
            {selectedImageIndex !== null && (
              <div className="relative w-full h-full flex items-center justify-center p-4 md:p-8">
                <button
                  onClick={() => setSelectedImageIndex(null)}
                  className="fixed top-2 right-2 md:top-4 md:right-4 z-[60] p-2 md:p-3 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors touch-manipulation"
                  data-testid="close-image-viewer"
                  aria-label="Close image viewer"
                >
                  <X className="w-5 h-5 md:w-6 md:h-6" />
                </button>
                <div className="fixed top-2 left-1/2 -translate-x-1/2 md:top-4 z-[60] px-3 py-1.5 md:px-4 md:py-2 bg-black/50 rounded-full text-white font-montserrat text-xs md:text-sm">
                  {selectedImageIndex + 1} / {galleryImages.length}
                </div>
                {galleryImages.length > 1 && (
                  <button
                    onClick={handlePrevious}
                    className="fixed left-2 top-1/2 -translate-y-1/2 md:left-4 z-[60] p-2 md:p-3 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors touch-manipulation"
                    data-testid="previous-image"
                    aria-label="Previous image"
                  >
                    <ChevronLeft className="w-6 h-6 md:w-8 md:h-8" />
                  </button>
                )}
                <div className="flex items-center justify-center w-full h-full">
                  <img
                    src={galleryImages[selectedImageIndex].src}
                    alt={galleryImages[selectedImageIndex].alt}
                    className="max-w-[calc(100vw-80px)] max-h-[calc(100vh-80px)] md:max-w-[calc(100vw-120px)] md:max-h-[calc(100vh-120px)] w-auto h-auto object-contain"
                    data-testid="fullsize-image"
                  />
                </div>
                {galleryImages.length > 1 && (
                  <button
                    onClick={handleNext}
                    className="fixed right-2 top-1/2 -translate-y-1/2 md:right-4 z-[60] p-2 md:p-3 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors touch-manipulation"
                    data-testid="next-image"
                    aria-label="Next image"
                  >
                    <ChevronRight className="w-6 h-6 md:w-8 md:h-8" />
                  </button>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </section>
    </GalleryErrorBoundary>
  );
};

export default GallerySection;
```

Key changes from the original:
- Masonry grid (`columns-*`) replaced with `Carousel` / `CarouselContent` / `CarouselItem`
- `basis-[85%] sm:basis-[48%] lg:basis-[31%]` for responsive peek edges
- `Autoplay` plugin with configurable `delay` from app settings
- `loop: true` for infinite scrolling
- `CarouselDots` component tracking `selectedScrollSnap() % totalImages`
- Click handler uses the `.map()` iteration `index` (not Embla internal index)
- Removed: `useResponsivePhotoLimit`, `AnimatePresence`, `staggerFast`, load-more button, `visibleCount` state
- Image aspect ratio changed to `aspect-[2/3]` with `object-cover` for portrait orientation
- `CarouselContent` does NOT need `-ml-4` — the shadcn component applies it automatically

- [ ] **Step 2: Run the failing tests from Task 4 to verify they now pass**

Run: `npx vitest run client/src/components/__tests__/GallerySection.test.tsx`
Expected: All tests PASS

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npm run check`
Expected: No type errors

- [ ] **Step 4: Verify build succeeds**

Run: `npm run build`
Expected: Build completes without errors

- [ ] **Step 5: Commit**

```bash
git add client/src/components/GallerySection.tsx
git commit -m "feat: replace gallery masonry grid with portrait carousel"
```

---

## Chunk 3: Admin UI — Carousel Interval Setting

### Task 6: Add carousel interval input to ConfigPage

**Files:**
- Modify: `client/src/pages/admin/ConfigPage.tsx`

Add a gallery carousel settings section to the admin config page, inside the existing "Image Configuration" card or as a new card adjacent to it.

- [ ] **Step 1: Add carousel interval state and save logic**

In `client/src/pages/admin/ConfigPage.tsx`, add the following:

1. Import `Slider` if available, or use a plain `Input` with `type="number"`.

2. Add state for the carousel interval (after the `egiftForm` state):

```tsx
const [carouselInterval, setCarouselInterval] = useState<string>("4000");
```

3. In the existing `useEffect` that reads `appSettingsData`, inside the `if (appSettingsData?.settings)` block (after the `setEgiftForm({...})` call where `getSettingValue` is in scope), add:

```tsx
setCarouselInterval(getSettingValue("gallery_carousel_interval") || "4000");
```

4. Add a mutation for saving (or extend the existing bulk save). Add this after the `egiftSettingsMutation`:

```tsx
const carouselSettingsMutation = useMutation({
  mutationFn: async (intervalValue: string) => {
    const settings = [
      {
        settingKey: "gallery_carousel_interval",
        settingValue: intervalValue,
        settingType: "number",
        description: "Gallery carousel auto-scroll interval in milliseconds",
      },
    ];
    await apiRequest("PATCH", "/api/admin/app-settings/bulk", { settings });
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["/api/app-settings"] });
    toast({
      title: "Success",
      description: "Gallery carousel speed updated",
    });
  },
  onError: (error: Error) => {
    handleAutoLogout(error);
    toast({
      title: "Error",
      description: `Failed to update carousel setting: ${error.message}`,
      variant: "destructive",
    });
  },
});
```

5. Add the UI section. Insert this **after** the Image Configuration `<Card>` block and **before** the Music Configuration `<Card>`:

```tsx
{/* Gallery Carousel Settings */}
<Card>
  <CardHeader className="pb-4">
    <div className="flex items-center gap-3">
      <Settings className="h-6 w-6 text-rose-600" />
      <div>
        <CardTitle className="text-xl">Gallery Carousel</CardTitle>
        <CardDescription>
          Configure auto-scroll speed for the photo gallery
        </CardDescription>
      </div>
    </div>
  </CardHeader>
  <CardContent>
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="carouselInterval">
          Auto-scroll interval: {(parseInt(carouselInterval) / 1000).toFixed(1)}s
        </Label>
        <div className="flex items-center gap-4">
          <Input
            id="carouselInterval"
            type="number"
            min={2000}
            max={10000}
            step={500}
            value={carouselInterval}
            onChange={(e) => setCarouselInterval(e.target.value)}
            className="max-w-[150px]"
            data-testid="input-carousel-interval"
          />
          <span className="text-sm text-muted-foreground">ms (2000–10000)</span>
        </div>
      </div>
      <Button
        onClick={() => carouselSettingsMutation.mutate(carouselInterval)}
        disabled={carouselSettingsMutation.isPending}
        data-testid="save-carousel-interval"
      >
        {carouselSettingsMutation.isPending && (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        )}
        Save Carousel Settings
      </Button>
    </div>
  </CardContent>
</Card>
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npm run check`
Expected: No type errors

- [ ] **Step 3: Verify build succeeds**

Run: `npm run build`
Expected: Build completes without errors

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/admin/ConfigPage.tsx
git commit -m "feat: add gallery carousel interval setting to admin config"
```

---

## Chunk 4: Verification & Final Checks

### Task 7: Run full backend test suite

- [ ] **Step 1: Run Go tests with race detector**

Run: `cd go-server && make test`
Expected: All tests pass including the new carousel interval contract tests

- [ ] **Step 2: Run linter**

Run: `cd go-server && make lint`
Expected: No lint errors

---

### Task 8: Run full frontend build & type check

- [ ] **Step 1: Type check**

Run: `npm run check`
Expected: No TypeScript errors

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: Build completes successfully

- [ ] **Step 3: Visual verification**

Start the dev servers and verify in a browser:

Run: `cd go-server && make run-dev` (in one terminal)
Run: `npm run dev` (in another terminal)

Verify at `http://localhost:5173`:
1. Gallery section shows a horizontal carousel instead of a masonry grid
2. Cards are portrait-oriented (taller than wide)
3. Carousel auto-scrolls after the configured interval
4. Swiping/dragging works on mobile (or with mouse drag)
5. Clicking a photo opens the fullscreen viewer
6. Fullscreen viewer has prev/next/close/keyboard navigation
7. Dot indicator below carousel shows the active position
8. Arrow buttons appear on tablet/desktop

Verify at `http://localhost:5173/admin` (after login):
1. Gallery Carousel settings card appears
2. Interval input shows current value
3. Changing and saving the interval works
4. After save, refreshing the home page uses the new interval

- [ ] **Step 4: Final commit if any fixes were needed**

```bash
git add -u
git commit -m "fix: address visual verification feedback for gallery carousel"
```
