// 웅스 건의 「강화 전수」 e2e (플래그 enhTransfer · 실험실로 켬) — 실세이브(기본 웅스 · tests/fixtures/real_woongs3.json, 없으면 real_woongs.json)
//  1) 실험실 끔: 장비 손질 판에 [전수] 없음
//  2) 같은 장비 막힘: 고른 장비가 자기 목록에 없음 + 규칙 함수로 「같은 장비끼리는…」
//  3) 원정 막힘: 주는 사람이 원정 중 → 줄 버튼 회색 + 이유 「…원정 중이라 주는 장비를 뺄 수 없어요」 · 받는 사람 원정 중도
//  4) 유물 규칙: 유물 받는 장비 ← 유물 아닌 주는 장비 → 회색 + 「유물 강화는 유물끼리만 옮길 수 있어요」
//  5) 끼고 있는 주는 장비(★ 영웅 무기) → [전수] → 목록 → 확인 시트 → 전수하기:
//     비용(금화·가루·부적)이 표 그대로 빠짐 · 주는 장비 분해 가루 받음 · 받는 장비 단계 = 미리 보기 · 같은 사람에게 받는 장비가 끼워짐 · 주는 장비 사라짐 · 도장
//  실행: URL=http://localhost:4451/ node scripts/e2e-transfer.mjs   (BOT_BUILD 빌드)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const URL = process.env.URL ?? 'http://localhost:4451/';
const SAVE = process.env.SAVE ?? (fs.existsSync('tests/fixtures/real_woongs3.json') ? 'tests/fixtures/real_woongs3.json' : 'tests/fixtures/real_woongs.json');
const b = await chromium.launch({ channel: 'chrome' });
const errs = [];
let fail = 0;
const ok = (c, m) => { console.error((c ? '✓ ' : '✗ ') + m); if (!c) fail++; };
const AND = 'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36';

async function boot(lab) {
  const sv = JSON.parse(fs.readFileSync(SAVE, 'utf8'));
  const cx0 = await b.newContext();
  const VER = JSON.stringify((await (await cx0.request.get(URL + 'version.json')).json()).version);
  await cx0.close();
  const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: AND });
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
  p.on('pageerror', (e) => errs.push(`${lab ? 'lab' : 'off'}: ${String(e).slice(0, 200)}`));
  await p.goto(URL, { waitUntil: 'domcontentloaded' });
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
  return { ctx, p, calm };
}
const W = (p, ms) => p.waitForTimeout(ms);
// 준비: 전투력 1등 영웅(★) 무기 = 주는 쪽(+12 · 유물이 아니면 그대로 등급) · 같은 부위 · 한 등급 위(유물 아님) 새 장비 하나 가방에 · 넉넉한 금화·가루 · 부적 1
const setup = (p) =>
  p.evaluate(() => {
    const Wd = window.__world;
    const P = window.__P;
    const hs = Wd.actors.filter((a) => !a.role && (a.status === 'regular' || a.status === 'hero') && a.equip?.weapon != null && a.runId == null).sort((a, b) => window.__power(b) - window.__power(a));
    const hero = hs[0];
    const other = hs[1];
    P.growth.favs = [hero.id];
    const wp = P.bag.find((it) => it.id === hero.equip.weapon);
    // 주는 쪽을 전설(l) +12 로 · 받는 쪽은 같은 부위 전설 새 장비 +0 (가방 · 아무도 안 낌)
    wp.grade = 'l';
    wp.enh = 12;
    wp.locked = false;
    delete wp.uid; // 고유 중복 가루 배수 없이 (분해 가루를 표 그대로 비교)
    const recv = JSON.parse(JSON.stringify(wp));
    recv.id = Math.max(...P.bag.map((x) => x.id)) + 1;
    recv.owner = null;
    recv.enh = 0;
    recv.name = recv.name.replace(/^(초월한|극의) /, '') + ' (새)';
    recv.uid = undefined;
    P.bag.push(recv);
    // 유물 받는 장비 (유물 규칙 확인용)
    const relic = JSON.parse(JSON.stringify(recv));
    relic.id = recv.id + 1;
    relic.grade = 'a';
    relic.name = '시험 유물 무기';
    P.bag.push(relic);
    for (const g of ['n', 'r', 'e', 'l', 'a']) P.dust[g] = 100_000;
    window.__S.gold = 50_000_000;
    P.growth.charm = 1;
    return { hero: hero.id, heroName: hero.name, other: other?.id, giver: wp.id, recv: recv.id, relic: relic.id };
  });
const openPanel = async (p, heroId) => {
  // 대사(불씨·이야기 등)가 떠 있으면 먼저 넘긴다
  const said = await p.evaluate(async () => {
    const seen = [];
    for (let i = 0; i < 40 && !document.querySelector('#dlg').hidden; i++) {
      seen.push(document.querySelector('#dlg').textContent.trim().slice(0, 40));
      document.querySelector('#dlg').click();
      await new Promise((r) => setTimeout(r, 150));
    }
    return seen;
  });
  if (said.length) console.error(`  (대사 넘김: ${said[0]}…)`);
  await p.evaluate(() => window.__showObj(window.__world.objs.find((o) => o.kind === 'smith')));
  await W(p, 500);
  await p.locator(`.smo-heroes [data-hc="${heroId}"]`).first().click();
  await W(p, 300);
  await p.locator('[data-sl="weapon"]').first().click();
  await W(p, 300);
};

// ───────── 1) 실험실 끔 → [전수] 없음 ─────────
{
  const { ctx, p } = await boot(false);
  const s = await setup(p);
  await openPanel(p, s.hero);
  // v0.25.21 형철 OK로 flags.json에서 켬 → 서버 flags.json을 따른다
  const on = await p.evaluate(async () => (await (await fetch('flags.json?x=' + Date.now())).json()).enhTransfer === true);
  ok(await p.evaluate((on) => !!document.getElementById('smoPanel') && !!document.getElementById('smoTf') === on, on), on ? '실험실 끔 + flags.json 켬: 행동 판에 [전수]' : '끔: 행동 판에 [전수] 없음');
  await ctx.close();
}

// ───────── 2)~5) 실험실 켬 ─────────
{
  const { ctx, p } = await boot(true);
  const s = await setup(p);
  await openPanel(p, s.hero);
  ok(await p.evaluate(() => !!document.getElementById('smoTf')), '켬: 행동 판에 [전수]');
  await p.locator('#smoTf').click();
  await W(p, 400);
  const lst = await p.evaluate((s) => {
    const rows = [...document.querySelectorAll('.tf-row')].map((r) => ({ g: +r.dataset.tg, r: +r.dataset.tr, dis: r.querySelector('button').disabled, txt: r.innerText.replace(/\s+/g, ' ') }));
    return { rows, self: rows.some((x) => x.g === x.r), give: rows.find((x) => x.g === s.giver && x.r === s.recv) };
  }, s);
  ok(!lst.self, '같은 장비: 자기 자신은 목록에 없음');
  ok(!!lst.give && !lst.give.dis && /\+0 → \+11/.test(lst.give.txt), `주기 줄 미리 보기 「+0 → +11 · 비용 …」 (${lst.give?.txt.slice(0, 90)})`);
  const same = await p.evaluate((s) => document.querySelector(`.tf-row[data-tg="${s.giver}"][data-tr="${s.giver}"]`) == null, s);
  ok(same, '같은 장비 줄 없음 (주기·받기 모두)');
  // 4) 유물 규칙: 전설 → 유물 줄은 회색 + 이유
  // 유물 장비 쪽에서 열기 (가방 카드 → 유물 → [전수] → 「이 장비가 받기」에 전설 +12 줄이 회색)
  const relic = await p.evaluate(async (s) => {
    const T = (ms) => new Promise((r) => setTimeout(r, ms));
    document.getElementById('tfBack').click();
    await T(400);
    document.querySelector('.smo-heroes [data-hb]')?.click();
    await T(300);
    document.querySelector(`[data-bi="${s.relic}"]`)?.click();
    await T(300);
    document.getElementById('smoTf')?.click();
    await T(400);
    const r = document.querySelector(`#tfRecv .tf-row[data-tg="${s.giver}"][data-tr="${s.relic}"]`);
    const out = r ? { dis: r.querySelector('button').disabled, txt: r.innerText.replace(/\s+/g, ' ') } : null;
    // 다시 영웅 무기로
    document.getElementById('tfBack').click();
    await T(400);
    document.querySelector(`.smo-heroes [data-hc="${s.hero}"]`)?.click();
    await T(300);
    document.querySelector('[data-sl="weapon"]')?.click();
    await T(300);
    document.getElementById('smoTf')?.click();
    await T(400);
    return out;
  }, s);
  ok(!!relic && relic.dis && relic.txt.includes('유물 강화는 유물끼리만 옮길 수 있어요'), `유물 규칙: 회색 + 이유 (${relic?.txt.slice(0, 80)})`);
  // 3) 원정 막힘: 주는 사람 원정 중 / 받는 사람 원정 중 (목록 다시 그리기)
  const exp = await p.evaluate(async (s) => {
    const T = (ms) => new Promise((r) => setTimeout(r, ms));
    const Wd = window.__world;
    const hero = Wd.actors.find((a) => a.id === s.hero);
    hero.runId = 999;
    document.getElementById('tfBack').click();
    await T(400);
    // 받는 장비(가방) 쪽에서 열기 → 「이 장비가 받기」의 주는 장비 줄 (주기 목록은 회색이 많아 12줄 밖으로 밀릴 수 있음)
    document.querySelector('.smo-heroes [data-hb]')?.click();
    await T(300);
    document.querySelector(`[data-bi="${s.recv}"]`)?.click();
    await T(300);
    document.getElementById('smoTf')?.click();
    await T(400);
    const row = document.querySelector(`#tfRecv .tf-row[data-tg="${s.giver}"][data-tr="${s.recv}"]`);
    const giverBlocked = !!row && row.querySelector('button').disabled && row.innerText.includes('원정 중이라 주는 장비를 뺄 수 없어요');
    hero.runId = null;
    // 받는 쪽 원정: 받는 장비를 다른 영웅에게 끼우고 그 영웅을 원정으로
    const other = Wd.actors.find((a) => a.id === s.other);
    let recvBlocked = null;
    if (other) {
      const P = window.__P;
      const recv = P.bag.find((x) => x.id === s.recv);
      const prev = P.bag.find((x) => x.id === other.equip.weapon);
      if (prev) prev.owner = null;
      other.equip.weapon = recv.id;
      recv.owner = other.id;
      other.runId = 998;
      // 받는 장비(다른 영웅 무기) 쪽에서 열기 → 「이 장비가 받기」의 주는 장비 줄
      document.getElementById('tfBack').click();
      await T(400);
      document.querySelector(`.smo-heroes [data-hc="${other.id}"]`)?.click();
      await T(300);
      document.querySelector('[data-sl="weapon"]')?.click();
      await T(300);
      document.getElementById('smoTf')?.click();
      await T(400);
      const r2 = document.querySelector(`#tfRecv .tf-row[data-tg="${s.giver}"][data-tr="${s.recv}"]`);
      recvBlocked = !!r2 && r2.querySelector('button').disabled && r2.innerText.includes('원정 중이라 받는 장비를 손댈 수 없어요');
      other.runId = null;
      other.equip.weapon = prev ? prev.id : null;
      if (prev) prev.owner = other.id;
      recv.owner = null;
      document.getElementById('tfBack').click();
      await T(400);
      document.querySelector(`.smo-heroes [data-hc="${s.hero}"]`)?.click();
      await T(300);
      document.querySelector('[data-sl="weapon"]')?.click();
      await T(300);
      document.getElementById('smoTf')?.click();
      await T(400);
    }
    return { giverBlocked, recvBlocked };
  }, s);
  ok(exp.giverBlocked, '원정: 주는 사람이 원정 중 → 회색 + 이유');
  ok(exp.recvBlocked !== false, `원정: 받는 사람이 원정 중 → 회색 + 이유${exp.recvBlocked == null ? ' (다른 영웅 없음 · 건너뜀)' : ''}`);
  // 5) 실행: 끼고 있는 주는 장비 → 확인 시트 → 전수하기
  const before = await p.evaluate((s) => {
    const P = window.__P;
    const g = P.bag.find((x) => x.id === s.giver);
    return { gold: window.__S.gold, dust: { ...P.dust }, charm: P.growth.charm, giverGrade: g.grade, bag: P.bag.length };
  }, s);
  const sel = `.tf-row[data-tg="${s.giver}"][data-tr="${s.recv}"] button`;
  await p.locator(sel).scrollIntoViewIfNeeded();
  await p.locator(sel).click();
  await W(p, 500);
  const sheet = await p.evaluate(() => document.getElementById('csheet')?.innerText.replace(/\s+/g, ' ') ?? '');
  ok(sheet.includes('강화를 전수할까요?') && sheet.includes('+0 → +11') && sheet.includes('끼워 드려요'), `확인 시트: ${sheet.slice(0, 120)}`);
  // 금화는 여관이 계속 벌어서 — 누르기 바로 전·바로 뒤를 한 번에 잰다
  const tick = await p.evaluate(async () => { const g0 = window.__S.gold; document.getElementById('cshOk').click(); await Promise.resolve(); await Promise.resolve(); await new Promise((r) => setTimeout(r, 0)); return g0 - window.__S.gold; });
  await W(p, 300);
  const after = await p.evaluate((s) => {
    const P = window.__P;
    const Wd = window.__world;
    const recv = P.bag.find((x) => x.id === s.recv);
    const hero = Wd.actors.find((a) => a.id === s.hero);
    return {
      gold: window.__S.gold, dust: { ...P.dust }, charm: P.growth.charm, bag: P.bag.length,
      giverGone: !P.bag.some((x) => x.id === s.giver), recvEnh: recv?.enh, worn: hero.equip.weapon === recv?.id && recv?.owner === hero.id,
      stamp: !!document.querySelector('.smo-slot.on .stampfx'), title: document.getElementById('winT')?.textContent,
    };
  }, s);
  // 표 (CONFIG.growth.transfer.cost +11): 금화 15,000 · 가루 7,030 · 부적 1 / 분해: 전설 150 + 잿빛 40
  const COST = { gold: 15000, dust: 7030, charm: 1 };
  const SALV = { l: 150, n: 40 };
  ok(after.giverGone, '주는 장비 사라짐');
  ok(after.recvEnh === 11, `받는 장비 +${after.recvEnh} (미리 보기 +11)`);
  ok(after.worn, `${s.heroName}에게 받는 장비가 끼워짐 (주는 장비를 끼고 있던 사람)`);
  ok(tick === COST.gold, `금화 −${tick} (표 ${COST.gold})`);
  ok(after.charm === before.charm - COST.charm, `부적 ${before.charm} → ${after.charm}`);
  ok(after.dust.l - before.dust.l === SALV.l - COST.dust, `전설 가루 ${after.dust.l - before.dust.l} (= 분해 +${SALV.l} − 비용 ${COST.dust})`);
  ok(after.dust.n - before.dust.n === SALV.n, `잿빛 가루 +${after.dust.n - before.dust.n} (분해 잿빛 ${SALV.n})`);
  ok(after.bag === before.bag - 1, `가방 ${before.bag} → ${after.bag}`);
  ok(after.stamp, '받은 장비 칸에 도장 「쿵」');
  ok(/대장간/.test(after.title ?? ''), `대장간 창으로 돌아옴 (${after.title})`);
  fs.mkdirSync('screenshots/etr', { recursive: true });
  await p.screenshot({ path: 'screenshots/etr/done.png' });
  // 뒤로(←): 지난 전수 목록이 아니라 대장간 앞 창으로
  const backTitle = await p.evaluate(async () => { document.getElementById('winBack')?.click(); await new Promise((r) => setTimeout(r, 300)); return document.getElementById('winT')?.textContent ?? ''; });
  ok(!backTitle.startsWith('강화 전수'), `← 뒤로가 지난 목록으로 안 감 (${backTitle || '닫힘'})`);
  await ctx.close();
}
await b.close();
if (errs.length) console.error('✗ 페이지 오류\n' + errs.join('\n'));
console.error(fail || errs.length ? `✗ 실패 ${fail}` : '✓ e2e-transfer 통과');
process.exit(fail || errs.length ? 1 : 0);
