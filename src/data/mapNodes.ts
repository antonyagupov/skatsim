import type { SaveData } from "../data/save";
import { rewardPreview } from "../systems/economy/rewards";
import type { ElementId } from "../systems/combat/elements";
import {
  DESKTOP_MAP_LAYOUT,
  MOBILE_MAP_LAYOUT,
  getMapNodeLayout,
} from "./mapLayout";

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

function layoutCoords(id: string): {
  x: number;
  y: number;
  xMobile: number;
  yMobile: number;
} {
  const d = DESKTOP_MAP_LAYOUT.find((l) => l.id === id)!;
  const m = MOBILE_MAP_LAYOUT.find((l) => l.id === id)!;
  return { x: d.x, y: d.y, xMobile: m.x, yMobile: m.y };
}

/** Chapter 1 world graph — five sequential battles + Village hub + Chapter 2. */
export const MAP_NODES: MapNodeDef[] = [
  {
    id: "village",
    label: "Village",
    kind: "village",
    ...layoutCoords("village"),
    sceneKey: "Village",
    alwaysUnlocked: true,
    color: 0xc8a060,
  },
  {
    id: "ruins-path",
    label: "Ruins Path",
    kind: "battle",
    ...layoutCoords("ruins-path"),
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
    ...layoutCoords("forest-trail"),
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
    ...layoutCoords("old-quarry"),
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
    ...layoutCoords("dark-cave"),
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
    ...layoutCoords("goblin-fortress"),
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
    ...layoutCoords("marsh-crossing"),
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
    ...layoutCoords("ruined-bridge"),
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
    ...layoutCoords("watchtower"),
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
    ...layoutCoords("hollow-keep"),
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
  const layout = getMapNodeLayout(node.id, mobile);
  if (layout) return { x: layout.x, y: layout.y };
  if (mobile) {
    return {
      x: node.xMobile ?? node.x,
      y: node.yMobile ?? node.y,
    };
  }
  return { x: node.x, y: node.y };
}

/** Desktop landscape: Ch2 branches from Village. */
export const MAP_EDGES_DESKTOP: Array<[string, string]> = [
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

/** Mobile serpentine: Ch2 continues from Fortress. */
export const MAP_EDGES_MOBILE: Array<[string, string]> = [
  ["village", "ruins-path"],
  ["ruins-path", "forest-trail"],
  ["forest-trail", "old-quarry"],
  ["old-quarry", "dark-cave"],
  ["dark-cave", "goblin-fortress"],
  ["goblin-fortress", "marsh-crossing"],
  ["marsh-crossing", "ruined-bridge"],
  ["ruined-bridge", "watchtower"],
  ["watchtower", "hollow-keep"],
];

export function mapEdges(mobile: boolean): Array<[string, string]> {
  return mobile ? MAP_EDGES_MOBILE : MAP_EDGES_DESKTOP;
}

/** @deprecated Prefer mapEdges(mobile). Defaults to desktop topology. */
export const MAP_EDGES = MAP_EDGES_DESKTOP;

export function isNodeUnlocked(node: MapNodeDef, save: SaveData): boolean {
  if (node.alwaysUnlocked) return true;
  if (!node.requires || node.requires.length === 0) return true;
  return node.requires.every((k) => Boolean(save[k]));
}

export function isNodeCompleted(node: MapNodeDef, save: SaveData): boolean {
  if (!node.completedFlag) return false;
  return Boolean(save[node.completedFlag]);
}

/** Village hub counts as visited for path coloring. */
export function isNodeVisited(node: MapNodeDef, save: SaveData): boolean {
  if (node.kind === "village") return true;
  return isNodeCompleted(node, save);
}

export function nodeRewardPreview(node: MapNodeDef) {
  if (!node.encounterId) return null;
  return rewardPreview(node.encounterId);
}

/** Layout constants for battle composition — re-exported from layoutProfile. */
export { DESKTOP_BATTLE_LAYOUT as BATTLE_LAYOUT } from "../ui/layoutProfile";
export type { BattleLayoutConfig } from "../ui/layoutProfile";
