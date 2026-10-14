/**
 * The config's fingerprint, carried by battle traces and run journals.
 *
 * A trace replays only against the config it was recorded under, since a
 * change to a price, a stat or a layout changes outcomes without touching
 * the seed; so every `BattleTrace` carries `configHash()` and the replay
 * refuses a mismatch. A run journal (src/journal/) carries it for the same
 * reason, and shipped builds stamp it, which is why it lives here and not
 * with the dev tools. It hashes every file under `config/` as authored,
 * before parsing, including the two nothing else under `src/` imports
 * (`fuzz-strategies.json`, `redraw-level-fisher.json`). There is no
 * aggregate config object (each loader parses its own file), so the module
 * keeps its own registry of the raw sources.
 *
 * The imports are plain JSON because they work alike under Vite, Vitest and
 * tsx, where `import.meta.glob` does not exist. The registry is kept by
 * hand, and the co-located test, which walks `config/`, fails when a file is
 * added or removed without it.
 */

import { fnv1a } from '../core/fnv1a';
import abilities from '../../config/abilities.json';
import camps from '../../config/camps.json';
import characters from '../../config/characters.json';
import daemons from '../../config/daemons.json';
import deck from '../../config/deck.json';
import difficulty from '../../config/difficulty.json';
import encounters from '../../config/encounters.json';
import escalation from '../../config/escalation.json';
import events from '../../config/events.json';
import fuzzStrategies from '../../config/fuzz-strategies.json';
import health from '../../config/health.json';
import keybindings from '../../config/keybindings.json';
import layouts from '../../config/layouts.json';
import leveling from '../../config/leveling.json';
import nodemap from '../../config/nodemap.json';
import packets from '../../config/packets.json';
import playback from '../../config/playback.json';
import prices from '../../config/prices.json';
import recruitment from '../../config/recruitment.json';
import redrawLevelFisher from '../../config/redraw-level-fisher.json';
import rewards from '../../config/rewards.json';
import sectorMap from '../../config/sector-map.json';
import sectors from '../../config/sectors.json';
import sim from '../../config/sim.json';
import stats from '../../config/stats.json';
import statuses from '../../config/statuses.json';
import terrain from '../../config/terrain.json';
import units from '../../config/units.json';

/**
 * Every `config/*.json`, keyed by filename. A new file needs its import and
 * its entry; the test names a missing one.
 */
export const CONFIG_SOURCES: Readonly<Record<string, unknown>> = {
  'abilities.json': abilities,
  'camps.json': camps,
  'characters.json': characters,
  'daemons.json': daemons,
  'deck.json': deck,
  'difficulty.json': difficulty,
  'encounters.json': encounters,
  'escalation.json': escalation,
  'events.json': events,
  'fuzz-strategies.json': fuzzStrategies,
  'health.json': health,
  'keybindings.json': keybindings,
  'layouts.json': layouts,
  'leveling.json': leveling,
  'nodemap.json': nodemap,
  'packets.json': packets,
  'playback.json': playback,
  'prices.json': prices,
  'recruitment.json': recruitment,
  'redraw-level-fisher.json': redrawLevelFisher,
  'rewards.json': rewards,
  'sector-map.json': sectorMap,
  'sectors.json': sectors,
  'sim.json': sim,
  'stats.json': stats,
  'statuses.json': statuses,
  'terrain.json': terrain,
  'units.json': units,
};

/**
 * 32-bit FNV-1a as 8 hex characters. It lives in src/core/fnv1a.ts because
 * the i18n provenance hash shares it, and the locale runtime must not import
 * every config file above; the test vectors and the trace callers read it
 * from here. A collision costs one confusing replay, not an exploit.
 */
export { fnv1a };

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
