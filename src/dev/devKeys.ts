/**
 * 53f — the dev export/load keys (DOM-zone glue, browser-only, eyeball-
 * verified per the TESTING policy; the run swap it drives is Game-layer
 * wiring, so the step is browser-verified by contract).
 *
 * A separate DEV-only window listener, deliberately NOT the Keybindings
 * registry — its zod schema requires every action present in the shipped
 * config JSON, so a dev-only action can't ride it (worklog §53 kickoff).
 * All chords are Ctrl+Alt+<key>, and the chord keys must stay OFF the
 * registry's bound codes (E/F/H/T, digits, Space): `Keybindings.handleKeyDown`
 * dispatches on bare `KeyboardEvent.code` with no modifier check, so a chord
 * on a bound code would co-fire the battle hotkey.
 *
 *   Ctrl+Alt+S — export the run: Run.toJSON() → a JSON download.
 *   Ctrl+Alt+L — load a run: file picker → Run.fromJSON → the Game run swap
 *                (map-phase saves only — mid-encounter restore is menu-grade
 *                save/load, Cluster 6).
 *   Ctrl+Alt+D — dump the trace ring: the whole localStorage ring → one JSON
 *                download (D not T — KeyT is the bound stopObjective code).
 *
 * Wired in main.ts's DEV block; the shipped bundle never touches this.
 */

import type { Game } from '../Game';
import type { RunSnapshot } from '../run/Run';
import { loadTraces } from './traceStore';

export function attachDevKeys(game: Game): void {
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
    }
  });
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
