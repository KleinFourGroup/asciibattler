/**
 * §91a2 — THE CHIP RULE: what one turn's outcome charges each side's health
 * pool (the casualty rule, encounter-feel-spec §The casualty chip rule; kept
 * at §93).
 *
 * Each pool loses the power of ITS OWN fallen (a Pyrrhic victory costs; the
 * enemy pool reads "their strength — every kill removes some"; a player's
 * per-turn exposure is the power they fielded, so the risk line is a number
 * they can add up). That is the `casualties` rule.
 *
 * A turn that the driver's tick budget force-resolved (`reason === 'cap'`,
 * `World.resolveAsDraw`) ALSO pays the `survivors` rule: each pool loses the
 * OPPOSING side's standing Σ`power`. A stall pays its own fallen PLUS the
 * enemy's standing power — a surcharge, never a replacement, so kiting to
 * the cap is never cheaper than fighting. A MUTUAL WIPE is a `'draw'` too,
 * but it is the largest casualty turn there is, never a stall: it never pays
 * the surcharge (the §91 kickoff review's finding 3 — `checkBattleEnd` emits
 * 'draw' for it).
 *
 * Every charge is UNCAPPED pool-HP (× `chipMultiplier`): the caller clamps
 * at 0 when it applies, and reports both (the applied delta AND the charge —
 * the 89d rider: the overkill read needs the pre-clamp number). Pure —
 * `health` is injectable so the pins never mutate the live config.
 */

import { HEALTH, type HealthConfig } from '../config/health';

export type ChipRule = 'survivors' | 'casualties';
/** Why a battle ended (`battle:ended.reason`, §91a1). */
export type TurnEndReason = 'decisive' | 'mutualWipe' | 'cap';

export interface SidePower {
  readonly player: number;
  readonly enemy: number;
}

/** The uncapped pool-HP charge TO each side's pool this turn. */
interface TurnCharges {
  readonly player: number;
  readonly enemy: number;
}

/** The rules a turn ending for `reason` charges by: casualties, and on a
 *  cap turn the survivors surcharge as well. */
export function rulesForTurn(reason: TurnEndReason): ReadonlySet<ChipRule> {
  const rules = new Set<ChipRule>(['casualties']);
  if (reason === 'cap') rules.add('survivors');
  return rules;
}

/**
 * The turn's charges. `survivors` = each side's STANDING Σpower at battle
 * end (`battle:ended.survivorPower`); `fallen` = each side's REAPED Σpower
 * (`battle:ended.fallenPower`). Each pool pays its own fallen; a cap turn
 * adds the enemy's standing power to the player's pool (and vice versa).
 */
export function turnCharges(
  reason: TurnEndReason,
  survivors: SidePower,
  fallen: SidePower,
  health: Pick<HealthConfig, 'chipMultiplier'> = HEALTH,
): TurnCharges {
  const mult = health.chipMultiplier;
  let player = 0;
  let enemy = 0;
  if (rulesForTurn(reason).has('survivors')) {
    player += survivors.enemy * mult;
    enemy += survivors.player * mult;
  }
  player += fallen.player * mult;
  enemy += fallen.enemy * mult;
  return { player, enemy };
}

/**
 * §91d — the pre-turn RISK bound: the most the PLAYER pool can be charged
 * this turn, from what each side FIELDS (`player` = the hand's Σ base power,
 * `enemy` = the wave's): the whole hand falling. × `chipMultiplier`,
 * UNCAPPED (the caller clamps at the pool). The cap-turn surcharge is
 * deliberately outside it: the line bounds the ordinary turn, and a stall is
 * the exception it exists to make expensive.
 */
export function playerExposure(
  fielded: SidePower,
  health: Pick<HealthConfig, 'chipMultiplier'> = HEALTH,
): number {
  return fielded.player * health.chipMultiplier;
}

/** 96.5c2 — the ENEMY pool's mirror bound (the live bar's notch on their
 *  gauge): their own fielded wave falling. Same exclusions as
 *  `playerExposure` (base power; the cap surcharge outside). */
export function enemyExposure(
  fielded: SidePower,
  health: Pick<HealthConfig, 'chipMultiplier'> = HEALTH,
): number {
  return fielded.enemy * health.chipMultiplier;
}

/**
 * 96.5b1 — THE LOSS-EVENT MODEL (the live pool bar, Round 7 §96.5; the
 * user's design at the kickoff). The battle HUD moves each side's gauge by
 * a stream of LOSS EVENTS rather than by a projection, and each event fires
 * at the moment the rule makes the loss a FACT: a casualties loss at the
 * death (the dead unit's own side pays — the event's cause is the unit, so
 * the bar can be fed from its card); the cap surcharge only once the battle
 * has ended (a survivor's charge is not a fact until then), one event per
 * standing unit, paid by the OPPOSING pool. The event stream is
 * display-only — Run books the turn through `turnCharges` exactly as before
 * — and `sumLossEvents` over the whole stream equals `turnCharges` for every
 * reason (the chipRule.test pin), so the bar cannot disagree with what the
 * turn books.
 *
 * Everything here is pure; `health` is injectable like the rest of the file.
 */
type LossPhase = 'immediate' | 'end';

type LossCause = { readonly kind: 'unit'; readonly unitId: number; readonly team: 'player' | 'enemy' };

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
interface FallenUnit {
  readonly unitId: number;
  readonly team: 'player' | 'enemy' | 'neutral';
  readonly power: number;
}

/** A living on-grid combatant at battle end (`World.survivorsByUnit`). */
interface StandingUnit {
  readonly unitId: number;
  readonly team: 'player' | 'enemy';
  readonly power: number;
}

/** The IMMEDIATE event for one death: the dead unit's own side pays its
 *  booked power now. A zero booking (a summon) and a neutral emit nothing. */
export function lossEventsForDeath(
  death: FallenUnit,
  health: Pick<HealthConfig, 'chipMultiplier'> = HEALTH,
): readonly PoolLossEvent[] {
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

/** The END events for a turn ending for `reason`: on a cap turn, the
 *  survivors surcharge as one event per standing unit charged to the
 *  OPPOSING pool; otherwise none (every death already fired its immediate
 *  event). */
export function lossEventsAtEnd(
  reason: TurnEndReason,
  standing: readonly StandingUnit[],
  health: Pick<HealthConfig, 'chipMultiplier'> = HEALTH,
): readonly PoolLossEvent[] {
  const mult = health.chipMultiplier;
  const out: PoolLossEvent[] = [];
  if (rulesForTurn(reason).has('survivors')) {
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
  return out;
}

/** The loss already made a fact of BEFORE a consumer attached — a
 *  mid-battle restore opens the bar here: the booked fallen totals (every
 *  death's immediate event, summed). Off `World.fallenPowerSoFar()`. */
export function bookedImmediateLoss(
  fallen: SidePower,
  health: Pick<HealthConfig, 'chipMultiplier'> = HEALTH,
): SidePower {
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
