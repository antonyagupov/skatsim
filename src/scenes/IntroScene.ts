import Phaser from "phaser";
import { AudioManager } from "../audio/AudioManager";
import { updateSave } from "../data/save";
import { addAudioControls } from "../ui/AudioControls";
import { presentDialogueOverlay } from "../ui/DialogueOverlay";
import type { DialogueLine } from "../systems/dialogue/DialogueRunner";

const INTRO_LINES: DialogueLine[] = [
  {
    speaker: "Warrior",
    portraitKey: "hero-warrior-portrait",
    text: "The ruins stir again. Stay close — I'll take the front.",
  },
  {
    speaker: "Mage",
    portraitKey: "hero-mage-portrait",
    text: "Match the colors and the field answers. Ice for the crowded fights.",
  },
  {
    speaker: "Ranger",
    portraitKey: "hero-ranger-portrait",
    text: "I'll mark the wounded. Don't let the countdown hit zero.",
  },
  {
    speaker: "Priest",
    portraitKey: "hero-priest-portrait",
    text: "Light will hold us. Spend wisely in the Village when you can.",
  },
  {
    speaker: "Warrior",
    portraitKey: "hero-warrior-portrait",
    text: "Open the world map. First stop — Ruins Path.",
  },
];

export class IntroScene extends Phaser.Scene {
  private audio = AudioManager.get();

  constructor() {
    super("Intro");
  }

  create(): void {
    const { width, height } = this.scale;
    void this.audio.unlock().then(() => this.audio.playTrack("world"));

    if (this.textures.exists("splash-bg")) {
      this.add.image(width / 2, height / 2, "splash-bg").setDisplaySize(width, height);
    } else if (this.textures.exists("env-village")) {
      this.add.image(width / 2, height / 2, "env-village").setDisplaySize(width, height);
    } else {
      this.add.rectangle(width / 2, height / 2, width, height, 0x14101a);
    }

    this.add.rectangle(width / 2, height / 2, width, height, 0x08060d, 0.45);

    addAudioControls(this);
    this.cameras.main.fadeIn(320, 10, 8, 16);

    presentDialogueOverlay(this, {
      title: "SKATSIM",
      lines: INTRO_LINES,
      dimAlpha: 0.2,
      onComplete: () => this.finish(),
    });
  }

  private finish(): void {
    updateSave({ introSeen: true });
    this.audio.sfx("ui_click");
    this.cameras.main.fadeOut(220, 10, 8, 16);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start("World");
    });
  }
}
