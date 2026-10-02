// The recorder's faults: what leaves a clip worth looking at but wrong, so
// the front door delivers it and exits 1, as with dropped frames (main.mjs
// judges each recording with these). Pure over the sidecar's fields, so a
// saved sidecar can be judged again when a rule changes.

/**
 * How far the picture may run ahead of (or behind) its sound by the cut.
 * The drift is the page's stalls plus a slot for each page frame that never
 * reached the file (ten recordings, to 3 ms: 114f), and the retime
 * (record.mjs) writes both back as held frames, so a drift now means the
 * retime failed. Idle recordings read -3 to -2 ms; 50 ms keeps the delay plus
 * the drift under the 100 ms an A/B by ear could not tell apart.
 */
export const DRIFT_LIMIT_MS = 50;

/**
 * How long the picture may stand still. The retime (record.mjs) keeps the
 * picture with its sound through a stall by writing the last frame again, so
 * the clip shows the freeze the page had: a switch of the display leaves one
 * of 0.1-0.3 s each way. A clip is still delivered; this says it has one.
 */
export const FREEZE_LIMIT_MS = 100;

/**
 * The faults of one recording, from its sidecar: `timeline` (main.mjs),
 * `cut` ({ page, atFrame } or null) and `endedBy`; `tailS` is the fallback's
 * wait after the battle ends.
 * - Frames short: page frames that never painted are dropped frames
 *   upstream of main, where nothing drops or counts them (a planted
 *   full-speed decode lost 322 in one battle, an idle machine none). The
 *   retime gives their time back as held frames; the picture still skipped
 *   them.
 * - Drift: `DRIFT_LIMIT_MS`, above.
 * - Freezes: `FREEZE_LIMIT_MS`, above.
 * - The stamp: a paint between the go frame and the cut without a readable
 *   stamp is one the retime could not place.
 * - The cut has two halves, the page raising the patch at the swap and main
 *   stopping at the paint that shows it; one without the other is a fault
 *   (game content that looks like the patch, or a swap main never saw).
 */
export function faultsOf({ timeline, cut, endedBy, retime }, tailS = 5) {
  const freezes = (timeline?.holds ?? []).filter((h) => h.ms > FREEZE_LIMIT_MS);
  const worst = freezes.length === 0 ? null : freezes.reduce((a, h) => (h.ms > a.ms ? h : a));
  const long = timeline?.longFrames ?? [];
  const longest = long.length === 0 ? null : long.reduce((a, f) => (f.ms > a.ms ? f : a));
  const at = (epoch) => new Date(epoch).toLocaleTimeString('en-GB');
  return [
    timeline && timeline.framesShort > 0 &&
      (retime?.on
        ? `${timeline.framesShort} page frames never reached the file (never painted: a busy machine?); the picture skips them`
        : `the file is ${timeline.framesShort} frames short of the page: page frames never painted (a busy machine?)`),
    timeline && Math.abs(timeline.driftMs) > DRIFT_LIMIT_MS &&
      `the picture ran ${Math.abs(timeline.driftMs)} ms ${timeline.driftMs > 0 ? 'ahead of' : 'behind'} its sound by the cut, ` +
        `over the ${DRIFT_LIMIT_MS} ms limit` +
        (longest === null ? '' : ` (${long.length} frames over 40 ms, the longest ${longest.ms} ms at ${at(longest.epoch)})`),
    worst !== null &&
      `the picture stands still for ${worst.ms} ms at ${worst.atS.toFixed(1)} s` +
        (freezes.length > 1 ? `, and ${freezes.length - 1} more times over ${FREEZE_LIMIT_MS} ms` : '') +
        ': the page stalled there (a switch of the display?), and the sound runs on',
    retime && retime.on && retime.goAtFrame === null && 'no paint carried a stamp, so nothing was retimed (seam moved: the stamp)',
    retime && retime.on && retime.unplaced > 0 && `${retime.unplaced} paints after the go frame carried no readable stamp and were written as they came`,
    cut?.atFrame != null && cut.page === null && 'the file was cut at a magenta paint the page did not raise',
    endedBy === 'the fallback' && `no cut within ${tailS} s of the battle's end; the fallback stopped the recording`,
  ].filter(Boolean);
}
