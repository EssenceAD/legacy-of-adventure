// FIRSTLOOK §2 화면 조용히 시트: 전(설정 「화면 조용히」 끔 = 예전) / 후(켬) — 둘 다 실험실 켬 · 360 · 412 · 1280
//  장면: ⓐ 새 세이브 첫 낮 ⓑ 큰 마을 낮 ⓒ 같은 마을 밤 (북적이는 순간: 손님 전원 대사 + 목표 달성 + 같은 자리 케미 +1 세 번)
//        + 말풍선 줄 하나씩 연속 컷 (412 · 큰 마을 낮 · 1.5초 간격)
//  실행: BOT_BUILD=1 npx vite build --outDir dist-bot-flquiet && npx vite preview --outDir dist-bot-flquiet --port 4331 --strictPort
//        URL=http://localhost:4331/ node scripts/shot-flquiet.mjs [큰 마을 저장] → reports/firstlook/quiet/*.png
import { chromium } from 'playwright-core';
import fs from 'node:fs';
//  V2=1 (리뷰 뒤): 412만 · ⓐ ⓑ + 연속 컷 · 파일 이름 *_v2 · 실험실 없이 flags.json 을 가로채 flQuiet 만 끔/켬
const V2 = !!process.env.V2;
const SUF = V2 ? '_v2' : '';
const APP = process.env.URL ?? 'http://localhost:4331/';
const OUT = process.env.OUT ?? 'reports/firstlook/quiet';
fs.mkdirSync(OUT, { recursive: true });
const big = JSON.parse(fs.readFileSync(process.argv[2] ?? 'tests/fixtures/real_woongs.json', 'utf8'));
const AND = 'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36';
const br = await chromium.launch({ channel: 'chrome' });
const VER = JSON.stringify((await (await (await br.newContext()).request.get(APP + 'version.json')).json()).version);
const errs = [];
const W = (p, ms) => p.waitForTimeout(ms);
const dev = (w) =>
  w === 1280 ? { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 } : { viewport: { width: w, height: w === 360 ? 740 : 860 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: AND };

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

/** 마을 열기: save = null 이면 새 세이브(시작하기 → 오프닝 건너뛰기 → 추천 이름) */
async function open(width, after, save) {
  const ctx = await br.newContext(dev(width));
  if (V2)
    await ctx.route('**/flags.json*', async (route) => {
      const r = await route.fetch();
      const j = await r.json();
      j.flQuiet = after;
      await route.fulfill({ response: r, json: j });
    });
  await ctx.addInitScript(
    ([s, ver, after, V2]) => {
      window.__conScale = 1 / 30;
      try {
        if (sessionStorage.getItem('x')) return;
        sessionStorage.setItem('x', '1');
      } catch {
        return;
      }
      localStorage.clear();
      if (s) localStorage.setItem('legacy-of-adventure-save', s);
      localStorage.setItem('legacy-of-adventure-teaserSeen', 'true');
      localStorage.setItem('legacy-of-adventure-lastVersion', ver);
      localStorage.setItem('legacy-of-adventure-settleOff', 'true');
      localStorage.setItem('legacy-of-adventure-telemetry', 'false');
      localStorage.setItem('legacy-of-adventure-sound', JSON.stringify({ bgmOn: false, bgmVol: 0.4, sfxOn: false, sfxVol: 0.7, muted: true }));
      if (!V2) localStorage.setItem('legacy-of-adventure-visualLab', 'true');
      if (!after && !V2) localStorage.setItem('legacy-of-adventure-quietOff', 'true');
    },
    [save ? JSON.stringify(save) : null, VER, after, V2],
  );
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(`${width}/${after}: ${String(e).slice(0, 200)}`));
  await p.goto(APP, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => !!window.__S && !!document.querySelector('#tStart'), null, { timeout: 30000 });
  await W(p, 600);
  if (save) await p.locator('#tCont').click();
  else {
    await p.locator('#tStart').click();
    await W(p, 500);
    for (let i = 0; i < 5; i++) await p.locator('#dSkip').click({ force: true, timeout: 1000 }).catch(() => {});
  }
  await clear(p);
  await p.waitForFunction(() => window.__S.started, null, { timeout: 20000 });
  return { ctx, p };
}
/** 북적이는 순간 */
async function crowd(p) {
  await p.evaluate(() => {
    window.__sayAll();
    window.__quiet.goalDone();
    const a = window.__world.actors.find((x) => !x.role && !x.hidden) ?? window.__world.actors[0];
    for (let i = 0; i < 3; i++) window.__quiet.float(a.x, a.y, 34, '♥ 케미 +1', 'heart');
  });
}
const shot = async (p, name) => {
  await p.screenshot({ path: `${OUT}/${name}${SUF}.png` });
  console.error('✓ ' + name);
};

const nightSave = { ...big, night: true };
const daySave = { ...big, night: false };
for (const width of V2 ? [412] : [360, 412, 1280]) {
  for (const after of [false, true]) {
    const tag = `${width}_${after ? 'after' : 'before'}`;
    for (const [scene, save] of V2 ? [['a_new', null], ['b_bigday', daySave]] : [['a_new', null], ['b_bigday', daySave], ['c_bignight', nightSave]]) {
      let ctx;
      try {
        const o = await open(width, after, save);
        ctx = o.ctx;
        const p = o.p;
        await W(p, scene === 'a_new' ? 4000 : 2500);
        await clear(p);
        await crowd(p);
        await W(p, 350);
        await shot(p, `${scene}_${tag}`);
        // 연속 컷: 412 큰 마을 낮 · 1.5초 간격 (말풍선 줄)
        if (width === 412 && scene === 'b_bigday') {
          await W(p, 6000);
          await p.evaluate(() => window.__world.actors.filter((a) => !a.role && !a.hidden).slice(0, 4).forEach((a, i) => window.__say(a, ['방 좋네~', '오늘 던전 갈까?', '배고프다…', '주인장 최고!'][i])));
          for (let i = 0; i < 8; i++) {
            await shot(p, `burst_${after ? 'after' : 'before'}_${i}`);
            const st = await p.evaluate(() => ({ bub: [...document.querySelectorAll('.bub')].map((b) => b.textContent), q: window.__quiet.qb.q.length }));
            console.error(`   ${i * 1.5}s 말풍선 ${JSON.stringify(st.bub)} · 줄 ${st.q}`);
            await W(p, 1500);
          }
        }
      } catch (e) {
        errs.push(`${scene}_${tag} 못 찍음: ${String(e).slice(0, 300)}`);
      }
      await ctx?.close();
    }
  }
}

// 묶음 시트 (장면마다: 줄 = 폭 · 칸 = 전/후)
const b64 = (f) => 'data:image/png;base64,' + fs.readFileSync(`${OUT}/${f}${SUF}.png`).toString('base64');
const has = (f) => fs.existsSync(`${OUT}/${f}${SUF}.png`);
const page = await (await br.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
const css = 'body{margin:0;background:#16141f;color:#eee;font:14px sans-serif;padding:12px}h2{margin:6px 0 10px}table{border-collapse:collapse}td{vertical-align:top;padding:6px}img{display:block;border:1px solid #444}small{color:#aaa}';
for (const [scene, title] of [['a_new', 'ⓐ 새 세이브 첫 낮'], ['b_bigday', 'ⓑ 큰 마을 낮'], ...(V2 ? [] : [['c_bignight', 'ⓒ 큰 마을 밤']])]) {
  const rows = (V2 ? [412] : [360, 412, 1280])
    .map((w) => `<tr><td><b>${w}</b></td>${['before', 'after'].map((m) => (has(`${scene}_${w}_${m}`) ? `<td><small>${m === 'before' ? (V2 ? '전 (flQuiet 끔)' : '전 (화면 조용히 끔 = 지금)') : (V2 ? '후 (flQuiet 켬)' : '후 (화면 조용히 켬)')}</small><img src="${b64(`${scene}_${w}_${m}`)}" style="width:${w === 1280 ? 640 : 300}px"></td>` : '<td>—</td>')).join('')}</tr>`)
    .join('');
  await page.setContent(`<style>${css}</style><h2>FIRSTLOOK §2 화면 조용히 — ${title} <small>(북적이는 순간: 손님 전원 대사 + 목표 달성 + 같은 자리 케미 +1 ×3)</small></h2><table>${rows}</table>`);
  await page.screenshot({ path: `${OUT}/SHEET_${scene}${SUF}.png`, fullPage: true });
}
const strip = (m) => [...Array(8).keys()].filter((i) => has(`burst_${m}_${i}`)).map((i) => `<td><small>${(i * 1.5).toFixed(1)}초</small><img src="${b64(`burst_${m}_${i}`)}" style="width:160px"></td>`).join('');
await page.setContent(`<style>${css}</style><h2>말풍선 줄 — 412 큰 마을 낮 · 손님 4명이 동시에 말함 · 1.5초 간격</h2><table><tr><td><b>전</b></td>${strip('before')}</tr><tr><td><b>후</b></td>${strip('after')}</tr></table>`);
await page.screenshot({ path: `${OUT}/SHEET_burst${SUF}.png`, fullPage: true });
await br.close();
console.error(errs.length ? '✗ 오류:\n' + errs.join('\n') : '✓ 페이지 오류 0');
process.exit(errs.length ? 1 : 0);
