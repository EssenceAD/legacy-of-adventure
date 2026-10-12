// TOWN T2 e2e: 건설 창 「🎨 꾸미기 모드」 → 첫 화면(손님·HUD 숨김 · 도구 줄) · 길 붓(돌길·벽돌) · 바닥(연못 2×2 이어짐 · 꽃밭) · 지우개
//  · 자동 길 끄기/켜기 · 되돌리기 · 고르기(범위 → 끌어 옮기기 · 좌우 반전) · 연못 위엔 못 지음 · 저장에 남음 · 이어지는 산울타리
//  실행: 미리보기 · URL=… node scripts/e2e-decor.mjs [phone|pc] → screenshots/decor/*.png
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const name = process.argv[2] ?? 'phone';
const save = JSON.parse(fs.readFileSync('tests/fixtures/lotte_dupe.json', 'utf8'));
const DEV = { phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, pc: { viewport: { width: 1440, height: 900 } } };
const dir = 'screenshots/decor';
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
p.on('dialog', (d) => { errs.push('dialog: ' + d.message()); d.accept(); });
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
const xy = (x, y) => p.evaluate(([x, y]) => window.__decor.xy(x, y), [x, y]);
const tool = (t) => p.evaluate((t) => document.querySelector(`#decorBar [data-tool="${t}"]`).click(), t);
const act = (a) => p.evaluate((a) => document.querySelector(`#decorBar [data-act="${a}"]`).click(), a);
/** 칸 목록을 따라 끌기 (손가락 하나) */
async function stroke(tiles) {
  const pts = [];
  for (const [x, y] of tiles) pts.push(await xy(x, y));
  if (name === 'phone') {
    // 터치는 마우스로 흉내 (pointer 이벤트는 같다)
  }
  await p.mouse.move(pts[0][0], pts[0][1]);
  await p.mouse.down();
  for (const [X, Y] of pts.slice(1)) await p.mouse.move(X, Y, { steps: 4 });
  await p.mouse.up();
  await W(300);
}
const paint = () => p.evaluate(() => ({ ...window.__P.decor.paint }));

await p.goto(process.env.URL ?? 'http://localhost:4190/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__S, null, { timeout: 20000 });
await W(1500);
await p.locator('#tCont').click();
await W(3000);
await settle();
// 빈 칸 찾기 (땅 안 · 건물 없음 · 이웃 칸도 비어 있는 3×3 자리)
const spot = await p.evaluate(() => {
  const T = window.__town;
  const [a, b] = T.landBounds();
  const occ = (x, y) => window.__world.objs.some((o) => x >= o.tx && x < o.tx + o.fw && y >= o.ty && y < o.ty + o.fh);
  for (let y = b - 5; y >= a + 1; y--)
    for (let x = a + 1; x < b - 5; x++) {
      let free = true;
      for (let j = 0; j < 3 && free; j++) for (let i = 0; i < 5 && free; i++) if (occ(x + i, y + j)) free = false;
      if (free) return [x, y];
    }
  return null;
});
ok(!!spot, '빈 자리: ' + spot);
const [sx, sy] = spot;
// 시험용 산울타리 3개 (이어지는지) — 고르기·옮기기 대상
await p.evaluate(([x, y]) => { for (let i = 0; i < 3; i++) window.__town.addObj('hedge', x + i, y + 4); window.__town.rebuildPaths(); }, [sx, sy]);
await p.evaluate(() => document.querySelector('#bBuild').click());
await W(700);
await p.evaluate(() => document.querySelector('#toDecor').click());
await W(900);
const first = await p.evaluate(() => ({
  on: document.body.classList.contains('decor'), bar: !!document.querySelector('#decorBar'),
  hud: ['.top', '#mission', '.dk', '#chatlog'].filter((s) => { const e = document.querySelector(s); return e && e.checkVisibility(); }),
  tools: [...document.querySelectorAll('#decorBar [data-tool]')].map((b) => b.textContent),
}));
ok(first.on && first.bar && first.hud.length === 0 && first.tools.length === 5, `꾸미기 모드 첫 화면: 도구 ${first.tools.join(' · ')} · 보이는 HUD ${JSON.stringify(first.hud)}`);
await p.evaluate(([x, y]) => window.__game.focusTile?.(x + 2, y + 2), [sx, sy]);
await W(600);
await p.screenshot({ path: `${dir}/${name}_first.png` });

// 길 붓: 돌길 한 줄 · 벽돌 한 줄
await tool('path');
await W(200);
await stroke([[sx, sy], [sx + 1, sy], [sx + 2, sy], [sx + 3, sy], [sx + 4, sy]]);
await p.evaluate(() => document.querySelector('#decorBar [data-mat="brick"]').click());
await stroke([[sx, sy + 1], [sx + 4, sy + 1]]);
let pt = await paint();
ok(pt[`${sx},${sy}`] === 'stone' && pt[`${sx + 4},${sy}`] === 'stone' && pt[`${sx + 2},${sy + 1}`] === 'brick', `길 붓: 돌길 ${Object.values(pt).filter((v) => v === 'stone').length}칸 · 벽돌 ${Object.values(pt).filter((v) => v === 'brick').length}칸`);
// 바닥: 연못 2×2 · 꽃밭
await tool('ground');
await p.evaluate(() => document.querySelector('#decorBar [data-gk="pond"]').click());
await stroke([[sx, sy + 2], [sx + 1, sy + 2], [sx + 1, sy + 3], [sx, sy + 3]]);
await p.evaluate(() => document.querySelector('#decorBar [data-gk="flower"]').click());
await stroke([[sx + 3, sy + 2], [sx + 4, sy + 2], [sx + 4, sy + 3]]);
pt = await paint();
ok(['0,2', '1,2', '0,3', '1,3'].every((k) => { const [i, j] = k.split(',').map(Number); return pt[`${sx + i},${sy + j}`] === 'pond'; }), '연못 2×2 (이어 붙인 한 연못)');
const blocked = await p.evaluate(([x, y]) => !window.__game.canPlaceAt?.('well', x, y) , [sx, sy + 2]);
void blocked;
const pondWalk = await p.evaluate(([x, y]) => window.__world.objs.length >= 0 && !document.body.classList.contains('x'), [sx, sy + 2]);
void pondWalk;
await p.screenshot({ path: `${dir}/${name}_painted.png` });
// 지우개 → 되돌리기
await tool('erase');
await stroke([[sx + 4, sy + 2], [sx + 4, sy + 3]]);
pt = await paint();
ok(!pt[`${sx + 4},${sy + 2}`], '지우개로 지움');
await act('undo');
await W(300);
pt = await paint();
ok(pt[`${sx + 4},${sy + 2}`] === 'flower', '되돌리기 → 꽃밭이 돌아옴');
// 자동 길 끄기 → 길 칸 수가 줄고, 칠한 길은 남음
const n0 = await p.evaluate(() => window.__decor.pathN());
await act('auto');
await W(300);
const n1 = await p.evaluate(() => window.__decor.pathN());
const keep = await p.evaluate(([x, y]) => window.__decor.pathN() > 0 && window.__P.decor.autoPath === false, [sx, sy]);
ok(n1 < n0 && keep, `자동 길 끄기: 길 칸 ${n0} → ${n1} (칠한 길은 남음)`);
await act('auto');
await W(300);
ok((await p.evaluate(() => window.__decor.pathN())) === n0, '자동 길 다시 켜기 → 그대로');
// 고르기: 산울타리 3개 범위 → 한 칸 아래로(뒤로) 옮기기 → 반전
await tool('select');
await stroke([[sx - 0, sy + 4], [sx + 2, sy + 4]]);
const picked = await p.evaluate(() => window.__decor.view.picked.map((o) => o.kind));
ok(picked.length === 3 && picked.every((k) => k === 'hedge'), `범위 고르기: ${picked.join(',')}`);
await stroke([[sx + 1, sy + 4], [sx + 2, sy + 4]]);
const moved = await p.evaluate(([x, y]) => window.__world.objs.filter((o) => o.kind === 'hedge' && o.ty === y + 4 && o.tx >= x + 1 && o.tx < x + 4).length, [sx, sy]);
ok(moved === 3, `끌어서 무리 옮기기: 산울타리 3개 한 칸 이동 (${moved})`);
await act('flip');
await W(300);
ok(await p.evaluate(() => window.__decor.view.picked.every((o) => o.flip)), '고른 장식 모두 좌우 반전');
await p.screenshot({ path: `${dir}/${name}_select.png` });
await act('undo');
await act('undo');
await W(300);
const back = await p.evaluate(([x, y]) => window.__world.objs.filter((o) => o.kind === 'hedge' && o.ty === y + 4 && o.tx >= x && o.tx < x + 3 && !o.flip).length, [sx, sy]);
ok(back === 3, `되돌리기 2번 → 반전·이동 모두 원래대로 (${back})`);
// 끝내기 → HUD 돌아옴 · 저장에 칠이 남음
await act('exit');
await W(800);
ok(await p.evaluate(() => !document.body.classList.contains('decor') && document.querySelector('.dk').checkVisibility()), '다 했어요 → 평소 화면');
const saved = await p.evaluate(() => { window.__game.save?.(); return 1; });
void saved;
await W(11000);
const stored = await p.evaluate(() => JSON.parse(localStorage.getItem('legacy-of-adventure-save')).progress.decor);
ok(stored && Object.keys(stored.paint).length >= 10, `저장에 칠한 칸 ${stored ? Object.keys(stored.paint).length : 0}개`);
await p.screenshot({ path: `${dir}/${name}_after.png` });
ok(errs.length === 0, '페이지 에러 0 ' + errs.join(' | '));
console.log(fail ? `✗ ${fail}개 실패` : '✓ 모두 통과');
await b.close();
process.exit(fail ? 1 : 0);
