import { describe, it, expect } from 'vitest';
import { colorForTeam, isDestructibleObstacle, spriteColorForUnit } from './spriteColor';
import { COLORS } from './palette';

/**
 * §40c — the destructible-wall/cover VISUAL TELL. A breakable wall/cover shares
 * its glyph (`#` / `╥`) with an indestructible one, so it's colored CRACKED_STONE
 * to tell them apart. The color LOGIC lives in a THREE-free module precisely so
 * it's proven here (the actual render is browser-verified). Balance-proof: keyed
 * off the catalog predicates, never a hardcoded id set.
 */
describe('spriteColorForUnit — the §40c destructible tell', () => {
  it('colorForTeam keeps the team/stone base colors', () => {
    expect(colorForTeam('player')).toBe(COLORS.TERMINAL_GREEN);
    expect(colorForTeam('enemy')).toBe(COLORS.NEON_RED);
    expect(colorForTeam('neutral')).toBe(COLORS.TERMINAL_STONE);
  });

  it('isDestructibleObstacle is true ONLY for destructible walls/cover (not rubble, not solid walls)', () => {
    expect(isDestructibleObstacle('wall_destructible')).toBe(true);
    expect(isDestructibleObstacle('half_cover_destructible')).toBe(true);
    // Indestructible walls/cover: no HP pool → not the tell target.
    expect(isDestructibleObstacle('wall')).toBe(false);
    expect(isDestructibleObstacle('half_cover')).toBe(false);
    // Rubble is destructible BUT auto-target debris with its own glyph → excluded.
    expect(isDestructibleObstacle('rubble_1x1')).toBe(false);
    expect(isDestructibleObstacle('rubble_2x2')).toBe(false);
    // A combatant is not a neutral obstacle at all.
    expect(isDestructibleObstacle('mercenary')).toBe(false);
  });

  it('paints a destructible wall/cover CRACKED_STONE; everything else keeps its base color', () => {
    expect(spriteColorForUnit({ team: 'neutral', archetype: 'wall_destructible' })).toBe(
      COLORS.CRACKED_STONE,
    );
    expect(spriteColorForUnit({ team: 'neutral', archetype: 'half_cover_destructible' })).toBe(
      COLORS.CRACKED_STONE,
    );
    // Indestructible walls + rubble stay the inert stone (rubble is distinct by glyph).
    expect(spriteColorForUnit({ team: 'neutral', archetype: 'wall' })).toBe(COLORS.TERMINAL_STONE);
    expect(spriteColorForUnit({ team: 'neutral', archetype: 'rubble_1x1' })).toBe(
      COLORS.TERMINAL_STONE,
    );
    // Combatants are untouched by the tell.
    expect(spriteColorForUnit({ team: 'player', archetype: 'mercenary' })).toBe(
      COLORS.TERMINAL_GREEN,
    );
    expect(spriteColorForUnit({ team: 'enemy', archetype: 'bandit' })).toBe(COLORS.NEON_RED);
  });
});
