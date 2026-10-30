/**
 * The event-keyed sound registry. Two tables that together disposition every
 * bus event: `EVENT_SOUNDS` (this event plays this key, optionally behind a
 * named predicate) and `SILENT_EVENTS` (this event plays nothing here, and
 * why). A new event in `GameEvents` fails the typecheck and `npm test`
 * (eventSounds.test.ts, the coverage pin, a permanent gate) until its
 * author picks one: no event ships silent by default.
 *
 * Two tables, two jobs: `FX_REGISTRY` (src/render/fxRegistry.ts) answers
 * what a mechanic sounds like (one fx key is the visual and the sound,
 * driven by BattleRenderer); this module answers what a bus event sounds
 * like when no fx key carries it, the run's moments and three battle
 * events. UI interaction sounds (`click`, `pickup`, the promotion ticks, the
 * HUD's scaled `moraleloss` landing) stay direct `play()` sites, keyed to
 * DOM handlers and presentation timelines, not bus events.
 *
 * Presentation only: sim code never imports this, and no sound choice may
 * feed back into sim logic (the rule `FX_REGISTRY` lives under too). The
 * registry maps event → key and nothing else; volume and jitter stay in
 * AudioPlayer's tables (plans/sound-registry.md, "What Cluster 6 must not
 * break").
 */

import type { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import type { AudioPlayer, SoundKey } from './AudioPlayer';

/**
 * The catalog's literal keys. `GameEvents extends Record<string, unknown>`,
 * so a bare `keyof GameEvents` is `string | number`: the index signature
 * swallows the literals and an exhaustiveness check against it checks
 * nothing. The `as` clause drops the index signatures and keeps the rest.
 */
export type GameEventKey = keyof {
  [K in keyof GameEvents as string extends K ? never : number extends K ? never : K]: true;
};

interface EventSoundCue<K extends GameEventKey> {
  readonly sound: SoundKey;
  /** Play only when this holds for the payload. A named, exported function,
   *  so the filter stays typed and unit-testable instead of buried in a
   *  closure. */
  readonly when?: (payload: GameEvents[K]) => boolean;
}

type EventSoundTable = { readonly [K in GameEventKey]?: EventSoundCue<K> };

/**
 * A death cries unless it is scenery's (a neutral with no camp: a wall,
 * half-cover, rubble), since the cry on a crumbling wall would read as a
 * unit dying. A camp member is a unit dying. The payload carries `team` and
 * `campId`, since the dead unit is already out of the world and nothing can
 * look it up.
 */
export function audibleDeath({ team, campId }: GameEvents['unit:died']): boolean {
  return !(team === 'neutral' && campId === null);
}

/** A heal onto a full unit emits a no-op `amount: 0` (gotcha #80); a sound
 *  on a zero-effect event would feel buggy. */
export function positiveAmount({ amount }: GameEvents['unit:healed']): boolean {
  return amount > 0;
}

export const EVENT_SOUNDS = {
  'recruit:offered': { sound: 'recruit' },
  'run:victory': { sound: 'win' },
  'run:defeated': { sound: 'lose' },
  // A victory moment, just not the last one: its own short sting.
  'sector:cleared': { sound: 'sectorwin' },
  'unit:died': { sound: 'death', when: audibleDeath },
  // The ability heal's cue, on the heal op's own event. A healing tile's
  // heal sounds through the `rejuvenate` tick's fx key instead.
  'unit:healed': { sound: 'healtick', when: positiveAmount },
  // Keyed off the leap itself, not an inferred move distance, so a one-cell
  // dash still whooshes. Either team's.
  'unit:dashed': { sound: 'dash' },
} as const satisfies EventSoundTable;

/**
 * Why an event plays nothing from this table:
 * - `bookkeeping` — movement or state plumbing, where a cue would be noise,
 *   or a deliberate cut: a status signals only on its ticks, with no cue on
 *   apply.
 * - `fxChannel` — already audible through `FX_REGISTRY` (BattleRenderer's
 *   action-phase, chain-hop and status-tick drivers); a second cue here
 *   would double-fire.
 * - `uiChannel` — already audible through a direct UI site on a
 *   presentation timeline this table cannot express.
 * - `candidate` — silent, and plausibly wants a cue. Promoting one is
 *   moving it to `EVENT_SOUNDS`.
 */
type SilentReason = 'bookkeeping' | 'fxChannel' | 'uiChannel' | 'candidate';

/** Every event not in `EVENT_SOUNDS`, each with its reason. The annotation
 *  is the tsc half of the coverage pin: a missing key is a missing
 *  property, a key in both tables is an excess property. */
export const SILENT_EVENTS: Readonly<
  Record<Exclude<GameEventKey, keyof typeof EVENT_SOUNDS>, SilentReason>
> = {
  tick: 'bookkeeping',

  'battle:started': 'candidate',
  // The end-of-battle losses land their own `moraleloss` cues (the HUD's
  // end sequence, scaled per landing by `lossCue`); the win and lose stings
  // fire at run level.
  'battle:ended': 'uiChannel',

  'unit:spawned': 'bookkeeping', // a summon's cue rides its fx key
  'unit:moved': 'bookkeeping',
  'unit:swapped': 'bookkeeping',
  'unit:swapAborted': 'bookkeeping',
  'unit:moveAborted': 'bookkeeping',
  'unit:actionHeld': 'bookkeeping',
  'unit:moveDecision': 'bookkeeping',
  'unit:waited': 'bookkeeping',
  'unit:shoved': 'bookkeeping',
  // The swing or whoosh rides `action:phase`, so a miss plays it too.
  'unit:attacked': 'fxChannel',
  'unit:missed': 'fxChannel', // idle until there is a dodge, kept for it
  'unit:chained': 'fxChannel', // `chain_arc`, per hop

  'status:applied': 'bookkeeping',
  'status:ticked': 'fxChannel',
  'status:expired': 'bookkeeping',
  'action:phase': 'fxChannel',

  'objective:set': 'bookkeeping',
  'objective:cleared': 'bookkeeping',
  'command:applied': 'bookkeeping',

  'run:started': 'bookkeeping',
  'run:bitsChanged': 'candidate', // a positive-delta coin cue; overlaps `pickup`
  'run:poolChanged': 'candidate',
  'run:cacheChanged': 'bookkeeping',
  'run:packetUsed': 'candidate',
  'port:entered': 'candidate',
  'event:entered': 'candidate',
  'script:warning': 'bookkeeping', // a dev console line
  'event:pageChanged': 'bookkeeping',
  'rest:entered': 'candidate',
  'reward:offered': 'candidate',
  // PromotionScreen's reveal timeline plays its own per-beat ticks.
  'promotion:pending': 'uiChannel',

  'turn:starting': 'candidate',
  'deck:cardDrawn': 'candidate',
  'deck:cardDiscarded': 'candidate',
  'deck:reshuffled': 'candidate',
  'turn:handRedrawn': 'candidate',
  'turn:unitEmpowered': 'candidate', // it has a visual and no sound
  'turn:grantPassed': 'bookkeeping',
  'turn:resolved': 'candidate',
  'pools:chipped': 'bookkeeping', // telemetry
};

/**
 * Subscribe every `EVENT_SOUNDS` entry, the one generic subscriber. Attach
 * once at the page layer (Game): the three battle cues are page-safe
 * because BattleScene builds the only World on the game bus, so their
 * events cannot fire outside a battle. Returns the detach.
 */
export function attachEventSounds(
  bus: EventBus<GameEvents>,
  audio: Pick<AudioPlayer, 'play'>,
): () => void {
  const offs = (Object.keys(EVENT_SOUNDS) as GameEventKey[]).map((key) =>
    subscribe(bus, audio, key),
  );
  return () => {
    for (const off of offs) off();
  };
}

/** Generic over one key so the cue's predicate and the bus payload stay
 *  correlated (a loop over the key union loses that pairing). */
function subscribe<K extends GameEventKey>(
  bus: EventBus<GameEvents>,
  audio: Pick<AudioPlayer, 'play'>,
  key: K,
): () => void {
  const table: EventSoundTable = EVENT_SOUNDS;
  const cue = table[key];
  if (cue === undefined) return () => {};
  return bus.on(key, (payload) => {
    if (cue.when !== undefined && !cue.when(payload)) return;
    audio.play(cue.sound);
  });
}
