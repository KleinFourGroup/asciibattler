# WORKLOG — Round 8 (Foundations)

Per-round narrative log (AGENTS "The planning stack"): findings, decision
rationale, rejected alternatives, scope changes, playtest verdicts land
here under the matching `## Phase N`; the ROADMAP stays a plan (one-line
mutations + a pointer back here). Created 2026-09-27 at the Round 7.5
close. Prior round's log:
[archive/post-104-worklog.md](archive/post-104-worklog.md) (Round 7.5, The
Board — the kickoff's charter hardening → §105 the projection spike, pass
one → §106 pass two + the spec → the new-model tone audit → §107 the
projection, built → §108 the ground mark, drawn by the terrain → §109 the
rule deletion → the close), with its plan
[archive/post-104-roadmap.md](archive/post-104-roadmap.md) and spec
[archive/round-7.5-spec.md](archive/round-7.5-spec.md) beside it.

**Read first:** `archive/post-104-worklog.md` §"The Round 7.5 close". C1 is
this round's re-audit: the premises that moved against the code, R1 the
run journal, the public web channel's six points, and what 7.5 handed
forward. C5 is where the pane probe kit and its three pre-registered
criteria came from.

## Kickoff — Round 8 (Foundations)

### Before the kickoff: Round 8.5 inserted (2026-09-27, user-signed)

The user raised a broader codebase review after the 7.5 close (dials that
no longer move, duplicate implementations, workarounds, tests pinning
removed code), and the tone audit's source-comment rewrite had lost its
timing. Signed: both fold into **Round 8.5 — Housekeeping**, after this
round and before Round 9 (META-ROADMAP §Round 8.5 has the charter and why
that slot). For this round, that means a deletion Round 8 does not need
can wait for the 8.5 census.

### Before the kickoff: the background recorder (2026-09-27 → 28, user-signed 2026-09-28)

The user asked for a way to get video files of battles, events and full
runs: their current recording process is cumbersome with their
accessibility tools, and clips would serve before/after reads and
community interest. Their constraints, which shaped the design: real time
is fine; it runs in the background while they work, never takes focus;
none of their own audio (the eye-tracker keyboard's clicks) reaches the
recording; and, if possible, they don't hear the recording. The Chromium
render is fine, since a visible difference from Firefox is a bug anyway.

Rejected: a browser-only recorder (a capture dialog per session, and a
background tab stops rendering); capturing the system's sound output (it
would record the keyboard clicks); faster-than-real-time rendering (not
needed; it would mean driving the CSS animations' clock too). Kept: an
Electron recorder in a never-shown window, with the audio routed inside
the page into the recording and away from the speakers. It lands right
after the shell spike, whose three added checks decide the video path,
because scenes, seeds and before/after need only the shell; full runs wait
for the journal. A code fact behind check 1: a page that stops rendering
stalls its CSS animations as well as the board (the stall `lossFx.ts`'s
backstop timer exists for), while nothing in `src/` pauses on a hidden or
unfocused window. The entry: META-ROADMAP §Round 8, the recorder.

_(The kickoff entry lands here: the charter against the code, the §110 cut
with its reads, then, after the spike is read, the spec and the round's
cut. Charter + decision points: META-ROADMAP §Round 8.)_
