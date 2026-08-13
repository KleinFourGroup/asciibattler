/**
 * 77e2 — the sector-map generation corpus gates (the drift.test.ts analog
 * for map-gen). Every threshold below is a row of the SIGNED 77c sheet
 * (worklog §77c; baseline numbers in worklog §77b) measured at the
 * baseline instrument's shape: n=500 seeds, authored config, default
 * length. The doctrine is the movement round's: NEVER relax a gate — a
 * red gate means the generator regressed against a user-signed guarantee,
 * not that the test is stale. Deliberate re-signs update the threshold AND
 * worklog §77c-lineage in the same commit.
 *
 * C rows are constructive (the generator enforces them; a failure is a
 * mechanism bug). R rows are the rejection/quota residue (statistical —
 * placement heuristics push them; a failure means the heuristics drifted).
 */

import { describe, it, expect } from 'vitest';
import { RNG } from '../src/core/RNG';
import { generate } from '../src/run/NodeMap';
import { computeMapMetrics, type MapMetrics } from '../src/run/mapMetrics';
import { NODE_MAP } from '../src/config/nodemap';

const SEEDS = 500;

interface CorpusRow {
  readonly seed: number;
  readonly m: MapMetrics;
}

/** Generated once, shared by every gate (the expensive part). */
const corpus: CorpusRow[] = [];
for (let seed = 1; seed <= SEEDS; seed++) {
  corpus.push({ seed, m: computeMapMetrics(generate(new RNG(seed))) });
}

describe(`nodemap corpus gates — the signed 77c sheet at n=${SEEDS}`, () => {
  it('C: instant (d2) rejoins ≤ 25% of branch pairs, per map', () => {
    const offenders = corpus.filter(({ m }) => {
      const pairs = m.rejoinPairs.length;
      if (pairs === 0) return false;
      const d2 = m.rejoinPairs.filter((p) => p.rejoinDistance === 2).length;
      return d2 / pairs > 0.25;
    });
    expect(
      offenders.map(({ seed, m }) => {
        const d2 = m.rejoinPairs.filter((p) => p.rejoinDistance === 2).length;
        return `seed ${seed}: ${d2}/${m.rejoinPairs.length}`;
      }),
      'the seam-rule budget leaked',
    ).toEqual([]);
  });

  it('R: content-divergent branch pairs ≥ 80% (pooled)', () => {
    let pairs = 0;
    let divergent = 0;
    for (const { m } of corpus) {
      pairs += m.rejoinPairs.length;
      divergent += m.rejoinPairs.filter((p) => p.kindDivergent).length;
    }
    expect(divergent / pairs).toBeGreaterThanOrEqual(0.8);
  });

  it('C: every map places ≥ 1 rest, elite, port, and event (the presence floor)', () => {
    for (const kind of ['rest', 'elite', 'port', 'event'] as const) {
      const missing = corpus.filter(({ m }) => m.firstHopByKind.get(kind) === undefined);
      expect(missing.map(({ seed }) => seed), `maps with no ${kind}`).toEqual([]);
    }
  });

  it('C: a port exists by hop 5 in 100% of maps', () => {
    const late = corpus.filter(({ m }) => (m.firstHopByKind.get('port') ?? Infinity) > 5);
    expect(late.map(({ seed }) => seed)).toEqual([]);
  });

  it('R: rest and elite exist by hop 5 in ≥ 90% of maps', () => {
    for (const kind of ['rest', 'elite'] as const) {
      const byH5 = corpus.filter(({ m }) => (m.firstHopByKind.get(kind) ?? Infinity) <= 5);
      expect(byH5.length / SEEDS, kind).toBeGreaterThanOrEqual(0.9);
    }
  });

  it('C: first-choice port lockout is 0% (every first choice keeps shop access)', () => {
    const locked = corpus.filter(({ m }) => (m.choiceCoverageByKind.get('port') ?? 0) < 1);
    expect(locked.map(({ seed }) => seed)).toEqual([]);
  });

  it('R: first-choice elite/rest lockout ≤ 10% of maps', () => {
    for (const kind of ['elite', 'rest'] as const) {
      const locked = corpus.filter(({ m }) => (m.choiceCoverageByKind.get(kind) ?? 0) < 1);
      expect(locked.length / SEEDS, kind).toBeLessThanOrEqual(0.1);
    }
  });

  it('R: port route-fraction mean ≥ 50%, P10 ≥ 25%', () => {
    const fracs = corpus
      .map(({ m }) => m.pathFractionByKind.get('port') ?? 0)
      .sort((a, b) => a - b);
    const mean = fracs.reduce((a, b) => a + b, 0) / fracs.length;
    expect(mean).toBeGreaterThanOrEqual(0.5);
    expect(fracs[Math.floor(SEEDS * 0.1)]!).toBeGreaterThanOrEqual(0.25);
  });

  it('C: battle-less middle hops are extinct (0 in every map)', () => {
    const offenders = corpus.filter(({ m }) => m.battlelessMiddleHops > 0);
    expect(offenders.map(({ seed }) => seed)).toEqual([]);
  });

  it('R: events per route hold the signed band (≥99% of maps in ≈3 ± 0.5; floor 2.2; mean 2.8–3.2)', () => {
    // Balance-proof: the band derives from the config the generator reads.
    // NOT per-map-100%: ~0.4% of maps are minimum-width corridors whose
    // early slots are fully consumed by the C-row guarantees (cones +
    // floors must land ≤ h5, and a 2-wide early band has no alternatives),
    // physically capping events ≈2.3 (worklog §77e2 — seeds 13/430 are the
    // shape). Tightening this to 100% is a width-floor design decision
    // (killing 2-wide corridors), flagged to the user at the e2 pause.
    const { eventsPerRoute, eventsBandHalfWidth } = NODE_MAP;
    const values = corpus.map(({ m }) => m.expectedRouteComposition.get('event') ?? 0);
    const inBand = values.filter(
      (ev) => ev >= eventsPerRoute - eventsBandHalfWidth && ev <= eventsPerRoute + eventsBandHalfWidth,
    );
    expect(inBand.length / SEEDS).toBeGreaterThanOrEqual(0.99);
    expect(Math.min(...values)).toBeGreaterThanOrEqual(2.2);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    expect(mean).toBeGreaterThanOrEqual(2.8);
    expect(mean).toBeLessThanOrEqual(3.2);
  });

  it('canary: pooled combat share lands near the signed ≈55–65% expectation', () => {
    // Not a signed row — the 77c sheet PREDICTED this lands ≈55–65% as a
    // consequence of the band. Loose bounds so a quota drift surfaces as a
    // conversation, not a silent composition change.
    let combat = 0;
    let total = 0;
    for (const { m } of corpus) {
      for (const kind of ['battle', 'elite', 'boss'] as const) {
        combat += m.expectedRouteComposition.get(kind) ?? 0;
      }
      for (const v of m.expectedRouteComposition.values()) total += v;
    }
    const share = combat / total;
    expect(share).toBeGreaterThanOrEqual(0.5);
    expect(share).toBeLessThanOrEqual(0.7);
  });
});
