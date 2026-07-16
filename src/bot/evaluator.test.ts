/**
 * 57e — the evaluator's load-bearing contracts:
 *
 * 1. DETERMINISM — same live world + same spec ⇒ the same exact number
 *    (the whole harness's reproducibility flows through this).
 * 2. DISCRIMINATION — an objectively better candidate scores higher on a
 *    crafted world where the right answer is unambiguous (advance-and-
 *    wipe vs stand-off), and the end bonus dominates the material term.
 * 3. MATERIAL ACCOUNTING — HP fractions, not death counts.
 * 4. AVERAGING — evaluate([a,b]) is the mean of evaluate([a]) and
 *    evaluate([b]) (the CRN comparison rests on candidates sharing the
 *    same per-seed scores, so the aggregation must be a plain mean).
 */

import { describe, expect, it } from 'vitest';
import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import { RNG } from '../core/RNG';
import { World } from '../sim/World';
import { rollUnit } from '../sim/archetypes';
import { MovementBehavior } from '../sim/behaviors/MovementBehavior';
import { AbilityBehavior } from '../sim/behaviors/AbilityBehavior';
import { createAbility } from '../sim/abilities/registry';
import { evaluateCandidate, materialOf, WIN_BONUS } from './evaluator';

function spawnMerc(world: World, team: 'player' | 'enemy', x: number, y: number) {
  const u = world.spawnUnit(rollUnit('mercenary', world.rng), team, { x, y });
  u.behaviors.push(new MovementBehavior(), new AbilityBehavior());
  u.abilities.push(createAbility('sword'));
  return u;
}

/**
 * Three mercs vs one HOLDING enemy across the map: under the null arm
 * (atWill) the players advance and wipe it inside the horizon; under a
 * player `hold` nobody ever reaches anybody. The unambiguous case.
 */
function standoffBattle(seed: number): World {
  const world = new World(new EventBus<GameEvents>(), new RNG(seed));
  spawnMerc(world, 'player', 2, 2);
  spawnMerc(world, 'player', 4, 2);
  spawnMerc(world, 'player', 6, 2);
  spawnMerc(world, 'enemy', 4, 9);
  world.enqueueCommand({ kind: 'setObjective', team: 'enemy', objective: { mode: 'hold' } });
  world.tick(); // drain the command so the enemy's hold is standing state
  return world;
}

const SPEC = { horizonTicks: 160, rolloutSeeds: [11, 22] };

describe('evaluateCandidate (57e — the rollout evaluator)', () => {
  it('is deterministic: same world + same spec ⇒ the same exact number', () => {
    const world = standoffBattle(1234);
    const a = evaluateCandidate(world, 'player', null, SPEC);
    const b = evaluateCandidate(world, 'player', null, SPEC);
    expect(b).toBe(a);
  });

  it('discriminates: advance-and-wipe outscores stand-off, and the end bonus dominates', () => {
    const world = standoffBattle(1234);
    const advance = evaluateCandidate(world, 'player', null, SPEC);
    const hold = evaluateCandidate(
      world,
      'player',
      { kind: 'setObjective', team: 'player', objective: { mode: 'hold' } },
      SPEC,
    );
    expect(advance).toBeGreaterThan(hold);
    // 3v1 wipes the holding enemy inside 8s: the win bonus must be in the
    // score (material alone caps far below it).
    expect(advance).toBeGreaterThan(WIN_BONUS / 2);
    // Held apart, nobody exchanges a point of material.
    expect(Math.abs(hold)).toBeLessThan(1);
  });

  it('materialOf counts HP fractions, not heads', () => {
    const world = new World(new EventBus<GameEvents>(), new RNG(9));
    spawnMerc(world, 'player', 2, 2);
    const hurt = spawnMerc(world, 'player', 4, 2);
    hurt.currentHp = hurt.derived.maxHp / 2;
    expect(materialOf(world, 'player')).toBeCloseTo(1.5, 10);
    expect(materialOf(world, 'enemy')).toBe(0);
  });

  it('averages per-seed scores (the CRN aggregation contract)', () => {
    const world = standoffBattle(777);
    const short = { horizonTicks: 80 };
    const a = evaluateCandidate(world, 'player', null, { ...short, rolloutSeeds: [5] });
    const b = evaluateCandidate(world, 'player', null, { ...short, rolloutSeeds: [9] });
    const ab = evaluateCandidate(world, 'player', null, { ...short, rolloutSeeds: [5, 9] });
    expect(ab).toBeCloseTo((a + b) / 2, 10);
  });

  it('throws on an empty seed list (a silent 0-rollout score would lie)', () => {
    const world = standoffBattle(42);
    expect(() =>
      evaluateCandidate(world, 'player', null, { horizonTicks: 80, rolloutSeeds: [] }),
    ).toThrow(/non-empty/);
  });
});
