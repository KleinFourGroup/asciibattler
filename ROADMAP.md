# ROADMAP — Round 10 (Act 1, the wilds), post-§140

The active PLAN (it stays a plan for its whole life). The macro order is
[META-ROADMAP.md](META-ROADMAP.md) (Round 9 The frame and the misses ✅
CLOSED 2026-10-30); findings + rationale land in [WORKLOG.md](WORKLOG.md);
live status is HANDOFF's 🧭 Cursor. Sub-steps are cut at each phase
kickoff (AGENTS "The planning stack"), never here, and each cut step
declares its read (`none` · `batch` · `stop`; AGENTS "Reads are cut, not
improvised"). Prior round's plan:
[archive/post-133-roadmap.md](archive/post-133-roadmap.md) (Round 9) with
its spec, its per-phase worklogs (`archive/worklog-phase-135.md` to
`-140.md`) and its session reports beside it; before it
[archive/post-118-roadmap.md](archive/post-118-roadmap.md) (Round 8.5).

**Status: §142, the scripted run, cut signed 2026-10-30; 142a built;
142b's grammar signed; 142c and 142d built; 142e next.** The spec is [round-10-spec.md](round-10-spec.md), its tranche 2
answered at the kickoffs of §144 to §146. The charter, the decision
points, the exit and the scope guards are in META-ROADMAP §"Round 10 —
Act 1, the wilds", with the roster table's rebuild added to its scope at
Round 9's close and the scripted run's starting act at this kickoff; the
audit at `9e1b7c48` is WORKLOG §141; the act design is
[plans/acts.md](plans/acts.md).

## Phase 141 — the kickoff

The spec, the charter against the code, and the phases, each signed by
the user (WORKLOG §141).

- ☑ **The spec** — signed 2026-10-30, tranche 2 open for the phases that
  need it.
- ☑ **The phases** — §142 to §147 below, with the scripted run's
  starting act in §142.

## Phase 142 — the scripted run (signed 2026-10-30)

Charter: one list of per-hop entries on `RunConfig` with a URL form, of
which `layout`, `encounter`, `event` and `firstNode` become cases, with
entries for a port's stock and for the act a run starts at;
`--sector-hops` and `--escalation` in the run-config CLI and its help; a
warning when a forced encounter matches no node. Its first step is the
backslash guard (TODO, signed at 140d). **Why here:** act 1 is authored
and read through it, and the board's per-act rows start at an act
through it. **Risk:** low-medium: the parse is rewritten, and every URL in
use keeps its meaning. **Decision points:** the entry grammar and its URL
form (a stop). **Exit:** the user's three cases (an event chain end to
end, a chain of encounters and layouts, a port's stock) and a start at
act 2 each in one URL, each with a headless test and its planted failure;
the old dials' tests green unchanged; a run with no script unchanged (the
corpus at its baseline). **Scope guards:** no content; no Run field, since
the script rides the saved query text; no board row changed.

The cut, signed 2026-10-30, with its predictions and each step's exit,
is WORKLOG §142.

- ☑ **142a — the backslash guard** (`none`). The halving re-measured on
  2.1.309; the refusal unseen live until a session loads the edit.
- ☑ **142b — the grammar** (`stop`): the entry list and its inline URL
  form, worked on the user's three cases and a start at act 2. Signed
  2026-10-30 with its leans.
- ☑ **142c — the list, with the old dials as cases** (`none`). Corpus
  0 of 32, its planted misparse 2 of 32.
- ☑ **142d — the per-hop entries** (`none`), with the zero-match
  warning. 36 tests with four planted failures; corpus 0 of 32.
- ☐ **142e — a port's stock** (`none`).
- ☐ **142f — the starting act** (`none`).
- ☐ **142g — the CLIs** (`none`).
- ☐ **142h — the phase's close** (`stop`): the user plays four URLs.

## Phase 143 — the board's acts (signed 2026-10-30)

Charter: the sheet's multi-act tooling (A23's tooling half): a seam per
seam in `summary.csv`, the wall and reach per act, the act rows reading
one act alone through the starting act, and the sheet's two-act names
(`deepEndWallTarget`, `act1WinRefs`) per act. **Why here:** before act 1
enters the map, today's `--hops=11` rows are the twin a re-pointed row
must reproduce; after it no twin is left. **Risk:** low-medium.
**Decision points:** the sheet's per-act shape. **Exit:** on today's map
the re-pointed act-1 rows reproduce the `--hops=11` rows, and a stored
two-act cohort reports the same numbers under the new parse; each new
check with its planted failure. **Scope guards:** no band moved; no board
cohort.

## Phase 144 — the fauna (signed 2026-10-30)

Charter: the wolf, the giant rat, the fox, the puma, the tiger and the
placeholder 1×1 bear, enemy-only 1×1 melee archetypes with their
attacks, glyphs, stats and locale; the atlas grown (S1). **Why here:** the
units before the encounters that hold them, and a unit in no pool moves
no shipped run. **Risk:** low. **Decision points:** the glyphs (a taste
stop); new attacks or the shipped melee ones. **Exit:** each beast in play
by URL, its glyph read by the user; the atlas's three guards at the new
size; the corpus at its baseline. **Scope guards:** no new mechanism, no
pool entry; no flyer, swimmer, 2×2 or swarm.

## Phase 145 — act 1 and the run's shape (signed 2026-10-30)

Charter: act 1's sector off the map (normal, elite and boss encounters
with the bear's, layouts, events, fauna camps, locale), each read
through the forcing dials; then one commit puts it in the map before The
Start, moves the King to act 1, the Generalissimo and the Witch Hunt to
The Start and the Queen to The Deep End, moves the boon, sets The Start's
theme, re-derives or re-picks every seeded pin by its own rule,
re-records the corpus, and gives the roster table's guard its PENDING
line. **Why here:** on the scripted run, the board's acts and the fauna.
**Risk:** medium: every seed re-draws, and the run goes to 33 hops.
**Decision points:** the save; The Start's theme; the titles; the boon's
place and line; act 1's size and who writes its text. **Exit:** a run from
act 1 to The Deep End's boss, playable end to end, read in the user's
play; DESIGN, ARCHITECTURE and BALANCE's primer honest. **Scope guards:**
no change to the shipped sectors' content beyond the moves; no new
mechanism.

## Phase 146 — the board and act 1's bands (signed 2026-10-30)

Charter: the roster table rebuilt on the three-act map from a box
cohort, the board on three acts, act 1's bands set and signed, each moved
boss read at its new place, and acts 2 and 3 recorded as Rounds 21 and
22's starting points. **Why here:** the bands rest on the table and the
tooling. **Risk:** medium: box time (the 94h board was 6.9 h on two
acts). **Decision points:** act 1's bands; the box's size and cost.
**Exit:** the coverage guard with no PENDING line; act 1's bands signed;
the board read against `0.2.0`, paired on the seed where the pairing
holds. **Scope guards:** no retune by taste (Round 11's); acts 2 and 3
not re-anchored (Rounds 21 and 22).

## Phase 147 — the close (signed 2026-10-30)

Round 10's exit by clause; `0.3.0` by the version rule; the process
read; the archive; Round 11's charter against the code.
