import { describe, it, expect } from "vitest";

interface ConfigImage {
  imageUrl: string;
  title: string | null;
  description: string | null;
  thumbnailUrl: string | null;
}

interface GalleryPhoto {
  src: string;
  thumbnail: string;
  alt: string;
}

function mapConfigImagesToGalleryPhotos(images: ConfigImage[]): GalleryPhoto[] {
  return images.map((img) => ({
    src: img.imageUrl,
    thumbnail: img.thumbnailUrl || img.imageUrl,
    alt: img.title || img.description || "Gallery image",
  }));
}

describe("Gallery Order - Client Side", () => {
  it("should preserve API order when mapping images to gallery photos", () => {
    const apiImages: ConfigImage[] = [
      {
        imageUrl: "https://example.com/third.jpg",
        title: "Third",
        description: null,
        thumbnailUrl: null,
      },
      {
        imageUrl: "https://example.com/first.jpg",
        title: "First",
        description: null,
        thumbnailUrl: null,
      },
      {
        imageUrl: "https://example.com/second.jpg",
        title: "Second",
        description: null,
        thumbnailUrl: null,
      },
    ];

    const result = mapConfigImagesToGalleryPhotos(apiImages);

    expect(result[0].alt).toBe("Third");
    expect(result[1].alt).toBe("First");
    expect(result[2].alt).toBe("Second");
  });

  it("should not sort or reorder images", () => {
    const apiImages: ConfigImage[] = [
      {
        imageUrl: "https://example.com/z.jpg",
        title: "Z Image",
        description: null,
        thumbnailUrl: null,
      },
      {
        imageUrl: "https://example.com/a.jpg",
        title: "A Image",
        description: null,
        thumbnailUrl: null,
      },
    ];

    const result = mapConfigImagesToGalleryPhotos(apiImages);

    expect(result.map((r) => r.alt)).toEqual(["Z Image", "A Image"]);
  });

  it("should use thumbnailUrl when available", () => {
    const apiImages: ConfigImage[] = [
      {
        imageUrl: "https://example.com/full.jpg",
        title: "Test",
        description: null,
        thumbnailUrl: "https://example.com/thumb.webp",
      },
    ];

    const result = mapConfigImagesToGalleryPhotos(apiImages);
    expect(result[0].thumbnail).toBe("https://example.com/thumb.webp");
    expect(result[0].src).toBe("https://example.com/full.jpg");
  });
});
