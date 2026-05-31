import type { Unit } from './Unit';
import type { World } from './World';
import type { GridCoord } from '../core/types';

/**
 * F2 — the closed set of phase names an action's timeline can use. Fighting
 * games call these startup → active → recovery; MOBAs call it cast-point +
 * projectile travel. The effect lands on the `impact` phase, not frame 0.
 * Keep the set small + closed: adding a member is a deliberate schema event
 * (a union edit, plus a snapshot bump if the serialized shape changes), the
 * same discipline as the stat block.
 *
 *  - windup   — charging / anticipation; no effect lands.
 *  - release  — the projectile / charge leaves the caster (F3 launch hook).
 *  - travel   — projectile in flight. A real, tick-counted SIM phase
 *               (deterministic arrival tick), but 0-length for every action
 *               in F2 — F3 gives it real ticks; the orphan check covers it.
 *  - impact   — THE effect boundary. `Action.applyEffect` fires here.
 *  - recovery — follow-through / lockout tail; no effect.
 *
 * Most actions use a subset: a basic strike is `impact` (offset 0) +
 * `recovery`; a charged spell is `windup` + `impact`.
 */
export type ActionPhaseName = 'windup' | 'release' | 'travel' | 'impact' | 'recovery';

/**
 * One entry in an action's ordered phase timeline. `ticks` is the phase's
 * duration in sim ticks (>= 0); 0 is an instantaneous boundary that
 * fires-and-advances in the same tick as the next phase (e.g. a strike's
 * `impact`). An action's total busy window is the SUM of its phases' ticks.
 */
export interface ActionPhase {
  readonly phase: ActionPhaseName;
  readonly ticks: number;
}

/**
 * F2 — declared per-action handling for "the locked target died before the
 * effect lands" (during `windup` or `travel`). A closed menu:
 *
 *  - `commit-at-cast` — resolve against the ref captured at cast, with a
 *    dead-target guard (strikes, heal). Single-tick today, so the window is
 *    zero, but named for completeness.
 *  - `fizzle` — abort if the locked target died (catapult): no damage, no
 *    `combatRng` draw. The shot still announces itself (a dud), so it's not
 *    silent.
 *  - `ground-target` — hit the cell, whoever is standing there (mage AoE).
 *    The target ref is irrelevant at impact.
 *  - `re-home` — retarget mid-flight. DECLARED ONLY in F2 — no action uses
 *    it (it reads as unfair); a future consumer wires it behind an
 *    `assertNever` that forces the switch arm to exist.
 *
 * F2 is behavior-preserving: the death-guard still lives in each action's
 * effect site (`start` / `applyEffect`). This field is the *declared
 * contract* the F3 travel-orphan resolver will switch on.
 */
export type OrphanPolicy = 'commit-at-cast' | 'fizzle' | 'ground-target' | 're-home';

/**
 * An action is the "verb" a unit performs on a tick: move one cell, swing
 * the sword, channel a heal. Per-unit timing (cooldown, the phase timeline)
 * is carried by `ActionProposal`, not the Action itself, because per-unit
 * stat rolls vary those numbers. Move/Attack capture their other parameters
 * (target unit, dest cell, damage) on the instance at propose time, since
 * those vary per call.
 *
 * For single-tick actions, `start` does all the work (position update,
 * damage, event emission) and `applyEffect` is absent. Multi-tick actions
 * (charged spells, lobbed shots) leave `start` a near-no-op and land their
 * effect in `applyEffect`, which `World.tick` fires at the `impact` phase
 * boundary — see `ActionProposal.phases`.
 *
 * `toData()` returns the plain-JSON payload sufficient to reconstruct this
 * Action via its registered factory (see `src/sim/actions/registry.ts`).
 * Needed for `World` snapshots — when a unit's `activeAction` is in flight
 * mid-tick, the snapshot has to carry enough state for future `applyEffect`
 * calls after rehydrate.
 */
export interface Action {
  readonly id: string;
  /**
   * F2 — the action's orphan policy (see `OrphanPolicy`). Optional; absent
   * is treated as `commit-at-cast` (the single-tick default). Intrinsic to
   * the action class, so it's NOT serialized — `fromData` rebuilds the same
   * class, which re-declares it.
   */
  readonly orphanPolicy?: OrphanPolicy;
  start(unit: Unit, world: World): void;
  /**
   * Fired at the `impact` phase boundary (the only phase carrying an effect
   * in F2). `tickOffset` is ticks-from-start; `phase` is the boundary that
   * fired it (always `'impact'` today — passed for forward-compat with
   * future multi-effect timelines). Absent on actions whose work is all in
   * `start`.
   */
  applyEffect?(unit: Unit, world: World, tickOffset: number, phase?: ActionPhaseName): void;
  /**
   * F2 — optional target info for the `action:phase` event the renderer
   * schedules against, surfaced without exposing the action's internals: a
   * homing action returns `{ targetId }`, a ground-target returns
   * `{ targetCell }`. Absent → `{}` (self / no-target actions like move).
   */
  phaseTarget?(): { targetId?: number | undefined; targetCell?: GridCoord | undefined };
  toData(): unknown;
}

/**
 * A behavior's offer to the action selector. Carries the per-unit timing
 * (cooldown + the phase timeline) so Action singletons stay stat-free.
 *
 * - `cooldown`: ticks before *this same* action (keyed by `cooldownKey`)
 *   can be proposed again. Decremented once per tick by World; the selector
 *   filters out proposals whose remaining cooldown is > 0. Independent of
 *   the phase timeline — a long-cooldown skill finishes its phases and still
 *   can't be re-proposed until the cooldown elapses.
 * - `phases` (F2): the action's ordered phase timeline. Replaces the pre-F2
 *   `duration` + `effectTicks` pair — the unit is busy for the SUM of every
 *   phase's `ticks` (the old `duration`), and `applyEffect` fires at the
 *   `impact` boundary (the old `effectTicks`). A basic strike is
 *   `[{impact,0},{recovery,D}]`; a charged spell is `[{windup,D},{impact,0}]`.
 *   For simple single-tick actions `cooldown` equals the total phase ticks;
 *   for charge-ups they may differ.
 * - `cooldownKey` (E2): selector key for `unit.actionCooldowns`. Defaults
 *   to `action.id` (the pre-E2 behavior); abilities override with their
 *   own id so a multi-ability unit gets independent cooldowns even when
 *   two abilities wrap the same Action class.
 */
export interface ActionProposal {
  readonly action: Action;
  readonly score: number;
  readonly cooldown: number;
  readonly phases: readonly ActionPhase[];
  readonly cooldownKey?: string;
}

/**
 * Set on a unit while an action is in flight. The action's busy window runs
 * from `startTick` to `finishTick` (exclusive of finish: `currentTick >=
 * finishTick` means the unit is free again). `World.tick()` emits an
 * `action:phase` event at each phase boundary (the offset where a phase
 * begins) and fires `applyEffect` at the `impact` boundary. The current
 * phase is derived from `currentTick - startTick` against `phases`, so a
 * mid-flight snapshot resumes on the right phase automatically.
 */
export interface ActiveAction {
  readonly action: Action;
  readonly startTick: number;
  readonly finishTick: number;
  readonly phases: readonly ActionPhase[];
}

/** Total busy duration of a phase timeline = Σ phase ticks. */
export function totalTicks(phases: readonly ActionPhase[]): number {
  let n = 0;
  for (const p of phases) n += p.ticks;
  return n;
}

/**
 * The phase names whose cumulative start-offset equals `offset`, in declared
 * order. A phase "begins" at the running sum of all prior phases' ticks;
 * because zero-length phases share their boundary offset with the next
 * phase, several names can come back for one offset — they fire-and-advance
 * in the same tick (e.g. a lobbed shot's `release`/`travel`/`impact` at the
 * end of its wind-up).
 */
export function phasesBeginningAt(
  phases: readonly ActionPhase[],
  offset: number,
): ActionPhaseName[] {
  const out: ActionPhaseName[] = [];
  let acc = 0;
  for (const p of phases) {
    if (acc === offset) out.push(p.phase);
    acc += p.ticks;
  }
  return out;
}
