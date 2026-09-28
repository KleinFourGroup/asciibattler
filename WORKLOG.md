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

### The phase's oracle: `dist/` byte-identical (2026-09-28)

`vite build`, every file under `dist/` hashed (SHA-256 per file, a total
over the sorted list): two builds of `77ef1bc` agree, `7424d4b4…` over 32
files. The failing control: a planted `console.info` string appended to
`main.ts` moves the total (`f4c7314f…`); reverted, the total is `7424d4b4…`
again. §110 re-runs it at each step that touches the tree.

### 110a — the Electron shell (2026-09-28) — read `none` ✅

`shell/electron/`: `package.json` (the app's name, so `userData` is
`%APPDATA%\ASCIIbattler`), `main.mjs` (the window, the store file, the
probes), `preload.cjs` (the bridge; a sandboxed preload is CommonJS, so
one lint line is disabled with its reason). Electron 44.4.5, pinned;
`npm run shell` plays the build, and `--probe=<name>` prints one JSON line
and exits 0, 1 (a failed check) or 2 (a timeout). The preload asks main
for the file's text with a synchronous message before any page script
runs and exposes it as `window.shellStore.initial`; writes go back async,
and main writes a temporary file and renames it into place.

**Step zero: `file://` boots.** The prediction (a registered scheme would
be needed) was wrong for boot: under both `--load=file` and `--load=app`
(a privileged `app://` scheme serving `dist/`) the UI mounted (3 children
of `#ui`), the canvas sized, `document.fonts.status` read `loaded`, no
load failed, and no error was logged; the only warnings were Electron's
missing-CSP notice (shown only unpackaged) and Chromium's
`willReadFrequently` hint from the atlas. `app://` stays the default: it
gives the page a real origin (`app://game`, against `file://`), which is
the suspect for `<audio>` into Web Audio at 110d, where both are tried.

**The round trip** (each run a fresh launch): in a fresh profile the
preload saw `null`, then wrote `110a round trip 194419 ✓ ünïcode`; the
same profile relaunched read that text back; a second fresh profile read
`null`; Node, reading `store.json` directly, found the same text, and no
`.tmp` was left. Exit met.

**A premise that was wrong: the box needs nothing.** Electron 44's
package has no install script (its `package.json` lists no `scripts`), and
`index.js:21-41` downloads the binary the first time Electron runs, so
`npm ci` on the box never fetches it. The `ELECTRON_SKIP_BINARY_DOWNLOAD`
edit to the box scripts was reverted before commit; `install.js` never
reads that variable.

**For 110c:** `capturePage()` on the never-shown probe window returned a
drawn frame (the character select, DOM text and the scanlines) under both
load modes. One frame, not a rate. The window's content was 1264×681
inside a 1280×720 frame, so a 1080p recording needs `useContentSize`.

`dist/` after 110a: `7424d4b4…`, identical.

### 110b — the spike build (2026-09-28) — read `none` ✅

`shell/spike/` (disposed of at 110f): its own Vite config (`npm run
build:spike` → `dist-spike/`, gitignored; the production config
untouched), an HTML page with the game's three mounts, and `boot.ts`,
which has no static import of the game. It reads the store with no
`await` before the read (`window.shellStore.initial` under Electron,
`localStorage` on the web), bumps a boot counter, shows a panel (the
counter, the read, the write, the origin, whether it is embedded and in
what, `persisted()`, `hasStorageAccess()`; Copy puts the whole report on
the clipboard), and only then `import('../../src/main')`. `?spike-deny`
plants a throwing store. `shell/spike` joins tsconfig's `include` for the
spike's life. `main.mjs` gains a `script` probe: a JS file run in the page
as an async function body.

**Electron** (one profile, two launches): boot 1 read `null` and wrote
boot 1; boot 2 read boot 1 and wrote boot 2. `#ui` had 0 children at the
read and 3 once the game booted, so the read ran before the game mounted
anything. No error, no failed load. **The web** (the pane, `vite preview`
of `dist-spike/` on :5192): a reload carried the counter 1 → 2, and a
later reload of the final bytes 2 → 3; `persisted()` false on
`http://localhost`, `hasStorageAccess()` true. **The planted control:**
`?spike-deny` reported `SecurityError: planted by ?spike-deny` on the read
and the write, the game still booted, and the stored value was untouched.

**The zip, and a near miss.** Windows PowerShell 5.1's `Compress-Archive`
wrote the entries with backslashes (`assets\index-….js`), which an unzip on
Linux takes as flat file names. Git Bash's `tar -a` then wrote a TAR
archive under the `.zip` name (GNU tar has no zip writer): its 2,529,280
bytes, next to the build's 2,497,422 uncompressed, gave it away. PowerShell
7's `Compress-Archive` wrote 34 entries, none with a backslash,
`index.html` at the root, 1,224,738 bytes. .NET's `ZipFile` extracted it to
a tree hash-identical to `dist-spike/` (`4e24fbe2…`, 34 files), and that
tree booted in Electron (boot 1, no error). The zip is
`scratch/itch-spike-110.zip`, for 110e.

`dist/` after 110b: `7424d4b4…`, identical.
