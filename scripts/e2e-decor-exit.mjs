// [긴급 10/16 에펨 OhSara] 꾸미기 「다 했어요」 뒤에도 대화창이 안 꺼짐 — 새 여관(저장 없음)으로 재현
//  새 여관 → 첫 대화 → (A) 대화 다 넘기고 건설 창 「🎨 꾸미기 모드」 (B) 첫 대화가 아직 떠 있을 때 바로 꾸미기
//  꾸미기 안에서 기다리는 동안 뜬 대화·창·안내를 적고 → ✓ 다 했어요 → 남은 것 확인 · 사진 screenshots/decor-exit/<기기>_<경우>_{in,after}.png
//  (C) 10/16 OhSara 경로: 첫 꾸미기 → 다 했어요 → 버나드 「화분 하나 보태지」 대사가 떠 있는 채로 다시 꾸미기 → 다 했어요 → 대화·창 없음
//      → 건설 창 맨 앞 「🎁 선물」 줄에 튤립 화단 → 놓으면 금화 그대로 · 선물 1 → 0
//  실행: URL=http://localhost:4190/ node scripts/e2e-decor-exit.mjs [se|phone|pc] [A|B|C]
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const URL = process.env.URL ?? 'http://localhost:4190/';
const OUT = process.env.OUT ?? 'screenshots/decor-exit';
fs.mkdirSync(OUT, { recursive: true });
const DEVS = {
  se: { viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  phone: { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  pc: { viewport: { width: 1280, height: 800 } },
};
const which = process.argv[2] ? [process.argv[2]] : Object.keys(DEVS);
const WAIT = +(process.env.WAIT ?? 25000);
const b = await chromium.launch({ channel: 'chrome' });
let fail = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fail++; };

/** 지금 화면에 떠 있는 「덮는 것」 */
const STATE = () => {
  const vis = (e) => !!e && !e.hidden && e.checkVisibility() && e.getBoundingClientRect().width > 0;
  const q = (s) => document.querySelector(s);
  const dlg = q('#dlg');
  const extra = [...document.querySelectorAll('#view > *, body > *')]
    .filter((e) => vis(e) && /hint|card|coach|tip|guide|pop|toastbig|spot|focus|tut|onb|wf|letter|notice|sheet/i.test(`${e.id} ${e.className}`))
    .map((e) => `${e.tagName.toLowerCase()}#${e.id}.${String(e.className).split(' ').slice(0, 3).join('.')}`);
  return {
    decor: document.body.classList.contains('decor'),
    bar: vis(q('#decorBar')),
    dlg: vis(dlg) ? (dlg.innerText || '').replace(/s+/g, ' ').slice(0, 80) : null,
    win: q('#win')?.classList.contains('on') ? q('#winT')?.textContent : null,
    extra,
    body: document.body.className,
  };
};

const modes = process.argv[3] ? [process.argv[3]] : ['A', 'B', 'C'];
for (const dev of which) {
  for (const mode of modes) {
    console.log(`[${dev} · ${{ A: '대화 다 넘기고 꾸미기', B: '첫 대화 떠 있을 때 꾸미기', C: '버나드 선물 대사 위에서 다시 꾸미기' }[mode]}]`);
    const ctx = await b.newContext(DEVS[dev]);
    await ctx.addInitScript(() => {
      try { if (sessionStorage.getItem('x')) return; sessionStorage.setItem('x', 1); } catch { return; }
      localStorage.clear();
      localStorage.setItem('legacy-of-adventure-teaserSeen', 'true');
      localStorage.setItem('legacy-of-adventure-telemetry', 'false');
      localStorage.setItem('legacy-of-adventure-sound', JSON.stringify({ bgmOn: false, bgmVol: 0.4, sfxOn: false, sfxVol: 0.7, muted: true }));
    });
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
    p.on('dialog', (d) => d.accept());
    const W = (ms) => p.waitForTimeout(ms);
    const shown = (s) => p.evaluate((s) => { const e = document.querySelector(s); return !!e && !e.hidden && e.checkVisibility() && e.getBoundingClientRect().width > 0; }, s);
    const talk = async (max = 60) => {
      for (let i = 0; i < max; i++) {
        if (await shown('#namebox')) { await p.locator('#nameSug button').first().click(); await W(300); continue; }
        if (!(await shown('#dlg'))) return;
        if (await shown('#dChoice')) await p.locator('#dChoice button').first().click();
        else await p.locator('#dlg').click();
        await W(220);
      }
    };
    await p.goto(URL, { waitUntil: 'networkidle' });
    await p.waitForFunction(() => !!window.__S, null, { timeout: 30000 });
    await W(800);
    await p.locator('#tStart').click();
    await W(600);
    // 오프닝·이름 · B는 이름 정한 뒤 처음 마을 대화가 뜨면 거기서 멈춘다
    for (let i = 0; i < 80; i++) {
      if (await shown('#namebox')) { await p.locator('#nameSug button').first().click(); await W(500); continue; }
      const st = await p.evaluate(() => ({ dlg: !document.querySelector('#dlg').hidden, started: !!window.__S?.started, choice: !!document.querySelector('#dChoice:not([hidden])') }));
      if (mode === 'B' && st.started && st.dlg) break;
      if (!st.dlg) { if (st.started) break; await W(300); continue; }
      if (st.choice) await p.locator('#dChoice button').first().click();
      else await p.locator('#dlg').click();
      await W(250);
    }
    if (mode !== 'B') { await W(1500); await talk(); await W(500); }
    console.log('  시작 전:', JSON.stringify(await p.evaluate(STATE)));
    // 꾸미기 들어가기: 건설 창 → 🎨 꾸미기 모드 (대화가 떠 있으면 버튼이 안 눌릴 수 있어 함수로)
    const enter = async () => {
    const entered = await p.evaluate(() => {
      const t = document.getElementById('toDecor');
      if (t) { t.click(); return 'tab'; }
      return null;
    });
    if (!entered) {
      await p.evaluate(() => (document.querySelector('#bBuild') || [...document.querySelectorAll('button')].find((x) => /건설|짓기/.test(x.innerText || '') && x.offsetParent))?.click());
      await W(600);
      await p.evaluate(() => document.getElementById('toDecor')?.click());
    }
    await W(700);
    };
    const exitDecor = async () => { await p.evaluate(() => document.querySelector('#decorBar [data-act="exit"]')?.click()); await W(900); };
    if (mode === 'C') {
      // 첫 꾸미기 → 다 했어요 → 버나드 대사 기다림
      await enter();
      await exitDecor();
      let said = null;
      // 글자가 한 자씩 찍히니 줄이 다 나올 때까지
      for (let i = 0; i < 20 && !/화분|사람 사는/.test(said ?? ""); i++) { said = (await p.evaluate(STATE)).dlg; await W(400); }
      console.log('  첫 꾸미기 뒤 대사:', said);
      ok(/화분|사람 사는/.test(said ?? ''), '버나드 첫 꾸미기 대사가 뜸');
      await W(1500);
      await p.screenshot({ path: `${OUT}/${dev}_C_react.png` });
      ok(((await p.evaluate(() => window.__P.meta.giftDeco?.tulip_box)) ?? 0) === 1, '튤립 화단 선물 1');
    }
    await enter();
    let st = await p.evaluate(STATE);
    console.log('  꾸미기 들어감:', JSON.stringify(st));
    ok(st.decor, '꾸미기 모드 들어감');
    // 꾸미기 안에서 기다리며 새로 뜨는 것 기록
    const seen = new Set();
    for (let t = 0; t < WAIT; t += 1000) {
      const s = await p.evaluate(STATE);
      if (s.dlg) seen.add('대화: ' + s.dlg.slice(0, 50));
      if (s.win) seen.add('창: ' + s.win);
      s.extra.forEach((x) => seen.add('안내: ' + x));
      await W(1000);
    }
    console.log('  꾸미기 중 뜬 것:', [...seen]);
    ok(![...seen].some((x) => x.startsWith('대화')), '꾸미기 중엔 대화창이 없음');
    await p.screenshot({ path: `${OUT}/${dev}_${mode}_in.png` });
    // ✓ 다 했어요 (눌리는지도)
    const exitHit = await p.evaluate(() => {
      const el = document.querySelector('#decorBar [data-act="exit"]');
      if (!el) return 'no-btn';
      const r = el.getBoundingClientRect();
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return top === el || el.contains(top) ? 'ok' : `가림: ${top?.id || top?.className || top?.tagName}`;
    });
    console.log('  다 했어요 버튼:', exitHit);
    await p.evaluate(() => document.querySelector('#decorBar [data-act="exit"]')?.click());
    await W(900);
    st = await p.evaluate(STATE);
    console.log('  다 했어요 뒤:', JSON.stringify(st));
    await p.screenshot({ path: `${OUT}/${dev}_${mode}_after.png` });
    ok(!st.decor && !st.bar, '꾸미기 나옴');
    ok(!st.dlg || (await shown('#dSkip')) || /✕/.test(st.dlg), `대화창이 남지 않음(또는 닫기 보임): ${st.dlg ?? '-'}`);
    ok(!st.extra.length, `안내 카드 남지 않음: ${st.extra.join(', ') || '-'}`);
    if (mode === 'C') {
      const st2 = await p.evaluate(STATE);
      ok(!st2.dlg && !st2.win, `다 했어요 뒤 대화·창 없음 (대화 ${st2.dlg ?? '-'} · 창 ${st2.win ?? '-'})`);
      // 꾸미기 → ＋ 놓기 = 건설 창 · 맨 앞 선물 줄
      await enter();
      await p.evaluate(() => document.querySelector('#decorBar [data-tab="place"]')?.click());
      await W(800);
      const gift = await p.evaluate(() => { const r = document.querySelector('.cat.gifts'); const b = r?.querySelector('button[data-k="tulip_box"]'); return { row: !!r, card: !!b, text: b?.innerText.replace(/\s+/g, ' ') ?? null, first: r ? [...document.querySelectorAll('#win .cat')].indexOf(r) : -1 }; });
      console.log('  선물 줄:', JSON.stringify(gift));
      ok(gift.card && /선물 · 무료 1개/.test(gift.text ?? ''), '건설 창 「🎁 선물」 줄에 튤립 화단 (무료 1개)');
      await p.screenshot({ path: `${OUT}/${dev}_C_gift.png` });
      const g0 = await p.evaluate(() => window.__S.gold);
      await p.evaluate(() => document.querySelector('.cat.gifts button[data-k="tulip_box"]')?.click());
      // 놓기 ✓ 버튼이 뜰 때까지 · 자리가 막혀 안 놓이면 몇 번 더
      const placed = () => p.evaluate(() => window.__world.objs.some((o) => o.kind === 'tulip_box'));
      for (let i = 0; i < 6 && !(await placed()); i++) {
        await p.waitForSelector('#placeOk', { state: 'attached', timeout: 4000 }).catch(() => {});
        await p.evaluate(() => document.getElementById('placeOk')?.click());
        await W(700);
      }
      const after = await p.evaluate(() => ({ gold: window.__S.gold, gift: window.__P.meta.giftDeco?.tulip_box ?? 0, n: window.__world.objs.filter((o) => o.kind === 'tulip_box').length }));
      console.log('  놓은 뒤:', JSON.stringify({ g0, ...after }));
      // 금화는 손님 수입으로 늘 수는 있어도 180G가 빠지면 안 된다
      ok(after.n === 1 && after.gold >= g0 && after.gift === 0, '튤립 화단을 무료로 놓고 선물 1 → 0');
    }
    ok(!errs.length, '페이지 에러 없음 ' + errs.join(' | '));
    await ctx.close();
  }
}
await b.close();
console.log(fail ? `✗ ${fail}개 실패` : '✓ 모두 통과');
process.exit(fail ? 1 : 0);
