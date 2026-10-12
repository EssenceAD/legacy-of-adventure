// HOTFIX18 e2e: §4 업데이트 뒤 첫 실행 「새로 생긴 것」 카드(3줄 · [해 보기] → 꾸미기 모드 · 다시 보지 않기 · 패치 노트 전체)
//  §3 케미 알림 「전부」 → 「중요만」 한 번 + 안내 · §1 v0.11.3 뒤에 새로 지은 두 번째 텃밭엔 사과 편지 없음 · §2 추정 막 기록 표시
//  실행: dist-bot 미리보기 4190 (APP_VERSION이 있어야 카드가 뜬다) · node scripts/e2e-hotfix18.mjs
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const save = JSON.parse(fs.readFileSync('tests/fixtures/beta_town.json', 'utf8'));
// 새로 지은 두 번째 텃밭 (v0.11.3 뒤) · 사과 편지는 아직 안 받음
const g = save.buildings.find((b) => b.kind === 'garden');
save.progress.meta = { ...(save.progress.meta ?? {}), sorryDupe: false };
const hasGarden = !!g;
if (g) save.buildings.push({ ...g, tx: g.tx, ty: g.ty + 3, builtAt: Date.parse('2026-10-12T05:00:00+09:00') });
const dir = 'screenshots/hotfix18';
fs.mkdirSync(dir, { recursive: true });
const b = await chromium.launch({ channel: 'chrome' });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await ctx.addInitScript((s) => {
  try { if (sessionStorage.getItem('x')) return; sessionStorage.setItem('x', 1); } catch { return; }
  localStorage.clear();
  localStorage.setItem('legacy-of-adventure-save', s);
  localStorage.setItem('legacy-of-adventure-teaserSeen', 'true');
  localStorage.setItem('legacy-of-adventure-lastVersion', '"0.17.0-beta"');
  localStorage.setItem('legacy-of-adventure-chemNotice', '"all"');
  localStorage.setItem('legacy-of-adventure-settleOff', 'true');
  localStorage.setItem('legacy-of-adventure-sound', JSON.stringify({ bgmOn: false, bgmVol: 0.4, sfxOn: false, sfxVol: 0.7, muted: true }));
}, JSON.stringify(save));
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
const W = (ms) => p.waitForTimeout(ms);
let fail = 0;
const ok = (c, m) => { console.error((c ? '✓ ' : '✗ ') + m); if (!c) fail++; };
await p.goto(process.env.URL ?? 'http://localhost:4190/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__S, null, { timeout: 20000 });
await W(1500);
await p.locator('#tCont').click();
// 처음 뜨는 대화·다른 창은 닫고, 「새로 생긴 것」 카드가 뜰 때까지
let card = false;
const toasts = [];
for (let i = 0; i < 60 && !card; i++) {
  const st = await p.evaluate(() => ({ d: !document.querySelector('#dlg').hidden, w: document.querySelector('#win').classList.contains('on') ? document.querySelector('#winT').textContent : '', t: document.querySelector('#toast')?.textContent ?? '' }));
  if (st.t) toasts.push(st.t);
  if (st.w === '새로 생긴 것') card = true;
  else if (st.d) await p.locator('#dlg').click().catch(() => {});
  else if (st.w) await p.locator('#winX').click().catch(() => {});
  await W(400);
}
ok(card, '업데이트 뒤 첫 실행: 「새로 생긴 것」 카드');
const rows = await p.evaluate(() => [...document.querySelectorAll('.hlrow')].map((r) => r.textContent.trim().slice(0, 30)));
ok(rows.length === 3 && (await p.locator('#hlAll').count()) === 1 && (await p.locator('#hlOff').count()) === 1, `카드 3줄 + 패치 노트 전체 · 다시 보지 않기: ${rows.join(' | ')}`);
await p.screenshot({ path: `${dir}/highlights.png` });
for (let i = 0; i < 20 && (await p.evaluate(() => !document.querySelector('#dlg').hidden)); i++) (await p.locator('#dlg').click().catch(() => {}), await W(300));
await p.evaluate(() => document.querySelector('[data-hl="0"]').click());
await W(800);
ok(await p.evaluate(() => document.body.classList.contains('decor')), '[꾸며 보기] → 꾸미기 모드');
await p.evaluate(() => document.querySelector('#decorBar [data-act="exit"]').click());
await W(2500);
const chem = await p.evaluate(() => localStorage.getItem('legacy-of-adventure-chemNotice'));
ok(chem === '"important"' && toasts.concat(await p.evaluate(() => document.querySelector('#toast')?.textContent ?? '')).some((t) => /중요만/.test(t)), `케미 알림 「전부」 → 「중요만」 + 안내 (${chem})`);
const mail = await p.evaluate(() => window.__P.meta.mail.filter((m) => /사라진 건물/.test(m.title)).length);
ok(!hasGarden || (mail === 0 && (await p.evaluate(() => window.__P.meta.sorryDupe))), `새로 지은 두 번째 텃밭 → 사과 편지 없음 (${mail}) · 확인 표시`);
const tele = await p.evaluate(() => ({ act: window.__P.story.act, seen: window.__P.story.seen.filter((k) => k.startsWith('tele:')) }));
ok(tele.act < 2 || tele.seen.includes('tele:act' + tele.act), `추정 막 기록: ${tele.act}막 · ${tele.seen.join(',')}`);
ok(errs.length === 0, '페이지 에러 0 ' + errs.join(' | '));
console.log(fail ? `✗ ${fail}개 실패` : '✓ 모두 통과');
await b.close();
process.exit(fail ? 1 : 0);
