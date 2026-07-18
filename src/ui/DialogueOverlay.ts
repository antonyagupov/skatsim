import Phaser from "phaser";
import { DialogueRunner, type DialogueLine } from "../systems/dialogue/DialogueRunner";
import { AudioManager } from "../audio/AudioManager";

export type DialogueOverlayOpts = {
  lines: DialogueLine[];
  onComplete: () => void;
  /** Optional title above the box */
  title?: string;
  /** Dim the rest of the scene */
  dimAlpha?: number;
};

/**
 * Lightweight Phaser dialogue UI driven by DialogueRunner.
 * Call from any scene; destroys itself on finish/skip.
 */
export function presentDialogueOverlay(
  scene: Phaser.Scene,
  opts: DialogueOverlayOpts,
): void {
  const audio = AudioManager.get();
  const runner = new DialogueRunner(opts.lines);
  const { width, height } = scene.scale;
  const root = scene.add.container(0, 0).setDepth(4000);

  const dim = scene.add
    .rectangle(width / 2, height / 2, width, height, 0x08060d, opts.dimAlpha ?? 0.55)
    .setInteractive();
  root.add(dim);

  if (opts.title) {
    root.add(
      scene.add
        .text(width / 2, 36, opts.title, {
          fontFamily: "Cinzel, Palatino, serif",
          fontSize: "24px",
          color: "#f7efdc",
          stroke: "#5f351d",
          strokeThickness: 2,
        })
        .setOrigin(0.5),
    );
  }

  const boxH = 168;
  const boxY = height - boxH / 2 - 28;
  root.add(
    scene.add
      .rectangle(width / 2, boxY, width - 48, boxH, 0x12101a, 0.94)
      .setStrokeStyle(2, 0xd4aa62, 0.85),
  );

  const portraitFrame = scene.add
    .rectangle(88, boxY - 8, 100, 100, 0x1a1528)
    .setStrokeStyle(2, 0xd4aa62, 0.7);
  root.add(portraitFrame);

  const portrait = scene.add.image(88, boxY - 8, "hero-warrior").setDisplaySize(96, 96);
  root.add(portrait);

  const nameText = scene.add
    .text(160, boxY - 58, "", {
      fontFamily: "monospace",
      fontSize: "16px",
      color: "#f0c050",
    })
    .setOrigin(0, 0.5);
  root.add(nameText);

  const dialogueText = scene.add
    .text(160, boxY - 18, "", {
      fontFamily: "monospace",
      fontSize: "15px",
      color: "#f2e9d8",
      wordWrap: { width: width - 220 },
      lineSpacing: 6,
    })
    .setOrigin(0, 0);
  root.add(dialogueText);

  const finish = (): void => {
    root.destroy(true);
    opts.onComplete();
  };

  const showCurrent = (): void => {
    const line = runner.current;
    if (!line) {
      finish();
      return;
    }
    const isVoice = line.portraitKey === null;
    // Meta voice (???) uses mint cyan — distinct from mage blue / hero gold
    nameText.setText(line.speaker).setColor(isVoice ? "#40ffc0" : "#f0c050");
    dialogueText.setText(line.text).setColor(isVoice ? "#a8ffe0" : "#f2e9d8");
    if (line.portraitKey && scene.textures.exists(line.portraitKey)) {
      portrait.setTexture(line.portraitKey).setDisplaySize(96, 96).setVisible(true);
      portraitFrame.setVisible(true).setStrokeStyle(2, 0xd4aa62, 0.7);
    } else if (line.portraitKey && scene.textures.exists(line.portraitKey.replace("-portrait", ""))) {
      portrait
        .setTexture(line.portraitKey.replace("-portrait", ""))
        .setDisplaySize(96, 96)
        .setVisible(true);
      portraitFrame.setVisible(true).setStrokeStyle(2, 0xd4aa62, 0.7);
    } else if (isVoice) {
      portrait.setVisible(false);
      portraitFrame.setVisible(true).setStrokeStyle(2, 0x40ffc0, 0.75);
    } else {
      portrait.setTexture("hero-warrior").setDisplaySize(96, 96).setVisible(true);
      portraitFrame.setVisible(true).setStrokeStyle(2, 0xd4aa62, 0.7);
    }
    audio.sfx(isVoice ? "countdown_warn" : "ui_click");
  };

  const continueBtn = scene.add
    .text(width - 56, boxY + 52, "Continue ▶", {
      fontFamily: "monospace",
      fontSize: "14px",
      color: "#1a1008",
      backgroundColor: "#d06a2e",
      padding: { x: 12, y: 8 },
    })
    .setOrigin(1, 0.5)
    .setInteractive({ useHandCursor: true });
  continueBtn.on("pointerdown", () => {
    if (runner.done) return;
    if (runner.lineIndex >= runner.lines.length - 1) {
      runner.skip();
      finish();
      return;
    }
    runner.advance();
    showCurrent();
  });
  root.add(continueBtn);

  const skipBtn = scene.add
    .text(56, boxY + 52, "Skip", {
      fontFamily: "monospace",
      fontSize: "13px",
      color: "#c8b090",
      backgroundColor: "#2a2238",
      padding: { x: 10, y: 6 },
    })
    .setOrigin(0, 0.5)
    .setInteractive({ useHandCursor: true });
  skipBtn.on("pointerdown", () => {
    runner.skip();
    finish();
  });
  root.add(skipBtn);

  const onKey = (ev: KeyboardEvent): void => {
    if (ev.key === " " || ev.key === "Enter") {
      continueBtn.emit("pointerdown");
    }
  };
  scene.input.keyboard?.on("keydown", onKey);
  root.once(Phaser.GameObjects.Events.DESTROY, () => {
    scene.input.keyboard?.off("keydown", onKey);
  });

  showCurrent();
}
