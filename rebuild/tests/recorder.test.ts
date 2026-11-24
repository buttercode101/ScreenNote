import { afterEach, describe, expect, it, vi } from "vitest";
import { supportedMimeType } from "../src/recorder";

describe("recording format selection", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("prefers the highest quality supported WebM codec", () => {
    const isTypeSupported = vi.fn((type: string) => type === "video/webm;codecs=vp9,opus");
    vi.stubGlobal("MediaRecorder", { isTypeSupported });
    expect(supportedMimeType()).toBe("video/webm;codecs=vp9,opus");
  });

  it("falls back to VP8 when VP9 is unavailable", () => {
    const isTypeSupported = vi.fn((type: string) => type === "video/webm;codecs=vp8,opus");
    vi.stubGlobal("MediaRecorder", { isTypeSupported });
    expect(supportedMimeType()).toBe("video/webm;codecs=vp8,opus");
  });

  it("returns an empty hint when the browser chooses its default format", () => {
    vi.stubGlobal("MediaRecorder", { isTypeSupported: vi.fn(() => false) });
    expect(supportedMimeType()).toBe("");
  });
});