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
