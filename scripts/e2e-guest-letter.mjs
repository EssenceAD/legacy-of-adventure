// v0.25.55 손님(비로그인) 편지 — 타이틀 「모모에게 편지」 → 폼 · 답장 안내 줄 · 보낸 내용(기기·버전·화면만) · 하루 3통 · 서버 준비 전이면 로그인 안내
//  서버(bug_letters insert)는 가로채서 흉내 (진짜 DB에 쓰지 않는다)
//  실행: dist-bot 미리보기 4190 · node scripts/e2e-guest-letter.mjs → screenshots/guest-letter/*.png
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const URL = process.argv[2] ?? 'http://localhost:4190/';
const OUT = 'screenshots/guest-letter';
fs.mkdirSync(OUT, { recursive: true });
const fails = [];
const ok = (c, m) => (c ? console.log('  ✓ ' + m) : (fails.push(m), console.log('  ✗ ' + m)));

const b = await chromium.launch({ channel: 'chrome' });
async function run(mode) {
  const ctx = await b.newContext({ viewport: { width: 412, height: 860 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => {
    try { if (sessionStorage.getItem('x')) return; sessionStorage.setItem('x', 1); } catch { return; }
    localStorage.clear();
    localStorage.setItem('legacy-of-adventure-telemetry', 'false');
  });
  const sent = [];
  await ctx.route(/\/rest\/v1\/bug_letters/, async (r) => {
    if (r.request().method() !== 'POST') return r.continue();
    sent.push(JSON.parse(r.request().postData() || '{}'));
    if (mode === 'nosrv') return r.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ code: 'PGRST204', message: "Could not find the 'guest_device' column" }) });
    if (mode === 'limit') return r.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ code: 'P0001', message: 'guest_daily_limit' }) });
    return r.fulfill({ status: 201, body: '' });
  });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 120)));
  await p.goto(URL, { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('#tLetter', { state: 'visible', timeout: 60000 });
  // 라이브: 그림 불러오기 막이 걷힐 때까지
  await p.waitForFunction(() => { const l = document.getElementById('loading'); return !l || !l.offsetParent; }, null, { timeout: 90000 });
  await p.waitForTimeout(600);
  const talk = async () => {
    for (let i = 0; i < 15; i++) {
      if (await p.evaluate(() => document.querySelector('#dlg').hidden)) return;
      await p.evaluate(() => document.querySelector('#dlg').click());
      await p.waitForTimeout(220);
    }
  };
  const lastLine = () => p.evaluate(() => document.querySelector('#dlg')?.innerText ?? '');
  const send = async (txt) => {
    await p.evaluate(() => document.getElementById('tLetter').click());
    await p.waitForTimeout(400);
    await talk();
    await p.waitForSelector('#rep', { timeout: 5000 });
    await p.fill('#rt', txt);
    await p.evaluate(() => document.querySelector('#rep button').click());
    await p.waitForTimeout(700);
  };
  return { ctx, p, sent, errs, talk, lastLine, send };
}

console.log('[1] 손님 편지 보내기');
{
  const { ctx, p, sent, errs, talk, lastLine, send } = await run('ok');
  await p.evaluate(() => document.getElementById('tLetter').click());
  await p.waitForTimeout(400);
  await talk();
  const formTxt = await p.evaluate(() => document.querySelector('#win')?.innerText ?? '');
  ok(/모모에게 편지 쓰기/.test(formTxt), '손님에게도 편지 폼이 열림');
  ok(/답장 받으려면 로그인해 주세요/.test(formTxt), '「답장 받으려면 로그인해 주세요」 줄');
  ok(!/카톡방/.test(formTxt), '카톡방 줄 없음');
  ok(await p.evaluate(() => !!document.getElementById('repLogin')), '로그인 버튼');
  await p.screenshot({ path: `${OUT}/form_guest.png` });
  await p.fill('#rt', '온천 옆에서 손님이 길을 잃었어요');
  await p.evaluate(() => document.querySelector('#rep button').click());
  await p.waitForTimeout(700);
  await p.waitForTimeout(1800);
  const line = await lastLine();
  ok(/꼭 읽어 볼게요/.test(line) && !/답장하면/.test(line), '손님 인사(답장 약속 없음): ' + line.trim().slice(0, 40));
  const s = sent[0] ?? {};
  ok(s.user_id === null, 'user_id 없음');
  ok(/^[A-Za-z0-9-]{8,40}$/.test(s.guest_device ?? ''), '기기 번호: ' + s.guest_device);
  ok(/^\d+x\d+@[\d.]+ (touch|mouse)$/.test(s.guest_info ?? ''), '화면 정보: ' + s.guest_info);
  ok(/^v0\.\d+\.\d+/.test(s.app_version ?? ''), '버전: ' + s.app_version);
  ok(s.body === '[버그 제보] 온천 옆에서 손님이 길을 잃었어요', '본문');
  ok(Object.keys(s).sort().join() === 'app_version,body,guest_device,guest_info,user_id', '보내는 칸은 5개뿐: ' + Object.keys(s).sort().join());
  await talk();
  await send('둘째');
  await talk();
  await send('셋째');
  await talk();
  ok(sent.length === 3, '3통 보냄');
  await send('넷째');
  const l4 = await lastLine();
  ok(sent.length === 3 && /3통 다 보냈어요/.test(l4), '4통째는 서버에 안 가고 막힘');
  await p.screenshot({ path: `${OUT}/limit_local.png` });
  ok(!errs.length, '페이지 에러 없음 ' + errs.join(' | '));
  await ctx.close();
}

console.log('[2] 서버가 하루 3통으로 막음');
{
  const { ctx, sent, talk, lastLine, send } = await run('limit');
  await send('막히는 편지');
  ok(sent.length === 1 && /3통 다 보냈어요/.test(await lastLine()), '서버 거절 → 「오늘은 3통 다 보냈어요」');
  await talk();
  await ctx.close();
}

console.log('[3] 서버 준비 전(SQL 미적용) → 로그인 안내');
{
  const { ctx, p, talk, lastLine, send } = await run('nosrv');
  await send('준비 전 편지');
  ok(/계정이 있어야/.test(await lastLine()), '모모: 계정이 있어야 배달');
  await talk();
  ok(await p.evaluate(() => !!document.getElementById('repLogin') && !document.getElementById('rep')), '로그인 안내 창');
  await p.screenshot({ path: `${OUT}/nosrv.png` });
  await ctx.close();
}

await b.close();
console.log(fails.length ? `✗ ${fails.length}개 실패` : '✓ 모두 통과');
process.exit(fails.length ? 1 : 0);
