// HUNT_WORLD_SPEC §1: 지역 5곳 × (일반 스테이지 · 보스) 사냥터 배경 스크린샷 + fps · 소품 그림 요청 실패 0 · 페이지 에러 0
//  실행: dist-bot 미리보기 4190 · node scripts/shot-huntworld.mjs [phone|pc] → screenshots/huntworld/<기기>_<지역>_<s>.png
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const name = process.argv[2] ?? 'phone';
const save = fs.readFileSync('tests/fixtures/beta_town.json', 'utf8');
const DEV = { phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }, pc: { viewport: { width: 1920, height: 1080 } } };
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
const bad = [];
p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
p.on('dialog', (d) => d.accept());
p.on('response', (r) => { if (/combat\/props\//.test(r.url()) && r.status() >= 400) bad.push(r.url()); });
const W = (ms) => p.waitForTimeout(ms);
const dir = 'screenshots/huntworld';
fs.mkdirSync(dir, { recursive: true });
let fail = 0;
const out = [];
const ok = (c, m) => { out.push((c ? '✓ ' : '✗ ') + m); if (!c) fail++; };
const clear = async () => {
  for (let i = 0; i < 25; i++) {
    const st = await p.evaluate(() => ({ d: !document.querySelector('#dlg').hidden, w: document.querySelector('#win').classList.contains('on') }));
    if (st.d) await p.locator('#dlg').click().catch(() => {});
    else if (st.w) await p.locator('#winX').click().catch(() => {});
    else return;
    await W(250);
  }
};
await p.goto(process.env.URL ?? 'http://localhost:4190/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__S, null, { timeout: 20000 });
await W(1500);
await p.locator('#tCont').click();
await W(3000);
await clear();
await W(2000);
await clear();
const REG = ['forest', 'swamp', 'mine', 'ice', 'abyss'];
await p.evaluate((REG) => {
  const P = window.__P;
  P.runs.length = 0;
  P.hunt.auto = null;
  for (const r of REG) P.hunt.best[r] = 10;
  if (!P.guide.unlocked.includes('hunt')) P.guide.unlocked.push('hunt');
}, REG);
for (const r of REG)
  for (const s of [3, 10]) {
    await clear();
    await p.evaluate(() => { for (const a of window.__world.actors) if (a.id) a.hp = 100; });
    await p.evaluate((r) => window.__openHunt(r), r);
    await W(600);
    await p.locator(`[data-s="${s}"]`).click({ timeout: 5000 });
    await W(700);
    await p.locator('#hMan').click({ timeout: 5000 });
    await W(2600);
    const fps = await p.evaluate(() => new Promise((ok) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else ok(Math.round(n / 2)); }; requestAnimationFrame(f); }));
    const f = await p.evaluate(() => { const f = window.__combat.field(); return f ? `${f.region} ${f.stage}` : '없음'; });
    await p.screenshot({ path: `${dir}/${name}_${r}_${s}.png` });
    ok(f === `${r} ${s}` && fps >= 25, `${r} ${s === 10 ? '보스' : s}: 전투 ${f} · ${fps}fps`);
    // 나가기 (일시정지 → 포기)
    await p.locator('#cbQuit').click({ timeout: 3000 }).catch(() => {});
    await W(300);
    await p.locator('#cbGiveUp').click({ timeout: 3000 }).catch(() => {});
    await W(2500);
    // 결과 카드 → 마을로 (마지막 버튼)
    await p.evaluate(() => { const bs = [...document.querySelectorAll('#cbRes button')]; (bs.find((x) => /마을|닫기|돌아/.test(x.textContent)) ?? bs[bs.length - 1])?.click(); });
    await W(1200);
    ok(await p.evaluate(() => !document.querySelector('#cbCv')), '  → 마을로 돌아옴');
  }
// 사냥 창 지역 띠
await clear();
await p.evaluate(() => window.__openHunt('mine'));
await W(600);
const band = await p.evaluate(() => getComputedStyle(document.querySelector('.huntw .hmap .hst'), '::before').backgroundColor);
await p.screenshot({ path: `${dir}/${name}_window.png` });
ok(/rgb/.test(band) && band !== 'rgba(0, 0, 0, 0)', `사냥 창 스테이지 칸 지역 색 띠: ${band}`);
ok(bad.length === 0, '소품 그림 요청 실패 0 ' + bad.join(' '));
ok(errs.length === 0, '페이지 에러 0 ' + errs.join(' | '));
console.log(JSON.stringify({ [name]: out }, null, 1));
console.log(fail ? `✗ ${fail}개 실패` : '✓ 모두 통과');
await b.close();
process.exit(fail ? 1 : 0);
