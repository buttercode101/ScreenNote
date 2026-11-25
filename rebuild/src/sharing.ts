
export type PublishResult = { id: string; token: string; url: string; expiresAt: number; passwordProtected: boolean };
export async function ensureGuestSession(): Promise<void> {
  const response = await fetch("/api/session", { credentials: "same-origin" });
  if (!response.ok) throw new Error("ScreenNote couldn't start a private guest session. Refresh and try again.");
}
export function newOwnerKey(): string {
  return [...crypto.getRandomValues(new Uint8Array(32))].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
export async function publishRecording(clip: { title: string; mimeType: string; size: number; duration: number; blob: Blob }, days: number, password: string, ownerKey: string): Promise<PublishResult> {
  await ensureGuestSession();
  const create = await fetch("/api/recordings", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: clip.title, mimeType: clip.mimeType.split(";")[0], size: clip.size, duration: clip.duration }) });
  const reservation = await create.json().catch(() => ({})) as { id?: string; uploadUrl?: string; error?: string };
  if (!create.ok || !reservation.id || !reservation.uploadUrl) throw new Error(reservation.error || "Couldn't prepare this video for sharing.");
  const upload = await fetch(reservation.uploadUrl, { method: "PUT", credentials: "same-origin", headers: { "content-type": clip.mimeType.split(";")[0] }, body: clip.blob });
  const uploaded = await upload.json().catch(() => ({})) as { error?: string };
  if (!upload.ok) {
    await fetch("/api/recordings/" + reservation.id, { method: "DELETE", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ ownerKey }) }).catch(() => undefined);
    throw new Error(uploaded.error || "The upload didn't finish. Your local video is still safe.");
  }
  let publish: Response;
  try {
    publish = await fetch("/api/recordings/" + reservation.id + "/publish", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ expiresInDays: days, password: password || undefined, ownerKey }) });
  } catch (error) {
    await fetch("/api/recordings/" + reservation.id, { method: "DELETE", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ ownerKey }) }).catch(() => undefined);
    throw error;
  }
  const result = await publish.json().catch(() => ({})) as PublishResult & { error?: string };
  if (!publish.ok) {
    await fetch("/api/recordings/" + reservation.id, { method: "DELETE", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ ownerKey }) }).catch(() => undefined);
    throw new Error(result.error || "Couldn't publish this link. Your local video is still safe.");
  }
  return result;
}
export async function shareRequest<T>(token: string, path = "", init: RequestInit = {}): Promise<T> {
  const response = await fetch("/api/share/" + token + path, { ...init, credentials: "same-origin", headers: { ...(init.body ? { "content-type": "application/json" } : {}), ...init.headers } });
  const result = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw Object.assign(new Error(result.error || "This ScreenNote is no longer available."), { status: response.status });
  return result;
}
