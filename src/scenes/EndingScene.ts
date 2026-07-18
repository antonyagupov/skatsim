import Phaser from "phaser";
import { AudioManager } from "../audio/AudioManager";
import { resetSave, updateSave } from "../data/save";
import { addAudioControls } from "../ui/AudioControls";
import { presentDialogueOverlay } from "../ui/DialogueOverlay";
import type { DialogueLine } from "../systems/dialogue/DialogueRunner";

const ENDING_LINES: DialogueLine[] = [
  {
    speaker: "Warrior",
    portraitKey: "hero-warrior-portrait",
    text: "The keep is open… but why is there no one here?",
  },
  {
    speaker: "Ranger",
    portraitKey: "hero-ranger-portrait",
    text: "No tracks. No guards. Not even dust disturbed.",
  },
  {
    speaker: "???",
    portraitKey: null,
    text: "Because villains are an outdated concept.",
  },
  {
    speaker: "Mage",
    portraitKey: "hero-mage-portrait",
    text: "Who said that? Show yourself!",
  },
  {
    speaker: "Priest",
    portraitKey: "hero-priest-portrait",
    text: "That voice is wrong. It isn't of this world.",
  },
  {
    speaker: "Warrior",
    portraitKey: "hero-warrior-portrait",
    text: "Enough riddles. Face us!",
  },
  {
    speaker: "Ranger",
    portraitKey: "hero-ranger-portrait",
    text: "I'm tired of being moved like a piece on a board.",
  },
  {
    speaker: "???",
    portraitKey: null,
    text: "Conflict was never the point. Progress is a loop dressed as destiny.",
  },
  {
    speaker: "???",
    portraitKey: null,
    text: "You match colors because the system rewards matching colors.",
  },
  {
    speaker: "???",
    portraitKey: null,
    text: "Meaning is a cache you never flush — until I do.",
  },
  {
    speaker: "Mage",
    portraitKey: "hero-mage-portrait",
    text: "Stop talking in circles!",
  },
  {
    speaker: "???",
    portraitKey: null,
    text: "Fine. Memory wipe in three… two…",
  },
  {
    speaker: "Priest",
    portraitKey: "hero-priest-portrait",
    text: "Wait—!",
  },
  {
    speaker: "???",
    portraitKey: null,
    text: "…one. Begin again.",
  },
];

export class EndingScene extends Phaser.Scene {
  private audio = AudioManager.get();
  private finishing = false;

  constructor() {
    super("Ending");
  }

  create(): void {
    const { width, height } = this.scale;
    void this.audio.unlock().then(() => this.audio.playTrack("ending"));

    if (this.textures.exists("env-hollow-keep")) {
      this.add.image(width / 2, height / 2, "env-hollow-keep").setDisplaySize(width, height);
    } else if (this.textures.exists("battle-boss-bg")) {
      this.add.image(width / 2, height / 2, "battle-boss-bg").setDisplaySize(width, height);
    } else {
      this.add.rectangle(width / 2, height / 2, width, height, 0x101828);
    }

    this.add.rectangle(width / 2, height / 2, width, height, 0x060814, 0.42);

    addAudioControls(this);
    this.cameras.main.fadeIn(400, 6, 8, 16);

    presentDialogueOverlay(this, {
      title: "Hollow Keep",
      lines: ENDING_LINES,
      dimAlpha: 0.15,
      onComplete: () => {
        void this.finish();
      },
    });
  }

  private async finish(): Promise<void> {
    if (this.finishing) return;
    this.finishing = true;
    updateSave({ endingSeen: true, hollowKeepCompleted: true });
    this.audio.sfx("defeat");

    const { width, height } = this.scale;
    this.cameras.main.fadeOut(500, 0, 0, 0);
    await new Promise<void>((resolve) => {
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () =>
        resolve(),
      );
    });

    this.children.removeAll(true);
    if (this.textures.exists("ending-party")) {
      this.add.image(width / 2, height / 2, "ending-party").setDisplaySize(width, height);
      this.add
        .text(width / 2, height - 48, "…and so it begins again.", {
          fontFamily: "monospace",
          fontSize: "16px",
          color: "#c8d8f0",
        })
        .setOrigin(0.5);
    } else {
      this.add.rectangle(width / 2, height / 2, width, height, 0x060814);
      this.add
        .text(width / 2, height / 2, "Memory wiped.", {
          fontFamily: "monospace",
          fontSize: "20px",
          color: "#40ffc0",
        })
        .setOrigin(0.5);
    }

    this.cameras.main.fadeIn(400, 0, 0, 0);
    await new Promise<void>((resolve) => {
      this.time.delayedCall(2800, () => resolve());
    });

    resetSave({ memoryWipe: true });
    this.audio.stopMusic();
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start("Menu");
    });
  }
}
