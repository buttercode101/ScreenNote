export type QualityPreset = "saver" | "balanced" | "clear";
export type CameraBubble = { x: number; y: number; size: number };
export type CaptureOptions = { microphone: boolean; systemAudio: boolean; camera: boolean; quality?: QualityPreset; microphoneId?: string; cameraBubble?: CameraBubble };
export type RecordingResult = { blob: Blob; duration: number; mimeType: string };
export type ChunkWriter = (blob: Blob, index: number) => Promise<void>;
export type RecordingProfile = { width: number; height: number; fps: number; videoBitsPerSecond: number; audioBitsPerSecond: number };

const PROFILES: Record<QualityPreset, RecordingProfile> = {
  saver: { width: 1280, height: 720, fps: 24, videoBitsPerSecond: 1_400_000, audioBitsPerSecond: 96_000 },
  balanced: { width: 1920, height: 1080, fps: 30, videoBitsPerSecond: 3_000_000, audioBitsPerSecond: 128_000 },
  clear: { width: 2560, height: 1440, fps: 30, videoBitsPerSecond: 5_000_000, audioBitsPerSecond: 160_000 }
};
const MIME_TYPES = ["video/webm;codecs=vp9,opus","video/webm;codecs=vp8,opus","video/webm","video/mp4"];
export function recordingProfile(quality: QualityPreset = "balanced"): RecordingProfile { return PROFILES[quality]; }
export function supportedMimeType(): string { return MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) ?? ""; }

export class ScreenRecorder {
  private recorder?: MediaRecorder;
  private stream?: MediaStream;
  private sourceStreams: MediaStream[] = [];
  private audioContext?: AudioContext;
  private cleanupVideo?: () => void;
  private displayTrack?: MediaStreamTrack;
  private frameId = 0;
  private chunks: Blob[] = [];
  private pendingWrites: Promise<void>[] = [];
  private chunkIndex = 0;
  private startedAt = 0;
  private pausedAt = 0;
  private pausedDuration = 0;
  private timer?: number;
  private onTick?: (seconds: number) => void;
  private onSourceEnded?: () => void;

  get state(): RecordingState | "inactive" { return this.recorder?.state ?? "inactive"; }

  async start(options: CaptureOptions, onTick: (seconds: number) => void, writeChunk: ChunkWriter, onSourceEnded?: () => void): Promise<void> {
    if (this.recorder && this.recorder.state !== "inactive") throw new Error("A recording is already active.");
    if (!navigator.mediaDevices?.getDisplayMedia) throw new Error("Screen recording is not supported in this browser. Try desktop Chrome or Edge, or import a recording.");
    const quality = options.quality ?? "balanced";
    const profile = recordingProfile(quality);
    const bubble = options.cameraBubble ?? { x: .76, y: .72, size: .27 };
    const display = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: { ideal: profile.fps, max: profile.fps }, width: { ideal: profile.width }, height: { ideal: profile.height } },
      audio: options.systemAudio
    });
    let microphone: MediaStream | undefined, camera: MediaStream | undefined, composite: MediaStream | undefined, audioContext: AudioContext | undefined, cleanupVideo: (() => void) | undefined;
    try {
      if (options.microphone) microphone = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, ...(options.microphoneId ? { deviceId: { exact: options.microphoneId } } : {}) } });
      if (options.camera) camera = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" }, audio: false });
      const displayTrack = display.getVideoTracks()[0];
      if (!displayTrack) throw new Error("The selected screen did not provide a video track.");
      let videoTrack: MediaStreamTrack = displayTrack;
      if (camera) {
        const canvas = document.createElement("canvas"), settings = displayTrack.getSettings();
        const sourceWidth = settings.width || profile.width, sourceHeight = settings.height || profile.height;
        canvas.width = Math.max(640, Math.min(profile.width, sourceWidth));
        canvas.height = Math.max(360, Math.round(canvas.width * sourceHeight / sourceWidth));
        const context = canvas.getContext("2d");
        if (!context || typeof canvas.captureStream !== "function") throw new Error("Camera overlay recording is not supported in this browser.");
        const screenVideo = document.createElement("video"), cameraVideo = document.createElement("video");
        screenVideo.muted = true; screenVideo.playsInline = true; screenVideo.srcObject = display;
        cameraVideo.muted = true; cameraVideo.playsInline = true; cameraVideo.srcObject = camera;
        await Promise.all([screenVideo.play(), cameraVideo.play()]);
        const draw = () => {
          if (screenVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) context.drawImage(screenVideo, 0, 0, canvas.width, canvas.height);
          else { context.fillStyle = "#111"; context.fillRect(0, 0, canvas.width, canvas.height); }
          if (cameraVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && cameraVideo.videoWidth && cameraVideo.videoHeight) {
            const size = Math.round(Math.min(canvas.width, canvas.height) * Math.max(.12, Math.min(.4, bubble.size)));
            const x = Math.round(Math.max(0, Math.min(1 - size / canvas.width, bubble.x)) * canvas.width);
            const y = Math.round(Math.max(0, Math.min(1 - size / canvas.height, bubble.y)) * canvas.height);
            const crop = Math.min(cameraVideo.videoWidth, cameraVideo.videoHeight), sx = (cameraVideo.videoWidth - crop) / 2, sy = (cameraVideo.videoHeight - crop) / 2;
            context.save(); context.shadowColor = "rgba(0,0,0,.28)"; context.shadowBlur = size * .08;
            context.beginPath(); context.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2); context.clip();
            context.drawImage(cameraVideo, sx, sy, crop, crop, x, y, size, size); context.restore();
            context.beginPath(); context.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
            context.lineWidth = Math.max(3, canvas.width * .004); context.strokeStyle = "rgba(255,255,255,.94)"; context.stroke();
          }
          this.frameId = requestAnimationFrame(draw);
        };
        draw(); composite = canvas.captureStream(profile.fps); videoTrack = composite.getVideoTracks()[0];
        cleanupVideo = () => { cancelAnimationFrame(this.frameId); screenVideo.pause(); screenVideo.srcObject = null; cameraVideo.pause(); cameraVideo.srcObject = null; };
      }
      const audioTracks = [...display.getAudioTracks(), ...(microphone?.getAudioTracks() ?? [])];
      let audioTrack: MediaStreamTrack | undefined;
      if (audioTracks.length === 1) audioTrack = audioTracks[0];
      else if (audioTracks.length > 1) {
        if (!window.AudioContext) throw new Error("Mixing microphone and system audio is not supported in this browser.");
        audioContext = new AudioContext(); await audioContext.resume();
        const destination = audioContext.createMediaStreamDestination();
        for (const track of audioTracks) audioContext.createMediaStreamSource(new MediaStream([track])).connect(destination);
        audioTrack = destination.stream.getAudioTracks()[0];
      }
      this.stream = new MediaStream([videoTrack, ...(audioTrack ? [audioTrack] : [])]);
      this.sourceStreams = [display, ...(microphone ? [microphone] : []), ...(camera ? [camera] : []), ...(composite ? [composite] : [])];
      this.audioContext = audioContext; this.cleanupVideo = cleanupVideo; this.displayTrack = displayTrack;
      this.onTick = onTick; this.onSourceEnded = onSourceEnded;
      const mimeType = supportedMimeType();
      this.recorder = new MediaRecorder(this.stream, { ...(mimeType ? { mimeType } : {}), videoBitsPerSecond: profile.videoBitsPerSecond, audioBitsPerSecond: profile.audioBitsPerSecond });
      this.chunks = []; this.pendingWrites = []; this.chunkIndex = 0;
      this.recorder.ondataavailable = (event) => {
        if (event.data.size) {
          this.chunks.push(event.data);
          this.pendingWrites.push(writeChunk(event.data, this.chunkIndex++));
        }
      };
      displayTrack.addEventListener("ended", () => {
        if (this.recorder?.state === "recording" || this.recorder?.state === "paused") {
          this.stop().then((result) => window.dispatchEvent(new CustomEvent<RecordingResult>("screennote:recording-finished", { detail: result }))).catch(() => undefined);
        } else {
          this.cancel(); this.onSourceEnded?.();
        }
      }, { once: true });
    } catch (error) {
      cleanupVideo?.(); [display, ...(microphone ? [microphone] : []), ...(camera ? [camera] : []), ...(composite ? [composite] : [])].forEach(source => source.getTracks().forEach(track => track.stop()));
      await audioContext?.close().catch(() => undefined); throw error;
    }
  }

  begin(): void {
    if (!this.recorder || this.recorder.state !== "inactive") throw new Error("Recording setup is no longer available.");
    this.startedAt = Date.now(); this.pausedDuration = 0; this.pausedAt = 0;
    this.recorder.start(1000);
    this.timer = window.setInterval(() => {
      if (!this.recorder || this.recorder.state === "inactive") { this.clearTimer(); return; }
      if (this.recorder.state === "recording") this.onTick?.(Math.max(0, Math.floor((Date.now() - this.startedAt - this.pausedDuration) / 1000)));
    }, 500);
  }

  pause(): void { if (this.recorder?.state === "recording") { this.recorder.pause(); this.pausedAt = Date.now(); } }
  resume(): void { if (this.recorder?.state === "paused") { this.pausedDuration += Date.now() - this.pausedAt; this.recorder.resume(); } }

  stop(): Promise<RecordingResult> {
    const recorder = this.recorder;
    if (!recorder || recorder.state === "inactive") return Promise.reject(new Error("No recording is active."));
    const wasPaused = recorder.state === "paused", pausedAt = this.pausedAt;
    return new Promise((resolve, reject) => {
      recorder.onerror = () => { this.cleanup(); reject(new Error("The browser could not finish this recording.")); };
      recorder.onstop = async () => {
        await Promise.allSettled(this.pendingWrites);
        const blob = new Blob(this.chunks, { type: recorder.mimeType || "video/webm" });
        const activePause = wasPaused ? Date.now() - pausedAt : 0;
        const duration = Math.max(0, Math.floor((Date.now() - this.startedAt - this.pausedDuration - activePause) / 1000));
        this.cleanup();
        if (!blob.size) reject(new Error("The recording was empty. Please try again."));
        else resolve({ blob, duration, mimeType: blob.type });
      };
      recorder.stop();
    });
  }

  cancel(): void {
    if (this.recorder && this.recorder.state !== "inactive") this.recorder.stop();
    this.cleanup();
  }

  private clearTimer(): void { if (this.timer !== undefined) window.clearInterval(this.timer); this.timer = undefined; }
  private cleanup(): void {
    this.clearTimer(); this.displayTrack?.removeEventListener("ended", this.handleDisplayEnded);
    this.stream?.getTracks().forEach(track => track.stop());
    this.sourceStreams.forEach(source => source.getTracks().forEach(track => track.stop()));
    this.cleanupVideo?.(); void this.audioContext?.close().catch(() => undefined);
    this.stream = undefined; this.sourceStreams = []; this.audioContext = undefined; this.cleanupVideo = undefined; this.displayTrack = undefined; this.recorder = undefined; this.chunks = []; this.pendingWrites = []; this.onTick = undefined; this.onSourceEnded = undefined;
  }
  private handleDisplayEnded = () => undefined;
}
