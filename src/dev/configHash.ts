/**
 * 53b — the config fingerprint for battle traces.
 *
 * A recorded trace is only replayable against the exact balance config it was
 * recorded under (a price/stat/layout edit changes sim outcomes without
 * touching the seed), so every `BattleTrace` carries `configHash()` and the
 * replay path refuses a mismatch. There is deliberately NO aggregate config
 * object in the codebase (each `src/config/*.ts` zod-parses its own file), so
 * this module keeps its own registry of the RAW `config/*.json` sources — the
 * config as authored, not the post-parse shape.
 *
 * Plain JSON imports on purpose: they work identically under Vite (the
 * browser bundle), vitest, and tsx (the fuzz/gauntlet CLIs) — Vite-only
 * mechanisms like `import.meta.glob` do NOT exist under tsx. The cost is a
 * hand-maintained registry; the co-located drift-guard test walks the real
 * `config/` directory and fails the moment a file is added or removed
 * without updating this list.
 */

import abilities from '../../config/abilities.json';
import daemons from '../../config/daemons.json';
import deck from '../../config/deck.json';
import difficulty from '../../config/difficulty.json';
import economy from '../../config/economy.json';
import empower from '../../config/empower.json';
import encounters from '../../config/encounters.json';
import fuzzStrategies from '../../config/fuzz-strategies.json';
import health from '../../config/health.json';
import keybindings from '../../config/keybindings.json';
import layouts from '../../config/layouts.json';
import leveling from '../../config/leveling.json';
import nodemap from '../../config/nodemap.json';
import objective from '../../config/objective.json';
import packets from '../../config/packets.json';
import playback from '../../config/playback.json';
import prices from '../../config/prices.json';
import recruitment from '../../config/recruitment.json';
import redrawLevelFisher from '../../config/redraw-level-fisher.json';
import rewards from '../../config/rewards.json';
import sectorMap from '../../config/sector-map.json';
import sectors from '../../config/sectors.json';
import selection from '../../config/selection.json';
import sim from '../../config/sim.json';
import spawn from '../../config/spawn.json';
import stats from '../../config/stats.json';
import statuses from '../../config/statuses.json';
import terrain from '../../config/terrain.json';
import tiles from '../../config/tiles.json';
import units from '../../config/units.json';

/**
 * Every `config/*.json`, keyed by filename. The drift-guard test asserts this
 * stays 1:1 with the directory listing — add the import AND the entry when a
 * new config file lands (the test tells you which name is missing).
 */
export const CONFIG_SOURCES: Readonly<Record<string, unknown>> = {
  'abilities.json': abilities,
  'daemons.json': daemons,
  'deck.json': deck,
  'difficulty.json': difficulty,
  'economy.json': economy,
  'empower.json': empower,
  'encounters.json': encounters,
  'fuzz-strategies.json': fuzzStrategies,
  'health.json': health,
  'keybindings.json': keybindings,
  'layouts.json': layouts,
  'leveling.json': leveling,
  'nodemap.json': nodemap,
  'objective.json': objective,
  'packets.json': packets,
  'playback.json': playback,
  'prices.json': prices,
  'recruitment.json': recruitment,
  'redraw-level-fisher.json': redrawLevelFisher,
  'rewards.json': rewards,
  'sector-map.json': sectorMap,
  'sectors.json': sectors,
  'selection.json': selection,
  'sim.json': sim,
  'spawn.json': spawn,
  'stats.json': stats,
  'statuses.json': statuses,
  'terrain.json': terrain,
  'tiles.json': tiles,
  'units.json': units,
};

/**
 * 32-bit FNV-1a over a string, as 8 lowercase hex chars. Not cryptographic —
 * this is a change-detector for a dev tool, not a security boundary; a stray
 * collision costs one confusing replay, not an exploit.
 */
export function fnv1a(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

let memo: string | null = null;

/**
 * The fingerprint of the entire `config/` directory as loaded by this build.
 * Stable across calls (config is import-time-frozen); sorted keys so the
 * registry's declaration order can never change the hash.
 */
export function configHash(): string {
  if (memo === null) {
    const parts = Object.keys(CONFIG_SOURCES)
      .sort()
      .map((name) => `${name}:${JSON.stringify(CONFIG_SOURCES[name])}`);
    memo = fnv1a(parts.join('\n'));
  }
  return memo;
}
