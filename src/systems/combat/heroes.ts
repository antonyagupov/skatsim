import type { GemId, HeroId } from "../../assets/types";
import { GEM_TO_HERO, HERO_IDS } from "../../assets/types";
import { scaledHeroStats } from "./progression";

export type HeroDef = {
  id: HeroId;
  name: string;
  maxHp: number;
  baseDamage: number;
  abilityCost: number;
  abilityName: string;
  role: "attacker" | "aoe" | "precision" | "healer";
};

export const HERO_DEFS: Record<HeroId, HeroDef> = {
  "hero-warrior": {
    id: "hero-warrior",
    name: "Warrior",
    maxHp: 120,
    baseDamage: 12,
    abilityCost: 10,
    abilityName: "Flame Strike",
    role: "attacker",
  },
  "hero-mage": {
    id: "hero-mage",
    name: "Mage",
    maxHp: 80,
    baseDamage: 8,
    abilityCost: 12,
    abilityName: "Ice Nova",
    role: "aoe",
  },
  "hero-ranger": {
    id: "hero-ranger",
    name: "Ranger",
    maxHp: 95,
    baseDamage: 10,
    abilityCost: 10,
    abilityName: "Marked Shot",
    role: "precision",
  },
  "hero-priest": {
    id: "hero-priest",
    name: "Priest",
    maxHp: 85,
    baseDamage: 5,
    abilityCost: 12,
    abilityName: "Restoring Light",
    role: "healer",
  },
};

export type HeroRuntime = {
  id: HeroId;
  hp: number;
  maxHp: number;
  charge: number;
  abilityCost: number;
  alive: boolean;
  /** Temporary overheal shield from Priest excess healing */
  shield: number;
  level: number;
  baseDamage: number;
};

export function createParty(
  levels?: Partial<Record<HeroId, number>>,
): HeroRuntime[] {
  return HERO_IDS.map((id) => {
    const def = HERO_DEFS[id];
    const level = levels?.[id] ?? 1;
    const scaled = scaledHeroStats(id, level);
    return {
      id,
      hp: scaled.maxHp,
      maxHp: scaled.maxHp,
      charge: 0,
      abilityCost: def.abilityCost,
      alive: true,
      shield: 0,
      level,
      baseDamage: scaled.baseDamage,
    };
  });
}

export function heroForGem(gem: GemId): HeroId {
  return GEM_TO_HERO[gem];
}
