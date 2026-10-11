// 핫픽스 11 §11 사람 눈 확인용: 훈련장+과녁(오른쪽 옆) · 여관 Lv.3 옆 우물 · 주점 옆 가로등 — 낮/밤
// 실행: node scripts/shot-draw-order.mjs <URL> <접두어>   (dist-bot 미리보기 — 바꾸기 전/후 비교)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const URL = process.argv[2] ?? 'http://localhost:4190/';
const PRE = process.argv[3] ?? 'after';
const OUT = 'screenshots/hotfix11';
fs.mkdirSync(OUT, { recursive: true });
const save = fs.readFileSync('tests/fixtures/beta_town.json', 'utf8');
const b = await chromium.launch({ channel: 'chrome' });
const ctx = await b.newContext({ viewport: { width: 900, height: 900 }, deviceScaleFactor: 2 });
await ctx.addInitScript((s) => {
  if (sessionStorage.getItem('x')) return;
  sessionStorage.setItem('x', 1);
  localStorage.clear();
  localStorage.setItem('legacy-of-adventure-save', s);
  localStorage.setItem('legacy-of-adventure-teaserSeen', 'true');
  localStorage.setItem('legacy-of-adventure-lastVersion', '"99"');
}, save);
const p = await ctx.newPage();
const W = (ms) => p.waitForTimeout(ms);
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__S, null, { timeout: 20000 });
await W(1500);
await p.locator('#tCont').click();
await W(3000);
const clear = async () => {
  for (let i = 0; i < 20; i++) {
    const st = await p.evaluate(() => ({ d: !document.querySelector('#dlg').hidden, w: document.querySelector('#win').classList.contains('on') }));
    if (st.d) await p.locator('#dlg').click().catch(() => {});
    else if (st.w) await p.locator('#winX').click().catch(() => {});
    else return;
    await W(300);
  }
};
await clear();
await p.evaluate(() => { window.__P.runs.length = 0; window.__P.hunt.auto = null; window.__S.gold = 999999; window.__world.actors = window.__world.actors.filter((a) => a.role); });
/** 짓기: 미리보기 → 확정 (진짜 클릭) · 비계가 끝날 때까지 */
const build = async (k, x, y) => {
  const why = await p.evaluate(([k, x, y]) => window.__place(k, x, y), [k, x, y]);
  if (why !== 'ok') return why;
  await p.locator('#placeOk').click({ timeout: 3000 });
  await W(3000);
  return 'ok';
};
const log = [];
// 여관 Lv.3 (뒤로 커진다)
await p.evaluate(() => { const inn = window.__world.objs.find((o) => o.kind === 'inn'); for (let i = 0; i < 2; i++) window.__game.upgrade(inn); });
await clear();
const inn = await p.evaluate(() => { const o = window.__world.objs.find((x) => x.kind === 'inn'); return { tx: o.tx, ty: o.ty, fw: o.fw, fh: o.fh, lvl: o.lvl }; });
log.push('여관 ' + JSON.stringify(inn));
// 훈련장 + 오른쪽 옆 과녁 (뒷줄): 빈자리를 찾는다
let tr = null;
for (const [x, y] of [[1, 1], [2, 1], [1, 9], [9, 1], [9, 2], [1, 2], [9, 9]]) {
  const r = await build('training', x, y);
  if (r === 'ok') {
    tr = [x, y];
    break;
  }
}
log.push('훈련장 ' + JSON.stringify(tr));
if (tr) log.push('과녁 ' + (await build('target', tr[0] + 3, tr[1])));
// 여관 오른쪽 옆 우물
log.push('우물 ' + (await build('well', inn.tx + inn.fw, inn.ty + 1)));
// 주점 오른쪽 옆 가로등
const tv = await p.evaluate(() => { const o = window.__world.objs.find((x) => x.kind === 'tavern'); return { tx: o.tx, ty: o.ty, fw: o.fw, fh: o.fh }; });
log.push('가로등 ' + (await build('lamppost', tv.tx + tv.fw, tv.ty)));
await clear();
/** 칸 → 화면 */
const at = (x, y) => p.evaluate(([x, y]) => { const v = window.__view, r = document.querySelector('canvas').getBoundingClientRect(); return [r.left + (((x - y) * 32) / 2 + v.OX) * v.SC, r.top + (((x + y) * 16) / 2 + v.OY) * v.SC]; }, [x, y]);
const clip = async (x, y, w, h, name) => {
  const [cx, cy] = await at(x, y);
  const sc = await p.evaluate(() => window.__view.SC);
  const c = { x: Math.max(0, cx - (w * sc) / 2), y: Math.max(0, cy - h * sc * 0.75), width: w * sc, height: h * sc };
  await p.screenshot({ path: `${OUT}/${PRE}_${name}.png`, clip: c });
};
for (const night of [false, true]) {
  await p.evaluate((n) => { window.__S.night = n; window.__S.nightT = n ? 1 : 0; }, night);
  await W(1200);
  const t = night ? 'night' : 'day';
  await p.screenshot({ path: `${OUT}/${PRE}_village_${t}.png`, clip: { x: 300, y: 380, width: 400, height: 300 } });
}
console.log(log.join(' · '));
await b.close();
