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
is written over the spike's read, as §110's last step. The spec is drafted
([round-8-spec.md](round-8-spec.md), 110f) and §111–§118 are entered below,
unsigned. The
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
- [ ] **110c** — the hidden window: frame rate over 60 s, the WebGL renderer, the result handed to a Node script as JSON; the same under offscreen rendering. Read `none` — a shown window the rate's control; `--disable-gpu` must read as software. ✅ offscreen holds 60.01 and 30.01 fps with 0 hitches on the RTX 4080 SUPER; a never-shown window renders at 1 fps, so offscreen is the video path; the control reads WARP. WORKLOG §110c.
- [ ] **110d** — the recording, checks 1 and 2, at 30 and 60 fps, the game's `<audio>` pools routed into the recording by a spike reach-in. Read `none` — ffprobe on the timestamps; the game's sound present; a tone planted in the page found; another app's tone absent; `isCurrentlyAudible()` false, true in a non-record control run. ✅ corridors (64.7 s) at 1080p30 and 1080p60: 0 frames missing of 2005 and 4007; 128 of 128 cues heard; the tone found; 0 audible samples, the muted control 55 of 83; A/V aligned by content to one frame. The outside-app tone moves to 110e (it plays aloud). WORKLOG §110d.
- [ ] **110e** — THE SITTING: the user uploads the itch draft and reads it in Firefox and Chrome (reload · tab close · browser restart · embedded against the direct URL); check 3 over blind stretches; one clip watched. Read `stop`. ✅ READ (2026-09-29): the clip "looks great" (the lead-in and an audio A/B to the recorder); check 3 unnoticed at 30 and 60; the outside tone heard and absent; Firefox keeps the store across a restart, partitioned by the itch page. Chrome moved to the round-close smoke (the user's call). WORKLOG §110e.
- [ ] ◐ **110f** — the spec (`round-8-spec.md`) over the answers: the adapter's shape, the video path, the probe runner yes or no; the round's phases entered here. Read `stop`. ◐ drafted: D1–D10 signed item by item in the drafting conversation (D8's stacking reading proposed), §111–§118 entered below (WORKLOG §110f).

## Phase 111 — the background recorder (PROPOSED at 110f, unsigned)

Charter: an Electron recorder writes video files of battles, events and
runs from an offscreen window while the user works: the whole composited
page with the game's own sound, nothing aloud, never taking focus (spec
D9). Inputs: a board-explorer fixture, a seed, and before/after at two
commits side by side; full runs join when the journal lands (§114).
**Why here:** the spike's three checks passed, and clips make the round's
UI reads cheaper; it needs only the shell. **Risk:** low-medium (the first
draft passed checks 1 and 2 at both rates; backpressure, the lead-in and a
pinned profile are new). **Decision points:** record mode in `AudioPlayer`
or a reach-in in the development-mode build; the audio offset, by an A/B
by ear. **Exit:** clips of a fixture, a seed and a before/after pair from a
fresh pinned profile, the lead-in trimmed; §110's frame-rate probe and
analyzer re-run green on them; ffmpeg named in the README. **Scope
guards:** a dev tool; no full runs before the journal.

## Phase 112 — the pane probe kit and the Electron runner (PROPOSED at 110f, unsigned)

Charter: a dev-only `__probe` in the page that puts the Browser pane's
known traps into code (`ready`, `go`, `frame`, `pixels`, a canvas-size
check, the whole-run driver), and a thin Electron runner that calls the
same kit from a Node script (spec D10). **Why here:** before the menu and
settings, the round's pane-heavy work. **Risk:** low. **Decision points:**
none known. **Exit:** pane sessions start with `await __probe.ready()`;
the runner hands a probe's JSON and exit code back; `process/browser-pane.md`
rewritten around the kit. **Scope guards:** DEV-only, no production byte
change; the three pre-registered criteria are counted at the round close,
per pane session, runner sessions apart.

## Phase 113 — the store and the build ID (PROPOSED at 110f, unsigned)

Charter: the persistent store, one store in sections with their own
versions and read policies, over a storage adapter with three cases, read
synchronously at boot by the first static import (spec D1); the
`BUILD_ID`, the version scheme, and the save-rejection rule with its
structure-fingerprint guard (D2). **Why here:** the keystone; every later
phase writes through it. **Risk:** medium (the most-depended-on model
left). **Decision points:** the section and key layout; the size budget
waits on §114's measurement. **Exit:** the store round-trips in all three
shells, with a throwing store and a fresh profile as its controls; the
ESLint guard fails on a planted import from `src/sim`; the build ID is
baked and shown; the fingerprint test fails on a planted shape change
without a bump. **Scope guards:** its consumers are seams only.

## Phase 114 — the run journal and its export (PROPOSED at 110f, unsigned)

Charter: the seed, every `RunCommand` and the battles' command traces,
stamped with the build and the config hash, in segments that open at every
load, with wall-clock time per command as metadata (spec D4); telemetry
tier 1, the journal as a downloaded `.json` (D5). **Why here:** before
save/load, whose continuation check and chaos repro need it. **Risk:**
medium (a whole-run replay in the harness, inferred at the 7.5 close to be
the larger part). **Decision points:** how many finished journals are
kept, once step zero measures a run's bytes. **Exit:** a recorded run
replays byte-identically headless from its journal; the export downloads;
the recorder replays a journal offscreen. **Scope guards:** passive, never
perturbing determinism; no ingest server.

## Phase 115 — save/load and mid-run resume (PROPOSED at 110f, unsigned)

Charter: an autosave at every gate into one slot, a load entry point, and
the scene-for-phase resolver (`Game.devLoadRun`'s landing note: a Run-side
re-emit of the phase's gate event), so a run resumes at any gate (spec
D3), with two oracles: the chaos driver and the continuation check. **Why
here:** after the journal both oracles need. **Risk:** medium-high (it
touches every phase). **Decision points:** none known. **Exit:** the chaos
driver and the continuation check green; a run saved at any gate reloads
byte-faithfully; a stale save rejected with its message. **Scope guards:**
no manual saves, no mid-battle save, no migrations.

## Phase 116 — the menu and settings (PROPOSED at 110f, unsigned)

Charter: the title menu as the boot screen (spec D6) and the settings
(D7): the volume levels, the rebind UI, the default speed, the colourblind
palette on reload, the aura-FX mode, the locale, reduced motion, shake,
the text scale, and the store's export and import. **Why here:** Continue
needs save/load, and the pane work needs the kit. **Risk:** medium (wide
UI, checked against DESIGN §UI idioms and §Input accessibility).
**Decision points:** which colour deficiencies the palette covers.
**Exit:** settings persist across reloads in all three shells; the menu
boots first and the dev entry points skip it; the palette passes its
numeric check and the user's eye. **Scope guards:** no music slider, no
achievements row, no camera row.

## Phase 117 — Escalation and the unlock mechanism (PROPOSED at 110f, unsigned)

Charter: the five-level ladder (spec D8): per-character progress, the
picker on character select, the enemy-morale multiplier beside the three
that exist, the level saved in the RunSnapshot; and the cross-run unlock
mechanism, resolved at run creation only. **Why here:** the unlocks need
the store and the saved level needs save/load. **Risk:** medium (a balance
surface). **Decision points:** the stacking reading (proposed in the
spec); the enemy pool's rounding. **Exit:** Escalation off byte-identical
(the determinism test and the fuzz smoke); each level's multipliers pinned
headless; the board read at the round close. **Scope guards:** number
levers only; no unlock content mapping (Round 10); a seeded run unlocks
nothing.

## Phase 118 — the public web channel, then the round close (PROPOSED at 110f, unsigned)

Charter: the itch page, with a how-to-play standing in for Round 11's
tutorial; the `0.1.0` upload after the browser smoke (Firefox; Chrome with
its itch read and the days-later re-open of the draft; the keys visible
from our iframe that aren't ours); then the round close. **Why last:** a
stranger needs the menu, a volume control, save/load, a build ID and the
export first. **Risk:** low-medium. **Decision points:** none known.
**Exit:** the channel open; the board re-run: Escalation off reproduces
the signed sheet exactly, and each level is harder than the one before on
paired same-seed runs. **Scope guards:** Safari untested; the Electron
build stays internal.
