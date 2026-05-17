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

export class SpriteAnimator {
  private readonly lerps = new Map<SpriteHandle, ActiveLerp>();
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

  /** Drops a handle's in-flight lerp without touching its sprite. */
  cancel(handle: SpriteHandle): void {
    this.lerps.delete(handle);
  }

  update(dt: number): void {
    for (const [handle, lerp] of this.lerps) {
      lerp.elapsed += dt;
      const t = lerp.elapsed >= lerp.duration ? 1 : lerp.elapsed / lerp.duration;
      this.scratch.copy(lerp.from).lerp(lerp.to, t);
      this.sprites.updateSprite(handle, { position: this.scratch });
      if (t >= 1) this.lerps.delete(handle);
    }
  }
}
