import { describe, it, expect } from 'vitest';
import { World } from './World';
import { EventBus } from '../core/EventBus';
import { RNG } from '../core/RNG';
import type { GameEvents } from '../core/events';
import type { GridCoord } from '../core/types';
import type { Team, UnitStats, Behavior } from './Unit';
import type { ActionProposal } from './Action';
import { moveProposal } from './movement';
import { tileDef } from './TileGrid';
import { statusDef } from '../config/statuses';
import { TILES_CONFIG } from '../config/tiles';
import { SIM } from '../config/sim';

/**
 * §37d — the tile→status ENTER hook (`World.applyTileEnterEffects`), fired by
 * `MoveAction`'s 50% logical flip. A tile may APPLY a status on enter (mud →
 * poison, gated by the `applyStatusOnEnter` trial flag) and/or REMOVE one (water
 * / deep_water → strip `burn`, the always-on inverse of the fire→burn sustain).
 *
 * Balance-proof: the expected status ids are pulled from the `TileDef` table
 * itself (`tileDef(kind).statusOnEnter` / `.statusRemovedOnEnter`), never
 * hardcoded — so retuning which status a tile carries can't silently rot a test.
 */

const BASE: UnitStats = {
  constitution: 100, strength: 0, ranged: 0, magic: 0, luck: 0, defense: 0,
  precision: 0, evasion: 0, speed: 0, mobility: 0, power: 1,
};

// Config-derived (balance-proof) — the table is the single source of truth.
const MUD_STATUS = tileDef('mud').statusOnEnter!;
const WATER_STRIP = tileDef('shallow_water').statusRemovedOnEnter!;
const DEEP_WATER_STRIP = tileDef('deep_water').statusRemovedOnEnter!;

function setup() {
  const bus = new EventBus<GameEvents>();
  const world = new World(bus, new RNG(1));
  return { world, bus };
}

function spawnAt(world: World, team: Team, pos: GridCoord) {
  return world.spawnUnit({ archetype: 'mercenary', level: 1, stats: BASE, xp: 0 }, team, pos);
}

const carries = (u: { effects: { key: string }[] }, id: string) =>
  u.effects.some((e) => e.key === id);

describe('§37d — applyTileEnterEffects (the hook in isolation)', () => {
  it('mud applies its status on enter (the flag is shipped ON)', () => {
    expect(TILES_CONFIG.applyStatusOnEnter).toBe(true); // the trial default
    expect(MUD_STATUS).toBe('poison'); // table sanity
    const { world, bus } = setup();
    const pos = { x: 3, y: 3 };
    const unit = spawnAt(world, 'player', pos);
    world.tileGrid.setKind(pos, 'mud');

    const applied: GameEvents['status:applied'][] = [];
    bus.on('status:applied', (e) => applied.push(e));

    expect(carries(unit, MUD_STATUS)).toBe(false);
    world.applyTileEnterEffects(unit);

    expect(carries(unit, MUD_STATUS)).toBe(true);
    // Environmental — no source unit (mirrors the fire-tile burn).
    expect(applied).toEqual([{ unitId: unit.id, statusId: MUD_STATUS, sourceUnitId: null }]);
  });

  it('water strips burn on enter + fires status:expired (the renderer clears the tint)', () => {
    expect(WATER_STRIP).toBe('burn');
    const { world, bus } = setup();
    const pos = { x: 4, y: 4 };
    const unit = spawnAt(world, 'player', pos);
    world.tileGrid.setKind(pos, 'shallow_water');
    world.applyStatusEffect(unit, statusDef(WATER_STRIP), null); // catch fire first
    expect(carries(unit, WATER_STRIP)).toBe(true);

    const expired: GameEvents['status:expired'][] = [];
    bus.on('status:expired', (e) => expired.push(e));

    world.applyTileEnterEffects(unit);

    expect(carries(unit, WATER_STRIP)).toBe(false);
    expect(expired).toEqual([{ unitId: unit.id, statusId: WATER_STRIP, sourceUnitId: null }]);
  });

  it('deep_water also strips burn on enter (the impassable tile carries the same cleanse)', () => {
    expect(DEEP_WATER_STRIP).toBe('burn');
    const { world } = setup();
    const pos = { x: 5, y: 5 };
    const unit = spawnAt(world, 'player', pos);
    world.tileGrid.setKind(pos, 'deep_water');
    world.applyStatusEffect(unit, statusDef(DEEP_WATER_STRIP), null);

    world.applyTileEnterEffects(unit);
    expect(carries(unit, DEEP_WATER_STRIP)).toBe(false);
  });

  it('stripping a status the unit does not carry is a silent no-op (no spurious event)', () => {
    const { world, bus } = setup();
    const pos = { x: 6, y: 6 };
    const unit = spawnAt(world, 'player', pos);
    world.tileGrid.setKind(pos, 'shallow_water'); // strips burn, but the unit has none

    const expired: GameEvents['status:expired'][] = [];
    bus.on('status:expired', (e) => expired.push(e));

    world.applyTileEnterEffects(unit);
    expect(expired).toEqual([]);
  });

  it('a plain floor tile applies / removes nothing (control)', () => {
    const { world, bus } = setup();
    const pos = { x: 7, y: 7 };
    const unit = spawnAt(world, 'player', pos); // default grid is all floor
    world.applyStatusEffect(unit, statusDef('burn'), null);

    const events: string[] = [];
    bus.on('status:applied', () => events.push('applied'));
    bus.on('status:expired', () => events.push('expired'));

    world.applyTileEnterEffects(unit);
    expect(carries(unit, 'burn')).toBe(true); // floor doesn't cleanse
    expect(events).toEqual([]);
  });
});

/**
 * The integration proof: a REAL single-step move drives the hook through
 * `MoveAction.applyEffect`, so it fires at the §36b logical commit (the 50%
 * flip) — not at move-start, and not before the unit logically arrives.
 */
const MOVE_TICKS = 4;
const FLIP_OFFSET = Math.floor(MOVE_TICKS * SIM.moveFlipFraction);

class StubMoveBehavior implements Behavior {
  readonly kind = 'test:stub-move';
  constructor(
    private readonly from: GridCoord,
    private readonly to: GridCoord,
  ) {}
  proposeAction(): ActionProposal | null {
    return moveProposal(this.from, this.to, MOVE_TICKS);
  }
}

function onlyBehavior(unit: { behaviors: Behavior[] }, b?: Behavior) {
  unit.behaviors.length = 0;
  if (b) unit.behaviors.push(b);
}

describe('§37d — the hook fires at the move commit (the 50% flip), not at start', () => {
  it('a unit moving onto mud is afflicted only AFTER it logically arrives', () => {
    const { world } = setup();
    const from = { x: 2, y: 2 };
    const to = { x: 3, y: 2 };
    const mover = spawnAt(world, 'player', from);
    onlyBehavior(spawnAt(world, 'enemy', { x: 10, y: 10 })); // keep the battle alive, far away
    onlyBehavior(mover, new StubMoveBehavior(from, to));
    world.tileGrid.setKind(to, 'mud');

    world.tick(); // start: claims `to`, still logically on `from` (floor) — no affliction yet
    expect(mover.position).toEqual(from);
    expect(carries(mover, MUD_STATUS)).toBe(false);

    for (let o = 1; o < FLIP_OFFSET; o++) {
      world.tick();
      expect(carries(mover, MUD_STATUS)).toBe(false); // still pre-flip on `from`
    }

    world.tick(); // the flip — the unit commits to `to` (mud) and is poisoned
    expect(mover.position).toEqual(to);
    expect(carries(mover, MUD_STATUS)).toBe(true);
  });
});
