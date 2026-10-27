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
