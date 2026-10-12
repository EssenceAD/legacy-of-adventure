// DECO_DROP e2e: 땅 단계별 열리는 장식 수 · 건설 버튼 NEW 배지 → 창을 열면 사라짐 · 묶음 탭 · 사기 + 이어 놓기 · 금화 · 오늘의 목표
//  · 장식 도감 (컬러/실루엣 · 보상) · 보관함에 넣어도 도감 유지 · 눈사람(겨울만) · 특별 장식 탭 · 불꽃놀이 · 용 뼈 화석 잠김 · 쇼케이스 이웃 구경
//  실행: URL=… node scripts/e2e-decodrop.mjs [phone|pc] → screenshots/decodrop/*.png
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const name = process.argv[2] ?? 'phone';
const save = JSON.parse(fs.readFileSync('tests/fixtures/real_lotte.json', 'utf8'));
const DEV = { phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, pc: { viewport: { width: 1440, height: 900 } } };
const dir = 'screenshots/decodrop';
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
const click = (sel) => p.evaluate((s) => document.querySelector(s)?.click(), sel);
const count = (k) => p.evaluate((k) => window.__world.objs.filter((o) => o.kind === k).length, k);
const gold = () => p.evaluate(() => window.__S.gold);

await p.goto(process.env.URL ?? 'http://localhost:4190/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__S, null, { timeout: 20000 });
await W(1500);
await p.locator('#tCont').click();
await W(3000);
await settle();
const land0 = await p.evaluate(() => window.__S.land);

// ── 땅 단계별 열리는 수 (계절 장식 빼고)
const per = await p.evaluate(() => [1, 2, 3, 4, 5].map((l) => window.__dd.openDrops(l).filter((k) => k !== 'snowman').length));
ok(JSON.stringify(per) === JSON.stringify([0, 7, 19, 31, 40]), `땅 1~5 열리는 장식 ${per.join('/')} (0/7/19/31/40)`);
ok(await p.evaluate(() => window.__dd.DROP_KINDS.length === 41), '장식 41종');
const month = new Date().getMonth() + 1;
ok(await p.evaluate((m) => !!window.__dd.seasonLock('snowman') === ![12, 1, 2].includes(m), month), '눈사람은 겨울(12~2월)에만');

// ── NEW 배지
await p.evaluate(() => { window.__S.gold = 10_000_000; window.__P.decor.seen = []; });
await W(900);
const badge = await p.evaluate(() => { const e = document.querySelector('#bBuild .nbadge'); return e && !e.hidden ? e.textContent : null; });
const open0 = await p.evaluate(() => window.__dd.openDrops().length);
ok(badge === String(open0) && open0 > 0, `건설 버튼 NEW 배지 ${badge} (열린 장식 ${open0})`);
await p.screenshot({ path: `${dir}/${name}_01_badge.png` });
await click('#bBuild');
await W(700);
const newTags = await p.evaluate(() => document.querySelectorAll('.cat.deco .newb').length);
ok(newTags === open0, `건설 창 장식에 NEW ${newTags}개`);
const grp = await p.evaluate(() => [...document.querySelectorAll('.dgrp [data-dg]')].map((b) => b.dataset.dg));
ok(grp.includes('둘레') && grp.includes('나무') && grp.includes('동물'), '묶음 탭: ' + grp.join('·'));
await p.locator('.dgrp [data-dg="동물"]').scrollIntoViewIfNeeded();
await click('.dgrp [data-dg="동물"]');
await W(200);
const vis = await p.evaluate(() => [...document.querySelectorAll('.cat.deco [data-k]')].filter((c) => !c.hidden).map((c) => c.dataset.k));
ok(vis.length >= 1 && vis.every((k) => ['birdhouse', 'dog_house', 'cat_crate', 'chicken_coop', 'beehives'].includes(k)), '동물 탭만: ' + vis.join(','));
await p.screenshot({ path: `${dir}/${name}_02_group.png` });
await click('.dgrp [data-dg="전체"]');
await settle();
await W(900);
ok(await p.evaluate(() => { const e = document.querySelector('#bBuild .nbadge'); return !e || e.hidden; }), '창을 본 뒤 NEW 배지 사라짐');

// ── 사기 + 이어 놓기 (산울타리 120G)
const g0 = await gold();
const h0 = await count('hedge');
const goals0 = await p.evaluate(() => { window.__P.goals.list = [{ id: 'deco3', target: 3, progress: 0, claimed: false }, { id: 'decoNew', target: 1, progress: 0, claimed: false }, { id: 'path10', target: 10, progress: 0, claimed: false }]; return true; });
await click('#bBuild');
await W(600);
await click('.cat.deco button[data-k="hedge"]');
await W(600);
for (let i = 0; i < 3; i++) {
  await click('#placeOk');
  await W(350);
}
await click('#placeNo');
await W(300);
const h1 = await count('hedge');
ok(h1 === h0 + 3, `산울타리 3개 이어 놓기 (${h0} → ${h1})`);
ok(g0 - (await gold()) >= 300 && g0 - (await gold()) < 400, `금화 -${g0 - (await gold())} (120×3)`);
const gl = await p.evaluate(() => window.__P.goals.list.map((g) => `${g.id}:${g.progress}/${g.target}`).join(' '));
ok(/deco3:3\/3/.test(gl) && /decoNew:1\/1/.test(gl), '오늘의 목표: ' + gl);

// ── 장식 도감
await p.evaluate(() => window.__openDex?.(6));
if (!(await p.evaluate(() => document.querySelector('#winT')?.textContent === '도감'))) {
  await p.evaluate(() => document.querySelector('#bMenu2')?.click());
  await W(500);
}
const dex = await p.evaluate(() => ({ title: document.querySelector('#winT')?.textContent, on: document.querySelectorAll('.dcell.on').length, all: document.querySelectorAll('.dcell').length }));
ok(dex.title === '도감' && dex.all === 41 && dex.on >= 1, `장식 도감 ${dex.on}/${dex.all}`);
await p.screenshot({ path: `${dir}/${name}_03_dex.png` });
await settle();
// 보관함에 넣어도 도감 유지
await p.evaluate(() => window.__dd.ownedDrops().length);
const own0 = await p.evaluate(() => window.__dd.ownedDrops().length);
await p.evaluate(() => { window.__P.decor.owned = []; });
ok((await p.evaluate(() => window.__dd.ownedDrops().length)) === own0, '도감은 지금 마을에 있는 것도 셈 (예전 저장)');
// 10종 모으면 보상
await p.evaluate(() => { window.__P.decor.owned = window.__dd.DROP_KINDS.slice(0, 10); });
const before = await gold();
const r = await p.evaluate(() => window.__dd.claimBook(0));
ok(r && (await gold()) - before >= r.gold, `10종 보상 +${r?.gold}`);
ok((await p.evaluate(() => window.__dd.claimBook(0))) === null, '보상은 한 번');

// ── 특별 장식
await click('#bBuild');
await W(600);
await click('#toLux');
await W(600);
const lux = await p.evaluate(() => ({ t: document.querySelector('#winT')?.textContent, n: document.querySelectorAll('.irow.lux').length, fossil: document.querySelector('.irow.lux:nth-child(6) button')?.textContent }));
ok(lux.t === '특별 장식' && lux.n === 8, `특별 장식 탭 ${lux.n}종`);
ok(/잠김/.test(lux.fossil ?? '') || (await p.evaluate(() => (window.__P.hunt.best.abyss ?? 0) >= 10)), '용 뼈 화석은 별의 심연 10 전엔 잠김');
await p.screenshot({ path: `${dir}/${name}_04_lux.png` });
await click('[data-lux="firework_stand"]');
await W(600);
await click('#placeOk');
await W(500);
ok((await count('firework_stand')) === 1, '축제 불꽃 받침 놓음');
await p.waitForFunction(() => { const o = window.__world.objs.find((x) => x.kind === 'firework_stand'); return o && !o.con && o.build === undefined; }, null, { timeout: 30000 }).catch(() => {});
const g2 = await gold();
await p.evaluate(() => window.__showObj(window.__world.objs.find((o) => o.kind === 'firework_stand')));
await W(600);
await click('[data-fire]');
await W(1500);
const fd = g2 - (await gold());
ok(fd > 90000 && fd <= 100000 && (await p.evaluate(() => window.__P.luxury.shows)) === 1, `🎆 불꽃놀이 (-${fd}G)`);
await p.screenshot({ path: `${dir}/${name}_05_fireworks.png` });
await settle();
// 한 번만 살 수 있다
await click('#bBuild');
await W(600);
await click('#toLux');
await W(500);
ok(await p.evaluate(() => /있어요/.test(document.querySelector('[data-lux="firework_stand"]')?.textContent ?? [...document.querySelectorAll('.irow.lux')].find((r) => /축제 불꽃/.test(r.textContent))?.querySelector('button')?.textContent ?? '')), '특별 장식은 하나씩 (있어요)');
await settle();

ok(errs.length === 0, '오류 없음 ' + errs.join(' | '));
void land0;
await b.close();
process.exit(fail ? 1 : 0);
