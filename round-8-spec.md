# Round 8 Spec — Foundations

This round was spike-first, as 7.5 was: the shell spike (§110) ran the
build in every shell the store must persist in before the store's shape
locked, and this spec is written over its answers. The charter is
[META-ROADMAP.md](META-ROADMAP.md) §"Round 8 — Foundations" (re-audited
2026-09-26 at the 7.5 close; the recorder added 2026-09-28); the record
behind every line here is [WORKLOG.md](WORKLOG.md) (§Kickoff, §110a–e, and
§110f for this spec's reasons and rejected alternatives); the plan is
[ROADMAP.md](ROADMAP.md).

**Status: SIGNED 2026-09-30** ("Signing everything! 😁"), written at 110f.
Decisions D1–D10 were signed item by item in the drafting conversation
(2026-09-29); D8's stacking reading and the phase list (§111–§118) were
signed with this file.

## Intent (the charter, in the user's words)

The persistent store is the round's keystone, as the Rule vocabulary was
Cluster 3's: designed once, with its four consumers known (save/load,
settings, achievements, tutorial seen-flags), and everything that hangs off
it built after it. At the round's close the web build goes up on itch.io
as an alpha, the channel for early players that an unsigned EXE can't be
(the user, 2026-09-26).

The first ten minutes (the user, 2026-09-29): "we want to get the player
into a run quickly. Rather, with minimal friction. Main menu straight into
character select. Everything else is, well, optional." The tutorial is
Round 11's; this round's stand-in is a how-to-play on the itch page.

The recorder (the user's ask, 2026-09-27): video files of battles, events
and full runs, because their current recording process is cumbersome with
their accessibility tools. It runs in the background while they work, never
takes focus, records none of their own audio, and plays nothing aloud.

## What the spike settled (§110, read 110a–e)

1. **The store can be read synchronously at boot in all three shells**
   (110b): `localStorage` on the web and inside itch's iframe; under
   Electron the preload asks main for the file's text with a synchronous
   message before any page script runs (`window.shellStore.initial`). The
   read ran before the game mounted anything. So the boot keeps its shape:
   the store's module is the first static import of `main.ts`, ahead of the
   config loaders that bake prose at module evaluation.
2. **Electron** (110a): `dist/` boots under `file://` and under a
   privileged `app://` scheme; `app://` is the default, since it gives the
   page a real origin. The store is a JSON file under `userData`
   (`%APPDATA%\ASCIIbattler`), written to a temporary file and renamed into
   place; a fresh profile reads empty. The measurement box needs nothing
   (Electron fetches its binary on first run).
3. **itch, in Firefox 156** (110e, the user's read): the store survives a
   reload, a closed tab and a browser restart. It is partitioned by the
   itch page: the game's direct URL reads empty. The game's origin is
   `https://html-classic.itch.zone`, which itch's HTML games share, and the
   storage estimate already counted 6.4 MB in use against our ~100 bytes;
   `persisted()` is false.
4. **A store that throws is survivable** (110b): the planted `?spike-deny`
   reported its `SecurityError` on read and write, and the game still
   booted.
5. **The video path is offscreen rendering** (110c): a never-shown window
   renders at 1 fps whatever the switches; offscreen holds 60.01 and
   30.01 fps with no hitches on the hardware GPU, and `--disable-gpu`
   reads as software (WARP). A plain Node script gets a probe's JSON and
   exit code back from a window the user never sees, so an Electron probe
   runner is viable.
6. **Recording checks 1 and 2 pass at 1080p30 and 1080p60** (110d, 110e):
   no frame slot missing (2005 and 4007 slots); every game cue heard (128
   of 128); a tone planted in the page found; nothing reached the speakers
   (0 audible samples, against a muted control that read audible); and an
   outside app's tone, heard by the user, absent from the file. `<audio>`
   routed into Web Audio works under `app://` and `file://`, and the
   AudioContext runs without a gesture.
7. **Check 3 passes at both rates** (110e, the user's read, blind): no lag
   and no sound noticed at 30, 60 or none; the machine's CPU rose 7.3 and
   12.5 points. 60 fps is viable.
8. **The clip "looks great"** (the user). Its three notes go to the
   recorder (D9): the lead-in shows the pre-turn screen fading, the planted
   tone belongs to the test only, and the audio is "a tad off".
9. **The upload zip** (110b): PowerShell 7's `Compress-Archive` writes a
   correct zip, which extracted to a tree hash-identical to the build.
   Windows PowerShell 5.1 writes backslashed entry names, and Git Bash's
   `tar -a` writes a TAR under a `.zip` name.

Held for the round close: Chrome's itch read and the days-later re-open of
the draft, at the browser smoke. Held for Round 12: Electron's missing-CSP
warning (shown only unpackaged).

## Decisions

### D1. One store, in sections with their own versions

- **Sections:** settings · progress (the Escalation unlocks now;
  achievements and tutorial seen-flags later, as seams only) · the run slot
  (the save and its journal) · finished journals.
- **Two read policies.** The run slot is rejected when stale (D2). Settings
  and progress are read leniently: an unknown key is dropped, a missing key
  takes its default, and a bad value resets on its own, so no upload ever
  wipes a player's settings or unlocks.
- **The storage adapter has three cases:** `localStorage` on the Pages
  site; the same inside itch's iframe; the JSON file under Electron's
  `userData`, handed over synchronously by the preload.
- **Keys are namespaced** (`asciibattler:`, as the DEV trace ring's
  `asciibattler:traces:v1` already is). An empty store at any boot is a new
  player. A quota or security error on write means "can't save", told to
  the player, never a crash.
- **Game-layer only.** Fuzz and headless runs never write the store: an
  ESLint rule bans importing the store module from `src/sim|run|bot` and
  `tests/fuzz`, as the `Math.random()` ban works.
- **The web store is best-effort.** Saves stay small, and the player gets
  an export and import of the whole store as a backup, because another itch
  game on the shared origin can clear or crowd our partition. The round-close
  smoke lists the keys visible from our iframe that aren't ours.
- **Two tabs:** a second tab sees that the run is open in another and
  won't continue it.

### D2. The build ID, the version, and what a save is rejected on

- **`BUILD_ID` = the version + the commit,** baked at build time and
  stamped on the store, the saves and the journals. A build from a tree
  with uncommitted changes is stamped `-dirty`, and replay refuses a dirty
  journal.
- **The version** starts at `0.1.0` with this round's itch alpha. The
  middle number goes up at each milestone upload and the last at each
  hotfix, whichever channel (Pages or itch) gets the build. Bumps are made
  with `npm version`, which updates `package.json`, commits and tags, so
  every upload has a git tag. `1.0` is the Steam release, which is also
  where the no-migrations policy ends. The menu shows the version and the
  commit small in a corner.
- **A save is rejected when the save format changed or when loading it
  fails,** not on every build: a hotfix upload keeps the runs in progress.
  The format is `RUN_SCHEMA_VERSION`; loading already refuses unknown
  daemon and character ids (`Run.ts:4290`, `:4344`). A run can therefore
  finish under different numbers than it began with; its journal shows
  that (D4).
- **The guard this rule needs:** a test fingerprints the save's structure
  beside the version, so changing the shape fails `npm test` until the
  version is bumped. Today's tests pin the version number only.
- **The message** says the run was saved by an older version and can't be
  continued, and that settings and unlocks are kept (wording at the build,
  through i18n). The rejected run's journal stays exportable.

### D3. Saving: autosave at every gate, one slot

Roguelike: no manual saves, one run slot, an autosave at every gate. A tab
close is how a web player quits, and only an autosave survives it. Closing
mid-battle resumes at the gate before that battle, with the fight already
seen. The random streams are keyed per occurrence, so the same choices
replayed give the same results and nothing can be re-rolled by reloading;
the edge is knowledge only, and it is accepted. A run's end
empties the slot and moves its journal to the finished journals.

Save/load keeps the charter's two oracles: the chaos driver (random legal
`RunCommand`s in every phase, the occupancy invariant and a snapshot
round-trip at every phase transition) and the continuation check (a run
continued live from a gate and the same run continued from its reloaded
snapshot must end the same).

### D4. The run journal

- **Contents:** the seed, every `RunCommand`, the battles' command traces,
  stamped with the `BUILD_ID` and the config hash.
- **Segments:** a new segment opens at every load, stamped with that
  build and starting from the loaded snapshot, so each segment replays on
  its own commit. The continuation check uses the same seam.
- **Wall-clock time per command,** as metadata for pacing a recorded
  replay and for telemetry; never fed to the sim.
- **Size:** a whole run's bytes are measured at the journal phase's step
  zero, before the store's budget is set; how many finished journals are
  kept is decided then.
- **Passive:** recording never perturbs determinism.
- **Consumers:** telemetry tier 1's export (D5), the chaos driver's repro,
  the continuation check, and the recorder's full runs (a journal replayed
  offscreen, D9).

### D5. Telemetry tier 1

A run's journal downloads as a `.json` file, from the run's end screen and
the menu. Players send it wherever they like; the itch boards serve until
the game has a proper presence. No ingest server (tier 2 only on
demonstrated need), no live transport, no third-party analytics.

### D6. The menu

- **The boot screen.** Rows: Continue (first, when a save exists) · New run
  (straight to character select) · Settings · Credits (the font licences
  and the names) · a seed field. Achievements stays hidden until Round 11
  gives it content.
- **Seeded runs count toward nothing** (no Escalation unlock, and later no
  achievement), because a known seed can be scouted. The run carries a
  `seeded` flag.
- **Dev entry points skip it:** a dev dial in the URL (`?bp=` fixtures, the
  recorder, the probe kit's `go()`, the run driver) boots straight into its
  scene.
- **The first click is the audio unlock gesture** (`plans/music.md`).

### D7. Settings

- **Volume: three levels stored** (master, SFX, music) from day one, and a
  slider only where there is sound behind it: master and SFX until music
  ships. The split needs no Web Audio: a sound's volume is master × SFX ×
  its own level.
- **The palette swaps on reload,** as the locale does, because a live swap
  would have to re-stamp five surfaces (sprite and mark colours set at
  spawn, the FX table built at load, the HP gradient and the status hues as
  raw hex). It carries the camp unit's status pip (TODO).
- **The colourblind palette's acceptance test:** a numeric check of colour
  distance between named pairs under simulated colour blindness, plus the
  user's eye. Which deficiencies it covers is decided at the settings
  kickoff, once the reads still carried by hue alone are listed; the team
  channel is already a shape.
- **The rest of the charter's list:** the in-game rebind UI (labels from
  the registry, the two labels read once made live, a conflict check), the
  default playback speed, the aura-FX mode, the locale, the reduced-motion
  override, the shake policy, the text scale; and the store's export and
  import (D1).

### D8. Escalation, the difficulty ladder

- **A ladder of five cumulative levels.** Progress is per character; the
  levels mean the same for every character (DESIGN: the characters are
  similar in difficulty). Winning level N with a character unlocks N+1 for
  that character. The picker is on character select, hidden until
  Escalation 1 is unlocked. Upward only; an easier setting is a Round 11
  accessibility candidate. Number levers only; rule levers (more elites, a
  boss's extra trick, a tool taken away) wait for Round 10's content. The
  charter's "per-speed enable" and "focus-tile switch" are struck.
- **The table:**

  | Level | Adds |
  |---|---|
  | 1 | enemy level budget +10% |
  | 2 | enemy wave +10% |
  | 3 | bits −25% |
  | 4 | enemy level budget +10% (+20% in all) |
  | 5 | enemy wave +10% (+20% in all) |

- **"Enemy wave" raises three things by the same factor:** the wave's head
  count, its level budget, and the enemy's morale pool. Under the casualty
  rule a bigger wave on the same budget spreads the same levels over more
  bodies, each worth a point of enemy morale, so it could come out easier;
  scaling the budget and the pool with it keeps each body as strong and the
  fight as long, and the pacing targets hold. This needs one new per-run
  multiplier, enemy morale on the encounter's pool, shaped like the other
  three.
- **Stacking:** a repeated lever adds (+10%, then +20%); different levers
  multiply, so the wave lever never changes a body's strength and the
  budget lever is exactly its percentage. At Escalation 5: head count
  ×1.2, level budget ×1.2 × 1.2 = ×1.44, enemy morale ×1.2, bits ×0.75.
  The numbers are placeholders, and the player-facing text describes each
  level without percentages, since the mix of adding and multiplying is
  not intuitive to a general audience (the user, at signing).
- **Saved:** the level goes in the RunSnapshot (a Run bump); the
  multipliers are derived from the level and the table, never stored.
  Today `Run.fromJSON` resets the multipliers to their defaults
  (`Run.ts:4330-4333`).
- **Escalation off is byte-identical to today:** every multiplier absent
  resolves to exactly 1, the X1 discipline.
- **Known for the kickoff** (WORKLOG §110f): counts round to whole units,
  so +10% adds no enemy to some waves; 5 of the 34 authored waves carry a
  level cap, where the budget lever can saturate; the pool's rounding.
- **The name, Escalation:** the fights escalate, and the tech half is
  privilege escalation.

### D9. The background recorder

- **Offscreen rendering; 60 fps for battles,** 30 fps or a lower bitrate
  for full runs (the 110e clip is about 1.5 GB an hour at 60).
- **ffmpeg is a system install,** named in the README as an external
  requirement and checked at start with a clear message.
- **Clips go to a gitignored `clips/`.**
- **Every recording boots a fresh, pinned profile,** so a before/after pair
  differs by its commit and never by a saved setting.
- **From the spike:** backpressure in main (the backlog peaked at 265 MB at
  60 fps); the lead-in trimmed, the audio aligned by content, the frame
  marker shown only during that lead-in; no planted tone; the explorer
  panel hidden; the page muted as a second guarantee.
- **Inputs:** a board-explorer fixture, a seed, and before/after at two
  commits side by side; full runs from a journal once D4 lands.
- **Open for its kickoff:** whether record mode lives in `AudioPlayer`
  (shipped bytes) or stays a reach-in in the development-mode build the
  recordings are made from; the audio-offset A/B by ear; the heal-tick
  cues that were late or lost in one dry-run recording, measured in normal
  play against the capture.

### D10. The pane probe kit and the Electron runner

- **The kit as chartered,** built before the menu and settings: `ready()`,
  `go(query)`, `frame()`, `pixels(rect)`, a canvas-size check on every
  read, and the whole-run driver.
- **The runner: yes, thin,** over what §110 built (`--probe`, `--url`,
  `--size`, one JSON line on stdout, exit codes), calling the same
  `__probe`, in offscreen mode when frames must run in real time.
- **The kit's three pre-registered criteria are counted per pane session,**
  with runner sessions counted apart, because scripted probes moving to the
  runner would otherwise lower pane papercuts by lowering pane use.

## Scope guards

From the charter: no achievements or tutorial content (the store's
consumer seams only); no unlock content mapping (Round 10); no music.
Added here:

- no migrations (reject-stale until 1.0); no manual saves; no mid-battle
  save;
- no music slider; no ingest server;
- Escalation: no rule levers, nothing easier than today, no balance
  retuning beyond the table;
- the Electron build stays internal: no packaging, signing or CSP work
  (Round 12); the recorder and the runner are dev tools;
- the web: Firefox and Chrome tested; Safari untested (no Apple device);
- the journal, the store and the recorder never feed the sim; Escalation
  off byte-identical to today;
- no player-facing yaw or glyph scale (Round 11), no camera row (7.5, D7).

Snapshot bumps: Run bumps are expected at §115–§117 (the level, the
`seeded` flag, whatever save/load's resolver needs), each predicted by its
phase's cut; no World bump is expected. The fuzz smoke fires on the phases
that touch `src/run`, `src/config` or `tests/fuzz`.

## Exit

- A run saved at any gate reloads byte-faithfully: the chaos driver and the
  continuation check green.
- Settings persist across reloads in all three shells.
- The menu is the boot screen, and the dev entry points skip it.
- Escalation 1–5: each level harder than the one before on paired
  same-seed board runs; Escalation off reproduces the signed sheet exactly.
- A player can download a run's journal, and it replays on its build.
- The recorder writes clips of scenes, seeds, before/after pairs and full
  runs; its exit re-runs §110's instruments (the frame-rate probe, the
  analyzer).
- The probe kit lands before the menu; its three criteria are counted at
  the close.
- The public web channel is open: `0.1.0` on itch after the browser smoke
  (Firefox; Chrome with its itch read and the days-later re-open), with a
  how-to-play on the itch page.

## Marked uncertainty (open at signing)

- **Whether other itch games share our partition** (inferred from the
  6.4 MB in use); the smoke's foreign-key list answers it.
- **Chrome on itch:** from memory it partitions as Firefox does; read at
  the smoke. **Safari:** untested; an empty store is a new player.
- **The journal's size,** and how many finished journals to keep.
- **The palette's deficiency coverage.**
- **Whether a 10% step is big enough for the box to tell levels apart** on
  paired seeds at the protocol's size. If it isn't, the close's criterion
  fails on noise rather than design, and the step size comes back to the
  user.
- **The recordings' audio offset** (about 50 ms, estimated, unmeasured) and
  **the late heal-tick cues** (normal play or the capture, unmeasured).
- **The machine's CPU rise under recording** beyond what the two process
  trees account for (110e), untraced.

## The build phases

Entered in ROADMAP at 110f and signed with this file. Each is cut at its
own kickoff against the code as it is then, with its reads.

- **§111** the background recorder (D9)
- **§112** the pane probe kit and the Electron runner (D10)
- **§113** the store and the build ID (D1, D2)
- **§114** the run journal and its export (D4, D5)
- **§115** save/load and mid-run resume, with the chaos driver and the
  continuation check (D3)
- **§116** the menu and settings (D6, D7)
- **§117** Escalation and the unlock mechanism (D8)
- **§118** the public web channel, then the round close (the board
  re-run, the browser smoke)
