/**
 * 112c — the whole-run driver's decisions: one row per run phase, each
 * answering "what would a player send here" from the live Run. The loop
 * that sends them, fights the battles and audits the frames is the kit's
 * (`__probe.drive`, ./index.ts); this module is pure over the Run, so it is
 * tested without a page (drive.test.ts).
 *
 * The rows follow the fuzz harness's answers (tests/fuzz/harness.ts,
 * `runOne`) with a smaller policy: the choices a player makes (the node, the
 * event option, the recruit) are a seeded pick or always the first; the
 * rest are fixed (accept every reward unless a packet meets a full cache,
 * buy nothing at a port, pass the pre-turn grants).
 */

import { RNG } from '../../core/RNG';
import type { RunCommand } from '../../run/Command';
import { PRE_ROOT_NODE_ID } from '../../run/NodeMap';
import type { Run, RunPhase } from '../../run/Run';

export type DrivePolicy = 'seeded' | 'first';

/** What a phase's row decides: a command to send, a battle to fight, or the end. */
export type Step = { readonly command: RunCommand } | 'fight' | 'end';

/** A choice among `n` options: an index in [0, n). */
export type Chooser = (n: number) => number;

export function pickerFor(policy: DrivePolicy, seed: number): Chooser {
  if (policy === 'first') return () => 0;
  const rng = new RNG(seed);
  return (n) => rng.int(0, n - 1);
}

/** The nodes a player may enter next (the fuzz harness's `computeFrontier`). */
export function frontierOf(run: Pick<Run, 'currentNodeId' | 'nodeMap'>): number[] {
  if (run.currentNodeId === PRE_ROOT_NODE_ID) return [run.nodeMap.rootId];
  return run.nodeMap.edges.filter((e) => e.from === run.currentNodeId).map((e) => e.to);
}

type Row = (run: Run, pick: Chooser) => Step;

/** One row per phase, so a new `RunPhase` fails typecheck until it has one. */
export const PHASE_ROWS: Record<RunPhase, Row> = {
  map: (run, pick) => {
    const frontier = frontierOf(run);
    if (frontier.length === 0) throw new Error('__probe.drive: the map has no node to enter');
    return { command: { kind: 'enterNode', nodeId: frontier[pick(frontier.length)]! } };
  },
  event: (run, pick) => {
    const enabled = run.enabledEventChoices();
    if (enabled.length === 0) throw new Error('__probe.drive: an event page with no enabled choice');
    return { command: { kind: 'chooseEventOption', choiceIndex: enabled[pick(enabled.length)]! } };
  },
  // The rest gate's one option. No pick: the chooser's stream is the run's
  // other choices', and a rest must not move it.
  rest: () => ({ command: { kind: 'chooseRestOption', optionIndex: 0 } }),
  // The pre-turn gate's Fight; the grants go unspent.
  'turn-intro': () => ({ command: { kind: 'advanceTurn' } }),
  battle: () => 'fight',
  'turn-outcome': () => ({ command: { kind: 'advanceTurn' } }),
  reward: (run) => {
    const portion = run.pendingRewards?.[0];
    if (portion === undefined) throw new Error('__probe.drive: the reward phase with no pending reward');
    const accept = !(portion.kind === 'packet' && !run.cacheHasRoom);
    return { command: accept ? { kind: 'acceptReward', index: 0 } : { kind: 'declineReward', index: 0 } };
  },
  promotion: () => ({ command: { kind: 'dismissPromotion' } }),
  recruit: (run, pick) => {
    const offer = run.currentOffer;
    if (offer === null || offer.length === 0) return { command: { kind: 'passRecruit' } };
    // One more slot than the offer: the last one passes.
    const i = pick(offer.length + 1);
    return { command: i === offer.length ? { kind: 'passRecruit' } : { kind: 'chooseRecruit', unitTemplate: offer[i]! } };
  },
  sectorCleared: () => ({ command: { kind: 'dismissSectorCleared' } }),
  port: () => ({ command: { kind: 'leavePort' } }),
  defeat: () => 'end',
  complete: () => 'end',
};

/** A command as one short log word, e.g. `enterNode 4`. */
export function describeCommand(command: RunCommand): string {
  switch (command.kind) {
    case 'enterNode':
      return `enterNode ${command.nodeId}`;
    case 'chooseEventOption':
      return `chooseEventOption ${command.choiceIndex}`;
    case 'chooseRestOption':
      return `chooseRestOption ${command.optionIndex}`;
    case 'chooseRecruit':
      return `chooseRecruit ${command.unitTemplate.archetype}`;
    case 'acceptReward':
    case 'declineReward':
      return `${command.kind} ${command.index}`;
    default:
      return command.kind;
  }
}

/** FNV-1a over the log's lines, so two runs compare in one short word. */
export function logHash(lines: readonly string[]): string {
  let h = 0x811c9dc5;
  for (const line of lines) {
    for (let i = 0; i < line.length; i++) h = Math.imul(h ^ line.charCodeAt(i), 0x01000193) >>> 0;
    h = Math.imul(h ^ 10, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}
