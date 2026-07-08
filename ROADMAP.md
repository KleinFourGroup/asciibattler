# ROADMAP — Cluster 3: Economy (Phases 47→52)

> **▶ ACTIVE — the third of the six post-X meta-roadmap clusters
> ([META-ROADMAP.md](META-ROADMAP.md)), and the first roadmap authored under
> the 2026-07-06 planning-stack protocol** (AGENTS.md "The planning stack"):
> this file is the PLAN and stays one for its whole life. Phase entries carry
> charter / ordering + dependencies / risk / decision points / exit criteria /
> scope guards ONLY; sub-steps are cut at each phase kickoff; narrative,
> findings, and rationale land in [WORKLOG.md](WORKLOG.md); plan mutations here
> are one line + a worklog pointer. Spec: **[cluster-3-spec.md](cluster-3-spec.md)**
> (hardened + locked 2026-07-07 — audit this plan against it). **First task of
> the next round's kickoff = archive this file + WORKLOG.md →
> `archive/post-46-roadmap.md` + `archive/post-46-worklog.md`** (the ritual).

Companion to [DESIGN.md](DESIGN.md), [ARCHITECTURE.md](ARCHITECTURE.md),
[BALANCE.md](BALANCE.md), [TODO.md](TODO.md), [GOTCHAS.md](GOTCHAS.md), and
[META-ROADMAP.md](META-ROADMAP.md). Prior roadmaps in [archive/](archive/) —
most recently [post-41](archive/post-41-roadmap.md) (the Pathfinding Audit,
42→46).

## Where this came from

The META Cluster-3 brief (currency + rewards + shop + consumables + their
editors) expanded through the 2026-07-07 spec round. The kickoff's blind-spot
audit found the load-bearing surprise that shapes this whole plan: **the
daemon effect system the economy leans on doesn't exist yet** (today's daemons
only gate redraw/empower), so the cluster opens by building the shared
daemon/packet **rule vocabulary** — the meta-model analogue of Cluster 1's
`AbilityDef` — and everything else authors against it. Full kickoff narrative:
[WORKLOG.md](WORKLOG.md) §Kickoff. Vocabulary (locked): **bits** (currency) ·
**packets** (consumables) · **cache** (inventory) · **ports** (shops).

## The phase sequence at a glance

| Phase | Name | One-liner | Risk |
|---|---|---|---|
| **47** | The rule vocabulary | Rules (modifiers + hooks) + run-stat folds; idols re-authored; multi-daemon; tally-settle + battleRules seams; bits substrate | High (run+sim seam surgery, both snapshots bump) |
| **48** | Rewards | Reward tables + registry + editor; the reward phase + screen; the persistent bits overlay | Medium (new run phase; screen-flow insertion) |
| **49** | Packets & cache | `PacketDef` + cache + the two use contexts; the pre-turn "fire" UX round; packet editor | Medium (the spec's one ⚠ OPEN resolves here) |
| **50** | Ports | The node kind + scatter; the port phase + screen; stock/buy/sell; unit removal | Medium (broad surface, little core; the rosterIndex risk) |
| **51** | The UI/UX cohesion review | A deliberate cohesion sweep over every surface the cluster added — may be a documented no-op | Low (review + polish; no new systems) |
| **52** | The balance pass + close-out | Economy tuning vs BALANCE.md; the boss-wall rider re-read; round close | Low (measure + config; §41/§46b precedent) |

## Sequencing rationale

§47 first — META principle 1 (model before content): every later phase
authors ops, hooks, or folds against the vocabulary, and re-authoring the four
idols early proves the schema on real content before new content exists. §48
before §49 because packets *arrive* via rewards — the delivery pipe (tables,
reward phase, screen) exists before the goods; packet table entries ship
schema-complete but dormant in §48 and activate in §49. §50 after all three: a
port sells packets and daemons for bits — it consumes every model this cluster
defines. §51 (user-inserted at shape-lock) sits after §50 because every
surface must exist to review, and before §52 because closing a cluster with
the balance pass is the established routine. §52 last by that convention, and
it owns the balance rider carried in from the Pathfinding Audit.

## Hard ordering constraints

- §47's multi-daemon ownership + owned-exclusion gate §48 (daemon table
  entries) and §50 (daemon stock).
- §47's run-stat fold machinery gates §49's derived `cacheSize` and §48's
  `bitsGain` modifiers.
- §47's bits substrate (`run.bits` + `run:bitsChanged`) gates §48's overlay
  and every earn/spend surface.
- §48's table schema + reward phase gate §49's packet rewards and §50's
  richer port/elite loot authoring.
- §49's `PacketDef` + cache gate §50 (ports stock and sell packets).
- The spec's ⚠ OPEN (the pre-turn fire UX) resolves at §49's kickoff — no
  phase before it depends on that answer.
- §51 after §50 (nothing to review until every surface exists); §52 strictly
  last (the close-out lives there).

## Conventions (the standing set)

Headless-first for all run/sim logic; every serialized-shape change bumps its
snapshot version, reject-stale; commit per logical change + pause between
commits; fuzz/determinism re-baselines are EXPECTED (new RNG streams §47/§48,
the scatter pass + new phase §50) and each gets its own commit note; editors
ride their feature and extend the `/__save-config` allowlist + `/tools/`
index; balance-proof tests derive from config; keep DESIGN.md /
ARCHITECTURE.md (event + command catalogs!) honest in the same commit;
browser-verify the new UI surfaces natively (overlay, reward/port screens);
SFX polish rides its feature (pickups §48, purchases §50).

---

## Phase 47 — The rule vocabulary (the keystone)

**Charter:** build the shared daemon/packet effect model: `Rule = modifier |
hook` over a new run-stat fold vocabulary, run-domain + battle-domain triggers,
and the two seam crossings (battle hooks compile into the World as
`battleRules[]` data; battle-earned run resources settle via a serialized
WorldSnapshot tally — the XP pattern). Re-author the four idols in it, delete
the legacy gates + `TurnGates`, land uncapped multi-daemon ownership
(serialized by id), and lay the bits substrate (`run.bits`, `run:bitsChanged`,
floor-at-zero, `RunConfig` override) that tallies settle into.

**Why here / dependencies:** everything downstream authors against this
schema; no new-system dependencies. Consumes the Phase-L deferral
(multi-daemon economy) and the dormant `RunTriggerContextMap` seam.

**Risk:** **High** — the cluster's core surgery, crossing the run/sim seam.
Both snapshots bump (Run: daemons-by-id + rules + bits; World: tallies +
battleRules). Mitigation: the idol re-authoring is a behavior-equivalence
refactor with the existing daemon fuzz arm as the oracle.

**Decision points — ✅ DECIDED at kickoff (2026-07-07, worklog §47):** launch
lists = 5 triggers / 5 ops / 2 run-stats (see the cut; `grantPacket` waits
for §49's `PacketDef`); daemons serialize BY ID (bespoke round-trip
retires); PreTurnScreen = stacked banner lines; NO overlay pull-forward.

**The cut (shape-locked 2026-07-07; rationale in worklog §47):**

- [x] 47a — `foldRunStats` + `RunStatKey` (`bitsGain`, `cacheSize`): pure module + tests, zero consumers ✅ [runStats.ts](src/run/runStats.ts), 9 tests
- [x] 47b — the `Rule` zod schema (modifier | hook; triggers `turnStart/encounterStart/encounterEnd` + `dealHit/kill`; ops `grantRedraws/grantEmpowers/gainBits/healPool/applyStatus`; filters `archetype/crit/won`) alongside legacy gates; no behavior change ✅ [daemons.ts](src/config/daemons.ts) + matrix guard + boot assert, 16 tests
- [x] 47c — the run-domain hook engine; idols re-authored; serialized `turnGrants` replaces `turnGates`; legacy gates + `TurnGates` DELETED; **Run v24→v25** ✅ oracle PASSED — all 6 fuzz arms byte-identical (worklog §47)
- [ ] 47d — multi-daemon: `daemons[]` by id; PreTurnScreen stacked banners; `turn:starting` list payload; **v25→v26**
- [ ] 47e — the bits substrate: `run.bits` + `run:bitsChanged` + `config/economy.json` + `RunConfig` override + `gainBits` with the `bitsGain` fold; example daemon #3; **v26→v27**
- [ ] 47f — `battleRules[]` compile-in + `tallies` settle (the XP pattern); examples #1+#2; **World v32→v33** + determinism/fuzz re-baseline
- [ ] 47g — exit sweep: full fuzz pass, ARCHITECTURE catalog/tree, GOTCHAS, docs + cursor flip

**Exit criteria:** the four idols behave equivalently under the new schema
(fuzz `--daemon` green); the spec's five motivating example daemons are
*authorable* and at least three are authored + tested (one per matrix
quadrant: battle→run tally, battle→battle status, passive modifier);
multi-daemon ownership round-trips by id; `TurnGates` and the legacy gate
fields are gone.

**Scope guards:** NO packet delivery mechanics (ops only — active/targeted
delivery is §49); NO reward tables; NO speculative vocabulary beyond the
launch lists; NO mid-battle player input of any kind.

---

## Phase 48 — Rewards (tables, the reward phase, the bits surfaces)

**Charter:** make the reserved `rewards?` encounter seam real: the
reward-table registry (`config/rewards.json`, entries = bits `{min,max}` |
packet | daemon, weighted, owned-daemon exclusion) referenced by name with a
boot-time integrity assert; `{table, trigger}` lists on encounters
(independent `chance` tests on win); the serialized reward run-phase + screen
in the locked battle → rewards → promotion → recruit sequence, declinable
per-portion; the persistent top-left bits overlay (the new Game-level
page-lifetime layer); dedicated forked RNG streams; `bitsMultiplier` on the
X1 difficulty seam. The reward-table editor rides.

**Why here / dependencies:** needs §47 (multi-daemon exclusion, bits
substrate, `bitsGain` folds). Packet entries ship dormant (schema-complete,
zero defs) — the pipe before the goods.

**Risk:** **Medium** — a new serialized run phase spliced into the post-battle
scene chain, plus net-new persistent-UI infrastructure. RunSnapshot bumps
(reward phase + pending offer + reward RNG streams).

**Decision points:** the reward-screen UX (accept/decline layout; how
inventory-full presents before the cache UI exists — likely "packet rewards
can't appear until §49" makes this moot, confirm at kickoff); launch table
catalog + which encounters reference which tables (authoring cut at kickoff);
elite table richness (authoring, not engine).

**Exit criteria:** win a battle → reward screen → accept/decline bits +
daemon rewards → promotion → recruit, user-confirmed in the native browser;
bits visibly tick on the overlay in AND out of battle; a mid-reward
save/reload reproduces the pending offer; fuzz drives through the reward
phase green.

**Scope guards:** NO packet defs (dormant entries only); NO trigger
predicates beyond `chance`; NO reward sources besides encounter-win (camps/
events are Cluster 5); rest nodes unchanged.

---

## Phase 49 — Packets & cache

**Charter:** `PacketDef` (`usableIn` + `TargetSpec` + the duration axis from
day one — the mid-battle seam ships dormant) + the cache (base six slots, no
stacking, size as a derived run-stat, discard, the forced-keep shrink flow,
reward-time decline-or-swap); the two launch use contexts (out-of-battle on
roster/piles/run; pre-turn on hand units + battle-wide via battle-scoped rule
injection); launch packet content (the empower set + redraw-2 + a couple of
Cluster-1-effect packets); packet reward entries activate. The packet editor
rides.

**Why here / dependencies:** needs §47 (the op pool, `cacheSize` folds) and
§48 (packets arrive via rewards). Resolves the spec's one ⚠ OPEN — the
pre-turn "fire" UX (the popup-window instinct) — as a design round AT this
kickoff (shape-lock with the user before building; empower/redraw stop being
inline and generalize into it).

**Risk:** **Medium** — mostly new UI surfaces + run-level state; the sim
stays untouched beyond §47's machinery. RunSnapshot bumps (cache contents).

**Decision points:** the pre-turn fire UX (THE design round — flagged since
the spec draft); the launch packet list; where cache management UI lives
out-of-battle (map-screen modal vs a persistent-layer button next to the
overlay).

**Exit criteria:** the loop earn-store-use runs end to end: a packet won from
a reward table lands in the cache, survives save/reload, fires pre-turn (unit
+ battle-wide) and out-of-battle (roster target), with its status/effect
visible in battle; full/swap/shrink flows user-confirmed; empower/redraw
still work as packet-shaped fires under the new UX.

**Scope guards:** NO mid-battle pause-to-cast (the seam ships, the feature
doesn't); NO tile-targeted launch content (waits for mid-battle); NO
stacking; NO permanent-duration launch content (`encounter`/`run` only).

---

## Phase 50 — Ports

**Charter:** the port node kind (glyph, scatter pass mirroring elites:
`portChance`/`portMinSpacing`, ≥1 per sector guarantee, never the boss hop);
the serialized port run-phase + screen; stock (5 units priced by
archetype+level / 5 packets / 2 daemons owned-excluded) rolled on entry from
a dedicated stream and serialized; buy/sell (sell = config fraction) +
pay-to-remove-a-unit via the single `removeRosterUnit` chokepoint fixing all
five rosterIndex-keyed structures; prices config + the port editor; the fuzz
harness gains `case 'port'` immediately (and eventually a purchase-policy
arm).

**Why here / dependencies:** consumes everything — bits (§47), the exclusion
+ pricing patterns (§48), `PacketDef` + cache (§49). Port-recruited units
wire into the deck exactly like post-battle recruits.

**Risk:** **Medium** — broad surface (node generation, a new phase, a big
screen, the fuzz case) but little core surgery. The one flagged engineering
risk: unit removal shrinking the roster for the first time (the rosterIndex
collision — chokepoint + co-located test, per the spec). RunSnapshot bumps
(node kind regenerates maps + port phase + stock).

**Decision points:** the port glyph (`$`?) + map presentation; the port
screen layout (five surfaces in one screen — recruit/packets/daemons/sell/
remove); price formula shapes (flat-per-archetype × level curve vs budget-
derived — decide at kickoff with the editor in hand); removal service
pricing.

**Exit criteria:** a full economy loop in one run, user-confirmed natively:
earn bits → dock at a port → buy a packet + a daemon + a unit, sell a
packet, pay to remove a unit → the roster/deck/effects all stay coherent
(the chokepoint test proves it); every sector map rolls ≥1 port; fuzz drives
through ports green with the new baselines pinned.

**Scope guards:** NO rarity/draft-pool weighting in stock (Cluster 4 — price
by archetype+level only); NO port re-visits / stock rerolls; NO stable-
unit-id refactor (the chokepoint is the fix); NO haggling/reputation/other
shop mechanics not in the spec.

---

## Phase 51 — The UI/UX cohesion review

**Charter:** a deliberate cohesion pass over every surface this cluster adds
or reshapes — the persistent bits overlay, the reward screen, the
multi-daemon pre-turn list + fire UX, cache management, the port screen — and
their seams with the existing HUD/screens (corners, modals, typography,
fades, keybindings). We design and revise UI concurrently with features, so
this phase MAY close as a documented no-op (the §41/§46b precedent); it
exists to make cohesion an explicit checkpoint instead of an assumption.
*(User-inserted at shape-lock, 2026-07-07.)*

**Why here / dependencies:** after §50 — every surface must exist to review.
Before §52 — closing with the balance pass is the cluster routine.

**Risk:** **Low** — review + polish fixes; no new systems, no serialized
state.

**Decision points:** the triage boundary (what gets fixed in-phase vs filed
to TODO.md); whether the carried renderer "queued"-stance rider (TODO.md)
folds in here or stays deferred.

**Exit criteria:** a full-run native playtest sweeping every new surface;
every finding either fixed or filed, with the user's sign-off; the verdict —
fixes or documented no-op — recorded in the worklog.

**Scope guards:** NO new features or mechanics; NO redesigns beyond cohesion
(a finding that wants one becomes a next-round item); NO balance changes
(§52's domain).

---

## Phase 52 — The economy balance pass + close-out

**Charter:** the cluster-closing balance pass, BALANCE.md protocol: tune the
bits curve (encounter tables), prices, and `bitsMultiplier` at the optimum
strategy; **re-read the carried boss-wall rider** (59% held-out vs the 43–55%
target — run-level economy is the named lever; BALANCE.md §46b) and resolve
it: tune, or document the acceptance. Then the round close: HANDOFF cursor
flip, archive the roadmap+worklog pair, memory update, and the post-cluster
interstitial-audit proposal (the standing convention).

**Why here / dependencies:** last by convention; needs the whole economy
live to measure. The fuzz purchase-policy arm (from §50) is what makes the
optimum measurable — confirm it exists before sweeping.

**Risk:** **Low** — measure + config; the §41/§46b "documented no-op is a
legitimate outcome" precedent applies to the tuning (NOT to the rider, which
must be explicitly resolved or re-scoped).

**Decision points:** the rider verdict itself; whether packet/daemon prices
join the difficulty-multiplier seam; whether an economy section lands in
BALANCE.md's protocol header (a new metric family: bits-per-hop, spend
mix).

**Exit criteria:** a BALANCE.md entry with the economy baseline (bits
earned/spent per hop at the optimum, win-rate + gradient vs the §46b
numbers); the boss-wall rider explicitly resolved; docs closed (cursor
flipped, pair archived at the next kickoff per the ritual).

**Scope guards:** NO new content/features (tuning + docs only — findings
that want features become TODO/next-round items); NO relaxing any standing
gate (drift gates, determinism) to make numbers fit.

---

## What we're explicitly NOT doing (the cluster scope guard)

- **No mid-battle pause-to-cast** — the `usableIn`/`TargetSpec` seam ships;
  the player→sim input channel does not. (Deferred, spec §Packets.)
- **No tile-targeted packet content** — waits for mid-battle casting.
- **No rarity, draft pools, or starting characters** — Cluster 4 (ports sell
  by archetype+level; the rarity-weighted stock upgrade lands there).
- **No camps, events, or non-encounter reward sources** — Cluster 5.
- **No meta-currency or cross-run persistence** — Cluster 6.
- **No stable-unit-id refactor** — `removeRosterUnit` chokepoint only.
- **No synergies/traits** — the Cluster-4 spec-time decision, not ours.
- **No trigger predicates beyond `chance`** on reward tables at launch.
- **No daemon cap** — uncapped is the locked design; don't re-litigate.

## Open decisions to resolve when building (the cross-cutting set)

- 47: launch trigger/op/stat lists; multi-daemon PreTurnScreen presentation;
  overlay pull-forward.
- 48: reward-screen UX; launch table catalog.
- 49: **the pre-turn fire UX** (the spec's ⚠ OPEN — a design round at phase
  kickoff); the launch packet list; cache-UI home.
- 50: port glyph + screen layout; price formulas; removal pricing.
- 51: the triage boundary; the "queued"-stance rider call (fold in or defer).
- 52: the boss-wall rider verdict; the BALANCE.md economy-metric family.
