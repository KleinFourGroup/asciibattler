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

export class SpriteAnimator {
  private readonly lerps = new Map<SpriteHandle, ActiveLerp>();
  private readonly fades = new Map<SpriteHandle, ActiveFade>();
  private readonly scratch = new THREE.Vector3();

  constructor(private readonly sprites: SpriteRenderer) {}

  startLerp(
    handle: SpriteHandle,
    from: THREE.Vector3,
    to: THREE.Vector3,
    durationSeconds: number,
  ): void {
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

  /** Drops a handle's in-flight position lerp without touching its sprite. */
  cancel(handle: SpriteHandle): void {
    this.lerps.delete(handle);
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
  }

  update(dt: number): void {
    for (const [handle, lerp] of this.lerps) {
      lerp.elapsed += dt;
      const t = lerp.elapsed >= lerp.duration ? 1 : lerp.elapsed / lerp.duration;
      this.scratch.copy(lerp.from).lerp(lerp.to, t);
      this.sprites.updateSprite(handle, { position: this.scratch });
      if (t >= 1) this.lerps.delete(handle);
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
