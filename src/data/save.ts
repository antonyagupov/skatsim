import type { HeroId } from "../assets/types";
import type { BuildingId } from "../systems/combat/progression";
import type { TutorialStepId } from "../systems/tutorial/TutorialManager";

export const SAVE_KEY = "skatsim.save.v1";
export const SAVE_VERSION = 5;

export type SaveData = {
  version: number;
  /** Legacy flags preserved for migration / compatibility */
  firstBattleCompleted: boolean;
  firstNodeUnlocked: boolean;
  firstNodeCompleted: boolean;
  forestNodeCompleted: boolean;
  quarryNodeCompleted: boolean;
  caveNodeCompleted: boolean;
  fortressNodeCompleted: boolean;
  bossDefeated: boolean;
  chapter2Unlocked: boolean;
  marshNodeCompleted: boolean;
  bridgeNodeCompleted: boolean;
  watchtowerNodeCompleted: boolean;
  hollowKeepCompleted: boolean;
  endingSeen: boolean;
  introSeen: boolean;
  tutorialCompleted: boolean;
  tutorialSteps: Partial<Record<TutorialStepId, boolean>>;
  gold: number;
  materials: number;
  heroLevels: Record<HeroId, number>;
  buildingLevels: Record<BuildingId, number>;
  musicVolume: number;
  sfxVolume: number;
  musicMuted: boolean;
  sfxMuted: boolean;
  /** Completed Hollow Keep memory wipes — scales next-loop difficulty. */
  memoryWipes: number;
};

export const DEFAULT_SAVE: SaveData = {
  version: SAVE_VERSION,
  firstBattleCompleted: false,
  firstNodeUnlocked: true,
  firstNodeCompleted: false,
  forestNodeCompleted: false,
  quarryNodeCompleted: false,
  caveNodeCompleted: false,
  fortressNodeCompleted: false,
  bossDefeated: false,
  chapter2Unlocked: false,
  marshNodeCompleted: false,
  bridgeNodeCompleted: false,
  watchtowerNodeCompleted: false,
  hollowKeepCompleted: false,
  endingSeen: false,
  introSeen: false,
  tutorialCompleted: false,
  tutorialSteps: {},
  gold: 0,
  materials: 0,
  heroLevels: {
    "hero-warrior": 1,
    "hero-mage": 1,
    "hero-ranger": 1,
    "hero-priest": 1,
  },
  buildingLevels: {
    mine: 1,
    training: 1,
    workshop: 1,
  },
  musicVolume: 0.35,
  sfxVolume: 0.55,
  musicMuted: false,
  sfxMuted: false,
  memoryWipes: 0,
};

type LegacySave = Partial<SaveData> & {
  version?: number;
};

function clampLevel(n: unknown, max: number): number {
  const v = typeof n === "number" && Number.isFinite(n) ? Math.floor(n) : 1;
  return Math.max(1, Math.min(max, v));
}

function clampNonNeg(n: unknown): number {
  const v = typeof n === "number" && Number.isFinite(n) ? Math.floor(n) : 0;
  return Math.max(0, v);
}

/** Migrate older saves into current version without destroying progress. */
export function migrateSave(raw: LegacySave | null | undefined): SaveData {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_SAVE };

  const merged: SaveData = {
    ...DEFAULT_SAVE,
    firstBattleCompleted: Boolean(raw.firstBattleCompleted),
    firstNodeUnlocked: raw.firstNodeUnlocked !== false,
    firstNodeCompleted: Boolean(raw.firstNodeCompleted),
    forestNodeCompleted: Boolean(raw.forestNodeCompleted),
    quarryNodeCompleted: Boolean(raw.quarryNodeCompleted),
    caveNodeCompleted: Boolean(raw.caveNodeCompleted),
    fortressNodeCompleted: Boolean(raw.fortressNodeCompleted),
    bossDefeated: Boolean(raw.bossDefeated ?? raw.fortressNodeCompleted),
    chapter2Unlocked: Boolean(raw.chapter2Unlocked ?? raw.fortressNodeCompleted),
    marshNodeCompleted: Boolean(raw.marshNodeCompleted),
    bridgeNodeCompleted: Boolean(raw.bridgeNodeCompleted),
    watchtowerNodeCompleted: Boolean(raw.watchtowerNodeCompleted),
    hollowKeepCompleted: Boolean(raw.hollowKeepCompleted),
    endingSeen: Boolean(raw.endingSeen),
    introSeen: Boolean(raw.introSeen),
    tutorialCompleted: Boolean(raw.tutorialCompleted),
    tutorialSteps:
      raw.tutorialSteps && typeof raw.tutorialSteps === "object"
        ? { ...raw.tutorialSteps }
        : {},
    gold: clampNonNeg(raw.gold),
    materials: clampNonNeg(raw.materials),
    heroLevels: {
      "hero-warrior": clampLevel(raw.heroLevels?.["hero-warrior"], 3),
      "hero-mage": clampLevel(raw.heroLevels?.["hero-mage"], 3),
      "hero-ranger": clampLevel(raw.heroLevels?.["hero-ranger"], 3),
      "hero-priest": clampLevel(raw.heroLevels?.["hero-priest"], 3),
    },
    buildingLevels: {
      mine: clampLevel(raw.buildingLevels?.mine, 2),
      training: clampLevel(raw.buildingLevels?.training, 2),
      workshop: clampLevel(raw.buildingLevels?.workshop, 2),
    },
    musicVolume:
      typeof raw.musicVolume === "number" ? raw.musicVolume : DEFAULT_SAVE.musicVolume,
    sfxVolume:
      typeof raw.sfxVolume === "number" ? raw.sfxVolume : DEFAULT_SAVE.sfxVolume,
    musicMuted: Boolean(raw.musicMuted),
    sfxMuted: Boolean(raw.sfxMuted),
    memoryWipes: clampNonNeg(raw.memoryWipes),
    version: SAVE_VERSION,
  };

  return merged;
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) {
      return {
        ...DEFAULT_SAVE,
        heroLevels: { ...DEFAULT_SAVE.heroLevels },
        buildingLevels: { ...DEFAULT_SAVE.buildingLevels },
        tutorialSteps: {},
      };
    }
    const parsed = JSON.parse(raw) as LegacySave;
    const migrated = migrateSave(parsed);
    if (parsed.version !== SAVE_VERSION) {
      writeSave(migrated);
    }
    return migrated;
  } catch {
    return {
      ...DEFAULT_SAVE,
      heroLevels: { ...DEFAULT_SAVE.heroLevels },
      buildingLevels: { ...DEFAULT_SAVE.buildingLevels },
      tutorialSteps: {},
    };
  }
}

export function writeSave(data: SaveData): void {
  localStorage.setItem(SAVE_KEY, JSON.stringify({ ...data, version: SAVE_VERSION }));
}

export function updateSave(patch: Partial<SaveData>): SaveData {
  const current = loadSave();
  const next: SaveData = {
    ...current,
    ...patch,
    version: SAVE_VERSION,
    heroLevels: patch.heroLevels
      ? { ...current.heroLevels, ...patch.heroLevels }
      : current.heroLevels,
    buildingLevels: patch.buildingLevels
      ? { ...current.buildingLevels, ...patch.buildingLevels }
      : current.buildingLevels,
    tutorialSteps: patch.tutorialSteps
      ? { ...current.tutorialSteps, ...patch.tutorialSteps }
      : current.tutorialSteps,
  };
  writeSave(next);
  return next;
}

/** Full reset. Pass `memoryWipe: true` after Hollow Keep to keep / bump loop difficulty. */
export function resetSave(opts?: { memoryWipe?: boolean }): SaveData {
  const prev = loadSave();
  const memoryWipes = Math.min(
    99,
    clampNonNeg(prev.memoryWipes) + (opts?.memoryWipe ? 1 : 0),
  );
  const fresh: SaveData = {
    ...DEFAULT_SAVE,
    heroLevels: { ...DEFAULT_SAVE.heroLevels },
    buildingLevels: { ...DEFAULT_SAVE.buildingLevels },
    tutorialSteps: {},
    memoryWipes,
    // Keep audio prefs across wipes / manual resets
    musicVolume: prev.musicVolume,
    sfxVolume: prev.sfxVolume,
    musicMuted: prev.musicMuted,
    sfxMuted: prev.sfxMuted,
  };
  writeSave(fresh);
  return fresh;
}

export function validateSave(data: unknown): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!data || typeof data !== "object") {
    return { ok: false, errors: ["not_an_object"] };
  }
  const d = data as Partial<SaveData>;
  if (typeof d.gold !== "number" || d.gold < 0) errors.push("gold");
  if (typeof d.materials !== "number" || d.materials < 0) errors.push("materials");
  if (!d.heroLevels) errors.push("heroLevels");
  if (!d.buildingLevels) errors.push("buildingLevels");
  return { ok: errors.length === 0, errors };
}

export function serializeAudioSettings(data: SaveData): string {
  return JSON.stringify({
    musicVolume: data.musicVolume,
    sfxVolume: data.sfxVolume,
    musicMuted: data.musicMuted,
    sfxMuted: data.sfxMuted,
  });
}

export function parseAudioSettings(json: string): Partial<SaveData> {
  const o = JSON.parse(json) as Partial<SaveData>;
  return {
    musicVolume: o.musicVolume,
    sfxVolume: o.sfxVolume,
    musicMuted: o.musicMuted,
    sfxMuted: o.sfxMuted,
  };
}

/** Apply encounter completion flags and grant rewards. */
export function applyVictoryProgress(
  encounterId: string,
  gold: number,
  materials: number,
): SaveData {
  const save = loadSave();
  const patch: Partial<SaveData> = {
    gold: save.gold + gold,
    materials: save.materials + materials,
    firstBattleCompleted: true,
  };
  switch (encounterId) {
    case "ruins":
      patch.firstNodeCompleted = true;
      break;
    case "forest":
      patch.forestNodeCompleted = true;
      break;
    case "quarry":
      patch.quarryNodeCompleted = true;
      break;
    case "cave":
      patch.caveNodeCompleted = true;
      break;
    case "fortress":
      patch.fortressNodeCompleted = true;
      patch.bossDefeated = true;
      patch.chapter2Unlocked = true;
      break;
    case "marsh":
      patch.marshNodeCompleted = true;
      break;
    case "bridge":
      patch.bridgeNodeCompleted = true;
      break;
    case "watchtower":
      patch.watchtowerNodeCompleted = true;
      break;
    default:
      break;
  }
  return updateSave(patch);
}

/** Grant gold/materials without completing map nodes (defeat salvage). */
export function applySalvageRewards(gold: number, materials: number): SaveData {
  const save = loadSave();
  return updateSave({
    gold: save.gold + gold,
    materials: save.materials + materials,
  });
}
