/**
 * 69f → 85e — the runnable ε floor read. Derives the A/A noise floor per
 * SITE-CLASS context via deriveEpsilonAA (methodology: epsilonAA.ts
 * header + WORKLOG §69; the pooling rule is 70b's flat-per-class RMS).
 *
 *   npx tsx tests/fuzz/rollout/readEpsilonAA.ts
 *
 * The 85e re-read (round-6-spec §"The ε re-read", shape-locked
 * 2026-08-24) reworks the 69f/70 script wholesale:
 *
 *  - Every context preps through the walker's stopAtPhase seam. The old
 *    manual enterNode recipe broke when §74 stamped the root as the
 *    starting-event node (entering it opens a page, not a turn gate);
 *    stopAtPhase 'turn-intro' parks at the loop-top check BEFORE the
 *    walker's own fires/grants — the pristine site context.
 *  - NEW event-page class (EVENT_CHOICE_EPSILON's first real
 *    derivation — provisional-by-class-argument since 74g).
 *  - NEW campRaid contexts: camp-carrying turn-intro parks, read BOTH
 *    unarmed (null A/A — the class rule on the site's true states) and
 *    ARMED (raid A/A — a raid's outcome variance can exceed the null
 *    walk's, so the mixed-arm floor 2·√((σN²+σR²)/2) is derived rather
 *    than assumed; epsilonAA.ts `arm`).
 *  - Every context reads at λ_prior 0 AND 1 under the SAME pair seeds
 *    (λ only re-scores — trajectories are λ-independent — so the Δσ is
 *    the fold's own noise contribution, read paired).
 *  - The E1 fix: per-class pooling reported both ways — all contexts
 *    vs excluding zero-σ (dominated) contexts.
 *  - The #11 argmax probe: within-context bootstrap of the max-over-C
 *    false-act rate against the E1-fixed class floor (a live decision
 *    gates C margins sharing one null score; scores are iid within a
 *    context, so resampling them IS the order-statistic read).
 *
 * Dropped from the 69f script: the "post-battle turn-outcome" context
 * (a historical 69f cross-reference — no site clones at turn-outcome).
 */

import { EventBus } from '../../../src/core/EventBus';
import type { GameEvents } from '../../../src/core/events';
import { RNG } from '../../../src/core/RNG';
import { Run } from '../../../src/run/Run';
import { getLayout } from '../../../src/config/layouts';
import { cloneRunForRollout } from '../../../src/bot/runRollout';
import { campRaidEligible } from '../campRaid';
import { loadPriorTable, priorFoldValues } from '../prior/priorTable';
import { walkToHorizon } from './walker';
import { deriveEpsilonAA, type EpsilonAAResult } from './epsilonAA';
import type { CandidateApply } from './evaluator';

const SEED = 20260730;
const EVALUATIONS = 40; // 20 margins
const DEGENERATE_SIGMA = 1e-6; // below this a context is dominated (E1)
const PRIOR_TABLE = priorFoldValues(loadPriorTable());

type SiteClass = 'map' | 'preTurn' | 'reward' | 'port' | 'event' | 'campRaid';

interface Row {
  readonly cls: SiteClass;
  readonly label: string;
  readonly armed: boolean;
  readonly byLambda: ReadonlyMap<number, EpsilonAAResult>;
}

const rows: Row[] = [];

function read(
  cls: SiteClass,
  label: string,
  live: Run,
  rngSeed: number,
  arm?: CandidateApply,
): void {
  const byLambda = new Map<number, EpsilonAAResult>();
  for (const lambda of [0, 1]) {
    const t0 = performance.now();
    // Same rngSeed per λ → same pair seeds → identical trajectories; the
    // λ=1 read differs by the fold's re-scoring only (paired Δσ).
    const r = deriveEpsilonAA(live, new RNG(rngSeed), {
      evaluations: EVALUATIONS,
      ...(arm !== undefined ? { arm } : {}),
      ...(lambda === 0
        ? {}
        : { rollout: { horizonBattles: 1, priorLambda: lambda, priorTable: PRIOR_TABLE } }),
    });
    byLambda.set(lambda, r);
    const secs = ((performance.now() - t0) / 1000).toFixed(0);
    const absMax = Math.max(...r.margins.map(Math.abs));
    const controlNote = r.controlMaxAbs === 0 ? '0 ✓' : `${r.controlMaxAbs} ⚠ MUST BE 0`;
    console.log(
      `${label}${arm ? ' [ARMED: raid]' : ''} @ λ=${lambda}:\n` +
        `  control |margin| max: ${controlNote}\n` +
        `  A/A margins (n=${r.margins.length}): σ=${r.sigma.toFixed(3)} · |max|=${absMax.toFixed(2)}\n` +
        `  ε = 2σ = ${r.epsilon.toFixed(3)}  (score units: pool HP)  [${secs}s]`,
    );
  }
  rows.push({ cls, label, armed: arm !== undefined, byLambda });
}

// ---------------------------------------------------------------------------
// Context prep — all through the walker's stopAtPhase seam.
// ---------------------------------------------------------------------------

/** A battle-count walk from a fresh run (parks at the post-battle gate). */
function stateAfterBattles(runSeed: number, battles: number, bias: number): Run {
  const s = cloneRunForRollout(new Run(runSeed, new EventBus<GameEvents>()), 777 + battles + bias);
  walkToHorizon(s, { horizonBattles: battles, policySeed: 424242 + battles + bias, maxHops: 80 });
  return s.run;
}

/** Clone-walk `from` until the run ENTERS `phase` (fresh clone per call —
 *  a clone already at the stop phase returns immediately, so stage
 *  battle-count and phase walks separately). Null if it never parks. */
function parkAtPhase(
  from: Run,
  phase: 'map' | 'reward' | 'port' | 'event' | 'turn-intro',
  cloneSeed: number,
  policySeed: number,
): Run | null {
  const c = cloneRunForRollout(from, cloneSeed);
  walkToHorizon(c, { horizonBattles: 9999, policySeed, maxHops: 80, stopAtPhase: phase });
  return c.run.phase === phase ? c.run : null;
}

/** Scan (policy bias × run seed) until `build` yields a state. The bias
 *  perturbs the walk's routing (different frontier picks reach different
 *  node kinds); the run seed perturbs the map itself. */
function hunt(label: string, build: (runSeed: number, bias: number) => Run | null): Run {
  for (let bias = 0; bias < 8; bias++) {
    for (let s = SEED; s < SEED + 12; s++) {
      const found = build(s, bias);
      if (found) return found;
    }
  }
  throw new Error(`readEpsilonAA: no state found for "${label}"`);
}

function mapStateAfter(battles: number): Run {
  const state = hunt(`map after ${battles}`, (runSeed, bias) =>
    parkAtPhase(stateAfterBattles(runSeed, battles, bias), 'map', 999 + battles + bias, 313 + battles + bias),
  );
  return state;
}

function turnIntroAfter(battles: number): Run {
  return hunt(`turn-intro after ${battles}`, (runSeed, bias) => {
    const from = battles === 0 ? new Run(runSeed, new EventBus<GameEvents>()) : stateAfterBattles(runSeed, battles, bias);
    return parkAtPhase(from, 'turn-intro', 1313 + battles + bias, 515 + battles + bias);
  });
}

function rewardStateAfter(battles: number): Run {
  return hunt(`reward after ${battles}`, (runSeed, bias) => {
    const from = battles === 0 ? new Run(runSeed, new EventBus<GameEvents>()) : stateAfterBattles(runSeed, battles, bias);
    return parkAtPhase(from, 'reward', 1111 + battles + bias, 616 + battles + bias);
  });
}

function portStateAfter(battles: number): Run {
  return hunt(`port dock after ${battles}`, (runSeed, bias) => {
    const from = battles === 0 ? new Run(runSeed, new EventBus<GameEvents>()) : stateAfterBattles(runSeed, battles, bias);
    return parkAtPhase(from, 'port', runSeed + 3 + bias, runSeed + 4 + bias);
  });
}

function eventStateAfter(battles: number): Run {
  return hunt(`event page after ${battles}`, (runSeed, bias) => {
    const from = battles === 0 ? new Run(runSeed, new EventBus<GameEvents>()) : stateAfterBattles(runSeed, battles, bias);
    return parkAtPhase(from, 'event', 1717 + battles + bias, 818 + battles + bias);
  });
}

/** A camp-carrying turn-intro: prefer an AUTHORED layout with campSpawns
 *  (camps guaranteed at spawn — the armed read needs a raid that actually
 *  happens); fall back to campRaid-ELIGIBLE (procedural roll) with a
 *  printed note if the scan exhausts. */
function campTurnIntroAfter(battles: number): Run {
  const authoredCamps = (r: Run): boolean => {
    const id = r.encounterMap?.layoutId ?? undefined;
    if (id === undefined) return false;
    return ((getLayout(id)?.campSpawns?.length ?? 0) > 0);
  };
  try {
    return hunt(`authored-camp turn-intro after ${battles}`, (runSeed, bias) => {
      const from = battles === 0 ? new Run(runSeed, new EventBus<GameEvents>()) : stateAfterBattles(runSeed, battles, bias);
      const parked = parkAtPhase(from, 'turn-intro', 1919 + battles + bias, 717 + battles + bias);
      return parked !== null && authoredCamps(parked) ? parked : null;
    });
  } catch {
    console.log(
      `  ⚠ no AUTHORED-camp turn-intro found after ${battles} battles — falling back to campRaid-ELIGIBLE (procedural; a campless roll makes the raid arm ≡ null)`,
    );
    return hunt(`eligible turn-intro after ${battles}`, (runSeed, bias) => {
      const from = battles === 0 ? new Run(runSeed, new EventBus<GameEvents>()) : stateAfterBattles(runSeed, battles, bias);
      const parked = parkAtPhase(from, 'turn-intro', 2121 + battles + bias, 919 + battles + bias);
      return parked !== null && campRaidEligible(parked.encounterMap?.layoutId ?? undefined) ? parked : null;
    });
  }
}

// ---------------------------------------------------------------------------
// The reads (context labels carry their site classes for the summary).
// ---------------------------------------------------------------------------

// The MAP class (out-of-battle fires / node choice / event-choice-by-
// class-argument until today; horizon = end of the NEXT battle).
read('map', 'fresh hop-1 map (out-of-battle class)', new Run(SEED, new EventBus<GameEvents>()), 11);
read('map', 'map after 2 battles (out-of-battle class)', mapStateAfter(2), 15);
read('map', 'map after 3 battles (out-of-battle class)', mapStateAfter(3), 16);
read('map', 'map after 5 battles (out-of-battle class)', mapStateAfter(5), 19);

// The PRETURN class (turn-intro; horizon = end of the CURRENT battle).
read('preTurn', 'first turn-intro (preTurn class, depth 0 — post-boon, the §74+ reality)', turnIntroAfter(0), 17);
read('preTurn', 'mid-act turn-intro (preTurn class, 5 battles in)', turnIntroAfter(5), 18);

// The REWARD class (post-victory reward gate; daemon pick + the 84c
// shadow recruit record).
read('reward', 'first reward gate (reward class, 1 battle in)', rewardStateAfter(0), 20);
read('reward', 'mid-act reward gate (reward class, 5+ battles in)', rewardStateAfter(5), 21);

// The PORT-BUY class (docked, phase 'port').
const early = portStateAfter(0);
read('port', `early port dock (port-buy class, hop ${early.currentHop})`, early, 13);
const midDock = portStateAfter(5);
read('port', `mid-act port dock (port-buy class, 5+ battles in, hop ${midDock.currentHop})`, midDock, 14);

// 85e — the EVENT-PAGE class (EVENT_CHOICE_EPSILON's first derivation;
// depth 0 = the starting boon page every run opens on).
read('event', 'starting event page (event class, depth 0 — the boon page)', eventStateAfter(0), 22);
read('event', 'mid-act event page (event class, 5 battles in)', eventStateAfter(5), 23);

// 85e — the CAMPRAID class: camp-carrying turn-intro parks, unarmed AND
// armed (the arm is the site's exact apply — clone.raidNextBattle).
const raidArm: CandidateApply = (clone) => {
  clone.raidNextBattle = true;
};
const campEarly = campTurnIntroAfter(0);
const campMid = campTurnIntroAfter(5);
read('campRaid', `camp turn-intro (campRaid class, depth 0, layout ${campEarly.encounterMap?.layoutId ?? 'procedural'})`, campEarly, 24);
read('campRaid', `camp turn-intro (campRaid class, 5 battles in, layout ${campMid.encounterMap?.layoutId ?? 'procedural'})`, campMid, 25);
read('campRaid', `camp turn-intro (campRaid class, depth 0, layout ${campEarly.encounterMap?.layoutId ?? 'procedural'})`, campEarly, 24, raidArm);
read('campRaid', `camp turn-intro (campRaid class, 5 battles in, layout ${campMid.encounterMap?.layoutId ?? 'procedural'})`, campMid, 25, raidArm);

// ---------------------------------------------------------------------------
// Summaries: per-class pooled floors (70b RMS), E1 both-ways, the
// campRaid mixed-arm floor, and the #11 argmax bootstrap.
// ---------------------------------------------------------------------------

const rms = (xs: readonly number[]): number =>
  Math.sqrt(xs.reduce((a, b) => a + b * b, 0) / xs.length);

console.log('\n════════ per-class pooled floors (70b RMS; ε = 2·σ_pooled) ════════');
const classes: SiteClass[] = ['map', 'preTurn', 'reward', 'port', 'event', 'campRaid'];
const e1Floor = new Map<string, number>(); // `${cls}@${λ}` → E1-fixed ε (unarmed pool)
for (const cls of classes) {
  const unarmed = rows.filter((r) => r.cls === cls && !r.armed);
  if (unarmed.length === 0) continue;
  for (const lambda of [0, 1]) {
    const sigmas = unarmed.map((r) => r.byLambda.get(lambda)!.sigma);
    const live = sigmas.filter((s) => s > DEGENERATE_SIGMA);
    const pooledAll = rms(sigmas);
    const pooledE1 = live.length > 0 ? rms(live) : pooledAll;
    const spread =
      live.length > 1 ? ` · σ spread ×${(Math.max(...live) / Math.min(...live)).toFixed(2)}` : '';
    const degenerate = sigmas.length - live.length;
    e1Floor.set(`${cls}@${lambda}`, 2 * pooledE1);
    console.log(
      `${cls} @ λ=${lambda}: ε(all ${sigmas.length} ctx) = ${(2 * pooledAll).toFixed(3)}` +
        ` · ε(E1: excl ${degenerate} zero-σ) = ${(2 * pooledE1).toFixed(3)}${spread}`,
    );
  }
}

console.log('\n════════ campRaid mixed-arm floor (85e: 2·√((σN²+σR²)/2)) ════════');
for (const lambda of [0, 1]) {
  const nulls = rows.filter((r) => r.cls === 'campRaid' && !r.armed).map((r) => r.byLambda.get(lambda)!.sigma);
  const raids = rows.filter((r) => r.cls === 'campRaid' && r.armed).map((r) => r.byLambda.get(lambda)!.sigma);
  if (nulls.length === 0 || raids.length === 0) break;
  const sN = rms(nulls.filter((s) => s > DEGENERATE_SIGMA).length ? nulls.filter((s) => s > DEGENERATE_SIGMA) : nulls);
  const sR = rms(raids.filter((s) => s > DEGENERATE_SIGMA).length ? raids.filter((s) => s > DEGENERATE_SIGMA) : raids);
  console.log(
    `λ=${lambda}: σN(pooled)=${sN.toFixed(3)} · σR(pooled)=${sR.toFixed(3)}` +
      ` → ε_mixed = ${(2 * Math.sqrt((sN * sN + sR * sR) / 2)).toFixed(3)}` +
      `  (pure-A/A class ε = ${(2 * sN).toFixed(3)})`,
  );
}

console.log('\n════════ #11 argmax false-act bootstrap (intent at C=1 ≈ 2.3%) ════════');
// Within-context resample: one shared null score + C candidate scores per
// trial, act iff max margin > the E1-fixed class floor at that λ.
function falseActRate(scores: readonly number[], epsilon: number, c: number, rng: RNG): number {
  const trials = 20000;
  let acts = 0;
  for (let t = 0; t < trials; t++) {
    const s0 = scores[rng.int(0, scores.length - 1)]!;
    let act = false;
    for (let i = 0; i < c && !act; i++) {
      act = scores[rng.int(0, scores.length - 1)]! - s0 > epsilon;
    }
    if (act) acts++;
  }
  return acts / trials;
}
for (const row of rows) {
  if (row.armed) continue;
  for (const lambda of [0, 1]) {
    const r = row.byLambda.get(lambda)!;
    if (r.sigma <= DEGENERATE_SIGMA) continue;
    const eps = e1Floor.get(`${row.cls}@${lambda}`)!;
    const rng = new RNG(0x85e0 + lambda);
    const rates = [1, 4, 13].map((c) => `C=${c}: ${(100 * falseActRate(r.scores, eps, c, rng)).toFixed(1)}%`);
    console.log(`${row.label} @ λ=${lambda} (ε=${eps.toFixed(3)}): ${rates.join(' · ')}`);
  }
}
