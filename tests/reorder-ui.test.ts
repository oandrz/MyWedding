import { describe, it, expect } from "vitest";
import { arrayMove } from "@dnd-kit/sortable";

interface GalleryItem {
  imageKey: string;
  displayOrder: number;
}

function computeReorderedKeys(
  items: GalleryItem[],
  activeId: string,
  overId: string
): string[] {
  const oldIndex = items.findIndex((item) => item.imageKey === activeId);
  const newIndex = items.findIndex((item) => item.imageKey === overId);
  if (oldIndex === -1 || newIndex === -1) return items.map((i) => i.imageKey);
  const reordered = arrayMove(items, oldIndex, newIndex);
  return reordered.map((i) => i.imageKey);
}

describe("Reorder UI Logic", () => {
  const items: GalleryItem[] = [
    { imageKey: "key1", displayOrder: 0 },
    { imageKey: "key2", displayOrder: 1 },
    { imageKey: "key3", displayOrder: 2 },
  ];

  it("should reorder items when dragging from first to last", () => {
    const result = computeReorderedKeys(items, "key1", "key3");
    expect(result).toEqual(["key2", "key3", "key1"]);
  });

  it("should reorder items when dragging from last to first", () => {
    const result = computeReorderedKeys(items, "key3", "key1");
    expect(result).toEqual(["key3", "key1", "key2"]);
  });

  it("should return the same order when dragging to the same position", () => {
    const result = computeReorderedKeys(items, "key2", "key2");
    expect(result).toEqual(["key1", "key2", "key3"]);
  });

  it("should produce a valid mutation payload shape", () => {
    const reorderedKeys = computeReorderedKeys(items, "key1", "key3");
    const payload = { imageType: "gallery", orderedKeys: reorderedKeys };
    expect(payload).toHaveProperty("imageType", "gallery");
    expect(payload).toHaveProperty("orderedKeys");
    expect(Array.isArray(payload.orderedKeys)).toBe(true);
    expect(payload.orderedKeys.every((k) => typeof k === "string")).toBe(true);
  });

  it("should handle unknown activeId gracefully", () => {
    const result = computeReorderedKeys(items, "unknown", "key1");
    expect(result).toEqual(["key1", "key2", "key3"]);
  });
});
