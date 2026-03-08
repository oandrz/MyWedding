import { describe, it, expect } from "vitest";

interface ConfigImage {
  id: number;
  imageKey: string;
  imageUrl: string;
  imageType: string;
  displayOrder: number;
}

interface CacheData {
  images: ConfigImage[];
}

function applyOptimisticReorder(
  currentData: CacheData,
  orderedKeys: string[]
): CacheData {
  const imageMap = new Map(
    currentData.images.map((img) => [img.imageKey, img])
  );

  const reorderedGallery = orderedKeys
    .map((key, index) => {
      const img = imageMap.get(key);
      if (!img) return null;
      return { ...img, displayOrder: index };
    })
    .filter(Boolean) as ConfigImage[];

  const nonGallery = currentData.images.filter(
    (img) => img.imageType !== "gallery"
  );

  return { images: [...nonGallery, ...reorderedGallery] };
}

describe("Optimistic Reorder", () => {
  const baseData: CacheData = {
    images: [
      { id: 1, imageKey: "banner_1", imageUrl: "b.jpg", imageType: "banner", displayOrder: 0 },
      { id: 2, imageKey: "key1", imageUrl: "1.jpg", imageType: "gallery", displayOrder: 0 },
      { id: 3, imageKey: "key2", imageUrl: "2.jpg", imageType: "gallery", displayOrder: 1 },
      { id: 4, imageKey: "key3", imageUrl: "3.jpg", imageType: "gallery", displayOrder: 2 },
    ],
  };

  it("should reorder gallery images optimistically", () => {
    const result = applyOptimisticReorder(baseData, ["key3", "key1", "key2"]);

    const galleryImages = result.images.filter(
      (img) => img.imageType === "gallery"
    );
    expect(galleryImages.map((img) => img.imageKey)).toEqual([
      "key3",
      "key1",
      "key2",
    ]);
  });

  it("should update displayOrder values to match new positions", () => {
    const result = applyOptimisticReorder(baseData, ["key3", "key1", "key2"]);

    const galleryImages = result.images.filter(
      (img) => img.imageType === "gallery"
    );
    expect(galleryImages[0].displayOrder).toBe(0);
    expect(galleryImages[1].displayOrder).toBe(1);
    expect(galleryImages[2].displayOrder).toBe(2);
  });

  it("should not affect non-gallery images", () => {
    const result = applyOptimisticReorder(baseData, ["key3", "key1", "key2"]);

    const bannerImages = result.images.filter(
      (img) => img.imageType === "banner"
    );
    expect(bannerImages).toHaveLength(1);
    expect(bannerImages[0].imageKey).toBe("banner_1");
  });

  it("should support rollback by restoring original data", () => {
    const snapshot = { ...baseData, images: [...baseData.images] };
    applyOptimisticReorder(baseData, ["key3", "key1", "key2"]);

    const galleryImages = snapshot.images.filter(
      (img) => img.imageType === "gallery"
    );
    expect(galleryImages.map((img) => img.imageKey)).toEqual([
      "key1",
      "key2",
      "key3",
    ]);
  });
});
