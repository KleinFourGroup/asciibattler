# WORKLOG — Round 9 (The frame and the misses)

Per-phase narrative log (AGENTS "The planning stack"; `process/planning.md`
"The artifacts"): findings, decision rationale, rejected alternatives,
scope changes, playtest verdicts and the checks run land here under the
matching `## Phase N`; the ROADMAP stays a plan. The file holds the phase
in progress: at each phase close it moves to `archive/worklog-phase-N.md`
and a fresh one starts. Round 9's earlier phases:
[archive/worklog-phase-135.md](archive/worklog-phase-135.md) (the kickoff,
§134, with the spec's answers and the charter's premises at HEAD; and
§135, the board's instruments) and
[archive/worklog-phase-136.md](archive/worklog-phase-136.md) (§136, the
trial's switch and arms; at its close the trial rolled back and the round
re-cut).

## Phase 137 — every strike lands, headless

The re-cut this phase builds, with the conversion's arithmetic and what
was signed: `archive/worklog-phase-136.md`, "The trial rolled back, and
the re-cut". Each unit's hit rate in play, the conversion's input:
[BALANCE.md](BALANCE.md)'s run log, 2026-10-28, measured by
`scratch/136/hitrate.ts` (ignored; it wraps `World.applyDamage` and
`missStrike`, so it needs the roll it measures and runs only at a commit
before §137 deletes it).

### The kickoff's audit, and the cut put to the user (2026-10-28)

Read at `a260abfa`:

- *Where the roll lives.* `World.applyDamage` draws once on `combatRng`
  for each evadable strike with a living attacker (`World.ts:819-836`),
  against `hitChanceFor` (`stats.ts:88`), whose four knobs sit in
  `config/stats.json` beside §136's `strikeArms`. The terrain's modifiers
  are five entries of the tile table (`TileGrid.ts:97-105`), read only
  there. Without the draw every later `combatRng` draw in a battle moves
  (the crits'); no stream key is added or removed.
- *Level-ups draw per stat.* `simulateLevelUps` draws once a stat in
  `STAT_KEYS` order (`leveling.ts:24`), eleven a level, nine after, so
  every rolled level-up re-baselines. `scaleStats`, the enemies', draws
  nothing.
- *`accuracy` is on every damage op:* the 18 in `config/abilities.json`
  and the periodic ops of burn, bleed and poison in `config/statuses.json`.
- *Which stat feeds which strike.* Thirteen units carry one dodgeable
  weapon each and no unit carries two damage abilities. The catapult's
  ranged feeds only its unmissable shot, and the ice mage's ranged feeds
  nothing (its storm scales on `none`), so the charter's decision point, a
  stat feeding both kinds, has no case. The sword is the mercenary's and
  the prodigy's (51.9 % and 53.6 %), so one might has two rates behind it.
- *Flat adds land on any unit.* Hype, Overclock and Mars give +8 strength,
  ranged and magic; Shield and Minerva +4 defense; Fortuna's `emboldened`
  +1 strength, ranged and magic (`config/packets.json`,
  `config/daemons.json`, `config/statuses.json:114`). With every strike
  landing, a strength point is worth a full point a swing instead of
  about half, so these double against the converted bases if left.
- *Riders on a landed hit fire on every strike:* the cleaver's bleed
  (56.6 % of its strikes today), the light ray's blind (71.1 %), Venom's
  poison, Laverna's bit for a rogue's blow (77.4 %), and Fortuna's
  emboldening on a crit, since a crit on a miss is discarded today. Each
  fires about 1/h as often. A crit's damage keeps its share, since it
  doubles the converted damage.
- *The bot reads the stats.* The scored weights are a `z.strictObject`
  keyed by `STAT_KEYS` (`tests/fuzz/strategies/scoredWeights.ts:118-124`),
  and five fixtures weigh precision and evasion, among them the board's
  deploy vector, `92c2-winner.json` (−0.65 and −0.27,
  `tests/fuzz/board/board.ts:179`), and its regen vector. Their `total`
  feature sums the stats the conversion shrinks. The two keys have to go,
  so the board's bot recruits differently with no code change.
- *What §136 left:* the `strike` dial through `RunConfig`, the Run,
  `battleSetup`, the World and its snapshot (v37), the trace and the fuzz
  CLI's `--strike`; `src/sim/strike.ts`; `strikeArms`. Four commits,
  `8303ffc5` to `c3af910f`, and only docs after them. The Run does not
  save the arm (no `strike` in `tests/run-snapshot-shape.txt`), so the
  revert bumps the World only.
- *The idle miss path:* `unit:missed` has two listeners, the MISS splat
  (`BattleRenderer.ts:1136`) and its sound (`eventSounds.ts:120`); no
  config rule hooks `evade` or `dealMiss`.
- *The screen's references:* `statLabels.ts`, the ability detail's hit
  (`abilityDetail.ts:108`), the promotion's Dodge (`promotionDelta.ts:74`),
  the locale's `stat.precision`, `stat.evasion` and
  `promotion.delta.dodge`, the archetype editor's two reference dials,
  the attack editor, and the layout editor's terrain hints.
- *The probe's cost:* `scratch/136/hitrate.ts` ran 8 greedy seeds in
  14 s with tsx's start, about 1.4 s a seed.

**The conversion on the 2026-10-28 rates, two rounding rules** (a preview;
137a's rates replace it). Rule A rounds the might and the stat each; rule
C rounds the weapon's might by its wielders' pooled rate and gives the
unit's stat the rest of its rounded strike, `round((might + stat) × h) −
might'`. They differ on three units, against today's mean a swing:
the bandit 2.31 (A 1 + 2, +30 %; C 1 + 1, −13 %), the gunslinger 2.38
(A +26 %; C −16 %), the prodigy 5.36 (A 3 + 3, +12 %; C 3 + 2, −7 %). The
other ten agree, within −7 % to +8 %. Defense times the pooled rate
(0.477) halves the even bases and rounds the eight odd ones down (3 to 1,
5 to 2, 1 to 0). The buffs at the pooled rate: +8 to +4, +4 to +2, +1 to
0. The scripts: the session's scratchpad, not kept; 137c's pin re-derives
it.

**The cut** (no step adds an RNG stream):

- **137a — the rates re-measured** (`none`). `scratch/136/hitrate.ts` at
  HEAD, 400 seeds a bot (1000–1399, greedy and pure-random), local, one
  bot at a time, about 10 min each, with its bus check and its 0.5
  control; the table and the pooled rate into BALANCE.md's run log. Docs
  only; the smoke does not fire.
- **137b — §136 reverted** (`none`). The dial, the arms, `strike.ts` and
  `--strike` out; World v38 without `strike`, no Run bump. Exit: corpus 0
  of 30 and the fuzz diff PASS against HEAD before, each with a planted
  change it catches. The smoke fires.
- **137c — every strike lands, at the converted numbers** (`none`). The
  roll, precision, evasion, `accuracy`, the terrain's modifiers and the
  four hit knobs deleted; the converted numbers in config by the signed
  rules; the miss path kept idle with a landing note on each piece; the
  screen's references out as plain removals, checked in the pane for an
  empty row, a NaN or a console error. Run v50, World v39; every battle
  and level-up re-baselines once, in this commit: the pins, the fuzz
  smoke's, the corpus by `--record`. Exit: the grep over src, config,
  locales, tools and tests finds no precision, evasion, accuracy or tile
  modifier (GLSL's `precision` qualifier and the archived outputs under
  `tests/fuzz/output/` named and left), with a planted line it reports;
  the config pinned against a derivation in the test from a frozen copy
  of today's numbers and 137a's rates, with a planted off-by-one it
  fails. DESIGN's and ARCHITECTURE's sentences the change makes false
  fixed in the commit; DESIGN's Combat paragraph and stat list are
  §138's. The smoke fires.
- **137d — the phase's close** (`stop`).

**The calls, with the session's leans:** the rounding rule (C); defense
by the pooled rate (rather than halved with a half rounding up); the
buffs converted at the pooled rate, `emboldened`'s +1 left; the riders
left for §139's board, with no chance added, since a chance is a roll;
the bot's two keys dropped with nothing else changed, §139's kickoff to
decide whether its board separates the bot's share.

### The cut signed (2026-10-28)

"Fully signing all of your leans, Claude! 😁" The cut as written, with
the five calls at the leans: rule C; defense times the pooled rate,
rounded; the buffs converted at the pooled rate (+8 strength and ranged
to +4, magic left at +8, +4 defense to +2, `emboldened`'s +1 left); the
riders left for §139 with no chance added; the bot's two keys dropped and
nothing else. And the scope lean: 137c fixes the sentences the change
makes false, and DESIGN's Combat paragraph and stat list stay §138's.
The stretch: 137a to 137c, then the stop at 137d.

### 137a — the hit rates re-measured (2026-10-28)

The table is BALANCE.md's run log, 2026-10-28, the second entry: 400
seeds a bot, 810,799 strikes, every strike 48.82 %. The runs took 347 s
and 505 s against the cut's ten minutes a bot. The checks, the bus count
and the 0.5 control, read as at §136.

- *Three rows moved outside the first measurement's intervals:* the
  officer, 40.2 % to 24.0 % (the first had 219 strikes); the halberdier,
  41.7 % to 50.0 %; the rogue, 77.4 % to 81.1 %. The first 40 seeds are
  inside these 400, so the first table was a small sample of this one.
- *The prodigy stays thin,* 190 strikes at 53.7 % ± 7.2: a legendary,
  rare in a run. Its converted strength is 2 at the point estimate and 3
  above about 55 %, so it sits on a rounding boundary; by the cut it is
  not measured further.
- *What moved from the kickoff's preview* under rule C: the halberd's
  might 3 to 4 (its strike 7, today's mean 7.00), the cane's 1 to 0 (the
  officer's strike 1, today's 1.20), and growths by 0.01 to 0.04. Defense
  times 0.4882 gives the same bases (the odd ones still round down) and
  growths up by 0.01 on six units; the buffs are the same (+4, +2, +1
  left). Each base strike lands within −17 % to +4 % of today's mean a
  swing; the four under −9 % are the small strikes (the ghoul, the
  bandit, the gunslinger, the officer at 1 to 2 points), where half a
  point is the step.

### 137b — §136 reverted (2026-10-28, `0ea2d292`)

Step zero: the code of §136's four commits, `git diff c3af910f
8303ffc5~1` without HANDOFF, ROADMAP and WORKLOG, applies to `cec3ae99`
cleanly (`git apply --check`); the docs after it are history and stay.
ARCHITECTURE's hunks came back with the code. The World's version moved
forward to 38, not back to 36, and two tests pin it
(`snapshot-roundtrip.test.ts` and `spawn-overflow.test.ts`; the first
commit attempt failed the hook on the second, which my search had
missed). The search for the dial's names (`StrikeArm`, `setStrike`,
`strikeShare`, `--strike` and the arm values) over the tree outside the
records finds none, and at `cec3ae99` it finds them in five files. The
counts fell by the deleted tests: 3757 main in 260 files, 553 smoke in 58.

**The proofs:** the journal corpus, 0 of 30 differ; the fuzz diff
(`perf-oracle.sh` against `cec3ae99`), PASS on both shapes. The controls,
each proof clean on the unplanted tree first:

| control | where | corpus | fuzz diff |
|---|---|---|---|
| C1: the hit roll negated | `World.ts:804`, the restored roll | 30 of 30 | caught, both shapes |
| C2: defense added, not subtracted | `World.ts:710`, the restored mitigation | 30 of 30 | caught, both shapes |
| C3: the rollout clone handed `{ drawAmountAdd: 1 }` | `runRollout.ts:60`, where 136b passed the arm | cannot see the bot | caught (`arm`: summary, decisions, rosters) |

C1 and C2 by `npm run oracle -- plant --proofs=corpus,fuzz-diff`; C3 by
hand in a detached worktree (`scratch/137b-c3.sh`), as at 136b.

### 137c — every strike lands, at the converted numbers (2026-10-28)

**The numbers**, written by `scratch/137c/convert.mjs` from 137a's rates
(rule C; a weapon's might, its unit's stat, today's mean a swing):
the rogue 1 + 4 (4.87), the luminant 2 + 4 (6.26), the archer 3 + 4
(6.84), the adventurer 2 + 4 (5.82), the reaver 2 + 5 (7.16), the ronin
2 + 4 (6.02), the prodigy 3 + 2 (5.37), the mercenary 3 + 3 (5.76), the
halberdier 4 + 3 (7.00), the ghoul 1 + 1 (2.20), the bandit 1 + 1 (2.34),
the gunslinger 1 + 1 (2.34), the officer 0 + 1 (1.20). Defense times
0.4882; the buffs +4 strength and ranged with magic at +8, +2 defense,
`emboldened`'s +1 left. Three values sit within 0.02 of a rounding tie:
the cane's might (0.481, so 0) and the healer's and rioter's defense
(0.488, so 0).

**Step zero, inside the cut's intent and flagged:**

- *The miss path.* The revert left the miss inline in `applyDamage`, so
  there is no `missStrike` to keep (an unused private method fails
  `noUnusedLocals`). The landing note sits at the seam; `applyDamage`
  still returns a boolean, always true, so the idle `applyStatus` gate
  keeps its contract, and a test pins the gate by recording a miss on the
  scratch directly.
- *Three UI strings out:* `stat.precision`, `stat.evasion` and
  `promotion.delta.dodge`, since the key-scan pin fails an orphan. The
  buff descriptions follow their numbers ("+4 STR / RNG, +8 MAG", "+2
  DEF"), re-extracted to `locales/en`.
- *Two identity pins the conversion breaks by design:* the cane was the
  pistol's might twin (now 0 against 1, each scaled by its wielder's
  rate), and the pistol's "wilder than the bow" was its accuracy. Both
  tests now pin what is left (cadence, reach, might below the bow's).
- *The bot's vectors:* the two keys out of seven files (two configs, five
  fixtures), as signed.
- *The roll's own tests* became tests that every strike lands: no draw,
  the full damage and the ledger, the same on every pair of passable
  tiles, and a strike op drawing only its crit. The `hitChanceFor` and
  terrain-mod tests and the precision/evasion leveling block are gone.
- *Seeded drives that moved* were re-picked to reach what they pinned:
  the chaos driver's procedural slot 3 → 5 (it stopped declining a reward
  and empowering a unit; 5 is the shortest of 40 that does both); the
  `sectorHops=2` soldier runs of the continuation, resume and
  journal-across-loads tests 2 → 9 (seed 2 no longer clears a sector; 9
  completes, the quickest of five that do); the journal tool's seed 7 → 5
  (7 now loses; the line pins "victory"). The corpus census gains
  `buyPortUnit` (18 of 21 kinds).

**The proofs:**

- Typecheck clean; `npm test` 3736 in 261 files; the smoke 553 in 58; the
  corpus re-recorded by `--record` (all 30 journals and the baseline
  changed), its 34 tests green and 0 of 30 after.
- *The conversion pin,* `tests/strike-conversion.test.ts`, derives every
  converted number, and holds every other strength, ranged, defense and
  buff value to its frozen one, from `strike-conversion.before.json`
  (today's numbers at `a042bf2c` and 137a's rates), which nothing in `src`
  reads. Control: the halberd's might planted at 5 failed it, naming the
  key; restored from my copy.
- *The absence search* (`precision`, `evasion`, `accuracy`, the tile mods,
  `hitChance`, `dodgeChance` over src, config, locales, tools, tests,
  scripts and shell, without GLSL, the archived outputs under
  `tests/fuzz/output/`, the era-bound gauntlet fixture and the journals):
  493 hits at `14fb7e0a`; now only the absence assertions, the version
  comments and two other senses of "precision" (a shader comment, a CSV's
  decimals). The re-recorded journals carry none.
- *The pane* (`dev-preview`, seed 9, soldier, driven by `__probe.drive`):
  the promotion and recruit screens show eight stats with POW above, no
  PRC or EVA, no NaN or "undefined"; the cards' ability rows read "8 dmg ·
  reach 1 · 27% crit", with no hit chance (the same read finds the crit
  parts). Console errors: only the pane's resource-cache failures.

**A first look at the balance (not the board, which is §139's):** the
corpus's 30 runs now end 3 victories to 27 defeats, against 10 to 20.
The fuzz harness on seeds 1000–1099, at `0ea2d292` and on this tree:
`greedy` never completes on either (act 2 on 3 and 5 seeds, 1,479 and
1,581 battles); the deploy vector `92c2-winner` completes 3 and 5, act 2
on 18 and 18, 1,902 and 1,959 battles. The seeded drive with
`sectorHops=2`, seeds 1–20: 5 completions on both trees, sector clears 16
and 14. So the corpus's drop is its seeds', not a broad one, on what was
measured; §139's board is the read.

**The RNG:** no stream added. `combatRng` lost the hit draw and each
rolled level-up two draws, so every battle and level-up moved, as the cut
predicted. Tools: `scratch/137c/` (convert, sweep, drivesweep,
chaossweep, winrate); the comparison worktree of `0ea2d292` was removed.

### The hand-off after 137c (2026-10-28, session 9ad4b394)

Handed off at the trigger, after `d50e23f1`. **Done:** the kickoff, its
cut signed with the five calls, and 137a to 137c, each read `none`.
**Open:** 137d, §137's close, a stop not yet started: `process/planning.md`
"Phase close", then the close put to the user. What it has to report,
gathered here so the next session need not re-derive it:

- *Not verified:* anything a player would judge by eye or feel (the
  screen after the plain removals is §138's read; the pane only showed
  nothing broken); the balance beyond the first look in 137c (§139's
  board); Firefox; a journal recorded in the page replayed under Node on
  the new rule.
- *Changes inside the cut's intent, flagged in 137c's entry:* the three
  UI strings, the two identity pins, the miss path's shape, and the seeds
  re-picked.
- *The rows on a rounding boundary:* the prodigy's strength (190 strikes)
  and the cane's might (0.481); the healer's and rioter's defense at 0.488.
- *For §139's kickoff:* the bot vectors lost two terms (signed); the
  riders fire on every strike (signed, left); the corpus's victories fell
  10 to 3 of 30 while two bots over 100 seeds did not drop (137c).
- *The friction:* three lines filed this session (two papercuts, one
  `distress`), and this session's report in `retro/sessions.md`.

Tools no doc names: `scratch/137c/` (`convert.mjs` wrote the config;
`sweep.ts`, `drivesweep.ts` and `chaossweep.ts` re-pick a seeded test's
seed; `winrate.ts` counts a bot's wins), `scratch/137a/pool.mjs`.

### §137's close, put to the user (2026-10-28, session fc66283a)

**Built, each read `none`:** the rates re-measured (137a, BALANCE.md's
run log, 2026-10-28, the second entry), §136 reverted byte-identically
(137b, `0ea2d292`), and every strike landing at the converted numbers
(137c, `d50e23f1`), with 137c-post from this close's exit read (below).
Changes inside the cut's intent, flagged in 137c's entry: three UI
strings out, two identity pins rewritten to pin what is left, the miss
path's shape (no `missStrike`; `applyDamage` always returns true), and
five seeded drives re-picked.

**The phase's exit, read at `66d744a9`:**

- *The two stats, `accuracy` and the tile mods gone from code and
  config.* `git grep -i` for `precision`, `evasion`, `accuracy`,
  `hitChance` and `dodgeChance` over src, config, locales, tools, tests,
  scripts and the shell scripts, without `tests/fuzz/output/` and GLSL,
  finds 21 lines in seven files: the absence assertions, the
  schema-version comments, the era-bound gauntlet fixture, and two other senses of "precision" (a
  shader comment, a CSV's decimals). Control: a planted `// evasion` in
  `environment.ts` was reported; restored.
- *Sentences the change made false that 137c's terms missed.* A wider
  search, for "to-hit", "dodge" and "miss", found seven: `World.ts`'s
  to-hit roll beside the HP path, `environment.ts`'s and `movement.ts`'s
  tile to-hit modifiers, the tools index's to-hit preview, `ui.css`'s
  promotion dodge row, `rngStreams.ts`'s combat stream "(crits and
  misses)", and the hitsplat guide's "misses are the most frequent".
  Fixed as 137c-post (`66d744a9`), comments and the guide only. The
  sentences left are conditional ("a miss plays it too") or the idle
  path's own.
- *The idle miss path, a landing note on each piece:* `evadable`
  (`schema.ts:98`), `unit:missed` (`events.ts:242`), the MISS splat
  (`BattleRenderer.ts:1131`) and its sound (`eventSounds.ts:120`),
  `dealMiss` and `evade` (`triggers.ts:20`), with the seam in
  `applyDamage` (`World.ts:780`) and the gate's scratch
  (`interpreter.ts:33`).
- *The converted numbers pinned against a derivation the code does not
  consult:* `tests/strike-conversion.test.ts` passes, 4 tests.
  Control: the halberd's might planted at 5 failed it, naming
  `abilities:halberd.might`; restored by `git checkout`.

**Not verified:** anything a player would judge by eye or feel (the
screen after the plain removals is §138's read; the pane showed only
that nothing broke); the balance beyond 137c's first look (§139's board);
Firefox; a journal recorded in the page replayed under Node on the new
rule.

**Rows on a rounding boundary, for §139:** the prodigy's strength (its
rate 53.7 % ± 7.2 on 190 strikes; 2 at the point estimate, 3 above about
55 %), the cane's might (2 × 0.2405 = 0.481, so 0), and the healer's and
rioter's defense (1 × 0.4882 = 0.488, so 0).

**For §139's kickoff:** the bot's vectors lost two terms (signed); the
riders fire on every strike (signed, left); the corpus's victories fell
from 10 to 3 of 30 while two bots over 100 seeds and the seeded drive did
not drop (137c).

**The friction read.** The phase filed four lines: three of session
9ad4b394's (137b, 137b/c, and a `distress` line at 137c) and one of
this session's (137d). One more,
37c3d345's at 136f (a piped commit), was filed after §136's summary and
no close has read it. The reports read: 9ad4b394's.

- *The hook tests the working tree, not the commit* (recurred, with a
  cost; a candidate guard): 137b/c (9ad4b394: a finished step's record
  waited for the next step's code, so the history shows it out of order;
  no time lost), 121b (f8bbd64e: a staged deletion went into a commit
  the hook passed on the working tree, an unbuildable commit, redone
  with a soft reset), and 118a (14b2f59d: an unstaged BALANCE paragraph
  failed a tests-only commit, one hook run). 9ad4b394's report says
  nothing writes it down; a search of AGENTS, CLAUDE, TESTING,
  `process/` and the hook for "working tree", "staged" and "unstaged"
  finds no line that says so. **The candidate:** the hook prints the
  tracked files whose working copy differs from the index before it
  runs ("the run tests these; the commit does not hold them"). It stops
  nothing. It would have shown 121b's and 118a's files; 137b/c's
  session knew and paid in ordering.
- *An absence claimed from a search narrower than the claim* (recurred;
  caught each time by a guard already on the path): 137b (a version pin
  searched for in two named files; the hook found a third, one hook
  run) and 137c (the absence search's terms; this close found the seven
  sentences). Before them, 124j and 125k. AGENTS "Evidence" names the
  rule, and the hook and the close's exit read caught both. Listed and
  left.
- *A stray first line that reads stdin* (recurred, with a cost that
  grew; the candidate guard put again): 137d (this session: a background
  commit opened with a stray `cat >` line and waited; a Monitor on its
  exit line expired after 15 minutes, a TaskStop ended it), 136b
  (37c3d345) and 134 (428ebc70), each a `python3 -` with no script, about
  two minutes each, and 124.5h (d8214ecc, an empty `python3` heredoc).
  `process/shell-and-windows.md` "Bash calls" names it, and the last three
  slips came after that line. At §136's close a hook that refuses such a call before
  it runs was offered and not taken up at two minutes a slip. **The new
  fact:** in the background the tool's 2-minute timeout does not apply, so
  the wait ends only when something checks. **The candidate:** a Claude
  Code `PreToolUse` hook on Bash that refuses a command whose first line
  is a bare `cat >`, a `python3 -`/`py -`/`node -` with no heredoc on it,
  or an empty heredoc, and says why.
- *A pipeline's exit code hid a failure* (136f, 37c3d345: a commit
  piped to `tail` and chained to a push; the hook's failure let the push
  run; one retry, harmless). `process/shell-and-windows.md` names it
  ("a pipeline reports the exit code of its last command"). A known
  trap, met once in this window; listed and left.
- The `distress` line (137c) is quoted to the user in full at this stop.
  The reader's interpretation, labelled as such: question 3 of the last
  three session reports (428ebc70, 37c3d345, 9ad4b394) each names a pull
  to claim before checking; two were checked before a claim, and one
  (an inherited diagnosis) got through and was corrected at 136f.
