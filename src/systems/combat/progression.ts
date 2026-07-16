import type { HeroId } from "../../assets/types";
import { HERO_DEFS, type HeroDef } from "./heroes";

export const MAX_HERO_LEVEL = 3;

/** Transparent level scaling: +12% HP / damage / ability strength per level above 1. */
export function heroLevelMultiplier(level: number): number {
  const lv = Math.max(1, Math.min(MAX_HERO_LEVEL, level));
  return 1 + (lv - 1) * 0.12;
}

export function scaledHeroStats(
  heroId: HeroId,
  level: number,
): Pick<HeroDef, "maxHp" | "baseDamage"> & { abilityStrength: number } {
  const def = HERO_DEFS[heroId];
  const m = heroLevelMultiplier(level);
  return {
    maxHp: Math.round(def.maxHp * m),
    baseDamage: Math.round(def.baseDamage * m),
    abilityStrength: m,
  };
}

export function heroUpgradeCost(currentLevel: number): number {
  if (currentLevel >= MAX_HERO_LEVEL) return 0;
  if (currentLevel === 1) return 50;
  return 90;
}

export type BuildingId = "mine" | "training" | "workshop";

export const MAX_BUILDING_LEVEL = 2;

export function buildingUpgradeCost(buildingId: BuildingId, currentLevel: number): {
  gold: number;
  materials: number;
} {
  if (currentLevel >= MAX_BUILDING_LEVEL) return { gold: 0, materials: 0 };
  if (buildingId === "mine") return { gold: 80, materials: 2 };
  if (buildingId === "training") return { gold: 60, materials: 1 };
  return { gold: 70, materials: 2 };
}

/** Mine level 2 grants +20% gold from battles. */
export function goldRewardMultiplier(mineLevel: number): number {
  return mineLevel >= 2 ? 1.2 : 1;
}

/** Workshop potion heal fraction of max HP. */
export function potionHealFraction(workshopLevel: number): number {
  return workshopLevel >= 2 ? 0.45 : 0.3;
}
