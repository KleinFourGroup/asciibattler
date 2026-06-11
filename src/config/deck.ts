/**
 * H5 — deck knobs for the card-drawn hand.
 *
 * An encounter's turns each draw a HAND from a deck built off the roster
 * (draw → hand → discard, reshuffle the discard back in when the draw pile
 * empties). Only the drawn hand fights that turn; the rest sit out.
 *
 * - `handSize` — target cards per turn. Capped by the roster size (a roster
 *                smaller than `handSize` just fields everyone). The deck "turns
 *                on" once the roster outgrows it: K2 raised the starting roster
 *                (10) above `handSize` (6), so draw variance + deck dilution are
 *                live from the FIRST encounter (no longer the H5 "cliff", where
 *                roster == handSize kept the deck dormant until the first
 *                recruit). Redraw (K3) needs this overdraw to mean anything.
 *
 * Also the second half of the G4 difficulty seam: `playerTeamLevel` (in
 * `src/run/enemyBudget.ts`) is `avgLevel × min(rosterSize, handSize)`. With the
 * K2 roster (10) > `handSize` (6) the `min` is pinned at `handSize`, so the
 * enemy budget tracks the *expected hand* level, not the whole roster — and
 * raising `handSize` (5→6) is what moved the band, not the roster bump.
 *
 * Balance-tuned in H6, decoupled in K2 — a starting point, re-swept in N2.
 * Source of truth at `config/deck.json`.
 */

import { z } from 'zod';
import deckJson from '../../config/deck.json';

const DeckSchema = z.object({
  handSize: z.number().int().positive(),
});

export type DeckConfig = z.infer<typeof DeckSchema>;

export const DECK: DeckConfig = DeckSchema.parse(deckJson);
