import { describe, it, expect, beforeEach } from "vitest";
import { MemStorage } from "../server/storage";

describe("Storage - Gallery Image Ordering", () => {
  let storage: MemStorage;

  beforeEach(() => {
    storage = new MemStorage();
  });

  it("should return gallery images sorted by displayOrder ASC", async () => {
    await storage.createConfigImage({
      imageKey: "gallery_a",
      imageUrl: "https://example.com/a.jpg",
      imageType: "gallery",
      displayOrder: 3,
    });
    await storage.createConfigImage({
      imageKey: "gallery_b",
      imageUrl: "https://example.com/b.jpg",
      imageType: "gallery",
      displayOrder: 1,
    });
    await storage.createConfigImage({
      imageKey: "gallery_c",
      imageUrl: "https://example.com/c.jpg",
      imageType: "gallery",
      displayOrder: 2,
    });

    const images = await storage.getConfigImagesByType("gallery");
    const filteredImages = images.filter(img =>
      ["gallery_a", "gallery_b", "gallery_c"].includes(img.imageKey)
    );
    expect(filteredImages.map(img => img.imageKey)).toEqual([
      "gallery_b",
      "gallery_c",
      "gallery_a",
    ]);
  });

  it("should use updatedAt DESC as tiebreaker when displayOrder is equal", async () => {
    await storage.createConfigImage({
      imageKey: "gallery_x",
      imageUrl: "https://example.com/x.jpg",
      imageType: "gallery",
      displayOrder: 1,
    });

    await new Promise(resolve => setTimeout(resolve, 10));

    await storage.createConfigImage({
      imageKey: "gallery_y",
      imageUrl: "https://example.com/y.jpg",
      imageType: "gallery",
      displayOrder: 1,
    });

    const images = await storage.getConfigImagesByType("gallery");
    const filteredImages = images.filter(img =>
      ["gallery_x", "gallery_y"].includes(img.imageKey)
    );
    expect(filteredImages[0].imageKey).toBe("gallery_y");
    expect(filteredImages[1].imageKey).toBe("gallery_x");
  });

  it("createConfigImage should auto-assign the next displayOrder when not provided", async () => {
    await storage.createConfigImage({
      imageKey: "gallery_first",
      imageUrl: "https://example.com/first.jpg",
      imageType: "gallery",
      displayOrder: 5,
    });

    const second = await storage.createConfigImage({
      imageKey: "gallery_second",
      imageUrl: "https://example.com/second.jpg",
      imageType: "gallery",
    });

    expect(second.displayOrder).toBeGreaterThan(5);
  });

  it("reorderConfigImages should update displayOrder to match the given order", async () => {
    await storage.createConfigImage({
      imageKey: "key1",
      imageUrl: "https://example.com/1.jpg",
      imageType: "gallery",
      displayOrder: 0,
    });
    await storage.createConfigImage({
      imageKey: "key2",
      imageUrl: "https://example.com/2.jpg",
      imageType: "gallery",
      displayOrder: 1,
    });
    await storage.createConfigImage({
      imageKey: "key3",
      imageUrl: "https://example.com/3.jpg",
      imageType: "gallery",
      displayOrder: 2,
    });

    await storage.reorderConfigImages("gallery", ["key3", "key1", "key2"]);

    const images = await storage.getConfigImagesByType("gallery");
    const keys = images
      .filter(img => ["key1", "key2", "key3"].includes(img.imageKey))
      .map(img => img.imageKey);
    expect(keys).toEqual(["key3", "key1", "key2"]);
  });

  it("reorderConfigImages should not affect images of other types", async () => {
    await storage.createConfigImage({
      imageKey: "banner_main",
      imageUrl: "https://example.com/banner.jpg",
      imageType: "banner",
      displayOrder: 0,
    });
    await storage.createConfigImage({
      imageKey: "gkey1",
      imageUrl: "https://example.com/1.jpg",
      imageType: "gallery",
      displayOrder: 0,
    });

    await storage.reorderConfigImages("gallery", ["gkey1"]);

    const banner = await storage.getConfigImage("banner_main");
    expect(banner?.displayOrder).toBe(0);
  });
});
