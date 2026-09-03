# Scratchpad — rolling notes on process, decisions, gotchas

Running notebook of "things worth talking about" — drop short observations here
as you build. **Swept at every round/cluster boundary** by the distillation
ritual (AGENTS.md §"The planning stack"): each entry gets **promoted** (to
AGENTS / GOTCHAS / TESTING / TODO) or **archived** with the round's docs, so
this file holds only undistilled observations from the current round. Keep
entries short; link commits; group by theme.

Prior eras: the MVP→H7 backlog was swept 2026-07-06 (the ritual's first run) →
[archive/retro-scratchpad-mvp-to-h7.md](../archive/retro-scratchpad-mvp-to-h7.md);
the process-audit + Cluster-3 backlog was swept 2026-07-11 (the second run, at
the micro-round kickoff) →
[archive/retro-scratchpad-cluster-3.md](../archive/retro-scratchpad-cluster-3.md);
the micro-round backlog was swept 2026-07-21 (the third run, at the Cluster-4
kickoff) →
[archive/retro-scratchpad-micro-round.md](../archive/retro-scratchpad-micro-round.md);
the Cluster-4 backlog was swept 2026-07-29 (the fourth run, at the 68h round
close) →
[archive/retro-scratchpad-cluster-4.md](../archive/retro-scratchpad-cluster-4.md);
the rollout-arbitration-interstitial backlog was swept 2026-08-04 (the fifth
run, at the 72f round close) →
[archive/retro-scratchpad-rollout-arbitration.md](../archive/retro-scratchpad-rollout-arbitration.md);
the Cluster-5 backlog was swept 2026-08-21 (the sixth run, at the §83g
cluster close) →
[archive/retro-scratchpad-cluster-5.md](../archive/retro-scratchpad-cluster-5.md);
the Round-6 (Instruments) backlog was swept 2026-09-02 (the seventh run, at
the 88e round close — promoted: six norms to AGENTS [the macro-plan code
audit · count-the-shape-before-timing + profile-between-levers · the
paired-bench warm-leg/subshell rule · verify-the-tree-died after any kill +
no `pgrep` in Git Bash · poll scales to batch size · adversarial review +
a read-only verifying peer], one caveat to BALANCE [exact zeros = an
instrument smell]) →
[archive/retro-scratchpad-round-6.md](../archive/retro-scratchpad-round-6.md);
the MVP-era entries had earlier fed [post-mvp-review.md](post-mvp-review.md).

---

_(The post-Round-6 entries start here — the §89 interstitial.)_

## §91 build session (2026-09-03) — process notes

- **Review BEFORE the sign, not after.** Running the adversarial review
  against the DRAFT cut (before shape-lock) meant the user signed a
  reviewed cut in one turn; the review found the mutual-wipe/cap conflation
  and the rollback-order defect that would otherwise have been built in.
  Cost ≈ 18 min wall, ~370k subagent tokens, two Fable instances
  (reviewer + read-only file:line verifier).
- **The tree is CRLF on disk (git normalizes).** Any script that anchors on
  multi-line text must normalize `
` first — the first 91a1 edit matched
  nothing. Shell-quoting a multi-line JS string is the other trap (apostrophes
  in prose): scripts in files, not `node -e`, for anything with prose.
- **The Browser pane hidden ⇒ no animation frames ⇒ the battle clock stops.**
  A preview battle that “stalls” while tools run is that, not a sim bug;
  drain a queued world command with one manual `world.tick()` +
  `battleRenderer.update()` when probing (91-pre2b).
- **A signed render rule got re-opened by a playtest report** (79d2 → 91-pre2):
  the record said “not a bug”, the user said “I misread what I signed”. The
  right move was to bring the record back with the options, not to re-decide
  silently in either direction.
- **The worktree diff oracle at n=20 took ~4 min for both legs in parallel** —
  cheap enough to be the default exit criterion for any byte-identity claim,
  not a special occasion.
