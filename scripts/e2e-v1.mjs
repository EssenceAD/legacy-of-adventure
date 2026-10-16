// 1.0.0 정식 오픈 e2e — 타이틀 「정식 오픈」 리본 · 버전 v1.0.0 · 화면에 BETA/베타 없음(베타 개척자 칭호 빼고)
//  0.25.66-beta를 보던 유저: 1.0.0 패치노트 카드 한 번 → 새로고침해도 다시 안 뜸 · 새 버전 띠도 안 뜸 (같은 빌드)
//  실행: URL=http://localhost:4190/ node scripts/e2e-v1.mjs
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const URL = process.env.URL ?? 'http://localhost:4190/';
const SAVE = fs.readFileSync('tests/fixtures/real_lotte.json', 'utf8');
const b = await chromium.launch({ channel: 'chrome' });
let fail = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fail++; };
const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await ctx.addInitScript((s) => {
  if (sessionStorage.getItem('x')) return;
  sessionStorage.setItem('x', 1);
  localStorage.clear();
  localStorage.setItem('legacy-of-adventure-save', s);
  localStorage.setItem('legacy-of-adventure-teaserSeen', 'true');
  localStorage.setItem('legacy-of-adventure-settleOff', 'true');
  localStorage.setItem('legacy-of-adventure-telemetry', 'false');
  localStorage.setItem('legacy-of-adventure-lastVersion', JSON.stringify('0.25.66-beta'));
}, SAVE);
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
const W = (ms) => p.waitForTimeout(ms);
await p.goto(URL, { waitUntil: 'domcontentloaded' });
await p.waitForSelector('#tCont', { state: 'visible', timeout: 60000 });
await W(800);
const title = await p.evaluate(() => ({ ribbon: document.querySelector('#title .open1')?.textContent, beta: !!document.querySelector('#title .beta'), ver: document.getElementById('tVer')?.textContent, text: document.getElementById('title').innerText }));
ok(title.ribbon === '정식 오픈' && !title.beta, `타이틀 「${title.ribbon}」 리본 · BETA 띠 없음`);
ok(/^v1\.0\.0/.test(title.ver ?? ''), `버전 「${title.ver}」`);
ok(!/beta|베타/i.test(title.text), '타이틀 화면에 beta/베타 없음');
await p.locator('#tCont').click();
await W(4000);
// 다른 창(방치 요약 등)을 닫으며 패치노트 카드를 찾는다
let card = null;
for (let i = 0; i < 40 && !card; i++) {
  card = await p.evaluate(() => {
    const t = document.querySelector('#win.on #winT')?.textContent ?? '';
    if (/v1\.0\.0 업데이트|새로 생긴 것/.test(t)) return t + ' | ' + (document.querySelector('#winB')?.innerText ?? '').slice(0, 80);
    if (!document.querySelector('#dlg').hidden) document.querySelector('#dlg').click();
    else if (document.querySelector('#win').classList.contains('on')) document.querySelector('#winX').click();
    return null;
  });
  if (!card) await W(300);
}
ok(!!card && /정식 오픈/.test(card), `1.0.0 카드 한 번: ${card}`);
const lv = await p.evaluate(() => localStorage.getItem('legacy-of-adventure-lastVersion'));
ok(lv === JSON.stringify('1.0.0'), `본 버전 기록 ${lv}`);
// 새로고침 → 카드 다시 안 뜸 · 새 버전 띠 없음
await p.reload({ waitUntil: 'domcontentloaded' });
await p.waitForSelector('#tCont', { state: 'visible', timeout: 60000 });
await W(800);
await p.locator('#tCont').click();
await W(5000);
let again = false;
for (let i = 0; i < 20; i++) {
  const t = await p.evaluate(() => {
    const t = document.querySelector('#win.on #winT')?.textContent ?? '';
    if (!document.querySelector('#dlg').hidden) document.querySelector('#dlg').click();
    else if (document.querySelector('#win').classList.contains('on') && !/업데이트/.test(t)) document.querySelector('#winX').click();
    return t;
  });
  if (/v1\.0\.0 업데이트/.test(t)) again = true;
  await W(250);
}
ok(!again, '새로고침 뒤 카드 다시 안 뜸');
const band = await p.evaluate(() => [...document.querySelectorAll('body *')].some((e) => e.offsetParent && /새 버전 v/.test(e.textContent ?? '') && e.children.length === 0));
ok(!band, '새 버전 띠 없음 (같은 빌드)');
// 게임 화면 글자 전수: beta/베타 (베타 개척자 칭호는 빼고)
const vis = await p.evaluate(() => document.body.innerText.replace(/베타 개척자/g, ''));
ok(!/\bbeta\b|BETA|베타/i.test(vis), '게임 화면에 beta/베타 없음 (베타 개척자 칭호 제외)');
ok(!errs.length, '페이지 에러 없음 ' + errs.join(' | '));
await b.close();
console.log(fail ? `✗ ${fail}개 실패` : '✓ 모두 통과');
process.exit(fail ? 1 : 0);
