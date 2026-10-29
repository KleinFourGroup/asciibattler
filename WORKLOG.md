# WORKLOG — Round 9 (The frame and the misses)

Per-phase narrative log (AGENTS "The planning stack"; `process/planning.md`
"The artifacts"): findings, decision rationale, rejected alternatives,
scope changes, playtest verdicts and the checks run land here under the
matching `## Phase N`; the ROADMAP stays a plan. The file holds the phase
in progress: at each phase close it moves to `archive/worklog-phase-N.md`
and a fresh one starts. Round 9's earlier phases:
[archive/worklog-phase-135.md](archive/worklog-phase-135.md) (the kickoff,
§134, with the spec's answers and the charter's premises at HEAD; and
§135, the board's instruments),
[archive/worklog-phase-136.md](archive/worklog-phase-136.md) (§136, the
trial's switch and arms; at its close the trial rolled back and the round
re-cut) and
[archive/worklog-phase-137.md](archive/worklog-phase-137.md) (§137, every
strike lands, headless; at its close, the stdin guard and the pre-commit
hook checking the commit itself).

## Phase 138 — the screen after the misses

The rule this phase dresses landed at 137c (`d50e23f1`): every strike
lands, and precision, evasion and `accuracy` are gone, with the screen's
references taken out as plain removals. What §137 left for this phase,
and what it did not verify on screen: `archive/worklog-phase-137.md`,
"§137's close, put to the user".

### The friction log's third kind (2026-10-28, before the kickoff, session ee3f6da8)

The user opened a process review from 137d's last papercut, the hook
spike that damaged the checkout's git state: a mistake, and more severe
than a papercut as they meant the word, small issues with the setup or
the tooling that made the work harder, to be passed through and fixed.

- *The incident's reach.* `.git/config` (one `core.worktree` setting)
  and `.git/index`; no file on disk and no commit. Between it and worse:
  the test's commit failed on our hook, and its next command, `git
  checkout -- README.md` (`tests/build-id.test.ts:67`), never ran. A
  search of `tests/`, `scripts/`, `tools/` and the hook for git verbs
  that write a working tree found only that line. The session reported
  the damage in its closing message (transcript `fc66283a`).
- *Why the log drifted.* The Round 7 definition, "any point of
  friction", listed "a wasted round-trip", and §132's "A known trap met
  again takes one line", meant as a permission to be brief, read as a
  duty. By this session's reading (one reader's labels, not a measure):
  in an evenly spaced sample of the whole log, about half the papercut
  entries were friction from the setup; of the 23 since §132, three or
  four were, about 17 were the filer's own mistakes, and about ten opened
  "known trap met again".
- *"A wasted round-trip."* Unexplained at its adoption (`e09145b9`); the
  entries that use it mostly mean one tool call, some an exchange with
  the user. Either way it names a cost, not a source.

**Signed** (the user, 2026-10-28): `slip` as a third kind, in their
words "something you could have done differently knowing only what you
knew then"; `--kind` required; the known-trap line a permission to be
brief, for either kind; "a wasted round-trip" dropped. Built: AGENTS'
filing text; `scripts/papercut.mjs`, its types and tests (a filing with
no kind is refused; control, HEAD's filer fails three of the five);
`process/welfare-and-efficacy.md`, "Filing", "Who reads" and the wording
row. The phase and round closes read "the friction lines" without naming
a kind, and the round close's rule test ("a slip it was written against
stopped") already reads slips, so neither changed.

**Not built: a severity flag.** A scale would rate inconsistently the
case it exists for (a small cost beside a large risk), cannot apply to
`distress`, whose name sets no threshold, and reaches the user later
than a closing message does; there has been one incident in 372 entries.
The user likes a yes/no `--incident` with a concrete test (damaged, or
put at risk, something outside the step's own work: the checkout's git
state, pushed history, the box, the user's files) as the candidate if
the evidence comes.
