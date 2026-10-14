// 핫픽스 11 게이트 — 진짜 클릭 (개발용 전역은 상태 읽기 · 시험 준비에만)
//  ① 마을 60초 방치 → 15fps 근처 · 탭 → 바로 30 · 배터리 절약 20/10 (phone만)
//  ② 상태 카드 금화·날짜 겹침 0 (99,999 / 999,999 / 1.2M × 100일차 23시)
//  ③ 「새 버전」 띠가 떠 있어도 소식·밤·메뉴·어울림·소리 버튼이 눌린다
//  ④ 목표: 받을 수 있는 게 맨 위 · 모두 받기 · 받은 건 아래 · 스크롤 안 튐
//  ⑤ 손님 많은 상태에서 여관 Lv.1→2→3 · 10초 관찰 · 건물 발판 위 손님 0 (스크린샷)
// 실행: BOT_BUILD=1 npx vite build --outDir dist-bot && npx vite preview --outDir dist-bot --port 4190 그리고 node scripts/e2e-hotfix11.mjs [se|phone|pc]
import { chromium } from 'playwright-core';
import fs from 'node:fs';
// FIRSTLOOK §5 flSideRail: 접힌 「⋯」 안의 버튼이면 먼저 펼친다 (끄면 아무것도 안 함)
const railExpand = (pg, sel) => pg.evaluate((s) => { const e = document.querySelector(s); const r = document.getElementById('bRail'); if (e && r && getComputedStyle(e).display === 'none' && !document.body.classList.contains('railopen')) r.click(); }, sel);
const name = process.argv[2] ?? 'phone';
const URL = process.argv[3] ?? 'http://localhost:4190/';
const OUT = 'screenshots/hotfix11';
fs.mkdirSync(OUT, { recursive: true });
const save = fs.readFileSync('tests/fixtures/beta_town.json', 'utf8');
const DEV = {
  se: { viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  pc: { viewport: { width: 1280, height: 800 } },
};
const opt = DEV[name];
let fail = 0;
const out = [];
const ok = (c, m) => {
  out.push((c ? '✓ ' : '✗ ') + m);
  if (process.env.LIVE) console.error((c ? '✓ ' : '✗ ') + m);
  if (!c) fail++;
};
const b = await chromium.launch({ channel: 'chrome' });
const ctx = await b.newContext(opt);
await ctx.addInitScript((s) => {
  if (sessionStorage.getItem('x')) return;
  sessionStorage.setItem('x', 1);
  localStorage.clear();
  localStorage.setItem('legacy-of-adventure-save', s);
  localStorage.setItem('legacy-of-adventure-teaserSeen', 'true');
  localStorage.setItem('legacy-of-adventure-lastVersion', '"99"');
  localStorage.setItem('legacy-of-adventure-sound', JSON.stringify({ bgmOn: false, bgmVol: 0.4, sfxOn: false, sfxVol: 0.7, muted: true }));
}, save);
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
p.on('crash', () => console.error('페이지 충돌 (renderer crash)'));
// CONSOLE_ALL
if (process.env.LIVE) p.on('console', (m) => console.error('[콘솔 ' + m.type() + '] ' + m.text().slice(0, 160)));
if (process.env.LIVE) p.on('framenavigated', (fr) => fr === p.mainFrame() && console.error('[이동] ' + fr.url()));
const W = (ms) => p.waitForTimeout(ms);
const vis = (s) => p.evaluate((s) => { const e = document.querySelector(s); return !!e && !e.hidden && e.getClientRects().length > 0; }, s);
const winOn = () => p.evaluate(() => !!document.querySelector('#win')?.classList.contains('on'));
const title = () => p.evaluate(() => (document.querySelector('#win')?.classList.contains('on') ? document.querySelector('#winT').textContent : ''));
const click = async (sel, ms = 600) => {
  try {
    await p.locator(sel).first().click({ timeout: 3000 });
    await W(ms);
    return true;
  } catch {
    return false;
  }
};
const clear = async () => {
  for (let i = 0; i < 30; i++) {
    if (await vis('#dlg')) { await p.locator('#dlg').click().catch(() => {}); await W(250); continue; }
    if (await winOn()) { await p.locator('#winX').click().catch(() => {}); await W(350); continue; }
    return;
  }
};
for (let i = 0; i < 3; i++) {
  await p.goto(URL, { waitUntil: 'networkidle' });
  try {
    await p.waitForFunction(() => !!window.__S && !!document.querySelector('#tCont'), null, { timeout: 15000 });
    break;
  } catch {
    /* 다시 */
  }
}
await W(1500);
await click('#tCont', 3500);
await clear();
// 조용한 마을 (원정 보고서 대화가 섞이지 않게)
await p.evaluate(() => { window.__P.runs.length = 0; window.__P.hunt.auto = null; });
const frames = () => p.evaluate(() => window.__stats.frames);

// ── ① fps (phone만: 60초 넘게 걸린다) ──
if (name === 'phone') {
  await W(62000);
  const f0 = await frames();
  await W(4000);
  const idleFps = ((await frames()) - f0) / 4;
  ok(idleFps >= 13 && idleFps <= 17, `60초 방치 → ${idleFps.toFixed(1)}fps (15 근처)`);
  // 탭 한 번 (빈 땅 · 진짜 클릭) → 그 프레임에 바로 그리고 이후 30
  const tap = await p.evaluate(() => { const r = document.querySelector('#scene').getBoundingClientRect(); return [r.left + r.width * 0.15, r.top + r.height * 0.55]; });
  const fa = await frames();
  await p.mouse.click(tap[0], tap[1]);
  await W(80);
  const fb = await frames();
  ok(fb > fa, '탭하면 다음 프레임에 바로 그림');
  await clear();
  const f1 = await frames();
  await W(3000);
  const wake = ((await frames()) - f1) / 3;
  ok(wake >= 27 && wake <= 33, `탭 뒤 ${wake.toFixed(1)}fps (30)`);
}

// ── ② 상태 카드 겹침 ──
const overlaps = [];
for (const gold of [99999, 999999, 1200000]) {
  // 같은 순간에 값 넣고 · 그리고 · 재고 · 되돌린다 (100일차로 바꾸면 평가단이 오므로 오래 두지 않는다)
  const r = await p.evaluate((g) => {
    const S = window.__S;
    const keep = { gold: S.gold, day: S.day, clock: S.clock };
    S.gold = g;
    S.day = 100;
    S.clock = 17 * 60 + 5;
    document.querySelector('#goldv').textContent = g >= 1e6 ? (g / 1e6).toFixed(g >= 1e7 ? 0 : 1) + 'M' : g.toLocaleString('ko-KR');
    window.__game.syncHud();
    const R = (s) => document.querySelector(s).getBoundingClientRect();
    const a = R('#gold'), d = R('#dayv'), st = R('#starv');
    const hit = (x, y) => x.left < y.right - 0.5 && y.left < x.right - 0.5 && x.top < y.bottom && y.top < x.bottom;
    const dv = document.querySelector('#dayv');
    const res = { gold: document.querySelector('#goldv').textContent, day: dv.textContent, gd: hit(a, d), ds: hit(d, st), over: dv.scrollWidth > dv.clientWidth + 1, w: Math.round(d.width) };
    Object.assign(S, keep);
    window.__game.syncHud();
    return res;
  }, gold);
  if (r.gd || r.ds || r.over) overlaps.push(JSON.stringify(r));
  out.push(`  · 금화 ${r.gold} · 날짜 「${r.day}」 (칸 ${r.w}px)`);
}
ok(!overlaps.length, '금화·날짜·별 겹침 0 ' + overlaps.join(' '));
await p.screenshot({ path: `${OUT}/${name}_hud_gold.png`, clip: { x: 0, y: 0, width: opt.viewport.width, height: 160 } });

// ── ③ 새 버전 띠 + 위쪽 버튼 진짜 클릭 ──
await p.evaluate(() => window.__fakeUpdate({ version: '0.9.9-beta', build: 'fake' }));
await W(2500);
await click('#updLater', 500);
ok(await vis('#updBar'), '「새 버전」 띠 떠 있음');
await p.screenshot({ path: `${OUT}/${name}_updbar.png` });
for (const [sel, nm] of [['#bNotice', '소식'], ['#bDN', '밤'], ['#bMenu', '메뉴'], ['#bHarm', '어울림'], ['#hSpk', '소리']]) {
  await railExpand(p, sel);
  if (!(await vis(sel))) {
    out.push(`  · ${nm}: 이 화면엔 없음`);
    continue;
  }
  let hitOk = true;
  if (process.env.LIVE) console.error('→ ' + nm, await title(), await vis('#dlg'), await vis('#updPop'));
  if (process.env.LIVE) await p.screenshot({ path: OUT + '/dbg_' + nm + '.png' });
  try {
    await p.locator(sel).click({ timeout: 2000 });
  } catch (e) {
    hitOk = false;
    out.push(`  · ${nm} 클릭 실패: ${String(e).split('\n')[0].slice(0, 120)}`);
  }
  ok(hitOk, `띠가 있어도 「${nm}」 눌림`);
  await W(500);
  await clear();
  // 밤·소리는 다시 눌러 원래대로
  if (hitOk && (sel === '#bDN' || sel === '#hSpk')) {
    if (process.env.LIVE) console.error('→ 다시 ' + nm, await title(), await vis('#dlg'));
    await railExpand(p, sel);
    await p.locator(sel).click({ timeout: 2000 }).catch(() => {});
    await W(400);
    await clear();
  }
}

// ── ④ 목표 순서 ──
await p.evaluate(() => {
  const L = window.__P.goals.list;
  L.forEach((g, i) => { g.claimed = false; g.progress = i < 1 ? 0 : g.target; });
  if (L.length) L[L.length - 1].claimed = false;
});
const lastIdx = await p.evaluate(() => window.__P.goals.list.length - 1);
if (process.env.LIVE) await p.screenshot({ path: OUT + '/dbg_goals0.png' });
await click('#bMenu2', 800);
await p.locator('.mtile', { hasText: '오늘의 목표' }).first().click({ timeout: 3000 }).catch(() => {});
await W(800);
if (process.env.LIVE) await p.screenshot({ path: OUT + '/dbg_goals1.png' });
const order = await p.evaluate(() => [...document.querySelectorAll('.goals .goal')].map((e) => (e.classList.contains('got') ? 'got' : e.querySelector('[data-g]:not([disabled])') ? 'ready' : 'prog')));
const rank = { ready: 0, prog: 1, got: 2 };
ok(order.length > 0 && order.every((x, i) => i === 0 || rank[order[i - 1]] <= rank[x]) && order[0] === 'ready', '목표 순서 받기 → 진행 → 받음: ' + order.join(','));
const nReady = order.filter((x) => x === 'ready').length;
if (nReady >= 2) {
  ok(/모두 받기 \(\d+\)/.test(await p.evaluate(() => document.querySelector('#gAll')?.textContent ?? '')), '모두 받기 (N) 보임');
  await p.screenshot({ path: `${OUT}/${name}_goals.png` });
  await click('#gAll', 700);
  const after = await p.evaluate(() => [...document.querySelectorAll('.goals .goal')].map((e) => (e.classList.contains('got') ? 'got' : e.querySelector('[data-g]:not([disabled])') ? 'ready' : 'prog')));
  ok(!after.includes('ready') && after[after.length - 1] === 'got', '모두 받기 뒤 받은 건 아래: ' + after.join(','));
} else out.push(`  · 받을 목표 ${nReady}개 (모두 받기 시험 생략) · 목록 ${lastIdx + 1}개`);
await clear();

// ── ⑤ 여관 Lv.1→2→3 ──
await p.evaluate(() => { for (let i = 0; i < 8; i++) window.__arrive(i % 2 ? 'passer' : 'visitor'); window.__S.gold = 99999; });
await W(3000);
const tapInn = async () => {
  const pts = await p.evaluate(() => {
    const o = window.__world.objs.find((x) => x.kind === 'inn');
    const v = window.__view, cv = document.querySelector('canvas'), r = cv.getBoundingClientRect();
    const at = (x, y) => [r.left + (((x - y) * 32) / 2 + v.OX) * v.SC, r.top + (((x + y) * 16) / 2 + v.OY) * v.SC];
    const c = [o.tx + o.fw / 2, o.ty + o.fh / 2];
    return [[0, 0], [0, -0.6], [-0.4, -0.4], [0.3, -0.9], [0.4, 0.2]].map(([dx, dy]) => at(c[0] + dx, c[1] + dy));
  });
  for (const [x, y] of pts) {
    await p.mouse.click(x, y);
    await W(700);
    if ((await title()).startsWith('여관 본관')) return true;
    await clear();
  }
  return false;
};
const onRoof = () =>
  p.evaluate(() => {
    const blocked = (x, y) => window.__world.objs.some((o) => !['training', 'garden', 'gate'].includes(o.kind) && x >= o.tx && x < o.tx + o.fw && y >= o.ty && y < o.ty + o.fh);
    return window.__world.actors.filter((a) => !a.hidden && !a.door && !a.party && blocked(Math.round(a.x), Math.round(a.y))).map((a) => `${a.name}@${a.x.toFixed(1)},${a.y.toFixed(1)}`);
  });
const startLvl = await p.evaluate(() => window.__world.objs.find((x) => x.kind === 'inn').lvl);
for (let lv = startLvl; lv < 3; lv++) {
  const opened = await tapInn();
  ok(opened, `여관 창 열림 (Lv.${lv})`);
  if (!opened) break;
  const up = await click('#upB', 600);
  ok(up && (await p.evaluate(() => window.__world.objs.find((x) => x.kind === 'inn').lvl)) === lv + 1, `레벨업 Lv.${lv} → ${lv + 1}`);
  await clear();
  let worst = [];
  for (let t = 0; t < 10; t++) {
    const r = await onRoof();
    if (r.length > worst.length) worst = r;
    await W(1000);
  }
  ok(worst.length === 0, `Lv.${lv + 1} 10초 관찰: 건물 발판 위 손님 0 ${worst.join(' ')}`);
  await p.screenshot({ path: `${OUT}/${name}_inn_lv${lv + 1}.png` });
}
ok(errs.length === 0, '페이지 에러 0 ' + errs.join(' | '));
console.log(JSON.stringify({ [name]: out }, null, 1));
console.log(fail ? `✗ ${fail}개 실패` : '✓ 모두 통과');
await b.close();
process.exit(fail ? 1 : 0);
