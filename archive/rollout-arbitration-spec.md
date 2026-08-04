# Interstitial Spec: Run-Layer Rollout Arbitration

> **RATIFIED 2026-07-29** — distilled from the user-signed sketch
> (BALANCE §"The sanctioned direction" + the seven-point 68g brief + the
> 68 shape-lock), hardened against the code-reality audit (WORKLOG
> §Kickoff), and ratified with all six docket items resolved in the
> same-day design conversation — see **Kickoff resolutions** at the
> bottom; the body above them is the draft as ratified.

## Stop encoding judgment, part two

The §57 lesson — stop hand-authoring judgment; let cheap rollouts
arbitrate under paired luck — applied one layer up. The run-layer scored
policies were the right cheap tier for Cluster 3/4, but their blindness
is now *proven consequential*: the port scorer values every daemon and
packet at a flat weight (buy quality, not supply, binds the shop — the
×2-supply dose-response was flat), the fire policy mistimes packets badly
enough that the whole fire channel reads ≈0 (hype/overclock
sign-negative at n=80), and the node picker walks into elite detours it
has no business taking (68e). Every one of those is a *bias* problem —
more seeds fix noise, not bias.

So: run-layer decisions **enumerate their candidates and let truncated
rollouts arbitrate**, the K=2 / CRN / null-arm-plus-hysteresis shape the
battle searcher already proved. The scored policies stay as the cheap
tier and (where useful) as nominators — nothing is deleted.

## Goals (in priority order)

1. **Kill the §60c consumption treadmill BY CONSTRUCTION.** A new
   mechanic is consumed because the rollout *measures its effect on the
   run* — there is no scorer dimension to author, forget, or get wrong.
   The new-mechanic shipping checklist's "consumption story" collapses to
   "it's a candidate."
2. ⭐ **Decision-level value telemetry as a FIRST-CLASS instrument** —
   co-equal with play strength. Every arbitrated decision logs its
   candidate set and per-candidate rollout deltas: that is per-item
   realized value at decision granularity, hundreds of observations per
   40-seed batch against the n=80 run-level floor. The measurement
   payoff may rival the play payoff.
3. **Raise the bot ceiling honestly** so the deferred band work can
   land: the walk-wall / two-act re-read is explicitly WAITING for this
   ceiling move (the board's four two-act WARNs are the marker).

## The mechanism (v1 shape)

Reuse the §57 machinery wholesale — same doctrine, new substrate:

- **The clone seam**: `Run.toJSON → fromJSON` on a fresh bus with **all
  eight serialized RNG streams re-seeded** from the rollout seed — the
  clairvoyance guard, verbatim from `cloneForRollout` (the snapshot
  serializes streams by design; a plain round-trip would foresee the
  real dice). Pre-rolled facts are *legitimately* known to a rollout:
  the map DAG + node kinds, the §66 boss forewarning pair, the current
  offer/stock/prices. On-arrival rolls (encounter selection, waves,
  future offers, battle dice) sample fresh — that's the correct
  semantics, not a limitation.
- **CRN**: one seed set per decision, shared by every candidate —
  paired-luck comparison, seed noise cancels.
- **The null arm + hysteresis**: "don't buy / don't fire / keep the
  current plan" is always a candidate; a challenger must beat it by ε.
  (ε units are run-scoped and need their own calibration — the battle
  ε=0.25 is in HP-fraction units and does not transfer.)
- **K=2 as the starting point** (locked at the battle layer; the
  kFlip-prefix instrument pattern re-derives it here if flips prove
  common).
- **Horizon**: truncated at **the end of the next battle** for
  out-of-battle decisions (node pick, port buy, outOfBattle fire), and
  **the end of the current battle** for preTurn decisions (redraw,
  empower, preTurn fire). *"Value that realizes later than one battle
  is deliberately out of horizon in v1 — the telemetry will tell us
  whether that truncation bites.*
- **Terminal score** — UNDECIDED (design round). Candidate shape, in
  the evaluator's keep-it-dumb tradition: player pool HP delta over the
  horizon + a dominant run-death penalty, with bits/roster deltas as
  telemetry columns rather than score terms in v1.
- **What plays the battles inside a rollout** — UNDECIDED, and it is
  THE cost fork (see Appetite). Options, priced by a re-run of
  `benchRollout`: (a) the full battle searcher recursively — faithful
  but multiplicative (candidates × K × the searcher's own K per search
  point); (b) the cheap tier (TrafficScriptDriver / bare selectors) —
  biased low, but the bias is *shared across candidates* under CRN;
  (c) start with (b), measure the disagreement on a sample with (a).
- **Caching** — design needed at the phase kickoff: candidates that
  provably don't perturb the next battle (e.g., two port buys that
  leave the roster untouched) can share rollout results; anything
  cleverer waits for profiling.

## Decision sites (v1 scope)

| Site | Today (the cheap tier) | Known blindness | v1? |
|---|---|---|---|
| Port buys | flat `daemonValue`/`packetValue`, recruit-scorer for units, price sensitivity | flat item values — proven consequential (brief #2) | **IN** |
| Packet fires (both contexts) | threshold + first-usable + max/min-power targeting | mistiming — the ≈0 fire channel (brief #1); owns the repair | **IN** |
| Daemon picks (reward accept + port lane) | accept-all / flat value | no draft-quality attribution | **IN** |
| Redraw + empower | `level:2` / `level:hi` hand heuristics | untested against alternatives at decision grade | **IN** |
| Node choice | backward-DP over static kind weights | elite-risk-blind (68e) — no roster-strength conditioning | **UNDECIDED** — the flagged v1-scope fork |
| Recruit / pass | the H7a offer scorer + pass bias | least-blind of the lot; searched weights | **UNDECIDED** — cheap to include mechanically, but it's the searched-vector's core competence; telemetry may want it anyway |

Arbitration ships as a **harness/bot instrument** (a `FuzzStrategy`
implementation over the existing chokepoints — `pickNextNode`,
`pickPortBuy`, `pickPacketFire`, `pickRecruit`, the redraw/empower
policies). The audit found no harness surgery needed: strategies already
receive the live `Run` read-only.

## Telemetry (first-class, not a rider)

- A per-decision log, opt-in like the H7c accumulator: decision site,
  (sector, hop), candidate set, per-candidate rollout means, the chosen
  candidate, margin vs the null arm.
- A `decisions.csv` sidecar next to `summary.csv`; the board gains
  per-item realized-value reads at decision granularity.
- The noise-vs-bias doctrine stamps every read: rollout deltas are
  *paired* (CRN), so per-decision margins are low-variance by
  construction.

## The balance agenda riding on the instrument (sequenced AFTER the build)

1. **The fire-channel repair, verified** — re-read the channel with
   arbitrated fires; per-packet decision-grade dispositions (patch's
   clean positive, hype/overclock's sign-negatives).
2. **The board re-run + the walk-wall / two-act band re-read** — the
   deferred 68g item; re-sign the two-act DESIGN band (55–70) at the
   new ceiling; the deep-end wall (58.8/45.5 vs the 30–35 handoff
   band) gets its rework read here.
3. **The +2-vs-+4 draw non-monotonicity** at decision grade (§65d/68f).
4. **The elite-risk node read** (if node choice ships in v1).
5. **Prices re-dispositioned** wherever decision-level realized value
   contradicts the 68 run-level reads.

Every amendment re-runs the full board (the standing rule); batches
follow the 68h sizing rule (multi-arm × ≥40 seeds → the box).

## Explicitly OUT

- **Player-facing AI** — this is a measurement/bot instrument, same as
  §57. The live game's enemy behavior is untouched.
- **Learned/ML policies** — the standing honest-cost read stands.
- **Re-tuning the battle-layer searcher** — K=2, dials, and the §57c
  locks are not reopened by this round.
- **New mechanics or content** — the interstitial builds instruments
  and re-signs bands; Cluster 5 gets the content.

## Appetite

**A §57-sized build** (user-signed at the 68 shape-lock): one
interstitial round, truncation/caching design included. The escape
hatch runs on SCOPE, not time: if rollout cost or the caching design
blows up, v1 *narrows the decision-site list* (port buys + packet
fires are the irreducible core — they carry goals 1 and 2) rather than
extending the round.

## UNDECIDED — the design conversation's docket

*(All six resolved 2026-07-29 — see Kickoff resolutions below; kept
as-drafted per the cluster-4-spec precedent.)*

1. Does **node choice** ship in v1? (The elite-risk blindness argues
   yes; the horizon interaction — path value realizes over multiple
   battles — argues telemetry-first.)
2. Does **recruit/pass** join the arbitrated list, or stay with the
   searched scorer?
3. **What plays rollout battles** — cheap tier vs recursive searcher
   vs calibrate-then-choose (the cost fork).
4. The **terminal score** definition (pool-delta + death penalty as
   the v1 candidate; what, if anything, prices bits into it).
5. **ε calibration** for the run-scoped hysteresis.
6. Whether the arbitrated arm **replaces the realistic-bot default**
   immediately on landing, or runs alongside it for one board cycle
   first (re-anchor mechanics — the §68d/f sheet supersession
   precedent).

## Kickoff resolutions (LOCKED 2026-07-29 — the design conversation)

All six docket items resolved in one sitting, user-ratified; the
walkthrough rationale is in WORKLOG §Kickoff.

1. **Node choice: IN.** Terminal score = rollout outcome + the
   existing DP path score as the tail estimate at the truncation (the
   cheap tier demoted to a bootstrap heuristic — the risky immediate
   pick is arbitrated, the long tail stays the DP's job). Smallest
   candidate set of any site (frontiers are 1–3 nodes).
2. **Recruit/pass: OUT for v1** — the one-battle horizon censors a
   permanent asset (its value realizes only if drawn). The named v2
   contingency is below; `--grant` pairs remain the asset-value
   instrument meanwhile.
3. **Rollout inner tier: cheap by default, recursion as a dial.** The
   full-searcher tier ships behind a config switch; a flip-rate
   instrument (the §57g kFlip-prefix pattern) samples decisions under
   both tiers and counts disagreements — recursion is paid only where
   flips concentrate. Priced by a `benchRollout` re-run at the phase
   kickoff.
4. **Terminal score: pool damage taken over the horizon + a dominant
   run-death penalty** (completion bonus if the horizon crosses the
   run's end) **+ a single swept bits-λ, default 0.** One exchange
   rate, not per-item values — λ is a board arm, never a trusted
   constant. Bits/roster deltas always land as telemetry columns so a
   spend-happy distortion at λ=0 is visible, not inferred.
5. **ε: derived empirically, per decision site, from an
   inert-candidate A/A read.** The pinned byte-identical inert-grant
   machinery run through the full rollout pipeline yields the pure CRN
   paired-margin noise floor; ε ≈ 2σ of it. No hand-authoring.
6. **Re-anchor: run-alongside for one full board cycle.** The scored
   arm stays the continuity anchor (the Soldier role); the paired
   same-seed old-vs-new diff IS the ceiling-move measurement the
   deferred walk-wall/two-act re-read consumes; then one signing
   session flips the realistic-bot default and re-signs bands (the
   §68d/f supersession precedent, executed deliberately).

### The recruit contingency (named, NOT pre-built — the v2 plan)

**Re-open triggers** (evidence, not vibes — the data accrues free from
v1's decision telemetry):

- **The free head-to-head**: port unit buys are arbitrated in v1 and
  share `scoreOffer` with recruits wholesale — if arbitration flips a
  meaningful share of unit-buy picks AND the flips carry positive
  realized margins, the scorer's unit judgment is proven
  consequentially blind and recruits inherit the suspicion.
- **Gap attribution**: post-ceiling-move, decision telemetry localizes
  a material share of the remaining bot-vs-human gap to draft
  composition.
- **A state-dependence mechanic lands** that the scorer's features
  can't see (the cluster-4 synergy-tags revisit trigger is the obvious
  candidate).

**The pre-named design** (fixes the censoring, not the symptom):
**forced-fielding rollouts** — clone with the candidate recruited AND
forced into the rollout battle's opening hand; score its per-fielding
contribution; recover expected value analytically via the computable
draw probability (hand/roster sizes are known at decision time). The
pass arm rolls out with natural draws. This is the telemetry doctrine
already in the codebase ("force it onto the roster, then read its
per-deployment output" — telemetry.ts) promoted from batch grade to
decision grade. Optional: a two-battle horizon for recruit gates only
(~1 gate/hop × ~4 candidates × K keeps cost port-dock scale).

**The middle rung ships first**: shadow mode — arbitrate-but-don't-act
on a dedicated telemetry arm, so the measurement lands (per-offer
rollout deltas = draft attribution at decision grade) and the
forced-fielding read is validated against realized outcomes BEFORE it
touches play. Only if shadow consistently out-calls the scorer does
the default flip — the same earn-your-way-in discipline as
resolution 6.

Cost was never the objection (recruit gates are port-dock scale);
validity was — this contingency exists so a v2 re-open starts from a
design, not a debate.
