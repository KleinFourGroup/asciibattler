/**
 * 117.5h — THE LOADING LINE'S PINS. The line is static text in index.html,
 * so the page says something from its first paint, and src/main.ts takes it
 * down once Game's constructor has mounted the first screen. Two ways it
 * goes wrong without anything failing by itself: the line is dropped from
 * the page (a black frame again while 1.2 MB of script loads), or its
 * removal is dropped or moved ahead of the Game (the line left over the
 * menu, or gone before there is a screen). Both are pinned here, on every
 * `npm test`.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (file: string): string => readFileSync(join(ROOT, file), 'utf8');

const ID = 'boot-line';

/** What is wrong with a page shell, as a list; empty when it holds the line. */
function pageFaults(html: string): string[] {
  const faults: string[] = [];
  const line = new RegExp(`<div id="${ID}">([^<]*)</div>`).exec(html);
  if (!line) faults.push(`no <div id="${ID}"> with plain text`);
  else if (line[1]!.trim() === '') faults.push('the line is empty');
  if (html.split(`id="${ID}"`).length - 1 > 1) faults.push('the line is there more than once');
  const script = html.indexOf('<script type="module"');
  if (line && script >= 0 && line.index > script) faults.push('the line comes after the module script');
  const noscript = /<noscript>([\s\S]*?)<\/noscript>/.exec(html);
  if (!noscript) faults.push('no <noscript>');
  else if (noscript[1]!.replace(/<[^>]*>/g, '').trim() === '') faults.push('the <noscript> says nothing');
  return faults;
}

/** What is wrong with the boot's handling of the line; empty when it is
 *  removed after the Game is built. */
function bootFaults(main: string): string[] {
  const faults: string[] = [];
  const built = main.indexOf('new Game(');
  const removed = main.indexOf(`getElementById('${ID}')?.remove()`);
  if (built < 0) faults.push('no `new Game(` in the boot');
  if (removed < 0) faults.push('the boot never removes the line');
  else if (removed < built) faults.push('the line is removed before the Game is built');
  return faults;
}

describe('117.5h — the loading line', () => {
  it('reads planted shells: a missing line, an empty one, a late one and a silent noscript are faults', () => {
    const good = `<body><div id="ui"></div><div id="${ID}">Loading…</div><noscript><div>Needs scripts.</div></noscript><script type="module" src="/x"></script></body>`;
    expect(pageFaults(good)).toEqual([]);
    expect(pageFaults(good.replace(`<div id="${ID}">Loading…</div>`, ''))).toEqual([`no <div id="${ID}"> with plain text`]);
    expect(pageFaults(good.replace('Loading…', ' '))).toEqual(['the line is empty']);
    expect(pageFaults(good.replace('<div>Needs scripts.</div>', '<div></div>'))).toEqual(['the <noscript> says nothing']);
    const late = `<body><script type="module" src="/x"></script><div id="${ID}">Loading…</div><noscript>Needs scripts.</noscript></body>`;
    expect(pageFaults(late)).toEqual(['the line comes after the module script']);
  });

  it('reads planted boots: no removal, and a removal ahead of the Game, are faults', () => {
    const good = `const game = new Game(a, b);\ndocument.getElementById('${ID}')?.remove();\ngame.start();`;
    expect(bootFaults(good)).toEqual([]);
    expect(bootFaults('const game = new Game(a, b);\ngame.start();')).toEqual(['the boot never removes the line']);
    expect(bootFaults(`document.getElementById('${ID}')?.remove();\nconst game = new Game(a, b);`)).toEqual([
      'the line is removed before the Game is built',
    ]);
  });

  it('index.html holds the line and a noscript line', () => {
    expect(pageFaults(read('index.html'))).toEqual([]);
  });

  it('src/main.ts removes the line once the Game is built', () => {
    expect(bootFaults(read('src/main.ts'))).toEqual([]);
  });

  it('ui.css styles the line and its twin', () => {
    const css = read('src/ui/ui.css');
    expect(css).toContain(`#${ID},`);
    expect(css).toContain('#boot-noscript {');
  });
});
