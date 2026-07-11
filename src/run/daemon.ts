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
 * availability IS the fold of the daemon's granted `turnStart` grant hooks.
 * 49d re-modeled the resolution into THE GRANT QUEUE (`TurnGrant[]`, one
 * entry per granted hook in walk order) — the strict-mode ordering surface
 * of the §49 fire-UX shape-lock. The roguelite variance is the point: a
 * run's idol defines which pre-turn tools exist at all.
 *
 * 47e — instant (non-grant) run-domain ops. A granted `turnStart`
 * `gainBits`/`healPool` hook rides the SAME walk as the grants (its coin
 * already flips there — the draw-count parity 47c preserved on purpose;
 * never add a second walk, it would double-draw) and comes back in
 * `TurnStartResolution.instants` for the caller to execute at the fire
 * site. `encounterStart`/`encounterEnd` hooks resolve via
 * `resolveInstantHooks` at THEIR fire sites (Run.beginEncounter /
 * Run.finishEncounter). Instants are executed immediately and never
 * serialized — a save taken after the fire site has already banked their
 * effects (`run.bits` / `playerHealth`).
 *
 * RNG contract (unchanged from L1): a hook draws from the daemon stream ONLY
 * when its `chance` is strictly between 0 and 1 (absent = 1; a deterministic
 * hook costs no draw, so adding a chance-less daemon never shifts another
 * daemon's flips). Within a turn, hooks are evaluated in AUTHORED RULE ORDER —
 * the fixed-order discipline the L1 redraw-then-empower contract generalized
 * into (a daemon carrying both authors its redraw hook first).
 */

import { TRIGGER_DOMAIN, type DaemonConfig, type EffectOp, type HookRule } from '../config/daemons';
import type { EmpowerConfig } from '../config/empower';
import type { RNG } from '../core/RNG';
import type { BattleRule, BattleRuleTrigger } from '../sim/battleRules';

/** 47e — the instant (non-grant) run-domain ops a hook can carry: executed
 *  at the trigger fire site the moment they resolve, never serialized. */
export type InstantOp = Extract<EffectOp, { op: 'gainBits' } | { op: 'healPool' }>;

/** 49d — one grant's effect in the queue. Budgets unify onto `budget`
 *  (actions from this grant); redraw carries its per-action card cap,
 *  empower its buff. */
export type GrantEffect =
  | { kind: 'redraw'; budget: number; maxCards: number }
  | { kind: 'empower'; budget: number; buff: EmpowerConfig['buff'] };

/**
 * 49d — one granted pre-turn tool: an entry in the ORDERED grant queue (the
 * §49 fire-UX shape-lock — this re-models 47d's `{redraw, empowers}` split
 * and deliberately REVERSES the "redraw stays one summed budget" call:
 * every grant is per-source and packet-shaped). `used`/`passed` are ENGINE
 * state, serialized (v32): `used` counts actions consumed; `passed` is the
 * strict-mode finality mark (`passGrant` — free mode never sets it).
 * `daemonId` names the source (49e packet fires push their own entries).
 */
export interface TurnGrant {
  daemonId: string;
  effect: GrantEffect;
  used: number;
  passed: boolean;
}

/** 49d — the queue IS the turn's grants (ownership order, rules in authored
 *  order within each idol — the resolve walk order). Round-trips in the Run
 *  save: a save at the gate restores the same flips AND the same cursor. */
export type TurnGrants = TurnGrant[];

/** The no-grant baseline: an empty queue. */
export function disabledTurnGrants(): TurnGrants {
  return [];
}

/** 49d — the queue cursor: the first grant still pending (not passed, budget
 *  left), or null when the queue is spent. DERIVED, never serialized —
 *  recomputes from the entries (derive-don't-cache). */
export function activeGrantIndex(grants: TurnGrants): number | null {
  for (let i = 0; i < grants.length; i++) {
    const grant = grants[i]!;
    if (!grant.passed && grant.used < grant.effect.budget) return i;
  }
  return null;
}

/** 49d — one grant as the UI/fuzz payloads carry it (`turn:starting` etc.):
 *  the queue entry plus its index (the command key), remaining budget, and
 *  the derived cursor flag. */
export interface TurnGrantView {
  grantIndex: number;
  daemonId: string;
  name: string;
  effect: GrantEffect;
  remaining: number;
  passed: boolean;
  active: boolean;
}

/** Build the payload views (pure — the name lookup is injected). `active`
 *  marks the cursor in BOTH modes; strict mode enforces it, free mode may
 *  merely highlight it. */
export function grantViews(
  grants: TurnGrants,
  nameOf: (daemonId: string) => string,
): TurnGrantView[] {
  const cursor = activeGrantIndex(grants);
  return grants.map((grant, grantIndex) => ({
    grantIndex,
    daemonId: grant.daemonId,
    name: nameOf(grant.daemonId),
    effect: grant.effect,
    remaining: Math.max(0, grant.effect.budget - grant.used),
    passed: grant.passed,
    active: grantIndex === cursor,
  }));
}

/** 47e — one turn-start walk's full result: the serialized grants (round-trip
 *  in the Run save) plus this turn's granted instant ops (executed at the
 *  fire site, then discarded — see the module header). */
export interface TurnStartResolution {
  grants: TurnGrants;
  instants: InstantOp[];
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
 * Resolve one turn's grants + granted instant ops from the owned daemons'
 * `turnStart` hooks. An empty list (a daemon-less run — the fuzz control
 * arm) resolves to an empty queue with no RNG draw. Daemons evaluate in
 * OWNERSHIP order, rules in authored order within each — the fixed
 * draw-order discipline, and (49d) the queue order the strict mode
 * enforces: EVERY granted hook pushes its own `TurnGrant` entry (the §49
 * per-source re-model — a granted `grantRedraws` no longer sums onto one
 * config; Mercury and Janus each prompt their own redraw). A granted
 * instant op (`gainBits`/`healPool`) collects into `instants` for the
 * caller to execute at the fire site (47e — the coin flip happens HERE, in
 * the one walk; see the module header). The DRAW COUNT is byte-identical
 * to the 47d walk — only the accumulation changed. Buffs are carried by
 * REFERENCE (safe: nothing mutates a buff — `empowerEffect` deep-copies
 * mods at apply time; the queue entries' `used`/`passed` mutate, the buffs
 * never do).
 */
export function resolveTurnGrants(
  daemons: readonly DaemonConfig[],
  rng: RNG,
): TurnStartResolution {
  const grants: TurnGrants = [];
  const instants: InstantOp[] = [];
  for (const daemon of daemons) {
    for (const hook of turnStartHooks(daemon)) {
      // Every turnStart hook rolls its chance in order (draw-count parity
      // with the L1 gate contract), granted or not consumed below.
      if (!granted(hook.chance, rng)) continue;
      switch (hook.effect.op) {
        case 'grantRedraws':
          grants.push({
            daemonId: daemon.id,
            effect: {
              kind: 'redraw',
              budget: hook.effect.redrawsPerTurn,
              maxCards: hook.effect.maxCardsPerTurn,
            },
            used: 0,
            passed: false,
          });
          break;
        case 'grantEmpowers':
          grants.push({
            daemonId: daemon.id,
            effect: {
              kind: 'empower',
              budget: hook.effect.empowersPerTurn,
              buff: hook.effect.buff,
            },
            used: 0,
            passed: false,
          });
          break;
        case 'gainBits':
        case 'healPool':
          instants.push(hook.effect);
          break;
        default:
          // A battle-domain op (`applyStatus`) on a run trigger is
          // parse-illegal (the 47b matrix); only a bespoke in-memory daemon
          // could author one. Skip it — battle ops compile at 47f.
          break;
      }
    }
  }
  return { grants, instants };
}

/** 47e — the filter context a run-lifecycle firing carries. `won` exists
 *  only at `encounterEnd` (the 47b matrix pins the `won` filter there). */
export interface RunFireContext {
  won?: boolean;
}

/**
 * 47e — resolve the granted instant ops for an `encounterStart` /
 * `encounterEnd` firing (the `turnStart` instants ride `resolveTurnGrants`
 * instead — one walk, one coin). Same ordering discipline: daemons in
 * ownership order, rules in authored order.
 *
 * The FILTER gates before the chance rolls: a firing that doesn't match
 * (`won: true` on a lost encounter) costs no draw — the filter is part of
 * "did this hook fire at all", matching how the 47f battle-side filters
 * will behave at the sim chokepoints. Determinism holds either way (the
 * outcome itself is seed-determined); parity just stays easy to reason
 * about: draws happen only for matching, coin-carrying firings.
 */
/**
 * 47f — compile the owned daemons' BATTLE-domain hooks into the plain
 * `BattleRule[]` the World installs at battle setup (the spec's first seam
 * crossing — see src/sim/battleRules.ts for the evaluation semantics).
 * Daemons in ownership order, rules in authored order — the same fixed
 * evaluation discipline as the run-domain walks, carried across the seam.
 * The parse-time matrix (config/daemons.ts) guarantees a battle-trigger
 * hook's op is `gainBits`/`applyStatus` and its filter is battle-legal; a
 * bespoke in-memory daemon violating that throws loudly here.
 */
export function battleRulesFor(daemons: readonly DaemonConfig[]): BattleRule[] {
  const rules: BattleRule[] = [];
  for (const daemon of daemons) {
    for (const rule of daemon.rules ?? []) {
      if (rule.kind !== 'hook' || TRIGGER_DOMAIN[rule.on] !== 'battle') continue;
      if (rule.effect.op !== 'gainBits' && rule.effect.op !== 'applyStatus') {
        throw new Error(
          `battleRulesFor: daemon '${daemon.id}' authors op '${rule.effect.op}' on battle trigger '${rule.on}' (parse-illegal — bespoke daemon?)`,
        );
      }
      const compiled: BattleRule = {
        on: rule.on as BattleRuleTrigger,
        effect: rule.effect,
      };
      if (rule.chance !== undefined) compiled.chance = rule.chance;
      if (rule.filter !== undefined) {
        compiled.filter = {};
        if (rule.filter.archetype !== undefined) compiled.filter.archetype = rule.filter.archetype;
        if (rule.filter.crit !== undefined) compiled.filter.crit = rule.filter.crit;
      }
      rules.push(compiled);
    }
  }
  return rules;
}

/**
 * 51a — the daemons that EARN battle-tally bits: ids of owned daemons
 * authoring a battle-domain `gainBits` hook (ownership order). The reward
 * offer's tally portion is source-labeled only when this is a singleton —
 * the World tally is one aggregate number, so a multi-earner run can't
 * attribute it (revisit per-source tallies if content ever ships a second
 * battle-bits idol worth crediting separately).
 */
export function battleBitsDaemonIds(daemons: readonly DaemonConfig[]): string[] {
  const ids: string[] = [];
  for (const daemon of daemons) {
    const earns = (daemon.rules ?? []).some(
      (r) =>
        r.kind === 'hook' &&
        TRIGGER_DOMAIN[r.on] === 'battle' &&
        r.effect.op === 'gainBits',
    );
    if (earns) ids.push(daemon.id);
  }
  return ids;
}

export function resolveInstantHooks(
  daemons: readonly DaemonConfig[],
  on: 'encounterStart' | 'encounterEnd',
  ctx: RunFireContext,
  rng: RNG,
): InstantOp[] {
  const instants: InstantOp[] = [];
  for (const daemon of daemons) {
    for (const rule of daemon.rules ?? []) {
      if (rule.kind !== 'hook' || rule.on !== on) continue;
      if (rule.filter?.won !== undefined && rule.filter.won !== (ctx.won ?? false)) continue;
      if (!granted(rule.chance, rng)) continue;
      if (rule.effect.op === 'gainBits' || rule.effect.op === 'healPool') {
        instants.push(rule.effect);
      }
      // Grant ops are turnStart-only and battle ops are parse-illegal here
      // (the 47b matrix) — anything else on these triggers is a bespoke
      // in-memory authoring error and is skipped.
    }
  }
  return instants;
}
