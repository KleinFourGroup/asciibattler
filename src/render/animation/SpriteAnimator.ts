import * as THREE from 'three';
import type { SpriteHandle, SpriteRenderer } from '../SpriteRenderer';

/**
 * Bridges the sim's discrete moves to continuous motion on screen. The sim
 * moves `unit.position` in one jump, at the move's flip (`MoveAction`); this
 * class slides the sprite across the step's whole duration, so the eye sees
 * a glide.
 *
 * One lerp per handle: a second replaces the first, starting from the `from`
 * it is given. BattleRenderer's steps pass the sprite's current position, so
 * a step that replaces another continues without a jump.
 */
interface ActiveLerp {
  readonly from: THREE.Vector3;
  readonly to: THREE.Vector3;
  readonly duration: number;
  elapsed: number;
  /**
   * The peak extra height (world Y) of a parabolic arc over the straight
   * from → to line: `+arcHeight · 4t(1−t)`, zero at both ends, highest at the
   * midpoint. 0 (the default) is a straight line; only the catapult's lob
   * passes a positive value.
   */
  readonly arcHeight: number;
  /** Fired once when the lerp completes: a projectile despawns on arrival.
   *  Undefined for plain move lerps. */
  readonly onComplete: (() => void) | undefined;
  /**
   * A moving target for a homing projectile. When present, `to` is refreshed
   * from it each frame before the interpolation, so the lerp follows a target
   * sprite that moves during the flight (the catapult's lob). A null return
   * holds the last `to` (the target's sprite was swept on death, say).
   * Undefined for a fixed destination.
   */
  readonly targetProvider: (() => THREE.Vector3 | null) | undefined;
  /**
   * The Y profile for a unit's ground relocation (moves, swaps, settle-backs).
   * The terrain's heights mean from.y and to.y can differ, and a linear Y
   * spends the second half of a low → high step with the anchor below the
   * destination tile's top, the ground clipping the glyph's lower band. So a
   * rising Y completes by t = 0.5 and a falling Y starts at t = 0.5, at the
   * sim's flip (`SIM.moveFlipFraction`, shipped 0.5, which this does not
   * read), and the anchor stays at or above the top of whichever cell it is
   * over, with no terrain sampling. XZ stays linear. False for projectiles,
   * which fly.
   */
  readonly groundStepY: boolean;
}

interface ActiveFade {
  readonly duration: number;
  elapsed: number;
  /** Starting alpha. 1 for fade-out (default), 0 for fade-in. */
  readonly fromAlpha: number;
  /** Ending alpha. 0 for fade-out, 1 for fade-in. */
  readonly toAlpha: number;
  readonly onComplete: (() => void) | undefined;
}

/**
 * The melee shove, a there-and-back animation: the sprite lunges from
 * `origin` to `peak` over `outDuration`, then recovers to `origin` over
 * `backDuration`, so a melee swing reads as a physical strike.
 *
 * Shove and move-lerp are mutually exclusive per handle: `startShove`
 * drops any in-flight lerp and `startLerp` drops any in-flight shove, so
 * the two never fight over the same sprite's position (last writer wins).
 * In practice a unit shoves only while stationary in melee range, so the
 * overlap is rare.
 */
interface ActiveShove {
  readonly origin: THREE.Vector3;
  readonly peak: THREE.Vector3;
  readonly outDuration: number;
  readonly backDuration: number;
  elapsed: number;
}

export class SpriteAnimator {
  private readonly lerps = new Map<SpriteHandle, ActiveLerp>();
  private readonly fades = new Map<SpriteHandle, ActiveFade>();
  private readonly shoves = new Map<SpriteHandle, ActiveShove>();
  private readonly scratch = new THREE.Vector3();

  constructor(private readonly sprites: SpriteRenderer) {}

  startLerp(
    handle: SpriteHandle,
    from: THREE.Vector3,
    to: THREE.Vector3,
    durationSeconds: number,
    onComplete?: () => void,
    arcHeight = 0,
    targetProvider?: () => THREE.Vector3 | null,
  ): void {
    // A move overrides any in-flight melee shove, so the two never fight
    // over this sprite's position.
    this.shoves.delete(handle);
    if (durationSeconds <= 0) {
      this.sprites.updateSprite(handle, { position: to });
      this.lerps.delete(handle);
      onComplete?.();
      return;
    }
    this.lerps.set(handle, {
      from: from.clone(),
      to: to.clone(),
      duration: durationSeconds,
      elapsed: 0,
      arcHeight,
      onComplete,
      targetProvider,
      groundStepY: false,
    });
  }

  /**
   * A unit's ground relocation: a fixed-destination lerp with the
   * climb-early, descend-late Y profile (`ActiveLerp.groundStepY`). For the
   * move and swap steps and the settle-backs, anything whose from and to are
   * both ground anchors. It overrides as `startLerp` does.
   */
  startGroundLerp(
    handle: SpriteHandle,
    from: THREE.Vector3,
    to: THREE.Vector3,
    durationSeconds: number,
  ): void {
    this.shoves.delete(handle);
    if (durationSeconds <= 0) {
      this.sprites.updateSprite(handle, { position: to });
      this.lerps.delete(handle);
      return;
    }
    this.lerps.set(handle, {
      from: from.clone(),
      to: to.clone(),
      duration: durationSeconds,
      elapsed: 0,
      arcHeight: 0,
      onComplete: undefined,
      targetProvider: undefined,
      groundStepY: true,
    });
  }

  /**
   * Start a melee shove: lunge from the sprite's current position
   * toward `(dirX, 0, dirZ)` (expected unit-length in XZ) by `distance`
   * world units over `outSeconds`, then recover over `backSeconds`. A
   * no-op if the handle has no live sprite. Drops any in-flight move lerp
   * (mutually exclusive per the ActiveShove contract); replaces any prior
   * shove on the same handle.
   */
  startShove(
    handle: SpriteHandle,
    dirX: number,
    dirZ: number,
    distance: number,
    outSeconds: number,
    backSeconds: number,
  ): void {
    const origin = this.sprites.getPosition(handle, this.scratch);
    if (!origin) return;
    const o = origin.clone();
    const peak = o.clone();
    peak.x += dirX * distance;
    peak.z += dirZ * distance;
    this.lerps.delete(handle);
    this.shoves.set(handle, {
      origin: o,
      peak,
      outDuration: outSeconds,
      backDuration: backSeconds,
      elapsed: 0,
    });
  }

  /**
   * Fade the sprite's alpha from 1 → 0 over `durationSeconds`, then call
   * `onComplete` (typically used to remove the sprite). Replaces any
   * in-flight fade for the same handle.
   */
  startFade(
    handle: SpriteHandle,
    durationSeconds: number,
    onComplete?: () => void,
  ): void {
    if (durationSeconds <= 0) {
      this.sprites.updateSprite(handle, { alpha: 0 });
      this.fades.delete(handle);
      onComplete?.();
      return;
    }
    this.fades.set(handle, {
      duration: durationSeconds,
      elapsed: 0,
      fromAlpha: 1,
      toAlpha: 0,
      onComplete,
    });
  }

  /**
   * The fade-in of a body that joins a battle under way: the sprite snaps to
   * alpha 0, then lerps to 1 over `durationSeconds`. Replaces any in-flight
   * fade for the same handle. No onComplete; the sprite stays at full alpha
   * after.
   */
  startFadeIn(handle: SpriteHandle, durationSeconds: number): void {
    if (durationSeconds <= 0) {
      this.sprites.updateSprite(handle, { alpha: 1 });
      this.fades.delete(handle);
      return;
    }
    this.sprites.updateSprite(handle, { alpha: 0 });
    this.fades.set(handle, {
      duration: durationSeconds,
      elapsed: 0,
      fromAlpha: 0,
      toAlpha: 1,
      onComplete: undefined,
    });
  }

  /** Drops a handle's in-flight position lerp + shove without touching its
   *  sprite. Used on death so a pending revert can't fight the fade-out. */
  cancel(handle: SpriteHandle): void {
    this.lerps.delete(handle);
    this.shoves.delete(handle);
  }

  /**
   * Drops every in-flight lerp, shove and fade without firing an onComplete.
   * BattleRenderer.detach flushes with it between battles, so no removeSprite
   * runs on handles about to be wiped anyway.
   */
  clear(): void {
    this.lerps.clear();
    this.fades.clear();
    this.shoves.clear();
  }

  update(dt: number): void {
    for (const [handle, lerp] of this.lerps) {
      lerp.elapsed += dt;
      // Homing: re-point `to` at the moving target each frame (a null return
      // holds the last destination). The provider writes into a scratch its
      // caller owns, copied out at once, so it can't alias this.scratch below.
      if (lerp.targetProvider) {
        const tgt = lerp.targetProvider();
        if (tgt) lerp.to.copy(tgt);
      }
      const t = lerp.elapsed >= lerp.duration ? 1 : lerp.elapsed / lerp.duration;
      this.scratch.copy(lerp.from).lerp(lerp.to, t);
      // A ground step re-times Y: rising completes by t = 0.5, falling starts
      // at t = 0.5 (ActiveLerp.groundStepY). XZ keeps the linear t.
      if (lerp.groundStepY && lerp.from.y !== lerp.to.y) {
        const yT = lerp.to.y > lerp.from.y ? Math.min(1, 2 * t) : Math.max(0, 2 * t - 1);
        this.scratch.y = lerp.from.y + (lerp.to.y - lerp.from.y) * yT;
      }
      // The parabolic arc: lift Y by arcHeight·4t(1−t) (0 at the ends, the
      // peak at the midpoint). arcHeight 0 leaves the straight line.
      if (lerp.arcHeight !== 0) this.scratch.y += lerp.arcHeight * 4 * t * (1 - t);
      this.sprites.updateSprite(handle, { position: this.scratch });
      if (t >= 1) {
        this.lerps.delete(handle);
        lerp.onComplete?.();
      }
    }
    // Melee shoves, in two phases: origin → peak over outDuration, then
    // peak → origin over backDuration. At the end, snap exactly home so
    // floating-point drift can't leave the sprite off its cell.
    for (const [handle, shove] of this.shoves) {
      shove.elapsed += dt;
      const total = shove.outDuration + shove.backDuration;
      if (shove.elapsed >= total) {
        this.sprites.updateSprite(handle, { position: shove.origin });
        this.shoves.delete(handle);
        continue;
      }
      if (shove.elapsed < shove.outDuration) {
        const t = shove.outDuration <= 0 ? 1 : shove.elapsed / shove.outDuration;
        this.scratch.copy(shove.origin).lerp(shove.peak, t);
      } else {
        const t =
          shove.backDuration <= 0 ? 1 : (shove.elapsed - shove.outDuration) / shove.backDuration;
        this.scratch.copy(shove.peak).lerp(shove.origin, t);
      }
      this.sprites.updateSprite(handle, { position: this.scratch });
    }
    for (const [handle, fade] of this.fades) {
      fade.elapsed += dt;
      const t = fade.elapsed >= fade.duration ? 1 : fade.elapsed / fade.duration;
      const alpha = fade.fromAlpha + (fade.toAlpha - fade.fromAlpha) * t;
      this.sprites.updateSprite(handle, { alpha });
      if (t >= 1) {
        this.fades.delete(handle);
        fade.onComplete?.();
      }
    }
  }
}
