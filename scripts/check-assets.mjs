// 배포 전 검사 (핫픽스 7 재발 방지): 빌드 결과물(vite preview)을 크롬으로 열어
// 그림·소리·글꼴 요청이 하나라도 실패(404 등)하면 실패로 끝낸다 → npm run deploy가 멈춘다.
// 개발 서버에서는 멀쩡하고 빌드에서만 깨지는 경로 문제(CSS 기준 상대 경로 등)를 잡기 위해서다.
//  실행: npm run check  (dist가 있어야 한다 · 크롬이 깔려 있어야 한다)
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';

const PORT = 4179;
// 라이브 확인: node scripts/check-assets.mjs https://…/  (주소를 주면 vite preview 없이 그 주소를 연다)
const LIVE = process.argv[2];
const URL = LIVE ?? `http://localhost:${PORT}/`;
const vite = LIVE ? null : spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe', shell: process.platform === 'win32' });
const stop = () => {
  if (!vite) return;
  try {
    if (process.platform === 'win32') spawn('taskkill', ['/pid', String(vite.pid), '/T', '/F']);
    else vite.kill();
  } catch {
    /* 이미 끝남 */
  }
};

async function waitServer() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(URL);
      if (r.ok) return;
    } catch {
      /* 아직 */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('vite preview가 뜨지 않았어요');
}

let code = 0;
try {
  await waitServer();
  const b = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] });
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
  const bad = new Set();
  const kinds = new Set(['image', 'media', 'font', 'fetch', 'stylesheet', 'script', 'xhr']);
  p.on('response', (r) => {
    const t = r.request().resourceType();
    if (!kinds.has(t)) return;
    if (r.status() >= 400) return bad.add(`${r.status()} ${r.url()}`);
    // vite preview는 없는 주소에 index.html(200)을 돌려준다 → 그림·소리·글꼴이 HTML로 오면 실패
    const ct = r.headers()['content-type'] ?? '';
    if ((t === 'image' || t === 'media' || t === 'font') && ct.includes('text/html')) bad.add(`HTML ${r.url()}`);
  });
  p.on('requestfailed', (r) => kinds.has(r.resourceType()) && !/ERR_ABORTED/.test(r.failure()?.errorText ?? '') && bad.add(`FAIL ${r.url()} ${r.failure()?.errorText ?? ''}`));
  await p.goto(LIVE ? URL + "?t=" + Date.now() : URL, { waitUntil: 'networkidle' });
  await p.waitForTimeout(2500);
  // 첫 실행: 터치 → 소리 잠금 해제(효과음 미리 받기) → 티저 → 건너뛰기 → 시작하기(주인 만들기 창)
  await p.mouse.click(195, 420);
  await p.waitForTimeout(3500);
  await p.evaluate(() => document.querySelector('#tSkip')?.click());
  await p.waitForTimeout(1500);
  await p.evaluate(() => document.querySelector('#tGo')?.click());
  await p.waitForTimeout(2500);
  await b.close();
  if (bad.size) {
    console.error(`\n✗ 실패한 요청 ${bad.size}개 — 배포하지 않아요:\n  ` + [...bad].join('\n  '));
    code = 1;
  } else console.log('✓ 빌드 결과물: 그림·소리·글꼴 요청 실패 0개');
} catch (e) {
  console.error('✗ 검사를 못 했어요:', e.message);
  code = 1;
} finally {
  stop();
}
process.exit(code);
