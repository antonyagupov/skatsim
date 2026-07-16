#!/usr/bin/env node
/**
 * Offline post-process: convert near-black backgrounds to alpha, crop gem cells.
 * No paid API calls.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateSync, deflateSync } from "node:zlib";
import { ASSET_SPECS, GEM_IDS } from "./asset-catalog.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const PUBLIC = join(ROOT, "public");

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
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePng(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    const rowStart = y * (w * 4 + 1);
    raw[rowStart] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, rowStart + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Minimal PNG decoder for 8-bit greyscale/RGB/RGBA (+ optional tRNS). */
function decodePng(buf) {
  if (buf.toString("hex", 0, 8) !== "89504e470d0a1a0a") throw new Error("not png");
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 8;
  let colorType = 6;
  const idats = [];
  /** @type {Buffer | null} */
  let palette = null;
  /** @type {Buffer | null} */
  let trns = null;

  while (offset < buf.length) {
    const len = buf.readUInt32BE(offset);
    const type = buf.toString("ascii", offset + 4, offset + 8);
    const data = buf.subarray(offset + 8, offset + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === "PLTE") palette = Buffer.from(data);
    else if (type === "tRNS") trns = Buffer.from(data);
    else if (type === "IDAT") idats.push(data);
    else if (type === "IEND") break;
    offset += 12 + len;
  }

  if (bitDepth !== 8) throw new Error(`unsupported bit depth ${bitDepth}`);
  const inflated = inflateSync(Buffer.concat(idats));
  const rgba = new Uint8ClampedArray(width * height * 4);
  let bpp = 4;
  if (colorType === 0) bpp = 1;
  else if (colorType === 2) bpp = 3;
  else if (colorType === 3) bpp = 1;
  else if (colorType === 4) bpp = 2;
  else if (colorType === 6) bpp = 4;
  else throw new Error(`unsupported color type ${colorType}`);

  const stride = width * bpp + 1;
  // Only filter type 0 (None) and 1 (Sub) / 2 (Up) / 4 (Paeth) — handle common cases
  const recon = Buffer.alloc(height * width * bpp);
  for (let y = 0; y < height; y++) {
    const filter = inflated[y * stride];
    const row = inflated.subarray(y * stride + 1, y * stride + 1 + width * bpp);
    const out = recon.subarray(y * width * bpp, (y + 1) * width * bpp);
    const prev = y > 0 ? recon.subarray((y - 1) * width * bpp, y * width * bpp) : null;
    for (let i = 0; i < row.length; i++) {
      const left = i >= bpp ? out[i - bpp] : 0;
      const up = prev ? prev[i] : 0;
      const upLeft = prev && i >= bpp ? prev[i - bpp] : 0;
      let val = row[i];
      if (filter === 1) val = (val + left) & 255;
      else if (filter === 2) val = (val + up) & 255;
      else if (filter === 3) val = (val + Math.floor((left + up) / 2)) & 255;
      else if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        const pr = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
        val = (val + pr) & 255;
      }
      out[i] = val;
    }
  }

  for (let i = 0; i < width * height; i++) {
    const si = i * bpp;
    const di = i * 4;
    if (colorType === 6) {
      rgba[di] = recon[si];
      rgba[di + 1] = recon[si + 1];
      rgba[di + 2] = recon[si + 2];
      rgba[di + 3] = recon[si + 3];
    } else if (colorType === 2) {
      rgba[di] = recon[si];
      rgba[di + 1] = recon[si + 1];
      rgba[di + 2] = recon[si + 2];
      rgba[di + 3] = 255;
    } else if (colorType === 0) {
      const g = recon[si];
      rgba[di] = g;
      rgba[di + 1] = g;
      rgba[di + 2] = g;
      rgba[di + 3] = 255;
    } else if (colorType === 4) {
      const g = recon[si];
      rgba[di] = g;
      rgba[di + 1] = g;
      rgba[di + 2] = g;
      rgba[di + 3] = recon[si + 1];
    } else if (colorType === 3) {
      const idx = recon[si];
      rgba[di] = palette[idx * 3];
      rgba[di + 1] = palette[idx * 3 + 1];
      rgba[di + 2] = palette[idx * 3 + 2];
      rgba[di + 3] = trns && idx < trns.length ? trns[idx] : 255;
    }
  }
  return { width, height, rgba };
}

function keyBlackToAlpha(rgba, threshold = 18) {
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i] <= threshold && rgba[i + 1] <= threshold && rgba[i + 2] <= threshold) {
      rgba[i + 3] = 0;
    }
  }
}

function cropGemSheet(rgba, w, h) {
  // 2x2 cells
  const cellW = Math.floor(w / 2);
  const cellH = Math.floor(h / 2);
  const out = [];
  for (let i = 0; i < 4; i++) {
    const ox = (i % 2) * cellW;
    const oy = Math.floor(i / 2) * cellH;
    const cell = new Uint8ClampedArray(cellW * cellH * 4);
    for (let y = 0; y < cellH; y++) {
      for (let x = 0; x < cellW; x++) {
        const si = ((oy + y) * w + (ox + x)) * 4;
        const di = (y * cellW + x) * 4;
        cell[di] = rgba[si];
        cell[di + 1] = rgba[si + 1];
        cell[di + 2] = rgba[si + 2];
        cell[di + 3] = rgba[si + 3];
      }
    }
    out.push({ w: cellW, h: cellH, rgba: cell });
  }
  return out;
}

function processFile(relPath, { keyBlack = false, gems = false } = {}) {
  const abs = join(PUBLIC, relPath);
  if (!existsSync(abs)) {
    console.log(`skip missing ${relPath}`);
    return;
  }
  const { width, height, rgba } = decodePng(readFileSync(abs));
  if (keyBlack) keyBlackToAlpha(rgba);
  writeFileSync(abs, encodePng(width, height, rgba));
  console.log(`processed ${relPath} (${width}x${height})`);

  if (gems) {
    const cells = cropGemSheet(rgba, width, height);
    for (let i = 0; i < GEM_IDS.length; i++) {
      const c = cells[i];
      const dest = join(PUBLIC, `assets/gems/${GEM_IDS[i]}.png`);
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, encodePng(c.w, c.h, c.rgba));
      console.log(`  cropped ${GEM_IDS[i]}`);
    }
  }
}

const transparentIds = ASSET_SPECS.filter((s) => s.background === "transparent").map(
  (s) => s.id,
);

for (const spec of ASSET_SPECS) {
  if (!transparentIds.includes(spec.id)) continue;
  processFile(spec.publicPath, {
    keyBlack: true,
    gems: spec.id === "gems-set",
  });
}

// Mark cropped gems as generated in manifest when parent sheet is generated
const manifestPath = join(PUBLIC, "assets/manifest.json");
if (existsSync(manifestPath)) {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (manifest["gems-set"]?.source === "generated") {
    for (const id of GEM_IDS) {
      manifest[id] = { source: "generated", path: `/assets/gems/${id}.png` };
    }
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  }
}

console.log("Post-process complete (no API spend).");
