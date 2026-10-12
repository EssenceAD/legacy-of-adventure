// MYTHIC + STORY v2·v3 e2e: 도감 「신화」 탭(씨앗 · 각성) · 갈림길 목표 창(마을 · 용사) · 루트 엔딩 컷(사랑 부케 · 진 엔딩 별지기 · 연출) · 오류 0
//  실행: URL=… node scripts/e2e-story2.mjs [phone|pc] → screenshots/story2/*.png
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const name = process.argv[2] ?? 'phone';
const save = JSON.parse(fs.readFileSync('tests/fixtures/lotte_dupe.json', 'utf8'));
const DEV = { phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, pc: { viewport: { width: 1440, height: 900 } } };
const dir = 'screenshots/story2';
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
const talking = () => p.evaluate(() => !document.querySelector('#dlg').hidden);

await p.goto(process.env.URL ?? 'http://localhost:5192/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__S, null, { timeout: 20000 });
await W(1500);
await p.locator('#tCont').click();
await W(3000);
await settle();

// ── 도감 신화 탭: 씨앗 전 실루엣 → 씨앗 → 「다음 여관에서」
await p.evaluate(() => window.__openDex(7));
await W(500);
ok((await p.locator('.mcell').count()) === 9, '신화 9칸');
await p.evaluate(() => window.__mythic.seed('elysia'));
await p.evaluate(() => window.__openDex(7));
await W(400);
ok((await p.locator('.mcell.seed').count()) === 1, '씨앗 1칸');
await p.screenshot({ path: `${dir}/${name}_01_mythic_dex.png` });
await settle();

// ── 갈림길 목표 창: 마을 루트 4목표 · 용사 루트 다락의 옛 칼
await p.evaluate(() => { const s = window.__P.story; s.act = 3; s.route = 'town'; s.letter = 2; s.base = {}; s.flags = {}; });
await p.evaluate(() => window.__story.goals());
await W(500);
ok((await p.locator('#win .stp').count()) === 4, '마을 루트 목표 4줄');
await p.screenshot({ path: `${dir}/${name}_02_town_goals.png` });
await settle();
await p.evaluate(() => { window.__P.story.route = 'hero'; window.__story.goals(); });
await W(500);
ok((await p.locator('#win .stp').count()) === 4, '용사 루트 목표 4줄');
await settle();

// ── 사랑 엔딩 컷: 부케 연출
await p.evaluate(() => window.__story.cut('love'));
await W(600);
let sawBouquet = false;
for (let i = 0; i < 80 && (await talking()); i++) {
  if (await p.evaluate(() => document.querySelector('#storyFx')?.className.includes('sfx-bouquet'))) {
    if (!sawBouquet) await p.screenshot({ path: `${dir}/${name}_03_bouquet.png` });
    sawBouquet = true;
  }
  await p.evaluate(() => document.querySelector('#dlg').click());
  await W(260);
}
ok(sawBouquet, '사랑 엔딩: 부케 연출');
await settle();

// ── 진 엔딩 컷: 별지기 초상화 · 별바다/접힘 연출
await p.evaluate(() => window.__story.cut('true'));
await W(600);
const fx = new Set();
let starShot = false;
for (let i = 0; i < 120 && (await talking()); i++) {
  const st = await p.evaluate(() => ({ fx: document.querySelector('#storyFx')?.className ?? '', who: document.querySelector('#dName')?.textContent ?? '' }));
  if (st.fx) fx.add(st.fx);
  if (!starShot && /별지기/.test(st.who)) {
    starShot = true;
    { const d = await p.evaluate(() => { const i = document.querySelector('#dPort'); return [i.src, i.naturalWidth, getComputedStyle(i).opacity, getComputedStyle(i).filter, getComputedStyle(i).visibility]; }); console.error('port', d.slice(1)); fs.writeFileSync(dir + '/star_port.png', Buffer.from(d[0].split(',')[1], 'base64')); }
    await W(700);
    await p.screenshot({ path: `${dir}/${name}_04_star.png` });
  }
  await p.evaluate(() => document.querySelector('#dlg').click());
  await W(260);
}
ok(starShot, '진 엔딩: 별지기 대사');
ok([...fx].some((c) => /sfx-(starsea|fold|stars|sparkle)/.test(c)), '진 엔딩 연출: ' + [...fx].join(' '));
await settle();

ok(errs.length === 0, '오류 0 ' + errs.join(' | '));
await b.close();
console.error(fail ? `✗ ${fail}개 실패` : '✓ 전부 통과');
process.exit(fail ? 1 : 0);
