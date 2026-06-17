/**
 * J4 — the **arena harness**: a single forced `World` battle with NO `Run`
 * wrapper, for tuning objective strategies in isolation (the brief's "arena
 * runs"). One roster vs one rolled enemy wave on one board; the objective bot
 * drives the player team's shared objective via `decideObjectiveCommand`.
 *
 * `runArenaSearch` enumerates the proclivity menu over a seed set and ranks by
 * player win rate — the "optimal objective strategy" the full-run fuzz then
 * consumes via `--objective=<file>.json` (J4 commit 2). Determinism: same seed +
 * same proclivity → byte-identical `ArenaResult` (the World's sim streams are
 * untouched by the objective bot, which draws on its own forked stream).
 *
 * Distinct from `harness.ts` (which drives a whole `Run`): this builds ONE
 * `World` directly from `spawnEncounter`, so there's no map / recruit / promotion
 * machinery and the only variable under study is the objective.
 */

import { EventBus } from '../../src/core/EventBus';
import { RNG } from '../../src/core/RNG';
import { secondsToTicks } from '../../src/config';
import { HEALTH } from '../../src/config/health';
import type { GameEvents } from '../../src/core/events';
import type { Team } from '../../src/sim/Unit';
import { World } from '../../src/sim/World';
import { spawnEncounter } from '../../src/sim/battleSetup';
import { scaledUnit } from '../../src/sim/archetypes';
import { buildEnemyTeam } from '../../src/run/enemyBudget';
import type { BattleEncounter } from '../../src/run/Run';
import type { RosterEntry } from '../../src/run/RunConfig';
import { getLayout } from '../../src/sim/layouts';
import { TERRAIN } from '../../src/config/terrain';
import { ALL_ARCHETYPES } from '../../src/sim/archetypes';
import { STAT_KEYS } from './strategies/policies';
import {
  decideObjectiveCommand,
  objectiveMenu,
  type MenuEntry,
  type ObjectiveProclivity,
  type ScoredObjectiveWeights,
} from './objectiveStrategy';
import { CoverageObjectiveDriver, COVERAGE_MAX_TICKS } from './objectiveCoverage';

// The per-turn cap — the SAME single source as the run harness + the live game
// (`config/health.json` maxTurnSeconds via the TICK_RATE contract). N2 — an arena
// battle that reaches it force-resolves as a DRAW (resolveAsDraw), the same
// boundary + behavior a real fuzz / live battle has.
const ARENA_MAX_TICKS = secondsToTicks(HEALTH.maxTurnSeconds);

/**
 * The default arena lineup when no roster is given: the documented carry comp
 * (3 mercenary + 2 ranged) at a mid-game level, where a real enemy wave is large
 * enough that the objective CHOICE matters (a level-1 lineup faces too few
 * enemies for the proclivity to discriminate).
 */
export const DEFAULT_ARENA_ROSTER: readonly RosterEntry[] = [
  { archetype: 'mercenary', level: 5 },
  { archetype: 'mercenary', level: 5 },
  { archetype: 'mercenary', level: 5 },
  { archetype: 'ranged', level: 5 },
  { archetype: 'ranged', level: 5 },
];

export interface ArenaOptions {
  /** Player roster; defaults to `DEFAULT_ARENA_ROSTER`. */
  readonly roster?: readonly RosterEntry[];
  /** The objective policy the bot drives this battle with. Optional only when
   *  `coverage` is set (the coverage driver replaces it); defaults to `none`. */
  readonly proclivity?: ObjectiveProclivity;
  /** Force a hand-authored layout, or `null` (default) for a procedural board. */
  readonly layoutId?: string | null;
  /** Per-battle tick cap (default ≈150s, or `COVERAGE_MAX_TICKS` under coverage). */
  readonly maxTicks?: number;
  /**
   * O5 — drive the dev-only objective COVERAGE churn bot (both teams, every
   * mode, random 1–20s lifetimes) instead of `proclivity`. Termination +
   * determinism coverage only — never a win-rate measurement (see
   * `objectiveCoverage.ts`). Bumps the default cap to `COVERAGE_MAX_TICKS`.
   */
  readonly coverage?: boolean;
}

export interface ArenaResult {
  readonly seed: number;
  /** The decisive winner, or `'draw'` when the per-turn cap force-resolved the
   *  battle (N2 — mirrors the live game + run harness; a draw is a non-win). */
  readonly winner: Team | 'draw';
  readonly ticks: number;
  readonly playerSurvivors: number;
  readonly enemySurvivors: number;
}

/**
 * Build a one-off `BattleEncounter` from a seed: derive the world + terrain
 * seeds, the leveled player roster, a rolled enemy wave at the roster's budget,
 * and the board (a forced layout's dimensions/theme, or a procedural square).
 * `theme` is cosmetic — the headless World never reads it.
 */
function buildArenaEncounter(
  seed: number,
  roster: readonly RosterEntry[],
  layoutId: string | null,
): BattleEncounter {
  const rng = new RNG(seed);
  const worldSeed = Math.floor(rng.next() * 0x1_0000_0000);
  const terrainSeed = Math.floor(rng.next() * 0x1_0000_0000);
  const playerTeam = roster.map((e) => scaledUnit(e.archetype, e.level));

  let gridW: number;
  let gridH: number;
  let theme: BattleEncounter['theme'];
  if (layoutId !== null) {
    const layout = getLayout(layoutId);
    if (!layout) throw new Error(`runArena: unknown layoutId="${layoutId}"`);
    gridW = layout.gridW;
    gridH = layout.gridH;
    theme = layout.theme ?? 'default';
  } else {
    const side = rng.int(TERRAIN.proceduralMinSize, TERRAIN.proceduralMaxSize);
    gridW = side;
    gridH = side;
    theme = 'default';
  }

  // Last consumer of `rng` (mirrors `Run.beginTurn`'s ordering: seeds → board →
  // enemy wave) so the wave roll stays downstream-safe.
  const enemyTeam = buildEnemyTeam(rng, playerTeam);
  return { worldSeed, terrainSeed, layoutId, gridW, gridH, theme, playerTeam, enemyTeam };
}

/**
 * Run one arena battle to resolution (or the tick cap) and return the outcome.
 * The objective bot is consulted BEFORE each tick: when the shared objective is
 * clear it enqueues a fresh `setObjective` (refill-on-null = the no-thrash gate),
 * which `World.tick` applies at the top of the next tick.
 */
export function runArena(seed: number, options: ArenaOptions): ArenaResult {
  const roster = options.roster ?? DEFAULT_ARENA_ROSTER;
  const coverage = options.coverage === true;
  const maxTicks = options.maxTicks ?? (coverage ? COVERAGE_MAX_TICKS : ARENA_MAX_TICKS);
  const proclivity = options.proclivity ?? { kind: 'none' };
  const layoutId = options.layoutId ?? null;
  const encounter = buildArenaEncounter(seed, roster, layoutId);

  const bus = new EventBus<GameEvents>();
  // Overwritten by every battle:ended (natural win OR the cap's resolveAsDraw
  // below); the 'draw' init is a never-observed sentinel (a battle always ticks).
  let winner: Team | 'draw' = 'draw';
  bus.on('battle:ended', (e) => {
    winner = e.winner;
  });

  const world = new World(bus, new RNG(encounter.worldSeed), encounter.gridW, encounter.gridH);
  spawnEncounter(world, encounter);

  // Dedicated objective RNG stream (forked off the seed) so the bot's `random`
  // draws never perturb the World's sim / combat / spawn streams — same-seed
  // arena runs stay byte-identical regardless of the proclivity's draw count.
  // O5 — coverage and the measurement proclivity are mutually exclusive, so the
  // forked stream is reused by whichever is active.
  const driverRng = new RNG(seed).fork();
  const coverageDriver = coverage ? new CoverageObjectiveDriver(driverRng) : null;

  let ticks = 0;
  while (!world.ended && ticks < maxTicks) {
    if (coverageDriver) {
      for (const cmd of coverageDriver.decide(world)) world.enqueueCommand(cmd);
    } else {
      const cmd = decideObjectiveCommand(world, proclivity, driverRng);
      if (cmd) world.enqueueCommand(cmd);
    }
    world.tick();
    ticks++;
  }
  // N2 — reached the per-turn cap without a decisive end: force-resolve as a DRAW,
  // mirroring the live game + the run harness (the battle:ended handler sets
  // `winner = 'draw'`).
  if (!world.ended) world.resolveAsDraw();

  const playerSurvivors = world.units.filter(
    (u) => u.team === 'player' && u.currentHp > 0,
  ).length;
  const enemySurvivors = world.units.filter(
    (u) => u.team === 'enemy' && u.currentHp > 0,
  ).length;
  return {
    seed,
    // resolveAsDraw above guarantees world.ended, so `winner` is always the
    // decisive team or 'draw' — never an un-resolved sentinel.
    winner,
    ticks,
    playerSurvivors,
    enemySurvivors,
  };
}

export interface ProclivityScore {
  readonly label: string;
  readonly proclivity: ObjectiveProclivity;
  readonly winRate: number;
  readonly avgTicks: number;
  /** N2 — battles this proclivity left to the per-turn cap (a non-win draw); was
   *  `hangs` before the cap force-resolved them. */
  readonly draws: number;
}

export interface ArenaSearchResult {
  /** Every menu entry's score, ranked best-first. */
  readonly scores: readonly ProclivityScore[];
  readonly best: ProclivityScore;
}

/**
 * Enumerate the proclivity `menu` (default = the full `objectiveMenu`), running
 * each over `seeds` in the same arena, and rank by player win rate (tie-break:
 * fewer avg ticks = more decisive, then label). The top entry is the "optimal
 * objective strategy" for this roster + board. Because the proclivity space is a
 * small discrete menu, exhaustive enumeration replaces a random weight search.
 */
export function runArenaSearch(
  seeds: readonly number[],
  roster: readonly RosterEntry[],
  layoutId: string | null,
  menu: readonly MenuEntry[] = objectiveMenu(),
): ArenaSearchResult {
  const scores: ProclivityScore[] = menu.map((entry) => {
    let wins = 0;
    let totalTicks = 0;
    let draws = 0;
    for (const seed of seeds) {
      const r = runArena(seed, { roster, proclivity: entry.proclivity, layoutId });
      if (r.winner === 'player') wins++;
      if (r.winner === 'draw') draws++;
      totalTicks += r.ticks;
    }
    return {
      label: entry.label,
      proclivity: entry.proclivity,
      winRate: seeds.length === 0 ? 0 : wins / seeds.length,
      avgTicks: seeds.length === 0 ? 0 : totalTicks / seeds.length,
      draws,
    };
  });
  const sorted = [...scores].sort(
    (a, b) => b.winRate - a.winRate || a.avgTicks - b.avgTicks || a.label.localeCompare(b.label),
  );
  return { scores: sorted, best: sorted[0]! };
}

// ---- the scored-objective vector search (K3c3) ------------------------------

/**
 * Draw one `ScoredObjectiveWeights` uniformly from [-1, 1] per weight (the
 * H7b `DEFAULT_BOX` convention). Fixed draw order (stats → hp → archetype) so
 * the sample sequence is reproducible given `(samplerSeed, vector index)` —
 * the same contract `search.ts#sampleWeights` keeps for the recruit vectors.
 */
export function sampleObjectiveWeights(rng: RNG): ScoredObjectiveWeights {
  const draw = (): number => -1 + rng.next() * 2;
  const record = <K extends string>(keys: readonly K[]): Record<K, number> =>
    Object.fromEntries(keys.map((k) => [k, draw()])) as Record<K, number>;
  const stats = record(STAT_KEYS);
  const hp = draw();
  const archetype = record(ALL_ARCHETYPES);
  return { stats, hp, archetype };
}

/** The deterministic proposal step — same role as `search.ts#generateVectors`:
 *  one seeded RNG, `count` draws, so the whole experiment replays from
 *  `(samplerSeed, count)`. */
export function generateObjectiveVectors(
  samplerSeed: number,
  count: number,
): ScoredObjectiveWeights[] {
  const rng = new RNG(samplerSeed);
  return Array.from({ length: count }, () => sampleObjectiveWeights(rng));
}

/**
 * Random-search the scored-objective weight space in the arena: evaluate each
 * sampled vector as a `{ kind: 'scored' }` proclivity over `seeds`, rank by
 * player win rate (the shared `runArenaSearch` ranking — tie-break fewer avg
 * ticks, then label, all deterministic). The
 * winner is emitted in the SAME proclivity-JSON format as the menu search, so
 * `--objective=<file>.json` consumes either interchangeably. No train/test
 * split (unlike H7b): an arena read is a tuning aid on one fixed
 * roster+board, not a balance verdict — overfit shows up immediately when the
 * saved winner is replayed in the full-run fuzz.
 */
export function runArenaVectorSearch(
  seeds: readonly number[],
  roster: readonly RosterEntry[],
  layoutId: string | null,
  opts: { readonly samplerSeed: number; readonly vectors: number },
): ArenaSearchResult {
  const sampled = generateObjectiveVectors(opts.samplerSeed, opts.vectors);
  const menu: MenuEntry[] = sampled.map((weights, i) => ({
    label: `scored#${i}`,
    proclivity: { kind: 'scored', weights },
  }));
  return runArenaSearch(seeds, roster, layoutId, menu);
}
