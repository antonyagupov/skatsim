import Phaser from "phaser";
import type { AssetManifest } from "../assets/types";

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
      this.scene.start("Menu");
    });
    this.load.start();
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
}
