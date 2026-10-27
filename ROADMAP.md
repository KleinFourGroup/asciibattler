# ROADMAP — Round 9 (The frame and the damage trial), post-§133

The active PLAN (it stays a plan for its whole life). The macro order is
[META-ROADMAP.md](META-ROADMAP.md) (Round 8.5 Housekeeping ✅ CLOSED
2026-10-26, its close re-cutting the old Rounds 9 and 10 into Rounds 9 to
23); findings + rationale land in [WORKLOG.md](WORKLOG.md); live status is
HANDOFF's 🧭 Cursor. Sub-steps are cut at each phase kickoff (AGENTS "The
planning stack"), never here, and each cut step declares its read (`none`
· `batch` · `stop`; AGENTS "Reads are cut, not improvised"). Prior round's
plan: [archive/post-118-roadmap.md](archive/post-118-roadmap.md) (Round
8.5) with its worklog, spec and census beside it; before it
[archive/post-109-roadmap.md](archive/post-109-roadmap.md) (Round 8).

**Status: §136's cut signed 2026-10-27; 136a is in progress.** The spec is [round-9-spec.md](round-9-spec.md); the act
design it asked for is [plans/acts.md](plans/acts.md). The charter is
META-ROADMAP §"Round 9 — The frame and the damage trial"; the premises
re-read at HEAD are `archive/worklog-phase-135.md` "Kickoff — Round 9", tranche 3.

## Phase 134 — the kickoff

The spec, the act design, the charter against the code, and the phases,
each signed by the user (`archive/worklog-phase-135.md`, "Kickoff — Round 9").

- ☑ **The spec** — signed 2026-10-27, the plague's cause and act 4's
  condition left open as the user's, for the rounds that need them (22
  and 23).
- ☑ **The act design** — [plans/acts.md](plans/acts.md); the shipped two
  sectors become acts 2 and 3 from Round 10.
- ☑ **The phases** — §135 to §139 below.

## Phase 135 — the board's instruments, and the stars' tap ✅ (closed 2026-10-27)

The roster table written a row a line with its sector ids, and guarded;
`box-drive.sh` takes mixed queues; every ability's fx guarded; the
deleted action classes out of the docs; the stars' tap on touch. Each
step's record is `archive/worklog-phase-135.md`.

- ☑ **135a — the roster table a row a line, with its sector ids** (`none`).
  4.6 MB to 1.8 MB, one added field by json-diff.
- ☑ **135b — the roster table's coverage guard** (`none`). Six planted
  tables; the sampler refuses a sector mismatch at launch.
- ☑ **135c — `box-drive.sh` takes mixed queues** (`none`). Each batch
  checks its own artifact; `--plan` shows them before a box.
- ☑ **135d — `FX_REGISTRY`'s coverage guard** (`none`). Four abilities
  listed with reasons; every periodic tick sounds.
- ☑ **135e — the deleted action classes out of the docs** (`none`). Seven
  passages rewritten, none retired; #109's lost pin restored.
- ☑ **135f — the rarity stars take the long-press inside a control**
  (`batch`). The pane read the route; the user read the tap on touch.
- ☑ **135g — the phase's close** (`stop`). Read and signed 2026-10-27.

## Phase 136 — the trial's switch and arms, headless

**Charter:** the bar written first; then the config switch, the range's
draw (the Kumaraswamy's inverse on the one uniform an evadable strike
draws today), the mixture on the same uniform, and a URL dial that picks
an arm. The three arms are `b` 0.25, `b` 1, and `b` 1 with half of
today's misses kept, against hit or miss ([round-9-spec.md](round-9-spec.md)
"The trial"). **Why here:** a rule change before anything is balanced on
it, and headless before render, so the eye reads only what is visual.
**Risk:** medium; the switch keeps a rollback cheap. **Decision points:**
the bar; ✅ DECIDED the rounding at small damage: by chance, the fraction
as its odds, so the mean is exact at every damage; ✅ DECIDED bleed, blind
and the three hit hooks: they ride every strike that deals damage, and a
strike that deals 0 is a miss (WORKLOG §136, "The cut signed"). **Exit:** the switch off
byte-identical under the corpus and the fuzz diff, with a failing
control; each arm's mean and spread pinned against a derivation the code
does not consult; every arm reachable by the dial. **Scope guards:**
non-evadable strikes keep their fixed damage; no bot change (it reads no
hit chance, `archive/worklog-phase-135.md`, tranche 3).

The cut, signed 2026-10-27 (no step adds an RNG stream):

- ☑ **136a — the bar** (`stop`). In the spec before any arm; signed
  2026-10-27 as written.
- ☑ **136b — the `strike` dial, the off arm byte-identical** (`none`).
  `8303ffc5`: corpus 0 of 30, fuzz diff PASS, three controls caught;
  World v37 by its convention, and the run clone takes the arm (WORKLOG).
- ☑ **136c — the range's draw** (`none`). `3e35aa85`: pinned through
  `applyDamage` against a quadrature; a planted wrong `a` caught (WORKLOG).
- ☑ **136d — the mixture** (`none`). `c3295d38`: pinned the same way,
  with the share of misses; a planted miss share caught (WORKLOG).
- ☑ **136e — a 0 is a miss, and the hooks ride every strike that deals
  damage** (`none`). `c3af910f`: pins only (136c built it); both plants
  caught (WORKLOG).
- ◐ **136f — the phase's close** (`stop`). Put to the user 2026-10-27.

## Phase 137 — the trial on screen

**Charter:** what each arm shows: a strike that lands for 0, the
mixture's MISS, the two hit-chance readouts (the ability detail's "%
hit", the promotion delta's dodge share), and the miss's sound. **Why
here:** after the switch, so only the visual part waits on the user's
eye. **Risk:** low. **Decision points:** ✅ DECIDED what a 0 shows: a
MISS, since a 0 is a miss (§136); the readouts' wording. **Exit:** each arm readable in play, by the dial. **Scope
guards:** the hit-or-miss arm's screen unchanged.

## Phase 138 — the user's play and the keep

**Charter:** the user plays the three arms and hit or miss, labelled, and
picks one; the veto board runs on the pick, paired same-seed against hit
or miss, against the bar's lines, and doubles as the round's closing
board; then the trial is kept or rolled back. **Why here:** the play and
the board need the switch and the screen. **Risk:** medium: the board is
a box batch, and the arms move the signed sheet's numbers.
**Decision points:** the pick; keep or roll back; the default if kept.
**Exit:** the trial kept or rolled back on its bar and the user's play,
and DESIGN's Combat paragraph says which. **Scope guards:** no roster
retune (Round 11's, on the arm kept).

## Phase 139 — the close

**Charter:** the no-counts trial's read (R9), the keep test over the
lines §132 added, and the round close: the upload, carrying the damage
feel if kept with §129's bumps and A-36's deletions. **Risk:** low.
**Decision points:** the upload; each rule kept or deleted. **Exit:** the
round closed by `process/planning.md` "Round close".
