import { describe, it, expect } from 'vitest';
import { World } from './World';
import { EventBus } from '../core/EventBus';
import { RNG } from '../core/RNG';
import { findTarget } from './Targeting';
import { Unit } from './Unit';
import {
  WALL_GLYPH,
  HALF_COVER_GLYPH,
  RUBBLE_GLYPH,
  RUBBLE_ARCHETYPE_BY_SIZE,
  spawnWall,
  spawnHalfCover,
  spawnRubble,
} from './environment';
import { cellsOccupiedBy } from './occupancy';
import { deriveStats } from './stats';
import { ARCHETYPE_CONFIG } from './archetypes';
import { NEUTRAL_DEFS } from '../config/units';
import { statusDef } from '../config/statuses';
import type { GameEvents } from '../core/events';
import type { GridCoord } from '../core/types';

describe('environment / spawnWall', () => {
  it('spawns as a neutral-team unit with the wall glyph', () => {
    const bus = new EventBus<GameEvents>();
    const w = new World(bus, new RNG(1));
    const wall = spawnWall(w, { x: 5, y: 5 });

    expect(wall.team).toBe('neutral');
    // §38d — walls now carry the `wall` catalog id, not the retired `environment`
    // sentinel; the fold resolves glyph / flat HP / LOS-blocking from NEUTRAL_DEFS.
    expect(wall.archetype).toBe('wall');
    expect(wall.glyph).toBe(WALL_GLYPH);
    expect(wall.blocksLineOfSight).toBe(true);
    expect(wall.position).toEqual({ x: 5, y: 5 });
    expect(wall.behaviors).toEqual([]);
    expect(wall.activeAction).toBeNull();
  });

  it('§38d — a catalog-spawned wall/half-cover matches the old spawnEnvironment shape', () => {
    const bus = new EventBus<GameEvents>();
    const w = new World(bus, new RNG(1));

    const wall = spawnWall(w, { x: 1, y: 1 });
    expect(wall.archetype).toBe('wall');
    expect(wall.glyph).toBe(WALL_GLYPH);
    expect(wall.blocksLineOfSight).toBe(true); // wall semantics (default)
    // §40b — a wall is hp-LESS (indestructible); `spawnEnvironment` falls back to
    // the nominal filler maxHp (1, `NOMINAL_NEUTRAL_MAXHP` — byte-identical to the
    // pre-§40b `hp:1`), which is never a damage target.
    expect(NEUTRAL_DEFS.wall!.hp).toBeUndefined();
    expect(wall.derived.maxHp).toBe(1);

    const cover = spawnHalfCover(w, { x: 2, y: 2 });
    expect(cover.archetype).toBe('half_cover');
    expect(cover.glyph).toBe(HALF_COVER_GLYPH);
    expect(cover.blocksLineOfSight).toBe(false); // the D6 LOS contract, on the def
    expect(cover.behaviors).toEqual([]);

    // The glyph constants must not drift from the catalog entries the fold reads.
    expect(NEUTRAL_DEFS.wall!.glyph).toBe(WALL_GLYPH);
    expect(NEUTRAL_DEFS.half_cover!.glyph).toBe(HALF_COVER_GLYPH);
  });

  it('emits unit:spawned just like a combatant', () => {
    const bus = new EventBus<GameEvents>();
    const w = new World(bus, new RNG(1));
    const events: GameEvents['unit:spawned'][] = [];
    bus.on('unit:spawned', (p) => events.push(p));

    const wall = spawnWall(w, { x: 0, y: 0 });

    expect(events).toEqual([{ unitId: wall.id, instant: true }]);
  });

  it('is never picked as a target by findTarget', () => {
    const bus = new EventBus<GameEvents>();
    const w = new World(bus, new RNG(1));
    const stats = { ...ARCHETYPE_CONFIG.mercenary.baseStats };
    const derived = deriveStats(stats, 1);
    const player = new Unit({
      id: 1,
      team: 'player',
      archetype: 'mercenary',
      glyph: 'M',
      stats,
      derived,
      position: { x: 0, y: 0 },
    });
    w.units.push(player);
    spawnWall(w, { x: 1, y: 1 }); // closer than any enemy
    const enemy = new Unit({
      id: 3,
      team: 'enemy',
      archetype: 'mercenary',
      glyph: 'M',
      stats,
      derived,
      position: { x: 5, y: 5 },
    });
    w.units.push(enemy);

    expect(findTarget(player, w)?.id).toBe(enemy.id);
  });

  it('walls round-trip through the World snapshot path', () => {
    const bus = new EventBus<GameEvents>();
    const w = new World(bus, new RNG(1));
    spawnWall(w, { x: 2, y: 3 });
    spawnWall(w, { x: 4, y: 5 });

    const snap = w.toJSON();
    const restored = World.fromJSON(snap, new EventBus<GameEvents>());

    expect(restored.units).toHaveLength(2);
    expect(restored.units[0]!.team).toBe('neutral');
    expect(restored.units[0]!.archetype).toBe('wall');
    expect(restored.units[0]!.glyph).toBe(WALL_GLYPH);
    expect(restored.units[0]!.position).toEqual({ x: 2, y: 3 });
    expect(restored.units[1]!.position).toEqual({ x: 4, y: 5 });
  });

  it('spawns with the requested maxHp (E1: lives on derived, not stats)', () => {
    const bus = new EventBus<GameEvents>();
    const w = new World(bus, new RNG(1));
    const wall = spawnWall(w, { x: 1, y: 1 }, 5);
    expect(wall.derived.maxHp).toBe(5);
    expect(wall.currentHp).toBe(5);
  });

  it('removes a wall when its HP drops to 0 and emits unit:died with team neutral', () => {
    // Nothing in the current codebase targets walls (Targeting filters
    // neutrals), so this test exercises the path E2's AoE damage will
    // light up: drop wall HP from outside, advance a tick, expect the
    // wall to be cleaned up just like any other dying Unit.
    const bus = new EventBus<GameEvents>();
    const w = new World(bus, new RNG(1));
    const deaths: GameEvents['unit:died'][] = [];
    bus.on('unit:died', (p) => deaths.push(p));

    const wall = spawnWall(w, { x: 3, y: 3 }, 5);
    wall.currentHp = 0;

    w.tick();

    expect(w.findUnit(wall.id)).toBeUndefined();
    expect(deaths).toEqual([{ unitId: wall.id, team: 'neutral' }]);
  });
});

/**
 * §38d-3 — the statusSusceptibility gate at `World.applyStatusEffect` (the single
 * status-apply chokepoint). A neutral's `UnitDef.statusSusceptibility` is an
 * allow-list: walls opt into burn/frozen, out of poison/bleed. Combatants omit
 * the field ⇒ susceptible to all (byte-identical). Balance-proof: the allow-list
 * is read from `NEUTRAL_DEFS`, never hardcoded.
 */
describe('§38d-3 — statusSusceptibility gate', () => {
  const wallAllows = NEUTRAL_DEFS.wall!.statusSusceptibility!; // ['burn','frozen']

  it("a wall takes a status it's susceptible to, ignores one it isn't", () => {
    const bus = new EventBus<GameEvents>();
    const w = new World(bus, new RNG(1));
    const wall = spawnWall(w, { x: 5, y: 5 });

    // Derive the allowed/denied ids from the catalog, not literals.
    const allowed = wallAllows[0]!; // 'burn'
    const denied = ['poison', 'bleed'].find((s) => !wallAllows.includes(s))!; // 'poison'

    w.applyStatusEffect(wall, statusDef(denied), null);
    expect(wall.effects.some((e) => e.key === denied), `${denied} filtered`).toBe(false);

    w.applyStatusEffect(wall, statusDef(allowed), null);
    expect(wall.effects.some((e) => e.key === allowed), `${allowed} allowed`).toBe(true);
  });

  it('a filtered status is a silent no-op (no status:applied emitted)', () => {
    const bus = new EventBus<GameEvents>();
    const w = new World(bus, new RNG(1));
    const applied: GameEvents['status:applied'][] = [];
    bus.on('status:applied', (p) => applied.push(p));
    const wall = spawnWall(w, { x: 1, y: 1 });

    const denied = ['poison', 'bleed'].find((s) => !wallAllows.includes(s))!;
    w.applyStatusEffect(wall, statusDef(denied), null);
    expect(applied).toEqual([]); // no event for the filtered application

    const allowed = wallAllows[0]!;
    w.applyStatusEffect(wall, statusDef(allowed), null);
    expect(applied).toEqual([{ unitId: wall.id, statusId: allowed, sourceUnitId: null }]);
  });

  it('a combatant (no susceptibility list) still takes any status — allow-all', () => {
    const bus = new EventBus<GameEvents>();
    const w = new World(bus, new RNG(1));
    const stats = { ...ARCHETYPE_CONFIG.mercenary.baseStats };
    const merc = new Unit({
      id: 99,
      team: 'player',
      archetype: 'mercenary',
      glyph: 'M',
      stats,
      derived: deriveStats(stats, 1),
      position: { x: 0, y: 0 },
    });
    w.units.push(merc);

    // The same id a wall filters out — a combatant (list absent) accepts it.
    const anyId = ['poison', 'bleed'].find((s) => !wallAllows.includes(s))!;
    w.applyStatusEffect(merc, statusDef(anyId), null);
    expect(merc.effects.some((e) => e.key === anyId)).toBe(true);
  });
});

/**
 * §40a — rubble, the FIRST real multi-tile entity: a destructible neutral
 * `UnitDef` (flat HP + a footprint + the burnable-not-poisonable allow-list).
 * These prove the §39 footprint fill live (a rubble occupies its whole N×N
 * block), the flat-HP reap lifecycle on a neutral, and the susceptibility gate —
 * all balance-proof (derived from `NEUTRAL_DEFS`, never hardcoded). ⚠️ Nothing
 * DAMAGES rubble in play until §40b lifts the `isCombatTargetable` neutral guard
 * (AoE) + adds the auto-target hook; here we drive HP / status directly.
 */
describe('§40a — rubble (the first real multi-tile neutral)', () => {
  it('spawns as a neutral with the rubble glyph, catalog HP, and blocks LOS', () => {
    const w = new World(new EventBus<GameEvents>(), new RNG(1));
    const def = NEUTRAL_DEFS[RUBBLE_ARCHETYPE_BY_SIZE[2]]!;
    const rubble = spawnRubble(w, { x: 5, y: 5 }, 2);

    expect(rubble.team).toBe('neutral');
    expect(rubble.archetype).toBe(RUBBLE_ARCHETYPE_BY_SIZE[2]);
    expect(rubble.glyph).toBe(RUBBLE_GLYPH);
    expect(rubble.glyph).toBe(def.glyph); // the constant mustn't drift from the catalog
    expect(rubble.blocksLineOfSight).toBe(true); // §40 decision — rubble blocks LOS
    expect(rubble.derived.maxHp).toBe(def.hp); // flat HP from the def
    expect(rubble.behaviors).toEqual([]); // inert — no abilities
    expect(rubble.activeAction).toBeNull();
  });

  it('occupies its whole N×N footprint from the canonical corner (the §39 fill, live)', () => {
    const w = new World(new EventBus<GameEvents>(), new RNG(1));
    const corners: Record<1 | 2 | 3, GridCoord> = {
      1: { x: 1, y: 1 },
      2: { x: 4, y: 4 },
      3: { x: 8, y: 8 },
    };
    for (const size of [1, 2, 3] as const) {
      const rubble = spawnRubble(w, corners[size], size);
      // Balance-proof: the block count is the catalog footprint², never hardcoded.
      const n = NEUTRAL_DEFS[RUBBLE_ARCHETYPE_BY_SIZE[size]]!.footprint;
      expect(n, `catalog footprint for size ${size}`).toBe(size);
      const cells = cellsOccupiedBy(rubble);
      expect(cells, `size ${size} occupies ${n}×${n}`).toHaveLength(n * n);
      expect(cells).toContainEqual(corners[size]); // position stays the canonical corner
    }
  });

  it('takes an overridden maxHp (the §40d per-placement configurable HP)', () => {
    const w = new World(new EventBus<GameEvents>(), new RNG(1));
    const rubble = spawnRubble(w, { x: 1, y: 1 }, 1, 7);
    expect(rubble.derived.maxHp).toBe(7);
    expect(rubble.currentHp).toBe(7);
  });

  it('reaps at 0 HP and emits unit:died with team neutral (the crumble lifecycle)', () => {
    const bus = new EventBus<GameEvents>();
    const w = new World(bus, new RNG(1));
    const deaths: GameEvents['unit:died'][] = [];
    bus.on('unit:died', (p) => deaths.push(p));

    const rubble = spawnRubble(w, { x: 3, y: 3 }, 2, 5);
    rubble.currentHp = 0;
    w.tick();

    expect(w.findUnit(rubble.id)).toBeUndefined();
    expect(deaths).toEqual([{ unitId: rubble.id, team: 'neutral' }]);
  });

  it('is burnable/freezable but not poisonable (statusSusceptibility, catalog-derived)', () => {
    const w = new World(new EventBus<GameEvents>(), new RNG(1));
    const rubble = spawnRubble(w, { x: 5, y: 5 }, 1);
    const allows = NEUTRAL_DEFS[RUBBLE_ARCHETYPE_BY_SIZE[1]]!.statusSusceptibility!;
    const allowed = allows[0]!; // 'burn'
    const denied = ['poison', 'bleed'].find((s) => !allows.includes(s))!; // 'poison'

    w.applyStatusEffect(rubble, statusDef(denied), null);
    expect(rubble.effects.some((e) => e.key === denied), `${denied} filtered`).toBe(false);

    w.applyStatusEffect(rubble, statusDef(allowed), null);
    expect(rubble.effects.some((e) => e.key === allowed), `${allowed} allowed`).toBe(true);
  });
});
