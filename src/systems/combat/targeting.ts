import type { EnemyRuntime } from "./enemies";
import type { HeroRuntime } from "./heroes";

export function selectDefaultEnemy(
  enemies: EnemyRuntime[],
  currentId: string | null,
): string | null {
  const living = enemies.filter((e) => e.alive);
  if (living.length === 0) return null;
  if (currentId && living.some((e) => e.id === currentId)) return currentId;
  living.sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
  return living[0]!.id;
}

export function lowestHpPercentEnemy(enemies: EnemyRuntime[]): EnemyRuntime | null {
  const living = enemies.filter((e) => e.alive);
  if (!living.length) return null;
  living.sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
  return living[0]!;
}

export function pickEnemyTargetHero(
  heroes: HeroRuntime[],
  rule: "lowest_hp_pct" | "random" = "lowest_hp_pct",
  rng: () => number = Math.random,
): HeroRuntime | null {
  const living = heroes.filter((h) => h.alive);
  if (!living.length) return null;
  if (rule === "random") {
    return living[Math.floor(rng() * living.length)]!;
  }
  living.sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
  return living[0]!;
}

export function allEnemiesDead(enemies: EnemyRuntime[]): boolean {
  return enemies.length === 0 || enemies.every((e) => !e.alive);
}

export function allHeroesDead(heroes: HeroRuntime[]): boolean {
  return heroes.every((h) => !h.alive);
}
