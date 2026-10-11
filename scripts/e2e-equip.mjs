// 핫픽스 12 §1: 장비 자동 장착 — 손님 목록 「모두 자동 장착」 · 손님 창 「추천 장착」 · 무기 궁합 표시 · 🔒 잠금 (진짜 클릭)
//  실행: dist-bot 미리보기 4190 · node scripts/e2e-equip.mjs [se|pc] · 스크린샷 shots/h12_equip_<기기>.png
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const name = process.argv[2] ?? 'se';
const save = fs.readFileSync('tests/fixtures/beta_town.json', 'utf8');
const DEV = { se: { viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, pc: { viewport: { width: 1280, height: 800 } } };
const b = await chromium.launch({ channel: 'chrome' });
const ctx = await b.newContext(DEV[name]);
await ctx.addInitScript((s) => {
  try { if (sessionStorage.getItem('x')) return; sessionStorage.setItem('x', 1); } catch { return; }
  localStorage.clear();
  localStorage.setItem('legacy-of-adventure-save', s);
  localStorage.setItem('legacy-of-adventure-teaserSeen', 'true');
  localStorage.setItem('legacy-of-adventure-lastVersion', '"99"');
  localStorage.setItem('legacy-of-adventure-sound', JSON.stringify({ bgmOn: false, bgmVol: 0.4, sfxOn: false, sfxVol: 0.7, muted: true }));
}, save);
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
const W = (ms) => p.waitForTimeout(ms);
let fail = 0;
const out = [];
const ok = (c, m) => { out.push((c ? '✓ ' : '✗ ') + m); if (!c) fail++; };
const clear = async () => {
  for (let i = 0; i < 25; i++) {
    const st = await p.evaluate(() => ({ d: !document.querySelector('#dlg').hidden, w: document.querySelector('#win').classList.contains('on') }));
    if (st.d) await p.locator('#dlg').click().catch(() => {});
    else if (st.w) await p.locator('#winX').click().catch(() => {});
    else return;
    await W(300);
  }
};
const toastT = () => p.evaluate(() => document.querySelector('#toast')?.textContent ?? '');
await p.goto(process.env.URL ?? 'http://localhost:4190/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__S, null, { timeout: 20000 });
await W(1500);
await p.locator('#tCont').click();
await W(3000);
await clear();
await W(2500);
await clear();
// 준비: 원정 비우기 · 단골 다 벗기기 · 좋은 장비 몇 개 (직업 무기 포함)
const total = () => p.evaluate(() => window.__world.actors.filter((a) => a.id && (a.status === 'regular' || a.status === 'hero')).reduce((s, a) => s + window.__power(a), 0));
await p.evaluate(() => {
  const P = window.__P;
  P.runs.length = 0;
  for (const a of window.__world.actors) if (a.id) { a.runId = null; a.equip = { weapon: null, armor: null, acc: null }; }
  for (const it of P.bag) it.owner = null;
});
const t0 = await total();
await p.locator('#bMenu2').click();
await W(800);
await p.locator('.mtile', { hasText: '손님' }).first().click();
await W(800);
await p.locator('#gAuto').click();
await W(500);
const t1 = await total();
const msg = await toastT();
ok(/단골 \d+명 장비 정리 · 전투력 \+/.test(msg) || (t1 === t0 && /이미 최선/.test(msg)), `모두 자동 장착 토스트 「${msg}」`);
ok(t1 >= t0, `전체 전투력 ${t0} → ${t1}`);
await p.locator('#gAuto').click();
await W(500);
ok(/이미 최선/.test(await toastT()), '두 번째엔 「이미 최선이에요」');
// 손님 창
await p.locator('.glist button').first().click();
await W(700);
ok(await p.locator('#aRec').count() > 0 && (await p.locator('#aTake').count()) > 0, '손님 창: 추천 장착 + 「다른 단골 것도 가져오기」');
ok(!(await p.locator('#aTake').isChecked()), '체크박스 기본 꺼짐');
ok(await p.evaluate(() => !!document.querySelector('.slot i.fit') || !document.querySelector('.slot[data-s="weapon"] .ic img')), '무기 칸 궁합 표시');
await p.screenshot({ path: `shots/h12_equip_${name}.png` });
await p.locator('#aRec').click();
await W(400);
ok(/이미 최선|교체/.test(await toastT()), '추천 장착 → ' + (await toastT()));
// 잠금: 가방 → 첫 장비 → 🔓 잠그기
await clear();
await p.evaluate(() => window.__openBag?.());
if (!(await p.evaluate(() => document.querySelector('#bagAuto')))) {
  await p.locator('#bMenu2').click();
  await W(800);
  await p.locator('.mtile', { hasText: '손님' }).first().click();
  await W(800);
  await p.locator('#gBag').click();
}
await W(700);
ok(await p.locator('#bagAuto').count() > 0, '가방에 「모두 자동 장착」');
const firstFree = p.locator('.bag .ic:not(:has(s))').first();
await firstFree.click();
await W(600);
await p.locator('#iLock').click();
await W(400);
ok(/잠갔어요/.test(await toastT()) && (await p.locator('#iSal').isDisabled()), '🔒 잠그기 → 분해 막힘');
const lockedId = await p.evaluate(() => window.__P.bag.find((x) => x.locked)?.id);
ok(lockedId != null, '저장에 locked');
await p.locator('#iBack').click();
await W(500);
await p.locator('#bagAuto').click();
await W(400);
ok(await p.evaluate((id) => window.__P.bag.find((x) => x.id === id).owner == null, lockedId), '잠근 장비는 모두 자동 장착에서 안 움직임');
ok(await p.evaluate(() => !!document.querySelector('.bag b.lk')), '가방 칸에 🔒 표시');
ok(errs.length === 0, '페이지 에러 0 ' + errs.join(' | '));
console.log(JSON.stringify({ [name]: out }, null, 1));
console.log(fail ? `✗ ${fail}개 실패` : '✓ 모두 통과');
await b.close();
process.exit(fail ? 1 : 0);
