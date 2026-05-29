import * as THREE from 'three';
import type { SpriteHandle, SpriteRenderer } from '../SpriteRenderer';

/**
 * Bridges discrete sim moves to continuous on-screen motion. The sim updates
 * `unit.position` instantly on the tick it moves; this class keeps the sprite
 * visually mid-step, lerping over the cooldown duration so the eye sees a
 * smooth glide.
 *
 * Single in-flight lerp per handle. If a second `startLerp` arrives before
 * the first finishes (rare — would require `moveCooldownTicks` < tick
 * granularity), the second replaces the first; the visual jolt of snapping
 * to the new `from` is acceptable.
 */
interface ActiveLerp {
  readonly from: THREE.Vector3;
  readonly to: THREE.Vector3;
  readonly duration: number;
  elapsed: number;
  /** Fired once when the lerp completes. E6.B uses it to despawn a
   *  projectile sprite on arrival. Undefined for plain move lerps. */
  readonly onComplete: (() => void) | undefined;
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
 * E6.A — melee shove. A there-and-back position animation: the sprite
 * lunges from `origin` to `peak` over `outDuration`, then recovers to
 * `origin` over `backDuration`. Used to make a melee swing read as a
 * physical strike instead of a static color flash.
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
  ): void {
    // A move overrides any in-flight melee shove (E6.A) so the two never
    // fight over this sprite's position.
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
      onComplete,
    });
  }

  /**
   * E6.A — start a melee shove: lunge from the sprite's current position
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
   * D5.C — overflow-spawn fade-in. Sprite snaps to alpha 0 immediately,
   * then lerps to 1 over `durationSeconds`. Replaces any in-flight fade
   * for the same handle. No onComplete — the sprite stays at full alpha
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
   * Drops every in-flight lerp and fade without firing fade onComplete
   * callbacks. Used by BattleRenderer.detach to flush state between battles
   * without triggering removeSprite on handles that are about to be wiped
   * out anyway.
   */
  clear(): void {
    this.lerps.clear();
    this.fades.clear();
    this.shoves.clear();
  }

  update(dt: number): void {
    for (const [handle, lerp] of this.lerps) {
      lerp.elapsed += dt;
      const t = lerp.elapsed >= lerp.duration ? 1 : lerp.elapsed / lerp.duration;
      this.scratch.copy(lerp.from).lerp(lerp.to, t);
      this.sprites.updateSprite(handle, { position: this.scratch });
      if (t >= 1) {
        this.lerps.delete(handle);
        lerp.onComplete?.();
      }
    }
    // E6.A — melee shoves. Two-phase: origin → peak over outDuration, then
    // peak → origin over backDuration. On completion snap exactly home so
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
