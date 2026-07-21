import { describe, it, expect } from "vitest";
import { parseWeddingConfig } from "../useWeddingConfig";
import { WEDDING_DATE } from "@/lib/constants";

describe("parseWeddingConfig", () => {
  it("falls back to constants when no override", () => {
    const cfg = parseWeddingConfig({});
    expect(cfg.weddingDate.getTime()).toBe(WEDDING_DATE.getTime());
    expect(cfg.venues).toHaveLength(2);
  });

  it("uses a valid date override", () => {
    const cfg = parseWeddingConfig({ "*": { "wedding.date": "2027-01-02T10:00:00+07:00" } });
    expect(cfg.weddingDate.getUTCFullYear()).toBe(2027);
  });

  it("falls back on an invalid date override", () => {
    const cfg = parseWeddingConfig({ "*": { "wedding.date": "garbage" } });
    expect(cfg.weddingDate.getTime()).toBe(WEDDING_DATE.getTime());
  });

  it("overrides a venue time via '*' locale", () => {
    const cfg = parseWeddingConfig({ "*": { "venue.matrimony.time": "1:00 PM - 5:00 PM" } });
    expect(cfg.venues[0].time).toBe("1:00 PM - 5:00 PM");
  });
});
