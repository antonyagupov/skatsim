import type { SaveData } from "../data/save";
import { rewardPreview } from "../systems/economy/rewards";
import type { ElementId } from "../systems/combat/elements";

export type MapNodeKind = "battle" | "village" | "hub";

export type MapNodeDef = {
  id: string;
  label: string;
  kind: MapNodeKind;
  x: number;
  y: number;
  sceneKey?: "Battle" | "Village";
  encounterId?: string;
  requires?: Array<keyof SaveData>;
  alwaysUnlocked?: boolean;
  color: number;
  completedFlag?: keyof SaveData;
  isBoss?: boolean;
  enemyPreview?: string[];
  elementPreview?: ElementId[];
};

/** Chapter 1 world graph — five sequential battles + Village hub. */
export const MAP_NODES: MapNodeDef[] = [
  {
    id: "village",
    label: "Village",
    kind: "village",
    x: 0.18,
    y: 0.48,
    sceneKey: "Village",
    alwaysUnlocked: true,
    color: 0xc8a060,
  },
  {
    id: "ruins-path",
    label: "Ruins Path",
    kind: "battle",
    x: 0.34,
    y: 0.62,
    sceneKey: "Battle",
    encounterId: "ruins",
    alwaysUnlocked: true,
    color: 0xd06a2e,
    completedFlag: "firstNodeCompleted",
    enemyPreview: ["Slime", "Bat"],
    elementPreview: ["green", "blue"],
  },
  {
    id: "forest-trail",
    label: "Forest Trail",
    kind: "battle",
    x: 0.48,
    y: 0.42,
    sceneKey: "Battle",
    encounterId: "forest",
    requires: ["firstNodeCompleted"],
    color: 0x4a9c5a,
    completedFlag: "forestNodeCompleted",
    enemyPreview: ["Forest Slime", "Shadow Bat"],
    elementPreview: ["green", "blue"],
  },
  {
    id: "old-quarry",
    label: "Old Quarry",
    kind: "battle",
    x: 0.62,
    y: 0.58,
    sceneKey: "Battle",
    encounterId: "quarry",
    requires: ["forestNodeCompleted"],
    color: 0x8a7a5a,
    completedFlag: "quarryNodeCompleted",
    enemyPreview: ["Armored Goblin", "Bat"],
    elementPreview: ["red", "blue"],
  },
  {
    id: "dark-cave",
    label: "Dark Cave",
    kind: "battle",
    x: 0.74,
    y: 0.38,
    sceneKey: "Battle",
    encounterId: "cave",
    requires: ["quarryNodeCompleted"],
    color: 0x5a4a6a,
    completedFlag: "caveNodeCompleted",
    enemyPreview: ["Shadow Bat", "Cave Slime"],
    elementPreview: ["blue", "green"],
  },
  {
    id: "goblin-fortress",
    label: "Goblin Fortress",
    kind: "battle",
    x: 0.86,
    y: 0.55,
    sceneKey: "Battle",
    encounterId: "fortress",
    requires: ["caveNodeCompleted"],
    color: 0xa04030,
    completedFlag: "fortressNodeCompleted",
    isBoss: true,
    enemyPreview: ["Goblin Chieftain"],
    elementPreview: ["green"],
  },
];

export const MAP_EDGES: Array<[string, string]> = [
  ["village", "ruins-path"],
  ["ruins-path", "forest-trail"],
  ["forest-trail", "old-quarry"],
  ["old-quarry", "dark-cave"],
  ["dark-cave", "goblin-fortress"],
];

export function isNodeUnlocked(node: MapNodeDef, save: SaveData): boolean {
  if (node.alwaysUnlocked) return true;
  if (!node.requires || node.requires.length === 0) return true;
  return node.requires.every((k) => Boolean(save[k]));
}

export function isNodeCompleted(node: MapNodeDef, save: SaveData): boolean {
  if (!node.completedFlag) return false;
  return Boolean(save[node.completedFlag]);
}

export function nodeRewardPreview(node: MapNodeDef) {
  if (!node.encounterId) return null;
  return rewardPreview(node.encounterId);
}

/** Layout constants for battle composition — party LEFT, enemies RIGHT. */
export const BATTLE_LAYOUT = {
  partySide: "left" as const,
  enemySide: "right" as const,
  /** Party center X as fraction of width */
  partyX: 0.14,
  /** Enemy center X as fraction of width */
  enemyX: 0.82,
  /** Upper battlefield fraction of height */
  fieldFraction: 0.52,
  /** Cap match-3 cell size so the board does not dominate */
  maxGemCell: 40,
};
