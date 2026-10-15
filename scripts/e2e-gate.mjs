// 10/16 왈왈콩 gateFix e2e — 실제 저장(tests/fixtures/real_*.json) 위에서
//  ① 불러오면 입구 고정(entX) → 여관 옮기기 → 입구·입구 길 그대로
//  ② 정문을 울타리 앞 다른 자리로 옮기기 → 입구가 같이 따라감 (저장된 entX도)
//  ③ 4등급 저장: 아치가 진짜 정문(gate) 오브젝트 · 아치(등급 장식)는 사라짐 · 정문은 하나
//  사진: screenshots/gate/<저장>_{load,decor}.png (412)
//  실행: URL=http://localhost:4190/ node scripts/e2e-gate.mjs [저장 json …]
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const URL = process.env.URL ?? 'http://localhost:4190/';
const OUT = process.env.OUT ?? 'screenshots/gate';
fs.mkdirSync(OUT, { recursive: true });
const files = process.argv.slice(2).length ? process.argv.slice(2) : fs.readdirSync('tests/fixtures').filter((f) => /^real_.*\.json$/.test(f)).map((f) => `tests/fixtures/${f}`);
const b = await chromium.launch({ channel: 'chrome' });
let fail = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fail++; };
let grade4 = 0;

for (const file of files) {
  const name = file.split('/').pop().replace(/\.json$/, '');
  console.log(`[${name}]`);
  const sv = fs.readFileSync(file, 'utf8');
  const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await ctx.addInitScript((s) => {
    try { if (sessionStorage.getItem('x')) return; sessionStorage.setItem('x', 1); } catch { return; }
    localStorage.clear();
    localStorage.setItem('legacy-of-adventure-save', s);
    localStorage.setItem('legacy-of-adventure-teaserSeen', 'true');
    localStorage.setItem('legacy-of-adventure-settleOff', 'true');
    localStorage.setItem('legacy-of-adventure-telemetry', 'false');
  }, sv);
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  const W = (ms) => p.waitForTimeout(ms);
  await p.goto(URL, { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('#tCont', { state: 'visible', timeout: 60000 });
  await W(600);
  await p.locator('#tCont').click();
  await W(3500);
  const clearAll = async () => {
  await p.evaluate(async () => {
    const T = (ms) => new Promise((r) => setTimeout(r, ms));
    for (let i = 0, calm = 0; i < 60 && calm < 3; i++) {
      let busy = false;
      if (!document.querySelector('#dlg').hidden) { document.querySelector('#dlg').click(); busy = true; }
      else if (document.querySelector('#win').classList.contains('on')) { document.querySelector('#winX').click(); busy = true; }
      calm = busy ? 0 : calm + 1;
      await T(busy ? 150 : 250);
    }
  });
  };
  await clearAll();
  const st = await p.evaluate(() => {
    const gates = window.__world.objs.filter((o) => o.kind === 'gate');
    return {
      entX: window.__P.decor.entX,
      ent: window.__ent(),
      auto: window.__autoEntX(),
      gates: gates.map((g) => [g.tx, g.ty, !!g.fromProp]),
      stored: (window.__P.decor.store ?? []).filter((s) => s.kind === 'gate').length,
      arch: window.__gradeProps().filter((x) => x.k === 'gate').length,
      gradeGate: window.__P.meta.gradeGate ?? null,
      g4moved: window.__P.harmony.moved.includes('gate@slot:g4_gate'),
    };
  });
  console.log('  불러온 뒤:', JSON.stringify(st));
  ok(typeof st.entX === 'number', '입구 고정됨 (entX)');
  ok(st.gates.length <= 1, '정문은 하나 이하');
  ok(st.arch === 0 || !st.gradeGate, '4등급 정문이면 아치(등급 장식)는 없음');
  if (st.gradeGate) {
    grade4++;
    ok(st.g4moved && st.gates.length + st.stored === 1, `4등급 아치 → 정문 (${st.gradeGate})`);
  }
  await p.screenshot({ path: `${OUT}/${name}_load.png` });

  // ① 여관 옮기기 → 입구·입구 길 그대로
  const inn1 = await p.evaluate(() => {
    const inn = window.__world.objs.find((o) => o.kind === 'inn');
    const [ex, ey] = window.__ent();
    const before = { ent: [ex, ey], path: window.__pathAt(ex, ey) };
    let moved = null;
    for (const d of [1, -1, 2, -2, 3, -3, 4, -4]) {
      for (const [dx, dy] of [[d, 0], [0, d]]) {
        const t = { kind: 'inn', tx: inn.tx + dx, ty: inn.ty + dy, fw: inn.fw, fh: inn.fh, flip: inn.flip };
        if (window.__canPlace(t, inn)) { moved = [dx, dy]; break; }
      }
      if (moved) break;
    }
    if (!moved) return { before, moved: null };
    window.__game.moveBuilding({ kind: 'inn', move: inn, tx: inn.tx + moved[0], ty: inn.ty + moved[1], flip: inn.flip, sprite: inn.sprite, fw: inn.fw, fh: inn.fh, ok: true });
    const [ax, ay] = window.__ent();
    return { before, moved, after: { ent: [ax, ay], path: window.__pathAt(ax, ay), entX: window.__P.decor.entX, auto: window.__autoEntX() } };
  });
  console.log('  여관 옮기기:', JSON.stringify(inn1));
  if (inn1.moved) {
    ok(inn1.after.ent[0] === inn1.before.ent[0] && inn1.after.ent[1] === inn1.before.ent[1], '여관을 옮겨도 입구 그대로');
    ok(inn1.after.path === inn1.before.path, '입구 칸 길 그대로');
  } else console.log('  (여관 옮길 빈자리가 없어 건너뜀)');

  // ② 정문 옮기기 → 입구 같이
  const g = await p.evaluate(() => {
    const W = window.__world;
    const [a, b] = window.__town.landBounds();
    const spot = (avoid) => {
      for (let x = b - 3; x >= a; x--) {
        if (avoid != null && Math.abs(x - avoid) < 3) continue;
        const t = { kind: 'gate', tx: x, ty: b - 2, fw: 2, fh: 2 };
        if (window.__canPlace(t, W.objs.find((o) => o.kind === 'gate'))) return x;
      }
      return null;
    };
    let gate = W.objs.find((o) => o.kind === 'gate');
    if (!gate) {
      const x = spot(window.__ent()[0]);
      if (x == null) return { skip: '정문 놓을 자리 없음' };
      gate = window.__town.addObj('gate', x, b - 2);
      window.__town.rebuildPaths();
    }
    const from = window.__ent()[0];
    const nx = spot(gate.tx);
    if (nx == null) return { skip: '정문 옮길 자리 없음' };
    window.__game.moveBuilding({ kind: 'gate', move: gate, tx: nx, ty: b - 2, flip: gate.flip, sprite: gate.sprite, fw: 2, fh: 2, ok: true });
    const [ex, ey] = window.__ent();
    return { from, nx, ent: [ex, ey], b, entX: window.__P.decor.entX, path: window.__pathAt(ex, ey) };
  });
  console.log('  정문 옮기기:', JSON.stringify(g));
  if (!g.skip) {
    ok(g.ent[0] >= g.nx && g.ent[0] < g.nx + 2 && g.ent[1] === g.b - 1, '정문을 옮기면 입구가 정문 칸으로');
    ok(g.entX === g.ent[0], '저장된 입구 x도 정문 자리 (이웃이 보는 입구)');
  } else console.log('  (' + g.skip + ')');

  // 꾸미기 위 「🚪 입구」 버튼 (그 사이 뜬 편지·대화는 닫고)
  await clearAll();
  await p.evaluate(() => (document.getElementById('bBuild') || [...document.querySelectorAll('button')].find((x) => /건설/.test(x.innerText || '') && x.offsetParent))?.click());
  await W(600);
  await p.evaluate(() => document.getElementById('toDecor')?.click());
  await W(900);
  const top = await p.evaluate(() => {
    const el = document.querySelector('#decorBar .dt [data-act="ent"]');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { w: Math.round(r.width), inView: r.right <= innerWidth && r.bottom <= innerHeight && r.top >= 0 };
  });
  const blocked = await p.evaluate(() => document.querySelector('#win').classList.contains('on') && document.querySelector('#winT')?.textContent);
  if (blocked && !(top && top.w > 0)) console.log('  (꼭 골라야 하는 창 「' + blocked + '」이 떠 있어 꾸미기 버튼 확인은 건너뜀)');
  else ok(!!top && top.w > 0 && top.inView, `꾸미기 위 줄에 🚪 입구 버튼 (${JSON.stringify(top)})`);
  await p.screenshot({ path: `${OUT}/${name}_decor.png` });
  // 대표 영웅 고르기 (손님 창 버튼)
  await p.evaluate(() => document.querySelector('#decorBar [data-act="exit"]')?.click());
  await clearAll();
  const rp = await p.evaluate(async () => {
    const a = window.__world.actors.find((x) => !x.role && (x.status === 'regular' || x.status === 'hero'));
    if (!a) return null;
    window.__showActor(a);
    await new Promise((r) => setTimeout(r, 300));
    const b = document.getElementById('aRep');
    if (!b) return { btn: false };
    b.click();
    await new Promise((r) => setTimeout(r, 300));
    return { btn: true, pick: window.__P.repPick, key: a.legendId ? 'legend_' + a.legendId : a.heroId ? 'hero_' + a.heroId : 'g:' + a.id, text: document.getElementById('aRep')?.textContent };
  });
  console.log('  대표 영웅:', JSON.stringify(rp));
  if (rp) ok(rp.btn && rp.pick === rp.key && /자동으로 되돌리기/.test(rp.text ?? ''), '손님 창 「⭐ 대표 영웅으로」 → 고름');
  if (rp?.btn) await p.screenshot({ path: OUT + '/' + name + '_rep.png' });
  ok(!errs.length, '페이지 에러 없음 ' + errs.join(' | '));
  await ctx.close();
}
await b.close();
console.log(`4등급 저장 ${grade4}개`);
console.log(fail ? `✗ ${fail}개 실패` : '✓ 모두 통과');
process.exit(fail ? 1 : 0);
