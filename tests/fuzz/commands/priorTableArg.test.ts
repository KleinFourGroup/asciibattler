/**
 * `--prior-table=<path>` names the prior table the fold reads, in place of
 * the committed one. The committed table is re-derived at each signing from
 * that board's own shadow leg, so the board's arbitrated rows were measured
 * under the table before it, and a later tree reproduces them only when it
 * is handed that table. The fixture is the one the sheet's signing board of
 * 2026-09-08 ran under.
 *
 * Pinned here: the parse, the guards, that the named path is the one the
 * resolver reads, and that the fixture is that table and not the committed
 * one. That a run under the fixture reproduces the archived rows is a box
 * run's to show (BALANCE has the entry).
 */

import { describe, it, expect } from 'vitest';
import { arbitratedWrapFromArgs, parseArgs } from './args';
import { loadPriorTable, priorFoldValues } from '../prior/priorTable';

const FIXTURE = 'tests/fuzz/fixtures/prior-table-v4.json';
const FOLD = ['--arbitrate', '--prior-lambda=0.5'];

describe('--prior-table', () => {
  it('parses a path beside the fold; unset when absent', () => {
    expect(parseArgs([...FOLD, `--prior-table=${FIXTURE}`]).priorTable).toBe(FIXTURE);
    expect(parseArgs(FOLD).priorTable).toBeUndefined();
    // A bare flag names no table and stays unset.
    expect(parseArgs([...FOLD, '--prior-table']).priorTable).toBeUndefined();
  });

  it('is refused without a fold to read it, and under a search', () => {
    expect(() => parseArgs([`--prior-table=${FIXTURE}`])).toThrow(/requires --arbitrate/);
    expect(() => parseArgs(['--arbitrate', `--prior-table=${FIXTURE}`])).toThrow(/non-zero --prior-lambda/);
    expect(() => parseArgs(['--arbitrate', '--prior-lambda=0', `--prior-table=${FIXTURE}`])).toThrow(
      /non-zero --prior-lambda/,
    );
    expect(() => parseArgs([...FOLD, '--prior-table='])).toThrow(/needs a path/);
    expect(() => parseArgs(['--search', ...FOLD, `--prior-table=${FIXTURE}`])).toThrow(/run-mode dial/);
  });

  it('is the table the resolver reads', () => {
    // The committed table exists, so only a read of the named path can throw.
    const missing = 'tests/fuzz/fixtures/no-such-table.json';
    expect(() => arbitratedWrapFromArgs(parseArgs([...FOLD, `--prior-table=${missing}`]))).toThrow(
      /no-such-table/,
    );
    expect(() => arbitratedWrapFromArgs(parseArgs(FOLD))).not.toThrow();
    expect(() => arbitratedWrapFromArgs(parseArgs([...FOLD, `--prior-table=${FIXTURE}`]))).not.toThrow();
  });

  it('the fixture is the table measured at 7dc07a3, and not the committed one', () => {
    const fixture = loadPriorTable(FIXTURE);
    const committed = loadPriorTable();
    expect(fixture.provenance.measurementHead).toBe('7dc07a3');
    expect(committed.provenance.measurementHead).not.toBe('7dc07a3');
    expect(priorFoldValues(fixture)).not.toEqual(priorFoldValues(committed));
  });
});
