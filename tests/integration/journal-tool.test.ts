import { describe, expect, it } from 'vitest';
import { UNBAKED_BUILD_ID } from '../../src/buildId';
import type { JournalSegment, RunJournal } from '../../src/journal/journal';
import { buildRefusal, replayText } from '../../src/journal/replayTool';
import { asFile, driveRun, replayPlants, TEST_BUILD } from '../journalDrive';

// `npm run replay` as a function over the file's text (src/journal/replayTool.ts):
// which builds it accepts a journal from, and what it says and exits with.

const TREE = 'abc1234';
const GOOD = `0.1.0+${TREE}`;

describe('buildRefusal: which builds a journal is accepted from', () => {
  it('accepts the tree’s own commit, served live or built, from a clean or a dirty tree', () => {
    expect(buildRefusal(GOOD, TREE)).toBeNull();
    expect(buildRefusal(`${GOOD}-dev`, TREE)).toBeNull();
    expect(buildRefusal(GOOD, `${TREE}-dirty`)).toBeNull();
  });

  it('refuses another commit and names the one to check out', () => {
    expect(buildRefusal('0.1.0+fedcba9', TREE)).toContain('git checkout fedcba9');
    expect(buildRefusal('0.1.0+fedcba9-dev', TREE)).toContain('this tree is at abc1234');
  });

  it('refuses a build of a tree with uncommitted changes, live or not', () => {
    expect(buildRefusal(`${GOOD}-dirty`, TREE)).toContain('uncommitted changes');
    expect(buildRefusal(`${GOOD}-dirty-dev`, TREE)).toContain('uncommitted changes');
    // Even when the tree replaying it is at that commit and dirty too.
    expect(buildRefusal(`${GOOD}-dirty`, `${TREE}-dirty`)).toContain('uncommitted changes');
  });

  it('refuses an ID that names no commit: unbaked, no git, a pin', () => {
    expect(buildRefusal(UNBAKED_BUILD_ID, TREE)).toContain('nothing stamped');
    expect(buildRefusal('0.1.0+nogit', TREE)).toContain('names no commit');
    expect(buildRefusal('pin-113f-post', TREE)).toContain('names no commit');
    expect(buildRefusal(TEST_BUILD, TREE)).toContain('names no commit');
  });
});

describe('replayText: the tool over a recorded journal', () => {
  const recorded = driveRun({
    start: { kind: 'seed', seed: 7, dials: 'hops=3&character=soldier' },
    plants: replayPlants(),
  });
  const base = asFile(recorded.journal);
  const hash = base.segments[0]!.end!.hash;
  const journal = (patch: Partial<JournalSegment> = {}): RunJournal => ({
    ...base,
    segments: [{ ...base.segments[0]!, build: `${GOOD}-dev`, ...patch }],
  });
  const text = (value: unknown): string => JSON.stringify(value);

  it('replays a journal from this tree’s commit and exits 0', () => {
    const { code, lines } = replayText(text(journal()), TREE);
    expect(code).toBe(0);
    expect(lines[0]).toBe(
      `segment 0: build ${GOOD}-dev, config ${base.segments[0]!.configHash}, seed 7 (hops=3&character=soldier), ` +
        `${base.segments[0]!.entries.length} entries`,
    );
    expect(lines[1]).toBe(
      `segment 0: replayed ${recorded.battles} battles to its end (victory); hash ${hash} matches the journal's`,
    );
    expect(lines).toHaveLength(2);
  });

  it('warns when the tree itself has uncommitted changes, and still replays', () => {
    const { code, lines } = replayText(text(journal()), `${TREE}-dirty`);
    expect(code).toBe(0);
    expect(lines.some((l) => l.startsWith('warning: this tree has uncommitted changes'))).toBe(true);
  });

  it.each([
    ['another commit', '0.1.0+fedcba9', 'git checkout fedcba9'],
    ['a -dirty build', `${GOOD}-dirty`, 'uncommitted changes'],
    ['an unbaked build', UNBAKED_BUILD_ID, 'nothing stamped'],
  ])('refuses %s with exit 2, and replays nothing', (_name, build, says) => {
    const { code, lines } = replayText(text(journal({ build })), TREE);
    expect(code).toBe(2);
    expect(lines[1]).toContain('segment 0: refused:');
    expect(lines[1]).toContain(says);
    expect(lines.some((l) => l.includes('replayed'))).toBe(false);
  });

  it('--force replays past a build refusal', () => {
    const { code, lines } = replayText(text(journal({ build: `${GOOD}-dirty` })), TREE, { force: true });
    expect(code).toBe(0);
    expect(lines[1]).toContain('segment 0: forced past:');
    expect(lines.at(-1)).toContain(`hash ${hash} matches the journal's`);
  });

  it('refuses another config hash with exit 2, forced or not', () => {
    for (const force of [false, true]) {
      const { code, lines } = replayText(text(journal({ configHash: 'ffffffff' })), TREE, { force });
      expect(code).toBe(2);
      expect(lines.at(-1)).toContain('recorded under config ffffffff');
    }
  });

  it('refuses another format with exit 2', () => {
    expect(replayText(text({ ...journal(), format: 1 }), TREE).code).toBe(2);
  });

  it('exits 1 on a divergence and prints where', () => {
    const end = { ...base.segments[0]!.end!, hash: '00000000' };
    const { code, lines } = replayText(text(journal({ end })), TREE);
    expect(code).toBe(1);
    expect(lines.at(-1)).toMatch(/^DIVERGED: replayJournal: segment 0, battle \d+, the end: /);
  });

  it('reads a probe report and holds the replay against the page’s hash', () => {
    const report = (stateHash: string): string =>
      text({ probe: 'kit', ok: true, result: { ready: {}, script: { ok: true, stateHash, journal: journal() } } });
    const same = replayText(report(hash), TREE);
    expect(same.code).toBe(0);
    expect(same.lines.at(-1)).toBe(`the page reported hash ${hash}: the replay reached the same`);
    const other = replayText(report('11111111'), TREE);
    expect(other.code).toBe(1);
    expect(other.lines.at(-1)).toBe(`DIVERGED: the page reported hash 11111111, and the replay reached ${hash}`);
  });

  it('exits 1 on a file that is not a journal', () => {
    expect(replayText('{ not json', TREE)).toMatchObject({ code: 1 });
    expect(replayText('{ not json', TREE).lines[0]).toMatch(/^not JSON: /);
    expect(replayText(text({ schemaVersion: 46 }), TREE)).toEqual({
      code: 1,
      lines: ['not a run journal: no `format` and `segments` (nor a probe report with a `journal`)'],
    });
  });
});
