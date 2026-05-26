/**
 * The canonical event catalog. Adding a new event? Add it here first so the
 * type system can guide every emitter and subscriber. Naming convention:
 * `subject:verbed` (past tense, lowercase, colon-separated).
 *
 * Mirrors ARCHITECTURE.md "Event catalog". When the two drift, this file
 * wins — but please update the doc in the same commit.
 *
 * A2: imperative inputs (player wants to enter a node, pick a recruit,
 * reset the run) moved off the bus and onto the `RunCommand` channel in
 * `src/run/Command.ts`. The bus carries only outputs ("X just happened")
 * — that's why every name here is past-tense.
 */

import type { GridCoord } from './types';
import type { Team, UnitTemplate } from '../sim/Unit';

export interface GameEvents extends Record<string, unknown> {
  tick: { tick: number };

  'battle:started': { worldSeed: number };
  'battle:ended': { winner: 'player' | 'enemy' };

  /**
   * Fires once per unit appearing on the grid. `instant: true` for
   * setup-time spawns (battle start, initial team layout); `false` for
   * D5.C overflow-queue spawns that come in mid-battle and visually
   * lerp their alpha 0 → 1 over the SpawnAction lockout window.
   */
  'unit:spawned': { unitId: number; instant: boolean };
  'unit:moved': {
    unitId: number;
    from: GridCoord;
    to: GridCoord;
    durationTicks: number;
  };
  'unit:attacked': { attackerId: number; targetId: number; damage: number };
  /**
   * D7.B: per-tick chip damage from standing on a `fire` tile. Separate
   * event from `unit:attacked` so consumers can branch cleanly without
   * an `attackerId: null` / sentinel dance — fire damage has no
   * attacker. Subscribers that need to refresh visible HP state should
   * subscribe to all three of `unit:attacked` / `unit:burned` /
   * `unit:healed`. Emits AFTER currentHp is updated and BEFORE
   * `unit:died` if the damage kills.
   */
  'unit:burned': { unitId: number; damage: number };
  /** D7.B: per-tick chip heal from standing on a `healing` tile. Emits
   *  AFTER currentHp is updated; healing is clamped at maxHp, so the
   *  emitted `amount` is the actual HP delta (0 when the unit is
   *  already full — we still emit so subscribers can debounce / log). */
  'unit:healed': { unitId: number; amount: number };
  /**
   * Fires once per unit removal from the world. `team` is included so
   * subscribers can branch on combatant vs neutral (wall / environment)
   * deaths without re-querying the world — by the time this event fires
   * the unit has already been spliced out of `world.units` and is no
   * longer findable.
   */
  'unit:died': { unitId: number; team: Team };

  'run:started': { seed: number };
  'run:victory': Record<string, never>;
  'run:defeated': Record<string, never>;

  'recruit:offered': { units: UnitTemplate[] };
}
