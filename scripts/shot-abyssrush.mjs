// RAIDWEAPON §1 심연 「보스 연전」 시트 (실험실 켬 = vis('abyssRush')) · 412 · 1280
//  장면: ① 입구 잠김(한 층씩 최고 7층) ② 입구 열림 · 한 층씩 ③ 보스 연전 고름 ④ 보스 연전 25층 전투(보스 한 마리 · 쫄 없음) ⑤ 결과(무기 조각 +1) ⑥ 랭킹 창 한 줄
//  실행: BOT_BUILD=1 npx vite build --outDir dist-bot-rush && npx vite preview --outDir dist-bot-rush --port 4417 --strictPort
//        URL=http://localhost:4417/ node scripts/shot-abyssrush.mjs [저장] → reports/raidweapon/rush/*.png + sheet.html
//  서버(supabase) 요청은 막는다 (랭킹 목록은 비고 · 보스 연전 줄은 내 기록만이라 그대로)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const APP = process.env.URL ?? 'http://localhost:4417/';
const OUT = process.env.OUT ?? 'reports/raidweapon/rush';
fs.mkdirSync(OUT, { recursive: true });
const save = JSON.parse(fs.readFileSync(process.argv[2] ?? 'tests/fixtures/real_hyeongcheol.json', 'utf8'));
const AND = 'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36';
const br = await chromium.launch({ channel: 'chrome' });
const VER = JSON.stringify((await (await (await br.newContext()).request.get(APP + 'version.json')).json()).version);
const errs = [];
const W = (p, ms) => p.waitForTimeout(ms);
const dev = (w) => (w === 1280 ? { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 } : { viewport: { width: w, height: 860 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: AND });

async function clear(p) {
  for (let i = 0, calm = 0; i < 60 && calm < 3; i++) {
    const busy = await p.evaluate(() => {
      const nb = document.querySelector('#namebox');
      if (nb && !nb.hidden) return document.querySelector('#nameSug button')?.click(), true;
      const dlg = document.querySelector('#dlg');
      if (dlg && !dlg.hidden) {
        const c = document.querySelector('#dChoice button');
        if (c && c.checkVisibility()) c.click();
        else dlg.click();
        return true;
      }
      if (document.querySelector('#win')?.classList.contains('on')) return document.querySelector('#winX').click(), true;
      return false;
    });
    calm = busy ? 0 : calm + 1;
    await W(p, busy ? 200 : 300);
  }
}
const shot = async (p, name) => {
  await p.screenshot({ path: `${OUT}/${name}.png` });
  console.error('✓ ' + name);
};
/** 대화(첫 입장 한 줄)만 넘기기 — 창은 그대로 */
async function skipTalk(p) {
  for (let i = 0; i < 10; i++) {
    const on = await p.evaluate(() => {
      const dlg = document.querySelector('#dlg');
      if (dlg && !dlg.hidden) return dlg.click(), true;
      return false;
    });
    if (!on) break;
    await W(p, 250);
  }
}

for (const width of [412, 1280]) {
  const ctx = await br.newContext(dev(width));
  await ctx.route(/supabase/, (r) => r.abort());
  await ctx.addInitScript(
    ([s, ver]) => {
      window.__conScale = 1 / 30;
      try {
        if (sessionStorage.getItem('x')) return;
        sessionStorage.setItem('x', '1');
      } catch {
        return;
      }
      localStorage.clear();
      localStorage.setItem('legacy-of-adventure-save', s);
      localStorage.setItem('legacy-of-adventure-teaserSeen', 'true');
      localStorage.setItem('legacy-of-adventure-lastVersion', ver);
      localStorage.setItem('legacy-of-adventure-settleOff', 'true');
      localStorage.setItem('legacy-of-adventure-telemetry', 'false');
      localStorage.setItem('legacy-of-adventure-sound', JSON.stringify({ bgmOn: false, bgmVol: 0.4, sfxOn: false, sfxVol: 0.7, muted: true }));
      localStorage.setItem('legacy-of-adventure-visualLab', 'true');
    },
    [JSON.stringify(save), VER],
  );
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(`${width}: ${String(e).slice(0, 200)}`));
  try {
    await p.goto(APP, { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => !!window.__S && !!document.querySelector('#tStart'), null, { timeout: 30000 });
    await W(p, 600);
    await p.locator('#tCont').click();
    await clear(p);
    await p.waitForFunction(() => window.__S.started, null, { timeout: 20000 });
    await W(p, 1500);
    await clear(p);
    // 심연 열기: 모든 지역 10 · 한 층씩 최고 7층 (잠김)
    await p.evaluate(() => {
      for (const k of Object.keys(window.__P.hunt.best)) window.__P.hunt.best[k] = 10;
      for (const k of ['forest', 'swamp', 'mine', 'ice', 'coast', 'dune', 'ember', 'sky', 'abyss', 'deep']) window.__P.hunt.best[k] = 10;
      window.__P.gs.abyss = { ...(window.__P.gs.abyss ?? {}), best: 7, weekBest: 7, lost: 0, cur: 0, brags: [] };
      window.__abyss.setMode('floor');
      window.__abyss.open();
    });
    await W(p, 400);
    await skipTalk(p);
    await W(p, 500);
    await shot(p, `1_locked_${width}`);
    // 잠긴 [보스 연전] 누르면 이유 토스트
    await p.locator('[data-abm="rush"]').click({ force: true });
    await W(p, 300);
    await shot(p, `1b_locked_tap_${width}`);
    // 열림 (최고 30층)
    await p.evaluate(() => {
      window.__P.gs.abyss.best = 30;
      window.__abyss.open();
    });
    await W(p, 500);
    await shot(p, `2_open_floor_${width}`);
    await p.locator('[data-abm="rush"]').click();
    await W(p, 500);
    await p.evaluate(() => {
      const a = document.getElementById('abAuto');
      if (a && a.checked) a.click();
    });
    await W(p, 200);
    await shot(p, `3_open_rush_${width}`);
    // 보스 연전 25층 (전투)
    await p.evaluate(() => {
      const ids = window.__abyss.state().picked;
      const ms = ids.map((id) => window.__world.actors.find((a) => a.id === id)).filter(Boolean);
      document.getElementById('winX')?.click();
      window.__abyss.climb(25, ms, 'rush');
    });
    await p.waitForFunction(() => !!window.__combat.field()?.elite, null, { timeout: 20000 });
    await W(p, 3500);
    const info = await p.evaluate(() => {
      const f = window.__combat.field();
      return { mobs: f.units.filter((u) => u.team === 'mob' && !u.dead && !u.minion).length, boss: f.elite?.boss?.name, killGoal: f.killGoal };
    });
    console.error('   전투:', JSON.stringify(info));
    await shot(p, `4_battle_${width}`);
    // 결과: 보스를 쓰러뜨린 것으로
    await p.evaluate(() => {
      const f = window.__combat.field();
      f.elite.hp = 0;
      f.elite.dead = true;
    });
    await p.waitForSelector('#abNext', { timeout: 15000 });
    await W(p, 1200);
    await shot(p, `5_result_${width}`);
    await p.locator('#abHome').click();
    await W(p, 800);
    await clear(p);
    // 랭킹 창 (메뉴 → 랭킹)
    await p.evaluate(() => window.__openMenu());
    await W(p, 400);
    await p.getByText('랭킹', { exact: true }).first().click();
    await W(p, 1500);
    await shot(p, `6_rank_${width}`);
    const st = await p.evaluate(() => ({ rush: window.__P.gs.abyssRush, frags: window.__P.raidWeapon }));
    console.error('   저장:', JSON.stringify(st));
  } catch (e) {
    errs.push(`${width} 못 찍음: ${String(e).slice(0, 300)}`);
    await shot(p, `x_fail_${width}`).catch(() => {});
  }
  await ctx.close();
}

// 묶음 시트
const names = ['1_locked', '1b_locked_tap', '2_open_floor', '3_open_rush', '4_battle', '5_result', '6_rank'];
const b64 = (f) => 'data:image/png;base64,' + fs.readFileSync(`${OUT}/${f}.png`).toString('base64');
const has = (f) => fs.existsSync(`${OUT}/${f}.png`);
const html = `<!doctype html><meta charset="utf-8"><title>보스 연전 시트</title><style>body{background:#222;color:#eee;font:14px sans-serif}td{vertical-align:top;padding:6px}img{max-width:420px;border:1px solid #555}</style>
<h2>RAIDWEAPON §1 심연 「보스 연전」 (abyssRush · 실험실)</h2><table><tr><th></th><th>412</th><th>1280</th></tr>${names
  .map((n) => `<tr><td>${n}</td>${[412, 1280].map((w) => `<td>${has(`${n}_${w}`) ? `<img src="${b64(`${n}_${w}`)}">` : '—'}</td>`).join('')}</tr>`)
  .join('')}</table>`;
fs.writeFileSync(`${OUT}/sheet.html`, html);
console.error(errs.length ? '오류:\n' + errs.join('\n') : '오류 없음');
await br.close();
