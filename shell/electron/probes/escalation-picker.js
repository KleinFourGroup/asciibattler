// Character select's Escalation picker and the end screen's two lines
// (§117e), in a window with real frames:
//
//   npm run probe -- shell/electron/probes/escalation-picker.js --window=offscreen --profile=<dir> --arg=<json>
//
// The profile's `store.json` decides what is unlocked: an empty profile has
// no picker to show, and one holding `asciibattler:progress` with a
// `bestWin` shows a picker under each character that has won.
//
// What it does, on a page booted to the menu:
//   1. New run, then reads character select at each text size: every box's
//      rectangle (the cards, the pickers, Back), which pickers show, and how
//      far anything is off the page.
//   2. At size 1, walks the first picker that shows down to 0 and back up to
//      its ceiling, a click at a time, and reads after each click the name,
//      the line, which step is inert and where the steps, the card and Back
//      are. `moved` lists every box that was not where the first read had it.
//   3. With `pick: { card, level }`, steps that card's picker to the level,
//      clicks the card, forces the run's end as won and reads the end
//      screen's level line and unlock line.
//
// The argument:
//   seed        text for the menu's seed field (a seeded run)
//   pick        { card: <index>, level: <n> }; without it the script stops
//               after the walk
//   want        { shown: [<card index>...], level, dials, endLevel, endUnlocked }
//               (endLevel and endUnlocked: the line's text, or null for none)
//
// `boxes` in the result holds every rectangle at each size, for comparing
// two profiles: a card must be where it is with no picker showing.
//
// The runner wraps this file's one function in a call, so everything the
// script needs lives inside it.
export default async function escalationPicker(arg = {}) {
  const SCALES = [1, 1.1, 1.25, 1.5];
  const game = window.__game;
  const html = document.documentElement;
  const wrong = [];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const frames = async (n = 3) => {
    for (let i = 0; i < n; i++) await Promise.race([new Promise((r) => requestAnimationFrame(() => r())), sleep(400)]);
  };
  const rect = (el) => {
    const r = el.getBoundingClientRect();
    return [r.left, r.top, r.width, r.height].map((v) => Math.round(v * 10) / 10).join(',');
  };
  const want = arg.want ?? {};

  // The menu, then character select.
  if (arg.seed !== undefined) {
    const field = document.querySelector('.menu-seed__field');
    if (field === null) return { ok: false, error: 'no seed field on the menu' };
    field.value = arg.seed;
    field.dispatchEvent(new Event('input', { bubbles: true }));
  }
  const newRun = [...document.querySelectorAll('#ui button')].find((b) => b.textContent.trim() === 'New run');
  if (newRun === undefined) return { ok: false, error: 'no New run row: is this page the menu?' };
  newRun.click();
  await sleep(600);
  await frames();

  const slots = () => [...document.querySelectorAll('.charselect-slot')];
  const parts = (slot) => ({
    card: slot.querySelector('.charselect-card'),
    picker: slot.querySelector('.charselect-level'),
    lower: slot.querySelectorAll('.charselect-level__step')[0],
    name: slot.querySelector('.charselect-level__name'),
    raise: slot.querySelectorAll('.charselect-level__step')[1],
    adds: slot.querySelector('.charselect-level__adds'),
  });
  if (slots().length === 0) return { ok: false, error: 'character select has no slots' };
  const back = [...document.querySelectorAll('.charselect-screen > button')].at(-1);
  const heading = document.querySelector('.charselect-heading');

  // 1. Each text size. `off` is how far anything is past the window's edge
  // with the screen scrolled to its top; `reach` says whether the screen
  // scrolls, and how far its first and last boxes are from the window's
  // edges at the scroll's two ends (0 or less: in the window).
  const screen = document.querySelector('.charselect-screen');
  const boxes = {};
  const off = {};
  const reach = {};
  const shown = slots().map((slot) => getComputedStyle(parts(slot).picker).visibility === 'visible');
  for (const scale of SCALES) {
    html.style.fontSize = scale === 1 ? '' : `${scale * 100}%`;
    await frames();
    const at = { heading: rect(heading), back: rect(back) };
    slots().forEach((slot, i) => {
      const p = parts(slot);
      for (const [key, el] of Object.entries(p)) at[`${i}.${key}`] = rect(el);
    });
    boxes[scale] = at;
    let over = 0;
    for (const el of [heading, back, ...slots()]) {
      const r = el.getBoundingClientRect();
      over = Math.max(over, -r.left, -r.top, r.right - innerWidth, r.bottom - innerHeight);
    }
    off[scale] = Math.round(over * 10) / 10;
    const round = (v) => Math.round(v * 10) / 10;
    screen.scrollTop = 0;
    const topAtStart = round(-heading.getBoundingClientRect().top);
    screen.scrollTop = screen.scrollHeight;
    const bottomAtEnd = round(back.getBoundingClientRect().bottom - innerHeight);
    screen.scrollTop = 0;
    reach[scale] = { scrolls: screen.scrollHeight > screen.clientHeight, topAtStart, bottomAtEnd };
  }
  html.style.fontSize = '';
  await frames();
  if (want.shown !== undefined) {
    const got = shown.flatMap((is, i) => (is ? [i] : []));
    if (JSON.stringify(got) !== JSON.stringify(want.shown)) wrong.push('shown');
  }

  // 2. The walk, on the first picker that shows.
  const walk = [];
  const moved = [];
  const first = shown.indexOf(true);
  if (first !== -1) {
    const p = parts(slots()[first]);
    const watched = { lower: p.lower, name: p.name, raise: p.raise, card: p.card, picker: p.picker, back };
    slots().forEach((slot, i) => {
      watched[`card${i}`] = parts(slot).card;
    });
    const where = () => Object.fromEntries(Object.entries(watched).map(([key, el]) => [key, rect(el)]));
    const read = (did) => ({
      did,
      name: p.name.textContent,
      line: [...p.adds.children].filter((l) => !l.classList.contains('is-reserved')).map((l) => l.textContent).join(' | '),
      lowerInert: p.lower.getAttribute('aria-disabled') === 'true',
      raiseInert: p.raise.getAttribute('aria-disabled') === 'true',
    });
    const home = where();
    const check = (did) => {
      const now = where();
      for (const key of Object.keys(home)) if (now[key] !== home[key]) moved.push(`${did}: ${key} ${home[key]} -> ${now[key]}`);
    };
    walk.push(read('open'));
    // Down past 0, then up past the ceiling: the extra click at each end
    // must change nothing.
    for (let i = 0; i < 8 && walk.at(-1).did !== 'stuck-down'; i++) {
      const before = p.name.textContent;
      p.lower.click();
      await frames(1);
      walk.push(read(p.name.textContent === before ? 'stuck-down' : 'down'));
      check(`down ${i}`);
    }
    for (let i = 0; i < 8 && walk.at(-1).did !== 'stuck-up'; i++) {
      const before = p.name.textContent;
      p.raise.click();
      await frames(1);
      walk.push(read(p.name.textContent === before ? 'stuck-up' : 'up'));
      check(`up ${i}`);
    }
    if (moved.length > 0) wrong.push('moved');
    // The picker opens at the ceiling, so no step may name a level above
    // the one it opened at, nor one under 0.
    const levels = walk.map((step) => Number(step.name.replace(/[^\d-]+/g, '')));
    if (Math.max(...levels) > levels[0]) wrong.push('aboveCeiling');
    if (Math.min(...levels) !== 0) wrong.push('floor');
  }

  if (arg.pick === undefined) return { ok: wrong.length === 0, wrong, shown, off, reach, walk, moved, boxes };

  // 3. Pick, start, and a won end.
  const p = parts(slots()[arg.pick.card]);
  const levelOf = () => Number(p.name.textContent.replace(/\D+/g, ''));
  for (let i = 0; i < 8 && levelOf() > arg.pick.level; i++) p.lower.click();
  for (let i = 0; i < 8 && levelOf() < arg.pick.level; i++) p.raise.click();
  const pickedName = p.name.textContent;
  p.card.click();
  await sleep(300);
  const run = game.run;
  if (run === null) return { ok: false, error: 'the card started no run', wrong, shown, walk };
  const seen = { pickedName, level: run.escalation, dials: game.runDials };
  if (want.level !== undefined && seen.level !== want.level) wrong.push('level');
  if (want.dials !== undefined && seen.dials !== want.dials) wrong.push('dials');

  run.phase = 'complete';
  game.bus.emit('run:victory', {});
  await sleep(800);
  await frames();
  const text = (selector) => document.querySelector(selector)?.textContent ?? null;
  const end = { level: text('.gameover-escalation'), unlocked: text('.gameover-unlocked'), heading: text('.gameover-heading') };
  if ('endLevel' in want && end.level !== want.endLevel) wrong.push('endLevel');
  if ('endUnlocked' in want && end.unlocked !== want.endUnlocked) wrong.push('endUnlocked');
  // The end screen at each size: how far its content is off the page.
  const endOff = {};
  for (const scale of SCALES) {
    html.style.fontSize = scale === 1 ? '' : `${scale * 100}%`;
    await frames();
    let over = 0;
    for (const el of document.querySelectorAll('.gameover-screen > *')) {
      const r = el.getBoundingClientRect();
      over = Math.max(over, -r.left, -r.top, r.right - innerWidth, r.bottom - innerHeight);
    }
    endOff[scale] = Math.round(over * 10) / 10;
  }
  html.style.fontSize = '';
  // Electron's write is asynchronous; give the record time to land.
  await sleep(1200);
  return { ok: wrong.length === 0, wrong, shown, off, reach, walk, moved, ...seen, end, endOff, boxes };
}
