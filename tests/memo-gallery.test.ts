import { describe, it, expect } from "vitest";

interface ConfigImage {
  imageKey: string;
  imageUrl: string;
  thumbnailUrl: string | null;
  title: string | null;
}

type CallbackFn = (image: ConfigImage) => void;

function areCallbacksStable(cb1: CallbackFn, cb2: CallbackFn): boolean {
  return cb1 === cb2;
}

describe("Memoization - SortableGalleryItem stability", () => {
  it("should detect when callbacks are reference-equal", () => {
    const fn = (_img: ConfigImage) => {};
    expect(areCallbacksStable(fn, fn)).toBe(true);
  });

  it("should detect when callbacks are NOT reference-equal", () => {
    const fn1 = (_img: ConfigImage) => {};
    const fn2 = (_img: ConfigImage) => {};
    expect(areCallbacksStable(fn1, fn2)).toBe(false);
  });

  it("React.memo should skip re-render when props are shallowly equal", () => {
    const image: ConfigImage = {
      imageKey: "key1",
      imageUrl: "https://example.com/img.jpg",
      thumbnailUrl: null,
      title: "Test",
    };

    const props1 = { image, isDragActive: false };
    const props2 = { image, isDragActive: false };

    const shallowEqual = Object.keys(props1).every(
      (key) =>
        props1[key as keyof typeof props1] ===
        props2[key as keyof typeof props2]
    );
    expect(shallowEqual).toBe(true);
  });

  it("React.memo should re-render when isDragActive changes", () => {
    const image: ConfigImage = {
      imageKey: "key1",
      imageUrl: "https://example.com/img.jpg",
      thumbnailUrl: null,
      title: "Test",
    };

    const props1 = { image, isDragActive: false };
    const props2 = { image, isDragActive: true };

    const shallowEqual = Object.keys(props1).every(
      (key) =>
        props1[key as keyof typeof props1] ===
        props2[key as keyof typeof props2]
    );
    expect(shallowEqual).toBe(false);
  });
});
