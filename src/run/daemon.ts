/**
 * The daemons' rules, pure so they are tested without a `Run` (the daemons
 * and the RNG are parameters): each turn's grant queue and instant ops from
 * the owned daemons' `turnStart` hooks, the instant ops of an encounter's
 * start and end, and the battle rules handed to the World. `Run` calls them
 * at each turn's start, at an encounter's start and end, and at battle
 * setup. A run's daemons decide which pre-turn tools exist at all.
 *
 * A turn's grants are its queue (`TurnGrant[]`): each granted `grantRedraws`
 * or `grantEmpowers` hook is its own entry, in walk order, the order strict
 * mode makes the player take them in.
 *
 * Instant ops (`gainBits`, `healPool`): a `turnStart` hook's are resolved in
 * the same walk as the grants and come back in
 * `TurnStartResolution.instants` for `Run` to execute, since a second walk
 * would flip each coin twice (gotcha #115). `encounterStart` and
 * `encounterEnd` hooks resolve through `resolveInstantHooks` at their own
 * sites (`Run.beginEncounter`, `Run.finishEncounter`). Instants are executed
 * at once and never saved: a save after the site already holds their effect
 * in `bits` or `playerHealth`.
 *
 * Draws: a hook draws from the daemon stream only when its `chance` is
 * strictly between 0 and 1 (absent is 1), so a daemon without chances never
 * shifts another daemon's flips. Daemons are walked in ownership order and
 * each one's rules in authored order, so a daemon with a redraw and an
 * empower hook rolls them in the order it lists them.
 */

import { TRIGGER_DOMAIN, type DaemonConfig, type EffectOp, type HookRule } from '../config/daemons';
import type { EmpowerConfig } from '../config/empower';
import type { RNG } from '../core/RNG';
import type { BattleRule, BattleRuleTrigger } from '../sim/battleRules';

/** The instant run ops a hook can carry: executed at the trigger's site as
 *  soon as they resolve, and never saved. */
export type InstantOp = Extract<EffectOp, { op: 'gainBits' } | { op: 'healPool' }>;

/** One grant's effect: `budget` is the actions it gives; a redraw carries
 *  its per-action card cap, an empower its buff. */
type GrantEffect =
  | { kind: 'redraw'; budget: number; maxCards: number }
  | { kind: 'empower'; budget: number; buff: EmpowerConfig['buff'] };

/**
 * One granted pre-turn tool, an entry in the turn's grant queue; every grant
 * is its own entry, per source. `used` and `passed` are saved with the run:
 * `used` counts the actions taken, and `passed` is strict mode's mark that
 * the grant was closed unspent (`passGrant`; free mode never sets it).
 * `daemonId` names the source: a daemon, or for a packet's grant the packet.
 */
export interface TurnGrant {
  daemonId: string;
  effect: GrantEffect;
  used: number;
  passed: boolean;
}

/** The turn's grants in queue order: the owned daemons in ownership order
 *  and each one's rules in authored order, as the walk resolves them, with
 *  a packet's grant put in at the cursor so it is the active one at once
 *  (`Run.handleUsePacket`). Saved with the run, so a save at the gate
 *  restores the same flips and the same cursor. */
export type TurnGrants = TurnGrant[];

/** The no-grant baseline: an empty queue. */
export function disabledTurnGrants(): TurnGrants {
  return [];
}

/** The queue's cursor: the first grant still pending (not passed, budget
 *  left), or null when the queue is spent. Derived from the entries, never
 *  saved. */
export function activeGrantIndex(grants: TurnGrants): number | null {
  for (let i = 0; i < grants.length; i++) {
    const grant = grants[i]!;
    if (!grant.passed && grant.used < grant.effect.budget) return i;
  }
  return null;
}

/** One grant as the payloads carry it (`turn:starting` and the others): the
 *  entry with its index (the commands' key), its remaining budget, and
 *  whether it is the cursor. */
export interface TurnGrantView {
  grantIndex: number;
  daemonId: string;
  name: string;
  effect: GrantEffect;
  remaining: number;
  passed: boolean;
  active: boolean;
}

/** Build the views; the name lookup is passed in. `active` marks the cursor
 *  in both modes: strict mode enforces it, free mode may only highlight it. */
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

/** One turn-start walk's result: the grants, saved with the run, and the
 *  turn's granted instant ops, executed at the site and then dropped (the
 *  header). */
interface TurnStartResolution {
  grants: TurnGrants;
  instants: InstantOp[];
}

/** One firing's chance test: draws only on a real coin flip
 *  (`0 < chance < 1`, the header), and an absent chance is 1. */
function granted(chance: number | undefined, rng: RNG): boolean {
  const c = chance ?? 1;
  if (c >= 1) return true;
  if (c <= 0) return false;
  return rng.next() < c;
}

/** The daemon's `turnStart` hooks, in rule order, which is the order they
 *  are evaluated and draw in. A filter only; chances resolve elsewhere. */
function turnStartHooks(daemon: DaemonConfig): HookRule[] {
  return (daemon.rules ?? []).filter(
    (r): r is HookRule => r.kind === 'hook' && r.on === 'turnStart',
  );
}

/** The daemon's authored redraw hook, if any: whether it ever grants a
 *  redraw, not whether it did this turn (the `turn:starting` payload's
 *  `redrawGate`). The first wins; the catalog authors at most one a daemon. */
export function daemonRedrawHook(
  daemon: DaemonConfig | null,
): Extract<HookRule['effect'], { op: 'grantRedraws' }> | undefined {
  if (daemon === null) return undefined;
  for (const hook of turnStartHooks(daemon)) {
    if (hook.effect.op === 'grantRedraws') return hook.effect;
  }
  return undefined;
}

/** The daemon's authored empower hook, if any (`empowerGate`, and the buff
 *  key the badges read): the daemon's own buff, not the turn's resolved
 *  grant, so a turn whose chance failed still badges the stacks a card has. */
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
 * Resolve one turn's grants and granted instant ops from the owned daemons'
 * `turnStart` hooks. No daemons (the fuzz's daemon-less control arm)
 * resolves to an empty queue with no draw. Daemons in ownership order,
 * rules in authored order: that is the draw order, and the queue's, which
 * strict mode enforces. Every granted grant hook pushes its own entry, so
 * two daemons that grant redraws (Mercury, Janus) each prompt their own. A
 * granted instant op goes to `instants`, its coin flipped here, in the one
 * walk (the header). Buffs are carried by reference, which is safe because
 * nothing mutates a buff: `empowerEffect` copies the mods when it applies
 * them, and only an entry's `used` and `passed` change.
 */
export function resolveTurnGrants(
  daemons: readonly DaemonConfig[],
  rng: RNG,
): TurnStartResolution {
  const grants: TurnGrants = [];
  const instants: InstantOp[] = [];
  for (const daemon of daemons) {
    for (const hook of turnStartHooks(daemon)) {
      // Every `turnStart` hook rolls its chance, in order and whatever its
      // op, so the draw count does not depend on what the switch consumes.
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
          // A battle op (`applyStatus`) on a run trigger fails the schema's
          // domain check (`config/daemons.ts`), so only a daemon built in
          // memory could carry one. Skipped: battle ops compile in
          // `battleRulesFor`.
          break;
      }
    }
  }
  return { grants, instants };
}

/** The filter context a run firing carries. `won` exists only at
 *  `encounterEnd`, the one trigger the schema lets a `won` filter sit on. */
interface RunFireContext {
  won?: boolean;
}

/**
 * Compile the owned daemons' battle hooks into the `BattleRule[]` the World
 * installs at battle setup (the evaluation is in `src/sim/battleRules.ts`).
 * Daemons in ownership order, rules in authored order, as in the run walks.
 * The schema (`config/daemons.ts`) keeps a battle hook's op to `gainBits` or
 * `applyStatus` and its filter to the battle filters; a daemon built in
 * memory that breaks this throws here.
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
 * The owned daemons that earn battle bits: the ids of those with a battle
 * `gainBits` hook, in ownership order. With the injected rules' sources
 * they are the earners `Run.handleTurnEnded` credits the tally portion to,
 * which it does only when there is one, since the World's tally is a single
 * number.
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

/**
 * Resolve the granted instant ops of an `encounterStart` or `encounterEnd`
 * firing; `turnStart`'s ride `resolveTurnGrants`, one walk and one coin. The
 * same order: daemons in ownership order, rules in authored order.
 *
 * The filter is tested before the chance: a firing that does not match
 * (`won: true` on a lost encounter) costs no draw, as a battle rule's filter
 * costs none (`src/sim/battleRules.ts`), so draws happen only for matching
 * firings that carry a coin.
 */
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
      // The schema allows grant ops on `turnStart` alone and battle ops on
      // battle triggers alone, so anything else here is a daemon built in
      // memory, and is skipped.
    }
  }
  return instants;
}
