import { describe, it, expect } from 'vitest';
import { Run } from './Run';
import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';

describe('Run', () => {
  describe('initial state', () => {
    it('starts in map phase at the nodeMap root', () => {
      const run = new Run(1, new EventBus<GameEvents>());
      expect(run.phase).toBe('map');
      expect(run.currentNodeId).toBe(run.nodeMap.rootId);
    });

    it('rolls a starting team of 5 units (3 melee + 2 ranged)', () => {
      const run = new Run(1, new EventBus<GameEvents>());
      expect(run.team).toHaveLength(5);
      const melee = run.team.filter((t) => t.archetype === 'melee');
      const ranged = run.team.filter((t) => t.archetype === 'ranged');
      expect(melee).toHaveLength(3);
      expect(ranged).toHaveLength(2);
    });

    it('emits run:started on construction', () => {
      const bus = new EventBus<GameEvents>();
      const seen: number[] = [];
      bus.on('run:started', ({ seed }) => seen.push(seed));
      new Run(42, bus);
      expect(seen).toEqual([42]);
    });
  });

  describe('determinism', () => {
    it('same seed → same nodeMap and same starting team', () => {
      const a = new Run(42, new EventBus<GameEvents>());
      const b = new Run(42, new EventBus<GameEvents>());
      expect(a.nodeMap).toEqual(b.nodeMap);
      expect(a.team).toEqual(b.team);
    });

    it('same seed → same first encounter (worldSeed + teams)', () => {
      const a = freshRunWithBus(42);
      const b = freshRunWithBus(42);
      const frontier = a.run.nodeMap.edges.find((e) => e.from === a.run.rootId)!.to;
      a.bus.emit('run:nodeEntered', { nodeId: frontier });
      b.bus.emit('run:nodeEntered', { nodeId: frontier });
      expect(a.run.currentEncounter).toEqual(b.run.currentEncounter);
    });
  });

  describe('handleNodeEntered', () => {
    it('transitions to battle phase on a frontier hop', () => {
      const { run, bus } = freshRunWithBus(1);
      const frontier = run.nodeMap.edges.find((e) => e.from === run.rootId)!.to;
      bus.emit('run:nodeEntered', { nodeId: frontier });
      expect(run.phase).toBe('battle');
      expect(run.currentNodeId).toBe(frontier);
    });

    it('emits battle:started with the encounter worldSeed', () => {
      const { run, bus } = freshRunWithBus(1);
      const frontier = run.nodeMap.edges.find((e) => e.from === run.rootId)!.to;
      const seeds: number[] = [];
      bus.on('battle:started', ({ worldSeed }) => seeds.push(worldSeed));
      bus.emit('run:nodeEntered', { nodeId: frontier });
      expect(seeds).toHaveLength(1);
      expect(seeds[0]).toBe(run.currentEncounter!.worldSeed);
    });

    it('builds an encounter snapshot with the current player team', () => {
      const { run, bus } = freshRunWithBus(1);
      const frontier = run.nodeMap.edges.find((e) => e.from === run.rootId)!.to;
      bus.emit('run:nodeEntered', { nodeId: frontier });
      expect(run.currentEncounter).not.toBeNull();
      expect(run.currentEncounter!.playerTeam).toEqual(run.team);
      expect(run.currentEncounter!.enemyTeam).toHaveLength(5);
    });

    it('ignores non-frontier nodes', () => {
      const { run, bus } = freshRunWithBus(1);
      const unreachable = farthestNodeId(run);
      bus.emit('run:nodeEntered', { nodeId: unreachable });
      expect(run.phase).toBe('map');
      expect(run.currentNodeId).toBe(run.rootId);
      expect(run.currentEncounter).toBeNull();
    });

    it('ignores events when not in map phase', () => {
      const { run, bus } = freshRunWithBus(1);
      const frontier = run.nodeMap.edges.find((e) => e.from === run.rootId)!.to;
      bus.emit('run:nodeEntered', { nodeId: frontier });
      // Now in battle phase. A second click should not retransition.
      const nextFrontier = run.nodeMap.edges.find((e) => e.from === frontier)?.to;
      if (nextFrontier === undefined) throw new Error('test setup: expected a 2nd hop');
      const encounterBefore = run.currentEncounter;
      bus.emit('run:nodeEntered', { nodeId: nextFrontier });
      expect(run.currentNodeId).toBe(frontier);
      expect(run.currentEncounter).toBe(encounterBefore);
    });
  });

  describe('handleBattleEnded', () => {
    it('player win → back to map phase at the new node', () => {
      const { run, bus } = freshRunWithBus(1);
      const frontier = run.nodeMap.edges.find((e) => e.from === run.rootId)!.to;
      bus.emit('run:nodeEntered', { nodeId: frontier });
      bus.emit('battle:ended', { winner: 'player' });
      expect(run.phase).toBe('map');
      expect(run.currentNodeId).toBe(frontier);
      expect(run.currentEncounter).toBeNull();
    });

    it('enemy win → defeat phase', () => {
      const { run, bus } = freshRunWithBus(1);
      const frontier = run.nodeMap.edges.find((e) => e.from === run.rootId)!.to;
      bus.emit('run:nodeEntered', { nodeId: frontier });
      bus.emit('battle:ended', { winner: 'enemy' });
      expect(run.phase).toBe('defeat');
    });

    it('ignores battle:ended when not in battle phase', () => {
      const { run, bus } = freshRunWithBus(1);
      bus.emit('battle:ended', { winner: 'player' });
      expect(run.phase).toBe('map');
    });
  });
});

interface RunHandle {
  run: Run & { rootId: number };
  bus: EventBus<GameEvents>;
}

function freshRunWithBus(seed: number): RunHandle {
  const bus = new EventBus<GameEvents>();
  const run = new Run(seed, bus);
  return { run: Object.assign(run, { rootId: run.nodeMap.rootId }), bus };
}

/** A node that's never a frontier of the root — useful for "not reachable" tests. */
function farthestNodeId(run: Run): number {
  return run.nodeMap.terminalId;
}
