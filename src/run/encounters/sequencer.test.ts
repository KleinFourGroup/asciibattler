import { describe, it, expect } from 'vitest';
import { RNG } from '../../core/RNG';
import {
  waveForTurn,
  conditionMet,
  type WaveEntry,
  type WaveList,
  type WaveCursor,
  type EncounterState,
} from './sequencer';
import type { WaveSpec } from './wave';

// ---------------------------------------------------------------------------
// Tiny taggable waves: a WaveSpec whose fixed count IS its identity tag, so a
// driven sequence is readable as a list of tag numbers (the sequencer returns
// specs, never resolves them — U1 is tested separately).
// ---------------------------------------------------------------------------

const W = (tag: number): WaveEntry => ({
  kind: 'wave',
  spec: { levelBudget: { kind: 'fixed', value: 1 }, count: { kind: 'fixed', value: tag }, units: [] },
});
const tagOf = (spec: WaveSpec): number => (spec.count.kind === 'fixed' ? spec.count.value : -1);

const FULL: EncounterState = { poolFraction: 1, turn: 1 };

/** Drive `turns` turns from a fresh cursor. `state` may be a constant or a
 *  per-turn function (1-based turn) — for stage-condition tests. */
function drive(
  list: WaveList,
  turns: number,
  opts: { state?: EncounterState | ((turn: number) => EncounterState); seed?: number } = {},
): number[] {
  const stateFor = (t: number): EncounterState =>
    typeof opts.state === 'function' ? opts.state(t) : (opts.state ?? FULL);
  const rng = new RNG(opts.seed ?? 1);
  let cursor: WaveCursor | null = null;
  const tags: number[] = [];
  for (let t = 1; t <= turns; t++) {
    const r = waveForTurn(list, cursor, stateFor(t), rng);
    cursor = r.cursor;
    tags.push(tagOf(r.spec));
  }
  return tags;
}

describe('waveForTurn — flat sequences + terminal policy', () => {
  it('indexes a flat list one wave per turn', () => {
    expect(drive([W(1), W(2), W(3)], 3)).toEqual([1, 2, 3]);
  });

  it('outlasting a finite list REPEATS THE LAST WAVE (the locked terminal policy)', () => {
    expect(drive([W(1), W(2), W(3)], 6)).toEqual([1, 2, 3, 3, 3, 3]);
  });

  it('a single-wave list repeats that wave forever', () => {
    expect(drive([W(7)], 4)).toEqual([7, 7, 7, 7]);
  });
});

describe('waveForTurn — loops', () => {
  it('a finite repeat runs N times then falls to the terminal policy', () => {
    // loop [1,2] ×2 → 1,2,1,2 then repeat-last (2).
    const list: WaveList = [{ kind: 'loop', body: [W(1), W(2)], repeat: 2 }];
    expect(drive(list, 6)).toEqual([1, 2, 1, 2, 2, 2]);
  });

  it('a forever loop never exhausts', () => {
    const list: WaveList = [{ kind: 'loop', body: [W(1), W(2)], repeat: 'forever' }];
    expect(drive(list, 5)).toEqual([1, 2, 1, 2, 1]);
  });

  it('entries AFTER a forever loop are unreachable (the loop is terminal)', () => {
    const list: WaveList = [{ kind: 'loop', body: [W(1)], repeat: 'forever' }, W(9)];
    expect(drive(list, 4)).toEqual([1, 1, 1, 1]); // W(9) never reached
  });

  it('NESTS — a loop of loops (the user’s question)', () => {
    // outer ×2 of [ inner(×2 of [1,2]), 3 ] → 1,2,1,2,3 | 1,2,1,2,3 | then repeat-last 3.
    const list: WaveList = [
      {
        kind: 'loop',
        repeat: 2,
        body: [{ kind: 'loop', body: [W(1), W(2)], repeat: 2 }, W(3)],
      },
    ];
    expect(drive(list, 12)).toEqual([1, 2, 1, 2, 3, 1, 2, 1, 2, 3, 3, 3]);
  });
});

describe('waveForTurn — picks', () => {
  it('rolls ONE option when reached, then streams it (frozen choice)', () => {
    // A pick of single-wave options resolves once; the list (just the pick) then
    // repeats the chosen wave via the terminal policy.
    const list: WaveList = [{ kind: 'pick', options: [{ entry: W(1), weight: 1 }, { entry: W(2), weight: 1 }] }];
    const out = drive(list, 4, { seed: 5 });
    expect(new Set(out).size).toBe(1); // same wave every turn
  });

  it('honors weights over many seeds (3:1 ≈ 75% / 25%)', () => {
    const list: WaveList = [
      { kind: 'pick', options: [{ entry: W(1), weight: 1 }, { entry: W(2), weight: 3 }] },
    ];
    let twos = 0;
    const N = 400;
    for (let s = 0; s < N; s++) twos += drive(list, 1, { seed: s })[0] === 2 ? 1 : 0;
    expect(twos / N).toBeGreaterThan(0.68);
    expect(twos / N).toBeLessThan(0.82);
  });

  it('is deterministic per seed', () => {
    const list: WaveList = [
      { kind: 'loop', repeat: 'forever', body: [{ kind: 'pick', options: [{ entry: W(1), weight: 1 }, { entry: W(2), weight: 1 }] }] },
    ];
    expect(drive(list, 8, { seed: 42 })).toEqual(drive(list, 8, { seed: 42 }));
  });

  it('NESTS — a loop containing a pick re-rolls each iteration', () => {
    // forever loop of a 50/50 pick → reaches BOTH waves across turns.
    const list: WaveList = [
      { kind: 'loop', repeat: 'forever', body: [{ kind: 'pick', options: [{ entry: W(1), weight: 1 }, { entry: W(2), weight: 1 }] }] },
    ];
    const out = drive(list, 40, { seed: 3 });
    expect(out).toContain(1);
    expect(out).toContain(2);
  });
});

describe('waveForTurn — stage blocks (boss phases)', () => {
  const bossList: WaveList = [
    {
      kind: 'stages',
      stages: [
        { until: { kind: 'enemyPoolAtOrBelow', fraction: 0.5 }, body: [W(1)] },
        { body: [W(2)] }, // final, open-ended
      ],
    },
  ];

  it('advances on the turn AFTER the pool crosses — not before', () => {
    // Pool: 1.0, 0.7 (still > 0.5), 0.4 (crossed), 0.4, 0.4.
    const pool = [1.0, 0.7, 0.4, 0.4, 0.4];
    const out = drive(bossList, 5, { state: (t) => ({ poolFraction: pool[t - 1]!, turn: t }) });
    // Stage 0 (wave 1) holds while pool > 0.5 (incl. repeat-last on turn 2);
    // flips to stage 1 (wave 2) on turn 3, the turn after crossing; then final.
    expect(out).toEqual([1, 1, 2, 2, 2]);
  });

  it('the final stage runs open-ended to encounter end', () => {
    const pool = [0.4, 0.4, 0.4, 0.4, 0.4, 0.4]; // crosses immediately
    const out = drive(bossList, 6, { state: (t) => ({ poolFraction: pool[t - 1]!, turn: t }) });
    // Turn 1 emits stage 0's wave (no boundary check yet); turn 2 onward = stage 1.
    expect(out).toEqual([1, 2, 2, 2, 2, 2]);
  });

  it('a non-final stage repeats its last wave while waiting for the condition', () => {
    // Stage 0 body has two waves; pool never drops → never advances → after the
    // body, the last wave (2) repeats forever within stage 0.
    const list: WaveList = [
      {
        kind: 'stages',
        stages: [
          { until: { kind: 'enemyPoolAtOrBelow', fraction: 0.1 }, body: [W(1), W(2)] },
          { body: [W(9)] },
        ],
      },
    ];
    expect(drive(list, 5, { state: { poolFraction: 1, turn: 1 } })).toEqual([1, 2, 2, 2, 2]);
  });

  it('NESTS — a stage body can be a loop', () => {
    const list: WaveList = [
      {
        kind: 'stages',
        stages: [
          { until: { kind: 'enemyPoolAtOrBelow', fraction: 0.5 }, body: [{ kind: 'loop', body: [W(1), W(2)], repeat: 'forever' }] },
          { body: [W(3)] },
        ],
      },
    ];
    const pool = [1.0, 1.0, 1.0, 0.4, 0.4];
    const out = drive(list, 5, { state: (t) => ({ poolFraction: pool[t - 1]!, turn: t }) });
    expect(out).toEqual([1, 2, 1, 3, 3]); // looping 1,2,1 then the condition flips to 3
  });
});

describe('waveForTurn — mid-encounter resume', () => {
  it('a JSON round-tripped cursor resumes the identical sequence', () => {
    const list: WaveList = [
      {
        kind: 'loop',
        repeat: 'forever',
        body: [
          { kind: 'pick', options: [{ entry: W(1), weight: 2 }, { entry: W(2), weight: 1 }] },
          W(8),
        ],
      },
    ];
    const state: EncounterState = { poolFraction: 1, turn: 1 };

    // Reference run of 8 turns, single RNG stream.
    const ref = drive(list, 8, { seed: 77 });

    // Same run, but snapshot+restore the cursor (and the RNG) after turn 3.
    const rng = new RNG(77);
    let cursor: WaveCursor | null = null;
    const got: number[] = [];
    for (let t = 1; t <= 3; t++) {
      const r = waveForTurn(list, cursor, state, rng);
      cursor = r.cursor;
      got.push(tagOf(r.spec));
    }
    const restored = JSON.parse(JSON.stringify(cursor)) as WaveCursor;
    const rng2 = RNG.fromJSON(rng.toJSON());
    let c2: WaveCursor | null = restored;
    for (let t = 4; t <= 8; t++) {
      const r = waveForTurn(list, c2, state, rng2);
      c2 = r.cursor;
      got.push(tagOf(r.spec));
    }
    expect(got).toEqual(ref);
  });

  it('returned cursors are plain JSON (no symbols/functions)', () => {
    const list: WaveList = [{ kind: 'stages', stages: [{ until: { kind: 'enemyPoolAtOrBelow', fraction: 0.5 }, body: [W(1)] }, { body: [W(2)] }] }];
    const r = waveForTurn(list, null, FULL, new RNG(1));
    expect(JSON.parse(JSON.stringify(r.cursor))).toEqual(r.cursor);
  });
});

describe('conditionMet', () => {
  it('enemyPoolAtOrBelow is true at or below the fraction', () => {
    const c = { kind: 'enemyPoolAtOrBelow', fraction: 0.5 } as const;
    expect(conditionMet(c, { poolFraction: 0.5, turn: 1 })).toBe(true);
    expect(conditionMet(c, { poolFraction: 0.49, turn: 1 })).toBe(true);
    expect(conditionMet(c, { poolFraction: 0.51, turn: 1 })).toBe(false);
  });
});
