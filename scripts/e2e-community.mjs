// 유저 톡방 e2e: 메뉴 맨 아래 버튼 · 새 소식 공지 고정 카드 · 편지 쓰기 아래 한 줄 · 출석 3일째 모모 편지(한 번) · 모두 새 창(target=_blank rel=noopener) · 자동 팝업 없음
//  실행: URL=… node scripts/e2e-community.mjs
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const save = JSON.parse(fs.readFileSync('tests/fixtures/lotte_dupe.json', 'utf8'));
const b = await chromium.launch({ channel: 'chrome' });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await ctx.addInitScript((s) => {
  try { if (sessionStorage.getItem('x')) return; sessionStorage.setItem('x', 1); } catch { return; }
  localStorage.clear();
  localStorage.setItem('legacy-of-adventure-save', s);
  localStorage.setItem('legacy-of-adventure-teaserSeen', 'true');
  localStorage.setItem('legacy-of-adventure-lastVersion', '"99"');
  localStorage.setItem('legacy-of-adventure-settleOff', 'true');
}, JSON.stringify(save));
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
let popups = 0;
ctx.on('page', () => popups++);
const W = (ms) => p.waitForTimeout(ms);
let fail = 0;
const ok = (c, m) => { console.error((c ? '✓ ' : '✗ ') + m); if (!c) fail++; };
const URL_K = 'https://open.kakao.com/o/g1KwZ2Ri';
await p.goto(process.env.URL ?? 'http://localhost:5192/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__S, null, { timeout: 20000 });
await W(1500);
await p.locator('#tCont').click();
await W(4000);
ok(popups === 0, '자동 팝업 없음');
// 공지 고정 카드
await p.evaluate(() => window.__openNotices());
await W(500);
const card = await p.evaluate(() => { const a = document.querySelector('#kPin a.kakao'); return a ? [a.href, a.target, a.rel] : null; });
ok(card && card[0] === URL_K && card[1] === '_blank' && /noopener/.test(card[2]), '공지 고정 카드 링크 ' + JSON.stringify(card));
await p.screenshot({ path: 'screenshots/community_notice.png' });
// 출석 3일째 편지
const mail = await p.evaluate(async () => {
  const P = window.__P;
  P.meta.attend.total = 2;
  P.meta.attend.last = '2000-01-01';
  window.__dailyAttend();
  P.meta.attend.last = '2000-01-01';
  window.__dailyAttend();
  return P.meta.mail.filter((x) => x.link === 'kakao').length;
});
ok(mail === 1, '출석 3일째 모모 편지 한 통 (다음 날 또 안 옴)');
ok(errs.length === 0, '오류 0 ' + errs.join(' | '));
await b.close();
process.exit(fail ? 1 : 0);
