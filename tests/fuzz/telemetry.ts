/**
 * H7c — balance-sweep telemetry. The harness gathers *outcomes* (win/loss,
 * hop, deaths) on every run; the balance sweep needs *mechanism* — the
 * per-archetype damage/healing/deaths/picks/composition + per-turn pool chips +
 * per-battle XP that diagnose WHICH unit is over/under-powered and whether the
 * no-attrition health pools (not the per-turn difficulty) drive the win rate.
 *
 * This is pure observation: a `TelemetryAccumulator` subscribes to the same bus
 * the harness already drives and tallies what flies past. It never emits, so it
 * cannot perturb the deterministic sim or shift the fuzz baseline — and it's
 * opt-in (`HarnessOptions.telemetry`), so the default sweep + the `--search`
 * hot-path pay nothing.
 *
 * Scope (the OP-unit read): per-archetype damage/healing/deaths/xp are
 * **player-side only** — "is *my* melee overpowered?" is the question, and
 * enemies are only ever melee/ranged anyway. Pool chips carry both sides (the
 * pool-ratio confound is inherently two-sided). Recruit picks + final
 * composition are player-side by definition.
 *
 * Reading it (per BALANCE.md): the winning-vector archetype *affinities* are the
 * primary OP signal; this telemetry **corroborates independently** —
 * melee-OP ⇒ high damage + low deaths; healer-OP ⇒ high healing + self-leveling
 * via `xpPerHealing`. Pool chips diagnose the pool-ratio confound; XP-by-hop
 * drives the leveling pass.
 */

import type { Team } from '../../src/sim/Unit';
import { ALL_ARCHETYPES } from '../../src/sim/archetypes';
import type { Archetype } from '../../src/sim/archetypes';

/** Player-side per-archetype tallies for one run (or summed across runs). */
export interface ArchetypeTelemetry {
  /** Σ `unit:attacked` damage dealt by player units of this archetype. */
  damageDealt: number;
  /**
   * Σ combat HP LOST by player units of this archetype — the victim side of
   * `unit:attacked`. The event's `damage` is already post-`defense` mitigation
   * (`max(minDamage, raw − defense)`), and environmental/fire chip deliberately
   * bypasses that path, so this is **combat HP absorbed, net of defense** — the
   * survivability signal that separates "melee is tanky via defense/HP" from
   * "melee just out-damages." Pairs with `deaths` + the known con/defense stats.
   */
  damageTaken: number;
  /** Σ `unit:healed` amount credited to a player healer of this archetype
   *  (ability heals only — `healerId` non-null; tile chip-heals have no caster). */
  healingDone: number;
  /**
   * Times a player unit of this archetype was FIELDED — one per spawn, across
   * every turn (incl. mid-battle overflow spawns). The true denominator for
   * "per-unit" reads: aggregate damage/heal conflate per-unit power with how
   * many got deployed, so `damageDealt / deployments` is the honest per-fielding
   * number — and it's the ONLY way to read an archetype the optimizer rarely
   * fields (force it onto the roster, then read its per-deployment output).
   */
  deployments: number;
  /** Player units of this archetype that died across the run. */
  deaths: number;
  /** Times this archetype was recruited (from the run's recruit log). */
  recruitPicks: number;
  /** Count of this archetype in the final roster (`run.team` at run end). */
  finalCount: number;
  /** Σ XP banked to this archetype's roster slots (`battle:ended.xpAwards`). */
  xpEarned: number;
}

/** One turn's pool chip — the Σ`power` each side's survivors dealt the opposing
 *  health pool (`battle:ended.survivorPower`). One entry per turn, in order. */
export interface PoolChip {
  hop: number;
  player: number;
  enemy: number;
}

export interface RunTelemetry {
  /** Keyed by every archetype in `ALL_ARCHETYPES` (zero-filled), so a consumer
   *  never has to null-check a missing key. */
  perArchetype: Record<Archetype, ArchetypeTelemetry>;
  poolChips: PoolChip[];
}

interface UnitMeta {
  team: Team;
  archetype: Archetype;
}

function emptyArchetypeTelemetry(): ArchetypeTelemetry {
  return {
    damageDealt: 0,
    damageTaken: 0,
    healingDone: 0,
    deployments: 0,
    deaths: 0,
    recruitPicks: 0,
    finalCount: 0,
    xpEarned: 0,
  };
}

function emptyPerArchetype(): Record<Archetype, ArchetypeTelemetry> {
  return Object.fromEntries(
    ALL_ARCHETYPES.map((a) => [a, emptyArchetypeTelemetry()]),
  ) as Record<Archetype, ArchetypeTelemetry>;
}

/**
 * Accumulates one run's telemetry. The harness feeds it unit metadata (team +
 * archetype, captured at spawn) and combat/turn events; `finish` folds in the
 * recruit log + final roster (which the harness already tracks) and returns the
 * immutable `RunTelemetry`.
 *
 * Only PLAYER units count toward the per-archetype combat tallies — the
 * `meta` lookup gates on team, so enemy attacks/deaths are ignored. A unit not
 * in `meta` (shouldn't happen for combatants — every spawn registers) is also
 * skipped rather than throwing, keeping telemetry strictly non-fatal.
 */
export class TelemetryAccumulator {
  private readonly meta = new Map<number, UnitMeta>();
  private readonly perArchetype = emptyPerArchetype();
  private readonly poolChips: PoolChip[] = [];

  /** Register a combatant at spawn. `'environment'` neutrals are filtered by
   *  the caller (they carry no `Archetype`), so `archetype` here is always a
   *  real combatant archetype. */
  registerUnit(unitId: number, team: Team, archetype: Archetype): void {
    this.meta.set(unitId, { team, archetype });
    // Each player spawn IS a deployment (a fielding) — the per-unit denominator.
    if (team === 'player') this.perArchetype[archetype].deployments += 1;
  }

  recordAttack(attackerId: number, damage: number): void {
    const m = this.meta.get(attackerId);
    if (m?.team === 'player') this.perArchetype[m.archetype].damageDealt += damage;
  }

  /** The victim side of an attack — `damage` is post-defense actual HP lost. */
  recordDamageTaken(targetId: number, damage: number): void {
    const m = this.meta.get(targetId);
    if (m?.team === 'player') this.perArchetype[m.archetype].damageTaken += damage;
  }

  recordHeal(healerId: number, amount: number): void {
    const m = this.meta.get(healerId);
    if (m?.team === 'player') this.perArchetype[m.archetype].healingDone += amount;
  }

  recordDeath(unitId: number): void {
    const m = this.meta.get(unitId);
    if (m?.team === 'player') this.perArchetype[m.archetype].deaths += 1;
  }

  recordXp(unitId: number, xpGained: number): void {
    const m = this.meta.get(unitId);
    if (m?.team === 'player') this.perArchetype[m.archetype].xpEarned += xpGained;
  }

  /** One turn resolved — record both sides' pool chip. */
  recordTurnChip(hop: number, player: number, enemy: number): void {
    this.poolChips.push({ hop, player, enemy });
  }

  /**
   * Fold in the recruit picks + final roster composition (both player-side,
   * both already tracked by the harness) and return the run's telemetry.
   */
  finish(
    recruitArchetypes: readonly Archetype[],
    finalRosterArchetypes: readonly Archetype[],
  ): RunTelemetry {
    for (const a of recruitArchetypes) this.perArchetype[a].recruitPicks += 1;
    for (const a of finalRosterArchetypes) this.perArchetype[a].finalCount += 1;
    return { perArchetype: this.perArchetype, poolChips: this.poolChips };
  }
}

// ── cross-run aggregation (the sweep summarizes a telemetry set per grid point) ──

export interface AggregatedArchetype extends ArchetypeTelemetry {
  /** Mean deaths PER RUN — `deaths / runs`. The raw fields are run totals; this
   *  is the per-run mean so it reads the same regardless of seed count. */
  deathsPerRun: number;
}

export interface AggregatedTelemetry {
  runs: number;
  /** Per-archetype run TOTALS summed over the set, plus a per-run death mean. */
  perArchetype: Record<Archetype, AggregatedArchetype>;
  /** Mean pool chip per turn across every turn in the set (diagnoses the
   *  pool-ratio confound — player vs enemy chip rate). */
  meanPoolChip: { player: number; enemy: number; turns: number };
}

/**
 * Sum a set of run telemetries (e.g. the winning vector re-run over the train
 * seeds) into one per-grid-point summary. Per-archetype fields are summed;
 * `deathsPerRun` + `meanPoolChip` are the normalized reads the sweep table
 * surfaces.
 */
export function aggregateTelemetry(telemetries: readonly RunTelemetry[]): AggregatedTelemetry {
  const runs = telemetries.length;
  const perArchetype = Object.fromEntries(
    ALL_ARCHETYPES.map((a) => [a, { ...emptyArchetypeTelemetry(), deathsPerRun: 0 }]),
  ) as Record<Archetype, AggregatedArchetype>;

  let chipPlayer = 0;
  let chipEnemy = 0;
  let turns = 0;
  for (const t of telemetries) {
    for (const a of ALL_ARCHETYPES) {
      const dst = perArchetype[a];
      const src = t.perArchetype[a];
      dst.damageDealt += src.damageDealt;
      dst.damageTaken += src.damageTaken;
      dst.healingDone += src.healingDone;
      dst.deployments += src.deployments;
      dst.deaths += src.deaths;
      dst.recruitPicks += src.recruitPicks;
      dst.finalCount += src.finalCount;
      dst.xpEarned += src.xpEarned;
    }
    for (const c of t.poolChips) {
      chipPlayer += c.player;
      chipEnemy += c.enemy;
      turns += 1;
    }
  }
  for (const a of ALL_ARCHETYPES) {
    perArchetype[a].deathsPerRun = runs === 0 ? 0 : perArchetype[a].deaths / runs;
  }
  return {
    runs,
    perArchetype,
    meanPoolChip: {
      player: turns === 0 ? 0 : chipPlayer / turns,
      enemy: turns === 0 ? 0 : chipEnemy / turns,
      turns,
    },
  };
}
