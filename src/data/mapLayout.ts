/**
 * Explicit designed layout for the world map (mobile 420×760 primary).
 * Label offsets are pixels relative to the node circle center.
 */

export type MapLabelAlign = "left" | "center" | "right";

export type MapNodeLayout = {
  id: string;
  /** Fraction of canvas width (0–1). */
  x: number;
  /** Fraction of canvas height (0–1). */
  y: number;
  /** Label card X offset from node center (px). */
  labelOffsetX: number;
  /** Label card Y offset from node center (px). */
  labelOffsetY: number;
  labelAlign: MapLabelAlign;
};

/** Portrait canvas the mobile layout is designed against. */
export const MOBILE_MAP_SIZE = { width: 420, height: 760 } as const;

/** Safe margins (px) from canvas edges / chrome. */
export const MAP_SAFE = {
  top: 56,
  bottom: 48,
  side: 24,
  labelPad: 20,
  labelGap: 12,
  minTap: 44,
} as const;

/**
 * Serpentine Ch1 (top→fortress) then Ch2 (marsh→keep).
 * Hollow Keep label sits to the left so it clears Watchtower vertically.
 */
export const MOBILE_MAP_LAYOUT: MapNodeLayout[] = [
  {
    id: "village",
    x: 0.5,
    y: 0.12,
    labelOffsetX: 0,
    labelOffsetY: 48,
    labelAlign: "center",
  },
  {
    id: "ruins-path",
    x: 0.22,
    y: 0.25,
    labelOffsetX: 48,
    labelOffsetY: 0,
    labelAlign: "left",
  },
  {
    id: "forest-trail",
    x: 0.78,
    y: 0.34,
    labelOffsetX: -48,
    labelOffsetY: 0,
    labelAlign: "right",
  },
  {
    id: "old-quarry",
    x: 0.22,
    y: 0.43,
    labelOffsetX: 48,
    labelOffsetY: 0,
    labelAlign: "left",
  },
  {
    id: "dark-cave",
    x: 0.78,
    y: 0.5,
    labelOffsetX: -48,
    labelOffsetY: 0,
    labelAlign: "right",
  },
  {
    id: "goblin-fortress",
    x: 0.5,
    y: 0.58,
    labelOffsetX: 0,
    labelOffsetY: 48,
    labelAlign: "center",
  },
  {
    id: "marsh-crossing",
    x: 0.22,
    y: 0.7,
    labelOffsetX: 48,
    labelOffsetY: 0,
    labelAlign: "left",
  },
  {
    id: "ruined-bridge",
    x: 0.78,
    y: 0.76,
    labelOffsetX: -48,
    labelOffsetY: 0,
    labelAlign: "right",
  },
  {
    id: "watchtower",
    x: 0.2,
    y: 0.82,
    labelOffsetX: 48,
    labelOffsetY: 0,
    labelAlign: "left",
  },
  {
    id: "hollow-keep",
    x: 0.78,
    y: 0.89,
    labelOffsetX: -52,
    labelOffsetY: 0,
    labelAlign: "right",
  },
];

/** Chapter transition line between fortress card and marsh (must clear both). */
export const MOBILE_CHAPTER_BAND_Y = 0.675;

/**
 * Classic landscape layout (pre-redesign). Labels below nodes.
 * Mobile serpentine lives in MOBILE_MAP_LAYOUT only.
 */
export const DESKTOP_MAP_LAYOUT: MapNodeLayout[] = [
  { id: "village", x: 0.18, y: 0.48, labelOffsetX: 0, labelOffsetY: 36, labelAlign: "center" },
  { id: "ruins-path", x: 0.34, y: 0.62, labelOffsetX: 0, labelOffsetY: 36, labelAlign: "center" },
  { id: "forest-trail", x: 0.48, y: 0.42, labelOffsetX: 0, labelOffsetY: 36, labelAlign: "center" },
  { id: "old-quarry", x: 0.62, y: 0.58, labelOffsetX: 0, labelOffsetY: 36, labelAlign: "center" },
  { id: "dark-cave", x: 0.74, y: 0.38, labelOffsetX: 0, labelOffsetY: 36, labelAlign: "center" },
  { id: "goblin-fortress", x: 0.86, y: 0.55, labelOffsetX: 0, labelOffsetY: 36, labelAlign: "center" },
  { id: "marsh-crossing", x: 0.28, y: 0.28, labelOffsetX: 0, labelOffsetY: 36, labelAlign: "center" },
  { id: "ruined-bridge", x: 0.44, y: 0.22, labelOffsetX: 0, labelOffsetY: 36, labelAlign: "center" },
  { id: "watchtower", x: 0.6, y: 0.18, labelOffsetX: 0, labelOffsetY: 36, labelAlign: "center" },
  { id: "hollow-keep", x: 0.76, y: 0.14, labelOffsetX: 0, labelOffsetY: 36, labelAlign: "center" },
];

const mobileById = new Map(MOBILE_MAP_LAYOUT.map((l) => [l.id, l]));
const desktopById = new Map(DESKTOP_MAP_LAYOUT.map((l) => [l.id, l]));

export function getMapNodeLayout(id: string, mobile: boolean): MapNodeLayout | undefined {
  return (mobile ? mobileById : desktopById).get(id);
}

export function mapLayoutList(mobile: boolean): MapNodeLayout[] {
  return mobile ? MOBILE_MAP_LAYOUT : DESKTOP_MAP_LAYOUT;
}

export function estimateLabelSize(
  title: string,
  hasSubtitle: boolean,
): { w: number; h: number } {
  const w = Math.min(120, Math.max(64, 12 + title.length * 6.4));
  const h = hasSubtitle ? 32 : 18;
  return { w, h };
}

export function labelOriginX(align: MapLabelAlign): number {
  if (align === "left") return 0;
  if (align === "right") return 1;
  return 0.5;
}

export function nodeCircleRadius(
  kind: "village" | "battle" | "hub" | "ending",
  isBoss: boolean,
  mobile: boolean,
): number {
  const base = kind === "village" ? 22 : isBoss ? 20 : 16;
  return base + (mobile ? 4 : 0);
}
