// BUILDUX e2e (폰 390×844 · pc 1440×900)
//  §6 ① 모닥불: 건설 목록에서 놓기까지 탭 3번 이내 · ② 건물 옮기기 탭·꾹 3번 이내 · ③ 1칸 골목 길 10칸 끌기 한 번 · ④ 실수로 놓은 것 되돌리기 1번
//  + 고스트 옆 ✓/✕/↻ 따라다님 · 빨강 이유 · 장식 이어 놓기 · 꾹 눌러 들기 · 넣어 두기·꺼내기 · 되돌리기/다시 하기 · 직선 길 · 채우기 · 둥근 모서리 · 최근 줄
//  pc: 휠 줌 · 오른쪽 클릭 취소 · R · Ctrl+Z/Y · Delete · Shift+끌기
//  실행: URL=… node scripts/e2e-buildux.mjs [phone|pc] → screenshots/buildux/*.png
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const name = process.argv[2] ?? 'phone';
const save = JSON.parse(fs.readFileSync('tests/fixtures/real_lotte.json', 'utf8'));
const DEV = { phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, pc: { viewport: { width: 1440, height: 900 } } };
const dir = 'screenshots/buildux';
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
let taps = 0;
/** 진짜 손가락 탭 (요소 가운데) */
async function tap(sel) {
  const bx = await p.locator(sel).first().boundingBox();
  if (!bx) return false;
  taps++;
  await p.mouse.click(bx.x + bx.width / 2, bx.y + bx.height / 2);
  await W(450);
  return true;
}
const xy = (x, y) => p.evaluate(([x, y]) => window.__decor.xy(x, y), [x, y]);
const count = (k) => p.evaluate((k) => window.__world.objs.filter((o) => o.kind === k).length, k);
const gold = () => p.evaluate(() => window.__S.gold);
const placingNow = () => p.evaluate(() => !!document.querySelector('#view.placing'));
const visible = (sel) => p.evaluate((s) => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden' && !e.closest('[hidden]'); }, sel);

await p.goto(process.env.URL ?? 'http://localhost:4190/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__S, null, { timeout: 20000 });
await W(1500);
await p.locator('#tCont').click();
await W(3000);
await settle();
await p.evaluate(() => { window.__S.gold = Math.max(window.__S.gold, 50000); });

// ── ① 모닥불: 건설(1) → 모닥불 카드(2) → ✓(3)
const fire0 = await count('fire');
taps = 0;
await tap('#bBuild');
await p.locator('.cat button[data-k="fire"]').first().scrollIntoViewIfNeeded();
await tap('.cat button[data-k="fire"]');
ok(await placingNow(), '모닥불 고스트가 바로 뜸');
const ghostOk = await p.evaluate(() => !document.querySelector('#placeOk').disabled);
ok(ghostOk, '처음 자리가 초록 (바로 확정 가능)');
// 고스트 버튼이 고스트 옆에 있는가 (화면 안 · 발판 근처)
const near = await p.evaluate(() => {
  const pl = window.__placing?.();
  const r = document.querySelector('#placeOk').getBoundingClientRect();
  if (!pl) return null;
  const [gx, gy] = window.__decor.xy(pl.tx, pl.ty);
  return { d: Math.hypot(r.left + r.width / 2 - gx, r.top + r.height / 2 - gy), inView: r.top > 0 && r.bottom < innerHeight };
});
ok(near && near.inView && near.d < 260, `✓/✕/↻ 가 고스트 옆 (거리 ${near && Math.round(near.d)}px)`);
await p.screenshot({ path: `${dir}/${name}_01_ghost.png` });
await tap('#placeOk');
ok((await count('fire')) === fire0 + 1, `① 모닥불 놓기 탭 ${taps}번 (≤3)` + (taps <= 3 ? '' : ' 초과'));
ok(taps <= 3, '① 탭 3번 이내');
ok(!(await placingNow()), '모닥불은 이어 놓기 아님 (한 번에 끝)');
// ── ④ 되돌리기 1번
const g1 = await gold();
ok(await visible('#snackUndo'), '놓은 뒤 「↶ 되돌리기」 보임');
taps = 0;
await tap('#snackUndo');
ok((await count('fire')) === fire0 && (await gold()) > g1, `④ 되돌리기 탭 ${taps}번 → 모닥불 치우고 금화 돌려받음`);
await settle();

// ── 빨강 + 이유: 겹치는 자리로 끌기
await p.evaluate(() => document.querySelector('#bBuild').click());
await W(500);
await p.evaluate(() => document.querySelector('.cat button[data-k="tree"]')?.click());
await W(500);
const inn = await p.evaluate(() => { const o = window.__world.objs.find((x) => x.kind === 'inn'); return [o.tx + 1, o.ty + 1]; });
await p.evaluate(([x, y]) => window.__movePlacement(x + 0.5, y + 0.5), inn);
await W(300);
const why = await p.evaluate(() => ({ tag: document.querySelector('#ghostTag')?.textContent, dis: document.querySelector('#placeOk').disabled }));
ok(why.dis && /겹쳐|막아/.test(why.tag ?? ''), `빨강이면 이유 표시: 「${why.tag}」`);
await p.screenshot({ path: `${dir}/${name}_02_red.png` });
// ── 이어 놓기: 나무 3그루 → ✕
await p.evaluate(() => { const pl = window.__placing(); window.__movePlacement(pl.tx, pl.ty); });
const t0 = await count('tree');
// 빈자리로 되돌리기
const spot = await p.evaluate(() => {
  const [a, b] = window.__town.landBounds();
  const occ = (x, y) => window.__world.objs.some((o) => x >= o.tx && x < o.tx + o.fw && y >= o.ty && y < o.ty + o.fh);
  for (let y = a + 1; y < b - 3; y++) for (let x = a + 1; x < b - 5; x++) { let f = true; for (let j = 0; j < 3 && f; j++) for (let i = 0; i < 5 && f; i++) if (occ(x + i, y + j)) f = false; if (f) return [x, y]; }
  return null;
});
await p.evaluate(([x, y]) => window.__movePlacement(x + 0.5, y + 0.5), spot);
await W(200);
for (let i = 0; i < 3; i++) {
  await p.evaluate(() => document.querySelector('#placeOk').click());
  await W(350);
}
ok((await count('tree')) === t0 + 3, `장식 이어 놓기: 나무 ${(await count('tree')) - t0}그루 (✓ 3번)`);
ok(await placingNow(), '이어 놓기 중엔 계속 들고 있음');
await p.screenshot({ path: `${dir}/${name}_03_chain.png` });
await p.evaluate(() => document.querySelector('#placeNo').click());
await W(300);
ok(!(await placingNow()), '✕로 이어 놓기 끝');
// 최근 줄
await p.evaluate(() => document.querySelector('#bBuild').click());
await W(500);
ok(await p.evaluate(() => !!document.querySelector('.cat.recent button[data-k="tree"]')), '건설 창 맨 위 「최근 놓은 것」에 나무');
await settle();

// ── ② 건물 옮기기: 건물 탭(1) → 옮기기(2) → (끌기) → ✓(3)
const target = await p.evaluate(() => { const o = window.__world.objs.find((x) => !['inn', 'dungeon', 'gate'].includes(x.kind) && !window.__def(x.kind).fixed && !window.__def(x.kind).deco && x.fw === 2 && x.fh === 2); window.__tgt = o; return o ? [o.kind, o.tx, o.ty, o.fw, o.fh] : null; });
ok(!!target, '옮길 건물: ' + target?.[0]);
taps = 0;
const [tx0, ty0] = [target[1], target[2]];
const c = await xy(tx0 + target[3] / 2 - 0.5, ty0 + target[4] / 2 - 0.5);
taps++;
await p.evaluate(() => window.__showObj(window.__tgt));
await W(600);
await tap('#moveB');
ok(await placingNow(), '옮기기 고스트');
// 고스트 끌기: 빈 자리로
const free = await p.evaluate(([fw, fh]) => {
  const [a, b] = window.__town.landBounds();
  const pl = window.__placing();
  const [ox, oy] = [pl.tx, pl.ty];
  for (let y = a; y < b; y++) for (let x = a; x < b; x++) { if (x === ox && y === oy) continue; window.__movePlacement(x + fw / 2, y + fh / 2); if (window.__placing().ok) return [x, y]; }
  return null;
}, [target[3], target[4]]);
ok(!!free, '옮길 빈자리 ' + free);
await tap('#placeOk');
const moved = await p.evaluate(([x, y]) => window.__tgt.tx === x && window.__tgt.ty === y, free ?? [-9, -9]);
ok(moved && taps <= 3, `② 건물 옮기기 탭 ${taps}번 (≤3)`);
await settle();

// ── 꾸미기 모드: 꾹 눌러 들기 (탭 1번 + 끌기 + ✓)
await p.evaluate(() => document.querySelector('#bBuild').click());
await W(500);
await p.evaluate(() => document.querySelector('#toDecor').click());
await W(800);
ok(await visible('#decorHint'), '첫 진입 안내 (꾹 → 끌기 → ✓)');
await p.screenshot({ path: `${dir}/${name}_04_hint.png` });
await p.evaluate(() => document.querySelector('#decorHint')?.click());
const tree = await p.evaluate(() => { const o = window.__world.objs.filter((x) => x.kind === 'tree').pop(); return [o.tx, o.ty]; });
await p.evaluate(([x, y]) => window.__game.focusTile(x, y), tree);
await W(400);
const tp = await xy(tree[0], tree[1]);
await p.mouse.move(tp[0], tp[1]);
await p.mouse.down();
await W(600);
ok(await placingNow(), '꾹 0.4초 → 들림');
const dropT = await p.evaluate(([x0, y0]) => { const occ = (x, y) => window.__world.objs.some((o) => x >= o.tx && x < o.tx + o.fw && y >= o.ty && y < o.ty + o.fh); for (let r = 2; r < 8; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const x = x0 + dx, y = y0 + dy; if (!occ(x, y) && !occ(x + 1, y) && !occ(x, y + 1) && !occ(x - 1, y) && !occ(x, y - 1) && x > window.__town.landBounds()[0] + 1 && y > window.__town.landBounds()[0] + 1 && x < window.__town.landBounds()[1] - 2 && y < window.__town.landBounds()[1] - 2) return [x, y]; } return null; }, tree);
const dp = await xy(dropT[0], dropT[1]);
await p.mouse.move(dp[0], dp[1] + 40, { steps: 8 });
await p.mouse.up();
await W(300);
await p.screenshot({ path: `${dir}/${name}_05_lift.png` });
const okEnabled = await p.evaluate(() => !document.querySelector('#placeOk').disabled);
if (okEnabled) await p.evaluate(() => document.querySelector('#placeOk').click());
else await p.evaluate(() => document.querySelector('#placeNo').click());
await W(400);
ok(okEnabled, '끌어서 옮긴 자리 초록 → ✓');

// ── 되돌리기·다시 하기
const before = await p.evaluate(() => window.__world.objs.filter((x) => x.kind === 'tree').map((o) => o.tx + ',' + o.ty).sort().join('|'));
await p.evaluate(() => document.querySelector('#decorBar [data-act="undo"]').click());
await W(300);
const afterUndo = await p.evaluate(() => window.__world.objs.filter((x) => x.kind === 'tree').map((o) => o.tx + ',' + o.ty).sort().join('|'));
ok(before !== afterUndo, '↶ 되돌리기 (옮긴 나무 제자리)');
await p.evaluate(() => document.querySelector('#decorBar [data-act="redo"]').click());
await W(300);
const afterRedo = await p.evaluate(() => window.__world.objs.filter((x) => x.kind === 'tree').map((o) => o.tx + ',' + o.ty).sort().join('|'));
ok(afterRedo === before, '↷ 다시 하기');
ok(await p.evaluate(() => window.__undoMax), '되돌리기 20단계: ' + (await p.evaluate(() => window.__undoMax)));

// ── 범위 → 넣어 두기 → 보관함 → 꺼내 놓기
await p.evaluate(() => document.querySelector('#decorBar [data-tab="select"]').click());
await W(200);
const [sx, sy] = spot;
const a1 = await xy(sx - 1, sy - 1);
const a2 = await xy(sx + 4, sy + 2);
await p.mouse.move(a1[0], a1[1]);
await p.mouse.down();
await p.mouse.move(a2[0], a2[1], { steps: 8 });
await p.mouse.up();
await W(300);
const picked = await p.evaluate(() => window.__decor.view.picked.length);
ok(picked >= 2, `범위 고르기 ${picked}개`);
const st0 = await p.evaluate(() => window.__P.decor.store.length);
await p.evaluate(() => document.querySelector('#decorBar [data-act="stash"]').click());
await W(300);
const st1 = await p.evaluate(() => window.__P.decor.store.length);
ok(st1 === st0 + picked, `📦 넣어 두기 → 보관함 ${st1}개`);
await p.evaluate(() => document.querySelector('#decorBar [data-act="store"]').click());
await W(500);
await p.screenshot({ path: `${dir}/${name}_06_store.png` });
await p.evaluate(() => document.querySelector('#winB [data-out]').click());
await W(500);
ok(await placingNow(), '꺼내 놓기 고스트');
const g2 = await gold();
await p.evaluate(() => document.querySelector('#placeOk').click());
await W(400);
ok((await p.evaluate(() => window.__P.decor.store.length)) === st1 - 1 && (await gold()) === g2, '꺼내 놓기 (무료)');

// ── 길: 직선(ㄱ자) · 둥근 모서리 · 채우기
await p.evaluate(() => { window.__P.decor.paint = {}; window.__town.rebuildPaths(); });
await p.evaluate(() => document.querySelector('#decorBar [data-tab="path"]').click());
await W(150);
await p.evaluate(() => document.querySelector('#decorBar [data-mode="line"]').click());
await W(150);
const e1 = await xy(sx, sy);
const e2 = await xy(sx + 4, sy + 2);
await p.mouse.move(e1[0], e1[1]);
await p.mouse.down();
await p.mouse.move(e2[0], e2[1], { steps: 6 });
await W(100);
const prev = await p.evaluate(() => window.__decor.view.preview.length);
await p.screenshot({ path: `${dir}/${name}_07_line.png` });
await p.mouse.up();
await W(300);
const lineN = await p.evaluate(() => Object.keys(window.__P.decor.paint).length);
ok(prev === 7 && lineN >= 5, `직선 길 미리보기 ${prev}칸 → 깔림 ${lineN}칸 (ㄱ자)`);
// 둥근 모서리: 붓으로 같은 칸 누르기 (모서리 칸)
await p.evaluate(() => document.querySelector('#decorBar [data-mode="brush"]').click());
await W(150);
const corner = await xy(sx + 4, sy);
await p.mouse.click(corner[0], corner[1]);
await W(300);
ok(await p.evaluate((k) => !!window.__P.decor.round?.[k], `${sx + 4},${sy}`), '같은 칸 한 번 더 → 모서리 둥글게');
await p.evaluate(() => (window.__decor.view.hover = null));
await W(200);
await p.screenshot({ path: `${dir}/${name}_08_round.png`, clip: { x: Math.max(0, corner[0] - 110), y: Math.max(0, corner[1] - 70), width: 220, height: 140 } });
await p.mouse.click(corner[0], corner[1]);
await W(300);
ok(await p.evaluate((k) => !window.__P.decor.paint[k], `${sx + 4},${sy}`), '한 번 더 → 지우기');
// 채우기
await p.evaluate(() => document.querySelector('#decorBar [data-tab="ground"]').click());
await W(150);
await p.evaluate(() => document.querySelector('#decorBar [data-mode="fill"]').click());
await W(150);
// 길로 닫힌 작은 영역 만들기: 3×3 테두리 칠하고 가운데 채우기
await p.evaluate(([x, y]) => { for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) if (i === 0 || j === 0 || i === 4 || j === 4) window.__P.decor.paint[`${x + i},${y + j}`] = 'gravel'; window.__town.rebuildPaths(); }, [sx - 6 < 2 ? sx : sx, sy + 3]);
const mid = await xy(sx + 2, sy + 5);
await p.mouse.click(mid[0], mid[1]);
await W(300);
const filled = await p.evaluate(([x, y]) => { let n = 0; for (let i = 1; i < 4; i++) for (let j = 1; j < 4; j++) if (window.__P.decor.paint[`${x + i},${y + j}`] === 'flower') n++; return n; }, [sx, sy + 3]);
const occInside = await p.evaluate(([x, y]) => { let n = 0; for (let i = 1; i < 4; i++) for (let j = 1; j < 4; j++) if (window.__world.objs.some((o) => x + i >= o.tx && x + i < o.tx + o.fw && y + j >= o.ty && y + j < o.ty + o.fh)) n++; return n; }, [sx, sy + 3]);
ok(filled + occInside === 9, `🪣 채우기: 닫힌 영역 ${filled}칸 (건물 칸 ${occInside})`);
await p.screenshot({ path: `${dir}/${name}_09_fill.png` });

// ── §7 자동 길 지우기: 지운 칸은 기억 → 길을 다시 깔아도 안 생김 · 울타리 밖(던전·의뢰 가는 길)도 · 되돌리기
await p.evaluate(() => { window.__P.decor.autoPath = true; window.__P.decor.paint = {}; window.__P.decor.noPath = {}; window.__town.rebuildPaths(); });
await p.evaluate(() => document.querySelector("#decorBar [data-tab=\"path\"]").click());
await W(150);
ok(await p.evaluate(() => !!document.querySelector("#decorBar .ds [data-act=\"auto\"]")), "길 도구 안에 「자동 길 켬/끔」");
await p.evaluate(() => document.querySelector("#decorBar [data-tool=\"erase\"]").click());
await W(150);
// 자동 길 칸 하나 (울타리 밖 우선 = 던전 가는 길)
const auto = await p.evaluate(() => {
  const [a, b] = window.__town.landBounds();
  const t = window.__autoTiles();
  return t.find(([x, y]) => x < a || y < a || x >= b || y >= b) ?? t.find(([x, y]) => x > a + 1 && y > a + 1) ?? null;
});
ok(!!auto, "자동 길 칸 " + auto);
await p.evaluate(([x, y]) => window.__game.focusTile(x, y), auto);
await W(400);
const ap = await xy(auto[0], auto[1]);
await p.mouse.move(ap[0], ap[1]);
await W(150);
if (name === "pc") ok(await visible("#pathTip"), "자동 길 칸 툴팁 (마우스 올림)");
await p.mouse.down();
await W(80);
await p.mouse.up();
await W(300);
const erased = await p.evaluate(([x, y]) => ({ no: !!window.__P.decor.noPath[x + "," + y], has: window.__autoTiles().some(([a, b]) => a === x && b === y) }), auto);
ok(erased.no && !erased.has, "지우개로 자동 길 칸 지움 (noPath 기억)");
await p.evaluate(() => window.__town.rebuildPaths());
ok(!(await p.evaluate(([x, y]) => window.__autoTiles().some(([a, b]) => a === x && b === y), auto)), "길을 다시 깔아도 그 칸은 비어 있음 (돌아감)");
await p.evaluate(() => document.querySelector("#decorBar [data-act=\"undo\"]").click());
await W(300);
ok(await p.evaluate(([x, y]) => !window.__P.decor.noPath[x + "," + y] && window.__autoTiles().some(([a, b]) => a === x && b === y), auto), "↶ 되돌리면 자동 길 다시");
await p.evaluate(() => document.querySelector("#decorBar [data-tool=\"erase\"]").click());
await W(150);

// ── ③ 골목 10칸 끌기 한 번 (HOTFIX19 e2e와 같은 방식, 간단히)
await p.evaluate(() => document.querySelector('#decorBar [data-tab="path"]').click());
await W(150);
const pts = [];
for (let j = 0; j < 10; j++) pts.push(await xy(sx + 6 < 0 ? 0 : sx - 3, sy + j - 4));
const paint0 = await p.evaluate(() => Object.keys(window.__P.decor.paint).length);
await p.mouse.move(pts[0][0], pts[0][1]);
await p.mouse.down();
for (const q of pts.slice(1)) await p.mouse.move(q[0], q[1], { steps: 2 });
await p.mouse.up();
await W(300);
const paint1 = await p.evaluate(() => Object.keys(window.__P.decor.paint).length);
ok(paint1 - paint0 >= 6, `③ 끌기 한 번으로 길 ${paint1 - paint0}칸 (땅 안·빈칸만)`);

// ── PC 단축키
if (name === 'pc') {
  const z0 = await p.evaluate(() => window.__S.zoom);
  await p.mouse.move(700, 400);
  await p.mouse.wheel(0, -300);
  await W(300);
  const z1 = await p.evaluate(() => window.__S.zoom);
  await p.mouse.wheel(0, 300);
  await W(300);
  ok(z1 !== z0, `휠 줌 ${z0} → ${z1}`);
  const u0 = await p.evaluate(() => Object.keys(window.__P.decor.paint).length);
  await p.keyboard.press('Control+z');
  await W(300);
  const u1 = await p.evaluate(() => Object.keys(window.__P.decor.paint).length);
  ok(u1 < u0, `Ctrl+Z (${u0} → ${u1})`);
  await p.keyboard.press('Control+y');
  await W(300);
  ok((await p.evaluate(() => Object.keys(window.__P.decor.paint).length)) === u0, 'Ctrl+Y');
  // Shift+끌기 범위 → R 반전 → Delete 넣어 두기
  await p.evaluate(() => document.querySelector('#decorBar [data-tab="hand"]').click());
  const tr = await p.evaluate(() => { const o = window.__world.objs.filter((x) => x.kind === 'tree').pop(); return [o.tx, o.ty]; });
  const q1 = await xy(tr[0] - 1, tr[1] - 1);
  const q2 = await xy(tr[0] + 1, tr[1] + 1);
  await p.keyboard.down('Shift');
  await p.mouse.move(q1[0], q1[1]);
  await p.mouse.down();
  await p.mouse.move(q2[0], q2[1], { steps: 6 });
  await p.mouse.up();
  await p.keyboard.up('Shift');
  await W(300);
  const pk = await p.evaluate(() => window.__decor.view.picked.length);
  ok(pk >= 1, `Shift+끌기 범위 ${pk}개`);
  const f0 = await p.evaluate(() => window.__decor.view.picked.map((o) => !!o.flip).join());
  await p.keyboard.press('r');
  await W(200);
  ok(f0 !== (await p.evaluate(() => window.__decor.view.picked.map((o) => !!o.flip).join())), 'R 반전');
  const s0 = await p.evaluate(() => window.__P.decor.store.length);
  await p.keyboard.press('Delete');
  await W(300);
  ok((await p.evaluate(() => window.__P.decor.store.length)) === s0 + pk, 'Delete = 넣어 두기');
  // 오른쪽 클릭 = 배치 취소
  await p.evaluate(() => document.querySelector('#decorBar [data-tab="place"]').click());
  await W(500);
  await p.evaluate(() => document.querySelector('.cat button[data-k="tree"]').click());
  await W(500);
  await p.mouse.click(700, 400, { button: 'right' });
  await W(300);
  ok(!(await placingNow()), '오른쪽 클릭 = 취소');
}
await p.evaluate(() => document.querySelector('#decorBar [data-act="exit"]')?.click());
await W(400);
// 저장에 남는가
const saved = await p.evaluate(() => { window.__saveNow?.(); const s = JSON.parse(localStorage.getItem('legacy-of-adventure-save')); return s?.progress?.decor; });
ok(saved && Array.isArray(saved.store), `저장에 보관함 (${saved?.store?.length}개)`);
ok(errs.length === 0, '오류 없음 ' + errs.join(' | '));
await b.close();
process.exit(fail ? 1 : 0);
