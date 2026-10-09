// The text-size survey (116k): which boxes stop holding their text as the
// root font-size grows, on every screen of a driven run, in a window with
// real frames.
//
//   npm run probe -- shell/electron/probes/text-scale.js --seed=7 --window=offscreen --timeout=400 > run.json
//   npm run probe -- shell/electron/probes/text-scale.js --window=offscreen --arg={"mode":"menu"} > menu.json
//
//   npm run probe -- shell/electron/probes/text-scale.js --seed=7 --window=offscreen --timeout=400 --arg={"mode":"extras"} > extras.json
//
// The run mode plays a seeded run a command at a time and scans each phase's
// screen the first two times it comes up, a battle at four points, and the
// modals the chrome column's chips and the pre-turn pile buttons open. The
// menu mode scans the menu, the settings modal, the credits and character
// select. The extras mode (117.5a) scans what a driven run never puts up: one
// tooltip of every kind on each phase's first screen, opened afresh at each
// size, with a plate planted wider than the page as its known answer; the
// cache modal full of packets and one over; and the sector-cleared screen,
// by its event, with the chips up. It changes the run it plays (the packets),
// so its screens are not the run mode's. `--size=<w>x<h>` sets the window,
// and the answer depends on it: a
// size that holds on a tall window can run out of room on a short one.
//
// Each scan lays the page out at every size in turn (the root element's
// font-size, as the Text size setting sets it) and reports what is new
// against the same page at 1: text that no longer fits its own box (spill
// where it paints outside, cut where it is hidden, scroll where a scrollbar
// takes it), a box that leaves the page (off), and two lines of text that
// now overlap (overlap). It also reports what it finds at 1, so two window
// sizes can be compared. It is a survey, not a gate: `ok` is false only when
// the survey can't be trusted. Before any scan it plants one known case of
// each kind, a control sized in rem and one at opacity 0, and fails unless
// it classes them so.
//
// The argument: `scales` (default the offered sizes, src/ui/textScale.ts),
// `mode` (`run` or `menu`), `seed` (the driver's), `boxes: true` (every
// box's rectangle at 1, for holding a stylesheet change against the sheet
// before it: two reports of an unchanged page agree on every screen but the
// battles), `still: true` (reduced motion, which that comparison needs),
// `resize: true` (a resize event after each size). What the battle scans
// find among the board's overlays moves with the fight, so read those by
// eye. How the 116k sweep read is in WORKLOG §116k.
export default async function survey(arg = {}) {
  const SCALES = arg.scales ?? [1, 1.1, 1.25, 1.5];
  const KINDS = ['spill', 'cut', 'scroll', 'off', 'overlap'];
  const TOL = 1.5;
  const CAP = 60;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const frames = async (n = 2) => {
    for (let i = 0; i < n; i++) await Promise.race([new Promise((r) => requestAnimationFrame(() => r())), sleep(400)]);
  };
  const html = document.documentElement;
  const game = window.__game;
  const probe = window.__probe;
  // Reduced motion, so a box compared across two runs is not caught in
  // mid-animation (a card entering, the draw button's pulse).
  if (arg.still) game.settings.set('motion', 'reduced');

  const cls = (el) => (typeof el.className === 'string' && el.className.trim() !== '' ? '.' + el.className.trim().split(/\s+/).join('.') : '');
  // Classes that say a state or a variant, not which rule sizes the box.
  const plain = (s) => s.replace(/\.(is-[\w-]+|unit-card--[\w-]+|preturn-card-enter|screen-fade|locked|frontier|visited|current)/g, '');
  const name = (el) => plain(el.id ? '#' + el.id : el.tagName.toLowerCase() + cls(el));
  const sig = (el) => (el.parentElement ? name(el.parentElement) + ' > ' : '') + name(el);
  const key = (el) => {
    const parts = [];
    for (let e = el; e && e !== document.body; e = e.parentElement) {
      parts.push(e.id ? '#' + e.id : [...e.parentElement.children].indexOf(e));
    }
    return parts.reverse().join('/');
  };

  const shown = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    return el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true, visibilityProperty: true, opacityProperty: true });
  };
  // An ancestor that clips or scrolls owns what sticks out of it: the finding
  // is the ancestor's (cut or scroll), not an element off the page.
  const clipped = (el, scope) => {
    for (let e = el.parentElement; e && e !== scope.parentElement; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') return true;
    }
    return false;
  };
  const overBy = (r) => Math.max(-r.left, -r.top, r.right - innerWidth, r.bottom - innerHeight);

  const collect = (scopes) => {
    const out = Object.fromEntries(KINDS.map((k) => [k, new Map()]));
    const lines = [];
    const range = document.createRange();
    // What an element's own text is clipped to: the boxes of the element and
    // of every ancestor that clips or scrolls. A line scrolled out of view
    // overlaps nothing (the first self-check caught the scan saying it did).
    const clips = new Map();
    const clipOf = (el) => {
      if (!el || el === document.body) return null;
      if (clips.has(el)) return clips.get(el);
      let clip = clipOf(el.parentElement);
      const cs = getComputedStyle(el);
      if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') {
        const r = el.getBoundingClientRect();
        clip = clip === null
          ? { l: r.left, t: r.top, r: r.right, b: r.bottom }
          : { l: Math.max(clip.l, r.left), t: Math.max(clip.t, r.top), r: Math.min(clip.r, r.right), b: Math.min(clip.b, r.bottom) };
      }
      clips.set(el, clip);
      return clip;
    };
    for (const scope of scopes) {
      for (const el of scope.querySelectorAll('*')) {
        if (!shown(el)) continue;
        const cs = getComputedStyle(el);
        if (cs.display !== 'inline') {
          const d = { x: el.scrollWidth - el.clientWidth, y: el.scrollHeight - el.clientHeight };
          const o = { x: cs.overflowX, y: cs.overflowY };
          for (const axis of ['x', 'y']) {
            if (d[axis] <= TOL) continue;
            const kind = o[axis] === 'visible' ? 'spill' : o[axis] === 'hidden' || o[axis] === 'clip' ? 'cut' : 'scroll';
            out[kind].set(`${key(el)} ${axis}`, { sig: `${sig(el)} [${axis}]`, by: Math.round(d[axis]) });
          }
        }
        const r = el.getBoundingClientRect();
        const over = overBy(r);
        if (over > TOL && !clipped(el, scope)) {
          const parentOver = el.parentElement ? overBy(el.parentElement.getBoundingClientRect()) : 0;
          // Only the element that sticks out further than its parent does.
          if (over > parentOver + TOL) out.off.set(key(el), { sig: sig(el), by: Math.round(over) });
        }
        for (const node of el.childNodes) {
          if (node.nodeType !== 3 || node.nodeValue.trim() === '') continue;
          range.selectNodeContents(node);
          const clip = clipOf(el);
          for (const q of range.getClientRects()) {
            const line = clip === null
              ? { el, l: q.left, t: q.top, r: q.right, b: q.bottom }
              : { el, l: Math.max(q.left, clip.l), t: Math.max(q.top, clip.t), r: Math.min(q.right, clip.r), b: Math.min(q.bottom, clip.b) };
            if (line.r - line.l > 0 && line.b - line.t > 0) lines.push(line);
          }
        }
      }
    }
    for (let i = 0; i < lines.length; i++) {
      const a = lines[i];
      for (let j = i + 1; j < lines.length; j++) {
        const b = lines[j];
        if (a.el === b.el) continue;
        const w = Math.min(a.r, b.r) - Math.max(a.l, b.l);
        if (w <= TOL) continue;
        const h = Math.min(a.b, b.b) - Math.max(a.t, b.t);
        if (h <= TOL) continue;
        if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
        const k = `${key(a.el)} x ${key(b.el)}`;
        const by = Math.round(Math.min(w, h));
        const had = out.overlap.get(k);
        if (!had || had.by < by) out.overlap.set(k, { sig: [sig(a.el), sig(b.el)].sort().join(' x '), by });
      }
    }
    return out;
  };

  const setScale = async (s) => {
    html.style.fontSize = s === 1 ? '' : `${s * 100}%`;
    if (arg.resize) window.dispatchEvent(new Event('resize'));
    await frames(2);
  };

  const grouped = (found, skip) => {
    const groups = new Map();
    for (const [id, f] of found) {
      if (skip && skip.has(id)) continue;
      const g = groups.get(f.sig) ?? { n: 0, by: 0 };
      g.n++;
      g.by = Math.max(g.by, f.by);
      groups.set(f.sig, g);
    }
    return [...groups].map(([s, g]) => ({ sig: s, n: g.n, by: g.by })).sort((p, q) => q.n * q.by - p.n * p.by).slice(0, CAP);
  };

  // Lay the scopes out at every scale: what is there at 1, and per scale
  // what is new against 1.
  const scanScopes = async (scopes) => {
    const at = {};
    try {
      await setScale(1);
      at[1] = collect(scopes);
      for (const s of SCALES) {
        if (s === 1) continue;
        await setScale(s);
        at[s] = collect(scopes);
      }
    } finally {
      await setScale(1);
    }
    const res = { at1: {}, scales: {} };
    for (const k of KINDS) res.at1[k] = grouped(at[1][k], null);
    for (const s of SCALES) {
      if (s === 1) continue;
      res.scales[s] = {};
      for (const k of KINDS) res.scales[s][k] = grouped(at[s][k], at[1][k]);
    }
    return res;
  };

  // THE KNOWN ANSWERS. JetBrains Mono's advance is 0.6em, so nine letters
  // at --text-16 are 86.4px at 1 and 108px at 1.25, and its normal line is
  // 1.32em, so two lines are 42.2px at 1 and 52.8px at 1.25.
  const selfCheck = async () => {
    const host = document.createElement('div');
    host.id = 'ts-plants';
    host.style.cssText = 'position:fixed;left:0;top:0;width:400px;font-family:var(--font-mono);font-size:var(--text-16);white-space:nowrap';
    host.innerHTML =
      '<div class="ts-spill" style="width:100px">MMMMMMMMM</div>' +
      '<div class="ts-ok" style="width:6.25rem">MMMMMMMMM</div>' +
      '<div class="ts-cut" style="width:100px;overflow:hidden">MMMMMMMMM</div>' +
      '<div class="ts-scroll" style="height:50px;overflow-y:auto;white-space:normal;width:20rem">MMMM<br>MMMM</div>' +
      '<div class="ts-pair" style="position:relative;height:2rem">' +
      '<span class="ts-a" style="position:absolute;left:0;top:0">MMMMMMMMM</span>' +
      '<span class="ts-b" style="position:absolute;left:100px;top:0">MMMMMMMMM</span></div>' +
      '<div class="ts-off" style="position:fixed;left:calc(100vw - 200px);top:300px;width:10rem;height:1rem"></div>' +
      '<div class="ts-faded" style="opacity:0;width:100px">MMMMMMMMM</div>';
    document.body.appendChild(host);
    let res;
    try {
      res = await scanScopes([host]);
    } finally {
      host.remove();
    }
    const got = (s) => KINDS.flatMap((k) => res.scales[s][k].map((g) => `${k}:${g.sig.split('#ts-plants > ').join('').split('div.ts-pair > ').join('')}`)).sort().join(' ');
    const big = ['cut:div.ts-cut [x]', 'overlap:span.ts-a x span.ts-b', 'scroll:div.ts-scroll [y]', 'spill:div.ts-spill [x]'];
    const want = { 0.75: '', 1.1: '', 1.25: [...big].sort().join(' '), 1.5: [...big, 'off:div.ts-off'].sort().join(' '), 2: [...big, 'off:div.ts-off'].sort().join(' ') };
    const bad = SCALES.filter((s) => s in want && got(s) !== want[s]).map((s) => `at ${s}: got [${got(s)}], want [${want[s]}]`);
    const base = KINDS.map((k) => res.at1[k].length).join(',');
    if (base !== '0,0,0,0,0') bad.push(`at 1 the plants read ${base}, want all zero`);
    return bad;
  };

  // A modal covers the page under it, so while one is up it is the scope:
  // its text over the screen's text is not an overlap anyone sees.
  const overlaysUp = () => [...document.querySelectorAll('#ui .roster-overlay, #ui .sector-map-overlay')].filter(shown);
  const scopesNow = () => {
    const modals = overlaysUp();
    if (modals.length > 0) return [modals[modals.length - 1]];
    return ['#ui', '#unit-overlays'].map((q) => document.querySelector(q)).filter(Boolean);
  };
  const screens = {};
  const order = [];
  const scan = async (label) => {
    const scopes = scopesNow();
    const res = await scanScopes(scopes);
    res.scope = scopes.map((s) => (s.id ? '#' + s.id : cls(s))).join(' ');
    res.elements = scopes.reduce((n, sc) => n + [...sc.querySelectorAll('*')].filter(shown).length, 0);
    // Every box at 1, for holding an arm against the page as it is: an arm
    // that only changes units leaves each of these where it was.
    if (arg.boxes) {
      res.boxes = {};
      for (const sc of scopes) {
        for (const el of sc.querySelectorAll('*')) {
          if (!shown(el)) continue;
          const r = el.getBoundingClientRect();
          res.boxes[key(el)] = `${sig(el)}|${[r.left, r.top, r.width, r.height].map((v) => Math.round(v * 10) / 10).join(',')}`;
        }
      }
    }
    screens[label] = res;
    order.push(label);
  };

  // Stop a battle's clocks for the length of a scan, so the page at 1.25 is
  // the page at 1 but for the scale.
  const park = () => {
    const undo = [];
    const scene = game.activeScene;
    for (const k of ['clock', 'countdown']) {
      const o = scene?.[k];
      if (!o || typeof o.advance !== 'function') continue;
      const own = Object.prototype.hasOwnProperty.call(o, 'advance');
      const was = o.advance;
      o.advance = () => {};
      undo.push(() => {
        if (own) o.advance = was;
        else delete o.advance;
      });
    }
    return () => undo.forEach((f) => f());
  };

  const settle = async () => {
    await sleep(450); // a fade is 180 ms, and the screen before leaves after it
    await frames(2);
  };
  const click = (el) => {
    el.click();
    return settle();
  };
  const closeModal = async () => {
    const x = [...document.querySelectorAll('#ui .roster-modal-close, #ui .sector-map-overlay__close')].filter(shown).pop();
    if (x) await click(x);
    else {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
      await settle();
    }
    return overlaysUp().length === 0;
  };
  const notes = [];
  const opened = new Set();
  // Click each opener, and scan the modal it puts up.
  const scanOpeners = async (prefix, selector) => {
    for (const opener of [...document.querySelectorAll(selector)].filter(shown)) {
      const what = `${prefix}:${name(opener)}`;
      if (opened.has(name(opener))) continue;
      opened.add(name(opener));
      await click(opener);
      if (overlaysUp().length === 0) {
        notes.push(`${what}: no modal came up`);
        continue;
      }
      await scan(what);
      if (!(await closeModal())) notes.push(`${what}: the modal did not close`);
    }
  };

  const bad = await selfCheck();
  if (bad.length > 0) return { ok: false, selfCheck: bad };

  const mode = arg.mode ?? 'run';
  if (mode === 'menu') {
    await settle();
    await scan('menu');
    const row = (text) => [...document.querySelectorAll('#ui button')].filter(shown).find((b) => b.textContent.trim() === text);
    for (const text of ['Settings', 'Credits']) {
      const b = row(text);
      if (!b) {
        notes.push(`no ${text} row`);
        continue;
      }
      await click(b);
      await scan(text.toLowerCase());
      if (!(await closeModal())) notes.push(`${text}: the modal did not close`);
    }
    const start = row('New run');
    if (start) {
      await click(start);
      await scan('character-select');
    } else notes.push('no New run row');
  } else if (mode === 'extras') {
    // THE EXTRAS (117.5a): what a driven run never puts up. Every kind of
    // tooltip on each phase's first screen, the cache modal full of packets
    // and one over, and the sector-cleared screen with the chips up.
    const tipRoots = () => scopesNow();
    const tipTriggers = () =>
      tipRoots().flatMap((root) => [...root.querySelectorAll('[data-tooltip-touch], .hud-card-targetable')]).filter(shown);
    const hover = async (el, on) => {
      el.dispatchEvent(new PointerEvent(on ? 'pointerenter' : 'pointerleave', { pointerType: 'mouse' }));
      await sleep(on ? 240 : 60); // the hover delay is 150 ms
      await frames(2);
    };
    // One tooltip, read while it is up. The plate is the scope, and the scan
    // walks a scope's descendants, so the plate's own box is read here.
    const tipAt = async (el) => {
      await hover(el, true);
      const host = document.querySelector('.tooltip');
      let found = null;
      if (host !== null && !host.hidden && el.hasAttribute('aria-describedby')) {
        found = collect([host]);
        const over = overBy(host.getBoundingClientRect());
        if (over > TOL) found.off.set('plate', { sig: 'div.tooltip', by: Math.round(over) });
      }
      await hover(el, false);
      return found;
    };
    // The tooltip scan's known answers: a real tooltip reads clean, and the
    // same one planted wider than the page reads as off it.
    const tipSelfCheck = async () => {
      const el = tipTriggers()[0];
      const clean = await tipAt(el);
      if (clean === null) return [`the first trigger's tooltip did not open (${sig(el)})`];
      const bad = [];
      if (clean.off.size > 0) bad.push(`an unplanted tooltip reads as off the page (${sig(el)})`);
      const plant = document.createElement('style');
      plant.textContent = '.tooltip{min-width:200vw !important}';
      document.head.appendChild(plant);
      try {
        const planted = await tipAt(el);
        if (planted === null || planted.off.size === 0) bad.push('a tooltip planted wider than the page was not read as off it');
      } finally {
        plant.remove();
      }
      return bad;
    };
    // A plate is placed when it opens, so each trigger is opened afresh at
    // each size. One trigger per signature: sites of one kind share the rules.
    const scanTooltips = async (label) => {
      const bySig = new Map();
      for (const el of tipTriggers()) if (!bySig.has(sig(el))) bySig.set(sig(el), el);
      const res = { triggers: bySig.size, unopened: [], at1: [], scales: {} };
      const at = {};
      try {
        for (const s of SCALES) {
          await setScale(s);
          at[s] = new Map();
          for (const [id, el] of bySig) {
            if (!el.isConnected || !shown(el)) continue;
            const found = await tipAt(el);
            if (found !== null) at[s].set(id, found);
            else if (s === 1) res.unopened.push(id);
          }
        }
      } finally {
        await setScale(1);
      }
      const flat = (id, found, base) =>
        KINDS.flatMap((k) => grouped(found[k], base ? base[k] : null).map((g) => ({ trigger: id, kind: k, sig: g.sig, by: g.by })));
      for (const [id, found] of at[1]) res.at1.push(...flat(id, found, null));
      for (const s of SCALES) {
        if (s === 1) continue;
        res.scales[s] = [];
        for (const [id, found] of at[s]) res.scales[s].push(...flat(id, found, at[1].get(id) ?? null));
      }
      screens[label] = res;
      order.push(label);
    };

    // On the first map, while the run is live and every chip is up. It says
    // whether the walk can go on (a modal left up would become every later
    // scan's scope).
    const mapExtras = async () => {
      const run = game.run;
      const ids = arg.packets ?? ['overclock', 'venom', 'hype', 'surge', 'shield', 'discard-one'];
      const cap = run.effectiveCacheSize;
      const cacheChip = () =>
        [...document.querySelectorAll('#ui .chrome-column button.chip')].filter(shown).find((b) => /cache/.test(b.className));
      const openCache = async () => {
        if (overlaysUp().length > 0) return true;
        const chip = cacheChip();
        if (chip) await click(chip);
        return overlaysUp().length > 0;
      };
      for (let i = 0; run.cache.length < cap && i < 40; i++) run.addPacket(ids[i % ids.length]);
      await settle();
      if (!(await openCache())) notes.push('cache: no modal came up');
      else {
        await scan(`cache(full:${run.cache.length}/${cap})`);
        await scanTooltips('tips:cache');
        if (!(await closeModal())) {
          notes.push('cache: the full modal did not close');
          return false;
        }
      }

      // The sector-cleared screen, by its event, with the titles the shipped
      // sectors carry and a pool the seam lifted.
      game.bus.emit('sector:cleared', { clearedSectorTitle: 'The Start', nextSectorTitle: 'The Deep End', poolBefore: 7, poolAfter: 16 });
      await settle();
      await scan('sector-cleared(forced)');
      await scanTooltips('tips:sector-cleared');
      const go = [...document.querySelectorAll('#ui button')].filter(shown).find((b) => !b.closest('.chrome-column'));
      if (go) await click(go);
      if (!document.querySelector('#ui .map-screen')) notes.push('sector-cleared: its button did not bring the map back');

      // One packet over the cache's size: the state that demands a discard.
      try {
        run.addPacket(ids[0]);
        await settle();
        if (!(await openCache())) notes.push('cache: no modal came up one over');
        else await scan(`cache(over:${run.cache.length}/${cap})`);
        while (run.cache.length > cap) run.handleDiscardPacket(run.cache.length - 1);
        await settle();
      } catch (e) {
        notes.push(`cache one over: ${e instanceof Error ? e.message : String(e)}`);
      }
      if (overlaysUp().length > 0 && !(await closeModal())) {
        notes.push('cache: the modal one over did not close');
        return false;
      }
      return true;
    };

    const seen = new Set();
    let checked = false;
    let mapDone = false;
    let slice = 0;
    let done = false;
    const until = Date.now() + (arg.ms ?? 300_000);
    while (!done && Date.now() < until) {
      const phase = game.run?.phase ?? 'none';
      slice = phase === 'battle' ? slice + 1 : 0;
      if (!seen.has(phase) && (phase !== 'battle' || slice === 2)) {
        await settle();
        const resume = phase === 'battle' || phase === 'turn-outcome' ? park() : () => {};
        try {
          if (!checked && tipTriggers().length > 0) {
            const tipBad = await tipSelfCheck();
            if (tipBad.length > 0) return { ok: false, selfCheck: tipBad };
            checked = true;
          }
          await scanTooltips(`tips:${phase}`);
        } finally {
          resume();
        }
        seen.add(phase);
        if (phase === 'map' && !mapDone) {
          mapDone = true;
          if (!(await mapExtras())) break;
        }
      }
      const r = await probe.drive({ maxMs: 0, seed: arg.seed ?? 1 });
      if (r.done) done = true;
    }
    if (!checked) return { ok: false, selfCheck: ['no screen had a tooltip trigger, so the tooltip scan was never checked'] };
    if (!mapDone) notes.push('the run never showed a map, so the cache and the sector-cleared screen were not scanned');
  } else {
    const perPhase = arg.perPhase ?? 2;
    const seen = {};
    let slice = 0;
    let battles = 0;
    let done = false;
    const until = Date.now() + (arg.ms ?? 300_000);
    while (!done && Date.now() < until) {
      const phase = game.run?.phase ?? 'none';
      const n = seen[phase] ?? 0;
      let due = n < perPhase;
      if (phase === 'battle') {
        slice++;
        // The countdown and the whole HUD at a battle's start, then mid-fight.
        due = (battles === 0 && (slice === 1 || slice === 6)) || (battles === 1 && slice === 4) || (battles === 4 && slice === 5);
      } else {
        if (slice > 0) battles++;
        slice = 0;
      }
      if (due) {
        await settle();
        const resume = phase === 'battle' || phase === 'turn-outcome' ? park() : () => {};
        try {
          await scan(phase === 'battle' ? `battle#${battles + 1}.${slice}` : `${phase}#${n + 1}`);
        } finally {
          resume();
        }
        seen[phase] = n + 1;
        if ((phase === 'map' && n === 0) || (phase === 'battle' && battles === 0 && slice === 1)) await scanOpeners(phase, '#ui .chrome-column button.chip');
        if (phase === 'turn-intro' && n === 0) await scanOpeners('turn-intro', '#ui button.card-list-button');
      }
      const r = await probe.drive({ maxMs: 0, seed: arg.seed ?? 1 });
      if (r.done) done = true;
    }
    if (!done) notes.push('the time ran out before the run ended');
    // A won run's screen, forced: the phase set and its event sent.
    if (done && arg.victory !== false && game.run && game.run.phase !== 'complete') {
      game.run.phase = 'complete';
      game.bus.emit('run:victory', {});
      await settle();
      await scan('complete(forced)');
    }
  }

  return { ok: true, viewport: [innerWidth, innerHeight], scales: SCALES, resize: !!arg.resize, order, notes, screens };
}
