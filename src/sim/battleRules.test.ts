import { describe, it, expect } from 'vitest';
import { World } from './World';
import { EventBus } from '../core/EventBus';
import { RNG } from '../core/RNG';
import { rollUnit } from './archetypes';
import { statusDef } from '../config/statuses';
import type { BattleRule } from './battleRules';
import type { GameEvents } from '../core/events';
import type { Unit } from './Unit';

/**
 * 47f — the battle-domain daemon rules: install → trigger evaluation →
 * tally/status execution → serialization round-trip. Bespoke rule literals
 * (the daemon.test.ts fixture pattern); the launch evaluation semantics
 * (player-team acting only, filter-before-chance, status-on-actor) are each
 * pinned here.
 */

const BITS_ON_HIT: BattleRule = { on: 'dealHit', effect: { op: 'gainBits', amount: 1 } };
const ROGUE_BITS: BattleRule = {
  on: 'dealHit',
  filter: { archetype: 'rogue' },
  effect: { op: 'gainBits', amount: 1 },
};
const CRIT_EMBOLDEN: BattleRule = {
  on: 'dealHit',
  filter: { crit: true },
  effect: { op: 'applyStatus', statusId: 'emboldened' },
};
const KILL_BOUNTY: BattleRule = { on: 'kill', effect: { op: 'gainBits', amount: 5 } };

interface Scene {
  world: World;
  bus: EventBus<GameEvents>;
  player: Unit;
  rogue: Unit;
  enemy: Unit;
}

/** A world with the given rules installed + three combatants (a mercenary,
 *  a rogue, and an enemy) far enough apart that nothing acts on its own —
 *  every hit in these tests is a direct `applyDamage` call. */
function scene(rules: readonly BattleRule[]): Scene {
  const bus = new EventBus<GameEvents>();
  const rng = new RNG(1);
  const world = new World(bus, rng);
  world.installBattleRules(rules);
  const player = world.spawnUnit(rollUnit('mercenary', rng), 'player', { x: 0, y: 0 });
  const rogue = world.spawnUnit(rollUnit('rogue', rng), 'player', { x: 0, y: 11 });
  const enemy = world.spawnUnit(rollUnit('mercenary', rng), 'enemy', { x: 11, y: 11 });
  return { world, bus, player, rogue, enemy };
}

describe('registerBattleRules — evaluation semantics', () => {
  it('a dealHit rule tallies for a PLAYER attacker only (the player-relic gate)', () => {
    const { world, player, enemy } = scene([BITS_ON_HIT]);
    world.applyDamage(player.id, enemy, 3, { crit: false });
    expect(world.bitsTallied()).toBe(1);
    // The enemy hitting back earns the player nothing.
    world.applyDamage(enemy.id, player, 3, { crit: false });
    expect(world.bitsTallied()).toBe(1);
  });

  it('the archetype filter names the ACTING unit (Laverna: rogue blows only)', () => {
    const { world, player, rogue, enemy } = scene([ROGUE_BITS]);
    world.applyDamage(player.id, enemy, 3, { crit: false });
    expect(world.bitsTallied()).toBe(0);
    world.applyDamage(rogue.id, enemy, 3, { crit: false });
    expect(world.bitsTallied()).toBe(1);
  });

  it('the crit filter gates on the resolved flag; the status lands on the ACTOR (Fortuna)', () => {
    const { world, player, enemy } = scene([CRIT_EMBOLDEN]);
    const baseStrength = player.effectiveStats.strength;
    world.applyDamage(player.id, enemy, 3, { crit: false });
    expect(player.effects).toHaveLength(0);
    world.applyDamage(player.id, enemy, 3, { crit: true });
    expect(player.effects.map((e) => e.key)).toEqual(['emboldened']);
    // The def's statMods fold into effectiveStats (the 47f authoring axis).
    const mod = statusDef('emboldened').statMods!.strength!.add!;
    expect(player.effectiveStats.strength).toBe(baseStrength + mod);
    // The target is untouched.
    expect(enemy.effects).toHaveLength(0);
  });

  it('a kill rule pays on the lethal blow only', () => {
    const { world, player, enemy } = scene([KILL_BOUNTY]);
    world.applyDamage(player.id, enemy, 1, { crit: false });
    expect(world.bitsTallied()).toBe(0);
    world.applyDamage(player.id, enemy, 10_000, { crit: false, bypassDefense: true });
    expect(world.bitsTallied()).toBe(5);
  });

  it('rules accumulate: two bits rules on one hit both pay, in installed order', () => {
    const { world, rogue, enemy } = scene([BITS_ON_HIT, ROGUE_BITS]);
    world.applyDamage(rogue.id, enemy, 3, { crit: false });
    expect(world.bitsTallied()).toBe(2);
  });

  it('a chance-less rule costs NO combatRng draw; a failed filter costs none either', () => {
    const { world, player, rogue, enemy } = scene([ROGUE_BITS, CRIT_EMBOLDEN]);
    const before = world.combatRng.toJSON();
    world.applyDamage(player.id, enemy, 3, { crit: false }); // both filters fail
    world.applyDamage(rogue.id, enemy, 3, { crit: true }); // both fire, chance-less
    expect(world.combatRng.toJSON()).toEqual(before);
  });

  it('a 0<chance<1 rule draws exactly once per matching firing, off combatRng', () => {
    const coin: BattleRule = { on: 'dealHit', chance: 0.5, effect: { op: 'gainBits', amount: 1 } };
    const outcomes = new Set<number>();
    for (let seed = 0; seed < 20; seed++) {
      const bus = new EventBus<GameEvents>();
      const rng = new RNG(seed);
      const world = new World(bus, rng);
      world.installBattleRules([coin]);
      const player = world.spawnUnit(rollUnit('mercenary', rng), 'player', { x: 0, y: 0 });
      const enemy = world.spawnUnit(rollUnit('mercenary', rng), 'enemy', { x: 11, y: 11 });
      const manual = RNG.fromJSON(world.combatRng.toJSON());
      world.applyDamage(player.id, enemy, 3, { crit: false });
      // Exactly the one draw, and the flip decides the tally.
      expect(world.bitsTallied()).toBe(manual.next() < 0.5 ? 1 : 0);
      expect(world.combatRng.toJSON()).toEqual(manual.toJSON());
      outcomes.add(world.bitsTallied());
    }
    expect(outcomes).toEqual(new Set([0, 1]));
  });
});

describe('installBattleRules — the install contract', () => {
  it('an unknown applyStatus ref throws at INSTALL time, never mid-tick', () => {
    const world = new World(new EventBus<GameEvents>(), new RNG(1));
    expect(() =>
      world.installBattleRules([
        { on: 'dealHit', effect: { op: 'applyStatus', statusId: 'no-such-status' } },
      ]),
    ).toThrow(/unknown status id 'no-such-status'/);
  });

  it('a second install throws (rules are per-battle constants)', () => {
    const world = new World(new EventBus<GameEvents>(), new RNG(1));
    world.installBattleRules([BITS_ON_HIT]);
    expect(() => world.installBattleRules([BITS_ON_HIT])).toThrow(/already installed/);
  });

  it('an empty install is a free no-op (the daemon-less common case)', () => {
    const world = new World(new EventBus<GameEvents>(), new RNG(1));
    world.installBattleRules([]);
    world.installBattleRules([]); // still fine — nothing was installed
    expect(world.bitsTallied()).toBe(0);
  });
});

describe('serialization (WorldSnapshot v33)', () => {
  it('battle:ended carries a COPY of the tally', () => {
    const { world, bus, player, enemy } = scene([BITS_ON_HIT]);
    const payloads: GameEvents['battle:ended'][] = [];
    bus.on('battle:ended', (p) => payloads.push(p));
    world.applyDamage(player.id, enemy, 3, { crit: false });
    world.resolveAsDraw();
    expect(payloads).toHaveLength(1);
    expect(payloads[0]!.tallies).toEqual({ bits: 1 });
    // A copy, not the live accumulator.
    world.tallyBits(99);
    expect(payloads[0]!.tallies).toEqual({ bits: 1 });
  });

  it('rules + an in-flight tally round-trip, and the restored world still evaluates', () => {
    const { world, player, enemy } = scene([BITS_ON_HIT, CRIT_EMBOLDEN]);
    world.applyDamage(player.id, enemy, 3, { crit: false });
    expect(world.bitsTallied()).toBe(1);

    const wire = JSON.parse(JSON.stringify(world.toJSON()));
    expect(wire.tallies).toEqual({ bits: 1 });
    expect(wire.battleRules).toHaveLength(2);

    const restored = World.fromJSON(wire, new EventBus<GameEvents>());
    expect(restored.bitsTallied()).toBe(1);
    // The handlers re-registered from the data (the K1 behavior-registry
    // pattern) — a post-restore hit still tallies and still emboldens.
    const rPlayer = restored.findUnit(player.id)!;
    const rEnemy = restored.findUnit(enemy.id)!;
    restored.applyDamage(rPlayer.id, rEnemy, 3, { crit: true });
    expect(restored.bitsTallied()).toBe(2);
    expect(rPlayer.effects.map((e) => e.key)).toEqual(['emboldened']);
  });

  it('a stale (v-1) snapshot is rejected', () => {
    const { world } = scene([BITS_ON_HIT]);
    const wire = JSON.parse(JSON.stringify(world.toJSON()));
    const stale = { ...wire, schemaVersion: wire.schemaVersion - 1 };
    expect(() => World.fromJSON(stale, new EventBus<GameEvents>())).toThrow(
      /unsupported schema version/,
    );
  });
});
