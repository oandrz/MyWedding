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

// Mock the shadcn carousel to render basic HTML (Embla needs browser APIs)
vi.mock("@/components/ui/carousel", () => ({
  Carousel: ({ children, className, setApi, ...props }: any) => (
    <div className={className} {...props}>{children}</div>
  ),
  CarouselContent: ({ children, className }: any) => (
    <div className={className}>{children}</div>
  ),
  CarouselItem: ({ children, className, ...props }: any) => (
    <div className={className} {...props}>{children}</div>
  ),
  CarouselPrevious: () => null,
  CarouselNext: () => null,
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
    // Click the inner clickable div (carousel card wrapper)
    const carouselItem = screen.getByTestId("gallery-image-0");
    const clickableCard = carouselItem.querySelector(".cursor-pointer");
    expect(clickableCard).not.toBeNull();
    fireEvent.click(clickableCard!);
    // The Dialog should now be open — check for the fullscreen viewer content
    // Radix Dialog renders via portal, so look in the entire document
    expect(document.querySelector('[data-testid="fullsize-image"]') ||
      document.querySelector('[data-testid="close-image-viewer"]')).toBeTruthy();
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
