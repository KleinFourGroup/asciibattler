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
