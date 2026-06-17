/**
 * Q1 — the playback speed + pause controller (was I3's cycle holder).
 *
 * A page-lifetime holder for the current sim-speed multiplier. Owned by `Game`
 * and threaded through `SceneContext`, so the value PERSISTS across
 * turns/battles (set 2× once and every later battle keeps it) even though the
 * *control surface* — the speed pane — is rebuilt per battle by the `HUD` (and
 * torn down on its `dispose`). `BattleScene.tick` reads `current` live each
 * frame, so a mid-battle speed change takes effect on the next frame.
 *
 * I3 was a single cycle-through-steps button. Q1 turns it into a **set-by-value
 * model** over the enabled steps (0.5× / 1× / 2× / 3×) plus a **pause** (speed
 * 0). Pause remembers the running speed and `resume()` restores it (the
 * ROADMAP §Q1 "resume-at-prior-speed"). The countdown (Q2) is just a pause with
 * an auto-unpause timer — the same "is the sim advancing?" state, so the single
 * pause key doubles as the countdown's "Fight now" once Q2 lands.
 *
 * The steps + the `pauseEnabled` flag come from `config/playback.json`
 * (`PLAYBACK`), but are injectable so mechanic tests pin explicit literals
 * (never the shipped JSON).
 *
 * J3 — the hotkeys live in the unified `Keybindings` registry
 * (`config/keybindings.json`: `speedHalf` / `speed1` / `speed2` / `speed3` /
 * `togglePause`). The HUD subscribes each to the matching `setSpeed` /
 * `togglePause` call; this class is purely the speed state.
 */

import { PLAYBACK, type SpeedStep } from '../config/playback';

/** The home speed a fresh controller (and `resume()` without a prior pick)
 *  starts at — the config schema guarantees an enabled step with this value. */
const HOME_SPEED = 1;

export class PlaybackSpeed {
  /** Enabled step values, ascending — one pane button each. */
  private readonly stepValues: readonly number[];
  private readonly canPause: boolean;
  /** The running speed (one of `stepValues`); what `resume()` returns to. */
  private selected = HOME_SPEED;
  private paused = false;

  constructor(steps: readonly SpeedStep[] = PLAYBACK.speeds, pauseEnabled = PLAYBACK.pauseEnabled) {
    this.stepValues = steps
      .filter((s) => s.enabled)
      .map((s) => s.value)
      .sort((a, b) => a - b);
    this.canPause = pauseEnabled;
  }

  /** The active multiplier `BattleScene.tick` scales `dt` by. **0 while paused**
   *  — `Clock.advance(0)` fires no ticks and freezes the board visuals too. */
  get current(): number {
    return this.paused ? 0 : this.selected;
  }

  /** The selected running speed, independent of pause — drives the active-button
   *  highlight (a button stays "selected" while the board is paused). */
  get selectedSpeed(): number {
    return this.selected;
  }

  get isPaused(): boolean {
    return this.paused;
  }

  get pauseEnabled(): boolean {
    return this.canPause;
  }

  /** The enabled speed values, ascending — the pane renders one button each. */
  get steps(): readonly number[] {
    return this.stepValues;
  }

  /** Select a running speed by value (and unpause — picking a speed means
   *  "run at this speed"). A disabled/unknown value is a **no-op** so a hotkey
   *  for a speed the difficulty system disabled does nothing. Returns whether it
   *  took (the caller re-renders either way). */
  setSpeed(value: number): boolean {
    if (!this.stepValues.includes(value)) return false;
    this.selected = value;
    this.paused = false;
    return true;
  }

  /** Toggle pause. No-op when pause is disabled. Resume restores the selected
   *  speed (the value never changed — `current` just stops reading 0). */
  togglePause(): void {
    if (!this.canPause) return;
    this.paused = !this.paused;
  }

  /** Park the sim (no-op when pause is disabled). */
  pause(): void {
    if (this.canPause) this.paused = true;
  }

  /** Resume at the selected speed. Always valid — "not paused" needs no flag. */
  resume(): void {
    this.paused = false;
  }

  /** Compact label for the current state, e.g. `"2×"` or `"Paused"`. */
  get label(): string {
    return this.paused ? 'Paused' : `${this.selected}×`;
  }
}
