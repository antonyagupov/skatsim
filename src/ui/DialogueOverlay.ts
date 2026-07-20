import Phaser from "phaser";
import { DialogueRunner, type DialogueLine } from "../systems/dialogue/DialogueRunner";
import { AudioManager } from "../audio/AudioManager";
import { pickLayoutProfile } from "./layoutProfile";

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
  const mobile = pickLayoutProfile(width, height) === "mobile";
  const root = scene.add.container(0, 0).setDepth(4000);

  const dim = scene.add
    .rectangle(width / 2, height / 2, width, height, 0x08060d, opts.dimAlpha ?? 0.55)
    .setInteractive();
  root.add(dim);

  if (opts.title) {
    root.add(
      scene.add
        .text(width / 2, mobile ? 28 : 36, opts.title, {
          fontFamily: "Cinzel, Palatino, serif",
          fontSize: mobile ? "20px" : "24px",
          color: "#f7efdc",
          stroke: "#5f351d",
          strokeThickness: 2,
        })
        .setOrigin(0.5),
    );
  }

  const boxH = mobile ? 210 : 168;
  const boxPad = mobile ? 16 : 24;
  /** Keep Continue/Skip above home-indicator / scene chrome. */
  const chromeInset = mobile ? 64 : 28;
  const boxY = height - boxH / 2 - chromeInset;
  root.add(
    scene.add
      .rectangle(width / 2, boxY, width - boxPad * 2, boxH, 0x12101a, 0.94)
      .setStrokeStyle(2, 0xd4aa62, 0.85),
  );

  const portraitSize = mobile ? 56 : 96;
  const portraitX = mobile ? boxPad + 12 + portraitSize / 2 : 88;
  const portraitY = mobile ? boxY - boxH / 2 + 16 + portraitSize / 2 : boxY - 8;

  const portraitFrame = scene.add
    .rectangle(portraitX, portraitY, portraitSize + 4, portraitSize + 4, 0x1a1528)
    .setStrokeStyle(2, 0xd4aa62, 0.7);
  root.add(portraitFrame);

  const portrait = scene.add
    .image(portraitX, portraitY, "hero-warrior")
    .setDisplaySize(portraitSize, portraitSize);
  root.add(portrait);

  const textLeft = mobile
    ? portraitX + portraitSize / 2 + 12
    : 160;
  const textWrap = mobile ? width - textLeft - boxPad - 8 : width - 220;
  const nameY = mobile ? boxY - boxH / 2 + 28 : boxY - 58;
  const bodyY = mobile ? boxY - boxH / 2 + 48 : boxY - 18;
  const bodyMaxH = mobile ? boxH - 100 : boxH - 80;

  const nameText = scene.add
    .text(textLeft, nameY, "", {
      fontFamily: "monospace",
      fontSize: mobile ? "14px" : "16px",
      color: "#f0c050",
    })
    .setOrigin(0, 0.5);
  root.add(nameText);

  const dialogueText = scene.add
    .text(textLeft, bodyY, "", {
      fontFamily: "monospace",
      fontSize: mobile ? "13px" : "15px",
      color: "#f2e9d8",
      wordWrap: { width: Math.max(120, textWrap) },
      lineSpacing: mobile ? 4 : 6,
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
    if (dialogueText.height > bodyMaxH) {
      dialogueText.setFontSize(mobile ? "12px" : "14px");
    }
    if (line.portraitKey && scene.textures.exists(line.portraitKey)) {
      portrait.setTexture(line.portraitKey).setDisplaySize(portraitSize, portraitSize).setVisible(true);
      portraitFrame.setVisible(true).setStrokeStyle(2, 0xd4aa62, 0.7);
    } else if (line.portraitKey && scene.textures.exists(line.portraitKey.replace("-portrait", ""))) {
      portrait
        .setTexture(line.portraitKey.replace("-portrait", ""))
        .setDisplaySize(portraitSize, portraitSize)
        .setVisible(true);
      portraitFrame.setVisible(true).setStrokeStyle(2, 0xd4aa62, 0.7);
    } else if (isVoice) {
      portrait.setVisible(false);
      portraitFrame.setVisible(true).setStrokeStyle(2, 0x40ffc0, 0.75);
    } else {
      portrait.setTexture("hero-warrior").setDisplaySize(portraitSize, portraitSize).setVisible(true);
      portraitFrame.setVisible(true).setStrokeStyle(2, 0xd4aa62, 0.7);
    }
    audio.sfx(isVoice ? "countdown_warn" : "ui_click");
  };

  const btnY = boxY + boxH / 2 - (mobile ? 36 : 32);
  const continueBtn = scene.add
    .text(width - boxPad - 8, btnY, "Continue ▶", {
      fontFamily: "monospace",
      fontSize: mobile ? "15px" : "14px",
      color: "#1a1008",
      backgroundColor: "#d06a2e",
      padding: { x: mobile ? 14 : 12, y: mobile ? 10 : 8 },
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
    .text(boxPad + 8, btnY, "Skip", {
      fontFamily: "monospace",
      fontSize: mobile ? "14px" : "13px",
      color: "#c8b090",
      backgroundColor: "#2a2238",
      padding: { x: mobile ? 12 : 10, y: mobile ? 8 : 6 },
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
