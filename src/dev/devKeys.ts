/**
 * 53f — the dev export/load keys (DOM-zone glue, browser-only, eyeball-
 * verified per the TESTING policy; the run swap it drives is Game-layer
 * wiring, so the step is browser-verified by contract).
 *
 * A separate DEV-only window listener, deliberately NOT the Keybindings
 * registry — its zod schema requires every action present in the shipped
 * config JSON, so a dev-only action can't ride it (worklog §53 kickoff).
 * All chords are Ctrl+Alt+<key>, and the chord keys must stay OFF the
 * registry's bound codes (E/F/H/T/M, digits, Space, Slash): `Keybindings.handleKeyDown`
 * dispatches on bare `KeyboardEvent.code` with no modifier check, so a chord
 * on a bound code would co-fire the battle hotkey.
 *
 *   Ctrl+Alt+S — export the run: Run.toJSON() → a JSON download.
 *   Ctrl+Alt+L — load a run: file picker → Run.fromJSON → the Game run swap
 *                (map-phase saves only — mid-encounter restore is menu-grade
 *                save/load, Cluster 6).
 *   Ctrl+Alt+D — dump the trace ring: the whole localStorage ring → one JSON
 *                download (D not T — KeyT is the bound stopObjective code).
 *   Ctrl+Alt+K — 96.5b2: cycle the loss-fx SHAKE POLICY (player → enemy →
 *                both → none) — the user's A/B seam: does a shake read as
 *                "you got hurt" or as "you achieved something"? Flippable
 *                live in a battle; logged to the console.
 *   Ctrl+Alt+G — 98a: toggle the GRAYSCALE audit (`filter: grayscale(1)` on
 *                the root element — the canvas AND the DOM UI desaturate
 *                together). The Round 7 "never color alone" lint: a surface
 *                that survives this survives every colour-vision deficiency
 *                (spec §1). Dev-only by design — the CVD-safe palette proper
 *                is a Round 8 setting; this is the audit, not the feature.
 *                (KeyG is off the registry's bound codes; a root filter makes
 *                `<html>` the containing block for `position: fixed`
 *                descendants, which is the viewport anyway — the page body
 *                never scrolls.)
 *   Ctrl+Alt+A — 99a: cycle the REDUCED-MOTION override (OS → reduced → full
 *                → OS; src/render/motion.ts — the ONE gate the CSS root
 *                attribute and every JS motion consumer read). The preview
 *                pane cannot emulate `prefers-reduced-motion`, so this is
 *                the browser read for the whole §99 surface; Round 8's
 *                setting sets the same override. (A = accessibility; KeyA is
 *                off the bound codes. It shipped as KeyR for one commit —
 *                FIREFOX OWNS Ctrl+Alt+R (Reader View) at the chrome level,
 *                so the page never saw the keydown; gotcha #134.)
 *   Ctrl+Alt+C — 100a: toggle the CAMERA MODE (fit ↔ scroll,
 *                `Renderer.toggleCameraMode`). It replaces the D4 Backquote
 *                keydown — an unregistered hotkey with no click route (the
 *                Round 7 kickoff audit §C); the §100 charter gates the camera
 *                dev-only, and Round 7.5 (D7) kept it there: fit is the
 *                only production view. The pan keys (WASD / arrows) and
 *                edge-scroll, turned by the yaw since 107c, attach in
 *                Renderer under the same DEV flag. (C = camera; KeyC is off
 *                the bound codes and this file's, and neither browser binds
 *                Ctrl+Alt+C — the user's Firefox read confirms, per #134.)
 *   Ctrl+Alt+P — 105b: toggle the BOARD EXPLORER (src/dev/boardPanel — the
 *                Round 7.5 projection spike's live dial panel; its state is a
 *                `?bp=` bookmark). (P = projection / panel; KeyP is off the
 *                bound codes and this file's; the user's Firefox press is
 *                the check that counts, per #134.)
 *
 * ⚠ A new chord must clear THREE key sets, not two: the registry's bound
 * codes, this file's, and the BROWSERS' own Ctrl+Alt chords — the pane is
 * Chromium and cannot catch a Firefox-reserved chord; test a new chord in
 * Firefox before calling it verified.
 *
 * Wired in main.ts's DEV block; the shipped bundle never touches this.
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
        // Game keeps `renderer` TS-private; the dev convention (main.ts's
        // `bus` reach-in) is a cast — private is runtime-accessible.
        const renderer = (game as unknown as { renderer: Renderer }).renderer;
        console.info(`[dev-keys] camera mode → ${renderer.toggleCameraMode()}`);
        break;
      }
    }
  });
}

/** 98a — flip the root grayscale filter; returns the new state. Exported so a
 *  scratch probe (or `window.__game`-driven verify) can set it without a
 *  synthetic key event. */
export function toggleGrayscaleAudit(force?: boolean): boolean {
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
