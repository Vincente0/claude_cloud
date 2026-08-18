// One-off icon generator: draws a simple "stacked planks" glyph and writes PNG files.
// Run with: node scripts/gen-icons.js
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      table[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function hex(c) {
  return [
    parseInt(c.slice(1, 3), 16),
    parseInt(c.slice(3, 5), 16),
    parseInt(c.slice(5, 7), 16),
  ];
}

function drawIcon(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const bg = hex('#1F6F54'); // deep pine green, matches app accent
  const light = hex('#F4E3C1'); // pale plank
  const mid = hex('#D8A857'); // amber plank
  const dark = hex('#B9832F'); // darker plank edge

  const set = (x, y, [r, g, b], a = 255) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    rgba[i] = r; rgba[i + 1] = g; rgba[i + 2] = b; rgba[i + 3] = a;
  };

  // background fill with slightly rounded corners
  const radius = size * 0.18;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let inside = true;
      const corners = [
        [radius, radius], [size - radius, radius],
        [radius, size - radius], [size - radius, size - radius],
      ];
      for (const [cx, cy] of corners) {
        const nearX = x < radius || x > size - radius;
        const nearY = y < radius || y > size - radius;
        if (nearX && nearY) {
          const dx = x < radius ? radius - x : x - (size - radius);
          const dy = y < radius ? radius - y : y - (size - radius);
          if (dx > 0 && dy > 0 && Math.hypot(dx, dy) > radius) {
            const cornerMatch =
              (x < radius && y < radius) ||
              (x > size - radius && y < radius) ||
              (x < radius && y > size - radius) ||
              (x > size - radius && y > size - radius);
            if (cornerMatch) inside = false;
          }
        }
      }
      set(x, y, bg, inside ? 255 : 0);
    }
  }

  // stack of 4 planks, centered, with slight offset per plank for a 3D feel
  const plankCount = 4;
  const marginX = size * 0.20;
  const stackTop = size * 0.30;
  const stackHeight = size * 0.42;
  const plankGap = size * 0.03;
  const plankHeight = (stackHeight - plankGap * (plankCount - 1)) / plankCount;
  const colors = [light, mid, light, mid];

  for (let p = 0; p < plankCount; p++) {
    const yTop = stackTop + p * (plankHeight + plankGap);
    const inset = p * size * 0.015; // slight cascading inset for depth
    const x0 = marginX + inset;
    const x1 = size - marginX - inset;
    for (let y = Math.round(yTop); y < Math.round(yTop + plankHeight); y++) {
      for (let x = Math.round(x0); x < Math.round(x1); x++) {
        const edge = x < x0 + 2 || x > x1 - 3 || y < yTop + 1 || y > yTop + plankHeight - 2;
        set(x, y, edge ? dark : colors[p % colors.length], 255);
      }
    }
  }

  return encodePNG(size, size, rgba);
}

const outDir = path.join(__dirname, '..', 'icons');
fs.mkdirSync(outDir, { recursive: true });

const targets = [
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  { name: 'icon-maskable-512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
];

for (const t of targets) {
  const png = drawIcon(t.size);
  fs.writeFileSync(path.join(outDir, t.name), png);
  console.log('wrote', t.name, png.length, 'bytes');
}
