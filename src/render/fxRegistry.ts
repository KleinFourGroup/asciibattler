/**
 * Phase Z — the renderer-owned FX registry. The sim authors only an opaque
 * `FxKey` string (on `AbilityDef.fx`, per timeline phase); it passes the key
 * through inertly and never interprets it. The renderer owns THIS mapping —
 * `FxKey → FxDescriptor` — and at fire time supplies every dynamic parameter
 * (sprite positions, team color, flight time) from the live event + world. That
 * mirrors the EffectOp union's "data, not deserialized closures" discipline on
 * the render side: a closed, typed set of channels, resolved through one map.
 *
 * Pure data — NO three.js import — so the registry resolution + the boot assert
 * are headless-testable (the renderer-side driver in `BattleRenderer` is what
 * turns a resolved descriptor into SpriteRenderer / AudioPlayer calls).
 *
 * Z decision (locked with the user): one key drives BOTH visual AND sound, so a
 * later status / mechanic authors a single key and gets the whole cue. Hence
 * `sound` lives on the descriptor alongside the visual channels.
 *
 * SCOPE (Z1): the channels needed to re-home the mage bolt + the catapult lob —
 * `projectile` (the `release`-boundary launch) and `burst` (the `impact`
 * detonation / dust) + `sound`. Camera `shake` lands in Z2; the melee shove /
 * ranged tracer / heal sparkle channels land in Z3 as those verbs migrate off
 * their `unit:attacked` / `unit:healed` dispatch.
 */

import type { SoundKey } from '../audio/AudioPlayer';
import type { AbilityDef } from '../sim/effects/schema';

/** A projectile cosmetic, launched on the action's `release` boundary. */
export interface FxProjectile {
  /**
   * `straight` — a level tracer flown to the captured target cell (the mage
   * bolt). `arc` — a lobbed parabola that homes the live target sprite (the
   * catapult). The driver reads the flight time off the caster's `travel` phase
   * and the from/to off the live sprites, so the descriptor only names the shape.
   */
  style: 'straight' | 'arc';
}

/** An impact burst at the action's target / blast cell. */
export interface FxBurst {
  /**
   * `explosion` — a team-colored flash + outward spark ring (the mage's
   * detonation). `dud` — a small neutral-stone dust puff (the catapult boulder
   * cratering). The driver picks the location + color from the live event/world.
   */
  style: 'explosion' | 'dud';
}

/**
 * A camera shake (§Z, the first non-sprite channel — the proof the registry can
 * carry more than sprites). `intensity` is the screen-aligned offset amplitude
 * in world units; the wobble decays to zero over `durationSeconds`. Authored
 * per key (the locked decision: shake magnitude is an fx-registry parameter, not
 * a sim concern), so a heavy lob shakes harder than a bolt.
 */
export interface FxShake {
  intensity: number;
  durationSeconds: number;
}

/**
 * The closed set of channels an `FxKey` resolves to. Every field optional: a
 * key lights up only the channels it names (the mage `release` key is a bare
 * projectile; its `impact` key is a burst + a sound). New mechanics add new
 * channels here, never a new resolution path — the same discipline the EffectOp
 * union holds on the sim side.
 */
export interface FxDescriptor {
  /** Unified SFX — played when the cue fires (the Z VFX+SFX decision). */
  sound?: SoundKey;
  /** Launch a projectile (on the `release` phase the key is authored on). */
  projectile?: FxProjectile;
  /** Spawn an impact burst (on the `impact` phase the key is authored on). */
  burst?: FxBurst;
  /** Shake the camera (Z2 — heavy impacts; the registry's first non-sprite channel). */
  shake?: FxShake;
}

/**
 * The registry. Keys are opaque to the sim; only the renderer + this module
 * know what they mean. `satisfies` validates every entry against `FxDescriptor`
 * while preserving the literal key set for `FxKey`.
 */
export const FX_REGISTRY = {
  // The mage bolt (`magic_bolt`): a straight tracer carved out of the wind-up,
  // then a team-colored detonation + boom + a light shake on impact.
  magic_bolt_launch: { projectile: { style: 'straight' } },
  magic_bolt_burst: {
    burst: { style: 'explosion' },
    sound: 'magicboom',
    shake: { intensity: 0.06, durationSeconds: 0.22 },
  },
  // The catapult lob (`catapult_shot`): a homing arc, then a dust dud + thunk +
  // a heavier shake on impact (a landing boulder hits hard). `shoot` is a
  // placeholder until §31's dedicated catapult SFX.
  catapult_launch: { projectile: { style: 'arc' } },
  catapult_burst: {
    burst: { style: 'dud' },
    sound: 'shoot',
    shake: { intensity: 0.16, durationSeconds: 0.35 },
  },
} satisfies Record<string, FxDescriptor>;

/** The closed set of authored keys — the §30 editor's option list. */
export type FxKey = keyof typeof FX_REGISTRY;

/** Resolve a key to its descriptor, or `undefined` for an unknown key. */
export function fxDescriptor(key: string): FxDescriptor | undefined {
  return (FX_REGISTRY as Record<string, FxDescriptor>)[key];
}

/**
 * Boot assert (§Z) — every `fx` key referenced by a shipped `AbilityDef` must
 * resolve in the registry, so a typo fails loudly at battle start rather than
 * rendering nothing. Mirrors the ability catalog's key/id boot-check
 * (`src/config/abilities.ts`). Call once when the renderer is constructed.
 */
export function assertFxKeysResolve(defs: Record<string, AbilityDef>): void {
  for (const def of Object.values(defs)) {
    if (!def.fx) continue;
    for (const [phase, key] of Object.entries(def.fx)) {
      if (!key) continue;
      if (!(key in FX_REGISTRY)) {
        throw new Error(
          `fx registry: ability '${def.id}' phase '${phase}' references unknown FxKey '${key}'`,
        );
      }
    }
  }
}
