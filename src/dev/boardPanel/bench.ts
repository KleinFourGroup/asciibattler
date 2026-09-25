/**
 * 108d — THE FRAME-COST BENCH (spec D3: "frame time before and after at the
 * user's resolution, with the per-tile bin size reported"). Pure: the legs,
 * their order, the statistics and the report; `benchRig.ts` is the live
 * WebGL side. Headless-tested against a fake clock (bench.test.ts).
 *
 * The render loop's own clock is paced by the display, so a cost below the
 * refresh interval never shows in it. A bench frame is therefore driven by
 * hand and synced: the board's per-frame update, the sort, the two-pass
 * render, then a one-pixel read that waits for the GPU. A leg times `chunks`
 * runs of `chunkFrames` frames after `settle` untimed ones and reads the
 * median chunk mean: a stalled chunk (a GC, the compositor) drops out, a
 * chunk is long enough that a coarse clock costs it little, and under a
 * linear drift the median still equals the leg's mean. Every leg starts from
 * the same marks-toggle round trip, so no leg gains from staying in its mode.
 *
 * First `warmup` rounds of the marks block, discarded: in the pane's first
 * run, without them, the A legs fell from 2.0 to 1.4 ms across the blocks and
 * the A/A read −0.27 ms, a warm-up that no leg order cancels. Then four
 * blocks, each `rounds` of A B B A (a drift linear across the round cancels
 * in the paired difference):
 *  - marks: the plain terrain shaders against the marks compiled in (the off
 *    leg is the two shader files byte for byte, TerrainRenderer.test.ts);
 *  - A/A: off against off, the noise floor and any bias of the toggle;
 *  - planted: off against off plus a CPU spin of `plantMs`, which must read
 *    back at its own size (the timing path and the pairing, checked);
 *  - stress: marks on against every tile's bin filled toward capacity, which
 *    must read above the A/A range (the GPU's work is inside the timing).
 */

export interface FrameLoad {
  /** A planted CPU cost per frame, ms. */
  readonly plantMs: number;
  /** Fill every tile's bin toward capacity before the render. */
  readonly stress: boolean;
}

export interface BenchLeg extends FrameLoad {
  /** The terrain marks compiled in (true) or the plain terrain shaders (false). */
  readonly marks: boolean;
}

export interface BenchRig {
  now(): number;
  setMarks(on: boolean): void;
  /** One synced frame under `load`. */
  frame(load: FrameLoad): void;
  /** After a leg's timed frames, before the pause (the live rig reads the bins here). */
  afterLeg?(leg: BenchLeg): void;
  /** Yield to the page between rounds (a no-op headless). */
  pause(): Promise<void>;
}

export interface BenchOptions {
  readonly rounds: number;
  readonly chunks: number;
  readonly chunkFrames: number;
  readonly settle: number;
  readonly plantMs: number;
  /** ABBA rounds of the marks block run first and discarded: the clocks and the JIT warm up. */
  readonly warmup: number;
}

export const BENCH_DEFAULTS: BenchOptions = { rounds: 8, chunks: 6, chunkFrames: 8, settle: 3, plantMs: 1, warmup: 3 };

export type BlockName = 'marks' | 'aa' | 'planted' | 'stress';

export interface BlockResult {
  readonly name: BlockName;
  readonly label: string;
  /** The mean over every A leg and every B leg of its median chunk, ms per frame. */
  readonly a: number;
  readonly b: number;
  /** The paired difference B − A per round, ms per frame. */
  readonly diffs: readonly number[];
  readonly median: number;
}

const NO_LOAD: FrameLoad = { plantMs: 0, stress: false };

function blocks(plantMs: number): { name: BlockName; label: string; a: BenchLeg; b: BenchLeg }[] {
  const off: BenchLeg = { marks: false, ...NO_LOAD };
  const on: BenchLeg = { marks: true, ...NO_LOAD };
  return [
    { name: 'marks', label: 'marks off -> on', a: off, b: on },
    { name: 'aa', label: 'A/A: off -> off', a: off, b: off },
    { name: 'planted', label: `planted ${plantMs.toFixed(2)} ms CPU`, a: off, b: { ...off, plantMs } },
    { name: 'stress', label: 'marks on -> bins full', a: on, b: { ...on, stress: true } },
  ];
}

const mean = (xs: readonly number[]): number => xs.reduce((s, x) => s + x, 0) / xs.length;

export function median(xs: readonly number[]): number {
  const s = [...xs].sort((p, q) => p - q);
  const mid = s.length >> 1;
  return s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

function runLeg(rig: BenchRig, leg: BenchLeg, o: BenchOptions): number {
  rig.setMarks(!leg.marks);
  rig.frame(NO_LOAD);
  rig.setMarks(leg.marks);
  for (let i = 0; i < o.settle; i++) rig.frame(leg);
  const chunks: number[] = [];
  let t0 = rig.now();
  for (let c = 0; c < o.chunks; c++) {
    for (let i = 0; i < o.chunkFrames; i++) rig.frame(leg);
    const t1 = rig.now();
    chunks.push((t1 - t0) / o.chunkFrames);
    t0 = t1;
  }
  rig.afterLeg?.(leg);
  return median(chunks);
}

/** One A B B A round, run back to back (a pause inside it let the noise differ from leg to leg), then a pause. */
async function runRound(rig: BenchRig, a: BenchLeg, b: BenchLeg, o: BenchOptions): Promise<[number, number, number, number]> {
  const a1 = runLeg(rig, a, o);
  const b1 = runLeg(rig, b, o);
  const b2 = runLeg(rig, b, o);
  const a2 = runLeg(rig, a, o);
  await rig.pause();
  return [a1, b1, b2, a2];
}

/** Run the four blocks in order; the marks are left on, as production draws them. */
export async function runBench(rig: BenchRig, o: BenchOptions = BENCH_DEFAULTS): Promise<BlockResult[]> {
  const all = blocks(o.plantMs);
  const first = all[0]!;
  for (let r = 0; r < o.warmup; r++) await runRound(rig, first.a, first.b, o);
  const out: BlockResult[] = [];
  for (const block of all) {
    const as: number[] = [];
    const bs: number[] = [];
    const diffs: number[] = [];
    for (let r = 0; r < o.rounds; r++) {
      const [a1, b1, b2, a2] = await runRound(rig, block.a, block.b, o);
      as.push(a1, a2);
      bs.push(b1, b2);
      diffs.push((b1 + b2 - a1 - a2) / 2);
    }
    out.push({ name: block.name, label: block.label, a: mean(as), b: mean(bs), diffs, median: median(diffs) });
  }
  rig.setMarks(true);
  return out;
}

export interface BenchChecks {
  /** The widest A/A difference: below it, a difference is noise. */
  readonly resolution: number;
  /** The planted cost read back within 20 % of its size. */
  readonly planted: boolean;
  /** The A/A median within that same tolerance of zero. */
  readonly aa: boolean;
  /** The full bins' median reads above the A/A range. A median, because a
   *  single stalled leg (a GC, say) swings one round by milliseconds either way. */
  readonly stress: boolean;
}

export function benchChecks(results: readonly BlockResult[], plantMs: number): BenchChecks {
  const by = (name: BlockName): BlockResult => {
    const r = results.find((x) => x.name === name);
    if (!r) throw new Error(`bench: no ${name} block`);
    return r;
  };
  const aa = by('aa');
  const resolution = Math.max(...aa.diffs.map(Math.abs));
  const tolerance = 0.2 * plantMs;
  return {
    resolution,
    planted: Math.abs(by('planted').median - plantMs) <= tolerance,
    aa: Math.abs(aa.median) <= tolerance,
    stress: by('stress').median > resolution,
  };
}

export interface BinStats {
  readonly count: number;
  readonly maxBin: number;
  readonly overflow: number;
}

export interface BenchReport {
  readonly canvas: readonly [number, number];
  readonly gpu: string;
  readonly board: string;
  /** The smallest step `performance.now()` took, ms (browsers coarsen it). */
  readonly clockStep: number;
  /** The table under the marks leg, and under the full bins. */
  readonly bins: BinStats;
  readonly stressBins: BinStats;
  readonly options: BenchOptions;
  readonly results: readonly BlockResult[];
  readonly checks: BenchChecks;
}

const ms = (x: number): string => x.toFixed(3);
const signed = (x: number): string => `${x >= 0 ? '+' : '-'}${Math.abs(x).toFixed(3)}`;

export function formatBenchReport(r: BenchReport): string {
  const c = r.checks;
  const verdict = (ok: boolean): string => (ok ? 'ok' : 'FAILED');
  const lines = [
    `FRAME-COST BENCH  ${r.canvas[0]}x${r.canvas[1]}  ${r.gpu}  (clock step ${ms(r.clockStep)} ms)`,
    `board ${r.board}: ${r.bins.count} marks, fullest bin ${r.bins.maxBin}, overflow ${r.bins.overflow}` +
      ` (full bins: ${r.stressBins.count} marks, fullest ${r.stressBins.maxBin}, overflow ${r.stressBins.overflow})`,
    `ms per frame, A -> B, then B - A: median [min .. max] over ${r.options.rounds} ABBA rounds;` +
      ` a leg = the median of ${r.options.chunks} chunks of ${r.options.chunkFrames} frames`,
  ];
  for (const b of r.results) {
    const range = `[${signed(Math.min(...b.diffs))} .. ${signed(Math.max(...b.diffs))}]`;
    lines.push(`  ${b.label.padEnd(24)} ${ms(b.a)} -> ${ms(b.b)}  ${signed(b.median)} ${range}`);
  }
  lines.push(
    `checks: planted reads its size: ${verdict(c.planted)} · A/A near zero: ${verdict(c.aa)} · ` +
      `full bins above the A/A range: ${verdict(c.stress)} · the widest A/A round ${ms(c.resolution)} ms`,
  );
  return lines.join('\n');
}
