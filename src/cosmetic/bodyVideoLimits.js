// Keep display, add, reload and backup import on the same per-item limit.
export const MAX_VIDEOS_PER_ITEM = 5;
export function normalizeVideoIds(value) {
  return [...new Set((Array.isArray(value) ? value : [])
    .filter(id => typeof id === 'string' && /^[\w-]{11}$/.test(id)))].slice(0, MAX_VIDEOS_PER_ITEM);
}
