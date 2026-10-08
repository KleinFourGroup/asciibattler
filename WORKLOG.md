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

### 111a — the front door (2026-09-30) — read `none` ✅

**Step zero.** A development-mode build of the working tree
(`NODE_ENV=development`, `vite build --mode development`) takes 338 ms by
Vite's count, so the recorder builds fresh every time and keeps no cache.
The spike's record probe, unchanged, at HEAD on corridors at 1080p60: 0 of
4012 slots missing, 128 of 128 cues on time, audio to video −18 ms, 0 of
261 audible samples, the backlog peaking at 207 MB. The path works before
anything changes.

**Built.** `npm run record -- --board=<id>` or `--seed=<n> [--dials=…]`
(`shell/electron/record-cli.mjs`): ffmpeg, its NVENC encoder and ffprobe
checked at start with the fix named; the build made into a temp dir and
checked for its `boardPanel` chunk (only a DEV build has one); a fresh
profile per recording, deleted after with the build; the page muted; the
panel hidden; a seed's root battle entered by the page script's two
dispatches (`--enter`) under the fixtures' character and roster; the clip
and a sidecar into `clips/` (never overwritten: a taken name gets `-2`),
then the analyzer run on the delivered file. The page script checks every
name it reaches and fails by name; a battle that logs no cues fails the
recording. The music plan gained the requirement that music route into the
recorder (`plans/music.md` item 6), since its planned Web Audio player
sits outside `pools`; that is its home rather than TODO.

| through the front door | seconds | slots missing | cues heard | audio to video | backlog peak |
|---|---|---|---|---|---|
| `--seed=12` | 45.9 | 0 of 2733 | 107 of 107 | −18 ms | 257 MB |
| `--board=corridors` | 67.3 | 0 of 4016 | 128 of 128 | −18 ms | 191 MB |

A frame of the seed clip at 10 s shows the battle with the panel hidden
(and the marker, until 111b). No `asciibattler-rec-*` directory was left
in the temp dir.

**The controls.**
- The pin (`AudioPlayer.test.ts`, "the recorder's seam"): with `pools`
  renamed, the test fails and `tsc` reports `Property 'pools' does not
  exist`; restored, it passes.
- The record-time check, through the `script` probe on the live corridors
  fixture: unplanted, it passes with 100 elements (25 keys × 4); with
  `pools` removed it fails with `seam moved: AudioPlayer.pools`, and with
  `play` removed, `seam moved: Game.audio / AudioPlayer.play`.
- `--board=nosuch` fails with the fixtures hint, exit 1.
- **Not controlled:** the "no cues logged" failure. It is one filter in
  main, and planting a battle with no cues needs a hook the recorder
  doesn't have.

`dist/` after 111a: `7424d4b4…` over 32 files, identical (the only `src/`
change is a comment beside `pools`). ESLint is clean on `shell/electron`
and `src/audio`.

### 111b — the clean clip (2026-09-30) — read `none` ✅

**Step zero: the colours (a hypothesis from the audit, confirmed).** Ten
known sRGB patches in synthetic BGRA frames, through the recorder's own
ffmpeg arguments, decoded as players decode untagged HD video (BT.709,
limited range): the team green `#33FF00` read `37,219,0` (36 levels off),
magenta 37, purple 29, cyan 23, red 19. ffmpeg's own default decode
(BT.601 when untagged) read them within 3, which is why the spike's clip
looked right in any check that used ffmpeg to read it back. Converting
with an explicit BT.709 matrix brings every patch within 2 under both
decodes; `setparams` on the frames is what gets the primaries and the
transfer tagged as well (the encoder options alone tagged only the matrix
and the range).

**Built.** The lead-in: about half a second (`max(10, fps/2)` page frames)
of the frame marker and a row of nine colour patches, then the go frame,
one animation-frame callback that hides them, starts the audio recording
and releases the fight. A clean clip is gated in main: nothing is written
until a paint without the magenta patch, so the file opens on the go
frame, and neither the lead-in nor the pre-turn screen before it reaches
the file. `--check` records the analyzer's twin: the lead-in kept, the
marker all through, the planted tone. The encode is BT.709, all four
fields tagged. The analyzer reads both kinds and decodes the colours with
the file's matrix tag, or BT.709 when there is none.

**The audio's placement.** Placed by §110d's convention (the audio one
frame before the frame showing its callback's change), the planted tone
read 34 ms early, not 18: the spike started the audio just before a
callback, and the go frame starts it inside one. Placed on the go frame
itself, it reads −18 ms again, and a clean clip needs no audio trim.

| corridors, 1080p60 | the check twin | the clean clip |
|---|---|---|
| frames | 0 of 4036 missing | 4012, lead-in frames in the file: 0 |
| cues heard | 128 of 128, none late | 128 of 128, none late |
| audio to video (the tone) | −18 ms | (no tone) |
| colours, decoded as a player | within 2 (tags bt709 ×3) | the same encode |
| colours in Chromium's own paint | exact, all nine | — |
| backlog peak | 191 MB | 75 MB |

**Frame-exact, two readings.** In the check twin the patches show on
frames 2–46 and the marker reads the go count on frame 47, the first
frame without them; the clean clip's gate held exactly 47 paints. The
lead-in detector's known positive is the check twin: 4022 marker-like
frames and 45 patch frames, against 0 and 0 in the clean clip.

**What the clean clip opens on** (viewed): the board, the HUD and the
parked countdown box ("BATTLE BEGINS IN 5"), which fades out over the
first 12 frames (0.2 s: the box's mean brightness climbs from 13 to 54 as
the board shows through). That is the game's own Fight-now transition, so
it stays; the user's read at 111f can move the cut past it.

`dist/` untouched (no `src/` change in 111b).

### 111c — backpressure (2026-09-30) — read `none` ✅

**Built.** Frames waiting for ffmpeg are capped (`BACKLOG_CAP_MB` in
`record.mjs`, 1 GB: about 120 frames at 1080p, four times the largest peak
measured). The offscreen window paints in real time whatever ffmpeg does,
so a backlog can only be held or dropped: above the cap a frame is dropped
and counted, and `droppedAt` records where in the file each would have
gone. The front door still delivers a clip with drops, but exits 1.

**The control:** the corridors check twin with the cap at 30 MB (under
four frames), so that ordinary encoder jitter crosses it. Main dropped 44
frames, the peak held at 24.9 MB, the front door read CHECK FAILED and
exited 1. The file's own marker, read site by site against `droppedAt`,
accounts for all 44:
- 11 of 11 sites where main dropped distinct page frames show exactly that
  many missing in the file (20 frames);
- at one site main dropped 3 paints and the file shows a duplicate and no
  gap: the page hitched, the compositor repainted one page frame, and the
  dropped paints were copies of it;
- 21 fell at the very start, while ffmpeg started up: 14 before the page's
  marker began, and 7 were lead-in frames 1–7.

**A blind spot found and fixed.** The analyzer counted continuity from the
first count it could see, so the 7 lost lead-in frames never registered:
a recording that lost its opening frames would have read clean. It now
counts from page frame 1 (the marker always starts there) and reports
`missingBeforeFirst`. Re-run on the same file it reads 27 missing (20 + 7),
which is main's 44 less the 3 repeated paints and the 14 unmarked ones; on
two earlier recordings it still reads 0.

**The normal run:** a clean `--seed=12` clip at the default cap dropped 0,
the backlog peaking at 108 of 1000 MB (45.7 s, 2740 frames, 107 of 107
cues, no lead-in frames in the file).

### 111d — before/after (2026-09-30) — ◐ BUILT, UNREAD (a `batch` read → 111f)

**Step zero.** `c4ca4e6^` is `42d96ce` (§107c): it has the corridors
fixture and the panel's `hide` dial (both from §105), and its lockfile
differs from HEAD only by Electron's 118 lines. Checked out in a temporary
`git worktree` with the main tree's `node_modules` linked in by a
junction, it builds in development mode in 1.6 s with its `boardPanel`
chunk. The removal was checked before it was trusted: Node's `lstat`
reports the junction as a link, unlinking it removes only the link (the
repo's `node_modules` still held 127 entries), and only then is the
worktree removed.

**Built.** `--before=<ref> [--after=<ref>]` (the after side is the working
tree when absent): each side built in its own worktree, recorded one after
the other from its own fresh profile, read back by the analyzer, then
joined side by side (3848×1128: each half under a 48 px strip naming its
ref and commit in the game's font, a grey 8 px rule between, the after
side's sound, tagged BT.709). Both halves open on their go frame. The
sidecar compares the two cue lists (the matched prefix, where they part,
how far apart the matched cues fall) and notes a lockfile difference. The
front door was restructured so one flow serves a clip and a pair, and its
worktrees are closed in a `finally`; if one fails to close, the temp
directory is left in place and named, since its junction may remain.

**The known answer, HEAD against HEAD** (corridors): both halves clean (0
lead-in frames, 128 of 128 cues, 0 dropped), and the same 128 cues in the
same order, matched cues apart by a median of 1 ms and at most 34 ms (two
frames). `git worktree list` afterwards showed only the main tree.

**The pair, `c4ca4e6^` against the working tree** (corridors, the exit's
pair): both halves clean, the same 128 cues, median 3 ms apart, max 18 ms;
the lockfiles differ (flagged in the output). A frame at 10 s (viewed): the
perspective board on the left, today's ortho board at yaw 45 on the right,
the same units in the same places, both labels legible.

**The read at 111f** (`batch`): both halves open on the fight's first frame
and stay in step, each labelled with its commit. Wrong is a half running
ahead, a missing label, or halves too small to read. The clip:
`clips/corridors-42d96ce-vs-<commit>.mp4`, remade at the sitting.

### 111e — cue timing, measured (2026-09-30) — read `none` ✅

The user's call before it (at the 111d pause, the meter at 359k against the
350k handoff number): finish §111 in this session, since what is left is
mostly recording.

**The instrument, and a bug its known answer found.** The analyzer now
measures each quiet cue's onset: the delay from its logged `play()` to its
sound's rise in the file (the first 2 ms step reaching −45 dBFS and 10 dB
over the floor before it). Its known answer, the planted tone scheduled on
the audio clock, first read 26 ms, and a second detector (the Goertzel
onset) read 20. The cause was the analyzer's audio clock: the decode's
first sample sits at the stream's start time, one AAC priming frame
(21.3 ms) before where the mux placed the audio, and the cue lookups
counted from the placed start. A synthetic click at exactly 1.000 s,
through the recorder's own Opus-to-AAC mux and the analyzer's decode,
lands on its file time (1.5000 s) only when counted from the start time.
Fixed; the file-time figures (the tone against the flash, −18 ms) were
already counted that way and stand. "Heard" survived the bug only because
its window is 150 ms.

**The runs** (corridors, 60 fps, three of each, one batch):

| | `play()` to the sound | heal-ticks | over 100 ms | lost |
|---|---|---|---|---|
| normal play (`playing` event, unrouted) | median 19 / 44 / 46 ms, p90 37–73, max 179–263 | median 22–47, max 84 | 1–5 per run (dash, death) | 0 |
| routed as the recorder (`playing` event) | median 2–3 ms, p90 3–7, max 6–23 | median 2–4 | 0 | 0 |
| the file, check twins (onset) | median 8 / 18 / 18 ms, p90 10–22, max 22–30 | 10–22 | 0 | 0 of 3 × 128 |

The tone read 6, 16 and 8 ms in the three files, and the tone against its
flash −18, +2 and −18 ms: the alignment between recordings moves by about
one frame.

**What it says.**
- **The capture doesn't make cues late; it makes them earlier.** An
  unrouted `<audio>` element waits for its output to start (a median of
  20–45 ms here); routed into the already-running Web Audio graph it
  starts in 2–3 ms. The routed runs are also the control for the event
  instrument itself: the `playing` event is dispatched within a few ms, so
  normal play's figures are the element's own start, not the event's.
- **The late heal-ticks of 110e's dry run did not reproduce:** 0 late and
  0 lost across these three recordings and every recording made today
  (the analyzer counts late cues on each one, so a recurrence will show).
  They happened once, under the user's load; normal play's own starts are
  later and more variable than the capture's.
- **The sound in a recording sits in step with its picture** (cues about
  10–18 ms after their `play()`, the picture of a page event about 18–24
  ms after it), while live play puts the sound some 25–35 ms later still,
  plus the output device's latency. That fits the user's "a tad off" and
  the spike's estimate of about 50 ms, so the A/B is centred at +50: 0,
  +25, +50, +75 and +100 ms.

This is Chromium's audio in an offscreen window; the user plays in
Firefox, which is why the A/B is by ear.

### 111f — the sitting, prepared (2026-09-30) — the `stop` is open

**The exit clips** (`clips/`, made at `1802b4b` from fresh profiles; the
sound at the recorded offset until the A/B's pick is applied):

| | clean clip | check twin |
|---|---|---|
| corridors (the fixture) | 66.8 s, 4005 frames, 0 lead-in frames, 128/128, 0 dropped | 0 of 4048 missing, colours within 2, −18 ms, 128/128, backlog peak 440 MB |
| seed 12 | 45.8 s, 2747 frames, 0 lead-in frames, 107/107, 0 dropped | 0 of 2765 missing, colours within 2, −18 ms, 107/107 |
| `c4ca4e6^` against HEAD | both halves clean (0 lead-in frames, 128/128, 0 dropped); the same 128 cues, median 1 ms apart, max 19 | — |

**The frame-rate probe, re-run** (`?bp=board-live`, offscreen 1080p60,
60 s, the RTX 4080 SUPER): 60.04 fps for the page and the game, intervals
p50 16.7, p99 16.8 ms, one hitch (a 100 ms interval, about 5 of 3600
slots: inside the 1 % bar; §110c's run had none). The corridors check
twin's backlog peak, 440 MB, is the highest seen, under half the cap.

**The A/B** (`clips/ab-sound-sync.mp4`, 67.5 s): the busiest 12 s of the
corridors clip (20.5–32.5 s, 52 cues) five times, the sound shifted by 0,
+25, +50, +75 and +100 ms in a shuffled order, each after a lettered card
and with its letter in the corner. The key is in the session's scratch
(`ab-key.json`), read only after the pick. Read back from the file's own
audio (1 ms envelopes cross-correlated against the 0 ms section), every
section's lag matches its key within 2 ms.

**THE STOP, part 1:** the user watches the A/B and names the letter that
feels in sync (or two, or none). Part 2 follows the pick: the offset set
as the recorder's default, the exit clips' sound moved to it, and a fresh
recording made with the default; then the user reads the clips (the
first frame, the colours, the pair's layout: 111d's `batch` read).

### 111f — THE READ (2026-09-30, the user's) — part 1 and the clips

**The A/B.** The key: A +25 ms, B +75, C 0, D +100, E +50. The user's
first read ranked C, D and E over A and B (C and D maybe over E), then
found them "all bleeding together". The preferred three were 0, +100 and
+50, the extremes among them, so the ranking doesn't follow the offset; it
follows the play order exactly (A and B were the first two sections). The
finding: 0–100 ms of added sound delay is not audible to the user on this
footage, as expected from the asymmetry of sync perception (late sound is
tolerated far more than early). **Decided: +25 ms** (the user, on the
session's weak lean): it moves each sound from slightly before its picture
(0–15 ms, the ear's sharper side) to slightly after, as in live play, at
no audible cost.

**The clips.** 111d's `batch` read: "The side by side is awesome! Fully
happy with that!" ✅. Two findings, both for a `-post`:
- **The opening.** The countdown box's 0.2 s fade is more distracting than
  expected, and skipping it would be too abrupt for a clip uploaded on its
  own; for clips stitched together a complete skip is wanted too. So two
  openings: the full countdown, and a skip with no fade.
- **The ending.** The last frames show part of the level-up screen: the
  fixed 2 s tail after `battle:ended` catches the game's swap to the next
  screen (`Game.afterOutro`). Cut it.

### The hand-off (2026-09-30, the user's call at 450k)

The session proposed a `-post` for the read's two findings; the user
handed off here, with the meter at 450k, and signed `full` as the
default opening. **111f-post, for a fresh session:**
- **Two openings, `--countdown=full|skip`, `full` the default.** Full:
  the countdown held during setup (a fixture parks it already; for a seed
  the recorder parks it the moment the battle appears) and, at the go
  frame, restored and reset to its whole seconds (5), so the clip opens on
  "5" and plays through the game's own handover. Skip: the fight released
  at the go frame as now, with the countdown box hidden in that frame
  instead of fading. The seams, checked by name like the others:
  `PreBattleCountdown.remaining` (private) and `advance` (a fixture's
  instance patch; `delete` restores the prototype's), and the HUD's
  countdown element (`is-visible` removed on the handover, a CSS
  transition the fade).
- **The ending:** the clip cut before the next screen mounts. On the
  scene swap (`Game.afterOutro`'s timer, then `activeScene` changes) the
  page raises the magenta patch again and main stops writing at the first
  paint that shows it, the lead-in's gate mirrored; a 5 s fallback after
  `battle:ended`; the audio cut to the video; the analyzer counting only
  cues before the cut.
- **+25 ms** as the recorder's default sound delay (a constant added to
  the placement in `main.mjs`, recorded in the sidecar).
- **The read is a `stop`:** a full clip, a skip clip and the pair re-made;
  on it §111 closes.

The exit clips in `clips/` were made at `1802b4b` with the sound as
recorded (+0); remake them once the default lands rather than shifting
them. The A/B file, `clips/ab-sound-sync.mp4`, stays with its key recorded
above.

### 111f-post — two openings, the cut, +25 ms (2026-09-30) — the `stop` is open

Session f74660ed. Built as specified in the hand-off, plus a guard from a
finding (below). Code `f406442`; `dist/` byte-identical (`7424d4b4…`, 32
files; the only shipped `src/` change is a comment beside `remaining`).

**Step zero: the known answers, read from the `1802b4b` clips.** A probe
(scratch, reading only the file) tracks the countdown box's region (the
box dark at about 14, the board behind it about 54) and the largest
frame-to-frame change over the last 3 s. The old clips open on the box
mid-fade (14 → 54 over 11 frames) and cut to the next screen at file frame
3939 of 4005 (corridors) and 2667–2670 of 2747 (seed 12): 1.1 and 1.3 s of
the promotions screen at the end. Their page frames after the go frame
match their file frames within one, so they lost no time.

**Built.**
- `--countdown=full|skip`, `full` the default. The countdown is held through
  setup by the instance patch a parked fixture already has (a seed's battle
  is parked in the same microtask as its two dispatches, so it holds 5.0).
  Full: at the go frame the hold is lifted and `remaining` reset to its
  whole seconds. Skip: the box's transition switched off and its opacity 0
  in the go frame, and the fight released. The seams are checked by name
  at record time; `PreBattleCountdown.test.ts` pins the countdown half
  (with `remaining` renamed, that test alone fails; restored, it passes).
- The cut, the gate mirrored: the page shows the patch row again in the
  first frame after `activeScene` changes (the swap runs from a timer
  between frames, so that callback runs in the first frame that draws the
  next screen), and main writes nothing from the paint that shows it. The
  audio is cut to the video (`-t` at the mux); cues logged after the swap
  are listed apart and not counted; the analyzer counts any in-battle cue
  placed past the last frame (`cuesPastEnd`). With no cut 5 s after
  `battle:ended`, a fallback stops the recording, and the front door fails
  it.
- `SOUND_DELAY_MS = 25` added to the placement, recorded in the sidecar.

**The trials** (the working tree, corridors):
- **Skip:** the box region at 54 from frame 0, no ramp; no swap in the last
  3 s (the largest frame-to-frame change 0 at 240×135); the audio ends
  17 ms after the video (inside one AAC frame, 21 ms); the page's cut frame
  (3966, less the 31 before the go frame) is the file's cut frame (3935).
- **Full:** the box region at 14 from frame 0 (the whole box, "5"), its
  fade starting at file frame 303 (5.05 s), in step with the page's 5 s.
  It failed: 127 of 128 cues heard, one placed past the end. The page had
  painted 4239 frames by the cut and the file held 4193, with nothing
  dropped.

**The finding: a busy machine leaves page frames unpainted, and the file
loses their time.** Every paint was accounted for (47 held, 4193 written, 2
after the cut), so 46 page frames never became a paint at all: the
compositor skipped them upstream of main, where nothing drops or counts
them. The file plays frame n at n/60, so it lost 763 ms, and the sound fell
that far behind its picture by the end. While that trial recorded, the
session was decoding the previous clip at full speed. The planted control,
the same input with and without a looping full-speed ffmpeg decode:

| corridors, skip | frames short | picture ahead of its sound at the cut | page fps | cues heard |
|---|---|---|---|---|
| idle | 0 | −3 ms | 60.003 | 128 / 128 |
| the planted decode | 322 | 5514 ms | 59.866 | 120 / 128 |

The check twins at `1802b4b` read 0 missing: this is what their marker
counts, and clean clips had no way to see it.

**The guard.** The cut is the one frame both sides know, so the sidecar's
`timeline` sets the page's frame clock (the rAF times of the go and cut
frames) against the file's frame count: `framesShort` (page frames less
file frames, from the go frame) and `driftMs`. Any frame short is a fault,
as a drop is (111c): the clip is delivered and the front door exits 1.
- **Its reading, against the marker:** a check twin under the planted load
  read 7 frames short; the analyzer's marker, from the file, read 8 missing
  and 1 repeated. A repeated paint (a hitch, as at 111c) makes the count
  net, and an idle seed-12 clip read −1 for one repeat. Its first version
  counted a twin from its first paint rather than its go frame, and read
  −45; fixed.
- **Its control:** seed 12, skip, idle then loaded: OK (0 short, −2 ms,
  107 of 107), then CHECK FAILED (253 short, the sound 4.3 s behind by the
  cut, 101 of 107) with the fault named, exit 1.
- **The +25 ms, read from the file:** the loaded twin's tone sits +7 ms
  against its flash, the spike's −18 plus 25.
- **Not guarded: a slow page clock with no frame short.** The skip trial
  read 59.93 fps with 0 frames short (timed from the go callback, a few ms
  after the go frame), so its picture ran 80 ms ahead of
  its sound by the cut. Idle recordings read 60.00 (three runs). What
  slowed that one is not known. It passes the guard; the stop carries the
  decision.

**The exit set** (`clips/`, at `f406442`, from fresh profiles, the machine
idle):

| | seconds | opens on | frames short / picture vs sound at the cut | cues heard | the file |
|---|---|---|---|---|---|
| `corridors-f406442` | 70.7 | the countdown at 5 | 0 / −3 ms (60.003 fps) | 128 / 128 | box region 14 from frame 0; audio ends +6 ms |
| `corridors-f406442-skip` | 65.7 | the fight | 0 / −3 ms | 128 / 128 | box region 54 from frame 0; audio +13 ms |
| `seed12-f406442` | 49.5 | the countdown at 5 | 0 / −2 ms | 107 / 107 | box region 12 from frame 0; audio −2 ms |
| `corridors-42d96ce-vs-f406442` | 70.7 / 70.6 | both at 5 | −1 / −3 ms, 0 / −2 ms | 128 / 128 each | the same 128 cues, median 2 ms apart, max 18 |
| `corridors-f406442-check` | 71.5 | the countdown at 5 | 0 / −2 ms | 128 / 128 | 0 of 4267 missing, colours within 2, the tone +7 ms |
| `seed12-f406442-check` | 50.2 | the countdown at 5 | 0 / −2 ms | 107 / 107 | 0 of 2996 missing, colours within 2, the tone +7 ms |

No clip shows a swap in its last 3 s (the largest frame-to-frame change
0–0.1), none has lead-in frames, and none dropped a frame. Viewed: the
full clip's first frame is the whole box at "5", the skip clip's is the
board with no box, the full clip's last is the battle's own end, and the
pair opens with both halves at "5", each labelled. `git worktree list`
afterwards showed only the main tree. The skip clip was recorded twice: the
session's doc edits made the tree dirty mid-set, so the first was stamped
`f406442-dirty`, and it was deleted.

**Not verified here:** §110's frame-rate probe was not re-run (nothing in
this step touches the window; the timeline's page rate under recording,
60.002–60.003 fps, is this step's reading); Firefox (the recorder is
Chromium's); the clips by ear and eye, which is the read.

**THE STOP:** the user reads a full clip, a skip clip and the pair, and
decides on the slow page clock with no frame short. On the read, §111
closes.

### 111f-post — THE READ, and the display test (2026-09-30, the user's)

**The read:** "those clips all look great!" ✅ (the full clip, the skip
clip, the pair). On the slow page clock the user took (a), to leave it
and raise it at §114's kickoff, with a fallback on record: a stepped-clock
recorder (the page's clocks advanced one frame at a time, each frame
captured, the soundtrack mixed afterwards from the cue log), possibly on
the box. The session's read of it: viable and known; the sound becomes a
reconstruction that can't hear the browser's own audio problems, every
clock must be caught (CSS transitions run on the browser's animation
clock), and a box without a GPU renders WebGL in software, so a stepped
recorder would run locally at low priority as readily. Not needed on
today's evidence.

**The user's question: was it load, or the monitor locking?** The user was
away from about 14:30. Windows' logs: the session locked at 14:34:22
(Winlogon's Sens event 4; its pair, event 5, follows each display wake
within 3 s), and the display turned off at 14:35:39 (Kernel-Power 566,
reason 12, an idle timeout) until 17:04:52 (reason 32, the mouse). The
skip trial straddled the display going off (57 s in); the full trial
started 35 s after it. Every recording from 14:42 ran locked and dark, and
its 8 unloaded ones read 0 frames short within 3 ms, so the state alone is
harmless; the transition was untested.

**The display test** (the user's go; the user had left the monitor): three corridors
clips, skip. In two, the session switched the display off
(`SC_MONITORPOWER`) about 22 s into the fight and woke it with a one-pixel
mouse move 25 s later. The page now logs every frame over 40 ms with its
wall-clock time (`timeline.longFrames`).

| | long frames, against the session's stamped requests | frames short | picture ahead of its sound at the cut | cues |
|---|---|---|---|---|
| control, display on | none | 0 | −3 ms | 128 / 128 |
| off, then on | 183 ms from 5 ms after the off; 433 ms from 11 ms after the wake | 3 | 630 ms | 127 / 128 |
| off, then on | 283 ms from 10 ms after the off; 250 ms from 260 ms before the wake | 0 | 497 ms | 127 / 128 |

**What it says.**
- **Each display transition stalls the offscreen renderer for 0.18–0.43 s,**
  starting within 5–11 ms of the request (three of four; the second wake's
  stall began 260 ms before the nudge, unexplained; the stamp is taken after
  the call returns, so a call that blocked during the wake would stamp late). The page stops rather
  than skipping paints, so each page frame still paints and the file shows
  the frame after the stall one slot later: the picture runs ahead of its
  sound by the stall from then on.
- Windows logged none of these transitions (no 566): a programmatic switch
  is not the idle timeout's session transition, so the path is related to
  14:35:39's, not the same.
- **The two anomalies, placed.** The skip trial's 80 ms with no frame short
  fits a stall at 14:35:39, inside it (inferred: it predates the long-frame
  log; main's longest paint gap was 132 ms, against 34–93 ms in idle
  runs). The full trial's 46 frames short are 767 ms, all of its drift,
  and no transition fell inside it: load, the session's own decode, as
  first thought. The user's hypothesis explains the one; load the other.
- **The guard has a hole.** It fails a file short of frames, and a stall
  makes none: the second test clip passed it with the sound 497 ms behind,
  and failed only because one cue fell past the file's end. The slow clock
  that (a) left alone is this stall, and it recurs whenever the display
  switches while a recording runs (once a minute into a lock, and when the
  user returns).

The decision goes back to the user, since (a) was taken on "seen once,
cause unknown".

### 111f-post — the decision, and §111 closed (2026-09-30, the user's)

The user had moved away from the monitor as the display test started, so
the second wake's early stall is not the display waking for them; the
entry above now says so.

**Decided** (the user): **(A) now**, a recording fails when its picture
drifts more than 50 ms from its sound by the cut; **(B) lands in §114**,
retiming each stall from the long-frame log; **(C), the display held awake
during a recording, is the fallback** if either fails. The stepped-clock
recorder stays on record as the fallback beyond them.

**(A), built** (`42b3263`). The faults moved to `shell/electron/faults.mjs`,
pure over the sidecar, and frames short and drift are judged separately
(a recording with both reports both). The limit: idle recordings read −3
to −2 ms, and 50 ms keeps the delay plus the drift under the 100 ms the A/B
could not tell apart.
- **The planted run did not isolate it.** The display switched off 22 s in
  and woken 25 s later again, this time throttling the renderer for about
  13 s: 45 frames over 40 ms (83–567 ms) from 18:20:22 to 18:20:35, the
  page at 51.5 fps, 142 frames never painted, the picture 11.6 s ahead of
  its sound by the cut, and no stall at the wake. It recovered on its own,
  and Windows logged nothing. So one switch costs anything from a single
  0.2 s stall to 13 s of throttling. **The difference is likely load**
  (the user, afterwards): their PC was in use until the display went off,
  where the two single-stall runs had an idle machine; the throttling
  began 95 ms after the switch and ended 12 s before the wake, so the
  switch set it off and the busier machine shaped its size (one run each
  way, so a reading, not a measurement). That makes the 13 s case the
  representative one for a long run (the user working, then walking away),
  and it bears on (B): a retime can place a stall but not an unpainted
  frame, so such a run may still need (C).
- **Every saved sidecar judged again** with `faults.mjs`, the check that
  needs no new recording: the 11 clean recordings (the exit set, the
  control, the idle trials) pass; the display test's drift-only clip (0
  short, 497 ms), which the frames-short rule passed, now fails on drift;
  the loaded and the throttled runs report both faults. One sidecar was not
  a valid input: the loaded check twin's timeline predates the go-frame
  fix (it reads −45).
- **The real path:** one idle recording through `main.mjs`: OK, no faults,
  no frame over 40 ms.

The `1802b4b` clips are deleted (the user's word); `clips/` holds the
`f406442` exit set, the A/B file and `111-probes/`.

**§111 ✅ CLOSED 2026-09-30.** ROADMAP §111 demoted, and the stall carried
into §114.

## Phase 112 — the pane probe kit and the Electron runner

### The §112 audit and cut (2026-09-30) — the shape-lock is open

Session ab584af9. Nothing the kit touches has moved since the charter was
written: the last commit to `src/main.ts` or `src/dev/` is `72071bc`
(109b), and `shell/electron/` is as §111 closed it (`42b3263`). ✔ = read by
this session at file:line.

**What is there.**
- **The traps, as filed.** The charter's six map to Round 7.5's papercuts:
  not live yet (#38; before it #3, #6), a URL overwritten by the pane's
  first load (#45), a stale frame (#43), a timed-out script still acting
  (#40), a 0×0 canvas (#54; #16 is its zero-width twin), and a crop (#49).
  None has been filed since this round began (✔ `retro/papercuts.jsonl`,
  72 lines). By the charter's own list, 7.5 filed six covered-trap
  papercuts, where the charter says 5; the record doesn't say which one C5
  left out. The line (at most 1) doesn't move.
- **The kit's home.** DEV code loads by a DEV-gated dynamic import in
  `main.ts` (✔ `main.ts:40`), because a static import left about 200 bytes
  in `dist/` at 105c. `window.__game` is set after `game.start()` (✔
  `:56-67`), behind a top-level await for the font atlas (✔ `:36`), so a
  handle installed there appears only once the modules, the font and the
  Game are up.
- **The reach-ins.** One frame is a closure inside `Renderer.start` (✔
  `Renderer.ts:252-271`): the private `onFrame(dt)` (Game's: the scene tick,
  then the depth sort, ✔ `Game.ts:185-188`), the camera shake, then
  `renderTwoPass`. The overlays move inside the scene tick (✔
  `BattleRenderer.ts:927,945`). The board explorer's `seams.ts` is the
  pattern for reaching private members: each is checked at install, and a
  moved one is logged by name (✔ `seams.ts:25-27,77-82`).
- **The run driver exists only as a recipe** (`process/browser-pane.md`
  "Fixtures"; `archive/post-104-worklog.md` §106d, with one unexplained
  no-op `acceptReward` on the boss's reward screen that went through on a
  retry, ✔ `:1374-1377`). `RunPhase` has 12 members (✔ `Run.ts:151-163`).
  The fuzz harness runs the same phase switch over a headless Run (✔
  `tests/fuzz/harness.ts:779-1160`), but it lives under `tests/` and pulls
  in the fuzz strategies, so the page driver keeps its own small policy.
  Merging the two is a candidate for Round 8.5's census.
- **The runner is mostly built.** `--probe=script --script=<file>` runs a
  page-script file's default export in the page and prints one JSON line,
  exiting 0, 1 on a failed check, or 2 on a timeout (✔ `main.mjs:224-231,
  391-435`). The recorder builds the working tree in development mode
  (about a second) and checks that the build carries the dev chunk (✔
  `record-cli.mjs:133-146`), then spawns `main.mjs` in a fresh profile (✔
  `:150-183`). What's missing is a front door, and a page that is ready
  before the script runs.
- **Criterion (2)'s instrument.** `friction-scan` already reads every tool
  call in the retained transcripts and prints counts only (✔
  `scripts/friction-scan.mjs:101,116`); pane calls and kit calls per
  session are one more column.
- **The oracle.** `dist/` byte-identical, by §110's hash (`7424d4b4…`, ✔
  §110 "The phase's oracle"), re-hashed at each step that touches `src/`,
  `index.html` or `vite.config.ts`. Tests run under Node (✔
  `vite.config.ts:131`), so the kit's seams are pinned on the prototypes,
  the way `AudioPlayer.test.ts` pins `pools`.

**Hypotheses for step zero** (unmeasured):
- **The not-live state.** A kit the page installs can't exist before the
  page does, so a first `await __probe.ready()` on an unloaded page throws
  a ReferenceError. That is loud, costs one retry and makes no wrong
  measurement, which was the trap. Whether the pane's early state is a
  blank document or the HTML with its modules still loading decides
  whether a serve-only bootstrap in `index.html` (a Vite plugin with
  `apply: 'serve'`, which the build never runs) would buy anything. Step
  zero reads `document.readyState`, `location.href` and the script count
  in the first call after `preview_start`.
- **Timers in the hidden pane.** `ready()` and the driver poll on
  `setTimeout`, which a hidden page may clamp to once a second; measured
  before a polling interval is chosen.
- **Frames.** `frame(0)` through the loop's own path (the private
  `onFrame`, then `renderTwoPass`) moves the overlays and renders without
  advancing the sim. The §109a oracle's `scene.tick(0)` then
  `renderTwoPass()` is the precedent.
- **The boss-reward no-op** (§106d) either reproduces under the driver or
  it doesn't. Either way, the driver reports a command that changes nothing
  instead of retrying it.

**Calls for the shape-lock, with the session's lean.**
1. **`pixels(rect)`** returns numbers (a hash, the size, and the pixels of
   a small rect, capped), and on request shows the crop magnified in a DEV
   overlay so a screenshot can see it; #49 wanted to look at a few-pixel
   drape. Lean: both, since the overlay is small.
2. **The driver's choices:** the first legal choice, or a seeded draw among
   the enabled ones (the harness's event doctrine). Lean: seeded, with
   `first` as an option, so a run repeats from its seed and still varies
   across seeds.
3. **The runner's page:** the recorder's development-mode build of the
   working tree, not a dev server. Lean: the build. `build()` moves to a
   module both front doors share, and one recording through the analyzer
   checks the recorder after the move.
4. **Criterion (2)'s counter, built now** rather than at the close. Lean:
   now, so it is checked against known answers (a 7.5 pane session reads
   pane calls and no kit calls) before the sessions it will count.

**Predictions for the cut.** No snapshot bump, no RNG stream (the driver's
draw is a local `RNG`, never serialized), no config change. No step stages
`src/sim|run|core|config|bot`, `config/` or `tests/fuzz`, so the fuzz smoke
fires on none. `dist/` stays byte-identical at every step. This phase's own
sessions don't count toward the criteria, which start at the landing commit
the Cursor records.

The cut is proposed in the conversation and goes into ROADMAP §112 once
signed.

### The §112 shape-lock (2026-09-30, the user's) — SIGNED

Signed at 19:05 as proposed: five steps, four `none` and one `batch`
(112e, read at §113's kickoff), with no `stop`. All four calls ✅ DECIDED
at the session's lean: `pixels(rect)` returns numbers plus an optional
magnified overlay; the driver draws a seeded pick among the enabled
choices, with `first` as an option; the runner loads the recorder's
development-mode build, whose `build()` both front doors share; criterion
(2)'s counter is built now. The context handoff number is **400k for this
session**, and the §111 clock applies again: the session pauses for the
meter at the first step boundary after 20:05, or mid-step if one step runs
an hour.

### 112a — the kit's core (2026-09-30) — read `none` ✅

**Step zero.**
- **The not-live state is the HTML with its modules held**, not a blank
  document. The first call after `preview_start` read `readyState`
  interactive, the title, 2 scripts, 0 stylesheets, the canvas at the HTML
  default 300×150, no `__game`, and a hidden 0×0 page. It stayed that way
  for 38–40 s on each of two fresh starts. **The dev server holds it:**
  every module request began at 3–5 s and all were answered together at
  about 40 s, and from Node on a fresh start, curl waited 19.7 s for
  `main.ts` and 18.0 s for `ui.css`, then 2 ms for a later module.
  `resize_window` doesn't release it (0×0 for 12 s after one). No second
  navigation happened in either start (`timeOrigin` unchanged), so #45's
  overwrite didn't reproduce.
- **Timers run on time in the hidden pane** (100 ms timeouts land about
  108 ms apart), and rAF doesn't fire; the page's clock tracks the
  machine's.
- **The pane tool gives up at 45 s**, so `ready()` defaults to 30 s.

**One change inside the signed intent, flagged:** the stand-in
(`src/dev/probe/bootstrap.ts`), an inline script `vite.config.ts` injects
into the dev server's HTML only (`apply: 'serve'`). Because the HTML is up
while the modules are held, the stand-in's `ready()` waits for the kit, and
its other calls refuse by name. Without it, a first `await __probe.ready()`
throws a ReferenceError for up to 40 s.

**Built** (`src/dev/probe/`, loaded like the board explorer by a DEV-gated
dynamic import, installed last in `main.ts`'s DEV block): `ready()`,
`go(query)`, `check()` and `running()`, as ARCHITECTURE's tree describes.
The private Game fields it reads are typed by indexed access
(`Game['activeScene']`), so a rename fails typecheck: a planted
`Game['activeScen']` failed with TS2339.

**The traps, planted in the pane** (Chromium, 1280×720):

| trap | plant | result |
|---|---|---|
| not live | a fresh server; the first call, at 1.0 s, is `await __probe.ready()` | the stand-in waited, and the kit answered at 15.7 s with a live report (character select) |
| a URL overwritten | `go()`, then a second navigation to `?other=1` before any `ready()` | `ready()` threw, naming all three missing pairs; the next `ready()` passed there |
| (the same, a real case) | `go('bp=board-quarry&seed=99')` | `ready()` threw `missing seed=99` (the fixture replaces its run dials) |
| (go before live) | `go()` on a page still loading | refused; nothing navigated. It read "is not a function", so the stand-in now refuses by name |
| a 0×0 canvas | the canvas hidden by CSS (a `desktop` reset left this pane at 1280×720, so #54 didn't reproduce) | `check()` and `ready()` threw at once, with the fix |
| (a stale buffer) | the canvas box set to 640×360 with no `resize` event | `ready()` sent one: `resized: true`, buffer 640×360 |
| a stale call still acting | a `ready()` that can't finish (a planted go record from this page), left running | the next call (`check()`) stopped it, "superseded by call 10", with its blocker still set; `running()` then empty |

**Headless** (`page.test.ts`, 12): the canvas check and the URL pairs, each
with planted cases on both sides; the stand-in's exact text run against a
fake window (it hands the wait to the kit with the time left, and rejects
by name); and its names checked against the real kit's own keys (a planted
missing `running` failed the pin).

**`dist/`** byte-identical: `d77a6381…` over 32 files at `3c46acd` (two
builds; the total's format differs from §110's `7424d4b4…`, whose script
wasn't kept) and again after 112a. The failing control: a planted static
use of the kit outside the DEV gate moved it to `84705543…` and put the
kit's strings in the bundle.

**Not verified:** the pane's own first load replacing a URL (#45's
mechanism) and a hidden pane's real 0×0 canvas (#54); both were planted
instead, since neither reproduced.

**Three holes, found at 112b's step zero and fixed in the kit's core**
(the commit after `7638e80`):
- **A stylesheet that failed to load passed `ready()`.** My `vite.config.ts`
  edit restarted the dev server while the page's `ui.css` request was in
  flight: status 0, zero bytes. The page came up with a `<link>` whose rules
  can't be read, so "stylesheets > 0" held and `ready()` reported a live
  page whose canvas sat at the HTML default 300×150, `display: inline`, in
  a 1280×720 viewport. Now `ready()` throws at once, naming the file, when
  a same-origin sheet's rules can't be read or are empty. The canvas check
  also compares the canvas box with the page (`ui.css` makes it exactly
  `100vw` × `100vh`), which catches the same page by its symptom.
  **Reproduced for real:** a fresh server, `vite.config.ts` touched 4 s
  into the load, and `ui.css` failed again. The stand-in's `ready()` timed
  out twice (the restart made the load longer), and the third call threw
  "`/src/ui/ui.css` failed to load, so the page has no layout". After a
  reload, it passed in 1 s.
- **A go record outlived its navigation.** The trap-4 plant left one, the
  page later reloaded for a source edit, and `ready()` judged the old ask
  against the new URL. Now the record is judged once, at the kit's install
  on the first load after `go()`, and the verdict is held for that page
  only; `go()` marks its own page as navigating. Re-planted: the overwrite
  is still caught (the second navigation ran before the target's kit
  installed, so `?other=1` was the first page to judge it), and a later
  reload passes.
- **The real 0×0** turned up after the page reloaded under the `desktop`
  reset: a 0×0 page, and `ready()` threw by name. The stale-call plant was
  re-run with a new blocker (the UI taken off the page), and was
  superseded with the blocker still in place.

### 112b — `frame()` and `pixels()` (2026-09-30) — read `none` ✅

**Step zero.** `BattleScene.tick(0)` advances no sim tick, parked or
running (✔ `BattleScene.ts:247-306`); the overlays move inside it, in
`battleRenderer.update`. By hand in the pane (`board-quarry`, parked): after
`setCameraView` the overlays still read the old view, and `onFrame(0)` then
`renderTwoPass()` moved them, the sim tick still 0.

**A finding the plant turned up: the overlays trail a camera move by one
frame, in the game's own loop.** Against a real frame (a screenshot forces
one), one `frame()` after a yaw change read the first bar at (0, 195.6),
where the real frame read (675.8, 81.1). A second `frame()` read (675.8,
81.1) and held. The loop moves the overlays inside `onFrame`, and three.js
updates the camera's world matrix only inside the render, so the first
frame after any camera change projects them with the old camera. The kit's
`frame()` therefore brings the camera's world matrix current before the
loop's body; the production loop is out of this phase's scope, so the fix
there is a TODO rider (§112).

**Built:** `frame(dt = 0)` (the canvas check, then the loop's body: Game's
`onFrame`, then `renderTwoPass`, both typed by indexed access; no camera
shake) and `pixels(rect, { show, render })`: the canvas check, the rect
turned into buffer pixels counted up from the bottom row (`glReadRect`,
which refuses an empty rect or one leaving the canvas), a render and
`readPixels` in the same call, and a summary (an FNV-1a hash, the mean,
distinct colours to 64, translucency, and each pixel as `#rrggbb` for a
crop of at most 256 pixels). `show` draws the crop magnified in the page's
top-left, above the scanlines, until `hide()`. The stand-in refuses the
three new calls by name.

**The plants** (Chromium, 1280×720, `board-quarry` parked):
- **The stale read.** After a yaw change, a read without `frame()` equals
  the read before the change (6 of 6 bars); one `frame()` equals a second
  `frame()` and a real frame, on all 6, with the sim tick 0.
- **A known colour.** A magenta 40×30 square scissor-cleared into the
  buffer at page (101, 53) after each render (an instance wrap on
  `renderTwoPass`). `pixels()` over it read one colour, 255,0,255. Three
  3×3 reads straddling its left edge, its top edge and its bottom-right
  corner split inside from outside on the right pixel. The top read's
  first row is the outside one, which is the flip's direction. The
  screenshot, a surface the kit doesn't compute, shows the square at the
  page's top-left under the HUD, and nothing at the bottom-left, where a
  flipped placement would be.
- **`show`** drew the crop at ×8, and the screenshot showed the square's
  block 10 px in from the crop's corner; `hide()` returned true, then
  false.

**Headless** (`page.test.ts`, 20): `glReadRect` (the bottom-up rows, the
pixel ratio, the refusals) and `summarizePixels` on a planted 2×2 buffer
(top row first, the mean, a one-byte change moving the hash, the rows cap).
**`dist/`** byte-identical (`d77a6381…`).

**Not verified:** a pixel ratio other than 1 (the pane runs at 1; the
scaling is pinned headless only).

### 112c — the whole-run driver (2026-09-30) — read `none` ✅

**Step zero.** The fuzz harness's phase switch gave each row its command
(✔ `tests/fuzz/harness.ts:779-1180`; `computeFrontier` is private there, at
`:1217`, so the driver has its own `frontierOf`). `run.toJSON()` refuses
only when run triggers are registered, and none are (✔ `Run.ts:4182-4193`),
so a snapshot before and after serves as "did the command change
anything". **The outro:** at a turn's end Game waits out an outro (900 ms of
wall clock and the battle scene's own settle) and then sends `advanceTurn`
itself (✔ `Game.ts:392-399, 759-774`). A driver that sent it at
`turn-outcome` would cut the outro short, so a fight ends when Game swaps
the scene, not when the phase moves, and the frames go on through the
outro with wall time passing.

**Built:** `drive.ts` (`PHASE_ROWS` as a `Record<RunPhase, …>`, the picker,
`frontierOf`, the log hash) and `__probe.drive(opts)`. The battles are
driven by hand whatever the page's own loop does: the sim's clock fires
fixed ticks whoever advances it, and the driver sends no battle commands.
The fight starts at once (the countdown's Fight, as Space does). A drive
yields every 50 frames, so a later call can stop it.

**The pane** (Chromium, 1280×720, hidden):

| run | result |
|---|---|
| `seed=7&character=soldier`, seeded 1 | to `defeat` in one call: 12 battles, 3955 frames, 46 commands, 21.8 s; log `a59ee48f` |
| the same again, on a fresh page | the same log, `a59ee48f`: 12 battles, 46 commands (3957 frames: the outro's frames run on wall time) |
| the control: the same URL, seeded 2 | a different log, `3de46d18` (13 battles, 42 commands) |
| `…&hops=2` | to `complete`, the boss included: 6 battles, 16 commands |
| `…&hops=2`, an audit planting a finding every 100th frame | 11 findings over 1131 frames, each naming its frame and tick |
| a drive left running mid-battle | the next call (`check()`) stopped it: "superseded by call 3" |
| `Game.dispatch` made a no-op, at the map | "`map: enterNode 0` changed nothing" |
| the same, mid-battle | Game's own deferred `advanceTurn` went through the no-op too; "the battle ended 10 s ago and Game never swapped its scene" |

**§106d's no-op `acceptReward` did not reproduce:** the boss's reward
screen took three `acceptReward 0` in a row, and each changed the run.

**One plant of mine failed first:** an audit keyed on `tick % 40` found
nothing in 113 audits. The ticks on audit frames read 18, 38, 58, …, so
none is a multiple of 40; keyed on the driver's frame count, it fired.

**Headless** (`drive.test.ts`, 9): the picker (the first; seeded repeats
from its seed, and another seed differs), `frontierOf`, each row over a
fake run (the frontier pick and its refusal, the enabled event choices,
the reward's packet rule, the recruit's pass slot, fight and end), and the
log hash. **`dist/`** byte-identical (`d77a6381…`).

**Which screens the runs crossed**, from the report's per-phase count
(added after this line's first draft named screens as unreached on the
evidence of the last six commands alone): the seed-7 run, a third time on
`a59ee48f`, sent 9 map, 10 event, 12 pre-turn, 3 reward, 8 promotion,
3 recruit and 1 port commands. The `hops=2` run sent 2 map, 2 event,
6 pre-turn, 3 reward and 3 promotion commands, on `86578edc`, the same log
as the audited run: the audit's renders don't change the run. None was
sent at `turn-outcome`, which Game advances itself. **Not reached:** the
sector-cleared gate (the long run lost in its first sector, and `hops=2`
is one sector); its row is a fixed command.

### 112d — the Electron runner (2026-09-30) — read `none` ✅

**Built.** `npm run probe -- <script> [--seed=<n> [--dials=…] | --board=<id>
| --query=…]` (`shell/electron/probe-cli.mjs`). It builds the working tree
in development mode into a temp dir, boots it in a fresh profile in a
hidden window (`--window=offscreen` when frames must run in real time),
and runs main.mjs's new `kit` probe: wait for `window.__probe`, pass
`ready()`, run the script with `--arg`. It prints one JSON line on stdout
(progress goes to stderr) and exits with main.mjs's code. The kit probe
catches the page's errors itself, so a page exception comes back by its
message. `build()` and `openTree()` moved from `record-cli.mjs` into
`tree.mjs`, which both front doors import; `build()` takes a log function,
since the runner's stdout carries only its JSON. `probes/drive-run.js`
plays a whole run through `__probe.drive`, calling it until it's done.

**Checked** (the exit):
- **A driving script exits 0:** `drive-run.js --seed=7` played the run to
  `defeat` in 15.8 s (22 s with the build): 12 battles, 46 commands, log
  `a59ee48f`. That is the pane's log, from a built bundle in Electron's
  Chromium rather than the dev server in the pane's.
- **A planted failure exits 1** with the script's `{ ok: false }`; **a
  planted page error exits 1** with its message; **a planted hang exits
  2** at `--timeout=20`.
- **The recorder after the move:** `npm run record -- --board=corridors`,
  OK: 70.7 s, 0 dropped, 0 short, drift −3 ms, 128 of 128 cues, exit 0.
  The check clip was deleted afterwards (`clips/` keeps the exit set).

**A finding, fixed:** the report's `scene` read `Pp` in the built page.
Every build minifies class names, a development-mode one included, so
`constructor.name` holds only on the dev server. `src/dev/probe/scenes.ts`
names the scene by `instanceof` against the eleven scene classes, and
`scenes.test.ts` checks the table against every `export class …Scene` in
`src/scenes/` (a planted missing entry failed). Re-run on `board-quarry`:
`BattleScene`, with `frame()` and an 8×8 `pixels()` read working in the
hidden window (1280×720, 30 distinct colours).

**`dist/`** byte-identical (`d77a6381…`).

### 112e — the pane doc, the counter, the criteria's start (2026-09-30) — read `batch` ✅ READ 2026-10-01

**The counter.** `friction-scan` gains `pane` (Browser pane calls), `kit`
(pane calls whose input calls `__probe.ready(` … `drive(`) and `runner`
(shell commands running the probe runner), and a PANE line (sessions
using the pane, how many of them call the kit, sessions using the runner).
Tried on every retained transcript first (a scratch copy of the matchers):
- **kit and runner read 0 in every session before ab584af9,** and 50 and 3
  in ab584af9 (its three `npm run probe` commands);
- **40f4ba9e's pane reads 25,** equal to its tool-name tally;
- **the planted-bad case is real:** sessions before the kit built ad-hoc
  `window.__probe` objects, and a substring match read 4, 5 and 1 "kit
  uses" in 16656245, 883e1b7a and cd47b62d. The kit matcher, a call to a
  kit method inside a pane call, reads 0 there.
Since 2026-09-21 the PANE line reads 13 pane sessions, 1 calling the kit
(this one), 1 using the runner.

**The doc.** `process/browser-pane.md` opens with the kit: the first call
is `await __probe.ready()`, and each trap the kit holds is a line of API
with what its failure says to do (not live, a failed stylesheet, a 0×0
canvas, a wrong layout, an overwritten URL, a stale frame, a crop, a call
the tool gave up on), then the runner. The tips for traps it doesn't hold
stay under "What the kit doesn't hold" (CSS transitions, the Web
Animations stall, the real-time clocks, un-throttling) and in Input; the
pixel recipes read through `pixels()`. CLAUDE.md's pane line names the
first call; `process/welfare-and-efficacy.md` names the new columns.

**The criteria's start:** the sessions that start after ab584af9, which
built the kit and whose pane use was the kit's own testing (the HANDOFF
Cursor, "Checked at the Round 8 close").

**The read** (`batch`, at §113's kickoff): `process/browser-pane.md`'s
first section is the kit, and each trap it holds is a line of API, not a
tip. Wrong is a held trap still written as a tip, or a tip dropped for a
trap it doesn't hold. **✅ READ 2026-10-01** (the user, earlier than
planned, at the hand-off): "the kit looks great".

### The dev server's cold start, measured (2026-10-01, the user's question)

The user asked why the dev server's first page takes 20–40 s when a
release build doesn't. Measured through Vite's own API on a spare port
(scratch scripts; one module at a time, so each time is its own):
- **One module holds it all:** a cold crawl of `main.ts`'s 280-module
  graph took 49 s, of which `/src/fonts.css` took 48 s; `main.ts` took
  759 ms and every other module milliseconds. Warm, the whole graph takes
  44 ms. The dependency cache was not rebuilt between starts (its
  `_metadata.json` was last written when `vite.config.ts` changed).
- **It is the first stylesheet, not that one:** `ui.css` after it took
  21 ms. A CPU profile of that first transform put 39.2 of 45 s in
  `FSWatcher` (`fs.watch`): Vite's watcher setting up a watch per file and
  folder at startup, which the first CSS transform waits behind. A build
  runs no watcher, hence no delay in release builds.
- **What it watches:** about 34,300 files, which is everything except
  `.git` and `node_modules`. Of those, 28,578 (1,751 folders) are in
  `output/` and 4,661 in `tests/fuzz/output/`, against 408 in `src/`.
- **The control:** with `server.watch.ignored` set to `**/output/**` and
  `**/tests/fuzz/output/**` (passed inline, the config untouched), the
  first stylesheet took 431 and 415 ms on two cold starts; as configured
  today, 46,591 ms.

**Proposed and ✅ DONE** (the user, 2026-10-01): those two patterns in
`vite.config.ts`'s `server.watch.ignored`. The cost is that a change
inside them no longer reloads a page; nothing the dev server serves
imports from them, and a `fetch` of a file there still works. With the
config itself (no inline override), the first stylesheet took 739 and
670 ms on two cold starts. In the pane, a fresh server's page went live
0.6 s after it began loading (`ready()` called at 0.14 s), where it took
38–40 s at 112a. `dist/` unchanged (`d77a6381…`).

### §112 closed (2026-10-01)

Session fc750343. Every step is read (four `none`, and 112e's `batch` read
taken by the user at the hand-off), so the close is paperwork: ROADMAP §112
demoted, the phase summary in `retro/sessions.md`, the HANDOFF Cursor moved
to the §113 kickoff. Pre-flight at `b105787`: 3138 tests in 209 files,
typecheck clean. The user opened the session expecting 112e's read to be
still open; the record has it taken (`eae4a2a`).

## Phase 113 — the store and the build ID

### The §113 audit and cut (2026-10-01) — the shape-lock is open

Session fc750343. ✔ = read by this session at file:line, or measured.

**What is there.**
- **Nothing in the game persists.** The only `localStorage` user under
  `src/` is the DEV trace ring (✔ `src/dev/traceStore.ts:15-54`); the other
  hits are `sessionStorage` in the editors under `tools/` and in the kit's
  `go()` (✔ a search of `src`, `shell`, `tests`, `scripts`, `tools`). From
  the page itself, a surface the search doesn't consult: the pane's
  `localStorage` on `:5191` held one key, `asciibattler:traces:v1`
  (209,500 characters), and `sessionStorage` none. The speed, the keys and
  the locale are page-lifetime fields with no stored value (✔
  `Game.ts:105-122`, `locale.ts:14-15,52-56`).
- **The boot.** `main.ts`'s first static import is `./fonts.css`, then
  `./Game` (✔ `main.ts:8-21`), whose graph holds the config loaders; each
  resolves its prose through the active locale right after its parse
  (`locale.ts:137-146`, by its own comment; no loader was opened). The locale is fixed
  before a catalog loads, so the store's module has to evaluate before
  `./Game` and must not import anything that loads a catalog itself.
- **The Electron half is as the spike left it:** the preload reads
  `store.json` as one text with a synchronous message and exposes
  `window.shellStore.{ shell, initial, write }`; main writes a temporary
  file and renames it (✔ `preload.cjs:11-19`, `main.mjs:94-109`), and the
  `store-write` and `store-read` probes work on that raw text (✔
  `main.mjs:210-222`). One file, one text: the adapter keeps its keys
  inside it.
- **The build has no ID.** `package.json` is `0.0.0`, the repo's only tags
  are the two casualty ones, and `vite.config.ts` has no `define` (✔).
  The recorder already computes the stamp D2 describes, the short commit
  plus `-dirty` from `git status --porcelain` (✔ `tree.mjs:28-33`), so the
  two should share one function.
- **The save format.** `RUN_SCHEMA_VERSION = 46` is a module-private const
  (✔ `Run.ts:497`); `toJSON` writes 42 fields (counted at `:4194-4279`),
  several of them nested data (`nodeMap`, `team`, `currentEncounter`,
  `portStock`); `fromJSON` rejects on the version and on unknown daemon,
  character and boss ids (✔ `:4289-4384`). Tests pin the number in five
  places (✔ `Run.test.ts:2988, 3178, 3502, 5732, 6494`), as 110f counted.
  A second search for a key-set or shape pin found none
  (✔ `Object.keys(wire…)` and "import graph" over every `*.test.ts`: no
  match), which agrees with 110f; neither search would see a pin written
  another way.
- **The guard's precedent says a test, not lint.** The `Math.random()` ban
  is an ESLint rule only (✔ `eslint.config.js:23-39`), the pre-commit hook
  doesn't run lint, and the i18n literal pin was built as a test for that
  reason (✔ `literalScan.ts:9-11`). ESLint is clean today on `src/sim`,
  `src/run`, `src/bot` and `tests/fuzz` (✔ exit 0, no output), so a planted
  import would be the only finding.
- **The TypeScript compiler API is already a test dependency** (✔
  `literalScan.ts:43`, syntax only; no test builds a type checker yet).
- **`configHash()` lives in `src/dev/`** (✔ `configHash.ts`), and D4 stamps
  it on shipped journals: §114's move, not this phase's.

**Measured at the kickoff.**
- **Node 25.5 defines a `localStorage` that doesn't work:** `typeof
  globalThis.localStorage` is `object`, `setItem` "is not a function", and
  Node warns about `--localstorage-file` (✔ a scratch script). An adapter
  chosen by `typeof localStorage` would pick it under `npm test` and under
  the fuzz CLIs. The choice has to be explicit: `window.shellStore`, then
  a `window.localStorage` that passes a write, a read and a remove, then
  memory with "can't save".
- **The page has what a two-tab lock needs:** on `:5191`,
  `navigator.locks` is an object with 0 held, `isSecureContext` is true and
  `BroadcastChannel` exists (✔ the pane). Electron and itch's iframe are
  unmeasured.
- **The kit, in its first session after the one that built it:**
  `await __probe.ready()` was the first call, 3.2 s after the page began
  loading on a fresh server, and it returned in 204 ms with a live report
  (character select, 1280×720, frames stopped). No trap fired.

**Hypotheses for step zero** (unmeasured).
- **The fingerprint by types.** A walker over the type checker expands
  `RunSnapshot` to its leaves and hashes the text. The cost of building a
  checker over `Run.ts`'s graph inside `npm test` is unmeasured; if it is
  more than a few seconds, the fallback is shapes taken from driven runs,
  which can't see a variant no run reaches.
- **A recorder worktree's stamp.** `openTree` links `node_modules` into
  the worktree as a junction; whether `git status --porcelain` there reads
  clean decides whether an older commit's build is stamped `-dirty`.
- **`define` under each runner.** Vitest reads `vite.config.ts`, so the
  constant exists in tests; `tsx` (the fuzz CLIs) has no `define`, so the
  module that exports the ID needs a fallback that §114's replay can tell
  from a real one.
- **The dev server's ID** is computed when the server starts and goes
  stale as commits land under it. Known for §114, where a journal recorded
  on the dev server needs the commit at recording time.
- **An unused i18n key** (the rejection message, before §115 shows it) may
  trip one of the i18n pins.

**`dist/` stops being the phase's oracle:** this phase changes the
production bundle by design (the store module, the ID, the label), and a
baked commit changes it at every commit after. A pinned ID through an
environment variable keeps byte-identity available to later phases.

**Calls for the shape-lock, with the session's lean.**
1. **The key layout** (ROADMAP's decision point): one key per section,
   `asciibattler:meta`, `:settings`, `:progress`, `:run`, `:journals`, each
   an envelope `{ v, data }`; under Electron the same keys inside the one
   `store.json`. Lean: this, over one blob, because a write then touches
   only its section, and a quota failure on the journals can't cost the
   settings.
2. **The fingerprint's instrument:** the type walker, if step zero
   measures it at a few seconds or less; else shapes from driven runs.
   Lean: types, since the variants no run reaches are where a stale save
   would bite.
3. **The headless guard:** D1's ESLint rule, plus a twin on `npm test`
   (an import scan with a planted violation as its control). Lean: both;
   the test is the guard, because the hook doesn't run lint.
4. **Where the ID shows before the menu exists:** a small corner label on
   character select, today's boot screen, which §116 moves to the menu.
5. **The itch leg of the exit.** The adapter's itch case is the web case's
   code, and 110e read it in Firefox. Proving it again here needs a
   sitting (a zip uploaded to the draft) and something a production build
   shows that changes across boots. Lean: prove the web (the dev server
   and the production build) and Electron here, and take the itch leg at
   the first sitting where a player-visible thing persists (§116's exit
   says three shells again). It re-scopes a signed exit, so it is the
   user's call.
6. **The two-tab lock:** here, or with its first user. Lean: §115, with a
   landing note at the adapter seam, because the lock guards the run
   slot's writer and the slot has no writer until then.

**Predictions for the cut.** No snapshot bump (Run v46, World v36), no RNG
stream, no config change. No step stages `src/sim|run|core|config|bot`,
`config/` or `tests/fuzz`, so the fuzz smoke fires on none: the ID's
module sits outside `src/core`, and `RUN_SCHEMA_VERSION` stays private
(the fingerprint reads the version off a snapshot, as the tests do).

**The cut as proposed (unsigned; it goes into ROADMAP §113 once signed).**
Six steps, five `none` and one `batch`, at the leans above; call 5 the
other way adds a `stop` (113g, the itch sitting) and a boot count the
production build shows.
- **113a — the build ID.** One function (the version, the short commit,
  `-dirty`) shared by `vite.config.ts`'s `define` and the recorder's
  `openTree`; a module that exports it, with a named fallback where
  nothing baked it; an environment variable that pins it. Exit: a built
  bundle carries the ID git gives, read from `dist/`; a planted
  uncommitted change builds `-dirty`; two pinned builds are byte-identical;
  a recorder worktree stamps clean. Read `none`.
- **113b — the store's core, headless.** `src/store/`: sections with their
  own versions, the two read policies, a memory adapter, a status that
  reads "can't save" and never throws. Exit: planted cases on both sides
  of each policy (an unknown key dropped, a missing one defaulted, a bad
  value reset alone; a stale strict section rejected with the lenient ones
  untouched); a throwing adapter on read and on write. Read `none`.
- **113c — the three adapters and the boot read.** The web adapter
  (proven by a round trip, never by `typeof`), the Electron adapter over
  `window.shellStore`, the choice; the store as `main.ts`'s first static
  import, with a pin that its import graph reaches no catalog. Exit: the
  round trip in the pane on the dev server and on the production build,
  read back from `localStorage` itself; under Electron across two launches
  of one profile, a fresh profile reading empty; a planted throwing store
  boots the game and reads "can't save". Read `none`.
- **113d — the headless guard.** D1's ESLint rule and its twin on
  `npm test`. Exit: both fail on a planted import of the store from
  `src/sim`; the twin keeps a planted control in the suite. Read `none`.
- **113e — the save's fingerprint and the rejection rule.** A test pins
  `RunSnapshot`'s structure beside its version; the run slot's strict read
  rejects a stale or unreadable save and leaves settings and progress
  alone; the message's key and English text (shown, and read, at §115).
  Exit: the test fails on a planted shape change in a nested optional
  field without a bump, and passes with the bump and the re-pin; a planted
  v45 slot reads as rejected. Read `none`.
- **113f — the ID, shown.** The corner label on character select;
  `__probe.ready()`'s report carries the build and the store's status.
  Read `batch` (at the next stop, else §114's kickoff): character select
  shows the version and seven hex digits, small, in a corner; wrong is a
  label over the cards or the chips, one that ignores the text-scale
  token, or `-dirty` on a clean build.

### The §113 shape-lock (2026-10-01, the user's) — SIGNED

Signed at 10:17 as proposed: six steps, five `none` and one `batch` (113f),
with no `stop`. All six calls ✅ DECIDED at the session's lean: one key per
section; the fingerprint by the type checker if step zero measures it at a
few seconds or less, else by shapes from driven runs; the ESLint rule and
its twin on `npm test`; the ID on character select until §116's menu; the
itch leg deferred to §116's sitting ("I'm happy to defer it!"), which
re-scopes the phase's exit to the web and Electron; the two-tab lock at
§115. ROADMAP §113 carries the cut and the re-scoped exit, and §115 and
§116 each carry their item.

The context handoff number is **400k for this session, with the hour
clock**, as at §112: the session pauses for the meter at the first step
boundary after 11:17, or mid-step if one step runs an hour.

The user asked what "Node's `localStorage` being broken" meant and whether
a version needs updating. No: the game's store runs in a browser or in
Electron, never in Node. Node runs the tests and the fuzz tools, and Node
25 defines a `localStorage` global of its own there, which holds nothing
usable unless Node is started with a storage file. The finding only rules
out one way of writing the adapter's choice (asking whether the global
exists), since that test would pass under `npm test`.

### 113a — the build ID (2026-10-01) — read `none` ✅

**Step zero.**
- **A recorder worktree reads clean.** `openTree('HEAD')`, then `git
  status --porcelain` in it: empty, with the junction listed only under
  `--ignored` (`!! node_modules/`). The hypothesis that an older commit's
  build would be stamped `-dirty` is refuted.
- **The `dist/` oracle, re-made.** A scratch script (SHA-256 per file, a
  total over the sorted `path hash` lines) read `d77a6381…` over 32 files
  on a production build of `4c1cc96`, the total ab584af9 recorded, so the
  script is the same instrument.

**Built.** `scripts/build-id.mjs`: `commitStamp(cwd)` and `buildId({ cwd,
live })`, plain JS with a `.d.mts` beside it, because the Electron tools
import it outside tsc. `vite.config.ts` bakes `__BUILD_ID__`;
`src/buildId.ts` exports `BUILD_ID`, or `unbaked` where nothing baked it;
`main.ts` stamps it on `<html data-build>`, which gives a production build
(no `__probe`) a place to be asked; `tree.mjs`'s working-tree stamp is
`commitStamp`.

**One addition inside the signed intent, flagged: `-dev`.** The dev server
and Vitest compute the ID when they start and then outlive commits and
edits, so an ID of theirs that named a clean commit would be a claim
nothing checks. Under `serve` the ID ends `-dev`; a build never does. §114
decides what replay does with it (the lean: refuse it as it refuses
`-dirty`, unless it adds a live check).

**The exit** (each ID read from the built files, `14fe8bd` unless said):

| build | the ID in `dist/` | hash |
|---|---|---|
| a clean tree | `0.0.0+14fe8bd`, in the index chunk only | `f946025a…` |
| a planted untracked file | `0.0.0+14fe8bd-dirty` | `22367c36…` |
| the clean tree, pinned | `pin-113a` | `2e8a1a66…` |
| the planted tree, pinned | `pin-113a` | `2e8a1a66…`, identical |
| a recorder worktree at HEAD (development mode) | `0.0.0+14fe8bd`, stamp `14fe8bd` | — |
| before the commit, the real uncommitted changes | `0.0.0+4c1cc96-dirty` | — |

- **In the page:** the Electron runner's development-mode build read
  `0.0.0+4c1cc96-dirty` off `<html data-build>`, the commit and mark its
  own progress line named (`4c1cc96-dirty`, from `tree.mjs`); the dev
  server in the pane read `0.0.0+4c1cc96-dirty-dev`; under `tsx` the
  module read `unbaked`.
- **The run is left alone:** `npm run probe -- …/drive-run.js --seed=7`
  exits 0 on log `a59ee48f` (12 battles, 46 commands), the known answer.
- **Headless** (`tests/build-id.test.ts`, 7): the forms over a fake git
  (clean, dirty, live, no git, a pin, an empty pin), one case against the
  real git, and the constant Vite baked for the test run.

3145 tests in 210 files (+7, +1). The fuzz smoke did not fire, as predicted.

**Not verified:** a tree with no git at all (the `nogit` form is pinned
over a fake only); the ID on the dev server after a commit lands under it
(the reason for `-dev`, reasoned, not planted).

### 113b — the store's core, headless (2026-10-01) — read `none` ✅

**Built** (`src/store/`): `store.ts` (`createStore({ adapter, build })`,
the section types, the two policies, the status) and `adapter.ts` (the
adapter's shape and a memory one). ARCHITECTURE's tree has the behaviour;
what the cut didn't spell out, each inside its intent:
- **The envelope is `{ v, build, data }`.** The signed layout said
  `{ v, data }`; D2 stamps the build on the store and the saves, and the
  envelope is where a section carries it.
- **A read that throws makes the store read-only for the page's life.** A
  store that falls back to defaults and then saves would write those
  defaults over what it couldn't read.
- **A strict rejection leaves the stored text in place** and returns it as
  `raw`, because D2 keeps a rejected run's journal exportable. A strict
  section brings its own `load`, so "the format changed" (the version) and
  "loading it fails" (the loader throws) are one read with two reasons.
- **A lenient section's version is written and never judged,** which is
  what "no upload wipes a player's settings" needs; a field whose meaning
  changes gets a new name.
- **The meta key is rewritten only when missing or another build's,** so a
  boot on the same build writes nothing, and `previousBuild` is null for a
  new player.
- **The store takes zod schemas but imports only zod's types,** so the
  module that boots first has no runtime import beside the adapter.

**The exit** (`store.test.ts`, 19; stored text is planted in and read back
from the adapter's own map, never through the store):
- **Lenient, both sides:** one stored section with a good value, a value
  its schema refuses, a missing key and an unknown key reads as the good
  value kept, the refused one at its fallback alone, the missing one at
  its fallback, the unknown one gone; the read rewrites nothing, and the
  next write stores the declared fields only. Six kinds of text that isn't
  an envelope read as an empty section. Versions 1, 3 and 99 read the same.
- **Strict, both sides:** absent is `empty`; current loads; a planted v45
  under a v46 section is `rejected: stale` with `found: 45`, the text
  untouched, and the settings beside it still read their stored values;
  broken JSON and data the loader refuses are `rejected: unreadable`.
- **A throwing adapter:** on read, the store is created, reads fallbacks,
  says can't-save with the error's name, and calls the adapter's write 0
  times across a patch, a strict write and a clear; on write, `patch`
  returns false, the listeners hear it once, the value holds in memory,
  and the next good write recovers; a write that rejects later arrives
  through the status.
- **The controls on the tests:** two faults planted together in
  `store.ts` (the read-only rule removed; unknown keys kept) failed the two
  tests written for them and no other (17 of 19 passing), and were
  reverted.

One slip of mine, caught by the first run: a test asserted the in-memory
value after a `clear`, which had rightly reset it; the assertion moved
above the clear.

### 113c — the three adapters and the boot read (2026-10-01) — read `none` ✅

**Built.** `web.ts`, `electron.ts`, `choose.ts` and `index.ts` (the page's
store, made at import), and `import './store'` as `main.ts`'s first line.
The preload and `main.mjs` are unchanged: the Electron adapter keeps the
store's keys as one JSON object in the file the spike already reads and
writes. ARCHITECTURE's tree has each file.

**Two changes inside the signed intent, flagged.**
- **The round trip proves saving; it doesn't choose the adapter.** The cut
  said the web adapter is "proven by a round trip". Choosing on a write
  would send a player whose quota is full to the memory fallback, and
  their stored settings would go unread. So `localStorage` is chosen when
  it has its three methods and a read doesn't throw, and the round trip
  (`prove`, on a scratch key) runs at a boot that writes nothing else and
  only sets can't-save. Still never `typeof`: Node 25's shape, an object
  with no `setItem`, is a pinned case.
- **`?store=deny`, DEV only:** the planted refusal the exit asks for, as a
  URL dial so later reads of the can't-save UI can reach it in play, in
  the pane, in Firefox and under Electron. The first build carried its two
  strings into `dist/` (the branch sat inside `chooseAdapter`, behind a
  runtime argument). Moved behind the DEV constant in `index.ts`, the
  production bundle has 0 of each; the same search found 1 of each before
  the move, which is its control.

**The exit.** Stored state was read from `localStorage` or from
`store.json` by Node, not through the store.

| shell | check | result |
|---|---|---|
| the pane, dev server | first load | `asciibattler:meta` stamped `0.0.0+6904a87-dirty-dev`; `web`, can save |
| | a section patched, the page reloaded | the item in `localStorage`; the next page's store read 41 back, `previousBuild` the stamp; cleared after |
| | `?store=deny`, a settings item planted first | the game booted (character select, 3 UI children); `memory`, can't-save, "planted by ?store=deny"; the read gave the fallback, not the plant; `patch` false; the planted item and the stamp untouched |
| the pane, production build (`dist-preview`) | first load | no `__probe`; `data-build` `0.0.0+6904a87-dirty`; the stamp in `localStorage` |
| | this build's stamp planted with a marker, reloaded | the marker kept: read, judged current, nothing written; no scratch key left |
| | another build's stamp planted, reloaded | re-stamped, the marker gone |
| Electron, production build | a fresh profile | the preload saw `null`; `store.json` then holds the stamp |
| | the same profile again | the preload's text equals the file; the file unchanged |
| | the same-build plant with a marker and a second key | the file still the plant, byte for byte |
| | another build's plant, the second key beside it | re-stamped, the second key kept, no `.tmp` left |
| | a second fresh profile (the control) | `null` |
| | a file that isn't the store's (110a's raw text) | the game boots; the file replaced by the stamp |
| | `?store=deny` on the production build | ignored: the stamp written |
| Electron, development-mode build | `?store=deny` | `ready()` passes; no file written |
| | no query (its control) | the stamp written |

The two plants are what make the production legs a read and not only a
write: the same page leaves one stored stamp alone and replaces the other,
so the outcome depends on what it read.

**Headless** (+20): `adapters.test.ts` (15: each adapter over a fake host,
the choice in order, a storage that reads and can't write, a getter that
throws, a store round-tripped through the Electron file text) and
`tests/store-boot.test.ts` (5: `./store` is `main.ts`'s first import; the
run-time graph from `index.ts` is exactly six files in `src/store/` and
`src/buildId.ts`, no package; the walker's controls: `main.ts`'s graph
reaches Game, the locale and the catalogs, and a planted catalog import is
reported while a type-only one is not). 3184 tests in 213 files. The fuzz
smoke did not fire.

**The kit, in use:** the pane's reload came up 0×0 and `ready()` threw by
name with the fix (`resize_window`), which worked on the next call. A
covered trap, held; not filed as a papercut.

**Also added:** the `dist-preview` launch config (`vite preview` over
`dist/`, port 5192), since the pane tools attach only to a server they
start; `process/browser-pane.md` names it and the store's handles.

**Not verified:** a real browser with site data blocked (the refusal is
planted); a real full quota (planted over a fake `Storage`); Firefox (the
pane is Chromium); itch's iframe (deferred to §116).

### 113d — the headless guard (2026-10-01) — read `none` ✅

**Built.** `eslint.config.js`: `no-restricted-imports` on `src/sim`,
`src/run`, `src/bot` and `tests/fuzz`, for any specifier ending in `store`
or inside a `store/` folder (D1's rule). `tests/store-guard.test.ts`: the
twin on `npm test`. The import walker 113c wrote moved to
`tests/importGraph.ts` for both pins, and now takes many entries and
remembers each file's first importer.

**The twin is wider than the rule, on purpose.** The ESLint rule sees one
file's own imports. The test follows the run-time graph from all 298
files in the four folders, so a headless file that reaches the store
through a game-layer module fails too, and the failure prints the chain.
A type-only import passes the test (it is erased) and fails the rule.

**The exit.** With `import '../store'` planted at the top of
`src/sim/positioning.ts`:
- `npx eslint src/sim` exits 1: `1:1 error '../store' import is restricted
  …  no-restricted-imports`, the one problem;
- `tests/store-guard.test.ts` fails its first test, listing six chains
  from `src/sim/positioning.ts → src/store/index.ts` onward.
Removed, ESLint exits 0 with no output on the four folders and the test
passes; `git status` shows no file under `src/sim`. The test keeps its own
planted control (an in-memory graph: a direct import, one through two
modules, a type-only one). 3187 tests in 214 files (+3).

**A guess of mine the test corrected:** "more than 300 files" in the
coverage check failed at 298, which a separate `find` confirmed (120, 41,
23, 114); the floor is 250.

Both pins joined the Cursor's permanent gates.

### 113e — the save's fingerprint and the rejection rule (2026-10-01) — read `none` ✅

**Step zero: the type checker costs about half a second.** A `ts.Program`
over `src/run/Run.ts` with the repo's tsconfig, and a walk of
`RunSnapshot` to its leaves, took 493, 454 and 468 ms on three warm calls
under tsx. The full suite ran 38.2 s with it in, against 36.4–38.1 s over
this session's earlier runs. So the fingerprint is by types (call 2), and
the driven-run fallback wasn't built.

**Built.**
- `tests/saveShape.ts`: the walker and the pin's rules.
  `tests/run-snapshot-shape.txt`: the pinned print, 34 definitions in 235
  lines, `RunSnapshot` first. `tests/save-fingerprint.test.ts`: the pin.
  `npm run save:fingerprint` (`scripts/save-fingerprint.ts`): the re-pin.
- `src/store/runSlot.ts`: the run slot's strict section and
  `runRejectedMessage()`; `save.rejected` in `locales/en/ui.json`: "This
  run was saved by an older version of the game and can't be continued.
  Your settings and unlocks are kept." The wording is read at §115, where
  it is first shown.

**A prediction that missed, flagged: `RUN_SCHEMA_VERSION` is exported, so
the fuzz smoke fires on this commit.** The cut predicted it would stay
private. Exported, the slot's envelope carries the save format's own
number, so a stale save is rejected with `found: 45` before `Run.fromJSON`
runs at all; left private, every stale save would have gone through
`fromJSON` and come back as `unreadable`, with no version to report. One
word in `Run.ts`, no behaviour change, and D2 names that number as the
format.

**The re-pin can't be used to skip the bump.** A test that only compared
the types with a file would pass again the moment the file was
regenerated. So the re-pin refuses a changed shape at an unchanged version
unless it is given a reason (`--compatible="…"`), and writes the reason
into the file's header, where a review sees it; a bump clears it. That is
for a change old saves survive, such as a widened union.

**The exit, on the real types.** With `readonly planted?: number` added
to `EncounterMap` (nested under `bossEncounterMap` and `encounterMap`):
- the test fails: "RunSnapshot's structure changed and RUN_SCHEMA_VERSION
  is still 46 … First difference, line 81: pinned: `terrainSeed: number`,
  now: `planted?: number | undefined`";
- `npm run save:fingerprint` exits 1 with the same message, and the file
  is byte-identical after;
- with the version bumped to 47, the test fails a second way ("pinned at
  46: run `npm run save:fingerprint`"), the re-pin writes, and the test
  passes, 8 of 8.
Both plants reverted: the re-pin at 46 restored the file byte for byte,
and `Run.ts`'s diff is the export and its comment.

**The slot** (`runSlot.test.ts`, 5, each on a real `Run`'s snapshot): a
run round-trips through the store and saves to the snapshot it was loaded
from; a planted v45 slot is `rejected: stale`, `found: 45`, its loader
called 0 times, its text and the settings beside it untouched; a current
slot holding an unknown character, an unknown daemon, an older snapshot or
no snapshot is `rejected: unreadable` with the error's own message.

**The instrument's known answers** (`save-fingerprint.test.ts`, 8): the
walker's print of a fixture type equals text written out by hand before
the first run (a union, a tuple, a record, a `Set`, an optional field, a
type that contains itself, named types printed once), and it sees one
optional field added three levels down; the type-level version equals a
live run's `schemaVersion`, and the root block's 42 property names equal
`Object.keys(run.toJSON())`, sorted.

3200 tests in 216 files (+13).

**Not verified, and a limit:** the fingerprint sees structure only. A
change of meaning with no change of type (95f's renamed key inside a
string) still needs a reviewer to bump. A damaged save at the current
version that `fromJSON` happens to accept is §115's chaos driver's to find.

The hook ran the fuzz smoke on this commit, as flagged: 582 tests in 62
files, green, at `08e0c59`.

### 113f — the ID, shown (2026-10-01) — ◐ BUILT, UNREAD (a `batch` read)

**Built.** `CharacterSelectScreen` appends `.charselect-build`, the
build's ID as text, pinned to the screen's bottom-right corner (the
top-left is the chrome column's, the top-right a corner button's on other
screens): `--text-11`, `--color-gray-88`, the screen's mono face,
selectable so it can be copied into a bug report. It is inside the screen,
so it fades with it and is gone once a character is chosen. `ready()`'s
report gains `build` and `store` (the adapter, can-save, the error).

**Checked in the pane** (Chromium; the dev server, so the ID ends `-dev`):

| check | result |
|---|---|
| 1280×720 | the label reads `0.0.0+08e0c59-dirty-dev`, the same text as `<html data-build>`; its box is (1102, 694)–(1264, 708); it overlaps none of the heading and the three cards; a screenshot shows it alone in the corner |
| the text-scale token | 11px at the 16px root, 13.75px with the root set to 20px |
| 375×812 | no overlap; the last card ends at y 782 and the label starts at 786 |
| `ready()` | `build` equals the label; `store` reads `web`, can save |
| the console | no errors |

3200 tests, unchanged (`src/ui` is eyeball-only); typecheck clean.

**After the commit** (`2865130`, a clean tree): `npm run probe --
shell/electron/probes/drive-run.js --seed=7` exits 0 on log `a59ee48f`
(12 battles, 46 commands), the known answer, so the phase leaves a run
alone; its `ready()` report reads `build: 0.0.0+2865130` (no `-dirty`, no
`-dev`) and `store: electron`, can save.

**Not verified:** Firefox; the label itself on a clean build (the clean
ID was read from the kit's report and, at 113a, from the bundle; the label
shows the same constant). **A limit:** on a viewport too
short for the three stacked cards the label would sit over the last one;
the screen itself already overflows there.

**The read** (`batch`, the user's): character select shows the version and
seven hex digits, small, in the bottom-right corner. On the dev server it
reads `0.0.0+<commit>-dev`, with `-dirty` before `-dev` when the tree has
uncommitted changes; a production build of a clean tree reads
`0.0.0+<commit>` alone. Wrong is a label over the cards or the chips, one
that doesn't grow with the text scale, or `-dirty` on a clean tree.

### 113f — THE READ (2026-10-01, the user's): one finding → 113f-post

**The user, in Firefox on their own dev server (`:5173`):** "The version is
showing up as `0.0.0+4c1cc96-dirty-dev`, but git status is reporting a
clean working tree. Already tried a hard refresh." The read's own script
names that as wrong, and it is: the label states a commit and a dirtiness
that stopped being true an hour earlier.

**The cause, measured.**
- Their server serves that value from Vite's own env module:
  `curl http://localhost:5173/@vite/env` holds `0.0.0+4c1cc96-dirty-dev`
  (on the dev server a `define` constant is a global set there, not text
  replaced in `buildId.ts`). The tree was clean at `1e8fae9`.
- `4c1cc96` was HEAD, with 113a uncommitted, when `vite.config.ts` was
  last edited; Vite restarts a dev server when its config changes, and
  the config has not changed since `14fe8bd`. So the server computed the
  ID then (the restart is inferred from the value; it wasn't watched) and
  has kept it through eight commits.
- **The control:** a fresh `dev-preview` server on the same tree read
  `0.0.0+1e8fae9-dev` in the label, in `<html data-build>` and in
  `ready()`'s report.

**This is the case 113a listed as not verified** ("the ID on the dev
server after a commit lands under it … reasoned, not planted"). `-dev` was
added for it, to mark the commit as the one the server started on. The
read shows a mark isn't enough: a reader takes the commit and `-dirty` at
their word. The pane sessions never saw it, because each started a fresh
server.

**Three shapes for the fix (the user's pick; proposed in the
conversation):**
1. **Stamp the ID at each page load on the dev server** (the session's
   lean). A serve-only plugin injects the ID into the HTML it serves, as
   the probe stand-in is injected, computed per request (two git calls),
   and `src/buildId.ts` prefers it over the baked constant. The label is
   then true at every load, and Vite already reloads the page when a
   `.ts` file changes. It also settles the item §114 was carrying: a
   journal recorded on the dev server gets the commit of the load that
   recorded it, and D4 opens a segment at every load.
2. **`<version>+dev`, with no commit,** on a served page. One line, and
   honest, but a journal from the user's own play could never be replayed
   on its commit, which D9 wants.
3. **Leave it and correct the read script.** Not recommended: the label
   stays misleading for whoever reads it next.

**The rollback rule** (a `batch` finding that reopens two or more later
commits) isn't met: the finding reopens 113a alone, and no `batch` read is
left in the phase. 113f-post is inserted with a `stop` read, since the
close waits on it.

**The meter read 520k** at this read (11:15), against this session's
400k; the hour clock would have fired two minutes later. The session
recommended handing 113f-post, the close and §114's kickoff to a fresh
session.

**The hand-off (the user's):** "I'll see you in the post session to change
it!" So the label changes, and shape 3 is out; between 1 and 2 the user
has not picked.

### 113f-post — the ID stamped at each page load (2026-10-01) — the `stop` is open

Session c3c1aee1. **The pick (the user's):** shape 1, the ID stamped at
each page load on the dev server, and it keeps `-dev` ("Let's go with 1,
and keep dev!"). `-dev` now reads "true as of this load": a stylesheet edit
is hot-swapped without a reload, so a loaded page can still drift from its
label (reasoned, not planted). §114 decides what replay does with it.

**Step zero.**
- **The stale ID still reproduced:** the user's `:5173` server served
  `0.0.0+4c1cc96-dirty-dev` from `/@vite/env` over a clean tree at
  `ed1b99b`.
- **Vite transforms the HTML on every request:** the dev server's HTML
  middleware calls `server.transformIndexHtml` per page
  (`node_modules/vite/dist/node/chunks/node.js:25441`), so a stamp put there
  is never cached.
- **The two git calls cost about 90 ms from Node** (`buildId({ live: true
  })`, 7 runs: 81 / 89 / 136 ms min / median / max; `rev-parse` and
  `status --porcelain` about 45 ms each). The same two calls timed from Git
  Bash read 663–728 ms, which is the shell's own process cost: the dev
  server is a Node process, so Node is the instrument.

**Built.**
- `vite.config.ts`: `buildIdAtLoad`, a serve-only plugin whose
  `transformIndexHtml` asks `buildId({ live: true })` for every page and
  injects an inline script at the top of the head. The `define` stays, for
  Vitest and as the page's fallback.
- `src/buildId.ts`: the global's name, `atLoadScript(id)` (the script's
  text, `<` escaped), `resolveBuildId(baked, atLoad)`, and `BUILD_ID`
  reading the stamp first behind the DEV constant.
- `tests/build-id.test.ts` (+4): the order of preference; the script run
  as text against a fake window; an ID that tries to close the script
  element; and the plugin taken from the real config (`command: 'serve'`),
  serve-only, its stamp equal to what git says, asked in the test.

**The exit.**

| check | result |
|---|---|
| a production build pinned to `pin-113f-post`, before and after | `4e969d27…` over 32 files both times, the per-file lines identical; no `BUILD_ID_AT_LOAD` in `dist/` |
| its control: the DEV gate planted open | `11646424…`; the index chunk and `index.html` differ, and the chunk holds the global's name once |
| the test's control: the plugin planted out of the config | 1 of 11 fails, the plugin test, on `apply` |
| the pane (`dev-preview`, a server started on the dirty tree at `ed1b99b`), before the commit | the stamp, the label, `<html data-build>` and `ready()` all `0.0.0+ed1b99b-dirty-dev` |
| the commit (`d06ebc6`) lands under that server; a reload | all four read `0.0.0+d06ebc6-dev`, and the store's meta key is re-stamped with it; `/@vite/env` still holds `0.0.0+ed1b99b-dirty-dev`, so the stamp is what answered |
| an untracked file planted; a reload | `0.0.0+d06ebc6-dirty-dev` |
| the file removed; a reload | `0.0.0+d06ebc6-dev`; the label's box (1144, 694)–(1264, 708); no console errors |
| the user's `:5173` server, by `curl`, after the commit | its HTML stamps `0.0.0+d06ebc6-dev`; its `/@vite/env` holds `0.0.0+ed1b99b-dirty-dev` |
| an editor page (`/tools/run-config/`) | stamped too |
| the cost on the server | `/` in 111–183 ms over 5 requests, against 2 ms for a request with no stamp |
| `npm run probe -- …/drive-run.js --seed=7` at `d06ebc6` | exit 0, log `a59ee48f` (12 battles, 46 commands); `build: 0.0.0+d06ebc6` (a build: no stamp, no `-dev`) |

3204 tests in 216 files (+4). The fuzz smoke did not fire.

**A finding from the controls: a running dev server kept the planted
config.** The two controls were planted together (the gate in
`src/buildId.ts`, the plugin out of `vite.config.ts`) and reverted
together. After the revert the user's `:5173` server served HTML with no
stamp, while a fresh server on the same tree stamped; a `touch` of
`vite.config.ts` brought the stamp back on `:5173`. Both files are config
dependencies, so each edit restarts a dev server; the inference (not
watched) is that the server restarted on the first of two back-to-back
edits and missed the second. So a control planted in the config or a file
it imports reaches every running dev server, and its revert isn't done
until the server's own HTML has been read. `process/browser-pane.md` has
the line; a papercut is filed.

**Not verified:** Firefox (the user's read); the drift after a hot-swapped
stylesheet; a tree with no git on the dev server (the plugin would stamp
`nogit-dev`, by `buildId`'s pinned form). The 140 ms could be halved by
running the two git calls side by side; left alone, since it is a dev page
load only and `commitStamp` is shared with the recorder.

**The read** (`stop`, the user's): on the long-running `:5173` server, in
Firefox, reload character select. The label reads `0.0.0+<HEAD>-dev` for
the commit `git log -1` names, with `-dirty` only while `git status` lists
something. Wrong is an older commit, or `-dirty` over a clean tree. No
restart by hand is needed: the server restarted itself when
`vite.config.ts` changed.

### 113f-post — THE READ (2026-10-01, the user's) ✅

**The user, in Firefox on their long-running `:5173` server:** "I'm
getting the right stamp, Claude!" The server had not been restarted by
hand; by then two commits (`d06ebc6`, `bf5aef6`) had landed under it. No
finding.

### §113 closed (2026-10-01)

Session c3c1aee1. Every step is read: five `none`, 113f's `batch` (one
finding) and 113f-post's `stop`. The close is paperwork: ROADMAP §113
demoted, the phase summary in `retro/sessions.md`, the HANDOFF Cursor
moved on. At `bf5aef6`: 3204 tests in 216 files and typecheck clean (the
hook's run), the seed-7 drive on `a59ee48f` (at `d06ebc6`; the commit
after it is docs only).

**Carried out of the phase** (each in ROADMAP under its phase): the itch
leg of the store's round trip (§116's sitting); the two-tab lock (§115,
with the run slot's first writer); what replay does with a `-dev` journal,
and the store's size budget (§114).

**Before the §114 kickoff** the user wants to talk about the context
handoff number, so the kickoff waits on that conversation.

### The context numbers, restated (2026-10-01, the user's)

Session c3c1aee1, between the §113 close and the §114 kickoff. At the
close I told the user that neither context trigger had worked: the last
three sessions read 507k and 520k against 400k and 424k against 350k, the
step-boundary check never fired, and the hour clock didn't either. **The
user's reading is that both did their jobs, and the framing was wrong.**
The reads doctrine exists so a session can work without interruption up to
a `stop` or a phase end, and such a stretch can take a few hundred
thousand tokens. The number is how the user and the session decide whether
there is room to start another stretch; it was never a point to halt at.
The hour clock keeps one long run of steps from ending far past 600k,
which is nearer the user's real halt point. By that reading every recent
session started under the number, ran its stretch and handed off under
600k.

**Why sessions read it as a ceiling:** the Cursor held one number, named
"the context handoff number", followed by a history of readings "against"
it, and the 600k was written nowhere. Three sessions recorded an overrun on
that evidence: the meter addenda of f74660ed, ab584af9 and fc750343 in
`retro/sessions.md`, the §112 and §113 phase summaries, and in the
friction log one papercut (113f) and one mild `distress` entry (113e),
both fc750343's.

**Restated** (`process/planning.md` "Context: the gate, the breaker, the
halt"; the Cursor carries the numbers): the gate (350k) decides where a
stretch starts; the breaker is a wall-clock span; the halt is about 600k.
None is a hard limit ("if we hit 630k, that's not a catastrophic
failure").

**The breaker is set by the user at each gate, not by a rule.** I had
proposed deriving it from the reading (an hour from a low start, half an
hour from above about 250k), because a stretch started just under the gate
and run for a full hour would end far past the halt. The user's call
instead: they name the breaker before each stretch. Their reasons: the
500k-an-hour figure is a small sample, none of the numbers is hard, and a
box run needs the breaker suspended, since its hours are spent waiting. I
agree: the user holds the meter and the rate, and is present at every
gate. One default is mine and flagged to the user: a gate answered with no
breaker means one hour.

**Withdrawn:** fc750343's proposal to ask for the meter at every step's
commit. It would interrupt the stretches the doctrine protects.

**For the round-close welfare read:** the context entries before today
were written with 350k read as a ceiling.

**The first reading under the restatement: 222k at 14:09**, at the gate
before the §114 kickoff, after 113f-post and the §113 close in this
session (which began near 12:30 from a fresh context).

## Phase 114 — the run journal and its export

### The §114 audit and cut (2026-10-01) — the shape-lock is open

Session c3c1aee1. **The gate:** 222k at 14:09, under 350k; the kickoff
stretch started at 14:31 with a one-hour breaker (the user's). ✔ = read by
this session at file:line, or measured.

**What is there.**
- **A battle already records and replays.** `TraceRecorder` (DEV) is a pure
  bus subscriber: the encounter from `battle:started`, every
  `command:applied` with its effective tick, the outcome (✔
  `src/dev/TraceRecorder.ts:57-103`). `replayTrace` rebuilds the World from
  the encounter and injects each command before its stamped tick, refusing
  another config hash (✔ `src/dev/replayTrace.ts:73-135`). The stamp rule
  is one rule for parked and running drains (✔ `World.ts:951-970`).
- **The sim takes three commands:** `noop`, `setObjective`,
  `clearObjective` (✔ `src/sim/Command.ts:19-21`).
- **Nothing records a run.** Every `RunCommand` in the game passes
  `Game.dispatch` (✔ `Game.ts:451-611`): the screens hold Game as their
  dispatcher, Game dispatches the turn-outcome `advanceTurn` itself after
  the outro (`:392-399`), and the board fixtures and the kit's driver call
  `game.dispatch`. Outside tests, `run.dispatch(` appears only in
  `Game.ts` (✔ a search of `src`). Two commands are Game's own:
  `chooseCharacter` constructs the Run and `resetRun` replaces it
  (`:457-464`).
- **What a run is built from:** `new Run(config.seed ?? Date.now(), bus,
  config)`, with the config parsed once from the URL and the chosen
  character laid over it, and `pauseAtTurnGates` set by Game (✔
  `Game.ts:705-720`). `RunConfig` also has fields no URL reaches
  (`eventCatalog`, the sector map), and `runConfigToQueryString` is the
  parser's inverse for the fields it sets (✔ `RunConfig.ts:34-170, 420`).
  `run:started` carries the seed (✔ `events.ts:462`).
- **A whole run's headless loop exists in the fuzz harness:** a bus, a Run,
  a World built at `battle:started` with `installBattleRules` and
  `spawnEncounter`, ticks to the end or the draw at the cap, and a gated
  mode for turn-intro commands, which its own comment says is RNG-aligned
  with the ungated one (✔ `tests/fuzz/harness.ts:511-557, 719-734,
  779-1000`). A journal replay is that skeleton with the journal in the
  strategy's place.
- **One command is legal in mid-battle:** `discardPacket`, in any phase (✔
  `Command.ts:164-172`), so a run command needs its place among a battle's
  ticks.
- **The live battle** builds its World in `BattleScene` (✔ `:94`) and
  drains commands while parked (`:253`). Its clock was not read: how a
  page-side replay would place an order before its tick is a hypothesis
  below. The kit's `drive()` fights by hand-driven frames.
- **The recorder records one battle.** Its inputs are a fixture or a seed's
  root battle, and its page script cuts at the first scene swap (✔
  `record-cli.mjs:4-7`, `probes/record-page.js:1-40`). A run from a
  journal is a new mode.
- **`configHash()` lives in `src/dev`** and hashes all 33 raw config files
  (✔ `configHash.ts`). Two of them, `fuzz-strategies.json` and
  `redraw-level-fisher.json`, are imported by nothing else under `src` (✔
  a search), so the hash as it stands would bring both into the production
  bundle.
- **The store's `journals` section is named and has no user** (✔
  `store.ts:50`); the run slot's comment says the run's journal joins the
  snapshot there at §115 (`runSlot.ts:26`).
- **The end screen** is `GameOverScreen`: heading, the fallen table, one
  button (✔ `src/ui/GameOverScreen.ts:87-94`).

**Measured: what a journal weighs** (a scratch script; UTF-8 bytes of
`JSON.stringify`).
- **Human battle orders** (the 53g gauntlet fixture, 104 battles): 0 / 2 /
  5 / 8 commands a battle (min / median / p90 / max, mean 2.4); one
  command is 63–140 bytes (median 130); a battle's commands are 316 bytes
  on average, 933 at most. The encounter, which a journal doesn't carry,
  is 1.5–3.6 KB a battle.
- **Run commands** (eight `greedy` bot runs through the fuzz harness,
  seeds 1–8, every one a defeat, 10–30 battles; `Run.dispatch` wrapped in
  the script): 16–71 commands in 0.7–3.7 KB. The bot ran ungated, so the
  game's two `advanceTurn`s a battle are not in that count (22 bytes
  each). `chooseRecruit` is the heavy one: it carries a whole unit
  template, 1.6 KB of the longest run's 3.7.
- **A snapshot** (`Run.toJSON()` at each dispatch): 20–49 KB at its
  largest in those runs.
- **So:** a 30-battle run's journal is about 15 KB by these parts (3.7 KB
  of run commands, 1.3 of `advanceTurn`s, 9.5 of battle orders at the
  human mean), before per-command times; a won run is longer and none was
  measured. A snapshot is larger than the journal of the run it belongs
  to, so what a segment's start carries decides the size once loads exist.

**Hypotheses for step zero** (unmeasured).
- A run started from a board fixture replays from its run dials alone.
- The bundle's growth from the hash, with and without the two files the
  game doesn't otherwise load.
- What a download does in each shell: the pane, Firefox, Electron's
  hidden window, itch's sandboxed frame (the last waits for a sitting).
- `localStorage`'s limit in characters against bytes, in Firefox.
- Whether a page-side replay can place a battle order before its tick in
  the live `BattleScene`, which the recorder's run mode needs.

**Calls for the shape-lock, with the session's lean.**
1. **Where a run command is recorded.** At `Game.dispatch`, the one door
   every command passes (the lean): game layer only, no change under
   `src/run`, and it sees `chooseCharacter` and `resetRun`. The other
   shape is a bus event emitted by `Run.dispatch`, which changes the
   event stream and the sim-side catalog for no gain here.
2. **The journal's shape.** One ordered list per segment: run commands
   (with milliseconds since the segment opened), battle orders with their
   ticks, a checkpoint at each battle's end (winner, ticks) and the final
   snapshot's hash at the run's end, under a header (format version,
   build, config hash, the start). A start is a seed with the URL's dials
   as text, or a snapshot. The checkpoints are what "replays
   byte-identically" is judged against, and they name the battle a
   divergence starts in.
3. **A snapshot start carries the whole snapshot in this phase.** Only
   the DEV load (`Ctrl+Alt+L`) makes one before §115. Whether a later
   segment on the same build can carry a hash in its place is §115's
   call, where loads become real and the 20–49 KB matters; the format
   leaves room.
4. **Where the journal lives in this phase:** in memory while the run is
   played, and in the store's `journals` section once it ends. The run in
   progress is persisted by §115's autosave, as D3 says.
5. **How many finished journals are kept** (ROADMAP's decision point): by
   size, not count, since runs differ fourfold: the newest kept within
   about 1 MB of text, the oldest dropped first (the lean; about 50 runs
   at the measured size). The real number waits on a played run's bytes
   and Firefox's limit.
6. **The export:** one button on the run's end screen that downloads the
   journal as `.json`; the menu's copy arrives with the menu (§116).
7. **What replay refuses.** Another config hash, always. In the replay
   tool, also a build that isn't the tree's commit, a `-dirty` build (D2)
   and an unbaked one, unless forced. `-dev` is accepted (the lean): since
   113f-post it names the commit as of the page load.
8. **The config hash moves to `src/config/`**, since shipped journals are
   stamped with it (D4), and keeps hashing all 33 files unless step zero
   shows the two extra files cost the bundle more than they are worth.
9. **The recorder's carried work is two steps:** the stalls retimed
   ((B), with (C) the fallback), then the run mode. The display test
   turns the user's monitor off, so it needs their go when it runs.

**Predictions for the cut.** No snapshot bump (Run v46, World v36: the
journal is not in `RunSnapshot`), no RNG stream, no new bus event. The
fuzz smoke fires once, on the step that moves the hash into `src/config`.
One i18n key (the export button). The production bundle grows at the
wiring step, measured there.

**The cut as proposed (unsigned; it goes into ROADMAP §114 once signed).**
Seven steps: four `none`, one `batch`, two `stop`.
- **114a — the journal's format and its recorder, headless.**
  `src/journal/`: the types and a recorder fed by the dispatcher and the
  bus (the `TraceRecorder` pattern, storage-agnostic); the config hash
  moved. Exit: a gated headless run with planted battle orders is
  recorded, and pins hold the order of entries around a battle, a
  mid-battle `discardPacket`, and a reset closing the journal. Read
  `none`.
- **114b — the headless replay.** `replayJournal`: the Run from the start,
  a World per battle, each command at its place; it throws by name where
  a checkpoint differs. Exit: record, replay, and the final snapshots are
  equal byte for byte over several seeds with battle orders; controls: a
  command dropped, a tick moved, another config hash; a snapshot-started
  segment replays. Read `none`.
- **114c — wired into the game, and the replay tool.** `Game.dispatch`
  feeds the recorder, stamped with the build and the hash; the kit hands
  the live journal out; `npm run replay -- <file>`. Exit: the seed-7
  drive in the Electron runner still logs `a59ee48f`, and its journal
  replays under Node to the final snapshot hash the page reported; the
  refusals of call 7 planted; the bundle's growth measured. Read `none`.
- **114d — finished journals in the store.** At a run's end the journal
  goes to the `journals` section within the size cap. Exit: in the pane a
  run driven to defeat leaves its journal in `localStorage`, read from
  storage itself and replayed by the tool; a planted section over the cap
  loses its oldest; `?store=deny` plays on. Read `none`.
- **114e — the export.** The button on the run's end screen. Read `batch`
  (at 114f's stop): the end screen has "Export run" beside "Begin a new
  run"; clicking it saves a `.json` in Firefox, and `npm run replay --
  <that file>` passes. Wrong is no file, a file that doesn't replay, or a
  button outside the screen's idiom.
- **114f — the recorder's stalls, retimed.** Carried from §111: step zero
  switches the display at idle and under a planted steady load; each
  stall is retimed from the long-frame log; holding the display awake is
  the fallback. Exit: a recording across a display switch ends within 50
  ms of its sound, or the fallback is taken on evidence. Read `stop` (the
  retime or the fallback is the user's call if the retime falls short).
- **114g — the recorder replays a journal.** `npm run record --
  --journal=<file>`: the run driven through Game in the page, paced by the
  journal's times, battle orders at their ticks, 30 fps. Exit: a played
  run's journal becomes a clip; the page's final snapshot hash equals the
  journal's; no fault. Read `stop`: the sitting, a clip of a run watched.

### The §114 shape-lock (2026-10-01, the user's) — SIGNED

Signed at 17:04 as proposed ("signing all of those calls!"): seven steps,
four `none`, one `batch` (114e) and two `stop` (114f, 114g), and all nine
calls ✅ DECIDED at the session's lean: run commands recorded at
`Game.dispatch`; one ordered list per segment with a checkpoint at each
battle's end and the final snapshot's hash; a snapshot start carrying the
whole snapshot until §115 decides otherwise; the journal in memory while
the run is played and in the store's `journals` section once it ends;
finished journals kept by size, about 1 MB of text, the number soft; one
export button on the run's end screen; replay refusing another config
hash always, and in the tool another commit, a `-dirty` build and an
unbaked one unless forced, with `-dev` accepted; the config hash moved to
`src/config/`; the recorder's carried work as two steps. ROADMAP §114
carries the cut and the two resolved decisions.

**The gate: 350k at 17:04**, the gate's own number, so the build stretch
(114a–e, five steps, up to 114f's `stop`) goes to a fresh session: the
user's read ("So I guess that means a new session, no?") and mine, since
it is the phase's largest stretch. Between the readings (222k at 14:09,
350k at 17:04) the session wrote the context restatement and its commit,
ran the kickoff stretch (14:31 to 14:40: the audit, the byte measurement,
the entry above and its commit) and wrote the shape-lock message; it was
idle from 14:40 until the user's reply. The breaker never came due.

**For 114c, inside its intent:** its exit measures the bundle's growth,
which needs the `dist/` hash this session wrote from the recipe for the
third time (SHA-256 per file, the sorted `path hash` lines joined by
newlines, SHA-256 of that). The step should put that script in
`scripts/`.

### The build stretch's gate (2026-10-01, session 4d7da9f7)

A fresh session; pre-flight green at `34c6eec` (216 files, 3204 tests,
typecheck clean). The gate's answer, at 17:19: "400k and one hour". The
breaker is one hour, due 18:19. No meter reading was given, and what the
400k names (a reading can't be chosen) the session did not ask before
starting, since a fresh session starts the stretch under any reading of
it; it asks at the breaker.

### 114a — the journal's format and its recorder (2026-10-01) — read `none` ✅

**Step zero** (✔ = read at file:line). The cut's premise holds; four
things the audit had not read shaped the format, all inside the signed
calls.
- **The Run listens to the battle, not only to its end:** `unit:died`
  lands in the fallen ledger, which is saved (✔ `Run.ts:1300-1313`). So a
  run command sent during a battle, and a reset during one, have a place
  among the ticks that the Run's state depends on. A `run` entry sent in a
  battle and an abandoned end carry `tick`, the last tick that had run.
- **A run's end is emitted from inside a dispatch**, with the phase set
  and the caller's frames still to unwind (✔ `Run.ts:1680`, `:3674`,
  `:3698`). The recorder notes the end on the bus and takes the hash at
  `settle()`, which the dispatcher calls once the command has been applied.
- **A Run with the gates off starts the next battle inside the
  `battle:ended` emit** (the harness builds its World there, ✔
  `harness.ts:511`), and handlers run in subscription order. The recorder
  is constructed before the Run, which is also the game's order (the bus
  and the recorder are page-lifetime).
- **Every field a game's run can have set has a URL form:** `Game` takes
  its `RunConfig` from `parseRunConfigFromURL()` alone (✔ `Game.ts:169`),
  and `runConfigToQueryString` writes each of the eleven fields
  `parseRunConfig` sets (✔ `RunConfig.ts:374-461`). So a seed start is the
  seed and that text. The board fixtures are checked at 114c.

**Built.** `src/journal/journal.ts` (the format) and `JournalRecorder.ts`.
- A journal is `{ format: 1, segments }`. A segment has the build, the
  config hash, `openedAt`, the start (`seed` + `dials`, or a whole
  snapshot), one ordered list of entries, and the end (null while played).
- Entries: `run` (the command, `ms`, and `tick` in a battle), `order` (a
  battle command at its effective tick, `command:applied`'s stamp),
  `battle` (the checkpoint: winner, ticks).
- The end: `defeat` / `victory` / `abandoned`, `ms`, `tick` in a battle,
  and `snapshotHash`: `fnv1a` of the settled `Run.toJSON()` as JSON.
- `chooseCharacter` and `resetRun` are not entries: the first is the
  segment's start (the dials name the character) and the second its end.
  `JournaledCommand` excludes them by type, so `Game.dispatch` can only
  hand the recorder what is left after its two early returns.
- The recorder copies each command (`chooseRecruit` carries the offered
  template itself). It emits nothing and reads the clock only for `ms`.
- `src/journal` joins the headless roots of `tests/store-guard.test.ts`
  and the ESLint rule: "storage-agnostic" is held by the import graph.
- `configHash` moved to `src/config/` with its test, still over all 33
  files; the bundle question is 114c's, where something shipped imports it.

**Exit.** 13 tests over a synthetic bus, and 4 over whole gated runs
(`tests/integration/journal.test.ts`, driven by `tests/journalDrive.ts`:
the pane kit's `PHASE_ROWS` for the choices, the harness's battle loop,
and plants). The plants are the ground truth: an order parked before tick
1 and one in tick 6's drain in every battle, a `discardPacket` after tick
3 of the first, an abandon after tick 4 of the second. Pinned: each
battle's entries are `advanceTurn`, the two orders, the checkpoint; the
discard sits between the orders with `tick: 3`; the abandon closes with
`tick: 4`, the Run's hash and no checkpoint for that battle; the same run
with no recorder ends in the same state, and without the orders in
another (the control that the comparison can fail).
- **The planted bad case:** with the driver recording a command after
  applying it, three of the four whole-run tests fail (`advanceTurn` gains
  `tick: 0`). Reverted.
- **One run's numbers** (seed 7, `hops=3&character=soldier`, no orders): 10
  battles of 195–1004 ticks, a victory, 46 entries, 2,880 bytes of JSON.

**Counts.** Main 3204 → 3221 (216 → 218 files); typecheck clean; the
hook's fuzz smoke 582 green at the commit (`e6d35de`).

### 114b — the headless replay (2026-10-01) — read `none` ✅

**Step zero.** The premise holds as cut: `replayTrace` is the per-battle
rule (✔ `replayTrace.ts:91-120`, an order enqueued before its effective
tick, the live clock's body with the draw at the cap), and the harness's
`battle:started` handler is the World's construction (✔
`harness.ts:511-549`). The replay is those two with the journal's entries
in the strategy's place.

**Built.** `src/journal/replayJournal.ts`. Each segment replays on its own
bus: the Run from the start (`runFromStart`: `parseRunConfig` on the dials,
or `Run.fromJSON`, the gates on), a World per battle, each entry at its
place, the final `snapshotHash` compared. Two errors: `JournalRefused`
(another format or config hash, before anything runs) and
`JournalDivergence`, whose message names the segment, the battle and the
entry (`segment 0, battle 3, entry 23: the journal's battle ended player
after 788 ticks, and the replay's ended player after 787`). A segment with
no end replays as far as it goes. Which builds are accepted is left to the
caller (114c's tool), since this module doesn't know the build it runs on.

**Exit**, in `tests/integration/journal-replay.test.ts` and
`journal-replay-full.test.ts` (17 tests). Every journal goes through JSON
text first, as an exported file does.
- **Record, replay, compare the Runs' `toJSON()` bytes**, over four runs
  with orders at ticks 1 (parked), 6, 40 and 60 of every battle and a
  `discardPacket` after tick 3 of every battle that starts with a packet:

  | seed, dials | battles | end | entries | journal bytes | real discards |
  |---|---|---|---|---|---|
  | 7, `hops=3&character=soldier` | 9 | victory | 80 | 6,086 | 0 |
  | 11, `hops=4&character=priest` | 11 | defeat | 97 | 7,430 | 3 |
  | 23, `sectorHops=3&character=gambler` | 9 | defeat | 77 | 5,895 | 0 |
  | 5, `character=soldier` (the shipped length) | 21 | defeat | 202 | 15,574 | 2 |

  The last row's snapshot is 36,889 bytes, so the kickoff's "a snapshot is
  larger than its run's journal" holds with four orders a battle.
- **Also replayed to the same bytes:** a run abandoned in mid-battle; a
  segment started from a snapshot (a run saved at the map after its third
  battle, continued for three more), and the first half up to that
  snapshot; a segment with no end.
- **The controls**, each on seed 7's journal: the first `advanceTurn`
  dropped (the message names the entry, "an order for tick 1, and the
  replay is not in a battle"); an order dropped; an order moved from tick
  6 to 30; a checkpoint's tick moved by one (names battle 3); the final
  hash changed; another config hash and another format (both
  `JournalRefused`).
- **The abandoned end's tick is load-bearing, measured:** a run abandoned
  one tick before its third battle's end has more rows in the fallen
  ledger than the same run abandoned at tick 20, and its journal with the
  end's tick moved to 20 fails on the final hash. (The first attempt
  abandoned at tick 150 and moved it to 20: no unit had fallen by 150, and
  the moved journal replayed. The control now checks its own premise.)
- **Not observable in the bytes:** where among the ticks a mid-battle
  `discardPacket` lands. The discard has no sim seam and the cache is not
  read by the battle, so the replay placing it at another tick of the same
  battle would end in the same state. The recorder's test pins the tick it
  writes; the replay's use of it is checked only by the divergence rule
  (the battle must still be going at that tick).
- **The planted bad case:** with the replay enqueueing each order one tick
  late, 11 of the 17 tests fail. Reverted.

**Cost.** The replay tests sum to about 13.5 s, the shipped-length run 5.3 s
of it. In one file `npm test` took 50.0 s against 37.2 s at 114a; with the
shipped-length run in its own file (`journal-replay-full.test.ts`, so the
two run side by side) it took 44.5 s. One sample each, so the split's gain
is a direction and not a number; the suite is about 7 s slower than before
this step, on every commit. Splitting the controls out as well is the next
cut if that is too much.

**Counts.** Main 3221 → 3238 (218 → 220 files); typecheck clean.

### 114c — wired into the game, and the replay tool (2026-10-01) — read `none` ✅

**Step zero** (✔ = read at file:line).
- **Every run command in the game passes `Game.dispatch`,** as the audit
  said, Game's own `advanceTurn` after the outro included (✔ `Game.ts`,
  the `turn:resolved` handler). The recorder goes in as a field initialised right
  after the bus, so it is subscribed before the constructor builds a
  pinned run.
- **A battle's setup can enqueue a command of its own:** the enemy's camp
  pull, an enemy `setObjective` that drains at tick 1 (✔
  `battleSetup.ts:289-304`). The bus doesn't say who sent a command, so
  the recorder writes it as an `order`, and the replay's own setup
  enqueues it a second time. Setting the same objective twice leaves the
  same state (✔ `World.ts:2124-2127`), and it is measured: the runs 114b
  compares byte for byte hold five such orders (seed 11 one, seed 5
  four), and the shipped-length test now asserts it crossed one. The cost
  is one entry of about 130 bytes per pulled battle. `replayTrace`
  enqueues a recorded pull over the setup's own in the same way.
- **The probe runner's build is a development-mode build, and its ID has
  no `-dev`:** on a dirty tree it reads `0.0.0+027cba8-dirty`. So a
  journal from the runner on an uncommitted tree is refused by the tool
  without `--force`, which is call 7 working as signed.

**Built.**
- **`Game`:** the recorder is page-lifetime. `dispatch` hands it each
  command before the switch and settles it after; `createRun` opens a
  journal with the seed and `runConfigToQueryString(config)`; `devLoadRun`
  opens one from the loaded snapshot; `resetRun` abandons one.
  `currentJournal()` is the one being recorded, or the finished one until
  the next run starts.
- **A recorder that throws can't take the game with it** (a call made
  here, inside the charter's "passive"): every recorder call goes through
  `Game.journaling`, which logs the error once and stops recording for the
  page. Without it a throw in `command()` would drop the player's command.
- **The kit:** `__probe.journal()`, and `stateHash` on every drive report
  (`snapshotHash` of the Run as it stands). `drive-run.js` puts the
  journal in its report with `journal: true`.
- **`npm run replay -- <file> [--force]`** (`scripts/replay.ts`, with its
  logic in `src/journal/replayTool.ts`, since `scripts/` is outside tsc):
  the file is a journal or a probe report carrying one. Refused unless
  forced: another commit (it names the commit to check out), a `-dirty`
  build, an ID that names no commit (`unbaked`, `nogit`, a pin). `-dev` is
  accepted. Another config hash is refused always. Exit 0 replayed, 1
  diverged, 2 refused.
- **A tree with uncommitted changes of its own is a warning, not a
  refusal** (a call made here): the tool can't tell a changed comment
  from changed code, the config hash and the divergence check catch what
  matters, and refusing would mean no replay during development.
- **`npm run dist:hash`** (`scripts/dist-hash.mjs`), the `dist/` oracle as
  a script. Its known answer: a production build of `d06ebc6` pinned to
  `pin-113f-post` reads `4e969d27…` over 32 files, the total §113f-post
  recorded.

**Exit.**
- **The seed-7 drive in the Electron runner logs `a59ee48f`,** unchanged,
  with the recorder on the bus. Its journal: 71 entries (58 run commands:
  the driver's 46 and Game's own 12 `advanceTurn`s; 12 checkpoints; one
  setup order), 4,909 bytes, ending in defeat with hash `1b400634`, which
  is the `stateHash` the page reported.
- **That journal replays under Node to `1b400634`** (`npm run replay` on
  the report, forced past the `-dirty` stamp of the uncommitted tree): the
  first replay of a run played through `Game` and `BattleScene`, whose
  config was never in the replay's hands except as the dials' text.
- **A board fixture replays from its run dials alone** (the kickoff's
  first hypothesis): `--board=quarry` drove 7 battles to defeat; its
  start is `seed=7&roster=…&layout=rubbleQuarry&firstNode=elite&character=soldier`,
  and the replay reaches the page's `20624e26`.
- **The refusals, planted on copies of the seed-7 journal and run through
  `npm run replay`:** the tree's commit, built or `-dev`: exit 0; another
  commit, `-dirty`, `unbaked`: exit 2; another config hash: exit 2, forced
  too; an entry dropped: exit 1, naming the entry. The same cases are 15
  tests over `replayText` (`tests/integration/journal-tool.test.ts`).
- **The bundle** (production builds pinned to one ID, `dist:hash`): the
  index chunk 596,325 → 601,462 bytes, **+5,137 (0.86 %)**, 32 files both
  times. With the two config files nothing else imports left out of the
  hash it is 600,426, so they cost **1,036 bytes**. Call 8 stands: the
  hash keeps all 33 files, and recorded traces keep their stamp.
- **A guard that fired:** `page.test.ts` holds the dev server's stand-in
  to the kit's list of calls, and failed until `journal` was in it.

**Not checked here:** a journal from a dev-server page (a `-dev` ID from a
real page; the tool's rule for it is tested on a planted ID) and an order
sent through the battle's own controls. Both are pane work and ride 114d.

**Counts.** Main 3238 → 3253 (220 → 221 files); typecheck clean.

**After the commit, on the clean tree** (`ee7798b`): the seed-7 drive in
the runner again logs `a59ee48f` and reports `1b400634`; its journal is
stamped `0.0.0+ee7798b`, and `npm run replay` takes it unforced, with no
warning, exit 0.

### 114d — finished journals in the store (2026-10-01) — read `none` ✅

**Step zero.** The store's strict sections are what the cut assumed (✔
`store.ts:265-291`: a strict read is `empty`, `ok` or `rejected`, a write
replaces the section, nothing throws, and a locked store reads `empty` and
writes `false`). `Game` did not import the store before this step; the
boot module must not import the new section, since it knows the journal's
shape (`tests/store-boot.test.ts` holds that).

**Built.** `src/store/journals.ts`: the strict `journals` section, a list
of journals oldest first, at its own version 1.
- **The cap is characters of the list's JSON text** (what `localStorage`
  counts), `JOURNALS_BUDGET` = 1,000,000: the newest that fit together are
  kept and the oldest dropped first. A journal that alone exceeds the
  budget is not kept.
- **`Game` keeps a journal when its run reaches its end** (defeat or
  victory). An abandoned one is not kept (a call made here: the cut says
  "at a run's end", and before §116's menu the only abandon is the DEV
  load). The game still holds it until the next run starts.
- **A rejected section starts the list over** at the next finished run (a
  call made here: unlike the run slot, these are records to send in, not
  progress to protect).

**Exit.**
- **Headless** (`src/store/journals.test.ts`, 8 tests over the memory
  adapter, the stored text read from the adapter's map): the envelope and
  the order; **a planted section over the cap loses its oldest** at the
  next finished run; the budget's edges to the character; a journal alone
  over the budget; a rejected section (another version, not a list, a list
  of non-journals, not JSON) starting over; a store that can't save
  returning false and writing nothing.
- **In the pane** (`dev-preview`, the clean tree at `e81aa2f`, the page's
  build `0.0.0+e81aa2f-dev`):

  | check | result |
  |---|---|
  | `seed=7&character=soldier` driven to defeat | `a59ee48f` / `1b400634`, the Electron runner's two hashes |
  | `localStorage['asciibattler:journals']`, read from storage itself | an envelope at v 1 with one journal of 4,945 characters, equal to `__probe.journal()` |
  | that journal's text copied to a file (its SHA-256 equal to the page's) and `npm run replay` | exit 0, unforced: the `-dev` ID is accepted on its commit; hash `1b400634` |
  | an order through the battle's own controls (`seed=7&hops=3`): the hold hotkey during the countdown, the stop hotkey after 30 frames | `order` at tick 1 with the world still at tick 0 (the parked drain), `order` at tick 59 (the tick's own drain); the run's journal replays to the page's `4bbf3daf` |
  | a section planted over the cap (three 400 KB journals, 1,200,620 characters), then that run ending | the oldest gone, the list `102, 103, 7` at 803,266 characters; the store still `canSave` |
  | `?store=deny` (`seed=7&hops=2`) driven to its end | victory after 6 battles, no page error, no error in the console; the store `memory` / can't save; `localStorage` unchanged; the game still holds the finished journal (`7184f66e`, the page's hash) |

  This also closes the two checks 114c left: a journal from a dev-server
  page, and orders sent through the battle's own controls.

**Still soft:** the budget's number. It waits on a played run's bytes and
Firefox's storage limit (the signed call 5), and both are the user's to
supply at the 114e read.

**Counts.** Main 3253 → 3261 (221 → 222 files); typecheck clean.

### 114e — the export (2026-10-01) — ◐ BUILT, UNREAD (a `batch` read, at 114f's stop)

**Step zero.** The end screen is `GameOverScreen`, one `btn--exit` under
the stats (✔ `GameOverScreen.ts`); a download helper existed only in the
DEV keys (✔ `devKeys.ts:179`), which a build for players doesn't carry.
One thing the code showed: **the end screen mounts before the run's
journal closes.** `run:defeated` swaps the scene from inside the command
that ended the run, and the recorder settles after that command returns.
So the screen takes a function and reads the journal at the click.

**Built.**
- **"Export run"** beside "Begin a new run", both `btn--primary btn--exit`
  in a `.gameover-actions` row (a new run first, in DOM and Tab order).
  The click downloads `JSON.stringify(journal)` as
  `asciibattler-journal-<the run's opening time, UTC>.json`
  (`journalFileName`), through `src/ui/download.ts`. The button has a
  tooltip (`gameover.exportTip`) saying what the file is and what to do
  with it. No button when the page holds no journal.
- **`SceneContext.journal()`** carries `Game.currentJournal` to the scene.
- **The text is compact JSON,** the same text the store keeps, so the
  file's size is the number the journals budget needs.
- **DESIGN §UI idioms** said `btn--exit` is the sole control on an end
  screen; game over now has two, and the sentence, `button.ts`'s header
  and the stylesheet's comment say so. Whether two equal buttons is the
  right weight is part of the read.

**Checked in the pane** (`dev-preview`, `seed=7&hops=2&character=soldier`
driven to its end; the tree uncommitted, so the page's build was
`0.0.0+2ab2799-dirty-dev`):
- the two buttons side by side at the same height, 16 px apart, centred
  as a pair, the same class and colours (a screenshot; the rects);
- the click, with `URL.createObjectURL` and the link's `click` wrapped so
  that nothing was saved: one blob, `application/json`, 1,852 characters,
  equal to `__probe.journal()` and to the journal `localStorage` holds,
  its end in place (`victory`, `7184f66e`, the page's `stateHash`); the
  link in the document at the click, hidden, gone after; the file name
  `asciibattler-journal-2026-10-01T22-11-47-760Z.json`;
- the tooltip opens on hover with its text;
- "Begin a new run" still resets: the map, a new journal with no entries,
  the stored list unchanged.

**Not checked, and whose it is.**
- **A real save, in Firefox, and `npm run replay` on that file:** the
  user's, by the batch script in ROADMAP. The pane proves the wiring; the
  agent doesn't download files.
- **A narrow screen** (the row wraps by `flex-wrap`; not looked at).
- **What a download does in Electron's window and in itch's sandboxed
  frame** (the kickoff's hypothesis): unmeasured, and nothing here is a
  finding about either. Carried to the sittings that have those shells in
  hand (§116's itch leg, §118's smoke), in the Cursor.
- **Firefox's `localStorage` limit** and **a played run's file size**: the
  user's, at the same read; they settle the journals budget.

**Counts.** Main 3261 → 3264 (222 → 223 files); typecheck clean.

### The build stretch's end (2026-10-01, session 4d7da9f7)

114a–e ran from 17:19 to 18:15, inside the one-hour breaker: six
commits, `e6d35de` (114a) to `1fc4fc0` (114e), the fuzz smoke once (114a,
582 green). The end reading is asked for in the hand-back, with what the
gate's "400k" named. The session report waits for the session's end.

**The storage-limit snippet, and what the pane can't say.** The read
needs Firefox's `localStorage` limit, so the hand-back carries a console
snippet: it sums what is stored, then bisects the largest value one more
key will take, and removes the key. Run in the pane first, with a 16 M
ceiling, it reported the ceiling. With a higher one it fails on
`QuotaExceededError` at 52,182,016 characters, ASCII or two-byte alike,
which with the 246,462 in use is 52,428,478, within the bisect's step of
50 × 2²⁰. So the instrument finds a quota and says so when it hits its
ceiling (a flag added for that), and **the pane's Chromium allows about
ten times a stock browser's 5 MB**: the pane can't stand in for a
browser's storage limit. The preview server was stopped afterwards (no
listener on 5191; the Vite process left running is the user's own, on
5173 since the morning).

### 114e — THE READ, and the hand-off (2026-10-02, the user's) ✅

**The read.** The user played a run in Firefox on their dev server
(`hops=2&character=soldier`, no seed pinned), clicked "Export run" and
ran the tool on the saved file:

```
replay: segment 0: build 0.0.0+73621b7-dev, config b9fbf87d, seed 1790943939594 (hops=2&character=soldier), 45 entries
replay: segment 0: replayed 5 battles to its end (victory); hash 664078d7 matches the journal's
```

Unforced and with no warning, so the page and the tree were both at
`73621b7`, clean. Their verdict: "I think that that all worked!" No
finding. 114e is ☑. The read said nothing about the two buttons' look, so
DESIGN's changed sentence stands as written unless the user says
otherwise.

**The budget's two numbers.** The exported file is 3,789 bytes (the
session's `wc -c` on the user's file): a hand-played run of 5 battles.
Firefox's `localStorage` limit was not measured, and no run at the shipped
length has been played and exported. The budget stays at 1 MB, soft;
both numbers are carried in the Cursor.

**The gate, answered.** The "400k" given at the stretch's start set the
next gate, the one before 114f, at 400k in place of 350k, since the
stretch behind that gate is one step (the user: "It didn't matter either
way"). **The end reading: 501k at 08:40 on
2026-10-02** (the session idle since 18:19 the day before). The session
started fresh, so 501k is what orientation and the stretch 114a–e cost
together; no reading was taken at the stretch's start. Over the gate, so
114f goes to a fresh session (the user's call).

### 114f — the gate, and step zero's instrument (2026-10-02, session a8073201)

A fresh session; pre-flight green at `27cfb3a` (223 files, 3264 tests,
typecheck clean). **The gate: 104k at 10:00**, under 350k, so the stretch
(114f alone) starts here; the breaker is one hour, due 11:00.

**The instrument, before any switch** (`7e813b6`). §111's display test read
the drift from the timeline's arithmetic (the page's clock against the
file's frame count) and had one tone, 3 s in, before the switch. Two
additions, so the display sitting is read from the file and carries what a
retime would consume:
- The check twin's tone repeats every 10 s, and the analyzer pairs the k-th
  rise of the tone's band in the audio with the k-th rise of the ninth
  marker square in the video (`check2.tones`). Known answers, the display
  on: +7 ms at all seven tones of a corridors twin (§111f-post's reading of
  the single tone), and +107 ms at all seven after the same file was
  re-muxed with its sound 100 ms late.
- The sidecar holds every page frame's time from the go frame and when main
  received each written paint.

**The harness** (the session's scratch directory, not in the tree): one
recording per call, a check twin of corridors with `--countdown=skip`; a
long-lived Windows PowerShell helper asks the display off
(`SC_MONITORPOWER`, posted) and wakes it with a one-pixel mouse move,
stamps both, reads the time since the session's last input at each (so
input during the dark shows), and holds a hidden window registered for the
console display's state, so each run records whether the display did go
off and come back, and when; CPU and GPU use are sampled each second. The
helper compiles under Windows PowerShell only (PowerShell 7 wants more
assembly references for a `Form`). Tones through the speakers mark the
stretches for the user (their proposal): a start and an end sequence
around the stretch they are away for, and a warning and an all-clear around
each switch while they work. The recorder takes its sound inside the page,
so a tone from the speakers cannot reach a clip.

**Two dry runs, the display on, the user at the desk:**

| | CPU, mean / max over the fight | frames short | drift | tones | cues | page frame gaps, max | main's paint gaps over 25 ms |
|---|---|---|---|---|---|---|---|
| no planted load | 17 % / 30 % | 0 | −3 ms | +7 ms × 7 | 128 / 128 | 17 ms | 22 (max 143 ms) |
| an 8-thread looping decode | 46 % / 64 % | 0 | −3 ms | +7 ms × 7 | 128 / 128 | 17 ms | 119 (max 115 ms) |

- **The planted steady load is the 8-thread decode** (`-threads 8` on this
  32-thread machine): alone it leaves a recording clean, where §111's
  full-speed decode lost 322 frames with the display on and would bury a
  switch's effect under its own.
- **Main's paint times are not the page's frame times.** With a page clock
  steady to 17 ms, main received 22 paints more than 25 ms after the one
  before, and 119 under the load. A retime that read main's arrival times
  would move frames that were on time.
- The recorder's setup is 3.5 s from its "recording" line to the go frame,
  so a switch asked 25.5 s after that line falls 22 s into the fight.
- Windows' display idle timeout on AC is 900 s (`powercfg`), longer than
  the stretch the user is away for.

### 114f — step zero, the display sitting (2026-10-02) — the `stop` is open

Ten check twins of corridors (skip), 10:20 to 10:49, the tree clean at
`9700e04`; the clips, sidecars and each run's `.display.json` are in
`clips/114f/` with a copy of the harness (`clips/114f/harness/`). Each
switch was asked about 22.6 s into the fight and the wake 25 s later.
"Stall" is the page's frame gaps over 25 ms, summed over the slot; "left
over" is the drift less the stall and less a slot per frame short.

| run | CPU over the fight | the display's state, s from the go frame | page stalls (ms @ s) | frames short | drift | left over | sound to picture at each tone, ms | cues |
|---|---|---|---|---|---|---|---|---|
| desk, control | 20 % | on | none | 1 | 14 ms | −3 | 7 ×6, 23 | 128 / 128 |
| desk, switch 1 | 31 % | 38 offs and 38 ons, 23.0 to 47.3 | 73, 13.75 s in all | 166 | 16.5 s | −3 | 24, 24, 241, 9008, 15458 | 114 / 128 |
| desk, switch 2 | 30 % | 36 and 36, 23.2 to 47.5 | 68, 10.88 s | 148 | 13.3 s | −2 | 7, 7, 157, 9257, 12157 | 114 / 128 |
| away, control | 17 % | on | none | 0 | −3 ms | −3 | 7 ×7 | 128 / 128 |
| away, quiet 1 | 19 % | off 22.86, on 48.00 | 183 @ 22.65 · 50 @ 41.38 · 300 @ 47.66 | −2 | 447 ms | −3 | 7, 7, 173 ×3, 457 ×2 | 128 / 128 |
| away, quiet 2 | 19 % | off 22.86, on 47.96 | 117 @ 22.71 · 167 @ 47.75 | 0 | 247 ms | −3 | 7, 7, 107 ×3, 257 ×2 | 128 / 128 |
| away, load control | 42 % | on | none | 0 | −3 ms | −3 | 7 ×7 | 128 / 128 |
| away, load 1 | 43 % | off 22.62, on 47.82 | 100 @ 22.48 · 283 @ 47.50 | 0 | 347 ms | −3 | 7, 7, 90 ×3, 357 ×2 | 127 / 128 |
| away, load 2 | 43 % | off 22.80, on 47.88 | 217 @ 22.56 · 283 @ 47.56 | 0 | 465 ms | −2 | 7, 7, 207 ×3, 473 ×2 | 128 / 128 |
| away, the lock | 19 % | off 14.19 (Windows, 60.7 s after the lock), on 39.51 | 183 @ 9.13 · 67 @ 14.11 · 267 @ 39.21 | 0 | 464 ms | −2 | 7, 174, 224 ×2, 474 ×3 | 128 / 128 |

**What it says.**
- **The drift is the page's stalls plus its unpainted frames, and nothing
  else.** In all ten runs what is left over is −3 or −2 ms, the idle
  reading. The tones, read from the file, step by each stall's length at
  the tone after it, so the timeline's arithmetic and the file agree.
- **One switch of the display is one stall at the off and one at the wake,
  67 to 300 ms, with no frame unpainted, loaded or not.** Each stall begins
  at the request (within about 30 ms where the session made it) and ends
  within about 40 ms of Windows reporting the new state. The 8-thread decode changed nothing (100
  to 283 ms against 117 to 300), so §111's reading that load turns a switch
  into seconds of throttling does not hold at 43 % CPU.
- **Windows' own switch behaves the same.** Locked, the display went off
  60.7 s later: a 67 ms stall there, and a 183 ms one 5 s before it that no
  display event accounts for. The wake stalled 267 ms. An injected mouse
  move does wake a locked display.
- **The 13 s case is an off request met by input, not load.** At the desk
  Windows reported the display going off and on 38 and 36 times across the
  25 s, the page stalled 68 to 73 times and 148 to 166 frames never
  painted: §111's throttled run again (45 long frames, 142 unpainted). The
  session's last input was 31 to 32 ms old at each request and 16 to 31 ms old at
  each wake, and never older than 31 ms in a 10 s sample afterwards; with
  the user away it was minutes old throughout. The user saw 25 s of
  darkness both times and had the eye tracker paused, so the state changes
  are not the panel's, and what sends the input is not known. Two things
  differ between the desk runs and the away runs (input present; the
  request sent to every window against one), so which one makes the storm
  is not separated. §111's worklog does not say how its request was sent.
- **A frame can go unpainted with no switch**, the user working: the desk
  control lost one (14 ms).
- **The long-frame log carries the realistic cases and not the storm.** In
  the five single-switch runs it accounts for the drift to 3 ms. In the
  storm it carries 13.75 of 16.5 s; the rest is unpainted frames, which
  only knowing the page frame each paint shows can place.

**Corrections to what the session told the user mid-sitting:** that they
"probably saw flicker" (they saw darkness), and that the broadcast was "as
in §111" (not on record).

**Owed when the retime lands:** ARCHITECTURE's recorder paragraph and
`faults.mjs` still say a switch costs "from 0.2 s to 13 s of throttled
frames"; ROADMAP §114's carried note says the same of "a busier" machine.

**THE STOP** is the retime's mechanism and what a held frame counts as; the
proposal is in the session's message at the stop, and the decision lands
below.

### 114f — the decision, and the retime built (2026-10-02) — ◐ BUILT, the display sitting owed

**Decided** (the user, just after 11:00): each paint carries the page's clock and main
keeps the file on it, in place of a retime after the fact from the
long-frame log (the cut's wording; inside its intent, since the log cannot
place an unpainted frame). Their two checks, answered: the stamp never
reaches a file (main wipes it from each paint before the encoder sees it),
and the change is a canvas in the page script and a branch in main's paint
handler, with no clock taken over and no sound rebuilt, which is what the
stepped-clock fallback would need. The harness is tracked, at
`shell/electron/probes/display-test/`. Their read of the desk input: the
tracker itself still reports while it sees them, its software paused.
**The reading: 287k just after 11:00** (104k at 10:00: the hour held
orientation, the instrument, the harness and both display stretches, with
several long result dumps read whole); the breaker reset to 40 minutes.

**Step zero for the stamp's place.** The game draws a flat field along the
bottom rows at the left edge: over every frame of two clean clips, 160
pixels of each of the last three rows stay within 45 to 51. So the stamp
sits there and main writes the same row's next 64 pixels over it.

**Built.** `record-page.js` draws the stamp in every frame's callback (a
64 × 1 canvas: a sync byte, the milliseconds since the go frame, the frame
count, a check byte). `record.mjs` reads and wipes it in each paint and
holds or skips against a band of 25 ms (THE RETIME, in its header).
`timeline` gains `held`, `skipped` and `holds`, and counts `framesShort`
against the file's frames less those held plus those skipped. `faults.mjs`
gains a freeze over 100 ms, no stamp at all, and a paint without one after
the go frame. The analyzer counts frames still showing the stamp
(`stampFrames`; a clean clip passes at 0). Two planted controls:
`--plant-pause` (main stops the window painting) and `--plant-stall` (the
page blocked); `--retime=off` is the failing control.

**The trials** (the working tree on `338f59e`, corridors, `clips/114f/rt-*`):

| | retime | held / skipped | frames short | drift | sound to picture at each tone | the file's marker | stamp frames |
|---|---|---|---|---|---|---|---|
| a check twin, nothing planted | on | 0 / 0 | 0 | −3 ms | 7 ×7 (re-analysed; see below) | 3968 good, 0 repeated, 0 missing | 0 |
| a clean clip, full countdown | on | 0 / 0 | 0 | −3 ms | (no tone) | lead-in frames 0 | 0 |
| painting stopped 300 ms at 20 s and 150 ms at 40 s | off | 0 / 0 | 28 | 464 ms | 7, 7, 307, 307, 474 ×3 | 28 missing | 0 |
| the same | on | 28 / 0 (300 and 167 ms) | 28 | −3 ms | 22 ×7 | 28 missing, 28 repeated | 0 |
| the same, 30 fps | on | 15 / 0 (333 and 167 ms) | 15 | −1 ms | 5 ×7 | 15 missing, 15 repeated | 0 |
| the page blocked 300 ms and 150 ms | off | 0 / 0 | −23 | −3 ms | 7 ×7 | 23 repeated | 0 |
| the same | on | 22 / 22 | −24 | −3 ms | 7 ×7 | 24 repeated | 0 |
| the wipe taken out (planted), 6 s | on | | | | | | 329 of 329 |

- **The retime leaves a steady recording alone**: nothing held or skipped,
  the marker unbroken, and in every check twin the stamp's frame count
  equals the marker's in every paint (`markerMismatch` 0), so the canvas
  and the DOM marker reach the same paint.
- **A pause in painting is the display-free stand-in for a switch.** The
  page's frames run on and none is painted, so with the retime off the
  picture ends 464 ms ahead and fails; with it on, the frames are held
  where they were lost and the tone's offset is the same at all seven.
- **A blocked page is not a stand-in.** Its last frame is painted again
  meanwhile, so no time is lost even with the retime off; with it on the
  repeats are skipped and held again, to the same file.
- **The 22 is the sound's start, not the retime.** It is there at 3 s and
  13 s, before the first pause, and that run's tone sits 16 ms after its
  scheduled place in the audio where the others sit at 6 to 8; the desk's
  first switch (before any retime) read 24 the same way, with its tone at
  18. So the sound track's start varies by about 15 ms from run to run
  (§111e's 0 to 15 ms), and the step zero table's "24, 24" is this.
- The analyzer's stamp check failed on its first run (a one-row crop of
  4:2:0 video is refused; it now converts to grey first), so the first
  twin's row was read by running the analyzer again on its file.
- Saved sidecars judged again with the new `faults.mjs`: four from before
  the retime (two with faults), the retime-off pause twin and the two
  fault-free new ones read as recorded; the two retime-on pause twins
  differ only in the reworded frames-short line.

**Not verified:** a real switch of the display with the retime on (the
sitting below); a long run; unpainted frames from a busy machine with the
retime on (the pause stands in); Firefox does not apply.

**Open for the read (the session's defaults, built):** a freeze over 100 ms
fails a clip (delivered, exit 1); frames short still fails one, though the
retime now gives their time back, so a single unpainted frame while the
user works still exits 1.

**THE STOP:** the display sitting with the retime on (a desk stretch: a
control, a switch asked of every window, a switch asked of one; and a
short away stretch for the quiet switch and the lock), then the user's
call on the two open rules.

### 114f — the display sitting, the retime on (2026-10-02) — the exit met

**The two rules, confirmed** (the user, about 11:48: "Those two rules look
good to me"): a freeze over 100 ms fails a clip, and frames short still does.
**The reading: 372k at 11:48**, the breaker half an hour.

Five check twins at `770f5c0` through the tracked harness
(`clips/114f/sit-*`), 11:49 to 12:06:

| run | the display's state, s from the go frame | input during the dark | page stalls | held | frames short | drift | sound to picture at each tone | cues |
|---|---|---|---|---|---|---|---|---|
| desk, control | on | | none | 0 | 0 | −3 ms | 7 ×7 | 128 / 128 |
| desk, asked of every window | off 22.84, on 36.80 | none for up to 13.5 s | 2, 317 ms | 19 in 2 (83, 233 ms) | 0 | −3 ms | 7 ×7 | 128 / 128 |
| desk, asked of one window | off 19 times, 22.6 to 47.5 | never older than 234 ms | 44, 5.78 s | 355 in 41 (the longest 300 ms) | 9 | 14 ms | 7 ×4, −60, 23, 23 | 128 / 128 |
| away, quiet | off 22.77, on 47.78 | none | 2, 317 ms | 19 in 2 (167, 150 ms) | 0 | −3 ms | 18 ×7 | 128 / 128 |
| away, the lock | off 14.76 (Windows, 61.3 s after the lock), on 40.06 | none | 3, 467 ms | 28 in 3 (167, 50, 250 ms) | 0 | −3 ms | 7 ×7 | 128 / 128 |

- **The exit is met: a recording across a switch of the display ends within
  50 ms of its sound.** Three real switches end at −3 ms with one tone
  offset from the first tone to the last, where the morning's same runs
  ended 247 to 465 ms ahead; the storm ends 14 ms ahead, where the
  morning's ended 13.3 and 16.5 s ahead with 13 and 14 cues past the end. No frame
  of any of the five shows the stamp, and the stamp's frame matched the
  marker's in every paint.
- **The storm follows the input, not how the request is sent.** It came
  with the request asked of one window and input arriving throughout, and
  not with the broadcast while no input arrived: the opposite of the pairing
  step zero could not separate, so the session's reading that each window
  turns the display off again is wrong. The user did not touch anything
  when the display came back at 36.8 s in the second run, and saw nothing
  different between the two: their eye tracker's software has a
  long-standing fault where a pause does not always stop its input.
- **The storm's −60 is a freeze, not a drift.** That tone began while the
  page was stalled, so its flash was drawn late; the two tones after the
  storm read 23: a steady run's 7 plus the 14 ms the retime's 25 ms band
  leaves uncorrected, to within a frame.
- **The away run's 18 is the sound's start again:** its tone sits 12 ms
  after its place in the audio and its cues' median onset is 20 ms, against
  6 to 8 and 8 to 10 in the three other switched runs.
- **Each run fails on its freezes**, as the rule says: every real switch
  leaves one or two over 100 ms. The storm also fails on its 9 unpainted
  frames.
- Locked, Windows again stalled the page once 5 s before it turned the
  display off (167 ms at 9.7 s; 183 ms in the morning), with no display
  event there.

**Not verified:** a long run across a switch; a clean clip (not a check
twin) across a real switch, though the path is the same and the clean clip
with nothing planted passes; a busy machine's unpainted frames at scale
(the storm's 9 and the planted pauses' 28 are what was seen).

**The fallback (C) was not taken**, and nothing here needed it: holding the
display awake would spare a clip its freeze where the machine is unlocked,
and was not tried.

### 114f — THE READ (2026-10-02, the user's) ✅

"114f is read", at about 12:10, on the sitting's report; no finding. 114f
is ☑. The last reading was 372k at 11:48, over the gate, so 114g goes to a
fresh session; no reading was taken at the session's end. For 114g: a long
run across a switch of the display and a clean clip across one are the two
things 114f did not measure, and a run recorded while the user works will
meet the frames-short rule (one unpainted frame fails a clip).

### 114g — the recorder replays a journal (2026-10-02, session b326f055) — ◐ BUILT, the sitting owed

**The gate.** A fresh session at `eee63d2`. The reading: **99k at 12:27**
(the last session ended at 406k, the user's reading); the breaker one
hour, due 13:27. The stretch is 114g up to its `stop`.

**Step zero** (✔ = read at file:line). The premise holds: the page can be
fed a journal through names the game already has. Five things the cut did
not say shaped the build, all inside its intent.
- **The journal times commands and nothing else.** A `run` entry has `ms`;
  an `order` and a `battle` have ticks only, and neither the playback speed
  nor a pause is recorded (✔ `journal.ts:65-72`). So "paced by the
  journal's times" can hold for the screens between battles and cannot for
  a battle. The played journal shows the gap: its five battles are 7,374
  ticks, 369 s at 1×, and the whole run was played in 360 s, so the player
  ran some of them faster (battle 4: 150 s at 1×, 77 s as played). The clip
  plays every battle at one speed, `--speed`, 1 by default.
- **Game sends one journaled command itself:** the `advanceTurn` out of the
  turn-outcome gate, from a timer after the battle's outro (✔
  `Game.ts:422-428`). The driver leaves that entry to the game.
- **One frame can run several ticks** (the Clock fires whole ticks for the
  frame's time, ✔ `BattleScene.ts:98-107`, `:299-300`), so orders are fed
  from a wrap on the battle's own `World.tick`, not from the frame.
- **The played journal is from another commit.** It is stamped
  `0.0.0+73621b7-dev`, and the tree is nine commits on, none of which
  touched `src/`, `config/`, `tests/`, `scripts/` or `package.json` (an
  empty `git diff --stat 73621b7 HEAD` over those). `npm run replay` refuses
  it by its rule and replays it to its hash under `--force`. The recorder
  already builds a commit in a worktree for a pair, so a journal is recorded
  on the commit its build ID names, unforced.
- **The Run never reads the seed dial** (no `config.seed` in `Run.ts`;
  `Game.createRun` reads it, ✔ `Game.ts:781`), so a run played without
  `?seed=` is opened by putting its seed in the URL beside its dials.

**Built** (no file under `src/` changed).
- `shell/electron/probes/replay-page.js`, the driver: a plain function main
  installs in the page. A `run` command outside a battle goes through
  `Game.dispatch`, as long after the one before it as in play (`--max-gap`
  caps the wait). Orders and mid-battle commands go in from the tick wrap,
  an order before its tick and a command after its own; an order stamped for
  tick 1 goes in as the battle opens, so its marker shows through the
  countdown. A wrap on `Game.dispatch` sees what the game sends itself and
  holds it against the journal's next entry.
- **The check is the page's own journal of the replay**
  (`Game.currentJournal`, written by the build's recorder, which the driver
  does not feed): the same start before anything is sent, each battle's
  checkpoint as it ends, and at the end the same reason, final snapshot
  hash and `run` and `battle` entries. Orders are not compared one for one:
  a battle's setup enqueues its own again.
- `record-page.js` gains a run mode: nothing held in setup, the go frame
  starts the driver's clock, the cut 3 s after the replay's end (at once on
  a failure), every cue up to the cut counted. `main.mjs` reads the journal
  and installs the driver; `faults.mjs` gains the replay's fault;
  `record-cli.mjs` gains `--journal`, `--speed`, `--max-gap`, `--force`,
  30 fps by default and a time limit worked out from the journal.
- **The analyzer's stamp rule was a battle's.** It counted any frame whose
  bottom row spans more than 60 levels at the left edge, on 114f's finding
  that a battle draws a flat field there. A run's screens draw edges into
  that row: the first run clip (640×360) failed on 9 frames that hold a
  panel's border and no stamp. The rule now also wants the row to open
  with the stamp's sync byte. Against known answers: 114f's unwiped clip
  329 of 329, its clean clip and its check twin 0, the 9 edge frames 0
  (counted apart, `stampRowEdges`).
- `tests/integration/journal-replay-page.test.ts` drives the driver over a
  stand-in for the page's Game made of the real Run, Worlds and recorder
  (four ticks a frame, a parked countdown, the game's own advance): a run
  recorded headless with planted orders and mid-battle discards replays to
  the same bytes, with the countdown whole and skipped, and nine controls
  (changed journals, a page on another seed, a game that sends another
  command) are refused or fail by name. 12 tests, 3.9 s.

**The exit, measured** (the played journal: the user's export of this
morning, 45 entries, 5 battles, victory; clips in `clips/114g/`):

| clip | pace | length | the replay | frames short / held | drift | cues heard | result |
|---|---|---|---|---|---|---|---|
| `run-played` | as played, 1×, 1080p30 | 530.8 s | 45 of 45, hash `664078d7` = the journal's | 0 / 0 | −6 ms | 540 of 540 | OK |
| `run-played-check` (the twin) | the same | 531.7 s | the same | 0 / 0 | −5 ms | 540 of 540 | OK |
| `g-fast1` | 3×, gaps capped at 0.5 s, countdown skipped, 640×360 | 144.5 s | the same | 0 / 0 | −1 ms | 518 of 518 | failed on the old stamp rule; passes re-analysed under the new one |
| `g-headless11` (a journal made headless: 11 battles, 45 orders, 3 mid-battle discards, defeat) | the same fast settings | 135.9 s | 97 of 97, hash `297f6a55` = the journal's | −1 / 1 (33 ms) | −1 ms | 1342 of 1342 | OK |

- **A played run's journal becomes a clip, the page's final hash equals the
  journal's, no fault.** The clip is 8 min 51 s for a run played in 6 min:
  the battles take 394 s at 1× with their countdowns, where the player's
  five spans from Fight to the game's advance add to 232 s, outros included.
- **The twin over the whole run:** 15,935 marker frames in step with none
  missing or repeated, the stamp's frame equal to the marker's in every
  paint, and the sound 10 ms ahead of its flash at each of 53 tones, the
  first to the last. Neither full recording holds or skips a frame or has a
  page frame over 40 ms, so the scene swaps cost the clip nothing here.
- **Headless agrees:** `npm run replay -- <the played journal> --force`
  reaches `664078d7` under Node.
- **The battle path is as it was** after the page script's reshaping: a
  check twin of corridors (0 missing of 4268, 7 ms at each of seven tones,
  128 of 128 cues) and a clean seed-12 clip with the countdown skipped both
  pass, on the working tree.

**The controls** (planted from the played journal, the fast settings):

| planted | what the recorder said | exit |
|---|---|---|
| the final hash alone changed | replayed 45 of 45, then "the journal's final snapshot hash is 00000000, and the page's is 664078d7" | 1 |
| the first `empowerUnit` dropped | "battle 1 at tick 1420: the journal's battle ended player after 913 ticks, and the replay's ended player after 1420" | 1 |
| the first order moved 300 ticks later | "battle 1 at tick 3000: the journal's battle ended player after 913 ticks, and the replay's ended draw after 3000" | 1 |
| the game's own `advanceTurn` taken out | "entry 12 of 44: the journal has an order for tick 1, and the replay is not in a battle" | 1 |
| another config hash | refused in the page before a frame was written | 1 |
| a `-dirty` build ID | refused at the front door, with `--force` named | 1 |

**Findings for the sitting.**
- **What a clip made at `Game.dispatch` does not show.** No cursor and no
  hover. No click or pickup sound: the screens play those in their click
  handlers. The reward screen does not tick a row off as it is accepted:
  its ledger is updated by its own click handler (✔ `RewardScreen.ts:277-298`),
  so in the clip all four rows keep their Accept buttons while the bits
  chip climbs (two frames, at 518.6 s and 522 s: 44 and 55 bits, four
  rows). The pre-turn, port and event screens repaint from bus events.
- **At 3× a cue can go unheard:** 517 of 518 and 111 of 113 in two of the
  fast controls, 518 of 518 in a third, and 540 of 540 in both 1×
  recordings. Not diagnosed; it fails a `--speed=3` clip when it happens.
- **The stamp's wipe was sized for a battle too:** main writes the row's
  next 64 pixels over the stamp, which is a copy of a flat field in a battle
  and can be a copy of an edge on a run's screen. One row of 64 pixels;
  left as it is.
- **Recording speed and pauses would be a format change** (a timed entry
  beside `run`), and is the user's call; the sitting is where the pace is
  judged.

**Not verified:** a run across a switch of the display (114f's carried
item: nothing switched in these recordings); a journal from a production
build (the played one is `-dev`; the recorder builds the same commit in
development mode either way); a run at the shipped length; `--force` on the
working tree; what the clip looks like in motion, which is the sitting's.

**THE STOP: the sitting.** `clips/114g/run-played.mp4`, the user's own run
of this morning.

### 114g — THE READ (2026-10-02, the user's) ✅

The user watched the clip ("this looks awesome"; confirmed when asked), at
about 13:40. 114g is ☑, with one finding. **The reading: 389k at 13:40**
(99k at 12:27 at the gate; the stretch ended 13:23, inside the hour's
breaker). Their three calls:
1. **The pace stays:** every battle at 1× with its whole countdown is "a
   great default".
2. **Speed and pauses stay out of the journal.**
3. **The reward screen should tick its rows off** → 114g-post, small
   enough to build in this session at their call, over the gate. The event
   the Run could emit for it is a to-do, at their word, and so is their
   own finding: a replayed clip gives no cue of which choice was made (an
   event option changes page with no flash). Both are in TODO, "§114
   riders".

### 114g-post — the reward screen follows the live offer (2026-10-02) — ◐ BUILT, unread

**Step zero.** The Run emits nothing of its own when a portion resolves (✔
`Run.ts:3572-3637`: the accept and decline handlers hold no emit; what a
portion pays changes the bits chip in the clip, and a decline changes
nothing a screen can hear), so the screen has no event to follow, and only
its click handler marked a row taken. The event screen needs no such fix: its
click handler plays a sound and dispatches, and the page turns on
`event:pageChanged` (the clip's frames at 28.5 s and 30.2 s show the two
pages).

**Built.** `RewardScreen.syncLedger` marks a row taken once its portion has
left `run.pendingRewards`, and `RewardScene.tick` asks every frame whether
one has (`follow`). The click path is as it was, and its bits row still
freezes at the amount read before the dispatch. No sim file, no new event.
`--force` on the recorder now means what it means on `npm run replay`: the
working tree, whatever the journal's build ID says. Before, a journal that
named a commit was recorded on that commit even when forced, which left no
way to see a change to a screen on a run played before it.

**Verified** by the played journal recorded on the working tree
(`clips/114g/post-forced.mp4`: `--force`, 3×, gaps capped at 1 s): the
replay reaches `664078d7`, 520 of 520 cues heard, no fault, and four frames
of the last reward screen, one second apart, show none, one, two and three
rows dimmed and marked TAKEN, the cache line going to 1/6 with the packet
(`clips/114g/post-reward-rows.png`). **Not verified:** the click path in
play (its code is unchanged), a full-cache swap, and a row declined without
the offer ending, which would read as taken.

### 114g-post — THE READ (2026-10-02, the user's) ✅

"I've read it, and it looks great", at about 14:05, on the four frames; no
finding. 114g-post is ☑ (`b3b9139`), and every step of §114 is read. No
reading was taken at the session's end; the last is 389k at 13:40, over
the gate, so the §114 close goes to a fresh session.

### §114 closed (2026-10-02)

Session 5eda55b6, fresh, opened by the user at about 14:15 for the close
and the §115 kickoff. No reading was asked for before the close: a fresh
session is under the gate, and the close is paperwork. Every step is read:
four `none`, 114e's `batch` (no finding), and the `stop`s at 114f, 114g
(one finding) and 114g-post. The close: ROADMAP §114 demoted, the phase
summary in `retro/sessions.md`, the HANDOFF Cursor moved on. At `14d96bf`,
by this session's runs: 3276 tests in 224 files, typecheck clean, and the
seed-7 drive in the Electron runner on `a59ee48f` with the state hash
`1b400634`, both as 114c recorded them. Of the 21 commits since the
shape-lock's (`34c6eec`), one touched a path that fires the fuzz smoke
(`e6d35de`, 114a: 582 green).

**Carried out of the phase** (each in ROADMAP under its phase, or in
TODO):
- **§115:** the journal of the run in progress joins the save in the run
  slot, and a load opens a new segment; whether a segment opened on the
  same build carries the snapshot's hash in place of the whole snapshot.
- **§116:** the menu's copy of the export; at the itch sitting, what a
  download does in itch's frame, and the journals budget's two numbers
  (Firefox's `localStorage` limit, and the file of a run played at the
  shipped length).
- **§118:** what a download does in Electron's window.
- **TODO, "§114 riders":** a `reward:resolved` event; a cue of which
  choice was made in a replayed clip; and, added at this close, the
  recorder's three open items (a cue unheard at 3×, undiagnosed; a run and
  a clean clip across a real switch of the display, unmeasured; the
  stamp's wipe sized for a battle).

**What the phase cost in context,** from the readings in the entries
above: the kickoff and shape-lock 222k to 350k (c3c1aee1, with the context
restatement between); 114a–e a fresh session to 501k, read the next
morning (4d7da9f7); 114f 104k to 372k, and 406k at its end by the user's
later word (a8073201); 114g and 114g-post 99k to 389k at the read, none
taken at the end (b326f055). Each stretch started under its gate except
114g-post, built at 389k at the user's call, and no reading is past the
halt.

## Phase 115 — save/load and mid-run resume

### The §115 audit and cut (2026-10-02) — the shape-lock is open

Session 5eda55b6, straight on from the §114 close (`0a7ff11`), from about
14:25 to 14:35. No reading yet: the session opened fresh, and the reading
and the breaker are asked for with the shape-lock. ✔ = read by this session
at file:line, or measured.

**What is there.**
- **The run slot has a rule and no writer.** `runSlotSection(bus)` is the
  strict `run` section, stamped with `RUN_SCHEMA_VERSION`; its wire is
  `{ snapshot }`, and its `load` is `Run.fromJSON(wire.snapshot, bus)` (✔
  `src/store/runSlot.ts:27-42`). So reading the slot builds a Run that is
  subscribed to the bus it was given: a read made only to ask "is there a
  save" leaves a second Run listening unless it is disposed or read on a bus
  of its own. A rejected read hands the stored text back (✔
  `store.ts:265-288`).
- **Nothing shows the player the store's state.** `save.rejected` has its
  text (✔ `locales/en/ui.json:193`) and `runRejectedMessage()` has no
  caller; `store.onStatus` has no listener (✔ a search of `src` outside
  tests). The "can't save" notice of spec D1 is unbuilt.
- **`Run.fromJSON` resets what the run's config set.** It bypasses the
  constructor and assigns the shipped default to every input the snapshot
  doesn't carry: the forced layout and encounter, `singleSectorRun` (the
  `hops` dial), `sectorHopsOverride`, the difficulty multipliers,
  `passIsFinal`, `drawAmountAdd`, the sector map, the event catalog and the
  forced event (✔ `Run.ts:4294-4338`, `:4369-4377`, `:4464-4466`). Of the
  eleven fields the URL sets (✔ `RunConfig.ts:374-402`), four are read
  after construction and are lost: `hopCount`, `sectorHops`, the forced
  layout and the forced encounter. 114b's test already says so in a
  comment: "a loaded run has the shipped length (the `hops` dial isn't
  saved)" (✔ `tests/integration/journal-replay.test.ts:60`). The three
  scatter dials that survive a sector advance (`sectorAdvanceConfig`, ✔
  `RunConfig.ts:256-269`) have no URL form, and `fromJSON` doesn't assign
  them either.
- **The bots clone a run through the same `fromJSON`** (✔
  `src/bot/runRollout.ts:54-66`), so anything a snapshot gains changes what
  every rollout clone carries.
- **Game mounts every screen from a bus event** (✔ `Game.ts:343-374`,
  `:407-429`), and a silent return to the map by checking the phase after a
  dispatch (`:517-598`). What each event's payload needs:

  | gate (phase) | event | payload from the Run's saved state? |
  |---|---|---|
  | `map` | none (Game checks the phase) | yes |
  | `port`, `event`, `reward` | `port:entered`, `event:entered`, `reward:offered` | yes; the screens read the Run (✔ `Run.ts:1476`, `:1551`, `:3204`) |
  | `promotion`, `recruit` | `promotion:pending`, `recruit:offered` | yes: `pendingPromotions`, `currentOffer` (✔ `:3209`, `:3728`) |
  | `turn-intro` | `turn:starting` | yes: every field is read from state, the risk line re-rolled from the turn's wave (✔ `:2330-2366`; `previewPoolAtRisk` calls `rollTurnWave`, whose body was not read). The scene's two other inputs are Game's buffers, the deal cues and the last turn's outcome (✔ `Game.ts:398-411`), and a load has neither |
  | `sectorCleared` | `sector:cleared` | **no**: the cleared sector's title and the pool before the seam's heal are locals of `advanceSector` (✔ `:3747-3794`) |
  | `turn-outcome` | `turn:resolved` | no (winner, reason, the applied chips); it has no screen, and Game sends the `advanceTurn` itself after the outro (✔ `Game.ts:422-429`) |
  | `defeat`, `complete` | `run:defeated`, `run:victory` | yes (no payload) |

- **`Game.devLoadRun` loads map-phase saves only**, for that reason, and
  its comment holds the landing note: the resolver is a Run-side re-emit of
  the phase's gate event (✔ `Game.ts:731-770`). It already opens a journal
  from the loaded snapshot.
- **The recorder holds one segment.** `journal` is `{ segments: [segment] }`
  and `open` abandons whatever was open (✔ `JournalRecorder.ts:99-119`), so
  a journal across a load doesn't exist yet; `replayJournal` replays each
  segment on its own bus from its own start (✔ `replayJournal.ts:97-113`);
  the recorder's `--journal` mode refuses more than one segment (✔
  `record-cli.mjs:260`).
- **A command that isn't legal where it is sent is a silent no-op,** by
  the contract `Command.ts` states for most of its kinds (✔
  `Command.ts:36-202`: fourteen by this session's count; the other six
  carry no such sentence there, and no handler was read). `discardPacket`
  is legal in any phase, a battle included.
- **A gated headless run exists to build on:** `tests/journalDrive.ts`
  plays one with a recorder, from the kit's `PHASE_ROWS` (one row per phase;
  a new phase fails typecheck until it has one, ✔ `src/dev/probe/drive.ts:43`).
  The fuzz harness asserts occupancy per tick behind a flag (✔
  `harness.ts:982`). No driver sends the whole command set: TODO's chaos
  item counts two of about ten decision surfaces randomized.
- **`navigator.locks` is used nowhere** (✔ a search of `src`, `shell`,
  `tests`). The probe and record runners give each run a fresh profile (✔
  `probe-cli.mjs:93`, `record-cli.mjs:378`), so neither can pick up a saved
  run.

**Measured: what a save costs, and which gates a driven run meets** (a
scratch script: eight gated runs by the kit's rows, the snapshot taken as
JSON text before every command outside a battle).

| seed, dials | battles | saves | snapshot text, min / median / max | serialize, median / max |
|---|---|---|---|---|
| 1, `character=soldier` | 11 | 51 | 4,718 / 15,281 / 21,827 | 0.02 / 0.40 ms |
| 2, `character=soldier` | 29 | 136 | 5,457 / 25,605 / 48,740 | 0.03 / 0.52 ms |
| 3, `character=priest` | 18 | 82 | 5,187 / 16,715 / 28,246 | 0.02 / 0.18 ms |
| 5, `character=soldier` | 13 | 59 | 5,149 / 18,169 / 27,514 | 0.04 / 0.10 ms |
| 8, `character=gambler` | 27 | 122 | 5,224 / 25,214 / 49,208 | 0.05 / 0.92 ms |
| 11, `character=priest` | 9 | 34 | 5,158 / 9,631 / 14,327 | 0.02 / 0.08 ms |
| 7, `hops=3&character=soldier` | 11 | 37 | 3,096 / 10,681 / 18,332 | 0.03 / 0.07 ms |
| 23, `sectorHops=3&character=gambler` | 10 | 34 | 3,088 / 10,941 / 18,762 | 0.03 / 0.80 ms |

- **A save is 3 to 49 KB of text and under a millisecond to serialize**
  (Node; the write itself is unmeasured, in `localStorage` and in
  Electron's file).
- **The round trip held at every one of the 555 saves:** text → `fromJSON`
  → `toJSON` gave the same text. It compares the save code with the load
  code, so it says nothing about a field both drop.
- **Every gate kind was met** across the eight: `port` in six runs,
  `sectorCleared` in two (seeds 2 and 8, the 29- and 27-battle runs). All
  eight ended in defeat, so no run here reached `complete`.

**Hypotheses for step zero** (unmeasured).
- `navigator.locks` under Electron's `app://` origin and in itch's frame
  (the second waits for §116's sitting).
- What one write costs per command, in `localStorage` and in Electron's
  file.
- A short dialed seed that clears a sector, so the sector-cleared gate is
  in the every-commit tests without a 27-battle run.
- What the pre-turn screen shows with no deal cues on a first turn.
(The kit's `drive()` already stops at a named phase, `until`, ✔
`src/dev/probe/index.ts:144`, which the pane check of a resume needs.)

**Calls for the shape-lock, with the session's lean.**
1. **What a save carries beside the snapshot: the run's dials as text**
   (the journal's `dials`), and `Run.fromJSON` takes an optional config for
   the inputs it resets today (the lean). With no config it is as it is
   now, so rollout clones don't change. The other shapes: put those inputs
   in the snapshot, which changes what every rollout under a dial carries
   and so risks the signed sheet's reproduction; or leave dialed runs
   unsaved, which takes short runs away from the user's own reads.
2. **The sector-cleared gate: save its two facts** (the cleared sector and
   the pool before the heal), a Run bump v46 → v47, the one the spec
   expects here (the lean; nobody holds a v46 save, since the slot has had
   no writer). The other shape skips the save at that gate, so a tab closed
   there reopens on the screen before it.
3. **Which gates save:** after every command applied while the run waits
   (every phase but `battle` and `turn-outcome`), and once when the run is
   created. A `discardPacket` sent in a battle is saved at the next gate. A
   run's end empties the slot.
4. **A journal across a load.** The journal saved in the slot ends its open
   segment as `saved`, with the snapshot's hash. A load on the same build
   and config opens a segment that starts from that hash, and a replay
   continues through a reload as the page did; on another build the segment
   carries the whole snapshot and its dials (the lean). Always carrying the
   snapshot costs 3 to 49 KB a load, against a 1 MB budget for all finished
   journals. The format goes to 2.
5. **The continuation check reloads at every gate in one pass:** one run
   played straight through, and the same commands sent to a run that is
   turned to text and loaded again at every gate; the two must be equal
   byte for byte at each gate and at the end. Its cost is two runs, where
   continuing separately from each gate is a run per gate. Its controls:
   the dials withheld from the reload (a `hops` run must fail, at a named
   gate), and a field blanked in the text.
6. **The chaos driver's home:** its own gated driver under `tests/chaos/`,
   built on `journalDrive`'s loop, a few seeds on every `npm test` and
   `npm run chaos -- --seeds=N` for a sweep (the lean). TODO's candidate was
   an arm of the fuzz harness, which plays ungated and runs only at the
   smoke. It sends random legal commands in every phase, some out of range,
   and random battle orders; it checks the round trip at every phase
   change, occupancy at every tick, and that its own journal replays to the
   same bytes, which is also its repro.
7. **The entry before the menu exists:** `Game.continueRun()` is the entry
   §116's Continue row will call; until then character select, today's boot
   screen, shows Continue when the slot holds a run and the rejection
   message when it holds one that can't be loaded (the lean). The other
   shapes: resume at boot with no question, or a dev-only entry until §116,
   which leaves the phase's exit ("rejected with its message") with no
   surface.
8. **A boot with run dials in the URL** starts its own run, as today, never
   continues, and saves over the slot (the lean: one slot, and the user's
   reads use short dialed runs).
9. **The second tab** can't continue the run and plays unsaved for its
   life, saying so (the lean); the first tab to boot holds the lock. Where
   `navigator.locks` is missing there is no lock.
10. **What a resumed pre-turn screen loses:** the deal's animation and the
    last-turn strip (the lean: accept it). Keeping the strip means saving
    the last turn's outcome, a wider bump.
11. **The "can't save" notice:** uncertain. The autosave is the first write
    whose failure costs a player something, which argues for here; the
    notice wants a home in the chrome and a read against DESIGN §UI idioms,
    which argues for §116 with the settings. The lean is §116, carried in
    ROADMAP.

**Predictions for the cut.** One Run bump (v46 → v47, at 115a, with the
fingerprint re-pinned); no World bump; no RNG stream; no new bus event (a
resume re-emits existing ones). The fuzz smoke fires at 115a (`src/run`),
and again wherever the chaos driver's findings touch `src/sim` or
`src/run`. The journal's format goes 1 → 2 at 115d. Two i18n keys (Continue,
the other-tab notice). `npm test` grows by the continuation check and the
chaos seeds, measured at each. The production bundle grows at 115e,
measured there.

**The cut as proposed (unsigned; it goes into ROADMAP §115 once signed).**
Seven steps: six `none`, one `stop`.
- **115a — the Run's side, headless.** `Run.fromJSON(snapshot, bus,
  config?)`, and `Run.resume()`, which re-emits the gate event of the phase
  the run is in; the sector-cleared gate's two facts saved (v47). Exit: for
  each gate kind, a reloaded run's `resume()` emits the payload the live run
  emitted on arriving there; `turn-outcome` and `battle` refuse by name;
  with no config, the round-trip, rollout and determinism tests and the
  fuzz smoke are as they were. Read `none`.
- **115b — the continuation check.** Call 5, on every `npm test`, over
  seeds that between them cross every gate kind, with and without dials.
  Exit: green, and both controls fail at a named gate. Read `none`.
- **115c — the chaos driver.** Call 6. Exit: a sweep green, or its findings
  fixed or filed; every command kind sent at least once across the
  every-commit seeds (a pinned census); a planted round-trip break and a
  planted overlap caught; a failure prints its seed and writes its journal.
  Read `none`.
- **115d — the journal across a load.** Call 4. Exit: a run recorded across
  loads at several gates replays to the bytes of the same run played
  straight through; controls: a changed hash, a segment resumed after
  another build's. Read `none`.
- **115e — the autosave and the load, in the game.** `Game` writes the slot
  at every gate and at a run's start and empties it at a run's end;
  `continueRun()` loads it, resumes the screen and opens the journal's next
  segment; the DEV load key goes the same way and takes any gate. Exit, in
  the Electron runner or the pane: a run driven to each gate kind, the page
  reloaded and continued shows the same screen and state hash, and driven
  on reaches the hash of the same drive unbroken; the seed-7 drive still
  logs `a59ee48f` with saving on; the journal of a continued run replays
  under `npm run replay`; `?store=deny` plays on; a stale slot and an
  unreadable one are rejected with their text left in place. Read `none`.
- **115f — the two-tab lock.** Call 9. Exit: headless over a stand-in lock;
  in the pane with two tabs, the second can't continue and writes nothing
  to the slot; Electron measured. Read `none`.
- **115g — Continue and the two messages on character select.** Calls 7
  and 8. Read `stop`, the sitting in Firefox: start a run, close the tab at
  the map, at a pre-turn screen, in a battle, at a reward, at a port and at
  an event, and reopen each time; Continue returns to the screen that was
  left (the one before the battle, for the battle), with the same team,
  bits and pool; a second tab says the run is open elsewhere; a planted
  stale save shows the message. Wrong is a different screen, anything
  lost, or a fight that goes differently under the same orders.

### The §115 shape-lock, first part (2026-10-02, the user's) — calls 1–9 SIGNED, 10 and 11 open

At about 17:05 ("Signing 1-9; can you elaborate on 10 & 11?"). **The
reading: 352k at about 17:05.** The session opened fresh at about 14:15
and was idle from 14:36 until this message, so 352k is what orientation,
the §114 close and this kickoff's audit cost together. It is over the gate
by 2k, and the build stretch is the phase's largest; where it starts is
being settled with the two open calls (the user leans to a fresh session,
and offers a 30-minute breaker here as the other shape).

**Call 10, re-read before answering.** The first message said keeping the
last-turn strip means "a wider bump". That was written before the strip's
renderer was read. It draws three things from the `turn:resolved` payload:
`winner`, `reason`, and the turn's fallen rows (✔ `PreTurnScreen.ts:1066-1115`),
and the screen keeps the payload only when its turn is the one before (✔
`:205`). The fallen rows are already in the saved ledger: `fallenForTurn`
filters it by sector, node and turn (✔ `Run.ts:1347-1352`). So the strip
needs two saved facts, the last turn's winner and why it ended, in the bump
call 2 already makes. The shape proposed back to the user: the Run keeps
them, `turn:starting` carries the last turn's outcome, and the screen takes
the strip from that payload live and resumed alike, which retires Game's
buffer of `turn:resolved` for the strip. What a load still loses is the
deal's cue sequence; the cards still animate in (`enterPositions = 'all'`,
✔ `:215`) and, as this session reads the code, the pile counts open at
their final values. No pane has shown a pre-turn screen with no cues.

**Call 11, re-read before answering.** DESIGN.md has no notice or toast
idiom (a search of the file for "toast", "notice" and "can't save" found
nothing; "banner" appears once, for the map's), so an indicator that sits
over every screen is a new idiom. The store knows at boot when storage
is refused (`chooseAdapter`'s fallback and its reason, ✔
`src/store/choose.ts:21-47`), and 115g already puts two messages on the
boot screen. The shape proposed back: the boot-time case gets a third line
there in 115g; a write that fails in mid-run (a quota) waits for §116,
where the settings need the same indicator for their own writes.

### The §115 shape-lock (2026-10-02, the user's) — SIGNED

Signed at about 17:20 ("Signing 10, 11, and the cut as amended!"): all
eleven calls ✅ DECIDED and the cut of seven steps, six `none` and one
`stop` (115g). Calls 1–9 stand as proposed in the audit above. The two
amended at the second message:

- **Call 10:** the last-turn strip is kept across a load. The Run saves
  the last turn's winner and reason in the v47 bump, `turn:starting`
  carries the last turn's outcome, and the pre-turn screen takes the strip
  from that payload live and resumed alike, so Game's buffer of
  `turn:resolved` for the strip is retired. The deal's cue sequence is not
  kept. In the cut: the Run's half at 115a, the screen's at 115e, whose
  exit gains "the strip's text on a seeded drive is as before".
- **Call 11:** split. Storage refused at boot gets a line on character
  select at 115g, beside the rejected-save message and the other-tab
  notice. A write that fails in mid-run waits for §116's indicator (carried
  in ROADMAP §116). Until then that failure is silent to the player: the
  run plays on in memory and is lost when the tab closes.

ROADMAP §115 carries the cut and the eight decision lines; §116 carries
what moves to the menu.

**The gate.** The reading stands at 352k (about 17:05), over the gate, and
the build stretch (115a–f, then 115g up to its sitting) goes to a fresh
session: the user's lean and this session's. Thirty minutes here would buy
about one step, since 115a's commit spends about seven of them in the
hook's fuzz smoke, and §114's like stretch took a fresh session to 501k.

**For the build stretch, with no other home.**
- 115a's pin compares payloads at arrival. A field the simulation never
  reads (the last turn's winner and reason) can't be caught by the
  continuation check, so that pin is its only guard.
- Reading the run slot builds a Run subscribed to the bus it is given. A
  read made to decide whether Continue shows must dispose that Run, or read
  on a bus of its own (115e or 115g).
- The recorder's `--journal` refuses a journal of more than one segment.
  When 115d makes such journals real, a clip of a continued run is a TODO
  rider, filed there.
- No short dialed seed that clears a sector is known yet; seeds 2 and 8 at
  the shipped length do (29 and 27 battles). 115a's and 115b's step zero
  looks for one.
- The audit's scratch script (`save-census.mts`, eight gated runs with the
  snapshot taken at every gate) is in this session's scratch directory and
  goes with it; it is about eighty lines over `PHASE_ROWS`, and the
  worklog's table is its output.

**A process question at the close: Claude Code's mods** (the user's: can
they expose the session's context to the agent?). Read from this build's
type declarations (Claude Code 2.1.286), nothing built: a mod's hooks can
call `$.session.usage()`, which returns the live window's `tokens`,
`window` and `percent` as the status line has them, and `$.tool.register`
declares a tool the model can call, served by a `tool.call` hook. So a
mod of about thirty lines could hand the agent its own reading at a step
boundary. Unverified: whether that figure is the one the user's meter
shows, and how a mod is loaded in every session under the desktop app
(the hot-reload switch is per session and the person's alone to answer).
The observation and what it would change in the gate, the breaker and the
halt are in `retro/scratchpad.md`.

### The context rule, replaced (2026-10-02, the user's)

Session 0d584e89, a process break before the §115 build stretch. The user
asked whether a Claude Code mod could retire the gate and the breaker by
giving the session its own context reading. Built: the context-meter mod
(4409bab; CLAUDE.md "The context meter"), a tool that returns the reading,
with the same reading added to every commit's result.

**The calibration pair:** the tool read 159,886 at 18:51, and the user's
meter read 160k just after, with one message between them. The user's
118k earlier was taken before that turn's tool results, so it pairs with
nothing. **The second pair:** the tool read 247,932 at 19:59 and the
meter read 248k just after, about 88k past the first pair, and after a
relaunch.

**Signed** (`process/planning.md` "Context: the halt and the hand-off
line"; the Cursor carries the numbers): the gate (350k) and the breaker
retire, and the name "gate" goes with its number, as the user asked. The
halt stays at 600k. The hand-off line is 550k, the halt less one step's
cost, checked at the start of each step. At a stop or shape-lock the
session gives its own reading and says whether the next stretch looks
likely to fit. Without the tool, the user reads the meter as before.

**The user's prediction, logged before any data:** there will be no
single average step size. The 550k is provisional, and the round close
measures step costs from the commit readings and resets it.

**Loading.** The mod loads from the repo only in a trusted workspace. For
this repo, the forward-slash key in `~/.claude.json` read untrusted while
the backslash key read trusted. A fresh session ("Context meter
diagnostics", local_5432b355) found that with a four-arm test on scratch
copies of the file, and I confirmed the flags and the skip warning
read-only. The user set the flag by hand. After a relaunch the tool read
209,563, and a commit dry run carried 210,192. Open: whether a session
that never answered the hot-reload question runs the mod; the §115
session's first act tests that.

**Two corrections to my own claims.** First, `claude plugin validate` does
not type-check; I had said it would have caught the unawaited Promise.
Second, a skills-folder load writes no `.claude-plugin/types/` beside the
mod, so that folder's absence never showed that a load was missing. The
declarations the engine writes beside a hot-reload mod also lack the
built-in tools' inputs: under the skill's own declarations, the commit
hook's loop over two tool names failed to type, and it is now two literal
matchers.

### The build stretch's start (2026-10-02, session 5f729d11)

A fresh session. The context-meter tool was listed as a deferred tool (its
schema loads with one ToolSearch call) and read 82,425 of 1,000,000 at
20:11, after HANDOFF and before any of §115: the floor a fresh session
starts from. No hot-reload question appeared in the session's context.
The user said go at about 21:00; pre-flight green at `a99e1eb` (224 files,
3276 tests, typecheck clean).

### 115a — the Run's side, headless (2026-10-02) — read `none` ✅

**Step zero: a short dialed run that clears a sector.** A scratch scan
(`gate-scan.mts`, the audit's census loop) played 120 gated runs:
`sectorHops=2` and `=3`, three characters, seeds 1–20. 78 cleared their
first sector, in about 15 battles at `sectorHops=2`, at a median 0.8 s a
run headless. None met a port: the short sectors scatter none. So the pin
plays `sectorHops=2&character=soldier` seeds 2 (ends `complete`) and 1
(ends `defeat`), and seed 1 at full length for the port.

**What the read added to the audit.** `fromJSON` also reset two inputs the
audit's list didn't name: `rootStampedByDial` (the `firstNodeKind=event`
dial) and `sectorScatterConfig`, which it never assigned, so a loaded run's
sector advance dropped the scatter dials.

**Built.**
- `resolveRunInputs(config)`: the twelve config inputs a Run reads after
  construction, resolved in one place that the constructor and
  `fromJSON(snap, bus, config?)` share. No config gives the shipped
  defaults, as before. The inputs that shaped construction (roster, daemon,
  bits, character, grants) come from the snapshot, which wins.
- Run v47: `clearedSector` (the cleared sector's id and the pool before the
  seam's heal; the title resolves from the catalog, and an unknown id
  rejects at load) and `lastTurn` (winner and reason, set at every turn
  boundary on both paths, reset at encounter start and end). Fingerprint
  re-pinned; the five literal version pins in `Run.test.ts` moved.
- `turn:starting` carries `lastTurn` (winner, reason, the turn's fallen
  rows; null on turn 1). Game's `turn:resolved` buffer still feeds the
  strip until 115e moves the screen onto the payload.
- `Run.resume()`: re-emits the saved phase's gate event from saved state;
  no event at `map`; `battle` and `turn-outcome` throw by name; a gate
  phase with its state missing throws by name.

**The pin** (`tests/integration/resume-gates.test.ts`, 7 tests): the three
runs keep a save at every arrival at a gate, and each save, loaded with its
dials on a fresh bus, resumes to exactly the live arrival's event. 109
arrivals compared: map 15, port 1, event 4, turn-intro 42 (33 with a
strip), reward 7, promotion 31, recruit 4, sectorCleared 2, defeat 2,
complete 1 (counted through a failing `expect`). Controls: `lastTurn`
blanked and `poolBefore` changed each resume to a different payload. The
inputs pin loads a run under two dialed configs (`hopCount` and
`sectorHops` exclude each other) and reads the same twelve inputs as the
live run, and the shipped defaults without the config; its control is that
every input is off its default in one config or the other. The file takes
about 3.5 s alone, most of it the three runs played at collection.

No RNG stream and no bus event changed; the seed-7 drive's log hash
covers the commands only, so a snapshot field can't move it.

### 115b — the continuation check (2026-10-02) — read `none` ✅

115a's commit (`8a37724`) carried the reading **288,751** at 21:18: about
206k for orientation, the stretch's start and 115a together. The hook ran
the fuzz smoke there, 582 green.

**Built** (`tests/integration/continuation.test.ts`, on every `npm test`).
A run is played straight through by the pane kit's rows, keeping its steps
and its text at every gate (every phase but `battle` and `turn-outcome`).
The same steps are then sent to a run that is turned to text and loaded
again, on a fresh bus and with its own config, at every gate; the two must
be equal byte for byte at each gate and at the end. It also asserts that
the four runs between them cross all ten gate kinds.

**Measured.** It passed on the first run, so the counts came through a
failing `expect` before the result was trusted:

| seed, dials | gates (= reloads) | battles | end | dials withheld: first divergence |
|---|---|---|---|---|
| 2, `sectorHops=2&character=soldier` | 44 | 16 | complete | gate 21, `sectorCleared` |
| 1, `sectorHops=2&character=soldier` | 37 | 15 | defeat | gate 17, `sectorCleared` |
| 1, `character=soldier` | 40 | 11 | defeat | none |
| 7, `hops=3&layout=procedural&character=priest` | 27 | 9 | complete | gate 4, `turn-intro` |

148 reloads, no divergence with the config. The withheld column is the
first control, and the full-length run's "none" is its null answer: that
run has no dial a Run reads after construction. The `sectorHops` runs
diverge where the next sector's map is generated; the forced layout is lost
at the next encounter's pre-turn screen. The second control blanks the
fallen ledger in the text at the first reward gate, and the check fails at
the next gate. The file takes about 8 s alone (4.5 s of tests, the rest
the straight runs played at collection).

**For 115c, from a survey of the command handlers** (a subagent's report,
not re-read here): every out-of-range index is a silent no-op, except that
`chooseRecruit` accepts any template, never checked against the offer
(`Run.ts`, the recruit handler). The chaos driver will send one.

### 115c — the chaos driver (2026-10-02) — read `none` ✅

115b's commit (`1f6ee59`) carried **321,698** at 21:26 (115b: about 33k).
`npm test` went 44.5 s → 45.4 s with the continuation check.

**Step zero: the handlers, surveyed.** A subagent read every `RunCommand`
handler's guard (its report, not re-read here, except the two below):
every illegal or out-of-range call is a silent no-op, except that
`chooseRecruit` appended any template it was given, never checked against
the offer (read: `Run.ts`, `handleChooseRecruit`). Every caller in the tree
sends an offered card (searched: the UI, the kit's rows, the fuzz harness,
the walkers, the tests). **Fixed** inside the cut's "findings fixed or
filed": a template not in the offer, compared by value since a replay and a
resumed screen send copies, is now a silent no-op; a `Run.test.ts` case
pins it, and fails with the guard removed.

**Built** (`tests/chaos/`):
- `chaos.ts`, the driver. A gated run with a `JournalRecorder`, the kit's
  rows for the command that moves the run on, and before it, at 60 % of
  the steps at a gate, a random command: legal-shaped with in-range fields,
  or (40 %) illegal, either out of phase or with a field out of range
  (`-1`, the length, length + 3, `0.5`; an off-frontier node; an
  off-offer card at level 999). In a battle: an order at 3 % of ticks
  (clear, at will, hold, engage or focus on an enemy, a neutral or a cell
  on the board) and a run command at 1 %, 90 % of them illegal. The share
  is that high because a battle's one legal command is a discard: at the
  gates' share the driver emptied the cache before any gate could fire a
  packet (the first sweep's `usePacket` applied 0 of 47).
- Its checks: an illegal command leaves the run's text unchanged (the
  `Command.ts` contract, which the cut didn't name; added because the
  out-of-range sends otherwise check only that nothing throws); the round
  trip at every phase change, loaded with the run's config; occupancy
  after every tick (`findOverlappingCells`); at the end, its journal
  replays to the recorded hash and the same bytes. A failure throws with
  the seed and dials and writes the journal, abandoned where it stopped.
- `chaos.test.ts`, on every `npm test`: four seeds chosen from a sweep for
  being short (`hops=3&layout=procedural` 3, no dials 2, `sectorHops=2` 6,
  `character=gambler&bits=300` 4; the Gambler's Janus grants a redraw every
  turn). The census: every one of the 20 journaled kinds sent, and all nine
  kinds of order. A plant per check, each caught with the seed in the
  message: the bits moved in the first round trip (caught at the `map`
  phase, the journal written and ending `abandoned`), two units on one cell
  at tick 5, the first moving command sent as one that must be a no-op,
  and the first `enterNode` cut from the journal (the replay refuses: an
  order for tick 4 with no battle). The file runs in about 4 s.
- `cli.ts`, `npm run chaos -- --seeds=N [--dials=<query>]`: four dial sets
  (`sectorHops=2`, `hops=3&layout=procedural`, `character=gambler&bits=300`,
  none), one line per run, journals to `output/chaos/`.

**The sweep** (`npm run chaos -- --seeds=25`, four dial sets, 100 runs):
green, 196 s, 1180 battles, 10 runs complete and 90 defeated, the
slowest 8.1 s. Commands sent / applied (applied = the run's text changed):
enterNode 771/489, chooseRecruit 298/114, passRecruit 264/57,
dismissPromotion 998/747, dismissSectorCleared 265/15, leavePort 293/34,
buyPortUnit 195/1, buyPortPacket 208/1, buyPortDaemon 245/3, sellPacket
218/0, payToRemoveUnit 210/2, acceptReward 505/294, declineReward 242/59,
advanceTurn 2532/2360, redrawCards 419/11, empowerUnit 393/36, passGrant
322/115, discardPacket 5197/108, usePacket 538/11, chooseEventOption
615/306. **The gap:** `sellPacket` never applied, since it needs a packet
in the cache while docked, and the port buys applied once to three times.
The cut pins kinds sent, so this is the instrument's known weak spot, not
a failure.

### 115d — the journal across a load (2026-10-02) — read `none` ✅

115c's commit (`e851881`) carried **404,372** at 21:41 (115c: about 82k,
with the sweeps' output).

**Built** (the journal's format 1 → 2):
- `journal.ts`: the `resume` start (`hash`, `dials`), the `saved` end, and
  `dials` on a `snapshot` start, since `fromJSON` now takes them.
- `JournalRecorder`: `saved(snapshot)` is the journal as a save keeps it
  (every segment, the one being recorded ended `saved` with the snapshot's
  hash) while the recording goes on. `resume(saved, snapshot, dials, read)`
  carries the saved journal's segments and opens the next: a `resume` start
  on the build and config that recorded the saved segment, else a
  `snapshot` start. A journal that doesn't end `saved` at that snapshot's
  hash (none, another format, a finished one) is not carried, and the
  journal starts over from the snapshot.
- `replayJournal`: before anything runs, each `resume` segment is checked
  against the one before (it ended `saved`, at the same hash, on the same
  build and config), else `JournalRefused` names the segment. A resume
  loads the Run the segment before left through its text, with the dials,
  as the page loaded the save. `replayTool` describes the new start;
  `devLoadRun` opens its journal with no dials, as it loads; the recorder
  CLI's copy of the format number moved to 2.
- `driveRun` (`tests/journalDrive.ts`) takes `reloadAt(gate, run)`: at that
  gate the page closes, keeping the snapshot and the journal's saved copy,
  and a new page on the given build loads the run with its dials and
  resumes the journal, as `Game` will at 115e.

**The exit** (`tests/integration/journal-across-loads.test.ts`, 6 tests):
`sectorHops=2` seed 2, closed at five gates (3, 11, 19, 27, 33), the third
and fourth reopened on another build. The journal has six segments, started
`seed, resume, resume, snapshot, resume, snapshot`, the first five ended
`saved`. It replays with every segment closed, the battles summing to the
straight run's, to that run's bytes. Controls: a resume from a changed hash
is refused naming segment 1; segment 1 stamped with another build is
refused as resuming after segment 0's build. The recorder's resume is
pinned on its three cases (no journal, a finished one, one saved at this
snapshot). Two older tests planted format 2 as "another format"; they plant
format 1 now.

Filed in TODO "§115 riders": a clip of a continued run (the recorder's
`--journal` replays one segment from a seed).

### 115e — the autosave and the load, in the game (2026-10-02) — read `none` ✅

115d's commit (`7b17e2f`) carried **453,085** at 21:53 (115d: about 49k).
The build was committed on its own (`f724d54`, **504,247** at 22:03), so a
hand-off could fall before the checks.

**Built.** The run slot's wire is `{ snapshot, dials, journal }`, and a read
loads the Run with its dials and returns `{ run, wire }` (a wire with no
dials is unreadable). `Game.autosave` writes it after every command at a
gate and when a run is created; a run's end and a reset empty it; a refused
write is silent. `Game.continueRun()` reads the slot and adopts the run:
its dials, its journal resumed in a new segment, and `Run.resume()`
re-mounting the gate's screen (the map by its phase). `devLoadRun` goes the
same way at any gate and refuses a `battle` or `turn-outcome` export. The
pre-turn strip takes `turn:starting.lastTurn`; Game's `turn:resolved`
buffer is retired. Before the menu exists, `continueRun()` has no button:
115g puts Continue on character select.

**The exit, in the pane** (Chromium, `f724d54-dev`). Drives use
`policy: 'first'`, since the seeded picker restarts on a reload. The
reopen is the bare URL, since a URL with run dials starts its own run and
saves over the slot (call 8); the dials come back from the slot.
- **All eight gate kinds:** map, event, turn-intro, reward, promotion,
  recruit and sectorCleared on `seed=2&sectorHops=2&character=soldier`,
  and port on `seed=3&character=soldier` (step zero, headless: the first
  seed whose first-choice path docks). At each first arrival the slot held
  the live state's hash and the dials. Reopened at `/` (character select),
  `continueRun()` returned `ok` with the same phase, scene and hash, and
  driven on reached the unbroken drive's end hash (`b259e8bc`, complete;
  `bba4ed07`, defeat). Each journal read `seed>saved resume>(end)`.
- **The replay:** at the map and port gates, the continued journal through
  `replayText`, the function behind `npm run replay`, run in the page and
  forced past the `-dev` build: exit 0, the hash matched. Not under Node:
  the pane can't hand the file to Node without passing it through this
  session's context.
- **The seed-7 drive** in the Electron runner, with the autosave in the
  build: `a59ee48f`, defeat, 12 battles, 15.9 s. Whether Electron's store
  file took the writes was not read.
- **The strip:** headless, in `resume-gates.test.ts`: on a seeded drive
  every `turn:starting` from turn 2 on carries the winner, reason and
  fallen rows of the `turn:resolved` before it (13 compared, 3 first
  turns with none), the input the old strip was drawn from. No planted
  control. A resumed turn-2 screen's DOM text was not read in the pane;
  the 115g sitting looks at it.
- **`?store=deny`:** memory adapter, can't save. A text planted in the
  slot's key survived the boot and the saves through two battles, and an
  earlier run under deny played to defeat.
- **A stale slot** (v46) and **an unreadable one** (v47 around a broken
  snapshot): `rejected` (`stale`, found 46; `unreadable`, a TypeError),
  the text left in place, character select kept, no run.
- **The bundle:** +0.86 kB raw, +0.29 kB gzip (606.81 → 607.67 kB), with
  only 115e's five files reverted for the before.
- **Not measured:** what one write costs per command, in `localStorage` or
  in Electron's file (a step-zero hypothesis of the audit). The journal is
  rewritten whole at every gate, so the cost grows over a run.

The preview server was stopped; no listener is left on 5191.

### The build stretch's hand-off (2026-10-02, session 5f729d11)

115a–e ran from about 21:00 to 22:20: seven commits, `8a37724` (115a) to
115e's write-up, the fuzz smoke twice (115a and 115c, 582 green each). The
meter read **548,990** at 22:16, and 115e's commit puts 115f's start past
the hand-off line (550k), so the stretch goes to a fresh session at a step
boundary: 115f (the two-tab lock), then 115g up to its `stop`, the sitting
in Firefox. No ◐ is open. Per-step cost from the commit readings: 115a
about 206k with orientation, 115b 33k, 115c 82k, 115d 49k, 115e about 95k.

**The hot-reload question, answered** (2026-10-03, the user's). Session
5f729d11 never answered a hot-reload question, and the user saw no prompt
either; the tool was listed (as a deferred tool) and read on its first
call. So a trusted workspace alone runs the mod, which closes the question
"The context rule, replaced" left open. CLAUDE.md "The context meter" now
says both: load it with ToolSearch when it is deferred, and trust is
enough.

### The build stretch, resumed (2026-10-03, session 126043e1)

A fresh session. The tool read **85,290** at 12:18, after HANDOFF and
ROADMAP §115 and before this section was read. Pre-flight green at
`9280558` (228 files, 3307 tests, typecheck clean).

### 115f — the two-tab lock (2026-10-03) — read `none` ✅

**Step zero.** The lock had no code, and no landing note in the source: a
search of `src`, `shell` and `tests` for the phrase found nothing, so §113's
call 6 left its note in the roadmap only. `Game` was the slot's one user, at
four call sites (the autosave's write and clear, `resetRun`'s clear,
`continueRun`'s read). The finished-journals section is read from storage at
every write (✔ `src/store/journals.ts:63-72`), so two tabs adding journals
don't lose each other's, and the lock covers the run slot alone.

**Built.**
- `src/store/runLock.ts`: `acquireRunLock(navigator.locks)` answers `held`,
  `elsewhere` or `none`. The first tab to boot takes the Web Lock
  `asciibattler:run` with `ifAvailable` and holds it for the page's life (a
  callback promise that never settles). The name is permanent, since a tab
  on an older build has to contend for the same one.
- `openRunSlot(store, bus, lock)` in `runSlot.ts`, the slot's one door:
  `read`, `write` and `clear`. With the lock another tab's, the save is
  neither loaded, written over nor emptied, and `read` answers
  `{ status: 'elsewhere' }`. A write refused that way is not a storage
  failure, so the store's status stays can-save.
- `main.ts` asks for the lock beside the font atlas (one `Promise.all`),
  and `Game`'s constructor takes it; `continueRun()` returns the slot's
  read, which can now be `elsewhere`. The kit's `ready()` report carries
  `lock`.

**Two calls made inside the cut, flagged for the user at the 115g stop.**
1. **A boot waits at most 1 s for the lock manager** (`ANSWER_WAIT_MS`),
   then goes on with no lock. Written before any environment was known to
   need it, as a guard on a boot that would otherwise hang on an API in an
   unmeasured frame (itch's).
2. **`elsewhere` needs a named holder.** The first build took a refusal
   (`null` from `ifAvailable`) as proof of another tab. The Electron
   measurement below found a lock manager that refuses a free name and
   lists nothing held, so a refusal alone now proves nothing: the tab asks
   `locks.query()`, is `elsewhere` only if the name has a holder, asks once
   more if it has none (the holder's tab may have closed between the two
   answers), and is then `none`. The inference, unmeasured in any browser:
   a lone tab in a browser whose storage is broken the same way would
   otherwise be told its run is open elsewhere and be unable to save.
   The cost is one more call in the second tab's boot.

**Headless.** `runLock.test.ts` (10 tests) over a stand-in lock manager
that keeps the real one's three rules (one holder per name until its
callback's promise settles or its page goes; `ifAvailable` answered with
null, in a later task; `query` listing the origin's holders): the first tab
holds and the second is elsewhere; two tabs booting at once; held for an
hour, free once the page goes; no lock for a missing API, a missing
`query`, a throw and a rejection; a refusal with no holder is `none` after
two requests; the holder closing between the refusal and the query gives
the lock to the asker; no answer is `none` at 1 s and not at 999 ms; a
grant after the wait is still held. `runSlot.test.ts` (+3): two stores over
one adapter as two tabs; the second tab's read, write and clear leave the
first's text as it was, with no read of the key counted. Both files passed
on the first run, so four plants were run and each failed by name: the
hold returned at once (4 tests), the guard always open (the second-tab
test), the deadline never firing (2), a bare refusal taken as `elsewhere`
(2).

**In the pane** (Chromium, the dev server, `9280558-dirty-dev`). All of it
ran on the first build, whose slot guard is the final one; the second
bullet, with the first tab's `held` before it and its `continueRun()`
after, ran again on the final code.
- The first tab reads `held`, and the browser's own `locks.query()` lists
  `asciibattler:run`, exclusive. Driven to a reward gate on
  `seed=2&sectorHops=2&character=soldier`, its slot held the live state's
  hash (`1dcac307`).
- A second tab at `/` reads `elsewhere`. `continueRun()` returns
  `{ status: 'elsewhere' }`, character select stays up and no run exists.
  Reopened at `?seed=7&hops=3&character=soldier`, a pinned boot that would
  save over the slot, and driven to its defeat (`9fcdfbfe`), the slot's text
  was the first tab's at boot, at its first reward gate and at the end. It
  was also unchanged after a `resetRun`, and the second tab's finished
  journal did join the journals section.
- The first tab then drove on and its slot followed (`524db0b9`). With that
  tab closed, the browser listed no holder, and the second tab stayed
  `elsewhere` and still wrote nothing. A third tab read `held`, and
  `continueRun()` put it on the pre-turn screen at `524db0b9`, its journal
  `seed>saved resume>(open)`.

**Does a reloaded page find the lock free?** The risk in `ifAvailable`: a
reload asks while the page it replaces may still hold the lock. Measured
with a scratch harness run from a same-origin document that is not the
game: the production build boots in an iframe, the iframe reloads, and the
lock manager is asked who holds the name after each boot (a boot that lost
the race shows no holder). Its control: the outer document takes the lock
itself, and the next boot must show that document as the holder.

| where | reloads that took the lock | boot, min / median / max | the control |
|---|---|---|---|
| the pane, `vite preview` over `dist/` | 30 of 30 | 187 / 231 / 471 ms | read as taken by the outer document |
| Electron, `app://game` | 30 of 30 | 121 / 183 / 313 ms | the same |

Six top-level reloads of a tab on the dev server also read `held` each
time. An iframe's reload stands in for a tab's here; no top-level reload of
the production build was counted.

**Electron.** On the shell's own page (`npm run probe`, `app://game`, the
preload's store, on the first build): a secure context, `navigator.locks`
present, the game's lock `held` and listed by `query()`, a second request
for the name refused, `continueRun()` `empty` on a fresh profile. On the
final code the seed-7 drive reads `held` and still logs `a59ee48f` (defeat,
12 battles).

**Two instances of the shell on one profile are not kept apart.** A second
instance started 6 s after the first, on the same `--profile`: the first
read `held`; the second read `none`, with the Electron adapter and
can-save, so it saves as if alone, and every write replaces the whole
`store.json`. In the second instance a raw request for a free name was
refused at once and `query()` listed nothing held. Its boot took about 8 s
against the first's 1.5 s; which of the two paths (the 1 s wait or the
refusal with no holder) gave its `none` was not measured. That one lock
manager does not span two processes is the reading of this result, not
something a document was checked for. The shell stays internal through
Round 8 (ROADMAP §118's scope guard), so the fix is filed, not built:
`app.requestSingleInstanceLock()` before the shell ships to players, in
TODO "§115 riders" with a landing note in `shell/electron/main.mjs`.
Unchecked there: whether Electron's lock is per `userData`, which decides
whether the probe and record runners can run beside a playing instance.

**Not measured.** Firefox, where the user plays: the 115g sitting gains a
reload (F5) at a gate, where Continue must show and the other-tab message
must not. itch's frame (carried in ROADMAP §116).

**Cost.** The production bundle is 608.38 kB raw, 170.32 kB gzip (115e's
entry gives 607.67 kB raw; not rebuilt here). `npm test`: 229 files, 3320
tests, 46.2 s (45.9 s at pre-flight). The reading before the write-up:
**286,023** at 12:42, about 200k for orientation and 115f together.

### 115g — Continue and the three messages on character select (2026-10-03) — read `stop`: ◐ built, the sitting unread

115f's commit (`4b8e286`) carried **304,511** at 12:48 (115f: about 219k
with orientation).

**Step zero.**
- `continueRun()` is not a run command. A new kind in `RunCommand` would
  join the journal's kinds and the chaos census, so Continue reaches the
  screen as a function in the scene context, as `journal()` did at 114e.
- Against DESIGN §UI idioms: Continue is a walk-on action, so it is
  `.btn--primary` with its place on its own class. A notice is not an idiom
  yet (the indicator over every screen is §116's), so the three messages
  are plain lines, the `⚠` kept outside the locale value. Both are drawn
  once with the screen, so nothing above the cards comes or goes while the
  player aims at one (layout stability, mechanism 3).
- A read of the slot made only to decide whether Continue shows must not
  leave a Run on the game's bus (the kickoff's note). It is `peek()`.

**Built.**
- `RunSlot.peek()`: `empty`, `saved`, `rejected` or `elsewhere`. The save
  is loaded on a bus of its own and let go, so `saved` means a continue
  would load it now.
- `SceneContext.save` (`slot()`, `canSave()`, `continue()`), built by Game
  at every swap.
- `CharacterSelectScreen`: Continue above the heading when the slot is
  `saved`; one notice each for a rejected save (`save.rejected`, which now
  has its caller), a run open in another tab (`save.elsewhere`) and a store
  that can't save (`save.unavailable`). A Continue that no longer loads
  draws the screen again, which then says why.
- Three keys: `save.continue`, `save.elsewhere`, `save.unavailable`.

**A finding, fixed here: a continued run had no chips.** The bits, morale
and cache chips start hidden on a boot at character select and are shown by
`run:started`, which a loaded run never emits. After Continue the map came
up with all three hidden (their values were repainted, the class stayed).
115e's pane checks compared the screen and the state hash and never looked
at the chips; its own list of what it left unread didn't name them. Fixed
with a `reveal()` on each of the three chips, called by `Game.adopt` before
the resume, so a loaded end state's own event hides them again. Emitting
`run:started` from Game was the smaller change and was not taken: a
continued run is not a started one, and a later listener that counts runs
would count it twice.

**Headless.** `runSlot.test.ts` +2: `peek` answers `empty`, then `saved`
twice with no subscription made on the game's bus and the text as it was (a
`read` on the same slot does subscribe: the control); a stale and an
unreadable save are `rejected` with their text left; another tab's is
`elsewhere` with no read of the key. The plant (`peek` loading on the
game's bus) fails the first by name.

**In the pane** (Chromium; the dev server, `4b8e286-dirty-dev`).
- **Continue.** A boot at `/` with a run saved shows Continue above the
  heading and no notice. A click mounts the saved screen at the saved hash
  with the bits, cache and morale chips shown and reading the run's values.
- **A pre-turn screen on turn 2** (`seed=2&sectorHops=2&character=soldier`,
  the first battle's second turn): the strip's text, the state hash, the
  team, the bits and the pool before the reopen and after Continue are
  equal. The strip read "Last turn · Skirmish won · yours: nobody fell 0 ·
  theirs: B b B B B B B B −10". This is the DOM read 115e left open.
- **A stale save** (the slot's envelope at v46): no Continue, the rejected
  message, the text left in place. Picking a character then wrote the new
  run over it (v47).
- **`?store=deny`:** no Continue and the can't-save line.
- **A second tab:** no Continue and the other-tab line, while the first
  tab shows Continue and no notice.
- **The production build** (`vite preview`, `4b8e286-dirty`): no Continue
  on an empty store; a character picked, the page reopened, Continue
  shown; a click brings the map with its three chips shown.
- Not read in the pane: the deal on a resumed pre-turn screen (a hidden
  pane holds animations at their first frame), Enter on Continue (the pane
  runs no native default action), the Tab walk.

**The lock moves under a dev server's reloads.** With two tabs open on the
dev server, each `.ts` edit reloads both, and the lock goes to whichever
boots first. A second tab opened on run dials won it once and saved its own
new run over the slot, which is what call 8 says a boot with dials does.
`process/browser-pane.md` now says to close the second tab.

**For the user at the stop.**
1. The two calls of 115f (the 1 s wait; `elsewhere` needs a named holder).
2. **A rejected save is replaced by the next run's first save.** Spec D2
   says the rejected run's journal stays exportable. Until §116's menu
   nothing exports it, and with one slot the new run has to save
   somewhere. Whether a new run first moves a rejected save's journal to
   the finished journals, or the slot is held until it is exported, is
   §116's to decide.
3. DESIGN has no paragraph on saving. The phase close is the place, once
   the sitting has read what it would describe.
4. The stand-ins' place and wording are the sitting's to judge: Continue
   above the heading, the notices in amber under it.

**Cost.** The production bundle is 609.72 kB raw (608.38 at 115f), the
stylesheet 56.50 kB (56.25). `npm test`: 229 files, 3322 tests, 47.0 s.
The reading at the stop: **396,242** at 12:59 (115g: about 92k). What is
left of the phase is the sitting's findings and the close, which looks
likely to fit under the line.

### The 115g sitting (2026-10-03, the user's) — READ, one finding filed

In Firefox, reported at about 13:50. The verdict: "Everything else seems
good!"

**The finding: a reward's taken rows don't survive a reload.** "If you
reload in the middle of accepting rewards, the already accepted rewards
don't render." The user reads it as fine and as a TODO, and asked whether
restoring them needs a version bump. Read after the report: the engine
splices a resolved portion out of `pendingRewards` (`Run.ts`,
`takePendingReward`), and the rows marked Taken are the screen's own list
of the offer as first shown (`RewardScreen.ledger`, kept so no row jumps
under the pointer). The save holds only what is left, so yes: keeping them
means a `RunSnapshot` field and a bump. Filed in TODO "§115 riders" to
ride §117's bump or be dropped. The port was checked for the same shape and
doesn't have it: a sold slot is a flag in the saved stock. The other
screen-held state a load drops is the deal's cue sequence, decided at the
shape-lock (call 10).

**The calls.** The 1 s wait: signed. The rejected save, replaced by a new
run's first save: carried to §116, signed (ROADMAP §116's carried line).
That a tab is `elsewhere` only when the lock manager names a holder: the
user asked for it to be explained again; open.

The reading: 408,239 on the 115g commit (`d9d389d`) at 13:02.

### The §115 close (2026-10-03, session 126043e1)

**The last call, signed.** After a second account of it ("that makes
perfect sense now... signed"), the user signed that a tab is `elsewhere`
only when the lock manager names a holder. The first account was at fault,
not the call: it led with the mechanism, and the second led with what a
player would see. All three calls of the 115g stop are settled, and the
user asked for the close.

**The exit, against ROADMAP's.**
- *The chaos driver and the continuation check green:* both run on every
  `npm test` (229 files, 3322 tests at the close).
- *A run saved at any gate reloads byte-faithfully:* headless at every gate
  of four runs (115b, 148 reloads); in the pane at all eight gate kinds
  (115e); in Firefox at the user's sitting (115g), read good.
- *A stale save rejected with its message:* the pane, with a planted v46
  slot (115e for the rejection, 115g for the message on screen).

**The kickoff's predictions, against what happened.** One Run bump, at
115a (v47): held. No World bump, no RNG stream: held. No new bus event:
held, and it was a choice once, at 115g, where `reveal()` on the chips was
taken over emitting `run:started` for a loaded run. The fuzz smoke fired at
115a and 115c and nowhere else. The journal's format went to 2 at 115d.
"Two i18n keys" became three (`save.continue`, `save.elsewhere`,
`save.unavailable`), the third from call 11's split. `npm test` went from
44.5 s to about 47 s. The production bundle grew 0.86 kB at 115e, 0.71 at
115f and 1.34 at 115g, to 609.72 kB raw.

**What the phase's instruments turned up that no plan held.** The audit's
round trip held at 555 saves of 555 beside four dials `fromJSON` reset. The
handlers' survey for the chaos driver found `chooseRecruit` taking any
card. The Electron measurement overturned 115f's first rule for a second
tab within the hour it was written. The 115g pane check found a continued
run's chips hidden, which 115e's comparison of screen and hash had passed.
The user's sitting found the reward's taken rows.

**Step costs, from the commit readings** (for the round close, which
resets the hand-off line): 115a about 206k with a fresh session's
orientation, 115b 33k, 115c 82k, 115d 49k, 115e about 95k, 115f about 219k
with orientation, 115g about 92k, the sitting's bookkeeping and this close
about 43k to the reading below. The user's prediction at the rule's signing
(no single average step size) holds over these seven: 33k to 219k. Two
hand-offs, one at a step's start past the line and one at the phase's end.

**Where what is left went.**
- ROADMAP §116: Continue and the three messages move to the menu; the
  mid-run write-failure indicator; `navigator.locks` in itch's frame; what
  a new run does with a rejected save.
- ROADMAP §117: whether a reward's taken rows are saved, at its kickoff.
- TODO "§115 riders": a clip of a continued run; one instance of the shell
  per profile; the reward's taken rows; a write's cost per command, which
  the audit listed for step zero and no step measured; DESIGN's
  out-of-scope list, which still names built things as backlog.

**What the close wrote.** ROADMAP §115 demoted to its outcome and ticked
lines, and the status line moved on. DESIGN gained "Saving" under Run
structure, and its out-of-scope list lost save/load and replay. The
HANDOFF Cursor points at the §116 kickoff, with §114 folded into
"Earlier". `retro/sessions.md` has the phase summary and this session's
addendum.

The reading at the close: **450,934** at 14:32. The §116 kickoff goes to a
fresh session: the last close and kickoff audit together read 352k.

## Phase 116 — the menu and settings

### The §116 audit and cut (2026-10-04) — the shape-lock is open

Session 618ddb0a, fresh, from about 08:20. Pre-flight: typecheck clean;
`npm test` 229 files, 3322 tests, 51.8 s. Readings: **96,954** at 08:23,
after HANDOFF, `process/planning.md`, ROADMAP and the context tool's load;
**268,292** at 08:29, at the audit's end. ✔ = read by this session at
file:line, or measured.

**What is there.**
- **The store has no settings.** `settings` and `progress` are reserved
  section names (✔ `src/store/store.ts:50`) and no section is defined for
  either; `store.read` and `store.patch` have no caller outside tests, and
  `store.onStatus` has no listener (✔ a search of `src`). `canSave` is read
  once, when character select is drawn (✔ `Game.ts:955`,
  `CharacterSelectScreen.ts:79`), so a write that fails later shows nowhere.
- **Nothing sits between the store and the game at boot.** `./store` is
  `main.ts`'s first import, pinned (✔ `tests/store-boot.test.ts`), and the
  next module that could apply a stored value is `./Game` itself, whose
  graph bakes the catalogs' prose and the colour tables as it loads.
  `setActiveLocale` has no caller, `registerLocale` and `registerUiLocale`
  have none outside tests, and `locales/` holds `en` only (✔), so there is
  no second locale to switch to. `locale.ts` reaches `prose.ts` (zod) and
  `provenance.ts` (`core/fnv1a`) and no catalog (✔), so a boot module can
  set the locale without loading one.
- **Every setting the charter names has its seam, and none has a control or
  is stored:**

  | setting | the seam | today's value | set by, today |
  |---|---|---|---|
  | volume | `AudioPlayer.setMasterVolume`, one axis (✔ `AudioPlayer.ts:207`, `:260`) | master 0.5 × the sound's own level | nothing |
  | keys | `Keybindings.rebind`, no conflict check (✔ `Keybindings.ts:68`); 11 actions (✔ `config/keybindings.json`) | the config's defaults | nothing |
  | starting speed | `PlaybackSpeed`'s `selected` (✔ `PlaybackSpeed.ts:33`, `:40`) | 1× | the HUD's buttons, per page |
  | reduced motion | `setReducedMotionOverride` (✔ `motion.ts:66`) | follow the OS | Ctrl+Alt+A |
  | shake | `setShakePolicy`, four policies (✔ `lossFx.ts:51-61`) | `player` | Ctrl+Alt+K |
  | aura effect | `window.__auraFx`, read each frame, three modes (✔ `BattleRenderer.ts:131`, `:419`) | `track` | the console |
  | palette | `COLORS`, a const literal (✔ `palette.ts:5`), imported by nine render modules and nothing else | one palette | nothing |
  | text scale | 20 `--text-*` tokens in rem (✔ `ui.css:68-87`) | the browser's 16px | nothing |
  | locale | `setActiveLocale` (✔ `locale.ts:53`) | `en` | nothing |

- **The key registry has no modifier check.** It dispatches on the bare
  `code` and calls `preventDefault` whenever the bound action has a live
  handler (✔ `Keybindings.ts:92-101`; `devKeys.ts`'s header says the same).
  Read from the code and not tried in a browser: with Focus on F, Ctrl+F in
  a battle arms Focus and the browser's find doesn't open. A rebind surface
  widens this to any key a player picks (R, with Ctrl+R).
- **Two key labels are read once** (the charter's two): Fight-now's, built
  with each battle's HUD (✔ `HUD.ts:324`), and the sector-map chip's, a
  string handed over at construction for the page's life (✔ `Game.ts:343`).
- **Colour outside `COLORS`.** Raw hex in `src` outside tests: the status
  and empower hues, 10 and the magenta fallback (✔ `statusDisplay.ts:39-97`);
  the HP gradient, 3, each a copy of a `COLORS` value (✔
  `UnitOverlayLayer.ts:475-477`); the tiles and layout themes, 21 (✔
  `TerrainRenderer.ts:752-818`). In the stylesheet, 13 tokens mirror
  `COLORS`, pinned equal, and 22 are role tokens, several of them shades of
  a palette hue (`--color-amber-hover`, `--color-green-dim`,
  `--color-blue-dim`, `--color-boss-red`; ✔ `ui.css:26-60`).
- **The reads carried by hue alone, as the docs list them: one.** A camp
  unit's status pip (DESIGN "Color redundancy"; TODO §98 riders). Team
  identity, rarity, map node state and kind, the DoT numbers, deep water
  and the destructible wall each have their second channel. This session
  ran no grey read; the list is DESIGN's.
- **Text set in boxes that don't scale.** `ui.css` has 423 lines with a px
  length, 38 of them a width or a height, against 1 in ch, rem or em (✔ a
  count). `--chip-w` is 200px, "sized off the widest live one-line form
  measured at 18px" (✔ `ui.css:11-16`). So a larger root font-size grows
  text inside boxes that stay the same. Which screens overflow at which
  scale is unmeasured.
- **The boot.** `Game`'s constructor mounts the map when the URL pins a
  character and character select otherwise (✔ `Game.ts:454`); a reset goes
  the same way (✔ `:788-806`). Every dev entry pins `character=`: the board
  fixtures (✔ `fixtures.ts:49`), the probe runner (✔ `probe-cli.mjs:7`),
  and the recorder and `drive()`, which refuse without a run at boot (✔
  `record-page.js:111`, `src/dev/probe/index.ts:578`). The kit names a scene
  from a table of classes (✔ `src/dev/probe/scenes.ts`), so a new scene
  needs its row there.
- **Character select holds the menu's parts:** Continue, the three notices
  and the build ID, through `SceneContext.save` (✔
  `CharacterSelectScreen.ts:62-111`, `Scene.ts:81-90`).
- **Finished journals have no surface.** `keepJournal` writes them and
  nothing reads them back for the player once the end screen is left (✔
  `journals.ts`, a search for `finishedJournals`). A rejected slot's text
  stays in place (✔ `store.ts:265-288`) until `confirmCharacter`'s autosave
  writes over it (✔ `Game.ts:475`).
- **The store hands out no section's raw text** (✔ the `Store` interface,
  `store.ts:112-130`), so the export and the import are new surface on it.
- **A seeded run is already told apart at the game layer.** The run's dials
  hold `seed=` only when the config set one; a run seeded from `Date.now()`
  has none (✔ `Game.ts:848-858`, `RunConfig.ts:420-423`). The dials are
  saved in the slot and in the journal's start.
- **Credits.** `localeCredits()` gives nothing for `en` (✔ `credits.ts`).
  The fonts' licences are in the tree (`assets/fonts/jetbrains-mono/OFL.txt`,
  `assets/fonts/dejavu-sans-mono/LICENSE.txt`, each with `AUTHORS.txt`).
  Unchecked: whether `dist/` carries them, and the notices of the bundled
  libraries (three, simplex-noise, zod).
- **No idiom for four things the phase needs:** a slider, a text field, a
  settings row, and a notice over every screen. The focus ring's selector
  is `button, select, [role='button'], [tabindex='0']` (DESIGN "Focus"), so
  an `<input>` is outside it.
- **Electron on one profile twice** is possible: `main.mjs` takes
  `--profile=<dir>` (✔ `:20`), and the probe runner otherwise makes a fresh
  one per run (✔ `probe-cli.mjs:93`).

**Hypotheses for step zero** (unmeasured).
- Whether a modal over a live battle needs to pause it; the sector-map
  overlay holds no playback handle (a search of it for `pause` found none).
- What `pressable`'s deferred Space does once pause is on another key.
- How many of the 38 px boxes hold text, and which screens overflow at
  125 % and 150 %.
- Whether a colourblind palette can keep the five identity hues apart under
  all three simulations and still look like this game.
- What a download does in itch's frame, Firefox's `localStorage` limit,
  `navigator.locks` in the frame, and a write's cost per command: the
  sitting's.

**Calls for the shape-lock, with the session's lean.**
1. **The settings surface is the 96f modal,** opened from the menu's row
   and, during a run, from a new chip in the chrome column, where it also
   holds Quit to menu and pauses a battle while open (the lean). A stranger
   in a fight then reaches the volume without closing the tab. The other
   shapes: settings on the menu only, or a full screen, which can't sit
   over a run.
2. **What skips the menu:** a URL with any run dial, or a `?bp=` bookmark,
   boots as it does today (the lean). Every dev entry already pins
   `character=`, so none changes.
3. **A run's end goes to character select, as today,** and character select
   gains Back to the menu. New run with a run saved replaces it at the
   character pick, two clicks from the menu, with no confirm (the lean).
   The other shape: every new run starts from the menu, one click more.
4. **The `seeded` flag waits for §117.** The seed field sets the run's
   seed, which rides the saved dials, so §116 makes no Run bump; §117, the
   flag's only consumer, chooses between a snapshot field in its own bump
   and reading the dials (the lean). The other shape: v48 here.
5. **The colour deficiencies** (ROADMAP's decision point). One alternate
   palette. Gated, under protan and deutan simulation: the ten pairs among
   the five identity hues (yours, the enemy's, a camp's, stone, cracked
   stone). Tritan is measured on the same pairs and reported, and gated too
   if a candidate passes it at no cost to the look. The status and empower
   hues are re-picked and reported, not gated: their guarantee is the
   pip's new symbol and the card's text (the lean). Red-green covers nearly
   all colour-deficient players, and green against red is the pair this
   game leans on most. The other shapes: a palette per deficiency, or
   gating all three from the start.
6. **The locale has no row yet.** The stored field and the boot seam are
   built and proven with a locale planted in a test; the row appears when a
   second locale is registered (the lean). A select with one option is
   noise.
7. **Aura and shake as rows.** Aura: two options, `track` (the default) and
   `fill`; `fixed`, the A/B's loser, is deleted (the lean; TODO's "scrub
   the losers or promote"). Shake: the four policies as they are, `player`
   the default.
8. **The keys.** Binding a key that another action holds swaps the two, so
   every action stays bound (the lean); Enter, Tab and Escape can't be
   bound; a keydown with Ctrl, Alt or Meta held fires no hotkey.
9. **The data rows sit in the settings,** not as a sixth menu row: Export
   everything and Import (the store's backup, spec D1), and Export last run
   (spec D5's "from the menu", read as reachable from it). A new run first
   moves a rejected save's journal to the finished journals, so it stays
   exportable after the slot is reused; a slot that isn't an envelope has
   no journal and is replaced (the lean).
10. **Credits: the names are the user's to give.** The lean for the rest:
    the fonts and the bundled libraries, each with its licence's name, and
    the licence texts shipped beside the build.

Folded into the steps rather than posed: the starting speed is its own row,
which the battle's speed buttons don't write; the default loudness stays
today's; choices are rows of `button()` toggles and a volume is a native
range input with − and + buttons, so every value is one click.

**Predictions for the cut.** No Run bump (call 4), no World bump, no RNG
stream, no new bus event (the settings notify their own listeners, so the
sound table is untouched). The fuzz smoke fires at no step: nothing planned
touches `src/sim|run|core|config|bot`, `config/` or `tests/fuzz`; a step
that does says so. `drive-run --seed=7` logs `a59ee48f` at every step. The
font subset is regenerated at 116g only if a pip symbol is outside it.
DESIGN gains: the menu's and the settings' rows in the Input accessibility
checklist, the settings row and its two controls and the can't-save
indicator in §UI idioms, and the sentences on "a Round 8 setting" in
Tokens, Reduced motion and Saving, each rewritten as built. The production
bundle (609.72 kB raw at 115g) is measured at each step.

**The cut as proposed (unsigned; it goes into ROADMAP §116 once signed).**
Twelve steps: three `none`, four `batch`, five `stop` read at three
sittings.
- **116a — the settings, headless.** `src/settings/`: the lenient section
  (a field per setting, each with its schema and fallback), a model that
  reads, patches and notifies, and `main.ts`'s second import, which applies
  what must be in place before the catalogs and the colour tables load (the
  locale, the palette's name). Exit: each field round-trips through the
  memory adapter; a bad stored value falls back alone; the boot module is
  the second import and reaches no catalog, with its planted control; a
  locale planted in a test resolves through the seam. Read `none`.
- **116b — the consumers, no surface.** Each seam takes its stored value at
  boot and a change live: master × SFX × the sound's own level (music
  stored); the keys over the config's defaults, with the swap rule, the
  modifier rule and the two labels live; the starting speed; the motion
  override; the shake; the aura mode, its console switch retired. Exit:
  headless pins for the volume arithmetic, the key rules and the starting
  speed; a value written through the model is applied after a reload on the
  dev server, on the production build, and under Electron on one profile
  launched twice. Read `none`.
- **116c — the menu.** `MenuScene`, the boot screen: the title, Continue
  when a run is saved, New run, the seed field, the three notices, the
  build ID. Character select gives those up and gains Back. Calls 2 and 3.
  Exit, in the pane: each row's route; the four slot states of 115g, on the
  menu; a recorder fixture and the run driver boot past it. Read `stop`,
  one sitting with 116d.
- **116d — the settings surface.** Call 1: the modal, its two openers, and
  the rows for the two volumes, the starting speed, reduced motion, the
  shake and the aura effect. DESIGN §UI idioms gains the settings row and
  its controls; the focus ring gains `input`. Exit: each row changes its
  consumer live and survives a reload; Esc, the backdrop and ✕ are one
  gate and focus returns to the opener; the UI pins hold. Read `stop`, in
  Firefox: boot to the menu; Settings; move a volume and hear it; reload
  and find it kept; start a run and open settings from the chip in a
  battle. Wrong is a row that doesn't hold, a control the Tab walk misses,
  a battle that runs on behind the modal.
- **116e — the keys.** A row per action with its name and key; a click,
  then a key, rebinds; call 8's rules; Reset to defaults. Read `batch`, at
  116g's stop: rebind Pause to P; the Fight-now button and the tooltips say
  P and Space no longer pauses; bind Focus to P and see the two swap; Reset
  restores. Wrong is a stale label, one key firing two actions, or Ctrl+F
  still swallowed.
- **116f — the palette's mechanism.** `COLORS` is chosen by name at boot;
  the hexes that copy or extend it (the status and empower hues, the HP
  gradient, the hue-shade role tokens) move onto palette names, and the
  stylesheet's tokens are set from the palette at boot. Exit: with the
  default palette every colour is the value it was, compared against a
  table taken at the parent commit, with a planted change caught. Read
  `none`.
- **116g — the colourblind palette.** The simulator and the distance check
  on every `npm test`, checked first against known answers (the default
  green and red must fail under protan and deutan; a published safe pair
  must pass); the candidate and its table; a symbol per status on the camp
  unit's pip; the Palette row, which applies on reload and offers it. Read
  `stop`, twice: the candidate with its table, before it is wired; then the
  eye, on a battle, the map and a camp fight.
- **116h — the data rows.** Call 9. Exit, headless: an exported store
  imported into an empty one reads back equal section by section; a file
  that isn't an export is refused with nothing written; a rejected slot's
  journal is in the finished journals after a new run starts. Read `batch`,
  at the sitting: Export everything, change a setting, Import the file, and
  the old value is back after the reload.
- **116i — the can't-save indicator.** A chip, last in the chrome column,
  shown in words while the store can't save, from `store.onStatus`; a DEV
  plant fails writes after boot. DESIGN §UI idioms gains its paragraph and
  its row. Read `batch`, at the sitting: with the plant, the chip appears
  at the first choice of a run and nothing else moves.
- **116j — credits.** Call 10: the modal from the menu's row, and the
  licence texts beside the build. Read `batch`, at the sitting.
- **116k — the text scale.** Step zero measures: at each scale, on every
  screen of a driven run, which boxes overflow. Then the row and the boxes
  that hold text moved to rem. If the count is large, the range comes back
  to the user before the sweep. Read `stop`, taken at the sitting, which
  follows it.
- **116l — THE SITTING.** The production build in Firefox, under Electron,
  and as the itch draft (the user uploads the zip): a setting kept across a
  reload, a closed tab and a restart in each; in itch's frame, a download,
  two tabs for the lock, and, on a build with a diagnostics flag, the
  `localStorage` limit and a write's cost on a run of the shipped length,
  whose exported file gives the journals budget its second number. The
  `batch` reads of 116h–j and 116k's. Then the exit against ROADMAP's, and
  the close. Read `stop`.

**The stretch and the context.** The first stretch runs from the
shape-lock to the stop after 116d: two headless steps and two surfaces.
§115's steps cost 33k to 219k each. From 268k that does not look likely to
fit under the 550k line. The lean: 116a and 116b here, where this audit is
in context, then a hand-off, and a fresh session builds the menu and the
settings surface to the first sitting.

### The §116 shape-lock, first part (2026-10-04, the user's) — seven calls agreed, 3 amended, 5 and the cut open

Between 08:35 and 09:25 (the message's own time was not read; this
entry's commit, `f3bd815`, carried **321,952** at 09:26). The reading on
the audit's commit (`0983f0d`): **301,441** at 08:35. The user: "I think that I agree with all of your calls, save
two", and "I'm good with that rough session plan too, though I think that
we might get farther than you're predicting". The step-start rule decides
how far: the reading at each step's start, against the 550k line.

- **Calls 1, 2, 4, 6, 7, 8, 9: agreed** as proposed.
- **Call 3, amended by the user:** a won run goes to the credits the first
  time and to the menu after, not straight to character select. Their
  reason: it is the genre's standard, and a run is about 40 minutes when
  they play, so one more click per run costs nothing; end screen to
  character select reads as a game of ten-minute runs. The session agrees.
  Its first lean leaned on the spec's "minimal friction", which is about a
  player's first ten minutes, getting into a run, and says nothing of what
  follows one. The session's reading of the amendment, put back to the
  user: both end screens exit to the menu, a defeat too; the first won
  run opens the credits on the way; under a dial boot (call 2) a run's end
  goes as it does today, so the drivers don't change; character select
  keeps Back. Open until the user confirms the defeat's route.
- **Call 5:** not a disagreement. The user doesn't know the terms and asked
  for them; explained in the reply, and open until they sign it.
- **Call 10, answered:** the user as developer and no playtester by name
  (none has cleared it); the third-party assets and every framework; and
  Claude. Still to give: the form of their name.
- **The cut and its reads:** not yet signed in words.

**Read after the reply, for call 10.**
- `public/THIRD-PARTY-LICENSES.txt` exists and ships in the build (✔ 321
  lines; `archive/post-72-worklog.md` §79g says `dist/` carries it). It
  holds the two fonts with their full licences and nothing else: a search
  of it for three, simplex and zod found none. The audit's "unchecked:
  whether `dist/` carries them" is answered for the fonts. The three
  bundled libraries' notices are missing from the build (✔ `package.json`
  `dependencies`: simplex-noise, three, zod; their licence files not yet
  read).
- The commit trailers name seven Claude models across the history (✔
  `git log`: Fable 5, Opus 4.8, Fable 5.1, Opus 5.5, Opus 4.7, Opus 4.8 1M,
  Opus 5), so one line for Claude covers them.
- The sounds: 11 of the 25 are `gen-sfx` recipes (✔ `scripts/gen-sfx.mjs`),
  `thud` is hand-made and `morale_loss` is the user's chiptone
  (ARCHITECTURE). The other 12 (burn, chain, click, dash, death, healtick,
  lose, magicboom, melee, recruit, shoot, win) have no provenance in the
  docs searched; asked of the user.

**The two cut lines the amendment changes, as they would read.**
- **116c** gains: both end screens exit to the menu; under a dial boot a
  run's end goes as today.
- **116j** becomes: the credits as a static panel (nothing scrolls by
  itself, so reduced motion needs no second form): the developer, Claude,
  the fonts, the bundled libraries, the tools, and the playtesters thanked
  without names. Opened from the menu's row, and once on the way to the
  menu after the first won run: a `creditsSeen` flag, the `progress`
  section's first field. The three libraries' notices join
  `public/THIRD-PARTY-LICENSES.txt`.

### The §116 shape-lock (2026-10-04, the user's) — the ten calls SIGNED

After the reply above ("Signing your read of 3! Re five, I understand now;
thank you! Signed as well."). All ten calls are ✅ DECIDED, calls 3 and 5
in words and the other eight by "I agree with all of your calls, save two".

- **Call 3, as read:** both end screens exit to the menu; the first won run
  goes by way of the credits; a dial boot ends a run as today; character
  select keeps Back. A defeat's two clicks to a retry are watched for in
  playtests.
- **Call 5,** after the terms were explained: one alternate palette, gated
  on protan and deutan over the ten identity pairs, tritan measured and
  reported, the status and empower hues re-picked and reported.
- **Call 10:** "Matthew Kilgore" in full, as developer. The twelve sounds
  with no recorded source were made by the user in ChipTone
  (sfbgames.itch.io/chiptone) and sfxr.me, so all 25 sounds are the
  user's own or the repo's recipes. Both tools are credited as a courtesy.
  Their terms, as far as this session could read them: sfxr.me's page
  lists "Unrestricted commercial use" for its free version (through a
  fetch tool's summary, so second-hand); ChipTone's page was not read (a
  403 to the fetch tool, then a bot check in the pane, which was left
  alone).

**The cut and its reads were not signed in separate words.** The session
asked for three signatures and got two. It takes the cut as signed on the
user's "I'm good with that rough session plan too", since that plan names
the cut's steps and its first stop, and has told the user so. Every stop
in the cut stays a stop, and the first is after 116d; 116a and 116b are
read `none`. ROADMAP §116 carries the cut and the decision line.

**Confirmed after the hand-off** (the user, 2026-10-04: "You read my
intention correctly"): the cut and its reads are SIGNED.

### 116a — the settings, headless (2026-10-04) — read `none` ✅

The reading at the step's start: **350,495** at 09:52, on the signing
commit (`300c1e5`).

**Step zero.**
- The boot module's reach was read before it was written: `locale.ts`
  imports `prose.ts` (zod) and `provenance.ts` (`core/fnv1a`) and no
  catalog. The pin's expected file list was written from that reading and
  matched on its first run.
- **A field is what is stored, not what a consumer accepts.** `keys` holds
  any action name against any key code and `speed` any positive number.
  Checking them against the registry's actions or the playback's steps
  would import `src/config/keybindings.ts` and `playback.ts` into a module
  that is evaluated before the catalogs. The consumers take what they know
  (116b).
- The shake and aura choices are the settings' own lists, with no import
  from `src/ui` or `src/render`; 116b's wiring is where the compiler ties
  them to `ShakePolicy` and the aura mode.
- **A change inside the cut's intent:** the cut's line has the boot apply
  "the locale, the palette's name". Only the locale is applied here. The
  palette's name is stored now and has no seam to apply it to until 116f,
  which adds one to `applyAtBoot`.

**Built.**
- `src/settings/settings.ts`: `SETTINGS_SECTION`, eleven fields
  (`volumeMaster`, `volumeSfx`, `volumeMusic`, `keys`, `speed`, `motion`,
  `shake`, `aura`, `palette`, `textScale`, `locale`), version 1.
- `model.ts`: `createSettings(store)` with `get`, `set` and `onChange`. A
  value the field's schema refuses throws; a store that can't save returns
  false and the value holds for the page.
- `atBoot.ts` and `boot.ts`: `main.ts`'s second import sets the stored
  locale when the build ships it. `SHIPPED_LOCALES` (`en`) is in
  `src/i18n/locale.ts`; a second locale registers its sidecars in
  `boot.ts`, where the landing note is.
- `index.ts`: the page's settings, over the page's store. Nothing reads it
  yet.

**The fallbacks are the game as it was.** Master 0.5 is today's
`DEFAULT_MASTER_VOLUME`, so spec D7's formula (master × SFX × the sound's
own level) gives today's loudness with no hidden factor, and SFX and music
are 1. A master slider would then open at 50 %: 116d's read.

**Tests.** `src/settings/settings.test.ts`, 10: the field names pinned;
every field set, read from the adapter's text and read back by a second
store, with the two tables differing in every field; a refused stored
value falling back alone; `set` refusing; the listener; a store that can't
save; and the boot seam over a planted locale, with its control.
`tests/settings-boot.test.ts`, 3: the second import, the exact graph, and
a catalog planted behind the settings. By hand, then reverted: the boot
import moved below `fonts.css`, and a config import added to
`settings.ts`; the two pins failed by name. `tsc` refused an indexed write
in `model.ts` that Vitest had passed; fixed before the commit.

**A run is left alone.** `npm run probe -- shell/electron/probes/drive-run.js
--seed=7`: exit 0, `logHash a59ee48f`, 12 battles, on the working tree
(`0.0.0+300c1e5-dirty`), the store's adapter `electron`.

**Not verified.** No browser read: the page booting with the second import
was seen only under the Electron runner. No consumer reads the model, so
nothing a player sees has changed.

**Cost.** The production bundle is 610.94 kB raw (609.72 at 115g), the
stylesheet 56.50 kB. Typecheck clean.

### 116b — the consumers, no surface (2026-10-04) — read `none` ✅

The reading at the step's start: **385,910** at 10:00, on 116a's commit
(`c10cca7`; 116a cost about 35k).

**Step zero.**
- **A third label was read once,** beside the charter's two: the objective
  pane's buttons carry their keys in their words (`◎ Engage (E)`) and were
  redrawn only on objective events (`HUD.renderObjectivePane`).
- The sector-map chip's label had two sites, the chip's tooltip and the
  overlay's hint, both fed by one string made at construction.
- `PlaybackSpeed.setSpeed` unpauses, so a starting speed changed behind the
  settings in a paused battle would start the battle. It gets `select`,
  which leaves pause alone.
- The settings are the source of truth for the keys. The registry takes the
  stored overrides whole (`setOverrides`), and the rules are pure functions,
  so 116e's surface and a stored set go through the same ones.
- A bundled page can't reach module state, so under the Electron runner the
  shake policy and the aura mode are read only as stored. The dev server's
  page reaches both by `import()`.

**Built.**
- `src/settings/apply.ts`: `connectSettings(model, consumers)` hands every
  consumer its stored value at once and its new value on each change. The
  consumers are functions `Game` passes, so nothing they set imports the
  settings. `Game` connects them in its constructor, before the first
  screen, and holds the model as `settings` (a dev console's
  `__game.settings`).
- **Volume:** `soundVolume(master, sfx, own, gain)` and
  `AudioPlayer.setVolume(master, sfx)`, replacing `setMasterVolume`, which
  had no caller. The recorder's seam (`pools`, `play`) is as it was.
- **Keys** (`src/ui/Keybindings.ts`): `withRebind` (a taken key swaps the
  two actions), `RESERVED_CODES`, `resolveBindings`, `overridesOf`,
  `setOverrides`, `onChange`; a keydown with Ctrl, Alt or Meta held returns
  before any lookup. The three labels follow `onChange` or read a thunk.
- **Speed:** `PlaybackSpeed.select`. **Motion, shake:** their existing
  setters. **Aura:** `src/render/auraFx.ts` holds the mode; the renderer
  reads it each frame.
- `npm run probe` takes `--profile=<dir>`, kept between runs, and
  `shell/electron/probes/settings-persist.js` uses it.

**Changes inside the cut's intent, flagged for the 116d stop.**
- `NumpadEnter` is reserved with Enter; the signed call names Enter, Tab
  and Escape.
- Shift passes the modifier rule, since `?` is Shift+Slash.
- A stored key set is applied through the swap rule in the registry's
  action order. A set a rebind made resolves to itself (pinned, a
  three-key rotation included); one that names a key twice still gives one
  key per action.
- `fixed`'s deletion took its 35 lines out of the renderer
  (`shedAuraPulse`). Nothing watched an aura afterwards.

**Tests,** +23: `Keybindings.test.ts` 11, `PlaybackSpeed.test.ts` 2,
`AudioPlayer.test.ts` 3, `src/settings/apply.test.ts` 7 (recording
stand-ins for which call each setting makes; the real registry, playback
controller, motion gate, shake policy and aura mode read back through
their own getters; and the fallbacks held against what each consumer
starts at). Expected values are written by hand from the rules' words.
Three plants, then reverted: the modifier rule weakened, the motion
mapping swapped, `select` unpausing. Five tests failed, each named for
its plant.

**Under the Electron runner, one profile, three launches.**

| launch | master | SFX | pause key | speed | `data-motion` | stored motion · shake · aura |
|---|---|---|---|---|---|---|
| fresh profile (the control) | 0.5 | 1 | Space | 1 | none | system · player · track |
| the write, same page | 0.8 | 0.25 | KeyP | 2 | reduced | reduced · none · fill |
| a new process, same profile | 0.8 | 0.25 | KeyP | 2 | reduced | reduced · none · fill |

The profile's `store.json`, read from disk after the second launch, holds
the `asciibattler:settings` envelope with all eleven fields.

**In the pane** (Chromium).
- *The dev server* (`c10cca7-dirty-dev`): nothing stored and every consumer
  at its fallback; seven settings written through `__game.settings`, each
  consumer changed at once (shake `none` and aura `fill` read from their
  modules); after a reload (a new `page` id) the same seven values, with
  nothing written in between.
- *The labels, in a battle on that server:* `▶ Fight now (P)` became `(Q)`
  and `! Focus (F)` became `(G)` on one `set`; binding Pause to F then gave
  `▶ Fight now (F)` and `! Focus (Space)`, the swap.
- *The production build* (`c10cca7-dirty`, no `__game`): `data-motion` was
  absent with nothing stored; with the settings text planted in
  `localStorage` (`motion: reduced`) and a reload it was `reduced`.

**A run is left alone.** The seed-7 drive: exit 0, `logHash a59ee48f`, 12
battles.

**Not verified.**
- By ear: no sound was played. The levels were read as numbers on the
  elements and on the player.
- A real key press. The modifier rule and the swap are pinned headless, and
  the pane's labels changed through the model. A press in Firefox on the
  user's keyboard is 116e's read.
- On the production build only the motion attribute was read; the other
  consumers there are the same bundle's code, unread.
- How `track` and `fill` look: the mode was read back as state, and no
  battle with an aura carrier was watched.
- The sector-map chip's tooltip and hint after a rebind.

**A trap in the runner, now written down.** A probe script with a `const`
above its one function fails in the page with "Unexpected token 'const'",
since the runner wraps the file's text in a call. Three launches went to
it. `probe-cli.mjs`'s header says so now.

**Cost.** The production bundle is 612.71 kB raw (610.94 at 116a), the
stylesheet 56.50 kB. `npm test`: 232 files, 3358 tests, 45.7 s.

### The stretch's hand-off (2026-10-04, session 618ddb0a)

116b's commit (`6fd1ebe`) carried **493,189** at 10:17. The session hands
off here, before 116c, as the plan the user agreed said.

**Why here, under the line.** 493k is under the 550k line, so the
step-start rule alone would let 116c begin. The menu is a surface with a
new scene, a text field, the end screens' route, character select's
change and a pane walk; 115g, a smaller surface, cost 92k, and 116b cost
107k. From 493k that ends past the halt, with 116d still owed before the
stop. The user had said the session might get farther than predicted; the
estimate says not this step.

**What the stretch cost** (for the round close): orientation to 96,954;
the audit to 268,292 (about 171k); the shape-lock in three messages, its
bookkeeping and three docs commits to 350,495 (about 82k); 116a 35k; 116b
107k. The audit's prediction for the stretch was "about 300k for four
steps": two of them took 142k.

**For 116c and 116d, with no other home.**
- **The boot rule (call 2) as code:** the menu boots when
  `parseRunConfigFromURL()` is empty and the URL has no `bp`. `Game.runConfig`
  is parsed once and is read-only, so the seed field's seed is layered on it
  per run, the way `createRun(character)` layers the character.
- **A run's end (call 3):** `resetRun` goes to the menu on a menu boot and
  as today on a dial boot (`Game.ts`, `resetRun`'s two branches). The end
  screens' first button becomes the menu's; `gameover.newRun` is its key
  today. The first won run goes by the credits at 116j, so 116c routes
  both variants to the menu and leaves the credits' hook as a landing note.
- **What moves:** `SceneContext.save` and its three notices and the build
  ID leave `CharacterSelectScreen` for the menu; character select gains
  Back. DESIGN "Saving" ends with "Until the title menu exists, Continue
  and these notices sit on character select", and the Buttons paragraph
  names the end screen's two buttons.
- **The kit:** a new scene needs its row in `src/dev/probe/scenes.ts`, and
  `drive()` refuses a page with no run, so it keeps needing `character=`.
- **`AudioPlayer`'s header** says the first gesture is a map-node click;
  with the menu it is a menu row.
- **116d:** the surface needs the model in `SceneContext` (`Game` holds it
  as `settings`). A modal over a battle pauses with `playback.pause()` and
  must resume only if it found the battle running. The seed field is an
  `<input>`, outside the focus ring's selector until that step adds it, so
  116c either adds `input` to the ring itself or says the field's ring is
  116d's.
- **For the 116d stop, to put to the user:** the master slider opens at
  50 % (the default loudness is master 0.5); `NumpadEnter` is reserved with
  Enter; Shift passes the modifier rule. (The cut's signature is no longer
  among them: the user confirmed it after this entry.)
- **Still to come from the user:** nothing blocks. ChipTone's terms were
  not read; 116j reads them or asks.

### The stretch, resumed (2026-10-04, session 8be1fe88)

A fresh session, from 11:28. The reading after HANDOFF, ROADMAP §116 and
the context tool's load: **92,406** at 11:28. The stretch is 116c and 116d,
to the first sitting.

### 116c — the menu as the boot screen (2026-10-04) — read `stop`: ◐ built, the sitting unread (it is one sitting with 116d)

**Step zero.**
- **New run and Back are not run commands.** Each joins two screens that
  have no run. A kind in `RunCommand` would join the journal's kinds and the
  chaos census (115g's finding for Continue), and would touch `src/run`. They
  are functions in the scene context (`menu`), so the fuzz smoke does not
  fire, as the cut predicted.
- **A key typed in a text field was the registry's.** `handleKeyDown` took
  any bound key with a live handler and called `preventDefault`. The map
  key and the tooltip key have page-lifetime handlers, so M typed in a field
  was swallowed and sent to the sector map's toggle. The seed field keeps
  digits only, so nothing a player types there is lost today; after 116e a
  player can bind a digit to one of those two actions, and the field would
  then refuse that digit. A fifth key rule went in with the field: a keydown
  in a text field fires no hotkey.
- **The seed's grammar.** The URL dial takes any integer. The field keeps
  digits, 15 at most (every such number is an exact integer, and a seed
  drawn from the clock is 13 digits), cleaned as typed, so it has no
  refused state and needs no message that comes and goes. It is read through
  the dial's own parser.
- **The board explorer's `bp`** is named in a DEV-only module, which a
  shipped module can't import without bringing it into the bundle. The rule
  spells the name itself and a test holds the two equal.
- **The end screen's first button** has to say where it goes, and that
  differs by boot: `Main menu` on a page that booted to the menu, `Begin a
  new run` on a page booted by a dial.
- Every driver's URL was read again against the rule (the board fixtures,
  the probe runner's `--seed`, the recorder, `drive()`): each has
  `character=` or `bp=`.

**Built.**
- `src/scenes/menuRules.ts`: `bootsToMenu(search)` (no run dial that
  parses, and no `bp`), `cleanSeedText`, `seedFromText`.
- `src/ui/MenuScreen.ts` and `src/scenes/MenuScene.ts`: the name; the three
  notices; Continue when the slot is `saved`; New run; the seed field with
  its hint; the build's ID in the corner. Drawn once when shown.
- `Game`: `menuBoot`, fixed at the page's load; the first screen; `resetRun`
  to the menu on a menu boot and as before on a dial boot; the seed field's
  text held from New run to the run that takes it, layered over the URL's
  config the way the character is; `SceneContext.menu`.
- `CharacterSelectScreen`: Continue, the notices and the build's ID gone;
  Back under the cards, a pass (`btn--dim`), always there.
- `GameOverScreen`: the first button's label by the boot.
- `Keybindings`: `isTextEntry` and the rule.
- The focus ring's selector gains `input` (the hand-off left it to either
  step). The kit's scene table gains `MenuScene`.
- DESIGN: "Saving", the Buttons paragraph, the checklist's Menu row and the
  two rows it changes, the ring's selector, and a new paragraph, "Fields".
  ARCHITECTURE and `process/browser-pane.md` follow.
- Seven strings: `menu.title`, `menu.newRun`, `menu.seed.label`,
  `menu.seed.placeholder`, `menu.seed.hint`, `charselect.back`,
  `gameover.toMenu`.

**Changes inside the cut's intent, for the stop.**
1. **A seed is one run's.** The field is emptied when a run takes it and
   kept across Back. A seed that stayed would seed the next run without the
   player asking, and under spec D6 that run would count toward nothing.
2. **The seed field is the last row and the quietest,** in spec D6's order.
   The Settings row (116d) and the Credits row (116j) go between New run
   and it. The other place is directly under New run, whose parameter it is.
3. **The name is in its own casing,** `ASCIIbattler`, where every other
   heading is upper-cased.
4. **The notices sit between the name and the rows,** as they sat above the
   heading at 115g.
5. **Enter in the field is New run.**
6. **Back is on character select on every page,** a dial boot included
   (the signed reading: "character select keeps Back"). On a page booted by
   a dial with no character, that is now the only way to Continue or to the
   three notices, which left character select. Those pages are dev entries.
7. **The new boxes that hold text are sized in rem** (the rows' column, the
   notices' width), so 116k has nothing to move here.
8. **Nowhere shows a player a run's seed.** The exported journal holds it.
   Whether the end screen or the menu should show it is a question for the
   stop; nothing is built.

**Tests,** +10: `menuRules.test.ts` 9 (the boot rule over a hand-written
row per dial, with a census against `RUN_CONFIG_PARAMS` so a new dial fails
until it has its row; the drivers' URLs; the bookmark, and its name held
equal to the board explorer's; a dial that parses to nothing; the field's
cleaning and its seeds, against the URL parser's for the same digits),
`Keybindings.test.ts` 1 (five kinds of text entry fire nothing; seven other
targets, a slider among them, fire). Five plants, each failing its test by
name and then restored: the rule forgetting `bp`; the rule reading one dial
only; the field keeping letters; the text-field rule removed; a slider
counted as text entry.

**In the pane** (Chromium; the dev server, `5bc324a-dirty-dev`).
- **A bare URL** boots `MenuScene` with no run: New run, the field
  (`inputmode=numeric`, 15 at most, named by its label, described by its
  hint) and the build's ID; the four chips hidden.
- **The field:** `seed: 12 34m` typed with the pane's keyboard left `1234`.
  A synthetic M and `/` on the field were not prevented; the same two on
  the body were (the control), and an unbound key was not. The ring's
  computed outline on the focused field: solid 2px white.
- **The routes:** New run opens character select holding `1234`, with the
  three cards and Back and none of the 115g stand-ins; Back returns to the
  menu with `1234` in the field; New run and a card start a run whose dials,
  saved slot and journal start all read `seed=1234&character=soldier`, with
  the held text emptied and the chips shown. A synthetic Enter in the field
  opens character select.
- **The field's seed is the dial's:** that run's state hash at the map,
  `782654fc`, equals the hash of a page booted on
  `?seed=1234&character=soldier`.
- **A run with the field empty** has dials `character=priest`, no seed.
- **The four slot states, and a blocked store.** Empty: no Continue, no
  notice. Saved (after a reload): Continue first, then New run, then the
  field; a click brings the map at `782654fc` with the chips shown and the
  journal in its second segment. Rejected (the envelope planted at v46):
  no Continue, the rejected line, the text left in place. Another tab: no
  Continue and the other-tab line, while the first tab shows Continue and
  no notice. `?store=deny`: the menu, no Continue, the can't-save line.
- **A run's end.** The run driven to a defeat from a menu boot (13 battles):
  `Main menu` and `Export run`; the click brings the menu with no run, no
  Continue, the slot empty, the field empty, the chips hidden, and one
  finished journal kept. A won end screen on a menu boot, mounted by an
  emitted `run:victory`: the same two buttons, and the menu after.
- **Dial boots.** `?seed=1234&character=soldier`: the map, no menu.
  `?seed=7&hops=2`: character select with Back; Back reaches the menu; a run
  from there has dials `seed=7&hops=2&character=soldier`; played to a win
  (6 battles), its end screen reads `Begin a new run` and `Export run`, and
  the click brings character select. `?bp=yaw-30`: character select.
- **The production build** (`vite preview`, `5bc324a-dirty`, no kit): the
  menu, with New run, the field and the build's ID; New run opens character
  select with Back.

**Under Electron.** The seed-7 drive boots to the map: exit 0, `logHash
a59ee48f`, 12 battles. The build's first screen (no query) is `MenuScene`
with New run, the field and the build's ID. The recorder on a board fixture
(`--board=corridors --countdown=skip --max-seconds=6`): OK, 5.5 s, the clip
opens on the fight.

**Not verified.**
- Anything in Firefox: the Tab walk, Enter on a row, the ring on the field,
  how the name and the rows look natively.
- A win played to its end on a menu boot. The won end screen there came
  from an emitted event; the played win was on a dial boot.
- By ear: the click on a row was not heard.
- On the production build, only the first screen and New run were read.

**Cost.** The production bundle is 615.72 kB raw (612.71 at 116b), the
stylesheet 57.64 kB (56.50). `npm test`: 233 files, 3368 tests, 46.2 s.
Typecheck clean.

### 116d — the settings modal (2026-10-04) — read `stop`: ◐ built, the sitting unread (with 116c)

The reading at the step's start: **343,050** at 11:52, on 116c's commit
(`29bb04f`; 116c cost about 251k, orientation and both surfaces' reading
included).

**Step zero.**
- **A pause does not hold a fight behind a modal.** The hand-off's note
  was to pause the playback and resume only if the battle was found
  running. Read against `BattleScene.tick`: the pre-battle countdown runs
  on real time through a pause (the countdown is itself a pause with a
  timer), and when it expires it resumes the playback, so a modal opened
  during the countdown would have the fight start behind it. And `pause()`
  does nothing where the config disables pause. So the playback gets a
  hold of its own: `current` reads 0 while one is live, the countdown gets
  no time, and the player's pause is never touched, so there is nothing to
  remember and restore.
- **A key pressed in the modal reached the battle.** The registry's
  handlers are live through a modal: Space would toggle the pause under
  it, a digit would pick a speed and unpause, E and F would arm an order.
  The registry gains `suspend()`, which the modal holds while it is open.
  116e's key capture needs the same seam. The cache modal and the sector
  map are left as they were: Space still pauses under them.
- **The chip's place.** The column's rule is that no click target shifts
  (bits never moves, the cache chip never hides, the pool chip is
  display-only and last). A settings chip after the map and pool chips
  would move whenever either hides. Third, after the cache chip, it never
  moves while a run is live, and the map chip is fourth when present.
- **The starting speed set from outside the speed pane** left the pane's
  highlight on the old button, since the pane repainted only on its own
  clicks and keys. The playback tells a listener when the selected speed
  changes.
- **Quit to menu can't be `resetRun`,** which empties the slot. It is a
  closed tab by another route: the slot is left as it is.
- **The gear and the minus sign** (`⚙`, `−`) are inside the shipped
  subsets' blocks; `tests/font-coverage.test.ts` passed with both in the
  source, and no font was regenerated.

**Built.**
- `PlaybackSpeed`: `hold()` (counted; a release called twice releases
  once), `isHeld`, `onSelect(listener)`. `BattleScene.tick` gives the
  countdown no time and reads no skip signal while held.
- `Keybindings.suspend()`, the sixth key rule.
- `src/ui/SettingsOverlay.ts`: the chip (`⚙ settings`) and the modal, the
  96f panel. Three sections: Sound (Master volume, Sound effects), Battle
  (Starting speed, Aura effect), Comfort (Motion, Screen shake); during a
  run, Quit to menu with a line under it saying what becomes of the run.
  A level is − · a range input · + · a `%` readout of fixed width, in
  steps of 5; a choice is a group of toggles with the chosen one filled.
- `Game`: owns the overlay; `swap` shows the chip while a run is live and
  its end screen is not up; `quitToMenu()`; `menu.openSettings`. The three
  run chips gain `conceal()`, since no run-end event hides them on a quit.
- The menu's Settings row, after New run.
- DESIGN: "Saving" (Quit to menu), the Space rule's exception, the
  checklist (a row for the settings modal; the menu's and the chrome
  column's rows), Chips (the order), Modals (the hold), "Fields" (the
  settings row, the choice, the level), and the two sentences that named a
  Round 8 setting: the shake in "The live bar" and the override in
  "Reduced motion". ARCHITECTURE and `process/browser-pane.md` follow.
- 31 strings (`menu.settings` and thirty under `settings.`).

**Changes inside the cut's intent, for the stop.**
1. **The hold and the key suspension** (above), where the hand-off said a
   pause. The player's pause is as it was when the modal closes.
2. **The chip is third,** so the map chip is now fourth.
3. **The chosen toggle is filled green with black text,** not the HUD speed
   buttons' green border and glow: a border's hue alone would not survive
   the grey read.
4. **The click that lets a level be heard** plays when a slider's move ends
   (the `change` event) and on each press of − or +, not on every step of a
   drag.
5. **The starting speed row changes the speed of the fight behind it too,**
   which is what 116b's seam does. The HUD's buttons still don't write the
   setting.
6. **Quit to menu has no confirm.** With the run saved it loses nothing but
   a fight in progress, which restarts from its turn; with the run unsaved
   it ends it, and the line under the button says which.
7. **The rows' names and their lines** are the session's wording: Sound,
   Battle, Comfort; Waves and Motes for the aura; System, Reduced and Full;
   Yours, Theirs, Both and Off for the shake.
8. Carried from 116b for this stop: the master slider opens at 50 % (the
   default loudness is master 0.5), `NumpadEnter` is reserved with Enter,
   and Shift passes the modifier rule.

**Tests,** +5: `PlaybackSpeed.test.ts` 4 (a hold stops the sim and leaves
the pause as it was, running or paused; it works where pause is disabled;
holds count; the select listener hears both routes and nothing else),
`Keybindings.test.ts` 1 (suspended, no key fires and none is prevented;
suspensions count; the same key fires after). Four plants, each failing by
name and then restored: `current` ignoring the hold; a release that
unpauses; the listener never told; a suspended registry that fires.

**In the pane** (Chromium; the dev server, `29bb04f-dirty-dev`).
- **From the menu.** The Settings row opens the modal with the fallbacks
  shown (50 %, 100 %, 1×, Waves, System, Yours), no Quit row, focus inside,
  the hold and the suspension live.
- **Each row, live.** + twice on the master: 60 % and the player's
  `masterVolume` 0.6. A slider set to 33 with `input` and `change`: 35 %
  (the input's own step), and `sfxVolume` 0.35; − once: 0.3. The four
  choices: the playback's selected speed 2, the aura mode `fill`,
  `data-motion="reduced"`, the shake policy `none`; each row's one pressed
  toggle is the one clicked; the stored section holds all six.
- **The three ways out.** Esc, the ✕ and the backdrop each close it,
  release the hold and the suspension, and return focus to the Settings
  row; a click inside the panel does not close it.
- **Keys.** With the modal open, a synthetic Space and M on the body were
  not prevented and changed nothing; after it closed, M was prevented
  again (the control).
- **A reload** (a new `page` id): the six consumers hold the six values,
  and the modal shows them.
- **In a run.** The column on the map: bits, cache, settings, morale (the
  map chip hidden), the settings chip third, at 130 px. In a battle, from a
  screenshot: bits, cache, settings, map.
- **Over a counting-down battle.** The countdown at 4.5 s; with the modal
  open, three frames worth 3 s left it at 4.5; closed, one frame of 0.5 s
  took it to 4.0. Focus returned to the chip.
- **Over a running battle** (tick 20, 1×): two frames worth 1 s with the
  modal open left the tick at 20, held and not paused. The Starting speed
  row set to 3× there moved the HUD's highlight to 3×. Closed: 0.5 s took
  the tick to 50 (30 ticks, 3×). Paused, then opened and closed: still
  paused, the tick unchanged.
- **Quit to menu from that battle:** the menu with Continue, no run, the
  modal closed, the hold released, every chip hidden, the slot kept (its
  phase `turn-intro`). Continue: the pre-turn screen, the chips shown, the
  journal in its second segment.
- **A blocked store** (`?store=deny`): the line under Quit reads that the
  run can't be saved; a choice made there holds for the page; Quit brings
  the menu with no Continue.
- **The chip** shows on the map and is hidden on the end screen and on the
  menu.

**Under Electron,** one profile, two launches. The first changed six
settings through the modal (60 %, 95 %, 2×, Motes, Reduced, Off) and read
them back from the consumers; the second, a new process, found the modal
showing the same six and the consumers holding them, and the profile's
`store.json` holds the section. The seed-7 drive: exit 0, `logHash
a59ee48f`, 12 battles.

**Not verified.**
- Anything in Firefox: how the range input and its accent look there, the
  Tab walk through the modal, Space and Enter on a toggle, the ring.
- By ear: no level was heard, and neither was the click at a move's end.
- A real key press while the modal is open; the pane's were synthetic.
- How Waves and Motes look, and reduced motion's effect on a battle: both
  were read as state.
- The production build: the bundle was built and measured, not opened
  with the modal.
- The modal at a narrow width or with the text scaled.
- A second tab's Quit line (it takes the same branch as the blocked store:
  the slot is not `saved`).

**Cost.** The production bundle is 622.76 kB raw (615.72 at 116c), the
stylesheet 59.95 kB (57.64). `npm test`: 233 files, 3373 tests, 45.7 s.
Typecheck clean. No fuzz smoke at either step, as the cut predicted.

### The first sitting, prepared (2026-10-04) — the `stop` is open

The reading: **463,623** at 12:08, before 116d's commit (116d: about 120k).

**The read, in Firefox, on a plain URL** (the user's own dev server, after
a hard reload, or the production build).
1. The menu: the name, the rows, the seed field and its line, the build's
   ID. Tab through it; Enter on a row.
2. Type a seed, New run, Back: the seed is still there. New run, pick a
   character, play to a choice, reload: Continue is first, and it returns
   to the screen that was left.
3. Settings from the menu: move a volume and hear it; change a choice;
   reload and find both kept.
4. In a run, the settings chip (third in the column). Open it in a battle
   during the countdown, and again with the fight running: wrong is a
   battle that runs on behind the modal, or one that comes back paused
   when it was running. Press Space with the modal open: wrong is the
   fight pausing behind it.
5. Tab through the modal: wrong is a control the walk misses, or one it
   leaves the modal from.
6. Quit to menu from a fight, then Continue: the pre-turn screen of that
   fight.
7. Lose or win a run: the end screen's first button reads Main menu and
   goes there.

**The calls put to the user:** 116c's eight and 116d's eight, each under
"Changes inside the cut's intent".

**The next stretch** is 116e (the key rows), 116f (the palette's
mechanism) and 116g to its first stop (the candidate palette and its
table). From about 480k after this commit, with this phase's steps so far at
35k to 251k, it does not look likely to fit under the 550k line. The sitting's
findings and their `-post` fixes look likely to.

### The first sitting (2026-10-04, the user's) — 116c and 116d READ ✅, two findings and a question

In Firefox. The message's own time was not read; the session's first
command after it ran at 13:10. The verdict: "All of the points for me
to read pass." The reading on 116d's commit (`f466dbc`): **476,854** at
12:12.

**Finding 1: the seed's explanation on the menu reads as clutter.** The
user: it should exist, but as hover text on the word, not as a line on the
menu ("If we click on the word 'Seed,' just have the explanation pop up").
Built as 116c-post, below.

**The question beside it, open.** The lines under the settings rows could
go the same way, which would be one idiom for every explanation; the user
is of two minds ("those explanations being always visible might be more
appropriate there"). The session's lean, put to the user: keep them. Three
of the four say what the row's choices do (Yours and Theirs mean nothing
without "whose morale losses shake the view"), which is information a
player acts on, and DESIGN's tooltip rule keeps that off a tooltip alone.
The seed's line is not that kind: the placeholder already says what an
empty field does.

**Finding 2: the settings chip, third in the left column, interrupts the
game-state chips.** The user agrees it can't go last (it would move) and
finds first too prominent; their proposal is a second ribbon in the top
right, probably for it alone, and they are content for it to be a TODO.
Read after the report, the top-right corner at `f466dbc`: the battle's
speed pane (`.hud-speed-pane`), the roster button on the map, the pre-turn
screen and the recruit screen (`.card-list-button--roster`), and the port's
Leave (`.port-leave`). So five of a run's screens hold a control there, not
the battle alone; the reward, promotion, event and sector-cleared screens
are free. Filed in TODO "§116 riders" with the census.

**The user's other proposal: a sweep phase at the round's end** for this
and the TODOs like it. Not in ROADMAP until signed; the session's lean and
a shape for it were put to the user in the reply.

**The sixteen calls** of the two steps were not answered one by one. The
read exercised most of them and the user named what to change, so the
session takes the rest as standing. One was posed as a question and is
asked again: whether a run's seed should be shown to the player anywhere.

### 116c-post — the seed's explanation is the word's tooltip (2026-10-04) — ◐ built, unread

**Step zero.** Read against `tooltip.ts`: a mouse click on a text site does
not toggle a tooltip; hover opens it after 150 ms, so it is up by the time
a pointer clicks. A tap toggles it and keyboard focus opens it. The word
was inside the field's `<label>`, whose click also moves focus into the
field, and on a phone that raises the keyboard under the explanation the
tap asked for. So the word leaves the label.

**Built.** The line under the field is gone. The word Seed is a §97 text
site with its own tab stop and the explanation as its tooltip
(`attachTooltip`, the default `tap` route); the field takes its name from
the word (`aria-labelledby`). The word has a dotted underline and the help
cursor, which is new: no other text site marks itself, and here the
tooltip is the only place the explanation is, so the word says it has one.
DESIGN "Fields" and the checklist's Menu row, ARCHITECTURE and the
stylesheet follow. No string changed.

**Against the tooltip rule** ("never the sole channel for information the
player must act on"): the placeholder `random` says what an empty field
does, on the menu, always. The tooltip explains what a seed is.

**In the pane** (Chromium; the dev server, `f466dbc-dirty-dev`). The menu
has no hint line; the rows are New run, Settings and the seed row; the Tab
order is New run, Settings, Seed, the field. A mouse `pointerenter` on the
word opened the tooltip with the explanation (`aria-describedby` set, the
plate drawn above the word in a screenshot, its caret on the word); a
click on the word left focus where it was; `pointerleave` closed it. A
touch tap opened it and a second tap closed it.

**Not verified.** In Firefox: the hover, the underline's look, the Tab
stop's ring and the tooltip it opens. The plate covers part of the
Settings row while it is open, as a tooltip above its trigger does. A
screen reader no longer hears the explanation on the field itself, only on
the word.

**Cost.** `npm test`: 233 files, 3373 tests. Typecheck clean. The reading
before this commit: **516,808** at 13:12. The session hands off here: the
next step, 116e, starts in a fresh session.

### The sitting's answers (2026-10-04, the user's)

The reply to the session's thoughts; the reading on 116c-post's commit
(`d53ff9f`): **519,004** at 13:13.

- **116c-post, the underline:** "that underline is a really good
  addition". The session takes this as the step's read and ticks it; the
  user did not say what they tried.
- **The settings rows' explanation lines stay visible** ("We'll leave the
  settings explainers visible"). The reason given to the user: three of
  the four say what a row's choices do, which a player acts on, and the
  tooltip rule keeps that off a tooltip alone.
- **§117.5, the UI sweep, is signed** ("signing off on the 117.5
  charter"), and is in ROADMAP between §117 and §118. As put to the user:
  it sits before §118 so that the build for the public web channel is the
  swept one; it is cut at its own kickoff from TODO, the user picking; and
  it is layout and polish only. The risk the session named is that it
  becomes a bin, which the scope guard is there for. Its first item is the
  settings chip's home (TODO "§116 riders").
- **A run's seed is shown on the end screen** ("end run screen is a good
  place to show the seed"). Inserted as 116c-post2, unbuilt, for the next
  session. What step zero starts from, read today: `Run` keeps
  `streamRoot = seed >>> 0` and has no accessor for the seed
  (`Run.ts:1118`); `run:started` carries the seed as given, and so does
  the journal's seed start (`journal.ts:68`). A getter on `Run` is a
  change under `src/run`, so the fuzz smoke would fire; the journal's
  start, or a copy `Game` keeps beside `runDials`, is not. A run loaded
  from a dev snapshot has no seed start. `seed >>> 0` names the same run
  and is ten digits at most, where a seed drawn from the clock is
  thirteen, so it may be the better number to show. Unread: which of these
  a continued run's journal gives after several loads.

The session hands off here, under the line and without starting
116c-post2: its step zero has a question in it (where the seed comes
from), and a fresh session reads that with room. The reading before this
commit: **534,891** at 13:22.

### 116c-post2 — the end screen shows the run's seed (2026-10-06) — ◐ built, unread (`batch`, at 116g's stop)

A fresh session (c41fe9af, `claude-opus-5-5`); 85,855 after HANDOFF.

**Step zero: where the seed comes from.** The entry above listed three
sources and left one unread. A fourth settles it: `Run.streamRoot` is a
public field already (`readonly`, `Run.ts:789`), so the end screen reads
it from `ctx.run` with no change under `src/run`. The constructor uses its
`seed` argument twice, for `streamRoot = seed >>> 0` and for
`run:started`'s payload, and every stream derives from the root, so the
root names the run. It is in the snapshot, so a continued run and a run
loaded from a dev snapshot have it, where the seed as given is only in a
journal's seed start. That makes the unread question (what a continued
run's journal gives after several loads) one the screen never asks.

**The number shown is the root, not the seed as given.** For a seed from
the clock they differ: this session's pane run was created with
1791300883386, and its screen shows 299520954. Both name the same run. The
root is ten digits at most, and it is the one number every run has. What
this costs: the journal's start (and `npm run replay`'s first line) keeps
the seed as given, so a bug report that quotes the screen and a journal
file from the same run show two numbers. Not built: seeding a clock run
with `Date.now() >>> 0`, which would make them equal for every run whose
seed wasn't typed longer than ten digits; it changes what `createRun`
records, and nothing needs it yet.

**Built.** `seedShown(streamRoot)` in `src/scenes/menuRules.ts`, beside
the field's two rules; `GameOverScene` passes it to the screen. The line
is last on the screen, under the two buttons, in both variants: the word
Seed in the menu's grey with the menu's dotted underline, a tooltip text
site with its own tab stop (after Export run), and the number in the
colour and size the menu's field gives a typed seed, as selectable text.
The word is the menu's string (`menu.seed.label`). One new string, the
tooltip (`gameover.seedTip`): "This run's seed. Type it on the main menu
and pick the same character to get the same map and offers." No line when
the page holds no run.

**Calls made here, for the read.** (1) The root over the seed as given,
above. (2) The line's place: under the buttons, as the menu's seed row is
under its rows; the corner was the other candidate, where the menu keeps
the build's ID. (3) The number is plain selectable text (a double-click
takes it), not a copy button: a button is a new control and a clipboard
write, and the menu's build ID set the precedent. (4) The tooltip's
wording, and that it names the character: the same seed with another
character is another run.

**Headless** (`menuRules.test.ts`, +2): for six seeds (0, 7, both sides of
2^32, a clock seed, the field's longest), a Run built from
`seedFromText(seedShown(root))` has a snapshot equal to the original's,
and the text is ten digits or fewer and survives `cleanSeedText`
unchanged. The control: seeds 7 and 8 give unequal snapshots, so the
comparison can fail.

**In the pane** (Chromium, the dev server, `6b84d82-dirty-dev`), from the
menu: New run, The Priest, then `__probe.drive({ seed: 3 })` to a defeat.
The line read `Seed 299520954`; the journal's seed start, a surface the
screen doesn't read, held 1791300883386, whose `>>> 0` is 299520954. A
real double-click on the number selected exactly its nine digits. A
`pointerenter` on the word opened the tooltip with the string above, and
`pointerleave` closed it. Then Main menu, the number set into the field,
New run, The Priest: the new run's first snapshot was string-equal to the
first run's (5,781 characters), and its journal's start held
`seed=299520954&character=priest`. After a reload and Continue the run's
root was still 299520954. The check's saved run was removed from the
pane's storage afterwards.

**Not verified.** Firefox: the line's look under the buttons, the
underline, the focus ring on the word, the double-click. The victory
variant was not opened (one component draws both, and the line doesn't
branch on the variant). No narrow viewport was measured; the line is some
fifteen characters wide.

**Cost.** `npm test`: 233 files, 3375 tests (+2). Typecheck clean. The
reading before this commit: **176,663** at 11:37; the step cost about 91k
with orientation.

### 116e — the key rows (2026-10-06) — ◐ built, unread (`batch`, at 116g's stop)

The reading at the step's start: **182,468** at 11:39, on 116c-post2's
commit (`0b66611`).

**Step zero.**
- **What `pressable`'s deferred Space does once pause is on another key**
  (the Cursor's unread item): it presses the card. Read from
  `pressable.ts`: Space activates after the dispatch unless a hotkey
  prevented it, and with no action on Space nothing does. A native button
  does the same on its own. So the Space rule moves with the key, and
  DESIGN now says so. Enter stays every control's route, since it can't be
  bound.
- **A modifier on its own could be bound, and three of the four would be
  dead.** The registry's modifier rule returns on a keydown with Ctrl, Alt
  or Meta held, and each of those keys carries its own flag on its own
  keydown, so an action bound to `ControlLeft` could never fire. Shift
  passes the rule, so `ShiftLeft` would fire on every Shift+Tab and every
  `?`. Neither was reachable before a surface existed.
- **Escape has two listeners above a waiting row,** both on `window`: the
  tooltip's, in the capture phase, which takes Escape only while a tooltip
  is open, and the modal shell's, in the bubble phase, which closes the
  modal. A row that waits takes its keydown in the capture phase and stops
  it there, so Escape ends the wait and the modal stays.
- **The key that ends a wait is still down.** Whether Space presses a
  focused button on its release after its keydown was prevented differs
  by engine as far as this session recalls, and the pane can't show
  Firefox. The row guards three ways: the keydown is prevented, the same
  key's keyup is prevented, and a click with no click count
  (`detail === 0`, a key's) is ignored until that keyup.
- **The settings modal at 1280 by 720** holds 535 px of body. Eleven key
  rows in one column are about 430 px with their gaps, so the first and
  the last could not both be in view, and a swap could move a row the
  player can't see.
- **A code's name can be long:** `NumpadMultiply`. The HUD and the
  tooltips show `keyLabel(code)`, which passed such a code through whole.

**Built.**
- `Keybindings.ts`: `isBindable` (the reserved keys, a modifier or a lock
  on its own, an empty or `Unidentified` code), which `withRebind` now
  asks, so a stored modifier is left out too; `captureVerdict(keydown)`,
  the waiting row's rule, with five answers (`pass` a chord, `walk` Tab,
  `cancel` Enter and Escape, `swallow` a repeat or a key no action takes,
  `bind`); `overridesWith(action, code)`, what a rebind would store, with
  the registry unchanged; `keyLabel` puts a space between a long code's
  words (`Arrow Up`, `Numpad 1`).
- `SettingsOverlay.keySection`: a fourth section, Keys, last before Quit.
  A line of instruction; eleven rows, a name and a key button each, in two
  CSS columns that become one where the panel is narrow (Pause, the four
  speeds and the sector map down the first, the four orders and the
  tooltip key down the second, which is also the Tab order); a line that
  says what the last change did; and a row, All keys, with Reset to
  defaults. A bind stores the overrides as the `keys` setting and the rows
  repaint when the registry takes them back, the route a stored set takes
  at boot.
- The key button is 10rem wide whatever it shows, so no row moves. While
  it waits it is filled amber and reads "Press a key…".
- Eleven strings (`settings.section.keys` and ten under `settings.key.`).
  The rows' names reuse the HUD's and the map chip's words.
- DESIGN: the Space rule's sentence on a rebind, the settings modal's
  checklist row, and the KEY control in "Fields". ARCHITECTURE and
  `process/browser-pane.md` follow.

**Calls made here, for the read.**
1. **Two columns,** where every other settings row is one. The reason is
   the swap: both of its rows in view. The cost is a second row shape in
   the modal.
2. **The line that says what changed** ("Focus is on P now, and Pause
   moved to F."), under the rows so that a long line that wraps moves
   nothing just clicked. It is new; the signed call says only that the two
   swap. It is `aria-live`, so a screen reader hears the swap too.
3. **More keys are refused than the signed three:** a modifier or a lock
   on its own (step zero), beside Enter, Tab and Escape. A waiting row
   ignores them and goes on waiting, so Shift+/ still binds `/`.
4. **Enter cancels a wait, as Escape does,** and Tab cancels and walks on.
   A reserved key pressed at a waiting row could also have been ignored;
   cancelling means the keyboard is never held in a row.
5. **Function keys can be bound.** F5 bound to an action stops reloading
   the page during a battle, which is the player's choice to make and one
   click on Reset to undo.
6. **The names:** Keys; Pause (the row doesn't say it is also Fight now;
   the button carries its key); Speed 0.5× to 3×; Sector map; Engage,
   Focus, Hold, Stop; Show tooltip; All keys, Reset to defaults.
7. **Reset has no confirm** and resets the keys only.
8. **A long code shows as spaced words,** not as its face: `[` is
   "Bracket Left". `/` keeps its face from 97b.

**Headless** (`Keybindings.test.ts`, +9, expected values written by hand
from the rules' words): what can't be bound; a stored modifier left out;
the five verdicts; that a waiting row binds exactly the keys the swap
rule takes; what `overridesWith` returns for the read's two moves (Pause
to P stores `{togglePause: KeyP}`; then Focus to P stores Focus on P and
Pause on F) and that it changes nothing; the spaced names. Four plants,
each run and then restored by one script: a chord that binds, a bindable
modifier, a repeat that ends the wait, an `overridesWith` that mutates.
Each failed by name (1, 4, 1 and 1 tests).

**In the pane** (Chromium; the dev server, `0b66611-dirty-dev`). Every
bind below is a synthetic `keydown` carrying a `code`, dispatched on the
focused key button.
- *From the menu.* The section draws in two columns (313 and 646 px), six
  rows and five, each 31 px; the whole section is in view once scrolled
  to. At a 386 px panel it is one column of eleven with no sideways
  scroll.
- *The read's moves.* Pause, then P: the row reads P, the line "Pause is
  on P now.", the stored keys `{togglePause: KeyP}`. Focus, then P: Focus
  reads P and Pause F, the line "Focus is on P now, and Pause moved to
  F.", both stored.
- *A waiting row.* It reads "Press a key…" with `aria-label` "Pause:
  Press a key…". Ctrl+F was not prevented and the row went on waiting;
  Shift alone, a repeat and an empty code were swallowed. Escape ended the
  wait and the modal stayed open; a second Escape closed it. Enter ended
  the wait, and a keyboard click sent while Enter was still down started
  none. Tab ended it and was not prevented. A second click ended it. A
  `blur` event ended it.
- *Space.* Bound to Engage: a keyboard click before the keyup started no
  wait; one after it did.
- *Nothing moves.* Every key and the reset button kept its rectangle
  through a wait, a swap, a bind to `NumpadMultiply` and Reset. "Numpad
  Multiply" fits at 10rem; at the first 9rem it was cut with an ellipsis.
- *Reset:* the stored keys `{}`, every row at its default, the line
  "Every key is back to its default."
- *In a battle,* through the chip. Before: "▶ Fight now (Space)", the
  pause tooltip `[Space]`, the map chip's `[M]`, and Space toggled the
  pause. Pause to P and Sector map to N in the modal: Fight now read (P)
  while the modal was still open. After closing: the tooltips `[P]` and
  `[N]`; Space was not prevented and changed nothing; P was prevented and
  toggled the pause; Ctrl+P and Ctrl+F were not prevented; M opened no
  map; N opened it, with the hint "[ map view — N / Esc closes ]". That
  hint and the chip's tooltip were 116b's unverified item.
- *After a reload* the registry held `KeyP` and `KeyN` and the rows showed
  them. The check's stored settings and saved run were removed afterwards.

**A run is left alone.** The seed-7 drive: exit 0, `logHash a59ee48f`, 12
battles.

**Not verified.**
- A real key press. The pane's key tool sends an empty `code`, which a
  waiting row swallows, so no bind here came from a keyboard.
- Firefox, all of it: the two columns (CSS `columns` with `break-inside`),
  the Tab walk through twelve new stops, the amber fill, and what Space
  does on its release after it has been bound.
- A lost focus. The pane's document has no focus, so `focus()` on another
  element fired no `blur`; the event was dispatched by hand.
- A keyboard that isn't QWERTY. A `code` names the physical key by its US
  label, so on AZERTY the key marked A shows as Q, here and on the HUD
  (TODO "§116 riders").
- The production build and Electron were not opened with the rows.

**Cost.** The production bundle is 626.88 kB raw (622.76 at 116d), the
stylesheet 60.99 kB (59.95), both steps of this session together. `npm
test`: 233 files, 3384 tests (+9). Typecheck clean. The reading before
this commit: **320,719** at 11:55; the step cost about 138k.

### 116f — the palette's mechanism (2026-10-06) — read `none` ✅

The reading at the step's start: **337,160** at 11:58, on 116e's commit
(`d7cabc8`).

**Step zero.**
- **Six modules bake a colour as they load** (a search for `COLORS.` at
  module scope): `statusDisplay.ts` and `fxRegistry.ts` (tables),
  `TerrainRenderer.ts` (the theme table), `BattleRenderer.ts` (two
  constants), `PostProcess.ts` (one), and the HP gradient in
  `UnitOverlayLayer.ts`. So a palette can only be chosen before they are
  evaluated, which is what the cut's "at boot" and 116g's "applies on
  reload" already said.
- **`COLORS` had one type use** (`PaletteName`), and nothing read a
  value's literal type, so it could become a table chosen at run time.
- **The sheet's shades keep their token names.** The seven role tokens
  that are a palette hue lighter or dimmer (`--color-amber-hover`,
  `-amber-dim`, `-amber-faint`, `-green-dim`, `-blue-dim`, `-blue-rule`,
  `-boss-red`) are the kebab of the names they get on the palette, so the
  sheet's body does not change by a byte. The other fifteen role tokens
  are neutral (black, white, the greys, the two status-text greys) or a
  hue of their own that no identity rides on (the miss white and its
  glow), and stay off the palette.
- **The status hues are drawn from JS only,** so their ten new tokens in
  the sheet have no reader there. The token pin's first rule is that every
  palette name has its token, and its header already exempts palette
  tokens from the referenced rule ("used or not"), so they are added for
  the mirror.
- **`new THREE.Color(0x33ff00)` and `new THREE.Color('#33FF00')` are the
  same colour:** the base table's two spellings of the three gradient
  stops are equal to the last digit.

**Built.**
- `src/render/palette.ts`: the default palette, thirty names (the 96a
  thirteen, the seven shades with the sheet's hexes, the ten status and
  empower hues with `statusDisplay.ts`'s); `COLORS` as a live binding;
  `choosePalette(name)`, which re-points it and gives the default for a
  name this build has no palette for; `paletteToken`; `tokenOverrides`,
  the tokens whose hex is not the default's. The module imports nothing.
- `statusDisplay.ts`'s ten hexes and the gradient's three numbers are
  palette names. The magenta fallback stays a literal: it is a defect's
  colour, the same in every palette.
- The boot: `applyAtBoot` hands the stored `palette` to a `setPalette`
  seam, and `boot.ts`'s seam chooses it and sets the overrides on the root
  element. For the default palette there are none, so the root element
  gets no inline style and the sheet's values stand.
- The sheet: ten tokens added in `:root`, black and white moved below the
  palette's block, the comment rewritten. Nothing below `:root` changed.
- `hpFillColor` is exported for its pin.

**The oracle** (`process/oracles.md`): a reader and a comparison, in the
session's scratch directory. The reader imports a checkout's own
`palette.ts`, `statusDisplay.ts` and `fxRegistry.ts` under `tsx` and
parses its `ui.css`, and writes one table: every `COLORS` entry; each
status's and each buff's colour, read from the table and through its
function; the fallback three ways; every plain value `fxRegistry` exports
(8 hexes among them); the gradient's stops as `THREE.Color` channels from
the numbers and from the palette; every `--color-*` token; a hash of the
sheet below `:root`. The base was read from `d7cabc8` in a detached
worktree with a `node_modules` junction, before any edit.
- *Self-check:* the base against the live tree at the same commit, PASS.
- *The result:* PASS. 13 colours kept and 17 added; 35 tokens kept and 10
  added; the status, empower and fx tables, the gradient and the sheet's
  body equal. Each added palette name agrees with its token, and each of
  the seven moved shades with the token the base had.
- *The failing controls,* nine, each planted in the working tree, read,
  and restored by one script that hashes the files before and after: a
  status hue off by one; an identity hue off by one; a moved shade off by
  one; a status on the wrong name; a buff on the wrong name; a sheet token
  off by one; a declaration changed below `:root`; two gradient stops
  swapped; a gradient stop on a neighbouring name. The first seven fail
  the comparison, each on the line that names the plant.
- **The gradient is outside the reader,** which can't call a function the
  module doesn't export, so it has a pin of its own
  (`UnitOverlayLayer.test.ts`): the expected fills are worked from the
  base's three numbers with the sRGB transfer function written out in the
  test, not through the palette or three.js. Its first form missed the
  ninth plant: `#ff3030` for `#FF3131` prints the same fill at the
  fractions it tried, since 0x30 and 0x31 both round to 8 in working
  space. It now holds every thousandth of the range, and catches both
  gradient plants. 9 of 9, the files restored.

**Standing tests,** +14 (two new files): `palette.test.ts` 8 (the default
with no choice and for an unknown name; a planted palette read through the
binding by this module and by `spriteColor`; a module loaded after the
choice builds its table from it, and one loaded before keeps what it read,
which is the reason for the boot's order; the token of a name; no override
for the default; exactly the changed tokens for another palette);
`UnitOverlayLayer.test.ts` 4; `settings.test.ts` +1 (the stored name
reaches the seam); `tests/settings-boot.test.ts` +1 (the boot's graph
reaches `palette.ts`, no other render module, and `palette.ts` imports
nothing; the exact set gains the one file).

**In the pane** (Chromium; the dev server, `d7cabc8-dirty-dev`). The menu
boots with no `style` attribute on the root element, the tokens as the
sheet spells them and the title `rgb(51, 255, 0)`. One override pair made
by `tokenOverrides` for a palette with a blue `TERMINAL_GREEN`, set on the
root element the way the boot sets one, turned the title `rgb(0, 0,
255)`; removed, it was green again. With `colourblind` stored, which this
build has no palette for, a reload booted the menu with the default
colours and no inline style. The check's stored settings were removed.

**A run is left alone.** The seed-7 drive under Electron: exit 0, `logHash
a59ee48f`, 12 battles.

**Not verified.**
- A second palette through the real boot. There is none until 116g, so
  the boot's own call has only ever chosen the default; the choice, the
  load order and the overrides are each held by a test with a planted
  palette, and the cascade by the pane's one pair.
- The production bundle with a palette chosen. The mechanism rests on
  modules being evaluated in import order there, as the locale's does
  (116a's Electron check).
- The terrain's 21 theme and tile hexes are not on the palette, as the cut
  has it. The oracle did not read them; their file is unchanged.

**Cost.** The production bundle is 627.68 kB raw (626.88 at 116e), the
stylesheet 61.27 kB (60.99). `npm test`: 235 files, 3398 tests (+14).
Typecheck clean. The reading before this commit: **424,179** at 12:12;
the step cost about 87k.

### 116g — the colourblind palette: the instrument and the candidate (2026-10-06) — the first `stop` is open

The reading at the step's start: **438,226** at 12:15, on 116f's commit
(`48fc44b`).

**Built: the instrument** (`tests/colourVision.ts`, test support; nothing
in `src` imports it). A dichromat's view of a colour is a 3×3 matrix on
its linear sRGB, clamped to the screen's range. Two published models are
held, so a verdict doesn't rest on one: Machado, Oliveira and Fernandes
2009 at severity 1.0 for protan, deutan and tritan, and Viénot, Brettel
and Mollon 1999 for protan and deutan. The distance between two colours is
the Euclidean distance in Oklab, where about 0.02 is a just-noticeable
difference between patches side by side. The matrices and Oklab's
coefficients were written from memory, which is why the known answers
below come first.

**Its known answers** (`tests/colourVision.test.ts`, 10 tests, on every
`npm test`): Oklab's published values for the three primaries and white;
a hex through linear and back; every matrix's rows sum to one, so a grey
stays that grey; a Viénot result has equal red and green; the two models
agree on each of the default's ten pairs to within 0.04 (the widest
measured gap is 0.033); the pairs a red-green deficiency merges come out
merged, and the same pairs are far apart to normal vision; pure green and
pure yellow nearly vanish for a protanope; Okabe and Ito's blue with their
orange and their yellow stay apart in every view. Five plants, each run
and restored by one script: a digit wrong in a matrix, two views swapped,
the simulation applied to encoded values, an Oklab coefficient wrong, no
simulation at all. Each failed by name.

**Step zero changed a premise.** The cut's known answer for a failing case
was "the default green and red must fail under protan and deutan". They
don't. The green is much the lighter of the two and lightness survives:
the pair is 0.41 apart to a protanope and 0.21 to a deuteranope, on both
models. What the default palette does lose is three other pairs, each
differing by its red-to-green balance and little else:

| pair | normal | protan | deutan | tritan |
|---|---|---|---|---|
| yours / enemy | 0.497 | 0.412 | 0.212 | 0.473 |
| yours / camp | 0.273 | 0.152 | **0.050** | 0.287 |
| yours / stone | 0.428 | 0.410 | 0.354 | 0.368 |
| yours / cracked | 0.348 | 0.311 | 0.227 | 0.335 |
| enemy / camp | 0.245 | 0.260 | 0.163 | 0.208 |
| enemy / stone | 0.243 | **0.069** | 0.157 | 0.247 |
| enemy / cracked | 0.183 | 0.101 | **0.024** | 0.159 |
| camp / stone | 0.302 | 0.264 | 0.308 | 0.258 |
| camp / cracked | 0.176 | 0.159 | 0.178 | 0.140 |
| stone / cracked | 0.130 | 0.111 | 0.135 | 0.126 |
| **closest** | 0.130 | 0.069 | 0.024 | 0.126 |

(The five identity hues of call 5: yours `#33FF00`, the enemy's `#FF3131`,
a camp's `#FFB000`, stone `#7A7066`, cracked stone `#B5843C`. A protan or
deutan cell is the lower of the two models.) So the instrument's failing
cases are those three pairs, and the green-and-red pin holds what was
measured. This is inside the cut's intent (an instrument that rejects a
known bad case and passes a known good one) and is put to the user at the
stop.

**The bar proposed: 0.130.** It is the default palette's own closest
identity pair to normal vision (stone against cracked stone), so the gate
reads: under each simulation no two identity hues are closer than the two
closest already are for a player with normal vision. It needs no number
from outside the game. For scale, Okabe and Ito's eight have a closest
pair of 0.076 to 0.096 under the simulations on this measure, so 0.130 is
stricter than a published eight-colour palette manages; five colours have
more room.

**The search** (a scratch script; per identity the default plus sweeps in
OKLCH around it; 12.2 million combinations reached the inner loop at this
bar). At 0.130 over protan and deutan, both models:
- moving one or two names: nothing passes;
- moving three: 3,920 pass, counted by which names move. Every one moves
  yours and the enemy; the third is stone in 3,704 and cracked stone in
  216. The camp's amber, which is the UI's chrome colour, stays in all;
- at a bar of 0.10 two names are enough: 1,562 pass, 1,274 of them moving
  yours and the enemy alone and 288 the enemy and the camp. The third
  move at 0.130 is forced by one pair, stone against cracked stone, which
  is 0.111 for a protanope as the default has it;
- at 0.16 nothing passes with three names and it takes four.

**The candidate** (the least total move among the three-name palettes
that also hold tritan to 0.130; a finer sweep, 49,443 passing):

| name | default | candidate | what it is |
|---|---|---|---|
| `TERMINAL_GREEN` (yours) | `#33FF00` | `#46FBAE` | a mint: the same lightness (0.88 for 0.87), chroma 0.18 for 0.29, the hue 18° toward cyan |
| `NEON_RED` (the enemy) | `#FF3131` | `#F942B2` | a hot pink: a little lighter (0.68 for 0.65), the same chroma, the hue 39° toward magenta |
| `TERMINAL_STONE` | `#7A7066` | `#71675D` | the same grey, a step darker (0.52 for 0.55) |
| `TERMINAL_AMBER` (a camp) | `#FFB000` | unchanged | |
| `CRACKED_STONE` | `#B5843C` | unchanged | |

| pair | normal | protan | deutan | tritan |
|---|---|---|---|---|
| yours / enemy | 0.464 | 0.389 | 0.208 | 0.446 |
| yours / camp | 0.244 | 0.179 | 0.131 | 0.290 |
| yours / stone | 0.404 | 0.420 | 0.359 | 0.405 |
| yours / cracked | 0.308 | 0.312 | 0.231 | 0.343 |
| enemy / camp | 0.319 | 0.314 | 0.242 | 0.172 |
| enemy / stone | 0.286 | 0.133 | 0.173 | 0.255 |
| enemy / cracked | 0.258 | 0.202 | 0.139 | 0.139 |
| camp / stone | 0.329 | 0.290 | 0.335 | 0.287 |
| camp / cracked | 0.176 | 0.159 | 0.178 | 0.140 |
| stone / cracked | 0.155 | 0.134 | 0.160 | 0.152 |
| **closest** | 0.155 | 0.133 | 0.131 | 0.139 |

It passes all three deficiencies, so tritan can be gated with the other
two at no cost (call 5's condition). Its margin over the bar is thin
(0.001 to 0.009), because the least move sits on the boundary; the widest
three-name palette found reaches 0.140, with a darker magenta and a darker
stone.

**What the moved hues come near** (not gated; call 5 has the status and
empower hues re-picked and reported):
- the mint against `FLOURESCENT_BLUE` (`#15f4ee`: the map's frontier, the
  frozen tint, the heal sparkle): 0.094 to normal vision and **0.015**
  under the closest simulation. A frozen unit's tint would read as the
  player's own hue, where the ground mark's shape is the tell;
- the mint against `REGEN_GREEN` 0.079 and `MARCH_GREEN` 0.100 (the
  default green is 0.112 and 0.117 from them);
- the pink against `PARTY_PINK` (hyped) 0.100, against `BLOOD_CRIMSON`
  0.177, against `NEON_PURPLE` 0.240.
- The ten status hues as they are today have fourteen pairs under 0.10 in
  some view, the worst poison against panic at 0.003 for a protanope.

**A page of swatches** for the eye: `scratch/116g-palette-candidate.html`
(untracked), the default and the candidate, each hue as it is and as the
three simulations make it, written from the instrument by a scratch
script. It shows hue and lightness on black, not the game's bloom.

**Not built, by the cut:** the candidate is not in `PALETTES`, and there
is no gate test for it, no pip symbol and no Palette row. They follow the
user's read of this table.

**For the stop, the calls.**
1. The premise: green and red don't fail; the three merging pairs do.
2. The bar: 0.130, the default's own closest pair.
3. Tritan gated with protan and deutan, since the candidate passes it.
4. The candidate's three hues, or the direction to search instead (a
   wider margin, a greener green, another hue for the enemy).
5. For the stretch after: `FLOURESCENT_BLUE` re-picked away from the mint
   in this palette, with the status and empower hues, reported and not
   gated; the dark and dim shades of the moved hues follow them
   (`DARK_TERMINAL_GREEN`, `GREEN_DIM`, `DARK_NEON_RED`, `BOSS_RED`).

**Not verified.**
- Nothing here was seen by an eye, colour-deficient or not. The numbers
  are two models of a full dichromat and one distance measure.
- Machado's tritan matrix is the weaker part of that model; no second
  tritan model is held.
- An anomalous trichromat sees between normal and the simulation. No
  severity between was measured.
- The search's sweeps are grids (2° of hue, 0.02 of lightness and chroma
  in the finer one), so a palette between grid points was not tried.

**Cost.** `npm test`: 236 files, 3408 tests (+10). Typecheck clean. The
reading before this commit: **487,299** at 12:25 (the meter, before the
write-up). The stretch this stop opens (the candidate wired, its gate,
the re-picks, the pip symbols, the Palette row, the pane) does not look
likely to fit under the 550k line from here.

### The first stop's answers (2026-10-06, the user's) — 116g's five calls SIGNED; 116c-post2 and 116e READ ✅

The reply to the stop. The message's own time was not read; the meter
read **521,520** at 13:02, after it. The reading on the stop's commit
(`067222d`): **517,742** at 12:31.

- **The five calls of 116g's first stop: all signed** ("Signing all of the
  calls!"). As they were put:
  1. the instrument's failing cases are the three pairs that merge (yours
     with the camp, the enemy with cracked stone, the enemy with stone),
     not green against red;
  2. the bar is 0.130, the default palette's own closest identity pair to
     normal vision;
  3. tritan is gated with protan and deutan;
  4. the candidate's three hues: `TERMINAL_GREEN` `#46FBAE`, `NEON_RED`
     `#F942B2`, `TERMINAL_STONE` `#71675D`, with amber and cracked stone
     as they are;
  5. the re-picks are the next stretch's, reported and not gated:
     `FLOURESCENT_BLUE` away from the mint, the status and empower hues,
     and the moved hues' dark and dim shades.
- **What the user saw in the swatches:** "Our original palette was
  aggressively colorblind-hostile! Player and camp look almost
  identical!" That is the default's yours-with-camp pair, 0.050 for a
  deuteranope, read by eye from the simulated column of
  `scratch/116g-palette-candidate.html`. It is the first eye on any of
  these numbers, and it agrees with the one it looked at. It is a reading
  of the simulated column, which is not the same evidence as a
  colour-deficient player's report; none has been asked.
- **Both `batch` reads confirmed** ("confirming both reads"): 116c-post2
  (the seed on the end screen) and 116e (the key rows). The user did not
  say what they tried; the scripts given were the ROADMAP's. The session
  takes both as read and ticks them. 116e's read is the first time a key
  row met a real keyboard, if the script was followed; the pane's binds
  were all synthetic.

The session hands off here, under the line. The next stretch starts in a
fresh session from the Cursor: the palette wired as `colourblind`, its
gate on every `npm test` at 0.130 over all five views, the re-picks, a
symbol per status on the camp unit's pip, the Palette row, and the second
stop.

### 116g — the second stretch: step zero, and the status symbols (2026-10-06, session 86c3ac73) — built, the second `stop` not yet reached

A fresh session. Readings: **90,978** at 13:57, after HANDOFF and the
tool's load; **391,076** at 14:47, before this entry's commit.

**Step zero.**
- **The signed candidate's table, re-counted** from the instrument by a
  new scratch script (the first stretch's is gone with its directory): the
  ten pairs give the same closest values, 0.133 protan, 0.131 deutan and
  0.139 tritan, and 0.155 to normal vision.
- **The canvas does not draw a low-saturation hex as written.** The main
  composer's first pass (`palette-sat-clamped.frag.glsl`, `uSatMin` 0.4)
  raises any fragment's HSV saturation to 0.4, on linear values. Of the
  five identity hues only stone is under it: `#7A7066` is drawn `#7a6d60`,
  and the candidate's `#71675D` would be drawn `#716559`. Checked two
  ways: a model of the clamp in a scratch script, and the pixels. In the
  pane (Chromium, the quarry fixture, the terrain hidden so a crop holds
  only a glyph and the clear colour, the bloom mesh hidden) the commonest
  ink colour was `#7a6d60` for rubble, and `#b5843c`, `#ffb000`, `#33ff00`
  and `#ff3131` for a breakable wall, a camp unit, yours and the enemy's:
  the model's prediction for stone and the hex for the other four. With
  the bloom on, the cores read `#7b6d60`, `#ffbd00` to `#ffbf00`,
  `#37ff00` and `#ff3636`, so the halo moves a core by a few steps.
- **The candidate passes as drawn too:** with stone clamped, the closest
  pair over the five simulated views is 0.1312 (yours with the camp, for a
  deuteranope, a pair the clamp does not touch); the stone's own pairs
  rise a little (0.137 to 0.140 where the hexes give 0.133 to 0.135). So
  the signed hexes stand, and the gate measures both forms.
- **One terrain hex is a copy of a palette hue:** the healing tile's high
  colour is `#15f4ee`, the cyan, written as a literal, so a palette that
  moves the cyan would leave it behind. It becomes the palette's name in
  the palette's commit. The other twenty terrain hexes are their own.
- **The pip is 10 by 4 pixels,** too small to hold a glyph, and a status
  is drawn on every unit's pip, not a camp unit's alone. So the symbol is
  a new line over the bar, on every pip (below).
- **Every candidate symbol is already shipped:** the subset is cut by
  range, and each glyph tried is in a range and in a face's table
  (`tools/font/ttfCmap`, read by a scratch script with a known answer on
  each side). No font regeneration.

**Built: a symbol per status.**
- `statusDisplay.ts`: each status's row gains `symbol`, one character:
  `~` burn, `‡` bleed, `☠` poison, `+` rejuvenate, `*` frozen, `!` panic,
  `⊘` blind, `?` confusion, `↑` emboldened, `»` inspired. The first four
  are the glyphs a number already wore (98d). `statusSymbol(id)`, and `¤`
  for a status with no row. `EmpowerDisplay` no longer extends the status
  row's type, since a buff has no symbol: it wears the one `▲` and its
  label.
- `fxRegistry.ts`: a DoT number's prefix is read from that table, so the
  number, the pip and the card show one shape. The heal number's `+` stays
  its own literal: a healer's heal wears it too.
- The board pip (`UnitOverlayLayer.ts`, `ui.css`): the symbol's line in
  the status's hue, then the depleting bar, on one dark plate. 12 by 14
  pixels where it was 12 by 6, four to a row as before.
- The card's status row (`UnitCard.ts`): the first cell is the symbol in
  the status's hue where it was a plain square of it.

**The calls in it, for the stop.**
1. *Every pip, not a camp unit's alone.* The cut says the camp unit's
   pip. A symbol only there would never be seen beside its name, so it
   could not be learned; on every pip, a player meets it on a carded unit
   first. The other shape is one CSS rule (hide the symbol's line unless
   the overlay is a neutral's).
2. *The card's square became the symbol.* It is where a symbol sits next
   to its name. The cost: a glyph's strokes carry less of the hue than a
   6 by 6 square did.
3. *The six new glyphs,* chosen from a rendering of the candidates at 9
   and 10 pixels: `❄` is a blob at that size and `*` is not; `×`, `+`, `*`
   and `‡` are four crosses, so blind is `⊘`.

**Verified.**
- `statusDisplay.test.ts` +3: every shipped status has one character of
  its own, not the fallback and no two alike; a status outside the table
  wears the fallback; a DoT's prefix is its status's symbol, and the four
  numbers read `~7`, `‡7`, `☠7` and `+7` as literals. Two plants, each run
  and restored (the file's hash equal before and after): frozen given
  rejuvenate's `+` failed the first by name, and burn given `^` failed the
  third.
- The font inventory pin (`tests/font-coverage.test.ts`) passes with the
  three new non-ASCII glyphs in the tree.
- In the pane (Chromium, `786aa9e-dirty-dev`): ten statuses planted on a
  camp unit's strip gave ten pips with the ten symbols, each in its hue; a
  pip measured 12 by 14, its symbol's box 10 by 9, its track 10 by 3, and
  ten pips made three rows over the HP bar. In a driven fight with a
  roster of status appliers (seed 7, the quarry), by tick 157 the pips
  read `»`, `‡`, `?` and `~` for inspired, bleed, confusion and burn, and
  the cards' rows showed the symbol, the name and the numbers; a row was
  64 by 22.1 pixels with the square and with the symbol.

**Not verified.**
- No eye has seen a pip at its real size. The pane's screenshot is scaled
  down, and the magnified view I read was text drawn again at seven times
  the size, not the pip's pixels.
- Nothing in Firefox.
- A frozen, panicked or blinded unit in a real fight; the fight reached
  four statuses of the ten. The other six were seen only planted.
- Whether ten pips over one unit crowd its neighbours: three rows are 46
  pixels tall.

**A dev-server trap.** After two edits to `ui.css` in quick succession the
server went on serving the sheet as it was between them, across a
navigation; a `touch` of the file fixed it. The page's rules, read from
`document.styleSheets`, are what showed it.

### 116g — the second stretch: the palette wired, its gate, the re-picks, the Palette row (2026-10-06, session 86c3ac73) — ◐ built, the second `stop` is open

The reading on the symbols' commit (`d24c6f5`): **394,390** at 14:49.
Before this commit: **450,772** at 14:57.

**Built.**
- `palette.ts`: `PALETTES` holds `colourblind`, the default with eighteen
  names moved, and is exported for the gate. `chosenPalette()` is the name
  the page is drawn in.
- `tests/palette-colourblind.test.ts`, 11 tests on every `npm test`: the
  gate, its control, and the pins below.
- `TerrainRenderer.ts`: the healing tile's high colour reads the palette's
  cyan (step zero's finding; the default's value is the same hex).
- `SettingsOverlay.ts`: Settings › Comfort gains Palette (Default,
  Colorblind) and Apply palette (Reload now, and a line that says whether
  a reload is waited on and what it costs a run in progress).

**The gate, as built.** The five hexes are read through
`spriteColorForUnit` with the palette chosen, for a unit of each kind, so
the gate follows the sprite's rule and not a list of names. Every pair,
in normal vision and the five simulated views, must be 0.130 apart, as a
hex and as drawn (`asDrawn`: the saturation floor, its value read from
`PostProcess.ts`). Normal vision is gated too, which the signed call did
not ask for; the palette gives 0.155 there. The closest pairs:

| | normal | protan | deutan | tritan |
|---|---|---|---|---|
| as hexes | 0.155 | 0.133 | 0.131 | 0.139 |
| as drawn (the model) | 0.157 | 0.137 | 0.131 | 0.139 |
| sampled in the pane, bloom off | 0.157 | 0.137 | 0.131 | 0.139 |
| sampled in the pane, bloom on | 0.156 | 0.137 | 0.140 | 0.133 |
| the default palette, sampled, bloom on | 0.132 | 0.053 | 0.023 | 0.127 |

(A protan or deutan cell is the lower of the two models.)
- *The control, in the test:* the default palette through the same check
  fails on exactly four pairs (the enemy with cracked stone, the enemy
  with stone, stone with cracked stone, yours with the camp) and on none
  to normal vision; its worst are 0.024 and 0.050. The first stop named
  three merging pairs; the fourth, stone with cracked stone at 0.111 for a
  protanope, is the one it gave as the reason the third name had to move.
- *Five plants,* each made, run and restored by one script that compares
  the file's hash before and after: the mint put back to the default
  green (fails, yours with the camp 0.050); the stone put back (fails,
  five cells); the pink moved one hex digit, `#E942B2` (fails, 0.126 for
  a tritanope, so the margin is one digit wide); the canvas floor set to
  0.9 (the floor's own pin fails; the drawn gate still passes); the
  sprite rule giving a camp the enemy's hue (fails, five tests).
- *Pins beside it:* the bar is the default's closest pair to normal
  vision, within 0.001; the setting's choices are the palettes' names;
  every palette spells all thirty names as hexes; the colourblind palette
  moves eighteen and leaves amber and cracked stone.

**The re-picks** (signed as reported, not gated). The distance of a pair
below is its least over normal vision and the five simulated views.
- *The cyan,* by a grid (hue 185° to 262°, lightness 0.60 to 0.93, chroma
  0.14 to 0.20: 30,888 points, 2,744 on the screen) for the least move
  that stays a given distance from the mint, amber, the pink, the blue,
  the purple and the two stones: `#0CC7F3` at 0.10 (lightness 0.77 for
  0.875, hue 222° for 192°), 0.101 from the mint. 0.12 is out of reach
  with the chroma held: the widest point is 0.118, against the pink for a
  deuteranope. Without the chroma floor the least move at the same bar
  was a duller teal, `#60d1c3`, which I did not take: it separates by
  being dimmer, and the cyan is the UI's second colour (69 uses in the
  sheet).
- *The status and empower hues,* by a search: each hue kept within 15° of
  hue and 0.12 of lightness of its default, at 85% of its chroma or more
  and no darker than 0.5; every pair of status hues and every pair of
  empower hues 0.070 apart in each simulated view; and in normal vision
  each pair keeps the lesser of its default distance and 0.12, so a
  dichromat's separation is not bought with a trichromat's. Annealing from
  ten seeds, 50,000 steps each, then each hue pulled back toward its
  default for as long as no pair fell under its bar. One seed of the ten
  cleared the bar, so this is the least move the search found, not a
  proven least. Three hues ended where they began (bleed, emboldened,
  overclocked). A bar of 0.08 found no palette inside these windows in
  the eight seeds tried.
- *The hyped pink* by its own grid afterwards: the search held it from the
  other empower hues but left it 0.040 from the enemy's pink; `#FE8ACF` is
  0.096 from that and 0.073 from the empower hues.
- *The shades* by rule: a shade keeps its lightness, its chroma is scaled
  as its hue's was, and its hue turns by as much as its hue's did.

| name | default | colourblind |
|---|---|---|
| `TERMINAL_GREEN`, `NEON_RED`, `TERMINAL_STONE` | `#33FF00` `#FF3131` `#7A7066` | `#46FBAE` `#F942B2` `#71675D` (signed) |
| `DARK_TERMINAL_GREEN`, `GREEN_DIM` | `#0A3300` `#1a4d00` | `#0A311F` `#184B30` |
| `DARK_NEON_RED`, `BOSS_RED` | `#990000` `#ff3030` | `#8F035D` `#ED33A7` |
| `FLOURESCENT_BLUE` | `#15f4ee` | `#0CC7F3` |
| `DARK_FLOURESCENT_BLUE`, `BLUE_DIM`, `BLUE_RULE` | `#034947` `#0a6a66` `#0e4f4c` | `#124655` `#1E6679` `#194C5A` |
| `EMBER_ORANGE` (burn) | `#FF6A00` | `#FD6F55` |
| `TOXIC_GREEN` (poison) | `#8FC31F` | `#50A725` |
| `REGEN_GREEN` (rejuvenate) | `#2BE57A` | `#06EFA5` |
| `MARCH_GREEN` (inspired) | `#B4FF6E` | `#B7FF8A` |
| `AEGIS_LAVENDER` (warded) | `#C9D1FF` | `#CED5FE` |
| `PARTY_PINK` (hyped) | `#FF7AD9` | `#FE8ACF` |
| `SHIELD_STEEL` (shielded) | `#6FA8FF` | `#6A9DFE` |

| set | pairs | closest, default | closest, colourblind | under 0.10, default | under 0.10, colourblind |
|---|---|---|---|---|---|
| the ten status hues | 45 | 0.003 | 0.070 | 14 | 9 |
| the five empower hues | 10 | 0.024 | 0.070 | 3 | 6 |
| the cyan against the UI's five role hues | 5 | 0.034 | 0.101 | 1 | 0 |

- **The empower row got wider at its worst and narrower in the middle:**
  its closest pair is up from 0.024 to 0.070, and six of its pairs are
  now under 0.10 where three were, since the cyan moved in among the
  blues (it is 0.084 from the steel).
- **Not held apart, and close:** rejuvenate's green is 0.032 from yours
  (0.058 in the default), inspired's 0.054 from yours, burn's 0.042 from
  the enemy's pink for a tritanope. A pip and a number are not a body, so
  I left them.
- To normal vision the status hues' closest pair is 0.095 in both
  palettes, and the empower hues' is 0.122 for 0.157.

**A page of swatches** for the eye: `scratch/116g-palette-colourblind.html`
(untracked), every hue of both palettes as it is and as each simulation
shows it, in five groups.

**Verified.**
- `npm test`: 237 files, 3423 tests (+12: the gate file's 11 and one in
  `palette.test.ts` for the chosen name). Typecheck clean.
- **The row, in the pane** (Chromium, the dev server, `d24c6f5-dirty-dev`).
  On the menu: Default pressed, Reload now disabled at 0.3 opacity, "The
  game is drawn in this palette."; a click on Colorblind stores
  `palette: 'colourblind'`, enables the button and changes the line; back
  and forth, the two rows and the row under them do not move (the line
  keeps 33 pixels). The button's own click reloads the page.
- **The palette through the real boot,** which 116f could not check: after
  that reload the root element carries 18 token overrides, the menu's
  title is `rgb(70, 251, 174)`, the row reads Colorblind pressed and
  nothing to apply. In the quarry fixture the commonest ink colours with
  the bloom off are `#46fbae`, `#f942b2`, `#ffb000`, `#716559` and
  `#b5843c`: the four hexes, and the stone the model predicted. The
  table's two sampled rows are the instrument on those colours. In a run,
  choosing the other palette gives the saved-run sentence, which fits the
  two lines kept for it.
- **The production bundle with a palette chosen,** 116f's other open
  item: `vite build`, the settings planted in `localStorage`, a run URL.
  18 overrides on the root, and in a battle every HP bar's full colour is
  `rgb(16, 246, 108)`, the mint's linear channels as the gradient writes
  them (by the same arithmetic the default green would give `rgb(8, 255,
  0)`; not read on this build), so the bundle chose the palette before
  the overlay module read it.
- **A run is left alone.** The seed-7 drive under Electron: exit 0,
  `logHash a59ee48f`, 12 battles.

**Not verified.**
- No eye, colour-deficient or not, has seen the palette in the game. I
  looked at one scaled screenshot of the quarry and one of the modal.
- Firefox, Electron with the palette chosen, itch's frame, and whether a
  reload behaves in each as it does in the pane.
- The map, the reward, port and event screens in the palette: their
  colours follow the tokens, which I read, and I did not look at them.
- A body against the floor under it. The gate is hue against hue; the
  floors' own colours did not move, and the mint on tundra's ice or the
  pink on desert sand was not measured.
- An anomalous trichromat, who sees between normal and a simulation.
- The drawn form of the gate has never failed where the hex form passed:
  no plant I tried separates them, the 0.9 floor included.
- The bloom's halo at other intensities than the fixture's (a charge-up,
  a low-HP fade).

**The calls in it, for the stop.**
1. The palette's look, on a battle, the map and a camp fight: the mint,
   the pink, the darker stone, the bluer cyan.
2. The symbols: the three calls in the entry above.
3. The cyan at 0.10 from the mint, vivid, or the duller teal that moves
   less, or left as it was.
4. The re-picked status hues, or the default's.
5. Normal vision in the gate (stricter than signed).
6. The row: two rows and a Reload now button; the label "Colorblind", in
   the user's spelling, where the stored name is `colourblind`.

**Cost.** The production bundle is 630.25 kB raw (627.68 at 116f), the
stylesheet 61.64 kB (61.27). The stretch to here: about 360k, of which
the re-pick searches and the pane were the larger parts.

### The second stop, first part (2026-10-06, the user's) — four calls signed, four open

The reply to the stop, after "the full run" in the colourblind palette
(the user's words; which browser was not said). The reading on the stop's
commit (`8ffeb5f`): **470,741** at 15:02. The stop's eight calls, by the
numbers the report gave them:

- **1, the palette's look: signed.** "I absolutely love the color blind
  palette! Honestly, I could see some normal people preferring it." The
  first eye on the palette in the game, and a normal-vision one; no
  colour-deficient player has been asked.
- **2, a symbol on every pip: signed.** "Every unit is definitely the
  right call!"
- **7, normal vision in the gate: signed. 8, the label "Colorblind":
  signed.**
- **4, the six new glyphs: liked, with a finding.** "I like these
  symbols! Though the symbols do turn out rather small." The 9px symbol
  is too small at the user's real size, which is the thing the pane could
  not show me. Open: the size.
- **3, 5 and 6: not answered, and the fault is the report's.** The user
  could not follow call 3 as worded (the card's square becoming the
  symbol), and for 5 (the cyan) and 6 (the status hues) asked where the
  comparison was. There was none to look at: the stop gave them numbers
  and a choice, and the swatch page shows what was built, not the
  alternatives. A taste call needs both arms in front of the eye.

**Built for the answer:** `scratch/116g-calls.html` (untracked; a scratch
generator over the instrument), served by the dev server so the game's
fonts load. Four sections: the pip at 9 to 14px with three statuses and
with ten; the card's row as it was, as built, and with both the square
and the symbol; the cyan's three choices beside the mint in each view,
with distances; the status and the empower hues, default against
re-picked, in each view. Checked in the pane on the user's server: both
fonts loaded, the 9px mock pip measures the game's 12 by 14 and ten make
56 by 46, as the game's did.

**What the page's numbers add.**
- *The cyan.* All three choices are bound by the tritan view (0.101,
  0.101, 0.015). In the other five views the built cyan is 0.19 to 0.20
  from the mint, the duller teal 0.11 to 0.13, the default 0.09 to 0.10.
  So for the red-green deficiencies, which are nearly all of them, the
  built cyan is the further by a wide margin, not only the more vivid.
- *The card's row with both.* The name's column falls from 54 to 44px,
  and "Rejuvenate" (51px) is cut with an ellipsis; the numbers' line has
  to run under the symbol to fit.
- *The pip's size.* The strip grows one pixel a row for each pixel of
  the symbol and no wider: four pips fit a row at every size to 14px.
  Three rows of ten are 46px tall at 9px and 55 at 12.

The session's leans, given with the page: the built cyan; the re-picked
status hues; the symbol alone on the card; 12px for the pip's symbol.

### The second stop, second part, and 116g-post (2026-10-06, the user's) — 116g READ ✅; the pip's symbol is 12px, ◐ built, unread in the game

The reply after the page (`scratch/116g-calls.html`): "I see now!" The
reading on the first part's commit (`480f2cf`): **495,397** at 20:54.

- **3, the card's row: the symbol alone,** as built. "Yes, definitely
  symbol alone!"
- **4, the symbol's size: 12px.** "Agreed; 12 looks best!" Chosen from
  the page's row of sizes, which draws the pip with the game's rules and
  fonts at real size.
- **5, the cyan: as built** (`#0CC7F3`). "Agreed!"
- **6, the status hues: the re-picks, all of them.** "Signing all of the
  re-picks!"

With the first part, all eight of the stop's calls are answered, and
**116g is read.** One thing changes, so it is a `-post`.

**116g-post — the pip's symbol at 12px.** One declaration in `ui.css`
(`.status-pip-symbol`, `--text-12` for `--text-9`), and the comment in
`statusDisplay.ts` that named the old size.
- *In the pane* (Chromium, `480f2cf-dirty-dev`, the quarry, ten statuses
  planted on a camp unit): the page's rule reads `--text-12`; a pip is 12
  by 17, its symbol's box 10 by 12 and its track 10 by 3; ten pips are
  three rows, 56 by 55, four to a row; each of the ten glyphs is 7.2px
  wide in its 10px box. These are the numbers the page's mock gave.
- *Not verified:* the user has seen 12px on the page, not in the game.
  The read is `batch`, at the sitting: a unit with a status, in a battle;
  wrong is a symbol cut by its plate, or a strip that covers the unit
  above it.

**What the stop cost and what it showed.** Two rounds where one would
have done: the first report asked for three taste calls with no picture
of the alternatives. The page took about 25k to build and check, and
every open call was answered from it in one message.

### 116h — the data rows (2026-10-07, session 133b679f) — ◐ built, unread (`batch`, at the sitting)

A fresh session, from 08:18. Pre-flight: typecheck exit 0; `npm test` 237
files, 3423 tests. Readings: **94,177** at 08:19, after HANDOFF, ROADMAP
§116 and the tool's load; **218,976** at 08:24, after step zero's reading
(the §116 audit, the store, the slot, the journals, the settings modal,
`Game`, DESIGN's Fields and Saving); **320,425** at 08:41, before this
entry. ✔ = read by this session at file:line, or measured.

**Step zero: the cut's premises hold.**
- ✔ The store hands out no section's raw text (`Store`, `store.ts`), so
  the export and the import are new surface on it, as the audit said.
- ✔ A rejected slot's text stays until the first write goes over it:
  `openRunSlot`'s `write` was `store.writeStrict` and nothing else, and
  the first write of a new run is `confirmCharacter`'s autosave (or the
  constructor's, on a page booted by a run dial).
- ✔ The settings modal's header held a landing note for the data rows.
- Three facts the cut didn't state, all inside its intent:
  1. **A save's copy of a journal ends `saved`** (`JournalRecorder.saved`),
     so a rejected save's journal in the finished list has a last segment
     that says where the run stopped, and replay already reads that end.
  2. **Electron's writes are asynchronous** (`electron.ts`: every write
     returns the flush's promise), so an import can't write and reload in
     one breath there.
  3. **The page that imports is stale from the first write.** Its lenient
     cache, its settings' consumers and its live run were built from what
     the store held before, and its next autosave or settings change would
     put that over what was imported.

**What was built.**
- `store.dump()` and `store.restore(dump)` (`src/store/store.ts`): every
  section's stored text by name, and its replacement. A restore writes
  only the sections that differ, one at a time, removes a section the dump
  has no text for, and puts back what was there if a write fails. From
  its first write the store is sealed: every other write returns false and
  stores nothing, and the status is left alone, so no can't-save notice
  flashes on a page about to reload.
- `src/store/backup.ts`: the file (`backupOf`, `backupFileName`,
  `readBackup`). Each section is the text exactly as stored.
- `openRunSlot` (`src/store/runSlot.ts`): before its first `write` or
  `clear` on a page that hasn't loaded the slot, a rejected save's journal
  joins the finished journals, once. `rejectedJournal()` reads it where it
  sits; `lastRunJournal(store, slot)` is what the row exports.
- Settings › Data (`SettingsOverlay.dataSection`): Backup, Import a backup,
  Chosen file, Last run. `Game` wires `deps.data` to the store.

**Calls made while building, for the read** (each inside call 9; none
changes the cut):
1. **An import replaces everything; it is not a merge.** A section the
   file doesn't hold is removed. The signed read ("the old value is back")
   is a restore, and a merge has no answer for the run slot.
2. **The file holds each section's raw text,** not its parsed data: an
   import writes back the bytes that were exported, a section that isn't
   valid JSON still round-trips, and the test compares text with text.
   The cost: JSON inside JSON, so the file reads badly by eye.
3. **Two steps,** as the palette is applied in two: Choose file, then a
   row that says what was picked and what importing costs, with the
   button. A destructive action gets its second click that way, and no
   confirm dialog is added to the idioms.
4. **A second tab can't import,** and neither can a page whose store can't
   save. The second tab's row says to close the other tab and reload.
5. **The rejected save's run is "the last run"** while the save sits in
   the slot, ahead of an older finished run, so spec D2's "stays
   exportable" holds from the rejection on and the row's answer is the
   same either side of the new run. A save that loads and is replaced by a
   new run is abandoned, as before, and its journal is not kept.
6. **The backup carries `meta`** like any section, so after an import the
   store's `previousBuild` names the build whose data it now holds.
7. **A backup must carry its mark, format, store layout, build and time;**
   inside it, a section this build doesn't know is dropped and one the
   file doesn't name is empty. A file over 16 MB is not read.
8. **The time in the row is `2026-10-07 08:36`,** the player's clock in
   one fixed order, built by hand: no locale table and no glyph outside
   the subset.
9. **The words:** Backup / Export everything; Import a backup / Choose
   file…; Chosen file / Import and reload; Last run / Export run (the end
   screen's label). All in `locales/en/ui.json` under `settings.data.*`.
10. **The Chosen file line keeps three lines by `min-height: 4.5em`,**
    the palette row's mechanism at one line more. DESIGN's "Layout
    stability" says never a measured `min-height`; the palette's row was
    signed with one, and this follows the nearer precedent. It holds at
    1280 wide (below). At a width where the line wraps to four, the row
    grows when a file is chosen; that width is unmeasured.

**Evidence.**
- *Headless,* +21 tests (3444 in 238 files): the store's dump and restore
  (9: every section reads back equal in a second store, an absent section
  removed, only what differs written, the seal with its control, a failed
  write put back with two sections shown to have landed first, can't-save
  when the put-back fails, an asynchronous adapter with the page's own
  write refused in between, a store that can't read); the backup file (5:
  export to import across two stores, fifteen files refused, the
  version's own reason, the lenient section set); the rejected save's
  journal (7: exported from the slot ahead of an older run, kept before a
  write and before a clear for both kinds of rejection, nothing kept from
  five slots with no journal, the control that a loading save is not kept,
  kept once when the new run's save fails, a second tab reads nothing).
- *The pins fail when their rule is removed:* 15 planted changes to the
  new code (the seal, the put-back, the differing-only write, the removal,
  the locked dump, keep-before-write, keep-before-clear, kept-once,
  only-a-rejected-save, the loaded run's own text, the rejected save
  first, the mark, the build and time, the other version, a section is
  text), each caught by 1 to 4 tests; the clean tree, 0 failures. The
  script is the session's scratch.
- *In the pane* (Chromium, `00123b2-dirty-dev`, 1280×720, the menu):
  - Export everything: the file is named
    `asciibattler-backup-2026-10-07T12-36-58-221Z.json`, and its sections
    equal `localStorage` read directly, key for key.
  - A setting changed after the export (`volumeMaster` 0.25, stored and
    in the audio player). Three files refused, each with `localStorage`
    unchanged and the button disabled: the save's own journal, plain
    text, and the backup with its store layout changed (its own line).
  - The backup chosen: the line reads "A backup from 2026-10-07 08:36,
    made by version 0.0.0+00123b2-dirty-dev. Importing replaces…", the
    button is live, and nothing is written yet. Across the four states of
    the line, the line (49.5 px, three lines of 16.5), the button and the
    row under it kept their boxes.
  - Import and reload: the page reloaded, `localStorage` equals the
    backup's sections (the settings key, absent from the backup, is
    gone), and the volume is 0.5 in the settings and the audio player.
  - A rejected save (the slot's text with `v` 46): the menu shows the
    notice and no Continue; Last run is live and its file is the slot's
    journal, with the slot and the journals key untouched. New run and a
    character: the journals key holds that journal, the slot holds the
    new run at v47, and Last run, opened from the chip, is still that
    journal.
  - A second tab (`lock: 'elsewhere'`): Choose file and Import and reload
    are disabled and the line says why; Backup and Last run still export.
  - `?store=deny`: all four buttons disabled, each line saying why.
- `npm run probe -- shell/electron/probes/drive-run.js --seed=7`: ok,
  12 battles, log hash `a59ee48f`, the pinned one.

**Not verified.**
- **No real file was saved or picked.** The pane check put a spy in the
  download's place and set the file input's `files` by script. The
  browser's download and file dialog, in Firefox, under Electron and in
  itch's frame, are the sitting's.
- **Electron's adapter with a real restore.** The asynchronous path is
  tested over a gated memory adapter, not over the preload's file.
- A real quota failure in the middle of an import; a width at which the
  Chosen file line wraps past three lines; the Tab walk over the new rows
  in Firefox.
- The pane's console held 11 `Failed to load resource: net::ERR_CACHE_…`
  lines and no script error. What they name was not looked into;
  `ready()` passed on every load.

**Cost.** The production bundle is 636.80 kB raw (630.25 at 116g), the
stylesheet 61.68 kB (61.64). The step: about 226k, of which step zero's
reading was 125k.

**The read** (`batch`, at the sitting, ROADMAP's script): Settings › Data,
Export everything; change a setting; Import a backup, choose the file,
Import and reload; the old value is back. Wrong is a file that isn't
offered, a setting that stays changed, or a row that moves when a file is
chosen.

### 116i — the can't-save chip (2026-10-07, session 133b679f) — ◐ built, unread (`batch`, at the sitting)

Readings: **329,951** at 08:44 on 116h's commit (`2c523eb`), the step's
start; **384,259** at 08:50, before this entry.

**Step zero: the premises hold.**
- ✔ `store.onStatus` had no listener outside tests (a search of `src`,
  `tests`, `shell` and `scripts`).
- ✔ The chrome column's order is CSS `order` per chip class, the pool chip
  last at 5 (`ui.css`), and a hidden chip collapses, so a chip at 6 is
  under everything and its coming and going moves nothing.
- ✔ A query that is no run dial boots the menu (`bootsToMenu` parses the
  run dials and looks for `bp`), so a second store plant needs no rule.
- ✔ The one existing plant, `?store=deny`, refuses the store from boot, so
  it can't show a failure that arrives in mid-run: the cut's "a DEV plant
  fails writes after boot" is a new plant.

**What was built.**
- `CantSaveChip` (`src/ui/CantSaveChip.ts`): `⚠ can't save`, `order: 6`,
  in the destructive red, a text site whose tooltip is `save.unavailable`.
  `Game` makes it after the other chips and feeds it from
  `store.onStatus`; a failure also writes one console line with the
  store's error.
- `?store=full` (`fullChoice` in `src/store/choose.ts`, armed in
  `index.ts` after `createStore`): the page's own storage, with every
  write and remove throwing a `QuotaExceededError` from then on.
- DESIGN: the chip's paragraph under Chips, the column's order, its row in
  the checklist, and the sentence in Saving.

**Calls made while building, for the read.**
1. **The chip shows on every screen while the store can't save,** the menu
   included. So at a boot with storage blocked the menu shows two things:
   its notice, a sentence above the rows, and the chip in the corner. The
   other arm is to hide the chip while the menu's own notice is up. The
   built arm has one rule and no state; the cost is the same fact twice on
   one screen in the rare case. The menu's notice is drawn once, so a
   setting that fails to save while the menu is up is told by the chip
   alone, in either arm.
2. **The words are `can't save`,** the store's own, and the tooltip is the
   menu notice's sentence. Twelve characters with the glyph, which fit
   the plate at the chip's size (measured: no overflow, a scroll width of
   198 in a 198 px box).
3. **Red,** the destructive hue the cache chip's over-capacity flag uses,
   with the glyph and the words as the other channels.
4. **A second tab's unsaved run gets no chip.** The chip is the store's
   status, as the cut says, and a second tab's store can save; its run is
   unsaved by the lock, which the menu says once and the settings' Quit
   row says again. Whether the chip should cover that too is a question
   for the user, not built.
5. **The plant is `?store=full`** and never recovers. A store that
   recovers is pinned headless (`store.test.ts`, 113b); the chip hiding
   again on a write that lands was not seen in the pane.

**Evidence.**
- *Headless,* +1 test (3445 in 238 files): the full plant boots able to
  save with its stamp landed, a write before it is armed lands (the
  control), and after it every write and clear fails with the status at
  can't-save, one notification, nothing changed in the storage, and what
  is stored still read.
- *In the pane* (Chromium, `2c523eb-dirty-dev`, 1280×720):
  - `?store=full`: the menu boots with the store able to save, the chip
    hidden and no notice. New run, then a character: on the map the chip
    is shown, the store's error is `QuotaExceededError: planted by
    ?store=full`, and the slot holds nothing. The column reads bits 20,
    cache 75, settings 130, pool 185, can't-save 250 (tops, px), each
    200 wide.
  - The box oracle, a same-page toggle of the chip's `is-hidden` on the
    map: of 159 visible elements under `#ui`, one changed, the column's
    own box (275 px tall with the chip, 220 without). No chip, button or
    map node moved.
  - The tooltip opens on hover with the sentence, and the chip carries
    `aria-describedby` while it is open; its touch route is a tap.
  - `?store=full` on the menu: a setting written through the model
    returns false, the chip appears, and the menu's title and rows keep
    their boxes.
  - `?store=deny`: the chip is at the column's top (20, 20) with the
    menu's notice in the middle of the screen.
- *The production bundle* holds neither plant: `store=full`, `store=deny`,
  `planted by` and `QuotaExceededError` are in no line of it, and two
  strings that must be (`cant-save-chip`, `asciibattler-backup`) are.

**Not verified.** The chip in Firefox, under Electron and in itch's frame;
its tab stop in a real Tab walk; a real quota failure (the pane's storage
takes some ten times a stock browser's, `process/browser-pane.md`); the
chip hiding on recovery.

**Cost.** The production bundle is 637.35 kB raw (636.80 at 116h), the
stylesheet 61.78 kB (61.68). The step: about 54k.

**The read** (`batch`, at the sitting, ROADMAP's script): the dev server
at `?store=full`, New run, a character; the chip appears as the map comes
up and nothing else moves. Then `?store=deny` for the menu's two notices
of one fact, call 1.

### 116j — the credits (2026-10-07, session 133b679f) — ◐ built, unread (`batch`, at the sitting)

Readings: **388,269** at 08:52 on 116i's commit (`6c0f9da`), the step's
start; **454,307** at 09:01, before this entry.

**Step zero: the premises hold, and one finding.**
- ✔ `public/THIRD-PARTY-LICENSES.txt` held the two fonts and nothing else
  (321 lines), and no script writes it (`build-font.mjs` only names it in a
  comment), so it is edited as a file.
- ✔ The three bundled libraries are MIT (three 0.184.0, simplex-noise
  4.0.3, zod 4.4.3; each `node_modules/<name>/LICENSE`, 21 lines). Their
  permission texts are one text; their copyright lines differ.
- ✔ No `progress` section was defined, `localeCredits()` gives nothing for
  `en`, and `resetRun` held the landing note for the credits.
- **Finding: the bundle holds Vite's module-preload polyfill** (the string
  `modulepreload` is in `dist/assets/index-*.js`), Vite's own MIT code,
  which no notice in the shipped file covers. Not resolved here: the way
  out is a build option or one more section, and the first edits
  `vite.config.ts`. Filed in TODO "§116 riders".

**What was built.**
- `CreditsOverlay` (`src/ui/CreditsOverlay.ts`): the 96f panel with seven
  groups and a last line naming the licence file. Every line is a locale
  value (`credits.*`), the names too. The body is a scroll box with a tab
  stop.
- The menu's Credits row, between Settings and the seed field
  (`MenuContext.openCredits`).
- `PROGRESS_SECTION` (`src/store/progress.ts`), the lenient `progress`
  section, with `creditsSeen`. `creditsOnTheWay(won, toMenu, creditsSeen)`
  in `menuRules.ts` is the rule, and `Game.resetRun` opens the panel over
  the menu and stores the flag as it does.
- The licence file gains three sections, each library's LICENSE file
  copied whole by a script from `node_modules` (the session's scratch),
  with a line on what the game uses it for.
- `tests/licences.test.ts`: the libraries the game bundles are read from
  the source's run-time import graph, held to an exact set, and each one's
  LICENSE file must be in the shipped file whole.

**Calls made while building, for the read.**
1. **The line that credits Claude** is a group named "With" holding
   "Claude, by Anthropic". Other arms: "Built with", or a role beside the
   developer's. The wording is the user's.
2. **The tools:** TypeScript, Vite, Vitest, ESLint, Prettier, Electron,
   from `devDependencies`. Left out: tsx, subset-font, globals,
   typescript-eslint and the two `@types` packages.
3. **"Sound tools: ChipTone, sfxr.me"** is its own group, a courtesy as
   signed. ChipTone's terms are still unread (the shape-lock's note).
4. **No licence text in the panel and no link to the file;** the last
   line names the file. A link's behaviour under Electron and in itch's
   frame is unknown, and the panel was cut as static.
5. **The flag is stored when the panel is shown,** so a tab closed on the
   credits doesn't bring them back, and the menu's own row never sets it,
   so a player who opened Credits before a first win still gets them
   after it.
6. **The credits open over the menu,** as a panel, not as a screen
   between the end screen and the menu: one shell, and Esc, the backdrop
   and ✕ all lead to the menu behind it.

**Evidence.**
- *Headless,* +9 tests (3454 in 240 files): the licence file (4: the
  exact set of bundled libraries, each LICENSE whole, the control that a
  file without a notice or with an edited one names the library, the two
  fonts), the progress section (4), the route's rule (1).
- *In the pane* (Chromium, `6c0f9da-dirty-dev`, 1280×720):
  - The menu's rows are New run, Settings, Credits and the seed. Credits
    opens the panel with the seven groups as written; ✕ closes it and
    focus is back on the row.
  - At 720 px tall the first build's list was 34 px taller than its box.
    With the gaps tightened and DejaVu's licence shortened to one row,
    the list is 511 px in a 511 px box and the panel 595 px tall.
  - The route, on a page booted to the menu, each end forced by setting
    the run's phase and emitting its event: a defeat leads to the menu
    with no credits and no progress key; the first win opens the credits
    over the menu and `asciibattler:progress` reads `creditsSeen: true`;
    a second win and a later defeat open none. Closing the credits leaves
    focus on the menu screen.
  - On a page booted by `?character=soldier&seed=7` a forced win leads to
    a new run on the map, with no credits and no progress key.
- *The build:* `dist/THIRD-PARTY-LICENSES.txt` is byte-identical to the
  source file, 424 lines, with sections for JetBrains Mono, DejaVu Sans
  Mono, three.js, simplex-noise and zod.

**Not verified.** A real won run (both wins were forced); the panel in
Firefox, under Electron and in itch's frame; the keyboard scrolling the
list on a short window; the names and words, which are the user's read.

**Cost.** The production bundle is 640.51 kB raw (637.35 at 116i), the
stylesheet 62.71 kB (61.78). The step: about 66k.

**The read** (`batch`, at the sitting, ROADMAP's script): the menu's
Credits row; the names and the words. Call 1 first.

### The stretch's hand-off (2026-10-07, session 133b679f)

Three steps built and committed, each read `batch`: 116h, 116i, 116j.
With 116g-post, four are open ◐ for the sitting. 116k, the text scale, is
next and is not started here: its step zero is a measurement on every
screen at each scale, its sweep follows from that measurement, and the two
belong in one context. From about 460k that does not look likely to fit
under the halt; the steps of this round have cost 54k to 226k each.

### The four reads (2026-10-07, the user's) — 116g-post, 116h, 116i and 116j READ ✅

Taken the same morning, from the scripts in the hand-off report, ahead of
the sitting they were cut for. The reading before this entry: **480,587**
at 09:59. The user: "I was able to verify every read except for the
credits, specifically them auto-playing after a first win", and "I'm
comfortable letting that one go given how you tested it; everything else
looked great!"

- **116g-post ✅.** The pip's symbol at 12px, in a battle.
- **116h ✅.** The data rows: the export, a changed setting, the import
  and its reload.
- **116i ✅.** The chip at `?store=full`.
- **116j ✅, with one part let go.** The panel from the menu's row is
  read. The credits opening after a first won run was not seen: the user
  did not win a run that morning. They accept it on the forced-win check
  (§116j: the run's phase set and its event emitted, on a page booted to
  the menu and on one booted by a dial). So that route has still never
  followed a real last battle; the first playtester to win a run is its
  first real read.

**What the reply does not cover.**
- **The calls.** Ten, five and six were listed for these reads. They
  stand as built with the reads, as 116e's eight did. Two were put to the
  user by name in the report (the menu showing its notice and the chip
  together at a blocked boot; the line that credits Claude) and the reply
  names neither, so both stay the user's to reopen.
- **The two questions in TODO "§116 riders":** whether a second tab's
  unsaved run should show the can't-save chip, and the notice Vite's
  preload polyfill has none of. Both open.
- **Where the reads were taken.** The browser was not said, and the
  scripts ask for no Tab walk. DESIGN's checklist keeps its notes that the
  keyboard walk over the data rows, the chip's tab stop and the credits
  panel waits for the sitting, which also takes Electron and itch's frame.

### The reads' answers (2026-10-07, the user's) — four answers; 116i-post ✅ READ, 116j-post ✅

The reply to the list above: "Yes, your With section is great! Second
tab should also show the chip, and add the Vite section! The keyboard
walk looks good too!" The reading before this entry: **518,896** at 10:16
(490,377 on the commit that recorded the reads, `55b66d2`).

- **The line that credits Claude: signed** as built, the group "With"
  holding "Claude, by Anthropic" (116j, call 1).
- **The keyboard walk: read ✅** over the data rows, the chip's tab stop
  and the credits panel. The browser was not said, so DESIGN's checklist
  records it as the user's read of this date. Electron and itch's frame
  stay the sitting's.
- **A second tab's run shows the chip: built, 116i-post.**
- **Vite's licence joins the file: built, 116j-post.**
- Not named, so standing as built and the user's to reopen: at a blocked
  boot the menu shows its notice and the chip both (116i, call 1).

**116i-post — a second tab's run shows the can't-save chip** (◐ built,
read `batch`, at the sitting).
- *The rule* is `cantSaveReason(canSave, lock, runOnScreen)`
  (`src/ui/cantSave.ts`), pure: `storage` whenever the store can't save,
  on every screen; `elsewhere` in a second tab while a run is on screen;
  else nothing. `Game.paintCantSave` applies it from `store.onStatus` and
  at every `swap`, and the chip's tooltip is the reason's sentence, read
  at each open (`save.elsewhere` for a second tab, the menu notice's own
  words).
- *A call inside the answer:* the second tab's chip is up only while a
  run is on screen, not on that tab's menu or a run's end screen. The
  question was about that tab's unsaved run; on its menu the notice says
  it, a changed setting there is saved, and "can't save" would be false
  of it. The other arm is the chip for the tab's whole life.
- *Headless,* +3 tests: a store that can't save is the reason under every
  lock and on every screen; a second tab's reason holds with a run on
  screen and not without; the control, that the first tab and a page with
  no lock have none.
- *In the pane* (Chromium, two tabs of the dev server, 1280×720). The
  first tab, lock `held`: no chip on the menu or on the map, and its run
  is in the slot. The second, lock `elsewhere`: no chip on the menu (its
  notice is there) or on character select; on the map the chip is up,
  last in the column at 250 px, and its tooltip reads "The game is open
  in another tab. This tab can't continue your run, and a run started
  here won't be saved."; a setting written there returns true and the
  store's status stays can-save; at a forced defeat's end screen and back
  on the menu the chip is gone; the first tab's slot text is unchanged
  throughout.
- *Not verified:* Firefox and itch's frame. Under Electron a second
  instance on one profile reads `none`, not `elsewhere` (`runLock.ts`),
  so it would show no chip; not run.

**116j-post — Vite's core licence in the shipped file** (✅, read `none`).
- *Confirmed first:* the built JavaScript opens with the polyfill itself
  (`relList.supports('modulepreload')`, a `MutationObserver` over
  `link[rel="modulepreload"]`), and `dist/index.html` preloads the three.js
  chunk. At 116j only the string had been seen.
- The section is Vite's core licence, the head of
  `node_modules/vite/LICENSE.md` (vite 8.0.13: MIT, "Copyright (c)
  2019-present, VoidZero Inc. and Vite contributors"), copied by a script.
  The rest of that file lists the dependencies bundled into Vite and is
  not copied.
- `tests/licences.test.ts` gains a test: the slice is one MIT licence
  (its first and last words, its length), the shipped file holds it whole
  under its heading, and an edited notice is not it.
- *The build:* `dist/THIRD-PARTY-LICENSES.txt` is byte-identical to the
  source file, 460 lines, six sections.
- *Not checked:* whether the bundler's other run-time helpers are in the
  bundle (minified, they have no name to search for), and the packaged
  shell's notices. Both are in TODO "§116 riders".

**Cost.** 3458 tests in 241 files (+4). The production bundle is
640.88 kB raw (640.51 at 116j), the stylesheet 62.71 kB, unchanged. The
two posts and the record of the reads: about 45k.

**116i-post, read ✅** (the user, within the quarter hour: "No need for a
batch, Claude: already read and confirmed!"). It was cut as a `batch`
read for the sitting and taken at once. The call inside it, the chip up
only while that tab's run is on screen, stands with the read. `main`
was pushed at 10:33, through `0958a93` (the remote branch's reflog; not
by this session). §116 has no open read; 116k
and the sitting remain. The session's last reading: **527,292** at 10:33.

### 116k — the text scale (2026-10-07, session 1a3aa804) — ◐ built, the read is the sitting's

A fresh session. Readings: **106,087** at 10:40, after HANDOFF, ROADMAP,
the audit, `process/planning.md`, `process/oracles.md` and the pane doc;
**288,497** at 11:03, at step zero's end; **421,199** at 11:26, built,
before this entry. No pre-flight run: the tree was clean at `b132869`,
which the last session's hook had passed, and the full suite ran at the
end of the build.

**Step zero: the instrument.** A page script that lays a screen out at each
size in turn (the root element's font-size) and reports what is new against
the same page at 1, by kind: text that no longer fits its own box (*spill*
where it paints outside, *cut* where it is hidden, *scroll* where a
scrollbar takes it), a box that leaves the page (*off*), and two lines of
text that now overlap (*overlap*). It reads boxes and the rectangles of the
text itself, a surface the stylesheet's units don't decide.
- *Its known answers.* Before any scan it plants one case of each kind,
  sized from the font's own metrics (nine letters are 86.4px at 1 and 108px
  at 1.25), a control sized in rem and one at opacity 0, and fails unless
  it classes them so. The plants caught a flaw on the first run: a line
  scrolled out of view inside a scroll box was counted as overlapping the
  text under the box. A line is now clipped to its clipping ancestors.
- *Where it runs.* The first pass was in the pane and was thrown away for
  the battle and pre-turn screens: a hidden pane holds every fade at its
  first frame, so the screen that had just left and the spent countdown
  read as live. The survey moved to the Electron runner in offscreen mode,
  where frames are real, and became `shell/electron/probes/text-scale.js`.
  The two instruments agreed where the pane could be trusted (the menu, the
  settings, the credits: clean at every size in both).
- *What it covers.* A seeded run (`--seed=7`, the driver's seed 1) played a
  command at a time to its defeat: 26 scans, of the map twice, two events,
  the pre-turn screen twice with its three pile modals, a battle at four
  points, the turn's outcome, promotion, reward and recruit twice each, the
  port, the end screen and a forced won one, and the modals the chips open
  (cache, settings, the sector map). The menu mode adds the menu, the
  settings, the credits and character select.
- *Not covered:* a tooltip, a unit's full card on hover, the cache modal
  with packets in it (it was empty), the sector-cleared screen (the driven
  run loses before a boss), and any screen in a state this run did not
  reach.

**Step zero: what it found**, on the sheet as it was at `b132869`.
- *The boxes.* At 1.5 on a 1280×720 window, 46 rules with the hitsplats
  left out, from about ten causes: the chrome column's 200px plate (on every screen of a run: the
  pool chip's head spilled 69px), the two gauges' widths (the label cut by
  97px), the compact card's 64px (its top line spilled 6px), the map
  legend's 20px swatch, and panels and cards whose px width made text wrap
  where it had not.
- *The window.* The same sheet on a 1920×1080 window put nothing off the
  page at any size up to 2. On 1280×720 the promotion screen was 39px too
  tall at 1.5 and the recruit screen 81px at 2. So the count of boxes was
  small and the limit was the window, which the cut's line had not
  foreseen ("if the count is large, the range comes back to the user").
- *Two stand-ins for a swept sheet,* the page at 1 in a smaller window:
  1024×576 (1.25 on a 720p window) put nothing off the page; 853×480 (1.5)
  put the promotion screen 45px off it and the chrome column over the
  centred text of the event, recruit and port screens.
- *The pre-turn screen scrolls at 1 on a 720p window* (956px of content in
  720, by design, with 96px of padding for the pinned buttons), and its
  hand sits under those buttons until scrolled. The survey reads that as
  overlaps at every size, so they are set aside below, and counted.
- *A resize event changes nothing:* the survey with a synthetic `resize`
  after each size differed from the one without by two battle transients.
  No consumer needs a kick; the countdown's `ResizeObserver` follows.

**The sweep: 24 lines of `ui.css`, px to rem,** each the old length over
16 (the script that wrote them checked the arithmetic and every line's
text before writing any): `--chip-w`, the legend swatch (two), the
recruit, promotion and roster cards' widths, `--hand-card-w` and its
fallback, the character card, the
two gauges, the compact card, the pause button's `min-width`, the tooltip,
the reward description, the daemon line, the reward, port, event and
end-screen bodies, the character row, the cache modal and its row's basis,
and the roster modal.
- *Two arms, measured as a stylesheet laid over the page before the sheet
  was touched:* the boxes with the cards' widths in rem, and with the
  cards left in px. By the survey's counts they differ little. Rem cards
  keep their line breaks, so they are shorter: at 1.5 the promotion screen
  is 17px over a 720p window where px cards put it 39px over, and the
  pre-turn screen scrolls 111px on 1080p where px cards scroll 157px. They
  are wider, which on a 720p window at 1.5 puts the first recruit card
  under the chrome column; that size is past that window in either arm.
  Rem was built.
- *Identity at 1.* Every box's rectangle on every scanned screen, held
  against the sheet before: 1280×720, 21 screens, 3,354 boxes, 0 differ;
  1920×1080, 21 screens, 3,354 boxes, the one difference a state class in
  a box's name (`--pulse` for `--reshuffle`) with the same rectangle; the
  battle HUD's still boxes at a battle's start, 148 at each size, 0 differ;
  the menu's four screens, 217 boxes, 0 differ. *The controls:* two runs
  of the unchanged sheet agree on those 21 screens (0 of 3,354; the five
  battle and outcome scans are left out, since they move with the fight,
  and the comparison runs under reduced motion, since a card caught
  entering differs between two runs); a planted `--chip-w: 12.4rem` is
  caught (145 boxes, the column 200 → 198.4px).
- *Not reached by the identity check,* so resting on the arithmetic: the
  tooltip's `max-width` and the cache modal's two lines.

**As built.**
- `src/ui/textScale.ts`: the four sizes (1, 1.1, 1.25, 1.5), the nearest
  one to a stored value, the root's font-size as a percentage (nothing at
  1, so the page is then the page without the setting), the consumer and
  the hold. `applySetting` routes `textScale`; `Game` hands the consumer
  over.
- The row, Text size, first under Comfort: a choice of four toggles. The
  settings modal takes the hold as it opens and releases it last as it
  closes.
- The hitsplats' stack pitch is 0.875rem (14px at 1), in the transform's
  own `calc`.
- `tests/ui-tokens.test.ts` gains the pin: a width or height of 16px or
  more in px is on a list of five, each with why it holds no text. Its
  scanner reads a planted sheet first, and on the real sheet it failed on
  two px widths put back by hand, naming both.

**After the sweep, measured** (the committed probe on the built tree).
What is new against 1, with four kinds set aside and counted under the
table:

| window | 110 % | 125 % | 150 % |
|---|---|---|---|
| 1280×720 | nothing | four overlaps: the hop chip over the battle banner 19px, the pool chip's value over the event's text 11px, the settings chip over the port's heading 6px, the pool value over a recruit card's label 2px | the promotion screen's heading and button 17px off the page; the chrome column over the event's heading by 35px and over the recruit and port cards; the hop chip over the banner 23px |
| 1920×1080 | nothing | nothing (the pre-turn screen scrolls 5px) | nothing (the pre-turn screen scrolls 111px) |

The menu, the settings, the credits and character select: nothing at any
size on either window; the credits' list scrolls on 720p from 110 %.
- *Set aside,* as rule pairs at 110 / 125 / 150 %. On 720p: the pre-turn
  hand under its pinned buttons 9 / 9 / 15 (there at 1 too, four pairs);
  the board's overlays 27 / 24 / 17 (hitsplats and badges against each
  other and the HUD, which move with the fight: the page at 1 has such
  pairs too, and two scans of one battle don't agree); a card's glyph
  1 / 3 / 4 (its line box is taller than its box at every size, 7px on a
  pre-turn card at 1, and more of it crosses the 1.5px tolerance as it
  grows); the sector map's hint over a node that
  scrolls under it 0 / 3 / 3. On 1080p: 0 / 0 / 2, 10 / 10 / 4, 1 / 3 / 3
  and 0 / 1 / 1.
- `drive-run --seed=7` logs `a59ee48f`, as before the step.

**In the pane** (Chromium, the dev server, 1280×720): the row's four
toggles, 100 % pressed; a click on 125 % stores 1.25 (the model and
`localStorage` read directly), the clicked button's rectangle is the same
after the click, and the root's font-size is unset while the modal is up
and `125%` once it closes; a reload with 1.5 stored boots at `150%`; a
battle at 150 % has 24px hitsplats whose anchors carry the rem pitch
(`calc(342.1px - 0.875rem)`), and 13.5px level badges. Screenshots of the
battle at 100, 125 and 150 % on that window were looked at: at 150 % the
HUD's card rows cover much of the board and the hop chip covers the
banner's left end; at 125 % the board is clear and the hop chip touches
the banner.

**Calls made while building,** each the user's to reopen at the read.
1. **The sizes are 100, 110, 125 and 150 %.** Nothing under 100: no one
   asked for smaller text. Nothing over 150: 2 was surveyed before the
   sweep only, and a 1080p window at 2 has the room of a 960×540 page.
2. **A size is drawn when the settings close.** Drawn at once, the modal
   would re-lay under the pointer: its panel is centred and 704px wide at
   1 and 880px at 1.25 (measured), so the clicked toggle would move. That
   is read from the panel's widths; the row was never built the other way.
   The other arm: draw at once and accept that this one row moves.
3. **No cap by the window.** 150 % on a 720p window is offered and is
   cramped; the row's line says larger sizes need a larger window, and the
   settings modal is clean at every size, so the way back is always there.
   The other arm: draw `min(chosen, what the window holds)`, which needs a
   measured floor kept true as layouts change.
4. **The board's overlays grow with the text** (hitsplats, level badges,
   the status symbols), since they are the smallest text in the game, and
   the hitsplat pitch follows. The board under them does not grow. The
   other arm: hold them at their px sizes.
5. **The cards' widths are in rem** (the arms above).
6. **What stays in px:** gaps, borders and paddings, the bars, the map's
   node grid (`HOP_PX`, `LANE_PX`, the 40px node, whose glyph spills 2px
   only at 2), and the canvas.
7. **A stored value draws the nearest offered size,** so the row always
   shows the size on screen.
8. **The pin's line is 16px,** one line of text at the default size.

**Not verified.** Firefox, Electron's own window and itch's frame: every
measurement here is Chromium (the runner's Electron in offscreen mode, and
the pane). The look at any size, which is the user's read. A tooltip, a
full unit card and the sector-cleared screen at any size. A browser whose
own default font size is not 16px: the percentage multiplies it, by
construction, and none was tried.

**Riders, in TODO "§116 riders":** the four overlaps at 125 % on a 720p
window and the promotion screen at 150 % there, for §117.5; the screens
the survey didn't reach.

**Cost.** 3465 tests in 242 files (+7: five for the text scale's rule and
its hold, two for the pin). The production bundle is 641.72 kB raw (640.88
at 116j-post), the stylesheet 62.74 kB (62.71). The fuzz smoke does not
fire (nothing under `src/sim|run|core|config|bot`). About 315k to here, of
which step zero was 182k: the pane pass that was thrown away, then seven
runner passes read as text.

### The stop after 116k (2026-10-07, session 1a3aa804)

116k is committed as `da6dc99`; the reading on the commit: **441,206** at
11:31. The step cost about 335k, the round's largest, and step zero was
182k of it. The next step is the sitting, 116l, which needs the user and
an itch build with a diagnostics flag that is not built. The session stops
here and recommends a fresh one for it: the preparation, the sitting's
findings and the phase close did not look likely to fit under the halt
from 441k. 116k's read is cut for the sitting; its script is ROADMAP's
line, and the user can take it early, as they did the four `batch` reads.

### 116k's read (2026-10-07, the user's) — READ ✅, one flag for later

Taken within the half hour of the stop, ahead of the sitting it was cut
for. The reading before this entry: **455,173** at 11:54. The user: "I
love this, Claude!" and "It's working perfectly out of the box."

- **116k ✅.** The row, the sizes and the sweep, as built. The browser was
  not said, and neither was a keyboard walk over the row; DESIGN's
  checklist records the read with that. Electron and itch's frame stay
  the sitting's.
- **The flag, for later:** "I think we're going to have to do this again
  in the future, though, because some things definitely just look better
  on the larger sizes (events, the command chips in the HUD, and
  hitsplats being the three standouts)." So some of the default sizes may
  be too small. Nothing is resized now, by the user's call: "this really
  feels like something that will need player feedback to inform--none of
  my play testers have flagged UI size, ever". It is in TODO "§116
  riders".
- **The calls.** Eight were listed for the read and the reply names none,
  so they stand as built, as the earlier steps' did. It speaks to one:
  the hitsplats were seen at the larger sizes and liked there, which is
  call 4's arm (the board's overlays grow). Two taste calls go unnamed
  and stay the user's to reopen: a size is drawn when the settings close
  (call 2), and no cap by the window (call 3).
- *A reading of the flag, the session's and not the user's:* the setting
  did a second job here. It let the user see three surfaces at sizes the
  defaults don't have, on their own screen, without a build. A later
  pass on the defaults can start the same way.

**The calls, SIGNED** (the user, 2026-10-07, in reply to the list of what
the read had not named: "yes, signing your calls!"). All eight of 116k's
are decided as built, the two taste calls that had gone unnamed among
them: a size is drawn when the settings close, and no cap by the window.
116l, the sitting, goes to a fresh session, the user's call on the
session's recommendation. The session's last reading: **466,065** at
11:57, on the commit that recorded the read (`a11fb6a`).

### 116l — step zero, and the sitting prepared (2026-10-07, session 592aa296) — the `stop` is open

A fresh session. Readings: **97,943** at 13:40, after HANDOFF,
`process/planning.md` and the context tool's load; **215,296** at 13:44,
after the cut, the reads since 116h, the store, the lock, the journals'
budget, `process/oracles.md` and the pane doc; **325,116** at 14:04, on
the commit (`0bffd94`); **334,563** at 14:07, before this entry. No
pre-flight run: the tree was clean at `60612fd`, which the last session's
hook had passed, and the hook ran the suite on this commit.

**Step zero: what the sitting still holds.** The cut gave it the `batch`
reads of 116h to 116j and 116k's `stop`; the user took all five early,
with 116g-post and 116i-post. What is left is what no dev page reaches:
- a setting kept across a reload, a closed tab and a restart, in each of
  the three shells;
- in itch's frame: a download, a file picked for the import, the two-tab
  lock, the `localStorage` limit, a write's cost;
- under Electron's own window: a download and an import with real
  dialogs (116h's "not verified");
- the budget's second number, the file of a run played at the shipped
  length;
- then the exit and the close.

**Three premises, checked.**
- *"A build with a diagnostics flag"* did not exist. Built, below.
- *The credits hold no link* (116j, call 4: the last line names the
  file), so there is none to try under Electron or in the frame.
- *The budget's second number may already be stored.* Every run ended
  since 114d kept its journal, up to 1 MB of them, in the store of the
  page it was played on, and 116h's backup holds that section whole. So
  the user's own dev-server page can hand over the sizes of the runs they
  have really played, by Export everything, with no run played for the
  number. Whether that store holds a run of the shipped length is the
  user's to say; this session has not seen it. A run played on the draft
  stays the other arm, and is the only one that times a real run's
  writes in the frame.

**The instrument: the diagnostics build** (`src/dev/diag/`; ARCHITECTURE
has its parts). A build made with `VITE_DIAG=1` gets a `diag` tab on the
right edge. Its panel reports where the page is and whether it is framed,
the store's status and each section's size, the finished journals one by
one (characters, entries, battles, dials, how each ended), the lock as the
boot read it and as the manager lists it now, the browser's storage
estimate, a census of `localStorage` (the game's keys, and the count and
size of everyone else's), and a tally of the game's own writes: each call
of the store's three writing methods timed (serialization and adapter
together) and counted by section, kept across loads. Two buttons measure
the storage limit (a fill key doubled, then bisected; ASCII, then a
two-byte letter) and a write's cost at 4 Ki to 1 Mi characters. The
report leaves by Copy, by its text box, or by Save as file, which goes
through `downloadText`, the game's own download.

**Calls made while building,** the user's to reopen.
1. **The flag is a build-time constant, not a row or a key in the
   shipped game.** The cut's words were "a build with a diagnostics
   flag". The other arm, a "Copy diagnostics" row in Settings › Data of
   every build, would let a player on itch send this report with a bug;
   it is a product decision for §118, not this step's.
2. **The itch upload is the diagnostics build alone.** It is the
   production source with one more chunk, so the three shells' checks and
   the four readings come from one upload.
3. **The limit is measured only on a button that says the page will
   stand still.** While it runs, the origin's storage is nearly full, and
   on itch that origin is shared with every other itch game open in the
   browser. It takes a few seconds, removes its key whatever happens, and
   a fill key left by a tab killed in the middle is removed at the next
   load and reported.
4. **The zip is a script** (`scripts/itch-zip.mjs`), since §118 uploads
   one too and 110b found two tools here that write a file itch can't
   use.

**The oracle: a build without the flag is unchanged.** At a pinned ID
(`ASCIIBATTLER_BUILD_ID=pinned-116l`), `60612fd` built to `2a8ba77c…`
over 32 files, 2,554,869 bytes, and the tree with the diagnostics builds
to the same total, with `VITE_DIAG` unset and with it set to 0. *The
failing control was the first form of the gate:* `const m = flag ? await
import(…) : null; m?.installDiag(…)` built 32 bytes larger, the test
folded and `null?.installDiag({runLock:…}),` left in the bundle. It is now
a call inside an `if`. *The other control:* with `VITE_DIAG=1` the build
is 34 files and 12,183 bytes larger. Its chunks are cut differently (the
store and the download move into a shared chunk, and the three.js file
takes another name), so the diagnostics build is the production source
and not the production bytes.

**Known answers.**
- *Headless,* 17 tests (`measure.test.ts`): a storage with a planted
  quota, bracketed within the step at three quotas with the other keys
  untouched; a storage that takes everything read as the ceiling, not a
  limit; one with no room; a fill key left behind; the census with keys
  that aren't ours; a write refused in mid-bench; a clock with a planted
  step; the tally's buckets and its text across a load.
- *On a real browser,* the pane's Chromium (`vite preview` over the
  diagnostics build, port 5193). The limit: `lastOk` 52,427,776 and
  `firstFail` 52,428,800 with 141 characters in use, the same for both
  fills, 32 attempts each, 5.4 s for the two, the fill key gone. §114's
  console snippet had read 52,428,478 there, within its step of
  50 × 2²⁰ = 52,428,800.
- *The tally against the stored text* (the pane): after a run's creation
  and after its first node the tally's `lastChars` was 5,117 and 5,256,
  and `localStorage`'s `asciibattler:run` held 5,163 and 5,302, the
  envelope's 46 characters more each time.
- *The tally against the journal* (Electron, the driven run below): 46
  writes of the slot and 1 clear. The journal holds 58 run commands, 12
  of them the `advanceTurn` that opens a battle, which is never saved;
  with the save at the run's creation that is 1 + 58 − 12 = 47, the last
  of which ended the run and emptied the slot.
- *Across a load* (the pane): the tally's sections carried, `loads` 2, a
  planted 5,000-character fill key removed and `leftoverFillRemoved`
  true, Continue on the menu, the root at 125 % from the setting written
  through the modal's own toggle.
- *The panel:* Save as file handed the spy a file whose text is the text
  box's; a Space keydown dispatched on a panel button did not reach the
  window, where the game's key registry listens; Copy in the hidden pane
  was refused by the clipboard ("Document is not focused") and by the old
  command, and the note said to press Ctrl+C on the selected text.

**Measured ahead of the sitting,** in Chromium and under Electron only.
- *A write's cost by size, the pane* (the clock's step 0.1 ms; the text
  is a save's own, repeated): 4 Ki characters 0.010 ms a write (50
  writes), 16 Ki 0.014, 64 Ki 0.048, 256 Ki 0.155 (20), 1 Mi 1.94 (10).
- *A whole run under Electron* (`diag-run.js`, the runner's hidden
  window, `app://game`, seed 7, 12 battles, a defeat, log hash
  `a59ee48f`). On a fresh profile: 46 writes of the slot, 0.087 ms each
  on average, 0.2 at most, the data up to 26,449 characters. On a profile
  whose `store.json` was planted with 201 journals (986,346 characters,
  just under the 1,000,000 budget; the file 1.19 MB after the run): the
  same 46 writes at 1.80 ms on average and 2.2 at most, 41 of them
  between 1 and 2 ms and 5 between 2 and 4; the journals' own write at the
  run's end 2.8 ms. **So under Electron a write costs the page in
  proportion to the whole store, not the slot,** because every write
  sends the whole file (`src/store/electron.ts`); at the budget that is
  about a ninth of a frame, at a gate and never in a fight. The main
  process's write of the file is off the page's thread and was not
  timed.
- *The lock under `app://`:* held, the manager present (as at 115f).
- `drive-run --seed=7` without the flag: `a59ee48f`, 12 battles.

**The zip.** `output/itch/asciibattler-0.0.0_0bffd94-diag.zip`: 34
entries, 1,245,873 bytes, the build 2,567,054 bytes (`0010dc74…`), from
the clean tree at `0bffd94`. The check's three planted failures, each by
its own reason: a zip from Windows PowerShell 5.1 (32 entry names with a
backslash), Git Bash's `tar -a` (no End of Central Directory record), and
the good zip held against a build with one byte added (the hashes
differ). `dist/` is the plain build at `0.0.0+0bffd94`, 641.72 kB of
script as at 116k, for `npm run shell`. Both builds booted once in the
shell's hidden window (`app://game`, three children under `#ui`, the
fonts loaded).

**Not verified.** Anything in Firefox. Anything in itch's frame. A real
download or a real file picked, in any shell: the pane's check put a spy
in the download's place. The clipboard where the page has focus. The
panel's look, beyond one screenshot at 1280×720. The Electron window
shown. The main process's file write. The tally under a run played by
hand. One commit attempt failed its hook, on `tests/font-coverage.test.ts`
naming the Cyrillic fill letter as a glyph no shipped font holds; the
letter is now made from its code.

**The sitting,** in Firefox unless it says otherwise. The user uploads
the zip to the draft first (HTML, played in the browser, 1280×720 as at
110e).
1. **Firefox, this machine.** `npm run preview -- --outDir
   output/itch/current --port 5193`, then `http://localhost:5193`.
   Settings › Comfort › Text size, 125 %, close the settings. Reload;
   close the tab and open it again; quit Firefox and open it again. Wrong
   is a boot at 100 %. Then the `diag` tab on the right edge: Storage
   limit, Time writes, Save as file.
2. **Electron.** `npm run shell`. Text size 125 %; Settings › Comfort ›
   Palette, Colorblind, Apply palette. Close the window and run it again:
   both kept. Settings › Data: Export everything (what the window does
   with a download is not known), then Import a backup with that file.
   New run, a character, close the window at the map, run it again:
   Continue is first and returns to the map.
3. **The itch draft.** Run game. Text size 125 %, then the same three: a
   reload, a closed tab, Firefox quit and opened. New run, a character,
   one node; reload; Continue returns there.
4. **Two tabs on the draft.** With the game running in one tab, open the
   draft in a second and run it. Its menu says the game is open in
   another tab and offers no Continue; a run started there shows
   `⚠ can't save`; its `diag` reads `lock.atBoot: "elsewhere"`. Wrong is
   `held` or `none` there. Close the second tab.
5. **The frame's readings,** in the first tab: `diag`, Storage limit,
   Time writes, then Save as file (is a file offered from inside the
   frame?) and Copy (does the clipboard take it?). Settings › Data:
   Export everything, then Import a backup with that file.
6. **The budget's number,** one of two. On the page where the user has
   played full runs (their dev server), Settings › Data › Export
   everything, and the file's path to this session. Or a run played to
   its end on the draft, Export run on its end screen, then `diag` and
   Save as file: that tally is a real run's writes in the frame.

What comes back to the session: the saved reports (their paths, or the
Copy's text), what each shell did with a download, and anything that
looked wrong.

### The sitting, step 4 (2026-10-07, the user's) — the lock fails in itch's frame; 116l-post ◐ built, unread

The user took the script to the draft and reported its fourth point
first: "Failure on step 4, Claude. Second itch tab did not have the tab
lockout, and the second tab's run overwrote the first." The second tab's
report:

```
"lock": { "atBoot": "none", "api": true,
  "heldNow": "SecurityError: LockManager.query: query() is not allowed in this context",
  "otherLocks": null, "queryMs": 0 }
```

Asked what the first tab read: "It's held". Readings: **372,046** at
17:33, at the session's reply to the report; **428,008** at 17:52, on the
fix's commit (`9d298b1`). The other points' results are not yet in.

**The diagnosis.** The lock works in itch's frame: the first tab took it,
and the second tab's request was refused as it should be. What failed is
the confirmation 115f added after a refusal (its call 2): `locks.query()`,
asked who holds the name, with a failed query read as no lock. Firefox
refuses that call in the frame, and the tab read `none` and saved as if
alone, which is `none`'s rule.
- *Firefox's side, second-hand:* its `dom/locks/LockManager.cpp`, read
  through a fetch tool's summary of the page, lets `Request` through when
  the context's storage is partitioned and throws from `Query` whenever
  storage access is at or under deny, with no exception for a partitioned
  one. The error text in the user's report is that `Query` branch's. The
  session's first explanation, from memory, was that the frame is denied
  the whole API; the source and the first tab's `held` both say
  otherwise.
- *The reach, if that reading holds:* every Firefox player on itch, not
  this browser's settings. No public build carries saves yet.
- *Not known:* Chrome in the frame (the round-close smoke's).

**The decision** (the user's, the same hour). The session proposed the
smallest change, a control request only where the query is refused, and
named the cleaner one, the control everywhere and no query at all, as the
one it would not take in the middle of a sitting because it rewrites a
path read in three shells. The user: "I'm good with your proposal, but
I'm also happy to just redo the other steps for the cleaner version!
Totally your call!" The session took the cleaner one. With `query()`
shown to be the fragile call, the verdict now rests on `request()` alone,
which the lock needs anyway, and there is one way to confirm a refusal
instead of two.

**Step zero: does the control tell a broken manager from a working one?**
Two instances of the shell on one profile, the second started while the
first held its page open, each asked by a scratch script for a lock under
a fresh name and for the run lock's name (the code before the change):

| | boot's verdict | a fresh name | the run lock's name | `query()` |
|---|---|---|---|---|
| first instance | `held` (once `none`, below) | granted | refused | lists it |
| second instance, 2 of 2 | `none` | refused | refused | lists nothing |
| one instance alone | `held` | granted | refused | lists it |

So the manager that refuses everything refuses the control, and a working
one grants it. *One launch of the first instance read `none` at boot while
`query()` listed its lock as held:* the 1 s wait fired on a cold start
and the grant came after it. That is the case the wait was written for,
seen once in the seven launches on fresh profiles whose verdict was read
today, and 115f had left unmeasured which path gave an Electron `none`.

**Reproduced on the old code, headless,** before the change: over a
manager that grants and refuses as a browser does and rejects `query()`
with a `SecurityError`, the first tab read `held` and the second `none`.

**Built** (`9d298b1`).
- `acquireRunLock`: a tab refused the run lock asks for a control lock
  under a name of its own (`controlName()`: the prefix
  `asciibattler:run:control:`, the time and a random part) and lets it go
  at once. Granted, it asks for the run lock once more, since the holder
  may have closed in between, and a second refusal is `elsewhere`.
  Refused, it is `none`. `LockManagerLike` has no `query`.
- `runLock.test.ts`: 13 tests (10 before). Every stand-in page has a
  `query()` that rejects as Firefox's does and counts its asks, which stay
  at none. New: the itch case; a control that throws or rejects; a control
  under a taken name, the plant that shows why the name is its own.
  *Five planted defects, each failing by name:* a bare refusal taken as
  `elsewhere` (5 tests fail), the control's answer ignored (2), no second
  ask (2), the hold returned at once (7), the deadline never firing (2).
- The diagnostics report's `lock` gains `control` and `runLock`: the two
  requests the lock makes, made when the report is read and let go at
  once, each with its answer and its time.

**Checked.**
- *Electron, two instances on the new code:* the first `held`, the second
  `none` with its control refused, as before the change. The seed-7 drive
  reads `held` and logs `a59ee48f`.
- *The pane, two tabs of the diagnostics build* (Chromium, `vite preview`,
  port 5193). The first: `held`, control granted in 1.1 ms, the run lock's
  name refused. With a run started there, the second: `elsewhere`, control
  granted in 0.3 ms; its menu has no Continue and the other-tab notice; a
  run started there and taken one node on shows `⚠ can't save`, and the
  slot's text is the first tab's throughout (5,015 characters, the same
  hash before and after), with no write of the slot in the second tab's
  tally and the store still can-save.
- `npm test`: 3485 in 243 files.

**Not verified.** Firefox on the new rule, in a tab of its own or in
itch's frame: both are the read. Chrome anywhere. A second tab's verdict
is now three answers one after another where it was two, under the same
1 s wait. The pane answered each of the report's own requests in 0.2 to
7.9 ms; the boot's three were not timed, and a frame's are unread.

**The zip:** `output/itch/asciibattler-0.0.0_9d298b1-diag.zip` (34
entries, 1,246,036 bytes, the build `68db1b68…`), checked by the script;
`dist/` is the plain build at `0.0.0+9d298b1` (641.83 kB of script, 641.72
before).

**The read** (`stop`, the user's). Upload the new zip. Two tabs of the
draft: the second's menu says the game is open in another tab and has no
Continue, a run started there shows `⚠ can't save`, its `diag` reads
`lock.atBoot: "elsewhere"` with `control.got: "granted"`, and the first
tab's Continue, after a reload, returns the first tab's own run. Then two
tabs of the local build (`npm run preview -- --outDir output/itch/current
--port 5193`), the same. Wrong is `none` in a second tab, or a first tab
that reads anything but `held`.

### The sitting's reports (2026-10-07, the user's files) — the limit, the frame, the journals' sizes

Three files the user saved to their Downloads folder between 18:16 and
18:21, read by the session: two diagnostics reports from the `9d298b1`
build (`asciibattler-diag-2026-10-07T22-15-46-658Z.json`, a tab of its
own at `http://localhost:5173`; `…T22-19-57-795Z.json`, the itch draft's
frame) and a backup exported from the user's dev-server page on the same
local origin (`asciibattler-backup-2026-10-07T22-21-00-133Z.json`,
138,105 bytes, build `1587405-dev`). Firefox 157. The reading before this
entry: **440,142** at 17:55, on the commit before it.

**Firefox's `localStorage` limit: 5,242,880 characters an origin.** The
local tab's measurement: with 391,710 characters in use, the fill key
took 4,850,688 and was refused 4,851,712, the same for the one-byte fill
and the two-byte one, 26 attempts each, the key removed. With the key's
22 that puts the limit from 5,242,420 up to but not including 5,243,444,
and 5 × 2²⁰ = 5,242,880 is inside. So Firefox counts characters, keys and
values both, which is what `JOURNALS_BUDGET` is written in. *Not measured
in the frame:* that report's `limit` is null, so that the partitioned
area has the same cap is a prediction.

**The frame** (`https://html-classic.itch.zone/html/<id>/index.html`,
`embedded: true`, the ancestor `https://kleinfourgroup.itch.io`).
- *A download works from inside it:* that report is itself a file the
  frame saved, through `downloadText`, the path the game's exports take.
  This is §114e's carried question, answered for Firefox.
- *The lock, the first tab, on the new rule:* `held`, the control
  granted, the run lock's name refused, and `query()` still refused with
  the same `SecurityError`. The tab of its own reads `held` too, and its
  `query()` answers.
- *The store survives loads and an upload there:* a `9d298b1` page read
  `previousBuild: 0.0.0+0bffd94`, the first upload's stamp, with the
  settings and a run stored and seven loads in the tally since 17:19.
  Which of a reload, a closed tab and a restart those loads were is the
  user's to say.
- *The origin is shared, seen directly:* two keys outside the game's
  namespace are visible from the frame, 162 characters together. One is
  another itch game's (its name is in the user's report and left out of
  this public file); the other is `asciibattler.spike110`, the boot
  counter §110's spike left in this browser. The browser's estimate for
  the origin is 6,483,093 bytes in use (6.4 MB at 110e) of 10 GB.
  `hasStorageAccess` false and `persisted` false, as at 110e.
- *A write's cost there:* five writes of the slot, up to 5,789
  characters, four under 1 ms and one read as 1 ms by a clock whose step
  is 1 ms. No write of a larger slot and no timing by size: `bench` is
  null in both reports.

**The journals' sizes: the budget's second number.** The backup holds
four finished journals, all played by hand:

| dials | battles | end | minutes | segments | characters | without the segments' starts |
|---|---|---|---|---|---|---|
| `hops=2` | 5 | victory | 6 | 1 | 3,789 | 3,718 |
| `seed=42` | 13 | defeat | 11 | 3 | 10,371 | 10,168 |
| none (the shipped length) | 18 | defeat | 15 | 1 | 10,283 | 10,219 |
| none (the shipped length) | 40 | defeat | 36 | 3 | 80,954 | 38,276 |

- *The first row is a known answer for the report:* 3,789 is the byte
  count of the file the user exported on 2026-10-02 (§114e).
- *A run costs 570 to 960 characters a battle,* by the two rows of the
  shipped length (the longer one holds 101 battle orders and 7 recruits
  at some 260 characters each). The kickoff's estimate, 15 KB for a
  30-battle run, was built on 2.4 orders a battle and is low by up to
  half for this player.
- *A save continued on another build costs a whole snapshot.* The 40
  battle run's third segment starts from one, 42,551 characters at its
  26th battle, because the page had moved to a later commit; its second
  segment, continued on the same build, starts from 63. A dev server
  changes build at every commit. A player meets it once for each upload
  that lands in the middle of a run.
- *Against the budget:* 1,000,000 characters is 26 runs of 40 battles on
  one build, 12 of the largest journal seen, and about 100 of the two
  10 KB ones. It is 19 % of Firefox's limit. With the slot at its
  largest by these parts (a snapshot of 42,551 and a journal of 80,954)
  the game's keys come to about 1.12 M characters, 21 % of the limit on
  an origin of its own; on itch the rest is shared with other games.
- *The slot in the backup:* 9,738 characters, a snapshot of 8,364 and a
  journal of 1,278.

**Not in the files.** A second tab on the new rule, in the frame or in a
tab of its own, which is 116l-post's read. The frame's limit. A write's
cost by size, in either place. Copy and the import in the frame.
Electron. Which persistence checks were made.

### The sitting's read (2026-10-07, the user's) — 116l ✅ and 116l-post ✅ READ; the journals budget SIGNED

The user's reply to the six things the files did not say, with two more
readings pasted from `diag`. The reading before this entry: **468,672**
at 18:37 (463,240 on the commit that recorded the files, `bc3a0d3`).

- **116l-post ✅ READ.** The second tabs, on the draft and on the local
  build: "It worked!"
- **The budget: SIGNED** at 1,000,000 characters ("Signing that limit").
  `JOURNALS_BUDGET`'s comment now carries the two measurements in place of
  "soft".
- **Copy and the import in the frame:** "Yes!"
- **Electron:** the settings and the run survived a restart ("They did"),
  and Export everything and Import a backup "opened a regular save/open
  dialogue". So under the shell a download is the system's Save dialog and
  a picked file the system's Open dialog. *Not said:* whether the import's
  reload brought the old value back there (TODO "§116 riders").
- **Persistence,** a reload, a closed tab and a restart, on the local
  build and the draft: "I believe I tried all combinations!"

**The two pasted readings.** They came numbered 2 and 3 against the
session's list, where 2 was the frame and 3 the local tab. Each names its
own page by its `inUse`: the first holds 391,710, the local tab's census
to the character, and the second 6,853, the frame's 6,691 and 162. They
are recorded by those numbers, the other way round from their labels, and
the user was told so.

- *The frame's limit:* with 6,853 characters in use the fill key took
  5,235,712 and was refused 5,236,736, both fills alike, 26 attempts each,
  the key removed. With the key's 22 the limit lies from 5,242,587 up to
  but not including 5,243,611, and 5,242,880 is inside. **So the
  partitioned area in itch's frame has Firefox's own cap,** which was a
  prediction until now, and this browser has 5.24 M characters of room
  there today.
- *A write's cost by size, Firefox 157,* by a clock whose step is 1 ms, so
  each total is good to a millisecond and the mean is the total over the
  writes:

  | characters | writes | the local tab, total | the frame, total |
  |---|---|---|---|
  | 4,096 | 50 | 0 ms | 0 ms |
  | 16,384 | 50 | 1 | 1 |
  | 65,536 | 50 | 0 | 0 |
  | 262,144 | 20 | 2 | 1 |
  | 1,048,576 | 10 | 5 (one write read 2) | 5 (none over 1) |

  A slot of 64 Ki characters is stored in under a fiftieth of a
  millisecond, and the journals at their budget in about half of one, in
  the frame as out of it. The slot at its largest by today's parts is
  about 124,000 characters. Chromium's pane took 1.94 ms for the 1 Mi
  write. This is `setItem` as the page pays for it; the browser's own
  write to disk comes later and off the page's thread. TODO's rider on a
  write's cost is closed on these and the Electron run.
- *Not taken:* a tally over a whole run played in the frame. The frame's
  five real writes, the timing by size and the journals' sizes stand in
  for it.

### §116 closed (2026-10-07, session 592aa296)

**The exit, against ROADMAP's.**
- *Settings persist across reloads in all three shells:* the user's
  sitting, in Firefox on the local build, under Electron and on the itch
  draft, with a reload, a closed tab and a restart; under Electron also
  116b's probe on one profile launched twice; in the frame the report's
  `previousBuild` and its stored settings.
- *The menu boots first and the dev entry points skip it:* 116c, read at
  the first sitting. Every runner launch of this session booted past it on
  its dials, and the user's three shells booted it on a plain URL.
- *The palette passes its numeric check and the user's eye:* 116g, both
  stops, with the gate on every `npm test`.

**What the phase carried in, and where each landed.** From §113, the itch
leg of the store's round trip: read. From §114: the menu's copy of the
export (116h); a download in itch's frame (works, Firefox); Firefox's
limit (5,242,880 characters) and a played run's file (10 to 38 KB, 81 with
a snapshot start), on which the budget is signed. From §115: Continue and
the notices on the menu (116c); the write-failure indicator (116i); a
rejected save's journal kept (116h); `navigator.locks` in itch's frame,
which found the phase's one failure in the field and 116l-post.

**Left open, each with its home.** Chrome's read of the draft and the
days-later re-open (the round-close smoke, as since §110). The layout
riders for §117.5 (TODO "§116 riders"). Under Electron: a write sends the
whole store, one instance per profile is not enforced, and the import's
result was not said (TODO). A "Copy diagnostics" row for players, a
question for §118 (TODO). The credits after a real first win, which the
user let go on the forced-win check. The itch draft holds the diagnostics
build until §118 uploads the plain one, and this browser's partition
there keeps two small keys the game doesn't read (`asciibattler:diag`,
and §110's `asciibattler.spike110`).

**Counts.** 3485 tests in 243 files (3322 in 229 at the kickoff), green
on every commit's hook; the fuzz smoke fired at no step, as predicted.
No Run or World bump, no RNG stream, no bus event. The production script
is 641.83 kB raw (609.72 at 115g). Seven sessions, 2026-10-04 to 10-07.
`drive-run --seed=7` logs `a59ee48f`, as at the kickoff.

The session's last reading: **515,444** at 18:43, on the closing commit
(`95b8905`); the close cost about 47k.

### After the close (2026-10-07, the user's) — the import under Electron works

The one answer the close left open, given the same evening: "Yes, import
worked under electron!" So a backup picked through the system's dialog
restores in the shell and its reload brings the old values back, which
116h had tested over a stand-in adapter only. TODO's rider is closed.
The reading before this entry: **517,239** at 18:45.

## Phase 117 — Escalation and the unlock mechanism

### The §117 audit and cut (2026-10-07) — the shape-lock is open

Session 515397d2, fresh, from about 19:47. Pre-flight: typecheck clean;
`npm test` 243 files, 3485 tests, 45.8 s. Readings: **92,474** at 19:49,
after HANDOFF and `process/planning.md`; **222,276** at 19:55, at the
audit's end. ✔ = read by this session at file:line, or measured.

**What is there.**
- **Three per-run multipliers, set by nothing a player reaches.**
  `DifficultyMultipliers` is `waveSize`, `levelBudget`, `bits` (✔
  `src/config/difficulty.ts:132-136`), each a `RunConfig` override over a
  `difficulty.json` default of 1 (✔ `:147-157`), resolved once in
  `resolveRunInputs` (✔ `Run.ts:4752-4756`). None has a URL form (✔
  `RunConfig.ts:374-403`, `:420-461`). The count is scaled before its
  rounding and the budget before its own (✔ `wave.ts:203-206`,
  `:241-250`); the bits lever is inside `effectiveBits`, which every earn
  goes through (✔ `Run.ts:2459-2474`), and a sold packet is not an earn (✔
  `:2035`, `addBits`).
- **The enemy's pool has no multiplier and three reads.**
  `selectedEncounter.healthPool` is read where the encounter starts (✔
  `Run.ts:2113`), as the pool's maximum for every gauge and payload (✔
  `:2268`), and as the denominator of the stage condition (✔ `:2885`). A
  multiplier on one of them alone would flip a boss's stage at the wrong
  fraction, so the three go through one accessor.
- **A reload keeps the multipliers now, and a rollout clone does not.**
  D8's reason for the snapshot field was that `Run.fromJSON` resets the
  multipliers. Since 115a `fromJSON` takes the run's config (✔
  `Run.ts:4413`, `:4451-4463`) and the slot keeps the dials, so that
  reason is gone for a reload. It stands for the bot: `cloneRunForRollout`
  loads the wire image with no config (✔ `src/bot/runRollout.ts:65`), which
  is why the harness refuses `--arbitrate` with a probe dial (✔
  `tests/fuzz/commands/args.ts:601-627`). A level that rides only the
  config would have the arbitrated arm judge its choices against
  Escalation-off futures, and §118's board could not be run arbitrated.
  So the level goes in the snapshot, as signed, for the clone's sake.
- **The journal's seed start replays from the dials** (✔
  `Game.ts:1023-1029`, `replayJournal.ts:75`), so a level picked on a
  screen has to be spelled in them too: a `RunConfig` field with a URL
  form. `runConfigToQueryString` writes only the fields it knows (✔).
- **Character select confirms on a card's click** (✔
  `CharacterSelectScreen.ts:85-94`): there is no selected state between
  the click and the run, so a level is chosen before the card is clicked
  or on it. `chooseCharacter` carries the character's id alone (✔
  `Command.ts:211`) and is not journaled (✔ `journal.ts:63`).
- **A run's end is seen in two places.** `run:victory` swaps to the end
  screen (✔ `Game.ts:475`) and the autosave empties the slot at the same
  command (✔ `:815-819`); the credits' flag is written later, at the end
  screen's button (✔ `:963-964`). A win recorded at the button is lost by
  a tab closed on the end screen, with the slot already empty.
  `Run.resume()` re-emits `run:victory` for a loaded end state (✔
  `Run.ts:4284-4287`), so whatever listens must be idempotent.
- **`progress` has one field** (✔ `src/store/progress.ts:19-32`), and a
  lenient field its schema refuses falls back whole (✔ `store.ts:266`): a
  record of levels with one bad entry would lose every character's.
- **A dialed run is told from a clean one by its dials only.** They hold
  `seed=` when the menu's field or the URL set one (✔ `Game.ts:1009-1028`),
  and every other dial the URL carried (`bits=`, `roster=`, `daemon=`,
  `hops=`, `encounter=`). A run started at `?bits=9999&character=soldier`
  saves over the slot, and Continue on a plain page then plays it.
- **Guards the phase will trip, by design:** `RUN_SCHEMA_VERSION` is 47 (✔
  `Run.ts:506`) with its fingerprint; `configHash`'s registry and its
  drift guard for a new config file (✔ `configHash.ts:65-99`);
  resume-gates' list of the inputs a loaded run reads (✔
  `tests/integration/resume-gates.test.ts:250-263`).

**The rounding, re-counted** (a scratch script over the raw
`config/encounters.json`, not through `wave.ts`; its known answers, a
fixed 10 at ×1.1 and a hand factor of 1.5 at 6, came back 11 and 9 → 10).
19 encounters, 34 wave specs: 32 counts by the hand and 2 fixed, all 34
budgets `mean`, 5 with a `levelCap`.

| hand | wave ×1.1: waves gaining 0 / 1 | wave ×1.2: gaining 0 / 1 / 2 |
|---|---|---|
| 6 | 6 / 28 | 2 / 17 / 15 |
| 5 | 18 / 16 | 3 / 26 / 5 |
| 4 | 14 / 20 | 3 / 28 / 3 |

These are §110f's numbers, so that count holds. The pools, by
`Math.round`: every one of the 19 grows at ×1.1 and again at ×1.2 (the
smallest, 13 → 14 → 16; the largest, 44 → 48 → 53; the bosses 36 → 40 →
43, 39 → 43 → 47). A pool under 5 would not grow at ×1.1; none is authored.

**Hypotheses for step zero** (unmeasured).
- That a level-0 run is the parent commit's run: the fuzz arms'
  `summary.csv` and `drive-run --seed=7`'s log are expected unchanged, and
  the snapshot to differ by `schemaVersion` and the new field only.
- That every bits number a screen shows goes through `effectiveBits`, so
  the bits lever needs no display work.
- What the five capped waves do under the budget lever, and which
  encounters hold them.
- How long a paired local sample of six levels takes, and with which arm.
- That the lenient reader takes a record field as it takes a scalar.
- Whether a stepper under each card fits character select at 150 % text
  on a 720p window (§116k's survey is the instrument).
- No measurement of the wave lever under the casualty rule exists
  (§110f's search); 117c's sample would be the first.

**The draft cut.**
- **117a — the fourth multiplier, enemy morale.** `enemyMorale` beside
  the three (the `RunConfig` override, the `difficulty.json` default of
  1); the pool's three reads through one accessor, `round(healthPool ×
  m)`. Exit: at 1, byte-identical (the determinism test, the smoke, the
  drive log); at 1.1 and 1.2 the 19 pools equal a table written by hand in
  the test; a staged encounter flips at the same fraction of the scaled
  pool. No bump; the config hash moves; the smoke fires. Read `none`.
- **117b — the level, its table and the save.** `config/escalation.json`
  (five rows of cumulative lever values) and its module; `RunConfig`'s
  `escalation` with the URL dial; `RunSnapshot`'s field; the constructor
  and `fromJSON` multiply the level's factors onto the resolved four,
  `fromJSON` from the snapshot. Exit: the level-0 oracle against a
  worktree of the parent commit, with a level-1 run as its failing
  control; each level's four factors equal the spec's table written by
  hand (at 5: 1.2, 1.44, 1.2, 0.75); the continuation check holds a
  level-3 run; a rollout clone reads the live run's level. Run v47 → v48,
  re-pinned; the smoke fires. Read `none`.
- **117c — the harness's `--escalation`, and a paired sample.** The flag
  in run mode, legal with `--arbitrate`; then the same seeds at levels
  0–5, small and local, into BALANCE as a smoke and named one. Exit: the
  level counted from each run's output, not from the flag; the table.
  The smoke fires. Read `none`, raised to a stop if a level comes out
  easier than the one under it beyond the sample's noise, since that
  reopens the spec's table.
- **117d — progress and the unlock rule.** One `progress` field (the
  highest level won per character; the ceiling derived from it), three
  pure rules (the ceiling, whether a run counts, the record after a win),
  `Game` writing at `run:victory` and clamping the picked level at
  `createRun`, `chooseCharacter` carrying the level. Exit: the rules
  pinned headless, each refusal by name; under the Electron probe a
  forced win writes the store and a forced win on a seeded run writes
  nothing. No bump; the smoke fires (`src/run/Command.ts`). Read `none`.
- **117e — the picker, and the level on the end screen.** A stepper row
  under each card, its box always reserved; the levels in words; the end
  screen names the level and, after a win that counts, what it unlocked;
  DESIGN's idiom. No smoke. Read `stop`, in Firefox.
- Then the close.

**Calls for the shape-lock, with the session's lean.**
1. **The level is in the snapshot and in the dials.** The snapshot for
   the rollout clone, the dial (`escalation=N`) for the journal's replay;
   on a load the snapshot's wins, as the character's does.
2. **`seeded` is not a snapshot field; the rule reads the dials, and it
   is wider than seeds** (the lean). A run counts toward progress when
   its dials hold nothing but `character` and `escalation` and its level
   is within that character's ceiling. That refuses a typed seed, a
   `?bits=` run continued on a plain page, and a level reached by URL
   without the wins under it. The other shape: a `seeded` boolean in v48,
   which leaves the other dials open.
3. **A reward's taken rows: dropped** (the lean). Keeping them puts the
   screen's display order and a settled amount into the Run and the save
   for good, to serve a reload in the middle of a reward. Nothing the run
   needs is lost today. The other shape: a `RunSnapshot` field in v48 and
   a step of its own, headless core then the screen.
4. **The pool rounds to the nearest whole**, as the count and the budget
   do; the table above is what that gives.
5. **What is stored is the fact, the highest level won, and the ceiling
   is derived** (the lean), so Round 10's content mapping is another
   reading of the same record and no stored meaning changes. The field's
   name is permanent: `bestWin` (the lean). The other shape: store the
   ceiling.
6. **The picker opens at the highest unlocked level and remembers
   nothing; the level is shown on character select and the end screen
   only** (the lean). A chip in a run waits for §117.5, which is moving a
   chip out of that column.
7. **The win is written at `run:victory`**, not at the end screen's
   button.
8. **117c's sample is in the phase** (the lean): small, local, a smoke.
   An inversion found here costs a table edit; found at §118's board it
   costs the round's last phase.

**What the stretch holds.** 117a to 117e's stop is one stretch with no
stop inside it. Estimated from §116's steps, about 430k, on 222k now: it
does not fit under the line in this session. The lean: this session
builds 117a–117c, the sim half, where the audit is the context, and
hands off at the 117c/117d boundary or at the line, whichever comes
first.

### The shape-lock's answers (2026-10-08, the user's) — SIGNED

The cut and its reads are signed as drafted, with the eight calls:

1. **Signed**, after an elaboration: the level is in the snapshot (for
   the rollout clone) and in the dials (for a journal replayed from its
   seed start), and on a load the snapshot's value is the one read.
2. **Signed.** No `seeded` field. A run counts toward progress when its
   dials hold nothing but `character` and `escalation` and its level is
   within the character's ceiling.
3. **Dropped.** The user: "it is pretty rare. I don't know if I would
   noticed if I hadn't been intentionally trying to find odd behavior."
   The user's cheaper fix, kept for the day players report it: save only
   when the reward screen opens, so a reload shows the whole offer again.
   Not built now.
4. **Signed:** the pool rounds to the nearest whole.
5. **Signed:** the stored fact is the highest level won per character,
   the ceiling is derived, and the field is `bestWin`.
6. **Signed:** the picker opens at the highest unlocked level and
   remembers nothing; the level shows on character select and the end
   screen.
7. **Signed:** the win is written at `run:victory`.
8. **Signed as a local smoke**, after a correction of the session's. The
   draft said "small, local" before `process/measurement.md` was read:
   its rule sends a searcher batch of several arms and 40 or more seeds
   to the box, and six levels are six arms. And the draft overstated a
   late finding's cost: wrong numbers found at §118 cost a JSON edit and
   one more cohort, and only a lever that has to be swapped costs the
   words and the picker. Three shapes were put (out; a local smoke under
   the rule's shape; the levels' board pulled forward to 117c on the
   box). The user: "a quick smoke to see where we stand before 118's full
   board run makes sense". The smoke can show a lever that does nothing
   or goes clearly backwards, and cannot rank levels 10% apart.

The stretch: the user took the session's lean, so this session builds
117a–117c and hands off at the 117c/117d boundary or at the line.
Readings: **242,058** at 19:59 on the audit's commit (`d9aed2a`);
**259,602** at 09:08 on 2026-10-08, at the stretch's start.

### 117a — the fourth multiplier, enemy morale (2026-10-08)

Read `none`. The reading at its start: **265,767** at 09:10, on the
commit that recorded the shape-lock (`161e7cf`).

**Built.** `enemyMorale` is the fourth field of `DifficultyMultipliers`,
with a `RunConfig` override (`enemyMoraleMultiplier`, programmatic-only)
over a `difficulty.json` default of 1. `scaledEnemyPool(pool, m)` in
`src/config/difficulty.ts` is the rule: the nearest whole, never under 1.
`Run.enemyPoolOf(encounter)` is now the Run's one read of `healthPool`,
and the three sites the audit named call it: the pool an encounter starts
with, `enemyHealthPoolMax`, and the stage condition's denominator. No
snapshot change: the pool's current value was saved already and its
maximum is derived on a load from the encounter and the run's config.

**Step zero.** The baseline was captured before any edit, in the
foreground on the live tree: `npm run fuzz -- --count=12` (two default
strategies, 24 runs, 39 s) and `drive-run --seed=7`, whose log hash was
`a59ee48f` (re-measured, not taken from the §116 close).

**The oracle, with its controls.**
- At the default, the same 12 seeds give a `summary.csv` and a
  `rosters.csv` byte-identical to the baseline, and the drive log hashes
  `a59ee48f` again. (The drive's frame count was 3946 before and 3945
  after: frames follow the clock and are not in the hash.)
- The control: `enemyMoraleMultiplier` set to 1.2 in `difficulty.json`,
  the same seeds, 21 of the 24 rows differ. The file was restored from
  its saved copy and compared equal.
- Each of the three reads put back to the authored pool, one at a time,
  fails the new tests by name: the stage condition alone fails "a stage
  ends at its fraction of the scaled pool"; the starting pool fails
  three of the four; the maximum fails three of the four.

**Tests** (+8: 4 in `difficulty.test.ts`, 4 in `Run.test.ts`). The stage
test forces the one elite that opens on a pool-gated stage
(`plagueSpreaders`), reads its pool, its threshold and each stage's
archetypes from the catalog, leaves exactly the threshold of the doubled
pool, and expects the second stage's archetypes; the same remainder
against the authored pool is still above the threshold, which is what
the control shows. `resume-gates`' config now sets the fourth
multiplier, so a loaded run is held to it.

**Changed inside the cut's intent.** The cut's exit said "the 19 authored
pools pinned at ×1.1 and ×1.2". `process/measurement.md` asks that a
primitive test use explicit inputs and that no test hold a table of
shipped balance numbers, so that retuning a pool is a one-file edit. The
rounding is therefore pinned on explicit pools (13, 17, 44, a pool of 4
that does not grow at ×1.1, a half that goes up, the floor of 1), and
the 19 authored pools' table stays in the audit above.

**Found on the way.** A forced encounter fields only at a node of its
own kind and otherwise falls through to the normal selection without a
word (`selection.ts:183`), so the first draft of the stage test, forcing
an elite onto a normal root, read another encounter's pool. The test
stamps the root an elite and asserts the encounter's name.

**Predictions against what happened.** No bump: none. The config hash
moves: `difficulty.json` gained a key. The smoke fires: expected on this
commit's hook, and the next entry says what it did.

### 117b — the level, its table and the save (2026-10-08)

Read `none`. 117a's commit is `edba3d0`; its hook ran the smoke (582
passed) and 3493 main tests. The reading at 117b's start: **344,660** at
09:25, so 117a cost about 79k.

**Built.**
- `config/escalation.json` and `src/config/escalation.ts`. The file holds
  five rows, level 1 up, each saying where the three levers (`levelBudget`,
  `wave`, `bits`) stand at that level. So "a lever that comes again adds"
  is authored (1.1, later 1.2) and no code adds; "different levers
  multiply" is `leverFactors`, which sends the wave lever to the count,
  the budget and the enemy pool and multiplies the budget lever with it.
  `withEscalation(base, level)` gives a run's four multipliers and at
  level 0 returns `base` itself.
- `RunConfig.escalation`, with the URL dial `escalation=1..5`. Level 0 is
  spelled by no dial: `escalation=0` parses to nothing and
  `runConfigToQueryString` writes nothing for it, so a run with Escalation
  off has the dials, and the journal start, it had before.
- `Run.escalation`, saved as `RunSnapshot.escalation`. The constructor
  takes it from the config and `fromJSON` from the snapshot, whatever the
  config says; both then derive the multipliers over the config's
  overrides. **Run v47 → v48**, re-pinned.

**Step zero.** Baselines on `edba3d0`, captured in the foreground before
the first edit: the 24 default runs (117a's after-run, the same tree), 4
searcher runs (`--count=2 --searcher --audition`, 69 s, so about 17 s a
run on one job), and a dump of a seed-7 run's snapshot at `map` and in its
first battle, one line a key (88 lines, version 47). The cut said "a
worktree of the parent commit"; a foreground capture before any edit
gives the same proof, and nothing ran in the background against the tree.

**The oracle, with its controls.**
- Level 0: `summary.csv` and `rosters.csv` byte-identical on both shapes
  (the searcher's exercises the rollout clone); the snapshot dump differs
  in four lines, `schemaVersion` 47 → 48 and `escalation 0`, at each of
  the two phases; `drive-run --seed=7` logs `a59ee48f`.
- The control: the default level forced to 1 in the constructor, and 24
  of 24 default rows and 4 of 4 searcher rows differ. Restored.
- In the page: `drive-run --seed=7 --dials=escalation=5` logs `c995c1aa`
  and ends after 10 battles, where level 0 ends after 12. A first try
  with `--url=` was ignored by the runner and repeated level 0's hash,
  which said nothing; `--dials=` is its flag.
- In the suite: the continuation check gained a run on the ladder
  (`escalation=3&character=gambler`) that also reloads with no config and
  plays the same, and a control whose level is set to 0 in the text at
  one gate and diverges at the next though its config still names 3. A
  rollout clone holds the live run's multipliers, against a control run
  with Escalation off.

**Guards that fired, as they should.** Three tests failed until the new
key and dial were registered: the fingerprint's count of top-level keys
(44 → 45), the menu's list of run dials, and the board panel's restated
dial keys. `configHash`'s drift guard was satisfied in the same edit. The
fingerprint's shape guard was not seen failing first, since the version
moved in the same pass as the field; its own tests hold that path.

**Calls made while building** (the user's to overturn).
1. **The parse refuses a ladder where a lever eases**, level 0 standing
   as 1: the spec's guard, "nothing easier than today", made a rule of
   the file.
2. **A level off the ladder in a snapshot is a hard reject**, as an
   unknown daemon or character id is. The slot then reads as unreadable
   and the menu shows the rejected-save notice. A clamp to 0 would hand
   back an easier run than the one saved.
3. **A level multiplies with the run's own multiplier overrides**; it
   does not replace them. The harness's sweeps keep meaning what they
   meant, on top of a level.
4. **The ladder's test holds the shipped file to the signed table by
   hand**, unlike 117a's pools: the table is five rows the user signed,
   so a retune is a change to the spec's table and is made in both
   places together. The rule behind 117a's choice
   (`process/measurement.md`) is for numbers tuned freely.

**Tests** (+28: 3493 → 3521, in 244 files).

**Left for 117e's step zero** (unchanged from the audit): whether every
bits number a screen shows goes through `effectiveBits`. Nothing a player
reaches sets a level until the picker exists.

**Predictions against what happened.** Run v47 → v48: yes. The config
hash moves: a new file. The smoke fires: expected on this commit's hook.

### 117c — the harness's `--escalation`, and the paired smoke (2026-10-08)

Read `none`; the smoke did not raise it. 117b's commit is `c765710`; its
hook ran the smoke (582) and 3521 main tests. Readings: **428,090** at
09:45, at 117c's start, so 117b cost about 83k; **465,445** at 09:52 on
the flag's commit (`467cd9f`); **496,917** at 10:14, the smoke read.

**Built** (`467cd9f`). `--escalation=<0..5>` in run mode sets the run's
level; 0 sets nothing, so `--escalation=0` is the run no flag gives. It is
not among the probe dials `--arbitrate` refuses, since the level is in the
snapshot. `RunResult` gained `escalation`, read from the Run at its end,
and run mode counts the level from the results: a batch whose runs are not
all at the asked level stops before its summary is written, and a batch
above level 0 prints the count. `summary.csv` has no new column, so every
byte-identity surface and the board's parsers are as they were. Other
modes ignore the flag, as they ignore the run-mode dials beside it.

**Checked, with its controls.** `--escalation=0` over 12 seeds: the
summary byte-identical to no flag. Level 3: 8 of 8 rows differ from level
0's, the count line printed, and `--jobs=2` identical to serial. `9` and
`2.5` exit 1 by name. The planted case: with the flag's wiring cut, the
batch stopped with "2 of 2 runs were not at level 3 (seed 1 was at 0)".
The board's arm, `--arbitrate` and all, ran a seed at level 5. Eleven
`RunResult` fixture literals took `escalation: 0` through a script that
checked every file's anchor count before writing any. The hook: 3521 main,
and the smoke 586 in 63 files (+4 tests, +1 file).

**The smoke.** The numbers and their limits are BALANCE's entry of this
date. In short: on the two default strategies at 39 seeds, no level came
out easier than the one under it; levels 1, 2, 4 and 5 each lean harder
on the paired count, the wave lever most firmly; level 3, bits, changed
no outcome because those bots hardly spend, so it is unread, not soft. The
cut's rule raises a stop for a level that comes out clearly easier, and
none did.

**An estimate that missed.** The board's arm was launched beside the
default arms at 24 seeds a level on an estimate of 15 minutes, taken from
one run that died at hop 6 in 39 seconds. Its real runs go two acts. At
14.5 minutes level 0 had a quarter of its chunks, so it was stopped under
`process/measurement.md`'s rule and not re-run: the box is the user's
call, and the levels' read on this arm is §118's board. `TaskStop` left
36 node processes alive; 35 carried this session's scratch path and were
killed by PID, and a second listing found none. The six seeds every level
had finished are in BALANCE as a fragment.

**For §118's board.** Level 3 needs an arm that shops. Six levels at the
board's n are a box cohort: about an hour on 18 local cores for 24 seeds.
The smoke read the first act's opening fights only.

**Hand-off.** The session stops here, at the 117c/117d boundary, as
signed: 117d and 117e are estimated at about 170k and the reading is
497k. 117d starts in a fresh session.

### The six calls from the build, signed (2026-10-08, the user's)

"All six calls signed". They are the ones the hand-off report listed as
the user's to overturn, so none is open:

1. 117a's rounding is pinned on explicit pool values, not on the 19
   authored pools.
2. 117b's ladder test holds the shipped file to the signed table by
   hand. With 1, this is where the line falls between numbers tuned
   freely and content the user signed.
3. The config refuses a ladder where a lever eases.
4. A saved level off the ladder rejects the save.
5. A level multiplies with a run's own multiplier overrides.
6. A batch's level is counted from each run, with no new `summary.csv`
   column.

The user's question with the signature, whether this is roughly on the
right track, and the session's answer: yes for the mechanism (level 0 is
the old game byte for byte, with controls) and for the direction of the
four steps the smoke could read; open for the size of the steps, for
level 3, and for everything past the first act, which are §118's
board's. The top of the ladder is the part to watch: at level 5 the
budget is ×1.44 on a wave ×1.2 with a pool ×1.2, and the six-seed
fragment of the board's arm reached act 2 in 0 of 6 there against 5 of 6
at level 0. That is a fragment and the numbers are placeholders.

The reading on the hand-off's commit (`19598c6`): **511,504** at 10:18.
