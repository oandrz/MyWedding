// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import ImageUploadModal from "../ImageUploadModal";

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@tanstack/react-query", () => ({
  useMutation: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useQueryClient: vi.fn(() => ({ invalidateQueries: vi.fn() })),
}));

vi.mock("@/hooks/useImageAnalysis", () => ({
  useImageAnalysis: () => ({
    processedImage: null,
    isProcessing: false,
    optimizeImage: vi.fn().mockResolvedValue({
      file: new File([""], "photo.jpg", { type: "image/jpeg" }),
      optimized: false,
      analysis: { isOptimalSize: true, isOptimalRatio: true },
    }),
    clearProcessedImage: vi.fn(),
  }),
}));

vi.mock("@/lib/queryClient", () => ({
  apiRequest: vi.fn(),
}));

vi.mock("@/components/ImagePreview", () => ({
  ImagePreview: () => null,
}));

describe("ImageUploadModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("footer Upload Image button is linked to upload-form via form attribute and sits outside the form", () => {
    render(
      <ImageUploadModal
        isOpen={true}
        onClose={vi.fn()}
        imageType="gallery"
      />
    );

    const form = document.getElementById("upload-form");
    expect(form).not.toBeNull();

    const submitButton = screen.getByRole("button", { name: /upload image/i });
    expect(submitButton).toHaveAttribute("form", "upload-form");
    expect(form).not.toContainElement(submitButton);
  });
});
