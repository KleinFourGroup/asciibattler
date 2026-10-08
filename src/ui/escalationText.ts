/**
 * 117e — THE ESCALATION LEVELS IN WORDS (Round 8 spec D8). A level is told
 * to the player by what it adds to the level under it, in a sentence and
 * with no number: the ladder adds a lever that comes again and multiplies
 * different levers, and a percentage would invite the player to do sums that
 * come out wrong. The sentences follow the ladder (`escalationSteps`,
 * config/escalation.ts), so a retuned file needs no new words: a lever a
 * level moves for the first time has its sentence, and one that moves again
 * has its "still" form.
 *
 * Shared by character select's picker and the end screen.
 */

import { escalationSteps, type EscalationLever } from '../config/escalation';
import { t } from '../i18n/ui';

/** A lever's sentence the first time a level moves it, and every time after.
 *  Each is a whole entry: word order is the translator's. */
const ADDS: Record<EscalationLever, readonly [first: () => string, again: () => string]> = {
  levelBudget: [() => t('escalation.adds.levelBudget'), () => t('escalation.adds.levelBudget.again')],
  wave: [() => t('escalation.adds.wave'), () => t('escalation.adds.wave.again')],
  bits: [() => t('escalation.adds.bits'), () => t('escalation.adds.bits.again')],
};

/** "Escalation 3": the level's name, 0 included. */
export function escalationName(level: number): string {
  return t('escalation.level', { level });
}

/** What `level` adds to the level under it; at 0, that the run is the
 *  standard one. */
export function escalationAdds(level: number): string {
  if (level === 0) return t('escalation.off');
  return escalationSteps(level)
    .map(({ lever, earlier }) => ADDS[lever][earlier === 0 ? 0 : 1]())
    .join(' ');
}

/**
 * The picker's tooltip at `level`: every level in effect, one to a line,
 * under the sentence that says a level keeps the ones under it, then how a
 * level is opened. At 0 no level is in effect and only the last part shows.
 */
export function escalationTooltip(level: number): string {
  const lines: string[] = [];
  if (level > 0) {
    lines.push(t('escalation.tip.keeps'));
    for (let n = 1; n <= level; n++) lines.push(t('escalation.tip.line', { level: n, adds: escalationAdds(n) }));
    lines.push('');
  }
  lines.push(t('escalation.tip.unlock'));
  return lines.join('\n');
}
