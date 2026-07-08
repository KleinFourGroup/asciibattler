# Scratchpad — rolling notes on process, decisions, gotchas

Running notebook of "things worth talking about" — drop short observations here
as you build. **Swept at every round/cluster boundary** by the distillation
ritual (AGENTS.md §"The planning stack"): each entry gets **promoted** (to
AGENTS / GOTCHAS / TESTING / TODO) or **archived** with the round's docs, so
this file holds only undistilled observations from the current round. Keep
entries short; link commits; group by theme.

Prior eras: the MVP→H7 backlog was swept 2026-07-06 (the ritual's first run) →
[archive/retro-scratchpad-mvp-to-h7.md](../archive/retro-scratchpad-mvp-to-h7.md);
the MVP-era entries had earlier fed [post-mvp-review.md](post-mvp-review.md).

---

## The process-audit round (2026-07-06)

- **An instruction doc nobody's tooling reads is write-only.** AGENTS.md's
  status blurb sat stale at "Phase H in progress" for a month because Claude
  Code auto-loads CLAUDE.md, never AGENTS.md — every session politely ignored
  the file that thought it was the front door. Fixed with the CLAUDE.md
  `@AGENTS.md` pointer + a docs.test guard on the import line. Generalizes:
  when adding an "always read this" doc, verify the tooling actually loads it
  before trusting it.
- **Demotion passes double as staleness audits.** Collapsing TODO.md's
  completed items surfaced three items marked OPEN that had shipped weeks
  earlier (favicon, vendor-chunk split, `--seed-offset`) — the file's length
  was hiding its own rot. A log-shaped queue lies in both directions.

## The Cluster-3 kickoff (2026-07-07)

- **Survey the code BEFORE the design conversation, not during.** The
  kickoff's blind-spot pass ran a full code-reality survey of every surface
  the draft spec touched *before* any design fork was discussed — and the
  survey's keystone finding (daemons had NO effect system; the spec's whole
  daemon⇄consumable premise was unbuilt) reshaped the cluster's phase
  structure. Every subsequent design question could then be posed with its
  real engineering cost attached ("mid-battle casting = the first player→sim
  input channel"), which is what made the user's calls fast and confident.
  The planning stack mandates auditing the roadmap against the spec; this
  adds: audit the SPEC against the code first (`b966187`).
- **Batched decision forks beat one-at-a-time.** Presenting 2–4 related
  design forks per round (with a recommendation + honest tradeoffs each)
  kept the spec conversation to ~4 rounds total without ever deciding FOR
  the user. The forks that needed free-form discussion (naming) got prose
  instead — choosing the right mode per question mattered.
- **First full planning-stack kickoff ran clean end-to-end** (spec-first →
  shape-lock → plan-shaped roadmap + guard + fresh worklog, `4fef643`) —
  including its first live insertion at shape-lock (the user's §51 UI/UX
  review). No protocol friction to report; the plan-shape guard caps
  (450/60) were set from measured authored size, the existing tests'
  headroom convention.

## Phase 47 build, steps a–d (2026-07-07)

- **The live before/after fuzz-arm diff is the cheapest strong oracle for
  behavior-equivalence refactors.** Capture per-arm `summary.csv` baselines
  at HEAD *before* the surgery (6 arms × `--count=6`, ~2 min), re-run after,
  `diff` — byte-identity across arms proved both 47c (gates→rules) and 47d
  (single→multi daemon) changed nothing for existing content, catching what
  live-vs-live suites structurally can't (they recompute both sides on the
  NEW code). Worth making a habit for any "re-author X, behavior must hold"
  step (`73c88b0`, `c8129d3`).
- **AskUserQuestion dialogs hide same-turn assistant text in the desktop
  app** — a shape-lock proposal presented in the same turn as the question
  dialog is invisible to the user (bit twice at the 47 kickoff). Present
  the proposal as a plain final message, collect the approval next turn.
- **Deferring cosmetic polish past a known redesign is a scope call worth
  making explicit.** The 47d badge-tooltip nit (joined idol summaries) was
  sized (~1 commit, 3 payloads), then deliberately parked for §51 because
  §49's fire-UX round will likely rework the whole badge surface — polish
  before a redesign is throwaway. The sizing conversation itself is what
  made the parking decision easy for the user to co-sign.

## Phase 47 build, steps e–g (2026-07-08)

- **Never background a "before" capture and keep editing — pin it in a
  worktree.** The 47e pre-baseline fuzz capture was launched in the
  background against the LIVE tree (the CLI compiles imports at run time),
  then the engine edits landed underneath it: arms 3–6 crashed mid-capture
  and even the "successful" early arms were untrustworthy. The fix that
  holds: `git worktree add --detach <tmp> HEAD` + a `node_modules`
  junction/symlink — a frozen checkout the oracle reads while the working
  tree stays fully editable. Zero risk, ~zero setup cost; used cleanly for
  both the 47e and 47f oracles. Candidate for promotion into the AGENTS
  oracle habit (the 47a–d entry above) at the round sweep.
- **The step-zero premise check keeps paying**: 47f's survey caught two
  unpredicted side effects BEFORE the build (battleRules riding the
  serialized `currentEncounter` ⇒ a Run bump the cut hadn't listed; the
  statusSchema `statMods` deferral coming due) — both became plan-mutation
  one-liners instead of mid-build surprises. Also caught: a 47b test whose
  "vacuously passes" premise the new content invalidated.

## First fresh-session resumption under the planning stack (2026-07-08, into 47e)

- **The protocol's first cold pickup worked**: HANDOFF 🧭 Cursor → ROADMAP §47
  → WORKLOG §47 → code, ~8 reads to a confident build plan, no conflicting
  statuses anywhere. Each doc paid off with DISTINCT content (the routing
  table doing its job): the Cursor gave the step + scope in read #1, the
  roadmap gave locked decisions + scope guards, the worklog gave the why.
- **The single highest-value orientation artifact was a deferral note**: the
  47c worklog "engine notes" paragraph ("non-grant turnStart ops are
  deliberately NOT resolved in the grant fold — they execute at the fire site
  (bits 47e)") + the matching code comment in daemon.ts. Without it, a fresh
  session would plausibly have designed a second hook walk that DOUBLE-DRAWS
  the chance flip and broken byte-parity. Worth promoting as a norm: **when a
  step deliberately defers work to a later step, write the landing note (what
  was left, where it lands, what invariant the landing must preserve) in the
  deferring step's worklog entry AND a code comment at the seam.**
- **Residual triangulation cost**: 47e's exact boundary (does healPool ride?
  does the encounterEnd fire site land here?) had to be inferred across three
  artifacts rather than read from one. Cheap to fix at phase kickoff: when a
  cut step's one-liner names an op/mechanism, spell out the edge cases it
  owns vs. defers.
- **Content-landing side effects are invisible at shape-lock**: "example
  daemon #3 authored + tested" didn't decide WHERE it lands, and catalog
  membership turned out to carry two real consequences (run-start roll
  dilution — a 1-in-5 chance of a no-pre-turn-tools run — and a
  `--daemon=random` fuzz re-baseline). Resolved live (user: in the catalog).
  Note for future cuts: "author content X" should say catalog vs. fixture.
