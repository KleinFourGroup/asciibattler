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

### Tranche 1 answered; the act design in plans/acts.md (2026-10-27)

The user answered in two turns; the words are the spec's "The act design,
answered". Between them the session read two premises: a wave's level
budget is a factor of the roster's mean or median level
(`src/config/encounters.ts`, `LevelBudgetSchema`; the bosses' `mean`
factors), so a longer run does not outrun the enemies, and the level cap
is 20 (`config/leveling.json`); barren's camp pool is grassland's, and its
ground swaps mud for sand with a few more hills (`config/terrain.json`).

**The change to the re-cut's shape.** The session put two readings of the
Queen's move (the finished design only, or from Round 10, the three
sectors as acts 1 to 3 at once) with the second as its lean; the user
agreed. So from Round 10 The Start is act 2 and The Deep End act 3, with
the Bandit King moved to act 1, the Generalissimo and the Witch Hunt to
The Start, and the Queen to The Deep End; Rounds 21 and 22 each rework
one shipped sector where Round 21 merged two. META-ROADMAP's Rounds 10,
21, 22 and 23 are re-pointed: Round 10's charter, its act-1 and run-shape
bullets, risk and decision points; Round 21's charter, its sector bullet
and decision point; Round 22's sector and wizard bullets; Round 23's win,
its unlock decision point and its save line. A search of the tracked
docs for "act 2's place", "shipped two" and "two shipped", outside the
archive, finds one line, Round 10's new charter (code comments that say
"shipped two-sector" describe today's map and stand).

**Unanswered leans, kept as leans in the plan:** acts 2 to 4's themes
(barren, swamp, volcanic), The Start to barren in Round 10, and act 4's
condition findable only after a first win.

**For tranche 2,** `scratch/134/spread.mjs`: the proposal's `U^k` is the
Kumaraswamy distribution with `b` 1, so a spread dial needs no second
draw a strike, which 133c had assumed a two-parameter family would. Its
controls passed (the uniform at `p` 0.5 and `b` 1, variance 0.0833; the
closed-form mean within 0.0004 of the sampled one at six settings; 0.194
at the proposal's setting, 133c's figure). The table is the spec's.
`Math.pow` with a fractional exponent is already in the sim's path
(`src/sim/xp.ts:17`), so the draw adds no new kind of float operation.

### Tranche 2 answered in part; the follow-ups on defense and true misses (2026-10-27)

The user's answers and two follow-ups are in the spec's "The trial",
with `scratch/134/defense.mjs`'s numbers. Read for them at HEAD:
`World.dealDamage` deals `max(STATS.minDamage, rawDamage − defense)`, both
integers (`src/sim/World.ts:702-711`; `minDamage` 1 in
`config/stats.json`); `applyDamage` takes the crit, drawn by the op before
it, then the hit roll, so `combatRng`'s order per strike is crit, then
hit, and a miss discards the crit (`:766-768`, `:803-804`); a miss fires
`dealMiss` and `evade`, and no config entry hooks either (a search of
`config/`); raw damage is the op's `might` plus its scaling stat
(`src/sim/effects/resolveScalars.ts:41`); base defense runs 0 to 6 across
the archetypes.

**A correction to 133c:** three shipped rules hook a hit, not two. 133c
counted the daemons' (Laverna, bits on a rogue's hit; Fortuna,
`emboldened` on a crit), and the Venom packet injects one more for an
encounter, poison on every hit (`config/packets.json`).

**Put to the user:** the mixture as a third arm, since at `s` 0.5 it
matches `b` 0.25 on spread and visibility and differs in shape alone; the
session's lean is three arms, with the board run on the arm the user's
play picks, before the keep.
