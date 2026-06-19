/**
 * V1 (Post-R "Encounter System" round): the encounter-SELECTION policy — how an
 * encounter is chosen onto a battle node. Loaded as validated config (the A4
 * loud-failure pattern). Source of truth at `config/selection.json`.
 *
 * `strategy` is the keyed-resolver switch (à la O3's `focusTileResolution`):
 *   - `encounterFirst` (the user-locked default) — pick the encounter from the
 *     sector's hop-gated fight pool, then a compatible layout.
 *   - `layoutFirst` — roll the layout first, then an encounter that fits it.
 * Built switchable so a playtest can A/B the two with a config flip; the resolver
 * lives in [../run/encounters/selection.ts](../run/encounters/selection.ts).
 *
 * (The future per-encounter selection WEIGHTING policy will hang here too — the
 * sector pool entries already carry an unread `weight?` seam.)
 */

import { z } from 'zod';
import selectionJson from '../../config/selection.json';

export const SELECTION_STRATEGIES = ['encounterFirst', 'layoutFirst'] as const;
export type SelectionStrategyKey = (typeof SELECTION_STRATEGIES)[number];

const SelectionSchema = z.object({
  strategy: z.enum(SELECTION_STRATEGIES).default('encounterFirst'),
});

export type SelectionConfig = z.infer<typeof SelectionSchema>;

export const SELECTION: SelectionConfig = SelectionSchema.parse(selectionJson);
