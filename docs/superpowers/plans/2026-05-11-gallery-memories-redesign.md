# Gallery Memories Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Google Drive iframe on `/gallery` with a full-page masonry gallery that auto-refreshes every 30s, shows all Drive folder photos, includes a click-to-expand lightbox, and lets guests upload via a floating "+" button that opens a bottom sheet.

**Architecture:** `Gallery.tsx` is fully rewritten — no tabs, masonry grid as the hero, floating action button opens `UploadSheet.tsx` (a new component extracted from the old upload tab). Both components use the existing public endpoints `GET /api/drive-folder-contents` and `POST /api/upload-to-drive`. No backend changes.

**Tech Stack:** React 18, TypeScript, TanStack React Query (refetchInterval), Tailwind CSS (CSS columns for masonry), Vitest + React Testing Library

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `client/src/components/UploadSheet.tsx` | Create | Bottom sheet with drag-and-drop upload form |
| `client/src/components/__tests__/UploadSheet.test.tsx` | Create | Tests for UploadSheet |
| `client/src/pages/Gallery.tsx` | Rewrite | Masonry grid, lightbox, FAB, polling, all states |
| `client/src/pages/__tests__/Gallery.test.tsx` | Create | Tests for Gallery page |

---

## Task 1: Create `UploadSheet` component

**Files:**
- Create: `client/src/components/UploadSheet.tsx`
- Create: `client/src/components/__tests__/UploadSheet.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `client/src/components/__tests__/UploadSheet.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import UploadSheet from "../UploadSheet";

describe("UploadSheet", () => {
  it("renders nothing when open=false", () => {
    render(<UploadSheet open={false} onClose={vi.fn()} />);
    expect(screen.queryByTestId("upload-sheet")).toBeNull();
  });

  it("renders sheet when open=true", () => {
    render(<UploadSheet open={true} onClose={vi.fn()} />);
    expect(screen.getByTestId("upload-sheet")).toBeInTheDocument();
    expect(screen.getByText("Share Your Photos")).toBeInTheDocument();
  });

  it("calls onClose when backdrop is clicked", () => {
    const onClose = vi.fn();
    render(<UploadSheet open={true} onClose={onClose} />);
    fireEvent.click(screen.getByTestId("upload-sheet-backdrop"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when × button is clicked", () => {
    const onClose = vi.fn();
    render(<UploadSheet open={true} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText("Close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows file count after files are selected", () => {
    render(<UploadSheet open={true} onClose={vi.fn()} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["hello"], "photo.jpg", { type: "image/jpeg" });
    fireEvent.change(input, { target: { files: [file] } });
    expect(screen.getByText(/1 file\(s\) ready/)).toBeInTheDocument();
  });

  it("limits selection to 10 files", () => {
    render(<UploadSheet open={true} onClose={vi.fn()} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const files = Array.from({ length: 15 }, (_, i) =>
      new File(["x"], `photo${i}.jpg`, { type: "image/jpeg" })
    );
    fireEvent.change(input, { target: { files } });
    expect(screen.getByText(/10 file\(s\) ready/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Volumes/Oink_Machine/Intelij/MyWedding
npx vitest run client/src/components/__tests__/UploadSheet.test.tsx
```

Expected: FAIL — "Cannot find module '../UploadSheet'"

- [ ] **Step 3: Create `UploadSheet.tsx`**

Create `client/src/components/UploadSheet.tsx`:

```tsx
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

interface UploadSheetProps {
  open: boolean;
  onClose: () => void;
}

const UploadSheet = ({ open, onClose }: UploadSheetProps) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [guestName, setGuestName] = useState("");
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files[0]) handleFiles(e.dataTransfer.files);
  };

  const handleFiles = (files: FileList) => {
    setSelectedFiles(Array.from(files).slice(0, 10));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;
    setUploading(true);
    const formData = new FormData();
    selectedFiles.forEach((f) => formData.append("files", f));
    if (guestName.trim()) formData.append("guestName", guestName.trim());

    try {
      const res = await fetch("/api/upload-to-drive", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const result = await res.json();
      toast({
        title: "Photos shared! ❤️",
        description: `Shared ${result.successCount} photo(s) to the wedding memories`,
      });
      setSelectedFiles([]);
      setGuestName("");
      onClose();
    } catch {
      toast({
        title: "Upload failed",
        description: "Couldn't share your photos. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50" data-testid="upload-sheet">
      <div
        className="absolute inset-0 bg-black/50"
        data-testid="upload-sheet-backdrop"
        onClick={onClose}
      />
      <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl p-6 max-h-[85vh] overflow-y-auto shadow-2xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Share Your Photos</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-gray-500 hover:text-gray-700 text-xl leading-none"
          >
            ✕
          </button>
        </div>

        <Input
          placeholder="Your name (optional)"
          value={guestName}
          onChange={(e) => setGuestName(e.target.value)}
          className="mb-4"
        />

        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-all ${
            dragActive
              ? "border-rose-400 bg-rose-50"
              : "border-gray-300 hover:border-rose-300 hover:bg-gray-50"
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/*"
            className="hidden"
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
          />
          {selectedFiles.length > 0 ? (
            <div>
              <p className="font-medium text-gray-900">
                {selectedFiles.length} file(s) ready
              </p>
              {selectedFiles.slice(0, 3).map((f, i) => (
                <p key={i} className="text-sm text-gray-500">
                  {f.name}
                </p>
              ))}
              {selectedFiles.length > 3 && (
                <p className="text-sm text-gray-500">
                  ...and {selectedFiles.length - 3} more
                </p>
              )}
            </div>
          ) : (
            <div>
              <p className="text-gray-600 mb-3">
                Drop photos here or click to browse
              </p>
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                Choose Photos
              </Button>
            </div>
          )}
        </div>

        {selectedFiles.length > 0 && (
          <Button
            onClick={handleUpload}
            disabled={uploading}
            className="mt-4 w-full bg-rose-500 hover:bg-rose-600"
          >
            {uploading
              ? "Sharing..."
              : `Share ${selectedFiles.length} Photo${selectedFiles.length !== 1 ? "s" : ""}`}
          </Button>
        )}
      </div>
    </div>
  );
};

export default UploadSheet;
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd /Volumes/Oink_Machine/Intelij/MyWedding
npx vitest run client/src/components/__tests__/UploadSheet.test.tsx
```

Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/components/UploadSheet.tsx client/src/components/__tests__/UploadSheet.test.tsx
git commit -m "feat: add UploadSheet bottom sheet component"
```

---

## Task 2: Rewrite `Gallery.tsx` — data fetching and masonry grid

**Files:**
- Rewrite: `client/src/pages/Gallery.tsx`
- Create: `client/src/pages/__tests__/Gallery.test.tsx`

The Drive API response for `GET /api/drive-folder-contents` is:
```json
{ "files": [{ "id": "abc123", "name": "Alice_photo.jpg", "mimeType": "image/jpeg", "thumbnailLink": "https://lh3.googleusercontent.com/...=s220", "webViewLink": "https://drive.google.com/file/d/...", "createdTime": "2026-05-11T10:00:00Z" }] }
```

`thumbnailLink` ends with `=s<number>` — replace with `=s600` for grid display.
Guest name is the prefix before the first `_` in the filename; fall back to `"Wedding Guest"`.

- [ ] **Step 1: Write failing tests**

Create `client/src/pages/__tests__/Gallery.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Gallery from "../Gallery";

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

vi.mock("@/components/NavBar", () => ({
  default: () => <nav data-testid="navbar" />,
}));

vi.mock("@/components/UploadSheet", () => ({
  default: ({ open }: { open: boolean }) =>
    open ? <div data-testid="upload-sheet" /> : null,
}));

const MOCK_FILES = [
  {
    id: "file1",
    name: "Alice_wedding.jpg",
    mimeType: "image/jpeg",
    thumbnailLink: "https://lh3.googleusercontent.com/abc=s220",
    webViewLink: "https://drive.google.com/file/d/file1",
    createdTime: "2026-05-11T10:00:00Z",
  },
  {
    id: "file2",
    name: "Bob_ceremony.jpg",
    mimeType: "image/jpeg",
    thumbnailLink: "https://lh3.googleusercontent.com/def=s220",
    webViewLink: "https://drive.google.com/file/d/file2",
    createdTime: "2026-05-11T10:01:00Z",
  },
];

function renderGallery(files = MOCK_FILES) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  qc.setQueryData(["/api/drive-folder-contents"], { files });
  return render(
    <QueryClientProvider client={qc}>
      <Gallery />
    </QueryClientProvider>
  );
}

describe("Gallery", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the page title", () => {
    renderGallery();
    expect(screen.getByText("Wedding Memories")).toBeInTheDocument();
  });

  it("renders a photo tile for each file", () => {
    renderGallery();
    expect(screen.getAllByRole("img").length).toBe(2);
  });

  it("uses s600 thumbnail URL (not s220)", () => {
    renderGallery();
    const imgs = screen.getAllByRole("img") as HTMLImageElement[];
    expect(imgs[0].src).toContain("=s600");
    expect(imgs[0].src).not.toContain("=s220");
  });

  it("shows guest name parsed from filename on hover overlay", () => {
    renderGallery();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("shows empty state when no files", () => {
    renderGallery([]);
    expect(screen.getByText(/No memories yet/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Volumes/Oink_Machine/Intelij/MyWedding
npx vitest run client/src/pages/__tests__/Gallery.test.tsx
```

Expected: FAIL — "Cannot find module '../Gallery'" (or test assertions fail once import resolves)

- [ ] **Step 3: Write the new `Gallery.tsx`**

Fully replace `client/src/pages/Gallery.tsx`:

```tsx
import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import NavBar from "@/components/NavBar";
import UploadSheet from "@/components/UploadSheet";
import { Camera } from "lucide-react";

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  thumbnailLink: string;
  webViewLink: string;
  createdTime: string;
}

export function thumbnailUrl(link: string): string {
  return link.replace(/=s\d+$/, "=s600");
}

export function parseGuestName(filename: string): string {
  const idx = filename.indexOf("_");
  return idx > 0 ? filename.slice(0, idx) : "Wedding Guest";
}

const Gallery = () => {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [brokenIds, setBrokenIds] = useState<Set<string>>(new Set());

  const { data, isLoading, isError, refetch } = useQuery<{ files: DriveFile[] }>({
    queryKey: ["/api/drive-folder-contents"],
    refetchInterval: 30_000,
  });

  const files = data?.files ?? [];

  const openLightbox = useCallback((index: number) => setLightboxIndex(index), []);
  const closeLightbox = useCallback(() => setLightboxIndex(null), []);
  const prevPhoto = useCallback(() =>
    setLightboxIndex((i) => (i !== null ? (i - 1 + files.length) % files.length : null)), [files.length]);
  const nextPhoto = useCallback(() =>
    setLightboxIndex((i) => (i !== null ? (i + 1) % files.length : null)), [files.length]);

  const handleImageError = useCallback((id: string) => {
    setBrokenIds((prev) => new Set(prev).add(id));
  }, []);

  // Keyboard navigation for lightbox
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (lightboxIndex === null) return;
    if (e.key === "ArrowLeft") prevPhoto();
    if (e.key === "ArrowRight") nextPhoto();
    if (e.key === "Escape") closeLightbox();
  }, [lightboxIndex, prevPhoto, nextPhoto, closeLightbox]);

  return (
    <div className="min-h-screen bg-white" onKeyDown={handleKeyDown} tabIndex={-1}>
      <NavBar />

      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-rose-100 px-4 py-3 flex items-center justify-between">
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Camera className="h-5 w-5 text-rose-500" />
          Wedding Memories
        </h1>
        <span className="flex items-center gap-1.5 text-xs text-rose-400">
          <span className="h-2 w-2 rounded-full bg-rose-400 animate-pulse" />
          live
        </span>
      </div>

      {/* Main content */}
      <main className="px-2 py-4 pb-24">
        {isLoading && <GallerySkeleton />}

        {isError && (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-gray-500">
            <p>Couldn't load photos right now.</p>
            <button
              onClick={() => refetch()}
              className="text-rose-500 underline text-sm"
            >
              Retry
            </button>
          </div>
        )}

        {!isLoading && !isError && files.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-gray-500">
            <Camera className="h-12 w-12 text-gray-300" />
            <p className="text-lg">No memories yet — be the first to share!</p>
            <button
              onClick={() => setUploadOpen(true)}
              className="bg-rose-500 text-white px-6 py-2 rounded-full text-sm hover:bg-rose-600 transition-colors"
            >
              Share a Photo
            </button>
          </div>
        )}

        {!isLoading && !isError && files.length > 0 && (
          <div className="columns-1 sm:columns-2 lg:columns-3 gap-2">
            {files.map((file, index) => (
              <div key={file.id} className="break-inside-avoid mb-2 relative group">
                {brokenIds.has(file.id) ? (
                  <div className="w-full aspect-video bg-gray-100 rounded-lg flex flex-col items-center justify-center gap-2 text-gray-400 text-sm">
                    <Camera className="h-6 w-6" />
                    <a
                      href={file.webViewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-rose-400 underline"
                    >
                      View in Drive →
                    </a>
                  </div>
                ) : (
                  <>
                    <img
                      src={thumbnailUrl(file.thumbnailLink)}
                      alt={`Photo by ${parseGuestName(file.name)}`}
                      className="w-full rounded-lg cursor-pointer hover:brightness-95 transition-all opacity-0"
                      onClick={() => openLightbox(index)}
                      onError={() => handleImageError(file.id)}
                      onLoad={(e) => (e.currentTarget.style.opacity = "1")}
                      style={{ transition: "opacity 0.4s" }}
                      loading="lazy"
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent rounded-b-lg px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <p className="text-white text-sm font-medium">
                        {parseGuestName(file.name)}
                      </p>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Floating upload button */}
      <button
        onClick={() => setUploadOpen(true)}
        aria-label="Share photos"
        className="fixed bottom-6 right-6 z-20 w-14 h-14 rounded-full bg-rose-500 hover:bg-rose-600 text-white text-3xl shadow-lg flex items-center justify-center transition-colors"
        data-testid="fab-upload"
      >
        +
      </button>

      {/* Lightbox */}
      {lightboxIndex !== null && files[lightboxIndex] && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center"
          onClick={closeLightbox}
          data-testid="lightbox"
        >
          <button
            onClick={closeLightbox}
            aria-label="Close lightbox"
            className="absolute top-4 right-4 text-white text-3xl leading-none hover:text-gray-300"
          >
            ✕
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); prevPhoto(); }}
            aria-label="Previous photo"
            className="absolute left-4 text-white text-4xl hover:text-gray-300"
          >
            ‹
          </button>
          <img
            src={`https://drive.google.com/uc?export=view&id=${files[lightboxIndex].id}`}
            alt={`Photo by ${parseGuestName(files[lightboxIndex].name)}`}
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
            data-testid="lightbox-image"
          />
          <button
            onClick={(e) => { e.stopPropagation(); nextPhoto(); }}
            aria-label="Next photo"
            className="absolute right-4 text-white text-4xl hover:text-gray-300"
          >
            ›
          </button>
          <p className="absolute bottom-4 text-white text-sm opacity-70">
            {parseGuestName(files[lightboxIndex].name)} · {lightboxIndex + 1} / {files.length}
          </p>
        </div>
      )}

      <UploadSheet open={uploadOpen} onClose={() => setUploadOpen(false)} />
    </div>
  );
};

const GallerySkeleton = () => (
  <div className="columns-1 sm:columns-2 lg:columns-3 gap-2" data-testid="gallery-skeleton">
    {Array.from({ length: 9 }).map((_, i) => (
      <div
        key={i}
        className="break-inside-avoid mb-2 rounded-lg bg-gray-100 animate-pulse"
        style={{ height: `${180 + (i % 3) * 60}px` }}
      />
    ))}
  </div>
);

export default Gallery;
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd /Volumes/Oink_Machine/Intelij/MyWedding
npx vitest run client/src/pages/__tests__/Gallery.test.tsx
```

Expected: All 5 tests PASS

- [ ] **Step 5: Run the full test suite to check for regressions**

```bash
cd /Volumes/Oink_Machine/Intelij/MyWedding
npm test
```

Expected: All tests PASS (including existing GallerySection tests)

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/Gallery.tsx client/src/pages/__tests__/Gallery.test.tsx
git commit -m "feat: rewrite Gallery page — masonry grid from Drive folder with 30s polling"
```

---

## Task 3: Lightbox — keyboard navigation and FAB tests

**Files:**
- Modify: `client/src/pages/__tests__/Gallery.test.tsx`

Add tests covering lightbox open/close/navigation and the FAB.

- [ ] **Step 1: Add tests to `Gallery.test.tsx`**

Append these test cases inside the existing `describe("Gallery", ...)` block. `fireEvent` is already imported at the top of the file — do not re-import it.

```tsx
it("opens lightbox when a photo is clicked", () => {
  renderGallery();
  const imgs = screen.getAllByRole("img");
  fireEvent.click(imgs[0]);
  expect(screen.getByTestId("lightbox")).toBeInTheDocument();
  expect(screen.getByTestId("lightbox-image")).toBeInTheDocument();
});

it("closes lightbox when backdrop is clicked", () => {
  renderGallery();
  fireEvent.click(screen.getAllByRole("img")[0]);
  fireEvent.click(screen.getByTestId("lightbox"));
  expect(screen.queryByTestId("lightbox")).toBeNull();
});

it("closes lightbox on Escape key", () => {
  renderGallery();
  fireEvent.click(screen.getAllByRole("img")[0]);
  fireEvent.keyDown(screen.getByTestId("lightbox"), { key: "Escape" });
  expect(screen.queryByTestId("lightbox")).toBeNull();
});

it("shows upload sheet when FAB is clicked", () => {
  renderGallery();
  fireEvent.click(screen.getByTestId("fab-upload"));
  expect(screen.getByTestId("upload-sheet")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests**

```bash
cd /Volumes/Oink_Machine/Intelij/MyWedding
npx vitest run client/src/pages/__tests__/Gallery.test.tsx
```

Expected: All tests PASS

> **Note on keyboard test:** The `onKeyDown` handler is on the outer `<div>` with `tabIndex={-1}`. In jsdom the event may need to be fired on the correct element. If the Escape test fails, fire the event on `document.body` instead:
> ```tsx
> fireEvent.keyDown(document.body, { key: "Escape" });
> ```

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/__tests__/Gallery.test.tsx
git commit -m "test: add lightbox and FAB interaction tests for Gallery"
```

---

## Task 4: Manual smoke test and final check

- [ ] **Step 1: Start the dev servers**

Terminal 1:
```bash
cd /Volumes/Oink_Machine/Intelij/MyWedding/go-server
make run-dev
```

Terminal 2:
```bash
cd /Volumes/Oink_Machine/Intelij/MyWedding
npm run dev
```

- [ ] **Step 2: Verify masonry grid**

Open http://localhost:5173/gallery. Confirm:
- No iframe visible
- Photos render in a masonry grid (3 columns on desktop)
- Sticky header shows "Wedding Memories" and "● live" indicator

- [ ] **Step 3: Verify lightbox**

Click any photo. Confirm:
- Full-screen overlay opens
- "‹" / "›" buttons navigate between photos
- Clicking the backdrop closes the overlay
- Guest name and photo count shown at the bottom

- [ ] **Step 4: Verify upload bottom sheet**

Click the "+" button. Confirm:
- Bottom sheet slides up
- Can enter a name and select files
- Tapping backdrop or "✕" closes the sheet

- [ ] **Step 5: Verify auto-refresh**

Upload a photo via the bottom sheet. Wait up to 30 seconds. Confirm:
- New photo appears in the grid without a manual page refresh

- [ ] **Step 6: Verify mobile layout**

Open DevTools → toggle device toolbar → set to iPhone 14 width (390px). Confirm:
- Grid collapses to 1 column
- "+" button is reachable and opens the sheet
- Lightbox fills the screen properly

- [ ] **Step 7: Verify empty state**

In a fresh incognito window (or with network devtools blocking the Drive endpoint), confirm the empty state or error state renders without crashing.

- [ ] **Step 8: Run full test suite one final time**

```bash
cd /Volumes/Oink_Machine/Intelij/MyWedding
npm test
```

Expected: All tests PASS

- [ ] **Step 9: Commit**

```bash
git add -p  # stage any minor fixups found during smoke test
git commit -m "feat: gallery memories page redesign — masonry grid, lightbox, auto-refresh, upload sheet"
```
