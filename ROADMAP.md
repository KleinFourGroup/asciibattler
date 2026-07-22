# ROADMAP — Cluster 4: Drafting & Identity (Phases 61→68)

Round opened 2026-07-21. **Spec:** [cluster-4-spec.md](cluster-4-spec.md)
(the user draft + its LOCKED "Kickoff resolutions"). **Narrative:**
[WORKLOG.md](WORKLOG.md) (the kickoff audit + design-conversation rationale
live there). Prior round: [archive/post-52-roadmap.md](archive/post-52-roadmap.md)
(+ worklog + spec, same prefix). This file is a PLAN and stays one (AGENTS
"The planning stack"); sub-steps are cut at each PHASE kickoff, closed
phases demote to stubs (the §60f rule).

**Round charter:** the META-ROADMAP C4 chain — rarity → draft pools →
starting characters — plus the riders the kickoff absorbed: variable
hand/draw, boss forewarning, a second sector, the hcloud box launcher, and
a balance-protocol-v2 close that re-anchors measurement for a
three-character world.

**Why this order:** §61 first (rarity is the most-referenced new model —
model-before-content); §62 early but NON-BLOCKING (boxes on demand for the
whole round; needs the user, so it floats); §63 before §64 (character
weight overrides must be live before daemons that reshape pools, so the
interaction is tested at §64's kickoff, not discovered at §68); §65
independent, slotted after the op-pool work it shares with §64; §66 late
(the second byte-identity break lands just before the measurement tail);
§67 after §66 (the second sector exercises forewarning); §68 last
(consumes everything, closes the round).

**Round-wide predictions & standing notes:**

- Snapshot predictions: RunSnapshot **v37→v38 at §63** (character id),
  **v38→v39 at §66** (pre-rolled boss); WorldSnapshot **v34 HOLDS** all
  round (everything is run-layer).
- Two byte-identity breaks (§61 draw-count shift · §66 stream shift):
  smoke pins re-pin per phase as mechanical fallout; the FULL measurement
  re-anchor happens ONCE, at §68 (mid-round fine reads use paired
  same-seed A/Bs, which survive).
- The §60c grant-consumer lesson applies PROSPECTIVELY: no balance read on
  a new mechanic counts until the bot arm demonstrably consumes it (§68
  owns the arm extension; interim reads say so explicitly).

**Round scope guards (the NOT-doing list):** synergies/traits (OUT — the
daemon layer is the sanctioned channel; revisit trigger = the round-close
playtest) · save/load (Cluster 6) · mid-battle packet casting (stays
deferred by design) · a true-blue palette entry (cyan accepted) · boss
WAVE pre-roll (identity + layout only) · multi-daemon starting characters
(the config field stays single until a character needs more).

## Phase 61 — Rarity core

**Charter:** the round keystone. The `rarity` field on UnitDef (four
tiers, top tier **legendary**), the tier-weighted sampler inside
`rollOffer` (weights 6/3/2/1 from JSON; renormalize over non-empty tiers;
duplicates allowed) — ports inherit by construction — the rarity-accent
CSS (the P1 seam), and the per-tier port price-multiplier SEAM (seeded,
not tuned). Tail riders: the display-label layer (archetype + ability
display names) and the internal `ranged`→`archer` rename.

- **Depends on:** nothing. **Feeds:** §§63/64/68.
- **Risk:** medium — the first RNG draw-count change (fuzz re-pins begin);
  the rename touches a load-bearing id string (units/encounters/rollTeam/
  tests + the FROZEN instrument fixtures) and gets its own deliberate cut
  line.
- **Decision point:** the initial-tier ASSIGNMENT design round (user) —
  tiers for the 13 draftable archetypes; assignment tunes at §68.
- **Exit criteria:** tiers visible on cards (accent CSS live); weights
  govern post-encounter AND port offers (headless distribution tests,
  expectations derived from config); empty-tier renormalization proven;
  price seam authored; display labels shipped; suite + typecheck + smoke
  green with re-pins committed deliberately.
- **Scope guards:** no tier-weight TUNING (§68); no resample-on-duplicate
  (named fallback only); no price-multiplier tuning (§68).

Cut 2026-07-21 (shape-locked; audit + resolutions → worklog §61):

- [ ] **61a** — the `ranged`→`archer` rename, first (mechanical: config
  keys + literals + tests + frozen-fixture KEY renames; predicted
  byte-stream-NEUTRAL — zero re-pins IS the check).
- [ ] **61b** — the `rarity` field, inert (z.enum default `common`;
  `UnitRarity` re-pointed; the three UnitCard adapters read the def;
  `DRAFTABLE_BY_TIER` derived; byte-identical).
- [ ] **61c** — `rarityWeights` in recruitment.json + the weighted sampler
  in `rollOffer` (2 draws/slot — THE stream break, smoke re-pins
  deliberate; config-derived distribution tests + synthetic empty-tier
  renormalization proof).
- [ ] **61d** — initial-tier assignment (DECISION POINT: user design round
  with 61c in hand; provisional table on record in the worklog, bandit
  unassigned; second small re-pin).
- [ ] **61e** — rarity-accent CSS on the `unit-card--rarity-*` hook
  (green/cyan/purple/gold; browser-verify + user native check).
- [ ] **61f** — the per-tier port price-multiplier seam in prices.json
  (exhaustive record, seeds 1/1.5/2/3, threaded through `unitPriceFor`;
  tuned §68).
- [ ] **61g** — archetype display `name` on the schema + the id-display
  site sweep (the `AbilityDef.name` precedent).

## Phase 62 — Infra: the hcloud box launcher

**Charter:** the create/destroy lifecycle CLI (`hcloud server create` →
[scripts/box-setup.sh](scripts/box-setup.sh) → `server delete`) so boxes
spin up on demand; the user education session (hcloud install + API token
path) is part of the phase. Retires the TODO item (filed 2026-07-17).

- **Depends on:** nothing in-round. **NON-BLOCKING:** schedulable any time
  §61+ is in flight; must land before §68's batch tail. Needs the USER
  (education session; token from their Hetzner console — token + addresses
  stay OUT of the repo, standing rule).
- **Risk:** low (plumbing around proven scripts; box-setup.sh + box-batch.sh
  both survived the round close intact).
- **Exit criteria:** one command creates a provisioned box; one destroys
  it; box-batch.sh drives it unchanged; user has run the cycle themselves.
- [ ] *(cut at phase kickoff)*

## Phase 63 — Starting characters

**Charter:** `config/characters.json` + zod (roster / daemons / blacklist
additions / weight overrides), the character field on Run (**RunSnapshot
v37→v38**; the daemon roll dies), the character-select scene (select
before Run construction; `?character=` bypass; `--character` on the
harness, Soldier default), the three shipped characters (Soldier / Priest
/ Gambler), the Character Editor + Global Blacklist Editor (a UI over the
`draftable` flags).

- **Depends on:** §61 (weight overrides are within-tier weights).
  **Feeds:** §64, §68.
- **Risk:** medium-high — the select scene interposes before Run
  construction (Game holds the choice, constructs on confirm — the
  `createRun` seam); every default-run baseline changes when the daemon
  roll dies.
- **Decision point:** none planned (design locked at kickoff); flag any
  discovered fork per protocol.
- **Exit criteria:** all three characters playable from the select scene
  and the URL; blacklists + overrides govern offers (headless tests);
  editors write byte-faithful config; v38 lands with its ledger entry;
  fuzz defaults to Soldier explicitly.
- **Scope guards:** exactly three characters (no fourth); no unlock
  gating (Cluster 6); the select scene is functional, not art-directed.
- [ ] *(cut at phase kickoff)*

## Phase 64 — The three drafting daemons

**Charter:** the pool-size daemon (`recruitOfferSize` run-stat — the
`effectiveCacheSize` precedent), the no-commons daemon, and the
guaranteed-elite-port-offering daemon; whatever rule vocabulary the
latter two need, designed here.

- **Depends on:** §61 (tiers) + §63 (character weights/blacklists live, so
  daemon×character pool interactions are testable at this kickoff).
- **Risk:** medium — two daemons need NEW vocabulary (a pool-composition
  constraint is not a weight).
- **Decision point:** the guarantee/no-commons MECHANISM design (weights-
  as-run-stats making "no commons" a mult-0 fold vs a bespoke op/flag) —
  shape-lock with the user at this kickoff.
- **Exit criteria:** all three daemons purchasable + functional (headless
  pool tests per daemon, incl. each × each character); parse-time legality
  enforced (the superRefine matrix pattern); prices authored (tuned §68).
- **Scope guards:** three daemons only; no bot-arm consumption work here
  (§68 owns it — interim reads carry the inert-mechanic caveat).
- [ ] *(cut at phase kickoff)*

## Phase 65 — Hand & draw size

**Charter:** draw amount becomes a variable (default 6) settable by
daemons and packets; the `drawCards` / `discardCards` ops in the shared
pool; the draw-two + discard-one packets; the draw/discard
animation/transition (render tail, eyeball-verified).

- **Depends on:** nothing hard (op-pool patterns shared with §64).
- **Risk:** medium-high — the enemy-budget coupling (`min(roster,
  DECK.handSize)` is the budget basis TODAY; difficulty.ts records a past
  desync bug here).
- **Decision points:** (1) the enemy-budget DESIGN SESSION (what feeds the
  budget seam when draw varies) — a genuine stop, user required; (2) max
  hand size — A/B on the harness, then user call.
- **Exit criteria:** both packets exercised headlessly; the budget
  decision implemented + tested; persistent modifiers via run-stat fold
  (derived, unserialized) proven; any per-turn draw state that must
  serialize lands with its predicted bump (a v39 rider at §66 if timing
  aligns, else its own); animation browser-verified.
- **Scope guards:** two packets only; no packet-economy tuning (§68).
- [ ] *(cut at phase kickoff)*

## Phase 66 — Boss forewarning

**Charter:** boss encounter + layout pre-rolled at sector start
(**RunSnapshot v38→v39**; serialize the `{bossEncounterId,
bossEncounterMap}` pair — the portStock pending-offer precedent), surfaced
on the sector map (net-new but small UI; the node divs + banner are the
hooks). Identity + layout ONLY — waves still resolve at fight time.

- **Depends on:** ordering only (the deliberate second stream break, last
  before the measurement tail).
- **Risk:** high on measurement (every seed re-rolls; all seed-pinned
  baselines shift), low on code.
- **Exit criteria:** boss identity + layout visible on the map from
  sector start; a mid-sector save/load reproduces the exact boss;
  determinism suite green on the NEW stream; smoke re-pins committed
  deliberately; v39 ledger entry.
- **Scope guards:** boss nodes only (no elite/normal pre-roll); no layout
  PREVIEW rendering (name/identity display, not a minimap).
- [ ] *(cut at phase kickoff)*

## Phase 67 — The second sector

**Charter:** a second demo sector (content design round decides its
shape — anticipated "largely the same as the current one"), the
sector-map DAG grows its first edge (hand-edited JSON, editor-unowned by
design), and the sector-cleared screen (a run-cleared clone —
GameOverScene precedent) since the transition becomes reachable for the
first time.

- **Depends on:** §66 (forewarning displays per-sector; the new sector
  exercises it fresh).
- **Risk:** low-medium — the carry-across path is built + headless-tested
  but has never run in shipped play; expect first-reach bugs.
- **Decision point:** the sector CONTENT design round (user).
- **Exit criteria:** a full two-sector run completes natively
  (user-verified); the coverage guards pass; the cleared screen shows at
  the transition; forewarning re-rolls per sector.
- **Scope guards:** ONE new sector; no new encounter/layout mechanics
  (content from existing catalogs; new catalog ENTRIES are fine).
- [ ] *(cut at phase kickoff)*

## Phase 68 — Balance protocol v2 + the balance pass (round close)

**Charter:** the measurement re-anchor for a three-character,
rarity-weighted world, then the tuning pass, then the round-close ritual.
Protocol first: the per-character doctrine (which §60e bands apply per
character; Soldier = continuity anchor), extending the realistic-bot arm
to CONSUME the new mechanics (`--character`, draw/discard packet dials,
drafting-daemon coverage — §60c applied prospectively), and the
post-stream-shift re-baseline (§60e held-out band re-verify). Then the
pass: initial-tier assignment tuning (§61's design round, now with data),
new daemon/packet prices + the port per-tier multiplier, the absorbed
threads (port goods-vs-hop value · the banshee-comp underperformance),
and the boss wall re-check per character.

- **Depends on:** everything; §62's launcher for the batch tail.
- **Risk:** high — the round's largest measurement surface ("I just
  tripled the balance work" — the protocol step exists to spend that
  deliberately, not implicitly).
- **Decision points:** the per-character band targets (user signs, the
  §60e re-anchor-sheet precedent); any tier reassignments (user).
- **Exit criteria:** protocol v2 written into BALANCE.md (protocol
  section, not run-log); the extended arm demonstrably consumes each new
  mechanic; per-character reads on the signed bands; tier assignment +
  prices dispositioned; the round-close ritual (archive roadmap/worklog/
  spec · scratchpad sweep · memory sweep · caps re-check).
- **Scope guards:** no new mechanics in the close; playtest-driven
  insertions go through the legal-mutation gate.
- [ ] *(cut at phase kickoff)*
