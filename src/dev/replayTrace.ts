/**
 * Replay a recorded `BattleTrace` headlessly, byte-identically.
 *
 * The reconstruction is the battle's own: `battleWorld`, then
 * `spawnEncounter` (sim/battleSetup.ts), which runs the sequence BattleScene
 * runs (`applyTerrain`, `setupRngFor`, `pickSpawnRegions`, `spawnTeam`
 * twice) on the same setup stream; BattleScene's interleaved render calls
 * touch no RNG. The drive loop is BattleScene's clock body, `tickTurn` while
 * alive, so a draw-at-cap trace replays as a draw at the same tick.
 *
 * Command injection is one uniform rule: every recorded command is stamped
 * with its effective tick E (the first tick whose unit actions can observe
 * it), so the replay enqueues it just before tick E runs, with no
 * parked-or-in-tick case split and no BattleScene pause state to reproduce.
 *
 * Validation is strict by design: a trace from another schema version or
 * another config fingerprint is refused, never best-effort replayed. A
 * silently diverging replay is worse than none, since it poisons paired-seed
 * comparisons, the gauntlet's unit of evidence.
 *
 * Fidelity contract: unit-observable identity, so the same outcome, the same
 * tick count, the same sim-event stream and a byte-identical final
 * `world.toJSON()` (RNG state included). The one thing a replay does not
 * reproduce is the bus markers' interleaving around a parked drain (live
 * emits the command markers between `tick` markers; the replay emits them
 * just after tick E's marker), which no unit can observe, as the fidelity
 * test pins.
 */

import type { World } from '../sim/World';
import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import type { WorldCommand } from '../sim/Command';
import { MAX_TURN_TICKS, battleWorld, spawnEncounter, tickTurn } from '../sim/battleSetup';
import { configHash } from '../config/configHash';
import type { BattleTrace } from './TraceRecorder';

interface ReplayResult {
  readonly winner: GameEvents['battle:ended']['winner'];
  /** Final `world.currentTick`, comparable to `trace.outcome.ticks`. */
  readonly ticks: number;
  /** The ended world, for deeper assertions (`toJSON()` comparisons). */
  readonly world: World;
}

interface ReplayHooks {
  /**
   * Called once per replay tick, just before that tick's stamped commands
   * are enqueued and the tick runs: the world state the hook sees is what
   * the live player saw when they issued those commands (the gauntlet's
   * trace-mining sample point, tests/gauntlet/traceMine.ts). `commands` is
   * empty on a tick with none. Observation only: a hook that mutates the
   * world or enqueues commands voids the fidelity contract, since the
   * replay would diverge from the recorded battle by construction.
   */
  readonly beforeTick?: (world: World, tick: number, commands: readonly WorldCommand[]) => void;
}

/**
 * Rebuild the trace's battle and drive it to its end, feeding the recorded
 * commands at their stamped ticks. Pass a bus to observe the replay's events
 * (fidelity tests subscribe before calling); defaults to a fresh silent one.
 * Throws on a version or configHash mismatch, or if the trace's commands
 * outlive the replayed battle (a fidelity failure by definition, since the
 * live battle ran longer).
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
  const world = battleWorld(bus, encounter);
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

  // BattleScene's clock body, the same in effect. The turn's cap ends every
  // battle within MAX_TURN_TICKS ticks, so a count past it is a tick that
  // stopped advancing, and fails rather than spins.
  for (let n = 0; !world.ended; n++) {
    if (n >= MAX_TURN_TICKS) throw new Error(`replayTrace: the battle ran past its cap of ${MAX_TURN_TICKS} ticks`);
    const next = world.currentTick + 1;
    const stamped = byTick.get(next) ?? [];
    // The observation hook fires on the pre-tick state (what the live player
    // saw when issuing this tick's commands). See `ReplayHooks`.
    hooks.beforeTick?.(world, next, stamped);
    for (const command of stamped) world.enqueueCommand(command);
    byTick.delete(next);
    tickTurn(world);
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
