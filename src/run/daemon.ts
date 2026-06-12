/**
 * L1 — the pure daemon rules: the run-start roll + the per-turn gate
 * resolution (daemon → this turn's effective redraw/empower configs).
 *
 * Pulled out of `Run` so the gate math is provable in isolation (the daemon +
 * RNG are parameters, not the `DAEMONS` singleton / `Run.daemonRng`), mirroring
 * `redraw.ts` (K3) and `empower.ts` (K4). `Run` is a thin caller: it rolls one
 * daemon at construction and re-resolves `turnGates` at every turn start.
 *
 * Daemon-only gates (the user-locked Phase-L model): a turn's redraw/empower
 * availability IS the resolved gate — `resolveTurnGates` returns disabled
 * configs for anything the daemon doesn't grant, and the K3/K4 pure validators
 * consume the result unchanged. The roguelite variance is the point: a run's
 * idol defines which pre-turn tools exist at all.
 *
 * RNG contract: a gate draws from the daemon stream ONLY when its `chance` is
 * strictly between 0 and 1 (a deterministic gate costs no draw, so adding a
 * chance-less daemon never shifts another daemon's flips). Within a turn the
 * draw order is fixed: redraw gate first, then empower.
 */

import type { DaemonConfig } from '../config/daemons';
import type { EmpowerConfig } from '../config/empower';
import type { RNG } from '../core/RNG';
import type { RedrawConfig } from './redraw';

/** This turn's resolved pre-turn gates — the shapes the K3/K4 validators eat.
 *  Round-trips in the Run save (v16): a save taken at the pre-turn gate must
 *  restore the SAME Mercury flip, never re-roll it. */
export interface TurnGates {
  redraw: RedrawConfig;
  empower: EmpowerConfig;
}

/** The no-grant baseline: both gates disabled. The empower `buff` is an inert
 *  placeholder (its `key: ''` matches no effect; `empowerRejection` rejects on
 *  `enabled` before the buff is ever read). */
export function disabledTurnGates(): TurnGates {
  return {
    redraw: { enabled: false, redrawsPerTurn: 0, maxCardsPerTurn: 0 },
    empower: { enabled: false, empowersPerTurn: 0, buff: { key: '', mods: {}, merge: 'add' } },
  };
}

/** The per-turn chance condition. Draws only on a genuine coin flip
 *  (`0 < chance < 1`) — see the RNG contract above. */
function granted(chance: number, rng: RNG): boolean {
  if (chance >= 1) return true;
  if (chance <= 0) return false;
  return rng.next() < chance;
}

/** Uniform run-start roll over the catalog (one draw off the daemon stream). */
export function rollDaemon(daemons: readonly DaemonConfig[], rng: RNG): DaemonConfig {
  return rng.pick(daemons);
}

/**
 * Resolve one turn's gates from the active daemon. `null` (a daemon-less run —
 * the fuzz control arm) resolves to all-disabled with no RNG draw. A granted
 * gate maps the daemon's knobs onto an enabled config; the empower buff is
 * carried by REFERENCE (safe: nothing mutates a buff — `empowerEffect`
 * deep-copies mods at apply time, and `turnGates` is reassigned whole each
 * turn).
 */
export function resolveTurnGates(daemon: DaemonConfig | null, rng: RNG): TurnGates {
  const gates = disabledTurnGates();
  if (daemon === null) return gates;
  if (daemon.redraw !== undefined && granted(daemon.redraw.chance, rng)) {
    gates.redraw = {
      enabled: true,
      redrawsPerTurn: daemon.redraw.redrawsPerTurn,
      maxCardsPerTurn: daemon.redraw.maxCardsPerTurn,
    };
  }
  if (daemon.empower !== undefined && granted(daemon.empower.chance, rng)) {
    gates.empower = {
      enabled: true,
      empowersPerTurn: daemon.empower.empowersPerTurn,
      buff: daemon.empower.buff,
    };
  }
  return gates;
}
