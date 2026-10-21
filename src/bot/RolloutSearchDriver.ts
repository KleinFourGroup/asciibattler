/**
 * The rollout searcher. Where `TrafficScriptDriver` takes the first script
 * that triggers, this driver measures: at each search point it takes the
 * scripts' proposals as candidates, rolls each forward on a diverged clone
 * (`cloneForRollout`) under the same luck, one seed set per search shared
 * by every candidate, scores each at the horizon (`evaluateCandidate`),
 * and commits the winner only if it beats the null arm, issuing nothing,
 * by the hysteresis margin. The scripts nominate, the rollouts decide, and
 * the null arm is the floor.
 *
 * A search runs at the battle's first decide, when the cadence expires,
 * on any death (the living count on either side drops), and when
 * `armiesInContact` flips. Each trigger is read from the World's state
 * with no event subscription, as the sensors are. There is no dwell: an
 * order stands until the next search, and the ε margin keeps the search
 * from thrashing.
 *
 * The searcher only clears or replaces an order it issued; while an order
 * someone else issued stands (the UI, another driver), it does nothing.
 *
 * The dials are the constructor's options, defaulting to the constants
 * below; the harness's `rolloutSearch` option sets them.
 *
 * Determinism: the searcher owns an RNG (the harness forks one per battle
 * off the world seed) and draws from it only for a search's rollout seeds.
 * The nominations and the triggers are pure reads of state, so the whole
 * decide sequence is a function of the world seed and the config.
 */

import { secondsToTicks } from '../config';
import type { RNG } from '../core/RNG';
import type { WorldCommand } from '../sim/Command';
import type { ObjectiveTeam, TeamObjective } from '../sim/objective';
import type { World } from '../sim/World';
import { evaluateCandidate } from './evaluator';
import { armiesInContact, livingUnits, opposingTeam } from './sensors';
import { sameObjective, TRAFFIC_SCRIPTS, type TrafficScript } from './TrafficScriptDriver';

/** The default dials. Two rollouts a candidate: measured against eight,
 *  the winner differed on about one search in ten, mostly near-ties, and
 *  on no battle's outcome. */
const SEARCH_CADENCE_SECONDS = 4;
const SEARCH_CADENCE_TICKS = secondsToTicks(SEARCH_CADENCE_SECONDS);
const ROLLOUT_HORIZON_SECONDS = 8;
const ROLLOUT_HORIZON_TICKS = secondsToTicks(ROLLOUT_HORIZON_SECONDS);
const ROLLOUTS_PER_CANDIDATE = 2;
/** In score units (HP fractions): a challenger must beat the null arm by
 *  more than a quarter of one unit's health, or nothing is issued. Ties
 *  going to the null arm and the hysteresis are this one rule. */
const HYSTERESIS_EPSILON = 0.25;

export interface RolloutSearchConfig {
  /** The nominators; `TRAFFIC_SCRIPTS` when absent. */
  readonly scripts?: readonly TrafficScript[];
  readonly cadenceTicks?: number;
  readonly horizonTicks?: number;
  readonly rolloutsPerCandidate?: number;
  readonly epsilon?: number;
  /**
   * The K-prefix instrument: each candidate is evaluated seed by seed (the
   * same rollouts, since the evaluator clones per seed either way), the
   * decision is taken from the full-K means, and the prefixes of 2 and 4
   * seeds that are shorter than K decide again, counting the searches
   * where a prefix disagrees with the full K. So one batch at K = 8 gives
   * the flip counts for 2 and 4 directly. Read through `kFlipStats`. Its
   * decisions equal the plain path's (`RolloutSearchDriver.test.ts` pins it
   * on two crafted worlds), but a batch with it on is its own arm and is
   * not claimed byte-equal to one without.
   */
  readonly kFlipTelemetry?: boolean;
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
  /** True while an order this searcher issued stands. */
  private ownStanding = false;
  /** The previous decide's reads, for the edge triggers. */
  private lastLivingCount: number | null = null;
  private lastInContact: boolean | null = null;

  private searches = 0;
  /** Searches that evaluated candidates, for the harness's telemetry and
   *  the tests. */
  get searchCount(): number {
    return this.searches;
  }

  private readonly kFlipTelemetry: boolean;
  private kFlipsByPrefix = new Map<number, number>();
  /** The prefix instrument's counts: the searches evaluated (`searchCount`)
   *  and, by prefix length, how many disagreed with the full-K decision. */
  get kFlipStats(): { searches: number; byPrefix: ReadonlyMap<number, number> } {
    return { searches: this.searches, byPrefix: this.kFlipsByPrefix };
  }

  constructor(team: ObjectiveTeam, rng: RNG, config: RolloutSearchConfig = {}) {
    this.team = team;
    this.rng = rng;
    this.scripts = config.scripts ?? TRAFFIC_SCRIPTS;
    this.cadenceTicks = config.cadenceTicks ?? SEARCH_CADENCE_TICKS;
    this.horizonTicks = config.horizonTicks ?? ROLLOUT_HORIZON_TICKS;
    this.rolloutsPerCandidate = config.rolloutsPerCandidate ?? ROLLOUTS_PER_CANDIDATE;
    this.epsilon = config.epsilon ?? HYSTERESIS_EPSILON;
    this.kFlipTelemetry = config.kFlipTelemetry ?? false;
  }

  decide(world: World): WorldCommand[] {
    const current = world.objectiveFor(this.team);
    // The sim reverts a resolved order to atWill; the bookkeeping follows.
    if (this.ownStanding && current.mode === 'atWill') this.ownStanding = false;

    // The edge triggers, read before the trackers roll forward, so a death
    // since the last call fires on this one.
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

    // Never search against, or clobber, an order someone else issued.
    if (current.mode !== 'atWill' && !this.ownStanding) return [];

    // The null arm (no command, the current trajectory) is implicit; a
    // release challenges only while our own order stands; a proposal equal
    // to the standing objective (that is the null arm) or to an earlier
    // proposal is dropped.
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
    // The situation was assessed either way, so the cadence restarts here
    // and a stretch with no nomination does not re-check every tick.
    this.lastSearchTick = world.currentTick;
    if (challengers.length === 0) return [];

    // One seed set per search, shared by every candidate, so they are
    // compared under the same luck. `fork()` draws one u32 off the
    // searcher's stream per seed.
    this.searches++;
    const seeds: number[] = [];
    for (let k = 0; k < this.rolloutsPerCandidate; k++) {
      seeds.push(this.rng.fork().toJSON().state);
    }
    const spec = { horizonTicks: this.horizonTicks, rolloutSeeds: seeds };

    // The prefix instrument (`kFlipTelemetry`): seed by seed, so each
    // prefix can decide again; the decision itself is the full-K means',
    // equal to the plain path's below.
    if (this.kFlipTelemetry) {
      const perSeed = (cmd: WorldCommand | null): number[] =>
        seeds.map((s) =>
          evaluateCandidate(world, this.team, cmd, {
            horizonTicks: this.horizonTicks,
            rolloutSeeds: [s],
          }),
        );
      const nullSeedScores = perSeed(null);
      const challengerSeedScores = challengers.map((c) => perSeed(c.command));
      const meanOf = (scores: readonly number[], n: number): number => {
        let sum = 0;
        for (let i = 0; i < n; i++) sum += scores[i]!;
        return sum / n;
      };
      // The decision under the first n seeds: a challenger's index, or -1
      // for the null arm. Strictly greater, first wins: the plain path's
      // tie rule, so the two compare like for like.
      const decideAt = (n: number): number => {
        let bestIdx = -1;
        let bestMean = -Infinity;
        for (let i = 0; i < challengerSeedScores.length; i++) {
          const m = meanOf(challengerSeedScores[i]!, n);
          if (m > bestMean) {
            bestMean = m;
            bestIdx = i;
          }
        }
        return bestIdx >= 0 && bestMean > meanOf(nullSeedScores, n) + this.epsilon
          ? bestIdx
          : -1;
      };
      const full = decideAt(seeds.length);
      for (const prefix of [2, 4]) {
        if (prefix >= seeds.length) continue;
        if (decideAt(prefix) !== full) {
          this.kFlipsByPrefix.set(prefix, (this.kFlipsByPrefix.get(prefix) ?? 0) + 1);
        }
      }
      if (full < 0) return [];
      const winner = challengers[full]!;
      this.ownStanding = winner.sets;
      return [winner.command];
    }

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

    // A challenger must beat the null arm by more than ε, or nothing is
    // issued: ties to the null arm and the hysteresis in one rule.
    if (best === null || bestScore <= nullScore + this.epsilon) return [];
    this.ownStanding = best.sets;
    return [best.command];
  }
}
