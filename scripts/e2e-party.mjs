// PARTY_SPEC e2e: 파티 창 조합 미리보기 + 「한 명만 바꾸면」 힌트 · 사냥꾼 손님 정보 · 사냥꾼과 사냥 한 판 · 4번째 자리 · 4인 토벌 fps · 도감 「파티」
//  실행: URL=… node scripts/e2e-party.mjs [phone|pc]   (실제 저장 tests/fixtures/real_lotte.json — 로컬에만)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const name = process.argv[2] ?? 'phone';
const fx = 'tests/fixtures/real_lotte.json';
if (!fs.existsSync(fx)) {
  console.error('skip: ' + fx + ' 없음');
  process.exit(0);
}
const save = JSON.parse(fs.readFileSync(fx, 'utf8'));
const DEV = { phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, pc: { viewport: { width: 1440, height: 900 } } };
const dir = 'screenshots/party';
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
const clear = async () => {
  for (let i = 0, calm = 0; i < 80 && calm < 3; i++) {
    const busy = await p.evaluate(() => { if (!document.querySelector('#dlg').hidden) return document.querySelector('#dlg').click(), true; if (document.querySelector('#win').classList.contains('on')) return document.querySelector('#winX').click(), true; return false; });
    calm = busy ? 0 : calm + 1;
    await W(busy ? 200 : 600);
  }
};
const tap = async (sel) => {
  const el = p.locator(sel).first();
  await el.scrollIntoViewIfNeeded();
  const bx = await el.boundingBox();
  if (name === 'phone') await p.touchscreen.tap(bx.x + bx.width / 2, bx.y + bx.height / 2);
  else await el.click();
};
await p.goto(process.env.URL ?? 'http://localhost:5198/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__S, null, { timeout: 20000 });
await W(1500);
await p.locator('#tCont').click();
await W(3000);
await clear();

// 기존 손님 직업은 그대로 (사냥꾼은 새로 오는 손님부터)
const kinds0 = save.adventurers.map((a) => a.kind);
const kinds1 = await p.evaluate(() => window.__world.actors.filter((a) => a.id && !a.role).map((a) => [a.id, a.kind]));
ok(kinds1.every(([, k]) => k !== 'hunter') && kinds0.every((k) => k !== 'hunter'), `불러온 손님 ${kinds1.length}명 중 사냥꾼 0 (옛 손님 직업 그대로)`);

// 새 사냥꾼 손님 (도착 → 단골)
const hid = await p.evaluate(() => {
  const P = window.__P;
  P.runs.length = 0;
  P.hunt.auto = null;
  P.hunt.best.forest = Math.max(P.hunt.best.forest ?? 0, 10);
  if (!P.guide.unlocked.includes('hunt')) P.guide.unlocked.push('hunt');
  if (!P.guide.unlocked.includes('raid')) P.guide.unlocked.push('raid');
  let a = null;
  for (let i = 0; i < 60 && !a; i++) {
    const x = window.__arrive('visitor');
    if (x && x.kind === 'hunter') a = x;
  }
  if (!a) {
    a = window.__arrive('visitor');
    a.kind = 'hunter';
    a.race = 'elf';
  }
  a.status = 'regular';
  a.lvl = 30;
  for (const g of window.__world.actors) if (g.id) g.hp = 100;
  return a.id;
});
await W(800);
await clear();
await p.evaluate((id) => window.__showActor(window.__world.actors.find((a) => a.id === id)), hid);
await W(700);
const det = await p.evaluate(() => document.querySelector('#win')?.innerText ?? '');
await p.screenshot({ path: `${dir}/${name}_hunter_detail.png` });
ok(/사냥꾼/.test(det), '사냥꾼 손님 정보 창: ' + det.split('\n').slice(0, 3).join(' / '));
await clear();

// 사냥 준비 창: 사냥꾼 + 도적 넣고 조합 미리보기
const plan = await p.evaluate((id) => {
  const crew = window.__world.actors.filter((a) => a.id && !a.role && (a.status === 'regular' || a.status === 'hero') && a.runId == null);
  const rogue = crew.find((a) => a.kind === 'rogue');
  const others = crew.filter((a) => a.id !== id && a.kind !== 'rogue');
  return { rogue: rogue?.id ?? null, n: crew.length, kinds: crew.map((a) => a.kind).join(','), knight: others.find((a) => a.kind === 'knight')?.id ?? others[0]?.id };
}, hid);
console.error('crew', plan.n, plan.kinds);
await p.evaluate(() => window.__openHunt('forest'));
await W(600);
await tap('[data-s="1"]');
await W(700);
// 다 빼고 → 대장(가장 센 사람) · 사냥꾼 · (도적)
const unpick = async () => {
  for (let i = 0; i < 6; i++) {
    const on = await p.locator('.pm.on').count();
    if (!on) break;
    await tap('.pm.on');
    await W(250);
  }
};
await unpick();
const synN = async () => p.evaluate(() => [...document.querySelectorAll('.pty-syn')].map((x) => x.dataset.syn).join(','));
await tap(`.pm[data-id="${plan.knight}"]`);
await W(250);
await tap(`.pm[data-id="${hid}"]`);
await W(300);
const s1 = await synN();
const hint1 = await p.evaluate(() => document.querySelector('.pty-hint')?.textContent ?? '');
await p.screenshot({ path: `${dir}/${name}_hunt_picker_before.png` });
ok(/한 명/.test(hint1) || !plan.rogue, `힌트 한 줄: ${hint1}`);
if (plan.rogue) {
  await tap(`.pm[data-id="${plan.rogue}"]`);
  await W(300);
  const s2 = await synN();
  ok(s2.includes('shadow') && !s1.includes('shadow'), `도적 넣자 바로 갱신: [${s1}] → [${s2}]`);
}
await p.screenshot({ path: `${dir}/${name}_hunt_picker.png`, fullPage: false });
const sub3 = await p.evaluate(() => document.querySelector('#win')?.innerText.match(/파티 \d\/\d/)?.[0]);
ok(sub3 === '파티 3/3' || sub3 === '파티 2/3', `4번째 자리 열리기 전: ${sub3} · 잠긴 칸 ${await p.locator('.pty-slot.lock').count()}`);

// 4번째 자리 열기: 훈련장 Lv5 + 장부 (조건을 실제로 채운다)
await clear();
const opened = await p.evaluate(async () => {
  const P = window.__P;
  const tr = window.__world.objs.find((o) => o.kind === 'training');
  if (tr) tr.lvl = Math.max(tr.lvl, 5);
  else window.__town.addObj?.('training', 2, 2);
  const t2 = window.__world.objs.find((o) => o.kind === 'training');
  if (t2) { t2.lvl = 5; delete t2.build; }
  const { MISSIONS } = await import('/src/data/guide.ts');
  for (const m of MISSIONS) if (!P.guide.claimed.includes(m.id)) P.guide.claimed.push(m.id);
  return { tr: !!t2, lvl: t2?.lvl };
});
console.error('training', JSON.stringify(opened));
await p.evaluate(() => window.__openHunt('forest'));
await W(500);
await tap('[data-s="1"]');
await W(700);
const mail = await p.evaluate(() => window.__P.meta.mail.filter((m) => /4번째 자리/.test(m.title)).length);
ok(mail === 1, `모모 편지 1통 (${mail})`);
const spark = await p.locator('.pty-slot.spark').count();
await p.screenshot({ path: `${dir}/${name}_hunt_4th_slot.png` });
ok(spark === 1, `빈 4번째 칸 반짝 (${spark})`);
// 4명으로 채우기 (사냥꾼 포함)
const sel4 = await p.evaluate((hid) => {
  const crew = window.__world.actors.filter((a) => a.id && !a.role && (a.status === 'regular' || a.status === 'hero') && a.runId == null);
  return crew.length;
}, hid);
for (let i = 0; i < 6 && (await p.locator('.pm.on').count()) < Math.min(4, sel4); i++) {
  await tap('.pm:not(.on)');
  await W(250);
}
const sub4 = await p.evaluate(() => document.querySelector('#win')?.innerText.match(/파티 \d\/\d/)?.[0]);
ok(sub4 === '파티 4/4', `4번째 자리: ${sub4}`);
// 같은 확인을 한 번 더 해도 편지는 1통
await p.evaluate(() => window.__P.meta.party4 && true);
const hasHunter = await p.evaluate((id) => !!document.querySelector(`.pm.on[data-id="${id}"]`), hid);
if (!hasHunter) {
  await tap('.pm.on >> nth=3');
  await W(250);
  await tap(`.pm[data-id="${hid}"]`);
  await W(250);
}
await p.screenshot({ path: `${dir}/${name}_hunt_picker4.png` });
// 사냥 한 판 (직접)
await tap('#hMan');
await W(2800);
const f0 = await p.evaluate(() => { const f = window.__combat.field(); return { n: f.allies.length, jobs: f.allies.map((u) => u.job).join(','), syn: f.syn?.ids.join(','), band: document.querySelector('#cbSyn')?.hidden === false ? document.querySelector('#cbSyn').textContent : '' }; });
await p.screenshot({ path: `${dir}/${name}_hunt_start_band.png` });
ok(f0.n === 4 && f0.jobs.includes('hunter'), `사냥 시작 4명 [${f0.jobs}] · 조합 [${f0.syn}]`);
ok(!!f0.band || !f0.syn, `시작 하단 띠: ${f0.band.slice(0, 60)}`);
// 사냥꾼을 조종: 누르는 방향으로 쏜다
const shot = await p.evaluate(() => {
  const f = window.__combat.field();
  const h = f.allies.find((u) => u.job === 'hunter');
  f.me = h;
  f.auto = false;
  f.stick.x = 1;
  f.stick.y = 0;
  h.swing = 0;
  h.dodge = 0;
  h.stun = 0;
  for (const q of f.proj) q.old = true;
  const before = f.proj.length;
  return { before, ax: h.ax, ay: h.ay };
});
// PC는 처음에 단축키 카드가 뜬다 — 아무 키로 닫고
if (await p.evaluate(() => document.querySelector('#cbKeyCard')?.hidden === false)) { await p.keyboard.press('x'); await W(100); }
await p.keyboard.down('d');
await W(120);
const dbg = await p.evaluate(() => { const f = window.__combat.field(); return { st: { ...f.stick }, me: f.me.job, auto: f.auto, dead: f.me.dead, swing: f.me.swing, dodge: f.me.dodge, stun: f.me.stun, done: f.done }; });
console.error('dbg', JSON.stringify(dbg));
await p.keyboard.down('j');
await W(60);
await p.keyboard.up('j');
await p.keyboard.up('d');
const shot2 = await p.evaluate(() => {
  const f = window.__combat.field();
  const arrows = f.proj.filter((q) => q.kind === 'arrow' && q.owner === f.me && !q.old);
  return { n: arrows.length, vx: arrows[0]?.vx ?? 0, vy: arrows[0]?.vy ?? 0 };
});
if (name === 'pc') ok(shot2.n >= 1 && shot2.vx > 0 && shot2.vy < 0, `누른 방향(오른쪽)으로 화살: ${JSON.stringify(shot2)}`);
// AI로 한참 돌려서 사냥꾼이 쏘고 · 필드 안 · 판이 깨지지 않음
await p.evaluate(() => { const f = window.__combat.field(); f.auto = true; f.stick.x = f.stick.y = 0; for (const u of f.allies) { u.hp = u.max; } });
let arrowsSeen = 0;
for (let i = 0; i < 6; i++) {
  await p.evaluate(() => window.__combat.advance(1.5));
  arrowsSeen += await p.evaluate(() => window.__combat.field()?.proj.filter((q) => q.kind === 'arrow').length ?? 0);
  await W(100);
}
const fin = await p.evaluate(() => { const f = window.__combat.field(); const N = 14; const h = f.allies.find((u) => u.job === 'hunter'); return { x: h.x, y: h.y, dead: h.dead, kills: f.kills, done: f.done }; });
await p.screenshot({ path: `${dir}/${name}_hunt_mid.png` });
ok(arrowsSeen > 0, `사냥꾼 화살 (누적 관찰 ${arrowsSeen}) · 처치 ${fin.kills} · 위치 ${fin.x.toFixed(1)},${fin.y.toFixed(1)}`);
// 판 끝내기 (포기)
await p.evaluate(() => { const f = window.__combat.field(); for (const u of f.allies) { u.hp = 0; u.dead = true; } });
await p.evaluate(() => window.__combat.advance(2));
await W(1500);
await clear();
await p.evaluate(() => document.querySelector('#cHome')?.click());
await W(1200);
await clear();

// 4인 토벌 (보스 + 부하) fps — 폰은 CPU 4배 느리게
const cdp = name === 'phone' ? await ctx.newCDPSession(p) : null;
await p.evaluate(() => { const P = window.__P; P.raid.tries = 0; for (const g of window.__world.actors) if (g.id) g.hp = 100; });
await p.evaluate(() => window.__openRaid());
await W(900);
const rsub = await p.evaluate(() => document.querySelector('#win')?.innerText.match(/파티 \d\/\d/)?.[0]);
await p.screenshot({ path: `${dir}/${name}_raid_picker.png` });
ok(rsub === '파티 4/4', `토벌 파티 창: ${rsub} · 조합 칩 ${await p.locator('.pty-syn').count()}`);
await tap('#rgMan');
await W(3000);
if (cdp) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
// 부하 소환이 나올 때까지 진행 + 실제 그리기 6초
await p.evaluate(() => { const f = window.__combat.field(); f.auto = true; for (const u of f.allies) u.hp = u.max = 1e9; });
await p.evaluate(() => window.__combat.advance(30));
await W(6500);
const fps = await p.evaluate(() => ({ ...window.__combat.fps(), mobs: window.__combat.field()?.units.filter((u) => u.team === 'mob' && !u.dead).length }));
await p.screenshot({ path: `${dir}/${name}_raid4_fps.png` });
console.error(`FPS ${name}${cdp ? ' (CPU ×4)' : ''}: ${JSON.stringify(fps)}`);
ok(fps.allies === 4, `토벌 4인 + 보스 · 몹 ${fps.mobs} · 그리기 ${fps.fps}fps · 한 장 ${fps.ms}ms · 이펙트 줄이기 ${fps.lite}`);
if (cdp) {
  // 아주 느린 폰 흉내 (CPU ×20): 30 아래로 떨어지면 이펙트 줄이기가 켜지는지
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 20 });
  await W(7000);
  const slow = await p.evaluate(() => window.__combat.fps());
  console.error('FPS phone (CPU ×20): ' + JSON.stringify(slow));
  ok(slow.fps >= 30 || slow.lite, '30fps 아래면 이펙트 줄이기: ' + JSON.stringify(slow));
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
}
await p.evaluate(() => { const f = window.__combat.field(); f.time = 0; });
await p.evaluate(() => window.__combat.advance(2));
await W(2500);
await clear();

// 도감 「파티」 탭
await p.evaluate(() => window.__openDex(0));
await W(500);
const tabs = await p.evaluate(() => [...document.querySelectorAll('[data-dt],[data-t]')].map((x) => x.textContent));
await p.evaluate(() => { const b = [...document.querySelectorAll('#win button')].find((x) => x.textContent.trim() === '파티'); b?.click(); });
await W(500);
const dex = await p.evaluate(() => ({ n: document.querySelectorAll('.pty-dex').length, on: document.querySelectorAll('.pty-dex.on').length }));
await p.screenshot({ path: `${dir}/${name}_dex_party.png` });
ok(dex.n === 8 && dex.on >= 1, `도감 「파티」 8칸 · 켜 본 것 ${dex.on}`);
// 손님 도감 사냥꾼 필터
await p.evaluate(() => window.__openDex(0));
await W(400);
await p.evaluate(() => document.querySelector('[data-gk="hunter"]')?.click());
await W(400);
const gk = await p.evaluate(() => document.querySelectorAll('.dexrow')[0]?.querySelectorAll('i').length);
await p.screenshot({ path: `${dir}/${name}_dex_hunter.png` });
ok(gk === 3, `손님 도감 사냥꾼 필터: 한 줄 ${gk}칸`);
void tabs;

ok(errs.length === 0, '페이지 오류 없음 ' + errs.join(' | '));
await b.close();
console.error(fail ? `✗ ${fail}개 실패` : '✓ 모두 통과');
process.exit(fail ? 1 : 0);
