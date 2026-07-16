import Phaser from "phaser";
import { AudioManager } from "../audio/AudioManager";
import {
  HERO_IDS,
  SPECIAL_GEM_ID,
  type HeroId,
  type BoardGemId,
} from "../assets/types";
import { createBoard, BOARD_SIZE, isSpecialGem } from "../systems/match3/board";
import { createParty } from "../systems/combat/heroes";
import { createEncounterEnemies, type EnemyRuntime } from "../systems/combat/enemies";
import { BattleController, type AttackEvent } from "../systems/BattleController";
import { bindBattleDebug } from "../debug/debugApi";
import { loadSave } from "../data/save";
import { BATTLE_LAYOUT } from "../data/mapNodes";
import { elementColor } from "../systems/combat/elements";
import { potionHealFraction } from "../systems/combat/progression";
import {
  TUTORIAL_COPY,
  markTutorialStep,
  nextPendingStep,
  type TutorialStepId,
} from "../systems/tutorial/TutorialManager";
import { addAudioControls } from "../ui/AudioControls";

type GemSprite = Phaser.GameObjects.Image & {
  boardR: number;
  boardC: number;
  prismaticOverlay?: Phaser.GameObjects.Arc;
};

type HeroHudPanel = {
  id: HeroId;
  root: Phaser.GameObjects.Container;
  portrait: Phaser.GameObjects.Image;
  hpGfx: Phaser.GameObjects.Graphics;
  chargeGfx: Phaser.GameObjects.Graphics;
  shieldGfx: Phaser.GameObjects.Graphics;
  glow: Phaser.GameObjects.Rectangle;
};

type BattleInitData = { encounterId?: string };

const BATTLE_TUTORIAL: TutorialStepId[] = [
  "select_enemy",
  "swap_gems",
  "color_heroes",
  "enemy_countdown",
  "match_four",
  "ability_ready",
];

export class BattleScene extends Phaser.Scene {
  private battle!: BattleController;
  private audio = AudioManager.get();
  private gemSprites: (GemSprite | null)[][] = [];
  private heroSprites = new Map<HeroId, Phaser.GameObjects.Image>();
  private enemySprites = new Map<string, Phaser.GameObjects.Image>();
  private heroHud = new Map<HeroId, HeroHudPanel>();
  private enemyBars = new Map<string, Phaser.GameObjects.Graphics>();
  private countdownBadges = new Map<string, Phaser.GameObjects.Text>();
  private heroHome = new Map<HeroId, { x: number; y: number; w: number; h: number }>();
  private enemyHome = new Map<string, { x: number; y: number; w: number; h: number }>();
  private targetMarker!: Phaser.GameObjects.Ellipse;
  private cascadeText!: Phaser.GameObjects.Text;
  private stateText!: Phaser.GameObjects.Text;
  private toastText!: Phaser.GameObjects.Text;
  private tutorialRoot?: Phaser.GameObjects.Container;
  private potionBtn?: Phaser.GameObjects.Text;
  private boardOrigin = { x: 0, y: 0 };
  private hudStripY = 0;
  private cell = 48;
  private selected: { r: number; c: number } | null = null;
  private dragStart: { r: number; c: number } | null = null;
  private fieldH = 0;
  private busy = false;
  private debugVisible = false;
  private potionMode = false;
  private encounterId = "ruins";
  private currentTutorial: TutorialStepId | null = null;
  private tutorialAbilityShown = false;
  private listenersBound = false;

  constructor() {
    super("Battle");
  }

  init(data: BattleInitData): void {
    this.encounterId = data?.encounterId ?? "ruins";
    this.busy = false;
    this.selected = null;
    this.dragStart = null;
    this.potionMode = false;
    this.debugVisible = false;
    this.currentTutorial = null;
    this.tutorialAbilityShown = false;
    this.gemSprites = [];
    this.heroSprites.clear();
    this.enemySprites.clear();
    this.heroHud.clear();
    this.enemyBars.clear();
    this.countdownBadges.clear();
    this.heroHome.clear();
    this.enemyHome.clear();
  }

  create(): void {
    this.busy = false;
    this.selected = null;
    this.dragStart = null;
    this.tweens.killAll();
    this.time.removeAllEvents();

    void this.audio.unlock().then(() => {
      this.audio.playTrack(
        this.encounterId === "fortress" ? "battle_boss" : "battle",
      );
    });

    const save = loadSave();
    const { width, height } = this.scale;
    this.fieldH = Math.floor(height * BATTLE_LAYOUT.fieldFraction);

    this.battle = new BattleController(
      createParty(save.heroLevels),
      createEncounterEnemies(this.encounterId),
      createBoard(),
      { potionHealFraction: potionHealFraction(save.buildingLevels.workshop) },
    );
    bindBattleDebug(this, this.battle);

    this.drawBattlefield(width);
    this.layoutCombatants(width);
    this.layoutHeroHudStrip(width);
    this.layoutBoard(width, height);
    this.layoutChrome(width, save);
    this.refreshAll();
    this.syncTargetMarker();
    this.rebuildGemSprites();
    this.showBattleTutorial();

    this.input.off("pointerdown", this.onPointerDown, this);
    this.input.off("pointerup", this.onPointerUp, this);
    this.input.on("pointerdown", this.onPointerDown, this);
    this.input.on("pointerup", this.onPointerUp, this);
    this.listenersBound = true;

    this.events.off("debug-regen-board");
    this.events.on("debug-regen-board", () => {
      this.rebuildGemSprites();
      this.refreshAll();
    });
    this.events.off("debug-refresh-ui");
    this.events.on("debug-refresh-ui", () => this.refreshAll());

    this.input.keyboard?.off("keydown-D");
    this.input.keyboard?.on("keydown-D", (ev: KeyboardEvent) => {
      if (ev.ctrlKey && ev.shiftKey) {
        this.debugVisible = !this.debugVisible;
        this.stateText.setVisible(this.debugVisible);
      }
    });

    this.game.canvas.style.userSelect = "none";
    this.game.canvas.style.touchAction = "none";
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.onShutdown());
  }

  private onShutdown(): void {
    this.busy = false;
    this.tweens.killAll();
    this.time.removeAllEvents();
    if (this.listenersBound) {
      this.input.off("pointerdown", this.onPointerDown, this);
      this.input.off("pointerup", this.onPointerUp, this);
      this.listenersBound = false;
    }
  }

  private drawBattlefield(width: number): void {
    const bgKey =
      this.encounterId === "fortress" && this.textures.exists("battle-boss-bg")
        ? "battle-boss-bg"
        : "battle-screen-ref";
    if (this.textures.exists(bgKey)) {
      this.add
        .image(width / 2, this.fieldH / 2, bgKey)
        .setDisplaySize(width, this.fieldH);
    } else {
      this.add.rectangle(
        width / 2,
        this.fieldH / 2,
        width,
        this.fieldH,
        this.encounterId === "fortress" ? 0x2a1a28 : 0x3a6a8a,
      );
    }
    this.add.rectangle(width / 2, this.fieldH - 20, width, 40, 0x0a0810, 0.35);
    this.add.rectangle(width / 2, this.fieldH + 2, width, 4, 0x3a3044);
  }

  private layoutCombatants(width: number): void {
    const heroX = width * BATTLE_LAYOUT.partyX;
    const heroSize = 68;
    HERO_IDS.forEach((id, i) => {
      const y = 64 + i * ((this.fieldH - 90) / 3.5);
      const x = heroX + (i % 2) * 14;
      this.add.ellipse(x, y + 32, 44, 12, 0x000000, 0.35);
      const spr = this.add
        .image(x, y, id)
        .setDisplaySize(heroSize, heroSize)
        .setInteractive({ useHandCursor: true });
      this.heroSprites.set(id, spr);
      this.heroHome.set(id, { x, y, w: heroSize, h: heroSize });
      spr.on("pointerdown", () => this.onHeroTapped(id));
    });

    const enemyX = width * BATTLE_LAYOUT.enemyX;
    this.battle.enemies.forEach((e, i) => this.spawnEnemyVisual(e, enemyX, i));

    this.targetMarker = this.add
      .ellipse(0, 0, 88, 26, 0xf0c050, 0.15)
      .setStrokeStyle(2, 0xf0c050)
      .setVisible(false);
  }

  private enemyY(index: number, total: number): number {
    const span = this.fieldH - 100;
    const step = total <= 1 ? 0 : span / (total - 1);
    return 90 + index * Math.min(step, 110);
  }

  private spawnEnemyVisual(enemy: EnemyRuntime, enemyX: number, index?: number): void {
    const idx = index ?? this.enemySprites.size;
    const total = Math.max(this.battle.enemies.length, idx + 1);
    const y = this.enemyY(idx, total);
    const size = enemy.isBoss ? 88 : enemy.textureKey.includes("bat") ? 66 : 74;

    this.add.ellipse(enemyX, y + 32, 50, 14, 0x000000, 0.35);
    const key = this.textures.exists(enemy.textureKey) ? enemy.textureKey : "enemy-slime";
    const spr = this.add
      .image(enemyX, y, key)
      .setDisplaySize(size, size)
      .setInteractive({ useHandCursor: true });
    this.enemySprites.set(enemy.id, spr);
    this.enemyHome.set(enemy.id, { x: enemyX, y, w: size, h: size });
    this.enemyBars.set(enemy.id, this.add.graphics());

    const badge = this.add
      .text(enemyX, y - 44, String(enemy.countdown), {
        fontFamily: "monospace",
        fontSize: "22px",
        color: "#1a1008",
        backgroundColor: "#f0c050",
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5);
    this.countdownBadges.set(enemy.id, badge);

    spr.on("pointerdown", () => {
      if (this.busy || !this.battle.acceptsInput) return;
      this.battle.selectEnemy(enemy.id);
      this.audio.sfx("ui_click");
      this.syncTargetMarker();
      this.completeTutorialStep("select_enemy");
    });
  }

  private layoutBoard(width: number, height: number): void {
    const boardAreaTop = this.hudStripY + 52;
    const boardAreaH = height - boardAreaTop - 44;
    const maxCell = BATTLE_LAYOUT.maxGemCell;
    this.cell = Math.min(
      maxCell,
      Math.floor(Math.min((width - 120) / BOARD_SIZE, boardAreaH / BOARD_SIZE)),
    );
    const boardW = this.cell * BOARD_SIZE;
    const boardH = this.cell * BOARD_SIZE;
    this.boardOrigin = {
      x: Math.floor((width - boardW) / 2),
      y: boardAreaTop + Math.floor((boardAreaH - boardH) / 2),
    };

    this.add
      .rectangle(
        this.boardOrigin.x + boardW / 2,
        this.boardOrigin.y + boardH / 2,
        boardW + 10,
        boardH + 10,
        0x1a1528,
      )
      .setStrokeStyle(2, 0x3a3044);

    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        this.add
          .rectangle(
            this.boardOrigin.x + c * this.cell + this.cell / 2,
            this.boardOrigin.y + r * this.cell + this.cell / 2,
            this.cell - 2,
            this.cell - 2,
            0x2a2238,
          )
          .setOrigin(0.5);
      }
    }
  }

  private layoutHeroHudStrip(width: number): void {
    this.hudStripY = this.fieldH + 10;
    const panelW = Math.min(88, Math.floor((width - 48) / 4));
    const panelH = 44;
    const gap = 6;
    const totalW = panelW * 4 + gap * 3;
    let x = Math.floor((width - totalW) / 2);

    HERO_IDS.forEach((id) => {
      const root = this.add.container(x, this.hudStripY);
      const bg = this.add
        .rectangle(0, 0, panelW, panelH, 0x1a1528)
        .setOrigin(0, 0)
        .setStrokeStyle(1, 0x3a3044);
      const glow = this.add
        .rectangle(-2, -2, panelW + 4, panelH + 4, 0xf0c050, 0)
        .setOrigin(0, 0)
        .setStrokeStyle(2, 0xf0c050, 0);
      const portraitKey = this.textures.exists(`${id}-portrait`) ? `${id}-portrait` : id;
      const portrait = this.add
        .image(6, 4, portraitKey)
        .setOrigin(0, 0)
        .setDisplaySize(28, 28);
      const hpGfx = this.add.graphics();
      const chargeGfx = this.add.graphics();
      const shieldGfx = this.add.graphics();
      root.add([glow, bg, portrait, hpGfx, chargeGfx, shieldGfx]);
      root.setSize(panelW, panelH);
      root.setInteractive(new Phaser.Geom.Rectangle(0, 0, panelW, panelH), Phaser.Geom.Rectangle.Contains);
      root.on("pointerdown", () => this.onHeroTapped(id));

      this.heroHud.set(id, { id, root, portrait, hpGfx, chargeGfx, shieldGfx, glow });
      x += panelW + gap;
    });
  }

  private layoutChrome(width: number, _save: ReturnType<typeof loadSave>): void {
    const y = this.scale.height - 24;
    const btnStyle = {
      fontFamily: "monospace",
      fontSize: "14px",
      color: "#f2e9d8",
      backgroundColor: "#2a2238",
      padding: { x: 8, y: 5 },
    };

    addAudioControls(this);

    if (this.battle.potionAvailable) {
      this.potionBtn = this.add
        .text(130, y, "Potion", {
          ...btnStyle,
          color: "#1a1008",
          backgroundColor: "#6a9c5a",
        })
        .setOrigin(0, 0.5)
        .setInteractive({ useHandCursor: true });
      this.potionBtn.on("pointerdown", () => {
        if (this.busy || !this.battle.potionAvailable) return;
        this.potionMode = !this.potionMode;
        this.potionBtn?.setBackgroundColor(this.potionMode ? "#f0c050" : "#6a9c5a");
        this.audio.sfx("ui_click");
      });
    }

    this.add
      .text(width - 12, y, "Map", {
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#1a1008",
        backgroundColor: "#c8b090",
        padding: { x: 10, y: 5 },
      })
      .setOrigin(1, 0.5)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => {
        this.busy = false;
        this.audio.sfx("ui_click");
        this.audio.playTrack("world");
        this.scene.start("World");
      });

    this.cascadeText = this.add
      .text(width / 2, this.boardOrigin.y - 14, "", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#f0c050",
      })
      .setOrigin(0.5, 1);

    this.toastText = this.add
      .text(width / 2, this.fieldH + 2, "", {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#f2e9d8",
        backgroundColor: "#2a2238aa",
        padding: { x: 10, y: 6 },
      })
      .setOrigin(0.5, 0)
      .setVisible(false);

    this.stateText = this.add
      .text(width - 12, 10, "", {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#88aa88",
      })
      .setOrigin(1, 0)
      .setVisible(false);
  }

  private onHeroTapped(id: HeroId): void {
    if (this.busy || !this.battle.acceptsInput) return;
    if (this.potionMode) {
      void this.tryUsePotion(id);
      return;
    }
    const hero = this.battle.heroes.find((h) => h.id === id);
    if (hero && hero.alive && hero.charge >= hero.abilityCost) {
      void this.runAbility(id);
    }
  }

  private async tryUsePotion(heroId: HeroId): Promise<void> {
    const res = this.battle.usePotion(heroId);
    if (!res.ok) return;
    this.potionMode = false;
    this.potionBtn?.setBackgroundColor("#6a9c5a").setVisible(false);
    this.audio.sfx("ability_use");
    const panel = this.heroHud.get(heroId);
    if (panel) this.floatText(panel.root.x + 44, panel.root.y - 8, `+${res.heal}`, "#88ffaa");
    this.refreshAll();
  }

  private cellCenter(r: number, c: number): { x: number; y: number } {
    return {
      x: this.boardOrigin.x + c * this.cell + this.cell / 2,
      y: this.boardOrigin.y + r * this.cell + this.cell / 2,
    };
  }

  private pointerToCell(x: number, y: number): { r: number; c: number } | null {
    const c = Math.floor((x - this.boardOrigin.x) / this.cell);
    const r = Math.floor((y - this.boardOrigin.y) / this.cell);
    if (r < 0 || c < 0 || r >= BOARD_SIZE || c >= BOARD_SIZE) return null;
    return { r, c };
  }

  private gemDisplaySize(selected = false): number {
    const base = this.cell - 8;
    return selected ? Math.floor(base * 1.1) : base;
  }

  private rebuildGemSprites(): void {
    for (const row of this.gemSprites) {
      for (const g of row) {
        g?.prismaticOverlay?.destroy();
        g?.destroy();
      }
    }
    this.gemSprites = Array.from({ length: BOARD_SIZE }, () =>
      Array.from({ length: BOARD_SIZE }, () => null),
    );
    const size = this.gemDisplaySize(false);
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const gem = this.battle.board[r]![c] as BoardGemId;
        const { x, y } = this.cellCenter(r, c);
        const spr = this.createGemSprite(x, y, gem, size, r, c);
        this.gemSprites[r]![c] = spr;
      }
    }
  }

  private createGemSprite(
    x: number,
    y: number,
    gem: BoardGemId,
    size: number,
    r: number,
    c: number,
  ): GemSprite {
    let texture = gem;
    let overlay: Phaser.GameObjects.Arc | undefined;
    if (isSpecialGem(gem)) {
      if (this.textures.exists(SPECIAL_GEM_ID)) {
        texture = SPECIAL_GEM_ID;
      } else {
        texture = "gem-flame";
        overlay = this.add.circle(x, y, size * 0.42, 0xffffff, 0.35);
        overlay.setStrokeStyle(2, 0xe0a0ff);
      }
    }
    const spr = this.add
      .image(x, y, texture)
      .setDisplaySize(size, size) as GemSprite;
    if (isSpecialGem(gem) && !this.textures.exists(SPECIAL_GEM_ID)) {
      spr.setTint(0xd8a0ff);
    }
    spr.boardR = r;
    spr.boardC = c;
    spr.prismaticOverlay = overlay;
    return spr;
  }

  private setGemSelected(r: number, c: number, selected: boolean): void {
    const spr = this.gemSprites[r]?.[c];
    if (!spr) return;
    const size = this.gemDisplaySize(selected);
    spr.setDisplaySize(size, size);
    spr.prismaticOverlay?.setRadius(size * 0.42);
  }

  private resetActorSprite(
    spr: Phaser.GameObjects.Image,
    home: { x: number; y: number; w: number; h: number },
  ): void {
    spr.setPosition(home.x, home.y).setDisplaySize(home.w, home.h);
  }

  private refreshAll(): void {
    this.refreshHeroField();
    this.refreshHeroHud();
    this.refreshEnemies();
    this.stateText.setText(this.battle.sm.state);
    this.checkAbilityTutorial();
  }

  private refreshHeroField(): void {
    HERO_IDS.forEach((id) => {
      const hero = this.battle.heroes.find((h) => h.id === id)!;
      const spr = this.heroSprites.get(id)!;
      const home = this.heroHome.get(id)!;
      this.resetActorSprite(spr, home);
      spr.setAlpha(hero.alive ? 1 : 0.3);
      spr.setTint(hero.alive ? 0xffffff : 0x888888);
    });
  }

  private refreshHeroHud(): void {
    HERO_IDS.forEach((id) => {
      const hero = this.battle.heroes.find((h) => h.id === id)!;
      const panel = this.heroHud.get(id)!;
      const ready = hero.alive && hero.charge >= hero.abilityCost;
      panel.glow.setFillStyle(0xf0c050, ready ? 0.12 : 0);
      panel.glow.setStrokeStyle(2, 0xf0c050, ready ? 0.85 : 0);
      panel.portrait.setAlpha(hero.alive ? 1 : 0.35);

      const barX = 38;
      const barW = 44;
      panel.hpGfx.clear();
      panel.hpGfx.fillStyle(0x221818, 0.95);
      panel.hpGfx.fillRect(barX, 8, barW, 5);
      panel.hpGfx.fillStyle(hero.alive ? 0x5ad46a : 0x555555, 1);
      panel.hpGfx.fillRect(barX, 8, barW * (hero.hp / hero.maxHp), 5);

      panel.chargeGfx.clear();
      panel.chargeGfx.fillStyle(0x333344, 1);
      panel.chargeGfx.fillRect(barX, 16, barW, 3);
      panel.chargeGfx.fillStyle(ready ? 0xf0c050 : 0x5a8cff, 1);
      panel.chargeGfx.fillRect(barX, 16, barW * Math.min(1, hero.charge / hero.abilityCost), 3);

      panel.shieldGfx.clear();
      if (hero.shield > 0) {
        panel.shieldGfx.fillStyle(0x88ccff, 0.9);
        panel.shieldGfx.fillRect(barX, 22, barW, 2);
      }
    });
  }

  private refreshEnemies(): void {
    for (const enemy of this.battle.enemies) {
      const spr = this.enemySprites.get(enemy.id);
      const g = this.enemyBars.get(enemy.id);
      const home = this.enemyHome.get(enemy.id);
      const badge = this.countdownBadges.get(enemy.id);
      if (!spr || !g || !home) continue;
      this.resetActorSprite(spr, home);
      g.clear();
      if (!enemy.alive) {
        spr.setAlpha(0.22);
        badge?.setVisible(false);
        continue;
      }
      spr.setAlpha(1);
      badge?.setVisible(true).setText(String(Math.max(0, enemy.countdown)));
      const w = 58;
      const x = home.x - w / 2;
      const y = home.y - 46;
      g.fillStyle(0x221818, 0.9);
      g.fillRect(x, y, w, 5);
      g.fillStyle(0xe06050, 1);
      g.fillRect(x, y, w * (enemy.hp / enemy.maxHp), 5);
      if (enemy.maxArmor > 0) {
        g.fillStyle(0x333344, 1);
        g.fillRect(x, y + 7, w, 3);
        g.fillStyle(elementColor(enemy.element), 1);
        g.fillRect(x, y + 7, w * (enemy.armor / enemy.maxArmor), 3);
      }
    }
  }

  private syncTargetMarker(): void {
    const id = this.battle.selectedEnemyId;
    if (!id) {
      this.targetMarker.setVisible(false);
      return;
    }
    const home = this.enemyHome.get(id);
    if (!home) {
      this.targetMarker.setVisible(false);
      return;
    }
    this.targetMarker.setPosition(home.x, home.y + 38).setVisible(true);
  }

  private onPointerDown = (pointer: Phaser.Input.Pointer): void => {
    if (this.busy || !this.battle.acceptsInput || this.potionMode) return;
    const cell = this.pointerToCell(pointer.worldX, pointer.worldY);
    if (!cell) return;
    this.dragStart = cell;
    this.audio.sfx("gem_select");
  };

  private onPointerUp = (pointer: Phaser.Input.Pointer): void => {
    if (this.busy || !this.battle.acceptsInput || this.potionMode) return;
    const end = this.pointerToCell(pointer.worldX, pointer.worldY);
    if (!end) {
      this.dragStart = null;
      return;
    }
    if (this.dragStart && (this.dragStart.r !== end.r || this.dragStart.c !== end.c)) {
      void this.tryPlayerSwap(this.dragStart.r, this.dragStart.c, end.r, end.c);
      this.clearGemSelection();
      return;
    }
    if (!this.selected) {
      this.selected = end;
      this.setGemSelected(end.r, end.c, true);
      this.dragStart = null;
      return;
    }
    const a = this.selected;
    this.setGemSelected(a.r, a.c, false);
    if (a.r === end.r && a.c === end.c) {
      this.selected = null;
      this.dragStart = null;
      return;
    }
    void this.tryPlayerSwap(a.r, a.c, end.r, end.c);
    this.clearGemSelection();
  };

  private clearGemSelection(): void {
    if (this.selected) this.setGemSelected(this.selected.r, this.selected.c, false);
    this.selected = null;
    this.dragStart = null;
  }

  private showCascadeFeedback(turn: import("../systems/BattleController").TurnResolution): void {
    const steps = turn.resolve.steps.length;
    const peak = turn.resolve.cascadeMultiplierPeak;
    const parts: string[] = [];
    if (steps > 1) parts.push(`Cascade ×${steps}`);
    if (peak > 1) parts.push(`Mult ×${peak.toFixed(2)}`);
    this.cascadeText.setText(parts.join("  "));
  }

  private async tryPlayerSwap(r1: number, c1: number, r2: number, c2: number): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      if (!this.battle.acceptsInput) return;
      await this.animateSwap(r1, c1, r2, c2);
      const result = this.battle.attemptSwap(r1, c1, r2, c2);
      if (!result.ok) {
        this.audio.sfx("gem_invalid");
        await this.animateSwap(r1, c1, r2, c2);
        this.rebuildGemSprites();
        return;
      }

      this.audio.sfx("gem_swap");
      const turn = result.turn;
      this.showCascadeFeedback(turn);
      this.playMatchSfx(turn);
      this.rebuildGemSprites();
      await this.playAttackEvents(turn.attacks);
      this.refreshAll();
      this.syncTargetMarker();
      this.completeTutorialStep("swap_gems");

      if (turn.outcome === "victory") return this.finishVictory(turn.totalDamageDealt);
      if (turn.outcome === "defeat") return this.finishDefeat();
      this.cascadeText.setText("");
    } finally {
      this.busy = false;
    }
  }

  private playMatchSfx(turn: import("../systems/BattleController").TurnResolution): void {
    const maxMatch = Math.max(
      ...turn.resolve.steps.flatMap((s) => s.cleared.map((g) => g.cells.length)),
      0,
    );
    if (maxMatch >= 5) this.audio.sfx("match5");
    else if (maxMatch >= 4) this.audio.sfx("match4");
    else this.audio.sfx("match3");
    if (turn.resolve.steps.length > 1) this.audio.sfx("cascade");
  }

  private async runAbility(heroId: HeroId): Promise<void> {
    if (this.busy || !this.battle.acceptsInput) return;
    this.busy = true;
    try {
      this.audio.sfx("ability_use");
      const res = this.battle.useAbility(heroId);
      if (!res.ok) return;
      await this.playAttackEvents(res.attacks);
      this.refreshAll();
      this.syncTargetMarker();
      this.completeTutorialStep("ability_ready");
      if (res.outcome === "victory") return this.finishVictory(this.battle.totalDamageDealt);
      if (res.outcome === "defeat") return this.finishDefeat();
    } finally {
      this.busy = false;
    }
  }

  private async playAttackEvents(events: AttackEvent[]): Promise<void> {
    for (const ev of events) {
      if (ev.kind === "hero_match_attack" || ev.kind === "hero_ability") {
        await this.playHeroAttack(ev);
        if (ev.kind === "hero_match_attack") this.completeTutorialStep("color_heroes");
      } else if (ev.kind === "enemy_attack") {
        await this.playEnemyAttack(ev);
        this.completeTutorialStep("enemy_countdown");
      } else if (ev.kind === "boss_phase") {
        this.showToast("Boss enraged!");
        this.cameras.main.flash(200, 180, 40, 40);
      } else if (ev.kind === "enemy_spawn") {
        const enemyX = this.scale.width * BATTLE_LAYOUT.enemyX;
        this.spawnEnemyVisual(ev.enemy, enemyX);
        this.showToast(`${ev.enemy.name} appears!`);
      } else if (ev.kind === "extra_move") {
        this.showToast("Extra Move!");
        this.completeTutorialStep("match_four");
      } else if (ev.kind === "board_shuffle") {
        this.showToast("No moves — shuffling!");
        this.rebuildGemSprites();
      } else if (ev.kind === "countdown_tick") {
        const badge = this.countdownBadges.get(ev.enemyId);
        badge?.setText(String(Math.max(0, ev.countdown)));
        if (ev.countdown <= 1) this.completeTutorialStep("enemy_countdown");
      }
      this.refreshAll();
      await this.wait(120);
    }
  }

  private async playHeroAttack(
    ev: Extract<AttackEvent, { kind: "hero_match_attack" | "hero_ability" }>,
  ): Promise<void> {
    const spr = this.heroSprites.get(ev.heroId);
    const home = this.heroHome.get(ev.heroId);
    if (spr && home) {
      this.resetActorSprite(spr, home);
      this.tweens.add({
        targets: spr,
        x: home.x + 14,
        duration: 90,
        yoyo: true,
        onComplete: () => this.resetActorSprite(spr, home),
      });
      const sfxMap: Record<HeroId, string> = {
        "hero-warrior": "atk_warrior",
        "hero-mage": "atk_mage",
        "hero-ranger": "atk_ranger",
        "hero-priest": "atk_priest",
      };
      this.audio.sfx(sfxMap[ev.heroId]);
    }

    if (ev.kind === "hero_ability" && ev.heroId === "hero-warrior") {
      this.cameras.main.shake(140, 0.012);
    }
    if (ev.kind === "hero_ability" && ev.heroId === "hero-mage") {
      this.cameras.main.flash(180, 120, 180, 255);
    }

    for (const tid of ev.targetIds) {
      const target = this.enemySprites.get(tid);
      const th = this.enemyHome.get(tid);
      if (!target || !spr || !home || !th) continue;
      await this.flyProjectile(home.x, home.y, th.x, th.y, 0xff8866);
      this.audio.sfx("enemy_hit");
      this.tweens.add({
        targets: target,
        x: th.x + 10,
        duration: 70,
        yoyo: true,
        onComplete: () => this.resetActorSprite(target, th),
      });
      this.floatText(th.x, th.y - 36, `-${ev.damage}`, "#ff8866");
      if (ev.affinity && ev.affinity.tag !== "NEUTRAL") {
        this.floatText(th.x, th.y - 56, ev.affinity.tag, ev.affinity.tag === "WEAK" ? "#88ffaa" : "#ffaa66");
      }
      if (ev.kind === "hero_ability" && ev.execute) {
        this.floatText(th.x, th.y - 72, "EXECUTE", "#f0c050");
      }
    }
    if (ev.heal) {
      const panel = this.heroHud.get(ev.heroId);
      const x = panel ? panel.root.x + 44 : this.scale.width * 0.2;
      const y = panel ? panel.root.y : 40;
      this.floatText(x, y, `+${ev.heal}`, "#88ffaa");
    }
  }

  private async playEnemyAttack(ev: Extract<AttackEvent, { kind: "enemy_attack" }>): Promise<void> {
    const es = this.enemySprites.get(ev.enemyId);
    const eh = this.enemyHome.get(ev.enemyId);
    const hs = this.heroSprites.get(ev.heroId);
    const hh = this.heroHome.get(ev.heroId);
    if (!es || !eh || !hs || !hh) return;
    this.audio.sfx("enemy_attack");
    await new Promise<void>((resolve) => {
      this.tweens.add({
        targets: es,
        x: eh.x - 26,
        duration: 100,
        yoyo: true,
        onComplete: () => {
          this.resetActorSprite(es, eh);
          resolve();
        },
      });
    });
    await this.flyProjectile(eh.x - 18, eh.y, hh.x, hh.y, 0xff3344);
    this.audio.sfx("hero_hit");
    this.cameras.main.shake(70, 0.005);
    this.tweens.add({
      targets: hs,
      x: hh.x - 8,
      duration: 70,
      yoyo: true,
      onComplete: () => this.resetActorSprite(hs, hh),
    });
    this.floatText(hh.x, hh.y - 36, `-${ev.damage}`, "#ff5555");
    if (ev.pattern === "war_cry") this.showToast("War Cry!");
  }

  private showToast(msg: string, ms = 1400): void {
    this.toastText.setText(msg).setVisible(true).setAlpha(1);
    this.tweens.killTweensOf(this.toastText);
    this.tweens.add({
      targets: this.toastText,
      alpha: 0,
      delay: ms - 400,
      duration: 400,
      onComplete: () => this.toastText.setVisible(false),
    });
  }

  private flyProjectile(x1: number, y1: number, x2: number, y2: number, color: number): Promise<void> {
    const orb = this.add.circle(x1, y1, 6, color);
    return new Promise((resolve) => {
      this.tweens.add({
        targets: orb,
        x: x2,
        y: y2,
        duration: 220,
        onComplete: () => {
          orb.destroy();
          resolve();
        },
      });
    });
  }

  private floatText(x: number, y: number, msg: string, color: string): void {
    const t = this.add
      .text(x, y, msg, { fontFamily: "monospace", fontSize: "17px", color })
      .setOrigin(0.5);
    this.tweens.add({
      targets: t,
      y: y - 32,
      alpha: 0,
      duration: 650,
      onComplete: () => t.destroy(),
    });
  }

  private animateSwap(r1: number, c1: number, r2: number, c2: number): Promise<void> {
    const a = this.gemSprites[r1]![c1];
    const b = this.gemSprites[r2]![c2];
    if (!a || !b) return Promise.resolve();
    const ax = a.x;
    const ay = a.y;
    const bx = b.x;
    const by = b.y;
    const move = (spr: GemSprite, x: number, y: number) =>
      new Promise<void>((resolve) => {
        this.tweens.add({
          targets: [spr, spr.prismaticOverlay].filter(Boolean),
          x,
          y,
          duration: 110,
          onComplete: () => resolve(),
        });
      });
    return Promise.all([move(a, bx, by), move(b, ax, ay)]).then(() => undefined);
  }

  private async finishVictory(damageDealt: number): Promise<void> {
    this.audio.sfx("victory");
    await this.wait(550);
    this.scene.start("Rewards", { encounterId: this.encounterId, damageDealt });
  }

  private async finishDefeat(): Promise<void> {
    this.audio.sfx("defeat");
    await this.wait(650);
    this.audio.playTrack("world");
    this.scene.start("World");
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => {
      if (!this.sys.isActive()) {
        resolve();
        return;
      }
      this.time.delayedCall(ms, () => resolve());
    });
  }

  private showBattleTutorial(): void {
    const save = loadSave();
    const step = nextPendingStep(save, BATTLE_TUTORIAL);
    if (!step) return;
    this.currentTutorial = step;
    const { width } = this.scale;
    this.tutorialRoot = this.add.container(width / 2, 8);
    const bg = this.add
      .rectangle(0, 0, Math.min(width - 24, 420), 52, 0x1a1528, 0.94)
      .setStrokeStyle(1, 0x3a3044);
    const label = this.add
      .text(-180, 0, TUTORIAL_COPY[step], {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#f2e9d8",
        wordWrap: { width: 300 },
      })
      .setOrigin(0, 0.5);
    const skip = this.add
      .text(170, 0, "Skip", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#1a1008",
        backgroundColor: "#c8b090",
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    skip.on("pointerdown", () => this.dismissTutorial(true));
    this.tutorialRoot.add([bg, label, skip]);
  }

  private dismissTutorial(markDone: boolean): void {
    if (markDone && this.currentTutorial) markTutorialStep(this.currentTutorial);
    this.tutorialRoot?.destroy();
    this.tutorialRoot = undefined;
    this.currentTutorial = null;
  }

  private completeTutorialStep(step: TutorialStepId): void {
    const save = loadSave();
    if (nextPendingStep(save, [step]) !== step) return;
    markTutorialStep(step);
    if (this.currentTutorial === step) {
      this.dismissTutorial(false);
      this.time.delayedCall(300, () => this.showBattleTutorial());
    }
  }

  private checkAbilityTutorial(): void {
    if (this.tutorialAbilityShown || this.currentTutorial === "ability_ready") return;
    const ready = this.battle.heroes.some((h) => h.alive && h.charge >= h.abilityCost);
    if (!ready) return;
    const save = loadSave();
    const step = nextPendingStep(save, ["ability_ready"]);
    if (step !== "ability_ready") return;
    this.tutorialAbilityShown = true;
    if (!this.currentTutorial) this.showBattleTutorial();
  }
}
