// HOTFIX17 e2e: §1 「🎯 오늘」 알약 — 손님 상세·토벌·사냥·건설·메뉴 창이 열리면 숨고 닫으면 다시 · §2 토벌 도전 — 직접 1판 2/3 · 자동 1판 1/3 · 연타해도 0 아래로 안 감 · 결과 창 여닫기로 차감 없음
//  실행: dist-bot 미리보기 4190 (또는 URL=…) · node scripts/e2e-hotfix17.mjs
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const save = JSON.parse(fs.readFileSync('tests/fixtures/beta_town.json', 'utf8'));
// 피해 저장 재현: 오늘 도전 5번 = -2/3
const d = new Date();
save.progress.raid = { ...(save.progress.raid ?? {}), day: `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`, tries: 5 };
const dir = 'screenshots/hotfix17';
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
  localStorage.setItem('legacy-of-adventure-sound', JSON.stringify({ bgmOn: false, bgmVol: 0.4, sfxOn: false, sfxVol: 0.7, muted: true }));
}, JSON.stringify(save));
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
p.on('dialog', (dl) => { errs.push('confirm/alert: ' + dl.message()); dl.accept(); });
const W = (ms) => p.waitForTimeout(ms);
let fail = 0;
const ok = (c, m) => { console.error((c ? '✓ ' : '✗ ') + m); if (!c) fail++; };
const settle = async () => {
  for (let i = 0, calm = 0; i < 80 && calm < 3; i++) {
    const busy = await p.evaluate(() => { if (!document.querySelector('#dlg').hidden) return document.querySelector('#dlg').click(), true; if (document.querySelector('#win').classList.contains('on')) return document.querySelector('#winX').click(), true; return false; });
    calm = busy ? 0 : calm + 1;
    await W(busy ? 200 : 600);
  }
};
const pill = () => p.evaluate(() => { const e = document.querySelector('#goalPill'); return !!e && !e.hidden && e.checkVisibility(); });
const tries = () => p.evaluate(() => ({ tries: window.__P.raid.tries, settled: window.__P.raid.lastSettled, seq: window.__P.raid.runSeq }));

await p.goto(process.env.URL ?? 'http://localhost:4190/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__S, null, { timeout: 20000 });
await W(1500);
await p.locator('#tCont').click();
await W(3000);
await settle();
await p.evaluate(() => { const P = window.__P; if (!P.guide.unlocked.includes('raid')) P.guide.unlocked.push('raid'); P.runs.length = 0; P.hunt.auto = null; for (const a of window.__world.actors) if (a.id) a.hp = 100; });
await W(1300);

// ── §2 복구: 저장에 오늘 5번(-2/3) → 불러오면 오늘 횟수를 돌려받음
const t0 = await tries();
ok(t0.tries === 0, `피해 저장 복구: 오늘 도전 5 → ${t0.tries}`);

// ── §1 알약
ok(await pill(), '마을: 알약 보임');
const wins = [
  ['손님 상세', () => p.evaluate(() => { const a = window.__world.actors.find((x) => !x.role && x.id); document.querySelector('#bGuest').click(); return a; })],
  ['건설', () => p.evaluate(() => document.querySelector('#bBuild').click())],
  ['메뉴', () => p.evaluate(() => document.querySelector('#bMenu2').click())],
  ['사냥', () => p.evaluate(() => window.__openHunt())],
  ['원정·토벌', () => p.evaluate(() => document.querySelector('#bExp').click())],
];
for (const [label, open] of wins) {
  await open();
  await W(1300);
  const shown = await pill();
  ok(!shown, `${label} 창: 알약 숨김`);
  await settle();
  await W(1300);
  ok(await pill(), `${label} 닫으면 다시 보임`);
}
// 손님 상세 창 (손님 한 명을 눌렀을 때)
await p.evaluate(() => { document.querySelector('#bGuest').click(); });
await W(700);
await p.evaluate(() => document.querySelector('#winB [data-a], #winB .glist button, #winB .gl button')?.click());
await W(1200);
ok(!(await pill()), '손님 한 명 상세 창: 알약 숨김');
await p.screenshot({ path: `${dir}/guest_detail.png` });
await settle();

// ── §2 직접 토벌 1판
await p.evaluate(() => document.querySelector('#bExp').click());
await W(800);
await p.locator('#rWeek').click();
await W(800);
await p.locator('#rgMan').click();
await W(2500);
ok(!(await pill()), '토벌 전투 중: 알약 숨김');
for (let i = 0; i < 40 && !(await p.evaluate(() => !window.__combat.field() || window.__combat.field().done)); i++) {
  await p.evaluate(() => window.__combat.advance(10));
  await W(100);
}
await W(4000);
const t1 = await tries();
ok(t1.tries === 1 && t1.settled === t1.seq, `직접 토벌 1판 → 남은 ${3 - t1.tries}/3 (판 ${t1.seq} · 정산 ${t1.settled})`);
const resTxt = await p.evaluate(() => document.querySelector('#winB')?.textContent ?? '');
ok(!/-\d\/3/.test(resTxt), '결과 창에 음수 없음');
await p.screenshot({ path: `${dir}/raid_result.png` });
await settle();
await W(1500);
ok((await tries()).tries === 1, '결과 창을 닫고 기다려도 그대로 1');

// ── 자동 토벌 1판 + 연타
await p.evaluate(() => document.querySelector('#bExp').click());
await W(800);
await p.locator('#rWeek').click();
await W(800);
await p.evaluate(() => { const b = document.querySelector('#rgAuto'); for (let i = 0; i < 5; i++) b.click(); });
await W(1500);
ok((await tries()).tries === 2, `자동 토벌 5연타 → 한 판만 (남은 ${3 - (await tries()).tries}/3)`);
await settle();
for (let k = 0; k < 3; k++) {
  await p.evaluate(() => document.querySelector('#bExp').click());
  await W(800);
  await p.locator('#rWeek').click();
  await W(800);
  const can = await p.evaluate(() => { const b = document.querySelector('#rgAuto'); return !!b && !b.disabled && b.getAttribute('aria-disabled') !== 'true'; });
  if (can) await p.evaluate(() => document.querySelector('#rgAuto').click());
  await W(1200);
  await settle();
}
const t3 = await tries();
const leftTxt = await p.evaluate(() => { document.querySelector('#bExp').click(); return 1; });
void leftTxt;
await W(800);
await p.locator('#rWeek').click();
await W(800);
const prep = await p.evaluate(() => document.querySelector('#winB').textContent.match(/오늘 남은 도전 (-?\d+)\/3/)?.[1]);
ok(t3.tries === 3 && prep === '0', `다 쓰면 0/3에서 멈춤 (tries ${t3.tries} · 준비 창 ${prep}/3)`);
await p.screenshot({ path: `${dir}/raid_zero.png` });
ok(errs.length === 0, '페이지 에러·confirm 0 ' + errs.join(' | '));
console.log(fail ? `✗ ${fail}개 실패` : '✓ 모두 통과');
await b.close();
process.exit(fail ? 1 : 0);
