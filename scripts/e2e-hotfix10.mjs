// 핫픽스 10 §10·11·13·14 게이트 — 진짜 클릭 (개발용 전역은 상태 읽기 · 시간 단축에만)
// 실행: BOT_BUILD=1 npx vite build --outDir dist-bot && npx vite preview --outDir dist-bot --port 4190 그리고 node scripts/e2e-hotfix10.mjs [se|phone|pc|all]
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const URL = process.argv[3] ?? 'http://localhost:4190/';
const which = process.argv[2] ?? 'phone';
const OUT = 'screenshots/hotfix10';
fs.mkdirSync(OUT, { recursive: true });
const save = fs.readFileSync('tests/fixtures/beta_town.json', 'utf8');
const DEV = {
  se: { viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  pc: { viewport: { width: 1280, height: 800 } },
};
let fail = 0;
const res = {};
const b = await chromium.launch({ channel: 'chrome' });
for (const name of which === 'all' ? Object.keys(DEV) : [which]) {
  const opt = DEV[name];
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
  const navs = [];
  p.on('framenavigated', (fr) => fr === p.mainFrame() && navs.push(fr.url()));
  process.on('exit', () => navs.length > 4 && console.error('페이지 이동 기록', name, navs.join(' > ')));
  const W = (ms) => p.waitForTimeout(ms);
  const out = [];
  const ok = (c, m) => {
    out.push((c ? '✓ ' : '✗ ') + m);
    if (process.env.LIVE) console.error((c ? '✓ ' : '✗ ') + m);
    if (!c) fail++;
  };
  const vis = (s) => p.evaluate((s) => { const e = document.querySelector(s); return !!e && !e.hidden && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden'; }, s);
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
  const boot = async () => {
    // 첫 로드가 가끔 덜 끝난다 → 게임이 준비될 때까지 (안 되면 새로고침)
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
  };
  await boot();
  await clear();

  // ── §10 원정 게시판 열어 둔 채 귀환 → 「보고서 보기」 ──
  if (!(await p.evaluate(() => !!window.__S))) console.error('게임 없음 · 이동:', navs.join(' > '), '· 지금', p.url());
  const g10 = await p.evaluate(() => window.__S.gold);
  await click('#bExp', 900);
  ok((await title()) === '원정 · 의뢰 게시판', '게시판 열림');
  const sent = (await click('.quest', 900)) && (await click('.pm:not([disabled])', 400)) && (await click('#pGo', 900));
  ok(sent, '원정 보내기 (진짜 클릭)');
  await clear();
  await click('#bExp', 900);
  // 시험용 시간 단축: 방금 보낸 원정의 끝 시각을 지금으로
  await p.evaluate(() => { const r = window.__P.runs.filter((x) => !x.result).pop(); if (r) { r.end = Date.now(); r.start = Date.now() - 60000; } });
  let appeared = false;
  for (let i = 0; i < 90 && !appeared; i++) {
    await W(1000);
    appeared = (await title()) === '원정 · 의뢰 게시판' && (await vis('.run.done'));
  }
  ok(appeared, '창을 안 닫고도 「보고서 보기」가 나타남');
  ok(await p.evaluate(() => !!document.querySelector('.run.done.flash')), '새로 나온 「보고서 보기」 반짝');
  await p.screenshot({ path: `${OUT}/${name}_board_done.png` });
  if (await click('.run.done.flash', 900)) {
    for (let i = 0; i < 20 && (await vis('#dlg')); i++) await click('#dlg', 250);
    ok(await click('#repOk', 900), '보고서 → 보상 받기');
  } else ok(false, '보고서 보기 버튼을 못 누름');
  await W(500);
  ok((await p.evaluate(() => window.__S.gold)) > g10, '보상 금화 들어옴 (귀환 때 + 보고서)');
  await clear();

  // ── §11 맡겨 두기 ──
  ok(await vis('#rbHunt'), '마을에 맡겨 둔 사냥 줄 보임');
  const t1 = await p.evaluate(() => document.querySelector('#rbHunt b')?.textContent ?? '');
  ok(/^⚔ .+ 1-1 사냥 중 · \d+판 · 💰\+[\d,]+$/.test(t1), `줄 모양: ${t1}`);
  await p.evaluate(() => (window.__P.hunt.idleAt -= 31000));
  await W(1500);
  const t2 = await p.evaluate(() => document.querySelector('#rbHunt b')?.textContent ?? '');
  const n = (t) => +(t.match(/(\d+)판/)?.[1] ?? -1);
  ok(n(t2) === n(t1) + 1, `한 판 지나면 숫자 증가: ${t1} → ${t2}`);
  const tt = await p.evaluate(() => (document.querySelector('#toast')?.classList.contains('on') ? document.querySelector('#toast').textContent : ''));
  const lv = await p.evaluate(() => window.__P.hunt.auto && 0);
  void lv;
  ok(!/사냥 · 금화/.test(tt) || /장비|Lv|레벨/.test(tt), '판마다 토스트 안 뜸 (장비·레벨업만) · 토스트: ' + (tt || '없음'));
  await p.screenshot({ path: `${OUT}/${name}_hunt_line.png` });
  await click('#rbHunt', 900);
  ok((await title()) === '사냥터' && (await vis('#hStop')), '줄 누르면 사냥터(멈추기)');
  await click('#hStop', 700);
  ok(await p.evaluate(() => window.__P.hunt.auto === null), '멈추기 → 꺼짐');
  // 준비 창: 깬 스테이지 = 맡겨 두기 맨 위
  await click('[data-s="1"]', 800);
  const order1 = await p.evaluate(() => [...document.querySelectorAll('.hopt .bigbtn')].map((x) => x.id + ':' + x.textContent));
  ok(order1[0]?.startsWith('hRepeat:맡겨 두기 · 마을에서 계속 사냥') && order1.some((x) => x === 'hAuto1:전투 보기 (AUTO)'), '깬 스테이지 순서·이름 ' + order1.join(' | '));
  ok(await p.evaluate(() => [...document.querySelectorAll('.hopt small')].length === document.querySelectorAll('.hopt').length), '버튼마다 한 줄 설명');
  await p.screenshot({ path: `${OUT}/${name}_prep_cleared.png` });
  await click('#hRepeat', 800);
  ok(await p.evaluate(() => window.__P.hunt.auto?.stage === 1), '맡겨 두기 켜짐');
  await clear();
  // 안 깬 스테이지 (늪 1) = 직접 사냥 맨 위
  await click('#rbHunt', 900);
  await click('[data-r="swamp"]', 700);
  await click('[data-s="1"]', 800);
  const order2 = await p.evaluate(() => [...document.querySelectorAll('.hopt .bigbtn')].map((x) => x.id));
  ok(order2[0] === 'hMan' && !order2.includes('hRepeat'), '안 깬 스테이지 순서 ' + order2.join(','));
  // 맡겨 둔 파티와 겹치면 사냥 파티가 비지 않게: 맡겨 두기 끄고 시작
  await p.evaluate(() => (window.__P.hunt.auto = null));

  // ── §13 접기 ──
  await click('#hMan', 2500);
  ok(await vis('#cbFold'), '전투 화면에 「접기」');
  ok(/평가 보너스 없음/.test(await p.evaluate(() => document.querySelector('#cbFold')?.textContent ?? '')), '접기 옆 「접으면 평가 보너스 없음」');
  // §14: 전투 중엔 업데이트 창이 안 뜸
  await p.evaluate(() => window.__fakeUpdate({ version: '0.9.9-beta', build: 'fake1' }));
  await W(2500);
  ok(!(await vis('#updPop')), '전투 중엔 새 버전 창 안 뜸');
  await p.locator('#cbFold').dispatchEvent('pointerdown');
  await W(800);
  ok(!(await p.evaluate(() => !!document.getElementById('hunt'))), '접으면 전투 화면 닫힘');
  // 접은 뒤(바쁘지 않음) → 새 버전 창
  await W(2500);
  ok(await vis('#updPop'), '전투 접은 뒤 새 버전 창 뜸');
  await p.screenshot({ path: `${OUT}/${name}_update_popup.png` });
  ok(await vis('#updLater'), '「조금 있다가」 있음');
  await click('#updLater', 500);
  ok(!(await vis('#updPop')) && (await vis('#updBar')), '조금 있다가 → 창 닫히고 띠 남음');
  // 접은 동안 마을 조작 · 줄 시간 줄어듦
  const f1 = await p.evaluate(() => document.querySelector('#rbFold b')?.textContent ?? '');
  ok(/전투 중 · \d+:\d\d/.test(f1), '마을 줄: ' + f1);
  await W(2500);
  const f2 = await p.evaluate(() => document.querySelector('#rbFold b')?.textContent ?? '');
  ok(f1 !== f2, `줄 시간 줄어듦 ${f1} → ${f2}`);
  // 시험용: 방문 손님 둘 (하나는 기분 좋게 — 단골 후보 줄 · 하나는 그냥)
  await p.evaluate(() => {
    const a = window.__arrive();
    if (a) Object.assign(a, { mood: 95, moodSum: 90 * 3, moodN: 3 });
    const b2 = window.__arrive('passer');
    if (b2) Object.assign(b2, { mood: 40, moodSum: 40, moodN: 1 });
  });
  await clear();
  await click('#bGuest', 900);
  ok(/^손님/.test(await title()), '접은 동안 마을 조작 (손님 창 열림) · ' + (await title()));
  // §15: 단골 진행 — 맨 위 「단골 n/m · 대기」 · 방문 탭 손님마다 한 줄 · 화면에서 안 잘림
  ok(/^단골 \d+\/\d+ · 대기 \d\/3$/.test(await p.evaluate(() => document.querySelector('.regsum')?.textContent ?? '')), '손님 창 맨 위 단골 n/m · 대기');
  await click('#gT [data-t="1"]', 600);
  const rp = await p.evaluate(() => [...document.querySelectorAll('.glist .regp')].map((e) => { const r = e.getBoundingClientRect(); const w = document.querySelector('#winB').getBoundingClientRect(); return { t: e.textContent, inside: r.left >= w.left - 1 && r.right <= w.right + 1, over: e.scrollWidth > e.clientWidth + 1 }; }));
  ok(rp.length > 0 && rp.every((x) => x.inside && !x.over) && rp.every((x) => /기분 평균 \d+\/\d+/.test(x.t)), '방문 손님 진행 줄 ' + rp.length + '개 · 안 잘림 · ' + (rp[0]?.t ?? ''));
  await p.screenshot({ path: `${OUT}/${name}_guests_progress.png` });
  await clear();
  await p.screenshot({ path: `${OUT}/${name}_fold_line.png` });
  // 펼치기 → 다시 접기
  await click('#rbFold', 800);
  ok(await p.evaluate(() => !!document.getElementById('hunt')), '줄 누르면 전투 다시 펼침');
  await p.locator('#cbFold').dispatchEvent('pointerdown');
  await W(600);
  // 접은 채 새로고침 → 결과 바로
  const gBefore = await p.evaluate(() => window.__S.gold);
  await p.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  await W(300);
  const savedFold = await p.evaluate(() => JSON.parse(localStorage.getItem('legacy-of-adventure-save')).progress.hunt.folded);
  ok(!!savedFold && savedFold.region === 'swamp', '접은 판 저장됨 ' + JSON.stringify(savedFold));
  await boot();
  let rt = '';
  for (let i = 0; i < 12 && !/접어 둔 판/.test(rt); i++) {
    if (await vis('#dlg')) await click('#dlg', 250);
    rt = await title();
    if (!/접어 둔 판/.test(rt) && (await winOn())) await click('#winX', 300);
    await W(400);
  }
  ok(/접어 둔 판/.test(rt), '다시 켜면 결과 창: ' + rt);
  const body = await p.evaluate(() => document.querySelector('#winB')?.innerText ?? '');
  ok(/평가 보너스 없음|실패/.test(body), '보너스 없음(AUTO 기준) · ' + body.split('\n').slice(0, 2).join(' '));
  await p.screenshot({ path: `${OUT}/${name}_fold_reload.png` });
  ok(await p.evaluate(() => window.__P.hunt.folded === null), '결과 뒤 접은 판 기록 지움');
  void gBefore;
  await clear();

  // ── §14 force: 못 닫음 ──
  await p.evaluate(() => window.__fakeUpdate({ version: '0.9.9-beta', build: 'fake2', force: true }));
  await W(2500);
  ok((await vis('#updPop')) && !(await vis('#updLater')), 'force: 「조금 있다가」 없음');
  await p.keyboard.press('Escape');
  await W(400);
  ok(await vis('#updPop'), 'force: Esc로 안 닫힘');
  await p.screenshot({ path: `${OUT}/${name}_update_force.png` });
  const gNow = await p.evaluate(() => window.__S.gold);
  await click('#updNow', 2500);
  await click('#tCont', 3000);
  // 새로고침 사이 마을 수입·방치 정산으로 조금 늘 수는 있다 (줄면 저장이 안 된 것)
  const gAfter = await p.evaluate(() => window.__S?.gold ?? -1);
  ok(gAfter >= gNow && gAfter - gNow < 3000, `지금 다시 시작 → 저장 유지 (금화 ${gNow} → ${gAfter})`);
  ok(errs.length === 0, '페이지 에러 0 ' + errs.join(' | '));
  res[name] = out;
  await ctx.close();
}
await b.close();
console.log(JSON.stringify(res, null, 1));
console.log(fail ? `✗ ${fail}개 실패` : '✓ 모두 통과');
process.exit(fail ? 1 : 0);
