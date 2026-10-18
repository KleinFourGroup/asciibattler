import * as THREE from 'three';
import type { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import type { GridCoord } from '../core/types';
import type { World } from '../sim/World';
import type { ObjectiveTarget } from '../sim/objective';
import { isInertNeutral, type Unit } from '../sim/Unit';
import type { SpriteHandle, SpriteRenderer } from './SpriteRenderer';
import { t } from '../i18n/ui';
import { aboveAnchor } from './anchor';
import { BASE_ANCHOR_Y } from './glyphs';
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
  hitsplatText,
  type FxBurst,
  type FxProjectile,
  type FxShove,
  type FxTracer,
  type HitsplatKind,
} from './fxRegistry';
import { reducedMotion } from './motion';
import { TICK_RATE, ticksToSeconds } from '../config';
import { ABILITY_DEFS } from '../config/abilities';
import { STATUS_DEFS } from '../config/statuses';
import { MOVE_ACTION_ID } from '../sim/actions/MoveAction';
import { SPAWN_ACTION_ID } from '../sim/actions/SpawnAction';
import { footprintOf } from '../sim/occupancy';
import { isDestructibleNeutral } from '../config/units';
import { readUnitStatuses } from '../sim/statusReadout';
import { SIM } from '../config/sim';
import { statusColor } from './statusDisplay';
import { auraFxMode } from './auraFx';
import { footprintCentre, slabAnchor, slabGroundOf, slabViewOf } from './slabAnchor';
import { isDashedPlate, markExtent, markShapeOf, type MarkShape } from './groundMarks';

/**
 * The simulation/render seam. Subscribes to sim events and turns them into
 * SpriteRenderer and UnitOverlayLayer calls; the sim never imports from
 * render. A new event gets a handler here, and the renderers stay plain
 * instance-buffer and DOM managers.
 *
 * Owns the SpriteAnimator that turns `unit:moved` into slides. BattleScene
 * calls `update(dt)` once per render frame, which drives the slides, the
 * overlays' follow and the action bars' fill.
 */

/** An in-flight action's start, so its bar fills smoothly between sim ticks. */
interface ActiveProgress {
  /** The action's `startTick`; a different one re-anchors the bar. */
  startTick: number;
  /** `renderClockMs` when the render loop first saw this action. The render
   *  clock advances by the same speed-scaled `dt` the sim sees and freezes at
   *  pause, so the fill keeps to the game's speed. */
  startedAtMs: number;
  /** The action's length in ms, `(finishTick - startTick) / TICK_RATE`. */
  durationMs: number;
}

interface OverlayFade {
  elapsed: number;
  readonly duration: number;
  readonly handle: UnitOverlayHandle;
}

/** A mid-battle spawn's overlay fade-in: opacity 0 → 1 over `duration`. The
 *  action bar stays hidden through the spawn lockout (`updateProgressFill`
 *  filters SpawnAction beside MoveAction). */
interface OverlayFadeIn {
  elapsed: number;
  readonly duration: number;
  readonly handle: UnitOverlayHandle;
}

/**
 * One particle of the burst lane: an explosion's flash or spark, a dud's, a
 * sparkle's mote or an aura ring's. A standalone sprite (not a unit, not in
 * `handles`) driven per render frame: it eases `from → to` while its size
 * goes `sizeFrom → sizeTo` and its alpha fades to 0, then removes itself.
 * Swept by `detach` like the projectiles.
 */
interface ExplosionParticle {
  readonly handle: SpriteHandle;
  elapsed: number;
  readonly duration: number;
  readonly from: THREE.Vector3;
  readonly to: THREE.Vector3;
  readonly sizeFrom: number;
  readonly sizeTo: number;
  /** The fade's peak alpha (1 by default), so the aura ring rides the lane
   *  at a whisper without dimming the bursts. */
  readonly alphaScale: number;
}

/**
 * One mote of a `track`-mode aura pulse (the modes are in ./auraFx.ts): it
 * re-anchors to its carrier's live sprite every frame, so the wave glides
 * with the carrier.
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

/**
 * A body's ground mark, fixed at spawn: its side's shape, its colour
 * (linear RGB of `spriteColorForUnit`, which no held tint reaches) and, for an
 * N×N body, where it lies. Recorded then because a dying body leaves
 * `world.units` at once while its sprite, and so its mark, fades.
 */
interface MarkSpec {
  readonly shape: MarkShape;
  readonly dashed: boolean;
  readonly footprint: number;
  readonly r: number;
  readonly g: number;
  readonly b: number;
  /** An N×N body's footprint centre (its sprite is slid by the slab rule);
   *  null = the mark follows the sprite's ground point. */
  readonly fixed: { readonly x: number; readonly z: number } | null;
}

export class BattleRenderer {
  private readonly handles = new Map<number, SpriteHandle>();
  /** unitId → its ground mark, for every body in `handles`. */
  private readonly markSpecs = new Map<number, MarkSpec>();
  private readonly markColour = new THREE.Color();
  private readonly overlayHandles = new Map<number, UnitOverlayHandle>();
  /**
   * Each unit's held status tints, `unitId → (statusId → tint hex)`. A
   * behavior status's `fx.active` overlay recolors the unit's glyph from
   * apply to expiry; the inner Map's insertion order decides which tint shows
   * when several are held (the latest applied) and when the team color
   * returns (at the last expiry). Cleared on death and by `detach`.
   */
  private readonly statusOverlays = new Map<number, Map<string, string>>();
  private readonly subscriptions: Array<() => void> = [];
  private readonly animator: SpriteAnimator;
  /** In-flight projectile sprites (the tracers, the flights, the chain's
   *  arcs). They live in the shared SpriteRenderer but not in `handles`
   *  (they're not units), so `detach` sweeps them separately. */
  private readonly projectiles = new Set<SpriteHandle>();
  /** The burst lane's live particles. Like `projectiles`, they live in the
   *  shared SpriteRenderer but not in `handles`, and `detach` sweeps them. */
  private readonly explosions: ExplosionParticle[] = [];
  /** Gates the aura ring's mote shed, in speed-scaled dt, so the ring slows
   *  with playback and freezes at pause. */
  private auraRingClock = 0;
  /** Gates the aura's pulse (the expanding wavefront), apart from the ring's
   *  clock so the two cadences tune separately. */
  private auraPulseClock = 0;
  /** The `track` mode's carrier-tracked pulse motes: each frame's position
   *  comes from the live sprite, so they can't live in `explosions`, whose
   *  from and to are fixed at spawn. Swept by `detach`. */
  private readonly auraPulses: AuraPulseParticle[] = [];
  /** Scratch for the tracked pulse's carrier-center read, apart from
   *  `scratchPos`, which holds each mote's position in the same loop. */
  private readonly auraScratch = new THREE.Vector3();
  /** unitId → in-flight action timing for the progress bar. */
  private readonly progress = new Map<number, ActiveProgress>();
  /** unitId → the re-aim drain window (`unit:actionHeld`). An entry expires
   *  by render-clock time in `updateProgressFill`, or the moment a real
   *  action bar claims the element. */
  private readonly reaims = new Map<number, { startedAtMs: number; durationMs: number }>();
  /** Render time in ms, advanced by the speed-scaled `dt` each frame (the
   *  `dt` BattleScene feeds the sim). The action bar fills against this, not
   *  `performance.now()`, so it keeps to the game's speed and freezes at
   *  pause (`dt === 0`). */
  private renderClockMs = 0;
  /** unitId → ongoing post-death overlay fade. */
  private readonly overlayFades = new Map<number, OverlayFade>();
  /** unitId → a mid-battle spawn's overlay fade-in. */
  private readonly overlayFadeIns = new Map<number, OverlayFadeIn>();
  /** Scratch vector to avoid per-frame allocation when reading sprite positions. */
  private readonly scratchPos = new THREE.Vector3();
  /** Scratch for a homing projectile's per-frame target read, apart from
   *  `scratchPos` so the two can't alias mid-frame. */
  private readonly homingScratch = new THREE.Vector3();
  /**
   * The player's objective target and its marker sprite, an `X` billboard
   * (`!` for focus) that `updateObjectiveMarker` places every frame: a tile
   * stays put, an enemy mark tracks the target's live position. Driven by
   * `objective:set` / `objective:cleared` alone, so the marker is right
   * however the objective was set (mouse, hotkey, AI, fuzz). Only the
   * player's objective draws one, and only one with a target (`engage` or
   * `focus`).
   */
  private objective: ObjectiveTarget | null = null;
  private objectiveMarker: SpriteHandle | null = null;
  /** The marker's glyph ('X' engage, '!' focus), so the placement can
   *  subtract that glyph's own ink-bottom lift (the terminal cell's room) and
   *  stand the ink, not the anchor, at the designed gap. */
  private objectiveMarkerGlyph: string = OBJECTIVE_MARKER_GLYPH;
  /**
   * The currently-attached battle World. Null when no battle is running (map
   * screen, defeat state). Set by `attach`, cleared by `detach`.
   */
  private world: World | null = null;

  constructor(
    private readonly sprites: SpriteRenderer,
    private readonly overlays: UnitOverlayLayer,
    /** Queried at sprite spawn and at move endpoints, so units stand on the
     *  tile top instead of floating at a fixed plane. */
    private readonly terrain: TerrainRenderer,
    /** The render host: the FX driver kicks its `shakeCamera`, and every
     *  camera-up lift (`aboveAnchor`) reads its camera, so a lift doesn't
     *  skew off-axis the way a world-Y lift does under pitch. */
    private readonly renderer: Renderer,
    /** The FX driver plays a cue's sound (one key, its visual and its
     *  sound). The renderer plays every keyed combat cue; the cues with no key
     *  (a death, the ability heal, the dash's leap) are rows of
     *  src/audio/eventSounds.ts, which Game attaches. */
    private readonly audio: AudioPlayer,
    bus: EventBus<GameEvents>,
  ) {
    // Every `fx` key the ability and status catalogs name must resolve in the
    // registry, so a typo throws here, at battle start, not silently on screen.
    assertFxKeysResolve(ABILITY_DEFS);
    assertStatusFxKeysResolve(STATUS_DEFS);
    this.animator = new SpriteAnimator(this.sprites);
    this.subscriptions.push(bus.on('unit:spawned', this.onUnitSpawned));
    this.subscriptions.push(bus.on('unit:moved', this.onUnitMoved));
    this.subscriptions.push(bus.on('unit:moveAborted', this.onUnitMoveAborted));
    // A release-gate hold: the amber drain bar over the re-aim window, the
    // tell that the unit is re-aiming, not idle (`updateProgressFill`).
    this.subscriptions.push(bus.on('unit:actionHeld', this.onUnitActionHeld));
    this.subscriptions.push(bus.on('unit:swapped', this.onUnitSwapped));
    this.subscriptions.push(bus.on('unit:swapAborted', this.onUnitSwapAborted));
    this.subscriptions.push(bus.on('unit:attacked', this.onUnitAttacked));
    // A dodged single-target strike: "Miss" floats instead of a number. The
    // swing rides `action:phase`, which fires on a miss too.
    this.subscriptions.push(bus.on('unit:missed', this.onUnitMissed));
    this.subscriptions.push(bus.on('unit:died', this.onUnitDied));
    // The FX driver: every keyed combat cue resolves off the action's phase
    // boundaries (`actionId → AbilityDef.fx[phase] → FX_REGISTRY →
    // descriptor`), then drives the named channels and the sound. The mage
    // bolt and the catapult launch on `release` and fly through the `travel`
    // phase, so they land on the impact tick, and detonate on `impact`.
    this.subscriptions.push(bus.on('action:phase', this.onActionPhase));
    // The chain lightning's arc, drawn once a hop off `unit:chained`: each
    // event fires on the tick its hop's damage lands, so the tracer travels
    // jump by jump. The hop's number rides its own `unit:attacked`; this draws
    // only the connecting arc.
    this.subscriptions.push(bus.on('unit:chained', this.onUnitChained));
    // The status cues, resolved through the FX registry like `action:phase`
    // (the status def's `fx[moment]` → key → descriptor → channels). Only
    // `ticked` is wired: each tick puffs a recolored mote burst, floats the
    // amount, plays the status's sound and keeps the HP bar in sync. There is
    // no cue on `applied`: a unit's position flips onto its new tile mid-slide
    // (`MoveAction`), so an apply cue would show a burn before the sprite
    // arrives; the first tick, one interval later, is the first cue.
    this.subscriptions.push(bus.on('status:ticked', this.onStatusTicked));
    // The held `active` tint: a behavior status recolors the unit's glyph for
    // its whole lifetime, its one cue on the body (it has no per-tick pulse;
    // the pip strip shows it too). Apply tints; expiry restores the latest
    // tint still held, or the team color.
    this.subscriptions.push(bus.on('status:applied', this.onStatusApplied));
    this.subscriptions.push(bus.on('status:expired', this.onStatusExpired));
    // An ability's heal: keep the HP bar in sync and float a cyan `+N`. A heal
    // onto a full unit emits `amount: 0` (gotcha #80), so skip amount <= 0.
    this.subscriptions.push(
      bus.on('unit:healed', ({ unitId, amount, healerId }) => {
        this.refreshHpBar(unitId);
        if (amount > 0) {
          this.spawnHitsplat(unitId, `+${amount}`, 'heal');
          // The cyan twinkle needs a healer. A status's heal never reaches this
          // event: it ticks on `status:ticked`, with its own sparkle.
          if (healerId !== null) this.spawnSparkle(unitId, COLORS.FLOURESCENT_BLUE);
        }
      }),
    );
    // The objective marker: `set` spawns or repoints it, `cleared` removes it.
    this.subscriptions.push(bus.on('objective:set', this.onObjectiveSet));
    this.subscriptions.push(bus.on('objective:cleared', this.onObjectiveCleared));
  }

  /** Per-render-frame tick. Drives sprite lerps + overlay position-follow + progress fill. */
  update(dt: number): void {
    // Advance the render clock by the speed-scaled `dt` (0 at pause), so the
    // action bar that anchors on it keeps to the game's speed.
    this.renderClockMs += dt * 1000;
    this.animator.update(dt);
    this.updateExplosions(dt);
    this.updateAuraFx(dt);
    this.updateAuraPulseParticles(dt);
    this.updateOverlays(dt);
    // After overlays so an enemy mark reads the target's already-lerped position
    // this frame (no one-frame lag behind the unit it's pinned to).
    this.updateObjectiveMarker();
    // After every sprite has moved and faded for this frame.
    this.updateGroundMarks();
  }

  /**
   * This frame's ground marks: one per body with a sprite, the dying included
   * at their fading alpha, handed to the terrain, which draws the marks
   * itself and bins and uploads them at its next draw. A 1×1 body's mark
   * follows its sprite's ground point through every slide and shove; an N×N
   * body's lies on its footprint.
   */
  private updateGroundMarks(): void {
    const world = this.world;
    if (!world || !this.terrain.groundMarksOn) return;
    this.terrain.beginMarks(world.gridW, world.gridH);
    const style = this.terrain.markStyle;
    for (const [unitId, handle] of this.handles) {
      const spec = this.markSpecs.get(unitId);
      const alpha = this.sprites.getAlpha(handle);
      if (!spec || alpha === null || alpha <= 0) continue;
      const at = spec.fixed ?? this.sprites.getPosition(handle, this.scratchPos);
      if (!at) continue;
      this.terrain.addMark({
        x: at.x,
        z: at.z,
        shape: spec.shape,
        extent: markExtent(spec.shape, spec.footprint, style),
        dashed: spec.dashed,
        r: spec.r,
        g: spec.g,
        b: spec.b,
        alpha,
      });
    }
  }

  /**
   * Advance every live particle of the burst lane: ease its position toward
   * `to`, grow its size, fade its alpha, and remove it once its life ends.
   * Iterates back to front so removal in place is safe.
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
   * The aura's range: the recipients' pips show the buff applies, and this
   * shows the radius. Two layers, both on the burst lane, both anchored to
   * the carrier's live sprite (half a cell off during a slide reads better
   * than a ring that snaps cell to cell) and colored by the aura status's
   * pip color (`statusColor`), so ring, pulse and pips read as one system:
   *
   * - the ring: every AURA_RING_INTERVAL_SECONDS each live carrier sheds a
   *   few faint motes at random points on the aura's Chebyshev boundary, the
   *   square at `radius + AURA_RING_EDGE`, the affected cells' outer edge
   *   (the sim's `unitDistance ≤ radius` gate for a 1×1 carrier). The idle
   *   layer, there when looked for.
   * - the pulse: every AURA_PULSE_INTERVAL_SECONDS a square wavefront of
   *   motes expands from the carrier to that boundary and fades as it
   *   arrives, a sonar ping that says "this radiates". The square is the
   *   true wavefront of the aura's Chebyshev distance, not an approximate
   *   circle, and the lane's ease-out is a wave losing energy at its edge.
   *
   * In `fill` mode the ring samples the whole area and there is no pulse.
   * Y hugs the carrier's own ground plane, with no terrain sampling per
   * mote, so on a slope the far edge floats or sinks a touch. Both clocks
   * advance by the speed-scaled `dt`: faster at fast-forward, frozen at
   * pause, at real `dt` during the pre-battle countdown (BattleScene's
   * countdown branch feeds it unscaled).
   *
   * The mode is a setting, read each frame (./auraFx.ts), so a change shows
   * mid-battle.
   */
  private updateAuraFx(dt: number): void {
    if (!this.world) return;
    const mode = auraFxMode();
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
        if (shedPulse) this.shedAuraPulseTracked(carrier.id, center, reach, color);
      }
    }
  }

  /** The `fill` mode's shed: like the ring, but the motes sample the whole
   *  aura square uniformly, and the boundary shows where they stop. */
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

  /** The `track` mode's pulse: one square wavefront of evenly spaced motes
   *  (AURA_PULSE_SAMPLES_PER_SIDE a side, offset half a step from the corners
   *  so adjacent sides interleave instead of doubling the corner motes), flat
   *  on the ground. Each mote stores its offset and its carrier's id, and
   *  `updateAuraPulseParticles` re-derives its position from the live sprite
   *  every frame, so the wave glides with the carrier. */
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

  /** Advance the carrier-tracked pulse motes: the live carrier center plus
   *  the offset × eased(t) (the burst lane's ease-out: a fast start, settling
   *  at the edge), alpha fading over the life. A mote whose carrier sprite is
   *  gone (its death fade done, or a detach) is removed on the spot. */
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

  /** The ring's shed: AURA_RING_MOTES faint motes at random points on the
   *  square perimeter, rising gently and fading in place. */
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

  /** Record the new objective target, spawning the marker sprite if there is
   *  none (one a battle, reused across re-sets); `updateObjectiveMarker`
   *  places it. Only the player's objective draws a marker, and an objective
   *  with no target (`atWill`, `hold`) drops it like a clear. */
  private onObjectiveSet = ({ team, objective }: GameEvents['objective:set']): void => {
    if (team !== 'player') return;
    if (objective.mode !== 'engage' && objective.mode !== 'focus') {
      this.dropObjectiveMarker();
      return;
    }
    this.objective = objective.target;
    // The glyph reads the mode: 'X' for engage, '!' for focus. The one marker
    // sprite is reused across re-sets, so the glyph swaps in place when the
    // mode flips rather than the sprite being made again.
    const glyph = objective.mode === 'focus' ? OBJECTIVE_MARKER_FOCUS_GLYPH : OBJECTIVE_MARKER_GLYPH;
    this.objectiveMarkerGlyph = glyph;
    if (!this.objectiveMarker) {
      // Seed at the origin; `updateObjectiveMarker`, at this handler's end,
      // moves it before it is drawn. Base-anchored: the X or ! stands on the
      // marker position (its ink's own lift is subtracted there, per glyph, so
      // the glyph swap below needs nothing more).
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

  /** The objective is gone (the player reverted it to at-will, or an enemy
   *  mark reverted on the target's death): drop the marker. An enemy team's
   *  objective never draws one. */
  private onObjectiveCleared = ({ team }: GameEvents['objective:cleared']): void => {
    if (team !== 'player') return;
    this.dropObjectiveMarker();
  };

  /** Clear the player's objective marker, its state and its sprite. */
  private dropObjectiveMarker(): void {
    this.objective = null;
    if (this.objectiveMarker) {
      this.sprites.removeSprite(this.objectiveMarker);
      this.objectiveMarker = null;
    }
  }

  /**
   * Place the objective marker for this frame. A tile objective's marker
   * sits, larger, on its rally cell; an enemy's rides above the target's
   * glyph, tracking its live position. A target with no sprite hides the
   * marker rather than strand it at a stale spot.
   */
  private updateObjectiveMarker(): void {
    const marker = this.objectiveMarker;
    const obj = this.objective;
    if (!marker || !obj || !this.world) return;

    if (obj.kind === 'tile') {
      // The marker is base-anchored, and its INK must stand
      // OBJECTIVE_MARKER_TILE_LIFT above the cell's ground point (camera-up, so
      // it hugs its cell at the screen edges too). The X's ink starts at the
      // font baseline, `inkBottomLift` above its quad bottom, so the anchor
      // drops by that much × the marker's size; without it the X floats a
      // quarter-cell up.
      const pos = aboveAnchor(
        this.tileGroundPos(obj.cell),
        OBJECTIVE_MARKER_TILE_LIFT -
          this.sprites.atlas.inkBottomLift(this.objectiveMarkerGlyph) * OBJECTIVE_MARKER_TILE_SIZE,
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
    // The mark's ink stands OBJECTIVE_MARKER_ENEMY_LIFT above the target
    // glyph's visible ink top, lifted along camera-up (`aboveAnchor`). The
    // target's ground anchor is live (it tracks the slide). Both ends are
    // ink-true: the target's ink top by `inkTopLift`, and the mark's own
    // `inkBottomLift` subtracted so its ink, not its quad's bottom, sits the
    // gap above.
    const target = this.world.findUnit(obj.unitId);
    const inkTop = target
      ? this.sprites.atlas.inkTopLift(target.glyph) * footprintOf(target)
      : 2 * GLYPH_HALF_HEIGHT;
    const pos = aboveAnchor(
      anchor,
      inkTop +
        OBJECTIVE_MARKER_ENEMY_LIFT -
        this.sprites.atlas.inkBottomLift(this.objectiveMarkerGlyph) * OBJECTIVE_MARKER_ENEMY_SIZE,
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
   * Living enemy units as click candidates for the billboard hit-test
   * (`Renderer.pickInstance`), at each sprite's live position (the billboard
   * the player sees, mid-slide included) rather than the logical cell, so a
   * click on a moving enemy's glyph selects it. The ObjectiveController calls
   * this to resolve an objective click, either button, armed or not, onto
   * the unit clicked, before it falls back to the terrain cell.
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
        // The atlas's ink box, padded for click feel, from the same
        // rasterization as the screen.
        ink: this.sprites.atlas.getPaddedGlyphInk(unit.glyph),
        // Unit sprites stand on their quad's bottom; the clickbox mirrors the
        // same anchor exactly.
        anchor: { x: 0, y: BASE_ANCHOR_Y },
      });
    }
    return out;
  }

  /**
   * Living destructible neutrals (rubble, a destructible wall or cover) and
   * camp members as click candidates for the objective hit-test, beside
   * `enemyBillboards`: the player can order an attack on one (`focus` or
   * `engage`). The pick quad scales with the footprint, since a 2×2 or 3×3
   * body draws one glyph at `size = N`, and the ObjectiveController's cell
   * fallback covers the footprint tiles the glyph doesn't overlap.
   * Indestructible walls (no HP) stay unclickable. A camp member's order rides
   * the same neutral objective, and the ordered first blow is what aggroes
   * the camp.
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
        anchor: { x: 0, y: BASE_ANCHOR_Y },
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
   * battle:ended fired) get cut short. Acceptable: the screens after hide
   * the cut-short visual (gotcha #15).
   */
  detach(): void {
    this.animator.clear();
    for (const handle of this.handles.values()) {
      this.sprites.removeSprite(handle);
    }
    this.handles.clear();
    // The marks go with the bodies; the terrain draws none until the next
    // battle's first frame.
    this.markSpecs.clear();
    this.terrain.beginMarks(0, 0);
    // animator.clear() drops the projectile lerps without firing their
    // onComplete (the despawn callback), so sweep the projectile sprites
    // here. removeSprite is idempotent, so a late callback is harmless.
    for (const proj of this.projectiles) this.sprites.removeSprite(proj);
    this.projectiles.clear();
    // The burst lane's particles too: the animator doesn't own them.
    for (const p of this.explosions) this.sprites.removeSprite(p.handle);
    this.explosions.length = 0;
    // The ring's motes live in `explosions` (swept above); rewind the shed
    // clocks so the next battle starts on fresh intervals.
    this.auraRingClock = 0;
    this.auraPulseClock = 0;
    // The tracked pulse's motes have their own lane; sweep it.
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
    this.reaims.clear();
    this.renderClockMs = 0;
    // Drop the objective marker and its state so the next battle starts clean.
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
    // A destructible wall or cover wears CRACKED_STONE, its tell; every other
    // unit its team's or the stone's color, through the same helper.
    // Base-anchored: the glyph stands on its ground anchor and rises
    // screen-up (`SpriteAnchor`).
    const handle = this.sprites.addSprite(unit.glyph, spriteColorForUnit(unit), spritePos, 'base');
    this.handles.set(unit.id, handle);
    // Its ground mark: the side's shape, or scenery's plate.
    const colour = this.markColour.set(spriteColorForUnit(unit));
    const centre =
      footprint > 1
        ? footprintCentre(unit.position.x, unit.position.y, footprint, this.world.gridW, this.world.gridH, () => 0)
        : null;
    this.markSpecs.set(unit.id, {
      shape: markShapeOf(unit),
      dashed: isDashedPlate(unit),
      footprint,
      r: colour.r,
      g: colour.g,
      b: colour.b,
      fixed: centre && { x: centre.x, z: centre.z },
    });
    // A multi-tile body draws as one glyph scaled to its footprint (the
    // per-instance `size`); a 1×1 keeps the default.
    if (footprint !== 1) this.sprites.updateSprite(handle, { size: footprint });

    // Inert neutrals (walls, scenery) are background: no halo. An
    // indestructible wall gets no overlay either, since an HP bar it could
    // never move would be noise. A destructible neutral (rubble, a breakable
    // wall or cover) gets one, so its chipping shows; its bar hides until
    // damaged and scales to the footprint (`UnitOverlayLayer.addDestructible`).
    // Registered in `overlayHandles`, it is filled by `unit:attacked`'s HP
    // refresh and moved by the per-frame loop like any overlay. An active
    // neutral (a camp member) skips this return and takes the combatant path
    // below: natural bloom, the level badge and HP bar, and the fade-in, since
    // the portal drip spawns with `instant: false`.
    if (isInertNeutral(unit)) {
      this.sprites.updateSprite(handle, { bloomIntensity: 0 });
      if (isDestructibleNeutral(unit.archetype)) {
        const overlay = this.overlays.addDestructible(footprint);
        this.overlays.updateHp(overlay, Math.max(0, unit.currentHp) / unit.derived.maxHp);
        // Overlays anchor on the glyph's visible ink top (`inkTopLiftFor`);
        // the per-frame follow recomputes the same point.
        this.overlays.updatePosition(
          overlay,
          aboveAnchor(spritePos, this.inkTopLiftFor(unit), this.renderer.camera, this.scratchPos),
        );
        this.overlayHandles.set(unit.id, overlay);
      }
      return;
    }

    // A unit placed at battle start (`instant: true`) appears at once; the
    // pre-battle countdown is the reaction window. A mid-battle spawn
    // (`instant: false`: an overflow spawn, a summon, a camp's portal drip)
    // fades alpha 0 → 1 over the SpawnAction lockout, so the fade and the
    // lockout end together. Walls and other inert neutrals returned above, and
    // pop.
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
      // The fade spans the spawn lockout's ticks, so the two end together.
      const fadeSeconds = ticksToSeconds(SIM.spawnDurationTicks);
      this.animator.startFadeIn(handle, fadeSeconds);
      this.overlayFadeIns.set(unit.id, {
        elapsed: 0,
        duration: fadeSeconds,
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
   * The settle-back. A deferred move aborted mid-flight (its destination went
   * invalid while the sprite slid toward it): ease the sprite from wherever it
   * reached back to `from`, its logical cell, since a unit doesn't leave it
   * before the flip. It lerps from the sprite's live position (like
   * `animateStep`), so the reversal continues from the slide's current point
   * and replaces the move's lerp (one lerp per handle). A short, fixed
   * duration keeps the recoil from lingering into a concurrent melee hit. An
   * abort at selection time never started a slide, so the sprite is already
   * on `from` and this lerps in place, a no-op. Nothing in play aborts a
   * slide today: every placement skips a claimed cell and no tile changes
   * mid-battle (World's in-flight abort names what could).
   */
  private onUnitMoveAborted = ({ unitId, from }: GameEvents['unit:moveAborted']): void => {
    this.settleSpriteTo(unitId, from);
  };

  /**
   * A release-gate hold (the catapult's locked target left the firing band,
   * or died, during the wind-up): anchor the re-aim drain window on the render clock, which
   * freezes at pause and keeps to the game's speed, as the fill bar does.
   * `updateProgressFill` draws it full to empty in TERMINAL_AMBER while no
   * real action bar claims the element. The length is the event's tick
   * count, already scaled by the unit's speed.
   */
  private onUnitActionHeld = ({ unitId, reaimTicks }: GameEvents['unit:actionHeld']): void => {
    this.reaims.set(unitId, {
      startedAtMs: this.renderClockMs,
      durationMs: (reaimTicks * 1000) / TICK_RATE,
    });
  };

  /**
   * A swap ended without its flip (aborted at the impact boundary, or a
   * participant removed before the flip). Both sprites began the paired
   * slide at the swap's start, so both settle back to their true cells;
   * settling only one would leave the partner resting on a slide the sim
   * never made, and a melee unit would then attack from a tile it isn't on.
   * `onUnitDied` keeps a dead unit's handle until its fade ends, so a dead
   * participant's sprite settles as it fades; once the fade has ended,
   * `settleSpriteTo` finds no handle and skips it.
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

  /** The settle: ease the sprite from its live position to `cell`'s rest
   *  position (one lerp per handle, replacing any slide in flight). */
  private settleSpriteTo(unitId: number, cell: GridCoord): void {
    if (!this.world) return;
    const handle = this.handles.get(unitId);
    if (!handle) return;
    const footprint = this.footprintFor(unitId);
    const restPos = this.unitAnchorPos(cell, footprint);
    const origin = (this.sprites.getPosition(handle, this.scratchPos) ?? restPos).clone();
    // The same ground profile as `animateStep`: a settle-back is a ground
    // relocation too, and can land the sprite on a tile of another height.
    this.animator.startGroundLerp(handle, origin, restPos, SETTLE_BACK_SECONDS);
  }

  /**
   * A swap (`SwapAction`) animates as two simultaneous steps in
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
    // Lerp between footprint-centred anchors, so a multi-tile mover stays
    // centred over its block through the slide (n = 1 is `tileGroundPos`).
    const footprint = this.footprintFor(unitId);
    const origin = (this.sprites.getPosition(handle, this.scratchPos) ?? this.unitAnchorPos(from, footprint)).clone();
    // The ground lerp climbs early and descends late in Y, so a low-to-high
    // step never spends its second half with the anchor under the
    // destination's tile top, the glyph clipping through the ground.
    this.animator.startGroundLerp(
      handle,
      origin,
      this.unitAnchorPos(to, footprint),
      ticksToSeconds(durationTicks),
    );
  }

  /**
   * The ground point of cell `coord`: XZ from gridToWorld, Y the terrain's
   * tile top (`TerrainRenderer.heightAt`). This is the world anchor
   * convention: a thing's true location in the scene carries no presentation
   * lift, since a world-Y lift skews a sprite off its tile at the screen's
   * edge. A unit's base-anchored quad stands on this point (screen-up, via
   * `instanceAnchor`); anything stacked above it goes through `aboveAnchor`.
   */
  private tileGroundPos(coord: GridCoord): THREE.Vector3 {
    if (!this.world) throw new Error('BattleRenderer.tileGroundPos: no attached world');
    const pos = gridToWorld(coord, this.world.gridW, this.world.gridH);
    const kind = this.world.tileGrid.kindAt(coord);
    pos.y = this.terrain.heightAt(coord.x, coord.y, kind);
    return pos;
  }

  /** The visual center of cell `coord`, for FX aimed at a tile (blast
   *  flashes, a ground-target bolt's end): half a glyph up the screen from
   *  the ground point, where a standing glyph's center reads. */
  private cellVisualCenter(coord: GridCoord): THREE.Vector3 {
    return aboveAnchor(
      this.tileGroundPos(coord),
      GLYPH_HALF_HEIGHT,
      this.renderer.camera,
      this.scratchPos,
    );
  }

  /**
   * The visual center of a unit's live glyph: its ground anchor (which
   * tracks the slides) lifted up the screen to the middle of the visible ink,
   * so a bolt aimed at the unit hits the letterform's body, not the taller
   * empty quad's midpoint. The one point the FX endpoints and sparkles mean
   * by "at the unit". Null when the handle is gone (mid-teardown), like
   * `getPosition`.
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
   * The camera-up lift from a unit's ground anchor to the top of its visible
   * ink, scaled by the footprint. The one definition for everything that sits
   * a fixed screen distance off a glyph's top: the overlay stack and the
   * floating number.
   *
   * Not one line for every glyph: a shared line is blind to the glyph, so a
   * short glyph (`a`, `r`) wore its bar visibly high and a tall one (`M`) ran
   * cramped, and since the CSS gap is in screen pixels against an anchor
   * blind to depth, near rows read tight and far rows high at once, with no
   * one gap fixing both. The ink top scales with perspective, so the gap
   * means the same at every depth and letterform. The price, accepted: bars
   * over an `a` and an `M` at equal depth sit a seventh of a tile apart
   * (some 5 px at 1280 × 720 on a 15 × 15 board) instead of on one line. `inkCenterLift`'s users, the FX endpoints, are apart from
   * this.
   */
  private inkTopLiftFor(unit: Unit): number {
    return this.sprites.atlas.inkTopLift(unit.glyph) * footprintOf(unit);
  }

  /**
   * The ground anchor for a unit's body sprite, footprint-aware.
   * `corner` is the canonical `unit.position` (the min-XY cell); the N×N block
   * extends +x/+y (see `footprintCells`). A 1×1 body stands on its tile's
   * ground point. An N×N body is one scaled glyph (`instanceSize = n`),
   * base-anchored by the slab rule (`slabAnchor.ts`): the footprint's centre
   * at its highest tile top, slid along the view ray clear of its own terrain,
   * so it stands on its plot and no footprint tile or hill mound bites its
   * lower band at any yaw. A base-anchored quad grows UP from its anchor at
   * any size, so a big glyph can't sink into the terrain by construction.
   *
   * The rule reads the camera, so a slab stands for the view it was placed
   * under. Players' view never changes; the dev board explorer re-stands the
   * slabs after it changes the view. Rubble spawns before `fitToBoard`
   * (BattleScene), which is harmless under ortho, where the slide reads only
   * the view direction.
   */
  private unitAnchorPos(corner: GridCoord, footprint: number): THREE.Vector3 {
    if (footprint === 1) return this.tileGroundPos(corner);
    const world = this.world!;
    return slabAnchor(
      corner.x,
      corner.y,
      footprint,
      world.gridW,
      world.gridH,
      slabGroundOf(world, this.terrain),
      slabViewOf(this.renderer.camera),
    );
  }

  /** Footprint (N) of a live unit by id; 1 if it's gone or single-cell. */
  private footprintFor(unitId: number): number {
    const unit = this.world?.findUnit(unitId);
    return unit ? footprintOf(unit) : 1;
  }

  /**
   * Float the damage over the target, neon red for a crit and white
   * otherwise, and refresh its HP bar (the sim has applied the damage when
   * this fires). The shove or tracer on `action:phase` shows who acts, and
   * the number shows the impact. The swing's cue rides `action:phase`
   * through the FX registry, so it plays on a miss too; this handler keeps
   * the visuals that need the resolved `damage` and `crit`, which
   * `action:phase` doesn't carry.
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
   * A single-target strike was dodged: float "Miss" over the target instead
   * of a number. No HP refresh: a miss changes no HP. The swing rides
   * `action:phase`, which fires on a hit and a miss alike, so this floats
   * only the word.
   */
  private onUnitMissed = ({ targetId }: GameEvents['unit:missed']): void => {
    this.spawnHitsplat(targetId, t('hitsplat.miss'), 'miss');
  };

  /**
   * Float a number over a unit, anchored at the top of its visible ink so it
   * reads off the glyph's top edge. The lift runs along camera-up
   * (`aboveAnchor`), so one projection in UnitOverlayLayer places it with no
   * sideways drift, and a lift in world units tracks the sprite's apparent
   * size across zoom, where a CSS % offset wouldn't. A no-op if the unit has
   * no live sprite (mid-teardown) or doesn't project.
   */
  private spawnHitsplat(
    unitId: number,
    text: string,
    kind: HitsplatKind,
  ): void {
    const handle = this.handles.get(unitId);
    if (!handle) return;
    const pos = this.sprites.getPosition(handle, this.scratchPos);
    if (!pos) return;
    if (!this.world) return;
    const unit = this.world.findUnit(unitId);
    // The ink top, so the number floats just above the letterform, not above
    // the taller empty quad.
    const lift = unit ? this.inkTopLiftFor(unit) : 2 * GLYPH_HALF_HEIGHT;
    const top = aboveAnchor(pos, lift, this.renderer.camera, pos);
    this.overlays.spawnHitsplat(top, text, kind, unitId);
  }

  /**
   * The melee lunge: the caster shoves toward its target and snaps back.
   * Driven off `action:phase` by the `melee_swing` fx key (the melee weapons
   * author it on `impact`, the rogue gambit on `windup`), so it fires on a
   * miss too: the phase boundary doesn't care whether the strike connected.
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
   * The ranged tracer: fly a `*` in a straight line from the caster's sprite
   * to the target's and remove it on arrival. Driven off `action:phase` by
   * the `ranged_shot` fx key (the bow and the pistol, on `impact`), so it
   * fires on a miss too. Damage already landed this tick (the sim is
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
    // The ends are the glyphs' visual centers, so the bolt leaves and lands on
    // what the player sees; a cell's visual center stands in if a handle is
    // mid-teardown.
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
   * One arc of a chain attack. Fires once a hop (`unit:chained`), on the tick
   * that hop's damage lands, so with `hopDelaySeconds > 0` the bolt travels
   * jump by jump. Flies a fast `*` from the arc's source cell (`from`: the
   * caster's for jump 0, else the previous victim's) to the live target
   * sprite (else the recorded `to` cell), in the caster's team color, with
   * the gentle jolt the `chain_arc` entry authors. The damage's number and
   * HP ride each hop's `unit:attacked`; this is the connecting arc only, a
   * cosmetic like the bow's tracer: the damage already landed this tick.
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
    // The hop's zap and its jolt, both from the registry's one key.
    const fx = fxDescriptor('chain_arc', reducedMotion());
    if (fx?.sound) this.audio.play(fx.sound);
    if (fx?.shake) this.renderer.shakeCamera(fx.shake.intensity, fx.shake.durationSeconds);
  };

  /**
   * Fly a `*` from `from` to `to`, level or in an arc of `arcHeight`, over
   * `durationSeconds` (default PROJECTILE_SECONDS), and remove it on arrival.
   * Shared by the tracers, the chain's arcs and the flights launched on
   * `release` (timed by `ticksToSeconds(travelTicks)` to land on the impact
   * tick). It lives in `projectiles`, not `handles`, so `detach` sweeps it;
   * `animator.clear()` drops the lerp without firing `onArrive` (gotcha
   * #108), so a battle that ends mid-flight leaves no orphan callback.
   * `targetProvider` makes the lerp home on a moving sprite (the catapult);
   * without it the destination is fixed. `size` overrides the glyph's scale,
   * so an fx key can author it (default PROJECTILE_SIZE).
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
   * The FX driver. Resolves the action's cue for this phase
   * (`actionId → AbilityDef.fx[phase] → FX_REGISTRY`) and drives its
   * channels: the sound, a projectile, a burst, the shake, the shove, the
   * tracer. The key is read off the def, not the event, so `action:phase`
   * stays lean. A phase or action with no `fx` key falls through; the
   * numbers ride `unit:attacked` and `unit:healed`.
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
    // The motion gate rides the resolver: under reduced motion the shake, the
    // burst and the sparkle come back absent (REDUCED_MOTION_STRIPS).
    const fx = fxDescriptor(key, reducedMotion());
    if (!fx || !this.world) return;

    // One key: the sound plays with the visual.
    if (fx.sound) this.audio.play(fx.sound);
    if (fx.projectile) this.launchProjectileFx(fx.projectile, unitId, targetId, targetCell);
    if (fx.burst) this.spawnBurstFx(fx.burst, unitId, targetId, targetCell);
    // The Renderer owns the camera and the render loop, so the driver only
    // kicks the shake; the registry authors its size.
    if (fx.shake) this.renderer.shakeCamera(fx.shake.intensity, fx.shake.durationSeconds);
    // The single-target strikes' cues fire on the phase the key is authored on
    // (`impact` for the weapons, `windup` for the gambit), so a miss plays them
    // too: `action:phase` fires on a hit and a miss alike.
    if (fx.shove) this.triggerShoveFx(fx.shove, unitId, targetId);
    if (fx.tracer) this.triggerTracerFx(fx.tracer, unitId, targetId);
  };

  /**
   * The status cues' driver, `onActionPhase`'s sibling: resolves the status
   * def's `fx[moment]` to a descriptor and drives its channels off the live
   * unit: the sound, a recolored sparkle on the body, and the DoT or HoT
   * amount with an HP-bar refresh when an `amount` is given. General over
   * `moment`, though only `ticked` calls it (the constructor says why); the
   * held tint goes through `onStatusApplied`. A no-op when the status or the
   * moment names no key.
   */
  private driveStatusFx(
    statusId: string,
    moment: 'applied' | 'ticked' | 'expired' | 'active',
    unitId: number,
    amount?: number,
  ): void {
    const key = STATUS_DEFS[statusId]?.fx?.[moment];
    if (!key) return;
    const fx = fxDescriptor(key, reducedMotion());
    if (!fx) return;
    if (fx.sound) this.audio.play(fx.sound);
    if (fx.sparkle) this.spawnSparkle(unitId, fx.sparkle.color);
    if (fx.hitsplat && amount !== undefined && amount > 0) {
      // The kind's prefix glyph rides the number, the shape beside the hue.
      this.spawnHitsplat(unitId, hitsplatText(fx.hitsplat.kind, amount), fx.hitsplat.kind);
      this.refreshHpBar(unitId);
    }
  }

  /**
   * A tick that changed nothing (a HoT on a full unit, amount 0) drives
   * nothing: no sound, no sparkle, no `+0` (gotcha #80). Today only a HoT
   * ticks for 0: each DoT in config/statuses.json has a `might` of 1 or
   * more, and none is applied at a magnitude that scales it down.
   */
  private onStatusTicked = ({ unitId, statusId, amount }: GameEvents['status:ticked']): void => {
    if (amount === 0) return;
    this.driveStatusFx(statusId, 'ticked', unitId, amount);
  };

  /**
   * A behavior status with an `fx.active` overlay starts tinting the unit's
   * glyph. Tracked per-unit so a re-apply is idempotent (delete + re-set keeps
   * the last-applied-wins order) and an expiry restores the correct color.
   * Statuses with no `active` overlay (the DoTs, which cue on their ticks) no-op.
   */
  private onStatusApplied = ({ unitId, statusId }: GameEvents['status:applied']): void => {
    const key = STATUS_DEFS[statusId]?.fx?.active;
    const tint = key ? fxDescriptor(key, reducedMotion())?.overlay?.tint : undefined;
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
   * A behavior status expired: drop its tint and recolor the unit to the
   * next most recent held tint, or back to its team color when none remain.
   */
  private onStatusExpired = ({ unitId, statusId }: GameEvents['status:expired']): void => {
    const tints = this.statusOverlays.get(unitId);
    if (!tints || !tints.delete(statusId)) return;
    if (tints.size === 0) this.statusOverlays.delete(unitId);
    this.refreshOverlayTint(unitId);
  };

  /**
   * Write the unit's current glyph color: the latest held tint, or its base
   * color when none remains. A no-op when the unit's sprite is gone (dead,
   * detached). Called on apply and on expiry.
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
      // The unit's base color, which for a destructible wall or cover is the
      // cracked tint, not the plain stone, so an expiring tint doesn't repaint
      // it as an indestructible wall.
      if (unit) color = spriteColorForUnit(unit);
    }
    if (color !== undefined) this.sprites.updateSprite(handle, { color });
  }

  /**
   * Fly a caster's projectile from its live
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
    // Visual-center ends throughout (see triggerTracerFx).
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
   * The impact burst. An `explosion` flashes, team-colored, with a ring of
   * sparks at the captured blast cell (the mage); a `dud` kicks a neutral dust
   * puff where the boulder lands, the live target sprite, else the cast cell
   * (the catapult). The dud fires on every landing, hit or not: a boulder
   * craters either way, and `action:phase` carries no hit.
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
   * A flash and a ring of sparks at `center`: one central flash glyph that
   * grows and fades, and a ring of sparks that shoot out to about a 3×3
   * blast's edge and fade, all in `color` and glowing through the bloom.
   * Tuned by the EXPLOSION_* constants below.
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
   * A small gray dust puff for a catapult shot's landing: a central glyph
   * that grows and fades and a few short low-glow sparks, all in the neutral
   * stone color, so it reads as a landing rather than a team-colored blast.
   * Rides the burst lane (swept by `detach`).
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
   * A brief recolored mote burst on a unit. One shape serves the ability
   * heal's twinkle (cyan, for a heal with a healer in the `unit:healed`
   * handler) and the status ticks' cues (amber burn, green poison, red bleed,
   * cyan rejuvenate), by `color`. Reads the unit's live sprite position like
   * `spawnHitsplat`, so it tracks a sliding sprite, but anchors on the body
   * (`SPARKLE_Y_OFFSET`) rather than the top edge where the number floats: in
   * a crowd the cloud then reads as on this unit, not the one behind it. A
   * handful of `*` motes rise, fan out and fade on the burst lane (swept by
   * `detach`).
   */
  private spawnSparkle(unitId: number, color: string): void {
    const handle = this.handles.get(unitId);
    if (!handle) return;
    const unit = this.world?.findUnit(unitId);
    if (!unit) return;
    // The burst hugs the glyph as seen: the ink's visual center plus the tuned
    // camera-up nudge (SPARKLE_Y_OFFSET), with the motes fanned in world XZ.
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
    this.reaims.delete(unitId);
    // Drop the held tints: the unit fades out in its last one, and the entry
    // would otherwise stay until `detach`.
    this.statusOverlays.delete(unitId);
    // A unit can die during its spawn fade-in; drop the overlay's fade-in so
    // it doesn't fight the fade-out below.
    this.overlayFadeIns.delete(unitId);
    this.animator.startFade(handle, FADE_SECONDS, () => {
      this.sprites.removeSprite(handle);
      this.handles.delete(unitId);
      this.markSpecs.delete(unitId); // the mark faded with the sprite
    });
    const overlay = this.overlayHandles.get(unitId);
    if (overlay) {
      this.overlayFades.set(unitId, { elapsed: 0, duration: FADE_SECONDS, handle: overlay });
      this.overlayHandles.delete(unitId);
    }
  };

  /**
   * The per-frame overlay driver:
   *
   * 1. Position: project each glyph's live ink top to CSS pixels. The
   *    sprite's position, read through SpriteRenderer.getPosition, carries
   *    the animator's slides, so an overlay glides with its unit through a
   *    move instead of jumping to the destination cell.
   * 2. The action bar's fill, anchored on `renderClockMs` at the first frame
   *    an action is seen, so it fills smoothly between sim ticks (the Clock
   *    keeps its sub-tick time to itself) and, since that clock keeps the
   *    game's speed and freezes at pause, at the game's pace. Hidden (null)
   *    when no action is in flight.
   * 3. The fades: opacity 1 → 0 over FADE_SECONDS on death, then the
   *    overlay is removed; 0 → 1 over the spawn lockout for a mid-battle
   *    spawn.
   * 4. The status pips, once a sim tick.
   */
  private updateOverlays(dt: number): void {
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

    // Mid-battle spawns' fade-ins. The bar stays hidden: `updateProgressFill`
    // filters the spawn lockout, so no fill write fights this.
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
      // Follow the glyph's visible ink top, so the CSS stack sits a fixed
      // screen distance off the letterform at any board edge and any depth
      // (`--overlay-gap`; `inkTopLiftFor` says why, and what it costs).
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

      // Refresh the pips only when the sim tick has advanced (the readout is
      // the same between ticks, and CSS smooths the depletion), so this
      // recomputes at most once a tick per unit, not every frame.
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
    // Hidden through the SpawnAction lockout too: the fade-in is the spawn's
    // feedback, and a bar over a half-faded sprite would compete with it.
    if (
      !active ||
      active.finishTick <= active.startTick ||
      active.action.id === MOVE_ACTION_ID ||
      active.action.id === SPAWN_ACTION_ID
    ) {
      if (this.progress.has(unitId)) this.progress.delete(unitId);
      // No action bar claims the element: a live re-aim window draws the
      // amber drain, full to empty. It stays up through a move in between
      // (a catapult moving mid-re-aim is still re-aiming); a real action bar
      // replaces it below.
      const reaim = this.reaims.get(unitId);
      if (reaim !== undefined) {
        const remaining = 1 - (now - reaim.startedAtMs) / reaim.durationMs;
        if (remaining > 0) {
          this.overlays.updateProgress(overlay, remaining, true);
          return;
        }
        this.reaims.delete(unitId);
      }
      this.overlays.updateProgress(overlay, null);
      return;
    }
    // A real action bar takes the element back — drop any lingering re-aim.
    this.reaims.delete(unitId);

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
 * The melee shove. The attacker lunges this far (world units, about tiles)
 * toward its target, then recovers. A fast snap out and a slightly slower
 * recovery read as a committed strike rather than a wobble; the 0.2 s in all
 * fits well inside the shortest attack cadence.
 */
const SHOVE_DISTANCE = 0.35;
const SHOVE_OUT_SECONDS = 0.07;
const SHOVE_BACK_SECONDS = 0.13;

/**
 * The settle-back's recoil. When a deferred move aborts mid-flight, the
 * sprite eases from wherever the slide reached back to its `from` cell over
 * this window. Short (a touch above the shove's 0.2 s out and back), so it
 * reads as a quick pull back and clears before a concurrent melee hit, but
 * long enough to read as motion rather than a teleport.
 */
const SETTLE_BACK_SECONDS = 0.22;

/**
 * The ranged tracer. The glyph flies a straight line from shooter to target
 * over a fixed time, whatever the distance, so a shot reads as fast and
 * stays well inside the attack cadence. PROJECTILE_SIZE shrinks it (gotcha
 * #108); PROJECTILE_BLOOM lifts it above a unit's default bloom (0.15), so it
 * glows like a bolt.
 */
const PROJECTILE_GLYPH = '*';
const PROJECTILE_SECONDS = 0.18;
// The chain's arc flies faster than a bow's bolt, so each zap arrives within
// its hop's delay (`hopDelaySeconds`, 0.1 s by default): zap, zap, zap.
const CHAIN_ARC_SECONDS = 0.08;
const PROJECTILE_BLOOM = 1.2;
/** Per-sprite size multiplier for the tracer (1 = full unit-glyph size).
 *  Shrinks the `*` so it reads as a bolt rather than a flying letter. */
const PROJECTILE_SIZE = 0.6;

/**
 * The explosion, every `explosion` burst's. The flash is a central `*` that
 * grows from FLASH_SIZE_FROM to FLASH_SIZE_TO while fading; the spark ring is
 * 8 `*`s that shoot RING_SPREAD world units outward (cells are 1×1, so 1.1
 * lands the sparks at a radius-1 blast's 3×3 edge) and fade. EXPLOSION_BLOOM
 * lifts the whole burst well above a unit's bloom, so it glows. Tuned by eye.
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
 * The sparkle, a small mote burst on a unit, recolored by its caller
 * (`spawnSparkle`): the ability heal's twinkle and the status ticks' cues. A
 * few `*` motes on the burst lane rise, fan out gently and fade; smaller and
 * dimmer than an explosion (a pulse, not a boom). Tuned by eye.
 */
const SPARKLE_GLYPH = PROJECTILE_GLYPH; // already in the FontAtlas
const SPARKLE_SIZE = 0.4;
const SPARKLE_SPREAD = 0.45; // lateral fan, world units
const SPARKLE_RISE = 0.35; // upward drift from the anchor, world units (the "lift")
const SPARKLE_SECONDS = 0.45;
const SPARKLE_BLOOM = 1.6;
/** Camera-up nudge of the sparkle's anchor from the glyph's visual center
 *  (`unitVisualCenter`, then this through `aboveAnchor`). Apart from the
 *  number, which floats at the visual top: the sparkle hugs the unit's body,
 *  so in a crowd it reads as on this unit, not the one behind it. Below
 *  center, so the puff sits a touch low on the body; with SPARKLE_RISE (0.35)
 *  the cloud peaks around +0.175, clear of the floating number. Toward 0
 *  raises it. */
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
 * The aura's ring: faint `.` motes shed along the aura's square boundary,
 * rising gently and fading. A whisper by design (small, half alpha, a bloom
 * under 1), legible when looked for and not competing with combat FX; the
 * density knobs (interval × motes) trade legibility against clutter with
 * several carriers. `.` is in glyphs.ts's static list. Tuned by eye.
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
/** Hug the ground: the sprite's anchor is the ground point itself, so a
 *  small positive world-Y float keeps the motes just off the floor. World-Y
 *  is right here: the ring is a floor decoration in world space, not an
 *  overlay stacked on the screen. */
const AURA_RING_Y_OFFSET = 0.15;
const AURA_RING_SECONDS = 0.6;
const AURA_RING_BLOOM = 0.8;
const AURA_RING_ALPHA = 0.5;

/**
 * The aura's pulse, the sonar ping: a square wavefront expands from the
 * carrier to the boundary every interval, brighter and more coherent than
 * the idle ring (the pulse says "this radiates", the ring says where the
 * edge is), but still under combat FX. The interval is long enough that the
 * ping punctuates rather than strobes. Tuned by eye.
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

/** The `fill` mode's motes per shed interval, sampling the whole aura area
 *  instead of the boundary. Higher than AURA_RING_MOTES because the area
 *  (~(2r)² cells) dilutes density that the perimeter (~8r) concentrated. */
const AURA_FILL_MOTES = 8;

/**
 * The catapult's shot. The boulder arcs CATAPULT_ARC_HEIGHT world units
 * above the straight line from caster to impact (its peak at the midpoint),
 * reading as a siege shot over a wall rather than a flat bolt. Every landing
 * kicks a gray dust dud: a small central puff and 4 short low-glow sparks in
 * the neutral stone color. Tuned by eye.
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
 * Half a unit glyph's quad height in world units (`uSpriteSize` 1 × the
 * default `instanceSize` 1). A base-anchored quad's center is one of these
 * above its ground anchor and its top two, always along camera-up through
 * `aboveAnchor`, never world-Y. A tile's visual center uses it
 * (`cellVisualCenter`); a unit's own lifts are ink-aware (the atlas's
 * `inkCenterLift`, `inkTopLift`), and the quad's top stands in when the unit
 * is gone.
 */
const GLYPH_HALF_HEIGHT = 0.5;

/**
 * The in-battle objective marker (an `X` billboard), render constants rather
 * than config:
 * - `_COLOR` — amber, so it reads as a waypoint apart from the player's green
 *   and the enemy's red; `_BLOOM` gives it a faint glow.
 * - the sizes — a rally tile's draws larger (a big X on the ground); an enemy
 *   mark rides smaller, just above the target glyph.
 * - `_TILE_LIFT` — the camera-up gap the rally X's ink stands above its
 *   cell's ground point (base-anchored, less the glyph's own `inkBottomLift`
 *   × size, so the gap is ink-true).
 * - `_ENEMY_LIFT` — the camera-up gap the enemy mark rides above the target
 *   glyph's ink top (`updateObjectiveMarker`).
 */
/** The world-space quad extent of a unit billboard for the click hit-test:
 *  uSpriteSize (1) × the default instanceSize (1). A 1×1 unit draws at the
 *  default size; `destructibleBillboards` scales it by the footprint. */
const UNIT_PICK_SIZE = 1;

const OBJECTIVE_MARKER_GLYPH = 'X'; // in glyphs.ts's static list
/** The focus marker's glyph (engage's is 'X'), so the player reads which mode
 *  a steered objective is; in glyphs.ts's static list. Hold and Stop carry
 *  no target (Stop reverts to `atWill`), so no marker. */
const OBJECTIVE_MARKER_FOCUS_GLYPH = '!';
const OBJECTIVE_MARKER_COLOR = COLORS.TERMINAL_AMBER;
const OBJECTIVE_MARKER_BLOOM = 0.6;
const OBJECTIVE_MARKER_TILE_SIZE = 1.6;
const OBJECTIVE_MARKER_ENEMY_SIZE = 0.5;
const OBJECTIVE_MARKER_TILE_LIFT = 0.1;
/** The camera-up gap between the target glyph's visible ink top and the
 *  enemy mark's own ink (both ends ink-true: the target's top by
 *  `inkTopLift`, the mark's bottom by `inkBottomLift`). */
const OBJECTIVE_MARKER_ENEMY_LIFT = 0.2;

/**
 * Grid → world coordinates (XZ only). Cells are 1×1; the grid is centered
 * on the world origin. `cell.y` (grid axis 2) maps to world `-z`, so grid
 * (0, 0) is the near-left cell from the camera, as core/types.ts has it.
 * The X and Z half-extents come from `gridW` and `gridH` apart, so a
 * rectangular arena stays centered on the origin.
 *
 * Y is 0, the flat ground plane; a caller with the tile heights sets it
 * (BattleRenderer's `tileGroundPos`, the board explorer's poses).
 */
export function gridToWorld(cell: GridCoord, gridW: number, gridH: number): THREE.Vector3 {
  const halfX = gridW / 2;
  const halfZ = gridH / 2;
  return new THREE.Vector3(cell.x + 0.5 - halfX, 0, halfZ - cell.y - 0.5);
}
