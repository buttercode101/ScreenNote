import { describe, expect, it } from "vitest";
import { annotationIsVisible, trimAnnotations, visibleAnnotations } from "../src/annotationTiming";
import type { Annotation } from "../src/library";

const mark: Annotation = { kind: "rectangle", x: .1, y: .1, w: .2, h: .2, time: 12, duration: 4 };

describe("playhead-anchored visual annotations", () => {
  it("shows a mark only during its saved time window", () => {
    expect(annotationIsVisible(mark, 11.99)).toBe(false);
    expect(annotationIsVisible(mark, 12)).toBe(true);
    expect(annotationIsVisible(mark, 14)).toBe(true);
    expect(annotationIsVisible(mark, 16.01)).toBe(false);
  });
  it("keeps legacy marks visible throughout the clip", () => {
    const legacy: Annotation = { kind: "redact", x: 0, y: 0, w: .2, h: .2 };
    expect(annotationIsVisible(legacy, 0)).toBe(true);
    expect(annotationIsVisible(legacy, 900)).toBe(true);
  });
  it("filters only the marks that are not active at the playhead", () => {
    const legacy: Annotation = { kind: "arrow", x: 0, y: 0, w: .1, h: .1 };
    expect(visibleAnnotations([legacy, mark], 20)).toEqual([legacy]);
  });
  it("rejects invalid playback time instead of showing stale marks", () => {
    expect(annotationIsVisible(mark, Number.NaN)).toBe(false);
  });

  it("shifts and clips timed marks when saving a trimmed copy", () => {
    const marks: Annotation[] = [
      {kind:"rectangle",x:.1,y:.1,w:.2,h:.2,time:8,duration:5},
      {kind:"arrow",x:.1,y:.1,w:.2,h:.2,time:2,duration:2},
      {kind:"highlight",x:.1,y:.1,w:.2,h:.2,time:18,duration:2},
      {kind:"redact",x:.1,y:.1,w:.2,h:.2}
    ];
    expect(trimAnnotations(marks,10,20)).toEqual([
      {...marks[0],time:0,duration:3},
      {...marks[2],time:8,duration:2},
      marks[3]
    ]);
  });
});
