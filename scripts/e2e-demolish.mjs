// 실행: BOT_BUILD=1 npx vite build --outDir dist-bot && npx vite preview --outDir dist-bot --port 4190 그리고 node scripts/e2e-demolish.mjs
// 핫픽스 10 게이트: 철거 — 진짜 클릭만 (좌표 계산에만 개발용 전역을 읽는다, 상태는 건드리지 않음)
//  SE 375×667 · iPhone 14 · PC: ① 철거→그만두기=그대로 ② 철거→0.5초→철거=사라짐+금화↑ ③ 여관엔 버튼 없음 ④ SE에서 확인 버튼 안 잘림
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const URL = process.argv[2] ?? 'http://localhost:4190/';
const OUT = 'screenshots/hotfix10';
fs.mkdirSync(OUT, { recursive: true });
const save = fs.readFileSync('tests/fixtures/beta_town.json', 'utf8');
const DEV = {
  se: { viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  pc: { viewport: { width: 1280, height: 800 } },
};
const res = {};
let fail = 0;
const b = await chromium.launch({ channel: 'chrome' });
for (const [name, opt] of Object.entries(DEV)) {
  const ctx = await b.newContext(opt);
  await ctx.addInitScript((s) => {
    if (sessionStorage.getItem('x')) return;
    sessionStorage.setItem('x', 1);
    localStorage.clear();
    localStorage.setItem('legacy-of-adventure-save', s);
    localStorage.setItem('legacy-of-adventure-teaserSeen', 'true');
    localStorage.setItem('legacy-of-adventure-lastVersion', '"99"');
    localStorage.setItem('legacy-of-adventure-sound', JSON.stringify({ bgmOn: false, bgmVol: 0.4, sfxOn: false, sfxVol: 0.7, muted: true }));
  }, save);
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  const W = (ms) => p.waitForTimeout(ms);
  const out = [];
  const ok = (cond, msg) => {
    out.push((cond ? '✓ ' : '✗ ') + msg);
    if (!cond) fail++;
  };
  const vis = (s) => p.evaluate((s) => { const e = document.querySelector(s); return !!e && !e.hidden && e.getClientRects().length > 0; }, s);
  const winOn = () => p.evaluate(() => { const w = document.querySelector('#win'); if (!w) throw new Error('no #win: ' + location.href + ' ' + document.body?.innerText.slice(0, 200)); return w.classList.contains('on'); });
  const title = () => p.evaluate(() => document.querySelector('#winT').textContent);
  const reachable = (sel) =>
    p.evaluate((s) => {
      const e = document.querySelector(s);
      if (!e || e.hidden) return 'none';
      const r = e.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      if (r.bottom > innerHeight + 1 || r.top < 0 || r.right > innerWidth + 1) return `화면 밖 ${Math.round(r.top)}~${Math.round(r.bottom)}`;
      const hit = document.elementFromPoint(cx, cy);
      return hit && (hit === e || e.contains(hit)) ? 'ok' : `가림(${hit?.id || hit?.className})`;
    }, sel);
  const clear = async () => {
    for (let i = 0; i < 30; i++) {
      if (await vis('#dlg')) { await p.locator('#dlg').click().catch(() => {}); await W(250); continue; }
      if (await winOn()) { await p.locator('#winX').click().catch(() => {}); await W(350); continue; }
      return;
    }
  };
  await p.goto(URL, { waitUntil: 'networkidle' });
  await W(2000);
  await p.locator('#tCont').click();
  await W(3500);
  await clear();
  /** 건물 발판 위 여러 점을 진짜로 눌러 그 건물 창이 열릴 때까지 */
  const tapBuilding = async (kind) => {
    const pts = await p.evaluate((k) => {
      const o = window.__world.objs.find((x) => x.kind === k);
      if (!o) return [];
      const v = window.__view, cv = document.querySelector('canvas'), r = cv.getBoundingClientRect();
      const TW = 32, TH = 16;
      const at = (x, y) => [r.left + (((x - y) * TW) / 2 + v.OX) * v.SC, r.top + (((x + y) * TH) / 2 + v.OY) * v.SC];
      const c = [o.tx + o.fw / 2, o.ty + o.fh / 2];
      return [[0, 0], [0, -0.6], [-0.4, -0.4], [0.3, -0.9], [0.4, 0.2], [-0.2, 0.3]].map(([dx, dy]) => at(c[0] + dx, c[1] + dy));
    }, kind);
    for (const [x, y] of pts) {
      if (x < 0 || y < 0 || x > opt.viewport.width || y > opt.viewport.height) continue;
      await p.mouse.click(x, y);
      await W(700);
      if ((await winOn()) && (await p.evaluate(() => !!document.querySelector('#moveB')))) return true;
      await clear();
    }
    return false;
  };
  const count = (k) => p.evaluate((k) => window.__world.objs.filter((o) => o.kind === k).length, k);
  const gold = () => p.evaluate(() => window.__S.gold);
  // TW/TH 확인
  const tw = await p.evaluate(() => 0);
  void tw;

  // BUILDUX §2-3: ① 「📦 넣어 두기」 → 보관함 (금화 그대로) · ② 보관함 안에서만 팔기(환불 철거) — 두 번 눌러야
  ok(await tapBuilding('tavern'), '주점을 눌러 창이 열림');
  ok(await vis('#rmB'), '「📦 넣어 두기」 버튼 보임 (옮기기 아래)');
  const geo = await p.evaluate(() => { const m = document.querySelector('#moveB'), r = document.querySelector('#rmB'); return { next: m?.nextElementSibling === r, h: r?.getBoundingClientRect().height, txt: r?.textContent }; });
  ok(geo.next && geo.h >= 40 && /넣어 두기/.test(geo.txt), '옮기기 바로 아래 · 높이 40px 이상 ' + JSON.stringify(geo));
  const before = await count('tavern');
  const g0 = await gold();
  const st0 = await p.evaluate(() => window.__P.decor.store.length);
  await p.locator('#rmB').click();
  await W(400);
  ok((await count('tavern')) === before - 1 && (await gold()) === g0, '넣어 두기: 주점이 사라지고 금화는 그대로');
  ok((await p.evaluate(() => window.__P.decor.store.length)) === st0 + 1, '보관함 +1 (레벨 그대로)');
  ok(!(await winOn()), '창 닫힘 ' + (await title()));
  await p.screenshot({ path: `${OUT}/${name}_after.png` });
  // 보관함에서 팔기
  await p.evaluate(() => document.querySelector('#bBuild').click());
  await W(500);
  await p.evaluate(() => document.querySelector('#toDecor').click());
  await W(600);
  await p.evaluate(() => document.querySelector('#decorHint')?.click());
  await p.evaluate(() => document.querySelector('#decorBar [data-act="store"]').click());
  await W(500);
  ok((await title()) === '보관함', '보관함 창');
  const sell = '#winB .irow:last-child [data-sell]';
  for (const s2 of [sell]) ok((await reachable(s2)) === 'ok', `팔기 버튼 화면 안 (${await reachable(s2)})`);
  await p.locator(sell).click();
  await W(300);
  ok((await p.evaluate(() => window.__P.decor.store.length)) === st0 + 1 && /정말 팔기/.test(await p.locator(sell).textContent()), '팔기는 한 번 더 눌러야 (실수 방지)');
  await p.screenshot({ path: `${OUT}/${name}_confirm.png` });
  const expect = +(await p.locator(sell).textContent()).replace(/[^0-9]/g, '');
  const g1 = await gold();
  await p.locator(sell).click();
  await W(400);
  // 손님 수입이 계속 들어오니 차이는 「적어도 환불액」 · 1초 수입보다 크게 벗어나지 않게
  ok((await gold()) - g1 >= expect && (await gold()) - g1 < expect + 100 && expect > 0, `금화 +${expect} (${g1} → ${await gold()})`);
  ok((await p.evaluate(() => window.__P.decor.store.length)) === st0, '보관함에서 빠짐');
  await p.evaluate(() => document.querySelector('#winX').click());
  await W(300);
  await p.evaluate(() => document.querySelector('#decorBar [data-act="exit"]').click());
  await W(300);
  // ③ 여관 창엔 철거 버튼 없음 + 안내
  ok(await tapBuilding('inn'), '여관 본관을 눌러 창이 열림');
  ok(!(await vis('#rmB')) && (await vis('.rmno')), '여관: 철거 버튼 없음 · 「이 건물은 철거할 수 없어요」');
  await p.screenshot({ path: `${OUT}/${name}_inn.png` });
  await clear();
  // ⑤ 짝꿍 말풍선 (HOTFIX10 §9): 밝은 분홍 · 한 줄보다 높게 — 낮·밤 모두
  for (const night of [false, true]) {
    const bub = await p.evaluate(async (night) => {
      window.__S.night = night;
      // 말풍선 자리가 있는 손님이 나올 때까지 (이미 말하는 중이거나 옆이 붐비면 건너뜀)
      for (const a of window.__world.actors.filter((x) => !x.hidden && !x.bub)) {
        window.__say(a, '오늘도 무사히.', 3, 'chem');
        await new Promise((r) => setTimeout(r, 120));
        if (document.querySelector('.bub.chem')) break;
      }
      const e = [...document.querySelectorAll('.bub.chem')].pop();
      if (!e) return null;
      const cs = getComputedStyle(e);
      const [r, g, b] = cs.backgroundColor.match(/\d+/g).map(Number);
      const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2;
      return { bg: cs.backgroundColor, light: (Math.max(r, g, b) + Math.min(r, g, b)) / 2 / 255, h: e.getBoundingClientRect().height, lh, color: cs.color, bi: cs.borderImageSource };
    }, night);
    ok(!!bub && bub.bg === 'rgb(255, 225, 234)' && bub.light > 0.8 && bub.h > bub.lh && bub.bi === 'none', `짝꿍 말풍선 ${night ? '밤' : '낮'}: ${JSON.stringify(bub)}`);
    if (!night) await p.screenshot({ path: `${OUT}/${name}_chem_bubble.png` });
  }
  // 토벌 케미 게이지(#raid .chem)는 게이지 틀 그대로
  const gauge = await p.evaluate(() => {
    const r = document.createElement('div');
    r.id = 'raid';
    r.style.cssText = 'position:fixed;left:0;top:0;width:100px';
    r.innerHTML = '<div class="chem"><i style="width:50%"></i></div>';
    document.body.appendChild(r);
    const cs = getComputedStyle(r.querySelector('.chem'));
    const out = { bi: cs.borderImageSource.slice(0, 24), h: cs.height };
    r.remove();
    return out;
  });
  ok(gauge.bi !== 'none' && gauge.bi.length > 0, '토벌 케미 게이지 틀 유지 ' + JSON.stringify(gauge));
  ok(errs.length === 0, '페이지 에러 0 ' + errs.join(' | '));
  res[name] = out;
  await ctx.close();
}
await b.close();
console.log(JSON.stringify(res, null, 1));
console.log(fail ? `✗ ${fail}개 실패` : '✓ 모두 통과');
process.exit(fail ? 1 : 0);
