# WORKLOG — Round 9 (The frame and the damage trial)

Per-phase narrative log (AGENTS "The planning stack"; `process/planning.md`
"The artifacts"): findings, decision rationale, rejected alternatives,
scope changes, playtest verdicts and the checks run land here under the
matching `## Phase N`; the ROADMAP stays a plan. The file holds the phase
in progress: at each phase close it moves to `archive/worklog-phase-N.md`
and a fresh one starts. Round 9's earlier phases:
[archive/worklog-phase-135.md](archive/worklog-phase-135.md) (the kickoff,
§134, with the spec's answers and the charter's premises at HEAD; and
§135, the board's instruments).

## Phase 136 — the trial's switch and arms, headless

The trial's arithmetic is `scratch/134/spread.mjs` and
`scratch/134/defense.mjs`; the calls signed for it are
[round-9-spec.md](round-9-spec.md) "The trial".

### The kickoff's audit, and the cut put to the user (2026-10-27)

Read at `404b25d9`:

- *How an arm reaches the strike.* `World.applyDamage` draws once on
  `combatRng` against `hitChanceFor` (`World.ts:803-804`); the World is
  built by `battleWorld(bus, encounter)` (`src/sim/battleSetup.ts:322`)
  from nine callers (BattleScene, the journal's replay, the trace replay,
  the fuzz harness and walker, the chaos driver, the journal drive, the
  pathing capture), each on `battle:started`, whose payload is the
  encounter and its seed (`events.ts:46`).
- *The encounter is saved:* the Run's snapshot holds `currentEncounter:
  BattleEncounter | null`, and its shape is in the save's fingerprint
  (`tests/run-snapshot-shape.txt:15`, `:55`), so an arm on the encounter
  would be a Run bump, rejecting players' saved runs at the upload. The
  run's dials are saved as URL text beside the snapshot
  (`src/store/runSlot.ts:40-45`), so a new dial is not; a dialled run's win
  is not recorded for Escalation (`runCounts`, `src/store/progress.ts:95`).
- *The bot's rollouts copy the World through its snapshot*
  (`src/bot/rollout.ts:33`, `:45`), so the arm rides the World's snapshot,
  or a rollout would play hit or miss inside a range battle. Only the Run
  has a shape fingerprint; the World's snapshot is versioned
  (`WORLD_SCHEMA_VERSION` 36, `World.ts:92`) and kept by no player.
- *The box arm path:* the fuzz CLI forwards any flag named as a URL
  parameter (§133), so a run dial is the box's arm switch too; the `--set`
  override takes numbers in four knob groups only
  (`tests/fuzz/balanceSweep.ts:67-72`).
- *Floats across engines:* the determinism contract (TESTING.md) says
  nothing about `Math.pow` across engines, and the sim already uses it
  (`src/sim/xp.ts:17`). The range's draw puts it on every strike. A save
  resumes from the Run, not a World replay, so no player meets a
  difference; a journal recorded in Firefox and replayed under Node
  would. Not measured; §138's play can measure it with the journal's
  replay (`npm run replay`), on a range arm's run.

**The cut** (no step adds an RNG stream; the predictions are each step's):

- **136a — the bar** (`stop`). After reading `process/measurement.md`:
  the play protocol and the veto lines for §138's board on the pick,
  paired same-seed against hit or miss, against §118e's level-0 rows
  (act 1 won 83 of 120; two acts 26 of 120); written into the spec
  before any arm exists. Docs only; smoke does not fire.
- **136b — the `strike` dial, the off arm byte-identical** (`none`). A run
  dial (`hit`, the default, `range-0.25`, `range-1`, `mix`), its arms'
  numbers in `config/stats.json`, carried on `battle:started` to
  `battleWorld` and onto the World's snapshot as an optional field absent
  at `hit`. Predicted: no Run bump; no World bump, since a v36 snapshot
  still reads (if the World's convention bumps on any new field, v37,
  which rejects no player's save). Exit: with no dial, the corpus and the
  fuzz diff byte-identical, with a planted arm change that they catch.
  Smoke fires.
- **136c — the range's draw** (`none`). The Kumaraswamy's inverse on the
  strike's uniform, its `a` solved per hit chance and cached; rounding by
  the signed call. Exit: through `World.applyDamage` on a seeded stream,
  each range arm's mean and spread at several hit chances and damage
  sizes within tolerance of the closed form, which the code does not
  consult, and a planted wrong `a` failing it. Smoke fires.
- **136d — the mixture** (`none`). The misses' share on the same uniform,
  the mean kept; `unit:missed`, `dealMiss` and `evade` on its misses.
  Exit: pinned the same way. Smoke fires.
- **136e — the hooks and statuses under the range** (`none`), by the
  signed call; and a strike that rolls 0. Exit: over many strikes the
  hooks' rate is the hit chance, with a planted rule that fires on every
  strike failing it. Smoke fires.
- **136f — the phase's close** (`stop`).

**The calls the build rests on, put with the cut** (the session's leans):

- *Rounding at small damage:* round to the nearest point (one draw;
  against heavy armour the mean rises, 0.75 to 0.875 at 1 damage after
  defense at `b` 1); or round up with the fraction as its chance (a second
  draw on a range strike; the mean exact at every damage, so defense
  keeps its worth). Lean: the second.
- *Bleed, blind and the three hit hooks:* ride every strike that is not a
  miss (they fire on every strike at `b` 0.25 and 1, 87.5 % under the
  mixture, against 75 % today: a buff to the cleaver, the light ray,
  Laverna, Fortuna and Venom); or ride the strongest share of strikes, the
  share today's hit chance gives, read off the same uniform (the rate
  stays today's, the big hits carry them, and on the same draw they fire
  where hit or miss would have hit). Lean: the second.
- *A strike that rolls 0:* no camp turns hostile on it, since a camp
  turns on damage (DESIGN, camps). Lean, for the user to confirm.
- *The dial's name and values:* `strike`, with `hit`, `range-0.25`,
  `range-1`, `mix`.

The stretch the cut opens: 136a, then its stop; after its read, 136b to
136e, and the stop at 136f.

### The hand-off after §136's kickoff (2026-10-27, session 428ebc70)

The session passed the hand-off trigger at the commit of the cut above.

- *Done:* Round 9's kickoff (§134) signed, with the spec, the act design
  (`plans/acts.md`) and the phases; §135 closed on the user's read and
  pushed (`404b25d9`); §136's audit and cut written here.
- *Open:* §136's cut and its four calls (rounding, the hooks, a strike
  that rolls 0, the dial's names) are unsigned. They were put to the user
  in the session's last message, and the new session puts them again,
  since it opens on its brief alone.
- *For the build:* the closed forms 136c's and 136d's pins compare
  against are `scratch/134/spread.mjs` (the Kumaraswamy's `a` per `b`, its
  spread) and `scratch/134/defense.mjs` (the rounded mean at each damage
  size, the mixture); each runs with `node` and prints its controls
  first. The hook's fuzz smoke fires on any staged path under `src/sim/`
  or `tests/fuzz/`, test files included (two of §135's predictions missed
  on it).

### The cut signed (2026-10-27)

Put again at `63b3a57a`, where nothing under `src/`, `tests/` or `config/`
differs from `404b25d9`; the audit's citations hold. The re-read found
three things the calls touch:

- A camp turns on any strike that reaches `World.dealDamage`, with no
  check on the damage (`World.ts:717`), so "no camp turns on a 0" is a new
  rule in the code.
- `applyDamage`'s return is what lets a status ride a landed hit
  (`World.ts:776`), so the hooks' call decides what it means on a range
  arm.
- The crit is drawn before the strike's uniform and scales the damage
  before defense, so a crit that rolls low lands under an ordinary hit.

The user's answers:

1. Rounding: "I'm a tad confused here, Claude 😅 Can you elaborate a bit
   more?" Explained: nearest rounding turns every roll of a half or more
   into the full point, so at `D` 1 and `b` 1 armour lets through 0.875 a
   strike against today's 0.75; by chance keeps 0.75, at the price of a
   second draw on a range strike, on `combatRng`.
2. The hooks: "I'm actually okay giving these the buff, Claude! I think
   that we want things to be reasonably comprehensible to players; the
   rule to keep the rates the same reads as too opaque to me." The
   session's lean, today's rate off the strongest share, kept the trial's
   read clean; the user's reason is about the rule a player would learn,
   which is what the trial tests.
3. A strike that rolls 0: "this makes me think that we should change the
   rounding to not allow a hit of zero; once again, that feels like it'll
   read weird to players, no?" Two ways were put: a floor of 1, which
   lets every strike through at `D` 1 (1.0 against 0.75, a quarter of
   what armour stops); or a 0 is a miss (MISS, the miss's sound, no hooks,
   no camp), the mean exact. The second, with 2, makes one rule: a strike
   that deals damage is a hit and carries its hooks, a strike that deals
   nothing is a miss. It also removes the case the two first leans made
   together: at `D` 1, `b` 1 and a hit chance of 0.75, 15.75 % of the
   strikes that carried a hook rounded to 0 (sampled 0.1575, against the
   closed form `0.25^(4/3)`, 0.1575).
4. The dial: "Those sound fine to me, Claude!"

The crit: no special case, so a crit that rolls 0 is a miss, as a miss
discards the crit today. Signed with the rest: "Signing all of those
leans and the revised cut, Claude! 😁"

Under the signed rules, by `scratch/136/zeromiss.mjs` (a sampler, a
million strikes a cell; its control, `a` 3.0000 at `b` 1 and a mean of
0.75, and its nearest-rounding rows read 0.782, 0.875 and 0.051 where
`defense.mjs` reads 0.781, 0.875 and 0.051), at a hit chance of 0.75, the share of strikes that miss, and
so the share that carries a hook:

| arm | `D` 1 | `D` 2 | `D` 3 | `D` 6 |
|---|---|---|---|---|
| `range-0.25` | 25.0 % | 11.7 % | 8.3 % | 4.9 % |
| `range-1` | 25.0 % | 3.1 % | 0.9 % | 0.1 % |
| `mix` | 25.0 % | 12.7 % | 12.6 % | 12.5 % |

Every cell's mean is the hit chance's share of `D` within 0.002, and at
`D` 1 each arm is today's hit or miss. The cut changes in two steps: 136d
counts the zeros among the mixture's misses, and 136e is "a 0 is a miss,
and the hooks ride every strike that deals damage", its controls a hook
on a 0 and a 0 that turns a camp. §137's "what a 0 shows" is answered: a
MISS.

### 136a — the bar (2026-10-27)

The bar is [round-9-spec.md](round-9-spec.md) "The bar", written after
reading `process/measurement.md`. What it rests on, read at `2ef78c35`:

- *§118e's level 0, from the raw CSVs:* `output/box-batches/20261010-*-987b0cb/summary.csv`,
  told apart by each batch's `manifest.json` argv, give act 1 28 + 55 =
  83 complete of 120, and two acts 7 + 19 = 26 complete with 28 + 55 = 83
  clearing a sector; level 2 gives 20 + 31 = 51 and 4 + 9 = 13. BALANCE's
  table says the same. Every outcome across the 24 batches is `complete`
  or `defeat`, and no `hangLayout` is set; the harness can also write
  `hang` and `aborted` (`tests/fuzz/harness.test.ts:137`).
- *The comparator is `hit` at HEAD, not §118e's rows:* `config/events.json`
  changed after `987b0cb` (`ff1d8111` and `5e4dcd5e`, the user's event
  edits), so the off arm need not reproduce 83 and 26. §118e's rows are
  reported beside it, and its level 0 to level 2 drop sets the veto's
  size.
- *The box's arm path, a correction to the audit:* the audit said the
  fuzz CLI forwards any flag named as a URL parameter. That forwarding is
  the run-config CLI's (`tools/run-config/cli.ts:31`, `:55`, §133's
  record); the fuzz CLI throws `Unknown flag` on any flag it does not name
  (`tests/fuzz/commands/args.ts:448-450`) and wires each dial by hand, as
  `--escalation` is (`tests/fuzz/commands/run.ts:224-232`). So 136b adds a
  `--strike` flag beside the URL dial. It is inside the cut's intent (every
  arm reachable by the dial, on the box too) and is flagged at 136a's stop.
- *The journals:* the game records every run's journal
  (`src/Game.ts:98`), and `npm run replay` refuses one from another commit
  or a `-dirty` build (`scripts/replay.ts`), so the play runs on a clean
  commit.

### 136b — the strike dial (2026-10-27, `8303ffc5`)

Step zero, read at `bd930ae4`, changed four things inside the cut's
intent (no Run bump, every arm reachable, the arm on every battle):

- *The run clone.* `cloneRunForRollout` loads the clone with no config
  (`src/bot/runRollout.ts:60`; `Run.fromJSON`'s doc: "a rollout's clone
  passes none"), so a dial held in RunConfig alone would let the
  arbitrated board arm score its run-level rollouts on hit or miss inside
  a range run. The audit saw this for the World's clone, not the Run's.
  The clone now takes the live run's arm, and passes no config at `hit`.
- *The World's version.* Its rule is to bump on any change to the
  snapshot's shape and never default a missing field on load
  (`World.ts:85-92`), so WorldSnapshot is v37 with `strike` required, not
  an optional field absent at `hit`. No stored v36 snapshot exists in
  `tests`, `src`, `shell`, `scripts` or `tools` (searched in both
  spellings), and no player keeps one.
- *Where the World is built.* `BattleScene`, the harness and the walker
  build from `run.currentEncounter`, not from the payload, so the Run holds
  the arm (`Run.strike`) and `battle:started` carries it for the replays.
  `battleWorld` takes it as a required argument, `StrikeArm | undefined`:
  the 8 calls in code were found by grep (the audit's "nine callers", which
  136b's commit message repeats, is eight), and the typecheck then named
  the 16 in tests.
- *The trace* records the payload's arm, absent at `hit`, so a stored trace
  replays as before.

Also: the corpus replays past the config stamp (`corpus.ts:30`), so the
new keys in `config/stats.json` do not trip it; `?strike=` boots past the
menu to character select, as `?bits=` does; `runCounts` refuses a won
run with the dial without a change.

**The proofs at `hit`:** the journal corpus, 0 of 30 differ; the fuzz
diff against `bd930ae4`, PASS on both shapes (`summary.csv`,
`decisions.csv`, `rosters.csv`). Nothing reads the arm yet (the draw is
136c), so a plant of the arm itself changes nothing a run sees. The
controls show instead that the proofs reach and look at each site the arm
passes through:

| control | where | corpus | fuzz diff |
|---|---|---|---|
| C1: the battle rules not installed | `battleWorld`, where the arm enters the World | 4 of 30 | caught (`arm`) |
| C2: a `hit` run's payload carrying `strike: 'hit'` | `Run`'s emit | 30 of 30 | not caught: play unchanged |
| C3: the run clone handed `{ drawAmountAdd: 1 }` | `cloneRunForRollout`'s config | cannot see the bot | caught (`arm`: summary, decisions, rosters) |

C1 and C2 by `npm run oracle -- plant --proofs=corpus,fuzz-diff`, each
proof clean on the unplanted worktree first; C3 by hand in a detached
worktree, `perf-oracle.sh` run inside it. C2 says the corpus reads each
payload's keys, so its 0 of 30 is the proof that a `hit` run's payloads
are byte for byte the ones before the dial.

### 136c — the range's draw (2026-10-27, `3e35aa85`)

`src/sim/strike.ts` holds the draw: the share is the Kumaraswamy's inverse
on the strike's uniform, `a` bisected on the closed-form mean (ln Γ by
Lanczos) and cached per hit chance and `b`; the share times the damage
after defense is rounded by chance on a second draw. A strike that rounds
to 0 takes the miss path already, since that is how a 0 resolves; 136e
pins what rides it. A hit chance of 1 lands the whole damage.

**The pin** (`src/sim/strike.test.ts`) drives `applyDamage` on a seeded
`combatRng`, 80,000 strikes a cell, at hit chances 0.3, 0.6 and 0.85 and
damage after defense 1, 3 and 8, and holds the landed damage's mean to
four standard errors and its spread to 4 % of what a midpoint quadrature
of the spec's inverse gives, with `a` bisected on the quadrature's own
mean. The code's solver is never called by the expectation.

- *Known answer first:* on `hit` the instrument reads p·D and D·√(p(1 − p))
  in every cell.
- *Its resolution:* at 20,000 strikes a 10 % wrong `a` at `b` 0.25 moved
  the mean 0.101 of 8 damage against four standard errors of 0.088, and
  the in-test control failed to tell it; at 80,000 the bound is 0.044, and
  the control tells it on both arms (`scratch/136/sens.mjs`, repeated in
  the test's comment).
- *The code plant:* `npm run oracle -- plant --at=src/sim/strike.ts:40
  --op=bump` (the solver's mean, `1 + 1/a` to `2 + 1/a`): the suite
  caught it, in `strike.test.ts` alone; the corpus did not, which is
  right, since a `hit` run never calls the solver.
- *The draws:* a range strike takes two from `combatRng` (the strike, its
  rounding) and `hit` one, pinned against a twin stream.
- *At 1 damage after defense* the misses are 1 − p of strikes on both arms,
  the zero-as-miss table's 25 % at p 0.75.

**At `hit`:** the journal corpus, 0 of 30 differ; the fuzz diff against
`0ed33cdc`, PASS on both shapes. `applyDamage`'s refactor (`missStrike`,
`afterDefense`) is covered by both.

### 136d — the mixture (2026-10-27, `c3295d38`)

The whole misses sit below `m = s·(1 − p)` on the strike's uniform, as
the spec reads ("Below `m` it misses"); the rest, rescaled, feeds the
share at the mean `p / (1 − m)`. A whole miss draws once.

The pin extends 136c's: `mix`'s mean, spread and share of misses (whole
misses plus rounded zeros) against the quadrature in every cell; the
spec's 12.5 % whole misses at p 0.75 and 6 damage; and two in-test
controls it must tell, a 10 % wrong `a` (by the spread and mean) and 0.4
of the misses kept for 0.5 (by the share of misses, whose four standard
errors at 80,000 strikes are 0.006 against a 0.04 difference). The code
plant, `--op=sign` on `World.ts:844` (`1 − p` to `1 + p` in the miss
share): caught by the suite, in `strike.test.ts`.

**At `hit`:** the journal corpus, 0 of 30 differ; the fuzz diff against
`6a7aad0d`, PASS on both shapes.

### 136e — what rides a range strike (2026-10-27, `c3af910f`)

No code: 136c already sends a strike that rounds to 0 down the miss path,
which is where the signed rule puts it, so a status, `dealHit` (the hook
the daemons' rules and the Venom packet register on) and a camp's turn
ride exactly the strikes that deal damage. The step is the pins, on every
range arm at 1 damage after defense, where zeros are common:

- `dealHit` fires on every strike that deals damage, with its damage, and
  on no other; `dealMiss` and `evade` on each 0 (`strike.test.ts`);
- a status op after the damage op rides exactly the damaging strikes
  (`interpreter.test.ts`, on `range-1`);
- a camp turns on a damaging strike and never on a 0, over first strikes
  on fresh worlds until five of each (`strike.test.ts`).

**The controls** (by hand in a detached worktree of `c3af910f`, the two
files run clean first, 52 passed): `damage === 0` made `damage < 0` in
`applyDamage`, so a 0 lands as a 0-damage hit. Five tests failed: the
status pin and the `dealHit` pin (a hook on a 0), the camp pin (a 0 that
turns a camp), and 136c's and 136d's miss shares.

### The phase's exit, read at `c3af910f`

- *The switch off byte-identical, with a failing control:* 136b, 136c and
  136d each held the corpus at 0 of 30 and the fuzz diff at PASS; the
  controls are in each entry.
- *Each arm's mean and spread pinned against a derivation the code does
  not consult:* 136c and 136d, with their planted controls.
- *Every arm reachable by the dial:* the fuzz command line on each arm,
  8 seeds at 4 hops, gave four different `summary.csv`s, `--strike=hit`
  gave the bytes no flag gives (`bccbcfa55405` both), and `--strike=range-2`
  was refused with the arm list; wall time 12.2 to 12.5 s an arm, one run
  each, so no cost was seen (not a benchmark). In the page, the probe
  runner (`scratch/136/strike-probe.js`, a hidden Electron window, build
  `c3af910-dirty`) drove seed 7 to its first battle and read the live
  World's arm: `range-1` and `mix` from their dials, `hit` with none.
  `BattleScene`, which no headless proof loads, is that path.

### §136's close, put to the user (2026-10-27)

**Built, each read `none`:** the dial and its path to every World (136b),
the range's draw (136c), the mixture (136d), and the pins on what rides a
strike (136e). Changes made inside the cut's intent and flagged: the run
clone takes the live arm; WorldSnapshot v37 with `strike` required; the
Run holds the arm because three builders read the Run, not the event; the
trace keeps the arm; `--strike` as its own fuzz flag (flagged at 136a);
the zero-as-miss built in 136c rather than 136e, since that is how a 0
resolves.

**Not verified:** anything on screen (§137: a range strike's number, a 0's
MISS, the readouts); the journal's replay across engines (the bar's hold,
§138); any board number on an arm (§138); the bot on a range arm (no bot
change, by the scope guard); Firefox.

**The friction read.** The phase filed two lines (136a, 136b), no
`distress`:

- *A known trap met twice:* `python` here is the Store alias, which waits,
  and a needless call to it hung the Bash tool for its full 120 s at §134
  (session 428ebc70) and again at 136b (this session), each about two
  minutes and a TaskStop. `process/shell-and-windows.md` says nothing of
  it. A candidate guard for the user: one line there, "`python` and
  `python3` on this machine are the Store's alias and wait; use `node`".
- *An audit's claim carried through a hand-off:* the fuzz CLI's forwarding
  (136a, about six calls), with "nine callers" (eight) and the run clone's
  config (136b) found the same way. Step zero caught each before a build
  rested on it, so this is the rule working; listed and left.
