// RAIDWEAPON §2 전용 무기 시트 → reports/raidweapon/ex/ — BOT_BUILD=1 빌드를 띄우고 URL=… SAVE=<실세이브> node scripts/shot-exweap.mjs
//  무기 창(가방 · ★5 전 잠김 · 낀 뒤) · 선택 상자 · 깨어나는 컷 · 도감 무기 칸 · 전투 궤적(심연 한 판) — 412 · 1280 · 실험실 켬 (+ 끔 비교 1장)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const raw = fs.readFileSync(process.env.SAVE ?? 'tests/fixtures/real_woongs.json', 'utf8');
const dir = 'reports/raidweapon/ex';
fs.mkdirSync(dir, { recursive: true });
const URL = process.env.URL ?? 'http://localhost:4412/';
const b = await chromium.launch({ channel: 'chrome' });
const out = [];
async function session(w, lab) {
  const mobile = w < 800;
  const ctx = await b.newContext({ viewport: { width: w, height: mobile ? 860 : 820 }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
  await ctx.addInitScript(([s, lab]) => {
    try { if (sessionStorage.getItem('x')) return; sessionStorage.setItem('x', 1); } catch { return; }
    localStorage.clear();
    localStorage.setItem('legacy-of-adventure-save', s);
    localStorage.setItem('legacy-of-adventure-teaserSeen', 'true');
    localStorage.setItem('legacy-of-adventure-lastVersion', '"99"');
    localStorage.setItem('legacy-of-adventure-telemetry', 'false');
    localStorage.setItem('legacy-of-adventure-settleOff', 'true');
    localStorage.setItem('legacy-of-adventure-sound', JSON.stringify({ bgmOn: false, bgmVol: 0.4, sfxOn: false, sfxVol: 0.7, muted: true }));
    if (lab) localStorage.setItem('legacy-of-adventure-visualLab', 'true');
  }, [raw, lab]);
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  const W = (ms) => p.waitForTimeout(ms);
  await p.goto(URL, { waitUntil: 'networkidle' });
  await p.waitForFunction(() => !!window.__S, null, { timeout: 20000 });
  await W(1500);
  await p.locator('#tCont').click();
  await W(3000);
  await calm(p, W);
  return { p, ctx, W, errs };
}
async function calm(p, W) {
  for (let i = 0, c = 0; i < 80 && c < 3; i++) {
    const busy = await p.evaluate(() => { const d = document.querySelector('#dlg'); if (d && !d.hidden) return d.click(), true; if (document.querySelector('#win').classList.contains('on')) return document.querySelector('#winX').click(), true; return false; });
    c = busy ? 0 : c + 1;
    await W(busy ? 200 : 500);
  }
}
const shot = async (p, name) => { const f = `${dir}/${name}.png`; await p.screenshot({ path: f }); out.push(f); console.error('✓', f); };
/** 준비: 전설 ★5 (엘리시아) · ★4로 낮춘 다른 전설 · 조각 23 · 무기 두 자루 */
async function setup(p) {
  return p.evaluate(() => {
    const A = (window.__world.home?.actors ?? window.__world.actors).filter((a) => a.legendId && a.status === 'hero');
    const five = A.find((a) => (a.stars ?? 1) >= 5) ?? A[0];
    if (five) five.stars = 5;
    const low = A.find((a) => a !== five);
    if (low) low.stars = Math.min(4, low.stars ?? 1);
    window.__ex.frags(23, 'sheet');
    const w5 = window.__ex.grant(five.legendId);
    const w4 = low ? window.__ex.grant(low.legendId) : null;
    return { five: five?.id, fiveKey: five?.legendId, low: low?.id, w5: w5?.id, w4: w4?.id };
  });
}
for (const w of [412, 1280]) {
  const { p, ctx, W, errs } = await session(w, true);
  const s = await setup(p);
  await p.evaluate(() => window.__ex.bag());
  await W(500);
  await shot(p, `${w}_1_bag`);
  if (s.w4) {
    await p.evaluate((id) => window.__ex.item(id), s.w4);
    await W(400);
    await shot(p, `${w}_2_item_locked`);
  }
  await p.evaluate((id) => window.__ex.item(id), s.w5);
  await W(400);
  await shot(p, `${w}_3_item_ready`);
  // 처음 끼우기 → 컷
  await p.evaluate(() => document.querySelector('[data-exwear]')?.click());
  await W(450);
  await shot(p, `${w}_4_awaken_cut`);
  await W(1500);
  await p.evaluate((id) => window.__ex.item(id), s.w5);
  await W(400);
  await shot(p, `${w}_5_item_worn`);
  await p.evaluate(() => window.__ex.box(() => {}));
  await W(400);
  await shot(p, `${w}_6_choice_box`);
  await calm(p, W);
  await p.evaluate(() => window.__openDex(3));
  await W(500);
  await p.evaluate(() => document.querySelector('.exdex')?.scrollIntoView({ block: 'center' }));
  await W(300);
  await shot(p, `${w}_7_dex_weapons`);
  await calm(p, W);
  // 전투: 심연 한 판 (★5 + 전용 무기 = 금빛 무기)
  if (w === 412) {
    await p.evaluate((id) => { window.__P.hunt.best.deep = Math.max(10, window.__P.hunt.best.deep ?? 0); const a = window.__world.actors.find((x) => x.id === id); window.__abyss.climb(1, [a]); }, s.five);
    for (let i = 0; i < 4; i++) {
      await W(1300);
      await shot(p, `${w}_8_combat_${i}`);
    }
  }
  if (errs.length) console.error('에러', errs);
  await ctx.close();
}
// 비교: 실험실 끔 = 가방에 조각 줄 없음
{
  const { p, ctx, W } = await session(412, false);
  await p.evaluate(() => window.__ex.bag());
  await W(500);
  await shot(p, '412_0_bag_flag_off');
  await ctx.close();
}
await b.close();
console.log(out.join('\n'));
