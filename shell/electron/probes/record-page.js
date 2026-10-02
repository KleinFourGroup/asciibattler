// The recorder's page side (§110d, the recorder phase §111). The `record`
// probe runs this in the page before it starts the video pipe; it reaches into
// the live game by the dev convention, changing no source file, so the same
// script records any development-mode build, older commits included (the
// "before" of a before/after pair). Every name it reaches is checked first,
// and a moved one fails the recording by name (`seam moved: ...`);
// src/audio/AudioPlayer.test.ts pins the AudioPlayer half on every npm test.
//
// Options (from the probe):
// - `enter`: make the two dispatches a player's two clicks would (the root
//   node, then Fight), for a seed opened by run dials alone; a board fixture
//   enters its battle itself (src/dev/boardPanel/boot.ts).
// - `check`: the analyzer's twin. The marker stays on for the whole recording
//   and a planted tone plays; without it (a clean clip) both go with the
//   lead-in.
// - `countdown`: how the clip opens. `full` plays the pre-battle countdown
//   from its whole seconds and the game's own handover into the fight; `skip`
//   starts the fight at the go frame, the countdown box hidden in that frame.
// - `leadIn`: the geometry and patch colours (record.mjs, LEAD_IN), and
//   `leadInFrames`, how long it shows.
// - `stamp`: the stamp's width and bytes (record.mjs, STAMP).
// - `stalls`: a control, `[{ atS, ms }]`: block the page that long, that many
//   seconds after the go frame.
// - `journal`: record a whole run from its journal instead of one battle
//   (A RUN, below): `{ segment, speed, maxGapMs, tailMs }`.
//
// It installs `window.__rec110` with `start()` and `stop()`. The timeline:
// - SETUP: the countdown is held (an instance patch on its `advance`, the one
//   a parked board fixture already has), so it still shows its whole seconds
//   when the recording starts.
// - THE LEAD-IN, page frames 1..leadInFrames: eight DOM squares above the
//   scanlines, bottom-left, show the frame count mod 256 in binary, and a row
//   of colour patches above them shows known colours. Main samples the
//   patches from the paint bitmap, and for a clean clip it writes nothing
//   until a paint without the magenta patch.
// - THE GO FRAME, leadInFrames + 1, in one animation-frame callback: the
//   patches hide (and the marker, for a clean clip), the audio recording
//   starts, and the clip's opening begins. `full`: the hold is lifted and the
//   countdown reset to its whole seconds, so the file opens on them. `skip`:
//   the countdown box is hidden without its fade and the fight starts (an
//   unpause ends the countdown inside BattleScene.tick).
// - THE CUT: in the first frame after the battle's scene is swapped for the
//   next screen, the patch row shows again, and main writes nothing from the
//   paint that shows it. Cues played after the swap are left out.
// - THE STAMP, every frame: 64 pixels of the bottom row carry the frame's
//   time since the go frame and its count. Main reads it from each paint to
//   keep the file on the page's clock, and wipes it, so no clip shows it.
// - AUDIO: every pooled <audio> element of the game's AudioPlayer is routed
//   through an AudioContext into a MediaStreamAudioDestinationNode, and never
//   to `ctx.destination`, so the speakers get nothing. A MediaRecorder records
//   that stream. Every `play(key)` call is logged with its time.
// - CHECK ONLY: the marker keeps counting, so the analyzer reads frame
//   continuity from the file (a skipped count is a dropped frame, a repeat a
//   duplicate); a planted 3150 Hz tone plays 3 s after the go frame and every
//   10 s from then, and the ninth square is white while it does, so the
//   analyzer can measure the file's audio-to-video offset all along the clip.
//
// A RUN (`journal`, 114g): the page opened on the journal's seed and dials, so
// its run stands at its first screen, and the replay driver main installed
// (./replay-page.js, `window.__replayDriver`) feeds it the journal's entries.
// Nothing is held in setup. The go frame starts the driver's clock, so the
// clip opens on the run's first screen; every battle's countdown plays whole
// (`countdown: full`) or is skipped as it opens (`skip`). THE CUT comes
// `tailMs` after the replay reaches the journal's end, on the end screen, or
// at once when the replay fails. Every cue up to the cut is in the clip.
export default async function recordPage(opts = {}) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const waitFor = async (get, ms) => {
    const until = Date.now() + ms;
    while (!get() && Date.now() < until) await sleep(200);
    return get();
  };
  const moved = (name) => ({ ok: false, error: `seam moved: ${name}` });

  const game = await waitFor(() => window.__game, 20_000);
  if (!game) return { ok: false, error: 'no window.__game within 20 s: is this a development-mode build?' };

  const check = opts.check === true;
  const opening = opts.countdown;
  if (opening !== 'full' && opening !== 'skip') return { ok: false, error: `countdown must be full or skip, not ${opening}` };

  // The names both kinds of recording reach, checked before anything is wrapped.
  const player = game.audio;
  if (!player || typeof player.play !== 'function') return moved('Game.audio / AudioPlayer.play');
  const pools = player.pools && typeof player.pools === 'object' ? Object.values(player.pools) : [];
  if (pools.length === 0 || !pools.every((p) => Array.isArray(p) && p.length > 0 && p.every((el) => el instanceof HTMLAudioElement))) {
    return moved('AudioPlayer.pools (a record of <audio> arrays)');
  }
  if (typeof game.bus?.on !== 'function') return moved('Game.bus.on');

  // What the clip shows: one battle (`scene`, its countdown held), or a whole
  // run fed from its journal (`driver`).
  let scene = null;
  let countdown = null;
  let countdownBox = null;
  let countdownFrom = null;
  let driver = null;
  if (opts.journal) {
    if (typeof window.__replayDriver !== 'function') return moved('window.__replayDriver (main installs probes/replay-page.js)');
    await waitFor(() => game.run, 20_000);
    const made = window.__replayDriver(game, opts.journal.segment, {
      speed: opts.journal.speed,
      maxGapMs: opts.journal.maxGapMs ?? Infinity,
      countdown: opening,
    });
    if (made.error !== undefined) return { ok: false, error: made.error };
    driver = made;
  } else {
    if (opts.enter) {
      const rootId = await waitFor(() => game.run?.nodeMap?.rootId, 20_000);
      if (typeof rootId !== 'number') return moved('Game.run.nodeMap.rootId (or no run at boot: is character= in the URL?)');
      if (typeof game.dispatch !== 'function') return moved('Game.dispatch');
      game.dispatch({ kind: 'enterNode', nodeId: rootId });
      game.dispatch({ kind: 'advanceTurn' });
    }

    scene = await waitFor(() => (game.activeScene?.world ? game.activeScene : null), 30_000);
    if (!scene) {
      return {
        ok: false,
        error: opts.enter
          ? 'the root node did not open a battle within 30 s (firstNode=elite in the URL?)'
          : 'no battle within 30 s (is the board one of the explorer fixtures, src/dev/boardPanel/fixtures.ts?)',
      };
    }
    if (typeof scene.playback?.resume !== 'function') return moved('BattleScene.playback.resume');
    countdown = scene.countdown;
    if (!countdown || typeof countdown.active !== 'boolean') return moved('BattleScene.countdown');
    if (typeof countdown.remaining !== 'number') return moved('PreBattleCountdown.remaining');
    if (typeof Object.getPrototypeOf(countdown).advance !== 'function') return moved('PreBattleCountdown.advance');
    const boxes = document.querySelectorAll('.battle-countdown');
    if (boxes.length !== 1) return moved(`the HUD's countdown element (.battle-countdown: ${boxes.length} found)`);
    countdownBox = boxes[0];
    if (!countdown.active) return { ok: false, error: 'the countdown had ended before the recorder could hold it (a live board?)' };
    // Hold it through setup. A seed's battle was entered just above, with no
    // frame between, so it holds its whole seconds; a parked fixture is held
    // already, by the same patch.
    if (!Object.hasOwn(countdown, 'advance')) countdown.advance = () => {};
    countdownFrom = Math.ceil(countdown.remaining);
  }

  const { square: SQUARE, left: LEFT, markerBottom: MARKER_BOTTOM, patchBottom: PATCH_BOTTOM, patches: PATCHES } = opts.leadIn;
  const LEAD_IN_FRAMES = opts.leadInFrames;
  const TONE_HZ = 3150;
  const TONE_AT_S = 3;
  const TONE_S = 0.5;
  const TONE_EVERY_S = 10;
  // Tones are scheduled ahead on the audio clock: an hour's worth.
  const TONE_COUNT = 360;

  // --- audio ---------------------------------------------------------------
  const ctx = new AudioContext({ sampleRate: 48_000 });
  const dest = ctx.createMediaStreamDestination();
  const bus = ctx.createGain();
  bus.connect(dest);
  let elements = 0;
  const rejections = [];
  for (const pool of pools) {
    for (const el of pool) {
      ctx.createMediaElementSource(el).connect(bus);
      // AudioPlayer.play swallows a refused play(); count refusals here.
      el.play = function play() {
        return HTMLMediaElement.prototype.play.call(this).catch((err) => {
          rejections.push(String(err?.name ?? err));
          throw err;
        });
      };
      elements++;
    }
  }
  const cues = [];
  const originalPlay = player.play;
  player.play = function logged(key, scale) {
    // `inBattle`: logged before the cut (a battle's: the swap to the next
    // screen), so in the clip.
    cues.push({ key, t: performance.now(), inBattle: driver === null ? game.activeScene === scene : state.cutAt === null });
    return originalPlay.call(this, key, scale);
  };

  // --- the lead-in: the marker and the patches ------------------------------
  const row = (bottom) => {
    const el = document.createElement('div');
    el.style.cssText = `position:fixed;left:${LEFT}px;bottom:${bottom}px;z-index:6000;display:flex;pointer-events:none`;
    document.body.append(el);
    return el;
  };
  const marker = row(MARKER_BOTTOM);
  const squares = [];
  for (let i = 0; i < 9; i++) {
    const s = document.createElement('div');
    s.style.cssText = `width:${SQUARE}px;height:${SQUARE}px;background:#000`;
    marker.append(s);
    squares.push(s);
  }
  // The stamp (record.mjs, STAMP): this frame's time and count along the
  // bottom row, one pixel a bit, drawn in every frame's callback so the paint
  // that shows a frame says when the page drew it. Main wipes it.
  const STAMP = opts.stamp;
  const stampCanvas = document.createElement('canvas');
  stampCanvas.width = STAMP.width;
  stampCanvas.height = 1;
  stampCanvas.style.cssText = `position:fixed;left:0;bottom:0;width:${STAMP.width}px;height:1px;z-index:6000;pointer-events:none;image-rendering:pixelated`;
  document.body.append(stampCanvas);
  const stampCtx = stampCanvas.getContext('2d');
  const stampImage = stampCtx.createImageData(STAMP.width, 1);
  const drawStamp = (t, frame) => {
    const payload = [(t >>> 24) & 255, (t >>> 16) & 255, (t >>> 8) & 255, t & 255, (frame >>> 8) & 255, frame & 255];
    const bytes = [STAMP.sync, ...payload, payload.reduce((a, b) => a ^ b, 0)];
    for (let i = 0; i < STAMP.width; i++) {
      const v = bytes[i >> 3] & (0x80 >> (i & 7)) ? 255 : 0;
      stampImage.data.set([v, v, v, 255], i * 4);
    }
    stampCtx.putImageData(stampImage, 0, 0);
  };
  const patchRow = row(PATCH_BOTTOM);
  for (const [, hex] of PATCHES) {
    const s = document.createElement('div');
    s.style.cssText = `width:${SQUARE}px;height:${SQUARE}px;background:${hex}`;
    patchRow.append(s);
  }

  const state = {
    frame: 0,
    goFrame: LEAD_IN_FRAMES + 1,
    startedAt: null,
    startEpoch: null,
    toneFrom: null,
    flashFrames: [],
    flashStarts: [],
    wasFlashing: false,
    frameTimes: [],
    running: false,
    ended: false,
    goAt: null,
    lastAt: null,
    longFrames: [],
    cutAt: null,
    cutFrame: null,
    doneAt: null,
    boxShownAtGo: null,
    chunks: [],
    recorder: null,
    mime: null,
  };

  const go = () => {
    patchRow.remove();
    if (!check) marker.remove();
    state.recorder.start(1000);
    state.startedAt = performance.now();
    state.startEpoch = performance.timeOrigin + state.startedAt;
    if (check) {
      // The planted tones, scheduled on the audio clock (one oscillator, its
      // gain opened for each), and their flash windows on the page clock.
      const osc = ctx.createOscillator();
      const toneGain = ctx.createGain();
      osc.frequency.value = TONE_HZ;
      toneGain.gain.value = 0;
      osc.connect(toneGain).connect(dest);
      const at = ctx.currentTime + TONE_AT_S;
      for (let k = 0; k < TONE_COUNT; k++) {
        toneGain.gain.setValueAtTime(0.3, at + k * TONE_EVERY_S);
        toneGain.gain.setValueAtTime(0, at + k * TONE_EVERY_S + TONE_S);
      }
      osc.start(at);
      state.toneFrom = state.startedAt + TONE_AT_S * 1000;
    }
    // A control: block the page for `ms` at `atS` seconds, as a stall does.
    for (const stall of opts.stalls ?? []) {
      setTimeout(() => {
        const until = performance.now() + stall.ms;
        while (performance.now() < until);
      }, stall.atS * 1000);
    }
    if (driver !== null) {
      driver.begin(state.goAt);
      return;
    }
    state.boxShownAtGo = countdownBox.classList.contains('is-visible');
    if (opening === 'full') {
      delete countdown.advance; // the prototype's again
      countdown.remaining = countdownFrom;
    } else {
      // The box's 180 ms opacity transition is the fade; with none, it goes
      // in this frame.
      countdownBox.style.transition = 'none';
      countdownBox.style.opacity = '0';
      if (countdown.active) scene.playback.resume();
    }
  };

  const paint = (now) => {
    if (!state.running) return;
    state.frame++;
    if (state.frame === state.goFrame) {
      state.goAt = now;
      go();
    }
    // A frame over 40 ms (2.4 slots at 60 fps) after the go frame: the file
    // shows it for one slot, so the picture loses the rest to its sound.
    // Kept with its wall-clock time, to place it against the machine's events.
    if (state.goAt !== null && state.lastAt !== null && now - state.lastAt > 40 && state.longFrames.length < 200) {
      state.longFrames.push({ pageFrame: state.frame, ms: Math.round(now - state.lastAt), epoch: Math.round(performance.timeOrigin + now) });
    }
    state.lastAt = now;
    drawStamp(state.goAt === null ? STAMP.notStarted : Math.round(now - state.goAt), state.frame & 0xffff);
    // Every frame's time from the go frame (index 0), in ms: what a retime of
    // the file reads. A battle at 60 fps is a few thousand numbers.
    if (state.goAt !== null && state.cutAt === null) state.frameTimes.push(Math.round((now - state.goAt) * 10) / 10);
    // The swap runs from a timer between frames (Game.afterOutro), so this
    // callback sees it in the first frame that draws the next screen. A run
    // is cut once its replay is done and the end screen has had its tail.
    let cutNow = false;
    if (state.cutAt === null && state.startedAt !== null) {
      if (driver === null) cutNow = game.activeScene !== scene;
      else {
        driver.frame(now);
        if (driver.done) {
          state.ended = true;
          state.doneAt ??= now;
          cutNow = !driver.report().ok || now - state.doneAt >= (opts.journal.tailMs ?? 3000);
        }
      }
    }
    if (cutNow) {
      state.cutAt = now;
      state.cutFrame = state.frame;
      document.body.append(patchRow);
    }
    if (state.frame < state.goFrame || check) {
      const n = state.frame & 255;
      for (let b = 0; b < 8; b++) squares[b].style.background = n & (1 << (7 - b)) ? '#fff' : '#000';
      const flashing = state.toneFrom !== null && now >= state.toneFrom && (now - state.toneFrom) % (TONE_EVERY_S * 1000) < TONE_S * 1000;
      squares[8].style.background = flashing ? '#fff' : '#000';
      if (flashing && !state.wasFlashing) state.flashStarts.push(state.frame);
      if (flashing && state.flashStarts.length === 1) state.flashFrames.push(state.frame);
      state.wasFlashing = flashing;
    }
    requestAnimationFrame(paint);
  };

  // A run has many battles; its `ended` is the replay's end (the paint loop).
  if (driver === null) {
    game.bus.on('battle:ended', () => {
      state.ended = true;
    });
  }

  window.__rec110 = {
    state,
    async start() {
      await ctx.resume();
      state.mime = ['audio/webm;codecs=opus', 'audio/webm'].find((m) => MediaRecorder.isTypeSupported(m));
      state.recorder = new MediaRecorder(dest.stream, { mimeType: state.mime });
      state.recorder.ondataavailable = (e) => state.chunks.push(e.data);
      state.running = true;
      requestAnimationFrame(paint);
      return {
        pageSkewMs: performance.timeOrigin + performance.now() - Date.now(),
        ctxState: ctx.state,
        mime: state.mime,
        goFrame: state.goFrame,
      };
    },
    async stop() {
      state.running = false;
      const done = new Promise((r) => (state.recorder.onstop = r));
      state.recorder.stop();
      await done;
      const blob = new Blob(state.chunks, { type: state.mime });
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let binary = '';
      for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      return {
        audioBase64: btoa(binary),
        mime: state.mime,
        startEpoch: state.startEpoch,
        frames: state.frame,
        goFrame: state.goFrame,
        opening,
        countdownFrom,
        boxShownAtGo: state.boxShownAtGo,
        // On the frame clock (the rAF times of the go and cut frames), so
        // main can set the page's timeline against the file's frame count.
        cut: state.cutAt === null ? null : { s: Math.round(state.cutAt - state.goAt) / 1000, pageFrame: state.cutFrame },
        cues: cues
          .filter((c) => c.t >= state.startedAt && c.inBattle)
          .map((c) => ({ key: c.key, s: Math.round(c.t - state.startedAt) / 1000 })),
        cuesAfterCut: cues.filter((c) => c.t >= state.startedAt && !c.inBattle).map((c) => c.key),
        longFrames: state.longFrames.filter((f) => state.cutFrame === null || f.pageFrame < state.cutFrame),
        frameTimesMs: state.frameTimes,
        tone: check ? { hz: TONE_HZ, fromS: TONE_AT_S, seconds: TONE_S, everyS: TONE_EVERY_S } : null,
        // The first tone's first and last flashing page frames, then the page
        // frame each flash began on.
        flashFrames: [state.flashFrames[0] ?? null, state.flashFrames[state.flashFrames.length - 1] ?? null],
        flashStarts: state.flashStarts,
        rejections,
        ctxState: ctx.state,
        ended: state.ended,
        replay: driver === null ? null : driver.report(),
      };
    },
  };
  return { ok: true, elements, ctxState: ctx.state, grid: scene === null ? null : [scene.world.gridW, scene.world.gridH], opening, countdownFrom };
}
