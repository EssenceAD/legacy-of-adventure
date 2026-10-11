// 핫픽스 12 §6: 케미 알림 — 장부 「케미 소식」 빨간 점 · 설정 「케미 알림」 · 파티 창 ♥ 줄 (진짜 클릭)
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
// 마을 만남 → 대화창 없이 ♥ 소식 · 장부 「케미 소식」 빨간 점 · 설정 「케미 알림」 · 파티 창 ♥ 줄
const before = await p.evaluate(() => window.__P.chemNews.unread);
// 마을 만남 강제: 짝 둘을 붙여 앉혀 놓고 기다린다 (dev 전역 __chemTalk는 대화창용이라 안 씀)
const pr = await p.evaluate(() => { const W = window.__world; const P = window.__P; const keys = Object.keys(P.bonds); if (!keys.length) return null; const [x, y] = keys[0].split('-').map(Number); const a = W.actors.find((q) => q.id === x); const b = W.actors.find((q) => q.id === y); return a && b ? [a.name, b.name, P.bonds[keys[0]].lv] : null; });
ok(!!pr, '저장에 케미 짝 있음 ' + JSON.stringify(pr));
await p.evaluate(() => { window.__P.chemNews.unread = 2; window.__P.chemNews.list.unshift({ t: Date.now(), text: '♥ 테스트 3단계 — A & B' }, { t: Date.now(), text: '새 케미 「테스트」 — A & B' }); });
await p.locator('#bMenu2').click();
await W(800);
ok(await p.evaluate(() => !![...document.querySelectorAll('.mtile')].find((t) => /수입 장부/.test(t.textContent))?.querySelector('.mdot')), '메뉴 「수입 장부」 빨간 점');
await p.locator('.mtile', { hasText: '수입 장부' }).first().click();
await W(700);
ok(/테스트 3단계/.test(await p.locator('#winB').textContent()), '장부 → 케미 소식 탭이 바로 열림');
ok(await p.evaluate(() => window.__P.chemNews.unread === 0), '읽음 처리');
await clear();
await p.locator('#bMenu2').click();
await W(800);
await p.locator('.mtile', { hasText: '설정' }).first().click();
await W(700);
ok(await p.evaluate(() => document.querySelector('#mChem')?.value === 'important'), '설정 케미 알림 기본 = 중요한 것만');
await p.selectOption('#mChem', 'off');
await W(300);
ok(await p.evaluate(() => localStorage.getItem('legacy-of-adventure-chemNotice') === '"off"'), '끄기 저장');
await clear();
// 파티 창: 짝 둘을 고르면 ♥ 줄
await p.evaluate(() => { window.__P.runs.length = 0; for (const a of window.__world.actors) if (a.id) { a.runId = null; a.hp = 100; } });
await p.locator('#bExp').click();
await W(900);
await p.locator('.quest').first().click();
await W(900);
const ids = await p.evaluate(() => Object.keys(window.__P.bonds)[0].split('-'));
for (const id of ids) { await p.locator('#winB .pm[data-id="' + id + '"]').click(); await W(400); }
const cp = await p.evaluate(() => document.querySelector('#winB .cpair')?.textContent ?? '');
ok(/♥/.test(cp) && /케미 ×1\.\d\d/.test(cp), '파티 창 ♥ 줄: ' + cp);
ok(errs.length === 0, '페이지 에러 0 ' + errs.join(' | '));
console.log(JSON.stringify({ [name]: out }, null, 1));
console.log(fail ? '✗ ' + fail + '개 실패' : '✓ 모두 통과');
await b.close();
process.exit(fail ? 1 : 0);
