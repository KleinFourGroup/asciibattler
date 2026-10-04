// A setting kept across two launches of the shell on one profile (§116b):
//
//   npm run probe -- shell/electron/probes/settings-persist.js --profile=<dir> --arg={"mode":"fresh"}
//   npm run probe -- shell/electron/probes/settings-persist.js --profile=<dir> --arg={"mode":"write"}
//   npm run probe -- shell/electron/probes/settings-persist.js --profile=<dir>
//
// `fresh` is the control, on a profile nothing has written: the consumers
// hold the fallbacks. `write` changes seven settings through the page's own
// model (`__game.settings`) and reads the consumers in the same page, which
// is the live path. The third run is a new process on the same `userData`:
// it reads what the consumers hold after their boot, which is the stored
// path. `<dir>/store.json` is the text the second launch read; look at it
// directly, since this script only sees it through the store.
//
// What a page can reach: the audio player's two levels, the pause key, the
// selected speed and the root's motion attribute. The shake policy and the
// aura mode are module state, out of a bundled page's reach, so they are
// read here only as stored (`settings.get()`); src/settings/apply.test.ts
// holds their consumers.
//
// The runner wraps this file's one function in a call, so everything the
// script needs lives inside it.
export default async function settingsPersist(arg = {}) {
  const written = {
    volumeMaster: 0.8,
    volumeSfx: 0.25,
    keys: { togglePause: 'KeyP' },
    speed: 2,
    motion: 'reduced',
    shake: 'none',
    aura: 'fill',
  };
  const wants = {
    // The motion attribute follows the OS under `system`, so `fresh` reads
    // the stored choice and not the attribute.
    fresh: {
      volumeMaster: 0.5,
      volumeSfx: 1,
      pauseKey: 'Space',
      speed: 1,
      storedMotion: 'system',
      storedShake: 'player',
      storedAura: 'track',
    },
    set: {
      volumeMaster: 0.8,
      volumeSfx: 0.25,
      pauseKey: 'KeyP',
      speed: 2,
      storedMotion: 'reduced',
      motionAttr: 'reduced',
      storedShake: 'none',
      storedAura: 'fill',
    },
  };
  const mode = arg.mode ?? 'read';
  const game = window.__game;
  if (mode === 'write') {
    for (const [key, value] of Object.entries(written)) game.settings.set(key, value);
    // Electron's write is asynchronous (main writes a temporary file and
    // renames it); give it time to land before the window closes.
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  const stored = game.settings.get();
  const seen = {
    volumeMaster: game.audio.masterVolume,
    volumeSfx: game.audio.sfxVolume,
    pauseKey: game.keybindings.codeFor('togglePause'),
    speed: game.playback.selectedSpeed,
    motionAttr: document.documentElement.getAttribute('data-motion'),
    storedMotion: stored.motion,
    storedShake: stored.shake,
    storedAura: stored.aura,
  };
  const want = mode === 'fresh' ? wants.fresh : wants.set;
  const wrong = Object.keys(want).filter((key) => seen[key] !== want[key]);
  return { ok: wrong.length === 0, mode, wrong, seen, want };
}
