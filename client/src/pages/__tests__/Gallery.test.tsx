// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Gallery from "../Gallery";

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

  it("uses s800 thumbnail URL (not s220)", () => {
    renderGallery();
    const imgs = screen.getAllByRole("img") as HTMLImageElement[];
    expect(imgs[0].src).toContain("=s800");
    expect(imgs[0].src).not.toContain("=s220");
    expect(imgs[0].src).not.toContain("=s600");
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
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByTestId("lightbox")).toBeNull();
  });

  it("shows upload sheet when FAB is clicked", () => {
    renderGallery();
    fireEvent.click(screen.getByTestId("fab-upload"));
    expect(screen.getByTestId("upload-sheet")).toBeInTheDocument();
  });

  it("navigates to the next photo on ArrowRight", () => {
    renderGallery();
    fireEvent.click(screen.getAllByRole("img")[0]);
    fireEvent.keyDown(document, { key: "ArrowRight" });
    expect(screen.getByText(/2 \/ 2/)).toBeInTheDocument();
  });

  it("navigates to the previous photo on ArrowLeft (wraps around)", () => {
    renderGallery();
    fireEvent.click(screen.getAllByRole("img")[0]);
    fireEvent.keyDown(document, { key: "ArrowLeft" });
    expect(screen.getByText(/2 \/ 2/)).toBeInTheDocument();
  });

  it("clicking the lightbox image does not close the lightbox", () => {
    renderGallery();
    fireEvent.click(screen.getAllByRole("img")[0]);
    fireEvent.click(screen.getByTestId("lightbox-image"));
    expect(screen.getByTestId("lightbox")).toBeInTheDocument();
  });

  it("uses 2-column grid layout", () => {
    renderGallery();
    const grid = screen.getByTestId("photo-grid");
    expect(grid.className).toContain("columns-2");
    expect(grid.className).not.toContain("columns-1");
  });

  it("guest name overlay has opacity-100 (always visible on mobile)", () => {
    renderGallery();
    const overlays = document.querySelectorAll("[data-testid='guest-name-overlay']");
    expect(overlays.length).toBeGreaterThan(0);
    overlays.forEach((el) => {
      expect(el.className).toContain("opacity-100");
    });
  });
});
