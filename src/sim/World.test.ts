import { describe, it, expect, vi } from 'vitest';
import { World } from './World';
import { Unit, type Team, type UnitStats } from './Unit';
import { MovementBehavior } from './behaviors/MovementBehavior';
import { AbilityBehavior } from './behaviors/AbilityBehavior';
import { createAbility } from './abilities/registry';
import { EffectAction } from './effects/EffectAction';
import { parseAbilityDef } from './effects/schema';
import { resolvePhases } from './effects/timeline';
import { totalTicks } from './Action';
import { EventBus } from '../core/EventBus';
import { RNG } from '../core/RNG';
import { rollUnit } from './archetypes';
import { spawnWall } from './environment';
import { secondsToTicks } from '../config';
import { statusDef } from '../config/statuses';
import { ZERO_STATS, deriveStats, hitChanceFor } from './stats';
import { ARCHETYPE_CONFIG } from './archetypes';
import { STATS } from '../config/stats';
import type { GameEvents } from '../core/events';

describe('World (Step 3.1 skeleton)', () => {
  it('starts at tick 0 with an empty unit list', () => {
    const w = new World(new EventBus<GameEvents>(), new RNG(1));
    expect(w.currentTick).toBe(0);
    expect(w.units).toEqual([]);
  });

  it('uses the default square grid when no dimensions are provided', () => {
    const w = new World(new EventBus<GameEvents>(), new RNG(1));
    expect(w.gridW).toBe(12);
    expect(w.gridH).toBe(12);
  });

  it('accepts explicit rectangular dimensions (D3)', () => {
    const w = new World(new EventBus<GameEvents>(), new RNG(1), 15, 10);
    expect(w.gridW).toBe(15);
    expect(w.gridH).toBe(10);
  });

  it('tick() increments the counter and emits `tick` with the new value', () => {
    const bus = new EventBus<GameEvents>();
    const w = new World(bus, new RNG(1));
    const handler = vi.fn();
    bus.on('tick', handler);

    w.tick();
    w.tick();
    w.tick();

    expect(w.currentTick).toBe(3);
    expect(handler).toHaveBeenCalledTimes(3);
    expect(handler).toHaveBeenNthCalledWith(1, { tick: 1 });
    expect(handler).toHaveBeenNthCalledWith(2, { tick: 2 });
    expect(handler).toHaveBeenNthCalledWith(3, { tick: 3 });
  });
});

describe('World.spawnUnit', () => {
  it('adds the unit to the unit list, assigns it sequential ids, and emits unit:spawned', () => {
    const bus = new EventBus<GameEvents>();
    const rng = new RNG(1);
    const w = new World(bus, rng);
    const handler = vi.fn();
    bus.on('unit:spawned', handler);

    const a = w.spawnUnit(rollUnit('mercenary', rng), 'player', { x: 1, y: 2 });
    const b = w.spawnUnit(rollUnit('mercenary', rng), 'enemy', { x: 3, y: 4 });

    expect(w.units).toEqual([a, b]);
    expect(a.id).toBe(1);
    expect(b.id).toBe(2);
    expect(a.team).toBe('player');
    expect(b.team).toBe('enemy');
    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler).toHaveBeenNthCalledWith(1, { unitId: 1, instant: true });
    expect(handler).toHaveBeenNthCalledWith(2, { unitId: 2, instant: true });
  });

  it('derives glyph from the template archetype', () => {
    const bus = new EventBus<GameEvents>();
    const rng = new RNG(1);
    const w = new World(bus, rng);
    const m = w.spawnUnit(rollUnit('mercenary', rng), 'player', { x: 0, y: 0 });
    const r = w.spawnUnit(rollUnit('ranged', rng), 'player', { x: 1, y: 0 });
    expect(m.glyph).toBe('M');
    expect(r.glyph).toBe('a');
  });
});

describe('World.findUnit', () => {
  it('returns the unit with the given id, or undefined', () => {
    const bus = new EventBus<GameEvents>();
    const rng = new RNG(1);
    const w = new World(bus, rng);
    const a = w.spawnUnit(rollUnit('mercenary', rng), 'player', { x: 0, y: 0 });
    expect(w.findUnit(a.id)).toBe(a);
    expect(w.findUnit(9999)).toBeUndefined();
  });
});

describe('World battle-end detection', () => {
  it('emits battle:ended with player as winner when no enemies remain', () => {
    const bus = new EventBus<GameEvents>();
    const rng = new RNG(1);
    const w = new World(bus, rng);
    // E4 follow-up: spawn WITH rosterIndex so the survivor lands in
    // playerRosterIds and earns its flat-XP slice; otherwise the
    // bare-spawn path treats it as a non-roster fixture and emits
    // an empty awards list.
    const survivor = w.spawnUnit(rollUnit('mercenary', rng), 'player', { x: 0, y: 0 }, 0);
    const ends: GameEvents['battle:ended'][] = [];
    bus.on('battle:ended', (p) => ends.push(p));

    w.tick();

    expect(ends).toHaveLength(1);
    expect(ends[0]!.winner).toBe('player');
    expect(ends[0]!.xpAwards).toHaveLength(1);
    expect(ends[0]!.xpAwards[0]!.unitId).toBe(survivor.id);
    expect(ends[0]!.xpAwards[0]!.rosterIndex).toBe(0);
    expect(ends[0]!.xpAwards[0]!.damageDealt).toBe(0);
    expect(w.ended).toBe(true);
  });

  it('emits battle:ended with enemy as winner when no players remain', () => {
    const bus = new EventBus<GameEvents>();
    const rng = new RNG(1);
    const w = new World(bus, rng);
    const enemy = w.spawnUnit(rollUnit('mercenary', rng), 'enemy', { x: 0, y: 0 });
    const ends: GameEvents['battle:ended'][] = [];
    bus.on('battle:ended', (p) => ends.push(p));

    w.tick();

    expect(ends).toHaveLength(1);
    expect(ends[0]!.winner).toBe('enemy');
    // No player roster units here, so still no awards — but H4 carries the
    // per-side survivor power so the encounter loop can chip the player pool.
    expect(ends[0]!.xpAwards).toEqual([]);
    expect(ends[0]!.survivorPower).toEqual({ player: 0, enemy: enemy.stats.power });
  });

  it('resolveAsDraw ends the turn as a draw, reports both survivor powers, and still awards player XP', () => {
    // H4: the driver's per-turn tick cap force-resolves a turn that hasn't
    // resolved decisively. Both sides chip the opposing pool by Σpower; XP is
    // awarded regardless of winner (the old player-win-only gate is gone).
    const bus = new EventBus<GameEvents>();
    const rng = new RNG(1);
    const w = new World(bus, rng);
    const player = w.spawnUnit(rollUnit('mercenary', rng), 'player', { x: 0, y: 0 }, 0);
    const enemy = w.spawnUnit(rollUnit('mercenary', rng), 'enemy', { x: 5, y: 5 });
    const ends: GameEvents['battle:ended'][] = [];
    bus.on('battle:ended', (p) => ends.push(p));

    w.tick(); // far apart — both still alive, no decisive end
    expect(w.ended).toBe(false);
    w.resolveAsDraw();

    expect(ends).toHaveLength(1);
    expect(ends[0]!.winner).toBe('draw');
    expect(ends[0]!.survivorPower).toEqual({
      player: player.stats.power,
      enemy: enemy.stats.power,
    });
    expect(ends[0]!.xpAwards).toHaveLength(1);
    expect(ends[0]!.xpAwards[0]!.rosterIndex).toBe(0);
    expect(w.ended).toBe(true);
  });

  it('resolveAsDraw is a no-op once the battle already ended naturally', () => {
    const bus = new EventBus<GameEvents>();
    const rng = new RNG(1);
    const w = new World(bus, rng);
    w.spawnUnit(rollUnit('mercenary', rng), 'player', { x: 0, y: 0 }, 0);
    const ends: GameEvents['battle:ended'][] = [];
    bus.on('battle:ended', (p) => ends.push(p));

    w.tick(); // lone player → decisive player win, single emit
    w.resolveAsDraw(); // already ended → must not emit again

    expect(ends).toHaveLength(1);
    expect(ends[0]!.winner).toBe('player');
  });

  it('does not emit battle:ended while both teams have units', () => {
    const bus = new EventBus<GameEvents>();
    const rng = new RNG(1);
    const w = new World(bus, rng);
    w.spawnUnit(rollUnit('mercenary', rng), 'player', { x: 0, y: 0 });
    w.spawnUnit(rollUnit('mercenary', rng), 'enemy', { x: 5, y: 5 });
    const ends: GameEvents['battle:ended'][] = [];
    bus.on('battle:ended', (p) => ends.push(p));

    for (let i = 0; i < 10; i++) w.tick();

    expect(ends).toHaveLength(0);
    expect(w.ended).toBe(false);
  });

  it('does not emit battle:ended for a walls-only (neutrals-only) world', () => {
    // Pre-spawn phase parallel: terrain generator drops walls first, then
    // teams. The intermediate "walls + nothing else" tick must not trip
    // the win condition.
    const bus = new EventBus<GameEvents>();
    const rng = new RNG(1);
    const w = new World(bus, rng);
    w.spawnUnit(rollUnit('mercenary', rng), 'neutral', { x: 3, y: 3 });
    w.spawnUnit(rollUnit('mercenary', rng), 'neutral', { x: 5, y: 5 });
    const ends: GameEvents['battle:ended'][] = [];
    bus.on('battle:ended', (p) => ends.push(p));

    w.tick();

    expect(ends).toHaveLength(0);
    expect(w.ended).toBe(false);
  });

  it('34a — a genuine mutual wipe (empty board, no walls) ends immediately as a draw', () => {
    // Both teams' last units die on the same tick with nothing left on the
    // board. Pre-34a this fell through `checkBattleEnd`'s empty-board guard and
    // soft-locked until the driver's tick cap. The `_combatBegan` latch (set
    // the first tick both teams were alive) now resolves it as a DRAW at once.
    const bus = new EventBus<GameEvents>();
    const rng = new RNG(1);
    const w = new World(bus, rng);
    const player = w.spawnUnit(rollUnit('mercenary', rng), 'player', { x: 0, y: 0 }, 0);
    const enemy = w.spawnUnit(rollUnit('mercenary', rng), 'enemy', { x: 5, y: 5 });
    const ends: GameEvents['battle:ended'][] = [];
    bus.on('battle:ended', (p) => ends.push(p));

    w.tick(); // far apart — both alive, latch sets, no end
    expect(w.ended).toBe(false);

    // Simulate the same-tick double-KO: both fall to 0 hp, the next tick's
    // death sweep reaps both → empty board.
    player.currentHp = 0;
    enemy.currentHp = 0;
    w.tick();

    expect(ends).toHaveLength(1);
    expect(ends[0]!.winner).toBe('draw');
    expect(w.ended).toBe(true);
  });

  it('34a — a genuine mutual wipe with walls left standing ends immediately as a draw', () => {
    // The other wipe path: a neutral wall survives, so the board is non-empty
    // and the empty-board guard is skipped. Pre-34a the `!playerAlive &&
    // !enemyAlive` branch returned silently; the latch now draws at once.
    const bus = new EventBus<GameEvents>();
    const rng = new RNG(1);
    const w = new World(bus, rng);
    const player = w.spawnUnit(rollUnit('mercenary', rng), 'player', { x: 0, y: 0 }, 0);
    const enemy = w.spawnUnit(rollUnit('mercenary', rng), 'enemy', { x: 5, y: 5 });
    w.spawnUnit(rollUnit('mercenary', rng), 'neutral', { x: 9, y: 9 });
    const ends: GameEvents['battle:ended'][] = [];
    bus.on('battle:ended', (p) => ends.push(p));

    w.tick(); // both teams alive — latch sets
    expect(w.ended).toBe(false);

    player.currentHp = 0;
    enemy.currentHp = 0;
    w.tick(); // both reaped; the neutral wall remains on the board

    expect(ends).toHaveLength(1);
    expect(ends[0]!.winner).toBe('draw');
    expect(w.ended).toBe(true);
  });

  it('ignores neutrals when scoring the win condition (player + walls = player wins)', () => {
    const bus = new EventBus<GameEvents>();
    const rng = new RNG(1);
    const w = new World(bus, rng);
    w.spawnUnit(rollUnit('mercenary', rng), 'player', { x: 0, y: 0 }, 0);
    w.spawnUnit(rollUnit('mercenary', rng), 'neutral', { x: 5, y: 5 });
    w.spawnUnit(rollUnit('mercenary', rng), 'neutral', { x: 7, y: 7 });
    const ends: GameEvents['battle:ended'][] = [];
    bus.on('battle:ended', (p) => ends.push(p));

    w.tick();

    expect(ends).toHaveLength(1);
    expect(ends[0]!.winner).toBe('player');
    // Surviving player picks up the flat slice — neutrals never appear.
    expect(ends[0]!.xpAwards).toHaveLength(1);
    expect(ends[0]!.xpAwards[0]!.damageDealt).toBe(0);
  });

  it('stops processing ticks once ended', () => {
    const bus = new EventBus<GameEvents>();
    const rng = new RNG(1);
    const w = new World(bus, rng);
    w.spawnUnit(rollUnit('mercenary', rng), 'player', { x: 0, y: 0 });
    w.tick(); // ends immediately
    expect(w.ended).toBe(true);
    const tickBefore = w.currentTick;

    w.tick();
    w.tick();
    expect(w.currentTick).toBe(tickBefore);
  });
});

describe('World inline death handling', () => {
  it('removes a unit with currentHp <= 0 and emits unit:died on the next tick', () => {
    const { world, units, deaths } = scene([
      { team: 'player', x: 0, y: 0, hp: 0 },
      { team: 'enemy', x: 5, y: 5, hp: 30 },
    ]);

    world.tick();
    expect(world.findUnit(units[0]!.id)).toBeUndefined();
    expect(deaths).toEqual([{ unitId: units[0]!.id, team: 'player' }]);
  });

  it('removes units with negative HP (overkill)', () => {
    const { world, units, deaths } = scene([
      { team: 'player', x: 0, y: 0, hp: -42 },
      { team: 'enemy', x: 5, y: 5, hp: 30 },
    ]);
    world.tick();
    expect(world.findUnit(units[0]!.id)).toBeUndefined();
    expect(deaths).toHaveLength(1);
  });

  it('dead units do not act the tick they die', () => {
    // Player and enemy adjacent. Player one-shots enemy. Enemy must not
    // get a posthumous swing back at the player even though its turn in
    // the iteration order comes after the kill.
    const { world, units, attacks } = scene([
      {
        team: 'player',
        x: 0,
        y: 0,
        hp: 50,
        attackDamage: 999,
        attackRange: 1,
        behaviors: ['movement', 'attack'],
      },
      {
        team: 'enemy',
        x: 1,
        y: 0,
        hp: 30,
        attackDamage: 999,
        attackRange: 1,
        behaviors: ['movement', 'attack'],
      },
    ]);

    world.tick();
    expect(attacks).toHaveLength(1);
    expect(attacks[0]?.attackerId).toBe(units[0]!.id);
    expect(units[0]!.currentHp).toBe(50);
    expect(world.findUnit(units[1]!.id)).toBeUndefined();
  });
});

describe('World 27d tile statuses (fire→burn, healing→rejuvenate)', () => {
  // An inert enemy stationed far away keeps checkBattleEnd happy so the tile
  // tests can tick freely without the battle ending. No behaviors → never moves.
  const KEEP_BATTLE_ALIVE: DeathSceneUnit = { team: 'enemy', x: 11, y: 11, hp: 50 };

  // Drive the integration off the SHIPPED status defs (the per-second rate is
  // the §27c balance-proof; here we read interval/might/duration so the timing
  // tracks config, never a hardcoded tick count). `op.might` is common to the
  // damage|heal union, so no narrowing needed.
  const BURN = statusDef('burn');
  const REJUV = statusDef('rejuvenate');
  const E = secondsToTicks(BURN.periodic!.everySeconds); // ticks per DoT interval
  const burnMight = BURN.periodic!.op.might; // flat `might` (scaling:'none')
  const rejuvMight = REJUV.periodic!.op.might;
  const busOf = (world: World) => (world as unknown as { bus: EventBus<GameEvents> }).bus;

  it('applies burn ONCE on entering fire, then chips via the DoT one interval later', () => {
    const { world, units } = scene([
      { team: 'player', x: 3, y: 3, hp: 50 },
      KEEP_BATTLE_ALIVE,
    ]);
    world.tileGrid.setKind({ x: 3, y: 3 }, 'fire');
    const applied: GameEvents['status:applied'][] = [];
    const ticked: GameEvents['status:ticked'][] = [];
    busOf(world).on('status:applied', (p) => applied.push(p));
    busOf(world).on('status:ticked', (p) => ticked.push(p));

    // Tick 1: burn lands (status:applied fires once) but no damage yet — the
    // first DoT tick is one interval after apply.
    world.tick();
    expect(applied).toEqual([{ unitId: units[0]!.id, statusId: 'burn', sourceUnitId: null }]);
    expect(ticked).toHaveLength(0);
    expect(units[0]!.currentHp).toBe(50);

    // Standing on does NOT re-apply (the sustain tops up duration silently).
    world.tick();
    expect(applied).toHaveLength(1);

    // One interval after apply → the first DoT tick (burnMight HP, defense-bypass).
    while (world.currentTick < 1 + E) world.tick();
    expect(ticked).toEqual([
      { unitId: units[0]!.id, statusId: 'burn', sourceUnitId: null, amount: burnMight },
    ]);
    expect(units[0]!.currentHp).toBe(50 - burnMight);

    // Next interval → second tick (a steady DoT cadence).
    while (world.currentTick < 1 + 2 * E) world.tick();
    expect(ticked).toHaveLength(2);
    expect(units[0]!.currentHp).toBe(50 - 2 * burnMight);
  });

  it('burn bypasses defense — the fire chip stays unmitigated (now via the DoT)', () => {
    // The mercenary scene unit carries the archetype's defense; the burn DoT
    // authors bypassDefense:true, so it deals full `might` despite that armor.
    const { world, units } = scene([
      { team: 'player', x: 3, y: 3, hp: 50 },
      KEEP_BATTLE_ALIVE,
    ]);
    expect(units[0]!.stats.defense).toBeGreaterThan(0);
    world.tileGrid.setKind({ x: 3, y: 3 }, 'fire');
    while (world.currentTick < 1 + E) world.tick(); // through the first DoT tick
    expect(units[0]!.currentHp).toBe(50 - burnMight); // full might, defense ignored
  });

  it('healing applies rejuvenate — a HoT that regens and clamps at maxHp', () => {
    const { world, units } = scene([
      { team: 'player', x: 3, y: 3, hp: 10 },
      KEEP_BATTLE_ALIVE,
    ]);
    world.tileGrid.setKind({ x: 3, y: 3 }, 'healing');
    const ticked: GameEvents['status:ticked'][] = [];
    busOf(world).on('status:ticked', (p) => ticked.push(p));

    while (world.currentTick < 1 + E) world.tick(); // first HoT tick
    expect(units[0]!.currentHp).toBe(10 + rejuvMight);
    expect(ticked[0]).toEqual({
      unitId: units[0]!.id,
      statusId: 'rejuvenate',
      sourceUnitId: null,
      amount: rejuvMight,
    });

    // Clamp at maxHp: fill up, the next tick heals 0 but still emits (amount 0,
    // the gotcha #80 no-op the renderer drops as "no +0 spam").
    units[0]!.currentHp = units[0]!.derived.maxHp;
    while (world.currentTick < 1 + 2 * E) world.tick();
    expect(units[0]!.currentHp).toBe(units[0]!.derived.maxHp);
    expect(ticked[ticked.length - 1]!.amount).toBe(0);

    // F6: an environmental (null-source) HoT does NOT feed the utility-XP
    // ledger — only ability heals do. The unit gained HP yet earns no heal-XP.
    expect(world.utilityDoneBy(units[0]!.id)).toBe(0);
  });

  it('burn lingers after the unit steps off the fire tile, then expires', () => {
    const { world, units } = scene([
      { team: 'player', x: 3, y: 3, hp: 50 },
      KEEP_BATTLE_ALIVE,
    ]);
    world.tileGrid.setKind({ x: 3, y: 3 }, 'fire');
    const ticked: GameEvents['status:ticked'][] = [];
    const expired: GameEvents['status:expired'][] = [];
    busOf(world).on('status:ticked', (p) => ticked.push(p));
    busOf(world).on('status:expired', (p) => expired.push(p));

    world.tick(); // burn applied at tick 1
    units[0]!.position = { x: 0, y: 0 }; // step off the fire tile (an inert unit)

    // Burn keeps ticking after stepping off — it lingers for its `durationSeconds`.
    while (world.currentTick < 1 + E) world.tick();
    expect(ticked.length).toBeGreaterThanOrEqual(1); // a tick landed AFTER leaving
    expect(units[0]!.currentHp).toBeLessThan(50);

    // Past the duration → it expires and stops ticking.
    const durationTicks = secondsToTicks(BURN.durationSeconds);
    while (world.currentTick < 1 + durationTicks + 1) world.tick();
    expect(expired).toEqual([{ unitId: units[0]!.id, statusId: 'burn', sourceUnitId: null }]);
    const finalCount = ticked.length;
    for (let t = 0; t < 2 * E; t++) world.tick();
    expect(ticked).toHaveLength(finalCount); // no more ticks after expiry
  });

  it('neutrals on fire/healing tiles are not afflicted (combatants-only policy)', () => {
    const { world } = scene([
      { team: 'player', x: 0, y: 0, hp: 50 },
      KEEP_BATTLE_ALIVE,
    ]);
    const wall = spawnWall(world, { x: 5, y: 5 });
    world.tileGrid.setKind({ x: 5, y: 5 }, 'fire');
    const startHp = wall.currentHp;
    const applied: GameEvents['status:applied'][] = [];
    busOf(world).on('status:applied', (p) => applied.push(p));

    for (let t = 0; t < 3 * E; t++) world.tick();
    expect(wall.currentHp).toBe(startHp);
    expect(applied).toHaveLength(0);
    expect(wall.effects).toHaveLength(0);
  });

  it('a burn DoT kill removes the unit and ends the battle on the same tick', () => {
    const { world, units } = scene([
      { team: 'player', x: 0, y: 0, hp: 50 },
      { team: 'enemy', x: 5, y: 5, hp: burnMight }, // exactly lethal on the first DoT tick
    ]);
    world.tileGrid.setKind({ x: 5, y: 5 }, 'fire');
    const deaths: GameEvents['unit:died'][] = [];
    const ends: GameEvents['battle:ended'][] = [];
    busOf(world).on('unit:died', (p) => deaths.push(p));
    busOf(world).on('battle:ended', (p) => ends.push(p));

    while (world.currentTick < 1 + E) world.tick(); // through the first burn tick
    expect(deaths.some((d) => d.unitId === units[1]!.id)).toBe(true);
    expect(ends).toHaveLength(1);
    expect(ends[0]!.winner).toBe('player');
  });

  it('a corpse on a fire tile is not afflicted (reaped before the tile pass)', () => {
    const { world, units } = scene([
      { team: 'player', x: 3, y: 3, hp: 0 }, // already dead at battle start
      KEEP_BATTLE_ALIVE,
    ]);
    world.tileGrid.setKind({ x: 3, y: 3 }, 'fire');
    const applied: GameEvents['status:applied'][] = [];
    busOf(world).on('status:applied', (p) => applied.push(p));

    for (let t = 0; t < 2 * E; t++) world.tick();
    expect(applied).toHaveLength(0); // reaped at tick 1's death check, never afflicted
    expect(world.findUnit(units[0]!.id)).toBeUndefined();
  });
});

describe('World.applyDamage — GP2 defense mitigation', () => {
  // Build a 2-unit duel directly so the target's `defense` is explicit (the
  // shared `scene` helper bakes in the melee archetype's defense). Units are
  // pushed onto `world.units`; `recordDamage`/`findUnit` resolve the attacker
  // via the linear fallback, so the XP-ledger path is exercised end to end.
  function duel(targetDefense: number): {
    world: World;
    attacker: Unit;
    target: Unit;
    attacks: GameEvents['unit:attacked'][];
  } {
    const bus = new EventBus<GameEvents>();
    const world = new World(bus, new RNG(1));
    const attacks: GameEvents['unit:attacked'][] = [];
    bus.on('unit:attacked', (p) => attacks.push(p));

    const mkStats = (defense: number): UnitStats => ({
      ...ARCHETYPE_CONFIG.mercenary.baseStats,
      defense,
    });
    const mk = (id: number, team: Team, defense: number, x: number): Unit => {
      const stats = mkStats(defense);
      return new Unit({
        id,
        team,
        archetype: 'mercenary',
        glyph: 'M',
        stats,
        derived: deriveStats(stats, 1),
        position: { x, y: 0 },
      });
    };
    const attacker = mk(1, 'player', 0, 0);
    const target = mk(2, 'enemy', targetDefense, 1);
    world.units.push(attacker, target);
    return { world, attacker, target, attacks };
  }

  it('subtracts defense from the raw hit: final = max(minDamage, raw − defense)', () => {
    const { world, attacker, target, attacks } = duel(3);
    const hpBefore = target.currentHp;
    world.applyDamage(attacker.id, target, 10, { crit: false });
    const expected = Math.max(STATS.minDamage, 10 - 3); // 7, above the floor
    expect(attacks[0]!.damage).toBe(expected);
    expect(target.currentHp).toBe(hpBefore - expected);
  });

  it('honors the minDamage floor when defense ≥ raw (no full negation)', () => {
    const { world, attacker, target, attacks } = duel(50);
    const hpBefore = target.currentHp;
    world.applyDamage(attacker.id, target, 5, { crit: false });
    expect(attacks[0]!.damage).toBe(STATS.minDamage);
    expect(target.currentHp).toBe(hpBefore - STATS.minDamage);
  });

  it('is behaviour-preserving at defense 0 (raw passes through, crit flag forwarded)', () => {
    const { world, attacker, target, attacks } = duel(0);
    const hpBefore = target.currentHp;
    world.applyDamage(attacker.id, target, 8, { crit: true });
    expect(attacks[0]!).toEqual({
      attackerId: attacker.id,
      targetId: target.id,
      damage: 8,
      crit: true,
    });
    expect(target.currentHp).toBe(hpBefore - 8);
  });

  it('mitigates the already crit/cover-resolved number the caller passes in', () => {
    // applyDamage rolls nothing — callers bake crit × cover into `raw`. It just
    // subtracts defense from the handed-in number, so mitigation is post-crit.
    const { world, attacker, target, attacks } = duel(4);
    const rawAfterCrit = 20; // e.g. round(10 × critMult)
    world.applyDamage(attacker.id, target, rawAfterCrit, { crit: true });
    expect(attacks[0]!.damage).toBe(rawAfterCrit - 4); // 16, well above the floor
    expect(attacks[0]!.crit).toBe(true);
  });

  it('credits the XP ledger with the mitigated (post-defense) damage', () => {
    const { world, attacker, target } = duel(3);
    world.applyDamage(attacker.id, target, 10, { crit: false });
    expect(world.damageDealtBy(attacker.id)).toBe(Math.max(STATS.minDamage, 10 - 3));
  });

  it('round-trips the defense stat through a WorldSnapshot', () => {
    const { world, target } = duel(5);
    const wire = JSON.parse(JSON.stringify(world.toJSON()));
    const restored = World.fromJSON(wire, new EventBus<GameEvents>());
    expect(restored.findUnit(target.id)!.stats.defense).toBe(5);
  });
});

describe('World.applyDamage — I2 dodge hit/miss roll', () => {
  // A 2-unit duel where the attacker's precision and the target's evasion are
  // explicit, and the World's `combatRng` is seeded directly (the 6th ctor arg)
  // so the to-hit draw is controllable. Captures BOTH the hit and miss event
  // channels.
  function evadeDuel(opts: {
    attackerPrecision: number;
    targetEvasion: number;
    combatSeed: number;
  }): {
    world: World;
    attacker: Unit;
    target: Unit;
    attacks: GameEvents['unit:attacked'][];
    misses: GameEvents['unit:missed'][];
  } {
    const bus = new EventBus<GameEvents>();
    // rng (run stream) is fixed; the combatRng we care about is seeded explicitly.
    const world = new World(bus, new RNG(1), 12, 12, undefined, new RNG(opts.combatSeed));
    const attacks: GameEvents['unit:attacked'][] = [];
    const misses: GameEvents['unit:missed'][] = [];
    bus.on('unit:attacked', (p) => attacks.push(p));
    bus.on('unit:missed', (p) => misses.push(p));

    const mk = (id: number, team: Team, precision: number, evasion: number, x: number): Unit => {
      const stats: UnitStats = {
        ...ARCHETYPE_CONFIG.mercenary.baseStats,
        defense: 0, // isolate the to-hit roll from GP2 mitigation
        precision,
        evasion,
      };
      return new Unit({
        id,
        team,
        archetype: 'mercenary',
        glyph: 'M',
        stats,
        derived: deriveStats(stats, 1),
        position: { x, y: 0 },
      });
    };
    const attacker = mk(1, 'player', opts.attackerPrecision, 0, 0);
    const target = mk(2, 'enemy', 0, opts.targetEvasion, 1);
    world.units.push(attacker, target);
    return { world, attacker, target, attacks, misses };
  }

  /** Smallest seed whose FIRST combatRng draw is ≥ `threshold` — i.e. a seed
   *  that MISSES when the hit chance equals `threshold`. Deterministic search,
   *  not a hand-computed mulberry32 value. */
  function seedThatMisses(hitChance: number): number {
    for (let s = 1; s < 100_000; s++) {
      if (new RNG(s).next() >= hitChance) return s;
    }
    throw new Error('no missing seed found');
  }

  it('a miss deals 0: no HP mutation, no XP-ledger entry, a unit:missed (not unit:attacked)', () => {
    // Evasion 99 vs precision 0 floors the hit chance; a seed whose first draw
    // clears that floor is a guaranteed miss.
    const floor = hitChanceFor(0.6, 0, 99);
    expect(floor).toBe(STATS.hitChanceFloor);
    const { world, attacker, target, attacks, misses } = evadeDuel({
      attackerPrecision: 0,
      targetEvasion: 99,
      combatSeed: seedThatMisses(floor),
    });
    const hpBefore = target.currentHp;
    world.applyDamage(attacker.id, target, 10, { crit: false, evadable: true, accuracy: 0.6 });
    expect(misses).toEqual([{ attackerId: attacker.id, targetId: target.id }]);
    expect(attacks).toHaveLength(0);
    expect(target.currentHp).toBe(hpBefore);
    expect(world.damageDealtBy(attacker.id)).toBe(0);
  });

  it('a hit lands normally: precision at the cap always connects regardless of seed', () => {
    // precision 100 vs evasion 0 → hit chance clamps to the cap (1.0); the roll
    // (always < 1) can never reach it, so the strike lands on every seed.
    expect(hitChanceFor(0.6, 100, 0)).toBe(STATS.hitChanceCap);
    const { world, attacker, target, attacks, misses } = evadeDuel({
      attackerPrecision: 100,
      targetEvasion: 0,
      combatSeed: 7,
    });
    const hpBefore = target.currentHp;
    world.applyDamage(attacker.id, target, 10, { crit: false, evadable: true, accuracy: 0.6 });
    expect(misses).toHaveLength(0);
    expect(attacks).toHaveLength(1);
    expect(attacks[0]!.damage).toBe(10);
    expect(target.currentHp).toBe(hpBefore - 10);
    expect(world.damageDealtBy(attacker.id)).toBe(10);
  });

  it('an evadable strike draws exactly one combatRng value (the to-hit roll)', () => {
    const { world, attacker, target } = evadeDuel({
      attackerPrecision: 100, // cap → hit, but the roll is still drawn
      targetEvasion: 0,
      combatSeed: 7,
    });
    const before = world.combatRng.toJSON().state;
    world.applyDamage(attacker.id, target, 10, { crit: false, evadable: true, accuracy: 0.6 });
    const sib = RNG.fromJSON({ state: before });
    sib.next(); // exactly one draw
    expect(world.combatRng.toJSON().state).toBe(sib.toJSON().state);
  });

  it('a NON-evadable hit (mage AoE / catapult / env path) is unmissable AND draws no combatRng', () => {
    // Same floor-the-hit-chance setup that guaranteed a miss above — but with
    // evadable omitted the chokepoint never rolls: the damage lands and the
    // combatRng stream is untouched.
    const { world, attacker, target, attacks, misses } = evadeDuel({
      attackerPrecision: 0,
      targetEvasion: 99,
      combatSeed: seedThatMisses(hitChanceFor(0.6, 0, 99)),
    });
    const before = world.combatRng.toJSON().state;
    const hpBefore = target.currentHp;
    world.applyDamage(attacker.id, target, 10, { crit: false, evadable: false });
    expect(world.combatRng.toJSON().state).toBe(before); // no draw
    expect(misses).toHaveLength(0);
    expect(attacks).toHaveLength(1);
    expect(target.currentHp).toBe(hpBefore - 10);
  });

  it('is deterministic per seed: the same combatSeed reproduces the same hit/miss', () => {
    const outcome = (seed: number): 'hit' | 'miss' => {
      const d = evadeDuel({ attackerPrecision: 5, targetEvasion: 5, combatSeed: seed }); // 0.6 band
      d.world.applyDamage(d.attacker.id, d.target, 10, { crit: false, evadable: true, accuracy: 0.6 });
      return d.misses.length ? 'miss' : 'hit';
    };
    for (const seed of [3, 11, 29, 101]) {
      expect(outcome(seed)).toBe(outcome(seed));
    }
  });

  it('rolls crit BEFORE the to-hit miss (combatRng order: crit → miss)', () => {
    // The crit is drawn by the strike's damage op (EffectAction → executeDamage),
    // the miss in applyDamage — so the stream order is crit, then miss. Find a
    // seed where the two draws straddle the crit threshold AND the second draw is
    // a HIT, so the crit flag is observable and DIFFERS from what a reversed
    // (miss-first) order would give.
    const critChance = 0.4;
    const hitChance = hitChanceFor(0.6, 5, 5); // 0.6, mid-band (the strike op's accuracy)
    let seed = -1;
    let expectedCrit = false;
    for (let s = 1; s < 1_000_000; s++) {
      const r = new RNG(s);
      const d1 = r.next(); // crit roll under the real (crit-first) order
      const d2 = r.next(); // to-hit roll under the real order
      if (d2 < hitChance && (d1 < critChance) !== (d2 < critChance)) {
        seed = s;
        expectedCrit = d1 < critChance;
        break;
      }
    }
    expect(seed).toBeGreaterThan(0);

    const { world, attacker, target, attacks, misses } = evadeDuel({
      attackerPrecision: 5,
      targetEvasion: 5,
      combatSeed: seed,
    });
    const before = world.combatRng.toJSON().state;
    // Y5c — the migrated strike: a single-target damage op (evadable, accuracy
    // 0.6) fires in EffectAction.start → executeDamage, which draws crit then
    // calls applyDamage (the miss roll) — the crit→miss order AttackAction had.
    const strikeDef = parseAbilityDef({
      id: 'sword', name: 'Sword', cooldownSeconds: 1.5, rangeCells: 1, target: { kind: 'enemyInRange' },
      timeline: [{ phase: 'impact', seconds: 0 }, { phase: 'recovery', seconds: 'fill' }],
      orphanPolicy: 'commit-at-cast', priority: 10,
      effects: [{ phase: 'impact', op: { kind: 'damage', scaling: 'strength', might: 0, accuracy: 0.6, critBase: 0, critable: true, evadable: true, bypassDefense: false } }],
    });
    const strike = new EffectAction(strikeDef, { targetId: target.id, ops: [{ baseDamage: 10, critChance }] });
    const strikePhases = resolvePhases(strikeDef, 0);
    attacker.activeAction = { action: strike, startTick: 0, finishTick: totalTicks(strikePhases), phases: strikePhases };
    strike.start(attacker, world);

    // Exactly two draws consumed (crit + miss), in that order.
    const sib = RNG.fromJSON({ state: before });
    sib.next();
    sib.next();
    expect(world.combatRng.toJSON().state).toBe(sib.toJSON().state);
    // It HIT (the 2nd draw was the to-hit roll), and the crit flag came from the
    // 1st draw — a reversed order would have produced the opposite crit flag.
    expect(misses).toHaveLength(0);
    expect(attacks).toHaveLength(1);
    expect(attacks[0]!.crit).toBe(expectedCrit);
  });
});

describe('World.applyDamage — M6 water bog-down (precision penalty)', () => {
  // The I2 duel shape, but the test can seat either unit on a water tile. The
  // attacker's precision is pinned to the configured penalty, so its EFFECTIVE
  // precision while wading is exactly 0 — the assertions hold for any penalty
  // value, deriving the thresholds from the config (balance-proof).
  function wadeDuel(opts: {
    attackerOnWater?: boolean;
    targetOnWater?: boolean;
    combatSeed: number;
  }): {
    world: World;
    attacker: Unit;
    target: Unit;
    attacks: GameEvents['unit:attacked'][];
    misses: GameEvents['unit:missed'][];
  } {
    const bus = new EventBus<GameEvents>();
    const world = new World(bus, new RNG(1), 12, 12, undefined, new RNG(opts.combatSeed));
    const attacks: GameEvents['unit:attacked'][] = [];
    const misses: GameEvents['unit:missed'][] = [];
    bus.on('unit:attacked', (p) => attacks.push(p));
    bus.on('unit:missed', (p) => misses.push(p));

    const mk = (id: number, team: Team, precision: number, x: number): Unit => {
      const stats: UnitStats = {
        ...ARCHETYPE_CONFIG.mercenary.baseStats,
        defense: 0, // isolate the to-hit roll from GP2 mitigation
        precision,
        evasion: 0,
      };
      return new Unit({
        id,
        team,
        archetype: 'mercenary',
        glyph: 'M',
        stats,
        derived: deriveStats(stats, 1),
        position: { x, y: 0 },
      });
    };
    // attackerPrecision = penalty → effective precision 0 while wading.
    const attacker = mk(1, 'player', STATS.waterPrecisionPenalty, 0);
    const target = mk(2, 'enemy', 0, 1);
    if (opts.attackerOnWater) world.tileGrid.setKind({ x: 0, y: 0 }, 'shallow_water');
    if (opts.targetOnWater) world.tileGrid.setKind({ x: 1, y: 0 }, 'shallow_water');
    world.units.push(attacker, target);
    return { world, attacker, target, attacks, misses };
  }

  /** Smallest seed whose FIRST combatRng draw lands in `[lo, hi)` — a draw that
   *  HITS when the hit chance is `hi` but MISSES when it is `lo`. */
  function seedInWindow(lo: number, hi: number): number {
    for (let s = 1; s < 1_000_000; s++) {
      const d = new RNG(s).next();
      if (d >= lo && d < hi) return s;
    }
    throw new Error(`no seed with first draw in [${lo}, ${hi})`);
  }

  // Dry-ground hit chance (precision = penalty) vs the wading chance (effective
  // precision 0). The mechanic is only meaningful when the penalty is positive.
  const dry = hitChanceFor(0.6, STATS.waterPrecisionPenalty, 0);
  const wet = hitChanceFor(0.6, 0, 0);

  it('the configured penalty lowers a wader’s to-hit chance', () => {
    expect(STATS.waterPrecisionPenalty).toBeGreaterThan(0);
    expect(dry).toBeGreaterThan(wet);
  });

  it('a strike that lands on dry ground MISSES when the attacker is wading', () => {
    const seed = seedInWindow(wet, dry);

    const onLand = wadeDuel({ combatSeed: seed });
    onLand.world.applyDamage(onLand.attacker.id, onLand.target, 10, {
      crit: false,
      evadable: true,
      accuracy: 0.6,
    });
    expect(onLand.misses).toHaveLength(0);
    expect(onLand.attacks).toHaveLength(1);

    const wading = wadeDuel({ attackerOnWater: true, combatSeed: seed });
    wading.world.applyDamage(wading.attacker.id, wading.target, 10, {
      crit: false,
      evadable: true,
      accuracy: 0.6,
    });
    expect(wading.misses).toHaveLength(1);
    expect(wading.attacks).toHaveLength(0);
  });

  it('the penalty is occupant-ATTACKER only: a target standing in water is hit no differently', () => {
    // Same seed/threshold as the land case; only the TARGET wades. The attacker
    // is dry, so its precision is undocked → identical outcome to dry ground.
    const seed = seedInWindow(wet, dry);
    const d = wadeDuel({ targetOnWater: true, combatSeed: seed });
    d.world.applyDamage(d.attacker.id, d.target, 10, { crit: false, evadable: true, accuracy: 0.6 });
    expect(d.misses).toHaveLength(0);
    expect(d.attacks).toHaveLength(1);
  });

  it('an unmissable strike from water ignores the penalty (no combatRng draw)', () => {
    const seed = seedInWindow(wet, dry);
    const d = wadeDuel({ attackerOnWater: true, combatSeed: seed });
    const before = d.world.combatRng.toJSON().state;
    d.world.applyDamage(d.attacker.id, d.target, 10, { crit: false, evadable: false });
    expect(d.world.combatRng.toJSON().state).toBe(before); // no draw
    expect(d.misses).toHaveLength(0);
    expect(d.attacks).toHaveLength(1);
  });
});

describe('World per-team objective (J1 → O1)', () => {
  function setup(): { world: World; bus: EventBus<GameEvents>; player: Unit; enemy: Unit } {
    const bus = new EventBus<GameEvents>();
    const rng = new RNG(1);
    const world = new World(bus, rng);
    // Behavior-less units (spawnUnit attaches none) so the selector no-ops and
    // the test controls every state change.
    const player = world.spawnUnit(rollUnit('mercenary', rng), 'player', { x: 1, y: 1 });
    const enemy = world.spawnUnit(rollUnit('mercenary', rng), 'enemy', { x: 9, y: 9 });
    return { world, bus, player, enemy };
  }

  it('both teams default to atWill (the always-present objective)', () => {
    const { world } = setup();
    expect(world.objectiveFor('player')).toEqual({ mode: 'atWill' });
    expect(world.objectiveFor('enemy')).toEqual({ mode: 'atWill' });
    // Neutrals never carry one → atWill (defensive).
    expect(world.objectiveFor('neutral')).toEqual({ mode: 'atWill' });
  });

  it('setObjective is applied at the top-of-tick drain and emits objective:set', () => {
    const { world, bus, enemy } = setup();
    const set = vi.fn();
    bus.on('objective:set', set);

    const objective = { mode: 'engage', target: { kind: 'enemy', unitId: enemy.id } } as const;
    world.enqueueCommand({ kind: 'setObjective', team: 'player', objective });
    expect(world.objectiveFor('player')).toEqual({ mode: 'atWill' }); // queued, not yet applied
    world.tick();
    expect(world.objectiveFor('player')).toEqual(objective);
    expect(set).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledWith({ team: 'player', objective });
  });

  it('drainCommands applies a queued objective + emits, WITHOUT advancing the sim (Q2: orders while parked)', () => {
    const { world, bus, enemy } = setup();
    const set = vi.fn();
    bus.on('objective:set', set);

    const objective = { mode: 'engage', target: { kind: 'enemy', unitId: enemy.id } } as const;
    world.enqueueCommand({ kind: 'setObjective', team: 'player', objective });
    const tickBefore = world.currentTick;

    world.drainCommands();
    expect(world.objectiveFor('player')).toEqual(objective); // applied — the marker can show
    expect(set).toHaveBeenCalledTimes(1);
    expect(world.currentTick).toBe(tickBefore); // the sim did NOT advance

    // The next real tick finds the queue already empty — no double-apply / re-emit.
    world.tick();
    expect(set).toHaveBeenCalledTimes(1);
    expect(world.objectiveFor('player')).toEqual(objective);
  });

  it('drainCommands on an empty queue is a no-op (no spurious emit)', () => {
    const { world, bus } = setup();
    const set = vi.fn();
    bus.on('objective:set', set);
    world.drainCommands();
    expect(set).not.toHaveBeenCalled();
    expect(world.objectiveFor('player')).toEqual({ mode: 'atWill' });
  });

  it('clearObjective reverts to atWill + emits objective:cleared, and a redundant clear is silent', () => {
    const { world, bus } = setup();
    const cleared = vi.fn();
    bus.on('objective:cleared', cleared);

    world.enqueueCommand({
      kind: 'setObjective',
      team: 'player',
      objective: { mode: 'engage', target: { kind: 'tile', cell: { x: 0, y: 0 } } },
    });
    world.tick();
    world.enqueueCommand({ kind: 'clearObjective', team: 'player' });
    world.tick();
    expect(world.objectiveFor('player')).toEqual({ mode: 'atWill' });
    expect(cleared).toHaveBeenCalledTimes(1);
    expect(cleared).toHaveBeenCalledWith({ team: 'player' });

    // Redundant clear: the real atWill→atWill transition guard means no 2nd emit.
    world.enqueueCommand({ kind: 'clearObjective', team: 'player' });
    world.tick();
    expect(cleared).toHaveBeenCalledTimes(1);
  });

  it('a tile objective persists across ticks (never auto-reverts)', () => {
    const { world } = setup();
    const objective = { mode: 'engage', target: { kind: 'tile', cell: { x: 3, y: 3 } } } as const;
    world.enqueueCommand({ kind: 'setObjective', team: 'player', objective });
    for (let i = 0; i < 11; i++) world.tick();
    expect(world.objectiveFor('player')).toEqual(objective);
  });

  it('an engage enemy objective reverts to atWill the tick its target dies (+ emits objective:cleared)', () => {
    const { world, bus, enemy } = setup();
    const cleared = vi.fn();
    bus.on('objective:cleared', cleared);

    world.enqueueCommand({
      kind: 'setObjective',
      team: 'player',
      objective: { mode: 'engage', target: { kind: 'enemy', unitId: enemy.id } },
    });
    world.tick();
    expect(world.objectiveFor('player').mode).toBe('engage');

    enemy.currentHp = 0; // the objective enemy dies
    world.tick(); // clearResolvedObjectives runs at top of tick, before the reap
    expect(world.objectiveFor('player')).toEqual({ mode: 'atWill' });
    expect(cleared).toHaveBeenCalledTimes(1);
  });

  it('an engage enemy objective set on an already-dead enemy reverts the same tick', () => {
    const { world, enemy } = setup();
    enemy.currentHp = 0;
    world.enqueueCommand({
      kind: 'setObjective',
      team: 'player',
      objective: { mode: 'engage', target: { kind: 'enemy', unitId: enemy.id } },
    });
    world.tick(); // drain sets it; clearResolvedObjectives (same tick) reverts it
    expect(world.objectiveFor('player')).toEqual({ mode: 'atWill' });
  });

  it('the enemy-team objective is real, independent storage (the O1 structural seam)', () => {
    const { world, bus, player } = setup();
    const set = vi.fn();
    bus.on('objective:set', set);

    // Set an objective on the ENEMY team targeting the player unit. Nothing in
    // production does this yet (the enemy stays atWill), but the plumbing is
    // symmetric — a future enemy strategy is a data change, not a refactor.
    const objective = { mode: 'engage', target: { kind: 'enemy', unitId: player.id } } as const;
    world.enqueueCommand({ kind: 'setObjective', team: 'enemy', objective });
    world.tick();
    expect(world.objectiveFor('enemy')).toEqual(objective);
    // Independent of the player slot (still its default).
    expect(world.objectiveFor('player')).toEqual({ mode: 'atWill' });
    expect(set).toHaveBeenCalledWith({ team: 'enemy', objective });

    // The revert-on-death scan covers BOTH teams: when the enemy objective's
    // target (the player) dies, the enemy team reverts to atWill too.
    player.currentHp = 0;
    world.tick();
    expect(world.objectiveFor('enemy')).toEqual({ mode: 'atWill' });
  });

  it('a focus enemy objective reverts to atWill the tick its target dies (mirrors engage)', () => {
    const { world, enemy } = setup();
    world.enqueueCommand({
      kind: 'setObjective',
      team: 'player',
      objective: { mode: 'focus', target: { kind: 'enemy', unitId: enemy.id } },
    });
    world.tick();
    expect(world.objectiveFor('player').mode).toBe('focus');

    enemy.currentHp = 0;
    world.tick(); // clearResolvedObjectives now covers focus enemy targets too
    expect(world.objectiveFor('player')).toEqual({ mode: 'atWill' });
  });

  it('a focus tile objective persists under the shipped default (leashAtNearest never resolves by arrival)', () => {
    const { world } = setup();
    const objective = { mode: 'focus', target: { kind: 'tile', cell: { x: 3, y: 3 } } } as const;
    world.enqueueCommand({ kind: 'setObjective', team: 'player', objective });
    for (let i = 0; i < 11; i++) world.tick();
    // leashAtNearest = the unit garrisons the tile; the focus is not auto-cleared.
    expect(world.objectiveFor('player')).toEqual(objective);
  });
});

interface DeathSceneUnit {
  team: Team;
  x: number;
  y: number;
  hp?: number;
  /** Maps to `strength` (melee) — drives basic-strike damage. */
  attackDamage?: number;
  /** Maps to `derived.attackRange` (per-archetype primitive, not a stat). */
  attackRange?: number;
  behaviors?: readonly ('movement' | 'attack')[];
}

function scene(specs: DeathSceneUnit[]): {
  world: World;
  units: Unit[];
  deaths: GameEvents['unit:died'][];
  attacks: GameEvents['unit:attacked'][];
} {
  const bus = new EventBus<GameEvents>();
  const world = new World(bus, new RNG(1));
  const deaths: GameEvents['unit:died'][] = [];
  const attacks: GameEvents['unit:attacked'][] = [];
  bus.on('unit:died', (p) => deaths.push(p));
  bus.on('unit:attacked', (p) => attacks.push(p));

  let nextId = 1;
  const units = specs.map((s) => {
    // E1: melee archetype, with `strength` set to the legacy
    // `attackDamage` knob so tests that one-shot via 999-damage attacks
    // still work. Constitution=20 → maxHp=50 (matches the pre-E1
    // hard-coded default).
    const baseMelee = ARCHETYPE_CONFIG.mercenary.baseStats;
    const stats: UnitStats = {
      ...baseMelee,
      // Default constitution=20 → derived.maxHp = 50 (round(20*2.5)).
      // No knob exposed for it here — tests use `s.hp` to override
      // currentHp post-construction.
      strength: s.attackDamage ?? baseMelee.strength,
    };
    const range = s.attackRange ?? 1;
    const derived = deriveStats(stats, range);
    const u = new Unit({
      id: nextId++,
      team: s.team,
      archetype: 'mercenary',
      glyph: 'M',
      stats,
      derived,
      position: { x: s.x, y: s.y },
    });
    if (s.hp !== undefined) u.currentHp = s.hp;
    for (const b of s.behaviors ?? []) {
      if (b === 'movement') u.behaviors.push(new MovementBehavior());
      else if (b === 'attack') {
        u.behaviors.push(new AbilityBehavior());
        u.abilities.push(createAbility('sword'));
      }
    }
    world.units.push(u);
    return u;
  });
  return { world, units, deaths, attacks };
}

// Keep imports referenced even when a specific test stops using them.
void ZERO_STATS;
