export type CaptureOptions = { microphone: boolean; systemAudio: boolean };
export type RecordingResult = { blob: Blob; duration: number; mimeType: string };
export type ChunkWriter = (blob: Blob, index: number) => Promise<void>;

const MIME_TYPES = [
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
  "video/mp4"
];

export function supportedMimeType(): string {
  return MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

export class ScreenRecorder {
  private recorder?: MediaRecorder;
  private stream?: MediaStream;
  private chunks: Blob[] = [];
  private pendingWrites: Promise<void>[] = [];
  private chunkIndex = 0;
  private startedAt = 0;
  private pausedAt = 0;
  private pausedDuration = 0;

  get state(): RecordingState | "inactive" {
    return this.recorder?.state ?? "inactive";
  }

  async start(options: CaptureOptions, onTick: (seconds: number) => void, writeChunk: ChunkWriter): Promise<void> {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      throw new Error("Screen recording is not supported in this browser. Try a desktop version of Chrome or Edge, or import a recording.");
    }
    const display = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: { ideal: 30, max: 60 } },
      audio: options.systemAudio
    });
    let microphone: MediaStream | undefined;
    try {
      if (options.microphone) {
        microphone = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      }
      const tracks = [...display.getVideoTracks(), ...display.getAudioTracks(), ...(microphone?.getAudioTracks() ?? [])];
      this.stream = new MediaStream(tracks);
      const mimeType = supportedMimeType();
      this.recorder = new MediaRecorder(this.stream, mimeType ? { mimeType } : undefined);
      this.chunks = [];
      this.pendingWrites = [];
      this.chunkIndex = 0;
      this.startedAt = Date.now();
      this.pausedDuration = 0;
      this.recorder.ondataavailable = (event) => {
        if (event.data.size) {
          this.chunks.push(event.data);
          this.pendingWrites.push(writeChunk(event.data, this.chunkIndex++).catch(() => undefined));
        }
      };
      this.recorder.start(1000);
      const timer = window.setInterval(() => {
        if (!this.recorder || this.recorder.state === "inactive") {
          window.clearInterval(timer);
          return;
        }
        if (this.recorder.state === "recording") onTick(Math.max(0, Math.floor((Date.now() - this.startedAt - this.pausedDuration) / 1000)));
      }, 500);
      this.recorder.addEventListener("stop", () => window.clearInterval(timer), { once: true });
      display.getVideoTracks()[0]?.addEventListener("ended", () => {
        if (this.recorder?.state !== "inactive") {
          this.stop().then((result) => {
            window.dispatchEvent(new CustomEvent<RecordingResult>("screennote:recording-finished", { detail: result }));
          }).catch(() => undefined);
        }
      }, { once: true });
    } catch (error) {
      display.getTracks().forEach((track) => track.stop());
      microphone?.getTracks().forEach((track) => track.stop());
      throw error;
    }
  }

  pause(): void {
    if (this.recorder?.state === "recording") {
      this.recorder.pause();
      this.pausedAt = Date.now();
    }
  }

  resume(): void {
    if (this.recorder?.state === "paused") {
      this.pausedDuration += Date.now() - this.pausedAt;
      this.recorder.resume();
    }
  }

  stop(): Promise<RecordingResult> {
    const recorder = this.recorder;
    if (!recorder) return Promise.reject(new Error("No recording is active"));
    const wasPaused = recorder.state === "paused";
    const pausedAt = this.pausedAt;
    return new Promise((resolve, reject) => {
      recorder.onerror = () => reject(new Error("The browser could not finish this recording."));
      recorder.onstop = async () => {
        await Promise.allSettled(this.pendingWrites);
        const blob = new Blob(this.chunks, { type: recorder.mimeType || "video/webm" });
        const activePause = wasPaused ? Date.now() - pausedAt : 0;
        const duration = Math.max(0, Math.floor((Date.now() - this.startedAt - this.pausedDuration - activePause) / 1000));
        this.stream?.getTracks().forEach((track) => track.stop());
        this.stream = undefined;
        this.recorder = undefined;
        this.chunks = [];
        this.pendingWrites = [];
        if (!blob.size) reject(new Error("The recording was empty. Please try again."));
        else resolve({ blob, duration, mimeType: blob.type });
      };
      if (recorder.state !== "inactive") recorder.stop();
      else reject(new Error("The recording has already stopped."));
    });
  }
}