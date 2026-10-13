// v0.24.2 innDecoObj: 실제 저장으로 여관 앞 레벨 장식 전(플래그 끔 = 덧그림)·후(진짜 장식) 스크린샷 + 눌러 보기·옮기기
//  실행: URL=http://localhost:5204/ node scripts/shot-leveldeco.mjs <save.json> [이름]
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const [FILE, NAME = 'wwk'] = process.argv.slice(2);
const raw = fs.readFileSync(FILE, 'utf8');
const dir = 'screenshots/leveldeco';
fs.mkdirSync(dir, { recursive: true });
const b = await chromium.launch({ channel: 'chrome' });
let fail = 0;
const ok = (c, m) => { console.error((c ? '✓ ' : '✗ ') + m); if (!c) fail++; };
async function open(on) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript((save) => {
    try { if (sessionStorage.getItem('x')) return; sessionStorage.setItem('x', 1); } catch { return; }
    localStorage.clear();
    localStorage.setItem('legacy-of-adventure-save', save);
    localStorage.setItem('legacy-of-adventure-teaserSeen', 'true');
    localStorage.setItem('legacy-of-adventure-lastVersion', '"99"');
    localStorage.setItem('legacy-of-adventure-telemetry', 'false');
    localStorage.setItem('legacy-of-adventure-settleOff', 'true');
  }, raw);
  await ctx.route(/flags\.json/, async (r) => {
    const res = await r.fetch();
    const j = await res.json();
    j.innDecoObj = on;
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(j) });
  });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  await p.goto(process.env.URL ?? 'http://localhost:5204/', { waitUntil: 'networkidle' });
  await p.waitForFunction(() => !!window.__S, null, { timeout: 20000 });
  await p.waitForTimeout(1200);
  await p.locator('#tCont').click();
  await p.waitForTimeout(3000);
  for (let i = 0, calm = 0; i < 60 && calm < 3; i++) {
    const busy = await p.evaluate(() => { if (!document.querySelector('#dlg').hidden) return document.querySelector('#dlg').click(), true; if (document.querySelector('#win').classList.contains('on')) return document.querySelector('#winX').click(), true; return false; });
    calm = busy ? 0 : calm + 1;
    await p.waitForTimeout(busy ? 200 : 400);
  }
  await p.evaluate(() => {
    const W = window.__world.objs;
    const inn = W.find((o) => o.kind === 'inn');
    window.__S.clock = 600; // 낮
    window.__game.focusTile(inn.tx + inn.fw / 2, inn.ty + inn.fh);
  });
  await p.waitForTimeout(1200);
  return { ctx, p, errs };
}
// 전: 덧그림
{
  const { ctx, p } = await open(false);
  await p.screenshot({ path: `${dir}/${NAME}_before.png` });
  ok((await p.evaluate(() => window.__world.objs.filter((o) => o.kind.startsWith('lvl_')).length)) === 0, '플래그 끔: 레벨 장식 물건 없음 (예전처럼 덧그림)');
  await ctx.close();
}
// 후: 진짜 장식
{
  const { ctx, p, errs } = await open(true);
  const st = await p.evaluate(() => ({
    objs: window.__world.objs.filter((o) => o.kind.startsWith('lvl_')).map((o) => [o.kind, o.tx, o.ty]),
    store: (window.__P.decor.store ?? []).filter((s) => s.kind.startsWith('lvl_')).map((s) => s.kind),
    given: window.__P.meta.lvlDeco,
    inn: (({ tx, ty, fw, fh, lvl }) => ({ tx, ty, fw, fh, lvl }))(window.__world.objs.find((o) => o.kind === 'inn')),
  }));
  console.error(JSON.stringify(st));
  ok(st.objs.length + st.store.length === 5, `레벨 장식 5개 (마을 ${st.objs.length} · 보관함 ${st.store.length})`);
  // 겹침 없음: 모든 물건 칸이 서로 안 겹친다
  const overlap = await p.evaluate(() => {
    const seen = new Map();
    let n = 0;
    for (const o of window.__world.objs) for (let j = 0; j < o.fh; j++) for (let i = 0; i < o.fw; i++) { const k = o.tx + i + ',' + (o.ty + j); if (seen.has(k)) n++; seen.set(k, o.kind); }
    return n;
  });
  ok(overlap === 0, '칸 겹침 없음');
  await p.screenshot({ path: `${dir}/${NAME}_after.png` });
  // 눌러 보기: 첫 레벨 장식을 탭 → 창 · 옮기기
  if (st.objs.length) {
    const [k, x, y] = st.objs[0];
    const [X, Y] = await p.evaluate(([x, y]) => window.__decor.xy(x, y), [x, y]);
    await p.mouse.click(X, Y - 6);
    await p.waitForTimeout(700);
    const t = await p.evaluate(() => (document.querySelector('#win').classList.contains('on') ? document.querySelector('#winT').textContent + ' | ' + document.querySelector('#win').innerText.slice(0, 300) : ''));
    console.error('탭 →', t.replace(/\s+/g, ' ').slice(0, 200));
    ok(/여관 화분|여관 석등|주점 술통/.test(t), `탭하면 ${k} 창이 열림`);
    ok(/옮기기|넣어 두기/.test(t), '옮기기 · 넣어 두기 버튼');
    await p.screenshot({ path: `${dir}/${NAME}_tap.png` });
    // 옮기기: 버튼 → 옆 빈칸으로
    const mv = p.locator('#win button', { hasText: '옮기기' }).first();
    if (await mv.count()) {
      await mv.click();
      await p.waitForTimeout(500);
      const moving = await p.evaluate(() => !!window.__placing());
      ok(moving, '옮기기 시작됨 (배치 모드)');
      await p.screenshot({ path: `${dir}/${NAME}_move.png` });
    }
  }
  ok(errs.length === 0, `페이지 오류 없음 ${errs.join(' | ')}`);
  await ctx.close();
}
await b.close();
process.exit(fail ? 1 : 0);
