import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, "../public/icons");
mkdirSync(outDir, { recursive: true });

const CRC_TABLE = new Int32Array(256);
for (let n = 0; n < 256; n += 1) {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c;
}

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const name = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])), 0);
  return Buffer.concat([length, name, data, crc]);
}

function png(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const row = y * (size * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < size; x += 1) {
      const [r, g, b, a] = pixel(x / size, y / size);
      const offset = row + 1 + x * 4;
      raw[offset] = r;
      raw[offset + 1] = g;
      raw[offset + 2] = b;
      raw[offset + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function mix(a, b, t) {
  return a.map((value, index) => Math.round(value + (b[index] - value) * t));
}

function iconPixel(u, v) {
  // Rounded charcoal tile.
  const radius = 0.19;
  const inset = 0.045;
  const x = Math.min(u, 1 - u);
  const y = Math.min(v, 1 - v);
  const cornerDx = Math.max(0, radius - x);
  const cornerDy = Math.max(0, radius - y);
  const outsideCorner = cornerDx > 0 && cornerDy > 0 && Math.hypot(cornerDx, cornerDy) > radius;
  if (x < inset || y < inset || outsideCorner) return [0, 0, 0, 0];

  const bg = mix([10, 12, 10], [23, 27, 22], (u + v) / 2);

  // Lime V mark: two thick strokes meeting near the bottom centre.
  const stroke = 0.072;
  const leftDistance = pointSegment(u, v, 0.25, 0.26, 0.47, 0.74);
  const rightDistance = pointSegment(u, v, 0.75, 0.26, 0.53, 0.74);
  if (leftDistance < stroke || rightDistance < stroke) {
    return [190, 255, 66, 255];
  }

  // White punctuation square, top-right.
  if (u > 0.72 && u < 0.82 && v > 0.24 && v < 0.32) return [242, 247, 236, 255];

  // Faint technical grid line.
  if (Math.abs(v - 0.86) < 0.006 || Math.abs(u - 0.14) < 0.006) {
    return [42, 49, 41, 255];
  }

  return [...bg, 255];
}

function pointSegment(px, py, ax, ay, bx, by) {
  const vx = bx - ax;
  const vy = by - ay;
  const wx = px - ax;
  const wy = py - ay;
  const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / (vx * vx + vy * vy)));
  return Math.hypot(px - (ax + t * vx), py - (ay + t * vy));
}

for (const size of [16, 32, 48, 128]) {
  writeFileSync(resolve(outDir, `icon${size}.png`), png(size, iconPixel));
}
console.log("Generated extension icons in public/icons");
