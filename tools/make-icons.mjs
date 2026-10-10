// 홈 화면 아이콘 만들기: 여관 그림(inn3)을 남색 배경 위에 정수 배율로 올려 PNG로 저장한다.
// 실행: node tools/make-icons.mjs   →  public/icons/icon-192.png, icon-512.png, icon-maskable-512.png
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { deflateSync, inflateSync } from 'node:zlib';

const BG = [0x0d, 0x14, 0x35];

function readPng(file) {
  const b = readFileSync(file);
  const w = b.readUInt32BE(16);
  const h = b.readUInt32BE(20);
  if (b[24] !== 8 || b[25] !== 6 || b[28] !== 0) throw new Error('8비트 RGBA, 비인터레이스 PNG만 지원: ' + file);
  const idat = [];
  for (let p = 8; p < b.length; ) {
    const len = b.readUInt32BE(p);
    const type = b.toString('ascii', p + 4, p + 8);
    if (type === 'IDAT') idat.push(b.subarray(p + 8, p + 8 + len));
    p += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * 4;
  const out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const v = raw[y * (stride + 1) + 1 + x];
      const a = x >= 4 ? out[y * stride + x - 4] : 0;
      const up = y > 0 ? out[(y - 1) * stride + x] : 0;
      const ul = x >= 4 && y > 0 ? out[(y - 1) * stride + x - 4] : 0;
      let r;
      if (f === 0) r = v;
      else if (f === 1) r = v + a;
      else if (f === 2) r = v + up;
      else if (f === 3) r = v + ((a + up) >> 1);
      else {
        const p = a + up - ul;
        const pa = Math.abs(p - a), pb = Math.abs(p - up), pc = Math.abs(p - ul);
        r = v + (pa <= pb && pa <= pc ? a : pb <= pc ? up : ul);
      }
      out[y * stride + x] = r & 255;
    }
  }
  return { w, h, px: out };
}

const CRC = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
const crc32 = (buf) => {
  let c = -1;
  for (const v of buf) c = CRC[(c ^ v) & 255] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function writePng(file, w, h, px) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) px.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}

/** size 칸 정사각형에 그림을 scale배로 가운데(살짝 아래) 놓는다 */
function icon(src, size, scale) {
  const px = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) px.set([...BG, 255], i * 4);
  const ox = Math.floor((size - src.w * scale) / 2);
  const oy = Math.floor((size - src.h * scale) / 2 + size * 0.02);
  for (let y = 0; y < src.h * scale; y++)
    for (let x = 0; x < src.w * scale; x++) {
      const s = ((Math.floor(y / scale) * src.w) + Math.floor(x / scale)) * 4;
      const al = src.px[s + 3] / 255;
      if (!al) continue;
      const d = ((oy + y) * size + ox + x) * 4;
      for (let k = 0; k < 3; k++) px[d + k] = Math.round(src.px[s + k] * al + px[d + k] * (1 - al));
    }
  return px;
}

const inn = readPng('public/assets/sprites/inn3.png');
mkdirSync('public/icons', { recursive: true });
writePng('public/icons/icon-192.png', 192, 192, icon(inn, 192, 1));
writePng('public/icons/icon-512.png', 512, 512, icon(inn, 512, 3));
// 마스커블: 가운데 80% 안에 들어오게 작게
writePng('public/icons/icon-maskable-512.png', 512, 512, icon(inn, 512, 2));
console.log('아이콘 3개 생성 → public/icons/');
