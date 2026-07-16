import type { EnemyId } from "../../assets/types";
import type { ElementId } from "./elements";

export type EnemyAttackPattern = "single_lowest" | "single_random" | "cleaver" | "war_cry";

export type EnemyDef = {
  /** Texture / catalog id */
  typeId: EnemyId | "enemy-armored-goblin";
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

export type EnemyRuntime = {
  /** Unique instance id for targeting */
  id: string;
  typeId: EnemyId | "enemy-armored-goblin";
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
    def.typeId === "enemy-armored-goblin" ? "boss-goblin" : def.typeId;
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
  };
}

export const SLIME: EnemyDef = {
  typeId: "enemy-slime",
  name: "Slime",
  maxHp: 85,
  attack: 12,
  element: "green",
  countdownMax: 2,
  targetRule: "lowest_hp_pct",
};

export const BAT: EnemyDef = {
  typeId: "enemy-bat",
  name: "Bat",
  maxHp: 65,
  attack: 10,
  element: "blue",
  countdownMax: 1,
  targetRule: "random",
};

export const FOREST_SLIME: EnemyDef = {
  ...SLIME,
  name: "Forest Slime",
  maxHp: 110,
  attack: 14,
  element: "green",
};

export const SHADOW_BAT: EnemyDef = {
  ...BAT,
  name: "Shadow Bat",
  maxHp: 85,
  attack: 12,
  element: "blue",
};

export const ARMORED_GOBLIN: EnemyDef = {
  typeId: "enemy-armored-goblin",
  name: "Armored Goblin",
  maxHp: 170,
  attack: 22,
  element: "red",
  countdownMax: 3,
  targetRule: "lowest_hp_pct",
  armor: 50,
};

export const CAVE_SLIME: EnemyDef = {
  ...SLIME,
  name: "Cave Slime",
  maxHp: 135,
  attack: 17,
  element: "green",
};

export const GOBLIN_CHIEFTAIN: EnemyDef = {
  typeId: "boss-goblin",
  name: "Goblin Chieftain",
  maxHp: 380,
  attack: 26,
  element: "green",
  countdownMax: 2,
  targetRule: "lowest_hp_pct",
  isBoss: true,
  patterns: ["cleaver", "war_cry"],
};

export function createEnemiesFromDefs(defs: EnemyDef[]): EnemyRuntime[] {
  resetEnemyInstanceCounter();
  return defs.map((d) => makeRuntime(d));
}

export function createEncounterEnemies(encounterId?: string): EnemyRuntime[] {
  switch (encounterId) {
    case "forest":
      return createEnemiesFromDefs([FOREST_SLIME, SHADOW_BAT]);
    case "quarry":
      return createEnemiesFromDefs([ARMORED_GOBLIN, BAT]);
    case "cave":
      return createEnemiesFromDefs([SHADOW_BAT, CAVE_SLIME, BAT]);
    case "fortress":
      return createEnemiesFromDefs([GOBLIN_CHIEFTAIN]);
    case "ruins":
    default:
      return createEnemiesFromDefs([SLIME, BAT]);
  }
}

export function createFirstBattleEnemies(): EnemyRuntime[] {
  return createEncounterEnemies("ruins");
}

/** Spawn a small bat (boss phase summon). */
export function spawnBatAlly(): EnemyRuntime {
  return makeRuntime(BAT, `enemy-bat-summon-${instanceCounter + 1}`);
}
