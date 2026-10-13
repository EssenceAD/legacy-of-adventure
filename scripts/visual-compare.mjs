// VISUAL §1: 비교 이미지 — 새 화면(paletteV2 · calmWorld) 끔/켬을 나란히 → reports/visual/*.png
//  장면: 미리보기(오프닝 티저) · 실제 저장 3개(따밤·웅스·이카몰리) 마을 · 전투 · 손님 창
//  켬 = 실험실 토글(localStorage visualLab) — 플래그(flags.json)는 그대로 꺼진 채
//  실행: URL=http://localhost:4190/ node scripts/visual-compare.mjs [저장 폴더(save_01 따밤 · save_02 웅스 · save_03 이카몰리)]
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
const URL = process.env.URL ?? 'http://localhost:4190/';
const dir = process.argv[2] ?? 'C:/Users/choly/AppData/Local/Temp/claude/C--Users-choly/aeed0df9-0ecc-49a1-923e-e1b70684cfba/scratchpad/gs3';
const OUT = 'reports/visual';
fs.mkdirSync(OUT, { recursive: true });
const SAVES = [['ttabam', '따밤', 'save_01.json'], ['woongs', '웅스', 'save_02.json'], ['ikamolly', '이카몰리', 'save_03.json']]
  .map(([id, who, f]) => [id, who, path.join(dir, f)])
  .filter(([, , f]) => fs.existsSync(f));
const DEV = { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36' };
const b = await chromium.launch({ channel: 'chrome' });
// 패치 노트 카드가 안 뜨게 지금 버전을 「본 것」으로
const VER = await (async () => { const c = await b.newContext(); const v = (await (await c.request.get(URL + 'version.json')).json()).version; await c.close(); return JSON.stringify(v); })();
const errs = [];

/** 한 번 띄우기: lab 켬/끔 · save(없으면 티저) → 장면별 png 버퍼 */
async function shoot(lab, save, night = false) {
  const ctx = await b.newContext(DEV);
  await ctx.addInitScript(([s, on, ver]) => {
    try { if (sessionStorage.getItem('x')) return; sessionStorage.setItem('x', 1); } catch { return; }
    localStorage.clear();
    if (s) {
      localStorage.setItem('legacy-of-adventure-save', s);
      localStorage.setItem('legacy-of-adventure-teaserSeen', 'true');
    }
    localStorage.setItem('legacy-of-adventure-lastVersion', ver);
    localStorage.setItem('legacy-of-adventure-settleOff', 'true');
    localStorage.setItem('legacy-of-adventure-telemetry', 'false');
    localStorage.setItem('legacy-of-adventure-sound', JSON.stringify({ bgmOn: false, bgmVol: 0.4, sfxOn: false, sfxVol: 0.7, muted: true }));
    if (on) localStorage.setItem('legacy-of-adventure-visualLab', 'true');
  }, [save, lab, VER]);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(`${lab ? '켬' : '끔'}: ${String(e).slice(0, 160)}`));
  const W = (ms) => p.waitForTimeout(ms);
  const shots = {};
  await p.goto(URL, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => !!window.__S, null, { timeout: 30000 });
  if (!save) {
    // 오프닝 티저: 「터치해서 시작」 → 마을 장면 두 컷
    await W(2500);
    await p.mouse.click(206, 450);
    await W(7000);
    shots.preview = await p.screenshot();
    await W(8000);
    shots.preview2 = await p.screenshot();
    await ctx.close();
    return shots;
  }
  await p.waitForFunction(() => !!document.querySelector('#tCont'), null, { timeout: 30000 });
  await p.locator('#tCont').click();
  await p.waitForFunction(() => window.__S.started && !document.querySelector('#hud').hidden, null, { timeout: 20000 });
  const clear = () => p.evaluate(async () => {
    const T = (ms) => new Promise((r) => setTimeout(r, ms));
    for (let i = 0, calm = 0; i < 60 && calm < 3; i++) {
      let busy = false;
      if (!document.querySelector('#dlg').hidden) { document.querySelector('#dlg').click(); busy = true; }
      else if (document.querySelector('#win').classList.contains('on')) { document.querySelector('#winX').click(); busy = true; }
      calm = busy ? 0 : calm + 1;
      await T(busy ? 120 : 250);
    }
  });
  await clear();
  await W(1200);
  await clear();
  // 마을: 여관을 가운데로 (낮 12시 · 밤 23시는 저장 시각을 바꿔서)
  await p.evaluate(() => { const o = window.__world.objs.find((x) => x.kind === 'inn'); if (o) window.__game.focusTile(o.tx + o.fw / 2, o.ty + o.fh / 2); });
  await W(1500);
  shots.town = await p.screenshot();
  if (night) return await ctx.close(), shots;
  // 손님 창 (단골 먼저)
  await p.evaluate(() => { const a = window.__world.actors.find((x) => x.id && !x.hidden) ?? window.__world.actors.find((x) => !x.hidden); if (a) window.__showActor(a); });
  await W(900);
  shots.guest = await p.screenshot();
  await clear();
  // 전투: 숲 1-10 직접 전투
  try {
    await p.evaluate(() => { const P = window.__P; P.runs.length = 0; P.hunt.auto = null; if (!P.guide.unlocked.includes('hunt')) P.guide.unlocked.push('hunt'); for (const a of window.__world.actors) if (a.id) a.hp = 100; window.__openHunt('forest'); });
    await W(600);
    await p.locator('[data-s="10"]').click({ timeout: 5000 });
    await W(700);
    await p.locator('#hMan').click({ timeout: 5000 });
    await W(3000);
    shots.combat = await p.screenshot();
  } catch (e) {
    errs.push(`전투 장면 못 찍음: ${String(e).slice(0, 120)}`);
  }
  await ctx.close();
  return shots;
}

/** 끔/켬 나란히 한 장 */
async function pair(name, title, off, on) {
  if (!off || !on) return;
  const pg = await b.newPage({ viewport: { width: 1700, height: 1900 }, deviceScaleFactor: 1 });
  const im = (buf) => `data:image/png;base64,${buf.toString('base64')}`;
  await pg.setContent(`<body style="margin:0;background:#1b1622;font:600 28px sans-serif;color:#f3e7c9">
    <div style="padding:14px 20px">${title}</div>
    <div style="display:flex;gap:20px;padding:0 20px 20px">
      <figure style="margin:0"><figcaption style="padding:6px 0">끔 (지금)</figcaption><img src="${im(off)}" style="width:824px;display:block"></figure>
      <figure style="margin:0"><figcaption style="padding:6px 0;color:#ffd36b">켬 (새 화면: 팔레트 + 조용한 숲)</figcaption><img src="${im(on)}" style="width:824px;display:block"></figure>
    </div></body>`);
  await pg.waitForTimeout(200);
  const file = `${OUT}/${name}.png`;
  await pg.screenshot({ path: file, fullPage: true });
  await pg.close();
  console.error('✓ ' + file);
}

const t0 = Date.now();
const [pOff, pOn] = [await shoot(false, null), await shoot(true, null)];
await pair('preview', '미리보기 (오프닝 7초)', pOff.preview, pOn.preview);
await pair('preview2', '미리보기 (오프닝 15초)', pOff.preview2, pOn.preview2);
for (const [id, who, f] of process.env.ONLY_PREVIEW ? [] : SAVES) {
  const sv = JSON.parse(fs.readFileSync(f, 'utf8'));
  const day = JSON.stringify({ ...sv, clock: 6 * 60, night: false });
  const nite = JSON.stringify({ ...sv, clock: 17 * 60, night: true });
  const off = await shoot(false, day);
  const on = await shoot(true, day);
  await pair(`town_${id}`, `${who} 마을 · 낮`, off.town, on.town);
  const [nOff, nOn] = [await shoot(false, nite, true), await shoot(true, nite, true)];
  await pair(`night_${id}`, `${who} 마을 · 밤`, nOff.town, nOn.town);
  await pair(`combat_${id}`, `${who} · 전투 (숲 1-10)`, off.combat, on.combat);
  await pair(`guest_${id}`, `${who} · 손님 창`, off.guest, on.guest);
}
await b.close();
console.error(errs.length ? '✗ 오류:\n' + errs.join('\n') : `✓ 오류 0 · ${((Date.now() - t0) / 1000).toFixed(0)}s`);
process.exit(errs.some((e) => !e.startsWith('전투')) ? 1 : 0);
