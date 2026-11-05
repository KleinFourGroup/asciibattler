/**
 * The stat sheet's colour scale: a cell's place in its group as a number
 * from −1 (lowest) through 0 (the middle) to 1 (highest), and that number
 * as a background. Blue below, orange above, nothing in the middle, so the
 * outliers stand out; blue and orange stay apart under the common colour
 * blindnesses, and neither reads as good or bad.
 *
 * Two readings: by rank, the percentile (ties counted half) about the
 * 50th, which is the median, so a column of mostly zeros sits near the
 * middle; by size, the value over the group's mean on a log scale, full
 * colour at half or double the mean.
 */

export type ColourMode = 'rank' | 'size';

/** The place in −1 … 1 for a cell with this percentile and this share of
 *  its group's mean. */
export function placeOf(mode: ColourMode, percentile: number, ofMean: number): number {
  if (mode === 'rank') return Math.max(-1, Math.min(1, (percentile - 0.5) * 2));
  if (ofMean <= 0) return -1;
  if (!Number.isFinite(ofMean)) return 1;
  return Math.max(-1, Math.min(1, Math.log2(ofMean)));
}

/** A cell's background for a place in −1 … 1. */
export function shade(place: number): string {
  const a = (Math.abs(place) * 0.55).toFixed(3);
  if (place < 0) return `rgba(70, 130, 230, ${a})`;
  if (place > 0) return `rgba(240, 150, 40, ${a})`;
  return 'transparent';
}
