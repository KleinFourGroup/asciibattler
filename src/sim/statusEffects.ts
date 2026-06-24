/**
 * K1 — the generic per-unit status-effect system.
 *
 * An effect is a per-stat modifier with a lifetime and a stacking/merge
 * policy. The four consumers that shaped it: empower (a flat buff till
 * encounter end, K4), daemon buffs (timed, L), the on-evade dodge buff (L),
 * and fatigue (the proof consumer — the H6c `fatigueFactor` migrates onto
 * this as a stackable "Fatigued" debuff in K1 commit 2).
 *
 * This module is the pure data + math: the effect shape, the fold that turns
 * a base stat block + a list of effects into the effective block, and the
 * magnitude-merge arithmetic. The per-unit list management (apply / expire /
 * the `effectiveStats` cache) lives on `Unit`; the trigger dispatch that
 * APPLIES effects lives on `World` (see `triggers.ts`).
 *
 * Scope (K1, user-locked):
 * - **Stat modifiers only** — no DoT / stun / behaviour-disabling (no consumer
 *   asks for it yet).
 * - The fold covers **all 11 stats uniformly**, but K1 only ever *applies*
 *   effects touching the 9 live-read stats. The two cached-derived stats
 *   (`constitution → maxHp`, `mobility → moveCooldown`) are handled by
 *   `Unit.refreshDerived` so the wiring is live, but no K1 effect modifies
 *   them — the maxHp↔currentHp clamp policy is the one piece deliberately
 *   deferred until a real HP/move-speed consumer exists.
 */

import type { UnitStats } from './Unit';

/** Any key of the stat block — the fold is total over all 11. */
export type StatKey = keyof UnitStats;

/**
 * Per-stat modifier, expressed **per one unit of magnitude**. `add` shifts the
 * stat additively; `mul` is a multiplicative factor whose *delta* scales with
 * magnitude (see `foldEffects`). Either or both may be present.
 */
export interface StatMod {
  add?: number;
  mul?: number;
}

/**
 * Battle-side lifetime. `ticks` expires mid-battle at `expiresAtTick`;
 * `endOfTurn` lives for the whole tactical battle (it dies with the World — the
 * tick loop never removes it). The cross-turn `endOfEncounter` authoring
 * lifetime is implemented Run-side (a per-slot store re-seeded each turn as an
 * `endOfTurn` effect), so it never reaches the World as a distinct kind — see
 * K1 commit 2.
 */
export type EffectLifetime =
  | { kind: 'ticks'; expiresAtTick: number }
  | { kind: 'endOfTurn' };

/**
 * How a re-applied effect (same `key`) combines with the existing instance's
 * magnitude. `independent` skips the merge entirely (a separate instance is
 * kept). `ignore` (Phase 27) is a no-op if a same-`key` instance already exists
 * (don't refresh, don't stack) — RESERVED, no §27 consumer; ships so the
 * `StatusDef` merge vocabulary is closed. Every other policy refreshes the
 * lifetime to the incoming one on re-apply.
 */
export type MergePolicy = 'replace' | 'add' | 'multiply' | 'independent' | 'ignore';

export interface StatusEffect {
  /** Identity for merging, e.g. `'fatigued'`, `'empowered'`, `'burn'`. For a
   *  status-def effect this is the `StatusDef.id` (the def-resolve link). */
  key: string;
  /** The "empower 3" scalar. Defaults to 1 at the apply sites. */
  magnitude: number;
  /** Per-stat modifiers, expressed per one unit of magnitude. */
  mods: Partial<Record<StatKey, StatMod>>;
  lifetime: EffectLifetime;
  merge: MergePolicy;
  /**
   * Phase 27 — the per-unit PERIODIC tick cursor (the tick at which this
   * effect's next DoT/HoT fires). Present only for status-def effects whose def
   * carries a `periodic` block; absent for plain K1 stat effects. The op /
   * interval / duration themselves are def-resolved by `key` (not serialized) —
   * this cursor is the only periodic runtime state. Re-application preserves it
   * (the cadence keeps running on its original anchor; see `mergeEffectInto`).
   */
  nextTickAt?: number;
  /**
   * Phase 27 — attribution for periodic damage/heal: the applying unit's id, or
   * `null` for environmental (a fire-tile burn). Feeds the XP / kill ledger and
   * the `status:*` events. Absent on plain K1 stat effects.
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
 * delta `(mul − 1)·m` *within* an instance, and instances multiply *across*
 * each other. This linear-in-magnitude convention recovers the exact fatigue
 * curve: a `{ power: { mul: 1−rate } }` effect at magnitude `stacks` yields
 * `power × (1 − rate·stacks)`.
 *
 * **Identity guarantee:** with no effects this returns `base` itself (same
 * object), so the no-effect path is byte-identical and zero-cost. Only the
 * stats a modifier touches are recomputed; the rest keep their base value.
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
 * policy. `independent` returns the incoming magnitude unchanged (the caller
 * keeps the instances separate rather than calling this).
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
      // Unreachable: `mergeEffectInto` short-circuits `ignore` before combining.
      // Present for switch exhaustiveness over the widened `MergePolicy`.
      return existing;
  }
}

/**
 * Apply `incoming` to an effect list per its merge policy (the shared merge
 * used by both `Unit.addEffect`, battle-side, and `Run.addEncounterEffect`,
 * the encounter store). A non-`independent` effect whose `key` already exists
 * combines magnitudes (`replace`/`add`/`multiply`), refreshes the lifetime,
 * and adopts the incoming mods/policy; otherwise a fresh (cloned) instance is
 * pushed. Mutates `list` in place.
 */
export function mergeEffectInto(list: StatusEffect[], incoming: StatusEffect): void {
  // 27 — `ignore`: if a same-key instance is already present, do nothing (no
  // refresh, no stack). Otherwise it falls through to a fresh push below.
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
      // 27 — `nextTickAt` + `sourceUnitId` are deliberately NOT overwritten from
      // `incoming`: a re-applied DoT/HoT (a `refresh` burn re-stamped each tick a
      // unit stands in fire, an `add` bleed re-hit) keeps its periodic cadence
      // running on the ORIGINAL anchor (so reapply tops up DURATION without ever
      // pushing the next tick away) and the FIRST applier keeps kill/XP credit.
      return;
    }
  }
  list.push(cloneEffect(incoming));
}

/** Deep copy an effect so a live unit's instance and a snapshot (or a seed
 *  template) never share a mutable `mods` / `lifetime` reference — merging
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
    // 27 — carry the periodic runtime state (omitted on plain stat effects, so
    // the no-periodic common case stays a clean object without the keys).
    ...(effect.nextTickAt !== undefined ? { nextTickAt: effect.nextTickAt } : {}),
    ...(effect.sourceUnitId !== undefined ? { sourceUnitId: effect.sourceUnitId } : {}),
  };
}
