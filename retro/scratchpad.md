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
the casualty-experiment (§89–§94) backlog was swept 2026-09-08 (the eighth
run, at the §94i close — promoted: five norms to AGENTS [the worktree build
under a cohort · Write/Edit for quote-bearing text · self-check a reader +
pool by script · pre-sign the chain · a knob pin through the resolver + the
first live read of an inert-by-design mechanism]) →
[archive/retro-scratchpad-casualty-experiment.md](../archive/retro-scratchpad-casualty-experiment.md);
the Round-7 (Idioms, §95–§104) backlog was swept 2026-09-20 (the ninth run,
at the Round 7 close — promoted: ten AGENTS amendments, gotchas #137–#138,
one TESTING pattern, five HANDOFF pane tips, six TODO riders, and the
docs-cap off-by-one; the same close's welfare read added the standing
decisions and "Reads are cut, not improvised") →
[archive/retro-scratchpad-round-7.md](../archive/retro-scratchpad-round-7.md);
the MVP-era entries had earlier fed [post-mvp-review.md](post-mvp-review.md).

---

---

_(The post-§104 entries start here — Round 7.5, The Board.)_

- **Step zero that widens an approved fix: build and flag, judged appropriate** (2026-09-23, 106d riders, `0970be0`). The user approved "let the chip row wrap"; step zero measured a single long chip overflowing too, so the session added two CSS rules inside the same intent (labels kept, chips fit) and flagged them in its report instead of asking first. AGENTS says to take a step-zero change to a signed cut to the user before building. The user, asked in the session report: "your bending the rule was appropriate". A candidate nuance for the round-close sweep: a change that stays inside the approved intent can be built and flagged; one that changes the intent goes back first.

- **The Shell rule keeps breaking at "append to an existing file"** (2026-09-23, the §106-close `printf`; 2026-09-24, two heredocs in §107). Each carried backticks, landed intact, and was noticed after it ran. The trigger is the same every time: Write replaces a file and Edit needs an anchor, so an append reaches for the shell. Candidates for the sweep: a documented append route (a small node script written with Write, or Edit anchored on the file's last line), or a guard on the path, such as a PreToolUse hook that stops a Bash heredoc or `printf` whose body contains a backtick. AGENTS: "Put the guard on the path where the mistake happens".
- **A same-page shader A/B in the pane** (107d-post, WORKLOG): swap `material.vertexShader` with the change cut out, on both sprite materials, set `needsUpdate`, call `renderTwoPass()`, then `gl.readPixels` in the same task, with a standing unit as the pixel-identical control. A candidate for [process/browser-pane.md](../process/browser-pane.md).
