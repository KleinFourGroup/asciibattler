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

**Status: §119 ✅ CLOSED 2026-10-12; §120, the census, is under way** (cut
and signed that day). The spec holds the user's intent and four signed
decisions ([round-8.5-spec.md](round-8.5-spec.md)). The round opened with
the oracle map, ahead of the census, as the user signed at the Round 8
close. After the census the deletions go one subsystem to a phase, and the
round's size is known only once the census has sizes (META-ROADMAP). The
charter, the decision points, the exit and the scope guards are in
META-ROADMAP §"Round 8.5 — Housekeeping".

## Phase 119 — the oracle map ✅ (closed 2026-10-12)

For each part of the code, what proves a change there changed nothing,
each proof shown to fail on a planted break: TESTING.md "The oracle map".
The charter's five instruments, the kickoff's two more proofs, the
cold-read probe and a coverage tool, all built; each step's record, and
every call the user signed at the close, is in WORKLOG §119.

- ☑ **119a — the replay tool reaches further** (`none`). A tool-only
  option past a config mismatch, each battle's event digest with an
  optional mapping, the end snapshot handed back when its hash differs,
  and a pin that the game's entry never reaches the replay.
- ☑ **119b — the journal corpus** (`none`). 30 journals under
  `tests/fuzz/corpus/` with their digests and a census of what they
  reach; all in the smoke tier, three on every `npm test`.
- ☑ **119c — the chaos census pinned on what changes the run** (`none`).
  13 kinds change the run on the every-commit seeds and 8 are only sent;
  the test names both lists.
- ☑ **119d — parsed-config equality and the snapshot field diff**
  (`none`). One path-by-path JSON diff with two uses, `npm run oracle`.
- ☑ **119e — the comment instruments** (`none`). The compare with the
  comments out, the step-code ceiling (6,376 codes, by file and exact), a
  length reading.
- ☑ **119f — the cold-read probe, calibrated** (`batch`). 27 of 27 Haiku
  runs right on both trees; kept as a token measure with a floor, 66 runs
  at the round's close.
- ☑ **119g — the oracle map and the phase's close** (`stop`). 31 planted
  sites; what each proof reaches as `npm run oracle -- reach`; the build
  compare as `build-hash`; the charter's clause corrected. `-post`: three
  test loops bounded, so a reward command that stops taking effect fails
  `npm test` where it hung it.

## Phase 120 — the census

Charter: every candidate with its evidence, in two lists (the spec's D1):
what a search proves dead, and the trials, each with what it expects to
remove and the proof that covers it. Every candidate names its proof from
the oracle map, and the user signs the list before anything is deleted.
META-ROADMAP's census item holds what the lists cover. The cut and nine
calls were signed 2026-10-12 (WORKLOG §120, the kickoff). The census is a
file of its own, `round-8.5-census.md`: a class a search settles is signed
as a class with ten drawn rows, a judgement row by row. Nothing under
`src` or `config` changes in this phase.

- ✅ DECIDED 2026-10-12 (at §119's close, ahead of the cut): the census's
  first step is a drawn sample of planted breaks, about 200 lines the
  proofs run with one mechanical edit at each, held against the corpus and
  then the suite. It turns "reached" into a measured rate by folder, and
  its survivors are leads. WORKLOG "The close of §119".
- ☑ **120a — the drawn sample** (`batch`, read at 120c: the rate table
  and the survivors; wrong is a folder whose named proof misses most of
  what it runs). 200 sites, one mechanical edit at each: 140 on lines the
  corpus runs, 30 on sim and run lines only tests run, 30 on shipped code
  no headless proof loads. `npm run oracle -- plant` is kept. The
  corpus noticed 109 of its 140 and the suite 12 more; 27 of 200 went
  unnoticed, 7 of them a change no proof looks at. Read early and its
  calls signed at the hand-off, 2026-10-12 (WORKLOG §120).
- ☑ **120b — who reads this** (`none`). A type-aware reference finder
  for every export, config key and `RunConfig` field, by kind of reader;
  kept as `npm run oracle -- refs`. 15 of 15 of its rules planted; a
  schema typed by a hand-written interface is asked by its members.
- ◐ **120c — the dials** (`stop`). Every config key by schema path,
  `RunConfig` field, URL parameter and fuzz flag, with its readers, any
  value set but its default, a proposed fate and its proof; content
  nothing refers to, apart. The census file's format starts here. Built
  2026-10-12 and waiting for its read: 616 config keys in six classes and
  20 rows, `round-8.5-census.md` section 1 (WORKLOG §120, 120c).
- ☐ **120d — exports, files and exact duplicates** (`batch`, read at
  120e: each class's count and ten drawn rows; wrong is a row whose reader
  the user knows of). `tools/`, `scripts/` and `shell/` for deletion only.
- ☐ **120e — the tests, by file** (`stop`). The lines only that file
  runs, the sampled breaks it caught, the bottom of the list classed.
- ☐ **120f — the trials** (`batch`, read at 120h: wrong is a trial the
  user would not want tried). The profile, the near-duplicate and
  special-case clusters, the two named trials sized, `Run.ts` and
  `World.ts` read whole.
- ☐ **120g — the TODO pass's list** (`batch`, read at 120h: wrong is a
  rider dropped that the user still wants). 91 open items, each proposed
  as done, dropped or given a round.
- ☐ **120h — the census signed and the round sized** (`stop`). The lists
  signed, the trials' budget set, the later phases written here.
