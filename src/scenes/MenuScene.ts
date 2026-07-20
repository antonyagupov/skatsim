import Phaser from "phaser";
import { AudioManager } from "../audio/AudioManager";
import { installDebugApi } from "../debug/debugApi";
import { loadSave } from "../data/save";
import { addAudioControls } from "../ui/AudioControls";
import { GAME_VERSION } from "../config/version";
import { pickLayoutProfile } from "../ui/layoutProfile";
import { addSceneBackground } from "../ui/sceneArt";

export class MenuScene extends Phaser.Scene {
  constructor() {
    super("Menu");
  }

  create(): void {
    const audio = AudioManager.get();
    installDebugApi(this.game);
    const { width, height } = this.scale;
    const mobile = pickLayoutProfile(width, height) === "mobile";

    if (!addSceneBackground(this, "splash-bg")) {
      this.add.rectangle(width / 2, height / 2, width, height, 0x14101a);
    }

    const shade = this.add.graphics();
    shade.fillGradientStyle(0x08060d, 0x08060d, 0x08060d, 0x08060d, 0.62, 0.62, 0.04, 0.04);
    shade.fillRect(0, 0, width, height);

    this.cameras.main.fadeIn(420, 10, 8, 16);

    const titleSize = mobile ? "48px" : "70px";
    const titleY = mobile ? height * 0.22 : height * 0.19;

    this.add
      .text(width / 2 + 3, titleY + 4, "SKATSIM", {
        fontFamily: "Cinzel, Palatino, serif",
        fontSize: titleSize,
        color: "#08060d",
      })
      .setOrigin(0.5)
      .setAlpha(0.72);

    this.add
      .text(width / 2, titleY, "SKATSIM", {
        fontFamily: "Cinzel, Palatino, serif",
        fontSize: titleSize,
        color: "#f7efdc",
        stroke: "#5f351d",
        strokeThickness: 2,
      })
      .setLetterSpacing(3)
      .setOrigin(0.5);

    const ruleY = mobile ? height * 0.3 : height * 0.27;
    const ruleW = mobile ? 60 : 92;
    this.add.rectangle(width / 2 - (mobile ? 100 : 154), ruleY, ruleW, 1, 0xd4aa62, 0.72);
    this.add.rectangle(width / 2, ruleY, 8, 8, 0xd4aa62, 0.9).setAngle(45);
    this.add.rectangle(width / 2 + (mobile ? 100 : 154), ruleY, ruleW, 1, 0xd4aa62, 0.72);

    this.add
      .text(width / 2, mobile ? height * 0.34 : height * 0.31, "idea by Aleksey Ivashov", {
        fontFamily: "monospace",
        fontSize: mobile ? "12px" : "14px",
        color: "#ead7b4",
      })
      .setOrigin(0.5);

    this.add
      .text(
        width / 2,
        mobile ? height * 0.39 : height * 0.37,
        mobile ? "MATCH-3 JRPG" : "MATCH-3 JRPG  ·  LATE-SNES SPIRIT",
        {
          fontFamily: "monospace",
          fontSize: mobile ? "12px" : "13px",
          color: "#c8b090",
        },
      )
      .setLetterSpacing(2)
      .setOrigin(0.5);

    const playY = mobile ? height * 0.52 : height * 0.49;
    const playW = mobile ? 240 : 210;
    const playH = mobile ? 64 : 58;
    const playBg = this.add
      .rectangle(width / 2, playY, playW, playH, 0x241521, 0.92)
      .setStrokeStyle(2, 0xd4aa62, 0.95)
      .setInteractive({ useHandCursor: true });
    const playLabel = this.add
      .text(width / 2, playY, "▶  PLAY", {
        fontFamily: "monospace",
        fontSize: mobile ? "26px" : "25px",
        color: "#f7efdc",
      })
      .setLetterSpacing(2)
      .setOrigin(0.5);

    playBg.on("pointerover", () => {
      audio.sfx("ui_hover");
      playBg.setFillStyle(0x5f351d, 0.96).setStrokeStyle(2, 0xf0c87a, 1);
      playLabel.setColor("#fff4d6");
    });
    playBg.on("pointerout", () => {
      playBg.setFillStyle(0x241521, 0.92).setStrokeStyle(2, 0xd4aa62, 0.95);
      playLabel.setColor("#f7efdc");
    });
    playBg.on("pointerdown", async () => {
      await audio.unlock();
      audio.sfx("ui_click");
      audio.playTrack("world");
      const save = loadSave();
      this.scene.start(save.introSeen ? "World" : "Intro");
    });

    this.add
      .text(width - 14, height - 12, `v${GAME_VERSION}`, {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#6a5e52",
      })
      .setOrigin(1, 1);

    const savePreview = loadSave();
    if (savePreview.memoryWipes > 0) {
      this.add
        .text(14, height - 12, `Loop ${savePreview.memoryWipes + 1}`, {
          fontFamily: "monospace",
          fontSize: "11px",
          color: "#40ffc0",
        })
        .setOrigin(0, 1);
    }

    addAudioControls(this);
  }
}
