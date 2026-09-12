/**
 * §91a2 — THE CHIP RULE: what one turn's outcome charges each side's health
 * pool (the casualty experiment, encounter-feel-spec §The casualty chip rule).
 *
 * Two rules, both alive behind `health.chipMode`:
 * - `survivors` — the pre-§91 rule: each side's pool loses the OPPOSING
 *   side's standing Σ`power` (the loser pays the winner's survivors; a won
 *   turn costs 0; a lost turn costs most of the wave).
 * - `casualties` — each side's pool loses the power of ITS OWN fallen
 *   (a Pyrrhic victory costs; the enemy pool reads "their strength — every
 *   kill removes some"; a player's per-turn exposure is the power they
 *   fielded, so the risk line is a number they can add up).
 *
 * The CAP PENALTY (`health.capPenalty`) is the rule a turn that the driver's
 * tick budget force-resolved (`reason === 'cap'`, `World.resolveAsDraw`)
 * ALSO pays: the turn charges by every rule named in {chipMode, capPenalty}.
 * Under (casualties, survivors) a stall pays its own fallen PLUS the enemy's
 * standing power — a surcharge, never a replacement, so kiting to the cap is
 * never cheaper than fighting. Under (survivors, survivors) — the shipped
 * pair until 91e — a cap turn charges exactly what it did before §91
 * (byte-identical). A MUTUAL WIPE is a `'draw'` too, but it is the largest
 * casualty turn there is, never a stall: it never reads `capPenalty` (the
 * §91 kickoff review's finding 3 — `checkBattleEnd` emits 'draw' for it).
 *
 * Every charge is UNCAPPED pool-HP (× `chipMultiplier`): the caller clamps
 * at 0 when it applies, and reports both (the applied delta AND the charge —
 * the 89d rider: the overkill read needs the pre-clamp number). Pure —
 * `health` is injectable so the matrix pins never mutate the live config.
 */

import { HEALTH, type HealthConfig } from '../config/health';

export type ChipRule = HealthConfig['chipMode'];
/** Why a battle ended (`battle:ended.reason`, §91a1). */
export type TurnEndReason = 'decisive' | 'mutualWipe' | 'cap';

export interface SidePower {
  readonly player: number;
  readonly enemy: number;
}

/** The uncapped pool-HP charge TO each side's pool this turn. */
export interface TurnCharges {
  readonly player: number;
  readonly enemy: number;
}

/** The rules a turn ending for `reason` charges by (the set, so a cap turn
 *  under (survivors, survivors) is ONE rule, not the same rule twice). */
export function rulesForTurn(
  reason: TurnEndReason,
  health: Pick<HealthConfig, 'chipMode' | 'capPenalty'> = HEALTH,
): ReadonlySet<ChipRule> {
  const rules = new Set<ChipRule>([health.chipMode]);
  if (reason === 'cap') rules.add(health.capPenalty);
  return rules;
}

/**
 * The turn's charges. `survivors` = each side's STANDING Σpower at battle
 * end (`battle:ended.survivorPower`); `fallen` = each side's REAPED Σpower
 * (`battle:ended.fallenPower`). Under `survivors` the player's pool pays the
 * enemy's standing power (and vice versa); under `casualties` each pool pays
 * its own fallen. A cap turn adds the cap penalty's rule.
 */
export function turnCharges(
  reason: TurnEndReason,
  survivors: SidePower,
  fallen: SidePower,
  health: Pick<HealthConfig, 'chipMode' | 'capPenalty' | 'chipMultiplier'> = HEALTH,
): TurnCharges {
  const rules = rulesForTurn(reason, health);
  const mult = health.chipMultiplier;
  let player = 0;
  let enemy = 0;
  if (rules.has('survivors')) {
    player += survivors.enemy * mult;
    enemy += survivors.player * mult;
  }
  if (rules.has('casualties')) {
    player += fallen.player * mult;
    enemy += fallen.enemy * mult;
  }
  return { player, enemy };
}

/**
 * §91d — the pre-turn RISK bound: the most the PLAYER pool can be charged
 * this turn by `chipMode` alone, from what each side FIELDS (`player` = the
 * hand's Σ base power, `enemy` = the wave's). Survivors: the whole wave
 * standing → the enemy's fielded power; casualties: the whole hand falling →
 * the player's own. × `chipMultiplier`, UNCAPPED (the caller clamps at the
 * pool). The cap-turn surcharge (`capPenalty`) is deliberately outside it:
 * the line bounds the ordinary turn, and a stall is the exception it exists
 * to make expensive.
 */
export function playerExposure(
  fielded: SidePower,
  health: Pick<HealthConfig, 'chipMode' | 'chipMultiplier'> = HEALTH,
): number {
  const own = health.chipMode === 'casualties' ? fielded.player : fielded.enemy;
  return own * health.chipMultiplier;
}

/**
 * 96.5b1 — THE LOSS-EVENT MODEL (the live pool bar, Round 7 §96.5; the
 * user's design at the kickoff). The battle HUD moves each side's gauge by
 * a stream of LOSS EVENTS rather than by a projection, and each event fires
 * at the moment the rule makes the loss a FACT: a casualties loss at the
 * death (the dead unit's own side pays — the event's cause is the unit, so
 * the bar can be fed from its card); a survivors loss only once the battle
 * has ended (a survivor's charge is not a fact until then), one event per
 * standing unit, paid by the OPPOSING pool; the cap-turn surcharge is just
 * more end events. The event stream is display-only — Run books the turn
 * through `turnCharges` exactly as before — and `sumLossEvents` over the
 * whole stream equals `turnCharges` for every rule pair × reason (the
 * chipRule.test pin), so the bar cannot disagree with what the turn books.
 *
 * `cause.kind === 'team'` is the CAUSELESS shape: the cap surcharge under
 * (survivors, casualties) charges each side's fallen total at the end with
 * no per-unit rows to hand out, and a future flat turn-win/loss effect
 * (the kickoff's future-proofing — a rule not built here) would use it too;
 * a consumer with no card for a unit cause falls back to it as well.
 *
 * Everything here is pure; `health` is injectable like the rest of the file.
 */
export type LossPhase = 'immediate' | 'end';

export type LossCause =
  | { readonly kind: 'unit'; readonly unitId: number; readonly team: 'player' | 'enemy' }
  | { readonly kind: 'team'; readonly team: 'player' | 'enemy' };

export interface PoolLossEvent {
  /** The pool that pays. */
  readonly target: 'player' | 'enemy';
  /** Uncapped pool-HP (× `chipMultiplier`); the consumer clamps at the pool. */
  readonly amount: number;
  readonly phase: LossPhase;
  readonly cause: LossCause;
}

/** The `unit:died` payload's slice the model reads. `power` is the amount
 *  the World BOOKED (a summon 0, a neutral excluded by team). */
export interface FallenUnit {
  readonly unitId: number;
  readonly team: 'player' | 'enemy' | 'neutral';
  readonly power: number;
}

/** A living on-grid combatant at battle end (`World.survivorsByUnit`). */
export interface StandingUnit {
  readonly unitId: number;
  readonly team: 'player' | 'enemy';
  readonly power: number;
}

/** The IMMEDIATE events for one death: under casualties, the dead unit's
 *  own side pays its booked power now; under survivors a death charges
 *  nothing by itself (the loss lands on the killer's side's survivors at
 *  the end). A zero booking (a summon) and a neutral emit nothing. */
export function lossEventsForDeath(
  death: FallenUnit,
  health: Pick<HealthConfig, 'chipMode' | 'chipMultiplier'> = HEALTH,
): readonly PoolLossEvent[] {
  if (health.chipMode !== 'casualties') return [];
  if (death.team === 'neutral' || death.power <= 0) return [];
  return [
    {
      target: death.team,
      amount: death.power * health.chipMultiplier,
      phase: 'immediate',
      cause: { kind: 'unit', unitId: death.unitId, team: death.team },
    },
  ];
}

/** The END events for a turn ending for `reason`: the survivors rule (when
 *  the turn pays it) as one event per standing unit charged to the OPPOSING
 *  pool; the casualties rule ONLY when it is the cap surcharge over a
 *  survivors chip mode (under a casualties chip mode every death already
 *  fired its immediate event, and `rulesForTurn` is a set, so the rule is
 *  never paid twice) — then as one team-cause event per side off the
 *  booked fallen totals. */
export function lossEventsAtEnd(
  reason: TurnEndReason,
  standing: readonly StandingUnit[],
  fallen: SidePower,
  health: Pick<HealthConfig, 'chipMode' | 'capPenalty' | 'chipMultiplier'> = HEALTH,
): readonly PoolLossEvent[] {
  const rules = rulesForTurn(reason, health);
  const mult = health.chipMultiplier;
  const out: PoolLossEvent[] = [];
  if (rules.has('survivors')) {
    for (const u of standing) {
      if (u.power <= 0) continue;
      out.push({
        target: u.team === 'player' ? 'enemy' : 'player',
        amount: u.power * mult,
        phase: 'end',
        cause: { kind: 'unit', unitId: u.unitId, team: u.team },
      });
    }
  }
  if (rules.has('casualties') && health.chipMode !== 'casualties') {
    for (const side of ['player', 'enemy'] as const) {
      if (fallen[side] <= 0) continue;
      out.push({
        target: side,
        amount: fallen[side] * mult,
        phase: 'end',
        cause: { kind: 'team', team: side },
      });
    }
  }
  return out;
}

/** The loss already made a fact of BEFORE a consumer attached — a
 *  mid-battle restore opens the bar here: under casualties the booked
 *  fallen totals (every death's immediate event, summed); under survivors
 *  nothing has fired yet. Off `World.fallenPowerSoFar()`. */
export function bookedImmediateLoss(
  fallen: SidePower,
  health: Pick<HealthConfig, 'chipMode' | 'chipMultiplier'> = HEALTH,
): SidePower {
  if (health.chipMode !== 'casualties') return { player: 0, enemy: 0 };
  return { player: fallen.player * health.chipMultiplier, enemy: fallen.enemy * health.chipMultiplier };
}

/** Σ amount per paying side over a stream — the pin's left-hand side. */
export function sumLossEvents(events: readonly PoolLossEvent[]): TurnCharges {
  let player = 0;
  let enemy = 0;
  for (const e of events) {
    if (e.target === 'player') player += e.amount;
    else enemy += e.amount;
  }
  return { player, enemy };
}
