import { loadSave, updateSave, type SaveData } from "../data/save";

export type TrackId = "battle" | "battle_boss" | "world" | "village" | "none";

type Note = {
  /** MIDI-ish step in C major scale index, or -1 for rest */
  step: number;
  beats: number;
};

type TrackDef = {
  bpm: number;
  /** Melody phrase A */
  leadA: Note[];
  /** Melody phrase B */
  leadB: Note[];
  bass: Note[];
  arp?: Note[];
  drums?: boolean;
  leadType: OscillatorType;
  bassType: OscillatorType;
};

/** Map scale degree (0=C4) to frequency */
function deg(step: number, octave = 0): number {
  const scale = [0, 2, 4, 5, 7, 9, 11]; // C major
  if (step < 0) return 0;
  const o = Math.floor(step / 7) + octave;
  const d = ((step % 7) + 7) % 7;
  const midi = 60 + scale[d]! + o * 12;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

const BATTLE: TrackDef = {
  bpm: 124,
  leadType: "square",
  bassType: "triangle",
  drums: true,
  leadA: [
    { step: 4, beats: 0.5 },
    { step: 5, beats: 0.5 },
    { step: 7, beats: 0.5 },
    { step: 9, beats: 0.75 },
    { step: 7, beats: 0.5 },
    { step: 5, beats: 0.5 },
    { step: 4, beats: 1 },
    { step: 2, beats: 0.5 },
    { step: 4, beats: 0.5 },
    { step: 5, beats: 0.5 },
    { step: 7, beats: 1.25 },
  ],
  leadB: [
    { step: 9, beats: 0.5 },
    { step: 7, beats: 0.5 },
    { step: 5, beats: 0.5 },
    { step: 4, beats: 0.5 },
    { step: 5, beats: 0.5 },
    { step: 7, beats: 0.5 },
    { step: 9, beats: 1 },
    { step: 11, beats: 0.5 },
    { step: 9, beats: 0.5 },
    { step: 7, beats: 1.5 },
  ],
  bass: [
    { step: 0, beats: 1 },
    { step: 0, beats: 1 },
    { step: 3, beats: 1 },
    { step: 4, beats: 1 },
    { step: 0, beats: 1 },
    { step: 5, beats: 1 },
    { step: 3, beats: 1 },
    { step: 4, beats: 1 },
  ],
  arp: [
    { step: 0, beats: 0.25 },
    { step: 2, beats: 0.25 },
    { step: 4, beats: 0.25 },
    { step: 7, beats: 0.25 },
    { step: 4, beats: 0.25 },
    { step: 2, beats: 0.25 },
    { step: 0, beats: 0.25 },
    { step: 4, beats: 0.25 },
  ],
};

const BATTLE_BOSS: TrackDef = {
  bpm: 148,
  leadType: "sawtooth",
  bassType: "square",
  drums: true,
  leadA: [
    { step: 7, beats: 0.25 },
    { step: 7, beats: 0.25 },
    { step: 9, beats: 0.5 },
    { step: 11, beats: 0.5 },
    { step: 9, beats: 0.25 },
    { step: 7, beats: 0.25 },
    { step: 5, beats: 0.5 },
    { step: 4, beats: 0.5 },
    { step: 2, beats: 0.5 },
    { step: 4, beats: 0.75 },
    { step: 0, beats: 0.5 },
  ],
  leadB: [
    { step: 11, beats: 0.5 },
    { step: 12, beats: 0.25 },
    { step: 11, beats: 0.25 },
    { step: 9, beats: 0.5 },
    { step: 7, beats: 0.5 },
    { step: 9, beats: 0.5 },
    { step: 11, beats: 0.75 },
    { step: 14, beats: 0.5 },
    { step: 12, beats: 0.5 },
    { step: 11, beats: 1 },
  ],
  bass: [
    { step: 0, beats: 0.5 },
    { step: 0, beats: 0.5 },
    { step: 3, beats: 0.5 },
    { step: 3, beats: 0.5 },
    { step: 4, beats: 0.5 },
    { step: 4, beats: 0.5 },
    { step: 5, beats: 0.5 },
    { step: 4, beats: 0.5 },
  ],
  arp: [
    { step: 0, beats: 0.125 },
    { step: 4, beats: 0.125 },
    { step: 7, beats: 0.125 },
    { step: 11, beats: 0.125 },
    { step: 7, beats: 0.125 },
    { step: 4, beats: 0.125 },
    { step: 0, beats: 0.125 },
    { step: 7, beats: 0.125 },
  ],
};

const WORLD: TrackDef = {
  bpm: 88,
  leadType: "triangle",
  bassType: "triangle",
  drums: false,
  leadA: [
    { step: 4, beats: 1 },
    { step: 5, beats: 1 },
    { step: 7, beats: 1.5 },
    { step: 5, beats: 1 },
    { step: 2, beats: 1.5 },
    { step: 0, beats: 2 },
  ],
  leadB: [
    { step: 7, beats: 1 },
    { step: 9, beats: 1 },
    { step: 7, beats: 1 },
    { step: 5, beats: 1 },
    { step: 4, beats: 1.5 },
    { step: 2, beats: 2.5 },
  ],
  bass: [
    { step: 0, beats: 2 },
    { step: 3, beats: 2 },
    { step: 4, beats: 2 },
    { step: 0, beats: 2 },
  ],
  arp: [
    { step: 0, beats: 0.5 },
    { step: 4, beats: 0.5 },
    { step: 7, beats: 0.5 },
    { step: 4, beats: 0.5 },
  ],
};

const VILLAGE: TrackDef = {
  bpm: 78,
  leadType: "sine",
  bassType: "triangle",
  drums: false,
  leadA: [
    { step: 2, beats: 1 },
    { step: 4, beats: 1 },
    { step: 5, beats: 1.5 },
    { step: 4, beats: 1 },
    { step: 0, beats: 1.5 },
    { step: -1, beats: 1 },
  ],
  leadB: [
    { step: 5, beats: 1 },
    { step: 4, beats: 1 },
    { step: 2, beats: 1 },
    { step: 0, beats: 1.5 },
    { step: 2, beats: 1.5 },
    { step: -1, beats: 1 },
  ],
  bass: [
    { step: 0, beats: 2 },
    { step: 5, beats: 2 },
    { step: 3, beats: 2 },
    { step: 0, beats: 2 },
  ],
};

function phraseDurationBeats(notes: Note[]): number {
  return notes.reduce((s, n) => s + n.beats, 0);
}

export class AudioManager {
  private static instance: AudioManager | null = null;

  static get(): AudioManager {
    if (!this.instance) this.instance = new AudioManager();
    return this.instance;
  }

  static resetInstanceForTests(): void {
    if (this.instance) this.instance.stopAll();
    this.instance = null;
  }

  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicTimer: number | null = null;
  private track: TrackId = "none";
  /** Bumps on every stop/switch so in-flight loops abort. */
  private generation = 0;
  private activeSources = new Set<AudioScheduledSourceNode>();
  private unlocked = false;
  settings: SaveData;

  private constructor() {
    this.settings = loadSave();
  }

  async unlock(): Promise<void> {
    if (!this.ctx) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.musicBus = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.musicBus.connect(this.musicGain);
      this.musicGain.connect(this.master);
      this.sfxGain.connect(this.master);
      this.master.connect(this.ctx.destination);
      this.applyGains();
    }
    if (this.ctx.state === "suspended") await this.ctx.resume();
    this.unlocked = true;
  }

  applyGains(): void {
    if (!this.musicGain || !this.sfxGain) return;
    this.musicGain.gain.value = this.settings.musicMuted
      ? 0
      : this.settings.musicVolume;
    this.sfxGain.gain.value = this.settings.sfxMuted
      ? 0
      : this.settings.sfxVolume;
  }

  setMusicVolume(v: number): void {
    this.settings = updateSave({ musicVolume: Math.max(0, Math.min(1, v)) });
    this.applyGains();
  }

  setSfxVolume(v: number): void {
    this.settings = updateSave({ sfxVolume: Math.max(0, Math.min(1, v)) });
    this.applyGains();
  }

  setMusicMuted(m: boolean): void {
    this.settings = updateSave({ musicMuted: m });
    this.applyGains();
  }

  setSfxMuted(m: boolean): void {
    this.settings = updateSave({ sfxMuted: m });
    this.applyGains();
  }

  get currentTrack(): TrackId {
    return this.track;
  }

  /** Hard-stop loop timer and every scheduled music voice. */
  stopMusic(): void {
    this.generation += 1;
    if (this.musicTimer !== null) {
      window.clearTimeout(this.musicTimer);
      this.musicTimer = null;
    }
    for (const src of this.activeSources) {
      try {
        src.stop(0);
      } catch {
        /* already stopped */
      }
      try {
        src.disconnect();
      } catch {
        /* ignore */
      }
    }
    this.activeSources.clear();
    // Silence bus instantly so tails cannot bleed into the next track
    if (this.musicBus && this.ctx) {
      const t = this.ctx.currentTime;
      this.musicBus.gain.cancelScheduledValues(t);
      this.musicBus.gain.setValueAtTime(0, t);
      this.musicBus.gain.setValueAtTime(1, t + 0.02);
    }
    this.track = "none";
  }

  stopAll(): void {
    this.stopMusic();
    void this.ctx?.close();
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.musicBus = null;
    this.sfxGain = null;
    this.unlocked = false;
  }

  playTrack(id: TrackId): void {
    if (id === this.track) return;
    this.stopMusic();
    this.track = id;
    if (id === "none" || !this.unlocked) return;
    const gen = this.generation;
    void this.scheduleLoop(id, gen);
  }

  private trackDef(id: TrackId): TrackDef | null {
    if (id === "battle") return BATTLE;
    if (id === "battle_boss") return BATTLE_BOSS;
    if (id === "world") return WORLD;
    if (id === "village") return VILLAGE;
    return null;
  }

  private register(src: AudioScheduledSourceNode): void {
    this.activeSources.add(src);
    src.onended = () => this.activeSources.delete(src);
  }

  private playTone(
    dest: AudioNode,
    freq: number,
    start: number,
    dur: number,
    type: OscillatorType,
    gain: number,
    asMusic: boolean,
  ): void {
    if (!this.ctx || freq <= 0 || dur <= 0) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(gain, start + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, start + Math.max(0.03, dur));
    osc.connect(g);
    g.connect(dest);
    if (asMusic) this.register(osc);
    osc.start(start);
    osc.stop(start + dur + 0.03);
  }

  private noiseBurst(dest: AudioNode, start: number, dur: number, gain: number): void {
    if (!this.ctx) return;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    const f = this.ctx.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = 900;
    g.gain.setValueAtTime(gain, start);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    src.connect(f);
    f.connect(g);
    g.connect(dest);
    this.register(src);
    src.start(start);
    src.stop(start + dur);
  }

  private scheduleNotes(
    dest: AudioNode,
    notes: Note[],
    start: number,
    beatSec: number,
    type: OscillatorType,
    gain: number,
    octave: number,
  ): number {
    let t = start;
    for (const n of notes) {
      const dur = n.beats * beatSec * 0.92;
      if (n.step >= 0) {
        this.playTone(dest, deg(n.step, octave), t, dur, type, gain, true);
      }
      t += n.beats * beatSec;
    }
    return t;
  }

  private async scheduleLoop(id: TrackId, gen: number): Promise<void> {
    await this.unlock();
    if (
      !this.ctx ||
      !this.musicBus ||
      this.track !== id ||
      this.generation !== gen
    ) {
      return;
    }
    const def = this.trackDef(id);
    if (!def) return;

    const ctx = this.ctx;
    const dest = this.musicBus;
    const beatSec = 60 / def.bpm;
    const t0 = ctx.currentTime + 0.04;

    // A then B for form
    const leadEndA = this.scheduleNotes(
      dest,
      def.leadA,
      t0,
      beatSec,
      def.leadType,
      0.04,
      1,
    );
    const leadEnd = this.scheduleNotes(
      dest,
      def.leadB,
      leadEndA,
      beatSec,
      def.leadType,
      0.042,
      1,
    );

    // Bass loops under full phrase
    const bassBeats = phraseDurationBeats(def.bass);
    const totalBeats =
      phraseDurationBeats(def.leadA) + phraseDurationBeats(def.leadB);
    let bt = t0;
    const bassUntil = t0 + totalBeats * beatSec;
    while (bt < bassUntil - 0.01) {
      bt = this.scheduleNotes(dest, def.bass, bt, beatSec, def.bassType, 0.055, -1);
      // prevent infinite if bass empty
      if (bassBeats <= 0) break;
    }

    if (def.arp) {
      let at = t0;
      const arpBeats = phraseDurationBeats(def.arp);
      while (at < bassUntil - 0.01) {
        at = this.scheduleNotes(dest, def.arp, at, beatSec, "square", 0.018, 0);
        if (arpBeats <= 0) break;
      }
    }

    if (def.drums) {
      const steps = Math.floor(totalBeats * 2);
      for (let i = 0; i < steps; i++) {
        const t = t0 + i * (beatSec * 0.5);
        if (i % 4 === 0) this.noiseBurst(dest, t, 0.06, 0.035);
        else if (i % 2 === 0) this.noiseBurst(dest, t, 0.03, 0.02);
      }
    }

    const loopMs = (leadEnd - ctx.currentTime) * 1000;
    this.musicTimer = window.setTimeout(() => {
      if (this.track === id && this.generation === gen) {
        void this.scheduleLoop(id, gen);
      }
    }, Math.max(250, loopMs - 40));
  }

  private sfxTone(
    freq: number,
    dur: number,
    type: OscillatorType = "square",
    gain = 0.08,
  ): void {
    if (!this.unlocked || !this.ctx || !this.sfxGain) return;
    this.playTone(
      this.sfxGain,
      freq,
      this.ctx.currentTime,
      dur,
      type,
      gain,
      false,
    );
  }

  sfx(name: string): void {
    if (!this.unlocked) return;
    const map: Record<string, () => void> = {
      ui_hover: () => this.sfxTone(880, 0.04, "sine", 0.03),
      ui_click: () => this.sfxTone(660, 0.06, "square", 0.05),
      gem_select: () => this.sfxTone(740, 0.05, "triangle", 0.05),
      gem_swap: () => this.sfxTone(520, 0.07, "square", 0.06),
      gem_invalid: () => this.sfxTone(180, 0.12, "sawtooth", 0.04),
      match3: () => this.sfxTone(880, 0.1, "square", 0.07),
      match4: () => {
        this.sfxTone(880, 0.08, "square", 0.07);
        this.sfxTone(1175, 0.1, "square", 0.05);
      },
      match5: () => {
        this.sfxTone(988, 0.08, "square", 0.07);
        this.sfxTone(1319, 0.12, "square", 0.06);
      },
      cascade: () => this.sfxTone(1046, 0.08, "triangle", 0.06),
      atk_warrior: () => this.sfxTone(220, 0.12, "sawtooth", 0.07),
      atk_mage: () => this.sfxTone(990, 0.14, "sine", 0.06),
      atk_ranger: () => this.sfxTone(640, 0.09, "square", 0.06),
      atk_priest: () => this.sfxTone(784, 0.16, "sine", 0.05),
      enemy_hit: () => this.sfxTone(150, 0.1, "triangle", 0.07),
      hero_hit: () => this.sfxTone(120, 0.12, "sawtooth", 0.05),
      enemy_attack: () => this.sfxTone(100, 0.14, "sawtooth", 0.06),
      ability_ready: () => this.sfxTone(1175, 0.15, "triangle", 0.05),
      ability_use: () => this.sfxTone(523, 0.2, "square", 0.07),
      victory: () => {
        this.sfxTone(523, 0.12, "square", 0.07);
        this.sfxTone(659, 0.12, "square", 0.07);
        this.sfxTone(784, 0.2, "square", 0.07);
      },
      defeat: () => this.sfxTone(110, 0.35, "sawtooth", 0.05),
      extra_move: () => {
        this.sfxTone(784, 0.08, "triangle", 0.06);
        this.sfxTone(1046, 0.12, "triangle", 0.05);
      },
      special_create: () => {
        this.sfxTone(880, 0.06, "sine", 0.05);
        this.sfxTone(1320, 0.14, "sine", 0.06);
      },
      special_activate: () => {
        this.sfxTone(660, 0.1, "square", 0.07);
        this.sfxTone(990, 0.16, "square", 0.05);
      },
      elemental_weak: () => this.sfxTone(1200, 0.1, "sawtooth", 0.05),
      elemental_resist: () => this.sfxTone(200, 0.12, "triangle", 0.05),
      countdown_warn: () => this.sfxTone(440, 0.08, "square", 0.04),
      facility_upgrade: () => {
        this.sfxTone(392, 0.1, "triangle", 0.06);
        this.sfxTone(523, 0.14, "triangle", 0.05);
      },
      level_up: () => {
        this.sfxTone(523, 0.08, "square", 0.06);
        this.sfxTone(659, 0.08, "square", 0.06);
        this.sfxTone(784, 0.16, "square", 0.06);
      },
      boss_phase: () => {
        this.sfxTone(90, 0.2, "sawtooth", 0.08);
        this.sfxTone(160, 0.25, "sawtooth", 0.06);
      },
      reward_collect: () => {
        this.sfxTone(880, 0.07, "sine", 0.05);
        this.sfxTone(1175, 0.1, "sine", 0.05);
      },
      board_shuffle: () => this.sfxTone(300, 0.15, "triangle", 0.05),
    };
    map[name]?.();
  }

  /** Cascade match pitch rises with cascade index. */
  sfxMatchCascade(cascadeIndex: number, matchLen: number): void {
    if (!this.unlocked) return;
    const base =
      matchLen >= 5 ? 988 : matchLen >= 4 ? 880 : 784;
    const pitch = base * (1 + cascadeIndex * 0.08);
    this.sfxTone(pitch, 0.09, "square", 0.065);
  }
}
