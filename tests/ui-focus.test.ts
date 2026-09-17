/**
 * 100b — THE FOCUS PINS (Round 7 §100; the ui-motion shape applied to the
 * keyboard's hover). The idiom (DESIGN §UI idioms "Focus"): the focus
 * state IS the hover state, plus ONE ring on every control under
 * `:focus-visible`. A new `:hover` rule anywhere in the sheet fails here
 * until its `:focus-visible` twin sits in the same selector list — the
 * guard rides `npm test`, the forgetful path (AGENTS: put the guard where
 * the mistake happens).
 *
 * Contract:
 *   1. every selector carrying `:hover` has its `:focus-visible` twin (the
 *      same selector with `:hover` → `:focus-visible`) in the SAME block's
 *      selector list — same declarations, by construction;
 *   2. the ONE ring rule exists, at the pinned selector, and sets a non-none
 *      `outline` (a ring is a SHAPE — it survives the 98a grey read);
 *   3. no rule sets `outline: none` / `outline: 0` except the CONTAINERS'
 *      `:focus` rules — the two 96f modals and the 100e screen root (a
 *      container is not a control); never under `:focus-visible`, never on
 *      a control;
 *   4. the map node's ring rides `box-shadow`, never `outline` (98c's
 *      frontier double ring owns `outline` on the node).
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { selectorsOf, stripCssComments, styleRulesOf } from './cssBlocks';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SHEET = 'src/ui/ui.css';

/** The one ring rule's selector, verbatim (ui.css §100). */
const RING_SELECTOR = ":where(button, select, [role='button'], [tabindex='0']):focus-visible";
/** The only rules allowed to drop the outline: the 96f modal containers and
 *  the 100e screen container (`Screen.present` focuses it, tabindex=-1). */
const OUTLINE_NONE_ALLOWED = [
  '.roster-modal:focus',
  '.sector-map-overlay:focus',
  '.screen-fade:focus',
];

const css = stripCssComments(readFileSync(join(ROOT, SHEET), 'utf8'));
const rules = styleRulesOf(css);

const outlineOf = (body: string): string | undefined =>
  /(?:^|[\s;])outline\s*:\s*([^;]+);/.exec(body)?.[1]?.trim();

describe('100b — the focus idiom', () => {
  const hoverSelectors = rules.flatMap((r) =>
    selectorsOf(r.prelude).filter((s) => s.includes(':hover')),
  );

  it('parsed the sheet (the format or the walker drifted otherwise)', () => {
    expect(rules.length).toBeGreaterThan(100);
    expect(hoverSelectors.length).toBeGreaterThan(25);
  });

  it('every :hover selector has its :focus-visible twin in the same selector list', () => {
    const missing: string[] = [];
    for (const r of rules) {
      const sels = selectorsOf(r.prelude);
      for (const s of sels) {
        if (!s.includes(':hover')) continue;
        const twin = s.replace(':hover', ':focus-visible');
        if (!sels.includes(twin)) missing.push(`${s}  (wants "${twin}" beside it)`);
      }
    }
    expect(
      missing,
      `a :hover rule without its :focus-visible twin:\n${missing.join('\n')}`,
    ).toEqual([]);
  });

  it('the ONE ring rule exists at the pinned selector and paints an outline', () => {
    const ring = rules.filter((r) => selectorsOf(r.prelude).join(', ') === RING_SELECTOR);
    expect(ring, `no rule at "${RING_SELECTOR}"`).toHaveLength(1);
    const outline = outlineOf(ring[0]!.body);
    expect(outline).toBeDefined();
    expect(outline).not.toMatch(/^(none|0)\b/);
    expect(outline).toMatch(/solid/);
  });

  it('outline: none appears only on the two modal containers, never under :focus-visible', () => {
    const offenders: string[] = [];
    for (const r of rules) {
      const outline = outlineOf(r.body);
      if (outline === undefined || !/^(none|0)\b/.test(outline)) continue;
      const sels = selectorsOf(r.prelude);
      if (
        sels.some((s) => s.includes(':focus-visible')) ||
        !sels.every((s) => OUTLINE_NONE_ALLOWED.includes(s))
      ) {
        offenders.push(r.prelude.replace(/\s+/g, ' '));
      }
    }
    expect(offenders).toEqual([]);
  });

  it("the map node's focus ring rides box-shadow, not outline (98c owns the node's outline)", () => {
    const node = rules.filter(
      (r) => selectorsOf(r.prelude).join(', ') === '.map-node:focus-visible',
    );
    expect(node, 'no `.map-node:focus-visible` rule').toHaveLength(1);
    expect(outlineOf(node[0]!.body)).toBeUndefined();
    expect(node[0]!.body).toMatch(/box-shadow\s*:/);
  });
});
