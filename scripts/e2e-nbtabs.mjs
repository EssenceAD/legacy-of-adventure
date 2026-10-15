// SOCIAL_SPEC §1 nbTabs e2e — 이웃 목록 4탭 (진짜 서버 읽기만 · 손님(비로그인))
//  추천 8곳 · ↻ 다른 8곳(겹침 없음) · 인기 ≤10 · 찾기(2글자 · 10개) · ⭐ 안내 · 눌러서 방문 → 돌아오기
//  사진: screenshots/nbtabs/<기기>_<탭>.png
//  실행: URL=http://localhost:4190/ node scripts/e2e-nbtabs.mjs [se|phone|pc]
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const URL = process.env.URL ?? 'http://localhost:4190/';
const OUT = 'screenshots/nbtabs';
fs.mkdirSync(OUT, { recursive: true });
const DEVS = {
  se: { viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  phone: { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  pc: { viewport: { width: 1280, height: 800 } },
};
const which = process.argv[2] ? [process.argv[2]] : Object.keys(DEVS);
const SAVE = fs.readFileSync('tests/fixtures/real_lotte.json', 'utf8');
const b = await chromium.launch({ channel: 'chrome' });
let fail = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fail++; };

for (const dev of which) {
  console.log(`[${dev}]`);
  const ctx = await b.newContext(DEVS[dev]);
  await ctx.addInitScript((s) => {
    try { if (sessionStorage.getItem('x')) return; sessionStorage.setItem('x', 1); } catch { return; }
    localStorage.clear();
    localStorage.setItem('legacy-of-adventure-save', s);
    localStorage.setItem('legacy-of-adventure-teaserSeen', 'true');
    localStorage.setItem('legacy-of-adventure-settleOff', 'true');
    localStorage.setItem('legacy-of-adventure-telemetry', 'false');
  }, SAVE);
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  const W = (ms) => p.waitForTimeout(ms);
  await p.goto(URL, { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('#tCont', { state: 'visible', timeout: 60000 });
  await W(600);
  await p.locator('#tCont').click();
  await W(3500);
  const clearAll = () => p.evaluate(async () => {
    const T = (ms) => new Promise((r) => setTimeout(r, ms));
    for (let i = 0, calm = 0; i < 60 && calm < 3; i++) {
      let busy = false;
      if (!document.querySelector('#dlg').hidden) { document.querySelector('#dlg').click(); busy = true; }
      else if (document.querySelector('#win').classList.contains('on')) { document.querySelector('#winX').click(); busy = true; }
      calm = busy ? 0 : calm + 1;
      await T(busy ? 150 : 250);
    }
  });
  await clearAll();
  const waitLoaded = () => p.waitForFunction(() => !/불러오는 중|찾는 중/.test(document.querySelector('#win')?.innerText ?? ''), null, { timeout: 15000 }).catch(() => {});
  const st = () => p.evaluate(() => ({
    title: document.querySelector('#winT')?.textContent,
    subs: [...document.querySelectorAll('#nbS [data-ns]')].map((x) => x.textContent),
    on: document.querySelector('#nbS .tab.on')?.textContent,
    rows: [...document.querySelectorAll('#win .stp[data-r], #win .stp[data-p]')].map((x) => x.querySelector('b')?.textContent),
    ex: !!document.querySelector('#win details.nbex'),
    text: (document.querySelector('#win')?.innerText ?? '').replace(/\s+/g, ' ').slice(0, 200),
    overflowX: document.querySelector('#win .wbody, #win')?.scrollWidth > document.querySelector('#win .wbody, #win')?.clientWidth + 2,
  }));
  await p.evaluate(() => document.getElementById('bVillage')?.click() ?? window.__openVillage?.());
  await W(400);
  await waitLoaded();
  let s = await st();
  ok(s.title === '마을 · 이웃 여관', '이웃 창 열림');
  ok(s.subs.join('|') === '⭐ 각별한 이웃|추천|인기|찾기', `탭 4개 (${s.subs.join('|')})`);
  ok(s.on === '추천', '처음은 추천');
  ok(s.rows.length > 0 && s.rows.length <= 8, `추천 ${s.rows.length}곳 (8 이하)`);
  ok(s.ex === s.rows.length < 5, `예시 마을은 이웃 5곳 미만일 때만 (${s.ex})`);
  await p.screenshot({ path: `${OUT}/${dev}_sug.png` });
  const first = await p.evaluate(() => [...document.querySelectorAll('#win .stp[data-r]')].map((x) => x.dataset.u));
  await p.evaluate(() => document.getElementById('nbAgain')?.click());
  await W(300);
  await waitLoaded();
  const second = await p.evaluate(() => [...document.querySelectorAll('#win .stp[data-r]')].map((x) => x.dataset.u));
  const dup = second.filter((x) => first.includes(x)).length;
  ok(second.length > 0 && dup <= 1, `↻ 다른 여관 ${second.length}곳 · 겹침 ${dup}`);

  // 인기
  await p.evaluate(() => document.querySelector('#nbS [data-ns="pop"]')?.click());
  await W(300);
  await waitLoaded();
  s = await st();
  ok(s.on === '인기' && s.rows.length <= 10, `인기 ${s.rows.length}곳 (10 이하)`);
  await p.screenshot({ path: `${OUT}/${dev}_pop.png` });

  // 찾기
  await p.evaluate(() => document.querySelector('#nbS [data-ns="find"]')?.click());
  await W(300);
  await p.fill('#nbQ', '가');
  await p.evaluate(() => document.querySelector('#nbFind button')?.click());
  await W(300);
  const toast1 = await p.evaluate(() => document.getElementById('toast')?.textContent ?? '');
  ok(/두 글자/.test(toast1), '한 글자 → 「두 글자 이상」');
  await p.fill('#nbQ', '여관');
  await p.evaluate(() => document.querySelector('#nbFind button')?.click());
  await W(300);
  await waitLoaded();
  s = await st();
  ok(s.rows.length > 0 && s.rows.length <= 10, `「여관」 찾기 ${s.rows.length}곳`);
  await p.screenshot({ path: `${OUT}/${dev}_find.png` });
  await p.fill('#nbQ', 'ㅁㄴㅇㄹzz없는이름');
  await p.evaluate(() => document.querySelector('#nbFind button')?.click());
  await W(300);
  await waitLoaded();
  s = await st();
  ok(s.rows.length === 0 && /찾은 여관이 없어요/.test(s.text), '없는 이름 → 「찾은 여관이 없어요」');

  // ⭐
  await p.evaluate(() => document.querySelector('#nbS [data-ns="friend"]')?.click());
  await W(300);
  s = await st();
  ok(/각별한 이웃/.test(s.text) && /곧 열려요/.test(s.text), '⭐ 각별한 이웃 안내');
  ok(!s.overflowX, '가로 넘침 없음');
  await p.screenshot({ path: `${OUT}/${dev}_friend.png` });

  // 추천에서 눌러 방문 → 돌아오기
  await p.evaluate(() => document.querySelector('#nbS [data-ns="sug"]')?.click());
  await W(300);
  await waitLoaded();
  await p.evaluate(() => document.querySelector('#win .stp[data-r]')?.click());
  await W(2500);
  const vis = await p.evaluate(() => !!window.__S?.visiting);
  ok(vis, '추천 마을 방문');
  await p.evaluate(() => window.__game?.goHome?.());
  await W(1500);
  ok(await p.evaluate(() => !window.__S?.visiting), '내 마을로 돌아옴');
  ok(!errs.length, '페이지 에러 없음 ' + errs.join(' | '));
  await ctx.close();
}
await b.close();
console.log(fail ? `✗ ${fail}개 실패` : '✓ 모두 통과');
process.exit(fail ? 1 : 0);
