# Gallery Carousel Redesign

**Date:** 2026-03-22
**Status:** Approved

## Summary

Replace the masonry grid gallery on the home page with a sliding portrait-card carousel (P1 variant). The carousel auto-scrolls at a configurable interval, supports swipe/drag interaction, and retains the existing fullscreen image viewer on click.

## Motivation

The current masonry grid layout is optimized for landscape images, but the gallery consists primarily of portrait photos. A horizontal carousel with tall cards better showcases portrait photography, creates a more engaging browsing experience, and feels more polished on both mobile and desktop.

## Design

### Carousel Layout

Replace the CSS `columns` masonry grid in `GallerySection.tsx` with an Embla Carousel using the existing `client/src/components/ui/carousel.tsx` shadcn component.

- **Card shape:** Portrait-oriented with `aspect-[2/3]` ratio
- **Visible cards:**
  - Desktop (≥1024px): 3 cards + peek edges on both sides
  - Tablet (640–1023px): 2 cards + peek edges
  - Mobile (<640px): 1 card + peek edges
- **Visual style:** Rounded corners (`rounded-xl`), subtle shadow, consistent with existing gallery styling
- **Progress indicator:** Segmented dot indicator below the carousel — one dot per image, active dot filled with `#dba9a9` (rose accent), inactive dots `#e8cece`. With infinite loop, position is calculated as `currentIndex / totalSlides` (not `scrollProgress()`)
- **Entry animation:** Framer Motion fade-in when the section scrolls into view (same as current)
- **Infinite loop:** Carousel wraps around seamlessly, achieved by passing `loop: true` in the Embla options via the shadcn `Carousel` component's `opts` prop
- **Peek edge sizing:**
  - Mobile: `basis-[85%]` (~7.5% peek on each side)
  - Tablet: `basis-[48%]` (~2% peek on each side)
  - Desktop: `basis-[31%]` (~3.5% peek on each side)
- **Loading skeleton:** While images load, show skeleton cards matching `aspect-[2/3]` with `animate-pulse`, count matching the visible card count for the current breakpoint

### Auto-Scroll

- **Plugin:** `embla-carousel-autoplay` (new dependency)
- **Interval:** Fetched from `app_settings` key `gallery_carousel_interval` (default: 4000ms)
- **Pause behavior:** Uses `embla-carousel-autoplay` with `stopOnInteraction: false` and `stopOnMouseEnter: true`. The plugin's built-in resume-after-interaction behavior is sufficient — no custom 3-second timer needed. After user drag/swipe ends, autoplay resumes on the next interval tick automatically
- **Direction:** Scrolls forward (left-to-right advance)

### Fullscreen Image Viewer

**No changes.** The existing `Dialog`-based fullscreen viewer is retained as-is:

- Click any carousel card to open the viewer
- **Index mapping:** Click handlers must use the original `galleryImages` array index from the `.map()` iteration, not Embla's internal slide index (which differs when `loop: true` duplicates slides internally)
- Keyboard navigation (ArrowLeft, ArrowRight, Escape)
- Previous/Next buttons with image counter
- Full-size image display with responsive sizing

### Removed Features

- **Masonry grid:** Replaced entirely by the carousel
- **"Load More" button:** No longer needed — carousel shows all images via scrolling
- **`useResponsivePhotoLimit` hook usage:** No longer needed in this component (hook itself remains in codebase in case other components use it)

### Admin Configuration

Add a new `app_settings` row:

| Key | Default Value | Type | Description |
|-----|--------------|------|-------------|
| `gallery_carousel_interval` | `4000` | `number` | Gallery carousel auto-scroll interval in milliseconds |

**Migration file:** `go-server/migrations/002_gallery_carousel_interval.sql`
```sql
INSERT INTO app_settings (setting_key, setting_value, setting_type, description)
VALUES ('gallery_carousel_interval', '4000', 'number', 'Gallery carousel auto-scroll interval in milliseconds')
ON CONFLICT (setting_key) DO NOTHING;
```

Note: `setting_value` is stored as `TEXT` in the database. The frontend must `parseInt()` the value before passing it to the autoplay plugin, with a fallback to `4000` if parsing fails or the setting is missing.

**Admin UI (ConfigPage):**
- Add a labeled number input or slider in the gallery/image configuration section
- Range: 2000–10000ms (2–10 seconds)
- Uses existing bulk settings API: `PATCH /api/admin/app-settings/bulk`

### Data Flow

1. `GallerySection` fetches gallery images from `/api/config-images/gallery` (existing, unchanged)
2. `GallerySection` fetches app settings from `/api/app-settings` to read `gallery_carousel_interval`
3. Carousel renders with Embla + autoplay plugin configured with the fetched interval
4. On image click, the existing fullscreen viewer opens with `selectedImageIndex` state
5. Admin updates interval via ConfigPage → bulk settings API → cached value refreshes on next page load

### Responsive Behavior

| Breakpoint | Visible Cards | Peek Edges | Interaction |
|-----------|--------------|------------|-------------|
| <640px | 1 | Yes, both sides | Swipe/drag |
| 640–1023px | 2 | Yes, both sides | Swipe/drag + arrows on hover |
| ≥1024px | 3 | Yes, both sides | Drag + arrow buttons visible |

## Testing Strategy (TDD)

Tests are written **before** implementation.

### Backend Tests

- **Contract test:** Verify `gallery_carousel_interval` appears in `GET /api/app-settings` response with correct structure (key, value, type)
- **Update test:** Verify `PATCH /api/admin/app-settings/bulk` can update `gallery_carousel_interval`

### Frontend Tests

- **Carousel rendering:** Verify carousel container renders with correct number of slides from gallery data
- **Auto-scroll config:** Verify autoplay plugin receives the interval value from app settings
- **Responsive slides:** Verify correct `slidesToScroll` / visible count at different breakpoints
- **Click-to-viewer:** Verify clicking a carousel card sets `selectedImageIndex` and opens the fullscreen dialog
- **Fallback:** Verify carousel renders with `GALLERY_PHOTOS` fallback when API returns empty
- **Error state:** Verify error boundary / retry fallback still works

## Dependencies

### New

- `embla-carousel-autoplay` — autoplay plugin for Embla Carousel

### Existing (no changes)

- `embla-carousel-react` — already installed (used by shadcn carousel)
- `framer-motion` — section entry animations
- `@tanstack/react-query` — data fetching
- `@radix-ui/react-dialog` — fullscreen viewer

## Files Modified

| File | Change |
|------|--------|
| `client/src/components/GallerySection.tsx` | Rewrite grid → carousel, add autoplay, keep fullscreen viewer |
| `client/src/pages/admin/ConfigPage.tsx` | Add carousel interval setting input |
| `go-server/migrations/002_gallery_carousel_interval.sql` | Seed `gallery_carousel_interval` default setting |
| `go-server/internal/handler/contract_test.go` | Add contract test for new setting |
| New test file(s) for frontend carousel tests | TDD: written before implementation |

## Out of Scope

- Gallery page (`client/src/pages/Gallery.tsx`) — guest photo sharing page is unchanged
- Image upload/management flow — unchanged
- Fullscreen viewer redesign — kept as-is
- New API endpoints — uses existing settings infrastructure
