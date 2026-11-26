# WORKLOG — Round 12 (Push, pull and blink)

Per-phase narrative log (AGENTS "The planning stack"; `process/planning.md`
"The artifacts"): findings, decision rationale, rejected alternatives,
scope changes, playtest verdicts and the checks run land here under the
matching `## Phase N`; the ROADMAP stays a plan. The file holds the phase
in progress: at each phase close it moves to `archive/worklog-phase-N.md`
and a fresh one starts. Round 12's phases before this one are in
[archive/worklog-phase-158.md](archive/worklog-phase-158.md) (the kickoff,
§157, and the pre-step and the design, §158),
[archive/worklog-phase-159.md](archive/worklog-phase-159.md) (forced
movement, the seam),
[archive/worklog-phase-160.md](archive/worklog-phase-160.md) (the pushers
and the bursts),
[archive/worklog-phase-160.5.md](archive/worklog-phase-160.5.md) (the
fall),
[archive/worklog-phase-161.md](archive/worklog-phase-161.md) (the blink
and the charge) and
[archive/worklog-phase-161.5.md](archive/worklog-phase-161.5.md) (the hex
and the ice storm as specials); Round 11's are
[archive/worklog-phase-149.md](archive/worklog-phase-149.md) to
[archive/worklog-phase-156.md](archive/worklog-phase-156.md).

## Phase 162 — the closing board

The kickoff's inputs, by pointer: what §161 and §161.5 hand on
(`archive/worklog-phase-161.md`, "§161's close";
`archive/worklog-phase-161.5.md`, "§161.5's close"); ROADMAP §162; TODO's
Round 12 rows; `process/planning.md` "Phase kickoff", then
`process/measurement.md` and BALANCE.md for the board.

### Between §161.5 and §162: the watcher skips scratch/ (2026-11-26)

**Asked.** The user's own `npm run dev` loads almost at once, where the
hidden pane twice took about 90 s to go live (161f-post2, 161.5b), and
`scratch/` need not be watched; signed: "Yes, ignore it".

**Measured** in the hidden Browser pane (0×0, `visibilityState`
visible), three cold `dev-preview` starts each way, from the resource
timings. With `scratch/` watched (9,208 files): the first stylesheet
held 3.6, 8.8 and 11.1 s after it was asked for, which the page did
1.2 and 2.3 s into the first two loads (the third was a reload by the
pane, its start unknown). A reload on the warm server: the stylesheet
in 13 ms and all 250 modules in 0.5 s, which matches what the user
sees from a server left running. With `**/scratch/**` added to
`server.watch.ignored`: 0.8, 1.5 and 0.7 s, the stylesheet asked for
2.0 to 2.8 s and every module in 3.6 to 3.7 s after the server process
started (its start read from `Win32_Process`, the page's from
`performance.timeOrigin`). The pre-commit hook's copy of the staged
files is under the OS temp folder, outside the watched tree, and no
stale Vite process was running.

**Not explained.** The two 90 s loads: no cold start today came near
the 30 s timeout, and the hidden pane at 0×0 loaded every time without
a resize. The scan's cost varied 3× across three starts minutes apart,
so a busier moment could stretch it, which would make the resize and
reload in the "not live" bullet's 2026-11-22 fact line a coincidence;
that is an inference, and the fact line is the user's.
