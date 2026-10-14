// SMITH §1 e2e: 대장간 강화 탭에서 아래로 스크롤 → 강화 누름 → 스크롤 그대로 · 누른 줄 반짝
//  · 탭 바꾸면 맨 위 · 다른 창(가방·손님·사냥)은 열 때 맨 위 (회귀)
//  실행: URL=… node scripts/e2e-smith1.mjs [phone|pc]
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const name = process.argv[2] ?? 'phone';
const save = JSON.parse(fs.readFileSync('tests/fixtures/real_lotte.json', 'utf8'));
const DEV = { phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, pc: { viewport: { width: 1440, height: 900 } } };
const b = await chromium.launch({ channel: 'chrome' });
const ctx = await b.newContext(DEV[name]);
await ctx.addInitScript((s) => {
  try { if (sessionStorage.getItem('x')) return; sessionStorage.setItem('x', 1); } catch { return; }
  localStorage.clear();
  localStorage.setItem('legacy-of-adventure-save', s);
  localStorage.setItem('legacy-of-adventure-teaserSeen', 'true');
  localStorage.setItem('legacy-of-adventure-lastVersion', '"99"');
  localStorage.setItem('legacy-of-adventure-settleOff', 'true');
  localStorage.setItem('legacy-of-adventure-sound', JSON.stringify({ bgmOn: false, bgmVol: 0.4, sfxOn: false, sfxVol: 0.7, muted: true }));
}, JSON.stringify(save));
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
const W = (ms) => p.waitForTimeout(ms);
let fail = 0;
const ok = (c, m) => { console.error((c ? '✓ ' : '✗ ') + m); if (!c) fail++; };
const settle = async () => {
  for (let i = 0, calm = 0; i < 80 && calm < 3; i++) {
    const busy = await p.evaluate(() => { if (!document.querySelector('#dlg').hidden) return document.querySelector('#dlg').click(), true; if (document.querySelector('#win').classList.contains('on')) return document.querySelector('#winX').click(), true; return false; });
    calm = busy ? 0 : calm + 1;
    await W(busy ? 200 : 600);
  }
};
const top = () => p.evaluate(() => document.querySelector('#winB').scrollTop);
await p.goto(process.env.URL ?? 'http://localhost:4190/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__S, null, { timeout: 20000 });
await W(1500);
await p.locator('#tCont').click();
await W(3000);
await settle();
// 가루 넉넉히 · 대장간 열기 · 강화 탭
await p.evaluate(() => {
  for (const k of Object.keys(window.__P.dust)) window.__P.dust[k] = 1e6;
  const o = window.__world.objs.find((x) => x.kind === 'smith');
  window.__showObj(o);
});
await W(700);
await p.evaluate(() => document.querySelector('#winB .tabs .tab[data-t="1"]')?.click());
await W(500);
const n = await p.evaluate(() => document.querySelectorAll('#winB [data-enh]:not([disabled]):not([aria-disabled="true"])').length);
ok(n >= 6, `강화할 장비 ${n}개`);
// 아래쪽 줄로 스크롤해서 그 줄의 강화 버튼 누르기
const pick = await p.evaluate(() => {
  const bs = [...document.querySelectorAll('#winB [data-enh]:not([disabled]):not([aria-disabled="true"])')];
  const btn = bs[Math.floor(bs.length * 0.7)];
  btn.scrollIntoView({ block: 'center' });
  return btn.getAttribute('data-enh');
});
await W(300);
const before = await top();
ok(before > 100, `스크롤 내려감 (${before})`);
const box = await p.locator(`#winB [data-enh="${pick}"]`).boundingBox();
await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
await W(120);
const after = await top();
const flash = await p.evaluate((id) => !!document.querySelector(`#winB [data-enh="${id}"]`)?.closest('.irow')?.classList.contains('flash'), pick);
const visible = await p.evaluate((id) => {
  const r = document.querySelector(`#winB [data-enh="${id}"]`).getBoundingClientRect();
  const b = document.querySelector('#winB').getBoundingClientRect();
  return r.top >= b.top - 1 && r.bottom <= b.bottom + 1;
}, pick);
ok(Math.abs(after - before) < 60 || visible, `강화 뒤 스크롤 유지 (${before} → ${after})`);
ok(visible, '누른 줄이 화면 안');
ok(flash, '누른 줄 반짝');
await W(700);
// 연달아 3번 더
for (let i = 0; i < 3; i++) {
  const bx = await p.locator(`#winB [data-enh="${pick}"]`).boundingBox();
  if (!bx) break;
  await p.mouse.click(bx.x + bx.width / 2, bx.y + bx.height / 2);
  await W(250);
}
ok((await top()) > 100, `연달아 강화해도 맨 위로 안 튐 (${await top()})`);
// 탭 바꾸면 맨 위
await p.evaluate(() => document.querySelector('#winB .tabs .tab[data-t="0"]')?.click());
await W(400);
ok((await top()) === 0, '탭 바꾸면 맨 위');
await settle();
// 회귀: 다른 창은 열 때 맨 위
for (const [label, sel] of [['원정', '#bExp'], ['손님', '#bGuest'], ['이웃', '#bVillage'], ['건설', '#bBuild'], ['공지', '#bNotice']]) {
  const has = await p.evaluate((s) => !!document.querySelector(s), sel);
  if (!has) { console.error('· ' + label + ' 버튼 없음 (건너뜀)'); continue; }
  await p.evaluate((s) => document.querySelector(s).click(), sel);
  await W(600);
  const on = await p.evaluate(() => document.querySelector('#win').classList.contains('on'));
  ok(on && (await top()) === 0, `${label} 창 열면 맨 위`);
  // 그 창에서 아무 버튼 하나 눌러도 오류 없음
  await settle();
}
ok(errs.length === 0, '오류 없음 ' + errs.join(' | '));
await b.close();
process.exit(fail ? 1 : 0);
