// FEEDBACK23 e2e (커뮤니티 피드백 v0.18.4)
//  §2 꾸미기 「옮기기」: 건물 그림(지붕·벽)을 꾹 → 들림 (밤·낮 · 태블릿 가로) · 그냥 누르면 정보 창
//  §3 던전 자동 길: 지우개로 지우면 그 칸만 빠지고 새 길·「되돌렸어요」 없음 · 다시 불러와도 그대로
//  §4 던전 입구 옮기기: 꾹 → 땅 안 빈자리 ✓ · 여관과 겹치면 ✕ · 길이 따라감 · 숲속 원래 자리로 되돌리기 가능 · 저장
//  §5 마을 입구 옮기기: 🚪 입구 옮기기 → 앞 가장자리 좌우 · 손님이 새 입구로 들어옴 · 저장
//  실행: URL=… node scripts/e2e-feedback23.mjs [phone|tablet|tablet1024|tablet1366] → screenshots/feedback23/*.png
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const name = process.argv[2] ?? 'phone';
const DEV = {
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  tablet: { viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  tablet1024: { viewport: { width: 1024, height: 768 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  tablet1366: { viewport: { width: 1366, height: 1024 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};
const save = JSON.parse(fs.readFileSync('tests/fixtures/ttabam_real.json', 'utf8'));
const dir = 'screenshots/feedback23';
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
const cdp = await ctx.newCDPSession(p);
/** 진짜 손가락: 누르고 ms만큼 있다가 뗀다 (안드로이드처럼 제스처 파이프라인을 거친다) */
const press = (x, y, ms) => cdp.send('Input.synthesizeTapGesture', { x: Math.round(x), y: Math.round(y), duration: ms, tapCount: 1, gestureSourceType: 'touch' });
const toasts = [];
await p.exposeFunction('__note', (s) => toasts.push(s));
const settle = async () => {
  for (let i = 0, calm = 0; i < 80 && calm < 3; i++) {
    const busy = await p.evaluate(() => { if (!document.querySelector('#dlg').hidden) return document.querySelector('#dlg').click(), true; if (document.querySelector('#win').classList.contains('on')) return document.querySelector('#winX').click(), true; return false; });
    calm = busy ? 0 : calm + 1;
    await W(busy ? 200 : 600);
  }
};
const boot = async () => {
  await p.waitForFunction(() => !!window.__S, null, { timeout: 20000 });
  await W(1500);
  await p.locator('#tCont').click();
  await W(3000);
  await settle();
  await p.evaluate(() => new MutationObserver(() => window.__note(document.querySelector('#toast').textContent)).observe(document.querySelector('#toast'), { childList: true, subtree: true, characterData: true }));
};
const enterDecor = async () => {
  await p.evaluate(() => document.querySelector('#bBuild').click());
  await W(500);
  await p.evaluate(() => document.querySelector('#toDecor').click());
  await W(700);
  await p.evaluate(() => document.querySelector('#decorHint')?.click());
  await p.evaluate(() => document.querySelector('#decorBar [data-tab="hand"]')?.click());
  await W(200);
};
const exitDecor = () => p.evaluate(() => document.querySelector('#decorBar [data-act="exit"]')?.click());
const placing = () => p.evaluate(() => { const pl = window.__placing(); return pl ? { kind: pl.kind, move: pl.move?.kind ?? null, ent: !!pl.ent, tx: pl.tx, ty: pl.ty, ok: pl.ok, why: pl.why ?? null } : null; });
const cancel = () => p.evaluate(() => { if (window.__placing()) document.querySelector('#placeNo').click(); if (document.querySelector('#win').classList.contains('on')) document.querySelector('#winX').click(); });
const winOn = () => p.evaluate(() => document.querySelector('#win').classList.contains('on') && document.querySelector('#winT').textContent);
/** 건물 그림 위 한 점: 그림 판정은 그 건물인데 손가락 아래 바닥 칸은 그 건물이 아닌 곳 (= 예전 판정이면 못 드는 곳 · 지붕·벽) */
const bodyXY = async (kind) => {
  const t = await p.evaluate((k) => {
    const o = window.__world.objs.find((x) => x.kind === k);
    if (!o) return null;
    window.__game.focusTile(o.tx + o.fw / 2, o.ty + o.fh / 2);
    return [o.tx, o.ty, o.fw, o.fh];
  }, kind);
  if (!t) return null;
  await W(600);
  return p.evaluate(([x, y, fw, fh, k]) => {
    const [cx, cy] = window.__decor.xy(x + (fw - 1) / 2, y + (fh - 1) / 2);
    const sc = window.__view.SC;
    let best = null;
    for (let dy = 4; dy < 140; dy += 2)
      for (const dx of [0, -8, 8, -16, 16]) {
        const X = cx + dx * sc;
        const Y = cy - dy * sc;
        const h = window.__hitAt(X, Y);
        if (h.sprite === k && h.floor !== k) return { xy: [X, Y], roof: true };
        if (!best && h.sprite === k) best = { xy: [X, Y], roof: false };
      }
    return best;
  }, [...t, kind]);
};

await p.goto(process.env.URL ?? 'http://localhost:5194/', { waitUntil: 'networkidle' });
await boot();
await p.evaluate(() => { window.__S.gold = Math.max(window.__S.gold, 50000); });

// ───────── §2 꾸미기 옮기기: 그림을 꾹 → 들림 (밤 · 낮) ─────────
const kinds = await p.evaluate(() => [...new Set(window.__world.objs.filter((o) => !window.__def(o.kind).deco && o.kind !== 'inn' && o.kind !== 'dungeon' && o.build === undefined && o.sprite).map((o) => o.kind))].slice(0, 4));
for (const night of [true, false]) {
  await p.evaluate((n) => { window.__S.clock = n ? (22 - 6) * 60 + 60 : 3 * 60; }, night);
  await W(1200);
  await enterDecor();
  const label = night ? '밤' : '낮';
  ok((await p.evaluate(() => window.__S.night)) === night, `${label}: S.night = ${night}`);
  let lifted = 0;
  for (const k of kinds) {
  for (let j = 0; j < 10 && (await p.evaluate(() => !document.querySelector('#dlg').hidden)); j++) { await p.evaluate(() => document.querySelector('#dlg').click()); await W(250); }
    const hb = await bodyXY(k);
    const xy = hb.xy;
    if (!hb.roof) console.error('    (', k, ': 바닥 칸 밖 그림 점을 못 찾음 — 그림 위 아무 점)');
    await press(xy[0], xy[1], 700);
    await W(250);
    const pl = await placing();
    if (pl?.move === k) lifted++;
    else console.error('   ', k, '→', JSON.stringify(pl), await winOn());
    if (name.startsWith('tablet') && night && k === kinds[0] && pl) await p.screenshot({ path: `${dir}/${name}_move_pickup_night.png` });
    await cancel();
    await W(250);
  }
  ok(lifted === kinds.length, `${label}: 건물 그림(지붕·벽)을 꾹 → ${lifted}/${kinds.length}채 들림 (${kinds.join(', ')})`);
  // 그냥 누르면 정보 창 (들지 않음)
  for (let j = 0; j < 10 && (await p.evaluate(() => !document.querySelector('#dlg').hidden)); j++) { await p.evaluate(() => document.querySelector('#dlg').click()); await W(250); }
  const { xy } = await bodyXY(kinds[0]);
  await press(xy[0], xy[1], 60);
  await W(500);
  ok(!(await placing()) && !!(await winOn()), `${label}: 그냥 누르면 정보 창 「${await winOn()}」`);
  await cancel();
  await W(300);
  await exitDecor();
  await W(300);
}

// ───────── §3 던전 자동 길 지우기 ─────────
await enterDecor();
await p.evaluate(() => document.querySelector('#decorBar [data-tab="ground"]').click());
await W(150);
await p.evaluate(() => document.querySelector('#decorBar [data-tool="erase"]').click());
await W(150);
const road = await p.evaluate(() => {
  const dg = window.__world.objs.find((o) => o.kind === 'dungeon');
  const d = [dg.tx + Math.floor(dg.fw / 2), dg.ty + dg.fh];
  return window.__autoTiles().sort((a, b) => Math.hypot(a[0] - d[0], a[1] - d[1]) - Math.hypot(b[0] - d[0], b[1] - d[1])).slice(0, 3);
});
toasts.length = 0;
const before = await p.evaluate(() => window.__autoTiles().map(String));
for (const t of road) {
  await p.evaluate(([x, y]) => window.__game.focusTile(x, y), t);
  await W(400);
  const [X, Y] = await p.evaluate(([x, y]) => window.__decor.xy(x, y), t);
  await press(X, Y, 60);
  await W(500);
}
const after = await p.evaluate(() => window.__autoTiles().map(String));
const gone = road.filter((t) => !after.includes(String(t)));
const added = after.filter((k) => !before.includes(k));
ok(gone.length === road.length, `던전 길 ${gone.length}/${road.length}칸 지워짐`);
ok(added.length === 0, `지운 칸 옆으로 새 길이 생기지 않음 (새 칸 ${added.length}: ${added.join(' ')})`);
ok(!toasts.some((t) => /되돌렸/.test(t)), `「되돌렸어요」 없음 (토스트: ${toasts.join(' / ') || '없음'})`);
const noPath = await p.evaluate(() => Object.keys(window.__P.decor.noPath));
ok(road.every((t) => noPath.includes(String(t))), '지운 칸은 noPath에 기억');
await p.screenshot({ path: `${dir}/${name}_dungeon_path_erased.png` });
await exitDecor();
await W(300);
await p.evaluate(() => window.__saveNow());
await p.reload({ waitUntil: 'networkidle' });
await boot();
const afterReload = await p.evaluate(() => window.__autoTiles().map(String));
ok(road.every((t) => !afterReload.includes(String(t))), '다시 불러와도 지운 던전 길은 안 깔림');

// ───────── §4 던전 입구 옮기기 ─────────
await enterDecor();
const dg0 = await p.evaluate(() => { const o = window.__world.objs.find((x) => x.kind === 'dungeon'); return [o.tx, o.ty]; });
const { xy: dxy } = await bodyXY('dungeon');
await press(dxy[0], dxy[1], 700);
await W(300);
let pl = await placing();
ok(pl?.move === 'dungeon', `던전 입구 꾹 → 들림 (${JSON.stringify(pl)})`);
// 여관과 겹치면 ✕
const inn = await p.evaluate(() => { const o = window.__world.objs.find((x) => x.kind === 'inn'); return [o.tx + 1, o.ty + 1]; });
await p.evaluate(([x, y]) => window.__movePlacement(x + 1, y + 1), inn);
await W(200);
pl = await placing();
ok(pl && !pl.ok && /겹쳐|막아/.test(pl.why ?? ''), `여관 본관 위엔 못 놓음: 「${pl?.why}」`);
// 땅 안 빈자리: 게임 규칙 그대로(고스트를 옮겨 초록인 첫 자리) · 없으면 장식 몇 개를 치워 자리를 만든다
const findSpot = () => p.evaluate(() => {
  const [a, b] = window.__town.landBounds();
  for (let y = a; y < b - 3; y++) for (let x = a; x < b - 2; x++) { window.__movePlacement(x + 1.5, y + 1.5); const q = window.__placing(); if (q.ok && q.tx === x && q.ty === y) return [x, y]; }
  return null;
});
let spot = await findSpot();
if (!spot) {
  await p.evaluate(() => {
    const [a] = window.__town.landBounds();
    window.__world.objs = window.__world.objs.filter((o) => !(window.__def(o.kind).deco && o.tx < a + 6 && o.ty < a + 6));
    window.__town.rebuildPaths();
  });
  spot = await findSpot();
}
ok(!!spot, '땅 안 빈자리 ' + spot);
await p.evaluate(([x, y]) => window.__movePlacement(x + 1.5, y + 1.5), spot);
await W(200);
pl = await placing();
ok(pl?.ok, `땅 안 빈자리는 초록 (${pl?.tx},${pl?.ty}) ${pl?.why ?? ''}`);
await p.evaluate(() => document.querySelector('#placeOk').click());
await W(600);
const dg1 = await p.evaluate(() => { const o = window.__world.objs.find((x) => x.kind === 'dungeon'); return { at: [o.tx, o.ty], door: [o.tx + Math.floor(o.fw / 2), o.ty + o.fh] }; });
ok(dg1.at[0] === spot[0] && dg1.at[1] === spot[1], `던전이 옮겨짐 ${dg0} → ${dg1.at}`);
ok(await p.evaluate(([x, y]) => window.__autoTiles().some(([a, b]) => a === x && b === y), dg1.door), '자동 길이 새 던전 문 앞까지 따라옴');
const dgOut = await p.evaluate(([x, y]) => { const [a, b] = window.__town.landBounds(); return !(x >= a && y >= a && x + 2 < b && y + 2 < b); }, dg0);
const home = await p.evaluate(() => JSON.stringify(window.__dgHome()));
ok(home === JSON.stringify(dgOut ? dg0 : null), `숲속 원래 자리 기억: ${home} (원래 자리가 땅 ${dgOut ? '밖 → 기억' : '안 → 기억할 필요 없음'})`);
await p.evaluate(([x, y]) => window.__game.focusTile(x + 1, y + 1), dg1.at);
await W(500);
await p.screenshot({ path: `${dir}/${name}_dungeon_moved.png` });
// 원래 자리로 되돌릴 수 있는가 (옮기기 창에서 확인만 · ✕)
await p.evaluate(() => window.__showObj(window.__world.objs.find((x) => x.kind === 'dungeon')));
await W(400);
ok(await p.evaluate(() => !!document.querySelector('#moveB')), '던전 창에 「옮기기」 버튼');
await p.evaluate(() => document.querySelector('#moveB').click());
await W(300);
await p.evaluate(([x, y]) => window.__movePlacement(x + 1.5, y + 1.5), dg0);
await W(200);
pl = await placing();
ok(pl?.ok && pl.tx === dg0[0] && pl.ty === dg0[1], `숲속 원래 자리로는 되돌릴 수 있음 (${pl?.tx},${pl?.ty}) ${pl?.why ?? ''}`);
await p.evaluate(([x, y]) => window.__movePlacement(x + 2.5, y + 1.5), dg0);
await W(200);
pl = await placing();
ok(pl && !pl.ok, `원래 자리 옆(땅 밖)은 안 됨: 「${pl?.why}」`);
await cancel();
await W(300);

// ───────── §5 마을 입구 옮기기 ─────────
const e0 = await p.evaluate(() => window.__ent());
await p.evaluate(() => document.querySelector('#decorBar [data-act="ent"]').click());
await W(300);
pl = await placing();
ok(pl?.ent && pl.tx === e0[0] && pl.ty === e0[1], `🚪 입구 옮기기 → 지금 입구에서 시작 (${pl?.tx},${pl?.ty})`);
const target = await p.evaluate(([ex, ey]) => {
  const [a] = window.__town.landBounds();
  const occ = (x, y) => window.__world.objs.some((o) => x >= o.tx && x < o.tx + o.fw && y >= o.ty && y < o.ty + o.fh);
  for (let d = 4; d < 12; d++) for (const x of [ex - d, ex + d]) if (x >= a && x < ey + 1 && !occ(x, ey) && !window.__P.decor.paint[`${x},${ey}`]) return x;
  return null;
}, e0);
// 손가락이 앞 가장자리에서 벗어나도 그 줄로 붙는다
await p.evaluate(([x, y]) => window.__movePlacement(x + 0.5, y - 3), [target, e0[1]]);
await W(200);
pl = await placing();
ok(pl?.ty === e0[1] && pl.tx === target, `입구 고스트는 앞 가장자리 줄에만 (${pl?.tx},${pl?.ty})`);
await p.evaluate(([x, y]) => window.__game.focusTile(x, y), [target, e0[1]]);
await W(400);
await p.screenshot({ path: `${dir}/${name}_entrance_ghost.png` });
await p.evaluate(() => document.querySelector('#placeOk').click());
await W(500);
const e1 = await p.evaluate(() => window.__ent());
ok(e1[0] === target && e1[1] === e0[1], `마을 입구 옮김 ${e0} → ${e1}`);
ok(await p.evaluate(([x, y]) => window.__autoTiles().some(([a, b]) => a === x && b === y), e1), '입구 → 여관 길이 새 입구에서 시작');
await exitDecor();
await W(300);
await p.evaluate(() => void window.__arrive('visitor'));
const guest = await p.evaluate(() => { const a = window.__world.actors[window.__world.actors.length - 1]; return [Math.round(a.x), Math.round(a.y)]; });
ok(guest[0] === e1[0] && guest[1] === e1[1], `새 손님이 새 입구로 들어옴 (${guest})`);
await W(1500);
await p.screenshot({ path: `${dir}/${name}_entrance_moved.png` });
// 저장 → 다시 불러오기
await p.evaluate(() => window.__saveNow());
await p.reload({ waitUntil: 'networkidle' });
await boot();
const e2 = await p.evaluate(() => window.__ent());
const dg2 = await p.evaluate(() => { const o = window.__world.objs.find((x) => x.kind === 'dungeon'); return [o.tx, o.ty]; });
ok(e2[0] === e1[0] && e2[1] === e1[1], `다시 불러와도 입구 그대로 (${e2})`);
ok(dg2[0] === spot[0] && dg2[1] === spot[1], `다시 불러와도 던전 자리 그대로 (${dg2})`);

ok(errs.length === 0, '페이지 오류 없음 ' + errs.join(' | '));
await b.close();
console.error(fail ? `✗ ${fail}개 실패` : '✓ 모두 통과');
process.exit(fail ? 1 : 0);
