// 실제 저장 리플레이 2단계: 저장 하나하나를 새 빌드(dist-bot 4190)로 불러와서 줄어든 게 있으면 실패
//  비교: 건물 수 · 아이템 수 · 금화(우편함의 받을 금화 포함) · 영웅(영입) 수 · 땅 단계 — 불러오기 전(저장 JSON) vs 후(게임 안)
//  플레이 기록은 끄고(telemetry false) · 로그인 없이 · 저장은 그 브라우저 안에서만
//  실행: node scripts/replay-saves.mjs <저장 폴더>
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
      return { buildings: objs.length, items: P.bag.length, gold: Math.floor(S.gold), mailGold, heroes, land: S.land };
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
  }
  if (errs.length) lost.push('에러: ' + errs.join(' | '));
  if (lost.length) fail++;
  rows.push(`${lost.length ? '✗' : '✓'} ${f} v${s.version} · 건물 ${before.buildings}→${after?.buildings ?? '?'} · 아이템 ${before.items}→${after?.items ?? '?'} · 금화 ${before.gold}→${after?.gold ?? '?'}${after?.mailGold ? `(+우편 ${after.mailGold})` : ''} · 영웅 ${before.heroes}→${after?.heroes ?? '?'} · 땅 ${before.land}→${after?.land ?? '?'}${lost.length ? '  ← ' + lost.join(', ') : ''}`);
  await ctx.close();
}
console.log(rows.join('\n'));
console.log(fail ? `✗ ${fail}/${files.length}개 저장에서 줄어듦` : `✓ ${files.length}개 저장 모두 줄어든 것 없음`);
await b.close();
process.exit(fail ? 1 : 0);
