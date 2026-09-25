import { describe, expect, it } from 'vitest';
import { EventBus } from '../../core/EventBus';
import type { GameEvents } from '../../core/events';
import { RNG } from '../../core/RNG';
import { Run } from '../../run/Run';
import { World } from '../../sim/World';
import { spawnEncounter } from '../../sim/battleSetup';
import { footprintOf } from '../../sim/occupancy';
import { RUN_CONFIG_PARAMS, parseRunConfigFromURL } from '../../run/RunConfig';
import {
  CLUMP_GLYPHS,
  FLYER_LIFT,
  clumpAt,
  gridToWorld,
  type Board,
} from '../../../tests/board/geometry';
import {
  BOARDS,
  BOARD_IDS,
  CLUMP,
  POSED_ROW,
  POSE_IDS,
  RUN_DIAL_KEYS,
  fixtureSearch,
  placePose,
  type BoardFixture,
  type PoseBoard,
} from './fixtures';
import { DIALS } from './state';

/** What a fixture's run dials OPEN — the real parser and the real `Run`,
 *  driven exactly as boot.ts drives Game (the turn gates on, root, Fight). */
function opened(search: string): {
  phase: string;
  layoutId: string | null;
  gridW: number;
  gridH: number;
} {
  const config = parseRunConfigFromURL(search);
  const run = new Run(config.seed ?? 0, new EventBus<GameEvents>(), config);
  run.pauseAtTurnGates = true;
  run.dispatch({ kind: 'enterNode', nodeId: run.nodeMap.rootId });
  run.dispatch({ kind: 'advanceTurn' });
  const e = run.currentEncounter;
  return {
    phase: run.phase,
    layoutId: e?.layoutId ?? null,
    gridW: e?.gridW ?? 0,
    gridH: e?.gridH ?? 0,
  };
}

const opensItsBoard = (fixture: BoardFixture): boolean => {
  const got = opened(`?${fixture.run}`);
  return (
    got.phase === 'battle' &&
    got.layoutId === fixture.expect.layoutId &&
    got.gridW === fixture.expect.gridW &&
    got.gridH === fixture.expect.gridH
  );
};

describe('105c — the board fixtures', () => {
  it('the table, the id list and the dial agree', () => {
    expect(Object.keys(BOARDS)).toEqual([...BOARD_IDS]);
    expect(DIALS.board.options).toEqual(['off', ...BOARD_IDS]);
    expect(DIALS.pose.options).toEqual(['off', ...POSE_IDS]);
  });

  it("the restated run-dial keys ARE the run layer's", () => {
    expect([...RUN_DIAL_KEYS].sort()).toEqual(Object.values(RUN_CONFIG_PARAMS).sort());
  });

  it.each(BOARD_IDS)('%s: two dispatches reach a battle on the board the table names', (id) => {
    expect(opened(`?${BOARDS[id].run}`)).toEqual({ phase: 'battle', ...BOARDS[id].expect });
  });

  it('the control: a fixture whose seed rolls another board FAILS the same check', () => {
    expect(opensItsBoard(BOARDS.big24)).toBe(true);
    // seed 1 rolls 18x18 (the step-zero hunt) — anything but the pinned 24x24.
    expect(
      opensItsBoard({ ...BOARDS.big24, run: BOARDS.big24.run.replace('seed=10', 'seed=1') }),
    ).toBe(false);
  });

  it('every fixture pins what the board depends on, the roster included', () => {
    for (const id of BOARD_IDS) {
      const keys = BOARDS[id].run.split('&').map((pair) => pair.split('=')[0]);
      for (const key of ['seed', 'layout', 'character', 'firstNode', 'roster'])
        expect(keys, id).toContain(key);
    }
  });

  it('a reload opens the same battle: the same dials give the same encounter', () => {
    const encounter = (): unknown => {
      const config = parseRunConfigFromURL(`?${BOARDS.live.run}`);
      const run = new Run(config.seed ?? 0, new EventBus<GameEvents>(), config);
      run.pauseAtTurnGates = true;
      run.dispatch({ kind: 'enterNode', nodeId: run.nodeMap.rootId });
      run.dispatch({ kind: 'advanceTurn' });
      return run.currentEncounter;
    };
    expect(encounter()).toEqual(encounter());
  });
});

describe('105c — fixtureSearch', () => {
  it('replaces the run pairs and leaves every other pair byte-for-byte', () => {
    const typed = '?seed=99&foo=a,b&layout=river&bp=board-quarry_anchor-bottom&roster=mage';
    const out = fixtureSearch(typed, 'quarry');
    expect(out).toBe(`?${BOARDS.quarry.run}&foo=a,b&bp=board-quarry_anchor-bottom`);
    // a hand-edited run dial cannot survive next to a `board-`:
    expect(parseRunConfigFromURL(out)).toEqual(parseRunConfigFromURL(`?${BOARDS.quarry.run}`));
  });

  it('is idempotent — boot leaves an already-right URL alone', () => {
    const once = fixtureSearch('?bp=board-big24', 'big24');
    expect(fixtureSearch(once, 'big24')).toBe(once);
  });

  it('`off` drops the run pairs and nothing else', () => {
    expect(fixtureSearch(`?${BOARDS.live.run}&bp=cue-filled`, null)).toBe('?bp=cue-filled');
    expect(fixtureSearch(`?${BOARDS.live.run}`, null)).toBe('');
  });
});

describe('105c — the poses', () => {
  const open = (gridW: number, gridH: number, blocked: readonly string[] = []): PoseBoard => ({
    gridW,
    gridH,
    isClear: (x, y) => !blocked.includes(`${x},${y}`),
  });
  const B15: Board = { name: 't', w: 15, h: 15 };

  it("the clumps are 105a's, cell for cell and glyph for glyph", () => {
    expect(CLUMP.map((s) => s.glyph)).toEqual([...CLUMP_GLYPHS]);
    const { placements, notes } = placePose('clump', open(15, 15));
    // 105a: clumpAt(centre) · clumpAt(1, 1) · clumpAt(cx, h - 2), in that order.
    const want = [...clumpAt(B15, 7, 7), ...clumpAt(B15, 1, 1), ...clumpAt(B15, 7, 13)];
    expect(placements).toHaveLength(want.length);
    placements.forEach((p, i) => {
      expect(p.spec.glyph).toBe(want[i]!.glyph);
      expect(gridToWorld(B15, p.cell.x, p.cell.y).toArray()).toEqual(want[i]!.pos.toArray());
    });
    expect(notes.join()).not.toContain('MOVED');
  });

  it('the flyer is V at the centre over three far neighbours, and only it flies', () => {
    const { placements } = placePose('flyer', open(15, 15));
    expect(placements.map((p) => [p.spec.glyph, p.cell.x, p.cell.y, p.flies])).toEqual([
      ['V', 7, 7, true],
      ['M', 6, 8, false],
      ['M', 7, 8, false],
      ['M', 8, 8, false],
    ]);
    // the lift dial opens on the lift 105a measured
    expect(DIALS.lift.def).toBe(FLYER_LIFT);
  });

  it("the row is 105b's: six glyphs, the middle row, centred", () => {
    const { placements, notes } = placePose('row', open(15, 15));
    expect(placements.map((p) => p.spec.glyph)).toEqual(POSED_ROW.map((s) => s.glyph));
    expect(placements.map((p) => [p.cell.x, p.cell.y])).toEqual(
      [4, 5, 6, 7, 8, 9].map((x) => [x, 7]),
    );
    expect(notes).toEqual(['row y=7, x=4..9']);
  });

  it('the edges reach all four corners and the four mids', () => {
    const cells = placePose('edges', open(12, 32)).placements.map((p) => `${p.cell.x},${p.cell.y}`);
    expect(cells).toEqual(['0,0', '11,0', '0,31', '11,31', '6,0', '6,31', '0,16', '11,16']);
  });

  it('a blocked ideal spot MOVES the group, and the note says it is not the measured one', () => {
    const { placements, notes } = placePose('clump', open(15, 15, ['7,7']));
    expect(notes[0]).toContain('MOVED from 7,7');
    expect(notes[1]).toBe('near corner @1,1');
    expect(placements.some((p) => p.cell.x === 7 && p.cell.y === 7)).toBe(false);
  });

  it('no pose ever stands on a blocked tile, off the board, or twice on one tile', () => {
    // a deterministic scatter: roughly a third of a 14x12 blocked
    const blocked: string[] = [];
    for (let y = 0; y < 12; y++)
      for (let x = 0; x < 14; x++) if ((x * 7 + y * 13) % 3 === 0) blocked.push(`${x},${y}`);
    for (const pose of POSE_IDS) {
      const seen = new Set<string>();
      for (const { cell } of placePose(pose, open(14, 12, blocked)).placements) {
        const key = `${cell.x},${cell.y}`;
        expect(blocked, `${pose} ${key}`).not.toContain(key);
        expect(seen.has(key), `${pose} ${key} twice`).toBe(false);
        expect(cell.x >= 0 && cell.y >= 0 && cell.x < 14 && cell.y < 12).toBe(true);
        seen.add(key);
      }
    }
  });

  it('a board with no room says so instead of placing a partial group', () => {
    const { placements, notes } = placePose('clump', open(2, 2));
    expect(placements).toEqual([]);
    expect(notes).toHaveLength(3);
    for (const note of notes) expect(note).toContain('NO clear fit');
  });

  /** The REAL board a fixture opens — terrain, walls, camps and both teams
   *  placed by the sim's own setup — as the poses see it (posed.ts's rule). */
  const realBoard = (run: string): PoseBoard => {
    const config = parseRunConfigFromURL(`?${run}`);
    const r = new Run(config.seed ?? 0, new EventBus<GameEvents>(), config);
    r.pauseAtTurnGates = true;
    r.dispatch({ kind: 'enterNode', nodeId: r.nodeMap.rootId });
    r.dispatch({ kind: 'advanceTurn' });
    const e = r.currentEncounter!;
    const world = new World(new EventBus<GameEvents>(), new RNG(e.worldSeed), e.gridW, e.gridH);
    spawnEncounter(world, e);
    const taken = new Set<string>();
    for (const unit of world.units) {
      const n = footprintOf(unit);
      for (let dx = 0; dx < n; dx++)
        for (let dy = 0; dy < n; dy++) taken.add(`${unit.position.x + dx},${unit.position.y + dy}`);
    }
    return {
      gridW: e.gridW,
      gridH: e.gridH,
      isClear: (x, y) =>
        world.tileGrid.defAt({ x, y }).passable &&
        !world.tileGrid.kindAt({ x, y }).includes('water') &&
        !taken.has(`${x},${y}`),
    };
  };
  const displaced = (run: string): string[] =>
    POSE_IDS.flatMap((pose) => placePose(pose, realBoard(run)).notes).filter(
      (note) => note.includes('MOVED') || note.includes('NO clear'),
    );

  it('open15 hosts every pose on its measured spot — except the far-row clump', () => {
    const moved = displaced(BOARDS.open15.run);
    expect(moved).toHaveLength(1);
    expect(moved[0]).toContain('far row');
    expect(placePose('row', realBoard(BOARDS.open15.run)).notes).toEqual(['row y=7, x=4..9']);
  });

  it('the control: the seed step zero first picked displaces more than that', () => {
    expect(displaced(BOARDS.open15.run.replace('seed=91', 'seed=6')).length).toBeGreaterThan(1);
  });
});
