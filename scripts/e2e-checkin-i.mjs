// CHECKIN v0.25.2 §I·§H e2e (실험실 켬 = 「새 화면 미리 보기」 · 이 기능들은 형철 확인 전까지 기본 꺼짐)
//  #19 손님 목록(이카몰리 저장): ★ 묶음 먼저 · ★끼리도 정렬 기준대로 · 구분 줄 · 지금 정렬 한 줄 · 「★ 맨 위 고정」 끄면 섞임
//  게시판: 「파티 n/m · 게시판 Lv.x」 줄 + [게시판 Lv.2 · 300 G] → 공사 시작 · 꽉 차면 반짝 + 안내 · Lv.3 옛 저장은 「최대」
//  #20 자동 길 끔(고느끼 저장): 꾸미기에서 던전 입구 · 마을 입구를 옮겨도 자동 길 0칸 · 손님은 그대로 걸어 다님
//  §H 신화 안내 한 줄 (도감 신화 탭 · 여정)
//  실행: URL=http://localhost:4312/ ICA=<이카몰리 저장> node scripts/e2e-checkin-i.mjs
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const URL = process.env.URL ?? 'http://localhost:4190/';
const ICA = process.env.ICA;
const GONU = process.env.GONU ?? 'tests/fixtures/real_gonu.json';
if (!ICA || !fs.existsSync(ICA)) throw new Error('ICA=<이카몰리 저장 경로> 가 필요해요 (로컬 전용)');
const b = await chromium.launch({ channel: 'chrome' });
let fail = 0;
const ok = (c, m) => { console.error((c ? '✓ ' : '✗ ') + m); if (!c) fail++; };
const errs = [];

async function open(file, lab = true) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
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
  }, [fs.readFileSync(file, 'utf8'), lab]);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  await p.goto(URL, { waitUntil: 'networkidle' });
  await p.waitForFunction(() => !!window.__S && !!document.querySelector('#tCont'), null, { timeout: 30000 });
  await p.locator('#tCont').click();
  await p.waitForFunction(() => window.__S.started, null, { timeout: 20000 });
  for (let i = 0, calm = 0; i < 80 && calm < 3; i++) {
    const busy = await p.evaluate(() => { if (!document.querySelector('#dlg').hidden) return document.querySelector('#dlg').click(), true; if (document.querySelector('#win').classList.contains('on')) return document.querySelector('#winX').click(), true; return false; });
    calm = busy ? 0 : calm + 1;
    await p.waitForTimeout(busy ? 150 : 400);
  }
  return { p, ctx };
}
const W = (p, ms) => p.waitForTimeout(ms);

// ───────── #19 손님 목록 ─────────
{
  const { p, ctx } = await open(ICA);
  const rows = () => p.evaluate(() => [...document.querySelectorAll('.glist > *')].map((e) => (e.classList.contains('gdiv') ? '|' : `${e.querySelector('.favstar') ? '★' : ''}${e.querySelector('em')?.textContent.replace(/\D/g, '')}`)));
  await p.evaluate(() => window.__openGuests());
  await W(p, 300);
  await p.evaluate(() => document.querySelector('.sortb button[data-s="1"]').click());
  await W(p, 300);
  const r = await rows();
  const div = r.indexOf('|');
  const favs = r.slice(0, div), rest = r.slice(div + 1);
  ok(div > 0 && favs.every((x) => x.startsWith('★')) && rest.every((x) => !x.startsWith('★')), `★ 묶음 ${favs.length}명 → 구분 줄 → 나머지 ${rest.length}명`);
  const pw = (l) => l.map((x) => +x.replace('★', ''));
  const desc = (l) => l.every((v, i) => i === 0 || l[i - 1] >= v);
  ok(desc(pw(favs)) && desc(pw(rest)), `★끼리도 전투력 높은 순 (${pw(favs).join(',')})`);
  const line = await p.evaluate(() => document.querySelector('.gsortln span')?.textContent);
  ok(/전투력 높은 순/.test(line ?? '') && /★ 먼저/.test(line ?? ''), `지금 정렬 한 줄: 「${line}」`);
  await p.evaluate(() => document.getElementById('gPin').click());
  await W(p, 300);
  const r2 = await rows();
  ok(!r2.includes('|') && desc(pw(r2)), `고정 끔 → 구분 줄 없음 · ★도 섞여 전투력 순 (${r2.slice(0, 6).join(',')}…)`);
  const line2 = await p.evaluate(() => document.querySelector('.gsortln span')?.textContent);
  ok(/섞어서/.test(line2 ?? ''), `한 줄: 「${line2}」`);
  ok((await p.evaluate(() => localStorage.getItem('legacy-of-adventure-guestFavPin'))) === 'false', '고정 끔은 이 기기에 기억');
  await p.evaluate(() => document.getElementById('gPin').click());
  await W(p, 200);
  ok((await rows()).includes('|'), '다시 켜면 구분 줄');
  await ctx.close();
}
// 실험실 끔 = 예전 그대로 (★ 고정 줄 없음)
{
  const { p, ctx } = await open(ICA, false);
  await p.evaluate(() => window.__openGuests());
  await W(p, 300);
  ok(await p.evaluate(() => !document.querySelector('.gsortln') && !document.querySelector('.gdiv')), '실험실 끔: 정렬 한 줄 · 구분 줄 없음 (예전 그대로)');
  await p.evaluate(() => window.__showObj(window.__world.objs.find((o) => o.kind === 'board') ?? window.__world.objs.find((o) => o.kind === 'dungeon')));
  await W(p, 300);
  ok(await p.evaluate(() => !document.querySelector('.brdln')), '실험실 끔: 게시판 줄 예전 그대로');
  await ctx.close();
}

// ───────── 게시판 레벨업 ─────────
{
  const { p, ctx } = await open(ICA);
  const st = await p.evaluate(() => {
    const b = window.__world.objs.find((o) => o.kind === 'board');
    b.lvl = 1;
    b.con = undefined;
    window.__S.gold = Math.max(window.__S.gold, 5000);
    window.__showObj(b);
    return document.querySelector('.brdln')?.textContent;
  });
  ok(/파티 \d\/3 · 게시판 Lv\.1/.test(st ?? '') && /게시판 Lv\.2 · 300 G/.test(st ?? ''), `게시판 줄: 「${st}」`);
  // 꽉 참 → 반짝 + 안내
  const full = await p.evaluate(() => {
    const P = window.__P;
    const now = Date.now();
    while (P.runs.filter((r) => !r.result).length < 3) P.runs.push({ id: 9000 + P.runs.length, quest: { ...P.quests.list[0] }, members: [], start: now, end: now + 36e5 });
    window.__showObj(window.__world.objs.find((o) => o.kind === 'board'));
    return { glow: !!document.querySelector('#brdUp.glow'), note: document.querySelector('.brdfull')?.textContent };
  });
  ok(full.glow && /게시판을 Lv\.2로 올리면 1파티 더/.test(full.note ?? ''), `꽉 참: 버튼 반짝 + 「${full.note}」`);
  const g0 = await p.evaluate(() => window.__S.gold);
  await p.evaluate(() => document.getElementById('brdUp').click());
  await W(p, 400);
  const after = await p.evaluate(() => { const b = window.__world.objs.find((o) => o.kind === 'board'); return { gold: window.__S.gold, con: b.con?.to ?? null, toast: document.querySelector('#toast')?.textContent }; });
  ok(after.con === 2 && g0 - after.gold === 300, `[게시판 Lv.2] → 공사 시작 (Lv.${after.con} · −${g0 - after.gold} G · 토스트 「${after.toast}」)`);
  const max = await p.evaluate(() => {
    const b = window.__world.objs.find((o) => o.kind === 'board');
    b.con = undefined;
    b.lvl = 3;
    window.__showObj(b);
    return { line: document.querySelector('.brdln')?.textContent, btn: !!document.getElementById('brdUp') };
  });
  ok(/파티 \d\/4 · 게시판 Lv\.3 · 최대/.test(max.line ?? '') && !max.btn, `옛 Lv.3: 「${max.line}」 · 버튼 없음`);
  await ctx.close();
}

// ───────── #20 자동 길 끔 (고느끼) ─────────
{
  const { p, ctx } = await open(GONU);
  const autoN = () => p.evaluate(() => window.__autoTiles().length);
  ok((await p.evaluate(() => window.__P.decor.autoPath)) === false, '고느끼 저장: 자동 길 끔');
  ok((await autoN()) === 0, `불러온 직후 자동 길 ${await autoN()}칸`);
  // 꾸미기 → 던전 입구 꾹 들어 땅 안 빈자리로 → 확정
  await p.evaluate(() => document.querySelector('#bBuild').click());
  await W(p, 500);
  await p.evaluate(() => document.querySelector('#toDecor').click());
  await W(p, 700);
  await p.evaluate(() => document.querySelector('#decorHint')?.click());
  ok(await p.evaluate(() => document.body.classList.contains('decor')), '꾸미기 모드');
  const moves = [];
  for (let k = 0; k < 3; k++) {
    const r = await p.evaluate((k) => {
      const dg = window.__world.objs.find((o) => o.kind === 'dungeon');
      window.__game.focusTile(dg.tx + 1, dg.ty + 1);
      return [dg.tx, dg.ty, k];
    }, k);
    // 정보 창 → 「옮기기」 버튼 (꾸미기 손 도구와 같은 옮기기)
    await p.evaluate(() => window.__showObj(window.__world.objs.find((o) => o.kind === 'dungeon')));
    await W(p, 300);
    const mv = await p.evaluate(() => { const b = [...document.querySelectorAll('#win button')].find((x) => /옮기기/.test(x.textContent)); b?.click(); return !!b; });
    await W(p, 300);
    if (!mv || !(await p.evaluate(() => window.__placing()?.move?.kind === 'dungeon'))) { ok(false, '던전 입구 들기'); break; }
    const spot = await p.evaluate((k) => {
      const [a, b] = window.__town.landBounds();
      let n = 0;
      for (let y = a; y < b - 3; y++) for (let x = a; x < b - 2; x++) { window.__movePlacement(x + 1.5, y + 1.5); const q = window.__placing(); if (q.ok && q.tx === x && q.ty === y && n++ >= k * 7) return [x, y]; }
      return null;
    }, k);
    if (!spot) { ok(false, '던전 빈자리 없음'); break; }
    await p.evaluate(() => document.querySelector('#placeOk').click());
    await W(p, 500);
    const now = await p.evaluate(() => { const o = window.__world.objs.find((x) => x.kind === 'dungeon'); return [o.tx, o.ty]; });
    moves.push(`${r[0]},${r[1]}→${now}`);
    ok((await autoN()) === 0, `던전 입구 옮김 ${r[0]},${r[1]} → ${now} · 자동 길 ${await autoN()}칸`);
  }
  // 마을 입구 옮기기
  const e0 = await p.evaluate(() => window.__ent());
  await p.evaluate(() => document.querySelector('#decorBar [data-act="ent"]')?.click());
  await W(p, 300);
  const tgt = await p.evaluate(([ex, ey]) => {
    const [a] = window.__town.landBounds();
    for (let d = 2; d < 12; d++) for (const x of [ex - d, ex + d]) { window.__movePlacement(x + 0.5, ey + 0.5); const q = window.__placing(); if (q?.ok && q.tx === x) return x; }
    return null;
  }, e0);
  if (tgt != null) {
    await p.evaluate(() => document.querySelector('#placeOk').click());
    await W(p, 500);
    const e1 = await p.evaluate(() => window.__ent());
    ok(e1[0] === tgt && (await autoN()) === 0, `마을 입구 옮김 ${e0} → ${e1} · 자동 길 ${await autoN()}칸`);
  } else ok(false, '마을 입구 옮길 자리 없음');
  await p.evaluate(() => document.querySelector('#decorBar [data-act="exit"]')?.click());
  await W(p, 300);
  // 걷기: 새 손님이 입구에서 들어와 걷는다 · 원정 파티는 던전까지 걸어간다 (길 그림과 상관없이)
  const walk = await p.evaluate(() => {
    const a = window.__world.actors.find((x) => !x.hidden && !x.role && x.status === 'regular');
    if (!a) return null;
    const dg = window.__world.objs.find((o) => o.kind === 'dungeon');
    return { from: [Math.round(a.x), Math.round(a.y)], dg: [dg.tx, dg.ty] };
  });
  ok(!!walk, `손님이 마을에 있음 ${JSON.stringify(walk)}`);
  await p.waitForTimeout(3000);
  const moved = await p.evaluate(() => window.__world.actors.filter((a) => !a.hidden && a.st === 'walk').length);
  ok(moved > 0, `걷는 손님 ${moved}명 (자동 길 0칸이어도)`);
  await p.screenshot({ path: 'reports/checkin/i20/e2e_after_moves.png' });
  console.error('  옮김: ' + moves.join(' · '));
  await ctx.close();
}

// ───────── §H 신화 안내 ─────────
{
  const { p, ctx } = await open(ICA);
  await p.evaluate(() => window.__openDex(7));
  await W(p, 300);
  const t1 = await p.evaluate(() => document.querySelector('.mythgd')?.textContent);
  await p.evaluate(() => window.__openJourney());
  await W(p, 300);
  const t2 = await p.evaluate(() => document.querySelector('#win .mythgd')?.textContent);
  const want = '신화는 2회차부터 — 전설 영웅과 인연 5를 맺고 엔딩을 본 뒤, 다음 여관에서 만나요';
  ok(t1 === want && t2 === want, `신화 안내 (도감 · 여정): 「${t1}」`);
  await ctx.close();
}

ok(errs.length === 0, '페이지 오류 없음 ' + errs.join(' | '));
await b.close();
console.error(fail ? `✗ ${fail}개 실패` : '✓ 모두 통과');
process.exit(fail ? 1 : 0);
