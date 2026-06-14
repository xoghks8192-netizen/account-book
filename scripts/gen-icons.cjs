const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

function crc32(buf) {
  let crc = ~0
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i]
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
    }
  }
  return ~crc >>> 0
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii')
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crcBuf])
}

function makePng(size, draw) {
  const width = size
  const height = size
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 4 + 1)
    raw[rowStart] = 0 // filter: none
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = draw(x, y, width, height)
      const off = rowStart + 1 + x * 4
      raw[off] = r
      raw[off + 1] = g
      raw[off + 2] = b
      raw[off + 3] = a
    }
  }
  const idat = zlib.deflateSync(raw)

  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// 배경: 보라색 그라디언트 느낌의 단색 + 가운데 핑크 하트
const BG = [184, 150, 255] // #b896ff
const HEART = [255, 143, 171] // #ff8fab

function heartShape(nx, ny) {
  // nx, ny in [-1, 1], heart formula
  const x = nx
  const y = -ny + 0.1
  const v = (x * x + y * y - 1) ** 3 - x * x * y * y * y
  return v <= 0
}

function draw(x, y, w, h) {
  const cx = (x + 0.5) / w * 2 - 1
  const cy = (y + 0.5) / h * 2 - 1
  if (heartShape(cx * 1.3, cy * 1.3)) {
    return [...HEART, 255]
  }
  return [...BG, 255]
}

const outDir = path.join(__dirname, '..', 'public')
fs.mkdirSync(outDir, { recursive: true })

fs.writeFileSync(path.join(outDir, 'icon-192.png'), makePng(192, draw))
fs.writeFileSync(path.join(outDir, 'icon-512.png'), makePng(512, draw))
fs.writeFileSync(path.join(outDir, 'apple-touch-icon.png'), makePng(180, draw))

console.log('icons generated in public/')
