import { describe, it, expect, afterEach } from 'vitest';
import { Run } from './Run';
import { fatigueEffect, FATIGUE_KEY } from './fatigue';
import { foldEffects, combineMagnitude, type StatusEffect } from '../sim/statusEffects';
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
import { EMPOWER } from '../config/empower';
import { DAEMONS, daemonById, type DaemonConfig } from '../config/daemons';
import { avgTeamLevel, enemyBudgetFor } from './enemyBudget';
import type { RunConfig } from './RunConfig';

/**
 * L1 — the K3/K4 static defaults reborn as a guaranteed fixture daemon.
 * Daemon-only gates retired the `DECK.redraw.enabled` / `EMPOWER.enabled`
 * statics (both now ship false), so the pre-existing K3/K4 gate-mechanic tests
 * run under this daemon instead: its knobs ARE the config dials (derived, not
 * hardcoded), which keeps every `DECK.redraw.*` / `EMPOWER.*`-derived
 * expectation in those blocks literally true.
 */
const K_DEFAULT_DAEMON: DaemonConfig = {
  id: 'test-k-defaults',
  name: 'Test K Defaults',
  description: 'the pre-L static gates as a daemon',
  redraw: {
    chance: 1,
    redrawsPerTurn: DECK.redraw.redrawsPerTurn,
    maxCardsPerTurn: DECK.redraw.maxCardsPerTurn,
  },
  empower: {
    chance: 1,
    empowersPerTurn: EMPOWER.empowersPerTurn,
    buff: EMPOWER.buff,
  },
};

describe('Run', () => {
  describe('initial state', () => {
    it('starts in map phase at the nodeMap root', () => {
      const run = new Run(1, new EventBus<GameEvents>());
      expect(run.phase).toBe('map');
      expect(run.currentNodeId).toBe(run.nodeMap.rootId);
    });

    it('rolls the configured starting team (mercenary + ranged per RECRUITMENT)', () => {
      const run = new Run(1, new EventBus<GameEvents>());
      // Derived from the config dials (K2 raised these to 6 + 4), not hardcoded —
      // so a future roster-size tune doesn't silently break this.
      const { startingMelee, startingRanged } = RECRUITMENT;
      expect(run.team).toHaveLength(startingMelee + startingRanged);
      const melee = run.team.filter((t) => t.archetype === 'mercenary');
      const ranged = run.team.filter((t) => t.archetype === 'ranged');
      expect(melee).toHaveLength(startingMelee);
      expect(ranged).toHaveLength(startingRanged);
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
      // K2: the starting roster (10) > handSize (6), so the hand is a SHUFFLED
      // subset — compare as a set keyed by rosterIndex rather than position.
      // (The cap/subset case is covered in the deck suite below.)
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
      // H4/M1: a losing turn ends the run (player pool emptied) and skips the
      // turn's XP bank. (Non-empty awards on a losing turn are pinned
      // separately in the encounter-loop suite.)
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

    it('M1 — banks each turn\'s XP at the turn boundary, not at encounter end', () => {
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
      // Banked IMMEDIATELY at the boundary — sub-threshold, so no promotion
      // pause and the loop rolls straight into the next turn.
      expect(run.phase).toBe('battle');
      expect(run.team[0]!.xp).toBe(half1);
      expect(run.team[0]!.level).toBe(1);
      expect(promotions).toEqual([]);

      chipTurn(bus, { player: HEALTH.enemyHealthMax, enemy: 0 }, [
        { unitId: 1, rosterIndex: 0, damageDealt: 0, xpGained: half2 },
      ]);
      // The second half crosses → the promotion pauses at the WINNING turn's
      // boundary, before the encounter resolves into the recruit offer.
      expect(run.phase).toBe('promotion');
      expect(promotions).toEqual([[0]]);
      expect(run.team[0]!.level).toBe(2);
      expect(run.team[0]!.xp).toBe(0);
      run.dispatch({ kind: 'dismissPromotion' });
      expect(run.phase).toBe('recruit');
    });

    it('a losing turn\'s XP is never banked (defeat is terminal)', () => {
      const { run, bus } = freshLvl1RunWithBus(1);
      const frontier = run.nodeMap.edges.find((e) => e.from === run.rootId)!.to;
      run.dispatch({ kind: 'enterNode', nodeId: frontier });
      // A big award on the LOSING turn must not bank (M1 skips the bank on a
      // lost result — no promotion screen in front of the defeat screen).
      chipTurn(bus, { player: 0, enemy: HEALTH.playerHealthMax }, [
        { unitId: 1, rosterIndex: 0, damageDealt: 0, xpGained: xpToNext(1) * 5 },
      ]);
      expect(run.phase).toBe('defeat');
      expect(run.team[0]!.level).toBe(1);
      expect(run.team[0]!.xp).toBe(0);
    });

    it('round-trips the pools + per-turn-banked XP mid-encounter', () => {
      const { run, bus } = freshLvl1RunWithBus(7);
      const frontier = run.nodeMap.edges.find((e) => e.from === run.rootId)!.to;
      run.dispatch({ kind: 'enterNode', nodeId: frontier });
      chipTurn(bus, { player: 1, enemy: 2 }, [
        { unitId: 1, rosterIndex: 0, damageDealt: 0, xpGained: 5 },
      ]);
      expect(run.phase).toBe('battle'); // mid-encounter
      // M1: the award is already ON the roster slot (no pending-XP sidecar).
      expect(run.team[0]!.xp).toBe(5);
      const restored = Run.fromJSON(run.toJSON(), new EventBus<GameEvents>());
      expect(restored.playerHealth).toBe(run.playerHealth);
      expect(restored.enemyHealth).toBe(run.enemyHealth);
      expect(restored.turnIndex).toBe(run.turnIndex);
      expect(restored.encounterBudget).toBe(run.encounterBudget);
      expect(restored.team[0]!.xp).toBe(5);
    });
  });

  describe('M1 — per-turn promotion cadence', () => {
    /** One leveling turn's worth of awards for roster slot 0. */
    const levelSlot0 = (level: number) => [
      { unitId: 1, rosterIndex: 0, damageDealt: 0, xpGained: xpToNext(level) },
    ];

    it('a mid-encounter level-up pauses on promotion, then dismiss rolls the next turn', () => {
      const { run, bus } = freshLvl1RunWithBus(1);
      run.dispatch({ kind: 'enterNode', nodeId: frontierOf(run) });
      const promotions: number[][] = [];
      bus.on('promotion:pending', ({ promotions: p }) =>
        promotions.push(p.map((x) => x.rosterIndex)),
      );
      chipTurn(bus, { player: 1, enemy: 0 }, levelSlot0(1));
      // Promoted at the boundary while the encounter is still live.
      expect(run.phase).toBe('promotion');
      expect(promotions).toEqual([[0]]);
      expect(run.team[0]!.level).toBe(2);
      expect(run.encounterMap).not.toBeNull();
      run.dispatch({ kind: 'dismissPromotion' });
      // Headless: dismissal re-enters the encounter loop — next turn is live.
      expect(run.phase).toBe('battle');
      expect(run.currentEncounter).not.toBeNull();
      expect(run.turnIndex).toBe(1);
    });

    it('a multi-turn encounter produces multiple promotion pauses (one per leveling turn)', () => {
      const { run, bus } = freshLvl1RunWithBus(2);
      run.dispatch({ kind: 'enterNode', nodeId: frontierOf(run) });
      const promotions: number[][] = [];
      bus.on('promotion:pending', ({ promotions: p }) =>
        promotions.push(p.map((x) => x.rosterIndex)),
      );
      chipTurn(bus, { player: 1, enemy: 0 }, levelSlot0(1));
      run.dispatch({ kind: 'dismissPromotion' });
      chipTurn(bus, { player: 1, enemy: 0 }, levelSlot0(2));
      run.dispatch({ kind: 'dismissPromotion' });
      // Two separate pauses, two separate level-ups — the pre-M1 model showed
      // exactly ONE PromotionScene per encounter regardless of turn count.
      expect(promotions).toEqual([[0], [0]]);
      expect(run.team[0]!.level).toBe(3);
      expect(run.phase).toBe('battle');
    });

    it('the next turn fields the just-leveled template (full-HP re-field on new stats)', () => {
      const { run, bus } = freshLvl1RunWithBus(3);
      run.dispatch({ kind: 'enterNode', nodeId: frontierOf(run) });
      chipTurn(bus, { player: 1, enemy: 0 }, levelSlot0(1));
      run.dispatch({ kind: 'dismissPromotion' });
      // The 5-unit LVL1 roster fits one hand (≤ handSize), so slot 0 fields
      // every turn. The next turn's encounter embeds the LEVELED template —
      // spawn derives full HP from these stats (the H4 no-attrition re-field).
      const leveled = run.currentEncounter!.playerTeam.filter((u) => u.level === 2);
      expect(leveled).toHaveLength(1);
      expect(leveled[0]!.stats).toEqual(run.team[0]!.stats);
    });

    it('gated: the promotion interposes between turn-outcome and the next turn-intro', () => {
      const { run, bus } = freshLvl1RunWithBus(4);
      run.pauseAtTurnGates = true;
      run.dispatch({ kind: 'enterNode', nodeId: frontierOf(run) });
      const promotionEvents: number[] = [];
      bus.on('promotion:pending', ({ promotions: p }) => promotionEvents.push(p.length));
      expect(run.phase).toBe('turn-intro');
      run.dispatch({ kind: 'advanceTurn' });
      chipTurn(bus, { player: 1, enemy: 0 }, levelSlot0(1));
      // The outcome screen comes FIRST: the level is already banked, but the
      // promotion is stashed across the turn-outcome pause, not yet shown.
      expect(run.phase).toBe('turn-outcome');
      expect(run.team[0]!.level).toBe(2);
      expect(promotionEvents).toHaveLength(0);
      run.dispatch({ kind: 'advanceTurn' });
      expect(run.phase).toBe('promotion');
      expect(promotionEvents).toHaveLength(1);
      run.dispatch({ kind: 'dismissPromotion' });
      expect(run.phase).toBe('turn-intro'); // the NEXT turn's gate
    });

    it('a save at turn-outcome keeps the stashed promotion (pops on resume)', () => {
      const { run, bus } = freshLvl1RunWithBus(5);
      run.pauseAtTurnGates = true;
      run.dispatch({ kind: 'enterNode', nodeId: frontierOf(run) });
      run.dispatch({ kind: 'advanceTurn' });
      chipTurn(bus, { player: 1, enemy: 0 }, levelSlot0(1));
      expect(run.phase).toBe('turn-outcome');
      const restored = Run.fromJSON(run.toJSON(), new EventBus<GameEvents>());
      expect(restored.pendingPromotions).toEqual(run.pendingPromotions);
      // `pauseAtTurnGates` is deliberately not persisted, but the stashed
      // promotion still pops on the resume's advance — gates or not.
      restored.dispatch({ kind: 'advanceTurn' });
      expect(restored.phase).toBe('promotion');
    });

    it('round-trips a save taken at the mid-encounter promotion pause (v17)', () => {
      const { run, bus } = freshLvl1RunWithBus(6);
      run.dispatch({ kind: 'enterNode', nodeId: frontierOf(run) });
      chipTurn(bus, { player: 1, enemy: 0 }, levelSlot0(1));
      expect(run.phase).toBe('promotion');
      const restored = Run.fromJSON(run.toJSON(), new EventBus<GameEvents>());
      expect(restored.phase).toBe('promotion');
      expect(restored.pendingPromotions).toEqual(run.pendingPromotions);
      expect(restored.encounterMap).toEqual(run.encounterMap);
      restored.dispatch({ kind: 'dismissPromotion' });
      // The restored dismiss re-enters the encounter loop, not the map.
      expect(restored.phase).toBe('battle');
    });

    it('per-turn banking is deterministic (same seed → byte-identical snapshots)', () => {
      const snapshotFor = (): string => {
        const { run, bus } = freshLvl1RunWithBus(13);
        run.dispatch({ kind: 'enterNode', nodeId: frontierOf(run) });
        chipTurn(bus, { player: 1, enemy: 0 }, levelSlot0(1));
        run.dispatch({ kind: 'dismissPromotion' });
        chipTurn(bus, { player: 1, enemy: 0 }, levelSlot0(2));
        run.dispatch({ kind: 'dismissPromotion' });
        return JSON.stringify(run.toJSON());
      };
      expect(snapshotFor()).toBe(snapshotFor());
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

  describe('redraw at the pre-turn gate (K3)', () => {
    it('discards the selected positions and refills them in place from the draw pile', () => {
      const { run } = gatedToFirstTurnIntro(1);
      // K2 default: roster (10) > handSize (6), so the draw pile holds the rest.
      expect(run.hand).toHaveLength(Math.min(DECK.handSize, run.team.length));
      const before = run.hand.slice();
      const pile = run.drawPile.slice();
      // Deliberately unsorted: positions refill in ASCENDING hand order
      // whatever the dispatch order, so 1 gets the pile top, 3 the next.
      run.dispatch({ kind: 'redrawCards', handIndices: [3, 1] });
      expect(run.hand).toHaveLength(before.length);
      expect(run.hand[1]).toBe(pile[pile.length - 1]);
      expect(run.hand[3]).toBe(pile[pile.length - 2]);
      before.forEach((card, i) => {
        if (i !== 1 && i !== 3) expect(run.hand[i]).toBe(card);
      });
      expect(run.discardPile).toEqual(expect.arrayContaining([before[1]!, before[3]!]));
    });

    it('consumes the budget; a request past either dial is a silent no-op', () => {
      const { run } = gatedToFirstTurnIntro(2);
      // Burn the budget with single-card actions, bounds derived from config.
      // After min(redrawsPerTurn, maxCardsPerTurn) one-card actions, ONE of the
      // two dials is exhausted for any further ask — whichever is smaller.
      const actions = Math.min(DECK.redraw.redrawsPerTurn, DECK.redraw.maxCardsPerTurn);
      for (let i = 0; i < actions; i++) {
        run.dispatch({ kind: 'redrawCards', handIndices: [0] });
      }
      expect(run.redrawsUsedThisTurn).toBe(actions);
      expect(run.cardsRedrawnThisTurn).toBe(actions);
      const hand = run.hand.slice();
      run.dispatch({ kind: 'redrawCards', handIndices: [0] });
      expect(run.hand).toEqual(hand);
      expect(run.redrawsUsedThisTurn).toBe(actions);
    });

    it('a rejected selection consumes no budget, mutates nothing, emits nothing', () => {
      const { run, bus } = gatedToFirstTurnIntro(3);
      let emits = 0;
      bus.on('turn:handRedrawn', () => emits++);
      const hand = run.hand.slice();
      run.dispatch({ kind: 'redrawCards', handIndices: [] }); // empty
      run.dispatch({ kind: 'redrawCards', handIndices: [0, 0] }); // duplicate
      run.dispatch({ kind: 'redrawCards', handIndices: [run.hand.length] }); // range
      expect(run.hand).toEqual(hand);
      expect(run.redrawsUsedThisTurn).toBe(0);
      expect(run.cardsRedrawnThisTurn).toBe(0);
      expect(emits).toBe(0);
    });

    it('is a no-op outside the pre-turn gate (map phase, headless battle)', () => {
      const { run } = freshRunWithBus(4, { daemon: K_DEFAULT_DAEMON });
      run.dispatch({ kind: 'redrawCards', handIndices: [0] }); // map
      expect(run.redrawsUsedThisTurn).toBe(0);
      run.dispatch({ kind: 'enterNode', nodeId: frontierOf(run) }); // gates off → battle
      expect(run.phase).toBe('battle');
      const hand = run.hand.slice();
      run.dispatch({ kind: 'redrawCards', handIndices: [0] });
      expect(run.hand).toEqual(hand);
      expect(run.redrawsUsedThisTurn).toBe(0);
    });

    it('the budget resets at the next turn', () => {
      const { run, bus } = gatedToFirstTurnIntro(5);
      run.dispatch({ kind: 'redrawCards', handIndices: [0] });
      expect(run.redrawsUsedThisTurn).toBe(1);
      run.dispatch({ kind: 'advanceTurn' }); // → battle
      chipTurn(bus, { player: 1, enemy: 1 }); // sub-lethal → ongoing
      run.dispatch({ kind: 'advanceTurn' }); // → next turn's gate
      expect(run.phase).toBe('turn-intro');
      expect(run.redrawsUsedThisTurn).toBe(0);
      expect(run.cardsRedrawnThisTurn).toBe(0);
    });

    it('turn:starting carries the fresh availability; turn:handRedrawn the new hand + decrement', () => {
      const { run, bus } = freshRunWithBus(6, { daemon: K_DEFAULT_DAEMON });
      run.pauseAtTurnGates = true;
      const startings: GameEvents['turn:starting'][] = [];
      const redrawns: GameEvents['turn:handRedrawn'][] = [];
      bus.on('turn:starting', (p) => startings.push(p));
      bus.on('turn:handRedrawn', (p) => redrawns.push(p));
      run.dispatch({ kind: 'enterNode', nodeId: frontierOf(run) });
      // Fresh budget straight off the fixture daemon's dials (= the config dials).
      expect(startings[0]!.redraw).toEqual({
        redrawsRemaining: DECK.redraw.redrawsPerTurn,
        cardsRemaining: DECK.redraw.maxCardsPerTurn,
      });
      run.dispatch({ kind: 'redrawCards', handIndices: [0, 2] });
      expect(redrawns).toHaveLength(1);
      expect(redrawns[0]!.hand).toEqual(run.hand.map((idx) => run.team[idx]!));
      expect(redrawns[0]!.redraw).toEqual(run.redrawAvailability);
      expect(redrawns[0]!.redraw.cardsRemaining).toBe(DECK.redraw.maxCardsPerTurn - 2);
    });

    it('a redrawn-away unit accrues no deployment count; its replacement is counted', () => {
      const { run } = gatedToFirstTurnIntro(7);
      expect(run.drawPile.length).toBeGreaterThan(0); // replacement ≠ benched below
      const benched = run.hand[0]!;
      run.dispatch({ kind: 'redrawCards', handIndices: [0] });
      const replacement = run.hand[0]!;
      expect(replacement).not.toBe(benched);
      // Still eligible to be drawn — and then counted — on a LATER turn.
      expect(run.discardPile).toContain(benched);
      run.dispatch({ kind: 'advanceTurn' }); // beginTurn records the FINAL hand
      expect(run.deploymentCounts[benched]).toBe(0);
      expect(run.deploymentCounts[replacement]).toBe(1);
    });

    it('redrawing past the draw pile recycles the discard: hand size + roster partition hold', () => {
      const { run } = gatedToFirstTurnIntro(8);
      const sel = run.hand
        .map((_, i) => i)
        .slice(0, Math.min(run.hand.length, DECK.redraw.maxCardsPerTurn));
      expect(sel.length).toBeGreaterThan(run.drawPile.length); // forces the reshuffle
      run.dispatch({ kind: 'redrawCards', handIndices: sel });
      expect(run.hand).toHaveLength(Math.min(DECK.handSize, run.team.length));
      expect(new Set(run.hand).size).toBe(run.hand.length);
      // hand + piles still partition the roster exactly.
      const partition = [...run.hand, ...run.drawPile, ...run.discardPile].sort((a, b) => a - b);
      expect(partition).toEqual(run.team.map((_, i) => i));
    });

    it('same seed + same redraw dispatches stay byte-identical', () => {
      const a = gatedToFirstTurnIntro(9);
      const b = gatedToFirstTurnIntro(9);
      for (const { run } of [a, b]) {
        run.dispatch({ kind: 'redrawCards', handIndices: [4, 0] });
        run.dispatch({ kind: 'advanceTurn' });
      }
      expect(JSON.parse(JSON.stringify(a.run.toJSON()))).toEqual(
        JSON.parse(JSON.stringify(b.run.toJSON())),
      );
    });

    it('round-trips the redraw counters (a save at the gate must not refresh the budget)', () => {
      const { run } = gatedToFirstTurnIntro(10);
      run.dispatch({ kind: 'redrawCards', handIndices: [1] });
      const wire = JSON.parse(JSON.stringify(run.toJSON()));
      const restored = Run.fromJSON(wire, new EventBus<GameEvents>());
      expect(restored.phase).toBe('turn-intro');
      expect(restored.hand).toEqual(run.hand);
      expect(restored.redrawsUsedThisTurn).toBe(run.redrawsUsedThisTurn);
      expect(restored.cardsRedrawnThisTurn).toBe(run.cardsRedrawnThisTurn);
      expect(restored.redrawAvailability).toEqual(run.redrawAvailability);
      // (The pre-K3 v12 reject rides the generic `schemaVersion - 1` test.)
    });
  });

  describe('empower at the pre-turn gate (K4)', () => {
    it('adds the configured buff to the slot store; the fielded unit carries it that turn', () => {
      const { run } = gatedToFirstTurnIntro(1);
      const pos = 2;
      const slot = run.hand[pos]!;
      run.dispatch({ kind: 'empowerUnit', handIndex: pos });
      const stored = run.encounterEffects[slot]!;
      expect(stored).toHaveLength(1);
      expect(stored[0]).toEqual({
        key: EMPOWER.buff.key,
        magnitude: 1,
        mods: EMPOWER.buff.mods,
        lifetime: { kind: 'endOfTurn' },
        merge: EMPOWER.buff.merge,
      });
      run.dispatch({ kind: 'advanceTurn' }); // → battle, beginTurn seeds the buff
      const fielded = run.currentEncounter!.playerTeam.find((t) => t.rosterIndex === slot)!;
      const seeded = fielded.effects!.find((e) => e.key === EMPOWER.buff.key)!;
      expect(seeded.mods).toEqual(EMPOWER.buff.mods);
      // End-to-end: the fold yields the config buff on every modified stat
      // (expectation derived from the config mods, not hardcoded numbers).
      const folded = foldEffects(fielded.stats, fielded.effects!);
      for (const [stat, mod] of Object.entries(EMPOWER.buff.mods)) {
        const key = stat as keyof typeof fielded.stats;
        const expected = Math.round((fielded.stats[key] + (mod.add ?? 0)) * (mod.mul ?? 1));
        expect(folded[key]).toBe(expected);
      }
    });

    it('consumes the budget; a request past the dial is a silent no-op', () => {
      const { run, bus } = gatedToFirstTurnIntro(2);
      let emits = 0;
      bus.on('turn:unitEmpowered', () => emits++);
      // Burn the budget, bound derived from config.
      for (let i = 0; i < EMPOWER.empowersPerTurn; i++) {
        run.dispatch({ kind: 'empowerUnit', handIndex: 0 });
      }
      expect(run.empowersUsedThisTurn).toBe(EMPOWER.empowersPerTurn);
      expect(emits).toBe(EMPOWER.empowersPerTurn);
      const stored = run.encounterEffects[run.hand[0]!]!.map((e) => ({ ...e }));
      run.dispatch({ kind: 'empowerUnit', handIndex: 0 });
      expect(run.empowersUsedThisTurn).toBe(EMPOWER.empowersPerTurn);
      expect(emits).toBe(EMPOWER.empowersPerTurn);
      expect(run.encounterEffects[run.hand[0]!]).toMatchObject(stored);
    });

    it('a rejected request consumes no budget, mutates nothing, emits nothing', () => {
      const { run, bus } = gatedToFirstTurnIntro(3);
      let emits = 0;
      bus.on('turn:unitEmpowered', () => emits++);
      run.dispatch({ kind: 'empowerUnit', handIndex: run.hand.length }); // range
      run.dispatch({ kind: 'empowerUnit', handIndex: -1 }); // negative
      run.dispatch({ kind: 'empowerUnit', handIndex: 0.5 }); // non-integer
      expect(run.empowersUsedThisTurn).toBe(0);
      expect(run.encounterEffects.every((slot) => slot.length === 0)).toBe(true);
      expect(emits).toBe(0);
    });

    it('is a no-op outside the pre-turn gate (map phase, headless battle)', () => {
      const { run } = freshRunWithBus(4, { daemon: K_DEFAULT_DAEMON });
      run.dispatch({ kind: 'empowerUnit', handIndex: 0 }); // map
      expect(run.empowersUsedThisTurn).toBe(0);
      run.dispatch({ kind: 'enterNode', nodeId: frontierOf(run) }); // gates off → battle
      expect(run.phase).toBe('battle');
      run.dispatch({ kind: 'empowerUnit', handIndex: 0 });
      expect(run.empowersUsedThisTurn).toBe(0);
      expect(run.encounterEffects.every((slot) => slot.length === 0)).toBe(true);
    });

    it('the budget resets next turn; re-empowering the same unit merges per the config policy', () => {
      // Short roster (≤ handSize) so the SAME unit is in hand every turn —
      // the stacking path needs a deterministic re-pick across turns.
      const { run, bus } = freshShortRosterRun(5, { daemon: K_DEFAULT_DAEMON });
      run.pauseAtTurnGates = true;
      const startings: GameEvents['turn:starting'][] = [];
      bus.on('turn:starting', (p) => startings.push(p));
      run.dispatch({ kind: 'enterNode', nodeId: frontierOf(run) });
      const slot = run.hand[0]!;
      run.dispatch({ kind: 'empowerUnit', handIndex: 0 });
      run.dispatch({ kind: 'advanceTurn' }); // → battle
      chipTurn(bus, { player: 1, enemy: 1 }); // sub-lethal → ongoing
      run.dispatch({ kind: 'advanceTurn' }); // → next turn's gate
      expect(run.phase).toBe('turn-intro');
      expect(run.empowersUsedThisTurn).toBe(0);
      // The turn-2 pre-turn payload already badges the carried buff (the
      // "empowered on an earlier turn, drawn back" pin).
      const pos2 = run.hand.indexOf(slot);
      expect(pos2).toBeGreaterThanOrEqual(0); // short roster: always in hand
      expect(startings[1]!.empowerMagnitudes[pos2]).toBe(1);
      run.dispatch({ kind: 'empowerUnit', handIndex: pos2 });
      const stored = run.encounterEffects[slot]!;
      expect(stored).toHaveLength(1);
      // Expectation derived from the config merge policy (K1 magnitude math).
      expect(stored[0]!.magnitude).toBe(combineMagnitude(EMPOWER.buff.merge, 1, 1));
    });

    it('the buff lives on the SLOT: it survives the card being redrawn away', () => {
      const { run, bus } = gatedToFirstTurnIntro(6);
      expect(run.drawPile.length).toBeGreaterThan(0); // replacement ≠ benched below
      const redrawns: GameEvents['turn:handRedrawn'][] = [];
      bus.on('turn:handRedrawn', (p) => redrawns.push(p));
      const benched = run.hand[0]!;
      run.dispatch({ kind: 'empowerUnit', handIndex: 0 });
      run.dispatch({ kind: 'redrawCards', handIndices: [0] });
      expect(run.hand[0]).not.toBe(benched);
      // The store keeps the buff; the badge column re-derived for the NEW hand.
      expect(run.encounterEffects[benched]!.some((e) => e.key === EMPOWER.buff.key)).toBe(true);
      expect(redrawns[0]!.empowerMagnitudes[0]).toBe(0);
      run.dispatch({ kind: 'advanceTurn' }); // beginTurn fields the FINAL hand
      expect(run.currentEncounter!.playerTeam.some((t) => t.rosterIndex === benched)).toBe(false);
      expect(run.encounterEffects[benched]!.some((e) => e.key === EMPOWER.buff.key)).toBe(true);
    });

    it('turn:starting carries the fresh availability; turn:unitEmpowered the decrement + badge column', () => {
      const { run, bus } = freshRunWithBus(7, { daemon: K_DEFAULT_DAEMON });
      run.pauseAtTurnGates = true;
      const startings: GameEvents['turn:starting'][] = [];
      const empowereds: GameEvents['turn:unitEmpowered'][] = [];
      bus.on('turn:starting', (p) => startings.push(p));
      bus.on('turn:unitEmpowered', (p) => empowereds.push(p));
      run.dispatch({ kind: 'enterNode', nodeId: frontierOf(run) });
      // Fresh budget straight off the fixture daemon's dial (= the config dial).
      expect(startings[0]!.empower).toEqual({
        empowersRemaining: EMPOWER.empowersPerTurn,
      });
      expect(startings[0]!.empowerMagnitudes).toEqual(run.hand.map(() => 0));
      run.dispatch({ kind: 'empowerUnit', handIndex: 1 });
      expect(empowereds).toHaveLength(1);
      expect(empowereds[0]!.handIndex).toBe(1);
      expect(empowereds[0]!.empower).toEqual(run.empowerAvailability);
      expect(empowereds[0]!.empower.empowersRemaining).toBe(EMPOWER.empowersPerTurn - 1);
      expect(empowereds[0]!.empowerMagnitudes).toEqual(
        run.hand.map((_, i) => (i === 1 ? 1 : 0)),
      );
    });

    it('same seed + same empower dispatches stay byte-identical', () => {
      const a = gatedToFirstTurnIntro(8);
      const b = gatedToFirstTurnIntro(8);
      for (const { run } of [a, b]) {
        run.dispatch({ kind: 'empowerUnit', handIndex: 3 });
        run.dispatch({ kind: 'advanceTurn' });
      }
      expect(JSON.parse(JSON.stringify(a.run.toJSON()))).toEqual(
        JSON.parse(JSON.stringify(b.run.toJSON())),
      );
    });

    it('round-trips the empower counter (a save at the gate must not refresh the budget)', () => {
      const { run } = gatedToFirstTurnIntro(9);
      run.dispatch({ kind: 'empowerUnit', handIndex: 0 });
      const wire = JSON.parse(JSON.stringify(run.toJSON()));
      const restored = Run.fromJSON(wire, new EventBus<GameEvents>());
      expect(restored.phase).toBe('turn-intro');
      expect(restored.empowersUsedThisTurn).toBe(run.empowersUsedThisTurn);
      expect(restored.empowerAvailability).toEqual(run.empowerAvailability);
      // The buff itself rides the K1 v12 `encounterEffects` round-trip.
      expect(restored.encounterEffects).toEqual(run.encounterEffects);
      // (The pre-K4 v14 reject rides the generic `schemaVersion - 1` test.)
    });
  });

  describe('daemons (L1 — daemon-only gates)', () => {
    it('rolls exactly one daemon at construction, deterministically per seed', () => {
      const a = freshRunWithBus(21).run;
      const b = freshRunWithBus(21).run;
      expect(a.daemon).not.toBeNull();
      expect(a.daemon!.id).toBe(b.daemon!.id);
    });

    it('covers the whole catalog over seeds', () => {
      const seen = new Set<string>();
      for (let seed = 0; seed < 60; seed++) seen.add(freshRunWithBus(seed).run.daemon!.id);
      expect([...seen].sort()).toEqual(DAEMONS.map((d) => d.id).sort());
    });

    it('RunConfig.daemon forces the daemon; null forces daemon-less', () => {
      expect(freshRunWithBus(1, { daemon: daemonById('mars')! }).run.daemon!.id).toBe('mars');
      expect(freshRunWithBus(1, { daemon: null }).run.daemon).toBeNull();
    });

    it('daemon-less: both gates read 0 at the gate and both commands are no-ops', () => {
      const { run } = gatedToFirstTurnIntro(22, null);
      expect(run.redrawAvailability).toEqual({ redrawsRemaining: 0, cardsRemaining: 0 });
      expect(run.empowerAvailability).toEqual({ empowersRemaining: 0 });
      const hand = run.hand.slice();
      run.dispatch({ kind: 'redrawCards', handIndices: [0] });
      run.dispatch({ kind: 'empowerUnit', handIndex: 0 });
      expect(run.hand).toEqual(hand);
      expect(run.redrawsUsedThisTurn).toBe(0);
      expect(run.empowersUsedThisTurn).toBe(0);
      expect(run.encounterEffects.every((slot) => slot.length === 0)).toBe(true);
    });

    it('an empower idol (mars) grants empower per its dials and NO redraw', () => {
      const mars = daemonById('mars')!;
      const { run } = gatedToFirstTurnIntro(23, mars);
      expect(run.empowerAvailability.empowersRemaining).toBe(mars.empower!.empowersPerTurn);
      expect(run.redrawAvailability).toEqual({ redrawsRemaining: 0, cardsRemaining: 0 });
      const hand = run.hand.slice();
      run.dispatch({ kind: 'redrawCards', handIndices: [0] });
      expect(run.hand).toEqual(hand); // no redraw under mars
      const slot = run.hand[1]!;
      run.dispatch({ kind: 'empowerUnit', handIndex: 1 });
      const stored = run.encounterEffects[slot]!;
      expect(stored).toHaveLength(1);
      expect(stored[0]!.key).toBe(mars.empower!.buff.key);
      expect(stored[0]!.mods).toEqual(mars.empower!.buff.mods);
    });

    it("minerva applies HER buff (the daemon's own, not a shared config)", () => {
      const minerva = daemonById('minerva')!;
      const { run } = gatedToFirstTurnIntro(24, minerva);
      const slot = run.hand[0]!;
      run.dispatch({ kind: 'empowerUnit', handIndex: 0 });
      const stored = run.encounterEffects[slot]!;
      expect(stored[0]!.key).toBe(minerva.empower!.buff.key);
      expect(stored[0]!.mods).toEqual(minerva.empower!.buff.mods);
      expect(stored[0]!.key).not.toBe(daemonById('mars')!.empower!.buff.key);
    });

    it('a redraw idol (janus) grants redraw capped by its dial and NO empower', () => {
      const janus = daemonById('janus')!;
      const { run } = gatedToFirstTurnIntro(25, janus);
      const cap = janus.redraw!.maxCardsPerTurn;
      expect(run.redrawAvailability).toEqual({
        redrawsRemaining: janus.redraw!.redrawsPerTurn,
        cardsRemaining: cap,
      });
      expect(run.empowerAvailability.empowersRemaining).toBe(0);
      const hand = run.hand.slice();
      // One past the cap → silent no-op; at the cap → lands.
      run.dispatch({
        kind: 'redrawCards',
        handIndices: hand.map((_, i) => i).slice(0, cap + 1),
      });
      expect(run.hand).toEqual(hand);
      run.dispatch({ kind: 'redrawCards', handIndices: hand.map((_, i) => i).slice(0, cap) });
      expect(run.cardsRedrawnThisTurn).toBe(cap);
      run.dispatch({ kind: 'empowerUnit', handIndex: 0 });
      expect(run.encounterEffects.every((slot) => slot.length === 0)).toBe(true);
    });

    it("mercury's coin flips per turn, deterministically per seed, and lands both ways", () => {
      const mercury = daemonById('mercury')!;
      const grantsOf = (seed: number): boolean[] => {
        const { run, bus } = gatedToFirstTurnIntro(seed, mercury);
        const grants: boolean[] = [];
        for (let t = 0; t < 6 && run.phase === 'turn-intro'; t++) {
          grants.push(run.redrawAvailability.redrawsRemaining > 0);
          run.dispatch({ kind: 'advanceTurn' }); // → battle
          chipTurn(bus, { player: 1, enemy: 1 }); // sub-lethal → ongoing
          run.dispatch({ kind: 'advanceTurn' }); // → next turn's gate
        }
        return grants;
      };
      let mixed: number | null = null;
      for (let seed = 30; seed < 60 && mixed === null; seed++) {
        const grants = grantsOf(seed);
        if (grants.includes(true) && grants.includes(false)) mixed = seed;
      }
      expect(mixed).not.toBeNull(); // a 6-turn all-same streak across 30 seeds ≈ impossible
      expect(grantsOf(mixed!)).toEqual(grantsOf(mixed!)); // per-seed deterministic
    });

    it('turn:starting carries the daemon identity + gate shape (and null for daemon-less)', () => {
      const mars = daemonById('mars')!;
      for (const [daemon, expected] of [
        [
          mars,
          {
            id: mars.id,
            name: mars.name,
            description: mars.description,
            // L1c2 — gate presence + the daemon's OWN buff, derived from the
            // catalog entry (mars is empower-only).
            redrawGate: false,
            empowerGate: true,
            empowerBuff: mars.empower!.buff.mods,
          },
        ],
        [null, null],
      ] as const) {
        const { run, bus } = freshRunWithBus(26, { daemon });
        run.pauseAtTurnGates = true;
        const startings: GameEvents['turn:starting'][] = [];
        bus.on('turn:starting', (p) => startings.push(p));
        run.dispatch({ kind: 'enterNode', nodeId: frontierOf(run) });
        expect(startings[0]!.daemon).toEqual(expected);
      }
    });

    it('v16 round-trips the daemon whole, the stream, and the CURRENT flip', () => {
      const mercury = daemonById('mercury')!;
      const { run, bus } = gatedToFirstTurnIntro(27, mercury);
      const wire = JSON.parse(JSON.stringify(run.toJSON()));
      const busB = new EventBus<GameEvents>();
      const restored = Run.fromJSON(wire, busB);
      // `pauseAtTurnGates` is a DRIVER flag (not snapshotted) — re-arm it so
      // both runs walk the same gated path below.
      restored.pauseAtTurnGates = true;
      // The save's gate state is restored, never re-flipped.
      expect(restored.daemon).toEqual(run.daemon);
      expect(restored.redrawAvailability).toEqual(run.redrawAvailability);
      // The daemonRng round-trips: both runs flip the SAME coins forever after.
      for (const [r, b] of [
        [run, bus],
        [restored, busB],
      ] as const) {
        r.dispatch({ kind: 'advanceTurn' });
        chipTurn(b, { player: 1, enemy: 1 });
        r.dispatch({ kind: 'advanceTurn' });
      }
      expect(restored.redrawAvailability).toEqual(run.redrawAvailability);
      expect(JSON.parse(JSON.stringify(restored.toJSON()))).toEqual(
        JSON.parse(JSON.stringify(run.toJSON())),
      );
    });

    it('a bespoke (non-catalog) daemon round-trips whole', () => {
      const { run } = gatedToFirstTurnIntro(28); // K_DEFAULT_DAEMON, not in DAEMONS
      const wire = JSON.parse(JSON.stringify(run.toJSON()));
      const restored = Run.fromJSON(wire, new EventBus<GameEvents>());
      expect(restored.daemon).toEqual(K_DEFAULT_DAEMON);
      expect(restored.redrawAvailability).toEqual(run.redrawAvailability);
      expect(restored.empowerAvailability).toEqual(run.empowerAvailability);
    });
  });

  describe('encounter map (K3.5 — one battlefield per encounter)', () => {
    it('every turn of an encounter fights on the SAME map; the world seed stays per-turn', () => {
      const { run, bus } = freshRunWithBus(11);
      run.dispatch({ kind: 'enterNode', nodeId: frontierOf(run) });
      const map = { ...run.encounterMap! };
      const turn1 = run.currentEncounter!;
      chipTurn(bus, { player: 1, enemy: 1 }); // sub-lethal → rolls into turn 2
      expect(run.phase).toBe('battle');
      const turn2 = run.currentEncounter!;
      for (const enc of [turn1, turn2]) {
        expect(enc.layoutId).toBe(map.layoutId);
        expect(enc.terrainSeed).toBe(map.terrainSeed);
        expect(enc.gridW).toBe(map.gridW);
        expect(enc.gridH).toBe(map.gridH);
        expect(enc.theme).toBe(map.theme);
      }
      // The per-turn freshness that REMAINS: a new world (units RNG) + wave.
      expect(turn2.worldSeed).not.toBe(turn1.worldSeed);
      expect(run.encounterMap).toEqual(map); // untouched by the turn roll
    });

    it('a NEW encounter rolls a fresh map (per-encounter, not per-run)', () => {
      // Deterministic across seeds: find one where consecutive encounters land
      // on different layouts — proving the roll happens per encounter. (A
      // per-run map would make this loop exhaust without a hit.)
      let differs = false;
      for (let seed = 1; seed <= 40 && !differs; seed++) {
        const { run, bus } = freshRunWithBus(seed);
        run.dispatch({ kind: 'enterNode', nodeId: frontierOf(run) });
        const first = run.encounterMap!.layoutId;
        winEncounter(bus);
        if (run.phase === 'promotion') run.dispatch({ kind: 'dismissPromotion' });
        if (run.phase !== 'recruit') continue;
        run.dispatch({ kind: 'passRecruit' });
        // Widened — dispatch mutates phase, which TS's narrowing can't see.
        const phaseAfterPass: string = run.phase;
        if (phaseAfterPass !== 'map') continue;
        const next = run.nodeMap.edges.find((e) => e.from === run.currentNodeId)?.to;
        if (next === undefined) continue;
        run.dispatch({ kind: 'enterNode', nodeId: next });
        if (run.encounterMap !== null && run.encounterMap.layoutId !== first) differs = true;
      }
      expect(differs).toBe(true);
    });

    it('a forced layout (G1) pins every encounter map', () => {
      const forced = LAYOUT_IDS[0]!;
      const bus = new EventBus<GameEvents>();
      const run = new Run(3, bus, { forcedLayoutId: forced });
      const frontier = run.nodeMap.edges.find((e) => e.from === run.nodeMap.rootId)!.to;
      run.dispatch({ kind: 'enterNode', nodeId: frontier });
      expect(run.encounterMap!.layoutId).toBe(forced);
      expect(run.encounterMap!.gridW).toBe(getLayout(forced)!.gridW);
      expect(run.encounterMap!.gridH).toBe(getLayout(forced)!.gridH);
      expect(run.currentEncounter!.layoutId).toBe(forced);
    });

    it('turn:starting carries the map, identical across the encounter\'s gates', () => {
      const { run, bus } = freshRunWithBus(6);
      run.pauseAtTurnGates = true;
      const startings: GameEvents['turn:starting'][] = [];
      bus.on('turn:starting', (p) => startings.push(p));
      run.dispatch({ kind: 'enterNode', nodeId: frontierOf(run) });
      expect(startings[0]!.map).toEqual({
        layoutId: run.encounterMap!.layoutId,
        gridW: run.encounterMap!.gridW,
        gridH: run.encounterMap!.gridH,
        theme: run.encounterMap!.theme,
      });
      run.dispatch({ kind: 'advanceTurn' }); // → battle
      chipTurn(bus, { player: 1, enemy: 1 }); // ongoing → turn-outcome
      run.dispatch({ kind: 'advanceTurn' }); // → turn 2's gate
      expect(startings).toHaveLength(2);
      expect(startings[1]!.map).toEqual(startings[0]!.map);
    });

    it('the map is encounter-scoped: null before, during the map phase, and after the encounter', () => {
      const { run, bus } = freshRunWithBus(1);
      expect(run.encounterMap).toBeNull();
      run.dispatch({ kind: 'enterNode', nodeId: frontierOf(run) });
      expect(run.encounterMap).not.toBeNull();
      winEncounter(bus);
      expect(run.encounterMap).toBeNull(); // dropped with the encounter
      // The defeat path drops it too.
      const lost = freshRunWithBus(2);
      lost.run.dispatch({ kind: 'enterNode', nodeId: frontierOf(lost.run) });
      chipTurn(lost.bus, { player: 0, enemy: HEALTH.playerHealthMax });
      expect(lost.run.phase).toBe('defeat');
      expect(lost.run.encounterMap).toBeNull();
    });

    it('round-trips the encounter map mid-encounter (v14)', () => {
      const { run, bus } = freshRunWithBus(12);
      run.dispatch({ kind: 'enterNode', nodeId: frontierOf(run) });
      chipTurn(bus, { player: 1, enemy: 2 }); // mid-encounter, turn 2 live
      expect(run.encounterMap).not.toBeNull();
      const wire = JSON.parse(JSON.stringify(run.toJSON()));
      const restored = Run.fromJSON(wire, new EventBus<GameEvents>());
      expect(restored.encounterMap).toEqual(run.encounterMap);
      // (The pre-K3.5 v13 reject rides the generic `schemaVersion - 1` test.)
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
      const { run, bus } = freshShortRosterRun(1); // slot 0 must field every turn (K2)
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
      const { run, bus } = freshShortRosterRun(1); // slot 0 must field every turn (K2)
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
      const { run } = freshShortRosterRun(1); // slot 0 must field this turn (K2)
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
      // Short roster (≤ handSize) so the WHOLE roster fields → every slot 1. K2's
      // default roster (10 > handSize 6) only fields a drawn subset; that subset
      // case is covered by the deck suite below.
      const { run } = freshShortRosterRun(1);
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
      // H5: a one-turn encounter deploys only the drawn hand, so a roster larger
      // than handSize (K2: 10+ > 6) reads 1 for the drawn slots and 0 for the
      // undrawn ones. The load-bearing assertion is that NOTHING accumulated to
      // 2 (the reset worked) and the total deployments equal exactly this
      // encounter's one hand, not a doubled count.
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

function freshRunWithBus(seed: number, config?: RunConfig): RunHandle {
  const bus = new EventBus<GameEvents>();
  const run = new Run(seed, bus, config);
  return { run: Object.assign(run, { rootId: run.nodeMap.rootId }), bus };
}

/** The root's first frontier node — the standard "enter the first battle" hop. */
function frontierOf(run: Run & { rootId: number }): number {
  return run.nodeMap.edges.find((e) => e.from === run.rootId)!.to;
}

/** K3 — a gated run paused at its FIRST pre-turn gate (`turn-intro`), the only
 *  phase where a `redrawCards` command is live. L1: gates are daemon-only now,
 *  so the run carries `K_DEFAULT_DAEMON` (the old static dials) unless a test
 *  forces a specific daemon (or null = daemon-less). */
function gatedToFirstTurnIntro(
  seed: number,
  daemon: DaemonConfig | null = K_DEFAULT_DAEMON,
): RunHandle {
  const handle = freshRunWithBus(seed, { daemon });
  handle.run.pauseAtTurnGates = true;
  handle.run.dispatch({ kind: 'enterNode', nodeId: frontierOf(handle.run) });
  return handle;
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

/** A 5-unit roster at the configured starting level — small enough to fit in
 *  one hand (≤ `DECK.handSize`), so the WHOLE roster is fielded every turn. K2
 *  raised the default roster (10) above `handSize` (6), so a mechanic test that
 *  pins a specific roster slot (e.g. slot 0's fatigue / encounter effect) or
 *  expects EVERY slot deployed can no longer use the default roll — only a
 *  drawn subset fields. These tests force this short roster to keep the pre-K2
 *  "draw == roster" precondition deterministic (no dependence on which units a
 *  given seed happens to draw). Level comes from config (not the K2 subject). */
const SHORT_ROSTER = [
  { archetype: 'mercenary' as const, level: RECRUITMENT.startingLevel },
  { archetype: 'mercenary' as const, level: RECRUITMENT.startingLevel },
  { archetype: 'mercenary' as const, level: RECRUITMENT.startingLevel },
  { archetype: 'ranged' as const, level: RECRUITMENT.startingLevel },
  { archetype: 'ranged' as const, level: RECRUITMENT.startingLevel },
];
function freshShortRosterRun(seed: number, config?: RunConfig): RunHandle {
  const bus = new EventBus<GameEvents>();
  const run = new Run(seed, bus, { startingRoster: SHORT_ROSTER, ...config });
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
