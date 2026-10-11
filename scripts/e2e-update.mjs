// 핫픽스 13: 업데이트 경로 — 옛 빌드로 서비스워커 설치·캐시 채움 → 같은 주소에서 새 빌드로 바꿈 → 업데이트 창 「지금 다시 시작」 → 오류 없이 새 버전 마을
//  아이폰 크기(390×844, 터치) + 홈 화면 앱(standalone) 흉내 · 5번 반복 · Pages처럼 max-age=600 캐시 헤더
//  + 그림 하나 404 → 재시도 → 자동 새로고침 1번 → 오류 화면 「다시 시도」 → 고치고 누르면 정상
//  실행: node scripts/e2e-update.mjs <옛 빌드 폴더> <새 빌드 폴더> [<더 새 빌드 폴더>] [반복 수]
import { chromium } from 'playwright-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const [OLD, NEW, NEW2, N = '5'] = process.argv.slice(2);
if (!OLD || !NEW) throw new Error('사용법: node scripts/e2e-update.mjs <old> <new> [new2] [n]');
const PORT = 4195;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.svg': 'image/svg+xml' };
let root = OLD;
let fail = null;
const srv = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  let p = decodeURIComponent(u.pathname);
  if (p === '/') p = '/index.html';
  if (fail && p.endsWith(fail)) {
    res.writeHead(404);
    return res.end();
  }
  const f = path.join(root, p);
  if (!f.startsWith(path.resolve(root)) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
    res.writeHead(404);
    return res.end();
  }
  // GitHub Pages 흉내: 10분 캐시
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] ?? 'application/octet-stream', 'Cache-Control': 'max-age=600' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => srv.listen(PORT, r));
const URL0 = `http://localhost:${PORT}/`;

const b = await chromium.launch({ channel: 'chrome' });
let failN = 0;
const out = [];
const ok = (c, m) => {
  out.push((c ? '✓ ' : '✗ ') + m);
  if (!c) failN++;
};
const save = fs.readFileSync('tests/fixtures/beta_town.json', 'utf8');
const IPHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' };

async function newCtx() {
  const ctx = await b.newContext({ ...IPHONE, serviceWorkers: 'allow' });
  await ctx.addInitScript((s) => {
    // 홈 화면 앱 흉내
    try {
      Object.defineProperty(navigator, 'standalone', { get: () => true });
      const mm = window.matchMedia.bind(window);
      window.matchMedia = (q) => (/display-mode:\s*standalone/.test(q) ? { matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false } : mm(q));
    } catch {}
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.clear();
    localStorage.setItem('legacy-of-adventure-save', s);
    localStorage.setItem('legacy-of-adventure-teaserSeen', 'true');
    localStorage.setItem('legacy-of-adventure-lastVersion', '"99"');
    localStorage.setItem('legacy-of-adventure-telemetry', 'false');
  }, save);
  return ctx;
}
const ver = (p) => p.evaluate(() => document.getElementById('tVer')?.textContent ?? '');
const booted = (p) => p.waitForFunction(() => !document.getElementById('loading') || /불러오지 못했/.test(document.getElementById('loading')?.textContent ?? ''), null, { timeout: 30000 }).then(() => p.evaluate(() => !document.getElementById('loading')));
const swReady = (p) => p.waitForFunction(() => !!navigator.serviceWorker?.controller, null, { timeout: 20000 }).then(() => true, () => false);

/** 업데이트 한 번: from 빌드에서 마을까지 → to 빌드로 바꿈 → 창 → 지금 다시 시작 */
async function round(i, from, to, label) {
  root = from;
  const ctx = await newCtx();
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await p.goto(URL0, { waitUntil: 'load' });
  await booted(p);
  const sw1 = await swReady(p);
  // 컨트롤러가 붙은 상태로 한 번 더 (SW 캐시가 그림을 채운다)
  await p.reload({ waitUntil: 'load' });
  await booted(p);
  await p.locator('#tCont').click({ timeout: 15000 }).catch(() => {});
  await p.waitForTimeout(2500);
  const fromBuild = await p.evaluate(() => fetch('version.json?t=' + Date.now(), { cache: 'no-store' }).then((r) => r.json()).then((j) => j.build));
  // 새 빌드로 교체 (같은 주소)
  root = to;
  const toBuild = JSON.parse(fs.readFileSync(path.join(to, 'version.json'), 'utf8')).build;
  await p.evaluate(() => document.dispatchEvent(new Event('visibilitychange', { bubbles: true })));
  const pop = await p.waitForSelector('#updNow', { timeout: 20000 }).then(() => true, () => false);
  ok(sw1 && pop, `${label} #${i}: SW 설치(${sw1}) · 업데이트 창(${pop})`);
  if (!pop) {
    await ctx.close();
    return;
  }
  // 다시 시작 뒤 그림·JSON 요청이 전부 새 빌드 번호(?v=)를 달고 있는지 (옛 캐시 키와 겹칠 수 없음)
  const reqs = [];
  let navd = false;
  p.on('framenavigated', (fr) => fr === p.mainFrame() && (navd = true));
  p.on('request', (r) => { const u = r.url(); if (navd && /\/assets\/(sprites|portraits|icons|ui|monsters|props|emotes|fx|mon)\//.test(u)) reqs.push(u); });
  await Promise.all([p.waitForEvent('load', { timeout: 30000 }).catch(() => {}), p.locator('#updNow').click()]);
  const good = await booted(p);
  await p.waitForTimeout(800);
  // 새 버전의 크기표에 새 그림이 다 있는지 + 화면이 마을까지
  const st = await p.evaluate(async () => {
    const b = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' }).then((r) => r.json());
    return { build: b.build, loading: document.getElementById('loading')?.textContent ?? null, title: !!document.getElementById('title') };
  });
  await p.locator('#tCont').click({ timeout: 10000 }).catch(() => {});
  await p.waitForTimeout(1500);
  const shown = await p.evaluate(() => document.getElementById('title')?.classList.contains('out') || document.getElementById('title')?.hidden || false);
  const tag = 'v=' + encodeURIComponent(toBuild);
  const stale = reqs.filter((u) => !u.includes(tag));
  ok(reqs.length > 50 && stale.length === 0, `${label} #${i}: 에셋 요청 ${reqs.length}개 모두 새 빌드 번호${stale.length ? ' — 아닌 것: ' + stale.slice(0, 3).join(' ') : ''}`);
  ok(good && !st.loading && st.build === toBuild && errs.length === 0, `${label} #${i}: 다시 시작 → 오류 없이 새 빌드 (${fromBuild.slice(-6)} → ${st.build.slice(-6)}) · 마을 ${shown ? '열림' : '?'}${errs.length ? ' · ' + errs.join(' | ') : ''}`);
  await ctx.close();
}

const n = +N;
for (let i = 1; i <= n; i++) await round(i, OLD, NEW, '옛 → 새');
if (NEW2) for (let i = 1; i <= n; i++) await round(i, NEW, NEW2, '새 → 더 새(고친 업데이트 순서)');

// ── 404 흐름 (새 빌드): 재시도 → 자동 새로고침 1번 → 오류 화면 + 다시 시도
{
  root = NEW;
  fail = 'sprites/inn.png';
  const ctx = await newCtx();
  const p = await ctx.newPage();
  let navs = 0;
  p.on('framenavigated', (f) => f === p.mainFrame() && navs++);
  const reqs = [];
  p.on('request', (r) => /sprites\/inn\.png/.test(r.url()) && reqs.push(r.url()));
  await p.goto(URL0, { waitUntil: 'load' });
  const btn = await p.waitForSelector('#bootRetry', { timeout: 40000 }).then(() => true, () => false);
  ok(btn, `404: 오류 화면 + 「다시 시도」 (자동 새로고침 ${navs - 1}번 · inn.png 요청 ${reqs.length}번 · 재시도 주소 ${reqs.some((u) => /&r=2/.test(u)) ? '&r=2 있음' : '없음'})`);
  ok(navs - 1 === 1, '자동 새로고침은 딱 1번');
  fail = null;
  if (btn) {
    await Promise.all([p.waitForEvent('load', { timeout: 30000 }).catch(() => {}), p.locator('#bootRetry').click()]);
    ok(await booted(p), '고친 뒤 「다시 시도」 → 정상 로딩');
  }
  await ctx.close();
}

console.log(JSON.stringify(out, null, 1));
console.log(failN ? `✗ ${failN}개 실패` : '✓ 모두 통과');
await b.close();
srv.close();
process.exit(failN ? 1 : 0);
