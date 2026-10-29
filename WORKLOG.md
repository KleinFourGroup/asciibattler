# WORKLOG — Round 9 (The frame and the misses)

Per-phase narrative log (AGENTS "The planning stack"; `process/planning.md`
"The artifacts"): findings, decision rationale, rejected alternatives,
scope changes, playtest verdicts and the checks run land here under the
matching `## Phase N`; the ROADMAP stays a plan. The file holds the phase
in progress: at each phase close it moves to `archive/worklog-phase-N.md`
and a fresh one starts. Round 9's earlier phases:
[archive/worklog-phase-135.md](archive/worklog-phase-135.md) (the kickoff,
§134, with the spec's answers and the charter's premises at HEAD; and
§135, the board's instruments),
[archive/worklog-phase-136.md](archive/worklog-phase-136.md) (§136, the
trial's switch and arms; at its close the trial rolled back and the round
re-cut),
[archive/worklog-phase-137.md](archive/worklog-phase-137.md) (§137, every
strike lands, headless; at its close, the stdin guard and the pre-commit
hook checking the commit itself) and
[archive/worklog-phase-138.md](archive/worklog-phase-138.md) (§138, the
screen after the misses, read in play; before its kickoff, the friction
log's third kind).

## Phase 139 — the board and the user's play

The kickoff's inputs, by pointer: what §137 left for this phase (the rows
on a rounding boundary, the bot's vectors without two terms, the riders
on every strike, the corpus's victories 10 to 3 of 30),
`archive/worklog-phase-137.md`, "§137's close, put to the user"; the
user's first play of the converted game at §138's close, that the
encounters against many mercenaries are much harder now,
`archive/worklog-phase-138.md`, "§138 closed".

### The kickoff's audit, and the cut put to the user (2026-10-29)

Read at `7bd65732`:

- *The encounters the report names.* Six field mercenaries, and each
  pairs them with an archer: act 1's adventurer-with-guards (normal:
  mercenaries three to an archer, a fixed rogue, then the adventurer),
  warband-vanguard (elite, with a fixed mage) and the bandit king (boss:
  mercenaries and an archer, then bandits, a rogue and a ronin); act 2's
  infernalColumn (with a reaver), plagueSpreaders (elite) and the
  generalissimo (boss). `encounter=<id>` on the URL forces one at every
  node of its kind (`RunConfig.ts`).
- *The swing read* (BALANCE.md's run log, 2026-10-29): each converted
  unit's damage a swing in play, on 137a's commit and at HEAD, two bots,
  200 seeds each. 15 of the 19 rows with at least 1,000 swings sit outside
  ±10 %, by the attacker's old hit rate: the rogue +46 %, the archer
  +19 %, the adventurer +18 %, the mercenary +10 %, the bandit −25 % to
  −29 %, the gunslinger −18 %; the ghoul (+21 % to +71 %) and the officer
  (+15 %) by the floor. The cause is the defense rule: a swing used to pay
  its attacker's rate of the defense it met, and now pays the pooled
  rate's (0.488), whoever swings. 137c's check compared each base strike
  with the old mean before defense, which this term does not reach.
- *Against the user's report.* Every attacker in the mercenary
  encounters sits above the pooled rate, and the bandit encounters' below
  it, so on the bots the two kinds of fight moved apart. That may be why
  two bots over 100 seeds did not drop at 137c while the user's
  mercenary fights got much harder: a hypothesis, for the board's
  per-encounter pool damage. The gain is `(h − 0.488)·d`, so it grows
  with the target's defense: the armour a player builds is worth least
  against exactly these attackers.
- *Rule D, the arithmetic* (`scratch/139/ruled.mjs`): keep each swing at
  the defense its strikes met in play, `raw' = h·raw − (h − 0.488)·d_met
  / (1 + c)`, rounded as rule C. Seven bases move a point: the rogue's
  strength, the luminant's and the archer's ranged and the adventurer's
  strength down; the bandit's strength, the gunslinger's ranged and the
  officer's strength up. The mercenary's target is 5.62 against its 6, so
  it stays: its +10 % is mostly its rounding (5.76 to 6), the rest the
  defense term. The floor is
  outside the formula: the officer's point would push a row the floor
  already holds 15 % high further up, and the ghoul's rise is the floor's
  alone.
- *The comparator.* No dial since 137b, so the old game runs only at an
  old commit. `box-batch.sh` pulls main on the box and holds it to the
  local HEAD, and `box-drive.sh` refuses a HEAD other than origin/main's
  tip. §118e's level 0 (`987b0cb`, on disk) differs from the old game by
  the events' rewrite (`ff1d8111`, `5e4dcd5e`) besides Round 8.5's
  byte-identical deletions, so it is not a clean pair; 136a's bar
  reported it beside, not against.
- *The bot's share.* 137c dropped the deploy vector's precision (−0.65)
  and evasion (−0.27) weights. The old game with the new vector would
  need a vector file at the old commit, which its tree does not hold.
  Cohorts on rule C and on the moved numbers both carry the new vector,
  so the second against the first is free of it.
- *The pin and the doc.* `tests/strike-conversion.test.ts` takes signed
  moves in `DEPARTURES`, each with where it was signed. DESIGN's Combat
  section states the conversion's rule and will need the moves said.
- *Rows on a rounding boundary* (from §137): the prodigy (target 5.17,
  3 + 2 as built, 99 swings at HEAD) and the healer's and rioter's
  defense stay as they are.
- *Cost.* §118e's level 0, the same two rows' four batches, took 62
  minutes on `cpx42`; three cohorts are about 3½ hours of box.
- *Not in the read:* the spells and the catapult, whose gain against the
  halved defense is the conversion's one designed move (the probe counts
  the thirteen converted units); fights past the weak bots' depth.

**The cut** (no step adds an RNG stream or bumps a snapshot):

- **139a — the box runs a pushed commit behind main's tip** (`none`).
  `box-batch.sh` checks out the launching tree's HEAD by its sha on the
  box (a fetch and a detached checkout in place of the pull);
  `box-drive.sh` takes a HEAD that origin/main contains and calls
  `box-batch.sh` from its own directory, so a cohort runs from a detached
  worktree. Exit: a launch from an unpushed commit refused (planted); a
  fetched batch's manifest names the worktree's commit (at 139c's first
  launch). Scripts only; the smoke does not fire.
- **139b — each converted strike back within reach of its old swing**
  (`none`). Whole points on a unit's base strength or ranged, toward its
  old damage a swing in play, where the point lands nearer, and no base
  strike under 1; rule D's arithmetic is the start and the swing read
  decides, and a unit under 1,000 swings (the luminant, the prodigy, the
  halberdier) takes the arithmetic. Predicted: the rogue, luminant, archer, adventurer and ghoul a
  point down, the bandit and gunslinger a point up; the officer stays
  (its point down is a strike of 0, which the card would show though the
  floor deals 1), and the mercenary, reaver and ronin are inside ±10 %.
  The moves into the pin's `DEPARTURES` with the read's numbers, and
  DESIGN's conversion sentence. Exit: the swing read at the new numbers,
  each unit pooled over sides and bots, within ±10 % of the old tree's or
  at its nearer point, each exception named; rule C's rows are the
  control that the read sees a miss. Every battle with a moved unit
  re-baselines: the smoke's pins, the corpus by `--record`. The smoke
  fires.
- **139c — the board, three trees** (`none`; read at 139d). §118e's two
  rows (`arb-deploy`, act 1 at `--hops=11`; `arb-walk-deploy`, two acts,
  `--per-encounter`), soldier, level 0, seeds 1 to 120 (40 and 80), at
  `a042bf2c` (the old game), the commit before 139b (rule C) and 139b's,
  each a `box-drive.sh` cohort. Into BALANCE's run log: each row's paired
  table against the old game (less deep, the same, deeper; the sign
  test), each encounter's pool damage taken per instance on the walk row,
  the rosters' mix, and `--report` against the sheet beside. Docs only;
  the smoke does not fire.
- **139d — the board read and the user's play** (`stop`). The user plays
  139b's game, the mercenary encounters by `encounter=adventurer-with-guards`,
  `encounter=warband-vanguard` and `encounter=bandit-king`, and a bandit
  one beside (`encounter=highwaymen`). The stop brings each line the
  board crossed and each row the swing read left, with a candidate move
  and what it predicts.
- **139e — what 139d signs** (cut at 139d, read with it).
- **139f — DESIGN's Combat paragraph against the game, and the phase's
  close** (`stop`).

**The calls, with the session's leans:** the strikes brought back in this
phase rather than at Round 11's retune (yes: a converted number missed,
and the play found it); the rule, whole points toward the old swing by the
read, over rule D's arithmetic alone (which moves the officer the wrong
way past the floor and leaves the ghoul); the bar written before the
board: each unit's swing within ±10 % or at its nearer point, each board
row's wins within one Escalation step of the old game's either way (11 of
120 on act 1 and 7 of 120 on two acts, §118e's level 0 to level 1), each
encounter's pool damage within two standard errors of the old or named,
and rule C's cohort as the board's control, so that if C sits inside the
line the read says the line cannot vouch for the moved numbers; the
mercenary left at 3 + 3 (+10 %, the band's edge; a point down is about
−9 % and weakens the soldier's starters by the same) and read at 139d
after its archers, rogues and adventurers come down; a fresh cohort of
the old game as the comparator, §118e's level 0 beside; the bot's share
not separated; no re-pin of the sheet in this phase (Round 11's retune
re-pins it). The stretch: 139a to 139c, then the stop at 139d.

### The cut signed (2026-10-29)

"That sounds reasonable, Claude! 😁 My read missed just how much stronger
rogues were now. So no formula changes; just tweaking the stats until the
numbers look closer. I'm happy to sign everything, then! 😁" The cut as
written, with the seven calls at the leans: the strikes brought back in
this phase; whole points on the units' stats by the swing read, with rule
D's arithmetic only as the start and no formula change; the bar as
written; the mercenary left at 3 + 3 and read at 139d; a fresh cohort of
the old game as the comparator, §118e's level 0 beside; the bot's share
not separated; no re-pin of the sheet in this phase. The stretch: 139a to
139c, then the stop at 139d.

### 139a — the box at a pushed older commit (2026-10-29)

Step zero: as the audit read, `box-batch.sh` pulled main on the box and
held it to the local HEAD, and `box-drive.sh` refused any HEAD but
origin/main's tip and called its sibling scripts as `scripts/…` from the
working tree. Built: `box-batch.sh` refuses, before any ssh, a commit
origin/main does not hold, and the box fetches and checks out that commit
by its sha in place of the pull; `box-drive.sh` takes a HEAD origin/main
holds, says how far behind the tip it is, and calls `box-launch.sh` and
`box-batch.sh` from its own directory, so it can be run by its path from a
detached worktree; `process/measurement.md` says how.

**The check**, without a box: copies of the two scripts beside a stub
`box-launch.sh` that prints and fails, so a pre-flight that wrongly
passes reaches the stub and not Hetzner, run from two worktrees. From an
unpushed commit (`e888b91d`, local only then): `box-drive.sh` refused
("not on origin/main") without calling the stub, and `box-batch.sh`
refused before ssh. From `a042bf2c`, 19 commits behind the tip:
`box-drive.sh` passed its pre-flight and called the stub's create, and
`box-batch.sh` got past its guard to ssh (refused by the dummy host). Not
yet seen: the box's own checkout of an older commit; 139c's first launch
from the old tree shows it in the fetched manifest's `head`.

### 139b — the strikes back by whole points (2026-10-29)

**The moves**, placed by the swing read (BALANCE.md's run log,
2026-10-29, the third entry): the rogue's, the adventurer's and the
ghoul's strength, the luminant's and the archer's ranged a point down,
the bandit's strength and the gunslinger's ranged a point up, the seven
the kickoff predicted. One pass placed them: every unit of at least 1,000
swings sits within ±10 % of the roll's damage a swing, or at its nearer
whole point (the rogue +12.0 %, the ghoul +11.7 %, the officer +11.1 %,
the gunslinger +10.9 %). The mercenary, the reaver and the ronin were
inside the band and did not move (+9.5 %, +9.8 %, +3.4 %); the prodigy
(87 swings, −17.6 %) is too thin to place. Over every converted swing,
+4.6 % against the roll's (rule C's +10.2 %). Written into the
conversion pin's `DEPARTURES`, with a check that each one moves a base
strength or ranged by whole points and keeps the strike at 1 or more;
the hand-worked spot checks now read the rules without the departures.
DESIGN's conversion paragraph says the moves.

**The proofs:** the pin passes, 5 tests; the archer's ranged planted back
at 4 failed it, naming the key, and a ghoul departure of −1 failed both
the derivation and the new check. Typecheck clean; `npm test` 3768 in
262 files; the smoke 553 in 58, untouched; the corpus re-recorded by
`--record`, 0 of 32 after, its test 36.

**Step zero's findings, inside the cut's intent and flagged:**

- *The River drift gate tripped* (seed 100's player 2.516 against 2.5),
  with movement untouched; the user signed its re-expression as a
  twenty-seed lean ("I ran a few tests of my own, Claude, and can confirm
  that I'm not seeing any visible drift, so I'm on-board with your
  proposal!"). The reading, the gate and its control are PATHING.md's
  139b entry. The first control, the sidestep's tie always clockwise,
  moved nothing on River; the dropped straight-line tie-break tripped the
  new gate (+1.86 / −1.53).
- *Seeded drives that moved:* the continuation and resume tests'
  completing `sectorHops=2` soldier run, seed 9 to 4 (9 no longer
  completes; 4, 11, 16 and 18 do, 4 the quickest at 14 battles; the
  journal-across-loads test still passes on 9 and keeps it); the chaos
  census gains `redrawCards` and `usePacket` on its four seeds.
- *The corpus lost its port purchases* on re-recording (16 of 21 kinds,
  none at a port), so two rows joined it from `--survey=12`: chaos 12
  (a packet bought) and chaos 8 as the gambler with 300 bits (a unit
  bought and one paid off, the first stored run to pay to remove one).
  19 of 21 kinds now, buying a daemon and selling a packet the two
  missing; TESTING.md's counts and limits follow. The corpus ends 5
  victories in 32 (3 of 30 at rule C, 10 of 30 under the roll).
- *A timeout under load:* the build-ID test's repository plant (about
  twenty git processes, about 1 s alone) timed out at 5 s in two of four
  full runs, once at 12 s, in a file 139b does not touch; it takes the 15
  s the suite's other near-5 s tests carry, in a commit of its own
  (139b-pre, `ca97b9fc`).

Tools: `scratch/139/` (`setbase.mjs` sets a base by id and reads it back;
`drift.ts` reads River's drift over a seed window; `compare.mjs` takes
the trees to compare and `--pool`).

### 139c — the board on three trees (2026-10-29)

The numbers are BALANCE.md's run log (2026-10-29, "the board on three
trees"); here, what they say against the bar.

- *139a's box half:* each of the twelve batches' manifests names its
  cohort's commit with a clean tree, two cohorts (the old game and rule
  C) behind main's tip and launched from detached worktrees.
- *Act 1 holds.* Rule C wins as many as the old game and the moves 3
  fewer, inside the line of 11, and neither is told apart (p 1.000).
- *Two acts cross the line.* Rule C wins 23 more and the moves 28 more,
  against a line of 7, each told apart from the old game (p 0.029 and
  0.003). The control works: the board sees a miss of rule C's size on
  this row. The moves are not told apart from rule C on either row (p
  0.678, 0.885), so 139b's moves did not move the board; what it sees
  on two acts is not carried by the converted strikes, which the swing
  read put back within reach of their old swings (inference from the two
  reads together).
- *Where:* the player takes 27 to 38 % less pool damage in act 2's
  elites and bosses, 46 and 41 % less in act 1's bandit fights (the
  highwaymen, the deserters) and 59 % more against the ronin and the
  mages; act 1's bosses move 6 % either way. The deep boss's wall goes from 0.579 to 0.200 against its
  band of 30–35, from above it to below it. No encounter's two standard
  errors can be read: the board writes means only.
- *Not separated, by the signed call:* the bot's share. Rule C and the
  moves carry 137c's deploy vector (its precision and evasion weights
  dropped), the old game the old one. Untested candidates besides it:
  the spells and the catapult against halved defense, the conversion's
  designed gain (the ronin and the mages is a fight of mages, and it got
  harder); and the chance taken out of every strike, which favours
  whichever side is ahead (a hypothesis, not measured).
- *The user's play* (139d's half, read before the board, on `e6fdd8c2`
  by the four encounter URLs: three mercenary fights and the
  highwaymen): "Reads are done, then, and they feel much more normal
  now, across the board! 😁" The play and the board agree on act 1; the
  play did not reach act 2, where the board moved.

Tools: `scratch/139/board.mjs` (the read, with its self-checks) and
`merge.mjs` (each tree's stages pooled for `--report`).

### 139d — the stop, signed (2026-10-29)

Put to the user: the board's read beside their play, and four calls.
"Signing all of your calls, Claude! 😁 That's really interesting and
surprising. I genuinely don't have a good guess as to why. Maybe it's
the enemy defense being halved, making the level budget difference more
pronounced?" Signed at the leans: 139b's numbers stand; the mercenary
stays at 3 + 3 (+9.5 %, its fights not harder on the board, normal in
play); the two-act crossing is tested as 139e, the old game with 137c's
vector on the box; no number moves in this phase, and if the crossing is
the game's it goes to Round 11's retune as a named rider, with the deep
boss's wall below its band. 139e's read was not declared at the stop, so
it is a stop.

- *Step zero for 139e.* The old tree's loader takes a vector only with
  every stat key (a strict schema), so 137c's vector goes in with
  precision and evasion at 0. Its `total` term still sums the two stats
  (10 to 16 of a unit's 32 to 69 at the old base), and only code at the
  old commit could drop them: the cohort separates the two weights, not
  that residue. The file reaches the box by `--carry` (139e-pre), not by
  a commit to main, where today's loader would refuse it.
- *The user's idea, estimated from config and the board's rosters (not
  measured).* Under rule C every attacker pays 0.488 of the defense it
  meets, where it used to pay its own hit rate, so the gap grows with
  defense, and defense grows with level. But it grows slowly (0.1 to 0.3
  a level on the old tree for all but the prodigy and the halberdier,
  half that now), and the player's mean level is 6.5 in act 1 and 9.2 in
  act 2 on the old game and the moves alike, with enemy levels 1.0 to
  1.34 times it: about 3 levels, so about a point of old defense or less
  between the acts. For the archer ((0.69 − 0.488) of it) that is 0.05 to
  0.2 damage a swing, 1 to 4 %. If the cohort finds the crossing is the
  game's, a swing read split by act tests the idea directly.
