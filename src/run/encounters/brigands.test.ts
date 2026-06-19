import { describe, it, expect } from 'vitest';
import { RNG } from '../../core/RNG';
import { resolveWave, type WaveContext } from './wave';
import { waveForTurn } from './sequencer';
import { enemyBudgetFor } from '../enemyBudget';
import { getEncounter } from '../../config/encounters';
import { DIFFICULTY } from '../../config/difficulty';
import { HEALTH } from '../../config/health';
import { DECK } from '../../config/deck';
import { ARCHETYPE_CONFIG } from '../../sim/archetypes';
import type { Archetype, UnitTemplate } from '../../sim/Unit';

/**
 * V1 — "Brigands" is the authored ANCHOR encounter: the faithful baseline that
 * re-creates the pre-V random swarm (`rollEnemyWave`). U3 built it in code
 * (reading live config); V1 hoisted it into `config/encounters.json` with literal
 * constants. This test pins that faithfulness: at TODAY's config, Brigands still
 * resolves to `enemyBudgetFor`'s budget + the `enemyArcherRatio` split — deriving
 * the expectation from the config modules (never hardcoded), so it flags the day
 * Brigands and `difficulty.json` diverge (the conscious retune point at X). The
 * variants (Highwaymen / Deserters) carry NO faithfulness test — only the anchor
 * is held to the old generator.
 */

function roster(levels: number[], archetype: Archetype = 'mercenary'): UnitTemplate[] {
  return levels.map((level) => ({ archetype, level, stats: { ...ARCHETYPE_CONFIG[archetype].baseStats }, xp: 0 }));
}

/** The production WaveContext for a roster (mirrors what Run.beginTurn builds). */
function contextFor(team: UnitTemplate[]): WaveContext {
  return {
    roster: team,
    handSize: Math.min(team.length, DECK.handSize),
    levelCap: Math.max(1, ...team.map((u) => u.level)) + DIFFICULTY.unitLevelDelta,
  };
}

const brigands = getEncounter('brigands');

describe('brigands — the anchor encounter (identity)', () => {
  it('exists in the catalog as a normal fight pooled at the launch enemy health', () => {
    expect(brigands).toBeDefined();
    expect(brigands!.name).toBe('Brigands');
    expect(brigands!.kind).toBe('normal');
    expect(brigands!.healthPool).toBe(HEALTH.enemyHealthMax);
  });

  it('is a forever loop of one wave (re-rolls every turn)', () => {
    expect(brigands!.waves).toHaveLength(1);
    expect(brigands!.waves[0]!.kind).toBe('loop');
  });
});

describe('brigands — balance-proof faithfulness to rollEnemyWave', () => {
  // A mid-run roster small enough that the budget affords ≥ 1 level per unit, so
  // the team's TOTAL level lands exactly on enemyBudgetFor (both derive from
  // DIFFICULTY — never a hardcoded roster). Mean 5, size 5 ≤ handSize.
  const team = roster([5, 5, 5, 5, 5]);
  const { spec } = waveForTurn(brigands!.waves, null, { poolFraction: 1, turn: 1 }, new RNG(1));

  it('fields hand × swarmMax bodies, split bandit/ranged by enemyArcherRatio', () => {
    const expectedCount = Math.round(DIFFICULTY.swarmMaxMultiplier * Math.min(team.length, DECK.handSize));
    for (let s = 0; s < 30; s++) {
      const wave = resolveWave(spec, contextFor(team), new RNG(s));
      expect(wave).toHaveLength(expectedCount);
      expect(wave.every((u) => u.archetype === 'bandit' || u.archetype === 'ranged')).toBe(true);
      expect(wave.filter((u) => u.archetype === 'bandit').length).toBe(
        Math.round(expectedCount * (1 - DIFFICULTY.enemyArcherRatio)),
      );
    }
  });

  it('the wave total level equals enemyBudgetFor(roster) (budget-affording case)', () => {
    for (let s = 0; s < 30; s++) {
      const wave = resolveWave(spec, contextFor(team), new RNG(s));
      expect(wave.reduce((a, u) => a + u.level, 0)).toBe(enemyBudgetFor(team));
    }
  });
});
