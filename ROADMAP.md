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

**Status: AWAITING THE ROUND 8.5 KICKOFF.** The round opens with the
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
