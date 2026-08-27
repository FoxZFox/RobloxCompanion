import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

/**
 * Generates the extension icons with no image dependency.
 *
 * The mark is a stack of three bars of decreasing length - a server list, emptiest at
 * the bottom - which is what the extension is actually for. Drawn as raw pixels and
 * encoded straight to PNG, because Chrome will not accept SVG for extension icons.
 *
 * Run: node tools/make-icons.mjs
 */

const SIZES = [16, 32, 48, 128];
const OUT_DIR = 'public/icons';

const BG = [29, 31, 34, 255]; // matches --rc-bg dark
const BAR = [59, 130, 246, 255]; // matches --rc-accent
const BAR_DIM = [124, 170, 250, 255];

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[i] = c;
    }
  }
  let crc = -1;
  for (const byte of buf) crc = (crc >>> 8) ^ table[(crc ^ byte) & 0xff];
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([length, typeAndData, crc]);
}

function encodePng(size, pixels) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  // Each scanline is prefixed with its filter type byte (0 = none).
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0;
    for (let x = 0; x < size; x++) {
      const src = (y * size + x) * 4;
      const dst = rowStart + 1 + x * 4;
      raw[dst] = pixels[src];
      raw[dst + 1] = pixels[src + 1];
      raw[dst + 2] = pixels[src + 2];
      raw[dst + 3] = pixels[src + 3];
    }
  }

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function draw(size) {
  const pixels = Buffer.alloc(size * size * 4);
  const put = (x, y, colour) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    pixels[i] = colour[0];
    pixels[i + 1] = colour[1];
    pixels[i + 2] = colour[2];
    pixels[i + 3] = colour[3];
  };

  const radius = Math.max(2, Math.round(size * 0.18));
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Rounded-square background.
      const cx = Math.min(x, size - 1 - x);
      const cy = Math.min(y, size - 1 - y);
      if (cx < radius && cy < radius) {
        const dx = radius - cx;
        const dy = radius - cy;
        if (dx * dx + dy * dy > radius * radius) continue;
      }
      put(x, y, BG);
    }
  }

  // Three bars, each shorter than the last.
  const barHeight = Math.max(1, Math.round(size * 0.12));
  const gap = Math.max(1, Math.round(size * 0.09));
  const left = Math.round(size * 0.22);
  const widths = [0.56, 0.4, 0.24];
  let top = Math.round(size * 0.26);

  for (let b = 0; b < widths.length; b++) {
    const width = Math.round(size * widths[b]);
    const colour = b === widths.length - 1 ? BAR : BAR_DIM;
    for (let y = top; y < top + barHeight; y++) {
      for (let x = left; x < left + width; x++) put(x, y, colour);
    }
    top += barHeight + gap;
  }

  return pixels;
}

mkdirSync(OUT_DIR, { recursive: true });
for (const size of SIZES) {
  const png = encodePng(size, draw(size));
  writeFileSync(`${OUT_DIR}/icon-${size}.png`, png);
  console.log(`${OUT_DIR}/icon-${size}.png  ${png.length} bytes`);
}
