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

## Phase 61 — Rarity core ✅ CLOSED 2026-07-22

**Outcome:** the round keystone shipped in seven cuts over two days —
four tiers (legendary top) def-resolved by archetype id, the 2-draw
weighted sampler (dupes by design; ports inherit by construction), the
USER-SIGNED 5/3/3/2 assignment (ronin/reaver kept up-tier on flavor →
their buff is a named §68 goal), background-tint accents (glyph tints
vetoed at playtest), the 1/1.5/2/3 price seam through `unitPriceFor`,
display names, and the stream-neutral `ranged`→`archer` rename. Zero
snapshot bumps (v37/v34 hold); the only content re-pin was the port
canary (12→2). All exit criteria met; detail worklog §61 + git.

- [x] **61a** — the `ranged`→`archer` rename ✅ 2026-07-21: ~500
  replacements, zero re-pins (stream-neutrality proven); worklog §61a.
- [x] **61b** — the `rarity` field, inert ✅ 2026-07-21: schema + adapters +
  `DRAFTABLE_BY_TIER` + editor select/formatter; byte-identical; worklog §61b.
- [x] **61c** — weights + the weighted sampler ✅ 2026-07-22: 2 draws/slot,
  dupes by design; zero re-pins NEEDED (smoke pins are invariants, not
  content — the §68 measurement re-anchor is the real cost); worklog §61c.
- [x] **61d** — initial-tier assignment ✅ 2026-07-22 (USER): provisional
  table + bandit common; ronin/reaver KEPT up-tier on flavor, their buff
  is a named §68 goal; worklog §61d.
- [x] **61e** — rarity-accent CSS ✅ 2026-07-22, REWORKED same-day on the
  playtest read: accent = card BACKGROUND tint (all four tiers), glyphs
  back to pure team colors; computed-style-verified; worklog §61e.
- [x] **61f** — the per-tier price-multiplier seam ✅ 2026-07-22: seeds
  1/1.5/2/3 through `unitPriceFor` (buy/sell/stock/editor inherit from
  the one formula); editor + formatter taught; worklog §61f.
- [x] **61g** — archetype display names ✅ 2026-07-22: required `name` on
  UnitDef + `nameForArchetype`; UnitCard/CacheOverlay sweep; editor Name
  input; TODO #82 retired; worklog §61g.

## Phase 62 — Infra: the hcloud box launcher ✅ CLOSED 2026-07-23

**Outcome:** [scripts/box-launch.sh](scripts/box-launch.sh) (`6cfe73a`) —
`create`/`destroy`/`list` wrapping hcloud, defaults cx43/fsn1/ubuntu-26.04
(the §57f2 pair); availability doctrine: location auto-falls-back
(fsn1→nbg1→hel1), type fails LOUD (user-shaped). Education session done
live (winget install · token → `hcloud context` by the user's own hand ·
the 57f2 ssh key survived); the user ran the full cycle themselves
(create → 8-run smoke via box-batch.sh unchanged → destroy, <1¢). All
exit criteria met; TODO's 2026-07-17 hcloud item retired. Detail:
worklog §62.

- [x] **62a** — education: install + context + key check ✅ 2026-07-23
- [x] **62b** — `scripts/box-launch.sh` ✅ 2026-07-23 (`6cfe73a`)
- [x] **62c** — the user's full create→batch→destroy cycle ✅ 2026-07-23

## Phase 63 — Starting characters ✅ CLOSED 2026-07-24 (user-signed)

**Outcome:** the three starting characters (Soldier / Priest / Gambler,
`config/characters.json` + zod) live end to end — the character owns
roster/daemon/blacklist-additions/weight-overrides (**RunSnapshot v37→v38**,
`characterId` serialized; the L1 daemon roll retired — default = Soldier→Mars
always, offers byte-neutral), selectable via the CharacterSelectScene
(`Game.run: Run \| null` deferred construction), `?character=`, and
`--character` (explicit Soldier default). Both editors write byte-faithful
config (no-edit Save = byte no-op on disk, proven end-to-end) and the
launcher gained its character dropdown. All exit criteria met; all five
kickoff forks held. Detail: worklog §63a–§63g.

- [x] **63a** — characters.json + zod loader, inert ✅ `0537106`
- [x] **63b** — the weighted within-tier sampler, byte-neutral ✅ `f8b3e26`
- [x] **63c** — Run gains the character; v38; the roll dies ✅ `32dac45`
- [x] **63d** — `--character` / `?character=` / the relabel ✅ `f958d37`
- [x] **63e** — CharacterSelectScene + deferred-Run surgery ✅ `0d329ac`
- [x] **63f** — the Character Editor + launcher dropdown ✅ `4fe8a06`
- [x] **63g** — the Global Blacklist Editor ✅ `59b310e` + `5341452`

## Phase 64 — The three drafting daemons ✅ CLOSED 2026-07-25 (user-signed)

**Outcome:** all three daemons live as pure `modifier` rules over new
run stats — ZERO new vocabulary (the kickoff audit's claim, held):
The Cornucopia (`recruitOfferSize` +1, recruit-only) · Patrician's
Seal (tier weights promoted to run stats, no-commons = mult-0, BOTH
offer sites) · Idol of Portunus (`portLegendaryOffers` count stat,
per-slot tier forcing, byte-identical empty-pool degrade). Prices
30/35/25 (tuned §68), both reward tables, no snapshot bump (v38/v34
hold). The composed matrix (all three × each character) is test-pinned.
Detail: worklog §64-kickoff–§64d.

- [x] **64a** — The Cornucopia ✅ 2026-07-24 (`d310364`); worklog §64a.
- [x] **64b** — Patrician's Seal ✅ 2026-07-24 (`4f9a4db`); worklog §64b.
- [x] **64c** — Idol of Portunus ✅ 2026-07-24 (`757b7b0`); worklog §64c.
- [x] **64d** — close ✅ 2026-07-25 (`59c052e`); worklog §64d.

## Phase 65 — Hand & draw size ✅ CLOSED 2026-07-25 (user-signed)

**Outcome:** draw amount is a first-class mechanic end to end, in one
day and six cuts — the `drawAmount` run-stat fold (base = deck.json;
**cap 8 USER-SIGNED** off the 3-arm paired A/B: base 50.0 / +2 67.5 /
+4 60.0 — bigger symmetric hands beat the Option-B coupling; the
+2-vs-+4 noise question → §68) · **Option B at the budget seam**
(`min(roster, effectiveDrawAmount)`, transient packet draws excluded
by design — pure advantage) · the packet-only `drawCards`/
`discardCards` ops + **Surge/Cull** · the `--draw-add` harness dial ·
the full render tail (the "Draw: N" chip, enter/exit motion, the 65f
`deck:*` cue stream + serial pile pulses, the recycle prefix cut on
the feel read). **NO snapshot bump** (v38/v34 hold, as the kickoff
predicted); the batch-sizing process note → scratchpad. Detail:
worklog §65-kickoff–§65f.

- [x] **65a** — the `drawAmount` fold ✅ (`aa3c8c4`); worklog §65a.
- [x] **65b** — Option B at the `WaveContext` seam + the desync pin ✅
  (`ccb5270`); worklog §65b.
- [x] **65c** — Surge + Cull ✅ (`ce7ff15`); worklog §65c.
- [x] **65d** — the cap, USER cap 8 off the A/B ✅ (`4225c32` +
  `ba3898e`); worklog §65d-dial + §65d.
- [x] **65e** — the render tail ✅ (`cb71b93`), native feel-read
  signed 2026-07-25; worklog §65e.
- [x] **65f** — the deck-cue stream + serial pile pulses (inserted off
  the 65e feel read) ✅ (`7916e64` + `0e66ced` + `4ef20e9`), native
  feel-read signed; worklog §65f.

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
- [x] **66a** — the pre-roll core ✅ 2026-07-26 (`f9b44f7`): v38→v39;
  the stream break landed NARROWER than predicted (pre-boss content
  seed-identical; zero smoke re-pins needed); worklog §66a.
- [ ] **66b** — the forewarning surface: a `Run.bossForewarning` getter →
  a banner sub-line ("Boss: \<name\> — \<layout\>"; procedural =
  "Uncharted Ground", USER) + a boss-node hover title; layout name shown
  (USER — revisit trigger: playtest "too easy" feedback); native
  feel-read signs.

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
threads (port goods-vs-hop value · the banshee-comp underperformance ·
the **ronin/reaver buff look** — the 61d flavor-over-power call made
their weakness a named goal; force-comp probes per §60c, worklog §61d ·
the **+2-vs-+4 draw non-monotonicity** — noise or real, re-read at
protocol-v2 grade; worklog §65d), and the boss wall re-check per
character.

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
