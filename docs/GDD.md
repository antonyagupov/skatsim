# Skatsim — Game Design Document

| Field | Value |
|---|---|
| **Working title** | Skatsim |
| **Concept** | Aleksey Ivashov |
| **Genre** | Fantasy JRPG + match-3 combat |
| **Platform** | Browser (desktop-first, touch-capable) |
| **Engine** | Phaser 3 + Vite + TypeScript |
| **Status** | Playable Chapter 1 + Chapter 2 + ending |
| **Version** | 0.2.0 (package); content beyond original v0.2 slice |
| **Last updated** | 2026-07-18 |

---

## 1. High concept

A party of four heroes fights on a single integrated battle screen where **matching gems is how attacks happen**. There is no separate puzzle mode — every legal swap clears gems, charges heroes, and deals (or heals) damage in the same space as the combatants.

**One-liner:** Match gems to command a JRPG party on one battlefield.

---

## 2. Design pillars

1. **Matches are combat.** Board clears map 1:1 to hero actions.
2. **One screen, one fight.** Heroes, enemies, board, targeting, and abilities live together.
3. **Role clarity through color.** Each gem color owns one hero and one combat job.
4. **Cascades reward planning.** Gravity and refill create chains; later cascades deal more.
5. **Readable fantasy.** Late-SNES / 16-bit JRPG visual language.

---

## 3. Core loop (implemented)

```
Boot → Preload (load bar)
  → Splash (SKATSIM / A MATCH-3 FANTASY on splash-match3)
  → Menu (party splash-bg)
    → Intro (visual novel, once if !introSeen)
    → World Map
      → Village | Chapter 1 battles | Chapter 2 battles | Hollow Keep
        → Battle → Rewards → World
        → Ending (Hollow Keep) → resetSave → Menu
```

---

## 4. Scenes

| Scene | Purpose |
|---|---|
| Boot / Preload | Load assets; procedural prismatic gem; short title splash |
| Menu | Play unlocks audio; routes to Intro or World |
| Intro | One-shot VN party intro (`introSeen`) |
| World | Map graph: Village + Ch.1 + Ch.2 + Hollow Keep |
| Village | Mine, Training Ground, Workshop |
| Battle | Arena + left portrait cards + 7×7 board |
| Rewards | Gold/materials payout, persist progress |
| Ending | Hollow Keep dialogue → memory wipe / save reset |

**Save key:** `skatsim.save.v1` (payload `version: 5`, migrated from older payloads). `memoryWipes` persists across Hollow Keep resets and scales enemy HP/ATK/armor by +15% per wipe.

**Splash art:**
- `splash-match3` — gem ritual altar (post-load title beat only)
- `splash-bg` — party lineup (Menu + Intro)

---

## 5. Battle design

### 5.1 Layout (implemented)

- **Desktop:** Side-view arena, internal resolution **960×720**, pixel art, FIT scale, canvas centered by Phaser. Party left / enemies right.
- **Mobile (portrait):** Canvas **420×760**, vertical stack — enemies in a short top field band, party cards under the field, gem board below. See `src/ui/layoutProfile.ts`.
- **Art:** Full-bleed scenes use landscape keys on desktop and `*-mobile` portrait variants on mobile (`resolveSceneTexture` / `addSceneBackground` in `src/ui/sceneArt.ts`). Missing mobile art falls back to cover-crop of the landscape texture.
- **Upper field (`fieldFraction`):** ~52% desktop / ~28% mobile. Normal arena or fortress boss backdrop.
- **Party:** Portrait cards with HP / charge / shield bars; ability glow when ready. Mobile uses compact cards with bars under the portrait.
- **Foes:** Desktop right-side staging; mobile centered in the top field band.
- **Lower:** 7×7 board (`maxGemCell` 50 desktop / 54 mobile; mobile cell floored at 36px).

Desktop constants: `partyX≈0.02`, `enemyX≈0.82`, `partyPortraitSize=78` (`DESKTOP_BATTLE_LAYOUT`). Mobile: `partyPortraitSize=48`, `enemyScale=0.92` (`MOBILE_BATTLE_LAYOUT`).

### 5.2 Turn structure

1. **PLAYER_INPUT** — swap gems, fire a ready ability, or use potion.
2. **MATCH_RESOLUTION** — clear matches / prismatic clears, gravity, refill; cascades until stable.
3. **HERO_ATTACKS** — color clears activate heroes; charge from raw tiles (+ bonuses for long matches).
4. If all enemies dead → **VICTORY**.
5. Else, on a **normal** turn (not an Extra Move): reduce every living enemy countdown by 1; enemies at 0 attack and reset countdown.
6. If all heroes dead → **DEFEAT**; else **PLAYER_INPUT**.

**Extra Move (match of four):** after resolution, the player gains one extra action. That extra action does **not** reduce enemy countdowns. Consecutive Extra Moves are capped (streak ≤ 2). Match of four also creates a **Line Gem** (row or column, from match axis).

### 5.3 Match-3 rules

| Rule | Value |
|---|---|
| Board size | 7×7 |
| Gem types | Flame, Ice, Leaf, Light |
| Specials | Prismatic (match of 5); Line H/V (match of 4) |
| Match | ≥3 in a row or column |
| Match of 4 | Extra Move + Line Gem + small charge bonus |
| Match of 5 | Creates Prismatic Gem + larger charge bonus |
| Line Gem | Swap with any adjacent gem → clear that row or column; cascades continue |
| Prismatic | Swap with a color → clear all gems of that color |
| Dead board | Shuffle existing gems; no immediate matches; ≥1 legal move |
| Cascade mult | 1.0 → 1.15 → 1.3 → up to 1.45 |
| Cascade VFX | Clear flash → gravity fall → fill from top (short tweens) |

Prismatic gems never appear on the initial generated board.

### 5.3b Status effects (light layer)

| Status | Source | Effect |
|---|---|---|
| Burn | Flame matches / Warrior ability | DoT ~10% of dealt match damage at end of enemy phase, 2 turns |
| Freeze | Ice matches / Mage ability | Cancels the next enemy attack once |

### 5.3c Encounter objectives

Most battles are **eliminate** (kill all enemies). Watchtower is **survive 6 turns** (party must still have ≥1 hero alive). Defeat grants ~15% salvage gold/materials (no node completion).

Enemy countdown badges show a telegraph letter: `!` single, `C` cleaver, `W` war cry; tint intensifies when countdown ≤ 1.

### 5.4 Gem ↔ hero mapping

| Gem | Hero | Match role | Ability | Cost |
|---|---|---|---|---|
| Flame | Warrior | Selected single-target | Flame Strike | 10 |
| Ice | Mage | All living enemies | Ice Nova | 12 |
| Leaf | Ranger | Lowest % HP enemy | Marked Shot | 10 |
| Light | Priest | Party heal + poke | Restoring Light | 12 |

### 5.5 Elements

Cycle (strong →):

- **Red** strong vs **Green**
- **Green** strong vs **Yellow**
- **Yellow** strong vs **Blue**
- **Blue** strong vs **Red**

Modifiers: strong ×1.5 (`WEAK`), weak ×0.75 (`RESIST`), else ×1.0.

### 5.6 Abilities (implemented)

| Hero | Ability | Effect |
|---|---|---|
| Warrior | Flame Strike | High ST damage on selected; screen shake |
| Mage | Ice Nova | Medium AoE to all living enemies |
| Ranger | Marked Shot | Lowest % HP; ×1.5 if target below 35% HP |
| Priest | Restoring Light | Heal all living heroes; excess → temporary shield (cap 30% max HP) |

### 5.7 Enemy countdowns (base defs)

| Enemy | Countdown | HP / Atk | Notes |
|---|---|---|---|
| Slime | 2 | 150 / 10 | Lowest % HP hero |
| Bat | 1 | 120 / 8 | Random living hero |
| Forest Slime | 2 | 210 / 13 | Ch.1 ramp |
| Shadow Bat | 1 | 160 / 11 | Ch.1 / Ch.2 |
| Armored Goblin | 3 | 320 / 21 (+100 armor) | Armor pool first |
| Cave Slime | 2 | 230 / 14 | Cave breather |
| Goblin Chieftain | 2→1 | 900 / 29 | Boss; see §7 |
| Marsh Slime | 2 | 300 / 16 | Ch.2 |
| Wraith | 2 | 320 / 18 | Yellow; Ch.2 |

**Match → combat VFX:** one match resolve produces one wave of hero attacks; projectiles and hit-flash on targets. WEAK / RESIST float text on elemental affinity.

Hero training: **+22% stats per level** above 1 (Lv3 ≈ ×1.44). Balance notes: `docs/balance-ch1.csv`.

---

## 6. World map

### Chapter 1

| Node | Encounter | Rewards |
|---|---|---|
| Ruins Path | Slime + Bat | 40G, 1M |
| Forest Trail | Forest Slime + Shadow Bat | 60G, 1M |
| Old Quarry | Armored Goblin + Bat | 80G, 2M |
| Dark Cave | Shadow Bat + Cave Slime | 120G, 3M |
| Goblin Fortress | **Boss** Goblin Chieftain | 160G, 4M |

Difficulty curve: hook → ramp → mid spike → breather → episode peak.

Nodes unlock sequentially. Village is always available. Boss victory sets `chapter2Unlocked`.

### Chapter 2 (after fortress)

| Node | Encounter | Rewards |
|---|---|---|
| Marsh Crossing | Marsh Slime + Wraith | 120G, 3M |
| Ruined Bridge | Wraith + Shadow Bat | 140G, 3M |
| Watchtower | Wraith + Armored Goblin + Bat | 180G, 5M |
| **Hollow Keep** | Ending dialogue (no fight) | — |

Hollow Keep unlocks after Watchtower (`watchtowerNodeCompleted`). Sets `hollowKeepCompleted` / `endingSeen`, then `EndingScene` runs a meta dialogue and **resets save** → Menu.

Mine level 2 applies **+20% gold** to battle rewards.

Map art: `env-worldmap`. Node labels use dark underlays for contrast.

---

## 7. Boss — Goblin Chieftain

- Element: **green**
- HP 900, attack 29; countdown max 2
- Patterns: **Cleaver Strike** (heavy ST) and **War Cry** (light party damage + next-attack bonus)
- At ≤50% HP: phase change → countdown max 1 for subsequent cycles; may summon one Bat
- Distinct fortress backdrop (`battle-boss-bg`) and dedicated `battle_boss` music track
- Beatable with targeting, Priest heals, elemental weakness, abilities, Extra Moves, and Village upgrades

---

## 8. Village

| Facility | Levels | Effect |
|---|---|---|
| Mine | 1–2 | Lv2: +20% battle gold |
| Training Ground | 1–2 | Hero training to level 3 (HP/damage/ability strength) |
| Workshop | 1–2 | Healing Potion each battle (30% → 45% max HP at Lv2) |

Facilities show distinct visual states at level 2 (props/overlays). Potion restores automatically at battle start (one use per fight).

---

## 9. Economy

Two resources only: **Gold** and **Materials**. Persisted in save. Granted on Rewards screen. Tables live in `src/systems/economy/rewards.ts`.

---

## 10. Tutorial

Gated by encounter; short banners (skippable):

| Encounter | Prompt focus |
|---|---|
| Ruins | Core loop: tap enemy + match 3+ (select / swap / color as one banner) |
| Forest | Countdown threat |
| Quarry | Armor / Extra Move |
| Cave+ | Ability ready |
| Village | After Forest — spend gold before the boss |

Completion stored in `tutorialSteps` / `tutorialCompleted`. Resettable via debug.

---

## 11. Audio

Procedural Web Audio (`AudioManager`):

- Tracks: `world`, `village`, `battle`, `battle_boss`, `ending`
- Same track id does not restart (no duplicate loops)
- SFX for match 3/4/5, Extra Move, special gem, elements, countdown, upgrades, rewards, boss phase
- Volumes/mute persist in save

---

## 12. Technical architecture

| Layer | Responsibility |
|---|---|
| `src/systems/match3/` | Board, special gems, shuffle |
| `src/systems/combat/` | Heroes, enemies, elements, formulas, targeting, progression |
| `src/systems/BattleController.ts` | Turn orchestration / state machine |
| `src/systems/economy/` | Rewards |
| `src/systems/tutorial/` | Tutorial steps |
| `src/data/` | Save migration + map graph |
| `src/scenes/*` | Presentation only |
| `src/audio/*` | Music / SFX |

Logic stays Phaser-free and unit-tested. Vite `base: "/skatsim/"` for GitHub Pages; asset paths resolved via `import.meta.env.BASE_URL`.

---

## 13. Current success criteria

A player can:

1. See title splash → Menu → Intro (once) → World.
2. Clear Chapter 1 (five nodes), defeat the Goblin Chieftain, use Village upgrades.
3. Continue into Chapter 2 (Marsh → Bridge → Watchtower).
4. Reach Hollow Keep ending and return to a fresh Menu save.
5. Keep mid-run progress across reloads; complete the gated tutorial.

Party on the **left** (portrait cards), enemies on the **right**.

---

## 14. Out of scope (next)

- Multiple currencies, idle Mine timers, inventory beyond the battle potion
- Full reusable dialogue / quest system (Intro + Ending stay one-off)
- Additional special gem types
- Cloud save / multiplayer
- Building Lv3 / hero passives beyond current scaling

---

## 15. Appendix — constants

```
BOARD_SIZE = 7
maxGemCell = 50
fieldFraction ≈ 0.52
Ability costs: Warrior 10, Mage 12, Ranger 10, Priest 12
Hero levels: 1–3 (+22% stats per level above 1)
Building levels: 1–2
Cascade mult: 1 / 1.15 / 1.3 / ≤1.45
Elements: R>G>Y>B>R
Battle layout: party cards left (partyX≈0.02), enemyX≈0.82
partyPortraitSize = 78, partyCardW = 152, partyCardH = 92
Ruins: Slime 150/10, Bat 120/8
Boss: Goblin Chieftain 900/29
Wraith: 320/18 (yellow)
Save: skatsim.save.v1 version 5
Flags: introSeen, chapter2Unlocked, marsh/bridge/watchtower/hollowKeepCompleted, endingSeen
Splash: splash-match3 (title), splash-bg (menu/intro)
Ending: Hollow Keep → EndingScene → resetSave → Menu
```

Primary sources of truth:

- `src/systems/match3/board.ts`
- `src/systems/BattleController.ts`
- `src/systems/combat/*`
- `src/data/mapNodes.ts`
- `src/data/save.ts`
- `docs/balance-ch1.csv`
