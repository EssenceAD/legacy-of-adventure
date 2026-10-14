// 「회색 버튼엔 이유」 비교 시트: 토벌 막힘 3가지 + 대장간 모자람 표시 · 폭 360 · 412 (낮) · 전/후
//  장면마다 막힌 버튼을 한 번 눌러 본다 (전 = 아무 일 없음 · 후 = 이유 토스트) · 대장간은 모자란 재료도 눌러 「얻는 곳」
//  실행: node scripts/shot-why.mjs <before|after> <URL>   →  reports/checkin/whyLocked/<장면>_<label>_<폭>.png (+ index.html 은 둘 다 찍은 뒤)
//  저장: tests/fixtures/real_woongs.json (BOT_BUILD 빌드 · shot-checkin.mjs 와 같은 준비)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const [label = 'after', URL = 'http://localhost:4190/'] = process.argv.slice(2);
const OUT = 'reports/checkin/whyLocked';
fs.mkdirSync(OUT, { recursive: true });
const sv = JSON.parse(fs.readFileSync('tests/fixtures/real_woongs.json', 'utf8'));
const AND = 'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36';
const SIZES = {
  360: { viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: AND },
  412: { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: AND },
};
// 장면 본문 (page 안) — 마지막에 막힌 버튼을 누르고 그 모습을 찍는다
const PRE = `const T = (ms) => new Promise((r) => setTimeout(r, ms)); const W = window.__world; const P = window.__P; const S = window.__S;
const crew = W.actors.filter((a) => !a.role && (a.status === 'regular' || a.status === 'hero')).sort((a, b) => window.__power(b) - window.__power(a));
const tap = (sel) => { const e = document.querySelector(sel); if (e) { e.scrollIntoView({ block: 'center' }); e.click(); } return !!e; };
const dlg = async () => { for (let i = 0; i < 30 && !document.querySelector('#dlg').hidden; i++) { document.querySelector('#dlg').click(); await T(150); } };
const alive = () => { P.raid.killed = false; P.raid.hpLeft = Math.max(P.raid.hpLeft, 1000); };`;
const SCENES = {
  // 1) 오늘 도전 다 씀
  raidTries: `alive(); P.raid.day = (() => { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); })(); P.raid.tries = 4;
    await window.__openRaid(); await T(800); await dlg(); tap('#rgAuto'); await T(300);`,
  // 2) 갈 단골 없음: 1·2등 원정 중 · 나머지 지침
  raidCrew: `alive(); crew.slice(0, 2).forEach((a, i) => { P.runs.push({ id: 9950 + i, start: Date.now() - 60e3, end: Date.now() + 181e3, members: [a.id], quest: { id: 9950 + i, region: 'forest', tier: 0, power: 10, minutes: 4, gold: [1, 1] } }); a.runId = 9950 + i; });
    W.actors.filter((a) => !a.role && a.runId == null).forEach((a) => (a.hp = Math.min(a.hp, 18)));
    await window.__openRaid(); await T(800); await dlg(); tap('#rgAuto'); await T(300);`,
  // 3) 이번 주 보스 처치 (도전장 단계)
  raidDead: `await window.__openRaid(); P.raid.hpLeft = 0; P.raid.killed = true; window.__closeWin?.(); await window.__openRaid(); await T(800); await dlg(); tap('#rgAuto'); await T(300);`,
  // 4) 대장간 강화 +9 → +10 (보스 재료 모자람) · 모자란 재료 누름
  smithEnh: `const wp = P.bag.find((it) => it.id === crew[0].equip.weapon); wp.enh = 9; P.dust[wp.grade] = Math.max(P.dust[wp.grade], 5000);
    for (const k of Object.keys(P.bossMats)) P.bossMats[k] = 0; P.growth.favs = [crew[0].id];
    window.__showObj(W.objs.find((o) => o.kind === 'smith')); await T(600); await dlg();
    tap('.smo-slot[data-sl="weapon"]'); await T(400); tap('.cst.bad'); await T(200); tap('#smoGo'); await T(300); document.querySelector('#smoPanel')?.scrollIntoView({ block: 'start' }); await T(200);`,
  // 5) 대장간 초월 +10 → +11 (금화·재료 모자람)
  smithTr: `const wp = P.bag.find((it) => it.id === crew[0].equip.weapon); wp.enh = 10; S.gold = 1000; P.mats[wp.region] = 1;
    for (const k of Object.keys(P.bossMats)) P.bossMats[k] = 1; P.growth.favs = [crew[0].id];
    const sm = W.objs.find((o) => o.kind === 'smith'); sm.lvl = Math.max(sm.lvl, 5);
    window.__showObj(sm); await T(600); await dlg();
    tap('.smo-slot[data-sl="weapon"]'); await T(400); tap('.cst.bad'); await T(200); tap('#smoGo'); await T(300); document.querySelector('#smoPanel')?.scrollIntoView({ block: 'start' }); await T(200);`,
};
const b = await chromium.launch({ channel: 'chrome' });
const VER = await (async () => { const c = await b.newContext(); const v = (await (await c.request.get(URL + 'version.json')).json()).version; await c.close(); return JSON.stringify(v); })();
const errs = [];
for (const [name, body] of Object.entries(SCENES))
  for (const [w, dev] of Object.entries(SIZES)) {
    const save = JSON.stringify({ ...sv, clock: 6 * 60, night: false });
    const ctx = await b.newContext(dev);
    await ctx.addInitScript(([s, ver]) => {
      try { if (sessionStorage.getItem('x')) return; sessionStorage.setItem('x', 1); } catch { return; }
      localStorage.clear();
      localStorage.setItem('legacy-of-adventure-save', s);
      localStorage.setItem('legacy-of-adventure-teaserSeen', 'true');
      localStorage.setItem('legacy-of-adventure-lastVersion', ver);
      localStorage.setItem('legacy-of-adventure-settleOff', 'true');
      localStorage.setItem('legacy-of-adventure-telemetry', 'false');
      localStorage.setItem('legacy-of-adventure-sound', JSON.stringify({ bgmOn: false, bgmVol: 0.4, sfxOn: false, sfxVol: 0.7, muted: true }));
    }, [save, VER]);
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errs.push(`${name}/${w}: ${String(e).slice(0, 160)}`));
    await p.goto(URL, { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => !!window.__S && !!document.querySelector('#tCont'), null, { timeout: 30000 });
    await p.locator('#tCont').click();
    await p.waitForFunction(() => window.__S.started && !document.querySelector('#hud').hidden, null, { timeout: 20000 });
    const clear = () => p.evaluate(async () => {
      const T = (ms) => new Promise((r) => setTimeout(r, ms));
      for (let i = 0, calm = 0; i < 60 && calm < 3; i++) {
        let busy = false;
        if (!document.querySelector('#dlg').hidden) { document.querySelector('#dlg').click(); busy = true; }
        else if (document.querySelector('#win').classList.contains('on')) { document.querySelector('#winX').click(); busy = true; }
        calm = busy ? 0 : calm + 1;
        await T(busy ? 120 : 250);
      }
    });
    await clear();
    await p.waitForTimeout(800);
    await clear();
    try {
      await p.evaluate(`(async () => { ${PRE}\n${body}\n })()`);
    } catch (e) {
      errs.push(`${name}/${w} 장면: ${String(e).slice(0, 200)}`);
    }
    await p.waitForTimeout(250);
    await p.screenshot({ path: `${OUT}/${name}_${label}_${w}.png` });
    await ctx.close();
  }
await b.close();
// 비교 시트 (전·후 둘 다 있으면)
const names = Object.keys(SCENES);
const cap = { raidTries: '토벌 · 오늘 도전 다 씀', raidCrew: '토벌 · 갈 단골 없음 (원정 중·지침)', raidDead: '토벌 · 이번 주 보스 처치', smithEnh: '대장간 · 강화 +10 보스 재료 모자람', smithTr: '대장간 · 초월 금화·재료 모자람' };
const rows = names
  .map((n) => `<h2>${cap[n]}</h2><div class="row">${['360', '412'].map((w) => ['before', 'after'].map((l) => `<figure><img src="${n}_${l}_${w}.png"><figcaption>${l === 'before' ? '전' : '후'} · ${w}</figcaption></figure>`).join('')).join('')}</div>`)
  .join('');
fs.writeFileSync(`${OUT}/index.html`, `<!doctype html><meta charset="utf-8"><title>회색 버튼엔 이유</title><style>body{background:#11142a;color:#e8ecff;font-family:sans-serif;margin:16px}h1{font-size:20px}h2{font-size:16px;margin:22px 0 8px}.row{display:flex;gap:10px;overflow-x:auto}figure{margin:0}img{width:200px;border:1px solid #445}figcaption{font-size:12px;text-align:center}</style><h1>회색 버튼엔 이유 — 전/후 (막힌 버튼을 한 번 누른 모습)</h1><p>전: disabled 라 눌러도 아무 일 없음 · 후: 회색 그대로 + 아래 한 줄 이유 + 누르면 이유 토스트 · 대장간은 모자란 재료 빨강 −n · 누르면 「얻는 곳」</p>${rows}`);
console.error(errs.length ? '✗ ' + errs.join('\n') : `✓ ${OUT}/*_${label}_* ${names.length * 2}장`);
process.exit(errs.length ? 1 : 0);
