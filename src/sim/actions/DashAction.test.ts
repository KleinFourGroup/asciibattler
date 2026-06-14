import { describe, it, expect } from 'vitest';
import { DashAction, DASH_ACTION_ID } from './DashAction';
import { World } from '../World';
import { Unit, type UnitStats } from '../Unit';
import { EventBus } from '../../core/EventBus';
import { RNG } from '../../core/RNG';
import { deriveStats } from '../stats';
import { ARCHETYPE_CONFIG } from '../archetypes';
import type { GameEvents } from '../../core/events';
import type { GridCoord } from '../../core/types';

/**
 * N1 — `DashAction` is the leap primitive. It lands the unit at `to` in `start`
 * (like `MoveAction`) and emits BOTH `unit:moved` (so the renderer lerps the
 * slide via its normal one-unit path) and the first-class `unit:dashed` (the
 * cue that the audio / future VFX key off — fires on the leap itself, so even a
 * one-cell dash is heard). DashAbility.test.ts covers the propose decision.
 */

function rogue(id: number, pos: GridCoord): Unit {
  const stats: UnitStats = { ...ARCHETYPE_CONFIG.rogue.baseStats };
  return new Unit({
    id, team: 'player', archetype: 'rogue', glyph: 'r',
    stats, derived: deriveStats(stats, 1), position: pos,
  });
}

describe('DashAction', () => {
  it('lands the unit at `to` and emits both unit:moved (slide) and unit:dashed (cue)', () => {
    const bus = new EventBus<GameEvents>();
    const world = new World(bus, new RNG(1));
    const u = rogue(1, { x: 2, y: 2 });
    world.units.push(u);

    const moved: GameEvents['unit:moved'][] = [];
    const dashed: GameEvents['unit:dashed'][] = [];
    bus.on('unit:moved', (p) => moved.push(p));
    bus.on('unit:dashed', (p) => dashed.push(p));

    new DashAction({ x: 2, y: 2 }, { x: 4, y: 2 }, 5).start(u, world);

    expect(u.position).toEqual({ x: 4, y: 2 });
    const payload = { unitId: 1, from: { x: 2, y: 2 }, to: { x: 4, y: 2 }, durationTicks: 5 };
    expect(moved).toEqual([payload]);
    expect(dashed).toEqual([payload]);
  });

  it('round-trips through toData/fromData under its own action id', () => {
    const a = new DashAction({ x: 1, y: 1 }, { x: 3, y: 1 }, 5);
    expect(a.id).toBe(DASH_ACTION_ID);
    const b = DashAction.fromData(a.toData());
    expect(b.toData()).toEqual(a.toData());
    expect(b.id).toBe(DASH_ACTION_ID);
  });
});
