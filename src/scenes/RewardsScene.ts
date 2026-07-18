import Phaser from "phaser";
import { AudioManager } from "../audio/AudioManager";
import {
  applySalvageRewards,
  applyVictoryProgress,
  loadSave,
} from "../data/save";
import {
  computeBattleRewards,
  computeDefeatRewards,
} from "../systems/economy/rewards";
import { MAP_NODES } from "../data/mapNodes";
import { addAudioControls } from "../ui/AudioControls";
import { presentDialogueOverlay } from "../ui/DialogueOverlay";
import type { DialogueLine } from "../systems/dialogue/DialogueRunner";

const FORTRESS_BEAT: DialogueLine[] = [
  {
    speaker: "Warrior",
    portraitKey: "hero-warrior-portrait",
    text: "The chieftain falls. The fortress is ours — for now.",
  },
  {
    speaker: "Mage",
    portraitKey: "hero-mage-portrait",
    text: "Marsh mist crawls north. Something colder waits beyond.",
  },
  {
    speaker: "Priest",
    portraitKey: "hero-priest-portrait",
    text: "Rest in the Village. Chapter two will not forgive haste.",
  },
  {
    speaker: "Ranger",
    portraitKey: "hero-ranger-portrait",
    text: "I'll mark the marsh path. Stay sharp.",
  },
];

export class RewardsScene extends Phaser.Scene {
  constructor() {
    super("Rewards");
  }

  create(data: {
    damageDealt?: number;
    encounterId?: string;
    nodeId?: string;
    defeat?: boolean;
  }): void {
    const audio = AudioManager.get();
    void audio.unlock().then(() => audio.playTrack("world"));

    const encounterId = data?.encounterId ?? "ruins";
    const defeat = Boolean(data?.defeat);
    const save = loadSave();
    const rewards = defeat
      ? computeDefeatRewards(encounterId, save.buildingLevels.mine)
      : computeBattleRewards(encounterId, save.buildingLevels.mine);

    if (defeat) {
      applySalvageRewards(rewards.gold, rewards.materials);
      audio.sfx("defeat");
      audio.sfx("reward_collect");
    } else {
      applyVictoryProgress(encounterId, rewards.gold, rewards.materials);
      audio.sfx("victory");
      audio.sfx("reward_collect");
    }

    const placeName =
      MAP_NODES.find((n) => n.encounterId === encounterId)?.label ??
      "Battle";

    const { width, height } = this.scale;
    this.add.rectangle(width / 2, height / 2, width, height, 0x14101a);

    const panelW = Math.min(400, width - 48);
    const panelH = Math.min(460, height - 72);
    const panelY = height * 0.52;
    const panelTop = panelY - panelH / 2;
    const panelBottom = panelY + panelH / 2;

    this.add
      .rectangle(width / 2, panelY, panelW, panelH, 0x1c1624)
      .setStrokeStyle(3, defeat ? 0xa07070 : 0xf0c050);

    this.add
      .text(width / 2, panelTop + 52, defeat ? "Defeat" : "Victory!", {
        fontFamily: "Cinzel, Palatino, serif",
        fontSize: "36px",
        color: defeat ? "#e09090" : "#f0c050",
      })
      .setOrigin(0.5);

    this.add
      .text(
        width / 2,
        panelTop + 96,
        defeat ? `You salvage from ${placeName}…` : placeName,
        {
          fontFamily: "monospace",
          fontSize: "15px",
          color: "#f2e9d8",
          wordWrap: { width: panelW - 48 },
          align: "center",
        },
      )
      .setOrigin(0.5);

    const rewardY = panelY - 8;
    if (this.textures.exists("icon-gold")) {
      this.add
        .image(width / 2 - 70, rewardY, "icon-gold")
        .setDisplaySize(36, 36);
    } else {
      this.add.circle(width / 2 - 70, rewardY, 16, 0xf0c050);
    }
    this.add
      .text(width / 2 - 70, rewardY + 28, `+${rewards.gold}`, {
        fontFamily: "monospace",
        fontSize: "18px",
        color: "#f0c050",
      })
      .setOrigin(0.5);

    if (this.textures.exists("icon-materials")) {
      this.add
        .image(width / 2 + 70, rewardY, "icon-materials")
        .setDisplaySize(36, 36);
    } else {
      this.add.rectangle(width / 2 + 70, rewardY, 28, 24, 0x8a6a4a);
    }
    this.add
      .text(width / 2 + 70, rewardY + 28, `+${rewards.materials}`, {
        fontFamily: "monospace",
        fontSize: "18px",
        color: "#a0c8e0",
      })
      .setOrigin(0.5);

    let noteY = rewardY + 64;
    if (!defeat && data?.damageDealt) {
      this.add
        .text(width / 2, noteY, `Damage dealt: ${data.damageDealt}`, {
          fontFamily: "monospace",
          fontSize: "13px",
          color: "#a89888",
        })
        .setOrigin(0.5);
      noteY += 28;
    }

    if (!defeat && encounterId === "fortress") {
      this.add
        .text(width / 2, noteY, "Chapter 2 path unlocked!", {
          fontFamily: "monospace",
          fontSize: "13px",
          color: "#88c070",
        })
        .setOrigin(0.5);
    }

    const cont = this.add
      .text(width / 2, panelBottom - 44, "Continue", {
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
      if (!defeat && encounterId === "fortress") {
        presentDialogueOverlay(this, {
          lines: FORTRESS_BEAT,
          onComplete: () => this.scene.start("World"),
        });
        return;
      }
      this.scene.start("World");
    });

    addAudioControls(this);
  }
}
