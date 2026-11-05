/**
 * The stat sheet's model (`tools/stat-sheet/model.ts`) against the raw
 * config. Each expectation is worked here from the JSON files as written,
 * not through the zod-parsed config or the game's helpers the model calls,
 * so a model that agreed with itself but not with the rules would fail.
 * The rules worked here are the sim's: a strike's base is the weapon's
 * might plus its scaling stat; a crit, with chance `critBase + luck ×
 * critPerLuck` capped at `critCap`, multiplies it by `critMult`; then the
 * target's defense comes off, floored at `minDamage`, unless the op
 * bypasses defense (`src/sim/effects/interpreter.ts`, `World.dealDamage`).
 * The cadence is `max(1, round(cooldown × max(minScale, 1 − speed × perStat)
 * × 20))` ticks when the ability is speed-scaled.
 *
 * Each planted rule below (the floor dropped, the defense taken before the
 * crit, the crit left out) must disagree with the worked rule on at least
 * one of the cases, so the cases can catch the model making that mistake.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  expectedDps,
  expectedStrike,
  maxHpOf,
  statsAt,
  strikePeriodSeconds,
  weaponOf,
} from '../../tools/stat-sheet/model';
import { fieldedEnemies, fightWaves, turnsFor } from '../../tools/stat-sheet/enemies';
import { DotTrack, duel, ranks, timeline, weaponTable } from '../../tools/stat-sheet/duel';
import { placeOf, shade } from '../../tools/stat-sheet/colour';
import { World } from '../../src/sim/World';
import { Unit } from '../../src/sim/Unit';
import { EventBus } from '../../src/core/EventBus';
import { RNG } from '../../src/core/RNG';
import { deriveStats } from '../../src/sim/stats';
import { ARCHETYPE_CONFIG } from '../../src/sim/archetypes';
import { STATUS_DEFS } from '../../src/config/statuses';
import type { GameEvents } from '../../src/core/events';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const raw = (path: string): any => JSON.parse(readFileSync(fileURLToPath(new URL(`../../${path}`, import.meta.url)), 'utf8'));
const UNITS = raw('config/units.json');
const ABILITIES = raw('config/abilities.json');
const STATS = raw('config/stats.json');
const ENCOUNTERS = raw('config/encounters.json');
const SECTORS = raw('config/sectors.json');
const SHEET = raw('tests/fuzz/board/signed-sheet.json');
const HAND: number = raw('config/deck.json').handSize;

type Stats = Record<string, number>;
interface RawOp {
  kind: string;
  scaling: 'strength' | 'ranged' | 'magic' | 'none';
  might: number;
  critBase: number;
  critable: boolean;
  bypassDefense: boolean;
}

const combatants = Object.entries(UNITS).filter(([, u]) => (u as { baseStats?: unknown }).baseStats) as [
  string,
  { abilities: string[]; baseStats: Stats; growthRates: Stats },
][];

function damageOp(abilityId: string): RawOp | undefined {
  const op = ABILITIES[abilityId].effects.map((e: { op: RawOp }) => e.op).find((o: RawOp) => o.kind === 'damage');
  return op;
}

/** The rule, worked from the raw files. `variant` plants a mistake. */
function workedStrike(
  attacker: Stats,
  abilityId: string,
  defense: number,
  variant: 'rule' | 'no-floor' | 'defense-first' | 'no-crit' = 'rule',
): number {
  const op = damageOp(abilityId)!;
  const base = op.might + (op.scaling === 'none' ? 0 : attacker[op.scaling]!);
  const p = op.critable ? Math.min(STATS.critCap, Math.max(0, op.critBase + attacker.luck! * STATS.critPerLuck)) : 0;
  const floor = variant === 'no-floor' ? -Infinity : STATS.minDamage;
  const hit = (x: number): number => (op.bypassDefense ? x : Math.max(floor, x - defense));
  const normal = hit(base);
  const crit = variant === 'defense-first' ? hit(base) * STATS.critMult : hit(base * STATS.critMult);
  return variant === 'no-crit' ? normal : (1 - p) * normal + p * crit;
}

function workedPeriodSeconds(abilityId: string, speed: number): number {
  const a = ABILITIES[abilityId];
  const scale = Math.max(STATS.speedMinCdScale, 1 - speed * STATS.speedCdPerStat);
  const ticks = a.speedScaled === false ? Math.max(1, Math.round(a.cooldownSeconds * 20)) : Math.max(1, Math.round(a.cooldownSeconds * scale * 20));
  return ticks / 20;
}

// The cases: every armed combatant at level 1 and at level 8 as an enemy,
// against defenses 0 to 12, which reach past every weapon's base so the
// floor is met.
const DEFENSES = [0, 1, 2, 3, 5, 8, 12];
const cases = combatants.flatMap(([id, u]) => {
  const weapon = u.abilities.find((a) => damageOp(a) !== undefined);
  return weapon ? [{ id, weapon }] : [];
});

describe('the stat sheet model: stats at a level', () => {
  it('a player unit takes base + growth × (level − 1), unrounded', () => {
    for (const [id, u] of combatants) {
      for (const level of [1, 2, 7, 15]) {
        const got = statsAt(id, level, 'player');
        for (const key of Object.keys(u.baseStats)) {
          expect(got[key as keyof typeof got], `${id} L${level} ${key}`).toBeCloseTo(
            u.baseStats[key]! + u.growthRates[key]! * (level - 1),
            10,
          );
        }
      }
    }
  });

  it('an enemy takes base + round(growth × (level − 1))', () => {
    for (const [id, u] of combatants) {
      for (const level of [1, 4, 9]) {
        const got = statsAt(id, level, 'enemy');
        for (const key of Object.keys(u.baseStats)) {
          expect(got[key as keyof typeof got], `${id} L${level} ${key}`).toBe(
            u.baseStats[key]! + Math.round(u.growthRates[key]! * (level - 1)),
          );
        }
      }
    }
  });

  it('hit points are constitution times hpPerConstitution', () => {
    for (const [id, u] of combatants) {
      expect(maxHpOf(statsAt(id, 1, 'enemy')), id).toBe(Math.max(1, STATS.hpPerConstitution * u.baseStats.constitution!));
    }
  });

  it('the crit multiplier is whole, so leaving out the game round of base × critMult changes nothing on whole stats', () => {
    expect(Number.isInteger(STATS.critMult)).toBe(true);
  });
});

describe('the stat sheet model: a strike', () => {
  it('each armed combatant has a weapon, the one damage ability', () => {
    expect(cases.length).toBeGreaterThan(20);
    for (const { id, weapon } of cases) expect(weaponOf(id), id).toBe(weapon);
  });

  it('expected damage a strike matches the rule worked from the raw config', () => {
    for (const { id, weapon } of cases) {
      for (const level of [1, 8]) {
        const s = statsAt(id, level, 'enemy');
        for (const d of DEFENSES) {
          expect(expectedStrike(s, weapon, d), `${id} L${level} vs def ${d}`).toBeCloseTo(
            workedStrike(s as unknown as Stats, weapon, d),
            10,
          );
        }
      }
    }
  });

  it('the period and the damage a second match the cadence worked from the raw config', () => {
    for (const { id, weapon } of cases) {
      const s = statsAt(id, 1, 'enemy');
      expect(strikePeriodSeconds(weapon, s.speed), id).toBeCloseTo(workedPeriodSeconds(weapon, s.speed), 10);
      expect(expectedDps(s, weapon, 2), id).toBeCloseTo(workedStrike(s as unknown as Stats, weapon, 2) / workedPeriodSeconds(weapon, s.speed), 10);
    }
    // The flat cadence: the dash ignores speed.
    expect(strikePeriodSeconds('dash', 20)).toBeCloseTo(workedPeriodSeconds('dash', 20), 10);
  });

  it('the cases catch each planted mistake', () => {
    for (const variant of ['no-floor', 'defense-first', 'no-crit'] as const) {
      const caught = cases.some(({ id, weapon }) =>
        DEFENSES.some((d) => {
          const s = statsAt(id, 1, 'enemy') as unknown as Stats;
          return Math.abs(workedStrike(s, weapon, d, variant) - workedStrike(s, weapon, d)) > 1e-9;
        }),
      );
      expect(caught, variant).toBe(true);
    }
  });
});

describe('the stat sheet model: the enemies', () => {
  it("a fight of a kind is its signed turn band's midpoint, rounded", () => {
    for (const kind of ['normal', 'elite', 'boss'] as const) {
      const band = SHEET.pacingBands[kind];
      expect(turnsFor(kind), kind).toBe(Math.round((band.min + band.max) / 2));
    }
  });

  it("the wolfpack's waves: round(factor × hand) bodies, levels summing to round(budget factor × level × hand), at least 1 each", () => {
    // Worked from the raw file: the wolfpack loops one wave of wolves.
    const enc = ENCOUNTERS.find((e: { id: string }) => e.id === 'wolfpack');
    expect(enc.waves[0].kind).toBe('loop');
    const spec = enc.waves[0].body[0].spec;
    for (const level of [1, 3, 7]) {
      const n = Math.round(spec.count.factor * HAND);
      const budget = Math.round(spec.levelBudget.factor * level * HAND);
      for (let seed = 1; seed <= 5; seed++) {
        for (const wave of fightWaves('wolfpack', 'normal', level, seed)) {
          const levels = wave.map((u) => u.level);
          expect(wave.length, `L${level} seed ${seed}`).toBe(n);
          expect(wave.every((u) => u.archetype === 'wolf')).toBe(true);
          expect(levels.reduce((s, l) => s + l, 0), `L${level} seed ${seed}`).toBe(Math.max(n, budget));
          expect(Math.max(...levels) - Math.min(...levels)).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it("act 1's normals field exactly the archetypes its normal encounters name, shares summing to 1", () => {
    const sector = SECTORS.find((s: { id: string }) => s.id === 'the-periphery');
    const named = new Set<string>(
      sector.encounters.normal.flatMap((entry: { encounterId: string }) =>
        [...JSON.stringify(ENCOUNTERS.find((e: { id: string }) => e.id === entry.encounterId).waves).matchAll(/"archetype":"([^"]+)"/g)].map(
          (m) => m[1]!,
        ),
      ),
    );
    const rows = fieldedEnemies('the-periphery', 'normal', 3, { seeds: 20 });
    expect(rows.reduce((s, r) => s + r.share, 0)).toBeCloseTo(1, 10);
    expect(new Set(rows.map((r) => r.archetype))).toEqual(named);
  });
});

/** The sim's own damage-over-time ticks on an inert unit, a tick at a time:
 *  the status put on before the first tick, and again after `again` ticks
 *  if given (as `statusPeriodic.test.ts` builds its world). */
function simDotTicks(statusId: string, ticks: number, again?: number): number[] {
  const bus = new EventBus<GameEvents>();
  const world = new World(bus, new RNG(1));
  const mk = (id: number, team: 'player' | 'enemy', x: number, y: number): Unit => {
    const stats = { ...ARCHETYPE_CONFIG.mercenary.baseStats, constitution: 999 };
    const u = new Unit({ id, team, archetype: 'mercenary', glyph: 'M', stats, derived: deriveStats(stats, 1), position: { x, y } });
    world.placeUnits(u);
    return u;
  };
  const victim = mk(1, 'player', 1, 1);
  mk(2, 'enemy', 11, 11);
  let amount = 0;
  bus.on('status:ticked', (e) => {
    amount += e.amount;
  });
  const out: number[] = [];
  world.applyStatusEffect(victim, STATUS_DEFS[statusId]!, null);
  for (let n = 1; n <= ticks; n++) {
    amount = 0;
    world.tick();
    out.push(amount);
    if (n === again) world.applyStatusEffect(victim, STATUS_DEFS[statusId]!, null);
  }
  return out;
}

function trackDotTicks(statusId: string, ticks: number, again?: number): number[] {
  const def = STATUS_DEFS[statusId]!;
  const dur = Math.round(def.durationSeconds * 20);
  const track = new DotTrack();
  track.put(statusId, 1, dur, 0);
  const out: number[] = [];
  for (let n = 1; n <= ticks; n++) {
    track.expire(n);
    out.push(track.tickDamage(n, 0));
    if (n === again) track.put(statusId, 1, dur, n);
  }
  return out;
}

describe('the stat sheet model: the duel', () => {
  const DOTS = Object.values(STATUS_DEFS).filter((d) => d.periodic?.op.kind === 'damage').map((d) => d.id);

  it('the damage-over-time ticks match the sim tick for tick, once and re-applied', () => {
    expect(DOTS.sort()).toEqual(['bleed', 'burn', 'poison']);
    for (const id of DOTS) {
      expect(trackDotTicks(id, 240), `${id} once`).toEqual(simDotTicks(id, 240));
      expect(trackDotTicks(id, 240, 30), `${id} again at 30`).toEqual(simDotTicks(id, 240, 30));
    }
    // The count the kickoff left open: a 4 s burn ticking each second.
    expect(simDotTicks('burn', 240).filter((x) => x > 0)).toHaveLength(3);
  });

  it('a duel without riders: the k-th strike, from the first tick, kills at k = ceil(hp ÷ strike)', () => {
    const me = { archetype: 'mercenary', level: 1, stats: statsAt('mercenary', 1, 'player') };
    const foe = { archetype: 'wolf', level: 1, stats: statsAt('wolf', 1, 'enemy') };
    const s = workedStrike(me.stats as unknown as Stats, 'sword', foe.stats.defense);
    const k = Math.ceil(UNITS.wolf.baseStats.constitution / s);
    const t = timeline(me, foe);
    expect(t.ttkSeconds).toBeCloseTo((k - 1) * workedPeriodSeconds('sword', me.stats.speed), 10);
    // With no rider, the duel's damage a second is the standing one.
    expect(t.dps).toBeCloseTo(s / workedPeriodSeconds('sword', me.stats.speed), 10);
  });

  it('a duel row reads both ways, its shares summing to 1', () => {
    const d = duel('mercenary', 3, 'the-periphery', 'normal', { seeds: 20 });
    expect(d.rows.reduce((s, r) => s + r.share, 0)).toBeCloseTo(1, 10);
    expect(d.unit.weapon).toBe('sword');
    expect(d.dpsDealt).toBeGreaterThan(0);
    expect(d.dpsReceived).toBeGreaterThan(0);
    expect(duel('healer', 3, 'the-periphery', 'normal', { seeds: 5 }).unit.hps).toBeGreaterThan(0);
  });

  it('ranks: a share of the group below (ties half), and the value over its mean, worked from the raw file', () => {
    const draftable = combatants.filter(([, u]) => (u as { draftable?: boolean }).draftable !== false);
    const values = draftable.map(([, u]) => u.baseStats.strength!);
    const mean = values.reduce((s, x) => s + x, 0) / values.length;
    const r = ranks('draftable');
    for (const [id, u] of draftable) {
      const v = u.baseStats.strength!;
      const below = values.filter((x) => x < v).length;
      const equal = values.filter((x) => x === v).length;
      expect(r[id]!.base.strength!.percentile, id).toBeCloseTo((below + equal / 2) / values.length, 10);
      expect(r[id]!.base.strength!.ofMean, id).toBeCloseTo(v / mean, 10);
    }
    expect(Object.keys(r).sort()).toEqual(draftable.map(([id]) => id).sort());
  });

  it('the colour scale: the middle clear, by rank about the 50th percentile, by size half and double at full colour', () => {
    expect(placeOf('rank', 0.5, 7)).toBe(0);
    expect(placeOf('rank', 1, 0)).toBe(1);
    expect(placeOf('rank', 0, 9)).toBe(-1);
    expect(placeOf('rank', 0.75, 1)).toBeCloseTo(0.5, 10);
    expect(placeOf('size', 0.1, 1)).toBe(0);
    expect(placeOf('size', 0.1, 2)).toBe(1);
    expect(placeOf('size', 0.1, 0.5)).toBe(-1);
    expect(placeOf('size', 0.1, Math.SQRT2)).toBeCloseTo(0.5, 10);
    expect(placeOf('size', 0.1, 0)).toBe(-1);
    expect(placeOf('size', 0.1, Infinity)).toBe(1);
    expect(shade(0)).toBe('transparent');
    expect(shade(-1)).toMatch(/^rgba\(70, 130, 230,/);
    expect(shade(1)).toMatch(/^rgba\(240, 150, 40,/);
  });

  it('the weapon table: every combatant strike or heal, with its wielders', () => {
    const table = weaponTable();
    expect([...table.find((w) => w.id === 'sword')!.wielders].sort()).toEqual(['mercenary', 'prodigy']);
    expect(table.find((w) => w.id === 'chain_lightning')!.verb).toBe('chain');
    expect(table.find((w) => w.id === 'heal_ally')!.verb).toBe('heal');
    for (const { weapon } of cases) expect(table.some((w) => w.id === weapon), weapon).toBe(true);
  });
});
