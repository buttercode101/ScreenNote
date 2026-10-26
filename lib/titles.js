// File names are metadata, not necessarily a useful message title.
export function isGeneratedTitle(value = '') {
  const name = String(value).replace(/\.(mp4|webm)$/i, '').trim();
  return !name || /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}(?:[-_][a-z0-9_-]*)?$/i.test(name)
    || /^[a-f0-9]{24,}(?:[_-].*)?$/i.test(name);
}
export function importTitle(filename, supplied) {
  const name = String(supplied || filename || '').replace(/\.(mp4|webm)$/i, '').trim();
  return isGeneratedTitle(name) ? 'Untitled recording' : name.slice(0, 100);
}
export function validTitle(value) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 100)
    throw Error('Add a video title of 1–100 characters.');
  return value.trim();
}
