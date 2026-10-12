// BUILDINGS_SPEC: 새 기능 건물 7종 — 실제 짓기(건설 창 → 놓기) · 완성 · 건물 창 효과 숫자 · 연금술 공방 물약 만들기/마시기 · 텃밭 약초·별꽃 · 수확 배지
//  롯데캐슬(땅 5) 저장 위에서. 실행: dist-bot 미리보기 4190 · node scripts/e2e-buildings.mjs → screenshots/buildings/*.png
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const save = JSON.parse(fs.readFileSync('tests/fixtures/real_lotte.json', 'utf8'));
save.gold = 500000;
save.progress.rep = 2000;
const dir = 'screenshots/buildings';
fs.mkdirSync(dir, { recursive: true });
const b = await chromium.launch({ channel: 'chrome' });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await ctx.addInitScript((s) => {
  window.__conScale = 1 / 600;
  try { if (sessionStorage.getItem('x')) return; sessionStorage.setItem('x', 1); } catch { return; }
  localStorage.clear();
  localStorage.setItem('legacy-of-adventure-save', s);
  localStorage.setItem('legacy-of-adventure-teaserSeen', 'true');
  localStorage.setItem('legacy-of-adventure-lastVersion', '"99"');
}, JSON.stringify(save));
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
const W = (ms) => p.waitForTimeout(ms);
let fail = 0;
const out = [];
const ok = (c, m) => { out.push((c ? '✓ ' : '✗ ') + m); if (!c) fail++; };
const clear = async () => {
  for (let i = 0; i < 15; i++) {
    await p.evaluate(() => { if (!document.querySelector('#dlg').hidden) document.querySelector('#dlg').click(); else if (document.querySelector('#win').classList.contains('on')) document.querySelector('#winX').click(); });
    await W(150);
  }
};
await p.goto('http://localhost:4190/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__S, null, { timeout: 20000 });
await W(1500);
await p.locator('#tCont').click();
await W(3000);
await clear();
// 건설 창에 7종이 보이는지 (땅 5 · ★ 충분) — 평가 결과 같은 이벤트 창이 떠 있으면 먼저 닫는다
await W(2000);
await clear();
await p.locator('#bBuild').click({ force: true });
await W(700);
const kinds = await p.evaluate(() => [...document.querySelectorAll('.cat button[data-k]')].map((b) => b.dataset.k));
const NEW = ['stable', 'chapel', 'library', 'alchemy', 'postoffice', 'tower', 'guild'];
ok(NEW.every((k) => kinds.includes(k)), `건설 창에 새 건물 7종: ${NEW.filter((k) => kinds.includes(k)).length}/7`);
await p.screenshot({ path: `${dir}/build_window.png` });
await clear();
// 빈자리에 놓기 (게임의 자리 찾기로) → 공사 → 완성
const placed = [];
for (const k of NEW) {
  // 하나씩 (동시 공사 수 · 공사가 실제 시간으로 끝나야 다음 자리)
  const r = await p.evaluate((k) => {
    for (let y = 0; y < 22; y++)
      for (let x = 0; x < 22; x++)
        if (window.__place(k, x, y) === 'ok') {
          document.querySelector('#placeOk')?.click();
          return window.__world.objs.some((o) => o.kind === k) ? 'ok' : document.querySelector('#toast')?.textContent ?? '?';
        }
    document.querySelector('#placeNo')?.click();
    return '자리 없음';
  }, k);
  placed.push([k, r === 'ok', r]);
  await W(900);
}
ok(placed.every(([, d]) => d), `7종 짓기: ${placed.map(([k, d, r]) => `${k}${d ? '✓' : '✗ ' + r}`).join(' ')}`);
await W(2500);
const built = await p.evaluate((NEW) => NEW.map((k) => { const o = window.__world.objs.find((x) => x.kind === k); return o ? !o.con : false; }), NEW);
ok(built.every(Boolean), `공사 끝: ${built.filter(Boolean).length}/7`);
await p.screenshot({ path: `${dir}/town_with_new.png` });
// 건물 창 효과 숫자
const fx = await p.evaluate((NEW) => NEW.map((k) => { const o = window.__world.objs.find((x) => x.kind === k); if (!o) return k + ': 없음'; window.__showObj(o); return document.querySelector('#winB .sub.fx')?.textContent ?? ''; }), NEW);
ok(fx.every((t) => t.includes('✨')), `효과 줄: ${fx.map((t) => t.replace('✨ ', '')).join(' | ')}`);
await clear();
// 연금술: 재료 넣고 만들기 → 마시기
await p.evaluate(() => { window.__P.crops = { herb: 6, carrot: 2, cabbage: 3, wheat: 2 }; const o = window.__world.objs.find((x) => x.kind === 'alchemy'); if (o) window.__showObj(o); });
await W(500);
await p.locator('[data-brew="power"]').click();
await W(400);
await p.locator('[data-drink="power"]').click();
await W(400);
const buff = await p.evaluate(() => window.__P.buff);
ok(buff?.id === 'power' && buff.until > Date.now(), `힘의 물약 마심: ${JSON.stringify(buff)}`);
await p.screenshot({ path: `${dir}/alchemy.png` });
await clear();
// 텃밭: 별꽃(땅 5) 심기 · 다 자라면 「수확!」 + 마을 배지
await p.evaluate(() => { const g = window.__world.objs.find((o) => o.kind === 'garden'); g.plots = [{ crop: 'starflower', at: Date.now() - 1e9 }, { crop: 'herb', at: Date.now() - 1e9 }, { crop: null, at: 0 }]; });
await W(1200);
const badge = await p.evaluate(() => document.querySelector('#bVillage .rbadge')?.textContent);
ok(badge === '2', `마을 배지: ${badge}`);
await p.evaluate(() => window.__showObj(window.__world.objs.find((o) => o.kind === 'garden')));
await W(500);
await p.locator('[data-h="0"]').click();
await W(400);
ok(await p.evaluate(() => (window.__P.crops.starflower ?? 0) >= 2), '별꽃 수확 → 창고');
await p.screenshot({ path: `${dir}/garden.png` });
ok(errs.length === 0, '페이지 에러 0 ' + errs.join(' | '));
console.log(JSON.stringify(out, null, 1));
console.log(fail ? `✗ ${fail}개 실패` : '✓ 모두 통과');
await b.close();
process.exit(fail ? 1 : 0);
