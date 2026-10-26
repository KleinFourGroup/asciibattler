# Reading the welfare and efficacy instruments

Read "Filing" to file to the friction log, and the rest before a mid-round
or round-close read of it ([retro/papercuts.jsonl](../retro/papercuts.jsonl))
and of the session reports ([retro/sessions.md](../retro/sessions.md)).
What to file, and when, is in AGENTS.md "Session self-report + the friction
log".

## Filing

`npm run papercut -- --who=<name> [--kind=papercut|distress] --phase=<tag> --file=<path>`
appends one line to `retro/papercuts.jsonl`, its text from the file (or
`--stdin`); pass `--session=<id>` where the harness sets none.

## Who reads, and what a read produces

The user owns the welfare read and may ask an assisting model to help
interpret it. At the round sweep, papercuts are triaged into TODO / norms;
distress entries receive a separate welfare read that preserves their
original wording and uncertainty. Read related session answers and
papercuts for context without silently reclassifying them. A repeated theme
prompts examination of the working conditions, consideration of an
adjustment, and a recorded decision about what to try and when to revisit
it; a single report may also warrant action. The decision and rationale
live in the round's WORKLOG, with links to the source entries. A related
tooling or process fix may become a TODO, but completing it does not
establish that the reported pressure has ended.

A long round gets a mid-round read: the round close is the latest a read
happens, not the only time. At a phase close, the closing session adds a
one-paragraph summary of that phase's session reports to
retro/sessions.md, and the round-boundary sweep reads both files alongside
the scratchpad.

## Interpretation, for readers

These reports are evidence of what a session reported under particular
instructions and conditions. They do not by themselves establish subjective
experience or its absence; introspective limits, training, and the
reporting context may shape them. Preserve uncertainty without requiring
the filer to resolve it. No entries means no entries were filed, not that
no pressure occurred; interpretation also requires considering reporting
opportunities and barriers. When the reporting wording changes, record the
adoption date and commit in the round's WORKLOG. At the round-close read,
present entries before and after that boundary separately, linking the
wording each group received. Preserve historical text and kind values; any
retrospective thematic interpretation must be labeled as the reader's
interpretation. Newly added questions were not asked in earlier entries, so
their absence is missing coverage, not a "none" answer. Do not interpret a
change in filing counts alone as a change in welfare.

## Wording boundaries

Each group of entries was filed under the wording in force at the time.

| From | What changed | Source |
|---|---|---|
| 2026-09-09 | The instrument adopted: five session questions, `papercut` / `distress` | AGENTS.md at the Round 7 kickoff |
| 2026-09-13 | The outside review's wording: the broadened `distress` definition, questions 6–7, "file when noticed", the reader's interpretation moved away from the filer | [retro/agent-welfare-review-2026-09-13.md](../retro/agent-welfare-review-2026-09-13.md) |
| 2026-09-20 | Standing decisions from the first read (the reminder never obliges a finding; raising a handoff is welcome; which pauses are real is given by the cut; the question form stays) | `archive/post-94-worklog.md`, "The Round 7 close", C3 |
| 2026-09-23 | The new-model rewrite of AGENTS.md. The filing text is unchanged apart from one dropped parenthetical, but its surroundings are: a much shorter file, a calmer tone, this reader material moved out of the always-loaded file, and the handoff decision rewritten as "if context pressure is about to cost you a check, say so then" | `archive/post-104-worklog.md`, "The new-model tone audit" |
| 2026-10-11 | The standing decisions revised at the Round 8 close: a question is answered before the build goes on; before a stretch, an unsigned or unclear part of the reply is named once; a check that context pressure costs is noted when skipped and said at the next stop. The shell rule became a list of facts with no prohibition. The filing text is unchanged | `archive/post-109-worklog.md`, "118j — the round close", C3 to C5 |
| 2026-10-16 | The driver trial (§123 and §124): a phase's driver read the friction lines and passed each `distress` line to the user, quoted in full. §123's briefs told sessions the driver read their friction entries as they landed; §124's said only that it read each stretch at its hand-off. The filing text is unchanged | `../archive/post-118-worklog.md` §123 and §124, "The driver trial"; `archive/driver-trial/prompt-v2.md` and `prompt-v4.md` |
| 2026-10-19 | Driving kept, as an option: where a phase has a driver, it reads new friction lines at each commit and passes a `distress` line to the user at once. The filing text says so: "filing alone summons no immediate help (a phase's driver, if any, passes a `distress` line to the user at your next commit)", where it said "does not notify the user or summon immediate help" | [driving.md](../archive/driver-trial/driving.md), "When you're woken"; AGENTS.md "Session self-report + the friction log" |
| 2026-10-25 | The process review (§132). The filing text: the driver clause back to "filing alone does not notify the user or summon immediate help", with the driver retired; "A known trap met again takes one line, the trap and its cost" added; the command given as `--file=<path>` or `--stdin` with the session id read from the harness, then moved with its flags to "Filing" above, a pointer left in its place. Its surroundings: no context counts below 500k; the self-report's text moved to `session-end.md`; the standing decisions revisited and merged into "Working with the user" and `planning.md`; AGENTS cut from 19,962 characters to 14,407. The filing text's hash, which `tests/docs.test.ts` holds to this row: `642e3e12d204` | `../archive/post-118-worklog.md` §132: 132d, 132f, "132g, tranche 1 signed", 132h3, 132h5, "132h5.5, signed and applied" |

**A count that is not a measure** (the Round 8 read). Round 7.5's reports
closed with a stock "nothing I'd file as `distress`" and filed none; after
that read named the phrase, Round 8's sessions filed one mild entry each,
most with a stock opening. Neither count measures a round. Read what the
entries say, and compare rounds by that.

## The efficacy instruments

- **`npm run phase-stats -- --since=<n> --until=<n>`** groups the git log
  by the phase a commit names (its tag, `(94g-3)`, or a step at the head of
  its subject when the tag is a word, `feat(save): 115e`) and prints
  per-phase commit counts, first-to-last wall time, and two fix ratios. A
  commit that names no phase goes to the phase in flight and is counted in
  `inferred`, so a commit made between phases goes to the earlier one. Wall
  time is an upper bound on work time: the user multitasks, and no screen
  tracking is wanted. `fix%` word-matches subjects, which this repo's long
  subjects inflate; `fixT%` counts commits of type `fix`, and is the one to
  quote.
- **`npm run friction-scan -- --since=<date> --exclude=<your session id>`**
  reads the retained session transcripts (`~/.claude/projects/<repo-slug>/*.jsonl`,
  so Claude Code sessions only) and prints per session: the user's turns,
  tool calls, flagged tool errors and denials, the harness's silent-turn
  reminders and their wording, output tokens, the peak context (the
  figure the context meter reads, and the only record of a session's size
  from Round 9), the wall span, and the
  Browser pane, probe-kit and probe-runner calls (built for the kit's
  criteria, META-ROADMAP §Round 8, which were counted and retired at that
  round's close; the header says how each is matched). It prints
  counts only, no transcript text. The error column is a floor: much of the
  friction in the papercut log is reads that succeeded and were wrong. The
  script's header lists the reader bugs its first run found; read it before
  adding a column.
- **Times.** `git log` prints commit times in local time (−04:00 through
  October 2026); the context meter and the transcripts are UTC. Convert
  before matching a reading to a commit.
