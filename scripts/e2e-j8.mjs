// CHECKIN §J8 건물 말풍선 e2e (실험실 켬): 다 자란 텃밭 → 바구니 말풍선 · 누르면 텃밭 창 · 닫으면 상태가 바뀔 때까지 안 뜸 · 바뀌면 다시
//  · 돌아온 원정대 → 게시판 깃발 · 누르면 원정 창 · 최대 3개 · 꾸미기 · 사진 · UI 끄기(body.uihide) · 화면 보호(body.ssaver) · 설정 끔에선 안 보임
//  · 실험실 끔(플래그 끔) → 아무것도 안 그림 · 프레임 시간 (말풍선 켬/끔 비교)
//  실행: URL=http://localhost:4381/ node scripts/e2e-j8.mjs   (BOT_BUILD 빌드 · 실세이브 tests/fixtures/real_ttabam.json · 로컬 전용)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const URL = process.env.URL ?? 'http://localhost:4381/';
const sv = fs.readFileSync(fs.existsSync('tests/fixtures/real_ttabam.json') ? 'tests/fixtures/real_ttabam.json' : 'tests/fixtures/real_lotte.json', 'utf8');
const dir = 'screenshots/j8';
fs.mkdirSync(dir, { recursive: true });
const b = await chromium.launch({ channel: 'chrome' });
let fail = 0;
const ok = (c, m) => {
  console.error((c ? '✓ ' : '✗ ') + m);
  if (!c) fail++;
};
const errs = [];

async function boot(lab) {
  const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(([s, lab]) => {
    try { if (sessionStorage.getItem('x')) return; sessionStorage.setItem('x', 1); } catch { return; }
    localStorage.clear();
    localStorage.setItem('legacy-of-adventure-save', s);
    localStorage.setItem('legacy-of-adventure-teaserSeen', 'true');
    localStorage.setItem('legacy-of-adventure-lastVersion', '"99"');
    localStorage.setItem('legacy-of-adventure-settleOff', 'true');
    localStorage.setItem('legacy-of-adventure-telemetry', 'false');
    localStorage.setItem('legacy-of-adventure-wfBubOff', 'true');
    if (lab) localStorage.setItem('legacy-of-adventure-visualLab', 'true');
    localStorage.setItem('legacy-of-adventure-sound', JSON.stringify({ bgmOn: false, bgmVol: 0.4, sfxOn: false, sfxVol: 0.7, muted: true }));
  }, [sv, lab]);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  await p.goto(URL, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => !!window.__S && !!document.querySelector('#tCont'), null, { timeout: 30000 });
  await p.locator('#tCont').click();
  await p.waitForFunction(() => window.__S.started && !document.querySelector('#hud').hidden, null, { timeout: 20000 });
  await clear(p);
  await p.waitForTimeout(800);
  await clear(p);
  return { p, ctx };
}
const clear = (p) =>
  p.evaluate(async () => {
    const T = (ms) => new Promise((r) => setTimeout(r, ms));
    for (let i = 0, calm = 0; i < 60 && calm < 3; i++) {
      let busy = false;
      if (!document.querySelector('#dlg').hidden) { document.querySelector('#dlg').click(); busy = true; }
      else if (document.querySelector('#win').classList.contains('on')) { document.querySelector('#winX').click(); busy = true; }
      calm = busy ? 0 : calm + 1;
      await T(busy ? 120 : 250);
    }
  });
const spots = (p) => p.evaluate(async () => { window.__bld.refresh(); await new Promise((r) => setTimeout(r, 300)); return window.__bld.spots(); });
/** 카메라를 그 건물로 */
const look = (p, kind) =>
  p.evaluate((kind) => {
    const o = window.__world.objs.find((x) => x.kind === kind);
    const V = window.__view;
    const cx = o.tx + o.fw / 2, cy = o.ty + o.fh / 2;
    V.cam.x = (cx - cy) * 16;
    V.cam.y = (cx + cy - 32) * 8;
  }, kind);
async function tapSpot(p, kind) {
  const xy = await p.evaluate((kind) => {
    const s = window.__bld.spots().find((x) => x.kind === kind);
    if (!s) return null;
    const r = document.querySelector('#scene').getBoundingClientRect();
    const SC = window.__view.SC;
    return [r.left + (s.x + s.w / 2) * SC, r.top + (s.y + s.h / 2) * SC];
  }, kind);
  if (!xy) return false;
  await p.mouse.click(xy[0], xy[1]);
  await p.waitForTimeout(500);
  return true;
}
const winTitle = (p) => p.evaluate(() => (document.querySelector('#win').classList.contains('on') ? document.getElementById('winT')?.textContent ?? '' : ''));

// ───────── 실험실 켬 ─────────
{
  const { p } = await boot(true);
  // 장면: 텃밭 한 칸 다 자람 · 축복 없음 · 금화 넉넉
  await p.evaluate(() => {
    const g = window.__world.objs.find((o) => o.kind === 'garden');
    g.plots ??= [];
    while (g.plots.length < 3) g.plots.push({ crop: null, at: 0 });
    for (const pl of g.plots) { pl.crop = 'cabbage'; pl.at = Date.now(); }
    g.plots[0].at = 0;
    if (window.__P.gs) window.__P.gs.blessUntil = 0;
    window.__S.gold = Math.max(window.__S.gold, 1e7);
  });
  await look(p, 'garden');
  let s = await spots(p);
  console.error(JSON.stringify(s.map((x) => `${x.kind}:${x.id}`)));
  ok(s.some((x) => x.kind === 'garden' && x.id === 'ripe'), '다 자란 텃밭 → 바구니 말풍선');
  ok(s.length <= 3, `최대 3개 (${s.length})`);
  await p.screenshot({ path: `${dir}/1_ripe.png` });
  ok(await tapSpot(p, 'garden'), '바구니 말풍선 누름');
  ok(/텃밭/.test(await winTitle(p)), `→ 텃밭 창 (${await winTitle(p)})`);
  await p.evaluate(() => document.querySelector('#winX').click());
  await p.waitForTimeout(300);
  s = await spots(p);
  ok(!s.some((x) => x.kind === 'garden'), '창을 닫은 뒤: 같은 상태(다 자람)면 다시 안 뜸');
  // 상태가 바뀜: 다 자란 칸을 거둠 → 빈 밭
  await p.evaluate(() => { const g = window.__world.objs.find((o) => o.kind === 'garden'); g.plots[0].crop = null; g.plots[0].at = 0; });
  s = await spots(p);
  ok(s.some((x) => x.kind === 'garden' && x.id === 'empty'), '상태가 바뀌면(빈 밭) 다시 뜸 · 씨앗');
  // 원정대가 돌아옴 → 게시판 깃발(반짝)
  const hasBoard = await p.evaluate(() => {
    const P = window.__P;
    const W = window.__world;
    const m = W.actors.find((a) => !a.role && (a.status === 'regular' || a.status === 'hero'));
    const q = P.quests?.list?.[0] ?? { id: 1, region: 'forest', tier: 0, days: 1, power: 1, reward: 1 };
    P.runs.push({ id: 99901, quest: q, members: m ? [m.id] : [], start: Date.now() - 1000, end: Date.now() - 500, claimed: false, result: { win: true, gold: 0, xp: 0, mats: 0, items: [], report: [], levelUps: [], newChem: [] } });
    return !!W.objs.find((o) => o.kind === 'board' || o.kind === 'guild');
  });
  await look(p, 'board');
  s = await spots(p);
  console.error(JSON.stringify(s.map((x) => `${x.kind}:${x.id}`)));
  if (hasBoard) {
    ok(s[0]?.id === 'back' || s[0]?.id === 'ripe', `완료가 맨 앞 (${s[0]?.id})`);
    ok(s.some((x) => x.id === 'back'), '돌아온 원정대 → 게시판 깃발');
    await p.screenshot({ path: `${dir}/2_back.png` });
    ok(await tapSpot(p, s.find((x) => x.id === 'back').kind), '깃발 누름');
    const t = await winTitle(p);
    ok(/원정|의뢰|게시판/.test(t), `→ 원정 창 (${t})`);
    await clear(p);
    s = await spots(p);
    ok(!s.some((x) => x.id === 'back'), '닫은 뒤 깃발 안 뜸');
  } else ok(true, '(게시판 없는 저장 — 깃발 건너뜀)');
  // 숨김: 꾸미기 · 사진 · UI 끄기 · 화면 보호 · 설정 끔
  await p.evaluate(() => { const g = window.__world.objs.find((o) => o.kind === 'garden'); g.plots[1].at = 0; });
  await look(p, 'garden');
  ok((await spots(p)).length > 0, '숨기기 전 말풍선 있음');
  const hidden = async (on, off, m) => {
    await p.evaluate(on);
    await p.waitForTimeout(400);
    const n = (await spots(p)).length;
    if (m === '사진 모드') await p.screenshot({ path: `${dir}/3_photo.png` });
    await p.evaluate(off);
    await p.waitForTimeout(300);
    ok(n === 0, `${m}: 말풍선 없음 (${n})`);
  };
  await hidden(() => { window.__decor.view.on = true; document.body.classList.add('decor'); }, () => { window.__decor.view.on = false; document.body.classList.remove('decor'); }, '꾸미기 모드');
  await hidden(() => window.__enterPhoto(), () => window.__exitPhoto(), '사진 모드');
  await hidden(() => document.body.classList.add('uihide'), () => document.body.classList.remove('uihide'), 'UI 끄기(body.uihide)');
  await hidden(() => document.body.classList.add('ssaver'), () => document.body.classList.remove('ssaver'), '화면 보호(body.ssaver)');
  // 설정 「건물 알림 말풍선」 끔 — 설정 창의 줄로
  await p.evaluate(() => window.__openSettings?.('noti'));
  const row = await p.evaluate(() => !!document.getElementById('mBldBub'));
  if (row) {
    await p.evaluate(() => { const c = document.getElementById('mBldBub'); c.checked = false; c.onchange(); });
    await clear(p);
    ok((await spots(p)).length === 0, '설정 끔: 말풍선 없음');
    await p.evaluate(async () => { window.__openSettings('noti'); const c = document.getElementById('mBldBub'); c.checked = true; c.onchange(); });
    await clear(p);
  }
  ok(row, '설정에 「건물 알림 말풍선」 줄');
  ok((await spots(p)).length > 0, '다시 켜면 보임');
  // 프레임 시간: 말풍선 켬 vs 끔 (같은 장면 · 그리기 함수만)
  const perf = await p.evaluate(async () => {
    const cv = document.querySelector('#scene');
    const ctx = cv.getContext('2d');
    const t = (n) => { const t0 = performance.now(); for (let i = 0; i < n; i++) window.__town.renderFrame(ctx, 1 / 60); return (performance.now() - t0) / n; };
    t(30);
    const on = t(200);
    document.body.classList.add('uihide');
    t(30);
    const off = t(200);
    document.body.classList.remove('uihide');
    return { on, off, ...window.__bld.perf() };
  });
  console.error(`프레임 (renderFrame 평균): 말풍선 켬 ${perf.on.toFixed(3)}ms · 끔 ${perf.off.toFixed(3)}ms · 상태 고르기 ${perf.picks}회 평균 ${(perf.pickMs / Math.max(1, perf.picks)).toFixed(3)}ms · 그리기 ${perf.draws}회 평균 ${(perf.drawMs / Math.max(1, perf.draws)).toFixed(4)}ms`);
  fs.writeFileSync(`${dir}/perf.json`, JSON.stringify(perf, null, 1));
  ok(perf.pickMs / Math.max(1, perf.picks) < 2, '상태 고르기 < 2ms');
  ok(perf.picks <= Math.ceil(perf.draws / 20) + 5, `상태 고르기는 0.5초마다만 (고르기 ${perf.picks} · 그리기 ${perf.draws})`);
}

// ───────── 실험실 끔 (플래그 끔) ─────────
{
  const { p } = await boot(false);
  await p.evaluate(() => {
    const g = window.__world.objs.find((o) => o.kind === 'garden');
    g.plots ??= [{ crop: null, at: 0 }];
    g.plots[0].crop = 'carrot';
    g.plots[0].at = 0;
  });
  const s = await spots(p);
  ok(s.length === 0, '플래그 끔: 말풍선 없음');
  const asked = await p.evaluate(() => performance.getEntriesByType('resource').some((r) => /ui\/bubble\//.test(r.name)));
  ok(!asked, '플래그 끔: 말풍선 그림도 안 불러옴');
}
await b.close();
if (errs.length) console.error('페이지 오류:\n' + errs.join('\n'));
ok(errs.length === 0, '페이지 오류 없음');
console.error(fail ? `✗ ${fail}개 실패` : '✓ e2e-j8 통과');
process.exit(fail ? 1 : 0);
