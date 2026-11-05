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
