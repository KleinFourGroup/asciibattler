import { describe, it, expect } from 'vitest';
import { RNG } from '../../core/RNG';
import { resolveWave, type WaveSpec, type WaveContext } from './wave';
import type { WaveEntry } from './sequencer';
import { ENCOUNTERS } from '../../config/encounters';
import { DIFFICULTY } from '../../config/difficulty';
import { DECK } from '../../config/deck';
import { scaledUnit } from '../../sim/archetypes';
import type { UnitTemplate } from '../../sim/Unit';

/**
 * Phase X — the per-wave `levelCap` migration is BYTE-IDENTICAL to the retired
 * global cap.
 *
 * Pre-X every wave was resolved with a single global ceiling
 * (`highestRosterLevel + DIFFICULTY.unitLevelDelta`). X moved the cap onto the
 * wave spec (`levelCap?`, absent = uncapped) and stamped `{ roster, delta }` only
 * on the waves where that cap actually BINDS — leaving the rest absent. This is
 * exact because a cap that never binds is byte-for-byte identical to no cap (same
 * `total`, same per-instance levels, same RNG draw count in
 * `distributeWeightedLevels`).
 *
 * The first test proves the whole catalog reproduces the old global-cap behaviour
 * (a binding-but-unstamped wave would fail it → it doubles as a COMPLETENESS check
 * on the stamping set). The second proves no GRATUITOUS stamps — every stamped cap
 * changes the output for some roster/seed. Together they pin the stamping set as
 * exactly the biting set. The cap delta derives from `DIFFICULTY.unitLevelDelta`
 * (balance-proof — never hardcoded), so this flags the day the global knob and the
 * frozen authored caps diverge (the conscious retune point, like the Brigands
 * faithfulness test).
 */

/** Collect every leaf `WaveSpec` in a wave-list entry (recurses the grammar). */
function collectSpecs(entry: WaveEntry): WaveSpec[] {
  switch (entry.kind) {
    case 'wave':
      return [entry.spec];
    case 'pick':
      return entry.options.flatMap((o) => collectSpecs(o.entry));
    case 'loop':
      return entry.body.flatMap(collectSpecs);
    case 'stages':
      return entry.stages.flatMap((s) => s.body.flatMap(collectSpecs));
  }
}

const ALL_SPECS: { encounterId: string; spec: WaveSpec }[] = ENCOUNTERS.flatMap((e) =>
  e.waves.flatMap((entry) => collectSpecs(entry).map((spec) => ({ encounterId: e.id, spec }))),
);

// Rosters that STRESS the cap: flat rosters (highest ≈ mean → the cap bites
// hardest) from low to high mean, a spiky roster (generous cap), and a roster
// larger than the hand (count/budget basis is the fielded hand).
const ROSTERS: readonly (readonly number[])[] = [
  [1, 1, 1],
  [3, 3, 3, 3, 3],
  [5, 5, 5, 5, 5],
  [8, 8, 8, 8, 8, 8],
  [10, 10, 10, 10, 10, 10],
  [1, 2, 3, 8, 12],
  [2, 2, 3, 3, 4],
  [3, 3, 3, 3, 3, 3, 3, 3],
];

const SEEDS = 16;

function rosterOf(levels: readonly number[]): UnitTemplate[] {
  return levels.map((lv) => scaledUnit('mercenary', lv));
}

function ctxFor(roster: UnitTemplate[]): WaveContext {
  return { roster, handSize: Math.min(roster.length, DECK.handSize) };
}

/** The pre-migration global cap, forced onto ANY wave regardless of authoring. */
const GLOBAL_CAP: WaveSpec['levelCap'] = { kind: 'roster', delta: DIFFICULTY.unitLevelDelta };

describe('levelCap migration — byte-identical to the retired global cap', () => {
  it('every catalog wave resolves identically with its authored cap and with the forced global cap', () => {
    for (const { encounterId, spec } of ALL_SPECS) {
      const forced: WaveSpec = { ...spec, levelCap: GLOBAL_CAP };
      for (const levels of ROSTERS) {
        const context = ctxFor(rosterOf(levels));
        for (let s = 0; s < SEEDS; s++) {
          expect(
            resolveWave(spec, context, new RNG(s)),
            `encounter "${encounterId}", roster [${levels}], seed ${s}`,
          ).toEqual(resolveWave(forced, context, new RNG(s)));
        }
      }
    }
  });

  it('every STAMPED cap is load-bearing — uncapping it changes the output for some roster/seed', () => {
    const stamped = ALL_SPECS.filter(({ spec }) => spec.levelCap !== undefined);
    expect(stamped.length).toBeGreaterThan(0); // the migration stamped a real subset

    for (const { encounterId, spec } of stamped) {
      // Rebuild the spec WITHOUT a cap (no `delete` → no readonly fight / unused var).
      const uncapped: WaveSpec = { levelBudget: spec.levelBudget, count: spec.count, units: spec.units };
      let differs = false;
      for (const levels of ROSTERS) {
        const context = ctxFor(rosterOf(levels));
        for (let s = 0; s < SEEDS && !differs; s++) {
          const capped = JSON.stringify(resolveWave(spec, context, new RNG(s)));
          const free = JSON.stringify(resolveWave(uncapped, context, new RNG(s)));
          if (capped !== free) differs = true;
        }
        if (differs) break;
      }
      expect(differs, `encounter "${encounterId}" stamped a cap that never binds`).toBe(true);
    }
  });
});
