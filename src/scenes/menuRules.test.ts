import { describe, expect, it } from 'vitest';
import { ENCOUNTER_IDS } from '../config/encounters';
import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import { BOARD_PANEL_PARAM } from '../dev/boardPanel/state';
import { Run } from '../run/Run';
import { parseRunConfigFromURL, RUN_CONFIG_PARAMS } from '../run/RunConfig';
import {
  BOOKMARK_PARAM,
  SEED_MAX_DIGITS,
  bootsToMenu,
  cleanSeedText,
  creditsOnTheWay,
  seedFromText,
  seedShown,
} from './menuRules';

/** One value per run dial that the URL parser accepts, written by hand. A new
 *  dial fails the census below until it has its row here. */
const A_VALUE_PER_DIAL: Record<string, string> = {
  seed: '7',
  hops: '3',
  sectorHops: '4',
  roster: 'archer',
  layout: 'procedural',
  encounter: ENCOUNTER_IDS[0]!,
  firstNode: 'elite',
  width: '3',
  daemon: 'none',
  character: 'soldier',
  bits: '0',
};

describe('116c — when the menu boots', () => {
  it('boots on a plain URL, and on a parameter that is no run dial', () => {
    expect(bootsToMenu('')).toBe(true);
    expect(bootsToMenu('?')).toBe(true);
    expect(bootsToMenu('?store=deny')).toBe(true);
    expect(bootsToMenu('?utm_source=itch')).toBe(true);
  });

  it('is skipped by every run dial on its own', () => {
    expect(Object.keys(A_VALUE_PER_DIAL).sort()).toEqual(Object.values(RUN_CONFIG_PARAMS).sort());
    for (const [dial, value] of Object.entries(A_VALUE_PER_DIAL)) {
      expect(bootsToMenu(`?${dial}=${value}`), `?${dial}=${value}`).toBe(false);
    }
  });

  it('is skipped by the drivers’ URLs', () => {
    expect(bootsToMenu('?seed=7&character=soldier')).toBe(false);
    expect(bootsToMenu('?character=soldier&firstNode=elite&roster=mercenary,archer&bp=board-quarry')).toBe(false);
  });

  it('is skipped by a board-explorer bookmark, whatever it holds', () => {
    expect(BOOKMARK_PARAM).toBe(BOARD_PANEL_PARAM);
    expect(bootsToMenu('?bp=yaw-30')).toBe(false);
    expect(bootsToMenu('?bp=')).toBe(false);
    expect(bootsToMenu('?store=deny&bp=proj-persp_yaw-0')).toBe(false);
  });

  it('boots when a dial’s value parses to nothing, since the page is then a plain one', () => {
    expect(bootsToMenu('?character=nobody')).toBe(true);
    expect(bootsToMenu('?seed=abc')).toBe(true);
    expect(bootsToMenu('?seed=')).toBe(true);
  });
});

describe('116c — the seed field', () => {
  it('keeps the digits of what was typed or pasted, and no more than it holds', () => {
    expect(cleanSeedText('')).toBe('');
    expect(cleanSeedText('1234')).toBe('1234');
    expect(cleanSeedText('seed: 12 34')).toBe('1234');
    expect(cleanSeedText('-5')).toBe('5');
    expect(cleanSeedText('1e3')).toBe('13');
    expect(cleanSeedText('１２')).toBe('');
    expect(cleanSeedText('9'.repeat(40))).toBe('9'.repeat(SEED_MAX_DIGITS));
  });

  it('names no seed when it is empty or holds no digit', () => {
    expect(seedFromText('')).toBeUndefined();
    expect(seedFromText('   ')).toBeUndefined();
    expect(seedFromText('abc')).toBeUndefined();
  });

  it('names the number its digits spell, exactly, up to its full length', () => {
    expect(seedFromText('42')).toBe(42);
    expect(seedFromText('0')).toBe(0);
    expect(seedFromText('007')).toBe(7);
    // A seed the game drew from the clock, as a journal shows it.
    expect(seedFromText('1759590000000')).toBe(1759590000000);
    expect(seedFromText('9'.repeat(SEED_MAX_DIGITS))).toBe(999_999_999_999_999);
    expect(Number.isSafeInteger(Number('9'.repeat(SEED_MAX_DIGITS)))).toBe(true);
    expect(Number.isSafeInteger(Number('9'.repeat(SEED_MAX_DIGITS + 1)))).toBe(false);
  });

  it('names the seed the URL dial would for the same digits', () => {
    for (const digits of ['7', '42', '1759590000000']) {
      expect(seedFromText(digits)).toBe(parseRunConfigFromURL(`?seed=${digits}`).seed);
    }
  });
});

describe('116c-post2 — the seed a run shows', () => {
  const snapshotOf = (seed: number) => new Run(seed, new EventBus<GameEvents>()).toJSON();

  it('typed back into the field, names the same run', () => {
    // Small seeds, the two sides of 2^32, a seed from the clock, the field's longest.
    for (const seed of [0, 7, 4_294_967_295, 4_294_967_296, 1759590000000, 999_999_999_999_999]) {
      const original = snapshotOf(seed);
      const shown = seedShown(original.streamRoot);
      expect(shown.length).toBeLessThanOrEqual(10);
      expect(cleanSeedText(shown)).toBe(shown);
      const typed = seedFromText(shown);
      expect(typed).toBeDefined();
      expect(snapshotOf(typed!)).toEqual(original);
    }
  });

  it('the control: a neighbouring seed is another run', () => {
    expect(snapshotOf(8)).not.toEqual(snapshotOf(7));
  });
});

describe('116j — the credits on the way to the menu', () => {
  it('open after the first won run on a page that goes to the menu, and at no other end', () => {
    expect(creditsOnTheWay(true, true, false)).toBe(true);
    // Seen before, a defeat, and a page booted by a run dial.
    expect(creditsOnTheWay(true, true, true)).toBe(false);
    expect(creditsOnTheWay(false, true, false)).toBe(false);
    expect(creditsOnTheWay(true, false, false)).toBe(false);
  });
});
