# Reading the welfare and efficacy instruments

Read this before a mid-round or round-close read of the friction log
([retro/papercuts.jsonl](../retro/papercuts.jsonl)) and the session reports
([retro/sessions.md](../retro/sessions.md)). How sessions FILE is in
AGENTS.md "Session self-report + the friction log"; this page is for the
reader.

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
| 2026-09-23 | The new-model rewrite of AGENTS.md. The filing text is unchanged apart from one dropped parenthetical, but its surroundings are: a much shorter file, a calmer tone, this reader material moved out of the always-loaded file, and the handoff decision rewritten as "if context pressure is about to cost you a check, say so then" | WORKLOG, the tone-audit entry |

## The efficacy instruments

- **`npm run phase-stats`** groups the git log by the phase tag in commit
  subjects (`(94g-3)`) and prints per-phase commit counts, first-to-last
  wall time, and a fix ratio. Wall time is an upper bound on work time: the
  user multitasks, and no screen tracking is wanted. The fix ratio
  word-matches subjects, and this repo's long subjects inflate it, so count
  commit types beside it before quoting it.
- **`npm run friction-scan -- --since=<date> --exclude=<your session id>`**
  reads the retained session transcripts (`~/.claude/projects/<repo-slug>/*.jsonl`,
  so Claude Code sessions only) and prints per session: the user's turns,
  tool calls, flagged tool errors and denials, the harness's silent-turn
  reminders and their wording, output tokens, and the wall span. It prints
  counts only, no transcript text. The error column is a floor: much of the
  friction in the papercut log is reads that succeeded and were wrong. The
  script's header lists the reader bugs its first run found; read it before
  adding a column.
