/**
 * 53c — replay a recorded `BattleTrace` headlessly, byte-identically.
 *
 * The reconstruction mirrors the two production battle-construction sites
 * exactly (they are already mirrors of each other — the 53c audit note):
 * `new World(bus, new RNG(worldSeed), gridW, gridH)` → `installBattleRules`
 * → `spawnEncounter` (BattleScene performs the same `applyTerrain` →
 * `setupRngFor` → `pickSpawnRegions` → `spawnTeam`×2 sequence off the same
 * single fork; its interleaved render calls touch no RNG). The drive loop
 * mirrors BattleScene's clock body: tick while alive, `resolveAsDraw` once
 * `currentTick` reaches the turn cap — so a draw-at-cap trace replays as a
 * draw at the same tick.
 *
 * Command injection is the one uniform rule the 53c stamp amendment bought:
 * every recorded command is stamped with its EFFECTIVE tick E (the first
 * tick whose unit actions can observe it), so the replay enqueues it just
 * before tick E runs — no parked-vs-in-tick case split, no BattleScene
 * pause state to reproduce.
 *
 * Validation is strict by design: a trace from another schema version or
 * another config fingerprint is REFUSED, never best-effort replayed — a
 * silently-diverging replay is worse than no replay (it poisons paired-seed
 * comparisons, the gauntlet's unit of evidence).
 *
 * Fidelity contract: UNIT-OBSERVABLE identity — same outcome, same tick
 * count, same sim-event stream, byte-identical final `world.toJSON()` (RNG
 * state included). The one thing a replay does NOT reproduce is bus-marker
 * interleaving around parked drains (live emits the command markers between
 * `tick` markers; the replay emits them just after tick E's marker) — zero
 * unit-observable effect, pinned as such by the fidelity test.
 */

import { World } from '../sim/World';
import { RNG } from '../core/RNG';
import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import type { WorldCommand } from '../sim/Command';
import { spawnEncounter } from '../sim/battleSetup';
import { secondsToTicks } from '../config';
import { HEALTH } from '../config/health';
import { configHash } from './configHash';
import type { BattleTrace } from './TraceRecorder';

export interface ReplayResult {
  readonly winner: GameEvents['battle:ended']['winner'];
  /** Final `world.currentTick` — comparable to `trace.outcome.ticks`. */
  readonly ticks: number;
  /** The ended world, for deeper assertions (`toJSON()` comparisons). */
  readonly world: World;
}

export interface ReplayHooks {
  /**
   * 54c — called once per replay tick, just BEFORE that tick's stamped
   * commands are enqueued and the tick runs: the world state the hook sees
   * is exactly what the live player saw when they issued those commands
   * (the trace-mining sample point). `commands` is empty on non-command
   * ticks. OBSERVATION ONLY — a hook that mutates the world or enqueues
   * commands voids the fidelity contract (the replay would diverge from
   * the recorded battle by construction).
   */
  readonly beforeTick?: (world: World, tick: number, commands: readonly WorldCommand[]) => void;
}

/**
 * Rebuild the trace's battle and drive it to its end, feeding the recorded
 * commands at their stamped ticks. Pass a bus to observe the replay's events
 * (fidelity tests subscribe before calling); defaults to a fresh silent one.
 * Throws on a version or configHash mismatch, or if the trace's commands
 * outlive the replayed battle (a fidelity failure by definition — the live
 * battle demonstrably ran longer).
 */
export function replayTrace(
  trace: BattleTrace,
  bus: EventBus<GameEvents> = new EventBus<GameEvents>(),
  hooks: ReplayHooks = {},
): ReplayResult {
  if (trace.version !== 1) {
    throw new Error(`replayTrace: unsupported trace version ${String(trace.version)}`);
  }
  const liveHash = configHash();
  if (trace.configHash !== liveHash) {
    throw new Error(
      `replayTrace: trace was recorded under config ${trace.configHash}, ` +
        `but the loaded config is ${liveHash} — a replay against different ` +
        `balance JSON would silently diverge. Re-record, or check out the ` +
        `matching config.`,
    );
  }

  const { encounter } = trace;
  const world = new World(bus, new RNG(encounter.worldSeed), encounter.gridW, encounter.gridH);
  world.installBattleRules(encounter.battleRules ?? []);
  spawnEncounter(world, encounter);

  const byTick = new Map<number, WorldCommand[]>();
  for (const { tick, command } of trace.commands) {
    const bucket = byTick.get(tick);
    if (bucket) bucket.push(command);
    else byTick.set(tick, [command]);
  }

  let winner: GameEvents['battle:ended']['winner'] | null = null;
  const unsubscribe = bus.on('battle:ended', (payload) => {
    winner = payload.winner;
  });

  // BattleScene's clock body, verbatim semantics (N2's cap unification).
  const maxTurnTicks = secondsToTicks(HEALTH.maxTurnSeconds);
  while (!world.ended) {
    const next = world.currentTick + 1;
    const stamped = byTick.get(next) ?? [];
    // 54c — the observation hook fires on the pre-tick state (what the live
    // player saw when issuing this tick's commands). See `ReplayHooks`.
    hooks.beforeTick?.(world, next, stamped);
    for (const command of stamped) world.enqueueCommand(command);
    byTick.delete(next);
    world.tick();
    if (!world.ended && world.currentTick >= maxTurnTicks) world.resolveAsDraw();
  }
  unsubscribe();

  if (byTick.size > 0) {
    const leftover = [...byTick.keys()].sort((a, b) => a - b);
    throw new Error(
      `replayTrace: battle ended at tick ${world.currentTick} but the trace ` +
        `still holds commands stamped for tick(s) ${leftover.join(', ')} — ` +
        `the replay diverged from the recorded battle.`,
    );
  }
  if (winner === null) {
    throw new Error('replayTrace: battle ended without a battle:ended event');
  }
  return { winner, ticks: world.currentTick, world };
}
