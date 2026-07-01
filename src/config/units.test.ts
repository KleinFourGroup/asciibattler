import { describe, it, expect } from 'vitest';
import {
  UNIT_DEFS,
  NEUTRAL_DEFS,
  ALL_UNIT_DEFS,
  UnitDefSchema,
  UnitDefsSchema,
  CombatantUnitDefSchema,
  NeutralUnitDefSchema,
  isNeutralUnitDef,
} from './units';

// §38d — the catalog is SPLIT by kind at runtime: `UNIT_DEFS` = the combatant
// archetypes (their combatant-field assertions below), `NEUTRAL_DEFS` = the
// neutral fold (walls / half-cover — their own describe block). `ALL_UNIT_DEFS`
// is the full parsed record (the whole-catalog / record-schema checks).
const COMBATANT_ENTRIES = Object.entries(UNIT_DEFS);
const NEUTRAL_ENTRIES = Object.entries(NEUTRAL_DEFS);

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
    // value is the idempotence check every entry (combatant + neutral) resolves.
    expect(() => UnitDefsSchema.parse(ALL_UNIT_DEFS)).not.toThrow();
    expect(Object.keys(ALL_UNIT_DEFS).length).toBeGreaterThan(0);
  });

  it('every combatant defaults the §38 spatial/flight fields behavior-identically', () => {
    for (const [id, def] of COMBATANT_ENTRIES) {
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
    const combatants = COMBATANT_ENTRIES.map(([, d]) => d);
    const withDamage = combatants.filter((d) => d.damageStat !== undefined);
    const withMove = combatants.filter((d) => d.movementBehavior !== undefined);
    const withRetarget = combatants.filter((d) => d.retargetOnLosLoss !== undefined);
    expect(withDamage.length).toBeGreaterThan(0); // 38c-1 populated the strikers
    expect(withMove.length).toBeGreaterThan(0); // 38c-2 populated the healer
    expect(withRetarget.length).toBeGreaterThan(0); // 38c-3 populated ranged
    for (const [id, def] of COMBATANT_ENTRIES) {
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
    expect(CombatantUnitDefSchema.parse(UNIT_DEFS.ranged).retargetOnLosLoss).toBe(true);
  });

  it('accepts an entry that DOES populate the new fields (38c forward-compat)', () => {
    const seed = CombatantUnitDefSchema.parse(UNIT_DEFS.mercenary);
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
    const parsed = CombatantUnitDefSchema.parse(populated);
    expect(parsed.footprint).toBe(3);
    expect(parsed.layer).toBe('air');
    expect(parsed.ignoresTerrain).toBe(true);
    expect(parsed.statusSusceptibility).toEqual(['burn', 'frozen']);
    expect(parsed.damageStat).toBe('strength');
    expect(parsed.movementBehavior).toBe('support');
    expect(parsed.retargetOnLosLoss).toBe(true);
  });

  it('rejects an out-of-range footprint (the N∈1..4 guard)', () => {
    const seed = CombatantUnitDefSchema.parse(UNIT_DEFS.mercenary);
    expect(CombatantUnitDefSchema.safeParse({ ...seed, footprint: 0 }).success).toBe(false);
    expect(CombatantUnitDefSchema.safeParse({ ...seed, footprint: 5 }).success).toBe(false);
  });
});

/**
 * §38d — the neutral fold. Walls + half-cover became NEUTRAL `UnitDef` entries in
 * the one unified catalog (no abilities / stat blocks — a glyph + a flat `hp`
 * pool). These pin the neutral schema arm + the two shipped entries; the spawn
 * fold (`spawnEnvironment` → catalog) + the susceptibility filter are proven in
 * the sim tests (environment.test / World.test).
 */
describe('§38d — neutral catalog entries', () => {
  it('ships the neutral defs (wall / half_cover / §40 rubble): flat hp, no abilities/stats', () => {
    const ids = NEUTRAL_ENTRIES.map(([id]) => id);
    expect(ids).toContain('wall'); // the §38d fold entries
    expect(ids).toContain('half_cover');
    for (const [id, def] of NEUTRAL_ENTRIES) {
      expect(isNeutralUnitDef(def), `${id} is neutral`).toBe(true);
      expect(def.glyph.length, `${id}.glyph`).toBe(1);
      expect(def.hp, `${id}.hp`).toBeGreaterThan(0);
      expect(def.footprint, `${id}.footprint in 1..4`).toBeGreaterThanOrEqual(1);
      expect(def.footprint, `${id}.footprint in 1..4`).toBeLessThanOrEqual(4);
      expect('abilities' in def, `${id} has no abilities`).toBe(false);
      expect('baseStats' in def, `${id} has no baseStats`).toBe(false);
    }
    // The §38d fold entries stay single-cell (the §39 seam is inert for them);
    // §40's rubble is the multi-tile consumer (proven in environment.test).
    expect(NEUTRAL_DEFS.wall!.footprint).toBe(1);
    expect(NEUTRAL_DEFS.half_cover!.footprint).toBe(1);
  });

  it('carries the D6 LOS contract on the def (wall opaque, half-cover transparent)', () => {
    expect(NEUTRAL_DEFS.wall!.blocksLineOfSight).toBe(true); // schema default
    expect(NEUTRAL_DEFS.half_cover!.blocksLineOfSight).toBe(false);
  });

  it('declares the burnable-not-poisonable susceptibility (38d-3 reads it)', () => {
    for (const [id, def] of NEUTRAL_ENTRIES) {
      expect(def.statusSusceptibility, `${id}.statusSusceptibility`).toEqual(['burn', 'frozen']);
    }
  });

  it('the union routes each entry to the right arm', () => {
    // A neutral (no abilities) must FAIL the combatant arm and a combatant (no
    // hp) must FAIL the neutral arm — the structural discriminant the union relies
    // on. A bare glyph matches neither.
    expect(CombatantUnitDefSchema.safeParse(NEUTRAL_DEFS.wall).success).toBe(false);
    expect(NeutralUnitDefSchema.safeParse(UNIT_DEFS.mercenary).success).toBe(false);
    expect(UnitDefSchema.safeParse({ glyph: '#' }).success).toBe(false);
    expect(UnitDefSchema.safeParse(NEUTRAL_DEFS.wall).success).toBe(true);
    expect(UnitDefSchema.safeParse(UNIT_DEFS.mercenary).success).toBe(true);
  });
});

/**
 * §38c-4 — the keystone relax. `UnitDefsSchema` became an OPEN `z.record`
 * (string → UnitDef) and the closed `Archetype` union became `string`, so the
 * catalog is now the single source of which unit kinds exist — validated
 * structurally, not by an enumerated key list. This is the §38e enabler (author
 * a unit as pure data). The compile-time key guarantee is replaced by the
 * `REQUIRED_UNIT_IDS` boot-assert for the ids code constructs by literal.
 */
describe('§38c-4 — open catalog (relaxed Archetype id)', () => {
  it('validates a brand-new unit id with no code edit (the §38e enabler)', () => {
    const catalog = { ...structuredClone(UNIT_DEFS), gremlin: structuredClone(UNIT_DEFS.mercenary) };
    const parsed = UnitDefsSchema.parse(catalog);
    expect(Object.keys(parsed)).toContain('gremlin');
    expect(parsed.gremlin).toEqual(UNIT_DEFS.mercenary);
  });

  it('still validates every entry structurally (a malformed unit is rejected)', () => {
    const bad = { ...structuredClone(ALL_UNIT_DEFS), broken: { glyph: 'X' } }; // matches neither arm
    expect(UnitDefsSchema.safeParse(bad).success).toBe(false);
  });

  it('preserves JSON key order (the formatter round-trips in parsed-shape order)', () => {
    // z.record must not reorder keys, or the archetype-editor byte-round-trip breaks.
    const raw = Object.keys(UnitDefsSchema.parse(structuredClone(ALL_UNIT_DEFS)));
    expect(raw).toEqual(Object.keys(ALL_UNIT_DEFS));
  });

  it('carries the ids the game hard-references by literal (boot-assert contract)', () => {
    // Mirrors REQUIRED_UNIT_IDS — start team + default enemy comp. If the module
    // imported at all, the boot-assert already passed; this documents the set.
    for (const id of ['mercenary', 'bandit', 'ranged']) {
      expect(UNIT_DEFS[id], id).toBeDefined();
    }
  });
});
