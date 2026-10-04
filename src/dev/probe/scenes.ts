/**
 * 112d — the kit's names for the scene on screen. Every build minifies class
 * names, a development-mode one included (the runner's and the recorder's),
 * so `constructor.name` reads `Pp` there; a scene is named by what it is an
 * instance of. scenes.test.ts checks this table names every scene file in
 * `src/scenes/`.
 */

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
  RewardScene,
  SectorClearedScene,
} as const;

/** The scene's class name, or `unnamed` for one the table lacks. */
export function sceneName(scene: object | null): string | null {
  if (scene === null) return null;
  for (const [name, SceneClass] of Object.entries(SCENE_CLASSES)) {
    if (scene instanceof SceneClass) return name;
  }
  return 'unnamed';
}
