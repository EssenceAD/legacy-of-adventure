// CHECKIN §J6 영웅 카드 · 파티 덱 e2e — 터치 수 전/후 + 폭 360 글자 안 잘림 + 덱 누르기(넣기·빼기·길게 = 상세 · 칩 · 추천 반짝)
//  1) 새 여관(저장 없음) → 장부 카드를 따라 첫 원정 출발까지 터치 수 (탭 + 화면 밖이라 밀어야 했던 횟수)
//  2) 웅스 저장(단골·영웅 19명): 끝없는 심연 파티에서 한 명 바꾸기 (자리의 2번째 → 목록 중간의 다른 사람) 터치 수
//  3) (카드가 있을 때만) 폭 360: 카드 글자 scrollWidth ≤ clientWidth · 덱 위 판/칩 줄 안 넘침 · 412에서 한 화면 카드 수 · 12명이면 스크롤 있나
//  실행: URL=http://localhost:4310/ node scripts/e2e-j6.mjs           (전 · 실험실 끔)
//        URL=http://localhost:4371/ LAB=1 node scripts/e2e-j6.mjs    (후 · 「새 화면 미리 보기」 켬 = heroCards)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const URL = process.env.URL ?? 'http://localhost:4371/';
const LAB = process.env.LAB === '1';
const SAVE = process.env.SAVE ?? 'tests/fixtures/real_woongs.json';
const b = await chromium.launch({ channel: 'chrome' });
const errs = [];
let fail = 0;
const ok = (c, m) => { console.error((c ? '✓ ' : '✗ ') + m); if (!c) fail++; };
const AND = 'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36';
const dev = (w, h) => ({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: AND });
const out = { lab: LAB, url: URL };

/** 터치 세기: tap = 누름 · scroll = 누를 것이 화면(창 몸통) 밖이거나 가려져 한 번 밀어야 했음 */
function counter(p) {
  const c = { tap: 0, scroll: 0, log: [] };
  const W = (ms) => p.waitForTimeout(ms);
  const shown = (sel) => p.evaluate((s) => { const e = document.querySelector(s); return !!e && !e.hidden && e.checkVisibility() && e.getBoundingClientRect().width > 0; }, sel);
  const hit = (loc) => loc.evaluate((el) => { const r = el.getBoundingClientRect(); if (!r.width) return false; const x = r.left + r.width / 2, y = r.top + r.height / 2; if (y < 0 || y > innerHeight) return false; const e = document.elementFromPoint(x, y); return !!e && (e === el || el.contains(e) || e.closest('label') === el); });
  c.tap1 = async (sel, why = sel) => {
    const loc = typeof sel === 'string' ? p.locator(sel).first() : sel;
    await loc.waitFor({ state: 'attached', timeout: 8000 });
    if (!(await hit(loc))) {
      c.scroll++;
      c.log.push(`↕ ${why}`);
      // 덱 위 판(고정)에 가려진 카드는 위 판 높이만큼 더 내려야 보인다
      await loc.evaluate((el) => { el.scrollIntoView({ block: 'center' }); });
      await W(200);
    }
    c.tap++;
    c.log.push(`• ${why}`);
    await loc.click({ timeout: 6000 });
  };
  c.talk = async (max = 80) => {
    for (let i = 0; i < max; i++) {
      if (await shown('#namebox')) { await c.tap1('#nameSug button', '이름 고르기'); await W(300); continue; }
      if (!(await shown('#dlg'))) return;
      if (await shown('#dChoice')) await c.tap1('#dChoice button', '선택지');
      else await c.tap1('#dlg', '대화 넘김');
      await W(200);
    }
  };
  c.shown = shown;
  return c;
}

// ───────── 1) 새 여관 → 첫 원정 ─────────
{
  const ctx = await b.newContext(dev(412, 915));
  await ctx.addInitScript((lab) => {
    window.__conScale = 1 / 30;
    try { if (sessionStorage.getItem('x')) return; sessionStorage.setItem('x', 1); } catch { return; }
    localStorage.clear();
    localStorage.setItem('legacy-of-adventure-teaserSeen', 'true');
    localStorage.setItem('legacy-of-adventure-telemetry', 'false');
    localStorage.setItem('legacy-of-adventure-sound', JSON.stringify({ bgmOn: false, bgmVol: 0.4, sfxOn: false, sfxVol: 0.7, muted: true }));
    if (lab) localStorage.setItem('legacy-of-adventure-visualLab', 'true');
  }, LAB);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  p.on('dialog', (d) => d.accept());
  const W = (ms) => p.waitForTimeout(ms);
  const c = counter(p);
  await p.goto(URL, { waitUntil: 'networkidle' });
  await p.waitForFunction(() => !!window.__S, null, { timeout: 20000 });
  await W(800);
  await c.tap1('#tStart', '시작하기');
  await W(500);
  await c.talk();
  await p.waitForFunction(() => window.__S.started, null, { timeout: 15000 });
  const missionText = () => p.evaluate(() => document.querySelector('#mission')?.querySelector('b')?.textContent ?? '');
  const tapMission = async () => {
    if (await c.shown('#mission')) return c.tap1('#mission', `장부 카드 「${await missionText()}」`);
    const t = await missionText();
    await p.waitForFunction((t) => { const e = document.querySelector('#newsBand'); return !!e && !e.hidden && e.textContent.includes(t); }, t, { timeout: 40000 }).catch(() => {});
    return c.tap1('#newsBand', `소식 띠(장부) 「${t}」`);
  };
  const claim = async () => {
    for (let i = 0; i < 10 && (await p.evaluate(() => document.querySelector('#mission')?.classList.contains('done'))); i++) {
      await tapMission();
      await W(500);
      await c.talk();
      await W(300);
    }
  };
  for (let i = 0; i < 40 && !(await p.evaluate(() => window.__world.actors.some((a) => a.firstGuest && a.st === 'idle'))); i++) await W(250);
  await W(600);
  await c.talk();
  const xy = await p.evaluate(() => window.__guestXY());
  c.tap++;
  c.log.push('• 첫 손님 체크인');
  await p.mouse.click(xy[0], xy[1]);
  await W(700);
  await c.talk();
  await claim();
  await tapMission();
  await W(700);
  await c.tap1('#winB [data-k=fire]', '모닥불 칸');
  await W(700);
  await c.tap1('#placeOk', '여기에 짓기');
  await W(1500);
  await c.talk();
  await claim();
  for (let i = 0; i < 4; i++) {
    await tapMission();
    await W(800);
    if (await p.evaluate(() => !!document.querySelector('.quest.tut'))) break;
    if (await c.shown('#dlg')) await c.talk();
    if (await p.evaluate(() => document.querySelector('#win').classList.contains('on'))) await c.tap1('#winX', '창 닫기');
    await W(500);
  }
  await c.tap1('.quest.tut', '★ 첫 의뢰');
  await W(700);
  const cards = await p.evaluate(() => document.querySelectorAll('.hdk-grid .hcd').length);
  if (LAB) ok(cards > 0, `첫 원정 파티 창 = 카드 덱 (카드 ${cards}장)`);
  if (await p.evaluate(() => document.querySelector('#pGo')?.disabled)) {
    await c.tap1(cards ? '.hdk-grid .hcd:not(.dim)' : '.pm:not([disabled])', '단골 고르기');
    await W(400);
  }
  await c.tap1('#pGo', '출발!');
  await W(800);
  ok(await p.evaluate(() => window.__P.counters.expeditions >= 1 || window.__P.runs.length > 0), '첫 원정 출발');
  out.first = { touches: c.tap + c.scroll, tap: c.tap, scroll: c.scroll };
  console.error(`\n★ 새 여관 → 첫 원정 출발까지 터치 ${c.tap + c.scroll}번 (탭 ${c.tap} · 스크롤 ${c.scroll}) ${LAB ? '[후]' : '[전]'}`);
  console.error('  ' + c.log.join('\n  '));
  await ctx.close();
}

// ───────── 실제 저장 ─────────
const VER = await (async () => { const cx = await b.newContext(); const v = (await (await cx.request.get(URL + 'version.json')).json()).version; await cx.close(); return JSON.stringify(v); })();
async function savedPage(w = 412, h = 915) {
  const sv = JSON.parse(fs.readFileSync(SAVE, 'utf8'));
  const ctx = await b.newContext(dev(w, h));
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
  }, [JSON.stringify({ ...sv, clock: 6 * 60, night: false }), VER, LAB]);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
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
const openAbyss = async (p) => {
  await p.evaluate(() => { window.__P.hunt.best.deep = Math.max(10, window.__P.hunt.best.deep ?? 0); window.__abyss.open(); });
  await p.waitForTimeout(400);
  for (let i = 0; i < 6 && (await p.evaluate(() => !document.querySelector('#dlg').hidden)); i++) { await p.evaluate(() => document.querySelector('#dlg').click()); await p.waitForTimeout(300); }
  await p.waitForTimeout(500);
};
const openParty = async (p) => {
  await p.evaluate(() => { const el = document.createElement('button'); el.dataset.goboard = '1'; document.body.appendChild(el); el.click(); el.remove(); });
  await p.waitForTimeout(600);
  await p.evaluate(() => (document.querySelector('.quest:not(.tut)') ?? document.querySelector('.quest')).click());
  await p.waitForTimeout(600);
};

// ───────── 2) 심연 파티 한 명 바꾸기 ─────────
{
  const { ctx, p } = await savedPage();
  const W = (ms) => p.waitForTimeout(ms);
  await openAbyss(p);
  const pick = await p.evaluate(() => {
    const st = window.__abyss.state();
    const w = window.__world;
    const crew = w.actors.filter((a) => !a.role && (a.status === 'regular' || a.status === 'hero') && a.runId == null && !a.leaving).sort((a, b) => window.__power(b) - window.__power(a));
    const rest = crew.filter((a) => !st.picked.includes(a.id));
    return { out: st.picked[1], in: rest[5]?.id, n: crew.length, picked: st.picked };
  });
  const c = counter(p);
  const cards = await p.evaluate(() => !!document.querySelector('.hdk-grid'));
  await c.tap1(cards ? `.hdk-slot[data-hc="${pick.out}"]` : `.pm[data-ab="${pick.out}"]`, '파티에서 빼기');
  await W(400);
  await c.tap1(cards ? `.hdk-grid .hcd[data-hc="${pick.in}"]` : `.pm[data-ab="${pick.in}"]`, '다른 사람 넣기');
  await W(400);
  const st = await p.evaluate(() => window.__abyss.state().picked);
  ok(st.includes(pick.in) && !st.includes(pick.out), `심연 파티 한 명 바꿈 (${pick.n}명 중) ${JSON.stringify(st)}`);
  out.abyssSwap = { touches: c.tap + c.scroll, tap: c.tap, scroll: c.scroll };
  console.error(`\n★ 심연 파티 한 명 바꾸기 터치 ${c.tap + c.scroll}번 (탭 ${c.tap} · 스크롤 ${c.scroll}) ${LAB ? '[후]' : '[전]'}\n  ${c.log.join('\n  ')}`);

  if (cards) {
    // 덱 누르기: 칩(회복만) · 정렬 한 버튼 · 길게 = 상세 · 추천 편성 반짝
    await p.evaluate(() => document.querySelector('[data-hf="heal"]').click());
    await W(300);
    const heal = await p.evaluate(() => [...document.querySelectorAll('.hdk-grid .hcd .hcd-role')].every((e) => e.classList.contains('r-heal')));
    ok(heal, '역할 칩 「회복」 → 회복 카드만');
    await p.evaluate(() => document.querySelector('[data-hf="all"]').click());
    await W(300);
    const s0 = await p.evaluate(() => document.querySelector('[data-hs]').textContent);
    await p.evaluate(() => document.querySelector('[data-hs]').click());
    await W(300);
    const s1 = await p.evaluate(() => document.querySelector('[data-hs]').textContent);
    ok(s0 !== s1, `정렬 버튼 ${s0} → ${s1}`);
    await p.evaluate(() => document.querySelector('#abRec')?.click());
    await W(120);
    ok(await p.evaluate(() => document.querySelectorAll('.hdk-slot.rglow').length > 0), '추천 편성 → 자리 카드 테두리 반짝');
    await W(1100);
    ok(await p.evaluate(() => document.querySelectorAll('.rglow').length === 0), '반짝은 1초 안에 끝');
    const card = p.locator('.hdk-grid .hcd').nth(4);
    await card.scrollIntoViewIfNeeded();
    const box = await card.boundingBox();
    await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await p.mouse.down();
    await W(700);
    await p.mouse.up();
    await W(400);
    const t = await p.evaluate(() => document.querySelector('#winT')?.textContent ?? '');
    ok(t !== '끝없는 심연', `길게 누르기 → 상세 창 「${t}」`);
    await p.evaluate(() => document.querySelector('#winBack')?.click());
    await W(400);
    ok((await p.evaluate(() => document.querySelector('#winT')?.textContent)) === '끝없는 심연', '← 뒤로 → 심연 파티 창');
  }
  await ctx.close();
}

// ───────── 3) 카드 글자 · 한 화면 카드 수 ─────────
if (LAB) {
  const clipCheck = (p) => p.evaluate(() => {
    const bad = [...document.querySelectorAll('#winB .hcd .hcd-nm, #winB .hcd .hcd-ln, #winB .hcd .hcd-why, #winB .hcd .hcd-note, #winB .hcd .hcd-ex, #winB .hcd .hcd-role, #winB .hcd .hcd-txt, #winB .hdk-bar, #winB .hdk-slots, #winB .hdk-top, #winB .hdk-btns')].filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => `${e.className}:${e.textContent.slice(0, 16)}`);
    const wb = document.querySelector('#winB');
    return { n: document.querySelectorAll('#winB .hcd').length, bad, wide: wb.scrollWidth > wb.clientWidth + 1 };
  });
  {
    const { ctx, p, calm } = await savedPage(360, 740);
    await openParty(p);
    const a = await clipCheck(p);
    ok(a.n > 0 && !a.bad.length && !a.wide, `360 원정 파티: 카드 ${a.n}장 · 글자 안 잘림 ${JSON.stringify(a.bad)}`);
    await calm();
    await p.evaluate(() => document.querySelector('#bGuest').click());
    await p.waitForTimeout(600);
    const g = await clipCheck(p);
    ok(g.n > 0 && !g.bad.length && !g.wide, `360 손님 창: 카드 ${g.n}장 · 글자 안 잘림 ${JSON.stringify(g.bad)}`);
    await calm();
    await openAbyss(p);
    const ab = await clipCheck(p);
    ok(ab.n > 0 && !ab.bad.length && !ab.wide, `360 심연: 카드 ${ab.n}장 · 글자 안 잘림 ${JSON.stringify(ab.bad)}`);
    out.clip360 = { party: a.bad.length, guests: g.bad.length, abyss: ab.bad.length };
    await ctx.close();
  }
  {
    // 412: 한 화면 카드 수 (19명) · 12명만 남기면 스크롤이 있나
    const { ctx, p, calm } = await savedPage(412, 915);
    const view = () => p.evaluate(() => {
      const body = document.querySelector('#winB').getBoundingClientRect();
      const top = document.querySelector('.hdk-top')?.getBoundingClientRect().bottom ?? body.top;
      const cs = [...document.querySelectorAll('.hdk-grid .hcd')];
      const full = cs.filter((c) => { const r = c.getBoundingClientRect(); return r.top >= top - 1 && r.bottom <= body.bottom + 1; }).length;
      const wb = document.querySelector('#winB');
      const g = document.querySelector('.hdk-grid')?.getBoundingClientRect();
      return { cards: cs.length, full, scroll: Math.max(0, wb.scrollHeight - wb.clientHeight), gridFits: !!g && g.bottom <= body.bottom + 1 };
    });
    await openParty(p);
    out.view19 = await view();
    await calm();
    await p.evaluate(() => {
      const hs = window.__world.actors.filter((a) => !a.role && (a.status === 'regular' || a.status === 'hero')).sort((a, b) => window.__power(b) - window.__power(a));
      const comp = window.__world.actors.filter((a) => a.legendId && a.status === 'visitor').length;
      for (const a of hs.slice(12 - comp)) a.status = 'visitor';
    });
    await openParty(p);
    out.view12 = await view();
    ok(out.view12.cards <= 12 && out.view12.gridFits, `12명 이하 → 카드 격자가 스크롤 없이 한 화면 (${JSON.stringify(out.view12)})`);
    await calm();
    await p.setViewportSize({ width: 360, height: 740 });
    await p.waitForTimeout(400);
    await openParty(p);
    const c12 = await clipCheck(p);
    ok(!c12.bad.length && !c12.wide, `360 · 12명(4열) 글자 안 잘림 ${JSON.stringify(c12.bad)}`);
    console.error(`\n412 원정 파티: 19명 → 한 화면 카드 ${out.view19.full}장 (스크롤 ${out.view19.scroll}px) · 12명 → ${out.view12.full}/${out.view12.cards}장 (스크롤 ${out.view12.scroll}px)`);
    ok(out.view19.full >= 9, `한 화면 카드 9장 이상 (${out.view19.full})`);
    await ctx.close();
  }
}

await b.close();
if (errs.length) ok(false, 'page errors: ' + errs.join(' | '));
console.log(JSON.stringify(out));
console.error(fail ? `\n✗ ${fail}개 실패` : '\n✓ 모두 통과');
process.exit(fail ? 1 : 0);
