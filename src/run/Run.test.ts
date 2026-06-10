import { describe, it, expect, afterEach } from 'vitest';
import { Run } from './Run';
import { fatigueEffect, FATIGUE_KEY } from './fatigue';
import { foldEffects, type StatusEffect } from '../sim/statusEffects';
import { EventBus } from '../core/EventBus';
import { LAYOUT_IDS, THEMES, getLayout } from '../sim/layouts';
import type { GameEvents } from '../core/events';
import { ARCHETYPE_CONFIG } from '../sim/archetypes';
import { scaleStats } from '../sim/leveling';
import { xpToNext } from '../sim/xp';
import { LEVELING } from '../config/leveling';
import { DIFFICULTY } from '../config/difficulty';
import { RECRUITMENT } from '../config/recruitment';
import { HEALTH } from '../config/health';
import { DECK } from '../config/deck';
import { avgTeamLevel, enemyBudgetFor } from './enemyBudget';
import type { RunConfig } from './RunConfig';

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
      const melee = run.team.filter((t) => t.archetype === 'mercenary');
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

    it('builds an encounter snapshot whose hand is drawn from the roster (H5)', () => {
      const { run } = freshRunWithBus(1);
      const frontier = run.nodeMap.edges.find((e) => e.from === run.rootId)!.to;
      run.dispatch({ kind: 'enterNode', nodeId: frontier });
      expect(run.currentEncounter).not.toBeNull();
      const hand = run.currentEncounter!.playerTeam;
      // Starting roster (5) == handSize → the hand is the whole roster, but the
      // draw order is SHUFFLED, so compare as a set keyed by rosterIndex rather
      // than position. (The cap/subset case is covered in the deck suite below.)
      const handSize = Math.min(run.team.length, DECK.handSize);
      expect(hand).toHaveLength(handSize);
      const indices = hand.map((t) => t.rosterIndex!);
      expect(new Set(indices).size).toBe(handSize); // no duplicate cards
      // E4: each drawn card carries the stats/level of its roster slot, stamped
      // with that slot's index (never mutating run.team).
      for (const t of hand) {
        const { rosterIndex, ...rest } = t;
        expect(rest).toEqual(run.team[rosterIndex!]);
      }
      // G4: enemy team is a budget-distributed swarm of up to
      // `swarmMaxMultiplier × playerSize` units (no longer a fixed size).
      const maxCount = Math.round(DIFFICULTY.swarmMaxMultiplier * run.team.length);
      expect(run.currentEncounter!.enemyTeam.length).toBeGreaterThanOrEqual(1);
      expect(run.currentEncounter!.enemyTeam.length).toBeLessThanOrEqual(maxCount);
    });

    it('G4: enemy levels stay within cap; stats built via the deterministic scaleStats path', () => {
      // The floor-linear ramp is gone — enemies now share a level budget
      // derived from the player roster. The integration assertion here is
      // that every enemy is ≤ the per-unit cap and its stats come from the
      // canonical `scaleStats` build (the budget math itself is unit-tested
      // in enemyBudget.test.ts). Cap + stats derive from live config.
      const { run } = freshRunWithBus(1);
      const first = run.nodeMap.edges.find((e) => e.from === run.rootId)!.to;
      run.dispatch({ kind: 'enterNode', nodeId: first });
      const highest = Math.max(1, ...run.team.map((t) => t.level));
      const cap = highest + DIFFICULTY.unitLevelDelta;
      for (const u of run.currentEncounter!.enemyTeam) {
        expect(u.level).toBeGreaterThanOrEqual(1);
        expect(u.level).toBeLessThanOrEqual(cap);
        const cfg = ARCHETYPE_CONFIG[u.archetype];
        expect(u.stats).toEqual(scaleStats(cfg.baseStats, cfg.growthRates, u.level - 1));
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
      winEncounter(bus);
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
      winEncounter(bus);
      expect(offers).toEqual([3]);
      expect(run.currentOffer).toHaveLength(3);
    });

    it('enemy win → defeat phase (no recruit)', () => {
      const { run, bus } = freshRunWithBus(1);
      const frontier = run.nodeMap.edges.find((e) => e.from === run.rootId)!.to;
      run.dispatch({ kind: 'enterNode', nodeId: frontier });
      loseEncounter(bus);
      expect(run.phase).toBe('defeat');
      expect(run.currentOffer).toBeNull();
    });

    it('emits run:defeated on enemy win', () => {
      const { run, bus } = freshRunWithBus(1);
      const frontier = run.nodeMap.edges.find((e) => e.from === run.rootId)!.to;
      run.dispatch({ kind: 'enterNode', nodeId: frontier });
      let defeatedCount = 0;
      bus.on('run:defeated', () => defeatedCount++);
      loseEncounter(bus);
      expect(defeatedCount).toBe(1);
      expect(run.phase).toBe('defeat');
    });

    it('ignores battle:ended when not in battle phase', () => {
      const { run, bus } = freshRunWithBus(1);
      winEncounter(bus);
      expect(run.phase).toBe('map');
    });

    it('G4: recruit level tracks round(avgTeamLevel) + bonus, not the floor', () => {
      // A leveled starting roster (avg 6) lands at floor 1. Under the old
      // `currentFloor` basis the offer would be level 1; G4 keys it off the
      // team average, so offered cards are ≥ round(avg) (= 6). Empty xpAwards
      // keep the roster levels fixed so the average is exactly the config.
      const bus = new EventBus<GameEvents>();
      const run = new Run(1, bus, {
        startingRoster: [
          { archetype: 'mercenary', level: 6 },
          { archetype: 'mercenary', level: 6 },
          { archetype: 'ranged', level: 6 },
        ],
      });
      const frontier = run.nodeMap.edges.find((e) => e.from === run.nodeMap.rootId)!.to;
      run.dispatch({ kind: 'enterNode', nodeId: frontier });
      winEncounter(bus);

      const offer = run.currentOffer!;
      expect(offer).not.toBeNull();
      const avg = Math.round(avgTeamLevel(run.team)); // 6 — well above floor 1
      for (const u of offer) {
        expect(u.level).toBeGreaterThanOrEqual(avg); // base, before any per-card bonus
        expect(u.level).toBeLessThanOrEqual(LEVELING.levelCap);
      }
      // Post-G5: the geometric bonus is drawn per card (over the shared `avg`
      // base), so cards MAY differ — there is no "all share one level"
      // invariant anymore. Per-card independence is pinned in Recruitment.test.
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
      winEncounter(bus);
      expect(run.phase).toBe('complete');
      expect(victoryCount).toBe(1);
      expect(offeredCount).toBe(0);
      expect(run.currentOffer).toBeNull();
    });
  });

  describe('E4 — XP banking + level-up loop', () => {
    it('starting roster begins at xp=0 and the configured startingLevel', () => {
      const { run } = freshRunWithBus(1);
      for (const t of run.team) {
        expect(t.xp).toBe(0);
        expect(t.level).toBe(RECRUITMENT.startingLevel);
      }
    });

    it('banks xpGained into the right roster slot via rosterIndex', () => {
      const { run, bus } = freshLvl1RunWithBus(1);
      const frontier = run.nodeMap.edges.find((e) => e.from === run.rootId)!.to;
      run.dispatch({ kind: 'enterNode', nodeId: frontier });
      // Award 5 XP to roster index 2 (a melee unit); it shouldn't be
      // enough to level (xpToNext(1) = LEVELING.baseXp, far more than 5
      // at any sane curve), so the only observable effect is xp bumping.
      winEncounter(bus, [{ unitId: 99, rosterIndex: 2, damageDealt: 5, xpGained: 5 }]);
      expect(run.team[2]!.xp).toBe(5);
      expect(run.team[2]!.level).toBe(1);
      // Other slots untouched.
      expect(run.team[0]!.xp).toBe(0);
      expect(run.team[4]!.xp).toBe(0);
    });

    it('triggers a level-up when banked xp crosses xpToNext(level)', () => {
      const { run, bus } = freshLvl1RunWithBus(7);
      const frontier = run.nodeMap.edges.find((e) => e.from === run.rootId)!.to;
      run.dispatch({ kind: 'enterNode', nodeId: frontier });
      // Award exactly the level-1→2 threshold from the curve so the test
      // stays pinned regardless of `baseXp` / `exponent` tuning.
      winEncounter(bus, [{ unitId: 1, rosterIndex: 0, damageDealt: 0, xpGained: xpToNext(1) }]);
      expect(run.team[0]!.level).toBe(2);
      expect(run.team[0]!.xp).toBe(0);
    });

    it('cascades multiple level-ups in one award if banked xp covers them', () => {
      const { run, bus } = freshLvl1RunWithBus(11);
      const frontier = run.nodeMap.edges.find((e) => e.from === run.rootId)!.to;
      run.dispatch({ kind: 'enterNode', nodeId: frontier });
      // Compute the exact threshold from the curve so the test stays
      // pinned regardless of `baseXp` / `exponent` tuning.
      const cost1To2 = xpToNext(1);
      const cost2To3 = xpToNext(2);
      const award = cost1To2 + cost2To3 + 5; // 5 XP leftover after cascading
      winEncounter(bus, [{ unitId: 1, rosterIndex: 0, damageDealt: 0, xpGained: award }]);
      expect(run.team[0]!.level).toBe(3);
      expect(run.team[0]!.xp).toBe(5);
    });

    it('drains banked xp at the level cap (no infinite-grind overflow)', () => {
      const { run, bus } = freshRunWithBus(99);
      const frontier = run.nodeMap.edges.find((e) => e.from === run.rootId)!.to;
      run.dispatch({ kind: 'enterNode', nodeId: frontier });
      // Surgically promote slot 0 to one short of cap with massive
      // pending XP — checks the cap-drain branch, not the curve.
      run.team[0] = { ...run.team[0]!, level: 19, xp: 0 };
      winEncounter(bus, [{ unitId: 1, rosterIndex: 0, damageDealt: 0, xpGained: 999_999 }]);
      expect(run.team[0]!.level).toBe(20); // cap
      expect(run.team[0]!.xp).toBe(0);
    });

    it('skips awards whose rosterIndex is null (test-fixture safety net)', () => {
      const { run, bus } = freshRunWithBus(2);
      const frontier = run.nodeMap.edges.find((e) => e.from === run.rootId)!.to;
      run.dispatch({ kind: 'enterNode', nodeId: frontier });
      const xpBefore = run.team.map((t) => t.xp);
      winEncounter(bus, [{ unitId: 1, rosterIndex: null, damageDealt: 50, xpGained: 60 }]);
      expect(run.team.map((t) => t.xp)).toEqual(xpBefore);
    });

    it('banks damage XP for a fallen unit (rosterIndex set even though unit died)', () => {
      // E4 follow-up: roster persists across battles, so a unit that
      // died in this battle still gets damage credit on its roster
      // slot. The xpFlatPerFallen slice is the participation reward;
      // the per-damage share is paid regardless.
      const { run, bus } = freshRunWithBus(4);
      const frontier = run.nodeMap.edges.find((e) => e.from === run.rootId)!.to;
      run.dispatch({ kind: 'enterNode', nodeId: frontier });
      winEncounter(bus, [
        // Slot 0 fell but still earned XP. `xpGained` here is an arbitrary
        // World-supplied figure — this test only pins that Run banks whatever
        // World sent onto the right roster slot, even for a unit that died.
        // The fallen-XP *formula* itself (xpFlatPerFallen + xpPerDamage ×
        // damage) is pinned, derived from config, in xp.test.ts.
        { unitId: 9, rosterIndex: 0, damageDealt: 30, xpGained: 91 },
      ]);
      expect(run.team[0]!.xp).toBe(91);
    });

    it('does not mutate the roster when the run is lost', () => {
      const { run, bus } = freshLvl1RunWithBus(3);
      const frontier = run.nodeMap.edges.find((e) => e.from === run.rootId)!.to;
      run.dispatch({ kind: 'enterNode', nodeId: frontier });
      // H4: a losing turn ends the run (player pool emptied) before any pending
      // XP is banked. (Whether non-empty awards on a losing turn are discarded
      // is pinned separately in the encounter-loop suite.)
      loseEncounter(bus);
      expect(run.phase).toBe('defeat');
      expect(run.team.every((t) => t.xp === 0 && t.level === 1)).toBe(true);
    });
  });

  describe('E4 — promotion phase', () => {
    it('skips promotion when no unit leveled (sub-threshold awards)', () => {
      const { run, bus } = freshRunWithBus(1);
      const frontier = run.nodeMap.edges.find((e) => e.from === run.rootId)!.to;
      run.dispatch({ kind: 'enterNode', nodeId: frontier });
      const promotions: number[] = [];
      bus.on('promotion:pending', ({ promotions: p }) => promotions.push(p.length));
      winEncounter(bus, [{ unitId: 1, rosterIndex: 0, damageDealt: 0, xpGained: 5 }]);
      expect(promotions).toEqual([]);
      // Flow lands directly in recruit phase.
      expect(run.phase).toBe('recruit');
      expect(run.currentOffer).not.toBeNull();
    });

    it('enters promotion phase + emits promotion:pending when a unit levels', () => {
      const { run, bus } = freshLvl1RunWithBus(1);
      const frontier = run.nodeMap.edges.find((e) => e.from === run.rootId)!.to;
      run.dispatch({ kind: 'enterNode', nodeId: frontier });
      const promotions: number[][] = [];
      const offers: number[] = [];
      bus.on('promotion:pending', ({ promotions: p }) =>
        promotions.push(p.map((x) => x.rosterIndex)),
      );
      bus.on('recruit:offered', ({ units }) => offers.push(units.length));
      winEncounter(bus, [{ unitId: 1, rosterIndex: 0, damageDealt: 0, xpGained: 100 }]);
      expect(run.phase).toBe('promotion');
      expect(run.pendingPromotions).not.toBeNull();
      expect(run.pendingPromotions).toHaveLength(1);
      expect(run.pendingPromotions![0]!.rosterIndex).toBe(0);
      expect(run.pendingPromotions![0]!.oldLevel).toBe(1);
      expect(run.pendingPromotions![0]!.newLevel).toBe(2);
      expect(promotions).toEqual([[0]]);
      // Recruit offer is deferred — the player hasn't dismissed the
      // promotion screen yet.
      expect(offers).toEqual([]);
      expect(run.currentOffer).toBeNull();
    });

    it('dismissPromotion routes to recruit phase + emits recruit:offered', () => {
      const { run, bus } = freshLvl1RunWithBus(2);
      const frontier = run.nodeMap.edges.find((e) => e.from === run.rootId)!.to;
      run.dispatch({ kind: 'enterNode', nodeId: frontier });
      const offers: number[] = [];
      bus.on('recruit:offered', ({ units }) => offers.push(units.length));
      winEncounter(bus, [{ unitId: 1, rosterIndex: 0, damageDealt: 0, xpGained: 100 }]);
      expect(run.phase).toBe('promotion');
      run.dispatch({ kind: 'dismissPromotion' });
      expect(run.phase).toBe('recruit');
      expect(run.pendingPromotions).toBeNull();
      expect(offers).toEqual([3]);
      expect(run.currentOffer).toHaveLength(3);
    });

    it('dismissPromotion at the terminal node routes to complete (not recruit)', () => {
      const { run, bus } = freshLvl1RunWithBus(1);
      run.currentNodeId = run.nodeMap.terminalId;
      run.phase = 'battle';
      let victoryCount = 0;
      let offerCount = 0;
      bus.on('run:victory', () => victoryCount++);
      bus.on('recruit:offered', () => offerCount++);
      winEncounter(bus, [{ unitId: 1, rosterIndex: 0, damageDealt: 0, xpGained: 100 }]);
      expect(run.phase).toBe('promotion');
      run.dispatch({ kind: 'dismissPromotion' });
      expect(run.phase).toBe('complete');
      expect(victoryCount).toBe(1);
      expect(offerCount).toBe(0);
    });

    it('dismissPromotion is a no-op outside of promotion phase', () => {
      const { run } = freshRunWithBus(1);
      const phaseBefore = run.phase;
      run.dispatch({ kind: 'dismissPromotion' });
      expect(run.phase).toBe(phaseBefore);
    });

    it('round-trips pendingPromotions through snapshot', () => {
      const { run, bus } = freshLvl1RunWithBus(1);
      const frontier = run.nodeMap.edges.find((e) => e.from === run.rootId)!.to;
      run.dispatch({ kind: 'enterNode', nodeId: frontier });
      winEncounter(bus, [{ unitId: 1, rosterIndex: 0, damageDealt: 0, xpGained: 100 }]);
      const restored = Run.fromJSON(run.toJSON(), new EventBus<GameEvents>());
      expect(restored.phase).toBe('promotion');
      expect(restored.pendingPromotions).toEqual(run.pendingPromotions);
    });
  });

  describe('encounter loop (H4)', () => {
    it('starts with a full run-wide player pool and no active encounter', () => {
      const run = new Run(1, new EventBus<GameEvents>());
      expect(run.playerHealth).toBe(HEALTH.playerHealthMax);
      expect(run.enemyHealth).toBe(0);
      expect(run.turnIndex).toBe(0);
    });

    it('beginEncounter fills the enemy pool + fixes the budget; playerHealth untouched', () => {
      const { run } = freshRunWithBus(1);
      const frontier = run.nodeMap.edges.find((e) => e.from === run.rootId)!.to;
      run.dispatch({ kind: 'enterNode', nodeId: frontier });
      expect(run.enemyHealth).toBe(HEALTH.enemyHealthMax);
      expect(run.turnIndex).toBe(0); // no turn resolved yet
      expect(run.encounterBudget).toBe(enemyBudgetFor(run.team));
      expect(run.playerHealth).toBe(HEALTH.playerHealthMax);
    });

    it('a sub-lethal chip continues the encounter; a lethal chip wins it', () => {
      const { run, bus } = freshRunWithBus(1);
      const starts: number[] = [];
      bus.on('battle:started', ({ worldSeed }) => starts.push(worldSeed));
      const frontier = run.nodeMap.edges.find((e) => e.from === run.rootId)!.to;
      run.dispatch({ kind: 'enterNode', nodeId: frontier });
      expect(starts).toHaveLength(1); // turn 1 spun up

      // A 1-power chip can't empty the pool (max >= 2) → another turn starts.
      chipTurn(bus, { player: 1, enemy: 0 });
      expect(run.phase).toBe('battle');
      expect(run.enemyHealth).toBe(HEALTH.enemyHealthMax - 1);
      expect(run.turnIndex).toBe(1);
      expect(starts).toHaveLength(2); // turn 2 spun up

      // A chip >= the remaining pool empties it → encounter won → recruit.
      chipTurn(bus, { player: HEALTH.enemyHealthMax, enemy: 0 });
      expect(run.enemyHealth).toBe(0);
      expect(run.phase).toBe('recruit');
      expect(run.turnIndex).toBe(2);
      expect(starts).toHaveLength(2); // no turn 3
    });

    it('the player pool persists across encounters; the enemy pool resets', () => {
      const { run, bus } = freshRunWithBus(1);
      const first = run.nodeMap.edges.find((e) => e.from === run.rootId)!.to;
      run.dispatch({ kind: 'enterNode', nodeId: first });
      // Take 5 to the player pool on a sub-lethal enemy chip (encounter continues).
      chipTurn(bus, { player: 0, enemy: 5 });
      expect(run.phase).toBe('battle');
      expect(run.playerHealth).toBe(HEALTH.playerHealthMax - 5);
      // Win the encounter, recruit, then enter the next node.
      winEncounter(bus);
      run.dispatch({ kind: 'chooseRecruit', unitTemplate: run.currentOffer![0]! });
      const second = run.nodeMap.edges.find((e) => e.from === first)!.to;
      run.dispatch({ kind: 'enterNode', nodeId: second });
      expect(run.playerHealth).toBe(HEALTH.playerHealthMax - 5); // carried the wound
      expect(run.enemyHealth).toBe(HEALTH.enemyHealthMax); // reset for the new encounter
    });

    it('loses the run when the player pool empties', () => {
      const { run, bus } = freshRunWithBus(1);
      const frontier = run.nodeMap.edges.find((e) => e.from === run.rootId)!.to;
      run.dispatch({ kind: 'enterNode', nodeId: frontier });
      let defeated = 0;
      bus.on('run:defeated', () => defeated++);
      chipTurn(bus, { player: 0, enemy: HEALTH.playerHealthMax });
      expect(run.playerHealth).toBe(0);
      expect(run.phase).toBe('defeat');
      expect(defeated).toBe(1);
    });

    it('a turn that zeroes BOTH pools is a defeat (run-loss precedence)', () => {
      const { run, bus } = freshRunWithBus(1);
      const frontier = run.nodeMap.edges.find((e) => e.from === run.rootId)!.to;
      run.dispatch({ kind: 'enterNode', nodeId: frontier });
      chipTurn(bus, { player: HEALTH.enemyHealthMax, enemy: HEALTH.playerHealthMax });
      expect(run.phase).toBe('defeat');
    });

    it('the max-turns cap terminates an all-mutual-wipe encounter (pristine tie → defeat)', () => {
      const { run, bus } = freshRunWithBus(1);
      const frontier = run.nodeMap.edges.find((e) => e.from === run.rootId)!.to;
      run.dispatch({ kind: 'enterNode', nodeId: frontier });
      // Every turn chips 0/0; without the cap this would loop forever.
      for (let i = 0; i < HEALTH.maxTurns; i++) chipTurn(bus, { player: 0, enemy: 0 });
      expect(run.turnIndex).toBe(HEALTH.maxTurns);
      // Pristine pools → equal fractions → player loses the tie.
      expect(run.phase).toBe('defeat');
    });

    it('the max-turns cap awards the win when the player pool fraction leads', () => {
      const { run, bus } = freshRunWithBus(1);
      const frontier = run.nodeMap.edges.find((e) => e.from === run.rootId)!.to;
      run.dispatch({ kind: 'enterNode', nodeId: frontier });
      // Knock the enemy pool down (but not out), then stalemate to the cap.
      chipTurn(bus, { player: HEALTH.enemyHealthMax - 1, enemy: 0 });
      expect(run.phase).toBe('battle');
      while (run.turnIndex < HEALTH.maxTurns) chipTurn(bus, { player: 0, enemy: 0 });
      // playerFrac (1.0) > enemyFrac (1/max) → encounter won.
      expect(run.phase).toBe('recruit');
    });

    it('banks encounter XP ONCE at the end, not per turn', () => {
      const { run, bus } = freshLvl1RunWithBus(1);
      const frontier = run.nodeMap.edges.find((e) => e.from === run.rootId)!.to;
      run.dispatch({ kind: 'enterNode', nodeId: frontier });
      const promotions: number[][] = [];
      bus.on('promotion:pending', ({ promotions: p }) =>
        promotions.push(p.map((x) => x.rosterIndex)),
      );

      // Split exactly one level's XP across two turns; neither half alone crosses.
      const half1 = Math.floor(xpToNext(1) / 2);
      const half2 = xpToNext(1) - half1;
      chipTurn(bus, { player: 1, enemy: 0 }, [
        { unitId: 1, rosterIndex: 0, damageDealt: 0, xpGained: half1 },
      ]);
      expect(run.phase).toBe('battle');
      // NOT banked yet — the roster slot is still pristine mid-encounter.
      expect(run.team[0]!.xp).toBe(0);
      expect(run.team[0]!.level).toBe(1);

      chipTurn(bus, { player: HEALTH.enemyHealthMax, enemy: 0 }, [
        { unitId: 1, rosterIndex: 0, damageDealt: 0, xpGained: half2 },
      ]);
      // Banked once at encounter end → exactly one level-up, one promotion.
      expect(run.phase).toBe('promotion');
      expect(promotions).toEqual([[0]]);
      expect(run.team[0]!.level).toBe(2);
      expect(run.team[0]!.xp).toBe(0);
    });

    it('discards pending encounter XP on defeat', () => {
      const { run, bus } = freshLvl1RunWithBus(1);
      const frontier = run.nodeMap.edges.find((e) => e.from === run.rootId)!.to;
      run.dispatch({ kind: 'enterNode', nodeId: frontier });
      // A big award on the LOSING turn must not bank (the run is over).
      chipTurn(bus, { player: 0, enemy: HEALTH.playerHealthMax }, [
        { unitId: 1, rosterIndex: 0, damageDealt: 0, xpGained: xpToNext(1) * 5 },
      ]);
      expect(run.phase).toBe('defeat');
      expect(run.team[0]!.level).toBe(1);
      expect(run.team[0]!.xp).toBe(0);
    });

    it('round-trips the pools + pending XP mid-encounter', () => {
      const { run, bus } = freshLvl1RunWithBus(7);
      const frontier = run.nodeMap.edges.find((e) => e.from === run.rootId)!.to;
      run.dispatch({ kind: 'enterNode', nodeId: frontier });
      chipTurn(bus, { player: 1, enemy: 2 }, [
        { unitId: 1, rosterIndex: 0, damageDealt: 0, xpGained: 5 },
      ]);
      expect(run.phase).toBe('battle'); // mid-encounter
      const restored = Run.fromJSON(run.toJSON(), new EventBus<GameEvents>());
      expect(restored.playerHealth).toBe(run.playerHealth);
      expect(restored.enemyHealth).toBe(run.enemyHealth);
      expect(restored.turnIndex).toBe(run.turnIndex);
      expect(restored.encounterBudget).toBe(run.encounterBudget);
      expect(restored.pendingEncounterXp).toEqual(run.pendingEncounterXp);
    });
  });

  describe('turn gates (H4b, pauseAtTurnGates)', () => {
    it('entering a node pauses on turn-intro + emits turn:starting (no battle yet)', () => {
      const { run, bus } = freshRunWithBus(1);
      run.pauseAtTurnGates = true;
      const starting: GameEvents['turn:starting'][] = [];
      const battleStarts: number[] = [];
      bus.on('turn:starting', (p) => starting.push(p));
      bus.on('battle:started', () => battleStarts.push(1));
      run.dispatch({ kind: 'enterNode', nodeId: frontierOf(run) });

      expect(run.phase).toBe('turn-intro');
      expect(starting).toHaveLength(1);
      expect(starting[0]!.turn).toBe(1);
      expect(starting[0]!.playerHealth).toBe(HEALTH.playerHealthMax);
      expect(starting[0]!.enemyHealth).toBe(HEALTH.enemyHealthMax);
      // The battle hasn't spun up yet — the screen gates it.
      expect(battleStarts).toHaveLength(0);
      expect(run.currentEncounter).toBeNull();

      run.dispatch({ kind: 'advanceTurn' });
      expect(run.phase).toBe('battle');
      expect(battleStarts).toHaveLength(1);
      expect(run.currentEncounter).not.toBeNull();
    });

    it('a resolved turn pauses on turn-outcome + emits turn:resolved with the chips', () => {
      const { run, bus } = freshRunWithBus(1);
      run.pauseAtTurnGates = true;
      const resolved: GameEvents['turn:resolved'][] = [];
      bus.on('turn:resolved', (p) => resolved.push(p));
      run.dispatch({ kind: 'enterNode', nodeId: frontierOf(run) });
      run.dispatch({ kind: 'advanceTurn' }); // start the battle

      chipTurn(bus, { player: 1, enemy: 2 }); // sub-lethal → ongoing
      expect(run.phase).toBe('turn-outcome');
      expect(resolved).toHaveLength(1);
      expect(resolved[0]!.turn).toBe(1);
      expect(resolved[0]!.enemyPoolChip).toBe(1);
      expect(resolved[0]!.playerPoolChip).toBe(2);
      expect(resolved[0]!.result).toBe('ongoing');
      expect(resolved[0]!.enemyHealth).toBe(HEALTH.enemyHealthMax - 1);
      expect(resolved[0]!.playerHealth).toBe(HEALTH.playerHealthMax - 2);

      run.dispatch({ kind: 'advanceTurn' }); // ongoing → next turn's pre-turn gate
      expect(run.phase).toBe('turn-intro');
    });

    it('drives a full gated encounter: intro → battle → outcome → recruit on a win', () => {
      const { run, bus } = freshRunWithBus(1);
      run.pauseAtTurnGates = true;
      const resolved: GameEvents['turn:resolved'][] = [];
      bus.on('turn:resolved', (p) => resolved.push(p));
      run.dispatch({ kind: 'enterNode', nodeId: frontierOf(run) });
      run.dispatch({ kind: 'advanceTurn' }); // → battle
      expect(run.phase).toBe('battle');

      chipTurn(bus, { player: HEALTH.enemyHealthMax, enemy: 0 }); // lethal → won
      expect(run.phase).toBe('turn-outcome');
      expect(resolved[0]!.result).toBe('won');

      run.dispatch({ kind: 'advanceTurn' }); // won → finishEncounter → recruit
      expect(run.phase).toBe('recruit');
      expect(run.currentOffer).not.toBeNull();
    });

    it('a gated turn that empties the player pool routes to defeat on advanceTurn', () => {
      const { run, bus } = freshRunWithBus(1);
      run.pauseAtTurnGates = true;
      const resolved: GameEvents['turn:resolved'][] = [];
      bus.on('turn:resolved', (p) => resolved.push(p));
      run.dispatch({ kind: 'enterNode', nodeId: frontierOf(run) });
      run.dispatch({ kind: 'advanceTurn' });

      chipTurn(bus, { player: 0, enemy: HEALTH.playerHealthMax });
      expect(run.phase).toBe('turn-outcome');
      expect(resolved[0]!.result).toBe('lost');

      let defeated = 0;
      bus.on('run:defeated', () => defeated++);
      run.dispatch({ kind: 'advanceTurn' });
      expect(run.phase).toBe('defeat');
      expect(defeated).toBe(1);
    });

    it('advanceTurn is a no-op outside a turn gate', () => {
      const { run } = freshRunWithBus(1);
      expect(run.phase).toBe('map');
      run.dispatch({ kind: 'advanceTurn' });
      expect(run.phase).toBe('map');
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

  describe('passRecruit command (H6b)', () => {
    it('declines the offer: roster, deck, and deploymentCounts untouched; returns to map', () => {
      const { run, bus } = freshRunWithBus(1);
      driveToRecruitPhase(run, bus);
      const teamBefore = run.team.length;
      const deployBefore = run.deploymentCounts.length;
      const drawBefore = run.drawPile.length;
      const discardBefore = run.discardPile.length;

      run.dispatch({ kind: 'passRecruit' });

      expect(run.phase).toBe('map');
      expect(run.team).toHaveLength(teamBefore); // no recruit added
      expect(run.deploymentCounts).toHaveLength(deployBefore); // parallel array unchanged
      expect(run.drawPile).toHaveLength(drawBefore);
      expect(run.discardPile).toHaveLength(discardBefore);
      expect(run.currentOffer).toBeNull();
    });

    it('ignores passRecruit outside of recruit phase', () => {
      const { run } = freshRunWithBus(1);
      const phaseBefore = run.phase; // map — dispatching here is a no-op
      run.dispatch({ kind: 'passRecruit' });
      expect(run.phase).toBe(phaseBefore);
    });
  });

  describe('spawn-time fatigue (H6c → K1: a Fatigued status effect)', () => {
    // The integration tests flip the shipped (inert) knob; restore it after
    // each so they can't pollute the rest of the suite.
    const originalRate = HEALTH.fatiguePerStack;
    afterEach(() => {
      HEALTH.fatiguePerStack = originalRate;
    });

    /** The transient template the run fielded for `rosterIndex` this turn. */
    const fielded = (run: Run, rosterIndex: number) =>
      run.currentEncounter!.playerTeam.find((u) => u.rosterIndex === rosterIndex)!;

    /** Effective power of that fielded unit — base `stats.power` folded with the
     *  seeded `effects` (where the Fatigued debuff now lives, post-K1). */
    const fieldedPower = (run: Run, rosterIndex: number): number => {
      const t = fielded(run, rosterIndex);
      return foldEffects(t.stats, t.effects ?? []).power;
    };

    it('is inert at the shipped knob: NO effect seeded, fielded power equals base', () => {
      const { run, bus } = freshRunWithBus(1);
      run.dispatch({ kind: 'enterNode', nodeId: frontierOf(run) });
      // Turn 1 (0 stacks): no Fatigued effect, every fielded unit at base power.
      for (const u of run.currentEncounter!.playerTeam) {
        expect(u.effects ?? []).toEqual([]);
        expect(fieldedPower(run, u.rosterIndex!)).toBe(run.team[u.rosterIndex!]!.stats.power);
      }
      // Turn 2 (1 prior deployment): STILL no effect at the default rate 0.
      chipTurn(bus, { player: 1, enemy: 0 }); // sub-lethal → encounter continues
      for (const u of run.currentEncounter!.playerTeam) {
        expect(u.effects ?? []).toEqual([]);
      }
    });

    it('seeds a Fatigued effect that reduces effective power once the knob is positive', () => {
      // rate > 0.5 so even a power-1 unit rounds strictly down at 1 stack.
      HEALTH.fatiguePerStack = 0.6;
      const { run, bus } = freshRunWithBus(1);
      run.dispatch({ kind: 'enterNode', nodeId: frontierOf(run) });

      const baseP = run.team[0]!.stats.power;
      expect(fielded(run, 0).effects ?? []).toEqual([]); // turn 1 = 0 stacks → no effect
      expect(fieldedPower(run, 0)).toBe(baseP);

      chipTurn(bus, { player: 1, enemy: 0 }); // → turn 2, 1 prior deployment
      const seeded = fielded(run, 0).effects ?? [];
      expect(seeded).toHaveLength(1);
      expect(seeded[0]!.key).toBe(FATIGUE_KEY);
      // Derived from the very effect the production seam applies — no literal.
      expect(fieldedPower(run, 0)).toBe(foldEffects(fielded(run, 0).stats, [fatigueEffect(1)!]).power);
      expect(fieldedPower(run, 0)).toBeLessThan(baseP);
    });

    it('never mutates the roster canonical stats when fielding a fatigued copy', () => {
      HEALTH.fatiguePerStack = 0.6;
      const { run, bus } = freshRunWithBus(1);
      const baseP = run.team[0]!.stats.power;
      run.dispatch({ kind: 'enterNode', nodeId: frontierOf(run) });
      chipTurn(bus, { player: 1, enemy: 0 });
      // The roster template keeps its canonical power AND carries no effect —
      // fatigue rode the transient stamped copy.
      expect(run.team[0]!.stats.power).toBe(baseP);
      expect((run.team[0] as { effects?: unknown }).effects).toBeUndefined();
    });
  });

  describe('encounter-effect store + run triggers (K1)', () => {
    const empower = (mag = 1): StatusEffect => ({
      key: 'empowered',
      magnitude: mag,
      mods: { strength: { add: 4 } },
      lifetime: { kind: 'endOfTurn' },
      merge: 'replace',
    });

    const fieldedFor = (run: Run, rosterIndex: number) =>
      run.currentEncounter!.playerTeam.find((u) => u.rosterIndex === rosterIndex);

    it('initializes one empty encounter-effect list per roster slot', () => {
      const run = new Run(1, new EventBus<GameEvents>());
      expect(run.encounterEffects).toHaveLength(run.team.length);
      expect(run.encounterEffects.every((l) => l.length === 0)).toBe(true);
    });

    it('seeds an encounter effect onto the fielded unit and persists it across turns', () => {
      const { run, bus } = freshRunWithBus(1);
      run.dispatch({ kind: 'enterNode', nodeId: frontierOf(run) });
      run.addEncounterEffect(0, empower()); // added after turn 1's seed → from turn 2
      chipTurn(bus, { player: 1, enemy: 0 }); // → turn 2
      expect(fieldedFor(run, 0)!.effects).toEqual([empower()]);
      chipTurn(bus, { player: 1, enemy: 0 }); // → turn 3, still re-seeded
      expect(fieldedFor(run, 0)!.effects).toEqual([empower()]);
    });

    it('merges a re-applied encounter effect by key (replace overwrites magnitude)', () => {
      const run = new Run(1, new EventBus<GameEvents>());
      run.addEncounterEffect(0, empower(1));
      run.addEncounterEffect(0, empower(3));
      expect(run.encounterEffects[0]).toHaveLength(1);
      expect(run.encounterEffects[0]![0]!.magnitude).toBe(3);
    });

    it('ignores addEncounterEffect on an out-of-range slot', () => {
      const run = new Run(1, new EventBus<GameEvents>());
      run.addEncounterEffect(999, empower());
      run.addEncounterEffect(-1, empower());
      expect(run.encounterEffects.every((l) => l.length === 0)).toBe(true);
    });

    it('clears the store at the next encounter (encounter scope)', () => {
      const { run, bus } = freshRunWithBus(1);
      const first = frontierOf(run);
      run.dispatch({ kind: 'enterNode', nodeId: first });
      run.addEncounterEffect(0, empower());
      winEncounter(bus);
      run.dispatch({ kind: 'chooseRecruit', unitTemplate: run.currentOffer![0]! });
      const second = run.nodeMap.edges.find((e) => e.from === first)!.to;
      run.dispatch({ kind: 'enterNode', nodeId: second });
      expect(run.encounterEffects.every((l) => l.length === 0)).toBe(true);
      expect(fieldedFor(run, 0)?.effects ?? []).toEqual([]);
    });

    it('appends a fresh empty list when a unit is recruited', () => {
      const { run, bus } = freshRunWithBus(1);
      run.dispatch({ kind: 'enterNode', nodeId: frontierOf(run) });
      const before = run.team.length;
      winEncounter(bus);
      run.dispatch({ kind: 'chooseRecruit', unitTemplate: run.currentOffer![0]! });
      expect(run.encounterEffects).toHaveLength(before + 1);
      expect(run.encounterEffects[run.encounterEffects.length - 1]).toEqual([]);
    });

    it('fires encounterStart / turnStart / deploy with the right context', () => {
      const { run } = freshRunWithBus(1);
      const encounterStarts: number[] = [];
      const turnStarts: number[] = [];
      const deploys: number[] = [];
      run.registerTrigger('encounterStart', (ctx) => encounterStarts.push(ctx.nodeId));
      run.registerTrigger('turnStart', (ctx) => turnStarts.push(ctx.turn));
      run.registerTrigger('deploy', (ctx) => deploys.push(ctx.rosterIndex));
      run.dispatch({ kind: 'enterNode', nodeId: frontierOf(run) });
      expect(encounterStarts).toEqual([run.currentNodeId]);
      expect(turnStarts).toEqual([1]); // turn 1
      // deploy fires once per fielded slot (this turn's whole hand).
      expect(deploys.slice().sort()).toEqual(run.hand.slice().sort());
    });

    it('a turnStart daemon adds an encounter effect that is seeded that same turn', () => {
      const { run } = freshRunWithBus(1);
      // The L daemon flow, in miniature: on turn start, grant slot 0 an empower.
      run.registerTrigger('turnStart', (_ctx, r) => r.addEncounterEffect(0, empower()));
      run.dispatch({ kind: 'enterNode', nodeId: frontierOf(run) });
      expect(fieldedFor(run, 0)!.effects).toEqual([empower()]);
    });

    it('round-trips the encounter-effect store; a pre-K1 version is rejected', () => {
      const { run } = freshRunWithBus(1);
      run.dispatch({ kind: 'enterNode', nodeId: frontierOf(run) });
      run.addEncounterEffect(0, empower(2));
      const wire = JSON.parse(JSON.stringify(run.toJSON()));
      expect(wire.encounterEffects[0]).toHaveLength(1);
      const restored = Run.fromJSON(wire, new EventBus<GameEvents>());
      expect(restored.encounterEffects[0]![0]!.magnitude).toBe(2);
      const stale = { ...wire, schemaVersion: wire.schemaVersion - 1 };
      expect(() => Run.fromJSON(stale, new EventBus<GameEvents>())).toThrow(
        /unsupported schema version/,
      );
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
      winEncounter(bus);
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
      winEncounter(bus);
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
      winEncounter(bus);
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
      winEncounter(bus);
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
      winEncounter(bus);
      run.dispatch({ kind: 'chooseRecruit', unitTemplate: run.currentOffer![0]! });

      const restored = Run.fromJSON(run.toJSON(), new EventBus<GameEvents>());
      const second = run.nodeMap.edges.find((e) => e.from === first)!.to;
      run.dispatch({ kind: 'enterNode', nodeId: second });
      restored.dispatch({ kind: 'enterNode', nodeId: second });
      expect(restored.currentEncounter).toEqual(run.currentEncounter);
    });
  });

  describe('deployment counter (H3)', () => {
    it('initializes one zero count per roster slot', () => {
      const run = new Run(1, new EventBus<GameEvents>());
      expect(run.deploymentCounts).toHaveLength(run.team.length);
      expect(run.deploymentCounts.every((c) => c === 0)).toBe(true);
    });

    it('records one deployment per roster slot on entering a battle', () => {
      const { run } = freshRunWithBus(1);
      const frontier = run.nodeMap.edges.find((e) => e.from === run.rootId)!.to;
      run.dispatch({ kind: 'enterNode', nodeId: frontier });
      expect(run.deploymentCounts).toEqual(new Array(run.team.length).fill(1));
    });

    it('resets at the start of each encounter (a second battle never reads 2)', () => {
      const { run, bus } = freshRunWithBus(1);
      const first = run.nodeMap.edges.find((e) => e.from === run.rootId)!.to;
      run.dispatch({ kind: 'enterNode', nodeId: first });
      winEncounter(bus);
      run.dispatch({ kind: 'chooseRecruit', unitTemplate: run.currentOffer![0]! });
      const second = run.nodeMap.edges.find((e) => e.from === first)!.to;
      run.dispatch({ kind: 'enterNode', nodeId: second });
      // H5: a one-turn encounter deploys only the drawn hand, so a grown roster
      // (6 > handSize 5) reads 1 for the drawn slots and 0 for the undrawn one.
      // The load-bearing assertion is that NOTHING accumulated to 2 (the reset
      // worked) and the total deployments equal exactly this encounter's one
      // hand, not a doubled count.
      expect(run.deploymentCounts.every((c) => c === 0 || c === 1)).toBe(true);
      const handSize = Math.min(run.team.length, DECK.handSize);
      expect(run.deploymentCounts.reduce((a, b) => a + b, 0)).toBe(handSize);
    });

    it('appends a fresh zero count when a unit is recruited', () => {
      const { run, bus } = freshRunWithBus(1);
      const first = run.nodeMap.edges.find((e) => e.from === run.rootId)!.to;
      run.dispatch({ kind: 'enterNode', nodeId: first });
      const before = run.team.length;
      winEncounter(bus);
      run.dispatch({ kind: 'chooseRecruit', unitTemplate: run.currentOffer![0]! });
      expect(run.team).toHaveLength(before + 1);
      expect(run.deploymentCounts).toHaveLength(run.team.length);
      // The new slot hasn't been deployed in any encounter yet.
      expect(run.deploymentCounts[run.deploymentCounts.length - 1]).toBe(0);
    });

    it('accumulates across turns within an encounter, then zeros on reset (the H4 seam)', () => {
      const run = new Run(1, new EventBus<GameEvents>());
      const all = run.team.map((_, i) => i);
      run.recordDeployment(all);
      run.recordDeployment(all);
      run.recordDeployment([0]);
      expect(run.deploymentCounts[0]).toBe(3);
      expect(run.deploymentCounts[1]).toBe(2);
      run.resetDeploymentCounts();
      expect(run.deploymentCounts).toEqual(new Array(run.team.length).fill(0));
    });

    it('ignores out-of-range indices in recordDeployment', () => {
      const run = new Run(1, new EventBus<GameEvents>());
      run.recordDeployment([-1, run.team.length, 0]);
      expect(run.deploymentCounts[0]).toBe(1);
      expect(run.deploymentCounts).toHaveLength(run.team.length);
    });

    it('round-trips the deployment counts through toJSON → fromJSON', () => {
      const { run } = freshRunWithBus(7);
      const frontier = run.nodeMap.edges.find((e) => e.from === run.rootId)!.to;
      run.dispatch({ kind: 'enterNode', nodeId: frontier });
      const restored = Run.fromJSON(run.toJSON(), new EventBus<GameEvents>());
      expect(restored.deploymentCounts).toEqual(run.deploymentCounts);
    });
  });

  describe('card deck (H5)', () => {
    // An oversized roster (> handSize) so draw variance + dilution are live.
    type RosterSpec = { archetype: 'mercenary' | 'ranged'; level: number };
    const BIG_ROSTER: RosterSpec[] = Array.from({ length: 8 }, (_, i) => ({
      archetype: i % 2 === 0 ? 'mercenary' : 'ranged',
      level: 1,
    }));

    /** Enter the first battle on a custom roster; return the live Run + bus. */
    function enterFirstBattle(roster: RosterSpec[], seed = 1): { run: Run; bus: EventBus<GameEvents> } {
      const bus = new EventBus<GameEvents>();
      const run = new Run(seed, bus, { startingRoster: roster });
      const frontier = run.nodeMap.edges.find((e) => e.from === run.nodeMap.rootId)!.to;
      run.dispatch({ kind: 'enterNode', nodeId: frontier });
      return { run, bus };
    }

    /** draw ∪ discard ∪ hand, sorted — should always be a partition of 0..n-1. */
    function deckUnion(run: Run): number[] {
      return [...run.drawPile, ...run.discardPile, ...run.hand].sort((a, b) => a - b);
    }

    it('caps the drawn hand at handSize for an oversized roster', () => {
      const { run } = enterFirstBattle(BIG_ROSTER);
      expect(run.team.length).toBeGreaterThan(DECK.handSize);
      expect(run.hand).toHaveLength(DECK.handSize);
      expect(run.currentEncounter!.playerTeam).toHaveLength(DECK.handSize);
      expect(new Set(run.hand).size).toBe(DECK.handSize); // no duplicate cards
    });

    it('a roster smaller than handSize fields everyone (no overdraw)', () => {
      const small = [
        { archetype: 'mercenary' as const, level: 1 },
        { archetype: 'ranged' as const, level: 1 },
      ];
      const { run } = enterFirstBattle(small);
      expect(run.team.length).toBeLessThan(DECK.handSize);
      expect(run.hand).toHaveLength(run.team.length);
      expect(new Set(run.hand).size).toBe(run.team.length);
    });

    it('the deck partitions the roster (draw ∪ discard ∪ hand) every turn — no card lost or duplicated', () => {
      const { run, bus } = enterFirstBattle(BIG_ROSTER);
      const all = run.team.map((_, i) => i);
      expect(deckUnion(run)).toEqual(all);
      // Sub-lethal 0/0 chips keep the encounter ongoing; the invariant holds
      // through every reshuffle.
      for (let i = 0; i < 4 && run.phase === 'battle'; i++) {
        chipTurn(bus, { player: 0, enemy: 0 });
        if (run.phase === 'battle') expect(deckUnion(run)).toEqual(all);
      }
    });

    it('draws every card across turns (reshuffle when the draw pile empties)', () => {
      const { run, bus } = enterFirstBattle(BIG_ROSTER);
      const seen = new Set<number>(run.hand);
      for (let i = 0; i < 5 && run.phase === 'battle'; i++) {
        chipTurn(bus, { player: 0, enemy: 0 });
        if (run.phase === 'battle') for (const idx of run.hand) seen.add(idx);
      }
      // No card is permanently buried — the whole roster is dealt within a few
      // turns once the discard reshuffles back in.
      expect(seen.size).toBe(run.team.length);
    });

    it('rebuilds the deck for each encounter, including a freshly recruited card', () => {
      const { run, bus } = freshRunWithBus(1);
      const first = run.nodeMap.edges.find((e) => e.from === run.rootId)!.to;
      run.dispatch({ kind: 'enterNode', nodeId: first });
      const sizeBefore = run.team.length;
      winEncounter(bus);
      run.dispatch({ kind: 'chooseRecruit', unitTemplate: run.currentOffer![0]! });
      expect(run.team).toHaveLength(sizeBefore + 1);
      const second = run.nodeMap.edges.find((e) => e.from === first)!.to;
      run.dispatch({ kind: 'enterNode', nodeId: second });
      // The deck spans the GROWN roster — the recruited card's index is in play.
      expect(deckUnion(run)).toEqual(run.team.map((_, i) => i));
      expect(deckUnion(run)).toContain(run.team.length - 1);
    });

    it('is deterministic per seed (same hand sequence)', () => {
      const handsFor = (seed: number): number[][] => {
        const { run, bus } = enterFirstBattle(BIG_ROSTER, seed);
        const hands = [run.hand.slice()];
        for (let i = 0; i < 3 && run.phase === 'battle'; i++) {
          chipTurn(bus, { player: 0, enemy: 0 });
          if (run.phase === 'battle') hands.push(run.hand.slice());
        }
        return hands;
      };
      expect(handsFor(123)).toEqual(handsFor(123));
    });

    it('surfaces the drawn hand on turn:starting before the battle (H5b, gated path)', () => {
      const bus = new EventBus<GameEvents>();
      const run = new Run(1, bus, { startingRoster: BIG_ROSTER });
      run.pauseAtTurnGates = true; // the live/interactive path
      const starting: GameEvents['turn:starting'][] = [];
      bus.on('turn:starting', (p) => starting.push(p));
      const frontier = run.nodeMap.edges.find((e) => e.from === run.nodeMap.rootId)!.to;
      run.dispatch({ kind: 'enterNode', nodeId: frontier });

      // The hand is drawn at the turn gate (before the battle spins up), so the
      // pre-turn screen can show it.
      expect(run.phase).toBe('turn-intro');
      expect(run.currentEncounter).toBeNull();
      expect(starting).toHaveLength(1);
      expect(starting[0]!.hand).toHaveLength(DECK.handSize); // capped to handSize
      // The payload's templates ARE this turn's drawn cards (in draw order).
      expect(starting[0]!.hand).toEqual(run.hand.map((idx) => run.team[idx]));
    });
  });

  describe('rest nodes (G3)', () => {
    it('banks restXp into every roster slot and starts no battle', () => {
      // floorCount 4 → a floor-2 rest is the first reachable rest. Clear the
      // floor-1 battle with no XP so the only XP the team carries into the rest
      // is the rest grant itself (expected level/xp derive from the actual
      // starting level, so this is robust to the startingLevel dial).
      const { run, bus, restId } = driveToRestFrontier({ floorCount: 4 }, 2);
      const before = run.team.map((t) => ({ level: t.level, xp: t.xp }));
      let battleStarts = 0;
      bus.on('battle:started', () => battleStarts++);

      run.dispatch({ kind: 'enterNode', nodeId: restId });

      expect(battleStarts).toBe(0);
      expect(run.currentEncounter).toBeNull();
      // Balance-proof: expected level/xp derived from the curve + the knob.
      for (let i = 0; i < before.length; i++) {
        const want = expectedAfterBank(before[i]!.level, before[i]!.xp, LEVELING.restXp);
        expect(run.team[i]!.level).toBe(want.level);
        expect(run.team[i]!.xp).toBe(want.xp);
      }
    });

    it('triggers PromotionScene on a level-up and dismissing returns to the map (not recruit)', () => {
      const { run, bus, restId } = driveToRestFrontier(
        { floorCount: 4, startingRoster: LVL1_ROSTER },
        2,
      );
      // Level-1 roster + restXp (>= xpToNext(1)) guarantees promotions.
      expect(LEVELING.restXp).toBeGreaterThanOrEqual(xpToNext(1));
      const promotions: number[][] = [];
      let recruitOffers = 0;
      bus.on('promotion:pending', ({ promotions: p }) =>
        promotions.push(p.map((x) => x.rosterIndex)),
      );
      bus.on('recruit:offered', () => recruitOffers++);

      run.dispatch({ kind: 'enterNode', nodeId: restId });
      expect(run.phase).toBe('promotion');
      expect(promotions).toHaveLength(1);
      // The 5 level-1 starters all promote on restXp (≥ xpToNext(1)). The
      // floor-1 recruit comes in at round(avg)+bonus, so it may be level 2 and
      // skip promotion — don't require it.
      expect(promotions[0]).toEqual(expect.arrayContaining([0, 1, 2, 3, 4]));

      run.dispatch({ kind: 'dismissPromotion' });
      expect(run.phase).toBe('map'); // back to the map, NOT recruit
      expect(recruitOffers).toBe(0);
    });

    it('returns to the map silently when no unit levels up', () => {
      // floorCount 5 → a floor-3 rest. G4: recruits arrive at round(avgTeamLevel)
      // + bonus, so with an all-cap starting roster (and vaultAll keeping each
      // recruit at the cap) the whole team sits at the level cap by rest time.
      // Granting restXp then can't level anyone (cap units drain banked xp), so
      // the rest resolves to a SILENT return to the map — no promotion, no
      // recruit. (The boundary "a low unit banks restXp without leveling" can't
      // arise under G4: a low-avg team levels ON rest, which wouldn't be silent.)
      const cap = LEVELING.levelCap;
      const startingRoster = [
        { archetype: 'mercenary' as const, level: cap },
        { archetype: 'ranged' as const, level: cap },
      ];
      const vaultAll = (r: Run) =>
        r.team.map((_, i) => ({ unitId: i, rosterIndex: i, damageDealt: 0, xpGained: 1e9 }));
      const { run, bus, restId } = driveToRestFrontier(
        { floorCount: 5, startingRoster },
        3,
        vaultAll,
      );
      let promotionPending = 0;
      let recruitOffers = 0;
      bus.on('promotion:pending', () => promotionPending++);
      bus.on('recruit:offered', () => recruitOffers++);

      run.dispatch({ kind: 'enterNode', nodeId: restId });

      expect(run.phase).toBe('map');
      expect(promotionPending).toBe(0);
      expect(recruitOffers).toBe(0);
      // Nobody leveled — every unit (incl. the cap-level recruits) is still at cap.
      expect(run.team.every((t) => t.level === cap)).toBe(true);
    });

    it('a boss node builds a normal battle encounter (regression-equivalent to a battle)', () => {
      // floorCount 2 → root -> terminal; the terminal is the boss, reachable
      // in one hop.
      const bus = new EventBus<GameEvents>();
      const run = new Run(1, bus, { floorCount: 2 });
      const boss = run.nodeMap.terminalId;
      expect(run.nodeMap.nodes.find((n) => n.id === boss)!.kind).toBe('boss');
      let battleStarts = 0;
      bus.on('battle:started', () => battleStarts++);

      run.dispatch({ kind: 'enterNode', nodeId: boss });
      expect(run.phase).toBe('battle');
      expect(battleStarts).toBe(1);
      expect(run.currentEncounter).not.toBeNull();

      // And a win at the boss completes the run (existing terminal path).
      winEncounter(bus);
      expect(run.phase).toBe('complete');
    });

    it('H6a — heals the run-wide player pool by restHealAmount when wounded', () => {
      const { run, restId } = driveToRestFrontier({ floorCount: 4 }, 2);
      // Wound the pool deep enough that the heal can't hit the cap.
      const before = Math.max(1, HEALTH.playerHealthMax - HEALTH.restHealAmount - 1);
      run.playerHealth = before;

      run.dispatch({ kind: 'enterNode', nodeId: restId });

      // Balance-proof: expected derives from the knob + the cap, never hardcoded.
      expect(run.playerHealth).toBe(
        Math.min(HEALTH.playerHealthMax, before + HEALTH.restHealAmount),
      );
    });

    it('H6a — never heals the pool above playerHealthMax', () => {
      const { run, restId } = driveToRestFrontier({ floorCount: 4 }, 2);
      // Already full: the heal must clamp, never overfill (robust for any knob).
      run.playerHealth = HEALTH.playerHealthMax;

      run.dispatch({ kind: 'enterNode', nodeId: restId });

      expect(run.playerHealth).toBe(HEALTH.playerHealthMax);
    });
  });
});

/**
 * H4 — emit a `battle:ended` whose PLAYER survivors chip the enemy pool by
 * `HEALTH.enemyHealthMax`, guaranteeing the encounter is won in this one turn
 * (the common "resolve this node now" case the pre-H4 tests assumed). Any
 * `xpAwards` bank at encounter end as usual.
 */
function winEncounter(
  bus: EventBus<GameEvents>,
  xpAwards: GameEvents['battle:ended']['xpAwards'] = [],
): void {
  bus.emit('battle:ended', {
    winner: 'player',
    xpAwards,
    survivorPower: { player: HEALTH.enemyHealthMax, enemy: 0 },
  });
}

/** H4 — emit a `battle:ended` whose ENEMY survivors chip the player pool by
 *  `HEALTH.playerHealthMax`, losing the run in this one turn. */
function loseEncounter(bus: EventBus<GameEvents>): void {
  bus.emit('battle:ended', {
    winner: 'enemy',
    xpAwards: [],
    survivorPower: { player: 0, enemy: HEALTH.playerHealthMax },
  });
}

/** H4 — emit one turn's `battle:ended` with an explicit survivor-power chip
 *  (and optional XP awards), for multi-turn encounter-loop tests. */
function chipTurn(
  bus: EventBus<GameEvents>,
  survivorPower: { player: number; enemy: number },
  xpAwards: GameEvents['battle:ended']['xpAwards'] = [],
): void {
  bus.emit('battle:ended', { winner: 'draw', xpAwards, survivorPower });
}

function driveToRecruitPhase(run: Run, bus: EventBus<GameEvents>): void {
  const frontier = run.nodeMap.edges.find((e) => e.from === run.nodeMap.rootId)!.to;
  run.dispatch({ kind: 'enterNode', nodeId: frontier });
  winEncounter(bus);
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

/** The root's first frontier node — the standard "enter the first battle" hop. */
function frontierOf(run: Run & { rootId: number }): number {
  return run.nodeMap.edges.find((e) => e.from === run.rootId)!.to;
}

/** Canonical level-1 starting roster (3 melee + 2 ranged, matching the default
 *  composition + slot order). */
const LVL1_ROSTER = [
  { archetype: 'mercenary' as const, level: 1 },
  { archetype: 'mercenary' as const, level: 1 },
  { archetype: 'mercenary' as const, level: 1 },
  { archetype: 'ranged' as const, level: 1 },
  { archetype: 'ranged' as const, level: 1 },
];

/** Like `freshRunWithBus` but pins a level-1 roster, for XP / promotion
 *  MECHANIC tests that award `xpToNext(1)` to force a 1→2 level-up — they must
 *  not depend on the `startingLevel` balance dial (which ships at 5). */
function freshLvl1RunWithBus(seed: number): RunHandle {
  const bus = new EventBus<GameEvents>();
  const run = new Run(seed, bus, { startingRoster: LVL1_ROSTER });
  return { run: Object.assign(run, { rootId: run.nodeMap.rootId }), bus };
}

/** A node that's never a frontier of the root — useful for "not reachable" tests. */
function farthestNodeId(run: Run): number {
  return run.nodeMap.terminalId;
}

/**
 * Replicates bankXpAwards' level math (level + xp only — stats roll on RNG)
 * so rest-XP expectations derive from the curve + the knob, never hardcoded.
 */
function expectedAfterBank(
  level: number,
  xp: number,
  gain: number,
): { level: number; xp: number } {
  let l = level;
  let x = xp + gain;
  while (l < LEVELING.levelCap && x >= xpToNext(l)) {
    x -= xpToNext(l);
    l += 1;
  }
  if (l >= LEVELING.levelCap) x = 0;
  return { level: l, xp: x };
}

/**
 * Search seeds for a map (under `config`) with a rest node on floor `floor`,
 * and return a fresh Run/bus on that seed plus the root→…→rest path (node ids,
 * including the root at index 0 and the rest last). Every hop before the rest
 * is a battle by construction (floor 1 is never rest-eligible and the
 * min-spacing rule keeps the floor below a rest a battle), so the path can be
 * cleared with ordinary battle resolutions.
 */
function findRestRun(
  config: RunConfig,
  floor: number,
): { run: Run; bus: EventBus<GameEvents>; path: number[] } {
  for (let s = 0; s < 800; s++) {
    const bus = new EventBus<GameEvents>();
    const run = new Run(s, bus, config);
    const rest = run.nodeMap.nodes.find((n) => n.kind === 'rest' && n.floor === floor);
    if (!rest) continue;
    const path = [rest.id];
    let cur = rest.id;
    while (run.nodeMap.nodes.find((n) => n.id === cur)!.floor > 0) {
      const parent = run.nodeMap.edges.find((e) => e.to === cur)!.from;
      path.unshift(parent);
      cur = parent;
    }
    const intermediate = path.slice(1, -1).map((id) => run.nodeMap.nodes.find((n) => n.id === id)!.kind);
    if (intermediate.some((k) => k !== 'battle')) continue;
    return { run, bus, path };
  }
  throw new Error(`findRestRun: no seed with a rest on floor ${floor}`);
}

/**
 * Drive a Run up to (but not into) a rest node on floor `floor`: clear every
 * intervening battle with `awardsForHop` (default: no XP) and the mandatory
 * recruit, leaving the rest as the current frontier. Returns the rest id.
 */
function driveToRestFrontier(
  config: RunConfig,
  floor: number,
  awardsForHop: (run: Run, hop: number) => GameEvents['battle:ended']['xpAwards'] = () => [],
): { run: Run; bus: EventBus<GameEvents>; restId: number } {
  const { run, bus, path } = findRestRun(config, floor);
  const restId = path[path.length - 1]!;
  for (let i = 1; i < path.length - 1; i++) {
    run.dispatch({ kind: 'enterNode', nodeId: path[i]! });
    winEncounter(bus, awardsForHop(run, i));
    // A battle whose awards level a unit pauses on promotion first; clear it
    // so we land in the recruit phase (the mandatory post-battle recruit).
    if (run.phase === 'promotion') run.dispatch({ kind: 'dismissPromotion' });
    run.dispatch({ kind: 'chooseRecruit', unitTemplate: run.currentOffer![0]! });
  }
  return { run, bus, restId };
}
