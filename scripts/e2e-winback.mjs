// 10/17 이카몰리 — 캐릭터 창에서 무기를 여러 번 바꿔도 뒤로가기 한 번이면 캐릭터 창 이전(손님 목록)으로 (winReturn)
//  손님 목록 → 캐릭터 창 → 무기 바꾸기 ×5 → [폰 뒤로가기 · Esc · 창 ← 버튼] 한 번 = 손님 목록 · 또 한 번 = 닫힘 · 더 눌러도 게임 페이지 그대로
//  창 ✕ = 한 번에 닫힘 · 그 뒤 폰 뒤로가기도 게임 밖으로 안 나감
//  실행: URL=http://localhost:4190/ node scripts/e2e-winback.mjs [phone|pc]
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const URL = process.env.URL ?? 'http://localhost:4190/';
const SAVE = fs.readFileSync('tests/fixtures/real_lotte.json', 'utf8');
const DEVS = {
  phone: { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  pc: { viewport: { width: 1280, height: 800 } },
};
const which = process.argv[2] ? [process.argv[2]] : Object.keys(DEVS);
const b = await chromium.launch({ channel: 'chrome' });
let fail = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fail++; };

for (const dev of which) {
  for (const how of (process.env.HOW ? [process.env.HOW] : ['back', 'esc', 'btn', 'x'])) {
    console.log(`[${dev} · ${how}]`);
    const ctx = await b.newContext(DEVS[dev]);
    await ctx.addInitScript((s) => {
      try { if (sessionStorage.getItem('x')) return; sessionStorage.setItem('x', 1); } catch { return; }
      localStorage.clear();
      localStorage.setItem('legacy-of-adventure-save', s);
      localStorage.setItem('legacy-of-adventure-teaserSeen', 'true');
      localStorage.setItem('legacy-of-adventure-settleOff', 'true');
      localStorage.setItem('legacy-of-adventure-telemetry', 'false');
    }, SAVE);
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
    const W = (ms) => p.waitForTimeout(ms);
    await p.goto(URL, { waitUntil: 'domcontentloaded' });
    await p.waitForSelector('#tCont', { state: 'visible', timeout: 60000 });
    await W(600);
    await p.locator('#tCont').click();
    await W(3500);
    await p.evaluate(async () => {
      const T = (ms) => new Promise((r) => setTimeout(r, ms));
      for (let i = 0, calm = 0; i < 60 && calm < 3; i++) {
        let busy = false;
        if (!document.querySelector('#dlg').hidden) { document.querySelector('#dlg').click(); busy = true; }
        else if (document.querySelector('#win').classList.contains('on')) { document.querySelector('#winX').click(); busy = true; }
        calm = busy ? 0 : calm + 1;
        await T(busy ? 150 : 250);
      }
    });
    // 화면을 한 번 눌러 바닥 항목(backRule) 깔기
    await p.mouse.click(200, 400);
    await W(300);
    const href0 = p.url();
    const title = () => p.evaluate(() => (document.querySelector('#win').classList.contains('on') ? document.querySelector('#winT')?.textContent : null));
    await p.evaluate(() => document.getElementById('bGuest')?.click());
    await W(600);
    const listT = await title();
    ok(!!listT, `손님 목록 「${listT}」`);
    // 무기 칸이 있는 단골
    const name = await p.evaluate(() => {
      const a = window.__world.actors.find((x) => !x.role && (x.status === 'regular' || x.status === 'hero') && x.runId == null && window.__P.bag.some((it) => it.slot === 'weapon' && !it.ex));
      if (!a) return null;
      window.__showActor(a);
      return a.name;
    });
    await W(500);
    ok(!!name && (await title()) === name, `캐릭터 창 「${name}」`);
    for (let i = 0; i < 5; i++) {
      await p.evaluate(() => document.querySelector('.slot[data-s="weapon"]')?.click());
      await W(400);
      // 낀 무기가 있으면 강화 창 → 「다른 장비로 바꾸기」 (실제 유저 흐름)
      if (await p.evaluate(() => !!document.getElementById('eSwap'))) {
        await p.evaluate(() => document.getElementById('eSwap').click());
        await W(400);
      }
      const t = await title();
      if (!t?.includes('무기')) { ok(false, `무기 고르기 창 (${t})`); break; }
      await p.evaluate(() => (document.querySelector('.ilist button.irow') ?? document.getElementById('unEq'))?.click());
      await W(500);
    }
    ok((await title()) === name, `무기 바꾸기 ×5 뒤 다시 캐릭터 창`);
    const back = async () => {
      if (how === 'back') await p.evaluate(() => history.back());
      else if (how === 'esc') await p.keyboard.press('Escape');
      else if (how === 'btn') await p.evaluate(() => (document.getElementById('winBack')?.hidden ? document.getElementById('winX') : document.getElementById('winBack'))?.click());
      else await p.evaluate(() => document.getElementById('winX')?.click());
      await W(700);
    };
    await back();
    if (how === 'x') {
      ok((await title()) === null, '✕ 한 번 = 다 닫힘');
    } else {
      ok((await title()) === listT, `한 번 = 손님 목록 (${await title()})`);
      await back();
      ok((await title()) === null, '또 한 번 = 닫힘');
    }
    // 폰 뒤로가기를 몇 번 더 눌러도 게임 페이지 그대로
    for (let i = 0; i < 3; i++) {
      await p.evaluate(() => history.back());
      await W(500);
    }
    ok(p.url() === href0 && (await p.evaluate(() => !!window.__S?.started)), `게임 페이지 그대로 (${p.url().slice(-30)})`);
    ok(!errs.length, '페이지 에러 없음 ' + errs.join(' | '));
    await ctx.close();
  }
}
await b.close();
console.log(fail ? `✗ ${fail}개 실패` : '✓ 모두 통과');
process.exit(fail ? 1 : 0);
