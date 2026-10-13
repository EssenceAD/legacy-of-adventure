// GOLDSINK B e2e (실세이브 · 심연의 바닥 10을 깬 따밤): 사냥 탭 「끝없는 심연」 → 첫 입장 내레이션 → 1층 돌파(보상·계속 오르기) → 2층 패배 → 이어하기(버나드)
//  + 밤 · 그롬 → 「주사위 한 판?」 → 판돈 → 한 판 끝까지 (씨앗 난수 · 그롬 빨리)
//  실행: URL=http://localhost:5202/ SAVE=<저장 json> node scripts/e2e-goldsinkb.mjs [phone|pc]   (개발 서버 · 저장이 없으면 건너뜀)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const name = process.argv[2] ?? 'phone';
const FIX = process.env.SAVE ?? 'tests/fixtures/real_gs_ttabam.json';
if (!fs.existsSync(FIX)) {
  console.error('실세이브가 없어 건너뜀');
  process.exit(0);
}
const save = fs.readFileSync(FIX, 'utf8');
const DEV = { phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, pc: { viewport: { width: 1440, height: 900 } } };
const dir = 'screenshots/goldsinkb';
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
}, save);
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
    await W(busy ? 200 : 500);
  }
};
const dlgText = () => p.evaluate(() => (document.querySelector('#dlg').hidden ? '' : document.querySelector('#dText').textContent));
const readDlg = async () => {
  await W(300);
  await p.evaluate(() => !document.querySelector('#dlg').hidden && document.querySelector('#dlg').click());
  await W(200);
  return dlgText();
};
await p.goto(process.env.URL ?? 'http://localhost:5202/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__S, null, { timeout: 20000 });
await W(1500);
await p.locator('#tCont').click();
await W(3000);
await settle();
await p.evaluate(() => {
  window.__P.hunt.auto = null;
  window.__S.gold = 50_000_000;
  for (const a of window.__world.actors) if (a.id) a.hp = 100;
});

// ───── §7 끝없는 심연 ─────
await p.evaluate(() => window.__openHunt('deep'));
await W(600);
ok((await p.locator('#hAbyss').count()) === 1, '사냥 탭 맨 끝 「끝없는 심연」');
await p.screenshot({ path: `${dir}/${name}_hunt_tab.png` });
await p.locator('#hAbyss').click();
const narr = await readDlg();
ok(/바닥이라 믿었던 곳 아래에/.test(narr), '첫 입장 내레이션: ' + narr.slice(0, 24));
for (let i = 0; i < 4 && (await dlgText()); i++) await p.evaluate(() => document.querySelector('#dlg').click()), await W(250);
await W(500);
ok((await p.locator('#winT').textContent()) === '끝없는 심연', '심연 창');
await p.screenshot({ path: `${dir}/${name}_abyss_win.png` });
await p.evaluate(() => { const c = document.getElementById('abAuto'); if (c.checked) c.click(); });
const d0 = await p.evaluate(() => [window.__P.dust.n, window.__S.gold, window.__S.ledger.dungeon]);
await p.locator('#abNew').click();
await p.waitForFunction(() => !!window.__combat.field(), null, { timeout: 10000 });
const f1 = await p.evaluate(() => { const f = window.__combat.field(); return { rec: f.rec, stage: f.stage, fold: !!document.querySelector('#cbFold') }; });
ok(f1.stage === 9 && !f1.fold, `1층 = 보스 아닌 판 · 접기 없음 (추천 ${f1.rec})`);
await p.evaluate(() => { for (const u of window.__combat.field()?.allies ?? []) { u.max = 1e9; u.hp = 1e9; } });
await W(1200);
await p.evaluate(() => { const f = window.__combat.field(); f.kills = f.killGoal; });
await W(2500);
await p.evaluate(() => { const f = window.__combat.field(); const e = f.elite; if (e) { e.hp = 0; e.dead = true; } });
await p.waitForFunction(() => !!document.querySelector('#cbRes #abNext'), null, { timeout: 15000 });
const res1 = await p.locator('#cbRes').textContent();
ok(/끝없는 심연 1층 돌파/.test(res1) && /잿빛 가루 \+22/.test(res1), '1층 결과 · 잿빛 가루 +22');
const d1 = await p.evaluate(() => [window.__P.dust.n, window.__S.gold, window.__P.gs.abyss.best, window.__P.gs.abyss.weekBest, window.__S.ledger.dungeon]);
ok(d1[0] - d0[0] >= 22 && d1[4] === d0[2] && d1[2] === 1 && d1[3] === 1, `금화 그대로 · 최고 1층 · 주간 1층 (${d1})`);
await p.screenshot({ path: `${dir}/${name}_abyss_f1.png` });
await p.locator('#cbRes #abNext').click();
await p.waitForFunction(() => window.__combat.field()?.stage === 9 && !window.__combat.field()?.done, null, { timeout: 10000 });
const rec2 = await p.evaluate(() => window.__combat.field().rec);
ok(Math.abs(rec2 / f1.rec - 1.07) < 0.01, `2층 강함 ×1.07 (${rec2})`);
// 2층: 지기
await p.evaluate(() => { for (const u of window.__combat.field()?.allies ?? []) { u.hp = 0; u.dead = true; } });
await p.waitForFunction(() => !!document.querySelector('#cbRes #abCont2'), null, { timeout: 15000 });
ok((await p.evaluate(() => window.__P.gs.abyss.lost)) === 2, '2층에서 짐 → 이어하기 자리 2층');
await p.screenshot({ path: `${dir}/${name}_abyss_lose.png` });
const g0 = await p.evaluate(() => window.__S.gold);
await p.locator('#cbRes #abCont2').click();
const bern = await readDlg();
ok(/다시 내려가겠다고/.test(bern), '버나드 (이어하기): ' + bern.slice(0, 20));
for (let i = 0; i < 4 && (await dlgText()); i++) await p.evaluate(() => document.querySelector('#dlg').click()), await W(250);
await p.waitForFunction(() => !!window.__combat.field() && !window.__combat.field().done, null, { timeout: 10000 });
const g1 = await p.evaluate(() => [window.__S.gold, Math.round(window.__combat.field().rec)]);
ok(g0 - g1[0] === Math.round(5000 * 1.15 ** 2) && g1[1] === rec2, `이어하기 −${g0 - g1[0]} G · 2층부터`);
await p.evaluate(() => document.querySelector('#cbQuit')?.click());
await W(800);
await p.evaluate(() => { const y = [...document.querySelectorAll('button')].find((x) => /포기/.test(x.textContent) && x.offsetParent); y?.click(); });
await W(1500);
await p.evaluate(() => document.querySelector('#cbRes #abHome2')?.click());
await W(800);
await settle();

// ───── §8 주사위 (밤 · 그롬) ─────
await p.evaluate(() => {
  window.__S.night = true;
  window.__dice.seed(42);
  window.__dice.speed(30);
});
const hasGrom = await p.evaluate(() => window.__world.actors.some((a) => a.legendId === 'grom'));
ok(hasGrom, '그롬이 마을에 있음');
await p.evaluate(() => window.__pmenu(window.__world.actors.find((a) => a.legendId === 'grom'), 200, 500));
await W(300);
ok((await p.locator('#pmDice').count()) === 1, '그롬 메뉴 「주사위 한 판?」');
await p.screenshot({ path: `${dir}/${name}_grom_menu.png` });
await p.locator('#pmDice').click();
await W(500);
ok(/지는 쪽이 오늘 술값이다/.test(await p.locator('.dsay').textContent()), '그롬 시작 대사');
await p.screenshot({ path: `${dir}/${name}_dice_stake.png` });
const s0 = await p.evaluate(() => window.__S.gold);
await p.locator('[data-dm="2"]').click();
await W(300);
const stake = s0 - (await p.evaluate(() => window.__S.gold));
ok(stake === 2000 * 512, '판돈 ×2 = ' + stake);
let busted = false;
let shot = false;
for (let i = 0; i < 400; i++) {
  const st = await p.evaluate(() => { const g = window.__dice.game(); return g ? { w: g.winner, t: g.turn, roll: g.roll.length, last: g.last, pts: g.turnPts } : null; });
  if (!st || st.w >= 0) break;
  if (st.t === 1) { await W(150); continue; }
  if (st.last === 'bust') {
    busted = true;
    ok(/꽝이다, 꽝/.test(await p.locator('.dsay').textContent()), '꽝 대사');
    await p.locator('#dPass').click();
  } else if (!st.roll) {
    if (st.pts > 350) await p.locator('#dBank').click();
    else await p.locator('#dRoll').click();
  } else {
    await p.locator('#dAll').click();
    if (!shot) await p.screenshot({ path: `${dir}/${name}_dice_play.png` }), (shot = true);
    await p.locator(st.pts >= 300 ? '#dKB' : '#dKR').click();
  }
  await W(80);
}
await W(500);
const end = await p.evaluate(() => { const g = window.__dice.game(); return { w: g.winner, sc: g.scores, gold: window.__S.gold, rec: window.__P.gs.dice }; });
ok(end.w >= 0 && Math.max(...end.sc) >= 3000, `한 판 끝 (${end.sc}) · ${end.w === 0 ? '이김' : '짐'} · 꽝 ${busted ? '있음' : '없음'}`);
const net = end.gold - (s0 - stake);
ok(Math.abs(net - (end.w === 0 ? Math.round(stake * 1.8) : 0)) < 5000, '금화 정산 (판돈 × 2 − 10%)');
ok((await p.locator('.dend').count()) === 1 && /드워프 손목|기울었어|마법/.test(await p.locator('.dsay').textContent()), '끝 대사');
await p.screenshot({ path: `${dir}/${name}_dice_end.png` });
// 낮엔 메뉴에 없음
await p.locator('#dQuit').click();
await W(300);
await p.evaluate(() => { window.__S.night = false; window.__pmenu(window.__world.actors.find((a) => a.legendId === 'grom'), 200, 500); });
await W(300);
ok((await p.locator('#pmDice').count()) === 0, '낮엔 주사위 없음');
ok(!errs.length, '페이지 오류 없음 ' + errs.join(' | '));
await b.close();
console.error(fail ? `✗ ${fail}개 실패` : '✓ 모두 통과');
process.exit(fail ? 1 : 0);
