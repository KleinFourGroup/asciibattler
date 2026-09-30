// The recorder's page side (§110d, the recorder phase §111). The `record`
// probe runs this in the page before it starts the video pipe; it reaches into
// the live game by the dev convention, changing no source file, so the same
// script records any development-mode build, older commits included (the
// "before" of a before/after pair). Every name it reaches is checked first,
// and a moved one fails the recording by name (`seam moved: ...`);
// src/audio/AudioPlayer.test.ts pins the AudioPlayer half on every npm test.
//
// Options (from the probe): `enter` makes the two dispatches a player's two
// clicks would (the root node, then Fight), for a seed opened by run dials
// alone; a board fixture enters its battle itself (src/dev/boardPanel/boot.ts).
//
// It installs `window.__rec110` with `start()` and `stop()`:
// - AUDIO: every pooled <audio> element of the game's AudioPlayer is routed
//   through an AudioContext into a MediaStreamAudioDestinationNode, and
//   never to `ctx.destination`, so the speakers get nothing. A MediaRecorder
//   records that stream. Every `play(key)` call is logged with its time.
// - THE FRAME MARKER: eight DOM squares above the scanlines, bottom-left,
//   showing the page's animation-frame count mod 256 in binary, plus a ninth
//   square that is white while the planted tone plays. The analyzer reads
//   them back from the file's pixels: a skipped count is a dropped frame, a
//   repeated one a duplicate, and the marker being there at all proves the
//   DOM layer is in the video.
// - THE PLANTED TONE: 3150 Hz for 0.5 s into the recording stream, 3 s after
//   start, so the analyzer has a known sound to find, and the flash square
//   lets it measure the file's audio-to-video offset.
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

  if (opts.enter) {
    const rootId = await waitFor(() => game.run?.nodeMap?.rootId, 20_000);
    if (typeof rootId !== 'number') return moved('Game.run.nodeMap.rootId (or no run at boot: is character= in the URL?)');
    if (typeof game.dispatch !== 'function') return moved('Game.dispatch');
    game.dispatch({ kind: 'enterNode', nodeId: rootId });
    game.dispatch({ kind: 'advanceTurn' });
  }

  const scene = await waitFor(() => (game.activeScene?.world ? game.activeScene : null), 30_000);
  if (!scene) {
    return {
      ok: false,
      error: opts.enter
        ? 'the root node did not open a battle within 30 s (firstNode=elite in the URL?)'
        : 'no battle within 30 s (is the board one of the explorer fixtures, src/dev/boardPanel/fixtures.ts?)',
    };
  }

  // Every other name this script reaches, checked before anything is wrapped.
  const player = game.audio;
  if (!player || typeof player.play !== 'function') return moved('Game.audio / AudioPlayer.play');
  const pools = player.pools && typeof player.pools === 'object' ? Object.values(player.pools) : [];
  if (pools.length === 0 || !pools.every((p) => Array.isArray(p) && p.length > 0 && p.every((el) => el instanceof HTMLAudioElement))) {
    return moved('AudioPlayer.pools (a record of <audio> arrays)');
  }
  if (typeof game.bus?.on !== 'function') return moved('Game.bus.on');
  if (typeof scene.playback?.resume !== 'function') return moved('BattleScene.playback.resume');

  const TONE_HZ = 3150;
  const TONE_AT_S = 3;
  const TONE_S = 0.5;
  const SQUARE = 24;

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
    cues.push({ key, t: performance.now() });
    return originalPlay.call(this, key, scale);
  };

  // --- the frame marker ----------------------------------------------------
  const marker = document.createElement('div');
  marker.style.cssText = `position:fixed;left:8px;bottom:8px;z-index:6000;display:flex;pointer-events:none`;
  const squares = [];
  for (let i = 0; i < 9; i++) {
    const s = document.createElement('div');
    s.style.cssText = `width:${SQUARE}px;height:${SQUARE}px;background:#000`;
    marker.append(s);
    squares.push(s);
  }
  document.body.append(marker);

  const state = {
    frame: 0,
    startedAt: null,
    startEpoch: null,
    toneFrom: null,
    toneTo: null,
    flashFrames: [],
    running: false,
    ended: false,
    chunks: [],
    recorder: null,
    mime: null,
  };
  const paint = (now) => {
    if (!state.running) return;
    state.frame++;
    const n = state.frame & 255;
    for (let b = 0; b < 8; b++) squares[b].style.background = n & (1 << (7 - b)) ? '#fff' : '#000';
    const flashing = state.toneFrom !== null && now >= state.toneFrom && now < state.toneTo;
    squares[8].style.background = flashing ? '#fff' : '#000';
    if (flashing) state.flashFrames.push(state.frame);
    requestAnimationFrame(paint);
  };

  game.bus.on('battle:ended', () => {
    state.ended = true;
  });

  window.__rec110 = {
    state,
    async start() {
      await ctx.resume();
      state.mime = ['audio/webm;codecs=opus', 'audio/webm'].find((m) => MediaRecorder.isTypeSupported(m));
      state.recorder = new MediaRecorder(dest.stream, { mimeType: state.mime });
      state.recorder.ondataavailable = (e) => state.chunks.push(e.data);
      state.recorder.start(1000);
      state.startedAt = performance.now();
      state.startEpoch = performance.timeOrigin + state.startedAt;
      state.running = true;
      requestAnimationFrame(paint);
      // The planted tone, scheduled on the audio clock, and its flash window on the page clock.
      const osc = ctx.createOscillator();
      const toneGain = ctx.createGain();
      osc.frequency.value = TONE_HZ;
      toneGain.gain.value = 0.3;
      osc.connect(toneGain).connect(dest);
      const at = ctx.currentTime + TONE_AT_S;
      osc.start(at);
      osc.stop(at + TONE_S);
      state.toneFrom = state.startedAt + TONE_AT_S * 1000;
      state.toneTo = state.toneFrom + TONE_S * 1000;
      // Fight now: an unpause ends the countdown inside BattleScene.tick.
      if (scene.countdown?.active) scene.playback.resume();
      return {
        startEpoch: state.startEpoch,
        pageSkewMs: performance.timeOrigin + performance.now() - Date.now(),
        ctxState: ctx.state,
        mime: state.mime,
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
        cues: cues
          .filter((c) => c.t >= state.startedAt)
          .map((c) => ({ key: c.key, s: Math.round(c.t - state.startedAt) / 1000 })),
        tone: { hz: TONE_HZ, fromS: TONE_AT_S, seconds: TONE_S },
        flashFrames: [state.flashFrames[0] ?? null, state.flashFrames[state.flashFrames.length - 1] ?? null],
        rejections,
        ctxState: ctx.state,
        ended: state.ended,
      };
    },
  };
  return { ok: true, elements, ctxState: ctx.state, grid: [scene.world.gridW, scene.world.gridH] };
}
