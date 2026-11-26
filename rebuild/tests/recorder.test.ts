import { afterEach, describe, expect, it, vi } from "vitest";
import { cameraBubbleFootprint, recordingProfile, supportedMimeType } from "../src/recorder";

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

describe("camera bubble bounds",()=>{
  it("accounts for the shorter canvas dimension on landscape and portrait screens",()=>{
    expect(cameraBubbleFootprint(.27,16/9)).toEqual({width:.27*9/16,height:.27});
    expect(cameraBubbleFootprint(.27,9/16)).toEqual({width:.27,height:.27*9/16});
  });
  it("clamps invalid size and aspect inputs to a safe preview footprint",()=>{
    expect(cameraBubbleFootprint(Number.NaN,0)).toEqual({width:.27*9/16,height:.27});
    expect(cameraBubbleFootprint(2,16/9).height).toBe(.4);
  });
});
