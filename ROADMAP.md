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

**Status: Round 10 closed 2026-11-04; Round 11's kickoff, at §148, is
next.** The kickoff checks the charter's premises against the code and
cuts the phases with their reads for the user to sign
(`process/planning.md`). The charter, the decision points, the exit and
the scope guards are in META-ROADMAP §"Round 11 — The roster", amended in
three lines and its exit at Round 10's close; its premises were read at
HEAD then (`archive/worklog-phase-147.md`, 147a); its riders are TODO's
"Round 11".

## Phase 148 — the kickoff

The audit and the cut. The phases and their order are the kickoff's to
cut and the user's to sign.

- ☑ **The spec and the phases** — signed 2026-11-05: the spec
  ([round-11-spec.md](round-11-spec.md)) and §149 to §156 below, with
  the stat sheet added as §149 (WORKLOG §148).
- ◐ **Act 1's cost target per kind** (`stop`), on the pool as it is now:
  put to the user (WORKLOG §148).

## Phase 149 — the stat sheet (signed 2026-11-05)

Charter: a page beside the editors in `tools/` that ranks each
archetype's base stats and growths against the others and tables the
weapons, and gives a unit's maximum DPS dealt and received, with time to
kill both ways. Its inputs are an archetype, a level and a sector: a full
hand at that level resolves the sector's waves through the game's own
`resolveWave`, the damage is computed against each fielded enemy type and
then averaged, and range is ignored. The model is built headless first
and pinned in Vitest, then the page. **Why here:** the weapons' taste
stops are read through it; first, so the user uses it while §150 runs.
**Risk:** low-medium: the page is front-end, and the model's check is the
risk. **Decision points:** at its kickoff, abilities past the main
attack, a heal-per-second column, the idols as a toggle, Escalation as
an input, the check's tolerance; the page's look (a stop). **Exit:** the
model's damage a swing checked against in-play damage a swing (the swing
read's protocol), each unit's gap named, with a planted failure; the page
read by the user. **Scope guards:** no config number and no sim code
moved; a hand against a wave as a team fight stays the sim's.

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
(C20); the priest's parity (C16); the area-status enemies' retune (C19);
the blind fix (C12), the kiter's case a stop; the idols' sizes (N24); the
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
