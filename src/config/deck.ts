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
 * Redraws are granted by daemons (`grantRedraws`), each grant carrying its own
 * numbers; nothing here gates them.
 *
 * 49d — `grantQueue`: the pre-turn grant-queue rules (the §49 fire-UX
 * shape-lock). `passIsFinal` = the finality toggle: ON, grants resolve in
 * strict acquisition order — only the ACTIVE (first pending) grant may fire,
 * and `passGrant` finalizes it; OFF, any pending grant may fire in any order
 * and `passGrant` is a no-op (the loosened mode the shape-lock reserved for
 * "not fun" feedback). ⚠ SHIPS `false` until 49f: the strict default is the
 * LOCKED design, but the current pre-turn screen can't express a queue — the
 * guided strip (49f) flips this to `true` in the same commit it becomes
 * renderable (the H4a/H4b headless-core-first discipline). Engine-enforced
 * (headless↔rendered fidelity + the coming save/load interstitial — worklog
 * §49 kickoff); `RunConfig.passIsFinal` overrides per run for tests/fuzz.
 *
 * Balance-tuned in H6, decoupled in K2 — a starting point, re-swept in N2.
 * Source of truth at `config/deck.json`.
 */

import { z } from 'zod';
import deckJson from '../../config/deck.json';

const DeckSchema = z.object({
  handSize: z.number().int().positive(),
  /** 65d — the MAX hand size (user-signed at 8 off the A/B: +2 draw read
   *  +17.5pts even under the Option-B budget coupling, +4 read BELOW +2 —
   *  bigger symmetric hands favor the player, and unbounded transient
   *  Surge-stacking has no other brake; revisit rider on record). The cap
   *  clamps INSIDE `Run.effectiveDrawAmount` — so the deal and the enemy-
   *  budget basis stay coupled (the K2 desync lesson) — and stops/rejects
   *  the `drawCards` packet op at the read site. A cap below `handSize` is
   *  schema-legal and simply clamps the base deal (odd but coherent). */
  maxHandSize: z.number().int().positive(),
  grantQueue: z.object({
    passIsFinal: z.boolean(),
  }),
});

export type DeckConfig = z.infer<typeof DeckSchema>;

export const DECK: DeckConfig = DeckSchema.parse(deckJson);
