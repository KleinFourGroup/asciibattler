# ROADMAP — Round 11 (The roster), post-§147

The active PLAN (it stays a plan for its whole life). The macro order is
[META-ROADMAP.md](META-ROADMAP.md) (Round 10 Act 1, the wilds ✅ CLOSED
2026-11-04); findings + rationale land in [WORKLOG.md](WORKLOG.md); live
status is HANDOFF's 🧭 Cursor. Sub-steps are cut at each phase kickoff
(AGENTS "The planning stack"), never here, and each cut step declares
its read (`none` · `batch` · `stop`; AGENTS "Reads are cut, not
improvised"). Prior round's plan:
[archive/post-140-roadmap.md](archive/post-140-roadmap.md) (Round 10)
with its spec, its per-phase worklogs (`archive/worklog-phase-142.md` to
`-147.md`) and its session reports beside it; before it
[archive/post-133-roadmap.md](archive/post-133-roadmap.md) (Round 9).

**Status: Round 11 under way; §153, power by rarity, its growth key, and the pools, is next.** The spec
is [round-11-spec.md](round-11-spec.md), signed 2026-11-05. The charter,
the decision points, the exit and the scope guards are in META-ROADMAP
§"Round 11 — The roster"; its riders are TODO's "Round 11".

## Phase 148 — the kickoff ✅ (closed 2026-11-05)

The spec, the phases and act 1's cost target, each signed by the user
(WORKLOG §148, in `archive/worklog-phase-149.md`).

- ☑ **The spec and the phases** — signed 2026-11-05: the spec
  ([round-11-spec.md](round-11-spec.md)) and §149 to §156 below, with
  the stat sheet added as §149 (WORKLOG §148).
- ☑ **Act 1's cost target per kind** — signed 2026-11-05: normal 10 %,
  elite 30 %, boss 50 % of the pool, each fight within ½× to 1½×
  (BALANCE "Per-kind target bands").

## Phase 149 — the stat sheet ✅ (closed 2026-11-05)

A read-only page at `/tools/stat-sheet/`: a unit's duel at a level with a
sector's fielded enemies through the game's own wave and strike code, its
stats, growths and weapon ranked and coloured; the strike model within
three standard errors of play on 24 of 24 rows, play striking at 0.15 to
0.36 of the standing rate (WORKLOG §149, in `archive/worklog-phase-149.md`;
BALANCE 2026-11-05).

- ☑ **149a — the strike model** (`none`): pinned on the raw config, three planted mistakes caught.
- ☑ **149b — the editor's cadence** (`none`): through `resolveCadenceTicks`; latent, no shipped preview moves.
- ☑ **149c — the check against play** (`none`): 24 of 24 rows within
  three standard errors; play strikes at 0.15 to 0.36 of the standing rate.
- ☑ **149d — the enemies** (`none`): through `waveForTurn` and `resolveWave`; two planted mistakes caught.
- ☑ **149e — the duel, the ranks and the weapons** (`none`): the status ticks pinned against the sim (a 4 s burn ticks 3 times).
- ☑ **149f — the page** (`stop`): signed 2026-11-05, with its colours.

## Phase 150 — the board's instruments ✅ (closed 2026-11-06)

BALANCE's header under its cap with room; the ceiling deltas and the
skill gradient's leg read on the shared seeds; the arbitration's walk
loss located at the null arm and fixed with doctrine's pick, the ARM
now at or above doctrine's level on every ceiling shape; the prior table, the
roster table and the sheet's ARM refs re-derived under it (WORKLOG
§150, in `archive/worklog-phase-150.md`; BALANCE 2026-11-05 and
2026-11-06).

- ☑ **150a — BALANCE's header** (`none`): three Phase X sections to `archive/balance-header.md`, 700 lines to 642.
- ☑ **150b — the ceiling deltas** (`none`): on the shared seeds, pinned where the sign flips; 146f −0.200, −0.150, −0.075, −0.350.
- ☑ **150c — the skill gradient's leg** (`none`): an exact sign test on the shared seeds, a tie fine; four recorded boards read ok.
- ☑ **150d — the arbitration's walk loss** (`stop`): located at the four sites whose null arm is "pass", against rollouts that assume doctrine's play; signed 2026-11-05, the lean: a flag, then a box cohort, the port site out.
- ☑ **150e — the nominee null behind a flag** (`none`), inserted at 150d's sign: `--arb-null=nominee`; the dial off, the ARM byte-identical on 10 of 10 artifacts.
- ☑ **150f — the cohort** (`stop`), inserted at 150d's sign: the ceiling deltas 0.000, +0.025, +0.225, −0.025 (146f −0.200, −0.150, −0.075, −0.350); signed 2026-11-05, the nominee to be the default.
- ☑ **150g — the nominee the default** (`none`), inserted at 150f's sign: the default byte-identical to the nominee capture and `--arb-null=pass` to the old ARM, 10 of 10 each.
- ☑ **150h — the ARM's board** (`stop`), inserted at 150f's sign: the prior table re-derived under the new ARM and committed, then the full board under it, the roster table from its ARM rows; the sheet's ARM refs re-pinned for the user's signature, no band moved. Built: v6 and the roster table v6, the board at `8a63a20e` 0 FAIL, 16 WARN, the ceilings +0.025, +0.025, +0.125, −0.025; the re-pin signed 2026-11-06 with both leans: the deploy row's fires re-pinned, the gambler added to §154's parity item (WORKLOG 150h).

## Phase 151 — the content ✅ (closed 2026-11-06)

Bandits out of the draft and the ports, with the roster guard on what a
player can hold; Mars narrowed to strength, Diana and Hecate beside him,
every daemon renamed off "Idol" (Run v51); the ability's optional
`description`, its 29 lines as the name's tooltip on the card, the
reach's floor in the numbers (WORKLOG §151, in
`archive/worklog-phase-151.md`).

- ☑ **151a — the empower, by stat** (`none`, a pre-registered stop): under Mars a corrupter's or rioter's pick moves, 1 of 30 act-1 seeds and 4 of 30 walk seeds; signed 2026-11-06 (WORKLOG 151a).
- ☑ **151b — bandits out of the draft** (`none`): the roster guard on an archetype no player can hold; both tables v7, v6 less the bandit; a scripted port stocks only draftable units.
- ☑ **151c — Mars narrowed, Diana and Hecate, the renames** (`batch`): Run v50 to v51, a v50 save rejected with its message; read at 151e's stop and signed 2026-11-06 (WORKLOG 151e-post).
- ☑ **151d — the ability's `description`** (`none`): the schema's optional field and the attack editor's; the corpus 0 of 33 differ.
- ☑ **151e — the abilities' lines and the card's line** (`stop`): 29 terse lines, a test that each ships one; arm B signed 2026-11-06, the line as the name's tooltip with the reach's floor in the numbers, built as 151e-post (WORKLOG 151e-post).
- ☐ **151f — the units' lines** (`none`): the user's 23, with a test that every combatant has one; carried past the close as signed at the cut, it lands when the user writes them.

## Phase 152 — the weapons and defense, by taste ✅ (closed 2026-11-06)

The bow slowed and heavier, 2.5 s at might 4, and the rioter a point of
defense, each signed in the user's play; every other number held; the
strike-conversion test retired; the stat sheet's ranks recorded before
and after (WORKLOG §152, in `archive/worklog-phase-152.md`; BALANCE
2026-11-06).

- ☑ **152a — the before record** (`none`): the sheet's tables and both groups' ranks at five points, by `scratch/152/sheet.ts`, in BALANCE 2026-11-06; two rows matched against the page (WORKLOG 152a).
- ☑ **152b — the draft** (`stop`): the bow 2.0 → 2.5 s, its might holding its damage a second; the rioter's modest buff; the rest held; the strike-conversion test retired. The bow's might 4 and the rioter's base defense 1, signed in play 2026-11-06 (WORKLOG 152b).
- ☑ **152c — the after record** (`none`): 152a's tables on the signed numbers, each moved cell before → after, in BALANCE 2026-11-06 (WORKLOG 152c).

## Phase 153 — power by rarity, its growth key, and the pools (signed 2026-11-05)

Charter: power by rarity from 1/1/1/2 to the scale signed at its kickoff
(C18); power's level-up draw and its growth key out in the same
re-baseline (R19; five run streams move); the enemy pools re-anchored
behind it; act 1's encounters read against the per-kind cost target, the
rats' nest and the Vermin Lords first. **Why here:** after the weapons,
since the pools re-anchor on how fights end, and before the kits, whose
watches read a unit's worth. **Risk:** medium: a re-baseline and a box
read. **Decision points:** power's scale (✅ DECIDED 2026-11-07: 1/1/2/3,
WORKLOG §153); the pools' moves. **Exit:** act
1's turn targets held on a box read and its cost per kind read against
the target. **Scope guards:** acts 2 and 3 recorded, not retuned.

The cut, signed 2026-11-07 (WORKLOG §153):

- ☑ **153a — power's growth key out** (`none`): out of the schema, the 29 combatants and `STAT_KEYS` (eight draws a level-up), equal to the old roll with power's draw spliced back; four seeded drives and three corpus rows re-picked (WORKLOG 153a).
- ☑ **153b — power by rarity at 1/1/2/3** (`batch`, read at 153e's stop, signed 2026-11-08): the rare tier 1 → 2, the legendaries 2 → 3, eight archetypes; in act 1 the King alone moves (WORKLOG 153b).
- ☑ **153c — act 1 on the box** (`none`): the two Soldier ARM rows at n = 120; five fights outside a target, the King and the bear in both (BALANCE 2026-11-07; WORKLOG 153c).
- ☑ **153d — the moves put** (`stop`, the decision point): signed 2026-11-07, five fights moved by their levers to aims that hold act 1's total, the rats' nest tuned to its band's low edge (WORKLOG 153d).
- ☑ **153e — the tune** (`stop`, signed 2026-11-08): the signed moves baked; held out, four fights in their turn targets and the Vermin Lords over theirs, their pool 86 → 80 (`1cedbd9d`); the user plays act 1 (WORKLOG 153e).
- ☑ **153f — the verify read** (`none`, a pre-registered stop on a miss; both misses kept 2026-11-08): 153c's rows at 153e's HEAD; every turn target held, two costs under their bands on deploy (the Vermin Lords, the rats' nest) (BALANCE 2026-11-08; WORKLOG 153f).
- ☐ **153g — the prior table rebuilt** (`none`): v8 at 153f's HEAD, the units' worth re-read for §154's kickoff.

## Phase 154 — the kits (signed 2026-11-05)

Charter: the officer, the mercenary, the halberdier and the stormcaller
(C20); the priest's and the gambler's parity against the soldier (C16,
the gambler added at 150h's sign); the area-status enemies' retune
(C19); the blind fix (C12), the kiter's case a stop; the idols' sizes (N24); the
wolf's retreat, if it plays as a plain biter. **Why here:** after power,
which moves the worth the kit watches read; before the closing board.
**Risk:** medium: a call per kit. **Decision points:** each kit change;
the kiter under blind; the idols' sizes; the wolf. **Exit:** each watch
read and decided; blind pinned (a blinded archer holds fire at 3 cells
and fires at 1; the kiter's case as decided). **Scope guards:** no new
mechanism but blind's rule.

## Phase 155 — the closing board (signed 2026-11-05)

Charter: the board read as paired same-seed deltas against 146f's; act
1's bands re-pinned and signed; act 1's cost against its target; acts 2
and 3 recorded for Rounds 21 and 22; the wall watch (C17); Dis Pater's
`--grant` read at n=80 on the tithe as built, and his sentence rewritten
to it (A31, A28); the prior table and the roster table rebuilt. **Why
here:** after every number the round moves. **Risk:** medium: box time.
**Decision points:** the box's size and cost; act 1's bands. **Exit:**
the round's (META-ROADMAP §"Round 11"). **Scope guards:** act 3's
terminal band's re-set is Round 22's.

## Phase 156 — the close (signed 2026-11-05)

Charter: `0.4.0`, tagged and zipped, uploaded by the user, its smoke the
round's playtest; the round's exit by clause; Round 12's charter against
the code; the process read, with the Cursor pass's trial and the
reminder read (TODO, Round 11, "At the round's close"); the archive.
**Risk:** low. **Decision points:** the release; the process read's
lists. **Exit:** Round 11 closed.
