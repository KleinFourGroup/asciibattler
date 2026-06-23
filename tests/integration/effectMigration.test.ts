/**
 * Phase Y3/Y4 — the strangler-migration equivalence ORACLE.
 *
 * The keystone of Cluster 1 is replacing the hand-coded combat verb classes
 * (`MeleeStrike` / `RangedShot` / `HealAlly` / `GambitStrike` / `DashAbility` /
 * `MagicBolt` / `CatapultShot`) with ONE data-driven `EffectAbility` + an op
 * interpreter. The migration is only safe if it's behavior-preserving — so for
 * each verb we run the SAME seeded fixture battle TWICE, once with the legacy
 * ability and once with its `EffectAbility`, and assert the two are
 * byte-identical: the full emitted event trace AND the final world state
 * (positions, HP, cooldowns, and the `combatRng` stream itself — the strongest
 * proof that every RNG draw happened in the same order).
 *
 * The ONE field that legitimately changes is `action:phase`'s `actionId`: the
 * migration renames the in-flight action from its per-class id to its `AbilityDef`
 * id (the sword's was `'attack'`, now `'sword'`; the gambit/dash keep theirs).
 * That id has no gameplay consequence (and, for these verbs, no renderer
 * consumer), so it's normalized OUT of the trace — the phase boundary itself
 * (unit + phase + target + tick) is still compared verbatim.
 *
 * This is the determinism harness's cross-implementation sibling: where
 * `determinism.test.ts` proves run-vs-run stability, this proves
 * legacy-vs-migrated equivalence. It's the gate every Y3/Y4 verb commit must pass.
 */

import { describe, it, expect } from 'vitest';
import { World } from '../../src/sim/World';
import type { Unit } from '../../src/sim/Unit';
import type { Ability } from '../../src/sim/abilities/Ability';
import { MovementBehavior } from '../../src/sim/behaviors/MovementBehavior';
import { AbilityBehavior } from '../../src/sim/behaviors/AbilityBehavior';
import { MeleeStrike, RangedShot } from '../../src/sim/abilities/strikes';
import { EffectAbility } from '../../src/sim/effects/EffectAbility';
import { abilityDef } from '../../src/config/abilityDefs';
import { rollUnit } from '../../src/sim/archetypes';
import type { Archetype, UnitArchetype } from '../../src/sim/Unit';
import { EventBus } from '../../src/core/EventBus';
import { RNG } from '../../src/core/RNG';
import type { GameEvents } from '../../src/core/events';
import type { GridCoord } from '../../src/core/types';

type AbilityFactory = () => Ability;

/* -------------------------------------------------------------------------- */
/* Recorded trace + final-state shapes.                                       */
/* -------------------------------------------------------------------------- */

type RecordedEvent =
  | { kind: 'tick'; tick: number }
  | { kind: 'unit:spawned'; unitId: number }
  | { kind: 'unit:moved'; unitId: number; from: GridCoord; to: GridCoord; durationTicks: number }
  | { kind: 'unit:dashed'; unitId: number; from: GridCoord; to: GridCoord; durationTicks: number }
  | { kind: 'unit:attacked'; attackerId: number; targetId: number; damage: number; crit: boolean }
  | { kind: 'unit:missed'; attackerId: number; targetId: number }
  | { kind: 'unit:healed'; unitId: number; amount: number; healerId: number | null }
  | { kind: 'unit:died'; unitId: number }
  | { kind: 'battle:ended'; winner: GameEvents['battle:ended']['winner'] }
  // `actionId` is deliberately omitted — it renames legacy→def (see file header).
  | {
      kind: 'action:phase';
      unitId: number;
      phase: string;
      targetId: number | undefined;
      targetCell: GridCoord | undefined;
    };

interface UnitFinal {
  id: number;
  team: string;
  archetype: UnitArchetype;
  x: number;
  y: number;
  currentHp: number;
  cooldowns: Array<[string, number]>;
}

interface FinalState {
  tick: number;
  ended: boolean;
  combatRng: number;
  rng: number;
  units: UnitFinal[];
}

interface FixtureResult {
  events: RecordedEvent[];
  final: FinalState;
}

/* -------------------------------------------------------------------------- */
/* The fixture battle (mirrors determinism.test.ts's layout).                 */
/* -------------------------------------------------------------------------- */

function recordEvents(bus: EventBus<GameEvents>): RecordedEvent[] {
  const out: RecordedEvent[] = [];
  bus.on('tick', (p) => out.push({ kind: 'tick', tick: p.tick }));
  bus.on('unit:spawned', (p) => out.push({ kind: 'unit:spawned', unitId: p.unitId }));
  bus.on('unit:moved', (p) =>
    out.push({
      kind: 'unit:moved',
      unitId: p.unitId,
      from: { ...p.from },
      to: { ...p.to },
      durationTicks: p.durationTicks,
    }),
  );
  bus.on('unit:dashed', (p) =>
    out.push({
      kind: 'unit:dashed',
      unitId: p.unitId,
      from: { ...p.from },
      to: { ...p.to },
      durationTicks: p.durationTicks,
    }),
  );
  bus.on('unit:attacked', (p) =>
    out.push({
      kind: 'unit:attacked',
      attackerId: p.attackerId,
      targetId: p.targetId,
      damage: p.damage,
      crit: p.crit,
    }),
  );
  bus.on('unit:missed', (p) =>
    out.push({ kind: 'unit:missed', attackerId: p.attackerId, targetId: p.targetId }),
  );
  bus.on('unit:healed', (p) =>
    out.push({ kind: 'unit:healed', unitId: p.unitId, amount: p.amount, healerId: p.healerId }),
  );
  bus.on('unit:died', (p) => out.push({ kind: 'unit:died', unitId: p.unitId }));
  bus.on('battle:ended', (p) => out.push({ kind: 'battle:ended', winner: p.winner }));
  bus.on('action:phase', (p) =>
    out.push({
      kind: 'action:phase',
      unitId: p.unitId,
      phase: p.phase,
      targetId: p.targetId,
      targetCell: p.targetCell ? { ...p.targetCell } : undefined,
    }),
  );
  return out;
}

function snapshotFinal(world: World): FinalState {
  return {
    tick: world.currentTick,
    ended: world.ended,
    combatRng: world.combatRng.toJSON().state,
    rng: world.rng.toJSON().state,
    units: world.units
      .map<UnitFinal>((u: Unit) => ({
        id: u.id,
        team: u.team,
        archetype: u.archetype,
        x: u.position.x,
        y: u.position.y,
        currentHp: u.currentHp,
        cooldowns: [...u.actionCooldowns.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)),
      }))
      .sort((a, b) => a.id - b.id),
  };
}

/**
 * Two equal teams of `archetype`, each unit carrying a fresh `makeAbility()`,
 * walked into each other and run for `maxTicks`. Same seed → same stat rolls,
 * same layout — the ONLY variable is the ability instance.
 */
function runFixture(
  archetype: Archetype,
  makeAbility: AbilityFactory,
  seed: number,
  maxTicks: number,
): FixtureResult {
  const bus = new EventBus<GameEvents>();
  const world = new World(bus, new RNG(seed));
  const events = recordEvents(bus);

  const COLUMNS = [2, 4, 6, 8, 10];
  for (const x of COLUMNS) {
    const u = world.spawnUnit(rollUnit(archetype, world.rng), 'player', { x, y: 2 });
    u.behaviors.push(new MovementBehavior(), new AbilityBehavior());
    u.abilities.push(makeAbility());
  }
  for (const x of COLUMNS) {
    const u = world.spawnUnit(rollUnit(archetype, world.rng), 'enemy', { x, y: 9 });
    u.behaviors.push(new MovementBehavior(), new AbilityBehavior());
    u.abilities.push(makeAbility());
  }

  for (let i = 0; i < maxTicks && !world.ended; i++) world.tick();

  return { events, final: snapshotFinal(world) };
}

/**
 * The oracle assertion for one verb: legacy and migrated, same fixture, must be
 * byte-identical. `expect(b).toEqual(a)` covers the whole trace + final state.
 */
function assertVerbMigration(
  archetype: Archetype,
  legacy: AbilityFactory,
  migrated: AbilityFactory,
  { seed = 54321, maxTicks = 500 }: { seed?: number; maxTicks?: number } = {},
): void {
  const a = runFixture(archetype, legacy, seed, maxTicks);
  const b = runFixture(archetype, migrated, seed, maxTicks);
  // Sanity: a substantial battle, so equality isn't trivially true.
  expect(a.events.length).toBeGreaterThan(20);
  expect(b.events).toEqual(a.events);
  expect(b.final).toEqual(a.final);
}

/* -------------------------------------------------------------------------- */
/* The migrated verbs.                                                        */
/* -------------------------------------------------------------------------- */

describe('Phase Y3 — effect-migration oracle', () => {
  describe('melee strike → EffectAbility is byte-identical to MeleeStrike', () => {
    for (const weapon of ['sword', 'club', 'katana', 'whip'] as const) {
      it(`${weapon}`, () => {
        assertVerbMigration(
          'mercenary',
          () => new MeleeStrike(weapon),
          () => new EffectAbility(abilityDef(weapon)),
        );
      });
    }
  });

  it('ranged shot (bow) → EffectAbility is byte-identical to RangedShot', () => {
    assertVerbMigration(
      'ranged',
      () => new RangedShot(),
      () => new EffectAbility(abilityDef('bow')),
    );
  });
});
