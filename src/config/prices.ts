/**
 * 50a — the port price book. Source of truth at `config/prices.json` (the
 * economy.ts header reserved this file; the shape is the §50 kickoff
 * shape-lock: a config table × level curve ± jitter for units, per-id
 * entries over per-kind defaults for packets/daemons, one sell fraction,
 * one flat removal price — worklog §50). Numbers are launch-rough; §52
 * tunes them against the reward-table earn rates.
 *
 * - `units.baseByArchetype` — bits for a LEVEL-1 unit of each draftable
 *   archetype. `unitPrice` scales it by `levelGrowth^(level-1)` (the
 *   leveling-curve convention) and rounds once at the read site.
 * - `units.jitter` — the spec's "randomly chosen price": the §50d stock
 *   roll multiplies the deterministic `unitPrice` by a factor drawn
 *   uniformly from [1−jitter, 1+jitter] off the port stream. The roll
 *   lives at the stock site, NOT here — this module stays RNG-free.
 * - `packets`/`daemons` — `byId` overrides over a `default`, so pricing a
 *   standout (miner, the boss-hoard prize) is one line and a new catalog
 *   entry is sellable with zero edits here.
 * - `sellFraction` — sell price = ⌊buy price × fraction⌋. NB the §48
 *   landmine (Run.ts `gainBits` doc): sell PROCEEDS are a refund and take
 *   the raw `addBits` path, never the `bitsGain` fold.
 * - `unitRemovalPrice` — the flat pay-to-remove service fee (kickoff
 *   lock: level-scaled removal punishes exactly the low-value units
 *   removal exists for).
 * - `portStock` — how many of each slot kind a port rolls on entry
 *   (spec §Ports starting points: 5 units / 5 packets / 2 daemons). Slots
 *   are DISTINCT samples, so a count above the (owned-excluded) catalog
 *   size just fills what exists.
 *
 * Boot referential asserts (args-injected for synthetic tests, self-wired
 * below — the packets.ts discipline): every priced archetype exists, every
 * DRAFTABLE archetype is priced (port stock rolls from the draft pool, so
 * a gap would throw at stock time instead of startup), and every `byId`
 * key names a real packet/daemon.
 */

import { z } from 'zod';
import pricesJson from '../../config/prices.json';
import { ALL_ARCHETYPES, DRAFTABLE_ARCHETYPES, rarityForArchetype } from '../sim/archetypes';
import { PACKET_IDS } from './packets';
import { DAEMONS } from './daemons';

const PriceIntSchema = z.number().int().positive();

/** The whole-file schema (exported for schema tests + the §50f editor
 *  round-trip — the `PacketsSchema` precedent). */
export const PricesSchema = z.object({
  units: z.object({
    baseByArchetype: z.record(z.string(), PriceIntSchema),
    levelGrowth: z.number().min(1),
    jitter: z.number().min(0).max(0.9),
    // §61f — the per-tier price-multiplier SEAM (kickoff lock: authored with
    // the rarity field so pricing/editor code needs no second pass; seed
    // values 1/1.5/2/3, TUNED only at the §68 balance pass — price against
    // REALIZED value). Applied inside `unitPriceFor`, so buy, sell (a
    // fraction of buy), port stock, and the editor preview all inherit it
    // from the one formula. Exhaustive over the rarity tiers.
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
 * Boot check: referential integrity between the price book and the three
 * catalogs it prices. Draftable coverage is asserted (not defaulted)
 * because a unit price is per-archetype BASE data, not an override — a
 * missing entry is an authoring hole, not a request for the default.
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
 * Each price read has a PURE, config-parameterized core (`*For`) plus a
 * PRICES-bound convenience wrapper. The game reads through the wrappers;
 * the §50f editor previews its WORKING (unsaved) document through the
 * cores — one formula, so the preview can't drift from what the game
 * would charge (the PortScreen display-honesty discipline).
 */

/**
 * The deterministic (UNJITTERED) unit price: base × levelGrowth^(level−1)
 * × the §61f per-tier rarity multiplier, rounded once here (the runStats.ts
 * read-site-rounds contract). The tier resolves from the archetype id (the
 * def-resolved convention — no tier parameter to drift from the catalog).
 * The §50d stock roll applies the jitter factor on top with its own stream.
 * Throws on an unpriced archetype — the boot assert makes that unreachable
 * for draftable stock; a non-draftable archetype reaching a port IS the bug.
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

/** Sell price for a given buy price: ⌊buy × sellFraction⌋ (floored — a
 *  refund never rounds up past the fraction). */
export function sellPriceFor(prices: PricesConfig, buyPrice: number): number {
  return Math.floor(buyPrice * prices.sellFraction);
}

export function sellPrice(buyPrice: number): number {
  return sellPriceFor(PRICES, buyPrice);
}
