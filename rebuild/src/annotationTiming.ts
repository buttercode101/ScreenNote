import type { Annotation } from "./library";

/** Legacy marks without a time remain visible for the whole clip. Timed marks are anchored to the playhead. */
export function annotationIsVisible(mark: Annotation, seconds: number): boolean {
  if (!Number.isFinite(seconds) || seconds < 0) return false;
  if (typeof mark.time !== "number" || !Number.isFinite(mark.time)) return true;
  const start = Math.max(0, mark.time);
  const duration = typeof mark.duration === "number" && Number.isFinite(mark.duration) ? Math.max(0.1, Math.min(30, mark.duration)) : 4;
  return seconds >= start && seconds <= start + duration;
}

export function visibleAnnotations(marks: Annotation[], seconds: number): Annotation[] {
  return marks.filter(mark => annotationIsVisible(mark, seconds));
}
