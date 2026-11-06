/**
 * The strategy fixtures load: every weight vector under
 * `tests/fuzz/fixtures/` and the default in `config/fuzz-strategies.json`
 * passes the parser the fuzz CLI's `--strategy=<file>` uses. The schema is
 * exhaustive over `ALL_ARCHETYPES` (gotcha #124), so an archetype joined
 * into the config but not into a fixture refuses that fixture at parse,
 * and nothing else on `npm test` loads a fixture: twice the miss surfaced
 * only when a board launched. This test sees it on the commit that adds
 * the archetype.
 *
 * Contract, the file list read from the directory:
 *   1. every `*.json` in the fixtures directory parses as a weight vector,
 *      except a file named in NOT_VECTORS with what it is;
 *   2. the shipped default parses;
 *   3. a NOT_VECTORS entry names a file that exists and is not a vector.
 * The join convention (a new id at weight 0, appended) is gotcha #124's.
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALL_ARCHETYPES } from '../src/sim/archetypes';
import { parseWeights } from './fuzz/strategies/scoredWeights';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURES = 'tests/fuzz/fixtures';

/** The fixtures that are not weight vectors, each with what it is. */
const NOT_VECTORS: ReadonlyMap<string, string> = new Map([
  [
    'prior-table-v4.json',
    'the prior table v4, handed back by `--prior-table=<file>` (BALANCE.md "The derived-artifact registry")',
  ],
  [
    'prior-table-v5.json',
    'the prior table v5, handed back by `--prior-table=<file>` (BALANCE.md "The derived-artifact registry")',
  ],
]);

function readJson(rel: string): unknown {
  return JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
}

const fixtures = readdirSync(join(ROOT, FIXTURES))
  .filter((f) => f.endsWith('.json'))
  .sort();
const vectors = fixtures.filter((f) => !NOT_VECTORS.has(f));

describe('the strategy fixtures load', () => {
  it.each(vectors)('%s parses as a weight vector', (file) => {
    expect(() => parseWeights(readJson(`${FIXTURES}/${file}`))).not.toThrow();
  });

  it('the shipped default parses', () => {
    expect(() => parseWeights(readJson('config/fuzz-strategies.json'))).not.toThrow();
  });

  it('every NOT_VECTORS entry is a fixture that is not a vector', () => {
    for (const file of NOT_VECTORS.keys()) {
      expect(fixtures, `${file} is not in ${FIXTURES}`).toContain(file);
      expect(() => parseWeights(readJson(`${FIXTURES}/${file}`)), `${file} parses as a vector`).toThrow();
    }
  });

  it('a vector missing one archetype is refused, in either record', () => {
    const id = ALL_ARCHETYPES[ALL_ARCHETYPES.length - 1]!;
    for (const record of ['archetype', 'composition'] as const) {
      const vector = readJson(`${FIXTURES}/${vectors[0]}`) as Record<string, Record<string, number>>;
      delete vector[record]![id];
      expect(() => parseWeights(vector), `${record} without ${id}`).toThrow(id);
    }
  });
});
