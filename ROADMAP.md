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

**Status: §137 in its stretch; 137c is next.** The spec is [round-9-spec.md](round-9-spec.md); the act
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

## Phase 137 — every strike lands, headless

**Charter:** the hit roll deleted, with precision and evasion, each
ability's `accuracy`, terrain's two combat modifiers, and §136's arms
and `strike` dial; then the conversion in config: each dodgeable
weapon's might and its unit's strength or ranged (base and growth)
scaled by the unit's hit rate in play (BALANCE.md's run log,
2026-10-28), and defense (base and growth) halved, in whole numbers. The
formula in play is today's without the roll. The type forces the UI's
references out here as plain removals; §138 finishes the screen.
**Why here:** a rule change before anything is balanced on it, headless
before the screen. **Risk:** medium: every battle and every level-up
draw re-baselines once (the pins, the corpus, the fuzz baselines); a Run
bump (the roster's units carry their stats) and a World bump.
**Decision points:** ✅ DECIDED 2026-10-28 — the rates re-measured at
400 seeds a bot (137a); no unit's stat feeds both kinds; the rounding,
defense by the pooled rate, the buffs converted, the riders and the
bot's two keys as the kickoff leaned (WORKLOG §137). **Exit:** the two stats, `accuracy` and the
terrain's modifiers gone from code and config; the idle miss path kept
with a landing note on each piece (`evadable`, `unit:missed`, the MISS
splat and its sound, the `evade` and `dealMiss` triggers); the converted
numbers pinned against a derivation from the measured rates and the old
config that the code does not consult. **Scope guards:** no cadence
change; no retune by taste (Round 11's); no dodge (Round 13's); no bot
change.

_The cut, signed 2026-10-28 with its five calls (WORKLOG §137):_

- ☑ **137a — the hit rates re-measured, 400 seeds a bot** (`none`).
  810,799 strikes, every strike 48.82 %; BALANCE.md, 2026-10-28.
- ☑ **137b — §136 reverted, byte-identical** (`none`). `0ea2d292`:
  corpus 0 of 30, fuzz diff PASS, three controls caught.
- ☐ **137c — every strike lands, at the converted numbers** (`none`).
- ☐ **137d — the phase's close** (`stop`).

## Phase 138 — the screen after the misses

**Charter:** the card's eight stats, the promotion and the ability detail
without hit or dodge, the archetype editor's dials, the locale strings,
and DESIGN's Combat paragraph and stat list. **Why here:** after the
rule, so the eye reads only what is visual. **Risk:** low. **Decision
points:** none known. **Exit:** each surface read in play. **Scope
guards:** the idle miss path untouched.

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

## Phase 140 — the close

**Charter:** the no-counts trial's read (R9), the keep test over the
lines §132 added, and the round close: the upload, carrying every strike
landing with §129's bumps and A-36's deletions. **Risk:** low.
**Decision points:** the upload; each rule kept or deleted. **Exit:** the
round closed by `process/planning.md` "Round close".
