/**
 * `avgTeamLevel`, a recruit's level basis, is all this file holds; the
 * enemy's waves are resolved in `encounters/wave.ts`.
 */

import type { UnitTemplate } from '../sim/Unit';

/** The roster's summed level. */
function rosterLevelSum(team: readonly UnitTemplate[]): number {
  return team.reduce((sum, u) => sum + u.level, 0);
}

/**
 * The roster's mean level, the basis of a recruit's level (`Run`). An empty
 * roster is 1, so a recruit onto an empty team arrives at level 1 plus its
 * bonus.
 */
export function avgTeamLevel(team: readonly UnitTemplate[]): number {
  return team.length === 0 ? 1 : rosterLevelSum(team) / team.length;
}
