/**
 * I3 — the fast-forward speed controller.
 *
 * A tiny page-lifetime holder for the current sim-speed multiplier. Owned by
 * `Game` and threaded through `SceneContext`, so the value PERSISTS across
 * turns/battles (set 2×/3× once and every later battle keeps it) even though
 * the *control surface* — the button + hotkey — is rebuilt per battle by the
 * `HUD` (and torn down on its `dispose`). `BattleScene.tick` reads `current`
 * live each frame, so a mid-battle cycle takes effect on the next frame.
 *
 * The steps come from `config/playback.json` (`PLAYBACK.speeds`), but are
 * injectable so mechanic tests pin explicit literals (never the shipped JSON).
 *
 * J3 — the fast-forward HOTKEY no longer lives here: it moved into the unified
 * `Keybindings` registry (`config/keybindings.json` `fastForward`). The HUD
 * subscribes the cycle to `keybindings.on('fastForward', …)`; this class is now
 * purely the speed state.
 */

import { PLAYBACK } from '../config/playback';

export class PlaybackSpeed {
  private readonly steps: readonly number[];
  private index = 0;

  constructor(steps: readonly number[] = PLAYBACK.speeds) {
    this.steps = steps;
  }

  /** The active multiplier (e.g. 1, 2, 3). `BattleScene.tick` scales `dt` by it. */
  get current(): number {
    return this.steps[this.index];
  }

  /** Advance to the next step, wrapping back to the first. Returns the new
   *  multiplier so callers can update their label without re-reading. */
  cycle(): number {
    this.index = (this.index + 1) % this.steps.length;
    return this.current;
  }

  /** Compact button label for the current speed, e.g. `"2×"`. */
  get label(): string {
    return `${this.current}×`;
  }
}
