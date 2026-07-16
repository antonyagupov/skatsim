export const HERO_IDS = [
  "hero-warrior",
  "hero-mage",
  "hero-ranger",
  "hero-priest",
] as const;

export const ENEMY_IDS = ["enemy-slime", "enemy-bat"] as const;
export const BOSS_ID = "boss-goblin";
export const GEM_IDS = ["gem-flame", "gem-ice", "gem-leaf", "gem-light"] as const;
/** Special power gem created by matches of five. */
export const SPECIAL_GEM_ID = "gem-prismatic" as const;

export type HeroId = (typeof HERO_IDS)[number];
export type EnemyId = (typeof ENEMY_IDS)[number] | typeof BOSS_ID;
export type GemId = (typeof GEM_IDS)[number];
export type SpecialGemId = typeof SPECIAL_GEM_ID;
export type BoardGemId = GemId | SpecialGemId;

export type AssetSource = "generated" | "procedural";
export type ManifestEntry = { source: AssetSource; path: string };
export type AssetManifest = Record<string, ManifestEntry>;

export const GEM_TO_HERO: Record<GemId, HeroId> = {
  "gem-flame": "hero-warrior",
  "gem-ice": "hero-mage",
  "gem-leaf": "hero-ranger",
  "gem-light": "hero-priest",
};

export const HERO_TO_GEM: Record<HeroId, GemId> = {
  "hero-warrior": "gem-flame",
  "hero-mage": "gem-ice",
  "hero-ranger": "gem-leaf",
  "hero-priest": "gem-light",
};
