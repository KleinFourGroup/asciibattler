/**
 * Fuzz harness smoke tests. Opt-in (`npm run fuzz:smoke`) — see
 * `vitest.fuzz.config.ts`. These don't assert balance outcomes (those
 * shift with tuning); they just ensure the harness, the strategies, and
 * the reporters all still wire up and produce well-formed output.
 *
 * If you're adding a new strategy, add a determinism case in
 * `harnessDeterminism.test.ts` (the heavy strategy-run cases split there at
 * 73b). If you're adding a new field to RunResult, extend the CSV header
 * assertion here. Both prevent silent format drift breaking `npm run fuzz`.
 */

import { describe, it, expect } from 'vitest';
import { runOne } from './harness';
import type { BattleResult, RunResult } from './harness';
import { makeStrategy } from './strategies/registry';
import {
  aggregate,
  renderSummaryCsv,
  renderDecisionsCsv,
  decisionRowsOf,
  parseDecisionsCsv,
  perItemDecisionStats,
  itemKeyOf,
  renderDecisionAnalysis,
  PER_ITEM_N_FLOOR,
  tierFlipRows,
  renderTierFlipsCsv,
  renderTierFlipAnalysis,
  renderFailureTrace,
  failureFilename,
  perHopStats,
  renderPerHopAnalysis,
  perLayoutStats,
  perLayoutHopStats,
  renderLayoutAnalysis,
  renderLayoutHopCsv,
  perEncounterStats,
  renderEncounterAnalysis,
  seamInputsOf,
  seamHazardStats,
  renderSeamHazard,
  type SeamHazardInput,
} from './reporters';
import { TelemetryAccumulator } from './telemetry';
import type { Archetype } from '../../src/sim/archetypes';
import type { RunTelemetry } from './telemetry';
import { LAYOUT_IDS } from '../../src/sim/layouts';
import { HEALTH } from '../../src/config/health';
import { ENCOUNTERS, getEncounter } from '../../src/config/encounters';
import type { RunDecisionRecord } from './rollout/driver';
import type { RunScoreBreakdown } from './rollout/evaluator';

describe('fuzz harness', () => {
  // ── 72b-pre — the pool-trajectory instrument ────────────────────────────────

  it('captures the pool trajectory: poolAtStart on every battle, seam array ≡ sectorsCleared', () => {
    const result = runOne(1, makeStrategy('pure-random')!);
    expect(result.battles.every((b) => Number.isFinite(b.poolAtStart))).toBe(true);
    // The run-wide pool starts FULL — config-derived, never hardcoded
    // (the balance-proof rule).
    expect(result.battles[0]!.poolAtStart).toBe(HEALTH.playerHealthMax);
    expect(Number.isFinite(result.finalPool)).toBe(true);
    // Every seam crossing records exactly one pool sample (the push and the
    // counter share one handler), whatever this seed's walk did.
    expect(result.poolAtSectorClears.length).toBe(result.sectorsCleared);
    for (const p of result.poolAtSectorClears) {
      expect(p).toBeGreaterThan(0); // a cleared sector means the run was alive
      expect(p).toBeLessThanOrEqual(HEALTH.playerHealthMax);
    }
    // seamInputsOf surfaces [0] as THE act-1→act-2 seam value (null pre-seam).
    const input = seamInputsOf([result])[0]!;
    expect(input.poolAtSectorEnd).toBe(result.poolAtSectorClears[0] ?? null);
  });

  it('renders the pool columns: seam blank when no sector was cleared, populated when crossed', () => {
    const base = runOne(1, makeStrategy('pure-random')!);
    const uncrossed: RunResult = { ...base, sectorsCleared: 0, poolAtSectorClears: [], finalPool: 5 };
    const crossed: RunResult = { ...base, sectorsCleared: 1, poolAtSectorClears: [7], finalPool: 3 };
    const lines = renderSummaryCsv([uncrossed, crossed]).trim().split('\n');
    const cols = lines[0]!.split(',');
    const iSeam = cols.indexOf('poolAtSectorEnd');
    const iFinal = cols.indexOf('finalPool');
    expect(iSeam).toBeGreaterThan(cols.indexOf('sectorsCleared')); // append-last
    expect(lines[1]!.split(',')[iSeam]).toBe('');
    expect(lines[1]!.split(',')[iFinal]).toBe('5');
    expect(lines[2]!.split(',')[iSeam]).toBe('7');
    expect(lines[2]!.split(',')[iFinal]).toBe('3');
  });

  it('seamHazardStats bins act-2 entrants by config-derived quarters and conditions outcomes', () => {
    const max = HEALTH.playerHealthMax;
    const row = (outcome: string, pool: number | null, cleared = 1): SeamHazardInput => ({
      outcome,
      sectorsCleared: cleared,
      poolAtSectorEnd: pool,
    });
    const bins = seamHazardStats([
      row('complete', max), // top bin (the closed upper edge)
      row('defeat', max * 0.8), // top bin
      row('defeat', max * 0.5), // third bin (the half-open lower edge)
      row('defeat', max * 0.1), // bottom bin
      row('complete', 0), // bottom bin (pool 0 is still an entrant)
      row('defeat', null, 0), // never reached the seam — excluded
    ]);
    expect(bins).toHaveLength(4);
    expect(bins.map((b) => b.n)).toEqual([2, 0, 1, 2]);
    expect(bins[3]!.wins).toBe(1);
    expect(bins[3]!.deaths).toBe(1);
    expect(bins[0]!.wins).toBe(1); // the 0-pool entrant that still won
    expect(bins[1]!.meanPool).toBeNull(); // empty bin stays in the shape
    // The renderer dashes empty bins and marks every sub-floor n (the n=80 rule).
    const out = renderSeamHazard([row('complete', max), row('defeat', max * 0.1)]);
    expect(out).toContain('entered act 2');
    expect(out).toContain('·');
    expect(out).toContain('—');
  });

  it('completes a single run without throwing', () => {
    const result = runOne(1, makeStrategy('pure-random')!);
    expect(result.seed).toBe(1);
    expect(result.strategyName).toBe('pure-random');
    expect(['complete', 'defeat', 'hang', 'aborted']).toContain(result.outcome);
    expect(result.battles.length).toBeGreaterThan(0);
    // Every battle carries its layout id (null for procedural). Pins the
    // C1d follow-up field so format drift breaks the smoke instead of
    // silently emptying the per-layout hang report.
    for (const b of result.battles) {
      expect(b).toHaveProperty('layoutId');
      expect(b.layoutId === null || typeof b.layoutId === 'string').toBe(true);
    }
  });

  it('force-resolves a turn that hits the per-turn cap as a DRAW, not a hang', () => {
    // N2 cap unification — a battle that can't resolve within the cap is no longer a
    // run-ending 'hang'. maxTicksPerBattle:1 forces EVERY battle to the cap, so each
    // resolveAsDraw's (winner 'draw', both pools chip) and the run plays on to a
    // normal terminal outcome (a defeat once the chips zero a pool), never a hang.
    // The harness-level mirror of the encounter-loop integration test's cap-as-draw.
    const result = runOne(3, makeStrategy('greedy')!, { maxTicksPerBattle: 1 });
    expect(result.outcome).not.toBe('hang');
    expect(result.battles.length).toBeGreaterThan(0);
    expect(result.battles.every((b) => b.winner === 'draw')).toBe(true);
    // The aggregate surfaces those capped draws (the signal that replaced 'hang').
    const stats = aggregate([result]);
    expect(stats.hangs).toBe(0);
    expect(stats.cappedDraws).toBe(result.battles.length);
  });

  // The four strategy-determinism cases (pure-random / greedy / the G5 menu /
  // the divergence check) moved to `harnessDeterminism.test.ts` at 73b — they
  // were this file's heavy half.

  it('the full-pool elite isolation shape fields the forced elite at hop 0 (68e)', () => {
    // --hops=2 --first-node=elite --encounter=<elite>: the root is stamped
    // elite and the force composes with it, so the run's FIRST fight is the
    // elite met at full pool — the de-censored per-instance read shape.
    const result = runOne(3, makeStrategy('greedy')!, {
      telemetry: true,
      runConfig: { hopCount: 2, firstNodeKind: 'elite', forcedEncounterId: 'plagueSpreaders' },
    });
    expect(result.battles.length).toBeGreaterThan(0);
    const first = result.battles[0]!;
    expect(first.hop).toBe(0);
    expect(first.sector).toBe(0);
    expect(first.encounterId).toBe('plagueSpreaders');
    for (const b of result.battles) {
      if (b.hop === 0) expect(b.encounterId).toBe('plagueSpreaders');
    }
  });

  it('a two-act walk labels battles + chips with the sector ordinal (68e)', () => {
    // sectorHops: 2 → a 2+2 walk over the shipped start → deep-end chain. The
    // overpowered fixture roster makes clearing act 1 essentially certain —
    // the vacuousness guard below (a transition actually happened) depends on
    // it, so if a future balance change flakes this pin, raise the levels,
    // not the assertions.
    const roster = (['mercenary', 'mercenary', 'archer', 'archer', 'healer'] as const).map(
      (archetype): { archetype: Archetype; level: number } => ({ archetype, level: 10 }),
    );
    const result = runOne(11, makeStrategy('greedy')!, {
      telemetry: true,
      runConfig: { sectorHops: 2, startingRoster: roster },
    });
    // Labels are structurally consistent regardless of outcome: monotone
    // non-decreasing from 0, and the run ends in the sector of its last battle.
    expect(result.battles.length).toBeGreaterThan(0);
    expect(result.battles[0]!.sector).toBe(0);
    for (let i = 1; i < result.battles.length; i++) {
      expect(result.battles[i]!.sector).toBeGreaterThanOrEqual(result.battles[i - 1]!.sector);
    }
    expect(result.sectorsCleared).toBe(result.battles[result.battles.length - 1]!.sector);
    // Non-vacuous: the walk actually crossed into act 2.
    expect(result.sectorsCleared).toBeGreaterThanOrEqual(1);
    // Pool chips carry the same label (the per-encounter instance key) and
    // stay aligned with the battle records' sectors.
    const chipSectors = new Set(result.telemetry!.poolChips.map((c) => c.sector));
    const battleSectors = new Set(result.battles.map((b) => b.sector));
    expect(chipSectors).toEqual(battleSectors);
  });
});

describe('fuzz reporters', () => {
  it('renders a well-formed CSV summary', () => {
    const results = [runOne(1, makeStrategy('pure-random')!), runOne(2, makeStrategy('greedy')!)];
    const csv = renderSummaryCsv(results);
    const lines = csv.trim().split('\n');
    expect(lines).toHaveLength(3); // header + 2 rows
    expect(lines[0]).toContain('seed');
    expect(lines[0]).toContain('strategy');
    expect(lines[0]).toContain('outcome');
    // 68e — the walk column (the finalHop-gap fix); 72b-pre appended the
    // pool-trajectory columns after it (the append-last rule).
    expect(lines[0]).toContain('sectorsCleared');
    expect(lines[0]!.endsWith('poolAtSectorEnd,finalPool')).toBe(true);
    // Row count of comma-separated fields must match the header.
    const headerCols = lines[0]!.split(',').length;
    for (const row of lines.slice(1)) {
      expect(row.split(',')).toHaveLength(headerCols);
    }
  });

  // ── 71a — the decisions.csv sidecar ────────────────────────────────────────

  /** Minimal RunResult literal — the sidecar only reads seed/strategyName/
   *  decisions, but the full required shape keeps the fixture honest. */
  const bareResult = (seed: number, decisions?: readonly RunDecisionRecord[]): RunResult => ({
    seed,
    strategyName: 'arbitrated:scored',
    daemonId: null,
    outcome: 'defeat',
    finalHopReached: 2,
    sectorsCleared: 0,
    totalTicks: 100,
    finalTeamSize: 3,
    portPurchases: 0,
    finalBits: 0,
    packetsFired: 0,
    poolAtSectorClears: [],
    finalPool: 0,
    battles: [],
    recruits: [],
    ...(decisions !== undefined ? { decisions } : {}),
  });

  const breakdown = (score: number, extra?: Partial<RunScoreBreakdown>): RunScoreBreakdown => ({
    score,
    poolDamageTaken: -score,
    died: false,
    completed: false,
    bitsDelta: 0,
    rosterDelta: 0,
    ...extra,
  });

  it('71a — decisions.csv is long-format with the null arm at candidate 0', () => {
    const decisions: RunDecisionRecord[] = [
      {
        site: 'portBuy',
        sectorId: 'the-start',
        hop: 6,
        labels: ['null', 'buy daemon:janus @3', 'buy unit:archer:L2 @2'],
        results: [
          { score: -4, perSeed: [breakdown(-3), breakdown(-5)] },
          { score: 1.5, perSeed: [breakdown(2, { bitsDelta: -3 }), breakdown(1, { bitsDelta: -3 })] },
          { score: -6, perSeed: [breakdown(-6, { died: true }), breakdown(-6)] },
        ],
        chosenIndex: 1,
        marginVsNull: 5.5,
        epsilon: 3.145,
      },
      {
        site: 'nodeChoice',
        sectorId: 'the-start',
        hop: 0,
        labels: ['null', 'enterNode:4 (elite)'],
        results: [
          { score: 2, perSeed: [breakdown(2, { tailBonus: 8 }), breakdown(2, { tailBonus: 8 })] },
          { score: 1, perSeed: [breakdown(1, { tailBonus: 4 }), breakdown(1, { tailBonus: 4 })] },
        ],
        chosenIndex: 0,
        marginVsNull: -1,
        epsilon: 3.265,
      },
    ];
    const csv = renderDecisionsCsv([bareResult(7, decisions)]);
    const lines = csv.trim().split('\n');
    // Header + 3 candidate rows (decision 0) + 2 candidate rows (decision 1).
    expect(lines).toHaveLength(6);
    expect(lines[0]!.startsWith('seed,strategy,decision,site,sector,hop,candidate,label,chosen')).toBe(
      true,
    );
    expect(lines[0]!.endsWith('marginVsNull,epsilon')).toBe(true);
    // Every decision's candidate 0 is the null arm; exactly one chosen=1 row
    // per decision when a challenger won, zero when null stood.
    const rows = lines.slice(1).map((l) => l.split(','));
    expect(rows[0]![6]).toBe('0');
    expect(rows[0]![7]).toBe('null');
    const chosenFlags = rows.map((r) => r[8]);
    expect(chosenFlags).toEqual(['0', '1', '0', '1', '0']);
    // The mean-of-booleans column: candidate 2's pair died once → 0.50.
    expect(rows[2]![11]).toBe('0.50');
    // tailBonus: blank on the port decision, populated on the node decision.
    expect(rows[0]![15]).toBe('');
    expect(rows[3]![15]).toBe('8.000');
    // Decision-level columns repeat on each of the decision's rows.
    expect(rows[0]![16]).toBe('5.500');
    expect(rows[1]![16]).toBe('5.500');
    expect(rows[4]![17]).toBe('3.265');
  });

  it('71a — comma-bearing labels are RFC4180-quoted and only when needed', () => {
    const decisions: RunDecisionRecord[] = [
      {
        site: 'grant:redraw',
        sectorId: 'the-start',
        hop: 1,
        labels: ['null', 'redraw level:2 [0,2]'],
        results: [
          { score: 0, perSeed: [breakdown(0), breakdown(0)] },
          { score: 2, perSeed: [breakdown(2), breakdown(2)] },
        ],
        chosenIndex: 1,
        marginVsNull: 2,
        epsilon: 1.101,
      },
    ];
    const csv = renderDecisionsCsv([bareResult(3, decisions)]);
    expect(csv).toContain('"redraw level:2 [0,2]"');
    // The null label stays unquoted (minimal quoting).
    const nullRow = csv.trim().split('\n')[1]!;
    expect(nullRow).toContain(',null,');
    // Header column count matches every row when parsed with quote awareness:
    // the quoted label contains exactly one comma, so a naive split yields
    // header+1 fields — the quoting is load-bearing, not cosmetic.
    const header = csv.split('\n')[0]!;
    const challengerRow = csv.trim().split('\n')[2]!;
    expect(challengerRow.split(',')).toHaveLength(header.split(',').length + 1);
  });

  it('71a — a batch with no decision logs renders header-only, and summary.csv ignores decisions', () => {
    expect(renderDecisionsCsv([bareResult(1)]).trim().split('\n')).toHaveLength(1);
    // The additive contract: attaching a decision log must not perturb a
    // single summary.csv byte (the §71 exit criterion).
    const plain = bareResult(9);
    const withLog = bareResult(9, [
      {
        site: 'portBuy',
        sectorId: 'the-start',
        hop: 6,
        labels: ['null', 'buy daemon:mars @3'],
        results: [
          { score: 0, perSeed: [breakdown(0), breakdown(0)] },
          { score: 5, perSeed: [breakdown(5), breakdown(5)] },
        ],
        chosenIndex: 1,
        marginVsNull: 5,
        epsilon: 3.145,
      },
    ]);
    expect(renderSummaryCsv([withLog])).toBe(renderSummaryCsv([plain]));
  });

  // ── 71b — the per-item decision-grade aggregate ────────────────────────────

  it('71b — itemKeyOf strips instance noise per site, raw-label fallback elsewhere', () => {
    expect(itemKeyOf('portBuy', 'buy daemon:janus @3')).toBe('daemon:janus');
    expect(itemKeyOf('portBuy', 'buy unit:archer:L2 @2')).toBe('unit:archer:L2');
    expect(itemKeyOf('packetFire:preTurn', 'fire patch@hand:1')).toBe('patch');
    expect(itemKeyOf('packetFire:outOfBattle', 'fire surge')).toBe('surge');
    expect(itemKeyOf('rewardDaemon', 'decline daemon:mars')).toBe('daemon:mars');
    expect(itemKeyOf('grant:redraw', 'redraw level:2 [0,2]')).toBe('level:2');
    expect(itemKeyOf('grant:empower', 'empower hand:3')).toBe('empower');
    expect(itemKeyOf('nodeChoice', 'enterNode:4 (elite)')).toBe('elite');
    // Unknown site / unmatched shape → the raw label (graceful degradation).
    expect(itemKeyOf('futureSite', 'do something:weird @9')).toBe('do something:weird @9');
  });

  it('71b — parseDecisionsCsv round-trips the sidecar, quoted labels included', () => {
    const decisions: RunDecisionRecord[] = [
      {
        site: 'grant:redraw',
        sectorId: 'the-start',
        hop: 1,
        labels: ['null', 'redraw level:2 [0,2]'],
        results: [
          { score: -1.25, perSeed: [breakdown(-1.5), breakdown(-1)] },
          { score: 2.5, perSeed: [breakdown(2), breakdown(3)] },
        ],
        chosenIndex: 1,
        marginVsNull: 3.75,
        epsilon: 1.101,
      },
    ];
    const fixture = [bareResult(5, decisions)];
    const parsed = parseDecisionsCsv(renderDecisionsCsv(fixture));
    const direct = decisionRowsOf(fixture);
    expect(parsed).toHaveLength(direct.length);
    for (let i = 0; i < parsed.length; i++) {
      const p = parsed[i]!;
      const d = direct[i]!;
      // Identity + label fields byte-exact (the quote round-trip); scores
      // survive at the csv's 3-decimal precision.
      expect([p.seed, p.strategy, p.decision, p.site, p.sector, p.hop, p.candidate]).toEqual([
        d.seed, d.strategy, d.decision, d.site, d.sector, d.hop, d.candidate,
      ]);
      expect(p.label).toBe(d.label);
      expect(p.chosen).toBe(d.chosen);
      expect(p.score).toBeCloseTo(d.score, 3);
      expect(p.epsilon).toBeCloseTo(d.epsilon, 3);
    }
  });

  it('71b — perItemDecisionStats pools instances by item with per-decision null joins', () => {
    // The same item at two docks (different prices — instance noise) plus a
    // one-off item; null-arm scores differ per decision, so the deltas must
    // join to the RIGHT null.
    const decisions: RunDecisionRecord[] = [
      {
        site: 'portBuy',
        sectorId: 'the-start',
        hop: 6,
        labels: ['null', 'buy daemon:janus @3', 'buy unit:archer:L2 @2'],
        results: [
          { score: -2, perSeed: [breakdown(-2), breakdown(-2)] },
          { score: 4, perSeed: [breakdown(4), breakdown(4)] },
          { score: -3, perSeed: [breakdown(-3), breakdown(-3)] },
        ],
        chosenIndex: 1,
        marginVsNull: 6,
        epsilon: 3.145,
      },
      {
        site: 'portBuy',
        sectorId: 'the-deep-end',
        hop: 6,
        labels: ['null', 'buy daemon:janus @4'],
        results: [
          { score: 1, perSeed: [breakdown(1), breakdown(1)] },
          { score: 2, perSeed: [breakdown(2), breakdown(2)] },
        ],
        chosenIndex: 0, // null stood (margin 1 < ε)
        marginVsNull: 1,
        epsilon: 3.145,
      },
    ];
    const stats = perItemDecisionStats(decisionRowsOf([bareResult(2, decisions)]));
    const janus = stats.find((s) => s.item === 'daemon:janus')!;
    // Two instances pooled across docks: deltas 4−(−2)=6 and 2−1=1.
    expect(janus.n).toBe(2);
    expect(janus.picked).toBe(1);
    expect(janus.pickRate).toBeCloseTo(0.5, 10);
    expect(janus.meanDelta).toBeCloseTo(3.5, 10);
    expect(janus.meanDeltaPicked).toBeCloseTo(6, 10);
    const archer = stats.find((s) => s.item === 'unit:archer:L2')!;
    expect(archer.n).toBe(1);
    expect(archer.picked).toBe(0);
    expect(archer.meanDelta).toBeCloseTo(-1, 10);
    // Sorted: within the site, bigger samples first.
    expect(stats[0]!.item).toBe('daemon:janus');
  });

  it('71b — renderDecisionAnalysis marks sub-floor samples and counts decisions', () => {
    const decisions: RunDecisionRecord[] = [
      {
        site: 'portBuy',
        sectorId: 'the-start',
        hop: 6,
        labels: ['null', 'buy daemon:janus @3'],
        results: [
          { score: 0, perSeed: [breakdown(0), breakdown(0)] },
          { score: 5, perSeed: [breakdown(5), breakdown(5)] },
        ],
        chosenIndex: 1,
        marginVsNull: 5,
        epsilon: 3.145,
      },
    ];
    const out = renderDecisionAnalysis(decisionRowsOf([bareResult(4, decisions)]));
    expect(out).toContain('1 decisions across 1 arbitrated runs');
    expect(out).toContain('daemon:janus');
    // n=1 is under the floor → the directional marker rides the n column.
    expect(out).toContain('1·');
    expect(out).toContain(`n=${PER_ITEM_N_FLOOR} floor`);
  });

  // ── 71c — the tier-flip instrument ─────────────────────────────────────────

  it('71c — tierFlipRows counts shadow-judged decisions per site; csv + aggregate render', () => {
    const shadowRecord = (
      site: string,
      chosenIndex: number,
      shadowChosenIndex?: number,
    ): RunDecisionRecord => ({
      site,
      sectorId: 'the-start',
      hop: 1,
      labels: ['null', 'x'],
      results: [
        { score: 0, perSeed: [breakdown(0), breakdown(0)] },
        { score: 5, perSeed: [breakdown(5), breakdown(5)] },
      ],
      chosenIndex,
      marginVsNull: 5,
      epsilon: 1,
      ...(shadowChosenIndex !== undefined ? { shadowChosenIndex } : {}),
    });
    const results = [
      bareResult(1, [
        shadowRecord('portBuy', 1, 0), // flip
        shadowRecord('portBuy', 1, 1), // agree
        shadowRecord('nodeChoice', 0, 0), // agree
        shadowRecord('grant:redraw', 1), // NOT shadow-judged — excluded
      ]),
      bareResult(2), // no log at all — excluded
    ];
    const rows = tierFlipRows(results);
    expect(rows).toEqual([
      { seed: 1, strategy: 'arbitrated:scored', site: 'nodeChoice', decisions: 1, flips: 0 },
      { seed: 1, strategy: 'arbitrated:scored', site: 'portBuy', decisions: 2, flips: 1 },
    ]);
    const csv = renderTierFlipsCsv(results);
    expect(csv.split('\n')[0]).toBe('seed,strategy,site,decisions,flips');
    expect(csv).toContain('1,arbitrated:scored,portBuy,2,1');
    const analysis = renderTierFlipAnalysis(results);
    // Most-flippy-first: portBuy (50%) before nodeChoice (0%).
    expect(analysis.indexOf('portBuy')).toBeLessThan(analysis.indexOf('nodeChoice'));
    expect(analysis).toContain('overall: 1/3 (33.3%)');
  });

  it('aggregates win rate and hop stats', () => {
    const results = [
      runOne(1, makeStrategy('pure-random')!),
      runOne(2, makeStrategy('pure-random')!),
      runOne(3, makeStrategy('pure-random')!),
    ];
    const stats = aggregate(results);
    expect(stats.totalRuns).toBe(3);
    expect(stats.winRate).toBeGreaterThanOrEqual(0);
    expect(stats.winRate).toBeLessThanOrEqual(1);
    expect(stats.averageHopReached).toBeGreaterThanOrEqual(0);
    // 72b audit (F1) — the walk-position pair: sectors cleared rides beside
    // the per-sector hop (a bare hop average reads backwards on walks).
    expect(stats.averageSectorsCleared).toBeGreaterThanOrEqual(0);
    expect(Object.keys(stats.byOutcome).length).toBeGreaterThan(0);
    // hangsByLayout is always present; empty when no hangs occurred.
    expect(stats.hangsByLayout).toBeDefined();
    const sumHangs = Object.values(stats.hangsByLayout).reduce((a, b) => a + b, 0);
    expect(sumHangs).toBe(stats.hangs);
  });

  it('every battle carries player/enemy level arrays matching the team sizes', () => {
    // G4 per-hop telemetry: the level arrays must be present and aligned
    // with the recorded team sizes, or the per-hop analysis silently lies.
    const result = runOne(3, makeStrategy('greedy')!);
    expect(result.battles.length).toBeGreaterThan(0);
    for (const b of result.battles) {
      expect(b.playerLevels).toHaveLength(b.playerTeamSize);
      expect(b.enemyLevels).toHaveLength(b.enemyTeamSize);
      expect(b.playerLevels.every((l) => l >= 1)).toBe(true);
      expect(b.enemyLevels.every((l) => l >= 1)).toBe(true);
    }
  });

  it('per-hop stats aggregate by hop with sane bounds', () => {
    const results = [
      runOne(1, makeStrategy('pure-random')!),
      runOne(2, makeStrategy('greedy')!),
      runOne(3, makeStrategy('greedy')!),
    ];
    const stats = perHopStats(results);
    expect(stats.length).toBeGreaterThan(0);
    // Rows are sorted (sector, hop) lexicographic (68e — hop numbering resets
    // per sector, so plain hop-ascending only held while no fixture seed ever
    // cleared sector 1); battle counts sum to all battles played.
    const keys = stats.map((s) => [s.sector, s.hop]);
    expect([...keys].sort((a, b) => a[0]! - b[0]! || a[1]! - b[1]!)).toEqual(keys);
    const totalBattles = results.reduce((acc, r) => acc + r.battles.length, 0);
    expect(stats.reduce((acc, s) => acc + s.battles, 0)).toBe(totalBattles);
    for (const s of stats) {
      expect(s.playerAvgLevel).toBeGreaterThanOrEqual(1);
      expect(s.enemyAvgLevel).toBeGreaterThanOrEqual(1);
      expect(s.playerSize).toBeGreaterThan(0);
      expect(s.enemySize).toBeGreaterThan(0);
      expect(s.playerLevelSpread).toBeGreaterThanOrEqual(0);
    }
    expect(renderPerHopAnalysis(results)).toContain('Per-hop team analysis');
  });

  it('per-hop run-death stats are run-level, not per-wave (the pool absorbs lost waves)', () => {
    // Config-free fixtures pin the RUN-level mechanic across the multi-wave pool
    // system. Run A: 3 waves on hop 1 (loses 2 of them — pool absorbs it),
    // survives to hop 2, completes. Run B: dies on hop 1. So hop 1 has 2
    // runs reached, 1 died (B) — NOT 3 (the lost waves don't count as run-deaths).
    const battle = (
      hop: number,
      winner: 'player' | 'enemy',
      playerDeaths: number,
    ): BattleResult => ({
      sector: 0,
      hop,
      worldSeed: 0,
      encounterId: 'fixture',
      layoutId: null,
      winner,
      ticks: 1,
      playerDeaths,
      enemyDeaths: 0,
      playerTeamSize: 5,
      enemyTeamSize: 8,
      playerLevels: [1, 1, 1, 1, 1],
      enemyLevels: [1, 1, 1, 1, 1, 1, 1, 1],
      poolAtStart: 20,
    });
    const run = (
      battles: BattleResult[],
      outcome: 'complete' | 'defeat',
      finalHopReached: number,
    ): RunResult => ({
      seed: 0,
      strategyName: 'synthetic',
      daemonId: null,
      outcome,
      finalHopReached,
      sectorsCleared: 0,
      totalTicks: 0,
      finalTeamSize: 5,
      portPurchases: 0,
      packetsFired: 0,
      finalBits: 0,
      poolAtSectorClears: [],
      finalPool: 0,
      battles,
      recruits: [],
    });
    // Run A: 3 hop-1 waves (2 lost but absorbed), then hop 2, completes.
    const runA = run(
      [
        battle(1, 'enemy', 4),
        battle(1, 'enemy', 3),
        battle(1, 'player', 1),
        battle(2, 'player', 0),
      ],
      'complete',
      2,
    );
    // Run B: dies on hop 1.
    const runB = run([battle(1, 'enemy', 5)], 'defeat', 1);

    const stats = perHopStats([runA, runB]);
    const f1 = stats.find((s) => s.hop === 1)!;
    const f2 = stats.find((s) => s.hop === 2)!;
    expect(f1.runsReached).toBe(2); // both runs reached hop 1
    expect(f1.runsDied).toBe(1); // only run B ENDED here (lost waves ≠ run-death)
    expect(f1.deathRate).toBeCloseTo(0.5);
    expect(f1.battles).toBe(4); // 4 total waves on hop 1 across the two runs
    expect(f1.avgPlayerDeaths).toBeCloseTo((4 + 3 + 1 + 5) / 4); // per-wave attrition
    expect(f2.runsReached).toBe(1); // only run A reached hop 2
    expect(f2.runsDied).toBe(0); // run A completed, didn't die
    // Σ runsDied across hops == total non-completing runs.
    expect(stats.reduce((acc, s) => acc + s.runsDied, 0)).toBe(1);
  });

  it('per-hop funnel rows split by sector, reach/death lexicographic (68e)', () => {
    // Act-1 hop 1 and act-2 hop 1 are separate funnel rows: a run that cleared
    // act 1 "reached" every act-1 row regardless of its (reset) finalHop, and
    // deaths attribute to the (sector, hop) walk position.
    const battle = (sector: number, hop: number): BattleResult => ({
      sector,
      hop,
      worldSeed: 0,
      encounterId: 'fixture',
      layoutId: null,
      winner: 'player',
      ticks: 1,
      playerDeaths: 0,
      enemyDeaths: 0,
      playerTeamSize: 5,
      enemyTeamSize: 8,
      playerLevels: [1],
      enemyLevels: [1],
      poolAtStart: 20,
    });
    const run = (
      battles: BattleResult[],
      outcome: 'complete' | 'defeat',
      sectorsCleared: number,
      finalHopReached: number,
    ): RunResult => ({
      seed: 0,
      strategyName: 'syn',
      daemonId: null,
      outcome,
      finalHopReached,
      sectorsCleared,
      totalTicks: 0,
      finalTeamSize: 5,
      portPurchases: 0,
      packetsFired: 0,
      finalBits: 0,
      poolAtSectorClears: [],
      finalPool: 0,
      battles,
      recruits: [],
    });
    // Run A walks act 1 (hops 1–2), crosses, dies at act-2 hop 1.
    const runA = run([battle(0, 1), battle(0, 2), battle(1, 1)], 'defeat', 1, 1);
    // Run B dies at act-1 hop 1 — the SAME bare hop number as A's death.
    const runB = run([battle(0, 1)], 'defeat', 0, 1);
    const stats = perHopStats([runA, runB]);
    const rowKey = (s: { sector: number; hop: number }) => `${s.sector}:${s.hop}`;
    expect(stats.map(rowKey)).toEqual(['0:1', '0:2', '1:1']); // sorted, no merge
    const act1hop1 = stats.find((s) => rowKey(s) === '0:1')!;
    const act1hop2 = stats.find((s) => rowKey(s) === '0:2')!;
    const act2hop1 = stats.find((s) => rowKey(s) === '1:1')!;
    expect(act1hop1.runsReached).toBe(2);
    expect(act1hop1.runsDied).toBe(1); // B only — A's death is act-2's
    expect(act1hop2.runsReached).toBe(1); // A (cleared a later sector)
    expect(act1hop2.runsDied).toBe(0);
    expect(act2hop1.runsReached).toBe(1);
    expect(act2hop1.runsDied).toBe(1); // A
  });

  it('per-layout stats group by layout with wave win rate, deaths, and sizes', () => {
    const b = (
      layoutId: string | null,
      hop: number,
      winner: 'player' | 'enemy',
      playerDeaths: number,
      enemyTeamSize: number,
    ): BattleResult => ({
      sector: 0,
      hop,
      worldSeed: 0,
      encounterId: 'fixture',
      layoutId,
      winner,
      ticks: 1,
      playerDeaths,
      enemyDeaths: 0,
      playerTeamSize: 5,
      enemyTeamSize,
      playerLevels: [1, 1, 1, 1, 1],
      enemyLevels: Array<number>(enemyTeamSize).fill(1),
      poolAtStart: 20,
    });
    const results: RunResult[] = [
      {
        seed: 0,
        strategyName: 'synthetic',
        daemonId: null,
        outcome: 'complete',
        finalHopReached: 2,
        sectorsCleared: 0,
        totalTicks: 0,
        finalTeamSize: 5,
        portPurchases: 0,
        packetsFired: 0,
        finalBits: 0,
        poolAtSectorClears: [],
        finalPool: 0,
        recruits: [],
        battles: [
          // junctionAmbush: 1 of 4 player wins (brutal), outnumbered 9-vs-5.
          b('junctionAmbush', 1, 'enemy', 4, 9),
          b('junctionAmbush', 1, 'enemy', 3, 9),
          b('junctionAmbush', 2, 'enemy', 2, 9),
          b('junctionAmbush', 2, 'player', 1, 9),
          // river: 3 of 4 player wins, fair 6-vs-5.
          b('river', 1, 'player', 0, 6),
          b('river', 1, 'player', 0, 6),
          b('river', 2, 'player', 1, 6),
          b('river', 2, 'enemy', 2, 6),
          // procedural (null → 'procedural').
          b(null, 1, 'player', 0, 5),
        ],
      },
    ];

    const stats = perLayoutStats(results);
    const ja = stats.find((s) => s.layout === 'junctionAmbush')!;
    const river = stats.find((s) => s.layout === 'river')!;
    expect(ja.battles).toBe(4);
    expect(ja.playerWinRate).toBeCloseTo(0.25);
    expect(ja.enemyWinRate).toBeCloseTo(0.75);
    expect(ja.enemySize).toBeCloseTo(9); // outnumbered ("ambush")
    expect(ja.playerSize).toBeCloseTo(5);
    expect(river.playerWinRate).toBeCloseTo(0.75);
    expect(stats.find((s) => s.layout === 'procedural')).toBeDefined(); // null → 'procedural'
    // Sorted most-brutal-first (lowest player win rate).
    expect(stats[0]!.layout).toBe('junctionAmbush');
    // Total waves across layouts == total battles.
    expect(stats.reduce((a, s) => a + s.battles, 0)).toBe(9);

    // layout × hop splits junctionAmbush into hop 1 and hop 2.
    const lf = perLayoutHopStats(results);
    expect(lf.filter((s) => s.layout === 'junctionAmbush').map((s) => s.hop)).toEqual([1, 2]);
    const ja1 = lf.find((s) => s.layout === 'junctionAmbush' && s.hop === 1)!;
    expect(ja1.battles).toBe(2);
    expect(ja1.playerWinRate).toBeCloseTo(0); // both hop-1 ambush waves lost

    expect(renderLayoutAnalysis(results)).toContain('Per-layout difficulty');
  });

  it('72b audit (F2) — layout × hop rows split by SECTOR: act-1 hop N never merges with act-2 hop N (gotcha #120)', () => {
    const b = (sector: number, hop: number, winner: 'player' | 'enemy'): BattleResult => ({
      sector,
      hop,
      worldSeed: 0,
      encounterId: 'fixture',
      layoutId: 'river',
      winner,
      ticks: 1,
      playerDeaths: 0,
      enemyDeaths: 0,
      playerTeamSize: 5,
      enemyTeamSize: 8,
      playerLevels: [1],
      enemyLevels: [1],
      poolAtStart: 20,
    });
    const run: RunResult = {
      seed: 0,
      strategyName: 'syn',
      daemonId: null,
      outcome: 'defeat',
      finalHopReached: 3,
      sectorsCleared: 1,
      totalTicks: 0,
      finalTeamSize: 5,
      portPurchases: 0,
      packetsFired: 0,
      finalBits: 0,
      poolAtSectorClears: [14],
      finalPool: 0,
      battles: [b(0, 3, 'player'), b(0, 3, 'player'), b(1, 3, 'enemy')],
      recruits: [],
    };
    const rows = perLayoutHopStats([run]).filter((s) => s.layout === 'river');
    // Same layout, same bare hop, different acts → TWO rows, not one merged.
    expect(rows.map((s) => `${s.sector}:${s.hop}`)).toEqual(['0:3', '1:3']);
    expect(rows[0]!.playerWinRate).toBeCloseTo(1); // act-1 waves won
    expect(rows[1]!.playerWinRate).toBeCloseTo(0); // the act-2 wave lost
    // The CSV twin carries the sector column.
    expect(renderLayoutHopCsv(rows)).toContain('layout,sector,hop');
  });

  it('per-encounter stats key pool damage by encounter id (X2)', () => {
    // Player pool damage TAKEN = the chip's `enemy` field (enemy survivors chip
    // the player pool) × the chip multiplier; per INSTANCE (a node visit = one
    // hop within a run) and per WAVE (a turn).
    const m = HEALTH.chipMultiplier;
    const eb = (hop: number, encounterId: string, winner: 'player' | 'enemy'): BattleResult => ({
      sector: 0,
      hop,
      worldSeed: 0,
      encounterId,
      layoutId: null,
      winner,
      ticks: 1,
      playerDeaths: 0,
      enemyDeaths: 0,
      playerTeamSize: 5,
      enemyTeamSize: 8,
      playerLevels: [],
      enemyLevels: [],
      poolAtStart: 20,
    });
    const tel = (
      chips: ReadonlyArray<{ hop: number; encounterId: string; player: number; enemy: number }>,
    ): RunTelemetry => {
      const acc = new TelemetryAccumulator();
      for (const c of chips) acc.recordTurnChip(0, c.hop, c.encounterId, c.player, c.enemy);
      return acc.finish([], []);
    };
    const results: RunResult[] = [
      {
        seed: 0,
        strategyName: 'syn',
        daemonId: null,
        outcome: 'complete',
        finalHopReached: 2,
        sectorsCleared: 0,
        totalTicks: 0,
        finalTeamSize: 5,
        portPurchases: 0,
        packetsFired: 0,
        finalBits: 0,
        poolAtSectorClears: [],
        finalPool: 0,
        battles: [eb(1, 'enc1', 'player'), eb(1, 'enc1', 'enemy'), eb(2, 'enc2', 'player')],
        recruits: [],
        telemetry: tel([
          { hop: 1, encounterId: 'enc1', player: 2, enemy: 3 },
          { hop: 1, encounterId: 'enc1', player: 4, enemy: 5 },
          { hop: 2, encounterId: 'enc2', player: 10, enemy: 1 },
        ]),
      },
      {
        seed: 1,
        strategyName: 'syn',
        daemonId: null,
        outcome: 'complete',
        finalHopReached: 1,
        sectorsCleared: 0,
        totalTicks: 0,
        finalTeamSize: 5,
        portPurchases: 0,
        packetsFired: 0,
        finalBits: 0,
        poolAtSectorClears: [],
        finalPool: 0,
        battles: [eb(1, 'enc1', 'player')],
        recruits: [],
        telemetry: tel([{ hop: 1, encounterId: 'enc1', player: 1, enemy: 7 }]),
      },
    ];
    const stats = perEncounterStats(results);
    const enc1 = stats.find((s) => s.encounter === 'enc1')!;
    const enc2 = stats.find((s) => s.encounter === 'enc2')!;
    // enc1: 3 waves (2 + 1 battles), 2 instances (one hop-1 group per run).
    expect(enc1.waves).toBe(3);
    expect(enc1.instances).toBe(2);
    expect(enc1.playerWinRate).toBeCloseTo(2 / 3);
    expect(enc1.enemyWinRate).toBeCloseTo(1 / 3);
    expect(enc1.kind).toBe('unknown'); // synthetic id doesn't resolve in the catalog
    // instance taken: run0 (3+5)=8m, run1 7m → mean 7.5m; per wave (3+5+7)/3 = 5m.
    expect(enc1.poolDmgTaken).toBeCloseTo(7.5 * m);
    expect(enc1.poolDmgTakenPerWave).toBeCloseTo(5 * m);
    // dealt = the `player` chip: run0 (2+4)=6m, run1 1m → mean 3.5m.
    expect(enc1.poolDmgDealt).toBeCloseTo(3.5 * m);
    expect(enc1.hasPoolData).toBe(true);
    // enc2 instance taken = 1m (low) → enc1 sorts first (most-costly-first).
    expect(enc2.poolDmgTaken).toBeCloseTo(1 * m);
    expect(stats[0]!.encounter).toBe('enc1');
    expect(renderEncounterAnalysis(results)).toContain('Per-encounter difficulty');
  });

  it('per-encounter instance grouping splits same-hop chips across sectors (68e)', () => {
    // The walk-collision pin: a two-act run resets hop numbering per sector,
    // so act-1 hop 2 and act-2 hop 2 are DIFFERENT node visits. Pre-68e the
    // instance grouper keyed by bare hop — the act-2 encounter's chips landed
    // inside the act-1 encounter's instance (act2 read instances=0, act1
    // absorbed its pool damage).
    const m = HEALTH.chipMultiplier;
    const acc = new TelemetryAccumulator();
    acc.recordTurnChip(0, 2, 'act1enc', 1, 3); // act-1 sector, hop 2
    acc.recordTurnChip(1, 2, 'act2enc', 1, 9); // act-2 sector, SAME hop number
    const results: RunResult[] = [
      {
        seed: 0,
        strategyName: 'syn',
        daemonId: null,
        outcome: 'defeat',
        finalHopReached: 2,
        sectorsCleared: 1,
        totalTicks: 0,
        finalTeamSize: 5,
        portPurchases: 0,
        packetsFired: 0,
        finalBits: 0,
        poolAtSectorClears: [],
        finalPool: 0,
        battles: [],
        recruits: [],
        telemetry: acc.finish([], []),
      },
    ];
    const stats = perEncounterStats(results);
    const act1 = stats.find((s) => s.encounter === 'act1enc')!;
    const act2 = stats.find((s) => s.encounter === 'act2enc')!;
    expect(act1.instances).toBe(1);
    expect(act2.instances).toBe(1);
    expect(act1.poolDmgTaken).toBeCloseTo(3 * m);
    expect(act2.poolDmgTaken).toBeCloseTo(9 * m);
  });

  it('per-encounter degrades gracefully with telemetry off (outcome cols only)', () => {
    const eb = (encounterId: string): BattleResult => ({
      sector: 0,
      hop: 1,
      worldSeed: 0,
      encounterId,
      layoutId: null,
      winner: 'player',
      ticks: 1,
      playerDeaths: 0,
      enemyDeaths: 0,
      playerTeamSize: 5,
      enemyTeamSize: 8,
      playerLevels: [],
      enemyLevels: [],
      poolAtStart: 20,
    });
    const results: RunResult[] = [
      {
        seed: 0,
        strategyName: 'syn',
        daemonId: null,
        outcome: 'complete',
        finalHopReached: 1,
        sectorsCleared: 0,
        totalTicks: 0,
        finalTeamSize: 5,
        portPurchases: 0,
        packetsFired: 0,
        finalBits: 0,
        poolAtSectorClears: [],
        finalPool: 0,
        battles: [eb('enc1')],
        recruits: [],
      },
    ];
    const stats = perEncounterStats(results);
    expect(stats[0]!.hasPoolData).toBe(false);
    expect(stats[0]!.instances).toBe(0);
    expect(stats[0]!.poolDmgTaken).toBe(0);
    expect(stats[0]!.waves).toBe(1); // outcome columns still populate
    expect(renderEncounterAnalysis(results)).toContain('no pool data');
  });

  it('a real run threads a resolvable encounter id into every battle (X2)', () => {
    const result = runOne(3, makeStrategy('greedy')!, { telemetry: true });
    expect(result.battles.length).toBeGreaterThan(0);
    for (const b of result.battles) expect(b.encounterId.length).toBeGreaterThan(0);
    const stats = perEncounterStats([result]);
    // Real catalog ids resolve to a real kind (never 'unknown'); pool data present.
    for (const s of stats) {
      expect(s.kind).not.toBe('unknown');
      expect(s.hasPoolData).toBe(true);
    }
  });

  it('--layout forces a single layout on every battle (the forced-layout plumbing)', () => {
    expect(LAYOUT_IDS).toContain('junctionAmbush');
    const result = runOne(7, makeStrategy('greedy')!, {
      runConfig: { forcedLayoutId: 'junctionAmbush' },
    });
    expect(result.battles.length).toBeGreaterThan(0);
    for (const battle of result.battles) {
      expect(battle.layoutId).toBe('junctionAmbush');
    }
  });

  it('--encounter forces one encounter at every matching-kind battle (X2)', () => {
    const forced = ENCOUNTERS.find((e) => e.kind === 'normal')!.id;
    const result = runOne(7, makeStrategy('greedy')!, {
      telemetry: true,
      runConfig: { forcedEncounterId: forced },
    });
    expect(result.battles.length).toBeGreaterThan(0);
    // Per-kind aware (Wb4): every NORMAL-kind battle fields the forced encounter;
    // any non-normal battle (boss/elite, if reached) draws its own bucket.
    for (const b of result.battles) {
      if (getEncounter(b.encounterId)?.kind === 'normal') {
        expect(b.encounterId).toBe(forced);
      }
    }
    // And the forced encounter was actually fielded (a battle node is a normal
    // node by default, so a greedy run hits it immediately).
    expect(result.battles.some((b) => b.encounterId === forced)).toBe(true);
  });

  it('renders a failure trace for a non-complete result', () => {
    // Force-construct a synthetic defeat by reaching into the harness
    // result. Don't need to actually lose a run — the trace renderer
    // is pure w.r.t. its input.
    const result = runOne(1, makeStrategy('pure-random')!);
    const synthetic = { ...result, outcome: 'defeat' as const };
    const md = renderFailureTrace(synthetic);
    expect(md).toContain('# Fuzz failure');
    expect(md).toContain('## Battles');
    // 68e — the walk-forensics columns.
    expect(md).toContain('| Sec | Hop | Encounter |');
    expect(md).toContain('## Recruits');
    expect(failureFilename(synthetic)).toMatch(/seed1-defeat\.md$/);
  });

  it('failureFilename sanitizes NTFS-illegal characters in the strategy name', () => {
    // Scored strategies are named `scored:<file>` — on Windows a raw colon
    // makes writeFileSync create an alternate data stream named "scored"
    // instead of a real .md trace (§68e). Pin: no illegal chars survive.
    const result = runOne(1, makeStrategy('pure-random')!);
    const synthetic = {
      ...result,
      strategyName: 'scored:59-regen-vector',
      outcome: 'defeat' as const,
    };
    const name = failureFilename(synthetic);
    expect(name).toBe('scored-59-regen-vector-seed1-defeat.md');
    expect(name).not.toMatch(/[<>:"/\\|?*]/);
  });
});
