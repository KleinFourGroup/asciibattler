/**
 * 57f — the portfolio rollout searcher (Rung 2 proper). Replaces the
 * TrafficScriptDriver's fixed-priority arbitration with MEASUREMENT: at
 * each search point, nominate candidate orders, roll each forward on a
 * diverged clone (57d) under identical luck (CRN — one seed set per
 * search, shared by every candidate), score terminally (57e), and commit
 * the winner ONLY if it beats the null arm by the hysteresis margin.
 * Triggers nominate; rollouts arbitrate; the null arm is the structural
 * floor (§57c v2 locks — worklog §57c is the design record).
 *
 * Search points (all edge-triggered off DERIVED state — no event
 * subscriptions, same doctrine as the sensors): the first decide of a
 * battle, cadence expiry, any death (living count on either side drops),
 * or a contact transition (`armiesInContact` flips). The old min-dwell
 * timer is retired here — "commit until the next search" + the ε margin
 * are the anti-thrash machinery.
 *
 * Ownership rule carried over from the §54 driver verbatim: the searcher
 * only ever clears or replaces an order IT issued; a foreign
 * `setObjective` (UI, another driver) silences it entirely.
 *
 * The dials are ctor options DEFAULTING to the §57c v2 locks — the 57g
 * sensitivity arms (K / horizon / ε / audition-everyone) drive them
 * through `HarnessOptions.rolloutSearch` without code surgery. All four
 * defaults are PROVISIONAL pending 57g calibration.
 *
 * Determinism: the searcher owns a dedicated RNG (the harness forks one
 * per battle off the worldSeed) consumed ONLY for CRN seed derivation at
 * search points; nominations and triggers are pure state reads, so the
 * whole decide sequence is a deterministic function of (worldSeed,
 * config). `Math.random` stays ESLint-banned in src/bot/.
 */

import { secondsToTicks } from '../config';
import type { RNG } from '../core/RNG';
import type { WorldCommand } from '../sim/Command';
import type { ObjectiveTeam, TeamObjective } from '../sim/objective';
import type { World } from '../sim/World';
import { evaluateCandidate } from './evaluator';
import { armiesInContact, livingUnits, opposingTeam } from './sensors';
import { sameObjective, TRAFFIC_SCRIPTS, type TrafficScript } from './TrafficScriptDriver';

/** §57c v2 local dials — PROVISIONAL until the 57g calibration arms. */
export const SEARCH_CADENCE_SECONDS = 4;
export const SEARCH_CADENCE_TICKS = secondsToTicks(SEARCH_CADENCE_SECONDS);
export const ROLLOUT_HORIZON_SECONDS = 8;
export const ROLLOUT_HORIZON_TICKS = secondsToTicks(ROLLOUT_HORIZON_SECONDS);
export const ROLLOUTS_PER_CANDIDATE = 2;
/** In score units (HP fractions): a challenger must beat the null arm by
 *  more than a quarter-unit of material or nothing is issued (ties→NULL
 *  and hysteresis are this one rule). */
export const HYSTERESIS_EPSILON = 0.25;

export interface RolloutSearchConfig {
  /** Nominator registry; defaults to the standard TRAFFIC_SCRIPTS. */
  readonly scripts?: readonly TrafficScript[];
  readonly cadenceTicks?: number;
  readonly horizonTicks?: number;
  readonly rolloutsPerCandidate?: number;
  readonly epsilon?: number;
}

export class RolloutSearchDriver {
  private readonly team: ObjectiveTeam;
  private readonly rng: RNG;
  private readonly scripts: readonly TrafficScript[];
  private readonly cadenceTicks: number;
  private readonly horizonTicks: number;
  private readonly rolloutsPerCandidate: number;
  private readonly epsilon: number;

  private lastSearchTick: number | null = null;
  /** True while OUR setObjective stands (the §54 ownership rule). */
  private ownStanding = false;
  /** Edge-trigger trackers — previous decide's derived reads. */
  private lastLivingCount: number | null = null;
  private lastInContact: boolean | null = null;

  private searches = 0;
  /** Searches that actually evaluated candidates (cost telemetry + tests). */
  get searchCount(): number {
    return this.searches;
  }

  constructor(team: ObjectiveTeam, rng: RNG, config: RolloutSearchConfig = {}) {
    this.team = team;
    this.rng = rng;
    this.scripts = config.scripts ?? TRAFFIC_SCRIPTS;
    this.cadenceTicks = config.cadenceTicks ?? SEARCH_CADENCE_TICKS;
    this.horizonTicks = config.horizonTicks ?? ROLLOUT_HORIZON_TICKS;
    this.rolloutsPerCandidate = config.rolloutsPerCandidate ?? ROLLOUTS_PER_CANDIDATE;
    this.epsilon = config.epsilon ?? HYSTERESIS_EPSILON;
  }

  decide(world: World): WorldCommand[] {
    const current = world.objectiveFor(this.team);
    // Sim-side auto-revert (dead target → atWill) drops our bookkeeping.
    if (this.ownStanding && current.mode === 'atWill') this.ownStanding = false;

    // Edge-triggered re-search signals, computed BEFORE the trackers roll
    // forward so a death inside a gated window still fires on this call.
    const living =
      livingUnits(world, this.team).length + livingUnits(world, opposingTeam(this.team)).length;
    const inContact = armiesInContact(world, this.team);
    const deathSeen = this.lastLivingCount !== null && living < this.lastLivingCount;
    const contactFlip = this.lastInContact !== null && inContact !== this.lastInContact;
    this.lastLivingCount = living;
    this.lastInContact = inContact;

    const cadenceDue =
      this.lastSearchTick === null ||
      world.currentTick - this.lastSearchTick >= this.cadenceTicks;
    if (!cadenceDue && !deathSeen && !contactFlip) return [];

    // Foreign-order conservatism: never search against — or clobber — an
    // order someone else issued.
    if (current.mode !== 'atWill' && !this.ownStanding) return [];

    // Nomination. The null arm (no command — continue the current
    // trajectory) is implicit; RELEASE challenges only when our own order
    // stands; script proposals dedupe against the standing objective (that
    // IS the null arm) and against each other.
    const challengers: { readonly command: WorldCommand; readonly sets: boolean }[] = [];
    if (this.ownStanding && current.mode !== 'atWill') {
      challengers.push({ command: { kind: 'clearObjective', team: this.team }, sets: false });
    }
    const proposals: TeamObjective[] = [];
    for (const script of this.scripts) {
      const p = script.nominate
        ? script.nominate(world, this.team)
        : script.evaluate(world, this.team);
      if (p === null || sameObjective(p, current)) continue;
      if (proposals.some((q) => sameObjective(q, p))) continue;
      proposals.push(p);
      challengers.push({
        command: { kind: 'setObjective', team: this.team, objective: p },
        sets: true,
      });
    }
    // The situation was assessed either way — cadence restarts here, so a
    // nomination-free stretch doesn't degenerate into per-tick re-checks.
    this.lastSearchTick = world.currentTick;
    if (challengers.length === 0) return [];

    // CRN: ONE seed set per search, shared by every candidate — the same
    // paired-luck methodology the round's gate tables use. fork() draws
    // one u32 off the searcher stream per seed.
    this.searches++;
    const seeds: number[] = [];
    for (let k = 0; k < this.rolloutsPerCandidate; k++) {
      seeds.push(this.rng.fork().toJSON().state);
    }
    const spec = { horizonTicks: this.horizonTicks, rolloutSeeds: seeds };

    const nullScore = evaluateCandidate(world, this.team, null, spec);
    let best: { readonly command: WorldCommand; readonly sets: boolean } | null = null;
    let bestScore = -Infinity;
    for (const challenger of challengers) {
      const score = evaluateCandidate(world, this.team, challenger.command, spec);
      if (score > bestScore) {
        bestScore = score;
        best = challenger;
      }
    }

    // Ties→NULL + hysteresis in one rule: a challenger must STRICTLY beat
    // the null arm by ε or nothing is issued.
    if (best === null || bestScore <= nullScore + this.epsilon) return [];
    this.ownStanding = best.sets;
    return [best.command];
  }
}
