# Skatsim — Game Design Document

| Field | Value |
|---|---|
| **Working title** | Skatsim |
| **Concept** | Aleksey Ivashov |
| **Genre** | Fantasy JRPG + match-3 combat |
| **Platform** | Browser (desktop-first, touch-capable) |
| **Engine** | Phaser 3 + Vite + TypeScript |
| **Status** | Playable chapter loop |
| **Version** | 0.2.0 |
| **Last updated** | 2026-07-16 |

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
Main Menu
  → World Map (five battle nodes + Village)
    → Battle (match-3 combat with countdowns)
      → Rewards (gold + materials)
        → Village (spend resources) or next node
          → Boss (Goblin Fortress)
            → Chapter 2 placeholder unlock
```

---

## 4. Scenes

| Scene | Purpose |
|---|---|
| Boot / Preload | Load assets + procedural prismatic gem |
| Menu | Start; unlocks audio on Play |
| World | Chapter 1 map: Village + five battle nodes |
| Village | Mine, Training Ground, Workshop |
| Battle | Integrated battlefield + board + hero HUD |
| Rewards | Gold/materials payout, persist progress |

**Save key:** `skatsim.save.v1` (payload version field `2`, migrated from unversioned v1).

---

## 5. Battle design

### 5.1 Layout (implemented)

- **Stage:** Side-view arena, internal resolution **960×720**, pixel art, FIT scale, canvas centered by Phaser.
- **Left / party:** Four heroes face right; compact staggered formation; contact shadows.
- **Right / foes:** Enemies face left; HP, element tint, attack countdown badges.
- **Center:** Open for projectiles, VFX, damage numbers.
- **Upper ~52%:** Battlefield (normal arena or fortress boss backdrop).
- **Lower:** Compact hero HUD strip + 7×7 board (cell size capped at 40px so the board does not dominate).

### 5.2 Turn structure

1. **PLAYER_INPUT** — swap gems, fire a ready ability, or use potion.
2. **MATCH_RESOLUTION** — clear matches / prismatic clears, gravity, refill; cascades until stable.
3. **HERO_ATTACKS** — color clears activate heroes; charge from raw tiles (+ bonuses for long matches).
4. If all enemies dead → **VICTORY**.
5. Else, on a **normal** turn (not an Extra Move): reduce every living enemy countdown by 1; enemies at 0 attack and reset countdown.
6. If all heroes dead → **DEFEAT**; else **PLAYER_INPUT**.

**Extra Move (match of four):** after resolution, the player gains one extra action. That extra action does **not** reduce enemy countdowns. Consecutive Extra Moves are capped (streak ≤ 2).

### 5.3 Match-3 rules

| Rule | Value |
|---|---|
| Board size | 7×7 |
| Gem types | Flame, Ice, Leaf, Light |
| Special | Prismatic Gem (match of five) |
| Match | ≥3 in a row or column |
| Match of 4 | Extra Move + small charge bonus |
| Match of 5 | Creates Prismatic Gem + larger charge bonus |
| Prismatic | Swap with a color → clear all gems of that color |
| Dead board | Shuffle existing gems; no immediate matches; ≥1 legal move |
| Cascade mult | 1.0 → 1.15 → 1.3 → up to 1.45 |

Prismatic gems never appear on the initial generated board.

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

### 5.7 Enemy countdowns

| Enemy | Countdown | HP / Atk | Notes |
|---|---|---|---|
| Slime | 2 | 85 / 12 | Targets lowest % HP hero |
| Bat | 1 | 65 / 10 | Random living hero; frequent |
| Armored Goblin | 3 | 170 / 22 (+50 armor) | Heavy hit; armor pool absorbs first |
| Goblin Chieftain | 2→1 | 380 / 26 | Boss; see §7 |

---

## 6. World map — Chapter 1

| Node | Encounter | Rewards |
|---|---|---|
| Ruins Path | Slime + Bat | 40G, 1M |
| Forest Trail | Forest Slime + Shadow Bat | 60G, 1M |
| Old Quarry | Armored Goblin + Bat | 80G, 2M |
| Dark Cave | Elite pack | 100G, 2M |
| Goblin Fortress | **Boss** Goblin Chieftain | 160G, 4M |

Nodes unlock sequentially. Village is always available. Boss victory sets `chapter2Unlocked`.

Mine level 2 applies **+20% gold** to battle rewards.

---

## 7. Boss — Goblin Chieftain

- Element: **green**
- HP 380, attack 26; countdown max 2
- Patterns: **Cleaver Strike** (heavy ST) and **War Cry** (light party damage + next-attack bonus)
- At ≤50% HP: phase change → countdown max 1 for subsequent cycles; may summon one Bat
- Distinct fortress backdrop (`battle-boss-bg`) and dedicated `battle_boss` music track
- Beatable with targeting, Priest heals, elemental weakness, abilities, and Extra Moves

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

Two resources only: **Gold** and **Materials**. Persisted in save. Granted on Rewards screen.

---

## 10. Tutorial

Contextual, skippable prompts teach: select enemy → swap → colors → countdowns → match four → abilities → visit Village. Completion stored in `tutorialSteps` / `tutorialCompleted`. Resettable via debug.

---

## 11. Audio

Procedural Web Audio (`AudioManager`):

- Tracks: world, village, battle, battle_boss (faster battle)
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

Logic stays Phaser-free and unit-tested.

---

## 13. v0.2 success criteria

A player can clear the five-node chapter, defeat the Goblin Chieftain, spend gold/materials in the Village, upgrade heroes and buildings, keep progression after reload, and complete the tutorial loop — with party on the **left** and enemies on the **right**.

---

## 14. Out of scope (post-0.2)

- Multiple currencies, idle Mine timers, inventory items beyond the battle potion
- Full dialogue / narrative system
- Additional special gem types
- Cloud save / multiplayer

---

## 15. Appendix — constants

```
BOARD_SIZE = 7
maxGemCell = 40
fieldFraction ≈ 0.52
Ability costs: Warrior 10, Mage 12, Ranger 10, Priest 12
Hero levels: 1–3 (+12% stats per level above 1)
Building levels: 1–2
Cascade mult: 1 / 1.15 / 1.3 / ≤1.45
Elements: R>G>Y>B>R
Battle layout: partyX≈0.14, enemyX≈0.82
Ruins: Slime 85/12, Bat 65/10
Boss: Goblin Chieftain 380/26
```

Primary sources of truth:

- `src/systems/match3/board.ts`
- `src/systems/BattleController.ts`
- `src/systems/combat/*`
- `src/data/mapNodes.ts`
- `src/data/save.ts`
