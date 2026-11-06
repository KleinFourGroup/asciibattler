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

**Status: Round 11 under way; §150, the board's instruments, is next.** The spec
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

## Phase 150 — the board's instruments (signed 2026-11-05)

Charter: BALANCE's header read for protocol text to demote to an
archive, its 700-line cap kept; the ceiling deltas computed on the
shared seeds or named pooled; the skill gradient's random < greedy leg
read against its noise or run at more seeds, its comment and WARN
brought to BALANCE's wording; the arbitration's walk loss traced to
where the arbitrated decisions go wrong on a long walk (TODO, Round 11,
"Before the closing board"). **Why here:** the header before the retune
writes BALANCE most; the other three before any box read the retune
takes and before the closing board. **Risk:** medium: the arbitration's
loss is an open investigation, and a fix to the ARM moves every ARM row.
**Decision points:** how far to chase the arbitration, and a fix's
scope; the box's size if a run is needed. **Exit:** the header under its
cap with room; the ceiling label true to its arithmetic, with a planted
failure; the gradient's leg read against its noise; the arbitration's
loss located, and fixed or recorded with its cause. **Scope guards:** no
config number and no band moved.

The cut, signed 2026-11-05 with its four calls (WORKLOG §150): no
snapshot bump, no RNG stream, no config change, no box unless 150d's stop
sizes one.

- ☑ **150a — BALANCE's header** (`none`): three Phase X sections to `archive/balance-header.md`, 700 lines to 642.
- ☑ **150b — the ceiling deltas** (`none`): on the shared seeds, pinned where the sign flips; 146f −0.200, −0.150, −0.075, −0.350.
- ☑ **150c — the skill gradient's leg** (`none`): an exact sign test on the shared seeds, a tie fine; four recorded boards read ok.
- ☑ **150d — the arbitration's walk loss** (`stop`): located at the four sites whose null arm is "pass", against rollouts that assume doctrine's play; signed 2026-11-05, the lean: a flag, then a box cohort, the port site out.
- ☑ **150e — the nominee null behind a flag** (`none`), inserted at 150d's sign: `--arb-null=nominee`; the dial off, the ARM byte-identical on 10 of 10 artifacts.
- ☑ **150f — the cohort** (`stop`), inserted at 150d's sign: the ceiling deltas 0.000, +0.025, +0.225, −0.025 (146f −0.200, −0.150, −0.075, −0.350); signed 2026-11-05, the nominee to be the default.
- ☑ **150g — the nominee the default** (`none`), inserted at 150f's sign: the default byte-identical to the nominee capture and `--arb-null=pass` to the old ARM, 10 of 10 each.
- ☑ **150h — the ARM's board** (`stop`), inserted at 150f's sign: the prior table re-derived under the new ARM and committed, then the full board under it, the roster table from its ARM rows; the sheet's ARM refs re-pinned for the user's signature, no band moved. Built: v6 and the roster table v6, the board at `8a63a20e` 0 FAIL, 16 WARN, the ceilings +0.025, +0.025, +0.125, −0.025; the re-pin signed 2026-11-06 with both leans: the deploy row's fires re-pinned, the gambler added to §154's parity item (WORKLOG 150h).

## Phase 151 — the content (signed 2026-11-05)

Charter: bandits out of the draft (N28), with the roster table's guard
failing on a recorded roster that holds an archetype no longer
draftable; Mars as three one-stat idols (N24) at provisional sizes,
`mars` removed with the Run bump (v50 to v51); a `description` on the
ability schema, a line on the card and the shipped abilities' text
(A33); the units' lines, the user's, as they are written. **Why here:**
each changes what a run draws or shows, not a number the retune reads,
so the retune tunes the roster that ships, and the user's writing runs
beside the balance phases. **Risk:** low. **Decision points:** the
idols' provisional sizes; who drafts the abilities' text; the card
line's look (a stop). **Exit:** no bandit in a draft or a port's stock;
the roster table's guard failing on its planted case; the three idols in
play by URL; a v50 save rejected with its message; a line on every
shipped ability's card. **Scope guards:** no number the retune reads
moved; the idols' sizes are §154's.

## Phase 152 — the weapons and defense, by taste (signed 2026-11-05)

Charter: Round 9's conversion retuned by taste through the stat sheet:
each weapon's might and cadence (snipers slow and heavy), the units'
strength and ranged, defense's bases and growth; the spells and the
catapult against the halved defense. `tests/strike-conversion.test.ts`
retires at the first commit that moves a converted number. **Why here:**
after the sheet it is read through and the content it tunes; before
power, since the pools re-anchor on how fights end. **Risk:**
medium-high: many numbers, read by taste. **Decision points:** each
weapon's numbers and the defense numbers, taste stops in the user's
play. **Exit:** the numbers signed in the user's play, the sheet's ranks
recorded before and after. **Scope guards:** no new mechanism; no dodge
(Round 13); power, the kits and the pools are later phases'.

## Phase 153 — power by rarity, its growth key, and the pools (signed 2026-11-05)

Charter: power by rarity from 1/1/1/2 to the scale signed at its kickoff
(C18); power's level-up draw and its growth key out in the same
re-baseline (R19; five run streams move); the enemy pools re-anchored
behind it; act 1's encounters read against the per-kind cost target, the
rats' nest and the Vermin Lords first. **Why here:** after the weapons,
since the pools re-anchor on how fights end, and before the kits, whose
watches read a unit's worth. **Risk:** medium: a re-baseline and a box
read. **Decision points:** power's scale; the pools' moves. **Exit:** act
1's turn targets held on a box read and its cost per kind read against
the target. **Scope guards:** acts 2 and 3 recorded, not retuned.

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
