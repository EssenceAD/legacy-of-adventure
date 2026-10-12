// REGIONS2 e2e: 실제 저장(별의 심연 x-10을 깬 웅스)으로 업데이트 → 불러오자마자 「흩어진 별」 컷 1번 · 지역 6 탭 · 다시 켜도 컷 없음
//  · 지역 6~10 각 1·5·10스테이지 스크린샷 + fps(≥25) · 첫 입장 대사 · 지역 10 보스 50% 「목소리」 · 처치 → 컷 · 길잡이 별 3개 → 4번째 → 지역 10
//  실행: URL=http://localhost:5195/ node scripts/e2e-regions2.mjs [phone|pc] → screenshots/regions2/<기기>_*.png
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const name = process.argv[2] ?? 'phone';
const FIX = process.env.SAVE ?? 'tests/fixtures/real_woongs.json';
if (!fs.existsSync(FIX)) {
  console.log('실제 저장이 없어 건너뜀:', FIX);
  process.exit(0);
}
const save = fs.readFileSync(FIX, 'utf8');
const DEV = { phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }, pc: { viewport: { width: 1920, height: 1080 } } };
const dir = 'screenshots/regions2';
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
}, save);
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
p.on('dialog', (d) => d.accept());
const bad = [];
p.on('response', (r) => { if (/assets\/(mon|combat|sprites)\//.test(r.url()) && r.status() >= 400) bad.push(r.url()); });
const W = (ms) => p.waitForTimeout(ms);
let fail = 0;
const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) fail++; };
const dText = () => p.evaluate(() => (document.querySelector('#dlg') && !document.querySelector('#dlg').hidden ? document.querySelector('#dText')?.textContent ?? '' : null));
/** 대화·창을 닫으며 기다림 · 지나간 대사 모아 두기 */
const seenLines = [];
const settle = async (calmNeed = 3, max = 120) => {
  for (let i = 0, calm = 0; i < max && calm < calmNeed; i++) {
    const t = await dText();
    if (t != null) {
      seenLines.push(t);
      await p.evaluate(() => document.querySelector('#dlg').click());
      calm = 0;
      await W(260);
      continue;
    }
    const win = await p.evaluate(() => (document.querySelector('#win').classList.contains('on') ? document.querySelector('#winT')?.textContent ?? '?' : null));
    if (win != null) {
      seenLines.push('[창] ' + win);
      await p.evaluate(() => document.querySelector('#winX').click());
      calm = 0;
      await W(260);
      continue;
    }
    calm++;
    await W(700);
  }
};
/** 대화창이 가리면 넘기고 누르기 */
const tap = async (sel) => {
  for (let i = 0; i < 40; i++) {
    if ((await dText()) != null) { await p.evaluate(() => document.querySelector('#dlg').click()); await W(250); continue; }
    try { await p.locator(sel).click({ timeout: 1500 }); return; } catch { await W(300); }
  }
  throw new Error('못 누름 ' + sel);
};
const fpsNow = () => p.evaluate(() => new Promise((ok) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else ok(Math.round(n / 2)); }; requestAnimationFrame(f); }));
const scatterFirst = '심연 오징어가 가라앉자';

await p.goto(process.env.URL ?? 'http://localhost:5195/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__S, null, { timeout: 30000 });
await W(1500);
await p.locator('#tCont').click();
await W(2500);

// ── §5-1: 불러오자마자 흩어진 별 컷 (1번) → 새 지역 창
let shotScatter = false;
for (let i = 0; i < 160; i++) {
  const t = await dText();
  if (t != null) {
    seenLines.push(t);
    if (!shotScatter && t.includes('별 네 개가')) {
      await W(700);
      await p.screenshot({ path: `${dir}/${name}_scatter.png` });
      shotScatter = true;
    }
    await p.evaluate(() => document.querySelector('#dlg').click());
    await W(260);
    continue;
  }
  const win = await p.evaluate(() => (document.querySelector('#win').classList.contains('on') ? document.querySelector('#winT')?.textContent ?? '?' : null));
  if (win === '새 지역') {
    await p.screenshot({ path: `${dir}/${name}_newregion.png` });
    break;
  }
  if (win != null) {
    seenLines.push('[창] ' + win);
    await p.evaluate(() => document.querySelector('#winX').click());
  }
  await W(500);
}
ok(seenLines.filter((l, i) => l.includes(scatterFirst) && seenLines[i - 1] !== l).length === 1, '흩어진 별 컷 1번');
ok(await p.evaluate(() => window.__P.regions2.scatter === true), '컷 본 기록 (scatter)');
ok(await p.evaluate(() => document.querySelector('#winT')?.textContent === '새 지역' && /가라앉은 등대 해안/.test(document.querySelector('#winB')?.textContent ?? '')), '「새 지역이 열렸어요」 창 · 가라앉은 등대 해안');
// 바로 가기 → 사냥 창에 해안 탭
await p.locator('#nrGo').click();
await W(800);
ok(await p.evaluate(() => !!document.querySelector('.tabs [data-r="coast"]') && !document.querySelector('.tabs [data-r="dune"]')), '사냥 창: 해안 탭 등장 · 아직 안 열린 유적 탭은 없음');
ok(await p.evaluate(() => [...document.querySelectorAll('.tabs [data-r="coast"]')].some((e) => e.classList.contains('on'))), '해안 탭이 골라져 있음');
await p.screenshot({ path: `${dir}/${name}_huntwindow.png` });
await settle();
await p.evaluate(() => window.__saveNow());
// 다시 켜도 컷 없음
seenLines.length = 0;
await p.reload({ waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__S, null, { timeout: 30000 });
await W(1500);
await p.locator('#tCont').click();
await W(2500);
await settle(6);
ok(!seenLines.some((l) => l.includes(scatterFirst)), '다시 켜도 흩어진 별 컷은 다시 안 나옴');
ok(await p.evaluate(() => window.__P.mats.coast === 0 && window.__P.mats.abyss > 0 && Number.isFinite(window.__P.counters.regionWins.coast)), '옛 재료는 그대로 · 새 지역 칸은 0');

// ── 첫 입장 대사 (해안 1스테이지, 사냥 시작 전 1번)
await p.evaluate(() => { for (const a of window.__world.actors) if (a.id) a.hp = 100; window.__P.runs.length = 0; window.__P.hunt.auto = null; });
await p.evaluate(() => window.__openHunt('coast'));
await W(600);
await p.locator('[data-s="1"]').click();
await W(600);
await p.locator('#hMan').click();
await W(800);
const enter1 = await dText();
ok(!!enter1 && enter1.includes('소금 냄새'), '해안 첫 입장 대사: ' + (enter1 ?? '').slice(0, 24));
await W(600);
await p.screenshot({ path: `${dir}/${name}_coast_enter.png` });
for (let i = 0; i < 6 && (await dText()) != null; i++) {
  await p.evaluate(() => document.querySelector('#dlg').click());
  await W(300);
}
await W(2500);
ok(await p.evaluate(() => window.__combat.field()?.region === 'coast'), '대사 뒤 해안 전투 시작');
const quit = async () => {
  await p.locator('#cbQuit').click({ timeout: 3000 }).catch(() => {});
  await W(300);
  await p.locator('#cbGiveUp').click({ timeout: 3000 }).catch(() => {});
  await W(2300);
  await p.evaluate(() => { const bs = [...document.querySelectorAll('#cbRes button')]; (bs.find((x) => /마을|닫기|돌아/.test(x.textContent)) ?? bs[bs.length - 1])?.click(); });
  await W(1000);
};
await quit();

// ── 길잡이 별 3개 → 하늘 x-10 처치 → 4번째 별 → 심연의 바닥
await settle();
await p.evaluate(() => {
  const P = window.__P;
  for (const r of ['coast', 'dune', 'ember']) P.hunt.best[r] = 10;
  P.hunt.best.sky = 9;
  P.regions2.stars = ['coast', 'dune', 'ember'];
  P.regions2.entered = ['coast', 'dune', 'ember', 'sky'];
  P.regions2.bossShown = ['coast', 'dune', 'ember'];
  P.regions2.letters = [];
});
ok(await p.evaluate(() => window.__reg2.open().join() === 'coast,dune,ember,sky'), '별 3개: 지역 10은 아직 닫힘');
await p.evaluate(() => { for (const a of window.__world.actors) if (a.id) a.hp = 100; window.__openHunt('sky'); });
await W(600);
await p.locator('[data-s="10"]').click();
await W(600);
await p.locator('#hMan').click();
await p.waitForFunction(() => !!window.__combat.field(), null, { timeout: 10000 });
await p.evaluate(() => { for (const u of window.__combat.field()?.allies ?? []) { u.max = 1e9; u.hp = 1e9; } });
await W(1500);
// 보스까지 빨리: 처치 목표 채우기 → 보스 → 보스 쓰러뜨리기
await p.evaluate(() => { const f = window.__combat.field(); f.kills = f.killGoal; });
await W(2500);
await p.evaluate(() => { const f = window.__combat.field(); const b = f.elite; if (b) { b.hp = 0; b.dead = true; } });
await W(900);
const banner = await p.evaluate(() => document.querySelector('#cbBanner')?.textContent ?? '');
ok(banner.includes('푸른 텐구'), '보스가 쓰러질 때 한 줄: ' + banner.slice(0, 30));
await p.screenshot({ path: `${dir}/${name}_sky_bossline.png` });
await W(2500);
await p.evaluate(() => { const bs = [...document.querySelectorAll('#cbRes button')]; (bs.find((x) => /마을/.test(x.textContent)) ?? bs[bs.length - 1])?.click(); });
await W(1200);
seenLines.length = 0;
let deepWin = false;
for (let i = 0; i < 120 && !deepWin; i++) {
  const t = await dText();
  if (t != null) {
    seenLines.push(t);
    if (t.includes('네 개의 길잡이 별이 별의 심연 위에서')) await p.screenshot({ path: `${dir}/${name}_deepopen.png` });
    await p.evaluate(() => document.querySelector('#dlg').click());
    await W(260);
    continue;
  }
  const win = await p.evaluate(() => (document.querySelector('#win').classList.contains('on') ? document.querySelector('#winT')?.textContent ?? '?' : null));
  if (win === '새 지역') deepWin = true;
  else if (win != null) await p.evaluate(() => document.querySelector('#winX').click());
  await W(400);
}
ok(seenLines.some((l) => l.includes('가장 높은 섬, 바람개비 탑')), '길잡이 별 컷 (하늘)');
ok(seenLines.some((l) => l.includes('네 개의 길잡이 별이')), '길잡이 별 넷 → 심연의 바닥이 열리는 컷');
ok(deepWin && (await p.evaluate(() => /심연의 바닥/.test(document.querySelector('#winB')?.textContent ?? ''))), '새 지역 창: 심연의 바닥');
ok(await p.evaluate(() => window.__P.regions2.stars.length === 4 && window.__reg2.open().includes('deep')), '길잡이 별 4개 · 지역 10 열림');
await settle();

// ── 스크린샷: 지역 6~10 × 1·5·10 + fps
const fpsOut = {};
await p.evaluate(() => {
  const P = window.__P;
  for (const r of ['coast', 'dune', 'ember', 'sky', 'deep']) P.hunt.best[r] = Math.max(P.hunt.best[r] ?? 0, 9);
  P.regions2.entered = ['coast', 'dune', 'ember', 'sky', 'deep'];
});
for (const r of ['coast', 'dune', 'ember', 'sky', 'deep'])
  for (const s of [1, 5, 10]) {
    await settle(2, 20);
    await p.evaluate(() => { for (const a of window.__world.actors) if (a.id) a.hp = 100; });
    await p.evaluate((r) => window.__openHunt(r), r);
    await W(500);
    if (!(await p.locator(`[data-s="${s}"]`).count())) console.log('  창:', await p.evaluate(() => [document.querySelector('#winT')?.textContent, document.querySelector('#dText')?.textContent, JSON.stringify(window.__P.hunt.best), window.__reg2.open().join()]));
    await tap(`[data-s="${s}"]`);
    await W(500);
    await tap('#hMan');
    await p.waitForFunction(() => !!window.__combat.field(), null, { timeout: 10000 });
    // 스크린샷용: 파티가 쓰러지지 않게
    await p.evaluate(() => { for (const u of window.__combat.field()?.allies ?? []) { u.max = 1e9; u.hp = 1e9; } });
    await W(1400);
    if (s === 10) {
      await p.evaluate(() => { const f = window.__combat.field(); f.kills = f.killGoal; });
      await W(2600);
    }
    const fps = await fpsNow();
    const f = await p.evaluate(() => { const f = window.__combat.field(); return f ? `${f.region} ${f.stage}` : '없음'; });
    fpsOut[`${r}_${s}`] = fps;
    await p.screenshot({ path: `${dir}/${name}_${r}_${s}.png` });
    ok(f === `${r} ${s}` && fps >= 25, `${r} ${s}: ${f} · ${fps}fps`);
    // 지역 10 보스: 체력 50% → 「목소리」 (전투가 멈추고 대화창이 위에)
    if (r === 'deep' && s === 10) {
      ok(await p.evaluate(() => window.__combat.field()?.elite?.mon === 'nb_deep'), '지역 10 보스 = 별을 삼킨 것');
      await p.evaluate(() => { const b = window.__combat.field().elite; b.hp = Math.floor(b.max * 0.45); });
      await W(1200);
      const v = await dText();
      ok(!!v && v.includes('그림자 속에서'), '50% 목소리 컷: ' + (v ?? '').slice(0, 24));
      const t0 = await p.evaluate(() => window.__combat.field().time);
      await W(800);
      ok((await p.evaluate(() => window.__combat.field().time)) === t0, '목소리 동안 전투 멈춤');
      await p.evaluate(() => document.querySelector('#dlg').click());
      await W(500);
      await p.screenshot({ path: `${dir}/${name}_deep_voice.png` });
      for (let i = 0; i < 6 && (await dText()) != null; i++) {
        await p.evaluate(() => document.querySelector('#dlg').click());
        await W(300);
      }
      await W(600);
      ok((await p.evaluate(() => window.__combat.field().time)) < t0, '컷이 끝나면 전투 이어짐');
      // 별 자국: 체력 25% 단위로 켜짐
      await p.evaluate(() => { const b = window.__combat.field().elite; b.hp = Math.floor(b.max * 0.2); });
      await W(500);
      await p.screenshot({ path: `${dir}/${name}_deep_marks.png` });
      await p.evaluate(() => { const b = window.__combat.field().elite; b.hp = 0; b.dead = true; });
      await W(700);
      await p.screenshot({ path: `${dir}/${name}_deep_dissolve.png` });
      await W(2500);
      await p.evaluate(() => { const bs = [...document.querySelectorAll('#cbRes button')]; (bs.find((x) => /마을/.test(x.textContent)) ?? bs[bs.length - 1])?.click(); });
      await W(1000);
      seenLines.length = 0;
      await settle(4);
      ok(seenLines.some((l) => l.includes('그림자가 흩어지며') || l.includes('그림자의 껍질에 금이')), '처치 뒤 컷 (PLAIN/HERO)');
      continue;
    }
    await quit();
  }
// 도감 지역 칸
await settle();
await p.evaluate(() => window.__openDex(8));
await W(600);
ok(await p.evaluate(() => (document.querySelector('#winB')?.textContent ?? '').includes('길잡이 별 4/4')), '도감 「지역」 칸 · 길잡이 별 4/4');
await p.screenshot({ path: `${dir}/${name}_dex.png` });
ok(bad.length === 0, '그림 요청 실패 0 ' + bad.slice(0, 3).join(' '));
ok(errs.length === 0, '페이지 에러 0 ' + errs.join(' | '));
console.log(JSON.stringify({ fps: fpsOut }));
console.log(fail ? `✗ ${fail}개 실패` : '✓ 모두 통과');
await b.close();
process.exit(fail ? 1 : 0);
