// v0.9.4 「튕긴다」 제보 확인용 (핫픽스 11 §7): 대장간 열기 → 탭 여러 번 바꾸기 → ← 뒤로 / ✕ / Esc / 안드로이드 뒤로가기로 나가기
//  진짜 클릭 · 매번 게임 페이지에 그대로 있는지(밖으로 나가지 않는지). 실행: dist-bot 미리보기 4190 · node scripts/e2e-smith-back.mjs [se|pc]
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const name = process.argv[2] ?? 'se';
const save = fs.readFileSync('tests/fixtures/beta_town.json', 'utf8');
const DEV = { se: { viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, pc: { viewport: { width: 1280, height: 800 } } };
const b = await chromium.launch({ channel: 'chrome' });
const ctx = await b.newContext(DEV[name]);
await ctx.addInitScript((s) => {
  try { if (sessionStorage.getItem('x')) return; sessionStorage.setItem('x', 1); } catch { return; }
  localStorage.clear();
  localStorage.setItem('legacy-of-adventure-save', s);
  localStorage.setItem('legacy-of-adventure-teaserSeen', 'true');
  localStorage.setItem('legacy-of-adventure-lastVersion', '"99"');
}, save);
const p = await ctx.newPage();
await p.goto('about:blank');
const errs = [];
p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
const W = (ms) => p.waitForTimeout(ms);
let fail = 0;
const out = [];
const ok = (c, m) => { out.push((c ? '✓ ' : '✗ ') + m); if (!c) fail++; };
const winOn = () => p.evaluate(() => !!document.querySelector('#win')?.classList.contains('on')).catch(() => false);
const alive = () => p.evaluate(() => !!window.__S && location.href.startsWith('http://localhost')).catch(() => false);
const clear = async () => {
  for (let i = 0; i < 25; i++) {
    const st = await p.evaluate(() => ({ d: !document.querySelector('#dlg').hidden, w: document.querySelector('#win').classList.contains('on') })).catch(() => ({}));
    if (st.d) await p.locator('#dlg').click().catch(() => {});
    else if (st.w) await p.locator('#winX').click().catch(() => {});
    else return;
    await W(300);
  }
};
await p.goto(process.env.URL ?? 'http://localhost:4190/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__S, null, { timeout: 20000 });
await W(1500);
await p.locator('#tCont').click();
await W(3000);
await clear();
await p.evaluate(() => { window.__P.runs.length = 0; window.__P.hunt.auto = null; window.__S.gold = 99999; });
// 대장간 짓기 (자리 찾기만 개발용 · 확정은 진짜 클릭)
let placed = false;
for (const [x, y] of [[9, 9], [10, 9], [9, 12], [12, 9], [9, 15], [19, 15], [11, 10]]) {
  if ((await p.evaluate(([x, y]) => window.__place('smith', x, y), [x, y])) === 'ok') {
    await p.locator('#placeOk').click();
    placed = true;
    break;
  }
}
ok(placed, '대장간 지음');
await W(3500);
await clear();
const tapSmith = async () => {
  const pts = await p.evaluate(() => {
    const o = window.__world.objs.find((x) => x.kind === 'smith');
    const v = window.__view, r = document.querySelector('canvas').getBoundingClientRect();
    const at = (x, y) => [r.left + (((x - y) * 32) / 2 + v.OX) * v.SC, r.top + (((x + y) * 16) / 2 + v.OY) * v.SC];
    window.__game.focusTile(o.tx + 1.5, o.ty + 1.5);
    return [[0, 0], [0, -0.6], [-0.4, -0.4], [0.4, 0.2]].map(([dx, dy]) => at(o.tx + 1.5 + dx, o.ty + 1.5 + dy));
  });
  await W(400);
  const pts2 = await p.evaluate(() => {
    const o = window.__world.objs.find((x) => x.kind === 'smith');
    const v = window.__view, r = document.querySelector('canvas').getBoundingClientRect();
    const at = (x, y) => [r.left + (((x - y) * 32) / 2 + v.OX) * v.SC, r.top + (((x + y) * 16) / 2 + v.OY) * v.SC];
    return [[0, 0], [0, -0.6], [-0.4, -0.4], [0.4, 0.2], [0.2, -1]].map(([dx, dy]) => at(o.tx + 1.5 + dx, o.ty + 1.5 + dy));
  });
  void pts;
  for (const [x, y] of pts2) {
    await p.mouse.click(x, y);
    await W(700);
    if (/대장간/.test(await p.evaluate(() => (document.querySelector('#win').classList.contains('on') ? document.querySelector('#winT').textContent : '')))) return true;
    await clear();
  }
  return false;
};
// 나가는 방법 4가지 × 2번
for (const how of ['back', 'x', 'esc', 'android', 'back', 'x', 'esc', 'android']) {
  const opened = await tapSmith();
  if (!opened) { ok(false, `대장간 창 열림 (${how})`); continue; }
  for (let i = 0; i < 6; i++) {
    await p.locator(`#smT .tab[data-t="${i % 3}"]`).click({ timeout: 2000 }).catch(() => {});
    await W(250);
  }
  if (how === 'back') {
    if (await p.locator('#winBack').isVisible()) await p.locator('#winBack').click();
    else await p.locator('#winX').click();
  } else if (how === 'x') await p.locator('#winX').click();
  else if (how === 'esc') await p.keyboard.press('Escape');
  else await p.goBack({ timeout: 2000 }).catch(() => {});
  await W(700);
  ok((await alive()) && !(await winOn()), `탭 6번 바꾼 뒤 ${how} → 창 닫히고 게임 그대로 (${p.url()})`);
  if (!(await alive())) break;
}
ok(errs.length === 0, '페이지 에러 0 ' + errs.join(' | '));
console.log(JSON.stringify({ [name]: out }, null, 1));
console.log(fail ? `✗ ${fail}개 실패` : '✓ 모두 통과');
await b.close();
process.exit(fail ? 1 : 0);
