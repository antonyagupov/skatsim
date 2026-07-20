import {
  MAP_SAFE,
  MOBILE_MAP_SIZE,
  estimateLabelSize,
  labelOriginX,
  nodeCircleRadius,
  type MapNodeLayout,
} from "./mapLayout";
import { MAP_NODES, type MapNodeDef } from "./mapNodes";

export type Rect = { x: number; y: number; w: number; h: number; id: string; kind: string };

export type MapCollision = {
  a: string;
  b: string;
  reason: string;
};

export type ValidateMapLayoutOpts = {
  width?: number;
  height?: number;
  mobile?: boolean;
  /** Node ids that show a subtitle line (available battles). */
  subtitleIds?: Set<string>;
  nodes?: MapNodeDef[];
};

function rectsOverlap(a: Rect, b: Rect, pad = 0): boolean {
  return !(
    a.x + a.w + pad <= b.x ||
    b.x + b.w + pad <= a.x ||
    a.y + a.h + pad <= b.y ||
    b.y + b.h + pad <= a.y
  );
}

function labelRect(
  layout: MapNodeLayout,
  canvasW: number,
  canvasH: number,
  title: string,
  hasSubtitle: boolean,
): Rect {
  const nx = layout.x * canvasW;
  const ny = layout.y * canvasH;
  const { w, h } = estimateLabelSize(title, hasSubtitle);
  const ox = labelOriginX(layout.labelAlign);
  const cx = nx + layout.labelOffsetX;
  const cy = ny + layout.labelOffsetY;
  return {
    id: layout.id,
    kind: "label",
    x: cx - w * ox,
    y: cy - h * 0.5,
    w,
    h,
  };
}

function circleRect(
  layout: MapNodeLayout,
  canvasW: number,
  canvasH: number,
  node: MapNodeDef,
  mobile: boolean,
): Rect {
  const r = nodeCircleRadius(node.kind, Boolean(node.isBoss), mobile);
  const nx = layout.x * canvasW;
  const ny = layout.y * canvasH;
  return {
    id: layout.id,
    kind: "circle",
    x: nx - r,
    y: ny - r,
    w: r * 2,
    h: r * 2,
  };
}

function tapRect(circle: Rect, label: Rect): Rect {
  const left = Math.min(circle.x, label.x);
  const top = Math.min(circle.y, label.y);
  const right = Math.max(circle.x + circle.w, label.x + label.w);
  const bottom = Math.max(circle.y + circle.h, label.y + label.h);
  let w = right - left;
  let h = bottom - top;
  let x = left;
  let y = top;
  if (w < MAP_SAFE.minTap) {
    x -= (MAP_SAFE.minTap - w) / 2;
    w = MAP_SAFE.minTap;
  }
  if (h < MAP_SAFE.minTap) {
    y -= (MAP_SAFE.minTap - h) / 2;
    h = MAP_SAFE.minTap;
  }
  return { id: circle.id, kind: "tap", x, y, w, h };
}

/**
 * Development layout checker for the designed mobile (or desktop) map.
 * Returns an empty list when the layout is clean.
 */
export function validateMapLayout(
  layout: MapNodeLayout[],
  opts: ValidateMapLayoutOpts = {},
): MapCollision[] {
  const mobile = opts.mobile !== false;
  const width = opts.width ?? (mobile ? MOBILE_MAP_SIZE.width : 512);
  const height = opts.height ?? (mobile ? MOBILE_MAP_SIZE.height : 288);
  const nodes = opts.nodes ?? MAP_NODES;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const subtitleIds = opts.subtitleIds ?? new Set<string>();

  const collisions: MapCollision[] = [];
  const circles: Rect[] = [];
  const labels: Rect[] = [];
  const taps: Rect[] = [];

  for (const item of layout) {
    const node = byId.get(item.id);
    if (!node) {
      collisions.push({ a: item.id, b: "-", reason: "missing-node-def" });
      continue;
    }
    const title = `✓ ${node.label}`;
    const hasSub = subtitleIds.has(item.id);
    const c = circleRect(item, width, height, node, mobile);
    const l = labelRect(item, width, height, title, hasSub);
    circles.push(c);
    labels.push(l);
    taps.push(tapRect(c, l));

    // Safe bounds for circle + label
    for (const r of [c, l]) {
      if (r.x < MAP_SAFE.side - 1) {
        collisions.push({ a: r.id, b: "edge", reason: `${r.kind}-left-margin` });
      }
      if (r.x + r.w > width - MAP_SAFE.side + 1) {
        collisions.push({ a: r.id, b: "edge", reason: `${r.kind}-right-margin` });
      }
      if (r.y < MAP_SAFE.top - 2) {
        collisions.push({ a: r.id, b: "edge", reason: `${r.kind}-top-margin` });
      }
      if (r.y + r.h > height - MAP_SAFE.bottom + 2) {
        collisions.push({ a: r.id, b: "edge", reason: `${r.kind}-bottom-margin` });
      }
    }

    // Label must clear its own circle (with pad), except they may touch via offset design —
    // require no deep intersection: pad = MAP_SAFE.labelPad - small slack
    if (rectsOverlap(c, l, MAP_SAFE.labelPad - 8)) {
      // Allow mild adjacency: only flag if centers are too close relative to sizes
      const cx = c.x + c.w / 2;
      const cy = c.y + c.h / 2;
      const lx = l.x + l.w / 2;
      const ly = l.y + l.h / 2;
      const dist = Math.hypot(cx - lx, cy - ly);
      const minDist = c.w / 2 + Math.min(l.w, l.h) / 2 + 8;
      if (dist < minDist) {
        collisions.push({
          a: item.id,
          b: item.id,
          reason: "label-overlaps-own-circle",
        });
      }
    }
  }

  for (let i = 0; i < circles.length; i++) {
    for (let j = i + 1; j < circles.length; j++) {
      if (rectsOverlap(circles[i], circles[j], 4)) {
        collisions.push({
          a: circles[i].id,
          b: circles[j].id,
          reason: "circle-circle",
        });
      }
    }
  }

  for (let i = 0; i < labels.length; i++) {
    for (let j = i + 1; j < labels.length; j++) {
      if (rectsOverlap(labels[i], labels[j], MAP_SAFE.labelGap - 2)) {
        collisions.push({
          a: labels[i].id,
          b: labels[j].id,
          reason: "label-label",
        });
      }
    }
  }

  for (const label of labels) {
    for (const circle of circles) {
      if (label.id === circle.id) continue;
      if (rectsOverlap(label, circle, 4)) {
        collisions.push({
          a: label.id,
          b: circle.id,
          reason: "label-other-circle",
        });
      }
    }
  }

  for (let i = 0; i < taps.length; i++) {
    for (let j = i + 1; j < taps.length; j++) {
      if (rectsOverlap(taps[i], taps[j], -2)) {
        // Slight overlap of tap zones is ok if not deep; flag only substantial
        const a = taps[i];
        const b = taps[j];
        const overlapW =
          Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        const overlapH =
          Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        if (overlapW > 12 && overlapH > 12) {
          collisions.push({
            a: a.id,
            b: b.id,
            reason: "tap-tap",
          });
        }
      }
    }
  }

  return collisions;
}

/** Build subtitle set for “all available” stress case (every battle shows subline). */
export function allBattleSubtitleIds(nodes: MapNodeDef[] = MAP_NODES): Set<string> {
  return new Set(
    nodes.filter((n) => n.kind === "battle" || n.kind === "ending").map((n) => n.id),
  );
}
