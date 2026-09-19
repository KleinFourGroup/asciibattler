/**
 * The event-keyed sound registry (§104). Two tables that together
 * disposition EVERY bus event: `EVENT_SOUNDS` (this event plays this key,
 * optionally behind a named predicate) and `SILENT_EVENTS` (this event
 * plays nothing here, and WHY). A new event in `GameEvents` fails the
 * typecheck AND `npm test` (eventSounds.test.ts — the coverage pin, a
 * permanent gate) until its author picks one: no event ships silent by
 * default.
 *
 * Two tables, two jobs: FX_REGISTRY (src/render/fxRegistry.ts) answers
 * "what does this MECHANIC sound like" (one FxKey = visual + SFX, driven by
 * BattleRenderer); this module answers "what does this run-level MOMENT
 * sound like". UI interaction sounds (`click`, `pickup`, the promotion
 * ticks, the HUD's scaled `moraleloss` landing) stay direct `play()` sites —
 * they are keyed to DOM handlers / presentation timelines, not bus events.
 *
 * Presentation only: sim code never imports this, and no sound choice may
 * feed back into sim logic (the law FX_REGISTRY lives under). The registry
 * maps event → key and nothing else — volume + jitter stay in AudioPlayer's
 * tables (plans/sound-registry.md "What Cluster 6 must not break").
 */

import type { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import type { AudioPlayer, SoundKey } from './AudioPlayer';

/**
 * The catalog's LITERAL keys. `GameEvents extends Record<string, unknown>`,
 * so a bare `keyof GameEvents` is `string | number` — the index signature
 * swallows the literals and an exhaustiveness check against it checks
 * nothing. The `as` clause drops the index signatures and keeps the rest.
 */
export type GameEventKey = keyof {
  [K in keyof GameEvents as string extends K ? never : number extends K ? never : K]: true;
};

export interface EventSoundCue<K extends GameEventKey> {
  readonly sound: SoundKey;
  /** Play only when this holds for the payload. A NAMED, exported function —
   *  the filter stays typed and unit-testable instead of buried in a closure. */
  readonly when?: (payload: GameEvents[K]) => boolean;
}

type EventSoundTable = { readonly [K in GameEventKey]?: EventSoundCue<K> };

/**
 * A death cries unless it is an INERT neutral's: walls have HP plumbed, but
 * the combat death cry would read as a unit dying rather than a wall
 * crumbling (C1b). An ACTIVE neutral — a camp member, `campId` on the
 * payload; the dead unit is already spliced out, so no lookup — IS a unit
 * dying (§75h).
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
  // A victory moment, just not the last one: its own short sting (104c),
  // `win`'s little sibling — it borrowed `win` itself from 67b until then.
  'sector:cleared': { sound: 'sectorwin' },
  'unit:died': { sound: 'death', when: audibleDeath },
  // D7.C — the ABILITY-heal cue (the heal mechanic's own event). The
  // healing-TILE chip rides the `rejuvenate` tick fx instead (27d).
  'unit:healed': { sound: 'healtick', when: positiveAmount },
  // N1 — keyed off the LEAP itself, not an inferred move distance, so a
  // one-cell dash still whooshes. Team-agnostic.
  'unit:dashed': { sound: 'dash' },
} as const satisfies EventSoundTable;

/**
 * Why an event plays nothing from this table:
 * - `bookkeeping` — movement / state plumbing; a cue would be noise, or the
 *   event is a deliberate cut (27e: status apply flashes were CUT — a status
 *   signals only on its ticks).
 * - `fxChannel` — already audible through FX_REGISTRY (BattleRenderer's
 *   action-phase / chain-hop / status-tick drivers); a second cue here
 *   would double-fire.
 * - `uiChannel` — already audible through a direct UI site on a
 *   presentation timeline this table cannot express.
 * - `candidate` — silent TODAY, and plausibly wants a cue: the Round 11
 *   feel sweep's worklist. Promoting one = move it to EVENT_SOUNDS.
 */
export type SilentReason = 'bookkeeping' | 'fxChannel' | 'uiChannel' | 'candidate';

/** Every event NOT in EVENT_SOUNDS, each with its reason. The annotation is
 *  the tsc half of the coverage pin: a missing key is a missing property, a
 *  key in BOTH tables is an excess property. */
export const SILENT_EVENTS: Readonly<
  Record<Exclude<GameEventKey, keyof typeof EVENT_SOUNDS>, SilentReason>
> = {
  tick: 'bookkeeping',

  'battle:started': 'candidate',
  // The end-of-battle losses land their own `moraleloss` cues (the HUD's
  // end sequence, scaled per landing by `lossCue`); the win / lose stings
  // fire at RUN level.
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
  // The swing / whoosh rides `action:phase` (so a MISS plays it for free).
  'unit:attacked': 'fxChannel',
  'unit:missed': 'fxChannel',
  'unit:chained': 'fxChannel', // `chain_arc`, per hop

  'status:applied': 'bookkeeping', // 27e — the apply flash was CUT
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
  'event:pageChanged': 'bookkeeping',
  'reward:offered': 'candidate',
  // PromotionScreen's reveal timeline plays its own per-beat ticks.
  'promotion:pending': 'uiChannel',

  'turn:starting': 'candidate',
  'deck:cardDrawn': 'candidate',
  'deck:cardDiscarded': 'candidate',
  'deck:reshuffled': 'candidate',
  'turn:handRedrawn': 'candidate',
  'turn:unitEmpowered': 'candidate', // §78d gave it a visual; no sound
  'turn:grantPassed': 'bookkeeping',
  'turn:resolved': 'candidate',
  'pools:chipped': 'bookkeeping', // telemetry (89a)
};

/**
 * Subscribe every EVENT_SOUNDS entry — the ONE generic subscriber. Attach
 * once at the PAGE layer (Game): the three battle cues are page-safe
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

/** Generic over ONE key so the cue's predicate and the bus payload stay
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
