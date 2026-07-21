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

  it("registry keys match the checked-in Go dump", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const dump = fs
      .readFileSync(path.resolve(__dirname, "../../../../go-server/testdata/content_keys.txt"), "utf8")
      .trim()
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .sort();
    const keys = CONTENT_REGISTRY.map((f) => f.key).sort();
    expect(keys).toEqual(dump);
  });
});
