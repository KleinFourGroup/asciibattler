import { describe, it, expect } from 'vitest';
import { World } from '../World';
import { Unit, type Team, type UnitArchetype, type UnitStats } from '../Unit';
import { EventBus } from '../../core/EventBus';
import { RNG } from '../../core/RNG';
import { deriveStats } from '../stats';
import { totalTicks, type ActionPhase } from '../Action';
import type { GameEvents } from '../../core/events';
import type { GridCoord } from '../../core/types';
import { parseAbilityDef, type AbilityDef } from './schema';
import { resolvePhases } from './timeline';
import { EffectAction } from './EffectAction';

/**
 * Phase Y2 — the EffectAction firing model: ops fire at their authored phase
 * boundary (start handles offset 0; applyEffect handles the impact boundary,
 * skipping offset 0 so it never double-fires), phaseTarget surfaces the right
 * renderer info per verb shape, and the cast-time context round-trips.
 */

const BASE_STATS: UnitStats = {
  constitution: 100, strength: 0, ranged: 0, magic: 0, luck: 0, defense: 0,
  precision: 0, evasion: 0, speed: 0, mobility: 0, power: 1,
};

let nextId = 1;
function makeUnit(team: Team, pos: GridCoord): Unit {
  return new Unit({
    id: nextId++, team, archetype: 'mercenary' as UnitArchetype, glyph: 'M',
    stats: BASE_STATS, derived: deriveStats(BASE_STATS, 1), position: pos,
  });
}

function world(): World {
  return new World(new EventBus<GameEvents>(), new RNG(1));
}

const DMG = { kind: 'damage', scaling: 'strength', might: 0, accuracy: 0.6, critBase: 0, critable: false, evadable: false, bypassDefense: false } as const;

const strikeDef: AbilityDef = parseAbilityDef({
  id: 'sword', cooldownSeconds: 1.5, rangeCells: 1, target: { kind: 'enemyInRange' },
  timeline: [{ phase: 'impact', seconds: 0 }, { phase: 'recovery', seconds: 'fill' }],
  orphanPolicy: 'commit-at-cast', priority: 10,
  effects: [{ phase: 'impact', op: DMG }],
});

const magicDef: AbilityDef = parseAbilityDef({
  id: 'magic_bolt', cooldownSeconds: 2.5, rangeCells: 5,
  target: { kind: 'aoe', shape: 'square', radius: 1, anchor: 'targetCell', affects: 'enemies', ringMultiplier: 0.5 },
  timeline: [{ phase: 'windup', seconds: 'fill' }, { phase: 'release', seconds: 0 }, { phase: 'travel', seconds: 0.35 }, { phase: 'impact', seconds: 0 }],
  orphanPolicy: 'ground-target', priority: 10,
  effects: [{ phase: 'impact', op: DMG }],
});

const gambitDef: AbilityDef = parseAbilityDef({
  id: 'gambit_strike', cooldownSeconds: 1.2, rangeCells: 1, target: { kind: 'enemyInRange' },
  timeline: [{ phase: 'windup', seconds: 0.25 }, { phase: 'impact', seconds: 0 }, { phase: 'recovery', seconds: 'fill' }],
  orphanPolicy: 'commit-at-cast', priority: 10,
  effects: [{ phase: 'windup', op: DMG }, { phase: 'impact', op: { kind: 'move', mode: 'retreat', cells: 1 } }],
});

const catapultDef: AbilityDef = parseAbilityDef({
  id: 'catapult_shot', cooldownSeconds: 3, rangeCells: 6, minRangeCells: 4, target: { kind: 'enemyInRange' },
  timeline: [{ phase: 'windup', seconds: 'fill' }, { phase: 'release', seconds: 0 }, { phase: 'travel', seconds: 0.6 }, { phase: 'impact', seconds: 0 }],
  orphanPolicy: 'fizzle', priority: 10,
  effects: [{ phase: 'impact', op: DMG }],
});

const dashDef: AbilityDef = parseAbilityDef({
  // `self` — a pure caster-reposition: the leap targets the CASTER (the enemy is
  // only a propose-time reference for the landing), so phaseTarget surfaces
  // nothing, mirroring DashAction's absent phaseTarget.
  id: 'dash', cooldownSeconds: 10, speedScaled: false, rangeCells: 2, target: { kind: 'self' },
  timeline: [{ phase: 'impact', seconds: 0.25 }],
  orphanPolicy: 'commit-at-cast', priority: 5,
  effects: [{ phase: 'impact', op: { kind: 'move', mode: 'advance', cells: 2 } }],
});

/** Seat an action as a unit's in-flight activeAction with resolved phases. */
function activate(unit: Unit, action: EffectAction, phases: ActionPhase[]): void {
  unit.activeAction = { action, startTick: 0, finishTick: totalTicks(phases), phases };
}

describe('EffectAction firing — ops land at their authored phase', () => {
  it('strike: damage fires in start() (impact at offset 0), not again in applyEffect(0)', () => {
    const w = world();
    const caster = makeUnit('player', { x: 0, y: 0 });
    const target = makeUnit('enemy', { x: 1, y: 0 });
    w.units.push(caster, target);
    const action = new EffectAction(strikeDef, { targetId: target.id, ops: [{ baseDamage: 10, critChance: 0 }] });
    activate(caster, action, resolvePhases(strikeDef, 0));
    action.start(caster, w);
    expect(target.currentHp).toBe(target.derived.maxHp - 10);
    action.applyEffect(caster, w, 0, 'impact'); // World's offset-0 impact call
    expect(target.currentHp).toBe(target.derived.maxHp - 10); // no double-fire
  });

  it('charged spell: nothing in start(), damage at the impact boundary', () => {
    const w = world();
    const caster = makeUnit('player', { x: 0, y: 0 });
    const center = makeUnit('enemy', { x: 5, y: 5 });
    w.units.push(caster, center);
    const phases = resolvePhases(magicDef, 0);
    const action = new EffectAction(magicDef, { targetId: -1, targetCell: { x: 5, y: 5 }, ops: [{ baseDamage: 10, critChance: 0 }] });
    activate(caster, action, phases);
    action.start(caster, w);
    expect(center.currentHp).toBe(center.derived.maxHp); // impact not at offset 0
    action.applyEffect(caster, w, totalTicks(phases), 'impact');
    expect(center.currentHp).toBe(center.derived.maxHp - 10);
  });

  it('gambit: damage in start() (windup@0), reposition at the impact boundary', () => {
    const w = world();
    const caster = makeUnit('player', { x: 5, y: 5 });
    const target = makeUnit('enemy', { x: 4, y: 5 });
    w.units.push(caster, target);
    const phases = resolvePhases(gambitDef, 0);
    const impactOffset = phases.find((p) => p.phase === 'windup')!.ticks; // impact begins after windup
    const action = new EffectAction(gambitDef, { targetId: target.id, ops: [{ baseDamage: 10, critChance: 0 }, { moveDest: { x: 4, y: 5 } }] });
    activate(caster, action, phases);
    action.start(caster, w);
    expect(target.currentHp).toBe(target.derived.maxHp - 10); // damage landed
    expect(caster.position).toEqual({ x: 5, y: 5 }); // not yet repositioned
    action.applyEffect(caster, w, impactOffset, 'impact');
    expect(caster.position.x).toBeGreaterThan(5); // darted away from the anchor
  });

  it('dash: relocate fires in start() (impact at offset 0)', () => {
    const w = world();
    const caster = makeUnit('player', { x: 0, y: 0 });
    w.units.push(caster);
    const action = new EffectAction(dashDef, { targetId: -1, ops: [{ moveDest: { x: 2, y: 0 } }] });
    activate(caster, action, resolvePhases(dashDef, 0));
    action.start(caster, w);
    expect(caster.position).toEqual({ x: 2, y: 0 });
  });
});

describe('EffectAction.phaseTarget — per-verb renderer info', () => {
  const cell: GridCoord = { x: 7, y: 7 };
  it('single-target strike → targetId only', () => {
    const a = new EffectAction(strikeDef, { targetId: 42, ops: [{}] });
    expect(a.phaseTarget()).toEqual({ targetId: 42 });
  });
  it('aoe → targetCell only', () => {
    const a = new EffectAction(magicDef, { targetId: -1, targetCell: cell, ops: [{}] });
    expect(a.phaseTarget()).toEqual({ targetCell: cell });
  });
  it('fizzle homing (catapult) → targetId + the cast-cell fallback', () => {
    const a = new EffectAction(catapultDef, { targetId: 9, targetCell: cell, ops: [{}] });
    expect(a.phaseTarget()).toEqual({ targetId: 9, targetCell: cell });
  });
  it('pure-move (dash) → no target info', () => {
    const a = new EffectAction(dashDef, { targetId: 3, ops: [{}] });
    expect(a.phaseTarget()).toEqual({});
  });
});

describe('EffectAction serialization', () => {
  it('round-trips the cast-time context through toData / JSON / fromData', () => {
    const w = world();
    const original = new EffectAction(gambitDef, {
      targetId: 7, targetCell: { x: 4, y: 5 },
      ops: [{ baseDamage: 11, critChance: 0.2, damageMultiplier: 1 }, { moveDest: { x: 4, y: 5 } }],
    });
    const data = JSON.parse(JSON.stringify(original.toData()));
    const restored = EffectAction.fromData(data, w, gambitDef);
    expect(restored.toData()).toEqual(original.toData());
  });

  it('toData copies nested cells (no shared references)', () => {
    const a = new EffectAction(magicDef, { targetId: -1, targetCell: { x: 5, y: 5 }, ops: [{ moveDest: { x: 1, y: 1 } }] });
    const d1 = a.toData();
    const d2 = a.toData();
    expect(d1.targetCell).not.toBe(d2.targetCell);
    expect(d1.targetCell).toEqual(d2.targetCell);
  });
});
