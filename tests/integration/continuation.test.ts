import { describe, expect, it } from 'vitest';
import { secondsToTicks } from '../../src/config';
import { HEALTH } from '../../src/config/health';
import { EventBus } from '../../src/core/EventBus';
import type { GameEvents } from '../../src/core/events';
import { RNG } from '../../src/core/RNG';
import { PHASE_ROWS, pickerFor } from '../../src/dev/probe/drive';
import { Run, type RunPhase, type RunSnapshot } from '../../src/run/Run';
import type { RunCommand } from '../../src/run/Command';
import { parseRunConfig, type RunConfig } from '../../src/run/RunConfig';
import { World } from '../../src/sim/World';
import { spawnEncounter } from '../../src/sim/battleSetup';

// 115b — THE CONTINUATION CHECK (Round 8 spec D3; WORKLOG §115, call 5). A
// run is saved at every gate, so a player who closes the tab anywhere comes
// back to it. This plays a run straight through, then sends the same
// commands to a run that is turned to text and loaded again, on a fresh bus,
// at every gate, and holds the two equal byte for byte at each gate and at
// the end. The round trip alone (text → fromJSON → toJSON) compares the
// save code with the load code, so it can't see state that both leave out;
// a continuation can, because the left-out state changes what happens next.

/** A gate: a phase the run waits in for a command, where the game saves. */
const isGate = (phase: RunPhase): boolean => phase !== 'battle' && phase !== 'turn-outcome';

type Step = { readonly command: RunCommand } | 'fight';

const maxTurnTicks = secondsToTicks(HEALTH.maxTurnSeconds);

/** A fresh bus with the battle table the game's BattleScene stands for. */
function table(): { bus: EventBus<GameEvents>; fight: () => void } {
  const bus = new EventBus<GameEvents>();
  let world: World | null = null;
  bus.on('battle:started', ({ worldSeed, encounter }) => {
    world = new World(bus, new RNG(worldSeed), encounter.gridW, encounter.gridH);
    world.installBattleRules(encounter.battleRules ?? []);
    spawnEncounter(world, encounter);
  });
  const fight = (): void => {
    const w = world as World | null;
    if (w === null) throw new Error('continuation: a fight with no World');
    while (!w.ended) {
      w.tick();
      if (!w.ended && w.currentTick >= maxTurnTicks) w.resolveAsDraw();
    }
  };
  return { bus, fight };
}

const text = (run: Run): string => JSON.stringify(run.toJSON());

interface Straight {
  readonly steps: readonly Step[];
  /** The run's text at each gate, in order, with the phase. */
  readonly gates: ReadonlyArray<{ readonly phase: RunPhase; readonly text: string }>;
  readonly end: string;
}

/** Play a run straight through by the pane kit's rows, keeping its steps. */
function straight(seed: number, config: RunConfig): Straight {
  const { bus, fight } = table();
  const run = new Run(seed, bus, config);
  run.pauseAtTurnGates = true;
  const pick = pickerFor('seeded', seed);
  const steps: Step[] = [];
  const gates: Array<{ phase: RunPhase; text: string }> = [];
  for (let sent = 0; sent < 5000; sent++) {
    if (isGate(run.phase)) gates.push({ phase: run.phase, text: text(run) });
    const step = PHASE_ROWS[run.phase](run, pick);
    if (step === 'end') return { steps, gates, end: text(run) };
    steps.push(step);
    if (step === 'fight') fight();
    else run.dispatch(step.command);
  }
  throw new Error('continuation: 5000 steps without the run ending');
}

interface Continued {
  /** The first gate whose text differed from the straight run's, or null. */
  readonly divergence: { readonly gate: number; readonly phase: RunPhase; readonly expected: RunPhase } | null;
  readonly reloads: number;
  readonly end: string;
}

/**
 * Send the straight run's steps to a run that is saved to text and loaded
 * again at every gate, with `reloadConfig` (the game passes the run's own
 * dials). `plant` may edit the text before the load (a control).
 */
function continued(
  seed: number,
  config: RunConfig,
  path: Straight,
  reloadConfig: RunConfig | undefined,
  plant?: (gate: number, snap: RunSnapshot) => void,
): Continued {
  let current = table();
  let run = new Run(seed, current.bus, config);
  run.pauseAtTurnGates = true;
  let gate = 0;
  for (let i = 0; i <= path.steps.length; i++) {
    if (isGate(run.phase)) {
      const saved = text(run);
      const expected = path.gates[gate];
      if (expected === undefined || saved !== expected.text) {
        return { divergence: { gate, phase: run.phase, expected: expected?.phase ?? run.phase }, reloads: gate, end: saved };
      }
      const snap = JSON.parse(saved) as RunSnapshot;
      plant?.(gate, snap);
      run.dispose();
      current = table();
      run = Run.fromJSON(snap, current.bus, reloadConfig);
      run.pauseAtTurnGates = true;
      gate++;
    }
    const step = path.steps[i];
    if (step === undefined) break;
    if (step === 'fight') current.fight();
    else run.dispatch(step.command);
  }
  return { divergence: gate === path.gates.length ? null : { gate, phase: run.phase, expected: run.phase }, reloads: gate, end: text(run) };
}

// Between them these cross every gate kind (WORKLOG §115a's step zero: a
// `sectorHops=2` run clears a sector in about fifteen battles; the port
// needs a full-length run), with dials and without.
const RUNS: ReadonlyArray<readonly [number, string]> = [
  [2, 'sectorHops=2&character=soldier'],
  [1, 'sectorHops=2&character=soldier'],
  [1, 'character=soldier'],
  [7, 'hops=3&layout=procedural&character=priest'],
  // 117b — a run on the ladder. Its only dials are the level and the
  // character, and both are in the snapshot, so it also reloads with no
  // config at all (below).
  [5, 'escalation=3&character=gambler'],
];
const ESCALATED = RUNS.length - 1;

describe('115b — the continuation check: a run saved and loaded at every gate plays as the run played straight through', () => {
  const played = RUNS.map(([seed, dials]) => {
    const config = parseRunConfig(new URLSearchParams(dials));
    return { seed, dials, config, path: straight(seed, config) };
  });

  it.each(played.map((p) => [`seed ${p.seed}, ${p.dials}`, p] as const))('%s', (_name, { seed, config, path }) => {
    const result = continued(seed, config, path, config);
    expect(result.divergence).toBeNull();
    expect(result.reloads).toBe(path.gates.length);
    expect(result.end).toBe(path.end);
  });

  it('crosses every gate kind', () => {
    const met = new Set(played.flatMap((p) => p.path.gates.map((g) => g.phase)));
    expect([...met].sort()).toEqual(
      ['complete', 'defeat', 'event', 'map', 'port', 'promotion', 'recruit', 'rest', 'reward', 'sectorCleared', 'turn-intro'],
    );
  });

  it('control: the dials withheld from the reload fail at a named gate', () => {
    const run = played[0]!; // sectorHops=2: the next sector's map is two hops only with the dial
    const result = continued(run.seed, run.config, run.path, undefined);
    expect(result.divergence?.phase).toBe('sectorCleared');
  });

  it('the Escalation level rides the snapshot: the run on the ladder reloads with no config and plays the same', () => {
    const run = played[ESCALATED]!;
    expect(run.config.escalation).toBe(3);
    const result = continued(run.seed, run.config, run.path, undefined);
    expect(result.divergence).toBeNull();
    expect(result.reloads).toBe(run.path.gates.length);
    expect(result.end).toBe(run.path.end);
  });

  it('control: the level set to 0 in the text fails at the next gate, though the config still names 3', () => {
    const run = played[ESCALATED]!;
    // Changed at the first gate only, so the text compared at the next gate
    // is one the changed run wrote. A load that took the level from its
    // config would write 3 there and pass.
    const result = continued(run.seed, run.config, run.path, run.config, (gate, snap) => {
      if (gate === 0) snap.escalation = 0;
    });
    expect(result.divergence?.gate).toBe(1);
  });

  it('control: a field blanked in the text fails at the next gate', () => {
    const run = played[2]!;
    const at = run.path.gates.findIndex((g) => g.phase === 'reward');
    const result = continued(run.seed, run.config, run.path, run.config, (gate, snap) => {
      if (gate === at) snap.fallenLedger = [];
    });
    expect(result.divergence?.gate).toBe(at + 1);
  });
});
