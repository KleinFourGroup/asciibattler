import { describe, it, expect } from 'vitest';
import { GLYPHS } from './glyphs';
import { ARCHETYPE_CONFIG, glyphForArchetype, type Archetype } from '../sim/archetypes';

/**
 * E7.A guard. The render layer isn't unit-tested (canvas/WebGL needs a
 * browser), so a new archetype whose glyph isn't in the FontAtlas set
 * sails through the whole headless suite and only blows up live, at
 * battle-sprite creation, with `FontAtlas: no UV for glyph "x"` — which
 * is exactly how the rogue's `r` got shipped missing. This pins the one
 * piece of the contract that IS checkable headlessly: every archetype's
 * glyph is registered. It's data-driven off `ARCHETYPE_CONFIG`, so each
 * future archetype (E7.B `h`, E7.C `m`, E7.D `c`) is covered the moment
 * it's added to the config — no test edit needed.
 */
describe('FontAtlas glyph coverage', () => {
  const registered = new Set<string>(GLYPHS);
  const archetypes = Object.keys(ARCHETYPE_CONFIG) as Archetype[];

  it('has at least the known archetypes to check', () => {
    expect(archetypes.length).toBeGreaterThan(0);
  });

  it.each(archetypes)('registers a FontAtlas glyph for the "%s" archetype', (archetype) => {
    const glyph = glyphForArchetype(archetype);
    expect(
      registered.has(glyph),
      `glyph "${glyph}" for archetype "${archetype}" is missing from GLYPHS (src/render/glyphs.ts) — append it (gotcha #33).`,
    ).toBe(true);
  });
});
