# WORKLOG — Cluster 3: Economy (Phases 47→52)

The per-round narrative log (the first created under the 2026-07-06
planning-stack protocol; the revival of the archive/phase-a-e-worklog.md
pattern). **Write-mostly**: sessions orient from the HANDOFF 🧭 Cursor +
[ROADMAP.md](ROADMAP.md) and open this file to APPEND or to investigate.
What lands here: findings, decision rationale, rejected alternatives, scope
changes, playtest verdicts, phase-kickoff audits — the narrative the roadmap
must NOT accrete (one line + a pointer there; the story here). Sectioned
`## Phase N`; archived with its roadmap as a pair at round close
(`archive/post-46-roadmap.md` + `-worklog.md`).

## Kickoff (2026-07-07)

**The spec round.** The user's draft spec (gold / consumables / inventory /
reward tables / shops) went through a blind-spot pass audited against code
reality before any design lock. The audit's five structural findings, each of
which reshaped the spec:

1. **The daemon effect system doesn't exist.** Daemons were `{redraw?,
   empower?}` chance-gates and nothing else — no trigger vocabulary, no
   generic ops; the `RunTriggerContextMap` seam had zero subscribers. The
   "gain 20% more gold" daemon and the daemon⇄consumable equivalence the
   spec assumed both require a net-new run-level effect model. This became
   the cluster keystone (ROADMAP §47). The user's five example daemons
   turned out to span the full (trigger domain × effect domain) matrix —
   they're preserved in the spec as the coverage target.
2. **Multi-daemon ownership was implied everywhere, specified nowhere** (a
   run holds exactly ONE daemon, rolled uniformly; no ownership set
   anywhere). The Phase-L close-out had explicitly deferred "multi-daemon
   economy" to this round. Resolved: uncapped, serialized by id, stacking
   via the modifier fold (no special-case rules needed).
3. **In-battle consumable use is a sim-architecture fork, not a UI detail.**
   The draft's "a tile" target implied live intervention in the running
   deterministic sim — the first player→sim input channel in the game.
   Resolved: out-of-battle + pre-turn contexts build now; mid-battle
   pause-to-cast DEFERRED with the `usableIn`/`TargetSpec` seam authored
   from day one (seam-now-fill-later).
4. **"Pay to remove a unit" collides with rosterIndex-keyed state** (hand /
   draw / discard / encounterEffects / deploymentCounts all key by index;
   removal is the first roster-shrinking feature ever). Resolved: the
   single `removeRosterUnit` chokepoint + co-located test; the stable-id
   refactor consciously rejected (no consumer needs persistent identity
   yet).
5. **"Persistent gold display" had no home** — no UI layer survives scene
   swaps, and top-right (the draft's instinct) is claimed twice (battle
   speed pane; map roster button). Resolved: a new Game-level page-lifetime
   overlay layer, top-left, driven by `run:bitsChanged`.

**Design locks** (all in [cluster-3-spec.md](cluster-3-spec.md), marked ✅):
the rule schema (`modifier | hook`); battle hooks compiled into the World as
data (NOT bus subscriptions — sim purity); battle-earned resources settling
via a serialized WorldSnapshot tally (the XP pattern); idols re-authored +
legacy gates deleted (one vocabulary); content-driven vocabulary scope;
currency unified INTO reward tables as an entry type (the user upgraded my
either/or into the cleaner model); battle → rewards → promotion → recruit;
no stacking; declinable rewards incl. bits; shrink-below-count forces an
immediate keep-choice (revised from my "block pickups while over-cap"
default at spec review); reward tables in their own registry with boot-time
referential integrity; ports with an elite-style scatter + ≥1/sector
guarantee; stock rolled on entry, serialized.

**Naming** (the fun one): **bits · packets · cache · ports**, locked under
the principle the conversation surfaced — *the tech double meaning must
degrade gracefully* (the lay reading stands alone; unix/networking is an
optional Easter egg — the daemon/sector/hop test). Honorable cuts with
reasons in the spec §Naming: tokens (crypto/NFT connotation — the user
enjoyed the LLM reading, but gamers won't), chips (HUD "chip" collision),
scripts (no lay reading), patches (heal-valence), buffer (cushion, not
storage), stack (contradicts no-stacking), creds (too informal), terminal
(whispers "the end"). Code identifiers adopt the names (nothing pre-exists
under the placeholders).

**Roadmap authored** from the spec + META brief, phases 47→52 (keystone →
rewards → packets/cache → ports → UI/UX review → balance+close),
shape-locked with the user 2026-07-07. The UI/UX cohesion review (§51) was
the user's one shape-lock insertion: the cluster is UI-heavy, and although
we design UI concurrently with features, an explicit cohesion checkpoint
before the closing balance pass earns its slot even if it closes as a
documented no-op (the §41/§46b precedent). The plan-shape guard
(docs.test.ts) lands with the roadmap, per the note the process-audit round
left there. Riders carried in: the boss-wall
balance watch (59% vs 43–55% — §51 owns the verdict; run economy is the
named lever) and the renderer "queued"-stance polish (TODO.md, unclaimed).

## Phase 47 — The rule vocabulary

### Kickoff audit (2026-07-07)

Four parallel surface surveys (daemon system / World seams / Run
serialization+RNG / tests+fuzz+docs); pre-flight green (1804 tests +
typecheck clean) at `ae725c9`.

**Spec assumptions that check out against code reality:**

- **Crit exists end-to-end** (luck-based `critChance`, `STATS.critMult`;
  the `crit` flag already rides `unit:attacked` and the `dealHit`/`takeHit`
  trigger payloads) — the "any crit" example daemon needs zero new sim
  signal.
- **The World already has the runtime hook seam**: the `TriggerDispatcher`
  ([triggers.ts](src/sim/triggers.ts) — `spawn/dealHit/takeHit/dealMiss/
  evade/kill/death`) fires at the `applyDamage` chokepoint; handlers are
  deliberately unsnapshotted, owners re-register on rehydrate (the behavior-
  registry pattern). So `battleRules[]` = serialized DATA on the World +
  the World self-registering its own handlers from that data (fresh AND
  `fromJSON` paths). It straddles two precedents: the trigger seam
  (runtime evaluation) + the `encounterEffects` handoff (Run →
  `currentEncounter` → World).
- **The XP settle is the exact tally template**: World-side Maps
  (`damageDealt`/`playerRosterIds`/`utilityDone`) serialized as pair-arrays,
  computed into the `battle:ended` payload at `emitBattleEnded`, folded by
  `Run.bankXpAwards`. `tallies` follows it verbatim.
- **`foldEffects` ([statusEffects.ts](src/sim/statusEffects.ts)) is the only
  fold precedent** and is clean to mirror at run level (adds-then-muls,
  identity-on-empty, round + clamp). No run-level derived-stat machinery
  exists today.
- **The dormant `RunTriggerContextMap` really does fire** `encounterStart`/
  `turnStart`/`deploy` in production with zero subscribers — the run-domain
  hook engine can consume the existing dispatcher rather than invent one.
- **Daemons are already JSON+zod** (`config/daemons.json` +
  [daemons.ts](src/config/daemons.ts)) — no TS→JSON migration needed.

**Surprises / tensions the surveys turned up:**

1. **Serialization tension (decision point):** the spec locks
   daemons-by-id, but today's snapshot stores the FULL `DaemonConfig`
   object, with a deliberate rationale comment (survives catalog edits;
   bespoke non-catalog daemons round-trip) and a test pinning bespoke
   round-trip (Run.test.ts ~1515). That rationale predates multi-daemon.
2. **Gate draw ORDER is pinned**: `resolveTurnGates` evaluates redraw-then-
   empower off `daemonRng` in fixed order; the new rule engine must
   evaluate rules in deterministic def order so the fuzz `--daemon` arm
   stays byte-equivalent (the behavior-equivalence oracle).
3. **`turnGates` is itself a serialized RunSnapshot field** — its
   replacement (the current turn's resolved grants) must serialize too, so
   a mid-turn save reproduces the same grants.
4. **Two World construction sites** (BattleScene + the fuzz harness's
   `battle:started` closure) — `battleRules` must flow through
   `currentEncounter` so both get it for free.
5. Minor: stale doc-comment `daemons.ts:22` (Minerva "+4 DEF" vs the JSON's
   +2) — fix rides the idol re-authoring commit.

**Determinism / re-baseline map:** run-level fork order
(`sectorRng→teamRng→levelupRng→deckRng→daemonRng`) is append-at-end; §47
needs NO new run-level stream (hook chances stay on `daemonRng`; battle-
hook rolls on `world.combatRng`; bits ROLLS are §48's reward-sampling
stream). Determinism tests compare live-vs-live (no goldens); snapshot
round-trip tests use relative `version-1` staleness (bumps ADD cases, no
edits). Docs-guard caps to respect: ROADMAP ≤450 lines / ≤60 per phase
section.

**Pre-steps:** none warranted — the cluster kickoff's blind-spot audit
already surfaced the load-bearing gap (the missing effect system IS this
phase), and the surveys confirmed the seams the spec leans on all exist.

### Shape-lock (2026-07-07)

The 7-commit cut (47a–g, now in ROADMAP §47) approved as proposed — the
user explicitly kept the 47e/47f split (pause-between-commits at each
seam). Decisions locked:

- **Daemons serialize by id** — the spec lock wins over the current
  full-object rationale, which predates multi-daemon and priced only ONE
  daemon per snapshot. Bespoke daemons remain constructible in-memory via
  `RunConfig.daemon`, they just don't survive save/reload; the
  Run.test.ts bespoke round-trip pin retires in 47d. Unknown id on load =
  reject (no silent drops).
- **PreTurnScreen multi-daemon = stacked banner lines** — the current
  `◈ name — description` banner generalized to one line per owned daemon;
  degrades to exactly today's look with one. §51's cohesion review owns
  any richer treatment.
- **No bits-overlay pull-forward** — §47 verification is headless (tests +
  event payloads); the overlay lands in §48 with the reward screen, where
  bits are first player-facing.
- **Launch vocabulary (content-driven per spec):** triggers `turnStart /
  encounterStart / encounterEnd` (run) + `dealHit / kill` (battle); ops
  `grantRedraws / grantEmpowers / gainBits / healPool / applyStatus`;
  run-stats `bitsGain / cacheSize`; filters `archetype / crit / won`.
  `grantPacket` (named in the spec) waits for §49's `PacketDef` — an op
  with no operand type isn't content-driven yet.

Process note: AskUserQuestion dialogs hide same-turn assistant text in the
desktop app — shape-lock proposals must be presented as a plain final
message, then approved in the next turn.

### 47d — the multi-empower decision + build (2026-07-07)

**The flagged 47c decision (what happens when a run owns Mars AND Minerva)
resolved as option B — per-idol empower controls.** The user's reasoning:
the combined-blessing model (A) stacks BOTH the number of empowers and the
effects per empower — "really OP, really fast"; adding just the effects
would cap each daemon at one empower. So: `turnGrants.empower` became the
per-source `empowers: EmpowerGrant[]` ({daemonId, empowersPerTurn, buff}
per granted hook), `empowerUnit` gained `grantIndex`, per-source
`empowersUsedThisTurn: number[]`, and the PreTurnScreen renders one
"Empower ▲ (idol name)" control per granting idol (name shown only when
several granted — a single-idol run keeps the exact pre-47d look). Redraw
stays ONE summed budget (redraws have no identity). Empower denial is now
per idol ("Mars is silent…"); redraw denial = every redraw idol cold.

Oracle: the six single-daemon fuzz arms re-diffed **byte-IDENTICAL**
against the 47c baselines (the empower bot drains grant 0 first — same
policy draws as the old single-budget loop). Browser-verified in the
preview at :5191 (mars+minerva injected via `addDaemon` pre-node): two
stacked banners, two named controls, mars's `empowered` and minerva's
`warded` each landing from THEIR control, spent controls retiring
independently; single-idol look unchanged. §51 nit filed here: the ▲
badge title joins ALL granting idols' buff summaries rather than the
per-card one (the badge itself sums stacks correctly).

The K3/K4 save-round-trip tests moved to CATALOG daemons (janus/mars) —
the bespoke `K_DEFAULT_DAEMON` still drives every in-memory test but by-id
serialization hard-rejects its id on load, which is itself now pinned by
a dedicated test (the "no silent drops" lock).

### 47c — the oracle run (2026-07-07)

The behavior-equivalence oracle was run as a live before/after diff, not
just the in-tree suites: six fuzz arms (`--daemon=mars/minerva/mercury/
janus/random/none`, `--count=6` each) captured to scratchpad at `a39a991`
(pre-47c), re-run after the surgery, `summary.csv` diffed per arm — **all
six byte-IDENTICAL**. The draw-count parity that makes this work: a
chance-less hook costs no draw (legacy `chance: 1` ≡ absent), Mercury's
one coin per turn maps 1:1 onto its one chance-hook, and hooks evaluate
in authored rule order (a both-grants daemon authors redraw first — the
L1 redraw-then-empower contract generalized). Engine notes: non-grant
`turnStart` ops (`gainBits`/`healPool`) are deliberately NOT resolved in
the grant fold — they execute at the trigger fire site once their targets
exist (47e); grant hooks ACCUMULATE (budgets sum), the fold 47d's
multi-daemon leans on, with the multi-BUFF presentation explicitly a 47d
decision (last grant's buff wins until then).

### 47e — the bits substrate (2026-07-08)

The first fresh-session resumption under the planning stack (reorientation
verdict → retro/scratchpad.md). Two calls surfaced pre-build, resolved in
one turn:

- **Moneta ships IN the catalog (user: "totally fine for now").** The
  consequences accepted with it: the run-start roll pool grows to five, so
  ~1 in 5 fresh runs starts with a pure-passive daemon granting NO pre-turn
  tools (strictly the daemon-less experience +20% bits — invisible until
  §48's overlay); and the `--daemon=random` fuzz arm re-baselines (pick
  over 5). §48's reward tables diversify acquisition within this cluster,
  which is what made "accept the variance now" cheap. The name: **Idol of
  Moneta** — the Juno Moneta mint-temple epithet ("money" descends from
  it); lay reading "money idol" stands alone per the naming principle.
- **`healPool` rides the same instant-op executor** (default I proposed,
  user co-signed): its target (`playerHealth`) has existed since H4, and a
  parse-legal authored hook silently no-op'ing is a trap. Example daemon #4
  stays unauthored — only the machinery covers it.

Build shape: `run.bits` mutated only through the private `addBits`
chokepoint (floor-at-zero + `run:bitsChanged {bits, delta}`, emit only on
real change); `gainBits(base)` applies the `bitsGain` fold derived AT CALL
TIME from owned daemons' modifier rules (derive-don't-cache; the
`effectiveRunStats()` seam §49's `cacheSize` will reuse). Instant-op
execution landed at all three run-trigger fire sites: `turnStart` rides
`resolveTurnGrants`' one walk (the 47c parity landing pad — its coins
already flipped there; **gotcha #115** pins the never-double-draw rule),
`encounterStart`/`encounterEnd` via the new `resolveInstantHooks` in
`beginEncounter`/`finishEncounter`, with `encounterEnd` carrying the `won`
filter context. **Filter gates BEFORE chance** (a `won: true` hook on a
loss costs no draw) — chosen to match how 47f's battle-side filters will
behave at the sim chokepoints; documented at the function + gotcha #115.
`RunConfig.startingBits` + `bits=` URL/CLI form (the run-config CLI help
also gained the missing `--daemon` line, pre-existing drift). Run
v26→v27 (adds `bits`; fromJSON re-clamps the floor).

Session note: the pre-47e fuzz-arm baseline capture was first launched in
the BACKGROUND and then raced my own edits (the CLI compiles the live
tree — arms 3–6 crashed mid-capture on the half-edited engine). Recaptured
from a detached git worktree pinned at HEAD with a node_modules junction —
the zero-risk shape for before/after oracles from a dirty tree; worth
keeping as the standard pattern.

Oracle verdict (6 arms × `--count=6`, worktree-pre vs post `summary.csv`
diff): **mars / minerva / mercury / janus / none byte-IDENTICAL; random
DIFFERS exactly as predicted** — same seeds, same strategies, only the
run-start roll lands differently over the 5-entry catalog (moneta appears
from seed 2). The random arm re-baseline is the accepted catalog-growth
cost, not an engine regression — the five forced arms prove the engine
surgery (instant-op execution, the resolveTurnGrants return change, the
encounterEnd fire site) changed nothing for existing content.

### 47f — the battle-domain seam (2026-07-08)

Step-zero premise check turned up two side effects the cut hadn't
predicted, both surfaced pre-build and accepted:

- **Run v27→v28 rides along with World v32→v33.** `battleRules` belong on
  `BattleEncounter` (the complete battle-spec handoff both World
  construction sites already read) — and `currentEncounter` is serialized
  in the Run save, so its shape change bumps the Run schema too. The field
  is optional on the interface (nine integration fixtures hand-build
  encounters), but `beginTurn` always sets it and reject-stale applies.
- **The `statMods` authoring axis landed** — statusSchema.ts had deferred
  it since 27 "until its first consumer," and Fortuna's crit-buff is that
  consumer. Config-only as the deferral note predicted (defs never
  serialize; the runtime `StatusEffect.mods` existed since K1). New status:
  `emboldened` (+1 STR/RNG/MAG, 5s, refresh — a re-crit refreshes, never
  stacks). A side effect of the side effect: 47b's "assertDaemonStatusRefs
  passes vacuously" test stopped being vacuous — rewritten to pin fortuna's
  ref both resolving (real registry) and failing loudly (stripped one).

Design locks (user, this session): **battle rules evaluate for PLAYER-team
acting units only** — a daemon is the player's relic; enemy-scoped daemons
are a noted future idea, not launch vocabulary. **`applyStatus` lands on
the ACTING unit** (Fortuna's "embolden the striker"). Filter gates BEFORE
chance (the 47e discipline carried across the seam); chance rides
`world.combatRng` (launch content is chance-less — no new draws). Names
locked: **Idol of Laverna** (goddess of thieves — rogue blows earn bits)
and **Idol of Fortuna** (crit IS luck-derived). Catalog → 7; the 3-in-7
no-pre-turn-tools start-roll odds explicitly accepted ("keep clobbering
the starting pool — that's the Cluster 4 overhaul's problem").

Build shape: `src/sim/battleRules.ts` owns the plain `BattleRule` data
type + trigger-handler registration (the K1 behavior-registry pattern —
data serialized, handlers re-attached on `fromJSON` via the same
`installBattleRules`, which also validates `applyStatus` refs at INSTALL
time so a bad id can never throw mid-tick, and throws on a second call —
rules are per-battle constants). `battleRulesFor` (run/daemon.ts) compiles
ownership-order × authored-order; recompiled fresh each turn so a §48
mid-encounter daemon acquisition fights from the NEXT turn (the
grant-resolution rule). `tallies {bits}` follows the XP-ledger pattern
verbatim: serialized accumulator → copied into the `battle:ended` payload
(optional, the `survivorPower` test-fake rationale) → settled by
`Run.gainBits` so the `bitsGain` fold applies at the settle (Laverna
stacks with Moneta, zero coupling) — and the settle mirrors the XP bank's
skip-on-lost (a defeat's loot is dead state).

Oracle verdict (6 arms × `--count=6`, worktree-pre at `143cce4` vs post):
**mars / minerva / mercury / janus / none byte-IDENTICAL; random DIFFERS
only in the roll landing over the 7-entry catalog** (fortuna/laverna
appear from seed 2/6). The five forced arms prove the whole battle-domain
surgery — the World constructor-adjacent install, the trigger handlers,
the tally plumbing, the `battle:ended` payload growth — changed nothing
for existing content (a non-battle-hook daemon installs zero rules, and
an empty install is a structural no-op).

### 47g — the exit sweep + phase close (2026-07-08)

**Full fuzz pass:** 20 seeds × 2 strategies = 40 runs, **0 hangs**, win
rates in the usual band (pure-random 35% / greedy 10%). The natural
daemon roll exercised ALL SEVEN idols — the three economy idols drove
real runs end-to-end (fortuna 4 runs, laverna 4, moneta 6; fortuna's 50%
and laverna's 0% are 4-run noise — §52's economy balance pass owns the
real read).

**Exit criteria — all four MET:**

1. *Idols behavior-equivalent under the new schema* ✅ — the 47c AND 47d
   live oracles (byte-identical ×6 arms each), plus the forced arms
   holding through 47e/f.
2. *Five example daemons authorable, ≥3 authored + tested, one per matrix
   quadrant* ✅ — laverna (battle→run tally) / fortuna (battle→battle
   status) / moneta (passive modifier) shipped + design-pinned; #4
   (encounterEnd won → healPool) and #5 (+cacheSize) pinned authorable by
   the new §47-exit-receipt schema test (daemons.test.ts).
3. *Multi-daemon ownership round-trips by id* ✅ — 47d (unknown-id
   hard-reject pinned; bespoke = in-memory only).
4. *`TurnGates` + legacy gate fields GONE* ✅ — 47c deletion; the 47g
   sweep found only two stale doc-comments still saying `Run.turnGates`
   (deck.ts / empower.ts headers — fixed) and one stale command-catalog
   row (`empowerUnit` missing 47d's `grantIndex` — fixed).

**Scope guards held:** no packet delivery mechanics, no reward tables, no
vocabulary beyond the launch lists (the one addition — `statMods` — was a
27-era deferral coming due, not new vocabulary), no mid-battle player
input. Snapshot trail across the phase: Run v24→v28, World v32→v33.

**Phase 47 CLOSED.** The keystone stands: one rule vocabulary
(`modifier | hook`), both seam crossings live (battleRules in;
tallies out), all consumers downstream (§48 rewards → §49 packets →
§50 ports) author against it.

## Phase 48 — Rewards

### Kickoff audit (2026-07-08)

Four parallel surface surveys (the `rewards?` seam + config/editor
patterns / the post-battle scene chain / the Game-level overlay gap /
Run RNG + serialization + fuzz); pre-flight green (1880 tests + typecheck
clean) at `355bb91`.

**Spec assumptions that check out against code reality:**

- **The `rewards?` seam exists and is a clean placeholder** —
  `z.unknown().optional()` (encounters.ts:180/191), nothing on disk
  carries it, so tightening to the real `{table, trigger}[]` schema has
  zero migration. `formatEncountersJson` even reserves the key slot in
  its canonical order already (emits an opaque blob — needs a real block
  emitter once structured).
- **The pending-offer precedent is exact**: `currentOffer` (rolled in
  `advancePastBattle`, serialized, consumed by `chooseRecruit` /
  declined by `passRecruit`) is the verbatim template for the pending
  reward offer; `pendingPromotions` is the parallel case. `PromotionScene`
  (29 lines, DOM-only, payload via constructor) is the scene template;
  `PreTurnScene` the template if the screen needs live bus subscriptions.
- **The engine anticipated §48 by name**: `addDaemon` (Run.ts:1499) is
  documented as "the §48 reward / §50 port acquisition seam" with
  duplicates the CALLER's concern (exclusion upstream); `gainBits`'s doc
  names "§48 reward settles" as an intended earn surface (the `bitsGain`
  fold applies uniformly); `beginTurn` recompiles `battleRulesFor` fresh
  each turn so a mid-encounter reward daemon fights from the NEXT turn.
- **Boot-assert + config-module patterns ready**: the daemons.ts
  module-load self-assert is the referential-integrity flavor to copy;
  the natural home for "encounter references a real table" is the
  existing encounters.ts post-parse loop (:201–216, already does the
  layout referential check). Watch the import direction: rewards.ts must
  not import encounters.ts back (the daemons.ts cycle-avoidance note).
- **`pickWeighted` (sectorWalk.ts:42) is the reuse** for table sampling —
  already the production precedent in selection.ts. Gotcha #111 applies:
  zero draws on a singleton, so owned-daemon exclusion makes the sample's
  draw count filter-dependent — exactly why the dedicated reward streams
  exist. One trap: `pickWeighted` on an EMPTY array still burns a draw
  and falls through — the empty-after-filter case ("yields nothing this
  trigger") must short-circuit BEFORE the call.
- **Fuzz/determinism re-baseline is CSV-regeneration only**: determinism
  tests are all relative (same-seed-twice), fork-order guards only pin
  nodeMap/team (forked before the append point). Adding streams after
  `daemonRng` (Run.ts:671, the append-at-end doctrine) shifts every
  per-encounter fork → regenerate the committed fuzz artifacts, no test
  goes red. The harness's `satisfies never` phase switch (harness.ts:570)
  force-compiles `case 'reward'` — a built-in checklist for every
  exhaustive site.

**Surprises / tensions the surveys turned up:**

1. **The phase-ordering tension (THE structural call):** the spec locks
   battle → rewards → promotion → recruit, but promotion interposes at
   the TURN GATE (handleTurnEnded:1253 headless / handleAdvanceTurn:1332
   gated) — BEFORE `continueAfterTurn` → `finishEncounter('win')`, where
   a naive reward hook would land. Honoring the spec means splicing the
   reward phase at the turn-gate win path, ahead of the promotion
   interpose; `turnResult()` is documented pure/re-readable exactly so
   gates can do this, and `selectedEncounter` (which carries `rewards`)
   is still set there. Resolved at shape-lock — see below.
2. **No live save/load exists.** `Run.fromJSON` is test-only; nothing
   maps a restored `run.phase` to a scene. The "mid-reward save/reload
   reproduces the pending offer" exit criterion can only be the
   serialization round-trip CONTRACT (the `currentOffer` test pattern),
   unless the user means net-new live persistence. Resolved at
   shape-lock — see below.
3. **Top-left is NOT free in battle.** `.hud-hop` (the hop/turn chip)
   sits at exactly top:20px/left:20px (its CSS comment: "mirrors the
   top-right speed pane"); free on map/pre-turn/all other screens. The
   overlay needs a collision call: relocate the chip vs stack.
4. **Two overlay wiring subtleties**: the starting balance never emits
   `run:bitsChanged` (init bypasses `addBits` — first paint must read
   `run.bits` directly), and the FIRST run's `run:started` fires from the
   Game field initializer BEFORE constructor subscriptions exist (works
   as a reset-re-show signal only). `Run` is never null — visibility
   keys off `run.phase` / `run:victory` / `run:defeated`.
5. **`bitsMultiplier` can't ride `WaveContext`** like its X1 siblings —
   bits earn at the `gainBits` chokepoint, which already carries the
   daemon `bitsGain` fold. Where the difficulty lever applies (and how it
   stacks with the fold) is a shape-lock decision.
6. **No "owned daemon ids" accessor exists** — the only expression is
   the inline `map(d => d.id)` in `toJSON`. The exclusion filter (and
   §50's stock filter after it) wants a shared accessor; rides the
   engine commit, no pre-step.
7. Minor: `economy.ts` shipped 47e without a schema test — rewards.ts
   follows the tested daemons/encounters pattern instead. `rewards.json`
   is the first economy-cluster file to join the `/__save-config`
   allowlist (vite.config.ts:22–28).

**Determinism / re-baseline map:** run-level fork order confirmed
(`sectorRng→teamRng→levelupRng→deckRng→daemonRng`, append-at-end); §48
appends the reward streams after `daemonRng` → all later per-encounter
forks shift → fuzz CSV re-baseline (budgeted in ROADMAP conventions).
RunSnapshot v28→v29 (reward phase + pending offer + streams), reject-
stale, changelog entry in the Run.ts doc comment; round-trip additions
ride the generic `schemaVersion - 1` staleness pattern.

**Pre-steps:** none warranted — every seam the spec leans on exists
(several with §48 already named in their doc comments); the two
structural tensions (#1, #2) are decision points, not missing
infrastructure.

### Shape-lock (2026-07-08)

The 7-commit cut (48a–g, now in ROADMAP §48) approved as proposed.
Decisions locked:

- **Reward phase splices at the TURN GATE, ahead of the promotion
  interpose** — honoring the spec's battle → rewards → promotion →
  recruit rather than the naive `finishEncounter` hook (which would have
  produced promotion → rewards). `turnResult()` is pure/re-readable at
  the gate and `selectedEncounter` still carries `rewards` there.
  Mid-encounter turns keep the M1 promotion cadence untouched; empty
  roll skips through (the `promotions.length > 0` shape); uniform on
  terminal wins (boss rewards fire before `run:victory`, no special
  case). The user's extra endorsement: this leaves a **between-turn
  rewards seam** for the future — not planned, but "that's how
  promotions ultimately evolved."
- **"Mid-reward save/reload" = the serialization round-trip contract**
  (the `currentOffer` test pattern) — no live save/load exists anywhere.
  The user is now mulling a post-cluster interstitial round to build
  real saving/loading (noted in TODO.md as a cluster-boundary watch
  item).
- **Inventory-full confirmed moot** — schema-complete packet entries,
  zero `PacketDef`s, launch tables author none; no cache-full flow
  until §49.
- **Bits overlay OWNS top-left in all cases** (user call, emphatic);
  the battle hop/turn chip moves to the bits chip's RIGHT (the hop chip
  is likely the wider of the two) — placement refined at §51 if needed.
- **`bitsMultiplier` = Option B, inside `gainBits`**, multiplicative
  with the daemon `bitsGain` fold — the difficulty lever scales TOTAL
  income uniformly (reward rolls, Laverna tallies, daemon hooks), which
  is what §52's boss-wall tuning needs from it; Option A (at the reward
  roll only) would let daemon-driven income escape the knob and make
  the dial read mushy at tuning time. **Rider (the user caught the
  display hazard): the screen must never show the un-folded base** —
  "screen said 10, total went up 18" reads as a bug. So the pending
  offer serializes the rolled BASE and the display derives the
  effective amount via ONE shared helper that `gainBits` itself calls
  (display and settle are the same code path, drift-impossible). The
  acceptance-order edge falls out correctly: accept Moneta from a
  mixed offer and the remaining bits portion visibly re-derives +20% —
  derive-don't-cache doing player-facing work. Freeze-at-roll would get
  that edge WRONG. §50 landmine pinned while we're here: port SELL
  proceeds are a refund, not income — they take the raw `addBits` path,
  never `gainBits`, or Moneta + sellFraction can exceed 1.0 and mint an
  infinite-money loop.
- **Two dedicated streams** (table/trigger sampling + bits rolls),
  appended after `daemonRng` per the convention; fuzz CSV re-baseline
  accepted.
- **Launch catalog approved as a first pass**: 4 tables — `bits-small`
  (normals, chance 1) / `bits-large` (elites+bosses) / `daemon-cache`
  (elite, chanced; bits floor entry per the spec's authoring
  convention) / `boss-hoard` (bits + daemon at weight). All 13
  encounters reference something; numbers deliberately rough (§52 owns
  tuning).

### 48b — the reward engine build (2026-07-08)

Two build-time notes beyond the shape-lock:

- **A reward daemon fires for the fight it dropped from** (the
  encounterEnd edge): acceptance happens BEFORE `finishEncounter`
  (dismiss-chain ordering), so an accepted daemon's `encounterEnd` hooks
  are included when they fire moments later. Accepted as designed —
  unreachable via the launch catalog (no encounterEnd idol ships), and
  "the loot works immediately" is the friendlier reading of the
  next-turn grant rule. Pinned in the `handleAcceptReward` doc comment.
- **The 48b Game bridge** (temporary): `reward:offered` → auto-accept
  all portions, so the live game flows through the new phase with no
  screen until 48c. Invisible in play — the skeleton catalog is
  bits-only and nothing displays bits until 48d.
- Test fallout was contained: three existing tests + two drive helpers
  assumed win→recruit directly and now pass through `acceptAllRewards`
  (the harness accept-all policy as a test helper). Determinism/
  snapshot-roundtrip suites absorbed the two new streams untouched
  (relative comparisons, as the kickoff audit mapped); the committed
  fuzz CSVs are stale until 48g's re-baseline.

### 48c — the RewardScreen build + the dispatch hole (2026-07-08)

**The browser-verify caught a real bug the whole headless surface
couldn't**: `Game.dispatch` re-enumerates `RunCommand` by hand with no
default — `acceptReward`/`declineReward` fell through and were silently
DROPPED. Every headless path (tests, harness) calls `run.dispatch`
directly, so 1915 green tests never touched the hole; it also means
48b's temporary auto-accept bridge was dead code (it dispatched into
the void — a live brigands win under pure 48b would have soft-locked
in the reward phase; the 48b playtest evidently never won one). Fixed
by routing the two commands AND adding a `command satisfies never`
default to the switch — the next unrouted command is now a compile
error, not a silent drop (the harness's phase-switch discipline,
applied to Game).

Build notes: RewardScreen renders from the LIVE `run.pendingRewards`
(full re-render per resolution keeps button indices true; bits rows
through `run.effectiveBits` — never the base); `pickup` coin-blip
authored as a gen-sfx recipe (deterministic, B5→E6 square chime).
Browser-verified at :5191 end to end: accept settles (base 10 →
granted 12 with Moneta, display == settle to the digit), decline
leaves bits untouched, and **the Moneta-order rider works visually**
— accepting her from a mixed offer re-priced the remaining bits row
10→12 on the spot. Zero console errors; scene chain reward → recruit
confirmed both paths.

### 48d — the bits overlay build (2026-07-08)

The first page-lifetime UI element ([BitsOverlay.ts](src/ui/BitsOverlay.ts)
— Game-owned, appended once to #ui, untouched by scene swaps). The
browser-verify caught its second ordering trap, the mirror of the
audit's first: **`run:started` can't drive the reset re-paint either** —
it emits from inside the NEW Run's constructor, before `Game.run` is
reassigned, so the getter closure read the DEAD run's balance (the chip
kept showing the lost run's total after a reset). Fix: `run:started`
only re-shows; `Game.resetRun` calls `refresh()` AFTER the
reassignment. Both traps pinned in the class header.

Verified at :5191 across the whole lifecycle: earn (0→13 with pulse,
chip in sync with `run.bits` on map / battle / reward / recruit
screens), hide at defeat, re-show at 0 on reset. Corner geometry: the
hop chip's new `left: 148px` clears a 4-digit balance; measured the
narrow-viewport limit — hop overlaps the top-right speed pane only
below ~580px viewport width (the 529px preview tab; any real desktop
width has ample clearance). §51 note if small-window play ever
matters. z-index 15: above screens, below corner buttons (20) /
modals (30) / scanlines (1000).

**48c + 48d user-playtested natively 2026-07-08** — the reward screen,
the coin blip, and the overlay pulse all confirmed ("playtest pulsed
properly"). Session handed off with 48e next.

### 48e — the dev-tooling build (2026-07-08)

**Scope rider (user-approved at step start): the encounter editor gained
a Rewards PANEL** (a table dropdown over `REWARD_TABLE_IDS` + a chance
input + remove, the sector-editor pool-row shape) beyond the card's
emitter-only scope. The step-zero audit showed the encounter editor had
NO rewards UI at all — the key survived load→save only via the 48a
blob-stringify — which would have left `rewards` the one config field
the editor suite could preserve but not author, and made 48f's "author
the catalog with the editor in hand" a hand-edit job for the 13 refs.

Build notes:

- **The reward-table editor** ([tools/reward-editor/](tools/reward-editor/))
  follows the sector-editor template: weighted entry rows (kind-convert
  select; bits min/max, free-text packet id — dormant per §49 — and a
  daemon dropdown over the live catalog so a typo'd id can't be
  authored), live `RewardTablesSchema` validation, a draw-% preview
  (`weight/total`, the `pickWeighted` math) with an avg-BASE-bits line,
  a **Referenced by** pane over the committed encounters, and
  `formatRewardsJson` byte-pinned to the committed file. Validation runs
  BOTH referential boot asserts live — `assertRewardDaemonRefs` and the
  reverse of `assertEncounterRewardRefs` (renaming/deleting a table a
  committed encounter references trips an error + disables Save). The
  Save path carries the encounter editor's sessionStorage stash from day
  one: rewards.json → rewards.ts → editor.ts has no HMR boundary, so a
  save full-reloads the page (the trap Wb2 fixed reactively on the
  encounter editor, avoided proactively here).
- **The emitter**: `formatEncountersJson` now emits `rewards` as a real
  block — the list expands, each ref leaf-inline
  (`{ "table": …, "trigger": { "chance": … } }`), matching the
  stage-`until` convention; the committed encounters.json reformatted
  from the 48a blob in the same commit (the byte-faithful test pins the
  two together). The grammar-demo test fixture extended with a multi-ref
  `rewards` key.
- **Browser-verified at :5191** (per the ui/render eyeball policy):
  reward-editor boot state (export == committed file to the byte, draw
  math 11.5 = (8+15)/2, Brigands in referenced-by), kind-convert with
  50/50 renormalize, the rename guard tripping + disabling Save, revert,
  and a **no-op Save round-trip** — endpoint 200 through the new
  allowlist entry, stash-restored tab + confirmation across the Vite
  reload, and ZERO diff on config/rewards.json afterward (byte-fidelity
  proven on disk, not just in vitest). Encounter-editor panel: Brigands'
  committed ref renders, add/edit/remove flow into the block emit,
  removing the last ref omits the key (the `description`/`layouts`
  optional-key discipline), tools-index card present. Zero console
  errors on any page.

**48e user-playtested natively 2026-07-09** — "seems to be working
great"; as their test the user authored bits-small refs onto highwaymen
+ deserters IN the new panel and confirmed the save landed (those two
refs fold into 48f's catalog).

### 48f — `bitsMultiplier` + the launch catalog (2026-07-09)

- **The lever**: `bitsMultiplier` joined `DifficultyMultipliers` /
  `resolveDifficultyMultipliers` as a third axis of the X1 seam (one
  resolution seam, one stored field — NOT a second resolver; unlike its
  siblings it never rides `WaveContext`), a `RunConfig.bitsMultiplier`
  passthrough, and the `effectiveBits` product per the shape-lock
  (Option B — multiplicative with the `bitsGain` fold, one rounding at
  the settle; display==settle carries the lever for free since the
  screen derives through the same helper). Default 1 pinned as the
  no-op contract alongside the X1 pair.
- **The catalog** (numbers deliberately rough — §52 owns tuning, and
  the 48e editor makes retuning cheap): `bits-small` 8–15 (48a) ·
  `bits-large` 20–35 · `daemon-cache` = all 7 idols w1 + a 12–20 bits
  floor (the spec's authoring convention: daemon tables carry a floor
  so full-ownership stays non-empty) · `boss-hoard` = all 7 idols w1 +
  a 25–40 floor at w2. Refs: 8 normals → bits-small@1 (three were the
  user's own panel-authored saves); 3 elites → bits-large@1 +
  daemon-cache@0.35; 2 bosses → bits-large@1 + boss-hoard@1.
- **The test fallout was the real work**: with every encounter now
  rewarding, ~27 win-path sites across Run.test.ts + the determinism /
  encounter-loop integration suites assumed win → recruit/promotion
  directly and now pause in `'reward'`. Swept with `acceptAllRewards`
  (the 48b helper), a new `declineAllRewards` twin for the two
  exact-balance bounty tests (accepting would pollute the asserted
  amount — the hook fires at `finishEncounter`, AFTER reward
  resolution), and one structural rewrite: the "rewards-less encounter
  skips the phase" regression now SYNTHESIZES its shape by swapping
  `run.selectedEncounter` for a rewards-stripped clone — the catalog
  can no longer supply a rewards-less fight, the field is
  plain-mutable, and the shared catalog object is never touched.
- **The pre-commit hook caught a semantic collision the main suite
  couldn't**: the fuzz L1c3 daemon-ARM key (`RunResult.daemonId`) read
  END-state `run.daemons[0]` — and under the accept-all reward policy a
  `daemon: none` CONTROL run now finishes owning loot (seed 1 ended the
  control arm holding Minerva out of a daemon-cache drop). Fixed by
  capturing the STARTING daemon at construction and threading it
  through `finalize`/`aborted` — the per-daemon win/hop bucketing keeps
  meaning "which arm ran," and loot acquisitions can't reclassify runs
  between buckets mid-sweep.

**48f user-playtested natively 2026-07-09 — a FULL RUN cleared** ("full
run complete... everything else worked perfectly"). The daemon-cache
35% natural trigger didn't fire in that run (a coin flip, not a bug —
the daemon-accept path is browser-verified at 48c via the Moneta
re-price rider and headless-pinned); everything else confirmed in play.
User vote: close the phase.

### 48g — the exit sweep (2026-07-09)

**Exit criteria, checked:** ① win → reward screen → accept/decline →
promotion → recruit: user-confirmed in the native browser across a full
run (48c–f playtests; the daemon-accept visual specifically at 48c).
② bits tick on the overlay in AND out of battle: 48d browser-verify +
the user's playtests. ③ mid-reward save/reload reproduces the pending
offer: the serialization round-trip CONTRACT tests (48b — per the
shape-lock, no live persistence exists; the watch item stays in
TODO.md). ④ fuzz drives the reward phase green: 212 fuzz:smoke at every
commit + the 48g full pass below.

**Docs sweep:** ARCHITECTURE — the tools/ tree caught up (it had
drifted to 3 editors; now all 7 pages incl. the 48e reward editor), the
Run.ts entry gained the 48b/f reward-phase paragraph, difficulty.ts /
RunConfig.ts lines gained `bitsMultiplier`. GOTCHAS — **#116** (the
`run:started` constructor-emission ordering pair from 48d, generalized
for §51's future page-lifetime elements). Scratchpad — the
universal-catalog test-sweep lesson + the hook's fuzz:smoke earning its
slot. TODO — the save/load cluster-boundary watch item was already
filed at kickoff; nothing new.

**The fuzz re-baseline (the §46b fixed-vector doctrine, 480 runs, 0
hangs): STABLE — the reward economy is outcome-neutral at launch
numbers.** The fixed-vector probe read dead flat (25.0/25.0 vs §46b's
25.0/24.2); anchors +~2pt, inside seed variance. The mechanism reading:
bits have no spend surface until §50, so the only outcome-coupled
reward is the elite-gated daemon drop — the economy's real lever
arrives with ports. Full entry + the per-encounter spot reads:
[BALANCE.md](BALANCE.md) §48g; the 48g batches supersede §46b as the
comparison baseline, and the boss-wall watch item stays filed for §52.

**Phase 48 CLOSED 2026-07-09.** Run v28→v29 (48b); World v33 holds. Six
build commits + this close; two browser-verify-only bugs (the
Game.dispatch silent-drop, the overlay reset-repaint), one hook-caught
fuzz semantic (the daemon-arm key), one scope rider (the encounter
editor's rewards panel, user-approved). Packet entries ship dormant as
designed — §49's pipe is primed.

## Phase 49 — Packets & cache

### Kickoff audit (2026-07-09)

Surface survey (the rule/op schema + `cacheSize` fold / the dormant
packet reward entries / the PreTurnScreen redraw-empower flow +
`TurnGrants` / the battleRules compile + `encounterEffects` store).
**Every 47/48 seam is where its docs promised — no pre-steps.** The
waiting seams, confirmed: the `EffectOp` pool with `grantPacket`
explicitly deferred here (daemons.ts header + worklog §47b);
`cacheSize` base 6 behind the `effectiveRunStats()` fold (47e);
`PacketRewardEntry` schema-complete with ids deliberately unvalidated
pending `assertRewardPacketRefs` (rewards.ts:23–25); `rollRewards`'s
wholesale packet exclusion (the guard 49c removes) + `RewardPortion`
awaiting a packet arm; `battleRulesFor` riding the serialized
`currentEncounter` (v28), so **encounter-duration injected rules get
persistence for free**; `addEncounterEffect` as the unit-target path.

Two audit findings that shaped the plan:

1. **Battle-wide packets must be rule-shaped.** The battle trigger
   vocabulary is `dealHit`/`kill` only — "your hits apply poison this
   encounter" injects cleanly; a literal "buff everyone right now" has
   no `battleStart` trigger to ride. Launch content stays rule-shaped;
   `battleStart` waits for content that demands it (the content-driven
   vocabulary rule).
2. **`encounterEffects` resets at encounter START** (K1), so an
   out-of-battle unit-target packet ("empower for the next encounter")
   needs a pending-until-start ordering decision — resolved at 49e
   build time, flagged here so it isn't a surprise.

### The fire-UX design round (2026-07-09) — the spec's ⚠ OPEN, resolved

The user's shape: grants prompt **one at a time, in acquisition
order** ("Idol of Mars: Empower" → pick a card → Janus: redraw 2 → …),
with a pass affordance. Refined together into **the guided fire
strip**: one chip per granted idol effect in ownership order (exactly
the `resolveTurnGrants` walk order), the first unresolved chip
auto-arms (glow + effect hint; the hand cards on screen are the click
targets; redraw chips arm multi-select with confirm-on-chip), **Pass**
advances the queue, Fight ▸ = implicit pass-all.

**Pass is FINAL by default, ENGINE-enforced, behind a config toggle**
— the user's call, three-legged rationale: (1) the roguelike angle —
acquisition order mattering is a real consideration, not a trap, when
it's a deliberate dial; (2) balance posture — the data trends toward
overstating difficulty and multi-daemon is already a major buff, so
launch restrictive and loosen if playtests say "not fun" (loosening
later reads as a buff; tightening later reads as a nerf); (3)
**headless↔rendered fidelity** — a UI-only rule can't be exercised by
the fuzz harness or proven by a test, and dev-console evasion is
trivial in a browser game. The agent's UI-level counter-proposal was
withdrawn on that doctrine + one hard fact: **the user announced
save/load ships as the next update, an interstitial between Clusters
3 and 4** — serialized pass state stops being optional the moment a
real mid-run save exists.

Fallout, all deliberate:

- **`TurnGrants` re-models into ONE ordered per-source grant list**
  (consumed/passed state serialized per entry; the active grant
  DERIVED as first-pending — derive-don't-cache). This **reverses the
  47d "redraw stays one summed budget" lock**: redraw un-sums into
  per-idol fires (Mercury and Janus each prompt their own), making
  every grant packet-shaped. User: "I fully agree."
- New `passGrant` run command; `empowerUnit`/`redrawCards` validation
  gains "must be the active grant" (finality-toggle-off relaxes to
  any-pending). Fuzz redraw/empower bots iterate the queue in order —
  naturally compliant under both modes; a pass-aware policy arm
  becomes POSSIBLE later precisely because the state is engine-level.
- **Packet fires consume immediately and irrevocably** — no batching,
  no undo; order of consumption IS order of effect. Packets never
  auto-arm and never pass (ignoring one costs nothing — it stays in
  the cache, unlike a grant, which expires at Fight). They fire
  **at-will at ANY moment during the gate**, including before/between
  idol chips — blessed as the economy working: the strict idol order
  creates the very flexibility packets then sell back (a redraw packet
  buys an early-acquired empower idol a look at the post-redraw hand).

### The other kickoff decisions (2026-07-09)

- **Cache home: a persistent `▤ n/6` chip beside the bits overlay**
  (the 48d page-lifetime layer grows a second element — gotcha #116
  applies). Opens the cache modal anywhere (view/discard always, fire
  where context allows); hosts the forced-keep shrink flow, which can
  trigger on any screen. Map-screen-only rejected: reward-time swap +
  shrink need cache views elsewhere regardless.
- **Launch catalog (7)**: hype (+STR/RNG/MAG, pre-turn/unit/encounter)
  · shield (+DEF, pre-turn/unit/encounter) · reroute (redraw 2,
  pre-turn/none/instant) · venom (hits apply poison, pre-turn/
  battle-wide/encounter — the injection proof) · patch (heal pool,
  out-of-battle/none/instant) · overclock (empower next encounter,
  out-of-battle/roster-unit — the exit-criteria context) · a 7th
  run-duration injected-rule packet (proves the `run` axis; costs one
  run-level injected-rules store folded into the battleRules compile).
- **`grantPacket` daemon op DEFERRED** until content demands it —
  reward tables already deliver packets; no launch idol needs the op.
- **Fuzz reward policy**: accept packet portions while the cache has
  room, else decline; NO fire-policy arm at launch.
- **Two snapshot bumps, honestly separate**: Run v29→v30 (49b cache)
  and v30→v31 (49d grant queue) — the 47 multi-bump pattern.

**The cut** (49a config → 49b cache core → 49c rewards activate →
49d grant queue → 49e fire engine → 49f fire UX → 49g catalog+editor
→ 49h exit sweep) is in ROADMAP §49. Ordering rationale:
headless-core-first throughout; 49c before the queue/fire steps so
packets ARRIVE before they fire (fuzz drives the earn-store loop green
while use doesn't exist yet); the UX step consumes the queue + engine
in one browser-verified build.

### 49a — the packet config layer (2026-07-09)

`config/packets.json` + `src/config/packets.ts` (the daemons.ts module
shape: parse at load, normalize exact-optional, boot asserts
self-wired, `packetById`). The shape calls, all schema-level and cheap
to rename before 49g authors content:

- **The op pool grows two packet ops**: `applyBuff` (the empower
  generalization — the shared `BuffSchema`, lands via the K1
  encounter-effect store) and `injectRule` (the battle-wide delivery —
  the inner rule IS the sim's `BattleRule` shape verbatim, since
  that's the compile target). `grantRedraws`/`healPool` reuse the
  daemon op schemas — their zod sub-schemas are now EXPORTED from
  daemons.ts rather than redefined (one pool, one definition; import
  direction packets → daemons).
- **The (op × target × context) matrix is EXPORTED data**
  (`PACKET_OP_TARGET` / `PACKET_OP_CONTEXTS`) — the parse-time
  superRefine, the 49e engine validation, and the 49g editor all read
  the same source. `midBattle` and `tile` are first-class vocabulary
  values NO op admits (parse-illegal everywhere — the seam ships, the
  feature doesn't), pinned by a matrix-derived test that self-updates
  if a future op legalizes them.
- **The duration axis restricts per op to engine truth**: `applyBuff`
  = `encounter` only (a `run` buff needs a store nothing ships);
  `injectRule` = `encounter | run`; instants carry none. The full
  4-value `EFFECT_DURATIONS` vocabulary ships as the spec's axis.
- `assertRewardPacketRefs` landed in rewards.ts as promised
  (self-wired; the 48a "deliberately unvalidated" note retired) +
  `assertPacketStatusRefs` guards applyStatus ids inside injected
  rules. The rollRewards wholesale packet exclusion STAYS until 49c.
- Skeleton catalog = **patch** (heal 3, out-of-battle) — the simplest
  schema-prover, and the name passes the graceful-degradation test
  (lay: patch up a wound; tech: software patch).
