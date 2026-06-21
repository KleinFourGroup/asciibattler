import { describe, it, expect } from 'vitest';
import { RNG } from '../../core/RNG';
import { resolveWave, type WaveContext } from './wave';
import { waveForTurn } from './sequencer';
import { getEncounter } from '../../config/encounters';
import { DECK } from '../../config/deck';
import { ARCHETYPE_CONFIG } from '../../sim/archetypes';
import type { Archetype, UnitTemplate } from '../../sim/Unit';

/**
 * "Brigands" is the catalog's everyday-fight reference encounter. It WAS pinned
 * faithful to the pre-V random `rollEnemyWave` budget (U3/V1 built it to
 * reproduce the old single-wave swarm); **Phase X3 — the conscious retune point
 * the original test named** — re-derived the band against the multi-wave authored
 * model (the old per-wave budget × ~3 grind-down waves ran far over the 20-pool),
 * so brigands now carries its own tuned wave-spec, decoupled from `difficulty.json`.
 *
 * This test no longer holds brigands to the old generator; it pins the structural
 * identity + that the resolver fields the encounter's OWN authored count /
 * composition / level budget (expectations read live from the spec, never
 * hardcoded — per the balance-proof-test discipline), so it flags a drift between
 * the catalog and `resolveWave` rather than a deliberate retune.
 */

function roster(levels: number[], archetype: Archetype = 'mercenary'): UnitTemplate[] {
  return levels.map((level) => ({ archetype, level, stats: { ...ARCHETYPE_CONFIG[archetype].baseStats }, xp: 0 }));
}

/** The production WaveContext for a roster (mirrors what Run.beginTurn builds). */
function contextFor(team: UnitTemplate[]): WaveContext {
  return {
    roster: team,
    handSize: Math.min(team.length, DECK.handSize),
  };
}

const brigands = getEncounter('brigands');

describe('brigands — the everyday-fight reference (identity)', () => {
  it('exists in the catalog as a normal fight with a positive health pool', () => {
    expect(brigands).toBeDefined();
    expect(brigands!.name).toBe('Brigands');
    expect(brigands!.kind).toBe('normal');
    expect(brigands!.healthPool).toBeGreaterThan(0);
  });

  it('is a forever loop of one wave (re-rolls every turn)', () => {
    expect(brigands!.waves).toHaveLength(1);
    expect(brigands!.waves[0]!.kind).toBe('loop');
  });
});

describe('brigands — resolves to its own authored wave-spec', () => {
  // A mid-run roster small enough that the budget affords ≥ 1 level per unit, so
  // the team's TOTAL level lands exactly on the authored budget. Mean 5, size 5 ≤
  // handSize. Expectations are derived from the resolved spec (read live), not
  // from hardcoded constants or difficulty.json.
  const team = roster([5, 5, 5, 5, 5]);
  const handSize = Math.min(team.length, DECK.handSize);
  const { spec } = waveForTurn(brigands!.waves, null, { poolFraction: 1, turn: 1 }, new RNG(1));

  it('fields count.factor × hand bodies of the authored archetypes', () => {
    const expectedCount =
      spec.count.kind === 'hand' ? Math.round(spec.count.factor * handSize) : spec.count.value;
    const authored = new Set(spec.units.map((u) => u.archetype));
    for (let s = 0; s < 30; s++) {
      const wave = resolveWave(spec, contextFor(team), new RNG(s));
      expect(wave).toHaveLength(expectedCount);
      expect(wave.every((u) => authored.has(u.archetype))).toBe(true);
    }
  });

  it('spends the authored level budget (uncapped, budget-affording case)', () => {
    const meanLevel = team.reduce((a, u) => a + u.level, 0) / team.length;
    // brigands authors a `mean` budget and no levelCap, so the wave spends the
    // full factor × meanLevel × handSize budget across its bodies.
    const expectedBudget =
      spec.levelBudget.kind === 'fixed'
        ? spec.levelBudget.value
        : Math.round(spec.levelBudget.factor * meanLevel * handSize);
    for (let s = 0; s < 30; s++) {
      const wave = resolveWave(spec, contextFor(team), new RNG(s));
      expect(wave.reduce((a, u) => a + u.level, 0)).toBe(expectedBudget);
    }
  });
});
