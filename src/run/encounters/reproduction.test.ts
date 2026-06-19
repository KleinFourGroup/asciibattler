import { describe, it, expect } from 'vitest';
import { RNG } from '../../core/RNG';
import { reproductionEncounter, REPRODUCTION_ENCOUNTER_ID } from './reproduction';
import { resolveWave, type WaveContext } from './wave';
import { waveForTurn } from './sequencer';
import { enemyBudgetFor } from '../enemyBudget';
import { EncountersSchema } from '../../config/encounters';
import { DIFFICULTY } from '../../config/difficulty';
import { HEALTH } from '../../config/health';
import { DECK } from '../../config/deck';
import { ARCHETYPE_CONFIG } from '../../sim/archetypes';
import type { Archetype, UnitTemplate } from '../../sim/Unit';

function roster(levels: number[], archetype: Archetype = 'mercenary'): UnitTemplate[] {
  return levels.map((level) => ({ archetype, level, stats: { ...ARCHETYPE_CONFIG[archetype].baseStats }, xp: 0 }));
}

/** The production WaveContext for a roster (mirrors what Run.beginTurn will build). */
function contextFor(team: UnitTemplate[]): WaveContext {
  return {
    roster: team,
    handSize: Math.min(team.length, DECK.handSize),
    levelCap: Math.max(1, ...team.map((u) => u.level)) + DIFFICULTY.unitLevelDelta,
  };
}

describe('reproductionEncounter — identity + schema', () => {
  it('is a normal "Brigands" encounter pooled at HEALTH.enemyHealthMax', () => {
    const e = reproductionEncounter();
    expect(e.id).toBe(REPRODUCTION_ENCOUNTER_ID);
    expect(e.name).toBe('Brigands');
    expect(e.kind).toBe('normal');
    expect(e.healthPool).toBe(HEALTH.enemyHealthMax);
  });

  it('is a forever loop of one wave (re-rolls every turn)', () => {
    const e = reproductionEncounter();
    expect(e.waves).toHaveLength(1);
    expect(e.waves[0]!.kind).toBe('loop');
  });

  it('its wave factors track the live DIFFICULTY config', () => {
    const e = reproductionEncounter();
    const loop = e.waves[0]!;
    if (loop.kind !== 'loop') throw new Error('expected loop');
    const entry = loop.body[0]!;
    if (entry.kind !== 'wave') throw new Error('expected wave');
    const spec = entry.spec;
    expect(spec.levelBudget).toEqual({ kind: 'mean', factor: DIFFICULTY.budgetFactor });
    expect(spec.count).toEqual({ kind: 'hand', factor: DIFFICULTY.swarmMaxMultiplier });
    const bandit = spec.units.find((u) => u.archetype === 'bandit')!;
    const ranged = spec.units.find((u) => u.archetype === 'ranged')!;
    expect(bandit.count).toEqual({ kind: 'weight', weight: 1 - DIFFICULTY.enemyArcherRatio });
    expect(ranged.count).toEqual({ kind: 'weight', weight: DIFFICULTY.enemyArcherRatio });
  });

  it('is a structurally valid Encounter (passes the recursive schema)', () => {
    expect(EncountersSchema.safeParse([reproductionEncounter()]).success).toBe(true);
  });
});

describe('reproductionEncounter — balance-proof faithfulness to rollEnemyWave', () => {
  // A mid-run roster small enough that the budget can afford ≥ 1 level per unit,
  // so the team's TOTAL level lands exactly on enemyBudgetFor (both derive from
  // DIFFICULTY — never a hardcoded roster). Mean 5, size 5 ≤ handSize.
  const team = roster([5, 5, 5, 5, 5]);
  const e = reproductionEncounter();
  const { spec } = waveForTurn(e.waves, null, { poolFraction: 1, turn: 1 }, new RNG(1));

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
