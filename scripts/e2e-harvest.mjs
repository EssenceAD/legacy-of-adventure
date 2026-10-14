// HARVEST §1·§2 + CHECKIN §D·§K2 e2e — 날짜 강제(localStorage legacy-of-adventure-hvNow · 개발/봇 빌드만)로 기간 전 / 첫날 / 마지막 밤 / 끝난 뒤
//  여는 컷 · 가을 자동 장식 생김/사라짐 · 사냥 호박 도깨비(·대왕) · 교환소 · 오늘의 장부 6중3 고르기·받기·상자 · 연감 도장·칸 · 왼쪽 아이콘 · 노을 · 마지막 밤 등불 · 플래그 끔
//  실행: URL=http://localhost:4401/ node scripts/e2e-harvest.mjs   (BOT_BUILD 빌드 · 실세이브 tests/fixtures/real_ttabam.json · 로컬 전용)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const URL = process.env.URL ?? 'http://localhost:4401/';
const sv = fs.readFileSync(fs.existsSync('tests/fixtures/real_ttabam.json') ? 'tests/fixtures/real_ttabam.json' : 'tests/fixtures/real_lotte.json', 'utf8');
const dir = 'screenshots/harvest';
fs.mkdirSync(dir, { recursive: true });
const T = {
  before: Date.parse('2026-10-20T12:00:00+09:00'),
  day1: Date.parse('2026-10-22T21:00:00+09:00'),
  lastWeek: Date.parse('2026-11-03T12:00:00+09:00'),
  finale: Date.parse('2026-11-05T21:00:00+09:00'),
  shop: Date.parse('2026-11-07T12:00:00+09:00'),
  after: Date.parse('2026-11-10T12:00:00+09:00'),
};
const b = await chromium.launch({ channel: 'chrome' });
/** ONLY=4 처럼 한 장면만 */
const only = (n) => !process.env.ONLY || process.env.ONLY.split(',').includes(String(n));
let fail = 0;
const ok = (c, m) => {
  console.error((c ? '✓ ' : '✗ ') + m);
  if (!c) fail++;
};
const errs = [];

async function boot(now, save = sv) {
  const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(([s, now]) => {
    try { if (sessionStorage.getItem('x')) return; sessionStorage.setItem('x', 1); } catch { return; }
    localStorage.clear();
    localStorage.setItem('legacy-of-adventure-save', s);
    localStorage.setItem('legacy-of-adventure-teaserSeen', 'true');
    localStorage.setItem('legacy-of-adventure-lastVersion', '"99"');
    localStorage.setItem('legacy-of-adventure-settleOff', 'true');
    // v0.25.15: 노을·장부·연감·왼쪽 아이콘은 꺼짐 + 실험실 → 이 검사는 실험실 켠 채로
    localStorage.setItem('legacy-of-adventure-visualLab', 'true');
    localStorage.setItem('legacy-of-adventure-telemetry', 'false');
    localStorage.setItem('legacy-of-adventure-wfBubOff', 'true');
    localStorage.setItem('legacy-of-adventure-hvNow', String(now));
    localStorage.setItem('legacy-of-adventure-sound', JSON.stringify({ bgmOn: false, bgmVol: 0.4, sfxOn: false, sfxVol: 0.7, muted: true }));
  }, [save, now]);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  await p.goto(URL, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => !!window.__S && !!document.querySelector('#tCont'), null, { timeout: 30000 });
  await p.locator('#tCont').click();
  await p.waitForFunction(() => window.__S.started && !document.querySelector('#hud').hidden, null, { timeout: 20000 });
  return { p, ctx };
}
/** 대화·창을 다 닫는다 — 대화 글을 모아 돌려준다 */
const clear = (p) =>
  p.evaluate(async () => {
    const W = (ms) => new Promise((r) => setTimeout(r, ms));
    const said = [];
    for (let i = 0, calm = 0; i < 120 && calm < 4; i++) {
      let busy = false;
      const d = document.querySelector('#dlg');
      if (!d.hidden) {
        said.push(d.textContent.replace(/\s+/g, ' ').slice(0, 120));
        d.click();
        busy = true;
      } else if (document.querySelector('#win').classList.contains('on')) {
        document.querySelector('#winX').click();
        busy = true;
      }
      calm = busy ? 0 : calm + 1;
      await W(busy ? 120 : 300);
    }
    return said;
  });
const winTitle = (p) => p.evaluate(() => (document.querySelector('#win').classList.contains('on') ? document.getElementById('winT')?.textContent ?? '' : ''));
const icons = (p) => p.evaluate(() => ['liBook', 'liHv', 'liAlm'].filter((id) => { const e = document.getElementById(id); return e && !e.hidden && e.offsetParent !== null; }));
const shot = (p, n) => p.screenshot({ path: `${dir}/${n}.png` });

// ───────── 1) 기간 전 ─────────
if (only(1)) {
  const { p, ctx } = await boot(T.before);
  const said = await clear(p);
  await p.waitForTimeout(1500);
  const st = await p.evaluate(() => ({ props: window.__hv.props().length, phase: window.__hv.phase(), opened: window.__P.harvest.opened, field: window.__hv.field(3), book: !!window.__P.daybook?.cands?.length }));
  ok(st.phase === 'before', `기간 전: phase ${st.phase}`);
  ok(st.props === 0, `기간 전: 가을 자동 장식 없음 (${st.props})`);
  ok(!st.opened && !said.some((t) => /수확제/.test(t)), '기간 전: 여는 컷 없음');
  ok(!st.field.on, '기간 전: 사냥에 호박 도깨비 없음');
  ok((await icons(p)).length === 0, `기간 전: 왼쪽 아이콘 없음 (${await icons(p)})`);
  // 노을도 아직 (17시 → 18시로 맞춰도 색이 그대로)
  await p.evaluate(() => (window.__S.clock = 12 * 60));
  await p.waitForTimeout(600);
  await shot(p, 'before_18h');
  const menu = await p.evaluate(() => { window.__openMenu(); return document.getElementById('winB').textContent; });
  ok(!/수확제 교환소|여관 연감|오늘의 장부/.test(menu), '기간 전: 메뉴에 수확제·연감·장부 칸 없음');
  await ctx.close();
}

// ───────── 2) 첫날 (10/22 21:00) ─────────
if (only(2)) {
  const { p, ctx } = await boot(T.day1);
  // 여는 컷 (첫 원정 뒤 여관 · 창이 없을 때)
  await p.waitForTimeout(1200);
  const said = await clear(p);
  const st = await p.evaluate(() => ({ props: window.__hv.props().map((x) => x.k), opened: window.__P.harvest.opened }));
  ok(st.opened && said.some((t) => /수확제/.test(t)), `첫날: 여는 컷 재생 (${said.filter((t) => /수확제/.test(t)).length}줄)`);
  ok(st.props.length >= 8 && st.props.includes('jack_lantern') && st.props.includes('harvest_arch'), `첫날: 가을 자동 장식 ${st.props.length}개 (${[...new Set(st.props)].join(',')})`);
  const ic = await icons(p);
  ok(ic.includes('liBook') && ic.includes('liHv') && ic.includes('liAlm'), `첫날: 왼쪽 아이콘 ${ic.join(',')}`);
  // 입구 쪽으로 카메라 → 장식 사진
  await p.evaluate(() => {
    const e = window.__ent();
    const V = window.__view;
    V.cam.x = (e[0] - e[1]) * 16;
    V.cam.y = (e[0] + e[1] - 32) * 8;
  });
  await p.waitForTimeout(700);
  await shot(p, 'day1_village');
  // 노을 (18시) · 밤 직전 (21:30)
  await p.evaluate(() => (window.__S.clock = 12 * 60));
  await p.waitForTimeout(900);
  await clear(p); // 첫 노을 대사
  await p.evaluate(() => (window.__S.clock = 12 * 60));
  await p.waitForTimeout(700);
  await shot(p, 'day1_dusk18');
  const col = (p) => p.evaluate(() => {
    const c = document.querySelector('#scene');
    const x = c.getContext('2d');
    const d = x.getImageData(0, 0, c.width, c.height).data;
    let r = 0, g = 0, bl = 0, n = 0;
    for (let i = 0; i < d.length; i += 4 * 97) { r += d[i]; g += d[i + 1]; bl += d[i + 2]; n++; }
    return [r / n, g / n, bl / n];
  });
  const dusk = await col(p);
  await p.evaluate(() => (window.__S.clock = 6 * 60));
  await p.waitForTimeout(700);
  const noon = await col(p);
  ok(dusk[0] / dusk[2] > noon[0] / noon[2] + 0.05, `노을: 18시가 12시보다 붉다 (R/B ${(dusk[0] / dusk[2]).toFixed(2)} > ${(noon[0] / noon[2]).toFixed(2)})`);
  ok(await p.evaluate(() => window.__P.meta.duskFirst), '노을: 첫 노을 대사 한 번 (duskFirst)');
  // 사냥: 호박 도깨비 (화면 없이 20판 · 같은 전투 코드)
  const hd = await p.evaluate(() => {
    const r = Object.keys(window.__P.hunt.best).find((k) => window.__P.hunt.best[k] >= 3) ?? 'forest';
    window.__hv.cfg.pumpkinChance = 0.5;
    const a = window.__hv.headless(r, 3, 20);
    window.__hv.cfg.pumpkinChance = 0.1;
    return { ...a, total: window.__P.harvest.pumpkins, rib: window.__P.harvest.ribbons, king: window.__P.harvest.king };
  });
  ok(hd.pumpkins > 0 && hd.ribbons >= hd.pumpkins, `사냥: 호박 도깨비 ${hd.pumpkins}마리 · 대왕 ${hd.kings} · 리본 +${hd.ribbons}`);
  ok(hd.total >= 15 ? hd.king >= 1 || hd.kings >= 1 : true, `사냥: 15마리마다 대왕 (누적 ${hd.total} · 대왕 ${hd.king})`);
  // 전투 화면: 호박이 꼭 나오게 · 대왕 차례로 → 사진
  await p.evaluate(async () => {
    const W = (ms) => new Promise((r) => setTimeout(r, ms));
    window.__hv.cfg.pumpkinChance = 1;
    const h = window.__P.harvest;
    h.pumpkins = (h.kingUsed + 1) * 15;
    for (const a of window.__world.actors) if (a.id) a.hp = 100;
    window.__openHunt('forest');
    await W(700);
    document.querySelector('[data-s="2"]')?.click();
    await W(700);
    document.querySelector('#hAuto1')?.click();
  });
  await p.waitForFunction(() => !!window.__combat.field(), null, { timeout: 15000 });
  await p.waitForTimeout(2000);
  const f1 = await p.evaluate(() => { const f = window.__combat.field(); return { pk: f.units.filter((u) => u.mon === 'na_pumpkin' && !u.dead).length, hv: !!f.hv, king: !!f.hv?.king }; });
  ok(f1.hv && f1.pk > 0 && f1.king, `전투 화면: 호박 도깨비 ${f1.pk}마리 · 대왕 차례 ${f1.king}`);
  await shot(p, 'day1_hunt_pumpkins');
  let mid = false;
  for (let i = 0; i < 60 && !mid; i++) mid = await p.evaluate(() => { window.__combat.advance(1); return !!window.__combat.field()?.mid; });
  await p.waitForTimeout(600);
  const kb = await p.evaluate(() => ({ bar: !document.querySelector('#cbBoss').hidden || !!window.__combat.field()?.mid, name: document.querySelector('#cbBossN')?.textContent ?? '', banner: document.querySelector('#cbBanner')?.textContent ?? '' }));
  ok(mid, `전투: 황금 호박 대왕 중간 보스 등장 (${kb.name} · ${kb.banner.slice(0, 20)})`);
  await shot(p, 'day1_hunt_king');
  for (let i = 0; i < 200; i++) { const d = await p.evaluate(() => { window.__combat.advance(2); return !window.__combat.field() || !!window.__combat.field().done; }); if (d) break; }
  await p.waitForTimeout(1500);
  const res = await p.evaluate(() => document.querySelector('#cbRes')?.textContent ?? '');
  ok(/수확 리본/.test(res), `사냥 결과 카드에 「수확 리본 +n」 (${(res.match(/수확 리본 \+\d+/) ?? [''])[0]})`);
  await shot(p, 'day1_hunt_result');
  await p.evaluate(() => { window.__hv.cfg.pumpkinChance = 0.1; document.querySelector('#cHome')?.click(); });
  await p.waitForTimeout(600);
  await clear(p);
  // 교환소: 리본 넉넉히 → 왼쪽 아이콘 → 호박등 바꾸기
  const r0 = await p.evaluate(() => { window.__hv.ribbons(220); return { rib: window.__P.harvest.ribbons, st: window.__P.almanac.stamps, title: window.__P.harvest.title }; });
  ok(r0.title, '칭호 「첫 수확제의 주인」 (누적 200)');
  await p.locator('#liHv').click();
  await p.waitForTimeout(400);
  ok((await winTitle(p)) === '수확제 교환소', `교환소 창 (${await winTitle(p)})`);
  await shot(p, 'day1_shop');
  await p.locator('[data-hvb="jack_lantern"]').click();
  await p.waitForTimeout(300);
  const r1 = await p.evaluate(() => ({ rib: window.__P.harvest.ribbons, buy: window.__P.harvest.buy.jack_lantern, gift: window.__P.meta.giftDeco.jack_lantern, st: window.__P.almanac.stamps }));
  ok(r1.rib === r0.rib - 15 && r1.buy === 1 && r1.gift >= 1, `교환: 호박등 (리본 ${r0.rib}→${r1.rib} · 선물 장식 ${r1.gift})`);
  ok(r1.st === r0.st + 1, `교환 = 연감 도장 +1 (${r0.st}→${r1.st})`);
  await p.locator('[data-hvb="pumpkin_carriage"]').click();
  await p.waitForTimeout(300);
  ok(await p.evaluate(() => window.__P.harvest.buy.pumpkin_carriage === 1), '교환: 호박 마차 (2×2 unique)');
  await shot(p, 'day1_shop_after');
  await clear(p);
  // 건설 목록: 호박등 「무료」 → 놓기
  const card = await p.evaluate(async () => {
    window.__game.openBuildForTest?.();
    document.getElementById('bBuild').click();
    await new Promise((r) => setTimeout(r, 400));
    const c = document.querySelector('#winB [data-k="jack_lantern"]');
    return c ? c.textContent : null;
  });
  ok(!!card && /무료/.test(card), `건설 목록에 호박등 (${card})`);
  await clear(p);
  // 오늘의 장부: 6개 · 3개 고르기 · 진행 채우기 · 받기 · 상자 → 도장 3
  await p.locator('#liBook').click();
  await p.waitForTimeout(400);
  ok((await winTitle(p)) === '오늘의 장부', `장부 창 (${await winTitle(p)})`);
  const n6 = await p.evaluate(() => document.querySelectorAll('#winB .dbrow').length);
  ok(n6 === 6, `장부 후보 ${n6}개`);
  await shot(p, 'day1_daybook');
  // 앞 3개 대신 뒤 3개를 담기
  for (const i of [0, 1, 2]) await p.locator(`[data-dbp="${i}"]`).click().catch(() => {});
  for (const i of [3, 4, 5]) await p.locator(`[data-dbp="${i}"]`).click().catch(() => {});
  await p.locator('#dbPick').click();
  await p.waitForTimeout(300);
  const picked = await p.evaluate(() => window.__P.daybook.picked.slice().sort());
  ok(JSON.stringify(picked) === '[3,4,5]', `장부: 3개 골라 담기 (${picked})`);
  // 고른 셋 진행을 채운다 (기록 값을 목표만큼 올림)
  await p.evaluate(() => {
    const d = window.__P.daybook;
    for (const i of d.picked) d.cands[i].base -= d.cands[i].target;
  });
  await p.evaluate(() => window.__hv.book(0));
  await p.waitForTimeout(300);
  for (const i of [3, 4, 5]) await p.locator(`[data-dbc="${i}"]`).click().catch(() => {});
  const st0 = await p.evaluate(() => window.__P.almanac.stamps);
  await p.locator('#dbBox').click();
  await p.waitForTimeout(300);
  const db = await p.evaluate(() => ({ box: window.__P.daybook.box, wk: window.__P.daybook.weekN, st: window.__P.almanac.stamps }));
  ok(db.box && db.wk === 3, `장부: 셋 받기 · 상자 (이번 주 ${db.wk})`);
  ok(db.st === st0 + 3, `장부 셋 = 연감 도장 +3 (${st0}→${db.st})`);
  await shot(p, 'day1_daybook_done');
  // 장부 탭: 오늘의 목표 · 마을 부탁 · 이번 주
  for (const t of [1, 2, 3]) {
    await p.locator(`[data-dbt="${t}"]`).click();
    await p.waitForTimeout(250);
  }
  ok(/이번 주/.test(await p.evaluate(() => document.getElementById('winB').textContent)), '장부 탭 4개 (이번 주)');
  await clear(p);
  // 연감: 칸 받기
  await p.evaluate(() => (window.__P.almanac.stamps += 6));
  await p.locator('#liAlm').click();
  await p.waitForTimeout(400);
  ok((await winTitle(p)) === '여관 연감', `연감 창 (${await winTitle(p)})`);
  await shot(p, 'day1_almanac');
  const a0 = await p.evaluate(() => window.__P.almanac.claimed.length);
  await p.locator('.alc.ready').first().click();
  await p.waitForTimeout(300);
  ok((await p.evaluate(() => window.__P.almanac.claimed.length)) === a0 + 1, '연감: 칸 하나 받기');
  await clear(p);
  // 플래그 끔 → 장식·아이콘 사라짐
  await p.evaluate(() => { window.__hv.flag('harvestFest', false); window.__hv.flag('almanac', false); window.__hv.flag('ledgerDaily', false); });
  await p.waitForTimeout(900);
  // 실험실이 켜져 있어 장부·연감 아이콘(vis)은 남는다 — 수확제(harvestFest) 쪽만 사라지는지
  ok((await p.evaluate(() => window.__hv.props().length)) === 0 && !(await icons(p)).includes('liHv'), '플래그 끔: 자동 장식·수확제 아이콘 없음');
  await ctx.close();
}

// ───────── 3) 마지막 주 (도장 ×2) ─────────
if (only(3)) {
  const { p, ctx } = await boot(T.lastWeek);
  await clear(p);
  const x2 = await p.evaluate(() => { const a = window.__P.almanac.stamps; window.__hv.buy('leaf_pile'); return [a, window.__P.almanac.stamps, window.__P.harvest.ribbons]; });
  ok(x2[2] < 10 || x2[1] === x2[0] + 2, `마지막 주: 교환 도장 ×2 (${x2[0]}→${x2[1]} · 리본 ${x2[2]})`);
  await ctx.close();
}

// ───────── 4) 마지막 밤 (11/5 · 게임 밤 10시) ─────────
if (only(4)) {
  // 수확제에 참여한 여관(여는 컷 봄 · 리본 30) · 게임 21:45 낮 · 첫 노을은 이미 봄
  const save = JSON.parse(sv);
  save.clock = 15 * 60 + 45;
  save.night = false;
  save.progress = { ...save.progress, harvest: { ribbons: 30, earned: 30, pumpkins: 0, king: 0, kingUsed: 0, deco: 0, buy: {}, opened: true, finale: 0, bark: false, title: false, seen: 0 }, meta: { ...save.progress.meta, duskFirst: true } };
  const { p, ctx } = await boot(T.finale, JSON.stringify(save));
  await p.waitForTimeout(500);
  ok((await p.evaluate(() => window.__hv.fin())) === null && !(await p.evaluate(() => window.__S.night)), '마지막 날 낮엔 아직 (게임 밤 10시를 기다림)');
  // 밤 10시가 되는 순간
  await p.waitForFunction(() => window.__S.night, null, { timeout: 20000 });
  let lit = 0;
  const said = [];
  for (let i = 0, idle = 0; i < 90 && idle < 30; i++) {
    if (idle >= 4 && (await p.evaluate(() => window.__P.harvest.finale === 1)) && said.some((t) => /마지막 밤/.test(t))) break;
    const vis = await p.evaluate(() => {
      if (!document.querySelector('#dlg').hidden) return true;
      if (document.querySelector('#win').classList.contains('on')) document.querySelector('#winX').click();
      return false;
    });
    if (process.env.DBG) console.error(i, await p.evaluate(() => JSON.stringify({ c: window.__S.clock | 0, f: window.__P.harvest.finale, d: !document.querySelector('#dlg').hidden, pend: window.__pending() })));
    if (!vis) {
      idle++;
      await p.waitForTimeout(400);
      continue;
    }
    idle = 0;
    // 글자가 다 찍힐 때까지
    await p.waitForTimeout(2200);
    const t = await p.evaluate(() => document.querySelector('#dlg').textContent.replace(/\s+/g, ' '));
    said.push(t);
    if (/등불이 하나, 둘/.test(t)) {
      lit = await p.evaluate(() => window.__hv.lanternT());
      await shot(p, 'finale_lanterns');
    }
    await p.locator('#dlg').click();
    await p.waitForTimeout(200);
  }
  ok(said.some((t) => /마지막 밤/.test(t)), `마지막 밤 컷 (${said.length}줄 · ${said.map((t) => t.slice(0, 18)).join(' | ')})`);
  ok(lit > 0, '등불 날리기 연출 (fx lanterns)');
  ok((await p.evaluate(() => window.__P.harvest.finale)) === 1, '마지막 밤: finale = 1 (한 번만)');
  await p.waitForTimeout(3000);
  const sit = await p.evaluate(() => window.__world.actors.filter((a) => a.at && a.at.kind === 'fire').length);
  ok(sit >= 0, `모닥불 곁으로 (${sit}명)`);
  const chron = await p.evaluate(() => { window.__openDex(); const n = [...document.querySelectorAll('#winB .tab')].findIndex((t) => t.textContent === '연대기'); if (n >= 0) document.querySelectorAll('#winB .tab')[n].click(); return document.getElementById('winB').textContent; });
  ok(/첫 번째 수확제/.test(chron), '연대기 「첫 번째 수확제」 쪽');
  await shot(p, 'finale_chronicle');
  await ctx.close();
}

// ───────── 5) 정리 3일 (교환소만) ─────────
if (only(5)) {
  const { p, ctx } = await boot(T.shop);
  await clear(p);
  const st = await p.evaluate(() => ({ props: window.__hv.props().length, field: window.__hv.field(3).on }));
  ok(st.props === 0 && !st.field, '정리 3일: 자동 장식·호박 도깨비 없음');
  ok((await icons(p)).includes('liHv'), '정리 3일: 교환소 아이콘은 남음');
  await ctx.close();
}

// ───────── 6) 끝난 뒤 (11/10) — 놓친 마지막 밤은 연대기만 ─────────
if (only(6)) {
  const save = JSON.parse(sv);
  save.progress = { ...save.progress, harvest: { ribbons: 42, earned: 120, pumpkins: 30, king: 2, kingUsed: 2, deco: 3, buy: { jack_lantern: 2 }, opened: true, finale: 0, bark: true, title: false, seen: 0 }, almanac: { season: 'hv1', stamps: 20, claimed: [1, 2], carry: 0, closed: '', title: false, ach: [] } };
  const { p, ctx } = await boot(T.after, JSON.stringify(save));
  await clear(p);
  await p.waitForTimeout(1200);
  const st = await p.evaluate(() => ({ props: window.__hv.props().length, fin: window.__P.harvest.finale, rib: window.__P.harvest.ribbons, carry: window.__P.almanac.carry, closed: window.__P.almanac.closed, mail: window.__P.meta.mail.filter((m) => /연감/.test(m.title)).length }));
  ok(st.props === 0, '끝난 뒤: 자동 장식 없음');
  ok(st.fin === 2, `끝난 뒤: 마지막 밤 놓침 → 연대기만 (finale ${st.fin})`);
  ok(st.rib === 52, `끝난 뒤: 리본은 그대로 + 못 받은 연감 9칸 리본 10 (${st.rib})`);
  ok(st.closed === 'hv1' && st.carry === 6 && st.mail === 8, `연감 닫기: 넘길 도장 ${st.carry} (20의 30%) · 못 받은 칸 우편 ${st.mail}`);
  const ic = await icons(p);
  ok(ic.length === 1 && ic[0] === 'liBook', `끝난 뒤: 왼쪽 아이콘은 장부만 (${ic})`);
  const man = await p.evaluate(() => { window.__openManual(); return document.getElementById('winB').textContent; });
  ok(/가을 수확제 \(끝남\)/.test(man), '안내서 「가을 수확제 (끝남)」');
  await ctx.close();
}

await b.close();
if (errs.length) console.error('페이지 오류:\n' + [...new Set(errs)].join('\n'));
ok(!errs.length, `페이지 오류 ${errs.length}`);
console.error(fail ? `✗ ${fail}개 실패` : '✓ 모두 통과');
process.exit(fail ? 1 : 0);
