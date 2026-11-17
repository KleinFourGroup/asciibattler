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

## Phase 158 — the pre-step and the design

### 158a — the corpus's trade row (2026-11-14)

**Step zero.** The seeded player's port row always leaves
(`src/dev/probe/drive.ts`, `port`), so the trades need a plant of their
own; `script=` gives a port its whole stock at the price book's prices
(`src/run/RunScript.ts`, `ScriptEntry.port`). A probe
(`scratch/158a/probe.ts`) drove `hops=3&bits=300&script=1:port=rogue/overclock/diana`
on seed 9 with a port plant: the run opens on the port, and the five
trades each changed the run (bits 300 → 291 → 251 → 221 → 225 → 205; a
victory, 10 battles, 241 ms). The same row with the script taken out sent
no trade (a defeat, 11 battles). `diana`, not `mars`: the soldier starts
owning Mars, and a port sells no daemon already owned.

**Found: the corpus was red at HEAD.** `--record` re-drives the whole
table, and every journal came back changed. Replaying HEAD's own journals
against HEAD's baseline on the tree's src (`scratch/158a/replay-head.ts`):
9 of 33 differ, 3 diverging in a battle and 6 in the events outside
battles alone. It was recorded and passed at `794cc905`; the only commits
since under `config/` or `src/` are `98176860` (the officer's base
mobility, the user's change) and `8db7501c` (Dis Pater's sentence), both
meant, which is `--record`'s case. The re-record of the 33 landed on its
own, as `0b8e7b8b`; this step's commit adds the trade row alone.

**Built.** `Plants.port` in `tests/journalDrive.ts`: at a port, before the
row's own leave, the next command for this visit or null, asked again
after each one; a row without it drives as before. `tradesAtFirstPort`,
`TRADE_KINDS` and `tradesLost` in `corpus.ts`, a `trades` flag on a row,
and the row `player-9-hops-3-bits-300-script-1-port-rogue-overclock-diana`.
The seed-picked rows (chaos 16, 13 and 64) stay, their re-pick rule
deleted and their history condensed to a line. corpus.test.ts: the trade
row's own check, and its planted failure, the row re-driven with its
script taken out, which must lose all five. TESTING.md's corpus paragraph
was stale (it said selling a packet never changes a run, true until
2026-11-07): rewritten, with the count 34.

**Checked.** `npm run corpus`: 0 of 34 journals differ, 21 of 21 command
kinds change a run. The corpus test under `vitest.fuzz.config.ts`: 40 of
40, the planted failure among them (the row re-driven with its port taken
out of the script loses all five trades). `0b8e7b8b`'s hook: 3963 main
in 271 files, 588 smoke in 60, 1 `fuzz:jobs-parity`. Predicted and seen:
no snapshot change, no RNG stream; the other 33 journals unchanged by
this commit (the corpus check above replays them against `0b8e7b8b`'s
baseline lines).

### 158b — the forced-movement design, put to the user (2026-11-14)

**The probe** (`scratch/158b/probe.ts`, a 16 × 16 World, a stub behaviour
seating one step or one swap of 4 ticks, then a bare position write before
the flip, which is what a push that left the victim's action running
would do):

- *A step.* Moved from (2,2) to (2,5) before its flip, the unit stands on
  (3,2) after it: three cells from where the push left it, the claim
  released by the flip.
- *A swap's actor.* Moved from (6,6) to (6,9) before the exchange, it ends
  on (7,6) and its partner on (6,6): the actor jumps three cells back to
  the partner's cell. No overlap here only because both cells were free.
- *A swap's partner.* Moved from (7,6) to (7,9), the actor steps alone onto
  (7,6) and the partner stays where it was pushed: the safe case the
  exchange's own check already gives.

So fork 6's correctness half stands as read: a push ends the victim's step
and the actor's swap, whatever the call on strikes and spells.

**What the forks gained since the kickoff:**

- *Fork 6:* the swap already holds the rule the push breaks: "nothing under
  way is ever moved" (`SwapAction.ts:231-236`), so the push ends the
  action first, from parts that exist: `releaseClaimsBy`, the pre-flip
  swap test `preFlipSwap` with its `unit:swapAborted`, `unit:moveAborted`
  for a step, and `clearActiveAction`, which drops a swap's reservation.
  A spawn's lockout (`SpawnAction`, a unit fading in) is kept
  through a push, since it is not something the unit chose; a step's or a
  swap's cooldown is reset, as their aborts reset it today, so the unit
  retries from where it lands.
- *Fork 1:* inside one ability the def's op order decides whether its
  damage lands before its push, as it decides a status after a strike
  (`interpreter.ts`, "Order matters"); the grenade lists its damage first,
  so the blast hits the cells before it scatters them.
- *Fork 9:* only the landing cell is entered, so a pull across fire burns
  nothing on the way.
- *Fork 5:* how fast the slide is drawn is the look's, at §159.

**The tranches at the stop.** A, the thirteen forks, which §159 rests on.
B, after A's sign and before §160's kickoff: the cavalier's six and the
four calls (the draftable newcomers, the whirlwind's carrier, N3's flag,
the abilities' lines).

### 158b — tranche A signed, three forks reshaped (2026-11-16)

The user signed forks 1 to 4, 6 to 10 and 13 as leaned ("The others look
good!") and took three back to the design:

> For the push and pull timing, my lean is B. Push and pull should be
> thought of as the unit, well, moving involuntarily. […] I also am
> on-board with optional stuns after the push or pull.

> my original vision was that teleport was supposed to be strictly
> stronger than dash, because teleport would unlock new pathing
> possibilities. […] Oh, but that's a complete pathing overhaul, isn't it?

> What we're describing isn't really a charge, is it? It's more of a
> pounce. That'd be great for the animals, but maybe not the cavalier, no?

The session answered each with a lean. **Signed** ("YES! 😁 Okay, I love
that charge idea. Signing all of your leans, Claude!"):

- *Fork 5, the timing: the victim held for the slide.* Its cell changes
  when the push fires, since an outer victim must leave its cell before an
  inner one is pushed into it (fork 8), and a new action holds it busy
  until the slide ends; fork 6 ends what it was doing first. The hold is a
  stun, so the slide's speed is a balance number: one fast rate per cell
  for every unit (about 0.15 s, a two-cell push holding its victim 0.3 s),
  set at §159 with the look, not the victim's own step time (1.4 s for a
  mobility-4 unit pushed two cells, and longer the slower the unit). A
  longer stun is an `applyStatus` after the push, chosen per ability. The
  new action is serialized: a World bump at §159 (v39 → v40; no player
  save holds a World).
- *Fork 11, the teleport: the blink and its approach, not a new
  pathfinder.* The blink's range is a straight-line distance and its
  landing ignores what stands between (walls, chasms, bodies), so a target
  in range is reached whatever blocks the path: strictly stronger than the
  dash, which walks the path and stops at the first body. The landing as
  leaned: the free cell beside the target farthest from the caster, on the
  cast tick, no claim. While the blink is ready, the ninja walks to the
  nearest cell with its target in blink range, the search a ranged unit
  makes for a firing cell (`nearestActingCell`, `actingPosition.ts`) with
  the blink's range and no sight check; while it cools, its reach is
  melee. New beside the search is a reach that changes with a cooldown:
  `derived.attackRange` is fixed per archetype, and `engagementReach`
  gives a `self` def none. Not built: the pathfinder pricing blinks into
  its routes (waiting at a wall for the cooldown, chained blinks), which
  would touch every unit's routing for an effect the two layers mostly
  give at a range of 5 or 6 on a long cooldown.
- *The cavalier's charge: a push the cavalier gives itself.* 157's preview
  (a leap along the path, a hit on arrival) is a pounce, as the user read
  it. The charge rushes along a straight line drawn toward its target's
  cell, held busy and fast by §159's action, and stops at the first body
  or impassable tile; an enemy there takes the hit and a knockback, and an
  ally, a wall or a tile ends the charge without one. It needs a run-up,
  so it never charges from two cells away; a small bonus per cell
  travelled makes a long run-up worth taking (157's lean against damage by
  distance rested on its World bump, which fork 5 now brings anyway).
  After the hit it fights in melee until it has room to charge again, the
  knockback reopening the gap; a wheel-away after each charge is a later
  dial, if play wants one. This supersedes four of 157's six: the first
  body on the line, not the enemy charged; a straight line, not the path;
  damage by distance; the run-up's length, set at §161. The knockback
  stands; the body goes to tranche B.
- *Fork 12, the hit after a leap* (C5), as leaned. Its consumer is now a
  pounce, the beasts' if tranche B signs it, not the cavalier.

*Carried to §161's kickoff:* when the charge's hit lands. The cavalier's
cell changes as the charge fires and its glyph arrives a slide later
(about 0.75 s for five cells at the push's rate, time for its victim to
step away); the lean is fork 12's rule, the hit at the end and only if
the body is still beside it. With it, the line on a grid (any drawn line,
or the eight directions alone) and whether it passes diagonally between
two blocked cells.

**Tranche B, put to the user**, since §160's and §161's units rest on it:

1. *The pounce on the beasts.* The puma's and the fox's `pounce` is their
   basic strike (range 1, 1.5 s) with no leap. Lean: the puma gets a
   pounce of its own, a leap and a hit on a cooldown beside its strike,
   the shared strike takes a new name, and the fox keeps its dash. The
   puma's line ("Waits in the undergrowth for something to pass.") is the
   ambush; the fox's ("gone before the swing lands") is the evasion its
   dash already carries. The puma fights in the Periphery's Cats! elite
   and the Divine Bear's second stage and guards a camp, so act 1's fights
   move, read at §162 against 155g's sheet. The other arms: both beasts
   (the fox's dash gains the hit), or neither this round, which leaves C5
   without a consumer and so out of the round.
2. *The cavalier's body*, the last of 157's six: one cell, high mobility,
   a melee weapon, the charge on a long cooldown (the dash's 10 s to
   start), its numbers at §161. Lean: as previewed.
3. *Which new units are draftable.* Lean: all four (the grenadier, the
   telekinetic, the ninja, the cavalier), each also an enemy in one act-2
   or act-3 encounter; each needs a prior-table row, a thin row's
   `--grant` arm about 3.7 CPU-hours at §162. The other arm: enemies only.
4. *The whirlwind's carrier.* Lean: a special on the ronin, which carries
   the katana alone; a spinning blade fits its sword, and it registers no
   new archetype (glyph, prices, two fuzz-strategy records, a prior-table
   row). The other arm: a fifth new unit, which is where the user's line
   sat (among unit ideas).
5. *N3's flag.* Every burst the round plans hits enemies (the banshee's,
   the telekinetic's, the whirlwind), and `affects: 'enemies'` already
   leaves the caster out (the banshee's `wail` is `enemies` today), so the
   flag has a consumer only if a burst should also move or hit allies.
   Lean: none should, since an unaimed burst that throws the player's own
   melee off its target reads as a bug; the flag is not built and goes to
   Round 14 with `affects` as flags. The other arm: the telekinetic throws
   everything around it, friend and foe, and the flag ships with it.
6. *The abilities' lines.* Lean: the session drafts each `description`,
   read at each phase's stop; the units' lines stay the user's (151f).

### 158b — tranche B signed but the pounce (2026-11-16)

**Signed** ("Signing all leans except for 1"): calls 2 to 6 as leaned.
The cavalier's body as previewed; all four new units draftable, each also
an enemy in one act-2 or act-3 encounter; the blade whirlwind a special
on the ronin; N3's flag not built, carried to Round 14's `affects` as
flags; the session drafts the abilities' lines.

**Call 1 reopened.** The user: "the leap doesn't actually need a
cooldown, right? It just needs a min range. Once it fires, it won't fire
again until a more distant target is chosen, right?" Read against the
code:

- *Today's leap has no upper gate.* `proposeSelfMove` abstains only when
  the target is within strike reach (`propose.ts:144`); otherwise
  `leapLanding` walks up to `rangeCells` along the route and lands before
  the first body (`movement.ts:241-263`), whatever the distance. The
  dash's 10 s hides this. With no cooldown, a target beyond the leap's
  range would draw a chain of leaps, and so would a route a body cuts
  short: the leap would be the puma's walk at a quarter-second a hop.
- *With a gate it holds.* A pounce that proposes only when its landing
  puts the target within strike reach, and only from at least its
  `minRangeCells` (read by the leap for the first time, as the charge's
  run-up needs), lands beside its target and then strikes. It fires again
  when the gap reopens: a new target farther off (the target dead, or a
  `nearest` switch, which takes a rival only when it is 1.5 times closer,
  `SIM.retargetCloserRatio`), or the same one moving away (a unit kiting,
  a push on either). A floor of 3 keeps the rogue's gambit, a one-cell
  spring-back after its strike, from setting it off each swing.
- *No cooldown in effect.* The schema wants a positive `cooldownSeconds`
  (`schema.ts:383`), floored at a tick (`timeline.ts:40`), so the pounce's
  is its own length.

Revised lean put: the puma alone, its pounce gated as above with no
cooldown in effect, the strike it shares with the fox renamed, the fox
keeping its dash.

### 158b — the pounce signed, the charge's cooldown kept (2026-11-16)

**Signed** ("Signing call 1 as revised! 😁 We'll keep the charge
cooldown, though"): the puma alone takes a pounce, a leap and a hit
beside its strike, proposed only from at least its minimum range (3 or
more, set at §161) and only when the landing puts its target within
reach, with no cooldown in effect; the strike it shares with the fox
renamed; the fox keeps its dash. The session had noted the same gate
would let the charge go without a cooldown, and leaned to keep it, since
its knockback ends the victim's action and the cooldown bounds how
often; the charge keeps its long cooldown. 158b is signed whole.

### §158's close (2026-11-16)

**The exit by clause.** *The row holding the five trades on its own
test:* 158a, the row's check and its planted failure among the corpus
test's 40 of 40. *The design signed:* 158b, tranche A and tranche B,
both 2026-11-16.

**What §158 hands on.**

- *To §159, the seam:* the `push` op (forks 1 to 4, 6 to 10 and 13), the
  victim held for the slide at one fast rate per cell (fork 5), a World
  bump; the rate and the look a `stop`.
- *To §160:* the four newcomers draftable, each also an enemy in one
  act-2 or act-3 encounter; the whirlwind a special on the ronin; N3's
  flag gone to Round 14.
- *To §161:* the teleport and the ninja's approach (fork 11); the hit
  after a leap (fork 12) for the puma's pounce; the cavalier's charge, a
  push on itself on a long cooldown; carried, when the charge's hit lands
  and how its line is drawn.
- *To §162:* the puma's change in act 1, read against 155g's sheet.

**The friction read.** Two lines filed across §157 and §158, both slips
of this session: the units file's shape re-guessed after it had been
parsed (157), and the pounce's cooldown leaned by analogy with the dash
before the leap's gates were read (158b). Both are a premise used before
it was read; each cost one or two tool calls, the second a call re-put
to the user. It recurred and cost a little, so it goes to the user as a
candidate; the session's lean is no new rule, since step zero already
covers a build, and a lean written in a design stop is one the user
reads before anything rests on it. No `papercut` and no `distress` line
filed, so nothing to dispose of or quote.

**Sessions.** One session ran §157 and §158 (`06280e35`); it runs on
into §159's kickoff, and its report, at its end, covers both.
