# WORKLOG — Round 9 (The frame and the damage trial)

Per-phase narrative log (AGENTS "The planning stack"; `process/planning.md`
"The artifacts"): findings, decision rationale, rejected alternatives,
scope changes, playtest verdicts and the checks run land here under the
matching `## Phase N`; the ROADMAP stays a plan. From this round the file
holds the phase in progress: at each phase close it moves to
`archive/worklog-phase-N.md` and a fresh one starts. Created 2026-10-26 at
the Round 8.5 close. Prior round's log:
[archive/post-118-worklog.md](archive/post-118-worklog.md) (Round 8.5,
Housekeeping: the kickoff → §119 the oracle map → §120 the census → §121
the dials → §122 sim → §123 run → §124 and §124.5 render and UI → §125 the
bot and the fuzz instruments → §126 tests → §127 tools → §128 the build →
§129 the dependency phase → §130 the instruments and the docs → §131 the
reads → §132 the process review → §133 the re-cut and the close), with
its plan [archive/post-118-roadmap.md](archive/post-118-roadmap.md), spec
[archive/round-8.5-spec.md](archive/round-8.5-spec.md) and census
[archive/round-8.5-census.md](archive/round-8.5-census.md) beside it.

**Read first:** `archive/post-118-worklog.md` §133. 133b's table and 133c's
additions hold the premise of every item of Rounds 9 to 23 against the
code, by the row ids META-ROADMAP's charters cite; the tranches hold each
round's signed shape; "133f" holds the round's exit check and what the
close left for the user's read.

## Kickoff — Round 9 (The frame and the damage trial)

### The spec drafted, tranche 1 put to the user (2026-10-27)

The user opened the kickoff: "It's time to kick off phase 9 of our game!
We've gotta write the detailed spec, right?"

[round-9-spec.md](round-9-spec.md) is drafted from the record, unsigned:
the user's words on the acts, the trial, who plays and releases, from
§133; what was signed before the kickoff; the code under the act
questions; and the Open section in three tranches. The code was read at
`8e4ef58b` for the act questions only (the sector map's schema and
shipped graph, the sectors' lengths and themes, the boss and plague
encounters' text, the win at `run:victory`, `progress`'s one field); the
trial's and the instruments' premises are tranche 3's, before the cut.

Tranche 1, the act design's eight questions with the session's leans, is
put to the user as the spec's Open lists them. Nothing else in Round 9
rests on the act design, so its answers can come at any point in the
round; Round 10 needs them first (act 1's hops and boss, the themes).
Tranche 2 is what keeping the trial would look like; tranche 3 the
premises at HEAD and the first phase's cut.
