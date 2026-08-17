# Plan — Music

A **§80 feasibility-audit doc**: audit + plan only, ZERO
implementation. Audited 2026-08-16 at `91d73d6`. Companion to
[plans/sound-registry.md](sound-registry.md) (SFX triggering) — this
doc is the music *bed*: looping background tracks, transitions, and
the playback substrate they require.

## Current state

- **No music exists.** The 22 assets in `public/audio/` are all
  one-shot SFX (14 hand-made, 8 deterministic via
  `scripts/gen-sfx.mjs` → `npm run gen:sfx`). The closest things to
  "music" are the `win`/`lose` fanfares — one-shots.
- **The playback layer is HTMLAudioElement** by explicit B6 design:
  [AudioPlayer.ts](../src/audio/AudioPlayer.ts)'s header names Web
  Audio as the upgrade path "if we ever need spatialization, precise
  scheduling, or fade curves." Music needs two of those three.
- **Volume is a single axis** (`masterVolume` × per-key table), and
  `setMasterVolume`/`setMuted` have ZERO call sites — there is no
  volume/mute UI anywhere. Music forces the axis question (below).
- **Autoplay unlock is an assumption**: playback is blocked until
  the first user gesture, and the current design leans on "the first
  trigger is a map-node click — itself a gesture." True for SFX;
  FALSE for music, which should already be playing on the character
  select / map screen before any click.

## What music needs (the audit)

1. **Web Audio for the music lane** — three concrete reasons, all
   HTMLAudioElement dead-ends: gapless looping (the `loop` attribute
   has an audible seam; `AudioBufferSourceNode` loops sample-
   accurately), fade curves (`GainNode` ramps for track-to-track
   crossfades), and ducking (dropping the bed under the win/lose
   fanfares so the existing stings don't collide with a running
   track). **Hybrid is the cheap path**: a new `MusicPlayer` on Web
   Audio, the proven SFX pooling untouched. A full SFX migration to
   Web Audio buys nothing we currently need — don't bundle it.
2. **A music bus** — an independent gain axis. The decision C6's
   options menu forces: two sliders (SFX / music) or three
   (+ master). Either way the split must exist BEFORE the menu
   hard-codes a single slider against `setMasterVolume` (the same
   guardrail recorded in sound-registry.md).
3. **A track state machine** — track selection keyed to game state:
   map/pre-turn vs battle vs boss (encounter `kind` is already on
   the bus via `turn:starting`'s `encounter:{name,kind}`), with
   crossfade on transition and duck-to-sting on
   `run:victory`/`run:defeated`/`sector:cleared`. Scene swaps are
   centralized in `Game` and the needed bus events all exist — no
   new events required. This can (and should) be one small table:
   game-state → trackId, in the EVENT_SOUNDS spirit.
4. **A first-gesture unlock pattern** — start the music lane on the
   first ANY-gesture (pointerdown/keydown once, page-lifetime), not
   on map-node click. If C6's onboarding adds a title screen, its
   "begin" interaction becomes the natural unlock; the pattern
   should not assume one exists.
5. **Assets — the long pole.** Two sourcing routes, both compatible
   with the "dark fantasy on a haunted terminal" identity (locked
   §67):
   - **Licensed/commissioned tracks**: compressed delivery (Opus in
     WebM, ~1–3 MB/track vs ~30 MB wav — the deploy is hand-uploaded
     Pages, so tens of MB of wav is a real cost), and licensing per
     the **§79g precedent**: obligations recorded under `assets/`,
     license text shipped IN THE BUILD
     (`dist/THIRD-PARTY-LICENSES.txt`), compliance verified at
     build time not by convention.
   - **Procedural/tracker chiptune**: the `gen-sfx.mjs` precedent
     scaled up — deterministic generation fits both the aesthetic
     and the repo's no-binary-blobs lean; cost is design time and
     the risk it reads as cheap. A tracker-module player (`.mod`/
     `.xm` via a small JS replayer) is a middle route but imports a
     dependency + its license.
   - No recommendation locked here — this is a design-round call at
     build time, with a listening session as its exit criterion.

**Cost sketch:** MusicPlayer + bus split + state machine ≈ one small
phase (render/UI-only, no snapshot risk); assets are a separate
design round of unknown length. No dependency on the C6 persistent
store EXCEPT settings persistence (below) — the mechanism could land
pre-C6 in an interstitial if wanted.

## What Cluster 6 must not break

- **Two (or three) volume axes, decided before the options menu
  ships.** The menu must not bake in a single master slider; SFX
  and music gains are independent, and mute covers both.
- **Volume/mute settings want the C6 persistent store** (a setting
  that resets every reload reads as broken). The store META-ROADMAP
  names for save/load is the same store — confirm the settings
  schema rides it.
- **Licensing is build-enforced** (§79g standing): any sourced
  track's license ships in `dist/THIRD-PARTY-LICENSES.txt`; a track
  whose license can't ship doesn't ship.
- **The unlock pattern must survive onboarding reflow**: if C6 adds
  a title/tutorial flow, it owns the first gesture — the music
  start must key on "first gesture, whatever it is," never on a
  specific screen's specific button.
- **Ducking owns the sting seam**: the win/lose/sector fanfares stay
  SFX (sound-registry.md's table); music ducks under them. C6's
  final feel sweep must not convert the stings into music-lane
  tracks — two lanes, two jobs.
