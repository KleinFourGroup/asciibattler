/**
 * The per-unit status effect: a set of per-stat modifiers with a magnitude,
 * a lifetime and a merge policy. This module is the pure data and math: the
 * effect's shape, the fold from a base stat block and its effects to the
 * effective block, and the merge arithmetic. The per-unit list (apply,
 * expire, the `effectiveStats` cache) lives on `Unit`. Effects are applied
 * by `World` (status ops, tiles, auras) and seeded at spawn by `Run`
 * (fatigue, the encounter store).
 *
 * `buildStatusEffect` turns a status def (`config/statuses.json`) into one of
 * these: its stat mods, plus the periodic cursor below for damage or healing
 * over time. A def's behaviour flags (frozen, panic, blind) are read off the
 * def by `key` (`statusBehavior.ts`), not stored here.
 *
 * The fold covers all 11 stats. Two feed the cached derived block
 * (`constitution` → max HP, `mobility` → move cooldown), and
 * `Unit.refreshDerived` recomputes it on every change to the list. Fatigue
 * lowers constitution only at spawn, where the `Unit` constructor clamps
 * current HP to the new max; a constitution effect added mid-battle gets no
 * such clamp.
 */

import type { UnitStats } from './Unit';

export type StatKey = keyof UnitStats;

/**
 * Per-stat modifier, expressed per one unit of magnitude. `add` shifts the
 * stat additively; `mul` is a multiplicative factor whose delta scales with
 * magnitude (see `foldEffects`). Either or both may be present.
 */
export interface StatMod {
  add?: number;
  mul?: number;
}

/**
 * Battle-side lifetime. `ticks` expires mid-battle at `expiresAtTick`;
 * `endOfTurn` lasts the whole battle (it dies with the World, and the tick
 * loop never expires it). The cross-turn `endOfEncounter` authoring lifetime
 * is kept by Run, a per-slot store re-seeded each turn as an `endOfTurn`
 * effect, so it never reaches the World as a kind of its own.
 */
type EffectLifetime =
  | { kind: 'ticks'; expiresAtTick: number }
  | { kind: 'endOfTurn' };

/**
 * How a re-applied effect (same `key`) combines with the existing instance
 * (`mergeEffectInto`):
 * - `replace`, `add`, `multiply` — combine magnitudes (`combineMagnitude`).
 * - `independent` — no merge; the effect is kept as a separate instance.
 * - `ignore` — the existing instance is left as it is (no refresh, no
 *   stack). No shipped effect uses it; it is here because the status-def
 *   merge vocabulary (`statusSchema.ts`) maps onto this type.
 */
export type MergePolicy = 'replace' | 'add' | 'multiply' | 'independent' | 'ignore';

export interface StatusEffect {
  /** Identity for merging, e.g. `'fatigued'`, `'honed'`, `'burn'`. For a
   *  status-def effect this is the `StatusDef.id` (the def-resolve link). */
  key: string;
  /** How many units of `mods` apply; an `add` merge stacks it. Defaults to 1
   *  at the apply sites. */
  magnitude: number;
  mods: Partial<Record<StatKey, StatMod>>;
  lifetime: EffectLifetime;
  merge: MergePolicy;
  /**
   * The tick at which this effect's next periodic damage or heal fires.
   * Present only on a status-def effect whose def has a `periodic` block. The
   * op, interval and duration are resolved from the def by `key` and not
   * serialized, so this cursor is the only periodic runtime state.
   * Re-application keeps it (see `mergeEffectInto`).
   */
  nextTickAt?: number;
  /**
   * Who applied the effect: a unit id, or `null` for an environmental source
   * (a fire tile's burn). Credits periodic damage and healing to the XP and
   * kill ledgers and rides the `status:*` events. Absent on plain stat
   * effects.
   */
  sourceUnitId?: number | null;
}

/** Only `mobility` is signed (0 = baseline, negative = slower); every other
 *  stat clamps at 0 after the fold. */
const SIGNED_STATS: ReadonlySet<StatKey> = new Set<StatKey>(['mobility']);

/**
 * Fold a base stat block with its active effects into the effective block.
 *
 * Per stat, across all instances:
 *   effective = round( (base + Σ add·m) × Π (1 + (mul − 1)·m) )
 *
 * `add` scales linearly with magnitude; a `mul` contributes a magnitude-scaled
 * delta `(mul − 1)·m` within an instance, and instances multiply across each
 * other. Linear-in-magnitude is what gives fatigue its curve: a
 * `{ constitution: { mul: 1 − rate } }` effect at magnitude `stacks` yields
 * `constitution × (1 − rate·stacks)`.
 *
 * With no effects this returns `base` itself, the same object, so the
 * no-effect path costs nothing and changes nothing. Only the stats a
 * modifier touches are recomputed, rounded and clamped; the rest keep their
 * base value.
 */
export function foldEffects(base: UnitStats, effects: readonly StatusEffect[]): UnitStats {
  if (effects.length === 0) return base;

  const adds = new Map<StatKey, number>();
  const muls = new Map<StatKey, number>();
  for (const effect of effects) {
    for (const stat of Object.keys(effect.mods) as StatKey[]) {
      const mod = effect.mods[stat]!;
      if (mod.add !== undefined) {
        adds.set(stat, (adds.get(stat) ?? 0) + mod.add * effect.magnitude);
      }
      if (mod.mul !== undefined) {
        muls.set(stat, (muls.get(stat) ?? 1) * (1 + (mod.mul - 1) * effect.magnitude));
      }
    }
  }

  const out: Record<StatKey, number> = { ...base };
  const touched = new Set<StatKey>([...adds.keys(), ...muls.keys()]);
  for (const stat of touched) {
    let value = base[stat];
    const add = adds.get(stat);
    if (add !== undefined) value += add;
    const mul = muls.get(stat);
    if (mul !== undefined) value *= mul;
    value = Math.round(value);
    if (!SIGNED_STATS.has(stat)) value = Math.max(0, value);
    out[stat] = value;
  }
  return out as UnitStats;
}

/**
 * Combine an existing instance's magnitude with an incoming one per the merge
 * policy. `mergeEffectInto` never calls it for `independent` or `ignore`;
 * those cases return a value only so the switch is exhaustive.
 */
export function combineMagnitude(policy: MergePolicy, existing: number, incoming: number): number {
  switch (policy) {
    case 'replace':
      return incoming;
    case 'add':
      return existing + incoming;
    case 'multiply':
      return existing * incoming;
    case 'independent':
      return incoming;
    case 'ignore':
      return existing;
  }
}

/**
 * Apply `incoming` to an effect list per its merge policy, mutating `list` in
 * place. The one merge for both `Unit.addEffect` (in battle) and
 * `Run.addEncounterEffect` (the encounter store). When an instance with the
 * same `key` exists, `ignore` leaves it, and `replace` / `add` / `multiply`
 * combine magnitudes and take the incoming lifetime, mods and policy.
 * Otherwise, and always for `independent`, a clone of `incoming` is pushed.
 */
export function mergeEffectInto(list: StatusEffect[], incoming: StatusEffect): void {
  if (incoming.merge === 'ignore') {
    if (list.some((e) => e.key === incoming.key)) return;
    list.push(cloneEffect(incoming));
    return;
  }
  if (incoming.merge !== 'independent') {
    const existing = list.find((e) => e.key === incoming.key);
    if (existing) {
      existing.magnitude = combineMagnitude(incoming.merge, existing.magnitude, incoming.magnitude);
      existing.mods = cloneEffect(incoming).mods;
      existing.lifetime = { ...incoming.lifetime };
      existing.merge = incoming.merge;
      // `nextTickAt` and `sourceUnitId` are kept from the existing instance on
      // purpose: a re-applied damage- or heal-over-time (a bleed hit again)
      // keeps its cadence on the original anchor, so re-application renews
      // the duration without pushing the next tick away, and the first
      // applier keeps the kill and XP credit.
      return;
    }
  }
  list.push(cloneEffect(incoming));
}

/** Deep copy an effect so a live unit's instance and a snapshot (or a seed
 *  template) never share a mutable `mods` or `lifetime`, since merging
 *  mutates instances in place. */
export function cloneEffect(effect: StatusEffect): StatusEffect {
  const mods: Partial<Record<StatKey, StatMod>> = {};
  for (const stat of Object.keys(effect.mods) as StatKey[]) {
    mods[stat] = { ...effect.mods[stat]! };
  }
  return {
    key: effect.key,
    magnitude: effect.magnitude,
    mods,
    lifetime: { ...effect.lifetime },
    merge: effect.merge,
    // Copied only when present, so a plain stat effect's clone carries no
    // `undefined` keys.
    ...(effect.nextTickAt !== undefined ? { nextTickAt: effect.nextTickAt } : {}),
    ...(effect.sourceUnitId !== undefined ? { sourceUnitId: effect.sourceUnitId } : {}),
  };
}
