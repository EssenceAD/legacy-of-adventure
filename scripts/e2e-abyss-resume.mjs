// v0.24.5 e2e (실세이브 · 폰): 끝없는 심연 체크포인트(10·20·30 입장료) → 30층 시작 → 31층 들어가서 ✕로 나감 → 다시 들어오면 31층부터 무료 · 새로고침해도
//  실행: URL=http://localhost:4208/ SAVE=<저장 json> node scripts/e2e-abyss-resume.mjs   (봇 빌드 · 저장이 없으면 건너뜀)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const FIX = process.env.SAVE ?? 'tests/fixtures/real_gs_woongs.json';
if (!fs.existsSync(FIX)) {
  console.error('실세이브가 없어 건너뜀');
  process.exit(0);
}
const save = fs.readFileSync(FIX, 'utf8');
const dir = 'screenshots/abyss-resume';
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
}, save);
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
const W = (ms) => p.waitForTimeout(ms);
let fail = 0;
const ok = (c, m) => { console.error((c ? '✓ ' : '✗ ') + m); if (!c) fail++; };
const settle = async () => {
  for (let i = 0, calm = 0; i < 80 && calm < 3; i++) {
    const busy = await p.evaluate(() => { if (!document.querySelector('#dlg').hidden) return document.querySelector('#dlg').click(), true; if (document.querySelector('#win').classList.contains('on')) return document.querySelector('#winX').click(), true; return false; });
    calm = busy ? 0 : calm + 1;
    await W(busy ? 200 : 500);
  }
};
const boot = async () => {
  await p.goto(process.env.URL ?? 'http://localhost:4208/', { waitUntil: 'networkidle' });
  await p.waitForFunction(() => !!window.__S, null, { timeout: 20000 });
  await W(1500);
  await p.locator('#tCont').click();
  await W(3000);
  await settle();
};
const openAb = async () => {
  await p.evaluate(() => window.__abyss.open());
  await W(800);
  await settle();
  await p.evaluate(() => window.__abyss.open());
  await W(800);
};
const rec = () => p.evaluate(() => window.__abyss.state().rec);
await boot();
await p.evaluate(() => { for (const a of window.__world.actors) if (a.id) a.hp = 100; });
const r0 = await rec();
ok(r0.best === 33 && !r0.lost, `실세이브: 최고 ${r0.best}층 · 이어하기 ${r0.lost} · 이어가기 ${r0.cur ?? '-'}`);
await openAb();
const cps = await p.$$eval('[data-cp]', (els) => els.map((e) => `${e.dataset.cp}:${e.querySelector('small').textContent}`));
ok(cps.join('|') === '10:1만 G|20:4.1만 G|30:17만 G', `체크포인트 ${cps.join(' · ')}`);
ok(await p.locator('#abNew').isVisible(), '1층부터(무료) 버튼');
await p.screenshot({ path: `${dir}/phone_picker.png` });
// 결과 화면 자동 진행 끄기 · 금화 넉넉히 (시험)
await p.evaluate(() => { const c = document.getElementById('abAuto'); if (c.checked) c.click(); window.__S.gold = Math.max(window.__S.gold, 300000); });
const g0 = await p.evaluate(() => window.__S.gold);
await p.locator('[data-cp="30"]').click();
await p.waitForFunction(() => !!window.__combat.field(), null, { timeout: 10000 });
const g1 = await p.evaluate(() => window.__S.gold);
ok(g0 - g1 <= 165529 && g0 - g1 > 165529 - 500, `30층 입장료 ${g0 - g1} (마을 수입 오차 포함 · 165,529)`);
ok((await rec()).cur === 30, '30층 시작 = 저장(cur 30)');
// 30층 이기기
await p.evaluate(() => { const f = window.__combat.field(); for (const u of f.allies) { u.max = 1e12; u.hp = 1e12; } f.done = 'win'; f.doneT = 0.2; });
await p.waitForSelector('#abNext', { timeout: 10000 });
ok((await rec()).cur === 31, '30층 돌파 → 이어갈 층 31');
await p.locator('#abNext').click();
await W(1500);
const r31 = await rec();
ok(r31.cur === 31, `31층 들어감 (cur ${r31.cur})`);
// ✕ → 포기 → 나가기 카드 → 마을로
await p.locator('#cbQuit').click();
await W(300);
await p.locator('#cbGiveUp').click();
await p.waitForSelector('#abHome3', { timeout: 10000 });
await p.screenshot({ path: `${dir}/phone_leave.png` });
await p.locator('#abHome3').click();
await W(800);
const rL = await rec();
ok(rL.cur === 31 && !rL.lost, `✕로 나감: 이어가기 ${rL.cur} · 유료 이어하기 ${rL.lost}`);
await openAb();
const btn = await p.locator('#abResume').textContent().catch(() => '');
ok(/31층부터 이어가기 · 무료/.test(btn), `다시 들어오면 「${btn}」`);
await p.screenshot({ path: `${dir}/phone_resume.png` });
const g2 = await p.evaluate(() => window.__S.gold);
await p.locator('#abResume').click();
await p.waitForFunction(() => !!window.__combat.field(), null, { timeout: 10000 });
const rr = await p.evaluate(() => ({ gold: window.__S.gold, rec: Math.round(window.__combat.field().rec) }));
ok(rr.gold >= g2, '이어가기 무료 (금화가 줄지 않음)');
// 싸우는 중 새로고침(앱 종료) → 31층부터
await W(2500);
await boot();
const rB = await rec();
ok(rB.cur === 31, `새로고침 뒤 이어가기 ${rB.cur}`);
await openAb();
ok(/31층부터/.test(await p.locator('#abResume').textContent().catch(() => '')), '새로고침 뒤 「31층부터 이어가기 · 무료」');
ok(!errs.length, '페이지 오류 없음 ' + errs.join(' | '));
await b.close();
console.error(fail ? `✗ ${fail}개 실패` : '✓ 모두 통과');
process.exit(fail ? 1 : 0);
