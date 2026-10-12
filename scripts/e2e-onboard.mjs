// ONBOARDING e2e: 새 기기(저장 없음) 390×844 — [시작하기] → 오프닝 3줄(+건너뛰기 연타) → 추천 이름 → 마을 조작까지 ≤ 20초
//  · 5초 안에 첫 손님 「방 있나요?」 + 손가락 → 누르면 체크인(금화) · 모닥불 · 30초 정찰 → 장부 1장 → 「당신은 누구였나요?」 → 첫 단골 제안
//  · 퍼널 순서 (boot_ok → title_tap → opening_start → … → first_run) · 기존 저장은 그대로(주인 있음 · 임무 번호)
//  실행: dist-bot 미리보기 4190 · node scripts/e2e-onboard.mjs → screenshots/onboard/*.png
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const dir = 'screenshots/onboard';
fs.mkdirSync(dir, { recursive: true });
const b = await chromium.launch({ channel: 'chrome' });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await ctx.addInitScript(() => {
  window.__conScale = 1 / 30;
  try { if (sessionStorage.getItem('x')) return; sessionStorage.setItem('x', 1); } catch { return; }
  localStorage.clear();
  localStorage.setItem('legacy-of-adventure-teaserSeen', 'true');
  localStorage.setItem('legacy-of-adventure-sound', JSON.stringify({ bgmOn: false, bgmVol: 0.4, sfxOn: false, sfxVol: 0.7, muted: true }));
});
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
p.on('dialog', (d) => { errs.push('dialog: ' + d.message()); d.accept(); });
const W = (ms) => p.waitForTimeout(ms);
let fail = 0;
const ok = (c, m) => { console.error((c ? '✓ ' : '✗ ') + m); if (!c) fail++; };
const vis = (s) => p.evaluate((s) => { const e = document.querySelector(s); return !!e && !e.hidden && e.checkVisibility(); }, s);
const mission = () => p.evaluate(() => { const m = document.querySelector('#mission'); return m && !m.hidden ? m.innerText.replace(/\n/g, ' ') : ''; });
/** 대화 넘기기 (이름 칸이면 추천 이름) */
async function talk(max = 80) {
  for (let i = 0; i < max; i++) {
    if (await vis('#namebox')) {
      await p.locator('#nameSug button').first().click();
      await W(300);
      continue;
    }
    if (!(await vis('#dlg'))) return;
    if (await vis('#dChoice')) await p.locator('#dChoice button').first().click();
    else await p.locator('#dlg').click();
    await W(220);
  }
}
await p.goto(process.env.URL ?? 'http://localhost:4190/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__S, null, { timeout: 20000 });
await W(800);
const label = await p.evaluate(() => document.querySelector('#tStart').textContent);
ok(/시작하기/.test(label), '타이틀 첫 버튼: ' + label);
const tTap = Date.now();
await p.locator('#tStart').click();
await W(500);
// 오프닝: 줄 수 · 건너뛰기 연타 (이름 칸으로)
const first = await p.evaluate(() => document.querySelector('#dText').textContent);
ok(/목숨 걸고/.test(first) || /숙박비/.test(first), '오프닝 첫 줄: ' + first.slice(0, 20));
for (let i = 0; i < 5; i++) await p.locator('#dSkip').click({ force: true }).catch(() => {});
await W(300);
ok(await vis('#namebox'), '건너뛰기 연타 → 이름 칸 (깨지지 않음)');
const sug = await p.evaluate(() => [...document.querySelectorAll('#nameSug button')].map((b) => b.textContent));
ok(sug.length === 3 && (await p.evaluate(() => document.querySelector('#nameOk').textContent)) === '그대로 쓰기', '추천 이름 3개 + 그대로 쓰기: ' + sug.join(','));
await p.screenshot({ path: `${dir}/name.png` });
await p.locator('#nameSug button').nth(1).click();
await p.waitForFunction(() => window.__S.started, null, { timeout: 10000 });
const tVillage = (Date.now() - tTap) / 1000;
ok(tVillage <= 20, `처음 마을 조작까지 ${tVillage.toFixed(1)}초 (≤ 20초)`);
ok(await p.evaluate(() => window.__P.owner?.pending === true && window.__P.owner.name === '주인장'), '기본 주인 「주인장」 (출신은 나중에)');
ok(!(await vis('#cName')), '주인 만들기 창 없음');
// 첫 손님 5초 안에
let guestAt = 0;
for (let i = 0; i < 40 && !guestAt; i++) {
  await W(250);
  if (await p.evaluate(() => window.__world.actors.some((a) => a.firstGuest && a.st === 'idle'))) guestAt = (Date.now() - tTap) / 1000 - tVillage;
}
ok(guestAt > 0 && guestAt <= 8, `첫 손님 도착 ${guestAt.toFixed(1)}초 뒤 (말풍선까지)`);
ok(await vis('#obHand'), '손님 위 손가락');
ok(/체크인/.test(await mission()), '장부 카드: ' + (await mission()));
await p.screenshot({ path: `${dir}/first_guest.png` });
const g0 = await p.evaluate(() => window.__S.gold);
const xy = await p.evaluate(() => window.__guestXY());
await p.mouse.click(xy[0], xy[1]);
await W(700);
ok((await p.evaluate(() => window.__S.gold)) > g0 && (await p.evaluate(() => window.__P.counters.checkins)) === 1, '손님을 누르면 체크인 · 금화');
// 장부 카드 받기 → 모닥불
const claim = async () => {
  for (let i = 0; i < 10 && (await p.evaluate(() => document.querySelector('#mission')?.classList.contains('done'))); i++) {
    await p.locator('#mission').click();
    await W(500);
    await talk();
  }
};
await claim();
ok(/모닥불/.test(await mission()), '다음: ' + (await mission()));
await p.locator('#bBuild').click();
await W(700);
await p.locator('[data-k=fire]').click();
await W(700);
await p.locator('#placeOk').click();
await W(1500);
await claim();
ok(/정찰/.test(await mission()), '다음: ' + (await mission()));
await p.locator('#bExp').click();
await W(800);
await p.locator('.quest.tut').click();
await W(700);
await p.locator('.pm:not([disabled])').first().click();
await W(400);
await p.locator('#pGo').click();
await W(1000);
await talk();
// 정찰 30초 기다림 → 보고서
let back = false;
for (let i = 0; i < 70 && !back; i++) {
  await W(1000);
  back = await p.evaluate(() => [...document.querySelectorAll('#runbar button.done')].some((x) => x.textContent.includes('보고서')));
}
ok(back, '30초 정찰 돌아옴');
await p.evaluate(() => { document.querySelector('#rbStrip')?.click(); });
await W(400);
await p.evaluate(() => [...document.querySelectorAll('#runbar button.done')].find((x) => x.textContent.includes('보고서'))?.click());
await W(800);
await talk();
await p.locator('#repOk').click().catch(() => {});
await W(600);
await talk();
await claim();
// 장부 1장 끝 → 연출 → 「당신은 누구였나요?」
let owner = false;
for (let i = 0; i < 40 && !owner; i++) {
  await talk(10);
  owner = await vis('#cName');
  if (!owner) await W(500);
}
ok(owner, '장부 1장 뒤 「당신은 누구였나요?」');
await p.screenshot({ path: `${dir}/owner_later.png` });
if (owner) {
  await p.fill('#cName', '하나');
  await p.locator('#cOk').click();
  await W(800);
  await talk();
}
ok(await p.evaluate(() => window.__P.owner && !window.__P.owner.pending && window.__P.owner.name === '하나'), '주인 정함 (출신 보너스 시작)');
let prop = false;
for (let i = 0; i < 12 && !prop; i++) {
  await W(500);
  prop = await p.evaluate(() => [...document.querySelectorAll('#dChoice button')].some((b) => /단골로 받기/.test(b.textContent)));
  if (!prop && (await vis('#dlg'))) await p.locator('#dlg').click();
}
ok(prop, '첫 단골 제안');
await p.screenshot({ path: `${dir}/first_regular.png` });
const fun = await p.evaluate(() => JSON.parse(localStorage.getItem('legacy-of-adventure-funnel') || '[]'));
const order = ['boot_ok', 'title_tap', 'opening_start', 'opening_skip', 'opening_end', 'inn_named', 'village_first', 'first_guest', 'first_build', 'first_run', 'owner_open', 'owner_done'];
ok(order.every((s) => fun.includes(s)), `퍼널: ${fun.join(' → ')}`);
ok(errs.length === 0, '페이지 에러·confirm 0 ' + errs.join(' | '));
console.log(fail ? `✗ ${fail}개 실패` : '✓ 모두 통과');
await b.close();
process.exit(fail ? 1 : 0);
