/**
 * 112d — the kit's names for the scene on screen. Every build minifies class
 * names, a development-mode one included (the runner's and the recorder's),
 * so `constructor.name` reads `Pp` there; a scene is named by what it is an
 * instance of. scenes.test.ts checks this table names every scene file in
 * `src/scenes/`.
 *
 * `PHASE_SCENES` is the scene each run phase shows, written from what a
 * player sees and not read from Game, so `drive` can refuse a phase whose
 * scene never mounted.
 */

import type { RunPhase } from '../../run/Run';
import { BattleScene } from '../../scenes/BattleScene';
import { CharacterSelectScene } from '../../scenes/CharacterSelectScene';
import { EventScene } from '../../scenes/EventScene';
import { GameOverScene } from '../../scenes/GameOverScene';
import { MapScene } from '../../scenes/MapScene';
import { MenuScene } from '../../scenes/MenuScene';
import { PortScene } from '../../scenes/PortScene';
import { PreTurnScene } from '../../scenes/PreTurnScene';
import { PromotionScene } from '../../scenes/PromotionScene';
import { RecruitScene } from '../../scenes/RecruitScene';
import { RestScene } from '../../scenes/RestScene';
import { RewardScene } from '../../scenes/RewardScene';
import { SectorClearedScene } from '../../scenes/SectorClearedScene';

export const SCENE_CLASSES = {
  BattleScene,
  CharacterSelectScene,
  EventScene,
  GameOverScene,
  MapScene,
  MenuScene,
  PortScene,
  PreTurnScene,
  PromotionScene,
  RecruitScene,
  RestScene,
  RewardScene,
  SectorClearedScene,
} as const;

export type SceneName = keyof typeof SCENE_CLASSES;

/** One row per phase, so a new `RunPhase` fails typecheck until it has one.
 *  The turn's outcome has no screen of its own: the battle scene plays its
 *  outro, and Game sends the advance itself. */
export const PHASE_SCENES: Record<RunPhase, SceneName> = {
  map: 'MapScene',
  port: 'PortScene',
  event: 'EventScene',
  rest: 'RestScene',
  'turn-intro': 'PreTurnScene',
  battle: 'BattleScene',
  'turn-outcome': 'BattleScene',
  reward: 'RewardScene',
  promotion: 'PromotionScene',
  recruit: 'RecruitScene',
  sectorCleared: 'SectorClearedScene',
  defeat: 'GameOverScene',
  complete: 'GameOverScene',
};

/** The scene's class name, or `unnamed` for one the table lacks. */
export function sceneName(scene: object | null): string | null {
  if (scene === null) return null;
  for (const [name, SceneClass] of Object.entries(SCENE_CLASSES)) {
    if (scene instanceof SceneClass) return name;
  }
  return 'unnamed';
}
