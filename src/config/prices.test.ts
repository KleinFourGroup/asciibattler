import { describe, expect, it } from 'vitest';
import {
  PRICES,
  PricesSchema,
  assertPriceRefs,
  daemonPrice,
  packetPrice,
  sellPrice,
  unitPrice,
} from './prices';
import { ALL_ARCHETYPES, DRAFTABLE_ARCHETYPES, rarityForArchetype } from '../sim/archetypes';
import { RARITY_TIERS } from './units';
import { PACKETS, PACKET_IDS } from './packets';
import { DAEMONS } from './daemons';

/** A minimal valid config for the synthetic assert/schema cases. */
const FLAT_MULTIPLIER = { common: 1, uncommon: 1, rare: 1, legendary: 1 };
const SYNTHETIC = {
  units: {
    baseByArchetype: { alpha: 10 },
    levelGrowth: 1.5,
    jitter: 0.1,
    rarityMultiplier: FLAT_MULTIPLIER,
  },
  packets: { default: 5, byId: {} },
  daemons: { default: 7, byId: {} },
  sellFraction: 0.5,
  unitRemovalPrice: 3,
  portStock: { units: 2, packets: 2, daemons: 1 },
};

const SYNTHETIC_CATALOGS = {
  archetypes: ['alpha', 'beta'],
  draftable: ['alpha'],
  packetIds: ['p1'],
  daemonIds: ['d1'],
};

describe('50a — the price book (config/prices.json)', () => {
  it('the committed catalog parses and passes the referential asserts', () => {
    // The module-load parse + self-wired assert already ran at import; this
    // re-runs them explicitly so a failure reports HERE, not as an
    // import-time crash in an unrelated suite.
    expect(() =>
      assertPriceRefs(PRICES, {
        archetypes: ALL_ARCHETYPES,
        draftable: DRAFTABLE_ARCHETYPES,
        packetIds: PACKET_IDS,
        daemonIds: DAEMONS.map((d) => d.id),
      }),
    ).not.toThrow();
  });

  it('every DRAFTABLE archetype carries a base price (the stock-roll guarantee)', () => {
    for (const archetype of DRAFTABLE_ARCHETYPES) {
      expect(PRICES.units.baseByArchetype[archetype], archetype).toBeGreaterThan(0);
    }
  });

  it('every priced archetype is a real catalog archetype (no orphan keys)', () => {
    for (const key of Object.keys(PRICES.units.baseByArchetype)) {
      expect(ALL_ARCHETYPES, key).toContain(key);
    }
  });

  it('unitPrice scales the config base by the growth curve × the tier multiplier, rounding once', () => {
    // §61f — the whole expectation derives from config: base, curve, and the
    // per-tier multiplier resolved through the archetype's own rarity.
    for (const archetype of DRAFTABLE_ARCHETYPES) {
      const base = PRICES.units.baseByArchetype[archetype]!;
      const mult = PRICES.units.rarityMultiplier[rarityForArchetype(archetype)];
      expect(unitPrice(archetype, 1)).toBe(Math.round(base * mult));
      for (const level of [2, 5, 10]) {
        expect(unitPrice(archetype, level)).toBe(
          Math.round(base * Math.pow(PRICES.units.levelGrowth, level - 1) * mult),
        );
      }
    }
  });

  it('§61f — every tier multiplier is authored positive and the seam is non-vacuous', () => {
    for (const tier of RARITY_TIERS) {
      expect(PRICES.units.rarityMultiplier[tier], tier).toBeGreaterThan(0);
    }
    // Non-vacuous: at least one draftable archetype resolves a non-1 multiplier
    // (all-1 would make the seam indistinguishable from no seam — the 47b lesson).
    const activeTiers = new Set(DRAFTABLE_ARCHETYPES.map((a) => rarityForArchetype(a)));
    const multipliers = [...activeTiers].map((t) => PRICES.units.rarityMultiplier[t]);
    expect(multipliers.some((m) => m !== 1)).toBe(true);
  });

  it('§61f — the schema rejects a missing tier in rarityMultiplier', () => {
    const broken = structuredClone(SYNTHETIC) as Record<string, unknown>;
    delete (broken.units as { rarityMultiplier: Record<string, number> }).rarityMultiplier.rare;
    expect(PricesSchema.safeParse(broken).success).toBe(false);
  });

  it('unitPrice clamps sub-1 levels to level 1 and throws on an unpriced archetype', () => {
    const anyDraftable = DRAFTABLE_ARCHETYPES[0]!;
    expect(unitPrice(anyDraftable, 0)).toBe(unitPrice(anyDraftable, 1));
    expect(() => unitPrice('no-such-archetype', 1)).toThrow(/no base price/);
  });

  it('packetPrice/daemonPrice resolve the per-id override over the kind default', () => {
    for (const id of PACKET_IDS) {
      expect(packetPrice(id)).toBe(PRICES.packets.byId[id] ?? PRICES.packets.default);
    }
    for (const daemon of DAEMONS) {
      expect(daemonPrice(daemon.id)).toBe(
        PRICES.daemons.byId[daemon.id] ?? PRICES.daemons.default,
      );
    }
    // The committed catalog exercises at least one real override so the
    // non-default path is content-live, not just schema-legal.
    expect(Object.keys(PRICES.packets.byId).length).toBeGreaterThan(0);
  });

  it('sellPrice floors buy × sellFraction (a refund never rounds up)', () => {
    for (const id of PACKET_IDS) {
      expect(sellPrice(packetPrice(id))).toBe(Math.floor(packetPrice(id) * PRICES.sellFraction));
    }
    // Selling can never profit against the same price book.
    for (const packet of PACKETS) {
      expect(sellPrice(packetPrice(packet.id))).toBeLessThanOrEqual(packetPrice(packet.id));
    }
  });

  it('assertPriceRefs rejects each referential hole (synthetic catalogs)', () => {
    expect(() => assertPriceRefs(PricesSchema.parse(SYNTHETIC), SYNTHETIC_CATALOGS)).not.toThrow();
    expect(() =>
      assertPriceRefs(
        PricesSchema.parse({
          ...SYNTHETIC,
          units: { ...SYNTHETIC.units, baseByArchetype: { alpha: 10, ghost: 4 } },
        }),
        SYNTHETIC_CATALOGS,
      ),
    ).toThrow(/unknown archetype 'ghost'/);
    expect(() =>
      assertPriceRefs(
        PricesSchema.parse({
          ...SYNTHETIC,
          units: { ...SYNTHETIC.units, baseByArchetype: { beta: 10 } },
        }),
        SYNTHETIC_CATALOGS,
      ),
    ).toThrow(/draftable archetype 'alpha' has no base price/);
    expect(() =>
      assertPriceRefs(
        PricesSchema.parse({ ...SYNTHETIC, packets: { default: 5, byId: { ghost: 4 } } }),
        SYNTHETIC_CATALOGS,
      ),
    ).toThrow(/unknown packet id 'ghost'/);
    expect(() =>
      assertPriceRefs(
        PricesSchema.parse({ ...SYNTHETIC, daemons: { default: 7, byId: { ghost: 4 } } }),
        SYNTHETIC_CATALOGS,
      ),
    ).toThrow(/unknown daemon id 'ghost'/);
  });

  it('the schema rejects malformed shapes (non-integer prices, out-of-range knobs)', () => {
    expect(() =>
      PricesSchema.parse({
        ...SYNTHETIC,
        units: { ...SYNTHETIC.units, baseByArchetype: { alpha: 10.5 } },
      }),
    ).toThrow();
    expect(() =>
      PricesSchema.parse({ ...SYNTHETIC, units: { ...SYNTHETIC.units, levelGrowth: 0.9 } }),
    ).toThrow();
    expect(() => PricesSchema.parse({ ...SYNTHETIC, sellFraction: 1.5 })).toThrow();
    expect(() => PricesSchema.parse({ ...SYNTHETIC, packets: { default: 0, byId: {} } })).toThrow();
    expect(() => PricesSchema.parse({ ...SYNTHETIC, unitRemovalPrice: -1 })).toThrow();
    expect(() =>
      PricesSchema.parse({ ...SYNTHETIC, portStock: { units: -1, packets: 2, daemons: 1 } }),
    ).toThrow();
  });
});
