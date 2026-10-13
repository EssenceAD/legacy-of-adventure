// CHECKIN v0.25.4 C1·C2·L1·L2 창 e2e — ⚙(설정 창 열고 닫기) · 설정 3탭 · 설정값이 세이브(P.prefs)에 · 전투 일시정지 시트(시간 멈춤 · 포기 한 번 더)
//  · 화면 보호(켜기 → 초당 그린 수 · 누르면 요약 카드) · 구경 모드(👁 → UI 숨김 → 두 번 누르기 / 뒤로가기로 복귀 · 숨긴 동안 대기 이벤트 안 뜸)
//  두 번 돈다: ① 「새 화면 미리 보기」(실험실 = 새 HUD) ② 실험실 끔 + flags.json에서 다섯 플래그만 켬 (예전 HUD 위의 ⚙·👁)
//  실행: URL=http://localhost:4361/ node scripts/e2e-c1.mjs [저장 파일]   (BOT_BUILD 빌드)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const URL = process.env.URL ?? 'http://localhost:4361/';
const saveFile = process.argv[2] ?? (fs.existsSync('tests/fixtures/real_ttabam.json') ? 'tests/fixtures/real_ttabam.json' : 'tests/fixtures/real_lotte.json');
const sv = fs.readFileSync(saveFile, 'utf8');
const OUT = 'reports/checkin/c1e2e';
fs.mkdirSync(OUT, { recursive: true });
const AND = 'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36';
const b = await chromium.launch({ channel: 'chrome' });
const fails = [];
const ok = (c, m) => (c ? console.log('  ✓ ' + m) : (fails.push(m), console.log('  ✗ ' + m)));
const FLAGS = ['gearAlways', 'settingsTabs', 'screenSaver', 'uiHide', 'sound70'];

async function run(mode) {
  console.log(`[${mode}]`);
  const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: AND });
  if (mode === 'flags')
    await ctx.route('**/flags.json*', async (r) => {
      const res = await r.fetch();
      const j = await res.json();
      for (const k of FLAGS) j[k] = true;
      await r.fulfill({ response: res, json: j });
    });
  await ctx.addInitScript(([s, lab]) => {
    try { if (sessionStorage.getItem('x')) return; sessionStorage.setItem('x', 1); } catch { return; }
    localStorage.clear();
    localStorage.setItem('legacy-of-adventure-save', s);
    localStorage.setItem('legacy-of-adventure-teaserSeen', 'true');
    localStorage.setItem('legacy-of-adventure-lastVersion', '"99"');
    localStorage.setItem('legacy-of-adventure-settleOff', 'true');
    localStorage.setItem('legacy-of-adventure-telemetry', 'false');
    if (lab) localStorage.setItem('legacy-of-adventure-visualLab', 'true');
    localStorage.setItem('legacy-of-adventure-sound', JSON.stringify({ bgmOn: false, bgmVol: 0.4, sfxOn: false, sfxVol: 0.7, muted: true }));
  }, [sv, mode === 'lab']);
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
  await p.evaluate(() => { window.__P.runs.length = 0; window.__P.hunt.auto = null; });
  await clear();
  const title = () => p.evaluate(() => (document.querySelector('#win').classList.contains('on') ? document.querySelector('#winT').textContent : ''));

  // ── C1 ⚙ (마을) ──
  const g = await p.evaluate(() => { const e = document.querySelector('#bGear'); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x, r: innerWidth - r.right, y: r.y, w: r.width, h: r.height, menuShown: getComputedStyle(document.querySelector('#bMenu')).display !== 'none' }; });
  ok(g && g.r < 16 && g.y < 60, `⚙ 오른쪽 위 (${JSON.stringify(g)})`);
  ok(g && !g.menuShown, '⚙ 자리의 위 「메뉴」 버튼은 숨김');
  await p.screenshot({ path: `${OUT}/${mode}_village.png` });
  await p.locator('#bGear').click();
  await p.waitForTimeout(300);
  ok((await title()) === '설정', '⚙ → 설정 창');
  // 창 위에서도 같은 자리에서 눌린다
  const hit = await p.evaluate(() => { const r = document.querySelector('#bGear').getBoundingClientRect(); return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest('#bGear') != null; });
  ok(hit, '창이 열려 있어도 ⚙가 맨 위 (어두운 바깥에 안 가림)');

  // ── C2 3탭 ──
  const tabs = await p.evaluate(() => [...document.querySelectorAll('[data-stab]')].map((t) => t.textContent));
  ok(tabs.join() === '기본,알림,계정', '설정 3탭 ' + tabs.join('/'));
  ok(await p.evaluate(() => !!document.querySelector('#sBgm') && !!document.querySelector('[data-fs]') && !!document.querySelector('#mSaver') && !!document.querySelector('#mHaptic')), '기본: 소리·글자 크기·절약·진동');
  await p.locator('[data-stab="noti"]').click();
  await p.waitForTimeout(200);
  ok(await p.evaluate(() => ['#mRumor', '#mBrag', '#mChem', '#mWfBub', '#mGoalPill', '#mSettle', '#mPropCard', '#mShake'].every((s) => document.querySelector(s))), '알림: 소문·자랑·케미·길잡이·목표·정산·제안 카드·흔들림');
  await p.locator('#mShake').selectOption('low');
  await p.locator('[data-stab="acct"]').click();
  await p.waitForTimeout(200);
  ok(await p.evaluate(() => ['#mAcct', '#mKeys', '#mTele', '#mNotes'].every((s) => document.querySelector(s)) && /버전 v/.test(document.querySelector('#winB').textContent)), '계정: 로그인·단축키·플레이 기록·버전·패치노트');
  ok(await p.evaluate(() => !!document.querySelector('#acDel')), '계정: 계정 삭제 줄');
  await p.locator('#bGear').click();
  await p.waitForTimeout(300);
  ok((await title()) === '', '⚙ 한 번 더 → 설정 창 닫힘');
  // 설정값 → 세이브
  const pr = await p.evaluate(() => { window.__saveNow(); return JSON.parse(localStorage.getItem('legacy-of-adventure-save')).progress.prefs; });
  ok(pr && pr.v.shake === '"low"' && pr.at > 0, `설정값이 세이브에 (P.prefs.v.shake=${pr?.v?.shake})`);

  // ── C1 전투 일시정지 시트 ──
  await p.evaluate(async () => {
    const W = (ms) => new Promise((r) => setTimeout(r, ms));
    const P = window.__P;
    if (!P.guide.unlocked.includes('hunt')) P.guide.unlocked.push('hunt');
    for (const a of window.__world.actors) if (a.id) a.hp = 100;
    window.__openHunt('forest');
    await W(700);
    document.querySelector('[data-s="1"]')?.click();
    await W(700);
    document.querySelector('#hMan')?.click();
  });
  await p.waitForFunction(() => !!window.__combat.field() && !!document.querySelector('#cbQuit'), null, { timeout: 15000 });
  await p.waitForTimeout(1500);
  const qb = await p.evaluate(() => { const r = document.querySelector('#cbQuit').getBoundingClientRect(); return { r: innerWidth - r.right, y: r.y, gear: !!document.querySelector('#cbQuit img') }; });
  ok(qb.gear && qb.r < 20 && qb.y < 60, `전투 ⚙ 오른쪽 위 (${JSON.stringify(qb)})`);
  await p.locator('#cbQuit').click();
  await p.waitForTimeout(200);
  const t1 = await p.evaluate(() => window.__combat.field().time);
  await p.waitForTimeout(1500);
  const t2 = await p.evaluate(() => window.__combat.field().time);
  ok(t1 === t2, `일시정지 동안 전투 시간 멈춤 (${t1} → ${t2})`);
  ok(await p.evaluate(() => ['#sBgmV', '#sSfxV', '#cpAuto', '#cpShake', '#cpNums', '#cbResume', '#cbGiveUp'].every((s) => document.querySelector('#cbPause ' + s))), '시트: 음악·효과음·AUTO·흔들림·피해 숫자·계속·포기');
  ok(await p.evaluate(() => document.querySelector('#cpShake').value === 'low'), '시트 흔들림 = 설정 값');
  await p.screenshot({ path: `${OUT}/${mode}_pause.png` });
  await p.locator('#cpAuto').check();
  ok(await p.evaluate(() => window.__combat.field().auto), 'AUTO 켜짐');
  await p.locator('#cbGiveUp').click();
  await p.waitForTimeout(150);
  ok(await p.evaluate(() => !window.__combat.field().done && (/한 번 더/.test(document.querySelector('#cbGiveUp').textContent) || !!document.querySelector('.csheet.on #cshOk'))), '포기 한 번 → 「한 번 더」 또는 확인 시트 (아직 진행)');
  await p.locator('.csheet.on #cshNo').click({ timeout: 800 }).catch(() => {});
  await p.waitForTimeout(300);
  await p.locator('#cbResume').click();
  await p.waitForTimeout(1200);
  const t3 = await p.evaluate(() => window.__combat.field()?.time);
  ok(t3 < t2, `계속 → 시간 다시 흐름 (${t2} → ${t3})`);
  await p.locator('#cbQuit').click();
  await p.locator('#cbGiveUp').click();
  await p.waitForTimeout(550);
  if (await p.locator('.csheet.on #cshOk').count()) await p.locator('.csheet.on #cshOk').click();
  else await p.locator('#cbGiveUp').click();
  await p.waitForTimeout(400);
  ok(await p.evaluate(() => window.__combat.field()?.quit === true), '포기 두 번 → 포기');
  await p.waitForTimeout(3000);
  // 결과 카드 닫고 마을로
  await p.evaluate(async () => {
    const T = (ms) => new Promise((r) => setTimeout(r, ms));
    for (let i = 0; i < 20 && document.querySelector('.cbt'); i++) {
      const bs = [...document.querySelectorAll('#cbRes button')];
      const home = bs.find((x) => /마을|닫기|확인/.test(x.textContent)) ?? bs[bs.length - 1];
      home?.click();
      await T(400);
    }
  });
  await clear();
  ok(await p.evaluate(() => !document.querySelector('.cbt')), '전투 닫힘');

  // ── L1 화면 보호 ──
  await p.evaluate(() => window.__ss.enter());
  await p.waitForTimeout(800);
  ok(await p.evaluate(() => !!document.querySelector('#ssOv .sspanel') && window.__ss.on()), '화면 보호 켜짐 (판)');
  const f0 = await p.evaluate(() => window.__stats.frames);
  await p.waitForTimeout(5000);
  const f1 = await p.evaluate(() => window.__stats.frames);
  const fps = (f1 - f0) / 5;
  ok(fps <= 2.6, `화면 보호 그리기 ${fps.toFixed(1)}/초 (≤ 2)`);
  await p.screenshot({ path: `${OUT}/${mode}_saver.png` });
  await p.locator('#ssOv').click();
  await p.waitForTimeout(400);
  ok(await p.evaluate(() => !document.querySelector('#ssOv') && !window.__ss.on()), '누르면 해제');
  ok((await title()) === '다녀오셨어요', '해제 → 요약 카드');
  await p.screenshot({ path: `${OUT}/${mode}_saver_back.png` });
  // 화면 보호 동안 쌓인 이야기 대사가 요약 카드 위에 뜰 수 있다 → 넘기고 누른다 (NIGHT_LOG: 다듬을 것)
  await p.evaluate(async () => { for (let i = 0; i < 30 && !document.querySelector('#dlg').hidden; i++) { document.querySelector('#dlg').click(); await new Promise((r) => setTimeout(r, 150)); } });
  await p.locator('#ssOk').click();
  await p.waitForTimeout(300);

  // ── L2 구경 모드 ──
  await clear();
  ok(await p.evaluate(() => { const e = document.querySelector('#bEye'); return !!e && getComputedStyle(e).visibility !== 'hidden' && e.getBoundingClientRect().width > 0; }), '👁 버튼 보임');
  await clear();
  await p.locator('#bEye').click();
  await p.waitForTimeout(300);
  ok(await p.evaluate(() => document.body.classList.contains('uihide') && [...document.querySelectorAll('#hud > *')].every((e) => getComputedStyle(e).visibility === 'hidden' || getComputedStyle(e).display === 'none')), 'UI 전부 숨김');
  await p.screenshot({ path: `${OUT}/${mode}_uihide.png` });
  // 마을 한 번 누르기: 아무것도 안 열림 · 두 번: 복귀
  const vw = await p.evaluate(() => [innerWidth / 2, innerHeight * 0.75]);
  await p.mouse.click(vw[0], vw[1]);
  await p.waitForTimeout(500);
  ok(await p.evaluate(() => document.body.classList.contains('uihide') && !document.querySelector('#win').classList.contains('on')), '한 번 누르기: 그대로 (창 안 열림)');
  await p.mouse.click(vw[0], vw[1]);
  await p.waitForTimeout(120);
  await p.mouse.click(vw[0], vw[1]);
  await p.waitForTimeout(300);
  ok(await p.evaluate(() => !document.body.classList.contains('uihide')), '두 번 누르기 → 복귀');
  await clear();
  await clear();
  await p.locator('#bEye').click();
  await p.waitForTimeout(200);
  await p.evaluate(() => history.back());
  await p.waitForTimeout(500);
  ok(await p.evaluate(() => !document.body.classList.contains('uihide') && location.href.startsWith('http')), '뒤로가기 → 복귀 (페이지 그대로)');
  await clear();
  await p.locator('#bEye').click();
  await p.waitForTimeout(200);
  await p.locator('#uhPhoto').click();
  await p.waitForTimeout(300);
  ok(await p.evaluate(() => document.body.classList.contains('photo') && !document.body.classList.contains('uihide')), '[📷] → 사진 모드');
  await p.evaluate(() => window.__exitPhoto());
  ok(!errs.length, '페이지 오류 없음 ' + errs.join(' | '));
  await ctx.close();
}
await run('lab');
await run('flags');
await b.close();
console.log(fails.length ? `✗ ${fails.length}개 실패` : '✓ e2e-c1 통과');
process.exit(fails.length ? 1 : 0);
