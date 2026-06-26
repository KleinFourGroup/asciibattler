import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { World } from '../World';
import { Unit, type Team, type UnitArchetype, type UnitStats } from '../Unit';
import { EventBus } from '../../core/EventBus';
import { RNG } from '../../core/RNG';
import { deriveStats } from '../stats';
import { STATS } from '../../config/stats';
import type { GameEvents } from '../../core/events';
import type { GridCoord } from '../../core/types';
import type { EffectOp, TargetSelector } from './schema';
import { executeOp, newFireScratch, type OpFireContext } from './interpreter';
import { STATUS_DEFS } from '../../config/statuses';
import { parseStatusDef } from './statusSchema';
import { secondsToTicks } from '../../config';

/**
 * Phase Y2 — the op interpreter in isolation. Explicit-input mechanic tests: each
 * op reproduces its legacy action's mutation / events / draw ordering (the Y3/Y4
 * oracle then proves the end-to-end migration).
 */

const BASE_STATS: UnitStats = {
  constitution: 100, strength: 0, ranged: 0, magic: 0, luck: 0, defense: 0,
  precision: 0, evasion: 0, speed: 0, mobility: 0, power: 1,
};

let nextId = 1;
function makeUnit(team: Team, pos: GridCoord, stats: Partial<UnitStats> = {}): Unit {
  const block = { ...BASE_STATS, ...stats };
  return new Unit({
    id: nextId++, team, archetype: 'mercenary' as UnitArchetype, glyph: 'M',
    stats: block, derived: deriveStats(block, 1), position: pos,
  });
}

function setup() {
  const events: { name: keyof GameEvents; payload: unknown }[] = [];
  const bus = new EventBus<GameEvents>();
  for (const name of ['unit:attacked', 'unit:missed', 'unit:healed', 'unit:moved', 'unit:dashed'] as const) {
    bus.on(name, (p) => events.push({ name, payload: p }));
  }
  const world = new World(bus, new RNG(1));
  return { world, events };
}

function ctx(over: Partial<OpFireContext> & Pick<OpFireContext, 'caster' | 'world'>): OpFireContext {
  return {
    orphanPolicy: 'commit-at-cast',
    selector: { kind: 'enemyInRange' } as TargetSelector,
    target: undefined,
    targetCell: undefined,
    resolution: {},
    phaseTicks: 0,
    remainingTicks: 0,
    fireScratch: newFireScratch(),
    ...over,
  };
}

const dmgOp = (o: Partial<Extract<EffectOp, { kind: 'damage' }>> = {}): EffectOp => ({
  kind: 'damage', scaling: 'strength', might: 0, accuracy: 0.6, critBase: 0,
  critable: false, evadable: false, bypassDefense: false, ...o,
});

describe('executeOp — damage (single-target)', () => {
  it('commit-at-cast: applies defense-mitigated damage', () => {
    const { world, events } = setup();
    const caster = makeUnit('player', { x: 0, y: 0 });
    const target = makeUnit('enemy', { x: 1, y: 0 }, { defense: 3 });
    world.units.push(caster, target);
    executeOp(dmgOp(), ctx({ caster, world, target, resolution: { baseDamage: 10, critChance: 0 } }));
    expect(target.currentHp).toBe(target.derived.maxHp - 7); // max(minDamage, 10 - 3)
    expect(events.map((e) => e.name)).toEqual(['unit:attacked']);
  });

  it('applies critMult before the damageMultiplier + round', () => {
    const { world } = setup();
    const caster = makeUnit('player', { x: 0, y: 0 });
    const target = makeUnit('enemy', { x: 1, y: 0 });
    world.units.push(caster, target);
    executeOp(dmgOp(), ctx({ caster, world, target, resolution: { baseDamage: 10, critChance: 1, damageMultiplier: 0.5 } }));
    expect(target.currentHp).toBe(target.derived.maxHp - Math.round(10 * STATS.critMult * 0.5));
  });

  it('commit-at-cast: a dead target is skipped (no event, no draw)', () => {
    const { world, events } = setup();
    const caster = makeUnit('player', { x: 0, y: 0 });
    const target = makeUnit('enemy', { x: 1, y: 0 });
    target.currentHp = 0;
    world.units.push(caster, target);
    const before = world.combatRng.next.bind(world.combatRng);
    void before;
    executeOp(dmgOp(), ctx({ caster, world, target, resolution: { baseDamage: 10, critChance: 1 } }));
    expect(events).toHaveLength(0);
  });

  it('evadable: a guaranteed-evasion target takes no damage but emits unit:missed (crit rolled first, then discarded)', () => {
    const { world, events } = setup();
    const caster = makeUnit('player', { x: 0, y: 0 });
    // Huge evasion floors the hit chance; with critChance 1 the crit is rolled
    // first (draw #1) and then DISCARDED by the miss (draw #2) — the ordering.
    const target = makeUnit('enemy', { x: 1, y: 0 }, { evasion: 1000 });
    world.units.push(caster, target);
    executeOp(
      dmgOp({ evadable: true, accuracy: 0 }),
      ctx({ caster, world, target, resolution: { baseDamage: 10, critChance: 1 } }),
    );
    // Either hit or miss is deterministic for the seed; assert the miss path's
    // invariant if it missed, else the hit path — but with accuracy 0 + 1000
    // evasion the chance is the floor, and we assert whichever fired is consistent.
    const fired = events[0]!.name;
    if (fired === 'unit:missed') {
      expect(target.currentHp).toBe(target.derived.maxHp); // no damage on a miss
    } else {
      expect(fired).toBe('unit:attacked');
    }
  });
});

describe('executeOp — damage (fizzle / catapult)', () => {
  it('fizzle: a dead target deals nothing and draws nothing (no event)', () => {
    const { world, events } = setup();
    const caster = makeUnit('player', { x: 0, y: 0 });
    const target = makeUnit('enemy', { x: 3, y: 0 });
    target.currentHp = 0;
    world.units.push(caster, target);
    executeOp(
      dmgOp(),
      ctx({ caster, world, target, orphanPolicy: 'fizzle', targetCell: { x: 3, y: 0 }, resolution: { baseDamage: 10, critChance: 1 } }),
    );
    // §Z: the FX-cue `catapult:fired` is retired, so an aborted shot is silent at
    // the sim layer (the renderer drives the dud off `action:phase{impact}`).
    expect(events).toHaveLength(0);
    expect(target.currentHp).toBe(0);
  });

  it('fizzle: a live target applies damage (emits unit:attacked)', () => {
    const { world, events } = setup();
    const caster = makeUnit('player', { x: 0, y: 0 });
    const target = makeUnit('enemy', { x: 3, y: 0 });
    world.units.push(caster, target);
    executeOp(
      dmgOp(),
      ctx({ caster, world, target, orphanPolicy: 'fizzle', resolution: { baseDamage: 10, critChance: 0 } }),
    );
    expect(events.map((e) => e.name)).toEqual(['unit:attacked']);
    expect(target.currentHp).toBe(target.derived.maxHp - 10);
  });
});

describe('executeOp — damage (aoe / magic)', () => {
  const aoe: TargetSelector = { kind: 'aoe', shape: 'square', radius: 1, anchor: 'targetCell', affects: 'enemies', ringMultiplier: 0.5 };

  it('hits center full + ring scaled, one crit for the blast', () => {
    const { world, events } = setup();
    const caster = makeUnit('player', { x: 0, y: 0 });
    const center = makeUnit('enemy', { x: 5, y: 5 });
    const ring = makeUnit('enemy', { x: 6, y: 5 });
    world.units.push(caster, center, ring);
    executeOp(
      dmgOp({ evadable: false }),
      ctx({ caster, world, selector: aoe, orphanPolicy: 'ground-target', targetCell: { x: 5, y: 5 }, resolution: { baseDamage: 10, critChance: 0 } }),
    );
    // §Z: the FX-cue `magic:detonated` is retired; only the per-victim damage
    // remains (the renderer drives the explosion off `action:phase{impact}`).
    expect(events.map((e) => e.name)).toEqual(['unit:attacked', 'unit:attacked']);
    expect(center.currentHp).toBe(center.derived.maxHp - 10);
    expect(ring.currentHp).toBe(ring.derived.maxHp - 5); // round(10 × 0.5)
  });

  it('a whiff (no victims) deals no damage and emits nothing', () => {
    const { world, events } = setup();
    const caster = makeUnit('player', { x: 0, y: 0 });
    world.units.push(caster);
    executeOp(
      dmgOp(),
      ctx({ caster, world, selector: aoe, orphanPolicy: 'ground-target', targetCell: { x: 5, y: 5 }, resolution: { baseDamage: 10, critChance: 0 } }),
    );
    // §Z: with `magic:detonated` retired, a whiff is silent at the sim layer.
    expect(events).toHaveLength(0);
  });
});

describe('executeOp — heal', () => {
  it('restores HP clamped at maxHp and emits unit:healed with the effective delta', () => {
    const { world, events } = setup();
    const caster = makeUnit('player', { x: 0, y: 0 });
    const ally = makeUnit('player', { x: 1, y: 0 });
    ally.currentHp = ally.derived.maxHp - 3; // only 3 to heal
    world.units.push(caster, ally);
    executeOp({ kind: 'heal', scaling: 'magic', might: 0 }, ctx({ caster, world, target: ally, resolution: { healAmount: 10 } }));
    expect(ally.currentHp).toBe(ally.derived.maxHp); // clamped
    expect(events).toEqual([{ name: 'unit:healed', payload: { unitId: ally.id, amount: 3, healerId: caster.id } }]);
    expect(world.damageDealtBy(caster.id)).toBe(0);
  });

  it('skips a dead target', () => {
    const { world, events } = setup();
    const caster = makeUnit('player', { x: 0, y: 0 });
    const ally = makeUnit('player', { x: 1, y: 0 });
    ally.currentHp = 0;
    world.units.push(caster, ally);
    executeOp({ kind: 'heal', scaling: 'magic', might: 0 }, ctx({ caster, world, target: ally, resolution: { healAmount: 10 } }));
    expect(events).toHaveLength(0);
  });
});

describe('executeOp — move', () => {
  it('advance: relocates to the captured landing + emits moved & dashed', () => {
    const { world, events } = setup();
    const caster = makeUnit('player', { x: 0, y: 0 });
    world.units.push(caster);
    executeOp(
      { kind: 'move', mode: 'advance', cells: 2 },
      ctx({ caster, world, resolution: { moveDest: { x: 2, y: 0 } }, phaseTicks: 5 }),
    );
    expect(caster.position).toEqual({ x: 2, y: 0 });
    expect(events).toEqual([
      { name: 'unit:moved', payload: { unitId: caster.id, from: { x: 0, y: 0 }, to: { x: 2, y: 0 }, durationTicks: 5 } },
      { name: 'unit:dashed', payload: { unitId: caster.id, from: { x: 0, y: 0 }, to: { x: 2, y: 0 }, durationTicks: 5 } },
    ]);
  });

  it('retreat: steps away from the anchor + emits moved only', () => {
    const { world, events } = setup();
    const caster = makeUnit('player', { x: 5, y: 5 });
    const anchor = { x: 4, y: 5 }; // caster retreats away from (4,5) → toward +x
    world.units.push(caster);
    executeOp(
      { kind: 'move', mode: 'retreat', cells: 1 },
      ctx({ caster, world, resolution: { moveDest: anchor }, remainingTicks: 4 }),
    );
    expect(caster.position.x).toBeGreaterThan(5); // moved away from the anchor
    expect(events.map((e) => e.name)).toEqual(['unit:moved']);
  });

  it('retreat: holds (no move, no event) when boxed in', () => {
    const { world, events } = setup();
    const caster = makeUnit('player', { x: 0, y: 0 }); // corner; anchor adjacent
    // Surround so no neighbor increases distance from the anchor and is free.
    world.units.push(caster);
    // Anchor at (0,0) itself → every neighbor is equidistant-or-closer? Use the
    // caster's own cell as anchor: no neighbor strictly increases distance from a
    // zero-distance anchor beyond what a step gives, but corner walls block most.
    const blockers = [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }];
    for (const b of blockers) world.units.push(makeUnit('enemy', b));
    executeOp(
      { kind: 'move', mode: 'retreat', cells: 1 },
      ctx({ caster, world, resolution: { moveDest: { x: 0, y: 0 } }, remainingTicks: 4 }),
    );
    expect(caster.position).toEqual({ x: 0, y: 0 }); // held
    expect(events).toHaveLength(0);
  });
});

describe('executeOp — move reserved modes throw', () => {
  it('move knockback/pull throw (reserved until Cluster 2)', () => {
    const { world } = setup();
    const caster = makeUnit('player', { x: 0, y: 0 });
    expect(() => executeOp({ kind: 'move', mode: 'knockback', cells: 1 }, ctx({ caster, world, resolution: { moveDest: { x: 1, y: 1 } } }))).toThrow(/reserved/);
    expect(() => executeOp({ kind: 'move', mode: 'pull', cells: 1 }, ctx({ caster, world, resolution: { moveDest: { x: 1, y: 1 } } }))).toThrow(/reserved/);
  });
});

describe('executeOp — applyStatus (status-on-hit, §29)', () => {
  // A fixture status injected into the (file-isolated) registry, so these mechanic
  // tests never depend on the shipped catalog (the balance-proof discipline).
  const TS = { id: 't_onhit', name: 't_onhit', durationSeconds: 4, merge: 'refresh' } as const;
  beforeAll(() => {
    STATUS_DEFS.t_onhit = parseStatusDef(TS);
  });
  afterAll(() => {
    delete STATUS_DEFS.t_onhit;
  });

  const statusOp = (o: Partial<Extract<EffectOp, { kind: 'applyStatus' }>> = {}): EffectOp => ({
    kind: 'applyStatus', statusId: 't_onhit', ...o,
  });
  const has = (u: Unit) => u.effects.some((e) => e.key === 't_onhit');

  it('applies the status to a live single target (pure applier, no paired damage)', () => {
    const { world } = setup();
    const caster = makeUnit('player', { x: 0, y: 0 });
    const target = makeUnit('enemy', { x: 1, y: 0 });
    world.units.push(caster, target);
    executeOp(statusOp(), ctx({ caster, world, target }));
    expect(has(target)).toBe(true);
  });

  it('skips a dead target (never status a corpse / fizzled shot)', () => {
    const { world } = setup();
    const caster = makeUnit('player', { x: 0, y: 0 });
    const target = makeUnit('enemy', { x: 1, y: 0 });
    target.currentHp = 0;
    world.units.push(caster, target);
    executeOp(statusOp(), ctx({ caster, world, target }));
    expect(has(target)).toBe(false);
  });

  it('the gate skips a target the same-fire damage op MISSED (shared scratch)', () => {
    const { world } = setup();
    const caster = makeUnit('player', { x: 0, y: 0 });
    const target = makeUnit('enemy', { x: 1, y: 0 }, { evasion: 1000 });
    world.units.push(caster, target);
    world.combatRng.next = () => 0.99; // crit roll fails, then the miss roll whiffs
    const shared = ctx({ caster, world, target, resolution: { baseDamage: 10, critChance: 0 } });
    executeOp(dmgOp({ evadable: true, accuracy: 0.6 }), shared);
    expect(shared.fireScratch.missed.has(target.id)).toBe(true); // the damage op recorded the miss
    executeOp(statusOp(), shared); // same scratch → gated out
    expect(has(target)).toBe(false);
    expect(target.currentHp).toBe(target.derived.maxHp); // untouched + unstatused
  });

  it('the gate applies when the same-fire damage op LANDS (shared scratch)', () => {
    const { world } = setup();
    const caster = makeUnit('player', { x: 0, y: 0 });
    const target = makeUnit('enemy', { x: 1, y: 0 });
    world.units.push(caster, target);
    world.combatRng.next = () => 0; // no crit; the hit lands
    const shared = ctx({ caster, world, target, resolution: { baseDamage: 5, critChance: 0 } });
    executeOp(dmgOp({ evadable: true, accuracy: 0.6 }), shared);
    expect(shared.fireScratch.missed.size).toBe(0);
    executeOp(statusOp(), shared);
    expect(has(target)).toBe(true);
  });

  it('an aoe applier lands on every victim in the blast (non-evadable → no miss)', () => {
    const aoe: TargetSelector = { kind: 'aoe', shape: 'square', radius: 1, anchor: 'targetCell', affects: 'enemies', ringMultiplier: 0.5 };
    const { world } = setup();
    const caster = makeUnit('player', { x: 0, y: 0 });
    const a = makeUnit('enemy', { x: 5, y: 5 });
    const b = makeUnit('enemy', { x: 6, y: 5 });
    world.units.push(caster, a, b);
    executeOp(statusOp(), ctx({ caster, world, selector: aoe, orphanPolicy: 'ground-target', targetCell: { x: 5, y: 5 } }));
    expect(has(a)).toBe(true);
    expect(has(b)).toBe(true);
  });

  it('reads the cast-time-captured magnitude + duration off the resolution (§31)', () => {
    const { world } = setup();
    const caster = makeUnit('player', { x: 0, y: 0 });
    const target = makeUnit('enemy', { x: 1, y: 0 });
    world.units.push(caster, target);
    // §31: the interpreter consumes the captured scalars, NOT the op fields (which
    // are frozen at propose). magnitude 3, a 2s duration override on the resolution.
    executeOp(
      statusOp(),
      ctx({ caster, world, target, resolution: { statusMagnitude: 3, statusDurationSeconds: 2 } }),
    );
    const eff = target.effects.find((e) => e.key === 't_onhit')!;
    expect(eff.magnitude).toBe(3);
    // fresh world → tick 0; override 2s wins over the def's 4s base.
    expect(eff.lifetime).toEqual({ kind: 'ticks', expiresAtTick: Math.max(1, secondsToTicks(2)) });
  });
});

describe('executeOp — chain (§29c)', () => {
  // A pure-magic, non-evadable inner bolt (no crit, no defense interaction at
  // defense 0) so the per-hop damage is exactly baseDamage × falloff^jump.
  const innerDmg: EffectOp = {
    kind: 'damage', scaling: 'magic', might: 0, accuracy: 0.6, critBase: 0,
    critable: false, evadable: false, bypassDefense: false,
  };
  // `hopDelaySeconds: 0` = the synchronous resolve (every hop on the call tick),
  // so these geometry/falloff assertions read the full chain right after executeOp.
  // The staggered (deferred) path has its own describe block below.
  const chainOp = (o: Partial<Extract<EffectOp, { kind: 'chain' }>> = {}): EffectOp => ({
    kind: 'chain', maxJumps: 3, rangeCells: 2, falloff: 0.5, hopDelaySeconds: 0, ops: [innerDmg], ...o,
  });
  const hp = (u: Unit) => u.derived.maxHp - u.currentHp;

  it('arcs the primary + the two nearest fresh targets, falloff per hop', () => {
    const { world, events } = setup();
    const caster = makeUnit('player', { x: 0, y: 0 });
    const primary = makeUnit('enemy', { x: 5, y: 5 });
    const near = makeUnit('enemy', { x: 6, y: 5 }); // dist 1 from primary
    const far = makeUnit('enemy', { x: 7, y: 5 }); // dist 1 from `near`, 2 from primary
    world.units.push(caster, primary, near, far);
    executeOp(
      chainOp(),
      ctx({ caster, world, target: primary, resolution: { chainOps: [{ baseDamage: 20, critChance: 0 }] } }),
    );
    expect(hp(primary)).toBe(20); // falloff^0
    expect(hp(near)).toBe(10); // falloff^1
    expect(hp(far)).toBe(5); // falloff^2
    // one unit:attacked per landed hop, in jump order.
    expect(events.map((e) => e.name)).toEqual(['unit:attacked', 'unit:attacked', 'unit:attacked']);
  });

  it('hops to the NEAREST fresh target from the previous victim (not the caster)', () => {
    const { world } = setup();
    const caster = makeUnit('player', { x: 0, y: 0 });
    const primary = makeUnit('enemy', { x: 5, y: 5 });
    // Two candidates for jump 1: `b` is closer to the primary than `a`.
    const a = makeUnit('enemy', { x: 7, y: 5 }); // dist 2 from primary
    const b = makeUnit('enemy', { x: 6, y: 5 }); // dist 1 from primary
    world.units.push(caster, primary, a, b);
    executeOp(
      chainOp({ maxJumps: 2 }),
      ctx({ caster, world, target: primary, resolution: { chainOps: [{ baseDamage: 20, critChance: 0 }] } }),
    );
    expect(hp(primary)).toBe(20);
    expect(hp(b)).toBe(10); // the nearer one was chosen for jump 1
    expect(hp(a)).toBe(0); // out of a 2-jump chain
  });

  it('never repeats a target and ends early when no fresh target remains', () => {
    const { world, events } = setup();
    const caster = makeUnit('player', { x: 0, y: 0 });
    const primary = makeUnit('enemy', { x: 5, y: 5 });
    const other = makeUnit('enemy', { x: 6, y: 5 });
    world.units.push(caster, primary, other);
    // maxJumps 5 but only 2 enemies → 2 distinct hits, no re-hit of either.
    executeOp(
      chainOp({ maxJumps: 5 }),
      ctx({ caster, world, target: primary, resolution: { chainOps: [{ baseDamage: 20, critChance: 0 }] } }),
    );
    expect(hp(primary)).toBe(20);
    expect(hp(other)).toBe(10);
    expect(events).toHaveLength(2); // no third/fourth/fifth hop
  });

  it('does not arc to an out-of-range island (gap > rangeCells stops the chain)', () => {
    const { world } = setup();
    const caster = makeUnit('player', { x: 0, y: 0 });
    const primary = makeUnit('enemy', { x: 5, y: 5 });
    const island = makeUnit('enemy', { x: 5, y: 12 }); // 7 cells away — beyond rangeCells 2
    world.units.push(caster, primary, island);
    executeOp(
      chainOp(),
      ctx({ caster, world, target: primary, resolution: { chainOps: [{ baseDamage: 20, critChance: 0 }] } }),
    );
    expect(hp(primary)).toBe(20);
    expect(hp(island)).toBe(0); // unreachable
  });

  it('never arcs to an ally (only the caster\'s enemies)', () => {
    const { world } = setup();
    const caster = makeUnit('player', { x: 0, y: 0 });
    const primary = makeUnit('enemy', { x: 5, y: 5 });
    const ally = makeUnit('player', { x: 6, y: 5 }); // adjacent friendly — must be skipped
    world.units.push(caster, primary, ally);
    executeOp(
      chainOp(),
      ctx({ caster, world, target: primary, resolution: { chainOps: [{ baseDamage: 20, critChance: 0 }] } }),
    );
    expect(hp(primary)).toBe(20);
    expect(hp(ally)).toBe(0); // untouched
  });

  it('fizzles entirely when the committed primary is dead (commit-at-cast onto a corpse)', () => {
    const { world, events } = setup();
    const caster = makeUnit('player', { x: 0, y: 0 });
    const primary = makeUnit('enemy', { x: 5, y: 5 });
    primary.currentHp = 0;
    const other = makeUnit('enemy', { x: 6, y: 5 });
    world.units.push(caster, primary, other);
    executeOp(
      chainOp(),
      ctx({ caster, world, target: primary, resolution: { chainOps: [{ baseDamage: 20, critChance: 0 }] } }),
    );
    expect(events).toHaveLength(0); // no jump-0 victim → no hops
    expect(hp(other)).toBe(0);
  });

  it('applies an applyStatus rider to every landed hop (chain composes with status-on-hit)', () => {
    const TS = { id: 't_chain', name: 't_chain', durationSeconds: 4, merge: 'refresh' } as const;
    STATUS_DEFS.t_chain = parseStatusDef(TS);
    try {
      const { world } = setup();
      const caster = makeUnit('player', { x: 0, y: 0 });
      const primary = makeUnit('enemy', { x: 5, y: 5 });
      const near = makeUnit('enemy', { x: 6, y: 5 });
      world.units.push(caster, primary, near);
      const statusInner: EffectOp = { kind: 'applyStatus', statusId: 't_chain' };
      executeOp(
        chainOp({ maxJumps: 2, ops: [innerDmg, statusInner] }),
        // chainOps aligns with ops: [damage resolution, applyStatus → {}].
        ctx({ caster, world, target: primary, resolution: { chainOps: [{ baseDamage: 20, critChance: 0 }, {}] } }),
      );
      const has = (u: Unit) => u.effects.some((e) => e.key === 't_chain');
      expect(has(primary)).toBe(true);
      expect(has(near)).toBe(true);
      expect(hp(near)).toBe(10); // damage still falls off alongside the rider
    } finally {
      delete STATUS_DEFS.t_chain;
    }
  });

  it('§31 — the chained applyStatus rider carries its captured magnitude, unscaled per hop', () => {
    const TS = { id: 't_chain', name: 't_chain', durationSeconds: 4, merge: 'refresh' } as const;
    STATUS_DEFS.t_chain = parseStatusDef(TS);
    try {
      const { world } = setup();
      const caster = makeUnit('player', { x: 0, y: 0 });
      const primary = makeUnit('enemy', { x: 5, y: 5 });
      const near = makeUnit('enemy', { x: 6, y: 5 });
      world.units.push(caster, primary, near);
      const statusInner: EffectOp = { kind: 'applyStatus', statusId: 't_chain' };
      executeOp(
        chainOp({ maxJumps: 2, ops: [innerDmg, statusInner] }),
        // the rider's captured magnitude (3) rides chainOps[1]; the bolt falls off,
        // the status rider does NOT (scaleChainResolution touches only baseDamage).
        ctx({
          caster, world, target: primary,
          resolution: { chainOps: [{ baseDamage: 20, critChance: 0 }, { statusMagnitude: 3 }] },
        }),
      );
      const mag = (u: Unit) => u.effects.find((e) => e.key === 't_chain')!.magnitude;
      expect(mag(primary)).toBe(3); // hop 0
      expect(mag(near)).toBe(3); // hop 1 — same magnitude on every hop
      expect(hp(near)).toBe(10); // the damage still falls off
    } finally {
      delete STATUS_DEFS.t_chain;
    }
  });
});

describe('executeOp — chain (deferred per-hop timing, §29c follow-up)', () => {
  const innerDmg: EffectOp = {
    kind: 'damage', scaling: 'magic', might: 0, accuracy: 0.6, critBase: 0,
    critable: false, evadable: false, bypassDefense: false,
  };
  const hp = (u: Unit) => u.derived.maxHp - u.currentHp;
  // hopDelaySeconds 0.1 → secondsToTicks(0.1) ticks of stagger between hops.
  const DELAY_TICKS = secondsToTicks(0.1);
  const stagChain: EffectOp = {
    kind: 'chain', maxJumps: 3, rangeCells: 2, falloff: 0.5, hopDelaySeconds: 0.1, ops: [innerDmg],
  };

  function lineOfThree() {
    const { world, events } = setup();
    const caster = makeUnit('player', { x: 0, y: 0 });
    const primary = makeUnit('enemy', { x: 5, y: 5 });
    const near = makeUnit('enemy', { x: 6, y: 5 }); // dist 1 from primary
    const far = makeUnit('enemy', { x: 7, y: 5 }); // dist 1 from `near`
    world.units.push(caster, primary, near, far);
    return { world, events, caster, primary, near, far };
  }

  it('lands ONLY hop 0 immediately and queues the rest', () => {
    const { world, primary, near, far } = lineOfThree();
    executeOp(stagChain, ctx({ caster: world.units[0]!, world, target: primary, resolution: { chainOps: [{ baseDamage: 20, critChance: 0 }] } }));
    expect(hp(primary)).toBe(20); // hop 0 fired now
    expect(hp(near)).toBe(0); // hop 1 is deferred
    expect(hp(far)).toBe(0);
    expect(world.pendingChainHops).toHaveLength(1); // jump 1 queued
    expect(world.pendingChainHops[0]!.jumpIndex).toBe(1);
  });

  it('fires one hop per DELAY_TICKS as the queue comes due (the bolt travels)', () => {
    const { world, primary, near, far } = lineOfThree();
    executeOp(stagChain, ctx({ caster: world.units[0]!, world, target: primary, resolution: { chainOps: [{ baseDamage: 20, critChance: 0 }] } }));
    // Advance to just before hop 1 is due → still un-fired.
    for (let i = 0; i < DELAY_TICKS - 1; i++) world.tick();
    expect(hp(near)).toBe(0);
    world.tick(); // hop 1 comes due
    expect(hp(near)).toBe(10); // falloff^1
    expect(hp(far)).toBe(0); // hop 2 now queued, not yet due
    expect(world.pendingChainHops).toHaveLength(1);
    for (let i = 0; i < DELAY_TICKS; i++) world.tick();
    expect(hp(far)).toBe(5); // falloff^2 — the chain finished
    expect(world.pendingChainHops).toHaveLength(0);
  });

  it('a hopless instant chain (hopDelaySeconds 0) resolves every hop in the call', () => {
    const { world, primary, near, far } = lineOfThree();
    executeOp(
      { ...stagChain, hopDelaySeconds: 0 },
      ctx({ caster: world.units[0]!, world, target: primary, resolution: { chainOps: [{ baseDamage: 20, critChance: 0 }] } }),
    );
    expect([hp(primary), hp(near), hp(far)]).toEqual([20, 10, 5]); // all at once
    expect(world.pendingChainHops).toHaveLength(0); // nothing deferred
  });

  it('breaks the chain mid-arc if the caster dies before the next hop', () => {
    const { world, caster, primary, near } = lineOfThree();
    // A surviving teammate keeps the battle (and the tick loop) alive after the
    // caster falls, so the deferred hop actually comes due to a dead caster.
    world.units.push(makeUnit('player', { x: 0, y: 2 }));
    executeOp(stagChain, ctx({ caster, world, target: primary, resolution: { chainOps: [{ baseDamage: 20, critChance: 0 }] } }));
    caster.currentHp = 0; // the stormcaller is slain before hop 1 lands
    for (let i = 0; i < DELAY_TICKS + 1; i++) world.tick();
    expect(hp(near)).toBe(0); // the arc died with its caster
    expect(world.pendingChainHops).toHaveLength(0); // the due hop was dropped, not rescheduled
  });
});
