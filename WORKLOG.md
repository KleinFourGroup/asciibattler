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

### 161a — the glyphs, put (2026-11-21)

In the sampler at
`?bp=board-open15_pose-sampler&glyphFace=/scratch/161a/trial.otf&glyphs=n,N,j,r,h,m,M,H;U+E030,U+E031,U+E032,U+E033,C,k,V,U+E021,U+E020`.
`scratch/161a/build.ts` composes `trial.otf` with the production builder
from the shipped table and radicals plus four trial rows, the
epaulettes on C, K, N and v (U+E030 to U+E033). All of them drew in the
pane, the trial rows from the trial face. **The ninja** (plain, since
it is neither soldiery nor a beast): `n` (the lean), the rogue's `r`
grown a second leg, an upgraded rogue in its shape; `N`, a third
upright stroke beside the mercenary's `M` and the halberdier's `H`; `j`,
distinct but a thin mark. Beside them the rogue's `r`, the healer's
`h`, the mage's `m`. **The cavalier**, wearing the epaulettes as elite
troops do: `K` (the lean), for knight, a letter no unit uses, told from
the telekinetic's `k` by its case and the epaulettes; `C`, its initial,
told from the corrupter's plain `C` by the epaulettes alone, as the
rat's eared `r` is from the rogue's, but both are draftable; `N`, the
knight's letter in chess notation, beside the ninja's `n`; `v`, from the
name, beside the reaver's `V`. Beside them the officer's and the
grenadier's epaulettes.

### 161a — signed, and the drawn glyph's initial (2026-11-21)

**Signed** ("I agree with both of those leans, Claude! 😁"): `n` for the
ninja, the epauletted `K` for the cavalier.

Before the font's row was added, DESIGN's drawn-glyph paragraph (§144,
signed 2026-10-31) was read: a drawn glyph is "JetBrains Mono's own
letter, the unit's initial, so a player can still name it (the fallen
strip writes `r×2`)". Every drawn glyph keeps it (the six beasts, the
officer's `O`, the grenadier's `g`); a `K` for the cavalier would be the
first that does not. The plain glyphs already depart from it in four
places (the reaver's `V`, the stormcaller's `z`, the rioter's `f`, the
telekinetic's `k`). The put named the corrupter's `C` but not this
rule, so the sign was given without it: asked again.

**Signed** ("Let's just stick with the rule; the epaulets are distinctive
enough--that's the whole point of the radicals, and if they aren't
enough, we need to redesign them 👍"): the epauletted `C` for the
cavalier, told from the corrupter's plain `C` by the radical alone.

**Built.** A row in `assets/fonts/asciibattler-glyphs/glyphs.json`,
U+E022 `C.epaulettes`, unused until 161g adds the cavalier; `npm run
gen:font`: 11 drawn glyphs, the 42 live atlas glyphs all in a shipped
face, the two subset faces unchanged. DESIGN's glyph paragraph names the
cavalier when it lands.

### 161b — the hit after a leap (2026-11-21)

`proposeSelfMove` keeps its enemy's id on the action, reads the def's
`minRangeCells`, and for a leap carrying a damage op abstains unless the
landing puts the enemy within the caster's reach (`cellUnitDistance`). In
a def that leaps (a `move` in `advance` mode), a single-target damage op
lands only within the caster's reach from where it stands as the op
fires (`withinLandingReach`, `src/sim/effects/interpreter.ts`), on both
the `commit-at-cast` and `fizzle` paths, with no draw when it misses. A
`self` def surfaces no target to the renderer, so the dash draws as
before.

Step zero found that a leap's `applyStatus` and `push` act on the caster,
as the `self` selector says (a stun in a trial pounce landed on the
pouncer), so the miss is not recorded in the boundary's scratch here:
nothing on a leap reads it. The charge, an `enemyInRange` def, records it
at 161d, where its knockback reads it.

`src/sim/effects/leapHit.test.ts`, six tests; 8 plants, all caught,
control clean (`scratch/161b/161b-plants.json`), run in a worktree of
their own by `scratch/161/wt-plant.sh`, so a plant never reloads a dev
server's page. The corpus: predicted 0 of 34, **0 of 34 differ**.

### 161c — the blink, and the dash's landing as an entry (2026-11-21)

A `move` mode `blink` (`schema.ts`): proposed only with the enemy within
`rangeCells`, body to body, and landing where `blinkLanding`
(`src/sim/blink.ts`) puts it: the free, unclaimed, passable cell beside
the target farthest from the caster by Chebyshev distance, ties to the
one nearest the straight line and then to scan order, so it passes
walls, chasms and bodies and never lands on a tile that drops. A leap's
and a blink's landing now runs the tile's enter effects;
`unit:dashed` carries `blink: true` for a blink and nothing new for a
dash, so the dash's events are unchanged. `Ability.blinkRange` surfaces
a blink's range; `readyBlinkRange` (`MovementBehavior`) reads it with
the cooldown, and `engagementDirective` puts the nearest cell with the
target in that range first among its goals, searched with no sight
list. The attack editor offers the mode.

`src/sim/blink.test.ts`, eleven tests; 14 plants, all caught, control
clean (`scratch/161c/161c-plants.json`, in the worktree). The corpus:
predicted "a few of 34", only where a dash lands on mud or shallow
water; **5 of 34 differed** (chaos-4, -5, -8, -13 and -16), and with the
entry's one line mapped out in the worktree 0 of 34, so the five are the
dash's entry alone. Re-recorded: four journals and the baseline; the
replay 0 of 34 differing.

### 161d — the charge (2026-11-21)

A `move` mode `charge` on an `enemyInRange` def, signed with its calls
at the kickoff. `chargeWalk` (`src/sim/charge.ts`) walks `lineCells`,
the Bresenham line `hasLineOfSight` takes, as cells, and stops before
the first body, claim or tile of infinite cost, so it passes diagonally
between two corner blockers as sight does and never falls.
`proposeCharge` (`propose.ts`) takes the target within
`[minRangeCells, rangeCells]` and proposes only when the walk is two
cells or more and meets the target or a hostile in the way, which
becomes the action's target; never an ally, scenery or a passive camp.
The cells walked add a damage op's new optional `mightPerCell` at cast,
and size the `travel` phase at `SIM.pushSecondsPerCell`. The move fires
on `travel`, putting the caster on its landing at once (an entry), with
`unit:moved` and `unit:shoved`, so it draws and sounds as a yank until
161h. At `impact` the hit lands only within reach (161b's gate); a miss
is now recorded on the boundary's scratch, so the knockback after it
skips the foe, and the knockback is the push op as built, so it drops.
`engagementReach` gives a charge none, and its stale line about
caster-anchored areas is gone. The schema refuses a charge off the
`enemyInRange` selector, off a `travel` phase, or beside a `'fill'`
phase. The attack editor offers the mode and the field.

`src/sim/charge.test.ts`, eleven tests, one of them holding `lineCells`
to `hasLineOfSight` over every pair and blocker in an 11 × 11 square;
18 plants, all caught, control clean (`scratch/161d/161d-plants.json`).
The first run missed one: with the run-up floor removed, the two-cell
walk gate still refused a foe two cells off, so the floor had no test of
its own; a def with a floor of 4 now refuses a three-cell charge the
walk would allow. The corpus: predicted 0 of 34, **0 of 34 differ**.

### 161e — the puma's pounce (2026-11-21)

The strike the fox and the puma shared, `pounce`, is renamed `swipe`
("Swipe", "A quick swipe of the claws."), its numbers unchanged. The
puma's own `pounce`: a `self` def, a leap of up to 3 cells
(`rangeCells`) from a floor of 3 (`minRangeCells`) on a 0.25 s `travel`,
then a hit at the swipe's numbers (might 2 on strength, crit base 0.05)
as it lands, a 0.3 s recovery, and a flat cooldown of 0.55 s, its own
length, so none is in effect: 161b's gates decide when it fires, so it
reaches a foe three or four cells off. The puma carries `swipe` then
`pounce`; the fox `swipe` then the dash. The line, the session's:
"Leaps on a foe three or four cells off and strikes as it lands."
DESIGN's beasts paragraph says so.

`src/sim/puma.test.ts`, three tests reading the raw config files; 3
plants in the config, all caught once the hit's might was read inside
its test (a plant that removed the hit first crashed the file at load,
which the harness reads as no named failure); control clean
(`scratch/161e/161e-plants.json`).

The corpus. Predicted before the run, from `scratch/161e/pounce-strikes.ts`
at HEAD in the worktree: exactly the 23 of 34 journals that fire the
shared strike move, since the rename changes the action id in their
`action:phase` events. **23 of 34 differed, the same 23**
(`scratch/161e/head-set.txt` against `moved-set.txt`). On this tree the
new leap fires in 11 of them. Re-recorded: every journal (its config
hash) and the baseline; the replay 0 of 34.

**Read (`batch`, at 161h's stop):** `?seed=5&character=soldier&firstNode=elite&encounter=cats`,
the Cats! elite in the Periphery; wrong looks like a puma that leaps and
doesn't strike, leaps on every swing, or never leaps.

The hook's first run refused the commit on two tests, both fixed in it:

- *The card's reach.* The pounce is a thirteenth ability with a floor, and
  the card read it "reach 3–3", the leap's length. A leap that strikes
  lands a cell short of its foe, so it fires at foes 3 to 4 cells off;
  the card's `reachPart` adds that cell for a `self` leap, the pounce
  reading "5 dmg · reach 3–4 · 9% crit", and the card test derives the
  same from the raw config (its floor count 13). A plant of the old
  reach is caught.
- *The chaos census.* The pounce moved the walks: the two-hop slot (seed
  1) stopped clearing a sector and the Gambler slot (seed 11) stopped
  redrawing. Swept (`scratch/161e/chaos-sweep.ts`): seed 8 is the
  shortest of 40 two-hop seeds that clears one (0.6 s alone); of 120
  Gambler seeds, none redrew, bought a packet and rested inside a slot's
  time (66 and 68 did, at 6 s and 12 s alone), so seed 11 keeps the
  packet, the rest and the decline, and a fifth slot, Gambler seed 69,
  takes the redraw (0.2 s alone, nothing the blind list holds). Both
  census lists stand as they were; the hook runs one more seed.
