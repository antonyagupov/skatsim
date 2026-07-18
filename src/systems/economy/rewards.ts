import type { BuildingId } from "../combat/progression";
import { goldRewardMultiplier } from "../combat/progression";

export type EncounterReward = {
  gold: number;
  materials: number;
};

export const ENCOUNTER_REWARDS: Record<string, EncounterReward> = {
  ruins: { gold: 40, materials: 1 },
  forest: { gold: 60, materials: 1 },
  quarry: { gold: 80, materials: 2 },
  cave: { gold: 120, materials: 3 },
  fortress: { gold: 160, materials: 4 },
  marsh: { gold: 120, materials: 3 },
  bridge: { gold: 140, materials: 3 },
  watchtower: { gold: 180, materials: 5 },
};

export function computeBattleRewards(
  encounterId: string,
  mineLevel: number,
): EncounterReward {
  const base = ENCOUNTER_REWARDS[encounterId] ?? { gold: 40, materials: 1 };
  const gold = Math.round(base.gold * goldRewardMultiplier(mineLevel));
  return { gold, materials: base.materials };
}

export function computeDefeatRewards(
  encounterId: string,
  mineLevel: number,
): EncounterReward {
  const win = computeBattleRewards(encounterId, mineLevel);
  const gold = Math.max(win.gold >= 40 ? 1 : 0, Math.round(win.gold * 0.15));
  const materials = Math.max(0, Math.round(win.materials * 0.15));
  return { gold, materials };
}

export function rewardPreview(encounterId: string): EncounterReward {
  return ENCOUNTER_REWARDS[encounterId] ?? { gold: 40, materials: 1 };
}

export type FacilityLabel = {
  id: BuildingId;
  name: string;
  description: string;
};

export const FACILITIES: FacilityLabel[] = [
  {
    id: "mine",
    name: "Mine",
    description: "Boosts gold earned from battles.",
  },
  {
    id: "training",
    name: "Training Ground",
    description: "Upgrade hero levels and combat power.",
  },
  {
    id: "workshop",
    name: "Workshop",
    description: "Prepares a healing potion for each battle.",
  },
];
