// LUXE §2 펫 시트 → reports/luxe/pets/ — BOT_BUILD=1 빌드를 4313에 띄우고 SAVE=<실세이브> node scripts/shot-pets.mjs (실세이브는 저장소 밖 · 기본 tests/fixtures/real_woongs.json)
//  만남(?! + 하트) · 카드 · 마을 낮/밤 3마리 · 자는 모습 · 펫 메뉴 · 도감(일부·전부) · 이웃(예시 마을 「달무리 온천」) — 360 · 1280 · 실험실 켬(+ 비교용 끔 1장)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const raw = fs.readFileSync(process.env.SAVE ?? 'tests/fixtures/real_woongs.json', 'utf8');
const dir = 'reports/luxe/pets';
fs.mkdirSync(dir, { recursive: true });
const URL = process.env.URL ?? 'http://localhost:4313/';
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
  await calm(p, W);
  return { p, ctx, W, errs };
}
/** 대화·창을 닫아 조용하게 */
async function calm(p, W) {
  for (let i = 0, c = 0; i < 80 && c < 3; i++) {
    const busy = await p.evaluate(() => { if (!document.querySelector('#dlg').hidden) return document.querySelector('#dlg').click(), true; if (document.querySelector('#win').classList.contains('on')) return document.querySelector('#winX').click(), true; return false; });
    c = busy ? 0 : c + 1;
    await W(busy ? 200 : 500);
  }
}
const shot = async (p, name, clip) => { const f = `${dir}/${name}.png`; await p.screenshot({ path: f, ...(clip ? { clip } : {}) }); out.push(f); console.error('✓', f); };
/** 여관 문 쪽으로 화면을 맞추고 펫 세 마리 주변 잘라 보기 */
async function focusInn(p) {
  await p.evaluate(() => { const inn = (window.__world.home?.objs ?? window.__world.objs).find((o) => o.kind === 'inn'); if (inn) window.__game.focusTile(inn.tx + inn.fw / 2, inn.ty + inn.fh + 1); });
}
async function petClip(p, w) {
  const xs = await p.evaluate(() => window.__pets.rt().map((r) => window.__pets.xy(r.id)).filter(Boolean));
  if (!xs.length) return undefined;
  const cx = xs.reduce((s, v) => s + v[0], 0) / xs.length;
  const cy = xs.reduce((s, v) => s + v[1], 0) / xs.length;
  const cw = w < 800 ? 300 : 420;
  const ch = w < 800 ? 220 : 280;
  const vw = w;
  const vh = w < 800 ? 780 : 820;
  return { x: Math.max(0, Math.min(vw - cw, cx - cw / 2)), y: Math.max(0, Math.min(vh - ch, cy - ch / 2)), width: cw, height: ch };
}
/** 붐비는 마을에선 건물 뒤에 숨기 쉬워서, 줌 시트는 마을 입구 길(트인 곳)에 잠깐 세워 둔다 (몇 초 뒤 다시 돌아다님) */
async function placePets(p) {
  await p.evaluate(() => { const [ex, ey] = window.__ent(); window.__pets.rt().forEach((r, i) => { r.x = ex + i * 2; r.y = ey - 2 + (i % 2); r.path = []; r.wait = 30; }); });
}
/** 가장 크게 확대하고 펫 가운데로 (줌 시트용) */
async function zoomPets(p, W) {
  await calm(p, W);
  const seen = [];
  for (let i = 0; i < 6; i++) {
    seen.push(await p.evaluate(() => window.__S.zoom));
    await p.click('#bZoom').catch(() => {});
    await W(150);
  }
  const max = Math.max(...seen);
  for (let i = 0; i < 6 && (await p.evaluate(() => window.__S.zoom)) !== max; i++) {
    await p.click('#bZoom').catch(() => {});
    await W(150);
  }
  await p.evaluate(() => { const r = window.__pets.rt(); if (!r.length) return; window.__game.focusTile(r.reduce((s, v) => s + v.x, 0) / r.length, r.reduce((s, v) => s + v.y, 0) / r.length); });
  await W(400);
}
async function unzoom(p, W, z) {
  for (let i = 0; i < 6 && (await p.evaluate(() => window.__S.zoom)) !== z; i++) {
    await p.click('#bZoom').catch(() => {});
    await W(150);
  }
}
const setClock = async (p, h) => p.evaluate((h) => (window.__S.clock = (h - 6) * 60), h);

for (const w of [360, 1280]) {
  // 전: 실험실 끔 — 도감 탭에 「동물 친구」 없음
  {
    const { p, ctx, W, errs } = await session(w, false);
    await p.evaluate(() => window.__openDex(0));
    await W(600);
    await shot(p, `${w}_0_before_dex`);
    if (errs.length) console.error('ERR', errs);
    await ctx.close();
  }
  const { p, ctx, W, errs } = await session(w, true);
  await setClock(p, 12);
  await focusInn(p);
  await W(500);
  // 1) 만남: 반짝 + ?! + 하트 → 카드
  await p.evaluate(() => window.__pets.grant('otter', 'fish'));
  await W(350);
  await shot(p, `${w}_1_get_fanfare`);
  // 다른 이야기 창이 먼저 뜨면 넘기며 카드를 기다린다
  for (let i = 0; i < 80 && !(await p.evaluate(() => !!document.getElementById('pcGo'))); i++) {
    await p.evaluate(() => { if (!document.querySelector('#dlg').hidden) document.querySelector('#dlg').click(); else if (document.querySelector('#win').classList.contains('on') && !document.getElementById('pcGo')) document.querySelector('#winX').click(); });
    await W(300);
  }
  await W(400);
  await shot(p, `${w}_2_get_card`);
  await p.fill('#pcName', '퐁당이');
  await p.click('#pcGo');
  await W(600);
  // 두 마리 더 (카드는 닫기)
  await p.evaluate(() => { window.__pets.grant('slime', 'brew'); window.__pets.grant('puppy', 'bundle'); window.__pets.state().card.length = 0; });
  await W(2500);
  await calm(p, W);
  await focusInn(p);
  await W(4000);
  await shot(p, `${w}_3_village_day`);
  const z0 = await p.evaluate(() => window.__S.zoom);
  await placePets(p);
  await zoomPets(p, W);
  await shot(p, `${w}_3b_village_day_zoom`);
  // 2) 펫 메뉴 (쓰다듬기 · 이름 바꾸기 · 펫 집으로)
  const xy = await p.evaluate(() => window.__pets.xy('otter'));
  if (xy) {
    await p.mouse.click(xy[0], xy[1]);
    await W(500);
    const has = await p.evaluate(() => !!document.getElementById('petmenu'));
    console.error('menu', has);
    if (!has) await p.evaluate(([x, y]) => window.__pets.menu('otter', x, y), xy);
    await W(300);
    await shot(p, `${w}_4_pet_menu`);
    await p.click('#ptPat').catch(() => {});
    await W(500);
    await shot(p, `${w}_4b_pet_patted`);
  }
  await unzoom(p, W, z0);
  // 3) 밤: 자는 모습 (Zz · 1px 낮게)
  await setClock(p, 23);
  await p.waitForFunction(() => window.__S.night, null, { timeout: 20000 }).catch(() => {});
  await W(3500);
  await calm(p, W);
  await focusInn(p);
  await W(800);
  await shot(p, `${w}_5_village_night`);
  await placePets(p);
  await zoomPets(p, W);
  await shot(p, `${w}_5b_sleeping_zoom`);
  await unzoom(p, W, z0);
  // 4) 도감 — 일부 (3/10)
  await p.evaluate(() => window.__openDex(0));
  await W(300);
  await p.evaluate(() => [...document.querySelectorAll('#dT .tab')].find((t) => t.textContent.includes('동물 친구'))?.click());
  await W(900);
  await shot(p, `${w}_6_dex_partial`);
  // 전부 (10/10 — 별여우는 그림 자리표시)
  await p.evaluate(() => { for (const id of ['raccoon', 'mole', 'salamander', 'griffin', 'tengu', 'starcat', 'starfox']) window.__pets.grant(id, 'bundle'); const st = window.__pets.state(); st.card.length = 0; });
  await W(2200);
  await calm(p, W);
  await p.evaluate(() => window.__openDex(0));
  await W(300);
  await p.evaluate(() => [...document.querySelectorAll('#dT .tab')].find((t) => t.textContent.includes('동물 친구'))?.click());
  await W(900);
  await shot(p, `${w}_7_dex_full`);
  await p.evaluate(() => (document.querySelector('#win .wbody, #win .body, #winB') ?? document.querySelector('#win')).scrollBy?.(0, 600));
  await W(300);
  await shot(p, `${w}_7b_dex_full_scroll`);
  await calm(p, W);
  // 5) 이웃 방문: 예시 마을 「달무리 온천」(펫 3 · 낮)
  await setClock(p, 12);
  await p.evaluate(() => { const v = window.__neighbors?.find?.((n) => n.id === 'spa'); if (v) window.__game.visit(v); });
  await W(2500);
  const vis = await p.evaluate(() => window.__S.visiting?.id ?? null);
  console.error('visiting', vis, await p.evaluate(() => window.__pets.rt().map((r) => r.id)));
  await calm(p, W);
  await focusInn(p);
  await W(2500);
  await shot(p, `${w}_8_neighbor`);
  await zoomPets(p, W);
  await shot(p, `${w}_8b_neighbor_zoom`);
  if (errs.length) console.error('ERR', errs);
  await ctx.close();
}
await b.close();
console.log(JSON.stringify(out));
