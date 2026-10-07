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

**Status: §115 ✅ CLOSED 2026-10-03** (save/load and mid-run resume).
**§116, the menu and settings, is IN BUILD** (cut 2026-10-04, twelve steps).
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

## Phase 115 — save/load and mid-run resume ✅ CLOSED 2026-10-03

**Outcome:** a run is saved on its own at every gate and continues from
the screen it was left at. `Game` writes one slot (the snapshot, the run's
dials as text, the journal) after every command applied outside a battle
and when a run starts, and a run's end empties it. `Run.fromJSON` takes the
run's config and `Run.resume()` re-emits the saved gate's event, so
`Game.continueRun()` re-mounts that screen; a tab closed in a battle comes
back at the pre-turn screen before it. Two oracles run on every `npm test`:
the continuation check (a run reloaded at every gate plays as the same run
played straight through) and the chaos driver (random legal and illegal
commands in every phase, the round trip at every phase change, occupancy
at every tick). A journal carries across a load (format 2). The first tab
to boot holds a Web Lock, and a second tab can't continue and saves no
run. Character select stands in for the menu: Continue, and a notice for a
rejected save, for a run open in another tab and for storage that can't
save. Run v47, one bump; World v36 unchanged. Left open, each with its
home: a reward's taken rows across a reload (§117's kickoff), one instance
of the shell per profile and a write's cost per command (TODO), the lock in
itch's frame and a rejected save's fate under a new run (§116). The record:
WORKLOG §115.

- [x] **115a** — the Run's side, headless: `Run.fromJSON(snapshot, bus, config?)`, `Run.resume()`, Run v47, `turn:starting` carries the last turn's outcome. Read `none`. ✅ (WORKLOG §115a).
- [x] **115b** — the continuation check on every `npm test`: 148 reloads over four runs with no divergence; its two controls fail at a named gate. Read `none`. ✅ (WORKLOG §115b).
- [x] **115c** — the chaos driver (`tests/chaos/`, `npm run chaos`): every command kind and every order kind sent, four plants caught; `chooseRecruit` now refuses a card that is not in the offer. Read `none`. ✅ (WORKLOG §115c).
- [x] **115d** — the journal across a load, format 2: a run closed at five gates replays to the straight run's bytes. Read `none`. ✅ (WORKLOG §115d).
- [x] **115e** — the autosave and the load, in the game: all eight gate kinds continue to the same screen and hash; the pre-turn strip rides the `turn:starting` payload. Read `none`. ✅ (WORKLOG §115e).
- [x] **115f** — the two-tab lock: a second tab can't continue and writes nothing to the slot; a tab is `elsewhere` only when the lock manager names a holder; a reload took the lock 30 times of 30 in the pane and under Electron. Read `none`. ✅ (WORKLOG §115f).
- [x] **115g** — Continue and three messages on character select; a continued run shows its chips. Read `stop`, the sitting in Firefox. ✅ READ 2026-10-03, one finding → TODO "§115 riders" (WORKLOG §115g, "The sitting").

## Phase 116 — the menu and settings

Charter: the title menu as the boot screen (spec D6) and the settings
(D7): the volume levels, the rebind UI, the default speed, the colourblind
palette on reload, the aura-FX mode, the locale, reduced motion, shake,
the text scale, and the store's export and import. **Why here:** Continue
needs save/load, and the pane work needs the kit. **Risk:** medium (wide
UI, checked against DESIGN §UI idioms and §Input accessibility).
**Decision points:** ✅ DECIDED 2026-10-04: one alternate palette, gated
on protan and deutan over the identity hues, tritan measured and reported
(WORKLOG §116, call 5).
**Exit:** settings persist across reloads in all three shells; the menu
boots first and the dev entry points skip it; the palette passes its
numeric check and the user's eye. **Scope guards:** no music slider, no
achievements row, no camera row.

**Carried from §113** (WORKLOG §113, call 5): the itch leg of the store's round trip is taken at this phase's sitting, where a setting is there to watch persist.

**Carried from §114** (WORKLOG §114e): the menu's copy of the export (spec D5). At the itch sitting: what a download does in itch's frame, and the two numbers the journals budget (1 MB, soft) waits on, Firefox's `localStorage` limit and the file of a run played at the shipped length.

**Carried from §115** (WORKLOG §115, calls 7, 9 and 11): Continue and the boot screen's three messages move from character select to the menu; a write that fails in mid-run gets its indicator here, a new idiom for DESIGN §UI idioms that the settings' own writes share; `navigator.locks` in itch's frame is measured at the itch sitting. And from the 115g stop (the user's, 2026-10-03): a new run's first save replaces a rejected save, its journal included, where spec D2 keeps that journal exportable; what a new run does with a rejected save is decided here, with the menu's export.

**Decided at the shape-lock** (2026-10-04; the reasons are WORKLOG §116's): ✅ the settings are a modal, opened from the menu and from a chip during a run · ✅ a run dial or a `?bp=` bookmark in the URL skips the menu · ✅ a run's end goes to the menu, the first won run by way of the credits (the user's amendment) · ✅ the `seeded` flag waits for §117, so no Run bump here · ✅ no locale row while `en` is the only locale · ✅ aura: `track` and `fill`, `fixed` deleted; shake: its four policies · ✅ binding a taken key swaps the two · ✅ the data rows sit in the settings, and a new run keeps a rejected save's journal · ✅ credits: Matthew Kilgore as developer, Claude, the fonts, the libraries, the tools, the two sound tools, the playtesters unnamed.

- [x] **116a** — the settings, headless: the lenient section, its model, and `main.ts`'s second import, which sets the locale before the catalogs load. Read `none`. ✅ (WORKLOG §116a).
- [x] **116b** — the consumers, no surface yet: the two volume axes, the keys (the swap, the modifier rule, the labels live), the starting speed, the motion override, the shake, the aura mode. Read `none`. ✅ (WORKLOG §116b; three launches on one Electron profile, the dev server and the production build).
- [x] **116c** — the menu as the boot screen: Continue, New run, the seed field, the three notices, the build ID; both end screens exit to it; character select gains Back. Read `stop`, one sitting with 116d. ✅ READ 2026-10-04, one finding → 116c-post (WORKLOG §116c, "The first sitting").
- [x] **116c-post** — inserted at the sitting: the seed's explanation leaves the menu and becomes the tooltip of the word Seed, since the line read as clutter. ✅ the user, 2026-10-04 (WORKLOG "The sitting's answers").
- [x] **116c-post2** ✅ READ 2026-10-06 (the user; WORKLOG §116c-post2, "The first stop's answers") — inserted at the sitting, the user's answer to the stop's question: the end screen shows the run's seed, so a player can type it on the menu. Read `batch` (at 116g's stop): end a run, and the seed is on the end screen under the two buttons, selectable; typed into the menu's field with the same character it gives the same map. Wrong is a number the field doesn't take, or another map.
- [x] **116d** — the settings modal, its two openers, and the rows for volume, speed, motion, shake and aura. Read `stop`, in Firefox: move a volume and hear it, reload and find it kept, open settings from the chip in a battle; wrong is a row that doesn't hold, a control the Tab walk misses, a battle running on behind the modal. ✅ READ 2026-10-04, one finding → TODO "§116 riders" (the chip's home, §117.5's); the rows' explanation lines stay visible (WORKLOG "The first sitting", "The sitting's answers").
- [x] **116e** ✅ READ 2026-10-06 (the user; WORKLOG §116e, "The first stop's answers") — the key rows: rebind, swap, reset. Read `batch` (at 116g's stop), in Firefox, Settings › Keys: rebind Pause to P, and in a battle the Fight-now button and the pause tooltip say P and Space no longer pauses; bind Focus to P and the two swap, with a line under the rows saying so; Reset restores. Wrong is a stale label, one key firing two actions, Ctrl+F still swallowed, Esc closing the modal while a key waits, or a row that moves when its key changes.
- [x] **116f** — the palette's mechanism: `COLORS` chosen by name at boot, the copied hexes moved onto it; the default palette's colours equal to the parent commit's table. Read `none`. ✅ 2026-10-06: the table at `d7cabc8` against the tree's, every base colour at its value, nine planted changes caught (WORKLOG §116f).
- [x] **116g** ✅ READ 2026-10-06 (the user, both stops; WORKLOG §116g and "The second stop", two parts) — the colourblind palette, its check on every `npm test`, a symbol per status, the Palette row. Read `stop`, twice: the candidate with its table, then the eye after a full run in the palette. Signed: the look, a symbol on every pip and alone on the card's row, the cyan and the re-picked status hues as built, normal vision in the gate, the label "Colorblind". One finding → 116g-post.
- [x] **116g-post** ✅ READ 2026-10-07 (the user; WORKLOG "The four reads") — inserted at the stop: the pip's symbol is 12px, since 9px read as rather small (the user chose 12 from a page of sizes). Read `batch` (at the sitting): a unit with a status in a battle shows its symbol at a glance; wrong is a symbol cut by its plate or a strip that covers the unit above. (WORKLOG "The second stop, second part".)
- [x] **116h** ✅ READ 2026-10-07 (the user; WORKLOG §116h, "The four reads") — the data rows: the store's export and import, Export last run, a rejected save's journal kept. Read `batch` (at the sitting): Settings › Data, Export everything, change a setting, Import a backup, and the old value is back after the reload; wrong is a file that isn't offered, a setting that stays changed, or a row that moves when a file is chosen. (WORKLOG §116h, with the ten calls made while building.)
- [x] **116i** ✅ READ 2026-10-07 (the user; WORKLOG §116i, "The four reads") — the can't-save chip, a new idiom for DESIGN. Read `batch` (at the sitting): on the dev server at `?store=full`, New run and pick a character, and `⚠ can't save` appears last in the left column as the map comes up, with nothing else moving; its tooltip says what it means. Wrong is a chip that pushes another, a chip that is there before the pick, or one that reads as a button. One call rides the read: at a boot with storage blocked (`?store=deny`) the menu shows its notice and the chip both. (WORKLOG §116i.)
- [x] **116j** ✅ READ 2026-10-07 (the user: the panel; the first-win route was not seen with a real win and the user let it go on the forced-win check; WORKLOG §116j, "The four reads") — credits: a static panel from the menu's row, and once after the first won run; the libraries' notices join the shipped licence file. Read `batch` (at the sitting): the menu's Credits row opens the panel; read its names and words. Wrong is a name or a licence that is off, a line that reads badly, or a list that doesn't fit the window. The first-win route was checked with a forced win; a real one is seen only by winning a run. (WORKLOG §116j, with six calls: the first is the line that credits Claude.)
- [ ] **116k** — the text scale; step zero measures which boxes overflow at each scale. Read `stop`, at the sitting.
- [ ] **116l** — THE SITTING: Firefox, Electron and the itch draft; the `batch` reads; the exit. Read `stop`.

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

**Carried from §115** (TODO "§115 riders"): whether a reward's taken rows are saved is decided at this kickoff. It needs a Run bump, this phase makes one anyway, and after §118's upload a bump costs players their runs.

## Phase 117.5 — the UI sweep

Charter (inserted 2026-10-04 at §116's first sitting, user-signed): the
layout and polish riders that this round's sittings file against its own
surfaces (the menu, the settings, the chrome column), and whichever older
TODO riders the user picks at the kickoff. The first is the settings
chip's home, a second ribbon in the top right (TODO "§116 riders"). **Why
here:** before §118, so the build that goes to the public web channel is
the swept one. **Risk:** low-medium (wide layout; each move is checked
with the box oracle). **Decision points:** the list, picked by the user at
the kickoff from TODO. **Exit:** every picked item built, and read at one
sitting. **Scope guards:** layout and polish only; nothing that isn't in
TODO at the kickoff; no new mechanism and no sim change.

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
