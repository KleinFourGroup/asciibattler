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
