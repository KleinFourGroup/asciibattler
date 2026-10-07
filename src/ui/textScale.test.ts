import { describe, expect, it } from 'vitest';
import { SETTINGS_SECTION } from '../settings/settings';
import { TEXT_SCALE_CHOICES, holdTextScale, nearestTextScale, rootFontSize, setTextScale } from './textScale';

// 116k — the text scale's rule: which size a stored value draws, what that
// puts on the root element, and the hold the settings modal takes.

const root = (): { style: { fontSize: string } } => ({ style: { fontSize: 'unset' } });

describe('the text scale', () => {
  it('offers sizes in rising order, the first the page as it is, all inside what the field stores', () => {
    expect(TEXT_SCALE_CHOICES[0]).toBe(1);
    expect([...TEXT_SCALE_CHOICES].sort((a, b) => a - b)).toEqual([...TEXT_SCALE_CHOICES]);
    for (const choice of TEXT_SCALE_CHOICES) {
      expect(SETTINGS_SECTION.fields.textScale.schema.safeParse(choice).success, String(choice)).toBe(true);
    }
    expect(SETTINGS_SECTION.fields.textScale.fallback).toBe(1);
  });

  it('draws the offered size nearest a stored value', () => {
    for (const choice of TEXT_SCALE_CHOICES) expect(nearestTextScale(choice)).toBe(choice);
    // The field stores 0.5 to 3; neither end is offered.
    expect(nearestTextScale(0.5)).toBe(1);
    expect(nearestTextScale(3)).toBe(1.5);
    expect(nearestTextScale(1.2)).toBe(1.25);
    expect(nearestTextScale(1.04)).toBe(1);
    // Halfway between two sizes takes the smaller.
    expect(nearestTextScale(1.375)).toBe(1.25);
  });

  it('sets a percentage on the root, and nothing at 1', () => {
    expect(rootFontSize(1)).toBe('');
    expect(rootFontSize(1.1)).toBe('110%');
    expect(rootFontSize(1.25)).toBe('125%');
    expect(rootFontSize(1.5)).toBe('150%');
    const el = root();
    setTextScale(1.25, el);
    expect(el.style.fontSize).toBe('125%');
    setTextScale(1, el);
    expect(el.style.fontSize).toBe('');
    setTextScale(40, el);
    expect(el.style.fontSize).toBe('150%');
  });

  it('a held page keeps its size and draws the last one set when the hold ends', () => {
    const el = root();
    setTextScale(1, el);
    const release = holdTextScale(el);
    setTextScale(1.5, el);
    setTextScale(1.25, el);
    expect(el.style.fontSize).toBe('');
    release();
    expect(el.style.fontSize).toBe('125%');
    // A second call of the same release does nothing.
    setTextScale(1, el);
    release();
    expect(el.style.fontSize).toBe('');
  });

  it('two holds end with the second release, and a hold with nothing set draws nothing', () => {
    const el = root();
    setTextScale(1.1, el);
    const first = holdTextScale(el);
    const second = holdTextScale(el);
    setTextScale(1.5, el);
    first();
    expect(el.style.fontSize).toBe('110%');
    second();
    expect(el.style.fontSize).toBe('150%');
    const idle = holdTextScale(el);
    idle();
    expect(el.style.fontSize).toBe('150%');
  });
});
