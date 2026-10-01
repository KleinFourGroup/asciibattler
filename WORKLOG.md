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

### 112e — the pane doc, the counter, the criteria's start (2026-09-30) — ◐ BUILT, UNREAD (a `batch` read → §113's kickoff)

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
trap it doesn't hold.
