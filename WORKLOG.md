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
