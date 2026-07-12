# The Micro Round Specification

## "Traffic school for the bot"

This specification covers **the micro/balance-realism interstitial round**
between Clusters 3 and 4 — the standing post-cluster-audit convention,
promoted to a full round by the §52 calibration finding. Its job is to make
the bot realistic enough that balance numbers stop being fiction, then run
the REAL economy balance pass that Cluster 3 deliberately deferred.

> **Status:** DRAFT — distilled from worklog §52 (the three-act kickoff
> narrative) + BALANCE §52, awaiting shape-lock. Calls locked at the §52
> shape-lock are marked **✅ DECIDED**; genuinely open items are marked
> **⚠ OPEN**. Engineering mechanics stay at headline level here — the
> roadmap and phase kickoffs carry the detail.

### The motivating finding (why this round exists) ✅ ON RECORD

The §52 calibration finding (BALANCE §52): **the bot's best-achievable win
rate is ~30% (§46b: ~31 in-sample / ~24 held-out); my native win rate is
~80%** — usually WITHOUT recruiting and WITHOUT daemon mechanics. By
elimination, the run-level strategy layer isn't the edge; **battle-layer
objective handling is** (J4's static proclivity draw vs my closed-loop
control).

My edge is **traffic management, not targeting**:

- un-jamming melee stuck behind my own ranged (fall back → re-sort →
  re-engage)
- stopping short of hazard terrain
- choke holding
- the spiral opposite-spawn burn cheese (win by attrition without fighting)
- focus fire mainly as a *cohesion* tool (catapults the one true
  assassination target)

This is exactly the residual the §42–46 round left: unit-level cooperation
got fixed; composition-level traffic is only fixable from above — the
objective layer.

My ~20% losses are **reaction-time cells** (spawn-in-range alpha strikes:
funnel / adjacent-spiral spawns vs ronin+mages; artillery company on
strafing funnel; junction ambush vs heavies) — a loss mode a tick-0 bot is
immune to. Expect per-fixture sign flips in paired comparisons; that's
signal, not noise.

**Consequence:** every ABSOLUTE bot-anchored target — including the
boss-wall 43–55% design target — needs re-derivation once a realistic bot
exists. RELATIVE reads (gradients, per-encounter bands, before/after
deltas) remain valid, so the run-log history stands. Economy numbers
shipped launch-rough BY DESIGN; this round makes them real.

### The design answer ✅ DECIDED (in principle; each rung gated by measurement)

The industry middle ground between linear proclivities and an RTS bot:
**portfolio-based search over scripted policies** (the Churchill & Buro
StarCraft-micro lineage). This project is unusually cheap to apply it to
because the determinism doctrine IS the prerequisite infrastructure —
serializable world, forked RNG, headless speed.

**Non-goals, locked:** no RL / imitation learning; no raw action-space
search. And the **anchors stay FROZEN on the old objective handling
forever** — greedy/random keep the current behavior so every future read
has a stable floor.

### Rung 0 — instrument first: the recorder + the gauntlet

- **The passive DEV trace recorder**: `seed + config hash + tick-stamped
  command log + outcome`. Determinism makes every recorded human run a
  replayable fixture, and **paired-seed bot comparisons become the unit of
  evidence**.
- **The battle gauntlet**: ~10 cells drawn from the named killer
  encounters (the reaction-time cells above plus the traffic showcases),
  ~3 seeds each — **battle-level, not run-level**, so it's ~1 hour of my
  time, not a 15-minute-run grind. My ~80% self-report stands as the
  provisional re-anchor until the gauntlet gives a measured one.
- **Rider ✅ DECIDED — the dev export/load key**: RunSnapshot dump/restore
  on a keybinding, riding the recorder's replay path nearly free
  (RunSnapshot already round-trips by contract). **Menu-grade save/load
  stays Cluster 6** — the 2026-07-09 interstitial fact, corrected
  2026-07-11.
- ⚠ OPEN — exact gauntlet cell list (encounter × layout × seeds). Cut at
  phase kickoff from the named killers + a spread of the traffic
  scenarios.

### Rung 1 — five reactive traffic scripts

State-reactive, event-driven, **no rollouts**. The five, mapping one-to-one
onto my introspected edge:

1. **unjam** — melee stuck behind own ranged: fall back → re-sort →
   re-engage
2. **terrain-edge hold** — stop short of hazard tiles instead of pathing
   into them
3. **choke hold** — hold a chokepoint rather than funneling through
4. **attrition stall** — the burn-cheese shape: refuse engagement and win
   on attrition when the position says so
5. **cohesion focus** — focus fire as cohesion (the one true assassination
   target, e.g. catapults)

- ⚠ OPEN — how scripts integrate with the typed objective model (O1's
  `atWill`/`engage`/`hold`/`focus`): new objective kinds vs a layer above
  them, and the arbitration rule when several scripts trigger at once.
  Design round at the phase kickoff.

### Rung 2 — portfolio rollout search (GATED on Rung 1's residual)

Only if the Rung-1 gauntlet still shows a meaningful human–bot residual:

- Portfolio greedy search: clone via snapshot, roll each script forward
  ~10–20s of game time, score by **pool differential**, commit the winner.
- **The CLAIRVOYANCE GUARD ✅ DECIDED**: rollouts fork a *divergent* RNG so
  the bot predicts distributionally — it must never foresee the actual
  rolls.
- ⚠ OPEN — the gate itself: what residual justifies building this. Set
  the threshold when Rung 1's numbers exist, not before.

### The expressive economy strategy layer

Economy decisions join **the ONE scored vector** (no second optimizer):

- A **port-purchase scorer REUSING the recruit scorer** — a port unit is a
  priced recruit — plus flat per-kind value weights (~6–8 dims).
- A **3–5-dim fire scorer** keyed on encounter kind (the packet fire arm —
  packets stop being outcome-inert in the harness).
- Anchors stay frozen on the fixed policies (50g buy-all-affordable,
  accept-all rewards); the policy arms stay as A/B controls.
- A **top-K perturb-and-reselect refinement stage** for `--search`,
  motivated by §46b's 30.8/22.5 fresh-search shortfall.

### The REAL balance pass (the round's payoff)

With a realistic bot and an expressive strategy vector, the whole deferred
Cluster-3 tuning agenda lands here, measured against the §52 economy
metric family (bits-per-hop · spend mix + terminal bank · transaction
rate — all strategy-tier):

- **Re-anchor the design targets** off the new measured optimum (my ~80%
  self-report retires as anchor).
- **The boss-wall rider verdict** — the 43–55% target, re-derived against
  a real ceiling.
- **Prices · `bitsMultiplier` · packet drop weights · `path.port` · the
  fire arm.** The transaction-starvation guard applies: sweep `path.port`
  first — a price read at ~24% transaction rate is not a price read
  (§50g).

### Watch items carried into the round

- ⚠ The §49 cache-shrink flow still has NO shipped trigger content
  (worklog §50g) — a cursed daemon or priced trade-off could land with the
  port/price tuning if it earns its slot; otherwise it keeps waiting.
- The renderer "queued"-stance polish stays in TODO.md (not this round's
  scope).

### Cross-cutting engine notes

- The recorder, gauntlet harness, and rollout machinery are all DEV-only
  surfaces — zero shipped-game behavior change until the scripts
  themselves land, and the anchors preserve the old behavior even then.
- Standing movement doctrine binds this round hard: the drift.test.ts
  quality gates are never relaxed; NO RNG in movement (symmetric rules
  only — scripts must respect it); derive-don't-cache for anything the
  scripts read.
- Expect fuzz/determinism baseline resets when scripts change bot
  behavior; snapshot bumps only if the objective layer's serialized shape
  changes (⚠ OPEN until the Rung-1 design round).
