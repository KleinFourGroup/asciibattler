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
