import Phaser from "phaser";
import { AudioManager } from "../audio/AudioManager";
import {
  DESKTOP_MAP_LAYOUT,
  MOBILE_CHAPTER_BAND_Y,
  MOBILE_MAP_LAYOUT,
  estimateLabelSize,
  getMapNodeLayout,
  labelOriginX,
  nodeCircleRadius,
  type MapNodeLayout,
} from "../data/mapLayout";
import {
  allBattleSubtitleIds,
  validateMapLayout,
} from "../data/mapLayoutValidate";
import {
  MAP_NODES,
  isNodeCompleted,
  isNodeUnlocked,
  isNodeVisited,
  mapEdges,
  nodeMapPos,
  nodeRewardPreview,
  type MapNodeDef,
} from "../data/mapNodes";
import { loadSave, resetSave, type SaveData } from "../data/save";
import { addAudioControls } from "../ui/AudioControls";
import { pickLayoutProfile } from "../ui/layoutProfile";
import { addSceneBackground } from "../ui/sceneArt";

function isMapDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return (
    import.meta.env.DEV ||
    params.get("debug") === "1" ||
    localStorage.getItem("skatsim.debug") === "1"
  );
}

type PathState = "completed" | "available" | "locked";

export class WorldScene extends Phaser.Scene {
  constructor() {
    super("World");
  }

  create(): void {
    const audio = AudioManager.get();
    void audio.unlock().then(() => audio.playTrack("world"));
    const save = loadSave();
    const { width, height } = this.scale;
    const mobile = pickLayoutProfile(width, height) === "mobile";

    if (!addSceneBackground(this, "env-worldmap", { alpha: 0.95 })) {
      this.add.rectangle(width / 2, height / 2, width, height, 0x2a5040);
    }

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

    if (mobile) {
      this.drawChapterBand(width, height, save);
    }

    this.drawPaths(width, height, mobile, byId, save);

    for (const node of MAP_NODES) {
      const layout = getMapNodeLayout(node.id, mobile);
      const pos = nodeMapPos(node, mobile);
      const nx = pos.x * width;
      const ny = pos.y * height;
      const unlocked = isNodeUnlocked(node, save);
      const completed = isNodeCompleted(node, save);
      const locked = !unlocked;

      const fill = locked ? 0x3a3540 : completed ? 0x5a8c4a : node.color;
      const radius = nodeCircleRadius(node.kind, Boolean(node.isBoss), mobile);
      const circle = this.add
        .circle(nx, ny, radius, fill)
        .setStrokeStyle(3, locked ? 0x666066 : node.isBoss ? 0xff6060 : 0xf0c050)
        .setDepth(20);

      if (node.isBoss && !locked) {
        const badgeY =
          layout && layout.labelOffsetY < 0
            ? ny + radius + 12
            : ny - radius - 14;
        this.add
          .text(nx, badgeY, node.kind === "ending" ? "END" : "BOSS", {
            fontFamily: "monospace",
            fontSize: "11px",
            color: node.kind === "ending" ? "#80c0ff" : "#ff8080",
          })
          .setOrigin(0.5)
          .setDepth(22);
      }

      const card = this.drawNodeCard(node, layout, nx, ny, radius, locked, completed, mobile);

      const hitLeft = Math.min(nx - radius, card.bounds.x);
      const hitTop = Math.min(ny - radius, card.bounds.y);
      const hitRight = Math.max(nx + radius, card.bounds.x + card.bounds.w);
      const hitBottom = Math.max(ny + radius, card.bounds.y + card.bounds.h);
      const hitW = Math.max(44, hitRight - hitLeft + 8);
      const hitH = Math.max(44, hitBottom - hitTop + 8);
      const hitX = (hitLeft + hitRight) / 2;
      const hitY = (hitTop + hitBottom) / 2;

      if (unlocked) {
        const activateNode = async (): Promise<void> => {
          await audio.unlock();
          audio.sfx("ui_click");
          if (node.sceneKey === "Battle") {
            this.scene.start("Battle", {
              encounterId: node.encounterId ?? "ruins",
              nodeId: node.id,
            });
          } else if (node.sceneKey === "Ending") {
            this.scene.start("Ending");
          } else if (node.sceneKey === "Village") {
            this.scene.start("Village");
          }
        };

        const hitZone = this.add
          .rectangle(hitX, hitY, hitW, hitH, 0xffffff, 0)
          .setDepth(30)
          .setInteractive({ useHandCursor: true });
        hitZone.on("pointerdown", () => {
          void activateNode();
        });

        if (!completed) {
          this.tweens.add({
            targets: circle,
            scale: 1.1,
            duration: 700,
            yoyo: true,
            repeat: -1,
          });
        }
      }
    }

    if (isMapDebugEnabled()) {
      const collisions = validateMapLayout(mobile ? MOBILE_MAP_LAYOUT : DESKTOP_MAP_LAYOUT, {
        width,
        height,
        mobile,
        subtitleIds: allBattleSubtitleIds(),
      });
      if (collisions.length) {
        console.warn("[Skatsim] map layout collisions", collisions);
      } else {
        console.info("[Skatsim] map layout OK — no collisions");
      }
    }

    addAudioControls(this);
    this.addResetButton(width, height, audio);
  }

  private drawChapterBand(width: number, height: number, save: SaveData): void {
    const y = MOBILE_CHAPTER_BAND_Y * height;
    const band = this.add.graphics().setDepth(5);
    // Thin terrain gate — no fog blobs (those read as a UI glitch).
    band.lineStyle(2, 0x8aa8c0, 0.55);
    band.lineBetween(24, y, width - 24, y);
    band.lineStyle(1, 0x1a2030, 0.35);
    band.lineBetween(24, y + 3, width - 24, y + 3);
    const caption = save.chapter2Unlocked ? "— Chapter 2 —" : "— Chapter 2 locked —";
    this.add
      .text(width / 2, y, caption, {
        fontFamily: "monospace",
        fontSize: "11px",
        color: save.chapter2Unlocked ? "#c8dce8" : "#8a9aaa",
        backgroundColor: "#121820cc",
        padding: { x: 8, y: 3 },
      })
      .setOrigin(0.5)
      .setDepth(6);
  }

  private drawPaths(
    width: number,
    height: number,
    mobile: boolean,
    byId: Map<string, MapNodeDef>,
    save: SaveData,
  ): void {
    const g = this.add.graphics().setDepth(8);
    for (const [fromId, toId] of mapEdges(mobile)) {
      const a = byId.get(fromId);
      const b = byId.get(toId);
      if (!a || !b) continue;
      const ap = nodeMapPos(a, mobile);
      const bp = nodeMapPos(b, mobile);
      const ax = ap.x * width;
      const ay = ap.y * height;
      const bx = bp.x * width;
      const by = bp.y * height;

      const state = this.edgeState(a, b, save);
      if (state === "completed") g.lineStyle(4, 0xf0c050, 0.7);
      else if (state === "available") g.lineStyle(3, 0xc8b890, 0.55);
      else g.lineStyle(3, 0x3a3548, 0.4);

      const layoutA = getMapNodeLayout(a.id, mobile);
      const layoutB = getMapNodeLayout(b.id, mobile);
      const { cx, cy } = this.pathControlPoint(ax, ay, bx, by, layoutA, layoutB, width);

      g.beginPath();
      g.moveTo(ax, ay);
      g.lineTo((ax + cx) / 2, (ay + cy) / 2);
      g.lineTo(cx, cy);
      g.lineTo((cx + bx) / 2, (cy + by) / 2);
      g.lineTo(bx, by);
      g.strokePath();
    }
  }

  private edgeState(from: MapNodeDef, to: MapNodeDef, save: SaveData): PathState {
    const fromVis = isNodeVisited(from, save);
    const toVis = isNodeVisited(to, save);
    if (fromVis && toVis) return "completed";
    if (fromVis && isNodeUnlocked(to, save)) return "available";
    return "locked";
  }

  private pathControlPoint(
    ax: number,
    ay: number,
    bx: number,
    by: number,
    layoutA: MapNodeLayout | undefined,
    layoutB: MapNodeLayout | undefined,
    width: number,
  ): { cx: number; cy: number } {
    const midX = (ax + bx) / 2;
    const midY = (ay + by) / 2;
    // Bend toward canvas center so serpentine segments clear side labels.
    const towardCenter = width / 2 - midX;
    let pull = Math.sign(towardCenter) * Math.min(48, Math.abs(towardCenter) * 0.45);
    // If both labels face inward, pull the other way slightly.
    const aIn =
      layoutA &&
      ((layoutA.labelAlign === "left" && layoutA.x < 0.4) ||
        (layoutA.labelAlign === "right" && layoutA.x > 0.6));
    const bIn =
      layoutB &&
      ((layoutB.labelAlign === "left" && layoutB.x < 0.4) ||
        (layoutB.labelAlign === "right" && layoutB.x > 0.6));
    if (aIn && bIn) pull *= 0.35;
    return { cx: midX + pull, cy: midY };
  }

  private drawNodeCard(
    node: MapNodeDef,
    layout: MapNodeLayout | undefined,
    nx: number,
    ny: number,
    _radius: number,
    locked: boolean,
    completed: boolean,
    _mobile: boolean,
  ): { bounds: { x: number; y: number; w: number; h: number } } {
    const status = completed ? "✓" : locked ? "·" : "►";
    const title = `${status} ${node.label}`;
    const subtitle = this.cardSubtitle(node, locked, completed);
    const hasSub = Boolean(subtitle);
    const size = estimateLabelSize(title, hasSub);

    const align = layout?.labelAlign ?? "center";
    const ox = labelOriginX(align);
    const labelX = nx + (layout?.labelOffsetX ?? 0);
    const labelY = ny + (layout?.labelOffsetY ?? 36);

    const cardH = size.h + 6;
    const cardW = size.w + 8;
    const bg = this.add
      .rectangle(labelX, labelY, cardW, cardH, 0x0c0a12, locked ? 0.78 : 0.82)
      .setStrokeStyle(1, locked ? 0x4a4050 : 0x5a5060, 0.85)
      .setOrigin(ox, 0.5)
      .setDepth(21);

    const titleColor = locked ? "#c8b8a8" : "#f2e9d8";
    this.add
      .text(labelX, hasSub ? labelY - 7 : labelY, title, {
        fontFamily: "monospace",
        fontSize: "12px",
        color: titleColor,
      })
      .setOrigin(ox, 0.5)
      .setDepth(22);

    if (subtitle) {
      this.add
        .text(labelX, labelY + 8, subtitle, {
          fontFamily: "monospace",
          fontSize: "10px",
          color: locked ? "#5a5048" : completed ? "#7a7060" : "#a89888",
        })
        .setOrigin(ox, 0.5)
        .setAlpha(completed ? 0.65 : 0.9)
        .setDepth(22);
    }

    const bounds = {
      x: labelX - cardW * ox,
      y: labelY - cardH / 2,
      w: cardW,
      h: cardH,
    };
    void bg;
    return { bounds };
  }

  private cardSubtitle(
    node: MapNodeDef,
    locked: boolean,
    completed: boolean,
  ): string | null {
    if (locked || node.kind === "village") return null;
    const reward = nodeRewardPreview(node);
    const rewardText = reward ? `${reward.gold}G · ${reward.materials}M` : null;

    if (completed) {
      return rewardText;
    }

    // Available: compact encounter + reward
    if (node.objectivePreview) {
      return [node.objectivePreview, rewardText].filter(Boolean).join(" · ");
    }
    if (node.kind === "ending") {
      return "The final hall…";
    }
    const enemies = (node.enemyPreview ?? []).slice(0, 2).join(" · ");
    return [enemies, rewardText].filter(Boolean).join(" · ") || null;
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
        .text(
          width / 2,
          height / 2 - 16,
          "Gold, materials, levels and\nunlocked nodes will be cleared.",
          {
            fontFamily: "monospace",
            fontSize: "11px",
            color: "#a89888",
            align: "center",
          },
        )
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
