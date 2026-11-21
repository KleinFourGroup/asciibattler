# WORKLOG — Round 12 (Push, pull and blink)

Per-phase narrative log (AGENTS "The planning stack"; `process/planning.md`
"The artifacts"): findings, decision rationale, rejected alternatives,
scope changes, playtest verdicts and the checks run land here under the
matching `## Phase N`; the ROADMAP stays a plan. The file holds the phase
in progress: at each phase close it moves to `archive/worklog-phase-N.md`
and a fresh one starts. Round 12's phases before this one are in
[archive/worklog-phase-158.md](archive/worklog-phase-158.md) (the kickoff,
§157, and the pre-step and the design, §158),
[archive/worklog-phase-159.md](archive/worklog-phase-159.md) (forced
movement, the seam),
[archive/worklog-phase-160.md](archive/worklog-phase-160.md) (the pushers
and the bursts) and
[archive/worklog-phase-160.5.md](archive/worklog-phase-160.5.md) (the
fall); Round 11's are
[archive/worklog-phase-149.md](archive/worklog-phase-149.md) to
[archive/worklog-phase-156.md](archive/worklog-phase-156.md).

## Phase 161 — the blink and the charge

The kickoff's inputs, by pointer: what §160.5 hands on
(`archive/worklog-phase-160.5.md`, "§160.5's close"); ROADMAP §161;
`process/planning.md` "Phase kickoff".

### The kickoff's audit, and the cut put to the user (2026-11-21)

Read at `2342e758`. The design is 158b's (`archive/worklog-phase-158.md`,
"tranche A signed" to "the pounce signed").

- *The leap and its target.* `proposeSelfMove`
  (`src/sim/effects/propose.ts`) takes its landing from `leapLanding`
  (`src/sim/movement.ts`) and seats the action with `targetId: -1`, so
  `executeDamage`'s single-target path finds no unit and a damage op
  after the move hits nothing (C5). The leap reads no `minRangeCells` and
  abstains only within strike reach, so with no cooldown in effect a
  pounce would chain (158b). `leapLanding` builds on
  `buildMovementContext`, so its landing already avoids claims
  (gotcha #113).
- *The dash's landing is not an entry.* `executeMove`'s `advance` sets
  the position and emits `unit:moved` and `unit:dashed`, and runs no
  `applyTileEnterEffects`, which a step, a swap and a forced move's
  landing run. Fork 9 signed the dash's entry, held at §159 for the
  teleport so the corpus moves once for it (`archive/worklog-phase-159.md`).
  The tiles it changes: mud poisons on entry, shallow water douses a burn
  (`TILE_DEFS`, `src/sim/TileGrid.ts`).
- *The teleport has no op.* `move` has two modes, `advance` and `retreat`
  (`schema.ts`). A third with its own landing carries that landing in
  `OpResolution.moveDest`, as the leap does, so no new serialized field.
  It places a unit on a vacant cell, so its landing folds in claims
  (gotcha #113 names the teleport).
- *The ninja's approach.* `engagementDirective` (`src/sim/positioning.ts`)
  adds a firing cell from `nearestActingCell` (`src/sim/actingPosition.ts`)
  only when `derived.attackRange > 1`; the search already takes a null
  sight list (the catapult's) and caps its depth at the range plus
  `SIM.actingCellSearchSlack` (2). A ready blink adds that cell as the
  first goal at the blink's range. The directive reads no cooldowns, so
  its caller passes whether the blink is ready. `derived.attackRange`
  stays the melee weapon's, so the hold, the swap's role order
  (`movement.ts`) and the targeting reach checks are unchanged.
- *The charge cannot ride the push op as built.* With a `self` selector
  the push's victim is the caster and its origin the caster's own cell,
  so `pushLanding` finds no direction and returns null. `World.forceMove`
  ends what its unit is doing, an ability "cleared with nothing more
  fired", so a push on itself from inside the charge's action would end
  that action before its hit. And `pushLanding` walks one of the eight
  directions, the sign of the offset, so a foe off a rank, file or
  diagonal is missed (an offset of (5,2) walks (1,1) and passes it). What
  carries over: the walk's stops (an impassable tile, a body, a claim),
  the rate (`SIM.pushSecondsPerCell`, 0.15 s a cell), the cell changing
  as the move fires, and the knockback on the foe it hits, which is the
  push op as built and so drops its victim (§160.5).
- *The charge's reach.* An `enemyInRange` def with a `rangeCells` of 5
  would give the cavalier a reach of 5 (`engagementReach`,
  `src/sim/archetypes.ts`): it would hold and kite at its band like an
  archer and take the ranged side of the swap's role order. A charge's
  reach is null, as a pull's is, so the cavalier closes as melee. That
  function's comment "No shipped def anchors an aoe on the caster" is
  stale since §160 (Repulse, the whirlwind, the Wail): fixed in passing.
- *Lines on the grid.* Line of sight walks Bresenham
  (`src/sim/LineOfSight.ts`) and passes diagonally between two blockers
  that touch at a corner, as the push's walk and a step do.
- *The look.* `unit:dashed` is heard by the sound registry alone
  (`src/audio/eventSounds.ts`), and the renderer draws every move from
  `unit:moved` as a slide (`BattleRenderer.onUnitMoved`), so a blink
  across a wall slides through it until its look is drawn.
- *The pounce.* `pounce` is the fox's and the puma's basic strike (range
  1, 1.5 s); the fox also carries the dash. The puma fights in the Cats!
  elite and the Divine Bear, both act 1, and guards the Puma's Lair camp,
  so act 1's fights move (read at §162, 158b).
- *A new unit* registers as at §160 (its audit): `config/units.json`,
  `config/abilities.json`, both records in `config/fuzz-strategies.json`,
  the two locale files, a base price, a PENDING prior row
  (`tests/prior-table-coverage.test.ts`) and a description per ability.
  41 units and 35 abilities. Free letters: d e i j l n o p q t u v w x y
  and D E F J K N O Q S T U X Y Z; the epaulettes can go on any letter
  (U+E020 and U+E021 wear them). The draft pool is one pool by rarity:
  uncommon holds five (adventurer, ronin, mage, gunslinger, grenadier),
  rare six.
- *The pools* (`config/sectors.json`): act 2's normal encounters are the
  Brigands, Highwaymen, Deserters, the Artillery Company, the Ronin and
  the Mages and the Guarded Adventurer, its elites Brigand Champions and the Warband
  Vanguard; act 3's normal encounters are the Infernal Column, Plague
  Victims, Miscreants, the Elemental Trio, Plague Doctors, Artillery and
  the Guarded Adventurer, its elites Plague Spreaders and the Dark Magic
  Posse.

**The cut, put to the user.** No batch runs in §161 (the board is
§162's). No World or Run bump is predicted anywhere, and no RNG stream:
the blink and the charge draw nothing, and the pounce's and the charge's
hits draw a crit from `combatRng` as any strike does.

- **161a — the glyphs** (`stop`): two to four candidates each for the
  ninja and the cavalier in the sampler, beside the shipped glyphs they
  could be taken for, a lean each; the cavalier may wear the epaulettes.
  No commit, unless a signed glyph needs a new row in the font.
- **161b — the hit after a leap** (`none`): a leap keeps its enemy's id;
  a damage op on a phase after the move hits it only if it is alive and
  within reach of the landing; the leap reads `minRangeCells`; a leap
  carrying a hit proposes only when its landing puts its target within
  reach. Exit: a test per rule on synthetic defs, each with its plant.
  Predicted: the smoke fires; the corpus replay 0 of 34 differing (the
  dash carries no hit, and a `self` def surfaces no target to the
  renderer, `phaseTarget`).
- **161c — the blink, and the dash's landing as an entry** (`none`): a
  `move` mode `blink`, in range by Chebyshev distance and blind to what
  stands between, landing on the free, unclaimed cell beside its target
  farthest from the caster, on the cast tick; it never falls, and its
  landing is an entry. The dash's landing becomes an entry too. While a
  blink is ready, the unit's first goal is the nearest cell with its
  target in blink range, with no sight check. Exit: a test per rule with
  its plant (across a chasm and a wall where the dash stops, the
  landing's choice and its claim, the approach while ready and melee
  while cooling, a dash onto mud poisoned). Predicted: the smoke fires;
  the corpus moves only where a dash lands on mud or shallow water, a few
  of 34 (`--record`; the count is the journals whose replay differs).
- **161d — the charge** (`none`): a `move` mode `charge`. At cast it walks
  a Bresenham line toward its target from at least `minRangeCells`,
  stopping before the first body, impassable tile or claim; the caster is
  on that cell at once and held by its own action's `travel`, sized to
  the cells at the push's rate; at `impact` the foe it met takes the hit,
  with a bonus per cell walked, and a knockback (the push op, so it
  drops), if still beside. Its reach is null. Exit: a test per rule with
  its plant (a line off the eight directions, the run-up's floor, the
  stop at an ally and at a wall, the hit missed when the foe stepped
  away, the bonus, the knockback's drop, the caster never falling, its
  reach melee). Predicted: the smoke fires; the corpus 0 of 34 (no
  shipped def carries it).
- **161e — the puma's pounce** (`batch`): the strike the fox and the puma
  share renamed; the puma's own pounce, a leap and a hit from three cells
  or more with no cooldown in effect; a line. Exit: a test from the raw
  config that a puma three cells off leaps and strikes on landing, and
  one two cells off does not leap. Predicted: the smoke fires; journals
  where a puma fights move (`--record`). Read: `?seed=5&encounter=cats`;
  wrong looks like a puma that leaps and doesn't strike, leaps every
  swing, or never leaps.
- **161f — the ninja** (`batch`): draftable, with a one-cell blade and the
  blink; a line each; an enemy in one act-2 or act-3 encounter. Exit: a
  test from the raw config that a ninja blinks across a chasm to a foe
  the dash cannot reach and strikes it. Predicted: the smoke fires; most
  of the corpus moves, since its tier's picks change (`--record`). Read:
  its URL on a chasm map; wrong looks like a ninja walking the long way
  round with its blink ready, or blinking where it cannot strike. Its
  blink slides until 161h.
- **161g — the cavalier** (`batch`): draftable, one cell, high mobility, a
  melee weapon and the charge on a long cooldown; a line each; an enemy in
  one act-2 or act-3 encounter. Exit: a test from the raw config that a
  cavalier three cells off charges, hits and knocks its foe back, then
  fights in melee. Predicted as 161f. Read: its URL; wrong looks like a
  cavalier that hangs back like an archer, charges from two cells, or
  charges into its own side.
- **161h — the look and the sound** (`stop`): the dash's trail; the blink
  drawn as a vanishing and an appearing with a flash, never a slide
  through a wall; the charge's rush and hit; each with a cue. Two arms
  each, with URLs (rogues, the ninja on a chasm map, the cavalier).
  Predicted: no sim touch, the smoke silent, the corpus unchanged.
- **161i — the play** (`stop`): the pounce, the ninja and the cavalier in
  play: their names, lines, numbers, rarities, prices and encounters.

**Calls, each with the session's lean:**

1. *The charge's mechanism:* its own action holds it (the `charge` mode
   above), not `World.forceMove` on itself, which §159's close named for
   it and which would end the charge before its hit. What the charge does
   is 158b's; only the part that holds it changes.
2. *When its hit lands:* as the slide ends, and only if the foe is still
   beside (fork 12's rule). The other arm: as the charge fires, the blow
   landing before the glyph arrives (about 0.75 s for five cells).
3. *The line:* a drawn line, the one sight takes. The other arm, the
   eight directions alone, charges only at a foe on a rank, file or
   diagonal: 8 of the 8d cells at a distance of d.
4. *A diagonal between two blocked cells:* the charge passes, as sight,
   the push's walk and a step do.
5. *When it fires:* only when its walk is at least two cells long and
   ends beside a foe (the charge's target or another in the way, the
   first body as signed), as the Snag waits for room. The other arm:
   charging into an ally or a wall and stopping there with no hit.

**Leans built on, listed at the reads:** the ninja uncommon, on the
rogue's stat line a step up, the blink at a range of 5 on 10 s flat; the
cavalier rare, mobility 7, a sabre, the charge from 3 to 5 cells with +1
might a cell walked, a knockback of 1, 10 s flat; the strike the fox and
the puma share renamed Swipe, and the puma's pounce from 3 to 4 cells;
the ninja an enemy in act 3's Miscreants (rogues and warlocks), the
cavalier in act 2's Warband Vanguard; until 161h, sounds reused (the
blink the dash's whoosh, the charge the shove and the swing); a PENDING
prior row for each, measured at §162's board; the abilities' lines the
session's, read at 161i.

**Signed** ("I think that all looks good, Claude! 😁 I'm not seeing
anything that stands out as wrong, though I suspect that this is one of
those ones where I won't know it until the play tests 😅", 2026-11-21):
the cut and its reads as put, and every call on its lean. The stretch:
161a's stop first, then 161b to 161g with their reads, to 161h's stop.
