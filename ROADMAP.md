# ROADMAP — The Micro Round (Phases 53→57)

> **▶ ACTIVE — the micro/balance-realism interstitial round between Clusters
> 3 and 4** — the standing post-cluster-audit convention, promoted to a full
> round by the §52 calibration finding. Authored under the planning-stack
> protocol (AGENTS.md "The planning stack"): this file is the PLAN and stays
> one for its whole life. Phase entries carry charter / ordering +
> dependencies / risk / decision points / exit criteria / scope guards ONLY;
> sub-steps are cut at each phase kickoff; narrative, findings, and rationale
> land in [WORKLOG.md](WORKLOG.md); plan mutations here are one line + a
> worklog pointer. Spec: **[micro-round-spec.md](micro-round-spec.md)**
> (shape-locked 2026-07-11 — audit this plan against it). **First task of the
> next round's kickoff = archive this file + WORKLOG.md + micro-round-spec.md →
> `archive/post-52-roadmap.md` + `archive/post-52-worklog.md` +
> `archive/micro-round-spec.md`** (the ritual).

Companion to [DESIGN.md](DESIGN.md), [ARCHITECTURE.md](ARCHITECTURE.md),
[BALANCE.md](BALANCE.md), [PATHING.md](PATHING.md), [TODO.md](TODO.md),
[GOTCHAS.md](GOTCHAS.md), and [META-ROADMAP.md](META-ROADMAP.md). Prior
roadmaps in [archive/](archive/) — most recently
[post-46](archive/post-46-roadmap.md) (Cluster 3 — Economy, 47→52).

## Where this came from

The §52 calibration finding (BALANCE §52, worklog
[post-46](archive/post-46-worklog.md) §52): **bot best-achievable ~30% vs
the user's native ~80%** — a ~50pt gap localized by elimination to
battle-layer objective handling; the human edge is TRAFFIC MANAGEMENT
(composition-level — exactly the residual §42–46 left after fixing
unit-level cooperation). Every absolute bot-anchored target is fiction
until the bot is realistic, so Cluster 3 shipped its economy numbers
launch-rough BY DESIGN and its whole tuning agenda moved here. The design
answer, locked in principle at §52: **portfolio-based search over scripted
policies** (Churchill & Buro lineage), climbed as a measurement-gated rung
ladder. The round has the 42→46 shape: symptom → instrument → fix →
re-baseline.

## The phase sequence at a glance

| Phase | Name | One-liner | Risk |
|---|---|---|---|
| **53** | Rung 0 — the recorder + the gauntlet | Passive DEV trace recorder (replayable human fixtures; paired-seed comparisons) + the ~10-cell battle gauntlet; rider: the dev export/load key | Medium (replay fidelity is the round's foundation) |
| **54** | Rung 1 — the traffic scripts | Five reactive traffic scripts at the objective layer; anchors frozen; gauntlet re-measure | High (the round's core surgery) |
| **55** | Rung 2 — portfolio rollout search | GATED on §54's residual: snapshot-clone rollouts + the clairvoyance guard — or a documented NO | High if built (may legitimately not run) |
| **56** | The expressive economy strategy | Economy dims join the ONE scored vector; fire scorer; top-K refinement; `--search` regen | Medium (harness-only surface) |
| **57** | The REAL balance pass + close-out | Re-anchor targets · boss-wall verdict · prices/`bitsMultiplier`/drop weights/`path.port`/fire arm · round close | Low-Medium (measure + config) |

## Sequencing rationale

Instrument before fix — the 42→46 shape: §53 builds the measurement
apparatus every later gate reads, and its human baseline is what "realistic"
means for the rest of the round. §54 before §55 because the portfolio IS
the scripts — nothing to search over until they exist — and §55's existence
is itself a measurement call on §54's residual. §56 waits for the bot to
stabilize (whichever rung that turns out to be): a `--search` optimum
derived against a still-moving bot is dead compute — §52's own re-scope
rationale, applied forward. §57 strictly last by the cluster-closer
convention; it consumes §56's expressive vector and the stable bot, and it
owns the re-anchoring + the boss-wall rider verdict.

## Hard ordering constraints

- §53's gauntlet is the instrument for §54's re-measure and §55's gate; its
  recorder replay path is what the dev export/load key rides.
- §53's human gauntlet baseline (user play session, ~1 hour) gates every
  human–bot comparison downstream; the ~80% self-report stands as the
  provisional re-anchor only until then.
- §54 before §55 (the portfolio is the scripts); §55's go/no-go reads §54's
  quantified residual — a decision-point STOP.
- §56 after the behavior rungs settle; §57 after §56 (it measures at the
  expressive optimum).
- `path.port` sweeps FIRST within §57 (the transaction-starvation guard: a
  price read at ~24% transaction rate is not a price read — BALANCE §50g).

## Conventions (the standing set)

Headless-first for all bot/harness logic; win-rate + calibration
measurements land in [BALANCE.md](BALANCE.md), movement-quality reads in
[PATHING.md](PATHING.md) (append at any movement change, per its header);
**anchors stay FROZEN on the old objective handling forever**
(greedy/random = the stable floor); the drift.test.ts quality gates are
NEVER relaxed and `baseline.test.ts` exact pins re-pin only on DELIBERATE
movement change; NO RNG in movement — symmetric rules only; the
clairvoyance guard is non-negotiable wherever rollouts exist;
fuzz/determinism re-baselines are EXPECTED when bot behavior changes and
each gets its own commit note; commit per logical change + pause between
commits; keep DESIGN.md / ARCHITECTURE.md honest in the same commit.

---

## Phase 53 — Rung 0: the recorder + the gauntlet

**Charter:** build the passive DEV trace recorder — `seed + config hash +
tick-stamped command log + outcome`; determinism makes every recorded human
run a replayable fixture, and paired-seed human-vs-bot comparison becomes
the round's unit of evidence. Assemble the ~10-cell battle GAUNTLET from
the named killer cells + traffic showcases (~3 seeds each — battle-level,
not run-level; ~1 hour of user time). Rider: the **dev export/load key**
(RunSnapshot dump/restore on a keybinding, beside the recorder's replay
path — nearly free, RunSnapshot round-trips by contract).

**Why here / dependencies:** instrument before fix; every later rung's gate
reads this phase's numbers. No upstream dependencies.

**Risk:** **Medium** — a trace that doesn't replay byte-identically poisons
every comparison the round makes; the command-log tick-stamping touches the
player→run input channel (currently untraced).

**Decision points — ✅ DECIDED at kickoff (2026-07-12, worklog §53):** the
10-cell gauntlet list locked (4 killer + 5 traffic + 1 boss, × 3 seeds —
table in worklog §53; +1 traffic cell `unjam-labyrinth` at 53g-pre, user
call — worklog §53g-pre); command stamping = at APPLY time via a new
`command:applied` bus event (covers the parked-drain case); recorder
persistence = localStorage ring + an export-all dev key; the gauntlet
driver = an opt-in fuzz-CLI sibling (`npm run gauntlet`).

**The cut (shape-locked 2026-07-12; audit + rationale in worklog §53):**

- [x] 53a — the `command:applied` bus event at World's apply site (`{tick, command}`) + ARCHITECTURE catalog row; no snapshot bump predicted ✅ 2026-07-12 — emitted at the drain (post-apply); 4 co-located tests incl. the parked-drain stamp + the auto-revert-purity case; no bump, as predicted
- [x] 53b — `configHash` util + the passive DEV trace recorder (bus subscriber → `TraceV1`; localStorage ring) ✅ 2026-07-12 — src/dev/ (recorder + hash tested, 9 tests; ring = DOM-zone glue); `battle:started` payload grew the full `BattleEncounter` (worklog §53b)
- [x] 53c — `replayTrace` + the fidelity test: byte-identical outcome + event trace vs the live drive (the keystone) ✅ 2026-07-12 — PLUS the effective-tick stamp amendment to 53a (the parked-drain stamp was replay-ambiguous; worklog §53c)
- [x] 53d — the `?encounter=` URL param + run-config launcher field (step zero: verify RunSnapshot doesn't embed RunConfig) ✅ 2026-07-12 — no-bump prediction held (RunConfig is never persisted, by its own header); browser-verified: `?seed=777&hops=2&layout=strafingFunnel&encounter=artillery` forces the named killer cell end-to-end (worklog §53d)
- [x] 53e — the gauntlet cells file + the `npm run gauntlet` driver; headless bot baseline → BALANCE.md §53 ✅ 2026-07-12 — 10 cells × 3 seeds × arms none/random on record (BALANCE §53e); elite cell re-shaped to hops=4 + scan-verified seeds (a 3-hop map can never host an elite — worklog §53e)
- [x] 53e.2 — AMENDED same day (user call at the saturation finding): the STANDARD mid-run roster baked into the cells + pool damage taken as the primary metric ✅ 2026-07-12 — the gradient is back, pointing at the §52 killers (BALANCE §53e.2; worklog §53e.2)
- [x] 53f — the dev export/load key (DEV window listener; `Run.toJSON`/`fromJSON` + Game swap; browser-verified) ✅ 2026-07-12 — Ctrl+Alt+S/L/D (D=trace dump; T is a bound code) + the map-only load rule + riders (ring cap 40→80); user-verified native; worklog §53f
- [x] 53g — the human baseline session (~30 recorded battles); paired-seed table → BALANCE.md; the ~80% self-report retires ✅ 2026-07-13 — 33 cells played (104 turns, 104/104 replay byte-identical; fixture committed + era-guarded test); paired table = BALANCE §53g (⭐ gap LOCALIZED to traffic cells; boss wall human-confirmed; null-action strong); worklog §53g

**Exit criteria:** a recorded human battle replays byte-identically in a
headless test; the gauntlet runs headless per-cell; the measured human
baseline + paired-seed bot numbers on record in BALANCE.md (the ~80%
self-report retires as provisional anchor); the export/load key
user-verified in the native browser.

**Scope guards:** the recorder is passive + DEV-only — ZERO shipped-game
behavior change; NO bot changes this phase (baseline first); menu-grade
save/load stays Cluster 6; no run-level gauntlet cells.

---

## Phase 54 — Rung 1: the five traffic scripts

**Charter:** five state-reactive, event-driven traffic scripts — **unjam ·
terrain-edge hold · choke hold · attrition stall · cohesion focus** —
mapping one-to-one onto the introspected human edge, at the objective
layer (composition-level traffic; the §42–46 residual). No rollouts.
Re-measure the gauntlet; the quantified human–bot residual is §55's gate
input.

**Why here / dependencies:** the design answer's first behavioral rung;
needs §53's instrument to prove any of it moved.

**Risk:** **High** — the round's core surgery. The spec's biggest ⚠ OPEN
lives here: how scripts integrate with the O1 typed objective model (new
objective kinds vs a layer above) and the arbitration rule when several
scripts trigger at once.

**Decision points:** the integration architecture + arbitration (a design
round at kickoff, the §44 decision-protocol precedent); per-script trigger
conditions; whether the serialized objective shape changes (snapshot-bump
prediction goes in the cut lines).

**Exit criteria:** five scripts live behind the new bot with the anchors
byte-frozen on the old handling; drift gates green with NO gate relaxed;
any baseline re-pin deliberate and noted; the gauntlet re-measure on record
in BALANCE.md with the residual quantified.

**Scope guards:** NO rollouts (§55's domain); NO RNG in movement; the
anchors untouched; ⚠ labyrinth stays an intentional slow maze; no economy
work.

---

## Phase 55 — Rung 2: portfolio rollout search (GATED)

**Charter:** IF §54's residual justifies it — portfolio greedy search:
clone the world via snapshot, roll each script forward ~10–20s of game
time, score by pool differential, commit the winner. The **CLAIRVOYANCE
GUARD**: rollouts fork a divergent RNG so the bot predicts
distributionally, never foresees actual rolls.

**Why here / dependencies:** strictly after §54 — the portfolio IS the
scripts.

**Risk:** **High if built** (sim-clone machinery, rollout perf budget) —
and it may legitimately not run at all: the §46a "NO — well-tuned School 1
is enough" precedent is a fully respectable outcome.

**Decision points:** **THE GATE — a stop.** Go/no-go on §54's quantified
residual; the threshold is set when the numbers exist, not before. If GO:
rollout horizon + compute budget.

**Exit criteria:** GO → the search live behind the bot, gauntlet
re-measure on record; NO-GO → the documented verdict with the numbers that
decided it (the §46a shape). Either way, the decision line lands here with
a worklog pointer.

**Scope guards:** NO raw action-space search; NO RL/imitation; the
clairvoyance guard is non-negotiable; anchors frozen.

---

## Phase 56 — The expressive economy strategy layer

**Charter:** economy decisions join the ONE scored vector — a
port-purchase scorer REUSING the recruit scorer (a port unit is a priced
recruit) + flat per-kind value weights (~6–8 dims), and a 3–5-dim packet
FIRE scorer keyed on encounter kind (packets stop being outcome-inert in
the harness). The fixed policies (50g buy-all-affordable, accept-all) stay
as anchors; the policy arms stay as A/B controls. Add the top-K
perturb-and-reselect refinement stage to `--search` (motivated by §46b's
30.8/22.5 fresh-search shortfall) and regenerate
`output/best-strategy.json` against the new bot.

**Why here / dependencies:** after the behavior rungs settle — an optimum
against a moving bot is dead compute; before §57, which measures at this
optimum.

**Risk:** **Medium** — harness/strategy surface only, no shipped-game
change; the search compute budget is the main unknown.

**Decision points:** the exact scorer dim lists (kickoff); refinement K +
search budget.

**Exit criteria:** a fresh `--search` converges with the economy dims
live; packets fire in harness runs (outcome-inertness gone); the
fixed-vector probe re-run on record in BALANCE.md.

**Scope guards:** ONE scored vector — no second optimizer; the fixed
policies survive as anchors; no price/config tuning yet (§57's domain).

---

## Phase 57 — The REAL balance pass + close-out

**Charter:** the deferred Cluster-3 tuning agenda at the realistic optimum,
measured with the §52 economy metric family (bits-per-hop · spend mix +
terminal bank · transaction rate, strategy-tier discipline): **re-anchor
the design targets** off the measured optimum; **the boss-wall rider
verdict** (the 43–55% target, re-derived against a real ceiling); sweep
prices · `bitsMultiplier` · packet drop weights · `path.port` · the fire
arm — `path.port` FIRST (the transaction-starvation guard). Then the round
close: cursor flip, memory update, archive-ritual note, and the Cluster-4
kickoff proposal.

**Why here / dependencies:** last by the closer convention; consumes §56's
vector and the stable bot.

**Risk:** **Low-Medium** — measure + config. The §41/§46b documented-no-op
precedent applies to the TUNING, not to the rider verdict or the
re-anchor — those must be explicit.

**Decision points:** the re-anchored design targets themselves (user
calls); tune-vs-accept per lever; whether the §49 cache-shrink flow's first
trigger content earns a slot in the price work.

**Exit criteria:** targets re-anchored on record in BALANCE.md; the
boss-wall rider verdict explicit; every swept lever either baked or
accepted with numbers; the round closed per the ritual.

**Scope guards:** NO relaxing any standing gate to make numbers fit; NO
new mechanics (findings that want one become TODO/next-round items).

---

## What we're explicitly NOT doing (the round scope guard)

- **No RL / imitation learning; no raw action-space search** — locked
  non-goals (spec §The design answer).
- **No menu-grade save/load** — Cluster 6 (the corrected 2026-07-09 fact);
  only the dev export/load key ships here.
- **No mid-battle pause-to-cast** — still deferred (the Cluster-3 spec's
  deferral stands).
- **No unfrozen anchors, ever** — greedy/random keep the old objective
  handling as the permanent comparison floor.
- **No Cluster-4 content** (rarity, draft pools, starting characters).
- **The §49 shrink-flow content lands ONLY via §57's decision point** —
  otherwise it keeps waiting (worklog §50g watch item).

## Open decisions to resolve when building (the cross-cutting set)

- 53: the gauntlet cell list; the command-stamp seam.
- 54: **script ↔ objective-model integration + arbitration** (the spec's
  big ⚠ OPEN — a design round at kickoff).
- 55: **the gate threshold** (set from §54's numbers — a stop).
- 56: scorer dim lists; refinement K + budget.
- 57: the re-anchored targets; per-lever tune-vs-accept; the shrink-flow
  slot.
