/**
 * O5 — the objective **coverage driver**: a dev-only, debug-only churn bot that
 * exercises EVERY typed-objective mode on BOTH teams for termination +
 * determinism coverage. The deliberate counterpart to the measurement
 * `ObjectiveProclivity` (`objectiveStrategy.ts`):
 *
 *   - The **measurement** proclivity only ever emits `engage`-on-an-enemy — the
 *     one "always-reasonable steer" — so a pure-random bot's win rate stays a
 *     valid skill-gradient floor. Teaching it `hold`/`focus` would crater that
 *     win rate for reasons that have nothing to do with difficulty (a bot that
 *     holds at random is a near-certain loss), poisoning the measurement.
 *   - This **coverage** driver is the opposite: it churns ALL modes (`atWill` /
 *     `engage` / `hold` / `focus`, enemy + tile targets) on BOTH teams, NEVER to
 *     measure a win rate — only to prove the O1–O4 objective machinery survives
 *     every mode + transition without hanging or going non-deterministic. It is
 *     kept strictly OUT of the balance path (the `--balance-sweep` / `--search`
 *     modes never read it; only `--objective=coverage` on a plain run / `--arena`
 *     does).
 *
 * Two coverage levers the measurement bot lacks:
 *   - **Both teams.** It drives the ENEMY team's objective too, giving O1's
 *     symmetric enemy plumbing (inert in the real game — the enemy is fixed at
 *     `atWill`) its only live exercise.
 *   - **Random 1–20s lifetimes.** Each objective expires after a random window
 *     (the user's call), then a fresh random mode is rolled — so the driver
 *     covers the TRANSITIONS (set → expire → re-set, the auto-revert interplay),
 *     not just a single static mode per battle.
 *
 * Tile targets are uniformly-random cells, INCLUDING unreachable / occupied /
 * walled ones — for coverage we WANT the pathological cases the brief worried
 * about (the boid-around-an-occupied-tile pathology, the `clearOnArrival`
 * permanent-beeline on a wall), since the random expiry guarantees the board
 * churns back out of them within ≤20s regardless.
 *
 * Dev-only fuzz tooling — never imported by `src/`.
 */

import type { RNG } from '../../src/core/RNG';
import { secondsToTicks } from '../../src/config';
import { HEALTH } from '../../src/config/health';
import type { World } from '../../src/sim/World';
import type { WorldCommand } from '../../src/sim/Command';
import type { ObjectiveTeam, TeamObjective } from '../../src/sim/objective';

/** The teams the driver churns, in a FIXED order (player before enemy each
 *  tick) so the command + RNG-draw stream is reproducible given the seed. */
const TEAMS: readonly ObjectiveTeam[] = ['player', 'enemy'];

/** Every mode the churn rolls, uniform. `atWill` is included — it reads as a
 *  clear/revert — so the driver covers the revert path without special-casing. */
const MODES = ['atWill', 'engage', 'hold', 'focus'] as const;

/** Target kind for the target-bearing modes (`engage` / `focus`). */
const TARGET_KINDS = ['enemy', 'tile'] as const;

/** The random objective-lifetime window (the user's 1–20s call), in TICKS.
 *  Converted via the TICK_RATE contract (`secondsToTicks`) so it tracks the
 *  tick rate like every other timing, instead of going stale on a rate change. */
export const COVERAGE_LIFETIME_MIN_TICKS = secondsToTicks(1);
export const COVERAGE_LIFETIME_MAX_TICKS = secondsToTicks(20);

/**
 * Coverage runs get a GENEROUS per-battle tick cap — a multiple of the live
 * per-turn cap (`HEALTH.maxTurnSeconds`). The constant re-targeting means units
 * spend excess time pathing and rarely land a decisive kill inside the normal
 * cap (they'd just cap-draw), so the bigger window lets combat actually resolve
 * across the churn — richer coverage of the decisive paths (kills, focus-target
 * death → revert). It still BACKSTOPS termination: a churning board can't hang,
 * worst case it cap-draws here. Dev-only tooling, so this is a module constant,
 * not a `config/*.json` balance knob.
 */
export const COVERAGE_TURN_MULTIPLIER = 6;
export const COVERAGE_MAX_TICKS = secondsToTicks(HEALTH.maxTurnSeconds) * COVERAGE_TURN_MULTIPLIER;

/**
 * A per-battle, stateful churn bot. Each tick, for each team whose current
 * objective has EXPIRED, it rolls a fresh random `TeamObjective` and a fresh
 * 1–20s lifetime. Driven off a dedicated forked RNG so its draws never perturb
 * the World's sim / combat / spawn streams — same seed → byte-identical command
 * stream (the determinism contract every fuzz bot keeps).
 *
 * NOT an `ObjectiveProclivity`: it carries per-battle state (the expiry timers),
 * drives both teams, and is purely a coverage instrument — so it lives outside
 * the proclivity union and is routed separately at the harness/arena boundary.
 */
export class CoverageObjectiveDriver {
  private readonly rng: RNG;
  // Tick at which each team's current objective expires + is re-rolled. Init 0
  // so the first `decide` (at tick 0) rolls a fresh objective for both teams.
  private readonly expiry: Record<ObjectiveTeam, number> = { player: 0, enemy: 0 };

  constructor(rng: RNG) {
    this.rng = rng;
  }

  /**
   * The `setObjective` commands to enqueue THIS tick — one per team whose
   * objective has expired (so 0, 1, or 2). Call once per tick BEFORE
   * `world.tick()` (mirrors `decideObjectiveCommand`'s placement). Teams are
   * processed in `TEAMS` order so the draw sequence is reproducible; the World's
   * own auto-revert (a dead `engage`/`focus` target → `atWill`) between expiries
   * is left alone — the next expiry simply re-rolls, which IS coverage of the
   * revert path.
   */
  decide(world: World): WorldCommand[] {
    const tick = world.currentTick;
    const out: WorldCommand[] = [];
    for (const team of TEAMS) {
      if (tick < this.expiry[team]) continue;
      const objective = this.rollObjective(world, team);
      this.expiry[team] =
        tick + this.rng.int(COVERAGE_LIFETIME_MIN_TICKS, COVERAGE_LIFETIME_MAX_TICKS);
      out.push({ kind: 'setObjective', team, objective });
    }
    return out;
  }

  /**
   * Roll one uniform-random objective for `team`. `atWill`/`hold` carry no
   * target; `engage`/`focus` pick a 50/50 enemy-unit vs rally-tile target. An
   * enemy pick with no living opponent falls back to a tile so the mode is still
   * exercised. The cell is uniformly random over the whole grid (walls/occupied
   * included — pathological coverage by design).
   */
  private rollObjective(world: World, team: ObjectiveTeam): TeamObjective {
    const mode = this.rng.pick(MODES);
    if (mode === 'atWill') return { mode: 'atWill' };
    if (mode === 'hold') return { mode: 'hold' };

    // engage | focus — needs a target.
    if (this.rng.pick(TARGET_KINDS) === 'enemy') {
      const opposing: ObjectiveTeam = team === 'player' ? 'enemy' : 'player';
      const enemies = world.units.filter((u) => u.team === opposing && u.currentHp > 0);
      if (enemies.length > 0) {
        return { mode, target: { kind: 'enemy', unitId: this.rng.pick(enemies).id } };
      }
      // No living opponent — fall through to a tile target (still draws below).
    }
    const cell = { x: this.rng.int(0, world.gridW - 1), y: this.rng.int(0, world.gridH - 1) };
    return { mode, target: { kind: 'tile', cell } };
  }
}
