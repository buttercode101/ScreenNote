// Unsaved-work registry (DESIGN_SYSTEM §6.1, scoped): pure dirty-source logic.
// The share password is a flag only — its value is never stored anywhere.
export const DIRTY_ORDER = ['title', 'reviewStatus', 'extras', 'trim', 'marks', 'password'];
export const DIRTY_LABELS = {
  title: 'title',
  reviewStatus: 'review status',
  extras: 'video context (captions, chapters, bug report)',
  trim: 'trim range',
  marks: 'drawn marks',
  password: 'share password (not saved)',
};
export function dirtyLabels(flags = {}) {
  return DIRTY_ORDER.filter(k => !!flags[k]).map(k => DIRTY_LABELS[k]);
}
export function isDirty(flags = {}) { return DIRTY_ORDER.some(k => !!flags[k]); }
export function guardCopy(labels) {
  const list = labels.length > 1 ? `${labels.slice(0, -1).join(', ')} and ${labels.at(-1)}` : labels[0];
  return `You have unsaved changes: ${list}. Leave anyway? Your saved video stays on this device.`;
}
