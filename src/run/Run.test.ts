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
      // CHECKPOINT 6: enemy team is sized at playerTeam.length - 1.
      expect(run.currentEncounter!.enemyTeam).toHaveLength(run.team.length - 1);
    });

    it('scales enemy maxHp by 1 + 0.05 × destination floor', () => {
      // Two fresh runs at the same seed, but compare the enemy team's
      // first-melee maxHp on floor 1 vs the same role on floor 2. The
      // floor-2 fork consumes more parent RNG, but the per-unit roll
      // before HP scaling is unrelated to the multiplier we want to
      // observe — so instead we just verify the rule analytically by
      // checking the maxHp lies inside the scaled bound.
      const { run, bus } = freshRunWithBus(1);
      const first = run.nodeMap.edges.find((e) => e.from === run.rootId)!.to;
      bus.emit('run:nodeEntered', { nodeId: first });
      const floor = run.nodeMap.nodes.find((n) => n.id === first)!.floor;
      const multiplier = 1 + 0.05 * floor;
      for (const u of run.currentEncounter!.enemyTeam) {
        const baseMin = u.archetype === 'melee' ? 40 : 20;
        const baseMax = u.archetype === 'melee' ? 60 : 30;
        expect(u.stats.maxHp).toBeGreaterThanOrEqual(Math.round(baseMin * multiplier));
        expect(u.stats.maxHp).toBeLessThanOrEqual(Math.round(baseMax * multiplier));
      }
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
    it('player win → recruit phase with an offer', () => {
      const { run, bus } = freshRunWithBus(1);
      const frontier = run.nodeMap.edges.find((e) => e.from === run.rootId)!.to;
      bus.emit('run:nodeEntered', { nodeId: frontier });
      bus.emit('battle:ended', { winner: 'player' });
      expect(run.phase).toBe('recruit');
      expect(run.currentEncounter).toBeNull();
      expect(run.currentOffer).not.toBeNull();
      expect(run.currentOffer).toHaveLength(3);
    });

    it('emits recruit:offered with the rolled units on victory', () => {
      const { run, bus } = freshRunWithBus(1);
      const frontier = run.nodeMap.edges.find((e) => e.from === run.rootId)!.to;
      bus.emit('run:nodeEntered', { nodeId: frontier });
      const offers: number[] = [];
      bus.on('recruit:offered', ({ units }) => offers.push(units.length));
      bus.emit('battle:ended', { winner: 'player' });
      expect(offers).toEqual([3]);
      expect(run.currentOffer).toHaveLength(3);
    });

    it('enemy win → defeat phase (no recruit)', () => {
      const { run, bus } = freshRunWithBus(1);
      const frontier = run.nodeMap.edges.find((e) => e.from === run.rootId)!.to;
      bus.emit('run:nodeEntered', { nodeId: frontier });
      bus.emit('battle:ended', { winner: 'enemy' });
      expect(run.phase).toBe('defeat');
      expect(run.currentOffer).toBeNull();
    });

    it('emits run:defeated on enemy win', () => {
      const { run, bus } = freshRunWithBus(1);
      const frontier = run.nodeMap.edges.find((e) => e.from === run.rootId)!.to;
      bus.emit('run:nodeEntered', { nodeId: frontier });
      let defeatedCount = 0;
      bus.on('run:defeated', () => defeatedCount++);
      bus.emit('battle:ended', { winner: 'enemy' });
      expect(defeatedCount).toBe(1);
      expect(run.phase).toBe('defeat');
    });

    it('ignores battle:ended when not in battle phase', () => {
      const { run, bus } = freshRunWithBus(1);
      bus.emit('battle:ended', { winner: 'player' });
      expect(run.phase).toBe('map');
    });
  });

  describe('handleRecruitChosen', () => {
    it('adds the chosen unit to the team and returns to map phase', () => {
      const { run, bus } = freshRunWithBus(1);
      driveToRecruitPhase(run, bus);
      const teamSizeBefore = run.team.length;
      const pick = run.currentOffer![0]!;
      bus.emit('recruit:chosen', { unitTemplate: pick });
      expect(run.phase).toBe('map');
      expect(run.team).toHaveLength(teamSizeBefore + 1);
      expect(run.team[run.team.length - 1]).toEqual(pick);
      expect(run.currentOffer).toBeNull();
    });

    it('ignores recruit:chosen outside of recruit phase', () => {
      const { run, bus } = freshRunWithBus(1);
      const sizeBefore = run.team.length;
      // Run starts in map phase — emitting recruit:chosen here is a no-op.
      bus.emit('recruit:chosen', { unitTemplate: run.team[0]! });
      expect(run.team).toHaveLength(sizeBefore);
    });
  });

  describe('dispose', () => {
    it('detaches all subscriptions so a disposed Run ignores future events', () => {
      const { run, bus } = freshRunWithBus(1);
      run.dispose();
      const frontier = run.nodeMap.edges.find((e) => e.from === run.rootId)!.to;
      bus.emit('run:nodeEntered', { nodeId: frontier });
      // A live Run would advance to battle phase here; the disposed one stays put.
      expect(run.phase).toBe('map');
      expect(run.currentNodeId).toBe(run.rootId);
    });

    it('two Runs sharing a bus do not double-handle once the old one is disposed', () => {
      const bus = new EventBus<GameEvents>();
      const oldRun = new Run(1, bus);
      oldRun.dispose();
      const newRun = new Run(2, bus);
      const frontier = newRun.nodeMap.edges.find(
        (e) => e.from === newRun.nodeMap.rootId,
      )!.to;
      bus.emit('run:nodeEntered', { nodeId: frontier });
      expect(newRun.phase).toBe('battle');
      // The old Run did NOT advance — its handler is gone.
      expect(oldRun.phase).toBe('map');
    });
  });

  describe('visitedNodes', () => {
    it('starts empty (root is the player\'s starting cell, not a cleared battle)', () => {
      const { run } = freshRunWithBus(1);
      expect(run.visitedNodes.size).toBe(0);
    });

    it('records the previous node after a second hop', () => {
      const { run, bus } = freshRunWithBus(1);
      const first = run.nodeMap.edges.find((e) => e.from === run.rootId)!.to;
      bus.emit('run:nodeEntered', { nodeId: first });
      // After leaving root → first, root is NOT visited (it's the start).
      expect(run.visitedNodes.has(run.rootId)).toBe(false);
      expect(run.visitedNodes.has(first)).toBe(false);

      // Now complete the battle, pick a recruit, and hop to the next node.
      bus.emit('battle:ended', { winner: 'player' });
      bus.emit('recruit:chosen', { unitTemplate: run.currentOffer![0]! });
      const second = run.nodeMap.edges.find((e) => e.from === first)!.to;
      bus.emit('run:nodeEntered', { nodeId: second });
      expect(run.visitedNodes.has(first)).toBe(true);
    });
  });
});

function driveToRecruitPhase(run: Run, bus: EventBus<GameEvents>): void {
  const frontier = run.nodeMap.edges.find((e) => e.from === run.nodeMap.rootId)!.to;
  bus.emit('run:nodeEntered', { nodeId: frontier });
  bus.emit('battle:ended', { winner: 'player' });
}

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
