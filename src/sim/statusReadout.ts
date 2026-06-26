/**
 * §32c — the status-readout selector (the data layer of the status
 * visualization locked in the 32a design round).
 *
 * A PURE projection of a unit's live `effects[]` into the per-status facts the
 * two §32 surfaces render — the board pip-strip (BattleRenderer) and the card
 * status row (UnitCard). It reads sim truth only; **presentation (color, icon)
 * lives render-side** (a `statusDisplay` map, sibling to the `fxRegistry`
 * colors) so this stays headless-testable and free of any palette dependency —
 * the same data/render split the EffectOp interpreter and the FX registry hold.
 *
 * Scope: only DEF-BACKED named statuses (burn/bleed/poison/rejuvenate +
 * frozen/panic/blind/confusion) surface here. A raw K1 stat effect with no
 * `StatusDef` (empower, fatigue, daemon buffs) is intentionally SKIPPED — those
 * are surfaced on the cards already and aren't part of the status-cue vocabulary
 * this phase designed. The selector is keyed by `defs` (default `STATUS_DEFS`),
 * so a test passes its own hermetic fixtures rather than reading shipped JSON.
 *
 * The headline unification: per-tick output is `op.might × magnitude`, which
 * captures BOTH stacking (an `add` status — magnitude IS the stack count) AND
 * the §31 cast-time scaling (a `refresh` status — magnitude is the scaled
 * scalar) through one formula. So `potencyPerSec` reads the scaled/stacked
 * number that §31 made invisible without a surface to show it.
 */

import { TICK_SECONDS } from '../config';
import { STATUS_DEFS } from '../config/statuses';
import type { StatusDef, StatusMerge } from './effects/statusSchema';
import type { StatusEffect } from './statusEffects';

/** One active def-backed status, projected for display. Sim truth only — the
 *  renderer/UI maps `statusId` → color/icon separately. */
export interface StatusReadout {
  /** The `StatusDef` id (= the runtime effect's `key`); the render-side display
   *  map keys its color/icon off this. */
  statusId: string;
  /** The def's player-facing `name` (`'Burn'`, `'Frozen'`). */
  name: string;
  /** `damage` / `heal` for a periodic DoT/HoT; `behavior` for a control status
   *  with no periodic block (frozen/panic/blind/confusion). */
  kind: 'damage' | 'heal' | 'behavior';
  /** The def's merge policy — the UI shows a `×N` stack count ONLY for `add`
   *  (where re-application escalates magnitude); `refresh`/`instances` don't
   *  stack (magnitude is a potency scalar, not a count). */
  merge: StatusMerge;
  /** `round(magnitude)`. A meaningful stack COUNT under `add`; for the other
   *  merges it's the (possibly §31-scaled) potency scalar (~1) — the UI gates
   *  its `×N` display on `merge === 'add'`. */
  stacks: number;
  /** Whole-domain seconds left on a `ticks` lifetime (clamped ≥ 0 so an
   *  expired-but-unreaped effect reads 0, never negative); `null` for a
   *  persistent `endOfTurn` effect. The card row shows this as `Ns`. */
  remainingSeconds: number | null;
  /** `remainingSeconds / def.durationSeconds`, clamped [0,1] — the depleting
   *  board-pip width. `1` for a persistent effect. Uses the def's nominal
   *  duration as the max (a §31 duration-scaled status reads full until it drops
   *  under the nominal span — a coarse board cue; the card shows the exact `Ns`). */
  durationFraction: number;
  /** Effective per-second output: `op.might × magnitude ÷ everySeconds`. Folds
   *  in stacks AND §31 scaling. `null` for a behavior status (no periodic). The
   *  sign is the caller's (a `damage` kind subtracts HP, `heal` adds). */
  potencyPerSec: number | null;
}

/**
 * Project a unit's effects into the active def-backed status readouts, in a
 * STABLE canonical order (the status's position in `defs`, i.e. config order),
 * so a given status always occupies the same relative pip/row slot regardless of
 * application order — the recognizability the 32a spec wants.
 */
export function readUnitStatuses(
  effects: readonly StatusEffect[],
  currentTick: number,
  defs: Record<string, StatusDef> = STATUS_DEFS,
): StatusReadout[] {
  const out: StatusReadout[] = [];
  for (const effect of effects) {
    const def = defs[effect.key];
    if (!def) continue; // raw K1 stat effect (empower/fatigue/daemon) — not a named status
    const periodic = def.periodic;
    const remainingSeconds =
      effect.lifetime.kind === 'ticks'
        ? Math.max(0, (effect.lifetime.expiresAtTick - currentTick) * TICK_SECONDS)
        : null;
    out.push({
      statusId: effect.key,
      name: def.name,
      kind: periodic ? periodic.op.kind : 'behavior',
      merge: def.merge,
      stacks: Math.round(effect.magnitude),
      remainingSeconds,
      durationFraction:
        remainingSeconds === null
          ? 1
          : Math.max(0, Math.min(1, remainingSeconds / def.durationSeconds)),
      potencyPerSec: periodic
        ? (periodic.op.might * effect.magnitude) / periodic.everySeconds
        : null,
    });
  }
  const order = new Map(Object.keys(defs).map((id, i) => [id, i] as const));
  out.sort((a, b) => (order.get(a.statusId) ?? 0) - (order.get(b.statusId) ?? 0));
  return out;
}
