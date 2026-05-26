# Homepage Gallery Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the blank-screen delay when opening or navigating the homepage gallery fullscreen viewer by preloading full-size images in the background and showing an instant blurred placeholder.

**Architecture:** Two layers working together — (A) `new Image()` preloading triggered when carousel thumbnails load and when fullscreen navigates, and (B) a blurred thumbnail shown immediately in the fullscreen viewer while the full-size image fades in. All changes are confined to `GallerySection.tsx` and its test file.

**Tech Stack:** React 18, TypeScript, Vitest + Testing Library (jsdom)

---

## File Map

| File | Change |
|------|--------|
| `client/src/components/GallerySection.tsx` | Add `onLoad` prop to `OptimizedImage`; add `preloadImage` helper + `preloadedUrls` ref + `isFullSizeLoaded` state; `useEffect` for neighbor preloading; replace single `<img>` in fullscreen with blur-up two-layer structure |
| `client/src/components/__tests__/GallerySection.test.tsx` | Add `MOCK_GALLERY_IMAGES_WITH_THUMBS` fixture; add 5 new test cases |

---

## Task 1: Preload full-size image when carousel thumbnail loads

**Files:**
- Modify: `client/src/components/GallerySection.tsx:35-52` (`OptimizedImage`) and `client/src/components/GallerySection.tsx:98-147` (`GallerySection`)
- Test: `client/src/components/__tests__/GallerySection.test.tsx`

- [ ] **Step 1: Add the `MOCK_GALLERY_IMAGES_WITH_THUMBS` fixture to the test file**

Open `client/src/components/__tests__/GallerySection.test.tsx` and add this constant after the existing `MOCK_GALLERY_IMAGES` constant (around line 48):

```tsx
const MOCK_GALLERY_IMAGES_WITH_THUMBS = [
  { id: 1, imageUrl: "/storage/gallery/img1.jpg", thumbnailUrl: "/storage/gallery/thumbnails/thumb1.jpg", title: "Photo 1", description: "", category: "gallery", displayOrder: 1 },
  { id: 2, imageUrl: "/storage/gallery/img2.jpg", thumbnailUrl: "/storage/gallery/thumbnails/thumb2.jpg", title: "Photo 2", description: "", category: "gallery", displayOrder: 2 },
  { id: 3, imageUrl: "/storage/gallery/img3.jpg", thumbnailUrl: "/storage/gallery/thumbnails/thumb3.jpg", title: "Photo 3", description: "", category: "gallery", displayOrder: 3 },
  { id: 4, imageUrl: "/storage/gallery/img4.jpg", thumbnailUrl: "/storage/gallery/thumbnails/thumb4.jpg", title: "Photo 4", description: "", category: "gallery", displayOrder: 4 },
  { id: 5, imageUrl: "/storage/gallery/img5.jpg", thumbnailUrl: "/storage/gallery/thumbnails/thumb5.jpg", title: "Photo 5", description: "", category: "gallery", displayOrder: 5 },
];
```

- [ ] **Step 2: Write the failing test**

Add a new `describe` block at the bottom of the test file:

```tsx
describe("GallerySection — Preloading", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("preloads full-size image when carousel thumbnail loads", () => {
    const preloadedSrcs: string[] = [];
    class MockImage {
      set src(val: string) { preloadedSrcs.push(val); }
      get src() { return ""; }
    }
    vi.stubGlobal("Image", MockImage);

    renderGallerySection(MOCK_GALLERY_IMAGES_WITH_THUMBS);

    // Find the thumbnail img for the first carousel item and fire onLoad
    const thumbnailImg = document.querySelector<HTMLImageElement>(
      'img[src="/storage/gallery/thumbnails/thumb1.jpg"]'
    );
    expect(thumbnailImg).not.toBeNull();
    fireEvent.load(thumbnailImg!);

    expect(preloadedSrcs).toContain("/storage/gallery/img1.jpg");
    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 3: Run the test to confirm it fails**

```bash
cd /Volumes/Oink_Machine/Intelij/MyWedding && npm run check 2>&1 | tail -5; npx vitest run client/src/components/__tests__/GallerySection.test.tsx 2>&1 | tail -20
```

Expected: test fails because `OptimizedImage` has no `onLoad` prop yet.

- [ ] **Step 4: Add `onLoad` prop to `OptimizedImage`**

In `client/src/components/GallerySection.tsx`, replace the `OptimizedImage` component (lines 35–52):

```tsx
const OptimizedImage = ({ thumbnail, alt, index, onLoad }: {
  thumbnail: string;
  alt: string;
  index: number;
  onLoad?: () => void;
}) => {
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
        onLoad={onLoad}
      />
    </div>
  );
};
```

- [ ] **Step 5: Add `preloadedUrls` ref and `preloadImage` helper in `GallerySection`**

Inside `GallerySection`, after the existing `const [currentSlide, setCurrentSlide] = useState(0);` line (around line 106), add:

```tsx
const preloadedUrls = useRef<Set<string>>(new Set());

const preloadImage = useCallback((url: string) => {
  if (!url || preloadedUrls.current.has(url)) return;
  preloadedUrls.current.add(url);
  const img = new Image();
  img.src = url;
}, []);
```

- [ ] **Step 6: Wire `onLoad` into the carousel**

In `GallerySection.tsx`, find the `<OptimizedImage>` usage inside the carousel (around line 275) and add the `onLoad` prop:

```tsx
<OptimizedImage
  thumbnail={photo.thumbnail}
  alt={photo.alt}
  index={index}
  onLoad={() => preloadImage(photo.src)}
/>
```

- [ ] **Step 7: Run the test to confirm it passes**

```bash
npx vitest run client/src/components/__tests__/GallerySection.test.tsx 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add client/src/components/GallerySection.tsx client/src/components/__tests__/GallerySection.test.tsx
git commit -m "feat: preload full-size gallery images when carousel thumbnails load"
```

---

## Task 2: Preload neighbor images when fullscreen opens or navigates

**Files:**
- Modify: `client/src/components/GallerySection.tsx`
- Test: `client/src/components/__tests__/GallerySection.test.tsx`

- [ ] **Step 1: Write the failing test**

Inside the `describe("GallerySection — Preloading")` block (added in Task 1), add:

```tsx
it("preloads ±2 neighbor full-size images when fullscreen opens", () => {
  const preloadedSrcs: string[] = [];
  class MockImage {
    set src(val: string) { preloadedSrcs.push(val); }
    get src() { return ""; }
  }
  vi.stubGlobal("Image", MockImage);

  renderGallerySection(MOCK_GALLERY_IMAGES_WITH_THUMBS);

  // Open fullscreen at index 2 (middle)
  const carouselItem = screen.getByTestId("gallery-image-2");
  const clickableCard = carouselItem.querySelector(".cursor-pointer");
  fireEvent.click(clickableCard!);

  // Neighbors of index 2: indices 0, 1, 3, 4
  expect(preloadedSrcs).toContain("/storage/gallery/img1.jpg");
  expect(preloadedSrcs).toContain("/storage/gallery/img2.jpg");
  expect(preloadedSrcs).toContain("/storage/gallery/img4.jpg");
  expect(preloadedSrcs).toContain("/storage/gallery/img5.jpg");
  vi.unstubAllGlobals();
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
npx vitest run client/src/components/__tests__/GallerySection.test.tsx 2>&1 | tail -20
```

Expected: fails because neighbor preloading doesn't exist yet.

- [ ] **Step 3: Add the neighbor-preloading `useEffect`**

In `GallerySection.tsx`, after the existing keyboard navigation `useEffect` (around line 165), add:

```tsx
useEffect(() => {
  if (selectedImageIndex === null || galleryImages.length === 0) return;
  [-2, -1, 1, 2].forEach((offset) => {
    const idx = (selectedImageIndex + offset + galleryImages.length) % galleryImages.length;
    preloadImage(galleryImages[idx].src);
  });
}, [selectedImageIndex, galleryImages, preloadImage]);
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
npx vitest run client/src/components/__tests__/GallerySection.test.tsx 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/GallerySection.tsx client/src/components/__tests__/GallerySection.test.tsx
git commit -m "feat: preload neighbor gallery images when fullscreen opens or navigates"
```

---

## Task 3: Blur-up placeholder + full-size fade-in in fullscreen viewer

**Files:**
- Modify: `client/src/components/GallerySection.tsx`
- Test: `client/src/components/__tests__/GallerySection.test.tsx`

- [ ] **Step 1: Write the failing tests**

Add a new `describe` block at the bottom of the test file:

```tsx
describe("GallerySection — Fullscreen blur-up", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders blurred thumbnail placeholder immediately when fullscreen opens", () => {
    renderGallerySection(MOCK_GALLERY_IMAGES_WITH_THUMBS);

    const carouselItem = screen.getByTestId("gallery-image-0");
    fireEvent.click(carouselItem.querySelector(".cursor-pointer")!);

    const blurPlaceholder = document.querySelector('[data-testid="blur-placeholder"]');
    expect(blurPlaceholder).not.toBeNull();
    expect(blurPlaceholder).toHaveAttribute("src", "/storage/gallery/thumbnails/thumb1.jpg");
  });

  it("renders full-size image with opacity 0 before it loads", () => {
    renderGallerySection(MOCK_GALLERY_IMAGES_WITH_THUMBS);

    const carouselItem = screen.getByTestId("gallery-image-0");
    fireEvent.click(carouselItem.querySelector(".cursor-pointer")!);

    const fullsizeImg = document.querySelector<HTMLElement>('[data-testid="fullsize-image"]');
    expect(fullsizeImg).not.toBeNull();
    expect(fullsizeImg!.style.opacity).toBe("0");
  });

  it("sets full-size image to opacity 1 when it finishes loading", () => {
    renderGallerySection(MOCK_GALLERY_IMAGES_WITH_THUMBS);

    const carouselItem = screen.getByTestId("gallery-image-0");
    fireEvent.click(carouselItem.querySelector(".cursor-pointer")!);

    const fullsizeImg = document.querySelector<HTMLElement>('[data-testid="fullsize-image"]');
    fireEvent.load(fullsizeImg!);

    expect(fullsizeImg!.style.opacity).toBe("1");
  });

  it("does not render blur placeholder when thumbnail and src are the same URL", () => {
    renderGallerySection(MOCK_GALLERY_IMAGES); // no thumbnailUrl — thumbnail === src

    const carouselItem = screen.getByTestId("gallery-image-0");
    fireEvent.click(carouselItem.querySelector(".cursor-pointer")!);

    expect(document.querySelector('[data-testid="blur-placeholder"]')).toBeNull();
    expect(document.querySelector('[data-testid="fullsize-image"]')).not.toBeNull();
  });

  it("sets opacity 1 on full-size image when it errors", () => {
    renderGallerySection(MOCK_GALLERY_IMAGES_WITH_THUMBS);

    const carouselItem = screen.getByTestId("gallery-image-0");
    fireEvent.click(carouselItem.querySelector(".cursor-pointer")!);

    const fullsizeImg = document.querySelector<HTMLElement>('[data-testid="fullsize-image"]');
    fireEvent.error(fullsizeImg!);

    expect(fullsizeImg!.style.opacity).toBe("1");
  });
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

```bash
npx vitest run client/src/components/__tests__/GallerySection.test.tsx 2>&1 | tail -20
```

Expected: the new tests fail.

- [ ] **Step 3: Add `isFullSizeLoaded` state and reset effect**

In `GallerySection.tsx`, after `const [currentSlide, setCurrentSlide] = useState(0);`, add:

```tsx
const [isFullSizeLoaded, setIsFullSizeLoaded] = useState(false);
```

Then, after the neighbor-preloading `useEffect` added in Task 2, add:

```tsx
useEffect(() => {
  setIsFullSizeLoaded(false);
}, [selectedImageIndex]);
```

- [ ] **Step 4: Replace the fullscreen `<img>` with the blur-up two-layer structure**

In `GallerySection.tsx`, find the inner div and `<img>` inside the fullscreen `Dialog` (around line 325):

```tsx
<div className="flex items-center justify-center w-full h-full">
  <img
    src={galleryImages[selectedImageIndex].src}
    alt={galleryImages[selectedImageIndex].alt}
    className="max-w-[calc(100vw-80px)] max-h-[calc(100vh-80px)] md:max-w-[calc(100vw-120px)] md:max-h-[calc(100vh-120px)] w-auto h-auto object-contain"
    data-testid="fullsize-image"
  />
</div>
```

Replace it with:

```tsx
<div className="relative flex items-center justify-center w-full h-full">
  {galleryImages[selectedImageIndex].thumbnail !== galleryImages[selectedImageIndex].src && (
    <img
      src={galleryImages[selectedImageIndex].thumbnail}
      alt=""
      aria-hidden="true"
      className="absolute inset-0 w-full h-full object-contain"
      style={{ filter: "blur(20px)", transform: "scale(1.05)" }}
      data-testid="blur-placeholder"
    />
  )}
  <img
    key={selectedImageIndex}
    src={galleryImages[selectedImageIndex].src}
    alt={galleryImages[selectedImageIndex].alt}
    className="relative max-w-[calc(100vw-80px)] max-h-[calc(100vh-80px)] md:max-w-[calc(100vw-120px)] md:max-h-[calc(100vh-120px)] w-auto h-auto object-contain transition-opacity duration-300"
    style={{ opacity: isFullSizeLoaded ? 1 : 0 }}
    onLoad={() => setIsFullSizeLoaded(true)}
    onError={() => setIsFullSizeLoaded(true)}
    data-testid="fullsize-image"
  />
</div>
```

- [ ] **Step 5: Run all tests to confirm they pass**

```bash
npx vitest run client/src/components/__tests__/GallerySection.test.tsx 2>&1 | tail -20
```

Expected: all tests pass, including existing ones.

- [ ] **Step 6: TypeScript check**

```bash
cd /Volumes/Oink_Machine/Intelij/MyWedding && npm run check 2>&1 | tail -10
```

Expected: no type errors.

- [ ] **Step 7: Commit**

```bash
git add client/src/components/GallerySection.tsx client/src/components/__tests__/GallerySection.test.tsx
git commit -m "feat: blur-up placeholder and fade-in for homepage gallery fullscreen viewer"
```

---

## Verification

- [ ] Start the dev server: `npm run dev` (from project root) and `make run-dev` (from `go-server/`)
- [ ] Open the homepage, scroll to the gallery section
- [ ] Click any carousel image — the fullscreen viewer should open instantly with the blurred thumbnail visible, then the sharp full-size fades in
- [ ] Click next/previous several times rapidly — transitions should be smooth, no blank screen
- [ ] Scroll through the carousel without clicking, then click an image — full-size should appear nearly instantly (preloaded while scrolling)
- [ ] Open DevTools Network tab, reload, scroll carousel, open fullscreen — confirm full-size requests fire silently in the background while carousel is visible
