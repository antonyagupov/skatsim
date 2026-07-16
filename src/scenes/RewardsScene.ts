import Phaser from "phaser";
import { AudioManager } from "../audio/AudioManager";
import { applyVictoryProgress, loadSave } from "../data/save";
import { computeBattleRewards } from "../systems/economy/rewards";
import { MAP_NODES } from "../data/mapNodes";
import { addAudioControls } from "../ui/AudioControls";

export class RewardsScene extends Phaser.Scene {
  constructor() {
    super("Rewards");
  }

  create(data: {
    damageDealt?: number;
    encounterId?: string;
    nodeId?: string;
  }): void {
    const audio = AudioManager.get();
    void audio.unlock().then(() => audio.playTrack("world"));
    audio.sfx("victory");
    audio.sfx("reward_collect");

    const encounterId = data?.encounterId ?? "ruins";
    const save = loadSave();
    const rewards = computeBattleRewards(
      encounterId,
      save.buildingLevels.mine,
    );
    applyVictoryProgress(encounterId, rewards.gold, rewards.materials);

    const placeName =
      MAP_NODES.find((n) => n.encounterId === encounterId)?.label ??
      "Battle";

    const { width, height } = this.scale;
    this.add.rectangle(width / 2, height / 2, width, height, 0x14101a);

    this.add
      .rectangle(width / 2, height / 2, 420, 360, 0x1c1624)
      .setStrokeStyle(3, 0xf0c050);

    this.add
      .text(width / 2, height * 0.28, "Victory!", {
        fontFamily: "Cinzel, Palatino, serif",
        fontSize: "40px",
        color: "#f0c050",
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height * 0.38, placeName, {
        fontFamily: "monospace",
        fontSize: "16px",
        color: "#f2e9d8",
      })
      .setOrigin(0.5);

    // Reward icons
    if (this.textures.exists("icon-gold")) {
      this.add
        .image(width / 2 - 70, height * 0.5, "icon-gold")
        .setDisplaySize(36, 36);
    } else {
      this.add.circle(width / 2 - 70, height * 0.5, 16, 0xf0c050);
    }
    this.add
      .text(width / 2 - 70, height * 0.5 + 28, `+${rewards.gold}`, {
        fontFamily: "monospace",
        fontSize: "18px",
        color: "#f0c050",
      })
      .setOrigin(0.5);

    if (this.textures.exists("icon-materials")) {
      this.add
        .image(width / 2 + 70, height * 0.5, "icon-materials")
        .setDisplaySize(36, 36);
    } else {
      this.add.rectangle(width / 2 + 70, height * 0.5, 28, 24, 0x8a6a4a);
    }
    this.add
      .text(width / 2 + 70, height * 0.5 + 28, `+${rewards.materials}`, {
        fontFamily: "monospace",
        fontSize: "18px",
        color: "#a0c8e0",
      })
      .setOrigin(0.5);

    if (data?.damageDealt) {
      this.add
        .text(width / 2, height * 0.62, `Damage dealt: ${data.damageDealt}`, {
          fontFamily: "monospace",
          fontSize: "13px",
          color: "#a89888",
        })
        .setOrigin(0.5);
    }

    if (encounterId === "fortress") {
      this.add
        .text(width / 2, height * 0.68, "Chapter 2 path unlocked!", {
          fontFamily: "monospace",
          fontSize: "13px",
          color: "#88c070",
        })
        .setOrigin(0.5);
    }

    const cont = this.add
      .text(width / 2, height * 0.78, "Continue", {
        fontFamily: "monospace",
        fontSize: "20px",
        color: "#1a1008",
        backgroundColor: "#d06a2e",
        padding: { x: 22, y: 10 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    cont.on("pointerdown", () => {
      audio.sfx("ui_click");
      this.scene.start("World");
    });

    addAudioControls(this);
  }
}
