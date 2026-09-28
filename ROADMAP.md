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

**Status: §110 IN FLIGHT** (the kickoff's cut signed 2026-09-28). This
round is SPIKE-first, then spec, as 7.5 was: the shell spike informs the
store's storage adapter before its shape locks (META-ROADMAP), so the spec
is written over the spike's read, as §110's last step. No phase entries
beyond §110 exist until then. The
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
background recorder that follows, pre-registered (2026-09-28), hardened at
the kickoff: (1) a window that is never shown renders on the GPU and
records the whole composited page (the DOM overlays included) at 30 fps,
then at 60, with at most 1 % of frame slots missing over a 60-second
battle, read from the file's timestamps; (2) the file carries the game's
sound (present at its cue times) and nothing else (another app plays a
tone during the recording as the control) and nothing reaches the
speakers; (3) a battle recorded at 1080p while the user works costs
nothing they notice, judged by the user over blind stretches (none, 30,
60), with CPU, GPU and dropped frames measured.

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
(the public web channel opens at the round's close); no production byte
changes (`dist/` byte-identical across the phase, a planted string its
failing control). No snapshot bump, no RNG stream, and the fuzz smoke fires
on no step. The audit and the calls: WORKLOG §Kickoff.

- [x] **110a** — the Electron shell, kept (`shell/electron/`, plain `.mjs`; Electron a pinned devDependency; `npm run shell`): loads the production build; a JSON file under `userData`, read synchronously by the preload; the box skips the binary. Step zero: `file://` or a registered scheme. Read `none` — a value survives quit and relaunch; a fresh profile reads empty (the control). ✅ both load modes boot; the round trip holds; the box needs nothing (Electron 44 fetches its binary on first run). WORKLOG §110a.
- [ ] **110b** — the spike build (a second HTML entry, never in `dist/`): reads a planted key before the game's module graph loads, shows what it found (value · origin · threw · `persisted()`), then boots the game; plus the itch zip. Read `none`. ✅ Electron and the web both carry the counter across a relaunch or reload; `?spike-deny` reports its throw; the zip extracts identical and boots. WORKLOG §110b.
- [ ] **110c** — the hidden window: frame rate over 60 s, the WebGL renderer, the result handed to a Node script as JSON; the same under offscreen rendering. Read `none` — a shown window the rate's control; `--disable-gpu` must read as software.
- [ ] **110d** — the recording, checks 1 and 2, at 30 and 60 fps, the game's `<audio>` pools routed into the recording by a spike reach-in. Read `none` — ffprobe on the timestamps; the game's sound present; a tone planted in the page found; another app's tone absent; `isCurrentlyAudible()` false, true in a non-record control run.
- [ ] **110e** — THE SITTING: the user uploads the itch draft and reads it in Firefox and Chrome (reload · tab close · browser restart · embedded against the direct URL); check 3 over blind stretches; one clip watched. Read `stop`.
- [ ] **110f** — the spec (`round-8-spec.md`) over the answers: the adapter's shape, the video path, the probe runner yes or no; the round's phases entered here. Read `stop`.
