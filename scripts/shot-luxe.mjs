// LUXE §1 명품관 전/후 시트 → reports/luxe/shop/ — BOT_BUILD=1 빌드를 띄우고 URL=… SAVE=<실세이브> node scripts/shot-luxe.mjs (실세이브는 저장소 밖)
//  전 = 플래그 끔(실험실 끔) 상점 창 · 후 = 실험실 켬: 탭 잠김/열림 · 이번 주 명품 · 세트 4줄 · 작은 사치 · 산 뒤 · 마을에 놓은 세트(낮·밤 · 세트 완성 반짝이)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const SP = 'C:/Users/choly/AppData/Local/Temp/claude/C--Users-choly/aeed0df9-0ecc-49a1-923e-e1b70684cfba/scratchpad';
const raw = fs.readFileSync(process.env.SAVE ?? `${SP}/woongs3/save_01.json`, 'utf8');
const dir = 'reports/luxe/shop';
fs.mkdirSync(dir, { recursive: true });
const URL = process.env.URL ?? 'http://localhost:4458/';
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
/** 대사·창 닫기 (갑자기 뜬 전설 도착 등) */
const calm = async (p) => { for (let i = 0; i < 8; i++) { const busy = await p.evaluate(() => { const d = document.querySelector('#dlg'); if (d && !d.hidden) return d.click(), true; return false; }); if (!busy) break; await p.waitForTimeout(250); } };
/** 마을 가까이 (논리 px 배율 sc) */
const zoom = (p, sc) => p.evaluate((sc) => {
  const view = window.__view;
  const cv = document.getElementById('scene');
  const r = document.getElementById('view').getBoundingClientRect();
  view.SC = sc;
  view.LW = Math.ceil(r.width / sc);
  view.LH = Math.ceil(r.height / sc);
  cv.width = view.LW;
  cv.height = view.LH;
  cv.style.width = view.LW * sc + 'px';
  cv.style.height = view.LH * sc + 'px';
  cv.getContext('2d').imageSmoothingEnabled = false;
}, sc);
const shot = async (p, name) => { const f = `${dir}/${name}.png`; await p.screenshot({ path: f }); out.push(f); console.error('✓', f); };
/** 창 안에서 그 머리줄이 위로 오게 */
const scrollTo = (p, text) => p.evaluate((t) => { const h = [...document.querySelectorAll('#winB .qhd')].find((x) => x.textContent.includes(t)); h?.scrollIntoView({ block: 'start' }); }, text);

// 마을에 놓을 묶음 (상대 칸) — 중심을 (0,0)에
const GROUPS = {
  moon: [['moon_gazebo', 0, 0], ['moon_lantern', 4, 0], ['silver_bench', 4, 2], ['moon_pond', 0, 4]],
  plaza: [['weapon_rack', 0, 0], ['victory_arch', 1, 2], ['flag_pole', 4, 2], ['hero_trainer', 1, 4]],
  flower: [['flower_clock', 0, 0], ['flower_tower', 4, 0], ['flower_swing', 4, 2], ['flower_carousel', 0, 4]],
  study: [['star_library', 0, 0], ['star_telescope', 3, 0], ['float_books', 3, 1], ['armillary', 0, 3]],
  weekly: [['gold_carriage', 0, 0], ['dragon_nest', 4, 0], ['rainbow_fountain', 0, 3], ['sky_balloon', 3, 3], ['turtle_statue', 6, 0], ['aurora_pillar', 6, 3]],
  small: [['lx_pot_blue', 0, 0], ['lx_pot_mint', 1, 0], ['lx_pot_violet', 2, 0], ['lx_mini_fountain', 0, 2], ['lx_cat_house', 1, 2], ['lx_color_flag', 2, 2]],
};
async function placeGroup(p, g) {
  return p.evaluate((list) => {
    const w = window.__world;
    const [a, bb] = window.__town.landBounds();
    const size = (k) => window.__def(k).size;
    const W = Math.max(...list.map(([k, x]) => x + size(k)[0]));
    const H = Math.max(...list.map(([k, , y]) => y + size(k)[1]));
    const hit = (o, x0, y0) => o.tx < x0 + W + 1 && o.tx + o.fw > x0 - 1 && o.ty < y0 + H + 1 && o.ty + o.fh > y0 - 1;
    // 지난 묶음은 치운다 (명품 장식만 · 저장 안 함)
    w.objs = w.objs.filter((o) => !window.__def(o.kind).luxe);
    let best = null;
    const m = Math.floor((a + bb) / 2) - Math.floor(W / 2);
    for (let r = 0; r < 12 && !best; r++)
      for (let dy = -r; dy <= r && !best; dy++)
        for (let dx = -r; dx <= r && !best; dx++) {
          const x0 = m + dx;
          const y0 = m + dy;
          if (x0 < a + 1 || y0 < a + 1 || x0 + W > bb - 1 || y0 + H > bb - 1) continue;
          if (w.objs.some((o) => (o.kind === 'inn' || o.kind === 'dungeon' || o.kind === 'tavern') && hit(o, x0, y0))) continue;
          best = [x0, y0];
        }
    if (!best) return null;
    const [x0, y0] = best;
    w.objs = w.objs.filter((o) => !hit(o, x0, y0));
    for (const [k, x, y] of list) window.__town.addObj(k, x0 + x, y0 + y);
    window.__town.rebuildPaths();
    window.__game.focusTile(x0 + W / 2, y0 + H / 2);
    return [x0, y0, W, H];
  }, g);
}

for (const w of [360, 1280]) {
  // 전: 플래그 끔 (실험실 끔) — 상점 창에 명품관 탭 없음
  {
    const { p, ctx, W, errs } = await session(w, false);
    await p.evaluate(() => window.__openShop());
    await W(800);
    await shot(p, `${w}_0_before_shop`);
    if (errs.length) console.error('ERR', errs);
    await ctx.close();
  }
  const { p, ctx, W, errs } = await session(w, true);
  // 잠김: 장부를 아직 못 끝낸 것처럼 (잠깐 · 저장 안 함)
  const keep = await p.evaluate(() => { const g = window.__P.guide; const k = { claimed: [...g.claimed], legacy: g.legacy }; g.legacy = false; g.claimed = []; return k; });
  await p.evaluate(() => window.__openShop());
  await W(600);
  const locked = await p.evaluate(() => document.querySelector('#hvTabs [data-hvt="luxe"]')?.textContent);
  console.error('tab', locked);
  await p.evaluate(() => document.querySelector('#hvTabs [data-hvt="luxe"]')?.click());
  await W(300);
  await shot(p, `${w}_1_tab_locked`);
  await p.evaluate((k) => Object.assign(window.__P.guide, k), keep);
  await W(2600);
  // 열림 + 쿠폰 1장(마을 회관)
  await p.evaluate(() => { window.__P.bundles.coupon = 1; window.__openShop(); });
  await W(600);
  await shot(p, `${w}_2_tab_unlocked_shop`);
  await p.evaluate(() => document.querySelector('#hvTabs [data-hvt="luxe"]')?.click());
  await W(800);
  await shot(p, `${w}_3_luxe_weekly`);
  for (const [i, s] of ['달빛 정원', '용사의 광장', '꽃 축제', '별의 서재'].entries()) {
    await scrollTo(p, s);
    await W(300);
    await shot(p, `${w}_4_set${i + 1}`);
  }
  await scrollTo(p, '작은 사치');
  await W(300);
  await shot(p, `${w}_5_small`);
  // 사기: 달빛 등롱 (확인 시트 → 들이기)
  await p.evaluate(() => document.querySelector('[data-lxb="moon_lantern"]')?.click());
  await W(500);
  await shot(p, `${w}_6_buy_confirm`);
  await p.evaluate(() => document.querySelector('#cshOk')?.click());
  await W(900);
  await shot(p, `${w}_7_bought_banner`);
  await p.evaluate(() => document.querySelector('#winX')?.click());
  await W(400);
  // 마을: 묶음마다 낮 · 밤
  for (const [g, list] of Object.entries(GROUPS)) {
    const at = await placeGroup(p, list);
    if (!at) { console.error('no spot', g); continue; }
    await zoom(p, w < 800 ? 2 : 3);
    await p.evaluate(([x, y, ww, hh]) => window.__game.focusTile(x + ww / 2, y + hh / 2), at);
    await p.evaluate(() => { window.__S.clock = 6 * 60; });
    await W(1800);
    await calm(p);
    await W(300);
    await shot(p, `${w}_8_${g}_day`);
    await p.evaluate(() => { window.__S.clock = (22 - 6) * 60 + 60; });
    await W(2600);
    await calm(p);
    await W(300);
    await shot(p, `${w}_9_${g}_night`);
  }
  // 세트 효과·어울림 줄 확인 (마지막 묶음 = 작은 사치라 세트 없음 → 서재를 다시 놓고 건물 창)
  await placeGroup(p, GROUPS.study);
  await W(600);
  const info = await p.evaluate(() => { const o = window.__world.objs.find((x) => x.kind === 'star_library'); window.__showObj(o); return document.querySelector('#winB .hrows')?.textContent ?? ''; });
  console.error('harmony rows:', info);
  await W(600);
  await shot(p, `${w}_10_set_row_in_building_window`);
  if (errs.length) console.error('ERR', errs);
  await ctx.close();
}
// 시트 한 장
const html = `<html><body style="background:#111;color:#ddd;font:14px sans-serif;margin:10px"><h2>LUXE §1 명품관 — 전/후 (롯데캐슬 세이브 · 실험실)</h2>${[360, 1280].map((w) => `<h3>${w}px</h3><div style="display:flex;flex-wrap:wrap;gap:8px">${out.filter((f) => f.includes(`/${w}_`)).map((f) => `<figure style="margin:0"><img src="${f.split('/').pop()}" style="height:${w === 360 ? 520 : 300}px;border:1px solid #444"><figcaption>${f.split('/').pop()}</figcaption></figure>`).join('')}</div>`).join('')}</body></html>`;
fs.writeFileSync(`${dir}/sheet.html`, html);
const ctx = await b.newContext({ viewport: { width: 2400, height: 1200 } });
const pg = await ctx.newPage();
await pg.goto('file:///' + process.cwd().split(String.fromCharCode(92)).join('/') + '/' + dir + '/sheet.html');
await pg.waitForTimeout(800);
await pg.screenshot({ path: `${dir}/sheet.png`, fullPage: true });
console.error('✓ sheet');
await b.close();
