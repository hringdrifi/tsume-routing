import { writeFile } from 'node:fs/promises'

const colors = { background: [11, 23, 24], board: [22, 54, 53], gold: [229, 171, 86], blue: [110, 184, 217], pad: [255, 224, 167], padStroke: [100, 75, 43] }

function raster(size) {
  const pixels = Array.from({ length: size * size }, () => [...colors.background, 255])
  const set = (x, y, color) => { if (x >= 0 && x < size && y >= 0 && y < size) pixels[y * size + x] = [...color, 255] }
  const rounded = (x, y, w, h, r, color) => { for (let py = Math.floor(y); py < y + h; py++) for (let px = Math.floor(x); px < x + w; px++) { const dx = Math.max(x + r - px - .5, 0, px + .5 - (x + w - r)), dy = Math.max(y + r - py - .5, 0, py + .5 - (y + h - r)); if (dx * dx + dy * dy <= r * r) set(px, py, color) } }
  const line = (x1, y1, x2, y2, width, color) => { const dx = x2 - x1, dy = y2 - y1, length = Math.hypot(dx, dy); for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { const t = Math.max(0, Math.min(1, ((x + .5 - x1) * dx + (y + .5 - y1) * dy) / (length * length))); if (Math.hypot(x + .5 - (x1 + t * dx), y + .5 - (y1 + t * dy)) <= width / 2) set(x, y, color) } }
  const circle = (cx, cy, radius, color) => { for (let y = Math.floor(cy - radius); y <= cy + radius; y++) for (let x = Math.floor(cx - radius); x <= cx + radius; x++) if (Math.hypot(x + .5 - cx, y + .5 - cy) <= radius) set(x, y, color) }
  const u = size / 64
  rounded(8 * u, 8 * u, 48 * u, 48 * u, 5 * u, colors.board)
  for (const [x1, y1, x2, y2] of [[17,17,30,17],[30,17,30,30],[30,30,47,30],[47,30,47,47]]) line(x1*u,y1*u,x2*u,y2*u,5*u,colors.gold)
  for (const [x1, y1, x2, y2] of [[17,47,30,47],[30,47,30,34],[30,34,47,34],[47,34,47,17]]) line(x1*u,y1*u,x2*u,y2*u,5*u,colors.blue)
  for (const [x, y] of [[17,17],[17,47],[47,17],[47,47]]) { circle(x*u,y*u,4.7*u,colors.padStroke); circle(x*u,y*u,3.4*u,colors.pad) }
  circle(30*u,30*u,3*u,colors.pad); circle(30*u,34*u,3*u,colors.pad)
  return pixels
}

function dib(size) {
  const header = Buffer.alloc(40), pixels = raster(size), bitmap = Buffer.alloc(size * size * 4)
  header.writeUInt32LE(40, 0); header.writeInt32LE(size, 4); header.writeInt32LE(size * 2, 8); header.writeUInt16LE(1, 12); header.writeUInt16LE(32, 14); header.writeUInt32LE(size * size * 4, 20)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { const [r, g, b, a] = pixels[(size - 1 - y) * size + x]; bitmap.writeUInt32LE(((a << 24) | (r << 16) | (g << 8) | b) >>> 0, (y * size + x) * 4) }
  return Buffer.concat([header, bitmap, Buffer.alloc(Math.ceil(size / 32) * 4 * size)])
}

const images = [16, 32, 48].map((size) => ({ size, data: dib(size) })), directory = Buffer.alloc(6 + images.length * 16)
directory.writeUInt16LE(1, 2); directory.writeUInt16LE(images.length, 4)
let offset = directory.length
for (const [index, image] of images.entries()) { const entry = 6 + index * 16; directory[entry] = image.size; directory[entry + 1] = image.size; directory.writeUInt16LE(1, entry + 4); directory.writeUInt16LE(32, entry + 6); directory.writeUInt32LE(image.data.length, entry + 8); directory.writeUInt32LE(offset, entry + 12); offset += image.data.length }
await writeFile(new URL('../src/favicon.ico', import.meta.url), Buffer.concat([directory, ...images.map(({ data }) => data)]))
