import Phaser from "phaser";
import { AudioManager } from "../audio/AudioManager";
import { installDebugApi } from "../debug/debugApi";
import { addAudioControls } from "../ui/AudioControls";

export class MenuScene extends Phaser.Scene {
  constructor() {
    super("Menu");
  }

  create(): void {
    const audio = AudioManager.get();
    installDebugApi(this.game);
    const { width, height } = this.scale;

    this.add.rectangle(width / 2, height / 2, width, height, 0x14101a);
    this.add
      .text(width / 2, height * 0.28, "SKATSIM", {
        fontFamily: "Cinzel, Palatino, serif",
        fontSize: "64px",
        color: "#f7efdc",
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height * 0.38, "idea by Aleksey Ivashov", {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#c8b090",
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height * 0.46, "Match-3 JRPG  ·  late-SNES spirit", {
        fontFamily: "monospace",
        fontSize: "16px",
        color: "#a89888",
      })
      .setOrigin(0.5);

    const play = this.add
      .text(width / 2, height * 0.58, "▶  PLAY", {
        fontFamily: "monospace",
        fontSize: "28px",
        color: "#1a1008",
        backgroundColor: "#d06a2e",
        padding: { x: 28, y: 14 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    play.on("pointerover", () => {
      audio.sfx("ui_hover");
      play.setScale(1.04);
    });
    play.on("pointerout", () => play.setScale(1));
    play.on("pointerdown", async () => {
      await audio.unlock();
      audio.sfx("ui_click");
      audio.playTrack("world");
      this.scene.start("World");
    });

    this.add
      .text(width / 2, height * 0.78, "Tap Play to enable audio", {
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#6a5a4a",
      })
      .setOrigin(0.5);

    addAudioControls(this);
  }
}
