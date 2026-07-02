/**
 * Sprite base-color selection. Extracted from BattleRenderer as a THREE-free
 * module so the color LOGIC is headless-testable (BattleRenderer itself pulls
 * THREE and can't load under vitest).
 *
 * A combatant reads its TEAM color; a neutral reads the inert stone gray —
 * EXCEPT a destructible wall / half-cover (§40c), which reads the CRACKED_STONE
 * tint so a breakable obstacle is legible against its indestructible, SAME-GLYPH
 * sibling (`#` / `╥`). That ambiguity is exactly why the tell exists.
 *
 * Rubble is deliberately EXCLUDED: it's destructible too, but it's auto-target
 * debris carrying its OWN glyph (`▄`), already distinct from a wall, so it keeps
 * the stone color the user confirmed. The `isDestructibleNeutral && !isAutoTarget`
 * predicate is the data-driven expression of "a destructible obstacle that shares
 * a glyph with an indestructible one" — a future destructible-wall kind gets the
 * tell for free; a future auto-target debris keeps its own glyph/color.
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
 * §40c — is this archetype a DESTRUCTIBLE wall / half-cover (the tell target)?
 * A destructible neutral that is NOT auto-target debris (rubble) — i.e. one that
 * shares its glyph with an indestructible sibling and so needs a color to tell
 * them apart. Keyed off the catalog (data-driven), never a hardcoded id set.
 */
export function isDestructibleObstacle(archetype: string): boolean {
  return isDestructibleNeutral(archetype) && !isAutoTargetNeutral(archetype);
}

/** The base glyph color for a unit's sprite: the §40c cracked tint for a
 *  destructible wall/cover, else the team/stone color. */
export function spriteColorForUnit(unit: { team: Team; archetype: string }): string {
  if (unit.team === 'neutral' && isDestructibleObstacle(unit.archetype)) {
    return COLORS.CRACKED_STONE;
  }
  return colorForTeam(unit.team);
}
