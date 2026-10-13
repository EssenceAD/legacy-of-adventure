// WAYFIND e2e (폰): 심연 10 접은 판 패배 → 결의·버나드·「막혔을 때」 카드 · 「!」 말풍선 → [보여 줘] · 🎯 오늘 패널 「오늘 해 볼 만한 것」 · 안내서 「처음 해 보기」
//  실행: URL=… node scripts/e2e-wayfind.mjs  (이카몰리 실세이브 tests/fixtures/real_wf_ikamolly.json · 로컬 전용)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const save = JSON.parse(fs.readFileSync('tests/fixtures/real_wf_ikamolly.json', 'utf8'));
// 심연 10을 접어 둔 채 껐다 켠 상태 + 이미 4연패 (결의 2 → 지면 3)
const mem = save.progress.hunt.auto?.members ?? [13, 4, 25, 11];
save.progress.hunt.auto = null;
save.progress.hunt.folded = { region: 'abyss', stage: 10, members: mem, at: Date.now() - 60000 };
save.progress.wf = { lose: { 'abyss-10': 4 } };
const dir = 'screenshots/wayfind';
fs.mkdirSync(dir, { recursive: true });
const b = await chromium.launch({ channel: 'chrome' });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await ctx.addInitScript((s) => {
  try { if (sessionStorage.getItem('x')) return; sessionStorage.setItem('x', 1); } catch { return; }
  localStorage.clear();
  localStorage.setItem('legacy-of-adventure-save', s);
  localStorage.setItem('legacy-of-adventure-teaserSeen', 'true');
  localStorage.setItem('legacy-of-adventure-lastVersion', '"99"');
  localStorage.setItem('legacy-of-adventure-settleOff', 'true');
  localStorage.setItem('legacy-of-adventure-hlOff', 'true');
}, JSON.stringify(save));
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
const W = (ms) => p.waitForTimeout(ms);
let fail = 0;
const ok = (c, m) => { console.error((c ? '✓ ' : '✗ ') + m); if (!c) fail++; };
await p.goto(process.env.URL ?? 'http://localhost:5201/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__S, null, { timeout: 20000 });
await W(1500);
await p.locator('#tCont').click();
// 1) 접은 판 결과 (패배) — 대사가 먼저 나오면 넘긴다
let res = false;
for (let i = 0; i < 60 && !res; i++) {
  res = await p.evaluate(() => /접어 둔 판/.test(document.getElementById('winT')?.textContent ?? ''));
  if (!res) await p.evaluate(() => { if (!document.querySelector('#dlg').hidden) document.querySelector('#dlg').click(); });
  await W(400);
}
ok(res, '심연 10 접은 판 결과 창');
const card = await p.evaluate(() => ({
  lose: /사냥 실패/.test(document.querySelector('#winB')?.textContent ?? ''),
  resolve: document.querySelector('#winB .resolve')?.textContent ?? '',
  bern: document.querySelector('#winB .momohint')?.textContent ?? '',
  picks: [...document.querySelectorAll('#winB [data-stk]')].map((b) => b.textContent),
  n: window.__P.wf.lose['abyss-10'],
}));
console.error(JSON.stringify(card));
ok(card.lose && card.n === 5, '패배 · 연속 패배 5');
ok(/결의 3/.test(card.resolve), '결의 3 줄');
ok(/버나드/.test(card.bern), '버나드 한 줄 (결의 3 이상)');
ok(card.picks.length >= 1 && card.picks.length <= 3, `막혔을 때 카드 ${card.picks.length}개`);
await p.screenshot({ path: `${dir}/1_stuck.png` });
// 카드 버튼 → 그곳으로
await p.locator('#winB [data-stk]').first().click();
await W(600);
ok(await p.evaluate(() => document.getElementById('win').classList.contains('on')), `카드 「${card.picks[0]}」 → 창 열림`);
await p.evaluate(() => document.querySelector('#winX')?.click());
// 2) 「!」 말풍선
let bub = false;
for (let i = 0; i < 40 && !bub; i++) {
  await p.evaluate(() => { if (!document.querySelector('#dlg').hidden) document.querySelector('#dlg').click(); if (document.querySelector('#win').classList.contains('on')) document.querySelector('#winX').click(); });
  await W(500);
  bub = await p.evaluate(() => !!document.querySelector('.wfbub'));
}
const today = await p.evaluate(() => window.__P.wf.today);
ok(bub && today === 'fish', `「!」 말풍선 (오늘: ${today})`);
for (let i = 0; i < 6; i++) {
  await p.evaluate(() => { if (!document.querySelector('#dlg').hidden) document.querySelector('#dlg').click(); if (document.querySelector('#win').classList.contains('on')) document.querySelector('#winX').click(); });
  await W(400);
}
await p.screenshot({ path: `${dir}/2_bubble.png` });
await p.evaluate(() => document.querySelector('.wfbub').click());
for (let i = 0; i < 10; i++) {
  if (await p.evaluate(() => !document.querySelector('#dChoice').hidden)) break;
  await p.evaluate(() => document.querySelector('#dlg').click());
  await W(500);
}
await p.screenshot({ path: `${dir}/3_talk.png` });
await p.locator('#dChoice button', { hasText: '보여 줘' }).click();
await W(800);
ok(await p.evaluate(() => /건설/.test(document.getElementById('winT')?.textContent ?? '')), '[보여 줘] → 건설 창 (연못 없음)');
ok(await p.evaluate(() => !document.querySelector('.wfbub') && window.__P.wf.today === '#'), '눌렀으면 오늘은 더 안 뜸');
await p.evaluate(() => document.querySelector('#winX')?.click());
await W(2500);
ok(await p.evaluate(() => !document.querySelector('.wfbub')), '하루 한 명');
// 3) 🎯 오늘 패널
await p.evaluate(() => document.querySelector('#goalPill')?.click());
await W(500);
const tp = await p.evaluate(() => [...document.querySelectorAll('.wftoday button')].map((b) => b.textContent));
console.error(JSON.stringify(tp));
ok(tp.length === 2 && /다시 도전 \(결의 3\)/.test(tp[1]), '오늘 해 볼 만한 것: 처음 해 보기 1 + 막힌 판');
await p.screenshot({ path: `${dir}/4_today.png` });
await p.locator('.wftoday [data-wfhunt]').click();
await W(800);
ok(await p.evaluate(() => /^사냥터/.test(document.getElementById('winT')?.textContent ?? '')), '막힌 판 → 사냥터');
// 4) 안내서 처음 해 보기
await p.evaluate(() => window.__openManual());
await W(300);
await p.locator('#mnFirsts').click();
await W(400);
const rows = await p.evaluate(() => document.querySelectorAll('.wfrow').length);
ok(rows >= 10, `처음 해 보기 목록 ${rows}줄`);
await p.screenshot({ path: `${dir}/5_firsts.png` });
ok(!errs.length, `페이지 오류 없음 ${errs.join(' | ')}`);
await b.close();
console.error(fail ? `✗ ${fail}개 실패` : '✓ 모두 통과');
process.exit(fail ? 1 : 0);
