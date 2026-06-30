import { describe, it, expect } from 'vitest';
import { UNIT_DEFS, UnitDefSchema, UnitDefsSchema } from './units';

/**
 * §38b — the UnitDef catalog scaffold guards. The keystone renamed
 * `archetypes.json` → `units.json` and planted the §38 optional fields
 * (footprint / layer / ignoresTerrain / statusSusceptibility) + the three 38a
 * branch-killers (damageStat / movementBehavior / retargetOnLosLoss) on the
 * schema. 38b wires NONE of them — every existing entry omits them, so each
 * resolves to a behavior-identical default. These tests pin that, so a later
 * accidental JSON population (treating a field as wired before it is) or a
 * default drift fails loudly.
 *
 * Mechanic tests — explicit literals (not derived from config), since the point
 * is to assert the schema's fixed defaults, not balance numbers.
 */
describe('§38b — UnitDef catalog scaffold', () => {
  it('loads + re-validates the whole catalog through the schema', () => {
    // The module already parses at import (boot-assert); re-parsing the parsed
    // value is the idempotence check every entry resolves cleanly.
    expect(() => UnitDefsSchema.parse(UNIT_DEFS)).not.toThrow();
    expect(Object.keys(UNIT_DEFS).length).toBeGreaterThan(0);
  });

  it('every entry defaults the §38 spatial/flight fields behavior-identically', () => {
    for (const [id, def] of Object.entries(UNIT_DEFS)) {
      expect(def.footprint, `${id}.footprint`).toBe(1); // single-cell
      expect(def.layer, `${id}.layer`).toBe('ground');
      expect(def.ignoresTerrain, `${id}.ignoresTerrain`).toBe(false);
      // Absent in JSON ⇒ undefined ⇒ "susceptible to all" (38d reads it).
      expect(def.statusSusceptibility, `${id}.statusSusceptibility`).toBeUndefined();
    }
  });

  it('leaves the 38a branch-killer fields UNPOPULATED (wired in 38c)', () => {
    for (const [id, def] of Object.entries(UNIT_DEFS)) {
      expect(def.damageStat, `${id}.damageStat`).toBeUndefined();
      expect(def.movementBehavior, `${id}.movementBehavior`).toBeUndefined();
      expect(def.retargetOnLosLoss, `${id}.retargetOnLosLoss`).toBeUndefined();
    }
  });

  it('accepts an entry that DOES populate the new fields (38c forward-compat)', () => {
    const seed = UnitDefSchema.parse(UNIT_DEFS.mercenary);
    const populated = {
      ...seed,
      footprint: 3,
      layer: 'air' as const,
      ignoresTerrain: true,
      statusSusceptibility: ['burn', 'frozen'],
      damageStat: 'strength' as const,
      movementBehavior: 'support' as const,
      retargetOnLosLoss: true,
    };
    const parsed = UnitDefSchema.parse(populated);
    expect(parsed.footprint).toBe(3);
    expect(parsed.layer).toBe('air');
    expect(parsed.ignoresTerrain).toBe(true);
    expect(parsed.statusSusceptibility).toEqual(['burn', 'frozen']);
    expect(parsed.damageStat).toBe('strength');
    expect(parsed.movementBehavior).toBe('support');
    expect(parsed.retargetOnLosLoss).toBe(true);
  });

  it('rejects an out-of-range footprint (the N∈1..4 guard)', () => {
    const seed = UnitDefSchema.parse(UNIT_DEFS.mercenary);
    expect(UnitDefSchema.safeParse({ ...seed, footprint: 0 }).success).toBe(false);
    expect(UnitDefSchema.safeParse({ ...seed, footprint: 5 }).success).toBe(false);
  });
});
