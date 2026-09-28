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

### The §110 audit and cut (2026-09-28, user-signed)

Session 18ece58f. The round's charter was re-audited two days earlier (the
7.5 close, C1) and no code has changed since (`git log 944677c..HEAD` on
`src`, `config`, `tests`, `scripts` and `package.json` shows two docs
commits), so this audit covers only §110's surfaces. ✔ = read by this
session at file:line; claims about Electron, itch or browser storage are
from memory and are what the spike checks.

**What moved in the charter:**

- **The video is the composited page, not the canvas.** The HP bars,
  hitsplats and badges are DOM (✔ `UnitOverlayLayer.ts:10-24`), and so are
  the HUD and the scanline rake (✔ `index.html`: `#ui` and `#scanlines`
  over the canvas). `canvas.captureStream()` would drop all of them. Both
  paths the charter names composite the page; check 1 now reads the DOM
  layer in the file.
- **Check 2 gains a positive half.** A window that is never shown never
  gets a user gesture, so the autoplay policy may refuse `play()`, and
  `AudioPlayer.play` swallows the rejection (✔ `AudioPlayer.ts:250-253`):
  a silent file with no error. There is no `AudioContext` yet (✔ grep), so
  the routing is new either way. The check asserts the game's sound is in
  the file, and a tone planted inside the page's stream is the analyzer's
  known answer.
- **The boot read sharpens to: is the read synchronous in all three
  shells?** `main.ts` statically imports `Game` (✔ `main.ts:10`), whose
  graph runs the ten config loaders' `loadProse` at module evaluation (✔
  `src/config/*.ts`, the seam at `locale.ts:137-146`), so `main.ts`'s body
  already runs too late. A synchronous read keeps the boot's shape (one
  static import placed first); an asynchronous one makes `main.ts` a
  bootstrap that dynamic-imports the game. Nothing sets a locale in
  production (✔ `setActiveLocale` has no caller outside tests; `locales/`
  holds `en` only), so the spike reads a planted key.
- **"On which GPU":** the machine lists one adapter (✔
  `Win32_VideoController`: NVIDIA GeForce RTX 4080 SUPER, 2560×1440, a
  reported refresh of 59). The question is hardware against software
  rendering, so `--disable-gpu` is the probe's planted control.
- **The itch bar:** a reload, a tab close and a browser restart, in Firefox
  and Chrome, plus the embedded game against its direct URL (browsers
  partition an iframe's storage by the top-level site, from memory), plus
  a re-open of the draft at the round's close for a days-later read at no
  cost. Safari stays unverified (no Apple device), so the store treats an
  empty store at any boot as a new player.
- **The target rate becomes a number** (the user's call 4): 30 fps, then 60,
  at most 1 % of frame slots missing over a 60-second battle. The reported
  59 Hz is an integer; if it is 59.94 and the loop follows the display, 60
  misses about 0.1 %, and if it is 59.0 it misses 1.7 % by construction,
  a finding about the display, not the recorder. 110c's shown-window
  control reads the real rate. 60 roughly doubles the encode work, so
  check 3 runs blind stretches (none, 30, 60, in an order the user is not
  told).
- **It is not one session:** the user's hands are needed once, at 110e.
- **Step zero of 110a:** whether `dist/` boots from `file://` or needs a
  registered scheme. The suspects: module scripts carrying `crossorigin`,
  the font load, and `<audio>` into Web Audio (a cross-origin media element
  feeds silence). It bears on check 2.
- **The box:** `npm ci` runs in `scripts/box-setup.sh:40` and
  `scripts/box-batch.sh:92` (✔), so an Electron devDependency would fetch
  its binary there; `ELECTRON_SKIP_BINARY_DOWNLOAD=1` goes into both.

**The calls (the user, 2026-09-28):** (1) the shell is kept in the repo,
`shell/electron/`, plain `.mjs` (Electron runs JavaScript, and TypeScript
would add a build step; the recorder's kickoff audits it like any other
code); the instruments the recorder's exit re-runs live beside it, one-off
probes go to scratch. (2) Electron as a devDependency. (3) ffmpeg installed
by the user (winget `Gyan.FFmpeg`; ✔ `ffprobe` 9.0.2 on the session's
PATH): ffprobe is the independent reader of the files, so the recorder
does not grade its own output; whether the recorder itself needs ffmpeg
waits for its kickoff. (4) 30, then 60. (5) The spec is §110's last step,
as 106e was. (6) The context handoff number stays 350k.

**The cut:** ROADMAP §110, six steps: four `none`, two `stop` (110e the
sitting, 110f the spec).

## Phase 110 — the shell spike
