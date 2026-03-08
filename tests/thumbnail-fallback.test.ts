import { describe, it, expect } from "vitest";

function getDisplayImageUrl(
  thumbnailUrl: string | null | undefined,
  imageUrl: string
): string {
  return thumbnailUrl || imageUrl;
}

describe("Thumbnail Fallback", () => {
  it("should return thumbnailUrl when available", () => {
    const result = getDisplayImageUrl(
      "https://example.com/thumb.webp",
      "https://example.com/full.jpg"
    );
    expect(result).toBe("https://example.com/thumb.webp");
  });

  it("should fall back to imageUrl when thumbnailUrl is null", () => {
    const result = getDisplayImageUrl(
      null,
      "https://example.com/full.jpg"
    );
    expect(result).toBe("https://example.com/full.jpg");
  });

  it("should fall back to imageUrl when thumbnailUrl is undefined", () => {
    const result = getDisplayImageUrl(
      undefined,
      "https://example.com/full.jpg"
    );
    expect(result).toBe("https://example.com/full.jpg");
  });

  it("should fall back to imageUrl when thumbnailUrl is empty string", () => {
    const result = getDisplayImageUrl(
      "",
      "https://example.com/full.jpg"
    );
    expect(result).toBe("https://example.com/full.jpg");
  });
});
