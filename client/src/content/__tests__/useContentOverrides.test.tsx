import { describe, it, expect } from "vitest";
import { buildOverrideMap } from "../useContentOverrides";

describe("buildOverrideMap", () => {
  it("groups by locale then key", () => {
    const map = buildOverrideMap([
      { key: "hero.saveTheDate", locale: "en", value: "Save!" },
      { key: "hero.saveTheDate", locale: "id", value: "Simpan!" },
      { key: "wedding.date", locale: "*", value: "2026-07-05T14:00:00+07:00" },
    ]);
    expect(map.en["hero.saveTheDate"]).toBe("Save!");
    expect(map.id["hero.saveTheDate"]).toBe("Simpan!");
    expect(map["*"]["wedding.date"]).toBe("2026-07-05T14:00:00+07:00");
  });

  it("ignores empty values", () => {
    const map = buildOverrideMap([{ key: "hero.rsvpNow", locale: "en", value: "" }]);
    expect(map.en?.["hero.rsvpNow"]).toBeUndefined();
  });
});
