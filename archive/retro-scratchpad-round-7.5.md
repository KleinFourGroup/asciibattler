# Retro scratchpad — Round 7.5 (The Board), §105 → §109

Archived 2026-09-27 at the Round 7.5 close (the tenth distillation sweep;
WORKLOG "The Round 7.5 close", C5 → `archive/post-104-worklog.md`). The
entries below are VERBATIM as the sessions wrote them. The round's 22
friction-log entries (`retro/papercuts.jsonl` #37–#58, all `papercut`) were
triaged in the same sweep; the log itself is append-only and stays where it
is.

**Promoted (user-signed 2026-09-27):**

- **AGENTS** — step zero: a change inside the signed intent can be built
  and flagged, a change to the intent goes back first (entry 1 below) ·
  the Shell rule NARROWED, not enforced: a script or code with a regex or
  an escape goes through the file tool, a quote never goes into an inline
  `-m` / `-e`, prose may go through a quoted heredoc and is grepped after;
  a patch script checks every anchor in every file before it writes any
  (entry 2; #39, #44, #48, #50, #51, #57; a byte-identity probe of a quoted
  heredoc against the Write tool, this close) · the reads doctrine made
  permanent · the standing decisions kept, revisit at the Round 8 close.
- **process/planning.md** — the step-zero nuance · the reads terms kept,
  `batch` recounted at the Round 8 close · the shape-lock asks whether the
  user's handoff number stands · a count the exit re-records is written
  with its derivation (#56).
- **process/browser-pane.md** — the same-page shader A/B (entry 3) · zoom
  can't crop (#49) · a long probe's source kept in `localStorage` (the §108f
  and §109 reports) · the whole-run driver (the §106 report).
- **process/oracles.md** — a file-swapping control saves and restores
  through one path and prints the diff stat after (#58).
- **TODO** — a guard that dev code doesn't ship (#42) · the §98
  team-identity rider ticked.
- **META-ROADMAP Round 8** — the pane probe kit, with pre-registered
  criteria for the round's close (the Browser pane's recurring friction:
  #38, #40, #43, #45, #49, #54).

**Archived as already covered, or as data:** #37 (CLAUDE.md, the preview
hook) · #38, #40, #43, #45, #54 (process/browser-pane.md already held
them) · #41, #52, #55 (reminder-wording data; the reword trial retired) ·
#46 (AGENTS, re-count a remembered number) · #47 (CLAUDE.md, what the user
sees) · #53 (a one-off).

---

- **Step zero that widens an approved fix: build and flag, judged appropriate** (2026-09-23, 106d riders, `0970be0`). The user approved "let the chip row wrap"; step zero measured a single long chip overflowing too, so the session added two CSS rules inside the same intent (labels kept, chips fit) and flagged them in its report instead of asking first. AGENTS says to take a step-zero change to a signed cut to the user before building. The user, asked in the session report: "your bending the rule was appropriate". A candidate nuance for the round-close sweep: a change that stays inside the approved intent can be built and flagged; one that changes the intent goes back first.

- **The Shell rule keeps breaking at "append to an existing file"** (2026-09-23, the §106-close `printf`; 2026-09-24, two heredocs in §107). Each carried backticks, landed intact, and was noticed after it ran. The trigger is the same every time: Write replaces a file and Edit needs an anchor, so an append reaches for the shell. Candidates for the sweep: a documented append route (a small node script written with Write, or Edit anchored on the file's last line), or a guard on the path, such as a PreToolUse hook that stops a Bash heredoc or `printf` whose body contains a backtick. AGENTS: "Put the guard on the path where the mistake happens".
- **A same-page shader A/B in the pane** (107d-post, WORKLOG): swap `material.vertexShader` with the change cut out, on both sprite materials, set `needsUpdate`, call `renderTwoPass()`, then `gl.readPixels` in the same task, with a standing unit as the pixel-identical control. A candidate for [process/browser-pane.md](../process/browser-pane.md).
