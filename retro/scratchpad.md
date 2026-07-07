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
