#!/usr/bin/env node
/**
 * Development-only procedural PNG placeholders.
 * Game remains runnable without any paid image API.
 */

import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";
import { ASSET_SPECS, GEM_IDS } from "./asset-catalog.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const PUBLIC = join(ROOT, "public");

/** CRC32 for PNG chunks */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  const crc = crc32(Buffer.concat([typeBuf, data]));
  crcBuf.writeUInt32BE(crc, 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

/** @param {number} w @param {number} h @param {Uint8ClampedArray} rgba */
function encodePng(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    const rowStart = y * (w * 4 + 1);
    raw[rowStart] = 0;
    for (let x = 0; x < w; x++) {
      const si = (y * w + x) * 4;
      const di = rowStart + 1 + x * 4;
      raw[di] = rgba[si];
      raw[di + 1] = rgba[si + 1];
      raw[di + 2] = rgba[si + 2];
      raw[di + 3] = rgba[si + 3];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function ensureDir(filePath) {
  mkdirSync(dirname(filePath), { recursive: true });
}

function setPixel(rgba, w, x, y, r, g, b, a = 255) {
  if (x < 0 || y < 0 || x >= w || y >= rgba.length / (w * 4)) return;
  const i = (y * w + x) * 4;
  rgba[i] = r;
  rgba[i + 1] = g;
  rgba[i + 2] = b;
  rgba[i + 3] = a;
}

function fillRect(rgba, w, x0, y0, rw, rh, r, g, b, a = 255) {
  for (let y = y0; y < y0 + rh; y++) {
    for (let x = x0; x < x0 + rw; x++) setPixel(rgba, w, x, y, r, g, b, a);
  }
}

function fillCircle(rgba, w, cx, cy, rad, r, g, b, a = 255) {
  const r2 = rad * rad;
  for (let y = -rad; y <= rad; y++) {
    for (let x = -rad; x <= rad; x++) {
      if (x * x + y * y <= r2) setPixel(rgba, w, cx + x, cy + y, r, g, b, a);
    }
  }
}

/** Deterministic hash color accent from id */
function accent(id) {
  const h = createHash("sha1").update(id).digest();
  return [h[0], h[1], h[2]];
}

function drawHero(rgba, w, h, colors) {
  const [r, g, b] = colors;
  const cx = Math.floor(w * 0.45);
  const ground = h - 4;
  fillRect(rgba, w, cx - 8, ground - 28, 18, 24, r, g, b);
  fillCircle(rgba, w, cx + 2, ground - 34, 7, 240, 220, 190);
  fillRect(rgba, w, cx + 10, ground - 22, 14, 4, 200, 200, 210); // weapon facing right
  fillRect(rgba, w, cx - 12, ground - 18, 6, 10, 160, 160, 170); // shield
  fillRect(rgba, w, cx - 6, ground - 4, 6, 4, 60, 40, 30);
  fillRect(rgba, w, cx + 4, ground - 4, 6, 4, 60, 40, 30);
}

function drawEnemy(rgba, w, h, colors, kind) {
  const [r, g, b] = colors;
  const cx = Math.floor(w * 0.55);
  const cy = Math.floor(h * 0.55);
  if (kind === "slime") {
    fillCircle(rgba, w, cx, cy + 4, 18, r, g, b);
    fillCircle(rgba, w, cx - 6, cy - 2, 2, 20, 20, 30);
    fillCircle(rgba, w, cx + 2, cy - 4, 2, 20, 20, 30);
  } else if (kind === "bat") {
    fillRect(rgba, w, cx - 4, cy - 4, 8, 10, r, g, b);
    fillRect(rgba, w, cx - 18, cy - 2, 14, 4, r, g, b);
    fillRect(rgba, w, cx + 4, cy - 6, 14, 4, r, g, b);
  } else {
    fillRect(rgba, w, cx - 20, cy - 24, 36, 40, r, g, b);
    fillRect(rgba, w, cx - 28, cy - 8, 12, 20, 180, 160, 80); // cleaver left-facing
    fillCircle(rgba, w, cx - 4, cy - 30, 10, 120, 180, 90);
  }
}

function drawGem(rgba, w, h, kind) {
  const cx = Math.floor(w / 2);
  const cy = Math.floor(h / 2);
  if (kind === "flame") {
    fillCircle(rgba, w, cx, cy + 2, 10, 220, 60, 40);
    fillRect(rgba, w, cx - 3, cy - 14, 6, 10, 240, 140, 40);
  } else if (kind === "ice") {
    fillRect(rgba, w, cx - 8, cy - 8, 16, 16, 80, 160, 240);
    fillRect(rgba, w, cx - 2, cy - 14, 4, 28, 180, 220, 255);
    fillRect(rgba, w, cx - 14, cy - 2, 28, 4, 180, 220, 255);
  } else if (kind === "leaf") {
    fillCircle(rgba, w, cx, cy, 11, 60, 170, 70);
    fillRect(rgba, w, cx - 1, cy - 12, 2, 24, 40, 100, 50);
  } else {
    fillCircle(rgba, w, cx, cy, 10, 240, 210, 60);
    fillRect(rgba, w, cx - 1, cy - 12, 2, 24, 255, 250, 180);
    fillRect(rgba, w, cx - 12, cy - 1, 24, 2, 255, 250, 180);
  }
}

function drawBattleRef(rgba, w, h) {
  // Empty arena backdrop — no characters
  for (let y = 0; y < h; y++) {
    const t = y / h;
    const r = Math.floor(55 + t * 40);
    const g = Math.floor(90 + t * 50);
    const b = Math.floor(150 - t * 50);
    for (let x = 0; x < w; x++) setPixel(rgba, w, x, y, r, g, b);
  }
  // distant hills
  fillRect(rgba, w, 0, Math.floor(h * 0.45), w, Math.floor(h * 0.2), 70, 100, 90);
  fillCircle(rgba, w, Math.floor(w * 0.2), Math.floor(h * 0.5), 40, 65, 95, 85);
  fillCircle(rgba, w, Math.floor(w * 0.75), Math.floor(h * 0.48), 50, 60, 90, 80);
  // ground plane
  fillRect(rgba, w, 0, Math.floor(h * 0.62), w, Math.floor(h * 0.38), 78, 120, 62);
  fillRect(rgba, w, 0, Math.floor(h * 0.72), w, 6, 95, 130, 70);
  // ruined pillar props (not characters)
  fillRect(rgba, w, 36, Math.floor(h * 0.5), 14, Math.floor(h * 0.22), 120, 110, 95);
  fillRect(rgba, w, w - 56, Math.floor(h * 0.52), 16, Math.floor(h * 0.2), 115, 105, 90);
}

function drawWorld(rgba, w, h) {
  fillRect(rgba, w, 0, 0, w, h, 90, 160, 220);
  fillRect(rgba, w, 0, h * 0.45, w, h * 0.55, 70, 140, 70);
  fillRect(rgba, w, w * 0.2, h * 0.5, w * 0.5, 8, 160, 130, 70);
  fillCircle(rgba, w, w * 0.7, h * 0.55, 18, 50, 120, 50);
  fillRect(rgba, w, w * 0.35, h * 0.42, 16, 16, 180, 90, 60);
}

function drawVillage(rgba, w, h) {
  fillRect(rgba, w, 0, 0, w, h, 180, 200, 230);
  fillRect(rgba, w, 0, h * 0.55, w, h * 0.45, 140, 110, 70);
  // Mine
  fillRect(rgba, w, 30, h * 0.32, 70, 70, 90, 85, 75);
  fillRect(rgba, w, 48, h * 0.4, 34, 40, 40, 40, 45);
  fillRect(rgba, w, 20, h * 0.62, 24, 12, 100, 90, 70);
  // Training
  fillRect(rgba, w, w * 0.4, h * 0.5, 80, 8, 160, 120, 80);
  fillRect(rgba, w, w * 0.42, h * 0.35, 8, 40, 180, 150, 100);
  fillRect(rgba, w, w * 0.55, h * 0.35, 8, 40, 180, 150, 100);
  // Workshop
  fillRect(rgba, w, w * 0.72, h * 0.34, 70, 60, 160, 120, 80);
  fillRect(rgba, w, w * 0.72, h * 0.28, 70, 14, 120, 60, 40);
  fillCircle(rgba, w, w * 0.9, h * 0.3, 6, 255, 120, 40);
}

function drawBossArena(rgba, w, h) {
  for (let y = 0; y < h; y++) {
    const t = y / h;
    const r = Math.floor(35 + t * 25);
    const g = Math.floor(20 + t * 15);
    const b = Math.floor(30 + t * 20);
    for (let x = 0; x < w; x++) setPixel(rgba, w, x, y, r, g, b);
  }
  fillRect(rgba, w, 0, Math.floor(h * 0.55), w, Math.floor(h * 0.45), 55, 45, 40);
  fillRect(rgba, w, 0, Math.floor(h * 0.62), w, 4, 90, 50, 40);
  fillRect(rgba, w, 24, Math.floor(h * 0.28), 18, Math.floor(h * 0.35), 70, 60, 55);
  fillRect(rgba, w, w - 42, Math.floor(h * 0.28), 18, Math.floor(h * 0.35), 70, 60, 55);
  fillCircle(rgba, w, 40, Math.floor(h * 0.32), 5, 255, 140, 50);
  fillCircle(rgba, w, w - 40, Math.floor(h * 0.32), 5, 255, 140, 50);
  fillRect(rgba, w, Math.floor(w * 0.35), Math.floor(h * 0.2), Math.floor(w * 0.3), 10, 50, 40, 35);
}

function paintAsset(spec) {
  const { id, width: w, height: h } = spec;
  const rgba = new Uint8ClampedArray(w * h * 4);
  if (spec.background === "opaque") {
    fillRect(rgba, w, 0, 0, w, h, 30, 30, 40);
  }
  if (id === "battle-screen-ref") drawBattleRef(rgba, w, h);
  else if (id === "splash-bg" || id === "splash-match3" || id === "ending-party") drawBattleRef(rgba, w, h);
  else if (id === "env-hollow-keep") drawBossArena(rgba, w, h);
  else if (id === "battle-boss-bg") drawBossArena(rgba, w, h);
  else if (id.startsWith("hero-")) {
    const map = {
      "hero-warrior": [200, 60, 50],
      "hero-mage": [60, 100, 210],
      "hero-ranger": [50, 160, 70],
      "hero-priest": [220, 180, 50],
    };
    drawHero(rgba, w, h, map[id] || accent(id));
  }   else if (id === "enemy-slime") drawEnemy(rgba, w, h, [70, 190, 150], "slime");
  else if (id === "enemy-bat") drawEnemy(rgba, w, h, [140, 70, 160], "bat");
  else if (id === "enemy-wraith") drawEnemy(rgba, w, h, [220, 200, 90], "bat");
  else if (id === "boss-goblin") drawEnemy(rgba, w, h, [90, 140, 60], "boss");
  else if (id === "gems-set") {
    const kinds = ["flame", "ice", "leaf", "light"];
    for (let i = 0; i < 4; i++) {
      const cell = new Uint8ClampedArray(32 * 32 * 4);
      drawGem(cell, 32, 32, kinds[i]);
      const ox = (i % 2) * 64 + 16;
      const oy = Math.floor(i / 2) * 64 + 16;
      for (let y = 0; y < 32; y++) {
        for (let x = 0; x < 32; x++) {
          const si = (y * 32 + x) * 4;
          if (cell[si + 3] > 0) setPixel(rgba, w, ox + x, oy + y, cell[si], cell[si + 1], cell[si + 2], cell[si + 3]);
        }
      }
    }
  } else if (id === "env-worldmap") drawWorld(rgba, w, h);
  else if (id === "env-village") drawVillage(rgba, w, h);
  else {
    const [r, g, b] = accent(id);
    fillRect(rgba, w, 8, 8, w - 16, h - 16, r, g, b);
  }
  return encodePng(w, h, rgba);
}

function writePng(relPath, buf) {
  const abs = join(PUBLIC, relPath);
  ensureDir(abs);
  writeFileSync(abs, buf);
  return relPath;
}

function writeGemCrops() {
  const kinds = ["flame", "ice", "leaf", "light"];
  for (let i = 0; i < 4; i++) {
    const rgba = new Uint8ClampedArray(32 * 32 * 4);
    drawGem(rgba, 32, 32, kinds[i]);
    writePng(`assets/gems/${GEM_IDS[i]}.png`, encodePng(32, 32, rgba));
  }
}

function writePortraits(sources = {}) {
  const heroes = ["hero-warrior", "hero-mage", "hero-ranger", "hero-priest"];
  const colors = [
    [200, 60, 50],
    [60, 100, 210],
    [50, 160, 70],
    [220, 180, 50],
  ];
  for (let i = 0; i < heroes.length; i++) {
    const pid = `${heroes[i]}-portrait`;
    const rel = `assets/portraits/${pid}.png`;
    const abs = join(PUBLIC, rel);
    if (sources[pid] === "generated" && existsSync(abs)) continue;
    const rgba = new Uint8ClampedArray(32 * 32 * 4);
    drawHero(rgba, 32, 32, colors[i]);
    writePng(rel, encodePng(32, 32, rgba));
  }
}

function buildManifest(sources) {
  /** @type {Record<string, { source: string, path: string }>} */
  const manifest = {};
  for (const spec of ASSET_SPECS) {
    manifest[spec.id] = {
      source: sources[spec.id] || "procedural",
      path: `/${spec.publicPath}`,
    };
  }
  for (const gemId of GEM_IDS) {
    manifest[gemId] = {
      source: sources[gemId] || "procedural",
      path: `/assets/gems/${gemId}.png`,
    };
  }
  for (const hero of ["hero-warrior", "hero-mage", "hero-ranger", "hero-priest"]) {
    const pid = `${hero}-portrait`;
    manifest[pid] = {
      source: sources[pid] || "procedural",
      path: `/assets/portraits/${pid}.png`,
    };
  }
  const out = join(PUBLIC, "assets/manifest.json");
  ensureDir(out);
  writeFileSync(out, JSON.stringify(manifest, null, 2) + "\n");
  return manifest;
}

export function generatePlaceholders(existingSources = {}) {
  /** @type {Record<string, string>} */
  const sources = { ...existingSources };
  for (const spec of ASSET_SPECS) {
    const abs = join(PUBLIC, spec.publicPath);
    if ((sources[spec.id] === "generated" || spec.skipByDefault) && existsSync(abs)) {
      sources[spec.id] = sources[spec.id] || "generated";
      continue;
    }
    writePng(spec.publicPath, paintAsset(spec));
    sources[spec.id] = "procedural";
  }
  writeGemCrops();
  for (const gemId of GEM_IDS) sources[gemId] = sources[gemId] || "procedural";
  writePortraits(sources);
  for (const hero of ["hero-warrior", "hero-mage", "hero-ranger", "hero-priest"]) {
    const pid = `${hero}-portrait`;
    sources[pid] = sources[pid] || "procedural";
  }
  buildManifest(sources);
  return sources;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const sources = generatePlaceholders();
  console.log(`Wrote procedural placeholders for ${Object.keys(sources).length} assets.`);
  console.log("Manifest: public/assets/manifest.json");
}
