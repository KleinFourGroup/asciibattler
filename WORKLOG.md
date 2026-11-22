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

### The hand-off after 161e (2026-11-21)

Session `a2587a0c` ran §161's kickoff, 161a's stop and 161b to 161e, and
hands off at the context trigger after 161e's commit.

**Done:** 161a (the epauletted `C` in the font, unused until 161g), 161b,
161c, 161d (`none`, their oracles in their entries), 161e (`batch`, built
and unread, ◐: its read script is in its entry, read at 161h's stop).
**Open:** 161e's read; 161f, 161g and 161h's stop. No call waits on the
user; every lean the cut listed stands as signed.

**161f is prepared, not applied.** `scratch/161f/edit1.cjs` (the ninja in
`config/units.json`, `ninjato` and `blink` in `config/abilities.json`,
the Miscreants' ninja at weight 0.5, its price 28, the registry's two
ids), `scratch/161f/edit2.cjs` (`"ninja": 0` appended to the strategy
vector and the five fixtures, gotcha #124; the PENDING rows in the prior-
and roster-table coverage tests; the blink beside the dash in the fx
test's list), and `scratch/161f/ninja.test.ts` (to go to
`src/sim/ninja.test.ts`). Then `npm run i18n:extract`. A dry run of all
of it in the worktree: the ninja's three tests pass, and the whole suite
fails only the chaos census, so expect a re-pick there
(`scratch/161e/chaos-sweep.ts '<dials>' <from> <to> [kinds]`; the WORKLOG
161e entry says which slot carries which kind). Then the corpus
(`--record`), plants, DESIGN's newcomers paragraph and the ninja's `n`.

**161g's leans** (the cut's, signed): rare, mobility 7, a sabre, the
charge from 3 to 5 cells (`minRangeCells` 3, `rangeCells` 5) with
`mightPerCell` 1 and a push of 1 on `impact`, 10 s flat; its glyph
U+E022; an enemy in act 2's Warband Vanguard. The charge's def shape is
161d's test def (`src/sim/charge.test.ts`, `charge()`).

**161h:** the arms behind a board-panel dial, as 160.5c's `fall` dial
(`src/dev/boardPanel/state.ts`); `unit:dashed` (with `blink`) and the
charge's `unit:shoved` are the hooks; the renderer slides every move off
`unit:moved` today (`BattleRenderer.animateStep`).

**Tools no doc names:** `scratch/161/wt-plant.sh <plants.json>` and
`scratch/161/wt-sync.sh` run plants and probes in a worktree so a planted
edit never reloads a dev server's page; the worktree's path is in this
session's scratchpad (`git worktree list`), so a new session points `WT`
at its own (`git worktree add --detach <path> HEAD`, then a junction from
its `node_modules` to the main tree's). `tests/build-id.test.ts` fails in
that worktree under the whole suite and passes alone: the worktree's,
not the code's. `scratch/161e/pounce-strikes.ts <actionId>` counts an
action's phases per corpus journal, for a prediction.

### 161f — the ninja (2026-11-21)

Session `23a263b2` takes over from the hand-off above. The **Ninja** `n`:
uncommon, draftable, on the rogue's stat line a step up (constitution 18,
strength 4, mobility 5, strength's and mobility's growth 0.22), power 1
as its rarity sets. Its **Ninjato**: a one-cell blade, might 2 on
strength, crit base 0.15, on the rogue's 1.2 s with no windup. Its
**Blink**: the `blink` mode at a range of 5 on a flat 10 s, the dash's
0.25 s impact and priority. The lines, the session's: "A short,
straight blade, quick from the sheath." and "Vanishes and reappears
behind a foe up to five cells off, whatever stands between." Its base
price 28, the grenadier's. As an enemy it fights in act 3's Miscreants,
at weight 0.5 beside the rogues' 1 in the first wave. The joins: the
registry, `"ninja": 0` in the strategy vector and the five fixtures
(gotcha #124), the PENDING rows in the prior- and roster-table coverage
tests, the blink's row in the fx test, the locale files. DESIGN's
newcomers paragraph names it. `npm run gen:font`: 43 live atlas glyphs,
every face unchanged.

`src/sim/ninja.test.ts`, three tests from the raw config files: the
ninja's kit and its encounter; on a board split by a chasm two columns
wide, it ends across, beside a foe the chasm parts from it, having
struck it for the blade's damage; a rogue in its place never
reaches the foe. 6 plants, all caught, control clean
(`scratch/161f/161f-plants.json`).

The hand-off expected a chaos re-pick: the dry run failed the census.
The whole suite passed with the census as it stands, so no slot moves;
by the files' times the dry run was made before 161e's commit re-picked
two slots.

The corpus. Predicted before the run: most of 34, since the uncommon
tier gains a sixth member. **12 of 34 differed.** With the ninja
undraftable in the worktree, 0 of 34 differed, so the 12 are the
draft's alone and no journal meets the Miscreants' ninja. Why fewer than
most was not measured. Re-recorded: every journal (its config hash) and
the baseline; the replay 0 of 34.

**Read (`batch`, at 161h's stop):** `?seed=5&character=soldier&roster=ninja:3,ninja:3,rogue:3,mercenary:3&layout=spiralFireLife`,
on the spiral's chasm; wrong looks like a ninja walking the long way
round with its blink ready, or blinking where it cannot strike. Its
blink slides until 161h. The URL is checked in the pane at 161h's put.

### 161f-post — the blink's card (2026-11-21)

Found while reading the cavalier's card at 161g: the ninja's card read the
blink as "dash 5", since the card's branch for a pure reposition labelled
every one a dash. It reads "blink 5" now, and a test pins the label at the
blink's range from the raw config; a plant of the old label is caught
(`scratch/161g/blink-card-plants.json`).

### 161g — the cavalier (2026-11-21)

The **Cavalier**, the epauletted `C` (U+E022, 161a's row): rare,
draftable, on a body of the session's between the mercenary's and the
reaver's (constitution 22, strength 4, luck 4, defense 2, speed 6,
mobility 7 as the lean, power 2 as its rarity sets). Its **Sabre**: a
one-cell blade, might 2 on strength, crit base 0.1, 1.5 s. Its
**Charge**: 161d's test def as the lean put it, from 3 to 5 cells
(`minRangeCells` 3, `rangeCells` 5), might 2 and `mightPerCell` 1, crit
base 0.05, a knockback of 1 on `impact`, a flat 10 s, priority 10 beside
the sabre's (their bands never overlap). The lines, the session's: "A
light cavalry blade." and "Rushes a foe three to five cells off,
striking harder for every cell run, and knocks it back a cell." Its base
price 30, the reaver's. As an enemy it rides in act 2's Warband
Vanguard, at weight 0.5 beside the mercenaries and archers. The joins as
161f's; DESIGN's newcomers paragraph and its drawn-glyph paragraph's
epaulettes list name it. `npm run gen:font`: 44 live atlas glyphs, every
face unchanged.

Found on the way, each fixed here:

- *The attack editor's formatter dropped `mightPerCell`*, the field 161d
  added, since no shipped def carried it until the charge; its verbatim
  test caught it, and the field now follows `might` where a def has it.
- *The charge's card read "6 dmg"*, a standing hit, for a blow of 8 to 10
  at a run of 2 to 4 cells. It carries a rider now, "+1 dmg a cell run"
  (`card.ability.perCell` in `locales/en/ui.json`, since the literal pin
  refuses prose in code), built inside the cut's intent and read at 161i. The card test's count
  of floored abilities is 14.

The floor of 3 never binds alone: the two-cell walk gate (161d) already
refuses a foe two cells off, since the walk ends beside it after one
cell. It keeps the card's "reach 3–5" true. A plant removing it fails
only the kit test; with the walk gate cut to one cell as well, the
two-cells-off test fails.

`src/sim/cavalier.test.ts`, three tests from the raw config files: the
kit and its encounter; three cells off a foe, the cavalier ends its run
beside it, strikes for the might, the two cells run and its strength,
knocks the foe a cell back along the line, then closes and strikes with
the sabre from beside it; two cells off, it never charges. 12 plants,
all caught, control clean (`scratch/161g/161g-plants.json`).

The corpus. Predicted before the run: fewer than 161f's 12, only offers
from the rare tier changing; with the cavalier undraftable, 0 unless a
journal meets the Vanguard. **10 of 34 differed**; with the cavalier
undraftable in the worktree, 0 of 34, so the 10 are the draft's and no
journal meets the Vanguard's cavalier. Re-recorded: every journal (its
config hash) and the baseline; the replay 0 of 34.

**Read (`batch`, at 161h's stop):** `?seed=5&character=soldier&roster=cavalier:3,cavalier:3,mercenary:3,archer:3`;
wrong looks like a cavalier that hangs back like an archer, charges from
two cells, or charges into its own side. Its charge draws and sounds as
a yank until 161h. The URL is checked in the pane at 161h's put.

### 161h — the look and the sound, built for the stop (2026-11-21)

`src/render/moveLooks.ts` holds the looks as pure poses and specs, and
BattleRenderer places what they return. One dial, `move` on the board
panel (`bp=move-b`), switches all three looks between their arms, a dev
seam that goes when they are signed, as 160.5c's `fall` did.

- **The dash's trail.** `a`: three afterimages, copies of the glyph
  standing where it was, fading over 0.3 s. `b`: a streak of eight motes
  drifting back along its path. Marks drop as the sprite passes even
  steps of its path, read from its position, not the clock.
- **The blink**, never a slide: the slide `unit:moved` started is
  cancelled, and the sprite stands on its start or its landing, never
  between. `a`, the fold (0.3 s): it shrinks to a point where it stood,
  then grows from a point on its landing, with a flash in its colour on
  both cells at once. `b`, the cut (0.14 s): gone at once, then on its
  landing, fading in, with a puff of eight motes out of where it stood
  and eight drawing into its landing.
- **The charge**, at the sim's length (0.15 s a cell). `a`, the gallop:
  slow off the mark and fastest as it arrives, a puff of dust a cell;
  at the hit, a ring of sparks off the foe and a small shake (0.06).
  `b`, the lance: an even rush with three afterimages; at the hit, a
  flash on the foe and a harder shake (0.12). The hit shows only when a
  blow lands, off `unit:attacked` from a unit still in its charge.
- **The cues**, one each, generated: `blink`, a bright zip cut off and a
  soft pop; `charge`, four hoofbeats drawing together under a rising
  rush of air. The other 14 cues regenerated byte-identical. The dash's
  whoosh now plays for a leap only. The shove's cue moved from the
  event-sound registry to BattleRenderer, since only the world tells a
  charge from a push: as the charger moves, its active action is the
  charge, and a pushed unit's has ended.
- `SpriteAnimator`'s yank flag became a pace, `GroundEase` (linear, out,
  in). Under reduced motion there is no trail, flash or shake, and a
  blink is on its landing at once; that branch was not checked in the
  pane.

`src/render/moveLooks.test.ts` pins what every arm must do (a blink on
one cell or the other, ending whole on its landing) and what tells each
pair apart. Headless, in the worktree: at a charger's `unit:shoved` its
active action is `charge` and a pushed foe's is none, and the move fires
before the travel phase's event.

In the pane (Chromium, so wiring, not feel), with the kit's driver:

- *The ninja's URL* (161f's), arm `a`: 8 leaps left 24 afterimages and
  played the whoosh; 4 blinks played `blink` and spawned their flash,
  the whoosh silent for them. On every blink frame before its landing
  the sprite stood on its start or its landing, and no slide was alive
  on it; one frame after a landing stood on neither, at 0.3 s, when the
  ninja's strike can begin (not tagged; arm `b`'s run below tagged every
  frame).
- *The same, `bp=move-b`* (the dial set the arm), at 0.02 s frames: each
  blink spent 3 frames hidden on its start and 4 on its landing; 11
  leaps each dropped 8 of 8 motes.
- *The cavalier's URL*, act 1: no charge in five battles against the
  beasts. Classified frame by frame in one of them: the cavalier was
  idle with its target 2 cells off in 43 frames, at 1, 6 or 8 in one
  each, and three times its line's first cell held a body. Headless, a
  lone cavalier charges a mercenary standing or walking in and a fox
  walking in, each from 3 to 5 cells: the window holds in a duel and
  closes in a crowd of fast foes. **Put to the user at 161i.**
- *With every battle the Artillery Company* (`encounter=artillery`),
  arm `a`: two charges a battle in each of four, every one playing
  `charge`, its hit 6 or 7, the foe knocked a cell, the small shake;
  the gallop eased in over 0.30 s, and in the last two battles each
  dropped 2 of 2 puffs. Arm `b`: two lances, linear, 3 of 3
  afterimages each, a flash and the 0.12 shake on each hit.
- An earlier counter, wrapping the method that drops a mark, read
  fewer marks in two runs (no puff from two gallops; 56 motes from 11
  leaps). The per-trail tally that replaced it read every trail whole
  (15 of 15); the gap is unexplained.

The corpus: predicted 0 of 34, no sim touch; **0 of 34 differed**.

**The URLs, checked in the pane** (each loads with its roster on the map):
161f's as put; 161g's gains `&encounter=artillery`, since in act 1 the
cavalier never charged; every one takes `&bp=move-b` for arm `b`.

### 161h's stop, read (2026-11-22)

**Signed:** "For the pounce and dash I like A; for the blink, B." The
dash's trail takes arm `a`, the afterimages: the puma's pounce and the
rogue's dash are both leaps on `unit:dashed`, so they share it. The blink
takes arm `b`, the cut. The charge's arm was not named and is asked. The
reads ("Generally speaking, I quite like it!"): 161e passes; 161f and
161g each brought a finding.

**161f: with a tile order across the chasm, the ninja walks the long way
round** (the user's screenshot: the order's `X` on the far side). From
the code: under a tile order and beyond `SIM.rangedLeashCells` (3) of
it, a unit has no target and walks to the rally cell
(`MovementBehavior`, `advance` with that cell as its goal). The blink
proposes only on a foe within its range and lands beside it (161c), so
nothing carries the ninja toward a tile. A second limit, smaller: the
blink's approach goal is searched only out to its range plus
`SIM.actingCellSearchSlack` (7 steps), and a ninja farther than that
heads for its foe's own cell by the walking route until it is within it.

**161g: the cavalier crossing sand never charges**; the user's lean was
+1 reach. Measured headless in the worktree
(`scratch/161h/sandprobe.test.ts`): a lone cavalier closing on a walking
mercenary, bandit, wolf or fox from 7 to 14 cells, 32 approaches, on
flat ground and with six columns of sand between them. Each cell gives
the blows that landed, the rushes whose blow missed, and the approaches
with no rush, of 32:

| | flat, reach 5 | flat, reach 6 | sand, reach 5 | sand, reach 6 |
|---|---|---|---|---|
| HEAD | 17 / 6 / 9 | 18 / 8 / 6 | 20 / 2 / 10 | 19 / 4 / 9 |
| a claim meets its claimant | 25 / 7 / 0 | 24 / 8 / 0 | 21 / 11 / 0 | 21 / 11 / 0 |
| only when it arrives before the blow | 25 / 7 / 0 | 24 / 8 / 0 | 24 / 3 / 5 | 24 / 7 / 1 |

At reach 7, HEAD reads 22 / 8 / 2 flat and 22 / 6 / 4 on sand. The cause
(`scratch/161h/chargewhy.test.ts`, each of the cavalier's decisions): a
foe walking in claims the cell in front of it until its step's flip, and
the charge's walk stops before a claim with no one met, so it never
proposes. Against a mercenary 8 cells off, at 5 cells the walk is 3 and
meets nothing, the mercenary claiming the cell before it; at 3 cells
the walk is 1. Whether a rush happens depends on how the two units'
steps line up, and a longer reach changes that little.
Both fix arms ran in the worktree only: a claim stops the walk as a body
does and meets the unit that made it; the second also requires the
claimant's flip to fall within the rush's travel. Without that
requirement, a foe that begins a slow step on sand still stands a cell
beyond its claim when the blow lands.

The wolves: in every arm the cavalier rushes a wolf and its blow misses,
6 to 8 of 8. The cavalier stands on its landing from the cast tick
(call 1). The wolf beside it harries, striking and stepping back, and is
gone when the blow lands as the rush ends (call 2). This goes to 161i
with the act-1 finding.

**A correction to 161h's entry.** "A lone cavalier charges a mercenary
standing or walking in and a fox walking in ... the window holds in a
duel" rests on one run each from 10 cells. From 7 to 14 cells it never
rushed in 9 of 32 on flat ground.

**Put to the user, unsigned:** the charge's arm; 161f-post2, a ready
blink that jumps toward a cell when walking there would take longer;
161g-post, a foe's claim meeting the charge as its body does, the reach
kept at 5.

### 161h — signed (2026-11-22)

**Signed** in the reply to the read ("I meant pounce and charge, not
dash. I liked the gallop", with "for the blink, B"). The dash's trail
takes arm `a`, since the pounce leaps on `unit:dashed` and wears the
dash's trail. The blink takes `b`, the cut, and the charge `a`, the
gallop. The cues stand as put, with no objection to "say if either
grates". The dial and the other arms are gone. `moveLooks.ts` holds one
look each: `DASH_TRAIL`, `blinkPose` (alpha only, since the cut keeps
the unit's size), `chargeRush` and `CHARGE_HIT_SHAKE`. The renderer no
longer draws the blink's flash, the motes' trail or the lance's hit.

The oracle (`scratch/161h/signed-oracle.test.ts`, in the worktree)
holds the new module to HEAD's under the signed arms: the trail, the
blink's pose at 1001 steps (HEAD's cut never changed the size), the
rush at 0 to 8 cells, the hit's shake and the trail's fractions. Its
control, against the other arms, fails on all three looks. DESIGN's
leaps paragraph now describes the looks, and TODO's Dash VFX item is
ticked. The renderer is checked in the pane with the -posts.

### 161g-post — the charge meets a walking foe (2026-11-22)

Signed at 161h's stop ("Signing the charge fix also!"), the reach kept at
3 to 5. `chargeWalk` (`src/sim/charge.ts`) still stops before a claim,
but a claim now meets the unit that made it, as a body does, when that
unit's step flips it onto the cell strictly before the blow lands: the
rush's travel, the cells walked at `SIM.pushSecondsPerCell`, from now.
The test is strict because on the blow's tick the order the two units act
in would otherwise decide the hit. A claim that flips later, or one whose
claimant is not mid-step, stops the walk with no one met, as before.
`proposeCharge` is unchanged, so an ally's claim is refused as an ally's
body is. DESIGN's charge sentence and ARCHITECTURE's `charge.ts` line say
so.

`src/sim/charge.test.ts` gains two tests: a foe walking in is met at the
cell it is stepping into and struck there for the three cells run, and a
foe starting a slow step onto sand is not rushed. 4 plants, all caught,
control clean (`scratch/161g/161g-post-plants.json`): no claim met, a
claim met however late, the walk run onto the claim, and the blow's time
misread.

The probe (`scratch/161h/sandprobe.test.ts`) on the change, at reach 5,
of 32 approaches: on flat ground 25 blows landed, 6 rushes missed, 1 no
rush (HEAD: 17, 6 and 9); on sand 25, 2 and 5 (HEAD: 20, 2 and 10).
Every miss on flat ground is a wolf, whose harry steps it back before
the blow (161h's stop entry); that goes to 161i.

The corpus. Predicted before the run: 0 of 34, since no journal fires
the sabre or the charge (`scratch/161e/pounce-strikes.ts` at HEAD in the
worktree, its control reading the pounce in 10 and the blink in 2).
**0 of 34 differed.**

**Read (`batch`, at 161i's stop):** in play, wherever a cavalier crosses
sand at foes walking in (the desert fortress first named here is a poor
URL for it, see the pane entry below); wrong looks like a cavalier that
walks in to its sabre with its charge ready while a foe three to five
cells off walks at it in the open.

### 161f-post2 — the blink toward a cell (2026-11-22)

Signed at 161h's stop ("I like your proposed fix") as put: with no foe
in its range, a ready blink jumps toward where its unit is walking, when
that saves more than its range. The ninja walked round a chasm to a tile
order because a blink lands only beside a foe (161h's stop entry).

- `walkCosts` (`src/sim/blink.ts`) gives the cost of walking from every
  cell to a set of goals, priced as the pather prices a step: the tile
  cost of each cell entered, through cells of finite cost that no inert
  neutral stands on, passing bodies, over eight neighbours. It is a
  Dijkstra with a bucket for each whole cost.
- `blinkJump` takes, of the free, unclaimed cells of finite cost within
  the blink's range (`blinkLanding`'s filter), the one with the least
  walk left. It jumps only when that saves more than the range. Ties go
  to the straight line, then scan order.
- `proposeBlinkJump` (`propose.ts`) is where a blink goes with no foe
  in range, and its goals mirror `MovementBehavior`. With no target,
  the goal is a tile order's rally cell. With a target out of range, the
  goals are the cells from which it is in blink range, so walking to the
  near bank to blink at the foe always wins where that walk is short.
  There is no jump while a status drives or stops the unit's movement,
  nor for a blink that carries a hit. The target's id rides on the
  action, or `-1` with none.

**A call made inside the intent, flagged:** the put said "saves more
steps". The walk is priced at tile cost, as the pather prices it, so a
slow tile counts: across six columns of mud a jump saves 20, and the
ninja jumps it. On open floor a jump still saves exactly its range and is
never taken.

`src/sim/blink.test.ts` gains six tests: across a chasm under a tile
order; a claim and a wall line; mud at its cost; open ground walked; a
far foe with and without a near bank; and the gates (no order and no foe,
blind, a blink with a hit). `src/sim/ninja.test.ts` gains one from the
raw config: ordered to a tile across a chasm with a long way round, the
ninja stands across in under half a rogue's time, straight over. 11
plants, all caught, control clean (`scratch/161f/161f-post2-plants.json`).

The corpus. Predicted before the run: only the two journals where a
ninja fights can move, chaos-4-character-gambler-bits-300 and chaos-6
(`scratch/161e/pounce-strikes.ts` at HEAD), with a lean that both do.
**2 of 34 differed, those two**, each battle ending sooner (232 ticks
for 246, 328 for 348). With the jump cut off in the worktree, 0 of 34
differed, so both differences come from the jump alone. Re-recorded:
the two journals and the baseline; the replay 0 of 34.

**Read (`batch`, at 161i's stop):** 161f's URL,
`?seed=5&character=soldier&roster=ninja:3,ninja:3,rogue:3,mercenary:3&layout=spiralFireLife`,
with an order to a tile across the chasm, as in the screenshot. Wrong
looks like a ninja that walks round with its blink ready, or one that
spends its blink on open ground.

### The pane, after 161h's signing and the two -posts (2026-11-22)

In the Browser pane (Chromium, so wiring, not feel), at `9c483d9b`:

- *161f's URL with a focus order on (11,7)*, the spiral's inner lane
  across the chasm from the ring the ninjas start in. On the first tick
  both ninjas blinked across with no target, (13,10) to (11,7) and (14,9)
  to (11,8). Each was drawn as the cut with its puffs (2 of 2), with no
  frame between the two cells in 6 blink frames. A battle on the same
  URL had 7 leaps (the rogue's and the foxes'), each with three
  afterimages (21 marks), and 2 blinks, with no frame between cells.
- *161g's URL* (`encounter=artillery`), three battles: two rushes a
  battle, each with a dust trail of a puff a cell. Every blow landed, for
  6 or 7, and each was followed by the small shake (0.06 for 0.2 s).
- *The desert fortress* (`layout=desertFortress`, 62 cells of sand), two
  battles: no charge. In band, its line was blocked at the first cell
  twice, at five cells, and once its walk met a body after one cell. That
  makes it a poor URL for 161g-post's read, which moves into play at
  161i.
- *Act 1*, 161g's URL without the encounter, with two cavaliers in the
  roster, eight battles: no rush in the first five (foxes, bandits with
  archers, foxes, archers, then a map split by chasm), then 1, 0 and 1
  against giant rats and a healer. In the last four, the decisions taken
  in band with the charge ready came out as follows. The first cell of
  the line was chasm or deep water 6 times, and the other cavalier stood
  in the line 3 times. The walk stopped after one cell twice, met no one
  once, and met a foe after one cell once. It proposed 2. So in act 1 the
  charge is rare because the maps' water and chasms break its lines and
  the cavaliers crowd each other's, and foxes leap through its band. This
  goes to 161i with the wolves' whiff.

No errors in the console but the pane's own cache misses.

### 161i — the play, signed (2026-11-22)

**Signed** ("Ooh yes, I think we definitely want that wolf fix.
Everything else looks really good! 😁 Though I think ninjato might be a
bit niche 😅 Let's just call it a dagger for now?"):

- The reads of 161f-post2 (the blink toward a cell) and 161g-post (the
  charge meets a walking foe) pass.
- The newcomers stand as put at the stop: the ninja (uncommon, 28, act
  3's Miscreants), the cavalier (rare, 30, act 2's Warband Vanguard),
  their bodies, the Blink, the Sabre, the Charge with its card's rider,
  the puma's Pounce and the Swipe, with every line. So does the jump's
  call to price a slow tile at its cost.
- The ninja's blade is a **Dagger**: the id `ninjato` became `dagger`
  (config, the registry, the locale's keys), its numbers kept, and its
  line, "A short, straight blade, quick from the sheath.", kept since it
  fits a dagger. No other ability was a dagger. DESIGN's newcomers
  paragraph names it.
- The wolf fix, signed: the charger arrives on its landing as its blow
  lands, not as it sets off, which changes call 1's "on that cell at
  once". It is built as 161g-post2.

The corpus for the rename. Predicted before the run: 2 of 34, the two
journals that fire the ninja's blade, since its action id is in their
events. **2 of 34 differed, those two**, in their events alone.
Re-recorded: every journal (`config/abilities.json` is in each one's
config hash) and the baseline; the replay 0 of 34.

### 161g-post2 — the charger arrives as its blow lands (2026-11-22)

Signed at 161i ("we definitely want that wolf fix"). It changes call 1's
"the caster is on that cell at once": a wolf beside the landing saw the
cavalier beside it from the cast tick, bit and sprang back, and was gone
when the blow landed as the rush ended (161h's stop entry: 6 to 8 of 8
rushes at a wolf missed).

- The charge's `move` op, on `travel` at offset 0 (`executeMove`,
  `interpreter.ts`), claims the landing as a step claims its cell and
  emits `unit:moved` and `unit:shoved` for the slide over the travel, but
  leaves the caster on its start.
- At the `impact` boundary `EffectAction.fireOpsAt` calls
  `arriveFromCharge` before that boundary's ops: the caster steps onto
  the landing, the claim is released and the tile acts on it, as a step's
  flip does. Then the blow measures reach from the landing, as before.
- No state is new: the landing is the op's captured `moveDest`, and the
  claim is in `World.claims`, both in the snapshot. A caster already on
  its landing is left alone, so a world restored from a snapshot taken
  mid-rush before this change does not enter the landing twice. A landing
  some other body has taken is not entered (a guard only: the claim
  blocks every placement).
- A push or a death mid-rush releases the claim, as for a step
  (`releaseClaimsBy`), and no status ends an action, so the claim cannot
  outlive its rush.
- An edge accepted: the cells between the start and the landing are not
  claimed, so a foe that steps into them during the rush is passed
  through, as the slide is drawn. A rush lasts 0.3 to 0.6 s.

`src/sim/charge.test.ts`'s four tests that read the caster on its landing
after the cast tick now read it on its start with the landing claimed,
and on the landing once the blow lands; the mud entry comes with the
arrival. `src/sim/cavalier.test.ts` gains one from the raw config: a
cavalier charges a wolf walking in from 7, 8, 9 and 10 cells, and every
blow lands. 6 plants, all caught, control clean
(`scratch/161i/161g-post2-plants.json`). Among them, HEAD's charge, the
arrival as it sets off, fails the wolf test.

The probe (`scratch/161h/sandprobe.test.ts`), at reach 5, of 32
approaches: on flat ground 31 blows landed, none missed, 1 no rush
(161g-post: 25, 6 and 1); on sand 27, none and 5 (161g-post: 25, 2 and
5). No rush misses a wolf now.

The corpus. Predicted before the run: 0 of 34, since no journal fires
the charge. **0 of 34 differed.**

**Read (`batch`, at the next stop):** 161g's act-1 URL,
`?seed=5&character=soldier&roster=cavalier:3,cavalier:3,mercenary:3,archer:3`,
or anywhere a cavalier meets wolves. Wrong looks like a wolf that bites a
cavalier mid-rush and springs clear of its blow, or a cavalier whose
glyph and blow arrive apart.

In the pane, the wolf pack (`encounter=wolfpack` on 161g's act-1 URL),
three battles: two rushes, each at a wolf, and both blows landed. The
cavalier stood on its landing as each blow landed. Its sprite galloped
from its start to the landing over the travel, at a progress of 0.03,
0.11, 0.25, 0.44, 0.69 and 1.00 a tick. The blow came a tick later, and
the sabre's lunge carried the sprite past the landing and back.
