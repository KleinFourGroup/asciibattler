import { describe, it, expect } from 'vitest';
import { Run } from './Run';
import { EventBus } from '../core/EventBus';
import { LAYOUT_IDS, THEMES, getLayout } from '../sim/layouts';
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
      a.run.dispatch({ kind: 'enterNode', nodeId: frontier });
      b.run.dispatch({ kind: 'enterNode', nodeId: frontier });
      expect(a.run.currentEncounter).toEqual(b.run.currentEncounter);
    });
  });

  describe('enterNode command', () => {
    it('transitions to battle phase on a frontier hop', () => {
      const { run } = freshRunWithBus(1);
      const frontier = run.nodeMap.edges.find((e) => e.from === run.rootId)!.to;
      run.dispatch({ kind: 'enterNode', nodeId: frontier });
      expect(run.phase).toBe('battle');
      expect(run.currentNodeId).toBe(frontier);
    });

    it('emits battle:started with the encounter worldSeed', () => {
      const { run, bus } = freshRunWithBus(1);
      const frontier = run.nodeMap.edges.find((e) => e.from === run.rootId)!.to;
      const seeds: number[] = [];
      bus.on('battle:started', ({ worldSeed }) => seeds.push(worldSeed));
      run.dispatch({ kind: 'enterNode', nodeId: frontier });
      expect(seeds).toHaveLength(1);
      expect(seeds[0]).toBe(run.currentEncounter!.worldSeed);
    });

    it('builds an encounter snapshot with the current player team', () => {
      const { run } = freshRunWithBus(1);
      const frontier = run.nodeMap.edges.find((e) => e.from === run.rootId)!.to;
      run.dispatch({ kind: 'enterNode', nodeId: frontier });
      expect(run.currentEncounter).not.toBeNull();
      expect(run.currentEncounter!.playerTeam).toEqual(run.team);
      // CHECKPOINT 6: enemy team is sized at playerTeam.length - 1.
      expect(run.currentEncounter!.enemyTeam).toHaveLength(run.team.length - 1);
    });

    it('E1: scales enemy constitution by 1 + 0.05 × destination floor', () => {
      // Pre-E1 the difficulty curve scaled maxHp directly. E1 made
      // maxHp a derived value, so the equivalent dial is constitution
      // (which feeds the derive function via `HP_PER_CONSTITUTION`).
      // E3 will replace this with `enemyLevelPerFloor` driving a full
      // `scaleStats` pass.
      const { run } = freshRunWithBus(1);
      const first = run.nodeMap.edges.find((e) => e.from === run.rootId)!.to;
      run.dispatch({ kind: 'enterNode', nodeId: first });
      const floor = run.nodeMap.nodes.find((n) => n.id === first)!.floor;
      const multiplier = 1 + 0.05 * floor;
      for (const u of run.currentEncounter!.enemyTeam) {
        const baseCon = u.archetype === 'melee' ? 20 : 12;
        expect(u.stats.constitution).toBe(Math.round(baseCon * multiplier));
      }
    });

    it('ignores non-frontier nodes', () => {
      const { run } = freshRunWithBus(1);
      const unreachable = farthestNodeId(run);
      run.dispatch({ kind: 'enterNode', nodeId: unreachable });
      expect(run.phase).toBe('map');
      expect(run.currentNodeId).toBe(run.rootId);
      expect(run.currentEncounter).toBeNull();
    });

    it('ignores enterNode when not in map phase', () => {
      const { run } = freshRunWithBus(1);
      const frontier = run.nodeMap.edges.find((e) => e.from === run.rootId)!.to;
      run.dispatch({ kind: 'enterNode', nodeId: frontier });
      // Now in battle phase. A second dispatch should not retransition.
      const nextFrontier = run.nodeMap.edges.find((e) => e.from === frontier)?.to;
      if (nextFrontier === undefined) throw new Error('test setup: expected a 2nd hop');
      const encounterBefore = run.currentEncounter;
      run.dispatch({ kind: 'enterNode', nodeId: nextFrontier });
      expect(run.currentNodeId).toBe(frontier);
      expect(run.currentEncounter).toBe(encounterBefore);
    });

    it('D8: encounter.theme is always a registered theme', () => {
      // Sample many seeds — procedural rolls land random theme, hand-
      // authored layouts pin to layout.theme. Both paths must produce
      // valid Theme values.
      for (let seed = 1; seed <= 60; seed++) {
        const { run } = freshRunWithBus(seed);
        const frontier = run.nodeMap.edges.find((e) => e.from === run.rootId)!.to;
        run.dispatch({ kind: 'enterNode', nodeId: frontier });
        expect(THEMES).toContain(run.currentEncounter!.theme);
      }
    });

    it('D8: hand-authored encounters use the layout-declared theme', () => {
      // For every seed that lands on a layout (rather than procedural),
      // run.currentEncounter.theme must equal the layout's declared theme
      // — the rolled procedural theme is discarded on the layout branch.
      let layoutHits = 0;
      for (let seed = 1; seed <= 60; seed++) {
        const { run } = freshRunWithBus(seed);
        const frontier = run.nodeMap.edges.find((e) => e.from === run.rootId)!.to;
        run.dispatch({ kind: 'enterNode', nodeId: frontier });
        const enc = run.currentEncounter!;
        if (enc.layoutId === null) continue;
        layoutHits++;
        expect(enc.theme).toBe(getLayout(enc.layoutId)!.theme);
      }
      // Sanity — we hit the layout branch at least sometimes (~75% of 60).
      expect(layoutHits).toBeGreaterThan(0);
    });

    it('D8: procedural encounters cover all themes across enough seeds', () => {
      // Across a wide sample, every theme in THEMES should fire on the
      // procedural branch at least once — confirms `rollTheme` is uniform
      // and the picker pool plumbs through cleanly.
      const seen = new Set<string>();
      for (let seed = 1; seed <= 400; seed++) {
        const { run } = freshRunWithBus(seed);
        const frontier = run.nodeMap.edges.find((e) => e.from === run.rootId)!.to;
        run.dispatch({ kind: 'enterNode', nodeId: frontier });
        const enc = run.currentEncounter!;
        if (enc.layoutId === null) seen.add(enc.theme);
      }
      for (const t of THEMES) {
        expect(seen.has(t)).toBe(true);
      }
    });

    it('encounter layoutId is null OR a registered library id (C1d 25/75 mix)', () => {
      // Sample many seeds to confirm both branches of the 25/75 roll are
      // reachable AND that the picked ids always come from LAYOUT_IDS.
      let proceduralCount = 0;
      const layoutCounts = new Map<string, number>();
      for (let seed = 1; seed <= 200; seed++) {
        const { run } = freshRunWithBus(seed);
        const frontier = run.nodeMap.edges.find((e) => e.from === run.rootId)!.to;
        run.dispatch({ kind: 'enterNode', nodeId: frontier });
        const id = run.currentEncounter!.layoutId;
        if (id === null) {
          proceduralCount++;
        } else {
          expect(LAYOUT_IDS).toContain(id);
          layoutCounts.set(id, (layoutCounts.get(id) ?? 0) + 1);
        }
      }
      // Both branches must fire across 200 seeds, and every layout in the
      // library must be picked at least once (uniform draw, large N).
      expect(proceduralCount).toBeGreaterThan(0);
      expect(layoutCounts.size).toBe(LAYOUT_IDS.length);
      for (const id of LAYOUT_IDS) {
        expect(layoutCounts.get(id) ?? 0).toBeGreaterThan(0);
      }
      // Rough sanity on the split — leave wide tolerance so we don't fight
      // the PRNG. Expected ~50 procedural out of 200 (binomial p=0.25,
      // sd ≈ 6.1); ±25 window is well beyond ±3σ either way. The point is
      // to catch outright bias, not to assert exact uniformity.
      expect(proceduralCount).toBeGreaterThan(25);
      expect(proceduralCount).toBeLessThan(75);
    });
  });

  describe('handleBattleEnded', () => {
    it('player win → recruit phase with an offer', () => {
      const { run, bus } = freshRunWithBus(1);
      const frontier = run.nodeMap.edges.find((e) => e.from === run.rootId)!.to;
      run.dispatch({ kind: 'enterNode', nodeId: frontier });
      bus.emit('battle:ended', { winner: 'player' });
      expect(run.phase).toBe('recruit');
      expect(run.currentEncounter).toBeNull();
      expect(run.currentOffer).not.toBeNull();
      expect(run.currentOffer).toHaveLength(3);
    });

    it('emits recruit:offered with the rolled units on victory', () => {
      const { run, bus } = freshRunWithBus(1);
      const frontier = run.nodeMap.edges.find((e) => e.from === run.rootId)!.to;
      run.dispatch({ kind: 'enterNode', nodeId: frontier });
      const offers: number[] = [];
      bus.on('recruit:offered', ({ units }) => offers.push(units.length));
      bus.emit('battle:ended', { winner: 'player' });
      expect(offers).toEqual([3]);
      expect(run.currentOffer).toHaveLength(3);
    });

    it('enemy win → defeat phase (no recruit)', () => {
      const { run, bus } = freshRunWithBus(1);
      const frontier = run.nodeMap.edges.find((e) => e.from === run.rootId)!.to;
      run.dispatch({ kind: 'enterNode', nodeId: frontier });
      bus.emit('battle:ended', { winner: 'enemy' });
      expect(run.phase).toBe('defeat');
      expect(run.currentOffer).toBeNull();
    });

    it('emits run:defeated on enemy win', () => {
      const { run, bus } = freshRunWithBus(1);
      const frontier = run.nodeMap.edges.find((e) => e.from === run.rootId)!.to;
      run.dispatch({ kind: 'enterNode', nodeId: frontier });
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

    it('winning at the terminal node routes to complete (not recruit)', () => {
      const { run, bus } = freshRunWithBus(1);
      // Force currentNodeId to the terminal so the next battle's win is the
      // final one. Manual state surgery is acceptable for this targeted
      // test — driving a full run is the browser-verify path.
      run.currentNodeId = run.nodeMap.terminalId;
      run.phase = 'battle';
      let victoryCount = 0;
      let offeredCount = 0;
      bus.on('run:victory', () => victoryCount++);
      bus.on('recruit:offered', () => offeredCount++);
      bus.emit('battle:ended', { winner: 'player' });
      expect(run.phase).toBe('complete');
      expect(victoryCount).toBe(1);
      expect(offeredCount).toBe(0);
      expect(run.currentOffer).toBeNull();
    });
  });

  describe('chooseRecruit command', () => {
    it('adds the chosen unit to the team and returns to map phase', () => {
      const { run, bus } = freshRunWithBus(1);
      driveToRecruitPhase(run, bus);
      const teamSizeBefore = run.team.length;
      const pick = run.currentOffer![0]!;
      run.dispatch({ kind: 'chooseRecruit', unitTemplate: pick });
      expect(run.phase).toBe('map');
      expect(run.team).toHaveLength(teamSizeBefore + 1);
      expect(run.team[run.team.length - 1]).toEqual(pick);
      expect(run.currentOffer).toBeNull();
    });

    it('ignores chooseRecruit outside of recruit phase', () => {
      const { run } = freshRunWithBus(1);
      const sizeBefore = run.team.length;
      // Run starts in map phase — dispatching here is a no-op.
      run.dispatch({ kind: 'chooseRecruit', unitTemplate: run.team[0]! });
      expect(run.team).toHaveLength(sizeBefore);
    });
  });

  describe('resetRun command at Run level', () => {
    it('is a silent no-op (Game intercepts reset, not Run)', () => {
      const { run } = freshRunWithBus(1);
      const phaseBefore = run.phase;
      const nodeBefore = run.currentNodeId;
      run.dispatch({ kind: 'resetRun' });
      expect(run.phase).toBe(phaseBefore);
      expect(run.currentNodeId).toBe(nodeBefore);
    });
  });

  describe('dispose', () => {
    it('detaches the battle:ended subscription so a disposed Run ignores future battles', () => {
      const { run, bus } = freshRunWithBus(1);
      const frontier = run.nodeMap.edges.find((e) => e.from === run.rootId)!.to;
      run.dispatch({ kind: 'enterNode', nodeId: frontier });
      expect(run.phase).toBe('battle');
      run.dispose();
      bus.emit('battle:ended', { winner: 'player' });
      // A live Run would advance to recruit phase here; the disposed one stays.
      expect(run.phase).toBe('battle');
    });

    it('two Runs sharing a bus do not double-handle once the old one is disposed', () => {
      const bus = new EventBus<GameEvents>();
      const oldRun = new Run(1, bus);
      const oldFrontier = oldRun.nodeMap.edges.find((e) => e.from === oldRun.nodeMap.rootId)!.to;
      oldRun.dispatch({ kind: 'enterNode', nodeId: oldFrontier });
      // Both runs are now in battle phase (well, oldRun is). Dispose it.
      oldRun.dispose();

      const newRun = new Run(2, bus);
      const newFrontier = newRun.nodeMap.edges.find(
        (e) => e.from === newRun.nodeMap.rootId,
      )!.to;
      newRun.dispatch({ kind: 'enterNode', nodeId: newFrontier });
      expect(newRun.phase).toBe('battle');

      // Now end the new run's battle. The old Run is disposed, so its
      // battle:ended handler is gone — only newRun reacts.
      bus.emit('battle:ended', { winner: 'player' });
      expect(newRun.phase).toBe('recruit');
      expect(oldRun.phase).toBe('battle'); // unchanged
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
      run.dispatch({ kind: 'enterNode', nodeId: first });
      // After leaving root → first, root is NOT visited (it's the start).
      expect(run.visitedNodes.has(run.rootId)).toBe(false);
      expect(run.visitedNodes.has(first)).toBe(false);

      // Now complete the battle, pick a recruit, and hop to the next node.
      bus.emit('battle:ended', { winner: 'player' });
      run.dispatch({ kind: 'chooseRecruit', unitTemplate: run.currentOffer![0]! });
      const second = run.nodeMap.edges.find((e) => e.from === first)!.to;
      run.dispatch({ kind: 'enterNode', nodeId: second });
      expect(run.visitedNodes.has(first)).toBe(true);
    });
  });

  describe('round-trip serialization', () => {
    it('toJSON → fromJSON preserves phase, position, team, and visited set', () => {
      const { run, bus } = freshRunWithBus(7);
      const first = run.nodeMap.edges.find((e) => e.from === run.rootId)!.to;
      run.dispatch({ kind: 'enterNode', nodeId: first });
      bus.emit('battle:ended', { winner: 'player' });
      run.dispatch({ kind: 'chooseRecruit', unitTemplate: run.currentOffer![0]! });

      const snap = run.toJSON();
      const restored = Run.fromJSON(snap, new EventBus<GameEvents>());
      expect(restored.phase).toBe(run.phase);
      expect(restored.currentNodeId).toBe(run.currentNodeId);
      expect(restored.team).toEqual(run.team);
      expect(Array.from(restored.visitedNodes)).toEqual(Array.from(run.visitedNodes));
      expect(restored.currentOffer).toBeNull();
      expect(restored.nodeMap).toEqual(run.nodeMap);
    });

    it('a restored Run produces the same next encounter as the original', () => {
      // Walk one Run to mid-map, snapshot, restore on a fresh bus, then
      // make the same enterNode call on both — they should agree on the
      // resulting encounter.
      const { run, bus } = freshRunWithBus(7);
      const first = run.nodeMap.edges.find((e) => e.from === run.rootId)!.to;
      run.dispatch({ kind: 'enterNode', nodeId: first });
      bus.emit('battle:ended', { winner: 'player' });
      run.dispatch({ kind: 'chooseRecruit', unitTemplate: run.currentOffer![0]! });

      const restored = Run.fromJSON(run.toJSON(), new EventBus<GameEvents>());
      const second = run.nodeMap.edges.find((e) => e.from === first)!.to;
      run.dispatch({ kind: 'enterNode', nodeId: second });
      restored.dispatch({ kind: 'enterNode', nodeId: second });
      expect(restored.currentEncounter).toEqual(run.currentEncounter);
    });
  });
});

function driveToRecruitPhase(run: Run, bus: EventBus<GameEvents>): void {
  const frontier = run.nodeMap.edges.find((e) => e.from === run.nodeMap.rootId)!.to;
  run.dispatch({ kind: 'enterNode', nodeId: frontier });
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
