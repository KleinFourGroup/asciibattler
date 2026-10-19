# The app's session tools, as observed (2026-10-15)

Session 989537c5, claude-opus-5-5, the Claude desktop app's Code tab. Kept
here, not in CLAUDE.md, at the user's call, until the driver trial
(`driver-prompt.md`) has been run. "Read" below means the tool's own
description was loaded and read; "named" means only its name was seen in
the deferred-tool list. "Tried" means it was called and the result read.

## What wakes a parent

From the app's instructions to the session, not from a test:

- A side session's note reaches its parent every time it ends a turn,
  quoting the first 400 characters of its report (its wrap-up recap, then
  its final message).
- The parent is continued (woken) when the side session ends its first
  turn, or a turn the parent's own message began, if no other side session
  it started is still working and the parent is idle.
- Notes wait for the parent's next turn instead when the side session's
  turn was one the user drove there, or was stopped or failed, or after a
  long run of wakes with nothing from the user. A cloud session sends none.
- A turn started by another session's message or an automated event
  cannot start a session; it can only propose one (a card).
- A wake after the cache's TTL has passed rewrites the parent's whole
  context. This session's requests use a one-hour TTL (the ScheduleWakeup
  tool's description says so). A side session's is one hour too: measured
  on 2026-10-16 from the transcripts, below.

## Measured (2026-10-16, session e4e49bf0)

Each session's transcript,
`~/.claude/projects/C--Users-mkilg-projects-asciibattler/<session uuid>.jsonl`,
records every API response's `usage`: `cache_creation_input_tokens`,
`cache_read_input_tokens`, and the write split by tier
(`cache_creation.ephemeral_1h_input_tokens` / `_5m_`). So a wake's cost is
read off its first response, not modelled from context and time.
`cache-gaps.mjs` here prints every response after an idle gap, marks a
cold one, and totals the session; it flagged a planted cold wake and left
a 20-minute warm gap unmarked before it read these.

| session | responses | cache written | cache read |
|---|---|---|---|
| 989537c5 (batches 4–5) | 196 | 499,876 | 65,654,979 |
| 6ea507e4 (side session, from 989537c5's card) | 157 | 448,765 | 48,259,570 |
| d7f2cfba (batch 8 + the close) | 117 | 300,452 | 26,531,903 |

- **A side session's TTL is one hour.** 6ea507e4 wrote only to the 1h
  tier, and after a 26.8-minute idle gap its next response read 488,874
  from the cache and wrote 1,307. Its two long gaps were Matthew talking
  to it after its hand-off, not stalls.
- **A cold wake at 500k writes about 500k once**, about what a whole
  session like these writes to the cache in all. Its weight against the
  session's reads depends on the price multipliers (from memory, not
  checked: a 1h write 2× base input, a read 0.1×, which makes it about an
  eighth of 989537c5's input cost). How a plan's limits count cache
  writes is unknown.

## Tried

- A Bash `cd` into any folder under the repo (2026-10-16: this folder,
  not a worktree) makes the app move the session's primary working
  directory there; a `cd` back to the repo root moved it back, with no
  note against it this time. Absolute paths avoid both.
- `detach_session` on the batches 6 to 8 session, which the user had started
  by clicking this session's proposal card: accepted. It moved to top level,
  and this session is no longer told of its turns or woken by it. So a
  session started from a clicked card counts as one the parent started.
  The description says it can't be undone from the parent.
- `start_session` with `initiation: "own_initiative"`: shows a "New task"
  card; nothing runs until the user clicks it; it expires in a week.

## Read

- `get_usage`: the account's plan limits, and any session's context fill
  as its composer shows it (read from that session's process, so an idle
  one reports unavailable). Context only; it shows no cache reads or
  writes, so it can't answer the TTL question (the transcripts can; see
  "Measured"). Tried at 23:30 UTC beside
  the context-meter mod, in one message: the mod read 542,852 and
  `get_usage` 542,901, 49 apart (which moment each counts was not
  checked). It also splits the fill by category: messages 447,764, and
  92,769 of fixed load (system tools 41,885, MCP tools 25,910, the system
  prompt 10,110, memory files 8,635, skills 6,229), which is most of the
  ~110k a session opens at. The mod still does what this tool doesn't: its
  reading rides every `git commit` result unasked, and it isn't tied to
  the desktop app.
- `list_events`: another session's recent transcript (turns and tool
  calls), paged. A parent can read a side session's whole final message
  this way, beyond the note's 400 characters.
- `get_session`: a session's metadata: model, effort, permission mode,
  branch, `parentSessionId`, `detached`, sidebar group, link.
- `send_message` (prefer `SendMessage` to a `local_…` id, or within a
  linked family a short name or `parent`): arrives in the target as a user
  turn labelled with the sender; "delivered" or "queued" behind its work.
  So a side session's message to its parent starts a parent turn, a wake.
- `SendMessage` (read 2026-10-16): the message arrives wrapped as
  `<cross-session-message from="...">`, so a session can tell it from
  Matthew's. Its description says messages "drain at the receiver's next
  tool round", that is, partway through a working session's turn;
  `send_message`'s says a queued one "runs when that finishes". The two
  disagree, and neither has been tried. Both: **a session in a different
  permission mode from the sender holds cross-session messages for its
  user's approval**, and may let them expire.
- `get_session` with `self`: a session's own id, model, permission mode
  and link. `start_session` inherits the caller's permission mode when
  `permission_mode` is omitted, and a `fresh` start requires `background`
  of at least 80 characters.
- `stop_session`: interrupts another session's turn, as its Stop button
  does; usually no prompt for one this session started.
- `set_session_model`: switches another session's model from its next turn
  on; no prompt for one this session started at the same model or a
  cheaper family. Refused for the session itself.
- `archive_session`: stops a session and cleans up its worktree;
  reversible (`unarchive_session`). "self" ends this conversation. Asks the
  user first in default mode. Archiving also archives finished side
  sessions that share its worktree.
- `create_group`, `move_sessions`: custom sidebar groups (one per phase,
  say); moving any session but this one asks the user first.

## Seen in the §123 trial (2026-10-16 to 17, driver session deb86374)

- **A message to a working session waits for its turn to end.** Sent
  14:52 with `SendMessage` to a `local_…` id, answered "queued ... runs
  it when that clears", landed in the transcript at 15:32:55, after five
  commits and the hand-off, and opened a turn there. `send_message`'s
  description holds; `SendMessage`'s "next tool round" does not, on this
  route.
- **A hand-off wakes the parent twice**: the session's own line, then
  the app's turn-end note about a minute later. A session that ends its
  turn to wait on a background task also wakes it. A turn the user drove
  in the side session sends its note at the parent's next wake.
- **The family's notes folder**:
  `%APPDATA%\Claude\side-session-notes\<parent's local id>\`; a side
  session called it "your notes folder" and left two patches there.
- **Ids**: a session's app id (`local_…`) is not the id it reports and
  files under (its scratchpad's, which is its transcript's uuid).
- **Withdrawing a card**: `dismiss_task` with the card's `task_id` hides
  it; used twice when a brief went stale before it was clicked.
- **The Bash tool turns `\\` into `\`**, even inside single quotes or a
  quoted heredoc; the Write and PowerShell tools keep both (bytes read
  back, 2026-10-17).
- **Cache**, by `cache-gaps.mjs` on the driver's transcript: 1,534,874
  written, 76,176,138 read; three cold wakes, writing 1,080,160, each
  after a pause of over an hour with no session working. A warm wake
  wrote about 1k.

## Named only

- Sessions: `hand_off_to_session` (move the task in hand into its own
  session), `dismiss_task` (withdraw an unstarted card),
  `list_start_targets`, `move_to_cloud`, `mark_chapter`.
- Session management: `list_sessions` (`{"linked": true}` for this
  session's family), `search_session_transcripts`, `export_transcript`,
  `clear_session`, `delete_session`, `unarchive_session`,
  `set_session_effort`, `set_session_fast_mode`, `set_session_output_style`,
  `set_session_permission_mode`, `set_session_title`, `set_remote_control`.
- Sidebar: `list_groups`, `rename_group`, `delete_group`, sections
  (`create_section` and the rest), `mark_completed`, `set_pinned`,
  `set_unread`, `set_view`.
- Window and view: `open_session_in` (split view), `close_split`,
  `get_window_layout`, `set_sidebar_collapsed`, `show_pane`, `close_pane`,
  `get_layout`, `set_transcript_view`.
- Also: `ListAgents` (agents and sessions by name),
  the PR tools (`ccd_pr`), `sync_with_base_branch` and the worktree tools
  (`ccd_host`), the app settings (`ccd_settings`), scheduled tasks.
