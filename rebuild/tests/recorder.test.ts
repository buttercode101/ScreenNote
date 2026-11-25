import { afterEach, describe, expect, it, vi } from "vitest";
import { recordingProfile, supportedMimeType } from "../src/recorder";

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
describe("recording quality presets",()=>{
  it("keeps the saver preset within 720p and a lower bitrate",()=>{
    expect(recordingProfile("saver")).toMatchObject({width:1280,height:720,fps:24});
    expect(recordingProfile("saver").videoBitsPerSecond).toBeLessThan(recordingProfile("balanced").videoBitsPerSecond);
  });
  it("uses balanced 1080p defaults and a sharper high-quality preset",()=>{
    expect(recordingProfile("balanced")).toMatchObject({width:1920,height:1080,fps:30});
    expect(recordingProfile("clear")).toMatchObject({width:2560,height:1440,fps:30});
  });
});
