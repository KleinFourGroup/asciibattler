import { describe, it, expect } from 'vitest';
import { RNG } from '../../core/RNG';
import { waveForTurn, type WaveList } from './sequencer';
import { getEncounter } from '../../config/encounters';
import { HEALTH } from '../../config/health';

/**
 * W — "The Bandit King" is the launch BOSS: the first `kind: 'boss'` encounter
 * and the first to exercise the deferred condition-gated `stages` grammar (U2).
 * These pin its shape (a 3-phase escalation, the first two phases pool-gated, the
 * final open-ended) and that the REAL sequencer walks those phases in order as
 * the enemy pool drops — the "the boss gets angrier as you wear it down" feel,
 * proven headlessly. Expectations derive from the authored encounter (never a
 * hardcoded composition), so re-authoring the boss in the editor can't silently
 * desync the test.
 */

const boss = getEncounter('bandit-king');

/** The archetypes each `stages` phase fields, read straight off the authored
 *  encounter (each phase body is a single `wave` entry). */
function phaseArchetypes(waves: WaveList): string[][] {
  const top = waves[0]!;
  if (top.kind !== 'stages') throw new Error('expected a top-level stages entry');
  return top.stages.map((s) => {
    const w = s.body[0]!;
    if (w.kind !== 'wave') throw new Error('expected each phase body to be a single wave');
    return w.spec.units.map((u) => u.archetype);
  });
}

describe('the bandit king — the launch boss (shape)', () => {
  it('exists in the catalog as a boss with a deeper-than-normal pool', () => {
    expect(boss).toBeDefined();
    expect(boss!.name).toBe('The Bandit King');
    expect(boss!.kind).toBe('boss');
    // A climactic fight: a bigger pool than the everyday road fights so its
    // phases have room to breathe (the exact value is an X tuning target).
    expect(boss!.healthPool).toBeGreaterThan(HEALTH.enemyHealthMax);
  });

  it('is authored as a 3-phase stages grammar: two pool-gated phases, one open-ended', () => {
    const top = boss!.waves[0]!;
    expect(top.kind).toBe('stages');
    if (top.kind !== 'stages') return;
    expect(top.stages).toHaveLength(3);
    // The first two phases advance on a pool threshold; the last runs open-ended.
    expect(top.stages[0]!.until).toBeDefined();
    expect(top.stages[1]!.until).toBeDefined();
    expect(top.stages[2]!.until).toBeUndefined();
    // The thresholds descend (each phase opens on a lower remaining pool).
    const f0 = top.stages[0]!.until!.fraction;
    const f1 = top.stages[1]!.until!.fraction;
    expect(f0).toBeGreaterThan(f1);
  });

  it('fields visibly distinct hosts per phase (an escalation, not a re-skin)', () => {
    const [p1, p2, p3] = phaseArchetypes(boss!.waves);
    // Each phase commands a different roster — the structural "feel" of escalation.
    expect(p1).not.toEqual(p2);
    expect(p2).not.toEqual(p3);
    expect(p1).not.toEqual(p3);
  });
});

describe('the bandit king — the sequencer escalates as the pool drops', () => {
  it('walks phase 1 → 2 → 3 as the pool crosses each authored threshold', () => {
    const [p1, p2, p3] = phaseArchetypes(boss!.waves);
    const rng = new RNG(1);

    // Turn 1: full pool → phase 1 (the honour guard).
    let r = waveForTurn(boss!.waves, null, { poolFraction: 1, turn: 1 }, rng);
    expect(r.spec.units.map((u) => u.archetype)).toEqual(p1);

    // Pool crosses the first threshold → phase 2 on the next turn (the berserkers).
    r = waveForTurn(boss!.waves, r.cursor, { poolFraction: 0.5, turn: 2 }, rng);
    expect(r.spec.units.map((u) => u.archetype)).toEqual(p2);

    // Pool crosses the second threshold → phase 3, the open-ended last stand.
    r = waveForTurn(boss!.waves, r.cursor, { poolFraction: 0.2, turn: 3 }, rng);
    expect(r.spec.units.map((u) => u.archetype)).toEqual(p3);

    // The final phase repeats (last-wave-repeats) for the rest of the fight.
    r = waveForTurn(boss!.waves, r.cursor, { poolFraction: 0.05, turn: 4 }, rng);
    expect(r.spec.units.map((u) => u.archetype)).toEqual(p3);
  });

  it('holds an early phase while the pool stays above its threshold', () => {
    const [p1] = phaseArchetypes(boss!.waves);
    const rng = new RNG(2);
    let r = waveForTurn(boss!.waves, null, { poolFraction: 1, turn: 1 }, rng);
    expect(r.spec.units.map((u) => u.archetype)).toEqual(p1);
    // Pool barely dented (above the first threshold) → still phase 1.
    r = waveForTurn(boss!.waves, r.cursor, { poolFraction: 0.9, turn: 2 }, rng);
    expect(r.spec.units.map((u) => u.archetype)).toEqual(p1);
  });
});
