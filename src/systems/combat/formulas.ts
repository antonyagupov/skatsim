import type { GemId, HeroId } from "../../assets/types";
import { HERO_DEFS } from "./heroes";
import type { EnemyRuntime } from "./enemies";
import type { HeroRuntime } from "./heroes";
import { elementalModifier, elementForGem, type AffinityResult } from "./elements";
import { scaledHeroStats } from "./progression";

export function computeMatchDamage(
  _gem: GemId,
  weightedTiles: number,
  baseDamage: number,
  elementalMod = 1,
): number {
  return Math.max(1, Math.round(weightedTiles * baseDamage * elementalMod));
}

export function affinityForAttack(
  gem: GemId,
  enemy: EnemyRuntime,
): AffinityResult {
  return elementalModifier(elementForGem(gem), enemy.element);
}

export function abilityDamage(
  heroId: HeroId,
  baseHit: number,
  abilityStrength = 1,
): number {
  let mult = 1;
  if (heroId === "hero-warrior") mult = 2.2;
  else if (heroId === "hero-mage") mult = 1.15;
  else if (heroId === "hero-ranger") mult = 1.9;
  else mult = 0.6;
  return Math.round(baseHit * mult * abilityStrength);
}

export function abilityHealAmount(weightedYellow: number): number {
  return Math.max(8, Math.round(weightedYellow * 4 + 20));
}

export function applyDamageToEnemy(
  enemy: EnemyRuntime,
  amount: number,
): { enemy: EnemyRuntime; dealt: number; killed: boolean; armorBroken: boolean } {
  if (!enemy.alive) return { enemy, dealt: 0, killed: false, armorBroken: false };
  let remaining = amount;
  let armor = enemy.armor;
  let armorBroken = false;
  if (armor > 0) {
    const absorbed = Math.min(armor, remaining);
    armor -= absorbed;
    remaining -= absorbed;
    if (enemy.armor > 0 && armor === 0) armorBroken = true;
  }
  const dealt = Math.min(enemy.hp, remaining);
  const hp = enemy.hp - dealt;
  const killed = hp <= 0;
  return {
    enemy: { ...enemy, armor, hp: Math.max(0, hp), alive: !killed },
    dealt: amount - remaining + dealt,
    killed,
    armorBroken,
  };
}

export function applyDamageToHero(
  hero: HeroRuntime,
  amount: number,
): { hero: HeroRuntime; dealt: number; killed: boolean; shieldAbsorbed: number } {
  if (!hero.alive) return { hero, dealt: 0, killed: false, shieldAbsorbed: 0 };
  let remaining = amount;
  let shield = hero.shield;
  let shieldAbsorbed = 0;
  if (shield > 0) {
    shieldAbsorbed = Math.min(shield, remaining);
    shield -= shieldAbsorbed;
    remaining -= shieldAbsorbed;
  }
  const dealt = Math.min(hero.hp, remaining);
  const hp = hero.hp - dealt;
  const killed = hp <= 0;
  return {
    hero: {
      ...hero,
      shield,
      hp: Math.max(0, hp),
      alive: !killed,
    },
    dealt: shieldAbsorbed + dealt,
    killed,
    shieldAbsorbed,
  };
}

/** Heal living hero; excess becomes shield (capped at 30% max HP). */
export function healHero(hero: HeroRuntime, amount: number): HeroRuntime {
  if (!hero.alive) return hero;
  const room = hero.maxHp - hero.hp;
  const applied = Math.min(room, amount);
  const excess = amount - applied;
  const shieldCap = Math.round(hero.maxHp * 0.3);
  const shield = Math.min(shieldCap, hero.shield + excess);
  return { ...hero, hp: hero.hp + applied, shield };
}

export function addCharge(
  hero: HeroRuntime,
  tiles: number,
  bonus = 0,
): HeroRuntime {
  if (!hero.alive) return hero;
  return {
    ...hero,
    charge: Math.min(hero.abilityCost, hero.charge + tiles + bonus),
  };
}

export function canUseAbility(hero: HeroRuntime): boolean {
  return hero.alive && hero.charge >= hero.abilityCost;
}

export function spendAbility(hero: HeroRuntime): HeroRuntime {
  return { ...hero, charge: 0 };
}

export function matchChargeBonus(matchLength: number): number {
  if (matchLength >= 5) return 3;
  if (matchLength >= 4) return 1;
  return 0;
}

export function rangerExecuteMultiplier(enemy: EnemyRuntime): number {
  return enemy.hp / enemy.maxHp < 0.35 ? 1.5 : 1;
}

export function heroAbilityBase(
  hero: HeroRuntime,
): number {
  const strength = scaledHeroStats(hero.id, hero.level).abilityStrength;
  return hero.baseDamage * 3 * strength;
}

export function defaultAbilityCost(heroId: HeroId): number {
  return HERO_DEFS[heroId].abilityCost;
}
