// Unit class + behavior composition machinery. Step 3.2 fills this in.

/**
 * Pre-instantiation description of a unit: archetype + rolled stats. The
 * recruitment screen surfaces these as options; choosing one creates a `Unit`.
 *
 * Step 3.2 will expand the fields (stat block, glyph, color); for now it's a
 * placeholder so `GameEvents.recruit:*` payloads can reference a real type.
 */
export interface UnitTemplate {
  readonly archetype: 'melee' | 'ranged';
}
