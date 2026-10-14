// LUXE §1-3 영웅 의상실 비교 시트 → reports/luxe/outfits/
//  BOT_BUILD=1 npx vite build --outDir dist-bot-wardrobe · npx vite preview --outDir dist-bot-wardrobe --port 4377 --strictPort
//  SAVE=<저장 JSON> node scripts/shot-outfits.mjs (기본 tests/fixtures/real_hyeongcheol.json — 전설 4 · 영웅 8 영입)
//  1) 캐릭터마다 기본 · ① · ②: 마을 도트 4장 · 초상화 · 영웅 카드 (영웅 · 전설 · 다섯 별 시트 3장)  2) 영웅 창 [의상] 옷장  3) 마을 · 전투 (360 · 1280 · 실험실 켬)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const raw = fs.readFileSync(process.env.SAVE ?? 'tests/fixtures/real_hyeongcheol.json', 'utf8');
const dir = 'reports/luxe/outfits';
fs.mkdirSync(dir, { recursive: true });
const URL = process.env.URL ?? 'http://localhost:4377/';
const b = await chromium.launch({ channel: 'chrome' });
const out = [];
const errsAll = [];
async function session(w, lab = true) {
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
  const clear = async () => {
    for (let i = 0, calm = 0; i < 80 && calm < 3; i++) {
      const busy = await p.evaluate(() => { if (!document.querySelector('#dlg').hidden) return document.querySelector('#dlg').click(), true; if (document.querySelector('#win').classList.contains('on')) return document.querySelector('#winX').click(), true; return false; });
      calm = busy ? 0 : calm + 1;
      await W(busy ? 200 : 500);
    }
  };
  await clear();
  return { p, ctx, W, errs, clear };
}
const shot = async (p, name, full = false) => { const f = `${dir}/${name}.png`; await p.screenshot({ path: f, fullPage: full }); out.push(f); console.error('✓', f); };

// ── 1) 비교 시트 (1280 · 게임 화면 위에 시트를 그린다 → 카드는 게임 CSS 그대로) ──
{
  const { p, ctx, W, errs } = await session(1280);
  const rows = await p.evaluate(() => window.__outfits.chars().map((c) => window.__outfits.row(c, 2)).filter(Boolean));
  const stats = [];
  for (const tier of ['hero', 'legend', 'star']) {
    const rs = rows.filter((r) => r.tier === tier);
    await p.evaluate(([rs, tier]) => {
      document.getElementById('osheet')?.remove();
      const d = document.createElement('div');
      d.id = 'osheet';
      d.style.cssText = 'position:absolute;left:0;top:0;z-index:99999;background:#14121e;color:#eee;font:13px Galmuri9,sans-serif;padding:10px;width:1330px';
      const T = { hero: '영웅 10 (② 200만)', legend: '전설 14 (② 300만~500만)', star: '다섯 별 5 (② 500만)' }[tier];
      d.innerHTML = `<h2 style="margin:4px 0 8px">LUXE §1-3 영웅 의상실 — ${T} · 기본 / ① 인연 「친구」 / ② 명품관 · 도트 4장(앞 · 걷기 · 뒤 · 공격) · 초상화 · 카드</h2>` +
        rs.map((r) => `<div style="display:flex;gap:10px;align-items:flex-start;border-top:1px solid #333;padding:6px 0"><b style="width:70px;flex:none;padding-top:30px">${r.name}</b>${r.looks.map((l) => `<div style="width:390px;flex:none;display:flex;flex-direction:column;gap:3px;background:#1e1b2c;padding:4px;overflow:hidden"><div style="font-size:12px;color:#ffd36b">${l.name}${l.id ? ` · 초상화 바뀐 칸 ${l.portChanged}%` : ''}</div><div style="display:flex;gap:4px;align-items:flex-end">${l.dots.map((s) => `<img src="${s}" style="image-rendering:pixelated">`).join('')}<img src="${l.port}" style="width:96px;height:96px;image-rendering:pixelated;margin-left:4px"><div style="zoom:.5;flex:none">${l.card}</div></div></div>`).join('')}</div>`).join('');
      document.body.appendChild(d);
      window.scrollTo(0, 0);
    }, [rs, tier]);
    await W(1500);
    const h = await p.evaluate(() => document.getElementById('osheet').getBoundingClientRect().height);
    await p.setViewportSize({ width: 1350, height: Math.ceil(h) + 20 });
    await W(500);
    await p.locator('#osheet').screenshot({ path: `${dir}/sheet_${tier}.png` });
    out.push(`${dir}/sheet_${tier}.png`);
    console.error('✓ sheet', tier);
    for (const r of rs) stats.push([r.name, ...r.looks.filter((l) => l.id).map((l) => `${l.name} ${l.portChanged}% [${l.portPairs.join(',')}]`)]);
  }
  fs.writeFileSync(`${dir}/portrait_stats.json`, JSON.stringify(stats, null, 1));
  if (errs.length) console.error('ERR', errs), errsAll.push(...errs);
  await ctx.close();
}

if (process.env.ONLY === 'sheet') { await b.close(); process.exit(0); }
// ── 2·3) 옷장 · 마을 · 전투 (360 · 1280) ──
for (const w of [360, 1280]) {
  const { p, ctx, W, errs, clear } = await session(w);
  // 영입한 사람 전부: 의상 다 주고 ②를 입힘 (카엘은 ①)
  const chars = await p.evaluate(() => {
    const L = (window.__world.home?.actors ?? window.__world.actors).filter((a) => a.id && !a.role && a.status === 'hero' && (a.legendId || a.heroId || a.starId));
    const ids = L.map((a) => a.legendId ?? a.heroId ?? a.starId);
    for (const c of ids) window.__outfits.give(c, c === 'kael' ? 'kael_1' : c + '_2');
    return ids;
  });
  console.error('chars', chars.join(','));
  // 옷장: 카엘(① 입음) · 엘리시아(② 입음)
  for (const c of ['kael', 'elysia']) {
    if (!chars.includes(c)) continue;
    await p.evaluate((c) => { const a = (window.__world.home?.actors ?? window.__world.actors).find((x) => (x.legendId ?? x.heroId) === c); window.__showActor(a); }, c);
    await W(700);
    await shot(p, `${w}_1_hero_window_${c}`);
    await p.click('#aWardrobe');
    await W(900);
    await shot(p, `${w}_2_wardrobe_${c}`);
    await clear();
  }
  // 잠긴 칸 보기: 핍은 ② 하나만 가짐
  await p.evaluate(() => { const st = window.__P.outfits; st.owned = st.owned.filter((x) => !x.startsWith('pip_')); st.owned.push('pip_2'); st.worn.pip = 'pip_2'; window.__outfits.open('pip'); });
  await W(900);
  await shot(p, `${w}_3_wardrobe_locked_pip`);
  await clear();
  // 마을
  await W(1500);
  await shot(p, `${w}_4_village`);
  // 전투 (사냥 숲 3 · 직접)
  await p.evaluate(() => { const P = window.__P; P.hunt.auto = null; P.hunt.best.forest = Math.max(10, P.hunt.best.forest ?? 0); if (!P.guide.unlocked.includes('hunt')) P.guide.unlocked.push('hunt'); for (const a of window.__world.actors) if (a.id) a.hp = 100; });
  try {
    await p.evaluate(() => window.__openHunt('forest'));
    await W(700);
    await p.locator('[data-s="3"]').click({ timeout: 5000 });
    await W(800);
    await shot(p, `${w}_5_hunt_party`);
    await p.locator('#hMan').click({ timeout: 5000 });
    await W(1200);
    await p.keyboard.press('Control');
    await W(1800);
    await shot(p, `${w}_6_battle`);
  } catch (e) {
    console.error('battle skip', String(e).slice(0, 200));
  }
  if (errs.length) console.error('ERR', errs), errsAll.push(...errs);
  await ctx.close();
}
console.error(errsAll.length ? `페이지 에러 ${errsAll.length}` : '페이지 에러 0');
await b.close();
