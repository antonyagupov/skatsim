import type Phaser from "phaser";
import { AudioManager } from "../audio/AudioManager";
import { loadSave } from "../data/save";

export type AudioControlsHandle = {
  refresh: () => void;
};

type Options = {
  depth?: number;
};

/**
 * Compact music + SFX mute cluster — always bottom-left on every scene.
 */
export function addAudioControls(
  scene: Phaser.Scene,
  opts: Options = {},
): AudioControlsHandle {
  const audio = AudioManager.get();
  const save = loadSave();
  const { height } = scene.scale;
  const depth = opts.depth ?? 1000;

  const style: Phaser.Types.GameObjects.Text.TextStyle = {
    fontFamily: "monospace",
    fontSize: "13px",
    color: "#f2e9d8",
    backgroundColor: "#2a2238",
    padding: { x: 8, y: 5 },
  };

  // Single cluster, bottom-left: [♪] [♫]
  const musicX = 12;
  const sfxX = 60;
  const y = height - 24;

  const musicBtn = scene.add
    .text(musicX, y, save.musicMuted ? "♪ off" : "♪", style)
    .setOrigin(0, 0.5)
    .setDepth(depth)
    .setScrollFactor(0)
    .setInteractive({ useHandCursor: true });

  const sfxBtn = scene.add
    .text(sfxX, y, save.sfxMuted ? "♫ off" : "♫", style)
    .setOrigin(0, 0.5)
    .setDepth(depth)
    .setScrollFactor(0)
    .setInteractive({ useHandCursor: true });

  const refresh = () => {
    const s = audio.settings;
    musicBtn.setText(s.musicMuted ? "♪ off" : "♪");
    sfxBtn.setText(s.sfxMuted ? "♫ off" : "♫");
  };

  musicBtn.on("pointerdown", () => {
    void audio.unlock().then(() => {
      audio.setMusicMuted(!audio.settings.musicMuted);
      refresh();
      audio.sfx("ui_click");
    });
  });

  sfxBtn.on("pointerdown", () => {
    void audio.unlock().then(() => {
      audio.setSfxMuted(!audio.settings.sfxMuted);
      refresh();
      audio.sfx("ui_click");
    });
  });

  return { refresh };
}
