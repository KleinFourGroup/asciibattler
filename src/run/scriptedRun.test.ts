// The scripted run's per-hop entries in a live Run (RunScript.ts, Run.ts):
// a numbered hop's kind, encounter, layout and event, the refusals at
// construction, and the warnings. Each holds against a control on the same
// seed without the entry, so an entry the Run ignored would fail here.
import { describe, expect, it } from 'vitest';
import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import { getEncounter } from '../config/encounters';
import { PHASE_ROWS, frontierOf } from '../dev/probe/drive';
import { Run } from './Run';
import type { RunConfig } from './RunConfig';
import type { ScriptEntry } from './RunScript';

const HOPS = 11;

function runOf(seed: number, config: RunConfig = {}): { run: Run; bus: EventBus<GameEvents> } {
  const bus = new EventBus<GameEvents>();
  return { run: new Run(seed, bus, { hopCount: HOPS, ...config }), bus };
}

const kindsOnHop = (run: Run, hop: number): string[] =>
  run.nodeMap.hops[hop - 1]!.map((id) => run.nodeMap.nodes.find((n) => n.id === id)!.kind);

/**
 * Play the first choice of every gate, winning each fight outright, until
 * the run has entered a node on `hop` (1 up). The node is the first of the
 * frontier, so the test reads the run as it stands there.
 */
function enterHop(run: Run, bus: EventBus<GameEvents>, hop: number): void {
  for (let step = 0; step < 400; step++) {
    if (run.phase === 'map') {
      const next = frontierOf(run)[0]!;
      const at = run.nodeMap.hops.findIndex((h) => h.includes(next)) + 1;
      run.dispatch({ kind: 'enterNode', nodeId: next });
      if (at === hop) return;
      continue;
    }
    const row = PHASE_ROWS[run.phase](run, () => 0);
    if (row === 'end') throw new Error(`enterHop: the run ended before hop ${hop}`);
    if (row === 'fight') {
      bus.emit('battle:ended', {
        winner: 'player',
        xpAwards: [],
        survivorPower: { player: 1_000, enemy: 0 },
        fallenPower: { player: 0, enemy: 1_000 },
      });
    } else {
      run.dispatch(row.command);
    }
  }
  throw new Error(`enterHop: no node on hop ${hop} after 400 steps`);
}

describe('a numbered hop\'s kind', () => {
  it('is stamped on every node of the hop, and moves no other node', () => {
    const script: ScriptEntry[] = [{ hop: 4, kind: 'rest' }];
    const plain = runOf(3).run;
    const scripted = runOf(3, { script }).run;
    // The control: the seed's own hop 4 is not all rests.
    expect(kindsOnHop(plain, 4).every((k) => k === 'rest')).toBe(false);
    expect(kindsOnHop(scripted, 4).every((k) => k === 'rest')).toBe(true);
    const onHop4 = new Set(scripted.nodeMap.hops[3]);
    const others = (r: Run): unknown => r.nodeMap.nodes.filter((n) => !onHop4.has(n.id));
    expect(others(scripted)).toEqual(others(plain));
    expect(scripted.nodeMap.edges).toEqual(plain.nodeMap.edges);
  });

  it('is ignored on the boss\'s hop, with a warning', () => {
    const { run } = runOf(3, { script: [{ hop: HOPS, kind: 'elite' }] });
    expect(kindsOnHop(run, HOPS)).toEqual(['boss']);
    expect(run.scriptWarnings.join('\n')).toMatch(/hop 11: the elite is ignored on the boss's hop/);
  });
});

describe('a numbered hop\'s encounter', () => {
  const champions = getEncounter('brigand-champions')!;

  it('makes the hop its kind and is the fight there', () => {
    const { run, bus } = runOf(5, { script: [{ hop: 3, encounter: champions.id }] });
    expect(kindsOnHop(run, 3).every((k) => k === 'elite')).toBe(true);
    enterHop(run, bus, 3);
    expect(run.currentEncounterName).toBe(champions.name);
    // The control: the same walk without the entry fights something else.
    const plain = runOf(5);
    enterHop(plain.run, plain.bus, 3);
    expect(plain.run.currentEncounterName).not.toBe(champions.name);
  });

  it('a boss encounter on the last hop is the act\'s boss', () => {
    const { run } = runOf(5, { script: [{ hop: HOPS, encounter: 'banditQueen' }] });
    expect(run.bossForewarning.name).toBe(getEncounter('banditQueen')!.name);
  });
});

describe('a numbered hop\'s layout', () => {
  it('is the board of the hop\'s fight, and of no other hop\'s', () => {
    const fights: ScriptEntry[] = [
      { hop: 2, kind: 'battle' },
      { hop: 3, kind: 'battle' },
    ];
    const a = runOf(9, { script: [...fights, { hop: 2, layout: 'isthmus' }] });
    const b = runOf(9, { script: fights });
    enterHop(a.run, a.bus, 2);
    enterHop(b.run, b.bus, 2);
    expect(a.run.encounterMap?.layoutId).toBe('isthmus');
    // The control: the seed's own board at hop 2 is another.
    expect(b.run.encounterMap?.layoutId).not.toBe('isthmus');
    enterHop(a.run, a.bus, 3);
    enterHop(b.run, b.bus, 3);
    expect(a.run.encounterMap).toEqual(b.run.encounterMap);
  });

  it('warns when the route takes the hop past its fight', () => {
    const { run, bus } = runOf(9, { script: [{ hop: 2, kind: 'rest', layout: 'isthmus' }] });
    const heard: string[] = [];
    bus.on('script:warning', (e) => heard.push(e.text));
    enterHop(run, bus, 2);
    expect(heard).toEqual(['script: act 1, hop 2: layout=isthmus has no fight here (a rest)']);
  });
});

describe('a numbered hop\'s event', () => {
  // A seed where the event node's fight roll fires, so the starred entry
  // (today's `event=`) fights and the numbered one still opens.
  function fightingSeed(): number {
    for (let seed = 1; seed < 400; seed++) {
      const { run, bus } = runOf(seed, { script: [{ hop: 2, kind: 'event' }, { hop: 'all', event: 'cadre-1' }] });
      enterHop(run, bus, 2);
      if (run.phase === 'battle') return seed;
    }
    throw new Error('no seed in 400 rolls the fight at hop 2');
  }

  it('always opens, where the starred entry can turn into a fight', () => {
    const seed = fightingSeed();
    const { run, bus } = runOf(seed, { script: [{ hop: 2, event: 'cadre-1' }] });
    expect(kindsOnHop(run, 2).every((k) => k === 'event')).toBe(true);
    enterHop(run, bus, 2);
    expect(run.phase).toBe('event');
    expect(run.activeEvent?.eventId).toBe('cadre-1');
  });
});

describe('the refusals at construction', () => {
  it('a numbered hop past its act\'s end', () => {
    expect(() => runOf(1, { script: [{ hop: HOPS + 1, kind: 'rest' }] })).toThrow(/past act 1's end \(11 hops\)/);
    expect(() => runOf(1, { script: [{ hop: HOPS, layout: 'river' }] })).not.toThrow();
  });

  it('a hop given two kinds, and one item set twice', () => {
    expect(() => runOf(1, { script: [{ hop: 3, kind: 'rest', encounter: 'brigands' }] })).toThrow(
      /3: two kinds \(rest, battle\)/,
    );
    expect(() => runOf(1, { forcedLayoutId: 'river', script: [{ hop: 'all', layout: 'isthmus' }] })).toThrow(
      /layout is set twice/,
    );
  });

  it('a boss encounter away from the last hop, and an unknown id', () => {
    expect(() => runOf(1, { script: [{ hop: 4, encounter: 'banditQueen' }] })).toThrow(/only on its act's last hop/);
    expect(() => runOf(1, { script: [{ hop: 4, encounter: 'no-such' }] })).toThrow(/unknown forcedEncounterId/);
  });
});

describe('the warnings', () => {
  it('a starred encounter with no node of its kind on the act\'s map', () => {
    const elite = { hop: 'all', encounter: 'brigand-champions' } as const;
    const bare = runOf(1, { hopCount: 2, script: [elite] }).run;
    expect(bare.scriptWarnings).toContain('script: act 1: *:encounter=brigand-champions finds no elite node');
    // The control: an elite stamped on the map gives it a node.
    const stamped = runOf(1, { hopCount: 2, script: [elite, { hop: 1, kind: 'elite' }] }).run;
    expect(stamped.scriptWarnings).toEqual([]);
  });

  it('an entry for an act the run does not play', () => {
    const { run } = runOf(1, { script: [{ act: 2, hop: 3, kind: 'rest' }] });
    expect(run.scriptWarnings).toEqual(['script: 2.3:rest never applies: the run does not play act 2']);
  });

  it('none for a run without a script', () => {
    expect(runOf(1).run.scriptWarnings).toEqual([]);
  });
});
