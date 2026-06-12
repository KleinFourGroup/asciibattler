/**
 * D5.C: spawn-in lockout duration. Overflow-queue units perform a
 * `SpawnAction` as their first activeAction; the unit can't propose
 * for this many ticks. Renderer lerps sprite + bar alpha 0 → 1 over
 * the same wall-clock window so the lockout and the visual fade-in
 * line up.
 *
 * M3: `turnIntroSeconds` — the turn-start materialize. Initial combatant
 * placements fade in over this window while BattleScene holds the sim
 * clock for the same duration, so a turn opens with a breath instead of
 * instant combat. RENDER-ONLY (no ticks derivation): the hold delays when
 * ticking *starts*, never which ticks run — the sim stays byte-identical.
 *
 * Authored in seconds per gotcha #6 — changing TICK_RATE doesn't
 * re-tune balance.
 */

import { z } from 'zod';
import spawnJson from '../../config/spawn.json';
import { secondsToTicks } from '../config';

const SpawnSchema = z.object({
  durationSeconds: z.number().positive(),
  turnIntroSeconds: z.number().positive(),
});

const parsed = SpawnSchema.parse(spawnJson);

export const SPAWN = {
  durationSeconds: parsed.durationSeconds,
  durationTicks: secondsToTicks(parsed.durationSeconds),
  turnIntroSeconds: parsed.turnIntroSeconds,
} as const;
