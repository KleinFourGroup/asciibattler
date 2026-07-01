import { describe, it, expect } from 'vitest';
import { UNIT_DEFS, UnitDefSchema, UnitDefsSchema } from './units';

/**
 * §38b — the UnitDef catalog scaffold guards. The keystone renamed
 * `archetypes.json` → `units.json` and planted the §38 optional fields
 * (footprint / layer / ignoresTerrain / statusSusceptibility) + the three 38a
 * branch-killers (damageStat / movementBehavior / retargetOnLosLoss) on the
 * schema. 38b wired NONE of them — every existing entry omitted them, so each
 * resolved to a behavior-identical default. §38c then wired the three
 * branch-killers field-by-field (damageStat / movementBehavior /
 * retargetOnLosLoss); the spatial/flight block (footprint / layer /
 * ignoresTerrain / statusSusceptibility) stays inert until §39/§38d/flight. These
 * tests pin that — a default drift on the still-inert fields fails loudly.
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

  // §38c wired all three branch-killers field-by-field: 38c-1 `damageStat`
  // (every striker; absent for the non-strikers healer/shaman), 38c-2
  // `movementBehavior` (`support` for the healer alone), 38c-3
  // `retargetOnLosLoss` (`true` for `ranged` alone). The field↔behavior contracts
  // are balance-proofed in archetypes.test / registry.test / Targeting.test —
  // here we only pin the wiring cadence (a value is present, of the right shape).
  it('wires all three branch-killers (38c-1/2/3), each of the right shape', () => {
    const withDamage = Object.values(UNIT_DEFS).filter((d) => d.damageStat !== undefined);
    const withMove = Object.values(UNIT_DEFS).filter((d) => d.movementBehavior !== undefined);
    const withRetarget = Object.values(UNIT_DEFS).filter((d) => d.retargetOnLosLoss !== undefined);
    expect(withDamage.length).toBeGreaterThan(0); // 38c-1 populated the strikers
    expect(withMove.length).toBeGreaterThan(0); // 38c-2 populated the healer
    expect(withRetarget.length).toBeGreaterThan(0); // 38c-3 populated ranged
    for (const [id, def] of Object.entries(UNIT_DEFS)) {
      if (def.damageStat !== undefined) {
        expect(['strength', 'ranged', 'magic'], `${id}.damageStat`).toContain(def.damageStat);
      }
      if (def.movementBehavior !== undefined) {
        expect(['standard', 'support'], `${id}.movementBehavior`).toContain(def.movementBehavior);
      }
      if (def.retargetOnLosLoss !== undefined) {
        expect(typeof def.retargetOnLosLoss, `${id}.retargetOnLosLoss`).toBe('boolean');
      }
    }
    // Anchor the lone LOS-kiter (the old `=== 'ranged'` branch).
    expect(UNIT_DEFS.ranged.retargetOnLosLoss).toBe(true);
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
