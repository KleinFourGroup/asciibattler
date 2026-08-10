/**
 * §76a — the aura engine core: the `aura` def field + `World.applyAuraStatuses`
 * (the second sustain source beside the 27d tiles).
 *
 * Headless-first (the C1d rule): every behavior here is pinned without the
 * browser. Content uses the REAL `emboldened` status (config/statuses.json —
 * refresh / 5s / statMods) so expectations derive from config, never hardcoded
 * balance arithmetic; the mobility round-trip authors a SYNTHETIC parsed
 * `StatusDef` (mods ride the runtime effect, so no config entry is needed).
 */

import { describe, it, expect } from 'vitest';
import { World } from '../World';
import { EventBus } from '../../core/EventBus';
import { RNG } from '../../core/RNG';
import { Unit } from '../Unit';
import { deriveStats } from '../stats';
import { ARCHETYPE_CONFIG } from '../archetypes';
import { spawnWall } from '../environment';
import { EffectAbility } from './EffectAbility';
import { AbilityDefSchema, type AbilityDef } from './schema';
import { StatusDefSchema } from './statusSchema';
import { STATUS_DEFS, assertStatusRefsResolve } from '../../config/statuses';
import { ABILITY_DEFS } from '../../config/abilities';
import { secondsToTicks } from '../../config';
import type { GameEvents } from '../../core/events';
import type { GridCoord } from '../../core/types';
import type { Team } from '../Unit';

const EMBOLDENED = STATUS_DEFS.emboldened!;

/** A 24x24 world — roomy enough for the out-of-radius / teleport coordinates
 *  (the default GRID_SIZE grid is smaller and kindAt throws out of bounds). */
const freshWorld = (bus: EventBus<GameEvents> = new EventBus<GameEvents>()): World =>
  new World(bus, new RNG(1), 24, 24);
const EMBOLDENED_TICKS = Math.max(1, secondsToTicks(EMBOLDENED.durationSeconds));

/** A minimal PURE-aura def (no ops → target 'self', per the schema refine). */
function auraDef(over: Partial<{ radius: number; affects: 'enemies' | 'allies' | 'all' }> = {}): AbilityDef {
  return AbilityDefSchema.parse({
    id: 'test_aura',
    name: 'Test Aura',
    cooldownSeconds: 1,
    rangeCells: 0,
    target: { kind: 'self' },
    timeline: [{ phase: 'recovery', seconds: 'fill' }],
    orphanPolicy: 'commit-at-cast',
    priority: 0,
    effects: [],
    aura: { radius: over.radius ?? 3, statusId: 'emboldened', affects: over.affects ?? 'allies' },
  });
}

function makeUnit(world: World, id: number, team: Team, position: GridCoord): Unit {
  const stats = { ...ARCHETYPE_CONFIG.mercenary.baseStats };
  const unit = new Unit({
    id,
    team,
    archetype: 'mercenary',
    glyph: 'M',
    stats,
    derived: deriveStats(stats, 1),
    position,
  });
  world.units.push(unit);
  return unit;
}

function hasStatus(unit: Unit, key: string): boolean {
  return unit.effects.some((e) => e.key === key);
}

describe('§76a — the aura pass', () => {
  it("sustains the status on the carrier + allies in radius; out-of-radius and (under 'allies') enemies stay clean", () => {
    const world = freshWorld();
    const carrier = makeUnit(world, 1, 'player', { x: 5, y: 5 });
    const near = makeUnit(world, 2, 'player', { x: 7, y: 7 }); // Chebyshev 2 ≤ 3
    const far = makeUnit(world, 3, 'player', { x: 9, y: 9 }); // Chebyshev 4 > 3
    const enemy = makeUnit(world, 4, 'enemy', { x: 5, y: 6 }); // in radius, wrong team
    carrier.abilities.push(new EffectAbility(auraDef()));

    world.tick();

    expect(hasStatus(carrier, 'emboldened')).toBe(true); // the aura includes the caster
    expect(hasStatus(near, 'emboldened')).toBe(true);
    expect(hasStatus(far, 'emboldened')).toBe(false);
    expect(hasStatus(enemy, 'emboldened')).toBe(false);
    // The fold is live: the buff reads out of effectiveStats (config-derived).
    const add = EMBOLDENED.statMods!.strength!.add!;
    expect(near.effectiveStats.strength).toBe(near.stats.strength + add);
  });

  it('status:applied fires once on entry; the sustain tops up without re-emitting or stacking (the no-stack pin)', () => {
    const bus = new EventBus<GameEvents>();
    const world = freshWorld(bus);
    const applied: GameEvents['status:applied'][] = [];
    bus.on('status:applied', (p) => applied.push(p));

    const carrier = makeUnit(world, 1, 'player', { x: 5, y: 5 });
    const ally = makeUnit(world, 2, 'player', { x: 6, y: 5 });
    makeUnit(world, 3, 'enemy', { x: 15, y: 15 });
    carrier.abilities.push(new EffectAbility(auraDef()));

    world.tick();
    world.tick();
    world.tick();

    // One apply per recipient (carrier + ally), attributed to the carrier —
    // never re-emitted while sustained.
    expect(applied.filter((p) => p.statusId === 'emboldened')).toHaveLength(2);
    expect(applied.every((p) => p.sourceUnitId === carrier.id)).toBe(true);
    // Exactly one instance, magnitude 1, lifetime topped to the LAST tick + duration.
    const instances = ally.effects.filter((e) => e.key === 'emboldened');
    expect(instances).toHaveLength(1);
    expect(instances[0]!.magnitude).toBe(1);
    // Three tick() calls → the world clock sits at tick 3; the LAST sustain
    // topped the lifetime up to that tick + the status's own duration.
    expect(instances[0]!.lifetime).toEqual({
      kind: 'ticks',
      expiresAtTick: 3 + EMBOLDENED_TICKS,
    });
  });

  it('two overlapping same-status auras still keep a single instance (the top-up path is merge-policy-blind)', () => {
    const world = freshWorld();
    const a = makeUnit(world, 1, 'player', { x: 4, y: 5 });
    const b = makeUnit(world, 2, 'player', { x: 6, y: 5 });
    const between = makeUnit(world, 3, 'player', { x: 5, y: 5 });
    makeUnit(world, 4, 'enemy', { x: 15, y: 15 });
    a.abilities.push(new EffectAbility(auraDef()));
    b.abilities.push(new EffectAbility(auraDef()));

    world.tick();
    world.tick();

    expect(between.effects.filter((e) => e.key === 'emboldened')).toHaveLength(1);
    expect(between.effects[0]!.magnitude).toBe(1);
  });

  it('lingers its own durationSeconds after leaving the radius, then expires', () => {
    const world = freshWorld();
    const carrier = makeUnit(world, 1, 'player', { x: 5, y: 5 });
    const ally = makeUnit(world, 2, 'player', { x: 6, y: 5 });
    makeUnit(world, 3, 'enemy', { x: 15, y: 15 });
    carrier.abilities.push(new EffectAbility(auraDef()));

    world.tick();
    expect(hasStatus(ally, 'emboldened')).toBe(true);
    const expiresAt = ally.effects[0]!.lifetime;
    expect(expiresAt.kind).toBe('ticks');

    // Teleport out of radius: the sustain stops, the status lingers.
    ally.position = { x: 20, y: 20 };
    world.tick();
    expect(hasStatus(ally, 'emboldened')).toBe(true);

    // Run out the remaining duration — the status expires on its own clock.
    for (let i = 0; i < EMBOLDENED_TICKS + 2; i++) world.tick();
    expect(hasStatus(ally, 'emboldened')).toBe(false);
  });

  it("affects 'enemies' reaches the enemy team and skips allies; inert scenery is never a recipient", () => {
    const world = freshWorld();
    const carrier = makeUnit(world, 1, 'player', { x: 5, y: 5 });
    const ally = makeUnit(world, 2, 'player', { x: 6, y: 5 });
    const enemy = makeUnit(world, 3, 'enemy', { x: 5, y: 6 });
    const wall = spawnWall(world, { x: 4, y: 5 }); // team 'neutral' ≠ carrier's → matches 'enemies'…
    carrier.abilities.push(new EffectAbility(auraDef({ affects: 'enemies' })));

    world.tick();

    expect(hasStatus(enemy, 'emboldened')).toBe(true);
    expect(hasStatus(ally, 'emboldened')).toBe(false);
    expect(hasStatus(carrier, 'emboldened')).toBe(false);
    expect(wall.effects).toHaveLength(0); // …but the inert-neutral skip holds (the 27d rule)
  });

  it('a dead carrier radiates nothing', () => {
    const world = freshWorld();
    const carrier = makeUnit(world, 1, 'player', { x: 5, y: 5 });
    const ally = makeUnit(world, 2, 'player', { x: 6, y: 5 });
    makeUnit(world, 3, 'enemy', { x: 15, y: 15 });
    carrier.abilities.push(new EffectAbility(auraDef()));
    carrier.currentHp = 0;

    world.tick();

    expect(hasStatus(ally, 'emboldened')).toBe(false);
  });

  it('a pure aura never proposes an action (the propose-layer skip)', () => {
    const world = freshWorld();
    const carrier = makeUnit(world, 1, 'player', { x: 5, y: 5 });
    makeUnit(world, 2, 'enemy', { x: 6, y: 5 }); // a target in reach — still no proposal
    const ability = new EffectAbility(auraDef());

    expect(ability.propose(carrier, world)).toBeNull();
  });
});

describe('§76a — schema + boot guards', () => {
  it("rejects a pure aura on a non-'self' selector (the attackRange-inflation guard)", () => {
    expect(() =>
      AbilityDefSchema.parse({
        ...auraDef(),
        target: { kind: 'aoe', shape: 'square', radius: 3, anchor: 'caster', affects: 'allies' },
      }),
    ).toThrow(/pure aura/);
  });

  it('accepts an aura riding a real weapon def (ops present, any selector)', () => {
    // Config-derived: the shipped sword def + an aura — the weapon-that-radiates shape.
    const def = AbilityDefSchema.parse({
      ...ABILITY_DEFS.sword!,
      aura: { radius: 2, statusId: 'emboldened', affects: 'allies' },
    });
    expect(def.aura?.radius).toBe(2);
    expect(def.target.kind).toBe('enemyInRange');
  });

  it('assertStatusRefsResolve rejects a dangling aura.statusId at boot', () => {
    const bad = auraDef();
    const dangling = { ...bad, aura: { ...bad.aura!, statusId: 'no_such_status' } };
    expect(() => assertStatusRefsResolve({ [dangling.id]: dangling }, STATUS_DEFS)).toThrow(
      /unknown status id 'no_such_status'/,
    );
    // The happy path stays quiet (emboldened resolves).
    expect(() => assertStatusRefsResolve({ [bad.id]: bad }, STATUS_DEFS)).not.toThrow();
  });
});

describe('§76a — the mobility fold goes live (the K1 seam)', () => {
  // The first shipped-path consumer of a mobility statMod: the fold + the
  // refreshDerived recompute + the snapshot-restore idempotence claim
  // (World.ts fromJSON re-folds and re-derives) all get exercised here.
  const SWIFT = StatusDefSchema.parse({
    id: 'test_swift',
    name: 'Swift',
    durationSeconds: 60,
    merge: 'refresh',
    statMods: { mobility: { add: 2 } },
  });

  it('a mobility statMod folds into effectiveStats and re-derives moveCooldownTicks live', () => {
    const world = freshWorld();
    const unit = makeUnit(world, 1, 'player', { x: 5, y: 5 });
    const before = unit.derived.moveCooldownTicks;

    world.applyStatusEffect(unit, SWIFT, null);

    expect(unit.effectiveStats.mobility).toBe(unit.stats.mobility + 2);
    // Derive the expectation from the same pure function (never hardcode).
    const expected = deriveStats(unit.effectiveStats, unit.derived.attackRange).moveCooldownTicks;
    expect(unit.derived.moveCooldownTicks).toBe(expected);
    expect(unit.derived.moveCooldownTicks).toBeLessThan(before);
  });

  it('a mobility-status unit round-trips the World snapshot byte-stable (derived idempotence)', () => {
    const world = freshWorld();
    const unit = makeUnit(world, 1, 'player', { x: 5, y: 5 });
    world.applyStatusEffect(unit, SWIFT, null);

    const snap = world.toJSON();
    const restored = World.fromJSON(snap, new EventBus<GameEvents>());
    const back = restored.units[0]!;

    expect(back.effects).toHaveLength(1);
    expect(back.effectiveStats.mobility).toBe(unit.effectiveStats.mobility);
    expect(back.derived).toEqual(unit.derived);
    // Idempotence proper: a second round-trip changes nothing.
    expect(restored.toJSON()).toEqual(snap);
  });
});
