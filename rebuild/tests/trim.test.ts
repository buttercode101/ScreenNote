import { describe, expect, it } from "vitest";
import { clampTrimRange } from "../src/trim";
describe("local trim range", () => {
  it("clamps a valid selection to the media duration", () => {
    expect(clampTrimRange(2.5, 9.5, 10)).toEqual({ start: 2.5, end: 9.5, duration: 7 });
  });
  it("rejects ranges shorter than one second", () => {
    expect(() => clampTrimRange(2, 2.5, 10)).toThrow("at least one second");
  });
  it("rejects missing duration metadata and clips over ten minutes", () => {
    expect(() => clampTrimRange(0, 1, 0)).toThrow("readable duration");
    expect(() => clampTrimRange(0, 601, 601)).toThrow("10 minutes");
  });
});
