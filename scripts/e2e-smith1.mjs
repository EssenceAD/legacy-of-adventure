// SMITH §1 e2e (smithOne 한 화면판 · flags.json smithOne 켬): 대장간 「장비 손질」에서
//  1) 가방 장비 카드 → 아래쪽 장비 골라 아래로 스크롤 → [강화] 누름 → 스크롤 그대로 · 누른 버튼(#smoGo)이 화면 안 · 반짝
//     · 연달아 눌러도 맨 위로 안 튐
//  2) 영웅 바꾸기 = 같은 탭 다시 그리기 → 세로 스크롤·영웅 줄 가로 스크롤 그대로 (고른 카드가 화면 안)
//     · 칸 바꾸기도 그대로 · 탭(장비 손질 → 제작 → 장비 손질) 바꾸면 맨 위 = smithOne 의 「맨 위」
//  3) 회귀: 다른 창(원정·손님·이웃·건설·공지)은 열 때 맨 위
//  4) 오류 없음
//  뺀 검사 (예전 탭 창 전용 · smithOne 에는 뜻 없음): 「강화 탭」 고르기([data-t="1"]) · [data-enh] 줄 목록 · 줄(.irow) 반짝
//   → 강화는 장비마다 줄이 아니라 행동 판 하나(#smoGo)라서 「아래쪽 줄」 = 가방 아래쪽 장비 + 판의 버튼으로 바꿈
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
  localStorage.setItem('legacy-of-adventure-telemetry', 'false');
  localStorage.setItem('legacy-of-adventure-sound', JSON.stringify({ bgmOn: false, bgmVol: 0.4, sfxOn: false, sfxVol: 0.7, muted: true }));
}, JSON.stringify(save));
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
p.on('dialog', (d) => d.accept());
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
/** 마을 해설(#dlg)이 창 위를 덮으면 누르기를 가로챈다 → 대화만 넘겨 닫는다 (창은 그대로) */
const clearDlg = () => p.evaluate(async () => {
  const T = (ms) => new Promise((r) => setTimeout(r, ms));
  const d = document.querySelector('#dlg');
  for (let i = 0; i < 40 && d && !d.hidden; i++) { d.click(); await T(120); }
});
const top = () => p.evaluate(() => document.querySelector('#winB').scrollTop);
const inView = (sel) => p.evaluate((s) => {
  const e = document.querySelector(s);
  if (!e) return false;
  const r = e.getBoundingClientRect();
  const w = (e.closest('#winF') ?? document.querySelector('#winB')).getBoundingClientRect();
  return r.height > 0 && r.top >= w.top - 1 && r.bottom <= w.bottom + 1;
}, sel);
/** 사람처럼 누르기 (해설 닫고 · 그 자리 마우스 클릭 → pointerdown 이 「방금 누른 것」을 잡는다) */
const press = async (sel) => {
  await clearDlg();
  const bx = await p.locator(sel).first().boundingBox();
  if (!bx) return false;
  await p.mouse.click(bx.x + bx.width / 2, bx.y + bx.height / 2);
  return true;
};
await p.goto(process.env.URL ?? 'http://localhost:4190/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__S, null, { timeout: 20000 });
await W(1500);
await p.locator('#tCont').click();
await W(3000);
await settle();
// 가루·재료·금화 넉넉히 · 대장간 열기 (smithOne)
await p.evaluate(() => {
  const P = window.__P;
  for (const k of Object.keys(P.dust)) P.dust[k] = 1e6;
  for (const k of Object.keys(P.mats)) P.mats[k] = 1e5;
  for (const k of Object.keys(P.bossMats)) P.bossMats[k] = 1e5;
  window.__S.gold = 1e9;
  window.__showObj(window.__world.objs.find((x) => x.kind === 'smith'));
});
await W(700);
await clearDlg();
ok(await p.evaluate(() => !!document.querySelector('#winB .smo-heroes') && document.querySelectorAll('#smT .tab').length === 3), '대장간 = smithOne 한 화면 (영웅 줄 + 탭 3개)');

// ── 1) 가방 장비 → 아래쪽 장비 → 아래로 스크롤 → 강화
await press('.smo-heroes [data-hb]');
await W(400);
const nBag = await p.evaluate(() => document.querySelectorAll('#winB .smo-bag [data-bi]').length);
ok(nBag >= 6, `가방 장비 ${nBag}개`);
// 아래쪽(70%) 장비 가운데 +9 미만 · 안 잠긴 것 (강화 판이 뜨는 것)
const pick = await p.evaluate(() => {
  const ids = [...document.querySelectorAll('#winB .smo-bag [data-bi]')].map((x) => +x.dataset.bi);
  const can = ids.filter((id) => { const it = window.__P.bag.find((x) => x.id === id); return it && it.enh < 9 && !it.locked; });
  return can[Math.floor(can.length * 0.7)] ?? null;
});
ok(pick != null, `아래쪽 장비 골라짐 (#${pick})`);
await p.evaluate((id) => document.querySelector(`#winB [data-bi="${id}"]`).scrollIntoView({ block: 'center' }), pick);
await W(200);
await press(`#winB [data-bi="${pick}"]`);
await W(400);
ok(await p.evaluate((id) => !!document.querySelector(`#winB [data-bi="${id}"]`)?.classList.contains('smo-on'), pick), '고른 장비 표시 (smo-on)');
const label = await p.evaluate(() => document.querySelector('#smoGo')?.textContent ?? '');
ok(/^강화 \+\d+ · 성공/.test(label) && (await p.evaluate(() => document.querySelector('#smoGo')?.getAttribute('aria-disabled') !== 'true')), `행동 판 [${label}] (막힘 아님)`);
await p.evaluate(() => document.querySelector('#smoGo').scrollIntoView({ block: 'center' }));
await W(300);
const before = await top();
ok(before > 100, `스크롤 내려감 (${before})`);
const enh0 = await p.evaluate((id) => window.__P.bag.find((x) => x.id === id).enh, pick);
await press('#smoGo');
await W(120);
const after = await top();
const flash = await p.evaluate(() => !!document.querySelector('#smoGo')?.closest('.irow, .row, li, #smoGo')?.classList.contains('flash'));
ok(Math.abs(after - before) < 60, `강화 뒤 스크롤 유지 (${before} → ${after})`);
ok(await inView('#smoGo'), '누른 [강화] 버튼이 화면 안');
ok(flash, '누른 버튼 반짝');
ok(await p.evaluate((id) => !!document.querySelector(`#winB [data-bi="${id}"].smo-on`) && !!document.querySelector('#smoPanel'), pick), '판이 같은 장비 그대로');
await W(700);
// 연달아 3번 더
let presses = 1;
for (let i = 0; i < 3; i++) {
  if (await p.evaluate(() => document.querySelector('#smoGo')?.getAttribute('aria-disabled') === 'true')) break;
  if (!(await press('#smoGo'))) break;
  presses++;
  await W(350);
}
const enh1 = await p.evaluate((id) => window.__P.bag.find((x) => x.id === id)?.enh, pick);
const t3 = await top();
ok(t3 > 100 && (await inView('#smoGo')), `연달아 ${presses}번 강화해도 맨 위로 안 튐 (${t3}) · +${enh0} → +${enh1}`);

// ── 2) 영웅·칸 바꾸기 = 그대로 · 탭 바꾸기 = 맨 위
// 영웅 줄 끝 쪽 영웅 → 누르면 영웅 줄 가로 스크롤 그대로 · 그 카드 화면 안
const hc = await p.evaluate(() => {
  const cs = [...document.querySelectorAll('#winB .smo-heroes [data-hc]')];
  const c = cs[Math.max(0, cs.length - 2)];
  c?.scrollIntoView({ block: 'nearest', inline: 'center' });
  return c ? c.dataset.hc : null;
});
await W(200);
const pos = () => p.evaluate(() => { const b = document.querySelector('#winB'); const r = document.querySelector('#winB .smo-heroes'); return { left: r.scrollLeft, wide: r.scrollWidth > r.clientWidth + 4, top: b.scrollTop, max: b.scrollHeight - b.clientHeight }; });
const row0 = await pos();
await press(`#winB .smo-heroes [data-hc="${hc}"]`);
await W(400);
const row1 = await pos();
ok(await p.evaluate((h) => document.querySelector('#winB .smo-heroes .hcd.on')?.dataset.hc === h, hc), `영웅 ${hc} 골라짐`);
ok(Math.abs(row1.left - row0.left) < 4, `영웅 바꿔도 영웅 줄 가로 스크롤 그대로 (${row0.left} → ${row1.left}${row0.wide ? '' : ' · 줄이 한 화면에 다 들어감'})`);
// 세로: 같은 탭 다시 그리기라 스크롤을 그대로 두되, 새 영웅 화면이 더 짧으면 그 끝까지만 (일부러 맨 위로 되돌리지 않음)
ok(Math.abs(row1.top - Math.min(row0.top, row1.max)) < 60, `영웅 바꿔도 창이 위아래로 안 튐 (${row0.top} → ${row1.top} · 새 화면 끝 ${row1.max})`);
ok(await inView('#winB .smo-heroes .hcd.on'), '고른 영웅 카드가 화면 안');
// 칸 바꾸기: 다른 칸 눌러도 그대로
const sl = await p.evaluate(() => [...document.querySelectorAll('#winB .smo-slot[data-sl]:not(.on)')].at(-1)?.dataset.sl ?? null);
if (sl) {
  await p.evaluate((s) => document.querySelector(`#winB .smo-slot[data-sl="${s}"]`).scrollIntoView({ block: 'center' }), sl);
  await W(200);
  const s0 = await top();
  await press(`#winB .smo-slot[data-sl="${sl}"]`);
  await W(400);
  const s1 = await top();
  ok(Math.abs(s1 - s0) < 60 && (await p.evaluate((s) => document.querySelector('#winB .smo-slot.on')?.dataset.sl === s, sl)), `칸(${sl}) 바꿔도 스크롤 그대로 (${s0} → ${s1})`);
} else console.error('· 다른 칸 없음 (건너뜀)');
// 탭: 제작 → 맨 위 · 다시 장비 손질 → 맨 위 (탭 줄을 창 맨 위에 붙도록 내려 두고 누름 — 머리 줄·할 만한 것만큼 내려가 있음)
const downToTabs = () => p.evaluate(() => { const b = document.querySelector('#winB'); b.scrollTop = 9999; document.querySelector('#smT').scrollIntoView({ block: 'start' }); return b.scrollTop; });
await press('.smo-heroes [data-hb]'); // 긴 화면(가방 장비)에서 시작해야 스크롤이 생김
await W(400);
const tabPre = await downToTabs();
ok(tabPre > 0, `탭 누르기 전 내려가 있음 (${tabPre})`);
await press('#smT .tab[data-t="1"]');
await W(400);
ok((await top()) === 0 && (await p.evaluate(() => document.querySelector('#smT .tab.on')?.dataset.t === '1')), '탭 바꾸면(제작) 맨 위');
console.error(`· 탭 누르기 전 스크롤 ${await downToTabs()}`);
await press('#smT .tab[data-t="0"]');
await W(400);
ok((await top()) === 0 && (await p.evaluate(() => !!document.querySelector('#winB .smo-heroes'))), '장비 손질로 돌아와도 맨 위');
await settle();

// ── 3) 회귀: 다른 창은 열 때 맨 위
for (const [lab, sel] of [['원정', '#bExp'], ['손님', '#bGuest'], ['이웃', '#bVillage'], ['건설', '#bBuild'], ['공지', '#bNotice']]) {
  const has = await p.evaluate((s) => !!document.querySelector(s), sel);
  if (!has) { console.error('· ' + lab + ' 버튼 없음 (건너뜀)'); continue; }
  await p.evaluate((s) => document.querySelector(s).click(), sel);
  await W(600);
  const on = await p.evaluate(() => document.querySelector('#win').classList.contains('on'));
  ok(on && (await top()) === 0, `${lab} 창 열면 맨 위`);
  await settle();
}
// ── 4)
ok(errs.length === 0, '오류 없음 ' + errs.join(' | '));
await b.close();
console.error(fail ? `✗ ${fail}개 실패` : '✓ e2e-smith1 통과');
process.exit(fail ? 1 : 0);
