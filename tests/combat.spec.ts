import { describe, expect, it, beforeEach } from "vitest";
import {
  areAdjacent,
  createBoard,
  findMatches,
  resolveBoard,
  trySwap,
  hasLegalMove,
  shuffleBoard,
  BOARD_SIZE,
  spawnSpecialGemAt,
  type Board,
} from "../src/systems/match3/board";
import { GEM_IDS, SPECIAL_GEM_ID, type GemId } from "../src/assets/types";
import { createParty, HERO_DEFS } from "../src/systems/combat/heroes";
import {
  createFirstBattleEnemies,
  createEncounterEnemies,
  resetEnemyInstanceCounter,
} from "../src/systems/combat/enemies";
import { BattleController } from "../src/systems/BattleController";
import {
  DEFAULT_SAVE,
  migrateSave,
  parseAudioSettings,
  serializeAudioSettings,
  validateSave,
} from "../src/data/save";
import { AudioManager } from "../src/audio/AudioManager";
import { selectDefaultEnemy } from "../src/systems/combat/targeting";
import { elementalModifier } from "../src/systems/combat/elements";
import {
  applyDamageToHero,
  healHero,
} from "../src/systems/combat/formulas";
import { BATTLE_LAYOUT, MAP_NODES, isNodeUnlocked } from "../src/data/mapNodes";
import {
  computeBattleRewards,
  ENCOUNTER_REWARDS,
} from "../src/systems/economy/rewards";
import {
  goldRewardMultiplier,
  potionHealFraction,
  scaledHeroStats,
} from "../src/systems/combat/progression";
import {
  markTutorialStep,
  resetTutorial,
  isTutorialStepDone,
} from "../src/systems/tutorial/TutorialManager";

function boardFrom(rows: GemId[][]): Board {
  return rows.map((r) => r.slice());
}

function craftedMatchBoard(): Board {
  return boardFrom([
    ["gem-leaf", "gem-flame", "gem-flame", "gem-ice", "gem-light", "gem-ice", "gem-leaf"],
    ["gem-flame", "gem-ice", "gem-leaf", "gem-light", "gem-ice", "gem-leaf", "gem-light"],
    ["gem-ice", "gem-leaf", "gem-light", "gem-ice", "gem-leaf", "gem-light", "gem-ice"],
    ["gem-leaf", "gem-light", "gem-ice", "gem-leaf", "gem-light", "gem-ice", "gem-leaf"],
    ["gem-light", "gem-ice", "gem-leaf", "gem-light", "gem-ice", "gem-leaf", "gem-light"],
    ["gem-ice", "gem-leaf", "gem-light", "gem-ice", "gem-leaf", "gem-light", "gem-ice"],
    ["gem-leaf", "gem-light", "gem-ice", "gem-leaf", "gem-light", "gem-ice", "gem-leaf"],
  ]);
}

/** Horizontal match of four flames on row 0 after swap. */
function craftedMatchFourBoard(): Board {
  return boardFrom([
    ["gem-leaf", "gem-flame", "gem-flame", "gem-flame", "gem-ice", "gem-ice", "gem-leaf"],
    ["gem-flame", "gem-ice", "gem-leaf", "gem-light", "gem-ice", "gem-leaf", "gem-light"],
    ["gem-ice", "gem-leaf", "gem-light", "gem-ice", "gem-leaf", "gem-light", "gem-ice"],
    ["gem-leaf", "gem-light", "gem-ice", "gem-leaf", "gem-light", "gem-ice", "gem-leaf"],
    ["gem-light", "gem-ice", "gem-leaf", "gem-light", "gem-ice", "gem-leaf", "gem-light"],
    ["gem-ice", "gem-leaf", "gem-light", "gem-ice", "gem-leaf", "gem-light", "gem-ice"],
    ["gem-leaf", "gem-light", "gem-ice", "gem-leaf", "gem-light", "gem-ice", "gem-leaf"],
  ]);
}

/** Match of five after swapping leaf at (0,0) with flame at (1,0). */
function craftedMatchFiveBoard(): Board {
  return boardFrom([
    ["gem-leaf", "gem-flame", "gem-flame", "gem-flame", "gem-flame", "gem-ice", "gem-leaf"],
    ["gem-flame", "gem-ice", "gem-leaf", "gem-light", "gem-ice", "gem-leaf", "gem-light"],
    ["gem-ice", "gem-leaf", "gem-light", "gem-ice", "gem-leaf", "gem-light", "gem-ice"],
    ["gem-leaf", "gem-light", "gem-ice", "gem-leaf", "gem-light", "gem-ice", "gem-leaf"],
    ["gem-light", "gem-ice", "gem-leaf", "gem-light", "gem-ice", "gem-leaf", "gem-light"],
    ["gem-ice", "gem-leaf", "gem-light", "gem-ice", "gem-leaf", "gem-light", "gem-ice"],
    ["gem-leaf", "gem-light", "gem-ice", "gem-leaf", "gem-light", "gem-ice", "gem-leaf"],
  ]);
}

describe("battle layout configuration", () => {
  it("places heroes on the left and enemies on the right", () => {
    expect(BATTLE_LAYOUT.partySide).toBe("left");
    expect(BATTLE_LAYOUT.enemySide).toBe("right");
    expect(BATTLE_LAYOUT.partyX).toBeLessThan(0.5);
    expect(BATTLE_LAYOUT.enemyX).toBeGreaterThan(0.5);
  });
});

describe("match3 adjacency & swap", () => {
  it("detects adjacent cells", () => {
    expect(areAdjacent(0, 0, 0, 1)).toBe(true);
    expect(areAdjacent(0, 0, 1, 1)).toBe(false);
  });

  it("rejects invalid non-matching swap", () => {
    const b = boardFrom([
      ["gem-flame", "gem-ice", "gem-leaf", "gem-light", "gem-flame", "gem-ice", "gem-leaf"],
      ["gem-ice", "gem-leaf", "gem-light", "gem-flame", "gem-ice", "gem-leaf", "gem-light"],
      ["gem-leaf", "gem-light", "gem-flame", "gem-ice", "gem-leaf", "gem-light", "gem-flame"],
      ["gem-light", "gem-flame", "gem-ice", "gem-leaf", "gem-light", "gem-flame", "gem-ice"],
      ["gem-flame", "gem-ice", "gem-leaf", "gem-light", "gem-flame", "gem-ice", "gem-leaf"],
      ["gem-ice", "gem-leaf", "gem-light", "gem-flame", "gem-ice", "gem-leaf", "gem-light"],
      ["gem-leaf", "gem-light", "gem-flame", "gem-ice", "gem-leaf", "gem-light", "gem-flame"],
    ]);
    const res = trySwap(b, 0, 0, 0, 1);
    expect(res.ok).toBe(false);
  });

  it("accepts valid horizontal match swap", () => {
    const res = trySwap(craftedMatchBoard(), 0, 0, 1, 0);
    expect(res.ok).toBe(true);
  });
});

describe("match of four — extra action", () => {
  it("grants exactly one extra action and does not tick countdowns on the extra action", () => {
    const enemies = createFirstBattleEnemies().map((e) => ({
      ...e,
      hp: 5000,
      maxHp: 5000,
    }));
    const ctrl = new BattleController(createParty(), enemies, craftedMatchFourBoard());
    const res = ctrl.attemptSwap(0, 0, 1, 0, () => 0.25);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.turn.extraMoveGranted).toBe(true);
    expect(res.turn.attacks.some((a) => a.kind === "extra_move")).toBe(true);
    expect(res.turn.countsEnemyTurn).toBe(true);
    expect(ctrl.extraMovesRemaining).toBe(1);
    expect(ctrl.acceptsInput).toBe(true);

    const cdBeforeExtra = ctrl.enemies.map((e) => ({ id: e.id, cd: e.countdown }));
    ctrl.board = craftedMatchBoard();
    const extra = ctrl.attemptSwap(0, 0, 1, 0, () => 0.3);
    expect(extra.ok).toBe(true);
    if (!extra.ok) return;
    expect(extra.turn.countsEnemyTurn).toBe(false);
    for (const prev of cdBeforeExtra) {
      const e = ctrl.enemies.find((x) => x.id === prev.id)!;
      if (e.alive) expect(e.countdown).toBe(prev.cd);
    }
  });
});

describe("match of five — prismatic gem", () => {
  it("creates a special gem on match of five", () => {
    const swap = trySwap(craftedMatchFiveBoard(), 0, 0, 1, 0);
    expect(swap.ok).toBe(true);
    if (!swap.ok) return;
    const resolved = resolveBoard(swap.board, () => 0.2);
    expect(resolved.matchFiveOccurred).toBe(true);
    expect(resolved.specialGemsCreated).toBeGreaterThanOrEqual(1);
    let found = false;
    for (const row of resolved.finalBoard) {
      for (const cell of row) {
        if (cell === SPECIAL_GEM_ID) found = true;
      }
    }
    // May cascade away; creation is asserted via specialGemsCreated
    expect(resolved.specialGemsCreated >= 1 || found).toBe(true);
  });

  it("prismatic swap clears the selected color", () => {
    const b = craftedMatchBoard();
    const withPrism = spawnSpecialGemAt(b, 0, 0);
    // Neighbor is flame at 0,1
    const swap = trySwap(withPrism, 0, 0, 0, 1);
    expect(swap.ok).toBe(true);
    if (!swap.ok || !swap.prismaticClear) return;
    expect(swap.prismaticClear.color).toBe("gem-flame");
    const resolved = resolveBoard(swap.board, () => 0.4, swap.prismaticClear);
    expect(resolved.prismaticActivations.length).toBe(1);
    expect(resolved.totals["gem-flame"]).toBeGreaterThan(0);
  });
});

describe("dead board shuffle", () => {
  it("produces at least one legal move", () => {
    let n = 0;
    const rng = () => {
      n += 1;
      return (n * 0.37) % 1;
    };
    const b = createBoard(rng);
    const shuffled = shuffleBoard(b, rng);
    expect(hasLegalMove(shuffled)).toBe(true);
    expect(findMatches(shuffled).length).toBe(0);
  });
});

describe("enemy countdowns", () => {
  beforeEach(() => resetEnemyInstanceCounter());

  it("decreases countdown after a normal turn and attacks at zero", () => {
    const enemies = createFirstBattleEnemies();
    // Bat has countdown 1
    const bat = enemies.find((e) => e.typeId === "enemy-bat")!;
    expect(bat.countdown).toBe(1);
    const ctrl = new BattleController(createParty(), enemies, craftedMatchBoard());
    const hpBefore = ctrl.heroes.reduce((s, h) => s + h.hp, 0);
    const res = ctrl.attemptSwap(0, 0, 1, 0, () => 0.2);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.turn.countsEnemyTurn).toBe(true);
    // Bat should have attacked (countdown was 1 → 0 → attack → reset)
    const batAfter = ctrl.enemies.find((e) => e.typeId === "enemy-bat")!;
    expect(batAfter.countdown).toBe(batAfter.countdownMax);
    expect(res.turn.attacks.some((a) => a.kind === "enemy_attack" && a.enemyId === bat.id)).toBe(
      true,
    );
    const hpAfter = ctrl.heroes.reduce((s, h) => s + h.hp, 0);
    expect(hpAfter).toBeLessThan(hpBefore);
  });

  it("resets countdown after attack", () => {
    const enemies = createFirstBattleEnemies();
    const bat = enemies.find((e) => e.typeId === "enemy-bat")!;
    bat.countdown = 1;
    const ctrl = new BattleController(createParty(), enemies, craftedMatchBoard());
    ctrl.attemptSwap(0, 0, 1, 0, () => 0.22);
    const after = ctrl.enemies.find((e) => e.id === bat.id)!;
    expect(after.countdown).toBe(after.countdownMax);
  });
});

describe("elemental system", () => {
  it("applies weakness ×1.5 and resistance ×0.75", () => {
    expect(elementalModifier("red", "green").modifier).toBe(1.5);
    expect(elementalModifier("red", "green").tag).toBe("WEAK");
    expect(elementalModifier("red", "blue").modifier).toBe(0.75);
    expect(elementalModifier("red", "blue").tag).toBe("RESIST");
    expect(elementalModifier("red", "red").modifier).toBe(1);
  });
});

describe("shield absorption", () => {
  it("absorbs damage into shield before HP", () => {
    let hero = createParty()[0]!;
    hero = healHero({ ...hero, hp: hero.maxHp }, 50);
    expect(hero.shield).toBeGreaterThan(0);
    const res = applyDamageToHero(hero, hero.shield);
    expect(res.shieldAbsorbed).toBe(hero.shield);
    expect(res.hero.hp).toBe(hero.maxHp);
  });
});

describe("ability costs", () => {
  it("uses distinct ability costs per hero", () => {
    expect(HERO_DEFS["hero-warrior"].abilityCost).toBe(10);
    expect(HERO_DEFS["hero-mage"].abilityCost).toBe(12);
    expect(HERO_DEFS["hero-ranger"].abilityCost).toBe(10);
    expect(HERO_DEFS["hero-priest"].abilityCost).toBe(12);
    const costs = new Set(Object.values(HERO_DEFS).map((h) => h.abilityCost));
    expect(costs.size).toBeGreaterThan(1);
  });
});

describe("boss encounter", () => {
  it("transitions phase at 50% HP and supports victory", () => {
    const enemies = createEncounterEnemies("fortress");
    expect(enemies[0]!.isBoss).toBe(true);
    const ctrl = new BattleController(createParty(), enemies, createBoard(() => 0.5));
    const boss = ctrl.enemies[0]!;
    boss.hp = Math.floor(boss.maxHp * 0.45);
    ctrl.triggerBossPhase();
    const updated = ctrl.enemies.find((e) => e.isBoss)!;
    expect(updated.phase).toBe(1);
    expect(updated.countdownMax).toBe(1);
    ctrl.forceWin();
    expect(ctrl.sm.state).toBe("VICTORY");
  });
});

describe("world map progression", () => {
  it("unlocks nodes sequentially", () => {
    const save = { ...DEFAULT_SAVE };
    const forest = MAP_NODES.find((n) => n.id === "forest-trail")!;
    expect(isNodeUnlocked(forest, save)).toBe(false);
    save.firstNodeCompleted = true;
    expect(isNodeUnlocked(forest, save)).toBe(true);
    const quarry = MAP_NODES.find((n) => n.id === "old-quarry")!;
    expect(isNodeUnlocked(quarry, save)).toBe(false);
    save.forestNodeCompleted = true;
    expect(isNodeUnlocked(quarry, save)).toBe(true);
    expect(MAP_NODES.filter((n) => n.kind === "battle").length).toBe(5);
  });
});

describe("rewards and economy", () => {
  it("grants encounter rewards and mine multiplier", () => {
    expect(ENCOUNTER_REWARDS.ruins.gold).toBe(40);
    expect(ENCOUNTER_REWARDS.fortress.materials).toBe(4);
    expect(goldRewardMultiplier(1)).toBe(1);
    expect(goldRewardMultiplier(2)).toBe(1.2);
    const boosted = computeBattleRewards("ruins", 2);
    expect(boosted.gold).toBe(Math.round(40 * 1.2));
  });

  it("scales hero levels and workshop potion", () => {
    const l1 = scaledHeroStats("hero-warrior", 1);
    const l3 = scaledHeroStats("hero-warrior", 3);
    expect(l3.maxHp).toBeGreaterThan(l1.maxHp);
    expect(potionHealFraction(1)).toBe(0.3);
    expect(potionHealFraction(2)).toBe(0.45);
  });
});

describe("save migration", () => {
  it("migrates v1 saves and recovers malformed data", () => {
    const v1 = {
      firstNodeCompleted: true,
      forestNodeCompleted: true,
      musicVolume: 0.2,
      sfxMuted: true,
    };
    const migrated = migrateSave(v1);
    expect(migrated.version).toBe(2);
    expect(migrated.firstNodeCompleted).toBe(true);
    expect(migrated.gold).toBe(0);
    expect(migrated.heroLevels["hero-warrior"]).toBe(1);
    expect(migrateSave(null).version).toBe(2);
    expect(migrateSave(undefined).gold).toBe(0);
    expect(validateSave(migrated).ok).toBe(true);
    expect(validateSave("bad").ok).toBe(false);
  });
});

describe("tutorial persistence", () => {
  it("marks and resets tutorial steps", () => {
    // Use in-memory localStorage mock if needed — migrate via markTutorialStep
    const storage: Record<string, string> = {};
    const orig = globalThis.localStorage;
    // @ts-expect-error test stub
    globalThis.localStorage = {
      getItem: (k: string) => storage[k] ?? null,
      setItem: (k: string, v: string) => {
        storage[k] = v;
      },
      removeItem: (k: string) => {
        delete storage[k];
      },
      clear: () => {
        for (const k of Object.keys(storage)) delete storage[k];
      },
      key: () => null,
      length: 0,
    };
    resetTutorial();
    expect(isTutorialStepDone(resetTutorial(), "select_enemy")).toBe(false);
    const after = markTutorialStep("select_enemy");
    expect(after.tutorialSteps.select_enemy).toBe(true);
    resetTutorial();
    globalThis.localStorage = orig;
  });
});

describe("cascades", () => {
  it("resolves cascades until stable", () => {
    const b = Array.from({ length: BOARD_SIZE }, () =>
      Array.from({ length: BOARD_SIZE }, () => "gem-flame" as GemId),
    );
    let i = 0;
    const rng = () => {
      i++;
      return (i % 4) / 4;
    };
    const resolved = resolveBoard(b, rng);
    expect(resolved.steps.length).toBeGreaterThan(0);
    expect(findMatches(resolved.finalBoard).length).toBe(0);
  });
});

describe("battle controller basics", () => {
  it("activates warrior on red matches", () => {
    const ctrl = new BattleController(
      createParty(),
      createFirstBattleEnemies(),
      craftedMatchBoard(),
    );
    const slime = ctrl.enemies.find((e) => e.typeId === "enemy-slime")!;
    ctrl.selectEnemy(slime.id);
    const before = slime.hp;
    const res = ctrl.attemptSwap(0, 0, 1, 0, () => 0.25);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(
      res.turn.attacks.some(
        (a) => a.kind === "hero_match_attack" && a.heroId === "hero-warrior",
      ),
    ).toBe(true);
    const after = res.turn.enemies.find((e) => e.id === slime.id)!.hp;
    expect(after).toBeLessThan(before);
  });

  it("supports victory and defeat", () => {
    const ctrl = new BattleController(
      createParty(),
      createFirstBattleEnemies(),
      createBoard(() => 0.5),
    );
    ctrl.forceWin();
    expect(ctrl.sm.state).toBe("VICTORY");
    ctrl.forceLose();
    expect(ctrl.sm.state).toBe("DEFEAT");
  });

  it("auto-replaces target when selected enemy dies", () => {
    const enemies = createFirstBattleEnemies();
    enemies[0]!.hp = 0;
    enemies[0]!.alive = false;
    const id = selectDefaultEnemy(enemies, enemies[0]!.id);
    expect(id).toBe(enemies[1]!.id);
  });
});

describe("audio settings", () => {
  it("serializes and parses audio settings", () => {
    const json = serializeAudioSettings(DEFAULT_SAVE);
    const parsed = parseAudioSettings(json);
    expect(parsed.musicVolume).toBe(DEFAULT_SAVE.musicVolume);
  });

  it("does not duplicate track when switching scenes to same track", () => {
    AudioManager.resetInstanceForTests();
    const a = AudioManager.get();
    a.playTrack("world");
    expect(a.currentTrack).toBe("world");
    a.playTrack("world");
    expect(a.currentTrack).toBe("world");
    a.playTrack("battle");
    expect(a.currentTrack).toBe("battle");
    a.playTrack("battle_boss");
    expect(a.currentTrack).toBe("battle_boss");
    a.stopMusic();
    expect(a.currentTrack).toBe("none");
    AudioManager.resetInstanceForTests();
  });
});

describe("gem catalog", () => {
  it("has four gem types", () => {
    expect(GEM_IDS.length).toBe(4);
  });
});
