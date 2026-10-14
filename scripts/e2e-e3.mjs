// CHECKIN §E 보상 순간 (checkinFx) + §J3 글 대신 카드 (uiCards) e2e — 둘 다 꺼짐 · 실험실(「새 화면 미리 보기」)로 켬
//  1) 원정 보고서 체크아웃 영수증: 한 줄씩 찍힘(0.08초 · 전체 ≤1초) · 탭하면 다 찍힘 · 희귀 이상 줄 금빛 · 조용(흔들림 끔)이면 ≤0.3초
//  2) 출석 도장 「쿵」 0.4초(조용 0.3) · 단골 도장 · 첫 원정 열쇠 0.6초
//  3) 레벨업 배너 ≤1초 · 탭하면 바로 닫힘
//  4) 건설 그림 타일: 금화 모자란 칸만 빨간 숫자(−n) + 어둡게 · 지을 수 있는 칸·잠긴 칸은 빨간 숫자 없음
//  5) 사냥 전투 결과: 별 1~3 · MVP 초상 + 한 마디 · 드랍 칸 · [다시 하기] [다음 x-y] · 영수증
//  6) 실험실 끔 = 예전 그대로 (영수증·별·타일 표시 없음 · 예전 말투)
//  실행: URL=http://localhost:4411/ node scripts/e2e-e3.mjs
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const URL = process.env.URL ?? 'http://localhost:4411/';
const SAVE = process.env.SAVE ?? 'tests/fixtures/real_woongs.json';
const OUT = 'reports/checkin/e3e2e';
fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ channel: 'chrome' });
const errs = [];
let fail = 0;
const ok = (c, m) => { console.error((c ? '✓ ' : '✗ ') + m); if (!c) fail++; };
const AND = 'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36';
const dev = { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: AND };

async function boot(lab, shake = 'normal') {
  const sv = JSON.parse(fs.readFileSync(SAVE, 'utf8'));
  const cx0 = await b.newContext();
  const VER = JSON.stringify((await (await cx0.request.get(URL + 'version.json')).json()).version);
  await cx0.close();
  const ctx = await b.newContext(dev);
  await ctx.addInitScript(([s, ver, lab, shake]) => {
    try { if (sessionStorage.getItem('x')) return; sessionStorage.setItem('x', 1); } catch { return; }
    localStorage.clear();
    localStorage.setItem('legacy-of-adventure-save', s);
    localStorage.setItem('legacy-of-adventure-teaserSeen', 'true');
    localStorage.setItem('legacy-of-adventure-lastVersion', ver);
    localStorage.setItem('legacy-of-adventure-settleOff', 'true');
    localStorage.setItem('legacy-of-adventure-telemetry', 'false');
    localStorage.setItem('legacy-of-adventure-shake', JSON.stringify(shake));
    localStorage.setItem('legacy-of-adventure-sound', JSON.stringify({ bgmOn: false, bgmVol: 0.4, sfxOn: false, sfxVol: 0.7, muted: true }));
    if (lab) localStorage.setItem('legacy-of-adventure-visualLab', 'true');
  }, [JSON.stringify({ ...sv, clock: 6 * 60, night: false }), VER, lab, shake]);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(`${lab ? 'lab' : 'off'}: ${String(e).slice(0, 200)}`));
  p.on('dialog', (d) => d.accept());
  await p.goto(URL, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => !!window.__S && !!document.querySelector('#tCont'), null, { timeout: 30000 });
  await p.locator('#tCont').click();
  await p.waitForFunction(() => window.__S.started && !document.querySelector('#hud').hidden, null, { timeout: 20000 });
  await calm(p);
  await p.waitForTimeout(800);
  await calm(p);
  return { p, ctx };
}
const calm = (p) => p.evaluate(async () => {
  const T = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0, quiet = 0; i < 60 && quiet < 3; i++) {
    let busy = false;
    if (!document.querySelector('#dlg').hidden) { document.querySelector('#dlg').click(); busy = true; }
    else if (document.querySelector('#win').classList.contains('on')) { document.querySelector('#winX').click(); busy = true; }
    quiet = busy ? 0 : quiet + 1;
    await T(busy ? 120 : 250);
  }
});

/** 끝난 원정 하나 → 저절로 뜨는 보고서(대화 → 영수증 창)까지 · 대화만 넘기고 창은 그대로 */
async function openReport(p, id, rare = true) {
  await p.evaluate(async ([id, rare]) => {
    const T = (ms) => new Promise((r) => setTimeout(r, ms));
    const P = window.__P, w = window.__world;
    const ms = w.actors.filter((x) => (x.status === 'regular' || x.status === 'hero') && x.runId == null && !x.leaving).slice(0, 3);
    const q = P.quests.list.find((x) => !x.tutorial && !x.guild) ?? P.quests.list[0];
    P.runs.push({ id, quest: { ...q, tier: rare ? 5 : q.tier }, members: ms.map((a) => a.id), start: Date.now() - 120000, end: Date.now() - 500 });
    for (const a of ms) { a.runId = id; a.hp = 100; }
    for (let i = 0; i < 40 && !P.runs.find((r) => r.id === id)?.result; i++) await T(250);
  }, [id, rare]);
  // 대화를 넘기면 보고서 창
  for (let i = 0; i < 60; i++) {
    const st = await p.evaluate(() => ({ dlg: !document.querySelector('#dlg').hidden, t: document.querySelector('#win.on #winT')?.textContent ?? '' }));
    if (/다녀오셨어요 ·|원정 보고서/.test(st.t)) return st.t;
    if (st.dlg) await p.evaluate(() => document.querySelector('#dlg').click());
    else if (st.t) await p.evaluate(() => document.querySelector('#winX').click());
    await p.waitForTimeout(st.dlg ? 60 : 200);
  }
  return '';
}

// ───────── 실험실 켬 · 흔들림 보통 (연출 제 길이) ─────────
{
  const { p, ctx } = await boot(true, 'normal');
  // 1) 영수증
  const t1 = await openReport(p, 990301);
  ok(/^다녀오셨어요 · /.test(t1), `보고서 창 제목 = 프런트 말투 (${t1})`);
  const r0 = await p.evaluate(() => ({ n: document.querySelectorAll('#winB .rcpt .rc-l').length, wait: document.querySelectorAll('#winB .rcpt .rc-wait').length, rc: window.__checkin.rc(), old: !!document.querySelector('#winB .rew') }));
  ok(r0.n >= 3 && !r0.old, `영수증 한 장 · 줄 ${r0.n} (예전 「금화 · 경험치」 줄 없음)`);
  ok(r0.wait > 0, `열자마자 아직 안 찍힌 줄 ${r0.wait}`);
  ok(Math.abs(r0.rc.step - Math.min(0.08, 1 / r0.rc.n)) < 0.001 && r0.rc.total <= 1, `한 줄 ${r0.rc.step.toFixed(3)}초 · 전체 ${r0.rc.total.toFixed(2)}초 (≤1)`);
  await p.screenshot({ path: `${OUT}/rcpt_mid.png` });
  await p.waitForTimeout(r0.rc.total * 1000 + 200);
  const r1 = await p.evaluate(() => ({ wait: document.querySelectorAll('#winB .rcpt .rc-wait').length, rc: window.__checkin.rc(), gold: [...document.querySelectorAll('#winB .rcpt .rc-g')].map((x) => x.textContent), items: window.__P.runs.find((r) => r.id === 990301)?.result?.items.map((it) => it.grade) ?? [] }));
  ok(r1.wait === 0 && r1.rc.done && !r1.rc.skipped, `다 찍힘 (${Math.round(r1.rc.doneAt - r1.rc.at)}ms)`);
  ok(r1.gold.length === r1.items.filter((g) => g !== 'n').length, `희귀 이상 줄만 금빛 ${r1.gold.length} (장비 등급 ${r1.items.join('')})`);
  await p.screenshot({ path: `${OUT}/rcpt_done.png` });
  // 탭하면 다 찍힘
  await p.evaluate(() => document.querySelector('#repOk')?.click());
  await calm(p);
  await openReport(p, 990302);
  const r2 = await p.evaluate(async () => {
    const w0 = document.querySelectorAll('#winB .rcpt .rc-wait').length;
    document.querySelector('#winB .rcpt').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 30));
    return { w0, w1: document.querySelectorAll('#winB .rcpt .rc-wait').length, rc: window.__checkin.rc() };
  });
  ok(r2.w0 > 0 && r2.w1 === 0 && r2.rc.skipped, `탭하면 다 찍힘 (남은 줄 ${r2.w0} → ${r2.w1})`);
  await p.evaluate(() => document.querySelector('#repOk')?.click());
  await calm(p);

  // 2) 출석 도장 · 단골 도장 · 열쇠
  const s1 = await p.evaluate(async () => {
    const P = window.__P;
    P.meta.attend.last = '';
    window.__dailyAttend();
    window.__openMenu();
    await new Promise((r) => setTimeout(r, 400));
    const t = [...document.querySelectorAll('#winB button, #winB .mtile, #winB [role=button]')].find((x) => /^\s*출석/.test(x.textContent ?? ''));
    t?.click();
    const t0 = performance.now();
    await new Promise((r) => setTimeout(r, 60));
    const fx = document.querySelector('.atc .stampfx');
    const anim = fx ? getComputedStyle(fx).animationDuration : '';
    await new Promise((r) => setTimeout(r, 500));
    return { title: document.querySelector('#winT')?.textContent, on: !!fx, anim, st: window.__checkin.stamp(), dt: performance.now() - t0, marks: document.querySelectorAll('.atc .atst').length, got: document.querySelectorAll('.atc.got').length };
  });
  ok(s1.on && s1.anim === '0.4s' && s1.st.kind === 'checkin' && s1.st.dur === 0.4, `출석 도장 「쿵」 ${s1.anim} (${s1.title})`);
  ok(s1.marks === s1.got - 1, `지난 칸은 작은 도장 ${s1.marks}/${s1.got - 1}`);
  await p.screenshot({ path: `${OUT}/attend.png` });
  await calm(p);
  const s2 = await p.evaluate(async () => {
    const a = window.__world.actors.find((x) => x.status === 'regular');
    window.__checkin.regularStamp(a);
    await new Promise((r) => setTimeout(r, 100));
    const on = !!document.querySelector('.regfx .hcd .stampfx');
    await new Promise((r) => setTimeout(r, 1000));
    return { on, gone: !document.querySelector('.regfx') };
  });
  ok(s2.on && s2.gone, '단골 되면 숙박 카드에 도장 · 1초 안에 사라짐');
  const k1 = await p.evaluate(async () => {
    window.__checkin.keyFx();
    const el = document.querySelector('.keyfx');
    const anim = el ? getComputedStyle(el).animationDuration : '';
    await new Promise((r) => setTimeout(r, 700));
    return { anim, gone: !document.querySelector('.keyfx'), k: window.__checkin.key() };
  });
  ok(k1.anim === '0.6s' && k1.gone, `첫 원정 열쇠 ${k1.anim} · 끝나면 사라짐`);

  // 3) 배너
  const bn = await p.evaluate(async () => {
    window.__checkin.bannerFx('여관 Lv.3');
    const on = !!document.querySelector('.lvban');
    await new Promise((r) => setTimeout(r, 1050));
    const gone = !document.querySelector('.lvban');
    window.__checkin.bannerFx('렌린 Lv.30');
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 20));
    return { on, gone, tap: !document.querySelector('.lvban') };
  });
  ok(bn.on && bn.gone && bn.tap, '레벨업 배너 가운데 · 1초 뒤 사라짐 · 탭하면 바로');
  // 실제 흐름: 건물 레벨업 공사가 끝나면 배너
  const bn2 = await p.evaluate(async () => {
    const W = window.__world; const objs = W.home?.objs ?? W.objs;
    const o = objs.find((x) => x.kind === 'tavern') ?? objs.find((x) => x.kind === 'inn');
    o.con = { kind: 'up', end: Date.now() - 1, total: 10, to: o.lvl + 1, cut: 0, cost: 0 };
    const t0 = performance.now();
    for (let i = 0; i < 40 && !document.querySelector('.lvban'); i++) await new Promise((r) => setTimeout(r, 50));
    const txt = document.querySelector('.lvban')?.textContent ?? '';
    const t1 = performance.now();
    for (let i = 0; i < 40 && document.querySelector('.lvban'); i++) await new Promise((r) => setTimeout(r, 50));
    return { txt, life: Math.round(performance.now() - t1), lv: o.lvl };
  });
  ok(/레벨업!.*Lv\.\d+/.test(bn2.txt) && bn2.life <= 1100, `공사 끝 → 배너 「${bn2.txt}」 · ${bn2.life}ms 뒤 사라짐`);

  // 4) 건설 타일
  const bt = await p.evaluate(async () => {
    window.__S.gold = 700;
    document.querySelector('#bBuild').click();
    await new Promise((r) => setTimeout(r, 500));
    const all = [...document.querySelectorAll('#winB .cat.j3 button[data-k]')];
    const red = (x) => getComputedStyle(x).color;
    const poor = all.filter((x) => x.classList.contains('poor'));
    const misses = all.filter((x) => x.querySelector('small.miss'));
    const okTiles = all.filter((x) => !x.classList.contains('poor') && !x.classList.contains('locked'));
    const g = window.__S.gold;
    const numOk = poor.every((x) => { const s = x.querySelector('small.miss').textContent.replace(/[^0-9−,]/g, ''); const [cost, miss] = s.split('−').map((v) => +v.replace(/,/g, '')); return cost - g === miss; });
    return { n: all.length, poor: poor.length, misses: misses.length, okMiss: okTiles.filter((x) => x.querySelector('small.miss')).length, lockedMiss: all.filter((x) => x.classList.contains('locked') && x.querySelector('small.miss')).length, color: misses[0] ? red(misses[0].querySelector('small.miss')) : '', dark: poor[0] ? getComputedStyle(poor[0].querySelector('img')).filter : '', numOk };
  });
  ok(bt.n > 5 && bt.poor > 0 && bt.misses === bt.poor && bt.okMiss === 0 && bt.lockedMiss === 0, `건설 타일 ${bt.n} · 금화 모자란 칸만 빨간 숫자 ${bt.misses}/${bt.poor} (지을 수 있는 칸·잠긴 칸 0)`);
  ok(/255, 122, 106/.test(bt.color) && /brightness/.test(bt.dark) && bt.numOk, `빨간 숫자 ${bt.color} · 어둡게 ${bt.dark} · −n = 비용 − 금화`);
  await p.screenshot({ path: `${OUT}/build.png` });
  await calm(p);

  // 5) 사냥 전투 결과
  const br = await p.evaluate(async () => {
    const T = (ms) => new Promise((r) => setTimeout(r, ms));
    const P = window.__P; P.hunt.auto = null;
    for (const a of window.__world.actors) if (a.id) a.hp = 100;
    window.__openHunt('forest');
    await T(700);
    document.querySelector('[data-s="3"]')?.click();
    await T(700);
    document.querySelector('#hMan')?.click();
    for (let i = 0; i < 40 && !window.__combat.field(); i++) await T(150);
    const f = window.__combat.field();
    if (!f) return { err: 'no field' };
    await T(800);
    f.allies.forEach((u, i) => (u.dealt = 100 * (i + 1)));
    f.downs = 0;
    f.time = 110;
    f.done = 'win';
    f.doneT = 2;
    window.__combat.advance(0.1);
    for (let i = 0; i < 30 && document.querySelector('#cbRes')?.hidden !== false; i++) { window.__combat.advance(0.05); await T(100); }
    const best = f.allies.reduce((m, u) => ((u.dealt ?? 0) > (m.dealt ?? 0) ? u : m));
    const c = document.querySelector('#cbRes');
    return {
      stars: c?.querySelector('.bstars')?.dataset.stars, why: [...(c?.querySelectorAll('.bwhy i.on') ?? [])].map((x) => x.textContent.trim()),
      mvp: +(c?.querySelector('.bmvp')?.dataset.mvp ?? 0), mvpWant: best.actor?.id, line: c?.querySelector('.bmvp q')?.textContent,
      drops: !!c?.querySelector('.bdrops'), rc: c?.querySelectorAll('.rcpt .rc-l').length ?? 0,
      btns: [...(c?.querySelectorAll('.go button') ?? [])].map((x) => x.id + ':' + x.textContent.trim()),
    };
  });
  ok(!br.err && +br.stars >= 2 && br.why.includes('✓ 안 쓰러짐') && br.why.includes('✓ 빠르게'), `전투 결과 별 ${br.stars}개 (${br.why.join(' · ')}) ${br.err ?? ''}`);
  ok(br.mvp && br.mvp === br.mvpWant && !!br.line, `MVP = 가장 많이 때린 손님 (${br.mvp}) · 「${br.line}」`);
  ok(br.drops && br.rc >= 3, `드랍 칸 · 영수증 ${br.rc}줄`);
  ok(br.btns?.[0]?.startsWith('cAgain:다시 하기') && /^cNext:다음 /.test(br.btns?.[1] ?? ''), `버튼 [다시 하기] [다음 …] (${(br.btns ?? []).join(' | ')})`);
  await p.screenshot({ path: `${OUT}/battle.png` });
  await ctx.close();
}

// ───────── 실험실 켬 · 흔들림 끔(기본) = 조용: 0.3초 이하 ─────────
{
  const { p, ctx } = await boot(true, 'off');
  await openReport(p, 990303);
  const r = await p.evaluate(() => window.__checkin.rc());
  ok(r.total <= 0.3, `조용: 영수증 전체 ${r.total.toFixed(2)}초 (≤0.3)`);
  const s = await p.evaluate(() => { window.__checkin.stampFx('ledger'); window.__checkin.keyFx(); return { st: window.__checkin.stamp(), k: window.__checkin.key() }; });
  ok(s.st.dur <= 0.3 && s.k.dur <= 0.3, `조용: 도장 ${s.st.dur}초 · 열쇠 ${s.k.dur}초`);
  await ctx.close();
}

// ───────── 실험실 끔 = 예전 그대로 ─────────
{
  const { p, ctx } = await boot(false, 'normal');
  const t = await openReport(p, 990304);
  const o = await p.evaluate(() => ({ rc: !!document.querySelector('.rcpt'), rew: !!document.querySelector('#winB .rew'), ok: document.querySelector('#repOk')?.textContent }));
  ok(/^원정 보고서 · /.test(t) && !o.rc && o.rew, `끔: 예전 보고서 (${t} · [${o.ok}])`);
  await p.evaluate(() => document.querySelector('#repOk')?.click());
  await calm(p);
  const o2 = await p.evaluate(async () => {
    window.__checkin.stampFx('checkin'); window.__checkin.bannerFx('x'); window.__checkin.keyFx();
    const fx = !!document.querySelector('.stampfx,.lvban,.keyfx');
    document.querySelector('#bBuild').click();
    await new Promise((r) => setTimeout(r, 500));
    return { fx, j3: !!document.querySelector('.cat.j3'), miss: !!document.querySelector('small.miss') };
  });
  ok(!o2.fx && !o2.j3 && !o2.miss, '끔: 도장·배너·열쇠·건설 타일 표시 없음');
  await ctx.close();
}

await b.close();
if (errs.length) console.error('페이지 오류:\n' + errs.join('\n'));
console.error(fail || errs.length ? `✗ 실패 ${fail} · 오류 ${errs.length}` : '✓ e2e-e3 모두 통과');
process.exit(fail || errs.length ? 1 : 0);
