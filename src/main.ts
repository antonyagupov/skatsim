import Phaser from "phaser";
import { createGameConfig } from "./config/gameConfig";

const parent = document.querySelector<HTMLElement>("#app");
if (!parent) throw new Error("#app missing");

parent.innerHTML = "";
// eslint-disable-next-line no-new
new Phaser.Game(createGameConfig(parent));
