import { describe, it, expect, vi } from 'vitest';
import { World } from './World';
import { Unit, type Team, type UnitStats } from './Unit';
import { MovementBehavior } from './behaviors/MovementBehavior';
import { AbilityBehavior } from './behaviors/AbilityBehavior';
import { MeleeStrike } from './abilities/strikes';
import { AttackAction } from './actions/AttackAction';
import { EventBus } from '../core/EventBus';
import { RNG } from '../core/RNG';
import { rollUnit } from './archetypes';
import { spawnWall } from './environment';
import { FIRE_TICKS_PER_DAMAGE, HEALING_TICKS_PER_HEAL } from '../config/tiles';
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

    const a = w.spawnUnit(rollUnit('melee', rng), 'player', { x: 1, y: 2 });
    const b = w.spawnUnit(rollUnit('melee', rng), 'enemy', { x: 3, y: 4 });

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
    const m = w.spawnUnit(rollUnit('melee', rng), 'player', { x: 0, y: 0 });
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
    const a = w.spawnUnit(rollUnit('melee', rng), 'player', { x: 0, y: 0 });
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
    const survivor = w.spawnUnit(rollUnit('melee', rng), 'player', { x: 0, y: 0 }, 0);
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
    const enemy = w.spawnUnit(rollUnit('melee', rng), 'enemy', { x: 0, y: 0 });
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
    const player = w.spawnUnit(rollUnit('melee', rng), 'player', { x: 0, y: 0 }, 0);
    const enemy = w.spawnUnit(rollUnit('melee', rng), 'enemy', { x: 5, y: 5 });
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
    w.spawnUnit(rollUnit('melee', rng), 'player', { x: 0, y: 0 }, 0);
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
    w.spawnUnit(rollUnit('melee', rng), 'player', { x: 0, y: 0 });
    w.spawnUnit(rollUnit('melee', rng), 'enemy', { x: 5, y: 5 });
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
    w.spawnUnit(rollUnit('melee', rng), 'neutral', { x: 3, y: 3 });
    w.spawnUnit(rollUnit('melee', rng), 'neutral', { x: 5, y: 5 });
    const ends: GameEvents['battle:ended'][] = [];
    bus.on('battle:ended', (p) => ends.push(p));

    w.tick();

    expect(ends).toHaveLength(0);
    expect(w.ended).toBe(false);
  });

  it('ignores neutrals when scoring the win condition (player + walls = player wins)', () => {
    const bus = new EventBus<GameEvents>();
    const rng = new RNG(1);
    const w = new World(bus, rng);
    w.spawnUnit(rollUnit('melee', rng), 'player', { x: 0, y: 0 }, 0);
    w.spawnUnit(rollUnit('melee', rng), 'neutral', { x: 5, y: 5 });
    w.spawnUnit(rollUnit('melee', rng), 'neutral', { x: 7, y: 7 });
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
    w.spawnUnit(rollUnit('melee', rng), 'player', { x: 0, y: 0 });
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

describe('World D7.B tile effects', () => {
  // Spec helper: an inert enemy stationed far away keeps checkBattleEnd
  // happy so the tile-effect tests can tick freely without the battle
  // ending. The inert team has no behaviors and never moves.
  const KEEP_BATTLE_ALIVE: DeathSceneUnit = { team: 'enemy', x: 11, y: 11, hp: 50 };

  it('fire deals 1 HP damage to combatants every FIRE_TICKS_PER_DAMAGE ticks', () => {
    const { world, units } = scene([
      { team: 'player', x: 3, y: 3, hp: 50 },
      KEEP_BATTLE_ALIVE,
    ]);
    world.tileGrid.setKind({ x: 3, y: 3 }, 'fire');
    const burns: GameEvents['unit:burned'][] = [];
    (world as unknown as { bus: EventBus<GameEvents> }).bus.on('unit:burned', (p) => burns.push(p));

    // Off-cadence ticks: no damage.
    for (let t = 1; t < FIRE_TICKS_PER_DAMAGE; t++) world.tick();
    expect(units[0]!.currentHp).toBe(50);
    expect(burns).toHaveLength(0);

    // Cadence tick: 1 damage lands.
    world.tick();
    expect(units[0]!.currentHp).toBe(49);
    expect(burns).toHaveLength(1);
    expect(burns[0]).toEqual({ unitId: units[0]!.id, damage: 1 });

    // Another full cycle.
    for (let t = 0; t < FIRE_TICKS_PER_DAMAGE; t++) world.tick();
    expect(units[0]!.currentHp).toBe(48);
    expect(burns).toHaveLength(2);
  });

  it('GP2: fire damage is UNMITIGATED by defense (still exactly 1)', () => {
    // The shared scene spawns melee units, which carry the archetype's
    // defense — so this pins that environmental fire bypasses the
    // World.applyDamage mitigation chokepoint entirely (raw 1 HP, no floor).
    const { world, units } = scene([
      { team: 'player', x: 3, y: 3, hp: 50 },
      KEEP_BATTLE_ALIVE,
    ]);
    expect(units[0]!.stats.defense).toBeGreaterThan(0);
    world.tileGrid.setKind({ x: 3, y: 3 }, 'fire');
    for (let t = 0; t < FIRE_TICKS_PER_DAMAGE; t++) world.tick();
    expect(units[0]!.currentHp).toBe(49); // exactly 1 lost despite defense > 0
  });

  it('healing restores 1 HP every HEALING_TICKS_PER_HEAL ticks and clamps at maxHp', () => {
    const { world, units } = scene([
      { team: 'player', x: 3, y: 3, hp: 10 },
      KEEP_BATTLE_ALIVE,
    ]);
    world.tileGrid.setKind({ x: 3, y: 3 }, 'healing');
    const heals: GameEvents['unit:healed'][] = [];
    (world as unknown as { bus: EventBus<GameEvents> }).bus.on('unit:healed', (p) => heals.push(p));

    // One cadence tick: +1 HP.
    for (let t = 0; t < HEALING_TICKS_PER_HEAL; t++) world.tick();
    expect(units[0]!.currentHp).toBe(11);
    expect(heals).toHaveLength(1);
    // F5: a tile chip-heal has no casting unit → healerId is null, so the
    // renderer keeps it to just the `+N` (no ability heal-sparkle).
    expect(heals[0]).toEqual({ unitId: units[0]!.id, amount: 1, healerId: null });

    // Force currentHp to maxHp; next heal-tick clamps and emits
    // amount=0 (subscribers can debounce; the sim still fires for
    // observability).
    units[0]!.currentHp = units[0]!.derived.maxHp;
    for (let t = 0; t < HEALING_TICKS_PER_HEAL; t++) world.tick();
    expect(units[0]!.currentHp).toBe(units[0]!.derived.maxHp);
    expect(heals[heals.length - 1]).toEqual({ unitId: units[0]!.id, amount: 0, healerId: null });

    // F6: the per-tick regen-tile chip-heal is the *tile's* output, not a
    // unit's contribution, so it must NOT feed the utility-XP ledger (only
    // ability heals do). The unit gained HP above, yet earns no heal-XP.
    expect(world.utilityDoneBy(units[0]!.id)).toBe(0);
  });

  it('neutrals on fire/healing tiles are skipped (combatants-only policy)', () => {
    const { world } = scene([
      { team: 'player', x: 0, y: 0, hp: 50 },
      KEEP_BATTLE_ALIVE,
    ]);
    const wall = spawnWall(world, { x: 5, y: 5 });
    world.tileGrid.setKind({ x: 5, y: 5 }, 'fire');
    const startHp = wall.currentHp;
    const burns: GameEvents['unit:burned'][] = [];
    (world as unknown as { bus: EventBus<GameEvents> }).bus.on('unit:burned', (p) => burns.push(p));

    for (let t = 0; t < FIRE_TICKS_PER_DAMAGE * 3; t++) world.tick();
    expect(wall.currentHp).toBe(startHp);
    expect(burns).toHaveLength(0);
  });

  it('a fire-kill emits unit:burned + unit:died and ends the battle on the same tick', () => {
    // Player adjacent unit on healing (so the battle has both teams),
    // enemy on a fire tile with 1 HP. Fire-kill should remove the
    // enemy and end the battle this tick.
    const { world, units } = scene([
      { team: 'player', x: 0, y: 0, hp: 50 },
      { team: 'enemy', x: 5, y: 5, hp: 1 },
    ]);
    world.tileGrid.setKind({ x: 5, y: 5 }, 'fire');
    const burns: GameEvents['unit:burned'][] = [];
    const deaths: GameEvents['unit:died'][] = [];
    const ends: GameEvents['battle:ended'][] = [];
    const bus = (world as unknown as { bus: EventBus<GameEvents> }).bus;
    bus.on('unit:burned', (p) => burns.push(p));
    bus.on('unit:died', (p) => deaths.push(p));
    bus.on('battle:ended', (p) => ends.push(p));

    // Tick until the fire cadence fires.
    for (let t = 0; t < FIRE_TICKS_PER_DAMAGE; t++) world.tick();
    expect(burns).toHaveLength(1);
    expect(burns[0]!.unitId).toBe(units[1]!.id);
    expect(deaths.some((d) => d.unitId === units[1]!.id)).toBe(true);
    expect(ends).toHaveLength(1);
    expect(ends[0]!.winner).toBe('player');
    // E4 follow-up: the fire-kill scene helper spawns via the bare
    // path without rosterIndex, so the player unit doesn't land in
    // playerRosterIds and earns no XP — the scene file separately
    // pins the *award* behavior in its own roster-aware tests.
    expect(ends[0]!.xpAwards).toHaveLength(0);
  });

  it('does not apply effects to already-dead units waiting for reap', () => {
    // Force a unit's HP to 0 and ensure a fire cadence tick doesn't
    // re-burn the corpse (which would double-emit unit:burned for an
    // already-reaped id).
    const { world, units } = scene([
      { team: 'player', x: 3, y: 3, hp: 0 },
      KEEP_BATTLE_ALIVE,
    ]);
    world.tileGrid.setKind({ x: 3, y: 3 }, 'fire');
    const burns: GameEvents['unit:burned'][] = [];
    (world as unknown as { bus: EventBus<GameEvents> }).bus.on('unit:burned', (p) => burns.push(p));

    for (let t = 0; t < FIRE_TICKS_PER_DAMAGE * 2; t++) world.tick();
    // The unit gets reaped at the start of tick 1 (per-unit death
    // pass). No burn emit expected at all.
    expect(burns).toHaveLength(0);
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
      ...ARCHETYPE_CONFIG.melee.baseStats,
      defense,
    });
    const mk = (id: number, team: Team, defense: number, x: number): Unit => {
      const stats = mkStats(defense);
      return new Unit({
        id,
        team,
        archetype: 'melee',
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
        ...ARCHETYPE_CONFIG.melee.baseStats,
        defense: 0, // isolate the to-hit roll from GP2 mitigation
        precision,
        evasion,
      };
      return new Unit({
        id,
        team,
        archetype: 'melee',
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
    const floor = hitChanceFor(0, 99);
    expect(floor).toBe(STATS.hitChanceFloor);
    const { world, attacker, target, attacks, misses } = evadeDuel({
      attackerPrecision: 0,
      targetEvasion: 99,
      combatSeed: seedThatMisses(floor),
    });
    const hpBefore = target.currentHp;
    world.applyDamage(attacker.id, target, 10, { crit: false, evadable: true });
    expect(misses).toEqual([{ attackerId: attacker.id, targetId: target.id }]);
    expect(attacks).toHaveLength(0);
    expect(target.currentHp).toBe(hpBefore);
    expect(world.damageDealtBy(attacker.id)).toBe(0);
  });

  it('a hit lands normally: precision at the cap always connects regardless of seed', () => {
    // precision 100 vs evasion 0 → hit chance clamps to the cap (1.0); the roll
    // (always < 1) can never reach it, so the strike lands on every seed.
    expect(hitChanceFor(100, 0)).toBe(STATS.hitChanceCap);
    const { world, attacker, target, attacks, misses } = evadeDuel({
      attackerPrecision: 100,
      targetEvasion: 0,
      combatSeed: 7,
    });
    const hpBefore = target.currentHp;
    world.applyDamage(attacker.id, target, 10, { crit: false, evadable: true });
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
    world.applyDamage(attacker.id, target, 10, { crit: false, evadable: true });
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
      combatSeed: seedThatMisses(hitChanceFor(0, 99)),
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
      const d = evadeDuel({ attackerPrecision: 5, targetEvasion: 5, combatSeed: seed }); // 0.75 band
      d.world.applyDamage(d.attacker.id, d.target, 10, { crit: false, evadable: true });
      return d.misses.length ? 'miss' : 'hit';
    };
    for (const seed of [3, 11, 29, 101]) {
      expect(outcome(seed)).toBe(outcome(seed));
    }
  });

  it('rolls crit BEFORE the to-hit miss (combatRng order: crit → miss)', () => {
    // The crit is drawn in AttackAction.start, the miss in applyDamage — so the
    // stream order is crit, then miss. Find a seed where the two draws straddle
    // the crit threshold AND the second draw is a HIT, so the crit flag is
    // observable and DIFFERS from what a reversed (miss-first) order would give.
    const critChance = 0.4;
    const hitChance = hitChanceFor(5, 5); // 0.75, mid-band
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
    new AttackAction(target, 10, critChance).start(attacker, world);

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
    const baseMelee = ARCHETYPE_CONFIG.melee.baseStats;
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
      archetype: 'melee',
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
        u.abilities.push(new MeleeStrike());
      }
    }
    world.units.push(u);
    return u;
  });
  return { world, units, deaths, attacks };
}

// Keep imports referenced even when a specific test stops using them.
void ZERO_STATS;
