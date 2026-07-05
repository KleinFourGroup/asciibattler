import { describe, it, expect } from 'vitest';
import { World } from '../World';
import { Unit, type Team, type UnitArchetype, type UnitStats } from '../Unit';
import { EventBus } from '../../core/EventBus';
import { RNG } from '../../core/RNG';
import { deriveStats } from '../stats';
import type { GameEvents } from '../../core/events';
import type { GridCoord } from '../../core/types';
import {
  unitsInCells,
  squareCells,
  resolveAreaVictims,
  affectsMatch,
  isCombatTargetable,
  nearestChainTarget,
} from './targeting';

/**
 * Phase Y2 — the area/targeting resolution primitives. Explicit-input mechanic
 * tests (no shipped config): `unitsInCells` (the Cluster-2 footprint seam) and
 * the `aoe` victim resolution reproduce MagicBolt's blast set, order, and the
 * friendly-fire / neutral / dead filters.
 */

const STATS_BLOCK: UnitStats = {
  constitution: 100, strength: 0, ranged: 0, magic: 0, luck: 0, defense: 0,
  precision: 0, evasion: 0, speed: 0, mobility: 0, power: 1,
};

let nextId = 1;
function makeUnit(team: Team, pos: GridCoord, archetype: UnitArchetype = 'mercenary'): Unit {
  return new Unit({
    id: nextId++,
    team,
    archetype,
    glyph: 'M',
    stats: STATS_BLOCK,
    derived: deriveStats(STATS_BLOCK, 1),
    position: pos,
  });
}

function world(units: Unit[]): World {
  const w = new World(new EventBus<GameEvents>(), new RNG(1));
  w.units.push(...units);
  return w;
}

describe('unitsInCells', () => {
  it('returns the occupants of the cell set in world.units order', () => {
    const a = makeUnit('enemy', { x: 1, y: 1 });
    const b = makeUnit('enemy', { x: 2, y: 2 });
    const c = makeUnit('enemy', { x: 9, y: 9 }); // outside
    const w = world([a, b, c]);
    const found = unitsInCells(w, [{ x: 2, y: 2 }, { x: 1, y: 1 }]);
    expect(found).toEqual([a, b]); // world.units order, not cell-arg order
  });

  it('returns empty when no unit occupies any cell', () => {
    const w = world([makeUnit('enemy', { x: 0, y: 0 })]);
    expect(unitsInCells(w, [{ x: 5, y: 5 }])).toEqual([]);
  });
});

describe('squareCells', () => {
  it('is the (2r+1)² Chebyshev block around the center', () => {
    expect(squareCells({ x: 5, y: 5 }, 1)).toHaveLength(9);
    expect(squareCells({ x: 5, y: 5 }, 2)).toHaveLength(25);
    expect(squareCells({ x: 0, y: 0 }, 1)).toContainEqual({ x: -1, y: -1 });
  });
});

describe('affectsMatch — the friendly-fire filter (seam: enemies = not caster team)', () => {
  it('enemies = any team other than the caster (neutral included at THIS layer)', () => {
    expect(affectsMatch('enemies', 'enemy', 'player')).toBe(true);
    expect(affectsMatch('enemies', 'neutral', 'player')).toBe(true); // the Cluster-2 seam
    expect(affectsMatch('enemies', 'player', 'player')).toBe(false);
  });
  it('allies = caster team; all = everyone', () => {
    expect(affectsMatch('allies', 'player', 'player')).toBe(true);
    expect(affectsMatch('allies', 'enemy', 'player')).toBe(false);
    expect(affectsMatch('all', 'neutral', 'player')).toBe(true);
  });
});

describe('resolveAreaVictims — reproduces the MagicBolt blast set', () => {
  const params = { shape: 'square' as const, radius: 1, ringMultiplier: 0.5, affects: 'enemies' as const };

  it('center victim gets mult 1, ring victims get ringMultiplier', () => {
    const caster = makeUnit('player', { x: 0, y: 0 }, 'mage');
    const center = makeUnit('enemy', { x: 5, y: 5 });
    const ring = makeUnit('enemy', { x: 6, y: 5 });
    const w = world([caster, center, ring]);
    const victims = resolveAreaVictims(w, caster, { x: 5, y: 5 }, params);
    expect(victims).toEqual([
      { unit: center, mult: 1 },
      { unit: ring, mult: 0.5 },
    ]);
  });

  it('spares the caster team, INDESTRUCTIBLE (hp-less) neutrals, the dead, and out-of-radius units', () => {
    const caster = makeUnit('player', { x: 5, y: 5 }, 'mage'); // dead-center, same team
    const ally = makeUnit('player', { x: 5, y: 6 });
    const wall = makeUnit('neutral', { x: 6, y: 5 }, 'wall'); // hp-less = indestructible
    const corpse = makeUnit('enemy', { x: 4, y: 5 });
    corpse.currentHp = 0;
    const outside = makeUnit('enemy', { x: 5, y: 7 }); // chebyshev 2
    const enemy = makeUnit('enemy', { x: 4, y: 4 }); // chebyshev 1
    const w = world([caster, ally, wall, corpse, outside, enemy]);
    const victims = resolveAreaVictims(w, caster, { x: 5, y: 5 }, params);
    expect(victims.map((v) => v.unit)).toEqual([enemy]); // only the live enemy in radius
  });

  it('§40b — a DESTRUCTIBLE neutral (rubble) IS caught by an affects:enemies blast', () => {
    const caster = makeUnit('player', { x: 0, y: 0 }, 'mage');
    const enemy = makeUnit('enemy', { x: 5, y: 5 }); // center
    const rubble = makeUnit('neutral', { x: 6, y: 5 }, 'rubble_1x1'); // ring, hp-present
    const wall = makeUnit('neutral', { x: 4, y: 5 }, 'wall'); // ring, hp-less = spared
    const w = world([caster, enemy, rubble, wall]);
    const victims = resolveAreaVictims(w, caster, { x: 5, y: 5 }, params);
    // The blast chews the enemy AND the destructible rubble; the indestructible
    // wall is untouched (HP-presence decides). world.units order preserved.
    expect(victims).toEqual([
      { unit: enemy, mult: 1 },
      { unit: rubble, mult: 0.5 },
    ]);
  });
});

/**
 * 44-pre-b — the AoE/chain footprint seam FILLED: `unitsInCells` intersects
 * footprints (`cellsOccupiedBy`), the area `mult` is the BEST covered cell, and
 * the chain hop range measures to the nearest body cell (`cellUnitDistance`).
 * Corner-only, a 2×2 rubble whose §39 corner sat outside the blast/hop range
 * was invisible to the whole effects layer. rubble_2x2 at corner (5,5) occupies
 * (5,5) (6,5) (5,6) (6,6) throughout.
 */
describe('effects targeting — multi-tile footprints (44-pre-b)', () => {
  const CORNER = { x: 5, y: 5 };

  it('unitsInCells catches a rubble by a BODY cell when its corner is outside the set', () => {
    const rubble = makeUnit('neutral', CORNER, 'rubble_2x2');
    const w = world([rubble]);
    expect(unitsInCells(w, [{ x: 6, y: 6 }])).toEqual([rubble]); // body, not corner
    expect(unitsInCells(w, [{ x: 7, y: 7 }])).toEqual([]); // off the body entirely
  });

  it('a blast covering only BODY cells (corner outside) hits the rubble at ring mult', () => {
    const caster = makeUnit('player', { x: 0, y: 0 }, 'mage');
    const rubble = makeUnit('neutral', CORNER, 'rubble_2x2');
    const w = world([caster, rubble]);
    // Radius-1 square at (7,7) covers x∈[6,8] y∈[6,8] → body cell (6,6) only;
    // the corner (5,5) is outside. Corner-only this blast missed entirely.
    const victims = resolveAreaVictims(w, caster, { x: 7, y: 7 }, {
      shape: 'square', radius: 1, ringMultiplier: 0.5, affects: 'enemies',
    });
    expect(victims).toEqual([{ unit: rubble, mult: 0.5 }]);
  });

  it('a blast centered ON a body cell gives the rubble the center mult (best covered cell)', () => {
    const caster = makeUnit('player', { x: 0, y: 0 }, 'mage');
    const rubble = makeUnit('neutral', CORNER, 'rubble_2x2');
    const w = world([caster, rubble]);
    // Center (6,6) is a body cell — corner-only the rubble was caught (its
    // corner sits in the radius-1 square) but read as RING (mult 0.5).
    const victims = resolveAreaVictims(w, caster, { x: 6, y: 6 }, {
      shape: 'square', radius: 1, ringMultiplier: 0.5, affects: 'enemies',
    });
    expect(victims).toEqual([{ unit: rubble, mult: 1 }]);
  });

  it('a chain hop reaches a rubble whose BODY is in range but corner is not', () => {
    const rubble = makeUnit('neutral', CORNER, 'rubble_2x2');
    const w = world([rubble]);
    // From (8,6), range 2: corner (5,5) is Chebyshev 3 (corner-only: no hop);
    // body cell (6,6) is 2 → in range.
    expect(nearestChainTarget(w, 'player', { x: 8, y: 6 }, 2, new Set())).toBe(rubble);
    expect(nearestChainTarget(w, 'player', { x: 9, y: 6 }, 2, new Set())).toBeUndefined();
  });

  it('hop ranking uses body distance — a near body outranks a nearer-cornered 1×1', () => {
    const rubble = makeUnit('neutral', CORNER, 'rubble_2x2'); // body cell (6,6)
    const enemy = makeUnit('enemy', { x: 8, y: 8 });
    const w = world([rubble, enemy]);
    // From (7,7): rubble body (6,6) is 1, enemy (8,8) is 1 — tie goes to
    // world.units order (rubble first). Corner-only the rubble measured 2 and
    // the enemy won outright.
    expect(nearestChainTarget(w, 'player', { x: 7, y: 7 }, 2, new Set())).toBe(rubble);
  });
});

describe('isCombatTargetable — HP-presence (§40b)', () => {
  it('a living combatant is targetable; a corpse is not', () => {
    const alive = makeUnit('enemy', { x: 0, y: 0 });
    const dead = makeUnit('enemy', { x: 1, y: 1 });
    dead.currentHp = 0;
    expect(isCombatTargetable(alive)).toBe(true);
    expect(isCombatTargetable(dead)).toBe(false);
  });

  it('a DESTRUCTIBLE neutral (rubble, hp-present) is targetable; hp-less wall/cover are not', () => {
    const rubble = makeUnit('neutral', { x: 0, y: 0 }, 'rubble_1x1');
    const wall = makeUnit('neutral', { x: 1, y: 1 }, 'wall');
    const cover = makeUnit('neutral', { x: 2, y: 2 }, 'half_cover');
    expect(isCombatTargetable(rubble)).toBe(true);
    expect(isCombatTargetable(wall)).toBe(false);
    expect(isCombatTargetable(cover)).toBe(false);
  });

  it('a destructible neutral at 0 HP is not targetable (already reaped)', () => {
    const rubble = makeUnit('neutral', { x: 0, y: 0 }, 'rubble_1x1');
    rubble.currentHp = 0;
    expect(isCombatTargetable(rubble)).toBe(false);
  });
});
