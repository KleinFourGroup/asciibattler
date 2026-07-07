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
