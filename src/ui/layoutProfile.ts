/**
 * Layout profiles: desktop keeps the classic 960×720 side-by-side battle.
 * Mobile uses a taller canvas + vertical battle stack so gems stay tappable.
 */

export type LayoutProfile = "desktop" | "mobile";

export type GameSize = { width: number; height: number };

export type BattleLayoutConfig = {
  partySide: "left" | "bottom";
  enemySide: "right" | "top";
  /** Party card left edge as fraction of width (desktop). */
  partyX: number;
  /** Enemy center X as fraction of width (desktop). */
  enemyX: number;
  /** Upper battlefield (enemies) as fraction of height. */
  fieldFraction: number;
  maxGemCell: number;
  partyPortraitSize: number;
  partyCardW: number;
  partyCardH: number;
  partyTop: number;
  partyGap: number;
  /** Extra bottom chrome inset (Map / audio / potion). */
  chromeBottom: number;
  /** Side margin when sizing the gem board. */
  boardSidePad: number;
  /** Compact party cards: bars under portrait instead of beside. */
  partyBarsBelow: boolean;
  /** Enemy sprite scale factor vs desktop defaults. */
  enemyScale: number;
};

export const DESKTOP_SIZE: GameSize = { width: 960, height: 720 };
export const MOBILE_SIZE: GameSize = { width: 420, height: 760 };

export const DESKTOP_BATTLE_LAYOUT: BattleLayoutConfig = {
  partySide: "left",
  enemySide: "right",
  partyX: 0.02,
  enemyX: 0.82,
  fieldFraction: 0.52,
  maxGemCell: 50,
  partyPortraitSize: 78,
  partyCardW: 152,
  partyCardH: 92,
  partyTop: 20,
  partyGap: 6,
  chromeBottom: 24,
  boardSidePad: 120,
  partyBarsBelow: false,
  enemyScale: 1,
};

export const MOBILE_BATTLE_LAYOUT: BattleLayoutConfig = {
  partySide: "bottom",
  enemySide: "top",
  partyX: 0.02,
  enemyX: 0.5,
  /** ~240px field so 420×240 battle art cover-fits without squash. */
  fieldFraction: 0.315,
  maxGemCell: 54,
  partyPortraitSize: 48,
  partyCardW: 92,
  partyCardH: 86,
  partyTop: 8,
  partyGap: 6,
  /** Room for audio row + Potion/Map thumb row. */
  chromeBottom: 72,
  boardSidePad: 16,
  partyBarsBelow: true,
  enemyScale: 0.92,
};

/** Pick canvas size once at boot from the real viewport. */
export function resolveGameSize(
  viewportW = typeof window !== "undefined" ? window.innerWidth : DESKTOP_SIZE.width,
  viewportH = typeof window !== "undefined" ? window.innerHeight : DESKTOP_SIZE.height,
): GameSize {
  // Tall / portrait phone → portrait game canvas (avoids tiny landscape letterbox).
  if (viewportH >= viewportW && viewportW <= 900) {
    return { ...MOBILE_SIZE };
  }
  return { ...DESKTOP_SIZE };
}

export function pickLayoutProfile(gameW: number, gameH: number): LayoutProfile {
  return gameH / gameW > 1.15 ? "mobile" : "desktop";
}

export function battleLayoutFor(profile: LayoutProfile): BattleLayoutConfig {
  return profile === "mobile" ? MOBILE_BATTLE_LAYOUT : DESKTOP_BATTLE_LAYOUT;
}

export function isMobileProfile(profile: LayoutProfile): boolean {
  return profile === "mobile";
}
