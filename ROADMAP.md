# ROADMAP — Round 8.5 (Housekeeping), post-§118

The active PLAN (it stays a plan for its whole life). The macro order is
[META-ROADMAP.md](META-ROADMAP.md) (Round 8 Foundations ✅ CLOSED
2026-10-11; Round 8.5 — Housekeeping is NEXT, re-audited at that close);
findings + rationale land in [WORKLOG.md](WORKLOG.md); live status is
HANDOFF's 🧭 Cursor. Sub-steps are cut at each phase kickoff (AGENTS "The
planning stack"), never here, and each cut step declares its read (`none`
· `batch` · `stop`; AGENTS "Reads are cut, not improvised"). Prior round's
plan: [archive/post-109-roadmap.md](archive/post-109-roadmap.md) (Round 8)
with its worklog and spec beside it; before it
[archive/post-104-roadmap.md](archive/post-104-roadmap.md) (Round 7.5).

**Status: §119 IS IN PROGRESS** (cut signed 2026-10-11). The spec holds
the user's intent and four signed decisions
([round-8.5-spec.md](round-8.5-spec.md)). The round opens with the
oracle map, ahead of the census, as the user signed at the Round 8 close
(C1's third answer). The kickoff writes the round's spec first
(`round-8.5-spec.md` at the repo root; `process/planning.md` "The
artifacts") and hardens §119's entry against the code. No phase entries
beyond §119's charter exist until then: the census follows the map, the
deletions go one subsystem to a phase, and the round's size is known only
after the census (META-ROADMAP). The charter, the decision points, the
exit and the scope guards are in META-ROADMAP §"Round 8.5 — Housekeeping";
the re-audit behind its 2026-10-11 amendment is
[archive/post-109-worklog.md](archive/post-109-worklog.md) "118j — the
round close", C1.

## Phase 119 — the oracle map

Charter: for each part of the code, name what proves a deletion there
changed nothing, and show each proof failing on a planted break, so that
every candidate the census lists can name the oracle that covers it. Five
instruments, from META-ROADMAP's first item: a journal corpus recorded at
the round's baseline (about thirty headless runs, with a count of the
gates and commands they reach); the chaos census pinned on commands that
change the run, for the kinds its seeds reach (thirteen of 21 at the Round
8 close); a tool-only flag to replay past a config mismatch, so a journal
can say whether a knob is dead; a field-by-field diff of the end snapshot,
for a deletion that slims the save; and a count of step codes in `src`
comments that may only fall.

**Why first:** the round's charter leaned on Round 8's journal, chaos
driver and continuation check as its deletion oracles, and the close's
re-audit found each short of that as built: a replay on another commit
has to be forced, a config mismatch cannot be, no journal is stored in the
repo, and the chaos driver's every-commit seeds never reach the
sector-cleared gate or a port trade. **Depends on:** Round 8 (✅).
**Risk:** low-medium: instruments and tests, no deletion; the close's
guess at its cost was 80k to 150k of context. **Decision points:** the
replay flag reverses §114's choice that nothing forces a replay past a
config mismatch, and the kickoff's shape-lock confirms it; whether the
corpus is tracked in the repo or re-recorded from its seeds; the chaos
census's other eight command kinds (the five port trades, `usePacket`,
`redrawCards`, `dismissSectorCleared`), taken only if the census wants to
delete in that code. **Exit:** every part of the code the census will
list candidates in has a named proof, each shown to fail on a planted
break; each of the five instruments is built or dropped with a reason.
**Scope guards:** nothing is deleted before the census is signed; no
behaviour change; the replay flag stays a tool's, and the shipped game
replays nothing past a config mismatch; the permanent gates are never
relaxed. The kickoff hardens this entry against the code.

- Re-scoped 2026-10-11 (the kickoff, user-signed): two more proofs, a
  declared mapping back to the old names for a change that renames what is
  stored, and parsed-config equality for a config move, because the round
  now lets reshaping in by trial (the spec's D3; WORKLOG "Kickoff").
- ✅ DECIDED 2026-10-11 (the shape-lock): the replay flag is confirmed, a
  tool's only; the corpus is tracked in the repo; the chaos census's other
  eight kinds wait for the census; a coverage tool comes in as a dev
  dependency at 119g; no second model's review for now. WORKLOG "The §119
  audit, and the cut put to the user".

**The cut** (signed 2026-10-11: five `none`, one `batch`, one `stop`).

- ☑ **119a — the replay tool reaches further** (`none`). A tool-only
  option past a config mismatch (`--force-config`), each battle's event
  digest with an optional mapping applied before hashing, the end snapshot
  handed back when its hash differs, and a pin that the game's entry never
  reaches the replay. No bump; the smoke does not fire. Built as cut, each
  held against its plant (WORKLOG §119, 119a).
- ☑ **119b — the journal corpus** (`none`, with a stop if no run ends in
  victory: a recorder on the fuzz bot, or the late game left to the fuzz
  diff). About thirty journals from a table of seeds and dials, tracked
  under `tests/fuzz/corpus/` with their digests and a census of what they
  reach; all replayed in the smoke tier, three on every `npm test`. The
  smoke fires. 30 journals, 10 won, so the stop did not fire; four plants
  caught (WORKLOG §119, 119b).
- ☑ **119c — the chaos census pinned on what changes the run** (`none`).
  A kind counts when `applied > 0` on any every-commit seed (13 of 21 at
  the Round 8 close, re-measured at step zero); the test names both lists
  and fails when either moves. 13 and 8 at step zero, as at the close; a
  planted no-op fails it by its one kind (WORKLOG §119, 119c).
- ☑ **119d — parsed-config equality and the snapshot field diff**
  (`none`). Each is empty HEAD against HEAD and catches its plant. Built
  as one path-by-path JSON diff with two uses, `npm run oracle` (WORKLOG
  §119, 119d).
- ☑ **119e — the comment instruments** (`none`). The step-code count with
  its rule, as a ceiling that may only fall; the comment-stripped compare
  with a planted code edit as its failing control; a length reading. On
  the parser; 6,376 codes, held by file (WORKLOG §119, 119e).
- ◐ **119f — the cold-read probe, calibrated** (`batch`, read at 119g:
  the table of right answers out of three per question; wrong is every
  cell 3/3 or 0/3, or the planted tree scoring the same). Questions drawn
  from existing tests, half by another agent into a folder the session
  does not open; at most 30 small-model runs and one authoring agent;
  harder questions if Haiku saturates, then the token measure. Built,
  unread: 27 of 27 runs right on both trees, both wrong-looking outcomes;
  the token measure sees the plant (WORKLOG §119, 119f).
- ☐ **119g — the oracle map and the phase's close** (`stop`). By part of
  the code, the proofs, each with its planted break; into TESTING.md; the
  charter's determinism clause corrected.
