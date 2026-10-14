// CHECKIN §J7 대장간 「영웅 중심 한 화면」 e2e (플래그 smithOne · 실험실)
//  1) 터치 수 「★ 영웅 무기 한 번 강화」: 전(BEFORE · 예전 탭 5개 · 읽기만) vs 후(URL + 실험실) — 대장간 창 열기부터
//  2) 같은 장비 같은 단계(+6 → +7)를 예전 강화 / 새 행동 판으로 한 번씩 → 가루·보스 재료 차감이 똑같은지
//  3) 후: 판이 그대로 남아 연달아 · 연출(망치·불꽃·숫자) 0.3초(흔들림 끔 기본)·누르면 바로 끝 · +10 초월(금화 = 버튼의 비용) · 재련 · 제작 · 가방 정리(한 번에 분해·한 개 분해)
//         · 자동 장착(빈 칸 → 채워짐) · 「지금 할 만한 것」 누르기 · 맨 위 레벨업 줄(공사 시작) · 지붕 색 · 실험실 끔 = 예전 탭 5개
//  실행: URL=http://localhost:4391/ BEFORE=http://localhost:4310/ node scripts/e2e-j7.mjs
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const URL = process.env.URL ?? 'http://localhost:4391/';
const BEFORE = process.env.BEFORE ?? 'http://localhost:4310/';
const SAVE = process.env.SAVE ?? 'tests/fixtures/real_woongs.json';
const b = await chromium.launch({ channel: 'chrome' });
const errs = [];
let fail = 0;
const ok = (c, m) => { console.error((c ? '✓ ' : '✗ ') + m); if (!c) fail++; };
const AND = 'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36';
const dev = (w, h) => ({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: AND });
fs.mkdirSync('screenshots/j7', { recursive: true });

async function boot(url, lab) {
  const sv = JSON.parse(fs.readFileSync(SAVE, 'utf8'));
  const cx0 = await b.newContext();
  const VER = JSON.stringify((await (await cx0.request.get(url + 'version.json')).json()).version);
  await cx0.close();
  const ctx = await b.newContext(dev(412, 915));
  await ctx.addInitScript(([s, ver, lab]) => {
    try { if (sessionStorage.getItem('x')) return; sessionStorage.setItem('x', 1); } catch { return; }
    localStorage.clear();
    localStorage.setItem('legacy-of-adventure-save', s);
    localStorage.setItem('legacy-of-adventure-teaserSeen', 'true');
    localStorage.setItem('legacy-of-adventure-lastVersion', ver);
    localStorage.setItem('legacy-of-adventure-settleOff', 'true');
    localStorage.setItem('legacy-of-adventure-telemetry', 'false');
    localStorage.setItem('legacy-of-adventure-sound', JSON.stringify({ bgmOn: false, bgmVol: 0.4, sfxOn: false, sfxVol: 0.7, muted: true }));
    if (lab) localStorage.setItem('legacy-of-adventure-visualLab', 'true');
  }, [JSON.stringify({ ...sv, clock: 6 * 60, night: false }), VER, lab]);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(`${url}${lab ? ' lab' : ''}: ${String(e).slice(0, 200)}`));
  p.on('dialog', (d) => d.accept());
  await p.goto(url, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => !!window.__S && !!document.querySelector('#tCont'), null, { timeout: 30000 });
  await p.locator('#tCont').click();
  await p.waitForFunction(() => window.__S.started && !document.querySelector('#hud').hidden, null, { timeout: 20000 });
  const calm = () => p.evaluate(async () => {
    const T = (ms) => new Promise((r) => setTimeout(r, ms));
    for (let i = 0, quiet = 0; i < 60 && quiet < 3; i++) {
      let busy = false;
      if (!document.querySelector('#dlg').hidden) { document.querySelector('#dlg').click(); busy = true; }
      else if (document.querySelector('#win').classList.contains('on')) { document.querySelector('#winX').click(); busy = true; }
      quiet = busy ? 0 : quiet + 1;
      await T(busy ? 120 : 250);
    }
  });
  await calm();
  await p.waitForTimeout(800);
  await calm();
  // 같은 준비 (전·후 똑같이): ★ = 전투력 1등 · 3등 · 1등 무기 +6 · 넉넉한 가루·재료·금화 · 부적·숫돌 없음
  const st = await p.evaluate(() => {
    const W = window.__world;
    const P = window.__P;
    const hs = W.actors.filter((a) => !a.role && (a.status === 'regular' || a.status === 'hero')).sort((a, b) => window.__power(b) - window.__power(a));
    P.growth.favs = [hs[0].id, hs[2].id];
    P.growth.charm = 0;
    P.growth.whet = 0;
    for (const g of ['n', 'r', 'e', 'l', 'a']) P.dust[g] = 1_000_000;
    for (const k of Object.keys(P.mats)) P.mats[k] = 100_000;
    for (const k of Object.keys(P.bossMats)) P.bossMats[k] = 100_000;
    window.__S.gold = 1e9;
    const wp = P.bag.find((it) => it.id === hs[0].equip.weapon);
    wp.enh = 6;
    delete wp.ePity;
    return { hero: hs[0].id, name: hs[0].name, weapon: wp.id, grade: wp.grade, region: wp.region };
  });
  return { ctx, p, calm, st };
}
const W = (p, ms) => p.waitForTimeout(ms);
const openSmith = async (p) => {
  await p.evaluate(() => window.__showObj(window.__world.objs.find((o) => o.kind === 'smith')));
  await W(p, 500);
};
const delta = (a, b) => { const o = {}; for (const k of Object.keys(a)) if (a[k] !== b[k]) o[k] = b[k] - a[k]; return o; };
/** 누르기: 창 몸통 밖(가려짐)이면 한 번 밀기(스크롤)로 셈 */
async function tap(p, c, sel, why) {
  const loc = p.locator(sel).first();
  await loc.waitFor({ state: 'attached', timeout: 8000 });
  const vis = await loc.evaluate((el) => { const r = el.getBoundingClientRect(); if (!r.width) return false; const x = r.left + r.width / 2, y = r.top + r.height / 2; if (y < 0 || y > innerHeight) return false; const e = document.elementFromPoint(x, y); return !!e && (e === el || el.contains(e)); });
  if (!vis) {
    c.scroll++;
    c.log.push(`↕ ${why}`);
    await loc.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await W(p, 200);
  }
  c.tap++;
  c.log.push(`• ${why}`);
  await loc.click({ timeout: 6000 });
  await W(p, 350);
}

// ───────── 1)·2) 전: 예전 강화 탭 ─────────
const res = {};
{
  const { ctx, p, st } = await boot(BEFORE, false);
  const c = { tap: 1, scroll: 0, log: ['• 대장간 누르기'] };
  await openSmith(p);
  const s0 = await p.evaluate((wid) => { const P = window.__P; const it = P.bag.find((x) => x.id === wid); return { dust: { ...P.dust }, boss: { ...P.bossMats }, gold: window.__S.gold, enh: it.enh }; }, st.weapon);
  await tap(p, c, '#winB .tabs .tab[data-t="1"]', '「강화」 탭');
  await tap(p, c, `[data-enh="${st.weapon}"]`, `★ ${st.name} 무기 +7`);
  const s1 = await p.evaluate((wid) => { const P = window.__P; const it = P.bag.find((x) => x.id === wid); return { dust: { ...P.dust }, boss: { ...P.bossMats }, gold: window.__S.gold, enh: it.enh }; }, st.weapon);
  res.before = { touches: c.tap + c.scroll, tap: c.tap, scroll: c.scroll, log: c.log, dust: delta(s0.dust, s1.dust), boss: delta(s0.boss, s1.boss), gold: s1.gold - s0.gold, enh: [s0.enh, s1.enh] };
  ok(Object.keys(res.before.dust).length === 1, `전: 강화 한 번 · 가루 ${JSON.stringify(res.before.dust)} · 보스 ${JSON.stringify(res.before.boss)} · +${s0.enh}→+${s1.enh}`);
  await ctx.close();
}

// ───────── 후: 새 화면 ─────────
{
  const { ctx, p, st } = await boot(URL, true);
  const c = { tap: 1, scroll: 0, log: ['• 대장간 누르기'] };
  await openSmith(p);
  ok(await p.evaluate(() => !!document.querySelector('.smo-heroes') && document.querySelectorAll('#smT .tab').length === 3), '후: 탭 3개(장비 손질·제작·가방 정리) + 영웅 줄');
  const first = await p.evaluate(() => document.querySelector('.smo-heroes .hcd.on')?.dataset.hc);
  ok(+first === st.hero, `후: ★ 영웅(${st.name})이 먼저 · 골라져 있음`);
  ok(await p.evaluate(() => document.querySelector('.smo-slot.on')?.dataset.sl === 'weapon'), '후: 무기 칸이 골라져 있음');
  const label = await p.evaluate(() => document.querySelector('#smoGo')?.textContent);
  ok(/^강화 \+7 · 성공 \d+% · .+ \d/.test(label ?? ''), `후: 행동 판 [${label}]`);
  await p.screenshot({ path: 'screenshots/j7/panel.png' });
  const s0 = await p.evaluate((wid) => { const P = window.__P; const it = P.bag.find((x) => x.id === wid); return { dust: { ...P.dust }, boss: { ...P.bossMats }, gold: window.__S.gold, enh: it.enh }; }, st.weapon);
  await tap(p, c, '#smoGo', `[강화 +7] (${st.name} 무기)`);
  const s1 = await p.evaluate((wid) => { const P = window.__P; const it = P.bag.find((x) => x.id === wid); return { dust: { ...P.dust }, boss: { ...P.bossMats }, gold: window.__S.gold, enh: it.enh }; }, st.weapon);
  res.after = { touches: c.tap + c.scroll, tap: c.tap, scroll: c.scroll, log: c.log, dust: delta(s0.dust, s1.dust), boss: delta(s0.boss, s1.boss), gold: s1.gold - s0.gold, enh: [s0.enh, s1.enh] };
  ok(JSON.stringify(res.after.dust) === JSON.stringify(res.before.dust) && JSON.stringify(res.after.boss) === JSON.stringify(res.before.boss) && Math.abs(res.after.gold - res.before.gold) <= 60, `같은 장비 +6→+7 차감 같음: 가루 ${JSON.stringify(res.after.dust)} · 보스 ${JSON.stringify(res.after.boss)} · 금화 ${res.after.gold} (전 ${JSON.stringify(res.before.dust)} · ${JSON.stringify(res.before.boss)})`);
  // 연출 · 판 그대로
  ok(await p.evaluate(() => !!document.querySelector('#smoGo') && !!document.querySelector('.smo-panel')), '결과 뒤에도 판이 그대로 (연달아 누를 수 있음)');
  const fx = await p.evaluate(async () => {
    window.__P.dust.a = 1e6;
    const T = (ms) => new Promise((r) => setTimeout(r, ms));
    document.querySelector('#smoGo').click();
    const f = document.querySelector('.smo-fx');
    const has = !!f && !!f.querySelector('.smo-ham') && !!f.querySelector('.smo-spk') && !!f.querySelector('.smo-num');
    const dur = f?.style.getPropertyValue('--fxd');
    await T(450);
    const gone = !document.querySelector('.smo-fx');
    document.querySelector('#smoGo').click();
    const f2 = !!document.querySelector('.smo-fx');
    document.getElementById('winB').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    return { has, dur, gone, f2, skip: !document.querySelector('.smo-fx') };
  });
  ok(fx.has && fx.dur === '0.3s' && fx.gone && fx.f2 && fx.skip, `연출: 망치·불꽃·숫자 ${fx.has} · 길이 ${fx.dur} (흔들림 끔 기본) · 0.45초 뒤 사라짐 ${fx.gone} · 누르면 바로 끝 ${fx.skip}`);
  // 연출 한 장 (0.15초 지점)
  await p.evaluate(() => document.querySelector('#smoGo').click());
  await W(p, 150);
  await p.screenshot({ path: 'screenshots/j7/fx.png' }).catch(() => {});

  // +10 → 초월
  await p.evaluate((wid) => { const it = window.__P.bag.find((x) => x.id === wid); it.enh = 10; delete it.tPity; }, st.weapon);
  await p.evaluate(() => document.querySelector('.smo-slot[data-sl="weapon"]').click());
  await W(p, 300);
  const tl = await p.evaluate(() => document.querySelector('#smoGo')?.textContent ?? '');
  ok(/^초월 \+11 · 성공 \d+% · 금화 [\d,]+$/.test(tl), `+10 → [${tl}]`);
  const g0 = await p.evaluate(() => window.__S.gold);
  await p.evaluate(() => document.querySelector('#smoGo').click());
  await W(p, 300);
  const g1 = await p.evaluate(() => window.__S.gold);
  // 기다리는 동안 마을 수입이 몇 G 들어올 수 있다 → 수입만큼 허용 (≤ 60G)
  ok(Math.abs(g0 - g1 - +tl.replace(/.*금화 /, '').replace(/,/g, '')) <= 60, `초월: 금화 −${g0 - g1} = 버튼 비용`);

  // 재련: 옵션 있는 장비를 가진 영웅 → 칸 → [재련]
  const rf = await p.evaluate(() => {
    const P = window.__P;
    const it = P.bag.find((x) => x.owner != null && x.grade !== 'n' && x.opts.length && !x.opts.every((o) => o.u));
    return it ? { hero: it.owner, slot: it.slot, id: it.id, opts: JSON.stringify(it.opts) } : null;
  });
  if (rf) {
    await p.evaluate((h) => document.querySelector(`.smo-heroes [data-hc="${h}"]`).click(), rf.hero);
    await W(p, 300);
    await p.evaluate((s) => document.querySelector(`.smo-slot[data-sl="${s}"]`).click(), rf.slot);
    await W(p, 300);
    ok(await p.evaluate(() => !!document.querySelector('#smoRf')), '옵션 있는 장비 → 작은 [재련]');
    await p.evaluate(() => document.querySelector('#smoRf').click());
    await W(p, 300);
    ok(await p.evaluate(() => document.querySelector('#winT')?.textContent.startsWith('재련')), '재련 창');
    await p.evaluate(() => document.querySelector('#rfGo').click());
    await W(p, 400);
    if (await p.evaluate(() => !!document.querySelector('#cshOk'))) { await p.evaluate(() => document.querySelector('#cshOk').click()); await W(p, 400); }
    const after = await p.evaluate((id) => JSON.stringify(window.__P.bag.find((x) => x.id === id).opts), rf.id);
    ok(after !== rf.opts, '재련: 옵션 하나 바뀜');
    await p.evaluate(() => document.querySelector('#rfBack').click());
    await W(p, 300);
    ok(await p.evaluate(() => !!document.querySelector('.smo-heroes')), '재련 [돌아가기] → 대장간 한 화면');
  } else ok(false, '재련할 장비가 저장에 없음');

  // 자동 장착: 빈 칸 → 채워짐
  const ae = await p.evaluate(() => {
    const W = window.__world;
    const P = window.__P;
    const hs = W.actors.filter((a) => !a.role && a.status === 'regular' && a.runId == null && !P.growth.favs.includes(a.id) && a.equip?.weapon != null);
    const a = hs[hs.length - 1];
    const it = P.bag.find((x) => x.id === a.equip.weapon);
    it.owner = null;
    a.equip.weapon = null;
    return a.id;
  });
  await p.evaluate((h) => document.querySelector(`.smo-heroes [data-hc="${h}"]`).click(), ae);
  await W(p, 300);
  await p.evaluate(() => document.querySelector('#smoAuto').click());
  await W(p, 400);
  if (await p.evaluate(() => !!document.querySelector('#bOk'))) await p.evaluate(() => document.querySelector('#bOk').click());
  await W(p, 400);
  ok(await p.evaluate((h) => window.__world.actors.find((a) => a.id === h).equip.weapon != null && !!document.querySelector('.smo-heroes'), ae), '[자동 장착] → 빈 무기 칸 채움 → 대장간으로 돌아옴');

  // 가방 장비 카드 → 아무도 안 낀 장비 강화
  await p.evaluate(() => document.querySelector('.smo-heroes [data-hb]').click());
  await W(p, 300);
  const bagN = await p.evaluate(() => document.querySelectorAll('.smo-bag [data-bi]').length);
  ok(bagN > 0 && (await p.evaluate(() => !!document.querySelector('#smoGo'))), `「가방 장비」: 안 낀 장비 ${bagN}개 · 행동 판`);

  // 제작
  await p.evaluate(() => document.querySelector('#smT .tab[data-t="1"]').click());
  await W(p, 300);
  const n0 = await p.evaluate(() => window.__P.bag.length);
  await p.evaluate(() => document.querySelector('[data-cs="weapon"][data-n="1"]').click());
  await W(p, 400);
  ok((await p.evaluate(() => window.__P.bag.length)) === n0 + 1, '제작: 무기 1개 → 가방 +1');
  await openSmith(p);
  await p.evaluate(() => document.querySelector('#smT .tab[data-t="2"]').click());
  await W(p, 300);
  // 가방 정리: 한 번에 분해 → 확인 · 한 개 분해
  const b0 = await p.evaluate(() => window.__P.bag.length);
  const tidy = await p.evaluate(() => !!document.querySelector('#bagTidy:not([disabled])'));
  if (tidy) {
    await p.evaluate(() => document.querySelector('#bagTidy').click());
    await W(p, 300);
    await p.evaluate(() => document.querySelector('#tdGo').click());
    await W(p, 400);
    ok((await p.evaluate(() => window.__P.bag.length)) < b0 && (await p.evaluate(() => !!document.querySelector('#bagTidy'))), '가방 정리: [일반·희귀 한 번에 분해] → 줄어듦 → 가방 정리로 돌아옴');
  } else console.error('· 한 번에 분해할 일반·희귀 없음 (건너뜀)');
  const b1 = await p.evaluate(() => window.__P.bag.length);
  const sal = await p.evaluate(() => { const e = document.querySelector('[data-sal]'); if (!e) return false; e.click(); return true; });
  await W(p, 400);
  if (await p.evaluate(() => !!document.querySelector('#cshOk'))) { await p.evaluate(() => document.querySelector('#cshOk').click()); await W(p, 400); }
  ok(!sal || (await p.evaluate(() => window.__P.bag.length)) === b1 - 1, '가방 정리: 한 개 [분해]');

  // 맨 위: 지금 할 만한 것 · 지붕 색 · 레벨업 줄
  await openSmith(p);
  const pk = await p.evaluate(() => [...document.querySelectorAll('.smo-pick')].map((e) => e.textContent.trim()));
  ok(pk.length >= 1 && pk.length <= 2, `「지금 할 만한 것」 ${pk.length}개: ${pk.join(' | ')}`);
  await p.evaluate(() => document.querySelector('.smo-pick')?.click());
  await W(p, 300);
  ok(await p.evaluate(() => !!document.querySelector('.smo-panel') || !!document.querySelector('#bagTidy')), '할 만한 것 누르기 → 바로 그 화면');
  // R9: 지붕 색은 [건물]을 눌렀을 때만
  ok(await p.evaluate(() => document.querySelectorAll('[data-roof]').length === 0 && !!document.getElementById('smBld')), '지붕 색은 처음엔 숨김 · [건물] 버튼');
  await p.evaluate(() => document.getElementById('smBld').click());
  await p.waitForTimeout(300);
  const hue = await p.evaluate(() => { const b = document.querySelectorAll('[data-roof]')[2]; b.click(); return window.__world.objs.find((o) => o.kind === 'smith').hue; });
  ok(hue != null && (await p.evaluate(() => document.querySelectorAll('[data-roof]').length)) >= 5, `지붕 색 줄 → hue ${hue}`);
  ok(await p.evaluate(() => /Lv\.\d/.test(document.querySelector('.smo-top')?.textContent ?? '') && /장비 강화/.test(document.querySelector('.smo-top')?.textContent ?? '')), '맨 위 설명 + 레벨 줄');
  await p.evaluate(() => { const o = window.__world.objs.find((x) => x.kind === 'smith'); o.lvl = 3; });
  await openSmith(p);
  const upTxt = await p.evaluate(() => document.querySelector('#smUp')?.textContent ?? '');
  ok(/^Lv\.4 · /.test(upTxt), `레벨업 버튼 [${upTxt}]`);
  await p.evaluate(() => document.querySelector('#smUp').click());
  await W(p, 500);
  ok(await p.evaluate(() => !!window.__world.objs.find((x) => x.kind === 'smith').con), '레벨업 → 공사 시작 (다른 건물과 같은 game.upgrade)');
  await ctx.close();
}
// 실험실 끔 = 예전 탭 5개
{
  const { ctx, p } = await boot(URL, false);
  await openSmith(p);
  // v0.25.10부터 flags.json에서 smithOne 켬 → 실험실을 꺼도 새 화면 · 꺼져 있을 때만 예전 탭 5개
  const sOn = await p.evaluate(async () => { try { return (await (await fetch('flags.json', { cache: 'no-store' })).json()).smithOne === true; } catch { return false; } });
  ok(await p.evaluate((on) => (on ? !!document.querySelector('.smo-heroes') && document.querySelectorAll('#smT .tab').length === 3 : !document.querySelector('.smo-heroes') && document.querySelectorAll('#smT .tab').length === 5), sOn), sOn ? '실험실 끔 + flags.json smithOne 켬: 새 한 화면' : '실험실 끔: 예전 탭 5개 그대로');
  await ctx.close();
}
await b.close();
console.error(`\n★ 「★ 영웅 무기 한 번 강화」 터치: 전 ${res.before.touches} (탭 ${res.before.tap} · 스크롤 ${res.before.scroll}) → 후 ${res.after.touches} (탭 ${res.after.tap} · 스크롤 ${res.after.scroll})`);
console.error('  전: ' + res.before.log.join(' '));
console.error('  후: ' + res.after.log.join(' '));
fs.writeFileSync('screenshots/j7/taps.json', JSON.stringify(res, null, 1));
if (errs.length) console.error('✗ 오류\n' + errs.join('\n'));
console.error(fail || errs.length ? `✗ ${fail}개 실패` : '✓ e2e-j7 통과');
process.exit(fail || errs.length ? 1 : 0);
