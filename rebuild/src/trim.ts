export type TrimRange = { start: number; end: number; duration: number };
export function clampTrimRange(start: number, end: number, duration: number): TrimRange {
  if (!Number.isFinite(duration) || duration <= 0) throw new Error("This video has no readable duration.");
  const safeStart = Math.max(0, Math.min(duration, Number.isFinite(start) ? start : 0));
  const safeEnd = Math.max(0, Math.min(duration, Number.isFinite(end) ? end : duration));
  if (safeEnd - safeStart < 1) throw new Error("Choose at least one second of video.");
  if (safeEnd - safeStart > 600) throw new Error("Shared clips must be 10 minutes or shorter.");
  return { start: safeStart, end: safeEnd, duration: safeEnd - safeStart };
}
function seekTo(video: HTMLVideoElement, time: number): Promise<void> {
  if (Math.abs(video.currentTime - time) < 0.05) return Promise.resolve();
  return new Promise((resolve, reject) => {
    let timer = 0;
    const cleanup = () => { window.clearTimeout(timer); video.removeEventListener("seeked", onSeeked); video.removeEventListener("error", onError); };
    const onSeeked = () => { cleanup(); resolve(); };
    const onError = () => { cleanup(); reject(new Error("The video could not seek to the selected point.")); };
    video.addEventListener("seeked", onSeeked, { once: true });
    video.addEventListener("error", onError, { once: true });
    timer = window.setTimeout(() => { cleanup(); reject(new Error("Seeking timed out. Try a different trim point.")); }, 10_000);
    try { video.currentTime = time; } catch { cleanup(); reject(new Error("The video could not seek to the selected point.")); }
  });
}
export async function trimVideoElement(video: HTMLVideoElement, requestedRange: TrimRange): Promise<Blob> {
  const range = clampTrimRange(requestedRange.start, requestedRange.end, video.duration);
  const media = video as HTMLVideoElement & { captureStream?: () => MediaStream; mozCaptureStream?: () => MediaStream };
  const capture = media.captureStream ?? media.mozCaptureStream;
  if (!capture || typeof MediaRecorder === "undefined") throw new Error("Local trimming is not supported in this browser. Download the original and trim it with a video editor.");
  const originalTime = Number.isFinite(video.currentTime) ? video.currentTime : 0;
  const wasPaused = video.paused;
  const stream = capture.call(video);
  let recorder: MediaRecorder | undefined;
  let stopTimer = 0;
  let stopAtEnd: (() => void) | undefined;
  let stopAtMediaEnd: (() => void) | undefined;
  try {
    video.pause();
    await seekTo(video, range.start);
    const types = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
    const mimeType = types.find(type => MediaRecorder.isTypeSupported(type));
    recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const activeRecorder = recorder;
    const chunks: Blob[] = [];
    const result = new Promise<Blob>((resolve, reject) => {
      activeRecorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      activeRecorder.onerror = () => reject(new Error("The trimmed recording could not be encoded."));
      activeRecorder.onstop = () => resolve(new Blob(chunks, { type: activeRecorder.mimeType || "video/webm" }));
    });
    stopAtEnd = () => { if (video.currentTime >= range.end && activeRecorder.state !== "inactive") activeRecorder.stop(); };
    stopAtMediaEnd = () => { if (recorder!.state !== "inactive") recorder!.stop(); };
    video.addEventListener("timeupdate", stopAtEnd);
    video.addEventListener("ended", stopAtMediaEnd);
    activeRecorder.start(200);
    await video.play();
    // A hard ceiling protects against stalled media or a missing timeupdate event.
    stopTimer = window.setTimeout(() => { if (recorder?.state !== "inactive") recorder.stop(); }, Math.min(660_000, Math.ceil(range.duration * 1000) + 15_000));
    const blob = await result;
    if (video.currentTime < range.end - 0.25 && !video.ended) throw new Error("The video stalled before the selected end. Try again; the original is unchanged.");
    if (!blob.size) throw new Error("The trimmed video was empty. Try a different range.");
    return blob;
  } finally {
    window.clearTimeout(stopTimer);
    if (stopAtEnd) video.removeEventListener("timeupdate", stopAtEnd);
    if (stopAtMediaEnd) video.removeEventListener("ended", stopAtMediaEnd);
    if (recorder && recorder.state !== "inactive") { try { recorder.stop(); } catch { /* Already stopping. */ } }
    video.pause();
    stream.getTracks().forEach(track => track.stop());
    try { await seekTo(video, Math.min(originalTime, Number.isFinite(video.duration) ? video.duration : originalTime)); } catch { /* Preserve the completed edit even if the source cannot restore its playhead. */ }
    if (!wasPaused) await video.play().catch(() => undefined);
  }
}
