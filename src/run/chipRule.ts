/**
 * The chip rule: what one turn's outcome charges each side's health pool.
 * Its design and the reasons for it are in DESIGN.md, "The encounter loop +
 * the chip rule".
 *
 * Each pool loses the power of its own fallen: the `casualties` rule. A turn
 * the driver's time budget resolved (`reason === 'cap'`,
 * `World.resolveAsDraw`) also pays the `survivors` rule, each pool losing
 * the opposing side's standing power, as a surcharge on top of its own
 * fallen, so running out the clock is never cheaper than fighting. A mutual
 * wipe is a draw too, but with its own reason (`mutualWipe`), and pays its
 * fallen alone.
 *
 * Every charge is in pool points, times `chipMultiplier` and not capped: the
 * caller clamps the pool at 0 as it applies a charge, and reports both the
 * applied loss and the charge (`pools:chipped`), since a read of overkill
 * needs the charge. Pure; `health` is a parameter so a test never edits the
 * live config.
 */

import { HEALTH, type HealthConfig } from '../config/health';

export type ChipRule = 'survivors' | 'casualties';
/** Why a battle ended (`battle:ended.reason`). */
export type TurnEndReason = 'decisive' | 'mutualWipe' | 'cap';

export interface SidePower {
  readonly player: number;
  readonly enemy: number;
}

/** The charge to each side's pool this turn, not capped. */
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
 * The turn's charges. `survivors` is each side's standing power at the
 * battle's end (`battle:ended.survivorPower`), `fallen` each side's booked
 * fallen power (`battle:ended.fallenPower`). Each pool pays its own fallen,
 * and on a cap turn the other side's standing power as well.
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
 * The pre-turn risk bound: the most the player's pool can be charged this
 * turn, from what each side fields (`player` the hand's base power, `enemy`
 * the wave's), which is the whole hand falling. Times `chipMultiplier`; the
 * caller caps it at the pool. A cap turn's surcharge is left out on purpose:
 * the line bounds an ordinary turn, and a stall is the exception the
 * surcharge makes expensive.
 */
export function playerExposure(
  fielded: SidePower,
  health: Pick<HealthConfig, 'chipMultiplier'> = HEALTH,
): number {
  return fielded.player * health.chipMultiplier;
}

/** The enemy pool's bound, for the notch on its gauge: its own fielded wave
 *  falling, in base power, with the cap surcharge left out as in
 *  `playerExposure`. */
export function enemyExposure(
  fielded: SidePower,
  health: Pick<HealthConfig, 'chipMultiplier'> = HEALTH,
): number {
  return fielded.enemy * health.chipMultiplier;
}

/**
 * The loss events. The battle HUD moves each side's gauge by a stream of
 * loss events rather than by a projection, and each fires when the rule
 * makes the loss a fact: a casualty at the death, paid by the dead unit's
 * own side, with the unit as its cause so the bar can be fed from its card;
 * the cap surcharge only once the battle has ended, since a survivor's
 * charge is not a fact before then, one event per standing unit, paid by the
 * opposing pool. The stream is for display: `Run` books the turn through
 * `turnCharges`, and `sumLossEvents` over a whole stream equals
 * `turnCharges` for every reason (`chipRule.test.ts`), so the bar cannot
 * disagree with what the turn books.
 */
type LossPhase = 'immediate' | 'end';

type LossCause = { readonly kind: 'unit'; readonly unitId: number; readonly team: 'player' | 'enemy' };

export interface PoolLossEvent {
  /** The pool that pays. */
  readonly target: 'player' | 'enemy';
  /** Pool points times `chipMultiplier`, not capped; the reader clamps at the
   *  pool. */
  readonly amount: number;
  readonly phase: LossPhase;
  readonly cause: LossCause;
}

/** The slice of `unit:died` the model reads. `power` is what the World
 *  booked: 0 for a summon, and a neutral is left out by its team. */
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

/** The immediate event for one death: the dead unit's own side pays its
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

/** The end events for a turn ending for `reason`: on a cap turn, the
 *  survivors surcharge, one event per standing unit charged to the opposing
 *  pool; otherwise none, since every death already fired its own. */
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

/** The loss already a fact before a reader attached, where a mid-battle
 *  restore opens the bar: the booked fallen totals, every death's immediate
 *  event summed. From `World.fallenPowerSoFar()`. */
export function bookedImmediateLoss(
  fallen: SidePower,
  health: Pick<HealthConfig, 'chipMultiplier'> = HEALTH,
): SidePower {
  return { player: fallen.player * health.chipMultiplier, enemy: fallen.enemy * health.chipMultiplier };
}

/** The sum per paying side over a stream, which `chipRule.test.ts` holds to
 *  `turnCharges`. */
export function sumLossEvents(events: readonly PoolLossEvent[]): TurnCharges {
  let player = 0;
  let enemy = 0;
  for (const e of events) {
    if (e.target === 'player') player += e.amount;
    else enemy += e.amount;
  }
  return { player, enemy };
}
