// CONSTRUCTION_SPEC: 업그레이드 → 건물 톡톡 10번 → 남은 시간 줄어듦 → (시간 당겨서) 완성 · 건물 창 공사 칸 · 모모의 응원 · 옮기기 막힘
//  + 스크린샷 shots/con_<기기>_<진행%>.png (0·50·90%, 낮·밤). 실행: dist-bot 미리보기 4190 · node scripts/e2e-construction.mjs [se|pc]
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const name = process.argv[2] ?? 'se';
const save = fs.readFileSync('tests/fixtures/beta_town.json', 'utf8');
const DEV = { se: { viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, pc: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 } };
const opt = DEV[name];
const b = await chromium.launch({ channel: 'chrome' });
const ctx = await b.newContext(opt);
await ctx.addInitScript((s) => {
  window.__conScale = 1;
  try { if (sessionStorage.getItem('x')) return; sessionStorage.setItem('x', 1); } catch { return; }
  localStorage.clear();
  window.__conScale = 1;
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
let fail = 0;
const out = [];
const ok = (c, m) => { out.push((c ? '✓ ' : '✗ ') + m); if (!c) fail++; };
const winOn = () => p.evaluate(() => document.querySelector('#win').classList.contains('on'));
const clear = async () => {
  for (let i = 0; i < 25; i++) {
    const st = await p.evaluate(() => ({ d: !document.querySelector('#dlg').hidden, w: document.querySelector('#win').classList.contains('on') }));
    if (st.d) await p.locator('#dlg').click().catch(() => {});
    else if (st.w) await p.locator('#winX').click().catch(() => {});
    else return;
    await W(300);
  }
};
await p.goto(process.env.URL ?? 'http://localhost:4190/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__S, null, { timeout: 20000 });
await W(1500);
await p.locator('#tCont').click();
await W(3500);
await clear();
await W(2000);
await clear();
await p.evaluate(() => { window.__S.gold = 99999; window.__S.clock = 4 * 60; });
/** 건물 발판 위 점들 (화면 좌표) */
const pts = (kind) => p.evaluate((k) => {
  const o = window.__world.objs.find((x) => x.kind === k);
  const v = window.__view, cv = document.querySelector('canvas'), r = cv.getBoundingClientRect();
  const at = (x, y) => [r.left + (((x - y) * 32) / 2 + v.OX) * v.SC, r.top + (((x + y) * 16) / 2 + v.OY) * v.SC];
  const c = [o.tx + o.fw / 2, o.ty + o.fh / 2];
  return [[0, 0], [0, -0.6], [-0.4, -0.4], [0.3, -0.9], [0.4, 0.2], [-0.2, 0.3], [-0.8, -0.8]].map(([dx, dy]) => at(c[0] + dx, c[1] + dy));
}, kind);
const inView = ([x, y]) => x > 0 && y > 60 && x < opt.viewport.width && y < opt.viewport.height - 80;
// 1) 건물 창 → 레벨업 → 공사 시작 — 실제로 레벨업이 되는 건물을 찾을 때까지 (뒤쪽이 막혀 「자리가 없어요」인 건물은 건너뜀)
let K = null, hit = null, before = null, c0 = null;
for (const k of ['inn', 'tavern', 'well', 'bench']) {
  for (const pt of (await pts(k)).filter(inView)) {
    await p.mouse.click(...pt);
    await W(700);
    // 앞에 선 다른 건물(벤치·우물)이 눌리면 그 창이 열린다 → 제목으로 확인
    const want = { inn: '여관', tavern: '주점', well: '우물', bench: '벤치' }[k];
    const t = (await winOn()) ? await p.locator('#winT').textContent() : '';
    if (t.includes(want) && (await p.locator('#upB').count()) && !(await p.locator('#upB').isDisabled())) { hit = pt; break; }
    await clear();
  }
  if (!hit) continue;
  before = await p.evaluate((K) => { const o = window.__world.objs.find((x) => x.kind === K); return { lvl: o.lvl, fw: o.fw }; }, k);
  await p.locator('#upB').click();
  await W(600);
  c0 = await p.evaluate((K) => { const o = window.__world.objs.find((x) => x.kind === K); return o.con ? { ...o.con, lvl: o.lvl, fw: o.fw, now: Date.now() } : null; }, k);
  if (c0) { K = k; break; }
  console.log(k, '레벨업 안 됨:', await p.evaluate(() => document.querySelector('#toast')?.textContent));
  hit = null;
  await clear();
}
console.log('대상 건물:', K);
ok(!!K, '건물 창 → 레벨업 버튼');
ok(!!c0 && c0.kind === 'up' && c0.to === before.lvl + 1 && c0.lvl === before.lvl, `업그레이드 → 공사 시작 (${K} Lv.${before?.lvl} → ${c0?.to}, 레벨은 아직 ${c0?.lvl})`);
out.push('  발판 ' + before.fw + ' → ' + c0.fw + (c0.fw > before.fw ? ' (커지는 공사 터)' : ''));
ok(!(await winOn()), '창 닫힘');
// 2) 톡톡 10번
const pts2 = (await pts(K)).filter(inView);
let taps = 0;
for (const pt of pts2) {
  const cut0 = await p.evaluate((K) => window.__world.objs.find((x) => x.kind === K).con.cut, K);
  await p.mouse.click(...pt);
  await W(150);
  const cut1 = await p.evaluate((K) => window.__world.objs.find((x) => x.kind === K).con.cut, K);
  if (cut1 > cut0) {
    taps = 1;
    for (let i = 0; i < 9; i++) { await p.mouse.click(...pt); await W(120); }
    break;
  }
  await clear();
}
const c1 = await p.evaluate((K) => { const o = window.__world.objs.find((x) => x.kind === K); return { cut: o.con.cut, end: o.con.end }; }, K);
ok(taps && c1.cut === 10 && c0.end - c1.end === 10000, `톡톡 10번 → 10초 단축 (cut ${c1.cut} · 끝 시각 −${(c0.end - c1.end) / 1000}초)`);
ok(!(await winOn()), '톡톡은 창을 열지 않음');
// 3) 스크린샷: 0 · 50 · 90% (낮) · 50% (밤)
/** 건물 둘레 확대용 영역 */
const around = (k) => p.evaluate((k) => { const o = window.__world.objs.find((x) => x.kind === k); const v = window.__view, r = document.querySelector('canvas').getBoundingClientRect(); const cx = o.tx + o.fw / 2, cy = o.ty + o.fh / 2; const X = r.left + (((cx - cy) * 32) / 2 + v.OX) * v.SC, Y = r.top + (((cx + cy) * 16) / 2 + v.OY) * v.SC; const w = 190 * v.SC, h = 170 * v.SC; return { x: Math.max(0, X - w / 2), y: Math.max(0, Y - h * 0.75), width: w, height: h }; }, k);
const setProg = (k) => p.evaluate(([k, K]) => { const o = window.__world.objs.find((x) => x.kind === K); o.con.end = Date.now() + o.con.total * (1 - k) * 1000; }, [k, K]);
fs.mkdirSync('shots', { recursive: true });
for (const k of [0, 0.5, 0.9]) {
  await setProg(k);
  await W(700);
  await p.screenshot({ path: `shots/con_${name}_${Math.round(k * 100)}.png` });
  await p.screenshot({ path: `shots/con_${name}_${Math.round(k * 100)}_zoom.png`, clip: await around(K) });
}
await p.evaluate(() => { window.__S.clock = 16 * 60; });
await setProg(0.5);
await W(2500);
await p.screenshot({ path: `shots/con_${name}_night.png` });
await p.screenshot({ path: `shots/con_${name}_night_zoom.png`, clip: await around(K) });
await p.evaluate(() => { window.__S.clock = 4 * 60; });
// 4) 건물 창 (공사 칸) — 탭 한도가 남아 있으니 창은 showObj 로
await clear();
await p.evaluate((K) => window.__showObj(window.__world.objs.find((x) => x.kind === K)), K);
await W(500);
ok(await p.locator('.conp').count() > 0 && /공사 중/.test(await p.locator('.conp').textContent()), '건물 창: 진행 막대 + 「Lv.2 공사 중」');
ok(await p.locator('#upB').count() === 0, '공사 중엔 레벨업 버튼 대신 진행 막대');
await p.locator('#moveB').click({ force: true });
await W(300);
ok(/공사 중이에요/.test(await p.evaluate(() => document.querySelector('#toast')?.textContent ?? '')), '옮기기 → 「공사 중이에요」');
// 5) 시간 당겨서 완성 → 레벨 오름 + 「완성!」
await clear();
await p.evaluate((K) => { const o = window.__world.objs.find((x) => x.kind === K); o.con.end = Date.now() + 200; }, K);
await W(1500);
const done = await p.evaluate((K) => { const o = window.__world.objs.find((x) => x.kind === K); return { lvl: o.lvl, con: !!o.con, over: document.querySelector('#over')?.textContent ?? '' }; }, K);
ok(done.lvl === before.lvl + 1 && !done.con, `완성 → Lv.${done.lvl}`);
ok(/완성!/.test(done.over), '완성 떠오르는 글씨');
// 6) 모모의 응원: 같은 건물 한 번 더 업그레이드 → 창 → 바로 완성
await clear();
await p.evaluate((K) => { const o = window.__world.objs.find((x) => x.kind === K); window.__game.upgrade(o); }, K);
await W(400);
const tv = await p.evaluate((K) => { const o = window.__world.objs.find((x) => x.kind === K); return { lvl: o.lvl, con: !!o.con, toast: document.querySelector('#toast')?.textContent }; }, K);
ok(tv.con, '두 번째 공사 시작 ' + (tv.con ? '' : tv.toast));
if (tv.con) {
  await clear();
  await p.evaluate((K) => window.__showObj(window.__world.objs.find((x) => x.kind === K)), K);
  await W(400);
  await p.locator('#conCheer').click({ force: true });
  await W(800);
  const tv2 = await p.evaluate((K) => { const o = window.__world.objs.find((x) => x.kind === K); return { lvl: o.lvl, con: !!o.con }; }, K);
  ok(!tv2.con && tv2.lvl === tv.lvl + 1, `모모의 응원 → 바로 완성 (Lv.${tv2.lvl})`);
}
await clear();
ok(errs.length === 0, '페이지 에러 0 ' + errs.join(' | '));
console.log(JSON.stringify({ [name]: out }, null, 1));
console.log(fail ? `✗ ${fail}개 실패` : '✓ 모두 통과');
await b.close();
process.exit(fail ? 1 : 0);
