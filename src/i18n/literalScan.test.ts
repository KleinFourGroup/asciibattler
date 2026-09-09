import { describe, expect, it } from 'vitest';
import { isProseLike, scanSource } from './literalScan';

const texts = (src: string) => scanSource('x.ts', src).map((l) => l.text);

describe('isProseLike (the heuristic)', () => {
  it('matches two words or a Capitalized word; not classes, ids, keys, caps, digits or glyphs', () => {
    for (const yes of ['No units in your roster.', 'Level Up!', 'Buy', 'Roster', 'Defeat', 'Continue ▸', '⚠ over capacity', 'Boss:  — level', 'click a card to empower', 'Lv']) {
      expect(isProseLike(yes), yes).toBe(true);
    }
    for (const no of [
      'roster-modal-title',
      'roster-modal cache-modal',
      'hud-speed hud-speed--pause',
      'unit:died',
      'roster.button',
      'DEV',
      'POW',
      '42',
      '✕',
      '▸ ',
      'preTurn',
      'div',
      'aria-label',
      'Digit0',
      'ArrowUp',
    ]) {
      expect(isProseLike(no), no).toBe(false);
    }
  });
});

describe('scanSource', () => {
  it('flags prose flowing into a sink, in string and template form, with line numbers', () => {
    const src = [
      `const el = document.createElement('div');`,
      `el.className = 'roster-modal-title';`,
      `el.textContent = 'No units in your roster.';`,
      `el.title = \`Boss: \${name} — level \${lvl}\`;`,
      `btn.textContent = t('roster.button');`,
    ].join('\n');
    expect(scanSource('x.ts', src)).toEqual([
      { file: 'x.ts', line: 3, text: 'No units in your roster.' },
      { file: 'x.ts', line: 4, text: 'Boss:  — level' },
    ]);
  });

  it('flags a Capitalized single word passed to a helper (the actionButton shape) and a nested ternary literal', () => {
    const src = [`this.actionButton('Buy', 'port-buy', onBuy);`, 'const s = `${n} unit${n === 1 ? "" : "s"} — ${ok ? "Ready" : "held"}`;'].join('\n');
    expect(texts(src)).toEqual(['Buy', 'Ready']);
  });

  it('excludes Error messages, dev callees, console, imports, property names, dev properties, class plumbing, case labels and literal types', () => {
    const src = [
      `import { x } from './Some Module';`,
      `throw new Error('entry page is not in pages');`,
      `fail(id, 'references unknown daemon id');`,
      `assertRefs(list, 'every ref must resolve');`,
      `console.warn('Atlas budget exceeded');`,
      `const o = { 'Display Name': 1 };`,
      `ctx.addIssue({ code: 'custom', message: 'duplicate choice id' });`,
      `const m = { fragmentShader: \`void main() { gl_FragColor = vec4(1.0); }\` };`,
      `el.className = 'roster-modal cache-modal';`,
      `el.className = \`card-list-button card-list-button--\${pos}\`;`,
      `el.classList.add('is-hidden', 'screen fade');`,
      `root.querySelector('.hud-card .name');`,
      'el.style.transform = `translate3d(${x}px, ${y}px, 0)`;',
      `el.style.setProperty('--glow', 'rgba(51, 255, 0, 0.5)');`,
      `switch (k) { case 'Escape': break; }`,
      `type Side = 'Player One' | 'enemy';`,
      `if (e.code === 'Space') go();`,
    ].join('\n');
    expect(texts(src)).toEqual([]);
  });

  it('skips a whole file carrying the file marker in its first lines', () => {
    const src = [`/** Font subset ranges — i18n-ok-file (a build table) */`, `const r = { label: 'Box drawing' };`].join('\n');
    expect(texts(src)).toEqual([]);
  });

  it('honours the // i18n-ok marker on the literal’s line', () => {
    const src = [`const theme = 'Volcanic'; // i18n-ok — a data key that happens to be Capitalized`, `const other = 'Volcanic';`].join('\n');
    expect(texts(src)).toEqual(['Volcanic']);
  });

  it('ignores comments entirely', () => {
    const src = [`// Shows "No units in your roster." when empty`, `/** The Roster button */`, `const n = 0;`].join('\n');
    expect(texts(src)).toEqual([]);
  });
});
