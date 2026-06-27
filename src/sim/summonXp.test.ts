import { describe, it, expect } from 'vitest';
import { World } from './World';
import { EventBus } from '../core/EventBus';
import { RNG } from '../core/RNG';
import type { GameEvents } from '../core/events';
import type { UnitStats } from './Unit';
import { LEVELING } from '../config/leveling';

/**
 * §33 — a summoned unit's damage credits its SUMMONER's XP ledger, scaled by
 * `LEVELING.summonDamageXpShare` (a summon has no roster slot, so its own tally
 * is never banked). Expectations derive from the config knob (balance-proof —
 * never the literal 0.5).
 */

const BASE: UnitStats = {
  constitution: 100, strength: 0, ranged: 0, magic: 0, luck: 0, defense: 0,
  precision: 0, evasion: 0, speed: 0, mobility: 0, power: 1,
};

function setup() {
  const bus = new EventBus<GameEvents>();
  const world = new World(bus, new RNG(1));
  const summoner = world.spawnUnit({ archetype: 'shaman', level: 1, stats: BASE, xp: 0 }, 'player', { x: 0, y: 0 });
  const enemy = world.spawnUnit({ archetype: 'bandit', level: 1, stats: BASE, xp: 0 }, 'enemy', { x: 5, y: 5 });
  const ghoul = world.spawnSummon('ghoul', 1, 'player', { x: 1, y: 0 }, summoner.id);
  return { world, summoner, enemy, ghoul };
}

describe('§33 summon damage → summoner XP ledger', () => {
  it("credits the summoner a config-scaled share of the summon's damage", () => {
    const { world, summoner, enemy, ghoul } = setup();
    const dmg = 10;
    world.recordDamage(ghoul.id, enemy, dmg);

    const expected = Math.round(dmg * LEVELING.summonDamageXpShare);
    expect(world.damageDealtBy(summoner.id)).toBe(expected);
    // The minion's own tally stays empty — the credit was redirected.
    expect(world.damageDealtBy(ghoul.id)).toBe(0);
  });

  it('leaves a non-summon attacker crediting itself in full', () => {
    const { world, summoner, enemy } = setup();
    world.recordDamage(summoner.id, enemy, 7); // summoner's OWN (direct) damage
    expect(world.damageDealtBy(summoner.id)).toBe(7);
  });

  it('accumulates across multiple summon hits', () => {
    const { world, summoner, enemy, ghoul } = setup();
    world.recordDamage(ghoul.id, enemy, 4);
    world.recordDamage(ghoul.id, enemy, 6);
    const expected =
      Math.round(4 * LEVELING.summonDamageXpShare) + Math.round(6 * LEVELING.summonDamageXpShare);
    expect(world.damageDealtBy(summoner.id)).toBe(expected);
  });
});
