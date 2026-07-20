import type { SaveData } from "../data/save";
import { rewardPreview } from "../systems/economy/rewards";
import type { ElementId } from "../systems/combat/elements";

export type MapNodeKind = "battle" | "village" | "hub" | "ending";

export type MapNodeDef = {
  id: string;
  label: string;
  kind: MapNodeKind;
  x: number;
  y: number;
  /** Portrait map fractions (vertical path). Falls back to x/y when omitted. */
  xMobile?: number;
  yMobile?: number;
  sceneKey?: "Battle" | "Village" | "Ending";
  encounterId?: string;
  requires?: Array<keyof SaveData>;
  alwaysUnlocked?: boolean;
  color: number;
  completedFlag?: keyof SaveData;
  isBoss?: boolean;
  enemyPreview?: string[];
  elementPreview?: ElementId[];
  /** Optional objective blurb for map preview (e.g. Survive 6 turns). */
  objectivePreview?: string;
};

/** Chapter 1 world graph — five sequential battles + Village hub. */
export const MAP_NODES: MapNodeDef[] = [
  {
    id: "village",
    label: "Village",
    kind: "village",
    x: 0.18,
    y: 0.48,
    xMobile: 0.5,
    yMobile: 0.16,
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
    xMobile: 0.42,
    yMobile: 0.24,
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
    xMobile: 0.58,
    yMobile: 0.36,
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
    xMobile: 0.4,
    yMobile: 0.48,
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
    xMobile: 0.6,
    yMobile: 0.6,
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
    xMobile: 0.72,
    yMobile: 0.74,
    sceneKey: "Battle",
    encounterId: "fortress",
    requires: ["caveNodeCompleted"],
    color: 0xa04030,
    completedFlag: "fortressNodeCompleted",
    isBoss: true,
    enemyPreview: ["Goblin Chieftain"],
    elementPreview: ["green"],
  },
  {
    id: "marsh-crossing",
    label: "Marsh Crossing",
    kind: "battle",
    x: 0.28,
    y: 0.28,
    xMobile: 0.22,
    yMobile: 0.28,
    sceneKey: "Battle",
    encounterId: "marsh",
    requires: ["chapter2Unlocked"],
    color: 0x3a7a6a,
    completedFlag: "marshNodeCompleted",
    enemyPreview: ["Marsh Slime", "Wraith"],
    elementPreview: ["green", "yellow"],
  },
  {
    id: "ruined-bridge",
    label: "Ruined Bridge",
    kind: "battle",
    x: 0.44,
    y: 0.22,
    xMobile: 0.2,
    yMobile: 0.42,
    sceneKey: "Battle",
    encounterId: "bridge",
    requires: ["marshNodeCompleted"],
    color: 0x6a6a8a,
    completedFlag: "bridgeNodeCompleted",
    enemyPreview: ["Wraith", "Shadow Bat"],
    elementPreview: ["yellow", "blue"],
  },
  {
    id: "watchtower",
    label: "Watchtower",
    kind: "battle",
    x: 0.6,
    y: 0.18,
    xMobile: 0.28,
    yMobile: 0.55,
    sceneKey: "Battle",
    encounterId: "watchtower",
    requires: ["bridgeNodeCompleted"],
    color: 0x8a5060,
    completedFlag: "watchtowerNodeCompleted",
    enemyPreview: ["Wraith", "Armored Goblin"],
    elementPreview: ["yellow", "red"],
    objectivePreview: "Survive 6 turns",
  },
  {
    id: "hollow-keep",
    label: "Hollow Keep",
    kind: "ending",
    x: 0.76,
    y: 0.14,
    xMobile: 0.78,
    yMobile: 0.82,
    sceneKey: "Ending",
    requires: ["watchtowerNodeCompleted"],
    color: 0x4060a0,
    completedFlag: "hollowKeepCompleted",
    isBoss: true,
    enemyPreview: ["…?"],
  },
];

export function nodeMapPos(
  node: MapNodeDef,
  mobile: boolean,
): { x: number; y: number } {
  if (mobile) {
    return {
      x: node.xMobile ?? node.x,
      y: node.yMobile ?? node.y,
    };
  }
  return { x: node.x, y: node.y };
}
export const MAP_EDGES: Array<[string, string]> = [
  ["village", "ruins-path"],
  ["ruins-path", "forest-trail"],
  ["forest-trail", "old-quarry"],
  ["old-quarry", "dark-cave"],
  ["dark-cave", "goblin-fortress"],
  ["village", "marsh-crossing"],
  ["marsh-crossing", "ruined-bridge"],
  ["ruined-bridge", "watchtower"],
  ["watchtower", "hollow-keep"],
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

/** Layout constants for battle composition — re-exported from layoutProfile. */
export { DESKTOP_BATTLE_LAYOUT as BATTLE_LAYOUT } from "../ui/layoutProfile";
export type { BattleLayoutConfig } from "../ui/layoutProfile";
