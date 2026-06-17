/**
 * I3 / Q1 — playback speed + pause knobs.
 *
 * Playback is a **tick-batching multiplier on the fixed-timestep loop**
 * (`BattleScene.tick` scales the real `dt` it feeds the `Clock`, the renderer,
 * and the terrain shader by the active speed) — NOT a `TICK_RATE` change. The
 * `Clock` still fires whole fixed-timestep ticks, so the sim is byte-identical:
 * the same `world.tick()` calls in the same order, just batched into fewer (or
 * — at 0.5× — more) rAF frames. **Pause is speed 0**: `Clock.advance(0)` fires
 * no ticks and freezes the board's visuals too (everything downstream gets
 * `dt × 0`). Purely presentation — no snapshot/fuzz impact (the fuzz harness
 * drives `World` directly and never sees `BattleScene`).
 *
 * Q1 reshaped the config from a bare `speeds: number[]` cycle list into a
 * **per-step record** carrying an `enabled` flag, plus a top-level
 * `pauseEnabled`. The flags are the **difficulty-system groundwork** (the
 * ROADMAP §Q1 "individually disable pauses and specific speeds … in
 * preparation for difficulty levels") — every step ships enabled today; the
 * future difficulty system just flips flags. The pane renders one button per
 * **enabled** step, ascending.
 *
 * `1×` (normal play) must always be present + enabled — it's the home/default
 * speed a fresh battle starts at and the value pause resumes to if nothing else
 * was picked. The schema enforces it. Step values must be unique (one button
 * each).
 *
 * J3 — the per-speed + pause HOTKEYS live in the unified keybinding config
 * (`config/keybindings.json`, `src/config/keybindings.ts`), not here; this
 * config is just the speed-step list + flags.
 *
 * Source of truth at `config/playback.json`.
 */

import { z } from 'zod';
import playbackJson from '../../config/playback.json';

const SpeedStepSchema = z.object({
  /** The multiplier `BattleScene.tick` scales `dt` by (e.g. 0.5, 1, 2, 3). */
  value: z.number().positive(),
  /** Whether the pane offers this speed today (difficulty-system groundwork). */
  enabled: z.boolean(),
});

export type SpeedStep = z.infer<typeof SpeedStepSchema>;

const PlaybackSchema = z
  .object({
    speeds: z.array(SpeedStepSchema).nonempty(),
    /** Whether pause (speed 0) is offered. Off = the pane hides the control. */
    pauseEnabled: z.boolean(),
    /** Q2 — the pre-battle countdown length in seconds: the sim-parked window,
     *  counted in REAL dt, during which the player reads the board + sets
     *  orders before the fight starts. `0` disables it (instant start). */
    countdownSeconds: z.number().nonnegative(),
  })
  // Normal play is the home speed — a fresh battle starts at 1× and pause
  // resumes there by default, so an enabled 1× must always exist.
  .refine((c) => c.speeds.some((s) => s.enabled && s.value === 1), {
    message: 'playback.speeds must include an enabled 1× (normal speed)',
    path: ['speeds'],
  })
  // One button per value — duplicates would render twice and confuse setSpeed.
  .refine((c) => new Set(c.speeds.map((s) => s.value)).size === c.speeds.length, {
    message: 'playback.speeds values must be unique',
    path: ['speeds'],
  });

export type PlaybackConfig = z.infer<typeof PlaybackSchema>;

export const PLAYBACK: PlaybackConfig = PlaybackSchema.parse(playbackJson);
