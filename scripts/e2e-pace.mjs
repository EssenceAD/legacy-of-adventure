// PACE §1·§3-1 e2e (봇 빌드): 기다리던 실세이브가 배포 뒤 접속 때 3막으로 넘어가는지 · 토벌 도전장(연속 보스) 흐름
//  실행: URL=http://localhost:4421/ node scripts/e2e-pace.mjs <저장 폴더>   (저장 = 2막에서 기다리던 실세이브 · 로컬 전용)
//  접속 시각은 브라우저의 Date를 옮겨서 흉내 낸다 (AT=한국 시간 'YYYY-MM-DDTHH:mm' · 기본 10/15 10:00)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
const dir = process.argv[2];
if (!dir) throw new Error('사용법: node scripts/e2e-pace.mjs <저장 폴더>');
const URL = process.env.URL ?? 'http://localhost:4190/';
const kst = (s) => Date.parse(s + ':00+09:00');
const LOGIN = kst(process.env.AT ?? '2026-10-15T10:00');
const fmtK = (t) => new Date(t + 9 * 36e5).toISOString().slice(5, 16).replace('T', ' ') + ' KST';
const b = await chromium.launch({ channel: 'chrome' });
let fail = 0;
const out = [];
const ok = (c, m) => { out.push((c ? '✓ ' : '✗ ') + m); if (!c) fail++; };

/** 저장을 그 시각에 불러와 마을이 돈 뒤 page를 돌려준다 */
async function open(raw, at) {
  const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(([save, at]) => {
    const RD = Date;
    const off = at - RD.now();
    class FD extends RD {
      constructor(...a) { if (a.length === 0) super(RD.now() + off); else super(...a); }
      static now() { return RD.now() + off; }
    }
    globalThis.Date = FD;
    try { if (sessionStorage.getItem('x')) return; sessionStorage.setItem('x', 1); } catch { return; }
    localStorage.clear();
    localStorage.setItem('legacy-of-adventure-save', save);
    localStorage.setItem('legacy-of-adventure-teaserSeen', 'true');
    localStorage.setItem('legacy-of-adventure-lastVersion', '"99"');
    localStorage.setItem('legacy-of-adventure-telemetry', 'false');
    localStorage.setItem('legacy-of-adventure-settleOff', 'true');
    localStorage.setItem('legacy-of-adventure-sound', JSON.stringify({ bgmOn: false, bgmVol: 0.4, sfxOn: false, sfxVol: 0.7, muted: true }));
  }, [raw, at]);
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  await p.goto(URL, { waitUntil: 'networkidle' });
  await p.waitForFunction(() => !!window.__S, null, { timeout: 20000 });
  await p.waitForTimeout(1000);
  await p.locator('#tCont').click();
  await p.waitForTimeout(2500);
  return { p, ctx, errs };
}
/** 대화·창을 닫으며 n초 동안 마을을 돌린다 (막 컷이 나오면 그 대사도 넘긴다) */
async function settle(p, sec) {
  const t0 = Date.now();
  while (Date.now() - t0 < sec * 1000) {
    await p.evaluate(() => {
      if (!document.querySelector('#dlg').hidden) document.querySelector('#dlg').click();
      else if (document.querySelector('#win').classList.contains('on')) document.querySelector('#winX')?.click();
    });
    await p.waitForTimeout(250);
  }
}

for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
  const raw = fs.readFileSync(path.join(dir, f), 'utf8');
  const sv = JSON.parse(raw);
  const name = sv.innName;
  // 1) 배포 직후 첫 접속
  let { p, ctx, errs } = await open(raw, LOGIN);
  const st = await p.evaluate(() => ({ act: window.__P.story.act, at: window.__P.story.actAt?.[2] ?? 0, actDay: window.__P.story.actDay?.[2], day0: window.__P.story.day0, day: window.__S.day }));
  await settle(p, 4);
  const after = await p.evaluate(() => ({ act: window.__P.story.act, wait: document.getElementById('storyWait')?.textContent ?? '', note: document.getElementById('mission')?.textContent ?? '' }));
  ok(st.at > 0 && st.at < LOGIN, `${name}: 2막 시각 채움 ${st.at ? fmtK(st.at) : '없음'}`);
  // 3막이 오는 시각 = 2막 시각 + (40 − 2막 들어간 날) ÷ realDayAs 일 (REAL_DAY_AS · 기본 10 = CONFIG.story.realDayAs)
  const startDay = Math.max(1, st.actDay - st.day0 + 1);
  const when = st.at + ((40 - startDay) / Number(process.env.REAL_DAY_AS ?? 10)) * 864e5;
  const gameLeft = 40 - (st.day - st.day0 + 1);
  out.push(`  ${name}: ${fmtK(LOGIN)} 접속 → ${after.act === 3 ? '3막 컷!' : `2막 그대로 · 띠 「${after.wait || after.note.slice(0, 60)}」 · 3막 ${fmtK(when)} (현실 ${((when - LOGIN) / 864e5).toFixed(2)}일 뒤) 또는 게임 ${gameLeft}일 더`}`);
  ok(errs.length === 0, `${name}: 오류 없음 ${errs.join(' | ')}`);
  await ctx.close();
  // 2) 도전장은 이야기 컷이 끼어들지 않게 따로 연다 (저장한 주 · 3막 시각 전: RAID_AT · 기본 10/14 12:00)
  ({ p, ctx, errs } = await open(raw, kst(process.env.RAID_AT ?? '2026-10-14T12:00')));
  // 2) 도전장: 이번 주 첫 보스를 이미 잡은 저장 → 게시판에 도전장 · 고르면 2번째 보스 토벌 창 맨 위 「이번 주 2/3」
  const raid = await p.evaluate(async () => {
    const P = window.__P;
    for (const a of window.__world.actors) if (a.id) a.hp = 100;
    P.runs.length = 0;
    return { killed: P.raid.killed, boss: P.raid.bossId, week: P.raid.week };
  });
  // 3막 컷·편지가 끝날 때까지 넘기고 게시판을 연다 (게시판 토벌 칸이 보일 때까지 몇 번)
  for (let i = 0; i < 6; i++) {
    await settle(p, 3);
    await p.evaluate(() => document.getElementById('bExp').click());
    await p.waitForTimeout(900);
    if (await p.evaluate(() => !!document.querySelector('#win .raids') && document.querySelector('#dlg').hidden)) break;
  }
  const chal = await p.locator('[data-chal]').count();
  const line = await p.locator('.chainline, #rChalLine').first().textContent().catch(() => '');
  out.push(`  ${name}: 이번 주 ${raid.boss} 처치=${raid.killed} · 게시판 도전장 ${chal}개 · 「${line}」`);
  if (raid.killed && raid.week) {
    ok(chal > 0 || /모두 처치|지역을 더/.test(line ?? ''), `${name}: 잡은 주엔 도전장(또는 이유 한 줄)`);
    if (chal > 0) {
      await p.evaluate(() => document.querySelector('[data-chal]').click());
      await p.waitForTimeout(900);
      const top = await p.locator('#rChain').textContent().catch(() => '');
      ok(/이번 주 2\/3/.test(top ?? ''), `${name}: 도전장 → 토벌 창 맨 위 「${top}」`);
      const nb = await p.evaluate(() => ({ n: window.__P.raid.chainN, hp: window.__P.raid.hpLeft, boss: window.__P.raid.bossId }));
      ok(nb.n === 2 && nb.hp > 0, `${name}: 2번째 보스 ${nb.boss} 체력 가득 ${nb.hp}`);
      const before = await p.evaluate(() => window.__S.gold);
      const btn = p.locator('#rgAuto');
      if (await btn.count()) {
        await p.evaluate(() => document.getElementById('rgAuto').click());
        await p.waitForTimeout(1200);
        const res = await p.evaluate(() => document.querySelector('#win .res')?.textContent ?? '');
        ok(/도전장 보스는 주간 랭킹에 안 들어가요/.test(res), `${name}: 결과 「랭킹은 첫 보스만」`);
        const g = await p.evaluate(() => window.__S.gold);
        ok(g > before, `${name}: 자동 토벌 보상 +${g - before}`);
      }
    }
  }
  await ctx.close();
  // 3) 3막이 오는 시각 + 1분에 접속 → 컷 (이미 넘었으면 생략)
  ok(after.act === 3 || when > LOGIN, `${name}: 아직 3막이 아니면 3막 시각이 접속 뒤`);
  if (after.act !== 3 && Number.isFinite(when)) {
    ({ p, ctx, errs } = await open(raw, Math.max(LOGIN, when + 60e3)));
    await settle(p, 6);
    const a3 = await p.evaluate(() => window.__P.story.act);
    ok(a3 === 3, `${name}: ${fmtK(when + 60e3)} 접속 → ${a3 === 3 ? '3막 컷' : a3 + '막'}`);
    await ctx.close();
  }
}
await b.close();
console.log(out.join('\n'));
console.log(fail ? `✗ ${fail}개 실패` : '✓ 모두 통과');
process.exit(fail ? 1 : 0);
