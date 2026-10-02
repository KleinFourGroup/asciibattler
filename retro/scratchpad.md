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
the Round-7.5 (The Board, §105–§109) backlog was swept 2026-09-27 (the
tenth run, at the Round 7.5 close — promoted: the step-zero nuance and the
narrowed Shell rule to AGENTS, four `process/` lines, a TODO guard, and the
pane probe kit into Round 8's charter) →
[archive/retro-scratchpad-round-7.5.md](../archive/retro-scratchpad-round-7.5.md);
the MVP-era entries had earlier fed [post-mvp-review.md](post-mvp-review.md).

---

_(The post-§109 entries start here — Round 8, Foundations.)_

- **2026-09-30, §111e (session 01995ce0): a second detector is not an
  independent reader when it shares the first one's mapping.** The
  analyzer's new onset detector read the planted tone 26 ms late; the old
  Goertzel detector agreed at 20, which looked like confirmation of a
  chain delay. Both converted a cue's time to a sample index the same way,
  so the agreement was self-consistency. A synthetic click built at a
  known time, pushed through the recorder's own mux and decoded by the
  analyzer, found the real cause (an AAC priming frame, 21 ms). Candidate
  line for `process/oracles.md`: when two instruments agree, list what
  they share before counting the agreement as a second reading.
- **2026-09-30, §111c: reconcile a planted control site by site, not by
  totals.** The drop control's totals disagreed (main 30 or 44 dropped,
  the file 10 or 20 missing); a per-site table accounted for every drop and
  exposed the analyzer's blind spot (frames lost before the first visible
  count read as clean). The totals alone invited a story ("the rest were in
  ffmpeg's start-up") that was only half true.
- **2026-10-02, the §115 kickoff: a mod could give the agent its own
  context reading.** The user asked whether Claude Code's mods can expose
  the session's context to the agent. From this build's API declarations
  (Claude Code 2.1.286; nothing was built or run): a hooks module can call
  `$.session.usage()`, which returns the live window's `tokens`, `window`
  and `percent` as the status line has them, and `$.tool.register` declares
  a tool the model can call. A tool that returns those figures would let a
  session read its own meter at each step's commit and write the reading
  into the WORKLOG. That would put a measurement where the breaker's wall
  clock now stands in for one, and take the gate's reading without asking.
  Before any rule rests on it (`process/oracles.md`): the tool's number
  against the user's meter at the same moment, at two readings far apart;
  what it reads just after a compaction or a resume (the declaration says
  the figures are absent until the live window's first response); and how
  the mod loads in every session under the desktop app, since the
  hot-reload switch is per session and the person's to answer. AGENTS says
  the agent can't read its own context use; that sentence changes only
  after the check.
- **2026-10-02, the same exchange: what the user would do with it.** If the
  tool's figure holds, one rule in place of the asks: at the start of each
  step, read the context, and hand off if it is near the halt (600k). The
  user's word for what this retires was "the pre-commit", and asked, they
  meant the 350k number, the gate (not the pre-commit hook; the breaker
  was not named). They also want that number renamed: in the same message
  they called it "the 350k cap", the reading the 2026-10-01 restatement
  was written against, so the name "gate" is not carrying its meaning. If
  the per-step check lands, the number may retire and the name with it.
  Two notes for whoever writes the rule. A step started just under
  the halt ends over it, so the line to check against is the halt less one
  step's cost, and the per-step readings the tool would log are what
  measure that cost (none exists yet: the readings so far are per stretch).
  And the gate today decides where a stretch of several steps starts, so a
  per-step check means a hand-off can fall between two `none` steps in
  mid-stretch, which costs the next session an orientation.
- **2026-10-02, session 0d584e89: the mod, built and run in this
  session.** The user agreed to the direction and to two additions: the
  reading piggybacks on every `git commit` (a `tool.call` hook on Bash and
  PowerShell adds it as context and as a transcript line), and the mod
  lives in the repo at `.claude/skills/context-meter/`. Run under hot
  reload in this session: the tool answered, and a `git commit --dry-run`
  came back carrying `context: 147039 tokens of 1000000 (15%) at
  2026-10-02T22:47:57Z`. The first three calls failed because I passed
  `$.clock.now()`, which returns a Promise, to `new Date` without awaiting
  it; the hook threw and was skipped, and the engine's message pointed at a
  missing `tool.call` hook instead, which sent me after the matcher first.
  `claude plugin validate` passed a copy with that bug planted, and `tsc`
  against the engine's generated types failed it (TS2769), so `tsc` is the
  check. Still open: a reading paired with the user's meter at the same
  moment (the user's 118k was taken at their message, before this turn's
  tool results); a second pair far from the first; a reading after a
  compaction or resume; and whether a fresh session under the desktop app
  loads the mod from the project's `.claude/skills/`, which the reference
  documents and nothing here has yet shown.
- **2026-10-02, later: the repo copy does not load, because the workspace
  counts as untrusted.** The calibration pair held: the tool read 159,886,
  and the user's meter read 160k just after. Then the user restarted the app
  (this session resumed), and the repo copy did not load. A fresh session
  (local_5432b355, "Context meter diagnostics") found it did not load there
  either, and found why. The bundled CLI's `claude plugin list`, run in the
  repo, says one directory under `./.claude/skills/` was skipped because the
  workspace was not trusted when plugins were scanned. `~/.claude.json`
  holds two entries for the repo: the backslash key has
  `hasTrustDialogAccepted` true, and the forward-slash key has false. In
  four arms on scratch copies of that file (`CLAUDE_CONFIG_DIR`, the real
  file only read), only the forward-slash key decided the skip. I confirmed
  the warning and both flags read-only. That a desktop session reads the
  same key as the CLI is an inference (same build, same cwd). The engine
  writes `.claude-plugin/types/` beside a mod each time it loads it, so that
  folder's absence beside the repo copy shows no load has reached it. Still
  open: whether, once the workspace is trusted, a desktop session runs the
  module's function hooks without the hot-reload consent or an env switch.
  Trusting the workspace is the user's to do.
