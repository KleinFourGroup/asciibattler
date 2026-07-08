/**
 * L1→47c — the pure daemon rules: the run-start roll + the per-turn grant
 * resolution (the active daemon's `turnStart` hooks → this turn's effective
 * redraw/empower configs).
 *
 * Pulled out of `Run` so the grant math is provable in isolation (the daemon +
 * RNG are parameters, not the `DAEMONS` singleton / `Run.daemonRng`), mirroring
 * `redraw.ts` (K3) and `empower.ts` (K4). `Run` is a thin caller: it rolls one
 * daemon at construction and re-resolves `turnGrants` at every turn start.
 *
 * 47c re-authored the Phase-L gate model into the rule vocabulary
 * (`config/daemons.ts` — `Rule = modifier | hook`): a turn's redraw/empower
 * availability IS the fold of the daemon's granted `turnStart` grant hooks —
 * `resolveTurnGrants` returns disabled configs for anything not granted, and
 * the K3/K4 pure validators consume the result unchanged. The roguelite
 * variance is the point: a run's idol defines which pre-turn tools exist at
 * all. Non-grant `turnStart` ops (`gainBits`/`healPool`) are NOT resolved
 * here — they're instant effects, executed at the trigger fire site once
 * their targets exist (bits 47e; the battle-domain hooks compile at 47f).
 *
 * RNG contract (unchanged from L1): a hook draws from the daemon stream ONLY
 * when its `chance` is strictly between 0 and 1 (absent = 1; a deterministic
 * hook costs no draw, so adding a chance-less daemon never shifts another
 * daemon's flips). Within a turn, hooks are evaluated in AUTHORED RULE ORDER —
 * the fixed-order discipline the L1 redraw-then-empower contract generalized
 * into (a daemon carrying both authors its redraw hook first).
 */

import type { DaemonConfig, HookRule } from '../config/daemons';
import type { EmpowerConfig } from '../config/empower';
import type { RNG } from '../core/RNG';
import type { RedrawConfig } from './redraw';

/** One granted empower source this turn (47d — the per-idol model: the
 *  player picks WHICH idol's blessing goes on which card, so each granted
 *  `grantEmpowers` hook keeps its own budget + buff instead of folding into
 *  one config). `daemonId` labels the control + matches the chance-denied
 *  banner state in the pre-turn screen. */
export interface EmpowerGrant {
  daemonId: string;
  empowersPerTurn: number;
  buff: EmpowerConfig['buff'];
}

/** This turn's resolved pre-turn grants. Redraw stays ONE summed budget
 *  (redraws have no identity — the K3 validator eats the accumulated config);
 *  empowers are per-source (`EmpowerGrant[]`, empty = none granted).
 *  Round-trips in the Run save (v26, née `turnGates` v16): a save taken at
 *  the pre-turn gate must restore the SAME Mercury flip, never re-roll it. */
export interface TurnGrants {
  redraw: RedrawConfig;
  empowers: EmpowerGrant[];
}

/** The no-grant baseline: redraw disabled, no empower sources. */
export function disabledTurnGrants(): TurnGrants {
  return {
    redraw: { enabled: false, redrawsPerTurn: 0, maxCardsPerTurn: 0 },
    empowers: [],
  };
}

/** The per-firing chance condition. Draws only on a genuine coin flip
 *  (`0 < chance < 1`) — see the RNG contract above. Absent = 1 (granted). */
function granted(chance: number | undefined, rng: RNG): boolean {
  const c = chance ?? 1;
  if (c >= 1) return true;
  if (c <= 0) return false;
  return rng.next() < c;
}

/** Uniform run-start roll over the catalog (one draw off the daemon stream). */
export function rollDaemon(daemons: readonly DaemonConfig[], rng: RNG): DaemonConfig {
  return rng.pick(daemons);
}

/** The daemon's authored `turnStart` hooks, in rule order (the evaluation +
 *  draw order). Pure filter — no chance resolution here. */
function turnStartHooks(daemon: DaemonConfig): HookRule[] {
  return (daemon.rules ?? []).filter(
    (r): r is HookRule => r.kind === 'hook' && r.on === 'turnStart',
  );
}

/** The daemon's authored redraw grant hook, if any (the `turn:starting`
 *  payload's `redrawGate` — "does this idol EVER grant it", not "granted this
 *  turn"). First match wins; the catalog authors at most one per daemon. */
export function daemonRedrawHook(
  daemon: DaemonConfig | null,
): Extract<HookRule['effect'], { op: 'grantRedraws' }> | undefined {
  if (daemon === null) return undefined;
  for (const hook of turnStartHooks(daemon)) {
    if (hook.effect.op === 'grantRedraws') return hook.effect;
  }
  return undefined;
}

/** The daemon's authored empower grant hook, if any (payload `empowerGate` +
 *  the badge-column buff key — the DAEMON's own buff, not the resolved turn
 *  grant, so a chance-denied turn still badges existing stacks). */
export function daemonEmpowerHook(
  daemon: DaemonConfig | null,
): Extract<HookRule['effect'], { op: 'grantEmpowers' }> | undefined {
  if (daemon === null) return undefined;
  for (const hook of turnStartHooks(daemon)) {
    if (hook.effect.op === 'grantEmpowers') return hook.effect;
  }
  return undefined;
}

/**
 * Resolve one turn's grants from the owned daemons' `turnStart` hooks. An
 * empty list (a daemon-less run — the fuzz control arm) resolves to
 * all-disabled with no RNG draw. Daemons evaluate in OWNERSHIP order, rules
 * in authored order within each — the fixed draw-order discipline. A granted
 * `grantRedraws` ACCUMULATES onto the one redraw config (budgets sum); a
 * granted `grantEmpowers` PUSHES its own `EmpowerGrant` (47d — per-idol
 * empowers, the player picks which blessing lands where). Buffs are carried
 * by REFERENCE (safe: nothing mutates a buff — `empowerEffect` deep-copies
 * mods at apply time, and `turnGrants` is reassigned whole each turn).
 */
export function resolveTurnGrants(daemons: readonly DaemonConfig[], rng: RNG): TurnGrants {
  const grants = disabledTurnGrants();
  for (const daemon of daemons) {
    for (const hook of turnStartHooks(daemon)) {
      // Every turnStart hook rolls its chance in order (draw-count parity
      // with the L1 gate contract), granted or not consumed below.
      if (!granted(hook.chance, rng)) continue;
      switch (hook.effect.op) {
        case 'grantRedraws':
          grants.redraw = {
            enabled: true,
            redrawsPerTurn: grants.redraw.redrawsPerTurn + hook.effect.redrawsPerTurn,
            maxCardsPerTurn: grants.redraw.maxCardsPerTurn + hook.effect.maxCardsPerTurn,
          };
          break;
        case 'grantEmpowers':
          grants.empowers.push({
            daemonId: daemon.id,
            empowersPerTurn: hook.effect.empowersPerTurn,
            buff: hook.effect.buff,
          });
          break;
        default:
          // Instant run-ops (gainBits/healPool) execute at the fire site, not
          // in the grant fold — see the module header. Nothing to do here.
          break;
      }
    }
  }
  return grants;
}
