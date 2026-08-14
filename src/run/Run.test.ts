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
import { ARCHETYPE_CONFIG, DRAFTABLE_BY_TIER } from '../sim/archetypes';
import { scaleStats } from '../sim/leveling';
import { xpToNext } from '../sim/xp';
import { LEVELING } from '../config/leveling';
import { DIFFICULTY } from '../config/difficulty';
import { RECRUITMENT } from '../config/recruitment';
import { HEALTH } from '../config/health';
import { DECK } from '../config/deck';
import { EMPOWER } from '../config/empower';
import { DAEMONS, daemonById, type DaemonConfig } from '../config/daemons';
import { characterById, DEFAULT_CHARACTER_ID } from '../config/characters';
import { PACKETS, packetById } from '../config/packets';
import { rewardTableById } from '../config/rewards';
import { daemonRedrawHook, daemonEmpowerHook } from './daemon';
import { RUN_STAT_BASES } from './runStats';
import { ECONOMY } from '../config/economy';
import { PRICES, unitPrice, packetPrice, daemonPrice, sellPrice } from '../config/prices';
import { avgTeamLevel } from './enemyBudget';
import { FORCE_PROCEDURAL, type RunConfig } from './RunConfig';
import type { EventDef, EventEffectOp } from '../config/events';
import { RNG } from '../core/RNG';
import { rollUnit } from '../sim/archetypes';

/**
 * L1→47c — the K3/K4 static defaults reborn as a guaranteed fixture daemon.
 * Daemon-only gates retired the `DECK.redraw.enabled` / `EMPOWER.enabled`
 * statics (both now ship false), so the pre-existing K3/K4 gate-mechanic tests
 * run under this daemon instead: its knobs ARE the config dials (derived, not
 * hardcoded), which keeps every `DECK.redraw.*` / `EMPOWER.*`-derived
 * expectation in those blocks literally true. 47c: authored as `rules`
 * (redraw hook FIRST — the fixed draw-order discipline).
 */
/**
 * 74i-c — the event-free control fixture. The Start authors a starting
 * event now (`sector-1-start` — every shipped run OPENS on it), so any
 * test whose subject is the root BATTLE suppresses the catalog: an empty
 * catalog resolves no pool entry and every event-node entry degrades to
 * the fight (the 74b empty-eligible rule). The root's STAMPED kind and
 * the battle-side streams are untouched (eventRng is dedicated), so
 * battle expectations hold byte-identically. Tests about events pass
 * their own catalogs; tests about the map's new shape assert the stamp.
 */
const NO_EVENTS = { eventCatalog: [] as EventDef[] };

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
      const run = new Run(1, new EventBus<GameEvents>(), NO_EVENTS);
      expect(run.phase).toBe('map');
      // S2 — the run begins at the virtual pre-root; the root is selected as the
      // first encounter rather than being the inert starting cell.
      expect(run.currentNodeId).toBe(PRE_ROOT_NODE_ID);
    });

    it("63c: rolls the DEFAULT CHARACTER's starting roster (derived from characters.json)", () => {
      const run = new Run(1, new EventBus<GameEvents>(), NO_EVENTS);
      // Derived from the character def, not hardcoded — a roster edit in
      // characters.json must not silently break this.
      const expected = characterById(DEFAULT_CHARACTER_ID)!.roster;
      expect(run.team.map((t) => t.archetype)).toEqual([...expected]);
      for (const t of run.team) expect(t.level).toBe(RECRUITMENT.startingLevel);
    });

    it('emits run:started on construction', () => {
      const bus = new EventBus<GameEvents>();
      const seen: number[] = [];
      bus.on('run:started', ({ seed }) => seen.push(seed));
      new Run(42, bus);
      expect(seen).toEqual([42]);
    });
  });

  describe('63c — starting characters', () => {
    const priest = characterById('priest')!;
    const gambler = characterById('gambler')!;

    /** Drive one victory to the recruit offer (the handleBattleEnded shape). */
    const firstOffer = (seed: number, config?: RunConfig) => {
      const { run, bus } = freshRunWithBus(seed, config);
      run.dispatch({ kind: 'enterNode', nodeId: frontierOf(run) });
      winEncounter(bus);
      acceptAllRewards(run);
      return run.currentOffer ?? [];
    };

    it('a bare constructor resolves to the default character', () => {
      const { run } = freshRunWithBus(1);
      expect(run.character.id).toBe(DEFAULT_CHARACTER_ID);
    });

    it("RunConfig.character drives the roster + daemon (derived from the def, not hardcoded)", () => {
      for (const character of [priest, gambler]) {
        const { run } = freshRunWithBus(2, { character });
        expect(run.character.id).toBe(character.id);
        expect(run.team.map((t) => t.archetype)).toEqual([...character.roster]);
        expect(run.daemons.map((d) => d.id)).toEqual([character.daemon]);
      }
    });

    it('an explicit daemon override BEATS the character daemon (the precedence fork)', () => {
      expect(freshRunWithBus(3, { character: priest, daemon: null }).run.daemons).toEqual([]);
      expect(
        freshRunWithBus(3, { character: priest, daemon: daemonById('mars')! }).run.daemons.map(
          (d) => d.id,
        ),
      ).toEqual(['mars']);
    });

    it('an explicit startingRoster override BEATS the character roster', () => {
      const { run } = freshRunWithBus(4, {
        character: priest,
        startingRoster: [{ archetype: 'rogue', level: 2 }],
      });
      expect(run.team.map((t) => t.archetype)).toEqual(['rogue']);
      // The rest of the character still applies (daemon untouched by roster).
      expect(run.daemons.map((d) => d.id)).toEqual([priest.daemon]);
    });

    it("the character blacklist governs recruit offers (priest never sees what soldier can)", () => {
      // The Priest adds 'shaman'; the same seed scan under the Soldier DOES
      // surface it — the non-vacuousness guard for the exclusion assertion.
      const [excluded] = priest.blacklist;
      expect(excluded).toBeDefined();
      let soldierSaw = 0;
      for (let seed = 0; seed < 120; seed++) {
        for (const u of firstOffer(seed)) if (u.archetype === excluded) soldierSaw++;
        for (const u of firstOffer(seed, { character: priest })) {
          expect(u.archetype).not.toBe(excluded);
        }
      }
      expect(soldierSaw).toBeGreaterThan(0);
    });

    it('weight overrides skew offers (gambler outdraws soldier on the boosted archetype, paired seeds)', () => {
      // The Gambler triples 'rogue' within its tier; same-seed pairing makes
      // the comparison deterministic — over the scan the boosted arm must see
      // strictly more of it.
      const boosted = Object.keys(gambler.weightOverrides)[0]!;
      let soldierCount = 0;
      let gamblerCount = 0;
      for (let seed = 0; seed < 120; seed++) {
        for (const u of firstOffer(seed)) if (u.archetype === boosted) soldierCount++;
        for (const u of firstOffer(seed, { character: gambler })) {
          if (u.archetype === boosted) gamblerCount++;
        }
      }
      expect(gamblerCount).toBeGreaterThan(soldierCount);
    });

    it('round-trips the character BY ID (v38)', () => {
      const { run, bus } = freshRunWithBus(5, { character: gambler });
      const snap = run.toJSON();
      expect(snap.characterId).toBe('gambler');
      const restored = Run.fromJSON(JSON.parse(JSON.stringify(snap)), bus);
      expect(restored.character.id).toBe('gambler');
      expect(restored.daemons.map((d) => d.id)).toEqual([gambler.daemon]);
    });

    it('fromJSON hard-rejects an unknown character id (the daemonIds discipline)', () => {
      const { run, bus } = freshRunWithBus(6);
      const snap = { ...run.toJSON(), characterId: 'no-such-character' };
      expect(() => Run.fromJSON(snap, bus)).toThrow(/unknown character id/);
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

    it('the root is the STAMPED starting event at hop 0 (74i-c — never a boss) on a multi-hop map', () => {
      // The Start authors `startingEvents` now, so every shipped run OPENS
      // on the sector-stamped event root (74e's stampRootKind, live since
      // 74i-c placement). The stamp is sector-driven — catalog suppression
      // (NO_EVENTS) changes entry BEHAVIOR (degrades to the fight), not the
      // node's kind.
      const { run } = freshRunWithBus(1);
      const rootNode = run.nodeMap.nodes.find((n) => n.id === run.nodeMap.rootId)!;
      expect(rootNode.kind).toBe('event');
      expect(rootNode.hop).toBe(0);
    });
  });

  describe('68b — construction grants (the marginal-value seam)', () => {
    it('grants a daemon by id on top of the character daemon', () => {
      const run = new Run(1, new EventBus<GameEvents>(), { grants: ['portunus'] });
      expect(run.daemons.map((d) => d.id)).toContain('portunus');
      // The character's own daemon is untouched — a grant ADDS, never replaces.
      expect(run.daemons.length).toBe(2);
    });

    it('grants a packet into the cache', () => {
      const run = new Run(1, new EventBus<GameEvents>(), { grants: ['patch'] });
      expect(run.cache).toEqual(['patch']);
    });

    it('grants a unit at the recruit starting level through the roster chokepoint', () => {
      const bare = new Run(1, new EventBus<GameEvents>(), NO_EVENTS);
      const run = new Run(1, new EventBus<GameEvents>(), { grants: ['rogue'] });
      expect(run.team).toHaveLength(bare.team.length + 1);
      const granted = run.team[run.team.length - 1]!;
      expect(granted.archetype).toBe('rogue');
      expect(granted.level).toBe(RECRUITMENT.startingLevel);
      // 50d — the parallel structures grew with the roster (the chokepoint proof).
      const parallel = run as unknown as { deploymentCounts: number[] };
      expect(parallel.deploymentCounts).toHaveLength(run.team.length);
    });

    it('an inert daemon/packet grant leaves the run stream byte-identical (the paired-arm contract)', () => {
      const bare = new Run(7, new EventBus<GameEvents>(), NO_EVENTS);
      const granted = new Run(7, new EventBus<GameEvents>(), {
        grants: ['patch', 'portunus'],
      });
      expect(granted.nodeMap).toEqual(bare.nodeMap);
      expect(granted.team).toEqual(bare.team);
      expect(granted.bossEncounterId).toBe(bare.bossEncounterId);
    });

    it('throws loud on an unknown id', () => {
      expect(() => new Run(1, new EventBus<GameEvents>(), { grants: ['no-such-thing'] })).toThrow(
        /not a daemon, packet, or unit archetype/,
      );
    });
  });

  describe('determinism', () => {
    it('same seed → same nodeMap and same starting team', () => {
      const a = new Run(42, new EventBus<GameEvents>(), NO_EVENTS);
      const b = new Run(42, new EventBus<GameEvents>(), NO_EVENTS);
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
        ...NO_EVENTS,
        startingRoster: [
          { archetype: 'mercenary', level: 6 },
          { archetype: 'mercenary', level: 6 },
          { archetype: 'archer', level: 6 },
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

    it('winning at the terminal node routes to the sector gate (not recruit)', () => {
      const { run, bus } = freshRunWithBus(1);
      // Force currentNodeId to the terminal so the next battle's win is the
      // final one. Manual state surgery is acceptable for this targeted
      // test — driving a full run is the browser-verify path.
      // 67c: The Start's terminal is no longer a sink, so the win lands on
      // the 67a gate; sink completion is pinned in the sector-walk suite.
      run.currentNodeId = run.nodeMap.terminalId;
      run.phase = 'battle';
      let victoryCount = 0;
      let offeredCount = 0;
      bus.on('run:victory', () => victoryCount++);
      bus.on('recruit:offered', () => offeredCount++);
      winEncounter(bus);
      expect(run.phase).toBe('sectorCleared');
      expect(victoryCount).toBe(0);
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

    it('dismissPromotion at the terminal node routes to the sector gate (not recruit)', () => {
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
      // 67c: the terminal win exits the promotion into the 67a gate (The
      // Start's terminal stopped being a sink) — still never a recruit.
      expect(run.phase).toBe('sectorCleared');
      expect(victoryCount).toBe(0);
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
      const run = new Run(1, new EventBus<GameEvents>(), NO_EVENTS);
      expect(run.playerHealth).toBe(HEALTH.playerHealthMax);
      expect(run.enemyHealth).toBe(0);
      expect(run.turnIndex).toBe(0);
    });

    it('beginEncounter selects the encounter + fills its pool; playerHealth untouched', () => {
      const { run } = freshRunWithBus(1);
      const frontier = frontierOf(run);
      run.dispatch({ kind: 'enterNode', nodeId: frontier });
      // Selection picks one of "The Start"'s pooled encounters — which one is
      // seed-dependent; assert it's a real catalog pick, derived from the live
      // pool (not a frozen name list) so new catalog content can't stale this.
      // Wb4 — the fight pool is per-kind; flatten all kinds for the name check.
      const pool = getSector('the-start')!.encounters;
      const pooled = [...pool.normal, ...pool.elite, ...pool.boss].map(
        (e) => getEncounter(e.encounterId)!,
      );
      const selected = pooled.find((e) => e.name === run.currentEncounterName);
      expect(selected).toBeDefined();
      // V1 — the pool comes from the SELECTED encounter's AUTHORED healthPool
      // (77d2 re-derived this from the catalog instead of assuming the old
      // global HEALTH.enemyHealthMax — some catalog fights pool deeper, and a
      // stream break re-deals which one seed 1 selects).
      expect(run.enemyHealth).toBe(selected!.healthPool);
      expect(run.enemyHealthPoolMax).toBe(selected!.healthPool);
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
      // 77d2 — derive the pool from the selected encounter (seed-robust).
      const pool = run.enemyHealth;
      expect(pool).toBeGreaterThanOrEqual(2);

      // A 1-power chip can't empty the pool (pool >= 2) → another turn starts.
      chipTurn(bus, { player: 1, enemy: 0 });
      expect(run.phase).toBe('battle');
      expect(run.enemyHealth).toBe(pool - 1);
      expect(run.turnIndex).toBe(1);
      expect(starts).toHaveLength(2); // turn 2 spun up

      // A chip >= the remaining pool empties it → encounter won → recruit.
      chipTurn(bus, { player: pool, enemy: 0 });
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
      // 77d2 — reset-to-max derived from the NEW encounter's own pool.
      expect(run.enemyHealth).toBe(run.enemyHealthPoolMax);
      expect(run.enemyHealth).toBeGreaterThan(0);
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

      chipTurn(bus, { player: run.enemyHealth, enemy: 0 }, [
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
      // 77d2 — the payload's pool is the selected encounter's own.
      expect(starting[0]!.enemyHealth).toBe(run.enemyHealthPoolMax);
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
      // 77d2 — derived from the selected encounter's own pool.
      expect(resolved[0]!.enemyHealth).toBe(run.enemyHealthPoolMax - 1);
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

      chipTurn(bus, { player: run.enemyHealth, enemy: 0 }); // lethal → won (pool-derived, 77d2)
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
      // (49d: K_DEFAULT_DAEMON's queue is [redraw@0, empower@1].)
      run.dispatch({ kind: 'redrawCards', handIndices: [3, 1], grantIndex: 0 });
      expect(run.hand).toHaveLength(before.length);
      expect(run.hand[1]).toBe(pile[pile.length - 1]);
      expect(run.hand[3]).toBe(pile[pile.length - 2]);
      before.forEach((card, i) => {
        if (i !== 1 && i !== 3) expect(run.hand[i]).toBe(card);
      });
      expect(run.discardPile).toEqual(expect.arrayContaining([before[1]!, before[3]!]));
    });

    it('consumes the grant budget; a request past it is a silent no-op (49d: per-source)', () => {
      const { run } = gatedToFirstTurnIntro(2);
      // Burn the redraw grant's action budget (derived from the config dial
      // the fixture daemon authors from).
      const budget = DECK.redraw.redrawsPerTurn;
      for (let i = 0; i < budget; i++) {
        run.dispatch({ kind: 'redrawCards', handIndices: [0], grantIndex: 0 });
      }
      expect(run.grantViews()[0]!.remaining).toBe(0);
      const hand = run.hand.slice();
      run.dispatch({ kind: 'redrawCards', handIndices: [0], grantIndex: 0 });
      expect(run.hand).toEqual(hand);
      expect(run.grantViews()[0]!.remaining).toBe(0);
    });

    it('a rejected selection consumes no budget, mutates nothing, emits nothing', () => {
      const { run, bus } = gatedToFirstTurnIntro(3);
      let emits = 0;
      bus.on('turn:handRedrawn', () => emits++);
      const hand = run.hand.slice();
      run.dispatch({ kind: 'redrawCards', handIndices: [], grantIndex: 0 }); // empty
      run.dispatch({ kind: 'redrawCards', handIndices: [0, 0], grantIndex: 0 }); // duplicate
      run.dispatch({ kind: 'redrawCards', handIndices: [run.hand.length], grantIndex: 0 }); // range
      // 49d — grant-targeting rejects: the wrong KIND (index 1 is the
      // empower grant) and an out-of-range queue index.
      run.dispatch({ kind: 'redrawCards', handIndices: [0], grantIndex: 1 });
      run.dispatch({ kind: 'redrawCards', handIndices: [0], grantIndex: 99 });
      expect(run.hand).toEqual(hand);
      expect(run.grantViews()[0]!.remaining).toBe(DECK.redraw.redrawsPerTurn);
      expect(emits).toBe(0);
    });

    it('is a no-op outside the pre-turn gate (map phase, headless battle)', () => {
      const { run } = freshRunWithBus(4, { daemon: K_DEFAULT_DAEMON });
      run.dispatch({ kind: 'redrawCards', handIndices: [0], grantIndex: 0 }); // map
      expect(run.grantViews()).toEqual([]); // no turn resolved yet
      run.dispatch({ kind: 'enterNode', nodeId: frontierOf(run) }); // gates off → battle
      expect(run.phase).toBe('battle');
      const hand = run.hand.slice();
      run.dispatch({ kind: 'redrawCards', handIndices: [0], grantIndex: 0 });
      expect(run.hand).toEqual(hand);
      expect(run.grantViews()[0]!.remaining).toBe(DECK.redraw.redrawsPerTurn);
    });

    it('the budget resets at the next turn (a fresh queue per resolution)', () => {
      const { run, bus } = gatedToFirstTurnIntro(5);
      run.dispatch({ kind: 'redrawCards', handIndices: [0], grantIndex: 0 });
      expect(run.grantViews()[0]!.remaining).toBe(DECK.redraw.redrawsPerTurn - 1);
      run.dispatch({ kind: 'advanceTurn' }); // → battle
      chipTurn(bus, { player: 1, enemy: 1 }); // sub-lethal → ongoing
      run.dispatch({ kind: 'advanceTurn' }); // → next turn's gate
      expect(run.phase).toBe('turn-intro');
      expect(run.grantViews()[0]!.remaining).toBe(DECK.redraw.redrawsPerTurn);
    });

    it('turn:starting carries the fresh queue; turn:handRedrawn the new hand + decrement', () => {
      const { run, bus } = freshRunWithBus(6, { daemon: K_DEFAULT_DAEMON });
      run.pauseAtTurnGates = true;
      const startings: GameEvents['turn:starting'][] = [];
      const redrawns: GameEvents['turn:handRedrawn'][] = [];
      bus.on('turn:starting', (p) => startings.push(p));
      bus.on('turn:handRedrawn', (p) => redrawns.push(p));
      run.dispatch({ kind: 'enterNode', nodeId: frontierOf(run) });
      // Fresh queue straight off the fixture daemon's dials (= the config
      // dials): redraw first (authored order), the CURSOR, then empower.
      expect(startings[0]!.grants.map((g) => g.effect.kind)).toEqual(['redraw', 'empower']);
      expect(startings[0]!.grants[0]).toMatchObject({
        grantIndex: 0,
        effect: {
          kind: 'redraw',
          budget: DECK.redraw.redrawsPerTurn,
          maxCards: DECK.redraw.maxCardsPerTurn,
        },
        remaining: DECK.redraw.redrawsPerTurn,
        passed: false,
        active: true,
      });
      run.dispatch({ kind: 'redrawCards', handIndices: [0, 2], grantIndex: 0 });
      expect(redrawns).toHaveLength(1);
      expect(redrawns[0]!.hand).toEqual(run.hand.map((idx) => run.team[idx]!));
      expect(redrawns[0]!.grants).toEqual(run.grantViews());
      expect(redrawns[0]!.grants[0]!.remaining).toBe(DECK.redraw.redrawsPerTurn - 1);
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
      run.dispatch({ kind: 'redrawCards', handIndices: [0], grantIndex: 0 });
      expect(redrawns).toHaveLength(1);
      expect(redrawns[0]!.drawPile).toEqual(inRecruitmentOrder(run.drawPile));
      expect(redrawns[0]!.discardPile).toEqual(inRecruitmentOrder(run.discardPile));
    });

    it('a redrawn-away unit accrues no deployment count; its replacement is counted', () => {
      const { run } = gatedToFirstTurnIntro(7);
      expect(run.drawPile.length).toBeGreaterThan(0); // replacement ≠ benched below
      const benched = run.hand[0]!;
      run.dispatch({ kind: 'redrawCards', handIndices: [0], grantIndex: 0 });
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
      run.dispatch({ kind: 'redrawCards', handIndices: sel, grantIndex: 0 });
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
        run.dispatch({ kind: 'redrawCards', handIndices: [4, 0], grantIndex: 0 });
        run.dispatch({ kind: 'advanceTurn' });
      }
      expect(JSON.parse(JSON.stringify(a.run.toJSON()))).toEqual(
        JSON.parse(JSON.stringify(b.run.toJSON())),
      );
    });

    it('round-trips the grant queue (a save at the gate must not refresh a spent budget)', () => {
      // 47d — save/reload needs a CATALOG daemon (bespoke ids hard-reject on
      // load); janus is the guaranteed-redraw idol.
      const { run } = gatedToFirstTurnIntro(10, daemonById('janus')!);
      run.dispatch({ kind: 'redrawCards', handIndices: [1], grantIndex: 0 });
      const wire = JSON.parse(JSON.stringify(run.toJSON()));
      const restored = Run.fromJSON(wire, new EventBus<GameEvents>());
      expect(restored.phase).toBe('turn-intro');
      expect(restored.hand).toEqual(run.hand);
      // 49d — the queue entries round-trip whole (used/passed included).
      expect(restored.grantViews()).toEqual(run.grantViews());
      expect(restored.grantViews()[0]!.remaining).toBe(0); // still spent
      // (The pre-K3 v12 reject rides the generic `schemaVersion - 1` test.)
    });
  });

  describe('empower at the pre-turn gate (K4)', () => {
    // 49f — this block pins the empower MECHANIC (store/budget/badges),
    // not queue ordering, and K_DEFAULT_DAEMON's queue is [redraw@0,
    // empower@1] — under the now-shipped strict default (`passIsFinal:
    // true`, the 49f flip) an empower behind the cursor rejects. These
    // tests run under an explicit FREE-mode override; the strict-ordering
    // behavior has its own 49d pins ("the grant queue" block below).
    const FREE_MODE = { passIsFinal: false } as const;
    it('adds the configured buff to the slot store; the fielded unit carries it that turn', () => {
      const { run } = gatedToFirstTurnIntro(1, K_DEFAULT_DAEMON, FREE_MODE);
      const pos = 2;
      const slot = run.hand[pos]!;
      // 49d: K_DEFAULT_DAEMON's queue is [redraw@0, empower@1].
      run.dispatch({ kind: 'empowerUnit', grantIndex: 1, handIndex: pos });
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

    it('consumes the grant budget; a request past it is a silent no-op', () => {
      const { run, bus } = gatedToFirstTurnIntro(2, K_DEFAULT_DAEMON, FREE_MODE);
      let emits = 0;
      bus.on('turn:unitEmpowered', () => emits++);
      // Burn the budget, bound derived from config.
      for (let i = 0; i < EMPOWER.empowersPerTurn; i++) {
        run.dispatch({ kind: 'empowerUnit', grantIndex: 1, handIndex: 0 });
      }
      expect(run.grantViews()[1]!.remaining).toBe(0);
      expect(emits).toBe(EMPOWER.empowersPerTurn);
      const stored = run.encounterEffects[run.hand[0]!]!.map((e) => ({ ...e }));
      run.dispatch({ kind: 'empowerUnit', grantIndex: 1, handIndex: 0 });
      expect(run.grantViews()[1]!.remaining).toBe(0);
      expect(emits).toBe(EMPOWER.empowersPerTurn);
      expect(run.encounterEffects[run.hand[0]!]).toMatchObject(stored);
    });

    it('a rejected request consumes no budget, mutates nothing, emits nothing', () => {
      const { run, bus } = gatedToFirstTurnIntro(3);
      let emits = 0;
      bus.on('turn:unitEmpowered', () => emits++);
      run.dispatch({ kind: 'empowerUnit', grantIndex: 1, handIndex: run.hand.length }); // range
      run.dispatch({ kind: 'empowerUnit', grantIndex: 1, handIndex: -1 }); // negative
      run.dispatch({ kind: 'empowerUnit', grantIndex: 1, handIndex: 0.5 }); // non-integer
      // 49d — grant-targeting rejects: the wrong KIND (index 0 is the redraw
      // grant) and an out-of-range queue index.
      run.dispatch({ kind: 'empowerUnit', grantIndex: 0, handIndex: 0 });
      run.dispatch({ kind: 'empowerUnit', grantIndex: 99, handIndex: 0 });
      expect(run.grantViews()[1]!.remaining).toBe(EMPOWER.empowersPerTurn);
      expect(run.encounterEffects.every((slot) => slot.length === 0)).toBe(true);
      expect(emits).toBe(0);
    });

    it('is a no-op outside the pre-turn gate (map phase, headless battle)', () => {
      const { run } = freshRunWithBus(4, { daemon: K_DEFAULT_DAEMON });
      run.dispatch({ kind: 'empowerUnit', grantIndex: 1, handIndex: 0 }); // map
      expect(run.grantViews()).toEqual([]); // no turn resolved yet
      run.dispatch({ kind: 'enterNode', nodeId: frontierOf(run) }); // gates off → battle
      expect(run.phase).toBe('battle');
      run.dispatch({ kind: 'empowerUnit', grantIndex: 1, handIndex: 0 });
      expect(run.grantViews()[1]!.remaining).toBe(EMPOWER.empowersPerTurn);
      expect(run.encounterEffects.every((slot) => slot.length === 0)).toBe(true);
    });

    it('the budget resets next turn; re-empowering the same unit merges per the config policy', () => {
      // Short roster (≤ handSize) so the SAME unit is in hand every turn —
      // the stacking path needs a deterministic re-pick across turns.
      const { run, bus } = freshShortRosterRun(5, { daemon: K_DEFAULT_DAEMON, ...FREE_MODE });
      run.pauseAtTurnGates = true;
      const startings: GameEvents['turn:starting'][] = [];
      bus.on('turn:starting', (p) => startings.push(p));
      run.dispatch({ kind: 'enterNode', nodeId: frontierOf(run) });
      const slot = run.hand[0]!;
      run.dispatch({ kind: 'empowerUnit', grantIndex: 1, handIndex: 0 });
      run.dispatch({ kind: 'advanceTurn' }); // → battle
      chipTurn(bus, { player: 1, enemy: 1 }); // sub-lethal → ongoing
      run.dispatch({ kind: 'advanceTurn' }); // → next turn's gate
      expect(run.phase).toBe('turn-intro');
      expect(run.grantViews()[1]!.remaining).toBe(EMPOWER.empowersPerTurn); // fresh queue
      // The turn-2 pre-turn payload already badges the carried buff (the
      // "empowered on an earlier turn, drawn back" pin).
      const pos2 = run.hand.indexOf(slot);
      expect(pos2).toBeGreaterThanOrEqual(0); // short roster: always in hand
      expect(startings[1]!.empowerStacks[pos2]).toMatchObject([
        { key: EMPOWER.buff.key, magnitude: 1 },
      ]);
      run.dispatch({ kind: 'empowerUnit', grantIndex: 1, handIndex: pos2 });
      const stored = run.encounterEffects[slot]!;
      expect(stored).toHaveLength(1);
      // Expectation derived from the config merge policy (K1 magnitude math).
      expect(stored[0]!.magnitude).toBe(combineMagnitude(EMPOWER.buff.merge, 1, 1));
    });

    it('the buff lives on the SLOT: it survives the card being redrawn away', () => {
      const { run, bus } = gatedToFirstTurnIntro(6, K_DEFAULT_DAEMON, FREE_MODE);
      expect(run.drawPile.length).toBeGreaterThan(0); // replacement ≠ benched below
      const redrawns: GameEvents['turn:handRedrawn'][] = [];
      bus.on('turn:handRedrawn', (p) => redrawns.push(p));
      const benched = run.hand[0]!;
      run.dispatch({ kind: 'empowerUnit', grantIndex: 1, handIndex: 0 });
      run.dispatch({ kind: 'redrawCards', handIndices: [0], grantIndex: 0 });
      expect(run.hand[0]).not.toBe(benched);
      // The store keeps the buff; the badge column re-derived for the NEW hand.
      expect(run.encounterEffects[benched]!.some((e) => e.key === EMPOWER.buff.key)).toBe(true);
      expect(redrawns[0]!.empowerStacks[0]).toEqual([]);
      run.dispatch({ kind: 'advanceTurn' }); // beginTurn fields the FINAL hand
      expect(run.currentEncounter!.playerTeam.some((t) => t.rosterIndex === benched)).toBe(false);
      expect(run.encounterEffects[benched]!.some((e) => e.key === EMPOWER.buff.key)).toBe(true);
    });

    it('turn:starting carries the fresh queue; turn:unitEmpowered the decrement + badge column', () => {
      const { run, bus } = freshRunWithBus(7, { daemon: K_DEFAULT_DAEMON, ...FREE_MODE });
      run.pauseAtTurnGates = true;
      const startings: GameEvents['turn:starting'][] = [];
      const empowereds: GameEvents['turn:unitEmpowered'][] = [];
      bus.on('turn:starting', (p) => startings.push(p));
      bus.on('turn:unitEmpowered', (p) => empowereds.push(p));
      run.dispatch({ kind: 'enterNode', nodeId: frontierOf(run) });
      // Fresh queue straight off the fixture daemon's dial (= the config dial).
      expect(startings[0]!.grants[1]).toMatchObject({
        grantIndex: 1,
        effect: { kind: 'empower', budget: EMPOWER.empowersPerTurn },
        remaining: EMPOWER.empowersPerTurn,
        active: false, // the redraw grant at index 0 holds the cursor
      });
      expect(startings[0]!.empowerStacks).toEqual(run.hand.map(() => []));
      run.dispatch({ kind: 'empowerUnit', grantIndex: 1, handIndex: 1 });
      expect(empowereds).toHaveLength(1);
      expect(empowereds[0]!.handIndex).toBe(1);
      expect(empowereds[0]!.grants).toEqual(run.grantViews());
      expect(empowereds[0]!.grants[1]!.remaining).toBe(EMPOWER.empowersPerTurn - 1);
      // 78c — per-key: the buffed position carries one entry (the idol's
      // key, mods straight from the authored buff — config-derived, never
      // hardcoded); every other position is empty.
      expect(empowereds[0]!.empowerStacks.map((s) => s.length)).toEqual(
        run.hand.map((_, i) => (i === 1 ? 1 : 0)),
      );
      const stack = empowereds[0]!.empowerStacks[1]![0]!;
      expect(stack).toMatchObject({ key: EMPOWER.buff.key, magnitude: 1 });
      expect(stack.mods).toEqual(EMPOWER.buff.mods);
      // The payload is a COPY — a retained payload must not alias the live
      // store (it merges in place).
      expect(stack.mods).not.toBe(run.encounterEffects[run.hand[1]!]![0]!.mods);
    });

    it('same seed + same empower dispatches stay byte-identical', () => {
      // FREE_MODE so the empowers actually land (strict would no-op both
      // sides identically — trivially byte-identical, pinning nothing).
      const a = gatedToFirstTurnIntro(8, K_DEFAULT_DAEMON, FREE_MODE);
      const b = gatedToFirstTurnIntro(8, K_DEFAULT_DAEMON, FREE_MODE);
      for (const { run } of [a, b]) {
        run.dispatch({ kind: 'empowerUnit', grantIndex: 1, handIndex: 3 });
        run.dispatch({ kind: 'advanceTurn' });
      }
      expect(JSON.parse(JSON.stringify(a.run.toJSON()))).toEqual(
        JSON.parse(JSON.stringify(b.run.toJSON())),
      );
    });

    it('round-trips the spent grant (a save at the gate must not refresh the budget)', () => {
      // 47d — save/reload needs a CATALOG daemon (bespoke ids hard-reject on
      // load); mars is the guaranteed-empower idol (its queue = [empower@0]).
      const { run } = gatedToFirstTurnIntro(9, daemonById('mars')!);
      run.dispatch({ kind: 'empowerUnit', grantIndex: 0, handIndex: 0 });
      const wire = JSON.parse(JSON.stringify(run.toJSON()));
      const restored = Run.fromJSON(wire, new EventBus<GameEvents>());
      expect(restored.phase).toBe('turn-intro');
      expect(restored.grantViews()).toEqual(run.grantViews());
      expect(restored.grantViews()[0]!.remaining).toBe(0); // still spent
      // The buff itself rides the K1 v12 `encounterEffects` round-trip.
      expect(restored.encounterEffects).toEqual(run.encounterEffects);
      // (The pre-K4 v14 reject rides the generic `schemaVersion - 1` test.)
    });
  });

  describe('daemons (L1 — daemon-only gates)', () => {
    it("63c: seeds the CHARACTER's daemon at construction (the roll retired), seed-independent", () => {
      // Derived from the default character's config, not hardcoded to 'mars'.
      const expected = characterById(DEFAULT_CHARACTER_ID)!.daemon;
      for (const seed of [1, 21, 999]) {
        const { run } = freshRunWithBus(seed);
        expect(run.daemons).toHaveLength(1);
        expect(run.daemons[0]!.id).toBe(expected);
      }
    });

    it('RunConfig.daemon seeds the ownership list; null forces daemon-less', () => {
      expect(freshRunWithBus(1, { daemon: daemonById('mars')! }).run.daemons[0]!.id).toBe('mars');
      expect(freshRunWithBus(1, { daemon: null }).run.daemons).toEqual([]);
    });

    it('daemon-less: an empty queue at the gate and both commands are no-ops', () => {
      const { run } = gatedToFirstTurnIntro(22, null);
      expect(run.grantViews()).toEqual([]);
      const hand = run.hand.slice();
      run.dispatch({ kind: 'redrawCards', handIndices: [0], grantIndex: 0 });
      run.dispatch({ kind: 'empowerUnit', grantIndex: 0, handIndex: 0 });
      expect(run.hand).toEqual(hand);
      expect(run.encounterEffects.every((slot) => slot.length === 0)).toBe(true);
    });

    it('an empower idol (mars) grants empower per its dials and NO redraw', () => {
      const mars = daemonById('mars')!;
      const marsEmpower = daemonEmpowerHook(mars)!;
      const { run } = gatedToFirstTurnIntro(23, mars);
      // Mars's queue = [empower@0]; no redraw entry exists at all.
      expect(run.grantViews().map((g) => g.effect.kind)).toEqual(['empower']);
      expect(run.grantViews()[0]!.remaining).toBe(marsEmpower.empowersPerTurn);
      const hand = run.hand.slice();
      run.dispatch({ kind: 'redrawCards', handIndices: [0], grantIndex: 0 }); // wrong kind
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
      expect(run.grantViews()).toHaveLength(1);
      expect(run.grantViews()[0]!.effect).toEqual({
        kind: 'redraw',
        budget: janusRedraw.redrawsPerTurn,
        maxCards: cap,
      });
      const hand = run.hand.slice();
      // One past the cap → silent no-op; at the cap → lands.
      run.dispatch({
        kind: 'redrawCards',
        handIndices: hand.map((_, i) => i).slice(0, cap + 1),
        grantIndex: 0,
      });
      expect(run.hand).toEqual(hand);
      run.dispatch({
        kind: 'redrawCards',
        handIndices: hand.map((_, i) => i).slice(0, cap),
        grantIndex: 0,
      });
      expect(run.grantViews()[0]!.remaining).toBe(janusRedraw.redrawsPerTurn - 1);
      run.dispatch({ kind: 'empowerUnit', grantIndex: 0, handIndex: 0 }); // wrong kind
      expect(run.encounterEffects.every((slot) => slot.length === 0)).toBe(true);
    });

    it("mercury's coin flips per turn, deterministically per seed, and lands both ways", () => {
      const mercury = daemonById('mercury')!;
      const grantsOf = (seed: number): boolean[] => {
        const { run, bus } = gatedToFirstTurnIntro(seed, mercury);
        const grants: boolean[] = [];
        for (let t = 0; t < 6 && run.phase === 'turn-intro'; t++) {
          grants.push(run.grantViews().length > 0);
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
        // 49d — the queue view carries the buff + source identity.
        if (daemon !== null) {
          expect(startings[0]!.grants).toEqual([
            {
              grantIndex: 0,
              daemonId: mars.id,
              name: mars.name,
              effect: {
                kind: 'empower',
                budget: daemonEmpowerHook(mars)!.empowersPerTurn,
                buff: daemonEmpowerHook(mars)!.buff,
              },
              remaining: daemonEmpowerHook(mars)!.empowersPerTurn,
              passed: false,
              active: true,
            },
          ]);
        } else {
          expect(startings[0]!.grants).toEqual([]);
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
      expect(restored.grantViews()).toEqual(run.grantViews());
      // The daemonRng round-trips: both runs flip the SAME coins forever after.
      for (const [r, b] of [
        [run, bus],
        [restored, busB],
      ] as const) {
        r.dispatch({ kind: 'advanceTurn' });
        chipTurn(b, { player: 1, enemy: 1 });
        r.dispatch({ kind: 'advanceTurn' });
      }
      expect(restored.grantViews()).toEqual(run.grantViews());
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

    it('two empower idols → two per-source grants, each applying ITS buff (47d→49d)', () => {
      const { run, bus } = gatedToFirstTurnIntro(31, daemonById('mars')!);
      run.addDaemon(daemonById('minerva')!);
      // Acquisition lands mid-turn: this turn's grants are unchanged; the
      // list takes effect at the NEXT turn's resolution.
      expect(run.grantViews().map((g) => g.daemonId)).toEqual(['mars']);
      run.dispatch({ kind: 'advanceTurn' }); // → battle
      chipTurn(bus, { player: 1, enemy: 1 }); // sub-lethal → ongoing
      run.dispatch({ kind: 'advanceTurn' }); // → turn 2's gate
      expect(run.phase).toBe('turn-intro');
      expect(run.grantViews().map((g) => g.daemonId)).toEqual(['mars', 'minerva']);
      // Each grant applies ITS OWN buff, budgeted independently.
      const marsBuff = daemonEmpowerHook(daemonById('mars')!)!.buff;
      const minervaBuff = daemonEmpowerHook(daemonById('minerva')!)!.buff;
      const slot0 = run.hand[0]!;
      const slot1 = run.hand[1]!;
      run.dispatch({ kind: 'empowerUnit', grantIndex: 0, handIndex: 0 });
      run.dispatch({ kind: 'empowerUnit', grantIndex: 1, handIndex: 1 });
      expect(run.encounterEffects[slot0]!.map((e) => e.key)).toEqual([marsBuff.key]);
      expect(run.encounterEffects[slot1]!.map((e) => e.key)).toEqual([minervaBuff.key]);
      expect(run.grantViews().map((g) => g.remaining)).toEqual([0, 0]);
      // A spent source rejects silently; the OTHER source's budget is its own.
      run.dispatch({ kind: 'empowerUnit', grantIndex: 0, handIndex: 2 });
      expect(run.encounterEffects[run.hand[2]!]!).toHaveLength(0);
    });

    it('strict finality (49d): only the ACTIVE grant fires; passGrant finalizes; free mode no-ops it', () => {
      // Mars-then-Janus ownership under passIsFinal: the empower grant holds
      // the cursor, so the redraw behind it is unreachable until it resolves.
      const strict = gatedToFirstTurnIntro(33, daemonById('mars')!, { passIsFinal: true });
      strict.run.addDaemon(daemonById('janus')!);
      strict.run.dispatch({ kind: 'advanceTurn' });
      chipTurn(strict.bus, { player: 1, enemy: 1 });
      strict.run.dispatch({ kind: 'advanceTurn' }); // → turn 2: [empower, redraw]
      expect(strict.run.grantViews().map((g) => g.effect.kind)).toEqual(['empower', 'redraw']);
      expect(strict.run.grantViews()[0]!.active).toBe(true);
      const hand = strict.run.hand.slice();
      // Firing PAST the cursor is rejected...
      strict.run.dispatch({ kind: 'redrawCards', handIndices: [0], grantIndex: 1 });
      expect(strict.run.hand).toEqual(hand);
      // ...passing finalizes the empower (unspent, forever this turn)...
      strict.run.dispatch({ kind: 'passGrant' });
      expect(strict.run.grantViews()[0]!.passed).toBe(true);
      expect(strict.run.grantViews()[1]!.active).toBe(true);
      strict.run.dispatch({ kind: 'empowerUnit', grantIndex: 0, handIndex: 0 });
      expect(strict.run.encounterEffects.every((slot) => slot.length === 0)).toBe(true);
      // ...and the redraw behind it is now live.
      strict.run.dispatch({ kind: 'redrawCards', handIndices: [0], grantIndex: 1 });
      expect(strict.run.hand).not.toEqual(hand);

      // Free mode (the shipped default): out-of-order fires are legal and
      // passGrant is a deliberate no-op.
      const free = gatedToFirstTurnIntro(33, daemonById('mars')!, { passIsFinal: false });
      free.run.addDaemon(daemonById('janus')!);
      free.run.dispatch({ kind: 'advanceTurn' });
      chipTurn(free.bus, { player: 1, enemy: 1 });
      free.run.dispatch({ kind: 'advanceTurn' });
      const freeHand = free.run.hand.slice();
      free.run.dispatch({ kind: 'redrawCards', handIndices: [0], grantIndex: 1 }); // past the cursor
      expect(free.run.hand).not.toEqual(freeHand);
      free.run.dispatch({ kind: 'passGrant' });
      expect(free.run.grantViews()[0]!.passed).toBe(false); // no-op
      free.run.dispatch({ kind: 'empowerUnit', grantIndex: 0, handIndex: 0 });
      expect(free.run.encounterEffects.some((slot) => slot.length > 0)).toBe(true);
    });

    it('the pass mark round-trips: a save mid-queue restores the exact cursor (49d)', () => {
      const { run } = gatedToFirstTurnIntro(34, daemonById('mars')!, { passIsFinal: true });
      run.dispatch({ kind: 'passGrant' }); // finalize the lone empower grant
      expect(run.grantViews()[0]!.passed).toBe(true);
      const wire = JSON.parse(JSON.stringify(run.toJSON()));
      const restored = Run.fromJSON(wire, new EventBus<GameEvents>());
      expect(restored.grantViews()[0]!.passed).toBe(true);
      expect(restored.grantViews()[0]!.active).toBe(false);
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
      const run = new Run(3, bus, { ...NO_EVENTS, forcedLayoutId: forced });
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
      const run = new Run(3, bus, { ...NO_EVENTS, forcedEncounterId: normalId });
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
      const run = new Run(1, new EventBus<GameEvents>(), NO_EVENTS);
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
      const run = new Run(1, new EventBus<GameEvents>(), NO_EVENTS);
      run.addEncounterEffect(0, empower(1));
      run.addEncounterEffect(0, empower(3));
      expect(run.encounterEffects[0]).toHaveLength(1);
      expect(run.encounterEffects[0]![0]!.magnitude).toBe(3);
    });

    it('ignores addEncounterEffect on an out-of-range slot', () => {
      const run = new Run(1, new EventBus<GameEvents>(), NO_EVENTS);
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

    it('50a — spendBits deducts and reports true iff affordable; refusal is silent', () => {
      const { run, bus } = freshRunWithBus(1, { daemon: null, startingBits: 10 });
      const events: Array<{ bits: number; delta: number }> = [];
      bus.on('run:bitsChanged', (e) => events.push(e));
      expect(run.spendBits(11)).toBe(false); // short by one → clean refusal
      expect(run.bits).toBe(10);
      expect(run.spendBits(7)).toBe(true);
      expect(run.bits).toBe(3);
      expect(run.spendBits(4)).toBe(false); // no partial deduction at the floor
      expect(run.bits).toBe(3);
      expect(run.spendBits(3)).toBe(true); // exact balance spends to zero
      expect(run.bits).toBe(0);
      expect(events).toEqual([
        { bits: 3, delta: -7 },
        { bits: 0, delta: -3 },
      ]);
    });

    it('50a — spendBits takes no fold: moneta scales earns, never prices', () => {
      const { run } = freshRunWithBus(1, { daemon: daemonById('moneta')!, startingBits: 10 });
      expect(run.spendBits(10)).toBe(true); // a folded spend would under/over-charge
      expect(run.bits).toBe(0);
    });

    it('50a — spendBits rejects non-integer and negative amounts loudly', () => {
      const { run } = freshRunWithBus(1, { daemon: null, startingBits: 10 });
      expect(() => run.spendBits(2.5)).toThrow(/nonnegative integer/);
      expect(() => run.spendBits(-3)).toThrow(/nonnegative integer/);
      expect(run.spendBits(0)).toBe(true); // zero is a legal no-op spend
      expect(run.bits).toBe(10);
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

  describe('the cache (49b — the core)', () => {
    /** A real catalog id (derived, never hardcoded — the catalog is 49g's). */
    const PACKET_ID = PACKETS[0]!.id;
    const BASE_SIZE = RUN_STAT_BASES.cacheSize;
    /** A bespoke shrink idol leaving exactly 2 slots (derived from the base). */
    const SHRINK_IDOL: DaemonConfig = {
      id: 'test-cache-shrink',
      name: 'Test Cache Shrink',
      description: 'cursed: the cache shrinks to 2 slots',
      rules: [{ kind: 'modifier', stat: 'cacheSize', op: 'add', value: -(BASE_SIZE - 2) }],
    };
    const GROW_IDOL: DaemonConfig = {
      id: 'test-cache-grow',
      name: 'Test Cache Grow',
      description: '+3 cache slots (the spec example)',
      rules: [{ kind: 'modifier', stat: 'cacheSize', op: 'add', value: 3 }],
    };

    it('starts empty at the base capacity (derived, never stored)', () => {
      const { run } = freshRunWithBus(1, { daemon: null });
      expect(run.cache).toEqual([]);
      expect(run.effectiveCacheSize).toBe(Math.floor(BASE_SIZE));
      expect(run.cacheHasRoom).toBe(true);
      expect(run.cacheOverflow).toBe(0);
    });

    it('addPacket appends in acquisition order (duplicates = one slot each) and emits run:cacheChanged', () => {
      const { run, bus } = freshRunWithBus(1, { daemon: null });
      const events: Array<{ packetIds: string[]; size: number }> = [];
      bus.on('run:cacheChanged', (e) => events.push(e));
      run.addPacket(PACKET_ID);
      run.addPacket(PACKET_ID);
      expect(run.cache).toEqual([PACKET_ID, PACKET_ID]);
      expect(events).toEqual([
        { packetIds: [PACKET_ID], size: Math.floor(BASE_SIZE) },
        { packetIds: [PACKET_ID, PACKET_ID], size: Math.floor(BASE_SIZE) },
      ]);
      // The payload is a COPY — mutating it can't reach the live cache.
      events[1]!.packetIds.pop();
      expect(run.cache).toHaveLength(2);
    });

    it('addPacket throws on an id missing from the catalog (a poisoned save beats a silent one)', () => {
      const { run } = freshRunWithBus(1, { daemon: null });
      expect(() => run.addPacket('no-such-packet')).toThrow(/unknown packet id 'no-such-packet'/);
      expect(run.cache).toEqual([]);
    });

    it('the discardPacket command removes one slot; out-of-range / fractional are silent no-ops', () => {
      const { run, bus } = freshRunWithBus(1, { daemon: null });
      run.addPacket(PACKET_ID);
      run.addPacket(PACKET_ID);
      const events: unknown[] = [];
      bus.on('run:cacheChanged', (e) => events.push(e));
      run.dispatch({ kind: 'discardPacket', cacheIndex: 0 });
      expect(run.cache).toEqual([PACKET_ID]);
      expect(events).toHaveLength(1);
      run.dispatch({ kind: 'discardPacket', cacheIndex: 5 });
      run.dispatch({ kind: 'discardPacket', cacheIndex: -1 });
      run.dispatch({ kind: 'discardPacket', cacheIndex: 0.5 });
      expect(run.cache).toEqual([PACKET_ID]);
      expect(events).toHaveLength(1); // the no-ops stayed silent
    });

    it('discard is legal in any phase (no phase guard — a shrink must resolve wherever it lands)', () => {
      const { run } = freshRunWithBus(1, { daemon: null });
      run.addPacket(PACKET_ID);
      run.dispatch({ kind: 'enterNode', nodeId: frontierOf(run) });
      expect(run.phase).not.toBe('map'); // mid-encounter, not the map
      run.dispatch({ kind: 'discardPacket', cacheIndex: 0 });
      expect(run.cache).toEqual([]);
    });

    it('a cacheSize modifier changes the DERIVED capacity at read time, flooring at the read site', () => {
      const { run } = freshRunWithBus(1, { daemon: null });
      run.addDaemon(GROW_IDOL);
      expect(run.effectiveCacheSize).toBe(Math.floor(BASE_SIZE + 3));
      const halved = freshRunWithBus(1, {
        daemon: {
          id: 'test-cache-halve',
          name: 'Test Cache Halve',
          description: 'halves the cache',
          rules: [{ kind: 'modifier', stat: 'cacheSize', op: 'mult', value: 0.5 }],
        },
      }).run;
      expect(halved.effectiveCacheSize).toBe(Math.floor(BASE_SIZE * 0.5));
    });

    it('a shrink under current holdings sets cacheOverflow; discards resolve it (the forced-keep state)', () => {
      const { run } = freshRunWithBus(1, { daemon: null });
      run.addPacket(PACKET_ID);
      run.addPacket(PACKET_ID);
      run.addPacket(PACKET_ID);
      expect(run.cacheOverflow).toBe(0);
      run.addDaemon(SHRINK_IDOL); // capacity → 2, holdings 3
      expect(run.effectiveCacheSize).toBe(2);
      expect(run.cacheOverflow).toBe(1);
      expect(run.cacheHasRoom).toBe(false);
      run.dispatch({ kind: 'discardPacket', cacheIndex: 0 });
      expect(run.cacheOverflow).toBe(0);
      expect(run.cacheHasRoom).toBe(false); // exactly full, not roomy
    });

    it('addDaemon emits run:cacheChanged (ownership moves the derived capacity)', () => {
      const { run, bus } = freshRunWithBus(1, { daemon: null });
      run.addPacket(PACKET_ID);
      const events: Array<{ packetIds: string[]; size: number }> = [];
      bus.on('run:cacheChanged', (e) => events.push(e));
      run.addDaemon(SHRINK_IDOL);
      expect(events).toEqual([{ packetIds: [PACKET_ID], size: 2 }]);
    });

    it('round-trips the cache (overflow re-derives); an unknown cached id hard-rejects', () => {
      const { run } = freshRunWithBus(1, { daemon: null });
      run.addPacket(PACKET_ID);
      run.addPacket(PACKET_ID);
      run.addPacket(PACKET_ID);
      run.addDaemon(SHRINK_IDOL);
      const wire = JSON.parse(JSON.stringify(run.toJSON()));
      expect(wire.cache).toEqual([PACKET_ID, PACKET_ID, PACKET_ID]);
      // The bespoke idol doesn't survive by-id rehydration (the 47d
      // shape-lock), so restore WITHOUT it: contents held, base capacity.
      const restoredWire = { ...wire, daemonIds: [] };
      const restored = Run.fromJSON(restoredWire, new EventBus<GameEvents>());
      expect(restored.cache).toEqual([PACKET_ID, PACKET_ID, PACKET_ID]);
      expect(restored.cacheOverflow).toBe(0); // no shrink idol → re-derives clean
      const tampered = { ...wire, daemonIds: [], cache: ['no-such-packet'] };
      expect(() => Run.fromJSON(tampered, new EventBus<GameEvents>())).toThrow(
        /unknown packet id 'no-such-packet'/,
      );
    });
  });

  describe('packet rewards (49c — the earn pipe activates)', () => {
    const PACKET_ID = PACKETS[0]!.id;

    /** Forge a live offer holding a packet portion PLUS a tail portion, so
     *  resolving the packet never drains the offer (afterRewardResolved
     *  would re-enter the gate chain outside a real encounter — the 48f
     *  synthesize-the-shape precedent, plain-mutation on public fields). */
    const forgedOffer = () => {
      const fresh = freshRunWithBus(1, { daemon: null });
      fresh.run.phase = 'reward';
      fresh.run.pendingRewards = [
        { kind: 'packet', packetId: PACKET_ID },
        { kind: 'bits', base: 1 },
      ];
      return fresh;
    };

    it('accepting a packet portion lands it in the cache (the earn-store loop)', () => {
      const { run } = forgedOffer();
      run.dispatch({ kind: 'acceptReward', index: 0 });
      expect(run.cache).toEqual([PACKET_ID]);
      expect(run.pendingRewards).toEqual([{ kind: 'bits', base: 1 }]);
    });

    it('a full-cache accept WITHOUT a swap slot is a silent no-op — the offer stays intact', () => {
      const { run } = forgedOffer();
      while (run.cacheHasRoom) run.addPacket(PACKET_ID);
      const held = run.cache.length;
      run.dispatch({ kind: 'acceptReward', index: 0 });
      expect(run.cache).toHaveLength(held);
      expect(run.pendingRewards).toHaveLength(2); // still both portions
    });

    it('a full-cache accept WITH a valid swapCacheIndex discards that slot, then accepts', () => {
      const { run, bus } = forgedOffer();
      while (run.cacheHasRoom) run.addPacket(PACKET_ID);
      const size = run.effectiveCacheSize;
      const events: Array<{ packetIds: string[]; size: number }> = [];
      bus.on('run:cacheChanged', (e) => events.push(e));
      run.dispatch({ kind: 'acceptReward', index: 0, swapCacheIndex: 0 });
      expect(run.cache).toHaveLength(size); // exactly full again
      expect(run.pendingRewards).toEqual([{ kind: 'bits', base: 1 }]);
      // Two repaints (discard, then add) — the documented swap shape.
      expect(events).toHaveLength(2);
    });

    it('a full-cache accept with an invalid swap slot (fractional / out-of-range) is a no-op', () => {
      const { run } = forgedOffer();
      while (run.cacheHasRoom) run.addPacket(PACKET_ID);
      run.dispatch({ kind: 'acceptReward', index: 0, swapCacheIndex: 0.5 });
      run.dispatch({ kind: 'acceptReward', index: 0, swapCacheIndex: -1 });
      run.dispatch({ kind: 'acceptReward', index: 0, swapCacheIndex: 99 });
      expect(run.pendingRewards).toHaveLength(2);
    });

    it('swapCacheIndex is IGNORED while the cache has room (no phantom discard)', () => {
      const { run } = forgedOffer();
      run.addPacket(PACKET_ID);
      run.dispatch({ kind: 'acceptReward', index: 0, swapCacheIndex: 0 });
      // Both survive: the held one (no discard) plus the accepted one.
      expect(run.cache).toEqual([PACKET_ID, PACKET_ID]);
    });

    it('a pending packet portion round-trips (v31); an unknown pending packet id rejects', () => {
      const { run } = forgedOffer();
      const wire = JSON.parse(JSON.stringify(run.toJSON()));
      const restored = Run.fromJSON(wire, new EventBus<GameEvents>());
      expect(restored.pendingRewards).toEqual([
        { kind: 'packet', packetId: PACKET_ID },
        { kind: 'bits', base: 1 },
      ]);
      const tampered = {
        ...wire,
        pendingRewards: [{ kind: 'packet', packetId: 'no-such-packet' }],
      };
      expect(() => Run.fromJSON(tampered, new EventBus<GameEvents>())).toThrow(
        /pending reward references unknown packet id 'no-such-packet'/,
      );
    });
  });

  describe('the fire engine (49e — usePacket)', () => {
    /** Catalog-derived effect readers (the balance-proof discipline — never
     *  hardcode what packets.json authors). */
    const packetEffect = (id: string) => {
      const p = packetById(id);
      if (p === undefined) throw new Error(`test fixture: no packet '${id}' in the catalog`);
      return p.effect;
    };
    const healAmountOf = (id: string): number => {
      const e = packetEffect(id);
      if (e.op !== 'healPool') throw new Error(`'${id}' is not healPool`);
      return e.amount;
    };
    const buffOf = (id: string) => {
      const e = packetEffect(id);
      if (e.op !== 'applyBuff') throw new Error(`'${id}' is not applyBuff`);
      return e.buff;
    };
    const ruleOf = (id: string) => {
      const e = packetEffect(id);
      if (e.op !== 'injectRule') throw new Error(`'${id}' is not injectRule`);
      return e.rule;
    };
    /** An empower-only idol, for cursor-interplay tests (one queue entry). */
    const EMPOWER_IDOL: DaemonConfig = {
      id: 'test-empower-only',
      name: 'Test Empower Only',
      description: 'one empower grant per turn',
      rules: [
        {
          kind: 'hook',
          on: 'turnStart',
          effect: { op: 'grantEmpowers', empowersPerTurn: 1, buff: EMPOWER.buff },
        },
      ],
    };

    it('rejects silently at the gate — wrong usableIn, bad cache index, missing/bad unit target', () => {
      const { run, bus } = gatedToFirstTurnIntro(1, null);
      run.addPacket('overclock'); // outOfBattle-only
      run.addPacket('hype'); // preTurn, unit target
      const used: unknown[] = [];
      bus.on('run:packetUsed', (e) => used.push(e));
      run.dispatch({ kind: 'usePacket', cacheIndex: 0, rosterIndex: 0 }); // context not authored
      run.dispatch({ kind: 'usePacket', cacheIndex: 5 }); // out of range
      run.dispatch({ kind: 'usePacket', cacheIndex: 0.5 }); // fractional
      run.dispatch({ kind: 'usePacket', cacheIndex: -1 });
      run.dispatch({ kind: 'usePacket', cacheIndex: 1 }); // unit target missing
      run.dispatch({ kind: 'usePacket', cacheIndex: 1, handIndex: 99 }); // target out of range
      run.dispatch({ kind: 'usePacket', cacheIndex: 1, handIndex: 0.5 });
      expect(run.cache).toEqual(['overclock', 'hype']); // nothing consumed
      expect(used).toEqual([]);
    });

    it('rejects in a context-less phase (battle) and rejects a preTurn-only packet at the map', () => {
      const { run } = freshRunWithBus(1, { daemon: null });
      run.addPacket('hype'); // preTurn-only
      run.addPacket('patch');
      run.dispatch({ kind: 'usePacket', cacheIndex: 0, handIndex: 0 }); // map ⇒ outOfBattle — not authored
      expect(run.cache).toEqual(['hype', 'patch']);
      run.dispatch({ kind: 'enterNode', nodeId: frontierOf(run) }); // headless → phase 'battle'
      expect(run.phase).toBe('battle');
      run.dispatch({ kind: 'usePacket', cacheIndex: 1 }); // no context mid-battle
      expect(run.cache).toEqual(['hype', 'patch']);
    });

    it('patch heals the pool at the MAP (instant, capped at max, consume-on-fire)', () => {
      const { run, bus } = freshRunWithBus(1, { daemon: null });
      const amount = healAmountOf('patch');
      run.addPacket('patch');
      run.addPacket('patch');
      run.playerHealth = HEALTH.playerHealthMax - (amount + 2);
      const used: GameEvents['run:packetUsed'][] = [];
      const cacheEvents: unknown[] = [];
      bus.on('run:packetUsed', (e) => used.push(e));
      bus.on('run:cacheChanged', (e) => cacheEvents.push(e));
      run.dispatch({ kind: 'usePacket', cacheIndex: 0 });
      expect(run.playerHealth).toBe(HEALTH.playerHealthMax - 2);
      expect(run.cache).toEqual(['patch']);
      expect(cacheEvents).toHaveLength(1);
      expect(used).toHaveLength(1);
      expect(used[0]).toMatchObject({
        packetId: 'patch',
        context: 'outOfBattle',
        playerHealth: HEALTH.playerHealthMax - 2,
      });
      run.dispatch({ kind: 'usePacket', cacheIndex: 0 }); // 2 short of max → caps
      expect(run.playerHealth).toBe(HEALTH.playerHealthMax);
    });

    it('patch heals BETWEEN TURNS too (the 49e healPool preTurn growth — the shape-lock)', () => {
      const { run } = gatedToFirstTurnIntro(1, null);
      run.addPacket('patch');
      run.playerHealth = HEALTH.playerHealthMax - healAmountOf('patch');
      run.dispatch({ kind: 'usePacket', cacheIndex: 0 });
      expect(run.playerHealth).toBe(HEALTH.playerHealthMax);
      expect(run.cache).toEqual([]);
    });

    it("hype lands the buff on the targeted hand card's roster slot; re-firing stacks (merge add)", () => {
      const { run, bus } = gatedToFirstTurnIntro(1, null);
      const buff = buffOf('hype');
      run.addPacket('hype');
      run.addPacket('hype');
      const slot = run.hand[0]!;
      const used: GameEvents['run:packetUsed'][] = [];
      bus.on('run:packetUsed', (e) => used.push(e));
      run.dispatch({ kind: 'usePacket', cacheIndex: 0, handIndex: 0 });
      expect(run.encounterEffects[slot]!.map((e) => e.key)).toEqual([buff.key]);
      // The payload badge column marks the hyped hand position (packet buff
      // keys badge alongside idol empower keys — 49e).
      expect(used[0]!.empowerStacks[0]).toMatchObject([{ key: buff.key, magnitude: 1 }]);
      run.dispatch({ kind: 'usePacket', cacheIndex: 0, handIndex: 0 });
      expect(run.encounterEffects[slot]).toHaveLength(1); // merged, not appended
      expect(run.encounterEffects[slot]![0]!.magnitude).toBe(2);
      expect(run.cache).toEqual([]);
    });

    it('reroute INSERTS at the cursor — immediately active under strict finality, the idol resumes behind', () => {
      const { run } = gatedToFirstTurnIntro(1, EMPOWER_IDOL, { passIsFinal: true });
      run.addPacket('reroute');
      run.dispatch({ kind: 'usePacket', cacheIndex: 0 });
      const grants = run.grantViews();
      expect(grants.map((g) => g.effect.kind)).toEqual(['redraw', 'empower']);
      expect(grants[0]).toMatchObject({ daemonId: 'reroute', name: 'Reroute', active: true });
      // Strict mode: the idol grant behind the insert is NOT yet targetable…
      run.dispatch({ kind: 'empowerUnit', handIndex: 0, grantIndex: 1 });
      expect(run.encounterEffects[run.hand[0]!]).toEqual([]);
      // …while the packet's redraw fires through the NORMAL redraw command.
      run.dispatch({ kind: 'redrawCards', handIndices: [0], grantIndex: 0 });
      const after = run.grantViews();
      expect(after[0]!.remaining).toBe(0);
      expect(after[1]!.active).toBe(true); // the cursor fell through to the idol
      run.dispatch({ kind: 'empowerUnit', handIndex: 0, grantIndex: 1 });
      expect(run.encounterEffects[run.hand[0]!]).toHaveLength(1);
    });

    it('reroute on a grant-less turn appends to the empty queue (still immediately active)', () => {
      const { run } = gatedToFirstTurnIntro(1, null);
      expect(run.grantViews()).toEqual([]);
      run.addPacket('reroute');
      run.dispatch({ kind: 'usePacket', cacheIndex: 0 });
      expect(run.grantViews()).toHaveLength(1);
      expect(run.grantViews()[0]).toMatchObject({ effect: { kind: 'redraw' }, active: true });
    });

    it('venom (encounter) + miner (run) inject in union order and live/expire by duration', () => {
      const { run, bus } = gatedToFirstTurnIntro(1, null);
      const venomRule = ruleOf('venom');
      const minerRule = ruleOf('miner');
      run.addPacket('venom');
      run.addPacket('miner');
      run.dispatch({ kind: 'usePacket', cacheIndex: 0 });
      run.dispatch({ kind: 'usePacket', cacheIndex: 0 });
      // Live THIS very turn (beginTurn runs after the gate); union order =
      // daemons (none) → run-injected → encounter-injected.
      run.dispatch({ kind: 'advanceTurn' });
      expect(run.currentEncounter!.battleRules).toEqual([minerRule, venomRule]);
      // Persists across turns WITHIN the encounter.
      chipTurn(bus, { player: 0, enemy: 0 });
      run.dispatch({ kind: 'advanceTurn' }); // outcome → next intro
      run.dispatch({ kind: 'advanceTurn' }); // intro → battle
      expect(run.currentEncounter!.battleRules).toEqual([minerRule, venomRule]);
      // Win + walk to the NEXT encounter: venom expires at its start (the
      // reset-at-start doctrine), miner persists (run duration). Rewards are
      // DECLINED so an accepted daemon can't pollute the compile.
      winEncounter(bus);
      run.dispatch({ kind: 'advanceTurn' });
      declineAllRewards(run);
      if (run.phase === 'promotion') run.dispatch({ kind: 'dismissPromotion' });
      if (run.phase === 'recruit') run.dispatch({ kind: 'passRecruit' });
      expect(run.phase).toBe('map');
      run.dispatch({ kind: 'enterNode', nodeId: frontierOf(run) });
      run.dispatch({ kind: 'advanceTurn' });
      expect(run.currentEncounter!.battleRules).toEqual([minerRule]);
    });

    it('overclock pends until the next encounter START, then lands post-reset (the pending store)', () => {
      const { run } = freshRunWithBus(1, { daemon: null });
      const buff = buffOf('overclock');
      run.addPacket('overclock');
      run.addPacket('overclock');
      run.dispatch({ kind: 'usePacket', cacheIndex: 0, rosterIndex: 2 });
      expect(run.pendingEncounterEffects[2]!.map((e) => e.key)).toEqual([buff.key]);
      expect(run.encounterEffects[2]).toEqual([]); // pending, not live
      run.dispatch({ kind: 'usePacket', cacheIndex: 0, rosterIndex: 2 }); // stacks while pending
      expect(run.pendingEncounterEffects[2]![0]!.magnitude).toBe(2);
      run.dispatch({ kind: 'enterNode', nodeId: frontierOf(run) });
      // Drained in AFTER the K1 reset — the buff survives into the live store.
      expect(run.encounterEffects[2]!.map((e) => e.key)).toEqual([buff.key]);
      expect(run.encounterEffects[2]![0]!.magnitude).toBe(2);
      expect(run.pendingEncounterEffects[2]).toEqual([]);
    });

    it('the three 49e stores round-trip (v33); a packet-sourced grant keeps its name; stale rejects', () => {
      const { run } = gatedToFirstTurnIntro(1, null);
      run.addPacket('venom');
      run.addPacket('miner');
      run.addPacket('reroute');
      run.dispatch({ kind: 'usePacket', cacheIndex: 0 });
      run.dispatch({ kind: 'usePacket', cacheIndex: 0 });
      run.dispatch({ kind: 'usePacket', cacheIndex: 0 });
      const wire = JSON.parse(JSON.stringify(run.toJSON()));
      expect(wire.schemaVersion).toBe(42); // 77d2 — keyed derivation
      const restored = Run.fromJSON(wire, new EventBus<GameEvents>());
      // 51f — the stores carry provenance now ({rule, sourceId}).
      expect(restored.injectedEncounterRules).toEqual([
        { rule: ruleOf('venom'), sourceId: 'venom' },
      ]);
      expect(restored.injectedRunRules).toEqual([{ rule: ruleOf('miner'), sourceId: 'miner' }]);
      expect(restored.grantViews()[0]).toMatchObject({ daemonId: 'reroute', name: 'Reroute' });
      expect(() =>
        Run.fromJSON({ ...wire, schemaVersion: 32 }, new EventBus<GameEvents>()),
      ).toThrow(/unsupported schema version/);
    });

    it('the pending store round-trips (a save between fire and next encounter keeps the buff)', () => {
      const { run } = freshRunWithBus(1, { daemon: null });
      run.addPacket('overclock');
      run.dispatch({ kind: 'usePacket', cacheIndex: 0, rosterIndex: 1 });
      const wire = JSON.parse(JSON.stringify(run.toJSON()));
      const restored = Run.fromJSON(wire, new EventBus<GameEvents>());
      expect(restored.pendingEncounterEffects[1]!.map((e) => e.key)).toEqual([
        buffOf('overclock').key,
      ]);
      // 74i-c — a restored run re-pins the SHIPPED catalog (the bespoke-
      // rejection rule), so entering the root would OPEN the starting event.
      // The buff seeds at any ENCOUNTER start: hop past the root to a battle
      // child (hop 1 is scatter-free — the 74i probe).
      restored.currentNodeId = restored.nodeMap.rootId;
      const battleChild = restored.nodeMap.edges
        .filter((e) => e.from === restored.nodeMap.rootId)
        .map((e) => e.to)
        .find((id) => restored.nodeMap.nodes.find((n) => n.id === id)!.kind === 'battle')!;
      restored.dispatch({ kind: 'enterNode', nodeId: battleChild });
      expect(restored.encounterEffects[1]!.map((e) => e.key)).toEqual([buffOf('overclock').key]);
    });
  });

  describe('50b — removeRosterUnit (the roster-shrink chokepoint)', () => {
    /** Catalog-derived (never hardcoded): overclock's buff key marks a
     *  roster slot so the tests can watch it ride the splice. */
    const buffOf = (id: string) => {
      const e = packetById(id)?.effect;
      if (e?.op !== 'applyBuff') throw new Error(`test fixture: '${id}' is not applyBuff`);
      return e.buff;
    };

    /** The renumber contract, restated: drop the removed VALUE, shift
     *  every higher value down one, preserve order. */
    const renumbered = (pile: readonly number[], removed: number): number[] =>
      pile.filter((v) => v !== removed).map((v) => (v > removed ? v - 1 : v));

    const pileUnion = (run: Run): number[] =>
      [...run.hand, ...run.drawPile, ...run.discardPile].sort((a, b) => a - b);

    it('splices team + all THREE parallel stores in lockstep (the sixth structure shifts)', () => {
      const { run } = freshRunWithBus(1, { daemon: null });
      const before = run.team.map((u) => u.archetype);
      expect(before.length).toBeGreaterThanOrEqual(3);
      run.addPacket('overclock');
      run.dispatch({ kind: 'usePacket', cacheIndex: 0, rosterIndex: 2 }); // mark slot 2
      run.removeRosterUnit(0);
      expect(run.team.map((u) => u.archetype)).toEqual(before.slice(1));
      expect(run.deploymentCounts).toHaveLength(run.team.length);
      expect(run.encounterEffects).toHaveLength(run.team.length);
      expect(run.pendingEncounterEffects).toHaveLength(run.team.length);
      // The marked slot rode the shift: 2 → 1, and no other slot has it.
      expect(run.pendingEncounterEffects[1]!.map((e) => e.key)).toEqual([buffOf('overclock').key]);
      run.pendingEncounterEffects.forEach((slot, i) => {
        if (i !== 1) expect(slot).toEqual([]);
      });
    });

    it('removing the marked slot itself drops its pending effects with it', () => {
      const { run } = freshRunWithBus(1, { daemon: null });
      run.addPacket('overclock');
      run.dispatch({ kind: 'usePacket', cacheIndex: 0, rosterIndex: 2 });
      run.removeRosterUnit(2);
      expect(run.pendingEncounterEffects).toHaveLength(run.team.length);
      run.pendingEncounterEffects.forEach((slot) => expect(slot).toEqual([]));
    });

    it('renumbers all three deck piles (post-encounter piles hold live rosterIndex values)', () => {
      const { run, bus } = freshRunWithBus(1, { daemon: null });
      run.dispatch({ kind: 'enterNode', nodeId: frontierOf(run) });
      winEncounter(bus);
      declineAllRewards(run);
      if (run.phase === 'promotion') run.dispatch({ kind: 'dismissPromotion' });
      if (run.phase === 'recruit') run.dispatch({ kind: 'passRecruit' });
      expect(run.phase).toBe('map');
      // Sanity: the post-encounter piles cover the roster completely.
      expect(pileUnion(run)).toEqual(run.team.map((_, i) => i));
      const before = { hand: [...run.hand], draw: [...run.drawPile], discard: [...run.discardPile] };
      const removed = 1;
      run.removeRosterUnit(removed);
      expect(run.hand).toEqual(renumbered(before.hand, removed));
      expect(run.drawPile).toEqual(renumbered(before.draw, removed));
      expect(run.discardPile).toEqual(renumbered(before.discard, removed));
      // The serialized invariant holds unconditionally: complete coverage,
      // every value < team.length.
      expect(pileUnion(run)).toEqual(run.team.map((_, i) => i));
    });

    it('guards: out-of-range and last-unit throw; a non-map phase throws (live indices)', () => {
      const { run } = freshRunWithBus(1, { daemon: null });
      expect(() => run.removeRosterUnit(run.team.length)).toThrow(/out of range/);
      expect(() => run.removeRosterUnit(-1)).toThrow(/out of range/);
      expect(() => run.removeRosterUnit(1.5)).toThrow(/out of range/);
      while (run.team.length > 1) run.removeRosterUnit(0);
      expect(() => run.removeRosterUnit(0)).toThrow(/last roster unit/);
      const fighting = freshRunWithBus(2, { daemon: null }).run;
      fighting.dispatch({ kind: 'enterNode', nodeId: frontierOf(fighting) });
      expect(fighting.phase).toBe('battle');
      expect(() => fighting.removeRosterUnit(0)).toThrow(/only legal at the map/);
    });

    it('a post-removal save round-trips with every structure still aligned', () => {
      const { run } = freshRunWithBus(1, { daemon: null });
      run.addPacket('overclock');
      run.dispatch({ kind: 'usePacket', cacheIndex: 0, rosterIndex: 2 });
      run.removeRosterUnit(0);
      const wire = JSON.parse(JSON.stringify(run.toJSON()));
      const restored = Run.fromJSON(wire, new EventBus<GameEvents>());
      expect(restored.team.map((u) => u.archetype)).toEqual(run.team.map((u) => u.archetype));
      expect(restored.deploymentCounts).toHaveLength(restored.team.length);
      expect(restored.encounterEffects).toHaveLength(restored.team.length);
      expect(restored.pendingEncounterEffects).toHaveLength(restored.team.length);
      expect(restored.pendingEncounterEffects[1]!.map((e) => e.key)).toEqual([
        buffOf('overclock').key,
      ]);
      for (const v of [...restored.hand, ...restored.drawPile, ...restored.discardPile]) {
        expect(v).toBeLessThan(restored.team.length);
      }
    });

    it('the shrunk run still runs: the next encounter rebuilds the deck at the new size', () => {
      const { run } = freshRunWithBus(1, { daemon: null });
      const marked = run.team[2]!.archetype;
      run.addPacket('overclock');
      run.dispatch({ kind: 'usePacket', cacheIndex: 0, rosterIndex: 2 }); // slot 2, shifts to 1
      run.removeRosterUnit(0);
      run.dispatch({ kind: 'enterNode', nodeId: frontierOf(run) });
      expect([...run.drawPile, ...run.hand].sort((a, b) => a - b)).toEqual(
        run.team.map((_, i) => i),
      );
      // The pending buff drained onto the SHIFTED slot's unit at encounter start.
      expect(run.team[1]!.archetype).toBe(marked);
      expect(run.encounterEffects[1]!.map((e) => e.key)).toEqual([buffOf('overclock').key]);
    });
  });

  describe('50c — the port phase (dock / undock)', () => {
    it('docking consumes the hop, enters the serialized port phase, and emits port:entered', () => {
      const { run, bus } = freshRunWithBus(1, { daemon: null });
      const entered: Array<{ nodeId: number }> = [];
      bus.on('port:entered', (e) => entered.push(e));
      dockAtPort(run, bus);
      expect(run.phase).toBe('port');
      expect(entered).toHaveLength(1);
      expect(entered[0]!.nodeId).toBe(run.currentNodeId);
      expect(nodeKindOf(run, run.currentNodeId)).toBe('port');
    });

    it('leavePort undocks to the map; the frontier advances FROM the port node', () => {
      const { run, bus } = freshRunWithBus(1, { daemon: null });
      dockAtPort(run, bus);
      const portNode = run.currentNodeId;
      run.dispatch({ kind: 'leavePort' });
      expect(run.phase).toBe('map');
      expect(run.currentNodeId).toBe(portNode); // still standing on the dock
      // The onward frontier is live: entering a next-hop node leaves 'map'.
      const onward = frontierIdsOf(run)[0]!;
      run.dispatch({ kind: 'enterNode', nodeId: onward });
      expect(run.phase).not.toBe('map');
    });

    it('leavePort outside the port phase is a silent no-op', () => {
      const { run } = freshRunWithBus(1, { daemon: null });
      run.dispatch({ kind: 'leavePort' });
      expect(run.phase).toBe('map');
      run.dispatch({ kind: 'enterNode', nodeId: frontierOf(run) });
      const during = run.phase;
      run.dispatch({ kind: 'leavePort' });
      expect(run.phase).toBe(during);
    });

    it('a mid-dock save round-trips the port phase; undock works on the restored run', () => {
      const { run, bus } = freshRunWithBus(1, { daemon: null });
      dockAtPort(run, bus);
      const wire = JSON.parse(JSON.stringify(run.toJSON()));
      expect(wire.schemaVersion).toBe(42); // 77d2 — keyed derivation
      expect(wire.phase).toBe('port');
      const restored = Run.fromJSON(wire, new EventBus<GameEvents>());
      expect(restored.phase).toBe('port');
      expect(restored.currentNodeId).toBe(run.currentNodeId);
      restored.dispatch({ kind: 'leavePort' });
      expect(restored.phase).toBe('map');
      expect(() =>
        Run.fromJSON({ ...wire, schemaVersion: 34 }, new EventBus<GameEvents>()),
      ).toThrow(/unsupported schema version/);
    });
  });

  describe('50d — port stock + transactions', () => {
    const RICH = 10_000; // affordability never the variable unless a test makes it one

    it('docking rolls stock at the config counts; packets/daemons distinct; owned daemons excluded', () => {
      const { run, bus } = freshRunWithBus(1, { daemon: daemonById('moneta')! });
      dockAtPort(run, bus);
      const stock = run.portStock!;
      expect(stock.units).toHaveLength(PRICES.portStock.units);
      expect(stock.packets).toHaveLength(Math.min(PRICES.portStock.packets, PACKETS.length));
      expect(new Set(stock.packets.map((s) => s.packetId)).size).toBe(stock.packets.length);
      const owned = new Set(run.daemons.map((d) => d.id));
      expect(stock.daemons).toHaveLength(
        Math.min(PRICES.portStock.daemons, DAEMONS.length - owned.size),
      );
      expect(new Set(stock.daemons.map((s) => s.daemonId)).size).toBe(stock.daemons.length);
      for (const s of stock.daemons) expect(owned.has(s.daemonId)).toBe(false);
      // Flat price-book prices on packet/daemon slots (no jitter axis there).
      for (const s of stock.packets) expect(s.price).toBe(packetPrice(s.packetId));
      for (const s of stock.daemons) expect(s.price).toBe(daemonPrice(s.daemonId));
    });

    it('unit slots price at the level curve ± the config jitter, integer ≥1; same seed → same stock', () => {
      const a = freshRunWithBus(7, { daemon: null });
      dockAtPort(a.run, a.bus);
      for (const s of a.run.portStock!.units) {
        const base = unitPrice(s.template.archetype, s.template.level);
        expect(Number.isInteger(s.price)).toBe(true);
        expect(s.price).toBeGreaterThanOrEqual(1);
        // round(base × factor) with factor ∈ [1−j, 1+j] → half-a-unit slack
        expect(Math.abs(s.price - base)).toBeLessThanOrEqual(base * PRICES.units.jitter + 0.5);
      }
      const b = freshRunWithBus(7, { daemon: null });
      dockAtPort(b.run, b.bus);
      expect(b.run.portStock).toEqual(a.run.portStock);
    });

    it('buyPortUnit: spends the slot price, appends via the recruit path, marks sold; re-buy + broke are no-ops', () => {
      const { run, bus } = freshRunWithBus(1, { daemon: null, startingBits: RICH });
      dockAtPort(run, bus);
      const slot = run.portStock!.units[0]!;
      const teamBefore = run.team.length;
      run.dispatch({ kind: 'buyPortUnit', index: 0 });
      expect(run.bits).toBe(RICH - slot.price);
      expect(run.team).toHaveLength(teamBefore + 1);
      expect(run.team[teamBefore]).toEqual(slot.template);
      expect(run.deploymentCounts).toHaveLength(run.team.length);
      expect(run.encounterEffects).toHaveLength(run.team.length);
      expect(run.pendingEncounterEffects).toHaveLength(run.team.length);
      expect(slot.sold).toBe(true);
      run.dispatch({ kind: 'buyPortUnit', index: 0 }); // sold — no-op
      expect(run.bits).toBe(RICH - slot.price);
      expect(run.team).toHaveLength(teamBefore + 1);
      const broke = freshRunWithBus(1, { daemon: null, startingBits: 0 });
      dockAtPort(broke.run, broke.bus);
      broke.run.dispatch({ kind: 'buyPortUnit', index: 0 });
      expect(broke.run.team).toHaveLength(teamBefore);
      expect(broke.run.portStock!.units[0]!.sold).toBe(false);
    });

    it('buyPortPacket: room = plain buy; full cache = the swap contract, affordability validated FIRST', () => {
      const { run, bus } = freshRunWithBus(1, { daemon: null, startingBits: RICH });
      dockAtPort(run, bus);
      const slot = run.portStock!.packets[0]!;
      run.dispatch({ kind: 'buyPortPacket', index: 0 });
      expect(run.cache).toContain(slot.packetId);
      expect(run.bits).toBe(RICH - slot.price);
      expect(slot.sold).toBe(true);
      // Fill the cache to the derived size, then a swap-less buy no-ops…
      while (run.cacheHasRoom) run.addPacket('patch');
      const full = [...run.cache];
      const slot1 = run.portStock!.packets[1]!;
      run.dispatch({ kind: 'buyPortPacket', index: 1 });
      expect(run.cache).toEqual(full);
      expect(slot1.sold).toBe(false);
      // …and a valid swap discards the held slot and adds the bought one.
      run.dispatch({ kind: 'buyPortPacket', index: 1, swapCacheIndex: 0 });
      expect(run.cache).toHaveLength(full.length);
      expect(run.cache).toContain(slot1.packetId);
      expect(slot1.sold).toBe(true);
      // Validate-first: a broke buyer's swap discards NOTHING.
      const broke = freshRunWithBus(1, { daemon: null, startingBits: 0 });
      dockAtPort(broke.run, broke.bus);
      while (broke.run.cacheHasRoom) broke.run.addPacket('patch');
      const held = [...broke.run.cache];
      broke.run.dispatch({ kind: 'buyPortPacket', index: 0, swapCacheIndex: 0 });
      expect(broke.run.cache).toEqual(held);
    });

    it('buyPortDaemon: joins ownership + spends; a second dock re-excludes it from stock', () => {
      const { run, bus } = freshRunWithBus(1, { daemon: null, startingBits: RICH });
      dockAtPort(run, bus);
      const slot = run.portStock!.daemons[0]!;
      const ownedBefore = run.daemons.length;
      run.dispatch({ kind: 'buyPortDaemon', index: 0 });
      expect(run.daemons).toHaveLength(ownedBefore + 1);
      expect(run.daemons.at(-1)!.id).toBe(slot.daemonId);
      expect(run.bits).toBe(RICH - slot.price);
      expect(slot.sold).toBe(true);
    });

    it('sellPacket: the refund is RAW ⌊price × sellFraction⌋ — the bitsGain fold never applies (no mint)', () => {
      const { run, bus } = freshRunWithBus(1, {
        daemon: daemonById('moneta')!, // the fold daemon — a folded refund would differ
        startingBits: 0,
      });
      run.addPacket('patch');
      run.addPacket('patch');
      run.dispatch({ kind: 'sellPacket', cacheIndex: 0 }); // not docked — no-op
      expect(run.cache).toHaveLength(2);
      expect(run.bits).toBe(0);
      dockAtPort(run, bus);
      run.dispatch({ kind: 'sellPacket', cacheIndex: 0 });
      expect(run.cache).toHaveLength(1);
      expect(run.bits).toBe(sellPrice(packetPrice('patch'))); // raw — NOT effectiveBits
      run.dispatch({ kind: 'sellPacket', cacheIndex: 5 }); // out of range — no-op
      expect(run.cache).toHaveLength(1);
    });

    it('payToRemoveUnit: spends the flat price through the chokepoint; last-unit + broke charge nothing', () => {
      const { run, bus } = freshRunWithBus(1, { daemon: null, startingBits: RICH });
      dockAtPort(run, bus);
      const teamBefore = run.team.length;
      const survivor = run.team[1]!.archetype;
      run.dispatch({ kind: 'payToRemoveUnit', rosterIndex: 0 });
      expect(run.team).toHaveLength(teamBefore - 1);
      expect(run.team[0]!.archetype).toBe(survivor);
      expect(run.bits).toBe(RICH - PRICES.unitRemovalPrice);
      expect(run.pendingEncounterEffects).toHaveLength(run.team.length);
      while (run.team.length > 1) run.dispatch({ kind: 'payToRemoveUnit', rosterIndex: 0 });
      const bitsAtOne = run.bits;
      run.dispatch({ kind: 'payToRemoveUnit', rosterIndex: 0 }); // last unit — no-op, no charge
      expect(run.team).toHaveLength(1);
      expect(run.bits).toBe(bitsAtOne);
      const broke = freshRunWithBus(1, { daemon: null, startingBits: 0 });
      dockAtPort(broke.run, broke.bus);
      const brokeTeam = broke.run.team.length;
      broke.run.dispatch({ kind: 'payToRemoveUnit', rosterIndex: 0 });
      expect(broke.run.team).toHaveLength(brokeTeam);
    });

    it('a mid-dock save round-trips the stock (prices + sold flags); a corrupt slot id rejects', () => {
      const { run, bus } = freshRunWithBus(1, { daemon: null, startingBits: RICH });
      dockAtPort(run, bus);
      run.dispatch({ kind: 'buyPortUnit', index: 0 }); // a sold flag to carry
      const wire = JSON.parse(JSON.stringify(run.toJSON()));
      const restored = Run.fromJSON(wire, new EventBus<GameEvents>());
      expect(restored.portStock).toEqual(run.portStock);
      expect(restored.bits).toBe(run.bits);
      // Transactions keep working on the restored run.
      const slot = restored.portStock!.packets[0]!;
      restored.dispatch({ kind: 'buyPortPacket', index: 0 });
      expect(restored.cache).toContain(slot.packetId);
      // Corruption rejects loudly (the pendingRewards discipline).
      const corruptPacket = JSON.parse(JSON.stringify(wire));
      corruptPacket.portStock.packets[0].packetId = 'ghost';
      expect(() => Run.fromJSON(corruptPacket, new EventBus<GameEvents>())).toThrow(
        /unknown packet id 'ghost'/,
      );
      const corruptDaemon = JSON.parse(JSON.stringify(wire));
      corruptDaemon.portStock.daemons[0].daemonId = 'ghost';
      expect(() => Run.fromJSON(corruptDaemon, new EventBus<GameEvents>())).toThrow(
        /unknown daemon id 'ghost'/,
      );
    });

    it('leavePort clears the stock; the next save carries null', () => {
      const { run, bus } = freshRunWithBus(1, { daemon: null });
      dockAtPort(run, bus);
      expect(run.portStock).not.toBeNull();
      run.dispatch({ kind: 'leavePort' });
      expect(run.portStock).toBeNull();
      const wire = JSON.parse(JSON.stringify(run.toJSON()));
      expect(wire.portStock).toBeNull();
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

    it('a won turn offers the tally as the LEADING portion; accepting settles through gainBits (the bitsGain fold applies)', () => {
      const { run, bus } = freshRunWithBus(1, { daemon: null });
      run.addDaemon(daemonById('moneta')!);
      run.dispatch({ kind: 'enterNode', nodeId: frontierOf(run) });
      winEncounter(bus, [], 1_000, { bits: 10 });
      // 51a — the tally no longer settles directly: it leads the offer
      // (ahead of any win-rolled portions) and settles at ACCEPT time.
      expect(run.phase).toBe('reward');
      expect(run.pendingRewards![0]).toEqual({ kind: 'bits', base: 10 });
      expect(run.bits).toBe(0);
      run.dispatch({ kind: 'acceptReward', index: 0 });
      const rule = daemonById('moneta')!.rules![0]!;
      const mult = rule.kind === 'modifier' ? rule.value : NaN;
      expect(run.bits).toBe(Math.round(10 * mult));
    });

    it('an ongoing (draw) turn offers too — the reward gate interposes MID-ENCOUNTER (51a)', () => {
      const { run, bus } = freshRunWithBus(1, { daemon: null });
      run.dispatch({ kind: 'enterNode', nodeId: frontierOf(run) });
      chipTurn(bus, { player: 0, enemy: 0 }, [], { bits: 3 });
      expect(run.phase).toBe('reward');
      expect(run.pendingRewards).toEqual([{ kind: 'bits', base: 3 }]);
      run.dispatch({ kind: 'acceptReward', index: 0 });
      // Resolving the offer resumes the encounter (the ungated path falls
      // straight into the next turn's battle).
      expect(run.phase).toBe('battle');
      chipTurn(bus, { player: 0, enemy: 0 }, [], { bits: 4 });
      run.dispatch({ kind: 'acceptReward', index: 0 });
      expect(run.bits).toBe(7);
    });

    it('declining the tally forfeits it — the encounter continues, no bits (51a)', () => {
      const { run, bus } = freshRunWithBus(1, { daemon: null });
      run.dispatch({ kind: 'enterNode', nodeId: frontierOf(run) });
      chipTurn(bus, { player: 0, enemy: 0 }, [], { bits: 5 });
      expect(run.phase).toBe('reward');
      run.dispatch({ kind: 'declineReward', index: 0 });
      expect(run.bits).toBe(0);
      expect(run.phase).toBe('battle');
    });

    it('the tally portion is SOURCE-LABELED when exactly one owned daemon earns battle bits (51a)', () => {
      const { run, bus } = freshRunWithBus(1, { daemon: BATTLE_BITS });
      run.dispatch({ kind: 'enterNode', nodeId: frontierOf(run) });
      chipTurn(bus, { player: 0, enemy: 0 }, [], { bits: 2 });
      expect(run.pendingRewards).toEqual([
        { kind: 'bits', base: 2, source: 'test-battle-bits' },
      ]);
    });

    it('a winning turn MERGES the tally into the rolled offer — tally first (51a)', () => {
      // brigands carries `bits-small` at chance 1 (the 48a reference), so
      // the win roll is guaranteed at least one portion after the tally.
      const { run, bus } = freshRunWithBus(1, {
        daemon: BATTLE_BITS,
        forcedEncounterId: 'brigands',
      });
      run.dispatch({ kind: 'enterNode', nodeId: frontierOf(run) });
      winEncounter(bus, [], 1_000, { bits: 6 });
      expect(run.phase).toBe('reward');
      expect(run.pendingRewards!.length).toBeGreaterThanOrEqual(2);
      expect(run.pendingRewards![0]).toEqual({
        kind: 'bits',
        base: 6,
        source: 'test-battle-bits',
      });
    });

    it('two battle-bits earners → the label drops (the aggregate tally cannot attribute)', () => {
      const { run, bus } = freshRunWithBus(1, { daemon: BATTLE_BITS });
      run.addDaemon({ ...BATTLE_BITS, id: 'test-battle-bits-2', name: 'Test Battle Bits 2' });
      run.dispatch({ kind: 'enterNode', nodeId: frontierOf(run) });
      chipTurn(bus, { player: 0, enemy: 0 }, [], { bits: 2 });
      expect(run.pendingRewards).toEqual([{ kind: 'bits', base: 2 }]);
    });

    it('a miner-mined tally labels its PACKET source (51f — the earner pool spans injected rules)', () => {
      const { run, bus } = gatedToFirstTurnIntro(1, null);
      run.addPacket('miner');
      run.dispatch({ kind: 'usePacket', cacheIndex: 0 }); // install the run-duration rule
      run.dispatch({ kind: 'advanceTurn' }); // gate → battle
      chipTurn(bus, { player: 1, enemy: 1 }, [], { bits: 4 });
      run.dispatch({ kind: 'advanceTurn' }); // outcome → the gate chain
      expect(run.phase).toBe('reward');
      expect(run.pendingRewards).toEqual([{ kind: 'bits', base: 4, source: 'miner' }]);
    });

    it('a daemon earner + a packet earner together drop the label (cross-pool ambiguity)', () => {
      const { run, bus } = gatedToFirstTurnIntro(1, daemonById('laverna')!);
      run.addPacket('miner');
      run.dispatch({ kind: 'usePacket', cacheIndex: 0 });
      run.dispatch({ kind: 'advanceTurn' });
      chipTurn(bus, { player: 1, enemy: 1 }, [], { bits: 4 });
      run.dispatch({ kind: 'advanceTurn' });
      expect(run.pendingRewards).toEqual([{ kind: 'bits', base: 4 }]);
    });

    it('two miner installs stay ONE earner — the label holds (dedupe by source id)', () => {
      const { run, bus } = gatedToFirstTurnIntro(1, null);
      run.addPacket('miner');
      run.addPacket('miner');
      run.dispatch({ kind: 'usePacket', cacheIndex: 0 });
      run.dispatch({ kind: 'usePacket', cacheIndex: 0 });
      run.dispatch({ kind: 'advanceTurn' });
      chipTurn(bus, { player: 1, enemy: 1 }, [], { bits: 6 });
      run.dispatch({ kind: 'advanceTurn' });
      expect(run.pendingRewards).toEqual([{ kind: 'bits', base: 6, source: 'miner' }]);
    });

    it('a mid-offer save round-trips the labeled tally portion (v36)', () => {
      // The CATALOG battle-bits idol (daemons restore by id — a bespoke
      // daemon would hard-reject at fromJSON).
      const { run, bus } = freshRunWithBus(1, { daemon: daemonById('laverna')! });
      run.dispatch({ kind: 'enterNode', nodeId: frontierOf(run) });
      chipTurn(bus, { player: 0, enemy: 0 }, [], { bits: 9 });
      const wire = JSON.parse(JSON.stringify(run.toJSON()));
      expect(wire.schemaVersion).toBe(42); // 77d2 — keyed derivation
      expect(wire.phase).toBe('reward');
      const restored = Run.fromJSON(wire, new EventBus<GameEvents>());
      expect(restored.pendingRewards).toEqual([
        { kind: 'bits', base: 9, source: 'laverna' },
      ]);
      restored.dispatch({ kind: 'acceptReward', index: 0 });
      expect(restored.bits).toBe(9);
      expect(restored.phase).toBe('battle');
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
      const oldRun = new Run(1, bus, NO_EVENTS);
      const oldFrontier = frontierOf(oldRun);
      oldRun.dispatch({ kind: 'enterNode', nodeId: oldFrontier });
      // Both runs are now in battle phase (well, oldRun is). Dispose it.
      oldRun.dispose();

      const newRun = new Run(2, bus, NO_EVENTS);
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
      expect(run.currentSectorNodeId).toBe('start'); // the shipped DAG's one source
      expect(run.currentNodeId).toBe(PRE_ROOT_NODE_ID);
    });

    it('exposes the current sector title (for the map banner), even at pre-root', () => {
      const { run } = freshRunWithBus(1);
      // Available before any node is entered — derived from config, not hardcoded.
      expect(run.currentNodeId).toBe(PRE_ROOT_NODE_ID);
      expect(run.currentSectorTitle).toBe(getSector('the-start')!.title);
    });

    it('the shipped DAG (67c: start → deep-end) gates at the first terminal, completes at the second', () => {
      const { run, bus } = freshRunWithBus(1);
      run.currentNodeId = run.nodeMap.terminalId;
      run.phase = 'battle';
      let victories = 0;
      bus.on('run:victory', () => victories++);
      winEncounter(bus);
      // The Start's terminal is no longer a sink — the 67a gate, then act two.
      expect(victories).toBe(0);
      expect(run.phase).toBe('sectorCleared');
      run.dispatch({ kind: 'dismissSectorCleared' });
      expect(run.currentSectorNodeId).toBe('deep-end');
      expect(run.currentSectorId).toBe('the-deep-end');
      expect(run.currentSectorTitle).toBe(getSector('the-deep-end')!.title);
      // Clear the second terminal — deep-end IS the sink → the run completes.
      run.currentNodeId = run.nodeMap.terminalId;
      run.phase = 'battle';
      winEncounter(bus);
      expect(run.phase).toBe('complete');
      expect(victories).toBe(1);
    });

    it('clearing a non-sink terminal advances to the successor sector, carrying roster + pool', () => {
      const { run, bus } = freshRunWithBus(1, { sectorMap: TWO_SECTOR_MAP });
      expect(run.currentSectorNodeId).toBe('a');
      const teamBefore = run.team;
      const bossMapBefore = run.bossEncounterMap;
      run.playerHealth = 33; // a sentinel to prove the pool carries across
      run.currentNodeId = run.nodeMap.terminalId;
      run.phase = 'battle';
      let victories = 0;
      bus.on('run:victory', () => victories++);
      const cleared: GameEvents['sector:cleared'][] = [];
      bus.on('sector:cleared', (e) => cleared.push(e));
      winEncounter(bus);
      // Advanced — NOT won — landing on the 67a gate with the state already
      // swapped and the emit carrying both titles (the fixture's nodes share
      // one sector, so both read the same config-derived title).
      expect(victories).toBe(0);
      expect(run.phase).toBe('sectorCleared');
      const title = getSector('the-start')!.title;
      expect(cleared).toEqual([{ clearedSectorTitle: title, nextSectorTitle: title }]);
      expect(run.currentSectorNodeId).toBe('b');
      expect(run.currentNodeId).toBe(PRE_ROOT_NODE_ID);
      expect(run.visitedNodes.size).toBe(0);
      expect(run.nodeMap.terminalId).toBeGreaterThanOrEqual(0);
      // 66a — the forewarning pair re-rolled at the sector entry (a fresh
      // board object, not the old sector's reference).
      expect(run.bossEncounterMap).not.toBe(bossMapBefore);
      // Carry-across: same roster reference + the run-wide pool survive.
      expect(run.team).toBe(teamBefore);
      expect(run.playerHealth).toBe(33);
      // The dismiss releases the gate onto the new sector's map.
      run.dispatch({ kind: 'dismissSectorCleared' });
      expect(run.phase).toBe('map');
    });

    it('clearing the final sector terminal (a sink) completes the run', () => {
      const { run, bus } = freshRunWithBus(1, { sectorMap: TWO_SECTOR_MAP });
      // Advance through sector a → b (through the 67a gate).
      run.currentNodeId = run.nodeMap.terminalId;
      run.phase = 'battle';
      winEncounter(bus);
      run.dispatch({ kind: 'dismissSectorCleared' });
      expect(run.currentSectorNodeId).toBe('b');
      // Now clear b's terminal — b is a sink → victory, no gate.
      run.currentNodeId = run.nodeMap.terminalId;
      run.phase = 'battle';
      let victories = 0;
      bus.on('run:victory', () => victories++);
      winEncounter(bus);
      expect(run.phase).toBe('complete');
      expect(victories).toBe(1);
    });

    it('dismissSectorCleared outside the gate is a silent no-op (67a)', () => {
      const { run } = freshRunWithBus(1);
      expect(run.phase).toBe('map');
      run.dispatch({ kind: 'dismissSectorCleared' });
      expect(run.phase).toBe('map');
    });

    it('a mid-gate save/load restores the sectorCleared phase and dismisses cleanly (67a)', () => {
      const { run, bus } = freshRunWithBus(1, { sectorMap: TWO_SECTOR_MAP });
      run.currentNodeId = run.nodeMap.terminalId;
      run.phase = 'battle';
      winEncounter(bus);
      expect(run.phase).toBe('sectorCleared');
      const snap = JSON.parse(JSON.stringify(run.toJSON())) as ReturnType<Run['toJSON']>;
      const restored = Run.fromJSON(snap, new EventBus<GameEvents>());
      // The gate is phase-backed (the 67a fork's whole point): a restore
      // lands ON the gate, not silently past it.
      expect(restored.phase).toBe('sectorCleared');
      expect(restored.currentSectorNodeId).toBe('b');
      restored.dispatch({ kind: 'dismissSectorCleared' });
      expect(restored.phase).toBe('map');
      expect(restored.currentNodeId).toBe(PRE_ROOT_NODE_ID);
    });

    it('hopCount is the SINGLE-sector probe dial (67c): its terminal completes the run on the shipped DAG', () => {
      const { run, bus } = freshRunWithBus(1, { hopCount: 2 });
      expect(run.nodeMap.hops.length).toBe(2);
      run.currentNodeId = run.nodeMap.terminalId;
      run.phase = 'battle';
      let victories = 0;
      bus.on('run:victory', () => victories++);
      winEncounter(bus);
      // No gate, no advance — the probe's terminal IS the run terminal.
      expect(run.phase).toBe('complete');
      expect(victories).toBe(1);
      expect(run.currentSectorNodeId).toBe('start');
    });

    it('sectorHops is the shortened FULL-WALK dial (67c): every sector maps to N hops, the DAG still sinks', () => {
      const { run, bus } = freshRunWithBus(1, { sectorHops: 3 });
      expect(run.nodeMap.hops.length).toBe(3); // overrides the authored 11
      run.currentNodeId = run.nodeMap.terminalId;
      run.phase = 'battle';
      winEncounter(bus);
      // Still walks the DAG: the gate, then act two — ALSO 3 hops.
      expect(run.phase).toBe('sectorCleared');
      run.dispatch({ kind: 'dismissSectorCleared' });
      expect(run.currentSectorId).toBe('the-deep-end');
      expect(run.nodeMap.hops.length).toBe(3);
      // And the sink completes as normal.
      run.currentNodeId = run.nodeMap.terminalId;
      run.phase = 'battle';
      let victories = 0;
      bus.on('run:victory', () => victories++);
      winEncounter(bus);
      expect(run.phase).toBe('complete');
      expect(victories).toBe(1);
    });

    it('hopCount + sectorHops together throw loud at construction (67c)', () => {
      expect(() => new Run(1, new EventBus<GameEvents>(), { hopCount: 2, sectorHops: 3 })).toThrow(
        /mutually exclusive/,
      );
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
      const run = new Run(1, new EventBus<GameEvents>(), NO_EVENTS);
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
      const run = new Run(1, new EventBus<GameEvents>(), NO_EVENTS);
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
      const run = new Run(1, new EventBus<GameEvents>(), NO_EVENTS);
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
    type RosterSpec = { archetype: 'mercenary' | 'archer'; level: number };
    const BIG_ROSTER: RosterSpec[] = Array.from({ length: 8 }, (_, i) => ({
      archetype: i % 2 === 0 ? 'mercenary' : 'archer',
      level: 1,
    }));

    /** Enter the first battle on a custom roster; return the live Run + bus. */
    function enterFirstBattle(roster: RosterSpec[], seed = 1): { run: Run; bus: EventBus<GameEvents> } {
      const bus = new EventBus<GameEvents>();
      const run = new Run(seed, bus, { ...NO_EVENTS, startingRoster: roster });
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
        { archetype: 'archer' as const, level: 1 },
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
      const run = new Run(1, bus, { ...NO_EVENTS, startingRoster: BIG_ROSTER });
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
      // hopCount 5 → a hop-2 rest is the first reachable rest. (Was 4
      // pre-77e2; the quota layer's floor priority port → elite → rest
      // means a 4-hop map's 1–2 band slots never reach the rest floor —
      // 5 hops is the smallest shape whose band fits all three.) Clear the
      // hop-1 battle with no XP so the only XP the team carries into the rest
      // is the rest grant itself (expected level/xp derive from the actual
      // starting level, so this is robust to the startingLevel dial).
      const { run, bus, restId } = driveToRestFrontier({ hopCount: 5 }, 2);
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
        { hopCount: 5, startingRoster: LVL1_ROSTER },
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
        { archetype: 'archer' as const, level: cap },
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
      const run = new Run(1, bus, { ...NO_EVENTS, hopCount: 2 });
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

      // And a win at the boss completes the run: a `hopCount` probe is
      // SINGLE-sector (67c), so its terminal is the run terminal even on the
      // shipped two-sector DAG. The boss pool is deeper than the default, so
      // chip its actual pool to drain it.
      winEncounter(bus, [], run.enemyHealthPoolMax);
      // 48f — boss rewards fire BEFORE run:victory (uniform on terminal wins,
      // per the shape-lock); resolve them to reach the completion.
      acceptAllRewards(run);
      expect(run.phase).toBe('complete');
    });

    it('H6a — heals the run-wide player pool by restHealAmount when wounded', () => {
      const { run, restId } = driveToRestFrontier({ hopCount: 5 }, 2);
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
      const { run, restId } = driveToRestFrontier({ hopCount: 5 }, 2);
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
    // 49g — bits-small authors bits AND packet entries now, so the sample
    // may legitimately yield either. Assert the drawn portion matches an
    // AUTHORED entry (config-derived — robust to future table tuning).
    const table = rewardTableById('bits-small')!;
    const portion = run.pendingRewards![0]!;
    if (portion.kind === 'bits') {
      expect(
        table.entries.some(
          (e) => e.kind === 'bits' && portion.base >= e.min && portion.base <= e.max,
        ),
      ).toBe(true);
    } else if (portion.kind === 'packet') {
      expect(
        table.entries.some((e) => e.kind === 'packet' && e.packet === portion.packetId),
      ).toBe(true);
    } else {
      throw new Error('bits-small authors no daemon entries');
    }
  });

  it('acceptReward settles bits through the shared settle math and advances to recruit', () => {
    const { run, bus } = winWithRewards();
    // 49g — the live table can draw a packet now; the SETTLE pin needs a
    // bits portion, so overwrite the offer (the in-block daemon-order forge
    // pattern — plain mutation on the public field).
    run.pendingRewards = [{ kind: 'bits', base: 10 }];
    const portion = run.pendingRewards[0]!;
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
    // 49g — pin the offer to a bits portion (the settle math below needs
    // one; the rolled draw may be a packet now — same forge as above).
    run.pendingRewards = [{ kind: 'bits', base: 12 }];
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

describe('64a — The Cornucopia (recruitOfferSize)', () => {
  /** Drive one victory to the recruit offer, DECLINING rewards — an accepted
   *  daemon portion could be the Cornucopia itself (it ships in both reward
   *  tables), which would pollute an offer-size read. */
  const firstOfferDeclining = (seed: number, config?: RunConfig) => {
    const { run, bus } = freshRunWithBus(seed, config);
    run.dispatch({ kind: 'enterNode', nodeId: frontierOf(run) });
    winEncounter(bus);
    declineAllRewards(run);
    return run.currentOffer ?? [];
  };

  const cornucopia = daemonById('cornucopia')!;
  // The catalog's authored bonus, DERIVED (not a hardcoded +1) so a §68
  // retune of the value keeps these expectations honest.
  const bonus = (() => {
    const rule = cornucopia.rules![0]!;
    if (rule.kind !== 'modifier') throw new Error('cornucopia rule 0 must be a modifier');
    return rule.value;
  })();

  it('ships as a pure modifier on recruitOfferSize (no hooks — the 64 shape-lock)', () => {
    expect(cornucopia.rules).toEqual([
      { kind: 'modifier', stat: 'recruitOfferSize', op: 'add', value: bonus },
    ]);
  });

  it('effectiveOfferSize folds the catalog bonus over the config base', () => {
    const { run } = freshRunWithBus(11, { daemon: cornucopia });
    expect(run.effectiveOfferSize).toBe(Math.floor(RECRUITMENT.defaultOfferSize + bonus));
    expect(freshRunWithBus(11, { daemon: null }).run.effectiveOfferSize).toBe(
      RECRUITMENT.defaultOfferSize,
    );
  });

  it('a won battle offers one more recruit with the daemon owned', () => {
    expect(firstOfferDeclining(21, { daemon: cornucopia })).toHaveLength(
      RECRUITMENT.defaultOfferSize + bonus,
    );
    expect(firstOfferDeclining(21, { daemon: null })).toHaveLength(RECRUITMENT.defaultOfferSize);
  });

  it('holds × each character (the count is orthogonal to the 63c pools/weights seam)', () => {
    for (const id of [DEFAULT_CHARACTER_ID, 'priest', 'gambler']) {
      const character = characterById(id)!;
      const offer = firstOfferDeclining(31, { character, daemon: cornucopia });
      expect(offer).toHaveLength(RECRUITMENT.defaultOfferSize + bonus);
      // Composition still character-governed (63c): nothing blacklisted leaks.
      for (const t of offer) expect(character.blacklist).not.toContain(t.archetype);
    }
  });

  it('leaves the PORT unit count untouched (spec scope: post-encounter only)', () => {
    // Seed 42 (74e re-seed): 41's every port route crossed an event node.
    const { run, bus } = freshRunWithBus(42, { daemon: cornucopia });
    dockAtPort(run, bus);
    expect(run.portStock!.units).toHaveLength(PRICES.portStock.units);
  });
});

describe("64b — Patrician's Seal (no commons)", () => {
  const seal = daemonById('patricians-seal')!;
  const commons = new Set<string>(DRAFTABLE_BY_TIER.common);

  /** Drive one victory to the recruit offer, DECLINING rewards (the 64a
   *  rationale — an accepted daemon portion would pollute the read). */
  const firstOfferDeclining = (seed: number, config?: RunConfig) => {
    const { run, bus } = freshRunWithBus(seed, config);
    run.dispatch({ kind: 'enterNode', nodeId: frontierOf(run) });
    winEncounter(bus);
    declineAllRewards(run);
    return run.currentOffer ?? [];
  };

  it('ships as a pure mult-0 modifier on the common tier weight (the 64 shape-lock)', () => {
    expect(seal.rules).toEqual([
      { kind: 'modifier', stat: 'rarityWeightCommon', op: 'mult', value: 0 },
    ]);
  });

  it('recruit offers hold NO common-tier units with the Seal owned (× each character)', () => {
    // Absolute across a seed scan — the zeroed tier holds no probability
    // mass (Recruitment.test pins the sampler math; this is the Run seam).
    for (const id of [DEFAULT_CHARACTER_ID, 'priest', 'gambler']) {
      const character = characterById(id)!;
      for (let seed = 50; seed < 60; seed++) {
        for (const u of firstOfferDeclining(seed, { character, daemon: seal })) {
          expect(commons.has(u.archetype)).toBe(false);
        }
      }
    }
  });

  it('a control run without the Seal DOES surface commons (the test is not vacuous)', () => {
    const seen = new Set<string>();
    for (let seed = 50; seed < 60; seed++) {
      for (const u of firstOfferDeclining(seed, { daemon: null })) seen.add(u.archetype);
    }
    expect([...seen].some((a) => commons.has(a))).toBe(true);
  });

  it('PORT stock inherits the fold — no commons on the shelf either (ports follow the same mechanics)', () => {
    const { run, bus } = freshRunWithBus(71, { daemon: seal });
    dockAtPort(run, bus);
    expect(run.portStock!.units).toHaveLength(PRICES.portStock.units); // count untouched (64a scope)
    for (const slot of run.portStock!.units) {
      expect(commons.has(slot.template.archetype)).toBe(false);
    }
  });
});

describe('64c — Idol of Portunus (guaranteed port legendary)', () => {
  const portunus = daemonById('portunus')!;
  const legendaries = new Set<string>(DRAFTABLE_BY_TIER.legendary);

  it('ships as a pure add modifier on portLegendaryOffers (the 64 shape-lock)', () => {
    expect(portunus.rules).toEqual([
      { kind: 'modifier', stat: 'portLegendaryOffers', op: 'add', value: 1 },
    ]);
  });

  it('slot 0 of the port shelf is legendary with the idol owned (across seeds)', () => {
    for (const seed of [81, 82, 83]) {
      const { run, bus } = freshRunWithBus(seed, { daemon: portunus });
      dockAtPort(run, bus);
      expect(run.portStock!.units).toHaveLength(PRICES.portStock.units);
      expect(legendaries.has(run.portStock!.units[0]!.template.archetype)).toBe(true);
    }
  });

  it('stacking: a second source forces a second slot (the count-stat shape-lock)', () => {
    // Seed 87 (74e re-seed): 84's every port route crossed an event node.
    const { run, bus } = freshRunWithBus(87, { daemon: portunus });
    run.addDaemon(portunus); // addDaemon never dedupes — two sources, +1 each
    expect(run.effectivePortLegendaryOffers).toBe(2);
    dockAtPort(run, bus);
    for (const slot of run.portStock!.units.slice(0, 2)) {
      expect(legendaries.has(slot.template.archetype)).toBe(true);
    }
  });

  it('degrades gracefully when the character blacklist empties the legendary pool', () => {
    // A synthetic in-memory character (the RunConfig.character seam takes the
    // object directly): every legendary blacklisted. The guarantee must fall
    // back to the normal roll — a stocked shelf, no throw, nothing legendary.
    const noLegends = {
      id: 'test-no-legends',
      name: 'Test No Legends',
      description: 'blacklists the whole legendary tier',
      roster: ['mercenary', 'archer'],
      daemon: 'mars',
      blacklist: [...DRAFTABLE_BY_TIER.legendary],
      weightOverrides: {},
    } as const;
    const { run, bus } = freshRunWithBus(85, { character: noLegends, daemon: portunus });
    dockAtPort(run, bus);
    expect(run.portStock!.units).toHaveLength(PRICES.portStock.units);
    for (const slot of run.portStock!.units) {
      expect(legendaries.has(slot.template.archetype)).toBe(false);
    }
  });

  it('composes with the Seal: no commons anywhere AND slot 0 legendary', () => {
    const { run, bus } = freshRunWithBus(86, { daemon: daemonById('patricians-seal')! });
    run.addDaemon(portunus);
    dockAtPort(run, bus);
    const commons = new Set<string>(DRAFTABLE_BY_TIER.common);
    expect(legendaries.has(run.portStock!.units[0]!.template.archetype)).toBe(true);
    for (const slot of run.portStock!.units) {
      expect(commons.has(slot.template.archetype)).toBe(false);
    }
  });
});

describe('64d — the drafting-daemon matrix (all three stacked × each character)', () => {
  const all = ['cornucopia', 'patricians-seal', 'portunus'].map((id) => daemonById(id)!);
  const commons = new Set<string>(DRAFTABLE_BY_TIER.common);
  const legendaries = new Set<string>(DRAFTABLE_BY_TIER.legendary);
  // The Cornucopia's authored bonus, derived (the 64a discipline).
  const rule0 = all[0]!.rules![0]!;
  const offerBonus = rule0.kind === 'modifier' ? rule0.value : 0;

  it('every effect holds simultaneously under every character', () => {
    for (const id of [DEFAULT_CHARACTER_ID, 'priest', 'gambler']) {
      const character = characterById(id)!;
      // Seed one via config, append the rest (the addDaemon acquisition path
      // — exactly how a run collects them from rewards/ports).
      const { run, bus } = freshRunWithBus(90, { character, daemon: all[0]! });
      for (const d of all.slice(1)) run.addDaemon(d);

      // 64a — the offer grows by the Cornucopia's bonus…
      run.dispatch({ kind: 'enterNode', nodeId: frontierOf(run) });
      winEncounter(bus);
      declineAllRewards(run);
      const offer = run.currentOffer ?? [];
      expect(offer).toHaveLength(RECRUITMENT.defaultOfferSize + offerBonus);
      // …64b — with no commons, and nothing character-blacklisted (63c).
      for (const u of offer) {
        expect(commons.has(u.archetype)).toBe(false);
        expect(character.blacklist).not.toContain(u.archetype);
      }
      run.dispatch({ kind: 'passRecruit' });

      // 64c at the port — shelf count untouched (the 64a scope pin), slot 0
      // legendary (Portunus), no commons on the shelf (the Seal, inherited).
      dockAtPort(run, bus);
      const units = run.portStock!.units;
      expect(units).toHaveLength(PRICES.portStock.units);
      expect(legendaries.has(units[0]!.template.archetype)).toBe(true);
      for (const slot of units) expect(commons.has(slot.template.archetype)).toBe(false);
    }
  });
});

describe('65a — drawAmount (the variable draw fold)', () => {
  // Base pinned config-derived in runStats.test.ts (= DECK.handSize); read
  // through the fold record here so a tuning edit keeps these honest.
  const BASE = RUN_STAT_BASES.drawAmount;
  /** A bespoke draw idol (no draw daemon ships in §65 — packets only). */
  const drawIdol = (value: number, op: 'add' | 'mult' = 'add'): DaemonConfig => ({
    id: 'test-draw',
    name: 'Test Draw',
    description: 'draw modifier',
    rules: [{ kind: 'modifier', stat: 'drawAmount', op, value }],
  });

  it('effectiveDrawAmount folds over the config base and floors at the read site', () => {
    expect(freshRunWithBus(7, { daemon: null }).run.effectiveDrawAmount).toBe(Math.floor(BASE));
    expect(freshRunWithBus(7, { daemon: drawIdol(1) }).run.effectiveDrawAmount).toBe(
      Math.floor(BASE + 1),
    );
    // 65d — the cap is the outermost clamp (a big mult saturates at it).
    expect(freshRunWithBus(7, { daemon: drawIdol(1.5, 'mult') }).run.effectiveDrawAmount).toBe(
      Math.min(DECK.maxHandSize, Math.floor(BASE * 1.5)),
    );
  });

  it('clamps at one — a pathological mult-0 cannot zero the hand into a soft-lock', () => {
    expect(freshRunWithBus(7, { daemon: drawIdol(0, 'mult') }).run.effectiveDrawAmount).toBe(1);
  });

  it('a +1 idol deals one extra card into the turn-1 hand (baseline unchanged without it)', () => {
    const dealt = (seed: number, daemon: DaemonConfig | null) => {
      const { run } = freshRunWithBus(seed, { daemon });
      run.dispatch({ kind: 'enterNode', nodeId: frontierOf(run) });
      return { hand: run.hand.length, roster: run.team.length };
    };
    const plus = dealt(31, drawIdol(1));
    expect(plus.hand).toBe(Math.min(plus.roster, BASE + 1));
    const base = dealt(31, null);
    expect(base.hand).toBe(Math.min(base.roster, BASE));
  });

  it('65d — an overdrawn fold saturates at the cap, not the roster', () => {
    const { run } = freshRunWithBus(31, { daemon: drawIdol(100) });
    expect(run.effectiveDrawAmount).toBe(DECK.maxHandSize);
    run.dispatch({ kind: 'enterNode', nodeId: frontierOf(run) });
    expect(run.hand).toHaveLength(Math.min(run.team.length, DECK.maxHandSize));
  });

  it('a draw amount past a SMALL roster simply fields everyone (the H5 exhaustion contract)', () => {
    // A roster below the cap, so exhaustion (not the 65d cap) is what stops
    // the deal: five mercenaries against an overdrawn fold.
    const roster = Array.from({ length: 5 }, () => ({
      archetype: 'mercenary' as const,
      level: 1,
    }));
    const { run } = freshRunWithBus(31, { daemon: drawIdol(100), startingRoster: roster });
    run.dispatch({ kind: 'enterNode', nodeId: frontierOf(run) });
    expect(run.hand).toHaveLength(run.team.length);
    expect(run.drawPile).toHaveLength(0);
  });
});

// A hand-relative reference encounter, DERIVED from the catalog (no
// hardcoded id to drift): first wave plain (unwrapping the catalog's
// standard loop{forever} shell), count hand-relative, budget
// mean-relative, uncapped — both resolver axes read the seam directly.
// Shared by the 65b seam pins and the 65c transient-exclusion pin.
const HAND_RELATIVE_REF = ENCOUNTERS.flatMap((e) => {
  const first = e.waves[0];
  const entry = first?.kind === 'loop' ? first.body[0] : first;
  return e.kind === 'normal' &&
    entry !== undefined &&
    entry.kind === 'wave' &&
    entry.spec.count.kind === 'hand' &&
    entry.spec.levelBudget.kind === 'mean' &&
    entry.spec.levelCap === undefined
    ? [
        {
          id: e.id,
          countFactor: entry.spec.count.factor,
          budgetFactor: entry.spec.levelBudget.factor,
        },
      ]
    : [];
})[0]!;

describe('65b — the budget seam consumes the draw fold (Option B)', () => {
  const drawIdol = (value: number): DaemonConfig => ({
    id: 'test-draw',
    name: 'Test Draw',
    description: 'draw modifier',
    rules: [{ kind: 'modifier', stat: 'drawAmount', op: 'add', value }],
  });

  const ref = HAND_RELATIVE_REF;

  /** Enter a forced hand-relative encounter; read the resolved turn-1 wave. */
  const turn1 = (daemon: DaemonConfig | null) => {
    const { run } = freshRunWithBus(41, { daemon, forcedEncounterId: ref.id });
    run.dispatch({ kind: 'enterNode', nodeId: frontierOf(run) });
    const enemies = run.currentEncounter!.enemyTeam;
    const basis = Math.min(run.team.length, run.effectiveDrawAmount);
    const mean = run.team.reduce((a, u) => a + u.level, 0) / run.team.length;
    return { run, enemies, basis, mean };
  };

  it('count-basis and budget-basis BOTH track min(roster, effectiveDrawAmount) — the K2 desync pin', () => {
    const base = turn1(null);
    const plus = turn1(drawIdol(1));
    // Non-vacuous: the idol moved the basis (roster > base draw at start).
    expect(plus.basis).toBe(base.basis + 1);
    // ONE basis feeds both resolver axes — count and level budget move
    // together or not at all (the K2 desync shape, pinned from the seam's
    // consumer side; expectations derived from the authored spec + the
    // uncapped distribute contract: Σlevels = max(C, L)).
    for (const { enemies, basis, mean } of [base, plus]) {
      const expectedCount = Math.round(ref.countFactor * basis);
      const expectedLevels = Math.max(expectedCount, Math.round(ref.budgetFactor * mean * basis));
      expect(enemies).toHaveLength(expectedCount);
      expect(enemies.reduce((a, u) => a + u.level, 0)).toBe(expectedLevels);
    }
  });

  it('the basis clamps under an overdrawn fold — 65d: at the cap, below the roster', () => {
    const { run, enemies, basis } = turn1(drawIdol(100));
    expect(basis).toBe(Math.min(run.team.length, DECK.maxHandSize));
    expect(enemies).toHaveLength(Math.round(ref.countFactor * basis));
  });
});

describe('65c — the hand-op packets (drawCards / discardCards)', () => {
  // Catalog-derived count (the balance-proof discipline — never hardcode
  // what packets.json authors).
  const drawCount = (() => {
    const p = packetById('surge');
    if (p === undefined || p.effect.op !== 'drawCards') {
      throw new Error("test fixture: 'surge' must be a drawCards packet");
    }
    return p.effect.count;
  })();

  it('surge grows the hand by its authored count, straight off the draw pile', () => {
    const { run, bus } = gatedToFirstTurnIntro(1, null);
    run.addPacket('surge');
    const handBefore = run.hand.length;
    const pileBefore = run.drawPile.length;
    const swaps: GameEvents['turn:handRedrawn'][] = [];
    bus.on('turn:handRedrawn', (e) => swaps.push(e));
    run.dispatch({ kind: 'usePacket', cacheIndex: 0 });
    expect(run.hand).toHaveLength(handBefore + drawCount);
    expect(run.drawPile).toHaveLength(pileBefore - drawCount);
    expect(run.cache).toEqual([]);
    // The repaint channel: one hand-changed emit, payload parallel to the
    // GROWN hand (the badge column included — a length the K3/K4 consumers
    // never saw before 65c).
    expect(swaps).toHaveLength(1);
    expect(swaps[0]!.hand).toHaveLength(handBefore + drawCount);
    expect(swaps[0]!.empowerStacks).toHaveLength(handBefore + drawCount);
  });

  it('stops early on a fully dealt deck — consume-on-fire stands (the patch-at-full-health precedent)', () => {
    // A roster below the 65d cap, so EXHAUSTION (not the cap) is what the
    // Surge hits: five units are all dealt at turn start, the deck is dry,
    // and a fired Surge draws zero — but still consumes (order of
    // consumption IS order of effect).
    const roster = Array.from({ length: 5 }, () => ({
      archetype: 'mercenary' as const,
      level: 1,
    }));
    const { run } = gatedToFirstTurnIntro(2, null, { startingRoster: roster });
    expect(run.hand).toHaveLength(5); // everyone fielded, deck dry
    expect(run.drawPile).toHaveLength(0);
    run.addPacket('surge');
    run.dispatch({ kind: 'usePacket', cacheIndex: 0 });
    expect(run.hand).toHaveLength(5); // nothing to draw
    expect(run.discardPile).toHaveLength(0); // turn 1 — nothing to reshuffle
    expect(run.cache).toEqual([]); // consumed regardless
  });

  it('cull sends the targeted card to the discard, no refill', () => {
    const { run } = gatedToFirstTurnIntro(3, null);
    run.addPacket('discard-one');
    const handBefore = [...run.hand];
    const target = handBefore[2]!;
    run.dispatch({ kind: 'usePacket', cacheIndex: 0, handIndex: 2 });
    expect(run.hand).toEqual([...handBefore.slice(0, 2), ...handBefore.slice(3)]);
    expect(run.discardPile).toEqual([target]);
    expect(run.cache).toEqual([]);
  });

  it('rejects at the validation gate: missing/bad handIndex, and the map context', () => {
    const gated = gatedToFirstTurnIntro(4, null);
    gated.run.addPacket('discard-one');
    gated.run.dispatch({ kind: 'usePacket', cacheIndex: 0 }); // missing handIndex
    gated.run.dispatch({ kind: 'usePacket', cacheIndex: 0, handIndex: 99 }); // out of range
    expect(gated.run.cache).toEqual(['discard-one']);
    // preTurn-only ops reject at the map (there is no hand there).
    const { run } = freshRunWithBus(4, { daemon: null });
    run.addPacket('surge');
    run.addPacket('discard-one');
    run.dispatch({ kind: 'usePacket', cacheIndex: 0 });
    run.dispatch({ kind: 'usePacket', cacheIndex: 1, rosterIndex: 0 });
    expect(run.cache).toEqual(['surge', 'discard-one']);
  });

  it('the last-card guard: culling down to one card, the final fire rejects (no empty hand)', () => {
    const { run } = gatedToFirstTurnIntro(5, null);
    for (let i = 0; i < 6; i++) run.addPacket('discard-one');
    for (let i = 0; i < 5; i++) run.dispatch({ kind: 'usePacket', cacheIndex: 0, handIndex: 0 });
    expect(run.hand).toHaveLength(1);
    run.dispatch({ kind: 'usePacket', cacheIndex: 0, handIndex: 0 });
    expect(run.hand).toHaveLength(1); // rejected — the hand cannot empty
    expect(run.cache).toEqual(['discard-one']); // nothing consumed on the reject
  });

  it('65d — the forced-draw dial folds like a daemon modifier (deal + budget basis together)', () => {
    const { run } = gatedToFirstTurnIntro(7, null, {
      drawAmountAdd: 2,
      forcedEncounterId: HAND_RELATIVE_REF.id,
    });
    const base = RUN_STAT_BASES.drawAmount;
    expect(run.effectiveDrawAmount).toBe(Math.floor(base + 2));
    expect(run.hand).toHaveLength(Math.min(run.team.length, base + 2));
    run.dispatch({ kind: 'advanceTurn' });
    const basis = Math.min(run.team.length, run.effectiveDrawAmount);
    expect(run.currentEncounter!.enemyTeam).toHaveLength(
      Math.round(HAND_RELATIVE_REF.countFactor * basis),
    );
    // NOT persisted (the X1 RunConfig discipline): a rehydrate resets to 0.
    const restored = Run.fromJSON(run.toJSON(), new EventBus<GameEvents>());
    expect(restored.effectiveDrawAmount).toBe(Math.floor(base));
  });

  it('the Option-B exclusion pin: a fired draw packet grows the hand but NOT the enemy-budget basis', () => {
    const { run } = gatedToFirstTurnIntro(6, null, {
      forcedEncounterId: HAND_RELATIVE_REF.id,
    });
    run.addPacket('surge');
    run.dispatch({ kind: 'usePacket', cacheIndex: 0 });
    const basis = Math.min(run.team.length, run.effectiveDrawAmount);
    expect(run.hand.length).toBe(basis + drawCount); // non-vacuous: hand ≠ basis
    run.dispatch({ kind: 'advanceTurn' });
    // The wave resolved AFTER the hand grew — and priced against the FOLD,
    // not the fielded hand (the 65b seam reads effectiveDrawAmount; packet
    // draws are pure advantage by design — worklog §65-shape-lock).
    const enemies = run.currentEncounter!.enemyTeam;
    expect(enemies).toHaveLength(Math.round(HAND_RELATIVE_REF.countFactor * basis));
  });
});

describe('65d — the max hand size (user-signed cap, deck.json)', () => {
  // Shipped-config sanity: a cap below the base draw would clamp every
  // deal — schema-legal, but the SHIPPED config must never do it.
  it('the shipped cap admits the base draw', () => {
    expect(DECK.maxHandSize).toBeGreaterThanOrEqual(DECK.handSize);
  });

  it('a Surge fired at a FULL hand rejects, consuming nothing (the last-card-guard sibling)', () => {
    // drawAmountAdd lifts the deal to the cap exactly (8 = 6 + 2 shipped).
    const { run } = gatedToFirstTurnIntro(8, null, {
      drawAmountAdd: DECK.maxHandSize - DECK.handSize,
    });
    expect(run.hand).toHaveLength(DECK.maxHandSize);
    run.addPacket('surge');
    run.dispatch({ kind: 'usePacket', cacheIndex: 0 });
    expect(run.hand).toHaveLength(DECK.maxHandSize); // unchanged
    expect(run.cache).toEqual(['surge']); // NOT consumed
  });

  it('a Surge that reaches the cap mid-draw partial-draws and consumes (the patch precedent)', () => {
    // One below the cap: the two-card Surge deals exactly one.
    const { run } = gatedToFirstTurnIntro(8, null, {
      drawAmountAdd: DECK.maxHandSize - DECK.handSize - 1,
    });
    expect(run.hand).toHaveLength(DECK.maxHandSize - 1);
    run.addPacket('surge');
    run.dispatch({ kind: 'usePacket', cacheIndex: 0 });
    expect(run.hand).toHaveLength(DECK.maxHandSize);
    expect(run.cache).toEqual([]); // consumed — order of consumption IS effect
  });
});

describe('65f — the deck cue stream (deck:cardDrawn / cardDiscarded / reshuffled)', () => {
  type Cue = { kind: 'drawn' | 'discarded' | 'reshuffled'; drawPile: number; discardPile: number };
  /** Subscribe a cue recorder to all three deck events. */
  const record = (bus: EventBus<GameEvents>): Cue[] => {
    const cues: Cue[] = [];
    bus.on('deck:cardDrawn', (e) => cues.push({ kind: 'drawn', ...e }));
    bus.on('deck:cardDiscarded', (e) => cues.push({ kind: 'discarded', ...e }));
    bus.on('deck:reshuffled', (e) => cues.push({ kind: 'reshuffled', ...e }));
    return cues;
  };

  it('the turn-1 deal cues one drawn per card, counts descending, nothing else', () => {
    const { run, bus } = freshRunWithBus(9, { daemon: null });
    run.pauseAtTurnGates = true;
    const cues = record(bus);
    run.dispatch({ kind: 'enterNode', nodeId: frontierOf(run) });
    const dealt = run.hand.length;
    const roster = run.team.length;
    expect(cues).toHaveLength(dealt); // no recycle, no reshuffle at turn 1
    cues.forEach((cue, i) => {
      expect(cue).toEqual({ kind: 'drawn', drawPile: roster - 1 - i, discardPile: 0 });
    });
  });

  it('a Cull cues exactly one discarded; a Surge cues its drawn count', () => {
    const { run, bus } = gatedToFirstTurnIntro(9, null);
    run.addPacket('discard-one');
    run.addPacket('surge');
    const cues = record(bus);
    run.dispatch({ kind: 'usePacket', cacheIndex: 0, handIndex: 0 });
    expect(cues).toEqual([
      { kind: 'discarded', drawPile: run.team.length - DECK.handSize, discardPile: 1 },
    ]);
    cues.length = 0;
    run.dispatch({ kind: 'usePacket', cacheIndex: 0 });
    const surge = packetById('surge')!.effect;
    const surgeCount = surge.op === 'drawCards' ? surge.count : 0;
    expect(cues.map((c) => c.kind)).toEqual(Array.from({ length: surgeCount }, () => 'drawn'));
  });

  it('a redraw cues all its discards, then all its refills (the K3 two-loop order)', () => {
    const { run, bus } = gatedToFirstTurnIntro(9, null);
    run.addPacket('reroute'); // grants 1 redraw action, ≤2 cards
    run.dispatch({ kind: 'usePacket', cacheIndex: 0 });
    const cues = record(bus);
    run.dispatch({ kind: 'redrawCards', handIndices: [0, 1], grantIndex: 0 });
    expect(cues.map((c) => c.kind)).toEqual(['discarded', 'discarded', 'drawn', 'drawn']);
  });

  it('the reshuffle interposes exactly where the pile runs dry, as ONE cue', () => {
    // Config-derived choreography (the 72f cap/Surge bump retired the old
    // hardcoded count-2 dance): Cull the dealt hand down to build a discard
    // pile, Surge while the pile still covers a full draw, then record the
    // one Surge that must cross the dry point mid-draw.
    const { run, bus } = gatedToFirstTurnIntro(9, null);
    const surge = packetById('surge')!.effect;
    const surgeCount = surge.op === 'drawCards' ? surge.count : 0;
    for (let i = 0; i < 4; i++) run.addPacket('discard-one');
    for (let i = 0; i < 4; i++) run.dispatch({ kind: 'usePacket', cacheIndex: 0, handIndex: 0 });
    while (run.drawPile.length >= surgeCount) {
      run.addPacket('surge');
      run.dispatch({ kind: 'usePacket', cacheIndex: 0 });
    }
    const pile = run.drawPile.length;
    const discard = run.discardPile.length;
    expect(discard).toBeGreaterThan(0); // the flip has fuel
    expect(pile).toBeLessThan(surgeCount); // the next Surge must cross dry
    expect(DECK.maxHandSize - run.hand.length).toBeGreaterThanOrEqual(surgeCount); // no cap clamp
    run.addPacket('surge');
    const cues = record(bus);
    run.dispatch({ kind: 'usePacket', cacheIndex: 0 });
    expect(cues).toEqual([
      ...Array.from({ length: pile }, (_, i) => ({
        kind: 'drawn',
        drawPile: pile - 1 - i,
        discardPile: discard,
      })),
      { kind: 'reshuffled', drawPile: discard, discardPile: 0 },
      ...Array.from({ length: surgeCount - pile }, (_, i) => ({
        kind: 'drawn',
        drawPile: discard - 1 - i,
        discardPile: 0,
      })),
    ]);
  });

  it('the turn-start recycle cues per-card discards (no screen up — still honest)', () => {
    // Drive to turn 2: a non-decisive chip leaves the encounter running, so
    // startNextTurn recycles the fought hand through the discard chokepoint.
    const { run, bus } = freshRunWithBus(9, { daemon: null });
    run.pauseAtTurnGates = true;
    run.dispatch({ kind: 'enterNode', nodeId: frontierOf(run) });
    const fought = run.hand.length;
    run.dispatch({ kind: 'advanceTurn' });
    const cues = record(bus);
    // A drawn turn with tiny chip — the pools survive, the encounter
    // continues; the gate advance runs startNextTurn (recycle + deal).
    chipTurn(bus, { player: 1, enemy: 1 });
    run.dispatch({ kind: 'advanceTurn' });
    // The organic turn-2 sequence with a 10-roster: the fought 6 recycle
    // per-card, the 4 remaining deal, the pile runs dry, ONE reshuffle
    // flips the 6 recycled back, and the deal finishes.
    expect(cues.map((c) => c.kind)).toEqual([
      ...Array.from({ length: fought }, () => 'discarded' as const),
      ...Array.from({ length: run.team.length - fought }, () => 'drawn' as const),
      'reshuffled',
      ...Array.from({ length: 2 * fought - run.team.length }, () => 'drawn' as const),
    ]);
    const discards = cues.filter((c) => c.kind === 'discarded');
    expect(discards[fought - 1]!.discardPile).toBe(fought);
  });
});

/**
 * 66a — boss forewarning: the sector-start pre-roll pair
 * `{bossEncounterId, bossEncounterMap}`, rolled on the sector-entry fork and
 * consumed by the boss node's `beginEncounter`. These pin the exit criteria:
 * the pair exists from construction, is seed-deterministic, the boss fight IS
 * the forewarned board, and a mid-sector save/load reproduces it exactly.
 */
describe('boss forewarning (66a) — the sector-start pre-roll', () => {
  it('pre-rolls a boss-kind encounter + a fully-built board at construction', () => {
    const run = new Run(1, new EventBus<GameEvents>(), NO_EVENTS);
    const boss = getEncounter(run.bossEncounterId);
    expect(boss).toBeDefined();
    expect(boss!.kind).toBe('boss');
    // A realized board, not a pending pick: dimensions + theme + terrain
    // seed all baked (the K3.5 EncounterMap shape).
    const map = run.bossEncounterMap;
    expect(map.gridW).toBeGreaterThan(0);
    expect(map.gridH).toBeGreaterThan(0);
    expect(THEMES).toContain(map.theme);
    expect(Number.isInteger(map.terrainSeed)).toBe(true);
    if (map.layoutId !== null) {
      expect(getLayout(map.layoutId)).toBeDefined();
    }
  });

  it('is seed-deterministic (same seed → the same pair)', () => {
    const a = new Run(7, new EventBus<GameEvents>(), NO_EVENTS);
    const b = new Run(7, new EventBus<GameEvents>(), NO_EVENTS);
    expect(b.bossEncounterId).toBe(a.bossEncounterId);
    expect(b.bossEncounterMap).toEqual(a.bossEncounterMap);
  });

  it('the boss fight consumes the pre-roll: the fight IS the forewarned board', () => {
    // hopCount 2 → root (hop 0, normal) -> terminal boss (hop 1).
    const { run, bus } = freshRunWithBus(1, { hopCount: 2 });
    const forewarnedId = run.bossEncounterId;
    const forewarnedMap = run.bossEncounterMap;
    // Clear the root battle + its recruit so the boss becomes the frontier.
    run.dispatch({ kind: 'enterNode', nodeId: run.nodeMap.rootId });
    winEncounter(bus);
    acceptAllRewards(run);
    run.dispatch({ kind: 'chooseRecruit', unitTemplate: run.currentOffer![0]! });
    run.dispatch({ kind: 'enterNode', nodeId: run.nodeMap.terminalId });
    expect(run.phase).toBe('battle');
    expect(run.selectedEncounter!.id).toBe(forewarnedId);
    expect(run.encounterMap).toEqual(forewarnedMap);
  });

  it('a mid-sector save/load reproduces the exact forewarned boss + board', () => {
    const { run, bus } = freshRunWithBus(3, { hopCount: 2 });
    // Save mid-sector: after the root battle's recruit, before the boss.
    run.dispatch({ kind: 'enterNode', nodeId: run.nodeMap.rootId });
    winEncounter(bus);
    acceptAllRewards(run);
    run.dispatch({ kind: 'chooseRecruit', unitTemplate: run.currentOffer![0]! });
    const snap = JSON.parse(JSON.stringify(run.toJSON())) as ReturnType<Run['toJSON']>;
    const restored = Run.fromJSON(snap, new EventBus<GameEvents>());
    expect(restored.bossEncounterId).toBe(run.bossEncounterId);
    expect(restored.bossEncounterMap).toEqual(run.bossEncounterMap);
    // And the restored run FIGHTS exactly what it forewarned.
    restored.dispatch({ kind: 'enterNode', nodeId: restored.nodeMap.terminalId });
    expect(restored.phase).toBe('battle');
    expect(restored.selectedEncounter!.id).toBe(run.bossEncounterId);
    expect(restored.encounterMap).toEqual(run.bossEncounterMap);
  });

  it('the X2 forced-encounter flag lands at pre-roll (a boss-kind force is honored)', () => {
    // Both shipped bosses force cleanly — proving the short-circuit runs at
    // sector start, not fight time (ids from the catalog, not hardcoded
    // composition: the loop derives nothing about their contents).
    for (const id of ['bandit-king', 'banditQueen']) {
      const run = new Run(1, new EventBus<GameEvents>(), { forcedEncounterId: id });
      expect(run.bossEncounterId).toBe(id);
    }
  });

  it('a NORMAL-kind forced encounter leaves the boss pre-roll on the pool roll (X2 kind-mismatch)', () => {
    const run = new Run(1, new EventBus<GameEvents>(), { forcedEncounterId: 'brigands' });
    expect(getEncounter(run.bossEncounterId)!.kind).toBe('boss');
  });

  it('fromJSON hard-rejects an unknown boss encounter id (the daemonIds discipline)', () => {
    const { run } = freshRunWithBus(1);
    const snap = { ...run.toJSON(), bossEncounterId: 'no-such-boss' };
    expect(() => Run.fromJSON(snap, new EventBus<GameEvents>())).toThrow(
      /unknown boss encounter id/,
    );
  });

  it('bossForewarning reports the display pair (66b): catalog name, layout name, null = procedural', () => {
    const run = new Run(1, new EventBus<GameEvents>(), NO_EVENTS);
    const fw = run.bossForewarning;
    expect(fw.name).toBe(getEncounter(run.bossEncounterId)!.name);
    if (run.bossEncounterMap.layoutId === null) {
      expect(fw.layoutName).toBeNull();
    } else {
      expect(fw.layoutName).toBe(getLayout(run.bossEncounterMap.layoutId)!.name);
    }
    // The G1 forced-procedural arm always reports a null layout name — the
    // view's "Uncharted Ground" branch (the label itself is UI voice, so the
    // run-layer contract is just the null).
    const proc = new Run(1, new EventBus<GameEvents>(), { forcedLayoutId: FORCE_PROCEDURAL });
    expect(proc.bossEncounterMap.layoutId).toBeNull();
    expect(proc.bossForewarning.layoutName).toBeNull();
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
  // 74i-c — battle-subject fixtures suppress the event catalog by default
  // (see NO_EVENTS at the top); a caller's own eventCatalog wins the spread.
  const run = new Run(seed, bus, { ...NO_EVENTS, ...config });
  return { run: Object.assign(run, { rootId: run.nodeMap.rootId }), bus };
}

/** The next selectable node from wherever the run currently sits — the root at
 *  the pre-root start (S2), else the current node's first outgoing edge. The
 *  standard "enter the next battle" hop. */
function frontierOf(run: Run): number {
  if (run.currentNodeId === PRE_ROOT_NODE_ID) return run.nodeMap.rootId;
  return run.nodeMap.edges.find((e) => e.from === run.currentNodeId)!.to;
}

// ---- 50c/50d — the port-dock helpers ---------------------------------------

function nodeKindOf(run: Run, id: number) {
  return run.nodeMap.nodes.find((n) => n.id === id)!.kind;
}

function frontierIdsOf(run: Run): number[] {
  return run.currentNodeId === PRE_ROOT_NODE_ID
    ? [run.nodeMap.rootId]
    : run.nodeMap.edges.filter((e) => e.from === run.currentNodeId).map((e) => e.to);
}

/** Any port reachable strictly downstream of (or at) `from`? 74i-c: the
 *  74e event-node avoidance is RETIRED — dockAtPort callers construct
 *  through the NO_EVENTS-suppressing fixtures now (an empty catalog means
 *  every event node degrades to a plain battle on entry: no effects, no
 *  state perturbation, and the resolve draw rides the DEDICATED eventRng
 *  stream), which is strictly stronger isolation than route avoidance —
 *  necessary since the sector-stamped root became an event node. */
function reachesPort(run: Run, from: number): boolean {
  const stack = [from];
  const seen = new Set([from]);
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (nodeKindOf(run, id) === 'port') return true;
    for (const e of run.nodeMap.edges) {
      if (e.from === id && !seen.has(e.to)) {
        seen.add(e.to);
        stack.push(e.to);
      }
    }
  }
  return false;
}

/** Walk the run to a port node and dock (wins forged via battle:ended — the
 *  WIN_BOUNTY idiom; rewards declined so bits stay exactly at their starting
 *  value). Every default map has ≥1 port (the NodeMap guarantee) and every
 *  node is root-reachable, so a port-reaching frontier choice always exists
 *  from the start. Deterministic — no policy draws. CALLERS MUST construct
 *  through an event-suppressed fixture (freshRunWithBus et al. — see
 *  NO_EVENTS); en-route event nodes then fight like battles (74i-c). */
function dockAtPort(run: Run, bus: EventBus<GameEvents>): void {
  for (let guard = 0; guard < 20; guard++) {
    expect(run.phase).toBe('map');
    const frontier = frontierIdsOf(run);
    const port = frontier.find((id) => nodeKindOf(run, id) === 'port');
    if (port !== undefined) {
      run.dispatch({ kind: 'enterNode', nodeId: port });
      return;
    }
    const next = frontier.find((id) => reachesPort(run, id));
    if (next === undefined) {
      throw new Error('dockAtPort: no port route from this frontier — re-seed the test');
    }
    run.dispatch({ kind: 'enterNode', nodeId: next });
    if (run.phase === 'battle') {
      winEncounter(bus);
      declineAllRewards(run);
    }
    if (run.phase === 'promotion') run.dispatch({ kind: 'dismissPromotion' });
    if (run.phase === 'recruit') run.dispatch({ kind: 'passRecruit' });
  }
  throw new Error('dockAtPort: never reached a port');
}

/** K3 — a gated run paused at its FIRST pre-turn gate (`turn-intro`), the only
 *  phase where a `redrawCards` command is live. L1: gates are daemon-only now,
 *  so the run carries `K_DEFAULT_DAEMON` (the old static dials) unless a test
 *  forces a specific daemon (or null = daemon-less). */
function gatedToFirstTurnIntro(
  seed: number,
  daemon: DaemonConfig | null = K_DEFAULT_DAEMON,
  config?: RunConfig,
): RunHandle {
  const handle = freshRunWithBus(seed, { daemon, ...config });
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
  { archetype: 'archer' as const, level: 1 },
  { archetype: 'archer' as const, level: 1 },
];

/** Like `freshRunWithBus` but pins a level-1 roster, for XP / promotion
 *  MECHANIC tests that award `xpToNext(1)` to force a 1→2 level-up — they must
 *  not depend on the `startingLevel` balance dial (which ships at 5). */
function freshLvl1RunWithBus(seed: number): RunHandle {
  const bus = new EventBus<GameEvents>();
  const run = new Run(seed, bus, { startingRoster: LVL1_ROSTER, ...NO_EVENTS });
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
  { archetype: 'archer' as const, level: RECRUITMENT.startingLevel },
  { archetype: 'archer' as const, level: RECRUITMENT.startingLevel },
];
function freshShortRosterRun(seed: number, config?: RunConfig): RunHandle {
  const bus = new EventBus<GameEvents>();
  const run = new Run(seed, bus, { startingRoster: SHORT_ROSTER, ...NO_EVENTS, ...config });
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
    const run = new Run(s, bus, { ...NO_EVENTS, ...config });
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

// ── 74b — the event phase ────────────────────────────────────────────────────

/** Fold the combat-resolve chance to 0 / past 1 via bespoke modifier daemons —
 *  the fold seam under test IS the test's control mechanism (the reason the
 *  chance is a run stat and not a raw config read). */
const NO_RESOLVE_DAEMON: DaemonConfig = {
  id: 'test-no-resolve',
  name: 'Test No Resolve',
  description: 'eventCombatChance × 0',
  rules: [{ kind: 'modifier', stat: 'eventCombatChance', op: 'mult', value: 0 }],
};
const ALWAYS_RESOLVE_DAEMON: DaemonConfig = {
  id: 'test-always-resolve',
  name: 'Test Always Resolve',
  description: 'eventCombatChance + 1',
  rules: [{ kind: 'modifier', stat: 'eventCombatChance', op: 'add', value: 1 }],
};

/** A bespoke catalog (the RunConfig.eventCatalog seam): deterministic
 *  single-outcome choices so every branch under test is forced, not rolled.
 *  Refs (deserters / bits-large) resolve against the SHIPPED catalogs. */
const TEST_EVENTS: EventDef[] = [
  {
    id: 'test-event',
    name: 'Test Event',
    entry: 'start',
    pages: {
      start: {
        text: 'the start page',
        choices: [
          {
            label: 'advance',
            outcomes: [{ effects: [{ op: 'gainBits', amount: 10 }], next: 'second' }],
          },
          {
            label: 'gated',
            condition: { kind: 'bitsAtLeast', amount: 999999 },
            outcomes: [{ next: { kind: 'return-to-map' } }],
          },
          {
            label: 'fight',
            outcomes: [
              {
                next: {
                  kind: 'start-encounter',
                  encounterId: 'deserters',
                  rewardOverride: 'bits-large',
                },
              },
            ],
          },
          {
            label: 'die',
            outcomes: [{ effects: [{ op: 'damagePool', amount: 99999 }], next: { kind: 'return-to-map' } }],
          },
          {
            label: 'spendheal',
            outcomes: [
              {
                effects: [
                  { op: 'spendBits', amount: 5 },
                  { op: 'healPool', amount: 3 },
                ],
                next: { kind: 'return-to-map' },
              },
            ],
          },
        ],
      },
      second: {
        text: 'the second page',
        choices: [
          {
            label: 'flag and leave',
            outcomes: [
              { effects: [{ op: 'setFlag', flag: 'test:done' }], next: { kind: 'return-to-map' } },
            ],
          },
        ],
      },
    },
  },
];

/** For save/load tests (no bespoke daemon allowed on the wire): a
 *  DAEMON-LESS run at the base resolve chance, scanning seeds until the
 *  entry roll opens the event rather than combat-resolving (~75% of seeds;
 *  robust against future stream shifts). */
function openEventAtSeedScan(extra: RunConfig): Run {
  for (let s = 200; s < 260; s++) {
    const run = new Run(s, new EventBus<GameEvents>(), {
      firstNodeKind: 'event',
      daemon: null,
      ...extra,
    });
    run.dispatch({ kind: 'enterNode', nodeId: run.nodeMap.rootId });
    if (run.phase === 'event') return run;
  }
  throw new Error('openEventAtSeedScan: no seed in [200,260) opened the event');
}

/** An event-phase run: root stamped 'event', the forced test event, the
 *  resolve chance folded off. */
function eventRun(seed: number, extra?: RunConfig): { run: Run; bus: EventBus<GameEvents> } {
  const bus = new EventBus<GameEvents>();
  const run = new Run(seed, bus, {
    firstNodeKind: 'event',
    forcedEventId: 'test-event',
    eventCatalog: TEST_EVENTS,
    daemon: NO_RESOLVE_DAEMON,
    ...extra,
  });
  return { run, bus };
}

describe('74b — the event phase', () => {
  it('the combat-resolve chance is fold-routed: base from config, bendable, ceiling-clamped', () => {
    const base = new Run(1, new EventBus<GameEvents>(), { daemon: null });
    expect(base.effectiveEventCombatChance()).toBe(RUN_STAT_BASES.eventCombatChance);
    const off = new Run(1, new EventBus<GameEvents>(), { daemon: NO_RESOLVE_DAEMON });
    expect(off.effectiveEventCombatChance()).toBe(0);
    // add +1 pushes past 1 (base 0.25 + 1 = 1.25) — the read site clamps.
    const on = new Run(1, new EventBus<GameEvents>(), { daemon: ALWAYS_RESOLVE_DAEMON });
    expect(on.effectiveEventCombatChance()).toBe(1);
  });

  it('entering an event node (chance folded to 0) opens the event phase at the entry page', () => {
    const { run, bus } = eventRun(101);
    const entered: Array<{ nodeId: number; eventId: string }> = [];
    bus.on('event:entered', (p) => entered.push(p));
    run.dispatch({ kind: 'enterNode', nodeId: run.nodeMap.rootId });
    expect(run.phase).toBe('event');
    expect(run.activeEvent).toEqual({ eventId: 'test-event', pageId: 'start' });
    expect(entered).toEqual([{ nodeId: run.nodeMap.rootId, eventId: 'test-event' }]);
    expect(run.currentEventPage()?.text).toBe('the start page');
  });

  it('a clamped chance of 1 combat-resolves every entry into a normal fight', () => {
    const { run } = eventRun(102, { daemon: ALWAYS_RESOLVE_DAEMON });
    run.dispatch({ kind: 'enterNode', nodeId: run.nodeMap.rootId });
    expect(run.phase).toBe('battle');
    expect(run.currentEncounter).not.toBeNull();
    expect(run.activeEvent).toBeNull();
  });

  it('a page-id next moves the cursor (emitting event:pageChanged) and effects execute', () => {
    const { run, bus } = eventRun(103);
    const pageChanges: Array<{ eventId: string; pageId: string }> = [];
    bus.on('event:pageChanged', (p) => pageChanges.push(p));
    run.dispatch({ kind: 'enterNode', nodeId: run.nodeMap.rootId });
    const bitsBefore = run.bits;
    run.dispatch({ kind: 'chooseEventOption', choiceIndex: 0 });
    // gainBits rides the earn-site fold (bitsGain 1 here) × the difficulty axis.
    expect(run.bits).toBe(bitsBefore + Math.round(10 * DIFFICULTY.bitsMultiplier));
    expect(run.activeEvent).toEqual({ eventId: 'test-event', pageId: 'second' });
    expect(pageChanges).toEqual([{ eventId: 'test-event', pageId: 'second' }]);
    expect(run.phase).toBe('event');
  });

  it('a failing condition disables the choice and rejects its dispatch (silent no-op)', () => {
    const { run } = eventRun(104);
    run.dispatch({ kind: 'enterNode', nodeId: run.nodeMap.rootId });
    expect(run.eventChoiceEnabled(1)).toBe(false); // bitsAtLeast 999999
    expect(run.enabledEventChoices()).toEqual([0, 2, 3, 4]);
    const before = JSON.stringify(run.toJSON());
    run.dispatch({ kind: 'chooseEventOption', choiceIndex: 1 });
    expect(JSON.stringify(run.toJSON())).toBe(before);
  });

  it('setFlag persists to the flag record; return-to-map releases to the map silently', () => {
    const { run } = eventRun(105);
    run.dispatch({ kind: 'enterNode', nodeId: run.nodeMap.rootId });
    run.dispatch({ kind: 'chooseEventOption', choiceIndex: 0 }); // → second
    run.dispatch({ kind: 'chooseEventOption', choiceIndex: 0 }); // setFlag + leave
    expect(run.phase).toBe('map');
    expect(run.activeEvent).toBeNull();
    expect(run.eventFlag('test:done')).toBe(true);
    expect(run.eventFlag('never:set')).toBeUndefined();
  });

  it('spendBits floors at the balance; healPool clamps at the pool max', () => {
    const { run } = eventRun(106, { daemon: NO_RESOLVE_DAEMON, startingBits: 3 });
    run.dispatch({ kind: 'enterNode', nodeId: run.nodeMap.rootId });
    run.dispatch({ kind: 'chooseEventOption', choiceIndex: 4 }); // spend 5 (have 3) + heal 3
    expect(run.bits).toBe(0);
    expect(run.toJSON().playerHealth).toBe(HEALTH.playerHealthMax); // was full; clamped
    expect(run.phase).toBe('map');
  });

  it('start-encounter opens the named fight with the pinned reward table, cleared at encounter end', () => {
    const { run, bus } = eventRun(107);
    run.dispatch({ kind: 'enterNode', nodeId: run.nodeMap.rootId });
    run.dispatch({ kind: 'chooseEventOption', choiceIndex: 2 });
    expect(run.phase).toBe('battle');
    expect(run.activeEvent).toBeNull();
    expect(run.toJSON().selectedEncounterId).toBe('deserters');
    expect(run.toJSON().pendingRewardOverride).toBe('bits-large');
    // Win the fight: the override table rolls at chance 1, so the reward
    // gate MUST interpose with a non-empty offer.
    winEncounter(bus);
    expect(run.phase).toBe('reward');
    expect(run.pendingRewards).not.toBeNull();
    acceptAllRewards(run);
    if (run.phase === 'promotion') run.dispatch({ kind: 'dismissPromotion' });
    expect(run.toJSON().pendingRewardOverride).toBeNull();
  });

  it('damagePool can kill the run: defeat fires and routing stops', () => {
    const { run, bus } = eventRun(108);
    let defeated = 0;
    bus.on('run:defeated', () => defeated++);
    run.dispatch({ kind: 'enterNode', nodeId: run.nodeMap.rootId });
    run.dispatch({ kind: 'chooseEventOption', choiceIndex: 3 }); // damagePool 99999
    expect(run.phase).toBe('defeat');
    expect(run.activeEvent).toBeNull();
    expect(defeated).toBe(1);
    expect(run.toJSON().playerHealth).toBe(0);
  });

  it('a mid-event save round-trips on the SHIPPED catalog (cursor + flags + stream)', () => {
    // A bespoke fold daemon can't ride a save (serialized by id — the
    // bespoke-daemon precedent), so run daemon-less at the BASE resolve
    // chance and scan for a seed whose entry roll opens the event (~75%).
    const run = openEventAtSeedScan({ forcedEventId: 'corrupted-shrine' });
    expect(run.phase).toBe('event');
    const wire = run.toJSON();
    expect(wire.schemaVersion).toBe(42); // 77d2 — keyed derivation
    expect(wire.activeEvent).toEqual({ eventId: 'corrupted-shrine', pageId: 'start' });
    const restored = Run.fromJSON(JSON.parse(JSON.stringify(wire)), new EventBus<GameEvents>());
    expect(restored.phase).toBe('event');
    expect(restored.activeEvent).toEqual(wire.activeEvent);
    expect(restored.currentEventPage()?.text).toBe(run.currentEventPage()?.text);
    expect(JSON.stringify(restored.toJSON())).toBe(JSON.stringify(wire));
  });

  it('a mid-event save on a BESPOKE catalog hard-rejects on load (the bespoke-daemon precedent)', () => {
    const run = openEventAtSeedScan({ forcedEventId: 'test-event', eventCatalog: TEST_EVENTS });
    const wire = run.toJSON();
    expect(() => Run.fromJSON(JSON.parse(JSON.stringify(wire)), new EventBus<GameEvents>())).toThrow(
      /unknown event id 'test-event'/,
    );
  });

  it('weighted outcomes are seed-deterministic (same seed ⇒ same branch)', () => {
    const drive = (): string => {
      const bus = new EventBus<GameEvents>();
      const run = new Run(111, bus, {
        firstNodeKind: 'event',
        forcedEventId: 'corrupted-shrine',
        daemon: NO_RESOLVE_DAEMON,
      });
      run.dispatch({ kind: 'enterNode', nodeId: run.nodeMap.rootId });
      run.dispatch({ kind: 'chooseEventOption', choiceIndex: 0 }); // the weighted scoop
      return JSON.stringify({ phase: run.phase, bits: run.bits, cursor: run.activeEvent });
    };
    expect(drive()).toBe(drive());
  });

  it('a not condition evaluates against live state (74c-pre — the combinator)', () => {
    // eventRun's control daemon ('test-no-resolve') is OWNED — so a choice
    // gated on NOT owning it must read disabled, and one gated on not-owning
    // a stranger must read enabled. The double-not exercises recursion.
    const { run } = eventRun(113, {
      forcedEventId: 'not-gate',
      eventCatalog: [
        {
          id: 'not-gate',
          name: 'Not Gate',
          entry: 'start',
          pages: {
            start: {
              text: 'p',
              choices: [
                {
                  label: 'needs NOT owned-daemon (disabled)',
                  condition: { kind: 'not', condition: { kind: 'hasDaemon', daemonId: 'test-no-resolve' } },
                  outcomes: [{ next: { kind: 'return-to-map' } }],
                },
                {
                  label: 'needs NOT stranger-daemon (enabled)',
                  condition: { kind: 'not', condition: { kind: 'hasDaemon', daemonId: 'never-owned' } },
                  outcomes: [{ next: { kind: 'return-to-map' } }],
                },
                {
                  label: 'double negation (enabled — owns it)',
                  condition: {
                    kind: 'not',
                    condition: { kind: 'not', condition: { kind: 'hasDaemon', daemonId: 'test-no-resolve' } },
                  },
                  outcomes: [{ next: { kind: 'return-to-map' } }],
                },
                { label: 'leave', outcomes: [{ next: { kind: 'return-to-map' } }] },
              ],
            },
          },
        },
      ],
    });
    run.dispatch({ kind: 'enterNode', nodeId: run.nodeMap.rootId });
    expect(run.enabledEventChoices()).toEqual([1, 2, 3]);
  });

});

// ── 74e — the sector-owned event pool ────────────────────────────────────────

/** A minimal terminating event for pool-roll tests: one unconditioned
 *  return-to-map choice. Ids deliberately reuse SHIPPED ids so the shipped
 *  sector pools resolve against a bespoke catalog (the override replaces
 *  defs wholesale — pool entries resolve by id against the ACTIVE catalog). */
function poolEvent(id: string, eligibility?: EventDef['eligibility']): EventDef {
  return {
    id,
    name: id,
    ...(eligibility !== undefined ? { eligibility } : {}),
    entry: 'p',
    pages: {
      p: { text: 't', choices: [{ label: 'leave', outcomes: [{ next: { kind: 'return-to-map' } }] }] },
    },
  };
}

const NEVER = [{ kind: 'bitsAtLeast', amount: 999999 } as const];

describe('74e — the sector-owned event pool', () => {
  // 74i-c — derived from the SHIPPED sector (never hardcoded): the demo
  // catalog grew the pool from the 3 smoke events to the full slate.
  const START_POOL_IDS = getSector('the-start')!.events.map((e) => e.eventId);

  it('an opened event comes from the SECTOR pool, not a bare catalog scan (the 74b placeholder retired)', () => {
    // Shipped catalog, no forced id: root stamped event, resolve folded off →
    // the entry roll must land inside The Start's authored `events` pool.
    const run = new Run(201, new EventBus<GameEvents>(), {
      firstNodeKind: 'event',
      daemon: NO_RESOLVE_DAEMON,
    });
    run.dispatch({ kind: 'enterNode', nodeId: run.nodeMap.rootId });
    expect(run.phase).toBe('event');
    expect(START_POOL_IDS).toContain(run.activeEvent!.eventId);
  });

  it('def eligibility filters at pool-roll time — a single survivor is forced', () => {
    // The bespoke catalog redefines the three POOLED ids: two gated closed,
    // one open. Whatever the weighted draw rolls, only the survivor can win.
    const run = new Run(202, new EventBus<GameEvents>(), {
      firstNodeKind: 'event',
      daemon: NO_RESOLVE_DAEMON,
      eventCatalog: [
        poolEvent('corrupted-shrine', NEVER),
        poolEvent('whispering-terminal', NEVER),
        poolEvent('whispering-terminal-collects'),
      ],
    });
    run.dispatch({ kind: 'enterNode', nodeId: run.nodeMap.rootId });
    expect(run.phase).toBe('event');
    expect(run.activeEvent!.eventId).toBe('whispering-terminal-collects');
  });

  it('an all-ineligible pool degrades to a normal fight (the 74b empty-pool rule)', () => {
    const run = new Run(203, new EventBus<GameEvents>(), {
      firstNodeKind: 'event',
      daemon: NO_RESOLVE_DAEMON,
      eventCatalog: [
        poolEvent('corrupted-shrine', NEVER),
        poolEvent('whispering-terminal', NEVER),
        poolEvent('whispering-terminal-collects', NEVER),
      ],
    });
    run.dispatch({ kind: 'enterNode', nodeId: run.nodeMap.rootId });
    expect(run.phase).toBe('battle');
    expect(run.activeEvent).toBeNull();
  });

  it('pool entries a bespoke catalog cannot resolve are skipped, not thrown (degrades to the fight)', () => {
    // The shipped sector pool references ids this catalog lacks entirely —
    // the boot guard owns shipped drift; the run-time roll just skips.
    const run = new Run(204, new EventBus<GameEvents>(), {
      firstNodeKind: 'event',
      daemon: NO_RESOLVE_DAEMON,
      eventCatalog: [poolEvent('unrelated-bespoke-event')],
    });
    expect(() => run.dispatch({ kind: 'enterNode', nodeId: run.nodeMap.rootId })).not.toThrow();
    expect(run.phase).toBe('battle');
  });
});

// ── 74i — per-run event repeats (the no-repeat default, user-signed) ─────────

describe('74i — per-run event repeats', () => {
  /** Twin-catalog fixture: the pool's only OPEN def, repeatable or not (the
   *  catalog never touches map generation, so both arms share a seed's map).
   *  eventChance 1 makes the scatter attempt every hop; the hunt below finds
   *  a seed whose hop-1 frontier carries the second event node. */
  function repeatRun(seed: number, repeatable: boolean): Run {
    const survivor = repeatable
      ? { ...poolEvent('whispering-terminal-collects'), repeatable: true }
      : poolEvent('whispering-terminal-collects');
    return new Run(seed, new EventBus<GameEvents>(), {
      firstNodeKind: 'event',
      eventChance: 1,
      daemon: NO_RESOLVE_DAEMON,
      eventCatalog: [
        poolEvent('corrupted-shrine', NEVER),
        poolEvent('whispering-terminal', NEVER),
        survivor,
      ],
    });
  }

  /** A hop-1 parent → hop-2 event-node edge (the scatter never places
   *  events at hop 1 — probed at 74i — so the second entry teleports to
   *  the parent instead of fighting the intervening battle). */
  function hop2EventEntry(run: Run): { parent: number; eventNode: number } | null {
    const hops = run.nodeMap.hops;
    if (hops.length < 3) return null;
    const kindOf = new Map(run.nodeMap.nodes.map((n) => [n.id, n.kind]));
    const hop1 = new Set(hops[1]!);
    const hop2Events = new Set(hops[2]!.filter((id) => kindOf.get(id) === 'event'));
    for (const e of run.nodeMap.edges) {
      if (hop1.has(e.from) && hop2Events.has(e.to)) {
        return { parent: e.from, eventNode: e.to };
      }
    }
    return null;
  }

  /** Deterministic hunt: a seed whose root event resolves cleanly to the map
   *  AND whose map carries a hop-1 → hop-2-event edge. */
  let hunted: number | null = null;
  function huntSeed(): number {
    if (hunted !== null) return hunted;
    for (let seed = 300; seed < 340; seed++) {
      const run = repeatRun(seed, false);
      run.dispatch({ kind: 'enterNode', nodeId: run.nodeMap.rootId });
      if (run.phase !== 'event') continue;
      run.dispatch({ kind: 'chooseEventOption', choiceIndex: 0 });
      // The runOne closure-narrowing caveat: dispatch mutates phase behind
      // TS's flow analysis — the cast restores reality.
      if ((run.phase as string) !== 'map') continue;
      if (hop2EventEntry(run) !== null) {
        hunted = seed;
        return seed;
      }
    }
    throw new Error('no seed in [300, 340) offered a hop-1 → hop-2-event edge');
  }

  /** Visit the root event, then teleport to the hop-1 parent (direct
   *  `currentNodeId` assignment — the public field a snapshot would set;
   *  a fromJSON round-trip would re-pin the SHIPPED catalog, the 74b
   *  bespoke-rejection rule) so the hop-2 event node sits on the frontier. */
  function afterRootVisit(run: Run): number {
    run.dispatch({ kind: 'enterNode', nodeId: run.nodeMap.rootId });
    run.dispatch({ kind: 'chooseEventOption', choiceIndex: 0 });
    const entry = hop2EventEntry(run)!;
    run.currentNodeId = entry.parent;
    return entry.eventNode;
  }

  it('an opened page marks visited:<id>; a combat-resolved entry never does', () => {
    const run = repeatRun(300, false);
    expect(run.eventFlag('visited:whispering-terminal-collects')).toBeUndefined();
    run.dispatch({ kind: 'enterNode', nodeId: run.nodeMap.rootId });
    expect(run.phase).toBe('event');
    expect(run.eventFlag('visited:whispering-terminal-collects')).toBe(true);
    // The resolve-every-entry twin: the page never opens, nothing marks.
    const resolved = new Run(300, new EventBus<GameEvents>(), {
      firstNodeKind: 'event',
      daemon: ALWAYS_RESOLVE_DAEMON,
      eventCatalog: [poolEvent('whispering-terminal-collects')],
    });
    resolved.dispatch({ kind: 'enterNode', nodeId: resolved.nodeMap.rootId });
    expect(resolved.phase).toBe('battle');
    expect(resolved.eventFlag('visited:whispering-terminal-collects')).toBeUndefined();
  });

  it('the no-repeat default: a visited def drops from the pool — the second event node degrades to the fight', () => {
    const run = repeatRun(huntSeed(), false);
    const eventNode = afterRootVisit(run);
    run.dispatch({ kind: 'enterNode', nodeId: eventNode });
    expect(run.phase).toBe('battle'); // the visited filter emptied the pool
    expect(run.activeEvent).toBeNull();
  });

  it('repeatable: true opts out — the same def opens again (visited still marked)', () => {
    const run = repeatRun(huntSeed(), true);
    const eventNode = afterRootVisit(run);
    expect(run.eventFlag('visited:whispering-terminal-collects')).toBe(true);
    run.dispatch({ kind: 'enterNode', nodeId: eventNode });
    expect(run.phase).toBe('event');
    expect(run.activeEvent!.eventId).toBe('whispering-terminal-collects');
  });

  it('74i-c END-TO-END: a SHIPPED run (no dials) opens the authored starting event at the root', () => {
    // The exit-sweep positive pin (the 74e landing note's debt): The Start
    // authors `startingEvents`, the root is sector-stamped, entry draws
    // from the starting pool and IGNORES the combat-resolve roll — so this
    // holds for EVERY seed, deterministically. Derived, not hardcoded: the
    // expected id comes from the shipped sector config.
    const startingIds = getSector('the-start')!.startingEvents.map((e) => e.eventId);
    expect(startingIds.length).toBeGreaterThan(0);
    for (const seed of [1, 2, 3]) {
      const run = new Run(seed, new EventBus<GameEvents>());
      run.dispatch({ kind: 'enterNode', nodeId: run.nodeMap.rootId });
      expect(run.phase).toBe('event');
      expect(startingIds).toContain(run.activeEvent!.eventId);
      expect(run.eventFlag(`visited:${run.activeEvent!.eventId}`)).toBe(true);
    }
  });

  it('the forced dial bypasses the filter (a force is a force)', () => {
    const run = new Run(huntSeed(), new EventBus<GameEvents>(), {
      firstNodeKind: 'event',
      eventChance: 1,
      daemon: NO_RESOLVE_DAEMON,
      forcedEventId: 'poolless-forced',
      eventCatalog: [poolEvent('poolless-forced')],
    });
    const eventNode = afterRootVisit(run);
    expect(run.eventFlag('visited:poolless-forced')).toBe(true);
    run.dispatch({ kind: 'enterNode', nodeId: eventNode });
    expect(run.phase).toBe('event'); // visited + non-repeatable, forced anyway
    expect(run.activeEvent!.eventId).toBe('poolless-forced');
  });
});

// ── 74c — event effect ops (the full union executes) ─────────────────────────

/** An event-phase run around ONE choice carrying `effects`, executed in
 *  authored order on dispatch (74b's handleChooseEventOption contract). */
function opRun(
  seed: number,
  effects: EventEffectOp[],
): { run: Run; bus: EventBus<GameEvents> } {
  return eventRun(seed, {
    forcedEventId: 'op-test',
    eventCatalog: [
      {
        id: 'op-test',
        name: 'Op Test',
        entry: 'start',
        pages: {
          start: {
            text: 'p',
            choices: [{ label: 'go', outcomes: [{ effects, next: { kind: 'return-to-map' } }] }],
          },
        },
      },
    ],
  });
}

/** Enter the (forced) event and fire its single choice. */
function fireOps(run: Run): void {
  run.dispatch({ kind: 'enterNode', nodeId: run.nodeMap.rootId });
  run.dispatch({ kind: 'chooseEventOption', choiceIndex: 0 });
}

describe('74c — event effect ops (the full union executes)', () => {
  it('addPacket adds slots (duplicates stack — one SLOT each, spec §Cache)', () => {
    const { run } = opRun(120, [
      { op: 'addPacket', packetId: 'patch' },
      { op: 'addPacket', packetId: 'patch' },
    ]);
    const before = run.cache.filter((id) => id === 'patch').length;
    fireOps(run);
    expect(run.cache.filter((id) => id === 'patch')).toHaveLength(before + 2);
    expect(run.phase).toBe('map');
  });

  it('addPacket on a FULL cache honors the grant into 49f overflow (user-signed)', () => {
    const { run } = opRun(121, [{ op: 'addPacket', packetId: 'shield' }]);
    while (run.cacheHasRoom) run.addPacket('patch');
    expect(run.cacheOverflow).toBe(0);
    fireOps(run);
    expect(run.cache).toContain('shield');
    expect(run.cacheOverflow).toBe(1); // the forced-keep state — NOT a drop
  });

  it('removePacket removes the FIRST matching slot; an absent id is a silent no-op', () => {
    const { run } = opRun(122, [
      { op: 'removePacket', packetId: 'patch' },
      { op: 'removePacket', packetId: 'never-held' },
    ]);
    const base = run.cache.slice();
    run.addPacket('shield');
    run.addPacket('patch');
    run.addPacket('patch');
    fireOps(run);
    // First 'patch' slot left; 'shield' and the second 'patch' stand.
    expect(run.cache).toEqual([...base, 'shield', 'patch']);
    expect(run.phase).toBe('map'); // the absent-id removal didn't throw
  });

  it('addDaemon joins ownership once — the second add SKIPS (owned; user-signed)', () => {
    const { run } = opRun(123, [
      { op: 'addDaemon', daemonId: 'portunus' },
      { op: 'addDaemon', daemonId: 'portunus' },
    ]);
    expect(run.daemons.some((d) => d.id === 'portunus')).toBe(false);
    fireOps(run);
    expect(run.daemons.filter((d) => d.id === 'portunus')).toHaveLength(1);
  });

  it('removeDaemon removes by id (push-only era over), repaints the cache, no-ops on absent', () => {
    const { run, bus } = opRun(124, [
      { op: 'removeDaemon', daemonId: 'test-no-resolve' },
      { op: 'removeDaemon', daemonId: 'never-owned' },
    ]);
    expect(run.daemons.some((d) => d.id === 'test-no-resolve')).toBe(true);
    let cacheRepaints = 0;
    bus.on('run:cacheChanged', () => cacheRepaints++);
    fireOps(run);
    expect(run.daemons.some((d) => d.id === 'test-no-resolve')).toBe(false);
    // Ownership feeds the cacheSize fold (49b) — the removal repainted once
    // (the absent-id no-op did not).
    expect(cacheRepaints).toBe(1);
  });

  it('grantUnit appends through the chokepoint — level absent = 1, authored level rolls', () => {
    const drive = (): Run => {
      const { run } = opRun(125, [
        { op: 'grantUnit', archetype: 'archer' },
        { op: 'grantUnit', archetype: 'healer', level: 3 },
      ]);
      fireOps(run);
      return run;
    };
    const run = drive();
    const [archer, healer] = run.team.slice(-2);
    expect(archer!.archetype).toBe('archer');
    expect(archer!.level).toBe(1);
    expect(healer!.archetype).toBe('healer');
    expect(healer!.level).toBe(3);
    // The level roll rides eventRng — same seed, same stats.
    expect(JSON.stringify(drive().team)).toBe(JSON.stringify(run.team));
  });

  it('removeUnit strongest takes the highest level; the lower-level grant survives', () => {
    const { run } = opRun(126, [
      { op: 'grantUnit', archetype: 'archer', level: 9 },
      { op: 'grantUnit', archetype: 'healer', level: 2 },
      { op: 'removeUnit', pick: 'strongest' },
    ]);
    const before = run.team.length;
    expect(Math.max(...run.team.map((u) => u.level))).toBeLessThan(9); // the L9 will be strongest
    fireOps(run);
    expect(run.team).toHaveLength(before + 1); // +2 grants −1 removal
    expect(run.team.some((u) => u.level === 9)).toBe(false);
    expect(run.team.some((u) => u.archetype === 'healer' && u.level === 2)).toBe(true);
  });

  it('removeUnit weakest tie-breaks to the LOWEST roster index (user-signed)', () => {
    const { run } = opRun(127, [{ op: 'removeUnit', pick: 'weakest' }]);
    // Precondition: the starting roster is level-uniform, so the pick is a
    // pure tie — index 0 must leave.
    expect(new Set(run.team.map((u) => u.level)).size).toBe(1);
    const before = run.team.map((u) => JSON.stringify(u));
    fireOps(run);
    expect(run.team.map((u) => JSON.stringify(u))).toEqual(before.slice(1));
  });

  it('removeUnit random rides eventRng — same seed, same survivor set', () => {
    const drive = (): string => {
      const { run } = opRun(128, [{ op: 'removeUnit' }]);
      const before = run.team.length;
      fireOps(run);
      expect(run.team).toHaveLength(before - 1);
      return JSON.stringify(run.team);
    };
    expect(drive()).toBe(drive());
  });

  it('removeUnit floors at a roster of ONE (silent no-op — the roster cannot empty)', () => {
    const { run } = opRun(
      129,
      Array.from({ length: 20 }, () => ({ op: 'removeUnit', pick: 'weakest' as const })),
    );
    expect(run.team.length).toBeLessThan(20); // the floor genuinely engages
    fireOps(run);
    expect(run.team).toHaveLength(1);
    expect(run.phase).toBe('map'); // no throw — the event completed
  });

  it('unit + poolHealth reward portions serialize, restore, and settle (the reward-side widening)', () => {
    const run = new Run(130, new EventBus<GameEvents>(), { daemon: null });
    const template = rollUnit('archer', new RNG(9), 2);
    const wire = run.toJSON();
    wire.phase = 'reward';
    wire.playerHealth = 3;
    // The trailing bits portion stays UNRESOLVED so the offer never drains
    // (accepting the last portion would re-enter the gate chain, which this
    // synthetic map-phase wire has no encounter context for).
    wire.pendingRewards = [
      { kind: 'unit', template },
      { kind: 'poolHealth', amount: 2 },
      { kind: 'bits', base: 1 },
    ];
    const restored = Run.fromJSON(JSON.parse(JSON.stringify(wire)), new EventBus<GameEvents>());
    // The template passed through like `team` (the port-stock rule).
    expect(restored.pendingRewards![0]).toEqual({ kind: 'unit', template });
    const before = restored.team.length;
    restored.dispatch({ kind: 'acceptReward', index: 0 }); // the unit
    expect(restored.team).toHaveLength(before + 1);
    expect(restored.team[before]).toEqual(template);
    restored.dispatch({ kind: 'acceptReward', index: 0 }); // the heal
    expect(restored.toJSON().playerHealth).toBe(Math.min(HEALTH.playerHealthMax, 5));
    expect(restored.pendingRewards).toHaveLength(1); // the bits row still offered
  });
});

// ---- §75g — camp-kill loot ---------------------------------------------------

describe('75g — camp-kill loot rides the turn boundary as reward portions', () => {
  const CAMP_KILL = [{ defId: 'bandit-squatters', killedBy: 'player' as const }];

  it('a player-killed camp pays WIN-OR-LOSE: an ongoing (drawn) turn still offers the loot', () => {
    const { run, bus } = freshRunWithBus(1, { daemon: null });
    run.dispatch({ kind: 'enterNode', nodeId: frontierOf(run) });
    // A drawn, no-chip, no-tally turn — the ONLY portions can be the camp's.
    bus.emit('battle:ended', {
      winner: 'draw',
      xpAwards: [],
      survivorPower: { player: 0, enemy: 0 },
      campKills: CAMP_KILL,
    });
    // bandit-squatters carries bits-small at chance 1 → a guaranteed offer.
    expect(run.phase).toBe('reward');
    expect(run.pendingRewards).not.toBeNull();
    expect(run.pendingRewards!.length).toBeGreaterThanOrEqual(1);
    acceptAllRewards(run);
    // bits-small rolls bits OR a packet (balance-proof: don't pin the entry
    // the seed drew) — either way SOMETHING landed.
    expect(run.bits > 0 || run.cache.length > 0).toBe(true);
    expect(run.phase).toBe('battle'); // the encounter resumed
  });

  it('an enemy-killed camp pays NOTHING (credit denial is the loss)', () => {
    const { run, bus } = freshRunWithBus(1, { daemon: null });
    run.dispatch({ kind: 'enterNode', nodeId: frontierOf(run) });
    bus.emit('battle:ended', {
      winner: 'draw',
      xpAwards: [],
      survivorPower: { player: 0, enemy: 0 },
      campKills: [{ defId: 'bandit-squatters', killedBy: 'enemy' }],
    });
    expect(run.pendingRewards).toBeNull();
    expect(run.phase).toBe('battle');
  });

  it('a run-terminal defeat skips the camp loot (dead state, the XP-bank rule)', () => {
    const { run, bus } = freshRunWithBus(1, { daemon: null });
    run.dispatch({ kind: 'enterNode', nodeId: frontierOf(run) });
    bus.emit('battle:ended', {
      winner: 'enemy',
      xpAwards: [],
      survivorPower: { player: 0, enemy: HEALTH.playerHealthMax },
      campKills: CAMP_KILL,
    });
    expect(run.phase).toBe('defeat');
    expect(run.pendingRewards).toBeNull();
  });

  it('on a WON turn the camp loot sits between the tally and the encounter roll', () => {
    const { run, bus } = freshRunWithBus(1, { daemon: null, forcedEncounterId: 'brigands' });
    run.dispatch({ kind: 'enterNode', nodeId: frontierOf(run) });
    bus.emit('battle:ended', {
      winner: 'player',
      xpAwards: [],
      survivorPower: { player: 1_000, enemy: 0 },
      tallies: { bits: 6 },
      campKills: CAMP_KILL,
    });
    expect(run.phase).toBe('reward');
    // tally + ≥1 camp portion + ≥1 encounter portion (brigands: bits-small
    // at chance 1), tally leading.
    expect(run.pendingRewards!.length).toBeGreaterThanOrEqual(3);
    expect(run.pendingRewards![0]).toEqual({ kind: 'bits', base: 6 });
  });
});
