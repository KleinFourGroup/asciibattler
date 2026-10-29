/**
 * The conversion that replaced the hit roll, pinned against a derivation the
 * game does not consult. When every strike began to land, the config took new
 * numbers so each unit's damage a second stays roughly where the roll had it:
 * the inputs are `strike-conversion.before.json`, the numbers the roll was
 * balanced on (frozen at `a042bf2c`) and each unit's hit rate in play under it
 * (BALANCE.md's run log, 2026-10-28, 400 seeds a bot). The rules, signed by
 * the user:
 *
 * - A dodgeable weapon's might times its wielders' pooled rate (by strikes),
 *   rounded. The sword is the mercenary's and the prodigy's.
 * - The unit's strength or ranged, whichever the weapon scales on, takes the
 *   rest of its rounded strike: `round((might + stat) × rate) − might'`, so a
 *   base strike lands within half a point of the exact conversion. Its growth
 *   is times the rate, to two decimals.
 * - Defense, base and growth, times the rate over every strike: with every
 *   strike landing, defense bites on each swing.
 * - The buffs' strength, ranged and defense adds times the rate over every
 *   strike, since a buff lands on any unit; magic, which feeds spells, and a
 *   +1 that cannot scale in whole numbers are left.
 *
 * Every other number the conversion could touch is held to its frozen value.
 * A later signed change to a converted number goes in `DEPARTURES` with where
 * it was signed; the retune of Round 11 retires this file.
 *
 * The defense rule above makes every swing pay the pooled rate's share of
 * the target's defense, where a swing under the roll paid its attacker's own,
 * so units that had hit often struck harder than before and units that had
 * hit rarely struck softer. The departures move a unit's base strength or
 * ranged by whole points until its damage a swing in play sits within a
 * tenth of the roll's, or at the nearer whole point, with no base strike
 * under 1 (BALANCE.md's run log, 2026-10-29, both entries).
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path: string): any => JSON.parse(readFileSync(join(ROOT, path), 'utf8')); // eslint-disable-line @typescript-eslint/no-explicit-any

interface Before {
  rates: Record<string, { weapon: string; rate: number; strikes: number }>;
  pooledRate: number;
  units: Record<string, { base: Record<'strength' | 'ranged' | 'defense', number>; growth: Record<'strength' | 'ranged' | 'defense', number> }>;
  weapons: Record<string, { scaling: 'strength' | 'ranged'; might: number }>;
  buffs: Record<string, Record<string, { add: number }>>;
}

const BEFORE = read('tests/strike-conversion.before.json') as Before;
const UNITS = read('config/units.json');
const ABILITIES = read('config/abilities.json');
const PACKETS = read('config/packets.json');
const DAEMONS = read('config/daemons.json');
const STATUSES = read('config/statuses.json');

/** Signed moves of a converted number after the conversion, as
 *  `'<file>:<path>': value`, each with where it was signed. */
const DEPARTURES: Record<string, number> = {
  // Signed at §139's kickoff (2026-10-29), placed by the swing read, 139b.
  'units:rogue.baseStats.strength': 3,
  'units:luminant.baseStats.ranged': 3,
  'units:archer.baseStats.ranged': 3,
  'units:adventurer.baseStats.strength': 3,
  'units:ghoul.baseStats.strength': 0,
  'units:bandit.baseStats.strength': 2,
  'units:gunslinger.baseStats.ranged': 2,
};

const round2 = (x: number): number => Math.round(x * 100) / 100;
const P = BEFORE.pooledRate;

/** The expected config: the rules' numbers with the departures over them. */
function derive(): Record<string, number> {
  return { ...deriveRules(), ...DEPARTURES };
}

/** The rules' numbers, from the frozen numbers and the rates alone. */
function deriveRules(): Record<string, number> {
  const out: Record<string, number> = {};
  const pooled: Record<string, { hits: number; strikes: number }> = {};
  for (const { weapon, rate, strikes } of Object.values(BEFORE.rates)) {
    const p = (pooled[weapon] ??= { hits: 0, strikes: 0 });
    p.hits += rate * strikes;
    p.strikes += strikes;
  }
  const might: Record<string, number> = {};
  for (const [weapon, p] of Object.entries(pooled)) {
    might[weapon] = Math.round(BEFORE.weapons[weapon]!.might * (p.hits / p.strikes));
    out[`abilities:${weapon}.might`] = might[weapon];
  }
  for (const [unit, u] of Object.entries(BEFORE.units)) {
    for (const stat of ['strength', 'ranged'] as const) {
      out[`units:${unit}.baseStats.${stat}`] = u.base[stat];
      out[`units:${unit}.growthRates.${stat}`] = u.growth[stat];
    }
    out[`units:${unit}.baseStats.defense`] = Math.round(u.base.defense * P);
    out[`units:${unit}.growthRates.defense`] = round2(u.growth.defense * P);
  }
  for (const [unit, { weapon, rate }] of Object.entries(BEFORE.rates)) {
    const w = BEFORE.weapons[weapon]!;
    const u = BEFORE.units[unit]!;
    out[`units:${unit}.baseStats.${w.scaling}`] = Math.round((w.might + u.base[w.scaling]) * rate) - might[weapon]!;
    out[`units:${unit}.growthRates.${w.scaling}`] = round2(u.growth[w.scaling] * rate);
  }
  for (const [key, mods] of Object.entries(BEFORE.buffs)) {
    for (const [stat, { add }] of Object.entries(mods)) {
      const scales = (stat === 'strength' || stat === 'ranged' || stat === 'defense') && add !== 1;
      out[`buffs:${key}.${stat}`] = scales ? Math.round(add * P) : add;
    }
  }
  return out;
}

/** The shipped config, read raw at the same keys. */
function shipped(keys: string[]): Record<string, number> {
  const buffMods = (key: string): Record<string, { add: number }> => {
    const [file, id] = key.split('/') as [string, string];
    if (file === 'packets') return PACKETS.packets.find((p: { id: string }) => p.id === id).effect.buff.mods;
    if (file === 'daemons') {
      const d = DAEMONS.daemons.find((x: { id: string }) => x.id === id);
      return d.rules.find((r: { effect?: { buff?: unknown } }) => r.effect?.buff).effect.buff.mods;
    }
    return STATUSES[id].statMods;
  };
  const out: Record<string, number> = {};
  for (const key of keys) {
    const [file, path] = key.split(':') as [string, string];
    if (file === 'abilities') {
      const [id] = path.split('.') as [string];
      out[key] = ABILITIES[id].effects.find((e: { op: { kind: string } }) => e.op.kind === 'damage').op.might;
    } else if (file === 'units') {
      const [id, block, stat] = path.split('.') as [string, string, string];
      out[key] = UNITS[id][block][stat];
    } else {
      const dot = path.lastIndexOf('.');
      out[key] = buffMods(path.slice(0, dot))[path.slice(dot + 1)]!.add;
    }
  }
  return out;
}

describe('the conversion from the hit roll (every strike lands)', () => {
  const expected = derive();

  it('the frozen inputs cover the twelve weapons, thirteen wielders and every combatant', () => {
    expect(Object.keys(BEFORE.weapons)).toHaveLength(12);
    expect(Object.keys(BEFORE.rates)).toHaveLength(13);
    const combatants = Object.keys(UNITS).filter((id) => UNITS[id].baseStats);
    expect(Object.keys(BEFORE.units).sort()).toEqual(combatants.sort());
  });

  it('each converted number is the derivation, and every other is its frozen value', () => {
    expect(shipped(Object.keys(expected))).toEqual(expected);
  });

  it('spot checks of the rules worked by hand: the mercenary 3 + 3, the bandit 1 + 1, defense 4 to 2, a buff 8 to 4', () => {
    const rules = deriveRules();
    expect(rules['abilities:sword.might']).toBe(3);
    expect(rules['units:mercenary.baseStats.strength']).toBe(3);
    expect(rules['abilities:club.might']).toBe(1);
    expect(rules['units:bandit.baseStats.strength']).toBe(1);
    expect(rules['units:mercenary.baseStats.defense']).toBe(2);
    expect(rules['buffs:packets/hype.strength']).toBe(4);
    expect(rules['buffs:packets/hype.magic']).toBe(8);
    expect(rules['buffs:statuses/emboldened.strength']).toBe(1);
  });

  it('each departure moves a base strength or ranged the rules derive, by whole points, and keeps the strike at 1 or more', () => {
    const rules = deriveRules();
    for (const [key, value] of Object.entries(DEPARTURES)) {
      expect(key, key).toMatch(/^units:\w+\.baseStats\.(strength|ranged)$/);
      expect(rules, key).toHaveProperty([key]);
      expect(Number.isInteger(value) && value !== rules[key], key).toBe(true);
      const [, unit] = /^units:(\w+)\./.exec(key)!;
      const { weapon } = BEFORE.rates[unit!]!;
      expect(rules[`abilities:${weapon}.might`]! + value, key).toBeGreaterThanOrEqual(1);
    }
  });

  it('nothing carries a precision, an evasion or an accuracy any more', () => {
    for (const [id, u] of Object.entries(UNITS) as [string, { baseStats?: object; growthRates?: object }][]) {
      if (!u.baseStats) continue;
      for (const key of ['precision', 'evasion']) {
        expect(u.baseStats, `${id}.baseStats`).not.toHaveProperty(key);
        expect(u.growthRates, `${id}.growthRates`).not.toHaveProperty(key);
      }
    }
    expect(JSON.stringify(ABILITIES)).not.toContain('"accuracy"');
    expect(JSON.stringify(STATUSES)).not.toContain('"accuracy"');
  });
});
