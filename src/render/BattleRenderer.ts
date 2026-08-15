import * as THREE from 'three';
import type { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import type { GridCoord } from '../core/types';
import type { World } from '../sim/World';
import type { ObjectiveTarget } from '../sim/objective';
import { isInertNeutral, type Unit } from '../sim/Unit';
import type { SpriteHandle, SpriteRenderer } from './SpriteRenderer';
import { aboveAnchor } from './anchor';
import type { PickCandidate } from './pick';
import type { UnitOverlayHandle, UnitOverlayLayer } from './UnitOverlayLayer';
import type { TerrainRenderer } from './TerrainRenderer';
import type { Renderer } from './Renderer';
import type { AudioPlayer } from '../audio/AudioPlayer';
import { COLORS } from './palette';
import { colorForTeam, spriteColorForUnit } from './spriteColor';
import { SpriteAnimator } from './animation/SpriteAnimator';
import {
  assertFxKeysResolve,
  assertStatusFxKeysResolve,
  fxDescriptor,
  type FxBurst,
  type FxProjectile,
  type FxShove,
  type FxTracer,
} from './fxRegistry';
import { TICK_RATE, ticksToSeconds } from '../config';
import { ABILITY_DEFS } from '../config/abilities';
import { STATUS_DEFS } from '../config/statuses';
import { MOVE_ACTION_ID } from '../sim/actions/MoveAction';
import { SPAWN_ACTION_ID } from '../sim/actions/SpawnAction';
import { footprintOf } from '../sim/occupancy';
import { isDestructibleNeutral } from '../config/units';
import { readUnitStatuses } from '../sim/statusReadout';
import { SPAWN } from '../config/spawn';
import { statusColor } from './statusDisplay';

/**
 * The simulation/render seam. Subscribes to sim events and turns them into
 * SpriteRenderer + UnitOverlayLayer calls — sim never imports from render.
 * New events get a new handler here; the renderers stay dumb instance-buffer
 * / DOM managers.
 *
 * Owns the per-frame SpriteAnimator that turns unit:moved events into smooth
 * lerps. Game calls `update(dt)` once per render frame; that drives sprite
 * lerps, overlay position-follow, and progress-bar fill (B3 lineage, E3.6
 * DOM port).
 */

/** Tracks an in-flight action's start so the progress bar fills smoothly between sim ticks. */
interface ActiveProgress {
  /** `world.tick` at which the current activeAction began. Identity check so we re-anchor when the action changes. */
  startTick: number;
  /** `renderClockMs` (Q1: the scaled-dt accumulator, NOT wall-clock) when this
   *  run was first observed by the render loop. Anchoring on the render clock —
   *  which advances by the same speed-scaled `dt` the sim sees, and freezes at
   *  pause — keeps the bar's fill rate locked to game speed. */
  startedAtMs: number;
  /** Total duration in ms, computed from `(finishTick - startTick) / TICK_RATE`. */
  durationMs: number;
}

interface OverlayFade {
  elapsed: number;
  readonly duration: number;
  readonly handle: UnitOverlayHandle;
}

/** E3.6 — overflow-spawn overlay fade-in. Lerps overlay opacity 0 → 1
 *  over `duration`; the progress bar stays hidden during the spawn
 *  lockout (filtered alongside MoveAction in `updateProgressFill`). */
interface OverlayFadeIn {
  elapsed: number;
  readonly duration: number;
  readonly handle: UnitOverlayHandle;
}

/**
 * E7.C — one particle of a magic-bolt explosion (the central flash or one of
 * the outward sparks). A standalone sprite (not a unit, not in `handles`)
 * driven per render frame: lerps `from → to` in XZ while growing `sizeFrom →
 * sizeTo` and fading alpha 1 → 0, then self-removes. Swept by `detach` like
 * the projectile tracers.
 */
interface ExplosionParticle {
  readonly handle: SpriteHandle;
  elapsed: number;
  readonly duration: number;
  readonly from: THREE.Vector3;
  readonly to: THREE.Vector3;
  readonly sizeFrom: number;
  readonly sizeTo: number;
  /** §76g2 — peak-alpha multiplier on the 1→0 fade (default 1). Lets the aura
   *  ring ride the same lane at a whisper without dimming existing bursts. */
  readonly alphaScale: number;
}

/**
 * §76g4 — the aura-FX mode switch. Born as an A/B rig for the pulse "Doppler"
 * finding (a fixed spawn center + slow travel leaves the wavefront behind a
 * moving carrier — user-caught at the 76g3 eyeball) and KEPT by user call
 * (2026-08-11): the verdict was "leaning track, but hold fill for a wider
 * feel jury — it may graduate to a player-facing graphics setting" (TODO).
 *  - 'track' (default): pulse motes re-anchor to the carrier's LIVE sprite
 *    every frame — concentric waves glide with the Officer. The legibility
 *    pick: the aura's range IS measured from wherever he stands now.
 *  - 'fill':  no pulses; the idle shed samples the whole aura AREA instead of
 *    the boundary. The aesthetic pick.
 *  - 'fixed': the 76g3 fixed-endpoint pulses — honest wave physics (a real
 *    wavefront IS left behind by a moving emitter), Doppler and all.
 * Dev-only switch, read live each frame: `__auraFx = 'fill'` in the console.
 */
interface AuraPulseParticle {
  readonly handle: SpriteHandle;
  elapsed: number;
  readonly duration: number;
  /** The carrier this wave re-anchors to each frame. */
  readonly unitId: number;
  /** Full boundary offset (world units, XZ) — position lerps along it. */
  readonly dx: number;
  readonly dz: number;
}

type AuraFxMode = 'track' | 'fixed' | 'fill';

export class BattleRenderer {
  private readonly handles = new Map<number, SpriteHandle>();
  private readonly overlayHandles = new Map<number, UnitOverlayHandle>();
  /**
   * 28 — per-unit held status-overlay tints, keyed `unitId → (statusId → tint
   * hex)`. A behavior status's `fx.active` overlay recolors the unit's glyph for
   * its whole lifetime (apply→expire); the inner Map's INSERTION ORDER resolves
   * which tint shows when several stack (last-applied wins), and restoring the
   * team color on the last expiry. Cleared on death + `reset`.
   */
  private readonly statusOverlays = new Map<number, Map<string, string>>();
  private readonly subscriptions: Array<() => void> = [];
  private readonly animator: SpriteAnimator;
  /** E6.B: in-flight ranged projectile sprite handles. They live in the
   *  shared SpriteRenderer but NOT in `handles` (they're not units), so
   *  detach sweeps them separately. */
  private readonly projectiles = new Set<SpriteHandle>();
  /** E7.C: in-flight magic-bolt explosion particles (flash + sparks). Like
   *  `projectiles`, they live in the shared SpriteRenderer but not in
   *  `handles`, and are swept by `detach`. */
  private readonly explosions: ExplosionParticle[] = [];
  /** §76g2 — accumulator gating the aura-ring mote shed (speed-scaled dt, so
   *  the ring slows with playback and freezes at pause). */
  private auraRingClock = 0;
  /** §76g3 — accumulator gating the aura PULSE (the expanding wavefront),
   *  independent of the shed clock so the two cadences tune separately. */
  private auraPulseClock = 0;
  /** §76g4 — carrier-TRACKED pulse motes ('track' mode): position re-derived
   *  from the live sprite each frame, so they can't live in `explosions`
   *  (whose from/to are fixed at spawn). Swept by `detach`. */
  private readonly auraPulses: AuraPulseParticle[] = [];
  /** §76g4 — scratch for the tracked-pulse carrier-center read, separate from
   *  `scratchPos` (which holds the per-mote position in the same loop). */
  private readonly auraScratch = new THREE.Vector3();
  /** unitId → in-flight action timing for the progress bar. */
  private readonly progress = new Map<number, ActiveProgress>();
  /** Q1 — render-time accumulator in ms, advanced by the speed-scaled `dt` each
   *  frame (the same `dt` BattleScene feeds the sim). The progress bar fills
   *  against THIS, not `performance.now()`, so it tracks game speed and freezes
   *  at pause (`dt === 0`). Every other animation here already advances by `dt`;
   *  the bar was the lone wall-clock holdout. */
  private renderClockMs = 0;
  /** unitId → ongoing post-death overlay fade. */
  private readonly overlayFades = new Map<number, OverlayFade>();
  /** E3.6: unitId → ongoing overflow-spawn overlay fade-in. */
  private readonly overlayFadeIns = new Map<number, OverlayFadeIn>();
  /** Scratch vector to avoid per-frame allocation when reading sprite positions. */
  private readonly scratchPos = new THREE.Vector3();
  /** F3 — dedicated scratch for a homing projectile's per-frame target re-read,
   *  kept separate from `scratchPos` so the two can't alias mid-frame. */
  private readonly homingScratch = new THREE.Vector3();
  /**
   * J3 — the active player objective TARGET + its marker sprite. The marker is
   * the `X` glyph billboard; `updateObjectiveMarker` repositions it every frame
   * (a tile stays put, an enemy mark tracks the target's live, lerped position).
   * State is driven entirely by `objective:set` / `objective:cleared`, so the
   * marker is correct however the objective was set (mouse / hotkey / AI/fuzz).
   * O1 — only the PLAYER team's objective draws a marker, and only its `engage`
   * target (an `atWill`/`hold` objective has no target → null, no marker).
   */
  private objective: ObjectiveTarget | null = null;
  private objectiveMarker: SpriteHandle | null = null;
  /**
   * The currently-attached battle World. Null when no battle is running (map
   * screen, defeat state). Set by `attach`, cleared by `detach`.
   */
  private world: World | null = null;

  constructor(
    private readonly sprites: SpriteRenderer,
    private readonly overlays: UnitOverlayLayer,
    /** C1c: queried at sprite spawn + move endpoints so units stand on
     *  the tile top instead of floating at a fixed plane. */
    private readonly terrain: TerrainRenderer,
    /** §Z + J3 — the render host. The FX driver triggers `shakeCamera` (Z2's
     *  non-sprite channel); `updateObjectiveMarker` reads `renderer.camera` to
     *  lift the enemy mark along the camera's up (screen-up) axis so it sits atop
     *  the unit without the off-axis skew a world-Y lift causes under pitch. */
    private readonly renderer: Renderer,
    /** §Z — the FX driver plays a cue's unified sound (one FxKey → visual +
     *  SFX). The renderer is the sole owner of every keyed combat cue; BattleScene
     *  keeps only the non-keyed sounds (death, fanfares, tile chips). */
    private readonly audio: AudioPlayer,
    bus: EventBus<GameEvents>,
  ) {
    // §Z / 27e boot assert: every `fx` key the ability AND status catalogs
    // reference must resolve in the registry, so a typo fails here (battle start)
    // not silently on screen.
    assertFxKeysResolve(ABILITY_DEFS);
    assertStatusFxKeysResolve(STATUS_DEFS);
    this.animator = new SpriteAnimator(this.sprites);
    this.subscriptions.push(bus.on('unit:spawned', this.onUnitSpawned));
    this.subscriptions.push(bus.on('unit:moved', this.onUnitMoved));
    this.subscriptions.push(bus.on('unit:moveAborted', this.onUnitMoveAborted));
    this.subscriptions.push(bus.on('unit:swapped', this.onUnitSwapped));
    this.subscriptions.push(bus.on('unit:swapAborted', this.onUnitSwapAborted));
    this.subscriptions.push(bus.on('unit:attacked', this.onUnitAttacked));
    // I2: a dodged single-target strike. The attacker still swung/shot (same
    // triggerAttackVisual lunge/tracer), but a "Miss" floats instead of damage.
    this.subscriptions.push(bus.on('unit:missed', this.onUnitMissed));
    this.subscriptions.push(bus.on('unit:died', this.onUnitDied));
    // §Z — the FX driver. Every keyed combat cue resolves off the action's phase
    // boundaries: `actionId → AbilityDef.fx[phase] → FX_REGISTRY → descriptor`,
    // then drives the named channels + sound. The mage bolt / catapult lob launch
    // their projectile on `release` (carved out of the wind-up, so it travels
    // DURING the charge and arrives on the impact tick) and detonate on `impact`.
    // This retired the ad-hoc `magic:detonated` / `catapult:fired` events (the Y4
    // strangler artifacts) — the impact burst now rides `action:phase{impact}`,
    // same tick, same pre-hitsplat ordering.
    this.subscriptions.push(bus.on('action:phase', this.onActionPhase));
    // 29c — the chain-lightning arc, drawn PER HOP off `unit:chained` (the §29c
    // per-hop delay): each event fires on the tick its hop's damage lands, so the
    // tracer travels jump by jump (the hitsplat rides the normal `unit:attacked`
    // each hop's inner damage op emits — this draws only the connecting arc).
    this.subscriptions.push(bus.on('unit:chained', this.onUnitChained));
    // 27e — the status-effect viz, resolved through the §Z FX registry exactly
    // like `action:phase` (status def's `fx[moment]` → key → descriptor →
    // channels). Only the `ticked` moment is wired: the per-tick pulse puffs a
    // recolored mote burst + floats the DoT/HoT amount hitsplat + plays the
    // re-homed tile cue (burn / healtick) + keeps the HP bar in sync. The
    // `applied` flash was DROPPED after the first playtest — a unit's logical
    // position snaps onto a tile at move-START (`MoveAction`), so an apply cue
    // fired while the sprite was still lerping in (reading as "burning before
    // arrival"); the first tick — one interval later, sprite settled — is the
    // first cue now. The `applied`/`expired`/`active` fx slots stay in the schema
    // for §28/§29 to drive (e.g. a frozen `active` tint, an on-hit apply flash).
    this.subscriptions.push(bus.on('status:ticked', this.onStatusTicked));
    // 28 — the held `active` overlay: a behavior status recolors the unit's glyph
    // for its whole lifetime (the ONLY cue for frozen/blind/panic/confusion — they
    // have no per-tick pulse). Apply tints; expire restores the team color.
    this.subscriptions.push(bus.on('status:applied', this.onStatusApplied));
    this.subscriptions.push(bus.on('status:expired', this.onStatusExpired));
    // D7.B: keep HP bars in sync with ability-heal chip. E6.C floats a cyan `+N`.
    // A heal onto a full unit emits a no-op (gotcha #80), so skip amount <= 0.
    this.subscriptions.push(
      bus.on('unit:healed', ({ unitId, amount, healerId }) => {
        this.refreshHpBar(unitId);
        if (amount > 0) {
          this.spawnHitsplat(unitId, `+${amount}`, 'heal');
          // F5: the cyan twinkle is for ABILITY heals only (healerId set). The
          // regen-TILE heal is now the `rejuvenate` status (27d) and gets its own
          // cyan sparkle via the status-fx driver; a `null`-source `unit:healed`
          // (hypothetical env heal) keeps just the `+N`.
          if (healerId !== null) this.spawnSparkle(unitId, COLORS.FLOURESCENT_BLUE);
        }
      }),
    );
    // J3 — the objective marker. set spawns/repoints the `X`; cleared removes it.
    this.subscriptions.push(bus.on('objective:set', this.onObjectiveSet));
    this.subscriptions.push(bus.on('objective:cleared', this.onObjectiveCleared));
  }

  /** Per-render-frame tick. Drives sprite lerps + overlay position-follow + progress fill. */
  update(dt: number): void {
    // Q1 — advance the render clock by the speed-scaled `dt` (0 at pause), so
    // the progress bar that anchors on it tracks game speed like everything else.
    this.renderClockMs += dt * 1000;
    this.animator.update(dt);
    this.updateExplosions(dt);
    this.updateAuraFx(dt);
    this.updateAuraPulseParticles(dt);
    this.updateOverlays(dt);
    // After overlays so an enemy mark reads the target's already-lerped position
    // this frame (no one-frame lag behind the unit it's pinned to).
    this.updateObjectiveMarker();
  }

  /**
   * E7.C — advance every live explosion particle: ease its position out
   * toward `to`, grow its size, fade its alpha, and remove it once its
   * lifetime elapses. Iterates back-to-front so in-place removal is safe.
   */
  private updateExplosions(dt: number): void {
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const p = this.explosions[i]!;
      p.elapsed += dt;
      const t = p.elapsed >= p.duration ? 1 : p.elapsed / p.duration;
      // Ease-out: sparks shoot out fast then settle, which reads more
      // explosive than a linear drift.
      const eased = 1 - (1 - t) * (1 - t);
      const pos = this.scratchPos.copy(p.from).lerp(p.to, eased);
      const size = p.sizeFrom + (p.sizeTo - p.sizeFrom) * t;
      this.sprites.updateSprite(p.handle, { position: pos, size, alpha: (1 - t) * p.alphaScale });
      if (t >= 1) {
        this.sprites.removeSprite(p.handle);
        this.explosions.splice(i, 1);
      }
    }
  }

  /**
   * §76g2/g3 — the aura-range FX (playtest insertion: the recipient pips prove
   * the buff APPLIES, but nothing showed the radius). Two layers, both riding
   * the explosion-particle lane, both anchored to the carrier's LIVE sprite
   * (the user call: half a cell of dishonesty during a move lerp beats a ring
   * that snaps cell to cell) and colored by the aura status's pip color
   * (`statusColor`), so ring, pulse, and recipient pips read as one system:
   *
   *  - the RING (76g2): every AURA_RING_INTERVAL_SECONDS each live carrier
   *    sheds a few faint motes at random points along the aura's Chebyshev
   *    boundary — the square perimeter at `radius + AURA_RING_EDGE`, the
   *    affected cells' outer edge (matching the sim's `unitDistance ≤ radius`
   *    gate for a 1×1 carrier). The idle "you can look for it" layer.
   *  - the PULSE (76g3): every AURA_PULSE_INTERVAL_SECONDS a full square
   *    wavefront of motes expands from the carrier out to that same boundary
   *    and fades as it arrives — a sonar ping that reads "this RADIATES" at a
   *    glance. The expanding square is the honest wavefront of the aura's
   *    Chebyshev distance metric, not an approximation of a circle. The
   *    ease-out lerp the lane already applies (fast start, settle at the
   *    edge) is exactly a wave losing energy at its extent.
   *
   * Y hugs the carrier's own ground plane — no per-mote terrain sampling, so
   * on a slope the far edge floats/sinks a touch (eyeball-accepted for v1).
   * Both clocks advance by the speed-scaled `dt`: faster at fast-forward,
   * frozen at pause, breathing at REAL dt during the pre-battle countdown
   * (the Q2 countdown branch feeds unscaled dt — see BattleScene.tick).
   */
  /** §76g4 — the A/B switch, read live each frame so the user can flip modes
   *  mid-battle from the console without a rebuild. */
  private auraFxMode(): AuraFxMode {
    const m = (window as { __auraFx?: unknown }).__auraFx;
    return m === 'fixed' || m === 'fill' ? m : 'track';
  }

  private updateAuraFx(dt: number): void {
    if (!this.world) return;
    const mode = this.auraFxMode();
    this.auraRingClock += dt;
    this.auraPulseClock += dt;
    const shedRing = this.auraRingClock >= AURA_RING_INTERVAL_SECONDS;
    // 'fill' mode has no pulse — the area-sampled shed carries the whole read.
    const shedPulse =
      mode !== 'fill' && this.auraPulseClock >= AURA_PULSE_INTERVAL_SECONDS;
    if (shedRing) this.auraRingClock %= AURA_RING_INTERVAL_SECONDS;
    if (this.auraPulseClock >= AURA_PULSE_INTERVAL_SECONDS) {
      this.auraPulseClock %= AURA_PULSE_INTERVAL_SECONDS;
    }
    if (!shedRing && !shedPulse) return;
    for (const carrier of this.world.units) {
      if (carrier.currentHp <= 0) continue;
      for (const ability of carrier.abilities) {
        const aura = ability.aura;
        if (!aura) continue;
        const handle = this.handles.get(carrier.id);
        if (!handle) continue;
        const center = this.sprites.getPosition(handle, this.scratchPos);
        if (!center) continue;
        const color = statusColor(aura.statusId);
        const reach = aura.radius + AURA_RING_EDGE;
        if (shedRing) {
          if (mode === 'fill') this.shedAuraFill(center, reach, color);
          else this.shedAuraRing(center, reach, color);
        }
        if (shedPulse) {
          if (mode === 'track') this.shedAuraPulseTracked(carrier.id, center, reach, color);
          else this.shedAuraPulse(center, reach, color);
        }
      }
    }
  }

  /** §76g4 'fill' — the whole-area shed: like the boundary ring, but motes
   *  sample the full aura square uniformly (the boundary is implied by where
   *  the motes STOP appearing rather than drawn as a line). */
  private shedAuraFill(center: THREE.Vector3, reach: number, color: string): void {
    for (let i = 0; i < AURA_FILL_MOTES; i++) {
      const dx = (Math.random() * 2 - 1) * reach;
      const dz = (Math.random() * 2 - 1) * reach;
      const from = center.clone();
      from.x += dx;
      from.z += dz;
      from.y += AURA_RING_Y_OFFSET;
      const to = from.clone();
      to.y += AURA_RING_RISE;
      this.addExplosionParticle(
        from,
        to,
        AURA_RING_GLYPH,
        color,
        AURA_RING_SIZE,
        AURA_RING_SIZE,
        AURA_RING_SECONDS,
        AURA_RING_BLOOM,
        AURA_RING_ALPHA,
      );
    }
  }

  /** §76g4 'track' — spawn one wavefront of carrier-tracked pulse motes: same
   *  perimeter sampling as the fixed pulse, but each mote stores its OFFSET +
   *  the carrier id, and `updateAuraPulseParticles` re-derives its position
   *  from the live sprite every frame — the wave glides with the Officer. */
  private shedAuraPulseTracked(
    unitId: number,
    center: THREE.Vector3,
    reach: number,
    color: string,
  ): void {
    const n = AURA_PULSE_SAMPLES_PER_SIDE;
    for (let side = 0; side < 4; side++) {
      for (let k = 0; k < n; k++) {
        const t = ((k + 0.5) / n - 0.5) * 2 * reach;
        const dx = side < 2 ? t : side === 2 ? reach : -reach;
        const dz = side === 0 ? reach : side === 1 ? -reach : t;
        const pos = this.auraScratch.copy(center);
        pos.x += dx * AURA_PULSE_START_FRAC;
        pos.z += dz * AURA_PULSE_START_FRAC;
        pos.y += AURA_RING_Y_OFFSET;
        const handle = this.sprites.addSprite(AURA_RING_GLYPH, color, pos);
        this.sprites.updateSprite(handle, {
          size: AURA_PULSE_SIZE,
          bloomIntensity: AURA_PULSE_BLOOM,
          alpha: AURA_PULSE_ALPHA,
        });
        this.auraPulses.push({
          handle,
          elapsed: 0,
          duration: AURA_PULSE_SECONDS,
          unitId,
          dx,
          dz,
        });
      }
    }
  }

  /** §76g4 'track' — advance the carrier-tracked pulse motes: position =
   *  live carrier center + offset × eased(t) (the same ease-out the fixed lane
   *  applies), alpha fading over the lifetime. A mote whose carrier sprite is
   *  gone (death fade finished / detach race) is removed on the spot. */
  private updateAuraPulseParticles(dt: number): void {
    if (this.auraPulses.length === 0) return;
    for (let i = this.auraPulses.length - 1; i >= 0; i--) {
      const p = this.auraPulses[i]!;
      p.elapsed += dt;
      const carrierHandle = this.handles.get(p.unitId);
      const center = carrierHandle
        ? this.sprites.getPosition(carrierHandle, this.auraScratch)
        : null;
      const t = p.elapsed >= p.duration ? 1 : p.elapsed / p.duration;
      if (t >= 1 || !center) {
        this.sprites.removeSprite(p.handle);
        this.auraPulses.splice(i, 1);
        continue;
      }
      const eased = 1 - (1 - t) * (1 - t);
      const scale = AURA_PULSE_START_FRAC + (1 - AURA_PULSE_START_FRAC) * eased;
      const pos = this.scratchPos.set(
        center.x + p.dx * scale,
        center.y + AURA_RING_Y_OFFSET,
        center.z + p.dz * scale,
      );
      this.sprites.updateSprite(p.handle, {
        position: pos,
        alpha: (1 - t) * AURA_PULSE_ALPHA,
      });
    }
  }

  /** §76g2 — the idle boundary shed: AURA_RING_MOTES faint motes at random
   *  points on the square perimeter, rising gently and fading in place. */
  private shedAuraRing(center: THREE.Vector3, reach: number, color: string): void {
    for (let i = 0; i < AURA_RING_MOTES; i++) {
      // A random point on the square perimeter: pick a side, then a spot
      // along it. (Math.random is fine here — render-only, never sim.)
      const side = Math.floor(Math.random() * 4);
      const t = (Math.random() * 2 - 1) * reach;
      const dx = side < 2 ? t : side === 2 ? reach : -reach;
      const dz = side === 0 ? reach : side === 1 ? -reach : t;
      const from = center.clone();
      from.x += dx;
      from.z += dz;
      from.y += AURA_RING_Y_OFFSET;
      const to = from.clone();
      to.y += AURA_RING_RISE;
      this.addExplosionParticle(
        from,
        to,
        AURA_RING_GLYPH,
        color,
        AURA_RING_SIZE,
        AURA_RING_SIZE,
        AURA_RING_SECONDS,
        AURA_RING_BLOOM,
        AURA_RING_ALPHA,
      );
    }
  }

  /** §76g3 — the radiating pulse: a square wavefront of evenly-spaced motes
   *  (AURA_PULSE_SAMPLES_PER_SIDE per side, no corner doubling) expanding from
   *  just off the carrier out to the boundary, fading as it arrives. Ground-
   *  flat: the wave travels in XZ only, no rise. */
  private shedAuraPulse(center: THREE.Vector3, reach: number, color: string): void {
    const n = AURA_PULSE_SAMPLES_PER_SIDE;
    for (let side = 0; side < 4; side++) {
      for (let k = 0; k < n; k++) {
        // Evenly spaced along the side, offset half a step from the corners so
        // adjacent sides interleave instead of doubling the corner motes.
        const t = ((k + 0.5) / n - 0.5) * 2 * reach;
        const dx = side < 2 ? t : side === 2 ? reach : -reach;
        const dz = side === 0 ? reach : side === 1 ? -reach : t;
        const from = center.clone();
        from.x += dx * AURA_PULSE_START_FRAC;
        from.z += dz * AURA_PULSE_START_FRAC;
        from.y += AURA_RING_Y_OFFSET;
        const to = center.clone();
        to.x += dx;
        to.z += dz;
        to.y += AURA_RING_Y_OFFSET;
        this.addExplosionParticle(
          from,
          to,
          AURA_RING_GLYPH,
          color,
          AURA_PULSE_SIZE,
          AURA_PULSE_SIZE,
          AURA_PULSE_SECONDS,
          AURA_PULSE_BLOOM,
          AURA_PULSE_ALPHA,
        );
      }
    }
  }

  /** J3 — record the new objective target and lazily spawn the marker sprite
   *  (one per battle, reused across re-sets). `updateObjectiveMarker` positions
   *  it. O1 — only the PLAYER team draws a marker; a non-targeted objective
   *  (atWill / O2 hold) has no target, so it drops the marker like a clear. O3 —
   *  `focus` carries a target too (like `engage`), so it draws the marker. */
  private onObjectiveSet = ({ team, objective }: GameEvents['objective:set']): void => {
    if (team !== 'player') return;
    if (objective.mode !== 'engage' && objective.mode !== 'focus') {
      this.dropObjectiveMarker();
      return;
    }
    this.objective = objective.target;
    // Q3 — the glyph reads the mode: 'X' for engage, '!' for focus. The single
    // marker sprite is reused across re-sets, so swap the glyph in place when the
    // mode flips (engage ⇄ focus) rather than recreating it.
    const glyph = objective.mode === 'focus' ? OBJECTIVE_MARKER_FOCUS_GLYPH : OBJECTIVE_MARKER_GLYPH;
    if (!this.objectiveMarker) {
      // Seed at the origin; updateObjectiveMarker (same frame, end of update())
      // moves it to the real spot before it's ever drawn. §79d2 — BASE-anchored:
      // the X/! stands its ink on the marker position (the glyph swap below
      // re-derives the stand line automatically).
      this.objectiveMarker = this.sprites.addSprite(
        glyph,
        OBJECTIVE_MARKER_COLOR,
        this.scratchPos.set(0, 0, 0),
        'base',
      );
      this.sprites.updateSprite(this.objectiveMarker, { bloomIntensity: OBJECTIVE_MARKER_BLOOM });
    } else {
      this.sprites.updateSprite(this.objectiveMarker, { glyph });
    }
    this.updateObjectiveMarker();
  };

  /** J3 — objective gone (player reverted it to at-will, or an enemy mark
   *  auto-reverted on the target's death): drop the marker. Enemy-team objective
   *  events never draw a marker (O1). */
  private onObjectiveCleared = ({ team }: GameEvents['objective:cleared']): void => {
    if (team !== 'player') return;
    this.dropObjectiveMarker();
  };

  /** J3/O1 — clear the player objective marker state + sprite. */
  private dropObjectiveMarker(): void {
    this.objective = null;
    if (this.objectiveMarker) {
      this.sprites.removeSprite(this.objectiveMarker);
      this.objectiveMarker = null;
    }
  }

  /**
   * J3 — position the objective marker for the current frame. A tile objective
   * sits (larger) on its rally cell; an enemy objective rides atop the target's
   * billboard, tracking its live position. If the target's sprite is briefly
   * gone (it died this tick — the enemy objective auto-clears at the next
   * top-of-tick, a ≤1-frame gap before `objective:cleared` lands), hide the
   * marker rather than stranding it at a stale spot.
   */
  private updateObjectiveMarker(): void {
    const marker = this.objectiveMarker;
    const obj = this.objective;
    if (!marker || !obj || !this.world) return;

    if (obj.kind === 'tile') {
      // §79d2 — the marker is base-anchored, so its INK stands
      // OBJECTIVE_MARKER_TILE_LIFT above the cell's ground point (camera-up, so
      // it hugs its cell at the screen edges too). No glyph-cell skirt math —
      // the 79d2 eyeball find (the X floating a quarter-cell up) dies here.
      const pos = aboveAnchor(
        this.tileGroundPos(obj.cell),
        OBJECTIVE_MARKER_TILE_LIFT,
        this.renderer.camera,
        this.scratchPos,
      );
      this.sprites.updateSprite(marker, {
        position: pos,
        size: OBJECTIVE_MARKER_TILE_SIZE,
        alpha: 1,
      });
      return;
    }

    const handle = this.handles.get(obj.unitId);
    const anchor = handle ? this.sprites.getPosition(handle, this.scratchPos) : null;
    if (!anchor) {
      this.sprites.updateSprite(marker, { alpha: 0 });
      return;
    }
    // §79d/79d2 — the mark's ink stands OBJECTIVE_MARKER_ENEMY_LIFT above the
    // target glyph's visible INK TOP, via the shared camera-up helper (this
    // site's J3 hand-rolled `setFromMatrixColumn` lift was copy #1 of the
    // pattern the helper unifies). The target's ground anchor is live (tracks
    // its lerp).
    const target = this.world.findUnit(obj.unitId);
    const inkTop = target
      ? this.sprites.atlas.inkTopLift(target.glyph) * footprintOf(target)
      : 2 * GLYPH_HALF_HEIGHT;
    const pos = aboveAnchor(
      anchor,
      inkTop + OBJECTIVE_MARKER_ENEMY_LIFT,
      this.renderer.camera,
      anchor,
    );
    this.sprites.updateSprite(marker, {
      position: pos,
      size: OBJECTIVE_MARKER_ENEMY_SIZE,
      alpha: 1,
    });
  }

  /**
   * J3 — living enemy units as click candidates for the billboard hit-test
   * (`Renderer.pickInstance`), using each sprite's LIVE rendered position (the
   * exact billboard the player sees, incl. a mid-move lerp) rather than the
   * logical cell — so clicking a moving enemy's glyph still selects it. The
   * objective controller calls this to resolve an objective click (either
   * button, armed or not) onto the unit you actually clicked, before falling
   * back to the terrain cell.
   */
  enemyBillboards(): PickCandidate[] {
    if (!this.world) return [];
    const out: PickCandidate[] = [];
    for (const [unitId, handle] of this.handles) {
      const unit = this.world.findUnit(unitId);
      if (!unit || unit.team !== 'enemy' || unit.currentHp <= 0) continue;
      const pos = this.sprites.getPosition(handle, this.scratchPos);
      if (!pos) continue;
      out.push({
        id: unitId,
        position: pos.clone(),
        size: UNIT_PICK_SIZE,
        // §79a/79d2 — atlas-derived ink (padded for click feel), measured off
        // the same rasterization on screen.
        ink: this.sprites.atlas.getPaddedGlyphInk(unit.glyph),
        // §79d/79d2 — unit sprites stand on their glyph's derived stand line;
        // the clickbox must mirror the same anchor exactly.
        anchor: { x: 0, y: this.sprites.atlas.baseAnchorY(unit.glyph) },
      });
    }
    return out;
  }

  /**
   * §40e — living DESTRUCTIBLE neutrals (rubble / a destructible wall or cover)
   * as click candidates for the objective billboard hit-test, symmetric to
   * `enemyBillboards`: the player can manually order an attack on one (a
   * `focus` / `engage`, the "demolish this obstacle" order). The pick quad scales
   * with the footprint — a 2×2/3×3 rubble renders ONE glyph at `size = N` (§39d),
   * so the visible glyph stays clickable at any size (the cell-fallback in the
   * ObjectiveController covers footprint tiles the single glyph doesn't overlap).
   * Indestructible walls (hp-less) are excluded — they stay unclickable.
   * §75h — ACTIVE neutrals (camp members) join the pool: the click-to-engage
   * order rides the same neutral-kind objective (the sim admits it since 75e,
   * and the ordered first blow is what aggros the camp).
   */
  destructibleBillboards(): PickCandidate[] {
    if (!this.world) return [];
    const out: PickCandidate[] = [];
    for (const [unitId, handle] of this.handles) {
      const unit = this.world.findUnit(unitId);
      if (!unit || unit.team !== 'neutral' || unit.currentHp <= 0) continue;
      if (!isDestructibleNeutral(unit.archetype) && unit.campId === null) continue;
      const pos = this.sprites.getPosition(handle, this.scratchPos);
      if (!pos) continue;
      out.push({
        id: unitId,
        position: pos.clone(),
        size: UNIT_PICK_SIZE * footprintOf(unit),
        ink: this.sprites.atlas.getPaddedGlyphInk(unit.glyph),
        anchor: { x: 0, y: this.sprites.atlas.baseAnchorY(unit.glyph) },
      });
    }
    return out;
  }

  /**
   * Bind the renderer to a freshly-built World for the next battle. Must be
   * called before any unit:spawned event fires on that world.
   */
  attach(world: World): void {
    this.world = world;
  }

  /**
   * End-of-battle teardown. Drops every sprite + overlay handle and clears
   * all animation state so the next battle starts clean. Bus subscriptions
   * stay live — only the World reference and the per-battle state are reset.
   *
   * Side effect: any in-flight death fades (started in the same tick
   * battle:ended fired) get cut short. Acceptable: subsequent screens hide
   * the cut-short visual. See HANDOFF gotcha #15.
   */
  detach(): void {
    this.animator.clear();
    for (const handle of this.handles.values()) {
      this.sprites.removeSprite(handle);
    }
    this.handles.clear();
    // E6.B — animator.clear() drops the projectile lerps without firing
    // their onComplete (the despawn callback), so sweep the tracer sprites
    // here. removeSprite is idempotent, so a late callback is harmless.
    for (const proj of this.projectiles) this.sprites.removeSprite(proj);
    this.projectiles.clear();
    // E7.C — same deal for in-flight explosion particles: animator.clear()
    // doesn't own them, so sweep their sprites here.
    for (const p of this.explosions) this.sprites.removeSprite(p.handle);
    this.explosions.length = 0;
    // §76g2/g3 — the aura ring/pulse motes live in `explosions` (swept above);
    // just rewind the shed clocks so the next battle starts on fresh intervals.
    this.auraRingClock = 0;
    this.auraPulseClock = 0;
    // §76g4 — the carrier-TRACKED pulse motes have their own lane; sweep it.
    for (const p of this.auraPulses) this.sprites.removeSprite(p.handle);
    this.auraPulses.length = 0;
    // overlays.clear() drops every <div> the overlay layer owns in a single
    // sweep — covers both live overlays (this.overlayHandles) and any that
    // were mid-fade when the battle ended (typically the killing-blow
    // victim — its onUnitDied fired in the same synchronous burst as
    // battle:ended). Without the sweep, those DOM nodes would linger into
    // the next scene.
    this.overlays.clear();
    this.overlayHandles.clear();
    this.overlayFades.clear();
    this.overlayFadeIns.clear();
    this.statusOverlays.clear();
    this.progress.clear();
    this.renderClockMs = 0;
    // J3 — drop the objective marker + state so the next battle starts clean.
    this.dropObjectiveMarker();
    this.world = null;
  }

  dispose(): void {
    for (const unsub of this.subscriptions) unsub();
    this.subscriptions.length = 0;
  }

  private onUnitSpawned = ({ unitId, instant }: GameEvents['unit:spawned']): void => {
    if (!this.world) return;
    const unit = this.world.findUnit(unitId);
    if (!unit) return;
    const footprint = footprintOf(unit);
    const spritePos = this.unitAnchorPos(unit.position, footprint);
    // §40c — a destructible wall/cover renders in the CRACKED_STONE tint (its
    // tell); every other unit reads its team/stone color via the same helper.
    // §79d — BASE-anchored: the glyph stands on its ground anchor, rising
    // screen-up (the off-axis fix; see SpriteAnchor).
    const handle = this.sprites.addSprite(unit.glyph, spriteColorForUnit(unit), spritePos, 'base');
    this.handles.set(unit.id, handle);
    // §39d — a multi-tile body renders as one glyph scaled to its footprint
    // (the SpriteRenderer per-instance `size`, E6.B). Single-cell units keep the
    // default size, so the shipped roster's render is untouched.
    if (footprint !== 1) this.sprites.updateSprite(handle, { size: footprint });

    // INERT neutrals (walls, environment) are background — suppress the halo.
    // An INDESTRUCTIBLE wall still skips the overlay (an HP bar it could never
    // move would be visual noise). §40f — a DESTRUCTIBLE neutral (rubble /
    // breakable wall/cover) opts back in: it gets an overlay so you can watch it
    // chipped down. The bar hides until damaged + scales to the footprint (both
    // owned by UnitOverlayLayer.addDestructible); registering it in
    // overlayHandles means the existing unit:attacked → refreshHpBar path fills
    // it and the per-frame loop position-follows it, no new plumbing.
    // §75h — an ACTIVE neutral (camp member) skips this return and takes the
    // full combatant path below: natural bloom, the level-badge + HP-bar
    // overlay, and the mid-battle fade-in — the portal drip spawns with
    // `instant: false`, so a member MATERIALIZES at the anchor for free.
    if (isInertNeutral(unit)) {
      this.sprites.updateSprite(handle, { bloomIntensity: 0 });
      if (isDestructibleNeutral(unit.archetype)) {
        const overlay = this.overlays.addDestructible(footprint);
        this.overlays.updateHp(overlay, Math.max(0, unit.currentHp) / unit.derived.maxHp);
        // §79e — overlays anchor on the glyph's visible INK TOP (the per-frame
        // follow recomputes the same point). See `inkTopLiftFor`.
        this.overlays.updatePosition(
          overlay,
          aboveAnchor(spritePos, this.inkTopLiftFor(unit), this.renderer.camera, this.scratchPos),
        );
        this.overlayHandles.set(unit.id, overlay);
      }
      return;
    }

    // Q2 — battle-start placements (`instant: true`) appear IMMEDIATELY: the M3
    // materialize fade "read as loading", and the pre-battle COUNTDOWN now owns
    // the reaction-time window. Only D5.C mid-battle overflow spawns
    // (`instant: false`) still fade — they lerp alpha 0 → 1 over the SpawnAction
    // lockout so the fade and the lockout line up (reinforcements arriving, not
    // a battle-open materialize). Walls/neutrals returned above and still pop.
    const overlay = this.overlays.add(unit.team, unit.level, instant ? 1 : 0);
    const pct = Math.max(0, unit.currentHp) / unit.derived.maxHp;
    this.overlays.updateHp(overlay, pct);
    this.overlays.updatePosition(
      overlay,
      aboveAnchor(spritePos, this.inkTopLiftFor(unit), this.renderer.camera, this.scratchPos),
    );
    this.overlayHandles.set(unit.id, overlay);

    if (instant) {
      this.sprites.updateSprite(handle, { alpha: 1 });
    } else {
      this.animator.startFadeIn(handle, SPAWN.durationSeconds);
      this.overlayFadeIns.set(unit.id, {
        elapsed: 0,
        duration: SPAWN.durationSeconds,
        handle: overlay,
      });
    }
  };

  private onUnitMoved = ({
    unitId,
    from,
    to,
    durationTicks,
  }: GameEvents['unit:moved']): void => {
    this.animateStep(unitId, from, to, durationTicks);
  };

  /**
   * §36c — the settle-back. A deferred move aborted mid-flight (its destination
   * went invalid while the sprite was sliding toward it). Ease the sprite from
   * wherever it reached back to `from` — its logical cell, since a pre-flip unit
   * never left it. Lerps from the sprite's LIVE position (like animateStep), so
   * the reversal is continuous from the slide's current point and overrides the
   * in-flight move lerp (single lerp per handle). A short, fixed duration keeps
   * the recoil from lingering into a concurrent melee-hit anim (the spec's
   * worry). A §35b selection-time abort never started a slide, so the sprite is
   * already on `from` and this lerps in place — a clean no-op. Inert in real play
   * until §37/§40 can invalidate a claimed destination.
   */
  private onUnitMoveAborted = ({ unitId, from }: GameEvents['unit:moveAborted']): void => {
    this.settleSpriteTo(unitId, from);
  };

  /**
   * 56e-pre2 — a swap ended WITHOUT its flip (abort at the impact boundary,
   * or a participant removed pre-flip). BOTH sprites began the dual lerp at
   * swap-start, so both settle back to their true cells — the one-body
   * `unit:moveAborted` this replaces settled only the actor, leaving the
   * partner's sprite resting on a slide the sim never honored (the 56e
   * labyrinth desync: a melee attacking from a tile it wasn't on). A dead
   * participant's handle is already gone (`unit:died` owns that sprite) —
   * `settleSpriteTo` skips it.
   */
  private onUnitSwapAborted = ({
    unitA,
    unitB,
    cellA,
    cellB,
  }: GameEvents['unit:swapAborted']): void => {
    this.settleSpriteTo(unitA, cellA);
    this.settleSpriteTo(unitB, cellB);
  };

  /** The §36c settle: ease the sprite from its LIVE position to `cell`'s rest
   *  position (single lerp per handle — overrides any in-flight slide). */
  private settleSpriteTo(unitId: number, cell: GridCoord): void {
    if (!this.world) return;
    const handle = this.handles.get(unitId);
    if (!handle) return;
    const footprint = this.footprintFor(unitId);
    const restPos = this.unitAnchorPos(cell, footprint);
    const origin = (this.sprites.getPosition(handle, this.scratchPos) ?? restPos).clone();
    this.animator.startLerp(handle, origin, restPos, SETTLE_BACK_SECONDS);
  }

  /**
   * GP5.1 — a swap (`SwapAction`) animates as two simultaneous steps in
   * opposite directions. Each sprite lerps from its LIVE position (see
   * `animateStep`), which is what keeps a partner caught mid-step from
   * jittering.
   */
  private onUnitSwapped = ({
    unitA,
    unitB,
    cellA,
    cellB,
    durationTicks,
  }: GameEvents['unit:swapped']): void => {
    this.animateStep(unitA, cellA, cellB, durationTicks);
    this.animateStep(unitB, cellB, cellA, durationTicks);
  };

  /**
   * Start a one-cell move lerp for `unitId`, from the sprite's LIVE position
   * (not the logical `from` tile) to `to`. A normal move starts idle on `from`
   * — the unit was locked for its whole move-cooldown, so its sprite finished
   * lerping — making the two equal. But a `SwapAction` yanks a unit that may
   * still be mid-lerp; starting from the tile would snap the sprite there first
   * (the swap jitter). Reading the current position (as `startShove` already
   * does for the melee lunge) keeps it continuous; falls back to the tile when
   * the sprite has no live position yet.
   */
  private animateStep(
    unitId: number,
    from: GridCoord,
    to: GridCoord,
    durationTicks: number,
  ): void {
    if (!this.world) return;
    const handle = this.handles.get(unitId);
    if (!handle) return;
    // §39d — lerp between FOOTPRINT-centered anchors so a multi-tile mover stays
    // centered over its block through the slide (n=1 → tileGroundPos, identical).
    const footprint = this.footprintFor(unitId);
    const origin = (this.sprites.getPosition(handle, this.scratchPos) ?? this.unitAnchorPos(from, footprint)).clone();
    this.animator.startLerp(
      handle,
      origin,
      this.unitAnchorPos(to, footprint),
      ticksToSeconds(durationTicks),
    );
  }

  /**
   * §79d — the GROUND point of cell `coord`: XZ from gridToWorld, Y the terrain
   * top-of-tile (per-cell from `TerrainRenderer.heightAt`). This is the world
   * ANCHOR convention: a thing's true scene location carries NO presentation
   * lift (pre-79d this added `SPRITE_CENTER_OFFSET` — the world-Y lift the 79b
   * probe measured skewing edge sprites ±9px off their tiles). A unit's
   * base-anchored quad STANDS on this point (screen-up, via `instanceAnchor`);
   * anything stacked above it goes through `aboveAnchor`.
   */
  private tileGroundPos(coord: GridCoord): THREE.Vector3 {
    if (!this.world) throw new Error('BattleRenderer.tileGroundPos: no attached world');
    const pos = gridToWorld(coord, this.world.gridW, this.world.gridH);
    const kind = this.world.tileGrid.kindAt(coord);
    pos.y = this.terrain.heightAt(coord.x, coord.y, kind);
    return pos;
  }

  /** §79d — the visual CENTER of cell `coord` for FX aimed at a tile (blast
   *  flashes, ground-target bolt endpoints): half a glyph up the screen from
   *  the ground point — where a standing glyph's center reads. */
  private cellVisualCenter(coord: GridCoord): THREE.Vector3 {
    return aboveAnchor(
      this.tileGroundPos(coord),
      GLYPH_HALF_HEIGHT,
      this.renderer.camera,
      this.scratchPos,
    );
  }

  /**
   * §79d — the visual CENTER of a unit's live glyph: its ground anchor (which
   * tracks move lerps) lifted up the SCREEN to the middle of the VISIBLE INK
   * (§79d2 — ink-aware, so a bolt aimed "at the unit" hits the letterform's
   * body, not the taller empty quad's midpoint). The one point FX endpoints /
   * sparkles mean by "at the unit". Null when the handle is gone
   * (mid-teardown), like `getPosition`.
   */
  private unitVisualCenter(
    handle: SpriteHandle,
    unit: Unit,
    out: THREE.Vector3,
  ): THREE.Vector3 | null {
    const pos = this.sprites.getPosition(handle, out);
    if (!pos) return null;
    const lift = this.sprites.atlas.inkCenterLift(unit.glyph) * footprintOf(unit);
    return aboveAnchor(pos, lift, this.renderer.camera, pos);
  }

  /**
   * §79e — the camera-up lift from a unit's GROUND anchor to the top of its
   * visible ink, footprint-scaled. The one definition shared by everything that
   * must sit a fixed SCREEN distance off the top of a glyph: the HP-overlay
   * stack and the hitsplat anchor.
   *
   * §79d2 anchored the overlay stack on the uniform half-quad line instead —
   * deliberately, so bars across a row of mixed glyphs stayed on one scannable
   * line. The 79e native eyeball REVERSED that call (user, on the built
   * result): the uniform line is glyph-BLIND, so short glyphs (`a`, `r`) wore
   * their bar visibly high while tall ones (`M`) ran cramped — and since the
   * CSS gap is screen-px against a depth-blind anchor, near rows read tight and
   * far rows read high *at the same time*, with no single gap value fixing
   * both. An ink-top anchor scales with perspective on its own, so the CSS gap
   * means the same thing at every depth and letterform. The price, accepted:
   * bars sit ~5px apart for an `a` vs an `M` at equal depth instead of on one
   * line. `inkCenterLift`'s consumers (FX endpoints) are unaffected.
   */
  private inkTopLiftFor(unit: Unit): number {
    return this.sprites.atlas.inkTopLift(unit.glyph) * footprintOf(unit);
  }

  /**
   * §39d/§79d — the GROUND anchor for a unit's BODY sprite, footprint-aware.
   * `corner` is the canonical `unit.position` (the min-XY cell); the N×N block
   * extends +x/+y (see `footprintCells`). We render one scaled glyph
   * (`instanceSize = n`) BASE-ANCHORED on the **NEAR-ROW center**: +½ per
   * extra cell in x (centered across the columns), z UNSHIFTED — the corner
   * row is the footprint's camera-near row (grid +y is world −z, and the
   * camera never rotates), so the body STANDS at its front row and its ink
   * rises to cover the rows behind (§79d2 rubble fix, user-signed). Anchoring
   * mid-footprint put the front rows NEARER than the sprite's own depth, so
   * their tile-tops depth-clipped the slab's lower band (the jagged bite) and
   * the ground contact read as the center row. `n = 1` degenerates to the
   * plain tile center — no special case. The pre-79d
   * `SPRITE_CENTER_OFFSET·(n−1)` flush-fixup is gone — a base-anchored quad
   * grows UP from its anchor at any size, so a big glyph can't sink into the
   * terrain by construction. Y reads the corner tile's height (fine while
   * footprints are inert / on flat rubble ground — §40 revisits if needed).
   */
  private unitAnchorPos(corner: GridCoord, footprint: number): THREE.Vector3 {
    const pos = this.tileGroundPos(corner);
    if (footprint === 1) return pos;
    pos.x += (footprint - 1) / 2;
    // §79d2 rider 2 (user diagnosis) — Y = the MAX tile-top height across the
    // near row's cells, not the corner's. The terrain height profile varies
    // per cell, so a TALLER front-row tile's top rises above a corner-height
    // base line while its front half sits nearer in depth → it bites the slab
    // bottom. At the row max, every nearer front-row surface projects BELOW
    // the base line — the self-clip is impossible again.
    for (let i = 1; i < footprint; i++) {
      const cell = { x: corner.x + i, y: corner.y };
      const kind = this.world!.tileGrid.kindAt(cell);
      const h = this.terrain.heightAt(cell.x, cell.y, kind);
      if (h > pos.y) pos.y = h;
    }
    return pos;
  }

  /** Footprint (N) of a live unit by id; 1 if it's gone or single-cell. */
  private footprintFor(unitId: number): number {
    const unit = this.world?.findUnit(unitId);
    return unit ? footprintOf(unit) : 1;
  }

  /**
   * E6 — float a damage hitsplat over the target: neon-red for a crit (the E1
   * `crit` flag), white otherwise. The pre-E6 attacker/target color flash is
   * gone — the §Z3 shove/tracer (driven off `action:phase`) shows who's acting
   * and the hitsplat shows the impact, so the flash is redundant. Also refreshes
   * the target's HP bar (the sim has applied damage by the time this fires).
   *
   * Z3 — the swing CUE left this handler: it now rides `action:phase` via the
   * fx registry (so it plays on a MISS too, off the same phase event). This
   * handler keeps only the DAMAGE-coupled visuals (the hitsplat + HP bar), which
   * need the resolved `damage` / `crit` that `action:phase` doesn't carry.
   */
  private onUnitAttacked = ({
    targetId,
    damage,
    crit,
  }: GameEvents['unit:attacked']): void => {
    this.spawnHitsplat(targetId, String(damage), crit ? 'crit' : 'normal');
    this.refreshHpBar(targetId);
  };

  /**
   * I2 — a single-target strike was dodged: float a desaturated "Miss" over the
   * target instead of a damage number. No HP-bar refresh: a miss mutates no HP.
   * Z3 — the swing itself now rides `action:phase` (which fires on hit AND miss),
   * so this handler no longer triggers the lunge/tracer; it floats only the splat.
   */
  private onUnitMissed = ({ targetId }: GameEvents['unit:missed']): void => {
    this.spawnHitsplat(targetId, 'Miss', 'miss');
  };

  /**
   * E6.C — float a number over a unit, anchored at the *top* of the glyph so
   * it reads off the top edge. §79d: the top is the ground anchor lifted a
   * full quad height along CAMERA-UP (`aboveAnchor`) — drift-free by
   * construction, one projection in UnitOverlayLayer. A world-unit lift keeps
   * the offset tracking the sprite's apparent size across camera zoom (a CSS
   * % offset wouldn't). No-op if the unit has no live sprite (mid-teardown)
   * or projects off-screen.
   */
  private spawnHitsplat(
    unitId: number,
    text: string,
    kind: 'normal' | 'crit' | 'heal' | 'burn' | 'miss',
  ): void {
    const handle = this.handles.get(unitId);
    if (!handle) return;
    const pos = this.sprites.getPosition(handle, this.scratchPos);
    if (!pos) return;
    if (!this.world) return;
    const unit = this.world.findUnit(unitId);
    // §79d/79d2 — anchor at the glyph's visible INK TOP (ink-aware: the number
    // floats just above the letterform, not above the taller empty quad).
    // Camera-up projects to the same screen X as the anchor by construction,
    // which is what retired the I2 dual-projection workaround in
    // UnitOverlayLayer.spawnHitsplat.
    const lift = unit ? this.inkTopLiftFor(unit) : 2 * GLYPH_HALF_HEIGHT;
    const top = aboveAnchor(pos, lift, this.renderer.camera, pos);
    this.overlays.spawnHitsplat(top, text, kind, unitId);
  }

  /**
   * E6.A / Z3 — the melee lunge. The caster shoves toward its target and snaps
   * back. Driven off `action:phase` via the `melee_swing` fx key (the four
   * weapons author it on `impact`, the rogue gambit on `windup`), so it fires on
   * a MISS too — the phase boundary doesn't care whether the strike connected.
   * Direction comes from the cell centers (stable even while the sprite is
   * mid-lerp); `startShove` captures the sprite's live position as the origin.
   * No archetype keying: only defs that author the key reach here, so the mage's
   * AoE / catapult's lob (their own projectile+burst keys) never lunge.
   */
  private triggerShoveFx(spec: FxShove, casterId: number, targetId: number | undefined): void {
    if (!this.world || targetId === undefined) return;
    const attacker = this.world.findUnit(casterId);
    const target = this.world.findUnit(targetId);
    if (!attacker || !target) return;
    const attackerHandle = this.handles.get(casterId);
    if (!attackerHandle) return;
    const from = this.tileGroundPos(attacker.position);
    const to = this.tileGroundPos(target.position);
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const len = Math.hypot(dx, dz) || 1;
    this.animator.startShove(
      attackerHandle,
      dx / len,
      dz / len,
      spec.distance ?? SHOVE_DISTANCE,
      SHOVE_OUT_SECONDS,
      SHOVE_BACK_SECONDS,
    );
  }

  /**
   * E6.B / Z3 — the ranged tracer. Fly a `*` glyph in a straight line from the
   * caster's sprite to the target's and despawn on arrival. Driven off
   * `action:phase` via the `ranged_shot` fx key (the bow, on `impact`), so it
   * fires on a MISS too. Damage already landed this tick (the sim is
   * instantaneous); the bolt is a cosmetic. Spawn from the live sprite positions
   * so it emanates from / lands on what the player sees, falling back to cell
   * centers if a handle is mid-teardown.
   */
  private triggerTracerFx(spec: FxTracer, casterId: number, targetId: number | undefined): void {
    if (!this.world || targetId === undefined) return;
    const attacker = this.world.findUnit(casterId);
    if (!attacker) return;
    const attackerHandle = this.handles.get(casterId);
    if (!attackerHandle) return;
    // §79d — endpoints are the glyphs' visual CENTERS (ground anchor + half the
    // quad up the screen), so the bolt emanates from / lands on what the player
    // sees; falls back to the cell's visual center if a handle is mid-teardown.
    const from = (
      this.unitVisualCenter(attackerHandle, attacker, this.scratchPos) ??
      this.cellVisualCenter(attacker.position)
    ).clone();
    const targetHandle = this.handles.get(targetId);
    const target = this.world.findUnit(targetId);
    const to = (
      (targetHandle && target && this.unitVisualCenter(targetHandle, target, this.scratchPos)) ??
      (target ? this.cellVisualCenter(target.position) : from)
    ).clone();
    this.spawnProjectile(from, to, colorForTeam(attacker.team), undefined, 0, PROJECTILE_SECONDS, undefined, spec.size);
  }

  /**
   * §29c — one ARC of a chain attack. Fires per hop (`unit:chained`), on the tick
   * that hop's damage lands, so with `hopDelaySeconds > 0` the bolt visibly travels
   * jump by jump. Flies a fast `*` tracer from the arc's source cell (`from` — the
   * caster for jump 0, else the previous victim) to the live target sprite (falling
   * back to the recorded `to` cell), team-coloured by the caster, plus the gentle
   * per-hop jolt the `chain_arc` registry entry authors. The DAMAGE feedback (the
   * hitsplat + HP) rides the normal `unit:attacked` each hop emits — this is the
   * connecting arc only. The arc is a cosmetic, like the bow tracer: damage already
   * landed this hop's tick, the bolt just shows the path.
   */
  private onUnitChained = ({ casterId, targetId, from, to }: GameEvents['unit:chained']): void => {
    if (!this.world) return;
    const caster = this.world.findUnit(casterId);
    const color = caster ? colorForTeam(caster.team) : COLORS.FLOURESCENT_BLUE;
    const fromPos = this.cellVisualCenter(from).clone();
    // Prefer the live target sprite (smooth even mid-lerp); fall back to the cell.
    const targetHandle = this.handles.get(targetId);
    const target = this.world.findUnit(targetId);
    const toPos = (
      (targetHandle && target && this.unitVisualCenter(targetHandle, target, this.scratchPos)) ??
      this.cellVisualCenter(to)
    ).clone();
    this.spawnProjectile(fromPos, toPos, color, undefined, 0, CHAIN_ARC_SECONDS, undefined, PROJECTILE_SIZE);
    // The per-hop zap + the gentle electric jolt (the registry authors both; the
    // unified one-key = visual + SFX model, like onActionPhase).
    const fx = fxDescriptor('chain_arc');
    if (fx?.sound) this.audio.play(fx.sound);
    if (fx?.shake) this.renderer.shakeCamera(fx.shake.intensity, fx.shake.durationSeconds);
  };

  /**
   * E6.B/E7.C — fly a `*` tracer in a straight line `from → to` over
   * `durationSeconds` (default `PROJECTILE_SECONDS`) and despawn on arrival.
   * Shared by the ranged strike (shooter → target) and, since F3, the mage
   * bolt + catapult lob launched on their `release` boundary (timed via
   * `ticksToSeconds(travelTicks)` to arrive on impact). The tracer lives in
   * `projectiles` (not `handles`) so `detach` sweeps it; note `animator.clear()`
   * drops the lerp WITHOUT firing `onArrive` (gotcha #108), so a battle that
   * ends mid-flight spawns no orphan callback. `targetProvider` (F3) makes the
   * lerp HOME on a moving target sprite (the catapult lob); absent → a fixed
   * destination (ranged tracer, mage ground-target bolt). `size` (Z3) overrides
   * the tracer glyph scale so an fx key can author it (defaults to PROJECTILE_SIZE).
   */
  private spawnProjectile(
    from: THREE.Vector3,
    to: THREE.Vector3,
    color: string,
    onArrive?: () => void,
    arcHeight = 0,
    durationSeconds = PROJECTILE_SECONDS,
    targetProvider?: () => THREE.Vector3 | null,
    size = PROJECTILE_SIZE,
  ): void {
    const proj = this.sprites.addSprite(PROJECTILE_GLYPH, color, from);
    this.sprites.updateSprite(proj, { bloomIntensity: PROJECTILE_BLOOM, size });
    this.projectiles.add(proj);
    this.animator.startLerp(
      proj,
      from,
      to,
      durationSeconds,
      () => {
        this.sprites.removeSprite(proj);
        this.projectiles.delete(proj);
        onArrive?.();
      },
      arcHeight,
      targetProvider,
    );
  }

  /**
   * §Z — the FX driver. Resolves the action's per-phase cue
   * (`actionId → AbilityDef.fx[phase] → FX_REGISTRY`) and drives its channels:
   * the unified sound, a `release`-boundary projectile, an `impact` burst. The
   * def-resolve path (the renderer reads the key off the def, not the event)
   * keeps the lean `action:phase` payload authoritative on the def. Any phase /
   * action with no `fx` key (every melee/bow/heal verb in Z1) falls straight
   * through — its FX still rides `unit:attacked` / `unit:healed`.
   */
  private onActionPhase = ({
    unitId,
    actionId,
    phase,
    targetId,
    targetCell,
  }: GameEvents['action:phase']): void => {
    const key = ABILITY_DEFS[actionId]?.fx?.[phase];
    if (!key) return;
    const fx = fxDescriptor(key);
    if (!fx || !this.world) return;

    // Unified cue (the Z VFX+SFX decision): the sound fires WITH the visual.
    if (fx.sound) this.audio.play(fx.sound);
    if (fx.projectile) this.launchProjectileFx(fx.projectile, unitId, targetId, targetCell);
    if (fx.burst) this.spawnBurstFx(fx.burst, unitId, targetId, targetCell);
    // Z2 — the camera shake is a Renderer-owned channel (it owns the camera +
    // render loop), so the driver just kicks it; the registry authors the magnitude.
    if (fx.shake) this.renderer.shakeCamera(fx.shake.intensity, fx.shake.durationSeconds);
    // Z3 — the single-target strike cues. They fire on the phase boundary the key
    // is authored on (impact for the weapons / bow, windup for the gambit), so a
    // MISS plays them for free: `action:phase` fires on hit AND miss alike.
    if (fx.shove) this.triggerShoveFx(fx.shove, unitId, targetId);
    if (fx.tracer) this.triggerTracerFx(fx.tracer, unitId, targetId);
  };

  /**
   * 27e — the status-lifecycle FX driver (the `onActionPhase` sibling). Resolves
   * the status def's `fx[moment]` → registry descriptor, then drives the named
   * channels off the LIVE unit: the unified sound (one key = visual + SFX), a
   * recolored sparkle on the body, and the DoT/HoT amount hitsplat + an HP-bar
   * refresh (when an `amount` is supplied). General over `moment`, but today only
   * `ticked` is wired (the apply flash was dropped post-playtest — see the
   * `status:ticked` subscription); §28/§29 can drive other moments. No-op when
   * the status/moment authors no key.
   */
  private driveStatusFx(
    statusId: string,
    moment: 'applied' | 'ticked' | 'expired' | 'active',
    unitId: number,
    amount?: number,
  ): void {
    const key = STATUS_DEFS[statusId]?.fx?.[moment];
    if (!key) return;
    const fx = fxDescriptor(key);
    if (!fx) return;
    if (fx.sound) this.audio.play(fx.sound);
    if (fx.sparkle) this.spawnSparkle(unitId, fx.sparkle.color);
    if (fx.hitsplat && amount !== undefined && amount > 0) {
      const text = fx.hitsplat.kind === 'heal' ? `+${amount}` : String(amount);
      this.spawnHitsplat(unitId, text, fx.hitsplat.kind);
      this.refreshHpBar(unitId);
    }
  }

  /**
   * A no-op tick (a HoT onto a full-HP unit, amount 0) drives nothing — no
   * sound, sparkle, or `+0` (the gotcha #80 "no zero-effect spam" rule the old
   * tile chip-heal followed). DoT ticks are always ≥ 1, so only HoTs short here.
   */
  private onStatusTicked = ({ unitId, statusId, amount }: GameEvents['status:ticked']): void => {
    if (amount === 0) return;
    this.driveStatusFx(statusId, 'ticked', unitId, amount);
  };

  /**
   * 28 — a behavior status with an `fx.active` overlay starts tinting the unit's
   * glyph. Tracked per-unit so a re-apply is idempotent (delete + re-set keeps
   * the last-applied-wins order) and an expiry restores the correct color.
   * Statuses with no `active` overlay (the DoTs, which cue on their ticks) no-op.
   */
  private onStatusApplied = ({ unitId, statusId }: GameEvents['status:applied']): void => {
    const key = STATUS_DEFS[statusId]?.fx?.active;
    const tint = key ? fxDescriptor(key)?.overlay?.tint : undefined;
    if (!tint) return;
    let tints = this.statusOverlays.get(unitId);
    if (!tints) {
      tints = new Map();
      this.statusOverlays.set(unitId, tints);
    }
    tints.delete(statusId); // re-insert at the end → most-recently-applied wins.
    tints.set(statusId, tint);
    this.refreshOverlayTint(unitId);
  };

  /**
   * 28 — a behavior status expired: drop its tint and recolor the unit to the
   * next-most-recent held overlay, or back to its team color when none remain.
   */
  private onStatusExpired = ({ unitId, statusId }: GameEvents['status:expired']): void => {
    const tints = this.statusOverlays.get(unitId);
    if (!tints || !tints.delete(statusId)) return;
    if (tints.size === 0) this.statusOverlays.delete(unitId);
    this.refreshOverlayTint(unitId);
  };

  /**
   * 28 — write the unit's current glyph color: the last-applied held overlay
   * tint, or its team color when no overlay remains. No-op when the unit's sprite
   * is gone (dead / detached). Reused on apply, expiry, and overlay cleanup.
   */
  private refreshOverlayTint(unitId: number): void {
    const handle = this.handles.get(unitId);
    if (!handle) return;
    const tints = this.statusOverlays.get(unitId);
    let color: string | undefined;
    if (tints && tints.size > 0) {
      // Map iteration is insertion-ordered; the last entry is the newest tint.
      for (const tint of tints.values()) color = tint;
    } else {
      const unit = this.world?.findUnit(unitId);
      // §40c — restore to the unit's BASE color, which for a destructible wall/cover
      // is the cracked tint (not the plain stone), so an expiring burn/frozen tint
      // doesn't repaint it as an indestructible wall.
      if (unit) color = spriteColorForUnit(unit);
    }
    if (color !== undefined) this.sprites.updateSprite(handle, { color });
  }

  /**
   * §Z (was F3's `onActionPhase` body) — fly a caster's projectile from its live
   * sprite toward the target, timed to ARRIVE on the impact tick. The flight
   * duration is read from the caster's live `travel` phase length (one source of
   * truth with the sim — no duplicated render const, no rounding drift).
   * `straight` flies level to the captured blast cell (mage); `arc` lobs a homing
   * parabola that re-reads the locked target's sprite each frame so the boulder
   * reaches it even after a wind-up step (catapult), falling back to the cast
   * cell if the sprite is gone. The impact burst lands separately on the `impact`
   * phase, so no onArrive VFX here.
   */
  private launchProjectileFx(
    spec: FxProjectile,
    casterId: number,
    targetId: number | undefined,
    targetCell: GridCoord | undefined,
  ): void {
    if (!this.world) return;
    const caster = this.world.findUnit(casterId);
    if (!caster) return;

    const travelTicks =
      caster.activeAction?.phases.find((p) => p.phase === 'travel')?.ticks ?? 0;
    const flightSeconds = travelTicks > 0 ? ticksToSeconds(travelTicks) : PROJECTILE_SECONDS;
    const color = colorForTeam(caster.team);
    const casterHandle = this.handles.get(casterId);
    // §79d — visual-center endpoints throughout (see triggerTracerFx).
    const from = (
      (casterHandle && this.unitVisualCenter(casterHandle, caster, this.scratchPos)) ??
      this.cellVisualCenter(caster.position)
    ).clone();

    if (spec.style === 'straight') {
      if (!targetCell) return;
      this.spawnProjectile(from, this.cellVisualCenter(targetCell), color, undefined, 0, flightSeconds);
      return;
    }

    const targetHandle = targetId !== undefined ? this.handles.get(targetId) : undefined;
    const target = targetId !== undefined ? this.world.findUnit(targetId) : undefined;
    const to = (
      (targetHandle && target && this.unitVisualCenter(targetHandle, target, this.scratchPos)) ??
      (targetCell ? this.cellVisualCenter(targetCell) : from)
    ).clone();
    // The homing provider re-derives the visual center each frame — fresh
    // camera-up too, so the lob stays glued to the glyph even mid-scroll.
    const provider = targetHandle && target
      ? (): THREE.Vector3 | null =>
          this.unitVisualCenter(targetHandle, target, this.homingScratch)
      : undefined;
    this.spawnProjectile(from, to, color, undefined, CATAPULT_ARC_HEIGHT, flightSeconds, provider);
  }

  /**
   * §Z (was `onMagicDetonated` / `onCatapultFired`) — the impact burst. An
   * `explosion` detonates a team-colored flash + spark ring at the captured
   * blast cell (mage); a `dud` kicks a neutral dust puff at the boulder's impact
   * cell — the live target sprite, falling back to the cast cell (catapult).
   * Z1 note: the dud now fires on EVERY landing (a boulder craters whether or
   * not it connected) — retiring the `hit`-carrying `catapult:fired` event
   * dropped the hit/abort distinction, and an always-on crater reads cleanly.
   */
  private spawnBurstFx(
    spec: FxBurst,
    casterId: number,
    targetId: number | undefined,
    targetCell: GridCoord | undefined,
  ): void {
    if (!this.world) return;
    if (spec.style === 'explosion') {
      if (!targetCell) return;
      const caster = this.world.findUnit(casterId);
      const color = caster ? colorForTeam(caster.team) : COLORS.TERMINAL_STONE;
      this.spawnExplosion(this.cellVisualCenter(targetCell), color);
      return;
    }

    // dud — at the live target sprite's visual center, else the cast cell's.
    const targetHandle = targetId !== undefined ? this.handles.get(targetId) : undefined;
    const target = targetId !== undefined ? this.world.findUnit(targetId) : undefined;
    const at =
      (targetHandle && target
        ? this.unitVisualCenter(targetHandle, target, this.scratchPos)?.clone()
        : undefined) ??
      (targetCell ? this.cellVisualCenter(targetCell) : undefined);
    if (at) this.spawnDud(at);
  }

  /**
   * E7.C — flash + spark-ring burst at `center`. One central flash glyph
   * that grows + fades, plus a ring of sparks that shoot outward to roughly
   * the 3×3 blast edge and fade. All ride the shared bloom pipeline so the
   * burst glows in the team color. Tunable via the EXPLOSION_* consts below.
   */
  private spawnExplosion(center: THREE.Vector3, color: string): void {
    // Central flash: stays put, grows large, fades.
    this.addExplosionParticle(
      center,
      center,
      EXPLOSION_FLASH_GLYPH,
      color,
      EXPLOSION_FLASH_SIZE_FROM,
      EXPLOSION_FLASH_SIZE_TO,
      EXPLOSION_FLASH_SECONDS,
    );
    // Spark ring: 8 tracers fly outward to the blast edge.
    for (const [dx, dz] of EXPLOSION_RING_DIRS) {
      const dest = center.clone();
      dest.x += dx * EXPLOSION_RING_SPREAD;
      dest.z += dz * EXPLOSION_RING_SPREAD;
      this.addExplosionParticle(
        center,
        dest,
        PROJECTILE_GLYPH,
        color,
        EXPLOSION_SPARK_SIZE,
        EXPLOSION_SPARK_SIZE,
        EXPLOSION_RING_SECONDS,
      );
    }
  }

  /**
   * E7.D — a small gray dust puff for a catapult-shot landing: a central
   * glyph that grows + fades plus a few short low-glow sparks, all in the
   * neutral stone color so it reads as "thud, no hit" rather than a team-
   * colored impact. Reuses the explosion-particle lane (swept by `detach`).
   */
  private spawnDud(center: THREE.Vector3): void {
    this.addExplosionParticle(
      center,
      center,
      EXPLOSION_FLASH_GLYPH,
      CATAPULT_DUD_COLOR,
      CATAPULT_DUD_FLASH_SIZE_FROM,
      CATAPULT_DUD_FLASH_SIZE_TO,
      CATAPULT_DUD_SECONDS,
      CATAPULT_DUD_BLOOM,
    );
    for (const [dx, dz] of EXPLOSION_RING_DIRS.slice(0, 4)) {
      const dest = center.clone();
      dest.x += dx * CATAPULT_DUD_SPREAD;
      dest.z += dz * CATAPULT_DUD_SPREAD;
      this.addExplosionParticle(
        center,
        dest,
        PROJECTILE_GLYPH,
        CATAPULT_DUD_COLOR,
        CATAPULT_DUD_SPARK_SIZE,
        CATAPULT_DUD_SPARK_SIZE,
        CATAPULT_DUD_SECONDS,
        CATAPULT_DUD_BLOOM,
      );
    }
  }

  /**
   * F5 / 27e — a brief recolored mote burst ON a unit. One shape serves both the
   * F5 ability-heal twinkle (cyan, gated to ability heals in the `unit:healed`
   * handler) and the 27e status cues (amber burn embers, green poison, red
   * bleed, cyan rejuvenate), parameterized by `color`. Reads the unit's LIVE
   * sprite position like `spawnHitsplat` (so it tracks a mid-lerp sprite), but
   * anchors on the BODY (`SPARKLE_Y_OFFSET`) rather than the top edge where the
   * number floats — in a crowd that keeps the cloud reading as on THIS unit, not
   * the one behind it. A handful of `*` motes rise + fan out and fade, reusing
   * the explosion-particle lane (swept by `detach`).
   */
  private spawnSparkle(unitId: number, color: string): void {
    const handle = this.handles.get(unitId);
    if (!handle) return;
    const unit = this.world?.findUnit(unitId);
    if (!unit) return;
    // §79d — the burst hugs the glyph as SEEN: the ink's visual center + the
    // tuned camera-up nudge (SPARKLE_Y_OFFSET), with the mote fan in world XZ.
    const center = this.unitVisualCenter(handle, unit, this.scratchPos);
    if (!center) return;
    aboveAnchor(center, SPARKLE_Y_OFFSET, this.renderer.camera, center);
    for (const [dx, dz] of SPARKLE_DIRS) {
      const dest = center.clone();
      dest.x += dx * SPARKLE_SPREAD;
      dest.z += dz * SPARKLE_SPREAD;
      dest.y += SPARKLE_RISE;
      this.addExplosionParticle(
        center,
        dest,
        SPARKLE_GLYPH,
        color,
        SPARKLE_SIZE,
        SPARKLE_SIZE,
        SPARKLE_SECONDS,
        SPARKLE_BLOOM,
      );
    }
  }

  private addExplosionParticle(
    from: THREE.Vector3,
    to: THREE.Vector3,
    glyph: string,
    color: string,
    sizeFrom: number,
    sizeTo: number,
    duration: number,
    bloom: number = EXPLOSION_BLOOM,
    alphaScale = 1,
  ): void {
    const handle = this.sprites.addSprite(glyph, color, from);
    this.sprites.updateSprite(handle, {
      size: sizeFrom,
      bloomIntensity: bloom,
      alpha: alphaScale,
    });
    this.explosions.push({
      handle,
      elapsed: 0,
      duration,
      from: from.clone(),
      to: to.clone(),
      sizeFrom,
      sizeTo,
      alphaScale,
    });
  }

  private refreshHpBar(unitId: number): void {
    if (!this.world) return;
    const unit = this.world.findUnit(unitId);
    const overlay = this.overlayHandles.get(unitId);
    if (!unit || !overlay) return;
    const pct = Math.max(0, unit.currentHp) / unit.derived.maxHp;
    this.overlays.updateHp(overlay, pct);
  }

  /**
   * Fade the dead unit's sprite out, then remove it. Cancels any in-flight
   * position lerp / shove so they can't fight the fade. The overlay fades
   * alongside the sprite for visual coherence, then gets removed.
   */
  private onUnitDied = ({ unitId }: GameEvents['unit:died']): void => {
    const handle = this.handles.get(unitId);
    if (!handle) return;
    this.animator.cancel(handle);
    this.progress.delete(unitId);
    // 28 — drop any held status-overlay tints (the unit fades out in its last
    // tint; the map entry would otherwise leak until reset).
    this.statusOverlays.delete(unitId);
    // D5.C — if the unit died mid-spawn-in fade (rare but possible if
    // checkBattleEnd or AoE wipes a freshly-queued unit), drop the
    // overlay fade-in so it doesn't fight the fade-out below.
    this.overlayFadeIns.delete(unitId);
    this.animator.startFade(handle, FADE_SECONDS, () => {
      this.sprites.removeSprite(handle);
      this.handles.delete(unitId);
    });
    const overlay = this.overlayHandles.get(unitId);
    if (overlay) {
      this.overlayFades.set(unitId, { elapsed: 0, duration: FADE_SECONDS, handle: overlay });
      this.overlayHandles.delete(unitId);
    }
  };

  /**
   * Per-frame overlay driver. Three responsibilities:
   *
   * 1. Overlay position-follow: project the sprite's *current* world
   *    position to CSS pixels each frame. Reading from
   *    SpriteRenderer.getPosition picks up SpriteAnimator lerps for
   *    free, so overlays glide with their unit through a move instead
   *    of teleporting to the destination cell.
   * 2. Progress bar fill: anchor the render clock to `activeAction.startTick`
   *    transitions so progress fills smoothly between sim ticks. The
   *    Clock owns sub-tick time and doesn't expose it, but anchoring on
   *    `renderClockMs` (Q1: the scaled-dt accumulator) at the first frame we
   *    observe an activeAction gives equivalent smoothness for actions long
   *    enough to matter — AND, because that clock advances at game speed and
   *    freezes at pause, the fill rate tracks speed (the pre-Q1 wall-clock
   *    `performance.now()` filled at 1× regardless / kept running while paused).
   *    The progress bar is hidden (null) when no action is in flight.
   * 3. Overlay fade on death / spawn: lerp opacity 0↔1 over FADE_SECONDS
   *    or SPAWN.durationSeconds, then remove the overlay on death.
   */
  private updateOverlays(dt: number): void {
    // Q1 — the progress bar's clock is the scaled-dt render accumulator, not
    // `performance.now()`; that's what makes it honor speed + pause.
    const now = this.renderClockMs;

    // Drive post-death fades; remove when complete.
    for (const [unitId, fade] of this.overlayFades) {
      fade.elapsed += dt;
      const t = fade.elapsed >= fade.duration ? 1 : fade.elapsed / fade.duration;
      const alpha = 1 - t;
      this.overlays.setAlpha(fade.handle, alpha);
      this.overlays.updateProgress(fade.handle, null);
      if (t >= 1) {
        this.overlays.remove(fade.handle);
        this.overlayFades.delete(unitId);
      }
    }

    // D5.C — drive overflow-spawn fade-ins; overlay lerps 0 → 1, the
    // progress bar stays hidden (the spawn lockout is filtered out of
    // updateProgressFill, so no progress writes will fight this).
    for (const [unitId, fadeIn] of this.overlayFadeIns) {
      fadeIn.elapsed += dt;
      const t = fadeIn.elapsed >= fadeIn.duration ? 1 : fadeIn.elapsed / fadeIn.duration;
      this.overlays.setAlpha(fadeIn.handle, t);
      if (t >= 1) this.overlayFadeIns.delete(unitId);
    }

    const world = this.world;
    if (!world) return;

    for (const [unitId, overlay] of this.overlayHandles) {
      const handle = this.handles.get(unitId);
      const unit = world.findUnit(unitId);
      if (!handle || !unit) continue;
      // §79e — follow the glyph's visible INK TOP so the CSS stack sits a fixed
      // SCREEN distance off the letterform at any board edge and any depth
      // (`--overlay-gap`). Supersedes §79d2's deliberate uniform half-quad
      // line — see `inkTopLiftFor` for the reversal and what it costs.
      const spritePos = this.sprites.getPosition(handle, this.scratchPos);
      if (!spritePos) continue;
      const inkTop = aboveAnchor(
        spritePos,
        this.inkTopLiftFor(unit),
        this.renderer.camera,
        spritePos,
      );

      this.overlays.updatePosition(overlay, inkTop);
      this.updateProgressFill(unitId, unit, overlay, now);

      // §32c — refresh the status pip-strip only when the sim tick advanced
      // (the readout is identical between ticks; CSS smooths the depletion),
      // so this recomputes at most once per tick per unit, not every frame.
      if (overlay.statusTick !== world.currentTick) {
        overlay.statusTick = world.currentTick;
        this.overlays.updateStatuses(overlay, readUnitStatuses(unit.effects, world.currentTick));
      }
    }
  }

  private updateProgressFill(
    unitId: number,
    unit: Unit,
    overlay: UnitOverlayHandle,
    now: number,
  ): void {
    const active = unit.activeAction;
    // Hide the progress bar for movement — every step would flash a 1-tick
    // bar, which reads as visual noise. The bar is meant for "this unit is
    // doing something that takes time" (attack swings, charge-ups, channels);
    // movement is handled by the sprite lerp itself.
    //
    // D5.C — also hide during SpawnAction lockout. The fade-in is the
    // visual feedback for spawning; a second progress bar on top of a
    // half-faded sprite would compete for attention.
    if (
      !active ||
      active.finishTick <= active.startTick ||
      active.action.id === MOVE_ACTION_ID ||
      active.action.id === SPAWN_ACTION_ID
    ) {
      if (this.progress.has(unitId)) this.progress.delete(unitId);
      this.overlays.updateProgress(overlay, null);
      return;
    }

    let entry = this.progress.get(unitId);
    if (!entry || entry.startTick !== active.startTick) {
      const ticks = active.finishTick - active.startTick;
      const durationMs = (ticks * 1000) / TICK_RATE;
      // If this is the first frame we see an already-running action (e.g.
      // started mid-tick before our update fires), back-date the anchor by
      // the integer ticks that have already elapsed so the bar resumes at
      // the right fill rather than restarting from 0.
      const elapsedTicks = Math.max(0, (this.world?.currentTick ?? active.startTick) - active.startTick);
      const elapsedMs = (elapsedTicks * 1000) / TICK_RATE;
      entry = { startTick: active.startTick, startedAtMs: now - elapsedMs, durationMs };
      this.progress.set(unitId, entry);
    }

    const elapsed = now - entry.startedAtMs;
    const fillPct = Math.max(0, Math.min(1, elapsed / entry.durationMs));
    this.overlays.updateProgress(overlay, fillPct);
  }
}

/** Duration of the dead-unit alpha fade-out (sprite + overlay). */
const FADE_SECONDS = 0.3;

/**
 * E6.A — melee shove geometry. The attacker lunges this far (world units,
 * ≈ tiles) toward its target, then recovers. A fast snap out + a slightly
 * slower recover reads as a committed strike rather than a wobble; total
 * ~0.2s comfortably fits inside the shortest attack cadence.
 */
const SHOVE_DISTANCE = 0.35;
const SHOVE_OUT_SECONDS = 0.07;
const SHOVE_BACK_SECONDS = 0.13;

/**
 * §36c — settle-back recoil. When a deferred move aborts mid-flight, the sprite
 * eases from wherever the slide reached back to its `from` cell over this window.
 * Short (a touch above the shove's ~0.2s out+back) so it reads as a quick "pulled
 * back" recoil and clears before any concurrent melee-hit anim — but long enough
 * to register as motion rather than a teleport (the snap the design call rejected).
 */
const SETTLE_BACK_SECONDS = 0.22;

/**
 * E6.B — ranged projectile tracer. The glyph flies a straight line from
 * shooter to target (per the E6 decision) over a fixed duration regardless
 * of distance, so a shot reads as fast and stays well inside the attack
 * cadence. The tracer reuses the shared SpriteRenderer, so it renders at
 * the same world size as a unit glyph (no per-instance scale); `*` reads
 * smaller than a letter thanks to its internal whitespace. PROJECTILE_BLOOM
 * pushes it above the unit baseline (0.15) so it glows like a bolt.
 */
const PROJECTILE_GLYPH = '*';
const PROJECTILE_SECONDS = 0.18;
// §29c — the chain arc flies faster than a bow bolt so each zap arrives within its
// hop's delay window (`hopDelaySeconds` ≈ 0.1s), reading as a snappy "zap…zap…zap".
const CHAIN_ARC_SECONDS = 0.08;
const PROJECTILE_BLOOM = 1.2;
/** Per-sprite size multiplier for the tracer (1 = full unit-glyph size).
 *  Shrinks the `*` so it reads as a bolt rather than a flying letter. */
const PROJECTILE_SIZE = 0.6;

/**
 * E7.C — magic-bolt explosion tuning. The flash is a central `*` that grows
 * from FLASH_SIZE_FROM → FLASH_SIZE_TO while fading; the spark ring is 8 `*`
 * tracers that shoot RING_SPREAD world units outward (cells are 1×1, blast
 * radius is 1, so ~1.1 lands the sparks at the 3×3 edge) and fade. EXPLOSION_
 * BLOOM pushes the whole burst well above the unit baseline so it glows. All
 * eyeball-tuned — bump freely.
 */
const EXPLOSION_FLASH_GLYPH = '*';
const EXPLOSION_FLASH_SIZE_FROM = 0.8;
const EXPLOSION_FLASH_SIZE_TO = 3.0;
const EXPLOSION_FLASH_SECONDS = 0.35;
const EXPLOSION_SPARK_SIZE = 0.55;
const EXPLOSION_RING_SPREAD = 1.1;
const EXPLOSION_RING_SECONDS = 0.3;
const EXPLOSION_BLOOM = 2.2;
/** 8 unit-ish directions (orthogonal + diagonal, diagonals normalized) so the
 *  spark ring expands evenly to the blast edge. */
const EXPLOSION_RING_DIRS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [0.7071, 0.7071],
  [0.7071, -0.7071],
  [-0.7071, 0.7071],
  [-0.7071, -0.7071],
];

/**
 * F5 / 27e — sparkle tuning (a small mote burst ON a unit). One shape, recolored
 * per caller: the F5 ability-heal twinkle (cyan) and the 27e status cues (burn
 * amber, bleed red, poison green, rejuvenate cyan). Reuses the explosion-particle
 * lane: a few `*` motes that rise + fan out gently and fade; smaller/dimmer than
 * the mage explosion (a soothe / affliction pulse, not a boom). The COLOR is
 * passed by the caller (`spawnSparkle`). All eyeball-tunable — bump freely.
 */
const SPARKLE_GLYPH = PROJECTILE_GLYPH; // already in the FontAtlas
const SPARKLE_SIZE = 0.4;
const SPARKLE_SPREAD = 0.45; // lateral fan, world units
const SPARKLE_RISE = 0.35; // upward drift from the anchor, world units (the "lift")
const SPARKLE_SECONDS = 0.45;
const SPARKLE_BLOOM = 1.6;
/** Camera-up nudge of the sparkle's anchor, from the glyph's VISUAL CENTER
 *  (§79d: `unitVisualCenter` + this via `aboveAnchor`). Deliberately decoupled
 *  from the hitsplat (which floats at the visual TOP, where the number goes):
 *  the sparkle hugs the unit's BODY so in a crowd it reads as on THIS unit,
 *  not the one standing behind it. §32c (32d fold-in) — dropped from center
 *  (0) to -0.175 so the puff sits a touch LOWER on the body; with SPARKLE_RISE
 *  (0.35) the cloud peaks around +0.175, well clear of the floating number.
 *  Eyeball-tunable: toward 0 raises it, more-negative lowers it further. */
const SPARKLE_Y_OFFSET = -0.175;
/** Center mote + 4 orthogonal fan directions (XZ plane); every mote also
 *  rises by SPARKLE_RISE so the burst lifts off the unit. */
const SPARKLE_DIRS: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/**
 * §76g2 — aura-range ring tuning (the playtest insertion: pips only prove the
 * buff applies; the ring makes the RADIUS legible). Faint `.` motes shed along
 * the aura's square boundary, rising gently and fading. Deliberately a
 * whisper — small, half-alpha, sub-unit bloom — legible when looked for, not
 * competing with combat FX; the density knobs (interval × motes) trade
 * legibility against clutter with multiple carriers. `.` is already an atlas
 * cell (HUD punctuation), so the ring costs no atlas budget. All
 * eyeball-tunable — bump freely.
 */
const AURA_RING_GLYPH = '.';
const AURA_RING_INTERVAL_SECONDS = 0.15;
/** Motes shed per carrier per interval. */
const AURA_RING_MOTES = 4;
/** The boundary sits at the affected cells' OUTER edge: radius + half a cell. */
const AURA_RING_EDGE = 0.5;
const AURA_RING_SIZE = 0.3;
/** Gentle upward drift over the mote's life (world units). */
const AURA_RING_RISE = 0.22;
/** Hug the ground: §79d made the sprite anchor the GROUND point itself, so a
 *  small POSITIVE world-Y float keeps the motes just off the floor (same world
 *  height as the pre-79d −0.35 under the old +0.5-lifted center). World-Y is
 *  correct here — the ring is a world-space floor decoration, not a
 *  screen-stacked overlay. */
const AURA_RING_Y_OFFSET = 0.15;
const AURA_RING_SECONDS = 0.6;
const AURA_RING_BLOOM = 0.8;
const AURA_RING_ALPHA = 0.5;

/**
 * §76g3 — aura pulse tuning (the layered "sonar ping", user-requested after
 * the 76g2 ring read well). A full square wavefront expands from the carrier
 * to the boundary every interval — brighter and more coherent than the idle
 * ring (it's the "this radiates" statement; the ring is the "where's the
 * edge" reference), but still under combat-FX intensity. Interval is long
 * enough that the ping punctuates rather than strobes. All eyeball-tunable —
 * bump freely.
 */
/** 4 per side × 4 sides = 16 motes per pulse per carrier. */
const AURA_PULSE_SAMPLES_PER_SIDE = 4;
const AURA_PULSE_INTERVAL_SECONDS = 0.9;
/** Fraction of the boundary offset the wave starts at — just off the carrier's
 *  body, so 16 spawning motes don't bloom-flash as a single clump. */
const AURA_PULSE_START_FRAC = 0.15;
const AURA_PULSE_SIZE = 0.32;
const AURA_PULSE_SECONDS = 1.8;
const AURA_PULSE_BLOOM = 1.1;
const AURA_PULSE_ALPHA = 0.7;

/** §76g4 'fill' — motes per shed interval when the whole aura AREA is sampled
 *  instead of the boundary. Higher than AURA_RING_MOTES because the area
 *  (~(2r)² cells) dilutes density that the perimeter (~8r) concentrated. */
const AURA_FILL_MOTES = 8;

/**
 * E7.D — catapult shot tuning. The lobbed boulder arcs CATAPULT_ARC_HEIGHT
 * world units above the straight caster→impact line (peak at the midpoint),
 * reading as an over-the-wall siege shot rather than a flat bolt. On an
 * aborted shot (target died mid-charge) the projectile lands in a gray dust
 * DUD — a small central puff + 4 short low-glow sparks in the neutral stone
 * color, so a fizzle shows "thud, no hit" instead of nothing. All eyeball-
 * tunable — bump freely.
 */
const CATAPULT_ARC_HEIGHT = 2.0;
const CATAPULT_DUD_COLOR = COLORS.TERMINAL_STONE;
const CATAPULT_DUD_FLASH_SIZE_FROM = 0.5;
const CATAPULT_DUD_FLASH_SIZE_TO = 1.6;
const CATAPULT_DUD_SPARK_SIZE = 0.4;
const CATAPULT_DUD_SPREAD = 0.5;
const CATAPULT_DUD_SECONDS = 0.35;
const CATAPULT_DUD_BLOOM = 0.3;

/**
 * §79d — half a unit glyph's quad height in world units (`uSpriteSize` 1 × the
 * default `instanceSize` 1). THE vertical vocabulary of the anchor convention:
 * a base-anchored glyph's visual CENTER is one of these above its ground
 * anchor (×footprint for scaled bodies), its visual TOP is two — always along
 * CAMERA-UP via `aboveAnchor`, never world-Y. Replaces the retired
 * `SPRITE_CENTER_OFFSET` (the world-Y anchor lift the 79b probe measured
 * skewing edge sprites off their tiles) and `HITSPLAT_Y_OFFSET` (subsumed by
 * "the visual top").
 */
const GLYPH_HALF_HEIGHT = 0.5;

/**
 * J3 — the in-battle objective marker (an `X` glyph billboard). Pure-VFX render
 * consts (the ROADMAP allows isolated render consts for VFX rather than config):
 *  - `_COLOR`  amber so it reads as a waypoint, distinct from player-green /
 *              enemy-red, and `_BLOOM` gives it a faint glow so it pops.
 *  - tile vs enemy SIZE: a rally tile draws LARGER (the user's call — a big X on
 *    the ground); an enemy mark rides smaller, just atop the target glyph.
 *  - `_TILE_LIFT` — the extra camera-up gap the rally X floats above
 *    glyph-center height over its cell (§79d: composed as
 *    `GLYPH_HALF_HEIGHT + _TILE_LIFT` through `aboveAnchor`).
 *    `_ENEMY_LIFT` — the camera-up gap the enemy mark rides above the target
 *    glyph's visual CENTER — see `updateObjectiveMarker`.
 *
 * J3 playtest fixes (2026-06-09): enemy size 1.0→0.5 (was ~2× too large) and the
 * enemy lift moved off world-Y onto camera-up (a world-Y offset projects
 * off-axis under the pitched perspective → the mark skewed sideways for units
 * away from screen center; the same off-axis drift the I2 hitsplat fix solved —
 * §79d generalized that fix into the anchor convention + `aboveAnchor`).
 */
/** J3 — the world-space quad extent of a unit billboard for the click hit-test
 *  (`enemyBillboards`): uSpriteSize (1) × the unit's instanceSize (1). Units
 *  always render at the default size — only projectiles/markers override it. */
const UNIT_PICK_SIZE = 1;

const OBJECTIVE_MARKER_GLYPH = 'X'; // registered in glyphs.ts (J3, last atlas cell).
/** Q3 — the FOCUS marker glyph (vs engage's 'X'), so the player reads which mode
 *  a steered objective is. Already in the glyph atlas (a punctuation cell), so no
 *  grid resize. Hold/Stop carry no target → no marker at all. */
const OBJECTIVE_MARKER_FOCUS_GLYPH = '!';
const OBJECTIVE_MARKER_COLOR = COLORS.TERMINAL_AMBER;
const OBJECTIVE_MARKER_BLOOM = 0.6;
const OBJECTIVE_MARKER_TILE_SIZE = 1.6;
const OBJECTIVE_MARKER_ENEMY_SIZE = 0.5;
const OBJECTIVE_MARKER_TILE_LIFT = 0.1;
/** §79d2 — the camera-up GAP between the target glyph's visible INK TOP and
 *  the enemy mark's own ink (both ends are ink-true now: the target's top via
 *  `inkTopLift`, the mark via its base anchor). 0.2 reproduces the pre-79d2
 *  look, where 0.6-above-center worked out to ≈0.19 above the ink. */
const OBJECTIVE_MARKER_ENEMY_LIFT = 0.2;

/**
 * Grid → world coordinates (XZ only). Cells are 1×1; the grid is centered
 * on the world origin. `cell.y` (grid axis 2) maps to world `-z` so grid
 * (0, 0) is the near-left cell from the camera's POV — matches the
 * "(0, 0) is bottom-left" convention in core/types.ts.
 *
 * D3: X and Z half-extents come from `gridW` and `gridH` independently
 * so rectangular arenas stay centered on the world origin (pre-D3 took
 * a single `gridSize`).
 *
 * Y defaults to 0 (the flat ground plane) for callers without per-tile-height
 * context — the only external consumer (BattleScene's camera-scroll anchor)
 * reads XZ only; BattleRenderer sets Y per cell via `tileGroundPos`. (§79d:
 * this default was `SPRITE_CENTER_OFFSET` back when world anchors carried the
 * presentation lift.)
 */
export function gridToWorld(cell: GridCoord, gridW: number, gridH: number): THREE.Vector3 {
  const halfX = gridW / 2;
  const halfZ = gridH / 2;
  return new THREE.Vector3(cell.x + 0.5 - halfX, 0, halfZ - cell.y - 0.5);
}
