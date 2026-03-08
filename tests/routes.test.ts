import { describe, it, expect } from "vitest";
import { z } from "zod";

const reorderBodySchema = z.object({
  imageType: z.string().min(1),
  orderedKeys: z.array(z.string().min(1)).min(1),
});

describe("Routes - Reorder Config Images Validation", () => {
  it("should accept valid reorder body", () => {
    const result = reorderBodySchema.safeParse({
      imageType: "gallery",
      orderedKeys: ["key1", "key2", "key3"],
    });
    expect(result.success).toBe(true);
  });

  it("should reject missing imageType", () => {
    const result = reorderBodySchema.safeParse({
      orderedKeys: ["key1", "key2"],
    });
    expect(result.success).toBe(false);
  });

  it("should reject missing orderedKeys", () => {
    const result = reorderBodySchema.safeParse({
      imageType: "gallery",
    });
    expect(result.success).toBe(false);
  });

  it("should reject empty orderedKeys array", () => {
    const result = reorderBodySchema.safeParse({
      imageType: "gallery",
      orderedKeys: [],
    });
    expect(result.success).toBe(false);
  });

  it("should reject empty imageType string", () => {
    const result = reorderBodySchema.safeParse({
      imageType: "",
      orderedKeys: ["key1"],
    });
    expect(result.success).toBe(false);
  });

  it("should reject non-string values in orderedKeys", () => {
    const result = reorderBodySchema.safeParse({
      imageType: "gallery",
      orderedKeys: [123, null],
    });
    expect(result.success).toBe(false);
  });
});
