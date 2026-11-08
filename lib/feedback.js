// Feedback-at-a-glance derivation from an owner-gated manage/view payload.
// Pure and testable; no network, no polling. Mirrors DESIGN_SYSTEM §6.3.
import {discussionThreads} from './discussion.js';

export function formatAgo(ts, now = Date.now()) {
  if (!ts || !Number.isFinite(ts)) return '';
  const s = Math.max(0, Math.floor((now - ts) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

export function feedbackSummary(clip = {}, {now = Date.now(), seenAt = 0} = {}) {
  const comments = Array.isArray(clip.comments) ? clip.comments : [];
  const threads = discussionThreads(comments);
  const liveThreads = threads.filter(t => !t.root.deleted);
  const openThreads = liveThreads.filter(t => !t.root.resolved).length;
  const liveComments = comments.filter(c => !c.deleted);
  const lastReplyAt = liveComments.length ? Math.max(...liveComments.map(c => c.createdAt || 0)) || 0 : 0;
  const reactions = clip.reactions || {};
  const reactionTotal = Object.values(reactions).reduce((n, v) => n + (Number(v) || 0), 0);
  const newReplies = seenAt ? liveComments.filter(c => (c.createdAt || 0) > seenAt).length : 0;
  return {
    openThreads,
    totalThreads: liveThreads.length,
    hasDiscussion: liveComments.length > 0,
    allResolved: liveThreads.length > 0 && openThreads === 0,
    lastReplyAt,
    lastReplyAgo: lastReplyAt ? formatAgo(lastReplyAt, now) : '',
    reactions,
    reactionTotal,
    newReplies,
    discussionRevision: clip.discussionRevision || 0,
  };
}

export function feedbackLine(summary) {
  if (!summary || !summary.hasDiscussion) return '';
  if (summary.newReplies > 0) return `● ${summary.newReplies} new ${summary.newReplies === 1 ? 'reply' : 'replies'}`;
  if (summary.openThreads > 0) {
    const base = `● ${summary.openThreads} open ${summary.openThreads === 1 ? 'thread' : 'threads'}`;
    return summary.lastReplyAgo ? `${base} · last reply ${summary.lastReplyAgo}` : base;
  }
  if (summary.allResolved) return '✓ All threads resolved';
  return '';
}

export function seenKey(clipId) { return `screennote-seen-${clipId}`; }
export function readSeen(clipId) {
  try { const v = JSON.parse(localStorage.getItem(seenKey(clipId))); return v && Number.isFinite(v.seenAt) ? v : {seenAt: 0, discussionRevision: 0}; } catch { return {seenAt: 0, discussionRevision: 0}; }
}
export function writeSeen(clipId, revision) {
  try { localStorage.setItem(seenKey(clipId), JSON.stringify({seenAt: Date.now(), discussionRevision: revision || 0})); } catch {}
}
export function clearSeen(clipId) { try { localStorage.removeItem(seenKey(clipId)); } catch {} }
