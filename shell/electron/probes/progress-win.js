// A won run and the store's progress, across launches of the shell on one
// profile (§117d):
//
//   npm run probe -- shell/electron/probes/progress-win.js --profile=<dir> --arg=<json>
//
// Each launch reads the record of wins the launches before it left (the
// store file's text as the preload read it, not through the store), then,
// unless `act` is false, starts a run if the page has none (`character` and
// `pick`, the level asked for), forces its end as won, and reports the level
// the run was played at and its dials. What that win wrote is the next
// launch's `stored`.
//
// The argument:
//   character, pick   the card clicked and the level asked for, on a page
//                     with no run (the menu's); a URL with `character=` has
//                     its run already
//   times             how many times the win is told (default 1)
//   act               false: read only
//   wantStored        the record expected at this launch's start (null: no
//                     progress stored at all)
//   wantLevel, wantDials   the level and dials expected of the run
//
// The end is forced (process/browser-pane.md "Fixtures"): the run's phase is
// set and `run:victory` emitted, so this holds the listeners and the store,
// not a last battle.
//
// The runner wraps this file's one function in a call, so everything the
// script needs lives inside it.
export default async function progressWin(arg = {}) {
  const game = window.__game;
  const wrong = [];
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  // The record as stored when the page loaded, key order and all.
  const file = JSON.parse(window.shellStore.initial ?? '{}');
  const text = file['asciibattler:progress'];
  const stored = text === undefined ? null : JSON.parse(text).data.bestWin;
  if ('wantStored' in arg && !same(stored, arg.wantStored)) wrong.push('stored');

  if (arg.act === false) return { ok: wrong.length === 0, wrong, stored };

  if (game.run === null) {
    if (arg.character === undefined) return { ok: false, error: 'the page has no run and the argument names no character' };
    game.dispatch({ kind: 'chooseCharacter', characterId: arg.character, escalation: arg.pick ?? 0 });
  }
  const run = game.run;
  const seen = { character: run.character.id, level: run.escalation, dials: game.runDials };
  if ('wantLevel' in arg && seen.level !== arg.wantLevel) wrong.push('level');
  if ('wantDials' in arg && seen.dials !== arg.wantDials) wrong.push('dials');

  run.phase = 'complete';
  for (let i = 0; i < (arg.times ?? 1); i++) game.bus.emit('run:victory', {});
  // Electron's write is asynchronous (main writes a temporary file and
  // renames it); give it time to land before the window closes.
  await new Promise((resolve) => setTimeout(resolve, 1500));
  const endScreen = document.querySelector('.gameover-heading') !== null;
  if (!endScreen) wrong.push('endScreen');
  return { ok: wrong.length === 0, wrong, stored, ...seen, endScreen };
}
