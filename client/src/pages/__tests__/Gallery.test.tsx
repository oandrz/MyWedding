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
