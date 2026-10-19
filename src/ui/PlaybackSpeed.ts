/**
 * The playback speed and pause, held for the page's life. Game owns it and
 * passes it through `SceneContext`, so a speed carries across turns and
 * battles (set 2× once and every later battle keeps it), while the speed
 * strip that drives it is the HUD's, rebuilt each battle. `BattleScene.tick`
 * reads `current` each frame, so a change takes effect on the next.
 *
 * A speed is set by value, from the enabled steps, and pause is speed 0:
 * pause keeps the running speed, and `resume()` returns to it. The
 * pre-battle countdown is a pause with its own timer, so resuming is its
 * Fight now.
 *
 * The steps and `pauseEnabled` come from `config/playback.json`
 * (`PLAYBACK`), but are injectable so mechanic tests pin literals of their
 * own, never the shipped JSON.
 *
 * The hotkeys are the `Keybindings` registry's (`speedHalf` to `speed3`,
 * `togglePause`); the HUD subscribes each to `setSpeed` or `togglePause`.
 * This class is the state alone.
 *
 * A hold is not a pause. A surface that covers the battle and takes
 * the player's attention (the settings modal) holds the sim while it is up:
 * `current` reads 0, and the pre-battle countdown stands still too, which a
 * pause does not do (the countdown runs on real time through a pause and
 * then starts the fight). The player's own pause is untouched, so when the
 * hold is released the battle is as it was left: running, paused, or
 * counting down.
 */

import { PLAYBACK, type SpeedStep } from '../config/playback';
import { t } from '../i18n/ui';

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
  /** How many holds are live (the header's hold). */
  private holds = 0;
  private readonly selectListeners = new Set<() => void>();

  constructor(steps: readonly SpeedStep[] = PLAYBACK.speeds, pauseEnabled = PLAYBACK.pauseEnabled) {
    this.stepValues = steps
      .filter((s) => s.enabled)
      .map((s) => s.value)
      .sort((a, b) => a - b);
    this.canPause = pauseEnabled;
  }

  /** The multiplier `BattleScene.tick` scales `dt` by, 0 while paused or
   *  held: `Clock.advance(0)` fires no ticks, and the board's visuals stand
   *  still too. */
  get current(): number {
    return this.paused || this.holds > 0 ? 0 : this.selected;
  }

  /** Whether a hold is live. `BattleScene.tick` stands the countdown
   *  still while it is. */
  get isHeld(): boolean {
    return this.holds > 0;
  }

  /** Hold the sim until the returned release is called. Holds count,
   *  so two surfaces can each hold; a release called twice releases once. */
  hold(): () => void {
    this.holds++;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.holds--;
    };
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

  /** Select a running speed by value and unpause: picking a speed means run
   *  at it. A value the config disables, or doesn't have, does nothing.
   *  Returns whether it took (the caller repaints either way). */
  setSpeed(value: number): boolean {
    if (!this.select(value)) return false;
    this.paused = false;
    return true;
  }

  /** Select a running speed and leave pause as it is: the starting
   *  speed, a setting, is taken at boot and when its row changes, which can
   *  be while a battle is paused behind the settings. A disabled/unknown
   *  value is a no-op, as in `setSpeed`. */
  select(value: number): boolean {
    if (!this.stepValues.includes(value)) return false;
    const changed = this.selected !== value;
    this.selected = value;
    if (changed) for (const listener of [...this.selectListeners]) listener();
    return true;
  }

  /** Called after the selected speed changes, by whichever route: the
   *  speed pane repaints its buttons when the settings change the speed from
   *  outside it. Returns the unsubscribe. */
  onSelect(listener: () => void): () => void {
    this.selectListeners.add(listener);
    return () => {
      this.selectListeners.delete(listener);
    };
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
    return this.paused ? t('playback.paused') : `${this.selected}×`;
  }
}
