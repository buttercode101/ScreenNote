export const RETENTION_GRACE = 24 * 60 * 60 * 1000;
export function reclaimable(clip, now = Date.now()) {
  if (clip.status === 'expired' || clip.status === 'deleted') return true;
  const deadline = clip.status === 'pending'
    ? (clip.uploadUntil || clip.createdAt + 600000)
    : clip.expiresAt;
  return Number.isFinite(deadline) && deadline + RETENTION_GRACE <= now;
}
