import { describe, it, expect } from 'vitest';
import { World } from '../World';
import { Unit, type Behavior } from '../Unit';
import type { Action, ActionPhase, ActionProposal } from '../Action';
import { EventBus } from '../../core/EventBus';
import { RNG } from '../../core/RNG';
import { deriveStats } from '../stats';
import { ARCHETYPE_CONFIG } from '../archetypes';
import type { GameEvents } from '../../core/events';

/**
 * F2 — the action phase-timeline machinery (the NEW behavior the
 * effectTicks → phases generalization adds): `World.tick` emits one
 * `action:phase` event at every phase that BEGINS on a tick, in declared
 * order, and fires `applyEffect` at the `impact` boundary. Zero-length
 * phases share a boundary tick (fire-and-advance). Per-action regression of
 * the damage/heal OUTCOMES lives in each action's own test + the byte-
 * identical fuzz baseline; this file pins the phase SCHEDULE + events.
 */

// A multi-tick action mirroring magic/catapult: no-op start, the effect
// lands in `applyEffect` at the impact boundary.
class ChargeProbe implements Action {
  readonly id = 'charge-probe';
  applyEffectCalls = 0;
  applyEffectOffsets: number[] = [];
  start(): void {}
  applyEffect(_u: Unit, _w: World, offset: number): void {
    this.applyEffectCalls++;
    this.applyEffectOffsets.push(offset);
  }
  toData(): Record<string, never> {
    return {};
  }
}

// A single-tick action mirroring strikes/heal: the effect is in `start`,
// and there is deliberately NO `applyEffect` — so an `impact` at offset 0
// must NOT try to fire one (the behavior-preserving invariant).
class StrikeProbe implements Action {
  readonly id = 'strike-probe';
  startCalls = 0;
  start(): void {
    this.startCalls++;
  }
  toData(): Record<string, never> {
    return {};
  }
}

class PhasedBehavior implements Behavior {
  readonly kind = 'phased-test';
  constructor(
    private readonly action: Action,
    private readonly phases: readonly ActionPhase[],
  ) {}
  proposeAction(): ActionProposal | null {
    // cooldown far past the observation window → the action fires exactly
    // once, so the assertions see a single clean lifecycle.
    return { action: this.action, score: 100, cooldown: 9999, phases: this.phases };
  }
}

interface LoggedPhase {
  tick: number;
  phase: string;
  actionId: string;
}

function scene(action: Action, phases: readonly ActionPhase[]): {
  world: World;
  phases: LoggedPhase[];
} {
  const bus = new EventBus<GameEvents>();
  const world = new World(bus, new RNG(1));
  const log: LoggedPhase[] = [];
  // world.currentTick is already incremented when the per-unit step emits,
  // so it's the tick the boundary fired on.
  bus.on('action:phase', (p) =>
    log.push({ tick: world.currentTick, phase: p.phase, actionId: p.actionId }),
  );

  const stats = { ...ARCHETYPE_CONFIG.mercenary.baseStats, constitution: 100, luck: 0 };
  const derived = { ...deriveStats(stats, 99), moveCooldownTicks: 1 };
  const actor = new Unit({
    id: 1,
    team: 'player',
    archetype: 'mercenary',
    glyph: 'M',
    stats,
    derived,
    position: { x: 0, y: 0 },
  });
  actor.behaviors.push(new PhasedBehavior(action, phases));
  world.units.push(actor);

  // Inert enemy so neither team is wiped — keeps the battle (and ticks)
  // running across the whole observation window.
  const enemy = new Unit({
    id: 2,
    team: 'enemy',
    archetype: 'mercenary',
    glyph: 'M',
    stats,
    derived: { ...deriveStats(stats, 1), moveCooldownTicks: 1 },
    position: { x: 11, y: 11 },
  });
  world.units.push(enemy);

  return { world, phases: log };
}

describe('F2 action phase timeline', () => {
  it('charge: emits windup on the start tick, fires applyEffect once at the impact boundary', () => {
    const action = new ChargeProbe();
    const { world, phases } = scene(action, [
      { phase: 'windup', ticks: 3 },
      { phase: 'impact', ticks: 0 },
    ]);

    world.tick(); // tick 1 — action starts: windup begins (offset 0)
    expect(phases).toEqual([{ tick: 1, phase: 'windup', actionId: 'charge-probe' }]);
    expect(action.applyEffectCalls).toBe(0);

    world.tick(); // tick 2, offset 1 — still charging
    world.tick(); // tick 3, offset 2 — still charging
    expect(action.applyEffectCalls).toBe(0);

    world.tick(); // tick 4, offset 3 — impact: applyEffect fires once
    expect(action.applyEffectCalls).toBe(1);
    expect(action.applyEffectOffsets).toEqual([3]);
    expect(phases).toEqual([
      { tick: 1, phase: 'windup', actionId: 'charge-probe' },
      { tick: 4, phase: 'impact', actionId: 'charge-probe' },
    ]);

    world.tick(); // tick 5 — done; cooldown blocks re-propose
    world.tick();
    expect(action.applyEffectCalls).toBe(1);
    expect(phases).toHaveLength(2);
  });

  it('zero-length phases (release/travel/impact) all fire on one tick, in declared order', () => {
    const action = new ChargeProbe();
    const { world, phases } = scene(action, [
      { phase: 'windup', ticks: 3 },
      { phase: 'release', ticks: 0 },
      { phase: 'travel', ticks: 0 },
      { phase: 'impact', ticks: 0 },
    ]);

    for (let i = 0; i < 4; i++) world.tick(); // ticks 1..4

    expect(phases).toEqual([
      { tick: 1, phase: 'windup', actionId: 'charge-probe' },
      { tick: 4, phase: 'release', actionId: 'charge-probe' },
      { tick: 4, phase: 'travel', actionId: 'charge-probe' },
      { tick: 4, phase: 'impact', actionId: 'charge-probe' },
    ]);
    // The collapsed release/travel/impact boundary fires applyEffect exactly
    // once (only `impact` is an effect boundary).
    expect(action.applyEffectCalls).toBe(1);
    expect(action.applyEffectOffsets).toEqual([3]);
  });

  it('strike pattern: impact+recovery emit at offset 0; an action with no applyEffect fires none', () => {
    const action = new StrikeProbe();
    const { world, phases } = scene(action, [
      { phase: 'impact', ticks: 0 },
      { phase: 'recovery', ticks: 3 },
    ]);

    world.tick(); // tick 1 — effect runs in start(); impact+recovery begin at offset 0
    expect(action.startCalls).toBe(1);
    expect(phases).toEqual([
      { tick: 1, phase: 'impact', actionId: 'strike-probe' },
      { tick: 1, phase: 'recovery', actionId: 'strike-probe' },
    ]);

    // Busy for the recovery window; no further boundaries, no re-run.
    world.tick();
    world.tick();
    world.tick();
    expect(phases).toHaveLength(2);
    expect(action.startCalls).toBe(1);
  });

  it('locks the unit for the full Σ-ticks window (finishTick derives from the phase list)', () => {
    const action = new ChargeProbe();
    const { world } = scene(action, [
      { phase: 'windup', ticks: 5 },
      { phase: 'impact', ticks: 0 },
      { phase: 'recovery', ticks: 4 },
    ]);
    world.tick(); // tick 1: starts
    const actor = world.units.find((u) => u.id === 1)!;
    expect(actor.activeAction).not.toBeNull();
    // Σ ticks = 9 → finishTick = startTick(1) + 9 = 10.
    expect(actor.activeAction!.finishTick - actor.activeAction!.startTick).toBe(9);
    // impact at offset 5 (windup length), regardless of the trailing recovery.
    for (let i = 0; i < 5; i++) world.tick(); // ticks 2..6 (offset 5 = tick 6)
    expect(action.applyEffectOffsets).toEqual([5]);
  });
});

// Y5c — the per-verb `orphanPolicy` + `phaseTarget` declarations moved off the
// deleted legacy action classes: orphanPolicy now lives on each AbilityDef
// (config) and is surfaced by EffectAction; phaseTarget per verb-shape is pinned
// in effects/EffectAction.test.ts ("EffectAction.phaseTarget — per-verb renderer
// info"). The class-agnostic phase-SCHEDULE machinery above is what this file owns.
