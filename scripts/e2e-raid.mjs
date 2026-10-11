// v0.10.1: 토벌 화면 조작 — AUTO 켜기 · 키보드 J(공격 꾹)/K(구르기) · ✕ 포기 (진짜 클릭·키)
//  예전엔 토벌에 없는 #cbFold 때문에 버튼 연결이 끊겨 셋 다 안 됐다. 실행: dist-bot 미리보기 4190 · node scripts/e2e-raid.mjs [se|pc]
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const name = process.argv[2] ?? 'pc';
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
  localStorage.setItem('legacy-of-adventure-sound', JSON.stringify({ bgmOn: false, bgmVol: 0.4, sfxOn: false, sfxVol: 0.7, muted: true }));
}, save);
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
p.on('dialog', (d) => d.accept());
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
// 시험 준비: 토벌 열기 · 원정 비우기 (단골이 다 돌아와 있게)
await p.evaluate(() => { const P = window.__P; if (!P.guide.unlocked.includes('raid')) P.guide.unlocked.push('raid'); P.runs.length = 0; P.hunt.auto = null; for (const a of window.__world.actors) if (a.id) a.hp = 100; });
await p.locator('#bExp').click();
await W(900);
const rw = p.locator('#rWeek');
ok(await rw.count() > 0, '게시판에 주간 토벌');
await rw.click();
await W(900);
await p.locator('#rgMan').click();
await W(3500);
const F = () => p.evaluate(() => { const f = window.__combat.field(); return f ? { mode: f.mode, auto: f.auto, hold: f.holdAtk, dodge: f.me.dodgeCd ?? 0, done: f.done } : null; });
const f0 = await F();
ok(f0?.mode === 'raid', '토벌 전투 화면 ' + JSON.stringify(f0));
ok(!(await p.evaluate(() => !!document.querySelector('#cbFold'))), '토벌엔 접기 버튼 없음');
// AUTO
await p.locator('#cbAuto').click();
await W(300);
ok((await F())?.auto === true, 'AUTO 켜짐 (진짜 클릭)');
await p.locator('#cbAuto').click();
await W(300);
ok((await F())?.auto === false, 'AUTO 다시 끔');
// 키보드: J 꾹 → 공격 꾹 시간 쌓임 · K → 구르기 쿨
await p.keyboard.down('j');
await W(500);
const held = (await F())?.hold ?? 0;
await p.keyboard.up('j');
ok(held > 0.2, `J 꾹 → 공격 (${held.toFixed(2)}초)`);
await p.keyboard.press('k');
await W(100);
ok(((await F())?.dodge ?? 0) > 0, 'K → 구르기');
// ✕ 포기 (확인 창 수락)
await p.locator('#cbQuit').click();
await W(2500);
const res = await p.evaluate(() => !document.querySelector('#cbRes')?.hidden && !!document.querySelector('#cbRes')?.textContent);
// 토벌은 전투 화면을 닫고 「토벌 결과」 창으로 끝난다
const resWin = await p.evaluate(() => (document.querySelector('#win')?.classList.contains('on') ? document.querySelector('#winT').textContent : ''));
ok(res || /토벌 결과/.test(resWin), '✕ 포기 → 끝나고 결과 (' + (resWin || 'cbRes') + ')');
ok(errs.length === 0, '페이지 에러 0 ' + errs.join(' | '));
console.log(JSON.stringify({ [name]: out }, null, 1));
console.log(fail ? `✗ ${fail}개 실패` : '✓ 모두 통과');
await b.close();
process.exit(fail ? 1 : 0);
