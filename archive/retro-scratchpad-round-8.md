# Retro scratchpad — Round 8 (Foundations, §110–§118), archived

Swept 2026-10-11 at the Round 8 close (the eleventh run), with the
round's 98 papercuts; the triage and the user's signature are in
[post-109-worklog.md](post-109-worklog.md), "118j — the round close", C5.
The entries below are as they stood in `retro/scratchpad.md`.

**Promoted from these entries:**

- §111e, two detectors sharing a mapping → `process/oracles.md` ("When two
  instruments agree, list what they share").
- §111c, the drop control → `process/oracles.md` ("Reconcile a planted
  control site by site").
- 116h, new pins checked by planting → TESTING.md, the patterns list.
- 116k, a pre-registered stop that named a proxy → `process/planning.md`,
  the kickoff's predictions.

**Archived with no promotion:** the four context-meter entries (their
record is the worklog's "The context rule, replaced" and CLAUDE.md "The
context meter"), and 116k's stylesheet overlay (DESIGN "Layout stability",
applied across a driven run).

---

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
  same key as the CLI is an inference (same build, same cwd). The user set
  the flag by hand, and after a relaunch the repo copy loaded (the tool
  read 209,563). I had offered the absence of `.claude-plugin/types/`
  beside the repo copy as proof that no load reached it, and that was
  wrong: the repo copy loaded and no such folder appeared. The engine
  writes it beside a hot-reload mod, not a skills-folder one. Still open:
  whether a session that never answered the hot-reload question runs the
  mod. The rule this enables, and the rest of the record, are in WORKLOG
  §115 "The context rule, replaced".
- **2026-10-07, 116h: new pins that pass on their first run, checked by
  planting.** Twenty-one tests for new store code passed the first time
  they ran, which says little about whether they can fail. A scratch
  script took a list of `{ file, from, to, test }`, and for each one
  replaced the text (refusing an anchor found zero or two times), ran that
  test file with Vitest's JSON reporter, listed the tests that failed, and
  put the file back in a `finally`; the clean tree ran last as the control.
  Fifteen changes, each removing one rule, were each caught, one by a test
  not aimed at it. About ten minutes and one file. It is the same idea as
  an oracle's failing control (`process/oracles.md`), applied to a batch
  of ordinary unit tests; whether it belongs there is for the sweep.
- **2026-10-07, 116k: a pre-registered stop named a proxy.** The cut said
  "if the count is large, the range comes back to the user". Step zero
  found a small count and a limit the line had not named (the window), so
  the stop's condition was not met and the decision it stood for was still
  there. A cut line that pre-registers a stop could name the decision
  ("which sizes are offered goes back to the user with the measurement")
  and leave the measurement to say why. Whether that belongs in
  `process/planning.md` is for the sweep.
- **2026-10-07, 116k: a stylesheet change measured as an overlay first.**
  Both candidates for the sweep were laid over the page as a `<style>`
  by the survey script and measured at every size before `ui.css` was
  touched, and the sheet was edited once, to the arm that was built. The
  same report shape then held the edited sheet against the one before it,
  box by box. It is the same-run toggle (DESIGN "Layout stability") run
  across a whole driven run.
