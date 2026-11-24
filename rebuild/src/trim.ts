export type TrimRange = { start: number; end: number; duration: number };
export function clampTrimRange(start: number, end: number, duration: number): TrimRange {
  if (!Number.isFinite(duration) || duration <= 0) throw new Error("This video has no readable duration.");
  const safeStart = Math.max(0, Math.min(duration, Number.isFinite(start) ? start : 0));
  const safeEnd = Math.max(0, Math.min(duration, Number.isFinite(end) ? end : duration));
  if (safeEnd - safeStart < 1) throw new Error("Choose at least one second of video.");
  if (safeEnd - safeStart > 600) throw new Error("Shared clips must be 10 minutes or shorter.");
  return { start: safeStart, end: safeEnd, duration: safeEnd - safeStart };
}
export async function trimVideoElement(video: HTMLVideoElement, range: TrimRange): Promise<Blob> {
  const media = video as HTMLVideoElement & { captureStream?: () => MediaStream; mozCaptureStream?: () => MediaStream };
  const capture = media.captureStream ?? media.mozCaptureStream;
  if (!capture || typeof MediaRecorder === "undefined") throw new Error("Local trimming is not supported in this browser. Download the original and trim it with a video editor.");
  const types = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
  const mimeType = types.find(type => MediaRecorder.isTypeSupported(type));
  const stream = capture.call(video);
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks: Blob[] = [];
  let stopTimer = 0;
  const seek = () => new Promise<void>((resolve, reject) => {
    if (Math.abs(video.currentTime - range.start) < 0.05) { resolve(); return; }
    const onSeeked = () => { cleanup(); resolve(); };
    const onError = () => { cleanup(); reject(new Error("The video could not seek to the selected start point.")); };
    const cleanup = () => { video.removeEventListener("seeked", onSeeked); video.removeEventListener("error", onError); };
    video.addEventListener("seeked", onSeeked, { once: true });
    video.addEventListener("error", onError, { once: true });
    video.currentTime = range.start;
  });
  try {
    video.pause();
    await seek();
    const result = new Promise<Blob>((resolve, reject) => {
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recorder.onerror = () => reject(new Error("The trimmed recording could not be encoded."));
      recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType || "video/webm" }));
    });
    const stopAtEnd = () => { if (video.currentTime >= range.end && recorder.state !== "inactive") recorder.stop(); };
    const stopAtMediaEnd = () => { if (recorder.state !== "inactive") recorder.stop(); };
    video.addEventListener("timeupdate", stopAtEnd);
    video.addEventListener("ended", stopAtMediaEnd);
    recorder.start(200);
    await video.play();
    stopTimer = window.setTimeout(() => { if (recorder.state !== "inactive") recorder.stop(); }, Math.ceil(range.duration * 1000) + 3000);
    const blob = await result;
    video.removeEventListener("timeupdate", stopAtEnd);
    video.removeEventListener("ended", stopAtMediaEnd);
    if (!blob.size) throw new Error("The trimmed video was empty. Try a different range.");
    return blob;
  } finally {
    window.clearTimeout(stopTimer);
    video.pause();
    stream.getTracks().forEach(track => track.stop());
  }
}
