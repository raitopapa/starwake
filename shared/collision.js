/** Segment against an axis-aligned rectangle (slab clipping, including edge contact). */
export function segmentHitsRect(x1, y1, x2, y2, left, top, right, bottom) {
  let enter = 0, exit = 1;
  for (const [origin, delta, min, max] of [[x1, x2 - x1, left, right], [y1, y2 - y1, top, bottom]]) {
    if (Math.abs(delta) < 1e-10) { if (origin < min || origin > max) return false; continue; }
    const a = (min - origin) / delta, b = (max - origin) / delta;
    enter = Math.max(enter, Math.min(a, b)); exit = Math.min(exit, Math.max(a, b));
    if (enter > exit) return false;
  }
  return true;
}
