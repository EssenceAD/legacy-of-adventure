// HOTFIX19 e2e: 폰 390×844 · 건물 두 채 사이 1칸 골목에 길 붓으로 10칸 긋기
//  · 누르는 순간 첫 칸 칠함 · 빠르게 그어도 칸이 비지 않음 · 붓을 들면 건물 흐리게 · 돋보기 · 토글 · 드래그 fps
//  실행: URL=… node scripts/e2e-hotfix19.mjs → screenshots/hotfix19/*.png
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const save = JSON.parse(fs.readFileSync('tests/fixtures/lotte_dupe.json', 'utf8'));
const dir = 'screenshots/hotfix19';
fs.mkdirSync(dir, { recursive: true });
const b = await chromium.launch({ channel: 'chrome' });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await ctx.addInitScript((s) => {
  try { if (sessionStorage.getItem('x')) return; sessionStorage.setItem('x', 1); } catch { return; }
  localStorage.clear();
  localStorage.setItem('legacy-of-adventure-save', s);
  localStorage.setItem('legacy-of-adventure-teaserSeen', 'true');
  localStorage.setItem('legacy-of-adventure-lastVersion', '"99"');
  localStorage.setItem('legacy-of-adventure-settleOff', 'true');
  localStorage.setItem('legacy-of-adventure-sound', JSON.stringify({ bgmOn: false, bgmVol: 0.4, sfxOn: false, sfxVol: 0.7, muted: true }));
}, JSON.stringify(save));
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
const W = (ms) => p.waitForTimeout(ms);
let fail = 0;
const ok = (c, m) => { console.error((c ? '✓ ' : '✗ ') + m); if (!c) fail++; };
const settle = async () => {
  for (let i = 0, calm = 0; i < 80 && calm < 3; i++) {
    const busy = await p.evaluate(() => { if (!document.querySelector('#dlg').hidden) return document.querySelector('#dlg').click(), true; if (document.querySelector('#win').classList.contains('on')) return document.querySelector('#winX').click(), true; return false; });
    calm = busy ? 0 : calm + 1;
    await W(busy ? 200 : 600);
  }
};
const xy = (x, y) => p.evaluate(([x, y]) => window.__decor.xy(x, y), [x, y]);
// BUILDUX: 위 탭은 data-tab · 지우개·자동 길은 길 탭 안에
const tool = (t) => p.evaluate((t) => { const q = (s) => document.querySelector(`#decorBar ${s}`); if (t === 'erase') { if (!q('[data-tool="erase"]')) q('[data-tab="path"]').click(); if (!q('[data-tool="erase"]').classList.contains('on')) q('[data-tool="erase"]').click(); return; } q(`[data-tab="${t}"]`).click(); }, t);
const act = (a) => p.evaluate((a) => { const q = () => document.querySelector(`#decorBar [data-act="${a}"]`); if (!q()) document.querySelector('#decorBar [data-tab="path"]').click(); q().click(); }, a);
const painted = () => p.evaluate(() => Object.keys(window.__P.decor.paint));

await p.goto(process.env.URL ?? 'http://localhost:4190/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__S, null, { timeout: 20000 });
await W(1500);
await p.locator('#tCont').click();
await W(3000);
await settle();
// 빈 5×10 자리 → 노점(2×2) 다섯 개씩 두 줄, 사이 1칸 골목
const spot = await p.evaluate(() => {
  const T = window.__town;
  const [a, b] = T.landBounds();
  const occ = (x, y) => window.__world.objs.some((o) => x >= o.tx && x < o.tx + o.fw && y >= o.ty && y < o.ty + o.fh);
  for (let y = a + 1; y < b - 11; y++)
    for (let x = a + 1; x < b - 6; x++) {
      let free = true;
      for (let j = 0; j < 11 && free; j++) for (let i = 0; i < 5 && free; i++) if (occ(x + i, y + j)) free = false;
      if (free) return [x, y];
    }
  return null;
});
ok(!!spot, '빈 자리: ' + spot);
const [sx, sy] = spot;
await p.evaluate(([x, y]) => {
  for (let j = 0; j < 10; j += 2) {
    window.__town.addObj('stall', x, y + j);
    window.__town.addObj('stall', x + 3, y + j);
  }
  window.__P.decor.paint = {};
  window.__town.rebuildPaths();
}, [sx, sy]);
const ax = sx + 2; // 골목 칸
const alley = Array.from({ length: 10 }, (_, j) => [ax, sy + j]);
await p.evaluate(() => document.querySelector('#bBuild').click());
await W(700);
await p.evaluate(() => document.querySelector('#toDecor').click());
await W(900);
// 골목이 화면 가운데 오게
await p.evaluate(([x, y]) => window.__game.focusTile(x, y), [ax, sy + 5]);
await W(600);
await tool('path');
await W(300);
ok(await p.evaluate(() => window.__decor.view.fade), '붓을 들면 건물 흐리게 (fade)');
await p.screenshot({ path: `${dir}/01_fade.png` });

// §1 누르는 순간 첫 칸
const pts = [];
for (const t of alley) pts.push(await xy(...t));
await p.mouse.move(pts[0][0], pts[0][1]);
await p.mouse.down();
await W(50);
ok((await painted()).includes(`${ax},${sy}`), '누르는 순간 첫 칸이 칠해짐');
ok(await p.evaluate(() => !document.getElementById('loupe')?.hidden), '손가락 위 돋보기');
// fps: 그리는 동안 rAF 세기 (폰 흉내: CPU 4배 느리게)
const cdp = await ctx.newCDPSession(p);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
await p.evaluate(() => { window.__fr = 0; window.__fon = true; const f = () => { if (!window.__fon) return; window.__fr++; requestAnimationFrame(f); }; requestAnimationFrame(f); });
const t0 = Date.now();
// 빠르게: 칸 사이 한 번에 건너뛰기 (보간 필요) — 왕복해서 1.5초 이상 끌기
for (let rep = 0; rep < 3; rep++) {
  const seq = rep % 2 ? [...pts].reverse() : pts;
  for (let i = 0; i < seq.length; i += 3) {
    await p.mouse.move(seq[i][0], seq[i][1], { steps: 2 });
    await W(40);
  }
  await p.mouse.move(seq[seq.length - 1][0], seq[seq.length - 1][1], { steps: 2 });
  await W(40);
}
const fps = await p.evaluate(() => { window.__fon = false; return window.__fr; }) / ((Date.now() - t0) / 1000);
await p.screenshot({ path: `${dir}/02_drag.png` });
await p.mouse.up();
await W(400);
ok(fps >= 30, `드래그 중 fps ${fps.toFixed(1)} (≥30)`);
const got = await painted();
const miss = alley.filter(([x, y]) => !got.includes(`${x},${y}`));
ok(miss.length === 0, `골목 10칸 모두 칠함 (빠진 칸 ${JSON.stringify(miss)})`);
ok(!got.some((k) => { const [x, y] = k.split(',').map(Number); return x !== ax; }), '건물 발판엔 안 칠함');
ok(await p.evaluate(() => document.getElementById('loupe').hidden), '손 떼면 돋보기 사라짐');
ok(await p.evaluate(() => window.__decor.pathN() > 0), '손 뗀 뒤 길 다시 계산');
await p.screenshot({ path: `${dir}/03_after.png` });
// 토글 끄기 → 흐림 없음 (fadeOn false)
await act('fade');
await W(300);
ok(await p.evaluate(() => !window.__decor.view.fadeOn), '건물 흐리게 끔 토글');
await p.screenshot({ path: `${dir}/04_fadeoff.png` });
await act('fade');
// 손 도구 → fade 해제
await tool('hand');
await W(200);
ok(await p.evaluate(() => !window.__decor.view.fade), '도구 내려놓으면 원래대로');
// 되돌리기 한 번에 붓질 전체
await act('undo');
await W(300);
ok((await painted()).length === 0, '되돌리기: 붓질 한 번 통째로');
await act('exit');
await W(500);
ok(errs.length === 0, '오류 없음 ' + errs.join(' | '));
await b.close();
console.log(JSON.stringify({ fail, fps: +fps.toFixed(1) }));
process.exit(fail ? 1 : 0);
