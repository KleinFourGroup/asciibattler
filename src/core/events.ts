/**
 * The canonical event catalog. Adding a new event? Add it here first so the
 * type system can guide every emitter and subscriber. Naming convention:
 * `subject:verbed` (past tense, lowercase, colon-separated).
 *
 * Mirrors ARCHITECTURE.md "Event catalog". When the two drift, this file
 * wins — but please update the doc in the same commit.
 *
 * A2: imperative inputs (player wants to enter a node, pick a recruit,
 * reset the run) moved off the bus and onto the `RunCommand` channel in
 * `src/run/Command.ts`. The bus carries only outputs ("X just happened")
 * — that's why every name here is past-tense.
 */

import type { GridCoord } from './types';
import type { Team, UnitStats, UnitTemplate } from '../sim/Unit';
import type { Archetype } from '../sim/archetypes';

export interface GameEvents extends Record<string, unknown> {
  tick: { tick: number };

  'battle:started': { worldSeed: number };
  /**
   * E4: payload extended with `xpAwards` — one entry per surviving
   * player unit on a player victory. Empty array on enemy victory or
   * mutual annihilation (no awards). `damageDealt` is the raw HP-loss
   * tally the World accumulated for that unit; `xpGained` is the
   * `LEVELING`-resolved value (`xpFlatPerSurvivor + xpPerDamage ×
   * damageDealt`). Run banks it into the persistent roster.
   *
   * Including damageDealt + xpGained lets PromotionScene surface
   * "you dealt X damage, earned Y XP" without re-querying the World.
   */
  'battle:ended': {
    winner: 'player' | 'enemy';
    xpAwards: readonly {
      unitId: number;
      /**
       * Index into `Run.team` for the surviving player unit. Null for
       * the rare test fixture that spawned a player unit directly via
       * `World.spawnUnit` without threading rosterIndex; Run skips
       * those.
       */
      rosterIndex: number | null;
      damageDealt: number;
      xpGained: number;
    }[];
  };

  /**
   * Fires once per unit appearing on the grid. `instant: true` for
   * setup-time spawns (battle start, initial team layout); `false` for
   * D5.C overflow-queue spawns that come in mid-battle and visually
   * lerp their alpha 0 → 1 over the SpawnAction lockout window.
   */
  'unit:spawned': { unitId: number; instant: boolean };
  'unit:moved': {
    unitId: number;
    from: GridCoord;
    to: GridCoord;
    durationTicks: number;
  };
  /**
   * E1: `crit` flags whether AttackAction's start-time crit roll landed.
   * `damage` is the resolved post-crit value (already multiplied by
   * `STATS.critMult` when `crit === true`), so subscribers that only
   * care about HP change don't need to re-multiply. The dedicated flag
   * is what E6's hitsplats key off to render crits in red.
   */
  'unit:attacked': {
    attackerId: number;
    targetId: number;
    damage: number;
    crit: boolean;
  };
  /**
   * D7.B: per-tick chip damage from standing on a `fire` tile. Separate
   * event from `unit:attacked` so consumers can branch cleanly without
   * an `attackerId: null` / sentinel dance — fire damage has no
   * attacker. Subscribers that need to refresh visible HP state should
   * subscribe to all three of `unit:attacked` / `unit:burned` /
   * `unit:healed`. Emits AFTER currentHp is updated and BEFORE
   * `unit:died` if the damage kills.
   */
  'unit:burned': { unitId: number; damage: number };
  /** D7.B: per-tick chip heal from standing on a `healing` tile. Emits
   *  AFTER currentHp is updated; healing is clamped at maxHp, so the
   *  emitted `amount` is the actual HP delta (0 when the unit is
   *  already full — we still emit so subscribers can debounce / log). */
  'unit:healed': { unitId: number; amount: number };
  /**
   * Fires once per unit removal from the world. `team` is included so
   * subscribers can branch on combatant vs neutral (wall / environment)
   * deaths without re-querying the world — by the time this event fires
   * the unit has already been spliced out of `world.units` and is no
   * longer findable.
   */
  'unit:died': { unitId: number; team: Team };

  /**
   * E7.C — a mage's `magic_bolt` detonated at `center` (the ground-targeted
   * blast cell). Fires exactly ONCE per cast from `MagicBoltAction.applyEffect`,
   * regardless of how many units the blast hit — including zero (a whiff) —
   * carrying the caster + center so the render + audio layers can play a
   * single impact (one projectile → explosion + one cast sound) instead of
   * keying off the per-target `unit:attacked` stream, which fires once per
   * victim (reads as multishot) and not at all on a miss. The damage itself
   * still rides `unit:attacked` per hit, so hitsplats / HP bars / the XP
   * ledger are unchanged.
   */
  'magic:detonated': { casterId: number; center: GridCoord };

  'run:started': { seed: number };
  'run:victory': Record<string, never>;
  'run:defeated': Record<string, never>;

  'recruit:offered': { units: UnitTemplate[] };

  /**
   * E4: one or more player roster units crossed an XP threshold during
   * battle-end banking. Game swaps to PromotionScene which renders the
   * deltas; dismiss → recruit offer (existing flow) or run:victory at
   * terminal. The payload is the closed set of "what changed" snapshots
   * the scene needs — no follow-up world query required.
   */
  'promotion:pending': { promotions: readonly PromotionInfo[] };
}

/**
 * E4 — one roster slot's level-up details. Mirrors what PromotionScene
 * renders: glyph + archetype + old→new level + per-stat deltas. Stats
 * before/after are kept whole (not just the deltas) so the scene can
 * show "STR 6 → 7" rather than just "+1 STR".
 */
export interface PromotionInfo {
  rosterIndex: number;
  archetype: Archetype;
  glyph: string;
  oldLevel: number;
  newLevel: number;
  oldStats: UnitStats;
  newStats: UnitStats;
}
