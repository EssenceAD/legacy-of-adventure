// v0.24.2 HARVEST §3 계정 삭제 e2e — 서버 없이(dev: sb 없음) · RPC는 바꿔 끼움
//  ① 게스트(로그인 안 함): 계정 창 맨 아래 빨간 버튼 → 안내(guest 문구) → 이름 틀림/맞음 → 1초 떼면 취소 · 3초 누르면 이 기기 저장 삭제 → 다시 불러오면 처음 화면
//  ② 로그인(가짜 프로필): RPC 'wrong_name' → 문구 · 저장 다시 켬 / 'ok' → RPC 부를 때 이미 저장이 멈춰 있었는지 · 저장 삭제 · done 문구
//  실행: URL=http://localhost:5204/ node scripts/e2e-acctdel.mjs [phone|pc]
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const name = process.argv[2] ?? 'phone';
const save = JSON.parse(fs.readFileSync('tests/fixtures/beta_town.json', 'utf8'));
const DEV = { phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, pc: { viewport: { width: 1440, height: 900 } } };
const dir = 'screenshots/acctdel';
fs.mkdirSync(dir, { recursive: true });
const KEY = 'legacy-of-adventure-save';
const b = await chromium.launch({ channel: 'chrome' });
let fail = 0;
const ok = (c, m) => { console.error((c ? '✓ ' : '✗ ') + m); if (!c) fail++; };

async function boot() {
  const ctx = await b.newContext(DEV[name]);
  await ctx.addInitScript((s) => {
    try { if (sessionStorage.getItem('x')) return; sessionStorage.setItem('x', 1); } catch { return; }
    localStorage.clear();
    localStorage.setItem('legacy-of-adventure-save', s);
    localStorage.setItem('legacy-of-adventure-teaserSeen', 'true');
    localStorage.setItem('legacy-of-adventure-lastVersion', '"99"');
    localStorage.setItem('legacy-of-adventure-settleOff', 'true');
    localStorage.setItem('tapMiss:test', '1');
  }, JSON.stringify(save));
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  await p.goto(process.env.URL ?? 'http://localhost:5204/', { waitUntil: 'networkidle' });
  await p.waitForFunction(() => !!window.__S, null, { timeout: 20000 });
  await p.waitForTimeout(1200);
  await p.locator('#tCont').click();
  await p.waitForTimeout(2500);
  for (let i = 0, calm = 0; i < 60 && calm < 3; i++) {
    const busy = await p.evaluate(() => { if (!document.querySelector('#dlg').hidden) return document.querySelector('#dlg').click(), true; if (document.querySelector('#win').classList.contains('on')) return document.querySelector('#winX').click(), true; return false; });
    calm = busy ? 0 : calm + 1;
    await p.waitForTimeout(busy ? 200 : 400);
  }
  await p.evaluate(() => (window.__acctDel.test.reload = false));
  return { ctx, p, errs };
}
const hold = async (p, ms) => {
  const bb = await p.locator('#adHold').boundingBox();
  await p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
  await p.mouse.down();
  await p.waitForTimeout(ms);
  await p.mouse.up();
};
const step = (p) => p.evaluate(() => document.querySelector('.acdelw')?.dataset.step ?? '');

// ───────── ① 게스트 ─────────
{
  const { ctx, p, errs } = await boot();
  const inn = await p.evaluate(() => window.__S.innName);
  await p.evaluate(() => window.__acctDel.account());
  await p.waitForTimeout(400);
  ok(await p.locator('.acdel #acDel').isVisible(), '계정 창 맨 아래 빨간 「계정 삭제」');
  await p.screenshot({ path: `${dir}/${name}_guest_account.png` });
  await p.locator('#acDel').click();
  await p.waitForTimeout(300);
  ok((await step(p)) === '1' && (await p.locator('.acdelw').innerText()).includes('로그인하지 않은 여관은'), '① 게스트 안내 문구');
  await p.screenshot({ path: `${dir}/${name}_guest_1.png` });
  await p.locator('#adNext').click();
  await p.waitForTimeout(300);
  ok((await step(p)) === '2', '② 이름 입력');
  await p.fill('#adInn', inn + 'x');
  await p.locator('#adNext').click();
  await p.waitForTimeout(300);
  ok((await step(p)) === '2', '이름이 다르면 그대로 ②');
  await p.fill('#adInn', inn);
  await p.locator('#adNext').click();
  await p.waitForTimeout(300);
  ok((await step(p)) === '3', '③ 길게 누르기');
  await hold(p, 1000);
  await p.waitForTimeout(200);
  const g = await p.evaluate(() => document.querySelector('#adGauge').style.width);
  ok((g === '0%' || g === '') && (await p.evaluate((k) => !!localStorage.getItem(k), KEY)), '1초 만에 떼면 취소 (게이지 0 · 저장 그대로)');
  const bb = await p.locator('#adHold').boundingBox();
  await p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
  await p.mouse.down();
  await p.waitForTimeout(1500);
  const mid = await p.evaluate(() => parseInt(document.querySelector('#adGauge').style.width));
  ok(mid > 30 && mid < 70, `누르는 동안 게이지 (${mid}%)`);
  await p.screenshot({ path: `${dir}/${name}_guest_3hold.png` });
  await p.waitForTimeout(1900);
  await p.mouse.up();
  await p.waitForSelector('#adDone', { timeout: 5000 }).catch(() => {});
  const done = await p.locator('#adDone').innerText().catch(() => '');
  ok(done.includes(inn) && done.includes('고마웠어요'), 'done 문구 (여관 이름)');
  await p.screenshot({ path: `${dir}/${name}_guest_done.png` });
  await p.evaluate(() => window.__saveNow());
  await p.waitForTimeout(1500);
  const left = await p.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('legacy-of-adventure') || k.startsWith('tapMiss:')));
  ok(left.length === 0, `이 기기 게임 키 전부 지움 · 그 뒤 저장 안 다시 씀 (${left.join(',')})`);
  await p.evaluate(() => sessionStorage.setItem('x', '1')); // 시험 시드 스크립트가 다시 넣지 않게
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForFunction(() => !!window.__S, null, { timeout: 20000 });
  await p.waitForTimeout(1500);
  const contHidden = await p.evaluate(() => { const c = document.getElementById('tCont'); return !c || c.hidden || c.disabled || /저장된 마을이 없어요/.test(c.textContent); });
  ok(contHidden, '다시 불러오면 「이어하기」 없음 (처음 화면)');
  await p.screenshot({ path: `${dir}/${name}_guest_title.png` });
  ok(errs.length === 0, `페이지 오류 없음 ${errs.join(' | ')}`);
  await ctx.close();
}

// ───────── ② 로그인(가짜) ─────────
{
  const { ctx, p, errs } = await boot();
  const inn = await p.evaluate(() => window.__S.innName);
  await p.evaluate((inn) => {
    window.__acctDel.me.profile = { id: 'u-test', login_id: 'tester', nickname: '시험', inn_name: inn, rep_hero: null, reputation: 0, codex_pct: 0, created_at: '' };
    window.__rpcLog = [];
    window.__rpcNext = 'wrong_name';
    window.__acctDel.test.rpc = async (p_inn) => {
      window.__rpcLog.push({ p_inn, halted: window.__acctDel.halted(), save: !!localStorage.getItem('legacy-of-adventure-save') });
      return window.__rpcNext;
    };
  }, inn);
  const run = async () => {
    await p.evaluate(() => window.__acctDel.open(false));
    await p.waitForTimeout(300);
    ok((await p.locator('.acdelw').innerText()).includes('되돌릴 수 없어요'), '① 로그인 안내 (지워지는 것)');
    await p.locator('#adNext').click();
    await p.waitForTimeout(200);
    await p.fill('#adInn', inn);
    await p.locator('#adNext').click();
    await p.waitForTimeout(200);
    await hold(p, 3400);
    await p.waitForTimeout(800);
  };
  await run();
  const err = await p.locator('#adErr').innerText().catch(() => '');
  ok(err === '여관 이름이 달라요', `RPC wrong_name → 문구 (${err})`);
  ok(!(await p.evaluate(() => window.__acctDel.halted())), '실패하면 저장 다시 켬');
  await p.screenshot({ path: `${dir}/${name}_login_fail.png` });
  await p.evaluate(() => { window.__rpcNext = null; });
  await run();
  ok((await p.locator('#adErr').innerText().catch(() => '')).startsWith('지우지 못했어요'), 'RPC 없음/오류 → fail 문구');
  await p.evaluate(() => { window.__rpcNext = 'ok'; });
  await run();
  const log = await p.evaluate(() => window.__rpcLog);
  ok(log.length === 3 && log.every((x) => x.p_inn === inn), 'RPC에 여관 이름 그대로');
  ok(log[2].halted === true, 'RPC 부르기 전에 자동 저장이 이미 멈춤 (중요)');
  const done = await p.locator('#adDone').innerText().catch(() => '');
  ok(done.includes('계정을 지웠어요'), 'ok → done 문구');
  ok((await p.evaluate(() => window.__acctDel.me.profile)) === null, '로그아웃됨');
  await p.evaluate(() => window.__saveNow());
  ok(!(await p.evaluate((k) => localStorage.getItem(k), KEY)), '이 기기 저장 삭제 · 다시 안 씀');
  await p.screenshot({ path: `${dir}/${name}_login_done.png` });
  ok(errs.length === 0, `페이지 오류 없음 ${errs.join(' | ')}`);
  await ctx.close();
}
await b.close();
console.error(fail ? `✗ ${fail}개 실패` : '✓ 전부 통과');
process.exit(fail ? 1 : 0);
