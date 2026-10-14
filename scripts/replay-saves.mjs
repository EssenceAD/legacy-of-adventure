// 실제 저장 리플레이 2단계: 저장 하나하나를 새 빌드(dist-bot 4190)로 불러와서 줄어든 게 있으면 실패
//  비교: 건물 수 · 아이템 수 · 장비 강화 수치(GROWTH: 하나라도 낮아지면 실패) · 금화(우편함의 받을 금화 포함) · 영웅(영입) 수 · 땅 단계 — 불러오기 전(저장 JSON) vs 후(게임 안)
//  플레이 기록은 끄고(telemetry false) · 로그인 없이 · 저장은 그 브라우저 안에서만
//  실행: node scripts/replay-saves.mjs <저장 폴더>
//  LAND2: BASE=<옛 빌드 주소> SHIFT=8 이면 같은 저장을 옛 빌드에서도 불러와 건물마다 자리(+SHIFT)·레벨·공사 상태까지 그대로인지 본다
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
const dir = process.argv[2];
if (!dir) throw new Error('사용법: node scripts/replay-saves.mjs <저장 폴더>');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
const b = await chromium.launch({ channel: 'chrome' });
let fail = 0;
const rows = [];
const heroesOf = (s) => {
  const dex = s.progress?.dex?.heroes ?? {};
  return Object.values(dex).filter((h) => h?.recruited).length + Object.values(s.progress?.legends ?? {}).filter((l) => l?.st === 'joined').length;
};
/** 저장 하나를 그 빌드로 불러와 상태를 읽는다 */
async function loadIn(url, raw) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript((save) => {
    try { if (sessionStorage.getItem('x')) return; sessionStorage.setItem('x', 1); } catch { return; }
    localStorage.clear();
    localStorage.setItem('legacy-of-adventure-save', save);
    localStorage.setItem('legacy-of-adventure-teaserSeen', 'true');
    localStorage.setItem('legacy-of-adventure-lastVersion', '"99"');
    localStorage.setItem('legacy-of-adventure-telemetry', 'false');
  }, raw);
  const p = await ctx.newPage();
  try {
    await p.goto(url, { waitUntil: 'networkidle' });
    await p.waitForFunction(() => !!window.__S, null, { timeout: 20000 });
    await p.waitForTimeout(1200);
    await p.locator('#tCont').click({ timeout: 8000 });
    await p.waitForTimeout(3000);
    return await p.evaluate(() => (window.__world.home?.objs ?? window.__world.objs).map((o) => [o.kind, o.tx, o.ty, o.lvl, o.con ? o.con.kind + ':' + o.con.to : '', o.build === undefined ? 0 : 1]));
  } finally {
    await ctx.close();
  }
}
const BASE = process.env.BASE;
const SHIFT = Number(process.env.SHIFT ?? 0);
for (const f of files) {
  const raw = fs.readFileSync(path.join(dir, f), 'utf8');
  const s = JSON.parse(raw);
  const before = { buildings: (s.buildings ?? []).length, items: (s.progress?.bag ?? []).length, gold: Math.floor(s.gold ?? 0), heroes: heroesOf(s), land: s.land ?? 1 };
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript((save) => {
    try { if (sessionStorage.getItem('x')) return; sessionStorage.setItem('x', 1); } catch { return; }
    localStorage.clear();
    localStorage.setItem('legacy-of-adventure-save', save);
    localStorage.setItem('legacy-of-adventure-teaserSeen', 'true');
    localStorage.setItem('legacy-of-adventure-lastVersion', '"99"');
    localStorage.setItem('legacy-of-adventure-telemetry', 'false');
  }, raw);
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  let after = null;
  try {
    await p.goto(process.env.URL ?? 'http://localhost:4190/', { waitUntil: 'networkidle' });
    await p.waitForFunction(() => !!window.__S, null, { timeout: 20000 });
    await p.waitForTimeout(1200);
    await p.locator('#tCont').click({ timeout: 8000 });
    await p.waitForTimeout(3000);
    after = await p.evaluate(() => {
      const P = window.__P, S = window.__S, W = window.__world;
      const objs = W.home?.objs ?? W.objs;
      const mailGold = P.meta.mail.filter((m) => !m.claimed).reduce((t, m) => t + (m.reward?.gold ?? 0), 0);
      const heroes = Object.values(P.dex.heroes).filter((h) => h?.recruited).length + Object.values(P.legends).filter((l) => l?.st === 'joined').length;
      // PACE §2: 맡겨 둔 사냥 (auto = 0번 칸 · autos[0]이 같아야)
      const au = P.hunt.auto;
      const hunt = au ? `${au.region}-${au.stage}` : null;
      const a0 = P.hunt.autos?.[0];
      return { buildings: objs.length, items: P.bag.length, gold: Math.floor(S.gold), mailGold, heroes, land: S.land, enh: P.bag.map((it) => [it.id, it.enh]), hunt, huntSync: !Array.isArray(P.hunt.autos) || P.hunt.autos.length === 0 || (a0 ? `${a0.region}-${a0.stage}` : null) === hunt };
    });
  } catch (e) {
    errs.push('불러오기 실패: ' + String(e).slice(0, 120));
  }
  const lost = [];
  if (!after) lost.push('불러오기 자체 실패');
  else {
    if (after.buildings < before.buildings) lost.push(`건물 ${before.buildings}→${after.buildings}`);
    if (after.items < before.items) lost.push(`아이템 ${before.items}→${after.items}`);
    if (after.gold + after.mailGold < before.gold) lost.push(`금화 ${before.gold}→${after.gold}(+우편 ${after.mailGold})`);
    if (after.heroes < before.heroes) lost.push(`영웅 ${before.heroes}→${after.heroes}`);
    if (after.land < before.land) lost.push(`땅 ${before.land}→${after.land}`);
    // PACE §2: 맡겨 둔 사냥이 있던 저장은 불러온 뒤에도 그대로 돌아야 (autos[0] = auto)
    const ha = s.progress?.hunt?.auto;
    before.hunt = ha ? `${ha.region}-${ha.stage}` : null;
    if (before.hunt && after.hunt !== before.hunt) lost.push(`맡겨 둔 사냥 ${before.hunt}→${after.hunt}`);
    if (!after.huntSync) lost.push('autos[0] ≠ auto');
    const em = new Map(after.enh);
    const down = (s.progress?.bag ?? []).filter((it) => em.has(it.id) && em.get(it.id) < it.enh);
    if (down.length) lost.push(`강화 수치 낮아짐 ${down.length}개`);
    else before.enhSum = (s.progress?.bag ?? []).reduce((t, it) => t + (it.enh ?? 0), 0);
  }
  if (errs.length) lost.push('에러: ' + errs.join(' | '));
  // LAND2: 옛 빌드와 건물마다 비교 (자리 +SHIFT · 레벨 · 공사 상태)
  if (BASE && after) {
    try {
      const [o0, o1] = [await loadIn(BASE, raw), await loadIn(process.env.URL ?? 'http://localhost:4190/', raw)];
      const key = (o, k) => [o[0], o[1] + k, o[2] + k, o[3], o[4], o[5]].join('|');
      const a = o0.map((o) => key(o, SHIFT)).sort();
      const c = o1.map((o) => key(o, 0)).sort();
      const miss = a.filter((x, i) => x !== c[i]);
      if (a.length !== c.length || miss.length) lost.push(`자리·레벨·공사 다름 ${miss.length}개: ${miss.slice(0, 3).join(' ; ')}`);
      else rows.push(`  ↳ ${f}: 건물 ${a.length}개 모두 자리 +${SHIFT} · 레벨 · 공사 상태 그대로`);
    } catch (e) {
      lost.push('비교 실패: ' + String(e).slice(0, 100));
    }
  }
  if (lost.length) fail++;
  rows.push(`${lost.length ? '✗' : '✓'} ${f} v${s.version} · 건물 ${before.buildings}→${after?.buildings ?? '?'} · 아이템 ${before.items}→${after?.items ?? '?'} · 금화 ${before.gold}→${after?.gold ?? '?'}${after?.mailGold ? `(+우편 ${after.mailGold})` : ''} · 영웅 ${before.heroes}→${after?.heroes ?? '?'} · 땅 ${before.land}→${after?.land ?? '?'}${before.enhSum != null ? ` · 강화 합 ${before.enhSum} 그대로` : ''}${before.hunt ? ` · 맡겨 둔 사냥 ${before.hunt}→${after?.hunt ?? '?'}` : ''}${lost.length ? '  ← ' + lost.join(', ') : ''}`);
  await ctx.close();
}
console.log(rows.join('\n'));
console.log(fail ? `✗ ${fail}/${files.length}개 저장에서 줄어듦` : `✓ ${files.length}개 저장 모두 줄어든 것 없음`);
await b.close();
process.exit(fail ? 1 : 0);
