/**
 * 97a — the tooltip's PURE part, pinned headless: `placeTooltip` (the
 * flip / clamp / caret arithmetic). The gestures, the fade and the host are
 * eyeball-only per TESTING. Every expectation derives from the exported
 * constants and the inputs, never from re-typed pixel numbers.
 */

import { describe, it, expect } from 'vitest';
import { CARET_INSET_PX, GAP_PX, MARGIN_PX, placeTooltip, type Rect, type Size } from './tooltip';

const VIEWPORT: Size = { w: 1000, h: 600 };
const TIP: Size = { w: 200, h: 40 };

const center = (r: Rect): number => r.x + r.w / 2;

describe('placeTooltip — the default: above, centered on the trigger', () => {
  const trigger: Rect = { x: 400, y: 300, w: 100, h: 30 };
  const p = placeTooltip(trigger, TIP, VIEWPORT);

  it('sits GAP_PX above the trigger', () => {
    expect(p.side).toBe('above');
    expect(p.y).toBe(trigger.y - GAP_PX - TIP.h);
  });

  it('centers on the trigger with the caret at the trigger center', () => {
    expect(p.x + TIP.w / 2).toBe(center(trigger));
    expect(p.x + p.caretX).toBe(center(trigger));
  });
});

describe('placeTooltip — the flip', () => {
  it('flips below when the top would clip (a trigger near the top edge)', () => {
    const trigger: Rect = { x: 400, y: 20, w: 100, h: 30 };
    const p = placeTooltip(trigger, TIP, VIEWPORT);
    expect(p.side).toBe('below');
    expect(p.y).toBe(trigger.y + trigger.h + GAP_PX);
  });

  it('stays above at exactly the room it needs (the boundary is inclusive)', () => {
    const y = MARGIN_PX + TIP.h + GAP_PX;
    const p = placeTooltip({ x: 400, y, w: 100, h: 30 }, TIP, VIEWPORT);
    expect(p.side).toBe('above');
    expect(p.y).toBe(MARGIN_PX);
  });

  it('picks the roomier side when neither fits, clamped to the margin', () => {
    const tall: Size = { w: 200, h: 500 };
    // Trigger low on the screen: more room above than below.
    const low = placeTooltip({ x: 400, y: 450, w: 100, h: 30 }, tall, VIEWPORT);
    expect(low.side).toBe('above');
    expect(low.y).toBe(MARGIN_PX);
    // Trigger high on the screen: more room below (but still not enough).
    const high = placeTooltip({ x: 400, y: 100, w: 100, h: 30 }, tall, VIEWPORT);
    expect(high.side).toBe('below');
    expect(high.y).toBe(VIEWPORT.h - MARGIN_PX - tall.h);
  });
});

describe('placeTooltip — the horizontal clamp keeps the caret on the trigger', () => {
  it('a trigger at the left edge: the box sits at the margin, the caret slides left', () => {
    const trigger: Rect = { x: 0, y: 300, w: 40, h: 30 };
    const p = placeTooltip(trigger, TIP, VIEWPORT);
    expect(p.x).toBe(MARGIN_PX);
    expect(p.caretX).toBe(Math.max(center(trigger) - p.x, CARET_INSET_PX));
    expect(p.caretX).toBeGreaterThanOrEqual(CARET_INSET_PX);
  });

  it('a trigger at the right edge: the box ends at the margin, the caret slides right', () => {
    const trigger: Rect = { x: VIEWPORT.w - 40, y: 300, w: 40, h: 30 };
    const p = placeTooltip(trigger, TIP, VIEWPORT);
    expect(p.x + TIP.w).toBe(VIEWPORT.w - MARGIN_PX);
    expect(p.caretX).toBeLessThanOrEqual(TIP.w - CARET_INSET_PX);
    expect(p.x + p.caretX).toBe(Math.min(center(trigger), p.x + TIP.w - CARET_INSET_PX));
  });

  it('a trigger just inside the clamp zone keeps the caret exactly on its center', () => {
    const trigger: Rect = { x: 50, y: 300, w: 100, h: 30 }; // center 100, box 0..200 → clamped to the margin
    const p = placeTooltip(trigger, TIP, VIEWPORT);
    expect(p.x).toBe(MARGIN_PX);
    expect(p.x + p.caretX).toBe(center(trigger));
  });

  it('a box wider than the viewport pins at the margin and the caret at the mid-inset', () => {
    const wide: Size = { w: 1200, h: 40 };
    const p = placeTooltip({ x: 400, y: 300, w: 100, h: 30 }, wide, VIEWPORT);
    expect(p.x).toBe(MARGIN_PX);
    expect(p.caretX).toBeGreaterThanOrEqual(CARET_INSET_PX);
    expect(p.caretX).toBeLessThanOrEqual(wide.w - CARET_INSET_PX);
  });
});
