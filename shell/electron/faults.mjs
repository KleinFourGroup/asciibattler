// The recorder's faults: what leaves a clip worth looking at but wrong, so
// the front door delivers it and exits 1, as with dropped frames (main.mjs
// judges each recording with these). Pure over the sidecar's fields, so a
// saved sidecar can be judged again when a rule changes.

/**
 * How far the picture may run ahead of (or behind) its sound by the cut.
 * A switch of the display stalls the whole renderer, from one 0.2-0.4 s
 * stall to 13 s of throttled frames (§111f-post), and a stall leaves no
 * frame short, so only the drift shows it. Idle recordings read -3 to -2 ms;
 * 50 ms keeps the delay plus the drift under the 100 ms an A/B by ear could
 * not tell apart.
 */
export const DRIFT_LIMIT_MS = 50;

/**
 * The faults of one recording, from its sidecar: `timeline` (main.mjs),
 * `cut` ({ page, atFrame } or null) and `endedBy`; `tailS` is the fallback's
 * wait after the battle ends.
 * - Frames short: page frames that never painted are dropped frames
 *   upstream of main, where nothing drops or counts them (a planted
 *   full-speed decode lost 322 in one battle, an idle machine none).
 * - Drift: `DRIFT_LIMIT_MS`, above.
 * - The cut has two halves, the page raising the patch at the swap and main
 *   stopping at the paint that shows it; one without the other is a fault
 *   (game content that looks like the patch, or a swap main never saw).
 */
export function faultsOf({ timeline, cut, endedBy }, tailS = 5) {
  const long = timeline?.longFrames ?? [];
  const longest = long.length === 0 ? null : long.reduce((a, f) => (f.ms > a.ms ? f : a));
  const at = (epoch) => new Date(epoch).toLocaleTimeString('en-GB');
  return [
    timeline && timeline.framesShort > 0 &&
      `the file is ${timeline.framesShort} frames short of the page: page frames never painted (a busy machine?)`,
    timeline && Math.abs(timeline.driftMs) > DRIFT_LIMIT_MS &&
      `the picture ran ${Math.abs(timeline.driftMs)} ms ${timeline.driftMs > 0 ? 'ahead of' : 'behind'} its sound by the cut, ` +
        `over the ${DRIFT_LIMIT_MS} ms limit` +
        (longest === null ? '' : ` (${long.length} frames over 40 ms, the longest ${longest.ms} ms at ${at(longest.epoch)})`),
    cut?.atFrame != null && cut.page === null && 'the file was cut at a magenta paint the page did not raise',
    endedBy === 'the fallback' && `no cut within ${tailS} s of the battle's end; the fallback stopped the recording`,
  ].filter(Boolean);
}
