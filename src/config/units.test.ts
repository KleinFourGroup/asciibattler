import { describe, it, expect } from 'vitest';
import {
  UNIT_DEFS,
  NEUTRAL_DEFS,
  ALL_UNIT_DEFS,
  RARITY_TIERS,
  UnitDefSchema,
  UnitDefsSchema,
  CombatantUnitDefSchema,
  NeutralUnitDefSchema,
  isNeutralUnitDef,
  isDestructibleNeutral,
  isAutoTargetNeutral,
} from './units';
import { abilityDef, ABILITY_DEFS } from './abilities';
import { STATUS_DEFS } from './statuses';

// The catalog is SPLIT by kind at runtime: `UNIT_DEFS` = the combatant
// archetypes (their combatant-field assertions below), `NEUTRAL_DEFS` = the
// neutral fold (walls / half-cover — their own describe block). `ALL_UNIT_DEFS`
// is the full parsed record (the whole-catalog / record-schema checks).
const COMBATANT_ENTRIES = Object.entries(UNIT_DEFS);
const NEUTRAL_ENTRIES = Object.entries(NEUTRAL_DEFS);

/**
 * The UnitDef catalog scaffold guards. The schema carries optional fields:
 * the spatial/flight block (footprint / layer / statusSusceptibility) and the
 * two branch-killers (movementBehavior / retargetOnLosLoss). An entry that
 * omits one resolves to a behavior-identical default. Every combatant omits
 * the spatial/flight block (the neutrals use it), and these tests pin that:
 * a default drift on those fields fails loudly.
 *
 * Mechanic tests — explicit literals (not derived from config), since the point
 * is to assert the schema's fixed defaults, not balance numbers.
 */
describe('UnitDef catalog scaffold', () => {
  it('loads + re-validates the whole catalog through the schema', () => {
    // The module already parses at import (boot-assert); re-parsing the parsed
    // value is the idempotence check every entry (combatant + neutral) resolves.
    expect(() => UnitDefsSchema.parse(ALL_UNIT_DEFS)).not.toThrow();
    expect(Object.keys(ALL_UNIT_DEFS).length).toBeGreaterThan(0);
  });

  it('every combatant defaults the spatial/flight fields behavior-identically', () => {
    for (const [id, def] of COMBATANT_ENTRIES) {
      expect(def.footprint, `${id}.footprint`).toBe(1); // single-cell
      expect(def.layer, `${id}.layer`).toBe('ground');
      // Absent in JSON ⇒ undefined ⇒ "susceptible to all" (the World reads it).
      expect(def.statusSusceptibility, `${id}.statusSusceptibility`).toBeUndefined();
    }
  });

  // The branch-killers: `movementBehavior` (`support` for the healer alone)
  // and `retargetOnLosLoss` (`true` for the archer alone). The
  // field↔behavior contracts are balance-proofed in
  // registry.test / Targeting.test — here we only pin the wiring cadence (a
  // value is present, of the right shape).
  it('wires the two branch-killers, each of the right shape', () => {
    const combatants = COMBATANT_ENTRIES.map(([, d]) => d);
    const withMove = combatants.filter((d) => d.movementBehavior !== undefined);
    const withRetarget = combatants.filter((d) => d.retargetOnLosLoss !== undefined);
    expect(withMove.length).toBeGreaterThan(0); // the healer
    expect(withRetarget.length).toBeGreaterThan(0); // the archer
    for (const [id, def] of COMBATANT_ENTRIES) {
      if (def.movementBehavior !== undefined) {
        expect(['standard', 'support'], `${id}.movementBehavior`).toContain(def.movementBehavior);
      }
      if (def.retargetOnLosLoss !== undefined) {
        expect(typeof def.retargetOnLosLoss, `${id}.retargetOnLosLoss`).toBe('boolean');
      }
    }
    // Anchor the lone LOS-kiter (the old `=== 'archer'` branch).
    expect(CombatantUnitDefSchema.parse(UNIT_DEFS.archer).retargetOnLosLoss).toBe(true);
  });

  it('accepts an entry that DOES populate the optional fields', () => {
    const seed = CombatantUnitDefSchema.parse(UNIT_DEFS.mercenary);
    const populated = {
      ...seed,
      footprint: 3,
      layer: 'air' as const,
      statusSusceptibility: ['burn', 'frozen'],
      movementBehavior: 'support' as const,
      retargetOnLosLoss: true,
    };
    const parsed = CombatantUnitDefSchema.parse(populated);
    expect(parsed.footprint).toBe(3);
    expect(parsed.layer).toBe('air');
    expect(parsed.statusSusceptibility).toEqual(['burn', 'frozen']);
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
 * The neutral fold. Walls + half-cover are NEUTRAL `UnitDef` entries in
 * the one unified catalog (no abilities / stat blocks — a glyph + an OPTIONAL `hp`
 * pool, whose presence is the destructibility signal). These pin the
 * neutral schema arm + the two shipped entries; the spawn fold (`spawnEnvironment`
 * → catalog) + the susceptibility filter are proven in the sim tests
 * (environment.test / World.test).
 */
describe('neutral catalog entries', () => {
  it('ships the neutral defs (wall / half_cover / rubble): optional hp, no abilities/stats', () => {
    const ids = NEUTRAL_ENTRIES.map(([id]) => id);
    expect(ids).toContain('wall'); // the fold's entries
    expect(ids).toContain('half_cover');
    for (const [id, def] of NEUTRAL_ENTRIES) {
      expect(isNeutralUnitDef(def), `${id} is neutral`).toBe(true);
      expect(def.glyph.length, `${id}.glyph`).toBe(1);
      // `hp` is OPTIONAL (HP-presence = destructibility); when present it's a
      // real pool. Its presence/absence per entry is pinned in the HP-PRESENCE test below.
      if (def.hp !== undefined) expect(def.hp, `${id}.hp`).toBeGreaterThan(0);
      expect(def.footprint, `${id}.footprint in 1..4`).toBeGreaterThanOrEqual(1);
      expect(def.footprint, `${id}.footprint in 1..4`).toBeLessThanOrEqual(4);
      expect('abilities' in def, `${id} has no abilities`).toBe(false);
      expect('baseStats' in def, `${id} has no baseStats`).toBe(false);
    }
    // The fold's wall and half-cover stay single-cell (the footprint seam is
    // inert for them); rubble is the multi-tile consumer (proven in environment.test).
    expect(NEUTRAL_DEFS.wall!.footprint).toBe(1);
    expect(NEUTRAL_DEFS.half_cover!.footprint).toBe(1);
  });

  it('carries the LOS contract on the def (wall opaque, half-cover transparent)', () => {
    expect(NEUTRAL_DEFS.wall!.blocksLineOfSight).toBe(true); // schema default
    expect(NEUTRAL_DEFS.half_cover!.blocksLineOfSight).toBe(false);
  });

  it('declares the burnable-not-poisonable susceptibility', () => {
    for (const [id, def] of NEUTRAL_ENTRIES) {
      expect(def.statusSusceptibility, `${id}.statusSusceptibility`).toEqual(['burn', 'frozen']);
    }
  });

  it('HP-PRESENCE = destructibility (rubble has hp; wall/half_cover do not)', () => {
    // Walls / half-cover are indestructible (no hp pool); rubble carries one. This
    // is the signal `isCombatTargetable` keys off (proven end-to-end in the sim
    // targeting tests) — pinned here at the catalog layer.
    expect(NEUTRAL_DEFS.wall!.hp).toBeUndefined();
    expect(NEUTRAL_DEFS.half_cover!.hp).toBeUndefined();
    expect(NEUTRAL_DEFS.rubble_1x1!.hp).toBeGreaterThan(0);
    expect(isDestructibleNeutral('wall')).toBe(false);
    expect(isDestructibleNeutral('half_cover')).toBe(false);
    expect(isDestructibleNeutral('rubble_1x1')).toBe(true);
    // An unknown id (the retired 'environment' sentinel / a combatant) has no
    // neutral def ⇒ no hp ⇒ indestructible.
    expect(isDestructibleNeutral('environment')).toBe(false);
    expect(isDestructibleNeutral('mercenary')).toBe(false);
  });

  it('AUTO-TARGET eligibility is a separate data-driven axis (rubble opts in)', () => {
    // Rubble is auto-fired-at below hostiles; walls / half-cover are not (and a
    // future destructible wall — hp WITHOUT autoTarget — still wouldn't be). The
    // field is DATA (a new debris kind opts in with one JSON line, no code edit).
    expect(NEUTRAL_DEFS.rubble_1x1!.autoTarget).toBe(true);
    expect(NEUTRAL_DEFS.rubble_2x2!.autoTarget).toBe(true);
    expect(NEUTRAL_DEFS.rubble_3x3!.autoTarget).toBe(true);
    expect(NEUTRAL_DEFS.wall!.autoTarget).toBe(false); // schema default
    expect(NEUTRAL_DEFS.half_cover!.autoTarget).toBe(false);
    expect(isAutoTargetNeutral('rubble_2x2')).toBe(true);
    expect(isAutoTargetNeutral('wall')).toBe(false);
    expect(isAutoTargetNeutral('half_cover')).toBe(false);
    expect(isAutoTargetNeutral('mercenary')).toBe(false); // not even a neutral
  });

  it('the destructible wall/cover defs: hp-present (destructible) but NOT auto-targeted', () => {
    // Walls/cover take OPTIONAL destructibility via a SEPARATE hp-bearing neutral
    // def; a layout's per-instance `hp` routes a placement to it. HP-presence ⇒ combat-
    // targetable (AoE / manual / focused fire), by the HP-PRESENCE rule above; the ABSENT `autoTarget`
    // ⇒ never auto-chipped like rubble (the "walls stay manual/AoE-only" rule). Both
    // derived from the catalog — never hardcoded.
    for (const id of ['wall_destructible', 'half_cover_destructible']) {
      const def = NEUTRAL_DEFS[id]!;
      expect(def.hp, `${id}.hp`).toBeGreaterThan(0); // a real HP pool ⇒ destructible
      expect(isDestructibleNeutral(id), `${id} destructible`).toBe(true);
      expect(def.autoTarget, `${id}.autoTarget`).toBe(false); // schema default (no field)
      expect(isAutoTargetNeutral(id), `${id} not auto-targeted`).toBe(false);
    }
    // LOS mirrors the indestructible siblings: wall opaque, cover transparent.
    expect(NEUTRAL_DEFS.wall_destructible!.blocksLineOfSight).toBe(true);
    expect(NEUTRAL_DEFS.half_cover_destructible!.blocksLineOfSight).toBe(false);
  });

  it('the union routes each entry to the right arm', () => {
    // A neutral (no abilities/baseStats) must FAIL the combatant arm and a combatant
    // (extra baseStats/abilities keys) must FAIL the STRICT neutral arm — the
    // structural discriminant the union relies on. `hp` is OPTIONAL, so a
    // bare glyph is a VALID (indestructible) neutral, not "matches neither" — the
    // strict arm is what keeps a combatant from leaking through it.
    expect(CombatantUnitDefSchema.safeParse(NEUTRAL_DEFS.wall).success).toBe(false);
    expect(NeutralUnitDefSchema.safeParse(UNIT_DEFS.mercenary).success).toBe(false);
    expect(UnitDefSchema.safeParse({ glyph: '#' }).success).toBe(true); // hp-less = indestructible neutral
    expect(UnitDefSchema.safeParse(NEUTRAL_DEFS.wall).success).toBe(true);
    expect(UnitDefSchema.safeParse(UNIT_DEFS.mercenary).success).toBe(true);
  });
});

/**
 * The open catalog. `UnitDefsSchema` is an OPEN `z.record` (string →
 * UnitDef) and `Archetype` is `string`, so the catalog is the single source
 * of which unit kinds exist — validated structurally, not by an enumerated
 * key list, so a unit is authored as pure data. In place of a compile-time
 * key guarantee, the `REQUIRED_UNIT_IDS` boot-assert covers the ids code
 * constructs by literal.
 */
describe('open catalog (relaxed Archetype id)', () => {
  it('validates a brand-new unit id with no code edit', () => {
    const catalog = { ...structuredClone(UNIT_DEFS), gremlin: structuredClone(UNIT_DEFS.mercenary) };
    const parsed = UnitDefsSchema.parse(catalog);
    expect(Object.keys(parsed)).toContain('gremlin');
    expect(parsed.gremlin).toEqual(UNIT_DEFS.mercenary);
  });

  it('still validates every entry structurally (a malformed unit is rejected)', () => {
    // A BARE glyph is a valid (indestructible) neutral, so "malformed"
    // must genuinely fail both arms: a 2-char glyph breaks `glyph.length(1)` on the
    // combatant AND neutral arm.
    const bad = { ...structuredClone(ALL_UNIT_DEFS), broken: { glyph: 'XY' } };
    expect(UnitDefsSchema.safeParse(bad).success).toBe(false);
  });

  it('preserves JSON key order (the formatter round-trips in parsed-shape order)', () => {
    // z.record must not reorder keys, or the archetype-editor byte-round-trip breaks.
    const raw = Object.keys(UnitDefsSchema.parse(structuredClone(ALL_UNIT_DEFS)));
    expect(raw).toEqual(Object.keys(ALL_UNIT_DEFS));
  });

  it('carries the ids the game hard-references by literal (boot-assert contract)', () => {
    // Mirrors REQUIRED_UNIT_IDS. If the module imported at all, the
    // boot-assert already passed; this documents the set.
    for (const id of ['mercenary', 'archer']) {
      expect(UNIT_DEFS[id], id).toBeDefined();
    }
  });
});

// The display-name layer (the AbilityDef.name precedent).
describe('display names', () => {
  it('every combatant carries a non-empty display name', () => {
    for (const [id, def] of COMBATANT_ENTRIES) {
      expect(typeof def.name, id).toBe('string');
      expect(def.name.length, id).toBeGreaterThan(0);
    }
  });

  it('rejects a combatant with an empty name (required, min 1)', () => {
    const seed = CombatantUnitDefSchema.parse(UNIT_DEFS.mercenary);
    expect(CombatantUnitDefSchema.safeParse({ ...seed, name: '' }).success).toBe(false);
    const { name: _name, ...nameless } = seed;
    expect(CombatantUnitDefSchema.safeParse(nameless).success).toBe(false);
  });
});

// The rarity field (absent ⇒ the common default). Derived-from-config where
// the claim is about the catalog; explicit literals where it's about the
// schema's fixed defaults (the scaffold block's split, above).
describe('rarity tier field', () => {
  it('every combatant resolves a valid tier (absent ⇒ the common default)', () => {
    for (const [id, def] of COMBATANT_ENTRIES) {
      expect(RARITY_TIERS, `${id}.rarity`).toContain(def.rarity);
    }
  });

  it('accepts an entry that populates a non-default tier', () => {
    const seed = CombatantUnitDefSchema.parse(UNIT_DEFS.mercenary);
    expect(CombatantUnitDefSchema.parse({ ...seed, rarity: 'legendary' }).rarity).toBe('legendary');
  });

  it('rejects an unknown tier (the typo guard)', () => {
    const seed = CombatantUnitDefSchema.parse(UNIT_DEFS.mercenary);
    expect(CombatantUnitDefSchema.safeParse({ ...seed, rarity: 'elite' }).success).toBe(false);
  });

  it('rejects rarity on a NEUTRAL entry (strict — never drafted, never tiered)', () => {
    const wall = NeutralUnitDefSchema.parse(NEUTRAL_DEFS.wall);
    expect(NeutralUnitDefSchema.safeParse({ ...wall, rarity: 'common' }).success).toBe(false);
  });
});

// The stat-identity roster wiring pins. STRUCTURE only (kits, draft
// flags, the aura chain) — the stat/price VALUES are signed design numbers,
// deliberately unpinned (the scaffold block's mechanic-pin convention does
// not apply to balance content).
describe('the stat-identity roster', () => {
  it('the four stat-identity archetypes exist, draftable, wielding their weapons', () => {
    expect(UNIT_DEFS.rioter?.abilities).toEqual(['molotov']);
    expect(UNIT_DEFS.gunslinger?.abilities).toEqual(['pistol']);
    expect(UNIT_DEFS.halberdier?.abilities).toEqual(['halberd']);
    expect(UNIT_DEFS.officer?.abilities).toEqual(['cane', 'inspire']);
    for (const id of ['rioter', 'gunslinger', 'halberdier', 'officer']) {
      expect(UNIT_DEFS[id]?.draftable, `${id} draftable`).toBe(true);
    }
  });

  it('inspire is the shipped aura demo: op-less, self-target, radiating inspired at allies', () => {
    const def = abilityDef('inspire');
    expect(def.effects).toHaveLength(0); // pure aura — the propose layer skips it
    expect(def.target.kind).toBe('self'); // the schema's attackRange guard shape
    expect(def.aura?.statusId).toBe('inspired');
    expect(def.aura?.affects).toBe('allies');
    // `inspired` is a pure mobility statMod (magnitude is a signed design
    // number — pin the AXIS, not the value).
    const inspired = STATUS_DEFS.inspired!;
    expect(inspired.periodic).toBeUndefined();
    expect(inspired.behavior).toBeUndefined();
    expect(inspired.statMods?.mobility?.add).toBeGreaterThan(0);
  });
});

/**
 * THE POWER TABLE (encounter-feel-spec §The casualty chip rule): `power` is a
 * HEADCOUNT WEIGHT fixed per archetype
 * — 1 everywhere, legendary 2 — and it never grows. Config-derived: the
 * legendary set comes from `rarity`, so a new legendary fails here until its
 * weight is set on purpose. Summons are NOT a table row: a conjured
 * unit is zeroed in the fallen LEDGER by its `summonedBy` stamp
 * (`World.recordFallen`), so the summoned archetype (the ghoul) prices like
 * any body when an encounter FIELDS it.
 */
describe('the power table (headcount weights)', () => {
  const summoned = new Set(
    Object.values(ABILITY_DEFS).flatMap((def) =>
      def.effects.flatMap((e) => (e.op.kind === 'summon' ? [e.op.summon.archetype] : [])),
    ),
  );

  it('the catalog has at least one legendary; the summoned archetype is a table row like any other', () => {
    expect(COMBATANT_ENTRIES.some(([, d]) => d.rarity === 'legendary')).toBe(true);
    expect([...summoned]).toEqual(['ghoul']);
    // The ledger, not the table, zeroes summons — a fielded ghoul is a body.
    expect(UNIT_DEFS.ghoul!.baseStats.power).toBe(1);
  });

  it.each(COMBATANT_ENTRIES)('%s: power = legendary 2 / else 1, and power growth 0', (_id, def) => {
    const expected = def.rarity === 'legendary' ? 2 : 1;
    expect(def.baseStats.power).toBe(expected);
    expect(def.growthRates.power).toBe(0);
  });

  it('every power sits in {1, 2} — no archetype carries a hidden weight or a zero', () => {
    for (const [, def] of COMBATANT_ENTRIES) expect([1, 2]).toContain(def.baseStats.power);
  });
});
