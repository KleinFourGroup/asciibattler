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

### 110c — the hidden window (2026-09-28) — read `none` ✅

**The instrument.** `shell/electron/probes/frame-rate.js` (kept; the
recorder's exit re-runs it) waits for a live battle, reads the GPU from the
page's WebGL context (`UNMASKED_RENDERER_WEBGL`), then for 60 s counts the
page's animation frames with their timestamps and the game's own renders
(`renderTwoPass` wrapped on the live Renderer instance, since the loop
calls it through `this`). A hitch is an interval over 1.5× the median. The
page is the dev server's `?bp=board-live` (river 12×12, seed 7, the
countdown running), because the fixtures are DEV-only. A plain Node script
(`child_process.spawn` of Electron's binary) ran every configuration and
read each result from stdout with its exit code, so the hand-back question
is answered by construction. The shell gained `--url`, `--window`,
`--size`, `--frame-rate`, `--timeout` and `--switches`; a probe's shown
window opens with `showInactive()`, so it never takes focus.

| window, 1920×1080 unless noted | rate | intervals (ms) | GPU |
|---|---|---|---|
| shown, 800×450, 10 s (the control) | 59.88 fps | p50 16.7 · max 33.0 · 1 hitch | RTX 4080 SUPER |
| offscreen, `setFrameRate(60)`, 60 s | 60.01 fps (3605 paints) | p50 16.7 · p99 16.8 · max 16.8 · 0 | RTX 4080 SUPER |
| offscreen, `setFrameRate(30)`, 60 s | 30.01 fps (1806 paints) | p50 33.3 · p99 33.4 · max 33.5 · 0 | RTX 4080 SUPER |
| hidden (never shown, throttling off), 60 s | 0.98 fps | p50 1000.9 · max 1016.7 | RTX 4080 SUPER |
| hidden + three Chromium switches, 10 s | 1.00 fps | p50 1000.9 | RTX 4080 SUPER |
| offscreen + `--disable-gpu`, 10 s (the planted control) | 16.08 fps | p50 66.6 · max 100 | Microsoft Basic Render Driver |

The GPU strings are ANGLE on Direct3D 11 in full, e.g. `ANGLE (NVIDIA,
NVIDIA GeForce RTX 4080 SUPER (0x00002702) Direct3D11 vs_5_0 ps_5_0,
D3D11)`. The game's render count equalled the frame count in every row.

**What it answers.**
- **The display's rate is 59.9 Hz:** the shown window's p50 of 16.7 ms and
  59.88 fps put `Win32_VideoController`'s integer 59 at about 59.94. A
  display-tied 60 fps target would miss about 0.1 % of slots.
- **A never-shown ordinary window renders at 1 fps.** `backgroundThrottling:
  false` does not stop it, and neither do `disable-renderer-backgrounding`,
  `disable-backgrounding-occluded-windows` and
  `disable-background-timer-throttling` (each confirmed present by
  `app.commandLine.hasSwitch`). The page still reports itself `visible`.
  So "a hidden window recording its own page" fails check 1's rate as
  built; offscreen rendering is the video path left for 110d.
- **Offscreen rendering holds its rate exactly,** steadier than the shown
  window (no vsync jitter): 0 hitches at either rate, on the hardware GPU.
- **On which GPU:** the hardware one. Chromium's basic GPU info lists the
  RTX 4080 SUPER and Microsoft's software adapter (WARP) with neither
  flagged active, so the page's WebGL string is the authority; the planted
  `--disable-gpu` run reads WARP, so the probe tells them apart.
  `gpuFeatureStatus` reads `video_encode: enabled`, which bears on 110d.
- **The probe runner** is viable: a Node script gets a JSON answer and an
  exit code back from a window the user never sees. Real-time frames need
  offscreen mode; a probe that drives frames by hand, as the pane recipes
  do, would not.

**For 110d.** The live fixture's battle ended inside the 60 s (the probe's
end state read no battle), so a 60-second recording needs a longer fight.
The offscreen mode copies each frame back to main (`paint`, 1920×1080
BGRA, about 8 MB a frame), which is part of what check 3 costs.

`dist/` after 110c: `7424d4b4…`, identical.

### 110d — the recording, checks 1 and 2 (2026-09-28) — read `none` ✅ (one control moved to 110e)

**The recorder, a first draft** (kept for the recorder phase):
`shell/electron/record.mjs` pipes every offscreen `paint` (the whole
composited page as BGRA) into ffmpeg's stdin as one raw frame at the
window's rate, encoded by NVENC (`h264_nvenc`, the Gyan build lists it;
1080p60 test frames ran at 2.53× real time). `probes/record-page.js`,
run in the page by the new `record` probe, reaches into the live game by
the dev convention: every pooled `<audio>` element (`__game.audio.pools`)
goes through an `AudioContext` into a `MediaStreamAudioDestinationNode`
and never to `ctx.destination`; a `MediaRecorder` records it (Opus);
every `play(key)` is logged; eight DOM squares above the scanlines show the
page's frame count mod 256, and a ninth is white while a planted 3150 Hz
tone plays (0.5 s, 3 s in). The page then fights (`playback.resume()`, the
Fight-now signal). Main muxes the audio in afterwards.
`probes/analyze-recording.mjs` reads only the finished `.mp4` through
ffprobe and ffmpeg's decoders: frame continuity from the marker's pixels,
the tone by a Goertzel filter, each logged cue looked up in the file's
audio (heard if the next 150 ms reaches −45 dBFS).

**Check 1's instrument, changed within its intent:** the charter said
"read from the file's timestamps", but a raw pipe at a fixed rate stamps
every frame uniformly by construction, so the timestamps cannot show a
drop. The marker can: a count that steps by 2 is a frame that never
reached the file, a repeat is a duplicate, and its presence proves the
DOM layer is in the video.

**Two probe bugs, found on the way.** Calling `countdown.skip()` from
outside left playback paused forever (the handover to playback runs only
inside `BattleScene.tick`), so no battle ended; the Fight-now signal is
an unpause. And the first mux put the audio 433 ms ahead of the video.
Both processes' clocks agree with the wall clock within 1 ms (main 0.76,
page 0.90), so it is not skew: a paint reaches main about 0.4 s after the
page drew it. The fix aligns by content: the first video frame showing
page frame 1 is where the audio starts. After it the offset read −35 ms
(one frame at 30).

**The battle:** timed with the countdown skipped, live 21.3 s, quarry
31.0, big24 34.4, wade 49.8, corridors 64.7. Corridors (12×32) is the
60-second fight; each recording ran it plus a 2 s tail.

| | 1080p30 | 1080p60 |
|---|---|---|
| frames in the file (ffprobe) | 2023 | 4025 |
| marker slots · missing · duplicates | 2005 · 0 · 0 | 4007 · 0 · 0 |
| paint arrival in main, p99 / max | 44 / 77 ms | 26 / 53 ms |
| late arrivals (over 1.5 slots) | 8 | 84 |
| ffmpeg input backlog, peak | 149 MB | 265 MB |
| game cues heard in the file | 128 / 128 | 128 / 128 |
| the planted tone, peak / floor | −13.4 / −141 dB | −13.4 / −142 dB |
| audio to video (tone onset − flash frame) | −35 ms | −34 ms |
| `isCurrentlyAudible()` true | 0 of 259 | 0 of 261 |

The AudioContext ran without a gesture (`running`; Electron's default
autoplay policy) and no `play()` was refused. Paint arrival jitters, but
not one content frame was lost at either rate: **check 1 passes at 30 and
at 60.** A frame at 20 s (viewed) shows the board, the glyphs, the HP bars,
the level badges, a `Miss` hitsplat, the HUD panes, the scanline rake and
the marker. It also shows the board explorer's panel, which a recording
should start hidden.

**Check 2, the parts answered here.** The game's sound is in the file (every
cue heard); the planted in-page tone is found; nothing reached an output
stream (0 audible samples in both runs). **The positive control:** the page
playing normally but muted (`setAudioMuted`, so the machine stays silent)
read audible in 55 of 83 samples, so the instrument can say yes. And a
recording made muted still carried every cue (92 of 92) and the tone, so
the recorder can mute its page as a second guarantee.

**Moved to 110e, the user's sitting:** the outside-app tone. It plays
aloud on the user's machine, so it runs when they are there to hear it,
and their hearing it is the known answer that it played. The band: the
game's own sound peaks at −24 dB at 1700 Hz but stays at or under −46 dB
at 2500 Hz (p99 −52) and under −54 dB from 5 kHz up (50 ms Goertzel
windows over the 60 fps recording). So 2500 Hz, judged as sustained energy
over the tone's known window, not a peak.

**For the recorder phase:** a backlog of 265 MB at 60 fps means main needs
backpressure before long runs; alignment needs the marker, or a marker
shown only for a lead-in that is trimmed off; the explorer panel starts
hidden in recordings.

`dist/` after 110d: `7424d4b4…`, identical.

### 110e — the sitting, prepared (2026-09-28) — the `stop` is open

**No server needed.** `vite build --mode development` alone still builds
with DEV off (the same hashed bundle as production); with
`NODE_ENV=development` set as well, the build keeps the explorer's chunk.
Loaded from that static build, the record path works under both origins:
`app://` heard 93 of 93 cues, `file://` 92 of 92, no frame missing. So
routing `<audio>` into Web Audio does not go silent under `file://`, the
suspect named at 110a. The sitting records from that build
(`?bp=board-<id>_hide-1`, the explorer panel hidden), so a dev server the
desktop app might stop between turns cannot break it.

**The tools** (one-off, in the repo's gitignored `scratch/110e/`):
`check3.mjs` runs three 160 s stretches 30 s apart at fixed clock times,
in a shuffled order the user is not told (none · 1080p30 · 1080p60; the
order goes to a file read only after the user's notes), sampling the
machine's CPU (Node's `os.cpus` deltas), the Electron and ffmpeg trees
(`sampler.ps1`, `Get-Process` deltas: a `Get-Counter` call took 1.0–1.7 s
each and a long-lived query would miss processes started mid-stretch) and
the GPU with its encoder (`nvidia-smi`, read from stdout, since `-f`
buffers and a kill loses the file); recordings are analyzed only after the
last stretch. `tone-run.mjs` records the live fight while PowerShell's
`SoundPlayer` plays a 2 s, 2500 Hz tone aloud, then runs the analyzer's
new `--outside` test: the share of 50 ms windows in the tone's span whose
band power reaches −50 dB. Its known answers: a 2500 Hz span with no
outside tone reads 0 %, and the planted 3150 Hz tone, found through the
same clock-to-file conversion, reads 100 %.

**The dry run** (90 s stretches): CPU 19.8 % with no recording, 25.0 % at
30, 28.3 % at 60; the Electron tree 2.0 % and 3.7 % of the machine, ffmpeg
0.9 % and 1.5 %; with no recording the GPU already sits at 17–29 % (peaks
near 61 %), the user's own load. One 60 fps recording had 1 duplicate in
4011 slots. **A finding:** one 30 fps recording heard 124 of 128 cues; the
four were all `healtick` (125 ms, sound from the first sample, so no
leading silence), three sounding 150–400 ms late and one never. The other
seven recordings heard every cue. Whether the game's `<audio>` pools start
late under load in normal play too, or the capture adds it, is unmeasured;
the analyzer now counts late cues apart from lost ones. It bears on the
settings' volume split, which is natural in Web Audio.

**The clip:** `scratch/110e/clips/corridors-1080p60.mp4` (27 MB), the
corridors fight with the panel hidden: 0 of 4003 slots missing, 128 of 128
cues on time, audio to video −18 ms. At 20 s its frame matches the earlier
60 fps recording's (the same `Miss` in the same place).

### 110e — THE READ (2026-09-28 → 29, the user's) ✅

**The clip** (the user): "Visually it looks great." Three notes. (1) The
first frame is the pre-turn screen: viewed, it shows the pre-turn cards
mid-fade under the battle's `5` countdown, since the fixture enters the
battle about a second before recording starts and paints reach main about
0.4 s late. (2) The sharp beep near 4 s is the planted tone. (3) The audio
"a tad off" although single actions look aligned: after the content
alignment the sound lands 18–35 ms early, while live play puts it slightly
late (the output device and `<audio>` add their own delay), a relative
shift the session estimates at about 50 ms, unmeasured. The user asked for
an A/B by ear in the recorder phase.

**Check 3, blind** (09:09–09:18, 160 s stretches; the order revealed after
the user's notes: A 1080p30, B 1080p60, C none). The user noticed no lag
and no sound in any stretch; a very faint fan hum ran through all three,
C included, so it is not the recorder's.

| | C, none | A, 30 fps | B, 60 fps |
|---|---|---|---|
| machine CPU, mean / p95 | 17.5 / 21.4 % | 24.8 / 31.7 % | 30.0 / 35.9 % |
| Electron tree + ffmpeg, share of the machine | 0 | 2.4 + 0.7 % | 4.2 + 1.9 % |
| GPU, mean | 21.9 % | 24.1 % | 19.7 % |
| GPU encoder, mean | 0 | 4 % | 6.6 % |
| Electron memory, peak | — | 1.0 GB | 1.3 GB |
| recordings | — | 2 × (0 missing, 128/128 on time) | 2 × (0 missing, 128/128 on time) |

The machine's CPU rises more than the two process trees account for
(+7.3 and +12.5 points against 3.1 and 6.1), which the session did not
trace. The GPU cost is lost in the user's own load. **Check 3 passes at
both rates; 60 fps is viable.** (The user's later "16 % pegged" was a
frozen Task Manager; restarted, it read normal.)

**The outside tone:** PowerShell's `SoundPlayer` played the 2 s, 2500 Hz
tone at 09:37:59 during a recording. The user heard the beep and nothing
else, the known answer that it played and that the game played nothing
aloud; in the file, 5 % of its 50 ms windows (2 of 40) touched the band,
the game's own transients, against 100 % for the planted tone. **Check 2
is complete.**

**The itch draft, Firefox 156** (embedded in page, 1280×720, a draft on
`kleinfourgroup.itch.io`): boot 4 read boot 3, so the store survived a
reload, a closed tab and a browser restart. The game's origin is
`https://html-classic.itch.zone` (the href `/html/19467267/index.html?v=…`,
the `v` changing per upload); `hasStorageAccess()` false, `persisted()`
false, quota 10 GB. The direct href read boot 1: **Firefox partitions the
iframe's storage by the top-level site**, so a save made on the itch page
is absent when the game opens any other way. The estimate counted 6.4 MB
already in use against our ~100 bytes: itch serves every HTML game from
that one origin, so the store shares its budget and key space with every
itch game played in the browser (inferred from the number and the URL
shape). **Chrome is deferred** (the user's call, 2026-09-29; Chrome is not
installed): the draft is read in Chrome at the round-close browser smoke,
which needs Chrome anyway, together with the pre-registered days-later
re-open. From memory, Chrome partitions the same way, and the store's
design does not change if it does not.

### Inputs to 110f, the spec

- **The adapter can be synchronous in all three shells:** `localStorage`
  on the web and in itch's iframe; the preload's synchronous hand-over
  under Electron. So the boot shape can stay a first static import.
- **The web store's constraints:** keys namespaced, saves small, a quota
  error meaning "cannot save", an empty store at any boot a new player
  (Safari unverified; itch's partitioning; the shared itch origin).
- **The recorder:** offscreen rendering, 30 or 60 fps (both pass 1–3);
  backpressure in main (265 MB peak backlog at 60); the lead-in trimmed,
  aligned by content, the marker shown only for that lead-in; the planted
  tone out of real recordings; the explorer panel hidden; the page muted
  as a second guarantee; the audio-offset A/B; ffmpeg as a system install
  so far (the kickoff's call, reopened at the recorder's kickoff); the
  heal-tick late/lost measurement (normal play against recording).
- **The probe runner** is viable in offscreen mode.
- **Deferred and held here:** Chrome's itch read and the days-later
  re-open, at the round-close browser smoke; Electron's CSP warning
  (unpackaged only) for Round 12's packaging; `shell/spike/` (and its
  tsconfig entry) disposed of at 110f.

### 110f — the spec, drafted (2026-09-29) — the `stop` is open

Session 8bafaa37. [round-8-spec.md](round-8-spec.md): the intent in the
user's words, nine things the spike settled, ten decisions (D1–D10),
scope guards, exit, marked uncertainty, and §111–§118 entered in ROADMAP,
unsigned. The decisions came out of a conversation in four turns: the
session posed the charter's decision points, its own calls and twelve
blind spots, each with a lean, and the user signed them item by item. The
spike build is disposed of (`4ae0730`); `dist/` hashes to `7424d4b4…` over
32 files before and after, the phase's known answer.

**The user's calls (2026-09-29), with the alternatives not taken:**
- **What a save is rejected on:** the save format or a failed load (B).
  Not taken: any build change (A), which ends every run in progress at
  every upload; the format or the balance (C), since `configHash()` hashes
  every config file, the bot's `fuzz-strategies.json` included, so a
  change no player sees would wipe saves. What decided it: most round
  uploads change the format anyway, so A and B differ on hotfix uploads,
  the ones strangers are mid-run for.
- **Saving:** "rogue like style no manual saves"; one slot; closing
  mid-battle resumes before the battle with the fight seen, a knowledge
  edge accepted.
- **Volume:** three levels stored, a slider only where there is sound.
  **The palette:** on reload.
- **Escalation:** a ladder, not a menu of modifiers, because a menu's
  combinations multiply past what the box can check (ten switches make
  1,024 settings); progress per character; five levels, whose table the
  user wrote; the picker hidden until level 1 is unlocked; upward only.
  The name: Escalation over Overclock, Threat and Ring. The user loved
  Ring (CPU protection rings counting down to the kernel, and Dante's
  circles), but it is too clever for a general audience, and a ladder
  that counts down confuses.
- **The session's points, signed:** seeded runs count toward nothing; the
  menu's rows; the Electron runner, yes; the recorder's calls (ffmpeg a
  system install noted in the README, a gitignored `clips/`, 60 fps for
  battles); telemetry as a downloaded `.json` ("they can send it wherever
  they want"; the itch boards for now); the version from `0.1.0`, not
  `0.8.0`, because players read 0.8 as nearly done and a `.5` round has no
  number of its own.
- **The twelve blind spots,** each proposal signed as written: store
  sections with their own read policies; the itch store as best-effort,
  with an export and import as the backup; the journal's size measured
  before the budget; journal segments at every load; `-dirty` builds;
  dev entry points skip the menu; recordings from a fresh pinned profile;
  the kit's criteria per pane session; the two-tab lock; the ESLint guard;
  the palette's numeric check; wall-clock stamps in the journal.
- **The first ten minutes** are in the spec's Intent, in the user's words.

**The wave lever under the casualty rule** (the user raised it). Checked
against the code:
- `resolveTotalCount` scales the count before rounding (`wave.ts:203-206`);
  the level budget is resolved without the count (`:246-249`) and spread
  over the wave (`:174-176`), so a larger count spreads the same levels
  thinner, and most bodies are worth one point of enemy morale (DESIGN).
  BALANCE's caveat names the trade (`BALANCE.md:537`). No measurement of
  the lever under the casualty rule was found: BALANCE's sweeps of it date
  from Phase X, and `archive/post-88-worklog.md` never mentions it.
- The rounding, over the 34 authored waves in `config/encounters.json` (a
  scratch count mirroring `resolveTotalCount`): at a hand of 6, +10% adds
  one enemy to 28 waves and none to 6; at 5, one to 16 and none to 18; at
  4, one to 20 and none to 14. At +20% and a hand of 6: 2 unchanged, 17 +1,
  15 +2 or more. `DECK.handSize` is 6, and a wave's hand is the smaller of
  the team size and the effective draw (`Run.ts:2863`).
- 5 of the 34 waves carry a `levelCap`, where the budget lever can
  saturate (`wave.ts:243-245`).
- The bits lever scales every earn at the settle, multiplied with the
  `bitsGain` fold (`Run.ts:2418-2420`), so it is clean under casualties.

Signed ("I enthusiastically sign"): the wave lever raises the count, the
level budget and the enemy's pool together. The fallback not taken:
−10% of the player's morale (40 → 36), smooth and strictly harder but not
visible on the board. A repeated lever adds (the user). Different levers
multiplying is the session's reading, proposed in the spec, so that the
wave lever never changes a body's strength.

**Step zero, what writing it checked against the code:**
- ✔ `Run.fromJSON` rejects on `RUN_SCHEMA_VERSION` and throws on unknown
  daemon and character ids (`Run.ts:4290`, `:4344-4358`).
- Tests pin the version's number (`Run.test.ts:2988` and four more).
  Searches of `snapshot-roundtrip.test.ts` for key-set pins, and of the
  tests for a shape fingerprint, found none, so D2's guard is written as
  new; a search is not proof of absence, and §113's step zero looks again.
- ✔ `configHash()` exists (`src/dev/configHash.ts`) over every
  `config/*.json`.
- ✔ The only `localStorage` user in `src/` is the DEV trace ring
  (`asciibattler:traces:v1`, `src/dev/traceStore.ts:15`).
- ✔ An element's volume is the master level × the key's level
  (`AudioPlayer.ts:248`), so the volume split is one more factor.
- ✔ The three per-run multipliers are `DifficultyMultipliers`
  (`difficulty.ts:132-136`).

**THE STOP — the read (the user's):** the spec as written, especially
D8's stacking reading (the one line not yet signed), and the eight phase
entries in ROADMAP. On the signature, §110 closes.

### 110f — THE READ (2026-09-30, the user's) — SIGNED; §110 ✅ CLOSED

"Signing everything! 😁" The spec, D8's stacking reading and §111–§118
are signed as written. On the stacking, the user: "I'm not the biggest fan
of mixing additive and multiplicative levers, since it's not intuitive to
the mathematically illiterate general audience, but these are placeholders
anyway, and this is probably one place where the player doesn't need to
see the percentages". So the table's numbers are placeholders, and the
player-facing text describes each level without percentages (the spec,
D8). **§110's exit, met:** every question answered by an observation in
its shell (110a–e), and the spec written over them and signed (110f).

The draft's commit, `f19b0ed`, is in git with this session's message, 16 s
after its doc-cap test, but the call is not in the transcript the session
can see, and that turn ended with no summary to the user. Checked (author
time, message, a clean tree) before building on it; a papercut is filed.

The user asked whether §111's kickoff runs in this session or a fresh one.
The session recommended a fresh one: everything this session learned is in
the spec, this log and the Cursor, and the kickoff's audit covers code this
session never opened (`shell/electron/record.mjs`, the probes,
`AudioPlayer`'s pools), where a cold read is what the audit wants.

## Phase 111 — the background recorder

### The §111 audit and cut (2026-09-30) — the shape-lock is open

Session 01995ce0. The recorder's code is as the spike left it: the last
commit to touch `shell/electron/` is `41150a6` (110e's prep) and the last
to touch `src/audio/` is `dad6bb3` (§104d). ✔ = read by this session at
file:line.

**What is there.**
- The recorder is one probe inside the shell (✔ `main.mjs:219-273`,
  `--probe=record`), a page script (✔ `probes/record-page.js`) and the
  ffmpeg side (✔ `record.mjs`). It is still a test rig: the frame marker
  runs for the whole recording (✔ `record-page.js:85-94`), the planted tone
  plays 3 s in (✔ `:112-122`), the page is muted only when `--muted` is
  passed (✔ `main.mjs:298`), the profile is the shared
  `%APPDATA%\ASCIIbattler` unless `--profile` is given (✔ `main.mjs:56-57`),
  and main buffers every paint ffmpeg has not taken yet, without a limit
  (✔ `record.mjs:59-61`; `writableLength` is only recorded).
- **Inputs today: a URL.** The fixtures are `?bp=board-<id>`, six boards
  (✔ `fixtures.ts:30`), each a set of the shipped run dials (✔
  `fixtures.ts:48-49`) entered by two dispatches after boot (✔
  `boot.ts:60-61`). A seed is the same dials with another `seed=`; with no
  `bp=board-` nothing enters the battle, so the recorder makes the two
  dispatches itself.
- **The audio seam.** The page script routes every element of
  `AudioPlayer`'s private `pools` (✔ `AudioPlayer.ts:212`, four per key)
  and wraps `play` to log the cues (✔ `record-page.js:40-58`). Nothing
  checks that the seam is still there: a missing `pools` throws, but a
  renamed `play` logs no cues, and the analyzer's "every cue heard" then
  reads 0 of 0.
- `AudioPlayer.setMuted` returns before a cue sounds (✔
  `AudioPlayer.ts:240`), so the recorder's muted page must stay
  `webContents.setAudioMuted`, which 110d showed still records every cue.
- **The build.** Recordings come from a static development-mode build
  (110e), made by hand; no npm script makes it (✔ `package.json`).
  `shell/` is outside tsc (✔ `tsconfig.json`) and no test covers it; the
  analyzer is its oracle. Tests run under Node with no `Audio` global (✔
  `vite.config.ts:131`), so a pin on `pools` needs a stub.
- **ffmpeg** on the PATH is 9.0.2 (the Gyan full build) with `h264_nvenc`
  (✔ `ffmpeg -encoders`). The README names no external requirement (✔).

**Hypotheses for step zero** (from memory, unmeasured):
- **The clip's colours.** ffmpeg converts BGRA to yuv420p with BT.601
  coefficients unless told otherwise and tags nothing, and most players
  decode untagged HD video as BT.709, which would shift saturated colours
  slightly. The palette is the game's identity and §116 checks a
  colourblind palette, so colour patches planted in the lead-in and read
  back from the file decide it.
- **A frame-exact trim.** A stream copy cuts only at keyframes, so the trim
  is either a re-encode or main piping only from the first frame after the
  lead-in (it can read the marker from the bitmap it already holds).
- **Before/after** needs a build per commit: a temporary worktree with the
  main tree's `node_modules` linked in, if Vite builds there.
- **A full run's audio** would cross to main as one base64 string at stop
  (✔ `record-page.js:137-142`): fine for a battle, a landing note for full
  runs (§114).

**Decision point 1: where record mode lives.** (a) The reach-in, as now:
the recorder's page script, injected into whichever build it records. It
ships nothing, and it works on both sides of a before/after pair, including
commits older than §111. It is untyped. (b) A typed DEV module in
`src/dev/`: typechecked and tree-shaken, but a commit older than it has
none, so it can't be the "before" of a pair. (c) Record mode in
`AudioPlayer`: typed and tested in place, but it ships bytes for a dev tool
(the spec's scope guard) and has (b)'s problem with older commits. The
session's lean is (a), with the guard moved onto `npm test`: a pin that
builds an `AudioPlayer` over a stubbed `Audio` and checks that `pools`
holds every key's elements and that `play` is on the prototype, plus a seam
check at record time that fails the recording loudly. What neither sees: a
new sound path outside `pools` (music, `plans/music.md`) would be missing
from recordings without an error, so music's phase routes it (a TODO line).

**Decision point 2: the audio offset.** The spike's residual (−18 to
−35 ms) was measured on the planted tone, which is scheduled on the audio
clock and bypasses `<audio>`. The game's cues go through `<audio>`
elements, whose start latency is their own and varies (the late
heal-ticks). So the cue offset is measured per cue first (its onset in the
file against the frame that drew its `play()`), which tells a fixed offset
from jitter, and the A/B by ear is centred on it. The offset is applied at
the mux, so each A/B variant is a re-mux of one recording, seconds each.

**Scope readings.** Events arrive with full runs: an event shows nothing
until choices are made, and the journal supplies them. "A seed" is the
root battle of that seed under the fixtures' character and roster, with
any run dial overridable.

**Predictions for the cut.** No snapshot bump, no RNG stream, no config
change. No step stages `src/sim|run|core|config|bot`, `config/` or
`tests/fuzz`, so the fuzz smoke fires on none. `dist/` stays byte-identical
(`7424d4b4…`, re-hashed at each step that touches `src/`; under (a) that is
only the pin and a comment beside `pools`).

### The §111 shape-lock (2026-09-30, the user's) — SIGNED

The cut is signed as proposed: six steps, four `none`, one `batch` (111d,
read at 111f), one `stop` (111f). The user's calls:
- **Decision point 1:** deferred to the session ("whatever gives us the
  most robust recorder"). ✅ DECIDED: the reach-in. Its failures are loud
  (the pin on every `npm test`, the seam check at record time), and it is
  the only option that records both halves of a pair whose "before" is
  older than the recorder's own change.
- **The A/B** is one file with labelled sections.
- **The exit's pair** is `c4ca4e6^` (the last perspective board, before
  §107d shipped the projection) against HEAD.
- **The context handoff number** stays 350k. The user noted that the
  phase's first stop is its last step, so the number can't act at a stop,
  and proposed a clock instead: the session notes the time each step
  finishes and pauses for the meter at the first step boundary an hour
  after the sign (09:45), or mid-step if one step runs an hour. The clock
  overcounts context during real-time recordings, which errs early.
