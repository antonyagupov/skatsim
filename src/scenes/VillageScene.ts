import Phaser from "phaser";
import { AudioManager } from "../audio/AudioManager";
import { HERO_IDS, type HeroId } from "../assets/types";
import { loadSave, updateSave } from "../data/save";
import { HERO_DEFS } from "../systems/combat/heroes";
import {
  FACILITIES,
} from "../systems/economy/rewards";
import {
  MAX_BUILDING_LEVEL,
  MAX_HERO_LEVEL,
  buildingUpgradeCost,
  heroUpgradeCost,
  potionHealFraction,
  scaledHeroStats,
  type BuildingId,
} from "../systems/combat/progression";
import { markTutorialStep, nextPendingStep, TUTORIAL_COPY } from "../systems/tutorial/TutorialManager";
import { addAudioControls } from "../ui/AudioControls";

export class VillageScene extends Phaser.Scene {
  private panel!: Phaser.GameObjects.Container;
  private goldText!: Phaser.GameObjects.Text;
  private matText!: Phaser.GameObjects.Text;

  constructor() {
    super("Village");
  }

  create(): void {
    const audio = AudioManager.get();
    void audio.unlock().then(() => audio.playTrack("village"));
    const save = loadSave();
    // Village tutorial only after Forest — don't auto-complete on early visits.
    if (save.forestNodeCompleted) {
      const pending = nextPendingStep(save, ["visit_village"]);
      if (pending === "visit_village") {
        markTutorialStep("visit_village");
        this.showVillageTutorial();
      }
    }

    const { width, height } = this.scale;
    if (this.textures.exists("env-village")) {
      this.add.image(width / 2, height / 2, "env-village").setDisplaySize(width, height);
    } else {
      this.add.rectangle(width / 2, height / 2, width, height, 0x6a5a40);
    }

    this.add.rectangle(width / 2, 36, width, 56, 0x0c0a12, 0.72);
    this.add
      .text(24, 28, "Village", {
        fontFamily: "Cinzel, Palatino, serif",
        fontSize: "24px",
        color: "#f2e9d8",
      })
      .setOrigin(0, 0.5);

    this.goldText = this.add
      .text(width / 2 - 20, 28, "", {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#f0c050",
      })
      .setOrigin(0, 0.5);
    this.matText = this.add
      .text(width / 2 + 90, 28, "", {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#a0c8e0",
      })
      .setOrigin(0, 0.5);

    if (this.textures.exists("icon-gold")) {
      this.add.image(width / 2 - 40, 28, "icon-gold").setDisplaySize(22, 22);
    }
    if (this.textures.exists("icon-materials")) {
      this.add.image(width / 2 + 70, 28, "icon-materials").setDisplaySize(22, 22);
    }

    const back = this.add
      .text(width - 24, 28, "← Map", {
        fontFamily: "monospace",
        fontSize: "15px",
        color: "#1a1008",
        backgroundColor: "#c8b090",
        padding: { x: 10, y: 6 },
      })
      .setOrigin(1, 0.5)
      .setInteractive({ useHandCursor: true });
    back.on("pointerdown", () => {
      audio.sfx("ui_click");
      this.scene.start("World");
    });

    this.panel = this.add.container(0, 0);
    this.refresh();
    addAudioControls(this);
  }

  private refresh(): void {
    const audio = AudioManager.get();
    const save = loadSave();
    const { width, height } = this.scale;
    this.panel.removeAll(true);
    this.goldText.setText(`${save.gold}`);
    this.matText.setText(`${save.materials}`);

    const facilityIcon: Record<string, string> = {
      mine: "facility-mine",
      training: "facility-training",
      workshop: "facility-workshop",
    };

    // Facility buildings with visual level states
    FACILITIES.forEach((fac, i) => {
      const x = width * (0.22 + i * 0.28);
      const y = height * 0.4;
      const level = save.buildingLevels[fac.id];
      const body = this.add
        .rectangle(x, y, 150, 130, level >= 2 ? 0x3a4a38 : 0x2a2830)
        .setStrokeStyle(2, level >= 2 ? 0xf0c050 : 0x6a6058);
      this.panel.add(body);

      const iconKey = facilityIcon[fac.id];
      if (iconKey && this.textures.exists(iconKey)) {
        this.panel.add(
          this.add.image(x, y - 8, iconKey).setDisplaySize(72, 72),
        );
      } else if (fac.id === "mine") {
        this.panel.add(this.add.rectangle(x - 40, y + 20, 24, 36, 0x5a5040));
        if (level >= 2) {
          this.panel.add(this.add.rectangle(x + 36, y - 10, 10, 28, 0x888888));
          this.panel.add(this.add.circle(x + 36, y - 28, 8, 0xaaaaaa, 0.5));
        }
      } else if (fac.id === "training") {
        this.panel.add(this.add.rectangle(x, y + 30, 70, 8, 0x8a7060));
        if (level >= 2) {
          this.panel.add(this.add.rectangle(x - 30, y, 8, 40, 0xc8a060));
          this.panel.add(this.add.rectangle(x + 30, y, 8, 40, 0xc8a060));
        }
      } else {
        this.panel.add(this.add.rectangle(x, y + 10, 50, 40, 0x4a3a2a));
        if (level >= 2) {
          this.panel.add(this.add.circle(x + 28, y - 24, 6, 0xff8040));
          this.panel.add(this.add.circle(x + 28, y - 34, 4, 0xffc080, 0.7));
        }
      }

      if (fac.id === "training" && this.textures.exists("icon-warriors")) {
        this.panel.add(
          this.add.image(x + 48, y + 36, "icon-warriors").setDisplaySize(28, 28),
        );
      }

      this.panel.add(
        this.add
          .text(x, y - 48, `${fac.name}`, {
            fontFamily: "monospace",
            fontSize: "12px",
            color: "#f2e9d8",
          })
          .setOrigin(0.5)
          .setShadow(1, 1, "#0a0810", 2, false, true),
      );
      this.panel.add(
        this.add
          .text(x, y + 58, `Lv ${level}/${MAX_BUILDING_LEVEL}`, {
            fontFamily: "monospace",
            fontSize: "11px",
            color: "#a89888",
          })
          .setOrigin(0.5),
      );

      body.setInteractive({ useHandCursor: true });
      body.on("pointerdown", () => {
        audio.sfx("ui_click");
        this.openFacility(fac.id);
      });
    });

    // Bottom help
    this.panel.add(
      this.add
        .text(width / 2, height - 28, "Select a facility to upgrade or train", {
          fontFamily: "monospace",
          fontSize: "12px",
          color: "#c8b8a0",
        })
        .setOrigin(0.5),
    );
  }

  private openFacility(id: BuildingId): void {
    const audio = AudioManager.get();
    const save = loadSave();
    const { width, height } = this.scale;
    const overlay = this.add.container(0, 0);
    const backdrop = this.add
      .rectangle(width / 2, height / 2, width, height, 0x000000, 0.55)
      .setInteractive();
    overlay.add(backdrop);
    const box = this.add
      .rectangle(width / 2, height / 2, 420, 360, 0x1a1520)
      .setStrokeStyle(2, 0xf0c050)
      .setInteractive();
    overlay.add(box);

    const fac = FACILITIES.find((f) => f.id === id)!;
    const level = save.buildingLevels[id];
    const facilityIcon: Record<string, string> = {
      mine: "facility-mine",
      training: "facility-training",
      workshop: "facility-workshop",
    };
    const iconKey = facilityIcon[id];
    if (iconKey && this.textures.exists(iconKey)) {
      overlay.add(
        this.add.image(width / 2 - 160, height / 2 - 150, iconKey).setDisplaySize(40, 40),
      );
    }
    if (id === "training" && this.textures.exists("icon-warriors")) {
      overlay.add(
        this.add.image(width / 2 + 150, height / 2 - 150, "icon-warriors").setDisplaySize(36, 36),
      );
    }
    overlay.add(
      this.add
        .text(width / 2, height / 2 - 150, fac.name, {
          fontFamily: "monospace",
          fontSize: "20px",
          color: "#f2e9d8",
        })
        .setOrigin(0.5),
    );
    overlay.add(
      this.add
        .text(width / 2, height / 2 - 120, fac.description, {
          fontFamily: "monospace",
          fontSize: "12px",
          color: "#a89888",
          align: "center",
          wordWrap: { width: 360 },
        })
        .setOrigin(0.5),
    );

    const close = () => {
      audio.sfx("ui_click");
      overlay.destroy(true);
      this.refresh();
    };

    backdrop.on("pointerdown", close);
    // Clicks on the panel itself should not close the modal.
    box.on("pointerdown", (_pointer: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
    });

    const closeBtn = this.add
      .text(width / 2 + 180, height / 2 - 155, "✕", {
        fontFamily: "monospace",
        fontSize: "18px",
        color: "#f2e9d8",
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    closeBtn.on("pointerdown", close);
    overlay.add(closeBtn);

    if (id === "training") {
      HERO_IDS.forEach((hid, i) => {
        const y = height / 2 - 70 + i * 52;
        const lv = save.heroLevels[hid];
        const cur = scaledHeroStats(hid, lv);
        const next =
          lv < MAX_HERO_LEVEL ? scaledHeroStats(hid, lv + 1) : null;
        const cost = heroUpgradeCost(lv);
        overlay.add(
          this.add
            .text(width / 2 - 180, y, `${HERO_DEFS[hid].name} Lv${lv}`, {
              fontFamily: "monospace",
              fontSize: "13px",
              color: "#f2e9d8",
            })
            .setOrigin(0, 0.5),
        );
        overlay.add(
          this.add
            .text(
              width / 2 - 180,
              y + 16,
              next
                ? `HP ${cur.maxHp}→${next.maxHp}  DMG ${cur.baseDamage}→${next.baseDamage}`
                : `HP ${cur.maxHp}  DMG ${cur.baseDamage}  MAX`,
              {
                fontFamily: "monospace",
                fontSize: "10px",
                color: "#a89888",
              },
            )
            .setOrigin(0, 0.5),
        );
        if (next && cost > 0) {
          const btn = this.add
            .text(width / 2 + 100, y, `Train ${cost}G`, {
              fontFamily: "monospace",
              fontSize: "12px",
              color: save.gold >= cost ? "#1a1008" : "#666",
              backgroundColor: save.gold >= cost ? "#d06a2e" : "#444",
              padding: { x: 8, y: 4 },
            })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: save.gold >= cost });
          btn.on("pointerdown", () => {
            const s = loadSave();
            if (s.gold < cost || s.heroLevels[hid] >= MAX_HERO_LEVEL) return;
            updateSave({
              gold: s.gold - cost,
              heroLevels: { [hid]: s.heroLevels[hid] + 1 } as Record<
                HeroId,
                number
              >,
            });
            audio.sfx("level_up");
            overlay.destroy(true);
            this.openFacility(id);
          });
          overlay.add(btn);
        }
      });
      return;
    }

    // Mine / Workshop upgrade
    const effect =
      id === "mine"
        ? level >= 2
          ? "Gold from battles +20%"
          : "Level 2: +20% gold from battles"
        : level >= 2
          ? `Potion heals ${Math.round(potionHealFraction(2) * 100)}% HP`
          : `Potion heals ${Math.round(potionHealFraction(1) * 100)}% HP → Lv2: ${Math.round(potionHealFraction(2) * 100)}%`;

    overlay.add(
      this.add
        .text(width / 2, height / 2 - 40, `Current: Lv ${level}`, {
          fontFamily: "monospace",
          fontSize: "14px",
          color: "#f0c050",
        })
        .setOrigin(0.5),
    );
    overlay.add(
      this.add
        .text(width / 2, height / 2, effect, {
          fontFamily: "monospace",
          fontSize: "13px",
          color: "#f2e9d8",
          align: "center",
          wordWrap: { width: 340 },
        })
        .setOrigin(0.5),
    );

    if (level < MAX_BUILDING_LEVEL) {
      const cost = buildingUpgradeCost(id, level);
      const can =
        save.gold >= cost.gold && save.materials >= cost.materials;
      const btn = this.add
        .text(
          width / 2,
          height / 2 + 80,
          `Upgrade ${cost.gold}G + ${cost.materials}M`,
          {
            fontFamily: "monospace",
            fontSize: "16px",
            color: can ? "#1a1008" : "#666",
            backgroundColor: can ? "#d06a2e" : "#444",
            padding: { x: 16, y: 10 },
          },
        )
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: can });
      btn.on("pointerdown", () => {
        const s = loadSave();
        const c = buildingUpgradeCost(id, s.buildingLevels[id]);
        if (s.gold < c.gold || s.materials < c.materials) return;
        updateSave({
          gold: s.gold - c.gold,
          materials: s.materials - c.materials,
          buildingLevels: { [id]: s.buildingLevels[id] + 1 } as Record<
            BuildingId,
            number
          >,
        });
        audio.sfx("facility_upgrade");
        close();
      });
      overlay.add(btn);
    } else {
      overlay.add(
        this.add
          .text(width / 2, height / 2 + 80, "Fully upgraded", {
            fontFamily: "monospace",
            fontSize: "14px",
            color: "#88c070",
          })
          .setOrigin(0.5),
      );
    }
  }

  private showVillageTutorial(): void {
    const { width } = this.scale;
    const banner = this.add.container(width / 2, 72);
    const bg = this.add
      .rectangle(0, 0, Math.min(width - 24, 400), 44, 0x1a1528, 0.94)
      .setStrokeStyle(1, 0x3a3044);
    const label = this.add
      .text(0, 0, TUTORIAL_COPY.visit_village, {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#f2e9d8",
      })
      .setOrigin(0.5);
    banner.add([bg, label]);
    this.tweens.add({
      targets: banner,
      alpha: 0,
      delay: 2800,
      duration: 400,
      onComplete: () => banner.destroy(),
    });
  }
}
