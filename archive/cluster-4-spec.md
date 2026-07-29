# Cluster 4 Spec: Drafting Mechanics

## Because we're not ripping off Slay the Spire enough

This spec details the cluster 4 deck building mechanics: unit rarity and drafting, along with starting characters.

### Unit Rarity

Every unit archetype definition is going to be expanded to include a rarity level.  There are four levels: common, uncommon, rare, and elite.  (AN: since we already have elite encounters, we need a different name for this tier.)  These are color-coded: green, blue, purple, and gold.  (Design round these choices.)  To start, just convert every unit archetype to common; we will balance them at the round's end.  Different rarities appear in the recruit pool with different frequencies.  This is specified by weights in a JSON config.  Our starting weights will be common: 6, uncommon: 3, rare: 2, elite: 1.  Units within a tier appear with the same probability, subject to the restrictions below.

### Starting Characters

Every run now bears a character field.  Each character defines a unique starting configuration:

* Roster
* Daemons
* Blacklisted archetypes

  * A list of unit archetypes that do not appear in the recruitment pool for this character
* Archetype weight overrides

  * A list of unit archetypes with an override weight, determining the frequency with which the archetype appears when a unit of the corresponding rarity is generated for recruitment.
  * The default weight is one.
  * This does not override the frequencies of the rarity levels.  Those are global.
* (Yes, the blacklist is functionally equivalent to setting an archetype's weight to zero.)
* Starting character is chosen on a new scene at the beginning of a run, unless supplied via URL argument.

We'll start with the following starting characters:

* The Soldier

  * The current starting roster
  * Starts with Idol of Mars
  * Same blacklist as current global configs
  * No overrides
* The Priest

  * Replace one archer with a healer
  * Starts with Minerva
  * Same blacklist + shaman
  * Mage has 0.25 weight
* The Gambler

  * Replace two mercenaries with a ronin and a rogue
  * Starts with Janus
  * Same blacklist
  * Rogue weighted at 3

### Additional Drafting Notes

The drafting system by-and-large falls out of the aforementioned mechanics.  A few additional specifications, however:

* In addition to the Character Editor, there should be a separate Global Blacklist Editor, which just lets you blacklist an archetype for every character at once.  Useful for archetypes like the ghoul.
* Port recruitment pools should follow the same mechanics as the post-encounter pools.
* We're going to create three daemons to interact with drafting mechanics:

  * One that increases the post-encounter pool from three to four.
  * One that eliminates commons from the draft pool.
  * One that guarantees an elite offering in port recruitment.

### Additional Feature: Hand and Draw Size

Right now, every battle pre-turn involves drawing exactly six units from the player's roster.  We would like to make this a proper mechanic:

  * Draw amount is now a variable that can be set by daemons and packets.  Six is simply the default.
  * You can draw additional units after your initial draw as well.

    * We'll create a draw two packet to exercise this path.
    * Likewise a discard one packet.
    * UNDECIDED: if there is a max hand size, and if so, what it is.  This probably just needs an A/B test.
  * UNDECIDED: if enemy unit budget scales with initial draw size or final hand size.  This probably needs a full design session.
  * Graphics: we need some sort of animation / transition for drawing and discarding, rather than them instantaneously appearing.

### Additional Feature: Boss Forewarning

Initial feedback is that it's hard to plan around boss encounters.  We would like to generate boss encounter and layout at the start of a sector, and display this information on the sector map.  Because like I said, we're not ripping off StS enough. 😂 I recognize that this will break byte-identical.

### Additional Content: A New Sector

We're getting an increasingly large amount of content for one fifteen minute run.  As such, we believe it's time to create a second sector.  As is the case with the current sector, this is demo content designed to test and showcase.  We will do a design round to determine what goes in it, but I anticipate it being largely the same as the current one.

### Infrastructure

We need to get the CLI script for starting and stopping VPS instances made, so we're able to run balance batches on demand.  This will require an education session for me.

## Kickoff resolutions (LOCKED 2026-07-21 — the spec-audit design conversation)

Decisions from the code-reality audit (WORKLOG §Kickoff) + the design
conversation. These amend the draft above; rationale in the worklog.

**Rarity**

- Tier 4 is named **legendary** (the "elite" collision resolved; genre-standard
  beats clever here). Colors: green / **cyan** (`FLOURESCENT_BLUE` — no true
  blue is added to the palette) / purple / gold.
- **NOT all-common at first**: a design round assigns initial tiers to the 13
  draftable archetypes when the rarity mechanics land; the assignment is
  *tuned* at the round-end balance pass.
- Sampling semantics: the tier roll **renormalizes over non-empty tiers**;
  offers **MAY contain duplicate archetypes** (rolled levels + growth
  differentiate; with weight overrides, dupes are the character identity
  working). Named fallback if playtest shows degenerate offers: one resample
  per duplicate — not pre-built.
- The global blacklist mechanism IS the existing `draftable` flag; the Global
  Blacklist Editor is a UI over it (no new config file).
- Port unit pricing gains a **per-tier price-multiplier seam** in
  `prices.json`, authored alongside the rarity field (seed values ~1/1.5/2/3),
  tuned only at the balance pass (price against REALIZED value).

**Characters**

- Characters **replace the run-start daemon roll** — intended. The harness
  gains an explicit character selector (`--character` / `?character=`);
  fuzz/bot arms **default to The Soldier**.
- The spec's "archer" = the archetype id `ranged` today; see the rename rider
  below.

**Hand/draw**

- The enemy-budget question gets its **full design session at that phase**,
  anchored on code reality: the budget basis is ALREADY
  `min(roster, DECK.handSize)` — the session decides what feeds that seam
  when draw varies.

**Boss forewarning**

- Reveals boss **identity + layout only**; waves still resolve at fight time
  against team level (the existing budget model). Byte-identity break
  ACCEPTED; the two stream-breaking changes (rarity draw-counts, boss
  pre-roll) share **one measurement re-baseline window**.

**Second sector**

- Sector-transition UI = a **sector-cleared screen cloned from the
  run-cleared screen** (GameOverScene precedent). The sector-map DAG stays
  hand-edited JSON.

**Balance (new scope, absorbed by user call)**

- A dedicated **balance-protocol-v2 step**: characters tripled the
  measurement surface — the step owns the per-character doctrine (which §60e
  bands apply per character) AND **extending the realistic-bot arm to consume
  the new mechanics** (the drafting daemons, the draw/discard packets, the
  character selector) — the §60c grant-consumer lesson, applied prospectively.
- Absorbed into the round-end balance pass: **port goods-vs-hop value** (the
  §60c filed input) and the **banshee-comp underperformance** (§60e split).

**Riders absorbed**

- The rarity-accent CSS TODO (the P1 seam gets styled here).
- The **display-label layer** (archetype + ability display names) AND the
  internal rename **`ranged` → `archer`** — flagged cost: the id is a
  load-bearing string (units/encounters/rollTeam/tests + the FROZEN
  instrument fixtures carry per-archetype keys); its own deliberate cut line.

**Explicitly OUT / deferred**

- **Synergies/traits: OUT** (the META-ROADMAP C4 conscious call). The daemon
  layer is the sanctioned synergy channel — archetype-filtered hooks (the
  Laverna precedent) are nearly free to author under the §47 vocabulary.
  Revisit trigger: drafting feels thin at the round-close playtest; revisit
  shape: a `tags` field on UnitDef + tag-filtered hooks (an extension, not a
  system).
- **Save/load: deferred back to Cluster 6** (its original META-ROADMAP home)
  — this round's RunSnapshot bump(s) would orphan any saves built before it.

