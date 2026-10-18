/**
 * The dev keys: Ctrl+Alt chords on a window listener of their own, on a DEV
 * page only (./devEntry.ts attaches them). They are not on the Keybindings
 * registry, since its schema requires every action in the shipped config
 * JSON (src/config/keybindings.ts), so a dev-only action can't ride it.
 * `Keybindings.handleKeyDown` ignores a keydown with Ctrl, Alt or Meta held,
 * so a chord never fires a battle hotkey too, whatever key the player has
 * bound.
 *
 * - `Ctrl+Alt+S` — export the run: `Run.toJSON()` as a JSON download, from
 *   any phase.
 * - `Ctrl+Alt+L` — load a run: a file picker, then `Game.devLoadRun`, which
 *   swaps the run in at the saved gate's screen. A `battle` or
 *   `turn-outcome` export has no screen to resume at and is refused.
 * - `Ctrl+Alt+D` — download the trace ring: the whole localStorage ring as
 *   one JSON file.
 * - `Ctrl+Alt+K` — cycle the loss FX's shake policy (player, enemy, both,
 *   none), live in a battle and logged to the console: the seam for telling
 *   whether a shake reads as "you got hurt" or as "you achieved something".
 * - `Ctrl+Alt+G` — toggle the grayscale audit: `filter: grayscale(1)` on
 *   the root element, so the canvas and the DOM UI desaturate together. A
 *   surface that reads in grayscale says nothing by colour alone, so it
 *   reads under every colour-vision deficiency. The root filter makes
 *   `<html>` the containing block for `position: fixed` descendants, which
 *   is the viewport anyway, since the page never scrolls.
 * - `Ctrl+Alt+A` — cycle the reduced-motion override (OS, reduced, full,
 *   OS) in src/render/motion.ts, the one gate the CSS root attribute and
 *   every JS motion consumer read; the motion setting sets the same
 *   override. The pane cannot emulate `prefers-reduced-motion` (its tools
 *   set the colour scheme alone), so this is how a browser reads reduced
 *   motion without the OS setting.
 *   Not R: Firefox takes Ctrl+Alt+R (Reader View) before the page sees it
 *   (gotcha #134).
 * - `Ctrl+Alt+C` — toggle the camera mode, fit or scroll
 *   (`Renderer.toggleCameraMode`). Fit is the only production view; the
 *   scroll mode's pan keys (WASD and the arrows) and edge-scroll attach in
 *   Renderer on a DEV page only.
 * - `Ctrl+Alt+P` — toggle the board explorer (src/dev/boardPanel), a live
 *   dial panel whose state is a `?bp=` bookmark.
 *
 * A new chord must clear this file's chords and the browsers' own Ctrl+Alt
 * chords. The pane is Chromium and cannot catch a chord Firefox reserves,
 * so a new chord is tested in Firefox before it is called verified.
 */

import type { Game } from '../Game';
import type { RunSnapshot } from '../run/Run';
import { loadTraces } from './traceStore';
import { cycleShakePolicy } from '../ui/lossFx';
import { cycleReducedMotionOverride } from '../render/motion';
import type { Renderer } from '../render/Renderer';
import type { BoardPanel } from './boardPanel';

export function attachDevKeys(game: Game, boardPanel: BoardPanel): void {
  window.addEventListener('keydown', (e) => {
    if (!e.ctrlKey || !e.altKey || e.repeat) return;
    switch (e.code) {
      case 'KeyS':
        e.preventDefault();
        exportRun(game);
        break;
      case 'KeyL':
        e.preventDefault();
        pickAndLoadRun(game);
        break;
      case 'KeyD':
        e.preventDefault();
        exportTraces();
        break;
      case 'KeyK':
        e.preventDefault();
        console.info(`[dev-keys] loss-fx shake policy → ${cycleShakePolicy()}`);
        break;
      case 'KeyG':
        e.preventDefault();
        console.info(`[dev-keys] grayscale audit → ${toggleGrayscaleAudit() ? 'ON' : 'off'}`);
        break;
      case 'KeyA': {
        e.preventDefault();
        const next = cycleReducedMotionOverride();
        console.info(
          `[dev-keys] reduced-motion override → ${next === null ? 'OS' : next ? 'REDUCED' : 'full'}`,
        );
        break;
      }
      case 'KeyP':
        e.preventDefault();
        console.info(`[dev-keys] board explorer → ${boardPanel.toggle() ? 'OPEN' : 'closed'}`);
        break;
      case 'KeyC': {
        e.preventDefault();
        // Game keeps `renderer` private to TypeScript; a cast reaches it, as
        // ./devEntry.ts reaches Game's `bus`.
        const renderer = (game as unknown as { renderer: Renderer }).renderer;
        console.info(`[dev-keys] camera mode → ${renderer.toggleCameraMode()}`);
        break;
      }
    }
  });
}

/** Flip the root grayscale filter, or set it to `force`; returns the new
 *  state. */
function toggleGrayscaleAudit(force?: boolean): boolean {
  const root = document.documentElement;
  const on = force ?? root.style.filter === '';
  root.style.filter = on ? 'grayscale(1)' : '';
  return on;
}

function exportTraces(): void {
  const traces = loadTraces();
  if (traces.length === 0) {
    console.warn('[dev-keys] the trace ring is empty — nothing to export');
    return;
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  downloadJson(`asciibattler-traces-${stamp}.json`, traces);
  console.info(`[dev-keys] ${traces.length} trace(s) exported (newest last)`);
}

function exportRun(game: Game): void {
  const snap = game.devExportRun();
  if (snap.phase !== 'map') {
    console.warn(
      `[dev-keys] exporting a '${snap.phase}'-phase save — the load key only accepts ` +
        `'map'-phase saves, so this file is headless-fixture material only`,
    );
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  downloadJson(`asciibattler-run-${stamp}.json`, snap);
  console.info(`[dev-keys] run exported (phase '${snap.phase}', schema v${snap.schemaVersion})`);
}

function pickAndLoadRun(game: Game): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (!file) return;
    void file.text().then(
      (text) => {
        try {
          game.devLoadRun(JSON.parse(text) as RunSnapshot);
          console.info('[dev-keys] run loaded — back on the map');
        } catch (err) {
          console.warn('[dev-keys] load failed (the live run is untouched):', err);
        }
      },
      (err: unknown) => console.warn('[dev-keys] could not read the file:', err),
    );
  });
  input.click();
}

function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
