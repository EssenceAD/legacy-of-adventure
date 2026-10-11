// STARFALL 스크린샷 + 확인: 밤 첫 별똥별(크게) · 마우스로 잡기 · 실루엣 카드 · 밤 버튼 옆 ★ · 도감 전설 탭 밝기 단계 · 유성우 하늘(토 21~24시 흉내)
//  실행: dist-bot 미리보기 4190 · node scripts/shot-starfall.mjs → screenshots/starfall/*.png
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const save = fs.readFileSync('tests/fixtures/beta_town.json', 'utf8');
const dir = 'screenshots/starfall';
fs.mkdirSync(dir, { recursive: true });
const b = await chromium.launch({ channel: 'chrome' });
let fail = 0;
const out = [];
const ok = (c, m) => { out.push((c ? '✓ ' : '✗ ') + m); if (!c) fail++; };
async function open(shower) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(([s, sh]) => {
    if (sh) {
      // 토요일 21:30 흉내 (Date 만 — 타이머는 그대로)
      const off = new Date('2026-10-17T21:30:00').getTime() - Date.now();
      const D = Date;
      // eslint-disable-next-line no-global-assign
      Date = class extends D { constructor(...a) { super(...(a.length ? a : [D.now() + off])); } static now() { return D.now() + off; } };
    }
    try { if (sessionStorage.getItem('x')) return; sessionStorage.setItem('x', 1); } catch { return; }
    localStorage.clear();
    localStorage.setItem('legacy-of-adventure-save', s);
    localStorage.setItem('legacy-of-adventure-teaserSeen', 'true');
    localStorage.setItem('legacy-of-adventure-lastVersion', '"99"');
  }, [save, shower]);
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await p.goto('http://localhost:4190/', { waitUntil: 'networkidle' });
  await p.waitForFunction(() => !!window.__S, null, { timeout: 20000 });
  await p.waitForTimeout(1500);
  await p.locator('#tCont').click();
  await p.waitForTimeout(3000);
  const clear = async () => {
    for (let i = 0; i < 12; i++) {
      await p.evaluate(() => { if (!document.querySelector('#dlg').hidden) document.querySelector('#dlg').click(); else if (document.querySelector('#win').classList.contains('on')) document.querySelector('#winX').click(); });
      await p.waitForTimeout(150);
    }
  };
  await clear();
  await p.evaluate(() => {
    const P = window.__P, S = window.__S;
    S.night = true;
    S.clock = 16 * 60;
    P.starDay = '';
    P.starN = 0;
    P.meta.starHint = true;
    P.legends.luna = { st: 'rumor', gauge: 34 };
    P.legends.scarlet = { st: 'rumor', gauge: 72 };
  });
  return { ctx, p, errs, clear };
}
{
  const { ctx, p, errs, clear } = await open(false);
  // 별이 뜰 때까지 (그날 밤 첫 판이 크다) · 진짜 클릭으로 잡을 때까지 몇 판 시도
  let first = null;
  for (let t = 0; t < 6 && !(await p.evaluate(() => !!window.__P.starDay)); t++) {
    await clear();
    const s = await p.waitForFunction(() => { const s = window.__star?.(); return s?.on && s.vis > 0.2 && s.vis < 0.6 ? s : null; }, null, { timeout: 30000, polling: 30 }).then((h) => h.jsonValue(), () => null);
    if (!s) continue;
    first ??= s;
    if (t === 0) await p.screenshot({ path: `${dir}/night_first_star.png` });
    const cur = await p.evaluate(() => window.__star());
    await p.mouse.move(cur.cx, cur.cy);
    await p.mouse.down();
    await p.waitForTimeout(80);
    await p.mouse.up();
    await p.waitForTimeout(400);
  }
  ok(!!first?.big, `그날 밤 첫 별똥별은 크게 (big=${first?.big})`);
  ok(await p.evaluate(() => !!window.__P.starDay), '마우스로 잡힘');
  ok(await p.evaluate(() => document.querySelector('#starCard')?.hidden === false), '잡으면 실루엣 카드');
  await p.screenshot({ path: `${dir}/catch_card.png` });
  ok(await p.evaluate(() => document.querySelector('#starMark')?.hidden === false), '밤 버튼 옆 ★');
  await p.waitForTimeout(3200);
  await clear();
  await p.evaluate(() => { document.querySelector('#bMenu2').click(); });
  await p.waitForTimeout(600);
  await p.evaluate(() => [...document.querySelectorAll('.mtile')].find((t) => /도감/.test(t.textContent)).click());
  await p.waitForTimeout(600);
  await p.locator('#dT .tab[data-t="4"]').click();
  await p.waitForTimeout(600);
  const lit = await p.evaluate(() => [...document.querySelectorAll('.lgp')].map((i) => i.className.replace('lgp', '').trim()));
  ok(lit.includes('unk') && lit.some((c) => /sil b[0-3]/.test(c)), `도감 전설 실루엣 밝기 단계: ${[...new Set(lit)].join(' / ')}`);
  await p.screenshot({ path: `${dir}/dex_legends.png` });
  ok(errs.length === 0, '페이지 에러 0 ' + errs.join(' | '));
  await ctx.close();
}
{
  const { ctx, p, errs } = await open(true);
  const s = await p.waitForFunction(() => { const s = window.__star?.(); return s?.n >= 2 ? s : null; }, null, { timeout: 30000, polling: 50 }).then((h) => h.jsonValue(), () => null);
  ok((s?.n ?? 0) >= 2, `유성우: 별 여러 개 (${s?.n})`);
  await p.screenshot({ path: `${dir}/meteor_shower.png` });
  ok(errs.length === 0, '유성우 페이지 에러 0 ' + errs.join(' | '));
  await ctx.close();
}
console.log(JSON.stringify(out, null, 1));
console.log(fail ? `✗ ${fail}개 실패` : '✓ 모두 통과');
await b.close();
process.exit(fail ? 1 : 0);
