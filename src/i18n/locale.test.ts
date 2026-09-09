import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { prose } from './prose';
import {
  DEFAULT_LOCALE,
  activeLocale,
  applyLocale,
  registerLocale,
  resetLocales,
  resolveProse,
  setActiveLocale,
} from './locale';

const Things = z.array(z.object({ id: z.string(), name: prose(), note: prose().optional() }));
const parse = () => Things.parse([{ id: 'a', name: 'Alpha' }, { id: 'b', name: 'Beta', note: 'A note' }]);

afterEach(() => resetLocales());

describe('locale runtime', () => {
  it('defaults to en, and en resolves to the inline value untouched', () => {
    expect(activeLocale()).toBe(DEFAULT_LOCALE);
    expect(resolveProse('things', 'things.a.name', 'Alpha')).toBe('Alpha');
    const data = parse();
    const sites = applyLocale('things', Things, data);
    expect(sites.map((s) => s.address)).toEqual(['things.a.name', 'things.b.name', 'things.b.note']);
    expect(data[0]!.name).toBe('Alpha');
  });

  it('resolves a registered sidecar in place, accepting string and object entries', () => {
    registerLocale('xx', 'things', {
      'things.a.name': 'Alfa',
      'things.b.name': { text: 'Bēta' },
      'things.b.note': 'Eine Notiz',
    });
    setActiveLocale('xx');
    const data = parse();
    applyLocale('things', Things, data);
    expect(data.map((t) => t.name)).toEqual(['Alfa', 'Bēta']);
    expect(data[1]!.note).toBe('Eine Notiz');
  });

  it('THROWS on a missing entry under a non-en locale — never a silent English fallback', () => {
    registerLocale('xx', 'things', { 'things.a.name': 'Alfa' });
    setActiveLocale('xx');
    expect(() => applyLocale('things', Things, parse())).toThrow(/locale 'xx' has no entry for 'things.b.name'/);
  });

  it('throws when the locale has no sidecar for the family at all', () => {
    setActiveLocale('xx');
    expect(() => resolveProse('things', 'things.a.name', 'Alpha')).toThrow(/no entry/);
  });

  it('rejects an empty locale id', () => {
    expect(() => setActiveLocale('')).toThrow();
  });
});
