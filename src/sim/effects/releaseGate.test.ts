import { describe, it, expect } from 'vitest';
import { World } from '../World';
import { EventBus } from '../../core/EventBus';
import { RNG } from '../../core/RNG';
import type { GameEvents } from '../../core/events';
import type { Behavior, Team, UnitStats } from '../Unit';
import type { ActionProposal } from '../Action';
import type { GridCoord } from '../../core/types';
import { secondsToTicks } from '../../config';
import { abilityDef } from '../../config/abilities';
import { speedScaledSeconds } from '../stats';
import { parseAbilityDef, type AbilityDef } from './schema';
import { resolveCadenceTicks, resolvePhases } from './timeline';
import { EffectAction } from './EffectAction';

/**
 * 82e — the release gate (the catapult's hold-fire). The moveAbortInflight
 * drive pattern: a stub behavior proposes the lob once, ticks advance the
 * wind-up, and the test mutates the target's position mid-flight. At the
 * `release` boundary the gate re-runs the propose-time band predicate
 * (`firingBandCell` — the one-predicate rule): out-of-band / inside-min /
 * dead → the action clears with NOTHING fired (no phase event past windup,
 * no damage, no RNG draw), the cooldown becomes the re-aim window, and
 * `unit:actionHeld` announces it. In-band targets fire exactly as before.
 */

const BASE: UnitStats = {
  constitution: 100, strength: 0, ranged: 0, magic: 0, luck: 0, defense: 0,
  precision: 0, evasion: 0, speed: 0, mobility: 0, power: 1,
};

const DMG = {
  kind: 'damage', scaling: 'ranged', might: 0, accuracy: 1,
  critBase: 0, critable: false, evadable: false, bypassDefense: false,
} as const;

/** A test lob: fixed 1 s wind-up (tick-exact boundaries at speed 0), the
 *  catapult's [4,6] band, LOS-free, gated with a flat 1 s re-aim. */
const lobDef: AbilityDef = parseAbilityDef({
  id: 'test_lob', name: 'Test Lob', cooldownSeconds: 3, rangeCells: 6, minRangeCells: 4,
  ignoresLineOfSight: true, target: { kind: 'enemyInRange' },
  timeline: [
    { phase: 'windup', seconds: 1 },
    { phase: 'release', seconds: 0 },
    { phase: 'travel', seconds: 0.6 },
    { phase: 'impact', seconds: 0 },
    { phase: 'recovery', seconds: 'fill' },
  ],
  releaseGate: { reaimSeconds: 1 },
  orphanPolicy: 'fizzle', priority: 10,
  effects: [{ phase: 'impact', op: { ...DMG, might: 10 } }],
});

const WINDUP_TICKS = secondsToTicks(1); // release boundary offset at speed 0
const REAIM_TICKS = Math.max(1, secondsToTicks(1));

/** Proposes the lob at `target` exactly once, then abstains. */
class StubLobBehavior implements Behavior {
  readonly kind = 'test:stub-lob';
  private fired = false;
  constructor(
    private readonly def: AbilityDef,
    private readonly targetId: number,
    private readonly targetCell: GridCoord,
  ) {}
  proposeAction(): ActionProposal | null {
    if (this.fired) return null;
    this.fired = true;
    return {
      action: new EffectAction(this.def, {
        targetId: this.targetId,
        targetCell: { ...this.targetCell },
        ops: [{ baseDamage: 10, critChance: 0 }],
      }),
      score: this.def.priority,
      cooldown: resolveCadenceTicks(this.def, 0),
      phases: resolvePhases(this.def, 0),
      cooldownKey: this.def.id,
    };
  }
}

function spawnAt(world: World, team: Team, pos: GridCoord, stats: UnitStats = BASE) {
  return world.spawnUnit({ archetype: 'mercenary', level: 1, stats, xp: 0 }, team, pos);
}

/** Strip default behaviors; optionally install exactly one. */
function onlyBehavior(unit: { behaviors: Behavior[] }, b?: Behavior) {
  unit.behaviors.length = 0;
  if (b) unit.behaviors.push(b);
}

/** A caster at (0,4) lobbing at an in-band enemy at (5,4) (distance 5 ∈ [4,6]),
 *  wired to capture held/impact evidence. */
function setup() {
  const bus = new EventBus<GameEvents>();
  const world = new World(bus, new RNG(1));
  const caster = spawnAt(world, 'player', { x: 0, y: 4 });
  const target = spawnAt(world, 'enemy', { x: 5, y: 4 });
  onlyBehavior(caster, new StubLobBehavior(lobDef, target.id, target.position));
  onlyBehavior(target); // inert — tests reposition it by hand
  const held: GameEvents['unit:actionHeld'][] = [];
  bus.on('unit:actionHeld', (e) => held.push(e));
  return { world, bus, caster, target, held };
}

describe('82e — the release gate holds fire on a band-escaped target', () => {
  it('dash-out: target leaves max range mid-windup → held at release, nothing fired', () => {
    const { world, caster, target, held } = setup();
    world.tick(); // propose + start — wind-up begins
    expect(caster.activeAction).not.toBeNull();

    target.position = { x: 9, y: 4 }; // distance 9 > 6 — gone
    for (let t = 1; t <= WINDUP_TICKS; t++) world.tick(); // through the release boundary

    expect(caster.activeAction).toBeNull(); // held — the action cleared
    expect(held).toEqual([{ unitId: caster.id, actionId: 'test_lob', reaimTicks: REAIM_TICKS }]);
    expect(caster.actionCooldowns.get('test_lob')).toBeLessThanOrEqual(REAIM_TICKS);
    expect(target.currentHp).toBe(target.derived.maxHp); // no damage ever landed
  });

  it('dive-in: target closes inside minRange mid-windup → held (the short-shot end)', () => {
    const { world, caster, target, held } = setup();
    world.tick();
    target.position = { x: 2, y: 4 }; // distance 2 < minRange 4
    for (let t = 1; t <= WINDUP_TICKS; t++) world.tick();
    expect(caster.activeAction).toBeNull();
    expect(held).toHaveLength(1);
    expect(target.currentHp).toBe(target.derived.maxHp);
  });

  it('a target dead at release holds (re-aim) instead of lobbing a dud downrange', () => {
    const { world, caster, target, held } = setup();
    // A far, living second enemy keeps the battle ongoing once the target
    // dies (the moveAbortInflight trick — an all-dead side ends the tick loop).
    onlyBehavior(spawnAt(world, 'enemy', { x: 9, y: 0 }));
    world.tick();
    target.currentHp = 0;
    for (let t = 1; t <= WINDUP_TICKS; t++) world.tick();
    expect(caster.activeAction).toBeNull();
    expect(held).toHaveLength(1);
  });

  it('a target still in band fires exactly as before (no spurious hold, damage lands)', () => {
    const { world, target, held } = setup();
    world.tick();
    target.position = { x: 6, y: 4 }; // distance 6 — still in band, edge-inclusive
    const totalTicks = WINDUP_TICKS + secondsToTicks(0.6); // …through travel + impact
    for (let t = 1; t <= totalTicks; t++) world.tick();
    expect(held).toEqual([]);
    expect(target.currentHp).toBe(target.derived.maxHp - 10);
  });

  it('the hold survives a mid-windup save/load (the gate re-derives from the def)', () => {
    // The wire rebuilds an EffectAction by defId through the SHIPPED catalog
    // (`createAction` → `abilityDef`), so this test rides the real
    // `catapult_shot` — which also pins that the live def authors the gate.
    const catapult = abilityDef('catapult_shot');
    expect(catapult.releaseGate).toBeDefined();
    // Release boundary offset at speed 0, config-derived from the timeline.
    const phases = resolvePhases(catapult, 0);
    let releaseOffset = 0;
    for (const p of phases) {
      if (p.phase === 'release') break;
      releaseOffset += p.ticks;
    }
    expect(releaseOffset).toBeGreaterThan(1); // a real wind-up to save inside

    const bus = new EventBus<GameEvents>();
    const world = new World(bus, new RNG(1));
    const caster = spawnAt(world, 'player', { x: 0, y: 4 });
    const target = spawnAt(world, 'enemy', { x: 5, y: 4 });
    onlyBehavior(caster, new StubLobBehavior(catapult, target.id, target.position));
    onlyBehavior(target);
    world.tick();
    for (let t = 1; t <= Math.floor(releaseOffset / 2); t++) world.tick(); // mid-windup
    expect(caster.activeAction).not.toBeNull();
    // Behaviors serialize BY REGISTRY KIND and the test stub has no factory —
    // strip it before the snapshot (it already fired; the in-flight action is
    // the thing under test and rides the wire independently).
    onlyBehavior(caster);

    const bus2 = new EventBus<GameEvents>();
    const clone = World.fromJSON(world.toJSON(), bus2);
    const casterClone = clone.findUnit(caster.id)!;
    const targetClone = clone.findUnit(target.id)!;
    expect(casterClone.activeAction).not.toBeNull(); // the lob survived the wire

    targetClone.position = { x: 9, y: 4 }; // out of band, post-rehydrate
    const held2: GameEvents['unit:actionHeld'][] = [];
    bus2.on('unit:actionHeld', (e) => held2.push(e));
    for (let t = 0; t <= releaseOffset; t++) clone.tick();

    expect(casterClone.activeAction).toBeNull();
    expect(held2).toHaveLength(1);
    expect(held2[0]!.actionId).toBe('catapult_shot');
    expect(targetClone.currentHp).toBe(targetClone.derived.maxHp);
  });
});

describe('82e — the re-aim window scales with speed when authored', () => {
  const scaledDef: AbilityDef = parseAbilityDef({
    id: 'test_lob_scaled', name: 'Scaled Lob', cooldownSeconds: 3, rangeCells: 6,
    minRangeCells: 4, ignoresLineOfSight: true, target: { kind: 'enemyInRange' },
    timeline: [
      { phase: 'windup', seconds: 1 },
      { phase: 'release', seconds: 0 },
      { phase: 'impact', seconds: 0 },
      { phase: 'recovery', seconds: 'fill' },
    ],
    releaseGate: { reaimSeconds: 1, scalesWithSpeed: true },
    orphanPolicy: 'fizzle', priority: 10,
    effects: [{ phase: 'impact', op: DMG }],
  });

  it('holdCheck returns cadence-curve ticks (config-derived, floored at 1)', () => {
    const bus = new EventBus<GameEvents>();
    const world = new World(bus, new RNG(1));
    const slow = spawnAt(world, 'player', { x: 0, y: 0 });
    const fast = spawnAt(world, 'player', { x: 0, y: 1 }, { ...BASE, speed: 100 });
    // targetId -1 → no target → always a hold; the return value is the probe.
    const action = new EffectAction(scaledDef, { targetId: -1, ops: [{}] });

    const expectFor = (speed: number) =>
      Math.max(1, secondsToTicks(speedScaledSeconds(1, speed)));
    expect(action.holdCheck('release', slow, world)).toBe(expectFor(slow.effectiveStats.speed));
    expect(action.holdCheck('release', fast, world)).toBe(expectFor(fast.effectiveStats.speed));
    // The curve must actually bite: the fast crew re-aims in fewer ticks.
    expect(action.holdCheck('release', fast, world)!).toBeLessThan(
      action.holdCheck('release', slow, world)!,
    );
    // Non-release phases never probe.
    expect(action.holdCheck('windup', slow, world)).toBeNull();
  });
});
