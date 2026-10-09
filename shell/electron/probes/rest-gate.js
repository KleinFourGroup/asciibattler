// The rest gate where a player meets it (117.75b): the page as it is laid
// out, and a run closed on it and continued.
//
//   npm run probe -- shell/electron/probes/rest-gate.js --seed=1 --dials=firstNode=rest --window=offscreen --profile=<dir> --shot=<png> '--arg={"mode":"enter","pool":20,"heal":10,"xp":200}'
//   npm run probe -- shell/electron/probes/rest-gate.js --query= --window=offscreen --profile=<dir> '--arg={"mode":"continue","pool":20,"heal":10,"xp":200}'
//
// `enter` sets the pool to `pool` on the map (a new run's is full, and a
// full pool has nothing to heal), clicks the frontier node, which the dial
// made a rest, and reads the page. It leaves the page up, so the save the
// profile holds is the one taken at the gate. `continue` is a second launch
// on that profile, at the menu: it clicks Continue, reads the page again
// (the pool must be as it was saved, unhealed), clicks the option, and reads
// where the run went and what the pool is. With `arg.stay: true` it stops on
// the continued page, so `--shot` shows it and the save stays at the gate.
//
// `heal` and `xp` are what the page must say, worked out by the caller from
// the raw config (`config/health.json`: restHealFraction x playerHealthMax;
// `config/leveling.json`: restXp), so the page is held to the files and not
// to the code that reads them. `arg.full: true` in `enter` leaves the pool
// full instead and expects the full-pool line.
//
// What it cannot do is press a key: a page script's keyboard events move no
// focus and fire no default action. It reports that the screen holds focus
// and that the option is the first control a Tab would reach.
export default async function restGate(arg = {}) {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const game = window.__game;
  const probe = window.__probe;
  // A fade is 180 ms, and the screen before leaves after it.
  const settle = async () => {
    await sleep(500);
    await probe.frame(0);
  };
  const shown = (el) => el !== null && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  const box = (el) => {
    const r = el.getBoundingClientRect();
    return [r.left, r.top, r.right, r.bottom].map((v) => Math.round(v));
  };
  const where = async () => {
    const report = await probe.ready();
    return { scene: report.scene, phase: report.phase };
  };
  const page = () => {
    const screens = [...document.querySelectorAll('#ui .event-screen--rest')].filter(shown);
    if (screens.length !== 1) return { screens: screens.length };
    const screen = screens[0];
    const q = (sel) => screen.querySelector(sel);
    const option = q('button.event-choice');
    const body = q('.event-body');
    const column = document.querySelector('.control-column');
    const tabbable = [...screen.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter(
      (el) => shown(el) && !el.disabled,
    );
    return {
      screens: 1,
      heading: q('.event-heading')?.textContent ?? null,
      text: q('.event-page-text')?.textContent ?? null,
      label: q('.event-choice__label')?.textContent ?? null,
      effect: q('.event-choice__req')?.textContent ?? null,
      options: screen.querySelectorAll('button.event-choice').length,
      headingColor: getComputedStyle(q('.event-heading')).color,
      optionBorder: getComputedStyle(option).borderTopColor,
      screenHoldsFocus: document.activeElement === screen,
      firstTabStopIsOption: tabbable[0] === option,
      viewport: [innerWidth, innerHeight],
      body: box(body),
      column: column && shown(column) ? box(column) : null,
      scrolls: screen.scrollHeight > screen.clientHeight + 1,
    };
  };
  const fmt = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
  const wantEffect = (heal) => (heal > 0 ? `Morale +${fmt(heal)} · every unit +${arg.xp} XP` : `Morale is full · every unit +${arg.xp} XP`);
  const judgePage = (p, pool, heal) => {
    const wrong = [];
    if (p.screens !== 1) return [`${p.screens} rest screens shown`];
    if (p.heading !== 'Z Rest') wrong.push(`heading ${JSON.stringify(p.heading)}`);
    if (p.text !== 'You and your men find a quiet place to rest and train.') wrong.push(`text ${JSON.stringify(p.text)}`);
    if (p.label !== '▸ Best we take a break') wrong.push(`label ${JSON.stringify(p.label)}`);
    if (p.effect !== wantEffect(heal)) wrong.push(`effect ${JSON.stringify(p.effect)}, want ${JSON.stringify(wantEffect(heal))}`);
    if (p.options !== 1) wrong.push(`${p.options} options`);
    if (!p.screenHoldsFocus) wrong.push('the screen does not hold focus');
    if (!p.firstTabStopIsOption) wrong.push('the option is not the first tab stop');
    if (p.scrolls) wrong.push('the page scrolls');
    const [l, t, r, b] = p.body;
    if (l < 0 || t < 0 || r > p.viewport[0] || b > p.viewport[1]) wrong.push(`the body ${p.body} leaves the page ${p.viewport}`);
    if (p.column === null) wrong.push('no control column');
    else if (r > p.column[0]) wrong.push(`the body's right ${r} runs under the control column at ${p.column[0]}`);
    if (game.run.playerHealth !== pool) wrong.push(`the pool is ${game.run.playerHealth}, not ${pool}`);
    return wrong;
  };

  const mode = arg.mode ?? 'enter';
  const out = { mode };
  const wrong = [];

  if (mode === 'enter') {
    const start = await where();
    if (start.scene !== 'MapScene' || start.phase !== 'map') return { ok: false, mode, wrong: [`started at ${JSON.stringify(start)}`] };
    const pool = arg.full ? game.run.playerHealth : arg.pool;
    const heal = arg.full ? 0 : arg.heal;
    game.run.playerHealth = pool;
    // A direct write emits no `run:poolChanged`, so repaint the chip by hand
    // or a screenshot shows the old number beside the new effect line.
    game.poolOverlay.refresh();
    const nodes = [...document.querySelectorAll('#ui .map-node.frontier')].filter(shown);
    if (nodes.length !== 1) return { ok: false, mode, wrong: [`${nodes.length} frontier nodes on the map`] };
    out.nodeGlyph = nodes[0].textContent;
    nodes[0].click();
    await settle();
    out.at = await where();
    if (out.at.scene !== 'RestScene' || out.at.phase !== 'rest') wrong.push(`after the click: ${JSON.stringify(out.at)}`);
    out.page = page();
    wrong.push(...judgePage(out.page, pool, heal));
    // Electron's store write is asynchronous; let the autosave at the gate
    // land before the window closes.
    await sleep(1500);
    return { ok: wrong.length === 0, ...out, wrong };
  }

  // continue: the menu, on a profile whose slot was saved at the gate.
  out.menu = await where();
  const cont = [...document.querySelectorAll('#ui .menu-rows button')].filter(shown).find((b) => b.textContent === 'Continue');
  if (cont === undefined) return { ok: false, ...out, wrong: ['the menu has no Continue'] };
  cont.click();
  await settle();
  out.at = await where();
  if (out.at.scene !== 'RestScene' || out.at.phase !== 'rest') wrong.push(`after Continue: ${JSON.stringify(out.at)}`);
  out.page = page();
  wrong.push(...judgePage(out.page, arg.pool, arg.heal));
  out.chip = [...document.querySelectorAll('.chrome-column *')].filter(shown).map((el) => el.textContent).find((s) => /^\s*\d+(\.\d+)?\s*\/\s*\d+\s*$/.test(s ?? '')) ?? null;
  if (wrong.length > 0 || arg.stay) return { ok: wrong.length === 0, ...out, wrong };

  const team = JSON.stringify(game.run.team.map((u) => [u.level, u.xp]));
  [...document.querySelectorAll('#ui .event-screen--rest button.event-choice')].filter(shown)[0].click();
  await settle();
  out.after = await where();
  out.poolAfter = game.run.playerHealth;
  out.teamChanged = JSON.stringify(game.run.team.map((u) => [u.level, u.xp])) !== team;
  if (out.poolAfter !== arg.pool + arg.heal) wrong.push(`the pool after the option is ${out.poolAfter}, not ${arg.pool + arg.heal}`);
  if (!out.teamChanged) wrong.push('no unit banked XP');
  if (!['PromotionScene', 'MapScene'].includes(out.after.scene)) wrong.push(`after the option: ${JSON.stringify(out.after)}`);
  if ([...document.querySelectorAll('#ui .event-screen--rest')].filter(shown).length !== 0) wrong.push('the rest page is still up');
  return { ok: wrong.length === 0, ...out, wrong };
}
