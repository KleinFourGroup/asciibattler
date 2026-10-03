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

**Status: §114 ✅ CLOSED 2026-10-02** (the run journal and its export).
**§115, save/load and mid-run resume, is IN FLIGHT** (its cut signed
2026-10-02, nothing built yet).
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

## Phase 114 — the run journal and its export ✅ CLOSED 2026-10-02

**Outcome:** a played run is recorded as a journal and replays from it to
the same bytes. The journal (`src/journal/`) holds the build, the config
hash, the start (a seed with the URL's dials as text, or a snapshot),
every run command with its time, every battle order at its tick, a
checkpoint at each battle's end and the final snapshot's hash.
`Game.dispatch` feeds the recorder; `replayJournal` rebuilds the run
headless and names the entry where a replay differs; `npm run replay --
<file>` refuses another config hash always, and another commit or a
`-dirty` build unless forced. A finished run's journal goes to the store's
`journals` section (the newest within 1 MB of text, the number still soft)
and downloads from "Export run" on the end screen; the user's exported run
replayed. The recorder keeps a clip on the page's clock across a switch of
the display, and `npm run record -- --journal=<file>` turns a journal into
a clip of the whole run on the commit that recorded it. Run v46 and World
v36 are unchanged. The record: WORKLOG §114.

- [x] **114a** — the journal's format and its recorder, headless (`src/journal/`); the config hash moved to `src/config/`. Read `none`. ✅ (WORKLOG §114a).
- [x] **114b** — the headless replay, `replayJournal`: a recorded run and its replay leave the same `Run.toJSON()` bytes over four runs; the controls fail by name. Read `none`. ✅ (WORKLOG §114b).
- [x] **114c** — wired into the game, and the replay tool: `Game.dispatch` feeds the recorder; `npm run replay -- <file>`; `npm run dist:hash`; the bundle +5,137 bytes. Read `none`. ✅ (WORKLOG §114c).
- [x] **114d** — finished journals in the store's `journals` section, within the size cap. Read `none`. ✅ (WORKLOG §114d).
- [x] **114e** — the export: "Export run" on the end screen downloads the journal as `.json`. Read `batch` (at 114f's stop). ✅ READ 2026-10-02, no finding (WORKLOG §114e).
- [x] **114f** — the recorder's stalls, retimed (carried from §111): a stamp of the page's clock in every paint, which main keeps the file on; three real switches of the display end at −3 ms. Read `stop`. ✅ READ 2026-10-02 (WORKLOG §114f).
- [x] **114g** — the recorder replays a journal, `npm run record -- --journal=<file>`: the user's exported run as an 8 min 51 s clip, the page's final hash the journal's. Read `stop`. ✅ READ 2026-10-02, one finding → 114g-post (WORKLOG §114g).
- [x] **114g-post** — inserted at the 114g read: the reward screen follows the live offer every frame; `--force` records any journal on the working tree. Read: four frames of the screen. ✅ READ 2026-10-02, `b3b9139` (WORKLOG §114g-post).

## Phase 115 — save/load and mid-run resume

Charter: an autosave at every gate into one slot, a load entry point, and
the scene-for-phase resolver (`Game.devLoadRun`'s landing note: a Run-side
re-emit of the phase's gate event), so a run resumes at any gate (spec
D3), with two oracles: the chaos driver and the continuation check. **Why
here:** after the journal both oracles need. **Risk:** medium-high (it
touches every phase). **Decision points:** eleven, all ✅ DECIDED at the
shape-lock (below). **Exit:** the chaos driver and the continuation check
green; a run saved at any gate reloads byte-faithfully; a stale save
rejected with its message. **Scope guards:** no manual saves, no
mid-battle save, no migrations.

**Carried from §113** (WORKLOG §113, call 6): the two-tab lock lands here, with the run slot's first writer. `navigator.locks` exists on the dev page; Electron and itch's iframe are unmeasured.

**Carried from §114** (WORKLOG §114, the audit's calls 3 and 4): the journal of the run in progress joins the save in the run slot (spec D1), and a load opens a new segment (D4); whether such a segment carries the snapshot or its hash ✅ DECIDED below.

The decisions (✅ DECIDED 2026-10-02, the user's; the audit, the measurement and the reasons: WORKLOG §115):

- **What a save carries:** the snapshot, the run's dials as text, and the journal. `Run.fromJSON` takes an optional config for the inputs it resets; with none it is unchanged, so rollout clones are.
- **One Run bump, v46 → v47:** the sector-cleared gate's two facts, and the last turn's winner and reason, so a resumed pre-turn screen keeps its last-turn strip. The deal's cue sequence is not kept.
- **When it saves:** after every command applied at a gate (every phase but `battle` and `turn-outcome`) and when a run is created; a run's end empties the slot.
- **A journal across a load:** the saved journal's open segment ends `saved` with the snapshot's hash; a load on the same build and config starts its segment from that hash, and on another build from the whole snapshot and its dials. The journal's format goes to 2.
- **The continuation check** reloads at every gate in one pass, against the same run played straight through.
- **The chaos driver** is its own gated driver in `tests/chaos/`, a few seeds on every `npm test`, `npm run chaos` for a sweep.
- **Before the menu exists:** character select shows Continue and the messages; a boot with run dials starts its own run, never continues, and saves over the slot; a second tab can't continue and plays unsaved, saying so.
- **"Can't save":** storage refused at boot gets a line on character select here; a write that fails in mid-run waits for §116's indicator.

The cut (signed 2026-10-02):

- [x] **115a** ✅ (WORKLOG §115a) — the Run's side, headless: `Run.fromJSON(snapshot, bus, config?)`; `Run.resume()` re-emits the gate event of the phase the run is in; Run v47, and `turn:starting` carries the last turn's outcome. Exit: for each gate kind a reloaded run's `resume()` emits the payload the live run emitted on arriving there; `turn-outcome` and `battle` refuse by name; with no config the round-trip, rollout and determinism tests and the fuzz smoke are as they were. Read `none`.
- [x] **115b** ✅ (WORKLOG §115b) — the continuation check, on every `npm test`: a run turned to text and loaded again at every gate, against the same commands played straight through, equal byte for byte at each gate and at the end, over seeds that cross every gate kind, with and without dials. Exit: green; its two controls (the dials withheld from the reload, a field blanked in the text) fail at a named gate. Read `none`.
- [x] **115c** ✅ (WORKLOG §115c) — the chaos driver: random legal commands in every phase, some out of range, and random battle orders; the round trip at every phase change, occupancy at every tick, and its own journal replaying to the same bytes. Exit: a sweep green, or its findings fixed or filed; every command kind sent at least once across the every-commit seeds (a pinned census); a planted round-trip break and a planted overlap caught; a failure prints its seed and writes its journal. Read `none`.
- [x] **115d** ✅ (WORKLOG §115d) — the journal across a load: the recorder carries the earlier segments, the two new kinds of start and end, format 2. Exit: a run recorded across loads at several gates replays to the bytes of the same run played straight through; controls: a changed hash, a segment resumed after another build's. Read `none`.
- [x] **115e** ✅ (WORKLOG §115e) — the autosave and the load, in the game: `Game` writes the slot and empties it; `continueRun()` loads it, resumes the screen and opens the journal's next segment; the DEV load key takes any gate; the pre-turn screen takes its last-turn strip from the `turn:starting` payload. Exit, in the Electron runner or the pane: a run driven to each gate kind, reloaded and continued, shows the same screen and state hash, and driven on reaches the unbroken drive's hash; the seed-7 drive still logs `a59ee48f` with saving on; the strip's text on a seeded drive is as before; a continued run's journal replays under `npm run replay`; `?store=deny` plays on; a stale slot and an unreadable one are rejected with their text left in place. Read `none`.
- [x] **115f** ✅ (WORKLOG §115f) — the two-tab lock (`navigator.locks`): the first tab to boot holds it; no lock where the API is missing. Exit: headless over a stand-in lock; in the pane with two tabs, the second can't continue and writes nothing to the slot; Electron measured. Read `none`.
- [ ] **115g** — Continue and three messages on character select, stand-ins until §116's menu: the rejected save, the run open in another tab, storage refused at boot. Read `stop`, the sitting in Firefox: start a run, close the tab at the map, at a pre-turn screen, in a battle, at a reward, at a port and at an event, and reopen each time; Continue returns to the screen that was left (the one before the battle, for the battle) with the same team, bits and pool, and from turn 2 on the pre-turn screen shows its last-turn strip; a second tab says the run is open elsewhere; a reload (F5) at a gate still offers Continue (added at 115f: the lock across a reload is unmeasured in Firefox); a planted stale save shows the message. Wrong is a different screen, anything lost, or a fight that goes differently under the same orders.

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

**Carried from §114** (WORKLOG §114e): the menu's copy of the export (spec D5). At the itch sitting: what a download does in itch's frame, and the two numbers the journals budget (1 MB, soft) waits on, Firefox's `localStorage` limit and the file of a run played at the shipped length.

**Carried from §115** (WORKLOG §115, calls 7, 9 and 11): Continue and the boot screen's three messages move from character select to the menu; a write that fails in mid-run gets its indicator here, a new idiom for DESIGN §UI idioms that the settings' own writes share; `navigator.locks` in itch's frame is measured at the itch sitting.

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

**Carried from §114** (WORKLOG §114e): what a download does in Electron's window, at the smoke.
