import type { GemId, HeroId } from "../assets/types";
import { GEM_IDS } from "../assets/types";
import type { Board, ResolveResult } from "./match3/board";
import {
  MAX_EXTRA_MOVES_STREAK,
  hasLegalMove,
  resolveBoard,
  shuffleBoard,
  trySwap,
} from "./match3/board";
import type { EnemyRuntime } from "./combat/enemies";
import {
  applyStatus,
  previewEnemyPattern,
  spawnBatAlly,
  tickStatuses,
} from "./combat/enemies";
import type { HeroRuntime } from "./combat/heroes";
import { HERO_DEFS, heroForGem } from "./combat/heroes";
import {
  abilityDamage,
  abilityHealAmount,
  addCharge,
  affinityForAttack,
  applyDamageToEnemy,
  applyDamageToHero,
  canUseAbility,
  computeMatchDamage,
  healHero,
  matchChargeBonus,
  rangerExecuteMultiplier,
  spendAbility,
} from "./combat/formulas";
import type { AffinityResult } from "./combat/elements";
import {
  allEnemiesDead,
  allHeroesDead,
  lowestHpPercentEnemy,
  pickEnemyTargetHero,
  selectDefaultEnemy,
} from "./combat/targeting";
import { BattleStateMachine } from "./combat/stateMachine";
import { createRng, randomSeed } from "./rng";

export type TurnLogEntry =
  | { type: "swap"; r1: number; c1: number; r2: number; c2: number }
  | {
      type: "resolve_step";
      cascadeIndex: number;
      matchLengths: number[];
    }
  | {
      type: "hero_attack";
      heroId: HeroId;
      gem?: GemId;
      damage: number;
      targetIds: string[];
      ability?: boolean;
    }
  | {
      type: "enemy_tick";
      enemyId: string;
      countdown: number;
    }
  | {
      type: "enemy_attack";
      enemyId: string;
      heroId: HeroId;
      damage: number;
    }
  | { type: "extra_move" }
  | { type: "shuffle" }
  | { type: "outcome"; outcome: "ongoing" | "victory" | "defeat" };

export type AttackEvent =
  | {
      kind: "hero_match_attack";
      heroId: HeroId;
      gem: GemId;
      damage: number;
      targetIds: string[];
      heal?: number;
      affinity?: AffinityResult;
    }
  | {
      kind: "hero_ability";
      heroId: HeroId;
      damage: number;
      targetIds: string[];
      heal?: number;
      affinity?: AffinityResult;
      execute?: boolean;
    }
  | {
      kind: "enemy_attack";
      enemyId: string;
      heroId: HeroId;
      damage: number;
      pattern: string;
    }
  | {
      kind: "boss_phase";
      enemyId: string;
      phase: number;
    }
  | {
      kind: "enemy_spawn";
      enemy: EnemyRuntime;
    }
  | {
      kind: "extra_move";
    }
  | {
      kind: "board_shuffle";
    }
  | {
      kind: "countdown_tick";
      enemyId: string;
      countdown: number;
    }
  | {
      kind: "status_burn";
      enemyId: string;
      damage: number;
    }
  | {
      kind: "status_freeze_block";
      enemyId: string;
    };

export type BattleObjective =
  | { type: "eliminate" }
  | { type: "survive"; turns: number };

export type TurnResolution = {
  resolve: ResolveResult;
  attacks: AttackEvent[];
  heroes: HeroRuntime[];
  enemies: EnemyRuntime[];
  selectedEnemyId: string | null;
  outcome: "ongoing" | "victory" | "defeat";
  extraMoveGranted: boolean;
  countsEnemyTurn: boolean;
  totalDamageDealt: number;
  shuffled: boolean;
};

export class BattleController {
  heroes: HeroRuntime[];
  enemies: EnemyRuntime[];
  board: Board;
  selectedEnemyId: string | null;
  sm = new BattleStateMachine();
  resolving = false;
  lastCascadePeak = 1;
  /** Pending extra player actions that do not tick enemy countdowns. */
  extraMovesRemaining = 0;
  extraMoveStreak = 0;
  totalDamageDealt = 0;
  /** Potion available this battle */
  potionAvailable = true;
  potionHealFraction = 0.3;
  isBossBattle = false;
  seed: number;
  rng: () => number;
  lastTurnLog: TurnLogEntry[] = [];
  objective: BattleObjective = { type: "eliminate" };
  /** Player turns that ticked enemy phase (for survive objectives). */
  surviveTurnsElapsed = 0;

  constructor(
    heroes: HeroRuntime[],
    enemies: EnemyRuntime[],
    board: Board,
    opts?: {
      potionHealFraction?: number;
      seed?: number;
      rng?: () => number;
      objective?: BattleObjective;
    },
  ) {
    this.heroes = heroes;
    this.enemies = enemies;
    this.board = board;
    this.selectedEnemyId = selectDefaultEnemy(enemies, null);
    this.potionHealFraction = opts?.potionHealFraction ?? 0.3;
    this.isBossBattle = enemies.some((e) => e.isBoss);
    this.seed = opts?.seed ?? randomSeed();
    this.rng = opts?.rng ?? createRng(this.seed);
    this.objective = opts?.objective ?? { type: "eliminate" };
    if (!hasLegalMove(this.board)) {
      this.board = shuffleBoard(this.board, this.rng);
    }
  }

  previewPattern(enemyId: string): string {
    const e = this.enemies.find((x) => x.id === enemyId);
    if (!e || !e.alive) return "single";
    const p = previewEnemyPattern(e);
    if (p === "war_cry") return "W";
    if (p === "cleaver") return "C";
    return "!";
  }

  get surviveTurnsRemaining(): number | null {
    if (this.objective.type !== "survive") return null;
    return Math.max(0, this.objective.turns - this.surviveTurnsElapsed);
  }

  setSeed(seed: number): void {
    this.seed = seed >>> 0;
    this.rng = createRng(this.seed);
  }

  get acceptsInput(): boolean {
    return this.sm.acceptsInput && !this.resolving;
  }

  get pendingExtraMove(): boolean {
    return this.extraMovesRemaining > 0;
  }

  selectEnemy(id: string): void {
    const e = this.enemies.find((x) => x.id === id && x.alive);
    if (e) this.selectedEnemyId = id;
  }

  ensureTarget(): void {
    this.selectedEnemyId = selectDefaultEnemy(
      this.enemies,
      this.selectedEnemyId,
    );
  }

  usePotion(heroId: HeroId): { ok: boolean; heal: number } {
    if (!this.potionAvailable || !this.acceptsInput) return { ok: false, heal: 0 };
    const hero = this.heroes.find((h) => h.id === heroId && h.alive);
    if (!hero) return { ok: false, heal: 0 };
    const heal = Math.round(hero.maxHp * this.potionHealFraction);
    this.heroes = this.heroes.map((h) =>
      h.id === heroId ? healHero(h, heal) : h,
    );
    this.potionAvailable = false;
    return { ok: true, heal };
  }

  private applyHeroMatchAttacks(
    resolved: ResolveResult,
    heroes: HeroRuntime[],
    enemies: EnemyRuntime[],
    selected: string | null,
    attacks: AttackEvent[],
  ): {
    heroes: HeroRuntime[];
    enemies: EnemyRuntime[];
    selected: string | null;
    damage: number;
  } {
    let h = heroes;
    let e = enemies;
    let sel = selected;
    let damage = 0;
    const chargeBonus = matchChargeBonus(resolved.longestMatch);

    for (const gem of GEM_IDS) {
      const weighted = resolved.weightedTotals[gem]!;
      const tiles = resolved.totals[gem]!;
      if (tiles <= 0 && weighted <= 0) continue;
      const heroId = heroForGem(gem);
      const hero = h.find((x) => x.id === heroId);
      if (!hero || !hero.alive) continue;

      h = h.map((x) =>
        x.id === heroId ? addCharge(x, tiles, chargeBonus) : x,
      );

      if (heroId === "hero-priest") {
        const heal = abilityHealAmount(weighted * 0.35);
        h = h.map((x) => healHero(x, heal));
        sel = selectDefaultEnemy(e, sel);
        const target = e.find((en) => en.id === sel);
        let priestDmg = 0;
        let affinity: AffinityResult | undefined;
        if (target && target.alive) {
          affinity = affinityForAttack(gem, target);
          priestDmg = Math.max(
            1,
            Math.round(
              computeMatchDamage(gem, weighted, hero.baseDamage, affinity.modifier) *
                0.4,
            ),
          );
          const res = applyDamageToEnemy(target, priestDmg);
          e = e.map((en) => (en.id === target.id ? res.enemy : en));
          damage += res.dealt;
        }
        attacks.push({
          kind: "hero_match_attack",
          heroId,
          gem,
          damage: priestDmg,
          targetIds: sel ? [sel] : [],
          heal,
          affinity,
        });
        continue;
      }

      if (heroId === "hero-mage") {
        const targets = e.filter((en) => en.alive);
        const targetIds: string[] = [];
        let dmgShown = 0;
        for (const t of targets) {
          const affinity = affinityForAttack(gem, t);
          const dmg = computeMatchDamage(
            gem,
            weighted,
            hero.baseDamage,
            affinity.modifier,
          );
          dmgShown = dmg;
          const res = applyDamageToEnemy(t, dmg);
          e = e.map((en) => (en.id === t.id ? res.enemy : en));
          e = this.applyElementStatus(e, t.id, gem, res.dealt);
          damage += res.dealt;
          targetIds.push(t.id);
          attacks.push({
            kind: "hero_match_attack",
            heroId,
            gem,
            damage: dmg,
            targetIds: [t.id],
            affinity,
          });
        }
        if (!targets.length) {
          attacks.push({
            kind: "hero_match_attack",
            heroId,
            gem,
            damage: dmgShown,
            targetIds,
          });
        }
        continue;
      }

      if (heroId === "hero-ranger") {
        const t = lowestHpPercentEnemy(e);
        if (t) {
          const affinity = affinityForAttack(gem, t);
          const dmg = computeMatchDamage(
            gem,
            weighted,
            hero.baseDamage,
            affinity.modifier,
          );
          const res = applyDamageToEnemy(t, dmg);
          e = e.map((en) => (en.id === t.id ? res.enemy : en));
          e = this.applyElementStatus(e, t.id, gem, res.dealt);
          damage += res.dealt;
          attacks.push({
            kind: "hero_match_attack",
            heroId,
            gem,
            damage: dmg,
            targetIds: [t.id],
            affinity,
          });
        }
        continue;
      }

      // Warrior
      sel = selectDefaultEnemy(e, sel);
      const target = e.find((en) => en.id === sel);
      if (target && target.alive) {
        const affinity = affinityForAttack(gem, target);
        const dmg = computeMatchDamage(
          gem,
          weighted,
          hero.baseDamage,
          affinity.modifier,
        );
        const res = applyDamageToEnemy(target, dmg);
        e = e.map((en) => (en.id === target.id ? res.enemy : en));
        e = this.applyElementStatus(e, target.id, gem, res.dealt);
        damage += res.dealt;
        attacks.push({
          kind: "hero_match_attack",
          heroId,
          gem,
          damage: dmg,
          targetIds: [target.id],
          affinity,
        });
      }
    }

    return { heroes: h, enemies: e, selected: selectDefaultEnemy(e, sel), damage };
  }

  private applyElementStatus(
    enemies: EnemyRuntime[],
    targetId: string,
    gem: GemId,
    dealt: number,
  ): EnemyRuntime[] {
    if (gem === "gem-flame" && dealt > 0) {
      return enemies.map((en) =>
        en.id === targetId
          ? applyStatus(en, {
              id: "burn",
              turns: 2,
              potency: Math.max(1, Math.round(dealt * 0.1)),
            })
          : en,
      );
    }
    if (gem === "gem-ice" && dealt > 0) {
      return enemies.map((en) =>
        en.id === targetId
          ? applyStatus(en, { id: "freeze", turns: 1 })
          : en,
      );
    }
    return enemies;
  }

  private checkVictory(
    heroes: HeroRuntime[],
    enemies: EnemyRuntime[],
  ): "victory" | "defeat" | "ongoing" {
    if (allHeroesDead(heroes)) return "defeat";
    if (this.objective.type === "survive") {
      if (this.surviveTurnsElapsed >= this.objective.turns) return "victory";
      return "ongoing";
    }
    if (allEnemiesDead(enemies)) return "victory";
    return "ongoing";
  }

  private runEnemyPhase(
    heroes: HeroRuntime[],
    enemies: EnemyRuntime[],
    attacks: AttackEvent[],
    rng: () => number,
  ): { heroes: HeroRuntime[]; enemies: EnemyRuntime[] } {
    let h = heroes;
    let e = enemies.map((en) => ({ ...en, statuses: [...en.statuses] }));

    // Status ticks (burn DoT); remember freeze blocks before turns expire
    const freezeBlocked = new Set<string>();
    for (let i = 0; i < e.length; i++) {
      const enemy = e[i]!;
      if (!enemy.alive) continue;
      const ticked = tickStatuses(enemy);
      e[i] = ticked.enemy;
      if (ticked.freezeBlocksAttack) freezeBlocked.add(enemy.id);
      if (ticked.burnDamage > 0) {
        const res = applyDamageToEnemy(e[i]!, ticked.burnDamage);
        e[i] = { ...res.enemy, statuses: e[i]!.statuses };
        this.totalDamageDealt += res.dealt;
        attacks.push({
          kind: "status_burn",
          enemyId: enemy.id,
          damage: res.dealt,
        });
      }
    }

    // Tick countdowns
    for (let i = 0; i < e.length; i++) {
      const enemy = e[i]!;
      if (!enemy.alive) continue;
      const nextCd = enemy.countdown - 1;
      e[i] = { ...enemy, countdown: nextCd };
      attacks.push({
        kind: "countdown_tick",
        enemyId: enemy.id,
        countdown: nextCd,
      });
    }

    // Enemies at 0 attack
    for (let i = 0; i < e.length; i++) {
      const enemy = e[i]!;
      if (!enemy.alive || enemy.countdown > 0) continue;

      if (freezeBlocked.has(enemy.id)) {
        e[i] = {
          ...enemy,
          countdown: enemy.countdownMax,
        };
        attacks.push({ kind: "status_freeze_block", enemyId: enemy.id });
        continue;
      }

      const pattern = this.pickBossPattern(enemy);
      const bonus = enemy.nextAttackBonus;
      e[i] = { ...enemy, nextAttackBonus: 0 };

      if (pattern === "war_cry") {
        // Light AoE + next attack bonus
        const living = h.filter((x) => x.alive);
        for (const target of living) {
          const dmg = Math.max(1, Math.round(enemy.attack * 0.45) + bonus);
          const res = applyDamageToHero(target, dmg);
          h = h.map((x) => (x.id === target.id ? res.hero : x));
          attacks.push({
            kind: "enemy_attack",
            enemyId: enemy.id,
            heroId: target.id,
            damage: res.dealt,
            pattern: "war_cry",
          });
        }
        e[i] = {
          ...e[i]!,
          nextAttackBonus: Math.round(enemy.attack * 0.5),
          countdown: enemy.countdownMax,
        };
      } else {
        // cleaver / single
        const target = pickEnemyTargetHero(h, enemy.targetRule, rng);
        if (target) {
          const dmg =
            pattern === "cleaver"
              ? Math.round(enemy.attack * 1.35) + bonus
              : enemy.attack + bonus;
          const res = applyDamageToHero(target, dmg);
          h = h.map((x) => (x.id === target.id ? res.hero : x));
          attacks.push({
            kind: "enemy_attack",
            enemyId: enemy.id,
            heroId: target.id,
            damage: res.dealt,
            pattern,
          });
        }
        e[i] = { ...e[i]!, countdown: enemy.countdownMax };
      }
    }

    // Boss phase check
    for (let i = 0; i < e.length; i++) {
      const enemy = e[i]!;
      if (!enemy.isBoss || !enemy.alive || enemy.phase >= 1) continue;
      if (enemy.hp / enemy.maxHp <= 0.5) {
        e[i] = {
          ...enemy,
          phase: 1,
          countdownMax: 1,
          countdown: 1,
        };
        attacks.push({ kind: "boss_phase", enemyId: enemy.id, phase: 1 });
        // Summon one bat if none already summoned this fight
        if (!e.some((x) => x.id.includes("summon"))) {
          const bat = spawnBatAlly();
          e = [...e, bat];
          attacks.push({ kind: "enemy_spawn", enemy: bat });
        }
      }
    }

    return { heroes: h, enemies: e };
  }

  private pickBossPattern(enemy: EnemyRuntime): string {
    if (!enemy.isBoss || enemy.patterns.length < 2) {
      return enemy.patterns[0] ?? "single_lowest";
    }
    // Alternate: even attacks cleaver, odd war cry based on phase+hp
    const useWarCry = enemy.hp % 2 === 0 || enemy.phase >= 1;
    return useWarCry && enemy.patterns.includes("war_cry")
      ? "war_cry"
      : "cleaver";
  }

  attemptSwap(
    r1: number,
    c1: number,
    r2: number,
    c2: number,
    rng: () => number = this.rng,
  ):
    | { ok: false; reason: string }
    | { ok: true; turn: TurnResolution } {
    if (!this.acceptsInput) {
      return { ok: false, reason: "input_blocked" };
    }
    const swap = trySwap(this.board, r1, c1, r2, c2);
    if (!swap.ok) return { ok: false, reason: swap.reason };

    this.resolving = true;
    this.sm.set("MATCH_RESOLUTION");
    const log: TurnLogEntry[] = [{ type: "swap", r1, c1, r2, c2 }];

    const usingExtra = this.extraMovesRemaining > 0;
    if (usingExtra) {
      this.extraMovesRemaining -= 1;
    }

    const resolved = resolveBoard(
      swap.board,
      rng,
      swap.prismaticClear,
      swap.lineClear,
    );
    this.board = resolved.finalBoard;
    this.lastCascadePeak = resolved.cascadeMultiplierPeak;

    for (const step of resolved.steps) {
      log.push({
        type: "resolve_step",
        cascadeIndex: step.cascadeIndex,
        matchLengths: step.cleared.map((g) => g.length),
      });
    }

    let heroes = this.heroes.map((h) => ({ ...h }));
    let enemies = this.enemies.map((e) => ({ ...e }));
    this.ensureTarget();
    let selected = this.selectedEnemyId;
    const attacks: AttackEvent[] = [];
    let shuffled = false;

    if (!hasLegalMove(this.board)) {
      this.board = shuffleBoard(this.board, rng);
      shuffled = true;
      attacks.push({ kind: "board_shuffle" });
      log.push({ type: "shuffle" });
    }

    this.sm.set("HERO_ATTACKS");
    const applied = this.applyHeroMatchAttacks(
      resolved,
      heroes,
      enemies,
      selected,
      attacks,
    );
    heroes = applied.heroes;
    enemies = applied.enemies;
    selected = applied.selected;
    this.totalDamageDealt += applied.damage;

    // Match of four → grant one extra player action (capped streak).
    // Extra actions themselves do not reduce enemy countdowns.
    let extraMoveGranted = false;
    if (resolved.matchFourOccurred && this.extraMoveStreak < MAX_EXTRA_MOVES_STREAK) {
      this.extraMovesRemaining += 1;
      this.extraMoveStreak += 1;
      extraMoveGranted = true;
      attacks.push({ kind: "extra_move" });
      log.push({ type: "extra_move" });
    } else if (!resolved.matchFourOccurred && !usingExtra) {
      this.extraMoveStreak = 0;
    }

    /** Normal turns tick countdowns; extra actions do not. */
    const countsEnemyTurn = !usingExtra;

    const earlyOutcome = this.checkVictory(heroes, enemies);
    if (earlyOutcome === "victory") {
      this.commit(heroes, enemies, selected);
      this.sm.set("VICTORY");
      this.appendAttackLog(log, attacks);
      log.push({ type: "outcome", outcome: "victory" });
      this.lastTurnLog = log;
      return {
        ok: true,
        turn: this.packTurn(
          resolved,
          attacks,
          "victory",
          extraMoveGranted,
          countsEnemyTurn,
          shuffled,
        ),
      };
    }

    if (countsEnemyTurn) {
      this.sm.set("ENEMY_TURN");
      const phase = this.runEnemyPhase(heroes, enemies, attacks, rng);
      heroes = phase.heroes;
      enemies = phase.enemies;
      this.surviveTurnsElapsed += 1;
    }

    this.commit(heroes, enemies, selected);

    const outcome = this.checkVictory(heroes, enemies);
    if (outcome === "defeat") {
      this.sm.set("DEFEAT");
      this.appendAttackLog(log, attacks);
      log.push({ type: "outcome", outcome: "defeat" });
      this.lastTurnLog = log;
      return {
        ok: true,
        turn: this.packTurn(
          resolved,
          attacks,
          "defeat",
          extraMoveGranted,
          countsEnemyTurn,
          shuffled,
        ),
      };
    }
    if (outcome === "victory") {
      this.sm.set("VICTORY");
      this.appendAttackLog(log, attacks);
      log.push({ type: "outcome", outcome: "victory" });
      this.lastTurnLog = log;
      return {
        ok: true,
        turn: this.packTurn(
          resolved,
          attacks,
          "victory",
          extraMoveGranted,
          countsEnemyTurn,
          shuffled,
        ),
      };
    }

    this.sm.set("PLAYER_INPUT");
    this.appendAttackLog(log, attacks);
    log.push({ type: "outcome", outcome: "ongoing" });
    this.lastTurnLog = log;
    return {
      ok: true,
      turn: this.packTurn(
        resolved,
        attacks,
        "ongoing",
        extraMoveGranted,
        countsEnemyTurn,
        shuffled,
      ),
    };
  }

  private appendAttackLog(log: TurnLogEntry[], attacks: AttackEvent[]): void {
    for (const ev of attacks) {
      if (ev.kind === "hero_match_attack") {
        log.push({
          type: "hero_attack",
          heroId: ev.heroId,
          gem: ev.gem,
          damage: ev.damage,
          targetIds: ev.targetIds,
        });
      } else if (ev.kind === "hero_ability") {
        log.push({
          type: "hero_attack",
          heroId: ev.heroId,
          damage: ev.damage,
          targetIds: ev.targetIds,
          ability: true,
        });
      } else if (ev.kind === "countdown_tick") {
        log.push({
          type: "enemy_tick",
          enemyId: ev.enemyId,
          countdown: ev.countdown,
        });
      } else if (ev.kind === "enemy_attack") {
        log.push({
          type: "enemy_attack",
          enemyId: ev.enemyId,
          heroId: ev.heroId,
          damage: ev.damage,
        });
      }
    }
  }

  private commit(
    heroes: HeroRuntime[],
    enemies: EnemyRuntime[],
    selected: string | null,
  ): void {
    this.heroes = heroes;
    this.enemies = enemies;
    this.selectedEnemyId = selectDefaultEnemy(enemies, selected);
    this.resolving = false;
  }

  private packTurn(
    resolve: ResolveResult,
    attacks: AttackEvent[],
    outcome: "ongoing" | "victory" | "defeat",
    extraMoveGranted: boolean,
    countsEnemyTurn: boolean,
    shuffled: boolean,
  ): TurnResolution {
    return {
      resolve,
      attacks,
      heroes: this.heroes,
      enemies: this.enemies,
      selectedEnemyId: this.selectedEnemyId,
      outcome,
      extraMoveGranted,
      countsEnemyTurn,
      totalDamageDealt: this.totalDamageDealt,
      shuffled,
    };
  }

  useAbility(
    heroId: HeroId,
    rng: () => number = this.rng,
  ): {
    ok: boolean;
    attacks: AttackEvent[];
    outcome: "ongoing" | "victory" | "defeat";
  } {
    if (!this.acceptsInput) return { ok: false, attacks: [], outcome: "ongoing" };
    let heroes = this.heroes.map((h) => ({ ...h }));
    let enemies = this.enemies.map((e) => ({ ...e }));
    const hero = heroes.find((h) => h.id === heroId);
    if (!hero || !canUseAbility(hero)) {
      return { ok: false, attacks: [], outcome: "ongoing" };
    }

    const usingExtra = this.extraMovesRemaining > 0;
    if (usingExtra) this.extraMovesRemaining -= 1;

    this.sm.set("ABILITY_RESOLUTION");
    heroes = heroes.map((h) => (h.id === heroId ? spendAbility(h) : h));
    const attacks: AttackEvent[] = [];
    const log: TurnLogEntry[] = [];
    const base = hero.baseDamage * 3;

    if (heroId === "hero-warrior") {
      this.ensureTarget();
      const tid = this.selectedEnemyId;
      const target = enemies.find((e) => e.id === tid && e.alive);
      if (target) {
        const gem = HERO_DEFS[heroId] ? ("gem-flame" as GemId) : "gem-flame";
        const affinity = affinityForAttack(gem, target);
        const dmg = Math.round(
          abilityDamage(heroId, base) * affinity.modifier,
        );
        const res = applyDamageToEnemy(target, dmg);
        enemies = enemies.map((e) => (e.id === tid ? res.enemy : e));
        enemies = this.applyElementStatus(enemies, tid!, gem, res.dealt);
        this.totalDamageDealt += res.dealt;
        attacks.push({
          kind: "hero_ability",
          heroId,
          damage: dmg,
          targetIds: [tid!],
          affinity,
        });
      }
    } else if (heroId === "hero-mage") {
      const targets = enemies.filter((e) => e.alive);
      for (const t of targets) {
        const affinity = affinityForAttack("gem-ice", t);
        const dmg = Math.round(
          abilityDamage(heroId, base) * affinity.modifier,
        );
        const res = applyDamageToEnemy(t, dmg);
        enemies = enemies.map((e) => (e.id === t.id ? res.enemy : e));
        enemies = this.applyElementStatus(enemies, t.id, "gem-ice", res.dealt);
        this.totalDamageDealt += res.dealt;
        attacks.push({
          kind: "hero_ability",
          heroId,
          damage: dmg,
          targetIds: [t.id],
          affinity,
        });
      }
    } else if (heroId === "hero-ranger") {
      const t = lowestHpPercentEnemy(enemies);
      if (t) {
        const affinity = affinityForAttack("gem-leaf", t);
        const exec = rangerExecuteMultiplier(t);
        const dmg = Math.round(
          abilityDamage(heroId, base) * affinity.modifier * exec,
        );
        const res = applyDamageToEnemy(t, dmg);
        enemies = enemies.map((e) => (e.id === t.id ? res.enemy : e));
        this.totalDamageDealt += res.dealt;
        attacks.push({
          kind: "hero_ability",
          heroId,
          damage: dmg,
          targetIds: [t.id],
          affinity,
          execute: exec > 1,
        });
      }
    } else {
      const heal = abilityHealAmount(8);
      heroes = heroes.map((h) => healHero(h, heal));
      attacks.push({
        kind: "hero_ability",
        heroId,
        damage: 0,
        targetIds: [],
        heal,
      });
    }

    this.selectedEnemyId = selectDefaultEnemy(enemies, this.selectedEnemyId);

    const earlyOutcome = this.checkVictory(heroes, enemies);
    if (earlyOutcome === "victory") {
      this.commit(heroes, enemies, this.selectedEnemyId);
      this.sm.set("VICTORY");
      this.appendAttackLog(log, attacks);
      log.push({ type: "outcome", outcome: "victory" });
      this.lastTurnLog = log;
      return { ok: true, attacks, outcome: "victory" };
    }

    // Abilities tick enemy countdowns unless this action was an extra move
    if (!usingExtra) {
      this.sm.set("ENEMY_TURN");
      const phase = this.runEnemyPhase(heroes, enemies, attacks, rng);
      heroes = phase.heroes;
      enemies = phase.enemies;
      this.surviveTurnsElapsed += 1;
    }

    this.commit(heroes, enemies, this.selectedEnemyId);

    const outcome = this.checkVictory(heroes, enemies);
    if (outcome === "defeat") {
      this.sm.set("DEFEAT");
      this.appendAttackLog(log, attacks);
      log.push({ type: "outcome", outcome: "defeat" });
      this.lastTurnLog = log;
      return { ok: true, attacks, outcome: "defeat" };
    }
    if (outcome === "victory") {
      this.sm.set("VICTORY");
      this.appendAttackLog(log, attacks);
      log.push({ type: "outcome", outcome: "victory" });
      this.lastTurnLog = log;
      return { ok: true, attacks, outcome: "victory" };
    }

    this.sm.set("PLAYER_INPUT");
    this.appendAttackLog(log, attacks);
    log.push({ type: "outcome", outcome: "ongoing" });
    this.lastTurnLog = log;
    return { ok: true, attacks, outcome: "ongoing" };
  }

  forceWin(): void {
    this.enemies = this.enemies.map((e) => ({
      ...e,
      hp: 0,
      alive: false,
    }));
    this.sm.set("VICTORY");
  }

  forceLose(): void {
    this.heroes = this.heroes.map((h) => ({
      ...h,
      hp: 0,
      shield: 0,
      alive: false,
    }));
    this.sm.set("DEFEAT");
  }

  setEnemyCountdown(enemyId: string, value: number): void {
    this.enemies = this.enemies.map((e) =>
      e.id === enemyId
        ? { ...e, countdown: Math.max(0, value) }
        : e,
    );
  }

  triggerBossPhase(): void {
    this.enemies = this.enemies.map((e) => {
      if (!e.isBoss || !e.alive) return e;
      const hp = Math.min(e.hp, Math.floor(e.maxHp * 0.45));
      return {
        ...e,
        hp,
        phase: 1,
        countdownMax: 1,
        countdown: 1,
      };
    });
    if (!this.enemies.some((e) => e.id.includes("summon"))) {
      const bat = spawnBatAlly();
      this.enemies = [...this.enemies, bat];
    }
  }

  fillAbility(heroId: HeroId): void {
    this.heroes = this.heroes.map((h) =>
      h.id === heroId ? { ...h, charge: h.abilityCost } : h,
    );
  }
}
