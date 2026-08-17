# Plan — The event-keyed sound registry

A **§80 feasibility-audit doc**: audit + proposal only, ZERO
implementation (the phase's scope guard). Audited 2026-08-16 at
`50c2c74`; the site inventory below is the measured census at that
commit. Builds on the C5-spec kickoff facts (cluster-5-spec.md
§Miscellaneous investigations) with the §§74–79 deltas folded in.

## Current state — the three trigger mechanisms

Every sound in the game is one of the 22 `SoundKey`s in
[AudioPlayer.ts](../src/audio/AudioPlayer.ts) (pooled overlap-safe
playback, per-key volume + pitch-jitter tables). What *triggers* a
play() is split across three mechanisms of very different quality:

1. **The FX_REGISTRY channel** ([fxRegistry.ts](../src/render/fxRegistry.ts))
   — already table-driven and healthy. 25 `FxKey`s, 15 carrying a
   `sound`; the §Z locked decision (one key = visual + SFX) means
   every ability/status cue is authored in one place.
   `BattleRenderer` plays `fx.sound` at its three driver sites
   (action-phase · chain-hop · status-tick). **This half is NOT the
   problem and this plan does not touch it.**
2. **Hand-written bus.on closures — the event-keyed half.** Exactly
   **7** closures (the kickoff spec's "~30 across 17 files" counted
   every play() site; the fresh census splits it — see the
   correction note below):
   - Page-lifetime, [Game.ts:325](../src/Game.ts) — `recruit:offered`→
     `recruit` · `run:victory`→`win` · `run:defeated`→`lose` ·
     `sector:cleared`→`win` (the 67b flagged reuse).
   - Scene-lifetime, [BattleScene.ts:149](../src/scenes/BattleScene.ts)
     — `unit:died`→`death` (with the inert-neutral filter: walls
     don't cry, camp members do — §75h) · `unit:healed`→`healtick`
     (amount>0 filter, gotcha #80) · `unit:dashed`→`dash`.
3. **Direct UI handler sites** — ~35 play() calls across 14 ui/
   files, overwhelmingly `'click'` (plus RewardScreen/PortScreen
   `pickup`, PromotionScreen's three `healtick` stat-ticks). These
   are *interaction* sounds keyed to DOM handlers, not bus events —
   *deliberately out of scope* for an event-keyed registry (there is
   no bus event to key them to, and "button goes click" needs no
   table).

**Census correction (2026-08-16):** the event-keyed half is much
smaller than the kickoff estimate (7 closures, not ~30) — the
structural gap is less about volume and more about the missing
**coverage guarantee**: nothing enumerates which bus events have
sounds, so a new event ships silent by default and nobody notices
(the exact failure shape FX_REGISTRY's own blind spot has: its boot
asserts check authored-keys-RESOLVE, not coverage — `fx` absent or
`sound?` omitted passes silently).

## The reuse dispositions (known at kickoff, confirmed)

| Reuse | Sites | Disposition |
|---|---|---|
| `win` ×2 | `run:victory` + `sector:cleared` | In-code 67b comment already says "revisit at the feel-read if it wants its own." Registry makes the reuse *visible*; a dedicated `sectorwin` key is a one-line swap later. KEEP for now. |
| `healtick` ×3 | `rejuvenate_tick` fx · `unit:healed` ability heal · PromotionScreen stat-ticks | The fx + ability-heal pair is principled (both are "HP restored"). The PromotionScreen use is a *borrow* (stat counter ticking ≠ healing) — candidate for a dedicated `stattick` cue when the registry lands. |
| `pickup` ×2 contexts | RewardScreen portions · PortScreen purchases | Both are "you gained a thing" — principled reuse, KEEP. |
| `click` everywhere | ~30 UI sites | The UI idiom, not a reuse problem. |

## The gap — uncued bus events

The event catalog ([events.ts](../src/core/events.ts)) holds ~45
event kinds. Sounds cover 7 directly + the ability/status surface via
fx keys. Notable *uncued* events, dispositioned:

- **Candidates** (would plausibly want a cue when authored):
  `battle:started` / `battle:ended` (the win/lose stings fire at RUN
  level; per-battle outcome has no sound of its own) ·
  `deck:cardDrawn` / `deck:reshuffled` / `turn:handRedrawn` (card
  feel) · `turn:unitEmpowered` (the §78d markers gave it a visual;
  no sound) · `event:entered` / `port:entered` (node-arrival
  stings) · `run:bitsChanged` (positive-delta coin cue — overlaps
  `pickup`).
- **Deliberately silent** (movement/bookkeeping — a cue would be
  noise): `unit:moved`/`swapped`/`waited`/`shoved`/`moveDecision`/
  `moveAborted`/`swapAborted` · `objective:*` · `command:applied` ·
  `status:applied`/`expired` (the 27e post-playtest call: apply
  flashes were CUT; a status signals only on ticks) ·
  `unit:attacked`/`missed` (the swing sound rides `action:phase` via
  `melee_swing` — a second cue would double-fire).

The registry's job is to make this disposition **enforced**, not
prose: every event key is either cued or on an explicit silent list.

## The proposal — `EVENT_SOUNDS` mirroring FX_REGISTRY

A renderer/UI-side module (sim never imports it — the sim/render
seam holds; sounds are presentation):

```ts
// src/audio/eventSounds.ts (proposed)
export const EVENT_SOUNDS = {
  'recruit:offered': { sound: 'recruit' },
  'run:victory':     { sound: 'win' },
  'run:defeated':    { sound: 'lose' },
  'sector:cleared':  { sound: 'win' },   // 67b reuse, now visible
  'unit:dashed':     { sound: 'dash' },
  // filtered cues name a predicate — the filter logic stays typed
  // and testable instead of buried in a closure:
  'unit:died':   { sound: 'death', when: 'audibleDeath' },
  'unit:healed': { sound: 'healtick', when: 'positiveAmount' },
} satisfies Partial<Record<GameEventKey, EventSoundCue>>;

/** Every event NOT in EVENT_SOUNDS must be listed here. */
export const SILENT_EVENTS: readonly GameEventKey[] = [
  'unit:moved', /* … the full disposition list above … */
];
```

- **One generic subscriber** replaces the 7 closures: walk
  `EVENT_SOUNDS`, subscribe each key, evaluate `when` predicates
  (typed per-event payload — the two existing filters become named,
  unit-testable functions). Page-vs-scene lifetime: the generic
  subscriber attaches at the page layer; the three battle cues are
  page-safe (their events only fire mid-battle), so the split
  collapses — verify at build time.
- **The coverage pin** (the real payoff, and the piece FX_REGISTRY
  lacks): a test asserting `keys(GameEvents) === keys(EVENT_SOUNDS) ∪
  SILENT_EVENTS`, disjoint. A new event then FAILS `npm test` until
  its author decides cued-or-silent — the §78d `EMPOWER_DISPLAY`
  membership-pin idiom, and the same shape as the §79-post
  font-coverage guard. Optionally the same pass closes FX_REGISTRY's
  blind spot (assert every `*_tick` status key carries a `sound`, or
  is on an explicit visual-only list).
- **Out of scope, stated**: UI click sites stay direct (no bus
  events exist for them); fx-carried sounds stay in FX_REGISTRY (two
  tables, two jobs: "what does this mechanic sound like" vs "what
  does this run-level moment sound like").

**Cost estimate:** small — one module + one generic subscriber + the
pin test + deleting 7 closures; behavior-identical migration,
render/UI-only, no snapshot risk. One commit, maybe two with the
pin. Natural home: Cluster 6's polish sweep (the "final global
feel/SFX sweep" already rides it), or any interstitial — it has no
dependency on the C6 persistent store.

## What Cluster 6 must not break

- **AudioPlayer owns volume policy.** The registry maps event→key
  and nothing else — per-key volume/jitter stay in AudioPlayer's
  tables. C6's options menu will finally call
  `setMasterVolume`/`setMuted` (zero call sites today — the API is
  waiting); it must route through those, not grow per-site volume
  parameters that bypass the tables.
- **The sim/render seam.** `EVENT_SOUNDS` is presentation; sim code
  never imports it, and no sound choice may feed back into sim
  logic. (Same law FX_REGISTRY lives under.)
- **The music bus must be a separate axis** (see
  [plans/music.md](music.md)): when music lands, `setMasterVolume`
  must not become an SFX+music blend — the registry's cues and the
  music bed need independent volume controls, which means the
  AudioPlayer master-volume axis splits BEFORE an options menu
  hard-codes a single slider against it.
- **The coverage pin is a gate, not a suggestion** — same standing
  as the EMPOWER_DISPLAY and font-coverage pins: a C6 feature adding
  events must disposition them, never relax the pin.
