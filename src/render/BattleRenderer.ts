import * as THREE from 'three';
import type { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import type { GridCoord } from '../core/types';
import type { World } from '../sim/World';
import type { Team, Unit } from '../sim/Unit';
import type { SpriteHandle, SpriteRenderer } from './SpriteRenderer';
import type { UnitOverlayHandle, UnitOverlayLayer } from './UnitOverlayLayer';
import type { TerrainRenderer } from './TerrainRenderer';
import { COLORS } from './palette';
import { SpriteAnimator } from './animation/SpriteAnimator';
import { TICK_RATE, ticksToSeconds } from '../config';
import { MOVE_ACTION_ID } from '../sim/actions/MoveAction';
import { SPAWN_ACTION_ID } from '../sim/actions/SpawnAction';
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

/** Tracks an in-flight action's wall-clock start so the progress bar can fill smoothly between sim ticks. */
interface ActiveProgress {
  /** `world.tick` at which the current activeAction began. Identity check so we re-anchor when the action changes. */
  startTick: number;
  /** `performance.now()` ms when this run was first observed by the render loop. */
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
  /** unitId → ongoing post-death overlay fade. */
  private readonly overlayFades = new Map<number, OverlayFade>();
  /** E3.6: unitId → ongoing overflow-spawn overlay fade-in. */
  private readonly overlayFadeIns = new Map<number, OverlayFadeIn>();
  /** Scratch vector to avoid per-frame allocation when reading sprite positions. */
  private readonly scratchPos = new THREE.Vector3();
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
    bus: EventBus<GameEvents>,
  ) {
    this.animator = new SpriteAnimator(this.sprites);
    this.subscriptions.push(bus.on('unit:spawned', this.onUnitSpawned));
    this.subscriptions.push(bus.on('unit:moved', this.onUnitMoved));
    this.subscriptions.push(bus.on('unit:attacked', this.onUnitAttacked));
    this.subscriptions.push(bus.on('unit:died', this.onUnitDied));
    // E7.C: the mage's bolt detonation drives ONE projectile + explosion,
    // replacing the per-hit tracers `unit:attacked` would otherwise spawn.
    this.subscriptions.push(bus.on('magic:detonated', this.onMagicDetonated));
    // D7.B: keep HP bars in sync with tile-effect chip damage / heal. E6.C
    // also floats a hitsplat for each: burn damage in amber, heal in cyan.
    // The healing tile emits a no-op heal every cadence tick on a full unit
    // (gotcha #80), so skip amount <= 0 to avoid "+0" spam.
    this.subscriptions.push(
      bus.on('unit:burned', ({ unitId, damage }) => {
        this.refreshHpBar(unitId);
        this.spawnHitsplat(unitId, String(damage), 'burn');
      }),
    );
    this.subscriptions.push(
      bus.on('unit:healed', ({ unitId, amount }) => {
        this.refreshHpBar(unitId);
        if (amount > 0) this.spawnHitsplat(unitId, `+${amount}`, 'heal');
      }),
    );
  }

  /** Per-render-frame tick. Drives sprite lerps + overlay position-follow + progress fill. */
  update(dt: number): void {
    this.animator.update(dt);
    this.updateExplosions(dt);
    this.updateOverlays(dt);
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
    this.progress.clear();
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

    // D5.C — overflow-queue spawn? Lerp sprite alpha 0 → 1 over the
    // SpawnAction lockout window so the unit fades in rather than
    // popping. The overlay starts at opacity 0 too and fades in alongside
    // via the OverlayFadeIn lane in `updateOverlays`.
    const initialAlpha = instant ? 1 : 0;
    if (!instant) {
      this.animator.startFadeIn(handle, SPAWN.durationSeconds);
    }

    const overlay = this.overlays.add(unit.team, unit.level, initialAlpha);
    const pct = Math.max(0, unit.currentHp) / unit.derived.maxHp;
    this.overlays.updateHp(overlay, pct);
    this.overlays.updatePosition(overlay, spritePos);
    this.overlayHandles.set(unit.id, overlay);

    if (!instant) {
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
    if (!this.world) return;
    const handle = this.handles.get(unitId);
    if (!handle) return;
    this.animator.startLerp(
      handle,
      this.tileWorldPos(from),
      this.tileWorldPos(to),
      ticksToSeconds(durationTicks),
    );
  };

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
   * E6 — physicalize the swing (shove or projectile via triggerAttackVisual)
   * and float a damage hitsplat over the target: neon-red for a crit (the
   * E1 `crit` flag), white otherwise. The pre-E6 attacker/target color
   * flash is gone — the shove + projectile show who's acting and the
   * hitsplat shows the impact, so the flash is redundant. Also refreshes
   * the target's HP bar (the sim has applied damage by the time this fires).
   */
  private onUnitAttacked = ({
    attackerId,
    targetId,
    damage,
    crit,
  }: GameEvents['unit:attacked']): void => {
    this.triggerAttackVisual(attackerId, targetId);
    this.spawnHitsplat(targetId, String(damage), crit ? 'crit' : 'normal');
    this.refreshHpBar(targetId);
  };

  /**
   * E6.C — float a number over a unit. Anchors at the *top* of the sprite
   * (getPosition returns the sprite center, so lift by HITSPLAT_Y_OFFSET ≈
   * half the 1×1 quad) rather than the center, so the number reads off the
   * top edge of the glyph. Done in world space so the offset tracks the
   * sprite's apparent size across camera zoom (a CSS % offset wouldn't).
   * Delegates positioning + lifecycle to UnitOverlayLayer, which reuses the
   * same world→screen projector the HP bars ride. No-op if the unit has no
   * live sprite (e.g. mid-teardown) or projects off-screen.
   */
  private spawnHitsplat(
    unitId: number,
    text: string,
    kind: 'normal' | 'crit' | 'heal' | 'burn',
  ): void {
    const handle = this.handles.get(unitId);
    if (!handle) return;
    const pos = this.sprites.getPosition(handle, this.scratchPos);
    if (!pos) return;
    pos.y += HITSPLAT_Y_OFFSET;
    this.overlays.spawnHitsplat(pos, text, kind, unitId);
  }

  /**
   * E6.A/B — physicalize the swing. Melee attackers lunge toward the
   * target and snap back (a shove); ranged attackers fire a projectile
   * (E6.B). The melee/ranged split mirrors the audio cue in BattleScene
   * (`derived.attackRange <= 1` → melee), so the visual and the sound
   * agree on what kind of attack just happened. For E7's multi-ability
   * units (a melee + a ranged on one unit) the engagement-range max can
   * misclassify a point-blank bolt as a shove; revisit by threading the
   * firing ability's kind through the `unit:attacked` event then.
   */
  private triggerAttackVisual(attackerId: number, targetId: number): void {
    if (!this.world) return;
    const attacker = this.world.findUnit(attackerId);
    const target = this.world.findUnit(targetId);
    if (!attacker || !target) return;
    const attackerHandle = this.handles.get(attackerId);
    if (!attackerHandle) return;

    // E7.C — the mage's AoE emits one `unit:attacked` per victim, which would
    // read as multishot here. Its visual is the single projectile + explosion
    // driven by `magic:detonated` instead, so skip the per-hit tracer. (The
    // per-victim hitsplat + HP-bar refresh in `onUnitAttacked` still fire —
    // those correctly show each unit taking damage.)
    if (attacker.archetype === 'mage') return;

    if (attacker.derived.attackRange <= 1) {
      // Melee: lunge toward the target's cell. Direction comes from cell
      // centers (stable even while the sprite is mid-lerp); startShove
      // captures the sprite's live position as the shove origin.
      const from = this.tileWorldPos(attacker.position);
      const to = this.tileWorldPos(target.position);
      const dx = to.x - from.x;
      const dz = to.z - from.z;
      const len = Math.hypot(dx, dz) || 1;
      this.animator.startShove(
        attackerHandle,
        dx / len,
        dz / len,
        SHOVE_DISTANCE,
        SHOVE_OUT_SECONDS,
        SHOVE_BACK_SECONDS,
      );
      return;
    }

    // Ranged: fly a tracer glyph from the attacker's sprite to the target's.
    // Damage already landed this tick (the sim is instantaneous); the
    // projectile is a cosmetic that despawns on arrival. Spawn from the live
    // sprite positions so the bolt emanates from / lands on what the player
    // actually sees, falling back to cell centers if a handle is mid-teardown.
    const from = (
      this.sprites.getPosition(attackerHandle, this.scratchPos) ??
      this.tileWorldPos(attacker.position)
    ).clone();
    const targetHandle = this.handles.get(targetId);
    const to = (
      (targetHandle && this.sprites.getPosition(targetHandle, this.scratchPos)) ??
      this.tileWorldPos(target.position)
    ).clone();
    this.spawnProjectile(from, to, colorForTeam(attacker.team));
  }

  /**
   * E6.B/E7.C — fly a `*` tracer in a straight line `from → to` over
   * `PROJECTILE_SECONDS` and despawn on arrival. Shared by the ranged strike
   * (shooter → target) and the mage bolt (caster → target tile); the latter
   * passes `onArrive` to detonate the explosion when the bolt lands. The
   * tracer lives in `projectiles` (not `handles`) so `detach` sweeps it; note
   * `animator.clear()` drops the lerp WITHOUT firing `onArrive` (gotcha #108),
   * so a battle that ends mid-flight spawns no orphan explosion.
   */
  private spawnProjectile(
    from: THREE.Vector3,
    to: THREE.Vector3,
    color: string,
    onArrive?: () => void,
  ): void {
    const proj = this.sprites.addSprite(PROJECTILE_GLYPH, color, from);
    this.sprites.updateSprite(proj, { bloomIntensity: PROJECTILE_BLOOM, size: PROJECTILE_SIZE });
    this.projectiles.add(proj);
    this.animator.startLerp(proj, from, to, PROJECTILE_SECONDS, () => {
      this.sprites.removeSprite(proj);
      this.projectiles.delete(proj);
      onArrive?.();
    });
  }

  /**
   * E7.C — the mage's bolt landed. Fly ONE tracer from the caster to the
   * target tile, then detonate a flash + spark-ring explosion there. Fires
   * once per cast (off `magic:detonated`) regardless of how many units the
   * blast hit — so it reads as a single exploding missile, and a whiff still
   * shows the impact. The boom position is captured NOW (world attached); if
   * the battle ends before the tracer lands, `animator.clear()` drops the
   * lerp without firing `onArrive`, so no explosion spawns post-detach.
   */
  private onMagicDetonated = ({ casterId, center }: GameEvents['magic:detonated']): void => {
    if (!this.world) return;
    const caster = this.world.findUnit(casterId);
    const color = caster ? colorForTeam(caster.team) : COLORS.TERMINAL_STONE;
    const boomAt = this.tileWorldPos(center);
    const casterHandle = this.handles.get(casterId);
    const from = (
      (casterHandle && this.sprites.getPosition(casterHandle, this.scratchPos)) ??
      boomAt
    ).clone();
    this.spawnProjectile(from, boomAt.clone(), color, () => this.spawnExplosion(boomAt, color));
  };

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

  private addExplosionParticle(
    from: THREE.Vector3,
    to: THREE.Vector3,
    glyph: string,
    color: string,
    sizeFrom: number,
    sizeTo: number,
    duration: number,
  ): void {
    const handle = this.sprites.addSprite(glyph, color, from);
    this.sprites.updateSprite(handle, {
      size: sizeFrom,
      bloomIntensity: EXPLOSION_BLOOM,
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
   * 2. Progress bar fill: anchor wall-clock to `activeAction.startTick`
   *    transitions so progress fills smoothly between sim ticks. The
   *    Clock owns sub-tick time and doesn't expose it, but anchoring on
   *    `performance.now()` at the first frame we observe an activeAction
   *    gives equivalent smoothness for actions long enough to matter.
   *    The progress bar is hidden (null) when no action is in flight.
   * 3. Overlay fade on death / spawn: lerp opacity 0↔1 over FADE_SECONDS
   *    or SPAWN.durationSeconds, then remove the overlay on death.
   */
  private updateOverlays(dt: number): void {
    const now = performance.now();

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

    if (!this.world) return;

    for (const [unitId, overlay] of this.overlayHandles) {
      const handle = this.handles.get(unitId);
      const unit = this.world.findUnit(unitId);
      if (!handle || !unit) continue;
      const spritePos = this.sprites.getPosition(handle, this.scratchPos);
      if (!spritePos) continue;

      this.overlays.updatePosition(overlay, spritePos);
      this.updateProgressFill(unitId, unit, overlay, now);
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

/** World-Y lift applied to a hitsplat's anchor so it sits at the TOP of the
 *  sprite rather than its center. The sprite quad is 1×1 centered at
 *  SPRITE_CENTER_OFFSET, so half the quad (0.5) reaches the top edge. */
const HITSPLAT_Y_OFFSET = 0.5;

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
