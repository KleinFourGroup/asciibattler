# The context-meter mod

What the mod does for a session is in CLAUDE.md, "The context meter".
This file is for a session that reads a count on request, edits the mod,
or finds it not loaded.

## The tool

The tool `mcp__context-meter__read` returns the session's context fill on
request: the input tokens the last response was answered over, as the
status line has them. Under the app the tool can be listed only as a deferred
tool: load it with ToolSearch (`select:mcp__context-meter__read`) before
the first call, since deferred is not absent. If it is absent, ask the
user for the reading.

## Loading

- The engine loads the mod only in a trusted workspace, and that is
  enough: no hot-reload question needs answering (seen 2026-10-02).
- For this repo, the flag it reads is `hasTrustDialogAccepted` under the
  forward-slash key (`C:/Users/…`) in `~/.claude.json`, not the backslash
  key the app's dialog set; `claude plugin list` names a folder it
  skipped.
- An edit to the mod did not load within the turn that made it (seen
  2026-10-24); a fresh session loads it.

## Checking an edit

- To type-check an edit, write a tsconfig in your scratch directory from
  the header of the plugin-authoring skill's `types/claude-code.d.ts`, add
  `allowImportingTsExtensions`, list that file and the files under
  `hooks/` under `files`, and run the repo's `tsc -p` on it. Use the
  skill's declarations: the copy the engine writes beside a hot-reload mod
  lacks the built-in tools' inputs and passes code the skill's copy fails.
- `claude plugin validate` does not type-check (an unawaited Promise
  passed it).
- The CLI is not on PATH here; it is the app's bundled `claude.exe` under
  `%APPDATA%\Claude\claude-code\<version>\<build>\`.
- The backslash note's model, `hooks/halving.ts`, is also held by
  `tests/shell-halving.test.ts` and type-checked by the repo's own
  typecheck.
