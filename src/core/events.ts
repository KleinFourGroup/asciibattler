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

  'unit:spawned': { unitId: number };
  'unit:moved': {
    unitId: number;
    from: GridCoord;
    to: GridCoord;
    durationTicks: number;
  };
  'unit:attacked': { attackerId: number; targetId: number; damage: number };
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
