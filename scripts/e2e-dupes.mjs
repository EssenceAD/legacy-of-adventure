// HOTFIX14 §1·§5: 하나뿐인 건물 중복 저장(롯데캐슬: 온천 Lv5 + 공사 중 Lv1 · 대장간 2채)을 실제로 불러오기
//  → 온천 1채(Lv5)·대장간 1채(Lv2) · 환불 + 사과 편지 1통 · 다시 불러와도 그대로 (편지 또 안 옴) · 건설 창 「이미 있어요」
//  실행: dist-bot 미리보기 4190 · node scripts/e2e-dupes.mjs
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const save = fs.readFileSync('tests/fixtures/lotte_dupe.json', 'utf8');
const b = await chromium.launch({ channel: 'chrome' });
const ctx = await b.newContext({ viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await ctx.addInitScript((s) => {
  try { if (sessionStorage.getItem('x')) return; sessionStorage.setItem('x', 1); } catch { return; }
  localStorage.clear();
  localStorage.setItem('legacy-of-adventure-save', s);
  localStorage.setItem('legacy-of-adventure-teaserSeen', 'true');
  localStorage.setItem('legacy-of-adventure-lastVersion', '"99"');
}, save);
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
const W = (ms) => p.waitForTimeout(ms);
let fail = 0;
const out = [];
const ok = (c, m) => { out.push((c ? '✓ ' : '✗ ') + m); if (!c) fail++; };
const boot = async () => {
  await p.waitForFunction(() => !!window.__S, null, { timeout: 20000 });
  await W(1500);
  await p.locator('#tCont').click();
  await W(3500);
};
const state = () => p.evaluate(() => ({
  baths: window.__world.objs.filter((o) => o.kind === 'bath').map((o) => o.lvl),
  smiths: window.__world.objs.filter((o) => o.kind === 'smith').map((o) => o.lvl),
  cottages: window.__world.objs.filter((o) => o.kind === 'cottage').length,
  n: window.__world.objs.length,
  mail: window.__P.meta.mail.filter((m) => /사라진 건물/.test(m.title)).map((m) => ({ gold: m.reward.gold, body: m.body.slice(0, 40) })),
}));
await p.goto('http://localhost:4190/', { waitUntil: 'networkidle' });
await boot();
const s1 = await state();
ok(s1.baths.length === 1 && s1.baths[0] === 5, `온천 1채 · Lv.${s1.baths} (강화한 쪽이 남음)`);
ok(s1.smiths.length === 1 && s1.smiths[0] === 2, `대장간 1채 · Lv.${s1.smiths}`);
ok(s1.cottages === 6, `별채 6채 그대로 (${s1.cottages})`);
ok(s1.mail.length === 1, `사과·환불 편지 1통: ${JSON.stringify(s1.mail)}`);
// 저장 → 다시 불러오기
// 자동 저장(바뀐 게 있으면 몇 초 안에) 기다리기
await p.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
await W(4000);
await p.reload({ waitUntil: 'networkidle' });
await boot();
const s2 = await state();
ok(JSON.stringify(s2.baths) === '[5]' && JSON.stringify(s2.smiths) === '[2]' && s2.n === s1.n, `다시 불러와도 그대로 (건물 ${s1.n} → ${s2.n})`);
ok(s2.mail.length === 1, '편지가 또 오지 않음');
// 건설 창: 이미 있는 하나뿐인 건물은 회색 「이미 있어요」
await p.evaluate(() => { for (let i = 0; i < 6; i++) document.querySelector('#winX')?.click(); });
await W(400);
await p.locator('#bBuild').click({ force: true });
await W(800);
const owned = await p.evaluate(() => [...document.querySelectorAll('.cat button.owned')].map((b) => b.textContent));
ok(owned.some((t) => /온천.*이미 있어요/.test(t)),`건설 창 「이미 있어요」: ${owned.slice(0, 4).join(' / ')}`);
ok(!(await p.evaluate(() => !!document.querySelector('.cat button[data-k="bath"]'))), '온천은 지을 수 있는 목록에 없음');
ok(errs.length === 0, '페이지 에러 0 ' + errs.join(' | '));
console.log(JSON.stringify(out, null, 1));
console.log(fail ? `✗ ${fail}개 실패` : '✓ 모두 통과');
await b.close();
process.exit(fail ? 1 : 0);
