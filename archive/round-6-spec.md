# Round 6 Spec — Instruments — ARCHIVED

> **Archived 2026-09-02 at the Round 6 close (88e)** with its
> roadmap/worklog pair ([post-83-roadmap.md](post-83-roadmap.md) /
> [post-83-worklog.md](post-83-worklog.md)). The §Kickoff resolutions
> below are the signed design record for Phases 84–88; the durable
> facts are condensed in HANDOFF §Closed rounds and BALANCE (the board
> integrity protocol · the rarity verification protocol · the
> derived-artifact registry).

The balance-instrument round the Cluster-5 close handed forward: land
every measurement change that would invalidate a later read, then
re-sign the sheet ONCE at the end. The draft below is the intent as
signed at the 2026-08-21 planning session ([META-ROADMAP.md](../META-ROADMAP.md)
§Round 6) plus the 2026-08-22 spec conversation; the **Kickoff
resolutions** block is the signed design record. Findings + rationale:
[WORKLOG.md](post-83-worklog.md) §Kickoff. The plan: [ROADMAP.md](post-83-roadmap.md).

## Intent (the draft, in the user's voice)

The fold goes first. Every board run on the pre-fold arm measures a
doctrine we already know we're replacing, so nothing balance-shaped
gets read until the bot can see past its one-battle horizon. Four
things, in order: the measured-terminal-prior fold (rung 1, tabular —
83e judged it; the ML rung stays closed unless the tabular prior
drifts) with the ε-floor re-read and its two riders (the campRaid
nominator, the 55pre vector re-derive); the balancer performance pass
(profile first — nobody has ever taken one); roster realism for the
isolation reads (the `--per-encounter` instrument fields the starting
roster at level 5 against a player-relative budget — "differential
only" is a polite way of saying it measures the wrong fight); and the
rarity verification protocol (the 5/3/3/2 tiers were a design
judgment over bot-preference weights; nobody ever read realized value
for them, and the §76f four were tiered blind). One sheet amendment at
the close, not one per item.

On how the prior's numbers get measured: I'm not the biggest fan of a
two-night `--grant` cohort. If it's necessary it's necessary, but it
leaves a lot of data on the table — runs where you get a daemon early
on, etc. — and it becomes prohibitively expensive as we add more
content. Something like a softmax data-gathering arm whose aggregate
data gets compared? Not my area; I need the expertise here.

Scaling the prior by hops remaining: definitely on board. Daemons +
cache packets + roster units is the coverage I was thinking of. The
campRaid rider as a run-level decision: agreed — we can re-evaluate if
it literally never gets picked, but it's mostly a run-level decision.
Whole recorded roster rows for the sampled mode: signed.

## Kickoff resolutions (LOCKED 2026-08-22 — the spec-audit design conversation)

Decisions from the four-surface code-reality audit + the design
conversation. All sections user-signed ("enthusiastically approved");
the renumber (the instrument is a regular §84, not a pre-step) is the
user's call.

### The measurement design — the long-horizon SHADOW instrument (LOCKED)

The audit overturned the draft's "fold the decisions.csv per-item
aggregates" premise on two counts: (1) **units** — Δ|picked is the
margin a candidate earned INSIDE the one-battle horizon, which the
rollout already realized; folding it back double-counts, and what the
prior needs is the value BEYOND the horizon (a run-grade quantity —
what the 72f pre-registration actually said: "per-passive realized
value from the `--grant` paired instruments"); (2) **coverage** — the
rows that clear n=80 on the 83f board are the items already inside
the horizon (empower, patch/surge/shield/discard-one, nodeChoice
battle); the run-long assets the fold exists for read n 1–30 and
Δ ≈ 0.00. decisions.csv stays the **convergence monitor** (the
ML-rung tripwire, 83e) — not the prior's source.

The `--grant` paired cohort (control + every grantable id at n=80,
~41 batches, ~two box nights) was REJECTED as the source: linear in
content, and it measures items at hop 0 only. The naive
softmax-arm-plus-aggregate-compare was rejected too: it loses the
same-seed pairing (two runs that disagree on one choice disagree on
every later one — full between-seed noise) and confounds on state
(being offered a daemon at a port depends on bits, which depends on
winning).

**Signed: branch the run at the natural decision point.** At every
ACQUISITION decision a default-arm run makes, the arbitration driver
already clones the run per CRN pair and walks both branches under
shared dice for one battle; the §71c shadow pattern (`shadowTier` —
same candidates re-judged under another setting, telemetry-only, the
driver's stream untouched so the batch decides byte-identically) is
generalized to a **shadow with `horizonBattles` = run end**: every
candidate's branch walked to `complete`/`defeat`, the paired final-pool
margin logged per candidate. Contract:

- **Sites:** the acquisition sites only — `rewardDaemon`, `portBuy`,
  `eventChoice`, and a NEW shadow-only `recruit` site (offer slots +
  pass; the 70c shape — recruit picks are not an arbitration site
  today, and units are the rarity phase's item). Grants, fires, and
  node picks are inside the horizon already and are NOT shadowed.
- **Cost control:** a deterministic 1-in-m sample of shadowable
  decisions (off a dedicated fork, never the driver's pair stream);
  `m` and the shadow's K are cost-tuned at the phase (ballpark ~3
  shadowed decisions × ~4 branches × ~half a run ≈ 6 run-equivalents
  per run; an n=80 instrument batch ≈ one box night at most). The
  shadow is its OWN instrument arm (`--shadow-horizon=run` or
  equivalent), never on by default — board batches stay cheap.
- **Live decisions are byte-identical** with the shadow on or off —
  pinned by test (the 71c precedent).
- **The table** = the per-item long-horizon paired margin, normalized
  per REMAINING hop (a new aggregate column beside meanΔ), committed
  as a versioned artifact with provenance (HEAD, batch ids, n per
  row — the signed-sheet pattern). Self-refreshing: any default-arm
  batch with the shadow on re-measures it (the 72f "re-measured per
  balance round").
- **Exploration is free:** the shadow evaluates every candidate
  regardless of the live pick, so an item the bot always declines
  still gets its "what if" branch.
- **The bridge (the instrument's validation gate):** the long walk is
  played by the cheap walker (traffic-tier battles, scored policies),
  validated for DECISIONS at §71 but not for absolute run-long
  magnitudes. Before the fold consumes the table, run the old
  `--grant` recipe for ~3 items (a daemon, a packet, an archetype) and
  compare; a material disagreement is a finding, not a silent scale.
- **Thin rows:** items under the n=80 floor from natural play (rare
  offers — legendaries by construction) get the targeted `--grant`
  paired arm as the precision instrument. A handful of batches, not a
  cohort; the rarity phase spends its box time there.

### The fold (LOCKED)

- **Landing site:** the run-layer terminal score
  ([tests/fuzz/rollout/evaluator.ts](tests/fuzz/rollout/evaluator.ts)
  `scoreTerminal`) gains a prior term; `readRunMetrics` widens to carry
  holdings (`daemonIds`, cache packet ids, team archetypes). The
  in-battle evaluator ([src/bot/evaluator.ts](src/bot/evaluator.ts))
  is NOT folded — one evaluator, one fold.
- **Shape (rung 1, tabular, state-scaled):**
  `priorBonus = λ_prior × Σ_items table[item] × hopsRemaining` over the
  DELTA of holdings (terminal clone − live run). The table is per
  remaining hop (above), so the scaling is measured, not assumed;
  whether value is ~linear in hops remaining is a §84 read (the same
  item observed at different hops). Items held on both sides cancel —
  an owned daemon never distorts a comparison.
- **Coverage:** daemons + cache packets + roster units. Bits stay on
  `λ_bits` (0 today; the bot spends ~3% of what it banks, so ≈0 is
  arguably honest) — sweepable, unchanged.
- **λ_prior is a BOARD ARM, never a trusted constant** (the 69d
  doctrine): swept {0, 0.5, 1} at the phase; λ_prior = 0 is
  byte-identical to today (the explicit-empty-registry pattern, the
  board's control); the default signs at the amendment. `priorBonus`
  rides the per-seed breakdown as a visible column (the `tailBonus`
  discipline) and decisions.csv append-last (readers resolve by
  header name).
- **Exit:** the fold on the default arm with a paired same-seed read
  vs the pre-fold arm; the boon-event indiscrimination (Δ 0.00 at
  n≈800, 83e) is the named validation case — the daemon/packets/bits
  rows must separate.

### The ε re-read + the two riders (LOCKED)

- **ε floors** re-derive post-fold via `readEpsilonAA` (flat per
  class, 2σ pooled — the 70b rule). **Add an event-page context**:
  `EVENT_CHOICE_EPSILON` is provisional by class argument, never
  derived; the §81 re-read was owed and routed here. State-conditioned
  ε stays a named candidate unless the σ spread demands it.
- **campRaid = a RUN-LAYER preTurn decision site**, not a sixth
  searcher script. The objective shape is free (the §75g pull's
  `{mode:'engage', target:{kind:'neutral', unitId}}`), but the battle
  evaluator scores material only and neutrals count in neither team's
  material — a raid never clears ε there; its payout (bits/packets at
  turn end, the packet prior) is visible only at the run layer. The
  candidate seeds the team objective at battle start (a foreign
  standing order silences the in-battle searcher until the target
  dies — "raid first, then fight"); the walker plays it out; the 83e
  forced-engagement probe is the baseline it must beat (selective vs
  indiscriminate). Re-evaluate the layer only if it literally never
  gets picked.
- **The 55pre re-derive** = a fresh `--search` on the post-fold arm
  (the §59 regen recipe), pinned as a new fixture; the board's 55pre
  twin reads against it and `pre55ReachRef` retires if the new anchor
  lands inside 40–50 (else re-pins — the exit criterion either way).

### The perf pass (direction LOCKED, expectation reset)

Profile-first stands. Code reality: the clone is measured negligible
(57d/69c) and the cost is `World.tick` inside rollouts — the run-layer
walker plays a FULL battle per CRN pair per candidate, the battle
searcher spends (candidates+1)×K×160 ticks per search point. Two of
the draft's three levers won't bite (amortized clone — already
negligible; successive halving — K=2, nothing to halve). Realistic
outcome: tick-level micro-wins (pathfinding scratch, `livingUnits`
filters, Map churn; the pooling TODO) or a documented no-op. The
47e worktree-pinned oracle (summary.csv + decisions.csv sha across
arms) is mandatory; the one real danger it guards is float
reassociation flipping a tie. The round's plan does NOT lean on the
speedup.

### Roster realism (LOCKED)

Confirmed: `--roster` → `RunConfig.startingRoster` → `rollUnit` at the
given level, else the character roster at `STARTING_LEVEL`; `BattleResult`
carries `playerLevels` but not archetypes; `ArchetypeTelemetry` is
run-aggregate. Build: `playerArchetypes` captured beside `playerLevels`
(~10 lines + a reporter column); a committed per-hop roster table with
provenance; `--roster=sampled:<hop>` draws a **whole recorded roster
row** (archetypes + levels + size together — correlations preserved),
sampled HARNESS-side before construction (no Run stream change). Then
the X3 isolation cohort re-runs under it; the per-kind bands
(normal≈3 / elite≈6 / boss≈10) dispositioned hold / re-pin / defect.

### Rarity (LOCKED)

The rarity read consumes the §84 table's unit rows (the recruit site)
— its measurement is the fold's unit data, the coupling the draft
order missed. Box time goes only to the archetypes under the floor
(targeted `--grant` paired arms). Read: does realized value order
match the tiers; do prices (`unitPriceFor` × `rarityMultiplier`) match
realized value. Disposition per DRAFTABLE archetype (verify the count
at kickoff — `ALL_ARCHETYPES` includes untiered non-draftables); the
protocol stands for every new archetype from Round 9 on.

### Phase order (the renumber, user's call)

§84 the instrument (+ the recruit site + the first batch + the bridge
+ the committed table) → §85 the fold + the ε re-read + the two riders
→ §86 the perf pass → §87 roster realism → §88 the rarity read + the
close ritual + the ONE amendment. The draft's rarity-last rationale
(the faster balancer for the biggest cohort) dissolved with the
cohort.

### Snapshot predictions

Everything lands harness/bot-side: **World v35 / Run v44 hold for the
whole round.** The perf pass touches the hot loop but no serialized
shape; the campRaid site and the roster capture are harness-side; the
recruit shadow site is a driver consumer. Any phase that finds
otherwise writes the bump prediction into its cut line first.

### Scope guards — NOT doing this round

- No balance CONSTANT moves except through the closing amendment; no
  new content; the UI audit + i18n wait for Round 7.
- No in-battle-evaluator fold; no ML rung (closed unless the tabular
  prior drifts); no state-conditioned ε unless the re-read demands it.
- No perf lever that flips a decision ships as a speedup — that's a
  doctrine change for the user.
- The shadow instrument never rides board batches by default.
