/**
 * I3 — fast-forward (1× / 2× / 3×) knobs.
 *
 * Fast-forward is a **tick-batching multiplier on the fixed-timestep loop**
 * (`BattleScene.tick` scales the real `dt` it feeds the `Clock`, the renderer,
 * and the terrain shader by the active speed) — NOT a `TICK_RATE` change. The
 * `Clock` still fires whole fixed-timestep ticks, so the sim is byte-identical:
 * the same `world.tick()` calls in the same order, just batched into fewer rAF
 * frames. Purely presentation — no snapshot/fuzz impact (the fuzz harness drives
 * `World` directly and never sees `BattleScene`).
 *
 * - `speeds`  — the cycle list the HUD button + hotkey step through, in order.
 *               MUST start at **1** (normal play is the default + the cycle's
 *               home). Dropping the trailing `3` is exactly how you cap the
 *               ceiling at 2× if pathing can't keep up at 3× on a big board
 *               (the ROADMAP §I3 perf watch-item — profile before trusting 3×).
 *
 * J3 — the fast-forward `hotkey` field that used to live here RELOCATED to the
 * unified keybinding config (`config/keybindings.json` `fastForward`,
 * `src/config/keybindings.ts`), as the I3 note here anticipated. This config is
 * now just the speed-step list.
 *
 * Source of truth at `config/playback.json`.
 */

import { z } from 'zod';
import playbackJson from '../../config/playback.json';

const PlaybackSchema = z
  .object({
    speeds: z.array(z.number().positive()).nonempty(),
  })
  // Normal play is the cycle's home — the first step must be 1× so a fresh
  // battle (and the wrap-around) lands on real-time.
  .refine((c) => c.speeds[0] === 1, {
    message: 'playback.speeds must start with 1 (normal speed)',
    path: ['speeds'],
  });

export type PlaybackConfig = z.infer<typeof PlaybackSchema>;

export const PLAYBACK: PlaybackConfig = PlaybackSchema.parse(playbackJson);
