// v0.24.4 e2e (실세이브 따밤 · 폰): 끝없는 심연 5층(보스) AUTO — 보스가 피해를 받는다 (동료·AUTO가 보스를 친다)
//  실행: URL=http://localhost:4207/ SAVE=<저장 json> node scripts/e2e-abyss-auto.mjs   (봇 빌드 · 저장이 없으면 건너뜀)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const FIX = process.env.SAVE ?? 'tests/fixtures/real_gs_ttabam.json';
if (!fs.existsSync(FIX)) {
  console.error('실세이브가 없어 건너뜀');
  process.exit(0);
}
const save = fs.readFileSync(FIX, 'utf8');
const dir = 'screenshots/abyss-auto';
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
// OFF=1: 고치기 전(aiBossTarget 끔)과 비교
if (process.env.OFF) await ctx.route('**/flags.json*', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ aiBossTarget: false }) }));
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
await p.goto(process.env.URL ?? 'http://localhost:4207/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__S, null, { timeout: 20000 });
await W(1500);
await p.locator('#tCont').click();
await W(3000);
await settle();
await p.evaluate(() => { for (const a of window.__world.actors) if (a.id) a.hp = 100; });
await p.evaluate(() => window.__abyss.open());
await W(800);
await settle();
await p.evaluate(() => window.__abyss.open());
await W(800);
const st = await p.evaluate(() => { const s = window.__abyss.state(); return { auto: s.autoClimb, n: s.picked.length }; });
ok(st.auto && st.n > 0, `심연 창 · AUTO 켜짐 · 데려갈 단골 ${st.n}`);
await p.evaluate(() => { const ids = window.__abyss.state().picked; window.__abyss.climb(5, window.__world.actors.filter((a) => ids.includes(a.id))); });
await p.waitForFunction(() => !!window.__combat.field(), null, { timeout: 10000 });
const f0 = await p.evaluate(() => { const f = window.__combat.field(); return { stage: f.stage, auto: f.auto, rec: Math.round(f.rec), jobs: f.allies.map((u) => u.job) }; });
ok(f0.stage === 10 && f0.auto, `5층 = 보스 판 · AUTO (${f0.jobs} · 추천 ${f0.rec})`);
// 동료가 쓰러지지 않게만 (힘은 그대로)
await p.evaluate(() => { for (const u of window.__combat.field().allies) { u.max = 1e12; u.hp = 1e12; } });
await W(1000);
await p.evaluate(() => { const f = window.__combat.field(); f.kills = f.killGoal; });
await p.waitForFunction(() => window.__combat.field()?.elite?.boss && window.__combat.field().elite.st !== 'spawn', null, { timeout: 15000 });
// 잡몹 정리 → 보스만
await p.evaluate(() => { for (const u of window.__combat.field().units) if (u.team === 'mob' && !u.boss) { u.hp = 0; u.dead = true; } });
const h0 = await p.evaluate(() => { const e = window.__combat.field().elite; return { hp: e.hp, max: e.max }; });
const samp = await p.evaluate(async () => { const f = window.__combat.field(); const e = f.elite; const out = f.allies.map(() => ({ sw: 0, d: 0, n: 0 })); for (let i = 0; i < 60; i++) { await new Promise((r) => setTimeout(r, 200)); f.allies.forEach((u, j) => { out[j].n++; out[j].d += Math.hypot(u.x - e.x, u.y - e.y); if ((u.swing ?? 0) > 0) out[j].sw++; }); } return f.allies.map((u, j) => `${u.job}${u === f.me ? '(me)' : ''} d${(out[j].d / out[j].n).toFixed(2)} swing${out[j].sw}/60`).join(' · '); });
console.error('  ' + samp);
await p.screenshot({ path: `${dir}/phone_floor5.png` });
const h1 = await p.evaluate(() => { const f = window.__combat.field(); const e = f.elite; return { hp: e.dead ? 0 : e.hp, auto: f.auto, done: f.done }; });
const pct = ((h0.hp - h1.hp) / h0.max) * 100;
ok(h1.auto && h1.hp < h0.hp, `12초 AUTO: 보스 피해 ${Math.round(h0.hp - h1.hp)} (${pct.toFixed(1)}% of ${Math.round(h0.max)})`);
ok(pct > 20, '보스 체력이 눈에 띄게 준다 (>20% · 고치기 전엔 사제 혼자 ~7%)');
ok(!errs.length, '페이지 오류 없음 ' + errs.join(' | '));
await b.close();
console.error(fail ? `✗ ${fail}개 실패` : '✓ 모두 통과');
process.exit(fail ? 1 : 0);
