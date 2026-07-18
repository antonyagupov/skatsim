import type Phaser from "phaser";
import { AudioManager } from "../audio/AudioManager";
import type { BattleController } from "../systems/BattleController";
import type { HeroId } from "../assets/types";
import type { BuildingId } from "../systems/combat/progression";
import {
  loadSave,
  resetSave,
  updateSave,
  validateSave,
  writeSave,
  type SaveData,
} from "../data/save";
import { resetTutorial, skipAllTutorials } from "../systems/tutorial/TutorialManager";
import { spawnSpecialGemAt, createBoard } from "../systems/match3/board";
import { SPECIAL_GEM_ID } from "../assets/types";
import { createRng } from "../systems/rng";
import type { TurnLogEntry } from "../systems/BattleController";

export type DebugApi = {
  addGold: (amount: number) => void;
  addMaterials: (amount: number) => void;
  completeNode: (nodeId: string) => void;
  unlockAllNodes: () => void;
  setHeroLevel: (heroId: string, level: number) => void;
  setBuildingLevel: (buildingId: string, level: number) => void;
  fillAbility: (heroId: string) => void;
  setEnemyCountdown: (enemyId: string, value: number) => void;
  spawnSpecialGem: (color?: string) => void;
  forceMatchFour: () => void;
  forceMatchFive: () => void;
  triggerBossPhase: () => void;
  winBattle: () => void;
  loseBattle: () => void;
  resetTutorial: () => void;
  resetSave: () => void;
  dumpState: () => unknown;
  validateSave: () => unknown;
  getBattleSeed: () => number | null;
  setBattleSeed: (seed: number) => void;
  getLastTurnLog: () => TurnLogEntry[];
  // legacy aliases
  damageEnemy: (enemyId: string, amount: number) => void;
  healParty: () => void;
  regenerateBoard: () => void;
  forceCascade: () => void;
  dumpBattleState: () => unknown;
  setMusicVolume: (v: number) => void;
  setSfxVolume: (v: number) => void;
  stopAllAudio: () => void;
  skipTutorial: () => void;
};

declare global {
  interface Window {
    __SKATSIM_DEBUG__?: DebugApi;
  }
}

let battleRef: BattleController | null = null;
let sceneRef: Phaser.Scene | null = null;

export function bindBattleDebug(
  scene: Phaser.Scene,
  battle: BattleController,
): void {
  battleRef = battle;
  sceneRef = scene;
}

const NODE_FLAGS: Record<string, Partial<SaveData>> = {
  "ruins-path": { firstNodeCompleted: true, firstBattleCompleted: true },
  "forest-trail": { forestNodeCompleted: true },
  "old-quarry": { quarryNodeCompleted: true },
  "dark-cave": { caveNodeCompleted: true },
  "goblin-fortress": {
    fortressNodeCompleted: true,
    bossDefeated: true,
    chapter2Unlocked: true,
  },
  "marsh-crossing": { marshNodeCompleted: true },
  "ruined-bridge": { bridgeNodeCompleted: true },
  watchtower: { watchtowerNodeCompleted: true },
  "hollow-keep": { hollowKeepCompleted: true, endingSeen: true },
};

export function installDebugApi(game: Phaser.Game): void {
  const params = new URLSearchParams(window.location.search);
  const debugFlag =
    import.meta.env.DEV ||
    params.get("debug") === "1" ||
    localStorage.getItem("skatsim.debug") === "1";
  if (!debugFlag) return;

  const audio = AudioManager.get();
  window.__SKATSIM_DEBUG__ = {
    addGold: (amount) => {
      const s = loadSave();
      updateSave({ gold: s.gold + amount });
    },
    addMaterials: (amount) => {
      const s = loadSave();
      updateSave({ materials: s.materials + amount });
    },
    completeNode: (nodeId) => {
      const patch = NODE_FLAGS[nodeId];
      if (patch) updateSave(patch);
    },
    unlockAllNodes: () => {
      updateSave({
        firstNodeCompleted: true,
        forestNodeCompleted: true,
        quarryNodeCompleted: true,
        caveNodeCompleted: true,
        fortressNodeCompleted: true,
        bossDefeated: true,
        chapter2Unlocked: true,
        marshNodeCompleted: true,
        bridgeNodeCompleted: true,
        watchtowerNodeCompleted: true,
        hollowKeepCompleted: true,
        endingSeen: true,
        firstBattleCompleted: true,
        introSeen: true,
      });
    },
    setHeroLevel: (heroId, level) => {
      updateSave({
        heroLevels: {
          [heroId as HeroId]: Math.max(1, Math.min(3, level)),
        } as SaveData["heroLevels"],
      });
    },
    setBuildingLevel: (buildingId, level) => {
      updateSave({
        buildingLevels: {
          [buildingId as BuildingId]: Math.max(1, Math.min(2, level)),
        } as SaveData["buildingLevels"],
      });
    },
    fillAbility: (heroId) => {
      battleRef?.fillAbility(heroId as HeroId);
      sceneRef?.events.emit("debug-refresh-ui");
    },
    setEnemyCountdown: (enemyId, value) => {
      battleRef?.setEnemyCountdown(enemyId, value);
      sceneRef?.events.emit("debug-refresh-ui");
    },
    spawnSpecialGem: () => {
      if (!battleRef) return;
      battleRef.board = spawnSpecialGemAt(battleRef.board, 3, 3);
      sceneRef?.events.emit("debug-regen-board");
    },
    forceMatchFour: () => {
      sceneRef?.events.emit("debug-force-match-four");
    },
    forceMatchFive: () => {
      sceneRef?.events.emit("debug-force-match-five");
    },
    triggerBossPhase: () => {
      battleRef?.triggerBossPhase();
      sceneRef?.events.emit("debug-refresh-ui");
    },
    winBattle: () => {
      battleRef?.forceWin();
      const encounterId =
        (sceneRef as { encounterId?: string } | null)?.encounterId ?? "ruins";
      sceneRef?.scene.start("Rewards", {
        damageDealt: battleRef?.totalDamageDealt ?? 999,
        encounterId,
      });
    },
    loseBattle: () => {
      battleRef?.forceLose();
      sceneRef?.scene.start("World");
    },
    resetTutorial: () => {
      resetTutorial();
    },
    skipTutorial: () => {
      skipAllTutorials();
    },
    resetSave: () => {
      resetSave();
    },
    dumpState: () => ({
      save: loadSave(),
      battle: battleRef
        ? {
            seed: battleRef.seed,
            state: battleRef.sm.state,
            heroes: battleRef.heroes,
            enemies: battleRef.enemies,
            selected: battleRef.selectedEnemyId,
            extraMoves: battleRef.extraMovesRemaining,
            board: battleRef.board,
            lastTurnLog: battleRef.lastTurnLog,
          }
        : null,
    }),
    getBattleSeed: () => battleRef?.seed ?? null,
    setBattleSeed: (seed) => {
      if (!battleRef) return;
      battleRef.setSeed(seed);
      battleRef.board = createBoard(createRng(seed));
      sceneRef?.events.emit("debug-regen-board");
    },
    getLastTurnLog: () => battleRef?.lastTurnLog ?? [],
    validateSave: () => validateSave(loadSave()),
    damageEnemy: (enemyId, amount) => {
      if (!battleRef) return;
      battleRef.enemies = battleRef.enemies.map((e) =>
        e.id === enemyId
          ? {
              ...e,
              hp: Math.max(0, e.hp - amount),
              alive: e.hp - amount > 0,
            }
          : e,
      );
    },
    healParty: () => {
      if (!battleRef) return;
      battleRef.heroes = battleRef.heroes.map((h) => ({
        ...h,
        hp: h.maxHp,
        shield: 0,
        alive: true,
      }));
    },
    regenerateBoard: () => {
      if (battleRef) {
        battleRef.board = createBoard(battleRef.rng);
      }
      sceneRef?.events.emit("debug-regen-board");
    },
    forceCascade: () => {
      sceneRef?.events.emit("debug-force-cascade");
    },
    dumpBattleState: () => window.__SKATSIM_DEBUG__?.dumpState(),
    setMusicVolume: (v) => audio.setMusicVolume(v),
    setSfxVolume: (v) => audio.setSfxVolume(v),
    stopAllAudio: () => audio.stopAll(),
  };

  const dumpDebug = (): void => {
    console.info(
      "%c[Skatsim Debug]",
      "color:#40ffc0;font-weight:bold",
      window.__SKATSIM_DEBUG__,
    );
    console.info(window.__SKATSIM_DEBUG__?.dumpState());
    console.info(
      "Examples: __SKATSIM_DEBUG__.unlockAllNodes()  |  .addGold(500)  |  .winBattle()",
    );
  };

  // Alt+Shift+D — Ctrl+Shift+D is stolen by Cursor/VS Code "Run and Debug"
  window.addEventListener("keydown", (ev) => {
    if (ev.altKey && ev.shiftKey && ev.key.toLowerCase() === "d") {
      ev.preventDefault();
      dumpDebug();
    }
  });

  console.info(
    "%c[Skatsim] Debug API ready — Alt+Shift+D (or type __SKATSIM_DEBUG__ in console)",
    "color:#40ffc0",
  );
  void game;
  void SPECIAL_GEM_ID;
  void writeSave;
}
