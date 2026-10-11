// 핫픽스 12 §2: 추천 편성 — 원정 파티 창 · 사냥 준비 창 (진짜 클릭) · 역할 3칸 · 이유 한 줄 · 의뢰 태그 · 스크린샷 shots/h12_party_<기기>.png
// 실행: dist-bot 미리보기 4190 · node scripts/e2e-party-scroll.mjs [se|pc]
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
const errs = [];
p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
const W = (ms) => p.waitForTimeout(ms);
let fail = 0;
const out = [];
const ok = (c, m) => { out.push((c ? '✓ ' : '✗ ') + m); if (!c) fail++; };
const clear = async () => {
  for (let i = 0; i < 25; i++) {
    const st = await p.evaluate(() => ({ d: !document.querySelector('#dlg').hidden, w: document.querySelector('#win').classList.contains('on') }));
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
// 시험 준비: 단골 8명 더 (목록이 스크롤되게) · 원정 비우기
await p.evaluate(() => { window.__P.runs.length = 0; window.__P.hunt.auto = null; for (let i = 0; i < 8; i++) window.__arrive('regular'); for (const a of window.__world.actors) if (a.id) a.hp = 100; });
await W(2500);
await clear();
await p.evaluate(() => { window.__P.runs.length = 0; window.__P.hunt.auto = null; for (const a of window.__world.actors) if (a.id) { a.runId = null; a.hp = 100; } const q = window.__P.quests.list.find((x) => !x.tutorial); if (q) q.tag = { k: 'noKind', v: 'cleric', n: 0, text: '사제 없이 · 보상 +30%' }; });
await p.locator('#bExp').click();
await W(900);
ok(/📜/.test(await p.locator('#winB').textContent()), '게시판 의뢰에 조건 태그');
await p.locator('.quest', { hasText: '📜' }).first().click();
await W(900);
ok(await p.locator('#pRec').count() > 0, '원정 파티 창 「추천 편성」');
ok(await p.locator('#winB .roles .rl').count() === 3, '역할 3칸');
await p.locator('#pRec').click();
await W(600);
const n = await p.locator('#winB .plist .pm.on').count();
ok(n >= 1, '추천 → ' + n + '명 선택');
const why = await p.locator('#winB .recb small').textContent();
ok(why.length > 3 && !/보고 골라요/.test(why), '이유 한 줄: ' + why);
ok(await p.evaluate(() => !window.__P.runs.length), '출발은 직접 (자동 출발 안 함)');
await p.screenshot({ path: 'shots/h12_party_' + name + '.png' });
await clear();
// 사냥 준비 창
await p.locator('#bExp').click();
await W(900);
await p.locator('#rHunt').click().catch(() => {});
await W(800);
await p.locator('[data-s="1"]').click();
await W(900);
ok(await p.locator('#hRec').count() > 0, '사냥 준비 창 「추천 편성」');
await p.locator('#hRec').click();
await W(600);
const hn = await p.locator('#winB .plist .pm.on').count();
ok(hn >= 1 && hn <= 3, '사냥 추천 ' + hn + '명');
ok(!/보고 골라요/.test(await p.locator('#winB .recb small').textContent()), '사냥 이유 한 줄: ' + (await p.locator('#winB .recb small').textContent()));
ok(errs.length === 0, '페이지 에러 0 ' + errs.join(' | '));
console.log(JSON.stringify({ [name]: out }, null, 1));
console.log(fail ? '✗ ' + fail + '개 실패' : '✓ 모두 통과');
await b.close();
process.exit(fail ? 1 : 0);
