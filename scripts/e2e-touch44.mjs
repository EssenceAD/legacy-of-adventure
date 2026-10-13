// 손가락 자리 44px 검사 (VISUAL §4·§5 · hudV2/uiKitV2 켜기 전 조건)
//  실제 저장(읽기만)을 불러와 마을 화면 + 주요 창(메뉴 격자 · 손님 · 건설 · 사냥 · 원정 게시판 · 대장간 · 설정 · 모험 · 소식)을 열고,
//  보이는 누를 수 있는 것(button · [role=button] · a · input · select · label.tog · .tab · cursor:pointer 줄) 중
//  누름 상자가 가로나 세로 44px 미만인 것을 모두 적는다.
//  누름 상자 = 요소 상자 ∪ 위치 잡힌 ::before/::after 덮개(position:absolute · pointer-events 켜짐) — 「그림은 작게, 누르는 자리는 크게」를 인정.
//  label 안의 input(체크박스)은 label 이 누름 자리라 따로 세지 않는다. 누를 수 있는 것 안의 자식도 세지 않는다.
//  폭 412×915(폰) · 1280×800(PC) × 실험실 끔/켬. 실험실 켬에서 1건이라도 있으면 실패(끔은 보고만).
//  실행: URL=http://localhost:4341/ node scripts/e2e-touch44.mjs [저장 파일(기본: gs3/save_02 웅스)]   → reports/touch44/*.json
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const t0 = Date.now();
const URL = process.env.URL ?? 'http://localhost:4341/';
const file = process.argv[2] ?? 'C:/Users/choly/AppData/Local/Temp/claude/C--Users-choly/aeed0df9-0ecc-49a1-923e-e1b70684cfba/scratchpad/gs3/save_02.json';
const MIN = 44;
const OUT = 'reports/touch44';
fs.mkdirSync(OUT, { recursive: true });
const AND = 'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36';
const DEVS = {
  412: { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true, userAgent: AND },
  1280: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
};
const raw = fs.readFileSync(file, 'utf8');
const b = await chromium.launch({ channel: 'chrome' });
const VER = await (async () => { const c = await b.newContext(); const v = (await (await c.request.get(URL + 'version.json')).json()).version; await c.close(); return JSON.stringify(v); })();

async function run(w, lab) {
  const ctx = await b.newContext(DEVS[w]);
  await ctx.addInitScript(([save, on, ver]) => {
    try { if (sessionStorage.getItem('x')) return; sessionStorage.setItem('x', 1); } catch { return; }
    localStorage.clear();
    localStorage.setItem('legacy-of-adventure-save', save);
    localStorage.setItem('legacy-of-adventure-teaserSeen', 'true');
    localStorage.setItem('legacy-of-adventure-lastVersion', ver);
    localStorage.setItem('legacy-of-adventure-settleOff', 'true');
    localStorage.setItem('legacy-of-adventure-telemetry', 'false');
    localStorage.setItem('legacy-of-adventure-sound', JSON.stringify({ bgmOn: false, bgmVol: 0.4, sfxOn: false, sfxVol: 0.7, muted: true }));
    if (on) localStorage.setItem('legacy-of-adventure-visualLab', 'true');
  }, [raw, lab, VER]);
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await p.goto(URL, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => !!window.__S && !!document.querySelector('#tCont'), null, { timeout: 30000 });
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
    document.querySelectorAll('.pmenu').forEach((e) => e.remove());
  });
  await clear();
  await p.waitForTimeout(1200);
  await clear();
  await p.waitForTimeout(700);

  const measure = (scene) => p.evaluate(([scene, MIN]) => {
    const SEL = 'button,[role=button],a,input:not([type=hidden]),select,textarea,label.tog,.tab';
    const isI = (e) => e.matches(SEL) || (getComputedStyle(e).cursor === 'pointer' && (!e.parentElement || getComputedStyle(e.parentElement).cursor !== 'pointer'));
    const shown = (e) => {
      if (e.closest('[hidden]')) return false;
      if (!e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false;
      const cs = getComputedStyle(e);
      if (cs.pointerEvents === 'none') return false;
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    const hitBox = (e) => {
      const r = e.getBoundingClientRect();
      let L = r.left, T = r.top, R = r.right, B = r.bottom;
      const cs = getComputedStyle(e);
      // 덮개는 요소가 위치를 잡고 넘침을 자르지 않을 때만 (잘린 덮개는 눌리지 않는다)
      if (cs.position !== 'static' && cs.overflowX === 'visible' && cs.overflowY === 'visible') {
        for (const ps of ['::before', '::after']) {
          const q = getComputedStyle(e, ps);
          if (q.content === 'none' || q.content === 'normal' || q.position !== 'absolute' || q.pointerEvents === 'none' || q.display === 'none') continue;
          const n = (v) => parseFloat(v) || 0;
          const x = r.left + n(cs.borderLeftWidth) + n(q.left), y = r.top + n(cs.borderTopWidth) + n(q.top);
          const pw = n(q.width) + n(q.paddingLeft) + n(q.paddingRight) + n(q.borderLeftWidth) + n(q.borderRightWidth);
          const ph = n(q.height) + n(q.paddingTop) + n(q.paddingBottom) + n(q.borderTopWidth) + n(q.borderBottomWidth);
          L = Math.min(L, x); T = Math.min(T, y); R = Math.max(R, x + pw); B = Math.max(B, y + ph);
        }
      }
      return { w: R - L, h: B - T };
    };
    const out = [];
    for (const e of document.querySelectorAll('body *')) {
      if (e.tagName === 'CANVAS' || e.id === 'view' || e.id === 'win' || e.id === 'winB' || e.id === 'dlg') continue;
      if (!isI(e) || !shown(e)) continue;
      // 누를 수 있는 것 안의 자식 · label 안 input 은 바깥이 누름 자리
      if (e.parentElement?.closest(SEL)) continue;
      if (e.matches('input') && e.closest('label')) continue;
      // 화면 전체 막(오버레이)은 제외
      const r = e.getBoundingClientRect();
      if (r.width * r.height > innerWidth * innerHeight * 0.5) continue;
      const hb = hitBox(e);
      if (hb.w >= MIN - 0.5 && hb.h >= MIN - 0.5) continue;
      const d = e.id ? '#' + e.id : e.tagName.toLowerCase() + (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/).join('.') : '');
      const t = (e.textContent || e.getAttribute('aria-label') || e.getAttribute('title') || '').replace(/\s+/g, ' ').trim().slice(0, 18);
      out.push({ scene, sel: d, text: t, w: Math.round(hb.w), h: Math.round(hb.h) });
    }
    return out;
  }, [scene, MIN]);

  const all = [];
  all.push(...(await measure('마을')));
  const scenes = [
    ['메뉴', () => window.__openMenu()],
    ['손님', () => document.querySelector('#bGuest').click()],
    ['건설', () => document.querySelector('#bBuild').click()],
    ['사냥', () => window.__openHunt()],
    ['원정 게시판', () => { const o = window.__world.objs.find((x) => x.kind === 'board' && !x.building); if (o) window.__showObj(o); }],
    ['대장간', () => { const o = window.__world.objs.find((x) => x.kind === 'smith' && !x.building); if (o) window.__showObj(o); }],
    ['설정', () => { window.__openMenu(); [...document.querySelectorAll('[data-m]')].find((e) => e.querySelector('span')?.textContent === '설정')?.click(); }],
    ['소식', () => (document.querySelector('#bNews') ?? document.querySelector('#bNotice')).click()],
    ['모험', () => document.querySelector('#bAdv')?.click()],
  ];
  const skipped = [];
  for (const [name, fn] of scenes) {
    await clear();
    if (name === '모험' && !lab) continue;
    await p.evaluate(`(${fn.toString()})()`).catch((e) => skipped.push(`${name}: ${String(e).slice(0, 80)}`));
    await p.waitForTimeout(450);
    for (let i = 0; i < 20 && (await p.evaluate(() => !document.querySelector('#dlg').hidden)); i++) { await p.evaluate(() => document.querySelector('#dlg').click()); await p.waitForTimeout(60); }
    if (!(await p.evaluate(() => document.querySelector('#win').classList.contains('on')))) { skipped.push(`${name}: 창 안 열림`); continue; }
    await p.waitForTimeout(150);
    all.push(...(await measure(name)));
  }
  await ctx.close();
  // 같은 요소가 여러 장면에 나오면 한 번만 (HUD 버튼 등)
  const seen = new Set();
  const items = all.filter((x) => { const k = `${x.sel}|${x.text}|${x.w}x${x.h}`; if (seen.has(k)) return false; seen.add(k); return true; });
  return { w, lab, items, skipped, errs };
}

const res = [];
for (const lab of [false, true]) for (const w of [412, 1280]) res.push(await run(w, lab));
await b.close();
let bad = 0;
for (const r of res) {
  const tag = `${r.lab ? '실험실 켬' : '실험실 끔'} · ${r.w}`;
  fs.writeFileSync(`${OUT}/${r.lab ? 'lab' : 'off'}_${r.w}.json`, JSON.stringify(r, null, 1));
  console.error(`${r.lab ? '✗' : '·'} ${tag}: 44px 미만 ${r.items.length}개${r.skipped.length ? ` (건너뜀 ${r.skipped.join(' / ')})` : ''}${r.errs.length ? ` · 페이지 오류 ${r.errs.join(' | ')}` : ''}`.replace(/^✗(.*) 0개/, '✓$1 0개'));
  if (r.lab || process.env.ALL) for (const x of r.items) console.error(`    ${x.scene} ${x.sel} 「${x.text}」 ${x.w}×${x.h}`);
  if (r.lab) bad += r.items.length;
  bad += r.errs.length;
}
console.error(`${bad ? '✗' : '✓'} 끝 (${((Date.now() - t0) / 1000).toFixed(0)}s) → ${OUT}/`);
process.exit(bad ? 1 : 0);
