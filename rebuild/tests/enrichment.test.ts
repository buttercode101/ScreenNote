import { describe, expect, it } from "vitest";
// @ts-expect-error Shared browser-safe JavaScript module has no declaration file.
import {
  captionsVTT,
  parseCaptions,
  parseChapters,
  reportMarkdown,
  trimExtras,
  validateExtras
} from "../legacy/lib/enrichment.js";

describe("owner-supplied video context", () => {
  it("parses SRT and WebVTT timestamps and exports valid WebVTT", () => {
    const cues = parseCaptions("1\n00:00:01,000 --> 00:00:02,500\nFirst step\n\n2\n00:00:03.000 --> 00:00:04.000\nSecond step", 10);
    expect(cues).toEqual([
      { start: 1, end: 2.5, text: "First step" },
      { start: 3, end: 4, text: "Second step" }
    ]);
    expect(captionsVTT(cues)).toContain("00:00:01.000 --> 00:00:02.500");
  });

  it("rejects malformed, unordered, out-of-range and oversized caption data", () => {
    expect(() => parseCaptions("00:00:02 --> 00:00:03\nLate\n\n00:00:01 --> 00:00:02\nEarly", 10)).toThrow();
    expect(() => parseCaptions("00:00:01 --> 00:00:01\nZero length", 10)).toThrow();
    expect(() => parseCaptions("00:00:01 --> 00:00:12\nToo long", 10)).toThrow();
    expect(() => parseCaptions("x".repeat(20001), 10)).toThrow();
  });

  it("validates ordered chapters and rejects duplicate or out-of-range timestamps", () => {
    expect(parseChapters("0:01 Opening\n0:05 Checkout", 10)).toEqual([
      { time: 1, title: "Opening" },
      { time: 5, title: "Checkout" }
    ]);
    expect(() => parseChapters("0:05 Later\n0:04 Earlier", 10)).toThrow();
    expect(() => parseChapters("0:10 End", 10)).toThrow();
  });

  it("trims captions and chapters to a selected interval without mutating the source", () => {
    const source = {
      captions: [
        { start: 0, end: 2, text: "before and overlap" },
        { start: 3, end: 4, text: "inside" },
        { start: 8, end: 9, text: "after" }
      ],
      chapters: [{ time: 1, title: "Start" }, { time: 3, title: "Middle" }, { time: 8, title: "End" }],
      report: null
    };
    const result = trimExtras(source, 1.5, 5);
    expect(result.captions).toEqual([
      { start: 0, end: 0.5, text: "before and overlap" },
      { start: 1.5, end: 2.5, text: "inside" }
    ]);
    expect(result.chapters).toEqual([{ time: 1.5, title: "Middle" }]);
    expect(source.captions[0].start).toBe(0);
  });

  it("rejects credentials in bug-report URLs and exports only supplied context", () => {
    expect(() => validateExtras({ report: { url: "https://user:secret@example.com/private" } }, 10)).toThrow();
    const markdown = reportMarkdown({
      id: "test-id", title: "Checkout issue", shared: false,
      report: { url: "https://example.com/checkout", steps: "Open checkout", expected: "Payment appears", actual: "Payment is missing", environment: "" },
      chapters: [], captions: []
    }, "https://screennote.test");
    expect(markdown).toContain("Open checkout");
    expect(markdown).not.toContain("screennote.test");
  });
});
