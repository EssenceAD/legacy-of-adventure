// SMITH §2·§3 e2e: 대장간 강화 탭 [일괄 강화…] → 대상·목표·예산·미리보기 → 시작 → 요약(실제 차감과 같음) · 줄마다 「+5까지」 · 제작 [5]·[최대]·세트 맞추기 요약 카드 · 초월 탭 [일괄 초월…]
//  실행: URL=… node scripts/e2e-bulk.mjs [phone|pc] → screenshots/bulk/*.png
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const name = process.argv[2] ?? 'phone';
const save = JSON.parse(fs.readFileSync('tests/fixtures/lotte_dupe.json', 'utf8'));
const DEV = { phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, pc: { viewport: { width: 1440, height: 900 } } };
const dir = 'screenshots/bulk';
fs.mkdirSync(dir, { recursive: true });
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
const click = (s) => p.evaluate((s) => document.querySelector(s)?.click(), s);
const dustSum = () => p.evaluate(() => Object.values(window.__P.dust).reduce((s, v) => s + v, 0));
const openSmith = async (tab) => {
  await p.evaluate(() => window.__showObj(window.__world.objs.find((o) => o.kind === 'smith')));
  await W(600);
  await click(`#winB .tabs .tab[data-t="${tab}"]`);
  await W(400);
};

await p.goto(process.env.URL ?? 'http://localhost:4190/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__S, null, { timeout: 20000 });
await W(1500);
await p.locator('#tCont').click();
await W(3000);
await settle();
await p.evaluate(() => {
  const P = window.__P;
  window.__S.gold = 5_000_000;
  for (const k of Object.keys(P.dust)) P.dust[k] = 50_000;
  Object.assign(P.mats, { forest: 2000, swamp: 2000, mine: 2000, ice: 2000, abyss: 2000 });
  P.bossMats = { boar: 50, mushroom: 50, golem: 50, wyvern: 50, eye: 50 };
  const s = window.__world.objs.find((o) => o.kind === 'smith');
  s.lvl = Math.max(s.lvl, 5);
  for (const it of P.bag) it.enh = Math.min(it.enh, 3);
});

// ── 일괄 강화
await openSmith(1);
ok(await p.evaluate(() => !!document.querySelector('#bulkEnh')), '강화 탭 위 [일괄 강화…]');
ok(await p.evaluate(() => [...document.querySelectorAll('#winB button.to')].some((b) => /\+5까지/.test(b.textContent))), '줄마다 「+5까지」');
await click('#bulkEnh');
await W(500);
await click('[data-bt="bag"]');
await W(400);
const prev = await p.evaluate(() => document.querySelector('.bprev')?.textContent ?? '');
ok(/대상 \d+개/.test(prev) && /가루/.test(prev), '미리보기: ' + prev.slice(0, 60));
await p.screenshot({ path: `${dir}/${name}_01_setup.png` });
const d0 = await dustSum();
await click('#bGo');
await W(900);
await p.screenshot({ path: `${dir}/${name}_02_running.png` });
for (let i = 0; i < 120 && !(await p.evaluate(() => !!document.querySelector('#bEnd'))); i++) await W(300);
const sum = await p.evaluate(() => document.querySelector('.bulkw .sub')?.textContent ?? '');
const spent = +(sum.match(/가루 −([\d,]+)/)?.[1] ?? '0').replace(/,/g, '');
const real = d0 - (await dustSum());
ok(/끝!/.test(sum) && spent === real, `요약 「${sum.slice(0, 70)}」 · 가루 실제 −${real}`);
ok(await p.evaluate(() => window.__P.bag.filter((it) => it.enh >= 5).length > 0), '+5 도달 장비 있음');
await p.screenshot({ path: `${dir}/${name}_03_summary.png` });
await click('#bEnd');
await W(500);
// 「+N까지」 한 줄
const one = await p.evaluate(() => { const b = document.querySelector('#winB button.to:not([disabled])'); if (!b) return null; const id = +b.dataset.to; const g = +b.dataset.g; b.click(); return { id, g }; });
await W(500);
if (one) ok(await p.evaluate(({ id, g }) => window.__P.bag.find((x) => x.id === id).enh >= Math.min(g, 5), one), `「+${one.g}까지」 한 번에`);
// 멈춤
await click('#bulkEnh');
await W(400);
await p.evaluate(() => { const r = document.querySelector('#bGoal'); r.value = 10; r.dispatchEvent(new Event('change')); });
await W(300);
await click('[data-bt="bag"]');
await W(300);
await click('#bGo');
await W(500);
await click('#bStop');
await W(400);
ok(/멈췄어요/.test(await p.evaluate(() => document.querySelector('.bulkw .sub')?.textContent ?? '')), '멈춤 버튼');
await click('#bEnd');
await W(400);

// ── 일괄 제작
await openSmith(2);
const maxTxt = await p.evaluate(() => document.querySelector('[data-cs][data-n="max"]')?.textContent ?? '');
ok(/최대 \d+/.test(maxTxt), '제작 [1] [5] [최대]: ' + maxTxt);
const bag0 = await p.evaluate(() => window.__P.bag.length);
await click('[data-cs="weapon"][data-n="5"]');
await W(600);
const card = await p.evaluate(() => ({ t: document.querySelector('#winT')?.textContent, n: document.querySelectorAll('.cmade .cm').length, best: !!document.querySelector('.cm.best') }));
ok(card.t === '제작 결과' && card.n === 5 && card.best, `요약 카드 ${card.n}개 · 가장 좋은 것 표시`);
ok((await p.evaluate(() => window.__P.bag.length)) === bag0 + 5, '가방 +5');
await p.screenshot({ path: `${dir}/${name}_04_craft.png` });
await click('#cmOk');
await W(400);
await openSmith(2);
const setInfo = await p.evaluate(() => { const b = document.querySelector('#cSet'); return { dis: b.disabled, t: b.textContent }; });
if (!setInfo.dis) {
  await click('#cSet');
  await W(600);
  ok(await p.evaluate(() => document.querySelector('#winT')?.textContent === '제작 결과'), '세트 맞추기 → 요약 카드');
} else ok(/없는 부위 0개/.test(setInfo.t), '세트 맞추기: 다 있으면 잠김 · ' + setInfo.t);
await settle();

// ── 초월 탭
await p.evaluate(() => { const it = window.__P.bag[0]; it.enh = 10; });
await openSmith(3);
ok(await p.evaluate(() => !!document.querySelector('#bulkTr')), '초월 탭 [일괄 초월…]');
await click('#bulkTr');
await W(400);
ok(await p.evaluate(() => +document.querySelector('#bGoal').min === 11), '일괄 초월 목표 +11~');
await p.screenshot({ path: `${dir}/${name}_05_trans.png` });
await settle();
ok(errs.length === 0, '오류 없음 ' + errs.join(' | '));
await b.close();
process.exit(fail ? 1 : 0);
