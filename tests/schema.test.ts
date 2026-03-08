import { describe, it, expect } from "vitest";
import { configImages, insertConfigImageSchema } from "@shared/schema";

describe("Schema - configImages", () => {
  it("should have a displayOrder column", () => {
    expect(configImages.displayOrder).toBeDefined();
  });

  it("insertConfigImageSchema should accept displayOrder as an optional field", () => {
    const validWithoutOrder = insertConfigImageSchema.safeParse({
      imageKey: "test_key",
      imageUrl: "https://example.com/image.jpg",
      imageType: "gallery",
    });
    expect(validWithoutOrder.success).toBe(true);

    const validWithOrder = insertConfigImageSchema.safeParse({
      imageKey: "test_key",
      imageUrl: "https://example.com/image.jpg",
      imageType: "gallery",
      displayOrder: 5,
    });
    expect(validWithOrder.success).toBe(true);
  });

  it("displayOrder should default to 0 in the schema definition", () => {
    const column = configImages.displayOrder;
    expect(column.hasDefault).toBe(true);
  });
});
