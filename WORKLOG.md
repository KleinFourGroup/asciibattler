# WORKLOG — Round 12 (Push, pull and blink)

Per-phase narrative log (AGENTS "The planning stack"; `process/planning.md`
"The artifacts"): findings, decision rationale, rejected alternatives,
scope changes, playtest verdicts and the checks run land here under the
matching `## Phase N`; the ROADMAP stays a plan. The file holds the phase
in progress: at each phase close it moves to `archive/worklog-phase-N.md`
and a fresh one starts. Round 11's phases are
[archive/worklog-phase-149.md](archive/worklog-phase-149.md) to
[archive/worklog-phase-156.md](archive/worklog-phase-156.md) (the close,
with Round 11's exit read and Round 12's charter against the code at
156a).

## Phase 157 — the kickoff

The kickoff's inputs, by pointer: the charter, META-ROADMAP §"Round 12 —
Push, pull and blink", standing as written at Round 11's close; its
premises at HEAD, `archive/worklog-phase-156.md`, 156a; TODO's Round 12
section, with the corpus's trade rows put to this kickoff as a pre-step;
`process/planning.md` "Phase kickoff" and "The artifacts" (the spec
first).

### The kickoff's audit, and the phases put to the user (2026-11-14)

Read at `b2e9362e`. `git diff --stat e3e22e09 HEAD -- src config tools
scripts tests` is empty, so 156a's premises stand with their files and
lines (`archive/worklog-phase-156.md`, 156a). The spec is
[round-12-spec.md](round-12-spec.md), proposed. This kickoff read the
surfaces under them that a push touches:

- *Steps.* `MoveAction.start` claims `to` and leaves the unit on `from`;
  its flip at `impact` writes `position = this.to`, releases the claim
  and runs the tile's enter effects (`src/sim/actions/MoveAction.ts:37-62`).
  World's in-flight abort catches a destination gone bad before the flip
  (`src/sim/World.ts:904-922`; its comment names "a knockback or a
  changed tile"), but nothing catches a mover that was itself moved: its
  flip still writes `to`, so a unit pushed mid-step would jump from where
  the push left it.
- *Swaps.* The exchange checks that the partner still stands on `to`, but
  not that the actor still stands on `from`
  (`src/sim/actions/SwapAction.ts:108-141`), so a pushed actor jumps to
  `to` and its partner lands on the vacated `from`. A pushed partner
  degrades safely: the actor steps alone when `to` is free, or the swap
  aborts. `World.removeUnit` already emits `unit:swapAborted` for an actor
  taken mid-window (`World.ts:1876-1898`), and `releaseClaimsBy` frees a
  unit's claims (`World.ts:1388-1392`).
- *Strikes.* A `commit-at-cast` strike lands at `impact` on a live target
  whatever the range by then (`src/sim/effects/interpreter.ts:194-202`),
  so a melee unit pushed during its wind-up would still hit from two cells
  away. Only a def with a `releaseGate` re-checks its band
  (`EffectAction.ts:90-110`).
- *Placement.* Gotcha #113: every path that drops a unit on a cell treats
  a claimed cell as occupied (`nearestFreeCells`, `runOverflowScan`,
  `retreatCell`); a push's landing walk is a new such path.
- *Tiles.* Chasm and deep water cost `Infinity` and are impassable;
  shallow water costs 2 and douses a burn on entry; mud poisons on entry
  (`src/sim/TileGrid.ts:82-93`). Every sector's layout pool lists
  `junctionAmbush` and `spiralFireLife` (96 and 88 chasm tiles) and
  `isthmus` and `icebergs` (102 and 148 deep-water tiles)
  (`config/sectors.json`, `config/layouts.json`, read by a script), and
  the procedural maps make deep-water pools (`src/sim/proceduralMap.ts:432`),
  so a push toward a gap happens in every act. Walls, cover, rubble and
  trees are units (`isInertNeutral`), so a body in the way is one rule.
- *Enter effects.* They run at a step's and a swap's flip
  (`MoveAction.ts:61`, `SwapAction.ts:119-120`), not at the dash or the
  gambit's spring-back (`interpreter.ts:216-238`) or the shove
  (`World.ts:1142-1143` says so): the dash onto mud does not poison today.
- *The dash's timing.* `dash`'s timeline is one `impact` phase of 0.25 s
  (`config/abilities.json`), which begins at offset 0, so its move fires
  in `start()` (`EffectAction.ts:78-80`) and the 0.25 s is the slide's
  `phaseTicks`: the landing is chosen and taken on the cast tick and needs
  no claim. A teleport with a wind-up would hold its landing across it;
  an `EffectAction` has no `destinationCell`, so the in-flight abort
  (`World.ts:915`) would not see it until one is added. Claims and
  `moveDest` are serialized already (`World.ts:2197`, `EffectAction.ts:56`),
  so neither arm needs a World bump.
- *The area flag.* No shipped def anchors an area on its caster (a script
  over `config/abilities.json`: none of 29). `proposeCasterAnchoredBlast`'s
  one gate is whether the blast would touch anyone now, and with `allies`
  or `all` it always finds its caster (`src/sim/effects/propose.ts:263-286`),
  so such a burst fires on every cooldown; the flag is what would give it
  a real gate.
- *A stagger.* The catalog's one status that stops a unit is `frozen`
  (`preventsAttack`, `preventsMove`, `config/statuses.json`), drawn as
  ice; a new status needs a symbol and a colour under the colourblind
  gate.
- *Registering an archetype.* `config/units.json`, both records of
  `config/fuzz-strategies.json`, `config/prices.json` for a draftable,
  `Recruitment.test.ts`'s `EXCLUDED` for one that is not, the glyph (the
  font-coverage test), its locale strings, and for a draftable a
  prior-table row or PENDING. The attack editor lists the move modes
  (`tools/attack-editor/editor.ts:63`), so a new op needs its form there;
  the bot's sensors read only a periodic op's kind (`src/bot/sensors.ts:147`).
  The atlas has 128 cells (`src/render/glyphs.ts:30-32`) and uses at most
  40: 5 static glyphs and 35 distinct unit glyphs (a script over
  `config/units.json`).
- *The corpus.* 33 rows; the test asserts 21 command kinds
  (`tests/fuzz/corpus/corpus.test.ts:31-62`); three rows are picked by
  seed for their trades (chaos 16, 13 and 64, with the re-picks recorded
  in `corpus.ts`'s comment). The seeded player plants battle orders and
  mid-battle commands only (`tests/journalDrive.ts:131-142`), so the
  port's trades need a plant of their own; `script=` sets a port's stock
  (`src/run/RunConfig.ts:128`).
- *Box time,* from Round 11: the prior table's rebuild 4 h 54 min of one
  `cpx42` at v9, 32.3 CPU-hours (BALANCE.md's derived-artifact row); a
  thin draftable row's `--grant` arm about 3.7 CPU-hours; §155's board on
  two `cpx42` with ten rows extended to n=120 (BALANCE 2026-11-12).

**The forks for the design stop (158b).** Each with its lean; the spec's
Open lists them in short.

1. *The op.* A new `push` op that moves the targets its selector
   resolves, by `cells` (a whole number of its own), `away` from or
   `toward` an origin, the caster or the area's centre. Lean: a new op,
   because every other op acts on what the selector resolved and `move`
   on the caster; two more `move` modes would put both meanings in one op,
   which the census's A-07 had and nothing used. A single-target pull
   (the adventurer) is `toward` the caster; the grenade `away` from the
   centre; the telekinetic `away` from the caster.
2. *Direction.* The sign of the offset from the origin to the victim, one
   of eight grid directions, fixed at the start of the push. A victim on
   the origin (the grenade's centre cell) is pushed away from the caster.
   No draw, so no RNG stream.
3. *What stops a push.* Walking cell by cell up to `cells`: the board's
   edge, an impassable tile, a cell any unit covers (scenery included),
   or a cell another unit claims (gotcha #113); the victim lands on the
   last free cell, or stays. Chasm and deep water stop it as a wall does.
   The other arms: a fall that kills (a ring-out, which would let the
   grenadier kill a boss on four maps of every sector's twelve, and needs
   a death cause, its animation and a balance read), or a carry across the
   gap (a landing rule of its own). Lean: the wall.
4. *Collision.* Nothing more when a push is cut short. The other arm,
   bump damage for the cells not travelled, makes walls and allies part of
   every push's damage; it can be a dial later. Lean: nothing.
5. *Timing.* The victim's position changes when the op fires, and the
   glyph slides over a short window, as the dash and the shove do: no new
   state, no World bump. The other arm holds the victim busy for the
   slide, a new action kind in the serialized `activeAction` and a World
   bump (no player save holds a World). A stagger, if play wants one, is
   an `applyStatus` after the push. Lean: instant.
6. *The victim's action.* The push ends whatever the victim had in flight:
   a step's claim released, a swap aborted through the event
   `World.removeUnit` uses, a strike or a spell cleared. The other arm ends
   only steps and swaps, which correctness needs, and lets strikes and
   spells run, with a reach check added for a strike. Lean: end it all,
   one rule a player can read ("a unit knocked back loses what it was
   doing"); whether the ended ability's cooldown is spent or reset is part
   of the call, lean spent.
7. *Who moves.* Never scenery and never a body larger than one cell (the
   scope guard, Round 19). A camp member is a body and moves; the push
   alone is not a hit, so only the op's damage turns its camp hostile.
8. *Several victims.* Farthest from the origin first, ties in
   `world.units` order, so the outer ring makes room for the inner.
9. *Landing as an entry.* A push, a pull, a teleport and the dash run the
   landing tile's enter effects. The dash's change moves behaviour, which
   the round's content moves anyway. Lean: entries.
10. *The pull.* The same walk toward the caster, stopping on the cell
    beside it at the nearest.
11. *The teleport.* The free, unclaimed, passable cell beside its target
    farthest from the caster (behind it), the target within the def's
    range, no line of sight needed, taken on the cast tick as the dash's
    is, so no claim; the blink is drawn, not slid. The other arm, a
    wind-up before the blink, needs the claim and `destinationCell`
    above. Lean: on the cast tick.
12. *The cavalier's hit.* A leap keeps its enemy's id (`targetId`); a
    damage op after the move hits it only if it is alive and within the
    strike's reach of the landing, so a leap cut short hits nothing. The
    rogue's dash has no damage op, so its events do not change.
13. *`World.shove`.* Retired with `SIM.shoveSearchRadiusCells`; its
    `unit:shoved` event kept as the push's signal, since a forced move is
    not a chosen one.

With them, since §160's units rest on them: which new units are
draftable; the blade whirlwind's carrier (the user's line sits among unit
ideas, and the re-cut's N27 read it as a special); N3's flag and its
consumer; who drafts the abilities' lines.

**The phases, and why this order:**

1. *§158, the pre-step and the design.* The corpus's trade row first,
   since every unit after it moves the corpus and TODO's row names the
   cost of re-picking by seed (seven phases since 145g). Then the design,
   the stop the charter names, with the calls §160 rests on. Risk: low for
   the row; the design is the round's decision point.
   - **158a — the corpus's trade row** (`none`). A corpus row whose port
     comes from the script (`script=` with a port of known stock on an
     early hop) and whose five trades are planted at that port: a unit, a
     packet and a daemon bought, a packet sold, a unit paid off. Its own
     test checks the row reaches the five, with a planted failure (the
     port taken out of the script; the test names the trades lost). The
     21-kind assertion then rests on it; the seed-picked rows stay for
     breadth and their re-pick rule is deleted. Commit: the driver's port
     plant, one journal and its baseline row, the corpus test. Predicts:
     no snapshot change, no RNG stream; the smoke and `fuzz:jobs-parity`
     fire (`tests/fuzz/` staged); the other 33 journals replay unchanged
     (`npm run corpus`, by hand).
   - **158b — the forced-movement design** (`stop`). The thirteen forks
     with both arms, cost and lean, and the four calls with them; a
     scratch probe under `scratch/158b/` for a premise still uncertain (a
     step and a swap pushed mid-flight). Commit: the WORKLOG entry.
     Predicts: docs only.
2. *§159, forced movement, the seam.* The push and its op on the signed
   design, knockback from a point and the pull toward the caster, each
   landing and interrupt rule held by a headless test with its planted
   failure; `World.shove`'s fate; then the forced move's look and sound.
   Before any consumer, because three units and the adventurer's special
   stand on it. Risk: medium-high (claims, flips and swaps). Predicts: no
   shipped ability pushes until §160, so the headless steps replay the
   corpus unchanged, their reads `none`; the look a `stop`, since the
   consumers' feel builds on it. A World bump only on fork 5's other arm.
3. *§160, the pushers and the bursts.* The grenadier, the telekinetic,
   the adventurer's pull, the banshee's self-centred burst, and the blade
   whirlwind (a caster-anchored damage area, no new seam), with N3's flag
   if signed, each in the live acts' pools. Right after §159, so the
   push's distance and feel are judged on units in play before the board
   reads them. Risk: medium (five kits, and the banshee fights at act 3's
   boss). Reads: the glyphs a `stop` at the phase's start (the glyph
   sampler, 144b); each unit `batch` with its URL; the play a `stop`.
4. *§161, the blink and the charge.* The teleport, the cavalier's hit
   after its move, the dash's trail and the blink on `unit:dashed` (TODO's
   row), then the ninja and the cavalier. After the pushers because it
   stands on none of them and its risk is lower. Risk: medium. Reads: the
   headless steps `none`; the trail and blink a `stop`; the play a `stop`.
5. *§162, the closing board.* The prior table rebuilt (the adventurer's
   kit and each draftable newcomer change what it measures), the rarity
   protocol's desk read per new draftable with a thin row's `--grant` arm
   at n=80, then the board line for line against §155's, paired on its
   seeds; act 1's bands read against 155g's sheet; the fire channel read
   (TODO). Risk: medium (about a day of box time, sized at its kickoff by
   `process/measurement.md`). Reads: `stop`.
6. *§163, the close.* `0.5.0` and its upload, the exit by clause, Round
   13's charter against the code, the process read, the archive. Reads as
   §156's.

Six phases after the kickoff; the re-cut sized the round at 4.25 to 6.25.
*Not split off:* N3's flag rides §160 (one schema field with its
consumer, or none); the dash's visual rides §161 with the blink it
shares. *Predicted:* the release four new units (five if the whirlwind
gets one of its own), two reworked, and their abilities; no Run bump, since no shipped id is removed and the banshee's
`wail` is reworked under its id; a World bump only on fork 5's other arm.

### The cavalier previewed, and the spec and the cut signed (2026-11-14)

The user asked to preview the cavalier before signing, remembering it as
the most open item. *The record:* the one line from the 2026-08-21
planning session, in that day's META-ROADMAP v2 (`daff9a08`): "blitz +
hit on arrival … Everything else is a dash clone + mobility". No words
of the user's were found in the repo, in `git log -S` back to that
commit, or in a search of the session transcripts for "cavalier",
"blitz" and "cavalry" (the oldest hit 2026-09-27). The re-cut sized C5
at 0.5 to 1 phase and A18 at none. So it is the one consumer of the
seven with no sentence of the user's behind it, and one of the round's
smallest mechanisms: the leap abstains within strike reach and lands a
cell short of its target (`propose.ts:138-168`, `movement.ts:241-264`),
an op fires at offset 0 and at `impact` (`EffectAction.ts:6-18`), so a
move at the wind-up's start and a hit at `impact` lands the hit as the
slide ends, and the gambit already does the reverse.

*The six put with it, for 158b's stop:* the hit strikes the enemy it
charged, only if beside it on arrival (the other arm, whoever is in reach,
never wastes the charge and can hit a bystander); plain damage or damage
and a one-cell knockback through §159's push (lean: the knockback, which
makes the charge read as one and, under fork 6, ends the target's action:
the cavalier a disruptor where the ninja is an assassin); no damage by
distance travelled (a cast-time capture, a World bump, hard to read); a
run-up of at least two cells, read off the def's `minRangeCells`, which
the leap does not read yet; the path, as the dash, not a straight line;
a one-cell body with high mobility, a melee weapon and the charge on a
long cooldown, the dash's 10 s to start, its act, glyph and draft at its
phase.

**Signed** (the user: "Thank you, Claude! 😁 Signing the spec and the
cut!"): the spec, and §158 to §163 with 158a `none` and 158b `stop`. The
cavalier's six join tranche 2 at 158b, as the preview proposed. The cut
is in the ROADMAP; the stretch runs 158a, then 158b's stop.
