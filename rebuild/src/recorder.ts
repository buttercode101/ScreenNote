export type CaptureOptions = { microphone: boolean; systemAudio: boolean; camera: boolean };
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
  private sourceStreams: MediaStream[] = [];
  private audioContext?: AudioContext;
  private cleanupVideo?: () => void;
  private frameId = 0;
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
    let camera: MediaStream | undefined;
    let composite: MediaStream | undefined;
    let audioContext: AudioContext | undefined;
    let cleanupVideo: (() => void) | undefined;

    try {
      if (options.microphone) {
        microphone = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      }
      if (options.camera) {
        camera = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" }, audio: false });
      }

      const displayTrack = display.getVideoTracks()[0];
      if (!displayTrack) throw new Error("The selected screen did not provide a video track.");
      let videoTrack: MediaStreamTrack = displayTrack;

      if (camera) {
        const canvas = document.createElement("canvas");
        const settings = displayTrack.getSettings();
        canvas.width = Math.max(640, Math.min(3840, settings.width ?? 1280));
        canvas.height = Math.max(360, Math.min(2160, settings.height ?? 720));
        const context = canvas.getContext("2d");
        if (!context || typeof canvas.captureStream !== "function") {
          throw new Error("Camera overlay recording is not supported in this browser.");
        }

        const screenVideo = document.createElement("video");
        screenVideo.muted = true;
        screenVideo.playsInline = true;
        screenVideo.srcObject = display;
        const cameraVideo = document.createElement("video");
        cameraVideo.muted = true;
        cameraVideo.playsInline = true;
        cameraVideo.srcObject = camera;
        await Promise.all([screenVideo.play(), cameraVideo.play()]);

        const draw = () => {
          if (screenVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
            context.drawImage(screenVideo, 0, 0, canvas.width, canvas.height);
          } else {
            context.fillStyle = "#111";
            context.fillRect(0, 0, canvas.width, canvas.height);
          }
          if (cameraVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && cameraVideo.videoWidth && cameraVideo.videoHeight) {
            const size = Math.round(Math.min(canvas.width, canvas.height) * 0.27);
            const margin = Math.round(Math.min(canvas.width, canvas.height) * 0.045);
            const x = canvas.width - size - margin;
            const y = canvas.height - size - margin;
            const crop = Math.min(cameraVideo.videoWidth, cameraVideo.videoHeight);
            const sx = (cameraVideo.videoWidth - crop) / 2;
            const sy = (cameraVideo.videoHeight - crop) / 2;
            context.save();
            context.shadowColor = "rgba(0,0,0,.28)";
            context.shadowBlur = size * 0.08;
            context.beginPath();
            context.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
            context.clip();
            context.drawImage(cameraVideo, sx, sy, crop, crop, x, y, size, size);
            context.restore();
            context.beginPath();
            context.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
            context.lineWidth = Math.max(3, canvas.width * 0.004);
            context.strokeStyle = "rgba(255,255,255,.94)";
            context.stroke();
          }
          this.frameId = requestAnimationFrame(draw);
        };
        draw();
        composite = canvas.captureStream(30);
        videoTrack = composite.getVideoTracks()[0];
        cleanupVideo = () => {
          cancelAnimationFrame(this.frameId);
          screenVideo.pause();
          screenVideo.srcObject = null;
          cameraVideo.pause();
          cameraVideo.srcObject = null;
        };
      }

      const audioTracks = [...display.getAudioTracks(), ...(microphone?.getAudioTracks() ?? [])];
      let audioTrack: MediaStreamTrack | undefined;
      if (audioTracks.length === 1) {
        audioTrack = audioTracks[0];
      } else if (audioTracks.length > 1) {
        if (!window.AudioContext) throw new Error("Mixing microphone and system audio is not supported in this browser.");
        audioContext = new AudioContext();
        await audioContext.resume();
        const destination = audioContext.createMediaStreamDestination();
        for (const track of audioTracks) {
          audioContext.createMediaStreamSource(new MediaStream([track])).connect(destination);
        }
        audioTrack = destination.stream.getAudioTracks()[0];
      }

      this.stream = new MediaStream([videoTrack, ...(audioTrack ? [audioTrack] : [])]);
      this.sourceStreams = [display, ...(microphone ? [microphone] : []), ...(camera ? [camera] : []), ...(composite ? [composite] : [])];
      this.audioContext = audioContext;
      this.cleanupVideo = cleanupVideo;
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
      displayTrack.addEventListener("ended", () => {
        if (this.recorder?.state !== "inactive") {
          this.stop().then((result) => {
            window.dispatchEvent(new CustomEvent<RecordingResult>("screennote:recording-finished", { detail: result }));
          }).catch(() => undefined);
        }
      }, { once: true });
    } catch (error) {
      cleanupVideo?.();
      this.sourceStreams = [display, ...(microphone ? [microphone] : []), ...(camera ? [camera] : []), ...(composite ? [composite] : [])];
      this.sourceStreams.forEach((source) => source.getTracks().forEach((track) => track.stop()));
      await audioContext?.close().catch(() => undefined);
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
        this.sourceStreams.forEach((source) => source.getTracks().forEach((track) => track.stop()));
        this.cleanupVideo?.();
        await this.audioContext?.close().catch(() => undefined);
        this.stream = undefined;
        this.sourceStreams = [];
        this.audioContext = undefined;
        this.cleanupVideo = undefined;
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