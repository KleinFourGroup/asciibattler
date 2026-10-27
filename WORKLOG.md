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
