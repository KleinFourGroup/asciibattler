import { describe, expect, it } from 'vitest';
import type { Run } from '../../run/Run';
import { PRE_ROOT_NODE_ID } from '../../run/NodeMap';
import { describeCommand, frontierOf, logHash, PHASE_ROWS, pickerFor } from './drive';

const asRun = (fake: object): Run => fake as unknown as Run;
const nodeMap = { rootId: 0, edges: [{ from: 3, to: 5 }, { from: 3, to: 6 }, { from: 4, to: 7 }] };

describe('the driver’s choices', () => {
  it('first always picks 0; seeded repeats from its seed', () => {
    const first = pickerFor('first', 9);
    expect([first(5), first(2), first(9)]).toEqual([0, 0, 0]);
    const a = pickerFor('seeded', 7);
    const b = pickerFor('seeded', 7);
    const seqA = Array.from({ length: 12 }, () => a(4));
    expect(Array.from({ length: 12 }, () => b(4))).toEqual(seqA);
    expect(seqA.every((i) => i >= 0 && i < 4)).toBe(true);
    const c = pickerFor('seeded', 8);
    expect(Array.from({ length: 12 }, () => c(4))).not.toEqual(seqA);
  });
});

describe('frontierOf (the harness’s computeFrontier)', () => {
  it('is the root before the run starts, then the current node’s edges', () => {
    expect(frontierOf(asRun({ currentNodeId: PRE_ROOT_NODE_ID, nodeMap }))).toEqual([0]);
    expect(frontierOf(asRun({ currentNodeId: 3, nodeMap }))).toEqual([5, 6]);
    expect(frontierOf(asRun({ currentNodeId: 7, nodeMap }))).toEqual([]);
  });
});

describe('PHASE_ROWS (what a player would send in each phase)', () => {
  const pick = (i: number) => () => i;

  it('enters the picked frontier node, and refuses a map with none', () => {
    expect(PHASE_ROWS.map(asRun({ currentNodeId: 3, nodeMap }), pick(1))).toEqual({
      command: { kind: 'enterNode', nodeId: 6 },
    });
    expect(() => PHASE_ROWS.map(asRun({ currentNodeId: 7, nodeMap }), pick(0))).toThrow(/no node to enter/);
  });

  it('picks among the enabled event choices only', () => {
    const run = asRun({ enabledEventChoices: () => [0, 2] });
    expect(PHASE_ROWS.event(run, pick(1))).toEqual({ command: { kind: 'chooseEventOption', choiceIndex: 2 } });
  });

  it('accepts a reward unless a packet meets a full cache', () => {
    const bits = asRun({ pendingRewards: [{ kind: 'bits' }], cacheHasRoom: false });
    expect(PHASE_ROWS.reward(bits, pick(0))).toEqual({ command: { kind: 'acceptReward', index: 0 } });
    const packetFull = asRun({ pendingRewards: [{ kind: 'packet' }], cacheHasRoom: false });
    expect(PHASE_ROWS.reward(packetFull, pick(0))).toEqual({ command: { kind: 'declineReward', index: 0 } });
    const packetRoom = asRun({ pendingRewards: [{ kind: 'packet' }], cacheHasRoom: true });
    expect(PHASE_ROWS.reward(packetRoom, pick(0))).toEqual({ command: { kind: 'acceptReward', index: 0 } });
  });

  it('recruits the picked offer, or passes on the slot after the last', () => {
    const offer = [{ archetype: 'archer' }, { archetype: 'mage' }];
    const run = asRun({ currentOffer: offer });
    expect(PHASE_ROWS.recruit(run, pick(1))).toEqual({ command: { kind: 'chooseRecruit', unitTemplate: offer[1] } });
    expect(PHASE_ROWS.recruit(run, pick(2))).toEqual({ command: { kind: 'passRecruit' } });
  });

  it('fights the battle phase and ends on defeat or completion', () => {
    const run = asRun({});
    expect(PHASE_ROWS.battle(run, pick(0))).toBe('fight');
    expect(PHASE_ROWS.defeat(run, pick(0))).toBe('end');
    expect(PHASE_ROWS.complete(run, pick(0))).toBe('end');
  });
});

describe('the driver’s log', () => {
  it('names a command in one short line', () => {
    expect(describeCommand({ kind: 'enterNode', nodeId: 4 })).toBe('enterNode 4');
    expect(describeCommand({ kind: 'dismissPromotion' })).toBe('dismissPromotion');
  });

  it('hashes equal logs equally, and order matters', () => {
    expect(logHash(['map: enterNode 0', 'turn-intro: advanceTurn'])).toBe(
      logHash(['map: enterNode 0', 'turn-intro: advanceTurn']),
    );
    expect(logHash(['a', 'b'])).not.toBe(logHash(['b', 'a']));
    expect(logHash(['ab'])).not.toBe(logHash(['a', 'b']));
  });
});
