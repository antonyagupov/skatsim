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
import {
  GEM_IDS,
  LINE_GEM_H,
  SPECIAL_GEM_ID,
  type GemId,
} from "../src/assets/types";
import { createParty, HERO_DEFS } from "../src/systems/combat/heroes";
import {
  applyStatus,
  createFirstBattleEnemies,
  createEncounterEnemies,
  resetEnemyInstanceCounter,
  tickStatuses,
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
import { BATTLE_LAYOUT, MAP_EDGES_DESKTOP, MAP_EDGES_MOBILE, MAP_NODES, isNodeUnlocked } from "../src/data/mapNodes";
import { MOBILE_MAP_LAYOUT } from "../src/data/mapLayout";
import {
  allBattleSubtitleIds,
  validateMapLayout,
} from "../src/data/mapLayoutValidate";
import {
  battleLayoutFor,
  pickLayoutProfile,
  resolveGameSize,
} from "../src/ui/layoutProfile";
import {
  computeBattleRewards,
  computeDefeatRewards,
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
  tutorialCandidatesForEncounter,
  CORE_LOOP_STEPS,
} from "../src/systems/tutorial/TutorialManager";
import { createRng } from "../src/systems/rng";
import { DialogueRunner } from "../src/systems/dialogue/DialogueRunner";

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

  it("picks mobile profile for tall canvases", () => {
    expect(pickLayoutProfile(960, 720)).toBe("desktop");
    expect(pickLayoutProfile(420, 760)).toBe("mobile");
    expect(resolveGameSize(390, 844).height).toBeGreaterThan(
      resolveGameSize(390, 844).width,
    );
    expect(resolveGameSize(1280, 800)).toEqual({ width: 960, height: 720 });
    expect(battleLayoutFor("mobile").partySide).toBe("bottom");
    expect(battleLayoutFor("mobile").enemySide).toBe("top");
  });

  it("unlocks hollow keep after watchtower", () => {
    const hollow = MAP_NODES.find((n) => n.id === "hollow-keep")!;
    expect(hollow.kind).toBe("ending");
    expect(hollow.sceneKey).toBe("Ending");
    const save = { ...DEFAULT_SAVE, watchtowerNodeCompleted: true };
    expect(isNodeUnlocked(hollow, save)).toBe(true);
    expect(isNodeUnlocked(hollow, DEFAULT_SAVE)).toBe(false);
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

  it("spawns a line gem on match of four", () => {
    const swap = trySwap(craftedMatchFourBoard(), 0, 0, 1, 0);
    expect(swap.ok).toBe(true);
    if (!swap.ok) return;
    const resolved = resolveBoard(swap.board, () => 0.2);
    expect(resolved.matchFourOccurred).toBe(true);
    const created = resolved.steps.some(
      (s) => s.createdSpecial?.kind === "line-h" || s.createdSpecial?.kind === "line-v",
    );
    expect(created).toBe(true);
  });

  it("activating a line gem clears the axis", () => {
    const board = craftedMatchBoard();
    const withLine = spawnSpecialGemAt(board, 3, 3, "line-h");
    expect(withLine[3]![3]).toBe(LINE_GEM_H);
    const swap = trySwap(withLine, 3, 3, 3, 4);
    expect(swap.ok).toBe(true);
    if (!swap.ok) return;
    expect(swap.lineClear?.axis).toBe("h");
    const resolved = resolveBoard(swap.board, () => 0.35, undefined, swap.lineClear);
    expect(resolved.lineActivations).toBe(1);
    expect(resolved.steps[0]?.lineClearedCells?.length).toBe(BOARD_SIZE);
  });
});

describe("defeat consolation", () => {
  it("returns ~15% of win rewards", () => {
    const win = computeBattleRewards("ruins", 1);
    const loss = computeDefeatRewards("ruins", 1);
    expect(loss.gold).toBe(Math.max(1, Math.round(win.gold * 0.15)));
    expect(loss.materials).toBe(Math.max(0, Math.round(win.materials * 0.15)));
  });
});

describe("status effects", () => {
  it("burn deals DoT on tick", () => {
    resetEnemyInstanceCounter();
    let enemy = createFirstBattleEnemies()[0]!;
    enemy = applyStatus(enemy, { id: "burn", turns: 2, potency: 12 });
    const ticked = tickStatuses(enemy);
    expect(ticked.burnDamage).toBe(12);
    expect(ticked.enemy.statuses.some((s) => s.id === "burn" && s.turns === 1)).toBe(true);
  });

  it("freeze blocks the next attack", () => {
    resetEnemyInstanceCounter();
    const enemies = createFirstBattleEnemies().map((e) => ({
      ...e,
      hp: 5000,
      maxHp: 5000,
      countdown: 1,
      statuses: [{ id: "freeze" as const, turns: 1 }],
    }));
    const ctrl = new BattleController(createParty(), enemies, craftedMatchBoard());
    const res = ctrl.attemptSwap(0, 0, 1, 0, () => 0.25);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.turn.attacks.some((a) => a.kind === "status_freeze_block")).toBe(true);
    expect(res.turn.attacks.some((a) => a.kind === "enemy_attack")).toBe(false);
  });
});

describe("survive objective", () => {
  it("wins after N enemy phases with heroes alive", () => {
    resetEnemyInstanceCounter();
    const enemies = createFirstBattleEnemies().map((e) => ({
      ...e,
      hp: 5000,
      maxHp: 5000,
      attack: 0,
      countdown: 99,
    }));
    const ctrl = new BattleController(createParty(), enemies, craftedMatchBoard(), {
      objective: { type: "survive", turns: 2 },
    });
    const a = ctrl.attemptSwap(0, 0, 1, 0, () => 0.25);
    expect(a.ok).toBe(true);
    if (!a.ok) return;
    expect(a.turn.outcome).toBe("ongoing");
    expect(ctrl.surviveTurnsElapsed).toBe(1);
    ctrl.extraMovesRemaining = 0;
    ctrl.extraMoveStreak = 0;
    ctrl.board = craftedMatchBoard();
    const b = ctrl.attemptSwap(0, 0, 1, 0, () => 0.3);
    expect(b.ok).toBe(true);
    if (!b.ok) return;
    expect(ctrl.surviveTurnsElapsed).toBe(2);
    expect(b.turn.outcome).toBe("victory");
  });

  it("watchtower map node advertises survive", () => {
    const node = MAP_NODES.find((n) => n.encounterId === "watchtower");
    expect(node?.objectivePreview).toBe("Survive 6 turns");
  });
});

describe("dialogue runner", () => {
  it("advances and skips lines", () => {
    const runner = new DialogueRunner([
      { speaker: "A", portraitKey: null, text: "one" },
      { speaker: "B", portraitKey: null, text: "two" },
    ]);
    expect(runner.current?.text).toBe("one");
    expect(runner.advance()?.text).toBe("two");
    expect(runner.advance()).toBeNull();
    expect(runner.done).toBe(true);
    runner.reset();
    runner.skip();
    expect(runner.done).toBe(true);
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
    expect(MAP_NODES.filter((n) => n.kind === "battle").length).toBe(8);
    const marsh = MAP_NODES.find((n) => n.id === "marsh-crossing")!;
    expect(isNodeUnlocked(marsh, save)).toBe(false);
    save.chapter2Unlocked = true;
    expect(isNodeUnlocked(marsh, save)).toBe(true);
  });

  it("uses village→marsh on desktop and fortress→marsh on mobile", () => {
    expect(MAP_EDGES_DESKTOP).toContainEqual(["village", "marsh-crossing"]);
    expect(MAP_EDGES_DESKTOP).not.toContainEqual(["goblin-fortress", "marsh-crossing"]);
    expect(MAP_EDGES_MOBILE).toContainEqual(["goblin-fortress", "marsh-crossing"]);
    expect(MAP_EDGES_MOBILE).not.toContainEqual(["village", "marsh-crossing"]);
  });

  it("has a collision-free mobile layout at 420×760", () => {
    const collisions = validateMapLayout(MOBILE_MAP_LAYOUT, {
      width: 420,
      height: 760,
      mobile: true,
      subtitleIds: allBattleSubtitleIds(),
    });
    expect(collisions).toEqual([]);
  });
});

describe("rewards and economy", () => {
  it("grants encounter rewards and mine multiplier", () => {
    expect(ENCOUNTER_REWARDS.ruins.gold).toBe(40);
    expect(ENCOUNTER_REWARDS.fortress.materials).toBe(4);
    expect(ENCOUNTER_REWARDS.watchtower.gold).toBe(180);
    expect(goldRewardMultiplier(1)).toBe(1);
    expect(goldRewardMultiplier(2)).toBe(1.2);
    const boosted = computeBattleRewards("ruins", 2);
    expect(boosted.gold).toBe(Math.round(40 * 1.2));
  });

  it("scales hero levels and workshop potion", () => {
    const l1 = scaledHeroStats("hero-warrior", 1);
    const l3 = scaledHeroStats("hero-warrior", 3);
    expect(l3.maxHp).toBeGreaterThan(l1.maxHp);
    // +22% per level above 1 → Lv3 ≈ ×1.44
    expect(l3.maxHp).toBe(Math.round(l1.maxHp * 1.44));
    expect(potionHealFraction(1)).toBe(0.3);
    expect(potionHealFraction(2)).toBe(0.45);
  });

  it("creates chapter 2 encounters with wraith", () => {
    const marsh = createEncounterEnemies("marsh");
    expect(marsh.some((e) => e.typeId === "enemy-wraith")).toBe(true);
    const tower = createEncounterEnemies("watchtower");
    expect(tower.length).toBe(3);
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
    expect(migrated.version).toBe(5);
    expect(migrated.firstNodeCompleted).toBe(true);
    expect(migrated.hollowKeepCompleted).toBe(false);
    expect(migrated.endingSeen).toBe(false);
    expect(migrated.gold).toBe(0);
    expect(migrated.introSeen).toBe(false);
    expect(migrated.memoryWipes).toBe(0);
    expect(migrated.heroLevels["hero-warrior"]).toBe(1);
    expect(migrateSave(null).version).toBe(5);
    expect(migrateSave(undefined).gold).toBe(0);
    expect(validateSave(migrated).ok).toBe(true);
    expect(validateSave("bad").ok).toBe(false);
  });
});

describe("memory wipe difficulty", () => {
  it("scales enemy stats with memory wipe count", () => {
    resetEnemyInstanceCounter();
    const base = createEncounterEnemies("ruins", 0)[0]!;
    const hard = createEncounterEnemies("ruins", 2)[0]!;
    expect(hard.maxHp).toBe(Math.round(base.maxHp * 1.3));
    expect(hard.attack).toBe(Math.round(base.attack * 1.3));
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
    // Core loop marks all three first steps together
    expect(after.tutorialSteps.select_enemy).toBe(true);
    expect(after.tutorialSteps.swap_gems).toBe(true);
    expect(after.tutorialSteps.color_heroes).toBe(true);
    resetTutorial();
    globalThis.localStorage = orig;
  });
});

describe("seeded rng", () => {
  it("mulberry32 is deterministic for the same seed", () => {
    const a = createRng(42);
    const b = createRng(42);
    const seqA = [a(), a(), a(), a(), a()];
    const seqB = [b(), b(), b(), b(), b()];
    expect(seqA).toEqual(seqB);
    expect(createRng(1)()).not.toBe(createRng(2)());
  });

  it("same battle seed yields identical starting boards", () => {
    const seed = 123456;
    const boardA = createBoard(createRng(seed));
    const boardB = createBoard(createRng(seed));
    expect(boardA).toEqual(boardB);
  });

  it("attemptSwap records a turn log", () => {
    resetEnemyInstanceCounter();
    const enemies = createFirstBattleEnemies();
    enemies.forEach((e) => {
      e.maxHp = 5000;
      e.hp = 5000;
    });
    const ctrl = new BattleController(createParty(), enemies, craftedMatchFourBoard(), {
      seed: 99,
    });
    const res = ctrl.attemptSwap(0, 0, 1, 0, () => 0.25);
    expect(res.ok).toBe(true);
    expect(ctrl.lastTurnLog.some((e) => e.type === "swap")).toBe(true);
    expect(ctrl.lastTurnLog.some((e) => e.type === "resolve_step")).toBe(true);
    expect(ctrl.lastTurnLog.some((e) => e.type === "outcome")).toBe(true);
  });
});

describe("chapter 1 balance curve", () => {
  it("cave encounter is a 2-enemy breather", () => {
    resetEnemyInstanceCounter();
    const cave = createEncounterEnemies("cave");
    expect(cave).toHaveLength(2);
    expect(cave.map((e) => e.name).sort()).toEqual(["Cave Slime", "Shadow Bat"].sort());
  });

  it("ruins enemies are softer than quarry armored goblin", () => {
    resetEnemyInstanceCounter();
    const ruins = createEncounterEnemies("ruins");
    const quarry = createEncounterEnemies("quarry");
    const ruinsEhp = ruins.reduce((s, e) => s + e.maxHp + e.armor, 0);
    const quarryEhp = quarry.reduce((s, e) => s + e.maxHp + e.armor, 0);
    expect(ruins[0]!.maxHp).toBe(150);
    expect(quarryEhp).toBeGreaterThan(ruinsEhp);
    expect(ENCOUNTER_REWARDS.cave.gold).toBe(120);
    expect(ENCOUNTER_REWARDS.cave.materials).toBe(3);
  });

  it("boss and ch2 enemies have raised HP for longer fights", () => {
    resetEnemyInstanceCounter();
    const boss = createEncounterEnemies("fortress")[0]!;
    expect(boss.maxHp).toBe(900);
    const wraith = createEncounterEnemies("marsh").find((e) => e.typeId === "enemy-wraith")!;
    expect(wraith.maxHp).toBe(320);
  });
});

describe("tutorial encounter gating", () => {
  it("gates candidates by encounter", () => {
    expect(tutorialCandidatesForEncounter("ruins")).toEqual(CORE_LOOP_STEPS);
    expect(tutorialCandidatesForEncounter("forest")).toEqual(["enemy_countdown"]);
    expect(tutorialCandidatesForEncounter("quarry")).toEqual(["match_four"]);
    expect(tutorialCandidatesForEncounter("cave")).toEqual(["ability_ready"]);
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
