/**
 * A sprite's base colour. Free of THREE, so the colour logic is tested
 * headless.
 *
 * A combatant wears its team's colour; a neutral the inert stone grey, except
 * a destructible wall or half-cover, which wears CRACKED_STONE, so a
 * breakable obstacle is told from its indestructible sibling of the same
 * glyph (`#` or `╥`). That shared glyph is why the tell exists.
 *
 * An active neutral (a camp member, `campId !== null`) is the third faction:
 * TERMINAL_AMBER, the warm "alive but not yours" lane between your green and
 * the enemy's red. No other body's base colour is amber (stone and ochre are
 * scenery's), and a camp's bandit shares the enemy's bandit's glyph, so the
 * colour is the tell, as with cracked stone. One colour for passive and
 * hostile camps.
 *
 * Rubble is left out: it is destructible too, but it is auto-target debris
 * with its own glyph (`▄`), already distinct from a wall, so it keeps the
 * stone colour. The `isDestructibleNeutral && !isAutoTarget` predicate says
 * "a destructible obstacle that shares a glyph with an indestructible one"
 * from the catalog's data, so a new destructible wall kind gets the tell
 * with no code, and new auto-target debris keeps its own glyph and colour.
 */

import { COLORS } from './palette';
import { isDestructibleNeutral, isAutoTargetNeutral } from '../config/units';
import type { Team } from '../sim/Unit';

/** The team base color (combatants + the neutral stone fallback). */
export function colorForTeam(team: Team): string {
  if (team === 'player') return COLORS.TERMINAL_GREEN;
  if (team === 'enemy') return COLORS.NEON_RED;
  return COLORS.TERMINAL_STONE;
}

/**
 * Is this archetype a destructible wall or half-cover, the tell's target? A
 * destructible neutral that is not auto-target debris (rubble): one that
 * shares its glyph with an indestructible sibling and needs a colour to be
 * told apart. Keyed off the catalog, never a hard-coded set of ids.
 */
export function isDestructibleObstacle(archetype: string): boolean {
  return isDestructibleNeutral(archetype) && !isAutoTargetNeutral(archetype);
}

/** The base colour of a unit's sprite: the camp's amber for an active
 *  neutral, cracked stone for a destructible wall or cover, else the team's
 *  or stone's. A structural parameter (as `isActiveNeutral` takes), so a
 *  snapshot qualifies, not only a live Unit. */
export function spriteColorForUnit(unit: {
  team: Team;
  archetype: string;
  campId: number | null;
}): string {
  if (unit.team === 'neutral' && unit.campId !== null) {
    return COLORS.TERMINAL_AMBER;
  }
  if (unit.team === 'neutral' && isDestructibleObstacle(unit.archetype)) {
    return COLORS.CRACKED_STONE;
  }
  return colorForTeam(unit.team);
}
