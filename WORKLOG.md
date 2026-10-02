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
