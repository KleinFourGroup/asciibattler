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
