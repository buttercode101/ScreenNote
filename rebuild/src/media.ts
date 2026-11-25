export async function createVideoThumbnail(blob: Blob): Promise<Blob | undefined> {
  const url = URL.createObjectURL(blob);
  const video = document.createElement("video");
  video.muted = true; video.playsInline = true; video.preload = "auto";
  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve();
      video.onerror = () => reject(new Error("Could not decode this video frame."));
      video.src = url; video.load();
    });
    const target = Math.min(1, Math.max(0, (Number.isFinite(video.duration) ? video.duration : 0) * .12));
    if (target > .05) await new Promise<void>((resolve, reject) => {
      video.onseeked = () => resolve(); video.onerror = () => reject(new Error("Could not seek to the thumbnail frame."));
      video.currentTime = target;
    });
    const sourceWidth = video.videoWidth, sourceHeight = video.videoHeight;
    if (!sourceWidth || !sourceHeight) return undefined;
    const width = 480, height = 270, scale = Math.max(width / sourceWidth, height / sourceHeight);
    const cropWidth = width / scale, cropHeight = height / scale;
    const sx = (sourceWidth - cropWidth) / 2, sy = (sourceHeight - cropHeight) / 2;
    const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
    const context = canvas.getContext("2d"); if (!context) return undefined;
    context.drawImage(video, sx, sy, cropWidth, cropHeight, 0, 0, width, height);
    return await new Promise<Blob | undefined>(resolve => canvas.toBlob(result => resolve(result || undefined), "image/jpeg", .78));
  } catch { return undefined; }
  finally { video.pause(); video.removeAttribute("src"); video.load(); URL.revokeObjectURL(url); }
}
