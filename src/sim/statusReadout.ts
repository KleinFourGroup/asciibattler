/**
 * A unit's statuses as the displays need them: a pure projection of its live
 * `effects` for the board's pip strip (BattleRenderer), the card's status row
 * (UnitCard) and the HUD. It reads sim state only; colour and icon live on the
 * render side (`statusDisplay.ts`), so this stays testable headless and free of
 * the palette.
 *
 * Only an effect with a catalog def surfaces. A plain stat effect with no def
 * (empower, fatigue) is skipped; the cards show those already. The defs are an
 * argument (`STATUS_DEFS` by default), so a test can pass its own.
 *
 * A periodic status's output per tick is `op.might × magnitude`, which covers
 * both stacking (under `add` the magnitude is the stack count) and a magnitude
 * scaled at cast (under `refresh` it is the scaled value), so `potencyPerSec`
 * shows the number either way.
 */

import { TICK_SECONDS } from '../config';
import { STATUS_DEFS } from '../config/statuses';
import type { StatusDef, StatusMerge } from './effects/statusSchema';
import type { StatusEffect } from './statusEffects';

/** One active status with a catalog def, for display. The renderer and the UI
 *  map `statusId` to a colour and an icon. */
export interface StatusReadout {
  /** The def's id, the effect's `key`. */
  statusId: string;
  /** The def's player-facing `name`. */
  name: string;
  /** `damage` or `heal` for a DoT or a HoT; `behavior` for any status with no
   *  periodic block, a control status or one that only changes stats. */
  kind: 'damage' | 'heal' | 'behavior';
  /** The def's merge. The UI shows a `×N` stack count only under `add`, where a
   *  re-application raises the magnitude; under the others the magnitude is a
   *  potency, not a count. */
  merge: StatusMerge;
  /** `round(magnitude)`: the stack count under `add`, and under the other merges
   *  the potency, scaled or not. */
  stacks: number;
  /** The seconds left on a `ticks` lifetime, at least 0, so an effect expired
   *  but not yet removed reads 0; `null` for an `endOfTurn` effect. The card row
   *  shows it as `Ns`. */
  remainingSeconds: number | null;
  /** `remainingSeconds / def.durationSeconds`, clamped to [0, 1]: the board pip's
   *  shrinking width, 1 for an `endOfTurn` effect. The max is the def's own
   *  duration, so a status whose duration was scaled up at cast reads full until
   *  it drops below that, a coarse cue; the card shows the exact seconds. */
  durationFraction: number;
  /** The output per second, stacks and scaling included; `null` with no
   *  periodic block. The sign is the caller's: `damage` takes HP, `heal` gives. */
  potencyPerSec: number | null;
}

/**
 * A unit's statuses with a catalog def, in the order of `defs` (the config's
 * order), so a status always takes the same slot in the pips and the row
 * whatever order it was applied in.
 */
export function readUnitStatuses(
  effects: readonly StatusEffect[],
  currentTick: number,
  defs: Record<string, StatusDef> = STATUS_DEFS,
): StatusReadout[] {
  const out: StatusReadout[] = [];
  for (const effect of effects) {
    const def = defs[effect.key];
    if (!def) continue; // a plain stat effect (empower, fatigue), not a status
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
