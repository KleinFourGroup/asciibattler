import { describe, expect, it } from 'vitest';
import {
  benchChecks,
  formatBenchReport,
  median,
  runBench,
  type BenchOptions,
  type BenchRig,
  type FrameLoad,
} from './bench';

/**
 * 108d — the bench's arithmetic against a fake clock whose costs are known:
 * a base frame, a marks cost, a stress cost, the planted spin, and a drift
 * that grows every frame. The bench must read each cost back exactly.
 */

interface FakeCosts {
  base: number;
  marks: number;
  stress: number;
  /** false = the planted spin never reaches the timed frame (a broken rig). */
  plantReaches: boolean;
  /** Added to every frame per frame already drawn: a linear drift. */
  drift: number;
  /** A one-off stall (ms) on the frame with this index, if any. */
  stall?: { frame: number; ms: number };
}

function fakeRig(c: FakeCosts): BenchRig & { frames: number; toggles: number; marksOn: () => boolean } {
  let t = 0;
  let marks = true;
  let frames = 0;
  let toggles = 0;
  return {
    now: () => t,
    setMarks: (on) => {
      marks = on;
      toggles++;
    },
    frame: (load: FrameLoad) => {
      t += c.base + c.drift * frames;
      if (marks) t += c.marks;
      if (marks && load.stress) t += c.stress;
      if (c.plantReaches) t += load.plantMs;
      if (c.stall?.frame === frames) t += c.stall.ms;
      frames++;
    },
    pause: async () => {},
    get frames() {
      return frames;
    },
    get toggles() {
      return toggles;
    },
    marksOn: () => marks,
  };
}

const OPTIONS: BenchOptions = { rounds: 3, chunks: 4, chunkFrames: 5, settle: 2, plantMs: 0.5, warmup: 1 };
const LEG_FRAMES = 1 + OPTIONS.settle + OPTIONS.chunks * OPTIONS.chunkFrames;
const block = (results: Awaited<ReturnType<typeof runBench>>, name: string) => results.find((r) => r.name === name)!;

describe('108d — the frame-cost bench, against a fake clock', () => {
  it('reads every known cost back exactly, under a linear drift', async () => {
    const rig = fakeRig({ base: 4, marks: 0.3, stress: 1.2, plantReaches: true, drift: 0.001 });
    const results = await runBench(rig, OPTIONS);
    expect(block(results, 'marks').median).toBeCloseTo(0.3, 9);
    expect(block(results, 'aa').median).toBeCloseTo(0, 9);
    expect(block(results, 'planted').median).toBeCloseTo(0.5, 9);
    expect(block(results, 'stress').median).toBeCloseTo(1.2, 9);
    for (const r of results) expect(r.diffs).toHaveLength(OPTIONS.rounds);
    const checks = benchChecks(results, OPTIONS.plantMs);
    expect(checks).toMatchObject({ planted: true, aa: true, stress: true });
    expect(checks.resolution).toBeLessThan(1e-9);
  });

  it('the drift is real: the A means move with it while the paired difference does not', async () => {
    const results = await runBench(fakeRig({ base: 4, marks: 0.3, stress: 1.2, plantReaches: true, drift: 0.001 }), OPTIONS);
    // Later blocks run on a slower clock, so their A legs read higher.
    expect(block(results, 'stress').a).toBeGreaterThan(block(results, 'marks').a + 0.3 + 0.1);
  });

  it('the schedule: warm-up + 4 blocks, rounds of ABBA, each leg one toggle frame + settle + timed; the marks end on', async () => {
    const rig = fakeRig({ base: 1, marks: 0, stress: 0, plantReaches: true, drift: 0 });
    await runBench(rig, OPTIONS);
    const legs = 4 * OPTIONS.warmup + 4 * OPTIONS.rounds * 4;
    expect(rig.frames).toBe(legs * LEG_FRAMES);
    expect(rig.toggles).toBe(legs * 2 + 1);
    expect(rig.marksOn()).toBe(true);
  });

  it('a 50 ms stall in one timed chunk drops out of its leg; CONTROL: with one chunk per leg it does not', async () => {
    // The warm-up's 4 legs, then the marks block's first leg: its toggle frame,
    // the settle, then the timed chunks; the stall lands in the second chunk.
    const stall = { frame: 4 * LEG_FRAMES + 1 + OPTIONS.settle + OPTIONS.chunkFrames + 2, ms: 50 };
    const costs = { base: 4, marks: 0.3, stress: 1.2, plantReaches: true, drift: 0, stall };
    const chunked = await runBench(fakeRig(costs), OPTIONS);
    for (const d of block(chunked, 'marks').diffs) expect(d).toBeCloseTo(0.3, 9);
    const whole = await runBench(fakeRig(costs), { ...OPTIONS, chunks: 1, chunkFrames: OPTIONS.chunks * OPTIONS.chunkFrames });
    expect(block(whole, 'marks').diffs[0]).toBeLessThan(0);
  });

  it('CONTROL: a planted cost that never reaches the timed frame fails its check', async () => {
    const results = await runBench(fakeRig({ base: 4, marks: 0.3, stress: 1.2, plantReaches: false, drift: 0.001 }), OPTIONS);
    expect(benchChecks(results, OPTIONS.plantMs).planted).toBe(false);
  });

  it('CONTROL: a GPU cost outside the timing (full bins cost nothing) fails the stress check', async () => {
    const results = await runBench(fakeRig({ base: 4, marks: 0.3, stress: 0, plantReaches: true, drift: 0.001 }), OPTIONS);
    expect(benchChecks(results, OPTIONS.plantMs).stress).toBe(false);
  });

  it('median, and the report names every block', async () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    const results = await runBench(fakeRig({ base: 4, marks: 0.3, stress: 1.2, plantReaches: true, drift: 0 }), OPTIONS);
    const text = formatBenchReport({
      canvas: [2560, 1440],
      gpu: 'test gpu',
      board: 'quarry 14x12',
      clockStep: 0.1,
      bins: { count: 30, maxBin: 1, overflow: 0 },
      stressBins: { count: 2046, maxBin: 13, overflow: 0 },
      options: OPTIONS,
      results,
      checks: benchChecks(results, OPTIONS.plantMs),
    });
    for (const label of ['marks off -> on', 'A/A: off -> off', 'planted 0.50 ms CPU', 'marks on -> bins full', '2560x1440', '+0.300'])
      expect(text).toContain(label);
    expect(text).not.toContain('FAILED');
  });
});
