/**
 * 47e — the economy substrate knobs (Cluster 3, spec §Bits).
 *
 * - `startingBits` — a fresh run's bits balance (spec-locked default 0; a
 *   `RunConfig.startingBits` override wins for dev/fuzz/playtest runs).
 *
 * Grows with the cluster as run-level economy knobs appear (§48's reward
 * tables and §50's prices get their own files; this one holds the substrate).
 * Source of truth at `config/economy.json`.
 */

import { z } from 'zod';
import economyJson from '../../config/economy.json';

const EconomySchema = z.object({
  startingBits: z.number().int().nonnegative(),
});

export type EconomyConfig = z.infer<typeof EconomySchema>;

export const ECONOMY: EconomyConfig = EconomySchema.parse(economyJson);
