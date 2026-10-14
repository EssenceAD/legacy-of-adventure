// PACE §2 자동 사냥 여러 파티 (플래그 huntSlots) — 진짜 클릭 (개발용 전역은 상태 읽기 · 시간 단축에만)
//  실험실 켬: 칸 카드 줄 3칸 → [+ 맡기기]로 2·3칸 채우기(진짜 클릭) → 한 손님 한 칸(흐리게) → 칸 하나 멈추기 → 방치 정산 칸별 줄 → 다녀오셨어요 카드 칸별 줄 → 진행 줄 요약
//  실험실 끔: 예전 한 줄(.hauto) · 칸 카드 없음 · 맡겨 두기 0번 칸
//  실행: BOT_BUILD=1 npx vite build --outDir dist-bot && npx vite preview --outDir dist-bot --port 4431 그리고 node scripts/e2e-huntslots.mjs [URL]
//  저장: SAVE=<경로> (기본 tests/fixtures/real_woongs.json — 장부 6장 이상 · 맡겨 둔 사냥 있는 후반 저장, 로컬 전용)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const URL = process.argv[2] ?? 'http://localhost:4431/';
const SAVE = process.env.SAVE ?? 'tests/fixtures/real_woongs.json';
const OUT = 'screenshots/huntslots';
fs.mkdirSync(OUT, { recursive: true });
const sv = JSON.parse(fs.readFileSync(SAVE, 'utf8'));
let fail = 0;
const ok = (c, m) => {
  console.error((c ? '✓ ' : '✗ ') + m);
  if (!c) fail++;
};
const b = await chromium.launch({ channel: 'chrome' });
const VER = await (async () => { const c = await b.newContext(); const v = (await (await c.request.get(URL + 'version.json')).json()).version; await c.close(); return JSON.stringify(v); })();

async function boot(lab) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(([s, ver, lab]) => {
    try { if (sessionStorage.getItem('x')) return; sessionStorage.setItem('x', 1); } catch { return; }
    localStorage.clear();
    localStorage.setItem('legacy-of-adventure-save', s);
    localStorage.setItem('legacy-of-adventure-teaserSeen', 'true');
    localStorage.setItem('legacy-of-adventure-lastVersion', ver);
    localStorage.setItem('legacy-of-adventure-settleOff', 'true');
    localStorage.setItem('legacy-of-adventure-telemetry', 'false');
    if (lab) localStorage.setItem('legacy-of-adventure-visualLab', 'true');
    localStorage.setItem('legacy-of-adventure-sound', JSON.stringify({ bgmOn: false, bgmVol: 0.4, sfxOn: false, sfxVol: 0.7, muted: true }));
  }, [JSON.stringify(sv), VER, lab]);
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
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
  // 모두 집에 · 체력 가득 (원정 중이면 칸이 멈춘다)
  await p.evaluate(() => { window.__P.runs.length = 0; for (const a of window.__world.actors) if (a.id) { a.runId = null; a.hp = 100; } });
  return { ctx, p, errs, clear };
}
const W = (p, ms) => p.waitForTimeout(ms);
/** 마을 대화(손님 이벤트)가 끼어들면 먼저 넘긴다 — 창은 그대로 */
const skipDlg = async (p) => {
  for (let i = 0; i < 30 && (await p.evaluate(() => !document.querySelector('#dlg').hidden)); i++) {
    await p.evaluate(() => document.querySelector('#dlg').click());
    await W(p, 150);
  }
};
const click = async (p, sel, ms = 600) => {
  await skipDlg(p);
  try {
    await p.locator(sel).first().click({ timeout: 3000 });
    await W(p, ms);
    return true;
  } catch (e) {
    console.error('  창:', await p.evaluate(() => (document.querySelector('#winT')?.textContent ?? '') + ' | ' + (document.querySelector('#winB')?.innerHTML ?? '').slice(0, 300) + ' | dlg ' + !document.querySelector('#dlg').hidden + ' | P.auto ' + JSON.stringify(window.__P.hunt.auto) + ' lab ' + localStorage.getItem('legacy-of-adventure-visualLab')));
    console.error(`  (클릭 실패 ${sel}: ${String(e).split('\n').slice(0, 3).join(' / ').slice(0, 300)})`);
    return false;
  }
};

// ───── 실험실 켬 ─────
{
  const { ctx, p, errs, clear } = await boot(true);
  const a0 = await p.evaluate(() => window.__P.hunt.auto);
  ok(!!a0, `불러온 뒤 맡겨 둔 사냥 그대로 (${a0?.region} ${a0?.stage}) · autos[0] = auto`);
  await p.evaluate(() => window.__openHunt());
  await W(p, 600);
  const cards = await p.evaluate(() => ({ n: document.querySelectorAll('.hslot').length, on: document.querySelectorAll('.hslot [data-hstop]').length, add: document.querySelectorAll('[data-hadd]').length, head: document.querySelector('.hslots .sub')?.textContent ?? '', old: !!document.querySelector('.hauto') }));
  ok(cards.n === 3 && cards.on === 1 && cards.add === 2 && !cards.old, `칸 카드 줄 3칸 (맡김 ${cards.on} · 빈 칸 ${cards.add}) · 예전 한 줄 없음 · 「${cards.head.trim()}」`);
  await p.screenshot({ path: `${OUT}/lab_0_open.png` });
  // 2칸 [+ 맡기기] → 준비 창 (0번 칸 손님은 흐리게) → 맡겨 두기
  for (const slot of [1, 2]) {
    await click(p, `[data-hadd="${slot}"]`, 700);
    const prep = await p.evaluate((slot) => {
      const t = document.querySelector('#winT')?.textContent ?? '';
      const busy = [...document.querySelectorAll('small')].filter((e) => /맡겨 둔 사냥 \d칸/.test(e.textContent)).length;
      const desc = [...document.querySelectorAll('.hopt small, .hopts small')].map((e) => e.textContent).find((x) => /칸에 맡겨요/.test(x)) ?? '';
      return { t, busy, desc, hasKeep: !!document.querySelector('#hRepeat') };
    }, slot);
    ok(prep.hasKeep && prep.busy >= slot * 2, `${slot + 1}칸 준비 창 「${prep.t}」 · 다른 칸 손님 흐리게 ${prep.busy}명${prep.desc ? ` · 「${prep.desc}」` : ''}`);
    if (slot === 1) await p.screenshot({ path: `${OUT}/lab_1_prep.png` });
    await click(p, '#hRepeat', 700);
    const st = await p.evaluate(() => window.__P.hunt.autos.map((x) => (x ? `${x.region}-${x.stage}:${x.members.join(',')}` : null)));
    ok(!!st[slot], `${slot + 1}칸 맡겨 둠 → ${st[slot]}`);
  }
  const ids = await p.evaluate(() => window.__P.hunt.autos.filter(Boolean).flatMap((x) => x.members));
  ok(new Set(ids).size === ids.length, `한 손님은 한 칸에만 (${ids.length}명 겹침 없음)`);
  await p.evaluate(() => window.__openHunt());
  await W(p, 500);
  const full = await p.evaluate(() => ({ stop: document.querySelectorAll('[data-hstop]').length, head: document.querySelector('.hslots .sub')?.textContent.trim(), faces: document.querySelectorAll('.hslot .hsf img').length }));
  ok(full.stop === 3 && /3\/3/.test(full.head), `3칸 다 맡김 · 「${full.head}」 · 얼굴 ${full.faces}`);
  await p.screenshot({ path: `${OUT}/lab_2_full.png` });
  // 30초 한 판 (시계 당기기) → 세 칸 모두 판 수 +1
  await p.evaluate(() => (window.__P.hunt.idleAt -= 31_000));
  await W(p, 1200);
  const n = await p.evaluate(() => window.__P.hunt.autos.map((x) => x?.n ?? null));
  ok(n.every((x) => x >= 1), `한 시계로 칸 전부 한 판 (판 수 ${n.join(' · ')})`);
  // 진행 줄 요약 (창을 닫고)
  await clear();
  await W(p, 800);
  const rb = await p.evaluate(() => document.querySelector('#rbHunt b')?.textContent ?? '');
  ok(/맡겨 둔 사냥 3칸/.test(rb), `진행 줄 한 줄 요약 「${rb}」`);
  await p.screenshot({ path: `${OUT}/lab_3_runbar.png` });
  // 2칸 멈추기
  await p.evaluate(() => window.__openHunt());
  await W(p, 500);
  await click(p, '[data-hstop="1"]', 600);
  const afterStop = await p.evaluate(() => ({ autos: window.__P.hunt.autos.map((x) => !!x), add: document.querySelectorAll('[data-hadd]').length }));
  ok(afterStop.autos.join() === 'true,false,true' && afterStop.add === 1, `2칸만 멈춤 (${afterStop.autos.join(',')}) · 빈 칸 「+ 맡기기」 다시`);
  await clear();
  // 방치 정산: 2시간 → 칸별 줄
  const off = await p.evaluate(() => {
    const s = window.__offline(2 * 3600);
    return s?.hunt ? { lines: (s.hunt.slots ?? [s.hunt]).map((h) => `${h.label} ${h.clears}판 ${h.gold}G`), gold: s.hunt.gold } : null;
  });
  ok(off && off.lines.length === 2, `방치 정산 칸마다 한 줄: ${off?.lines.join(' / ')}`);
  await W(p, 700);
  const card = await p.evaluate(() => ({ t: document.querySelector('#winT')?.textContent ?? '', lines: [...document.querySelectorAll('.offl div')].map((d) => d.textContent).filter((x) => /방치 사냥/.test(x)) }));
  ok(card.lines.length === 2, `「${card.t}」 창 방치 사냥 ${card.lines.length}줄: ${card.lines.map((x) => x.trim()).join(' | ')}`);
  await p.screenshot({ path: `${OUT}/lab_4_offline.png` });
  // 저장 → 다시 불러오기: 칸 그대로
  await p.evaluate(() => window.__saveNow());
  const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('legacy-of-adventure-save')).progress.hunt);
  ok(!!saved.auto && saved.autos.length >= 3 && !!saved.autos[0] && saved.autos[0].region === saved.auto.region && !saved.autos[1] && !!saved.autos[2], `저장: auto(옛 앱용) + autos[] (${saved.autos.map((x) => (x ? x.region : '-')).join(',')})`);
  ok(!errs.length, `페이지 오류 없음${errs.length ? ': ' + errs.join(' | ') : ''}`);
  await ctx.close();
}

// ───── 실험실 끔 (플래그 기본값) ─────
{
  const { ctx, p, errs } = await boot(false);
  await p.evaluate(() => window.__openHunt());
  await W(p, 600);
  const v = await p.evaluate(() => ({ slots: !!document.querySelector('.hslots'), old: !!document.querySelector('.hauto'), stop: !!document.querySelector('#hStop') }));
  ok(!v.slots && v.old && v.stop, `끔: 칸 카드 없음 · 예전 한 줄(.hauto · 멈추기) 그대로`);
  await p.screenshot({ path: `${OUT}/off_0_open.png` });
  // 예전처럼 맡겨 두기 → 0번 칸 바꾸기
  const top = await p.evaluate(() => { const P = window.__P; const r = P.hunt.auto.region; return { r, s: P.hunt.best[r] }; });
  await p.evaluate((r) => window.__openHunt(r), top.r);
  await W(p, 500);
  await click(p, `[data-s="${top.s}"]`, 700);
  const desc = await p.evaluate(() => [...document.querySelectorAll('.hopts small')].map((e) => e.textContent).join(' | '));
  ok(!/칸에 맡겨요/.test(desc), '끔: 준비 창 설명 예전 그대로');
  await click(p, '#hRepeat', 700);
  const st = await p.evaluate(() => ({ auto: window.__P.hunt.auto, n: window.__P.hunt.autos.filter(Boolean).length }));
  ok(!!st.auto && st.n === 1, `끔: 맡겨 두기 = 0번 칸 하나 (${st.auto?.region}-${st.auto?.stage})`);
  const off = await p.evaluate(() => { const s = window.__offline(2 * 3600); return s?.hunt ? { slots: !!s.hunt.slots, label: s.hunt.label } : null; });
  ok(off && !off.slots, `끔: 방치 정산 한 줄 (${off?.label})`);
  ok(!errs.length, `페이지 오류 없음${errs.length ? ': ' + errs.join(' | ') : ''}`);
  await ctx.close();
}
await b.close();
console.error(fail ? `✗ ${fail}개 실패` : '✓ 모두 통과');
process.exit(fail ? 1 : 0);
