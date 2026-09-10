import { describe, expect, it } from 'vitest';
import {
  auditLocale,
  canonicalSource,
  creditsOf,
  currencyOf,
  entryTextOf,
  isAuditClean,
  isProvenanceEntry,
  reviewerStamp,
  sourceHash,
  translatorStamp,
  validateStamp,
} from './provenance';

const T = { who: 'claude-fable-5-1', on: '2027-03-02' };
const R = { who: 'Native Speaker X', on: '2027-03-14' };

describe('the source hash', () => {
  it('is the English string itself for a string, and key-order independent for a plural object', () => {
    expect(canonicalSource('Alpha')).toBe('Alpha');
    expect(sourceHash('Alpha')).toBe(sourceHash('Alpha'));
    expect(sourceHash('Alpha')).not.toBe(sourceHash('Alpha.'));
    expect(sourceHash({ one: '{count} unit', other: '{count} units' })).toBe(sourceHash({ other: '{count} units', one: '{count} unit' }));
    expect(sourceHash({ one: '{count} unit', other: '{count} units' })).not.toBe(sourceHash({ one: '{count} unit', other: '{count} unit' }));
  });

  it('is 8 lowercase hex chars (the fnv1a rendering — PERMANENT)', () => {
    expect(sourceHash('Alpha')).toMatch(/^[0-9a-f]{8}$/);
    // A pinned value: a change here fuzzies every shipped locale at once.
    expect(sourceHash('')).toBe('811c9dc5');
  });
});

describe('the entry shape', () => {
  it('recognises the provenance object by `text`, and never a plural entry', () => {
    expect(isProvenanceEntry('Alfa')).toBe(false);
    expect(isProvenanceEntry({ one: 'a', other: 'b' })).toBe(false);
    expect(isProvenanceEntry({ text: 'Alfa' })).toBe(true);
    expect(entryTextOf('Alfa')).toBe('Alfa');
    expect(entryTextOf({ text: { one: 'a', other: 'b' } })).toEqual({ one: 'a', other: 'b' });
  });

  it('grades currency: unstamped (a string, or no source) · current · fuzzy', () => {
    expect(currencyOf('Alfa', 'Alpha')).toBe('unstamped');
    expect(currencyOf({ text: 'Alfa' }, 'Alpha')).toBe('unstamped');
    expect(currencyOf({ text: 'Alfa', source: sourceHash('Alpha') }, 'Alpha')).toBe('current');
    expect(currencyOf({ text: 'Alfa', source: sourceHash('Alpha') }, 'Alpha!')).toBe('fuzzy');
  });
});

describe('the stamps', () => {
  it('the translator stamp stores the CURRENT English hash and drops any reviewer', () => {
    const reviewed = reviewerStamp(translatorStamp('Alfa', 'Alpha', T), R);
    expect(reviewed).toEqual({ text: 'Alfa', source: sourceHash('Alpha'), translator: T, reviewer: R });
    expect(Object.keys(reviewed)).toEqual(['text', 'source', 'translator', 'reviewer']);
    const retranslated = translatorStamp('Alfa!', 'Alpha!', T);
    expect(retranslated.reviewer).toBeUndefined();
    expect(currencyOf(retranslated, 'Alpha!')).toBe('current');
  });

  it('rejects a stamp with an empty who or a non-ISO date', () => {
    expect(() => validateStamp({ who: ' ', on: '2027-03-02' }, 'x')).toThrow(/non-empty 'who'/);
    expect(() => validateStamp({ who: 'A', on: '3/2/2027' }, 'x')).toThrow(/ISO date/);
    expect(() => translatorStamp('a', 'b', { who: 'A', on: 'yesterday' })).toThrow(/ISO date/);
  });
});

describe('the locale audit (the four pins over one file)', () => {
  const english = {
    'things.a.name': 'Alpha',
    'things.b.name': 'Beta',
    'things.c.name': 'Gamma',
    'things.d.count': { one: '{count} thing', other: '{count} things' },
  };

  it('flags a HAND-DRIFTED entry fuzzy: the English moved after the translation was stamped', () => {
    const file = {
      'things.a.name': 'Alfa', // unstamped — a plain string
      'things.b.name': translatorStamp('Bēta', 'Beta', T), // current
      'things.c.name': translatorStamp('Gamma-x', 'Old Gamma', T), // stamped against the OLD English → fuzzy
      'things.e.name': 'Epsilon', // orphan
    };
    const audit = auditLocale(english, file);
    expect(audit.fuzzy).toEqual(['things.c.name']);
    expect(audit.unstamped).toEqual(['things.a.name']);
    expect(audit.missing).toEqual(['things.d.count']);
    expect(audit.orphan).toEqual(['things.e.name']);
    expect(isAuditClean(audit)).toBe(false);
  });

  it('is clean when every address is present, stamped against the current English, and nothing is orphaned', () => {
    const file = Object.fromEntries(Object.entries(english).map(([a, en]) => [a, translatorStamp(`${a}!`, en, T)]));
    const audit = auditLocale(english, file);
    expect(audit).toEqual({ missing: [], orphan: [], unstamped: [], fuzzy: [] });
    expect(isAuditClean(audit)).toBe(true);
  });
});

describe('the credits extract', () => {
  it('collects every stamped name per language, de-duplicated and sorted; unstamped entries add nothing', () => {
    const de = {
      a: translatorStamp('x', 'X', { who: 'Zed', on: '2027-01-01' }),
      b: reviewerStamp(translatorStamp('y', 'Y', { who: 'Anna', on: '2027-01-02' }), { who: 'Ben', on: '2027-01-03' }),
      c: 'plain',
    };
    const deUi = { k: reviewerStamp(translatorStamp('z', 'Z', { who: 'Zed', on: '2027-01-04' }), { who: 'Anna', on: '2027-01-05' }) };
    const fr = { a: 'plain' };
    expect(creditsOf([['fr', fr], ['de', de], ['de', deUi]])).toEqual([
      { lang: 'de', translators: ['Anna', 'Zed'], reviewers: ['Anna', 'Ben'] },
      { lang: 'fr', translators: [], reviewers: [] },
    ]);
  });
});
