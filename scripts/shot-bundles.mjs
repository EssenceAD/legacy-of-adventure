// LUXE §3 전/후 시트 → reports/luxe/bundles/ — BOT_BUILD=1 빌드를 4301에 띄우고 SAVE=<실세이브> node scripts/shot-bundles.mjs (실세이브는 저장소 밖)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const SP = 'C:/Users/choly/AppData/Local/Temp/claude/C--Users-choly/aeed0df9-0ecc-49a1-923e-e1b70684cfba/scratchpad';
const raw = fs.readFileSync(process.env.SAVE ?? `${SP}/woongs3/save_01.json`, 'utf8');
const dir = 'reports/luxe/bundles';
fs.mkdirSync(dir, { recursive: true });
const URL = 'http://localhost:4301/';
const b = await chromium.launch({ channel: 'chrome' });
const out = [];
async function session(w, lab) {
  const mobile = w < 800;
  const ctx = await b.newContext({ viewport: { width: w, height: mobile ? 780 : 820 }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
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
  for (let i = 0, calm = 0; i < 80 && calm < 3; i++) {
    const busy = await p.evaluate(() => { if (!document.querySelector('#dlg').hidden) return document.querySelector('#dlg').click(), true; if (document.querySelector('#win').classList.contains('on')) return document.querySelector('#winX').click(), true; return false; });
    calm = busy ? 0 : calm + 1;
    await W(busy ? 200 : 600);
  }
  return { p, ctx, W, errs };
}
const shot = async (p, name) => { const f = `${dir}/${name}.png`; await p.screenshot({ path: f }); out.push(f); console.error('✓', f); };
for (const w of [360, 1280]) {
  // 전: 플래그 끔 (실험실 끔)
  {
    const { p, ctx, W, errs } = await session(w, false);
    await p.evaluate(() => window.__openBoard(1));
    await W(800);
    await shot(p, `${w}_0_before_board`);
    if (errs.length) console.error('ERR', errs);
    await ctx.close();
  }
  // 후: 실험실 켬
  const { p, ctx, W, errs } = await session(w, true);
  const tabs = await p.evaluate(() => { window.__openBoard(1); return [...document.querySelectorAll('#bdT .tab')].map((t) => t.textContent); });
  console.error('tabs', tabs);
  await W(500);
  await p.click('#bdT [data-bt="2"]');
  await W(1500);
  await shot(p, `${w}_1_first_open_bernard`);
  for (let i = 0; i < 6 && (await p.evaluate(() => !document.querySelector('#dlg').hidden)); i++) { await p.click('#dlg'); await W(400); }
  await W(500);
  await shot(p, `${w}_2_hall_rooms`);
  // 방 하나 부분 채움: 주방 (시트용으로 당근·호박을 넣음 — 실제 세이브는 작물 0 · 연금 예약 10은 빼고 바침)
  await p.evaluate(() => { const P = window.__P; Object.assign(P.crops, { carrot: 22, pumpkin: 16, cabbage: 3 }); P.growth.fish.bag.minnow = 6; });
  await p.click('[data-bdroom="kitchen"]');
  await W(800);
  await shot(p, `${w}_3_kitchen_partial`);
  // 바치기: 당근 칸
  await p.click('[data-bdgive="k_veg:0"]');
  await W(400);
  await shot(p, `${w}_4_donate_toast`);
  await W(2500);
  await p.click('[data-bdgive="k_veg:1"]');
  await W(600);
  await shot(p, `${w}_5_after_two_slots`);
  // 방 완성: 나머지 재료를 넣고 채움
  await p.evaluate(() => { const P = window.__P; Object.assign(P.crops, { carrot: 30, pumpkin: 30, cabbage: 30 }); Object.assign(P.growth.fish.bag, { minnow: 6, crucian: 4, loach: 5, seabream: 1, mackerel: 3 }); });
  await p.evaluate(() => window.__openBoard(2));
  await W(500);
  for (const id of ['k_veg:0', 'k_veg:1', 'k_veg:2', 'k_fish:0', 'k_fish:1', 'k_fish:2', 'k_feast:0']) {
    const el = await p.$(`[data-bdgive="${id}"]`);
    if (el && (await el.isEnabled())) { await el.click(); await W(300); }
  }
  const last = await p.$('[data-bdgive="k_feast:1"]');
  await last.click();
  await W(1500);
  await shot(p, `${w}_6_room_complete_line`);
  for (let i = 0; i < 6 && (await p.evaluate(() => !document.querySelector('#dlg').hidden)); i++) { await p.click('#dlg'); await W(400); }
  await W(600);
  await shot(p, `${w}_7_room_complete_after`);
  await p.click('#bdBack');
  await W(600);
  await shot(p, `${w}_8_hall_one_piece`);
  console.error('state', await p.evaluate(() => JSON.stringify(window.__P.bundles)));
  if (errs.length) console.error('ERR', errs);
  await ctx.close();
}
// 시트 한 장
const html = `<html><body style="background:#111;color:#ddd;font:14px sans-serif;margin:10px"><h2>LUXE §3 마을 회관 꾸러미 — 전/후 (롯데캐슬 세이브 · 실험실)</h2>${[360, 1280].map((w) => `<h3>${w}px</h3><div style="display:flex;flex-wrap:wrap;gap:8px">${out.filter((f) => f.includes(`/${w}_`)).map((f) => `<figure style="margin:0"><img src="${f.split('/').pop()}" style="height:${w === 360 ? 520 : 300}px;border:1px solid #444"><figcaption>${f.split('/').pop()}</figcaption></figure>`).join('')}</div>`).join('')}</body></html>`;
fs.writeFileSync(`${dir}/sheet.html`, html);
const ctx = await b.newContext({ viewport: { width: 2400, height: 1200 } });
const pg = await ctx.newPage();
await pg.goto('file:///' + process.cwd().split(String.fromCharCode(92)).join('/') + '/' + dir + '/sheet.html');
await pg.waitForTimeout(800);
await pg.screenshot({ path: `${dir}/sheet.png`, fullPage: true });
console.error('✓ sheet');
await b.close();
