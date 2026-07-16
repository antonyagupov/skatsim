import Phaser from "phaser";
import { BootScene } from "../scenes/BootScene";
import { PreloadScene } from "../scenes/PreloadScene";
import { MenuScene } from "../scenes/MenuScene";
import { WorldScene } from "../scenes/WorldScene";
import { VillageScene } from "../scenes/VillageScene";
import { BattleScene } from "../scenes/BattleScene";
import { RewardsScene } from "../scenes/RewardsScene";

export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 720;

export function createGameConfig(parent: string | HTMLElement): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: "#120e18",
    pixelArt: true,
    antialias: false,
    roundPixels: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      expandParent: false,
    },
    scene: [
      BootScene,
      PreloadScene,
      MenuScene,
      WorldScene,
      VillageScene,
      BattleScene,
      RewardsScene,
    ],
    input: {
      activePointers: 3,
    },
  };
}
