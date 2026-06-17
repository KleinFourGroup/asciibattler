/**
 * D5.C: spawn-in lockout duration. Overflow-queue units perform a
 * `SpawnAction` as their first activeAction; the unit can't propose
 * for this many ticks. Renderer lerps sprite + bar alpha 0 → 1 over
 * the same wall-clock window so the lockout and the visual fade-in
 * line up. (This is the MID-BATTLE reinforcement fade — `instant: false`
 * spawns — and it stays.)
 *
 * Q2 retired `turnIntroSeconds` (the M3 turn-start materialize). The
 * battle-start placements (`instant: true`) now appear immediately — the
 * fade "read as loading" — and the sim hold is replaced by the pre-battle
 * COUNTDOWN (`config/playback.json` `countdownSeconds`), a longer, purposeful
 * reaction-time window. So this config is back to just the D5.C lockout.
 *
 * Authored in seconds per gotcha #6 — changing TICK_RATE doesn't
 * re-tune balance.
 */

import { z } from 'zod';
import spawnJson from '../../config/spawn.json';
import { secondsToTicks } from '../config';

const SpawnSchema = z.object({
  durationSeconds: z.number().positive(),
});

const parsed = SpawnSchema.parse(spawnJson);

export const SPAWN = {
  durationSeconds: parsed.durationSeconds,
  durationTicks: secondsToTicks(parsed.durationSeconds),
} as const;
