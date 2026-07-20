import Phaser from "phaser";
import { AudioManager } from "../audio/AudioManager";
import {
  HERO_IDS,
  LINE_GEM_H,
  LINE_GEM_V,
  SPECIAL_GEM_ID,
  type HeroId,
  type BoardGemId,
  type GemId,
} from "../assets/types";
import {
  createBoard,
  BOARD_SIZE,
  isLineGem,
  isPrismaticGem,
  type CascadeStep,
  type Board,
} from "../systems/match3/board";
import { createParty } from "../systems/combat/heroes";
import { createEncounterEnemies, type EnemyRuntime } from "../systems/combat/enemies";
import { BattleController, type AttackEvent } from "../systems/BattleController";
import { bindBattleDebug } from "../debug/debugApi";
import { loadSave } from "../data/save";
import {
  battleLayoutFor,
  pickLayoutProfile,
  type BattleLayoutConfig,
  type LayoutProfile,
} from "../ui/layoutProfile";
import { addSceneBackground } from "../ui/sceneArt";
import { elementColor, elementForGem } from "../systems/combat/elements";
import { potionHealFraction } from "../systems/combat/progression";
import {
  CORE_LOOP_COPY,
  CORE_LOOP_STEPS,
  TUTORIAL_COPY,
  isCoreLoopStep,
  markCoreLoopSteps,
  markTutorialStep,
  nextPendingStep,
  tutorialCandidatesForEncounter,
  type TutorialStepId,
} from "../systems/tutorial/TutorialManager";
import { addAudioControls } from "../ui/AudioControls";
import { createRng, randomSeed } from "../systems/rng";
import { GAME_VERSION } from "../config/version";

type GemSprite = Phaser.GameObjects.Image & {
  boardR: number;
  boardC: number;
  prismaticOverlay?: Phaser.GameObjects.Arc;
};

type MatchOrigin = { x: number; y: number; gem: GemId };

type HeroHudPanel = {
  id: HeroId;
  root: Phaser.GameObjects.Container;
  portrait: Phaser.GameObjects.Image;
  hpGfx: Phaser.GameObjects.Graphics;
  chargeGfx: Phaser.GameObjects.Graphics;
  shieldGfx: Phaser.GameObjects.Graphics;
  glow: Phaser.GameObjects.Rectangle;
  panelW: number;
  panelH: number;
};

type BattleInitData = { encounterId?: string };

export class BattleScene extends Phaser.Scene {
  private battle!: BattleController;
  private audio = AudioManager.get();
  private gemSprites: (GemSprite | null)[][] = [];
  private heroSprites = new Map<HeroId, Phaser.GameObjects.Image>();
  private enemySprites = new Map<string, Phaser.GameObjects.Image>();
  private heroHud = new Map<HeroId, HeroHudPanel>();
  private enemyBars = new Map<string, Phaser.GameObjects.Graphics>();
  private countdownBadges = new Map<string, Phaser.GameObjects.Text>();
  private telegraphBadges = new Map<string, Phaser.GameObjects.Text>();
  private statusIcons = new Map<string, Phaser.GameObjects.Text>();
  private objectiveText: Phaser.GameObjects.Text | null = null;
  private heroHome = new Map<HeroId, { x: number; y: number; w: number; h: number }>();
  private enemyHome = new Map<string, { x: number; y: number; w: number; h: number }>();
  private targetMarker!: Phaser.GameObjects.Ellipse;
  private cascadeText!: Phaser.GameObjects.Text;
  private stateText!: Phaser.GameObjects.Text;
  private toastText!: Phaser.GameObjects.Text;
  private tutorialRoot?: Phaser.GameObjects.Container;
  private potionBtn?: Phaser.GameObjects.Text;
  private boardOrigin = { x: 0, y: 0 };
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
  /** Cleared-cell origins from the last resolve, for gem-fly VFX. */
  private matchOrigins: MatchOrigin[] = [];
  private cellHighlights: (Phaser.GameObjects.Rectangle | null)[][] = [];
  private pressedHighlight: Phaser.GameObjects.Rectangle | null = null;
  private layoutProfile: LayoutProfile = "desktop";
  private layout: BattleLayoutConfig = battleLayoutFor("desktop");
  /** Party strip height on mobile (between field and board). */
  private partyStripH = 0;

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
    this.telegraphBadges.clear();
    this.statusIcons.clear();
    this.objectiveText = null;
    this.heroHome.clear();
    this.enemyHome.clear();
  }

  create(): void {
    this.busy = false;
    this.potionMode = false;
    this.clearGemSelection();
    this.tweens.killAll();
    this.time.removeAllEvents();

    void this.audio.unlock().then(() => {
      this.audio.playTrack(
        this.encounterId === "fortress" ? "battle_boss" : "battle",
      );
    });

    const save = loadSave();
    const { width, height } = this.scale;
    this.layoutProfile = pickLayoutProfile(width, height);
    this.layout = battleLayoutFor(this.layoutProfile);
    this.partyStripH =
      this.layoutProfile === "mobile" ? this.layout.partyCardH + 12 : 0;
    this.fieldH = Math.floor(height * this.layout.fieldFraction);

    const seed = randomSeed();
    const rng = createRng(seed);
    this.battle = new BattleController(
      createParty(save.heroLevels),
      createEncounterEnemies(this.encounterId, save.memoryWipes),
      createBoard(rng),
      {
        potionHealFraction: potionHealFraction(save.buildingLevels.workshop),
        seed,
        rng,
        objective:
          this.encounterId === "watchtower"
            ? { type: "survive", turns: 6 }
            : { type: "eliminate" },
      },
    );
    bindBattleDebug(this, this.battle);

    this.drawBattlefield(width);
    this.layoutCombatants(width);
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
      // Alt+Shift+D toggles battle state overlay (Ctrl+Shift+D is IDE-bound)
      if (ev.altKey && ev.shiftKey) {
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
    this.potionMode = false;
    this.clearGemSelection();
    this.tweens.killAll();
    this.time.removeAllEvents();
    if (this.listenersBound) {
      this.input.off("pointerdown", this.onPointerDown, this);
      this.input.off("pointerup", this.onPointerUp, this);
      this.listenersBound = false;
    }
  }

  private drawBattlefield(width: number): void {
    const baseKey =
      this.encounterId === "fortress" &&
      (this.textures.exists("battle-boss-bg") ||
        this.textures.exists("battle-boss-bg-mobile"))
        ? "battle-boss-bg"
        : "battle-screen-ref";
    if (
      !addSceneBackground(this, baseKey, {
        profile: this.layoutProfile,
        x: width / 2,
        y: this.fieldH / 2,
        width,
        height: this.fieldH,
        coverAnchorY: 0.35,
      })
    ) {
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
    if (this.layoutProfile === "mobile") {
      this.layoutCombatantsMobile(width);
      return;
    }
    this.layoutCombatantsDesktop(width);
  }

  private layoutCombatantsDesktop(width: number): void {
    const cardW = this.layout.partyCardW;
    const cardH = this.layout.partyCardH;
    const portraitSize = this.layout.partyPortraitSize;
    const gap = this.layout.partyGap;
    const left = Math.floor(width * this.layout.partyX);
    const totalH = cardH * 4 + gap * 3;
    let y = Math.max(
      this.layout.partyTop,
      Math.floor((this.fieldH - totalH) / 2),
    );

    HERO_IDS.forEach((id) => {
      this.createHeroCard(id, left, y, cardW, cardH, portraitSize);
      y += cardH + gap;
    });

    const enemyX = width * this.layout.enemyX;
    this.battle.enemies.forEach((e, i) => this.spawnEnemyVisual(e, enemyX, i));

    this.targetMarker = this.add
      .ellipse(0, 0, 96, 28, 0xf0c050, 0.35)
      .setStrokeStyle(3, 0xffe080, 1)
      .setVisible(false);
  }

  private layoutCombatantsMobile(width: number): void {
    const cardW = this.layout.partyCardW;
    const cardH = this.layout.partyCardH;
    const portraitSize = this.layout.partyPortraitSize;
    const gap = this.layout.partyGap;
    const totalW = cardW * 4 + gap * 3;
    let x = Math.max(8, Math.floor((width - totalW) / 2));
    const y = this.fieldH + 6;

    HERO_IDS.forEach((id) => {
      this.createHeroCard(id, x, y, cardW, cardH, portraitSize);
      x += cardW + gap;
    });

    const n = this.battle.enemies.length;
    this.battle.enemies.forEach((e, i) => {
      this.spawnEnemyVisual(e, this.enemyXMobile(i, n, width), i);
    });

    this.targetMarker = this.add
      .ellipse(0, 0, 80, 24, 0xf0c050, 0.4)
      .setStrokeStyle(3, 0xffe080, 1)
      .setVisible(false);
  }

  private createHeroCard(
    id: HeroId,
    left: number,
    y: number,
    cardW: number,
    cardH: number,
    portraitSize: number,
  ): void {
    const root = this.add.container(left, y);
    const glow = this.add
      .rectangle(-2, -2, cardW + 4, cardH + 4, 0xf0c050, 0)
      .setOrigin(0, 0)
      .setStrokeStyle(2, 0xf0c050, 0);
    const bg = this.add
      .rectangle(0, 0, cardW, cardH, 0x12101a, 0.88)
      .setOrigin(0, 0)
      .setStrokeStyle(1, 0x4a3a52);
    const pad = this.layout.partyBarsBelow
      ? 4
      : Math.floor((cardH - portraitSize) / 2);
    const portraitKey = this.textures.exists(`${id}-portrait`) ? `${id}-portrait` : id;
    const portraitX = this.layout.partyBarsBelow
      ? Math.floor((cardW - portraitSize) / 2)
      : pad;
    const portrait = this.add
      .image(portraitX, pad, portraitKey)
      .setOrigin(0, 0)
      .setDisplaySize(portraitSize, portraitSize);
    const hpGfx = this.add.graphics();
    const chargeGfx = this.add.graphics();
    const shieldGfx = this.add.graphics();
    root.add([glow, bg, portrait, hpGfx, chargeGfx, shieldGfx]);
    root.setSize(cardW, cardH);
    root.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, cardW, cardH),
      Phaser.Geom.Rectangle.Contains,
    );
    root.on("pointerdown", () => this.onHeroTapped(id));

    this.heroHud.set(id, {
      id,
      root,
      portrait,
      hpGfx,
      chargeGfx,
      shieldGfx,
      glow,
      panelW: cardW,
      panelH: cardH,
    });
    this.heroSprites.set(id, portrait);
    this.heroHome.set(id, {
      x: portraitX,
      y: pad,
      w: portraitSize,
      h: portraitSize,
    });
  }

  private enemyXMobile(index: number, total: number, width: number): number {
    if (total <= 1) return width * 0.5;
    const spacing = Math.min(120, Math.floor((width - 48) / total));
    const totalW = spacing * (total - 1);
    return Math.floor(width / 2 - totalW / 2 + index * spacing);
  }

  private enemyY(index: number, total: number): number {
    if (this.layoutProfile === "mobile") {
      return Math.floor(this.fieldH * 0.52);
    }
    const spacing = Math.min(110, Math.floor(this.fieldH / Math.max(total, 1) * 0.55));
    const totalH = total <= 1 ? 0 : spacing * (total - 1);
    const startY = Math.max(56, Math.floor((this.fieldH - totalH) / 2));
    const maxY = this.fieldH - 56;
    return Math.min(maxY, startY + index * spacing);
  }

  private spawnEnemyVisual(enemy: EnemyRuntime, enemyX: number, index?: number): void {
    const idx = index ?? this.enemySprites.size;
    const total = Math.max(this.battle.enemies.length, idx + 1);
    const y = this.enemyY(idx, total);
    const scale = this.layout.enemyScale;
    const size = Math.round(
      (enemy.isBoss ? 88 : enemy.textureKey.includes("bat") ? 66 : 74) * scale,
    );

    this.add.ellipse(enemyX, y + size * 0.42, 50 * scale, 14 * scale, 0x000000, 0.35);
    const key = this.textures.exists(enemy.textureKey) ? enemy.textureKey : "enemy-slime";
    const hitPad = size * 0.15;
    const spr = this.add
      .image(enemyX, y, key)
      .setDisplaySize(size, size)
      .setInteractive({
        useHandCursor: true,
        hitArea: new Phaser.Geom.Rectangle(-hitPad, -hitPad, size + hitPad * 2, size + hitPad * 2),
        hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      });
    this.enemySprites.set(enemy.id, spr);
    this.enemyHome.set(enemy.id, { x: enemyX, y, w: size, h: size });
    this.enemyBars.set(enemy.id, this.add.graphics());

    const badgeY = y - size * 0.55;
    const badge = this.add
      .text(enemyX - 18, badgeY, String(enemy.countdown), {
        fontFamily: "monospace",
        fontSize: this.layoutProfile === "mobile" ? "16px" : "20px",
        color: "#1a1008",
        backgroundColor: "#f0c050",
        padding: { x: 7, y: 3 },
      })
      .setOrigin(0.5);
    this.countdownBadges.set(enemy.id, badge);

    const telegraph = this.add
      .text(enemyX + 22, badgeY, this.battle.previewPattern(enemy.id), {
        fontFamily: "monospace",
        fontSize: this.layoutProfile === "mobile" ? "14px" : "16px",
        color: "#f2e9d8",
        backgroundColor: "#3a3044",
        padding: { x: 6, y: 3 },
      })
      .setOrigin(0.5);
    this.telegraphBadges.set(enemy.id, telegraph);

    const status = this.add
      .text(enemyX, y + size * 0.58, "", {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#ffaa66",
      })
      .setOrigin(0.5);
    this.statusIcons.set(enemy.id, status);

    spr.on("pointerdown", () => {
      if (this.busy || !this.battle.acceptsInput) return;
      const live = this.battle.enemies.find((e) => e.id === enemy.id && e.alive);
      if (!live) return;
      this.battle.selectEnemy(enemy.id);
      this.audio.sfx("ui_click");
      this.syncTargetMarker();
      this.completeTutorialStep("select_enemy");
    });
  }

  private layoutBoard(width: number, height: number): void {
    const boardAreaTop = this.fieldH + this.partyStripH + 8;
    const boardAreaH = height - boardAreaTop - this.layout.chromeBottom - 12;
    const maxCell = this.layout.maxGemCell;
    this.cell = Math.min(
      maxCell,
      Math.floor(
        Math.min(
          (width - this.layout.boardSidePad) / BOARD_SIZE,
          boardAreaH / BOARD_SIZE,
        ),
      ),
    );
    if (this.layoutProfile === "mobile") {
      this.cell = Math.max(36, this.cell);
    }
    const boardW = this.cell * BOARD_SIZE;
    const boardH = this.cell * BOARD_SIZE;
    this.boardOrigin = {
      x: Math.floor((width - boardW) / 2),
      y: boardAreaTop + Math.floor(Math.max(0, boardAreaH - boardH) / 2),
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

    this.cellHighlights = Array.from({ length: BOARD_SIZE }, () =>
      Array.from({ length: BOARD_SIZE }, () => null),
    );
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const hl = this.add
          .rectangle(
            this.boardOrigin.x + c * this.cell + this.cell / 2,
            this.boardOrigin.y + r * this.cell + this.cell / 2,
            this.cell - 4,
            this.cell - 4,
            0xf0c050,
            0,
          )
          .setOrigin(0.5)
          .setStrokeStyle(2, 0xf0c050, 0)
          .setDepth(5);
        this.cellHighlights[r]![c] = hl;
      }
    }
    this.pressedHighlight = this.add
      .rectangle(0, 0, this.cell - 4, this.cell - 4, 0xffffff, 0)
      .setOrigin(0.5)
      .setStrokeStyle(2, 0xffffff, 0)
      .setDepth(6)
      .setVisible(false);
  }

  private layoutChrome(width: number, _save: ReturnType<typeof loadSave>): void {
    const mobile = this.layoutProfile === "mobile";
    const padX = mobile ? 12 : 8;
    const padY = mobile ? 10 : 5;
    const btnStyle = {
      fontFamily: "monospace",
      fontSize: mobile ? "16px" : "14px",
      color: "#f2e9d8",
      backgroundColor: "#2a2238",
      padding: { x: padX, y: padY },
    };

    // Thumb row near bottom: Potion + Map. Audio sits above on mobile.
    const thumbY = this.scale.height - (mobile ? 28 : this.layout.chromeBottom - 8);
    addAudioControls(this, {
      bottomInset: this.layout.chromeBottom,
      large: mobile,
      yOffset: mobile ? 36 : 0,
    });

    if (this.battle.potionAvailable) {
      const potionX = mobile ? 16 : 130;
      this.potionBtn = this.add
        .text(potionX, thumbY, "Potion", {
          ...btnStyle,
          color: "#1a1008",
          backgroundColor: "#6a9c5a",
        })
        .setOrigin(0, 0.5)
        .setDepth(1000)
        .setInteractive({ useHandCursor: true });
      this.potionBtn.on("pointerdown", () => {
        if (this.busy || !this.battle.potionAvailable) return;
        this.clearGemSelection();
        this.potionMode = !this.potionMode;
        this.potionBtn?.setBackgroundColor(this.potionMode ? "#f0c050" : "#6a9c5a");
        this.audio.sfx("ui_click");
      });
    }

    this.add
      .text(width - 12, thumbY, "Map", {
        fontFamily: "monospace",
        fontSize: mobile ? "16px" : "13px",
        color: "#1a1008",
        backgroundColor: "#c8b090",
        padding: { x: padX + 2, y: padY },
      })
      .setOrigin(1, 0.5)
      .setDepth(1000)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => {
        this.busy = false;
        this.clearGemSelection();
        this.potionMode = false;
        this.audio.sfx("ui_click");
        this.audio.playTrack("world");
        this.scene.start("World");
      });

    this.add
      .text(width - 12, mobile ? 10 : 8, `v${GAME_VERSION}`, {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#6a5e52",
      })
      .setOrigin(1, 0)
      .setDepth(1000);

    this.cascadeText = this.add
      .text(width / 2, this.boardOrigin.y - 10, "", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#f0c050",
      })
      .setOrigin(0.5, 1);

    if (this.battle.objective.type === "survive") {
      this.objectiveText = this.add
        .text(width / 2, 14, `Survive ${this.battle.surviveTurnsRemaining} turns`, {
          fontFamily: "monospace",
          fontSize: this.layoutProfile === "mobile" ? "13px" : "14px",
          color: "#a0d0ff",
          backgroundColor: "#1a2030",
          padding: { x: 10, y: 4 },
        })
        .setOrigin(0.5);
    }

    this.toastText = this.add
      .text(width / 2, this.fieldH + this.partyStripH + 2, "", {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#f2e9d8",
        backgroundColor: "#2a2238aa",
        padding: { x: 10, y: 6 },
      })
      .setOrigin(0.5, 0)
      .setVisible(false);

    this.stateText = this.add
      .text(12, 10, "", {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#88aa88",
      })
      .setOrigin(0, 0)
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
    this.clearGemSelection();
    const res = this.battle.usePotion(heroId);
    if (!res.ok) return;
    this.potionMode = false;
    this.potionBtn?.setBackgroundColor("#6a9c5a").setVisible(false);
    this.audio.sfx("ability_use");
    const panel = this.heroHud.get(heroId);
    if (panel) {
      this.floatText(panel.root.x + panel.panelW * 0.55, panel.root.y - 6, `+${res.heal}`, "#88ffaa");
    }
    this.refreshAll();
  }

  private cellCenter(r: number, c: number): { x: number; y: number } {
    return {
      x: this.boardOrigin.x + c * this.cell + this.cell / 2,
      y: this.boardOrigin.y + r * this.cell + this.cell / 2,
    };
  }

  private pointerToCell(x: number, y: number): { r: number; c: number } | null {
    // Slightly larger hit pad on mobile for fat-finger swaps
    const pad = this.layoutProfile === "mobile" ? 4 : 0;
    const c = Math.floor((x - this.boardOrigin.x + pad) / this.cell);
    const r = Math.floor((y - this.boardOrigin.y + pad) / this.cell);
    if (r < 0 || c < 0 || r >= BOARD_SIZE || c >= BOARD_SIZE) return null;
    return { r, c };
  }

  private gemDisplaySize(selected = false): number {
    const base = this.cell - 8;
    return selected ? Math.floor(base * 1.1) : base;
  }

  private rebuildGemSprites(): void {
    this.clearGemSelection();
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
    let texture: string = gem;
    let overlay: Phaser.GameObjects.Arc | undefined;
    if (isPrismaticGem(gem)) {
      if (this.textures.exists(SPECIAL_GEM_ID)) {
        texture = SPECIAL_GEM_ID;
      } else {
        texture = "gem-flame";
        overlay = this.add.circle(x, y, size * 0.42, 0xffffff, 0.35);
        overlay.setStrokeStyle(2, 0xe0a0ff);
      }
    } else if (isLineGem(gem)) {
      texture = this.textures.exists(gem) ? gem : gem === LINE_GEM_H ? LINE_GEM_H : LINE_GEM_V;
      if (!this.textures.exists(texture)) {
        texture = "gem-ice";
        overlay = this.add.circle(x, y, size * 0.4, 0x70d0ff, 0.4);
      }
    }
    const spr = this.add
      .image(x, y, texture)
      .setDisplaySize(size, size) as GemSprite;
    if (isPrismaticGem(gem) && !this.textures.exists(SPECIAL_GEM_ID)) {
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
    const hl = this.cellHighlights[r]?.[c];
    if (hl) {
      hl.setFillStyle(0xf0c050, selected ? 0.22 : 0);
      hl.setStrokeStyle(2, 0xf0c050, selected ? 0.95 : 0);
    }
  }

  private setPressedCell(cell: { r: number; c: number } | null): void {
    if (!this.pressedHighlight) return;
    if (!cell) {
      this.pressedHighlight.setVisible(false);
      return;
    }
    const { x, y } = this.cellCenter(cell.r, cell.c);
    this.pressedHighlight
      .setPosition(x, y)
      .setSize(this.cell - 4, this.cell - 4)
      .setFillStyle(0xffffff, 0.18)
      .setStrokeStyle(2, 0xffffff, 0.85)
      .setVisible(true);
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
    if (this.objectiveText && this.battle.objective.type === "survive") {
      const left = this.battle.surviveTurnsRemaining ?? 0;
      this.objectiveText.setText(
        left > 0 ? `Survive ${left} turns` : "Hold the line!",
      );
    }
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

  private heroWorldCenter(id: HeroId): { x: number; y: number } | null {
    const panel = this.heroHud.get(id);
    const home = this.heroHome.get(id);
    if (!panel || !home) return null;
    return {
      x: panel.root.x + home.x + home.w / 2,
      y: panel.root.y + home.y + home.h / 2,
    };
  }

  private refreshHeroHud(): void {
    HERO_IDS.forEach((id) => {
      const hero = this.battle.heroes.find((h) => h.id === id)!;
      const panel = this.heroHud.get(id)!;
      const ready = hero.alive && hero.charge >= hero.abilityCost;
      panel.glow.setFillStyle(0xf0c050, ready ? 0.14 : 0);
      panel.glow.setStrokeStyle(2, 0xf0c050, ready ? 0.9 : 0);
      panel.portrait.setAlpha(hero.alive ? 1 : 0.35);

      const portraitSize = this.layout.partyPortraitSize;
      if (this.layout.partyBarsBelow) {
        const barX = 6;
        const barW = panel.panelW - 12;
        const barTop = 4 + portraitSize + 4;
        panel.hpGfx.clear();
        panel.hpGfx.fillStyle(0x221818, 0.95);
        panel.hpGfx.fillRect(barX, barTop, barW, 6);
        panel.hpGfx.fillStyle(hero.alive ? 0x5ad46a : 0x555555, 1);
        panel.hpGfx.fillRect(barX, barTop, barW * (hero.hp / hero.maxHp), 6);

        panel.chargeGfx.clear();
        panel.chargeGfx.fillStyle(0x333344, 1);
        panel.chargeGfx.fillRect(barX, barTop + 10, barW, 5);
        panel.chargeGfx.fillStyle(ready ? 0xf0c050 : 0x5a8cff, 1);
        panel.chargeGfx.fillRect(
          barX,
          barTop + 10,
          barW * Math.min(1, hero.charge / hero.abilityCost),
          5,
        );

        panel.shieldGfx.clear();
        if (hero.shield > 0) {
          panel.shieldGfx.fillStyle(0x88ccff, 0.9);
          panel.shieldGfx.fillRect(barX, barTop + 18, barW, 3);
        }
        return;
      }

      const pad = Math.floor((panel.panelH - portraitSize) / 2);
      const barX = pad + portraitSize + 8;
      const barW = panel.panelW - barX - 10;
      const hpY = pad + 10;
      const chargeY = pad + 28;
      const shieldY = pad + 44;
      panel.hpGfx.clear();
      panel.hpGfx.fillStyle(0x221818, 0.95);
      panel.hpGfx.fillRect(barX, hpY, barW, 8);
      panel.hpGfx.fillStyle(hero.alive ? 0x5ad46a : 0x555555, 1);
      panel.hpGfx.fillRect(barX, hpY, barW * (hero.hp / hero.maxHp), 8);

      panel.chargeGfx.clear();
      panel.chargeGfx.fillStyle(0x333344, 1);
      panel.chargeGfx.fillRect(barX, chargeY, barW, 6);
      panel.chargeGfx.fillStyle(ready ? 0xf0c050 : 0x5a8cff, 1);
      panel.chargeGfx.fillRect(
        barX,
        chargeY,
        barW * Math.min(1, hero.charge / hero.abilityCost),
        6,
      );

      panel.shieldGfx.clear();
      if (hero.shield > 0) {
        panel.shieldGfx.fillStyle(0x88ccff, 0.9);
        panel.shieldGfx.fillRect(barX, shieldY, barW, 4);
      }
    });
  }

  private refreshEnemies(): void {
    const selectedId = this.battle.selectedEnemyId;
    for (const enemy of this.battle.enemies) {
      const spr = this.enemySprites.get(enemy.id);
      const g = this.enemyBars.get(enemy.id);
      const home = this.enemyHome.get(enemy.id);
      const badge = this.countdownBadges.get(enemy.id);
      const telegraph = this.telegraphBadges.get(enemy.id);
      const status = this.statusIcons.get(enemy.id);
      if (!spr || !g || !home) continue;
      this.resetActorSprite(spr, home);
      g.clear();
      if (!enemy.alive) {
        spr.setAlpha(0.22);
        spr.clearTint();
        if (spr.input?.enabled) spr.disableInteractive();
        badge?.setVisible(false);
        telegraph?.setVisible(false);
        status?.setVisible(false);
        continue;
      }
      if (!spr.input?.enabled) {
        spr.setInteractive({
          useHandCursor: true,
          hitArea: new Phaser.Geom.Rectangle(
            -home.w * 0.15,
            -home.h * 0.15,
            home.w * 1.3,
            home.h * 1.3,
          ),
          hitAreaCallback: Phaser.Geom.Rectangle.Contains,
        });
      }
      spr.setAlpha(1);
      if (enemy.id === selectedId) {
        spr.setTint(0xffe8a0);
      } else {
        spr.clearTint();
      }
      const cd = Math.max(0, enemy.countdown);
      const urgent = cd <= 1;
      badge
        ?.setVisible(true)
        .setText(String(cd))
        .setBackgroundColor(urgent ? "#e06050" : "#f0c050")
        .setColor(urgent ? "#fff0e8" : "#1a1008");
      telegraph
        ?.setVisible(true)
        .setText(this.battle.previewPattern(enemy.id))
        .setBackgroundColor(urgent ? "#6a3030" : "#3a3044");
      const statusParts: string[] = [];
      if (enemy.statuses.some((s) => s.id === "burn")) statusParts.push("Burn");
      if (enemy.statuses.some((s) => s.id === "freeze")) statusParts.push("Freeze");
      status?.setVisible(statusParts.length > 0).setText(statusParts.join(" · "));
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
    this.syncTargetMarker();
  }

  private syncTargetMarker(): void {
    if (!this.targetMarker) return;
    const id = this.battle.selectedEnemyId;
    const enemy = id
      ? this.battle.enemies.find((e) => e.id === id && e.alive)
      : undefined;
    if (!id || !enemy) {
      this.targetMarker.setVisible(false);
      return;
    }
    const home = this.enemyHome.get(id);
    if (!home) {
      this.targetMarker.setVisible(false);
      return;
    }
    const footY = home.y + home.h * 0.48;
    this.targetMarker
      .setPosition(home.x, footY)
      .setDisplaySize(home.w * 1.05, Math.max(18, home.h * 0.28))
      .setVisible(true)
      .setDepth(50);
  }

  private onPointerDown = (pointer: Phaser.Input.Pointer): void => {
    if (this.busy || !this.battle.acceptsInput || this.potionMode) return;
    const cell = this.pointerToCell(pointer.worldX, pointer.worldY);
    if (!cell) return;
    this.dragStart = cell;
    this.setPressedCell(cell);
    this.audio.sfx("gem_select");
  };

  private onPointerUp = (pointer: Phaser.Input.Pointer): void => {
    if (this.busy || !this.battle.acceptsInput || this.potionMode) return;
    this.setPressedCell(null);
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
    // Stale selection from a previous board rebuild / battle — treat as fresh select.
    if (!this.gemSprites[a.r]?.[a.c]) {
      this.clearGemSelection();
      this.selected = end;
      this.setGemSelected(end.r, end.c, true);
      this.dragStart = null;
      return;
    }
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
    if (this.selected) {
      const { r, c } = this.selected;
      if (this.gemSprites[r]?.[c] || this.cellHighlights[r]?.[c]) {
        this.setGemSelected(r, c, false);
      }
    }
    this.selected = null;
    this.dragStart = null;
    this.setPressedCell(null);
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
      this.matchOrigins = this.collectMatchOrigins(turn);
      this.showCascadeFeedback(turn);
      this.playMatchSfx(turn);
      await this.animateCascadeResolve(turn.resolve);
      await this.playAttackEvents(turn.attacks);
      this.matchOrigins = [];
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

  private async animateCascadeResolve(
    resolve: import("../systems/match3/board").ResolveResult,
  ): Promise<void> {
    if (!resolve.steps.length) {
      this.rebuildGemSprites();
      return;
    }
    for (const step of resolve.steps) {
      await this.animateCascadeStep(step);
    }
    this.rebuildGemSprites();
  }

  private async animateCascadeStep(step: CascadeStep): Promise<void> {
    const clearCells = [
      ...step.cleared.flatMap((g) => g.cells),
      ...(step.lineClearedCells ?? []),
    ];
    // Flash + shrink clears
    const flashes: Phaser.GameObjects.GameObject[] = [];
    for (const cell of clearCells.slice(0, 40)) {
      const { x, y } = this.cellCenter(cell.r, cell.c);
      const flash = this.add.rectangle(x, y, this.cell - 6, this.cell - 6, 0xffffff, 0.75);
      flashes.push(flash);
      const spr = this.gemSprites[cell.r]?.[cell.c];
      if (spr) {
        this.tweens.add({
          targets: [spr, spr.prismaticOverlay].filter(Boolean),
          scale: 0.2,
          alpha: 0,
          duration: 110,
        });
      }
    }
    if (step.lineClearedCells?.length) {
      this.cameras.main.flash(80, 120, 200, 255, false);
    }
    await this.wait(120);
    for (const f of flashes) f.destroy();

    // Gravity: rebuild from boardAfterGravity with fall tweens
    await this.tweenBoardAppear(step.boardAfterGravity, "fall");
    await this.wait(40);
    // Fill from top
    await this.tweenBoardAppear(step.boardAfterFill, "fill");
    await this.wait(50);
  }

  private async tweenBoardAppear(
    board: Board,
    mode: "fall" | "fill",
  ): Promise<void> {
    // Destroy current sprites
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
    const tweens: Promise<void>[] = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const gem = board[r]![c] as BoardGemId | null;
        if (!gem) continue;
        const { x, y } = this.cellCenter(r, c);
        const startY =
          mode === "fill"
            ? this.boardOrigin.y - this.cell * (2 + (r % 3))
            : y - this.cell * 0.85;
        const spr = this.createGemSprite(x, startY, gem, size, r, c);
        spr.setAlpha(mode === "fill" ? 0.85 : 1);
        this.gemSprites[r]![c] = spr;
        tweens.push(
          new Promise((resolve) => {
            this.tweens.add({
              targets: [spr, spr.prismaticOverlay].filter(Boolean),
              y,
              alpha: 1,
              duration: mode === "fill" ? 140 : 120,
              ease: "Cubic.easeOut",
              onComplete: () => resolve(),
            });
          }),
        );
      }
    }
    await Promise.all(tweens);
  }

  private collectMatchOrigins(
    turn: import("../systems/BattleController").TurnResolution,
  ): MatchOrigin[] {
    const origins: MatchOrigin[] = [];
    for (const step of turn.resolve.steps) {
      for (const group of step.cleared) {
        for (const cell of group.cells) {
          const { x, y } = this.cellCenter(cell.r, cell.c);
          origins.push({ x, y, gem: group.gem });
        }
      }
    }
    return origins;
  }

  private originsForGem(gem: GemId): MatchOrigin[] {
    return this.matchOrigins.filter((o) => o.gem === gem);
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
    this.clearGemSelection();
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
        const n = this.battle.enemies.length;
        const idx = Math.max(0, this.battle.enemies.findIndex((e) => e.id === ev.enemy.id));
        const enemyX =
          this.layoutProfile === "mobile"
            ? this.enemyXMobile(idx, n, this.scale.width)
            : this.scale.width * this.layout.enemyX;
        this.spawnEnemyVisual(ev.enemy, enemyX, idx);
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
      } else if (ev.kind === "status_burn") {
        const home = this.enemyHome.get(ev.enemyId);
        if (home) {
          this.floatText(home.x, home.y - 50, `Burn -${ev.damage}`, "#ff8844");
          await this.hitFlashEnemy(ev.enemyId);
        }
      } else if (ev.kind === "status_freeze_block") {
        const home = this.enemyHome.get(ev.enemyId);
        if (home) this.floatText(home.x, home.y - 50, "Frozen!", "#88ccff");
        this.showToast("Enemy frozen!");
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
    const world = this.heroWorldCenter(ev.heroId);
    if (spr && home) {
      this.resetActorSprite(spr, home);
      this.tweens.add({
        targets: spr,
        x: home.x + 10,
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

    const gemColor =
      ev.kind === "hero_match_attack"
        ? elementColor(elementForGem(ev.gem))
        : this.abilityProjectileColor(ev.heroId);

    for (const tid of ev.targetIds) {
      const target = this.enemySprites.get(tid);
      const th = this.enemyHome.get(tid);
      // Still play VFX for the killing blow (enemy may already be !alive after resolve).
      if (!target || !th) continue;

      if (ev.kind === "hero_match_attack") {
        const origins = this.originsForGem(ev.gem);
        const pick = origins.length
          ? origins.slice(0, Math.min(4, origins.length))
          : world
            ? [{ x: world.x, y: world.y, gem: ev.gem }]
            : [];
        await Promise.all(
          pick.map((o, i) =>
            this.flyProjectile(o.x, o.y, th.x, th.y, gemColor, 180 + i * 20),
          ),
        );
      } else if (world) {
        await this.flyProjectile(world.x, world.y, th.x, th.y, gemColor);
      }

      this.audio.sfx("enemy_hit");
      await this.hitFlashEnemy(tid);
      this.floatText(th.x, th.y - 36, `-${ev.damage}`, "#ff8866");
      if (ev.affinity && ev.affinity.tag !== "NEUTRAL") {
        this.floatText(
          th.x,
          th.y - 56,
          ev.affinity.tag,
          ev.affinity.tag === "WEAK" ? "#88ffaa" : "#ffaa66",
        );
      }
      if (ev.kind === "hero_ability" && ev.execute) {
        this.floatText(th.x, th.y - 72, "EXECUTE", "#f0c050");
      }
    }
    if (ev.heal) {
      const panel = this.heroHud.get(ev.heroId);
      const x = panel ? panel.root.x + panel.panelW * 0.55 : this.scale.width * 0.2;
      const y = panel ? panel.root.y : 40;
      this.floatText(x, y, `+${ev.heal}`, "#88ffaa");
    }
  }

  private abilityProjectileColor(heroId: HeroId): number {
    switch (heroId) {
      case "hero-warrior":
        return elementColor("red");
      case "hero-mage":
        return elementColor("blue");
      case "hero-ranger":
        return elementColor("green");
      case "hero-priest":
        return elementColor("yellow");
    }
  }

  private async hitFlashEnemy(enemyId: string): Promise<void> {
    const target = this.enemySprites.get(enemyId);
    const th = this.enemyHome.get(enemyId);
    if (!target || !th) return;
    target.setTint(0xffffff);
    this.tweens.add({
      targets: target,
      x: th.x + 10,
      duration: 70,
      yoyo: true,
      onComplete: () => this.resetActorSprite(target, th),
    });
    await this.wait(80);
    target.clearTint();
  }

  private async playEnemyAttack(ev: Extract<AttackEvent, { kind: "enemy_attack" }>): Promise<void> {
    const es = this.enemySprites.get(ev.enemyId);
    const eh = this.enemyHome.get(ev.enemyId);
    const hs = this.heroSprites.get(ev.heroId);
    const hh = this.heroHome.get(ev.heroId);
    const world = this.heroWorldCenter(ev.heroId);
    if (!es || !eh || !hs || !hh || !world) return;
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
    await this.flyProjectile(eh.x - 18, eh.y, world.x, world.y, 0xff3344);
    this.audio.sfx("hero_hit");
    this.cameras.main.shake(70, 0.005);
    this.tweens.add({
      targets: hs,
      x: hh.x - 6,
      duration: 70,
      yoyo: true,
      onComplete: () => this.resetActorSprite(hs, hh),
    });
    this.floatText(world.x, world.y - 36, `-${ev.damage}`, "#ff5555");
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

  private flyProjectile(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color: number,
    duration = 220,
  ): Promise<void> {
    const orb = this.add.circle(x1, y1, 6, color);
    return new Promise((resolve) => {
      this.tweens.add({
        targets: orb,
        x: x2,
        y: y2,
        duration,
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
    await this.wait(450);
    this.scene.start("Rewards", {
      encounterId: this.encounterId,
      defeat: true,
    });
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
    const candidates = tutorialCandidatesForEncounter(this.encounterId);
    const step = nextPendingStep(save, candidates);
    if (!step) return;
    this.currentTutorial = step;
    const copy = isCoreLoopStep(step) ? CORE_LOOP_COPY : TUTORIAL_COPY[step];
    const { width, height } = this.scale;
    const tutorialHeight = 52;
    const topMargin = Math.round(Math.min(28, Math.max(16, height * 0.035)));
    this.tutorialRoot = this.add.container(width / 2, topMargin + tutorialHeight / 2);
    const bg = this.add
      .rectangle(0, 0, Math.min(width - 24, 420), tutorialHeight, 0x1a1528, 0.94)
      .setStrokeStyle(1, 0x3a3044);
    const label = this.add
      .text(-180, 0, copy, {
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
    if (markDone && this.currentTutorial) {
      if (isCoreLoopStep(this.currentTutorial)) markCoreLoopSteps();
      else markTutorialStep(this.currentTutorial);
    }
    this.tutorialRoot?.destroy();
    this.tutorialRoot = undefined;
    this.currentTutorial = null;
  }

  private completeTutorialStep(step: TutorialStepId): void {
    const save = loadSave();
    if (isCoreLoopStep(step)) {
      if (!CORE_LOOP_STEPS.some((s) => nextPendingStep(save, [s]) === s)) return;
      markCoreLoopSteps();
      if (this.currentTutorial && isCoreLoopStep(this.currentTutorial)) {
        this.dismissTutorial(false);
        this.time.delayedCall(300, () => this.showBattleTutorial());
      }
      return;
    }
    if (nextPendingStep(save, [step]) !== step) return;
    markTutorialStep(step);
    if (this.currentTutorial === step) {
      this.dismissTutorial(false);
      this.time.delayedCall(300, () => this.showBattleTutorial());
    }
  }

  private checkAbilityTutorial(): void {
    if (this.tutorialAbilityShown || this.currentTutorial === "ability_ready") return;
    const candidates = tutorialCandidatesForEncounter(this.encounterId);
    if (!candidates.includes("ability_ready")) return;
    const ready = this.battle.heroes.some((h) => h.alive && h.charge >= h.abilityCost);
    if (!ready) return;
    const save = loadSave();
    const step = nextPendingStep(save, ["ability_ready"]);
    if (step !== "ability_ready") return;
    this.tutorialAbilityShown = true;
    if (!this.currentTutorial) this.showBattleTutorial();
  }
}
