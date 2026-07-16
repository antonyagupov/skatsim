import Phaser from "phaser";
import { AudioManager } from "../audio/AudioManager";
import {
  MAP_EDGES,
  MAP_NODES,
  isNodeCompleted,
  isNodeUnlocked,
  nodeRewardPreview,
} from "../data/mapNodes";
import { loadSave, resetSave } from "../data/save";
import { elementColor } from "../systems/combat/elements";
import { addAudioControls } from "../ui/AudioControls";

export class WorldScene extends Phaser.Scene {
  constructor() {
    super("World");
  }

  create(): void {
    const audio = AudioManager.get();
    void audio.unlock().then(() => audio.playTrack("world"));
    const save = loadSave();
    const { width, height } = this.scale;

    if (this.textures.exists("env-worldmap")) {
      this.add
        .image(width / 2, height / 2, "env-worldmap")
        .setDisplaySize(width, height)
        .setAlpha(0.95);
    } else {
      this.add.rectangle(width / 2, height / 2, width, height, 0x2a5040);
    }

    // Soft vignette instead of website header bar
    this.add.rectangle(width / 2, 0, width, 90, 0x0c0a12, 0.45).setOrigin(0.5, 0);
    this.add
      .text(width / 2, 28, "SKATSIM", {
        fontFamily: "Cinzel, Palatino, serif",
        fontSize: "26px",
        color: "#f2e9d8",
      })
      .setOrigin(0.5);

    if (this.textures.exists("icon-gold")) {
      this.add.image(28, 28, "icon-gold").setDisplaySize(22, 22);
      this.add
        .text(44, 28, `${save.gold}`, {
          fontFamily: "monospace",
          fontSize: "13px",
          color: "#f0c050",
        })
        .setOrigin(0, 0.5);
    } else {
      this.add
        .text(24, 28, `${save.gold}G  ·  ${save.materials}M`, {
          fontFamily: "monospace",
          fontSize: "13px",
          color: "#f0c050",
        })
        .setOrigin(0, 0.5);
    }
    if (this.textures.exists("icon-materials")) {
      this.add.image(100, 28, "icon-materials").setDisplaySize(22, 22);
      this.add
        .text(116, 28, `${save.materials}`, {
          fontFamily: "monospace",
          fontSize: "13px",
          color: "#a0c8e0",
        })
        .setOrigin(0, 0.5);
    }

    if (save.chapter2Unlocked) {
      this.add
        .text(width - 24, 28, "Ch.2 unlocked", {
          fontFamily: "monospace",
          fontSize: "12px",
          color: "#88c070",
        })
        .setOrigin(1, 0.5);
    }

    const byId = new Map(MAP_NODES.map((n) => [n.id, n]));
    const g = this.add.graphics();
    g.lineStyle(3, 0xf0c050, 0.35);
    for (const [fromId, toId] of MAP_EDGES) {
      const a = byId.get(fromId);
      const b = byId.get(toId);
      if (!a || !b) continue;
      g.lineBetween(a.x * width, a.y * height, b.x * width, b.y * height);
    }

    for (const node of MAP_NODES) {
      const nx = node.x * width;
      const ny = node.y * height;
      const unlocked = isNodeUnlocked(node, save);
      const completed = isNodeCompleted(node, save);
      const locked = !unlocked;

      const fill = locked
        ? 0x3a3540
        : completed
          ? 0x5a8c4a
          : node.color;

      const radius = node.kind === "village" ? 22 : node.isBoss ? 20 : 16;
      const circle = this.add
        .circle(nx, ny, radius, fill)
        .setStrokeStyle(3, locked ? 0x666066 : node.isBoss ? 0xff6060 : 0xf0c050);

      if (node.isBoss && !locked) {
        this.add
          .text(nx, ny - radius - 14, "BOSS", {
            fontFamily: "monospace",
            fontSize: "11px",
            color: "#ff8080",
          })
          .setOrigin(0.5);
      }

      const status = completed ? "✓" : locked ? "·" : "►";
      this.add
        .text(nx, ny + radius + 14, `${status} ${node.label}`, {
          fontFamily: "monospace",
          fontSize: "12px",
          color: locked ? "#887868" : "#f2e9d8",
        })
        .setOrigin(0.5);

      // Compact preview under label
      if (!locked && node.kind === "battle") {
        const reward = nodeRewardPreview(node);
        const elems = (node.elementPreview ?? [])
          .map((el) => elementColor(el).toString(16))
          .join("");
        void elems;
        const preview = [
          (node.enemyPreview ?? []).slice(0, 2).join(", "),
          reward ? `${reward.gold}G ${reward.materials}M` : "",
        ]
          .filter(Boolean)
          .join(" · ");
        this.add
          .text(nx, ny + radius + 30, preview, {
            fontFamily: "monospace",
            fontSize: "10px",
            color: "#a89888",
          })
          .setOrigin(0.5);

        // Element dots
        (node.elementPreview ?? []).forEach((el, i) => {
          this.add.circle(
            nx - 10 + i * 14,
            ny + radius + 44,
            4,
            elementColor(el),
          );
        });
      }

      if (unlocked) {
        circle.setInteractive({ useHandCursor: true });
        if (!completed) {
          this.tweens.add({
            targets: circle,
            scale: 1.1,
            duration: 700,
            yoyo: true,
            repeat: -1,
          });
        }
        circle.on("pointerdown", async () => {
          await audio.unlock();
          audio.sfx("ui_click");
          if (node.sceneKey === "Battle") {
            this.scene.start("Battle", {
              encounterId: node.encounterId ?? "ruins",
              nodeId: node.id,
            });
          } else if (node.sceneKey === "Village") {
            this.scene.start("Village");
          }
        });
      }
    }

    addAudioControls(this);
    this.addResetButton(width, height, audio);
  }

  private addResetButton(
    width: number,
    height: number,
    audio: AudioManager,
  ): void {
    const resetBtn = this.add
      .text(width - 12, height - 24, "Reset progress", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#f2d0d0",
        backgroundColor: "#5a2a2a",
        padding: { x: 8, y: 5 },
      })
      .setOrigin(1, 0.5)
      .setDepth(1000)
      .setInteractive({ useHandCursor: true });

    resetBtn.on("pointerdown", () => {
      audio.sfx("ui_click");
      this.showResetConfirm(width, height, audio);
    });
  }

  private showResetConfirm(
    width: number,
    height: number,
    audio: AudioManager,
  ): void {
    const overlay = this.add.container(0, 0).setDepth(2000);
    overlay.add(
      this.add
        .rectangle(width / 2, height / 2, width, height, 0x000000, 0.6)
        .setInteractive(),
    );
    overlay.add(
      this.add
        .rectangle(width / 2, height / 2, 360, 180, 0x1c1624)
        .setStrokeStyle(2, 0xd06a6a),
    );
    overlay.add(
      this.add
        .text(width / 2, height / 2 - 44, "Reset all progress?", {
          fontFamily: "monospace",
          fontSize: "16px",
          color: "#f2e9d8",
        })
        .setOrigin(0.5),
    );
    overlay.add(
      this.add
        .text(width / 2, height / 2 - 16, "Gold, materials, levels and\nunlocked nodes will be cleared.", {
          fontFamily: "monospace",
          fontSize: "11px",
          color: "#a89888",
          align: "center",
        })
        .setOrigin(0.5),
    );

    const cancel = this.add
      .text(width / 2 - 70, height / 2 + 44, "Cancel", {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#f2e9d8",
        backgroundColor: "#2a2238",
        padding: { x: 12, y: 8 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    cancel.on("pointerdown", () => {
      audio.sfx("ui_click");
      overlay.destroy(true);
    });
    overlay.add(cancel);

    const confirm = this.add
      .text(width / 2 + 70, height / 2 + 44, "Reset", {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#1a1008",
        backgroundColor: "#d06a6a",
        padding: { x: 16, y: 8 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    confirm.on("pointerdown", () => {
      resetSave();
      audio.sfx("ui_click");
      overlay.destroy(true);
      this.scene.restart();
    });
    overlay.add(confirm);
  }
}
