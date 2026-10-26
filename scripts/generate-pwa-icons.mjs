import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sizes = [180, 192, 512]

const crcTable = Array.from({ length: 256 }, (_, value) => {
  let crc = value
  for (let bit = 0; bit < 8; bit += 1) crc = (crc & 1) ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1
  return crc >>> 0
})

function crc32(data) {
  let crc = 0xffffffff
  for (const byte of data) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const name = Buffer.from(type)
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const checksum = Buffer.alloc(4)
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])))
  return Buffer.concat([length, name, data, checksum])
}

function renderIcon(size) {
  const pixels = Buffer.alloc(size * size * 4)
  const scale = size / 512
  const color = {
    green: [23, 60, 53, 255],
    white: [246, 251, 247, 255],
    aqua: [142, 214, 194, 255]
  }

  const paint = (x, y, rgba) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return
    const offset = (y * size + x) * 4
    pixels.set(rgba, offset)
  }
  const fillRect = (left, top, right, bottom, rgba) => {
    for (let y = Math.round(top * scale); y < Math.round(bottom * scale); y += 1) {
      for (let x = Math.round(left * scale); x < Math.round(right * scale); x += 1) paint(x, y, rgba)
    }
  }
  const fillCircle = (cx, cy, radius, rgba) => {
    const x0 = Math.floor((cx - radius) * scale)
    const x1 = Math.ceil((cx + radius) * scale)
    const y0 = Math.floor((cy - radius) * scale)
    const y1 = Math.ceil((cy + radius) * scale)
    for (let y = y0; y <= y1; y += 1) {
      for (let x = x0; x <= x1; x += 1) {
        if ((x / scale - cx) ** 2 + (y / scale - cy) ** 2 <= radius ** 2) paint(x, y, rgba)
      }
    }
  }
  const fillRoundedRect = (left, top, right, bottom, radius, rgba) => {
    fillRect(left + radius, top, right - radius, bottom, rgba)
    fillRect(left, top + radius, right, bottom - radius, rgba)
    fillCircle(left + radius, top + radius, radius, rgba)
    fillCircle(right - radius, top + radius, radius, rgba)
    fillCircle(left + radius, bottom - radius, radius, rgba)
    fillCircle(right - radius, bottom - radius, radius, rgba)
  }
  const strokeLine = (x1, y1, x2, y2, width, rgba) => {
    const steps = Math.ceil(Math.hypot(x2 - x1, y2 - y1) * scale)
    for (let step = 0; step <= steps; step += 1) {
      const ratio = step / steps
      fillCircle(x1 + (x2 - x1) * ratio, y1 + (y2 - y1) * ratio, width / 2, rgba)
    }
  }

  fillRect(0, 0, 512, 512, color.green)
  fillRoundedRect(112, 92, 400, 397, 50, color.white)
  fillRect(158, 166, 354, 270, color.aqua)
  fillCircle(178, 326, 24, color.green)
  fillCircle(334, 326, 24, color.green)
  strokeLine(178, 404, 142, 452, 22, color.white)
  strokeLine(334, 404, 370, 452, 22, color.white)
  strokeLine(164, 430, 348, 430, 22, color.white)

  const rows = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y += 1) pixels.copy(rows, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header.set([8, 6, 0, 0, 0], 8)
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ])
}

mkdirSync(resolve(root, 'public'), { recursive: true })
for (const size of sizes) writeFileSync(resolve(root, `public/railway-icon-${size}.png`), renderIcon(size))
