/**
 * H5 — deck knobs for the card-drawn hand.
 *
 * An encounter's turns each draw a HAND from a deck built off the roster
 * (draw → hand → discard, reshuffle the discard back in when the draw pile
 * empties). Only the drawn hand fights that turn; the rest sit out.
 *
 * - `handSize` — target cards per turn. Capped by the roster size (a roster
 *                smaller than `handSize` just fields everyone). The deck only
 *                "turns on" once the roster outgrows it — the starting roster
 *                is exactly `handSize`, so draw variance + deck dilution begin
 *                after the first recruit (ROADMAP H5 "the cliff").
 *
 * Also the second half of the G4 difficulty seam: `playerTeamLevel` (in
 * `src/run/enemyBudget.ts`) is `avgLevel × min(rosterSize, handSize)`, so the
 * enemy budget tracks the *expected hand* level, not the whole roster.
 *
 * Balance-tuned in H6 — this is a starting point. Source of truth at
 * `config/deck.json`.
 */

import { z } from 'zod';
import deckJson from '../../config/deck.json';

const DeckSchema = z.object({
  handSize: z.number().int().positive(),
});

export type DeckConfig = z.infer<typeof DeckSchema>;

export const DECK: DeckConfig = DeckSchema.parse(deckJson);
