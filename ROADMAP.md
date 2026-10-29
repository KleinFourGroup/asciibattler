# ROADMAP — Round 9 (The frame and the misses), post-§133

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

**Status: §139's cut signed; 139c is next.** The spec is [round-9-spec.md](round-9-spec.md); the act
design it asked for is [plans/acts.md](plans/acts.md). The charter is
META-ROADMAP §"Round 9 — The frame and the misses"; the premises
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

## Phase 136 — the trial's switch and arms, headless ✅ (closed 2026-10-28)

The `strike` dial and three range arms, built headless with the off arm
byte-identical; at the close the user's play rolled the trial back, and
§137 to §140 were re-cut. Each step's record is
`archive/worklog-phase-136.md`.

- ☑ **136a — the bar** (`stop`). Signed 2026-10-27 as written.
- ☑ **136b — the `strike` dial, the off arm byte-identical** (`none`).
  `8303ffc5`: corpus 0 of 30, fuzz diff PASS, three controls caught.
- ☑ **136c — the range's draw** (`none`). `3e35aa85`.
- ☑ **136d — the mixture** (`none`). `c3295d38`.
- ☑ **136e — a 0 is a miss, and the hooks ride every strike that deals
  damage** (`none`). `c3af910f`.
- ☑ **136f — the phase's close** (`stop`). Signed 2026-10-28, with the
  trial rolled back and the re-cut.

_§137 to §140 re-cut 2026-10-28 at §136's close, when the user's play
rolled the trial back (`archive/worklog-phase-136.md`, "The trial rolled
back, and the re-cut"); the trial's screen and keep phases are gone._

## Phase 137 — every strike lands, headless ✅ (closed 2026-10-28)

The hit roll deleted with precision, evasion, `accuracy` and the
terrain's two modifiers, §136's arms reverted, and the config converted
by each unit's measured hit rate (RunSnapshot v50, WorldSnapshot v39);
at the close, the stdin guard and the pre-commit hook checking the
commit itself. Each step's record is `archive/worklog-phase-137.md`.

- ☑ **137a — the hit rates re-measured, 400 seeds a bot** (`none`).
  810,799 strikes, every strike 48.82 %; BALANCE.md, 2026-10-28.
- ☑ **137b — §136 reverted, byte-identical** (`none`). `0ea2d292`:
  corpus 0 of 30, fuzz diff PASS, three controls caught.
- ☑ **137c — every strike lands, at the converted numbers** (`none`). The
  conversion pinned by `tests/strike-conversion.test.ts`; corpus re-recorded.
- ☑ **137c-post — seven sentences 137c made false** (`none`). `66d744a9`;
  found by the close's exit read (WORKLOG §137).
- ☑ **137d — the phase's close** (`stop`). Signed 2026-10-28, with the
  stdin guard (`bcbcacb1`) and the hook on the commit itself (`58ae0aa9`).

## Phase 138 — the screen after the misses ✅ (closed 2026-10-29)

137c's plain removals had built the screen already; DESIGN's stat list
and Combat paragraph rewritten as the game is, the attack editor's
outline fixed, and each surface read in play. Each step's record is
`archive/worklog-phase-138.md`.

- ☑ **138a — DESIGN's stat list and Combat paragraph, as the game is**
  (`none`). `42f94563`; four more false sentences found and fixed.
- ☑ **138b-pre — the attack editor's damage outline without a dangling
  separator** (`none`). `e17d071a`; found at 138b's step zero.
- ☑ **138b — the surfaces read in play, and the phase's close** (`stop`).
  Signed 2026-10-29: every read passed; mercenary-heavy encounters much
  harder now, for §139.

## Phase 139 — the board and the user's play

**Charter:** the round's closing board, read as paired same-seed deltas
against the round before; the user plays the converted game; a converted
number moves only where the board or the play shows "roughly equivalent"
missed. **Why here:** the board and the play need the rule and the
screen. **Risk:** medium: a box batch, and the conversion moves the
signed sheet's numbers, the spells and the catapult against halved
defense by design. **Decision points:** what "roughly equivalent" holds
to; a re-pin of the sheet. **Exit:** the board read and the user's play
recorded; DESIGN's Combat paragraph matches the game. **Scope guards:**
no retune by taste (Round 11's).

✅ DECIDED at the kickoff (2026-10-29): "roughly equivalent" is each
unit's damage a swing in play within ±10 % or at its nearer whole point,
each board row within one Escalation step, each encounter within two
standard errors; no re-pin of the sheet in this phase (WORKLOG §139).

- ☑ **139a — the box runs a pushed commit behind main's tip** (`none`).
  Both guards refuse an unpushed commit; the box's checkout read at 139c.
- ☑ **139b-pre — the build ID's repository plant takes 15 s** (`none`).
  A load timeout in two of four full runs; found at 139b.
- ☑ **139b — each converted strike back within reach of its old swing,
  by whole points** (`none`). Seven bases a point; the River drift gate
  re-expressed as a twenty-seed lean, user-signed (WORKLOG §139).
- ☐ **139c — the board, three trees** (`none`; read at 139d).
- ☐ **139d — the board read and the user's play** (`stop`).
- ☐ **139e — what 139d signs** (cut at 139d, read with it).
- ☐ **139f — DESIGN's Combat paragraph against the game, and the
  phase's close** (`stop`).

## Phase 140 — the close

**Charter:** the no-counts trial's read (R9), the keep test over the
lines §132 added, and the round close: the upload, carrying every strike
landing with §129's bumps and A-36's deletions. **Risk:** low.
**Decision points:** the upload; each rule kept or deleted. **Exit:** the
round closed by `process/planning.md` "Round close".
