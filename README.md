# Skatsim

Browser fantasy JRPG + match-3 combat (Phaser 3 + Vite + TypeScript). **v0.2.0**

Concept: Aleksey Ivashov. Matching gems is how the party fights.

## Play

```bash
npm install
npm run dev
```

Open the local URL → **Play** (unlocks audio) → World Map.

**Live:** https://antonyagupov.github.io/skatsim/

### Controls
- **Swap:** drag adjacent gems or tap–tap (must create a match of 3+)
- **Target:** click an enemy (no damage by itself)
- **Ability:** click a glowing hero (battlefield sprite or HUD panel) when charge is full
- **Potion:** battle Potion button, then click a living hero (one use per fight)
- **Audio:** ♪ / ♫ toggles in battle; settings persist
- **Map:** leave battle back to the world map
- **Debug (dev only):** `Ctrl+Shift+D` → `window.__SKATSIM_DEBUG__`

### Loop
World Map → Battle → Rewards (gold + materials) → Village upgrades → harder nodes → Goblin Fortress boss → Chapter 2 unlock flag.

Chapter 1 nodes: Ruins Path → Forest Trail → Old Quarry → Dark Cave → Goblin Fortress.

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Dev server |
| `npm test` | Vitest unit tests |
| `npm run build` | Production build |
| `npm run generate:assets` | Optional OpenRouter art (budget-capped; not required for v0.2) |

## Architecture

- Scenes present; `src/systems/` owns pure game logic (match-3, combat, economy, tutorial)
- Save key `skatsim.save.v1` with payload `version: 2` + migration from v1
- Procedural Web Audio in `src/audio/AudioManager.ts`
- Design doc: `docs/GDD.md`
