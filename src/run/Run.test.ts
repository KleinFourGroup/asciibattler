import { describe, it, expect, afterEach } from 'vitest';
import { Run } from './Run';
import { PRE_ROOT_NODE_ID } from './NodeMap';
import { fatigueEffect, FATIGUE_KEY } from './fatigue';
import { foldEffects, combineMagnitude, type StatusEffect } from '../sim/statusEffects';
import { EventBus } from '../core/EventBus';
import { LAYOUT_IDS, THEMES, getLayout } from '../sim/layouts';
import { getSector, PROCEDURAL_LAYOUT_ID } from '../config/sectors';
import { getEncounter, ENCOUNTERS } from '../config/encounters';
import { SectorMapSchema } from '../config/sectorMap';
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
import { rewardTableById } from '../config/rewards';
import { daemonRedrawHook, daemonEmpowerHook } from './daemon';
import { RUN_STAT_BASES } from './runStats';
import { ECONOMY } from '../config/economy';
import { avgTeamLevel } from './enemyBudget';
import { FORCE_PROCEDURAL, type RunConfig } from './RunConfig';

/**
 * L1→47c — the K3/K4 static defaults reborn as a guaranteed fixture daemon.
 * Daemon-only gates retired the `DECK.redraw.enabled` / `EMPOWER.enabled`
 * statics (both now ship false), so the pre-existing K3/K4 gate-mechanic tests
 * run under this daemon instead: its knobs ARE the config dials (derived, not
 * hardcoded), which keeps every `DECK.redraw.*` / `EMPOWER.*`-derived
 * expectation in those blocks literally true. 47c: authored as `rules`
 * (redraw hook FIRST — the fixed draw-order discipline).
 */
const K_DEFAULT_DAEMON: DaemonConfig = {
  id: 'test-k-defaults',
  name: 'Test K Defaults',
  description: 'the pre-L static gates as a daemon',
  rules: [
    {
      kind: 'hook',
      on: 'turnStart',
      effect: {
        op: 'grantRedraws',
        redrawsPerTurn: DECK.redraw.redrawsPerTurn,
        maxCardsPerTurn: DECK.redraw.maxCardsPerTurn,
      },
    },
    {
      kind: 'hook',
      on: 'turnStart',
      effect: {
        op: 'grantEmpowers',
        empowersPerTurn: EMPOWER.empowersPerTurn,
        buff: EMPOWER.buff,
      },
    },
  ],
};

describe('Run', () => {
  describe('initial state', () => {
    it('starts in map phase at the pre-root position (root is the first frontier)', () => {
      const run = new Run(1, new EventBus<GameEvents>());
      expect(run.phase).toBe('map');
      // S2 — the run begins at the virtual pre-root; the root is selected as the
      // first encounter rather than being the inert starting cell.
      expect(run.currentNodeId).toBe(PRE_ROOT_NODE_ID);
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

  describe('S2 — selectable root node', () => {
    it('the root is the sole initial frontier (a root child is not yet selectable)', () => {
      const { run } = freshRunWithBus(1);
      const rootChild = run.nodeMap.edges.find((e) => e.from === run.nodeMap.rootId)!.to;
      // A root child is one hop too far from the pre-root start — ignored.
      run.dispatch({ kind: 'enterNode', nodeId: rootChild });
      expect(run.phase).toBe('map');
      expect(run.currentNodeId).toBe(PRE_ROOT_NODE_ID);
      // The root itself IS selectable and starts its battle.
      run.dispatch({ kind: 'enterNode', nodeId: run.nodeMap.rootId });
      expect(run.phase).toBe('battle');
      expect(run.currentNodeId).toBe(run.nodeMap.rootId);
      expect(run.currentEncounter).not.toBeNull();
    });

    it('the root is a normal battle node at hop 0 (not a boss) on a multi-hop map', () => {
      const { run } = freshRunWithBus(1);
      const rootNode = run.nodeMap.nodes.find((n) => n.id === run.nodeMap.rootId)!;
      expect(rootNode.kind).toBe('battle');
      expect(rootNode.hop).toBe(0);
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
      const frontier = frontierOf(a.run);
      a.run.dispatch({ kind: 'enterNode', nodeId: frontier });
      b.run.dispatch({ kind: 'enterNode', nodeId: frontier });
      expect(a.run.currentEncounter).toEqual(b.run.currentEncounter);
    });
  });

  describe('X1 — per-run difficulty multipliers (RunConfig seam → wave resolver)', () => {
    function firstEnemyTeam(seed: number, config?: RunConfig) {
      const { run } = freshRunWithBus(seed, config);
      run.dispatch({ kind: 'enterNode', nodeId: frontierOf(run) });
      return run.currentEncounter!.enemyTeam;
    }

    it('a waveSizeMultiplier override flows through to the resolved enemy COUNT', () => {
      // Same seed → identical encounter + map; only the lever differs. A 6× span
      // is robustly strictly-greater whatever encounter the root rolls.
      const small = firstEnemyTeam(7, { waveSizeMultiplier: 0.5 });
      const large = firstEnemyTeam(7, { waveSizeMultiplier: 3 });
      expect(large.length).toBeGreaterThan(small.length);
    });

    it('an explicit 1.0 override ≡ no override (the difficulty.json default fallback)', () => {
      // Proves the resolve fallback AND that both fields thread cleanly at 1.0.
      expect(firstEnemyTeam(7, { waveSizeMultiplier: 1, levelBudgetMultiplier: 1 })).toEqual(
        firstEnemyTeam(7),
      );
    });
  });

  describe('enterNode command', () => {
    it('transitions to battle phase on a frontier hop', () => {
      const { run } = freshRunWithBus(1);
      const frontier = frontierOf(run);
      run.dispatch({ kind: 'enterNode', nodeId: frontier });
      expect(run.phase).toBe('battle');
      expect(run.currentNodeId).toBe(frontier);
    });

    it('emits battle:started with the encounter worldSeed', () => {
      const { run, bus } = freshRunWithBus(1);
      const frontier = frontierOf(run);
      const seeds: number[] = [];
      bus.on('battle:started', ({ worldSeed }) => seeds.push(worldSeed));
      run.dispatch({ kind: 'enterNode', nodeId: frontier });
      expect(seeds).toHaveLength(1);
      expect(seeds[0]).toBe(run.currentEncounter!.worldSeed);
    });

    it('builds an encounter snapshot whose hand is drawn from the roster (H5)', () => {
      const { run } = freshRunWithBus(1);
      const frontier = frontierOf(run);
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
      // The hop-linear ramp is gone — enemies now share a level budget
      // derived from the player roster. The integration assertion here is
      // that every enemy is ≤ the per-unit cap and its stats come from the
      // canonical `scaleStats` build (the budget math itself is unit-tested
      // in enemyBudget.test.ts). Cap + stats derive from live config.
      const { run } = freshRunWithBus(1);
      const first = frontierOf(run);
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
      expect(run.currentNodeId).toBe(PRE_ROOT_NODE_ID);
      expect(run.currentEncounter).toBeNull();
    });

    it('ignores enterNode when not in map phase', () => {
      const { run } = freshRunWithBus(1);
      const frontier = frontierOf(run);
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
      // Sample many seeds — T2: procedural boards inherit the sector theme,
      // hand-authored layouts pin to layout.theme. Both paths must produce
      // valid Theme values.
      for (let seed = 1; seed <= 60; seed++) {
        const { run } = freshRunWithBus(seed);
        const frontier = frontierOf(run);
        run.dispatch({ kind: 'enterNode', nodeId: frontier });
        expect(THEMES).toContain(run.currentEncounter!.theme);
      }
    });

    it('D8: hand-authored encounters use the layout-declared theme', () => {
      // For every seed that lands on a layout (rather than procedural),
      // run.currentEncounter.theme must equal the layout's declared theme
      // — a hand-authored board keeps its own theme regardless of the sector.
      let layoutHits = 0;
      for (let seed = 1; seed <= 60; seed++) {
        const { run } = freshRunWithBus(seed);
        const frontier = frontierOf(run);
        run.dispatch({ kind: 'enterNode', nodeId: frontier });
        const enc = run.currentEncounter!;
        if (enc.layoutId === null) continue;
        layoutHits++;
        expect(enc.theme).toBe(getLayout(enc.layoutId)!.theme);
      }
      // Sanity — we hit the layout branch at least sometimes (~75% of 60).
      expect(layoutHits).toBeGreaterThan(0);
    });

    it('T2: procedural encounters inherit the current sector theme', () => {
      // T2 replaced the per-battle theme roll with the SECTOR's theme: every
      // procedural board in "The Start" paints that sector's theme. Derive the
      // expected value from config (never hardcode the authored theme).
      const sectorTheme = getSector('the-start')!.theme;
      let proceduralHits = 0;
      for (let seed = 1; seed <= 200; seed++) {
        const { run } = freshRunWithBus(seed);
        const frontier = frontierOf(run);
        run.dispatch({ kind: 'enterNode', nodeId: frontier });
        const enc = run.currentEncounter!;
        if (enc.layoutId === null) {
          proceduralHits++;
          expect(enc.theme).toBe(sectorTheme);
        }
      }
      expect(proceduralHits).toBeGreaterThan(0); // sanity: procedural branch fired
    });

    it('encounter layoutId is null OR a sector-pool layout (T2 weighted pool)', () => {
      // T2: the board is a WEIGHTED pick over the current sector's pool — the
      // procedural sentinel + every hand-authored layout, each `weight ?? 1`.
      // Confirm both the procedural and named branches fire and stay in LAYOUT_IDS.
      let proceduralCount = 0;
      const layoutCounts = new Map<string, number>();
      for (let seed = 1; seed <= 200; seed++) {
        const { run } = freshRunWithBus(seed);
        const frontier = frontierOf(run);
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
      // Expected procedural share = its pool weight / total pool weight (derived
      // from config — never hardcode the authored weights). Wide ±18 window (well
      // beyond ±3σ for N=200) — the point is to catch outright bias, not the ratio.
      const pool = getSector('the-start')!.layouts;
      const totalWeight = pool.reduce((sum, e) => sum + (e.weight ?? 1), 0);
      const procWeight = pool.find((e) => e.layoutId === PROCEDURAL_LAYOUT_ID)!.weight ?? 1;
      const expectedProcedural = 200 * (procWeight / totalWeight);
      expect(proceduralCount).toBeGreaterThan(expectedProcedural - 18);
      expect(proceduralCount).toBeLessThan(expectedProcedural + 18);
    });

    it('forcedLayoutId = FORCE_PROCEDURAL forces a procedural map every battle', () => {
      // Regardless of what the 25/75 roll would produce, every encounter is
      // procedural (layoutId null) when the `procedural` sentinel is forced.
      for (let seed = 1; seed <= 30; seed++) {
        const { run } = freshRunWithBus(seed, { forcedLayoutId: FORCE_PROCEDURAL });
        const frontier = frontierOf(run);
        run.dispatch({ kind: 'enterNode', nodeId: frontier });
        expect(run.currentEncounter!.layoutId).toBeNull();
      }
    });

    it('forcedLayoutId = a named layout still forces that layout (regression)', () => {
      const { run } = freshRunWithBus(7, { forcedLayoutId: 'river' });
      const frontier = frontierOf(run);
      run.dispatch({ kind: 'enterNode', nodeId: frontier });
      expect(run.currentEncounter!.layoutId).toBe('river');
    });
  });

  describe('handleBattleEnded', () => {
    it('player win → recruit phase with an offer', () => {
      const { run, bus } = freshRunWithBus(1);
      const frontier = frontierOf(run);
      run.dispatch({ kind: 'enterNode', nodeId: frontier });
      winEncounter(bus);
      acceptAllRewards(run); // 48f — the full catalog carries reward refs
      expect(run.phase).toBe('recruit');
      expect(run.currentEncounter).toBeNull();
      expect(run.currentOffer).not.toBeNull();
      expect(run.currentOffer).toHaveLength(3);
    });

    it('emits recruit:offered with the rolled units on victory', () => {
      const { run, bus } = freshRunWithBus(1);
      const frontier = frontierOf(run);
      run.dispatch({ kind: 'enterNode', nodeId: frontier });
      const offers: number[] = [];
      bus.on('recruit:offered', ({ units }) => offers.push(units.length));
      winEncounter(bus);
      acceptAllRewards(run); // 48f — the full catalog carries reward refs
      expect(offers).toEqual([3]);
      expect(run.currentOffer).toHaveLength(3);
    });

    it('enemy win → defeat phase (no recruit)', () => {
      const { run, bus } = freshRunWithBus(1);
      const frontier = frontierOf(run);
      run.dispatch({ kind: 'enterNode', nodeId: frontier });
      loseEncounter(bus);
      expect(run.phase).toBe('defeat');
      expect(run.currentOffer).toBeNull();
    });

    it('emits run:defeated on enemy win', () => {
      const { run, bus } = freshRunWithBus(1);
      const frontier = frontierOf(run);
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

    it('G4: recruit level tracks round(avgTeamLevel) + bonus, not the hop', () => {
      // A leveled starting roster (avg 6) lands at hop 1. Under the old
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
      const frontier = frontierOf(run);
      run.dispatch({ kind: 'enterNode', nodeId: frontier });
      winEncounter(bus);
      acceptAllRewards(run); // 48f — the full catalog carries reward refs

      const offer = run.currentOffer!;
      expect(offer).not.toBeNull();
      const avg = Math.round(avgTeamLevel(run.team)); // 6 — well above hop 1
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
      const frontier = frontierOf(run);
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
      const frontier = frontierOf(run);
      run.dispatch({ kind: 'enterNode', nodeId: frontier });
      // Award exactly the level-1→2 threshold from the curve so the test
      // stays pinned regardless of `baseXp` / `exponent` tuning.
      winEncounter(bus, [{ unitId: 1, rosterIndex: 0, damageDealt: 0, xpGained: xpToNext(1) }]);
      expect(run.team[0]!.level).toBe(2);
      expect(run.team[0]!.xp).toBe(0);
    });

    it('cascades multiple level-ups in one award if banked xp covers them', () => {
      const { run, bus } = freshLvl1RunWithBus(11);
      const frontier = frontierOf(run);
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
      const frontier = frontierOf(run);
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
      const frontier = frontierOf(run);
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
      const frontier = frontierOf(run);
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
      const frontier = frontierOf(run);
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
      const frontier = frontierOf(run);
      run.dispatch({ kind: 'enterNode', nodeId: frontier });
      const promotions: number[] = [];
      bus.on('promotion:pending', ({ promotions: p }) => promotions.push(p.length));
      winEncounter(bus, [{ unitId: 1, rosterIndex: 0, damageDealt: 0, xpGained: 5 }]);
      acceptAllRewards(run); // 48f — the full catalog carries reward refs
      expect(promotions).toEqual([]);
      // Flow lands directly in recruit phase (no promotion interposes).
      expect(run.phase).toBe('recruit');
      expect(run.currentOffer).not.toBeNull();
    });

    it('enters promotion phase + emits promotion:pending when a unit levels', () => {
      const { run, bus } = freshLvl1RunWithBus(1);
      const frontier = frontierOf(run);
      run.dispatch({ kind: 'enterNode', nodeId: frontier });
      const promotions: number[][] = [];
      const offers: number[] = [];
      bus.on('promotion:pending', ({ promotions: p }) =>
        promotions.push(p.map((x) => x.rosterIndex)),
      );
      bus.on('recruit:offered', ({ units }) => offers.push(units.length));
      winEncounter(bus, [{ unitId: 1, rosterIndex: 0, damageDealt: 0, xpGained: xpToNext(1) }]);
      acceptAllRewards(run); // 48f — rewards interpose ahead of promotion
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
      const frontier = frontierOf(run);
      run.dispatch({ kind: 'enterNode', nodeId: frontier });
      const offers: number[] = [];
      bus.on('recruit:offered', ({ units }) => offers.push(units.length));
      winEncounter(bus, [{ unitId: 1, rosterIndex: 0, damageDealt: 0, xpGained: xpToNext(1) }]);
      // 48f — the full catalog carries reward refs, so the reward phase
      // interposes first (the shape-locked sequence); resolve it to reach
      // the promotion assertion this test is about.
      acceptAllRewards(run);
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
      winEncounter(bus, [{ unitId: 1, rosterIndex: 0, damageDealt: 0, xpGained: xpToNext(1) }]);
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
      const frontier = frontierOf(run);
      run.dispatch({ kind: 'enterNode', nodeId: frontier });
      winEncounter(bus, [{ unitId: 1, rosterIndex: 0, damageDealt: 0, xpGained: xpToNext(1) }]);
      acceptAllRewards(run); // 48f — rewards interpose ahead of promotion
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

    it('beginEncounter selects the encounter + fills its pool; playerHealth untouched', () => {
      const { run } = freshRunWithBus(1);
      const frontier = frontierOf(run);
      run.dispatch({ kind: 'enterNode', nodeId: frontier });
      // V1 — the pool comes from the SELECTED encounter (each launch-catalog
      // fight is pooled at the old global HEALTH.enemyHealthMax, so the value holds).
      expect(run.enemyHealth).toBe(HEALTH.enemyHealthMax);
      expect(run.enemyHealthPoolMax).toBe(HEALTH.enemyHealthMax);
      // Selection picks one of "The Start"'s pooled encounters — which one is
      // seed-dependent; assert it's a real catalog pick, derived from the live
      // pool (not a frozen name list) so new catalog content can't stale this.
      // Wb4 — the fight pool is per-kind; flatten all kinds for the name check.
      const pool = getSector('the-start')!.encounters;
      const pooledNames = [...pool.normal, ...pool.elite, ...pool.boss].map(
        (e) => getEncounter(e.encounterId)!.name,
      );
      expect(pooledNames).toContain(run.currentEncounterName);
      expect(run.turnIndex).toBe(0); // no turn resolved yet
      expect(run.playerHealth).toBe(HEALTH.playerHealthMax);
    });

    it('a sub-lethal chip continues the encounter; a lethal chip wins it', () => {
      const { run, bus } = freshRunWithBus(1);
      const starts: number[] = [];
      bus.on('battle:started', ({ worldSeed }) => starts.push(worldSeed));
      const frontier = frontierOf(run);
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
      acceptAllRewards(run); // 48f — the full catalog carries reward refs
      expect(run.phase).toBe('recruit');
      expect(run.turnIndex).toBe(2);
      expect(starts).toHaveLength(2); // no turn 3
    });

    it('the player pool persists across encounters; the enemy pool resets', () => {
      const { run, bus } = freshRunWithBus(1);
      const first = frontierOf(run);
      run.dispatch({ kind: 'enterNode', nodeId: first });
      // Take 5 to the player pool on a sub-lethal enemy chip (encounter continues).
      chipTurn(bus, { player: 0, enemy: 5 });
      expect(run.phase).toBe('battle');
      expect(run.playerHealth).toBe(HEALTH.playerHealthMax - 5);
      // Win the encounter, recruit, then enter the next node.
      winEncounter(bus);
      acceptAllRewards(run); // 48f — the full catalog carries reward refs
      run.dispatch({ kind: 'chooseRecruit', unitTemplate: run.currentOffer![0]! });
      const second = run.nodeMap.edges.find((e) => e.from === first)!.to;
      run.dispatch({ kind: 'enterNode', nodeId: second });
      expect(run.playerHealth).toBe(HEALTH.playerHealthMax - 5); // carried the wound
      expect(run.enemyHealth).toBe(HEALTH.enemyHealthMax); // reset for the new encounter
    });

    it('loses the run when the player pool empties', () => {
      const { run, bus } = freshRunWithBus(1);
      const frontier = frontierOf(run);
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
      const frontier = frontierOf(run);
      run.dispatch({ kind: 'enterNode', nodeId: frontier });
      chipTurn(bus, { player: HEALTH.enemyHealthMax, enemy: HEALTH.playerHealthMax });
      expect(run.phase).toBe('defeat');
    });

    it('the max-turns cap terminates an all-mutual-wipe encounter (pristine tie → defeat)', () => {
      const { run, bus } = freshRunWithBus(1);
      const frontier = frontierOf(run);
      run.dispatch({ kind: 'enterNode', nodeId: frontier });
      // Every turn chips 0/0; without the cap this would loop forever.
      for (let i = 0; i < HEALTH.maxTurns; i++) chipTurn(bus, { player: 0, enemy: 0 });
      expect(run.turnIndex).toBe(HEALTH.maxTurns);
      // Pristine pools → equal fractions → player loses the tie.
      expect(run.phase).toBe('defeat');
    });

    it('the max-turns cap awards the win when the player pool fraction leads', () => {
      const { run, bus } = freshRunWithBus(1);
      const frontier = frontierOf(run);
      run.dispatch({ kind: 'enterNode', nodeId: frontier });
      // Knock the enemy pool down (but not out), then stalemate to the cap.
      chipTurn(bus, { player: HEALTH.enemyHealthMax - 1, enemy: 0 });
      expect(run.phase).toBe('battle');
      while (run.turnIndex < HEALTH.maxTurns) chipTurn(bus, { player: 0, enemy: 0 });
      // playerFrac (1.0) > enemyFrac (1/max) → encounter won.
      acceptAllRewards(run); // 48f — the full catalog carries reward refs
      expect(run.phase).toBe('recruit');
    });

    it('M1 — banks each turn\'s XP at the turn boundary, not at encounter end', () => {
      const { run, bus } = freshLvl1RunWithBus(1);
      const frontier = frontierOf(run);
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
      // boundary, before the encounter resolves into the recruit offer
      // (rewards interpose ahead of it — 48f, the full catalog carries refs).
      acceptAllRewards(run);
      expect(run.phase).toBe('promotion');
      expect(promotions).toEqual([[0]]);
      expect(run.team[0]!.level).toBe(2);
      expect(run.team[0]!.xp).toBe(0);
      run.dispatch({ kind: 'dismissPromotion' });
      expect(run.phase).toBe('recruit');
    });

    it('a losing turn\'s XP is never banked (defeat is terminal)', () => {
      const { run, bus } = freshLvl1RunWithBus(1);
      const frontier = frontierOf(run);
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
      const frontier = frontierOf(run);
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
      // U3 — the selected encounter + wave cursor round-trip (replaces the budget).
      expect(restored.currentEncounterName).toBe(run.currentEncounterName);
      expect(restored.waveCursor).toEqual(run.waveCursor);
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

      run.dispatch({ kind: 'advanceTurn' }); // won → rewards → finishEncounter → recruit
      acceptAllRewards(run); // 48f — the full catalog carries reward refs
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

    it('turn:starting + turn:handRedrawn carry the draw/discard piles in recruitment order (R2)', () => {
      const { run, bus } = freshRunWithBus(6, { daemon: K_DEFAULT_DAEMON });
      run.pauseAtTurnGates = true;
      const startings: GameEvents['turn:starting'][] = [];
      const redrawns: GameEvents['turn:handRedrawn'][] = [];
      bus.on('turn:starting', (p) => startings.push(p));
      bus.on('turn:handRedrawn', (p) => redrawns.push(p));
      run.dispatch({ kind: 'enterNode', nodeId: frontierOf(run) });

      // The payload should resolve a pile's rosterIndex values in ascending
      // (recruitment) order — NOT draw order — so a pile view shows contents
      // only and never reveals the next-draw sequence.
      const inRecruitmentOrder = (pile: readonly number[]) =>
        [...pile].sort((a, b) => a - b).map((i) => run.team[i]);

      expect(startings).toHaveLength(1);
      expect(startings[0]!.drawPile).toEqual(inRecruitmentOrder(run.drawPile));
      expect(startings[0]!.discardPile).toEqual(inRecruitmentOrder(run.discardPile));
      expect(startings[0]!.discardPile).toHaveLength(0); // nothing fought yet on turn 1
      // hand ∪ draw ∪ discard = the whole fielded roster.
      const counted =
        startings[0]!.hand.length +
        startings[0]!.drawPile.length +
        startings[0]!.discardPile.length;
      expect(counted).toBe(run.team.length);

      // A redraw shuffles cards between piles; the event re-sends them, same contract.
      run.dispatch({ kind: 'redrawCards', handIndices: [0] });
      expect(redrawns).toHaveLength(1);
      expect(redrawns[0]!.drawPile).toEqual(inRecruitmentOrder(run.drawPile));
      expect(redrawns[0]!.discardPile).toEqual(inRecruitmentOrder(run.discardPile));
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
      // 47d — save/reload needs a CATALOG daemon (bespoke ids hard-reject on
      // load); janus is the guaranteed-redraw idol.
      const { run } = gatedToFirstTurnIntro(10, daemonById('janus')!);
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
      run.dispatch({ kind: 'empowerUnit', grantIndex: 0, handIndex: pos });
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
        run.dispatch({ kind: 'empowerUnit', grantIndex: 0, handIndex: 0 });
      }
      expect(run.empowersUsedThisTurn).toEqual([EMPOWER.empowersPerTurn]);
      expect(emits).toBe(EMPOWER.empowersPerTurn);
      const stored = run.encounterEffects[run.hand[0]!]!.map((e) => ({ ...e }));
      run.dispatch({ kind: 'empowerUnit', grantIndex: 0, handIndex: 0 });
      expect(run.empowersUsedThisTurn).toEqual([EMPOWER.empowersPerTurn]);
      expect(emits).toBe(EMPOWER.empowersPerTurn);
      expect(run.encounterEffects[run.hand[0]!]).toMatchObject(stored);
    });

    it('a rejected request consumes no budget, mutates nothing, emits nothing', () => {
      const { run, bus } = gatedToFirstTurnIntro(3);
      let emits = 0;
      bus.on('turn:unitEmpowered', () => emits++);
      run.dispatch({ kind: 'empowerUnit', grantIndex: 0, handIndex: run.hand.length }); // range
      run.dispatch({ kind: 'empowerUnit', grantIndex: 0, handIndex: -1 }); // negative
      run.dispatch({ kind: 'empowerUnit', grantIndex: 0, handIndex: 0.5 }); // non-integer
      expect(run.empowersUsedThisTurn).toEqual([0]);
      expect(run.encounterEffects.every((slot) => slot.length === 0)).toBe(true);
      expect(emits).toBe(0);
    });

    it('is a no-op outside the pre-turn gate (map phase, headless battle)', () => {
      const { run } = freshRunWithBus(4, { daemon: K_DEFAULT_DAEMON });
      run.dispatch({ kind: 'empowerUnit', grantIndex: 0, handIndex: 0 }); // map
      expect(run.empowersUsedThisTurn).toEqual([]); // no turn resolved yet
      run.dispatch({ kind: 'enterNode', nodeId: frontierOf(run) }); // gates off → battle
      expect(run.phase).toBe('battle');
      run.dispatch({ kind: 'empowerUnit', grantIndex: 0, handIndex: 0 });
      expect(run.empowersUsedThisTurn).toEqual([0]);
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
      run.dispatch({ kind: 'empowerUnit', grantIndex: 0, handIndex: 0 });
      run.dispatch({ kind: 'advanceTurn' }); // → battle
      chipTurn(bus, { player: 1, enemy: 1 }); // sub-lethal → ongoing
      run.dispatch({ kind: 'advanceTurn' }); // → next turn's gate
      expect(run.phase).toBe('turn-intro');
      expect(run.empowersUsedThisTurn).toEqual([0]);
      // The turn-2 pre-turn payload already badges the carried buff (the
      // "empowered on an earlier turn, drawn back" pin).
      const pos2 = run.hand.indexOf(slot);
      expect(pos2).toBeGreaterThanOrEqual(0); // short roster: always in hand
      expect(startings[1]!.empowerMagnitudes[pos2]).toBe(1);
      run.dispatch({ kind: 'empowerUnit', grantIndex: 0, handIndex: pos2 });
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
      run.dispatch({ kind: 'empowerUnit', grantIndex: 0, handIndex: 0 });
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
      expect(startings[0]!.empowers).toHaveLength(1);
      expect(startings[0]!.empowers[0]!.empowersRemaining).toBe(EMPOWER.empowersPerTurn);
      expect(startings[0]!.empowerMagnitudes).toEqual(run.hand.map(() => 0));
      run.dispatch({ kind: 'empowerUnit', grantIndex: 0, handIndex: 1 });
      expect(empowereds).toHaveLength(1);
      expect(empowereds[0]!.handIndex).toBe(1);
      expect(empowereds[0]!.empowers).toEqual(run.empowerGrants);
      expect(empowereds[0]!.empowers[0]!.empowersRemaining).toBe(EMPOWER.empowersPerTurn - 1);
      expect(empowereds[0]!.empowerMagnitudes).toEqual(
        run.hand.map((_, i) => (i === 1 ? 1 : 0)),
      );
    });

    it('same seed + same empower dispatches stay byte-identical', () => {
      const a = gatedToFirstTurnIntro(8);
      const b = gatedToFirstTurnIntro(8);
      for (const { run } of [a, b]) {
        run.dispatch({ kind: 'empowerUnit', grantIndex: 0, handIndex: 3 });
        run.dispatch({ kind: 'advanceTurn' });
      }
      expect(JSON.parse(JSON.stringify(a.run.toJSON()))).toEqual(
        JSON.parse(JSON.stringify(b.run.toJSON())),
      );
    });

    it('round-trips the empower counter (a save at the gate must not refresh the budget)', () => {
      // 47d — save/reload needs a CATALOG daemon (bespoke ids hard-reject on
      // load); mars is the guaranteed-empower idol.
      const { run } = gatedToFirstTurnIntro(9, daemonById('mars')!);
      run.dispatch({ kind: 'empowerUnit', grantIndex: 0, handIndex: 0 });
      const wire = JSON.parse(JSON.stringify(run.toJSON()));
      const restored = Run.fromJSON(wire, new EventBus<GameEvents>());
      expect(restored.phase).toBe('turn-intro');
      expect(restored.empowersUsedThisTurn).toEqual(run.empowersUsedThisTurn);
      expect(restored.empowerGrants).toEqual(run.empowerGrants);
      // The buff itself rides the K1 v12 `encounterEffects` round-trip.
      expect(restored.encounterEffects).toEqual(run.encounterEffects);
      // (The pre-K4 v14 reject rides the generic `schemaVersion - 1` test.)
    });
  });

  describe('daemons (L1 — daemon-only gates)', () => {
    it('rolls exactly one daemon at construction, deterministically per seed', () => {
      const a = freshRunWithBus(21).run;
      const b = freshRunWithBus(21).run;
      expect(a.daemons).toHaveLength(1);
      expect(a.daemons[0]!.id).toBe(b.daemons[0]!.id);
    });

    it('covers the whole catalog over seeds', () => {
      const seen = new Set<string>();
      for (let seed = 0; seed < 60; seed++) seen.add(freshRunWithBus(seed).run.daemons[0]!.id);
      expect([...seen].sort()).toEqual(DAEMONS.map((d) => d.id).sort());
    });

    it('RunConfig.daemon seeds the ownership list; null forces daemon-less', () => {
      expect(freshRunWithBus(1, { daemon: daemonById('mars')! }).run.daemons[0]!.id).toBe('mars');
      expect(freshRunWithBus(1, { daemon: null }).run.daemons).toEqual([]);
    });

    it('daemon-less: both gates read 0 at the gate and both commands are no-ops', () => {
      const { run } = gatedToFirstTurnIntro(22, null);
      expect(run.redrawAvailability).toEqual({ redrawsRemaining: 0, cardsRemaining: 0 });
      expect(run.empowerGrants).toEqual([]);
      const hand = run.hand.slice();
      run.dispatch({ kind: 'redrawCards', handIndices: [0] });
      run.dispatch({ kind: 'empowerUnit', grantIndex: 0, handIndex: 0 });
      expect(run.hand).toEqual(hand);
      expect(run.redrawsUsedThisTurn).toBe(0);
      expect(run.empowersUsedThisTurn).toEqual([]);
      expect(run.encounterEffects.every((slot) => slot.length === 0)).toBe(true);
    });

    it('an empower idol (mars) grants empower per its dials and NO redraw', () => {
      const mars = daemonById('mars')!;
      const marsEmpower = daemonEmpowerHook(mars)!;
      const { run } = gatedToFirstTurnIntro(23, mars);
      expect(run.empowerGrants[0]!.empowersRemaining).toBe(marsEmpower.empowersPerTurn);
      expect(run.redrawAvailability).toEqual({ redrawsRemaining: 0, cardsRemaining: 0 });
      const hand = run.hand.slice();
      run.dispatch({ kind: 'redrawCards', handIndices: [0] });
      expect(run.hand).toEqual(hand); // no redraw under mars
      const slot = run.hand[1]!;
      run.dispatch({ kind: 'empowerUnit', grantIndex: 0, handIndex: 1 });
      const stored = run.encounterEffects[slot]!;
      expect(stored).toHaveLength(1);
      expect(stored[0]!.key).toBe(marsEmpower.buff.key);
      expect(stored[0]!.mods).toEqual(marsEmpower.buff.mods);
    });

    it("minerva applies HER buff (the daemon's own, not a shared config)", () => {
      const minerva = daemonById('minerva')!;
      const minervaEmpower = daemonEmpowerHook(minerva)!;
      const { run } = gatedToFirstTurnIntro(24, minerva);
      const slot = run.hand[0]!;
      run.dispatch({ kind: 'empowerUnit', grantIndex: 0, handIndex: 0 });
      const stored = run.encounterEffects[slot]!;
      expect(stored[0]!.key).toBe(minervaEmpower.buff.key);
      expect(stored[0]!.mods).toEqual(minervaEmpower.buff.mods);
      expect(stored[0]!.key).not.toBe(daemonEmpowerHook(daemonById('mars')!)!.buff.key);
    });

    it('a redraw idol (janus) grants redraw capped by its dial and NO empower', () => {
      const janus = daemonById('janus')!;
      const janusRedraw = daemonRedrawHook(janus)!;
      const { run } = gatedToFirstTurnIntro(25, janus);
      const cap = janusRedraw.maxCardsPerTurn;
      expect(run.redrawAvailability).toEqual({
        redrawsRemaining: janusRedraw.redrawsPerTurn,
        cardsRemaining: cap,
      });
      expect(run.empowerGrants).toEqual([]);
      const hand = run.hand.slice();
      // One past the cap → silent no-op; at the cap → lands.
      run.dispatch({
        kind: 'redrawCards',
        handIndices: hand.map((_, i) => i).slice(0, cap + 1),
      });
      expect(run.hand).toEqual(hand);
      run.dispatch({ kind: 'redrawCards', handIndices: hand.map((_, i) => i).slice(0, cap) });
      expect(run.cardsRedrawnThisTurn).toBe(cap);
      run.dispatch({ kind: 'empowerUnit', grantIndex: 0, handIndex: 0 });
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

    it('turn:starting carries the owned-daemon list + hook shape (empty for daemon-less)', () => {
      const mars = daemonById('mars')!;
      for (const [daemon, expected] of [
        [
          mars,
          [
            {
              id: mars.id,
              name: mars.name,
              description: mars.description,
              // L1c2→47d — hook presence, derived from the catalog entry's
              // rules (mars is empower-only). The buff rides `empowers`.
              redrawGate: false,
              empowerGate: true,
            },
          ],
        ],
        [null, []],
      ] as const) {
        const { run, bus } = freshRunWithBus(26, { daemon });
        run.pauseAtTurnGates = true;
        const startings: GameEvents['turn:starting'][] = [];
        bus.on('turn:starting', (p) => startings.push(p));
        run.dispatch({ kind: 'enterNode', nodeId: frontierOf(run) });
        expect(startings[0]!.daemons).toEqual(expected);
        // 47d — the granted-empower list carries the buff + source identity.
        if (daemon !== null) {
          expect(startings[0]!.empowers).toEqual([
            {
              daemonId: mars.id,
              name: mars.name,
              empowersRemaining: daemonEmpowerHook(mars)!.empowersPerTurn,
              buff: daemonEmpowerHook(mars)!.buff.mods,
            },
          ]);
        } else {
          expect(startings[0]!.empowers).toEqual([]);
        }
      }
    });

    it('round-trips the daemons BY ID, the stream, and the CURRENT flip (v16→v26)', () => {
      const mercury = daemonById('mercury')!;
      const { run, bus } = gatedToFirstTurnIntro(27, mercury);
      const wire = JSON.parse(JSON.stringify(run.toJSON()));
      // 47d — the wire carries ids only, not rule payloads.
      expect(wire.daemonIds).toEqual(['mercury']);
      const busB = new EventBus<GameEvents>();
      const restored = Run.fromJSON(wire, busB);
      // `pauseAtTurnGates` is a DRIVER flag (not snapshotted) — re-arm it so
      // both runs walk the same gated path below.
      restored.pauseAtTurnGates = true;
      // The save's grant state is restored, never re-flipped; the daemon
      // def-resolves back to the catalog object.
      expect(restored.daemons).toEqual(run.daemons);
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

    it('multi-daemon ownership round-trips by id (addDaemon → save → load)', () => {
      const { run } = gatedToFirstTurnIntro(29, daemonById('mars')!);
      run.addDaemon(daemonById('janus')!);
      const wire = JSON.parse(JSON.stringify(run.toJSON()));
      expect(wire.daemonIds).toEqual(['mars', 'janus']);
      const restored = Run.fromJSON(wire, new EventBus<GameEvents>());
      expect(restored.daemons.map((d) => d.id)).toEqual(['mars', 'janus']);
    });

    it('an unknown daemon id on load is a hard reject (the 47 shape-lock: no silent drops)', () => {
      const { run } = gatedToFirstTurnIntro(28); // K_DEFAULT_DAEMON, not in DAEMONS
      const wire = JSON.parse(JSON.stringify(run.toJSON()));
      expect(wire.daemonIds).toEqual(['test-k-defaults']);
      expect(() => Run.fromJSON(wire, new EventBus<GameEvents>())).toThrow(
        /unknown daemon id 'test-k-defaults'/,
      );
    });

    it('two empower idols → two per-source grants, each applying ITS buff (47d)', () => {
      const { run, bus } = gatedToFirstTurnIntro(31, daemonById('mars')!);
      run.addDaemon(daemonById('minerva')!);
      // Acquisition lands mid-turn: this turn's grants are unchanged; the
      // list takes effect at the NEXT turn's resolution.
      expect(run.empowerGrants.map((g) => g.daemonId)).toEqual(['mars']);
      run.dispatch({ kind: 'advanceTurn' }); // → battle
      chipTurn(bus, { player: 1, enemy: 1 }); // sub-lethal → ongoing
      run.dispatch({ kind: 'advanceTurn' }); // → turn 2's gate
      expect(run.phase).toBe('turn-intro');
      expect(run.empowerGrants.map((g) => g.daemonId)).toEqual(['mars', 'minerva']);
      // Each grant applies ITS OWN buff, budgeted independently.
      const marsBuff = daemonEmpowerHook(daemonById('mars')!)!.buff;
      const minervaBuff = daemonEmpowerHook(daemonById('minerva')!)!.buff;
      const slot0 = run.hand[0]!;
      const slot1 = run.hand[1]!;
      run.dispatch({ kind: 'empowerUnit', grantIndex: 0, handIndex: 0 });
      run.dispatch({ kind: 'empowerUnit', grantIndex: 1, handIndex: 1 });
      expect(run.encounterEffects[slot0]!.map((e) => e.key)).toEqual([marsBuff.key]);
      expect(run.encounterEffects[slot1]!.map((e) => e.key)).toEqual([minervaBuff.key]);
      expect(run.empowerGrants.map((g) => g.empowersRemaining)).toEqual([0, 0]);
      // A spent source rejects silently; the OTHER source's budget is its own.
      run.dispatch({ kind: 'empowerUnit', grantIndex: 0, handIndex: 2 });
      expect(run.encounterEffects[run.hand[2]!]!).toHaveLength(0);
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
        acceptAllRewards(run); // 48f — the full catalog carries reward refs
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
      const frontier = frontierOf(run);
      run.dispatch({ kind: 'enterNode', nodeId: frontier });
      expect(run.encounterMap!.layoutId).toBe(forced);
      expect(run.encounterMap!.gridW).toBe(getLayout(forced)!.gridW);
      expect(run.encounterMap!.gridH).toBe(getLayout(forced)!.gridH);
      expect(run.currentEncounter!.layoutId).toBe(forced);
    });

    it('a forced encounter (X2 --encounter) pins the selected encounter at a battle node', () => {
      // Derive a real normal-kind id from the catalog (no hardcoded id to drift).
      const normalId = ENCOUNTERS.find((e) => e.kind === 'normal')!.id;
      const bus = new EventBus<GameEvents>();
      const run = new Run(3, bus, { forcedEncounterId: normalId });
      run.dispatch({ kind: 'enterNode', nodeId: frontierOf(run) });
      expect(run.selectedEncounter!.id).toBe(normalId);
    });

    it('an unknown forced encounter id throws loudly at construction', () => {
      const bus = new EventBus<GameEvents>();
      expect(() => new Run(3, bus, { forcedEncounterId: 'no-such-encounter' })).toThrow(
        /unknown forcedEncounterId/,
      );
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

    it('turn:starting carries the selected encounter name + kind (Wb1)', () => {
      const { run, bus } = freshRunWithBus(6);
      run.pauseAtTurnGates = true;
      const startings: GameEvents['turn:starting'][] = [];
      bus.on('turn:starting', (p) => startings.push(p));
      run.dispatch({ kind: 'enterNode', nodeId: frontierOf(run) });
      // Mirrors the held encounter the pre-turn screen names — never hardcoded.
      expect(startings[0]!.encounter).toEqual({
        name: run.selectedEncounter!.name,
        kind: run.selectedEncounter!.kind,
      });
    });

    it('the map is encounter-scoped: null before, during the map phase, and after the encounter', () => {
      const { run, bus } = freshRunWithBus(1);
      expect(run.encounterMap).toBeNull();
      run.dispatch({ kind: 'enterNode', nodeId: frontierOf(run) });
      expect(run.encounterMap).not.toBeNull();
      winEncounter(bus);
      acceptAllRewards(run); // 48f — finishEncounter (which drops the map) runs after rewards
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
      acceptAllRewards(run); // 48f — the full catalog carries reward refs
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
      acceptAllRewards(run); // 48f — the full catalog carries reward refs
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

  describe('bits (47e — the substrate)', () => {
    /** A bespoke daemon paying bits at every turn start (fire-site execution). */
    const TURN_BITS: DaemonConfig = {
      id: 'test-turn-bits',
      name: 'Test Turn Bits',
      description: '+5 bits every turn',
      rules: [{ kind: 'hook', on: 'turnStart', effect: { op: 'gainBits', amount: 5 } }],
    };
    /** A bespoke win-bounty daemon (`won`-filtered encounterEnd). */
    const WIN_BOUNTY: DaemonConfig = {
      id: 'test-win-bounty',
      name: 'Test Win Bounty',
      description: '+7 bits on a won encounter',
      rules: [
        {
          kind: 'hook',
          on: 'encounterEnd',
          filter: { won: true },
          effect: { op: 'gainBits', amount: 7 },
        },
      ],
    };
    /** The shipped bitsGain multiplier (moneta's rule) — derived, never hardcoded. */
    const monetaMult = (): number => {
      const rule = daemonById('moneta')!.rules![0]!;
      if (rule.kind !== 'modifier') throw new Error('moneta rule shape changed');
      return rule.value;
    };

    it('starts at the config default; a RunConfig override wins; negatives clamp to the floor', () => {
      expect(freshRunWithBus(1).run.bits).toBe(ECONOMY.startingBits);
      expect(freshRunWithBus(1, { startingBits: 25 }).run.bits).toBe(25);
      expect(freshRunWithBus(1, { startingBits: -10 }).run.bits).toBe(0);
    });

    it('the bits override does not perturb any RNG stream (the G1 contract)', () => {
      const a = freshRunWithBus(9).run;
      const b = freshRunWithBus(9, { startingBits: 50 }).run;
      expect(b.nodeMap).toEqual(a.nodeMap);
      expect(b.team).toEqual(a.team);
      expect(b.daemons.map((d) => d.id)).toEqual(a.daemons.map((d) => d.id));
    });

    it('gainBits adds the neutral-fold amount when no modifier daemon is owned', () => {
      const { run } = freshRunWithBus(1, { daemon: null });
      run.gainBits(10);
      expect(run.bits).toBe(Math.round(10 * RUN_STAT_BASES.bitsGain));
    });

    it("gainBits applies moneta's bitsGain fold, ROUNDING at the grant site", () => {
      const { run } = freshRunWithBus(1, { daemon: daemonById('moneta')! });
      run.gainBits(10);
      const first = Math.round(10 * RUN_STAT_BASES.bitsGain * monetaMult());
      expect(run.bits).toBe(first);
      // A fractional product rounds per grant (3 × 1.2 = 3.6 → 4 at the
      // shipped value) — the fold itself never rounds (runStats.ts).
      run.gainBits(3);
      expect(run.bits).toBe(first + Math.round(3 * RUN_STAT_BASES.bitsGain * monetaMult()));
    });

    it('the 48f bitsMultiplier scales gainBits (the economy difficulty lever)', () => {
      const { run } = freshRunWithBus(1, { daemon: null, bitsMultiplier: 1.5 });
      run.gainBits(10);
      expect(run.bits).toBe(Math.round(10 * RUN_STAT_BASES.bitsGain * 1.5));
    });

    it('bitsMultiplier stacks MULTIPLICATIVELY with the bitsGain fold, rounding once at the settle', () => {
      // The shape-lock's Option B: the lever joins the effectiveBits product,
      // so a fold daemon and the difficulty dial compound (never add) and the
      // display helper carries both — screen == settle stays drift-impossible.
      const { run } = freshRunWithBus(1, {
        daemon: daemonById('moneta')!,
        bitsMultiplier: 1.5,
      });
      const expected = Math.round(10 * RUN_STAT_BASES.bitsGain * monetaMult() * 1.5);
      expect(run.effectiveBits(10)).toBe(expected);
      run.gainBits(10);
      expect(run.bits).toBe(expected);
    });

    it('emits run:bitsChanged with the new balance + applied delta, only on a real change', () => {
      const { run, bus } = freshRunWithBus(1, { daemon: null });
      const events: Array<{ bits: number; delta: number }> = [];
      bus.on('run:bitsChanged', (e) => events.push(e));
      run.gainBits(10);
      run.gainBits(0); // rounds to a zero delta → silent
      expect(events).toEqual([{ bits: 10, delta: 10 }]);
    });

    it('a turnStart gainBits hook pays at EVERY turn start (the fire-site execution)', () => {
      const { run, bus } = freshRunWithBus(1, { daemon: TURN_BITS });
      run.dispatch({ kind: 'enterNode', nodeId: frontierOf(run) }); // turn 1
      expect(run.bits).toBe(5);
      chipTurn(bus, { player: 0, enemy: 0 }); // ongoing → turn 2 starts
      expect(run.bits).toBe(10);
    });

    it('an encounterEnd win-bounty pays on a win, not on a loss (the won filter)', () => {
      const won = freshRunWithBus(1, { daemon: WIN_BOUNTY });
      won.run.dispatch({ kind: 'enterNode', nodeId: frontierOf(won.run) });
      winEncounter(won.bus);
      // 48f — decline the rolled reward (the hook fires at finishEncounter,
      // AFTER reward resolution; accepting would pollute the exact balance).
      declineAllRewards(won.run);
      expect(won.run.bits).toBe(7);

      const lost = freshRunWithBus(1, { daemon: WIN_BOUNTY });
      lost.run.dispatch({ kind: 'enterNode', nodeId: frontierOf(lost.run) });
      loseEncounter(lost.bus);
      expect(lost.run.bits).toBe(0);
      expect(lost.run.phase).toBe('defeat');
    });

    it('the fold applies to hook earns too (moneta stacked via addDaemon)', () => {
      const { run, bus } = freshRunWithBus(1, { daemon: WIN_BOUNTY });
      run.addDaemon(daemonById('moneta')!);
      run.dispatch({ kind: 'enterNode', nodeId: frontierOf(run) });
      winEncounter(bus);
      declineAllRewards(run); // 48f — keep the balance to the hook earn alone
      expect(run.bits).toBe(Math.round(7 * RUN_STAT_BASES.bitsGain * monetaMult()));
    });

    it('round-trips bits in the save; a negative wire value re-clamps to the floor', () => {
      const { run } = freshRunWithBus(1, { startingBits: 33 });
      const wire = JSON.parse(JSON.stringify(run.toJSON()));
      expect(wire.bits).toBe(33);
      expect(Run.fromJSON(wire, new EventBus<GameEvents>()).bits).toBe(33);
      const tampered = { ...wire, bits: -5 };
      expect(Run.fromJSON(tampered, new EventBus<GameEvents>()).bits).toBe(0);
    });
  });

  describe('battle tallies (47f — the settle seam)', () => {
    /** A bespoke battle-hook daemon (Laverna-shaped). */
    const BATTLE_BITS: DaemonConfig = {
      id: 'test-battle-bits',
      name: 'Test Battle Bits',
      description: '+1 bit per player hit',
      rules: [{ kind: 'hook', on: 'dealHit', effect: { op: 'gainBits', amount: 1 } }],
    };

    it('the encounter carries the compiled battleRules (the seam into both World sites)', () => {
      const { run } = freshRunWithBus(1, { daemon: BATTLE_BITS });
      run.dispatch({ kind: 'enterNode', nodeId: frontierOf(run) });
      expect(run.currentEncounter!.battleRules).toEqual([
        { on: 'dealHit', effect: { op: 'gainBits', amount: 1 } },
      ]);
      // A grant-only idol compiles to an empty list.
      const plain = freshRunWithBus(1, { daemon: daemonById('janus')! });
      plain.run.dispatch({ kind: 'enterNode', nodeId: frontierOf(plain.run) });
      expect(plain.run.currentEncounter!.battleRules).toEqual([]);
    });

    it('a won turn settles the tally through gainBits (the bitsGain fold applies)', () => {
      const { run, bus } = freshRunWithBus(1, { daemon: null });
      run.addDaemon(daemonById('moneta')!);
      run.dispatch({ kind: 'enterNode', nodeId: frontierOf(run) });
      winEncounter(bus, [], 1_000, { bits: 10 });
      const rule = daemonById('moneta')!.rules![0]!;
      const mult = rule.kind === 'modifier' ? rule.value : NaN;
      expect(run.bits).toBe(Math.round(10 * mult));
    });

    it('an ongoing (draw) turn settles too — bits accrue per turn, the XP cadence', () => {
      const { run, bus } = freshRunWithBus(1, { daemon: null });
      run.dispatch({ kind: 'enterNode', nodeId: frontierOf(run) });
      chipTurn(bus, { player: 0, enemy: 0 }, [], { bits: 3 });
      chipTurn(bus, { player: 0, enemy: 0 }, [], { bits: 4 });
      expect(run.bits).toBe(7);
    });

    it('a LOSING turn banks nothing (the skip-on-lost XP mirror)', () => {
      const { run, bus } = freshRunWithBus(1, { daemon: null });
      run.dispatch({ kind: 'enterNode', nodeId: frontierOf(run) });
      bus.emit('battle:ended', {
        winner: 'enemy',
        xpAwards: [],
        survivorPower: { player: 0, enemy: HEALTH.playerHealthMax },
        tallies: { bits: 50 },
      });
      expect(run.phase).toBe('defeat');
      expect(run.bits).toBe(0);
    });

    it('an absent tally (test fakes) is a silent no-op', () => {
      const { run, bus } = freshRunWithBus(1, { daemon: null });
      run.dispatch({ kind: 'enterNode', nodeId: frontierOf(run) });
      winEncounter(bus);
      expect(run.bits).toBe(0);
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
      const frontier = frontierOf(run);
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
      const oldFrontier = frontierOf(oldRun);
      oldRun.dispatch({ kind: 'enterNode', nodeId: oldFrontier });
      // Both runs are now in battle phase (well, oldRun is). Dispose it.
      oldRun.dispose();

      const newRun = new Run(2, bus);
      const newFrontier = frontierOf(newRun);
      newRun.dispatch({ kind: 'enterNode', nodeId: newFrontier });
      expect(newRun.phase).toBe('battle');

      // Now end the new run's battle. The old Run is disposed, so its
      // battle:ended handler is gone — only newRun reacts.
      winEncounter(bus);
      // 48f — the full catalog carries reward refs; resolve the interposed
      // reward phase to reach the recruit assertion.
      acceptAllRewards(newRun);
      expect(newRun.phase).toBe('recruit');
      expect(oldRun.phase).toBe('battle'); // unchanged
    });
  });

  describe('visitedNodes', () => {
    it('starts empty (no encounter cleared yet at the pre-root start)', () => {
      const { run } = freshRunWithBus(1);
      expect(run.visitedNodes.size).toBe(0);
    });

    it('records the root once the player clears it and hops onward (S2)', () => {
      const { run, bus } = freshRunWithBus(1);
      // The root is a normal battle node now — enter it from the pre-root start.
      run.dispatch({ kind: 'enterNode', nodeId: run.nodeMap.rootId });
      // Still current (not yet left), so not marked cleared.
      expect(run.visitedNodes.has(run.nodeMap.rootId)).toBe(false);

      // Clear the root battle, recruit, then hop to a child node.
      winEncounter(bus);
      acceptAllRewards(run); // 48f — the full catalog carries reward refs
      run.dispatch({ kind: 'chooseRecruit', unitTemplate: run.currentOffer![0]! });
      const second = run.nodeMap.edges.find((e) => e.from === run.nodeMap.rootId)!.to;
      run.dispatch({ kind: 'enterNode', nodeId: second });
      // Leaving the root marks it cleared — unlike pre-S2, where it was inert.
      expect(run.visitedNodes.has(run.nodeMap.rootId)).toBe(true);
      expect(run.currentNodeId).toBe(second);
    });
  });

  describe('round-trip serialization', () => {
    it('toJSON → fromJSON preserves phase, position, team, and visited set', () => {
      const { run, bus } = freshRunWithBus(7);
      const first = frontierOf(run);
      run.dispatch({ kind: 'enterNode', nodeId: first });
      winEncounter(bus);
      acceptAllRewards(run); // 48b — the selection may carry rewards
      run.dispatch({ kind: 'chooseRecruit', unitTemplate: run.currentOffer![0]! });

      const snap = run.toJSON();
      const restored = Run.fromJSON(snap, new EventBus<GameEvents>());
      expect(restored.phase).toBe(run.phase);
      expect(restored.currentNodeId).toBe(run.currentNodeId);
      expect(restored.team).toEqual(run.team);
      expect(Array.from(restored.visitedNodes)).toEqual(Array.from(run.visitedNodes));
      expect(restored.currentOffer).toBeNull();
      expect(restored.nodeMap).toEqual(run.nodeMap);
      // T2 — the sector cursor round-trips.
      expect(restored.currentSectorId).toBe(run.currentSectorId);
      expect(restored.currentSectorNodeId).toBe(run.currentSectorNodeId);
    });

    it('a restored Run produces the same next encounter as the original', () => {
      // Walk one Run to mid-map, snapshot, restore on a fresh bus, then
      // make the same enterNode call on both — they should agree on the
      // resulting encounter.
      const { run, bus } = freshRunWithBus(7);
      const first = frontierOf(run);
      run.dispatch({ kind: 'enterNode', nodeId: first });
      winEncounter(bus);
      acceptAllRewards(run); // 48b — the selection may carry rewards
      run.dispatch({ kind: 'chooseRecruit', unitTemplate: run.currentOffer![0]! });

      const restored = Run.fromJSON(run.toJSON(), new EventBus<GameEvents>());
      const second = run.nodeMap.edges.find((e) => e.from === first)!.to;
      run.dispatch({ kind: 'enterNode', nodeId: second });
      restored.dispatch({ kind: 'enterNode', nodeId: second });
      expect(restored.currentEncounter).toEqual(run.currentEncounter);
    });
  });

  describe('T2 — sectors', () => {
    // A 2-node fixture DAG (a → b; a is the source, b the sink). Both nodes
    // hold the only shipped sector, so the walk's NODE advances a→b while the
    // sector id stays "the-start" — enough to exercise the advance mechanics.
    const TWO_SECTOR_MAP = SectorMapSchema.parse({
      nodes: [
        { id: 'a', sectors: ['the-start'] },
        { id: 'b', sectors: ['the-start'] },
      ],
      edges: [{ from: 'a', to: 'b' }],
      sources: ['a'],
      sinks: ['b'],
    });

    it('opens on a source DAG node + the shipped sector', () => {
      const { run } = freshRunWithBus(1);
      expect(run.currentSectorId).toBe('the-start');
      expect(run.currentSectorNodeId).toBe('start'); // the shipped one-node DAG
      expect(run.currentNodeId).toBe(PRE_ROOT_NODE_ID);
    });

    it('exposes the current sector title (for the map banner), even at pre-root', () => {
      const { run } = freshRunWithBus(1);
      // Available before any node is entered — derived from config, not hardcoded.
      expect(run.currentNodeId).toBe(PRE_ROOT_NODE_ID);
      expect(run.currentSectorTitle).toBe(getSector('the-start')!.title);
    });

    it('the shipped single-node DAG (source == sink) completes at the terminal', () => {
      const { run, bus } = freshRunWithBus(1);
      run.currentNodeId = run.nodeMap.terminalId;
      run.phase = 'battle';
      let victories = 0;
      bus.on('run:victory', () => victories++);
      winEncounter(bus);
      expect(run.phase).toBe('complete');
      expect(victories).toBe(1);
      expect(run.currentSectorNodeId).toBe('start'); // never advanced
    });

    it('clearing a non-sink terminal advances to the successor sector, carrying roster + pool', () => {
      const { run, bus } = freshRunWithBus(1, { sectorMap: TWO_SECTOR_MAP });
      expect(run.currentSectorNodeId).toBe('a');
      const teamBefore = run.team;
      run.playerHealth = 33; // a sentinel to prove the pool carries across
      run.currentNodeId = run.nodeMap.terminalId;
      run.phase = 'battle';
      let victories = 0;
      bus.on('run:victory', () => victories++);
      winEncounter(bus);
      // Advanced — NOT won — onto a fresh map at the pre-root start.
      expect(victories).toBe(0);
      expect(run.currentSectorNodeId).toBe('b');
      expect(run.phase).toBe('map');
      expect(run.currentNodeId).toBe(PRE_ROOT_NODE_ID);
      expect(run.visitedNodes.size).toBe(0);
      expect(run.nodeMap.terminalId).toBeGreaterThanOrEqual(0);
      // Carry-across: same roster reference + the run-wide pool survive.
      expect(run.team).toBe(teamBefore);
      expect(run.playerHealth).toBe(33);
    });

    it('clearing the final sector terminal (a sink) completes the run', () => {
      const { run, bus } = freshRunWithBus(1, { sectorMap: TWO_SECTOR_MAP });
      // Advance through sector a → b.
      run.currentNodeId = run.nodeMap.terminalId;
      run.phase = 'battle';
      winEncounter(bus);
      expect(run.currentSectorNodeId).toBe('b');
      // Now clear b's terminal — b is a sink → victory.
      run.currentNodeId = run.nodeMap.terminalId;
      run.phase = 'battle';
      let victories = 0;
      bus.on('run:victory', () => victories++);
      winEncounter(bus);
      expect(run.phase).toBe('complete');
      expect(victories).toBe(1);
    });

    it('rejects a pre-T2 (v19) snapshot', () => {
      const { run } = freshRunWithBus(1);
      const wire = JSON.parse(JSON.stringify(run.toJSON()));
      const stale = { ...wire, schemaVersion: 19 };
      expect(() => Run.fromJSON(stale, new EventBus<GameEvents>())).toThrow(
        /unsupported schema version/,
      );
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
      const frontier = frontierOf(run);
      run.dispatch({ kind: 'enterNode', nodeId: frontier });
      expect(run.deploymentCounts).toEqual(new Array(run.team.length).fill(1));
    });

    it('resets at the start of each encounter (a second battle never reads 2)', () => {
      const { run, bus } = freshRunWithBus(1);
      const first = frontierOf(run);
      run.dispatch({ kind: 'enterNode', nodeId: first });
      winEncounter(bus);
      acceptAllRewards(run); // 48f — the full catalog carries reward refs
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
      const first = frontierOf(run);
      run.dispatch({ kind: 'enterNode', nodeId: first });
      const before = run.team.length;
      winEncounter(bus);
      acceptAllRewards(run); // 48f — the full catalog carries reward refs
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
      const frontier = frontierOf(run);
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
      const frontier = frontierOf(run);
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
      const first = frontierOf(run);
      run.dispatch({ kind: 'enterNode', nodeId: first });
      const sizeBefore = run.team.length;
      winEncounter(bus);
      acceptAllRewards(run); // 48f — the full catalog carries reward refs
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
      const frontier = frontierOf(run);
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
      // hopCount 4 → a hop-2 rest is the first reachable rest. Clear the
      // hop-1 battle with no XP so the only XP the team carries into the rest
      // is the rest grant itself (expected level/xp derive from the actual
      // starting level, so this is robust to the startingLevel dial).
      const { run, bus, restId } = driveToRestFrontier({ hopCount: 4 }, 2);
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
        { hopCount: 4, startingRoster: LVL1_ROSTER },
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
      // hop-1 recruit comes in at round(avg)+bonus, so it may be level 2 and
      // skip promotion — don't require it.
      expect(promotions[0]).toEqual(expect.arrayContaining([0, 1, 2, 3, 4]));

      run.dispatch({ kind: 'dismissPromotion' });
      expect(run.phase).toBe('map'); // back to the map, NOT recruit
      expect(recruitOffers).toBe(0);
    });

    it('returns to the map silently when no unit levels up', () => {
      // hopCount 5 → a hop-3 rest. G4: recruits arrive at round(avgTeamLevel)
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
        { hopCount: 5, startingRoster },
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

    it('a boss node selects a boss-kind encounter (W) and a win completes the run', () => {
      // hopCount 2 → root (hop 0, a normal battle) -> terminal boss (hop 1).
      // S2: clear the root battle first, then the boss is the frontier.
      const bus = new EventBus<GameEvents>();
      const run = new Run(1, bus, { hopCount: 2 });
      const boss = run.nodeMap.terminalId;
      expect(run.nodeMap.nodes.find((n) => n.id === boss)!.kind).toBe('boss');
      let battleStarts = 0;
      bus.on('battle:started', () => battleStarts++);

      // Clear the root battle + its recruit so the boss becomes the frontier.
      run.dispatch({ kind: 'enterNode', nodeId: run.nodeMap.rootId });
      // The root is a normal battle node → a normal encounter.
      expect(run.selectedEncounter!.kind).toBe('normal');
      winEncounter(bus);
      acceptAllRewards(run); // 48f — the full catalog carries reward refs
      run.dispatch({ kind: 'chooseRecruit', unitTemplate: run.currentOffer![0]! });

      run.dispatch({ kind: 'enterNode', nodeId: boss });
      expect(run.phase).toBe('battle');
      expect(battleStarts).toBe(2); // root + boss
      expect(run.currentEncounter).not.toBeNull();
      // W — the boss node draws from the sector's boss pool, not the normal pool.
      expect(run.selectedEncounter!.kind).toBe('boss');

      // And a win at the boss completes the run (existing terminal path). The
      // boss pool is deeper than the default, so chip its actual pool to drain it.
      winEncounter(bus, [], run.enemyHealthPoolMax);
      // 48f — boss rewards fire BEFORE run:victory (uniform on terminal wins,
      // per the shape-lock); resolve them to reach the completion.
      acceptAllRewards(run);
      expect(run.phase).toBe('complete');
    });

    it('H6a — heals the run-wide player pool by restHealAmount when wounded', () => {
      const { run, restId } = driveToRestFrontier({ hopCount: 4 }, 2);
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
      const { run, restId } = driveToRestFrontier({ hopCount: 4 }, 2);
      // Already full: the heal must clamp, never overfill (robust for any knob).
      run.playerHealth = HEALTH.playerHealthMax;

      run.dispatch({ kind: 'enterNode', nodeId: restId });

      expect(run.playerHealth).toBe(HEALTH.playerHealthMax);
    });
  });
});

describe('48b — the reward phase', () => {
  /** A daemon-less run forced onto brigands (which ships the 48a skeleton
   *  ref: `bits-small` at chance 1), driven to a one-turn encounter win.
   *  Daemon-less so the bits fold starts at identity. */
  function winWithRewards(
    seed = 1,
    xpAwards: GameEvents['battle:ended']['xpAwards'] = [],
  ): RunHandle {
    const handle = freshRunWithBus(seed, { daemon: null, forcedEncounterId: 'brigands' });
    handle.run.dispatch({ kind: 'enterNode', nodeId: frontierOf(handle.run) });
    winEncounter(handle.bus, xpAwards);
    return handle;
  }

  /** The 48a skeleton table's authored bits range (balance-proof: derived
   *  from config, never hardcoded). */
  function skeletonRange(): { min: number; max: number } {
    const entry = rewardTableById('bits-small')!.entries[0]!;
    if (entry.kind !== 'bits') throw new Error('expected the bits skeleton entry');
    return { min: entry.min, max: entry.max };
  }

  it('a won rewards-carrying encounter enters the reward phase FIRST, recruit deferred', () => {
    const { run, bus } = freshRunWithBus(1, { daemon: null, forcedEncounterId: 'brigands' });
    const offered: number[] = [];
    const recruits: number[] = [];
    bus.on('reward:offered', ({ rewards }) => offered.push(rewards.length));
    bus.on('recruit:offered', ({ units }) => recruits.push(units.length));
    run.dispatch({ kind: 'enterNode', nodeId: frontierOf(run) });
    winEncounter(bus);
    expect(run.phase).toBe('reward');
    expect(offered).toEqual([1]);
    expect(recruits).toEqual([]);
    expect(run.currentOffer).toBeNull();
    const portion = run.pendingRewards![0]!;
    if (portion.kind !== 'bits') throw new Error('expected a bits portion');
    const { min, max } = skeletonRange();
    expect(portion.base).toBeGreaterThanOrEqual(min);
    expect(portion.base).toBeLessThanOrEqual(max);
  });

  it('acceptReward settles bits through the shared settle math and advances to recruit', () => {
    const { run, bus } = winWithRewards();
    const portion = run.pendingRewards![0]!;
    if (portion.kind !== 'bits') throw new Error('expected a bits portion');
    const deltas: number[] = [];
    bus.on('run:bitsChanged', ({ delta }) => deltas.push(delta));
    run.dispatch({ kind: 'acceptReward', index: 0 });
    // Daemon-less run: the fold is identity, so effective === base — but the
    // assertion derives through the SAME helper the screen will use.
    expect(run.bits).toBe(run.effectiveBits(portion.base));
    expect(deltas).toEqual([run.effectiveBits(portion.base)]);
    expect(run.pendingRewards).toBeNull();
    expect(run.phase).toBe('recruit');
  });

  it('declineReward leaves bits untouched and advances', () => {
    const { run } = winWithRewards();
    run.dispatch({ kind: 'declineReward', index: 0 });
    expect(run.bits).toBe(0);
    expect(run.pendingRewards).toBeNull();
    expect(run.phase).toBe('recruit');
  });

  it('a rewards-less encounter skips the phase entirely (the promotions.length shape)', () => {
    const { run, bus } = freshRunWithBus(1, { daemon: null, forcedEncounterId: 'highwaymen' });
    const offered: unknown[] = [];
    bus.on('reward:offered', (o) => offered.push(o));
    run.dispatch({ kind: 'enterNode', nodeId: frontierOf(run) });
    // 48f — every catalog encounter now references a table, so the rewards-less
    // shape is SYNTHESIZED: swap the held selection for a stripped clone (a
    // plain field; the shared catalog object is never mutated). The win-boundary
    // roller reads `selectedEncounter`, so this exercises the real skip path.
    const { rewards: _stripped, ...noRewards } = run.selectedEncounter!;
    run.selectedEncounter = noRewards as typeof run.selectedEncounter;
    winEncounter(bus);
    expect(offered).toEqual([]);
    expect(run.pendingRewards).toBeNull();
    expect(run.phase).toBe('recruit');
  });

  it('the gate chain orders reward → promotion → recruit (the shape-locked sequence)', () => {
    // A roster-level-independent award (levels slot 0 to the cap) — the
    // starting roster's rolled levels vary by seed.
    const { run } = winWithRewards(2, [
      { unitId: 1, rosterIndex: 0, damageDealt: 0, xpGained: 100_000 },
    ]);
    // Rewards interpose FIRST even though a promotion is banked.
    expect(run.phase).toBe('reward');
    expect(run.pendingPromotions).not.toBeNull();
    run.dispatch({ kind: 'acceptReward', index: 0 });
    expect(run.phase).toBe('promotion');
    run.dispatch({ kind: 'dismissPromotion' });
    expect(run.phase).toBe('recruit');
  });

  it('an accepted daemon joins ownership immediately and re-derives later bits portions', () => {
    const { run } = winWithRewards();
    // Overwrite the live offer with the Moneta-order edge: daemon first,
    // bits second (the shape-lock rider's motivating case).
    run.pendingRewards = [
      { kind: 'daemon', daemonId: 'moneta' },
      { kind: 'bits', base: 10 },
    ];
    run.dispatch({ kind: 'acceptReward', index: 0 });
    expect(run.ownedDaemonIds().has('moneta')).toBe(true);
    expect(run.phase).toBe('reward'); // the bits portion is still pending
    // Balance-proof: the expected boost derives from moneta's authored rule.
    const monetaRule = daemonById('moneta')!.rules!.find((r) => r.kind === 'modifier')!;
    if (monetaRule.kind !== 'modifier') throw new Error('expected a modifier rule');
    const expected = Math.round(10 * monetaRule.value);
    expect(run.effectiveBits(10)).toBe(expected);
    run.dispatch({ kind: 'acceptReward', index: 0 });
    expect(run.bits).toBe(expected);
    expect(run.phase).toBe('recruit');
  });

  it('stray reward commands are silent no-ops (wrong phase / out-of-range index)', () => {
    const { run } = freshRunWithBus(1, { daemon: null });
    run.dispatch({ kind: 'acceptReward', index: 0 }); // phase 'map' — nothing
    expect(run.bits).toBe(0);
    expect(run.phase).toBe('map');
    const handle = winWithRewards();
    const before = handle.run.pendingRewards!.slice();
    handle.run.dispatch({ kind: 'acceptReward', index: 99 });
    expect(handle.run.pendingRewards).toEqual(before);
    expect(handle.run.phase).toBe('reward');
  });

  it('a mid-reward save reproduces the pending offer (the §48 exit-criterion contract)', () => {
    const { run } = winWithRewards();
    const wire = JSON.parse(JSON.stringify(run.toJSON())) as ReturnType<Run['toJSON']>;
    const restored = Run.fromJSON(wire, new EventBus<GameEvents>());
    expect(restored.phase).toBe('reward');
    expect(restored.pendingRewards).toEqual(run.pendingRewards);
    const portion = restored.pendingRewards![0]!;
    if (portion.kind !== 'bits') throw new Error('expected a bits portion');
    restored.dispatch({ kind: 'acceptReward', index: 0 });
    expect(restored.bits).toBe(restored.effectiveBits(portion.base));
    expect(restored.phase).toBe('recruit');
  });

  it('fromJSON hard-rejects a pending reward naming an unknown daemon (no silent drops)', () => {
    const { run } = winWithRewards();
    const wire = run.toJSON();
    wire.pendingRewards = [{ kind: 'daemon', daemonId: 'ghost' }];
    expect(() => Run.fromJSON(wire, new EventBus<GameEvents>())).toThrow(
      /unknown daemon id 'ghost'/,
    );
  });
});

/**
 * H4 — emit a `battle:ended` whose PLAYER survivors chip the enemy pool by
 * `HEALTH.enemyHealthMax`, guaranteeing the encounter is won in this one turn
 * (the common "resolve this node now" case the pre-H4 tests assumed). Any
 * `xpAwards` bank at encounter end as usual. W: a deeper-pooled encounter (the
 * boss) needs a bigger chip — pass `poolMax` (`run.enemyHealthPoolMax`) to drain
 * it in one turn regardless of size.
 */
function winEncounter(
  bus: EventBus<GameEvents>,
  xpAwards: GameEvents['battle:ended']['xpAwards'] = [],
  // A decisive win must clear the enemy pool in ONE chip. Post-X3 encounters pool
  // at their authored `healthPool` — some normals deeper than HEALTH.enemyHealthMax
  // (highwaymen/deserters), bosses deeper still — so the default over-chips by a
  // wide margin; resolveTurn floors enemyHealth at 0, so the excess is harmless and
  // the encounter resolves as a win regardless of pool depth. Pass an explicit
  // poolMax only for partial-chip / multi-turn cases (those use chipTurn anyway).
  poolMax: number = 1_000,
  // 47f — optional battle tally (the settle-seam tests); absent = the
  // pre-47f no-tally emit, which Run treats as zero.
  tallies?: GameEvents['battle:ended']['tallies'],
): void {
  bus.emit('battle:ended', {
    winner: 'player',
    xpAwards,
    survivorPower: { player: poolMax, enemy: 0 },
    ...(tallies !== undefined ? { tallies } : {}),
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
  // 47f — optional battle tally (the settle-seam tests).
  tallies?: GameEvents['battle:ended']['tallies'],
): void {
  bus.emit('battle:ended', {
    winner: 'draw',
    xpAwards,
    survivorPower,
    ...(tallies !== undefined ? { tallies } : {}),
  });
}

function driveToRecruitPhase(run: Run, bus: EventBus<GameEvents>): void {
  const frontier = frontierOf(run);
  run.dispatch({ kind: 'enterNode', nodeId: frontier });
  winEncounter(bus);
  // 48b — the sector pool can select a rewards-carrying encounter (brigands
  // ships the 48a skeleton ref), which interposes the reward phase first.
  acceptAllRewards(run);
}

/** 48b — resolve a pending reward offer by accepting every portion (the
 *  harness policy). A no-op when the win rolled no rewards. */
function acceptAllRewards(run: Run): void {
  while (run.phase === 'reward') run.dispatch({ kind: 'acceptReward', index: 0 });
}

/** 48f — resolve a pending reward offer by DECLINING every portion, for tests
 *  that assert an exact bits balance a rolled reward would pollute. A no-op
 *  when the win rolled no rewards. */
function declineAllRewards(run: Run): void {
  while (run.phase === 'reward') run.dispatch({ kind: 'declineReward', index: 0 });
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

/** The next selectable node from wherever the run currently sits — the root at
 *  the pre-root start (S2), else the current node's first outgoing edge. The
 *  standard "enter the next battle" hop. */
function frontierOf(run: Run): number {
  if (run.currentNodeId === PRE_ROOT_NODE_ID) return run.nodeMap.rootId;
  return run.nodeMap.edges.find((e) => e.from === run.currentNodeId)!.to;
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
 * Search seeds for a map (under `config`) with a rest node on hop `hop`,
 * and return a fresh Run/bus on that seed plus the root→…→rest path (node ids,
 * including the root at index 0 and the rest last). Every hop before the rest
 * is a battle by construction (hop 1 is never rest-eligible and the
 * min-spacing rule keeps the hop below a rest a battle), so the path can be
 * cleared with ordinary battle resolutions.
 */
function findRestRun(
  config: RunConfig,
  hop: number,
): { run: Run; bus: EventBus<GameEvents>; path: number[] } {
  for (let s = 0; s < 800; s++) {
    const bus = new EventBus<GameEvents>();
    const run = new Run(s, bus, config);
    const rest = run.nodeMap.nodes.find((n) => n.kind === 'rest' && n.hop === hop);
    if (!rest) continue;
    const path = [rest.id];
    let cur = rest.id;
    while (run.nodeMap.nodes.find((n) => n.id === cur)!.hop > 0) {
      const parent = run.nodeMap.edges.find((e) => e.to === cur)!.from;
      path.unshift(parent);
      cur = parent;
    }
    const intermediate = path.slice(1, -1).map((id) => run.nodeMap.nodes.find((n) => n.id === id)!.kind);
    if (intermediate.some((k) => k !== 'battle')) continue;
    return { run, bus, path };
  }
  throw new Error(`findRestRun: no seed with a rest on hop ${hop}`);
}

/**
 * Drive a Run up to (but not into) a rest node on hop `hop`: clear every
 * intervening battle with `awardsForHop` (default: no XP) and the mandatory
 * recruit, leaving the rest as the current frontier. Returns the rest id.
 */
function driveToRestFrontier(
  config: RunConfig,
  hop: number,
  awardsForHop: (run: Run, hop: number) => GameEvents['battle:ended']['xpAwards'] = () => [],
): { run: Run; bus: EventBus<GameEvents>; restId: number } {
  const { run, bus, path } = findRestRun(config, hop);
  const restId = path[path.length - 1]!;
  // S2 — the player enters the ROOT first (it's a normal battle now), so the
  // walk starts at path[0]; the rest (path[last]) is left as the frontier.
  for (let i = 0; i < path.length - 1; i++) {
    run.dispatch({ kind: 'enterNode', nodeId: path[i]! });
    // Clear the FULL encounter pool in one win-chip — post-X3 some normals pool
    // deeper than HEALTH.enemyHealthMax (highwaymen/deserters), so chip by the
    // selected encounter's actual healthPool rather than the default 8.
    winEncounter(bus, awardsForHop(run, i), run.enemyHealthPoolMax);
    // 48b — a rewards-carrying selection interposes the reward phase first.
    acceptAllRewards(run);
    // A battle whose awards level a unit pauses on promotion first; clear it
    // so we land in the recruit phase (the mandatory post-battle recruit).
    if (run.phase === 'promotion') run.dispatch({ kind: 'dismissPromotion' });
    run.dispatch({ kind: 'chooseRecruit', unitTemplate: run.currentOffer![0]! });
  }
  return { run, bus, restId };
}
