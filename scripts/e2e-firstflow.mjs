// CHECKIN §B 첫 30분 동선 (firstFlowFix) e2e + K6 터치 수
//  1) 새 여관(저장 없음) → 장부 카드를 따라 첫 원정 출발까지 「터치 수」(탭 + 화면 밖이라 스크롤해야 했던 횟수)를 센다
//     · 모닥불 임무: 건설 창 맨 위 대상 + 반짝 (LAB) · 첫 원정 파티 창 맨 위 [추천 편성]·성공률·[출발!] + 잠긴 5번째 칸 (LAB)
//  2) 장비 임무 바로가기: 손님 창을 「방문」 탭에 둔 뒤 → 늘 「단골」 탭 + 반짝 (LAB)
//  3) K6 (실제 저장 real_ttabam): 원정 끝 → 다시 보내기 · 장비 일괄 정리 · 아래 탭 바꾸기 터치 수 · 412폭 44px 미만 버튼 목록
//  실행: URL=http://localhost:4310/ node scripts/e2e-firstflow.mjs        (전 · 실험실 끔)
//        URL=http://localhost:4313/ LAB=1 node scripts/e2e-firstflow.mjs  (후 · 「새 화면 미리 보기」 켬 = firstFlowFix 켬)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const URL = process.env.URL ?? 'http://localhost:4190/';
const LAB = process.env.LAB === '1';
const SAVE = process.env.SAVE ?? (fs.existsSync('tests/fixtures/real_ttabam.json') ? 'tests/fixtures/real_ttabam.json' : 'tests/fixtures/real_lotte.json');
const b = await chromium.launch({ channel: 'chrome' });
const errs = [];
let fail = 0;
const ok = (c, m) => { console.error((c ? '✓ ' : '✗ ') + m); if (!c) fail++; };
const AND = 'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36';
const DEV = { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: AND };

/** 터치 세기: tap = 누름 · scroll = 누를 것이 화면(창 몸통) 밖이라 한 번 밀어야 했음 */
function counter(p) {
  const c = { tap: 0, scroll: 0, log: [] };
  const W = (ms) => p.waitForTimeout(ms);
  const shown = (sel) => p.evaluate((s) => { const e = document.querySelector(s); return !!e && !e.hidden && e.checkVisibility() && e.getBoundingClientRect().width > 0; }, sel);
  /** 화면에 보이고 그 자리를 누르면 그게 눌리나 */
  const hit = (loc) => loc.evaluate((el) => { const r = el.getBoundingClientRect(); if (!r.width) return false; const x = r.left + r.width / 2, y = r.top + r.height / 2; if (y < 0 || y > innerHeight) return false; const e = document.elementFromPoint(x, y); return !!e && (e === el || el.contains(e) || e.closest('label') === el); });
  c.tap1 = async (sel, why = sel) => {
    const loc = typeof sel === 'string' ? p.locator(sel).first() : sel;
    await loc.waitFor({ state: 'attached', timeout: 8000 });
    if (!(await hit(loc))) {
      c.scroll++;
      c.log.push(`↕ ${why}`);
      await loc.scrollIntoViewIfNeeded();
      await W(150);
    }
    c.tap++;
    c.log.push(`• ${why}`);
    await loc.click({ timeout: 6000 }).catch(async (e) => {
      const st = await p.evaluate(() => ({ win: document.querySelector('#win').className, title: document.querySelector('#winT')?.textContent, dlg: !document.querySelector('#dlg').hidden && document.querySelector('#dlg').textContent.slice(0, 60), hud: document.querySelector('#hud')?.hidden, body: document.body.className, nav: document.querySelector('nav.dk')?.checkVisibility() }));
      throw new Error(`누르기 실패 「${why}」 ${JSON.stringify(st)} ${String(e).split('\n')[0]}`);
    });
  };
  /** 대화 넘기기 (이름 칸이면 추천 이름 · 선택지는 첫 번째) */
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
  c.hit = hit;
  return c;
}

// ───────── 1) 새 여관 → 첫 원정 ─────────
{
  const ctx = await b.newContext(DEV);
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
  /** 장부 카드 누르기 (실험실 새 HUD면 카드가 소식 띠로 옮겨 감 — 띠에 장부가 뜰 때까지 기다렸다 누름) */
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
  // 첫 손님
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
  ok(/모닥불/.test(await missionText()), '다음 임무: ' + (await missionText()));
  // 모닥불: 장부 카드 → 건설 창
  await tapMission();
  await W(700);
  const b1 = await p.evaluate(() => {
    const top = document.querySelector('.cat.mtarget button');
    const cats = [...document.querySelectorAll('#winB .cat:not(.deco):not(.recent):not(.mtarget) button[data-k]')].map((x) => x.classList.contains('locked'));
    const firstLocked = cats.indexOf(true);
    return { top: top?.dataset.k ?? null, glow: !!top?.classList.contains('ffglow'), lockedBelow: firstLocked < 0 || cats.slice(firstLocked).every(Boolean), title: document.querySelector('#winT')?.textContent };
  });
  if (LAB) {
    ok(b1.top === 'fire', '§B-1 건설 창 맨 위 = 모닥불 ' + JSON.stringify(b1));
    ok(b1.glow, '§B-1 대상 칸 반짝 테두리');
    ok(b1.lockedBelow, '§B-1 잠긴 건물은 열린 것 아래');
    await W(3300);
    ok(!(await p.evaluate(() => !!document.querySelector('.cat.mtarget button.ffglow'))), '§B-1 반짝 3초 뒤 끝');
  } else ok(b1.top === null, '전(끔): 맨 위 대상 칸 없음 ' + JSON.stringify(b1));
  await c.tap1('#winB [data-k=fire]', '모닥불 칸');
  await W(700);
  await c.tap1('#placeOk', '여기에 짓기');
  await W(1500);
  await c.talk();
  await claim();
  ok(/정찰/.test(await missionText()), '다음 임무: ' + (await missionText()));
  // 30초 정찰: 장부 카드 → 게시판 → ★ 첫 의뢰 → 파티
  // 실험실 새 HUD: 띠가 다른 소식으로 넘어가는 순간 누르면 엉뚱한 곳이 열린다 — 그것도 사람의 헛터치로 세고 다시
  for (let i = 0; i < 4; i++) {
    await tapMission();
    await W(800);
    if (await p.evaluate(() => !!document.querySelector('.quest.tut'))) break;
    const st = await p.evaluate(() => ({ win: document.querySelector('#win').classList.contains('on') && document.querySelector('#winT')?.textContent, dlg: !document.querySelector('#dlg').hidden, band: document.querySelector('#newsBand')?.textContent }));
    c.log.push(`  (헛터치: ${JSON.stringify(st)})`);
    if (st.dlg) await c.talk();
    if (await p.evaluate(() => document.querySelector('#win').classList.contains('on'))) await c.tap1('#winX', '창 닫기');
    await W(500);
  }
  await c.tap1('.quest.tut', '★ 첫 의뢰');
  await W(700);
  const b2 = await p.evaluate(() => {
    const body = document.querySelector('#winB');
    const first = body.firstElementChild;
    return {
      topRec: !!first?.querySelector('#pRec'), topGo: !!first?.querySelector('#pGo'), topRate: /성공률/.test(first?.textContent ?? ''),
      slot5Note: /폐광 의뢰 3번/.test(body.textContent), lock: !!document.querySelector('#pSlot5'), goOn: !document.querySelector('#pGo')?.disabled,
    };
  });
  if (LAB) {
    ok(b2.topRec && b2.topGo && b2.topRate, '§B-2 맨 위 [추천 편성] · 성공률 · [출발!] ' + JSON.stringify(b2));
    ok(!b2.slot5Note && b2.lock, '§B-2 5번째 자리 설명은 위에 없음 · 잠긴 칸 있음');
    await p.locator('#pSlot5').click();
    await W(300);
    const t = await p.evaluate(() => [...document.querySelectorAll('.toast, #toast, .tst')].map((x) => x.textContent).join(' ') || document.body.innerText.match(/폐광 의뢰 3번[^\n]*/)?.[0] || '');
    ok(/폐광/.test(t), '§B-2 잠긴 칸 누르면 조건 안내: ' + t.slice(0, 60));
    ok(b2.goOn, '§B-2 첫 원정은 추천 편성이 미리 골라져 [출발!] 바로 가능');
  }
  if (!b2.goOn) {
    await c.tap1('.pm:not([disabled])', '단골 고르기');
    await W(400);
  }
  await c.tap1('#pGo', '출발!');
  await W(800);
  const sent = await p.evaluate(() => window.__P.counters.expeditions >= 1 || window.__P.runs.length > 0);
  ok(sent, '첫 원정 출발');
  console.error(`\n★ 새 여관 → 첫 원정 출발까지 터치 ${c.tap + c.scroll}번 (탭 ${c.tap} · 스크롤 ${c.scroll}) ${LAB ? '[후 · 실험실 켬]' : '[전]'}`);
  console.error('  ' + c.log.join('\n  '));
  // 보고서 버튼 (§B-5): 30초 정찰이 돌아오길 기다렸다가 버튼 글자
  let back = false;
  for (let i = 0; i < 70 && !back; i++) { await W(1000); back = await p.evaluate(() => window.__P.runs.some((r) => r.result)); }
  await c.talk();
  if (back) {
    await p.evaluate(() => { if (document.querySelector('#rbList')?.hidden) document.querySelector('#rbStrip')?.click(); });
    await W(300);
    await p.evaluate(() => document.querySelector('#runbar [data-rb]')?.click());
    await W(600);
    for (let i = 0; i < 20 && (await c.shown('#dlg')); i++) { await p.locator('#dlg').click(); await W(200); }
    await W(300);
    const lbl = await p.evaluate(() => document.querySelector('#repOk')?.textContent ?? '');
    ok(LAB ? lbl === '확인' : lbl === '받기', `§B-5 보고서 버튼 「${lbl}」 (보상은 귀환 때 이미 지급)`);
  } else ok(false, '30초 정찰 돌아옴');
  await ctx.close();
}

// ───────── 2) · 3) 실제 저장 ─────────
const VER = await (async () => { const cx = await b.newContext(); const v = (await (await cx.request.get(URL + 'version.json')).json()).version; await cx.close(); return JSON.stringify(v); })();
async function savedPage() {
  const sv = JSON.parse(fs.readFileSync(SAVE, 'utf8'));
  const ctx = await b.newContext(DEV);
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
{
  const { ctx, p, calm } = await savedPage();
  const W = (ms) => p.waitForTimeout(ms);
  // 2) 장비 임무 바로가기
  await p.evaluate(() => {
    const P = window.__P, w = window.__world;
    for (const it of P.bag) if (it.owner != null && it.grade !== 'n') { const a = w.actors.find((x) => x.id === it.owner); if (a && a.equip?.[it.slot] === it.id) delete a.equip[it.slot]; it.owner = null; }
    P.guide.idx = 4; // c1_equip
    P.guide.cut = 99;
    window.__openGuests();
  });
  await W(300);
  await p.evaluate(() => document.querySelectorAll('#gT .tab')[1]?.click());
  await W(300);
  await p.evaluate(() => document.querySelector('#winX').click());
  await W(600);
  await p.evaluate(() => document.querySelector('#mission').click());
  await W(500);
  const b3 = await p.evaluate(() => ({ tab: document.querySelector('#gT .tab.on')?.textContent ?? '', glow: document.querySelectorAll('.glist button.ffglow').length, title: document.querySelector('#winT')?.textContent }));
  if (LAB) {
    ok(/단골/.test(b3.tab), '§B-3 장비 임무 → 「단골」 탭 (지난번 「방문」 무시) ' + JSON.stringify(b3));
    ok(b3.glow > 0, `§B-3 낄 수 있는 사람 반짝 ${b3.glow}명`);
  } else console.error(`  (전) 장비 임무 바로가기 탭: ${b3.tab}`);
  await calm();

  // 3) K6-a 원정 끝 → 다시 보내기
  const c = counter(p);
  const id = await p.evaluate(() => {
    const P = window.__P, w = window.__world;
    const a = w.actors.find((x) => (x.status === 'regular' || x.status === 'hero') && x.runId == null && !x.leaving);
    const q = P.quests.list.find((x) => !x.tutorial);
    const id = 990001;
    P.runs.push({ id, quest: q, members: [a.id], start: Date.now() - 120000, end: Date.now() - 500 });
    a.runId = id;
    return id;
  });
  for (let i = 0; i < 20 && !(await p.evaluate((id) => !!window.__P.runs.find((r) => r.id === id)?.result, id)); i++) await W(250);
  await W(700);
  const runs0 = await p.evaluate(() => window.__P.runs.filter((r) => !r.result).length);
  /** 게시판 열기 (실험실 새 HUD는 「모험」 → 「원정」) */
  const toBoard = async (cc) => {
    if (await cc.shown('#bExp')) await cc.tap1('#bExp', '원정 버튼');
    else { await cc.tap1('#bAdv', '모험 버튼'); await W(400); await cc.tap1('[data-adv="1"]', '원정 칸'); }
    await W(600);
  };
  await W(1200);
  // 마을에 돌아오면 보고서가 저절로 뜨기도 한다 (그때부터 센다)
  if (await c.shown('#dlg')) { c.log.push('(보고서 대화가 저절로 뜸)'); await c.talk(); await W(400); }
  if (await c.shown('#repOk')) {}
  else if (await c.hit(p.locator(`#runbar [data-rb="${id}"]`))) await c.tap1(`#runbar [data-rb="${id}"]`, '끝난 원정 (진행 띠)');
  else if (await c.hit(p.locator('#rbStrip'))) { await c.tap1('#rbStrip', '진행 띠 펼치기'); await W(300); await c.tap1(`#runbar [data-rb="${id}"]`, '끝난 원정 (진행 띠)'); }
  else { await toBoard(c); await c.tap1(`.run.done[data-run="${id}"]`, '보고서 보기'); }
  await W(600);
  await c.talk();
  await W(300);
  await c.tap1('#repOk', '보고서 받기/확인');
  await W(600);
  await c.talk();
  await toBoard(c);
  await c.tap1('#winB .quest:not(.tut)', '의뢰');
  await W(500);
  await c.tap1('#pRec', '추천 편성');
  await W(400);
  await c.tap1('#pGo', '출발!');
  await W(600);
  const resent = (await p.evaluate(() => window.__P.runs.filter((r) => !r.result).length)) > runs0;
  ok(resent, '다시 보냄');
  const k6a = c.tap + c.scroll;
  console.error(`\n★ K6-a 원정 끝 → 다시 보내기 터치 ${k6a}번 (목표 ≤3)\n  ` + c.log.join('\n  '));
  await calm();

  // K6-b 장비 일괄 정리 (분해)
  const d = counter(p);
  const bag0 = await p.evaluate(() => window.__P.bag.length);
  await d.tap1('#bGuest', '손님');
  await W(500);
  await d.tap1('#gBag', '가방');
  await W(500);
  await d.tap1('#salAll', '일괄 분해…');
  await W(500);
  if (await p.evaluate(() => document.querySelector('#bkGo')?.disabled)) await d.tap1('#winB [data-g="n"]', '일반 고르기');
  await W(300);
  await d.tap1('#bkGo', '분해하기');
  await W(300);
  if (await p.evaluate(() => /한 번 더/.test(document.querySelector('#bkGo')?.textContent ?? ''))) await d.tap1('#bkGo', '한 번 더 (확인)');
  await W(500);
  const bag1 = await p.evaluate(() => window.__P.bag.length);
  const k6b = d.tap + d.scroll;
  console.error(`\n★ K6-b 장비 일괄 정리 터치 ${k6b}번 (목표 ≤2) · 가방 ${bag0}→${bag1}\n  ` + d.log.join('\n  '));
  await calm();

  // K6-c 아래 탭 바꾸기 (창이 떠 있을 때 다른 아래 탭으로)
  const pairs = [['#bBuild', '#bGuest'], ['#bGuest', '#bBuild'], ['#bBuild', '#bMenu2']];
  const k6c = [];
  for (const [from, to] of pairs) {
    await calm();
    await p.locator(from).click();
    await W(500);
    const t0 = await p.evaluate(() => document.querySelector('#winT')?.textContent);
    const e = counter(p);
    if (await e.hit(p.locator(to))) await e.tap1(to, to);
    else { await e.tap1('#winX', '창 닫기'); await W(300); await e.tap1(to, to); }
    await W(500);
    const t1 = await p.evaluate(() => document.querySelector('#winT')?.textContent);
    k6c.push(`${from}→${to}: ${e.tap + e.scroll}번 (${t0} → ${t1}) [${e.log.join(' ')}]`);
  }
  console.error(`\n★ K6-c 아래 탭 바꾸기 (목표 ≤2)\n  ` + k6c.join('\n  '));
  await calm();

  // K6-d 412폭 44px 미만 버튼
  const small = async (label) =>
    p.evaluate((label) => {
      const out = [];
      for (const el of document.querySelectorAll('button, [role=button], a[href], select, input[type=checkbox], .tab')) {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height || r.bottom < 0 || r.top > innerHeight) continue;
        if (!el.checkVisibility()) continue;
        const x = r.left + r.width / 2, y = r.top + r.height / 2;
        const e = document.elementFromPoint(Math.min(innerWidth - 1, Math.max(0, x)), Math.min(innerHeight - 1, Math.max(0, y)));
        if (!e || !(e === el || el.contains(e) || e.contains(el))) continue;
        if (r.width >= 43.5 && r.height >= 43.5) continue;
        const name = (el.id ? '#' + el.id : el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '')) + ` 「${(el.textContent || el.getAttribute('aria-label') || el.title || '').trim().slice(0, 12)}」`;
        out.push(`${label} ${name} ${Math.round(r.width)}×${Math.round(r.height)}`);
      }
      return out;
    }, label);
  const list = [];
  await calm();
  list.push(...(await small('마을')));
  const wins = [
    ['건설', async () => p.locator('#bBuild').click()],
    ['손님', async () => p.locator('#bGuest').click()],
    ['게시판', async () => toBoard(counter(p))],
    ['파티', async () => { await toBoard(counter(p)); await p.locator('#winB .quest:not(.tut)').first().click({ timeout: 6000 }); }],
    ['가방', async () => { await p.locator('#bGuest').click(); await W(400); await p.locator('#gBag').click(); }],
    ['메뉴', async () => p.locator('#bMenu2').click()],
  ];
  for (const [label, open] of wins) {
    await calm();
    await open().catch((e) => errs.push(`${label}: ${String(e).slice(0, 100)}`));
    await W(600);
    list.push(...(await small(label)));
  }
  const uniq = [...new Set(list)];
  console.error(`\n★ K6-d 412폭 44px 미만 누를 곳 ${uniq.length}개 (마을 + 건설·손님·게시판·파티·가방·메뉴)\n  ` + uniq.join('\n  '));
  fs.mkdirSync('reports/checkin/b', { recursive: true });
  fs.writeFileSync(`reports/checkin/b/k6_${LAB ? 'after' : 'before'}.json`, JSON.stringify({ k6a, k6b, k6c, small: uniq }, null, 1));
  await ctx.close();
}
await b.close();
ok(!errs.length, '페이지 오류 없음 ' + errs.join(' | '));
console.error(fail ? `✗ ${fail}건 실패` : '✓ 모두 통과');
process.exit(fail ? 1 : 0);
