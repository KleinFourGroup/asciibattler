# WORKLOG — Round 11 (The roster)

Per-phase narrative log (AGENTS "The planning stack"; `process/planning.md`
"The artifacts"): findings, decision rationale, rejected alternatives,
scope changes, playtest verdicts and the checks run land here under the
matching `## Phase N`; the ROADMAP stays a plan. The file holds the phase
in progress: at each phase close it moves to `archive/worklog-phase-N.md`
and a fresh one starts. Round 10's phases are
[archive/worklog-phase-142.md](archive/worklog-phase-142.md) to
[archive/worklog-phase-147.md](archive/worklog-phase-147.md) (the close,
with Round 10's exit read and Round 11's charter against the code at
147a).

## Phase 148 — the kickoff

The kickoff's inputs, by pointer: the charter, META-ROADMAP §"Round 11 —
The roster", amended at Round 10's close; its premises at HEAD,
`archive/worklog-phase-147.md`, 147a; TODO's Round 11 section, with act
1's cost target to sign at this kickoff; `process/planning.md` "Phase
kickoff".

### The kickoff's audit, and the phases put to the user (2026-11-04, session 65cfb3a3)

Read at `1ded6293`. Since 147a's read at `d0f557bf`, the only files
changed under `src`, `config`, `tests`, `tools` and `scripts` are
`tests/shell-backticks.test.ts` (147e) and `tests/docs.test.ts` (147f's
sign), so 147a's premises stand with their files and lines
(`archive/worklog-phase-147.md`, 147a, "Round 11's charter at HEAD").
Two it left open, read here:

- *Removing `mars` and the save.* `Run.fromJSON` maps each saved daemon
  id through the catalog and throws on one it lacks (`src/run/Run.ts:3899-3909`),
  so a `0.3.0` save holding Mars would not load: the charter's Run bump
  (v50 to v51) is needed, as signed. Mars at HEAD: one empower a turn,
  `+4 STR / RNG, +8 MAG` (`config/daemons.json`, `mars`).
- *The strike-conversion test.* Its header settles 147a's question: "the
  retune of Round 11 retires this file" (`tests/strike-conversion.test.ts:24`).
  It reads `units`, `abilities`, `packets`, `daemons` and `statuses`, so
  the first retune commit that moves a converted number deletes it, with
  `strike-conversion.before.json`; the board reads the retune instead.

**Act 1's cost, for the target signed at this kickoff.** The pool is 40
(`config/health.json`, `playerHealthMax`); BALANCE's per-kind guide
(normal ≈ 3, elite ≈ 6, boss ≈ 10 pool an instance) was set at X3, when
it was 20. At 146f, ARM walk rows, deploy / regen (BALANCE.md
2026-11-03): the bosses 16.1 to 20.0, the cats 19.9 / 22.5, the Vermin
Lords 2.7 / 1.7, and the normals from 9.4 (the poachers) down to 0.02
(the rats' nest). Put in tranche 2, after the phases.

**The phases, and why this order:**

1. *§149, the board's instruments.* BALANCE's header goes first because
   the retune writes BALANCE most and its header refused three commits
   in Round 10; the ceiling label, the skill gradient's leg and the
   arbitration's walk loss go before the closing board reads the roster.
   Doing all four first means every box read the retune takes uses fixed
   instruments. Risk: medium. The arbitration's loss is an open
   investigation, and a fix to the ARM moves every ARM row.
2. *§150, the content.* This covers bandits out of the draft (with the
   roster table's guard), Mars as three idols (sizes provisional), the
   Run bump, and the cards' lines: the ability `description` with its
   card line and text, plus the units' lines (the user's). Each changes
   what a run draws or shows, not a number the retune reads, so the
   retune tunes the roster that ships. The user's writing can run beside
   the balance work. Risk: low.
3. *§151, the weapons and defense, by taste.* Each weapon's might and
   cadence, the units' strength and ranged, defense's bases and growth,
   and the spells and catapult against the halved defense. The
   strike-conversion test retires at its first commit. These are taste
   stops, read in the user's play. Risk: medium-high (many numbers).
4. *§152, power by rarity, its growth key, and the pools.* The charter
   puts the key's removal in the same re-baseline. It comes after the
   weapons because the pools re-anchor on how fights end, which the
   weapons and defense decide; the other order re-anchors them twice.
   Act 1's cost target is read here first, the rats' nest and the
   Vermin Lords leading. Risk: medium (a re-baseline and a box read).
5. *§153, the kits.* The officer, mercenary, halberdier and stormcaller;
   the priest's parity; the area-status enemies; the blind fix, with the
   kiter's case a stop; the idols' sizes; the wolf's retreat if it plays
   plain. This comes after power because the kit watches read a unit's
   worth, which power by rarity changes. Risk: medium (one call per
   kit).
6. *§154, the closing board.* The board read as paired same-seed deltas
   against 146f's, act 1's bands re-pinned and signed, act 1's cost
   against its target, acts 2 and 3 recorded, the wall watch, Dis
   Pater's `--grant` read at n=80 with his sentence, and the prior table
   rebuilt. Risk: medium (box time).
7. *§155, the close.* `0.4.0` and its upload, the exit by clause, Round
   12's charter against the code, the process read (with the Cursor
   pass's trial and the reminder read), and the archive.

*Not split off:* the cards' lines could be their own phase. They ride
§150 because the text describes an ability's shape, not its numbers, so
§153's kit changes rarely touch it, and a kit that does changes its line.

### The stat sheet added, and the spec and phases signed (2026-11-04 to 11-05)

The user, at the stop, asked for tooling that ranks the units' stats and
growths and the weapons' stats against the others, and a unit's DPS
against an "average" enemy, and asked whether it is a phase (their
words: [round-11-spec.md](round-11-spec.md), "The stat sheet").

*A phase of its own, first.* No written phase-size rule exists (a
search of AGENTS.md, `process/`, META-ROADMAP and ROUND-RULES.md). The
reasons are dependency and evidence. The weapons phase's taste stops are
read through the sheet, so a wrong number there carries into each call
signed on it. And the DPS figure is a model of the game's strike rules,
an instrument that needs a known answer: BALANCE's swing read measured
damage a swing in play by unit (2026-10-28 and 10-29). First, rather than
just before the weapons, so the user uses it while the board's
instruments, the open-ended phase, run, and what it lacks shows up
before the stops rest on it. The phases became §149 to §156, the rest in
their order.

*The user's model, and the session's reply.* The user's model: an
archetype at a level with its expected stats, an average enemy, range
ignored, so the figures are maximum DPS. The average is over units
fielded in encounters, split by sector, with the hand's level driving
the waves in place of a target enemy level. The code bears the last
point out. A wave's body count is a factor times the hand size, and its
level budget a factor times the hand's mean level times the hand size,
split across the bodies (`resolveWave`, pinned in
`src/run/encounters/brigands.test.ts:58-76`; the brigands' first wave
`levelBudget` factor 1.38, `config/encounters.json:20`). So an enemy
level input would let the sheet show fights the game cannot make. The
session's reply, signed with the phases:

- The inputs are an archetype, a level and a sector; the waves resolve
  through the game's own code, averaged over seeds since member choice
  draws.
- The damage is computed against each enemy type and then averaged.
  Damage is not linear in defense because of the floor of 1: a strike
  of 4 against defenses 1 and 5 does 3 and 1, 2 on average, and 1
  against their average of 3. The units the swing read found on the
  floor (the bandit, the ghoul, the officer) are where the shortcut
  misreads.
- Time to kill both ways beside the DPS, since DPS leaves out hit points.
- Range ignored flatters melee and undersells ranged units and kiters,
  whose edge is the swings before contact; the swing read can show the
  gap per unit.
- A hand against a wave as a team fight is the sim's question, answered
  by a forced-encounter run (`npm run run-config -- --roster=... --encounter=ID`),
  not a formula.

**Signed** (the user, 2026-11-05: "Oh I like how all of that sounds,
Claude! 😁 Signing everything!"): the spec, the phases §149 to §156 with
the stat sheet first, and the sheet's shape above. The sheet's open
questions go to §149's kickoff (the spec's tranche 2). Next: act 1's
cost target per kind, put to the user.

### Act 1's cost target per kind, put to the user (2026-11-05, session 65cfb3a3)

The data: 146f's two ARM walk rows, 120 runs each
(`output/board-runs/146f/arb-walk-{deploy,regen}/pacing.csv`, the
`playerCostPerInstance` column), by kind with
`scratch/148/kind-cost.mjs`. Its per-encounter values are BALANCE's
2026-11-03 table (the cats 19.94, the Vermin Lords 2.67; the elite mean
12.67 is their instance-weighted mean). The brigands are in act 1's and
act 2's pools and pooled in the file.

| kind (act 1) | instances a run, deploy / regen | mean pool an instance | range by encounter |
|---|---|---|---|
| boss | 0.97 / 0.82 | 19.1 / 18.1 | 16.1 to 20.0 |
| elite | 0.47 / 0.74 | 12.7 / 13.6 | 1.7 (the Vermin Lords) to 22.5 (the cats) |
| normal | 2.95 to 4.14 / 4.25 to 5.62 | 3.6 to 4.1 | 0.02 (the rats' nest) to 9.45 (the poachers) |

The pool is 40, and seam 1 is signed at 0.475 to 0.55 of it (146g),
read at 21.0 / 19.9. BALANCE's guide (normal ≈ 3, elite ≈ 6, boss ≈ 10)
was set at X3 with a pool of 20, in ratios 1 : 2 : 3.3.

*The arms.*

- **(A) The guide doubled with the pool: 6 / 12 / 20.** The elites and
  bosses match it now. The normals sit at about 4, and raising them by 2
  costs act 1 about 6 to 11 more pool a walk (3 to 5 normals a walk).
  That takes the seam from about 21 to about 9 to 15, outside its
  signed band.
- **(B) X3's ratios, with act 1's total kept: about 5 / 10 / 16.5.**
  This eases the bosses, which the wall signed at 146g reads, and halves
  the cats.
- **(C), the lean: the kinds where act 1 has them, rounded to shares of
  the pool. Normal 10 %, elite 30 %, boss 50 % (4, 12 and 20 at 40),
  each fight within half to one and a half times its kind's target.**
  It keeps act 1's total, and with it the signed seam and wall. The
  target then does what 146e asked of it: it catches the fights priced
  apart from their kind. Out of band at 146f: the rats' nest (0.02 /
  0.09 against 2 to 6), the wolfpack (1.84 / 1.58, just under), the
  poachers (9.45 / 9.41, over 6), the cats (19.94 / 22.51, over 18) and
  the Vermin Lords (2.67 / 1.66, under 6). Moving each to its band's
  near edge changes act 1's pool a walk by under 1 on the deploy row
  (the rats' nest +1.4, the wolfpack +0.1, the poachers −2.1, the cats
  −0.5, the Vermin Lords +0.7). Its ratios are 1 : 3 : 5, not X3's, as
  the normals did not double with the pool. Shares rather than points,
  since §153's power and pools may move the scale.

Read at §153 after the weapons, then on the closing board. On the sign,
the target replaces the X3 guide in BALANCE's "Per-kind target bands",
and TODO's row points at it.

**Signed** (the user, 2026-11-05: "C sounds good to me, Claude! 😁
Signing your lean!"): arm (C). BALANCE's "Per-kind target bands" holds
it in the X3 section's eleven lines, since the header sits at its
700-line cap; the section's note that promoting the bands into the sheet
is an 83f candidate is kept in a clause. TODO's Round 11 row names the
five fights out of band and §153's read. §148's lines are all ticked;
next, §149's kickoff.

## Phase 149 — the stat sheet

### The kickoff's audit, and the cut put to the user (2026-11-05, session 65cfb3a3)

Read at `503e1c1d`. A read-only subagent mapped the strike pipeline with
files and lines; spot-checked here against the code: `World.ts:706-711`,
`interpreter.ts:195-198`, `resolveScalars.ts:37-44`, `leveling.ts:48-52`
and `:72-84`, `wave.ts:163-166` and `:205-210`, `timeline.ts:37-41`,
the archetype editor's `editor.ts:641-644`, `Run.ts:2498`,
`sectors.ts:225-230`, `config/stats.json`, and the two +2 defense
grants in `config/daemons.json` and `config/packets.json`.

**A strike, as the game deals it.** The base is `might` plus the scaling
stat (`resolveDamageScalars`, `src/sim/effects/resolveScalars.ts:37-44`,
pure and importable, which also gives the crit chance:
`critBase + luck × 0.01`, capped at 0.6). The crit is rolled inline
(`interpreter.ts:196-197`, damage `round(base × 2)` on a crit), and
defense is subtracted inline after it, floored at 1
(`World.ts:708-710`, skipped under `bypassDefense`). No other draw: every
strike lands. So a strike's expected damage against defense D is
`(1−p)·max(1, B−D) + p·max(1, 2B−D)`, and no one function computes it;
the model writes the last two steps itself, which is what the check
below tests.

**Timing.** A strike every `resolveCadenceTicks(def, speed)` ticks at 20
ticks a second (`timeline.ts:37-41`; `src/config.ts`): the cooldown
scaled by `max(0.4, 1 − 0.05 × speed)` when `speedScaled`. The phases
of a strike (wind-up, travel) sit inside the cadence, so they delay the
first hit and not the rate. *A finding:* the archetype editor's preview
uses `attackCooldownTicksFor` whatever `speedScaled` says
(`editor.ts:643`), so it shows the dash's flat cooldown scaled by speed.

**One weapon each.** Every combatant carries one ability at priority 10,
its weapon; the rogue's and the fox's dash (priority 5) and the
officer's inspire (0) deal no damage (`config/units.json`,
`config/abilities.json`, read by script). So "the main attack" covers
every unit, and the open part is the weapons' riders. Area spells roll
one crit for every victim and take a ring multiplier off the centre;
chain lightning falls off a jump at a time. Damage over time ticks
`might × magnitude` with no crit (burn: 2 a second for 4 s, past
defense). By the subagent's reading a 4 s burn ticks 3 times, not 4;
it said itself that this is unverified, and no test pins it. The
healer heals; the shaman summons; the warlock and the banshee only
apply statuses.

**Levels.** A player unit's level-up adds 1 to a stat with its growth as
the chance (`leveling.ts:50-51`), so its expected stat at level L is
`base + growth × (L−1)`, unrounded. An enemy is built on the rounded
path, `base + round(growth × (L−1))` (`scaleStats`, `:72-84`, through
`scaledUnit`), so the sheet uses that path for enemies, as the game
fields them. HP is constitution (`hpPerConstitution` 1.0). Only defense
reduces a strike by default; the `warded` daemon and the `shield` packet
add 2 on the player's side.

**Waves.** A wave's count is `round(factor × handSize)` and its level
budget `round(factor × the hand's mean level × handSize)`, the levels
split by weight from 1 up, with one shuffle for ties (`wave.ts:163-210`,
`:284-298`). The hand is `min(team, drawAmount)`, 6 by default
(`Run.ts:2498`, `config/deck.json`). A node's encounter is drawn by
weight from its sector's pool for its kind, filtered by `minHop`
(`src/config/sectors.ts:225-230`, `selection.ts:115`). The sheet can
call the game's `resolveWave` and `scaledUnit` with its own `RNG` seeds,
so its enemies cannot drift from the game's and it draws on no stream of
the game's.

**The check against play.** §139's `scratch/139/swing.ts` wraps
`World.applyDamage` and records each swing's damage and the target's
defense, at about 4 minutes a bot on this machine (BALANCE 2026-10-28).
Extended to record the swing's base and crit chance, it gives a known
answer for the model's expectation that the model does not compute:
the sim's own inline crit, defense and floor, over many swings.

**The cut** (each step one commit; no snapshot bump, no RNG stream, no
`src/` or `config/` change, so the fuzz smoke does not fire; no box):

- **149a — the strike model** (`none`). `tools/stat-sheet/model.ts`: a
  player unit's expected stats at a level, an enemy's by `scaledUnit`,
  HP, the cadence by `resolveCadenceTicks`, and a strike's expected
  damage and DPS against a target. Exit: pinned in
  `tests/tools/stat-sheet.test.ts` on cases worked by hand from the raw
  config, each with a planted failure (the floor dropped; defense
  before the crit).
- **149b — the editor's cadence** (`none`). The archetype editor's
  preview through `resolveCadenceTicks`. Exit: the dash's cadence flat
  under speed, pinned, with the old line failing it.
- **149c — the check against play** (`none`, its result in the stop's
  report). `scratch/149/swing.ts`, §139's probe recording each swing's
  base, crit chance and target defense, run at HEAD on both bots. Per
  unit, the measured damage a swing against the model's expectation on
  the same inputs, within three standard errors on rows of at least
  1,000 swings, with a planted model error failing it. Also per unit,
  swings a second alive in battle against the cadence: the standing
  sheet's gap to play, named and not gated. The numbers go to BALANCE's
  run log.
- **149d — the enemies** (`none`). A sector's fielded enemies for a hand
  of 6 at level L and a kind: each encounter by its pool weight, its
  waves through `resolveWave` over 200 seeds, each enemy type's share
  and mean level. Exit: one encounter's counts and level budget pinned
  against its config worked by hand, with a planted failure.
- **149e — the duel, the ranks and the weapons** (`none`). Per enemy
  type, DPS dealt and received and time to kill both ways, then
  weighted means; each stat and growth ranked; the weapon table (might,
  scaling, cadence, range, crit, riders). Riders, heals and the units
  with no strike as the calls below decide. Exit: pinned on cases worked
  by hand.
- **149f — the page** (`stop`). `tools/stat-sheet/` beside the editors,
  at `http://localhost:5173/tools/stat-sheet/` on the dev server:
  archetype, level, sector and kind; the toggles the calls keep; the
  three tables. The user reads whether it answers their questions.

*Why this order:* the model before what is built on it, and the check
before the enemies and the duel multiply it out; the page last, so its
look is read on numbers already pinned (headless first, render second).

**The calls, with the session's leans** (tranche 1; the page's layout
is 149f's):

1. *The cut and its reads* as above.
2. *Expected stats:* a player unit's unrounded (the exact expectation),
   an enemy's on the game's rounded path.
3. *Past the strike:* damage over time in, as damage a second while it
   is kept up, its tick count pinned against the sim first; an area
   attack per target hit, its centre's damage; chain lightning's first
   target; a heal-a-second column for the healer; the shaman, the
   warlock and the banshee listed with no DPS.
4. *The ranks:* draftable units and enemies ranked apart, each stat and
   growth as a percentile and as a share of its group's mean.
5. *Kind:* an input (normal, elite or boss), normal by default, with no
   mixed "all".
6. *Toggles:* the idols' buffs (Mars today, the three idols after §151)
   and Escalation, which scales the level budget, both in at 149f.

**Signed** (the user, 2026-11-05: "That looks good to me, Claude! 😁
Signed!"): the cut and its reads, and the six calls at their leans.
ROADMAP §149 holds the cut's lines.

### 149a — the strike model (2026-11-05)

`tools/stat-sheet/model.ts`: `statsAt` (a player unit's expectation
unrounded, an enemy's by `scaledUnit`), `maxHpOf`, `weaponOf`,
`strikePeriodSeconds` (through `resolveCadenceTicks`), `expectedStrike`
and `expectedDps`. The crit's multiplier and the defense's floor are
written again from the sim's inline lines; the game rounds `base ×
critMult`, which on whole stats at a multiplier of 2 changes nothing, so
the model leaves the round out, and a test guards the multiplier being
whole.

`tests/tools/stat-sheet.test.ts`, 8 tests, each expectation worked from
the raw JSON files: the 24 combatants whose weapon holds a damage op,
at levels 1 and 8 against defenses 0 to 12, the cadence at each unit's speed and the dash's flat
one. *The failing control:* each of three mistakes planted in the model
in turn failed the file (the floor dropped: 2 of 8; defense taken before
the crit: 2 of 8; a player's growth rounded: 1 of 8); restored
byte-identical, 8 of 8. Typecheck and lint clean on both files.
*For 149e:* the stormcaller's chain lightning nests its damage inside a
`chain` op, so `weaponOf` finds no weapon for it (nor for the healer,
the warlock, the banshee and the shaman); the chain is 149e's.

### 149b — the editor's cadence (2026-11-05)

*Step zero changed the premise.* The kickoff said the archetype editor
shows the dash's flat cooldown scaled by speed. It does not: a
self-targeted move returns before the cadence line
(`tools/archetype-editor/editor.ts:638-641`), and the dash is the only
ability with `speedScaled: false`. A script over `config/abilities.json`
found no flat-cooldown ability that reaches the line, so no shipped
preview changes. The bug is latent: a flat-cooldown weapon would be
shown sped up.

Built inside the step's intent and flagged: the preview's cadence is
`resolveCadenceTicks(def, speed)`, the sim's, which honours
`speedScaled`; the file's header and the README name it. The exit's pin
on the dash cannot be met, since the dash never reaches the line, and
the preview line sits in the DOM module, which no test imports; the
check is the script's count above, 0. Typecheck and lint clean.

### 149d — the enemies (2026-11-05)

`tools/stat-sheet/enemies.ts`: `fieldedEnemies(sector, kind, level)`
plays each encounter of the kind's pool as a fight of the kind's signed
turn target (the signed sheet's `pacingBands`, the midpoint rounded:
normal 3, elite 5, boss 6 turns), the enemy pool falling evenly across
them for the stages; each turn's wave from `waveForTurn` and its units
from `resolveWave`, for a hand of 6 at the level, over 200 seeds of the
sheet's own `RNG`. An encounter counts by its pool weight, every entry
of the kind whatever its `minHop`; each body fielded counts once.
Escalation's multipliers pass through as options. Built on two leans,
listed for the stop: the fight's length at the band's midpoint, and
every pool entry regardless of `minHop`.

Act 1 at level 3, read by `scratch/149/enemies-peek.ts`: the normals
field foxes, wolves and rats first (the fox at 3, 16.5 %; the wolf at 3,
16.1 %); the elites rats, pumas and the cats' healer; the bosses' waves
mercenaries, bandits and beasts. 33 ms for the three kinds.

Three tests added to `tests/tools/stat-sheet.test.ts` (11 in all), worked
from the raw files: the turns from the signed sheet; the wolfpack's
waves at levels 1, 3 and 7, each `round(1.5 × 6)` bodies whose levels sum
to `max(bodies, round(1.25 × level × 6))` within one of each other; act
1's normals fielding exactly the archetypes its normal encounters name.
*The failing control:* a hand of 5 failed 1 of 11; the turns floored in
place of rounded failed 1 of 11; restored byte-identical, 11 of 11.

### 149c — the check against play (2026-11-05)

`scratch/149/swing.ts` (§139's probe extended) and
`scratch/149/report.mjs`, run at `1b1aa683` on both bots, 200 seeds each;
the numbers are BALANCE's run log, 2026-11-05. **The gate passes:** 24 of
24 rows with at least 1,000 strikes sit within three standard errors of
the model's expectation (largest |z| 2.85). Its control: defense before
the crit fails 24 of 24, the crit left out 23 of 24, the floor dropped 9
of 24, the rows whose strikes meet the floor.

**The gap to play, named:** a unit strikes at 0.15 to 0.36 of its
standing cadence over its ticks alive in battle. The sheet's DPS is a
ceiling by about three to six times; its ranks between units are what it
reads, not a forecast of a fight's length.

*Built on leans, listed for the stop:* the model reads the attacker's
stats at impact, where the sim resolves them at cast (2 strikes of
509,775 differed, both the catapult's, and were left out); the uptime
counts every tick a unit is alive in a World, so it includes the
approach and any ticks before contact. One slip filed: a crit figure in
the BALANCE entry written before its source and corrected before the
commit.
