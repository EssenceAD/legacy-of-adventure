// CHECKIN C (v0.25.4 · ck-c2) e2e — 실험실 켬(「새 화면 미리 보기」) = 켠 모습 · 끔 = 예전 그대로인지
//  K6 터치 수: 원정 끝 → 다시 출발 (전: BEFORE 주소 · 후: URL + 실험실) · §C5 가방 일반·희귀 한 번에 정리 (가방에서부터)
//  §C3 다녀오셨어요 카드(8일 · 선물) · §C4 빨간 점 · 텃밭 레벨업(공사 시작) · 인연 창 [선물하기] = 같은 선물 고르기 창 · 꾸미기 안내 · 「좌우 뒤집기」
//  실행: URL=http://localhost:4362/ BEFORE=http://localhost:4310/ node scripts/e2e-c2.mjs [저장]   (BOT_BUILD 빌드 · BEFORE는 읽기만)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const URL = process.env.URL ?? 'http://localhost:4362/';
const BEFORE = process.env.BEFORE;
const SAVE = process.argv[2] ?? (fs.existsSync('tests/fixtures/real_ttabam.json') ? 'tests/fixtures/real_ttabam.json' : 'tests/fixtures/real_lotte.json');
const b = await chromium.launch({ channel: 'chrome' });
let fail = 0;
const ok = (c, m) => { console.error((c ? '✓ ' : '✗ ') + m); if (!c) fail++; };
const errs = [];
const W = (p, ms) => p.waitForTimeout(ms);

async function open(url, lab) {
  const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(([s, lab]) => {
    try { if (sessionStorage.getItem('x')) return; sessionStorage.setItem('x', 1); } catch { return; }
    localStorage.clear();
    localStorage.setItem('legacy-of-adventure-save', s);
    localStorage.setItem('legacy-of-adventure-teaserSeen', 'true');
    localStorage.setItem('legacy-of-adventure-lastVersion', '"99"');
    localStorage.setItem('legacy-of-adventure-settleOff', 'true');
    localStorage.setItem('legacy-of-adventure-telemetry', 'false');
    localStorage.setItem('legacy-of-adventure-sound', JSON.stringify({ bgmOn: false, bgmVol: 0.4, sfxOn: false, sfxVol: 0.7, muted: true }));
    if (lab) localStorage.setItem('legacy-of-adventure-visualLab', 'true');
  }, [fs.readFileSync(SAVE, 'utf8'), lab]);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(`${url}${lab ? ' lab' : ''}: ${String(e).slice(0, 200)}`));
  await p.goto(url, { waitUntil: 'networkidle' });
  await p.waitForFunction(() => !!window.__S && !!document.querySelector('#tCont'), null, { timeout: 30000 });
  await p.locator('#tCont').click();
  await p.waitForFunction(() => window.__S.started, null, { timeout: 20000 });
  await calm(p);
  return { p, ctx };
}
async function calm(p) {
  for (let i = 0, c = 0; i < 80 && c < 3; i++) {
    const busy = await p.evaluate(() => { if (!document.querySelector('#dlg').hidden) return document.querySelector('#dlg').click(), true; if (document.querySelector('#win').classList.contains('on')) return document.querySelector('#winX').click(), true; return false; });
    c = busy ? 0 : c + 1;
    await W(p, busy ? 150 : 400);
  }
}
/** 터치 세기: 실제로 누른 횟수 */
function tapper(p) {
  const t = { n: 0, log: [] };
  t.tap = async (sel) => {
    await p.locator(sel).first().click({ timeout: 5000 });
    t.n++;
    t.log.push(sel);
    await W(p, 400);
  };
  return t;
}

/** 끝난 원정 하나 (파티 3명 · 같은 의뢰 하나 더 게시판에) → run id */
async function finishedRun(p) {
  const id = await p.evaluate(async () => {
    const T = (ms) => new Promise((r) => setTimeout(r, ms));
    const P = window.__P, w = window.__world;
    const ms = w.actors.filter((x) => (x.status === 'regular' || x.status === 'hero') && x.runId == null && !x.leaving).slice(0, 3);
    const q = P.quests.list.find((x) => !x.tutorial && !x.guild) ?? P.quests.list[0];
    P.quests.list.push({ ...q, id: 990100 });
    P.runs = P.runs.filter((r) => !r.result);
    const id = 990003;
    P.runs.push({ id, quest: { ...q }, members: ms.map((a) => a.id), start: Date.now() - 120000, end: Date.now() - 500 });
    for (const a of ms) a.runId = id;
    for (let i = 0; i < 40 && !P.runs.find((r) => r.id === id)?.result; i++) await T(250);
    for (const a of ms) a.hp = 100;
    return id;
  });
  await calm(p);
  return id;
}
const sentCount = (p) => p.evaluate(() => window.__P.runs.filter((r) => !r.result).length);

/** K6: 원정 끝 → 다시 출발 (아래 진행 줄에서 시작) */
async function resendTaps(url, lab) {
  const { p, ctx } = await open(url, lab);
  const id = await finishedRun(p);
  const before = await sentCount(p);
  const t = tapper(p);
  if (await p.locator('#rbList').isHidden()) await t.tap('#rbStrip');
  await t.tap(`[data-rb="${id}"]`);
  if (await p.locator('#dlg').isVisible()) await t.tap('#dSkip');
  if (await p.locator('#repAgain').count()) {
    await t.tap('#repAgain');
  } else {
    await t.tap('#repOk');
    await t.tap(lab ? '#bAdv' : '#bExp');
    if (lab && (await p.locator('[data-adv="1"]').count())) await t.tap('[data-adv="1"]');
    await t.tap('.quest:not(.tut)');
    await t.tap('#pRec');
    await t.tap('#pGo');
  }
  const after = await sentCount(p);
  const same = await p.evaluate((id) => {
    const r = window.__P.runs.filter((x) => !x.result).at(-1);
    return r ? r.members.length : 0;
  }, id);
  await ctx.close();
  return { n: t.n, sent: after === before + 1, members: same, log: t.log };
}

/** §C5: 가방에서 일반·희귀 한 번에 분해 */
async function tidyTaps(url, lab) {
  const { p, ctx } = await open(url, lab);
  // 일반·희귀 장비가 꼭 있게 (끼우지 않은 · 잠그지 않은)
  await p.evaluate(() => {
    const P = window.__P;
    const src = P.bag.find((x) => x.owner == null) ?? P.bag[0];
    for (let i = 0; i < 4; i++) P.bag.push({ ...src, id: 880000 + i, grade: i % 2 ? 'r' : 'n', owner: null, locked: false, enh: 0, set: undefined });
    P.salvage.grades = ['n'];
  });
  const nr = () => p.evaluate(() => window.__P.bag.filter((x) => (x.grade === 'n' || x.grade === 'r') && x.owner == null && !x.locked && x.enh < 1 && !x.set).length);
  await p.evaluate(() => window.__openMenu());
  await W(p, 300);
  await p.evaluate(() => [...document.querySelectorAll('.mtile')].find((b) => b.querySelector('span')?.textContent === '가방').click());
  await W(p, 400);
  const n0 = await nr();
  const t = tapper(p);
  if (await p.locator('#bagTidy').count()) {
    await t.tap('#bagTidy');
    await t.tap('#tdGo');
  } else {
    await t.tap('#salAll');
    // 희귀도 고르기 (기본은 일반만)
    await t.tap('[data-g="r"]');
    await t.tap('#bkGo');
    await t.tap('#bkGo');
  }
  const n1 = await nr();
  await ctx.close();
  return { n: t.n, before: n0, after: n1 };
}

// ───────── 터치 수 (K6 목표: 원정 끝 → 재출발 ≤3 · 일괄 정리 ≤2) ─────────
const rows = [];
if (BEFORE) {
  const r = await resendTaps(BEFORE, false);
  rows.push(`전(${BEFORE}) 원정 끝 → 재출발: ${r.n}터치 (${r.log.join(' → ')})`);
  ok(r.sent, `전: 다시 출발함 (${r.n}터치)`);
  const d = await tidyTaps(BEFORE, false);
  rows.push(`전 가방 일반·희귀 정리: ${d.n}터치 (${d.before} → ${d.after})`);
}
{
  const r = await resendTaps(URL, true);
  rows.push(`후(실험실) 원정 끝 → 재출발: ${r.n}터치 (${r.log.join(' → ')})`);
  ok(r.sent && r.members === 3, `후: 같은 파티 3명 그대로 다시 출발`);
  ok(r.n <= 3, `후: 원정 끝 → 재출발 ${r.n}터치 ≤ 3`);
  const d = await tidyTaps(URL, true);
  rows.push(`후 가방 일반·희귀 정리: ${d.n}터치 (${d.before} → ${d.after})`);
  ok(d.n <= 2 && d.after < d.before, `후: 가방 일반·희귀 정리 ${d.n}터치 ≤ 2 (${d.before} → ${d.after}개)`);
}

// ───────── 켠 모습 (실험실) ─────────
{
  const { p, ctx } = await open(URL, true);
  // §C3 8일 만
  const gold0 = await p.evaluate(() => window.__S.gold);
  await p.evaluate(() => window.__offline(8 * 86400));
  await W(p, 1200);
  const wb = await p.evaluate(() => ({ t: document.getElementById('winT')?.textContent, gift: !!document.querySelector('.wbgift img[src*="box_gift"]'), tiles: document.querySelectorAll('.wbt').length, news: document.querySelectorAll('#wbNews li').length }));
  ok(wb.t?.includes('다녀오셨어요') && wb.gift && wb.tiles === 4, `§C3 「다녀오셨어요」 카드 · 선물 상자 그림 · 4칸 (그동안 바뀐 것 ${wb.news}줄)`);
  const bl0 = await p.evaluate(() => window.__P.gs?.blessUntil ?? 0);
  await p.locator('#offOk').click();
  await W(p, 300);
  const g = await p.evaluate(([g0, b0]) => ({ gold: window.__S.gold - g0, bless: (window.__P.gs?.blessUntil ?? 0) > Math.max(b0, Date.now()) }), [gold0, bl0]);
  ok(g.gold > 0 && g.bless, `§C3 [모두 받기] 한 번: 금화 +${g.gold} · 축복 시간 붙음`);
  await calm(p);
  // §C4 빨간 점: 끝난 원정 → 모험 버튼 점 · 안 읽은 편지 → 메뉴 점
  await finishedRun(p);
  await p.evaluate(() => window.__P.meta.mail.unshift({ id: 99001, at: Date.now(), claimed: false, from: 'system', title: 't', body: 't', reward: {} }));
  await W(p, 1200);
  const dots = await p.evaluate(() => ({ adv: document.getElementById('bAdv')?.classList.contains('rdot'), exp: document.getElementById('bExp')?.classList.contains('rdot'), menu: !document.querySelector('#bMenu2 .ndot')?.hidden, num: !!document.querySelector('#bBuild .nbadge:not([hidden])') }));
  ok(dots.exp && dots.adv && dots.menu && !dots.num, `§C4 점: 원정·모험 ${dots.exp}/${dots.adv} · 메뉴(편지) ${dots.menu} · 건설 숫자 배지 없음`);
  await p.evaluate(() => window.__openMenu());
  await W(p, 300);
  const md = await p.evaluate(() => [...document.querySelectorAll('.mtile')].filter((b) => b.querySelector('.mdot')).map((b) => b.querySelector('span').textContent));
  ok(md.includes('우편함') && md.includes('원정'), `§C4 메뉴 칸 점: ${md.join(' · ')}`);
  await calm(p);
  // 텃밭 레벨업
  const gd = await p.evaluate(() => {
    const w = window.__world;
    const o = (w.home?.objs ?? w.objs).find((x) => x.kind === 'garden' && !x.con);
    if (!o) return null;
    window.__S.gold = Math.max(window.__S.gold, 1e6);
    window.__showObj(o);
    return { lvl: o.lvl, info: !!document.querySelector('.objinfo'), btn: document.getElementById('gdUp')?.textContent ?? null };
  });
  if (gd) {
    ok(gd.info && (gd.btn ?? '').includes(`Lv.${gd.lvl + 1}`), `텃밭 창 맨 위: 정보 한 줄 · [${gd.btn}]`);
    await p.locator('#gdUp').click();
    await W(p, 400);
    const con = await p.evaluate(() => (window.__world.home?.objs ?? window.__world.objs).some((x) => x.kind === 'garden' && x.con?.kind === 'up'));
    ok(con, '텃밭 레벨업 → 공사 시작 (다른 건물과 같은 규칙)');
  } else ok(true, '(이 저장엔 텃밭이 없어 레벨업 건너뜀)');
  await calm(p);
  // 인연 창 [선물하기] → 같은 선물 고르기 창
  await p.evaluate(() => { window.__P.gifts.tea = 3; window.__openMenu(); });
  await W(p, 300);
  await p.evaluate(() => [...document.querySelectorAll('.mtile')].find((b) => b.querySelector('span')?.textContent === '인연')?.click());
  await W(p, 300);
  const tie = await p.evaluate(() => { const t = document.querySelector('.tie:not(.lock)'); t?.click(); return !!t; });
  await W(p, 300);
  if (tie) {
    const inline = await p.locator('[data-gift]').count();
    await p.locator('#tGift').click();
    await W(p, 300);
    const gp = await p.evaluate(() => ({ cls: document.getElementById('win')?.className, t: document.getElementById('winT')?.textContent }));
    ok(inline === 0 && gp.t?.startsWith('선물하기') && (gp.cls ?? '').includes('giftw'), `인연 창: 따로 만든 선물 버튼 없음 → [선물하기] = 같은 선물 고르기 창 (${gp.t})`);
  }
  await calm(p);
  // 마을 작은 메뉴: 같은 이름
  const pm = await p.evaluate(() => {
    const a = window.__world.actors.find((x) => x.id && !x.role && !x.hidden && x.status === 'regular');
    if (!a) return null;
    window.__pmenu(a, 200, 400);
    const r = [document.getElementById('pmTalk')?.textContent, document.getElementById('pmGift')?.textContent];
    document.getElementById('pmenu')?.remove();
    return r;
  });
  if (pm) ok(pm[0] === '말 걸기' && pm[1] === '선물하기', `마을 작은 메뉴 이름: ${pm.join(' · ')}`);
  // 꾸미기 안내 · 좌우 뒤집기
  const nm = await p.evaluate(() => ({ rot: document.getElementById('placeRot')?.getAttribute('aria-label') }));
  ok(nm.rot === '좌우 뒤집기', `배치 버튼 이름: ${nm.rot}`);
  await ctx.close();
}

// ───────── 끔 = 예전 그대로 ─────────
// v0.25.10부터 flags.json에서 welcomeBack·redDots·resendRun·bulkTidy 등을 켬 → 그 빌드에선 「끔」 검사를 건너뛴다
const C2ON = await (async () => { const c = await b.newContext(); try { const j = await (await c.request.get(URL + 'flags.json?x=' + Date.now())).json(); return ['welcomeBack', 'redDots', 'resendRun', 'bulkTidy'].some((k) => j[k] === true); } catch { return false; } finally { await c.close(); } })();
if (C2ON) console.error('· 끔 검사 건너뜀 (flags.json에서 켬)');
else {
  const { p, ctx } = await open(URL, false);
  await p.evaluate(() => window.__offline(8 * 86400));
  await W(p, 800);
  const t = await p.evaluate(() => document.getElementById('winT')?.textContent);
  ok(t?.includes('그동안 마을에서는'), `끔: 방치 요약은 예전 창 (${t})`);
  await calm(p);
  const id = await finishedRun(p);
  await p.evaluate(() => window.__P.meta.mail.unshift({ id: 99001, at: Date.now(), claimed: false, from: 'system', title: 't', body: 't', reward: {} }));
  await W(p, 1000);
  const off = await p.evaluate(() => ({ rdot: document.querySelectorAll('.rdot').length, ready: document.getElementById('bExp')?.classList.contains('ready') }));
  ok(off.rdot === 0 && off.ready, `끔: 빨간 점 클래스 없음 · 원정 버튼은 예전처럼 깜빡임`);
  await p.locator('#bExp').click();
  await W(p, 400);
  await p.locator(`.run.done[data-run="${id}"]`).click();
  await W(p, 500);
  const dlg = await p.locator('#dlg').isVisible();
  ok(dlg, '끔: 보고서는 대화부터');
  await p.locator('#dSkip').click();
  await W(p, 400);
  ok((await p.locator('#repAgain').count()) === 0 && (await p.locator('#repOk').count()) === 1, '끔: 보고서엔 [받기] 하나');
  await calm(p);
  await p.evaluate(() => window.__openMenu());
  await W(p, 300);
  await p.evaluate(() => [...document.querySelectorAll('.mtile')].find((b) => b.querySelector('span')?.textContent === '가방').click());
  await W(p, 300);
  ok((await p.locator('#bagTidy').count()) === 0, '끔: 가방엔 한 번에 분해 버튼 없음');
  await ctx.close();
}

await b.close();
console.error('\n터치 수\n' + rows.map((r) => '  ' + r).join('\n'));
if (errs.length) console.error('페이지 오류:\n' + errs.join('\n'));
console.error(fail || errs.length ? `✗ ${fail}개 실패 · 오류 ${errs.length}` : '✓ 모두 통과');
process.exit(fail || errs.length ? 1 : 0);
