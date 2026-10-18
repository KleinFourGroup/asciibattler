/**
 * The renderer's FX registry: what an FX key means. The sim carries opaque key
 * strings (`AbilityDef.fx` per timeline phase, `StatusDef.fx` per lifecycle
 * moment) and never reads them. This module maps a key to an `FxDescriptor`;
 * at fire time BattleRenderer's driver supplies every live parameter (sprite
 * positions, team color, flight time) from the event and the world, and turns
 * the descriptor into sprite, camera and sound calls. It is the render side's
 * twin of the EffectOp union: data, not closures, a closed and typed set of
 * channels resolved through one map.
 *
 * One key drives both the visual and the sound, so a new status or mechanic
 * authors a single key and gets the whole cue; hence `sound` sits on the
 * descriptor beside the visual channels. An ability heal's sparkle has no key:
 * it rides `unit:healed`, whose `healerId` tells an ability's heal from any
 * other.
 *
 * No three.js import, so the resolution and the boot asserts run headless.
 */

import type { SoundKey } from '../audio/AudioPlayer';
import type { AbilityDef } from '../sim/effects/schema';
import type { StatusDef } from '../sim/effects/statusSchema';
import { COLORS } from './palette';
import { statusSymbol } from './statusDisplay';

/** A projectile cosmetic, launched on the action's `release` boundary. */
export interface FxProjectile {
  /**
   * `straight` — a level flight to the captured target cell (the mage bolt).
   * `arc` — a lobbed parabola that homes on the live target sprite (the
   * catapult). The driver times the flight by the caster's `travel` phase and
   * starts it at the caster's live sprite, so the descriptor names only the
   * shape.
   */
  style: 'straight' | 'arc';
}

/** An impact burst at the action's target / blast cell. */
export interface FxBurst {
  /**
   * `explosion` — a team-colored flash and an outward ring of sparks (the
   * mage's detonation). `dud` — a small stone-grey dust puff (the catapult's
   * boulder landing). The driver picks the place and the color from the live
   * event and world.
   */
  style: 'explosion' | 'dud';
}

/**
 * A camera shake. `intensity` is the screen-aligned offset's amplitude in
 * world units; the wobble decays to zero over `durationSeconds`. The
 * magnitude is authored per key, not by the sim, so a heavy lob shakes harder
 * than a bolt.
 */
interface FxShake {
  intensity: number;
  durationSeconds: number;
}

/**
 * A melee lunge: the caster shoves toward its target and snaps back. The
 * driver takes the direction from the two units' cells, so it needs
 * `action:phase.targetId`. The lunge's reach and timing are fixed in
 * BattleRenderer; `distance` overrides the reach (world units), so a heavier
 * weapon can hit harder without a new channel.
 */
export interface FxShove {
  distance?: number;
}

/**
 * A ranged tracer: a `*` bolt flown straight from the caster's live sprite to
 * the target's, so the driver needs `action:phase.targetId`. `size` overrides
 * the bolt's sprite size (1 = a unit glyph's).
 */
export interface FxTracer {
  size?: number;
}

/**
 * A floating number for a status tick's HP change; `kind` picks its style.
 * Each DoT kind is its status's id, so it draws in the status table's hue
 * (`statusColor(kind)`, one source for the pip, the card row and the number)
 * with its prefix glyph (`HITSPLAT_PREFIX`), and the three DoTs stay apart in
 * grey and with the sound off. `heal` is the cyan `+N`. The driver takes the
 * amount from `status:ticked`; an amount of 0 (a HoT on a full unit) draws
 * nothing.
 */
interface FxHitsplat {
  kind: 'burn' | 'bleed' | 'poison' | 'heal';
}

/** Every hitsplat kind the overlay draws: the three strike kinds (`normal`,
 *  `crit`, `miss`, from the strike events) and the four status kinds above. */
export type HitsplatKind = 'normal' | 'crit' | 'miss' | FxHitsplat['kind'];

/** Each kind's prefix glyph, the shape beside the hue, so a number reads as
 *  its kind in grey. A DoT wears its status's symbol (statusDisplay.ts), so
 *  the number, the pip and the card row show one shape; a HoT keeps its `+`;
 *  a strike number is bare, since the crit's size and color and the miss's
 *  word tell them apart. DOM text, never the glyph atlas. A new kind fails
 *  tsc until it picks a prefix, which may be empty. */
export const HITSPLAT_PREFIX: Record<HitsplatKind, string> = {
  normal: '',
  crit: '',
  miss: '',
  heal: '+',
  burn: statusSymbol('burn'),
  bleed: statusSymbol('bleed'),
  poison: statusSymbol('poison'),
};

/** The number as drawn: the kind's prefix and the amount. */
export function hitsplatText(kind: HitsplatKind, amount: number): string {
  return `${HITSPLAT_PREFIX[kind]}${amount}`;
}

/** The DoT kinds, whose hue is the status table's (the kind is the status
 *  id). `heal` is not a status id (rejuvenate's number is `heal`), so it
 *  keeps its CSS cyan. */
export function isDotHitsplatKind(kind: HitsplatKind): kind is 'burn' | 'bleed' | 'poison' {
  return kind === 'burn' || kind === 'bleed' || kind === 'poison';
}

/**
 * A small burst of motes on the unit, for a status tick: an ability heal's
 * twinkle, recolored per key. The driver reads the unit's live sprite
 * position; `color` is a palette hex.
 */
interface FxSparkle {
  color: string;
}

/**
 * A held body tint, for a behavior status's `active` moment. Unlike the
 * fire-once channels above it lasts the status's lifetime: the driver
 * recolors the unit's glyph to `tint` on `status:applied` and, on
 * `status:expired`, back to the latest tint still held or to the team color.
 * The behavior statuses have no tick, so the tint is their one cue on the
 * body (the pip strip shows them too). A palette hex.
 */
interface FxOverlay {
  tint: string;
}

/**
 * The closed set of channels a key resolves to. Every field is optional, and
 * a key lights only the channels it names. A new mechanic adds a channel
 * here, never a new resolution path, as the EffectOp union does on the sim
 * side.
 */
export interface FxDescriptor {
  /** Played when the cue fires. */
  sound?: SoundKey;
  /** Launch a projectile, from the `release` phase the key is authored on. */
  projectile?: FxProjectile;
  /** An impact burst, on the `impact` phase the key is authored on. */
  burst?: FxBurst;
  /** Shake the camera. */
  shake?: FxShake;
  /** Lunge the caster toward its target. */
  shove?: FxShove;
  /** Fly a tracer from the caster to its target. */
  tracer?: FxTracer;
  /** Float a status tick's amount. */
  hitsplat?: FxHitsplat;
  /** Puff recolored motes on the unit. */
  sparkle?: FxSparkle;
  /** Hold a body tint while a status is active. */
  overlay?: FxOverlay;
}

/**
 * The registry. Keys are opaque to the sim; only the renderer and this module
 * know what they mean. `satisfies` checks every entry against `FxDescriptor`.
 */
export const FX_REGISTRY = {
  // The mage bolt: a straight projectile on `release`, timed by the `travel`
  // phase to land on the impact tick, then a team-colored detonation, a boom
  // and a light shake.
  magic_bolt_launch: { projectile: { style: 'straight' } },
  magic_bolt_burst: {
    burst: { style: 'explosion' },
    sound: 'magicboom',
    shake: { intensity: 0.06, durationSeconds: 0.22 },
  },
  // The catapult: a homing arc, then a dust dud, a heavy crash and a big shake
  // (a landing boulder hits hard).
  catapult_launch: { projectile: { style: 'arc' } },
  catapult_burst: {
    burst: { style: 'dud' },
    sound: 'thud',
    shake: { intensity: 0.16, durationSeconds: 0.35 },
  },
  // The single-target strikes: one key carries the motion and its sound. Both
  // ride `action:phase`, which fires on a hit and a miss alike, so a miss plays
  // them too. The melee swing is shared by the melee weapons and the rogue's
  // gambit (authored on the gambit's `windup`, where it deals damage); the
  // ranged shot flies a straight tracer.
  melee_swing: { shove: {}, sound: 'melee' },
  ranged_shot: { tracer: {}, sound: 'shoot' },

  // The afflicters. The cast sound plays once a cast, on the burst's phase,
  // not once a victim, so an area cast doesn't stack it across its targets;
  // the status's own cues (the tick's sparkle, the held tint) carry the rest.
  // The burst is team-colored, so a frost storm flashes the caster's hue and
  // the frozen victims glow cyan.
  vial_throw: { projectile: { style: 'straight' } }, // the thrown flask
  vial_burst: { burst: { style: 'explosion' }, sound: 'vial' }, // glass shatter and splash
  ice_storm_burst: { burst: { style: 'explosion' }, sound: 'freeze', shake: { intensity: 0.08, durationSeconds: 0.25 } },
  hex_burst: { burst: { style: 'explosion' }, sound: 'hex' }, // a confusion warble
  light_ray: { tracer: {}, sound: 'lightray' }, // a beam; blinds on a landed hit
  wail_burst: { burst: { style: 'explosion' }, sound: 'wail', shake: { intensity: 0.1, durationSeconds: 0.3 } }, // the fear scream
  // The hex and the wail deal no damage, so each flies a straight projectile
  // on `release` to say whose burst lands. Silent: the cast sound stays on the
  // burst, at the moment the status lands.
  hex_launch: { projectile: { style: 'straight' } },
  wail_launch: { projectile: { style: 'straight' } },

  // The stormcaller's chain lightning, driven once a hop by `unit:chained`, not
  // by `action:phase`, so the bolt travels jump by jump: each arc flies from
  // the previous victim to the next with its own zap and a slight jolt. Both
  // are gentle, since they stack across a cast's hops, and AudioPlayer's pitch
  // jitter for `chain` turns the quick repeat into a crackle.
  chain_arc: { tracer: {}, sound: 'chain', shake: { intensity: 0.04, durationSeconds: 0.12 } },

  // The shaman's raise: a sound alone, once a cast on `raise_dead`'s impact;
  // the minion's spawn fade is the visual.
  summon_raise: { sound: 'summon' },

  // The periodic statuses: each authors a `_tick` key, fired on every tick of
  // its periodic op as a recolored mote puff, the amount's number and a sound.
  // Each DoT's number is its own kind, drawn in its status's hue with its own
  // prefix (HITSPLAT_PREFIX), which fxRegistry.test.ts pins distinct from the
  // status catalog. A status cues only on its ticks, with no flash on apply:
  // an apply can fire while the sprite is still sliding onto the tile.
  burn_tick: { sparkle: { color: COLORS.TERMINAL_AMBER }, hitsplat: { kind: 'burn' }, sound: 'burn' },
  bleed_tick: { sparkle: { color: COLORS.NEON_RED }, hitsplat: { kind: 'bleed' }, sound: 'bleed' },
  poison_tick: { sparkle: { color: COLORS.TERMINAL_GREEN }, hitsplat: { kind: 'poison' }, sound: 'poison' },
  rejuvenate_tick: {
    sparkle: { color: COLORS.FLOURESCENT_BLUE },
    hitsplat: { kind: 'heal' },
    sound: 'healtick',
  },

  // The behavior statuses' held body tint, put on the glyph on apply and taken
  // off on expiry (FxOverlay).
  frozen_active: { overlay: { tint: COLORS.FLOURESCENT_BLUE } },
  panic_active: { overlay: { tint: COLORS.TERMINAL_AMBER } },
  blind_active: { overlay: { tint: COLORS.TERMINAL_STONE } },
  confusion_active: { overlay: { tint: COLORS.NEON_PURPLE } },
} satisfies Record<string, FxDescriptor>;

/**
 * The channels a reduced-motion player doesn't get: the camera `shake` (the
 * registry's one vestibular trigger), the impact `burst` and the status
 * `sparkle` (particle motion that carries nothing the sound, the number or
 * the tint don't). Kept: `sound` (not motion), `hitsplat` and `overlay`
 * (static information), and `projectile`, `tracer` and `shove`, which show
 * who hits whom, the essential-motion exemption. `satisfies` holds the list
 * to the descriptor's channel names.
 */
export const REDUCED_MOTION_STRIPS = ['shake', 'burst', 'sparkle'] as const satisfies readonly (keyof FxDescriptor)[];

/** A copy of a descriptor without the REDUCED_MOTION_STRIPS channels; the registry's entry is never changed. */
export function stripMotion(fx: FxDescriptor): FxDescriptor {
  const out: FxDescriptor = { ...fx };
  for (const channel of REDUCED_MOTION_STRIPS) delete out[channel];
  return out;
}

/**
 * A key's descriptor, or `undefined` for an unknown key. Every dispatch site
 * in BattleRenderer resolves through here (the action phases, the status
 * moments, the held tint, the chain arc), and `reduced` strips the motion
 * channels. The caller passes the gate's answer (`reducedMotion()`,
 * src/render/motion.ts), so this module stays pure data and a headless pin
 * can walk every key under both readings.
 */
export function fxDescriptor(key: string, reduced = false): FxDescriptor | undefined {
  const fx = (FX_REGISTRY as Record<string, FxDescriptor>)[key];
  return fx !== undefined && reduced ? stripMotion(fx) : fx;
}

/**
 * Every `fx` key a shipped `AbilityDef` names must resolve in the registry, so
 * a typo throws at battle start instead of drawing nothing, as the ability
 * catalog checks each key against its id (`src/config/abilities.ts`).
 * BattleRenderer's constructor calls it.
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

/**
 * `assertFxKeysResolve` for the status catalog: every `fx` key a shipped
 * `StatusDef` names, at any lifecycle moment, must resolve. Called beside it.
 */
export function assertStatusFxKeysResolve(defs: Record<string, StatusDef>): void {
  for (const def of Object.values(defs)) {
    if (!def.fx) continue;
    for (const [moment, key] of Object.entries(def.fx)) {
      if (!key) continue;
      if (!(key in FX_REGISTRY)) {
        throw new Error(
          `fx registry: status '${def.id}' moment '${moment}' references unknown FxKey '${key}'`,
        );
      }
    }
  }
}
