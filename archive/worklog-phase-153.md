# WORKLOG — Round 11 (The roster)

Per-phase narrative log (AGENTS "The planning stack"; `process/planning.md`
"The artifacts"): findings, decision rationale, rejected alternatives,
scope changes, playtest verdicts and the checks run land here under the
matching `## Phase N`; the ROADMAP stays a plan. The file holds the phase
in progress: at each phase close it moves to `archive/worklog-phase-N.md`
and a fresh one starts. Round 11's phases so far:
[archive/worklog-phase-149.md](archive/worklog-phase-149.md) (the
kickoff, §148, and the stat sheet, §149),
[archive/worklog-phase-150.md](archive/worklog-phase-150.md) (the board's
instruments, §150),
[archive/worklog-phase-151.md](archive/worklog-phase-151.md) (the
content, §151) and
[archive/worklog-phase-152.md](archive/worklog-phase-152.md) (the
weapons and defense, §152). Round 10's are `archive/worklog-phase-142.md`
to `archive/worklog-phase-147.md`.

## Phase 153 — power by rarity, its growth key, and the pools

The kickoff's inputs, by pointer: the charter, ROADMAP §153;
META-ROADMAP §"Round 11 — The roster"; TODO's Round 11 rows on power by
rarity (with the prior table v7's note on the halberdier and the
stormcaller), power's level-up draw and its growth key, act 1's cost
against the per-kind target, and the corpus's trade rows; BALANCE's
"Per-kind target bands" and its run log of 2026-11-06 (the units' worth,
the sheet's before and after records); what §152 hands on, its close
entry (archive/worklog-phase-152.md); `process/planning.md` "Phase
kickoff" and `process/measurement.md` for the box read. 151f, the units'
lines, lands here when the user writes them.

### The kickoff's audit, and the cut put to the user (2026-11-07, session d86f434b)

Read at `9b231e27`. The helpers are in `scratch/153/` (ignored by git):
`members.mjs` lists each act's encounters with their fielded archetypes,
rarities and power overrides; `moved.mjs` names the fights a scale
moves; `slot-share.mjs` reads a board row's `rosters.csv` by rarity;
`set-power.mjs` sets the catalog's power on a scale by rarity, per id.

- *What power is.* `baseStats.power` per archetype in
  `config/units.json`: 1, and 2 for the three legendaries (the
  stormcaller, the shaman and the enemy-only prodigy), its growth 0 on all
  29 combatants. `src/config/units.test.ts:341` pins it from `rarity` and
  holds every value in {1, 2}. An encounter entry may override it, as the
  King's adventurer at 6 and the bear at 4.
- *What it does.* Under the casualty rule each pool pays its own fallen
  power, and a cap turn adds the other side's standing power
  (`turnCharges`, `src/run/chipRule.ts`). For the player a unit's power
  is what its fall costs. The one way it pays the player is the cap
  surcharge it lays on the enemy, and cap turns were 162 of 19,608 and
  141 of 19,014 of the walk's turns at 150h (0.008 and 0.007). Its other
  readers: the pre-turn risk line (the hand's sum,
  `src/run/Run.ts:2528`), the bots' pick for a unit-target packet (the
  highest power, a tie to the higher level;
  `tests/fuzz/strategies/scored.ts:342`, the ARM's at
  `tests/fuzz/rollout/arbitratedStrategy.ts:554`), the `pass:weak`
  strategy (it declines a recruit below 2), and the card's POW. In
  `config/`, power appears only in the units' stat blocks, the
  encounters' overrides and prose; no status, daemon or packet moves it.
- *So TODO's power row had the sign reversed.* It said a steeper scale
  "adds most where worth already is". By the code's arithmetic a steeper
  scale charges a rare or legendary more each time it falls, so it lowers
  that unit's worth by what its deaths cost; unmeasured. As a lever by
  tier it moves the officer (−20.9 ± 14 taken free), the catapult (−14.7
  ± 13) and the shaman (−19.9 ± 13) the same way as the halberdier
  (+31.3 ± 14) and the stormcaller (+25.1 ± 14) (BALANCE 2026-11-06, the
  units' worth). It cannot close the spread inside a tier, which is
  §154's kits. The row's clause is corrected in this commit.
- *Where a scale lands, the enemy side.* In act 1 every fielded unit is
  common except in the King's later stages: the ronin (uncommon) in the
  second, the two catapults (rare) and the mages (uncommon) in the third,
  where the adventurer's entry sets it to 6. Under 1/1/2/3 the King's
  catapults alone move in act 1 (1 → 2); under 1/2/3/4 its ronin and
  mages (1 → 2) and its catapults (1 → 3). Of acts 2 and 3's 18 fights,
  1/1/2/3 moves 8 (the artillery, the Generalissimo, the Witch Hunt, the
  infernal column, the elemental trio, the plague doctors, the plague
  spreaders and the Queen) and 1/2/3/4 moves 11, adding the ronin against
  the mages, the brigand champions and the warband vanguard. Under
  1/2/3/4 three authored overrides fall to their archetype's new base: the
  officer's 3 in the Generalissimo, and the shaman's 4 and the corrupter's
  3 in the dark-magic posse. Under 1/1/2/3 every override stays above it.
  So the enemy re-anchor the charter expects is one fight in act 1; the
  rest is acts 2 and 3, which the scope guard records and does not
  retune.
- *Where a scale lands, the player side.* A desk estimate, not a
  measurement: the share of the player's fielded slots by rarity on
  150h's rows (`rosters.csv`, the composition entering each battle), and
  the mean power of a slot under each scale. If deaths fell evenly across
  slots, the player's cost would rise by the same ratio. They don't (the
  melee fall first, and gotcha #130 asks for fallen power, which no board
  row records by archetype), so the rise is a guide to size only.

  | row, act | common / uncommon / rare / legendary | a slot's mean power: 1/1/1/2 → 1/1/2/3 → 1/2/3/4 |
  |---|---|---|
  | ARM deploy, act 1 | 0.891 / 0.069 / 0.033 / 0.007 | 1.007 → 1.047 → 1.156 |
  | ARM regen, act 1 | 0.919 / 0.019 / 0.011 / 0.051 | 1.051 → 1.113 → 1.194 |
  | ARM priest deploy, act 1 | 0.896 / 0.061 / 0.032 / 0.010 | 1.010 → 1.053 → 1.157 |
  | ARM gambler deploy, act 1 | 0.788 / 0.163 / 0.038 / 0.011 | 1.011 → 1.060 → 1.272 |
  | ARM walk deploy, act 2 | 0.708 / 0.193 / 0.081 / 0.018 | 1.018 → 1.117 → 1.409 |
  | ARM walk deploy, act 3 | 0.552 / 0.302 / 0.124 / 0.023 | 1.023 → 1.169 → 1.618 |
  | ARM walk regen, act 2 | 0.784 / 0.045 / 0.036 / 0.135 | 1.135 → 1.305 → 1.520 |
  | ARM walk regen, act 3 | 0.649 / 0.088 / 0.070 / 0.193 | 1.193 → 1.457 → 1.809 |

  Act 1's fielded slots are 79 to 92 % common; on the Soldier's two rows
  his mercenaries and archers fill 86 and 87 % of them. In act 1,
  1/1/2/3 raises a slot's mean power by 4 to 6 % and 1/2/3/4 by 14 to 26
  %. In acts 2 and 3, 10 to 22 % against 34 to 58 %.
- *The growth key.* `STAT_KEYS` (`src/sim/leveling.ts:24`) draws nine
  values a level-up, and power's draw never adds, since its growth is 0
  and `RNG.next()` is in [0, 1). Six run streams draw level-ups in
  shipped config, not the five the census and the charter name: `team`
  (the starting roster at `startingLevel` 5, `config/recruitment.json`,
  and the construction grants), `levelup`, `offer`, `portStock`,
  `rewardBits` (the reward table's healer and mercenary at level 3) and
  `event` (`grantUnit`: the mage at 10, the prodigy at 3). Enemies level
  by `scaleStats` and draw nothing. `GrowthRates` appears only in
  `src/config/units.ts` and `src/sim/leveling.ts`, in no snapshot type,
  so taking the key out bumps nothing. The archetype editor builds its
  growth fields from the base stats' order
  (`tools/archetype-editor/editor.ts:202`), and the stat sheet's model
  adds a growth to every stat it lists (`tools/stat-sheet/model.ts:54`),
  so both drop power's. Two stale counts: `rollUnit`'s comment says
  `11 × (level − 1)` draws (`src/sim/archetypes.ts:126`), nine since
  Round 9 took precision and evasion out, and TODO's row says "the
  eleventh draw".
- *What the change breaks, planted* in a detached scratch worktree at
  `9b231e27`, run with `npx vitest run` and `npm run fuzz:smoke`. Power
  out of `STAT_KEYS` alone: 4 of 3954 main tests fail, each a seeded
  drive (the chaos census, the continuation check, the journal tool's
  replay, the resume gates), and 587 of 587 smoke tests pass. With
  1/1/2/3 set on top (8 archetypes moved): 11 fail, the 9 power-table
  pins by intent with the census and the journal tool, and the smoke 587
  of 587. The continuation check and the resume gates passed again
  there, so those two move with each change and are re-picked where they
  fail. The corpus was not run; with every recruit's rolls moved, it is
  recorded again. The worktree is removed.
- *Act 1 against both targets at the last box read*, 150h's ARM walk rows
  (the game before §152's bow and rioter), deploy / regen; in bold,
  outside its target:

  | encounter | kind | turns / won (target) | pool an instance (band) |
  |---|---|---|---|
  | bandit-king | boss | 5.58 / 5.46 (5.00–6.50) | 13.82 / 14.08 (10–30) |
  | bear | boss | 5.55 / 5.33 | 13.27 / 12.93 |
  | cats | elite | **3.83 / 3.77** (4.00–5.00) | 16.00 / 17.27 (6–18) |
  | vermin-lords | elite | 4.93 / 5.00 | **2.63 / 0.66** |
  | poachers | normal | 3.05 / 3.03 (2.50–3.25) | **7.43 / 7.76** (2–6) |
  | brigands (acts 1 and 2) | normal | 3.00 / 3.01 | 4.01 / 4.84 |
  | rat-hunt | normal | 3.06 / 3.03 | 3.04 / 2.83 |
  | canids | normal | 3.00 / 3.01 | 2.16 / 3.04 |
  | wolfpack | normal | 2.98 / 3.00 | **1.30 / 0.97** |
  | rats-nest | normal | 3.00 / 3.00 | **0.12 / 0.11** |

  The Vermin Lords' cap share is 0.098 on deploy and 0.015 on regen.
  Against 146f's misses (TODO's row), the cats moved from over the cost
  band (19.94 / 22.51) into it and under the turn target, with the ARM
  changed between the two reads.
- *The levers.* Under casualties a turn the hand wins burns the enemy
  pool by the wave's fallen power, so an all-common loop the hand clears
  each turn lasts its pool over its body count, whatever the bodies'
  level: the rats' nest burns 8.00 a turn on both rows, eight rats a
  wave, and lasts 3 turns on a pool of 20. By that arithmetic the level
  budget moves what a fight costs and leaves its turns, and the pool
  moves its turns, until a wave stops being cleared in one turn. 146e's
  isolation read matched in-situ turns within 0.25, but not cost: held
  out, the bear cost 11.55 an instance against 19.16 / 20.04 in situ at
  146f, the rat hunt 2.38 against 4.22 / 3.69. So a fight's cost is read
  in situ, and isolation can only rank a lever's steps.
- *The prior table v7* was measured under the flat scale, and the ARM's
  fold reads it, so once the scale lands the fold prices a rare without
  its new death cost until a rebuild (§155's, or 153g below). With 79 to
  92 % of act 1's slots common, the bias there is small.
- *The box.* 150h's act-1 ARM rows ran 58 s a seed on deploy and 71 on
  regen (1.9 and 2.4 CPU-hours at n = 120), so act 1 alone on the two
  Soldier rows with `--per-encounter` is about 4.3 CPU-hours, under an
  hour on one `cpx42` at `--jobs=8`. An act-1 row reads its walk row's
  first act: on 150h the act-1 roster tallies of `arb-deploy` and
  `arb-walk-deploy` match exactly (2,270 battles, 13,927 slots).
- *The corpus's trade rows* (TODO, weighed here as §152's close asked).
  A re-record lost a kind at 145g, 146e, 151b and 152b, and §152's
  re-picks cost about ten minutes of surveys (its close entry). §153 records the corpus again at 153a, 153b
  and 153e at least. Driving the trades by a scripted row is a harness
  change of its own, with its own test.
- *151f* has not landed; the user's lines arrive when written.

**The cut** (no snapshot bump; no RNG stream key added, six streams'
draws realigned at 153a; the box at 153c and 153f, and at 153g if taken):

- **153a — power's growth key out** (`none`). `growthRates.power` out of
  the schema, the 29 combatants, `STAT_KEYS` (eight draws a level-up),
  `scaleStats`, the stat sheet's model and the archetype editor's growth
  fields; the power-table test keeps its weights; the draw count's
  comment and TODO's row corrected. The oracle: a test that the new roll
  on a stream equals the old roll, kept in the test, on the same stream
  with a value spliced in after every eighth draw, every archetype at
  several levels and seeds, with its failing control (the splice one
  place early differs). The corpus recorded again; each seeded drive that
  fails re-picked by its own rule; the fuzz smoke fires (`src/sim/`,
  `config/`).
- **153b — power by rarity** (`batch`). Each combatant's power set by its
  rarity on the signed scale, per id; the power-table test pinned to the
  scale from `rarity`; DESIGN's two lines on the table; the overrides as
  authored. In act 1 it moves the King alone. The corpus recorded again;
  the fuzz smoke fires. *Read at 153e's stop:* a rare's card reads POW 2
  and a legendary's 3 (on 1/1/2/3), the pre-turn risk line adds them, and
  the post-turn ledger books that much when one falls; wrong looks like
  any of the three disagreeing.
- **153c — act 1 on the box** (`none`). Act 1 alone on the two Soldier
  ARM rows (150h's queue lines with `--per-encounter`), n = 120, at
  153b's HEAD: each encounter's turns and cost against both targets, and
  the King's turns under the scale, beside 150h's. Into BALANCE's run
  log. Docs only; the smoke does not fire.
- **153d — the moves put** (`stop`, the decision point). For each act-1
  fight outside a target on 153c's read: the lever (the level budget for
  cost, the pool for turns), its direction, and how it is tuned and read
  in situ; the rats' nest put on its own if no lever reaches its band
  without moving its turns.
- **153e — the tune** (`stop`). The signed moves, each tuned and baked
  into its encounter, with held-out seeds for turns; the corpus recorded
  again; the fuzz smoke fires. *At the stop:* the table before and after;
  the user plays act 1 on the dev server, a run and a forced fight by
  `?encounter=<id>`, for the scale's feel and the tuned fights. Wrong
  looks like a fight that now wipes the hand or costs nothing, or a
  rare's loss out of proportion.
- **153f — the verify read** (`none`, a pre-registered stop). 153c's rows
  at 153e's HEAD: act 1's turns and cost against both targets. A turn
  target missed, or a cost outside its band, goes back to the user: tune
  again or keep it.
- **153g — the prior table rebuilt** (`none`, if call 4 takes it). The
  registry's recipe at 153f's HEAD on the box (31.2 CPU-hours, 4 h 39 min
  on one `cpx42` at 150h), v8, and the units' worth re-read by
  `scratch/152/unit-worth.mjs`, for §154's kickoff. It stages
  `tests/fuzz/`, so the smoke and the jobs parity fire.

*The stretch the sign opens:* 153a, 153b and 153c, to 153d's stop.

**The calls, with the session's leans:**

1. *The cut and its reads* as above.
2. *Power's scale.* Lean: 1/1/2/3. In act 1, the only act this round
   tunes, the two scales part by a few points of the player's fielded
   power (4 to 6 % against 14 to 26 %, the estimate above), and the enemy
   side moves the King alone either way. They part in acts 2 and 3, which
   this round records without retuning and which ship in `0.4.0` as they
   stand: there 1/2/3/4 raises a slot's mean power by 34 to 58 % against
   10 to 22 %, and moves 11 of their 18 fights against 8. Under 1/1/2/3
   every authored override keeps a premium over its archetype; under
   1/2/3/4 the officer, the shaman and the corrupter lose theirs in two
   fights. A steeper scale later is a config edit and a board read, with
   no stream moving, so Rounds 21 and 22 can take 1/2/3/4 when they
   retune those acts. The other arm, 1/2/3/4: four distinct tiers, the
   uncommons (the ronin, the mage, the adventurer, the gunslinger) priced
   apart from the commons, the "or even" of the verdict.
3. *The player's pool.* Lean: held at 40. The per-kind target is in
   shares of the pool, act 1's cost rises by a few percent on the lean's
   scale by the estimate above (unmeasured until 153c), and seam 1 read 0.621 / 0.561 of max at 150h, above its
   band (0.475–0.55), so a small rise moves it toward the band.
4. *153g, the prior table rebuilt inside §153.* Lean: in. TODO's power
   row asks for the scale weighed against the units' worth, and only a
   rebuild reads worth on the new scale; §154's kit list is re-aimed on
   it. The cost is about 4.7 hours of unattended box, and §155 rebuilds
   again after the kits. The other arm: §154's kickoff reads the kits on
   v7 and the sheet, and the rebuild waits for §155.
5. *The corpus's trade rows.* Lean: out of §153, each lost kind re-picked
   by its rule as before. A scripted trade row is a harness change with
   its own test, which the session estimates at more than the losses have
   cost so far (four since 145g; §152's about ten minutes of surveys). The
   row stays in TODO, weighed again at the round close.

### The cut signed (2026-11-07, session d86f434b)

The user agreed that 1/2/3/4 is too steep and asked about distinct tiers
by 0.75/1/2/3, or 3/4/8/12 in whole numbers with morale raised three to
four times. The session's answer: the pools are priced in commons (act
1's enemies are common but for three in the King's later stages, and
commons fill 79 to 92 % of act 1's fielded slots), and read per common
0.75/1/2/3 is 1 / 1⅓ / 2⅔ / 4, a legendary at four commons, as steep at
the top as 1/2/3/4. The gentle scale with distinct tiers is 1 / 1.5 / 2 /
3 per common, 2/3/4/6 in whole numbers with morale doubled, whose cost is
every morale number in config doubled, the board's point refs moved and
the bots' scores checked constant by constant; a unit's base power is an
integer by schema (`z.number().int()`), while an encounter entry's
override may already be fractional (`src/config/encounters.ts:97`).

**Signed** (the user, 2026-11-07: "Agreed! But let's add a note
somewhere naming 2/3/4/6 as a future option"): the cut and its reads as
put; power's scale at 1/1/2/3; the player's pool held at 40; 153g in;
the corpus's trade rows out of §153. 2/3/4/6 with morale doubled is a
TODO row under Round 21, weighed where acts 2 and 3's pools are retuned.

The stretch: 153a, 153b and 153c, to 153d's stop.

### 153a — power's growth key out (2026-11-07)

*Step zero* found the audit's premises at HEAD: nine draws a level-up,
power's growth 0 on the 29 combatants, `GrowthRates` in no snapshot type.

*Built.* The growth schema without power, strict, so a power growth left
in the JSON fails at load; `GROWTH_KEYS` exported for the editors and
the sheet; `STAT_KEYS` at eight; `scaleStats` carries power over from
the base; `rollUnit`'s count at `8 × (level − 1)`. Checked in the
Browser pane (`dev-preview`): the archetype editor's growth fields run
CON to MOB with the mercenary's values, it reads "Valid — matches the
game schema", and its export writes no power growth; the stat sheet's
growth ranks run constitution to mobility while its base ranks keep
power; no console errors on either page.

*The oracle* (`src/sim/leveling.test.ts`): the new roll on a stream
equals the old roll, kept in the test, on the same stream with a filler
spliced in at the ninth place of every block of nine, stats and stream
position both, for the 29 combatants at levels 1, 4, 9 and 19 on seeds 1
to 20. Its control, the filler one place early (mobility's draw),
differs. A second test pins eight draws a level-up against a reference
stream.

*The seeded drives*, the four the plant predicted, each re-picked by its
rule (scans in `scratch/153/scans/`):

- The continuation check's completing run, 8 → 36: no two-hop Soldier
  run of seeds 1 to 20 completes now, and of 1 to 80 four do (36, 53, 66
  and 68); 36 is the smallest. The resume gates' run, 8 → 36, the
  quickest of the four (1,046 ms; 1,510, 2,159 and 2,033).
- The journal tool's run, 5 → 1, the smallest of 30 whose `hops=3`
  Soldier drive ends in victory.
- The chaos census: the procedural slot 9 → 32, the shortest of 40 that
  declines a reward and empowers a unit; the two-hop slot 6 → 32, the
  shortest of 40 whose walk clears a sector (it had no written rule, and
  it carried `dismissSectorCleared`); the Gambler's slot 31 → 32, the
  shortest of 40 that redraws, docks at a port, recruits and rests. The
  rest is added to that slot's rule, since no other slot rests and the
  census pinned `chooseRestOption`; without it seed 40 would take the
  slot and the census would lose the kind. The procedural slot's seed
  uses a packet, so `usePacket` moves from the blind side to the kinds
  that change a run: 16 change, 5 are only sent.

*The corpus:* 34 of 34 journals diverged, and the table was recorded
again. Three trades were in no row after the recording (a unit bought, a
packet bought, a unit paid off), and chaos 15, 26 and 10 no longer
traded, so from a survey of 40 with no dials they gave way to chaos 2
(the one run that buys a unit), 13 (the shortest that buys a packet) and
28 (the shortest that pays a unit off); chaos 16 still buys a daemon.
Recorded again: 20 of 21 kinds, 0 of 34 differing on replay,
`corpus.test.ts` 38 of 38.

### 153b — power by rarity at 1/1/2/3 (2026-11-07)

*Step zero:* `scratch/153/set-power.mjs` moved eight archetypes, per id:
the catapult, the reaver, the corrupter, the halberdier and the officer 1
→ 2, the stormcaller, the shaman and the enemy-only prodigy 2 → 3; then
`moved.mjs` on the new config names no fight still off the scale, and the
King is the one act-1 fight whose members moved (the audit's list).

*Built.* The power-table test reads the tier from `rarity` (1 / 1 / 2 /
3) and checks every tier is in use; DESIGN's two lines on the table; the
bots' packet-target comment, which still described the flat table and
the survivors rule's "chips the pools". The encounters' overrides are as
authored. The main suite at the change failed one test, the step-code
guard, on a phase address written into the table's comment (taken out);
no seeded drive moved. The corpus: 28 of 34 journals diverged, recorded
again, 20 of 21 kinds with no row re-picked, 0 of 34 differing,
`corpus.test.ts` 38 of 38. No snapshot bump: a saved unit carries the
power it was rolled with, and no player holds a v51 save (`0.3.0`'s are
v50), so only a dev save from before this commit keeps a rare at 1.

*The read* is `batch`, at 153e's stop (the cut's script); built, unread.

### 153c — act 1 on the box (2026-11-07)

The read and its numbers are in BALANCE (2026-11-07, act 1 on the new
power table): act 1 alone on the two Soldier ARM rows at `ee480b32`,
n = 120, one `cpx42`, 65 minutes. In short, deploy / regen:

- Act 1 cleared 114 / 80 of 120 (150h 113 / 93); the regen row's loss
  is told apart on the seeds (19 : 6, p 0.015), and the rows cannot say
  which of §152's numbers, the re-baseline or the scale moved it. Seam 1
  24.62 / 19.59 (band 19.0–22.0).
- Outside a target: the rats' nest (0.06 / 0.02 pool an instance), the
  wolfpack (1.52 / 1.44) and the Vermin Lords (2.34 / 1.16) under their
  cost bands; the poachers over theirs (7.70 / 8.76); the cats under the
  turn target on deploy (3.79) and over the cost band on regen (19.64).
  The King and the bear in both targets; each kind's mean in its band.
- The cut's estimate of the box time (4.3 CPU-hours for both rows) was
  off: each row took 3.7, at 110 s a seed against 150h's 58 and 71 for
  the same queue lines, `--per-encounter` added. Not chased: the batch
  ran 65 minutes against an estimate under one.

### 153d — the moves put (2026-11-07, at its stop)

*Step zero,* the rats' nest's lever in isolation on 10 seeds (BALANCE,
the same entry): its level budget ×3 costs 0.70 an instance, ×4 2.80,
×5 8.90 with its turns starting to move; a cliff between ×3 and ×5, the
rats near five times the hand's mean level at ×4.

*The moves, with the session's leans.* Each fight's lever by the
arithmetic of the kickoff's audit (the level budget moves cost and
leaves turns while the hand clears a wave in a turn; the pool moves
turns); the aim inside each band is chosen so act 1's total holds:

| fight | now, deploy / regen | lever | aim |
|---|---|---|---|
| poachers | 7.70 / 8.76 pool (2–6) | level budget down, both waves | about 4 |
| wolfpack | 1.52 / 1.44 pool (2–6) | level budget up | about 3 |
| Vermin Lords | 2.34 / 1.16 pool (6–18) | the rats' share of the level budget up; the pool down if turns pass 5.00 | about 7 |
| cats | 3.79 turns on deploy (4.00–5.00); 19.64 pool on regen (6–18) | the pool up a little (30 → about 33) and the level budget down a little | 4.2–4.5 turns, about 15 pool |
| rats' nest | 0.06 / 0.02 pool (2–6) | call below | about 2.5 |
| the King, the bear, the canids, the rat hunt, the brigands | in both targets | held | — |

At those aims, holding each fight's instances a run as 153c read them, act
1 costs about 1.0 more morale a run on deploy and 0.7 less on regen; a
desk estimate, unmeasured until 153f. Without the rats' nest's move,
0.6 less and 3.2 less.

*The method* (the session's, inside the cut): each move by forced
isolation on the box (146e's shapes, the doctrine player on the deploy
vector, 40 seeds a step), each fight's isolation cost calibrated to its
in-situ cost from 153c at the current config, since isolation cost is
not in-situ cost; baked to two places into the wave spec or the pool,
held-out seeds for turns; then 153f in situ.

*The call: the rats' nest.* (A), the lean: tune it to the band's low
edge, about 2.5, by whichever lever lands there on the gentler slope in
isolation, the rats' level or their count with the pool raised to hold
three turns (the count lever is unmeasured upward). A cliff near the
aim means a hand weaker than the bot's may meet the steep side, which
153f and the user's play read. (B): leave it a breather, its cost near
nothing, and amend the per-kind target in BALANCE to exempt it by name.

**Signed** (the user, 2026-11-07: "Signing the moves, and I agree with
your lean. A sounds good to me!"): the moves and their aims as put, and
the rats' nest tuned to the band's low edge (A).

### 153e — the tune (2026-11-07 → 11-08; signed)

The sweeps, the calibration and the predictions are in BALANCE
(2026-11-07, act 1's five moved fights in isolation). Step zero found two
signed levers short of their aims in isolation:

- *The cats.* Their level budget barely moved their cost (17.3 to 17.9
  alone at ×0.8 to ×0.9 with the pool ×1.1), and the pool raised their
  cost with their turns. Built: fewer cats at the same level (count and
  level budget ×0.75), the pool held at 30, 4.60 turns and 14.55 pool
  alone. Inside the move's intent (turns up, cost down) by the count, not
  the pool and the level.
- *The Vermin Lords.* The signed lever, the rats' share of the level,
  cannot be swept on the box (`--set` reaches only a config group's
  top-level numbers); probed locally on 20 seeds it flattens near 5.3
  alone, short of the aim. The whole wave's level flattens at 3.77, and
  more rats at the same level reaches the aim (×2.5, 8.13) at 34 bodies
  and nearly three times the bot's time. Built: the rats three times as
  strong and half again as many (16 rats and the four healers, 7.05
  alone at pool 90), the pool 86 for turns. **Flagged for the stop:** a
  change of lever inside the signed intent (cost about 7, turns held),
  and a fight that fields 16 rats where it fielded 10, at three times
  their level.
- *The rats' nest* by its level, ×3.5, since its count lever stays far
  under the band (×2.5, 0.85 alone). On 40 seeds the slope is smoother
  than the 10-seed probe showed (×3 0.82 to ×4 4.42). The rats field
  near four times the hand's mean level, which shows on their cards.
- *The wolfpack* ×1.7 and *the poachers* ×0.55, as signed.

*The seeded drives:* the chaos census's no-dials slot 31 → 18; its walk
took 5 s alone, past the 4 s at which the test's comment re-picks a slot
for its 15 s timeout, and 18 is the shortest of 40 that leaves both
census lists as they are. *The corpus:* 20 of 34 diverged and the table
was recorded again. Chaos 2 and 28 stopped trading and chaos 16 now pays
a unit off; no run of 40 with no dials buys a unit, so chaos 53 (the
shortest of 80 that does) and 37 (the shortest of 40 that buys a daemon)
join the trade rows. Chaos 37 also sells a packet, so the corpus reaches
all 21 command kinds for the first time and its test is re-pinned at 21;
0 of 34 differ, `corpus.test.ts` 38 of 38.

*The held-out turns* (2026-11-08, session 08067f79; BALANCE, "153e's
held-out turns, and the Vermin Lords' pool"): the five fights as baked,
alone, on seeds 5001 to 5040. Four held their turn targets (the
poachers, the wolfpack and the rats' nest at 3.00, the cats at 4.35).
The Vermin Lords read 5.13, over their 4.00–5.00, so the pool went back
into the bake, as 153d's move allows ("the pool down if turns pass
5.00"). Swept on the tuning seeds, their turns step from five to four at
a pool of 80, since a cleared wave of 20 bodies burns about 20 a turn,
and no pool lands near the 4.9 the bake aimed at. By the rule set before
the sweep (the highest pool reading at or under 4.90) the pool is 80, at
`1cedbd9d`: held out at 4.28 turns on fresh seeds 6001 to 6040 and
4.25 on 5001 to 5040 (5.13 at 86). The corpus: 10 of 34 journals
diverged, recorded again, 21 of 21 kinds, 0 of 34 differing,
`corpus.test.ts` 38 of 38; the hook's suite passed with no seeded drive
re-picked.

**Flagged for the stop:** the Vermin Lords' turns go to about 4.3 in
isolation, where 153c read 4.90 in situ: inside the target, but not the
"turns held" of the move. The other side of the step reads 5.03 at 82
and 5.10 at 86 on the tuning seeds, outside it.

*The stop* was put on 2026-11-08 (session 08067f79): the table before
and after, the play script with 153b's read, and the three flags (the
Vermin Lords' lever and size, their turn step, the rats' nest's levels).

**Signed** (the user, 2026-11-08: "Signing these, Claude! 😁 They feel
great!"): 153e as built, the Vermin Lords' pool at 80 and the rats'
nest's levels kept; 153b's `batch` read signed with it.

### 153f — the verify read (2026-11-08, kept)

The read and its numbers are in BALANCE (2026-11-08, act 1 after the
tune): 153c's queue at `305cab62`, n = 120, one `cpx42`, 49 minutes. In
short, deploy / regen:

- Every turn target holds, the cats now inside theirs (4.53 / 4.54).
  Act 1 cleared 115 / 79 of 120, paired against 153c's 114 / 80 at p
  1.000 both.
- Two costs fall under their bands, both on deploy: the Vermin Lords
  (5.79 / 8.26, band 6–18) and the rats' nest (1.73 / 3.00, band 2–6).
  Weighted by instances over the two rows, each sits at its signed aim
  (7.2 against about 7; 2.50 against about 2.5). The poachers, the
  wolfpack and the cats are inside both targets on both rows.
- Act 1 costs 0.5 / 1.3 more a run than at 153c. Seam 1 is 23.91 /
  17.57, the regen row now under its band (153c 19.59, inside); the seam
  is a run-shape band of the sheet's walk rows, outside 153f's check.

**The stop** (pre-registered: a cost outside its band goes back to the
user, tune again or keep). The calls, with the session's leans:

1. *The rats' nest on deploy, 1.73 of 2.* Lean: keep. The signed aim was
   the band's low edge, so reads on both sides of it are what the aim
   asks for, and the two rows average 2.50. The other arm: its level
   ×3.5 → ×3.75 (153e's isolation sweep, 2.17 → 3.15 alone), with its
   rats further above the hand's level than the flag the user accepted.
2. *The Vermin Lords on deploy, 5.79 of 6.* Lean: keep. The two rows
   average 7.2 against the aim of about 7, the regen row is inside at
   8.26, and the calibration that would aim a second tune did not carry
   (153e predicted the rows the other way round). The other arm: their
   level up a step, sized by a new isolation sweep, and 153f again.

Either arm of "tune again" costs a bake, the corpus and 153f again
(about an hour of box), and 153g waits on it. On "keep", 153g runs at
this HEAD.

**Signed** (the user, 2026-11-08: "I vote that we keep both, Claude! 😁
This looks great!"): both kept, the Vermin Lords at pool 80 and the
rats' nest at ×3.5; 153g next, at this HEAD.

### 153g — the prior table rebuilt (2026-11-08)

The table and its numbers are in BALANCE (2026-11-08, the prior table
v8): v6's three lines at `3f051b43`, one `cpx42`, 5 h 4 min; v8
committed at `614dcf68`. In short:

- 36 items, 34 over the floor. Diana and Hecate are measured for the
  first time, so the coverage test's PENDING acknowledgments for them
  went; the test failed on them until they did, which is its job.
- The table moved down: the mean margin over items +10.1 to −1.5, every
  family lower. Four changes landed between v7's measurement and v8's
  (151c, 152b, 153b, 153e), and none is isolated.
- The units' worth on v8, by `scratch/152/unit-worth.mjs` (n and mean
  equal to the table's on all 16, a planted mismatch caught). The officer
  is the worst row free and bought (−50.1 ± 17, −68.8 ± 33); the
  mercenary bought (−41.2 ± 12) and the shaman bought (−59.1 ± 22) pass
  two errors, and the mage free (+29.3 ± 14) on the high side. Rows v7
  flagged that v8 does not: the rioter free (−33.4 to −4.1, after §152's
  point of defense), the halberdier and the stormcaller free (+31.3 and
  +25.1 to within an error of 0), the gunslinger and the adventurer
  bought (+74.6 and −59.4 to within one). The seven rare and legendary
  draftables fell 19.1 on average and the rest 2.5, which fits power's
  casualty cost (a fallen rare now costs its pool 2) but is not
  isolated.

*For §154's kickoff:* TODO's kit-watch list is re-aimed there on these
numbers (BALANCE's table is the read). 153c's and 153f's act-1 rows ran
under v7; the ARM under v8 has not been read on act 1, and §155's board
reads act 1 under the table as it then stands.

### The hand-off after 153e's bake (2026-11-07, session d86f434b)

At the context trigger, after `0b9a326c`.

*Done:* the cut signed with power at 1/1/2/3; 153a, 153b and 153c built;
153d's moves signed, the rats' nest at (A); 153e's sweeps and bake.

*Open:*

- **153e's held-out turns.** The five fights at `0b9a326c` on seeds 5001
  to 5040: the lines of `scratch/153/153e-sweep.queue` for the five
  fights' ×1 arms with `--seed-offset=5000` and no `--set`, on the box.
  `0b9a326c` and the docs commit after it are not on origin, so push
  first. Read with `node scratch/153/sweep-read.mjs <batch dirs>`. A turn
  target missed there goes back into the bake before the stop; the likeliest
  is the Vermin Lords' 4.00–5.00, read at 5.15 with the pool at 90 before
  the 86.
- **153e's stop.** The table before and after: BALANCE's 153c table
  against the held-out rows and BALANCE 153e's predictions. The user
  plays act 1 on the dev server, a run and each moved fight forced by
  `?encounter=<id>` (`rats-nest`, `wolfpack`, `poachers`,
  `vermin-lords`, `cats`), and with it reads 153b (the cut's script: a
  rare's card at POW 2 and a legendary's at 3, the risk line and the
  post-turn ledger agreeing). Put the two flags above with it: the
  Vermin Lords' lever and size, and the rats' nest's levels.
- **Then 153f** (153c's queue, `scratch/153/153c.queue`, at the stop's
  HEAD, read by `scratch/153/act1-read.mjs`) **and 153g** (the prior
  table rebuilt, the registry's recipe).

*Tools,* all in `scratch/153/` (ignored by git): `act1-read.mjs` (act 1
by encounter against both targets), `sweep-read.mjs` (an isolation
sweep's forced rows), `bake.mjs` (a lever into one encounter, per id),
`vl-set.mjs` (the Vermin Lords' wave), `set-power.mjs`, `moved.mjs`,
`members.mjs`, `slot-share.mjs`, the seed surveys in `scans/`, and the
queue files.

### §153 closed (2026-11-08, session 08067f79)

**The exit** (ROADMAP §153): act 1's turn targets held on a box read
(153f, `305cab62`, n = 120: every fight inside its target on both rows)
and its cost per kind read against the target (each kind's mean inside
its band; two fights under theirs on deploy, kept by the user). Power's
scale decided at 1/1/2/3, its growth key out (153a), the pools' moves
signed (153d) and baked (153e). *The scope guards:* across §153 (`git
diff 9b231e27..HEAD -- config/ src/ tools/`) five encounters moved, all
act 1's (the wolfpack, the rats' nest, the poachers, the Vermin Lords,
the cats), with power by rarity and the growth key in `units.json`,
`src/` and `tools/`; acts 2 and 3 were recorded at the kickoff (8 of
their 18 fights move under the scale) and none was retuned. 3957 main
tests in 271 files, 587 fuzz:smoke in 60 and the jobs parity 1 of 1 at
`614dcf68` (its hook); the corpus 38 of 38 at `a03b871d`.

What §153 hands on:

- §154's kit-watch list, re-aimed at its kickoff on the prior table v8's
  unit rows (TODO's kit row; BALANCE 2026-11-08): the officer the worst
  row free and bought, the mercenary and the shaman low bought, the mage
  high free, the halberdier and the stormcaller no longer high.
- Act 1's box rows (153c, 153f) ran under the prior table v7; the ARM
  under v8 is unread on act 1 until §155's board.
- Regen's seam 1 read 17.57 of 40 at 153f, under its band (153c 19.59,
  inside); it is a band of the sheet's walk rows, read at §155's board.
- The board's act-1 refs (150h) stand on the numbers before §152 and
  §153, until §155.
- Power at 2/3/4/6 with morale doubled, a TODO row under Round 21.
- 151f, the units' lines, when the user writes them.

**The friction read**, the five lines filed in §153 (three slips and two
papercuts, two of the slips retrospective at 153g) and the two session
reports:

- *A claim written before its source*: TODO's power row read power as
  strength (the kickoff, papercut; caught by reading the chip rule before
  the scale was posed, no cost beyond the check), and two draft lines in
  08067f79, a pool's turns past the swept points and how a sign was read
  (153g, slip; caught before commit). Both reports also name a pull to
  present an estimate as settled (the 20-seed lever, pool 80 as "turns
  held"), each put as a flag instead. It continues the pattern the user
  answered at §150's close with no rule; nothing here is new to that
  answer, so it is listed, not put again.
- *A shell refusal before the command ran*: a long quoted heredoc
  refused by the shell (the kickoff, slip; `process/shell-and-windows.md`
  names the trap) and the backticks guard on a `node -e` template literal
  holding markdown (153g, slip); a resend each through the Edit tool.
  Listed, not a candidate.
- *A lever the box cannot sweep* (153e, papercut): `--set` reaches no
  encounter's numbers, so the Vermin Lords' rats' level weight was probed
  locally on 20 seeds, under the box rule's trigger, and the pool later
  swept through a run-wide multiplier, exact only for a forced fight.
- *Seeded drives re-picked by seed*: three trade rows at 153a and two at
  153e, the corpus's trade rows left out of §153 at the cut (TODO's
  corpus row). Listed.

*Dispositions:* the power row's stale claim fixed at the kickoff
(`322d5477`); the per-encounter `--set` a TODO row under Round 11's
"Before the closing board", since §155 re-pins act 1's bands and may
sweep a fight again. No `distress` was filed, and neither report records
a wish to pause or stop. No candidate goes to the user.
