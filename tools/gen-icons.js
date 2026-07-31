/*
 * gen-icons.js — 외부 의존성 없이(node 내장 zlib만) PWA용 PNG 아이콘 생성.
 *   node tools/gen-icons.js
 * 루트에 icon-512.png / icon-192.png / icon-180.png 출력.
 *
 * ★ 아이콘 디자인 가이드 (사용자 선호 확정 — hammynap/프차야/Paws-Order 계열) ★
 *   - 게임의 캐릭터 얼굴 또는 상징 "하나"를 크게 중앙에 (잡다한 요소 금지)
 *   - 플랫 스타일 + 파스텔 또는 대비 강한 단색 배경의 은은한 그라데이션
 *   - 라운드 배경, 충분한 여백, 스토리가 느껴지면 더 좋음 (예: 자는 햄스터+달)
 *   - 아래 drawDesign()의 예시(잠자는 동글 캐릭터)를 게임 모티프로 교체할 것
 */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const OUT = path.join(__dirname, "..");
const SS = 3; // 슈퍼샘플링 (부드러운 가장자리)

// ── 디자인 (512×512 좌표계) ──────────────────────────────────────
// 모티프: 눈먼 장로의 복면 실루엣 + 붉은달. "붉은달의 의식" 상징 하나로 압축.
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

const BG_TOP = hex("#4a0e0e"), BG_BOT = hex("#0d0906");   // 대비 강한 어두운 배경 그라데이션
const MOON = hex("#b23a2e"), MOON_DARK = hex("#7a1f1f"); // 붉은달
const HOOD = hex("#17120f");                               // 복면 실루엣
const BLIND = hex("#e9dcc8");                               // 눈가리개 천

const inCircle = (x, y, cx, cy, r) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
function inRoundedSquare(x, y, size, rad) {
  const cx = Math.min(Math.max(x, rad), size - rad);
  const cy = Math.min(Math.max(y, rad), size - rad);
  return (x - cx) ** 2 + (y - cy) ** 2 <= rad * rad;
}

// 반환: [r,g,b,a] — 붉은달을 등진 눈먼 장로의 복면 실루엣
function drawDesign(x, y) {
  if (!inRoundedSquare(x, y, 512, 110)) return [0, 0, 0, 0];
  let c = mix(BG_TOP, BG_BOT, y / 512); // 배경 그라데이션

  if (inCircle(x, y, 256, 190, 130)) c = mix(MOON, MOON_DARK, (y - 60) / 260); // 붉은달
  if (inCircle(x, y, 256, 330, 150)) c = HOOD;                                 // 복면 머리 실루엣
  if (x > 150 && x < 362 && y > 300 && y < 332) c = BLIND;                     // 눈가리개 띠
  if (inCircle(x, y, 176, 316, 9)) c = HOOD;                                   // 눈가리개 매듭 그림자(좌)
  if (inCircle(x, y, 336, 316, 9)) c = HOOD;                                   // 눈가리개 매듭 그림자(우)

  return [c[0], c[1], c[2], 255];
}

// ── PNG 인코딩 (RGBA, 필터 0, zlib) ──────────────────────────────
const crcTable = (() => {
  const t = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function pngFromRGBA(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // 필터 없음
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type: RGBA
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ── 래스터화: 슈퍼샘플링으로 디자인을 각 크기로 ─────────────────────
function render(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const scale = 512 / size;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const [cr, cg, cb, ca] = drawDesign(
            (px + (sx + 0.5) / SS) * scale,
            (py + (sy + 0.5) / SS) * scale
          );
          r += cr; g += cg; b += cb; a += ca;
        }
      }
      const n = SS * SS, i = (py * size + px) * 4;
      rgba[i] = r / n; rgba[i + 1] = g / n; rgba[i + 2] = b / n; rgba[i + 3] = a / n;
    }
  }
  return pngFromRGBA(size, size, rgba);
}

for (const size of [512, 192, 180]) {
  const file = path.join(OUT, `icon-${size}.png`);
  fs.writeFileSync(file, render(size));
  console.log("생성:", file);
}
