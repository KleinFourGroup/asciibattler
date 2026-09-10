import { afterEach, describe, expect, it } from 'vitest';
import { FUZZY_MARKER, fuzzyEntries, resetLocales, setActiveLocale, setFuzzyMarker } from './locale';
import { UI_EN, isPluralEntry, registerUiLocale, resetUiLocales, t } from './ui';
import { translatorStamp } from './provenance';
import { localeCredits } from './credits';

afterEach(() => {
  resetLocales();
  resetUiLocales();
});

describe('t() — the UI string table', () => {
  it('reads the English source table', () => {
    expect(t('common.buy')).toBe(UI_EN['common.buy']);
    expect(t('stat.power')).toBe('POW');
  });

  it('substitutes {placeholders} and formats numbers through Intl', () => {
    expect(t('hud.card.targetHint', { engage: 'Engage', focus: 'Focus' })).toBe('Left-click: Engage · right-click: Focus');
    expect(t('cardlist.title', { title: 'Roster', count: 1234 })).toBe('Roster — 1,234 units');
  });

  it('selects the plural form by Intl.PluralRules on `count`, falling back to `other`', () => {
    expect(t('cardlist.title', { title: 'Draw', count: 1 })).toBe('Draw — 1 unit');
    expect(t('cardlist.title', { title: 'Draw', count: 0 })).toBe('Draw — 0 units');
    expect(t('promotion.heading', { count: 1 })).toBe('Level Up!');
    expect(t('promotion.heading', { count: 3 })).toBe('3 Promotions');
  });

  it('THROWS on an unknown key, a missing param, or a plural entry without a numeric count', () => {
    expect(() => t('no.such.key')).toThrow(/unknown UI key 'no.such.key'/);
    expect(() => t('hud.card.targetHint', { engage: 'x' })).toThrow(/needs a '\{focus\}' param/);
    expect(() => t('promotion.heading')).toThrow(/needs a numeric 'count'/);
    expect(() => t('promotion.heading', { count: 'many' })).toThrow(/needs a numeric 'count'/);
  });

  it('every plural entry in the English table carries `other`', () => {
    for (const [key, entry] of Object.entries(UI_EN)) {
      if (isPluralEntry(entry)) expect(entry.other, `${key} lacks 'other'`).toBeTypeOf('string');
    }
  });

  it('a registered locale resolves its own entries, formats numbers its own way, and THROWS on a key it lacks', () => {
    registerUiLocale('de', {
      'common.buy': 'Kaufen',
      'cardlist.title': { one: '{title} — {count} Einheit', other: '{title} — {count} Einheiten' },
    });
    setActiveLocale('de');
    expect(t('common.buy')).toBe('Kaufen');
    expect(t('cardlist.title', { title: 'Kader', count: 1234 })).toBe('Kader — 1.234 Einheiten');
    expect(() => t('stat.power')).toThrow(/locale 'de' has no UI entry for 'stat.power'/);
    expect(() => t('no.such.key')).toThrow(/not in locales\/en\/ui.json either/);
  });

  it('provenance entries (95e): a current one resolves — plural text included; a FUZZY one falls back to the English with the marker', () => {
    const stamp = { who: 'T', on: '2027-01-01' };
    registerUiLocale('de', {
      'common.buy': translatorStamp('Kaufen', UI_EN['common.buy'], stamp),
      'cardlist.title': translatorStamp({ one: '{title} — {count} Einheit', other: '{title} — {count} Einheiten' }, UI_EN['cardlist.title'], stamp),
      'stat.power': translatorStamp('MACHT', 'POWER (old)', stamp), // stamped against an English that moved
    });
    setActiveLocale('de');
    setFuzzyMarker(FUZZY_MARKER);
    expect(t('common.buy')).toBe('Kaufen');
    expect(t('cardlist.title', { title: 'Kader', count: 1 })).toBe('Kader — 1 Einheit');
    expect(t('stat.power')).toBe(`${FUZZY_MARKER}POW`);
    expect(fuzzyEntries()).toEqual(['ui.stat.power']);
    expect(localeCredits()).toEqual([{ lang: 'de', translators: ['T'], reviewers: [] }]);
  });
});
