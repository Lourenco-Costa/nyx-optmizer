#!/usr/bin/env node
/**
 * Gera os icones da app (PNG + ICO multi-resolucao) sem dependencias externas.
 * Uso: node tools/make-icon.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT_DIR = path.join(__dirname, '..', 'assets');

/* ------------------------------------------------------------------ */
/* PNG encoder                                                         */
/* ------------------------------------------------------------------ */

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, rgba) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filtro None
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ------------------------------------------------------------------ */
/* Rasterizador vetorial minimalista                                   */
/* ------------------------------------------------------------------ */

const BOLT = [
  [0.575, 0.075],
  [0.275, 0.545],
  [0.462, 0.545],
  [0.405, 0.925],
  [0.725, 0.435],
  [0.525, 0.435],
];

const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

function insideRoundRect(x, y, inset, radius) {
  const lo = inset;
  const hi = 1 - inset;
  if (x < lo || x > hi || y < lo || y > hi) return false;
  const r = Math.min(radius, 0.5 - inset);
  const cx = x < lo + r ? lo + r : x > hi - r ? hi - r : x;
  const cy = y < lo + r ? lo + r : y > hi - r ? hi - r : y;
  return Math.hypot(x - cx, y - cy) <= r;
}

function insidePoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const R = 0.235;

/** Cor (0-255 RGB) de um ponto normalizado da arte. */
function shade(x, y) {
  if (!insideRoundRect(x, y, 0, R)) return null;

  // Fundo preto com um brilho central discreto
  let c = mix([0x16, 0x16, 0x16], [0x00, 0x00, 0x00], smoothstep(0.04, 0.96, (x * 0.55 + y * 0.45)));
  const glow = clamp(1 - Math.hypot((x - 0.5) / 0.58, (y - 0.44) / 0.58));
  c = c.map((v) => v + (255 - v) * glow * glow * 0.08);

  // Raio branco
  if (insidePoly(x, y, BOLT)) {
    const g = smoothstep(0.08, 0.92, y);
    return mix([255, 255, 255], [0xe6, 0xe6, 0xe6], g);
  }

  // Contorno interior branco
  if (!insideRoundRect(x, y, 0.014, R - 0.014)) {
    return [242, 242, 242];
  }

  return c;
}

function render(size) {
  const SS = 4; // supersampling
  const buf = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = (px + (sx + 0.5) / SS) / size;
          const y = (py + (sy + 0.5) / SS) / size;
          const c = shade(x, y);
          if (c) {
            r += c[0];
            g += c[1];
            b += c[2];
            a += 255;
          }
        }
      }
      const n = SS * SS;
      const i = (py * size + px) * 4;
      const alpha = a / n;
      if (alpha > 0) {
        const cov = a / 255;
        buf[i] = Math.round(r / cov);
        buf[i + 1] = Math.round(g / cov);
        buf[i + 2] = Math.round(b / cov);
        buf[i + 3] = Math.round(alpha);
      }
    }
  }
  return encodePng(size, buf);
}

/* ------------------------------------------------------------------ */
/* ICO writer (entradas PNG, suportado desde o Vista)                  */
/* ------------------------------------------------------------------ */

function encodeIco(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);

  let offset = 6 + entries.length * 16;
  const dir = [];
  for (const { size, png } of entries) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt8(0, 2);
    e.writeUInt8(0, 3);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(png.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += png.length;
    dir.push(e);
  }
  return Buffer.concat([header, ...dir, ...entries.map((e) => e.png)]);
}

/* ------------------------------------------------------------------ */

fs.mkdirSync(OUT_DIR, { recursive: true });

const sizes = [16, 24, 32, 48, 64, 128, 256];
const icoEntries = sizes.map((size) => ({ size, png: render(size) }));

fs.writeFileSync(path.join(OUT_DIR, 'icon.ico'), encodeIco(icoEntries));
fs.writeFileSync(path.join(OUT_DIR, 'icon.png'), render(512));
fs.writeFileSync(path.join(OUT_DIR, 'icon-256.png'), render(256));

console.log('Icones gerados em assets/ (icon.ico, icon.png, icon-256.png)');
