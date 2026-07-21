import { describe, it, expect } from "vitest";
import { CONTENT_REGISTRY } from "../registry";
import { en } from "@/locales/en";

describe("content registry", () => {
  it("has unique keys", () => {
    const keys = CONTENT_REGISTRY.map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("every bilingual field's localeKey exists in en locale", () => {
    for (const f of CONTENT_REGISTRY) {
      if (f.bilingual && f.localeKey) {
        expect(en).toHaveProperty(f.localeKey);
      }
    }
  });

  it("structural (non-bilingual) fields have no localeKey", () => {
    for (const f of CONTENT_REGISTRY) {
      if (!f.bilingual) expect(f.localeKey).toBeUndefined();
    }
  });
});
