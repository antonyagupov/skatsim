# Skatsim

Browser fantasy JRPG + match-3 combat (Phaser 3 + Vite + TypeScript). **v0.2.0**

Concept: Aleksey Ivashov. Matching gems is how the party fights.

## Play

```bash
npm install
npm run dev
```

Open the local URL → **Play** (unlocks audio) → World Map.

On a phone (portrait), the game boots a taller canvas (420×760) and a vertical battle layout; desktop stays 960×720 side-by-side. Full-bleed scenes load dedicated `*-mobile` portrait arts when available.

**Live:** https://antonyagupov.github.io/skatsim/  
Repo: https://github.com/antonyagupov/skatsim (site is served from the `gh-pages` branch)

### Controls
- **Swap:** drag adjacent gems or tap–tap (must create a match of 3+)
- **Target:** click an enemy (no damage by itself)
- **Ability:** click a glowing hero (battlefield sprite or HUD panel) when charge is full
- **Potion:** battle Potion button, then click a living hero (one use per fight)
- **Audio:** ♪ / ♫ toggles in battle; settings persist
- **Map:** leave battle back to the world map
- **Debug:** `Alt+Shift+D` dumps `window.__SKATSIM_DEBUG__` (Ctrl+Shift+D is stolen by Cursor/VS Code). Works in `npm run dev`, or on live with `?debug=1`, or after `localStorage.setItem('skatsim.debug','1')`.

### Loop
World Map → Battle → Rewards (gold + materials) → Village upgrades → harder nodes → Goblin Fortress boss → Chapter 2 (Marsh → Bridge → Watchtower) → Hollow Keep ending.

Chapter 1 nodes: Ruins Path → Forest Trail → Old Quarry → Dark Cave → Goblin Fortress.  
Chapter 2 (after boss): Marsh Crossing → Ruined Bridge → Watchtower → Hollow Keep.

### Debug console cheats (when API is on)

```js
__SKATSIM_DEBUG__.unlockAllNodes()
__SKATSIM_DEBUG__.addGold(999)
__SKATSIM_DEBUG__.winBattle()          // must be in Battle
__SKATSIM_DEBUG__.dumpState()
__SKATSIM_DEBUG__.resetSave()
```

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Dev server |
| `npm test` | Vitest unit tests |
| `npm run build` | Production build |
| `npm run deploy` | Build + publish `dist/` to `gh-pages` |
| `npm run generate:assets` | Optional OpenRouter art (budget-capped; not required for v0.2) |

## Architecture

- Scenes present; `src/systems/` owns pure game logic (match-3, combat, economy, tutorial)
- Save key `skatsim.save.v1` with payload `version: 5` + migration from older
- Procedural Web Audio in `src/audio/AudioManager.ts`
- Design doc: `docs/GDD.md`
