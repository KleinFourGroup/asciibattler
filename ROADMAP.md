# ROADMAP — The Micro Round (Phases 53→60)

> **RESTRUCTURED 2026-07-15** (the §55 reopen — spec AMENDMENT + worklog
> "The §55 reopen"): swap inserted as §56, Rung 2 proper un-parked as §57
> (§55's own scope-guard path), threat read as §58; economy → §59, balance
> pass + close-out → §60. The §55 VERDICT NO stands unrevised.

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
| **55** | Rung 2 — distribution generalization (re-scoped) | ✅ CLOSED, VERDICT NO — gate/threshold fixes couldn't rescue static triggers held-out (−14.2); passive stays the anchor | — (closed) |
| **56** | Generalized swap (engine self-sorting) | SwapAction generalized beyond the healer: units pass their own traffic; design round at kickoff; exit = FULL baseline re-derivation | High (sim engine change; every balance number moves) |
| **57** | Rung 2 PROPER — portfolio rollout search | Opens with the re-ask gate (§55-pre protocol post-swap), then rollout arbitration: null arm floor, clairvoyance guard, horizon/cadence design round | High (the reopened core surgery) |
| **58** | The derived threat read | Deserters residual as reachability math on derived state — NOT intent detection; no-op exit legal if §57's searcher eats it | Low-Medium (may legitimately no-op) |
| **59** | The expressive economy strategy | Economy dims join the ONE scored vector; fire scorer; top-K refinement; `--search` regen | Medium (harness-only surface) |
| **60** | The REAL balance pass + close-out | Re-anchor targets · boss-wall verdict · prices/`bitsMultiplier`/drop weights/`path.port`/fire arm · round close | Low-Medium (measure + config) |

## Sequencing rationale

Instrument before fix — the 42→46 shape: §53 builds the measurement
apparatus every later gate reads, and its human baseline is what "realistic"
means for the rest of the round. §54 before §55 because the portfolio IS
the scripts — nothing to search over until they exist — and §55's existence
is itself a measurement call on §54's residual. **§56 (swap) before §57
(Rung 2 proper)** because the engine change redefines what the portfolio
contains — unjam may shrink or die; a searcher calibrated against traffic
behavior about to be deleted is dead compute. §58 after §57 because the
searcher may arbitrate hold-vs-advance directly, making the sensor a
no-op. §59 waits for the bot to stabilize (whichever rung that turns out
to be): a `--search` optimum derived against a still-moving bot is dead
compute — §52's own re-scope rationale, applied forward. §60 strictly last
by the cluster-closer convention; it consumes §59's expressive vector and
the stable bot, and it owns the re-anchoring + the boss-wall rider verdict.

## Hard ordering constraints

- §53's gauntlet is the instrument for §54's re-measure and §55's gate; its
  recorder replay path is what the dev export/load key rides.
- §53's human gauntlet baseline (user play session, ~1 hour) gates every
  human–bot comparison downstream; the ~80% self-report stands as the
  provisional re-anchor only until then.
- §54 before §55 (the portfolio is the scripts); §55's go/no-go reads §54's
  quantified residual — a decision-point STOP.
- §56 (swap) before §57 (Rung 2 proper): the engine change moves every
  baseline AND redefines the script portfolio — no bot recalibration or
  searcher work against a pre-swap engine. NO new human gauntlet fixtures
  recorded until §56 lands (trace replay fidelity breaks at the engine
  change — spec AMENDMENT costs).
- §57 opens with the re-ask gate (the §55-pre protocol re-run post-swap) —
  a decision-point STOP: swaps alone may close enough of the gap.
- §58 after §57 (the searcher may make the sensor a no-op).
- §59 after the behavior rungs settle; §60 after §59 (it measures at the
  expressive optimum).
- `path.port` sweeps FIRST within §60 (the transaction-starvation guard: a
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

**Decision points — ✅ DECIDED at kickoff (2026-07-13):** all four forks
locked — layer ABOVE the objective model · dumb-deterministic arbitration
(priority / null threshold / min-dwell) · state-only sensors · `src/bot/`;
triggers derived from traces (54c). **Snapshot prediction: NO bump — v34
holds.** Rationale: worklog §54.

**The cut (shape-locked 2026-07-13; audit + rationale in worklog §54):**

- [x] 54a — `src/bot/` scaffold: `TrafficScriptDriver` (trigger predicate +
  proposed command · fixed-priority arbitration · null threshold ·
  min-dwell no-thrash) + the third mutually-exclusive `HarnessOptions`
  branch; zero scripts registered; exit = byte-identical no-op parity test
  ✅ 2026-07-13 — parity/liveness/exclusion proven; no bump; worklog §54a
- [x] 54b — the sensors (`src/bot/sensors.ts`): jam index (claims +
  `vacancyEtaOf`, NOT events) · hazard reads (`statusOnEnter`) · setup-time
  choke-cell analysis · attrition differential (`survivorPower`) ·
  focus-target scoring (reuse `scored`); per-sensor tests on crafted worlds
  ✅ 2026-07-13 — five live, 19 tests, jam fallback unneeded; worklog §54b
- [x] 54c — trace mining: replay the 53g fixture, dump sensor values at
  each human command tick per traffic cell → the trigger-threshold table
  ✅ 2026-07-13 — table = BALANCE §54c (76/104 joined; engage:tile is the
  human workhorse; ⚠ isthmus choke-sensor gap → 54f); worklog §54c
- [x] 54d–54h — the five scripts, ONE COMMIT EACH, priority order:
  terrain-edge hold (the fire-edge 0.0-vs-10.7 target) · unjam (corridors +
  the labyrinth null-discipline read) · choke hold · cohesion focus ·
  attrition stall; each = script + co-located test + triggers from 54c's
  table + a spot-check of its own gauntlet cells (full re-measure at 54i)
  ✅ 2026-07-13 — all five live (+ the 54e amendment); 54h = contact gate
  + map-level hazard deferral, board byte-identical; worklog §54d–§54h
- [x] 54i — gauntlet `--arms=scripts` + the paired re-measure ✅ 2026-07-13
  — traffic-six gap closed ~81%, 7/11 at-or-better-than-human; residual =
  3 attributed cells = §55's gate input (BALANCE §54; worklog §54i)

**Exit criteria:** five scripts live behind the new bot with the anchors
byte-frozen on the old handling; drift gates green with NO gate relaxed;
any baseline re-pin deliberate and noted; the gauntlet re-measure on record
in BALANCE.md with the residual quantified.

**Scope guards:** NO rollouts (§55's domain); NO RNG in movement; the
anchors untouched; ⚠ labyrinth stays an intentional slow maze; no economy
work.

---

## Phase 55 — Rung 2: distribution generalization (RE-SCOPED 2026-07-14)

**Charter (re-scoped):** make the scripts help — or prove they can't — on
the FULL-RUN distribution. The original charter (portfolio rollout
search) is PARKED: the §55-pre probe (BALANCE §55-pre) showed scripts-on
regresses full-run win rate, per-layout-attributed — rollouts on
mis-calibrated primitives would optimize the wrong thing. Rationale +
the cutoff conversation: worklog §55.

**Why here / dependencies:** strictly after §54 — the fixes are
gate/threshold amendments to §54's scripts, driven by §54's instruments.

**Risk:** Medium — bounded by the cutoff rule below, not by ambition.

**Decision points:** ✅ DECIDED 2026-07-14 (user) — the original GATE
resolves **NOT NOW**; re-scope to this arc. **CUTOFF RULE (binding):**
fixes must be gate/threshold-shaped (the 54h cuts); an attribution that
demands a NEW script design or NEW sensor family is the cutoff bell —
stop, don't build. **DECISION RULE:** after the re-probe, scripts-on
beats scripts-off on BOTH seed sets ⇒ scripts become the balance-tester
default, rung closes GO; flat-or-negative ⇒ default stays off, the
§46a-shape NO is written (passive bot = the balance anchor; relative
reads govern), rung closes NO. ~2–3 sessions; early exit on structural
findings.

**The cut (2026-07-14; the §55-pre probe = the code-reality audit):**

- [x] 55a — hazard SEVERITY: mud ≠ fire — key the hazard reads on the
  status's damage magnitude, not the binary `isHazardKind`; target =
  fetidPond (−16.7; 74 mud cells); the gauntlet fire cells are the
  regression gate (must hold)
  ✅ 2026-07-14 — built as the STRUCTURAL barrier/toll-booth split (no
  tunable); gauntlet byte-identical; in-sample scripts-on 24.2→28.3%
  (above off 27.5); fetidPond 61.8→72.9; worklog §55a
- [x] 55b — attribution pass: desertFortress (−10.4; 8 hop-10 win→loss
  flips) + spiral-in-the-wild (−12.5 vs gauntlet-POSITIVE —
  comp/daemon/mid-run suspects) via the per-script A/B seam on flipped
  seeds; findings → worklog; fixes cut here as 55c lines
  ✅ 2026-07-14 — desert = UNJAM · spiral-wild = EDGE-HOLD (deserters);
  worklog §55b
- [x] 55c — (cut at 55b close) at most ONE gate-shaped fix per
  attributed cause; full-board gauntlet spot-check each (§54 practice)
  ✅ 2026-07-14 — 55c1 prey-in-force shipped (`3574acf`; cutoff bell rung
  on the deserters residual) · 55c2 = documented no-change (`d1a29c9`);
  worklog §55c1/§55c2
- [x] 55d — the re-probe (the §55-pre six-batch protocol, same seeds)
  → apply the DECISION RULE; BALANCE §55 + cursor flip
  ✅ 2026-07-14 — fixed-held **−14.2** fails the rule → **VERDICT NO
  (the §46a shape)**: passive stays the anchor (BALANCE §55)

**Exit criteria:** the decision rule applied with the re-probe on record
in BALANCE §55; the scripts default set accordingly; either verdict is a
valid close.

**Scope guards:** NO new scripts, NO new sensor families, NO rollout
machinery, NO RL/imitation (standing); anchors frozen; the parked rollout
charter re-opens ONLY via a future roadmap round *(→ exercised
2026-07-15: §§56–58 below — spec AMENDMENT + worklog "The §55 reopen")*.

---

## Phase 56 — Generalized swap (engine self-sorting) — INSERTED 2026-07-15

**Charter:** generalize `SwapAction` (GP5 #5, today healer-only) so units
resolve their own traffic — unjam is an engine smell, not a skill; the sim
owes the fix, for humans and bots alike (spec AMENDMENT "The swap insight").

**Why here / dependencies:** before §57 — the engine change redefines the
script portfolio and moves every baseline; recalibrating first would be
dead compute. First sim-engine change of the round.

**Risk:** **High** — a shipped-game sim change; every balance number
moves; anti-oscillation and chain-jam behavior are correctness surfaces.

**Decision points — ✅ DECIDED at kickoff (2026-07-15, worklog §56;
cascade + timing AMENDED at 56c2, user field report):** eligibility =
ROLE ORDER (melee passes ranged, never the reverse — antisymmetry IS the
anti-oscillation; the audit's in-band predicate REJECTED, user catch) ·
flee-swap adopted (partner not fleeing, not support) · cascade = wait →
swap-or-queue for role-eligible blockers → sidestep (56c2; was
swap-last) · tile-rally included · enemy symmetry YES · healer excluded
both ways · **speed-order DEFERRED to playtest** (user call — solo-dart
risk) · NO snapshot bump, v34 holds · unjam's fate = §57's re-ask input.

**The cut (shape-locked 2026-07-15; audit + rationale in worklog §56):**

- [x] 56a — the SwapAction hardening (the audit-caught bug, separable +
  first): proposer gates (incl. the healer's `blockedAlly` — a latent
  GP5 hazard) + a no-op branch in `start` for a present-but-in-flight
  partner; co-located tests ✅ 2026-07-15 — hazard was LIVE (port canary re-pinned 10→12); worklog §56a
- [x] 56b — the role-order swap probe in `stepAlongRoute`'s blocked
  branch: melee-passes-ranged (`attackRange` test), partner idle,
  last-resort placement; oscillation/chain-jam/corridor tests
  ✅ 2026-07-15 — 9 tests; gates held; 53g retired (engine era); worklog §56b
- [x] 56c — the flee-swap: the `boxed` fallback in `proposeFlee`;
  partner-not-fleeing + -not-support gates ✅ 2026-07-15 — 5 tests; worklog §56c
- [x] 56c2 — (inserted; user field report: 3 labyrinth swap bugs) the
  two-sided protocol: deferred flip (§36b twin) + pre-flip partner
  reserve + ranged YIELD + swap-before-sidestep ✅ 2026-07-15 — gates/canaries held; worklog §56c2
- [x] 56d — the FULL re-baseline: fuzz + gauntlet board + `npm run
  pathing` + PATHING.md append; drift gates predicted to HOLD un-relaxed;
  re-pins deliberate with receipts ✅ 2026-07-15 — ceiling UP every arm;
  gates held, fixtures identical → NO re-pins; BALANCE/PATHING/worklog §56d
- [x] 56e-pre — (inserted; the 56e feel test caught a mid-window re-grab)
  the partner reserve pre-flip → FULL window ✅ 2026-07-15 — worklog §56e-pre
- [x] 56e-pre2 — (inserted; 56e caught a sprite/sim desync) `unit:swapAborted`,
  the two-body settle on flip-less swap ends ✅ 2026-07-15 — worklog §56e-pre2
- [x] 56e — native verify + labyrinth spot-check ✅ 2026-07-16 — user close; full-window KEPT; worklog §56 close

**Exit criteria:** the swap rules live + co-located tests (headless-first;
oscillation + chain-jam explicit); drift/baseline gates re-derived
DELIBERATELY with receipts (never relaxed); the FULL re-baseline on
record (fuzz + gauntlet + a PATHING.md append); browser-verified
natively; the 53g fixture's fidelity break acknowledged on record.

**Scope guards:** NO RNG in movement; anchors frozen (the engine change
reaches them symmetrically; their POLICY stays old-objective-handling);
no bot/script changes (§57's re-ask input: same scripts, new engine); no
new human fixtures until this lands.

---

## Phase 57 — Rung 2 PROPER: portfolio rollout search — UN-PARKED 2026-07-15

**Charter:** portfolio greedy search, un-parked: clone via snapshot,
roll each candidate forward, score, commit the winner — null arm = the
floor, triggers demoted to nomination. The §55 NO answered static
triggers; this measures ARBITRATION (spec AMENDMENT "Why reopen").

**Why here / dependencies:** strictly after §56 (searches the post-swap
portfolio). Consumes §54's scripts, §53's instruments, §55's probe
protocol + `55pre-vector.json`.

**Risk:** **High** — the reopened core surgery; the hard part is rollout
DESIGN (horizon vs slow payoffs · evaluation noise · cadence), priced by
the 57d clone/tick micro-benchmark before the dials lock.

**Decision points ✅ DECIDED (2026-07-16, worklog §57):** scripts AS-IS
· third set `--seed-offset=10000` · unjam LOO · sensors derived-state ·
**pre-registered BINDING close rule:** default only if the searcher
beats passive on ALL THREE seed sets, else passive stays (§46a-shape
NO) · **57c v2 (user-locked):** H=8s · K=2+CRN · cadence 4s +
death/contact re-search · ε from 57g · scoring = terminal material +
end bonus + HP fractions, ties→NULL (heavy forks → the 57g box arms).

**The cut (shape-locked 2026-07-16; audit + rationale in worklog §57):**

- [x] 57a — re-ask gate 1 ✅ 2026-07-16 — OFF byte-identical (anchors
  valid); unjam LOO = dead weight; `--scripts=<spec>` = `4d93ee2`
- [x] 57b — re-ask gate 2 ✅ 2026-07-16 — third set OFF 37.5 / ON 33.3
  (BALANCE §57-gate); **user VERDICT: BUILD** (outcome c — worklog §57)
- [x] 57c — the design round ✅ 2026-07-16 — v2 shape user-locked (the
  VPS reframe: compute forks → 57g box arms); worklog §57c
- [x] 57d ✅ 2026-07-16 — seam + guard/purity/CRN pins (5 tests); bench:
  clone 0.07ms · ~94k clone-ticks/s (floor caveat — worklog §57d)
- [x] 57e ✅ 2026-07-16 — evaluator + the `nominate()` seam; 5 pins
  incl. discrimination; worklog §57e
- [x] 57f ✅ 2026-07-16 — searcher + `--searcher[=<spec>]` arm; parity/
  liveness/exclusivity; in-situ cost 4.1× (~30min/batch); worklog §57f
- [x] 57f2 ✅ 2026-07-17 — CX43 box + `box-setup.sh`; byte-identity
  5d18b270 ×3 (local/serial/jobs8); `--jobs` 3.8×; N4 verify
  unblocked; worklog §57f2
- [x] 57g-pre ✅ 2026-07-17 — `box-batch.sh` (launch/status/fetch/
  kill/run; two-sided parity guard); live-box E2E byte-identity
  1b302f84 + traces; ssh word-split caught → `642dd7d`; worklog §57g-pre
- [ ] 57g — cell spot-checks + IN-SAMPLE-ONLY iteration + the box arms:
  audition A/B ✅ 57.5% = the candidate default (BALANCE §57g.4) ·
  K-sensitivity ◀ on the box · scoring ✅ DECIDED 2026-07-18
  MEASURED-UNNECESSARY (user; BALANCE §57g.4c + worklog)
- [ ] 57h — the close re-measure under the pre-registered rule (all
  three sets) → BALANCE §57; scripts-arm default resolved; close

**Exit criteria:** the searcher ships behind the harness flag, the
clairvoyance guard proven (foresee-the-rolls), the re-measure on record
in BALANCE.md under the pre-registered rule, the default resolved.

**Scope guards:** clairvoyance guard NON-NEGOTIABLE; anchors frozen; NO
RL/imitation or raw action-space search; derived reads only for anything
rolled out; DEV-only — zero shipped-game change; player-team searcher
ONLY (the enemy stays engine-driven).

---

## Phase 58 — The derived threat read (deserters) — INSERTED 2026-07-15

**Charter:** the deserters residual (55c1's cutoff bell) rebuilt as
reachability math on derived state — a fleer that cannot reach or damage
within N ticks is neither prey nor threat, so advance — NOT behavioral
intent detection (spec AMENDMENT "The deserters correction").
Snapshot-computable, therefore rollout-compatible.

**Why here / dependencies:** after §57 — the searcher may arbitrate
hold-vs-advance directly and make the sensor a NO-OP; that exit is legal
and cheap. Reads 55b's forced-spiral isolate as its regression fixture.

**Risk:** **Low-Medium** — one sensor + gauntlet/isolate verification; may
legitimately not build.

**Decision points:** the no-op check first (does §57's searcher already
clear the spiral-deserters isolate?); if built, threshold N from trace
data not intuition; landing surface if no-op'd — user-facing threat tell
(UI) or TODO park (user call).

**Exit criteria:** the spiral-deserters isolate number on record either
way; the residual's ledger entry updated (built / searcher-ate-it /
parked-with-pointer).

**Scope guards:** derived reads only; no new script families; the
attrition-stall map-wide deferral stays untouched.

---

## Phase 59 — The expressive economy strategy layer

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
against a moving bot is dead compute; before §60, which measures at this
optimum.

**Risk:** **Medium** — harness/strategy surface only, no shipped-game
change; the search compute budget is the main unknown.

**Decision points:** the exact scorer dim lists (kickoff); refinement K +
search budget.

**Exit criteria:** a fresh `--search` converges with the economy dims
live; packets fire in harness runs (outcome-inertness gone); the
fixed-vector probe re-run on record in BALANCE.md.

**Scope guards:** ONE scored vector — no second optimizer; the fixed
policies survive as anchors; no price/config tuning yet (§60's domain).

---

## Phase 60 — The REAL balance pass + close-out

**Charter:** the deferred Cluster-3 tuning agenda at the realistic optimum,
measured with the §52 economy metric family (bits-per-hop · spend mix +
terminal bank · transaction rate, strategy-tier discipline): **re-anchor
the design targets** off the measured optimum; **the boss-wall rider
verdict** (the 43–55% target, re-derived against a real ceiling); sweep
prices · `bitsMultiplier` · packet drop weights · `path.port` · the fire
arm — `path.port` FIRST (the transaction-starvation guard). Then the round
close: cursor flip, memory update, archive-ritual note, and the Cluster-4
kickoff proposal.

**Why here / dependencies:** last by the closer convention; consumes §59's
vector and the stable bot — now two realism rungs better than the §52
finding assumed.

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
- **The §49 shrink-flow content lands ONLY via §60's decision point** —
  otherwise it keeps waiting (worklog §50g watch item).

## Open decisions to resolve when building (the cross-cutting set)

- 53: the gauntlet cell list; the command-stamp seam.
- 54: **script ↔ objective-model integration + arbitration** (the spec's
  big ⚠ OPEN — a design round at kickoff).
- 55: **the gate threshold** (set from §54's numbers — a stop). ✅ resolved
  by the 2026-07-14 re-scope + the 2026-07-15 reopen (spec AMENDMENT).
- 56: **the swap-eligibility rule** (design round — a shape-lock);
  anti-oscillation; the labyrinth doctrine re-check; unjam's fate.
- 57: **the re-ask gate** (a STOP); rollout horizon/scoring/cadence/K; the
  sensor audit; the pre-registered decision rule.
- 58: the no-op check; threshold-from-traces; the landing surface if
  no-op'd.
- 59: scorer dim lists; refinement K + budget.
- 60: the re-anchored targets; per-lever tune-vs-accept; the shrink-flow
  slot.
