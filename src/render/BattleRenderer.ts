import * as THREE from 'three';
import type { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import type { GridCoord } from '../core/types';
import type { World } from '../sim/World';
import type { ObjectiveTarget } from '../sim/objective';
import type { Team, Unit } from '../sim/Unit';
import type { SpriteHandle, SpriteRenderer } from './SpriteRenderer';
import type { PickCandidate } from './pick';
import type { UnitOverlayHandle, UnitOverlayLayer } from './UnitOverlayLayer';
import type { TerrainRenderer } from './TerrainRenderer';
import type { Renderer } from './Renderer';
import type { AudioPlayer } from '../audio/AudioPlayer';
import { COLORS } from './palette';
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
import { readUnitStatuses } from '../sim/statusReadout';
import { SPAWN } from '../config/spawn';

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
}

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
  /** J3 — scratch for the camera's world-space up axis (the enemy mark's lift
   *  direction), recomputed per frame so it tracks a camera pan/mode swap. */
  private readonly cameraUpScratch = new THREE.Vector3();
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
    this.subscriptions.push(bus.on('unit:swapped', this.onUnitSwapped));
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
      this.sprites.updateSprite(p.handle, { position: pos, size, alpha: 1 - t });
      if (t >= 1) {
        this.sprites.removeSprite(p.handle);
        this.explosions.splice(i, 1);
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
      // moves it to the real spot before it's ever drawn.
      this.objectiveMarker = this.sprites.addSprite(
        glyph,
        OBJECTIVE_MARKER_COLOR,
        this.scratchPos.set(0, 0, 0),
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
      const pos = this.tileWorldPos(obj.cell);
      pos.y += OBJECTIVE_MARKER_TILE_LIFT;
      this.sprites.updateSprite(marker, {
        position: pos,
        size: OBJECTIVE_MARKER_TILE_SIZE,
        alpha: 1,
      });
      return;
    }

    const handle = this.handles.get(obj.unitId);
    const pos = handle ? this.sprites.getPosition(handle, this.scratchPos) : null;
    if (!pos) {
      this.sprites.updateSprite(marker, { alpha: 0 });
      return;
    }
    // Lift along the camera's UP axis (= straight up in view space, so straight
    // up ON SCREEN) instead of world-Y. The sprite shader billboards by
    // offsetting the quad in view space about the projection of this position,
    // so a world-Y lift projects off-axis (skewed sideways) for units away from
    // screen center; camera-up keeps the X directly above the unit. Column 1 of
    // the camera's world matrix is its up axis (unit-length, orthonormal).
    const up = this.cameraUpScratch.setFromMatrixColumn(this.renderer.camera.matrixWorld, 1);
    pos.addScaledVector(up, OBJECTIVE_MARKER_ENEMY_LIFT);
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
   * objective controller calls this to resolve a right-click / armed-click onto
   * the unit you actually clicked, before falling back to the terrain cell.
   */
  enemyBillboards(): PickCandidate[] {
    if (!this.world) return [];
    const out: PickCandidate[] = [];
    for (const [unitId, handle] of this.handles) {
      const unit = this.world.findUnit(unitId);
      if (!unit || unit.team !== 'enemy' || unit.currentHp <= 0) continue;
      const pos = this.sprites.getPosition(handle, this.scratchPos);
      if (!pos) continue;
      out.push({ id: unitId, position: pos.clone(), size: UNIT_PICK_SIZE });
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
    const spritePos = this.tileWorldPos(unit.position);
    const handle = this.sprites.addSprite(unit.glyph, colorForTeam(unit.team), spritePos);
    this.handles.set(unit.id, handle);

    // Neutrals (walls, environment) are inert background — suppress the
    // halo and skip the overlay entirely. C1a walls are indestructible
    // so an HP bar would be visual noise; destructible variants later can
    // opt back in.
    if (unit.team === 'neutral') {
      this.sprites.updateSprite(handle, { bloomIntensity: 0 });
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
    this.overlays.updatePosition(overlay, spritePos);
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
    const origin = (this.sprites.getPosition(handle, this.scratchPos) ?? this.tileWorldPos(from)).clone();
    this.animator.startLerp(
      handle,
      origin,
      this.tileWorldPos(to),
      ticksToSeconds(durationTicks),
    );
  }

  /**
   * World position for the sprite standing on cell `coord`. XZ from
   * gridToWorld; Y is the terrain top-of-tile (per-cell from
   * `TerrainRenderer.heightAt`) plus the sprite's center offset so the
   * 1×1 quad's base sits flush on the surface.
   */
  private tileWorldPos(coord: GridCoord): THREE.Vector3 {
    if (!this.world) throw new Error('BattleRenderer.tileWorldPos: no attached world');
    const pos = gridToWorld(coord, this.world.gridW, this.world.gridH);
    const kind = this.world.tileGrid.kindAt(coord);
    pos.y = this.terrain.heightAt(coord.x, coord.y, kind) + SPRITE_CENTER_OFFSET;
    return pos;
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
   * E6.C — float a number over a unit, anchored at the *top* of the sprite so
   * it reads off the top edge of the glyph. Passes the sprite CENTER plus the
   * world-up lift (`HITSPLAT_Y_OFFSET` ≈ half the 1×1 quad) to UnitOverlayLayer,
   * which projects both and anchors on the billboard's screen-space top (I2 —
   * see UnitOverlayLayer.spawnHitsplat for why the lift can't just be added in
   * world space before projecting). World-space lift keeps the offset tracking
   * the sprite's apparent size across camera zoom (a CSS % offset wouldn't).
   * No-op if the unit has no live sprite (e.g. mid-teardown) or projects
   * off-screen.
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
    this.overlays.spawnHitsplat(pos, HITSPLAT_Y_OFFSET, text, kind, unitId);
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
    const from = this.tileWorldPos(attacker.position);
    const to = this.tileWorldPos(target.position);
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
    const from = (
      this.sprites.getPosition(attackerHandle, this.scratchPos) ??
      this.tileWorldPos(attacker.position)
    ).clone();
    const targetHandle = this.handles.get(targetId);
    const target = this.world.findUnit(targetId);
    const to = (
      (targetHandle && this.sprites.getPosition(targetHandle, this.scratchPos)) ??
      (target ? this.tileWorldPos(target.position) : from)
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
    const fromPos = this.tileWorldPos(from).clone();
    // Prefer the live target sprite (smooth even mid-lerp); fall back to the cell.
    const targetHandle = this.handles.get(targetId);
    const toPos = (
      (targetHandle && this.sprites.getPosition(targetHandle, this.scratchPos)) ??
      this.tileWorldPos(to)
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
      if (unit) color = colorForTeam(unit.team);
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
    const from = (
      (casterHandle && this.sprites.getPosition(casterHandle, this.scratchPos)) ??
      this.tileWorldPos(caster.position)
    ).clone();

    if (spec.style === 'straight') {
      if (!targetCell) return;
      this.spawnProjectile(from, this.tileWorldPos(targetCell), color, undefined, 0, flightSeconds);
      return;
    }

    const targetHandle = targetId !== undefined ? this.handles.get(targetId) : undefined;
    const to = (
      (targetHandle && this.sprites.getPosition(targetHandle, this.scratchPos)) ??
      (targetCell ? this.tileWorldPos(targetCell) : from)
    ).clone();
    const provider = targetHandle
      ? (): THREE.Vector3 | null => this.sprites.getPosition(targetHandle, this.homingScratch)
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
      this.spawnExplosion(this.tileWorldPos(targetCell), color);
      return;
    }

    // dud — at the live target sprite, else the cast cell.
    const targetHandle = targetId !== undefined ? this.handles.get(targetId) : undefined;
    const at =
      (targetHandle ? this.sprites.getPosition(targetHandle, this.scratchPos)?.clone() : undefined) ??
      (targetCell ? this.tileWorldPos(targetCell) : undefined);
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
    const center = this.sprites.getPosition(handle, this.scratchPos);
    if (!center) return;
    center.y += SPARKLE_Y_OFFSET;
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
  ): void {
    const handle = this.sprites.addSprite(glyph, color, from);
    this.sprites.updateSprite(handle, {
      size: sizeFrom,
      bloomIntensity: bloom,
      alpha: 1,
    });
    this.explosions.push({
      handle,
      elapsed: 0,
      duration,
      from: from.clone(),
      to: to.clone(),
      sizeFrom,
      sizeTo,
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
      const spritePos = this.sprites.getPosition(handle, this.scratchPos);
      if (!spritePos) continue;

      this.overlays.updatePosition(overlay, spritePos);
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
/** World-Y of the sparkle's anchor, from the sprite CENTER (getPosition).
 *  Deliberately decoupled from the hitsplat's HITSPLAT_Y_OFFSET (0.5 = the top
 *  edge, where the number floats): the sparkle hugs the unit's BODY so in a crowd
 *  it reads as on THIS unit, not the one standing behind it. 0 = center; with
 *  SPARKLE_RISE the cloud peaks at +0.35, still within the sprite's own
 *  height (below the +0.5 top), so it never floats over a unit's head. */
const SPARKLE_Y_OFFSET = 0.0;
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

/** World-Y lift applied to a hitsplat's anchor so it sits at the TOP of the
 *  sprite rather than its center. The sprite quad is 1×1 centered at
 *  SPRITE_CENTER_OFFSET, so half the quad (0.5) reaches the top edge. */
const HITSPLAT_Y_OFFSET = 0.5;

/**
 * J3 — the in-battle objective marker (an `X` glyph billboard). Pure-VFX render
 * consts (the ROADMAP allows isolated render consts for VFX rather than config):
 *  - `_COLOR`  amber so it reads as a waypoint, distinct from player-green /
 *              enemy-red, and `_BLOOM` gives it a faint glow so it pops.
 *  - tile vs enemy SIZE: a rally tile draws LARGER (the user's call — a big X on
 *    the ground); an enemy mark rides smaller, just atop the target glyph.
 *  - `_TILE_LIFT` floats the tile X just off the surface (world-Y; the tile is
 *    flat, no skew at 0.1). `_ENEMY_LIFT` rides the mark above the unit along the
 *    CAMERA-UP (screen-up) axis — see `updateObjectiveMarker`.
 *
 * J3 playtest fixes (2026-06-09): enemy size 1.0→0.5 (was ~2× too large) and the
 * enemy lift moved off world-Y onto camera-up (a world-Y offset projects
 * off-axis under the pitched perspective → the mark skewed sideways for units
 * away from screen center; the same off-axis drift the I2 hitsplat fix solved).
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
/** Screen-up (camera-up) distance the enemy mark rides above the unit's center.
 *  ~0.6 clears the top of a unit-size (1.0) billboard so the X sits just atop it. */
const OBJECTIVE_MARKER_ENEMY_LIFT = 0.6;

function colorForTeam(team: Team): string {
  if (team === 'player') return COLORS.TERMINAL_GREEN;
  if (team === 'enemy') return COLORS.NEON_RED;
  return COLORS.TERMINAL_STONE;
}

/**
 * Sprite center height above the tile top. The 1×1 sprite quad is centered
 * on `SPRITE_CENTER_OFFSET`, so with this at 0.5 the quad's base sits flush
 * on whatever Y the terrain reports for the cell — no floating gap on lower
 * tiles, no clipping into higher ones. Pre-C1c this was a fixed `SPRITE_Y`
 * relative to world origin; now it's a delta off `TerrainRenderer.heightAt`.
 */
const SPRITE_CENTER_OFFSET = 0.5;

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
 * Y is left at `SPRITE_CENTER_OFFSET` as a sensible default for callers
 * without per-tile-height context; BattleRenderer overrides Y per cell via
 * `tileWorldPos`.
 */
export function gridToWorld(cell: GridCoord, gridW: number, gridH: number): THREE.Vector3 {
  const halfX = gridW / 2;
  const halfZ = gridH / 2;
  return new THREE.Vector3(cell.x + 0.5 - halfX, SPRITE_CENTER_OFFSET, halfZ - cell.y - 0.5);
}
