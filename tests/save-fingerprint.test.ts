import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { EventBus } from '../src/core/EventBus';
import type { GameEvents } from '../src/core/events';
import { RUN_SCHEMA_VERSION, Run } from '../src/run/Run';
import { PIN_FILE, formatPin, judge, parsePin, repin, runSnapshotShape, shapeOfType, type SaveShape } from './saveShape';

// 113e — THE SAVE'S FINGERPRINT (Round 8 spec D2). A save is rejected when
// the save format changed, and the format is RUN_SCHEMA_VERSION; this is what
// makes a change of structure move that number. saveShape.ts says how the
// structure is read and why from the types.

const current = runSnapshotShape();

describe("113e — the save's fingerprint", () => {
  it(`RunSnapshot's structure is the one pinned in ${PIN_FILE}, at its version`, () => {
    const verdict = judge(parsePin(readFileSync(PIN_FILE, 'utf8')), current);
    expect(verdict.kind, verdict.kind === 'current' ? '' : verdict.message).toBe('current');
  });

  it('the types and a live run agree on the version and on the top-level keys', () => {
    // The wire itself, a surface the type walker doesn't read.
    const wire = new Run(1, new EventBus<GameEvents>()).toJSON();
    expect(current.version).toBe(RUN_SCHEMA_VERSION);
    expect(wire.schemaVersion).toBe(current.version);
    const root = current.body.split('\n\n')[0] as string;
    const printed = root
      .split('\n')
      .slice(1, -1)
      .map((line) => (/^ {2}([A-Za-z]+)\??: /.exec(line) as RegExpExecArray)[1]);
    expect(printed).toEqual(Object.keys(wire).sort());
    expect(printed).toHaveLength(45);
  });
});

describe('113e — the walker, on a type whose print is written out by hand', () => {
  const fixture = shapeOfType(process.cwd(), 'tests/saveShape.fixture.ts', 'FixtureSnapshot');

  it('prints every kind of member, sorted, with named types once', () => {
    expect(fixture.version).toBe(7);
    expect(fixture.body).toBe(
      [
        'FixtureSnapshot = {',
        '  cursor: Cursor | null',
        '  flags: { [string]: boolean | number }',
        '  offer: Array<Unit> | null',
        '  pair: [number, string]',
        '  phase: Phase',
        '  ready: boolean',
        '  schemaVersion: <RUN_SCHEMA_VERSION>',
        '  seen: Set<number>',
        '  team: Array<Unit>',
        '}',
        '',
        'Cursor = {',
        '  child: Cursor | null',
        '  index: number',
        '}',
        '',
        'Effect = {',
        '  key: string',
        '  lifetime: { expiresAtTick: number; kind: "ticks" } | { kind: "endOfTurn" }',
        '  mods: { power?: Mod | undefined; speed?: Mod | undefined }',
        '}',
        '',
        'Mod = {',
        '  add?: number | undefined',
        '  mul?: number | undefined',
        '}',
        '',
        'Phase = "battle" | "defeat" | "map"',
        '',
        'Unit = {',
        '  archetype: string',
        '  effects?: Array<Effect> | undefined',
        '  level: number',
        '}',
      ].join('\n'),
    );
  });

  it('sees one optional field added three levels down', () => {
    const changed = shapeOfType(process.cwd(), 'tests/saveShape.fixture.ts', 'FixtureSnapshotChanged');
    expect(changed.body).not.toBe(fixture.body);
    expect(changed.body).toContain('  cap?: number | undefined');
    expect(fixture.body).not.toContain('cap');
  });
});

describe('113e — the verdict and the re-pin', () => {
  const pinned: SaveShape = { version: 46, body: 'RunSnapshot = {\n  bits: number\n  team: Array<Unit>\n}\n\nUnit = {\n  level: number\n}' };
  const reshaped: SaveShape = { ...pinned, body: pinned.body.replace('  level: number', '  level: number\n  rank?: number | undefined') };
  const pin = formatPin({ ...pinned, notes: [] });

  it('round-trips the pinned file', () => {
    expect(parsePin(pin)).toEqual({ ...pinned, notes: [] });
    expect(parsePin(formatPin({ ...pinned, notes: ['a reason', 'another'] })).notes).toEqual(['a reason', 'another']);
  });

  it('fails a changed shape at the same version, naming the first difference', () => {
    const verdict = judge(parsePin(pin), reshaped);
    expect(verdict.kind).toBe('shape-changed-without-bump');
    if (verdict.kind === 'current') return;
    expect(verdict.message).toContain('RUN_SCHEMA_VERSION is still 46');
    expect(verdict.message).toContain('now:       rank?: number | undefined');
  });

  it('passes the same shape at the same version, and asks only for a re-pin after a bump', () => {
    expect(judge(parsePin(pin), pinned).kind).toBe('current');
    expect(judge(parsePin(pin), { ...reshaped, version: 47 }).kind).toBe('pin-behind');
    // A bump with no change of structure (a renamed key inside a string) also needs the re-pin.
    const verdict = judge(parsePin(pin), { ...pinned, version: 47 });
    expect(verdict).toMatchObject({ kind: 'pin-behind' });
    if (verdict.kind !== 'current') expect(verdict.message).toContain('the structure is unchanged');
  });

  it('the re-pin refuses a changed shape at the same version unless given a reason, which it writes down', () => {
    expect(repin(null, pinned, null)).toEqual({ kind: 'write', text: pin });
    expect(repin(pin, pinned, null)).toEqual({ kind: 'unchanged' });
    expect(repin(pin, reshaped, null).kind).toBe('refuse');
    expect(repin(pin, reshaped, '  ').kind).toBe('refuse');

    const allowed = repin(pin, reshaped, 'rank is optional and defaults on load');
    expect(allowed.kind).toBe('write');
    if (allowed.kind !== 'write') return;
    expect(allowed.text).toContain('# re-pinned without a bump: rank is optional and defaults on load');
    expect(judge(parsePin(allowed.text), reshaped).kind).toBe('current');

    // A bump re-pins without a reason and clears the old ones.
    const bumped = repin(allowed.text, { ...reshaped, version: 47 }, null);
    expect(bumped.kind).toBe('write');
    if (bumped.kind === 'write') expect(parsePin(bumped.text)).toEqual({ ...reshaped, version: 47, notes: [] });
  });
});
