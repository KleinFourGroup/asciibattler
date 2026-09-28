# ROADMAP — Round 8 (Foundations), post-§109

The active PLAN (it stays a plan for its whole life). The macro order is
[META-ROADMAP.md](META-ROADMAP.md) (Round 7.5 The Board ✅ CLOSED
2026-09-27; Round 8 — Foundations is NEXT, re-audited at that close);
findings + rationale land in [WORKLOG.md](WORKLOG.md); live status is
HANDOFF's 🧭 Cursor. Sub-steps are cut at each phase kickoff (AGENTS "The
planning stack"), never here, and each cut step declares its read (`none`
· `batch` · `stop`; AGENTS "Reads are cut, not improvised", kept at the
7.5 close). Prior round's plan:
[archive/post-104-roadmap.md](archive/post-104-roadmap.md) (Round 7.5)
with its worklog and spec beside it; before it
[archive/post-94-roadmap.md](archive/post-94-roadmap.md) (Round 7).

**Status: AWAITING THE ROUND 8 KICKOFF.** This round is SPIKE-first, then
spec, as 7.5 was: the shell spike informs the store's storage adapter
before its shape locks (META-ROADMAP), so the spec is written over the
spike's read. No phase entries beyond §110's charter exist until then. The
charter, the decision points, the exit and the scope guards are in
META-ROADMAP §"Round 8 — Foundations"; the re-audit behind its 2026-09-26
amendment is [archive/post-104-worklog.md](archive/post-104-worklog.md)
§"The Round 7.5 close", C1.

## Phase 110 — the shell spike

Charter: run the build in both shells it must persist in, in one session,
before the store's shape locks. Under Electron, write a file under
`userData` and read it back. On the web, upload the build as a private
itch.io draft and check that `localStorage` survives reloads inside itch's
iframe (itch serves HTML5 games from its own CDN domain, and Safari may
clear site storage after a stretch without a visit: both unverified). In
each shell, read the store at boot, before the first module that bakes
from it: the locale resolves at catalog load and reloads the page to
switch (`src/i18n/locale.ts`), and a reload-time palette would do the
same. For Electron, one more question: can a hidden window, with
background throttling off, run the frame loop and hand a probe's result
back to a Node script, and on which GPU? And three checks for the
background recorder that follows, pre-registered (2026-09-28): a window
that is never shown renders at the target rate on the GPU and records it;
the file carries the game's sound and nothing else (another app plays a
sound during the recording as the control) and nothing reaches the
speakers; a battle recorded at 1080p30 while the user works costs nothing
they notice (CPU and dropped frames measured, the eye tracker judged by
the user).

**Why first:** the store is the round's keystone, and its storage adapter
has three cases (`localStorage` on the Pages site · the same inside itch's
iframe · a file in Electron); the spike's answers are what the adapter is
shaped from. **Depends on:** Round 7.5 (✅). **Risk:** low to build (one
session, META-ROADMAP); its answers set the adapter's shape and decide
whether an Electron probe runner joins the pane probe kit this round.
**Decision points:** none of its own; the boot-read answer bears on the
round's palette swap (on reload, as the locale does, or live). **Exit:** each
question answered by an observation in its shell, recorded in the WORKLOG;
then the round's spec is written over them. **Scope guards:** the store's
shape locks after the spike, not before; the itch draft stays private
(the public web channel opens at the round's close). The kickoff hardens
this entry against the code.
