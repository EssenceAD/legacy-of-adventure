// 브라우저 자동 점검 (밤샘 ④-2): 빌드 결과물(vite preview)을 폰 390×844 · PC 1280×800으로
//  타이틀 → 새 게임 → 장부 1장 → 숲 1-1 직접 전투 클리어 → 결과 → 마을 → 메뉴 모든 칸 열고 닫기(✕ · ← · Esc)
//  콘솔 에러 0개 · 실패한 요청 0개 · 화면별 스크린샷 screenshots/v0.9/
//  실행: npm run build && node scripts/e2e.mjs [phone|pc|both]   (개발용 전역 함수 없이 화면만 눌러서)
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { chromium } from 'playwright-core';

const PORT = 4183;
const URL = `http://localhost:${PORT}/`;
const OUT = 'screenshots/v0.9';
const which = process.argv[2] ?? 'all';
fs.mkdirSync(OUT, { recursive: true });
const vite = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe', shell: process.platform === 'win32' });
const stop = () => {
  try {
    if (process.platform === 'win32') spawn('taskkill', ['/pid', String(vite.pid), '/T', '/F']);
    else vite.kill();
  } catch {
    /* 끝남 */
  }
};
for (let i = 0; i < 60; i++) {
  try {
    if ((await fetch(URL)).ok) break;
  } catch {
    /* 아직 */
  }
  await new Promise((r) => setTimeout(r, 500));
}

async function run(size) {
  const b = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] });
  // 핫픽스 8 (2-6): 기기 크기 — iPhone SE · iPhone 14 · 홈 화면 앱(안전영역 위 47 · 아래 34px만큼 쓸 수 있는 높이가 줄어든 것으로 흉내) · PC
  const DEV = {
    se: { viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
    phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
    app: { viewport: { width: 390, height: 844 - 47 - 34 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
    pc: { viewport: { width: 1280, height: 800 } },
  };
  const opt = DEV[size];
  const ctx = await b.newContext(opt);
  // 처음 실행 · 소리 끔 (점검 속도) · 플레이 기록 끔 (점검이 서버 기록에 섞이지 않게)
  await ctx.addInitScript(() => {
    if (sessionStorage.getItem('e2e')) return;
    sessionStorage.setItem('e2e', '1');
    localStorage.clear();
    localStorage.setItem('legacy-of-adventure-teaserSeen', 'true');
    localStorage.setItem('legacy-of-adventure-telemetry', 'false');
    localStorage.setItem('legacy-of-adventure-sound', JSON.stringify({ bgmOn: false, bgmVol: 0.4, sfxOn: false, sfxVol: 0.7, muted: true }));
  });
  const p = await ctx.newPage();
  const errs = [];
  const bad = [];
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  p.on('console', (m) => m.type() === 'error' && errs.push('console: ' + m.text().slice(0, 200)));
  p.on('response', (r) => {
    const t = r.request().resourceType();
    if (r.status() >= 400 && !/supabase/.test(r.url())) bad.push(`${r.status()} ${r.url()}`);
    if (['image', 'media', 'font'].includes(t) && (r.headers()['content-type'] ?? '').includes('text/html')) bad.push(`HTML ${r.url()}`);
  });
  p.on('dialog', (d) => d.accept());
  const W = (ms) => p.waitForTimeout(ms);
  const shot = (n) => p.screenshot({ path: `${OUT}/${size}_${n}.png` });
  const q = (sel) => p.$(sel);
  const vis = (sel) => p.evaluate((s) => { const e = document.querySelector(s); return !!e && !e.hidden && e.getClientRects().length > 0; }, sel);
  // 핫픽스 8: JS로 강제 클릭하지 않는다 — 진짜 마우스/터치로 눌러서, 가려지거나 화면 밖이면 실패로 센다
  const click = async (sel, ms = 700) => {
    try {
      const l = p.locator(sel).first();
      if (!(await l.count()) || (await l.isDisabled().catch(() => true))) return false;
      await l.click({ timeout: 2000 });
      await W(ms);
      return true;
    } catch {
      return false;
    }
  };
  const clickText = async (sel, text, ms = 700) => {
    try {
      const l = p.locator(sel, { hasText: text }).filter({ hasNot: p.locator('[disabled]') }).first();
      if (!(await l.count()) || (await l.isDisabled().catch(() => true))) return false;
      await l.click({ timeout: 2000 });
      await W(ms);
      return true;
    } catch {
      return false;
    }
  };
  /** 버튼 가운데를 찍었을 때 그 버튼이 나오나 (화면 안 · 다른 것에 안 가림) */
  const reachable = (sel) =>
    p.evaluate((s) => {
      const e = document.querySelector(s);
      if (!e || e.hidden) return 'none';
      const r = e.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return 'none';
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      if (cy < 0 || cy > innerHeight || cx < 0 || cx > innerWidth || r.bottom > innerHeight + 1) return `화면 밖(아래 ${Math.round(r.bottom - innerHeight)}px)`;
      const hit = document.elementFromPoint(cx, cy);
      return hit && (hit === e || e.contains(hit)) ? 'ok' : `가림(${hit?.id || hit?.className || hit?.tagName})`;
    }, sel);
  const ui = [];
  const expectReach = async (sel, where) => {
    const r = await reachable(sel);
    if (r !== 'ok') ui.push(`${where}: ${sel} ${r}`);
    return r;
  };
  const winOn = () => p.evaluate(() => document.querySelector('#win').classList.contains('on'));
  const mission = () => p.evaluate(() => { const m = document.querySelector('#mission'); return m && !m.hidden ? m.innerText.replace(/\n/g, ' ') : ''; });
  const talk = async () => {
    for (let i = 0; i < 120; i++) {
      if (await vis('#namebox')) {
        await p.fill('#nameIn', '솔바람');
        await click('#nameOk', 400);
        continue;
      }
      if (!(await vis('#dlg'))) return;
      if (await vis('#dChoice')) await click('#dChoice button', 400);
      else await click('#dlg', 250);
    }
  };
  const log = [];
  const t0 = Date.now();
  const L = (s) => log.push(`${((Date.now() - t0) / 1000).toFixed(0)}s ${s}`);

  // ── 타이틀 → 새 게임 ──
  await p.goto(URL, { waitUntil: 'networkidle' });
  await W(2000);
  await shot('01_title');
  // 타이틀 위 창: 패치노트 — 창이 타이틀 UI보다 위, 타이틀 버튼은 가려져 못 누름
  if (await click('#tVer', 900)) {
    await shot('01b_title_patchnotes');
    await expectReach('#winX', '타이틀·패치노트');
    for (const tb of ['#tStart', '#tCont', '#tTeaser', '#tLetter']) if ((await reachable(tb)) === 'ok') ui.push(`타이틀·패치노트: ${tb}가 창 위로 눌림`);
    await click('#winX', 500);
  } else ui.push('타이틀: 패치노트 버튼을 못 누름');
  // 타이틀 위 창: 모모에게 편지(손님 → 로그인 안내 창)
  if (await click('#tLetter', 600)) {
    await talk();
    if (await winOn()) {
      await shot('01c_title_letter');
      await expectReach('#repLogin', '타이틀·편지');
      for (const tb of ['#tStart', '#tCont']) if ((await reachable(tb)) === 'ok') ui.push(`타이틀·편지: ${tb}가 창 위로 눌림`);
      await click('#winX', 500);
    }
  }
  await click('#tStart', 1200);
  await click('[data-j=warrior]', 600);
  await p.fill('#cName', '루비');
  await W(300);
  await shot('02_owner');
  // 주인공 만들기: 「이 사람으로 시작」이 화면 안에 보이고 눌려야 한다 (핫픽스 8 — 아이폰에서 잘림)
  await expectReach('#cOk', '주인공 만들기');
  if (!(await click('#cOk', 600))) ui.push('주인공 만들기: 이 사람으로 시작을 못 누름');
  await talk();
  L('새 게임 시작');
  // ── 장부 1장 (임무 카드만 보고) ──
  for (let i = 0; i < 400 && Date.now() - t0 < 6 * 60 * 1000; i++) {
    await talk();
    const m = await mission();
    if (/장부 2장/.test(m)) break;
    const done = await p.evaluate(() => [...document.querySelectorAll('#runbar button.done')].some((x) => x.textContent.includes('보고서')));
    if (done && !(await winOn())) {
      // 접힌 「진행 중」 띠면 먼저 펼친다 (사람처럼)
      if (!(await clickText('#runbar button.done', '보고서', 800))) {
        await click('#rbStrip', 500);
        await clickText('#runbar button.done', '보고서', 800);
      }
      await talk();
      await click('#repOk', 800);
      await talk();
      L('원정 보고서');
      continue;
    }
    if (await winOn()) {
      if (!(await click('#offOk'))) await click('#winX', 400);
      continue;
    }
    if (await p.evaluate(() => document.querySelector('#mission')?.classList.contains('done'))) {
      await click('#mission', 600);
      await talk();
      L('임무 받기: ' + m.slice(0, 30));
      continue;
    }
    if (/정찰/.test(m)) {
      await click('#bExp', 900);
      if (await click('.quest.tut', 900)) {
        await click('.pm:not([disabled])', 600);
        await click('#pGo', 600);
        L('첫 정찰');
      }
    } else if (/모닥불/.test(m)) {
      await click('#bBuild', 900);
      await click('[data-k=fire]', 900);
      await click('#placeOk', 900);
      L('모닥불');
    } else if (/말 걸기/.test(m)) {
      await click('#bGuest', 900);
      await p.evaluate(() => [...document.querySelectorAll('#winB button')].find((x) => / · Lv/.test(x.textContent) && !x.textContent.includes('원정'))?.click());
      await W(900);
      if (await click('#aTalk', 400)) {
        await talk();
        L('말 걸기');
      }
    } else if (/1분 (원정|의뢰)|장비/.test(m)) {
      await click('#bExp', 900);
      if (await clickText('.quest', '1분', 900)) {
        await click('.pm:not([disabled])', 600);
        await click('#pGo', 600);
        L('1분 원정');
      }
      await W(3000);
    } else if (/목표/.test(m)) {
      await click('#bMenu2', 900);
      await clickText('.mtile', '오늘의 목표', 900);
      if (await click('[data-g]:not([disabled])', 900)) L('목표 받기');
      else await W(2000);
    } else await W(1500);
    await click('#winX', 300);
  }
  await shot('03_ledger_ch1');
  const ch2 = /장부 2장/.test(await mission());
  L(ch2 ? '장부 1장 끝' : '장부 1장 못 끝냄: ' + (await mission()));
  // ── 숲 1-1 직접 전투 ──
  let huntRes = '';
  // 단골이 원정에서 돌아올 때까지 (최대 2분)
  let ready = false;
  for (let w = 0; w < 24 && !ready; w++) {
    await click('#winX', 300);
    await talk();
    if (await p.evaluate(() => [...document.querySelectorAll('#runbar button.done')].some((x) => x.textContent.includes('보고서')))) {
      // 접힌 「진행 중」 띠면 먼저 펼친다 (사람처럼)
      if (!(await clickText('#runbar button.done', '보고서', 800))) {
        await click('#rbStrip', 500);
        await clickText('#runbar button.done', '보고서', 800);
      }
      await talk();
      await click('#repOk', 800);
      await talk();
      await click('#winX', 300);
    }
    await click('#bMenu2', 900);
    await clickText('.mtile', '사냥', 900);
    await click('[data-s="1"]', 900);
    ready = await p.evaluate(() => !!document.querySelector('#hMan') && !document.querySelector('#hMan').disabled);
    if (!ready) await W(5000);
  }
  if (ready) {
    await shot('04_hunt_prep');
    await click('#hMan', 2500);
    // 공격 꾹 (가까운 적 자동 조준) + 스킬 · 필살기
    const hold = () => p.evaluate(() => { const a = document.querySelector('#cbAtk'); a?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); });
    await hold();
    for (let k = 0; k < 600; k++) {
      if (await vis('#cbRes')) break;
      if (k % 12 === 0) await p.evaluate(() => ['#cbS1', '#cbS2', '#cbUlt'].forEach((s) => document.querySelector(s)?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))));
      if (k === 30) await shot('05_combat');
      await W(250);
    }
    await W(1200);
    huntRes = (await p.evaluate(() => document.querySelector('#cbRes')?.innerText ?? '')).split('\n').slice(0, 3).join(' ');
    await shot('06_result');
    await click('#cHome', 1500);
    await talk();
  }
  L('사냥 1-1: ' + (huntRes || '못 함'));
  await shot('07_village');
  // 남아 있는 창·대화(원정 보고서 등)부터 정리 — 사람처럼 「받기」나 ✕
  for (let k = 0; k < 6 && ((await winOn()) || (await vis('#dlg'))); k++) {
    await talk();
    if (!(await click('#repOk', 600))) await click('#winX', 400);
  }
  // ── 메뉴 모든 칸: ✕ · ← · Esc 돌아가며 ──
  await click('#bMenu', 600);
  const tiles = await p.evaluate(() => [...document.querySelectorAll('.mtile')].map((t) => t.querySelector('span').textContent));
  await click('#winX', 300);
  const menuLog = [];
  for (const [i, name] of tiles.entries()) {
    await click('#bMenu', 500);
    const locked = await p.evaluate((n) => [...document.querySelectorAll('.mtile')].find((t) => t.querySelector('span').textContent === n)?.classList.contains('lock'), name);
    await clickText('.mtile', name, 700);
    await talk();
    const title = await p.evaluate(() => (document.querySelector('#win').classList.contains('on') ? document.querySelector('#winT').textContent : ''));
    const back = await vis('#winBack');
    // 열린 창마다: ✕와 발(버튼 줄)의 첫 버튼이 화면 안에 보이고 눌리는가
    if (title) {
      await expectReach('#winX', name);
      if (await p.evaluate(() => !!document.querySelector('#winF button:not([disabled])'))) await expectReach('#winF button:not([disabled])', name);
    }
    if (i < 6) await shot(`m_${String(i).padStart(2, '0')}`);
    const how = ['x', 'back', 'esc'][i % 3];
    if (how === 'x') await click('#winX', 400);
    else if (how === 'back') {
      if (back) await click('#winBack', 400);
      await click('#winX', 400);
    } else {
      await p.keyboard.press('Escape');
      await W(300);
      await p.keyboard.press('Escape');
      await W(300);
    }
    const closed = !(await winOn());
    menuLog.push(`${name}${locked ? '(잠김)' : ''} → ${title || '(창 없음)'}${back ? ' ←' : ''} · ${how} ${closed ? '닫힘' : '안 닫힘'}`);
    if (!closed) await click('#winX', 300);
  }
  await b.close();
  return { size, log, huntRes, menu: menuLog, ui, errs, bad };
}

let code = 0;
try {
  for (const s of which === 'all' ? ['se', 'phone', 'app', 'pc'] : which === 'both' ? ['phone', 'pc'] : [which]) {
    const r = await run(s);
    console.log(JSON.stringify(r, null, 1));
    if (r.errs.length || r.bad.length || r.ui.length || !r.huntRes) code = 1;
  }
} catch (e) {
  console.error('✗ 점검 실패:', e.message);
  code = 1;
} finally {
  stop();
}
process.exit(code);
