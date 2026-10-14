// LUXE §2 펫 걷기 시트 확인 → reports/luxe/pets/walk/ — BOT_BUILD=1 빌드를 띄우고 URL=<주소> node scripts/shot-petwalk.mjs
//  griffin · starfox · slime 을 마을 입구에 세우고 가장 크게(×4) 확대 → strip.png 한 장: 줄 = 위(오른/왼) · 아래(오른/왼) · 옆(오른/왼) · 서기(앞|뒤) · 밤 잠
//   칸 = 펫 3마리 × 4프레임(약 0.1초 간격) — 펫 발 둘레만 잘라 붙임
//  실험실 켬(localStorage visualLab) · 저장은 SAVE (기본 tests/fixtures/real_woongs.json, 저장소 밖)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import { PNG } from 'pngjs';
const raw = fs.readFileSync(process.env.SAVE ?? 'tests/fixtures/real_woongs.json', 'utf8');
const dir = 'reports/luxe/pets/walk';
fs.mkdirSync(dir, { recursive: true });
const URL = process.env.URL ?? 'http://localhost:4313/';
const IDS = ['griffin', 'starfox', 'slime'];
const b = await chromium.launch({ channel: 'chrome' });
const ctx = await b.newContext({ viewport: { width: 1280, height: 820 }, deviceScaleFactor: 1 });
await ctx.addInitScript((s) => {
  try { if (sessionStorage.getItem('x')) return; sessionStorage.setItem('x', 1); } catch { return; }
  localStorage.clear();
  localStorage.setItem('legacy-of-adventure-save', s);
  localStorage.setItem('legacy-of-adventure-teaserSeen', 'true');
  localStorage.setItem('legacy-of-adventure-lastVersion', '"99"');
  localStorage.setItem('legacy-of-adventure-telemetry', 'false');
  localStorage.setItem('legacy-of-adventure-settleOff', 'true');
  localStorage.setItem('legacy-of-adventure-sound', JSON.stringify({ bgmOn: false, bgmVol: 0.4, sfxOn: false, sfxVol: 0.7, muted: true }));
  localStorage.setItem('legacy-of-adventure-visualLab', 'true');
}, raw);
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(String(e)));
const W = (ms) => p.waitForTimeout(ms);
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__S, null, { timeout: 20000 });
await W(1500);
await p.locator('#tCont').click();
await W(3000);
async function calm() {
  for (let i = 0, c = 0; i < 80 && c < 3; i++) {
    const busy = await p.evaluate(() => { if (!document.querySelector('#dlg').hidden) return document.querySelector('#dlg').click(), true; if (document.querySelector('#win').classList.contains('on')) return document.querySelector('#winX').click(), true; return false; });
    c = busy ? 0 : c + 1;
    await W(busy ? 200 : 500);
  }
}
await calm();
await p.evaluate(() => (window.__S.clock = 6 * 60));
// 지금 꺼낸 펫을 집으로 돌리고 세 마리만 (카드 닫기)
await p.evaluate((ids) => { const st = window.__pets.state(); for (const id of ids) window.__pets.grant(id, 'bundle'); st.out = [...ids]; st.card.length = 0; }, IDS);
await W(2500);
await calm();
console.error('rt', await p.evaluate(() => window.__pets.rt().map((r) => r.id)));
// 트인 곳: 마을이 붐비면 작은 펫이 건물·소품 뒤에 숨어서, 땅 오른쪽 모서리(화면 오른쪽 끝 · 보통 비어 있음)에 세운다 — 그리기 확인용
const spot = await p.evaluate(() => { const [a, b] = window.__town.landBounds(); return [b - 1, a + 1]; });
console.error('spot', spot);
// 한 마리씩 그 자리에 (나머지는 멀리 비켜 둠)
const place = (k) => p.evaluate(([sx, sy, k]) => { window.__pets.rt().forEach((r, i) => { const on = i === k; r.x = on ? sx : sx - 14 - i; r.y = on ? sy : sy + 14; r.path = []; r.wait = 60; r.up = false; r.moving = false; }); }, [...spot, k]);
await place(0);
// 가장 크게 확대
const seen = [];
for (let i = 0; i < 6; i++) { seen.push(await p.evaluate(() => window.__S.zoom)); await p.click('#bZoom').catch(() => {}); await W(150); }
const max = Math.max(...seen);
for (let i = 0; i < 6 && (await p.evaluate(() => window.__S.zoom)) !== max; i++) { await p.click('#bZoom').catch(() => {}); await W(150); }
console.error('zoom', max, 'SC', await p.evaluate(() => window.__view?.SC ?? null));
await place(0);
await p.evaluate(([x, y]) => window.__game.focusTile(x, y), spot);
await W(600);
// 펫 발 둘레만 잘라 (×4 확대 화면 그대로)
const CW = 120;
const CH = 130;
async function grab(id) {
  const shot = PNG.sync.read(await p.screenshot());
  const xy = await p.evaluate((id) => window.__pets.xy(id), id);
  const c = new PNG({ width: CW, height: CH });
  c.data.fill(40);
  if (!xy) return c;
  const x0 = Math.round(xy[0] - CW / 2);
  const y0 = Math.round(xy[1] + 46 - CH); // xy = 발 − 6px(논리) × 4
  for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
    const X = x0 + x, Y = y0 + y;
    if (X < 0 || Y < 0 || X >= shot.width || Y >= shot.height) continue;
    shot.data.copy(c.data, (y * CW + x) * 4, (Y * shot.width + X) * 4, (Y * shot.width + X) * 4 + 4);
  }
  return c;
}
// 방향: 칸 좌표 한 걸음 — 위 = 오른쪽 위(y−1)·왼쪽 위(x−1) · 아래 = 오른쪽 아래(x+1)·왼쪽 아래(y+1) · 옆 = 순수 오른쪽(x+1,y−1)·왼쪽
const DIRS = { up_right: [0, -1], up_left: [-1, 0], down_right: [1, 0], down_left: [0, 1], side_right: [1, -1], side_left: [-1, 1] };
const N = 4;
const NAMES = [...Object.keys(DIRS), 'stand_front_back', 'sleep'];
const grid = NAMES.map(() => IDS.map(() => []));
for (let k = 0; k < IDS.length; k++) {
  let ri = 0;
  for (const [dx, dy] of Object.values(DIRS)) {
    await place(k);
    await p.evaluate(([dx, dy, k]) => { const r = window.__pets.rt()[k]; r.x -= dx * 0.5; r.y -= dy * 0.5; r.path = [[r.x + dx * 3, r.y + dy * 3]]; }, [dx, dy, k]);
    await W(100);
    for (let f = 0; f < N; f++) { grid[ri][k].push(await grab(IDS[k])); await W(95); }
    ri++;
  }
  await place(k);
  await W(400);
  grid[ri][k].push(await grab(IDS[k]));
  await p.evaluate((k) => { window.__pets.rt()[k].up = true; }, k);
  await W(200);
  grid[ri][k].push(await grab(IDS[k]));
  console.error('✓', IDS[k]);
}
await p.evaluate(() => (window.__S.clock = (23 - 6) * 60));
await p.waitForFunction(() => window.__S.night, null, { timeout: 20000 }).catch(() => {});
await W(1500);
await calm();
await p.evaluate(([x, y]) => window.__game.focusTile(x, y), spot);
for (let k = 0; k < IDS.length; k++) {
  await place(k);
  await W(400);
  grid[NAMES.length - 1][k].push(await grab(IDS[k]));
}
// 한 장 모음: 줄 = 방향 · 칸 = [griffin ×4 | starfox ×4 | slime ×4]
const G = 4;
const out = new PNG({ width: IDS.length * N * (CW + G) + IDS.length * 8, height: NAMES.length * (CH + G) });
out.data.fill(24);
grid.forEach((row, ri) => row.forEach((cells, k) => cells.forEach((im, f) => PNG.bitblt(im, out, 0, 0, CW, CH, (k * N + f) * (CW + G) + k * 8, ri * (CH + G)))));
fs.writeFileSync(`${dir}/strip.png`, PNG.sync.write(out));
console.error('rows', NAMES.join(' / '), '· 칸:', IDS.join(' | '), `× ${N}프레임`);
if (errs.length) console.error('ERR', errs);
await ctx.close();
await b.close();
console.log(JSON.stringify([`${dir}/strip.png`]));
