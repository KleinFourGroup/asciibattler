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

**Status: §113 ✅ CLOSED 2026-10-01** (the store and the build ID).
**§114, the run journal and its export, is NEXT** (its kickoff cuts it).
The round was spike-first,
then spec, as 7.5 was: [round-8-spec.md](round-8-spec.md) is written over
the spike's answers and signed, and §111–§118 below are its build phases,
each cut at its own kickoff. The charter, the decision points, the exit and
the scope guards are in META-ROADMAP §"Round 8 — Foundations"; the
re-audit behind its 2026-09-26 amendment is
[archive/post-104-worklog.md](archive/post-104-worklog.md) §"The Round 7.5
close", C1.

## Phase 110 — the shell spike ✅ CLOSED 2026-09-30

**Outcome:** the store can be read synchronously at boot in all three
shells (the web, itch's iframe, Electron's preload hand-over), so the boot
keeps its shape. Firefox keeps the store across a restart inside itch's
iframe, partitioned by the itch page, on an origin itch's HTML games
share. Offscreen rendering is the video path: it records the whole page at
30 or 60 fps with the game's sound only, nothing aloud, unnoticed by the
user while they work. `dist/` stayed byte-identical across the phase. The
spec is signed. The record: WORKLOG §110.

- [x] **110a** — the Electron shell, kept (`shell/electron/`): the build in a desktop window, its store a file under `userData`. Read `none`. ✅ `d2e99e4`.
- [x] **110b** — the spike build (the store read before the game loads) and the itch zip. Read `none`. ✅ `7f3e1a8`.
- [x] **110c** — the hidden window: offscreen holds 60 and 30 fps on the GPU; a never-shown window renders at 1 fps. Read `none`. ✅ `02d05bb`.
- [x] **110d** — the recording, checks 1 and 2, at 30 and 60 fps. Read `none`. ✅ `4ee5515` (the outside-app tone moved to 110e).
- [x] **110e** — THE SITTING: the itch draft in Firefox, check 3 blind, one clip watched. Read `stop`. ✅ READ (2026-09-29), `41150a6` + `9e04c30`; Chrome moved to the round-close smoke (the user's call).
- [x] **110f** — the spec (`round-8-spec.md`) and §111–§118 entered; the spike build disposed of. Read `stop`. ✅ SIGNED (2026-09-30), `f19b0ed` + `4ae0730`.

## Phase 111 — the background recorder ✅ CLOSED 2026-09-30

**Outcome:** `npm run record` records a battle from a board fixture, a seed
or two commits side by side, in an offscreen window while the user works:
a fresh profile, the page muted, a clean clip that opens on the whole
countdown or on the fight and ends before the next screen, its colours
tagged BT.709, its sound 25 ms after its picture (an A/B by ear heard
nothing across 0–100 ms). Record mode stayed a reach-in, its seams pinned
on `npm test`. A recording fails when the file drops frames, when a busy
machine leaves page frames unpainted, or when its picture drifts over
50 ms from its sound (each switch of the display stalls the renderer);
retiming the stalls went to §114. `dist/` stayed byte-identical. The
record: WORKLOG §111.

- [x] **111a** — the front door: `npm run record` from a fixture or a seed, the working tree's dev-mode build, a fresh profile per recording, the page muted, the panel hidden, ffmpeg checked, `clips/` gitignored, the README; the `pools` seam pinned. Read `none`. ✅ (WORKLOG §111a).
- [x] **111b** — the clean clip: a lead-in trimmed frame-exact, no planted tone, `--check` for the analyzer's twin; colour patches read back. Read `none`. ✅ (WORKLOG §111b).
- [x] **111c** — backpressure: a capped backlog, frames over it dropped and counted, a recording with drops exits 1. Read `none`. ✅ (WORKLOG §111c).
- [x] **111d** — before/after: each commit built in a worktree, recorded in turn, joined side by side and labelled. Read `batch` (at 111f): both halves open on the fight's first frame and stay in step, labelled; wrong is a half ahead, a label missing, halves too small. ✅ READ at 111f (WORKLOG §111d, §111f).
- [x] **111e** — cue timing, measured: each cue's onset against its frame, and normal play's `<audio>` start latency; the late heal-ticks placed; the A/B's centre. Read `none`. ✅ (WORKLOG §111e).
- [x] **111f** — THE SITTING: the A/B by ear (one file, five offsets, A–E), then the exit clips at the pick (corridors, a seed, `c4ca4e6^` against HEAD). Read `stop`. ✅ READ 2026-09-30 (+25 ms; the pair ✅; two findings → 111f-post).
- [x] **111f-post** — inserted at the 111f read: two openings (`--countdown=full|skip`, full the default), the clip cut before the next screen, +25 ms; and the guards from its findings (frames short, a drift over 50 ms). Read `stop`. ✅ READ 2026-09-30, `f406442` + `e37139f` + `42b3263` (WORKLOG §111f-post).

## Phase 112 — the pane probe kit and the Electron runner ✅ CLOSED 2026-10-01

**Outcome:** a pane session starts with `await __probe.ready()`. A
dev-only `window.__probe` (`src/dev/probe/`) holds the Browser pane's known
traps as calls that fail by name: a page not live yet, a stylesheet that
failed to load, a 0×0 or mis-sized canvas, an overwritten URL, a stale
frame, a crop, a timed-out call still acting. `drive()` plays a whole run
from a seed, the same seed giving the same phase log. `npm run probe --
<script>` runs the same kit in a hidden Electron window and hands back one
JSON line and exit 0, 1 or 2. `process/browser-pane.md` is rewritten around
the kit, and `friction-scan` counts pane, kit and runner calls per session;
the three pre-registered criteria are counted at the round close, over the
sessions that start after ab584af9. `dist/` stayed byte-identical. After
the phase's last read, the dev server stopped watching the output folders,
so a cold server's first page loads in under a second. The record: WORKLOG
§112.

- [x] **112a** — the kit's core: `ready()`, `go(query)`, `check()`, `running()` and a dev-server stand-in; four traps planted and caught by name. Read `none`. ✅ (WORKLOG §112a).
- [x] **112b** — `frame(dt=0)` and `pixels(rect)`: a planted stale read caught, a planted colour read back; the loop's one-frame overlay lag found, a TODO rider. Read `none`. ✅ (WORKLOG §112b).
- [x] **112c** — `drive(...)`: a seeded run to defeat and a `hops=2` run to complete, the same log twice, the plants caught. Read `none`. ✅ (WORKLOG §112c).
- [x] **112d** — `npm run probe`: a whole run exits 0, the plants exit 1 and 2, the recorder still passes; scenes named by `instanceof`. Read `none`. ✅ (WORKLOG §112d).
- [x] **112e** — the pane doc rewritten around the kit, `friction-scan`'s pane / kit / runner columns checked against known answers, the criteria's start recorded. Read `batch`. ✅ READ 2026-10-01 (WORKLOG §112e).

## Phase 113 — the store and the build ID ✅ CLOSED 2026-10-01

**Outcome:** the persistent store exists, and nothing consumes it yet. It
is one store in sections with their own versions (`src/store/`): lenient
sections keep what they can read, and the strict run slot rejects a stale
or unloadable save and leaves the rest alone. It sits over three adapters
(the web, Electron's file, memory at "can't save") and is read by
`main.ts`'s first import. It round-trips on the dev server, on the
production build and under Electron; the itch leg moved to §116's sitting
and the two-tab lock to §115. Headless code can't reach it (an ESLint rule
and its twin on `npm test`). Every build carries an ID, `<version>+<commit>`
with `-dirty` and `-dev`, shown on character select; a dev server stamps
it at each page load. A change to `RunSnapshot`'s structure fails
`npm test` until `RUN_SCHEMA_VERSION` is bumped and re-pinned. The record:
WORKLOG §113.

- [x] **113a** — the build ID: one function shared by `vite.config.ts`'s `define` and the recorder, `-dirty` for uncommitted changes, `-dev` for an ID served live, an environment variable that pins it for a byte comparison. Read `none`. ✅ (WORKLOG §113a).
- [x] **113b** — the store's core, headless: sections with their own versions, the two read policies, a memory adapter, a status that never throws; a read that throws makes the store read-only. Read `none`. ✅ (WORKLOG §113b).
- [x] **113c** — the three adapters and the boot read: the adapter chosen on a read, the round trip only proving saving; `?store=deny` on a DEV page; the store as `main.ts`'s first import, its graph reaching no catalog. Read `none`. ✅ (WORKLOG §113c).
- [x] **113d** — the headless guard: D1's ESLint rule and its twin on `npm test`, which follows the whole run-time graph and prints the chain. Read `none`. ✅ (WORKLOG §113d).
- [x] **113e** — the save's fingerprint, by the type checker, and the run slot's rejection rule; `RUN_SCHEMA_VERSION` exported. Read `none`. ✅ (WORKLOG §113e).
- [x] **113f** — the ID on character select; `ready()` reports the build and the store. Read `batch`: the version and seven hex digits, small, in a corner. ✅ READ 2026-10-01, one finding → 113f-post (WORKLOG §113f).
- [x] **113f-post** — inserted at the 113f read (a dev server baked its ID at its start and kept it through later commits): the dev server stamps the ID into each page it serves, `-dev` kept. Read `stop`. ✅ READ 2026-10-01, `d06ebc6` (WORKLOG §113f-post).

## Phase 114 — the run journal and its export

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

**Carried from §111** (WORKLOG §111f-post): a switch of the display stalls the recorder's renderer, from one 0.2 s stall on an idle machine to 13 s of throttled frames, 142 never painted, on a busier one, which long runs recorded while the user works and then walks away will cross. Retiming each stall from the long-frame log lands here (the user's (B)), after a step zero that switches the display at idle and under a planted steady load; holding the display awake during a recording is the fallback (C); a stepped-clock recorder is the fallback beyond it.

**Carried from §113** (WORKLOG §113a, §113f-post): what replay does with a journal stamped `-dev`. A dev server's page carries the ID git gave at that page load, so the commit is the load's; a stylesheet hot-swapped afterwards is the one drift left. The store's size budget also waits on this phase's measurement of a run's bytes.

## Phase 115 — save/load and mid-run resume

Charter: an autosave at every gate into one slot, a load entry point, and
the scene-for-phase resolver (`Game.devLoadRun`'s landing note: a Run-side
re-emit of the phase's gate event), so a run resumes at any gate (spec
D3), with two oracles: the chaos driver and the continuation check. **Why
here:** after the journal both oracles need. **Risk:** medium-high (it
touches every phase). **Decision points:** none known. **Exit:** the chaos
driver and the continuation check green; a run saved at any gate reloads
byte-faithfully; a stale save rejected with its message. **Scope guards:**
no manual saves, no mid-battle save, no migrations.

**Carried from §113** (WORKLOG §113, call 6): the two-tab lock lands here, with the run slot's first writer. `navigator.locks` exists on the dev page; Electron and itch's iframe are unmeasured.

## Phase 116 — the menu and settings

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

**Carried from §113** (WORKLOG §113, call 5): the itch leg of the store's round trip is taken at this phase's sitting, where a setting is there to watch persist.

## Phase 117 — Escalation and the unlock mechanism

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

## Phase 118 — the public web channel, then the round close

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
