// HOTFIX22: 사냥 보스전에서 대장이 쓰러져 조작이 넘어가면 — 스킬 바 아이콘·이름·직업 색이 새 캐릭터 것으로 · 0.8초 안내 · 스킬은 지금 캐릭터 것만
//  실행: URL=… node scripts/e2e-leaderdown.mjs [phone|pc]
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const name = process.argv[2] ?? 'phone';
const save = JSON.parse(fs.readFileSync('tests/fixtures/lotte_dupe.json', 'utf8'));
const DEV = { phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, pc: { viewport: { width: 1440, height: 900 } } };
const dir = 'screenshots/hotfix22';
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
await p.goto(process.env.URL ?? 'http://localhost:4190/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__S, null, { timeout: 20000 });
await W(1500);
await p.locator('#tCont').click();
await W(3000);
await clear();
await p.evaluate(() => {
  const P = window.__P;
  P.runs.length = 0;
  P.hunt.auto = null;
  P.hunt.best.forest = 10;
  if (!P.guide.unlocked.includes('hunt')) P.guide.unlocked.push('hunt');
  for (const a of window.__world.actors) if (a.id) a.hp = 100;
});
await p.evaluate(() => window.__openHunt('forest'));
await W(600);
await p.locator('[data-s="10"]').click({ timeout: 5000 });
await W(700);
await p.locator('#hMan').click({ timeout: 5000 });
await W(2600);
const before = await p.evaluate(() => { const f = window.__combat.field(); return { job: f.me.job, name: f.me.actor.name, s1: document.querySelector('#cbS1 img').src, padJob: document.querySelector('.cbpad').dataset.job, n: f.allies.length }; });
ok(before.n >= 2, `보스전 시작 · 대장 ${before.name}(${before.job}) · 파티 ${before.n}명`);
// 대장 쓰러뜨리기 (전투와 같은 처리: 죽음 → 살아 있는 다음 동료)
await p.evaluate(() => {
  const f = window.__combat.field();
  const me = f.me;
  me.hp = 0;
  me.dead = true;
  const next = f.allies.find((a) => !a.dead && a.job !== me.job) ?? f.allies.find((a) => !a.dead);
  f.me = next;
});
await W(150);
const after = await p.evaluate(() => { const f = window.__combat.field(); return { job: f.me.job, name: f.me.actor.name, s1: document.querySelector('#cbS1 img').src, padJob: document.querySelector('.cbpad').dataset.job, banner: document.querySelector('#cbBanner').hidden ? '' : document.querySelector('#cbBanner').textContent }; });
await p.screenshot({ path: `${dir}/${name}_leader_down.png` });
ok(after.padJob === after.job, `스킬 바 직업 ${before.padJob} → ${after.padJob} (조종 ${after.name})`);
ok(after.job === before.job || after.s1 !== before.s1, '스킬 아이콘 바뀜');
ok(new RegExp(`${before.name}.*쓰러졌어요 — 이제 ${after.name}`).test(after.banner), '안내: ' + after.banner);
await W(1100);
ok(await p.evaluate(() => document.querySelector('#cbBanner').hidden), '안내는 0.8초 뒤 사라짐');
// 스킬 1 누르기 → 지금 캐릭터의 스킬 (쿨다운이 지금 캐릭터에게)
await p.evaluate(() => { const f = window.__combat.field(); f.me.cd[0] = 0; });
const s1 = p.locator('#cbS1');
const bx = await s1.boundingBox();
if (name === 'phone') await p.touchscreen.tap(bx.x + bx.width / 2, bx.y + bx.height / 2);
else await p.mouse.click(bx.x + bx.width / 2, bx.y + bx.height / 2);
await W(200);
const cast = await p.evaluate(() => { const f = window.__combat.field(); const dead = f.allies.find((a) => a.dead); return { meCd: f.me.cd[0], deadCd: dead.cd[0], txt: f.castTxt }; });
ok(cast.meCd > 0, `스킬은 지금 캐릭터가 씀 (쿨 ${cast.meCd.toFixed(1)} · ${cast.txt})`);
ok(errs.length === 0, '오류 0 ' + errs.join(' | '));
await b.close();
process.exit(fail ? 1 : 0);
