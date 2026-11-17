# WORKLOG — Round 12 (Push, pull and blink)

Per-phase narrative log (AGENTS "The planning stack"; `process/planning.md`
"The artifacts"): findings, decision rationale, rejected alternatives,
scope changes, playtest verdicts and the checks run land here under the
matching `## Phase N`; the ROADMAP stays a plan. The file holds the phase
in progress: at each phase close it moves to `archive/worklog-phase-N.md`
and a fresh one starts. Round 12's phases before this one are in
[archive/worklog-phase-158.md](archive/worklog-phase-158.md) (the kickoff,
§157, and the pre-step and the design, §158); Round 11's are
[archive/worklog-phase-149.md](archive/worklog-phase-149.md) to
[archive/worklog-phase-156.md](archive/worklog-phase-156.md).

## Phase 159 — forced movement, the seam

The kickoff's inputs, by pointer: the signed design, `round-12-spec.md`
"Tranche 2A" and "Tranche 2B", with its reasons in
`archive/worklog-phase-158.md` (§157's forks, 158b's three entries); the
occupancy core as §157 read it (the same file, "The kickoff's audit");
ROADMAP §159; `process/planning.md` "Phase kickoff".

### The kickoff's audit, and the cut put to the user (2026-11-16)

Read at `9b60b5d6`. Nothing under `src`, `config` or `tools` has changed
since §157's read, so its file-and-line findings on steps, swaps,
strikes, placement, tiles and the dash stand. What this kickoff read
under them:

- *The action union.* A unit's action in flight is saved as an id and
  its data (`World.ts:111-122`); `createAction` rehydrates `move`,
  `spawn` and `swap` from a table and treats every other id as an
  ability (`src/sim/actions/registry.ts`). A held slide is a fourth
  entry, and since `WORLD_SCHEMA_VERSION` bumps with any change to what a
  field means (`World.ts:86-92`), a new action id is the bump the design
  predicted, v39 → v40. Two tests pin 39
  (`tests/integration/snapshot-roundtrip.test.ts:1141`,
  `tests/integration/spawn-overflow.test.ts:198`).
- *Busy.* While `activeAction` is set the selector skips the unit, and
  the phase walk fires `applyEffect` at `impact` (`World.ts:900-951`), so
  a hold needs no new gate: an action whose `impact` is the slide's end
  runs the landing's entry there.
- *The interrupt's parts,* at HEAD: the in-flight abort's reset and
  `unit:moveAborted` (`World.ts:915-921`), `releaseClaimsBy`
  (`World.ts:1388`), `clearActiveAction`, which drops a swap's partner
  reservation (`World.ts:1845`), and `removeUnit`'s `unit:swapAborted`
  for an actor taken before its flip (`World.ts:1876-1906`).
- *The op's victims.* `resolveStatusTargets` already gives an op its live
  targets under any selector: an area's occupants as it fires, the
  caster for `self`, the captured target otherwise
  (`src/sim/effects/interpreter.ts:278-294`); a caster-anchored area
  centres on the caster's cell as it fires (`interpreter.ts:133-138`). A
  new op joins `executeOp`'s and `resolveOp`'s exhaustive switches
  (`interpreter.ts:101-126`, `src/sim/effects/propose.ts:310-357`) and the
  attack editor's (`tools/attack-editor/editor.ts:64`, `format.ts:136`),
  so typecheck finds every reader.
- *Camps.* A camp turns hostile only through `markCampHostile`, which the
  damage path calls (`World.ts:543-553`), so a push alone leaves it
  passive with no code of its own.
- *Diagonals.* The router steps eight ways with no corner rule
  (`src/sim/Pathfinding.ts:31-34`), so a push may pass diagonally between
  two blocked cells, as a step may.
- *The shove.* Only `src/sim/shove.test.ts` calls `World.shove`
  (`World.ts:1395-1410`); its radius is `SIM.shoveSearchRadiusCells`
  (`config/sim.json`, `src/config/sim.ts`). `unit:shoved` is silent
  (`src/audio/eventSounds.ts:117`, 'bookkeeping'), and the renderer draws
  every relocation off `unit:moved`.
- *The look's surfaces.* The renderer hides the progress bar for a move
  and a spawn only (`src/render/BattleRenderer.ts:1775-1780`), so a held
  slide shows a bar unless it joins them; `action:phase` finds no FX for
  an id that is not an ability's (`BattleRenderer.ts:1313`).
- *Seeing it in play.* No shipped ability pushes until a consumer does,
  and `roster=` puts an archetype in the starting roster
  (`src/run/RunConfig.ts:78`). The adventurer, the pull's carrier, is in
  2 of the corpus's 34 journals (a search of `tests/fuzz/corpus/journals`).

**Inside the signed intent, built on a lean and flagged at the stop:** a
push that moves nothing does nothing (no hold, the victim's action
untouched); a unit pushed while it fades in keeps its lockout, held to
the later of the two ends; the landing's entry runs when the slide ends,
as a step's runs at its flip; the dash's entry (fork 9) waits for §161,
with the teleport, so the corpus moves once for the dash's landing rule.

**The cut put to the user:**

- **159a — the walk** (`none`): one victim's landing, pushed `cells` away
  from or toward an origin (forks 2, 3, 7, 10), as a pure function. Exit:
  a test per rule, each failing with that rule taken out: the edge; a
  wall, chasm and deep water; a body, scenery included; a claimed cell
  (gotcha #113); a body larger than one cell never moves; a victim on the
  origin pushed away from the caster; a pull stopping beside the caster.
  One commit, a new `src/sim/push.ts` and its test. Predicted: the smoke
  fires; no snapshot change, no RNG stream, the corpus unchanged.
- **159b — the held slide** (`none`): a new action holds a pushed unit
  until its slide ends, at `SIM.pushSecondsPerCell` (0.15, a new key);
  the victim's own action ends first (fork 6); the landing's entry when
  the slide ends (fork 9); `unit:moved` and `unit:shoved` for the slide.
  Exit: §158's three probe cases as tests, each with its failing control
  (a step pushed before its flip jumps back to where it planned without
  the end), with an ability's cooldown spent, a spawn's lockout kept, a
  mud landing poisoning at the slide's end, and a unit mid-slide through
  a snapshot. Predicted: WorldSnapshot v39 → v40; the smoke fires; the
  corpus unchanged.
- **159c — the op, and the shove retired** (`none`): `push` in the effect
  schema over its selector's live victims, farthest from the origin first
  (fork 8), after a damage op in the def's order (fork 1); its form in the
  attack editor; `World.shove`, its key and its test retired (fork 13),
  `unit:shoved` re-described. Exit, each with a planted failure: a packed
  ring around a centre all moving out (in world order the inner ring
  stays stuck); a caster-anchored burst; a single-target pull; a pushed
  camp member staying passive; a push storm on a crowded board holding
  the occupancy invariant every tick (planted: a walk that ignores
  claims). Predicted: the smoke fires; the corpus unchanged, 0 of 34 by
  hand.
- **159d — the adventurer's pull** (`stop`, read with 159e): the pull's
  first consumer, moved up from §160, a second ability on the adventurer:
  the whip's lash drags its target in from a few cells off, numbers
  drafted (range 3, from 2 cells, 2 cells, a long cooldown) with its line.
  Exit: a test that the adventurer pulls a target at range and then
  whips it; the ability card says it pulls. Predicted: the corpus moves
  where the adventurer fights, `--record` (a meant change); the smoke
  fires; no snapshot change.
- **159e — the look and the sound** (`stop`): the forced slide drawn as a
  yank, not a step; the hold's bar hidden or shown; a cue on
  `unit:shoved`; the rate per cell. Read with 159d at one stop, on a URL
  with the adventurer in the roster. Wrong looks like a step's walk where
  a yank should be, a bar that reads as the pulled unit casting, or a
  slide so slow the target seems to walk in.

*Moving the pull up* is a change to the signed phases, put with the cut.
Lean: §159 ends on a push in play, so the look and the rate are judged
on one and the seam ships with its consumer (the round's rule). The other
arm keeps the pull in §160 and §159 headless, its look built blind and
read at §160's first unit.

**Signed** ("Signing the cut, with the pull moved up! 😁"): the cut as
put, the adventurer's pull moved up from §160 to 159d. The stretch runs
159a to 159d, then the stop at 159e.
