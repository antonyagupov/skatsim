import type Phaser from "phaser";
import { AudioManager } from "../audio/AudioManager";
import { loadSave } from "../data/save";
import { pickLayoutProfile } from "./layoutProfile";

export type AudioControlsHandle = {
  refresh: () => void;
};

type Options = {
  depth?: number;
  /** Distance from bottom edge to control baseline. */
  bottomInset?: number;
  /** Larger tap targets (mobile). */
  large?: boolean;
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
  const { width, height } = scene.scale;
  const profile = pickLayoutProfile(width, height);
  const large = opts.large ?? profile === "mobile";
  const bottomInset = opts.bottomInset ?? (profile === "mobile" ? 36 : 24);
  const depth = opts.depth ?? 1000;

  const style: Phaser.Types.GameObjects.Text.TextStyle = {
    fontFamily: "monospace",
    fontSize: large ? "15px" : "13px",
    color: "#f2e9d8",
    backgroundColor: "#2a2238",
    padding: { x: large ? 10 : 8, y: large ? 8 : 5 },
  };

  const musicX = 12;
  const sfxX = large ? 72 : 60;
  const y = height - bottomInset + 8;

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
