/**
 * ESCALATION — the difficulty ladder (Round 8 spec D8).
 *
 * A run is played at a level, 0 (off) to `ESCALATION_MAX`. A level keeps
 * every lever of the levels under it, so the file holds, per level from 1 up,
 * where each of the three levers stands AT that level:
 *
 * - `levelBudget` — the enemy level budget.
 * - `wave`        — the enemy wave. It raises three things by the same factor:
 *                   the wave's head count, its level budget and the enemy's
 *                   pool. Under the casualty rule each enemy body is worth a
 *                   point of enemy morale, so a bigger wave on the same budget
 *                   and pool spreads the same levels over more bodies and
 *                   could come out easier; scaled together, each body is as
 *                   strong and the fight as long.
 * - `bits`        — the bits a run earns.
 *
 * HOW THEY COMBINE. A lever that comes again ADDS, and that is authored: the
 * file says 1.1 and, two levels on, 1.2, and no code adds anything. Different
 * levers MULTIPLY (`leverFactors`): the level budget is its own lever times
 * the wave lever, so the wave lever never changes how strong one body is and
 * the budget lever is exactly its own percentage.
 *
 * No level is easier than the one under it: the parse refuses a ladder where
 * a lever eases, level 0 standing as 1 for all three.
 *
 * Level 0 is not in the file. It is the identity by construction
 * (`withEscalation` hands back the multipliers it was given), which keeps a
 * run with Escalation off byte-identical to a run from before the ladder.
 *
 * The level is a run input (`RunConfig.escalation`) and is saved in the run's
 * snapshot. The multipliers are derived from the level and this table when a
 * run is constructed and every time one is loaded, never stored.
 *
 * Source of truth at `config/escalation.json`.
 */

import { z } from 'zod';
import escalationJson from '../../config/escalation.json';
import type { DifficultyMultipliers } from './difficulty';

const LeversSchema = z.object({
  levelBudget: z.number().positive(),
  wave: z.number().positive(),
  bits: z.number().positive(),
});

/** Where the three levers stand at one level. */
export type EscalationLevers = z.infer<typeof LeversSchema>;

const EscalationSchema = z
  .object({ levels: z.array(LeversSchema).min(1) })
  .superRefine((ladder, ctx) => {
    let under: EscalationLevers = { levelBudget: 1, wave: 1, bits: 1 };
    ladder.levels.forEach((levers, i) => {
      const eased = [
        levers.levelBudget < under.levelBudget ? 'levelBudget' : null,
        levers.wave < under.wave ? 'wave' : null,
        levers.bits > under.bits ? 'bits' : null,
      ].filter((name) => name !== null);
      if (eased.length > 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['levels', i],
          message: `level ${i + 1} is easier than level ${i} on ${eased.join(', ')}`,
        });
      }
      under = levers;
    });
  });

/** Parse a ladder. Exported for its test; the game reads `ESCALATION_LEVELS`. */
export function parseEscalation(raw: unknown): readonly EscalationLevers[] {
  return EscalationSchema.parse(raw).levels;
}

/** The shipped ladder: entry `n - 1` is level `n`. */
export const ESCALATION_LEVELS: readonly EscalationLevers[] = parseEscalation(escalationJson);

/** The highest level. */
export const ESCALATION_MAX = ESCALATION_LEVELS.length;

/** Whether `value` is a level of the shipped ladder, 0 (off) included. */
export function isEscalationLevel(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= ESCALATION_MAX;
}

/** A lever's name, in the order a level's words list them. */
export type EscalationLever = keyof EscalationLevers;
const LEVERS: readonly EscalationLever[] = ['levelBudget', 'wave', 'bits'];

/** One lever a level moves, and how many levels under it moved the same
 *  lever before (0 the first time). */
export interface LeverStep {
  readonly lever: EscalationLever;
  readonly earlier: number;
}

/**
 * What `level` adds to the level under it: each lever it moves, in the
 * levers' order. This is what the player is told of a level, in words and
 * with no number (src/ui/escalationText.ts), so the words follow the file.
 * Level 0, and a level that moves nothing, add nothing.
 */
export function escalationSteps(level: number, ladder: readonly EscalationLevers[] = ESCALATION_LEVELS): readonly LeverStep[] {
  const off: EscalationLevers = { levelBudget: 1, wave: 1, bits: 1 };
  const at = (n: number): EscalationLevers => (n <= 0 ? off : (ladder[n - 1] ?? off));
  if (!Number.isInteger(level) || level < 1 || level > ladder.length) return [];
  const moved = (n: number, lever: EscalationLever): boolean => at(n)[lever] !== at(n - 1)[lever];
  const steps: LeverStep[] = [];
  for (const lever of LEVERS) {
    if (!moved(level, lever)) continue;
    let earlier = 0;
    for (let n = 1; n < level; n++) if (moved(n, lever)) earlier++;
    steps.push({ lever, earlier });
  }
  return steps;
}

/**
 * What one level's levers do to the four per-run multipliers. The wave lever
 * goes to the count, the budget and the enemy's pool alike; the budget lever
 * multiplies with it on the budget.
 */
export function leverFactors(levers: EscalationLevers): DifficultyMultipliers {
  return {
    waveSize: levers.wave,
    levelBudget: levers.levelBudget * levers.wave,
    bits: levers.bits,
    enemyMorale: levers.wave,
  };
}

/**
 * The multipliers a run plays under at `level`: the ones it resolved from its
 * config and `difficulty.json`, times the level's factors. Level 0 returns
 * `base` itself. A level off the ladder throws; callers check
 * `isEscalationLevel` first where the value comes from outside.
 */
export function withEscalation(base: DifficultyMultipliers, level: number): DifficultyMultipliers {
  if (level === 0) return base;
  const levers = ESCALATION_LEVELS[level - 1];
  if (!Number.isInteger(level) || levers === undefined) {
    throw new Error(`escalation: ${level} is not a level (0 to ${ESCALATION_MAX})`);
  }
  const factors = leverFactors(levers);
  return {
    waveSize: base.waveSize * factors.waveSize,
    levelBudget: base.levelBudget * factors.levelBudget,
    bits: base.bits * factors.bits,
    enemyMorale: base.enemyMorale * factors.enemyMorale,
  };
}
