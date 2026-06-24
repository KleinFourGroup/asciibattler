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
 * SCOPE: Z1 added `projectile` (the `release`-boundary launch) + `burst` (the
 * `impact` detonation / dust) + `sound` (mage bolt / catapult lob); Z2 added the
 * camera `shake`; Z3 adds the melee `shove` + the ranged `tracer` as the
 * single-target strikes migrate off their `unit:attacked` / `unit:missed`
 * dispatch (the swing now rides `action:phase`, which fires on hit AND miss). The
 * heal sparkle stays on `unit:healed` — its data event already carries the healed
 * unit's id + the ability-vs-tile distinction the sparkle gate needs.
 */

import type { SoundKey } from '../audio/AudioPlayer';
import type { AbilityDef } from '../sim/effects/schema';
import type { StatusDef } from '../sim/effects/statusSchema';
import { COLORS } from './palette';

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
 * A melee lunge (§Z3 — the sword/club/katana/whip swing, and the rogue gambit).
 * The caster shoves toward its target and snaps back; the driver reads the
 * direction off the live cells and needs `action:phase.targetId` to know which
 * way. The lunge geometry (distance, in/out timing) is fixed render tuning in
 * `BattleRenderer`; `distance` optionally overrides the default reach (world
 * units) so a heavier weapon can hit harder without a new channel.
 */
export interface FxShove {
  distance?: number;
}

/**
 * A ranged tracer (§Z3 — the bow shot). A `*` bolt flies straight from the
 * caster's live sprite to the target's; the driver needs `action:phase.targetId`
 * to locate the destination. `size` optionally overrides the tracer glyph's
 * per-sprite scale (1 = full unit-glyph size).
 */
export interface FxTracer {
  size?: number;
}

/**
 * A floating hitsplat number (27e — the status tick's HP delta). `kind` picks
 * the existing hitsplat style: `burn` an amber damage number (DoTs), `heal` a
 * cyan `+N` (HoTs). The driver supplies the amount off the `status:ticked`
 * event; an amount of 0 (a HoT onto a full unit) draws nothing.
 */
export interface FxHitsplat {
  kind: 'burn' | 'heal';
}

/**
 * A small mote burst ON the unit (27e — the status apply flash / per-tick
 * pulse). Reuses the F5 heal-sparkle particle lane, recolored per status so a
 * burning unit puffs amber embers, a poisoned one green, etc. The driver reads
 * the unit's live sprite position; `color` is a palette hex.
 */
export interface FxSparkle {
  color: string;
}

/**
 * A PERSISTENT body-tint overlay (28 — the held behavior statuses' `active`
 * moment). Unlike every fire-once channel above, this one is ON for the whole
 * lifetime: the driver recolors the unit's glyph to `tint` on `status:applied`
 * and restores its team color on `status:expired`. The behavior statuses
 * (frozen/blind/panic/confusion) have no per-tick pulse, so this held recolor IS
 * their visibility — a frozen unit glows ice, a confused one chaos-purple. A
 * palette hex.
 */
export interface FxOverlay {
  tint: string;
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
  /** Lunge the caster toward its target (Z3 — the melee swing). */
  shove?: FxShove;
  /** Fly a tracer bolt from caster to target (Z3 — the ranged shot). */
  tracer?: FxTracer;
  /** Float a hitsplat number on a status tick (27e — the DoT/HoT amount). */
  hitsplat?: FxHitsplat;
  /** Puff a recolored mote burst on the unit (27e — the status apply/tick cue). */
  sparkle?: FxSparkle;
  /** Hold a persistent body tint while a status is active (28 — the `active` moment). */
  overlay?: FxOverlay;
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
  // Z3 — the single-target strikes. One key carries the swing + its whoosh
  // (the Z VFX+SFX decision); both ride `action:phase`, so a MISS plays them
  // for free (the phase fires on hit and miss alike). The melee swing is shared
  // by the four weapons + the rogue gambit (authored on the gambit's `windup`,
  // where it deals damage); the bow flies a straight tracer.
  melee_swing: { shove: {}, sound: 'melee' },
  ranged_shot: { tracer: {}, sound: 'shoot' },

  // 27e — the periodic statuses. Each status authors a `_tick` key: the
  // per-second pulse → a recolored mote puff + the damage/heal hitsplat number.
  // Only `burn`/`rejuvenate` carry a `sound` — they re-home the retired fire/heal
  // tile-chip cues (the §Z "one key = visual + SFX" model); bleed/poison get
  // their SFX at §31. Sparkle colors: burn amber embers, bleed blood-red, poison
  // toxic-green, rejuvenate heal-cyan (the DoT/HoT numbers all reuse the
  // `burn`/`heal` hitsplat styles — the sparkle color distinguishes them). The
  // apply-flash (`_apply`) keys were dropped post-playtest (the cue fired
  // mid-lerp onto a tile); a status now signals only on its ticks.
  burn_tick: { sparkle: { color: COLORS.TERMINAL_AMBER }, hitsplat: { kind: 'burn' }, sound: 'burn' },
  bleed_tick: { sparkle: { color: COLORS.NEON_RED }, hitsplat: { kind: 'burn' } },
  poison_tick: { sparkle: { color: COLORS.TERMINAL_GREEN }, hitsplat: { kind: 'burn' } },
  rejuvenate_tick: {
    sparkle: { color: COLORS.FLOURESCENT_BLUE },
    hitsplat: { kind: 'heal' },
    sound: 'healtick',
  },

  // 28 — the behavior statuses' held-state body tint (the `active` moment). No
  // per-tick pulse exists for these, so the persistent recolor IS the
  // visibility: frozen ice-cyan, panic fear-amber, blind blinded-grey, confusion
  // chaos-purple. The driver swaps the unit's glyph color on apply and restores
  // the team color on expire.
  frozen_active: { overlay: { tint: COLORS.FLOURESCENT_BLUE } },
  panic_active: { overlay: { tint: COLORS.TERMINAL_AMBER } },
  blind_active: { overlay: { tint: COLORS.TERMINAL_STONE } },
  confusion_active: { overlay: { tint: COLORS.NEON_PURPLE } },
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

/**
 * Boot assert (27e) — the status-lifecycle sibling of `assertFxKeysResolve`:
 * every `fx` key a shipped `StatusDef` references (per lifecycle moment —
 * `applied`/`ticked`/`expired`/`active`) must resolve in the registry, so a
 * typo'd status cue fails at battle start, not silently on screen. Called
 * alongside the ability check when the renderer is constructed.
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
