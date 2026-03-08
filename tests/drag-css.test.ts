import { describe, it, expect } from "vitest";

function getCardClassName(isDragging: boolean, isDragActive: boolean): string {
  const base = "overflow-hidden";

  if (isDragging) {
    return `${base} ring-2 ring-pink-400 shadow-lg`;
  }

  if (isDragActive) {
    return `${base} transition-none`;
  }

  return base;
}

describe("Drag CSS Simplification", () => {
  it("should return full styles when no drag is active", () => {
    const cls = getCardClassName(false, false);
    expect(cls).toBe("overflow-hidden");
    expect(cls).not.toContain("transition-none");
  });

  it("should return drag highlight styles for the dragged item", () => {
    const cls = getCardClassName(true, true);
    expect(cls).toContain("ring-2");
    expect(cls).toContain("ring-pink-400");
    expect(cls).toContain("shadow-lg");
  });

  it("should simplify styles on non-dragged items during active drag", () => {
    const cls = getCardClassName(false, true);
    expect(cls).toContain("transition-none");
    expect(cls).not.toContain("shadow-lg");
    expect(cls).not.toContain("ring-2");
  });

  it("dragging item should not have transition-none", () => {
    const cls = getCardClassName(true, true);
    expect(cls).not.toContain("transition-none");
  });
});
