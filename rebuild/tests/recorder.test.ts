import { afterEach, describe, expect, it, vi } from "vitest";
import { cameraBubbleFootprint, recordingProfile, ScreenRecorder, supportedMimeType } from "../src/recorder";

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

describe("recording setup resource cleanup",()=>{
  afterEach(()=>vi.unstubAllGlobals());
  const captureOptions={microphone:true,systemAudio:false,camera:false};
  it("stops the acquired screen stream when microphone permission is denied",async()=>{
    const stop=vi.fn(),track={stop},display={getTracks:()=>[track]};
    vi.stubGlobal("navigator",{mediaDevices:{getDisplayMedia:vi.fn(async()=>display),getUserMedia:vi.fn(async()=>{throw new Error("microphone denied")})}});
    const recorder=new ScreenRecorder();
    await expect(recorder.start(captureOptions,()=>undefined,async()=>undefined)).rejects.toThrow("microphone denied");
    expect(stop).toHaveBeenCalledTimes(1);
  });
  it("stops both screen and microphone streams when camera permission fails",async()=>{
    const stopScreen=vi.fn(),stopMic=vi.fn();
    const display={getTracks:()=>[{stop:stopScreen}]},microphone={getTracks:()=>[{stop:stopMic}]};
    vi.stubGlobal("navigator",{mediaDevices:{getDisplayMedia:vi.fn(async()=>display),getUserMedia:vi.fn(async({audio}: {audio?:unknown})=>audio?microphone:Promise.reject(new Error("camera denied")))}});
    const recorder=new ScreenRecorder();
    await expect(recorder.start({...captureOptions,camera:true},()=>undefined,async()=>undefined)).rejects.toThrow("camera denied");
    expect(stopScreen).toHaveBeenCalledTimes(1);expect(stopMic).toHaveBeenCalledTimes(1);
  });
  it("stops the display stream if the chooser returns no video track",async()=>{
    const stop=vi.fn(),display={getTracks:()=>[{stop}],getVideoTracks:()=>[]};
    vi.stubGlobal("navigator",{mediaDevices:{getDisplayMedia:vi.fn(async()=>display)}});
    const recorder=new ScreenRecorder();
    await expect(recorder.start({microphone:false,systemAudio:false,camera:false},()=>undefined,async()=>undefined)).rejects.toThrow("did not provide a video track");
    expect(stop).toHaveBeenCalledTimes(1);
  });
});
