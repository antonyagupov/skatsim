import type { EnemyId } from "../../assets/types";
import type { ElementId } from "./elements";

export type EnemyAttackPattern = "single_lowest" | "single_random" | "cleaver" | "war_cry";

export type EnemyDef = {
  /** Texture / catalog id */
  typeId: EnemyId | "enemy-armored-goblin" | "enemy-wraith";
  name: string;
  maxHp: number;
  attack: number;
  element: ElementId;
  countdownMax: number;
  targetRule: "lowest_hp_pct" | "random";
  /** Flat damage reduction until broken (armor HP pool). */
  armor?: number;
  isBoss?: boolean;
  patterns?: EnemyAttackPattern[];
};

export type StatusId = "burn" | "freeze";

export type EnemyStatus = {
  id: StatusId;
  turns: number;
  /** Burn: damage per tick */
  potency?: number;
};

export type EnemyRuntime = {
  /** Unique instance id for targeting */
  id: string;
  typeId: EnemyId | "enemy-armored-goblin" | "enemy-wraith";
  name: string;
  hp: number;
  maxHp: number;
  attack: number;
  alive: boolean;
  element: ElementId;
  countdown: number;
  countdownMax: number;
  targetRule: "lowest_hp_pct" | "random";
  armor: number;
  maxArmor: number;
  isBoss: boolean;
  patterns: EnemyAttackPattern[];
  /** Boss phase index (0 = normal, 1 = enraged) */
  phase: number;
  /** Temporary damage bonus from War Cry */
  nextAttackBonus: number;
  /** Texture key for Phaser */
  textureKey: string;
  statuses: EnemyStatus[];
};

let instanceCounter = 0;

export function resetEnemyInstanceCounter(): void {
  instanceCounter = 0;
}

function makeRuntime(def: EnemyDef, suffix?: string): EnemyRuntime {
  instanceCounter += 1;
  const id =
    suffix ??
    `${def.typeId}-${instanceCounter}`;
  const textureKey =
    def.typeId === "enemy-armored-goblin"
      ? "boss-goblin"
      : def.typeId === "enemy-wraith"
        ? "enemy-wraith"
        : def.typeId;
  return {
    id,
    typeId: def.typeId,
    name: def.name,
    hp: def.maxHp,
    maxHp: def.maxHp,
    attack: def.attack,
    alive: true,
    element: def.element,
    countdown: def.countdownMax,
    countdownMax: def.countdownMax,
    targetRule: def.targetRule,
    armor: def.armor ?? 0,
    maxArmor: def.armor ?? 0,
    isBoss: Boolean(def.isBoss),
    patterns: def.patterns ?? ["single_lowest"],
    phase: 0,
    nextAttackBonus: 0,
    textureKey,
    statuses: [],
  };
}

export function previewEnemyPattern(enemy: EnemyRuntime): EnemyAttackPattern {
  if (!enemy.isBoss || enemy.patterns.length < 2) {
    return enemy.patterns[0] ?? "single_lowest";
  }
  const useWarCry = enemy.hp % 2 === 0 || enemy.phase >= 1;
  return useWarCry && enemy.patterns.includes("war_cry")
    ? "war_cry"
    : "cleaver";
}

export function applyStatus(
  enemy: EnemyRuntime,
  status: EnemyStatus,
): EnemyRuntime {
  const statuses = enemy.statuses.filter((s) => s.id !== status.id);
  statuses.push(status);
  return { ...enemy, statuses };
}

export function tickStatuses(
  enemy: EnemyRuntime,
): { enemy: EnemyRuntime; burnDamage: number; freezeBlocksAttack: boolean } {
  let burnDamage = 0;
  let freezeBlocksAttack = false;
  const next: EnemyStatus[] = [];
  for (const s of enemy.statuses) {
    if (s.id === "burn" && s.potency) burnDamage += s.potency;
    if (s.id === "freeze") freezeBlocksAttack = true;
    const turns = s.turns - 1;
    if (turns > 0) next.push({ ...s, turns });
  }
  return {
    enemy: { ...enemy, statuses: next },
    burnDamage,
    freezeBlocksAttack,
  };
}

export const SLIME: EnemyDef = {
  typeId: "enemy-slime",
  name: "Slime",
  maxHp: 150,
  attack: 10,
  element: "green",
  countdownMax: 2,
  targetRule: "lowest_hp_pct",
};

export const BAT: EnemyDef = {
  typeId: "enemy-bat",
  name: "Bat",
  maxHp: 120,
  attack: 8,
  element: "blue",
  countdownMax: 1,
  targetRule: "random",
};

export const FOREST_SLIME: EnemyDef = {
  ...SLIME,
  name: "Forest Slime",
  maxHp: 210,
  attack: 13,
  element: "green",
};

export const SHADOW_BAT: EnemyDef = {
  ...BAT,
  name: "Shadow Bat",
  maxHp: 160,
  attack: 11,
  element: "blue",
};

export const ARMORED_GOBLIN: EnemyDef = {
  typeId: "enemy-armored-goblin",
  name: "Armored Goblin",
  maxHp: 320,
  attack: 21,
  element: "red",
  countdownMax: 3,
  targetRule: "lowest_hp_pct",
  armor: 100,
};

export const CAVE_SLIME: EnemyDef = {
  ...SLIME,
  name: "Cave Slime",
  maxHp: 230,
  attack: 14,
  element: "green",
};

export const GOBLIN_CHIEFTAIN: EnemyDef = {
  typeId: "boss-goblin",
  name: "Goblin Chieftain",
  maxHp: 900,
  attack: 29,
  element: "green",
  countdownMax: 2,
  targetRule: "lowest_hp_pct",
  isBoss: true,
  patterns: ["cleaver", "war_cry"],
};

export const WRAITH: EnemyDef = {
  typeId: "enemy-wraith",
  name: "Wraith",
  maxHp: 320,
  attack: 18,
  element: "yellow",
  countdownMax: 2,
  targetRule: "lowest_hp_pct",
};

export const MARSH_SLIME: EnemyDef = {
  ...SLIME,
  name: "Marsh Slime",
  maxHp: 300,
  attack: 16,
  element: "green",
};

export function createEnemiesFromDefs(defs: EnemyDef[]): EnemyRuntime[] {
  resetEnemyInstanceCounter();
  return defs.map((d) => makeRuntime(d));
}

/** +15% enemy HP/ATK/armor per completed memory wipe (capped). */
export function loopDifficultyMultiplier(memoryWipes: number): number {
  const w = Math.max(0, Math.min(20, Math.floor(memoryWipes)));
  return 1 + w * 0.15;
}

export function scaleEnemyDef(def: EnemyDef, mult: number): EnemyDef {
  if (mult <= 1) return def;
  return {
    ...def,
    maxHp: Math.max(1, Math.round(def.maxHp * mult)),
    attack: Math.max(1, Math.round(def.attack * mult)),
    armor: def.armor != null ? Math.max(0, Math.round(def.armor * mult)) : def.armor,
  };
}

export function createEncounterEnemies(
  encounterId?: string,
  memoryWipes = 0,
): EnemyRuntime[] {
  const mult = loopDifficultyMultiplier(memoryWipes);
  const scale = (defs: EnemyDef[]) =>
    createEnemiesFromDefs(defs.map((d) => scaleEnemyDef(d, mult)));

  switch (encounterId) {
    case "forest":
      return scale([FOREST_SLIME, SHADOW_BAT]);
    case "quarry":
      return scale([ARMORED_GOBLIN, BAT]);
    case "cave":
      return scale([SHADOW_BAT, CAVE_SLIME]);
    case "fortress":
      return scale([GOBLIN_CHIEFTAIN]);
    case "marsh":
      return scale([MARSH_SLIME, WRAITH]);
    case "bridge":
      return scale([WRAITH, SHADOW_BAT]);
    case "watchtower":
      return scale([WRAITH, ARMORED_GOBLIN, BAT]);
    case "ruins":
    default:
      return scale([SLIME, BAT]);
  }
}

export function createFirstBattleEnemies(): EnemyRuntime[] {
  return createEncounterEnemies("ruins");
}

/** Spawn a small bat (boss phase summon). */
export function spawnBatAlly(): EnemyRuntime {
  return makeRuntime(BAT, `enemy-bat-summon-${instanceCounter + 1}`);
}
