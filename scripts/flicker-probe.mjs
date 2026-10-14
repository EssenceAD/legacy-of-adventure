// 깜빡임 검사 (웅스 신고: 새벽 04시 마을 캔버스가 1~3초마다 잠깐 어두워짐)
//  폰(412×915 · dpr 3) · 지정 시각에 저장을 불러 10초 동안 100ms마다 캔버스 밝기를 잰다 (숲 구석 · 울타리 안 · 전체)
//  실행: node scripts/flicker-probe.mjs <label> <URL> [HH:MM] [save.json] [--video]
//  결과: reports/checkin/flicker/<label>_<HHMM>.json (--video: 10초 프레임 100장 줄 _frames.png)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const VIDEO = process.argv.includes('--video');
const [label = 'probe', URL = 'http://localhost:4295/', hhmm = '04:00', saveFile = 'tests/fixtures/real_woongs.json'] = args;
const [hh, mm] = hhmm.split(':').map(Number);
const clock = ((hh - 6 + 24) % 24) * 60 + mm;
const night = hh >= 22 || hh < 6;
const sv = JSON.parse(fs.readFileSync(saveFile, 'utf8'));
const OUT = 'reports/checkin/flicker';
const TAG = process.env.INJECT ? '_inject' : '';
fs.mkdirSync(OUT, { recursive: true });
const AND = 'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36';
const b = await chromium.launch({ channel: 'chrome', headless: !process.env.HEADED });
const VER = await (async () => { const c = await b.newContext(); const v = (await (await c.request.get(URL + 'version.json')).json()).version; await c.close(); return JSON.stringify(v); })();
const save = JSON.stringify({ ...sv, day: 72, clock, night });
const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: AND });
await ctx.addInitScript(([s, ver]) => {
  try { if (sessionStorage.getItem('x')) return; sessionStorage.setItem('x', 1); } catch { return; }
  localStorage.clear();
  localStorage.setItem('legacy-of-adventure-save', s);
  localStorage.setItem('legacy-of-adventure-teaserSeen', 'true');
  localStorage.setItem('legacy-of-adventure-lastVersion', ver);
  localStorage.setItem('legacy-of-adventure-settleOff', 'true');
  localStorage.setItem('legacy-of-adventure-telemetry', 'false');
  localStorage.setItem('legacy-of-adventure-sound', JSON.stringify({ bgmOn: false, bgmVol: 0.4, sfxOn: false, sfxVol: 0.7, muted: true }));
}, [save, VER]);
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
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
});
await clear();
await p.waitForTimeout(1500);
await clear();
// 시계를 다시 맞춘다 (불러오기·창 닫기 동안 흘렀을 수 있다) — 밤 색은 바로 그 시각 값으로
await p.evaluate(([c, n]) => { const S = window.__S; S.clock = c; S.night = n; S.nightT = n ? 1 : 0; }, [clock, night]);
if (process.env.THROTTLE) { const cdp = await ctx.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(process.env.THROTTLE) }); }
await p.waitForTimeout(1500 + Number(process.env.IDLE || 0) * 1000);
// INJECT=1: 고장 주입 — 2초마다 0.5초 동안 프레임 사이에 캔버스 상태(globalAlpha 0.6)를 남겨 둔다 (바닥 단계가 들어온 상태에 흔들리나)
if (process.env.INJECT) await p.evaluate(() => { const x = document.getElementById('scene').getContext('2d'); const t0 = performance.now(); setInterval(() => { if ((performance.now() - t0) % 2000 > 1500) x.globalAlpha = 0.6; }, 5); });
const res = await p.evaluate(async (VIDEO) => {
  const cv = document.getElementById('scene');
  const W = 103, H = 228; // 1/4 크기로 줄여서 읽는다
  const t = document.createElement('canvas');
  t.width = W;
  t.height = H;
  const x = t.getContext('2d', { willReadFrequently: true });
  const lum = (d, x0, y0, x1, y1) => {
    let s = 0, n = 0;
    for (let y = y0; y < y1; y++) for (let xx = x0; xx < x1; xx++) { const i = (y * W + xx) * 4; s += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; n++; }
    return Math.round((s / n) * 100) / 100;
  };
  const out = [];
  // --video: 프레임 100장(100ms마다 · 1/4 크기)을 10×10 한 장으로 (영상 대신 프레임 줄)
  const grid = VIDEO ? document.createElement('canvas') : null;
  if (grid) { grid.width = W * 10; grid.height = H * 10; }
  const t0 = performance.now();
  const S = window.__S;
  for (let k = 0; k < 100; k++) {
    await new Promise((r) => setTimeout(r, 100 - ((performance.now() - t0) % 100)));
    x.clearRect(0, 0, W, H);
    x.drawImage(cv, 0, 0, W, H);
    const d = x.getImageData(0, 0, W, H).data;
    if (grid) grid.getContext('2d').drawImage(t, (k % 10) * W, Math.floor(k / 10) * H);
    out.push({
      t: Math.round(performance.now() - t0),
      all: lum(d, 0, 0, W, H),
      forest: lum(d, 0, Math.round(H * 0.12), Math.round(W * 0.12), Math.round(H * 0.3)),
      mid: lum(d, Math.round(W * 0.4), Math.round(H * 0.45), Math.round(W * 0.6), Math.round(H * 0.55)),
      clock: Math.round(S.clock * 10) / 10,
      nightT: Math.round(S.nightT * 1000) / 1000,
    });
  }
  return { out, mem: window.__renderMem?.(), grid: grid ? grid.toDataURL('image/png') : null };
}, VIDEO);
await ctx.close();
await b.close();
if (res.grid) fs.writeFileSync(`${OUT}/${label}${TAG}_${hhmm.replace(':', '')}_frames.png`, Buffer.from(res.grid.split(',')[1], 'base64'));
// 깜빡임 = 앞 샘플보다 3% 넘게 어두워졌다(또는 밝아졌다)가 1초 안에 다시 돌아온 번 수 (새벽·저녁의 한 방향 변화는 세지 않는다)
const fs_ = res.out.map((r) => r.forest);
const med = [...fs_].sort((a, b) => a - b)[Math.floor(fs_.length / 2)];
function flickers(v, dir) {
  let n = 0;
  for (let i = 1; i < v.length; i++) {
    const ref = v[i - 1];
    const off = (x) => (dir < 0 ? x < ref * 0.97 : x > ref * 1.03);
    if (!off(v[i]) || (i > 1 && off(v[i - 1]))) continue;
    if (v.slice(i + 1, i + 11).some((x) => !off(x))) n++;
  }
  return n;
}
const dims = flickers(fs_, -1);
const ups = flickers(fs_, 1);
fs.writeFileSync(`${OUT}/${label}${TAG}_${hhmm.replace(':', '')}.json`, JSON.stringify({ label, hhmm, med, dims, ups, errs, mem: res.mem, samples: res.out }, null, 1));
console.log(`${label}${TAG} ${hhmm}: 숲 중앙값 ${med} · 어두워짐 ${dims}번 · 밝아짐 ${ups}번/10초 · 범위 ${Math.min(...fs_)}~${Math.max(...fs_)}${errs.length ? ' · 오류 ' + errs.join(' | ') : ''}`);
