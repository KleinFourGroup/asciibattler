/**
 * The port's price book. Source of truth at `config/prices.json`.
 *
 * - `units.baseByArchetype` — the bits for a level-1 unit of each
 *   archetype. `unitPrice` scales it by `levelGrowth^(level − 1)` and by
 *   its tier's `rarityMultiplier`, and rounds once.
 * - `units.jitter` — a port's stock roll multiplies that price by a factor
 *   drawn uniformly from [1 − jitter, 1 + jitter] on the port stream. The
 *   roll is at the stock site; this module draws no randomness.
 * - `packets`, `daemons` — a `default` with `byId` overrides, so a standout
 *   is priced in one line and a new catalog entry sells with no edit here.
 * - `sellFraction` — the sell price is ⌊buy price × fraction⌋. A sale's
 *   proceeds are a refund and take the raw `addBits` path, never the
 *   `bitsGain` fold (`Run.gainBits`).
 * - `unitRemovalPrice` — the flat fee to remove a unit. Flat, because a
 *   price scaled by level would punish the low-value units removal is for.
 * - `portStock` — how many of each slot kind a port rolls on entry. Slots
 *   are distinct samples, so a count above the catalog's size, owned
 *   entries excluded, fills what exists.
 *
 * Boot checks, below: every priced archetype exists, every draftable
 * archetype is priced (stock rolls from the draft pool, so a gap would throw
 * at stock time rather than at startup), and every `byId` key names a real
 * packet or daemon.
 */

import { z } from 'zod';
import pricesJson from '../../config/prices.json';
import { ALL_ARCHETYPES, DRAFTABLE_ARCHETYPES, rarityForArchetype } from '../sim/archetypes';
import { PACKET_IDS } from './packets';
import { DAEMONS } from './daemons';

const PriceIntSchema = z.number().int().positive();

/** The whole-file schema, exported for the schema tests and the price
 *  editor's round trip. */
export const PricesSchema = z.object({
  units: z.object({
    baseByArchetype: z.record(z.string(), PriceIntSchema),
    levelGrowth: z.number().min(1),
    jitter: z.number().min(0).max(0.9),
    // One per rarity tier, applied inside `unitPriceFor`, so buy, sell,
    // stock and the editor's preview share one formula.
    rarityMultiplier: z.object({
      common: z.number().positive(),
      uncommon: z.number().positive(),
      rare: z.number().positive(),
      legendary: z.number().positive(),
    }),
  }),
  packets: z.object({
    default: PriceIntSchema,
    byId: z.record(z.string(), PriceIntSchema),
  }),
  daemons: z.object({
    default: PriceIntSchema,
    byId: z.record(z.string(), PriceIntSchema),
  }),
  sellFraction: z.number().min(0).max(1),
  unitRemovalPrice: z.number().int().nonnegative(),
  portStock: z.object({
    units: z.number().int().nonnegative(),
    packets: z.number().int().nonnegative(),
    daemons: z.number().int().nonnegative(),
  }),
});

export type PricesConfig = z.infer<typeof PricesSchema>;

export const PRICES: PricesConfig = PricesSchema.parse(pricesJson);

/**
 * Boot check: the price book against the three catalogs it prices. Its
 * arguments let a test pass synthetic catalogs. Draftable coverage is
 * required, not defaulted, because a unit's price is base data, not an
 * override: a missing entry is an authoring hole.
 */
export function assertPriceRefs(
  prices: PricesConfig,
  catalogs: {
    archetypes: readonly string[];
    draftable: readonly string[];
    packetIds: readonly string[];
    daemonIds: readonly string[];
  },
): void {
  for (const key of Object.keys(prices.units.baseByArchetype)) {
    if (!catalogs.archetypes.includes(key)) {
      throw new Error(`prices: units.baseByArchetype names unknown archetype '${key}'`);
    }
  }
  for (const archetype of catalogs.draftable) {
    if (prices.units.baseByArchetype[archetype] === undefined) {
      throw new Error(`prices: draftable archetype '${archetype}' has no base price`);
    }
  }
  for (const id of Object.keys(prices.packets.byId)) {
    if (!catalogs.packetIds.includes(id)) {
      throw new Error(`prices: packets.byId names unknown packet id '${id}'`);
    }
  }
  for (const id of Object.keys(prices.daemons.byId)) {
    if (!catalogs.daemonIds.includes(id)) {
      throw new Error(`prices: daemons.byId names unknown daemon id '${id}'`);
    }
  }
}

assertPriceRefs(PRICES, {
  archetypes: ALL_ARCHETYPES,
  draftable: DRAFTABLE_ARCHETYPES,
  packetIds: PACKET_IDS,
  daemonIds: DAEMONS.map((d) => d.id),
});

/*
 * Each price read has a pure core that takes the config (`*For`) and a
 * wrapper bound to `PRICES`. The game reads through the wrappers; the price
 * editor previews its unsaved document through the cores, so the preview
 * charges what the game would.
 */

/**
 * The unit price before jitter: base × levelGrowth^(level − 1) × the tier's
 * rarity multiplier, rounded once here. The tier comes from the archetype
 * id, so no tier argument can disagree with the catalog. Throws on an
 * unpriced archetype; the boot check makes that unreachable for draftable
 * stock, so a non-draftable archetype reaching a port is the bug.
 */
export function unitPriceFor(prices: PricesConfig, archetype: string, level: number): number {
  const base = prices.units.baseByArchetype[archetype];
  if (base === undefined) throw new Error(`unitPrice: archetype '${archetype}' has no base price`);
  const clamped = Math.max(1, level);
  const multiplier = prices.units.rarityMultiplier[rarityForArchetype(archetype)];
  return Math.round(base * Math.pow(prices.units.levelGrowth, clamped - 1) * multiplier);
}

export function unitPrice(archetype: string, level: number): number {
  return unitPriceFor(PRICES, archetype, level);
}

/** Packet buy price: the per-id override, else the kind default. */
export function packetPriceFor(prices: PricesConfig, id: string): number {
  return prices.packets.byId[id] ?? prices.packets.default;
}

export function packetPrice(id: string): number {
  return packetPriceFor(PRICES, id);
}

/** Daemon buy price: the per-id override, else the kind default. */
export function daemonPriceFor(prices: PricesConfig, id: string): number {
  return prices.daemons.byId[id] ?? prices.daemons.default;
}

export function daemonPrice(id: string): number {
  return daemonPriceFor(PRICES, id);
}

/** The sell price for a buy price: ⌊buy × sellFraction⌋, floored so a refund
 *  never rounds up past the fraction. */
export function sellPriceFor(prices: PricesConfig, buyPrice: number): number {
  return Math.floor(buyPrice * prices.sellFraction);
}

export function sellPrice(buyPrice: number): number {
  return sellPriceFor(PRICES, buyPrice);
}
