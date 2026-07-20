import Phaser from "phaser";
import type { AssetManifest } from "../assets/types";
import { pickLayoutProfile } from "../ui/layoutProfile";
import { addSceneBackground } from "../ui/sceneArt";

/** Resolve absolute `/assets/...` paths against Vite `base` (GitHub Pages). */
function assetUrl(path: string): string {
  const base = import.meta.env.BASE_URL || "/";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  if (path.startsWith("/")) {
    return `${base.replace(/\/?$/, "/")}${path.slice(1)}`;
  }
  return `${base}${path}`;
}

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super("Preload");
  }

  preload(): void {
    const { width, height } = this.scale;
    this.add.rectangle(width / 2, height / 2, 320, 18, 0x2a2238);
    const bar = this.add.rectangle(width / 2 - 158, height / 2, 4, 12, 0xd06a2e).setOrigin(0, 0.5);
    this.add
      .text(width / 2, height / 2 - 36, "Loading Skatsim…", {
        fontFamily: "monospace",
        fontSize: "16px",
        color: "#f2e9d8",
      })
      .setOrigin(0.5);

    this.load.on("progress", (v: number) => {
      bar.width = Math.max(4, 316 * v);
    });

    this.load.json("manifest", assetUrl("/assets/manifest.json"));
  }

  create(): void {
    const manifest = this.cache.json.get("manifest") as AssetManifest;
    const keys = Object.keys(manifest);
    keys.forEach((id) => {
      const path = manifest[id]?.path;
      if (path) this.load.image(id, assetUrl(path));
    });

    this.load.once("complete", () => {
      // Nearest-neighbor for all textures
      keys.forEach((id) => {
        if (this.textures.exists(id)) {
          this.textures.get(id).setFilter(Phaser.Textures.FilterMode.NEAREST);
        }
      });
      this.ensurePrismaticTexture();
      this.ensureLineGemTextures();
      this.showSplash();
    });
    this.load.start();
  }

  private showSplash(): void {
    const { width, height } = this.scale;
    this.children.removeAll(true);
    const mobile = pickLayoutProfile(width, height) === "mobile";

    if (
      !addSceneBackground(this, "splash-match3") &&
      !addSceneBackground(this, "splash-bg")
    ) {
      this.add.rectangle(width / 2, height / 2, width, height, 0x14101a);
    }

    const shade = this.add.graphics();
    shade.fillGradientStyle(0x08060d, 0x08060d, 0x08060d, 0x08060d, 0.58, 0.58, 0.08, 0.08);
    shade.fillRect(0, 0, width, height);

    const titleSize = mobile ? "42px" : "68px";
    const titleY = mobile ? height * 0.2 : height * 0.24;

    this.add
      .text(width / 2 + 3, titleY + 4, "SKATSIM", {
        fontFamily: "Cinzel, Palatino, serif",
        fontSize: titleSize,
        color: "#09060d",
      })
      .setOrigin(0.5)
      .setAlpha(0.7);

    this.add
      .text(width / 2, titleY, "SKATSIM", {
        fontFamily: "Cinzel, Palatino, serif",
        fontSize: titleSize,
        color: "#f7efdc",
        stroke: "#5f351d",
        strokeThickness: 2,
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, titleY + (mobile ? 42 : 58), "A MATCH-3 FANTASY", {
        fontFamily: "monospace",
        fontSize: mobile ? "11px" : "13px",
        color: "#e6c78e",
      })
      .setLetterSpacing(5)
      .setOrigin(0.5);

    this.cameras.main.fadeIn(350, 10, 8, 16);
    this.time.delayedCall(1100, () => {
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.scene.start("Menu");
      });
      this.cameras.main.fadeOut(260, 10, 8, 16);
    });
  }

  /** Procedural prismatic gem — no paid API needed. */
  private ensurePrismaticTexture(): void {
    if (this.textures.exists("gem-prismatic")) return;
    const g = this.make.graphics({ x: 0, y: 0 });
    g.fillStyle(0x1a1028, 1);
    g.fillCircle(24, 24, 22);
    g.fillStyle(0xff6688, 1);
    g.fillCircle(16, 16, 8);
    g.fillStyle(0x66aaff, 1);
    g.fillCircle(32, 16, 8);
    g.fillStyle(0x66dd88, 1);
    g.fillCircle(16, 32, 8);
    g.fillStyle(0xffee66, 1);
    g.fillCircle(32, 32, 8);
    g.fillStyle(0xffffff, 0.85);
    g.fillCircle(24, 24, 6);
    g.lineStyle(2, 0xffffff, 0.9);
    g.strokeCircle(24, 24, 22);
    g.generateTexture("gem-prismatic", 48, 48);
    g.destroy();
    this.textures.get("gem-prismatic").setFilter(Phaser.Textures.FilterMode.NEAREST);
  }

  /** Procedural line gems (match-4 specials). */
  private ensureLineGemTextures(): void {
    if (!this.textures.exists("gem-line-h")) {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0x1a2030, 1);
      g.fillRoundedRect(4, 4, 40, 40, 8);
      g.fillStyle(0x70d0ff, 1);
      g.fillRoundedRect(8, 18, 32, 12, 4);
      g.fillStyle(0xffffff, 0.85);
      g.fillCircle(24, 24, 5);
      g.lineStyle(2, 0xb8e8ff, 0.95);
      g.strokeRoundedRect(4, 4, 40, 40, 8);
      g.generateTexture("gem-line-h", 48, 48);
      g.destroy();
      this.textures.get("gem-line-h").setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    if (!this.textures.exists("gem-line-v")) {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0x1a2030, 1);
      g.fillRoundedRect(4, 4, 40, 40, 8);
      g.fillStyle(0x70d0ff, 1);
      g.fillRoundedRect(18, 8, 12, 32, 4);
      g.fillStyle(0xffffff, 0.85);
      g.fillCircle(24, 24, 5);
      g.lineStyle(2, 0xb8e8ff, 0.95);
      g.strokeRoundedRect(4, 4, 40, 40, 8);
      g.generateTexture("gem-line-v", 48, 48);
      g.destroy();
      this.textures.get("gem-line-v").setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
  }
}
