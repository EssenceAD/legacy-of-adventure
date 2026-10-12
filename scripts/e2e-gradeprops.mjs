// 핫픽스: 마을 등급 장식을 마을 안으로 옮겨도 바깥에 다시 생기던 문제 — 실제 저장(옮긴 기록 있는 것)으로
//  · 불러올 때 옛 좌표 이름표 → 고정 자리 id · 옮긴 자리는 바깥에 안 나옴
//  · 땅 넓히기 → 등급 업 → 입구 옮기기 순서로 해도 다시 안 생김 · 마을 안 장식(건물) 수 그대로
//  실행: URL=… node scripts/e2e-gradeprops.mjs <저장.json>…
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const files = process.argv.slice(2);
let fail = 0;
const ok = (c, m) => { console.error((c ? '✓ ' : '✗ ') + m); if (!c) fail++; };
const b = await chromium.launch({ channel: 'chrome' });
for (const f of files) {
  const save = fs.readFileSync(f, 'utf8');
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript((s) => {
    try { if (sessionStorage.getItem('x')) return; sessionStorage.setItem('x', 1); } catch { return; }
    localStorage.clear();
    localStorage.setItem('legacy-of-adventure-save', s);
    localStorage.setItem('legacy-of-adventure-teaserSeen', 'true');
    localStorage.setItem('legacy-of-adventure-lastVersion', '"99"');
    localStorage.setItem('legacy-of-adventure-settleOff', 'true');
  }, save);
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  await p.goto(process.env.URL ?? 'http://localhost:4190/', { waitUntil: 'networkidle' });
  await p.waitForFunction(() => !!window.__S, null, { timeout: 20000 });
  await p.waitForTimeout(1500);
  await p.locator('#tCont').click().catch(() => {});
  await p.waitForTimeout(3000);
  const name = JSON.parse(save).innName;
  const st = await p.evaluate(() => {
    const moved = [...window.__P.harmony.moved];
    const props = window.__gradeProps();
    const fromProp = window.__world.objs.filter((o) => o.fromProp).length;
    return { moved, props, fromProp, land: window.__S.land };
  });
  const old = st.moved.filter((k) => !k.includes('@slot:'));
  ok(old.length === 0, `${name}: 옛 좌표 이름표 0 (옮긴 기록 ${st.moved.length}개: ${st.moved.join(' ')})`);
  const bad0 = st.props.filter((x) => st.moved.includes(x.key));
  ok(bad0.length === 0, `${name}: 옮긴 자리는 바깥에 없음 (보이는 등급 장식 ${st.props.length}개)`);
  // 땅 넓히기 → 등급 업 → 입구 옮기기
  const seq = await p.evaluate(() => {
    const out = [];
    const S = window.__S, P = window.__P;
    const check = (step) => { const vis = window.__gradeProps(); out.push({ step, again: vis.filter((x) => P.harmony.moved.includes(x.key)).map((x) => x.key), n: vis.length }); };
    S.land = Math.min(7, S.land + 1);
    check('땅 넓히기');
    window.__grade(4);
    check('등급 업');
    P.decor.entX = (window.__ent?.()[0] ?? 15) + 2;
    check('입구 옮기기');
    return out;
  });
  for (const s of seq) ok(s.again.length === 0, `${name}: ${s.step} 뒤에도 옮긴 장식 다시 안 생김 (보이는 ${s.n}개)`);
  const fp = await p.evaluate(() => window.__world.objs.filter((o) => o.fromProp).length);
  ok(fp === st.fromProp, `${name}: 마을 안 등급 장식 수 그대로 (${st.fromProp} → ${fp})`);
  ok(errs.length === 0, `${name}: 오류 0 ${errs.join(' | ')}`);
  await ctx.close();
}
await b.close();
console.error(fail ? `✗ ${fail}개 실패` : '✓ 전부 통과');
process.exit(fail ? 1 : 0);
