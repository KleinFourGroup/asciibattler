/**
 * The battle's playback speeds and pause. Source of truth at
 * `config/playback.json`; their hotkeys are in `config/keybindings.json`.
 *
 * A speed multiplies the real `dt` that `BattleScene.tick` feeds the
 * `Clock`, the renderer and the terrain shader; it is not a `TICK_RATE`
 * change. The `Clock` still fires whole fixed ticks, so the sim runs the
 * same ticks in the same order, batched into fewer frames or more. Pause is
 * speed 0: no ticks fire and the board's visuals freeze. It is presentation
 * only, and the fuzz harness, which drives `World` directly, never sees it.
 *
 * - `speeds` — the steps the pane offers, one button per enabled step in
 *   ascending order. Values are unique, and an enabled 1× must exist: a
 *   battle starts there and pause resumes there by default.
 * - `pauseEnabled` — whether pause is offered; off hides the control.
 * - `countdownSeconds` — the pre-battle window, counted in real time, in
 *   which the sim waits while the player reads the board and sets orders.
 *   0 starts the battle at once.
 */

import { z } from 'zod';
import playbackJson from '../../config/playback.json';

const SpeedStepSchema = z.object({
  /** The multiplier on `dt`. */
  value: z.number().positive(),
  /** Whether the pane offers this speed. */
  enabled: z.boolean(),
});

export type SpeedStep = z.infer<typeof SpeedStepSchema>;

const PlaybackSchema = z
  .object({
    speeds: z.array(SpeedStepSchema).nonempty(),
    pauseEnabled: z.boolean(),
    countdownSeconds: z.number().nonnegative(),
  })
  .refine((c) => c.speeds.some((s) => s.enabled && s.value === 1), {
    message: 'playback.speeds must include an enabled 1× (normal speed)',
    path: ['speeds'],
  })
  // One button per value — duplicates would render twice and confuse setSpeed.
  .refine((c) => new Set(c.speeds.map((s) => s.value)).size === c.speeds.length, {
    message: 'playback.speeds values must be unique',
    path: ['speeds'],
  });

type PlaybackConfig = z.infer<typeof PlaybackSchema>;

export const PLAYBACK: PlaybackConfig = PlaybackSchema.parse(playbackJson);
