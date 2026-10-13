// ROLES: 사냥 보스전 — 직업마다 체력(기사가 가장 많음) · 체력 막대 · 보스 바닥에 쓰러진 동료를 사제가 3초 뒤 일으킴 · 오류 0
//  실행: URL=… node scripts/e2e-roles.mjs [phone|pc]
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const name = process.argv[2] ?? 'phone';
const save = JSON.parse(fs.readFileSync('tests/fixtures/real_lotte.json', 'utf8'));
const DEV = { phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, pc: { viewport: { width: 1440, height: 900 } } };
const dir = 'screenshots/roles';
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
const info = await p.evaluate(() => { const f = window.__combat.field(); return { roles: !!f.roles, allies: f.allies.map((u) => ({ kind: u.actor.kind, max: u.max, def: u.defCut })), bars: [...document.querySelectorAll('[data-ally] u')].map((e) => e.style.width) }; });
ok(info.roles, 'rolesV2 켜짐');
ok(info.allies.length >= 2 && info.allies.every((a) => a.max > 0), '체력 ' + info.allies.map((a) => a.kind + ' ' + a.max + ' (방어 −' + Math.round(a.def * 100) + '%)').join(' · '));
ok(info.bars.length === info.allies.length && info.bars.every((w) => /%$/.test(w)), '초상화 체력 막대 ' + info.bars.join(' '));
await p.evaluate(() => { const f = window.__combat.field(); f.kills = f.killGoal; });
await W(2000);
const hasPriest = info.allies.some((a) => a.kind === 'cleric');
const vic = await p.evaluate(() => {
  const f = window.__combat.field();
  const v = f.allies.find((a) => a.job !== 'priest' && a !== f.me) ?? f.allies.find((a) => a.job !== 'priest');
  const b = f.elite;
  if (!b) return null;
  for (const a of f.allies) a.inv = a === v ? 0 : 5;
  b.atk = 1e9; b.x = v.x; b.y = v.y; b.st = 'tele'; b.stT = 0; b.stun = 0; b.tele = { x: v.x, y: v.y, r: 3 }; b.curPat = 1; v.dodgeDecided = b.id; v.stun = 1;
  return f.allies.indexOf(v);
});
await W(400);
const down = await p.evaluate((i) => window.__combat.field().allies[i].dead, vic);
ok(vic != null && down, '보스 바닥에 동료가 쓰러짐');
await W(3400);
const up = await p.evaluate((i) => { const f = window.__combat.field(); const u = f.allies[i]; return { dead: u.dead, pct: u.hp / u.max, banner: f.banner }; }, vic);
await p.screenshot({ path: dir + "/" + name + "_revive.png" });
if (hasPriest) ok(!up.dead && up.pct > 0.2 && /일어나요/.test(up.banner), '사제가 일으킴 · ' + up.banner + ' · 체력 ' + Math.round(up.pct * 100) + '%');
else ok(up.dead, '사제 없음 → 그대로 쓰러져 있음');
ok(errs.length === 0, '오류 0 ' + errs.join(' | '));
await b.close();
process.exit(fail ? 1 : 0);
