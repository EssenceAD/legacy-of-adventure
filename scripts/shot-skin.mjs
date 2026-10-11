// UI_SKIN_SPEC §5: 창 재질 스크린샷 + 글씨 대비 자동 검사 (양피지·의뢰서 위 글자 ≥ 4.5:1)
//  장부 · 편지(우편함) · 원정 게시판 · 건설 · 여관 창 · 가방 · 사냥터 · 토벌 결과 · 메뉴 · 도감 · 패치노트
//  실행: dist-bot 미리보기 4190 · node scripts/shot-skin.mjs [se|pc] [배율 dpr] → screenshots/ui_skin/<기기>_<창>.png
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const name = process.argv[2] ?? 'se';
const dpr = +(process.argv[3] ?? 2);
const save = fs.readFileSync('tests/fixtures/beta_town.json', 'utf8');
const DEV = { se: { viewport: { width: 375, height: 667 }, deviceScaleFactor: dpr, isMobile: true, hasTouch: true }, pc: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: dpr } };
const b = await chromium.launch({ channel: 'chrome' });
const ctx = await b.newContext(DEV[name]);
await ctx.addInitScript((s) => {
  window.__conScale = 1;
  try { if (sessionStorage.getItem('x')) return; sessionStorage.setItem('x', 1); } catch { return; }
  localStorage.clear();
  localStorage.setItem('legacy-of-adventure-save', s);
  localStorage.setItem('legacy-of-adventure-teaserSeen', 'true');
  localStorage.setItem('legacy-of-adventure-lastVersion', '"99"');
  localStorage.setItem('legacy-of-adventure-sound', JSON.stringify({ bgmOn: false, bgmVol: 0.4, sfxOn: false, sfxVol: 0.7, muted: true }));
}, save);
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
p.on('dialog', (d) => d.accept());
const W = (ms) => p.waitForTimeout(ms);
const dir = 'screenshots/ui_skin';
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
/** 양피지·의뢰서 위 글자 대비 (배경을 못 찾으면 판의 평균색) */
const contrast = () => p.evaluate(() => {
  const PANEL = { 'skin-parchment': [231, 209, 159], 'skin-cork': [196, 145, 87] };
  const win = document.querySelector('#win');
  const skin = [...win.classList].find((c) => c in PANEL);
  if (!skin) return null;
  const lum = ([r, g, b]) => [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
  const rgb = (c) => { const m = c.match(/[\d.]+/g); return m ? [+m[0], +m[1], +m[2], m[3] == null ? 1 : +m[3]] : null; };
  const bad = [];
  let n = 0;
  for (const el of document.querySelectorAll('#winB *')) {
    if (el.closest('button') || el.closest('.ic') || !el.offsetParent) continue;
    const text = [...el.childNodes].filter((x) => x.nodeType === 3 && x.textContent.trim()).map((x) => x.textContent.trim()).join(' ');
    if (!text) continue;
    // 배경: 불투명한 조상 색, 의뢰서 카드면 종이색, 없으면 판
    let bg = null;
    for (let a = el; a && a !== win; a = a.parentElement) {
      if (skin === 'skin-cork' && a.classList.contains('quest')) { bg = [237, 227, 203]; break; }
      // 남색 9-slice 판(border-image)은 어두운 바탕으로 본다
      const bi = getComputedStyle(a).borderImageSource;
      if (bi && bi !== 'none' && !/parchment|note_card|bookmark|btn_|cork/.test(bi)) { bg = [20, 26, 58]; break; }
      const c = rgb(getComputedStyle(a).backgroundColor);
      if (c && c[3] > 0.6) { bg = c; break; }
    }
    bg ??= PANEL[skin];
    const fg = rgb(getComputedStyle(el).color);
    const L1 = lum(fg), L2 = lum(bg);
    const r = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    n++;
    if (r < 4.5) bad.push(`${text.slice(0, 14)}(${r.toFixed(1)} ${getComputedStyle(el).color})`);
  }
  return { n, bad: [...new Set(bad)].slice(0, 6), nBad: bad.length };
});
const shot = async (key) => {
  await W(500);
  await p.screenshot({ path: `${dir}/${name}_${key}.png` });
  const cls = await p.evaluate(() => document.querySelector('#win').className);
  const c = await contrast();
  ok(true, `${key}: ${cls.replace(/win px on ?/, '') || '남색'}`);
  if (c) ok(c.nBad === 0, `  글씨 대비 ${c.n}개 중 4.5 미만 ${c.nBad}${c.bad.length ? ' — ' + c.bad.join(', ') : ''}`);
};
const menuTile = async (label) => {
  await clear();
  await p.locator('#bMenu2').click();
  await W(700);
  await p.locator('.mtile', { hasText: label }).first().click();
  await W(800);
};
await p.goto(process.env.URL ?? 'http://localhost:4190/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__S, null, { timeout: 20000 });
await W(1500);
await p.locator('#tCont').click();
await W(3500);
await clear();
await W(1500);
await clear();
await menuTile('수입 장부');
await shot('ledger');
await menuTile('우편함');
await shot('mail');
await menuTile('도감');
await p.locator('#dT .tab[data-t="2"]').click().catch(() => {});
await shot('dex_chem');
await menuTile('공지');
await shot('notice');
await menuTile('업적');
await shot('achieve');
await clear();
await p.locator('#bExp').click();
await shot('board');
await clear();
await p.locator('#bBuild').click();
await shot('build');
await clear();
await p.evaluate(() => window.__showObj(window.__world.objs.find((o) => o.kind === 'inn')));
await shot('inn');
await clear();
await p.locator('#bGuest').click();
await W(600);
await shot('guests');
await p.locator('#gBag').click();
await shot('bag');
await clear();
await p.evaluate(() => window.__openHunt());
await shot('hunt');
await menuTile('설정');
await shot('settings');
await clear();
await p.locator('#bMenu2').click();
await shot('menu');
// 토벌 결과 (✕ → 포기)
await clear();
await p.evaluate(() => { const P = window.__P; if (!P.guide.unlocked.includes('raid')) P.guide.unlocked.push('raid'); P.runs.length = 0; P.hunt.auto = null; for (const a of window.__world.actors) if (a.id) a.hp = 100; });
await p.locator('#bExp').click();
await W(800);
if (await p.locator('#rWeek').count()) {
  await p.locator('#rWeek').click();
  await W(800);
  await shot('raid_prep');
  await p.locator('#rgMan').click();
  await W(3000);
  await p.locator('#cbQuit').click();
  await W(300);
  await p.locator('#cbGiveUp').click();
  await W(3000);
  for (let i = 0; i < 4 && /업데이트/.test(await p.locator('#winT').textContent()); i++) { await p.locator('#winX').click(); await W(400); }
  await shot('raid_result');
}
ok(errs.length === 0, '페이지 에러 0 ' + errs.join(' | '));
console.log(JSON.stringify({ [name]: out }, null, 1));
console.log(fail ? `✗ ${fail}개 실패` : '✓ 모두 통과');
await b.close();
process.exit(fail ? 1 : 0);
