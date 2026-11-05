/**
 * The stat sheet's duel: a unit at a level against each enemy a sector's
 * encounters of one kind field, both standing in range, as an
 * expected-value timeline, and the ranks and the weapon table beside it.
 *
 * The timeline steps a tick at a time, in the sim's order within a tick:
 * statuses expire, the attacker strikes (every `resolveCadenceTicks`
 * ticks from the first tick) for its expected damage and puts its
 * weapon's damage-over-time riders on, then the riders tick. A rider's
 * first tick is one interval after it goes on, a re-application keeps the
 * tick's anchor and renews the duration, and an `add` merge stacks its
 * magnitude, so a bleed kept up grows; a status expires on the tick its
 * duration ends, before that tick's damage. `tests/tools/stat-sheet.test.ts`
 * pins the count of ticks against the sim's. Time to kill is the first
 * tick the expected damage reaches the target's hit points, within
 * `MAX_SECONDS`; each side's is read alone, neither side dying first.
 */

import { TICK_RATE, secondsToTicks } from '../../src/config';
import { abilityDef } from '../../src/config/abilities';
import { STATS } from '../../src/config/stats';
import { STATUS_DEFS } from '../../src/config/statuses';
import { UNIT_DEFS } from '../../src/config/units';
import type { EncounterKind } from '../../src/config/encounters';
import { evalScaled } from '../../src/sim/effects/resolveScalars';
import { resolveCadenceTicks } from '../../src/sim/effects/timeline';
import type { UnitStats } from '../../src/sim/Unit';
import { fieldedEnemies, type EnemyOptions } from './enemies';
import { expectedStrike, healPerSecond, maxHpOf, statsAt, strikeOpOf, weaponOf } from './model';

export const MAX_SECONDS = 120;

/** One side of a duel. */
export interface Fighter {
  readonly archetype: string;
  readonly level: number;
  readonly stats: UnitStats;
}

interface Rider {
  readonly statusId: string;
  readonly magnitude: number;
  readonly durationTicks: number;
}

/** The weapon's damage-over-time riders, with the attacker's scaled values. */
function ridersOf(weapon: string, f: Fighter): Rider[] {
  const out: Rider[] = [];
  for (const e of abilityDef(weapon).effects) {
    if (e.op.kind !== 'applyStatus') continue;
    const def = STATUS_DEFS[e.op.statusId];
    if (!def?.periodic || def.periodic.op.kind !== 'damage') continue;
    const caster = { level: f.level, effectiveStats: f.stats };
    const seconds = evalScaled(e.op.durationSeconds, caster) ?? def.durationSeconds;
    out.push({
      statusId: e.op.statusId,
      magnitude: evalScaled(e.op.magnitude, caster) ?? 1,
      durationTicks: secondsToTicks(seconds),
    });
  }
  return out;
}

interface Live {
  statusId: string;
  magnitude: number;
  expiresAt: number;
  nextTickAt: number;
}

/** The damage-over-time statuses on one target, a tick at a time, by the
 *  sim's rules: `put` one on (a re-application keeps the tick's anchor,
 *  renews the duration, and adds or replaces the magnitude by the status's
 *  merge), `expire` those whose duration ends on this tick, then
 *  `tickDamage` for the ticks due. */
export class DotTrack {
  private readonly live: Live[] = [];

  put(statusId: string, magnitude: number, durationTicks: number, tick: number): void {
    const def = STATUS_DEFS[statusId]!;
    const existing = def.merge === 'instances' ? undefined : this.live.find((l) => l.statusId === statusId);
    if (existing && def.merge === 'ignore') return;
    if (existing) {
      existing.magnitude = def.merge === 'add' ? existing.magnitude + magnitude : magnitude;
      existing.expiresAt = tick + durationTicks;
      return;
    }
    const every = secondsToTicks(def.periodic!.everySeconds);
    this.live.push({ statusId, magnitude, expiresAt: tick + durationTicks, nextTickAt: tick + every });
  }

  expire(tick: number): void {
    for (let i = this.live.length - 1; i >= 0; i--) if (tick >= this.live[i]!.expiresAt) this.live.splice(i, 1);
  }

  tickDamage(tick: number, defense: number): number {
    let total = 0;
    for (const l of this.live) {
      if (tick < l.nextTickAt) continue;
      const def = STATUS_DEFS[l.statusId]!;
      const op = def.periodic!.op;
      if (op.kind === 'damage') {
        const amount = Math.round(op.might * l.magnitude);
        if (amount > 0) total += op.bypassDefense ? amount : Math.max(STATS.minDamage, amount - defense);
      }
      l.nextTickAt += secondsToTicks(def.periodic!.everySeconds);
    }
    return total;
  }
}

export interface Timeline {
  readonly ttkSeconds: number;
  readonly strikeDamage: number;
  readonly dotDamage: number;
  /** The damage over the strikes made times their period: the standing
   *  damage a second when the weapon has no rider, and with one, its
   *  ticks added over the fight. Not the hit points over the time to
   *  kill, which a kill on the first strike would make unbounded. */
  readonly dps: number;
}

/** Expected damage dealt by `attacker` to `defender`, a tick at a time,
 *  until it reaches the defender's hit points or `MAX_SECONDS`. */
export function timeline(attacker: Fighter, defender: Fighter): Timeline {
  const weapon = weaponOf(attacker.archetype);
  const hp = maxHpOf(defender.stats);
  if (!weapon) return { ttkSeconds: Infinity, strikeDamage: 0, dotDamage: 0, dps: 0 };
  const defense = defender.stats.defense;
  const period = resolveCadenceTicks(abilityDef(weapon), attacker.stats.speed);
  const strike = expectedStrike(attacker.stats, weapon, defense);
  const riders = ridersOf(weapon, attacker);
  const dots = new DotTrack();
  let strikeDamage = 0;
  let dotDamage = 0;
  let strikes = 0;
  const result = (ttkSeconds: number): Timeline => ({
    ttkSeconds,
    strikeDamage,
    dotDamage,
    dps: (strikeDamage + dotDamage) / ((strikes * period) / TICK_RATE),
  });
  const end = MAX_SECONDS * TICK_RATE;
  for (let tick = 0; tick <= end; tick++) {
    dots.expire(tick);
    if (tick % period === 0) {
      strikes++;
      strikeDamage += strike;
      for (const r of riders) dots.put(r.statusId, r.magnitude, r.durationTicks, tick);
    }
    dotDamage += dots.tickDamage(tick, defense);
    if (strikeDamage + dotDamage >= hp) return result(tick / TICK_RATE);
  }
  return result(Infinity);
}

/** One row of a duel: the player's unit against one fielded enemy. */
export interface DuelRow {
  readonly archetype: string;
  readonly level: number;
  readonly share: number;
  readonly hp: number;
  readonly defense: number;
  /** Seconds for the player's unit to kill it, and for it to kill the unit. */
  readonly ttkDealt: number;
  readonly ttkReceived: number;
  /** Each side's `Timeline.dps`. */
  readonly dpsDealt: number;
  readonly dpsReceived: number;
}

export interface Duel {
  readonly unit: { readonly hp: number; readonly hps: number; readonly weapon: string | undefined };
  readonly rows: readonly DuelRow[];
  /** Share-weighted means of the rows' damage a second. */
  readonly dpsDealt: number;
  readonly dpsReceived: number;
  /** Share-weighted means over the rows with a finite time, and the share
   *  with none (a side that cannot kill the other within MAX_SECONDS). */
  readonly ttkDealt: number;
  readonly ttkReceived: number;
  readonly neverKilledShare: number;
  readonly neverKillsShare: number;
}

const weightedMean = (rows: readonly DuelRow[], f: (r: DuelRow) => number): number => {
  const finite = rows.filter((r) => Number.isFinite(f(r)));
  const w = finite.reduce((s, r) => s + r.share, 0);
  return w === 0 ? Infinity : finite.reduce((s, r) => s + r.share * f(r), 0) / w;
};

/** The player's `archetype` at `level` against `sectorId`'s fielded enemies
 *  of `kind`. `buffs` adds flat stats to the player's unit (an idol's
 *  empower). */
export function duel(
  archetype: string,
  level: number,
  sectorId: string,
  kind: EncounterKind,
  opts: EnemyOptions & { readonly buffs?: Partial<Record<keyof UnitStats, number>> } = {},
): Duel {
  const base = statsAt(archetype, level, 'player');
  const stats = { ...base } as Record<keyof UnitStats, number>;
  for (const [k, v] of Object.entries(opts.buffs ?? {})) stats[k as keyof UnitStats] += v ?? 0;
  const me: Fighter = { archetype, level, stats };
  const myHp = maxHpOf(stats);
  const rows: DuelRow[] = fieldedEnemies(sectorId, kind, level, opts).map((e) => {
    const foe: Fighter = { archetype: e.archetype, level: e.level, stats: statsAt(e.archetype, e.level, 'enemy') };
    const dealt = timeline(me, foe);
    const received = timeline(foe, me);
    const hp = maxHpOf(foe.stats);
    return {
      archetype: e.archetype,
      level: e.level,
      share: e.share,
      hp,
      defense: foe.stats.defense,
      ttkDealt: dealt.ttkSeconds,
      ttkReceived: received.ttkSeconds,
      dpsDealt: dealt.dps,
      dpsReceived: received.dps,
    };
  });
  const share = (pred: (r: DuelRow) => boolean): number => rows.filter(pred).reduce((s, r) => s + r.share, 0);
  return {
    unit: { hp: myHp, hps: healPerSecond(archetype, stats), weapon: weaponOf(archetype) },
    rows,
    dpsDealt: rows.reduce((s, r) => s + r.share * r.dpsDealt, 0),
    dpsReceived: rows.reduce((s, r) => s + r.share * r.dpsReceived, 0),
    ttkDealt: weightedMean(rows, (r) => r.ttkDealt),
    ttkReceived: weightedMean(rows, (r) => r.ttkReceived),
    neverKilledShare: share((r) => !Number.isFinite(r.ttkDealt)),
    neverKillsShare: share((r) => !Number.isFinite(r.ttkReceived)),
  };
}

/** A stat's or growth's place in its group. */
export interface Rank {
  readonly value: number;
  /** The share of the group below it, ties counted half. */
  readonly percentile: number;
  /** Its value over the group's mean. */
  readonly ofMean: number;
}

/** A value's place among `values` (which hold it). */
export function rankWithin(values: readonly number[], v: number): Rank {
  const mean = values.reduce((s, x) => s + x, 0) / values.length;
  const below = values.filter((x) => x < v).length;
  const equal = values.filter((x) => x === v).length;
  return { value: v, percentile: (below + equal / 2) / values.length, ofMean: mean === 0 ? (v === 0 ? 1 : Infinity) : v / mean };
}

/** Each combatant's base stats and growths ranked within its group: the
 *  draftable units, or the enemies (the units the draft never offers). */
export function ranks(group: 'draftable' | 'enemy'): Record<string, { base: Record<string, Rank>; growth: Record<string, Rank> }> {
  const members = Object.entries(UNIT_DEFS).filter(([, d]) => (group === 'draftable') === d.draftable);
  const out: Record<string, { base: Record<string, Rank>; growth: Record<string, Rank> }> = {};
  const rank = rankWithin;
  for (const [id, d] of members) {
    out[id] = { base: {}, growth: {} };
    for (const key of Object.keys(d.baseStats) as (keyof UnitStats)[]) {
      out[id]!.base[key] = rank(members.map(([, m]) => m.baseStats[key]), d.baseStats[key]);
      out[id]!.growth[key] = rank(members.map(([, m]) => m.growthRates[key]), d.growthRates[key]);
    }
  }
  return out;
}

/** One weapon: an ability with a strike or a heal, and who carries it. */
export interface WeaponRow {
  readonly id: string;
  readonly wielders: readonly string[];
  readonly verb: 'strike' | 'chain' | 'heal';
  readonly might: number;
  readonly scaling: string;
  readonly cooldownSeconds: number;
  readonly speedScaled: boolean;
  readonly rangeCells: number;
  readonly minRangeCells: number;
  readonly target: string;
  readonly critBase: number;
  readonly bypassDefense: boolean;
  readonly riders: readonly string[];
}

export function weaponTable(): WeaponRow[] {
  const byWeapon = new Map<string, string[]>();
  for (const [id, d] of Object.entries(UNIT_DEFS)) {
    for (const a of d.abilities) {
      const def = abilityDef(a);
      const heals = def.effects.some((e) => e.op.kind === 'heal');
      if (strikeOpOf(a) || heals) byWeapon.set(a, [...(byWeapon.get(a) ?? []), id]);
    }
  }
  return [...byWeapon.entries()].map(([id, wielders]) => {
    const def = abilityDef(id);
    const strike = strikeOpOf(id);
    const heal = def.effects.find((e) => e.op.kind === 'heal')?.op;
    const op = strike ?? (heal && heal.kind === 'heal' ? heal : undefined);
    return {
      id,
      wielders,
      verb: strike ? (def.effects.some((e) => e.op.kind === 'chain') ? 'chain' : 'strike') : 'heal',
      might: op?.might ?? 0,
      scaling: op?.scaling ?? 'none',
      cooldownSeconds: def.cooldownSeconds,
      speedScaled: def.speedScaled,
      rangeCells: def.rangeCells,
      minRangeCells: def.minRangeCells,
      target: def.target.kind,
      critBase: strike?.critable ? strike.critBase : 0,
      bypassDefense: strike?.bypassDefense ?? false,
      riders: def.effects.flatMap((e) => (e.op.kind === 'applyStatus' ? [e.op.statusId] : [])),
    };
  });
}
