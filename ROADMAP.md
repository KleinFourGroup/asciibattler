# ROADMAP — Round 6 (Instruments), Phases 84–88

The round's PLAN (it stays a plan for its whole life). The macro order
and this round's charter are in [META-ROADMAP.md](META-ROADMAP.md)
§Round 6; the signed design record is [round-6-spec.md](round-6-spec.md)
§Kickoff resolutions; findings + rationale land in [WORKLOG.md](WORKLOG.md);
live status is HANDOFF's 🧭 Cursor. Sub-steps are cut at each phase
kickoff (AGENTS "The planning stack"), never here.

**Status: SPEC LOCKED 2026-08-22** (the skeleton's §84–87 re-cut to
§84–88 — the measurement instrument became a regular phase, the
`--grant` cohort was retired as the prior's source; WORKLOG §Kickoff).
Sub-steps for §84 are cut at its kickoff.

**Ordering in one breath:** the instrument first (the fold consumes
its table); the fold second (every board run on the pre-fold arm
measures a soon-superseded doctrine — principle #5); perf third
(profile-first, byte-identical, nothing downstream leans on it);
roster realism fourth (re-reads the X3 bands on the fold's arm); the
rarity read last (it consumes §84's unit rows; box time only for the
thin rows); ONE sheet amendment at the close (pre-registered at 83f).

## Phase 84 — The long-horizon shadow instrument

Generalize the §71c shadow (`shadowTier`) to a run-end horizon on the
ACQUISITION sites (`rewardDaemon` · `portBuy` · `eventChoice` · a new
shadow-only `recruit` site), deterministically sampled 1-in-m, on its
own instrument arm; the per-item aggregate gains a per-remaining-hop
margin; the first instrument batch on the box; the `--grant` bridge
(~3 items) validates the cheap walker's magnitudes; the table lands
as a committed artifact with provenance. Live decisions byte-identical
shadow on/off (pinned). **Risk:** medium (new site + a long walk on
the driver's CRN contract). **Decision points:** `m` and the shadow K
(cost-tuned); whether value reads ~linear in hops remaining; the
bridge verdict. **Exit:** the table committed with every acquisition
item that clears n=80 from natural play, the bridge read logged, the
thin-row list named for §88.

**Cut (shape-locked, user-signed 2026-08-22 — WORKLOG §84 kickoff):**
separate long-horizon log records with a horizon marker (live records
byte-identical) · hops remaining = shortest remaining DAG path (moot on
the shipped linear map) · shadow K = the primary's 2, `m` from the 84d
probe. Predictions: World v35 / Run v44 hold (the getter is derived);
decisions.csv append-last; fuzz:smoke additive.

- [x] **84a** ✅ 2026-08-22 — `shadowHorizon: { horizonBattles, sample }`
      on the driver (no `k` — a different shadow K would draw extra
      pairs and perturb the stream); a separate record with `horizon`;
      7 new pins incl. a real run-end walk. `hopsRemaining` lands with
      84b's getter. Detail: git.
- [x] **84b** ✅ 2026-08-22 — `Run.hopsRemaining` + the pure
      `remainingSectorHops` (shortest DAG path); 11 pins incl. the
      walker-driven post-seam read. No bump (held). ⚠ Finding: clones
      drop BOTH run-shape dials (`Run.fromJSON`) — a run-end shadow is
      unbounded whatever the batch dial → 84c refuses `--shadow-horizon`
      with `--hops`/`--sector-hops` (WORKLOG §84b).
- [x] **84c** ✅ 2026-08-22 — `shadowDecide` (shadow-only sites on their
      own `siteRng`; null = an EXPLICIT pass) + the `recruit` site + the
      flags with the 84b refusal + `horizon`/`hopsRemaining` append-last
      (pre-84 sidecars still parse) + the horizon-keyed aggregate with
      Δ/hop; 17 new pins; the one-seed smoke wrote the columns (WORKLOG
      §84c — the cost read). Detail: git.
- [ ] **84d** — the local cost probe (pick `m`) → one box queue at ONE
      HEAD: the n=80 shadow batch + the bridge (control + `--grant` ×
      {a daemon, a packet, an archetype} at n=80).
- [ ] **84e** — `npm run prior:table` → `tests/fuzz/board/prior-table.json`
      (value per remaining hop · n · provenance); the bridge read + the
      thin-row list → BALANCE + WORKLOG §84.

## Phase 85 — The fold + the ε re-read + the two riders

`scoreTerminal` gains `priorBonus = λ_prior × Σ table[item] ×
hopsRemaining` over the holdings delta (daemons · cache packets ·
roster units); λ_prior a board arm swept {0, 0.5, 1}, 0 byte-identical;
the breakdown + decisions.csv column. The ε floors re-derive post-fold
with an event-page context added to `readEpsilonAA`. Riders: the
campRaid RUN-LAYER preTurn decision site (seeds the camp objective;
the 83e forced-engagement probe is its baseline) and the 55pre vector
re-derive (a post-fold `--search`, new fixture). **Risk:** medium-high
(changes the doctrine arm — every arb board row moves). **Decision
points:** λ_prior's signed default (at the amendment); the campRaid
layer re-opens only if it literally never gets picked. **Exit:** the
paired pre/post-fold read; the boon event's three rows separate;
floors re-pinned; the nominator auditioning; the 55pre twin on its
re-derived anchor (`pre55ReachRef` retired or re-pinned).

_(Sub-steps cut at phase kickoff.)_

## Phase 86 — The balancer performance pass

Profile-first (none ever taken): split per-seed cost between outer
battles and rollouts, then `World.tick` itself. Expected levers are
tick-level (pathfinding scratch · `livingUnits` filters · Map churn ·
the pooling TODO with airtight reset discipline); the clone is
measured negligible and K=2 has nothing to halve. Byte-identity oracle
mandatory (the 47e worktree-pinned diff: summary.csv + decisions.csv
sha across arms); a lever that flips a decision is a doctrine change
for the user, not a speedup. **Risk:** medium (the hot loop).
**Exit:** a measured per-seed speedup with byte-identical outputs — or
a documented no-op with the profile on record.

_(Sub-steps cut at phase kickoff.)_

## Phase 87 — Roster realism for isolation reads

`playerArchetypes` captured beside `playerLevels` on `BattleResult`; a
committed per-hop roster table with provenance; `--roster=sampled:<hop>`
draws a WHOLE recorded roster row harness-side (no Run stream change);
the X3 isolation cohort re-runs under it on the fold's arm. **Risk:**
low-medium. **Exit:** the sampled mode on the default arm; the
per-kind bands dispositioned hold / re-pin / defect.

_(Sub-steps cut at phase kickoff.)_

## Phase 88 — The rarity read + the round close

Read §84's recruit-site rows per draftable archetype against the
5/3/3/2 tiers and `unitPriceFor`; targeted `--grant` paired arms at
n=80 for the thin rows only; tiers + prices dispositioned per
archetype; the protocol written down as standing for every new
archetype from Round 9 on. Then the close ritual: the ONE sheet
amendment (signed at the post-fold arm, λ_prior's default included),
the scratchpad sweep, the HANDOFF demotion, the META-ROADMAP ✅.
**Exit:** every draftable archetype dispositioned; the amended sheet
signed; Round 7 (Idioms) is NEXT.

_(Sub-steps cut at phase kickoff.)_
