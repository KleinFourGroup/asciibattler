import { describe, expect, it } from 'vitest';
import { memoryAdapter } from './adapter';
import { PROGRESS_SECTION } from './progress';
import { createStore } from './store';

// 116j — the progress section over the memory adapter. Stored text is
// planted in and read back from `adapter.entries`.

const KEY = 'asciibattler:progress';

describe('116j — the progress section', () => {
  it('has these fields, by these exact names', () => {
    // Permanent: each is a key in players' browsers.
    expect(PROGRESS_SECTION.name).toBe('progress');
    expect(PROGRESS_SECTION.policy).toBe('lenient');
    expect(Object.keys(PROGRESS_SECTION.fields)).toEqual(['creditsSeen']);
  });

  it('reads a new player as not having seen the credits', () => {
    expect(createStore({ adapter: memoryAdapter(), build: 'b' }).read(PROGRESS_SECTION)).toEqual({ creditsSeen: false });
  });

  it('keeps the flag across a reload', () => {
    const adapter = memoryAdapter();
    expect(createStore({ adapter, build: 'b' }).patch(PROGRESS_SECTION, { creditsSeen: true })).toBe(true);
    expect(JSON.parse(adapter.entries.get(KEY)!)).toEqual({ v: 1, build: 'b', data: { creditsSeen: true } });
    expect(createStore({ adapter, build: 'b' }).read(PROGRESS_SECTION)).toEqual({ creditsSeen: true });
  });

  it('gives a value that is not a boolean its fallback', () => {
    for (const bad of ['yes', 1, null]) {
      const adapter = memoryAdapter({ [KEY]: JSON.stringify({ v: 1, build: 'b', data: { creditsSeen: bad } }) });
      expect(createStore({ adapter, build: 'b' }).read(PROGRESS_SECTION), String(bad)).toEqual({ creditsSeen: false });
    }
  });
});
